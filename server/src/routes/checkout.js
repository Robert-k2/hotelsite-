import { Router } from 'express';
import { z } from 'zod';
import { liteapi, LiteApiError } from '../liteapi.js';
import { config } from '../config.js';
import { Booking, toPublic } from '../models/Booking.js';
import { asyncHandler, HttpError, stayCore } from '../util.js';

export const checkoutRouter = Router();

const person = z.string().trim().regex(/^[\p{L}\p{M}' .-]{1,60}$/u, 'Please use letters only for names');

const prebookBody = z.object({
  offerId: z.string().min(5).max(10000),
  hotel: z.object({
    id: z.string().max(40),
    name: z.string().max(200),
    image: z.string().url().nullish(),
    address: z.string().max(300).nullish(),
    city: z.string().max(100).nullish(),
  }),
  roomName: z.string().max(200),
  stay: stayCore,
  holder: z.object({ firstName: person, lastName: person, email: z.string().trim().email().max(120), phone: z.string().trim().max(30).optional() }),
  shownPrice: z.number().positive(),
});

// Step 1: lock the selected rate. Returns what the browser needs to show the payment form.
checkoutRouter.post('/prebook', asyncHandler(async (req, res) => {
  const b = prebookBody.parse(req.body);
  const email = b.holder.email.toLowerCase();

  // Duplicate-booking guard: same guest, hotel and dates already booked or in progress.
  const dup = await Booking.findOne({
    'holder.email': email, 'hotel.id': b.hotel.id, checkin: b.stay.checkin, checkout: b.stay.checkout,
    status: { $in: ['BOOKING', 'CONFIRMED', 'BOOK_UNKNOWN'] },
  }).select('publicId');
  if (dup) throw new HttpError(409, 'A booking for these dates at this hotel already exists for this email address.', { publicId: dup.publicId });

  let d;
  try {
    d = (await liteapi.prebook(b.offerId)).data;
  } catch (e) {
    if (e instanceof LiteApiError && !e.uncertain) throw new HttpError(409, 'This room is no longer available at that price. Please choose another option.');
    throw e;
  }
  if (!d?.prebookId || !d?.transactionId || !d?.secretKey || !Number.isFinite(Number(d.price))) {
    throw new HttpError(502, 'The hotel supplier returned an unexpected response. Please try again.');
  }

  const rate = d.roomTypes?.[0]?.rates?.[0];
  const price = { amount: Number(d.price), currency: d.currency };
  const booking = await Booking.create({
    prebookId: d.prebookId,
    transactionId: d.transactionId,
    hotel: b.hotel,
    room: { name: b.roomName, boardName: rate?.boardName },
    checkin: b.stay.checkin, checkout: b.stay.checkout, adults: b.stay.adults, children: b.stay.children,
    holder: b.holder,
    guests: [{ occupancyNumber: 1, firstName: b.holder.firstName, lastName: b.holder.lastName, email }],
    price,
    commission: { amount: Number(d.commission) || 0, currency: d.currency, status: 'NONE' },
    cancellation: rate?.cancellationPolicies || null,
  });

  res.json({
    publicId: booking.publicId,
    secretKey: d.secretKey,                 // only needed by the payment form; not stored
    transactionId: d.transactionId,
    price,
    priceChanged: Math.abs(price.amount - b.shownPrice) > 0.01,
    cancellation: booking.cancellation,
    paymentEnv: config.paymentEnv,
    businessName: config.BUSINESS_NAME,
    returnUrl: `${config.PUBLIC_URL}/booking/confirm?ref=${booking.publicId}&tid=${encodeURIComponent(d.transactionId)}`,
  });
}));

const bookBody = z.object({ publicId: z.string().min(10).max(40), transactionId: z.string().min(3).max(200) });

// Step 2: after the payment form succeeds, complete the reservation with the supplier.
checkoutRouter.post('/book', asyncHandler(async (req, res) => {
  const { publicId, transactionId } = bookBody.parse(req.body);
  const existing = await Booking.findOne({ publicId });
  if (!existing) throw new HttpError(404, 'Booking not found');
  if (existing.transactionId !== transactionId) throw new HttpError(400, 'Payment reference does not match this booking');

  // Idempotent: refreshes and repeats return the current state instead of booking twice.
  if (existing.status !== 'PAYMENT_PENDING') {
    return res.status(existing.status === 'BOOKING' ? 202 : 200).json(toPublic(existing));
  }

  // Atomic claim: only one concurrent request can move PAYMENT_PENDING -> BOOKING.
  const claimed = await Booking.findOneAndUpdate({ publicId, status: 'PAYMENT_PENDING' }, { status: 'BOOKING' }, { new: true });
  if (!claimed) {
    const now = await Booking.findOne({ publicId });
    return res.status(now.status === 'BOOKING' ? 202 : 200).json(toPublic(now));
  }

  try {
    const r = await liteapi.book({
      prebookId: claimed.prebookId,
      holder: { firstName: claimed.holder.firstName, lastName: claimed.holder.lastName, email: claimed.holder.email },
      payment: { method: 'TRANSACTION_ID', transactionId: claimed.transactionId },
      guests: claimed.guests.map((g) => ({ occupancyNumber: g.occupancyNumber, firstName: g.firstName, lastName: g.lastName, email: g.email })),
    });
    const d = r.data || {};
    if (!d.bookingId) throw new LiteApiError(502, 'NO_BOOKING_ID', 'Supplier response had no bookingId');

    const confirmed = d.status === 'CONFIRMED';
    const done = await Booking.findOneAndUpdate({ publicId }, {
      status: confirmed ? 'CONFIRMED' : 'BOOK_UNKNOWN',
      liteapiBookingId: d.bookingId,
      confirmationCode: d.hotelConfirmationCode || null,
      cancellation: d.cancellationPolicies || claimed.cancellation,
      needsAttention: !confirmed,
      ...(confirmed
        ? { 'commission.status': 'ESTIMATED' }
        : { error: { code: 'STATUS', message: `We are confirming your booking with the hotel (status: ${d.status}). We will email you shortly.`, at: new Date() } }),
    }, { new: true });
    return res.json(toPublic(done));
  } catch (e) {
    const uncertain = !(e instanceof LiteApiError) || e.uncertain;
    const failed = await Booking.findOneAndUpdate({ publicId }, {
      status: uncertain ? 'BOOK_UNKNOWN' : 'FAILED',
      needsAttention: true,
      error: {
        code: String(e.code ?? 'ERR'),
        message: uncertain
          ? 'We could not confirm your booking yet. We are checking with the hotel and will email you. You will not be charged twice.'
          : (e.description || 'The booking could not be completed.'),
        at: new Date(),
      },
    }, { new: true });
    console.error('[book] failed', { publicId, status: failed.status, code: e.code, desc: e.description });
    return res.status(uncertain ? 202 : 200).json(toPublic(failed));
  }
}));

checkoutRouter.get('/bookings/:publicId', asyncHandler(async (req, res) => {
  const b = await Booking.findOne({ publicId: String(req.params.publicId).slice(0, 40) });
  if (!b) throw new HttpError(404, 'Booking not found');
  res.json(toPublic(b));
}));
