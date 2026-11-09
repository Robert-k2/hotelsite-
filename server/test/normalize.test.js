import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHotelCards, groupRooms, freeCancelUntil, cleanDetails } from '../src/normalize.js';

const rate = (name, amount, tag = 'RFN', mapped = 1) => ({
  name, mappedRoomId: mapped, boardName: 'Room Only',
  retailRate: { total: [{ amount, currency: 'USD' }], taxesAndFees: [{ included: true }] },
  cancellationPolicies: { refundableTag: tag, cancelPolicyInfos: [{ cancelTime: '2026-12-01 10:00:00', amount: 100 }] },
});

test('cards: lowest price wins, hotels without prices are dropped, sorted ascending', () => {
  const resp = {
    data: [
      { hotelId: 'a', roomTypes: [{ offerId: 'o1', rates: [rate('Std', 200)] }, { offerId: 'o2', rates: [rate('Suite', 150)] }] },
      { hotelId: 'b', roomTypes: [{ offerId: 'o3', rates: [rate('Std', 90)] }] },
      { hotelId: 'c', roomTypes: [] },
    ],
    hotels: [{ id: 'a', name: 'Hotel A', main_photo: 'x', rating: 8.5 }],
  };
  const cards = buildHotelCards(resp);
  assert.deepEqual(cards.map((c) => c.id), ['b', 'a']);
  assert.equal(cards[1].price.amount, 150);
  assert.equal(cards[1].name, 'Hotel A');
  assert.equal(cards[0].name, null);
});

test('rooms are grouped by mappedRoomId and offers sorted by price', () => {
  const resp = { data: [{ hotelId: 'a', roomTypes: [
    { offerId: 'o1', rates: [rate('Deluxe', 300, 'NRFN', 7)] },
    { offerId: 'o2', rates: [rate('Deluxe', 250, 'RFN', 7)] },
    { offerId: 'o3', rates: [rate('Single', 100, 'RFN', 8)] },
  ] }] };
  const rooms = groupRooms(resp, { rooms: [{ id: 7, roomName: 'Deluxe Room', photos: [{ url: 'p' }] }] });
  assert.equal(rooms.length, 2);
  assert.equal(rooms[0].name, 'Single');
  assert.equal(rooms[1].name, 'Deluxe Room');
  assert.equal(rooms[1].image, 'p');
  assert.deepEqual(rooms[1].offers.map((o) => o.offerId), ['o2', 'o1']);
  assert.equal(rooms[1].offers[1].refundable, false);
});

test('free-cancel deadline only for refundable rates', () => {
  assert.equal(freeCancelUntil(rate('x', 1, 'RFN')), '2026-12-01T10:00:00Z');
  assert.equal(freeCancelUntil(rate('x', 1, 'NRFN')), null);
});

test('details are stripped of HTML', () => {
  const d = cleanDetails({ id: 'h', name: 'N', hotelDescription: '<p>Nice&nbsp;<b>place</b></p>', hotelImages: [{ url: 'u', defaultImage: true }] });
  assert.equal(d.description, 'Nice place');
  assert.equal(d.image, 'u');
});
