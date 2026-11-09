# Aurelia Stays: commission-based hotel booking MVP

React + Express + MongoDB, with LiteAPI (Nuitee Connect) as the hotel inventory and booking provider.

```
client/   React (Vite): search, results, hotel page, checkout, confirmation
server/   Express API: holds the LiteAPI key, validates everything, stores bookings
MongoDB   bookings + commission tracking
```
The browser never calls LiteAPI directly. The secret key lives only in `server/.env`.

## What is built (steps 1-4 of the plan)
1. Setup and configuration
2. Search by destination, dates, guests; results with images, ratings, prices, cancellation terms
3. Hotel page: gallery, description, facilities, policies, rooms grouped with every rate option
4. Checkout: guest details -> prebook -> LiteAPI payment form -> book -> confirmation
Not yet built: customer accounts and dashboard, webhooks and cancellation, admin dashboard (steps 5-7).

## Run it (sandbox, no real money)
Keep this folder OUTSIDE OneDrive (for example `C:\dev\hotel-platform`); syncing `node_modules` breaks installs.

1. Get a free sandbox key at https://dashboard.liteapi.travel (Profile > API keys).
2. Start MongoDB: `docker compose up -d` (or use a MongoDB Atlas connection string).
3. API:
   ```
   cd server
   copy .env.example .env        (macOS/Linux: cp)
   # edit .env: paste your key into LITEAPI_KEY
   npm install
   npm run dev
   ```
4. Website (second terminal):
   ```
   cd client
   npm install
   npm run dev
   ```
   Open http://localhost:5173
5. Test a booking in sandbox with card `4242 4242 4242 4242`, any future date, any CVC. No real room is reserved and no money moves.

Run the unit tests with `npm test` in `server/`.

## How the booking flow is protected
- Prebook then payment then book, in that order, as LiteAPI requires. The price you pay comes from the prebook response on the server, never from the browser.
- Duplicate protection: unique index on `prebookId`; an atomic `PAYMENT_PENDING -> BOOKING` claim so concurrent or repeated `/book` calls can only book once; repeats return the current state; a guard blocks a second booking for the same email, hotel and dates.
- Uncertain outcomes (timeout, 5xx) are saved as `BOOK_UNKNOWN` with `needsAttention: true` instead of being retried blindly, so a guest is never double-charged.
- Unavailable rooms: prebook failures show a clear message and send the guest back to choose another room; price changes are shown before paying.

## Commission
- Set `COMMISSION_MARGIN` (percent) in `server/.env`, or leave it empty to use your LiteAPI account default.
- At booking, the commission returned by prebook is stored as `ESTIMATED`. It becomes `CONFIRMED` only after the guest checks out, and `PAID` after LiteAPI's weekly payout. Cancellations set it to `VOIDED`. (The status transitions after `ESTIMATED` arrive with webhooks and the admin dashboard.)
- Customers never receive commission data from the API.
- Hotel rate rules: selling below a hotel's suggested selling price on a public site can be a rate violation. Keep the margin high enough that public prices stay at or above it, or offer lower prices only behind a login.

## Before going live
- Replace the sandbox key with a `prod_` key (the payment form switches to live mode automatically) and complete LiteAPI's production onboarding.
- Set `PUBLIC_URL` and `CLIENT_ORIGIN` to your real domain over HTTPS.
- Add a Content-Security-Policy that allows your payment provider (it is disabled in this MVP).
- Add terms of sale, privacy policy and any tax disclosures required in your market (get professional advice).
- Build for a single server: `cd client && npm run build`; the Express server serves `client/dist` automatically.
