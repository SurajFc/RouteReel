import { useRef } from 'react';
import { PlaceInput } from './PlaceInput';
import { VEHICLES, vehicleDataURL } from '../lib/vehicles';
import { MAP_STYLES, TEMPLATES, SAMPLE_ROUTES, SWATCHES, ASPECTS } from '../lib/presets';
import { formatDistance } from '../lib/geo';
import { FORMATS, estimateSize, formatBytes } from '../lib/exporter';

function exportPlan(s) {
  const gif = s.format === 'gif';
  const short = gif ? s.gifSize : s.resolution;
  const fps = gif ? s.gifFps : s.fps;
  const r = ASPECTS[s.aspect].ratio;
  const even = (n) => Math.round(n / 2) * 2;
  const width = r >= 1 ? even(short * r) : short;
  const height = r >= 1 ? short : even(short / r);
  const follow = s.camera.mode === 'follow';
  const seconds = (follow ? 4.5 : 2.1) + s.duration + (gif ? 1 : 0.5);
  return { width, height, fps, seconds, bytes: estimateSize(s.format, { width, height, fps, seconds }) };
}

function Section({ title, children, open = true }) {
  return (
    <details className="section" open={open}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

function Segmented({ value, options, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
          title={o.hint}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, format = (v) => v }) {
  return (
    <label className="slider">
      <span className="row-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="value">{format(value)}</span>
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

function ColorPick({ value, onChange, label }) {
  return (
    <div className="colors" role="group" aria-label={label}>
      {SWATCHES.map((c) => (
        <button
          key={c}
          className={`swatch ${value.toLowerCase() === c.toLowerCase() ? 'on' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
      <label className="swatch custom" title="Custom color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Custom color" />
      </label>
    </div>
  );
}

export function Sidebar({
  settings, set, applyTemplate,
  waypoints, setWaypoint, addStop, removeStop, reverse,
  followRoads, setFollowRoads, pickMode, setPickMode,
  buildRoute, loadSample, importFile, building, message, route,
  onExportVideo, onExportFrame, onDownloadGPX, onDownloadGeoJSON, onSaveProject, onOpenProject,
}) {
  const fileRef = useRef(null);
  const projectRef = useRef(null);
  const s = settings;
  const follow = s.camera.mode === 'follow';

  return (
    <aside className="sidebar">
      <Section title="Route">
        <div className="samples">
          {SAMPLE_ROUTES.map((r) => (
            <button key={r.id} className="chip" onClick={() => loadSample(r)}>{r.label}</button>
          ))}
        </div>

        <div className="waypoints">
          {waypoints.map((w, i) => {
            const last = i === waypoints.length - 1;
            return (
              <div className="wp-row" key={w.id}>
                <PlaceInput
                  value={w.label}
                  marker={i === 0 ? 'A' : last ? 'B' : i}
                  placeholder={i === 0 ? 'Start' : last ? 'Destination' : `Stop ${i}`}
                  onSelect={(r) => setWaypoint(i, r)}
                />
                {waypoints.length > 2 && (
                  <button className="icon-btn" onClick={() => removeStop(i)} aria-label={`Remove ${w.label || 'stop'}`}>×</button>
                )}
              </div>
            );
          })}
        </div>

        <div className="btn-row">
          <button className="btn ghost small" onClick={addStop}>Add stop</button>
          <button className="btn ghost small" onClick={reverse}>Reverse</button>
          <button className={`btn ghost small ${pickMode ? 'active' : ''}`} onClick={() => setPickMode(!pickMode)} aria-pressed={pickMode}>
            {pickMode ? 'Done picking' : 'Pick on map'}
          </button>
        </div>

        <Toggle label="Follow roads" checked={followRoads} onChange={setFollowRoads} />

        <div className="btn-row">
          <button className="btn primary grow" onClick={() => buildRoute()} disabled={building}>
            {building ? 'Building route…' : 'Build route'}
          </button>
          <button className="btn ghost" onClick={() => fileRef.current.click()}>Import file</button>
          <input ref={fileRef} type="file" hidden accept=".gpx,.kml,.geojson,.json" onChange={(e) => { importFile(e.target.files[0]); e.target.value = ''; }} />
        </div>

        {message && <p className={`msg ${message.kind}`}>{message.text}</p>}
        {route && !message && (
          <p className="msg info">{route.name}, {formatDistance(route.length, s.hud.units)}</p>
        )}
      </Section>

      <Section title="Templates">
        <div className="templates">
          {TEMPLATES.map((t) => (
            <button key={t.id} className={`template ${s.template === t.id ? 'on' : ''}`} onClick={() => applyTemplate(t)}>
              <span className="tpl-thumb" style={{ background: t.swatch[1] }}>
                <svg viewBox="0 0 60 34" aria-hidden="true">
                  <path d="M4 28 C16 26 18 10 30 14 S46 6 56 5" fill="none" stroke={t.swatch[0]} strokeWidth="3.5" strokeLinecap="round" />
                </svg>
              </span>
              <span className="tpl-name">{t.label}</span>
              <span className="tpl-note">{t.note}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Map">
        <Segmented
          label="Map style"
          value={s.mapStyle}
          onChange={(v) => set('mapStyle', v)}
          options={Object.entries(MAP_STYLES).map(([value, m]) => ({ value, label: m.label }))}
        />
      </Section>

      <Section title="Vehicle">
        <div className="vehicles">
          {VEHICLES.map((v) => (
            <button key={v.id} className={`vehicle ${s.vehicle.type === v.id ? 'on' : ''}`} onClick={() => set('vehicle.type', v.id)}>
              <img src={vehicleDataURL(v.id, s.vehicle.color, 40)} alt="" width="40" height="40" />
              <span>{v.label}</span>
            </button>
          ))}
        </div>
        <ColorPick label="Vehicle color" value={s.vehicle.color} onChange={(c) => set('vehicle.color', c)} />
        <Slider label="Size" value={s.vehicle.size} min={0.5} max={2} step={0.1} onChange={(v) => set('vehicle.size', v)} format={(v) => `${v.toFixed(1)}×`} />
      </Section>

      <Section title="Trail">
        <ColorPick label="Trail color" value={s.line.color} onChange={(c) => set('line.color', c)} />
        <Slider label="Width" value={s.line.width} min={2} max={14} step={1} onChange={(v) => set('line.width', v)} format={(v) => `${v}px`} />
        <Toggle label="Glow" checked={s.line.glow} onChange={(v) => set('line.glow', v)} />
        <Toggle label="Show the road ahead" checked={s.line.showRemaining} onChange={(v) => set('line.showRemaining', v)} />
      </Section>

      <Section title="Camera">
        <Segmented
          label="Camera mode"
          value={s.camera.mode}
          onChange={(v) => set('camera.mode', v)}
          options={[{ value: 'follow', label: 'Follow' }, { value: 'overview', label: 'Whole route' }]}
        />
        {follow && (
          <>
            <Slider label="Zoom" value={s.camera.zoom} min={11} max={18.5} step={0.5} onChange={(v) => set('camera.zoom', v)} />
            <Slider label="Tilt" value={s.camera.pitch} min={0} max={75} step={5} onChange={(v) => set('camera.pitch', v)} format={(v) => `${v}°`} />
            <Toggle label="Turn with the road" checked={s.camera.rotate} onChange={(v) => set('camera.rotate', v)} />
          </>
        )}
        <Slider label="Drive time" value={s.duration} min={5} max={120} step={1} onChange={(v) => set('duration', v)} format={(v) => `${v}s`} />
        <Toggle label="Ease in and out" checked={s.easing} onChange={(v) => set('easing', v)} />
      </Section>

      <Section title="Overlay">
        <Toggle label="Show overlay" checked={s.hud.show} onChange={(v) => set('hud.show', v)} />
        <label className="field">
          <span className="row-label">Title</span>
          <input value={s.hud.title} onChange={(e) => set('hud.title', e.target.value)} placeholder="Day 3: Into the hills" />
        </label>
        <Toggle label="Distance counter" checked={s.hud.stats} onChange={(v) => set('hud.stats', v)} />
        <Segmented label="Units" value={s.hud.units} onChange={(v) => set('hud.units', v)} options={[{ value: 'km', label: 'Kilometres' }, { value: 'mi', label: 'Miles' }]} />
      </Section>

      <Section title="Export">
        <Segmented
          label="Format"
          value={s.format}
          onChange={(v) => set('format', v)}
          options={Object.entries(FORMATS).map(([value, f]) => ({ value, label: f.label }))}
        />
        <p className="hint">{FORMATS[s.format].hint}</p>

        <Segmented
          label="Frame"
          value={s.aspect}
          onChange={(v) => set('aspect', v)}
          options={Object.entries(ASPECTS).map(([value, a]) => ({ value, label: a.label, hint: a.hint }))}
        />
        <p className="hint">{ASPECTS[s.aspect].hint}</p>

        {s.format === 'gif' ? (
          <>
            <Segmented
              label="GIF size"
              value={s.gifSize}
              onChange={(v) => set('gifSize', v)}
              options={[360, 480, 640].map((r) => ({ value: r, label: `${r}p` }))}
            />
            <Segmented
              label="GIF frame rate"
              value={s.gifFps}
              onChange={(v) => set('gifFps', v)}
              options={[10, 15, 20].map((f) => ({ value: f, label: `${f} fps` }))}
            />
          </>
        ) : (
          <>
            <Segmented
              label="Resolution"
              value={s.resolution}
              onChange={(v) => set('resolution', v)}
              options={[720, 1080, 1440, 2160].map((r) => ({ value: r, label: r === 2160 ? '4K' : `${r}p` }))}
            />
            <Segmented label="Frame rate" value={s.fps} onChange={(v) => set('fps', v)} options={[{ value: 30, label: '30 fps' }, { value: 60, label: '60 fps' }]} />
          </>
        )}

        {(() => {
          const plan = exportPlan(s);
          const heavy = s.format === 'gif' && plan.bytes > 25e6;
          return (
            <>
              <p className="plan">
                {plan.width}×{plan.height}, {Math.round(plan.seconds)}s, about {formatBytes(plan.bytes)}
              </p>
              {heavy && (
                <p className="msg warn">That GIF will be heavy. Shorten the drive time or pick a smaller size.</p>
              )}
            </>
          );
        })()}

        <button className="btn primary wide" onClick={onExportVideo} disabled={!route}>
          Export {FORMATS[s.format].label}
        </button>

        <div className="btn-row wrap">
          <button className="btn ghost small" onClick={onExportFrame} disabled={!route}>Save frame (PNG)</button>
          <button className="btn ghost small" onClick={onDownloadGPX} disabled={!route}>GPX</button>
          <button className="btn ghost small" onClick={onDownloadGeoJSON} disabled={!route}>GeoJSON</button>
        </div>
        <div className="btn-row wrap">
          <button className="btn ghost small" onClick={onSaveProject} disabled={!route}>Save project</button>
          <button className="btn ghost small" onClick={() => projectRef.current.click()}>Open project</button>
          <input ref={projectRef} type="file" hidden accept=".json,.routereel" onChange={(e) => { onOpenProject(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </Section>
    </aside>
  );
}
