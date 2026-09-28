import { useEffect, useRef, useState } from 'react';
import { geocode } from '../lib/routing';

export function PlaceInput({ value, placeholder, onSelect, marker }) {
  const [text, setText] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const abortRef = useRef(null);
  const typedRef = useRef(false);

  useEffect(() => setText(value || ''), [value]);

  useEffect(() => {
    if (!typedRef.current || text.trim().length < 3) {
      setResults([]);
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

  const choose = (r) => {
    typedRef.current = false;
    setText(r.label);
    setOpen(false);
    onSelect(r);
  };

  return (
    <div className="place">
      <span className="place-marker" aria-hidden="true">{marker}</span>
      <input
        value={text}
        placeholder={placeholder}
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
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
