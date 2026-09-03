// tests/driver-pack-stormdeck.test.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #10 — THE STORM SLICE (F27 great spot + F28 storm clusters, the `uStorm*` family).
// Workstream wire-storm-slice-lab-into-game; contract ACs 0–4, 6 (static half) and 7.
//
// ⭐ THE EVIDENCE STANDARD (§11.3.3): every gate that could be vacuous carries an EXECUTED control marked
// `[CONTROL]` — the thing the gate guards is broken in-test, the gate shows red, the break is discarded.
//
// ⛔ WHAT THIS FILE DOES NOT CLAIM:
//  1. It does not claim a player SEES a storm — that is the live pair (AC-5, chrome-devtools) and Max's
//     walk (AC-8). It claims the five uniforms carry the lab's composed slots on every gas body.
//  2. It does not re-type the lab's law as its expectation. The AC-2 expectation is a FIXTURE of the
//     lab's own output at 520f2c0 (tests/fixtures/storm-lab-state-baseline.json), sliced from the pinned
//     blob and run through `new Function` by scripts/capture-storm-lab-baseline.mjs.
//  3. It pins no COUNT as a proxy for a SET; where it cares about membership it asserts membership.
//  4. It does not claim regime coverage it does not have: the game's population has NO Jovian and NO
//     hot-Jupiter body (recorded below), so those regimes are exercised through the driver presets only.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DRIVER_PRESETS } from '../driver-presets.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms, visScaleOf } from '../src/worldengine/base/labCore.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { giantDriverScalars } from '../src/worldengine/base/giant-drivers.js';
import { bakeStormEAttributes } from '../src/worldengine/base/storm-e.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { labPackCtx, Planet, setLabGasBodiesOverride } from '../src/objects/Planet.js';
import { PACKS, gatesFor, applyDriverPacks, selectPacks } from '../src/worldengine/drivers/index.js';
import { writePackUniforms, resolveDriver, PackContractError } from '../src/worldengine/port/writePackUniforms.js';
import { giantDeckPack } from '../src/worldengine/drivers/giantDeck.js';
import { GAME_STORM_SEED } from '../src/worldengine/drivers/polarDeck.js';
import {
  stormDeckPack, stormDeckLabState, composeStormSlots, forEachStormSlot, stormColor, stormDeckZ,
  STORM_DECK_ENTRY, STORM_DRIVEN, STORM_LAB_FIELDS, STORM_LAB_KNOBS, STORM_COLOR_LAW, STORM_SLOT_CAP,
  GREAT_SPOT_GATE, STORM_TRAIN_GATE,
} from '../src/worldengine/drivers/stormDeck.js';
import { makeUniforms } from '../src/worldengine/shaders/uniforms.js';
import { LAB_WORLD_LIGHT } from '../src/rendering/LabPlanetMaterial.js';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';
import { fibonacciSphere, MESH_N } from './fixtures/giantdeck-preset-baseline.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const strip = (s) => stripCommentsPreservingOffsets(s, { blankLiteralText: true });
const LAB_RAW = src('world-engine-lab.html');
const LAB_CODE = strip(LAB_RAW);
const PACK_SRC = src('src/worldengine/drivers/stormDeck.js');
const PACK_CODE = strip(PACK_SRC);
const GIANT_CODE = strip(src('src/worldengine/drivers/giantDeck.js'));
const POLAR_CODE = strip(src('src/worldengine/drivers/polarDeck.js'));
const LAB_FIXTURE = JSON.parse(src('tests/fixtures/storm-lab-state-baseline.json'));
const PACK_FIXTURE = JSON.parse(src('tests/fixtures/pack-drivers-baseline.json'));

const MESH = { positions: fibonacciSphere(MESH_N, 1.0), count: MESH_N, radius: 1.0 };
const ALL_ON = () => ({ [GREAT_SPOT_GATE]: true, [STORM_TRAIN_GATE]: true });
const F3_RAY_NAMES = ['uRayBrightness', 'uRayCount', 'uRaySharp'];   // ⭐ 2026-09-03 (workstream wire-ejecta-rays-lab-into-game, AC-0) — the three names the crater driver block gained AFTER this file's fixture was captured at 520f2c0. ⛔ RIDES THESE LINES: this file is cited by line and a new declaration row would shift every ref below it.
const noRays = (pk) => { if (!pk || !pk.drivers) return pk; const d = { ...pk.drivers }; for (const n of F3_RAY_NAMES) delete d[n]; return { ...pk, drivers: d }; };   // ⚠ THE COMPARE IS `toEqual` OVER A WHOLE PACK OBJECT, so ANY name added to a pack reds it regardless of value — re-capturing the fixture would not help (a parent capture has no ray names either) and would move this suite's :149 commit pin. So the three DECLARED names are removed from the HEAD side and every other name still compares byte-for-byte. Their own compare is tests/driver-pack-ejectarays.test.js against a fixture captured at dc03fc6.
const fnv = (arr) => { const b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h; };

