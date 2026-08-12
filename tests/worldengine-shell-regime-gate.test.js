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
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import { shellRegimeOf } from '../src/worldengine/base/shellRelief.js';   // SURVIVING resolver (writer-module export)
// PRESET_ARCHETYPE-retirement (2026-07-13): the label-keyed predicates are gone; the AC7/AC8/AC9 dispatch callers
// migrate to condition-bearing bundles routing to the SAME writers. deriveUniforms(fp,1.0)==QUALITY_TIER.
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';

const TARGET_N = 600, LLOYD = 2;
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
function condBundle(name, opts = {}) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return {
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    ...opts,
  };
}

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
    const out = relief(c, condBundle('Rocky (Earthlike)', { macroSeed: seed, heightSeed: 'e6:' + seed }));   // M14
    expect(out.path).toBe('plate');
    expect(out.shellDiag).toBe(null);
    expect(out.plateDiag).toBeTruthy();
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('ocean unlocked => path:plate', () => {
    const c = carrierOf();
    const out = relief(c, condBundle('Ocean (temperate)', { macroSeed: 1, heightSeed: 'e6:1' }));   // M14
    expect(out.path).toBe('plate');
    expect(out.shellDiag).toBe(null);
  });
});

describe('shell dispatch — AC8 no-clobber of the despun fallback + dispatch safety', () => {
  it('impact-airless (Mars) => path:despun, byte-identical to the despun writers', () => {
    const seed = 7;
    const ref = despunReference(seed);
    const c = carrierOf();
    const out = relief(c, condBundle('Mars (arid rocky)', { macroSeed: seed, heightSeed: 'e6:' + seed }));   // M15
    expect(out.path).toBe('despun');
    expect(out.shellDiag).toBe(null);
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('SHELL_EXCLUDE: a LOCKED gas world (Hot Jupiter) => despun (NOT shell), byte-identical', () => {
    // MIGRATED (PRESET_ARCHETYPE-retirement, was condition-less locked 'gas-giant'): the locked-gas-world →
    // despun semantic is the dispatch-oracle reroute #2 — Hot Jupiter (locked giant): cls gas → (1) despun,
    // the composition terminal firing before the locked check. despun ignores bodyDrivers → byte-identical.
    const seed = 3;
    const ref = despunReference(seed);
    const c = carrierOf();
    const out = relief(c, condBundle('Hot Jupiter (locked giant)', { macroSeed: seed, heightSeed: 'e6:' + seed }));
    expect(out.path).toBe('despun');
    expect(out.shellDiag).toBe(null);
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('a LOCKED lava world (Lava) => VOLCANIC (heat-pipe rule 3a, not the shell locked-fallback)', () => {
    // M16: Lava → cls rocky, m_hp>0 → (3a) unbrokenLid → router pure-weak → volcanic. The old 'lava'
    // SHELL_EXCLUDE fall-through is subsumed by the derived heat-pipe rule.
    const c = carrierOf();
    const out = relief(c, condBundle('Lava (hot airless)', { macroSeed: 3, heightSeed: 'e6:3' }));
    expect(out.path).toBe('volcanic');
    expect(out.shellDiag).toBe(null);
    expect(out.magmaDiag).toBeTruthy();
  });
});

describe('shell dispatch — AC9 seam fires for the icy/despun regimes', () => {
  it('Europa/Eyeball/Titan route to the right normalized shell sub-regime tag', () => {
    // M17: the short-key cases → the presets whose derived shellSubRegime is each tag (lens MF-2: Europa
    // 'icy-active' ≠ Titan 'volatile-cold'; Eyeball is the locked-temperate-rocky eyeball-despun via rule 3b).
    const cases = [['Europa (icy moon)', 'icy-active'], ['Eyeball (locked temperate)', 'eyeball-despun'], ['Titan (methane seas)', 'volatile-cold']];
    for (const [name, regime] of cases) {
      const c = carrierOf();
      const out = relief(c, condBundle(name, { macroSeed: 5, heightSeed: 'e6:5' }));
      expect(out.path, name).toBe('shell');
      expect(out.plateDiag, name).toBe(null);
      expect(out.shellDiag, name).toBeTruthy();
      expect(out.shellDiag.regime, name).toBe(regime);
    }
  });
  it('locked-temperate-rocky fall-through (Eyeball) => shell eyeball-despun; the surviving shellRegimeOf resolver agrees', () => {
    // MIGRATED (PRESET_ARCHETYPE-retirement, was condition-less archetype=null+locked): the derived analog of the
    // bridge's locked-fallback is the Eyeball adjudication — a locked temperate rocky routes shell 'eyeball-despun'
    // via rule (3b). Re-anchored to the SURVIVING shellRegimeOf resolver (R8: the deleted isShellReliefPath/
    // isEarthlikePlatePath predicate-agreement `it` is folded here as the surviving-resolver reference).
    const c = carrierOf();
    const out = relief(c, condBundle('Eyeball (locked temperate)', { macroSeed: 5, heightSeed: 'e6:5' }));
    expect(out.path).toBe('shell');
    expect(out.shellDiag.regime).toBe('eyeball-despun');
    // the surviving resolver the bridge locked-fallback used (writer-module export, blessed for test-oracle use):
    expect(shellRegimeOf('ice', false)).toBe('icy-active');
    expect(shellRegimeOf(null, true)).toBe('eyeball-despun');   // the locked destination is specifically eyeball-despun
    expect(shellRegimeOf('gas-giant', true)).toBe(null);        // a locked gas giant is NOT a shell body
  });
});
