// GPX (tracks, routes), KML, GeoJSON -> [[lng, lat], ...]
export async function parseRouteFile(file) {
  const text = await file.text();
  const name = file.name.replace(/\.[^.]+$/, '');
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'geojson' || ext === 'json') return { name, coords: fromGeoJSON(JSON.parse(text)) };

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('That file could not be read.');

  if (ext === 'kml') {
    const coords = [];
    [...doc.getElementsByTagName('coordinates')].forEach((node) => {
      node.textContent.trim().split(/\s+/).forEach((t) => {
        const [lng, lat] = t.split(',').map(Number);
        if (Number.isFinite(lng) && Number.isFinite(lat)) coords.push([lng, lat]);
      });
    });
    return { name, coords: check(coords) };
  }

  let pts = [...doc.getElementsByTagName('trkpt')];
  if (!pts.length) pts = [...doc.getElementsByTagName('rtept')];
  if (!pts.length) pts = [...doc.getElementsByTagName('wpt')];
  const coords = pts.map((p) => [Number(p.getAttribute('lon')), Number(p.getAttribute('lat'))]);
  return { name, coords: check(coords) };
}

function fromGeoJSON(g) {
  const out = [];
  const walk = (geom) => {
    if (!geom) return;
    if (geom.type === 'FeatureCollection') geom.features.forEach((f) => walk(f.geometry));
    else if (geom.type === 'Feature') walk(geom.geometry);
    else if (geom.type === 'LineString') out.push(...geom.coordinates);
    else if (geom.type === 'MultiLineString') geom.coordinates.forEach((l) => out.push(...l));
    else if (geom.type === 'GeometryCollection') geom.geometries.forEach(walk);
  };
  walk(g);
  return check(out.map((c) => [c[0], c[1]]));
}

function check(coords) {
  const valid = coords.filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (valid.length < 2) throw new Error('No route line found in that file.');
  return valid;
}

export function toGPX(coords, name = 'route') {
  const pts = coords.map(([lng, lat]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RouteReel" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>${escapeXml(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const slug = (s) => (s || 'route').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'route';
