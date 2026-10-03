// renderPacks.js — L2 of the Galactic Engine: history → render parameters (a plain, serializable object).
//
// Physics decides which way each knob pushes; the TUNING table holds the display constants. Lab sliders write
// into `renderPackOverrides` (a registered object the game reads too), never into lab-only state, so a value
// tuned in the lab is the value the game draws (lab-wired-to-game rule 6). Headless: no three.js.

import { LUMA, NOISE_OFFSET_MIN, NOISE_OFFSET_SPAN } from './cloudConstants.js';
import { SeededRandom } from '../generation/SeededRandom.js';

export const PACK_VERSION = 1;
export const COLOUR_MODES = ['realistic', 'photo'];
export const DEFAULT_COLOUR_MODE = 'photo';

/** Display/derivation constants. Each entry is a slider in the lab (min/max/step) and a default in the game. */
export const TUNABLES = {
  targetLum:        { value: 0.16, min: 0.02, max: 0.6,  step: 0.01, why: 'central surface brightness (luminance) of a mean column' },
  sigma:            { value: 1.1,  min: 0,    max: 2.5,  step: 0.05, why: 'lognormal width of the density field' },
  noiseScaleFrac:   { value: 0.35, min: 0.05, max: 1.5,  step: 0.01, why: 'largest noise feature, as a fraction of the radius' },
  octaves:          { value: 5,    min: 1,    max: 7,    step: 1,    why: 'fBm octaves' },
  ridgeGain:        { value: 0.8,  min: 0,    max: 3,    step: 0.05, why: 'filament (ridged noise) contribution to log-density' },
  envelopeSoftness: { value: 0.45, min: 0.02, max: 1,    step: 0.01, why: 'fraction of the radius over which the cloud fades out' },
  tauCentre:        { value: 0.8,  min: 0,    max: 4,    step: 0.05, why: 'dust optical depth (V) through the centre, per unit dust-to-gas' },
  cavityDepth:      { value: 0.85, min: 0,    max: 1,    step: 0.01, why: 'how empty the ionized cavity is' },
  cavityScale:      { value: 1.0,  min: 0,    max: 2.5,  step: 0.05, why: 'multiplier on the derived cavity radius' },
  realisticSatMax:  { value: 0.45, min: 0,    max: 1,    step: 0.01, why: 'Realistic mode: saturation reached in the brightest parts' },
  realisticLumLo:   { value: 0.10, min: 0,    max: 0.5,  step: 0.005, why: 'Realistic mode: below this luminance the eye sees grey' },
  realisticLumHi:   { value: 0.30, min: 0.01, max: 1,    step: 0.005, why: 'Realistic mode: luminance where colour vision is fully on' },
};

/** The registered override object. Keys are TUNABLES names; the lab's sliders write here. */
export const renderPackOverrides = {};

export function tuningValues(overrides = renderPackOverrides) {
  const out = {};
  for (const [k, spec] of Object.entries(TUNABLES)) {
    out[k] = Object.prototype.hasOwnProperty.call(overrides, k) ? Number(overrides[k]) : spec.value;
  }
  return out;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function lumNormalise(rgb) {
  const y = rgb[0] * LUMA[0] + rgb[1] * LUMA[1] + rgb[2] * LUMA[2];
  return rgb.map((c) => c / y);
}

// Hα 656 nm red/pink and [O III] 501 nm teal, normalised to unit luminance so the colour MODE and the line
// MIX never change brightness — only hue.
const PHOTO_HA = lumNormalise([1.0, 0.22, 0.32]);
const PHOTO_OIII = lumNormalise([0.2, 0.85, 0.8]);
// Scotopic/mesopic grey-teal: what the dark-adapted eye reports for most nebulosity.
const REALISTIC_TINT = lumNormalise([0.80, 1.02, 1.04]);
// Relative extinction per channel (A_R : A_V : A_B ≈ 0.75 : 1 : 1.32) — blue is lost first, so dust reddens.
const EXTINCTION_RGB = [0.75, 1.0, 1.32];

/** ZYZ Euler → column-major 3x3 rotation (galactic → nebula-local). */
function rotationZYZ([a, b, c]) {
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  // Row-major R = Rz(a) Ry(b) Rz(c)
  const r = [
    ca * cb * cc - sa * sc, -ca * cb * sc - sa * cc, ca * sb,
    sa * cb * cc + ca * sc, -sa * cb * sc + ca * cc, sa * sb,
    -sb * cc, sb * sc, cb,
  ];
  // Transpose into column-major storage (GLSL mat3 / three Matrix3.fromArray order).
  return [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]];
}

