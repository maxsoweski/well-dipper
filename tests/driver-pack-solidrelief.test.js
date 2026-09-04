// tests/driver-pack-solidrelief.test.js — DRIVER PACK #11, the solid relief deck.
// Workstream solid-relief-deck (docs/WORKSTREAMS/solid-relief-deck/contract.json).
//
// ⛔ THE FIXTURES ARE PARENT CAPTURES AND ARE NOT REGENERATED TO MAKE THIS FILE PASS.
//   · tests/fixtures/solidrelief-pack-drivers-baseline.json — every pack's resolved drivers at
//     4d81784, BEFORE any src edit. It is this suite's only admissible expectation for "nothing
//     else moved", because it cannot have been written to match the new code.
//   · docs/WORKSTREAMS/solid-relief-deck/lab-parent-capture.json — the LAB's own live uniform and
//     state values, read out of Chrome at the parent across all 18 presets. Un-transcribed ground
//     truth for the four extracted laws: this suite compares the extracted MODULE against what the
//     PAGE was actually rendering, so a mis-transcription cannot pass by agreeing with itself.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { corpus, resolvedPacks, presetRows, MESH } from './fixtures/ray-pack-corpus.mjs';
import { labPackCtx } from '../src/objects/Planet.js';
import { PACKS, gatesFor, GATE_POLICY_ALL_ON } from '../src/worldengine/drivers/index.js';
import { resolveDriver, PackContractError } from '../src/worldengine/port/writePackUniforms.js';
import { deriveUniforms, reliefAxesFor, chasmaRiftsFor } from '../src/worldengine/base/labCore.js';
import { surfaceProcessesOf } from '../src/worldengine/base/surfaceProcesses.js';
import { solidReliefPack, SOLID_RELIEF_UNIFORMS, SOLID_RELIEF_GATES, SOLID_RELIEF_ENTRY } from '../src/worldengine/drivers/solidRelief.js';
import { DRIVER_PRESETS, drawPresetConditions } from '../driver-presets.js';

const root = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf8');
const J = JSON.stringify;

const BASELINE = JSON.parse(read('tests/fixtures/solidrelief-pack-drivers-baseline.json'));
const LAB = (() => {
  const raw = JSON.parse(read('docs/WORKSTREAMS/solid-relief-deck/lab-parent-capture.json'));
  return (typeof raw === 'string' ? JSON.parse(raw) : raw).presets;
})();

const CORPUS = corpus();
const SOLID = CORPUS.filter((b) => b.cls !== 'gas');
const GAS = CORPUS.filter((b) => b.cls === 'gas');
const ctxOf = (b) => labPackCtx(b.d, b.cond, MESH);
const packOf = (b) => resolvedPacks(b.cond, ctxOf(b)).solidRelief;

// The counts the scoping read recorded (docs/WORKSTREAMS/solid-relief-deck/POPULATION.md), which is
// the number Max was shown. A change here is a change to what the player sees and must be deliberate.
const EXPECTED_NONZERO = {
  uMountainAmp: 103, uChasmaDepth: 124, uScarpStrength: 122, uPlateauStrength: 124,
  uTesseraStrength: 46, uLavaCoverage: 103, uSubStrength: 37,
  uKarstDensity: 68, uDuneDensity: 68, uDustDepth: 68, uMassWastDensity: 124,
};

