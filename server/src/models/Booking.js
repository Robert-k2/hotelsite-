import mongoose from 'mongoose';
import crypto from 'node:crypto';

const { Schema } = mongoose;

// Booking lifecycle: PAYMENT_PENDING -> BOOKING -> CONFIRMED -> COMPLETED
// Exits: FAILED (supplier rejected), BOOK_UNKNOWN (outcome uncertain, needs reconciliation),
//        CANCELLED, CANCELLED_WITH_CHARGES
export const BOOKING_STATUSES = ['PAYMENT_PENDING', 'BOOKING', 'CONFIRMED', 'COMPLETED', 'FAILED', 'BOOK_UNKNOWN', 'CANCELLED', 'CANCELLED_WITH_CHARGES'];
// Commission lifecycle: NONE -> ESTIMATED (booked) -> CONFIRMED (guest checked out) -> PAID (weekly payout); VOIDED on cancellation
export const COMMISSION_STATUSES = ['NONE', 'ESTIMATED', 'CONFIRMED', 'PAID', 'VOIDED'];

const bookingSchema = new Schema({
  publicId: { type: String, unique: true, default: () => crypto.randomBytes(12).toString('base64url') },
  status: { type: String, enum: BOOKING_STATUSES, default: 'PAYMENT_PENDING', index: true },
  prebookId: { type: String, required: true, unique: true },
  transactionId: { type: String, required: true },
  liteapiBookingId: { type: String, unique: true, sparse: true },
  confirmationCode: String,
  hotel: { id: String, name: String, image: String, address: String, city: String },
  room: { name: String, boardName: String },
  checkin: String,
  checkout: String,
  adults: Number,
  children: [Number],
  holder: { firstName: String, lastName: String, email: { type: String, lowercase: true, trim: true }, phone: String },
  guests: [{ _id: false, occupancyNumber: Number, firstName: String, lastName: String, email: String }],
  price: { amount: Number, currency: String },                // what the customer pays (from prebook, never from the browser)
  commission: {
    amount: { type: Number, default: 0 },
    currency: String,
    status: { type: String, enum: COMMISSION_STATUSES, default: 'NONE' },
    confirmedAt: Date,
    paidAt: Date,
  },
  cancellation: Schema.Types.Mixed,                             // refundableTag + cancelPolicyInfos from the supplier
  error: { code: String, message: String, at: Date },
  needsAttention: { type: Boolean, default: false },
}, { timestamps: true });

bookingSchema.index({ 'holder.email': 1, 'hotel.id': 1, checkin: 1, checkout: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);

// Public view for customers. Never include commission or internal fields.
export const toPublic = (b) => ({
  publicId: b.publicId,
  status: b.status,
  hotel: b.hotel,
  room: b.room,
  checkin: b.checkin,
  checkout: b.checkout,
  adults: b.adults,
  children: b.children,
  holder: { firstName: b.holder?.firstName, lastName: b.holder?.lastName, email: b.holder?.email },
  price: b.price,
  bookingId: b.liteapiBookingId || null,
  confirmationCode: b.confirmationCode || null,
  cancellation: b.cancellation || null,
  message: b.error?.message || null,
  createdAt: b.createdAt,
});
