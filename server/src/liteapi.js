import { config } from './config.js';

const API = 'https://api.liteapi.travel/v3.0';
const BOOK = 'https://book.liteapi.travel/v3.0';

export class LiteApiError extends Error {
  constructor(status, code, description, message) {
    super(description || message || 'LiteAPI error');
    this.status = status; this.code = code; this.description = description; this.apiMessage = message;
  }
  // true when we cannot tell whether the supplier processed the request (timeout, network, 5xx)
  get uncertain() { return this.status === 0 || this.status >= 500; }
}

async function call(base, method, path, { query, body, timeoutMs = 30000 } = {}) {
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'X-API-Key': config.LITEAPI_KEY, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new LiteApiError(0, 'NETWORK', e.name === 'AbortError' ? 'Request timed out' : e.message, 'Could not reach the hotel supplier');
  } finally { clearTimeout(timer); }

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  if (!res.ok || json?.error) {
    const e = json?.error || {};
    throw new LiteApiError(res.status, e.code, e.description || text.slice(0, 200), e.message);
  }
  return json;
}

export const liteapi = {
  places: (q) => call(API, 'GET', '/data/places', { query: { textQuery: q }, timeoutMs: 10000 }),
  rates: (body) => call(API, 'POST', '/hotels/rates', { body, timeoutMs: 45000 }),
  hotelDetails: (hotelId) => call(API, 'GET', '/data/hotel', { query: { hotelId, timeout: 4 }, timeoutMs: 15000 }),
  // Prebook and book can take 5-10 seconds.
  prebook: (offerId) => call(BOOK, 'POST', '/rates/prebook', { body: { usePaymentSdk: true, offerId }, timeoutMs: 45000 }),
  book: (payload) => call(BOOK, 'POST', '/rates/book', { body: payload, timeoutMs: 60000 }),
  getBooking: (bookingId) => call(BOOK, 'GET', `/bookings/${encodeURIComponent(bookingId)}`, { timeoutMs: 20000 }),
};
