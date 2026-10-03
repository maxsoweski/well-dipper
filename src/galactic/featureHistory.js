// featureHistory.js — L1 of the Galactic Engine: a nebula's STORY, derived from its GalacticMap record.
//
// ONE constructor: featureHistory(feature). The lab and the game both call it on real GalacticMap records
// (lab-wired-to-game rule 2). Headless and deterministic. Random draws come from feature-keyed Alea streams,
// one per field, so adding a field never reshuffles another — and GalacticMap's own RNG streams are never
// touched (its region generator would otherwise shift every feature in the galaxy).
//
// Units: lengths in pc, ages in Myr, metallicity in dex ([M/H]), dust-to-gas relative to solar (= 1).

import { SeededRandom } from '../generation/SeededRandom.js';

export const HISTORY_VERSION = 2; // 2: + blister, axes, lobeAmp (shape v2; render pack shapeVersion 1 ignores them)

/** Stable identity for a GalacticMap feature record (type + seed are unique per placement). */
export function featureKeyOf(feature) {
  return `${feature.type}:${feature.seed}`;
}

// Catalogue facts for known objects, used INSTEAD of GalacticMap's placeholders (every known object there
// carries age 10 / metallicity 0, which are fillers, not measurements). Keep entries sourced.
const CATALOG_FACTS = {
  // Orion Nebula Cluster is ~1-3 Myr old; Orion's gas is close to solar abundance. Trapezium (theta1 Ori C)
  // dominates the ionizing output; M42 is a blister on the near face of its cloud.
  // blister 0.9: M42 is the textbook blister H II region — an ionized bowl on the near face of the Orion
  // Molecular Cloud, open toward us (the standard model of the nebula; value is a display choice, not measured).
  M42: { ageMyr: 2, metallicity: 0.0, ionizingStrength: 1.0, sourceOffsetFrac: 0.35, blister: 0.9, note: 'ONC age ~1-3 Myr; near-solar gas; blister on the cloud face' },
};

// Assumed values when a known emission nebula has no catalogue entry: H II regions are young by definition.
const ASSUMED_KNOWN = { ageMyr: 3, metallicity: 0.0 };

function streamFor(key, field) {
  return new SeededRandom(`galactic-history|${key}|${field}`);
}

function unitVector(rng) {
  const z = rng.range(-1, 1);
  const phi = rng.range(0, Math.PI * 2);
  const s = Math.sqrt(Math.max(0, 1 - z * z));
  return [s * Math.cos(phi), z, s * Math.sin(phi)];
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/**
 * @param {object} feature — a GalacticMap feature record ({type, position, radius (kpc), seed, color, context, ...})
 * @returns {object} a plain, frozen-shape history record
 */
export function featureHistory(feature) {
  if (!feature || feature.type !== 'emission-nebula') {
    throw new Error(`featureHistory: S1 supports emission-nebula only (got ${feature && feature.type})`);
  }
  const key = featureKeyOf(feature);
  const isCatalog = !!feature.isKnownObject;
  const catalogKey = isCatalog ? (feature.knownProfile?.messier || feature.knownProfile?.ngc || String(feature.seed)) : null;
  const facts = isCatalog ? CATALOG_FACTS[catalogKey] || null : null;

  // ── Age and metallicity, with provenance ──
  let ageMyr, metallicity, ageSource, metallicitySource;
  if (isCatalog) {
    ageMyr = facts ? facts.ageMyr : ASSUMED_KNOWN.ageMyr;
    metallicity = facts ? facts.metallicity : ASSUMED_KNOWN.metallicity;
    ageSource = facts ? 'catalog' : 'assumed (GalacticMap placeholder ignored)';
    metallicitySource = facts ? 'catalog' : 'assumed (GalacticMap placeholder ignored)';
  } else {
    // GalacticMap context age is in Gyr (emission nebulae cap at 0.05 = 50 Myr).
    ageMyr = clamp((feature.context?.age ?? 0.005) * 1000, 0.5, 50);
    metallicity = feature.context?.metallicity ?? 0;
    ageSource = 'galacticmap-context';
    metallicitySource = 'galacticmap-context';
  }

  // ── Ionizing source: offset from the cloud centre (blister / champagne geometry), strength, hardness ──
  const radiusPc = feature.radius * 1000;
  const srcRng = streamFor(key, 'ionizing');
  const dir = unitVector(srcRng);
  const offsetFrac = facts?.sourceOffsetFrac ?? srcRng.range(0.1, 0.45);
  const armBoost = clamp(feature.context?.armStrength ?? 0.5, 0, 1);
  const strength = facts?.ionizingStrength ?? clamp(srcRng.range(0.4, 1.0) * (0.7 + 0.6 * armBoost), 0.2, 1.5);
  // Harder spectra (more [O III]) for younger clusters (O stars still alive) and lower metallicity (hotter stars).
  const hardness = clamp(0.25 + 0.5 * Math.exp(-ageMyr / 4) - 0.4 * metallicity + srcRng.range(-0.1, 0.1), 0, 1);

  // ── Dust and orientation ──
  const dustRng = streamFor(key, 'dust');
  const dustToGas = clamp(Math.pow(10, metallicity) * dustRng.range(0.8, 1.2), 0.1, 3);
  const oriRng = streamFor(key, 'orientation');
  const orientation = [oriRng.range(0, Math.PI * 2), Math.acos(oriRng.range(-1, 1)), oriRng.range(0, Math.PI * 2)];

  // ── Shape (render-pack shapeVersion 2; reshaping guide R1 + R4) ──
  // blister: how far the ionized cavity has broken out of the cloud (champagne flow). It takes a few Myr for an
  // H II region to reach the cloud surface, and a stronger source gets there sooner. Deterministic (no draw).
  const blister = facts?.blister ?? clamp(smoothstep(0.5, 4, ageMyr) * strength, 0, 1);
  // axes: the cloud is a triaxial blob, not a sphere (major axis = radiusPc); lobeAmp: low-frequency edge lobes.
  const shapeRng = streamFor(key, 'shape');
  const axes = [1, shapeRng.range(0.4, 0.9), shapeRng.range(0.25, 0.7)];
  const lobeAmp = shapeRng.range(0.2, 0.45);

  return {
    version: HISTORY_VERSION,
    kind: 'emission-nebula',
    featureId: key,
    seed: String(feature.seed),
    centreKpc: { x: feature.position.x, y: feature.position.y, z: feature.position.z },
    radiusPc,
    ageMyr,
    metallicity,
    ionizing: {
      offsetPc: dir.map((c) => c * offsetFrac * radiusPc),
      strength,
      hardness,
    },
    dustToGas,
    blister,
    axes,
    lobeAmp,
    orientation, // ZYZ Euler angles (rad): the noise frame relative to galactic axes
    provenance: {
      source: isCatalog ? 'catalog' : 'procedural',
      catalogKey,
      age: ageSource,
      metallicity: metallicitySource,
      note: facts?.note ?? null,
    },
  };
}
