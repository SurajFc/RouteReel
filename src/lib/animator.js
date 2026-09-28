import { buildTrack, pointAt, sliceTo, headingAt, lerp, lerpAngle, boundsOf } from './geo';
import { loadVehicleImage } from './vehicles';

const IMG = 'rr-vehicle-img';
const S = { full: 'rr-full', done: 'rr-done', ends: 'rr-ends', veh: 'rr-veh' };
const L = {
  remaining: 'rr-remaining',
  glow: 'rr-glow',
  casing: 'rr-casing',
  done: 'rr-done-line',
  ends: 'rr-ends-circle',
  veh: 'rr-vehicle',
};

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const line = (coords) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} });
const EMPTY = { type: 'FeatureCollection', features: [] };

/**
 * Timeline: intro (overview -> chase cam), drive, outro (chase cam -> overview).
 * Every frame is a pure function of time t, so seeking and recording are deterministic.
 */
export class RouteAnimator {
  constructor(map, { onFrame } = {}) {
    this.map = map;
    this.onFrame = onFrame;
    this.track = null;
    this.settings = null;
    this.t = 0;
    this.playing = false;
    this.raf = 0;
    this.lastTs = 0;
    this.smoothBearing = null;
    this.imageKey = '';
    this.overviewCam = null;
    this.onEnd = null;
    this.loop = this.loop.bind(this);
  }

  get phases() {
    const follow = this.settings?.camera.mode === 'follow';
    return { intro: follow ? 2 : 0.6, drive: this.settings?.duration || 20, outro: follow ? 2.5 : 1.5 };
  }

  get totalTime() {
    const p = this.phases;
    return p.intro + p.drive + p.outro;
  }

  // ---------- setup ----------

  setTrack(coords) {
    this.track = coords && coords.length > 1 ? buildTrack(coords) : null;
    this.t = 0;
    this.smoothBearing = null;
    this.overviewCam = null;
    this.syncStatic();
    this.render();
  }

  async setSettings(settings) {
    const prevMode = this.settings?.camera.mode;
    this.settings = settings;
    if (prevMode && prevMode !== settings.camera.mode) this.t = Math.min(this.t, this.totalTime);
    if (!this.map.isStyleLoaded()) return; // onStyleLoad will finish the job
    await this.ensureVehicleImage();
    this.applyPaint();
    if (!this.playing) this.render();
  }

  async onStyleLoad() {
    this.imageKey = '';
    this.addLayers();
    await this.ensureVehicleImage();
    this.applyPaint();
    this.syncStatic();
    this.render();
  }

  addLayers() {
    const m = this.map;
    if (m.getSource(S.full)) return;
    for (const id of Object.values(S)) m.addSource(id, { type: 'geojson', data: EMPTY });

    const round = { 'line-cap': 'round', 'line-join': 'round' };
    m.addLayer({ id: L.remaining, type: 'line', source: S.full, layout: round, paint: { 'line-opacity': 0.35 } });
    m.addLayer({ id: L.glow, type: 'line', source: S.done, layout: round, paint: { 'line-opacity': 0.45 } });
    m.addLayer({ id: L.casing, type: 'line', source: S.done, layout: round, paint: { 'line-color': '#ffffff' } });
    m.addLayer({ id: L.done, type: 'line', source: S.done, layout: round });
    m.addLayer({
      id: L.ends,
      type: 'circle',
      source: S.ends,
      paint: {
        'circle-radius': 7,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-pitch-alignment': 'map',
      },
    });
    m.addLayer({
      id: L.veh,
      type: 'symbol',
      source: S.veh,
      layout: {
        'icon-image': IMG,
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }

  async ensureVehicleImage() {
    const { type, color } = this.settings.vehicle;
    const key = `${type}|${color}`;
    if (key === this.imageKey && this.map.hasImage(IMG)) return;
    this.imageKey = key;
    const img = await loadVehicleImage(type, color);
    if (this.imageKey !== key) return; // a newer request won
    if (this.map.hasImage(IMG)) this.map.removeImage(IMG);
    this.map.addImage(IMG, img, { pixelRatio: 2 });
  }

  applyPaint() {
    const m = this.map;
    if (!m.getLayer(L.done)) return;
    const { line: ln, vehicle } = this.settings;
    const w = ln.width;
    m.setPaintProperty(L.remaining, 'line-color', ln.color);
    m.setPaintProperty(L.remaining, 'line-width', Math.max(2, w * 0.7));
    m.setLayoutProperty(L.remaining, 'visibility', ln.showRemaining ? 'visible' : 'none');
    m.setPaintProperty(L.glow, 'line-color', ln.color);
    m.setPaintProperty(L.glow, 'line-width', w * 3.2);
    m.setPaintProperty(L.glow, 'line-blur', w * 2.2);
    m.setLayoutProperty(L.glow, 'visibility', ln.glow ? 'visible' : 'none');
    m.setPaintProperty(L.casing, 'line-width', w + 4);
    m.setPaintProperty(L.done, 'line-color', ln.color);
    m.setPaintProperty(L.done, 'line-width', w);
    m.setPaintProperty(L.ends, 'circle-color', ['match', ['get', 'kind'], 'start', '#1B1F24', ln.color]);
    m.setLayoutProperty(L.veh, 'icon-size', vehicle.size);
  }

  syncStatic() {
    const m = this.map;
    if (!m.getSource(S.full)) return;
    if (!this.track) {
      for (const id of Object.values(S)) m.getSource(id).setData(EMPTY);
      return;
    }
    const c = this.track.coords;
    m.getSource(S.full).setData(line(c));
    m.getSource(S.ends).setData({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: c[0] }, properties: { kind: 'start' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: c[c.length - 1] }, properties: { kind: 'end' } },
      ],
    });
  }

