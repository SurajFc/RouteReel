// All coordinates are GeoJSON order: [lng, lat]
const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function haversine(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a, b) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x =
    Math.cos(rad(a[1])) * Math.sin(rad(b[1])) -
    Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function dedupe(coords) {
  const out = [];
  for (const c of coords) {
    const p = out[out.length - 1];
    if (!p || p[0] !== c[0] || p[1] !== c[1]) out.push([c[0], c[1]]);
  }
  return out;
}

// Precompute cumulative distance so playback runs at constant speed
export function buildTrack(coords) {
  const pts = dedupe(coords);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));
  return { coords: pts, cum, total: cum[cum.length - 1] };
}

function segmentAt(track, d) {
  const { cum } = track;
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid;
  }
  return lo;
}

export function pointAt(track, d) {
  const { coords, cum, total } = track;
  if (d <= 0) return { point: coords[0], index: 0 };
  if (d >= total) return { point: coords[coords.length - 1], index: coords.length - 1 };
  const i = segmentAt(track, d);
  const len = cum[i + 1] - cum[i] || 1;
  const k = (d - cum[i]) / len;
  const a = coords[i], b = coords[i + 1];
  return { point: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], index: i };
}

export function sliceTo(track, d) {
  const { point, index } = pointAt(track, d);
  const out = track.coords.slice(0, index + 1);
  out.push(point);
  return out;
}

// Heading measured across a window, so small GPS wiggles don't jerk the icon
export function headingAt(track, d, windowM) {
  const a = pointAt(track, Math.max(0, d - windowM / 2)).point;
  const b = pointAt(track, Math.min(track.total, d + windowM / 2)).point;
  if (a[0] === b[0] && a[1] === b[1]) return null;
  return bearing(a, b);
}

export const lerp = (a, b, t) => a + (b - a) * t;
export function lerpAngle(a, b, t) {
  const diff = ((b - a + 540) % 360) - 180;
  return (a + diff * t + 360) % 360;
}

export function boundsOf(coords) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of coords) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [[w, s], [e, n]];
}

export function formatDistance(m, units = 'km') {
  if (units === 'mi') {
    const mi = m / 1609.344;
    return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
  }
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return km < 100 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

// Short routes should be quick to watch, long ones longer, with diminishing
// returns so a cross-country trip doesn't need a two-minute video to match.
export function autoDriveTime(meters) {
  const km = meters / 1000;
  return Math.round(Math.min(120, Math.max(5, 6 + Math.sqrt(km) * 3)));
}

export function formatDuration(s) {
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatTime(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
