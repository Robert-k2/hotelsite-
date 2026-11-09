import { Router } from 'express';
import { z } from 'zod';
import { liteapi, LiteApiError } from '../liteapi.js';
import { config } from '../config.js';
import { buildHotelCards, groupRooms, cleanDetails } from '../normalize.js';
import { asyncHandler, HttpError, stayCore, searchExtras, parseChildren } from '../util.js';

export const searchRouter = Router();

const ratesBody = (s, extra) => ({
  occupancies: [{ adults: s.adults, ...(s.children.length ? { children: s.children } : {}) }],
  currency: s.currency,
  guestNationality: s.nationality,
  checkin: s.checkin,
  checkout: s.checkout,
  roomMapping: true,
  ...(config.margin !== undefined ? { margin: config.margin } : {}),
  ...extra,
});

const noAvailability = (e) => e instanceof LiteApiError && e.status === 404;

searchRouter.get('/config', (req, res) => res.json({ businessName: config.BUSINESS_NAME, paymentEnv: config.paymentEnv }));

searchRouter.get('/places', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ places: [] });
  const r = await liteapi.places(q.slice(0, 80));
  const places = (r.data || []).slice(0, 8).map((p) => ({ placeId: p.placeId, name: p.displayName, address: p.formattedAddress }));
  res.json({ places });
}));

const searchBody = stayCore.and(searchExtras).and(z.object({ placeId: z.string().min(3).max(200) }));

searchRouter.post('/search', asyncHandler(async (req, res) => {
  const s = searchBody.parse(req.body);
  let resp;
  try {
    resp = await liteapi.rates(ratesBody(s, { placeId: s.placeId, maxRatesPerHotel: 1, includeHotelData: true }));
  } catch (e) {
    if (noAvailability(e)) return res.json({ hotels: [] });
    throw e;
  }
  const cards = buildHotelCards(resp).slice(0, 40);

  // If the supplier did not embed hotel info, fetch it for the first cards.
  const missing = cards.filter((c) => !c.name).slice(0, 24);
  await Promise.allSettled(missing.map(async (c) => {
    const d = cleanDetails((await liteapi.hotelDetails(c.id)).data);
    if (d) Object.assign(c, { name: d.name, image: d.image, address: d.address, city: d.city, stars: d.stars });
  }));
  res.json({ hotels: cards.filter((c) => c.name) });
}));

const hotelParam = z.object({ hotelId: z.string().regex(/^[A-Za-z0-9_-]{3,40}$/) });

searchRouter.get('/hotels/:hotelId', asyncHandler(async (req, res) => {
  const { hotelId } = hotelParam.parse(req.params);
  const s = stayCore.and(searchExtras).parse({ ...req.query, children: parseChildren(req.query.children) });

  const [detailsRes, ratesRes] = await Promise.all([
    liteapi.hotelDetails(hotelId).catch((e) => {
      if (e instanceof LiteApiError && !e.uncertain) throw new HttpError(404, 'Hotel not found');
      throw e;
    }),
    liteapi.rates(ratesBody(s, { hotelIds: [hotelId] })).catch((e) => {
      if (noAvailability(e)) return { data: [] };
      throw e;
    }),
  ]);
  const details = detailsRes.data;
  res.json({ hotel: cleanDetails(details), rooms: groupRooms(ratesRes, details) });
}));
