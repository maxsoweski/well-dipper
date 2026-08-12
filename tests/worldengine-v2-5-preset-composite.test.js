// tests/worldengine-v2-5-preset-composite.test.js — World Engine V2-5 SLICE-2 (render composite +
// Moon/Mercury impact-airless preset). Integration AC-PRESET + composite value-identity (BUILD-PLAN §7 SLICE 2 / §8).
//
//   AC-PRESET  — the new impact-airless preset exists (non-golden: in DRIVER_PRESETS, NOT in PRESET_ARCHETYPE)
//                and routes through the DERIVED dispatch to despun (dead-lid — §5's computeE1 arithmetic is the
//                oracle, live-run here) with a POPULATED craterField overprint. Frozen's 5/5 golden HEIGHT rows
//                stay byte-identical at N=700 — equal to the fresh despun writer (the V2-3 carve-out reference,
//                designDecision #2) — WITH craterField populated (the routed 'bumpy' answer). The cratered
//                NON-TRIVIALITY (variance>0, both signs) is the ≈40k assertion in the slice-1 suite (M-MF3),
//                deliberately NOT re-asserted on the N=700 golden rows where craters barely resolve.
//   COMPOSITE  — compositeMargins now sums BOTH unhashed overlay channels (height + shelfDepth + craterField),
//                null-tolerant (BS-m2): a world with BOTH overlays all-zero composites to null ⇒ render reuses
//                carrier.height byte-identically (the AC-LAB c value-identity path); a crater world composites
//                to a NON-null height+craterField surface; the V2-4 shelfDepth-only path is value-IDENTICAL
//                (adding an all-zero craterField changes nothing); carrier.height is NEVER mutated.
import { describe, it, expect } from 'vitest';

import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import {
  buildIrregularSphere, writeBodyRelief, compositeMargins, DEFAULT_GRAIN_DRIVERS,
} from '../planet-lod-rivers.js';
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { buildBundle, hashCarrier, TARGET_N, LLOYD, SEEDS } from './fixtures/v2-0-carrier-golden.mjs';

const NEW_PRESET = 'Moon/Mercury (impact-airless)';

// The lab's route() bundle (condition-BEARING), mirroring tests/worldengine-v2-5-bombardment.test.js.
function reliefBundle(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return {
    archetype: PRESET_ARCHETYPE[name] ?? null, locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    macroSeed: seed, heightSeed: 'e6:' + seed, T_eq: fp.T_eq ?? 288,
  };
}

// despunRef — the DESPUN writer's fresh output at a seed (writeGrainSphere + writeHeightSphere, exactly the
// two lines the flipped despun branch runs — planet-lod-rivers.js despun()); the V2-3 Frozen carve-out
// reference (tests/v2-0-byte-identity.test.js). Frozen post-flip === this, with the crater overprint layered
// onto the (unhashed) craterField channel only ⇒ the HASHED_FIELDS hash is unmoved.
function despunRef(seed) {
  const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
  writeGrainSphere(c, DEFAULT_GRAIN_DRIVERS);
  writeHeightSphere(c, {}, DEFAULT_GRAIN_DRIVERS, { name: 'tectonic-build' }, 'e6:' + (seed | 0));
  return hashCarrier(c);
}

