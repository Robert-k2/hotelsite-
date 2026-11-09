// Pure functions that turn LiteAPI responses into the shapes the React app uses.
// Kept free of I/O so they can be unit-tested.

export const money = (rate) => {
  const t = rate?.retailRate?.total?.[0];
  return t && Number.isFinite(Number(t.amount)) ? { amount: Number(t.amount), currency: t.currency } : null;
};

export const isRefundable = (rate) => rate?.cancellationPolicies?.refundableTag === 'RFN';

// Earliest deadline after which charges apply (cancelTime is "YYYY-MM-DD HH:mm:ss" in GMT).
export function freeCancelUntil(rate) {
  if (!isRefundable(rate)) return null;
  const infos = (rate.cancellationPolicies?.cancelPolicyInfos || [])
    .filter((i) => i?.cancelTime && Number(i.amount) > 0)
    .map((i) => i.cancelTime)
    .sort();
  return infos.length ? infos[0].replace(' ', 'T') + 'Z' : null;
}

export const stripHtml = (s) =>
  String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export function buildHotelCards(resp) {
  const info = new Map((resp?.hotels || []).map((h) => [h.id, h]));
  const cards = [];
  for (const h of resp?.data || []) {
    let best = null;
    for (const rt of h.roomTypes || []) {
      for (const r of rt.rates || []) {
        const p = money(r);
        if (p && (!best || p.amount < best.price.amount)) best = { price: p, rate: r };
      }
    }
    if (!best) continue; // no usable price: do not show an unbookable hotel
    const i = info.get(h.hotelId) || {};
    cards.push({
      id: h.hotelId,
      name: i.name || null,
      image: i.main_photo || null,
      address: i.address || null,
      city: i.city || null,
      rating: i.rating ?? null,
      stars: i.starRating ?? i.stars ?? null,
      price: best.price,
      roomName: best.rate.name || null,
      boardName: best.rate.boardName || null,
      refundable: isRefundable(best.rate),
      freeCancelUntil: freeCancelUntil(best.rate),
    });
  }
  return cards.sort((a, b) => a.price.amount - b.price.amount);
}

export function groupRooms(resp, details) {
  const rooms = new Map();
  const roomInfo = new Map((details?.rooms || []).map((r) => [String(r.id), r]));
  const hotel = (resp?.data || [])[0];
  for (const rt of hotel?.roomTypes || []) {
    for (const r of rt.rates || []) {
      const price = money(r);
      if (!price || !rt.offerId) continue;
      const key = String(r.mappedRoomId ?? r.name);
      if (!rooms.has(key)) {
        const ri = roomInfo.get(String(r.mappedRoomId));
        rooms.set(key, { key, name: ri?.roomName || r.name, image: ri?.photos?.[0]?.url || null, offers: [] });
      }
      const taxes = r.retailRate?.taxesAndFees || [];
      rooms.get(key).offers.push({
        offerId: rt.offerId,
        rateName: r.name,
        boardName: r.boardName || 'Room Only',
        price,
        taxesIncluded: taxes.length ? taxes.every((t) => t.included) : null,
        refundable: isRefundable(r),
        freeCancelUntil: freeCancelUntil(r),
      });
    }
  }
  const list = [...rooms.values()];
  list.forEach((room) => room.offers.sort((a, b) => a.price.amount - b.price.amount));
  return list.sort((a, b) => a.offers[0].price.amount - b.offers[0].price.amount);
}

export function cleanDetails(d) {
  if (!d) return null;
  return {
    id: d.id,
    name: d.name,
    description: stripHtml(d.hotelDescription),
    importantInfo: stripHtml(d.hotelImportantInformation),
    image: d.main_photo || d.hotelImages?.find((i) => i.defaultImage)?.url || d.hotelImages?.[0]?.url || null,
    images: (d.hotelImages || []).map((i) => i.url).filter(Boolean).slice(0, 12),
    address: d.address || null,
    city: d.city || null,
    country: d.country || null,
    stars: d.starRating ?? null,
    facilities: (d.hotelFacilities || []).slice(0, 24),
    location: d.location || null,
    policies: (d.policies || []).slice(0, 6).map((p) => ({ name: p.name, description: stripHtml(p.description) })),
  };
}
