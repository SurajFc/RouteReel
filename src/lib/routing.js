// Free, keyless services. Fine for personal use; for heavy traffic, self-host
// OSRM/Photon or swap in Mapbox/Google (see README).
const PROFILE = {
  motorbike: 'routed-car',
  car: 'routed-car',
  truck: 'routed-car',
  bicycle: 'routed-bike',
  dot: 'routed-car',
};

export async function fetchRoute(waypoints, vehicle = 'car') {
  if (waypoints.length < 2) throw new Error('Add a start and a destination.');
  const path = waypoints.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(';');
  // Alternatives only come back for a plain start->destination hop; OSRM ignores
  // the flag once there are extra stops in between, so this stays harmless.
  const alt = waypoints.length === 2 ? '&alternatives=true' : '';
  const url = `https://routing.openstreetmap.de/${PROFILE[vehicle] || 'routed-car'}/route/v1/driving/${path}?overview=full&geometries=geojson${alt}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing service returned ${res.status}. Retry, or turn off "Follow roads".`);
  const json = await res.json();
  if (!json.routes?.length) throw new Error('No road route between these points.');
  const routes = json.routes
    .map((r) => ({ coords: r.geometry.coordinates, distance: r.distance, duration: r.duration }))
    .sort((a, b) => a.duration - b.duration);
  return { routes, coords: routes[0].coords, distance: routes[0].distance, duration: routes[0].duration };
}

export async function geocode(query, signal) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.features || []).map((f) => {
    const p = f.properties;
    const label = [p.name, p.city !== p.name ? p.city : null, p.state, p.country]
      .filter(Boolean)
      .join(', ');
    return { label, coord: f.geometry.coordinates };
  });
}

const SHORT_LINK_RE = /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i;

function parsePoint(text) {
  const trimmed = text.trim();
  const m = trimmed.match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (m) return { label: trimmed, coord: [parseFloat(m[2]), parseFloat(m[1])] };
  return { label: trimmed, coord: null };
}

function decodePathSegment(seg) {
  try {
    return decodeURIComponent(seg.replace(/\+/g, ' '));
  } catch {
    return seg.replace(/\+/g, ' ');
  }
}

/**
 * Reads a route (start-to-finish, with any stops) out of a Google Maps
 * link, without any network request — it's pure string parsing of the
 * URL. Two link shapes are recognized: the modern
 * `/maps/dir/<point>/<point>/.../@lat,lng,z` form, and the older
 * `?saddr=<point>&daddr=<point>+to:<point>+to:...` form some share flows
 * still produce. A shortened link (maps.app.goo.gl, goo.gl/maps) can't be
 * expanded from the browser — Google's redirect sends no CORS headers —
 * so that's reported separately rather than silently failing.
 */
export function parseGoogleMapsLink(input) {
  const text = (input || '').trim();
  if (!text) return { type: 'empty' };
  if (SHORT_LINK_RE.test(text)) return { type: 'short' };

  let url;
  try {
    url = new URL(text);
  } catch {
    return { type: 'invalid' };
  }
  if (!/\bgoogle\.[a-z.]+$/i.test(url.hostname) || !url.pathname.startsWith('/maps')) {
    return { type: 'invalid' };
  }

  const dirMatch = url.pathname.match(/\/maps\/dir\/([^@]+)/);
  if (dirMatch) {
    const points = dirMatch[1]
      .split('/')
      .filter(Boolean)
      .map(decodePathSegment)
      .map(parsePoint);
    if (points.length >= 2) return { type: 'points', points };
  }

  const saddr = url.searchParams.get('saddr');
  const daddr = url.searchParams.get('daddr');
  if (saddr || daddr) {
    const points = [];
    if (saddr) points.push(parsePoint(saddr));
    if (daddr) points.push(...daddr.split(/\s+to:\s*/).map(parsePoint));
    if (points.length >= 2) return { type: 'points', points };
  }

  return { type: 'unsupported' };
}

export function locateMe() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : 'Could not get your location.')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