/**
 * @param {object} history — from featureHistory()
 * @param {{colourMode?: string, overrides?: object}} [opts]
 */
export function renderPack(history, opts = {}) {
  const colourMode = opts.colourMode ?? DEFAULT_COLOUR_MODE;
  if (!COLOUR_MODES.includes(colourMode)) throw new Error(`renderPack: unknown colour mode '${colourMode}'`);
  const t = tuningValues(opts.overrides ?? renderPackOverrides);
  const R = history.radiusPc;
  const ion = history.ionizing;

  // Cavity: a bubble blown around the ionizing source, growing with strength and age (Strömgren-like ∝ Q^1/3).
  const growth = history.ageMyr / (history.ageMyr + 2);
  const cavityRadiusPc = R * clamp((0.2 + 0.35 * Math.cbrt(ion.strength) * growth) * t.cavityScale, 0, 0.95);

  const softness = clamp(t.envelopeSoftness, 0.02, 1);
  const meanPath = 2 * R * (1 - softness / 2); // envelope-weighted chord through the centre
  const offRng = new SeededRandom(`galactic-pack|${history.featureId}|noise-offset`);

  return {
    version: PACK_VERSION,
    featureId: history.featureId,
    colourMode,
    radiusPc: R,
    boundRadiusPc: R,
    envelopeSoftness: softness,
    rotation: rotationZYZ(history.orientation),
    noise: {
      scalePc: Math.max(1e-3, R * t.noiseScaleFrac),
      octaves: Math.round(clamp(t.octaves, 1, 8)),
      gain: 0.5,
      lacunarity: 2.0,
      sigma: t.sigma,
      ridgeGain: t.ridgeGain,
      offset: [0, 1, 2].map(() => NOISE_OFFSET_MIN + offRng.float() * NOISE_OFFSET_SPAN),
    },
    cavity: {
      centrePc: ion.offsetPc.slice(),
      radiusPc: cavityRadiusPc,
      depth: clamp(t.cavityDepth, 0, 1),
    },
    ionizing: {
      centrePc: ion.offsetPc.slice(),
      glowRadiusPc: Math.max(cavityRadiusPc * 1.6, R * 0.25),
      oiiiRadiusPc: Math.max(cavityRadiusPc, R * 0.1),
      hardness: ion.hardness,
    },
    // Emission per pc per unit density; 0.6 ≈ mean ionized-fraction weight along a central chord.
    emission: {
      scale: (t.targetLum * Math.sqrt(ion.strength)) / (meanPath * 0.6),
      ha: PHOTO_HA.slice(),
      oiii: PHOTO_OIII.slice(),
    },
    extinction: {
      scale: (t.tauCentre * history.dustToGas) / meanPath,
      rgb: EXTINCTION_RGB.slice(),
    },
    realistic: {
      tint: REALISTIC_TINT.slice(),
      satMin: 0,
      satMax: clamp(t.realisticSatMax, 0, 1),
      lumLo: t.realisticLumLo,
      lumHi: Math.max(t.realisticLumHi, t.realisticLumLo + 1e-3),
    },
  };
}

/** Canonical serialization (stable key order) — what the parity fences compare. */
export function serializePack(pack) {
  const sortKeys = (v) => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v).sort()) o[k] = sortKeys(v[k]);
      return o;
    }
    return v;
  };
  return JSON.stringify(sortKeys(pack));
}

/** Short FNV-1a hash of the serialized pack, for the debug snapshot. */
export function packHash(pack) {
  const s = serializePack(pack);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
