import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import SearchBar from '../components/SearchBar.jsx';
import HotelCard from '../components/HotelCard.jsx';
import { fmtDate, nights, readSearch, stayQuery } from '../utils.js';

export default function Results() {
  const [sp] = useSearchParams();
  const search = useMemo(() => readSearch(sp), [sp]);
  const [state, setState] = useState({ loading: true, error: '', hotels: [] });
  const [sort, setSort] = useState('price');
  const [freeOnly, setFreeOnly] = useState(false);

  useEffect(() => {
    if (!search.placeId) { setState({ loading: false, error: 'Please choose a destination.', hotels: [] }); return; }
    let live = true;
    setState({ loading: true, error: '', hotels: [] });
    api.search(search)
      .then((r) => live && setState({ loading: false, error: '', hotels: r.hotels }))
      .catch((e) => live && setState({ loading: false, error: e.message, hotels: [] }));
    return () => { live = false; };
  }, [search]);

  const list = useMemo(() => {
    let l = freeOnly ? state.hotels.filter((h) => h.refundable) : [...state.hotels];
    if (sort === 'rating') l.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else if (sort === 'price-desc') l.sort((a, b) => b.price.amount - a.price.amount);
    else l.sort((a, b) => a.price.amount - b.price.amount);
    return l;
  }, [state.hotels, sort, freeOnly]);

  const n = nights(search.checkin, search.checkout);
  return (
    <div className="container section">
      <div className="compact-search"><SearchBar initial={search} key={sp.toString()} /></div>
      <div className="results-head">
        <div>
          <h2>{search.place || 'Results'}</h2>
          <p className="muted">{fmtDate(search.checkin)} → {fmtDate(search.checkout)} · {n} night{n === 1 ? '' : 's'} · {search.adults + search.children.length} guest{search.adults + search.children.length === 1 ? '' : 's'}</p>
        </div>
        <div className="controls">
          <label className="check"><input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} /> Free cancellation only</label>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="price">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="rating">Guest rating</option>
          </select>
        </div>
      </div>

      {state.loading && <div className="skeletons">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}<p className="muted center">Checking live rates…</p></div>}
      {state.error && <div className="alert error">{state.error}</div>}
      {!state.loading && !state.error && list.length === 0 && (
        <div className="empty"><h3>No hotels available</h3><p className="muted">Try different dates, fewer filters, or a nearby destination.</p><Link className="btn" to="/">New search</Link></div>
      )}
      <div className="list">{list.map((h) => <HotelCard key={h.id} hotel={h} search={search} query={stayQuery(search)} />)}</div>
    </div>
  );
}