// ── The corpus: the game's own bodies, read as the game mounts them ─────────────────────────────
const SEEDS = Array.from({ length: 24 }, (_, i) => `rocky-${i}`);
function corpus() {
  const out = [];
  for (const seed of SEEDS) {
    const sys = StarSystemGenerator.generate(seed, null);
    for (const e of sys.planets) {
      const d = e.planetData || e;
      out.push({ seed, kind: 'planet', d, id: `${seed}/planet/${d._ordinal}` });
      for (const m of (e.moons || [])) {
        // ⛔ a PLANET-CLASS moon is an ENTRY wrapping planetData (river wire, 2026-09-02): mirror the mount.
        const md = m.isPlanetMoon ? { ...m.planetData, _systemSeed: m._systemSeed, _ordinal: `pm-${m._ordinal}` } : m;
        out.push({ seed, kind: m.isPlanetMoon ? 'planet-moon' : 'moon', d: md, id: `${seed}/${m.isPlanetMoon ? 'planet-moon' : 'moon'}/${md._ordinal}` });
      }
    }
  }
  for (const b of out) b.cond = conditionFromBody(b.d);
  return out;
}
const CORPUS = corpus();
const GAS = CORPUS.filter((b) => compositionClass(b.cond) === 'gas');
const SOLID = CORPUS.filter((b) => compositionClass(b.cond) !== 'gas');

