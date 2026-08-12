// tests/fixtures/v2-0-carrier-golden.mjs — World Engine V2-0 AC1 carrier byte-identity CAPTURE HARNESS.
//
// PURPOSE (BUILD-PLAN §1 "Between A and B" + §3): build, for every archetype-mapped preset at fixed
// seeds, the SAME writeBodyRelief bundle the lab's route() feeds the writers, run writeBodyRelief on a
// fresh headless carrier, and SHA-256 every persistent carrier typed-array the writers can mutate. The
// hashes are committed to v2-0-carrier-goldens.json; the gate test (tests/v2-0-byte-identity.test.js)
// re-imports this harness and asserts the recomputed hashes still equal the committed goldens after each
// V2-0 slice. Byte-equality is the ZERO-behavioral-change gate (AC1).
//
// WHY a harness module (not an inline test): the bundle-reconstruction logic is SHARED between the
// one-time capture (run this file directly: `node tests/fixtures/v2-0-carrier-golden.mjs`) and the CI
// gate. Single source ⇒ capture and gate can never drift apart.
//
// CAPTURE POINT: run once on the post-Slice-A tree. Slice A relocated DRIVER_PRESETS / PRESET_ARCHETYPE /
// the neutral driver builder verbatim (byte-safety proven by tests/v2-0-slice-a-byte-safety.test.js),
// so post-A behavior == pre-change (ad156cc) behavior — the goldens validly encode pre-change carriers.
//
// CONDITION SUB-OBJECT (BUILD-PLAN §3 / R1): the COMMITTED golden (v2-0-carrier-goldens.json) was captured
// post-Slice-A, condition-LESS (deriveConditionVector did not exist yet). Slice C (now live) attaches the
// NESTED `condition:` to the gate-time bundle in buildBundle() below, exactly as the lab's buildBodyDrivers
// does. The committed (condition-less) golden vs the condition-bearing gate carrier staying byte-equal IS
// the proof that the widened bundle is inert (the tune builders read only flat keys and ignore the nested
// vector). Because `condition` is inert, re-running the direct-run capture (main) reproduces the identical
// golden bytes — the fixture does NOT need re-capturing for Slice C. See the marked seam in buildBundle().

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { makeSphereField } from '../../src/worldengine/base/sphereField.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../../planet-lod-rivers.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../../driver-presets.js';
import { buildNeutralBodyDrivers } from '../../body-drivers.js';
import { deriveConditionVector } from '../../src/worldengine/base/conditionVector.js';   // Slice C: attached at GATE time only (see buildBundle seam)
import { deriveUniforms } from '../../src/worldengine/base/labCore.js';

// The established headless carrier pattern (tests/planet-lod-rivers-swappable-uplift.test.js:15,18) —
// a deterministic irregular sphere. buildIrregularSphere uses fibonacci seeding + Lloyd relaxation with
// NO Math.random, so the mesh (hence every downstream write) is reproducible across capture and gate.
export const TARGET_N = 700;
export const LLOYD = 2;

// Fixed seeds per BUILD-PLAN §3. 15 archetype-mapped presets × 5 seeds = 75 (preset, seed) hashes.
export const SEEDS = [1, 2, 3, 7, 42];

// The lab's route() derives qualityTier from driverUI.qualityTier, which defaults to 1.0
// (planet-lod-lab.html:2671). deriveUniforms(fp, 1.0) is the SAME derive the lab's neutral path sees.
export const QUALITY_TIER = 1.0;

// The persistent carrier arrays the relief writers can mutate (BUILD-PLAN §3 step "Hash every persistent
// carrier typed-array"). Hashed in this FIXED order; flowAccum/baseLevel/standing/maturity are populated
// by the router (downstream of writeBodyRelief), not by the writers, so they are out of scope here.
export const HASHED_FIELDS = ['height', 'grainAngle', 'grainMag', 'regime', 'faultDensity'];

