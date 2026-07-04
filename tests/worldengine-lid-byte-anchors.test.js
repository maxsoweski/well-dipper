// tests/worldengine-lid-byte-anchors.test.js — World Engine V2-2a Slice B.
//
// The BYTE-IDENTITY CORE: routing the already-UAT'd Lava / Magma / Venus worlds through
// writeLidResponseSphere (src/worldengine/base/lidResponse.js) changes NOT A SINGLE BYTE of what the
// shipped corner writers produce. Dual-carrier Float32Array equality on the SAME mesh (the magmatism-structure
// "run twice" idiom, worldengine-base-magmatism-structure.test.js:78-100), reusing the golden fixture bundle
// (tests/fixtures/v2-0-carrier-golden.mjs :59-81), over seeds {1,2,3,7,42}.
//
//   • AC-BYTE-WEAK-REF  — MAGMA_REF (tune=null → the writer's untouched DEFAULTS branch) via the router ===
//                         writeMagmatismSphere(carrier, MAGMA_REF, {macroSeed, locked, T_ss, tune:null}) direct.
//   • AC-BYTE-LAVA      — the real Lava preset (tune≠null; T_ss = 950*1.4 = 1330 > LIQUIDUS → narrow basin).
//   • AC-BYTE-MAGMA     — the real Magma preset (tune≠null; T_ss = 2000*1.4 = 2800 ≫ LIQUIDUS → WIDE basin).
//   • AC-BYTE-STRONG-REF— Venus routes pure-strong; regime resolved ARCHETYPE-FREE → 'venus-stagnant-lid' ===
//                         writeStagnantLidReliefSphere(carrier, grainDrivers, {macroSeed, regime}) direct.
//   • AC-TSS-PRE-GATE   — the router forwards opts.T_ss verbatim: no internal *1.4, no T_eq read; the
//                         {locked}×{T_eq} matrix proves the basin is ordering-independent.
//   • AC-TUNE-NULL      — magmaDriversToTune(MAGMA_REF)===null; the router reuses the EXISTING builder and
//                         introduces no lidDriversToTune / stagnantDriversToTune symbol.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeLidResponseSphere } from '../src/worldengine/base/lidResponse.js';
import { writeMagmatismSphere, magmaDriversToTune, MAGMA_REF } from '../src/worldengine/base/magmatism.js';
import { writeStagnantLidReliefSphere, stagnantLidRegimeOf } from '../src/worldengine/base/stagnantLid.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { computeE1 } from '../src/worldengine/base/e1Regime.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { buildBundle, TARGET_N, LLOYD, SEEDS } from './fixtures/v2-0-carrier-golden.mjs';

// The shipped headless carrier harness (fixtures/v2-0-carrier-golden.mjs :98) — a deterministic irregular
// sphere (fibonacci + Lloyd, NO Math.random), so both carriers on each side see the IDENTICAL mesh.
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
const arr = (a) => Array.from(a);

// The magma-diag arrays the byte harness cross-checks (nested under rA.magmaDiag; flat on the direct return).
const MAGMA_DIAG_FIELDS = ['plumeId', 'A_e', 'Psi_e', 'magmaOceanMask', 'edificeMask', 'lavaPlainMask'];

// Router source (comments stripped) for the structural AC-TSS-PRE-GATE / AC-TUNE-NULL greps.
const LID_SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/lidResponse.js', import.meta.url)), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const LID_CODE = stripComments(LID_SRC);

// A minimal hand-set e1 that forces the pure-weak gate on m_hp alone (fires BEFORE L / rawTidal), so the
// MAGMA_REF DEFAULTS branch is exercised independent of a real condition vector (plan §4.5).
const weakE1 = { compositionClass: 'rocky', m_hp: 1, L: 0, geodynamicRegime: 'heat-pipe' };

// ── AC-BYTE-WEAK-REF — MAGMA_REF (tune=null DEFAULTS branch) ────────────────────────────────────────────
describe('V2-2a AC-BYTE-WEAK-REF — MAGMA_REF routes pure-weak, byte-identical to writeMagmatismSphere(tune:null)', () => {
  for (const locked of [false, true]) {
    for (const T_ss of [0, 2800]) {
      for (const seed of SEEDS) {
        it(`MAGMA_REF locked=${locked} T_ss=${T_ss} seed=${seed}: router === direct (DEFAULTS branch)`, () => {
          const cA = carrierOf();
          const rA = writeLidResponseSphere(cA, MAGMA_REF, { e1: weakE1, rawTidal: 0, macroSeed: seed, locked, T_ss });
          const cB = carrierOf();
          const rB = writeMagmatismSphere(cB, MAGMA_REF, { macroSeed: seed, locked, T_ss, tune: null });
          expect(rA.path).toBe('lid-weak');
          expect(rA.fineClass).toBe('pure-weak');
          expect(arr(cA.height), 'carrier.height').toEqual(arr(cB.height));
          expect(arr(cA.faultDensity), 'carrier.faultDensity').toEqual(arr(cB.faultDensity));
          for (const f of MAGMA_DIAG_FIELDS) expect(arr(rA.magmaDiag[f]), `magmaDiag.${f}`).toEqual(arr(rB[f]));
        });
      }
    }
  }
});

