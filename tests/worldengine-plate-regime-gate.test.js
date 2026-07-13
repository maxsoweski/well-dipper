// tests/worldengine-plate-regime-gate.test.js
// AC5 — the plate path is GATED by body regime and does NOT globally swap E6. Verified at the gate
// selector + the despun writers directly (headless), NOT via full route(). Non-Earth-like archetypes
// keep writeGrainSphere+writeHeightSphere BYTE-IDENTICAL; terrestrial/ocean get the plate writer. The
// gate reads an archetype/locked discriminator threaded from the lab/preset layer — it is NOT inside
// the three-free src/worldengine/base layer.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
// PRESET_ARCHETYPE-retirement (2026-07-13): the four label-keyed predicates are gone; the ~8 condition-less
// callers migrate to condition-bearing bundles (the shipped bundle17 / buildBundle idiom) that route to the
// SAME derived writer with the SAME args → byte-identical. deriveUniforms(fp, 1.0) === the golden QUALITY_TIER.
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';

const TARGET_N = 600, LLOYD = 2;
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
// A production-shaped condition-BEARING bundle for a representative preset (mirrors the dispatch-oracle's
// bundle17). The neutral body drivers sit at each writer's REF → *DriversToTune === null → byte-identical.
function condBundle(name, opts = {}) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return {
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    ...opts,
  };
}

// The byte-identical despun reference: EXACTLY what the despun path runs (same calls/args/seed).
function despunReference(macroSeed) {
  const c = carrierOf();
  const heightSeed = 'e6:' + (macroSeed | 0);
  writeGrainSphere(c, DEFAULT_GRAIN_DRIVERS);
  writeHeightSphere(c, {}, DEFAULT_GRAIN_DRIVERS, { name: 'tectonic-build' }, heightSeed);
  return c;
}

describe('AC5 — regime gate (Earth-like plate path vs despun zonal E6)', () => {
  // (R3, PRESET_ARCHETYPE-retirement) the `isEarthlikePlatePath` truth-table `it` is RETIRED with the predicate;
  // the derived plate route is now pinned by the dispatch-oracle's 17-preset table (Rocky/Ocean → plate).

  // NOTE (shell-relief increment): 'ice' now routes to the SHELL writer, not the despun fallback.
  // The despun byte-identity guarantee moved to genuinely-despun archetypes (impact-airless, gas-giant,
  // locked terrestrial) — see tests/worldengine-shell-regime-gate.test.js AC8.
  it('icy body (Europa) => SHELL path (no longer the sin^2 despun fallback)', () => {
    const seed = 7;
    const ref = despunReference(seed);
    const c = carrierOf();
    // M2: 'ice' archetype → Europa condition (cls icy, geodyn icy, shellSubRegime 'icy-active'); tune null at REF.
    const out = writeBodyRelief(c, condBundle('Europa (icy moon)', { macroSeed: seed, heightSeed: 'e6:' + seed }));
    expect(out.path).toBe('shell');
    expect(out.shellDiag).toBeTruthy();
    expect(out.shellDiag.regime).toBe('icy-active');
    expect(Array.from(c.height)).not.toEqual(Array.from(ref.height));   // the shell writer ran, not latitude bands
  });

  // (R2, PRESET_ARCHETYPE-retirement) the synthetic `'terrestrial' + locked → despun` case is RETIRED: it was a
  // bridge artifact (SHELL_EXCLUDE + locked-fallback null). No real preset is a locked 'terrestrial'; the derived
  // locked-temperate-rocky route is Eyeball → shell 'eyeball-despun' (rule 3b), pinned in the dispatch-oracle.

  it('terrestrial body (Rocky) => the plate writer runs and carrier.height DIFFERS from the despun E6 field', () => {
    const seed = 1;
    const ref = despunReference(seed);
    const c = carrierOf();
    // M3: 'terrestrial' archetype → Rocky condition (cls rocky, mobile → plate); driversToTune(neutral) === null.
    const out = writeBodyRelief(c, condBundle('Rocky (Earthlike)', { macroSeed: seed, heightSeed: 'e6:' + seed }));
    expect(out.path).toBe('plate');
    expect(out.plateDiag).toBeTruthy();
    expect(out.plateDiag.plateCount).toBeGreaterThanOrEqual(7);
    expect(Array.from(c.height)).not.toEqual(Array.from(ref.height));  // plate-placed, not latitude bands
  });

  it('the gate lives at the route()/lab boundary, NOT inside the three-free base layer', () => {
    // (R4, PRESET_ARCHETYPE-retirement) the deleted-predicate existence check is gone; the stronger invariant —
    // the regime-agnostic base modules carry no archetype/regime literal — is KEPT (more true than ever post-seam).
    const platesSrc = readFileSync(fileURLToPath(new URL('../src/worldengine/base/plates.js', import.meta.url)), 'utf8');
    const tectonicSrc = readFileSync(fileURLToPath(new URL('../src/worldengine/base/tectonic.js', import.meta.url)), 'utf8');
    for (const src of [platesSrc, tectonicSrc]) {
      expect(src).not.toMatch(/isEarthlikePlatePath/);
      expect(src).not.toMatch(/['"]terrestrial['"]/);
      expect(src).not.toMatch(/archetype/);
    }
  });
});
