import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const STEPS = [
  {
    title: 'Welcome to RouteReel',
    body: 'Turn any trip into a cinematic route animation. Build your route and style it in the sidebar on the left, watch it play on the right, and export a video in a couple of minutes.',
  },
  {
    title: 'Build your route',
    target: '[data-tour="route"]',
    items: [
      'Search a place in the Start/Destination fields, or tap "Pick on map" and click the map to drop points.',
      'Tap the target icon in a field to use your current location.',
      '"Add stop" adds a waypoint, "Reverse" flips the direction.',
      'Toggle "Follow roads" for real streets, or off for a straight line. When more than one road option comes back, pick between them below the fields.',
    ],
  },
  {
    title: 'Start from a template',
    target: '[data-tour="templates"]',
    body: 'One click sets the camera, vehicle, trail, and map style together. Your route and title always stay put.',
  },
  {
    title: 'Map style',
    target: '[data-tour="map"]',
    body: 'Switch between 3D streets, bright, light, dark, and satellite.',
  },
  {
    title: 'Vehicle',
    target: '[data-tour="vehicle"]',
    body: 'Pick your ride, its color, and its size. It turns to face the road as it drives.',
  },
  {
    title: 'Trail',
    target: '[data-tour="trail"]',
    body: 'Set the trail color, width, and glow. "Focus route" dims the map so your path stands out.',
  },
  {
    title: 'Camera',
    target: '[data-tour="camera"]',
    body: 'Chase the road, or pull back for a fixed whole-route view, with zoom, tilt, and rotation. Drive time sizes itself to your route automatically — drag it to override.',
  },
  {
    title: 'Overlay',
    target: '[data-tour="overlay"]',
    body: 'Add a title card and a live distance counter to the video.',
  },
  {
    title: 'Export your reel',
    target: '[data-tour="export"]',
    items: [
      'Pick a format (MP4, WebM, or GIF) and a frame size, then hit Export.',
      'Grab a still frame (PNG), or the route as GPX or GeoJSON.',
      'Save the whole project to reopen and keep editing later.',
    ],
  },
  {
    title: 'Always here when you need it',
    target: '[data-tour="topbar"]',
    items: [
      'The sun/moon icon switches between light and dark.',
      'The "i" button opens About RouteReel — credits, version, and license.',
      'The "?" button reopens this tutorial anytime.',
    ],
  },
];

const isDesktopQuery = () => window.matchMedia('(min-width: 861px)').matches;

export function Tutorial({ onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [isDesktop, setIsDesktop] = useState(isDesktopQuery);
  const cardRef = useRef(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const pointing = isDesktop && !!step.target && !!rect;

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 861px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Scroll the target into view once per step, then track its position every
  // frame so the highlight stays glued to it through the scroll animation
  // and any manual scrolling the person does while reading.
  useLayoutEffect(() => {
    if (!isDesktop || !step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    let raf;
    const track = () => {
      setRect(el.getBoundingClientRect());
      raf = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(raf);
  }, [i, isDesktop, step.target]);

  let cardStyle = null;
  let pointerClass = '';
  if (pointing) {
    const gap = 14;
    const width = Math.min(340, window.innerWidth - 32);
    const spaceRight = window.innerWidth - rect.right - gap;
    const cardHeight = cardRef.current?.offsetHeight || 220;
    if (spaceRight >= width) {
      pointerClass = 'pointer-left';
      const top = Math.min(
        Math.max(rect.top + rect.height / 2 - cardHeight / 2, 58),
        window.innerHeight - cardHeight - 12
      );
      cardStyle = { top, left: rect.right + gap, width };
    } else {
      pointerClass = 'pointer-up';
      const left = Math.min(Math.max(rect.right - width, 12), window.innerWidth - width - 12);
      cardStyle = { top: Math.min(rect.bottom + gap, window.innerHeight - cardHeight - 12), left, width };
    }
  }

  const card = (
    <div
      ref={cardRef}
      className={`tutorial-card ${pointing ? `positioned ${pointerClass}` : ''}`}
      style={cardStyle || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
    >
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
  );

  if (!pointing) {
    return (
      <div className="tutorial-veil" role="presentation">
        {card}
      </div>
    );
  }

  return (
    <>
      <div className="tour-backdrop" onClick={onClose} />
      <div
        className="tour-highlight"
        style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
      />
      {card}
    </>
  );
}
