// tests/driver-pack-fluvialdeck.test.js — DRIVER PACK #8, `fluvialDeck`: the lab's F11/F12/F13/F14/F20
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
      for (const m of (e.moons || [])) out.push({ seed, kind: 'moon', d: m });
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
//   :2128 `const _erosion = _fp.surfaceHistory?.erosion ?? 0;`
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
  const erosion = cond.surfaceHistory?.erosion ?? 0;
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
    // ⛔ THE THIRD ROW IS VACUOUS ON THIS CORPUS AND IS MADE NON-VACUOUS BY HAND, because
    // `outflowDensity` is 0 on 124 of 124 solid bodies — see §F, which pins WHY. A gate row asserted
    // only where the value is already zero proves nothing, so the outflow gate is exercised on a
    // condition carrying the erosion the lab's F13 ramp needs.
    const relictish = { ...b.cond, surfaceHistory: { erosion: 0.5 } };
    const rd = fluvialDeckPack(relictish, CTX).drivers;
    expect(resolveDriver('uOutflowDensity', rd.uOutflowDensity, CTX)).toBe(ss(0.3, 0.45, 0.5));
    expect(resolveDriver('uOutflowDensity', rd.uOutflowDensity, { ...CTX, gates: { ...CTX.gates, outflow: false } })).toBe(0);
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
    // MEASURED 2026-09-02 over the 24 rocky-* seeds: 4 wet, 0 relict, 120 airless. The RELICT COUNT
    // IS ZERO AND THAT IS NOT A PROPERTY OF THE UNIVERSE — see §F.
    expect(c).toEqual({ wet: 4, relict: 0, airless: 120 });
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
// §F — ⛔⛔ THE EROSION KEY. A MEASURED DEFECT THIS PACK TRANSCRIBES RATHER THAN REPAIRS.
//
// The lab's block reads erosion as a RAW `.erosion` — world-engine-lab.html:2128
// `const _erosion = _fp.surfaceHistory?.erosion ?? 0;` — and this pack transcribes that faithfully.
// On LAB presets that is correct: driver-presets.js writes `erosion`. On a GAME condition it is not:
// src/generation/PhysicsEngine.js:832 `erosionLevel: erosion,` writes the OTHER spelling, and
// src/worldengine/port/conditionFromBody.js forwards the game's own key untranslated (deliberately —
// its comment records the whole history).
//
// ⭐ ROOT-0 fix 1 (B1, 2026-08-20) taught BOTH known readers both spellings —
// src/worldengine/base/labCore.js:646 and src/worldengine/base/baseStep.js:38, each
// `d.surfaceHistory?.erosion ?? d.surfaceHistory?.erosionLevel ?? 0`, lab spelling winning. The lab's
// FLUVIAL BLOCK IS A THIRD READER OF THE SAME QUANTITY AND IT WAS MISSED. Moving the block into a
// pack is what makes the miss visible, because the pack is the first thing to run that law on a game
// body.
//
// WHAT IT COSTS, MEASURED ON THIS CORPUS RATHER THAN PREDICTED (2026-09-02, 124 solid bodies):
//   · `surfaceHistory.erosion`      is defined on   2 / 124   and reads 0 on both
//   · `surfaceHistory.erosionLevel` is defined on 122 / 124   and runs 0 … 1, median 0.529
//   · AS TRANSCRIBED:      wet 4 · relict   0 · airless 120;  uOutflowDensity != 0 on   0 bodies
//   · WITH A DUAL READ:    wet 4 · relict  64 · airless  56;  uOutflowDensity != 0 on  66 bodies
//   · uStrandStrength (F20 paleo-strandlines) is 0 on 124/124 as transcribed, non-zero on 122 with a
//     dual read.
// So F13 outflow channels and F20 strandlines contribute NOTHING on any game body today, and
// intent.md decision 4's relict class — "relict bodies get the route" — admits ZERO bodies.
//
// ⛔ WHY IT IS NOT FIXED HERE. It is a one-clause change with a VISIBLE consequence on 64 bodies, and
// this is a wiring commit whose whole discipline is that the law is transcribed and not re-derived. A
// pack that quietly read a different key than the block it replaced would be exactly the silent
// disagreement the one-pipeline fence exists to prevent. It is surfaced as a decision instead.
//
// ⛔ THESE ASSERTIONS ARE A RATCHET ON A KNOWN DEFECT, NOT A CLAIM THAT ZERO IS CORRECT. The day the
// reader is fixed they RED, by design, and the fix is to re-record the numbers here with the ruling
// that moved them — not to loosen the bound.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('§F — the erosion key: the transcribed reader is measured, and the counterfactual with it', () => {
  it('the game spells it `erosionLevel`; the transcribed `.erosion` read is therefore 0 on every body', () => {
    let hasErosion = 0, hasErosionLevel = 0, erosionNonZero = 0;
    for (const b of solids()) {
      const sh = b.cond.surfaceHistory || {};
      if (sh.erosion !== undefined) hasErosion++;
      if (sh.erosionLevel !== undefined) hasErosionLevel++;
      if (fluvialDeckPack(b.cond, CTX).meta.erosion !== 0) erosionNonZero++;
    }
    expect(hasErosion).toBe(2);
    expect(hasErosionLevel).toBe(122);
    expect(erosionNonZero, 'if this is non-zero the reader was fixed — re-record §F, do not loosen it').toBe(0);
  });

  it('so F13 outflow and F20 strandlines are dark on every solid body — recorded, not asserted as right', () => {
    for (const b of solids()) {
      const d = fluvialDeckPack(b.cond, CTX).drivers;
      expect(resolveDriver('uOutflowDensity', d.uOutflowDensity, CTX), `${b.seed}/${b.kind}`).toBe(0);
      expect(resolveDriver('uStrandStrength', d.uStrandStrength, CTX), `${b.seed}/${b.kind}`).toBe(0);
    }
  });

  it('THE COUNTERFACTUAL, computed rather than guessed: a dual read moves 64 bodies to relict', () => {
    // The same block, with labCore.js:646's own two-spelling read substituted for the lab block's
    // raw one. Nothing here changes what ships; it prices the decision.
    const cls = { wet: 0, relict: 0, airless: 0 };
    let outflowNonZero = 0, strandNonZero = 0;
    for (const b of solids()) {
      const u = deriveUniforms(b.cond);
      const sh = b.cond.surfaceHistory || {};
      const erosion = sh.erosion ?? sh.erosionLevel ?? 0;
      const wet = u.liquidStability > 0.15;
      const hadLiquid = !!(b.cond.atmosphere && b.cond.atmosphere.retained !== false);
      cls[wet ? 'wet' : ((hadLiquid && erosion > 0) ? 'relict' : 'airless')]++;
      if ((wet || (hadLiquid && erosion > 0)) && ss(0.3, 0.45, erosion) > 0) outflowNonZero++;
      if (clamp01(erosion) > 0) strandNonZero++;
    }
    expect(cls).toEqual({ wet: 4, relict: 64, airless: 56 });
    expect(outflowNonZero).toBe(66);
    expect(strandNonZero).toBe(122);
    writeFileSync(join(TMP, 'fluvial-erosion-key.json'), JSON.stringify({
      asTranscribed: { wet: 4, relict: 0, airless: 120, outflowNonZero: 0, strandNonZero: 0 },
      ifDualSpellingRead: { ...cls, outflowNonZero, strandNonZero },
    }, null, 2));
  });
});
