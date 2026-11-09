import { Link } from 'react-router-dom';
import { fmtDateTime, money, nights } from '../utils.js';

export default function HotelCard({ hotel, search, query }) {
  const n = nights(search.checkin, search.checkout);
  return (
    <Link to={`/hotel/${hotel.id}?${query}`} className="card hotel-card">
      <div className="thumb">{hotel.image ? <img src={hotel.image} alt={hotel.name} loading="lazy" /> : <div className="noimg">No photo</div>}</div>
      <div className="hc-body">
        <div>
          <h3>{hotel.name}</h3>
          <p className="muted">{[hotel.address, hotel.city].filter(Boolean).join(', ')}</p>
          <div className="badges">
            {hotel.stars ? <span className="badge">{'★'.repeat(Math.round(hotel.stars))}</span> : null}
            {hotel.rating ? <span className="badge score">{Number(hotel.rating).toFixed(1)}</span> : null}
            {hotel.refundable
              ? <span className="badge good">Free cancellation{hotel.freeCancelUntil ? ` until ${fmtDateTime(hotel.freeCancelUntil)}` : ''}</span>
              : <span className="badge">Non-refundable</span>}
          </div>
        </div>
        <div className="hc-price">
          <span className="muted">from</span>
          <strong>{money(hotel.price)}</strong>
          <span className="muted">{n} night{n === 1 ? '' : 's'} · {hotel.boardName || 'Room only'}</span>
        </div>
      </div>
    </Link>
  );
}
