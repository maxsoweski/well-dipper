// tests/worldengine-base-magmatism-multiply.test.js
// Increment #4-MULTIPLY (world-engine-magmatism-multiply): the volcanic DRIVER-RESPONSE + grain-aligned
// edifices pass over the #4a skeleton. Mirrors #2's plate driver-response discipline: the per-body D-vector
// (bodyDrivers) is mapped to a `tune` override via magmaDriversToTune(), anchored so magmaDriversToTune(MAGMA_REF)
// === null → the writer runs #4a BYTE-IDENTICAL at the neutral reference (AC1).
//
// SLICE A (this file, first pass): AC1 byte-identity-at-reference + determinism of the mapper, AC2 monotone
// count/strength response, AC5 no-clobber (off-path magmaDiag null; volcanic bodyDrivers=null == #4a). The
// grain-anisotropy AC3 + the ordering-under-sweep AC4 land in SLICE B (edifice anisotropy), marked it.skip here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  writeMagmatismSphere, MAGMA_BOUND, MAGMA_DEFAULTS, MAGMA_REF, magmaThermal, magmaDriversToTune,
} from '../src/worldengine/base/magmatism.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import {
  buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS,
} from '../planet-lod-rivers.js';

const TARGET_N = 600, LLOYD = 2;
const SEEDS = [1, 2, 3, 7, 42];
const LOCKS = [false, true];
const MAGMA_SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/magmatism.js', import.meta.url)), 'utf8');
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
// The real shipped preset drivers (node-computed in BUILD-PLAN.md): raw Io-normalized tidal saturates clamp01.
const LAVA_DRIVERS = { tidalHeating: 7.82e5, massGravity: 0.80, volatileFraction: 0.02 };
const MAGMA_DRIVERS = { tidalHeating: 7.58e7, massGravity: 2.22, volatileFraction: 0.0 };
const meanOverMask = (U, mask) => { let s = 0, n = 0; for (let i = 0; i < U.length; i++) if (mask[i]) { s += U[i]; n++; } return n ? s / n : 0; };

