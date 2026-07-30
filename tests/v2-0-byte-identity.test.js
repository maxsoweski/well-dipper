// tests/v2-0-byte-identity.test.js — World Engine V2-0 AC1 ZERO-behavioral-change GATE.
//
// Recomputes the 75 (preset, seed) carrier hashes via the shared capture harness and asserts each still
// equals the committed golden (tests/fixtures/v2-0-carrier-goldens.json, captured on the post-Slice-A ==
// pre-change tree). Run after EVERY V2-0 slice: any writer-visible drift on any of the 15 archetype-mapped
// presets — plate, shell, volcanic, stagnant-lid, or despun — moves a hash and fails here.
//
// This slice (between A and B) is the CAPTURE: the recompute trivially matches the just-written golden.
// It becomes load-bearing for Slice B (baseStep extraction — dormant on the carrier path, so must hold
// trivially) and Slice C (condition threading — the harness will attach a nested `condition` to the
// gate-time bundle while this golden stays condition-less; byte-equality then proves the widened bundle
// is inert). See tests/fixtures/v2-0-carrier-golden.mjs for the reconstruction + Slice-C seam.
//
// Anchor invariants (BUILD-PLAN §3 step 4): the two tune=null guards that hold the plate/volcanic
// byte-identity — driversToTune(D_EARTH) === null and magmaDriversToTune(MAGMA_REF) === null.
//
// V2-3 FROZEN CARVE-OUT (contract designDecision #2, Max-accepted 2026-07-11; BUILD-PLAN §5): the dispatch
// flip reroutes 'Frozen (airless)' shell→despun — the ONE adjudicated visible change. Its 5 golden rows are
// therefore asserted EQUAL to the DESPUN WRITER'S fresh output at the same seeds (an adjudicated-divergence
// assertion, NEVER a re-capture — the committed v2-0-carrier-goldens.json is immutable). The other 70 rows
// keep the strict golden compare and stay the zero-clobber burden-carriers. (Stripping `.condition` from the
// Frozen bundle would take the migration bridge back to shell:icy-active — the OLD route — so the reference
// MUST be the direct despun writers, not a condition-less re-run.)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { computeAllHashes, SEEDS, TARGET_N, LLOYD, hashCarrier, buildBundle } from './fixtures/v2-0-carrier-golden.mjs';
import { PRESET_ARCHETYPE } from '../driver-presets.js';
import { D_EARTH, driversToTune } from '../src/worldengine/base/plates.js';
import { MAGMA_REF, magmaDriversToTune } from '../src/worldengine/base/magmatism.js';
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';
import { buildIrregularSphere, DEFAULT_GRAIN_DRIVERS, writeBodyRelief } from '../planet-lod-rivers.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(path.resolve(__dirname, 'fixtures', 'v2-0-carrier-goldens.json'), 'utf8'));

// The ONE preset whose golden rows moved (the adjudicated V2-3 shell→despun reroute).
const FROZEN = 'Frozen (airless)';

// AC-PLATECOMP CARVE-OUT (Max-accepted 2026-07-29 "go with b, your rec"; contract amendments[3]).
// The composition→plate-count law moves 'Ocean (temperate)' — PLATE_COUNT_MIN 7 → 6 — and it is the
// ONLY preset it moves: of the 18 presets, only Rocky and Ocean reach the plate writer at all, and
// Rocky IS the byte-identity anchor (its authored R_core/R equals EARTH_CORE_RADIUS_FRACTION, so its
// factor is exactly 1). So this is a ONE-ROW adjudicated divergence.
const OCEAN = 'Ocean (temperate)';

// anchoredRef — Ocean's carrier hash with the ONE new driver forced back to the Earth anchor, and
// nothing else changed. WHY THIS AND NOT A RE-CAPTURE: Frozen's carve-out can assert equality against
// an INDEPENDENT writer (despunRef) because its reroute changed WHICH writer runs. Ocean runs the same
// plate writer with one tune field different, so it has no independent reference — asserting equality
// against a fresh run of the code under test would be CIRCULAR, and re-capturing the golden is
// forbidden (the committed JSON is immutable, see the header). Forcing coreRadiusFraction to the anchor
// must reproduce the IMMUTABLE golden EXACTLY, which proves the new field is the SOLE cause of the
// divergence — no other byte moved. That is a non-circular equality half sourced from the fixture.
function anchoredRef(name, seed) {
  const bundle = buildBundle(name, seed);
  bundle.bodyDrivers = { ...bundle.bodyDrivers, coreRadiusFraction: D_EARTH.coreRadiusFraction };
  const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
  writeBodyRelief(c, bundle);
  return hashCarrier(c);
}