describe('solidRelief — §A ONE PIPELINE: one definition, both front-ends', () => {
  const MODULE = read('src/worldengine/base/surfaceProcesses.js');
  const LAB_HTML = read('world-engine-lab.html');
  const PACK = read('src/worldengine/drivers/solidRelief.js');

  it('the four extracted laws have exactly ONE live expression in the tree', () => {
    // The distinctive fragment of each law. The lab's copies are neutralised INSIDE `// ↳ MOVED`
    // comment lines (§10 line-stability keeps them as text), so the scan counts live CODE lines only.
    const liveLines = (src) => src.split('\n').filter((l) => !l.trim().startsWith('//'));
    const FRAGMENTS = [
      ['karst   ', /0\.4\s*\+\s*0\.6\s*\*\s*erosion|0\.4\s*\+\s*0\.6\s*\*\s*_erosion/],
      ['dryness ', /1\.0\s*-\s*0\.65\s*\*\s*(_)?stab/],
      ['fallout ', /0\.3\s*\+\s*0\.7\s*\*\s*(_)?erosion/],
      ['repose  ', /0\.9\s*\/\s*Math\.pow/],
    ];
    for (const [label, re] of FRAGMENTS) {
      const inModule = liveLines(MODULE).filter((l) => re.test(l)).length;
      const inLab = liveLines(LAB_HTML).filter((l) => re.test(l)).length;
      expect(inModule, `${label}: the module must hold the law`).toBeGreaterThanOrEqual(1);
      expect(inLab, `${label}: the lab must hold NO live copy`).toBe(0);
    }
  });

  it('both front-ends reach the module, and the LAB reaches it through the PACK', () => {
    // ⭐ THE LAB IMPORTS THE PACK, NOT THE BASE MODULE, and that topology is two fences' doing rather
    // than a preference. The first draft had the lab call `surfaceProcessesOf` directly;
    // tests/lab-surface-ratchet.test.js set 4 reddened on the helper hop and
    // tests/one-pipeline-fence.test.js registration 2 reddened because solidRelief.js was then in the
    // GAME's import closure and not the lab's. Both wanted the packed authoring path.
    expect(PACK).toMatch(/import \{ surfaceProcessesOf \} from '\.\.\/base\/surfaceProcesses\.js'/);
    expect(LAB_HTML).toMatch(/import \{ solidReliefPack, solidReliefLabState \} from '\.\/src\/worldengine\/drivers\/solidRelief\.js'/);
    expect(LAB_HTML).toMatch(/solidReliefPack\(deriveConditionVector\(_dp, u,/);
    expect(LAB_HTML).toMatch(/Object\.assign\(state, solidReliefLabState\(_sr\)\)/);
  });

  it('world-engine-lab.html holds its line count (§10 line-stability)', () => {
    expect(LAB_HTML.split('\n').length).toBe(6560);
  });

  it('⛔ three-free, no entropy, no preset name, no type label — in both new modules', () => {
    for (const [name, src] of [['surfaceProcesses', MODULE], ['solidRelief', PACK]]) {
      const live = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
      expect(live, `${name}: three`).not.toMatch(/from ['"]three['"]/);
      expect(live, `${name}: rng`).not.toMatch(/Math\.random|Date\.now/);
      expect(live, `${name}: type label`).not.toMatch(/\bd\.type\b|condition\.type\b/);
      for (const preset of Object.keys(DRIVER_PRESETS)) {
        expect(live, `${name}: preset name '${preset}'`).not.toContain(preset);
      }
    }
  });
});

describe('solidRelief — §B the extraction IS the lab (parent ground truth + liveness)', () => {
  const FIELDS = ['karstDensity', 'karstMaturity', 'duneDensity', 'dustDepth', 'massWastDensity', 'repose', 'ldaFat'];
  // The lab's block reads `_stab`/`_g` off the PER-SEED draw and the rest off the FROZEN preset, at
  // macroSeed 1 — the state the capture was taken in. Reproduced exactly so the compare is of the LAW.
  const labInputs = (name) => ({ fp: DRIVER_PRESETS[name], u: deriveUniforms(drawPresetConditions(name, 1), 1.0) });

  it('reproduces the LAB\'s own live values on all 18 presets × 7 fields, exactly', () => {
    for (const [name, cap] of Object.entries(LAB)) {
      const { fp, u } = labInputs(name);
      const got = surfaceProcessesOf(fp, u);
      for (const f of FIELDS) {
        expect(got[f], `${name}.${f}`).toBe(cap.state[f]);
      }
    }
  });

  it('[CONTROL] the compare is not vacuous — 6 of the 7 fields vary across the presets', () => {
    const distinct = Object.fromEntries(FIELDS.map((f) => [f, new Set()]));
    for (const name of Object.keys(LAB)) {
      const { fp, u } = labInputs(name);
      const got = surfaceProcessesOf(fp, u);
      for (const f of FIELDS) distinct[f].add(got[f]);
    }
    for (const f of FIELDS) {
      if (f === 'massWastDensity') {
        // ⚠ THE ONE DECLARED EXEMPTION. The lab's own law is a flat 1.0 on every solid world
        // (world-engine-lab.html, F19 block), so a constant here is the law, not a dead wire. Its
        // liveness is asserted by the population arm instead (124/124 carry it).
        expect(distinct[f].size, 'massWastDensity is the declared constant').toBe(1);
      } else {
        expect(distinct[f].size, `${f} must vary or the byte-compare proves nothing`).toBeGreaterThan(1);
      }
    }
  });

  it('[CONTROL] sabotaging each input REDS the compare (erosion / stability / h2-he)', () => {
    const bend = (fp, patch) => ({ ...fp, ...patch });
    const anyDiff = (mutate) => {
      for (const [name, cap] of Object.entries(LAB)) {
        const { fp, u } = labInputs(name);
        const got = surfaceProcessesOf(...mutate(fp, u));
        if (FIELDS.some((f) => got[f] !== cap.state[f])) return true;
      }
      return false;
    };
    expect(anyDiff((fp, u) => [bend(fp, { surfaceHistory: { ...(fp.surfaceHistory ?? {}), erosion: (fp.surfaceHistory?.erosion ?? 0) + 0.01 } }), u]),
      'erosion control must red').toBe(true);
    expect(anyDiff((fp, u) => [fp, { ...u, liquidStability: Math.min(1, (u.liquidStability ?? 0) + 0.01) }]),
      'liquid-stability control must red').toBe(true);
    expect(anyDiff((fp, u) => [bend(fp, { atmosphere: fp.atmosphere ? { ...fp.atmosphere, composition: fp.atmosphere.composition === 'h2-he' ? 'n2' : 'h2-he' } : fp.atmosphere }), u]),
      'no-solid-surface control must red').toBe(true);
  });

  it('⚠ the PRESSURE control needs a real move, not a nudge — and that is a recorded law-shape fact', () => {
    // smoothstep(0.05, 0.3, pressure) was written to ease dune/dust in with thickening air. MEASURED:
    // 0 of 18 presets and 1 of 124 corpus bodies sit inside (0.05, 0.3) — every other world is
    // floored or saturated, so the term is a BINARY switch in practice and a +0.01 nudge moves
    // nothing. Logged as a lab law-shape defect; this asserts the fact so it cannot rot silently.
    const inRamp = SOLID.filter((b) => {
      const a = b.cond.atmosphere;
      const p = a && a.retained !== false ? (a.pressure ?? 1.0) : 0;
      return p > 0.05 && p < 0.3;
    }).length;
    expect(inRamp, 'corpus bodies inside the pressure ramp interior').toBeLessThanOrEqual(2);
    // and a move THROUGH the ramp does bite, so the input is genuinely read:
    const fp = DRIVER_PRESETS['Rocky (Earthlike)'];
    const u = deriveUniforms(drawPresetConditions('Rocky (Earthlike)', 1), 1.0);
    const hi = surfaceProcessesOf(fp, u).duneDensity;
    const lo = surfaceProcessesOf({ ...fp, atmosphere: { ...fp.atmosphere, pressure: 0.02 } }, u).duneDensity;
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(0);
  });
});

describe('solidRelief — §C the population the player actually gets', () => {
  it('every solid body carries the pack; no gas body does', () => {
    for (const b of SOLID) expect(packOf(b), b.id).toBeTruthy();
    for (const b of GAS) expect(resolvedPacks(b.cond, ctxOf(b)).solidRelief, b.id).toBeFalsy();
  });

  it('the non-zero counts match the scoping read Max was shown', () => {
    const nz = {};
    for (const b of SOLID) {
      const d = packOf(b).drivers;
      for (const n of Object.keys(EXPECTED_NONZERO)) if (d[n] > 0) nz[n] = (nz[n] ?? 0) + 1;
    }
    for (const [n, want] of Object.entries(EXPECTED_NONZERO)) expect(nz[n] ?? 0, n).toBe(want);
  });

  it('⭐ THE SEEDED AXES VARY PER BODY — the wired-but-identical failure, asserted against', () => {
    // solidFeatures.js refused F10's axes because a condition carries no seed and every body would
    // land on the seed-0 orientation. This pack takes them off ctx instead; that is only worth doing
    // if they actually differ, so the difference is measured rather than assumed.
    for (const n of ['uOrogenyAxis', 'uScarpAxis', 'uChasmaAxis', 'uTesseraAxis', 'uLavaAxis']) {
      const seen = new Set(SOLID.map((b) => J(packOf(b).drivers[n])));
      expect(seen.size, `${n} distinct orientations over ${SOLID.length} bodies`).toBe(SOLID.length);
    }
  });

  it('[CONTROL — the fade] a condition at each law\'s zero end resolves to exactly 0', () => {
    const airless = { atmosphere: null, surfaceHistory: { erosion: 0 }, composition: { ironFraction: 0.3, volatileFraction: 0 }, T_eq: 300, radiusEarth: 1, surfaceGravity: 1 };
    const u = deriveUniforms(airless);
    const sp = surfaceProcessesOf(airless, u);
    expect(sp.karstDensity).toBe(0);   // airless ⇒ no solvent
    expect(sp.duneDensity).toBe(0);    // no air ⇒ no saltation
    expect(sp.dustDepth).toBe(0);      // no air ⇒ no fallout
  });
});

describe('solidRelief — §D nothing else moves', () => {
  it('every pre-existing driver of every pack is identical to the parent capture', () => {
    let compared = 0;
    for (const b of CORPUS) {
      const now = resolvedPacks(b.cond, ctxOf(b));
      const then = BASELINE.bodies[b.id].packs;
      for (const pk of Object.keys(then)) {
        expect(now[pk], `${b.id}: pack ${pk} vanished`).toBeTruthy();
        for (const n of Object.keys(then[pk].drivers)) {
          compared++;
          expect(J(now[pk].drivers[n]), `${b.id}.${pk}.${n}`).toBe(J(then[pk].drivers[n]));
        }
        expect(J(now[pk].attributes), `${b.id}.${pk} attributes`).toBe(J(then[pk].attributes));
      }
    }
    for (const { name, cond, ctx } of presetRows()) {
      const now = resolvedPacks(cond, ctx), then = BASELINE.presets[name];
      for (const pk of Object.keys(then)) {
        for (const n of Object.keys(then[pk].drivers)) {
          compared++;
          expect(J(now[pk].drivers[n]), `preset ${name}.${pk}.${n}`).toBe(J(then[pk].drivers[n]));
        }
      }
    }
    expect(compared, 'the compare must be wide, not vacuous').toBeGreaterThan(10000);
  });

  it('⛔ all 23 names were absent from every pack at the parent (the collision throw stays inert)', () => {
    expect(BASELINE.newNamesAlreadyWritten).toEqual([]);
    const others = new Set(BASELINE.packNamesEverSeen);
    for (const n of SOLID_RELIEF_UNIFORMS) expect(others.has(n), `${n} already written at parent`).toBe(false);
    // and live, over real outputs: no co-applying pack writes any of ours.
    const ours = new Set(SOLID_RELIEF_UNIFORMS);
    for (const b of SOLID.slice(0, 30)) {
      const all = resolvedPacks(b.cond, ctxOf(b));
      for (const [pk, r] of Object.entries(all)) {
        if (pk === 'solidRelief') continue;
        for (const n of Object.keys(r.drivers)) expect(ours.has(n), `${pk} collides on ${n}`).toBe(false);
      }
    }
  });

  it('the registry is 11 packs and solidRelief is APPENDED last (four assertions index positionally)', () => {
    expect(PACKS.length).toBe(11);
    expect(PACKS[PACKS.length - 1].name).toBe('solidRelief');
    expect(PACKS[0].name).toBe('giantDeck');
  });
});

describe('solidRelief — §E gates, and the master-only rule', () => {
  const b = SOLID[0];
  it('an OFF gate zeroes its master and NOTHING else', () => {
    const ctx = ctxOf(b);
    const allOn = { ...ctx, gates: gatesFor(SOLID_RELIEF_ENTRY, GATE_POLICY_ALL_ON) };
    const r = solidReliefPack(b.cond, allOn);
    const MASTER_OF = {
      mountains: 'uMountainAmp', canyons: 'uChasmaDepth', scarps: 'uScarpStrength',
      plateaus: 'uPlateauStrength', tessera: 'uTesseraStrength', lava: 'uLavaCoverage',
      sublimation: 'uSubStrength', karst: 'uKarstDensity', dunes: 'uDuneDensity',
      dust: 'uDustDepth', massWasting: 'uMassWastDensity',
    };
    for (const g of SOLID_RELIEF_GATES) {
      const off = { ...allOn, gates: { ...allOn.gates, [g]: false } };
      for (const n of Object.keys(r.drivers)) {
        const v = resolveDriver(n, r.drivers[n], off);
        if (n === MASTER_OF[g]) expect(v, `${g} off ⇒ ${n}`).toBe(0);
        else expect(J(v), `${g} off must not touch ${n}`).toBe(J(resolveDriver(n, r.drivers[n], allOn)));
      }
    }
  });

  it('every declared gate is answered by gatesFor and defaults ON', () => {
    const g = gatesFor(SOLID_RELIEF_ENTRY);
    for (const name of SOLID_RELIEF_GATES) expect(g[name], name).toBe(true);
  });
});

describe('solidRelief — §F the ctx contract, and the two recorded refusals', () => {
  it('⛔ THROWS when the front-end omits a seeded axis — never silently defaults', () => {
    const ctx = ctxOf(SOLID[0]);
    for (const k of ['chasmaAxes', 'orogenyAxis', 'scarpAxis', 'tesseraAxes', 'lavaAxis', 'chasmaCount']) {
      const missing = { ...ctx, [k]: undefined };
      expect(() => solidReliefPack(SOLID[0].cond, missing), k).toThrow(PackContractError);
    }
  });

  it('the axes on ctx ARE labCore\'s — one expression, two callers', () => {
    for (const b of SOLID.slice(0, 20)) {
      const ctx = ctxOf(b);
      const seed = ctx.macroSeed;
      expect(J(ctx.orogenyAxis)).toBe(J(reliefAxesFor(seed).orogenyAxis));
      expect(J(ctx.scarpAxis)).toBe(J(reliefAxesFor(seed).scarpAxis));
      expect(J(ctx.tesseraAxes)).toBe(J(reliefAxesFor(seed).tesseraAxes));
      expect(J(ctx.lavaAxis)).toBe(J(reliefAxesFor(seed).lavaAxis));
      expect(J(ctx.chasmaAxes)).toBe(J(chasmaRiftsFor(seed).chasmaAxes));
    }
  });

  it('⛔ F43 crystal facets and F46 bioluminescence are NOT emitted, and the measurement says why', () => {
    const emitted = new Set(SOLID_RELIEF_UNIFORMS);
    expect(emitted.has('uFacetStrength')).toBe(false);
    expect(emitted.has('uBioCoverage')).toBe(false);
    // F43: no generated body clears world-engine-lab.html's four-term facet predicate.
    const facetClass = SOLID.filter((b) => {
      const sh = b.cond.surfaceHistory ?? {};
      return !b.cond.atmosphere && (sh.erosion ?? sh.erosionLevel ?? 0) < 0.05
        && (sh.resurfacingRate ?? 0) < 0.05 && (sh.bombardmentIntensity ?? 0) < 0.2;
    }).length;
    expect(facetClass, 'F43 would forward a dead 0').toBe(0);
    // F46: the GATE is wide open — the recorded `habGate ≡ 0` was wrong — but the AMOUNT is a lab
    // slider with no law on either side, so forwarding it would author a constant.
    const habOpen = SOLID.filter((b) => (b.cond.habitability ?? 0) >= 0.4).length;
    expect(habOpen, 'F46 gate is open on 68 — held out for the missing law, not a dead gate').toBe(68);
  });

  it('⛔ the exotic-crust knockdown is measurably inert on generated worlds', () => {
    expect(SOLID.filter((b) => b.cls === 'carbon').length).toBe(0);
    expect(SOLID.filter((b) => b.cls === 'geometric').length).toBe(0);
  });
});
