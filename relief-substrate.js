// relief-substrate.js — the shared mutable relief substrate (host of the host-editor model).
// Pure: no three.js. A 2D regular-grid DEM; engines mutate `height` in place across epochs.
export const REGIME = { NORMAL: 0, STRIKESLIP: 1, THRUST: 2 };

export function makeSubstrate({ n, lat0Deg, lat1Deg, domainKm }) {
  const count = n * n;
  return {
    n, lat0Deg, lat1Deg, domainKm, count,
    height: new Float32Array(count),       // THE host DEM (E6 writes, E9 subtracts)
    grainAngle: new Float32Array(count),   // structural-grain director, radians (lineament strike)
    grainMag: new Float32Array(count),     // grain magnitude 0..1
    regime: new Uint8Array(count),         // Anderson regime per REGIME
    faultDensity: new Float32Array(count),
    flowAccum: new Float32Array(count),    // drainage area (cell count + precip weight)
    baseLevel: new Float32Array(count),    // standing-liquid surface elevation
    standing: new Uint8Array(count),       // 1 where liquid stands (sea/lake)
    maturity: new Float32Array(count),     // accumulated surface age across epochs
  };
}
export function idx(s, ix, iy) { return iy * s.n + ix; }
export function latDegOfRow(s, iy) {
  const t = s.n <= 1 ? 0 : iy / (s.n - 1);
  return s.lat0Deg + (s.lat1Deg - s.lat0Deg) * t;
}
export function cloneHeight(s) { return Float32Array.from(s.height); }
