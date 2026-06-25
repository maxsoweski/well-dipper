// src/worldengine/base/mathutil.js
// Pure scalar helpers shared across the world-engine base step. No three.js, no rng.
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;
