// Thin wrapper around the Express API. The browser never talks to LiteAPI directly.
async function req(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: res.status, data });
  return data;
}

export const api = {
  places: (q) => req('GET', `/places?q=${encodeURIComponent(q)}`),
  search: (body) => req('POST', '/search', body),
  hotel: (id, qs) => req('GET', `/hotels/${encodeURIComponent(id)}?${qs}`),
  prebook: (body) => req('POST', '/checkout/prebook', body),
  book: (body) => req('POST', '/checkout/book', body),
  booking: (ref) => req('GET', `/checkout/bookings/${encodeURIComponent(ref)}`),
};
