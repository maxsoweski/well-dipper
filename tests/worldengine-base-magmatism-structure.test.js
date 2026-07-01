// tests/worldengine-base-magmatism-structure.test.js
// Increment 4a (world-engine-magmatism): the VOLCANIC / endogenic-heat relief writer
// (writeMagmatismSphere, magmatism.js) — sibling of plates.js / shellRelief.js for the Lava /
// Magma-K2-141b / Io-type bodies. Three-free, deterministic, generative-not-simulative.
//
// SLICE A (this file) covers the SCAFFOLD ACs: AC1 determinism / no-RNG / bounds, AC6 seed variety,
// and the dispatch ACs AC7 (no-clobber plate) / AC8 (no-clobber shell+despun) / AC9-headless (Lava &
// Magma route to path:'volcanic'). The relief-mechanism ACs — AC2 structure, AC3 latitude control,
// AC4 random-placement control, AC5 noise control, AC10 live probe — need mustFix #1 (the real
// edifice/lava-plain/magma-ocean assembly) and are SLICE B; they are marked it.skip below so they are
// visibly deferred, not silently missing.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeMagmatismSphere, MAGMA_BOUND, RELAX_PASSES, MAGMA_DEFAULTS } from '../src/worldengine/base/magmatism.js';
import { writePlateUpliftSphere } from '../src/worldengine/base/plates.js';
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import {
  buildIrregularSphere, writeBodyRelief, isVolcanicPath, isEarthlikePlatePath, isShellReliefPath,
  DEFAULT_GRAIN_DRIVERS,
} from '../planet-lod-rivers.js';

const TARGET_N = 600, LLOYD = 2;
const SEEDS = [1, 2, 3, 7, 42];
const LOCKS = [false, true];
const MAGMA_SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/magmatism.js', import.meta.url)), 'utf8');
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
const buildMagma = (macroSeed, locked) => {
  const c = carrierOf();
  const diag = writeMagmatismSphere(c, {}, { macroSeed, locked });
  return { c, diag };
};
const relief = (c, opts) => writeBodyRelief(c, { grainDrivers: DEFAULT_GRAIN_DRIVERS, ...opts });

// EXACT plate reference (same call/args/seed as the plate branch of writeBodyRelief) — the AC7 baseline.
function plateReference(macroSeed) {
  const c = carrierOf();
  writePlateUpliftSphere(c, DEFAULT_GRAIN_DRIVERS, { macroSeed });
  return c;
}
// EXACT despun reference (same calls/args/seed as the despun branch of writeBodyRelief) — the AC8 baseline.
function despunReference(macroSeed) {
  const c = carrierOf();
  const heightSeed = 'e6:' + (macroSeed | 0);
  writeGrainSphere(c, DEFAULT_GRAIN_DRIVERS);
  writeHeightSphere(c, {}, DEFAULT_GRAIN_DRIVERS, { name: 'tectonic-build' }, heightSeed);
  return c;
}

