// Keyless basemaps. Attribution strings are burned into exported video.
const OSM = '© OpenStreetMap contributors';

export const MAP_STYLES = {
  streets: {
    label: 'Streets 3D',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: `OpenFreeMap ${OSM}`,
  },
  bright: {
    label: 'Bright',
    style: 'https://tiles.openfreemap.org/styles/bright',
    attribution: `OpenFreeMap ${OSM}`,
  },
  light: {
    label: 'Light',
    style: 'https://tiles.openfreemap.org/styles/positron',
    attribution: `OpenFreeMap ${OSM}`,
  },
  dark: {
    label: 'Dark',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    attribution: `© CARTO ${OSM}`,
  },
  satellite: {
    label: 'Satellite',
    style: {
      version: 8,
      sources: {
        esri: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          maxzoom: 19,
          attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
        },
      },
      layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
    },
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  },
};

export const ASPECTS = {
  '16:9': { label: '16:9', hint: 'YouTube', ratio: 16 / 9 },
  '9:16': { label: '9:16', hint: 'Shorts, Reels', ratio: 9 / 16 },
  '1:1': { label: '1:1', hint: 'Square', ratio: 1 },
  '4:5': { label: '4:5', hint: 'Instagram', ratio: 4 / 5 },
};

export const DEFAULT_SETTINGS = {
  template: 'cinematic',
  mapStyle: 'streets',
  vehicle: { type: 'motorbike', color: '#E8412C', size: 1 },
  line: { color: '#E8412C', width: 6, glow: true, showRemaining: true, spotlight: true },
  camera: { mode: 'follow', zoom: 16, pitch: 60, rotate: true },
  duration: 20,
  easing: true,
  hud: { show: true, title: '', stats: true, units: 'km' },
  aspect: '16:9',
  format: 'mp4',
  resolution: 1080,
  fps: 30,
  gifSize: 480,
  gifFps: 15,
};

// A template overwrites look and camera; route and title stay yours.
export const TEMPLATES = [
  {
    id: 'cinematic',
    label: 'Cinematic 3D',
    note: 'Tilted chase cam over 3D buildings',
    swatch: ['#E8412C', '#d9dde2'],
    apply: {
      mapStyle: 'streets',
      vehicle: { type: 'motorbike', color: '#E8412C', size: 1 },
      line: { color: '#E8412C', width: 6, glow: true, showRemaining: true },
      camera: { mode: 'follow', zoom: 16, pitch: 60, rotate: true },
      easing: true,
    },
  },
  {
    id: 'night',
    label: 'Night ride',
    note: 'Dark map, glowing trail',
    swatch: ['#35D0FF', '#1b1f24'],
    apply: {
      mapStyle: 'dark',
      vehicle: { type: 'motorbike', color: '#35D0FF', size: 1 },
      line: { color: '#35D0FF', width: 5, glow: true, showRemaining: false },
      camera: { mode: 'follow', zoom: 15.5, pitch: 55, rotate: true },
      easing: true,
    },
  },
  {
    id: 'satellite',
    label: 'Travel vlog',
    note: 'Satellite imagery, bright trail',
    swatch: ['#FFD23F', '#4b5d3a'],
    apply: {
      mapStyle: 'satellite',
      vehicle: { type: 'car', color: '#FFD23F', size: 1.1 },
      line: { color: '#FFD23F', width: 5, glow: true, showRemaining: true },
      camera: { mode: 'follow', zoom: 14.5, pitch: 45, rotate: true },
      easing: true,
    },
  },
  {
    id: 'clean',
    label: 'Clean top-down',
    note: 'North-up, flat, easy to read',
    swatch: ['#1F6FEB', '#f2f3f5'],
    apply: {
      mapStyle: 'light',
      vehicle: { type: 'car', color: '#1F6FEB', size: 1 },
      line: { color: '#1F6FEB', width: 5, glow: false, showRemaining: true },
      camera: { mode: 'follow', zoom: 14, pitch: 0, rotate: false },
      easing: true,
    },
  },
  {
    id: 'overview',
    label: 'Road trip map',
    note: 'Whole route in frame, line draws across',
    swatch: ['#D1345B', '#eceae4'],
    apply: {
      mapStyle: 'bright',
      vehicle: { type: 'dot', color: '#D1345B', size: 0.8 },
      line: { color: '#D1345B', width: 5, glow: false, showRemaining: true },
      camera: { mode: 'overview', zoom: 14, pitch: 0, rotate: false },
      easing: false,
    },
  },
];

export const SAMPLE_ROUTES = [
  {
    id: 'nagarkot',
    label: 'Kathmandu to Nagarkot',
    stops: [
      { label: 'Thamel, Kathmandu', coord: [85.3106, 27.7154] },
      { label: 'Nagarkot', coord: [85.5206, 27.7154] },
    ],
  },
  {
    id: 'agra',
    label: 'Delhi to Agra',
    stops: [
      { label: 'India Gate, New Delhi', coord: [77.2295, 28.6129] },
      { label: 'Taj Mahal, Agra', coord: [78.0421, 27.1751] },
    ],
  },
  {
    id: 'pokhara',
    label: 'Kathmandu to Pokhara',
    stops: [
      { label: 'Kathmandu', coord: [85.324, 27.7172] },
      { label: 'Lakeside, Pokhara', coord: [83.9591, 28.2096] },
    ],
  },
];

export const SWATCHES = ['#E8412C', '#FFD23F', '#35D0FF', '#1F6FEB', '#2FBF71', '#D1345B', '#FFFFFF', '#1B1F24'];

export function mergeSettings(base, patch) {
  const out = { ...base };
  for (const k of Object.keys(patch || {})) {
    const v = patch[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...(base[k] || {}), ...v } : v;
  }
  return out;
}
