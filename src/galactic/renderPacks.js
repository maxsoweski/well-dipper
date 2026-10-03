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
/** Cloud shape model. 1 = the step-1 field (a soft sphere with a closed central cavity — reads as a ring; kept
 *  byte-identical for A/B). 2 = the reshaping guide's R1-R4: blister cavity open through the surface, ionization
 *  front with density-squared emission, dust only in neutral gas, triaxial lobed outline. */
export const SHAPE_VERSIONS = [1, 2];
export const DEFAULT_SHAPE_VERSION = 2;
// Shape v2 brightness calibration: mean ionized weight of exp(-sigma^2)·rho^2·x along a central chord, measured on
// the CPU twin (tests/galactic-shape.test.js keeps v2's image luminance in the same range as v1's).
export const V2_ION_WEIGHT = 0.3;

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
  // Shape v2 only (ignored by shapeVersion 1):
  frontScale:       { value: 1.0,  min: 0.1,  max: 3,    step: 0.05, why: 'v2: multiplier on the ionization-front (Stromgren) radius' },
  frontWidth:       { value: 0.3,  min: 0.02, max: 0.9,  step: 0.01, why: 'v2: softness of the ionization front' },
  frontClump:       { value: 0,    min: 0,    max: 1,    step: 0.05, why: 'v2: how much small-scale clumping moves the ionization front (1 = every clump gets a bright skin → foam of small rings)' },
  dustDestroy:      { value: 0.8,  min: 0,    max: 1,    step: 0.01, why: 'v2: fraction of dust absent from ionized gas (dense neutral gas reads dark)' },
  lobeScale:        { value: 1.0,  min: 0,    max: 2,    step: 0.05, why: 'v2: multiplier on the outline lobes' },
  wallGradient:     { value: 1.5,  min: 0,    max: 3,    step: 0.05, why: 'v2: log-density rise per radius away from the open side (the cloud wall behind the blister)' },
  blisterScale:     { value: 1.0,  min: 0,    max: 1.5,  step: 0.05, why: 'v2: multiplier on how far the cavity breaks out (history blister)' },
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
 * @param {{colourMode?: string, shapeVersion?: number, overrides?: object}} [opts]
 */