// ── AC-BYTE-LAVA — real Lava preset (tune≠null, narrow T_ss=1330 basin) ─────────────────────────────────
describe('V2-2a AC-BYTE-LAVA — the real Lava preset routes pure-weak, byte-identical (tune≠null, T_ss=1330)', () => {
  for (const seed of SEEDS) {
    it(`Lava seed ${seed}: router === writeMagmatismSphere direct (rivers:481-482)`, () => {
      const b = buildBundle('Lava (hot airless)', seed);
      const T_ss = b.locked ? (b.T_eq ?? 0) * 1.4 : 0;                 // rivers:476 verbatim; Lava 950 → 1330
      expect(T_ss).toBe(1330);                                          // 950*1.4 is exact in IEEE-754
      const e1 = computeE1(b.bodyDrivers.condition, seed);
      const rawTidal = b.bodyDrivers.condition.rawTidalIoRatio;
      const tune = magmaDriversToTune(b.bodyDrivers);
      expect(tune, 'Lava exercises the tune≠null path').not.toBeNull();
      // router
      const cA = carrierOf();
      const rA = writeLidResponseSphere(cA, b.bodyDrivers, { e1, rawTidal, macroSeed: seed, locked: b.locked, T_ss, grainDrivers: b.grainDrivers });
      // direct (rivers:481-482 verbatim)
      const cB = carrierOf();
      const rB = writeMagmatismSphere(cB, b.bodyDrivers, { macroSeed: seed, locked: b.locked, T_ss, tune: magmaDriversToTune(b.bodyDrivers) });
      expect(rA.fineClass).toBe('pure-weak');
      expect(arr(cA.height), 'carrier.height').toEqual(arr(cB.height));
      expect(arr(cA.faultDensity), 'carrier.faultDensity').toEqual(arr(cB.faultDensity));
      for (const f of MAGMA_DIAG_FIELDS) expect(arr(rA.magmaDiag[f]), `magmaDiag.${f}`).toEqual(arr(rB[f]));
    });
  }
});

// ── AC-BYTE-MAGMA — real Magma preset (tune≠null, WIDE T_ss=2800 magma-ocean basin) ─────────────────────
describe('V2-2a AC-BYTE-MAGMA — the real Magma preset routes pure-weak, byte-identical (wide T_ss=2800 basin)', () => {
  for (const seed of SEEDS) {
    it(`Magma seed ${seed}: router === direct incl. the wide magma-ocean basin`, () => {
      const b = buildBundle('Magma (K2-141b)', seed);
      const T_ss = b.locked ? (b.T_eq ?? 0) * 1.4 : 0;                 // rivers:476 verbatim; Magma 2000 → 2800
      expect(T_ss).toBe(2800);
      const e1 = computeE1(b.bodyDrivers.condition, seed);
      const rawTidal = b.bodyDrivers.condition.rawTidalIoRatio;
      expect(magmaDriversToTune(b.bodyDrivers), 'Magma exercises the tune≠null path').not.toBeNull();
      const cA = carrierOf();
      const rA = writeLidResponseSphere(cA, b.bodyDrivers, { e1, rawTidal, macroSeed: seed, locked: b.locked, T_ss, grainDrivers: b.grainDrivers });
      const cB = carrierOf();
      const rB = writeMagmatismSphere(cB, b.bodyDrivers, { macroSeed: seed, locked: b.locked, T_ss, tune: magmaDriversToTune(b.bodyDrivers) });
      expect(rA.fineClass).toBe('pure-weak');
      expect(arr(cA.height), 'carrier.height').toEqual(arr(cB.height));
      expect(arr(cA.faultDensity), 'carrier.faultDensity').toEqual(arr(cB.faultDensity));
      for (const f of MAGMA_DIAG_FIELDS) expect(arr(rA.magmaDiag[f]), `magmaDiag.${f}`).toEqual(arr(rB[f]));
      // the wide basin is genuinely present on BOTH sides (T_ss=2800 ≫ LIQUIDUS(1300)) — the case the
      // pre-gate T_ss requirement exists for.
      const oceanNodes = arr(rA.magmaDiag.magmaOceanMask).reduce((a, v) => a + (v ? 1 : 0), 0);
      expect(oceanNodes, `magma-ocean basin present seed ${seed}`).toBeGreaterThan(0);
      expect(arr(rA.magmaDiag.magmaOceanMask)).toEqual(arr(rB.magmaOceanMask));
      expect(rA.magmaDiag.thetaSea).toBe(rB.thetaSea);
      expect(rA.magmaDiag.D_flood).toBe(rB.D_flood);
    });
  }
});