// ── AC1 — determinism / no-RNG / bounds / render-once ───────────────────────────────────────────────
describe('magmatism — AC1 determinism + no-RNG + bounds + render-once', () => {
  it('no-RNG static source guard: magmatism.js contains no Math.random / Date.now call', () => {
    expect(MAGMA_SRC).not.toMatch(/Math\.random\s*\(/);
    expect(MAGMA_SRC).not.toMatch(/Date\.now\s*\(/);
  });

  it('render-once: fixed relaxation bound, no convergence / time-step while-loop', () => {
    const { diag } = buildMagma(1, false);
    expect(diag.relaxPasses).toBe(RELAX_PASSES);
    expect(Number.isInteger(RELAX_PASSES)).toBe(true);
    expect(RELAX_PASSES).toBeGreaterThan(0);
    expect(RELAX_PASSES).toBeLessThanOrEqual(12);
    expect(MAGMA_SRC).toMatch(/for\s*\(let pass = 0; pass < PASSES;/);
    const whileCount = (MAGMA_SRC.match(/while\s*\(/g) || []).length;
    expect(whileCount).toBe(1);                          // the ONLY loop is the O(N) hotspot-distance BFS drain
    expect(MAGMA_SRC).toMatch(/while\s*\(qh < qt\)/);
    expect(MAGMA_SRC).not.toMatch(/while\s*\([^)]*(tol|eps|converg|residual|delta)/i);
  });

  it("uses the disjoint 'magma:' alea namespace (never 'plates:' / 'shell:' / 'e6:')", () => {
    expect(MAGMA_SRC).toMatch(/alea\('magma:/);
    expect(MAGMA_SRC).not.toMatch(/alea\('plates:/);
    expect(MAGMA_SRC).not.toMatch(/alea\('shell:/);
    expect(MAGMA_SRC).not.toMatch(/alea\('e6:/);
  });

  it('byte-identical determinism across seeds x locked (fresh carrier, run twice)', () => {
    for (const s of SEEDS) for (const L of LOCKS) {
      const a = buildMagma(s, L), b = buildMagma(s, L);
      expect(Array.from(a.c.height), `seed ${s} locked ${L}: carrier.height`).toEqual(Array.from(b.c.height));
      expect(Array.from(a.diag.U), `seed ${s} locked ${L}: U`).toEqual(Array.from(b.diag.U));
      expect(Array.from(a.diag.plumeId), `seed ${s} locked ${L}: plumeId`).toEqual(Array.from(b.diag.plumeId));
      expect(Array.from(a.diag.hotspotProximity), `seed ${s} locked ${L}: hotspotProximity`).toEqual(Array.from(b.diag.hotspotProximity));
      expect(Array.from(a.diag.hotspotNode), `seed ${s} locked ${L}: hotspotNode`).toEqual(Array.from(b.diag.hotspotNode));
      expect(Array.from(a.diag.substellarAxis), `seed ${s} locked ${L}: substellarAxis`).toEqual(Array.from(b.diag.substellarAxis));
      expect(a.diag.plumeCount).toBe(b.diag.plumeCount);
    }
  });

  it('REPLACE: carrier.height === returned U', () => {
    const { c, diag } = buildMagma(1, false);
    expect(Array.from(c.height)).toEqual(Array.from(diag.U));
  });

  it('finite + bounded (|U| < MAGMA_BOUND) + non-trivial, every seed x locked', () => {
    for (const s of SEEDS) for (const L of LOCKS) {
      const { diag } = buildMagma(s, L);
      let maxAbs = 0, finite = true;
      for (let i = 0; i < diag.U.length; i++) { const v = diag.U[i]; if (!Number.isFinite(v)) { finite = false; break; } maxAbs = Math.max(maxAbs, Math.abs(v)); }
      expect(finite, `seed ${s} locked ${L}: finite`).toBe(true);
      expect(maxAbs, `seed ${s} locked ${L}: maxAbs=${maxAbs.toFixed(3)} < ${MAGMA_BOUND}`).toBeLessThan(MAGMA_BOUND);
      expect(maxAbs, `seed ${s} locked ${L}: non-trivial`).toBeGreaterThan(0);
    }
  });

  it('MAGMA_DEFAULTS is frozen; plume count band is [PLUME_COUNT_MIN, +SPAN)', () => {
    expect(Object.isFrozen(MAGMA_DEFAULTS)).toBe(true);
    for (const s of SEEDS) {
      const { diag } = buildMagma(s, false);
      expect(diag.plumeCount).toBeGreaterThanOrEqual(MAGMA_DEFAULTS.PLUME_COUNT_MIN);
      expect(diag.plumeCount).toBeLessThan(MAGMA_DEFAULTS.PLUME_COUNT_MIN + MAGMA_DEFAULTS.PLUME_COUNT_SPAN);
    }
  });
});

// ── AC6 — seed variety (SLICE A: plume count + hotspot node placement) ──────────────────────────────
describe('magmatism — AC6 seed variety (plume field moves with the seed)', () => {
  const runs = [1, 2, 3, 4, 5].map((s) => {
    const { diag } = buildMagma(s, false);
    return { s, plumeCount: diag.plumeCount, hotspotNode: Array.from(diag.hotspotNode), plumeId: diag.plumeId };
  });

  // Overlap = |A∩B| / min(|A|,|B|) of the hotspot-node SETS. AC6 observable: different plumeCount OR
  // < 0.2 hotspot-node overlap for every seed pair (each seed independently reproducible — proven in AC1).
  it('two macroSeeds differ by plumeCount OR < 0.2 hotspotNode overlap (every pair)', () => {
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      const A = new Set(runs[i].hotspotNode), B = new Set(runs[j].hotspotNode);
      let inter = 0; for (const n of A) if (B.has(n)) inter++;
      const overlap = inter / Math.min(A.size, B.size);
      const differ = runs[i].plumeCount !== runs[j].plumeCount || overlap < 0.2;
      expect(differ, `seeds ${runs[i].s}-${runs[j].s}: plumeCount ${runs[i].plumeCount} vs ${runs[j].plumeCount}, hotspotNode overlap=${overlap.toFixed(3)}`).toBe(true);
    }
  });

  it('plume partition geometry differs substantively across the closest pair (> 30% reclassified)', () => {
    let minDisagree = 1;
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i].plumeId, b = runs[j].plumeId;
      let same = 0; for (let k = 0; k < a.length; k++) if (a[k] === b[k]) same++;
      minDisagree = Math.min(minDisagree, 1 - same / a.length);
    }
    expect(minDisagree, `worst-pair plumeId disagreement=${minDisagree.toFixed(3)}`).toBeGreaterThan(0.3);
  });
});

// ── AC7 — no-clobber of the Earth-like plate path (integration via writeBodyRelief) ─────────────────
describe('magmatism — AC7 no-clobber of the plate path', () => {
  it('terrestrial unlocked => path:plate, magmaDiag null, byte-identical to the plate baseline', () => {
    const seed = 1;
    const ref = plateReference(seed);
    const c = carrierOf();
    const out = relief(c, { archetype: 'terrestrial', locked: false, macroSeed: seed, heightSeed: 'e6:' + seed });
    expect(out.path).toBe('plate');
    expect(out.magmaDiag).toBe(null);
    expect(out.shellDiag).toBe(null);
    expect(out.plateDiag).toBeTruthy();
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('ocean unlocked => path:plate, magmaDiag null', () => {
    const c = carrierOf();
    const out = relief(c, { archetype: 'ocean', locked: false, macroSeed: 1, heightSeed: 'e6:1' });
    expect(out.path).toBe('plate');
    expect(out.magmaDiag).toBe(null);
  });
});

// ── AC8 — no-clobber of the shell + despun paths and dispatch safety ────────────────────────────────
describe('magmatism — AC8 no-clobber of shell + despun; isVolcanicPath gating', () => {
  it('Europa (ice) => path:shell, byte-identical, magmaDiag null', () => {
    const seed = 5;
    const c = carrierOf();
    const out = relief(c, { archetype: 'ice', locked: true, macroSeed: seed, heightSeed: 'e6:' + seed });
    expect(out.path).toBe('shell');
    expect(out.magmaDiag).toBe(null);
    expect(out.shellDiag).toBeTruthy();
    expect(out.shellDiag.regime).toBe('icy-active');
  });
  it('impact-airless unlocked => path:despun, byte-identical to the despun writers, magmaDiag null', () => {
    const seed = 7;
    const ref = despunReference(seed);
    const c = carrierOf();
    const out = relief(c, { archetype: 'impact-airless', locked: false, macroSeed: seed, heightSeed: 'e6:' + seed });
    expect(out.path).toBe('despun');
    expect(out.magmaDiag).toBe(null);
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('gas-giant => path:despun, byte-identical, magmaDiag null', () => {
    const seed = 3;
    const ref = despunReference(seed);
    const c = carrierOf();
    const out = relief(c, { archetype: 'gas-giant', locked: false, macroSeed: seed, heightSeed: 'e6:' + seed });
    expect(out.path).toBe('despun');
    expect(out.magmaDiag).toBe(null);
    expect(Array.from(c.height)).toEqual(Array.from(ref.height));
  });
  it('isVolcanicPath is FALSE for every non-volcanic archetype (only the volcanic set matches)', () => {
    for (const k of ['terrestrial', 'ocean', 'ice', 'volatile', 'eyeball', 'gas-giant', 'sub-neptune', 'carbon', 'crystal', 'impact-airless']) {
      expect(isVolcanicPath(k, false), `${k} unlocked`).toBe(false);
      expect(isVolcanicPath(k, true), `${k} locked`).toBe(false);
    }
    // sanity: the plate + shell predicates are unchanged by the volcanic addition
    expect(isEarthlikePlatePath('terrestrial', false)).toBe(true);
    expect(isShellReliefPath('ice', false)).toBe(true);
  });
});

// ── AC9 (headless part) — the Lava & Magma presets route to the volcanic regime ─────────────────────
// Both 'Lava (hot airless)' and 'Magma (K2-141b)' resolve to the short key 'lava' at the dispatch
// boundary (Lava directly; Magma via the PRESET_ARCHETYPE line added in the lab, since Magma is a
// NAMED_BODY with archetype null otherwise). Both presets are tidally locked. The live magmaOceanMask
// locked-vs-unlocked assertion is SLICE B.
describe('magmatism — AC9 (headless) Lava/Magma route to path:volcanic', () => {
  it("archetype 'lava' (Lava + Magma) routes to path:volcanic, locked or not", () => {
    for (const L of LOCKS) {
      const c = carrierOf();
      const out = relief(c, { archetype: 'lava', locked: L, macroSeed: 1234, heightSeed: 'e6:1234' });
      expect(out.path, `lava locked ${L}`).toBe('volcanic');
      expect(out.plateDiag).toBe(null);
      expect(out.shellDiag).toBe(null);
      expect(out.magmaDiag, `lava locked ${L}: magmaDiag`).toBeTruthy();
      expect(out.magmaDiag.plumeCount).toBeGreaterThan(0);
      expect(isVolcanicPath('lava', L)).toBe(true);
    }
  });
  it("the 'volcanic' short-key alias also routes to path:volcanic (unlocked)", () => {
    const c = carrierOf();
    const out = relief(c, { archetype: 'volcanic', locked: false, macroSeed: 9, heightSeed: 'e6:9' });
    expect(out.path).toBe('volcanic');
    expect(out.magmaDiag).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
// SLICE B — the relief mechanism (mustFix #1). Deferred, not missing:
//   AC2 structure bar (edifices at plume tops; |corr(U, arm's-length plume predictor)| >= 0.5;
//       mean(edifice) > mean(lava-plain) > mean(magma-ocean basin); edifice >= 2x quiet denominator)
//   AC3 latitude control (varExplainedByLatitudeY < 0.15 AND < varExplainedByPlume)
//   AC4 random-placement control (plume-decoupled placement collapses the signal)
//   AC5 noise control (real plume field beats amplitude-matched simplex noise)
//   AC10 live magmaProbe (Lava/Magma bake onto the carrier; plume-organized, not latitude)
// SLICE A ships a PLACEHOLDER U (a plume bump), so these would not be meaningful yet.
// ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('magmatism — SLICE B relief mechanism (mustFix #1)', () => {
  it.skip('AC2 structure: U explained by the plume field; edifice>plain>basin ordering (SLICE B)', () => {});
  it.skip('AC3 latitude control: U NOT explained by carrier +y latitude bands (SLICE B)', () => {});
  it.skip('AC4 random-placement control: decoupled placement collapses the structure (SLICE B)', () => {});
  it.skip('AC5 noise control: real field beats amplitude-matched simplex noise (SLICE B)', () => {});
  it.skip('AC10 live magmaProbe: plume-organized relief in the running lab (SLICE B / live)', () => {});
});
