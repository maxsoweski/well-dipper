// tests/driver-pack-limbdeck.test.js
// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PACK #2 — THE LIMB (F34). Ledger C20: the game must write the lab's limb gate.
//
// ⭐ THE EVIDENCE STANDARD THIS FILE IS WRITTEN TO (PLAN §11.3.3). "The test passes" is not evidence
// that it CAN fail. Every gate below that could be vacuous carries an EXECUTED control: the thing
// the gate guards is broken in-test, the gate is shown to red, and the break is discarded. Controls
// are marked `[CONTROL]`.
//
// ⛔ WHAT THIS LANE DOES NOT DO, AND THE READER MUST NOT INFER OTHERWISE.
// It does NOT add the entry to src/worldengine/drivers/index.js:94 `export const PACKS = Object.freeze([`.
// That file is the shared composition point for two concurrent lanes and is reserved for the
// integration commit; the edit is one import plus `LIMB_DECK_ENTRY` as a second array element.
// Everything below therefore composes `LIMB_DECK_ENTRY` DIRECTLY, and the registry-shape gates are
// written to pass both BEFORE and AFTER that entry lands — a gate that flips at integration would
// red the merge for the wrong reason.
//
// ⭐ THE IDIOM THIS COMMIT INTRODUCES, AND THE GATE THAT WATCHES IT (Step 5's scar: a ratchet
// shipped blind to an idiom its own commit introduced). The new idiom is A PACK DRIVER WHOSE VALUE
// IS FORWARDED VERBATIM FROM A SHARED BASE MODULE rather than computed from constants in the pack.
// Nothing that existed before this commit could see a transcription of `atmosphereOpticsOf`'s law
// into a pack, because no pack forwarded a base-module value. Two gates watch it:
//   · §C the CROSS-MATERIAL AGREEMENT gate — the swapped body's exponent and hue must EQUAL the
//     legacy game material's on the SAME body, so the swap moves the strength gate and nothing else
//     in this family. A transcription would satisfy this today and diverge the first time the law
//     moved, which is why it is paired with:
//   · §C the ANTI-TRANSCRIPTION SOURCE FENCE — the pack's code view may not contain any of the six
//     numbers that make up the limb law (the exponent ramp's two coefficients, the lab's discrete
//     fork's two values, its x1.3 boost, and the default rim hue's channels).
//
// ⛔ FIVE THINGS THIS FILE DELIBERATELY DOES NOT ASSERT:
//  1. It does not claim the rim LOOKS right. Max ruled 2026-08-09 that the gate is the PIPELINE,
//     not the picture. Appearance is the world engine's law to improve later, in
//     src/worldengine/base/atmosphereOptics.js, not here.
//  2. It does not claim the display-policy seam is exercised. NOT ONE driver this pack emits is
//     km-shaped, so "the two policies agree" is a fact about the SIZE OF THE SET. The emptiness is
//     asserted directly so the vacuity ends loudly the day a km-keyed driver joins.
//  3. It pins no COUNT as a proxy for a SET. Step 4 measured that a count-preserving permutation is
//     byte-identical to every instrument this program owns, so the predicate gate asserts
//     MEMBERSHIP. Where a count IS the claim (distinctness) it is a floor with the measured value
//     named beside it, not an equality.
//  4. It asserts nothing about the F31e detached haze shell or the lab's `_cloudRegime` exponent
//     fork. Both are declared non-ports in the pack header; their absence from the pack's own
//     output is asserted as a SCOPE FENCE, not as a feature claim.
//  5. It writes no prose superlative it did not measure. Every number in a comment below is from a
//     run recorded on 2026-08-09 against 24 generated systems.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromPlanet } from '../src/worldengine/port/conditionFromPlanet.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { atmosphereOpticsOf } from '../src/worldengine/base/atmosphereOptics.js';
import {
  buildLabPlanetMaterial, updateLabPlanetMaterial, isLabPlanetMaterial,
} from '../src/rendering/LabPlanetMaterial.js';
import {
  writePackUniforms, resolveDriver, isPackDriver, scalar,
  PackContractError, gameDisplayRadiusEarth,
} from '../src/worldengine/port/writePackUniforms.js';
import { PACKS, gatesFor, GATE_POLICY_ALL_ON } from '../src/worldengine/drivers/index.js';
import { giantDeckPack } from '../src/worldengine/drivers/giantDeck.js';
import { Planet, labPackCtx, setLabGasBodiesOverride } from '../src/objects/Planet.js';
import {
  limbDeckPack, LIMB_DECK_ENTRY, LIMB_UNIFORMS, LIMB_GATE,
  LIMB_STRENGTH_WITH_AIR, LIMB_STRENGTH_AIRLESS, hasAtmosphere,
} from '../src/worldengine/drivers/limbDeck.js';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// The pack's own source, COMMENTS AND STRING INTERIORS BLANKED. Every source assertion below runs
// on THIS view, for the reason the radius-live-feed fence records in blood: a law re-quoted in a
// comment satisfies a pin that existed entirely to catch its deletion. This file's header quotes
// the exponent law verbatim, so a raw-text scan for those coefficients would fail on the prose.
const PACK_CODE = stripCommentsPreservingOffsets(read('src/worldengine/drivers/limbDeck.js'), {
  blankLiteralText: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// The population. Real generated systems through the real adapter — never Sol, which renders from
// NASA textures through a different renderer and carries no world-engine condition fields.
// MEASURED 2026-08-09 over these 24 seeds: 97 planets, 41 compositionClass 'gas', 56 not.
// ─────────────────────────────────────────────────────────────────────────────
function generatedPlanets(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const seed = `limb-${i}`;
    const sys = StarSystemGenerator.generate(seed, null);
    (sys.planets || []).forEach((e) => {
      out.push({
        id: `${seed}#${e.planetData._ordinal}`,
        d: e.planetData,
        cond: conditionFromPlanet(e.planetData),
      });
    });
  }
  return out;
}
const GENERATED = generatedPlanets(24);
const GAS = GENERATED.filter((b) => compositionClass(b.cond) === 'gas');
const SOLID = GENERATED.filter((b) => compositionClass(b.cond) !== 'gas');

const ALL_ON = { [LIMB_GATE]: true };
/** The full game-side pack ctx for one body, with this entry's gates resolved by the shipped policy. */
const ctxFor = (b, gates = gatesFor(LIMB_DECK_ENTRY)) => ({ ...labPackCtx(b.d, b.cond), gates });
const packFor = (b, gates) => limbDeckPack(b.cond, ctxFor(b, gates));

/** A lab material with this pack written onto it. Returns the material and the pack result. */
function composeOnto(b, gates = gatesFor(LIMB_DECK_ENTRY)) {
  const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
  const ctx = ctxFor(b, gates);
  const res = limbDeckPack(b.cond, ctx);
  writePackUniforms(built.material.uniforms, res.drivers, ctx);
  return { material: built.material, res, ctx };
}

/** Build a real game Planet at a chosen flag value — the legacy material is the flag-OFF one. */
function planetAt(d, enabled) {
  setLabGasBodiesOverride(enabled);
  try {
    const p = new Planet({ sunDirection: [1, 0, 0], ...d }, null);
    return { surface: p.surface, material: p.surface.material };
  } finally {
    setLabGasBodiesOverride(null);
  }
}

beforeEach(() => { setLabGasBodiesOverride(null); });
afterEach(() => { setLabGasBodiesOverride(null); });

// ═════════════════════════════════════════════════════════════════════════════
// §A — THE PREDICATE. It decides the POPULATION rather than a pixel, and its wrong answer is
// silent — no throw, no red test, just a class of body that quietly changed material.
// ═════════════════════════════════════════════════════════════════════════════
describe('A — the predicate admits the gas class and nothing else', () => {
  it('admits EXACTLY the set the shipped giantDeck predicate admits — membership, not a count', () => {
    // Both entries are `compositionClass(condition) === 'gas'`, character for character. This gate
    // is what makes "adding limbDeck to PACKS does not change which bodies are admitted" a measured
    // statement rather than a reading of two source lines. Membership, because Step 4 measured that
    // a count-preserving permutation passed every instrument in this program byte-identically.
    const giant = PACKS.find((e) => e.name === 'giantDeck');
    expect(giant, 'the shipped gas pack must exist to compare against').toBeTruthy();
    const mine = GENERATED.filter((b) => LIMB_DECK_ENTRY.applies(b.cond) === true).map((b) => b.id);
    const theirs = GENERATED.filter((b) => giant.applies(b.cond) === true).map((b) => b.id);
    expect(mine).toEqual(theirs);
    expect(mine.length).toBe(GAS.length);        // and the set really is the gas class
    expect(GAS.length).toBeGreaterThan(20);      // measured 41 of 97 — a real population, not 1
  });

  it('[CONTROL] the counterfactual `!!condition.atmosphere` predicate OVER-ADMITS, and by how much', () => {
    // ⭐ THIS IS THE CONTROL THAT MAKES THE GATE ABOVE MEAN SOMETHING. The strength driver keys on
    // `hasAtmo`, so writing the PREDICATE that way is the natural mistake — and it would admit every
    // rocky and icy world-engine body to the lab material, which is Step 9's population arriving
    // unruled at Step 6. MEASURED 2026-08-09: `!!condition.atmosphere` is TRUE on ALL 97 generated
    // planets, so the counterfactual admits all 56 non-gas bodies as well. Not a near miss.
    const wrong = GENERATED.filter((b) => !!b.cond.atmosphere).map((b) => b.id);
    const right = GENERATED.filter((b) => LIMB_DECK_ENTRY.applies(b.cond) === true).map((b) => b.id);
    expect(wrong.length).toBeGreaterThan(right.length);
    expect(wrong.length - right.length).toBe(SOLID.length);
    expect(SOLID.length).toBeGreaterThan(20);    // measured 56 — the over-admission is the majority
  });

  it('reads the CONDITION, never a `type` label — the predicate moves with the composition channel', () => {
    // src/worldengine/drivers/index.js:19 `EACH PACK'S APPLICABILITY PREDICATE IS DERIVED FROM THE CONDITION`
    // forbids a type-keyed predicate, and the reason is
    // measurable: Sol's Jupiter and Saturn carry `type: 'gas-giant'` with a null atmosphere. The
    // positive half of that rule is asserted here — the predicate is driven by the field it claims.
    expect(PACK_CODE).not.toMatch(/\.type\b/);
    const gas = GAS[0].cond;
    const noEnvelope = { ...gas, atmosphere: { ...gas.atmosphere, composition: 'co2' } };
    expect(LIMB_DECK_ENTRY.applies(gas)).toBe(true);
    expect(LIMB_DECK_ENTRY.applies(noEnvelope)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §B — THE GATE. A declared NAME, not a hardcoded 1.0. Ruling 4 puts it ON in the game.
// ═════════════════════════════════════════════════════════════════════════════
describe('B — the enable gate is a declared name that the ALL_ON policy resolves', () => {
  it('gatesFor resolves the declared name and refuses an unknown policy', () => {
    expect(gatesFor(LIMB_DECK_ENTRY)).toEqual({ limb: true });
    expect(gatesFor(LIMB_DECK_ENTRY, GATE_POLICY_ALL_ON)).toEqual({ limb: true });
    expect(() => gatesFor(LIMB_DECK_ENTRY, 'everything')).toThrow(PackContractError);
    expect(LIMB_DECK_ENTRY.gates).toEqual([LIMB_GATE]);
    expect(Object.isFrozen(LIMB_DECK_ENTRY.gates)).toBe(true);
  });

  it('an ABSENT gate key still THROWS — ALL_ON did not become a blanket yes', () => {
    // src/worldengine/port/writePackUniforms.js:166 `if (gates == null || !(d.gate in gates)) {`
    // treats an absent gate as an unanswered rendering decision. That throw is the entire reason
    // the strength is a named gate instead of a literal.
    const b = GAS[0];
    expect(() => limbDeckPack(b.cond, { ...labPackCtx(b.d, b.cond), gates: {} }))
      .not.toThrow();   // the PACK builds the driver; the WRITER is where the gate is read
    const res = packFor(b, {});
    expect(() => writePackUniforms(buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms, res.drivers, ctxFor(b, {})))
      .toThrow(/gated on 'limb' but ctx.gates has no such key/);
  });

  it('[CONTROL] a HARDCODED strength makes that throw unreachable — which is why it is a name', () => {
    // The mutant is exactly the shortcut this lane was told not to take: `1.0` instead of a gated
    // driver. Under the same empty gates map it writes silently, so the absent-gate throw above is
    // a property of the NAME and not of the writer.
    const mat = buildLabPlanetMaterial({ bodyRadius: 1 }).material;
    const ctx = { displayRadiusEarth: 1, gates: {} };
    expect(() => writePackUniforms(mat.uniforms, { uLimbStrength: 1.0 }, ctx)).not.toThrow();
    expect(mat.uniforms.uLimbStrength.value).toBe(1.0);
  });

  it('a gated-OFF limb resolves to exactly +0 — the F34 regression contract, byte-identical', () => {
    // planet-lod-shaders.glsl.js:939 `pow(1.0 - max(dot(N, V), 0.0), uLimbExponent) * uLimbStrength`
    // makes the strength a bare multiplicand, so 0 deletes the additive term exactly rather than
    // merely shrinking it. The writer short-circuits to +0 for the same reason.
    const b = GAS[0];
    const off = composeOnto(b, { [LIMB_GATE]: false });
    expect(off.material.uniforms.uLimbStrength.value).toBe(0);
    expect(Object.is(off.material.uniforms.uLimbStrength.value, -0)).toBe(false);
    // ...and OFF still writes the width and hue, exactly as the lab does. They are ungated on
    // purpose: the lab writes them every frame regardless of `state.limbEnabled`.
    expect(off.material.uniforms.uLimbExponent.value).toBe(atmosphereOpticsOf(b.cond).limbExponent);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §C — THE VALUE IS THE GAME'S OWN OPTICS, NOT A CONSTANT.
// ═════════════════════════════════════════════════════════════════════════════
describe('C — width and hue are FORWARDED from the shared law, not transcribed', () => {
  it('every gas body: the drivers EQUAL atmosphereOpticsOf on that body, exactly', () => {
    for (const b of GAS) {
      const o = atmosphereOpticsOf(b.cond);
      const { drivers } = packFor(b);
      expect(drivers.uLimbExponent, b.id).toBe(o.limbExponent);
      expect(drivers.uLimbColor, b.id).toEqual(o.limbColor);
      // ...and a fresh array, not the module's live one — one body's hue must not follow another's.
      expect(drivers.uLimbColor).not.toBe(o.limbColor);
    }
  });

  it('and those values VARY across the population — a constant would collapse them', () => {
    // MEASURED 2026-08-09 over the 41 gas bodies: 32 distinct exponents, 39 distinct colours, the
    // exponent spanning the law's full documented range 1.8 (broad halo) to 3.5 (narrow line).
    // Floors, not equalities: the claim is distinctness, and pinning 32 would pin the generator.
    const exps = new Set(GAS.map((b) => packFor(b).drivers.uLimbExponent.toFixed(6)));
    const cols = new Set(GAS.map((b) => packFor(b).drivers.uLimbColor.map((c) => c.toFixed(6)).join(',')));
    expect(exps.size).toBeGreaterThan(8);
    expect(cols.size).toBeGreaterThan(8);
    for (const b of GAS) {
      const e = packFor(b).drivers.uLimbExponent;
      expect(e).toBeGreaterThanOrEqual(1.8 - 1e-9);
      expect(e).toBeLessThanOrEqual(3.5 + 1e-9);
    }
  });

  it('⭐ CROSS-MATERIAL AGREEMENT: the swapped body carries the SAME width and hue the legacy one did', () => {
    // ⭐ THE GATE THAT SAYS WHAT THIS PORT IS. src/objects/Planet.js:1584 `const optics = atmosphereOpticsOf(condition);`
    // already feeds the legacy material's src/objects/Planet.js:1617 `uLimbExponent: { value: optics.limbExponent },`.
    // If the pack forwards the same law, then on a given body the swap opens the STRENGTH gate and
    // moves nothing else in this family — which is what makes the result readable as "the wire
    // arrived" instead of "the new renderer looks different". A transcription passes this today and
    // breaks the first time the law moves, which is why the source fence below is its partner.
    let checked = 0;
    for (const b of GAS.slice(0, 12)) {
      const legacy = planetAt(b.d, false).material;
      if (!legacy.uniforms.uLimbExponent) continue;   // a body with no optics uniform is not a subject
      expect(isLabPlanetMaterial(legacy), b.id).toBe(false);
      const { drivers } = packFor(b);
      expect(drivers.uLimbExponent, b.id).toBe(legacy.uniforms.uLimbExponent.value);
      const lc = legacy.uniforms.uLimbColor.value;    // a THREE.Vector3 on the legacy material
      expect([lc.x, lc.y, lc.z], b.id).toEqual(drivers.uLimbColor);
      checked++;
    }
    expect(checked, 'the loop must have had subjects — an empty loop is a green gate about nothing').toBeGreaterThan(8);
  });

  it('[CONTROL] a transcribed constant REDS the equality gate on the real population', () => {
    // The mutant is the shortcut the lane brief names by number: "a hardcoded 1.0 would make the
    // limb appear and prove nothing about the wiring." Here the constant is the lab's own narrow-rim
    // 3.5, which is the plausible version of the mistake — and it still reds, on 24 of 41 bodies.
    const disagree = GAS.filter((b) => 3.5 !== atmosphereOpticsOf(b.cond).limbExponent);
    expect(disagree.length).toBeGreaterThan(8);
    expect(() => {
      for (const b of GAS) expect(3.5).toBe(atmosphereOpticsOf(b.cond).limbExponent);
    }).toThrow();
  });

  it('ANTI-TRANSCRIPTION FENCE: the pack owns no number of the limb law', () => {
    // ⭐ THE GATE FOR THE IDIOM THIS COMMIT INTRODUCES. Six numbers make up the limb law and none of
    // them may appear in this pack's CODE (the comment-stripped view — the header quotes several of
    // them in prose, and a raw scan would fail on the prose while missing a real transcription in a
    // string literal). The day someone "just nudges" the rim, this fence sends them to
    // src/worldengine/base/atmosphereOptics.js:161 `limbExponent: 3.5 - 1.7 * thick,` instead.
    const FORBIDDEN = {
      '3.5': "the exponent ramp's narrow-line end",
      '1.7': "the exponent ramp's slope",
      '1.8': "the lab's discrete thick-haze exponent (declared non-port 1)",
      '1.3': "the lab's thick-haze strength boost (declared non-port 1)",
      '0.45': 'the default rim hue R channel',
      '0.65': 'the default rim hue G channel',
    };
    for (const [n, why] of Object.entries(FORBIDDEN)) {
      expect(PACK_CODE.includes(n), `limbDeck.js code names ${n} — ${why}`).toBe(false);
    }
    // The two numbers it DOES own, and it owns them because the lab's producer is a literal ternary
    // with no module behind it: planet-lod-lab-core.js:1043 `limbStrength: hasAtmo ? 0.7 : 0.0,`.
    expect(PACK_CODE).toContain('0.7');
    expect(LIMB_STRENGTH_WITH_AIR).toBe(0.7);
    expect(LIMB_STRENGTH_AIRLESS).toBe(0.0);
  });

  it('[CONTROL] the fence REDS on a source that does name one of the six', () => {
    const mutant = 'const uLimbExponent = 3.5 - 1.7 * thick;';
    expect(mutant.includes('3.5')).toBe(true);
    expect(() => expect(mutant.includes('3.5')).toBe(false)).toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §D — THE WIRE, ON A REAL MATERIAL. Non-zero where it must be, zero where it must be.
// ═════════════════════════════════════════════════════════════════════════════
describe('D — the wire reaches a real lab material', () => {
  it('NON-ZERO on a pack-composed gas body — the uniform the game has never written', () => {
    // The default is planet-lod-uniforms.js:40 `uLimbStrength:   { value: 0.0 },`, and measured
    // 2026-08-09 `grep -rn uLimbStrength src/` returned ZERO hits before this lane: the game had
    // never written it. This is the assertion that C20 is closed.
    for (const b of GAS.slice(0, 12)) {
      const fresh = buildLabPlanetMaterial({ bodyRadius: b.d.radius }).material;
      expect(fresh.uniforms.uLimbStrength.value, 'the default really is off').toBe(0.0);
      const { material } = composeOnto(b);
      expect(material.uniforms.uLimbStrength.value, b.id).toBe(LIMB_STRENGTH_WITH_AIR);
      expect(material.uniforms.uLimbStrength.value).toBeGreaterThan(0);
    }
  });

  it('ZERO on a legacy body — two independent senses, because they are different facts', () => {
    // (1) A body the predicate REFUSES never runs the pack, so its lab-material default stands and
    //     NOT ONE uniform moves. This is Step 6's "Instrument C on the still-legacy bodies: zero
    //     delta" made local to this pack.
    const solid = SOLID[0];
    expect(LIMB_DECK_ENTRY.applies(solid.cond)).toBe(false);
    const untouched = buildLabPlanetMaterial({ bodyRadius: solid.d.radius }).material;
    const before = Object.fromEntries(Object.entries(untouched.uniforms)
      .map(([k, v]) => [k, typeof v.value === 'number' ? v.value : null]));
    // the pack is simply not run on it — that is what `applies === false` MEANS at the registry
    const after = Object.fromEntries(Object.entries(untouched.uniforms)
      .map(([k, v]) => [k, typeof v.value === 'number' ? v.value : null]));
    expect(after).toEqual(before);
    expect(untouched.uniforms.uLimbStrength.value).toBe(0.0);

    // (2) The LEGACY GAME material does not carry `uLimbStrength` AT ALL. That is C20's actual
    //     shape — two names for one value — and it is why the swap silently switched F34 off: the
    //     game's own gate is the differently-spelled src/objects/Planet.js:1616 `uLimbMix: { value: LIMB_MIX },`.
    const legacy = planetAt(GAS[0].d, false).material;
    expect(isLabPlanetMaterial(legacy)).toBe(false);
    expect(legacy.uniforms.uLimbStrength).toBeUndefined();
    expect(legacy.uniforms.uLimbMix).toBeTruthy();
    // ...and the lab material is the mirror image: it declares the strength and not the mix.
    const lab = buildLabPlanetMaterial({ bodyRadius: 1 }).material;
    expect(lab.uniforms.uLimbMix).toBeUndefined();
    expect(lab.uniforms.uLimbStrength).toBeTruthy();
  });

  it('[CONTROL] BREAK THE WIRE — dropping the write leaves the rim at zero and reds the gate', () => {
    // ⭐ A WIRE WITH NO FAILING STATE IS DECORATION. The mutant is the pack result with the strength
    // driver deleted — the exact shape of "someone removed the mapping line".
    const b = GAS[0];
    const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
    const ctx = ctxFor(b);
    const res = limbDeckPack(b.cond, ctx);
    const mutant = { ...res.drivers };
    delete mutant.uLimbStrength;
    writePackUniforms(built.material.uniforms, mutant, ctx);
    expect(built.material.uniforms.uLimbStrength.value).toBe(0.0);
    expect(() => expect(built.material.uniforms.uLimbStrength.value).toBe(LIMB_STRENGTH_WITH_AIR))
      .toThrow();
    // ...while the OTHER two still landed, so the control isolates the strength rather than the write.
    expect(built.material.uniforms.uLimbExponent.value).toBe(atmosphereOpticsOf(b.cond).limbExponent);
  });

  it('the hue really lands in the THREE.Color — MEASURED, not assumed', () => {
    // ⚠ The lab's slot is planet-lod-uniforms.js:45 `uLimbColor:      { value: new THREE.Color(0.45, 0.65, 1.0) },`
    // — a THREE.Color, while the game's own is a Vector3. The writer resolves arrays duck-typed via
    // src/worldengine/port/writePackUniforms.js:245 `if (target && typeof target.set === 'function') target.set(...v);`,
    // and `Color.set` dispatches to `setRGB` only on THREE arguments. Under colour management
    // `setRGB` can transform its inputs, so the round-trip is measured here rather than reasoned.
    const b = GAS[0];
    const { material } = composeOnto(b);
    const o = atmosphereOpticsOf(b.cond);
    const c = material.uniforms.uLimbColor.value;
    expect(c.constructor.name).toBe('Color');
    expect([c.r, c.g, c.b]).toEqual(o.limbColor);
    // The giantDeck precedent on the SAME material, so "arrays into Colors work" is not a claim
    // resting on one uniform: uBandTint is emitted the same way from the atmosphere colour.
    const gctx = { ...labPackCtx(b.d, b.cond), gates: gatesFor(PACKS.find((e) => e.name === 'giantDeck')) };
    const g = giantDeckPack(b.cond, gctx);
    // ⚠ ASSERTED, NOT BRANCHED ON. An `if (Array.isArray(...))` here would make the precedent
    // silently vacuous the day giantDeck stopped emitting a tint, which is the shape of gate this
    // program calls dead. Measured 2026-08-09: it is an array on every generated gas body.
    expect(Array.isArray(g.drivers.uBandTint), 'giantDeck must still emit an array tint').toBe(true);
    writePackUniforms(material.uniforms, { uBandTint: g.drivers.uBandTint }, gctx);
    const t = material.uniforms.uBandTint.value;
    expect(t.constructor.name).toBe('Color');
    expect([t.r, t.g, t.b]).toEqual(g.drivers.uBandTint);
  });

  it('the per-frame writer does not clobber the three uniforms', () => {
    // ⭐ THE HAZARD giantDeck's LAB_STATE_BINDING EXISTS FOR, asked of THIS pack. The game's lab
    // material is written every frame by `updateLabPlanetMaterial` (called from Planet.updateRender).
    // If that seam touched any uLimb* uniform, this pack's write would survive exactly one frame and
    // the wire would be decoration. Measured on a live material rather than read off the source.
    const b = GAS[0];
    const { material } = composeOnto(b);
    const before = {
      s: material.uniforms.uLimbStrength.value,
      e: material.uniforms.uLimbExponent.value,
      c: [material.uniforms.uLimbColor.value.r, material.uniforms.uLimbColor.value.g, material.uniforms.uLimbColor.value.b],
      t: material.uniforms.uTime.value,
      o: material.uniforms.uOctaves.value,
    };
    const diag = updateLabPlanetMaterial(material, { renderDt: 0.016, distanceRadii: 3.0 });
    expect(diag, 'the seam must have recognised the material — a null here makes this gate vacuous').toBeTruthy();
    // [CONTROL] the same call MOVED two other uniforms, so "nothing changed" is not the explanation.
    expect(material.uniforms.uTime.value).not.toBe(before.t);
    expect(material.uniforms.uOctaves.value).not.toBe(before.o);
    // ...and left all three limb uniforms alone.
    expect(material.uniforms.uLimbStrength.value).toBe(before.s);
    expect(material.uniforms.uLimbExponent.value).toBe(before.e);
    expect([material.uniforms.uLimbColor.value.r, material.uniforms.uLimbColor.value.g, material.uniforms.uLimbColor.value.b])
      .toEqual(before.c);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §E — THE STEP-5a CONTRACT, AND THE SCOPE FENCE.
// ═════════════════════════════════════════════════════════════════════════════
describe('E — the pack obeys the Step-5a contract and stays inside its scope', () => {
  it('requires the front-end display policy and a condition — it invents neither', () => {
    const b = GAS[0];
    expect(() => limbDeckPack(b.cond, { gates: ALL_ON })).toThrow(/displayRadiusEarth is REQUIRED/);
    expect(() => limbDeckPack(b.cond, { displayRadiusEarth: 0, gates: ALL_ON })).toThrow(PackContractError);
    expect(() => limbDeckPack(null, ctxFor(b))).toThrow(/condition vector is missing/);
    // The game's policy is the identity, and it is passed by name rather than as a literal.
    expect(gameDisplayRadiusEarth(b.cond.radiusEarth)).toBe(b.cond.radiusEarth);
  });

  it('returns { drivers, attributes, meta } with attributes EMPTY, not undefined', () => {
    const r = packFor(GAS[0]);
    expect(r.attributes).toEqual({});
    expect(Object.keys(r.drivers).sort()).toEqual([...LIMB_UNIFORMS].sort());
    expect(r.meta.gas).toBe(true);
    expect(r.meta.air).toBe(true);
  });

  it('NO driver is km-shaped — the display-policy vacuity is asserted, not assumed', () => {
    // The same emptiness giantDeck asserts, for the same reason: the day a km-keyed uniform joins
    // this deck, "the two policies agree on every driver" stops being a fact about an empty set and
    // this gate ends loudly instead of silently.
    const { drivers } = packFor(GAS[0]);
    const km = Object.values(drivers).filter((d) => isPackDriver(d) && d.featureSizeKm !== undefined);
    expect(km).toEqual([]);
    // ...therefore the LAB's display policy (R^0.5) yields identical drivers on the same body.
    const b = GAS[0];
    const labCtx = { ...ctxFor(b), displayRadiusEarth: Math.sqrt(b.cond.radiusEarth ?? 1) };
    const lab = limbDeckPack(b.cond, labCtx);
    for (const n of LIMB_UNIFORMS) {
      expect(resolveDriver(n, lab.drivers[n], labCtx)).toEqual(resolveDriver(n, packFor(b).drivers[n], ctxFor(b)));
    }
  });

  it('draws NO entropy — two macroSeeds give byte-identical drivers', () => {
    // Non-port 3: this pack asserts no `macroSeed` because it reads none. That omission is only
    // honest if the pack really is seed-free, so seed-independence is the gate that stands in for
    // the assertion — and it ends loudly the day a seeded term joins the deck.
    const b = GAS[0];
    const a = limbDeckPack(b.cond, { ...ctxFor(b), macroSeed: 1 });
    const c = limbDeckPack(b.cond, { ...ctxFor(b), macroSeed: 0x7fffffff });
    expect(JSON.stringify(a.drivers)).toBe(JSON.stringify(c.drivers));
    expect(PACK_CODE).not.toMatch(/Math\.random|Date\.now|macroSeed|alea/);
  });

  it('SCOPE FENCE: it names no polar, storm or haze-shell uniform, and bakes no attribute', () => {
    // The declared non-ports, asserted as ABSENCES from the pack's own output rather than as
    // feature claims. A reader must be able to SEE that this pack never touched them.
    const names = Object.keys(packFor(GAS[0]).drivers);
    for (const n of names) {
      expect(n.startsWith('uLimb'), `${n} is outside the limb family`).toBe(true);
    }
    expect(names).not.toContain('uLimbHazeShell');
    expect(PACK_CODE).not.toMatch(/uPolar|uStorm|hazeShell|limbHazeShell|_cloudRegime|_thickHaze/);
  });

  it('the airless branch is LIVE in the law and UNREACHABLE from the predicate — both, measured', () => {
    // ⚠ Over the pack's own population `hasAtmo` is constant-true, because
    // src/worldengine/base/e1Regime.js:67 `if (cv.atmosphere && cv.atmosphere.composition === 'h2-he') return 'gas';   // h2-he envelope terminal (fires first)`
    // makes an h2-he envelope BE an atmosphere. Saying so is part of the measurement: a reader must
    // not think this ternary is doing work today. It is written as the LAW anyway because Step 9
    // admits the rocky class, and an airless rock must keep a hard dark silhouette.
    expect(GAS.every((b) => hasAtmosphere(b.cond))).toBe(true);          // unreachable today...
    const airless = { ...GAS[0].cond, atmosphere: null };
    const r = limbDeckPack(airless, { displayRadiusEarth: 1, gates: ALL_ON });
    expect(r.drivers.uLimbStrength.value).toBe(LIMB_STRENGTH_AIRLESS);   // ...but live in the law
    expect(r.meta.air).toBe(false);
    expect(Number.isFinite(r.drivers.uLimbExponent)).toBe(true);         // and never NaN
    for (const c of r.drivers.uLimbColor) expect(Number.isFinite(c)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §F — REGISTRY-READY, AND THE TWO SHADER FACTS THIS PACK'S CLAIM RESTS ON.
// ═════════════════════════════════════════════════════════════════════════════
describe('F — the entry is registry-ready and collision-free', () => {
  it('carries the four contract fields, frozen, in the shape PACKS entries have', () => {
    expect(Object.isFrozen(LIMB_DECK_ENTRY)).toBe(true);
    expect(LIMB_DECK_ENTRY.name).toBe('limbDeck');
    expect(typeof LIMB_DECK_ENTRY.applies).toBe('function');
    expect(typeof LIMB_DECK_ENTRY.pack).toBe('function');
    expect(Array.isArray(LIMB_DECK_ENTRY.gates)).toBe(true);
    expect(LIMB_DECK_ENTRY.applies.length).toBeLessThanOrEqual(2);
  });

  it('its name is unique against the shipped registry — before AND after integration', () => {
    // Written to pass in both states: this lane does not add the entry, and a gate that flipped at
    // integration would red the merge for the wrong reason.
    const names = PACKS.map((e) => e.name);
    expect(names.filter((n) => n === 'limbDeck').length).toBeLessThanOrEqual(1);
    expect(new Set(names).size).toBe(names.length);
  });

  it('names NO uniform giantDeck names — the collision throw will not fire at integration', () => {
    // src/worldengine/drivers/index.js:162 `if (uniformsWritten.includes(name)) {`
    // makes two packs naming one uniform an ERROR rather than
    // a last-writer-wins, because array order would otherwise decide what renders. Both packs claim
    // the same bodies, so the disjointness is a precondition of the integration commit, checked here.
    const b = GAS[0];
    const gctx = { ...labPackCtx(b.d, b.cond), gates: gatesFor(PACKS.find((e) => e.name === 'giantDeck')) };
    const gNames = new Set(Object.keys(giantDeckPack(b.cond, gctx).drivers));
    expect(gNames.size).toBeGreaterThan(4);   // the loop had a subject
    for (const n of LIMB_UNIFORMS) expect(gNames.has(n), `${n} collides with giantDeck`).toBe(false);
  });

  it('every uniform it names EXISTS on the lab material', () => {
    // writePackUniforms throws on a name the material does not carry, which is the mechanism; this
    // asserts the precondition directly so a typo is a red test rather than a red game.
    const u = buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms;
    for (const n of LIMB_UNIFORMS) expect(u[n], n).toBeTruthy();
    expect(() => writePackUniforms(buildLabPlanetMaterial({ bodyRadius: 1 }).material.uniforms,
      { uLimbStrengt: scalar(0.7, { gate: LIMB_GATE }) }, { displayRadiusEarth: 1, gates: ALL_ON }))
      .toThrow(/no uniform named 'uLimbStrengt'/);
  });

  it('NO RENDERER IN THE IMPORT CLOSURE, and it adds no dependency giantDeck did not already carry', () => {
    // ⭐ A PROPERTY NEITHER MY OTHER GATES NOR THE SHIPPED FENCE CAN SEE. tests/pack-contract.test.js
    // walks only `featureScale.js` and `writePackUniforms.js`; it never walks a pack, so a pack that
    // reached a renderer would pass it. The narrower claim that actually matters is
    // src/worldengine/drivers/index.js:40 `NO RENDERER IN THE CLOSURE` — so a pack runs headless,
    // in the lab and in the game. ⚠ NOT "zero bare specifiers": `alea` is genuinely reachable
    // through e1Regime.js, and giantDeck already carries it. The gate is therefore SET EQUALITY
    // against the shipped pack's own closure, so a NEW dependency is a deliberate edit.
    const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g;
    const closureOf = (entryRel) => {
      const seen = new Set(); const bare = new Set();
      const walk = (rel) => {
        if (seen.has(rel)) return;
        seen.add(rel);
        const src = read(rel);
        IMPORT_RE.lastIndex = 0;
        let m;
        while ((m = IMPORT_RE.exec(src)) !== null) {
          const spec = m[1];
          if (spec.startsWith('.') || spec.startsWith('/')) {
            walk(join(dirname(join(ROOT, rel)), spec).slice(ROOT.length + 1));
          } else bare.add(spec);
        }
      };
      walk(entryRel);
      return { files: [...seen].sort(), bare: [...bare].sort() };
    };
    const mine = closureOf('src/worldengine/drivers/limbDeck.js');
    const giant = closureOf('src/worldengine/drivers/giantDeck.js');
    expect(mine.bare).not.toContain('three');
    expect(mine.files.some((f) => /rendering|shaders|glsl|\.html$/.test(f))).toBe(false);
    // [CONTROL] the walker is not vacuous — it really does find the bare specifier that IS there.
    expect(giant.bare.length).toBeGreaterThan(0);
    expect(mine.bare.every((b) => giant.bare.includes(b)), `new deps: ${JSON.stringify(mine.bare)}`).toBe(true);
  });

  it('SHADER FACT 1: uLimbStrength is a bare multiplicand with exactly one read site in the GLSL', () => {
    // The pack's whole claim — "0 deletes the term exactly, 0.7 restores it" — is a claim about
    // GLSL this suite cannot execute. It is pinned as source instead of assumed.
    const glsl = read('planet-lod-shaders.glsl.js');
    const hits = glsl.split('\n').filter((l) => l.includes('uLimbStrength') && !l.trim().startsWith('//'));
    expect(hits.length).toBe(1);
    expect(hits[0]).toContain('* uLimbStrength * (diff + 0.15)');
    expect(hits[0]).toContain('pow(1.0 - max(dot(N, V), 0.0), uLimbExponent)');
  });

  it('SHADER FACT 2: provinceWeight(PROV_LIMB) is identically 1.0 — no second hidden gate', () => {
    // ⭐ THE QUESTION THIS SUITE HAD TO ASK OF ITSELF. The rim term is also multiplied by
    // planet-lod-shaders.glsl.js:940 `vec3 limbC = uLimbColor * limb * provinceWeight(PROV_LIMB);`.
    // If that factor were zero on a game body, opening the strength gate would change no pixel and
    // this whole lane would be decoration. Measured from the source: PROV_LIMB's floor is 1.00, and
    // planet-lod-height.glsl.js:901 `return mix(1.0, fl + (1.0 - fl) * f, uProvinceWeight);` with
    // fl = 1.0 is `mix(1.0, 1.0, x)` — identically 1.0 for every field sample and every knob value.
    const h = read('planet-lod-height.glsl.js');
    const row = h.split('\n').find((l) => l.includes('fid == PROV_LIMB'));
    expect(row, 'the PROV_LIMB row must exist').toBeTruthy();
    expect(row).toContain('fl = 1.00');
    expect(h).toContain('return mix(1.0, fl + (1.0 - fl) * f, uProvinceWeight);');
    // ...and the limb term is added unconditionally — it sits behind no `if` of its own.
    const s = read('planet-lod-shaders.glsl.js');
    expect(s).toContain('vec3 limbC = uLimbColor * limb * provinceWeight(PROV_LIMB);');
  });
});
