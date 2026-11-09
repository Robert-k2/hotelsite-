import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { NATIONALITIES, addDays, defaultSearch, nextDay, nights, writeSearch } from '../utils.js';

export default function SearchBar({ initial }) {
  const nav = useNavigate();
  const [s, setS] = useState(initial || defaultSearch());
  const [text, setText] = useState(initial?.place || '');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const box = useRef(null);
  const set = (patch) => setS((p) => ({ ...p, ...patch }));

  // Debounced destination autocomplete.
  useEffect(() => {
    if (text.length < 2 || text === s.place) { setOptions([]); return; }
    const t = setTimeout(async () => {
      try { setOptions((await api.places(text)).places); setOpen(true); } catch { setOptions([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const setChildren = (n) => set({ children: Array.from({ length: n }, (_, i) => s.children[i] ?? 8) });

  const submit = (e) => {
    e.preventDefault();
    if (!s.placeId) return setError('Choose a destination from the list.');
    if (nights(s.checkin, s.checkout) < 1) return setError('Check-out must be after check-in.');
    setError('');
    nav('/search?' + writeSearch(s));
  };

  return (
    <form className="searchbar" onSubmit={submit}>
      <div className="field dest" ref={box}>
        <label>Destination</label>
        <input value={text} placeholder="City, region or landmark" autoComplete="off"
          onChange={(e) => { setText(e.target.value); set({ placeId: '', place: '' }); }} onFocus={() => options.length && setOpen(true)} />
        {open && options.length > 0 && (
          <ul className="suggest">
            {options.map((o) => (
              <li key={o.placeId}><button type="button" onClick={() => { set({ placeId: o.placeId, place: o.name }); setText(o.name); setOpen(false); }}>
                <strong>{o.name}</strong><span>{o.address}</span></button></li>
            ))}
          </ul>
        )}
      </div>
      <div className="field"><label>Check-in</label>
        <input type="date" min={addDays(0)} value={s.checkin} onChange={(e) => set({ checkin: e.target.value, checkout: s.checkout <= e.target.value ? nextDay(e.target.value) : s.checkout })} /></div>
      <div className="field"><label>Check-out</label>
        <input type="date" min={s.checkin} value={s.checkout} onChange={(e) => set({ checkout: e.target.value })} /></div>
      <div className="field small"><label>Adults</label>
        <select value={s.adults} onChange={(e) => set({ adults: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></div>
      <div className="field small"><label>Children</label>
        <select value={s.children.length} onChange={(e) => setChildren(Number(e.target.value))}>{[0, 1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></div>
      <button className="btn btn-gold" type="submit">Search</button>

      {s.children.length > 0 && (
        <div className="row-extra">
          {s.children.map((age, i) => (
            <label key={i}>Child {i + 1} age
              <select value={age} onChange={(e) => set({ children: s.children.map((a, j) => (j === i ? Number(e.target.value) : a)) })}>
                {Array.from({ length: 18 }, (_, a) => <option key={a} value={a}>{a}</option>)}
              </select></label>
          ))}
        </div>
      )}
      <div className="row-extra">
        <label>Traveller from
          <select value={s.nationality} onChange={(e) => set({ nationality: e.target.value })}>{NATIONALITIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
        <label>Currency
          <select value={s.currency} onChange={(e) => set({ currency: e.target.value })}>{['USD', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      {error && <p className="error full">{error}</p>}
    </form>
  );
}
