import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RouteAnimator } from '../lib/animator';
import { MAP_STYLES, ASPECTS } from '../lib/presets';
import { drawHud, startRecording } from '../lib/recorder';
import { FORMATS, encodeGif, encodeVideo, videoCodecFor, audioCodecFor, waitForMap } from '../lib/exporter';
import { decodeAudioFile, decodeAudioUrl, fitAudioToDuration } from '../lib/audio';
import { formatTime } from '../lib/geo';
import { downloadBlob, slug } from '../lib/importers';

const styleOf = (key) => (MAP_STYLES[key] || MAP_STYLES.streets).style;

export const Stage = forwardRef(function Stage({ settings, coords, waypoints, pickMode, onPick, fileName, notify, musicFile }, ref) {
  const bodyRef = useRef(null);
  const mapEl = useRef(null);
  const overlayRef = useRef(null);
  const mapRef = useRef(null);
  const animRef = useRef(null);
  const frameRef = useRef(null);
  const settingsRef = useRef(settings);
  const styleKeyRef = useRef(settings.mapStyle);
  const markersRef = useRef([]);
  const cancelRef = useRef(false);
  const pickRef = useRef({ pickMode, onPick });
  const lastUiRef = useRef(0);

  const [ui, setUi] = useState({ t: 0, total: 0, playing: false });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [exporting, setExporting] = useState(null); // { progress, label }

  settingsRef.current = settings;
  pickRef.current = { pickMode, onPick };

  const drawOverlay = useCallback(() => {
    const map = mapRef.current;
    const cv = overlayRef.current;
    if (!map || !cv) return;
    const mc = map.getCanvas();
    if (cv.width !== mc.width || cv.height !== mc.height) {
      cv.width = mc.width;
      cv.height = mc.height;
    }
    const s = settingsRef.current;
    drawHud(cv.getContext('2d'), frameRef.current, s, (MAP_STYLES[s.mapStyle] || MAP_STYLES.streets).attribution);
  }, []);

  // ---------- init ----------
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: styleOf(settingsRef.current.mapStyle),
      center: [85.324, 27.7172],
      zoom: 11,
      maxPitch: 80,
      attributionControl: false, // attribution is drawn into the overlay so it's in exports too
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    const anim = new RouteAnimator(map, {
      onFrame: (f) => {
        frameRef.current = f;
        drawOverlay();
        const now = performance.now();
        if (!f.playing || now - lastUiRef.current > 90) {
          lastUiRef.current = now;
          setUi({ t: f.t, total: f.total, playing: f.playing });
        }
      },
    });
    anim.settings = settingsRef.current;
    anim.onEnd = () => setUi((u) => ({ ...u, playing: false }));
    map.on('style.load', () => anim.onStyleLoad());
    map.on('click', (e) => {
      const { pickMode: pm, onPick: op } = pickRef.current;
      if (pm) op([e.lngLat.lng, e.lngLat.lat]);
    });

    mapRef.current = map;
    animRef.current = anim;
    document.fonts?.ready.then(drawOverlay);

    return () => {
      anim.destroy();
      map.remove();
    };
  }, [drawOverlay]);

  // ---------- fit the frame to the chosen aspect ratio ----------
  useEffect(() => {
    const el = bodyRef.current;
    const fit = () => {
      const ratio = ASPECTS[settingsRef.current.aspect]?.ratio || 16 / 9;
      const bw = el.clientWidth, bh = el.clientHeight;
      let w = bw, h = bw / ratio;
      if (h > bh) { h = bh; w = bh * ratio; }
      setSize({ w: Math.floor(w), h: Math.floor(h) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [settings.aspect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !size.w) return;
    map.resize();
    animRef.current.invalidateOverview();
    animRef.current.render();
    drawOverlay();
  }, [size, drawOverlay]);

  // ---------- settings ----------
  useEffect(() => {
    const map = mapRef.current, anim = animRef.current;
    if (!map) return;
    try {
      if (styleKeyRef.current !== settings.mapStyle) {
        styleKeyRef.current = settings.mapStyle;
        anim.settings = settings;
        map.setStyle(styleOf(settings.mapStyle), { diff: false });
      } else {
        anim.setSettings(settings).catch((err) => console.warn('Stage: settings update skipped', err));
      }
      drawOverlay();
    } catch (err) {
      // A style swap can land mid-transition if it fires while the map is
      // already mid-transition (e.g. rapid clicks during playback).
      console.warn('Stage: settings update skipped', err);
    }
  }, [settings, drawOverlay]);

  // ---------- route ----------
  useEffect(() => {
    try {
      animRef.current?.setTrack(coords);
      drawOverlay();
    } catch (err) {
      console.warn('Stage: route update skipped', err);
    }
  }, [coords, drawOverlay]);

  // ---------- waypoint pins (editor only, never exported) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    const pts = waypoints.filter((w) => w.coord);
    markersRef.current = pts.map((w, i) => {
      const el = document.createElement('div');
      el.className = 'wp-pin';
      el.textContent = i === 0 ? 'A' : i === pts.length - 1 ? 'B' : String(i);
      return new maplibregl.Marker({ element: el }).setLngLat(w.coord).addTo(map);
    });
  }, [waypoints]);

  // ---------- transport ----------
  const toggle = useCallback(() => {
    const a = animRef.current;
    if (!a?.track || exporting) return;
    a.playing ? a.pause() : a.play();
    setUi((u) => ({ ...u, playing: a.playing }));
  }, [exporting]);

  const restart = () => {
    const a = animRef.current;
    a.seek(0);
    if (!a.playing) a.play();
    setUi((u) => ({ ...u, playing: true }));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.target.closest('input, textarea, select, button')) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // ---------- export ----------
  // Temporarily render the map at the export resolution (short side = `resolution` px)
  const withExportSize = async (resolution, fn) => {
    const map = mapRef.current, anim = animRef.current;
    anim.pause();
    const prevRatio = map.getPixelRatio();
    const css = map.getCanvas().getBoundingClientRect();
    const ratio = resolution / Math.min(css.width, css.height);
    map.setPixelRatio(ratio);
    anim.invalidateOverview();
    const mc = map.getCanvas();
    const W = mc.width & ~1, H = mc.height & ~1; // H.264 needs even sizes
    const comp = document.createElement('canvas');
    comp.width = W;
    comp.height = H;
    const ctx = comp.getContext('2d');
    const compose = () => {
      drawOverlay();
      ctx.drawImage(map.getCanvas(), 0, 0, W, H);
      ctx.drawImage(overlayRef.current, 0, 0, W, H);
      return comp;
    };
    try {
      return await fn({ map, anim, W, H, comp, compose });
    } finally {
      map.setPixelRatio(prevRatio);
      anim.invalidateOverview();
      anim.render();
      drawOverlay();
    }
  };

  const exportVideo = async () => {
    if (!animRef.current?.track || exporting) return;
    cancelRef.current = false;
    const s = settingsRef.current;
    const format = FORMATS[s.format] ? s.format : 'mp4';
    const gif = format === 'gif';
    const resolution = gif ? s.gifSize : s.resolution;
    const fps = gif ? s.gifFps : s.fps;
    const verb = gif ? 'Rendering GIF' : `Rendering ${FORMATS[format].label}`;
    setExporting({ progress: 0, label: 'Preparing' });

    let audioBuffer = null;
    if (!gif && s.music.source !== 'none') {
      try {
        setExporting({ progress: 0, label: 'Preparing audio' });
        const raw =
          s.music.source === 'custom' && musicFile
            ? await decodeAudioFile(musicFile)
            : s.music.source === 'library' && s.music.trackUrl
            ? await decodeAudioUrl(s.music.trackUrl)
            : null;
        if (raw) {
          audioBuffer = await fitAudioToDuration(raw, animRef.current.totalTime, {
            loop: s.music.loop,
            fadeOut: s.music.fadeOut,
            volume: s.music.volume / 100,
          });
        }
      } catch (err) {
        console.warn('Music skipped:', err);
      }
    }

    try {
      const blob = await withExportSize(resolution, async ({ map, anim, W, H, comp, compose }) => {
        const loop = {
          fps,
          totalTime: anim.totalTime,
          renderFrame: async (t) => {
            anim.seek(t);
            await waitForMap(map);
            return compose();
          },
          onProgress: (p) => setExporting({ progress: p, label: verb }),
          isCancelled: () => cancelRef.current,
        };

        if (gif) return encodeGif({ width: W, height: H, ...loop });

        const codec = await videoCodecFor(format, W, H, fps);
        const audioCodec = audioBuffer ? await audioCodecFor(format) : null;
        if (codec) {
          return encodeVideo({
            format, codec, width: W, height: H,
            audioBuffer: audioCodec ? audioBuffer : null,
            audioCodec,
            ...loop,
          });
        }

        // Fallback for browsers without WebCodecs: record in real time
        anim.seek(0);
        await waitForMap(map);
        const rec = startRecording(comp, { fps, prefer: format });
        await new Promise((resolve) => {
          const step = () => {
            compose();
            setExporting({ progress: anim.t / anim.totalTime, label: 'Recording in real time' });
            if (cancelRef.current) { anim.pause(); return resolve(); }
            if (anim.playing) requestAnimationFrame(step);
            else setTimeout(resolve, 500);
          };
          anim.onEnd = null;
          anim.play();
          requestAnimationFrame(step);
        });
        anim.onEnd = () => setUi((u) => ({ ...u, playing: false }));
        if (cancelRef.current) { rec.cancel(); return null; }
        const out = await rec.stop();
        out.ext = rec.ext;
        return out;
      });

      if (blob) {
        const name = `${slug(fileName)}-${s.aspect.replace(':', 'x')}-${resolution}p`;
        const outName = `${name}.${blob.ext || FORMATS[format].ext}`;
        downloadBlob(blob, outName);
        notify?.(`Exported ${outName}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(null);
      setUi((u) => ({ ...u, playing: false }));
    }
  };

  const exportFrame = async () => {
    const s = settingsRef.current;
    const t = animRef.current.t;
    const blob = await withExportSize(s.resolution, async ({ map, anim, compose }) => {
      anim.seek(t);
      await waitForMap(map);
      const c = compose();
      return new Promise((r) => c.toBlob(r, 'image/png'));
    });
    const outName = `${slug(fileName)}-frame-${s.resolution}p.png`;
    downloadBlob(blob, outName);
    notify?.(`Saved ${outName}`);
  };

  useImperativeHandle(ref, () => ({ exportVideo, exportFrame }));

  const hasRoute = coords && coords.length > 1;

  return (
    <section className={`stage ${ui.playing || exporting ? 'is-playing' : ''} ${pickMode ? 'is-picking' : ''}`}>
      <div className="stage-body" ref={bodyRef}>
        <div className="frame" style={{ width: size.w, height: size.h }}>
          <div ref={mapEl} className="map" />
          <canvas ref={overlayRef} className="overlay" />
          {pickMode && <div className="pick-hint">Click the map to add points</div>}
          {exporting && (
            <div className="export-veil" role="status">
              <div className="export-card">
                <p className="export-label">{exporting.label}</p>
                <div className="bar"><span style={{ width: `${Math.round(exporting.progress * 100)}%` }} /></div>
                <p className="export-pct">{Math.round(exporting.progress * 100)}%</p>
                <button className="btn ghost" onClick={() => (cancelRef.current = true)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="transport">
        <button className="btn play" onClick={toggle} disabled={!hasRoute} aria-label={ui.playing ? 'Pause' : 'Play'}>
          {ui.playing ? (
            <svg viewBox="0 0 24 24" width="20" height="20"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 4.5v15l13-7.5z" /></svg>
          )}
        </button>
        <button className="btn ghost" onClick={restart} disabled={!hasRoute}>Restart</button>
        <input
          className="scrub"
          type="range"
          min="0"
          max={ui.total || 1}
          step="0.01"
          value={ui.t}
          disabled={!hasRoute || !!exporting}
          onChange={(e) => {
            animRef.current.pause();
            animRef.current.seek(Number(e.target.value));
          }}
          aria-label="Timeline"
        />
        <span className="time">{formatTime(ui.t)} / {formatTime(ui.total)}</span>
      </div>
    </section>
  );
});