function resolvedPacks(cond, ctx) {
  const out = {};
  for (const entry of PACKS) {
    if (entry.applies(cond, ctx) !== true) continue;
    const packCtx = { ...ctx, gates: gatesFor(entry) };
    const r = entry.pack(cond, packCtx);
    const drivers = {};
    for (const n of Object.keys(r.drivers)) drivers[n] = resolveDriver(n, r.drivers[n], packCtx);
    const attributes = {};
    for (const n of Object.keys(r.attributes)) attributes[n] = fnv(r.attributes[n]);
    out[entry.name] = { drivers, attributes };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('AC-0 — one pipeline: the storm slice has ONE definition under src/, imported by both front-ends', () => {
  it('the lab imports the pack back and holds no copy of the three moved laws', () => {
    expect(LAB_RAW).toContain("from './src/worldengine/drivers/stormDeck.js'");
    expect(LAB_CODE).toContain('stormDeckPack(');
    expect(LAB_CODE).toContain('stormDeckLabState(');
    expect(LAB_CODE).toContain('forEachStormSlot(');
    expect(LAB_CODE).not.toContain('const _stormColor');
    expect(LAB_CODE).not.toContain('const _stormDeckZ');
    expect(LAB_CODE).not.toContain('_stormDeckZ(');
    // the lab no longer CALLS the writer itself (the import line at :186 may still name it)
    expect(LAB_CODE).not.toMatch(/\bresolveStormE\s*\(/);
    // and the three laws exist exactly once, in the pack
    for (const sym of ['export function stormColor', 'export function stormDeckZ', 'export function forEachStormSlot', 'export function stormDeckLabState', 'export function stormDeckPack']) {
      expect(PACK_CODE.split(sym).length - 1, sym).toBe(1);
    }
  });
  it('[CONTROL] the deny scans MATCHED the lab before the move (the fixture capture proves the slice existed)', () => {
    // scripts/capture-storm-lab-baseline.mjs slices `function applyStormState(){` and `_stormDeckZ` out of the
    // pinned blob and throws when either marker is missing — the fixture's existence is the executed control.
    expect(LAB_FIXTURE.capturedFrom.startsWith('520f2c0')).toBe(true);
    expect(LAB_FIXTURE.rows.length).toBe(92);
  });
  it('the sibling fences stay TRUE: pack #1 emits no uStorm* driver, polarDeck never names the writer', () => {
    expect(GIANT_CODE).not.toMatch(/drivers\.uStorm/);
    for (const name of ['resolveStormE', 'writeStormESphere']) expect(POLAR_CODE).not.toContain(name);
    expect(POLAR_CODE).not.toMatch(/\bbakeStormEAttributes\s*\(/);
  });
  it('registered: STORM_DECK_ENTRY is in PACKS by IDENTITY, last, as pack #10, with both gates', () => {
    expect(PACKS.includes(STORM_DECK_ENTRY)).toBe(true);
    expect(PACKS[PACKS.length - 1]).toBe(STORM_DECK_ENTRY);
    expect(STORM_DECK_ENTRY.name).toBe('stormDeck');
    expect([...STORM_DECK_ENTRY.gates]).toEqual([GREAT_SPOT_GATE, STORM_TRAIN_GATE]);
    expect(PACK_SRC).toContain('DRIVER PACK #10');
    // its predicate is the gas predicate: it claims EXACTLY the bodies giantDeck/limbDeck/polarDeck claim
    const polar = PACKS.find((e) => e.name === 'polarDeck');
    for (const b of CORPUS) expect(STORM_DECK_ENTRY.applies(b.cond, {}), b.id).toBe(polar.applies(b.cond, {}));
  });
  it('three-free: the pack imports base/, port/ and two sibling CONSTANTS only; no renderer, no Math.random', () => {
    const imports = [...PACK_SRC.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]);
    expect(imports.every((s) => s.startsWith('../base/') || s.startsWith('../port/') || s === './giantDeck.js' || s === './polarDeck.js')).toBe(true);
    expect(PACK_CODE).not.toMatch(/Math\.random|Date\.now|from 'three'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC-1 — the pack contract learns exactly ONE new value shape and nothing already on it moves', () => {
  it('every pre-existing pack resolves to the SAME drivers and attribute hashes as the 520f2c0 fixture (156 bodies + 18 presets)', () => {
    expect(PACK_FIXTURE.capturedFrom).toBe('520f2c0');
    let compared = 0;
    for (const b of CORPUS) {
      const now = resolvedPacks(b.cond, labPackCtx(b.d, b.cond, MESH));
      const was = PACK_FIXTURE.bodies[b.id];
      expect(was, b.id).toBeDefined();
      for (const name of Object.keys(was)) {
        expect(noRays(now[name]), `${b.id} ${name}`).toEqual(was[name]);
        compared++;
      }
      // the ONLY new name on any body is stormDeck, and only on gas bodies
      const added = Object.keys(now).filter((n) => !(n in was));
      expect(added, b.id).toEqual(compositionClass(b.cond) === 'gas' ? ['stormDeck'] : []);
    }
    for (const name of Object.keys(DRIVER_PRESETS)) {
      const fp = DRIVER_PRESETS[name]; const R = fp.radiusEarth ?? 1;
      const cond = deriveConditionVector(fp, deriveUniforms(fp, 1.0), R);
      const dFake = { ...fp, _systemSeed: 'preset', _ordinal: name, radius: 1 };
      const now = resolvedPacks(cond, { ...labPackCtx(dFake, cond, MESH), rotationHours: fp.rotationHours ?? 24 });
      const was = PACK_FIXTURE.presets[name];
      for (const p of Object.keys(was)) { expect(noRays(now[p]), `${name} ${p}`).toEqual(was[p]); compared++; }
    }
    expect(compared).toBeGreaterThan(600);
  });
  it('stormDeck is the ONLY pack that emits the nested shape, on every gas body', () => {
    const nested = (v) => Array.isArray(v) && v.length > 0 && Array.isArray(v[0]);
    for (const b of CORPUS) {
      const ctx = labPackCtx(b.d, b.cond, MESH);
      for (const entry of PACKS) {
        if (entry.applies(b.cond, ctx) !== true) continue;
        const r = entry.pack(b.cond, { ...ctx, gates: gatesFor(entry) });
        const has = Object.values(r.drivers).some(nested);
        expect(has, `${b.id} ${entry.name}`).toBe(entry.name === 'stormDeck' && r.meta.count > 0);
      }
    }
  });
  it('[CONTROL] the writer refuses the three wrong shapes and keeps the material\'s Vector slots as OBJECTS', () => {
    const ctx = { displayRadiusEarth: 1, animRate: 1, relevance: {}, gates: {} };
    expect(() => writePackUniforms({ uX: { value: 0 } }, { uX: [[1, 2, 3, 4]] }, ctx)).toThrow(/array of vectors/);
    expect(() => writePackUniforms({ uX: { value: [{ set() {} }] } }, { uX: [[1, 2], [3]] }, ctx)).toThrow(/ragged/);
    expect(() => writePackUniforms({ uX: { value: [0, 0] } }, { uX: [[1, 2, 3, 4]] }, ctx)).toThrow(/no settable slot/);
    expect(() => writePackUniforms({ uX: { value: [{ set() {} }] } }, { uX: [[1, 2], [3, 4]] }, ctx)).toThrow(/no settable slot/);
    // a real material: the slots survive as THREE vectors, written in place
    const u = makeUniforms(LAB_WORLD_LIGHT);
    const before0 = u.uStormPosSize.value[0];
    const g = GAS[0]; const packCtx = { ...labPackCtx(g.d, g.cond, null), gates: ALL_ON() };
    const r = stormDeckPack(g.cond, packCtx);
    writePackUniforms(u, r.drivers, packCtx);
    expect(u.uStormPosSize.value[0]).toBe(before0);
    expect(u.uStormPosSize.value[0].isVector4).toBe(true);
    expect(u.uStormColor.value[0].isVector3).toBe(true);
    expect(u.uStormCount.value).toBe(r.meta.count);
    expect(u.uStormPosSize.value[0].w).toBe(r.drivers.uStormPosSize[0][3]);
    // the flat-array and scalar branches are untouched (pack-contract.test.js owns them; one probe here)
    const cap = []; writePackUniforms({ uV: { value: { set: (...a) => cap.push(a) } } }, { uV: [1, 2, 3] }, ctx);
    expect(cap).toEqual([[1, 2, 3]]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC-2 — refactor byte-identity under the LAB\'s policy: the mirror + composer reproduce the lab\'s own pre-move output', () => {
  const ctxFor = (row, cond) => ({
    displayRadiusEarth: visScaleOf(row.radiusEarth), macroSeed: row.macroSeed, stormSeed: row.stormSeed,
    animRate: 1, gates: ALL_ON(), relevance: {},
    rotationHours: row.rotationHours, rotationScale: 1,
    ...(row.obliquityDeg > 0 ? { obliquityDeg: row.obliquityDeg } : {}),
    e5DriverOverrides: { ...giantDriverScalars(row.radiusEarth, row.rotationHours, 1), radius: (cond.radiusEarth ?? 1) / 11.2 },
  });
  const condOf = (row) => deriveConditionVector(DRIVER_PRESETS[row.preset], deriveUniforms(DRIVER_PRESETS[row.preset], 1.0), row.radiusEarth);
  const GATE_KEYS = { '00': [false, false], '10': [true, false], '01': [false, true], '11': [true, true] };

  it('every state field applyStormState wrote, on every preset × seed pair × obliquity: max delta exactly 0 (92 rows)', () => {
    let rows = 0;
    for (const row of LAB_FIXTURE.rows) {
      const cond = condOf(row);
      const mirror = stormDeckLabState(stormDeckPack(cond, ctxFor(row, cond)));
      expect(mirror, `${row.preset} m${row.macroSeed} s${row.stormSeed} o${row.obliquityDeg}`).toEqual(row.written);
      rows++;
    }
    expect(rows).toBe(92);
    expect(LAB_FIXTURE.stormFields).toEqual([...STORM_LAB_FIELDS]);
  });
  it('the composer reproduces the lab\'s per-frame slot writes under all four checkbox combinations', () => {
    let combos = 0;
    for (const row of LAB_FIXTURE.rows) {
      const cond = condOf(row);
      const mirror = stormDeckLabState(stormDeckPack(cond, ctxFor(row, cond)));
      for (const [key, [g, t]] of Object.entries(GATE_KEYS)) {
        const got = composeStormSlots({ ...mirror, trainRadiusScale: 1 }, { greatSpot: g, stormTrain: t });
        expect(got, `${row.preset} m${row.macroSeed} s${row.stormSeed} ${key}`).toEqual(row.slots[key]);
        combos++;
      }
    }
    expect(combos).toBe(92 * 4);
  });
  it('[CONTROL] the fixture comparison CAN fail: a 1e-3 colour nudge and a 1.001 radius knob both go red', () => {
    const row = LAB_FIXTURE.rows.find((r) => r.gas && r.slots['11'].count > 1 && r.written.spotMode === 0);
    const cond = condOf(row);
    const mirror = stormDeckLabState(stormDeckPack(cond, ctxFor(row, cond)));
    const nudged = { ...mirror, spotColor: [mirror.spotColor[0] + 1e-3, mirror.spotColor[1], mirror.spotColor[2]] };
    expect(nudged).not.toEqual(row.written);
    expect(composeStormSlots({ ...mirror, trainRadiusScale: 1.001 }, { greatSpot: true, stormTrain: true })).not.toEqual(row.slots['11']);
    // the deck-height law is INSIDE the comparison: nudging its age input moves aux.z on the warm primary
    // (a mode-0 tower; a dark primary would sit on the FLOOR regardless of age) and reds the slots
    const aged = composeStormSlots({ ...mirror, spotAge: mirror.spotAge + 0.01, trainRadiusScale: 1 }, { greatSpot: true, stormTrain: true });
    expect(aged.aux[0][2]).not.toBe(row.slots['11'].aux[0][2]);
    expect(aged).not.toEqual(row.slots['11']);
    // and an arm's-length re-derivation of the colour law agrees with the pack's (the coefficients are the lab's)
    const L = STORM_COLOR_LAW;
    expect(L.BARGE).toEqual([0.50, 0.42, 0.38]); expect(L.SCOOTER).toEqual([0.85, 0.90, 1.0]);
    expect(L.WARM_TINT_W).toBe(0.20); expect(L.WARM_CHROMO_W).toBe(0.80);
    expect(stormColor('scooter', 0, 0.3, 1, [0.1, 0.2, 0.3])).toEqual([0.85, 0.90, 1.0]);
    expect(stormColor('barge', 1, 0.3, 1, [1, 1, 1])).toEqual([0.50, 0.42, 0.38]);
  });
  it('the declared deviation list is EMPTY (no field differs from the lab\'s pre-move output)', () => {
    // If a field ever differs, AC-2 above is red and the deviation is recorded in contract.json `deviations`,
    // never absorbed here. Today the candidate deviation — T_eq fallback 288 vs condition.T_eq — is measured
    // moot: every preset defines T_eq, so the two spellings are the same number on every row.
    for (const name of Object.keys(DRIVER_PRESETS)) expect(typeof DRIVER_PRESETS[name].T_eq, name).toBe('number');
  });
  it('the lab knob `trainRadiusScale` is NOT written by the pack and its lab default is 1 (= the derived size)', () => {
    expect(STORM_LAB_KNOBS).toEqual(['trainRadiusScale']);
    expect(LAB_RAW).toMatch(/trainRadiusScale:\s*1\.0,/);
    expect(STORM_LAB_FIELDS.includes('trainRadiusScale')).toBe(false);
    const g = GAS[0];
    expect('trainRadiusScale' in stormDeckLabState(stormDeckPack(g.cond, { ...labPackCtx(g.d, g.cond, null), gates: ALL_ON() }))).toBe(false);
  });
  it('the deck-height law is STORM_DECK\'s tower/floor form', () => {
    expect(stormDeckZ(1, 0.5)).toBe(0.0);
    expect(stormDeckZ(0, 0)).toBeCloseTo(0.7 + 0.2 * 0.35, 12);
    expect(stormDeckZ(0, 1)).toBeCloseTo(0.9, 12);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC-3 — coherence: the vortices the game PLACES are the vortices its aStorm MASK was baked around', () => {
  const giantEntry = PACKS.find((e) => e.name === 'giantDeck');
  it('32 of 32 corpus gas bodies: pack meta.vortices deep-equals the mask bake\'s own list; counts agree', () => {
    let n = 0;
    for (const b of GAS) {
      const ctx = labPackCtx(b.d, b.cond, MESH);
      const deck = giantDeckPack(b.cond, { ...ctx, gates: gatesFor(giantEntry) });
      expect(deck.meta.baked, b.id).toBe(true);
      const bake = bakeStormEAttributes(MESH.positions, MESH.count, 1.0, {
        regime: deck.meta.regime,
        drivers: { ...deck.meta.e5Drivers, composition: b.cond.atmosphere && b.cond.atmosphere.composition, T_eq: b.cond.T_eq },
        macroSeed: ctx.macroSeed | 0, stormSeed: GAME_STORM_SEED | 0,
      });
      const storm = stormDeckPack(b.cond, { ...ctx, gates: gatesFor(STORM_DECK_ENTRY) });
      expect(storm.meta.vortices, b.id).toEqual(bake.vortices);
      expect(storm.meta.count, b.id).toBe(deck.meta.stormCount);
      expect(storm.meta.writerCount, b.id).toBe(bake.count);
      expect(storm.meta.tintFallback, b.id).toBe(false);
      n++;
    }
    expect(n).toBe(32);
  });
  it('[CONTROL] the coherence gate CAN fail: a different storm seed on one side moves the vortices on every gas body', () => {
    let red = 0;
    for (const b of GAS) {
      const ctx = labPackCtx(b.d, b.cond, MESH);
      const deck = giantDeckPack(b.cond, { ...ctx, gates: gatesFor(giantEntry) });
      const bake = bakeStormEAttributes(MESH.positions, MESH.count, 1.0, {
        regime: deck.meta.regime, drivers: { ...deck.meta.e5Drivers, composition: b.cond.atmosphere && b.cond.atmosphere.composition, T_eq: b.cond.T_eq },
        macroSeed: ctx.macroSeed | 0, stormSeed: 1,
      });
      const storm = stormDeckPack(b.cond, { ...ctx, gates: gatesFor(STORM_DECK_ENTRY) });
      if (JSON.stringify(storm.meta.vortices) !== JSON.stringify(bake.vortices)) red++;
    }
    expect(red).toBe(32);
  });
  it('[CONTROL] T_eq reaches the vortices ONLY through the vigor thresholds: crossing one flips the family on 32/32; a 1 K nudge flips 0/32 (measured by the verify workflow 2026-09-03 and WITHDRAWN as a control)', () => {
    // vigor = smooth01(55, 130, T_eq) with DARK_VIGOR 0.35 and LATTICE_VIGOR 0.70 — the family is a
    // step function of T_eq, so the honest control sends every body to the OPPOSITE end of the ramp.
    let flipped = 0; const nudged = [];
    const fam = (m) => JSON.stringify([m.primary && m.primary.role, m.primary && m.primary.mode, m.train.map((v) => v.role)]);
    for (const b of GAS) {
      const ctx = { ...labPackCtx(b.d, b.cond, MESH), gates: gatesFor(STORM_DECK_ENTRY) };
      const base = stormDeckPack(b.cond, ctx);
      const cross = stormDeckPack({ ...b.cond, T_eq: base.meta.vigor >= 0.5 ? 60 : 300 }, ctx);
      if (fam(cross.meta) !== fam(base.meta)) flipped++;
      const nudge = stormDeckPack({ ...b.cond, T_eq: b.cond.T_eq + 1 }, ctx);
      if (JSON.stringify(nudge.meta.vortices) !== JSON.stringify(base.meta.vortices)) nudged.push(`${b.id} T_eq ${Math.round(b.cond.T_eq)} vigor ${base.meta.vigor.toFixed(3)}`);
    }
    expect(flipped).toBe(32);
    // MEASURED 2026-09-03: exactly the two bodies that sit within 1 K of a vigor threshold flip (the
    // workflow's read-only pass read 0 comparing families through the mask bake). Pinned as the
    // measured number so the withdrawal is itself a measurement, not a shrug: 2 of 32 is not a control.
    expect(nudged, nudged.join(' | ')).toHaveLength(2);
  });
  it('solid bodies: the registry never applies the pack, and a direct call emits nothing but the off-gate mirror', () => {
    for (const b of SOLID) {
      expect(selectPacks(b.cond, labPackCtx(b.d, b.cond, null)).map((e) => e.name).includes('stormDeck'), b.id).toBe(false);
    }
    // direct calls on every solid class the world engine has: the corpus's rocky body plus the icy and
    // carbon PRESETS (the corpus may hold none of a class; the presets always do)
    const presetCond = (name) => deriveConditionVector(DRIVER_PRESETS[name], deriveUniforms(DRIVER_PRESETS[name], 1.0), DRIVER_PRESETS[name].radiusEarth ?? 1);
    const cases = [['rocky', SOLID[0].cond, labPackCtx(SOLID[0].d, SOLID[0].cond, null)],
      ['icy', presetCond('Europa (icy moon)'), { macroSeed: 1, displayRadiusEarth: 1, animRate: 1, relevance: {} }],
      ['carbon', presetCond('Carbon (high C/O)'), { macroSeed: 1, displayRadiusEarth: 1, animRate: 1, relevance: {} }]];
    for (const [cls, cond, ctx] of cases) {
      expect(compositionClass(cond), cls).toBe(cls);
      const r = stormDeckPack(cond, { ...ctx, gates: ALL_ON() });
      expect(r.drivers, cls).toEqual({});
      expect(r.attributes, cls).toEqual({});
      expect(stormDeckLabState(r), cls).toEqual({ spotStrength: 0, trainStrength: 0, trainSpots: [], trainCount: 0, _stormUranian: false });
    }
    expect(SOLID.length).toBe(124);
  });
  it('an absent gate key THROWS (the writer\'s rule, applied by hand because a composed array carries no gate)', () => {
    const g = GAS[0]; const ctx = labPackCtx(g.d, g.cond, null);
    expect(() => stormDeckPack(g.cond, { ...ctx, gates: { [GREAT_SPOT_GATE]: true } })).toThrow(PackContractError);
    expect(() => stormDeckPack(g.cond, ctx)).toThrow(/ctx\.gates has no/);
    // and the gates compose the slots the lab's checkboxes would: train only ⇒ slot 0 is a train member
    const full = stormDeckPack(g.cond, { ...ctx, gates: ALL_ON() });
    const trainOnly = stormDeckPack(g.cond, { ...ctx, gates: { [GREAT_SPOT_GATE]: false, [STORM_TRAIN_GATE]: true } });
    const spotOnly = stormDeckPack(g.cond, { ...ctx, gates: { [GREAT_SPOT_GATE]: true, [STORM_TRAIN_GATE]: false } });
    expect(spotOnly.meta.count).toBe(1);
    expect(trainOnly.meta.count).toBe(Math.min(full.meta.train.length, STORM_SLOT_CAP));
    expect(trainOnly.drivers.uStormPosSize[0]).toEqual(full.drivers.uStormPosSize[1]);
    expect(full.meta.count).toBe(1 + trainOnly.meta.count);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC-4 — the population: every gas body gets its family from its condition; no two are the same world', () => {
  const rows = [];
  for (const b of GAS) {
    const ctx = labPackCtx(b.d, b.cond, null);
    const t0 = performance.now();
    const r = stormDeckPack(b.cond, { ...ctx, gates: ALL_ON() });
    const ms = performance.now() - t0;
    const p = r.meta.primary;
    rows.push({
      id: b.id, R: +(b.cond.radiusEarth).toFixed(2), regime: r.meta.regime, T_eq: Math.round(b.cond.T_eq), vigor: +r.meta.vigor.toFixed(2),
      count: r.meta.count, primary: p ? `${p.role}/m${p.mode}` : '-', train: r.meta.train.map((v) => v.role).join('+') || '-',
      lat: p ? +(p.lat * 180 / Math.PI).toFixed(1) : null, lon: p ? +(p.lon * 180 / Math.PI).toFixed(1) : null,
      hot: r.meta.hotJupiter, uranian: r.meta.uranian, ms: +ms.toFixed(3),
    });
  }
  const by = (k) => rows.reduce((m, r) => (m[r[k]] = (m[r[k]] || 0) + 1, m), {});
  const summary = {
    gasBodies: rows.length, regime: by('regime'), primary: by('primary'), train: by('train'), count: by('count'),
    hotJupiter: rows.filter((r) => r.hot).length, uranian: rows.filter((r) => r.uranian).length,
    distinctLat: new Set(rows.map((r) => r.lat)).size, distinctLon: new Set(rows.map((r) => r.lon)).size,
    msMax: Math.max(...rows.map((r) => r.ms)), msMean: +(rows.reduce((a, r) => a + r.ms, 0) / rows.length).toFixed(3),
  };
  writeFileSync(join(process.env.TMPDIR || '/tmp', 'storm-corpus.json'), JSON.stringify({ summary, rows }, null, 1));

  it('RECORDED (not pinned): 32 gas bodies, 26 warm / 6 dark primaries, 22 pearl / 4 barge+oval / 6 scooter families, 2–7 storms each', () => {
    expect(summary.gasBodies).toBe(32);
    // the scoping read (docs/WORKSTREAMS/wire-storm-slice-lab-into-game/scoping-corpus-2026-09-02.json); a
    // change here is a population change Max hears about, so the family counts ARE pinned — the lats/lons are not.
    expect(summary.primary).toEqual({ 'grs/m0': 26, 'dark-spot/m1': 6 });
    expect(summary.regime).toEqual({ 'sub-neptune': 19, saturnian: 6, neptunian: 7 });
    expect(Object.keys(summary.count).map(Number).sort()).toEqual([2, 3, 5, 6, 7]);
    // the two never-rendered branches in the game, named
    expect(summary.hotJupiter).toBe(0);
    expect(summary.uranian).toBe(0);
    expect(rows.every((r) => r.count >= 2 && r.count <= 7)).toBe(true);
  });
  it('PINNED distinctness floor: ≥ 20 distinct primary latitudes AND longitudes over the 32 (a constant seed collapses both)', () => {
    expect(summary.distinctLat).toBeGreaterThanOrEqual(20);
    expect(summary.distinctLon).toBeGreaterThanOrEqual(20);
  });
  it('[CONTROL] a constant macroSeed collapses the longitudes below the floor (one draw per regime)', () => {
    const lons = new Set();
    for (const b of GAS) {
      const r = stormDeckPack(b.cond, { ...labPackCtx(b.d, b.cond, null), macroSeed: 7, gates: ALL_ON() });
      lons.add(r.meta.primary ? +(r.meta.primary.lon * 180 / Math.PI).toFixed(1) : null);
    }
    expect(lons.size).toBeLessThan(20);
  });
  it('seed identity: the same body mounted twice yields identical slots; two gas bodies of one system differ', () => {
    const b = GAS[0];
    const a1 = stormDeckPack(b.cond, { ...labPackCtx(b.d, b.cond, null), gates: ALL_ON() });
    const a2 = stormDeckPack(conditionFromBody(b.d), { ...labPackCtx(b.d, conditionFromBody(b.d), null), gates: ALL_ON() });
    expect(a1.drivers).toEqual(a2.drivers);
    const sameSystem = GAS.filter((x) => x.seed === b.seed);
    expect(sameSystem.length).toBeGreaterThan(1);
    const other = sameSystem[1];
    const o = stormDeckPack(other.cond, { ...labPackCtx(other.d, other.cond, null), gates: ALL_ON() });
    expect(o.drivers.uStormPosSize[0]).not.toEqual(a1.drivers.uStormPosSize[0]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC-6 (static half) — nothing else moves: emitted sets are disjoint, solid bodies untouched', () => {
  it('on a gas body the five uStorm* names are written by stormDeck and by NO other pack; on a solid body by none', () => {
    const u = makeUniforms(LAB_WORLD_LIGHT);
    const g = GAS[0];
    const res = applyDriverPacks({ uniforms: u }, g.cond, labPackCtx(g.d, g.cond, MESH));
    expect(res.applied.includes('stormDeck')).toBe(true);
    for (const name of STORM_DRIVEN) expect(res.uniformsWritten.filter((n) => n === name).length, name).toBe(1);
    // membership: every other pack's driver set is uStorm*-free (measured over its real output, not its prefix)
    for (const [name, r] of Object.entries(res.results)) {
      if (name === 'stormDeck') continue;
      expect(Object.keys(r.drivers).filter((n) => STORM_DRIVEN.includes(n)), name).toEqual([]);
    }
    expect(new Set(Object.keys(res.results.stormDeck.drivers))).toEqual(new Set(STORM_DRIVEN));
    expect(u.uStormCount.value).toBe(res.meta.stormDeck.count);
    const s = SOLID[0]; const us = makeUniforms(LAB_WORLD_LIGHT);
    const rs = applyDriverPacks({ uniforms: us }, s.cond, labPackCtx(s.d, s.cond, MESH));
    expect(rs.skipped.includes('stormDeck')).toBe(true);
    expect(rs.uniformsWritten.some((n) => STORM_DRIVEN.includes(n))).toBe(false);
    expect(us.uStormCount.value).toBe(0);
  });
  it('the shrink-only ratchet: the mirror writes only fields the lab already had (no new state field)', () => {
    // Twelve of the fifteen are in the lab's `state` literal; the other three (spotAge / spotEmboss /
    // spotBillow) were ALWAYS created dynamically by applyStormState (S2's append-only substrate) and are
    // now created by the mirror the same way — so the lab's literal is unchanged and no name is new.
    const literal = ['spotStrength', 'spotCenter', 'spotRadius', 'spotRot', 'spotAspect', 'spotMode', 'spotColor',
      'spotCompanion', 'trainStrength', 'trainSpots', 'trainCount'];
    for (const f of literal) expect(LAB_RAW, f).toMatch(new RegExp(`\\n\\s+${f}:\\s`));
    for (const f of STORM_LAB_FIELDS) expect(PACK_CODE, f).toContain(f);
    expect(LAB_RAW).toContain('_stormUranian');   // still read by applyDrivers (the F31 hazeMute bump)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC-7 — cost recorded: microseconds per body, zero VRAM, no worker, no new ctx field', () => {
  it('per-body resolve time is finite and small; attributes are empty; the game ctx gained nothing', () => {
    const rows = JSON.parse(readFileSync(join(process.env.TMPDIR || '/tmp', 'storm-corpus.json'), 'utf8')).rows;
    expect(rows.every((r) => Number.isFinite(r.ms) && r.ms < 50)).toBe(true);
    const g = GAS[0]; const ctx = labPackCtx(g.d, g.cond, null);
    expect('stormSeed' in ctx).toBe(false);
    expect('obliquityDeg' in ctx).toBe(false);
    expect(stormDeckPack(g.cond, { ...ctx, gates: ALL_ON() }).attributes).toEqual({});
    expect(stormDeckPack(g.cond, { ...ctx, gates: ALL_ON() }).meta.stormSeed).toBe(GAME_STORM_SEED);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC-5 (headless half) — the A/B instrument on a MOUNTED gas planet: register, toggle, sabotage, restore', () => {
  it('a mounted gas planet registers; OFF is count 0; sabotage is a THIRD state; restore returns the ON slots; dispose unregisters', () => {
    setLabGasBodiesOverride(true);
    try {
      const b = GAS[0];
      const p = new Planet({ sunDirection: [1, 0, 0], ...b.d }, null);
      const surface = p.surface; const u = surface.material.uniforms;
      expect(surface.userData.wd.lab.packsApplied).toContain('stormDeck');
      const meta = surface.userData.wd.lab.meta.stormDeck;
      expect(meta.count).toBeGreaterThan(1);
      const S = globalThis._labStorms;
      expect(S).toBeDefined();
      const n0 = S.count(); expect(n0).toBeGreaterThanOrEqual(1);
      // ON: the live slots are the pack's composed slots
      const on = S.slots(surface);
      expect(on.count).toBe(meta.count);
      expect(on.posSize[0]).toEqual([meta.primary.center[0], meta.primary.center[1], meta.primary.center[2], meta.primary.radius]);
      expect(u.uStormCount.value).toBe(meta.count);
      // OFF: count 0 on the material, ON restores the composed count
      expect(S.toggle(true).off).toBe(true); expect(u.uStormCount.value).toBe(0);
      expect(S.toggle(false).off).toBe(false); expect(u.uStormCount.value).toBe(meta.count);
      // SABOTAGE: another storm seed ⇒ different slots, count kept live, flagged on the record
      const sab = S.sabotage(surface, 1);
      expect(sab.sabotagedSeed).toBe(1);
      const sabSlots = S.slots(surface);
      expect(sabSlots.posSize).not.toEqual(on.posSize);
      expect(sabSlots.count).toBe(sab.count);
      expect(S.record(surface).sabotagedSeed).toBe(1);
      // RESTORE: back to the ON slots exactly
      S.restore(surface);
      const back = S.slots(surface);
      expect([back.count, back.posSize, back.params, back.color, back.aux]).toEqual([on.count, on.posSize, on.params, on.color, on.aux]);
      expect(S.record(surface).sabotagedSeed).toBe(null);
      // a solid planet never registers
      const s = SOLID[0];
      const ps = new Planet({ sunDirection: [1, 0, 0], ...s.d }, null);
      expect(S.slots(ps.surface).count).toBe(0);
      expect(S.record(ps.surface)).toBe(null);
      ps.dispose();
      p.dispose();
      expect(S.count()).toBe(n0 - 1);
    } finally {
      setLabGasBodiesOverride(null);
    }
  });
});
