import { z } from 'zod';

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const iso = /^\d{4}-\d{2}-\d{2}$/;
export const dateStr = z.string().regex(iso, 'Use the format YYYY-MM-DD');
export const today = () => new Date().toISOString().slice(0, 10);
export const nightsBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);

// Shared stay fields used by search, hotel details and checkout.
export const stayCore = z.object({
  checkin: dateStr,
  checkout: dateStr,
  adults: z.coerce.number().int().min(1).max(6),
  children: z.array(z.coerce.number().int().min(0).max(17)).max(4).default([]),
}).superRefine((s, ctx) => {
  if (s.checkin < today()) ctx.addIssue({ code: 'custom', message: 'Check-in cannot be in the past' });
  const n = nightsBetween(s.checkin, s.checkout);
  if (n < 1) ctx.addIssue({ code: 'custom', message: 'Check-out must be after check-in' });
  if (n > 30) ctx.addIssue({ code: 'custom', message: 'Stays are limited to 30 nights' });
});

export const searchExtras = z.object({
  currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
  nationality: z.string().length(2).toUpperCase().default('US'),
});

export const parseChildren = (v) =>
  typeof v === 'string' && v.length ? v.split(',').map(Number) : Array.isArray(v) ? v : [];