// despunRef — the DESPUN WRITER'S fresh output at the same seed on a fresh carrier: the EXACT two lines the
// flipped despun branch runs for Frozen (writeGrainSphere + writeHeightSphere, DEFAULT_GRAIN_DRIVERS,
// heightSeed 'e6:'+seed — planet-lod-rivers.js despun()). Proves Frozen post-flip === the despun writer.
function despunRef(seed) {
  const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
  writeGrainSphere(c, DEFAULT_GRAIN_DRIVERS);
  writeHeightSphere(c, {}, DEFAULT_GRAIN_DRIVERS, { name: 'tectonic-build' }, 'e6:' + (seed | 0));
  return hashCarrier(c);
}

describe('V2-0 AC1 — carrier byte-identity vs the captured goldens', () => {
  const recomputed = computeAllHashes();
  const names = Object.keys(PRESET_ARCHETYPE);

  it('covers all 15 archetype-mapped presets × 5 seeds = 75 golden hashes', () => {
    expect(names.length).toBe(15);
    let count = 0;
    for (const name of names) {
      expect(GOLDEN.hashes).toHaveProperty(name);
      for (const seed of SEEDS) { expect(GOLDEN.hashes[name]).toHaveProperty(String(seed)); count++; }
    }
    expect(count).toBe(75);
  });

  for (const name of Object.keys(PRESET_ARCHETYPE)) {
    for (const seed of SEEDS) {
      if (name === FROZEN) {
        // V2-3 carve-out: Frozen's row equals the DESPUN writer's fresh output (adjudicated divergence) …
        it(`carrier hash = fresh despun-writer output (adjudicated V2-3 reroute): "${name}" @ seed ${seed}`, () => {
          expect(recomputed[name][String(seed)]).toBe(despunRef(seed));
        });
        // … and it really MOVED off the captured shell golden (the reroute is asserted AS a divergence,
        // never silently matched — if this ever equals the old golden, the flip has been undone).
        it(`carrier hash MOVED off the captured shell golden: "${name}" @ seed ${seed}`, () => {
          expect(recomputed[name][String(seed)]).not.toBe(GOLDEN.hashes[name][String(seed)]);
        });
      } else if (name === OCEAN) {
        // AC-PLATECOMP carve-out, two-sided like Frozen's but with a fixture-sourced reference.
        // (1) It really MOVED off the captured golden — the composition law is asserted AS a
        //     divergence, never silently matched. If this ever equals the golden again, either the
        //     law went inert or Ocean's authored R_core/R drifted to the anchor.
        it(`carrier hash MOVED off the captured golden (adjudicated AC-PLATECOMP): "${name}" @ seed ${seed}`, () => {
          expect(recomputed[name][String(seed)]).not.toBe(GOLDEN.hashes[name][String(seed)]);
        });
        // (2) …and the new driver is the SOLE cause: pin it back to the Earth anchor and the
        //     IMMUTABLE golden is reproduced byte-for-byte. This is what rules out the change having
        //     leaked into anything other than the plate count.
        it(`anchoring coreRadiusFraction restores the captured golden EXACTLY: "${name}" @ seed ${seed}`, () => {
          expect(anchoredRef(name, seed)).toBe(GOLDEN.hashes[name][String(seed)]);
        });
      } else {
        it(`carrier hash unchanged: "${name}" @ seed ${seed}`, () => {
          expect(recomputed[name][String(seed)]).toBe(GOLDEN.hashes[name][String(seed)]);
        });
      }
    }
  }
});

describe('V2-0 AC1 — tune-null anchor invariants (plate/volcanic byte-identity)', () => {
  it('driversToTune(D_EARTH) === null (Earth reference takes the untouched DEFAULTS branch)', () => {
    expect(driversToTune(D_EARTH)).toBeNull();
  });
  it('magmaDriversToTune(MAGMA_REF) === null (neutral reference takes the DEFAULTS branch)', () => {
    expect(magmaDriversToTune(MAGMA_REF)).toBeNull();
  });
});
