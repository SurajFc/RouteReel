// Top-down vehicles on a 64x64 grid, nose pointing north (up).
// MapLibre rotates them with the route heading via icon-rotate.

const TIRE = '#16181b';
const TRIM = '#23272c';
const GLASS = '#1d2b38';
const LAMP = '#fff4c2';

const shadow = (rx, ry) =>
  `<ellipse cx="33" cy="34" rx="${rx}" ry="${ry}" fill="#000" opacity="0.28"/>`;

const svgs = {
  motorbike: (c) => `
    ${shadow(11, 27)}
    <rect x="28.5" y="3" width="7" height="15" rx="3.5" fill="${TIRE}"/>
    <rect x="28.5" y="46" width="7" height="15" rx="3.5" fill="${TIRE}"/>
    <path d="M32 11c7 1 9.5 7 9 15l-1.2 21c-.4 5-15.2 5-15.6 0L23 26c-.5-8 2-14 9-15z"
      fill="${c}" stroke="#fff" stroke-width="1.6"/>
    <rect x="15" y="15.5" width="34" height="4" rx="2" fill="${TRIM}" stroke="#fff" stroke-width="1"/>
    <rect x="21" y="27" width="22" height="11" rx="5.5" fill="${TRIM}"/>
    <circle cx="32" cy="30" r="6.5" fill="${c}" stroke="#fff" stroke-width="1.6"/>
    <path d="M27.5 27.5a6.5 6.5 0 0 1 9 0" fill="none" stroke="${GLASS}" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="32" cy="8" r="2.2" fill="${LAMP}"/>`,

  car: (c) => `
    ${shadow(15, 28)}
    <rect x="15" y="12" width="4" height="10" rx="1.5" fill="${TIRE}"/>
    <rect x="45" y="12" width="4" height="10" rx="1.5" fill="${TIRE}"/>
    <rect x="15" y="42" width="4" height="10" rx="1.5" fill="${TIRE}"/>
    <rect x="45" y="42" width="4" height="10" rx="1.5" fill="${TIRE}"/>
    <rect x="17" y="4" width="30" height="56" rx="10" fill="${c}" stroke="#fff" stroke-width="1.8"/>
    <path d="M21 21c7-3 15-3 22 0l-2 8H23z" fill="${GLASS}"/>
    <path d="M22.5 47l1.5-5h16l1.5 5c-6 2-13 2-19 0z" fill="${GLASS}"/>
    <rect x="23" y="29" width="18" height="13" rx="2" fill="#000" opacity="0.12"/>
    <rect x="20" y="6" width="6" height="3" rx="1.5" fill="${LAMP}"/>
    <rect x="38" y="6" width="6" height="3" rx="1.5" fill="${LAMP}"/>
    <rect x="20" y="56" width="6" height="2" rx="1" fill="#ff4d4d"/>
    <rect x="38" y="56" width="6" height="2" rx="1" fill="#ff4d4d"/>`,

  bicycle: (c) => `
    ${shadow(8, 26)}
    <rect x="30" y="4" width="4" height="18" rx="2" fill="${TIRE}"/>
    <rect x="30" y="42" width="4" height="18" rx="2" fill="${TIRE}"/>
    <rect x="30.5" y="16" width="3" height="32" rx="1.5" fill="${c}" stroke="#fff" stroke-width="1"/>
    <rect x="19" y="14" width="26" height="3" rx="1.5" fill="${TRIM}" stroke="#fff" stroke-width="0.8"/>
    <rect x="22" y="26" width="20" height="10" rx="5" fill="${c}" stroke="#fff" stroke-width="1.4"/>
    <circle cx="32" cy="27" r="5.5" fill="${TRIM}" stroke="#fff" stroke-width="1.4"/>`,

  truck: (c) => `
    ${shadow(15, 29)}
    <rect x="14" y="6" width="4" height="9" rx="1.5" fill="${TIRE}"/>
    <rect x="46" y="6" width="4" height="9" rx="1.5" fill="${TIRE}"/>
    <rect x="14" y="44" width="4" height="12" rx="1.5" fill="${TIRE}"/>
    <rect x="46" y="44" width="4" height="12" rx="1.5" fill="${TIRE}"/>
    <rect x="17" y="2" width="30" height="17" rx="5" fill="${c}" stroke="#fff" stroke-width="1.8"/>
    <path d="M21 8h22l-1.5 6h-19z" fill="${GLASS}"/>
    <rect x="16" y="21" width="32" height="40" rx="2.5" fill="#e9ecef" stroke="#fff" stroke-width="1.8"/>
    <rect x="16" y="21" width="32" height="5" fill="${c}"/>
    <rect x="20" y="3.5" width="5" height="2" rx="1" fill="${LAMP}"/>
    <rect x="39" y="3.5" width="5" height="2" rx="1" fill="${LAMP}"/>`,

  dot: (c) => `
    <circle cx="32" cy="32" r="22" fill="${c}" opacity="0.22"/>
    <circle cx="32" cy="32" r="13" fill="${c}" stroke="#fff" stroke-width="3.5"/>
    <path d="M32 21l6 11h-12z" fill="#fff"/>`,
};

export const VEHICLES = [
  { id: 'motorbike', label: 'Motorbike' },
  { id: 'car', label: 'Car' },
  { id: 'bicycle', label: 'Bicycle' },
  { id: 'truck', label: 'Truck' },
  { id: 'dot', label: 'Dot' },
];

export function vehicleSVG(type, color, px = 64) {
  const body = (svgs[type] || svgs.car)(color);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64">${body}</svg>`;
}

export function vehicleDataURL(type, color, px = 64) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(vehicleSVG(type, color, px));
}

// Rendered at 2x for crisp edges when recording at high pixel ratio
export function loadVehicleImage(type, color) {
  return new Promise((resolve, reject) => {
    const img = new Image(128, 128);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = vehicleDataURL(type, color, 128);
  });
}