  // ---------- camera ----------

  getOverviewCam() {
    if (this.overviewCam) return this.overviewCam;
    const canvas = this.map.getCanvas();
    const pad = Math.round(Math.min(canvas.clientWidth, canvas.clientHeight) * 0.08);
    const cam = this.map.cameraForBounds(boundsOf(this.track.coords), { padding: pad, bearing: 0 });
    this.overviewCam = cam
      ? { center: [cam.center.lng, cam.center.lat], zoom: cam.zoom, pitch: 0, bearing: 0 }
      : { center: this.track.coords[0], zoom: 12, pitch: 0, bearing: 0 };
    return this.overviewCam;
  }

  invalidateOverview() {
    this.overviewCam = null;
  }

  chaseCam(dist, heading) {
    const { camera } = this.settings;
    return {
      center: pointAt(this.track, dist).point,
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.rotate ? heading : 0,
    };
  }

  // ---------- frames ----------

  frameAt(t) {
    const { intro, drive } = this.phases;
    const total = this.track.total;
    const follow = this.settings.camera.mode === 'follow';

    let p; // 0..1 along route
    if (t <= intro) p = 0;
    else if (t >= intro + drive) p = 1;
    else {
      const raw = (t - intro) / drive;
      p = this.settings.easing ? easeInOut(raw) : raw;
    }
    const dist = p * total;

    const iconWin = clamp(total * 0.004, 8, 120);
    const camWin = clamp(total * 0.02, 40, 1500);
    const iconHeading = headingAt(this.track, dist, iconWin) ?? this.lastIconHeading ?? 0;
    const camHeading = headingAt(this.track, dist, camWin) ?? iconHeading;
    this.lastIconHeading = iconHeading;

    let cam;
    if (!follow) {
      cam = this.getOverviewCam();
    } else {
      const over = this.getOverviewCam();
      if (t < intro) {
        const k = easeInOut(t / intro);
        cam = blendCam(over, this.chaseCam(0, camHeading), k);
      } else if (t > intro + drive) {
        const k = easeInOut(clamp((t - intro - drive) / this.phases.outro, 0, 1));
        cam = blendCam(this.chaseCam(total, camHeading), over, k);
      } else {
        cam = this.chaseCam(dist, camHeading);
      }
    }
    return { dist, p, iconHeading, cam, driving: t > intro && t < intro + drive };
  }

  render() {
    if (!this.track || !this.settings || !this.map.style || !this.map.getSource(S.done) || !this.map.getSource(S.veh)) return;
    try {
      const f = this.frameAt(this.t);

      // Damp camera rotation during continuous playback; exact when seeking
      if (this.playing && this.settings.camera.rotate && this.settings.camera.mode === 'follow') {
        this.smoothBearing = this.smoothBearing == null ? f.cam.bearing : lerpAngle(this.smoothBearing, f.cam.bearing, 0.08);
        f.cam = { ...f.cam, bearing: this.smoothBearing };
      } else {
        this.smoothBearing = f.cam.bearing;
      }

      const traveled = f.dist > 0 ? sliceTo(this.track, f.dist) : [this.track.coords[0], this.track.coords[0]];
      this.map.getSource(S.done).setData(line(traveled));
      this.map.getSource(S.veh).setData({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pointAt(this.track, f.dist).point },
        properties: { bearing: f.iconHeading },
      });
      this.map.jumpTo(f.cam);

      this.onFrame?.({
        t: this.t,
        total: this.totalTime,
        dist: f.dist,
        routeLength: this.track.total,
        progress: f.p,
        playing: this.playing,
      });
    } catch (err) {
      // The map can be mid-transition (style swap, resize) when a setting
      // changes during playback; skip this frame instead of crashing it.
      console.warn('RouteAnimator: skipped a frame', err);
    }
  }

  // ---------- transport ----------

  play() {
    if (!this.track || this.playing) return;
    if (this.t >= this.totalTime) this.t = 0;
    this.playing = true;
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    this.render();
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.render();
  }

  seek(t) {
    this.t = clamp(t, 0, this.totalTime);
    this.smoothBearing = null;
    this.render();
  }

  loop(ts) {
    if (!this.playing) return;
    const dt = Math.min(0.1, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.t += dt;
    if (this.t >= this.totalTime) {
      this.t = this.totalTime;
      this.playing = false;
      this.render();
      this.onEnd?.();
      return;
    }
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
  }
}

function blendCam(a, b, k) {
  return {
    center: [lerp(a.center[0], b.center[0], k), lerp(a.center[1], b.center[1], k)],
    zoom: lerp(a.zoom, b.zoom, k),
    pitch: lerp(a.pitch, b.pitch, k),
    bearing: lerpAngle(a.bearing, b.bearing, k),
  };
}
