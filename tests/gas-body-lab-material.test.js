// tests/gas-body-lab-material.test.js — PLAN §4 "Step 6" parts 6a, 6d and 6e.
//
// WHAT THIS SUITE IS FOR, in one sentence: Step 6 is the first step that changes a pixel a player
// sees, and the three things that decide WHICH pixels — the pack predicate, the Sol exclusion and
// the flag — are each a one-expression decision whose wrong answer is silent.
//
// ⛔ EVERY GATE BELOW HAS AN EXECUTED CONTROL THAT MOVED, and most of them carry the control INSIDE
// the suite rather than in a lane report, because a control recorded only in prose is a claim that
// the next reader cannot re-run. Where the control is an in-test mutant it is named `CONTROL —`.
//
// ── THE THREE SCARS THIS SUITE IS SHAPED BY ──────────────────────────────────────────────────────
//  1. A GATE THAT PINS COUNTS DOES NOT PIN MEMBERSHIP (Step 4: a count-preserving permutation
//     passed every instrument byte-identically). So `PACKS` is pinned as a SET OF NAMES, and the
//     "which files mount the lab material" fence is pinned as a SET OF PATHS.
//  2. A RATCHET CAN SHIP BLIND TO AN IDIOM ITS OWN COMMIT INTRODUCES (Step 5). The idiom this
//     commit introduces is "mount the lab material" — so the fence that watches it is the one that
//     asks which FILES do that, and it is written to fail when a second one appears rather than to
//     check that the first one still does.
//  3. A FALSE CLAIM OF CLOSURE IS WORSE THAN AN OPEN HOLE. `worldEngineProvenance` does not cover a
//     PLAIN moon, and §6d-LIMIT below pins that with the construct that produced it instead of
//     letting Step 10 rediscover it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as resolvePath } from 'node:path';

import {
  Planet,
  labPipelineAdmits, worldEngineProvenance, labGasBodiesFlag, labGasBodiesEnabled,
  setLabGasBodiesOverride, labMacroSeed, labPackCtx, rotationHoursFromSpeed,
  LAB_GAS_BODIES_DEFAULT, LAB_GAS_BODIES_KEY, SOL_SYSTEM_SEED,
  GAME_ANIM_RATE, GAME_RELEVANCE,
} from '../src/objects/Planet.js';
import { PACKS, applyDriverPacks, selectPacks, gatesFor, GATE_POLICY_ALL_ON } from '../src/worldengine/drivers/index.js';
import { buildLabPlanetMaterial, isLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import { BodyRenderer } from '../src/rendering/objects/BodyRenderer.js';
import { conditionFromPlanet } from '../src/worldengine/port/conditionFromPlanet.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { generateSolarSystem } from '../src/generation/SolarSystemData.js';
import { PackContractError, gameDisplayRadiusEarth } from '../src/worldengine/port/writePackUniforms.js';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Populations, built once. Both front doors: a real Sol, and real generated systems.
// ─────────────────────────────────────────────────────────────────────────────

/** Every Sol body — planets AND moons — as `{ id, d, kind }`. */
function solBodies() {
  const out = [];
  const sys = generateSolarSystem();
  sys.planets.forEach((w, i) => {
    out.push({ id: `planet#${i}:${w.planetData.profileId || w.planetData.type}`, d: w.planetData, kind: 'planet' });
    (w.moons || []).forEach((m, j) => {
      out.push({ id: `moon#${i}.${j}:${m.profileId || m.type}`, d: m, kind: 'moon' });
    });
  });
  return out;
}

/** Generated planets over N seeds, as `{ id, d, cond }`. */
function generatedPlanets(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const seed = `s6-${i}`;
    const sys = StarSystemGenerator.generate(seed, null);
    (sys.planets || []).forEach((e) => {
      out.push({ id: `${seed}#${e.planetData._ordinal}`, d: e.planetData, cond: conditionFromPlanet(e.planetData) });
    });
  }
  return out;
}

const SOL = solBodies();
const GENERATED = generatedPlanets(24);
const GEN_GAS = GENERATED.filter((b) => compositionClass(b.cond) === 'gas');
const GEN_SOLID = GENERATED.filter((b) => compositionClass(b.cond) !== 'gas');

// A body the game can actually construct: Planet's constructor reads `sunDirection` and `radius`.
const buildable = (d) => ({ sunDirection: [1, 0, 0], ...d });

/** Build one Planet at a chosen flag value and hand back the surface + its material. */
function planetAt(d, enabled) {
  setLabGasBodiesOverride(enabled);
  try {
    const p = new Planet(buildable(d), null);
    return { planet: p, surface: p.surface, material: p.surface.material, lab: p.surface.userData?.wd?.lab || null };
  } finally {
    setLabGasBodiesOverride(null);
  }
}

beforeEach(() => { setLabGasBodiesOverride(null); });
afterEach(() => { setLabGasBodiesOverride(null); });

