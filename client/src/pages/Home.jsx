import SearchBar from '../components/SearchBar.jsx';

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <p className="eyebrow">Hotels worldwide</p>
          <h1>Find the stay that fits the trip.</h1>
          <p className="lead">Compare real-time rates, check cancellation terms up front, and book in minutes.</p>
          <SearchBar />
        </div>
      </section>
      <section className="container section features">
        <div><h3>Clear cancellation terms</h3><p>Every offer shows whether it is refundable and until when, before you pay.</p></div>
        <div><h3>Live prices</h3><p>Rates are checked again the moment you select a room, so the price you pay is the price you saw.</p></div>
        <div><h3>Secure payment</h3><p>Card details go straight to the payment provider. We never see or store them.</p></div>
      </section>
    </>
  );
}
