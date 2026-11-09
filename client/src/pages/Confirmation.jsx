import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate, fmtDateTime, money, store } from '../utils.js';

export default function Confirmation() {
  const [sp] = useSearchParams();
  const ref = sp.get('ref');
  const tid = sp.get('tid');
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!ref || !tid || started.current) return;
    started.current = true;
    let live = true;
    let tries = 0;

    const poll = async () => {            // another request is finishing the booking: wait for it
      while (live && tries++ < 20) {
        await new Promise((r) => setTimeout(r, 3000));
        const b = await api.booking(ref).catch(() => null);
        if (b && b.status !== 'BOOKING') return b;
      }
      return null;
    };

    (async () => {
      try {
        let b = await api.book({ publicId: ref, transactionId: tid });
        if (b.status === 'BOOKING') b = (await poll()) || b;
        if (!live) return;
        setBooking(b);
        if (b.status === 'CONFIRMED') store.del('checkout');
      } catch (e) { if (live) setError(e.message); }
    })();
    return () => { live = false; };
  }, [ref, tid]);

  if (!ref || !tid) return <div className="container section"><div className="alert error">This confirmation link is incomplete.</div><Link className="btn" to="/">Back to search</Link></div>;
  if (error) return <div className="container section narrow"><div className="alert error">{error}</div><p className="muted">If you were charged, do not pay again. Contact us with reference <code>{ref}</code>.</p></div>;
  if (!booking || booking.status === 'BOOKING') {
    return <div className="container section narrow center"><div className="spinner" /><h2>Confirming your booking…</h2><p className="muted">This can take up to 10 seconds. Please do not close this page.</p></div>;
  }

  const ok = booking.status === 'CONFIRMED';
  const pending = booking.status === 'BOOK_UNKNOWN';
  return (
    <div className="container section narrow">
      <div className={`status-banner ${ok ? 'ok' : pending ? 'wait' : 'bad'}`}>
        <h1>{ok ? 'Your booking is confirmed' : pending ? 'We’re confirming your booking' : 'We couldn’t complete your booking'}</h1>
        {!ok && booking.message && <p>{booking.message}</p>}
        {!ok && !pending && <p>Any payment hold is released automatically within 1–2 business days.</p>}
      </div>

      <div className="card pad">
        <h2>{booking.hotel?.name}</h2>
        <p className="muted">{[booking.hotel?.address, booking.hotel?.city].filter(Boolean).join(', ')}</p>
        <dl className="details">
          <div><dt>Room</dt><dd>{booking.room?.name}{booking.room?.boardName ? ` · ${booking.room.boardName}` : ''}</dd></div>
          <div><dt>Check-in</dt><dd>{fmtDate(booking.checkin)}</dd></div>
          <div><dt>Check-out</dt><dd>{fmtDate(booking.checkout)}</dd></div>
          <div><dt>Guest</dt><dd>{booking.holder?.firstName} {booking.holder?.lastName}</dd></div>
          <div><dt>Email</dt><dd>{booking.holder?.email}</dd></div>
          {booking.bookingId && <div><dt>Booking ID</dt><dd><code>{booking.bookingId}</code></dd></div>}
          {booking.confirmationCode && <div><dt>Hotel confirmation code</dt><dd><code>{booking.confirmationCode}</code></dd></div>}
          <div><dt>Reference</dt><dd><code>{booking.publicId}</code></dd></div>
          <div><dt>Total paid</dt><dd><strong>{booking.price && money(booking.price, 2)}</strong></dd></div>
        </dl>
        {ok && booking.cancellation && (
          <p className="muted small">{booking.cancellation.refundableTag === 'RFN' ? 'This booking is refundable under the hotel’s cancellation policy.' : 'This booking is non-refundable.'}
            {' '}Created {fmtDateTime(booking.createdAt)}.</p>
        )}
        <p className="muted small">Keep your reference. Online booking management is coming soon.</p>
      </div>
      <Link className="btn" to="/">Book another stay</Link>
    </div>
  );
}
