import { useState } from 'react';

const STEPS = [
  {
    title: 'Welcome to RouteReel',
    body: 'Turn any trip into a cinematic route animation. Build your route and style it in the sidebar on the left, watch it play on the right, and export a video in a couple of minutes.',
  },
  {
    title: 'Build your route',
    items: [
      'Search a place in the Start/Destination fields, or tap "Pick on map" and click the map to drop points.',
      'Tap the target icon in a field to use your current location.',
      '"Add stop" adds a waypoint, "Reverse" flips the direction.',
      'Toggle "Follow roads" for real streets, or off for a straight line. When more than one road option comes back, pick between them below the fields.',
    ],
  },
  {
    title: 'Style your reel',
    items: [
      'Templates — one click for a whole look: camera, vehicle, trail, and map style.',
      'Map — switch between 3D streets, bright, light, dark, and satellite.',
      'Vehicle — pick your ride, its color, and its size.',
      'Trail — trail color, width, glow, and "Focus route" to dim the map so your path stands out.',
    ],
  },
  {
    title: 'Camera & overlay',
    items: [
      'Camera — a chase cam that follows the road, or a fixed whole-route view, with zoom, tilt, and rotation.',
      'Drive time sizes itself to your route automatically — drag the slider to override it.',
      'Overlay — add a title card and a live distance counter to the video.',
    ],
  },
  {
    title: 'Export your reel',
    items: [
      'Pick a format (MP4, WebM, or GIF) and a frame size, then hit Export.',
      'Grab a still frame (PNG), or the route as GPX or GeoJSON.',
      'Save the whole project to reopen and keep editing later.',
    ],
  },
  {
    title: 'Always here when you need it',
    items: [
      'The sun/moon icon in the top bar switches between light and dark.',
      'The "i" button opens About RouteReel — credits, version, and license.',
      'The "?" button reopens this tutorial anytime.',
    ],
  },
];

export function Tutorial({ onClose }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="tutorial-veil" role="dialog" aria-modal="true" aria-label="Welcome to RouteReel">
      <div className="tutorial-card">
        <button className="icon-btn tutorial-close" onClick={onClose} aria-label="Close tutorial">×</button>
        <h2>{step.title}</h2>
        {step.body && <p>{step.body}</p>}
        {step.items && (
          <ul className="tutorial-list">
            {step.items.map((item, d) => (
              <li key={d}>{item}</li>
            ))}
          </ul>
        )}
        <div className="tutorial-dots" aria-hidden="true">
          {STEPS.map((_, d) => (
            <span key={d} className={`dot ${d === i ? 'on' : ''}`} />
          ))}
        </div>
        <div className="btn-row">
          <button className="btn ghost" onClick={onClose}>Skip</button>
          {i > 0 && (
            <button className="btn ghost" onClick={() => setI(i - 1)}>Back</button>
          )}
          <button className="btn primary grow" onClick={() => (last ? onClose() : setI(i + 1))}>
            {last ? 'Start creating' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
