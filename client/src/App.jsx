import { Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Results from './pages/Results.jsx';
import Hotel from './pages/Hotel.jsx';
import Checkout from './pages/Checkout.jsx';
import Confirmation from './pages/Confirmation.jsx';
import { BRAND } from './utils.js';

export default function App() {
  return (
    <>
      <header className="topbar">
        <div className="container topbar-in">
          <Link to="/" className="brand"><span className="brand-mark">◆</span> {BRAND}</Link>
          <span className="topbar-note">Worldwide hotels · Secure checkout</span>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Results />} />
          <Route path="/hotel/:id" element={<Hotel />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/booking/confirm" element={<Confirmation />} />
          <Route path="*" element={<div className="container section"><h1>Page not found</h1><Link to="/" className="btn">Back to search</Link></div>} />
        </Routes>
      </main>
      <footer className="footer"><div className="container">© {new Date().getFullYear()} {BRAND}. Prices include the supplier’s taxes and fees where shown.</div></footer>
    </>
  );
}
