import { useState } from 'react';

const STEPS = [
  {
    title: 'Welcome to RouteReel',
    body: 'Turn any trip into a cinematic route animation. Pick two points, style it, and export a video in a couple of minutes.',
  },
  {
    title: 'Add a start and destination',
    body: 'Search for a place, click "Pick on map" and tap the map, or use the location icon in the field to start from where you are right now.',
  },
  {
    title: 'Make it yours',
    body: 'Choose a vehicle, a trail color and glow, a camera angle, and a look from the Templates panel — everything updates live.',
  },
  {
    title: 'Export your reel',
    body: 'Pick a format and size in the Export panel, then hit Export. Your video downloads straight to your device.',
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
        <p>{step.body}</p>
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