// ═════════════════════════════════════════════════════════════════════════════
// 6a — THE PACKS ARRAY
// ═════════════════════════════════════════════════════════════════════════════
describe('6a — PACKS is an array with pinned MEMBERSHIP, not a pinned length', () => {
  // Step 4 measured that a count-preserving permutation is byte-identical to every instrument this
  // program owns. A `expect(PACKS.length).toBe(1)` would therefore pass a commit that swapped the
  // gas deck for something else entirely.
  it('the membership is exactly the names Step 6 ships', () => {
    expect(PACKS.map((e) => e.name)).toEqual(['giantDeck']);
  });

  it('every entry carries the four contract fields, and the array is frozen', () => {
    expect(Object.isFrozen(PACKS)).toBe(true);
    for (const e of PACKS) {
      expect(typeof e.name).toBe('string');
      expect(typeof e.applies).toBe('function');
      expect(typeof e.pack).toBe('function');
      expect(Array.isArray(e.gates)).toBe(true);
      expect(e.applies.length).toBeLessThanOrEqual(2);   // (condition, ctx)
    }
  });

  it('gatesFor is ALL_ON over the DECLARED names only, and refuses an unknown policy', () => {
    expect(gatesFor(PACKS[0])).toEqual({ bands: true, jets: true });
    expect(gatesFor(PACKS[0], GATE_POLICY_ALL_ON)).toEqual({ bands: true, jets: true });
    expect(() => gatesFor(PACKS[0], 'everything')).toThrow(PackContractError);
  });

  it('a driver gated on an UNDECLARED name still throws — ALL_ON did not become a blanket yes', () => {
    // The whole reason `gates` is declared per entry instead of a permissive proxy: writePackUniforms
    // treats an absent key as an unanswered rendering decision, and a proxy would answer it `true`.
    const entry = { name: 'x', gates: ['bands'], applies: () => true, pack: () => ({}) };
    const gates = gatesFor(entry);
    expect(gates).toEqual({ bands: true });
    expect('jets' in gates).toBe(false);
  });
});

// ── The predicate audit, and the mutant it is measured against ────────────────────────────────────
//
// `auditPredicate` is the gate. It is run over the REAL entries (must be clean) and over a
// deliberately mis-derived predicate (must be dirty) in the same file, so "this check can fail" is
// executed rather than asserted.
const TYPE_LABELS = [
  'gas-giant', 'hot-jupiter', 'eyeball', 'sub-neptune',
  'rocky', 'ice', 'lava', 'ocean', 'terrestrial', 'venus', 'carbon',
];

function auditPredicate(applies, gasCond, solidCond) {
  const findings = [];
  const src = String(applies);
  // 1. SOURCE: it may not mention the label channel at all.
  if (/\.type\b/.test(src)) findings.push('reads .type');
  for (const label of TYPE_LABELS) {
    if (src.includes(`'${label}'`) || src.includes(`"${label}"`)) findings.push(`names type label ${label}`);
  }
  // 2. BEHAVIOUR: the answer must be invariant to the label, on a body it says YES to...
  const base = applies(gasCond);
  for (const label of TYPE_LABELS) {
    if (applies({ ...gasCond, type: label }) !== base) findings.push(`label ${label} moved the YES answer`);
  }
  // ...and on a body it says NO to. (Half of this alone is passable: a predicate keyed on `type`
  // whose spread copy happens to keep answering the same way on one body proves nothing.)
  const baseSolid = applies(solidCond);
  for (const label of TYPE_LABELS) {
    if (applies({ ...solidCond, type: label }) !== baseSolid) findings.push(`label ${label} moved the NO answer`);
  }
  // 3. LIVENESS: it must not be a constant. A predicate that always says yes passes 1 and 2.
  if (base === baseSolid) findings.push('predicate does not separate the two populations');
  return findings;
}