// Reconstruct the exact bundle the lab's route() passes to writeBodyRelief (planet-lod-lab.html
// :3623-3640 → planet-lod-rivers.js route() :1177-1199), sourced ONLY from the Slice-A modules so the
// harness exercises the SAME neutral construction the lab's runtime buildBodyDrivers builds on.
export function buildBundle(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, QUALITY_TIER);
  return {
    archetype: PRESET_ARCHETYPE[name],
    locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,          // lab route() leaves this at its default neutral bundle
    // ── SLICE C SEAM (now live): bodyDrivers carries the NESTED `condition` sub-object exactly as the
    //    lab's buildBodyDrivers attaches it (single-source deriveConditionVector). The COMMITTED golden
    //    (v2-0-carrier-goldens.json) was captured post-Slice-A, condition-LESS — so the gate re-running
    //    this condition-BEARING bundle and still matching byte-for-byte IS the proof that the widened
    //    bundle is inert (the tune builders read only flat keys; the nested vector is ignored). The lab
    //    passes state.planetRadiusEarth as the drawn radius; the headless harness uses fp.radiusEarth
    //    (R5 fallback) — inert for AC1 because condition.radiusEarth is never read by the writers. ──
    bodyDrivers: {
      ...buildNeutralBodyDrivers(u, fp),          // shared Slice-A neutral base (the SAME flat keys the golden captured)
      condition: deriveConditionVector(fp, u, fp.radiusEarth),   // Slice C: nested; inert vs the condition-less golden
    },
    macroSeed: seed,
    heightSeed: 'e6:' + (seed | 0),               // lab route() derives this from macroSeed (:1193)
    T_eq: (fp && fp.T_eq != null) ? fp.T_eq : 288,
  };
}

// SHA-256 over the concatenated little-endian bytes of the hashed carrier fields, in HASHED_FIELDS order.
// Node on the x86_64 dev/CI host is little-endian; the typed arrays are freshly allocated (byteOffset 0),
// so Buffer views them directly. Array lengths are fixed per run (same N), so the concatenation is
// unambiguous without delimiters.
export function hashCarrier(carrier) {
  const h = createHash('sha256');
  for (const f of HASHED_FIELDS) {
    const arr = carrier[f];
    h.update(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength));
  }
  return h.digest('hex');
}

// Build a fresh carrier, run writeBodyRelief with the reconstructed bundle, return its hash.
export function captureHash(name, seed) {
  const carrier = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
  writeBodyRelief(carrier, buildBundle(name, seed));
  return hashCarrier(carrier);
}

// Compute all 75 hashes: { [presetName]: { [seedString]: sha256hex } } over the 15 PRESET_ARCHETYPE keys.
export function computeAllHashes() {
  const out = {};
  for (const name of Object.keys(PRESET_ARCHETYPE)) {
    out[name] = {};
    for (const seed of SEEDS) out[name][String(seed)] = captureHash(name, seed);
  }
  return out;
}

export const GOLDEN_PATH = fileURLToPath(new URL('./v2-0-carrier-goldens.json', import.meta.url));

// Direct-run capture: (re)writes the committed golden fixture. Run ONLY on the pre-change-equivalent tree.
function main() {
  const hashes = computeAllHashes();
  const fixture = {
    _meta: {
      what: 'V2-0 AC1 carrier byte-identity goldens — SHA-256 per (preset, seed) over writeBodyRelief output.',
      capturedFrom: 'post-Slice-A tree (== pre-change ad156cc behavior; baseStep untouched, presets/archetype/neutral-builder relocated verbatim).',
      condition: 'NONE — captured without a condition sub-object (deriveConditionVector does not exist until Slice C).',
      targetN: TARGET_N, lloyd: LLOYD, seeds: SEEDS, qualityTier: QUALITY_TIER,
      hashedFields: HASHED_FIELDS,
      presetCount: Object.keys(PRESET_ARCHETYPE).length,
    },
    hashes,
  };
  writeFileSync(GOLDEN_PATH, JSON.stringify(fixture, null, 2) + '\n');
  const n = Object.keys(hashes).length * SEEDS.length;
  process.stdout.write(`wrote ${n} carrier hashes → ${path.basename(GOLDEN_PATH)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
