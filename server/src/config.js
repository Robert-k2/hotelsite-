import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  LITEAPI_KEY: z.string().min(10, 'LITEAPI_KEY is missing. Copy .env.example to .env and add your key.'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/hotel_platform'),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_URL: z.string().default('http://localhost:5173'),
  COMMISSION_MARGIN: z.string().optional(),
  BUSINESS_NAME: z.string().default('Aurelia Stays'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration error:\n' + parsed.error.issues.map((i) => ' - ' + i.message).join('\n'));
  process.exit(1);
}
const env = parsed.data;

let margin;
if (env.COMMISSION_MARGIN !== undefined && env.COMMISSION_MARGIN.trim() !== '') {
  margin = Number(env.COMMISSION_MARGIN);
  if (!Number.isFinite(margin) || margin < 0 || margin > 50) {
    console.error('Configuration error: COMMISSION_MARGIN must be a number between 0 and 50.');
    process.exit(1);
  }
}

export const config = {
  ...env,
  margin,
  // The payment form must use the same environment as the API key.
  paymentEnv: env.LITEAPI_KEY.startsWith('prod_') ? 'live' : 'sandbox',
};