describe('6a — every pack predicate is DERIVED FROM THE CONDITION, never from a type label', () => {
  const gasCond = GEN_GAS[0]?.cond;
  const solidCond = GEN_SOLID[0]?.cond;

  it('the populations the audit runs on are real and non-empty', () => {
    expect(GEN_GAS.length).toBeGreaterThan(5);
    expect(GEN_SOLID.length).toBeGreaterThan(5);
    expect(compositionClass(gasCond)).toBe('gas');
    expect(compositionClass(solidCond)).not.toBe('gas');
  });

  for (const entry of PACKS) {
    it(`${entry.name}: audit clean`, () => {
      expect(auditPredicate(entry.applies, gasCond, solidCond)).toEqual([]);
    });
  }

  it('CONTROL — the audit REDS on the mis-derivation PLAN 6d forbids (`d.type === "gas-giant"`)', () => {
    const mis = (c) => c.type === 'gas-giant';
    const findings = auditPredicate(mis, gasCond, solidCond);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.join('|')).toMatch(/reads \.type/);
    expect(findings.join('|')).toMatch(/names type label gas-giant/);
  });

  it('CONTROL — the audit REDS on a predicate that is condition-shaped but constant', () => {
    expect(auditPredicate(() => true, gasCond, solidCond))
      .toContain('predicate does not separate the two populations');
  });

  it('CONTROL — the audit REDS on a predicate that reads .type without naming a literal', () => {
    // The label-literal clause alone would miss this: `GAS_TYPES.has(c.type)` names no label here.
    const sneaky = (c) => new Set(TYPE_LABELS.slice(0, 4)).has(c.type);
    expect(auditPredicate(sneaky, gasCond, solidCond).join('|')).toMatch(/reads \.type/);
  });

  it('the predicate moves when the CONDITION field it reads moves', () => {
    // The positive half: not merely label-blind, but actually driven by the composition channel.
    const noEnvelope = { ...gasCond, atmosphere: { ...gasCond.atmosphere, composition: 'co2' } };
    expect(PACKS[0].applies(gasCond)).toBe(true);
    expect(PACKS[0].applies(noEnvelope)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6a — applyDriverPacks
// ═════════════════════════════════════════════════════════════════════════════
describe('6a — applyDriverPacks composes the array onto a real lab material', () => {
  const gas = () => GEN_GAS[0];

  function runOn(body) {
    const built = buildLabPlanetMaterial({ bodyRadius: body.d.radius });
    const geo = new THREE.IcosahedronGeometry(body.d.radius, 3);
    const pos = geo.getAttribute('position');
    const res = applyDriverPacks(built.material, body.cond, labPackCtx(body.d, body.cond, {
      positions: pos.array, count: pos.count, radius: body.d.radius,
    }));
    return { material: built.material, res, count: pos.count };
  }

  it('a gas body: the deck runs, the master gates are 1.0, the bake is real', () => {
    const { material, res, count } = runOn(gas());
    expect(res.applied).toEqual(['giantDeck']);
    expect(res.skipped).toEqual([]);
    expect(material.uniforms.uBandStrength.value).toBe(1.0);
    expect(material.uniforms.uJetStrength.value).toBe(1.0);
    expect(res.gates).toEqual({ bands: true, jets: true });
    expect(Object.keys(res.attributes).sort()).toEqual(['aBand', 'aMush', 'aShear']);
    expect(res.attributes.aBand.length).toBe(count);
    // Non-zero variance — a constant aBand is what a dead bake looks like.
    const a = res.attributes.aBand;
    expect(new Set(Array.from(a)).size).toBeGreaterThan(8);
  });

  it('a solid body: nothing applies and NOT ONE uniform moved', () => {
    const built = buildLabPlanetMaterial({ bodyRadius: 1 });
    const before = Object.fromEntries(
      Object.entries(built.material.uniforms).map(([k, v]) => [k, typeof v.value === 'number' ? v.value : null]),
    );
    const b = GEN_SOLID[0];
    const res = applyDriverPacks(built.material, b.cond, labPackCtx(b.d, b.cond, undefined));
    expect(res.applied).toEqual([]);
    expect(res.skipped).toEqual(['giantDeck']);
    const after = Object.fromEntries(
      Object.entries(built.material.uniforms).map(([k, v]) => [k, typeof v.value === 'number' ? v.value : null]),
    );
    expect(after).toEqual(before);
  });

  it('refuses a material with no uniforms, and refuses a caller-supplied gates map', () => {
    const b = gas();
    expect(() => applyDriverPacks({}, b.cond, labPackCtx(b.d, b.cond)))
      .toThrow(/no uniforms map/);
    const built = buildLabPlanetMaterial({ bodyRadius: 1 });
    expect(() => applyDriverPacks(built.material, b.cond, { ...labPackCtx(b.d, b.cond), gates: { bands: true, jets: true } }))
      .toThrow(/gates is supplied per-entry/);
  });

  it('requires the front-end display policy — it never invents one', () => {
    const b = gas();
    const built = buildLabPlanetMaterial({ bodyRadius: 1 });
    const ctx = labPackCtx(b.d, b.cond);
    delete ctx.displayRadiusEarth;
    expect(() => applyDriverPacks(built.material, b.cond, ctx)).toThrow(/displayRadiusEarth is REQUIRED/);
  });

  it('the game passes the GAME display policy, and it is the identity on radiusEarth', () => {
    const b = gas();
    const ctx = labPackCtx(b.d, b.cond);
    expect(ctx.displayRadiusEarth).toBe(gameDisplayRadiusEarth(b.cond.radiusEarth));
    expect(ctx.animRate).toBe(GAME_ANIM_RATE);
    expect(ctx.relevance).toBe(GAME_RELEVANCE);
    expect('gates' in ctx).toBe(false);
  });
});

describe('6a — the module reaches no renderer, and its npm surface is pinned by NAME', () => {
  const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g;
  function closureOf(entryRel, reader = read) {
    const seen = new Set();
    const bare = [];
    const walk = (rel) => {
      if (seen.has(rel)) return;
      seen.add(rel);
      const src = reader(rel);
      IMPORT_RE.lastIndex = 0;
      let m;
      while ((m = IMPORT_RE.exec(src)) !== null) {
        const spec = m[1];
        if (spec.startsWith('.') || spec.startsWith('/')) {
          walk(resolvePath(dirname(join(ROOT, rel)), spec).slice(ROOT.length + 1));
        } else {
          bare.push(`${rel} -> ${spec}`);
        }
      }
    };
    walk(entryRel);
    return { files: [...seen], bare };
  }

  // ⚠ MEASURED, AND IT CORRECTED A CLAIM THIS FILE ORIGINALLY MADE. "The closure is base/ + port/,
  // all of which are three-free, so there are no bare specifiers" is FALSE as written: the base
  // tree reaches `alea` and `simplex-noise` (the seeded streams giant-drivers / climate-e5 /
  // band-flow already own). tests/pack-contract.test.js's zero-bare assertion holds only for
  // `featureScale.js` and `writePackUniforms.js`, which reach neither. The property that actually
  // matters here is narrower and is asserted as such: NO RENDERER in the closure, and the npm
  // surface pinned by NAME so a new dependency in the shared tree is a deliberate edit rather than
  // a silent one.
  it('no renderer is reachable from src/worldengine/drivers/index.js', () => {
    const c = closureOf('src/worldengine/drivers/index.js');
    const deps = [...new Set(c.bare.map((b) => b.split(' -> ')[1]))].sort();
    expect(deps).not.toContain('three');
    expect(deps).toEqual(['alea', 'simplex-noise']);
    expect(c.files).toContain('src/worldengine/drivers/giantDeck.js');
    expect(c.files.length).toBeGreaterThan(3);
  });

  it('index.js itself introduces no npm import — every one comes from the base modules', () => {
    const c = closureOf('src/worldengine/drivers/index.js');
    expect(c.bare.filter((b) => b.startsWith('src/worldengine/drivers/index.js ->'))).toEqual([]);
  });

  it('CONTROL — the walker DOES report a bare specifier when one exists', () => {
    const fake = {
      'a.js': "import { z } from './b.js';\n",
      'b.js': "import * as THREE from 'three';\n",
    };
    const c = closureOf('a.js', (rel) => fake[rel]);
    expect(c.bare).toEqual(['b.js -> three']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6d — THE SOL EXCLUSION, IN CODE
// ═════════════════════════════════════════════════════════════════════════════
describe('6d — no Sol body reaches the pack path, and the reason is provenance', () => {
  it('the Sol population is the real one (39 bodies, planets and moons)', () => {
    expect(SOL.length).toBeGreaterThanOrEqual(39);
    expect(SOL.filter((b) => b.kind === 'planet').length).toBe(13);
    expect(SOL.filter((b) => b.kind === 'moon').length).toBeGreaterThan(20);
  });

  it('⛔ ZERO Sol bodies are admitted — with the flag FORCED ON, the state in which it can fail', () => {
    setLabGasBodiesOverride(true);
    const admitted = SOL.filter((b) => labPipelineAdmits(b.d, conditionFromPlanet(b.d)).admitted);
    expect(admitted.map((b) => b.id)).toEqual([]);
  });

  it('⛔ still zero when every Sol body is relabelled `type: "gas-giant"`', () => {
    // The branch cannot be reading the label, so mass-relabelling must be inert. If someone ever
    // "simplifies" the admission test back to a type check, this is the assertion that reds.
    setLabGasBodiesOverride(true);
    const relabelled = SOL.map((b) => ({ ...b, d: { ...b.d, type: 'gas-giant' } }));
    const admitted = relabelled.filter((b) => labPipelineAdmits(b.d, conditionFromPlanet(b.d)).admitted);
    expect(admitted.map((b) => b.id)).toEqual([]);
  });

  // ── NON-VACUITY. Each clause below is measured, so "zero admitted" is not zero-by-accident. ──
  it('NON-VACUITY 1 — the CONDITION-derived predicate alone admits Sol bodies', () => {
    // Sol's Uranus and Neptune really do read `compositionClass === 'gas'`. A pipeline gated only on
    // the pack predicate would render two Sol planets through the lab material while every
    // measurement rule in this program excludes Sol from observation.
    const gasBySol = SOL.filter((b) => compositionClass(conditionFromPlanet(b.d)) === 'gas');
    expect(gasBySol.length).toBeGreaterThan(0);
    expect(gasBySol.map((b) => b.d.profileId).sort()).toEqual(['sol-neptune', 'sol-uranus']);
  });

  it('NON-VACUITY 2 — absence of `profileId` alone does NOT exclude Sol', () => {
    // PLAN 6d names exactly this clause. Measured: 23 of Sol's 39 bodies carry no profileId, four of
    // them PLANETS. Today none is gas-class, so nothing is admitted — but that is the pack predicate
    // saving the provenance test, not the provenance test working, and it stops being true at
    // Step 9 when a rocky pack claims all four.
    const noProfile = SOL.filter((b) => !b.d.profileId);
    expect(noProfile.length).toBeGreaterThan(0);
    expect(noProfile.filter((b) => b.kind === 'planet').length).toBe(4);
    // …and the second clause is what actually refuses them:
    for (const b of noProfile.filter((x) => x.kind === 'planet')) {
      expect(worldEngineProvenance(b.d).blockers).toContain(`_systemSeed=${SOL_SYSTEM_SEED}`);
    }
  });

  it('NON-VACUITY 3 — the type set and the condition set are DISJOINT on Sol', () => {
    // This is the fact PLAN 6d is built on, restated as a measurement rather than a quotation:
    // `type === 'gas-giant'` picks Jupiter and Saturn; `compositionClass === 'gas'` picks Uranus and
    // Neptune; the intersection is empty. Two branches, two different pairs of planets, and only one
    // of them is answering a question about the body.
    const byType = SOL.filter((b) => b.d.type === 'gas-giant').map((b) => b.d.profileId).sort();
    const byCond = SOL.filter((b) => compositionClass(conditionFromPlanet(b.d)) === 'gas').map((b) => b.d.profileId).sort();
    expect(byType).toEqual(['sol-jupiter', 'sol-saturn']);
    expect(byCond).toEqual(['sol-neptune', 'sol-uranus']);
    expect(byType.filter((x) => byCond.includes(x))).toEqual([]);
  });

  it('CONTROL — the forbidden branch (`d.type === "gas-giant"`) DOES admit Sol', () => {
    const misAdmitted = SOL.filter((b) => b.d.type === 'gas-giant');
    expect(misAdmitted.map((b) => b.d.profileId).sort()).toEqual(['sol-jupiter', 'sol-saturn']);
  });

  it('END-TO-END — a real Sol planet built with the flag ON keeps the legacy material', () => {
    for (const id of ['sol-jupiter', 'sol-saturn', 'sol-uranus', 'sol-neptune']) {
      const body = SOL.find((b) => b.d.profileId === id);
      expect(body, id).toBeTruthy();
      const { material, lab } = planetAt(body.d, true);
      expect(isLabPlanetMaterial(material), id).toBe(false);
      expect(material.uniforms.uLimbMix, id).toBeTruthy();      // the legacy game material's own dial
      expect(lab, id).toBe(null);
    }
  });

  it('⛔ 6d-LIMIT — exactly ONE Sol body is refused for a reason that is not about Sol', () => {
    // ⚠ RECORDED, NOT CLOSED, AND THE NUMBER IS MEASURED RATHER THAN ESTIMATED. Sol carries 39
    // bodies. 38 of them are refused by the `_systemSeed === 'sol'` clause — every planet, and 25
    // of 26 moons, because `generateSolarSystem` stamps the seed all the way down.
    //
    // The 39th is a MOON of Saturn (`type: 'venus'`, the Titan slot) that carries no `profileId`,
    // no `_systemSeed` and no `_ordinal`. It is refused today ONLY by the seed-key clause — which
    // exists for the 5d macroSeed and says nothing about Sol. That is accidental safety, and this
    // program does not accept accidental safety as a gate, so it is written down here instead.
    //
    // It is unreachable at Step 6 (nothing but `Planet` calls this, and a plain moon goes to
    // `Moon.js`). PLAN Step 10 routes plain moons through `BodyRenderer.createMoon`. On that day
    // this function must grow a real Sol test — the assertion below is what Step 10 inherits.
    const solBlocked = SOL.filter((b) => worldEngineProvenance(b.d).blockers.includes(`_systemSeed=${SOL_SYSTEM_SEED}`));
    const notSolBlocked = SOL.filter((b) => !worldEngineProvenance(b.d).blockers.includes(`_systemSeed=${SOL_SYSTEM_SEED}`));
    expect(solBlocked.length).toBe(SOL.length - 1);
    expect(notSolBlocked.length).toBe(1);
    expect(notSolBlocked[0].kind).toBe('moon');
    expect(worldEngineProvenance(notSolBlocked[0].d).blockers).toEqual(['no _systemSeed', 'no _ordinal']);
    // …and it is a Sol body that no Sol clause refuses: give it the two fields a planet-class moon
    // already receives and provenance says yes.
    const smuggled = { ...notSolBlocked[0].d, _systemSeed: 'not-sol', _ordinal: 'pm-0' };
    expect(worldEngineProvenance(smuggled).isWorldEngine).toBe(true);
  });

  it('a PLANET-class moon, however, IS covered — main.js stamps the parent system seed', () => {
    // src/main.js:7415 `_systemSeed: systemData.seed,` — so a Sol planet-class moon arrives at
    // Planet.js carrying `'sol'`, and clause 2 refuses it. This is the route PLAN §12.4/E-2 records
    // as the one that gets missed.
    const pmLikeSol = { ...SOL.find((b) => b.kind === 'moon').d, _systemSeed: 'sol', _ordinal: 'pm-0' };
    expect(worldEngineProvenance(pmLikeSol).isWorldEngine).toBe(false);
    expect(worldEngineProvenance(pmLikeSol).blockers).toContain('_systemSeed=sol');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6e — THE FLAG
// ═════════════════════════════════════════════════════════════════════════════
describe('6e — the flag is OFF by default and it selects a DIFFERENT material', () => {
  const body = () => GEN_GAS[0];

  it('the default is OFF, and the read reports WHICH source answered', () => {
    expect(LAB_GAS_BODIES_DEFAULT).toBe(false);
    const f = labGasBodiesFlag();
    expect(f).toEqual({ enabled: false, source: 'default', default: false });
    expect(labGasBodiesEnabled()).toBe(false);
  });

  it('an override is reported as an override, and clears back to the environment', () => {
    setLabGasBodiesOverride(true);
    expect(labGasBodiesFlag()).toEqual({ enabled: true, source: 'override', default: false });
    setLabGasBodiesOverride(false);
    expect(labGasBodiesFlag().enabled).toBe(false);
    expect(labGasBodiesFlag().source).toBe('override');
    setLabGasBodiesOverride(null);
    expect(labGasBodiesFlag().source).toBe('default');
  });

  it('the storage key is named, because the OFF twin is "flag off PLUS A RELOAD"', () => {
    // 6e: `_lab.restoreGameMaterial()` cannot be the OFF twin — the legacy material for a swapped
    // body is never constructed, so there is nothing in the registry to restore. The twin is a
    // reload, and a value that does not survive a reload cannot produce it.
    expect(LAB_GAS_BODIES_KEY).toBe('wd.labGasBodies');
    expect(read('src/objects/Planet.js')).toMatch(/localStorage/);
  });

  it('⭐ OFF vs ON select different materials on the SAME body — asserted, not assumed', () => {
    const b = body();
    const off = planetAt(b.d, false);
    const on = planetAt(b.d, true);

    expect(isLabPlanetMaterial(off.material)).toBe(false);
    expect(isLabPlanetMaterial(on.material)).toBe(true);

    // Not merely a different object: a different PROGRAM. (three caches GPU programs by source, so
    // "different source" is the whole mechanism by which these are two materials and not one.)
    expect(on.material.fragmentShader).not.toBe(off.material.fragmentShader);
    expect(on.material.fragmentShader.length).toBeGreaterThan(off.material.fragmentShader.length * 5);

    // And a named uniform on each side that the other does not carry. Both directions, because a
    // one-directional check passes on a superset.
    expect(off.material.uniforms.uLimbMix).toBeTruthy();
    expect(on.material.uniforms.uLimbMix).toBeUndefined();
    expect(on.material.uniforms.uBandStrength).toBeTruthy();
    expect(off.material.uniforms.uBandStrength).toBeUndefined();
  });

  it('ON: the deck actually drove the material, and the bake is on the geometry', () => {
    const b = body();
    const { surface, material, lab } = planetAt(b.d, true);
    expect(material.uniforms.uBandStrength.value).toBe(1.0);
    expect(material.uniforms.uJetStrength.value).toBe(1.0);

    const aBand = surface.geometry.getAttribute('aBand');
    expect(aBand).toBeTruthy();
    expect(aBand.count).toBe(surface.geometry.getAttribute('position').count);
    expect(new Set(Array.from(aBand.array)).size).toBeGreaterThan(8);

    // aStorm is the zero-fill: its producer is fenced out of pack #1 by name, and "zero" here has
    // to be readable as a decision rather than as an accident.
    expect(lab.bakedAttributes.sort()).toEqual(['aBand', 'aMush', 'aShear']);
    expect(lab.zeroFilledAttributes).toEqual(['aStorm']);
    expect(Array.from(surface.geometry.getAttribute('aStorm').array).every((v) => v === 0)).toBe(true);
  });

  it('the E caption can print the flag AND its source off the body itself (§12.5 fact 6)', () => {
    const { lab } = planetAt(body().d, true);
    expect(lab.isLabPipeline).toBe(true);
    expect(lab.flag).toEqual({ enabled: true, source: 'override', default: false });
    expect(lab.packsApplied).toEqual(['giantDeck']);
    expect(lab.gates).toEqual({ bands: true, jets: true });
    expect(lab.provenance.isWorldEngine).toBe(true);
    expect(lab.uniformsWritten).toContain('uBandStrength');
  });

  it('the §12.3 E-3 back-link survives the swap — a swapped body is still nameable', () => {
    const { surface } = planetAt(body().d, true);
    expect(surface.userData.wd.planetData).toBeTruthy();
    expect(surface.userData.wd.condition).toBeTruthy();
    expect(compositionClass(surface.userData.wd.condition)).toBe('gas');
  });

  it('a WORLD-ENGINE SOLID planet is untouched with the flag ON (Instrument C stays at zero)', () => {
    // Step 6's own gate: "Instrument C on the still-legacy bodies: zero delta." The mechanism that
    // makes that true is here — no pack claims a solid condition, so nothing is admitted.
    const b = GEN_SOLID[0];
    const { material, lab } = planetAt(b.d, true);
    expect(isLabPlanetMaterial(material)).toBe(false);
    expect(lab).toBe(null);
    expect(labPipelineAdmits(b.d, b.cond).packs).toEqual([]);
  });

  it('every STAMPED generated gas planet swaps, and no solid one does', () => {
    setLabGasBodiesOverride(true);
    const stampedGas = GEN_GAS.filter((b) => worldEngineProvenance(b.d).isWorldEngine);
    const gasAdmitted = GEN_GAS.filter((b) => labPipelineAdmits(b.d, b.cond).admitted);
    const solidAdmitted = GEN_SOLID.filter((b) => labPipelineAdmits(b.d, b.cond).admitted);
    expect(gasAdmitted.length).toBe(stampedGas.length);
    expect(solidAdmitted.length).toBe(0);
  });

  it('⛔ FOUND HERE, NOT FIXED HERE — ExoticOverlay strips the seed key off the bodies it swaps', () => {
    // MEASURED over 24 seeds / 119 generated planets: 2 planets carry NO `_systemSeed`, NO
    // `_ordinal` and no `_canonicalName`. Both are exotic types ('machine', 'crystal'), and the
    // cause is src/generation/ExoticOverlay.js:342 `planetEntry.planetData = newData;` — the
    // overlay REPLACES the planetData with a fresh `PlanetGenerator.generate()` result, and
    // src/generation/StarSystemGenerator.js:567 `planetData._ordinal = i;` already ran, so the
    // stamps go with the old object.
    //
    // TWO consequences, and only the first is this lane's:
    //   1. HERE: an exotic body is refused the pack path and silently keeps the legacy material —
    //      "renders on some bodies and not others with nothing complaining", which is the exact
    //      failure 6a exists to prevent, arriving through the generator instead of through a
    //      missed branch. Admitting it instead would be worse: its macroSeed key would be
    //      `'undefined:undefined'` for EVERY such body, which is the 5d collapse.
    //   2. NOT HERE, and larger: src/util/scene-naming.js:78 `return { id: 'unseeded', fullHash: null, isCanonical: false };`
    //      is what these bodies get for a NAME. PLAN §12.4 E-2 requires every Instrument E hook to
    //      address a body by NAME. Two exotics in one system share the name `body.planet.unseeded`.
    //
    // This test asserts the SHAPE and the CAUSE, not a golden count — the count moves with the
    // sample. It fails the day the overlay stops stripping, which is the correct direction: whoever
    // fixes it should see this test name.
    const unstamped = GENERATED.filter((b) => !worldEngineProvenance(b.d).isWorldEngine);
    expect(unstamped.length).toBeGreaterThan(0);
    for (const b of unstamped) {
      expect(worldEngineProvenance(b.d).blockers).toEqual(['no _systemSeed', 'no _ordinal']);
      expect(b.d.profileId == null).toBe(true);
    }
    // The cause, pinned at its source so this cannot be re-explained as something else.
    expect(read('src/generation/ExoticOverlay.js')).toMatch(/planetEntry\.planetData = newData;/);
    expect(read('src/generation/StarSystemGenerator.js')).toMatch(/planetData\._ordinal = i;/);
    // And at least one of them is gas-class — i.e. this is not a hypothetical loss at Step 6.
    expect(unstamped.some((b) => compositionClass(b.cond) === 'gas')).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// The seed, and the writers that go quiet
// ═════════════════════════════════════════════════════════════════════════════
describe('6a/5d — the game supplies a per-body macroSeed of the shape 5d pins', () => {
  it('numeric, non-zero, and DIFFERENT per ADMITTED body', () => {
    // ⚠ "per admitted body", not "per body", and the qualifier is the finding above: the two
    // ExoticOverlay-swapped planets hash the same `'undefined:undefined'` key as each other. They
    // are refused before the seed is used, which is why this is scoped rather than relaxed — a gate
    // that gets loosened the first time it fires destroys the gate class it belongs to.
    const admitted = GEN_GAS.filter((b) => worldEngineProvenance(b.d).isWorldEngine);
    expect(admitted.length).toBeGreaterThan(20);
    const seeds = admitted.map((b) => labMacroSeed(b.d));
    for (const s of seeds) {
      expect(Number.isInteger(s)).toBe(true);
      expect(s).not.toBe(0);
    }
    expect(new Set(seeds).size).toBe(seeds.length);
    // The collapse this scoping is NOT hiding: the refused bodies really do collide.
    const refused = GEN_GAS.filter((b) => !worldEngineProvenance(b.d).isWorldEngine);
    if (refused.length > 1) {
      expect(new Set(refused.map((b) => labMacroSeed(b.d))).size).toBe(1);
    }
  });

  it('a body with no `_ordinal` is refused, because its seed would be a CONSTANT', () => {
    // `'undefined:undefined'` hashes to one value for the whole population — the 5d hex-collapse
    // defect in different clothes, and equally invisible to every gate on driver algebra.
    const anon = { ...GEN_GAS[0].d };
    delete anon._ordinal;
    expect(worldEngineProvenance(anon).blockers).toContain('no _ordinal');
    setLabGasBodiesOverride(true);
    expect(labPipelineAdmits(anon, GEN_GAS[0].cond).admitted).toBe(false);
  });

  it('two bodies that differ ONLY by seed key get different band fields', () => {
    // The only assertion that catches a constant macroSeed: hash the seeded FIELD, not the algebra.
    const b = GEN_GAS[0];
    const hash = (d) => {
      const built = buildLabPlanetMaterial({ bodyRadius: d.radius });
      const geo = new THREE.IcosahedronGeometry(d.radius, 2);
      const pos = geo.getAttribute('position');
      const res = applyDriverPacks(built.material, b.cond, labPackCtx(d, b.cond, {
        positions: pos.array, count: pos.count, radius: d.radius,
      }));
      return Array.from(res.attributes.aBand).join(',');
    };
    expect(hash(b.d)).not.toBe(hash({ ...b.d, _ordinal: `${b.d._ordinal}-alt` }));
  });

  it('rotationHoursFromSpeed inverts the game\'s stored rate, and refuses to invent one', () => {
    // Earth: legacy 0.1 deg/s x ROTATION_REALISM_FACTOR (1/24) = one 24-hour turn.
    expect(rotationHoursFromSpeed(0.1 / 24)).toBeCloseTo(24, 9);
    expect(rotationHoursFromSpeed(-0.1 / 24)).toBeCloseTo(24, 9);   // retrograde spins at the same RATE
    expect(rotationHoursFromSpeed(0)).toBe(null);                    // tidally locked is not 0 hours
    expect(rotationHoursFromSpeed(undefined)).toBe(null);
  });

  it('the drawn spin actually reaches the pack — it is not the canonical 24 for everyone', () => {
    // The hazard PLAN 5c names: the condition vector carries only the canonical spin, so a
    // front-end that draws per body must PASS it or every giant in the galaxy shares one band count.
    const withSpin = GEN_GAS.filter((b) => (b.d.rotationSpeed || 0) !== 0);
    expect(withSpin.length).toBeGreaterThan(3);
    const hours = withSpin.map((b) => labPackCtx(b.d, b.cond).rotationHours);
    expect(new Set(hours.map((h) => Math.round(h * 100))).size).toBeGreaterThan(1);
    for (const b of withSpin) expect(b.cond.rotationHours).toBe(24);   // …which is what it would be
  });
});

describe('6e safety — turning the flag ON does not throw from any writer this suite can reach', () => {
  // ⚠ THIS IS NOT INSTRUMENT D AND MUST NOT BE READ AS IT. D is ≥120 real frames with
  // `window.onerror` + `unhandledrejection` installed on a live system, and it belongs to the lane
  // that owns main.js. This is the headless subset: the per-body writers reachable from Planet and
  // BodyRenderer, driven on a body that HAS swapped. It cannot see main.js's frame loop at all.
  it('Planet.updateSim / updateRender / setRingGaps survive a lab-material body', () => {
    const { planet } = planetAt(GEN_GAS[0].d, true);
    expect(isLabPlanetMaterial(planet.surface.material)).toBe(true);
    expect(() => { planet.updateSim(1 / 60, 1 / 60); }).not.toThrow();
    expect(() => { planet.updateRender(1 / 60); }).not.toThrow();
    expect(() => { planet.setRingGaps([]); }).not.toThrow();
    // The seam ran: the lab's own clock advanced even though `mat.uniforms.time` does not exist.
    expect(planet.surface.material.uniforms.uTime.value).toBeGreaterThan(0);
    expect(planet.surface.material.uniforms.time).toBeUndefined();
  });

  it('BodyRenderer.setLOD / setReliefDetail survive it, and RECORD the writers that went quiet', () => {
    setLabGasBodiesOverride(true);
    try {
      const br = BodyRenderer.createPlanet(buildable(GEN_GAS[0].d), null, null);
      expect(isLabPlanetMaterial(br.surface.material)).toBe(true);
      expect(br.labPipeline?.isLabPipeline).toBe(true);
      expect(() => br.setLOD(2)).not.toThrow();
      expect(() => br.setReliefDetail(8, new THREE.Vector3(0, 0, 40))).not.toThrow();
      // The witness: `lodLevel` is a uniform the lab material does not declare, so the write was a
      // silent no-op before this counter existed. PLAN 6b lists it as a lost feature.
      expect(br.labSkips.lodLevel).toBeGreaterThan(0);
      // …and the lab material's OWN detail ramp did move, which is the half that must not be lost.
      expect(br.surface.material.uniforms.uOctaves.value).toBeGreaterThan(4.0);
    } finally {
      setLabGasBodiesOverride(null);
    }
  });

  it('CONTROL — the skip counter stays EMPTY on a legacy body, so it is not counting everything', () => {
    const br = BodyRenderer.createPlanet(buildable(GEN_GAS[0].d), null, null);   // flag default OFF
    expect(isLabPlanetMaterial(br.surface.material)).toBe(false);
    br.setLOD(2);
    expect(br.labSkips).toEqual({});
    expect(br.labPipeline).toBe(null);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// THE FENCE ON THE IDIOM THIS COMMIT ITSELF INTRODUCES
// ═════════════════════════════════════════════════════════════════════════════
describe('the mount-site fence — what does this gate NOT see that this commit adds?', () => {
  // Step 5's ratchet shipped blind to an idiom Step 5 introduced, inside the function it watched.
  // The idiom THIS commit introduces is "mount the lab material on a game body". Everything above
  // tests the ONE site that does it; nothing above would notice a SECOND one. This does.
  const SRC_FILES = (() => {
    const out = [];
    const walk = (rel) => {
      for (const ent of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
        const child = `${rel}/${ent.name}`;
        if (ent.isDirectory()) walk(child);
        else if (ent.name.endsWith('.js')) out.push(child);
      }
    };
    walk('src');
    return out;
  })();

  // ⛔ COMMENTS ARE STRIPPED FIRST, and that is not tidiness. `src/rendering/ShaderWarmup.js:93`
  // carries the token `buildLabPlanetMaterial().material` inside a `//` comment; a raw
  // `includes()` counts it as a mount site, which is the DEAD-COMMENT-TEXT failure
  // tests/helpers/source-scan.mjs was promoted to end. Measured: without the strip this fence
  // names three files and one of them compiles nothing.
  const liveCallers = (token) => SRC_FILES
    .filter((f) => f !== 'src/rendering/LabPlanetMaterial.js')   // it DEFINES the builder
    .filter((f) => stripCommentsPreservingOffsets(read(f)).includes(token));

  // The SET, with each entry's role, pinned by PATH. A new entry is a red, and the red is the
  // point — but the red is ALSO a coordination cost, so the two additions that are already known to
  // be coming are named here rather than left to surprise someone:
  //   · `src/rendering/ShaderWarmup.js` — PLAN 6c pre-warms the 363 KB lab program, and
  //     ShaderWarmup.js:93 already carries `buildLabPlanetMaterial().material` IN A COMMENT
  //     describing a `buildLabProbeMaterial` that does not exist yet. When it does, add the path.
  //   · `src/rendering/objects/BodyRenderer.js` — PLAN Step 10's moon branch.
  // Both are legitimate. Neither may arrive without someone editing this line.
  const EXPECTED_MOUNT_SITES = [
    'src/main.js',            // _lab.tryLabShader — the Instrument E harness. Swaps at RUNTIME on
                              // an already-built body, refuses a body that already carries the lab
                              // material, and is driven by hand. Not the pipeline.
    'src/objects/Planet.js',  // THE PIPELINE. Selects at material-CREATION time, behind the 6e flag
                              // and the 6d provenance test.
  ];

  it('the set of files that mount the lab material is exactly the expected one, by PATH', () => {
    expect(liveCallers('buildLabPlanetMaterial(').sort()).toEqual(EXPECTED_MOUNT_SITES);
  });

  it('CONTROL — the comment strip changes the answer, on a corpus this file owns', () => {
    // ⚠ SYNTHETIC ON PURPOSE, and the first version of this test was not. It asserted that
    // `src/rendering/ShaderWarmup.js` carries the token in a comment — which is TRUE in the working
    // tree and FALSE at HEAD, because that comment is another lane's in-flight edit. A control that
    // reds when a file this lane does not own changes a comment is not a control, it is a tripwire
    // on someone else's work. The property being controlled is the STRIPPER's, so the corpus is the
    // stripper's too.
    const commented = '// see buildLabPlanetMaterial() for the probe\nconst x = 1;\n';
    const live = '/* nope */ const m = buildLabPlanetMaterial({});\n';
    expect(commented.includes('buildLabPlanetMaterial(')).toBe(true);
    expect(stripCommentsPreservingOffsets(commented).includes('buildLabPlanetMaterial(')).toBe(false);
    expect(stripCommentsPreservingOffsets(live).includes('buildLabPlanetMaterial(')).toBe(true);
    // Offsets preserved, which is what lets the fence report true line numbers.
    expect(stripCommentsPreservingOffsets(commented).length).toBe(commented.length);
  });

  it('the raw scan is a SUPERSET of the live one — the strip only ever removes', () => {
    // Non-vacuous exactly when some file mentions the token in a comment, which is a fact about the
    // tree at any given moment and not something this lane may pin.
    const raw = SRC_FILES
      .filter((f) => f !== 'src/rendering/LabPlanetMaterial.js')
      .filter((f) => read(f).includes('buildLabPlanetMaterial('));
    for (const f of liveCallers('buildLabPlanetMaterial(')) expect(raw).toContain(f);
  });

  it('the PIPELINE mount runs the admission test in the same function', () => {
    // Not merely "the file mentions it somewhere": the guard and the mount have to be in one
    // function, or a later edit can keep both tokens and separate them.
    const src = read('src/objects/Planet.js');
    const start = src.indexOf('_createLabSurface(geometry, d, condition) {');
    expect(start).toBeGreaterThan(0);
    const body = src.slice(start, start + 2600);
    expect(body).toMatch(/labPipelineAdmits\(/);
    expect(body).toMatch(/buildLabPlanetMaterial\(/);
    expect(body.indexOf('labPipelineAdmits(')).toBeLessThan(body.indexOf('buildLabPlanetMaterial('));
    expect(body).toMatch(/if \(!decision\.admitted\) return null;/);
  });

  it('CONTROL — the same window check REDS on a mount with the gate removed', () => {
    const withoutGate = '_createLabSurface(geometry, d, condition) {\n'
      + '    const built = buildLabPlanetMaterial({ bodyRadius: d.radius });\n  }';
    expect(/labPipelineAdmits\(/.test(withoutGate)).toBe(false);
  });

  it('CONTROL — and it REDS when the gate is present but AFTER the mount', () => {
    const reordered = 'const built = buildLabPlanetMaterial({}); const d2 = labPipelineAdmits(d, c);';
    expect(reordered.indexOf('labPipelineAdmits(')).toBeGreaterThan(reordered.indexOf('buildLabPlanetMaterial('));
  });

  it('the legacy GAS_BODY branch is still present — deletion is Step 12, not this one', () => {
    const src = read('src/objects/Planet.js');
    expect(src).toMatch(/const GAS_BODY = /);
    expect(src).toMatch(/gas: \{ vertexShader: SURFACE_VERTEX, fragmentShader: FRAG_HEADER \+ GAS_BODY \}/);
  });
});
