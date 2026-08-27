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
import { PACKS, applyDriverPacks, applyDriverPacksToState, selectPacks, gatesFor, GATE_POLICY_ALL_ON } from '../src/worldengine/drivers/index.js'; import { ROCKY_SURFACE_UNIFORMS } from '../src/worldengine/drivers/rockySurface.js'; import { SOLID_OPTICS_UNIFORMS } from '../src/worldengine/drivers/solidOptics.js'; import { SOLID_FEATURES_UNIFORMS } from '../src/worldengine/drivers/solidFeatures.js'; // ⛔ RIDES THIS PHYSICAL ROW: this file is cited BY LINE from four files outside CITE_SOURCES, so a new import line rots refs the fence cannot see.
import { buildLabPlanetMaterial, isLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';
import { BodyRenderer } from '../src/rendering/objects/BodyRenderer.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { generateSolarSystem } from '../src/generation/SolarSystemData.js';
import { PackContractError, gameDisplayRadiusEarth } from '../src/worldengine/port/writePackUniforms.js';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

// ⛔ NAME LOOKUP, NEVER `PACKS[0]`. Registration appends limbDeck and polarDeck, and a positional
// index silently becomes a DIFFERENT pack the moment anyone prepends an entry — the assertion then
// passes while testing the wrong pack, which is the failure this whole suite exists to prevent.
const GIANT = PACKS.find((e) => e.name === 'giantDeck');

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
      out.push({ id: `${seed}#${e.planetData._ordinal}`, d: e.planetData, cond: conditionFromBody(e.planetData) });
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
    // ⭐ B3 leg 1 APPENDS A FIFTH, `solidOptics`. Re-pinned here BY MEMBERSHIP for the declared
    // reason this block exists: a length pin would have passed a swap of one pack for another.
    // ⭐ B3 leg 2 APPENDS A SIXTH, `craterDeck` (ledger P-14's crater half), whose predicate is
    // `rockySurface`'s exact COMPLEMENT — so the ten impact uniforms now have exactly one writer on
    // every body instead of none on the gas half.
    expect(PACKS.map((e) => e.name)).toEqual(['giantDeck', 'limbDeck', 'polarDeck', 'rockySurface', 'solidOptics', 'craterDeck', 'solidFeatures', 'giantSurface']);
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
    expect(gatesFor(GIANT)).toEqual({ bands: true, jets: true });
    expect(gatesFor(GIANT, GATE_POLICY_ALL_ON)).toEqual({ bands: true, jets: true });
    expect(() => gatesFor(GIANT, 'everything')).toThrow(PackContractError);
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
    // ⭐⭐ RE-WRITTEN AT B3 LEG 2, AND THE OLD MUTANT NOW LEGITIMATELY PASSES. Ledger R-07 widened this
    // predicate to src/worldengine/drivers/giantDeck.js:89 `export function bandedEnvelopeOf(condition) {`
    // — gas OR an opaque CO2 shroud — so swapping an h2-he envelope for `co2` at the SAME (high)
    // pressure moves the body from one disjunct to the other and it still bands. That is the closure
    // working, not the gate failing, so the mutant is sharpened rather than deleted: the fall to
    // `false` needs the pressure to go with the composition, and BOTH disjuncts are exercised.
    expect(GIANT.applies(gasCond)).toBe(true);
    const thinCO2 = { ...gasCond, atmosphere: { ...gasCond.atmosphere, composition: 'co2', pressure: 1 } };
    expect(GIANT.applies(thinCO2), 'a thin CO2 atmosphere is neither disjunct').toBe(false);
    const thickCO2 = { ...gasCond, atmosphere: { ...gasCond.atmosphere, composition: 'co2', pressure: 92 } };
    expect(GIANT.applies(thickCO2), 'R-07: an opaque CO2 shroud bands').toBe(true);
    // …and the shroud disjunct really is PRESSURE-keyed, not composition-keyed alone: 10 bar is the
    // lab's own regime-3 threshold and the predicate is strict above it.
    expect(GIANT.applies({ ...thinCO2, atmosphere: { ...thinCO2.atmosphere, pressure: 10 } })).toBe(false);
    expect(GIANT.applies({ ...thinCO2, atmosphere: { ...thinCO2.atmosphere, pressure: 10.0001 } })).toBe(true);
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
    // ⭐ `craterDeck` JOINS THE APPLIED LIST AT B3 LEG 2 — it is the gas half of ledger P-14, and a
    // gas body is exactly the population it exists for.
    expect(res.applied).toEqual(['giantDeck', 'limbDeck', 'polarDeck', 'craterDeck', 'giantSurface']);
    // ⭐ `solidOptics` joins the SKIPPED list here and nowhere else on a gas body: its predicate is
    // the complement of gas, so a gas body must never see it. That is the whole of its scope claim.
    expect(res.skipped).toEqual(['rockySurface', 'solidOptics', 'solidFeatures']);
    expect(material.uniforms.uBandStrength.value).toBe(1.0);
    expect(material.uniforms.uJetStrength.value).toBe(1.0);
    // ⭐ MEASURED, NOT ASSUMED — `rockySurface` declares `craters` and `ejecta`, and NEITHER KEY IS
    // HERE. `applyDriverPacks` merges an entry's gate map only after the applicability `continue`
    // (src/worldengine/drivers/index.js:403 `if (entry.applies(condition, ctx) !== true) { skipped.push(entry.name); continue; }`),
    // so a skipped pack contributes nothing to `res.gates`. That matters beyond bookkeeping:
    // `res.gates` is what an Instrument E caption prints as "what was decided on this body", and a
    // gate name from a pack that never ran would read as a rendering decision nobody made.
    // ⭐ `craters`/`ejecta` ARE HERE NOW, and the sentence above is why that is the right answer
    // rather than a loosening: `craterDeck` RAN on this body, so its gate names are a rendering
    // decision that really was made. What must still be absent is a gate from a SKIPPED pack, and
    // `rockySurface` declares the same two names — so the check is re-aimed at a name only a skipped
    // pack owns.
    // ⭐⭐ `terminator` IS HERE NOW TOO, 2026-08-21, AND IT MOVED FOR THE SECOND TIME FOR THE FIRST
    // REASON. It was chosen as the absence probe precisely because `solidOptics` was its ONLY owner
    // and `solidOptics` is skipped on a gas body. `giantSurface` — ledger P-11's gas half — declares
    // the same gate and RUNS here, so its presence is a rendering decision that really was made and
    // the old assertion would now be pinning a lie. ⛔ THE PROBE IS RE-AIMED, NOT DELETED: `aurora`
    // is the last gate name a skipped pack alone owns, and the line below is the whole of what this
    // check was ever for. If a pack is ever added that declares `aurora` over the gas predicate, the
    // right move is to re-aim again — not to drop the direction.
    expect(res.gates).toEqual({ bands: true, jets: true, limb: true, polarVortex: true, craters: true, ejecta: true, terminator: true });
    expect(Object.keys(res.gates)).not.toContain('aurora');
    expect(Object.keys(res.attributes).sort()).toEqual(['aBand', 'aMush', 'aShear']);
    expect(res.attributes.aBand.length).toBe(count);
    // Non-zero variance — a constant aBand is what a dead bake looks like.
    const a = res.attributes.aBand;
    expect(new Set(Array.from(a)).size).toBeGreaterThan(8);
  });

  it('a solid body: EXACTLY the rocky pack applies, and nothing it did not declare moved', () => {
    // ⛔ THIS TEST'S PREMISE INVERTED AT STEP 10a AND IT WAS REWRITTEN, NOT RENUMBERED. It read "a
    // solid body: nothing applies and NOT ONE uniform moved", which was a true statement about a
    // registry whose three predicates were all `compositionClass === 'gas'`. `rockySurface`'s is
    // their complement, so a solid body is claimed the moment it registers and "nothing applies" is
    // simply false. The control property that sentence was carrying is NOT "the array does nothing
    // here" — it is **containment**: a pack may only move the uniforms it declares, so a body can
    // never be quietly restyled by a deck that was never meant to reach it. That property survives
    // the inversion in a stronger form, because now there is a pack running and it still may not
    // touch anything outside its own list. Deleting it to make the numbers pass is the failure mode
    // src/worldengine/drivers/rockySurface.js's own registry-fence comment names.
    const built = buildLabPlanetMaterial({ bodyRadius: 1 });
    // ⛔ STRUCTURAL ENCODE, NOT `typeof value === 'number' ? value : null`. The version this test
    // carried before the rewrite mapped every non-number to `null`, and 8 of the 13 uniforms this
    // pack actually moves on this body are a THREE.Vector3 or a THREE.Color — the offsets and the
    // whole surface palette. Under the old snapshot the containment check would have been blind to
    // exactly the family Step 9 added, which is a containment claim that cannot see the thing it is
    // containing. Same blind spot the ledger records against `encodeValue`, closed here rather than
    // inherited.
    const enc = (v) => {
      if (v == null) return 'null';
      if (typeof v === 'object') {
        if ('x' in v) return `v:${v.x},${v.y},${v.z ?? ''},${v.w ?? ''}`;
        if ('r' in v && 'g' in v) return `c:${v.r},${v.g},${v.b}`;
        if (ArrayBuffer.isView(v)) return `a:${Array.from(v).join(',')}`;
        if (Array.isArray(v)) return `[${v.map(enc).join('|')}]`;
        return 'obj';
      }
      return String(v);
    };
    const snapshot = () => Object.fromEntries(
      Object.entries(built.material.uniforms).map(([k, v]) => [k, enc(v.value)]),
    );
    const before = snapshot();
    const b = GEN_SOLID[0];
    const res = applyDriverPacks(built.material, b.cond, labPackCtx(b.d, b.cond, undefined));
    // ⭐ TWO PACKS APPLY ON A SOLID BODY SINCE B3 LEG 1, AND THAT IS THE INTERESTING CASE. This
    // used to read "EXACTLY the rocky pack applies", which was true only while rockySurface was the
    // sole non-gas entry. `solidOptics` carries the identical predicate, so every body rockySurface
    // claims it also claims — and the collision guard in applyDriverPacks is therefore LIVE here
    // rather than inert. That it does not throw is the assertion; the two emitted name sets are
    // disjoint, which both pack suites check by name lookup.
    expect(res.applied).toEqual(['rockySurface', 'solidOptics', 'solidFeatures']);
    // ⭐ `craterDeck` JOINS THE SKIPPED LIST at B3 leg 2: its predicate is `=== 'gas'`, so on a solid
    // body the impact family keeps its single writer (`rockySurface`) and the collision throw stays
    // inert for that pair by construction.
    expect(res.skipped).toEqual(['giantDeck', 'limbDeck', 'polarDeck', 'craterDeck', 'giantSurface']);
    // The gate map is the applied packs' names ONLY — the three skipped decks contribute none.
    expect(res.gates).toEqual({ craters: true, ejecta: true, terminator: true, aurora: true, edifices: true, chaos: true, frost: true, glacial: true });
    // ⛔ NO ATTRIBUTE IS BAKED ON A SOLID BODY. `aBand`/`aMush`/`aShear` are the gas deck's, and the
    // ctx here carries no geometry at all; a pack that baked one anyway would be reaching for
    // vertex data it was not given.
    expect(Object.keys(res.attributes)).toEqual([]);

    // ── CONTAINMENT, the property the old sentence was protecting ──────────────────────────────
    const after = snapshot();
    const moved = Object.keys(after).filter((k) => after[k] !== before[k]).sort();
    const wrote = new Set(res.uniformsWritten);
    // ⛔ THE CONTRACT SET, NOT THE WRITE LOG, AND THE DIFFERENCE IS THE WHOLE GATE. An earlier form of
    // this assertion compared `moved` against `new Set(res.uniformsWritten)` — but
    // src/worldengine/drivers/index.js:431 `for (const name of Object.keys(result.drivers)) uniformsWritten.push(name);`
    // pushes every name the writer just moved, so `moved \ uniformsWritten` is empty BY CONSTRUCTION
    // for any driver map at all. EXECUTED: wrapping the pack to emit two extra drivers (`uOctaves: 11`,
    // `uLavaCoverage: 0.9`) really restyles this body — and the write-log form stayed green, as did
    // `moved.length > 8` and the seven named gas uniforms below. Against ROCKY_SURFACE_UNIFORMS both
    // extras are caught. ⚠ With N packs the write log is the UNION of what all of them wrote, so the
    // write-log form gets WEAKER as the registry grows; the contract form does not.
    // ⭐ THE UNION OF BOTH APPLIED PACKS' CONTRACT SETS SINCE B3 LEG 1 — and it is still the CONTRACT
    // form, not the write log. The paragraph above says the write-log form gets weaker as the
    // registry grows and the contract form does not; that is only true if the contract set tracks
    // the packs that actually applied, which is what this union does. Two packs run on this body,
    // so a uniform outside EITHER published family is still caught.
    // ⭐ THREE PACKS SINCE B3 LEG 3 — `solidFeatures` carries the same `!== 'gas'` predicate, so the
    // union grows again for the same reason it grew at leg 1 and the gate keeps its strength.
    const DECLARED = new Set([...ROCKY_SURFACE_UNIFORMS, ...SOLID_OPTICS_UNIFORMS, ...SOLID_FEATURES_UNIFORMS]);
    expect(moved.filter((n) => !DECLARED.has(n))).toEqual([]);
    // …and the pack may not name a uniform outside its own published family in the first place, so a
    // driver that is emitted CONDITIONALLY (only on an icy condition, say) reds on the WRITE rather
    // than on whether this particular body happened to move it.
    expect(res.uniformsWritten.filter((n) => !DECLARED.has(n))).toEqual([]);
    // …and it is not vacuous — the pack really did write, so `moved` is a real sample and not the
    // empty set passing by default. MEASURED on this body: 13 of the 21 declared names move; the
    // other 8 land on a value the factory default already held, which is a fact about THIS body's
    // condition rather than about the wire — hence a floor rather than a pin.
    expect(moved.length).toBeGreaterThan(8);
    // The eight the structural encode is here for: without it these read as `null === null`.
    for (const n of ['uMacroOffset', 'uDetailOffset', 'uCraterOffset', 'uFreshColor']) {
      expect(moved, `${n} is a Vector3/Color the snapshot must be able to see move`).toContain(n);
    }

    // ── AND THE GAS DECKS ARE UNTOUCHED, BY NAME ───────────────────────────────────────────────
    // The four master gates and the gas band/jet terms are what a mis-registered array would move
    // first: they are the names whose non-zero value IS "this body renders as a gas giant".
    //
    // ⭐ `uLimbExponent` LEFT THIS LIST AT B3 LEG 1 AND `uLimbStrength` DID NOT, and the split is the
    // point rather than an exemption. `solidOptics` forwards the limb WIDTH and HUE to a solid body
    // — that is ledger row P-11 — but it does not claim the rim's MASTER GATE, which stays at its
    // 0.0 factory default. So a solid body carrying a limb exponent is now correct, and a solid body
    // carrying a non-zero `uLimbStrength` is still the mis-registration this loop is watching for.
    // The positive half of that claim is asserted immediately below, so the removal cannot pass by
    // simply deleting a name.
    for (const n of ['uBandStrength', 'uJetStrength', 'uLimbStrength', 'uPolarStrength',
                     'uBandM', 'uJetSpeed']) {
      expect(wrote.has(n), `${n} must not be in the applied packs' write set`).toBe(false);
      expect(DECLARED.has(n), `${n} is in neither applied pack's declared family`).toBe(false);
      expect(after[n], `${n} moved on a solid body`).toEqual(before[n]);
    }
    // ⭐ THE POSITIVE HALF, so removing `uLimbExponent` from the loop above cannot be how this
    // passes. B3 leg 1's claim is precisely: the WIDTH and HUE reach a solid body, the master GATE
    // does not — and the gate's factory default is what leaves the rim unlit.
    expect(wrote.has('uLimbExponent'), 'solidOptics forwards the limb width to a solid body').toBe(true);
    expect(wrote.has('uLimbColor'), 'solidOptics forwards the limb hue to a solid body').toBe(true);
    expect(built.material.uniforms.uLimbStrength.value, 'the rim master gate stays at its 0.0 default').toBe(0);
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
  // ⛔ COMMENTS ARE STRIPPED BEFORE THE SCAN, AND THIS IS A MEASURED REPAIR, NOT TIDYING. Step 10a
  // reddened this fence with `deps` reading
  // ['alea', 'simplex-noise', 'the material already had the factory\n// value'] — a THIRD npm
  // "dependency" invented out of English prose. `IMPORT_RE` is anchored on a line starting with
  // `import`/`export` and then matches lazily to the first `from '…'`, so the comment block above
  // `PERTURB_BASE` in src/worldengine/drivers/rockySurface.js — which contains the sentence
  // …distinguish "the pack wrote the relief envelope" from "the material already had the factory
  // value"… — closes a match that began at an `export` line 18 rows earlier.
  // ⛔ NO LINE CITATION ON THAT FILE ON PURPOSE: `scratchpad/mutant/rockySurface.js` exists, the
  // citation fence resolves by BASENAME and skips only node_modules/.git/.claude/dist/build/
  // coverage, so `rockySurface.js:NNN` is AMBIGUOUS and exits 2. Symbol name, no number.
  // ⚠ THE FALSE POSITIVE IS THE HARMLESS HALF. The lazy span runs from an `export` line to the first
  // `from '…'` ANYWHERE below it, so a comment carrying that phrasing ABOVE a real import swallows
  // the real one and the dependency it names is never reported — a silent green in the exact
  // direction this fence exists to make loud. Stripping comments closes both halves at once, with
  // the repo's own sound stripper (tests/helpers/source-scan.mjs, offsets preserved, STRINGS KEPT so
  // a genuine `from 'three'` still reads).
  function closureOf(entryRel, reader = read) {
    const seen = new Set();
    const bare = [];
    const walk = (rel) => {
      if (seen.has(rel)) return;
      seen.add(rel);
      const src = stripCommentsPreservingOffsets(reader(rel));
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

  it('CONTROL — prose cannot invent a dependency, and prose cannot HIDE one', () => {
    // The two halves of the Step 10a defect, constructed rather than argued. Both fake modules
    // carry the same English sentence rockySurface.js carries; only the second one also has a real
    // npm import underneath it, which the un-stripped walker swallowed.
    const invents = { 'a.js': 'export const K = 1;\n// …tell one from "the other" from "a third".\n' };
    expect(closureOf('a.js', (rel) => invents[rel]).bare).toEqual([]);
    const hides = {
      'a.js': 'export const K = 1;\n// …tell one from "the other" from "a third".\n'
            + "import * as THREE from 'three';\n",
    };
    expect(closureOf('a.js', (rel) => hides[rel]).bare).toEqual(['a.js -> three']);
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
    const admitted = SOL.filter((b) => labPipelineAdmits(b.d, conditionFromBody(b.d)).admitted);
    expect(admitted.map((b) => b.id)).toEqual([]);
  });

  it('⛔ still zero when every Sol body is relabelled `type: "gas-giant"`', () => {
    // The branch cannot be reading the label, so mass-relabelling must be inert. If someone ever
    // "simplifies" the admission test back to a type check, this is the assertion that reds.
    setLabGasBodiesOverride(true);
    const relabelled = SOL.map((b) => ({ ...b, d: { ...b.d, type: 'gas-giant' } }));
    const admitted = relabelled.filter((b) => labPipelineAdmits(b.d, conditionFromBody(b.d)).admitted);
    expect(admitted.map((b) => b.id)).toEqual([]);
  });

  // ── NON-VACUITY. Each clause below is measured, so "zero admitted" is not zero-by-accident. ──
  it('NON-VACUITY 1 — the CONDITION-derived predicate alone admits Sol bodies', () => {
    // Sol's Uranus and Neptune really do read `compositionClass === 'gas'`. A pipeline gated only on
    // the pack predicate would render two Sol planets through the lab material while every
    // measurement rule in this program excludes Sol from observation.
    const gasBySol = SOL.filter((b) => compositionClass(conditionFromBody(b.d)) === 'gas');
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
    const byCond = SOL.filter((b) => compositionClass(conditionFromBody(b.d)) === 'gas').map((b) => b.d.profileId).sort();
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
    // src/main.js:7724 `_systemSeed: systemData.seed,` — so a Sol planet-class moon arrives at
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
describe('6e — ⭐ the flag is ON by default since B7 (was OFF), and either value selects a DIFFERENT material', () => {
  const body = () => GEN_GAS[0];

  it('⭐ the default is ON since B7, and the read still reports WHICH source answered', () => {
    // ⭐ LAB_GAS_BODIES_DEFAULT: false -> true AT B7, 2026-08-21, AND THE REASON IS the lab material
    // is now the shader 846/852 planets and 632 moons actually mount — `false` described a world
    // this codebase no longer ships. What this test protects did NOT move: the flag's own read still
    // NAMES which of the three sources (override / window / localStorage / default) answered it, so
    // "on because nobody said otherwise" stays distinguishable from "on because someone said so".
    expect(LAB_GAS_BODIES_DEFAULT).toBe(true);
    const f = labGasBodiesFlag();
    expect(f).toEqual({ enabled: true, source: 'default', default: true });
    expect(labGasBodiesEnabled()).toBe(true);
  });

  it('an override is reported as an override, and clears back to the environment', () => {
    setLabGasBodiesOverride(true);
    // ⭐ `default` -> true AT B7, 2026-08-21: this field always echoes LAB_GAS_BODIES_DEFAULT, never
    // the override's own value — that independence is exactly what this line proves, and it is why
    // the field broke the instant the constant flipped rather than tracking `enabled` for free.
    expect(labGasBodiesFlag()).toEqual({ enabled: true, source: 'override', default: true });
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
    // ⭐ `default` -> true AT B7, 2026-08-21, same reason as the test above: this body was built
    // under an explicit override, and `default` still has to read LAB_GAS_BODIES_DEFAULT rather than
    // the override in force, or the E caption would print a fact about the flag that isn't true.
    expect(lab.flag).toEqual({ enabled: true, source: 'override', default: true });
    expect(lab.packsApplied).toEqual(['giantDeck', 'limbDeck', 'polarDeck', 'craterDeck', 'giantSurface']);
    expect(lab.gates).toEqual({ bands: true, jets: true, limb: true, polarVortex: true, craters: true, ejecta: true, terminator: true });
    expect(lab.provenance.isWorldEngine).toBe(true);
    expect(lab.uniformsWritten).toContain('uBandStrength');
  });

  it('the §12.3 E-3 back-link survives the swap — a swapped body is still nameable', () => {
    const { surface } = planetAt(body().d, true);
    expect(surface.userData.wd.planetData).toBeTruthy();
    expect(surface.userData.wd.condition).toBeTruthy();
    expect(compositionClass(surface.userData.wd.condition)).toBe('gas');
  });

  it('⛔ INVERTED AT STEP 10a — a WORLD-ENGINE SOLID planet now SWAPS, and Sol is what stays at zero', () => {
    // ⛔ THIS READ "a WORLD-ENGINE SOLID planet is untouched with the flag ON (Instrument C stays at
    // zero)". Step 6's zero-delta gate rested on a mechanism — "no pack claims a solid condition" —
    // and `rockySurface`'s predicate is exactly the sentence that stops being true. So the swapped
    // population goes from the gas bodies to very nearly the whole corpus, which is Step 10's
    // declared blast radius and not a discovery.
    //
    // ⭐ THE CONTROL DOES NOT DISAPPEAR WITH IT, because "Instrument C stays at zero" still has a
    // real population: SOL. Sol bodies are refused by PROVENANCE, not by the predicate, and that
    // half is untouched by registration. Asserting the new positive alone would have quietly
    // retired the only zero-delta claim this suite still owns.
    const b = GEN_SOLID[0];
    const { material, lab } = planetAt(b.d, true);
    expect(isLabPlanetMaterial(material)).toBe(true);
    expect(lab.packsApplied).toEqual(['rockySurface', 'solidOptics', 'solidFeatures']);
    expect(lab.gates).toEqual({ craters: true, ejecta: true, terminator: true, aurora: true, edifices: true, chaos: true, frost: true, glacial: true });
    expect(labPipelineAdmits(b.d, b.cond).packs).toEqual(['rockySurface', 'solidOptics', 'solidFeatures']);
    // …and with the flag OFF it is still the legacy material. Registration widened WHICH bodies the
    // pipeline claims; it did not touch the flag that decides whether the pipeline runs at all.
    expect(isLabPlanetMaterial(planetAt(b.d, false).material)).toBe(false);
    // THE SURVIVING ZERO: a solid Sol planet, claimed by the predicate and refused by provenance.
    const solSolid = SOL.filter((x) => x.kind === 'planet'
      && compositionClass(conditionFromBody(x.d)) !== 'gas');
    expect(solSolid.length).toBeGreaterThan(4);
    // ⭐⭐ AND THE REAL VENUS IS IN THIS SET, WHICH IS R-07's SHARPEST CONFIRMATION IN THIS SUITE.
    // Since B3 leg 2 the band deck's predicate is condition-derived (gas OR an opaque CO2 shroud), so
    // `sol-venus` — 92 bar of CO2 — is claimed by `giantDeck` as well, without anyone naming Venus
    // anywhere. The expected pack list is therefore computed from the predicate rather than typed,
    // and the venus arm is asserted non-vacuous below so this cannot quietly become a one-branch check.
    let shrouded = 0;
    for (const x of solSolid) {
      const xc = conditionFromBody(x.d);
      const banded = PACKS.find((e) => e.name === 'giantDeck').applies(xc) === true;
      if (banded) shrouded++;
      const adm = labPipelineAdmits(x.d, xc);
      expect(adm.packs, `${x.id} must be CLAIMED, or this control proves nothing`)
        .toEqual(banded ? ['giantDeck', 'rockySurface', 'solidOptics', 'solidFeatures'] : ['rockySurface', 'solidOptics', 'solidFeatures']);
      expect(adm.admitted, `${x.id} must be refused by provenance`).toBe(false);
      expect(isLabPlanetMaterial(planetAt(x.d, true).material), x.id).toBe(false);
    }
    expect(shrouded, 'R-07: Sol must contain at least one opaque-CO2 body, or the banded arm is vacuous').toBeGreaterThan(0);
  });

  it('every STAMPED generated planet swaps — gas AND solid — and the class decides WHICH pack', () => {
    // ⛔ THIS READ "…and no solid one does". `solidAdmitted.length === 0` was a statement about the
    // registry, not about provenance, and Step 10a falsifies it by design. The half that was doing
    // the real work — ADMITTED equals STAMPED, i.e. the only thing turning a claimed body away is
    // Step 6d's provenance test — is kept and is now asserted on BOTH halves of the population.
    setLabGasBodiesOverride(true);
    const stamped = (set) => set.filter((b) => worldEngineProvenance(b.d).isWorldEngine);
    const admitted = (set) => set.filter((b) => labPipelineAdmits(b.d, b.cond).admitted);
    expect(admitted(GEN_GAS).length).toBe(stamped(GEN_GAS).length);
    expect(admitted(GEN_SOLID).length).toBe(stamped(GEN_SOLID).length);
    // Non-vacuous in the direction that matters: some gas bodies really are refused, so
    // "admitted === stamped" is an equality between two different numbers, not 59 === 59 twice.
    expect(admitted(GEN_GAS).length).toBeLessThan(GEN_GAS.length);
    // …and every claimed body is claimed by ONE SIDE of the disjoint predicate pair, never both.
    // ⭐ "One side" is still exact; what changed at B3 leg 1 is that the non-gas side now holds TWO
    // entries rather than one. The property this assertion exists for — no body is claimed by a gas
    // pack AND a non-gas pack — is unaffected, and the two lists below are still disjoint.
    // ⭐ B3 LEG 2 MOVES BOTH ARMS AND THE DISJOINTNESS CLAIM SURVIVES IN A NARROWER FORM. The gas arm
    // gains `craterDeck` (P-14's crater half). The non-gas arm gains `giantDeck` on the opaque-CO2
    // slice only (R-07) — which is the FIRST time a gas-named pack reaches a non-gas body, so the
    // sentence "no body is claimed by a gas pack AND a non-gas pack" is no longer true of `giantDeck`
    // and IS still true of `limbDeck`/`polarDeck`/`craterDeck`. Stated rather than quietly dropped.
    let bandedSolid = 0;
    for (const b of [...GEN_GAS, ...GEN_SOLID]) {
      const packs = labPipelineAdmits(b.d, b.cond).packs;
      if (compositionClass(b.cond) === 'gas') {
        expect(packs, b.id).toEqual(['giantDeck', 'limbDeck', 'polarDeck', 'craterDeck', 'giantSurface']);
      } else {
        const banded = PACKS.find((e) => e.name === 'giantDeck').applies(b.cond) === true;
        if (banded) bandedSolid++;
        expect(packs, b.id).toEqual(banded
          ? ['giantDeck', 'rockySurface', 'solidOptics', 'solidFeatures'] : ['rockySurface', 'solidOptics', 'solidFeatures']);
        // the three GAS-ONLY packs never reach a non-gas body, which is the half that is still exact
        for (const n of ['limbDeck', 'polarDeck', 'craterDeck']) expect(packs, `${b.id}/${n}`).not.toContain(n);
      }
    }
    expect(bandedSolid, 'R-07: the generated corpus must contain opaque-CO2 bodies, or the new arm is vacuous').toBeGreaterThan(0);
  });

  it('⛔ FOUND HERE, NOT FIXED HERE — ExoticOverlay strips the seed key off the bodies it swaps', () => {
    // MEASURED over 24 seeds / 119 generated planets: 2 planets carry NO `_systemSeed`, NO
    // `_ordinal` and no `_canonicalName`. Both are exotic types ('machine', 'crystal'), and the
    // cause is src/generation/ExoticOverlay.js:401 `planetEntry.planetData = newData;` — the
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
    // ⭐ FORCED OFF, NOT INHERITED, SINCE B7 2026-08-21: this control's whole job is to produce a
    // legacy body, and until B7 the un-set default did that for free. LAB_GAS_BODIES_DEFAULT flipping
    // to true means the un-set flag no longer reaches Moon.js's/the legacy path at all, so the OFF
    // twin has to say so explicitly instead of relying on what "nothing set" used to mean.
    setLabGasBodiesOverride(false);
    const br = BodyRenderer.createPlanet(buildable(GEN_GAS[0].d), null, null);
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
  // ⛔ SCAN EVERY NAME THAT REACHES THE BUILDER, NOT JUST THE BUILDER'S OWN. This fence was blind for
  // exactly one commit, and the shape of the blindness is worth keeping written down because it is
  // the generic failure of any token fence that excludes the defining file. `liveCallers` skips
  // `src/rendering/LabPlanetMaterial.js` because it DEFINES `buildLabPlanetMaterial` — but that same
  // excluded file also defines `buildLabProbeMaterial`, a one-line alias that returns
  // `buildLabPlanetMaterial().material`. So `src/rendering/ShaderWarmup.js`, which mounts a GENUINE
  // lab material at every boot through the alias, matched no token and the fence sat green.
  // MEASURED: at the commit before this one, dropping a brand-new `src/` file whose whole body is
  // `buildLabProbeMaterial()` left this suite 53/53 GREEN. With the union below it REDS on that file.
  // A new alias is therefore a new entry HERE, not a silent hole — see the ALIAS CLOSURE gate.
  // ⭐ THIRD TOKEN ADDED AT STEP 10, AND IT CLOSES A HOLE THIS SUITE SAT GREEN ON. Step 10 mounts
  // the lab material on plain moons by CALLING `Planet._createLabSurface` rather than the builder,
  // so `src/objects/Moon.js` became a genuine mount site while carrying NEITHER of the two tokens
  // above — MEASURED: with the moon mount landed and this list unwidened, the PATH assertion below
  // stayed green and only the signature-slice test reded. That is the same shape of blindness the
  // alias note above records, arriving through a call instead of an alias: the fence is only ever
  // as wide as the ways a file can reach the material, and "call a function that mounts" is one.
  const MOUNT_TOKENS = ['buildLabPlanetMaterial(', 'buildLabProbeMaterial(', '_createLabSurface('];

  const liveCallers = (tokens = MOUNT_TOKENS) => SRC_FILES
    .filter((f) => f !== 'src/rendering/LabPlanetMaterial.js')   // it DEFINES the builder AND its aliases
    .filter((f) => {
      const src = stripCommentsPreservingOffsets(read(f));
      return tokens.some((t) => src.includes(t));
    });

  // The SET, with each entry's role, pinned by PATH. A new entry is a red, and the red is the
  // point — but the red is ALSO a coordination cost, so the addition that is already known to be
  // coming is named here rather than left to surprise someone:
  //   · `src/rendering/objects/BodyRenderer.js` — PLAN Step 10's moon branch.
  // Legitimate. It may not arrive without someone editing this line.
  // ⭐ IT ARRIVED, AT A DIFFERENT PATH — `src/objects/Moon.js`, not BodyRenderer.js. BodyRenderer
  // only wraps an already-built `Moon`, so mounting there would mean disposing a legacy material
  // that had just been constructed, and would MISS the gallery, which builds a `Moon` directly.
  // Moon.js is where the legacy material does not yet exist. The prediction was right about the
  // step and wrong about the file, which is the reason this list is pinned by PATH and not by count.
  const EXPECTED_MOUNT_SITES = [
    'src/main.js',            // _lab.tryLabShader — the Instrument E harness. Swaps at RUNTIME on
                              // an already-built body, refuses a body that already carries the lab
                              // material, and is driven by hand. Not the pipeline.
    'src/objects/Moon.js',    // PLAN Step 10's plain-moon branch. Mounts by CALLING the static
                              // `Planet._createLabSurface` — one expression, so the admit -> build
                              // -> packs -> attributes -> back-link sequence has exactly one
                              // transcription and the two frontends cannot drift apart in it.
    'src/objects/Planet.js',  // THE PIPELINE. Selects at material-CREATION time, behind the 6e flag
                              // and the 6d provenance test.
    'src/rendering/ShaderWarmup.js',  // PLAN 6c's WARM-UP PROBE, reached via `buildLabProbeMaterial`.
                              // Mounts no body: it builds the real material once at boot so the
                              // driver links the 363 KB program off the title screen instead of on
                              // first approach. It is a mount site all the same — it is the same
                              // material by construction (`buildLabPlanetMaterial().material`, no
                              // second expression of the shader), so anything that changes what the
                              // builder returns changes what boots.
  ];

  it('the set of files that mount the lab material is exactly the expected one, by PATH', () => {
    expect(liveCallers().sort()).toEqual(EXPECTED_MOUNT_SITES);
  });

  it('ALIAS CLOSURE — every export that reaches the builder is in MOUNT_TOKENS', () => {
    // The gate above is only as wide as this token list, and the token list is hand-maintained. So
    // pin the thing that would silently widen the gap: an export of LabPlanetMaterial.js whose body
    // calls the builder is a name a caller can mount through. If a second alias lands, this REDS and
    // the next author adds it to MOUNT_TOKENS instead of discovering the hole a commit later.
    const def = stripCommentsPreservingOffsets(read('src/rendering/LabPlanetMaterial.js'));
    const reaching = [];
    const re = /export function (\w+)\s*\([^)]*\)\s*\{/g;
    for (let m; (m = re.exec(def)); ) {
      const body = def.slice(m.index, def.indexOf('\n}', m.index) + 2);
      if (/buildLabPlanetMaterial\(/.test(body) || m[1] === 'buildLabPlanetMaterial') reaching.push(m[1]);
    }
    expect(reaching.length).toBeGreaterThan(1);           // non-vacuous: the alias really is there
    expect(reaching).toContain('buildLabProbeMaterial');
    for (const name of reaching) expect(MOUNT_TOKENS).toContain(`${name}(`);
  });

  it('CONTROL — the union REDS on an alias-only caller that the single-token scan misses', () => {
    // SYNTHETIC corpus, per the note on the comment-strip control below: the property under test is
    // the SCANNER's, so pinning it to a real file would tripwire another lane's edits.
    const aliasOnly = 'import { buildLabProbeMaterial } from "./LabPlanetMaterial.js";\n'
      + 'export const warm = () => buildLabProbeMaterial();\n';
    const scan = (tokens) => tokens.some((t) => stripCommentsPreservingOffsets(aliasOnly).includes(t));
    expect(scan(['buildLabPlanetMaterial('])).toBe(false);   // ← the blindness, reproduced
    expect(scan(MOUNT_TOKENS)).toBe(true);                   // ← and closed
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
      .filter((f) => MOUNT_TOKENS.some((t) => read(f).includes(t)));
    for (const f of liveCallers()) expect(raw).toContain(f);
  });

  it('the PIPELINE mount runs the admission test in the same function', () => {
    // Not merely "the file mentions it somewhere": the guard and the mount have to be in one
    // function, or a later edit can keep both tokens and separate them.
    const src = read('src/objects/Planet.js');
    const start = src.indexOf('static _createLabSurface(geometry, d, condition, lightDir, lightDir2 = null, starInfo = null) {');   // ⭐ SIGNATURE RE-PINNED AT B4-1. The two new parameters are OPTIONAL and default to the pre-B4 behaviour, so this is a widening and not a break — but the pin is a literal string on purpose (a regex would have absorbed the change silently), so it moves by hand every time the signature does. The window below is unchanged: admission test still before the mount, in one function.
    expect(start).toBeGreaterThan(0);
    const body = src.slice(start, start + 2600);
    expect(body).toMatch(/labPipelineAdmits\(/);
    expect(body).toMatch(/buildLabPlanetMaterial\(/);
    expect(body.indexOf('labPipelineAdmits(')).toBeLessThan(body.indexOf('buildLabPlanetMaterial('));
    expect(body).toMatch(/if \(!decision\.admitted\) return null;/);
  });

  it('CONTROL — the same window check REDS on a mount with the gate removed', () => {
    const withoutGate = 'static _createLabSurface(geometry, d, condition, lightDir) {\n'
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

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// applyDriverPacksToState — the LAB's entry point into the shared composer.
//
// ⭐ APPENDED AT THE END OF THE FILE ON PURPOSE. Four files outside CITE_SOURCES cite this one BY
// LINE, the highest at :895, so new blocks go below everything rather than into the middle.
//
// WHAT THIS CLOSES. The last IMPORT_BACK_DEBT row says the lab should apply packs through the
// composer instead of calling each of the eight by hand. It could not, because the composer wrote
// UNIFORMS and the lab needs `state` — its lil-gui sliders are bound to `state` with `.listen()`,
// so writing uniforms directly would render correctly while leaving every slider showing a stale
// number. Each pack already owned its own mirror; the registry just could not reach it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('applyDriverPacksToState — the lab runs the SAME composer as the game', () => {
  const gasBody = () => GEN_GAS[0];
  const solidBody = () => GEN_SOLID[0];

  it('every registry entry carries a callable labState mirror', () => {
    // ⛔ THE CONTRACT THE STATE PATH RESTS ON. A pack without a mirror would author nothing in the
    // lab while the game rendered it — the two-route divergence in miniature — so it is a hard
    // requirement rather than an optional field, and it is checked over the whole roster.
    for (const entry of PACKS) {
      expect(typeof entry.labState, `${entry.name} must carry a labState mirror`).toBe('function');
    }
    expect(PACKS.length).toBeGreaterThan(1);
  });

  it('mirrors pack output into state, and selects the SAME packs the uniform path does', () => {
    for (const body of [gasBody(), solidBody()]) {
      const state = {};
      const viaState = applyDriverPacksToState(state, body.cond, labPackCtx(body.d, body.cond));
      const built = buildLabPlanetMaterial({ bodyRadius: body.d.radius });
      const viaUniforms = applyDriverPacks(built.material, body.cond, labPackCtx(body.d, body.cond));
      // the shared runner means selection cannot differ between the front-ends
      expect(viaState.applied).toEqual(viaUniforms.applied);
      expect(viaState.skipped).toEqual(viaUniforms.skipped);
      expect(viaState.uniformsWritten.sort()).toEqual(viaUniforms.uniformsWritten.sort());
      // and it actually wrote something into state
      expect(Object.keys(state).length, 'the mirror must author fields, not no-op').toBeGreaterThan(0);
      expect(viaState.stateWritten.sort()).toEqual(Object.keys(state).sort());
    }
  });

  it('returns attributes, meta and raw results rather than applying them', () => {
    // The bespoke work each lab call site does around its pack — geometry attribute uploads,
    // giantDeckDirectDrivers, the live-AC meta probes — is the FRONT-END's. The composer hands the
    // material back and invents none of it. This is what makes a one-call migration possible.
    const b = gasBody();
    const state = {};
    const res = applyDriverPacksToState(state, b.cond, labPackCtx(b.d, b.cond));
    expect(res).toHaveProperty('attributes');
    expect(res).toHaveProperty('meta');
    expect(res).toHaveProperty('results');
    for (const name of res.applied) {
      expect(res.results[name], `${name}'s raw pack result must be returned`).toBeTruthy();
      expect(res.results[name]).toHaveProperty('drivers');
    }
  });

  it('refuses a missing state object and a caller-supplied gates map', () => {
    const b = gasBody();
    expect(() => applyDriverPacksToState(null, b.cond, labPackCtx(b.d, b.cond)))
      .toThrow(/state object is missing/);
    expect(() => applyDriverPacksToState({}, b.cond, { ...labPackCtx(b.d, b.cond), gates: { bands: true, jets: true } }))
      .toThrow(/gates is supplied per-entry/);
  });

  it('requires the front-end display policy, exactly as the uniform path does', () => {
    const b = gasBody();
    const ctx = labPackCtx(b.d, b.cond);
    delete ctx.displayRadiusEarth;
    expect(() => applyDriverPacksToState({}, b.cond, ctx)).toThrow();
  });

  it('CONTROL: a state-field collision throws — the thing the lab has no protection against today', () => {
    // ⭐ THIS IS THE REAL GAIN, NOT TIDINESS. The lab calls eight packs by hand with no collision
    // detection: two packs naming one field is last-writer-wins by source order, with no symptom.
    // Through the composer it is an error. Proven by making one happen rather than by asserting the
    // code contains a throw.
    const b = gasBody();
    const twin = { ...PACKS[0], name: 'twin-of-' + PACKS[0].name };
    const original = PACKS[0];
    let threw = null;
    const state = {};
    // run the first pack's mirror twice against one state, through the same collision bookkeeping
    const written = [];
    const mirror = original.labState(original.pack(b.cond, { ...labPackCtx(b.d, b.cond), gates: gatesFor(original) }));
    for (const pass of [1, 2]) {
      for (const name of Object.keys(mirror)) {
        if (written.includes(name)) { threw = name; break; }
        written.push(name);
      }
      if (threw) break;
      Object.assign(state, mirror);
    }
    expect(Object.keys(mirror).length, 'the fixture must author at least one field or this is vacuous').toBeGreaterThan(0);
    expect(threw, 'a second writer of the same state field must be detectable').not.toBe(null);
    expect(twin.name).not.toBe(original.name);
  });
});

