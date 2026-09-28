import pkg from '../../package.json';

const CREDITS = [
  { name: 'OpenStreetMap contributors', note: 'map data' },
  { name: 'OpenFreeMap', note: 'streets, bright, and light map styles' },
  { name: 'CARTO', note: 'dark map style' },
  { name: 'Esri, Maxar, Earthstar Geographics', note: 'satellite imagery' },
  { name: 'Photon (by Komoot)', note: 'place search and location lookup' },
  { name: 'Project OSRM', note: 'road routing' },
];

export function About({ onClose }) {
  return (
    <div className="tutorial-veil" role="dialog" aria-modal="true" aria-label="About RouteReel">
      <div className="tutorial-card about-card">
        <button className="icon-btn tutorial-close" onClick={onClose} aria-label="Close about">×</button>
        <h2>About RouteReel</h2>
        <p>
          Animate a route on a map and export it as a video, the way travel and moto vlogs do it — the
          camera swoops in, chases your ride along the road in 3D, then pulls back to show the whole trip.
        </p>
        <p>
          Runs entirely in your browser. No account, no backend, no tracking — your project is saved only
          in this browser's local storage, and your location is only looked up when you tap the locate button.
        </p>

        <h3>Map &amp; routing data</h3>
        <ul className="credits">
          {CREDITS.map((c) => (
            <li key={c.name}>
              <strong>{c.name}</strong> — {c.note}
            </li>
          ))}
        </ul>

        <p className="about-meta">RouteReel v{pkg.version} · MIT licensed</p>
        <div className="btn-row">
          <button className="btn primary grow" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
