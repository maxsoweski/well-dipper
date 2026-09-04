// tests/driver-pack-fluvialdeck.test.js — DRIVER PACK #9, `fluvialDeck`: the lab's F11/F12/F13/F14/F20
// derivation (world-engine-lab.html:2127-2167) as ONE law both front-ends call.
// docs/WORKSTREAMS/wire-river-router-lab-into-game/ task 3, 2026-09-02.
//
// ⚠ ALWAYS `npx vitest run --dir tests` — without --dir a stale worktree copy under .claude/ doubles
// every count (handoff 2026-08-28).
//
// WHAT THIS FILE IS FOR. Ten uniforms were DECLARED on the lab material
// (src/worldengine/shaders/uniforms.js:310-344) and written by NO pack, so every solid body the game
// swaps onto that material carried the factory default for the whole fluvial family: uSeaLevel -1,
// uCoastStrength 0, uOutflowDensity 0, uLiquidMask 0. Nothing here is a law CHOICE — the law is the
// lab's block, already shipped and already judged — so every assertion is about the WIRE, and the one
// thing a wiring commit can get wrong is RE-DERIVING the law on the way through. §C exists to stop
// exactly that: it transcribes the lab's eleven expressions INDEPENDENTLY and compares to the last bit
// over the whole corpus.
//
// ⛔ THE `uFluvialDensity` UNIFORM IS NOT IN THE PACK, and that is a fact about the LAB, not a gap
// here: world-engine-lab.html:5518 pins it to 0.0 on every frame (the retired worm-trail). The
// DENSITY still travels — as `meta.fluvialDensity` and as the `fluvialDensity` field of the lab
// mirror, because F12 deltas are derived from it. §D pins the uniform's absence by name.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
// ⭐ §H's imports (2026-09-02, the final review's ruling #1). The seam being measured is the LAB's, so
// both arms are reached through the LAB's own modules: `driver-presets.js` is the root module the lab
// imports at world-engine-lab.html:1941, and `deriveConditionVector` is the seam :2136 now goes through.
import { DRIVER_PRESETS, PRESET_NAMES, drawPresetConditions, drawPresetRadius } from '../driver-presets.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { PACKS, selectPacks, applyDriverPacks, gatesFor } from '../src/worldengine/drivers/index.js';
import { buildLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import { labPackCtx, setLabGasBodiesOverride } from '../src/objects/Planet.js';
import { isPackDriver, resolveDriver, scalar, PackContractError } from '../src/worldengine/port/writePackUniforms.js';
import {
  fluvialDeckPack, FLUVIAL_DECK_ENTRY, FLUVIAL_DECK_UNIFORMS, FLUVIAL_DECK_LAB_BINDING,
  fluvialDeckLabState, fluvialDeckDirectDrivers, fluvialClassOf,
  DELTAS_GATE, COAST_GATE, OUTFLOW_GATE,
} from '../src/worldengine/drivers/fluvialDeck.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const TMP = process.env.TMPDIR || tmpdir();

// ── The corpus: the appendix's 24 rocky-* seeds, planets + moons, each with its condition ─────────
// ⚠ A planet in `sys.planets` is an ENTRY wrapping `planetData` (handoff 2026-09-01b trap 1) — pass
// the entry and every provenance-keyed read is wrong. `e.planetData || e` is the province suite's own
// idiom (tests/province-bake-host.test.js:46).
const SEEDS = Array.from({ length: 24 }, (_, i) => `rocky-${i}`);
function corpus() {
  const out = [];
  for (const seed of SEEDS) {
    const sys = StarSystemGenerator.generate(seed, null);
    for (const e of sys.planets) {
      out.push({ seed, kind: 'planet', d: e.planetData || e });
      for (const m of (e.moons || [])) out.push({ seed, kind: m.isPlanetMoon ? 'planet-moon' : 'moon', d: m.isPlanetMoon ? { ...m.planetData, _systemSeed: m._systemSeed, _ordinal: `pm-${m._ordinal}` } : m });   // ⛔ a PLANET-CLASS moon is an ENTRY wrapping planetData too (trap 3; found by the 2026-09-02 live check): read through the wrapper its T_eq defaults to 288 K and it classes wet. The game mounts the INNER record with the provenance stamps copied on (src/main.js:7757 `_systemSeed: systemData.seed, _ordinal: `pm-${moonData._ordinal}``) — mirrored here, minus the render-only fields
    }
  }
  for (const b of out) b.cond = conditionFromBody(b.d);
  return out;
}
let BODIES = null;
beforeAll(() => { setLabGasBodiesOverride(true); BODIES = corpus(); });

const CTX = { displayRadiusEarth: 1, animRate: 1, relevance: {}, gates: { deltas: true, coast: true, outflow: true } };
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ss = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// §C — THE LAB'S FORMULAS, TRANSCRIBED INDEPENDENTLY from world-engine-lab.html:2127-2167 (at 8bb8e1c)
// and evaluated on the SAME condition the pack is handed. This is the only block that could catch a
// re-derivation, so it is written from the lab text and NOT from the pack's source.
//   :2128 `const _erosion = _fp.surfaceHistory?.erosion ?? 0;`   (+ ROOT-0 fix 1's second spelling — see §F)
//   :2129 `const _stab = u.liquidStability, _rain = u.precipitation, _g = u.surfaceGravity;`
//   :2131 `const _wet = _stab > 0.15;`
//   :2135 `const _hadLiquid = !!(_fp.atmosphere && _fp.atmosphere.retained !== false);`
//   :2136 `state.fluvialActivity = _wet ? 1.0 : _clamp01(_erosion);`
//   :2137 `state.fluvialDensity  = _wet ? _clamp01(_stab * (0.3 + 0.7 * _rain)) : (_hadLiquid ? 0.4 * _clamp01(_erosion) : 0.0);`
//   :2139 `state.fluvialDepth    = 0.08 + 0.10 * _rain + 0.04 * _clamp01(_g);`
//   :2140 `state.fluvialMeander  = 0.3 + 0.5 * _rain;`
//   :2145 `const _vol = _clamp01((_fp.composition?.volatileFraction ?? 0) * 2.0);`
//   :2146 `const _seaCoverage = _wet ? _clamp01(_stab * _vol) : 0.0;`
//   :2147 `state.seaLevel = _wet && _seaCoverage > 0.0 ? -0.2 + 0.5 * _seaCoverage : -1.0;`
//   :2148 `uniforms.uLiquidMask.value = _seaCoverage;`
//   :2151 `state.deltaDensity = state.fluvialDensity * (0.5 + 0.5 * state.fluvialActivity);`
//   :2156 `state.coastStrength  = state.seaLevel > -1.0 ? 1.0 : 0.0;`
//   :2157 `state.strandStrength = _clamp01(_erosion);`
//   :2165 `const _fluvHistory = _wet || (_hadLiquid && _erosion > 0);`
//   :2166 `state.outflowDensity  = _fluvHistory ? _ss(0.3, 0.45, _erosion) : 0.0;`
//   :2167 `state.outflowActivity = state.fluvialActivity;`
// ⚠ THE SEAM IS THE CONDITION VECTOR, NOT `_fp`. The lab reads erosion/atmosphere/volatiles off the
// FROZEN preset; the pack reads them off the condition, which is the :2075 precedent's own ruling
// (`_dp`, the per-seed draw). On a condition built by `conditionFromBody` the three keys are the
// body's own, which is exactly what makes the pack per-body instead of per-preset.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
function labBlock(cond) {
  const u = deriveUniforms(cond);
  // ⭐ THE ONE LINE THAT IS NOT THE LAB'S CHARACTER-FOR-CHARACTER: ROOT-0 fix 1's two-spelling read,
  // copied verbatim from src/worldengine/base/labCore.js:646 — the fix the lab's fluvial block never
  // got. §F pins it and reds on a single-spelling regression; transcribing the raw read here instead
  // would make §C agree with the pack for the wrong reason.
  const erosion = cond.surfaceHistory?.erosion ?? cond.surfaceHistory?.erosionLevel ?? 0;
  const stab = u.liquidStability, rain = u.precipitation, g = u.surfaceGravity;
  const wet = stab > 0.15;
  const hadLiquid = !!(cond.atmosphere && cond.atmosphere.retained !== false);
  const fluvialActivity = wet ? 1.0 : clamp01(erosion);
  const fluvialDensity = wet ? clamp01(stab * (0.3 + 0.7 * rain)) : (hadLiquid ? 0.4 * clamp01(erosion) : 0.0);
  const vol = clamp01((cond.composition?.volatileFraction ?? 0) * 2.0);
  const seaCoverage = wet ? clamp01(stab * vol) : 0.0;
  const seaLevel = wet && seaCoverage > 0.0 ? -0.2 + 0.5 * seaCoverage : -1.0;
  return {
    fluvialActivity,
    fluvialDensity,
    fluvialDepth: 0.08 + 0.10 * rain + 0.04 * clamp01(g),
    fluvialMeander: 0.3 + 0.5 * rain,
    seaCoverage,
    seaLevel,
    deltaDensity: fluvialDensity * (0.5 + 0.5 * fluvialActivity),
    coastStrength: seaLevel > -1.0 ? 1.0 : 0.0,
    strandStrength: clamp01(erosion),
    outflowDensity: (wet || (hadLiquid && erosion > 0)) ? ss(0.3, 0.45, erosion) : 0.0,
    outflowActivity: fluvialActivity,
    cls: wet ? 'wet' : ((hadLiquid && erosion > 0) ? 'relict' : 'airless'),
  };
}
const stateOf = (want) => ({
  fluvialActivity: want.fluvialActivity, fluvialDensity: want.fluvialDensity, fluvialDepth: want.fluvialDepth,
  fluvialMeander: want.fluvialMeander, seaLevel: want.seaLevel, deltaDensity: want.deltaDensity,
  coastStrength: want.coastStrength, strandStrength: want.strandStrength,
  outflowDensity: want.outflowDensity, outflowActivity: want.outflowActivity,
});
const solids = () => BODIES.filter((b) => compositionClass(b.cond) !== 'gas');
const firstOfClass = (cls) => BODIES.find((b) => compositionClass(b.cond) !== 'gas' && fluvialClassOf(b.cond) === cls);

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('§A — the predicate admits exactly the non-gas class, and moves NO body between materials', () => {
  it('applies() is the boolean complement of compositionClass === gas over the whole corpus', () => {
    for (const b of BODIES) {
      expect(FLUVIAL_DECK_ENTRY.applies(b.cond), `${b.seed}/${b.kind}`).toBe(compositionClass(b.cond) !== 'gas');
    }
    expect(solids().length).toBeGreaterThan(20);
    expect(BODIES.length - solids().length).toBeGreaterThan(20);
  });

  it('⛔ registration is never what ADMITS a body: every claimed body already has another pack', () => {
    for (const b of BODIES) {
      const without = selectPacks(b.cond).map((e) => e.name).filter((n) => n !== 'fluvialDeck');
      expect(without.length, `${b.seed}: registration must not be what admits this body`).toBeGreaterThan(0);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('§C — every driver is the lab’s formula on the same condition, to the last bit', () => {
  it('over the corpus, solid bodies', () => {
    let n = 0;
    for (const b of solids()) {
      const want = labBlock(b.cond);
      const got = fluvialDeckPack(b.cond, CTX);
      expect(fluvialDeckLabState(got), `${b.seed}/${b.kind}`).toEqual(stateOf(want));
      expect(fluvialDeckDirectDrivers(got), `${b.seed}/${b.kind}`).toEqual({ uLiquidMask: want.seaCoverage });
      expect(got.meta.fluvialClass, `${b.seed}/${b.kind}`).toBe(want.cls);
      expect(fluvialClassOf(b.cond), `${b.seed}/${b.kind}`).toBe(want.cls);
      expect(got.meta.compositionClass).toBe(compositionClass(b.cond));
      n++;
    }
    expect(n).toBe(124);
  });

  it('the RESOLVED uniform values are the lab’s too — the gate map does not change a value when ON', () => {
    for (const b of solids()) {
      const want = labBlock(b.cond);
      const d = fluvialDeckPack(b.cond, CTX).drivers;
      const r = (n) => resolveDriver(n, d[n], CTX);
      expect(r('uFluvialActivity')).toBe(want.fluvialActivity);
      expect(r('uFluvialDepth')).toBe(want.fluvialDepth);
      expect(r('uFluvialMeander')).toBe(want.fluvialMeander);
      expect(r('uSeaLevel')).toBe(want.seaLevel);
      expect(r('uLiquidMask')).toBe(want.seaCoverage);
      expect(r('uDeltaDensity')).toBe(want.deltaDensity);
      expect(r('uCoastStrength')).toBe(want.coastStrength);
      expect(r('uStrandStrength')).toBe(want.strandStrength);
      expect(r('uOutflowDensity')).toBe(want.outflowDensity);
      expect(r('uOutflowActivity')).toBe(want.outflowActivity);
    }
  });

  it('CONTROL: §C can FAIL — a perturbed transcription of one term is caught, corpus-wide', () => {
    // A comparison that never disagrees is not a comparison. ⚠ THE FIRST DRAFT OF THIS CONTROL WAS
    // DEAD and the corpus said so: it bent F11's rain weight (0.7 -> 0.71) on ONE wet body whose
    // density CLAMPS AT 1.0, so the bent law and the true one returned the same number. Bend an
    // UNCLAMPED term instead — F11 depth's gravity weight, 0.04 -> 0.05 — and demand the whole corpus
    // notice, which is the only shape that cannot be silenced by a clamp on one body.
    let mismatches = 0;
    for (const b of solids()) {
      const u = deriveUniforms(b.cond);
      const bent = 0.08 + 0.10 * u.precipitation + 0.05 * clamp01(u.surfaceGravity);
      if (bent !== fluvialDeckPack(b.cond, CTX).drivers.uFluvialDepth) mismatches++;
    }
    expect(mismatches, 'a bent coefficient must disagree on nearly every body').toBeGreaterThan(100);
  });

  it('the pack is PURE in the condition — two calls on one condition agree, and it mutates nothing', () => {
    const b = solids()[0];
    const before = JSON.stringify(b.cond);
    const a = fluvialDeckPack(b.cond, CTX);
    const c = fluvialDeckPack(b.cond, CTX);
    expect(fluvialDeckLabState(a)).toEqual(fluvialDeckLabState(c));
    expect(JSON.stringify(b.cond)).toBe(before);
  });

  it('it refuses a missing condition and a missing display policy, by name', () => {
    expect(() => fluvialDeckPack(null, CTX)).toThrow(PackContractError);
    expect(() => fluvialDeckPack(solids()[0].cond, { gates: CTX.gates })).toThrow(PackContractError);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('§D — gates, membership, collision, registration', () => {
  it('the THREE gated drivers resolve to 0 when their gate is off and to the lab value when on', () => {
    const b = firstOfClass('wet');
    const want = labBlock(b.cond);
    const offCtx = { ...CTX, gates: { deltas: false, coast: false, outflow: false } };
    const on = fluvialDeckPack(b.cond, CTX).drivers;
    const off = fluvialDeckPack(b.cond, offCtx).drivers;
    const GATED = [
      ['uDeltaDensity', DELTAS_GATE, want.deltaDensity],
      ['uCoastStrength', COAST_GATE, want.coastStrength],
      ['uOutflowDensity', OUTFLOW_GATE, want.outflowDensity],
    ];
    for (const [n, g, v] of GATED) {
      expect(isPackDriver(on[n]), n).toBe(true);
      expect(on[n].gate, n).toBe(g);
      expect(resolveDriver(n, on[n], CTX), n).toBe(v);
      expect(resolveDriver(n, off[n], offCtx), n).toBe(0);
    }
    // NON-VACUITY: on a wet body two of the three carry a non-zero value, so the off-gate zero is a
    // real change rather than a re-statement of the value.
    expect(want.deltaDensity).toBeGreaterThan(0);
    expect(want.coastStrength).toBe(1);
    // ⭐ THE THIRD ROW IS LIVE ON REAL BODIES SINCE THE EROSION FIX (§F): 68 of the 124 solid bodies
    // carry a non-zero outflow, where the raw single-spelling read left 0 and this row provable only
    // on a hand-built condition. Both are asserted — the corpus one because it is the population that
    // ships, the built one because it pins the RAMP's shape at three points the corpus need not hit.
    const outflowBodies = solids().filter((x) => labBlock(x.cond).outflowDensity > 0);
    expect(outflowBodies.length).toBe(68);
    for (const x of outflowBodies) {
      const xd = fluvialDeckPack(x.cond, CTX).drivers;
      expect(resolveDriver('uOutflowDensity', xd.uOutflowDensity, CTX), `${x.seed}/${x.kind}`).toBe(labBlock(x.cond).outflowDensity);
      expect(resolveDriver('uOutflowDensity', xd.uOutflowDensity, { ...CTX, gates: { ...CTX.gates, outflow: false } }), `${x.seed}/${x.kind}`).toBe(0);
    }
    const relictish = { ...b.cond, surfaceHistory: { erosion: 0.5 } };
    const rd = fluvialDeckPack(relictish, CTX).drivers;
    expect(resolveDriver('uOutflowDensity', rd.uOutflowDensity, CTX)).toBe(ss(0.3, 0.45, 0.5));
    expect(ss(0.3, 0.45, 0.5)).toBe(1);
  });

  it('⛔ uSeaLevel is emitted UNGATED — a plain number — because an off gate resolves to 0, not to −1', () => {
    // src/worldengine/port/writePackUniforms.js:186 `if (!gates[d.gate]) return 0;` and :62-78
    // (`makeDriver` has no off-value field). 0 is a sea AT THE DATUM, drowning every basin; the lab's
    // "no liquid" value is -1 (world-engine-lab.html:5082). A `lakes` gate would therefore turn the
    // checkbox into a flood, so the pack declares THREE gates and the lab keeps the lakes checkbox at
    // its own per-frame writer.
    const b = firstOfClass('wet');
    const d = fluvialDeckPack(b.cond, CTX).drivers;
    expect(isPackDriver(d.uSeaLevel)).toBe(false);
    expect(typeof d.uSeaLevel).toBe('number');
    expect(FLUVIAL_DECK_ENTRY.gates).toEqual([DELTAS_GATE, COAST_GATE, OUTFLOW_GATE]);
    expect(FLUVIAL_DECK_ENTRY.gates).not.toContain('lakes');
    // CONTROL — the hazard, EXECUTED: had it been gated, an off gate would resolve to 0, which is
    // neither this body's sea level nor the lab's "no liquid" sentinel. Both halves asserted, because
    // 0 happening to equal either one is exactly how this would have shipped unnoticed.
    const trueSea = labBlock(b.cond).seaLevel;
    expect(trueSea).not.toBe(0);
    expect(trueSea).not.toBe(-1);
    expect(resolveDriver('uSeaLevel', scalar(d.uSeaLevel, { gate: DELTAS_GATE }), { ...CTX, gates: { deltas: false } })).toBe(0);
  });

  it('uLiquidMask is a plain number too — the lab’s :2136 read-back assigns it RAW', () => {
    // world-engine-lab.html writes the direct drivers as `uniforms[k].value = v`, so a marker object
    // there would land IN the uniform. Pinned by name rather than left to a page load to find.
    for (const b of solids()) {
      expect(typeof fluvialDeckDirectDrivers(fluvialDeckPack(b.cond, CTX)).uLiquidMask, `${b.seed}`).toBe('number');
    }
  });

  it('FLUVIAL_DECK_UNIFORMS is exactly the emitted set — the TEN names, by membership not by count', () => {
    const b = firstOfClass('wet');
    expect(new Set(Object.keys(fluvialDeckPack(b.cond, CTX).drivers))).toEqual(new Set(FLUVIAL_DECK_UNIFORMS));
    expect([...FLUVIAL_DECK_UNIFORMS].sort()).toEqual([
      'uCoastStrength', 'uDeltaDensity', 'uFluvialActivity', 'uFluvialDepth', 'uFluvialMeander',
      'uLiquidMask', 'uOutflowActivity', 'uOutflowDensity', 'uSeaLevel', 'uStrandStrength',
    ]);
    // ⛔ AND `uFluvialDensity` IS NOT ONE OF THEM — the lab pins that uniform to 0.0 every frame
    // (world-engine-lab.html:5518, the retired worm-trail). The density travels as meta + mirror.
    expect(FLUVIAL_DECK_UNIFORMS).not.toContain('uFluvialDensity');
    expect(fluvialDeckPack(b.cond, CTX).meta.fluvialDensity).toBeGreaterThan(0);
  });

  it('no OTHER pack writes any of the ten — by name lookup over real pack outputs, on every body', () => {
    const names = new Set(FLUVIAL_DECK_UNIFORMS);
    for (const b of BODIES) {
      for (const e of PACKS) {
        if (e.name === 'fluvialDeck' || e.applies(b.cond) !== true) continue;
        const ctx = { ...labPackCtx(b.d, b.cond, null), gates: gatesFor(e) };
        for (const n of Object.keys(e.pack(b.cond, ctx).drivers)) {
          expect(names.has(n), `${e.name} also writes '${n}' on ${b.seed}/${b.kind}`).toBe(false);
        }
      }
    }
  });

  it('registration moves NO body between materials: the admitted set is unchanged', () => {
    for (const b of BODIES) {
      expect(selectPacks(b.cond).some((e) => e.name === 'fluvialDeck')).toBe(compositionClass(b.cond) !== 'gas');
    }
  });

  it('through applyDriverPacks on a REAL lab material the ten land on a wet body, and uFluvialDensity stays 0', () => {
    const b = firstOfClass('wet');
    const want = labBlock(b.cond);
    const mat = buildLabPlanetMaterial({ lightDir: [0, 0, 1] }).material;
    const r = applyDriverPacks(mat, b.cond, labPackCtx(b.d, b.cond, null));
    expect(r.applied).toContain('fluvialDeck');
    expect(mat.uniforms.uSeaLevel.value).toBe(want.seaLevel);
    expect(mat.uniforms.uSeaLevel.value).not.toBe(-1);
    expect(mat.uniforms.uCoastStrength.value).toBe(1);
    expect(mat.uniforms.uLiquidMask.value).toBe(want.seaCoverage);
    expect(mat.uniforms.uLiquidMask.value).toBeGreaterThan(0);
    expect(mat.uniforms.uDeltaDensity.value).toBe(want.deltaDensity);
    expect(mat.uniforms.uFluvialActivity.value).toBe(want.fluvialActivity);
    expect(mat.uniforms.uFluvialDensity.value).toBe(0);
  });

  it('a GAS body gets none of the ten: fluvialDeck is in `skipped` and uSeaLevel stays −1', () => {
    const g = BODIES.find((b) => compositionClass(b.cond) === 'gas');
    const mat = buildLabPlanetMaterial({ lightDir: [0, 0, 1] }).material;
    const r = applyDriverPacks(mat, g.cond, labPackCtx(g.d, g.cond, null));
    expect(r.skipped).toContain('fluvialDeck');
    expect(r.applied).not.toContain('fluvialDeck');
    expect(mat.uniforms.uSeaLevel.value).toBe(-1);
    expect(mat.uniforms.uLiquidMask.value).toBe(0);
  });

  it('the corpus splits into wet / relict / airless and the counts are RECORDED (AC-1)', () => {
    const c = { wet: 0, relict: 0, airless: 0 };
    for (const b of solids()) c[fluvialClassOf(b.cond)]++;
    expect(c.wet + c.relict + c.airless).toBe(124);
    // MEASURED 2026-09-02 over the 24 rocky-* seeds, WITH ROOT-0 fix 1's two-spelling erosion read
    // (§F): 2 wet, 66 relict, 56 airless (re-measured 2026-09-02 after the planet-moon wrapper fix — the two "wet" planet-moons were reading a 288 K default T_eq). Under the raw single-spelling read the same corpus answered
    // 2 / 0 / 122 — the relict class was empty and F13/F20 were dark on every body.
    // ⭐ RE-MEASURED 2026-09-04, workstream volatile-delivery: `deriveComposition` gained a surface-volatile delivery term, so warm worlds are no longer dry by construction.
    // WAS { wet: 2, relict: 66, airless: 56 } — the corpus had exactly TWO wet worlds and both were
    // 0.45 R⊕ carbon bodies, because no temperate body could be wet. It now has SEVEN.
    expect(c).toEqual({ wet: 7, relict: 61, airless: 56 });
    // vitest hides console.info on a passing test, so the record goes to a FILE.
    writeFileSync(join(TMP, 'fluvial-classes.json'), JSON.stringify({ solid: 124, gas: BODIES.length - 124, classes: c }, null, 2));
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('§E — the module itself: closure, mirror shape, entry shape', () => {
  const SRC = read('src/worldengine/drivers/fluvialDeck.js');

  it('imports ONLY ../base/ and ../port/ — no renderer, no bare specifier, no three', () => {
    const specs = [...SRC.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    expect(specs.length).toBeGreaterThan(0);
    for (const s of specs) expect(s, s).toMatch(/^\.\.\/(base|port)\//);
  });

  it('carries no entropy and no display-scale token', () => {
    expect(SRC).not.toMatch(/Math\.random/);
    expect(SRC).not.toMatch(/Date\.now/);
    expect(SRC).not.toMatch(/visScaleOf|\bsVis\b|VIS_SCALE_EXP/);
  });

  it('the LAB_BINDING covers nine of the ten — uLiquidMask is the complement, by SUBTRACTION', () => {
    const bound = Object.keys(FLUVIAL_DECK_LAB_BINDING);
    expect(bound.length).toBe(9);
    for (const n of bound) expect(FLUVIAL_DECK_UNIFORMS).toContain(n);
    const b = firstOfClass('wet');
    const complement = Object.keys(fluvialDeckDirectDrivers(fluvialDeckPack(b.cond, CTX)));
    expect(complement).toEqual(['uLiquidMask']);
  });

  it('the mirror resolves every gate ON — a gated field is never zeroed on its way into `state`', () => {
    // The lab re-applies its own checkbox at world-engine-lab.html:5082-5092, so the mirror must hand
    // it the UNGATED value or the decision is applied twice and nothing throws.
    const b = firstOfClass('wet');
    const want = labBlock(b.cond);
    const st = fluvialDeckLabState(fluvialDeckPack(b.cond, { ...CTX, gates: { deltas: false, coast: false, outflow: false } }));
    expect(st.deltaDensity).toBe(want.deltaDensity);
    expect(st.coastStrength).toBe(want.coastStrength);
    expect(st.outflowDensity).toBe(want.outflowDensity);
  });

  it('the entry is frozen, returns a BOOLEAN, and names its module', () => {
    expect(Object.isFrozen(FLUVIAL_DECK_ENTRY)).toBe(true);
    expect(FLUVIAL_DECK_ENTRY.name).toBe('fluvialDeck');
    expect(typeof FLUVIAL_DECK_ENTRY.applies(BODIES[0].cond)).toBe('boolean');
    expect(FLUVIAL_DECK_ENTRY.pack).toBe(fluvialDeckPack);
    expect(FLUVIAL_DECK_ENTRY.labState).toBe(fluvialDeckLabState);
    expect(PACKS.some((e) => e === FLUVIAL_DECK_ENTRY)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// §F — ⭐⭐ THE EROSION KEY. ROOT-0 FIX 1, APPLIED TO ITS THIRD READER, PINNED HERE.
//
// The lab's block reads a RAW `.erosion` — world-engine-lab.html:2128
// `const _erosion = _fp.surfaceHistory?.erosion ?? 0;`. On LAB presets that is correct:
// driver-presets.js writes `erosion`. On a GAME condition it is not:
// src/generation/PhysicsEngine.js:832 `erosionLevel: erosion,` writes the OTHER spelling, and
// src/worldengine/port/conditionFromBody.js forwards the game's own key untranslated (deliberately —
// its comment records the whole history).
//
// ⭐ ROOT-0 fix 1 (B1, 2026-08-20) taught BOTH readers known at the time both spellings —
// src/worldengine/base/labCore.js:646 and src/worldengine/base/baseStep.js:38, each
// `d.surfaceHistory?.erosion ?? d.surfaceHistory?.erosionLevel ?? 0`, lab spelling winning. THE LAB'S
// FLUVIAL BLOCK WAS A THIRD READER OF THE SAME QUANTITY AND IT WAS MISSED. Moving the block into a
// pack is what made the miss visible, because the pack is the first thing to run that law on a game
// body — so the fix lands in the pack, in the same expression, verbatim.
//
// WHAT IT MOVED, MEASURED ON THIS CORPUS RATHER THAN PREDICTED (2026-09-02, 124 solid bodies):
//   · `surfaceHistory.erosion`      is defined on   2 / 124   and reads 0 on both
//   · `surfaceHistory.erosionLevel` is defined on 122 / 124   and runs 0 … 1, median 0.529
//   · SINGLE SPELLING (the raw lab line): wet 2 · relict  0 · airless 122; outflow non-zero   0;
//     strand non-zero   0
//   · DUAL SPELLING   (what ships):       wet 2 · relict 66 · airless  56; outflow non-zero  68;
//     strand non-zero 122
// F13 outflow channels and F20 paleo-strandlines were DARK on every game body and are now live on 66
// and 122 of them; intent.md decision 4's relict class goes from ZERO bodies to 64.
//
// ⛔ THESE ASSERTIONS RED ON A SINGLE-SPELLING REGRESSION, WHICH IS THE WHOLE POINT OF THE BLOCK. The
// second `??` is one keystroke from deletion and its loss is SILENT — every other suite in this file
// would stay green, because a hard 0 is a legal erosion. The three arms are: the reader itself, driven
// on synthetic conditions; the corpus numbers; and the CONTROL that recomputes the raw read and
// demands it DISAGREE, so the fix cannot become a no-op unnoticed.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('§F — the erosion key: ROOT-0 fix 1 at its third reader, and the regression that must red', () => {
  // A minimal solid condition. Built rather than taken from the corpus so the ONLY thing varying
  // between the arms is the surfaceHistory key.
  const withHistory = (sh) => ({
    ...BODIES.find((b) => compositionClass(b.cond) !== 'gas' && b.cond.atmosphere && b.cond.atmosphere.retained !== false).cond,
    surfaceHistory: sh,
  });

  it('the reader takes EITHER spelling, and the LAB spelling wins where both exist', () => {
    // The three cases ROOT-0 fix 1's own comment names, driven rather than read.
    expect(fluvialDeckPack(withHistory({ erosion: 0.6 }), CTX).meta.erosion).toBe(0.6);
    expect(fluvialDeckPack(withHistory({ erosionLevel: 0.6 }), CTX).meta.erosion).toBe(0.6);
    expect(fluvialDeckPack(withHistory({ erosion: 0.6, erosionLevel: 0.2 }), CTX).meta.erosion).toBe(0.6);
    expect(fluvialDeckPack(withHistory({}), CTX).meta.erosion).toBe(0);
    // ⛔ THE REGRESSION ARM: with ONLY the game's spelling present, a single-spelling reader answers 0
    // and everything downstream goes quiet. This is the assertion that reds if the second `??` is
    // deleted, and it is stated on the OUTPUTS as well as the input, because a hard 0 is legal.
    const gameOnly = fluvialDeckPack(withHistory({ erosionLevel: 0.5 }), CTX);
    expect(gameOnly.meta.erosion, 'the second spelling was dropped — ROOT-0 fix 1 regressed').toBe(0.5);
    expect(gameOnly.meta.fluvialClass).toBe('relict');
    expect(gameOnly.meta.outflowDensity).toBe(ss(0.3, 0.45, 0.5));
    expect(gameOnly.meta.strandStrength).toBe(0.5);
  });

  it('⛔ NO LAB PRESET MOVES: a lab-shaped condition answers exactly what it answered before', () => {
    // The fix's stated price. driver-presets.js writes `erosion`, which still wins, so the lab's own
    // fourteen presets are byte-identical across the change — the movement is entirely game-side.
    for (const e of [0, 0.2, 0.4, 0.6, 1.0]) {
      const labShaped = withHistory({ erosion: e });
      const raw = e;   // what the single-spelling read would have returned on this same condition
      expect(fluvialDeckPack(labShaped, CTX).meta.erosion, `erosion ${e}`).toBe(raw);
    }
  });

  it('the corpus: the game spells it `erosionLevel`, and 124 of 124 bodies now carry a real erosion', () => {
    let hasErosion = 0, hasErosionLevel = 0, erosionNonZero = 0;
    for (const b of solids()) {
      const sh = b.cond.surfaceHistory || {};
      if (sh.erosion !== undefined) hasErosion++;
      if (sh.erosionLevel !== undefined) hasErosionLevel++;
      if (fluvialDeckPack(b.cond, CTX).meta.erosion !== 0) erosionNonZero++;
    }
    expect(hasErosion).toBe(0);
    expect(hasErosionLevel).toBe(124);
    expect(erosionNonZero, 'under the raw single-spelling read this was 0 — see the block header').toBe(124);
  });

  it('so F13 outflow and F20 strandlines are LIVE on the corpus, and the counts are recorded', () => {
    let outflowNonZero = 0, strandNonZero = 0;
    for (const b of solids()) {
      const d = fluvialDeckPack(b.cond, CTX).drivers;
      if (resolveDriver('uOutflowDensity', d.uOutflowDensity, CTX) > 0) outflowNonZero++;
      if (resolveDriver('uStrandStrength', d.uStrandStrength, CTX) > 0) strandNonZero++;
    }
    expect(outflowNonZero).toBe(68);
    expect(strandNonZero).toBe(124);
  });

  it('CONTROL: the fix is LOAD-BEARING — the raw read gives a DIFFERENT answer on this corpus', () => {
    // A fix whose presence changes nothing is indistinguishable from its absence. Recompute what the
    // untouched lab line would have said on the same bodies and demand it disagree, by a counted
    // margin rather than "somewhere".
    const shipped = { wet: 0, relict: 0, airless: 0 };
    const raw = { wet: 0, relict: 0, airless: 0 };
    let disagreements = 0;
    for (const b of solids()) {
      const u = deriveUniforms(b.cond);
      const sh = b.cond.surfaceHistory || {};
      const rawErosion = sh.erosion ?? 0;                       // the untouched world-engine-lab.html:2128
      const wet = u.liquidStability > 0.15;
      const hadLiquid = !!(b.cond.atmosphere && b.cond.atmosphere.retained !== false);
      const rawCls = wet ? 'wet' : ((hadLiquid && rawErosion > 0) ? 'relict' : 'airless');
      const cls = fluvialClassOf(b.cond);
      shipped[cls]++; raw[rawCls]++;
      if (cls !== rawCls) disagreements++;
    }
    // ⭐ RE-MEASURED %s. Both arms move, and they move for
    // DIFFERENT reasons, which is why the control still discriminates: `shipped` moves because more
    // bodies are wet; `raw` moves with it because its wet test reads the same liquid stability.
    expect(shipped).toEqual({ wet: 7, relict: 61, airless: 56 });
    // ⭐ THE CONTROL STILL DISCRIMINATES, and by the same margin it always did: the two readers agree
    // on the WET class (both 7 — that class never needed the erosion fix) and disagree on the entire
    // RELICT class, which the raw single-spelling read still calls airless. `disagreements` is
    // therefore exactly the relict count, which keeps it a live measure of the fix rather than a
    // number that merely happens to be non-zero. WAS raw { 2, 0, 122 } · disagreements 66.
    expect(raw).toEqual({ wet: 7, relict: 0, airless: 117 });
    expect(disagreements, 'the two readers agree everywhere — the fix has become a no-op').toBe(61);
    writeFileSync(join(TMP, 'fluvial-erosion-key.json'), JSON.stringify({
      shipped: { ...shipped, note: 'ROOT-0 fix 1 two-spelling read' },
      rawSingleSpelling: { ...raw, note: 'the untouched world-engine-lab.html:2128' },
      bodiesThatChangedClass: disagreements,
    }, null, 2));
  });

  it('CONTROL: the expression itself is the one ROOT-0 fix 1 wrote, character for character', () => {
    // The behavioural arms above could all be satisfied by a hand-rolled equivalent that drifts from
    // the two readers it is supposed to match. This pins the SHAPE, so the three stay one law.
    const EXPR = '?.erosion ?? condition.surfaceHistory?.erosionLevel ?? 0';
    expect(read('src/worldengine/drivers/fluvialDeck.js')).toContain(EXPR);
    // …and the two readers it copies still carry theirs, or this file is now the odd one out.
    for (const rel of ['src/worldengine/base/labCore.js', 'src/worldengine/base/baseStep.js']) {
      expect(read(rel), rel).toContain('?.erosion ?? d.surfaceHistory?.erosionLevel ?? 0');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// §H — ⭐⭐ THE `_fp` → `_dp` SEAM, MEASURED AND PINNED. What the LAB renders now against what it
// rendered before this workstream moved the block into a pack.
//
// WHY THIS BLOCK EXISTS. Contract AC-0's first draft claimed the lab's own presets were "byte-identical
// before and after the move (the pack-contract golden pattern)". THAT CLAIM IS FALSE, and the whole-branch
// review is what found it. The lab's block read the FROZEN preset for its volatiles —
// world-engine-lab.html:2145 `const _vol = _clamp01((_fp.composition?.volatileFraction ?? 0) * 2.0);`
// with `_fp = DRIVER_PRESETS[driverUI.preset]` (:2127) — which is seed-DEAF. The pack reads them off the
// CONDITION VECTOR, which is the per-seed draw `_dp` (:1941 `drawPresetConditions`), because that is the
// seam the other seven packs already use and the one pack #2's call site (:2074) measured and ruled on.
// So the move DID change the lab's rendered values, on purpose, and the ruling was KEEP `_dp` and DECLARE
// the delta with its numbers rather than revert. This block is that declaration, executable.
//
// ⛔ THE TWO ARMS, AND WHY THE `_fp` ARM IS THE LAB'S OLD EXPRESSION RATHER THAN `pack(deriveConditionVector(_fp, …))`.
// "What the lab rendered before" is not "the pack run on a vector built from the frozen preset": the old
// block took `_stab` / `_rain` / `_g` from `u = deriveUniforms(_dp)` (:1943, :2129) and ONLY the volatiles,
// erosion and atmosphere from `_fp`. Building a whole condition vector out of `_fp` would also swap T_eq
// and density, move `liquidStability` with them, and measure a seam nobody ever crossed — MEASURED: that
// construction answers 12 combos and a Rocky seed-0 mask of 0.222, neither of which the lab ever drew.
// The arms below therefore share ONE `u` and differ in ONE input, which is exactly the change that shipped.
// `_stab` / `_rain` / `_g` are consequently bit-identical across THESE arms BY CONSTRUCTION — stated
// plainly so nobody reads it as a measurement that could have come out otherwise. That scoping matters:
// it does NOT mean surfaceGravity is bit-identical, full stop — the OTHER seam below (radius-aware vs
// the block's radius-blind read) is a raw surfaceGravity difference on 44 of 72 combos, counted apart.
//
// ⛔ AND ONE MORE MOVER, WHICH IS NOT THE VOLATILES SEAM AND IS RECORDED SEPARATELY: `uFluvialDepth`
// reads `_g`, and the CONDITION VECTOR carries the radius-AWARE surface gravity while the block's own
// `deriveUniforms(_dp)` bundle is radius-BLIND. That is the conversion world-engine-lab.html:1964 already
// made for the bulk relief envelope and the gravity readout ("both were radius-deaf until this line
// changed") and that pack #2's [G] A/B exists to show; F11's depth joins it here. Counted below against
// the block's own `u`, so the two seams are never added together into one misleading number.
//
// ⚠ SEEDS 0-3 AND ALL 18 PRESETS = 72 COMBOS. `drawPresetConditions` returns the preset UNMODIFIED for
// the 7 NAMED_BODY and 4 CONDITION_DRAW_EXCLUDED presets, so 44 of the 72 cannot move by construction —
// which is a property of the draw, not a weakness of the sample, and the record names it.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('§H — the `_fp` → `_dp` seam: the lab’s own rendered values, before and after, measured', () => {
  const H_SEEDS = [0, 1, 2, 3];

  /**
   * The lab's F14 block as it stood BEFORE driver pack #9 — world-engine-lab.html:2131/:2145-2147 at
   * 8bb8e1c, transcribed. `u` is the block's own bundle; `fp` is the FROZEN preset it read volatiles from.
   */
  const preMoveF14 = (fp, u) => {
    const stab = u.liquidStability;                                        // :2129
    const wet = stab > 0.15;                                               // :2131
    const vol = clamp01((fp.composition?.volatileFraction ?? 0) * 2.0);    // :2145 — ⛔ off `_fp`
    const seaCoverage = wet ? clamp01(stab * vol) : 0.0;                   // :2146
    return { wet, seaCoverage, seaLevel: wet && seaCoverage > 0.0 ? -0.2 + 0.5 * seaCoverage : -1.0 };
  };

  it('11 of 72 preset × seed combos MOVE, every one of them wet, and volatileFraction is the sole mover', () => {
    const rows = [];
    let movers = 0, wetCombos = 0, drawn = 0, depthMovers = 0;
    for (const preset of PRESET_NAMES) {
      for (const seed of H_SEEDS) {
        const fp = DRIVER_PRESETS[preset];
        const dp = drawPresetConditions(preset, seed);
        const R = drawPresetRadius(preset, seed);
        const uPreset = deriveUniforms(dp);                                // the lab's own bundle (:1943)
        const cv = deriveConditionVector(dp, uPreset, R);                  // the seam :2136 goes through
        const u = deriveUniforms(cv);                                      // what the PACK derives from
        const got = fluvialDeckPack(cv, CTX).drivers;
        const was = preMoveF14(fp, u);
        if (dp !== fp) drawn++;
        if (was.wet) wetCombos++;
        const moved = got.uLiquidMask !== was.seaCoverage || got.uSeaLevel !== was.seaLevel;
        if (moved) movers++;
        // the OTHER seam, counted apart: F11 depth against the block's OWN radius-blind bundle
        const depthWas = 0.08 + 0.10 * uPreset.precipitation + 0.04 * clamp01(uPreset.surfaceGravity);
        if (depthWas !== got.uFluvialDepth) depthMovers++;
        rows.push({ preset, seed, drawn: dp !== fp, wet: was.wet, moved,
          uLiquidMask: { fp: was.seaCoverage, dp: got.uLiquidMask },
          seaLevel: { fp: was.seaLevel, dp: got.uSeaLevel },
          volatileFraction: { fp: fp.composition?.volatileFraction ?? 0, dp: dp.composition?.volatileFraction ?? 0 },
          fluvialDepth: { fp: depthWas, dp: got.uFluvialDepth },
          stabShared: u.liquidStability, rainShared: u.precipitation });
      }
    }
    writeFileSync(join(TMP, 'fluvial-seam-delta.json'), JSON.stringify({
      combos: rows.length, presets: PRESET_NAMES.length, seeds: H_SEEDS,
      movingCombos: movers, wetCombos, drawnCombos: drawn, fluvialDepthMovers: depthMovers,
      note: 'MEASURED 2026-09-02. The `_fp` arm is the lab\'s pre-pack expression (world-engine-lab.html:2145-2147 at 8bb8e1c) on the block\'s own deriveUniforms bundle; the `_dp` arm is driver pack #9 on deriveConditionVector(_dp, u, R). Sole mover of uLiquidMask/seaLevel: composition.volatileFraction, drawn +-S_VOL (0.30). fluvialDepthMovers is a SEPARATE seam: the condition vector\'s radius-AWARE surfaceGravity vs the block\'s radius-blind one (the :1964 / pack-#2 [G] conversion).',
      moved: rows.filter((r) => r.moved),
      all: rows,
    }, null, 2));

    // ── THE PIN ──
    expect(rows.length, '18 presets x 4 seeds').toBe(72);
    expect(PRESET_NAMES.length).toBe(18);
    expect(movers, 'the moving-combo count is the DECLARED delta in contract AC-0 — if it changes, the declaration is stale').toBe(11);
    // every mover is WET, which is the whole shape of the claim: `_vol` only reaches a rendered value
    // through `_seaCoverage`, and `_seaCoverage` is 0 on anything not wet.
    for (const r of rows.filter((x) => x.moved)) {
      expect(r.wet, `${r.preset}/${r.seed} moved but is not wet`).toBe(true);
      expect(r.volatileFraction.dp, `${r.preset}/${r.seed}: the sole mover must be volatileFraction`).not.toBe(r.volatileFraction.fp);
      expect(r.drawn, `${r.preset}/${r.seed}: a combo can only move if its preset is DRAWN`).toBe(true);
    }
    // …and nothing that is NOT wet moved, stated as its own assertion rather than left to the loop above
    expect(rows.filter((r) => !r.wet && r.moved).length).toBe(0);

    // ── THE WORKED EXAMPLE THE CONTRACT AND THE PLAN QUOTE, to the digits they quote ──
    const rocky0 = rows.find((r) => r.preset === 'Rocky (Earthlike)' && r.seed === 0);
    expect(rocky0.uLiquidMask.fp.toFixed(5)).toBe('0.29536');
    expect(rocky0.uLiquidMask.dp.toFixed(5)).toBe('0.37207');
    expect(rocky0.seaLevel.fp.toFixed(5)).toBe('-0.05232');
    expect(rocky0.seaLevel.dp.toFixed(5)).toBe('-0.01396');
    // the direction matters to Max: the lab's Rocky shoreline is WETTER than it was, not drier
    expect(rocky0.uLiquidMask.dp).toBeGreaterThan(rocky0.uLiquidMask.fp);

    // ── NON-VACUITY: the sample can move at all, and most of it cannot ──
    // 44 of the 72 are NAMED_BODY or CONDITION_DRAW_EXCLUDED, which `drawPresetConditions` returns
    // unmodified — so `drawn` is what the seam could possibly touch, and it is a real subset.
    expect(drawn).toBe(28);
    expect(wetCombos).toBeGreaterThan(movers);   // wet-but-unmoved combos exist (the locked presets)

    // ── THE SECOND SEAM, RECORDED NOT HEADLINED ──
    expect(depthMovers, 'F11 depth moves too, on the radius-aware g — a different seam, counted apart').toBe(24);
  });

  it('CONTROL: the seam measurement can FAIL — feeding the `_dp` arm `_fp`’s volatiles collapses it to zero movers', () => {
    // A delta that would report 11 no matter what is not a measurement. Rebuild the `_dp` arm with the
    // FROZEN preset's volatileFraction spliced back in and demand every mover disappear — which is also
    // the exact revert the ruling declined, executed, so its cost is on the record rather than asserted.
    let movers = 0;
    for (const preset of PRESET_NAMES) {
      for (const seed of H_SEEDS) {
        const fp = DRIVER_PRESETS[preset];
        const dp = drawPresetConditions(preset, seed);
        const R = drawPresetRadius(preset, seed);
        const uPreset = deriveUniforms(dp);
        const cv = deriveConditionVector(dp, uPreset, R);
        const reverted = { ...cv, composition: { ...(cv.composition || {}), volatileFraction: fp.composition?.volatileFraction ?? 0 } };
        const got = fluvialDeckPack(reverted, CTX).drivers;
        // ⚠ THE `_fp` ARM READS THE REVERTED VECTOR'S OWN BUNDLE, and that is not bookkeeping:
        // `liquidStability` ITSELF depends on volatileFraction, so a bundle taken from the unreverted
        // vector would leave `_stab` moving and this control would report 4 movers for a reason that
        // has nothing to do with `_vol`. Measured — the first draft of this control did exactly that.
        const was = preMoveF14(fp, deriveUniforms(reverted));
        if (got.uLiquidMask !== was.seaCoverage || got.uSeaLevel !== was.seaLevel) movers++;
      }
    }
    expect(movers, 'with `_fp`\'s volatiles restored the two arms must agree everywhere — otherwise the 11 above is measuring something else').toBe(0);
  });
});
