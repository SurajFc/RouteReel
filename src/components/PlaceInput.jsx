import { useEffect, useRef, useState } from 'react';
import { geocode, locateMe, reverseGeocode } from '../lib/routing';

// Lets people paste coordinates straight from Google Maps etc ("27.657276,
// 85.504433") instead of only searching by place name.
const COORD_RE = /^(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/;
function parseCoordText(text) {
  const m = text.trim().match(COORD_RE);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lng, lat];
}

export function PlaceInput({ value, placeholder, onSelect, marker, locate = false }) {
  const [text, setText] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);
  const abortRef = useRef(null);
  const typedRef = useRef(false);

  useEffect(() => setText(value || ''), [value]);

  useEffect(() => {
    if (!typedRef.current || text.trim().length < 3) {
      setResults([]);
      return;
    }
    const coord = parseCoordText(text);
    if (coord) {
      setResults([{ label: text.trim(), coord, isCoord: true }]);
      setActive(0);
      setOpen(true);
      return;
    }
    const id = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await geocode(text, ctrl.signal);
        setResults(r);
        setActive(0);
        setOpen(true);
      } catch {
        /* aborted or offline */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [text]);

  const choose = async (r) => {
    typedRef.current = false;
    setOpen(false);
    if (r.isCoord) {
      setText(r.label); // show the typed coordinates immediately while a name is looked up
      const name = await reverseGeocode(r.coord).catch(() => null);
      const resolved = name ? { label: name, coord: r.coord } : r;
      setText(resolved.label);
      onSelect(resolved);
      return;
    }
    setText(r.label);
    onSelect(r);
  };

  const useMyLocation = async () => {
    setLocateError(null);
    setLocating(true);
    try {
      const coord = await locateMe();
      const name = await reverseGeocode(coord).catch(() => null);
      choose({ label: name || `${coord[1].toFixed(4)}, ${coord[0].toFixed(4)}`, coord });
    } catch (err) {
      setLocateError(err.message);
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="place">
      <span className="place-marker" aria-hidden="true">{marker}</span>
      <input
        value={text}
        placeholder={placeholder}
        className={locate ? 'has-locate' : ''}
        onChange={(e) => {
          typedRef.current = true;
          setText(e.target.value);
        }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !results.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-autocomplete="list"
      />
      {locate && (
        <button
          type="button"
          className={`place-locate ${locating ? 'busy' : ''}`}
          onClick={useMyLocation}
          disabled={locating}
          aria-label="Use my location"
          title="Use my location"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {locateError && <p className="place-error">{locateError}</p>}
      {open && results.length > 0 && (
        <ul className="suggest" role="listbox">
          {results.map((r, i) => (
            <li
              key={`${r.label}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={() => choose(r)}
            >
              {r.isCoord ? (
                <>
                  <span className="suggest-hint">Use coordinates</span>
                  {r.label}
                </>
              ) : (
                r.label
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
