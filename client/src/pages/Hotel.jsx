import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate, fmtDateTime, money, nights, readSearch, store } from '../utils.js';

export default function Hotel() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const search = useMemo(() => readSearch(sp), [sp]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    let live = true;
    setData(null); setError('');
    api.hotel(id, sp.toString()).then((r) => live && setData(r)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [id, sp]);

  if (error) return <div className="container section"><div className="alert error">{error}</div><Link className="btn" to="/">Back to search</Link></div>;
  if (!data) return <div className="container section"><div className="skeleton tall" /><p className="muted center">Loading hotel and live rates…</p></div>;

  const { hotel, rooms } = data;
  const n = nights(search.checkin, search.checkout);
  const images = hotel.images.length ? hotel.images : hotel.image ? [hotel.image] : [];

  const select = (room, offer) => {
    store.set('checkout', { hotel: { id: hotel.id, name: hotel.name, image: hotel.image, address: hotel.address, city: hotel.city }, room: { name: room.name }, offer, search });
    nav('/checkout');
  };

  return (
    <div className="container section">
      <Link to={-1} className="back">← Back to results</Link>
      <div className="hotel-head">
        <div>
          <h1>{hotel.name}</h1>
          <p className="muted">{hotel.stars ? <span className="stars">{'★'.repeat(Math.round(hotel.stars))} </span> : null}{[hotel.address, hotel.city, hotel.country].filter(Boolean).join(', ')}</p>
        </div>
      </div>

      {images.length > 0 && (
        <div className="gallery">
          <img className="main" src={images[photo]} alt={hotel.name} />
          <div className="thumbs">{images.slice(0, 6).map((u, i) => <button key={u} onClick={() => setPhoto(i)} className={i === photo ? 'on' : ''}><img src={u} alt="" loading="lazy" /></button>)}</div>
        </div>
      )}

      <div className="hotel-grid">
        <div>
          <h2>About this hotel</h2>
          <p className="desc">{hotel.description || 'No description available.'}</p>
          {hotel.facilities.length > 0 && <><h3>Facilities</h3><div className="chips">{hotel.facilities.map((f) => <span key={f} className="chip">{f}</span>)}</div></>}
          {hotel.policies.length > 0 && <><h3>Hotel policies</h3><ul className="policies">{hotel.policies.map((p) => <li key={p.name}><strong>{p.name}.</strong> {p.description}</li>)}</ul></>}
          {hotel.importantInfo && <><h3>Important information</h3><p className="desc">{hotel.importantInfo}</p></>}
        </div>

        <aside>
          <div className="stay-box">
            <strong>{fmtDate(search.checkin)} → {fmtDate(search.checkout)}</strong>
            <span className="muted">{n} night{n === 1 ? '' : 's'} · {search.adults} adult{search.adults === 1 ? '' : 's'}{search.children.length ? `, ${search.children.length} child${search.children.length === 1 ? '' : 'ren'}` : ''}</span>
          </div>
        </aside>
      </div>

      <h2 id="rooms">Choose your room</h2>
      {rooms.length === 0 && <div className="empty"><h3>No rooms available for these dates</h3><p className="muted">Try different dates.</p><Link className="btn" to="/">Change search</Link></div>}
      {rooms.map((room) => (
        <div key={room.key} className="card room">
          <div className="room-img">{room.image ? <img src={room.image} alt={room.name} loading="lazy" /> : <div className="noimg">No photo</div>}</div>
          <div className="room-body">
            <h3>{room.name}</h3>
            {room.offers.map((o) => (
              <div key={o.offerId} className="offer">
                <div>
                  <strong>{o.boardName}</strong>
                  <div className="badges">
                    {o.refundable ? <span className="badge good">Free cancellation{o.freeCancelUntil ? ` until ${fmtDateTime(o.freeCancelUntil)}` : ''}</span> : <span className="badge">Non-refundable</span>}
                    {o.taxesIncluded === true && <span className="badge">Taxes included</span>}
                    {o.taxesIncluded === false && <span className="badge warn">Some taxes payable at hotel</span>}
                  </div>
                </div>
                <div className="offer-buy">
                  <div><strong className="price">{money(o.price)}</strong><span className="muted"> total · {n} night{n === 1 ? '' : 's'}</span></div>
                  <button className="btn" onClick={() => select(room, o)}>Select</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