// ── AC-BYTE-STRONG-REF — Venus (archetype-free regime resolution) ──────────────────────────────────────
describe('V2-2a AC-BYTE-STRONG-REF — Venus routes pure-strong, byte-identical (regime resolved archetype-free)', () => {
  for (const seed of SEEDS) {
    it(`Venus seed ${seed}: router === writeStagnantLidReliefSphere direct (grainDrivers + regime, rivers:491)`, () => {
      const b = buildBundle('Venus (sulfuric shroud)', seed);
      expect(b.locked, 'Venus is UNLOCKED (a slow retrograde rotator)').toBe(false);
      const e1 = computeE1(b.bodyDrivers.condition, seed);
      const rawTidal = b.bodyDrivers.condition.rawTidalIoRatio;
      expect(e1.geodynamicRegime, `Venus is the data-placed hot-high-L stagnant — e1 ${JSON.stringify(e1)}`).toBe('stagnant');
      // router
      const cA = carrierOf();
      const rA = writeLidResponseSphere(cA, b.bodyDrivers, { e1, rawTidal, macroSeed: seed, locked: b.locked, T_ss: 0, grainDrivers: b.grainDrivers });
      // direct (rivers:491 verbatim; drivers = grainDrivers, regime = 'venus-stagnant-lid')
      const cB = carrierOf();
      const rB = writeStagnantLidReliefSphere(cB, b.grainDrivers, { macroSeed: seed, regime: 'venus-stagnant-lid' });
      expect(rA.path).toBe('lid-strong');
      expect(rA.fineClass).toBe('pure-strong');
      expect(arr(cA.height), 'carrier.height').toEqual(arr(cB.height));
      expect(arr(cA.grainAngle), 'carrier.grainAngle').toEqual(arr(cB.grainAngle));   // stagnantLid writes grainAngle too
      expect(arr(cA.faultDensity), 'carrier.faultDensity').toEqual(arr(cB.faultDensity));
      // regime cross-check via the TEST-ONLY resolver (the router never imports/calls it):
      expect(rA.stagnantDiag.regime).toBe(stagnantLidRegimeOf('stagnant-lid', b.locked));  // === 'venus-stagnant-lid'
      expect(rA.stagnantDiag.regime).toBe('venus-stagnant-lid');
    });
  }
});

// ── AC-TSS-PRE-GATE — T_ss forwarded verbatim (no internal derivation on the weak path) ─────────────────
describe('V2-2a AC-TSS-PRE-GATE — the router forwards opts.T_ss verbatim (no internal *1.4 / no T_eq read)', () => {
  it('router source (comments stripped) computes NO T_ss: no `* 1.4`, no reference to T_eq', () => {
    expect(LID_CODE, 'no internal *1.4 derivation').not.toMatch(/\*\s*1\.4/);
    expect(LID_CODE, 'router never reads T_eq (it receives the precomputed T_ss)').not.toMatch(/\bT_eq\b/);
  });

  it('forwarded T_ss === locked?(T_eq??0)*1.4:0 across {locked}×{T_eq} (identity via byte-equal weak output)', () => {
    for (const locked of [false, true]) {
      for (const T_eq of [0, 950, 2000]) {
        const T_ss = locked ? (T_eq ?? 0) * 1.4 : 0;   // the reference expression (rivers:476)
        const cA = carrierOf();
        writeLidResponseSphere(cA, MAGMA_REF, { e1: weakE1, rawTidal: 0, macroSeed: 1, locked, T_ss });
        const cB = carrierOf();
        writeMagmatismSphere(cB, MAGMA_REF, { macroSeed: 1, locked, T_ss, tune: null });   // same T_ss, direct
        expect(arr(cA.height), `locked ${locked} T_eq ${T_eq} → T_ss ${T_ss}: basin ordering-independent`).toEqual(arr(cB.height));
      }
    }
  });
});

// ── AC-TUNE-NULL — weak-side reuses the existing magmaDriversToTune; no new tune builder ────────────────
describe('V2-2a AC-TUNE-NULL — the router reuses the EXISTING magmaDriversToTune (no new tune builder)', () => {
  it('magmaDriversToTune(MAGMA_REF) === null (the DEFAULTS-branch anchor behind AC-BYTE-WEAK-REF)', () => {
    expect(magmaDriversToTune(MAGMA_REF)).toBeNull();
  });

  it('the router imports magmaDriversToTune from magmatism.js and defines NO lidDriversToTune / stagnantDriversToTune', () => {
    // grep the CODE (comments stripped): the router legitimately NAMES the forbidden aliases in "we don't do
    // this" comments, but must not DEFINE or USE them in code.
    expect(LID_CODE).toMatch(/import\s*\{[^}]*\bmagmaDriversToTune\b[^}]*\}\s*from\s*['"]\.\/magmatism\.js['"]/);
    expect(LID_CODE, 'no new lidDriversToTune alias (grounding Q2)').not.toMatch(/lidDriversToTune/);
    expect(LID_CODE, 'no from-scratch stagnantDriversToTune (that is V2-2b)').not.toMatch(/stagnantDriversToTune/);
  });
});
