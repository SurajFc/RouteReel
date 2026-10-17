// Open Topo Data: free, keyless, CORS-enabled. https://www.opentopodata.org
// Its public server caps a request at 100 locations, so long routes are
// evenly downsampled first — plenty of resolution for a route-length chart.
const ELEVATION_API = 'https://api.opentopodata.org/v1/srtm90m';
const MAX_SAMPLES = 100;
// SRTM90 has a few meters of vertical noise; ignore deltas below this so flat
// ground doesn't rack up a fake "gain" one noisy sample at a time.
const NOISE_FLOOR = 2;

function sampleCoords(coords, count) {
  if (coords.length <= count) return coords;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(coords[Math.round((i * (coords.length - 1)) / (count - 1))]);
  }
  return out;
}

/**
 * Samples elevation along a route and computes total climb/descent.
 * Returns null (rather than throwing) on any failure — this is an
 * enhancement, not something a route needs to work.
 */
export async function fetchElevationProfile(coords, signal) {
  if (!coords || coords.length < 2) return null;
  const points = sampleCoords(coords, MAX_SAMPLES);
  const locations = points.map(([lng, lat]) => `${lat},${lng}`).join('|');
  const res = await fetch(`${ELEVATION_API}?locations=${locations}`, { signal });
  if (!res.ok) throw new Error(`Elevation lookup failed (${res.status}).`);
  const json = await res.json();
  const elevations = (json.results || []).map((r) => r.elevation).filter((e) => typeof e === 'number');
  if (elevations.length < 2) return null;

  let gain = 0, loss = 0, baseline = elevations[0];
  for (let i = 1; i < elevations.length; i++) {
    const d = elevations[i] - baseline;
    if (Math.abs(d) >= NOISE_FLOOR) {
      if (d > 0) gain += d;
      else loss += -d;
      baseline = elevations[i];
    }
  }

  return {
    samples: elevations,
    min: Math.min(...elevations),
    max: Math.max(...elevations),
    gain: Math.round(gain),
    loss: Math.round(loss),
  };
}
