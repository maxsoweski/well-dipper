// src/worldengine/base/substrate.js
// Production port of relief-substrate.js — the shared mutable relief substrate (host-editor model).
// Pure: no three.js, no rng. A 2D regular-grid DEM; engines mutate `height` in place across epochs.
export const REGIME = { NORMAL: 0, STRIKESLIP: 1, THRUST: 2 };

export function makeSubstrate({ n, lat0Deg, lat1Deg, domainKm }) {
  const count = n * n;
  return {
    n, lat0Deg, lat1Deg, domainKm, count,
    height: new Float32Array(count),
    grainAngle: new Float32Array(count),   // structural-grain director, radians
    grainMag: new Float32Array(count),     // grain magnitude 0..1
    regime: new Uint8Array(count),         // Anderson regime per REGIME
    faultDensity: new Float32Array(count),
    sediment: new Float32Array(count),        // V2-4 host: pristine bedrock (initSedimentHost zero-fills; V2-8 deposits)
    accommodation: new Float32Array(count),   // V2-4 host: sink-ranking [0,1] (writeAccommodation reads finished height)
    flowAccum: new Float32Array(count),
    baseLevel: new Float32Array(count),
    standing: new Uint8Array(count),
    maturity: new Float32Array(count),
  };
}
export function idx(s, ix, iy) { return iy * s.n + ix; }
export function latDegOfRow(s, iy) {
  const t = s.n <= 1 ? 0 : iy / (s.n - 1);
  return s.lat0Deg + (s.lat1Deg - s.lat0Deg) * t;
}
export function cloneHeight(s) { return Float32Array.from(s.height); }
