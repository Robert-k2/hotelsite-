export const BRAND = import.meta.env.VITE_BRAND_NAME || 'Aurelia Stays';

export const money = (p, digits = 0) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(p.amount);

export const nights = (a, b) => Math.max(0, Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5));

export const fmtDate = (d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };

export const nextDay = (iso) => { const d = new Date(iso + 'T00:00'); d.setDate(d.getDate() + 1); return isoDate(d); };

export const defaultSearch = () => ({
  placeId: '', place: '', checkin: addDays(14), checkout: addDays(17), adults: 2, children: [], currency: 'USD', nationality: 'US',
});

export function readSearch(sp) {
  const d = defaultSearch();
  return {
    placeId: sp.get('placeId') || '',
    place: sp.get('place') || '',
    checkin: sp.get('checkin') || d.checkin,
    checkout: sp.get('checkout') || d.checkout,
    adults: Number(sp.get('adults') || d.adults),
    children: (sp.get('children') || '').split(',').filter(Boolean).map(Number),
    currency: sp.get('currency') || d.currency,
    nationality: sp.get('nationality') || d.nationality,
  };
}

export function writeSearch(s) {
  const p = new URLSearchParams({ placeId: s.placeId, place: s.place, checkin: s.checkin, checkout: s.checkout, adults: s.adults, currency: s.currency, nationality: s.nationality });
  if (s.children.length) p.set('children', s.children.join(','));
  return p.toString();
}

// Query string for the hotel endpoint (no placeId needed).
export const stayQuery = (s) => {
  const p = new URLSearchParams({ checkin: s.checkin, checkout: s.checkout, adults: s.adults, currency: s.currency, nationality: s.nationality });
  if (s.children.length) p.set('children', s.children.join(','));
  return p.toString();
};

export const NATIONALITIES = [
  ['US', 'United States'], ['GB', 'United Kingdom'], ['CZ', 'Czechia'], ['DE', 'Germany'], ['ES', 'Spain'], ['FR', 'France'],
  ['IT', 'Italy'], ['CO', 'Colombia'], ['MX', 'Mexico'], ['AR', 'Argentina'], ['BR', 'Brazil'], ['PE', 'Peru'], ['CL', 'Chile'],
];

export const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};