// ── AC1 — byte-identical at the neutral reference + mapper determinism ────────────────────────────────
describe('#4-MULTIPLY AC1 — byte-identical at MAGMA_REF + determinism', () => {
  it('magmaDriversToTune returns null at the reference and for null drivers (the identity guard)', () => {
    expect(magmaDriversToTune(MAGMA_REF)).toBeNull();
    expect(magmaDriversToTune(null)).toBeNull();
    // magmaThermal(MAGMA_REF) is the exact H_REF the guard subtracts (Hd = 0) — self-consistent by construction.
    expect(magmaThermal(MAGMA_REF)).toBeGreaterThan(0);
    expect(magmaThermal(MAGMA_REF)).toBeLessThan(1);
  });

  it('at MAGMA_REF the writer reproduces #4a byte-for-byte (every seed x locked, T_ss exercised)', () => {
    for (const s of SEEDS) for (const L of LOCKS) {
      const T_ss = L ? 2800 : 0;
      // #4a baseline: the pre-#4-MULTIPLY call form (empty drivers, no tune).
      const cBase = carrierOf();
      const base = writeMagmatismSphere(cBase, {}, { macroSeed: s, locked: L, T_ss });
      // #4-MULTIPLY at the reference: bodyDrivers = MAGMA_REF, tune = magmaDriversToTune(MAGMA_REF) (=== null).
      const cRef = carrierOf();
      const ref = writeMagmatismSphere(cRef, MAGMA_REF, { macroSeed: s, locked: L, T_ss, tune: magmaDriversToTune(MAGMA_REF) });
      const tag = `seed ${s} locked ${L}`;
      expect(Array.from(cRef.height), `${tag}: carrier.height`).toEqual(Array.from(cBase.height));
      expect(Array.from(ref.U), `${tag}: U`).toEqual(Array.from(base.U));
      expect(Array.from(ref.edificeMask), `${tag}: edificeMask`).toEqual(Array.from(base.edificeMask));
      expect(Array.from(ref.lavaPlainMask), `${tag}: lavaPlainMask`).toEqual(Array.from(base.lavaPlainMask));
      expect(Array.from(ref.magmaOceanMask), `${tag}: magmaOceanMask`).toEqual(Array.from(base.magmaOceanMask));
      expect(Array.from(ref.A_e), `${tag}: A_e`).toEqual(Array.from(base.A_e));
      expect(Array.from(ref.Psi_e), `${tag}: Psi_e`).toEqual(Array.from(base.Psi_e));
      expect(ref.plumeCount, `${tag}: plumeCount`).toBe(base.plumeCount);
      for (let i = 0; i < ref.U.length; i++) expect(Math.abs(ref.U[i]), `${tag}: |U| bound`).toBeLessThan(MAGMA_BOUND);
    }
  });

  it('magmaDriversToTune is a pure deterministic mapper (no RNG / no clock) and its inputs are read-only', () => {
    expect(String(magmaDriversToTune)).not.toMatch(/Math\.random|Date\.now/);
    const before = JSON.stringify(LAVA_DRIVERS);
    magmaDriversToTune(LAVA_DRIVERS);
    expect(JSON.stringify(LAVA_DRIVERS)).toBe(before);             // never mutates the drivers
    expect(magmaDriversToTune(LAVA_DRIVERS)).toEqual(magmaDriversToTune(LAVA_DRIVERS));   // deterministic
  });

  it('while-count unchanged (still the single BFS drain) — no new convergence loop from the driver pass', () => {
    const whileCount = (MAGMA_SRC.match(/while\s*\(/g) || []).length;
    expect(whileCount).toBe(1);
    expect(MAGMA_SRC).not.toMatch(/Math\.random\s*\(/);
    expect(MAGMA_SRC).not.toMatch(/Date\.now\s*\(/);
  });
});

// ── AC2 — monotone count/strength response (correct sign) ─────────────────────────────────────────────
describe('#4-MULTIPLY AC2 — plume count/strength track thermal history (monotone, correct sign)', () => {
  it('at a fixed seed, rising thermal drive monotonically increases plume count AND mean edifice amplitude', () => {
    const H_REF = magmaThermal(MAGMA_REF);
    const sweep = [H_REF, 0.5, 0.8];                               // H0 = reference (tune null) < H1 < H2
    for (const s of SEEDS) {
      let lastCount = -Infinity, lastAmp = -Infinity;
      for (const H of sweep) {
        const c = carrierOf();
        const tune = magmaDriversToTune({ thermalState: H });      // no massGravity → gFactor = 1 (no confound)
        const diag = writeMagmatismSphere(c, { thermalState: H }, { macroSeed: s, locked: false, tune });
        const amp = meanOverMask(diag.U, diag.edificeMask);
        expect(diag.plumeCount, `seed ${s} H ${H}: plumeCount non-decreasing`).toBeGreaterThanOrEqual(lastCount);
        expect(amp, `seed ${s} H ${H}: mean edifice amplitude non-decreasing`).toBeGreaterThanOrEqual(lastAmp - 1e-9);
        lastCount = diag.plumeCount; lastAmp = amp;
      }
    }
  });

  it('the real shipped Lava/Magma drivers produce a NON-null tune (they sit off the reference → visible change)', () => {
    const tLava = magmaDriversToTune(LAVA_DRIVERS);
    const tMagma = magmaDriversToTune(MAGMA_DRIVERS);
    expect(tLava, 'Lava tune non-null').not.toBeNull();
    expect(tMagma, 'Magma tune non-null').not.toBeNull();
    expect(tLava.PLUME_COUNT_MIN).toBeGreaterThan(MAGMA_DEFAULTS.PLUME_COUNT_MIN);   // more plumes than the #4a floor
    // gravity secondary: low-g Lava builds TALLER shields, high-g Magma FLATTER (physical reliefGravityFactor).
    expect(tLava.EDIFICE_HEIGHT, 'Lava taller than Magma (low gravity)').toBeGreaterThan(tMagma.EDIFICE_HEIGHT);
  });
});

// ── AC5 — no-clobber + dispatch safety (the volcanic branch change is byte-safe off the reference path) ─
describe('#4-MULTIPLY AC5 — no-clobber + dispatch', () => {
  const relief = (c, opts) => writeBodyRelief(c, { grainDrivers: DEFAULT_GRAIN_DRIVERS, ...opts });

  it('off the volcanic path magmaDiag is null (plate / shell / despun), even though bodyDrivers is non-null', () => {
    for (const [arch, locked] of [['terrestrial', false], ['ocean', false], ['gas-giant', false]]) {
      const r = relief(carrierOf(), { archetype: arch, locked, bodyDrivers: MAGMA_DRIVERS, macroSeed: 3 });
      expect(r.magmaDiag, `${arch}: magmaDiag null off the volcanic path`).toBeNull();
    }
  });

  it('the volcanic path with bodyDrivers=null (existing callers) is byte-identical to the #4a writer', () => {
    for (const s of SEEDS) {
      const cVia = carrierOf();
      const via = relief(cVia, { archetype: 'lava', locked: true, bodyDrivers: null, macroSeed: s, T_eq: 950 });
      expect(via.path).toBe('volcanic');
      expect(via.magmaDiag.appliedTune, 'appliedTune null with null bodyDrivers').toBeNull();
      const cBase = carrierOf();
      writeMagmatismSphere(cBase, {}, { macroSeed: s, locked: true, T_ss: 950 * 1.4 });
      expect(Array.from(cVia.height), `seed ${s}: volcanic bodyDrivers=null == #4a`).toEqual(Array.from(cBase.height));
    }
  });

  it('the volcanic path with real drivers routes to volcanic and applies a non-null tune', () => {
    const r = relief(carrierOf(), { archetype: 'lava', locked: true, bodyDrivers: MAGMA_DRIVERS, macroSeed: 1, T_eq: 2000 });
    expect(r.path).toBe('volcanic');
    expect(r.magmaDiag.appliedTune, 'appliedTune non-null with real drivers').not.toBeNull();
  });
});
