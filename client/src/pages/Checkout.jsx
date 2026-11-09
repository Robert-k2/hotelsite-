import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate, fmtDateTime, money, nights, store } from '../utils.js';

const SDK = 'https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1';
const loadSdk = () => new Promise((resolve, reject) => {
  if (window.LiteAPIPayment) return resolve();
  const s = document.createElement('script');
  s.src = SDK; s.onload = resolve; s.onerror = () => reject(new Error('The payment form could not be loaded. Check your connection and retry.'));
  document.body.appendChild(s);
});

export default function Checkout() {
  const ctx = store.get('checkout');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pay, setPay] = useState(null);       // prebook result: shows the payment step
  const [agree, setAgree] = useState(false);
  const mounted = useRef(null);

  // Mount the payment form once a prebook exists. The ref guards against React StrictMode double effects.
  useEffect(() => {
    if (!pay || mounted.current === pay.transactionId) return;
    mounted.current = pay.transactionId;
    loadSdk().then(() => {
      const p = new window.LiteAPIPayment({
        publicKey: pay.paymentEnv,
        secretKey: pay.secretKey,
        returnUrl: pay.returnUrl,
        targetElement: '#targetElement',
        appearance: { theme: 'flat' },
        options: { business: { name: pay.businessName } },
      });
      p.handlePayment();
    }).catch((e) => setError(e.message));
  }, [pay]);

  if (!ctx) return <Navigate to="/" replace />;
  const { hotel, room, offer, search } = ctx;
  const n = nights(search.checkin, search.checkout);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api.prebook({
        offerId: offer.offerId,
        hotel, roomName: room.name,
        stay: { checkin: search.checkin, checkout: search.checkout, adults: search.adults, children: search.children },
        holder: { firstName: form.firstName, lastName: form.lastName, email: form.email, ...(form.phone ? { phone: form.phone } : {}) },
        shownPrice: offer.price.amount,
      });
      setPay(r);
    } catch (err) {
      setError(err.message);
      if (err.data?.publicId) store.set('lastRef', err.data.publicId);
    } finally { setBusy(false); }
  };

  const total = pay?.price || offer.price;

  return (
    <div className="container section checkout">
      <div>
        <h1>Complete your booking</h1>

        <form className="card pad" onSubmit={submit}>
          <h3>1. Guest details</h3>
          <div className="grid2">
            <label>First name<input required value={form.firstName} onChange={set('firstName')} autoComplete="given-name" disabled={!!pay} /></label>
            <label>Last name<input required value={form.lastName} onChange={set('lastName')} autoComplete="family-name" disabled={!!pay} /></label>
            <label>Email<input required type="email" value={form.email} onChange={set('email')} autoComplete="email" disabled={!!pay} /></label>
            <label>Phone (optional)<input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" disabled={!!pay} /></label>
          </div>
          <p className="muted small">The confirmation is sent to this email. Use the main guest’s name as it appears on their ID.</p>
          {!pay && (
            <>
              <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I have read the cancellation terms shown on this page.</label>
              <button className="btn btn-gold" disabled={busy || !agree}>{busy ? 'Securing your rate…' : 'Continue to payment'}</button>
            </>
          )}
          {error && <p className="error">{error}</p>}
          {error && <p className="small"><Link to={-1}>← Choose another room</Link></p>}
        </form>

        {pay && (
          <div className="card pad">
            <h3>2. Payment</h3>
            {pay.priceChanged && <div className="alert warn">The price changed since you selected this room. The total below is the final price you will pay.</div>}
            {pay.paymentEnv === 'sandbox' && <div className="alert info"><strong>Test mode.</strong> No real booking or charge. Use card <code>4242 4242 4242 4242</code>, any future date and any 3-digit CVC.</div>}
            <div id="targetElement" className="payment-box" />
            <p className="muted small">Do not close or refresh this page after paying. You will be redirected to your confirmation automatically.</p>
          </div>
        )}
      </div>

      <aside className="card pad summary">
        {hotel.image && <img src={hotel.image} alt={hotel.name} />}
        <h3>{hotel.name}</h3>
        <p className="muted">{room.name} · {offer.boardName}</p>
        <dl>
          <div><dt>Check-in</dt><dd>{fmtDate(search.checkin)}</dd></div>
          <div><dt>Check-out</dt><dd>{fmtDate(search.checkout)}</dd></div>
          <div><dt>Guests</dt><dd>{search.adults} adult{search.adults === 1 ? '' : 's'}{search.children.length ? `, ${search.children.length} child${search.children.length === 1 ? '' : 'ren'}` : ''}</dd></div>
          <div><dt>Nights</dt><dd>{n}</dd></div>
        </dl>
        <div className="terms">
          {(pay?.cancellation ? pay.cancellation.refundableTag === 'RFN' : offer.refundable)
            ? <span className="badge good">Free cancellation{offer.freeCancelUntil ? ` until ${fmtDateTime(offer.freeCancelUntil)}` : ''}</span>
            : <span className="badge">Non-refundable: no refund if you cancel</span>}
        </div>
        <div className="total"><span>Total{pay ? '' : ' (to be confirmed)'}</span><strong>{money(total, 2)}</strong></div>
      </aside>
    </div>
  );
}