const anyNonzero = (arr) => { for (let i = 0; i < arr.length; i++) if (arr[i] !== 0) return true; return false; };

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5 AC-PRESET — Moon/Mercury routes dead-lid despun with a live crater overprint (non-golden)', () => {
  it('the preset exists in DRIVER_PRESETS but is NOT a golden carrier (absent from PRESET_ARCHETYPE)', () => {
    expect(DRIVER_PRESETS).toHaveProperty(NEW_PRESET);
    // the 75-golden carrier loop iterates Object.keys(PRESET_ARCHETYPE) — Moon/Mercury must NOT be there,
    // so the immutable golden fixture never sees it (LANDMINE #2; fixtures git-diff-empty).
    expect(PRESET_ARCHETYPE).not.toHaveProperty(NEW_PRESET);
  });

  it('routes through the derived dispatch to despun with craterField populated — every seed (§5 oracle)', () => {
    for (const seed of SEEDS) {
      const carrier = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
      const r = writeBodyRelief(carrier, reliefBundle(NEW_PRESET, seed));
      expect(r.path, `${NEW_PRESET} @ seed ${seed} routes despun (dead-lid, §5 arithmetic)`).toBe('despun');
      // isImpactSurface (airless + dead + cold) fires ⇒ the bombardment writer stamped the crater channel
      expect(anyNonzero(carrier.craterField), `${NEW_PRESET} @ seed ${seed} craterField populated`).toBe(true);
    }
  });

  it("Frozen 5/5 golden HEIGHT rows stay byte-identical (== fresh despun writer) WITH craterField populated (the 'bumpy' answer)", () => {
    for (const seed of SEEDS) {
      const carrier = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
      writeBodyRelief(carrier, buildBundle('Frozen (airless)', seed));   // the exact golden-harness bundle
      // the crater overprint moved NO hashed field — the HASHED_FIELDS hash equals the V2-3 carve-out
      // reference (own-channel discipline; craterField is unhashed, route() bypassed by the golden path).
      expect(hashCarrier(carrier), `Frozen @ seed ${seed} HASHED_FIELDS byte-identical`).toBe(despunRef(seed));
      // and Frozen fires the gate (airless + dead + cold) ⇒ the overprint is live on its own channel.
      expect(anyNonzero(carrier.craterField), `Frozen @ seed ${seed} craterField populated`).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5 composite — compositeMargins sums both unhashed overlays, null-tolerant, value-identical on non-targets', () => {
  // Synthetic carriers with hand-set channels isolate the pure compositeMargins logic (BS-m2 null-tolerance +
  // exact value-identity). float32 rounding is matched via Math.fround so the composite is asserted EXACTLY.
  const N = 64;
  const baseHeight = () => { const h = new Float32Array(N); for (let i = 0; i < N; i++) h[i] = Math.sin(i * 0.37) * 0.3; return h; };
  const ramp = (scale) => { const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = ((i % 7) - 3) * scale; return a; };
  const zeros = () => new Float32Array(N);

  it('BOTH overlays all-zero ⇒ null (the byte-identical render path — route() reuses carrier.height)', () => {
    const carrier = { count: N, height: baseHeight(), shelfDepth: zeros(), craterField: zeros() };
    expect(compositeMargins(carrier)).toBeNull();
  });

  it('shelfDepth-only path is VALUE-IDENTICAL to V2-4 (out = height + shelfDepth; all-zero craterField adds nothing)', () => {
    const h = baseHeight(), sd = ramp(0.05), cf = zeros();
    const out = compositeMargins({ count: N, height: h, shelfDepth: sd, craterField: cf });
    expect(out).toBeInstanceOf(Float32Array);
    for (let i = 0; i < N; i++) expect(out[i], `[${i}]`).toBe(Math.fround(h[i] + sd[i]));   // == the V2-4 formula, exactly
    // control: the SAME carrier with NO craterField field at all composites to the identical bytes (BS-m2)
    const outNoCf = compositeMargins({ count: N, height: h, shelfDepth: sd });
    for (let i = 0; i < N; i++) expect(outNoCf[i], `null-tolerant [${i}]`).toBe(out[i]);
  });

  it('craterField-only path composites the overprint (out = height + craterField; non-null)', () => {
    const h = baseHeight(), sd = zeros(), cf = ramp(0.04);
    const out = compositeMargins({ count: N, height: h, shelfDepth: sd, craterField: cf });
    expect(out).not.toBeNull();
    for (let i = 0; i < N; i++) expect(out[i], `[${i}]`).toBe(Math.fround(h[i] + cf[i]));
  });

  it('both overlays populated ⇒ out = height + shelfDepth + craterField; carrier.height never mutated', () => {
    const h = baseHeight(), hCopy = Float32Array.from(h), sd = ramp(0.05), cf = ramp(0.04);
    const carrier = { count: N, height: h, shelfDepth: sd, craterField: cf };
    const out = compositeMargins(carrier);
    for (let i = 0; i < N; i++) expect(out[i], `[${i}]`).toBe(Math.fround(h[i] + sd[i] + cf[i]));
    expect(out).not.toBe(carrier.height);                       // a distinct array
    for (let i = 0; i < N; i++) expect(carrier.height[i]).toBe(hCopy[i]);   // source height untouched
  });

  it('null shelfDepth ⇒ null (the existing V2-4 first-guard is preserved)', () => {
    expect(compositeMargins({ count: N, height: baseHeight(), craterField: ramp(0.04) })).toBeNull();
  });

  it('REAL pipeline: a non-target world (Jovian) composites to null; a crater world (Moon/Mercury) composites non-null', () => {
    const jov = makeSphereField(buildIrregularSphere(2000, 2));
    writeBodyRelief(jov, reliefBundle('Gas giant (Jovian)', 1));      // despun gas, no plates, atmo present ⇒ neither overlay fires
    expect(anyNonzero(jov.craterField), 'Jovian craterField all-zero (gate: atmosphere present)').toBe(false);
    expect(compositeMargins(jov), 'Jovian composites null ⇒ byte-identical render').toBeNull();

    const moon = makeSphereField(buildIrregularSphere(2000, 2));
    writeBodyRelief(moon, reliefBundle(NEW_PRESET, 1));
    const out = compositeMargins(moon);
    expect(out, 'Moon/Mercury composites a non-null crater surface').not.toBeNull();
    const h = moon.height, sd = moon.shelfDepth, cf = moon.craterField;
    for (let i = 0; i < out.length; i++) expect(out[i]).toBe(Math.fround(h[i] + (sd ? sd[i] : 0) + cf[i]));
  });
});
