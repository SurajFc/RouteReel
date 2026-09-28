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
  const url = `https://routing.openstreetmap.de/${PROFILE[vehicle] || 'routed-car'}/route/v1/driving/${path}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing service returned ${res.status}. Retry, or turn off "Follow roads".`);
  const json = await res.json();
  const r = json.routes?.[0];
  if (!r) throw new Error('No road route between these points.');
  return { coords: r.geometry.coordinates, distance: r.distance, duration: r.duration };
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
