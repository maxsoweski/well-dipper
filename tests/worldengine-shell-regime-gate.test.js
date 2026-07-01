// tests/worldengine-shell-regime-gate.test.js
// Increment 1 (world-engine-shell-relief) — the 3-way dispatch in writeBodyRelief (AC7/AC8/AC9).
// AC7: earthlike (terrestrial/ocean unlocked) still routes to the plate writer, byte-identical.
// AC8: non-shell non-earthlike bodies keep the byte-identical despun path; a LOCKED gas/lava world
//      must NOT match the shell writer (SHELL_EXCLUDE dispatch safety).
// AC9: the icy/despun regimes route to the right shell tag, and the archetype=null+locked Europa
//      fall-through routes via the locked-fallback (never silently to sin^2).
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';
import { writePlateUpliftSphere } from '../src/worldengine/base/plates.js';
import { buildIrregularSphere, isEarthlikePlatePath, isShellReliefPath, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';

const TARGET_N = 600, LLOYD = 2;
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));

// EXACT despun reference (same calls/args/seed as the despun branch of writeBodyRelief).
function despunReference(macroSeed) {
  const c = carrierOf();
  const heightSeed = 'e6:' + (macroSeed | 0);
  writeGrainSphere(c, DEFAULT_GRAIN_DRIVERS);
  writeHeightSphere(c, {}, DEFAULT_GRAIN_DRIVERS, { name: 'tectonic-build' }, heightSeed);
  return c;
}
// EXACT plate reference (same call/args/seed as the plate branch of writeBodyRelief).
function plateReference(macroSeed) {
  const c = carrierOf();
  writePlateUpliftSphere(c, DEFAULT_GRAIN_DRIVERS, { macroSeed });
  return c;
}
const relief = (c, opts) => writeBodyRelief(c, { grainDrivers: DEFAULT_GRAIN_DRIVERS, ...opts });

describe('shell dispatch — AC7 no-clobber of the Earth-like plate path', () => {
  it('terrestrial unlocked => path:plate, shellDiag null, byte-identical to the plate baseline', () => {
    const seed = 1;
    const ref = plateReference(seed);
    const c = carrierOf();
    const out = relief(c, { archetype: 'terrestrial', locked: false, macroSeed: seed, heightSeed: 'e6:' + seed });
    expect(out.path).toBe('plate');
    expect(out.shellDiag).toBe(null);
    expect(out.plateDiag).toBeTruthy();
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('ocean unlocked => path:plate', () => {
    const c = carrierOf();
    const out = relief(c, { archetype: 'ocean', locked: false, macroSeed: 1, heightSeed: 'e6:1' });
    expect(out.path).toBe('plate');
    expect(out.shellDiag).toBe(null);
  });
});

describe('shell dispatch — AC8 no-clobber of the despun fallback + dispatch safety', () => {
  it('impact-airless unlocked => path:despun, byte-identical to the despun writers', () => {
    const seed = 7;
    const ref = despunReference(seed);
    const c = carrierOf();
    const out = relief(c, { archetype: 'impact-airless', locked: false, macroSeed: seed, heightSeed: 'e6:' + seed });
    expect(out.path).toBe('despun');
    expect(out.shellDiag).toBe(null);
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('SHELL_EXCLUDE: a LOCKED gas-giant => despun (NOT shell), byte-identical', () => {
    // gas-giant is in SHELL_EXCLUDE and is NOT volcanic, so a locked gas-giant still lands on despun.
    const seed = 3;
    const ref = despunReference(seed);
    const c = carrierOf();
    const out = relief(c, { archetype: 'gas-giant', locked: true, macroSeed: seed, heightSeed: 'e6:' + seed });
    expect(out.path).toBe('despun');
    expect(out.shellDiag).toBe(null);
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('SHELL_EXCLUDE: a LOCKED lava world => VOLCANIC (magmatism increment 4a; was despun before)', () => {
    // UPDATED for the magmatism increment: 'lava' is in SHELL_EXCLUDE so it falls through the shell
    // locked-fallback, and it is now claimed by isVolcanicPath — checked AFTER plate + shell. Before
    // 4a this asserted despun; the volcanic writer now owns the lava/Magma bodies.
    const c = carrierOf();
    const out = relief(c, { archetype: 'lava', locked: true, macroSeed: 3, heightSeed: 'e6:3' });
    expect(out.path).toBe('volcanic');
    expect(out.shellDiag).toBe(null);
    expect(out.magmaDiag).toBeTruthy();
  });
});

describe('shell dispatch — AC9 seam fires for the icy/despun regimes', () => {
  it('ice/eyeball/volatile route to the right normalized regime tag', () => {
    const cases = [['ice', false, 'icy-active'], ['eyeball', true, 'eyeball-despun'], ['volatile', false, 'volatile-cold']];
    for (const [archetype, locked, regime] of cases) {
      const c = carrierOf();
      const out = relief(c, { archetype, locked, macroSeed: 5, heightSeed: 'e6:5' });
      expect(out.path).toBe('shell');
      expect(out.plateDiag).toBe(null);
      expect(out.shellDiag).toBeTruthy();
      expect(out.shellDiag.regime).toBe(regime);
    }
  });
  it('Europa fall-through: archetype=null + locked => shell eyeball-despun (locked-fallback, never sin^2)', () => {
    const c = carrierOf();
    const out = relief(c, { archetype: null, locked: true, macroSeed: 5, heightSeed: 'e6:5' });
    expect(out.path).toBe('shell');
    expect(out.shellDiag.regime).toBe('eyeball-despun');
  });
  it('isShellReliefPath predicate agrees with the dispatch (and earthlike never matches)', () => {
    expect(isShellReliefPath('ice', false)).toBe(true);
    expect(isShellReliefPath(null, true)).toBe(true);
    expect(isShellReliefPath('gas-giant', true)).toBe(false);
    expect(isShellReliefPath('terrestrial', false)).toBe(false);
    expect(isEarthlikePlatePath('terrestrial', false)).toBe(true);  // sanity: earthlike gate unchanged
  });
});