export function renderPack(history, opts = {}) {
  const colourMode = opts.colourMode ?? DEFAULT_COLOUR_MODE;
  if (!COLOUR_MODES.includes(colourMode)) throw new Error(`renderPack: unknown colour mode '${colourMode}'`);
  const shapeVersion = opts.shapeVersion ?? DEFAULT_SHAPE_VERSION;
  if (!SHAPE_VERSIONS.includes(shapeVersion)) throw new Error(`renderPack: unknown shape version '${shapeVersion}'`);
  const t = tuningValues(opts.overrides ?? renderPackOverrides);
  const R = history.radiusPc;
  const ion = history.ionizing;

  // Cavity: a bubble blown around the ionizing source, growing with strength and age (Strömgren-like ∝ Q^1/3).
  const growth = history.ageMyr / (history.ageMyr + 2);
  const cavityRadiusPc = R * clamp((0.2 + 0.35 * Math.cbrt(ion.strength) * growth) * t.cavityScale, 0, 0.95);

  const softness = clamp(t.envelopeSoftness, 0.02, 1);
  const meanPath = 2 * R * (1 - softness / 2); // envelope-weighted chord through the centre
  const offRng = new SeededRandom(`galactic-pack|${history.featureId}|noise-offset`);

  const pack = {
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
  // shapeVersion 1 is the step-1 pack exactly (no extra keys, so its serialization and hash are unchanged).
  return shapeVersion === 1 ? pack : applyShapeV2(pack, history, t, { R, growth, cavityRadiusPc, softness });
}

/**
 * Shape v2 (reshaping guide R1-R4), all in the nebula-local frame:
 *  R1 blister — the gas thickens away from the open side (log-density gradient wallGradient·blister per radius
 *     along -n: the molecular cloud the region is eating into), the ionizing source sits toward the cloud's surface (offset + blister/2 of the radius along its
 *     direction n); the cavity around it is pushed out until it breaks through, and its outward side is opened
 *     (distance shortened by blister·max(0, (p-c)·n)), so the shell is a bowl, not a closed sphere. The envelope
 *     stays centred on the feature's position (equivalent to shifting the envelope away from the source, without
 *     moving the gas off the feature's catalogue position or growing the bounding sphere for the shift).
 *  R2 ionization front — x = 1 - smoothstep(f0, f1, (ds/Rs)·rho^(2/3)) (Stromgren: ionized where ds < Rs·rho^-2/3),
 *     emission ∝ rho²·x, [O III] from the same front variable.
 *  R3 dust only in neutral gas — k ∝ rho·(1 - x·dustDestroy).
 *  R4 triaxial, lobed outline — r = |pl / (R·axes)|, edge 1 + lobeAmp·(2·valueNoise(dir·lobeFreq + offset) - 1).
 */
function applyShapeV2(pack, history, t, { R, growth, cavityRadiusPc, softness }) {
  const ion = history.ionizing;
  const off = ion.offsetPc;
  const offLen = Math.hypot(off[0], off[1], off[2]);
  const n = offLen > 1e-9 ? off.map((c) => c / offLen) : [0, 0, 1];
  const axes = history.axes;
  const invAxes = axes.map((a) => 1 / a);
  const blister = clamp(history.blister * t.blisterScale, 0, 1);
  const lobeAmp = clamp(history.lobeAmp * t.lobeScale, 0, 0.9);
  // Distance from the centre to the (un-lobed) ellipsoid surface along n.
  const Rn = R / Math.hypot(n[0] * invAxes[0], n[1] * invAxes[1], n[2] * invAxes[2]);
  const srcDist = Math.min(offLen + 0.5 * blister * R, 0.8 * Rn);
  const cavDist = Math.max(srcDist, srcDist + (Rn - cavityRadiusPc - srcDist) * blister);
  // Front radius at mean density: the cavity IS the bubble the ionized gas blew, so the front sits just past its
  // wall (the cavity radius already grows with source strength ∝ Q^1/3 and with age). Denser wall gas has its front
  // nearer the source (rho^-2/3), so dense clumps get neutral cores with ionized skins.
  const frontRadiusPc = Math.max(1.15 * cavityRadiusPc, 0.2 * R) * clamp(t.frontScale, 0.05, 5);
  const fw = clamp(t.frontWidth, 0.02, 0.9);
  // Mean chord through the ellipsoid (geometric-mean axis), and <rho^2> = exp(sigma^2) for the lognormal field.
  const meanPath = 2 * R * Math.cbrt(axes[0] * axes[1] * axes[2]) * (1 - softness / 2);
  const lobeRng = new SeededRandom(`galactic-pack|${pack.featureId}|lobe-offset`);
  return {
    ...pack,
    shapeVersion: 2,
    boundRadiusPc: R * Math.max(axes[0], axes[1], axes[2]) * (1 + lobeAmp),
    cavity: { ...pack.cavity, centrePc: n.map((c) => c * cavDist) },
    ionizing: { ...pack.ionizing, centrePc: n.map((c) => c * srcDist) },
    emission: {
      ...pack.emission,
      scale: (t.targetLum * Math.sqrt(ion.strength)) / (meanPath * V2_ION_WEIGHT * Math.exp(t.sigma * t.sigma)),
    },
    shape: {
      invAxes,
      lobeAmp,
      lobeFreq: 2,
      lobeOffset: [0, 1, 2].map(() => NOISE_OFFSET_MIN + lobeRng.float() * NOISE_OFFSET_SPAN),
      openDir: n,
      blister,
      frontRadiusPc,
      front: [1 - fw, 1 + fw],
      frontClump: clamp(t.frontClump, 0, 1),
      dustDestroy: clamp(t.dustDestroy, 0, 1),
      // Scaled by blister: a young, closed region has no preferred side yet.
      wallGradient: t.wallGradient * blister,
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
