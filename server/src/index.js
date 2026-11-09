import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { config } from './config.js';
import { LiteApiError } from './liteapi.js';
import { Booking } from './models/Booking.js';
import { searchRouter } from './routes/search.js';
import { checkoutRouter } from './routes/checkout.js';

const app = express();
app.set('trust proxy', 1);
// CSP is off in this MVP because the hosted payment form loads scripts and frames from third parties.
// Before production, add a CSP that allows your payment provider's hosts.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.CLIENT_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

const general = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });
const strict = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api', general);
app.use('/api/checkout', strict);

app.get('/api/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));
app.use('/api', searchRouter);
app.use('/api/checkout', checkoutRouter);
app.get('/api/bookings/:publicId', (req, res, next) => { req.url = `/bookings/${req.params.publicId}`; checkoutRouter.handle(req, res, next); });
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app when it exists (single-server deployment).
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// One place that turns every error into a safe JSON message.
app.use((err, req, res, next) => {
  if (err instanceof ZodError) return res.status(400).json({ error: err.issues[0]?.message || 'Invalid request' });
  if (err.status && err.message && !(err instanceof LiteApiError)) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err instanceof LiteApiError) {
    console.error('[liteapi]', err.status, err.code, err.description);
    const msg = err.uncertain ? 'The hotel supplier is not responding. Please try again in a moment.' : (err.description || 'The request could not be completed.');
    return res.status(err.uncertain ? 502 : 400).json({ error: msg });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

await mongoose.connect(config.MONGODB_URI);
await Booking.init(); // builds the unique indexes that prevent duplicates
app.listen(config.PORT, () => console.log(`API on http://localhost:${config.PORT} (${config.paymentEnv} mode)`));
