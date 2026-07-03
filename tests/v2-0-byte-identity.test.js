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
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { computeAllHashes, SEEDS } from './fixtures/v2-0-carrier-golden.mjs';
import { PRESET_ARCHETYPE } from '../driver-presets.js';
import { D_EARTH, driversToTune } from '../src/worldengine/base/plates.js';
import { MAGMA_REF, magmaDriversToTune } from '../src/worldengine/base/magmatism.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(path.resolve(__dirname, 'fixtures', 'v2-0-carrier-goldens.json'), 'utf8'));

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
      it(`carrier hash unchanged: "${name}" @ seed ${seed}`, () => {
        expect(recomputed[name][String(seed)]).toBe(GOLDEN.hashes[name][String(seed)]);
      });
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
