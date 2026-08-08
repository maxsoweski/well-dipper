/**
 * ════════════════════════════════════════════════════════════════════════════
 * ROUTE-AGREEMENT GATE — the game crosses the engine seam TWICE per body,
 * and the two crossings must describe the SAME BODY.
 * docs/FEATURES/one-pipeline-two-frontends-PLAN.md
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── THE TWO ROUTES ──────────────────────────────────────────────────────────
 *   BAKE   src/generation/PlanetGenerator.js — `conditionFromPlanet(planetData)`
 *          once per generated body, at generation time. Its condition drives the
 *          five values baked ONTO the record: landPalette, iceness, iceColor,
 *          lavaGlowColor, lavaCrustColor.
 *   RENDER src/objects/Planet.js:1568 — `conditionFromPlanet(d)` where `d =
 *          this.data`, once per material, at mesh-build time. Its condition
 *          drives craterUniformsFrom / atmosphereOpticsOf / biosphereOf.
 *
 * Both call the SAME adapter and the five bake laws are the SAME FUNCTIONS the
 * render route can call. So "the same body" has to mean the same thing on both
 * sides, or one function produces two answers for one planet.
 *
 * ── WHAT WENT WRONG, MEASURED ───────────────────────────────────────────────
 * Until 2026-08-07 the bake route passed a hand-picked NINE-KEY LITERAL
 *     { radiusEarth, massEarth, composition, T_eq, age, atmosphere,
 *       tidalState, surfaceHistory, eccentricity }
 * while the render route passed the whole record. Measured over 808 generated
 * bodies (200 seeds, planets + planet-class moons), the two conditions disagreed
 * on exactly three keys, on 808/808 bodies:
 *
 *     magneticField   bake undefined | render 0.0613   (S:1:p0)
 *     habitability    bake undefined | render 0.5500   (S:1:p0)
 *     axialTiltDeg    bake undefined | render 24.884   (S:1:p0)
 *
 * — precisely the three keys Step 1 added. Every one of the 808 was DEGENERATE:
 * a default standing in for a measured value, never two different measurements.
 * `_provenance` named it directly: 'defaulted' on the bake route and 'measured'
 * on the render route, for the same fully-populated body. That is the signal
 * _provenance was built to give, and it is the reason this file exists.
 *
 * Nothing read those keys yet, so no pixel had moved. The hazard was inheritance:
 * the moment Step 4/5/8 adds a habitability or magneticField term to
 * `surfacePaletteOf`, the baked landPalette and the live material's palette
 * disagree for one body from one function, and Instrument C reports it as a
 * bake-tier delta whose cause is a CALL SITE, not a law.
 *
 * ── WHY THREE CHANNELS AND NOT ONE ──────────────────────────────────────────
 * ⭐ The obvious gate — "bake output == render recompute" (channel 2) — is
 * VACUOUS for the field-set question TODAY, and saying so is the point. The
 * three keys are inert: deleting each from a live condition moves 0/808 of the
 * four bake laws. So channel 2 would stay green against a bake route that had
 * silently gone back to a subset literal, right up until the first law started
 * reading one — which is the exact moment the evidence is least useful.
 * Channel 1 (source text) is therefore the one that bites NOW, and channel 2 is
 * the one that bites LATER. Neither replaces the other.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromPlanet } from '../src/worldengine/port/conditionFromPlanet.js';
import {
  surfacePaletteOf, icenessOf, meltTemperatureOf, crustTemperatureOf, BIO_PIGMENT,
} from '../src/worldengine/base/surfaceMaterial.js';
import { emissiveBlackbody } from '../src/worldengine/base/emission-e.js';
import { applyAlbedoTransfer } from '../src/worldengine/display/albedoTransfer.js';

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE-TEXT MACHINERY
// The same technique tests/port-condition-contract.test.js uses to pin the
// adapter's own reads. Re-implemented here rather than imported so this gate
// does not go green because a helper it shares with another gate was edited.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Comments and string bodies removed in ONE pass, so `//` inside a string does
 * not open a comment and a backtick inside a comment does not open a template
 * literal. `endState !== 'code'` is the signature of this codebase's GLSL
 * backtick trap and is asserted, not assumed.
 * ⚠ KNOWN LIMIT, STATED: regex literals are not tracked. Neither scanned file
 * contains one; `endState` catches the case where one would desync the scan.
 */
function stripCommentsAndStrings(src) {
  let out = '', i = 0, state = 'code';
  while (i < src.length) {
    const c = src[i], c2 = src[i + 1];
    if (state === 'code') {
      if (c === '/' && c2 === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && c2 === '*') { state = 'block'; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') { state = c; out += ' '; i++; continue; }
      out += c; i++; continue;
    }
    if (state === 'line') { if (c === '\n') { state = 'code'; out += '\n'; } i++; continue; }
    if (state === 'block') { if (c === '*' && c2 === '/') { state = 'code'; i += 2; } else { if (c === '\n') out += '\n'; i++; } continue; }
    if (c === '\\') { i += 2; continue; }
    if (c === state) { state = 'code'; i++; continue; }
    if (c === '\n') out += '\n';
    i++;
  }
  return { code: out, endState: state };
}

/** The brace-matched body of the function whose signature starts with `sig`. */
function functionBodyOf(code, sig) {
  const at = code.indexOf(sig);
  if (at < 0) return null;
  const open = code.indexOf('{', at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) return code.slice(open + 1, i);
  }
  return null;
}

/**
 * Every argument text passed to `conditionFromPlanet(` in a chunk of
 * comment-free code, paren-matched so an object literal containing `(` or a
 * nested call does not truncate the capture.
 */
function conditionCallArgsIn(body) {
  const args = [];
  const needle = 'conditionFromPlanet(';
  let at = 0;
  for (;;) {
    at = body.indexOf(needle, at);
    if (at < 0) break;
    let i = at + needle.length, depth = 1;
    for (; i < body.length && depth > 0; i++) {
      if ('([{'.includes(body[i])) depth++;
      else if (')]}'.includes(body[i])) depth--;
    }
    args.push(body.slice(at + needle.length, i - 1).trim());
    at = i;
  }
  return args;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * The whole route-shape claim, as one function so the CONTROL below can run the
 * identical logic against synthetic sources. Returns a verdict object rather
 * than throwing, so a control can assert a REJECTION.
 */
function routeShapeOf(code, sig) {
  // ⭐ THE ANCHOR MUST BE UNIQUE, and this guard is not decorative — it caught a
  // real miss while this file was being written. `_createSurface()` appears twice
  // in Planet.js: the CALL at :1533 (`this.surface = this._createSurface();`) and
  // the DEFINITION at :1548. A plain indexOf found the call, brace-matched the
  // enclosing block, saw zero conditionFromPlanet calls in it and would have been
  // read as "the render route stopped calling the adapter". Anchors are
  // line-anchored below; this asserts the anchor resolved to one place.
  const hits = code.split(sig).length - 1;
  if (hits !== 1) return { ok: false, why: `anchor ${JSON.stringify(sig)} matched ${hits} times — it must match exactly the definition` };
  const body = functionBodyOf(code, sig);
  if (body === null) return { ok: false, why: `could not locate ${sig}` };
  const args = conditionCallArgsIn(body);
  if (args.length !== 1) return { ok: false, why: `expected exactly 1 conditionFromPlanet call, found ${args.length}`, args };
  const arg = args[0];
  if (!IDENTIFIER.test(arg)) {
    return { ok: false, why: `the argument is not a bare identifier — a subset literal or expression was reintroduced: ${arg.slice(0, 120)}`, args };
  }
  return { ok: true, arg, body };
}

const srcOf = (rel) => stripCommentsAndStrings(
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'),
);

// ─────────────────────────────────────────────────────────────────────────────
// CORPUS — real generated bodies, in two strata, because they behave differently.
//   S = generated planets. Nothing mutates their record after the bake.
//   P = planet-class moons. MoonGenerator.js:317-327 OVERRIDES radiusEarth and
//       massEarth on a spread copy AFTER PlanetGenerator already baked from the
//       un-overridden planet-scale values. Until Step 2 that made them diverge
//       from the render route; they no longer do, and the P block below is where
//       the closure is measured, controlled, and watched for its return.
// `toSceneData` is deliberately NOT applied: it rewrites radius / noiseScale /
// clouds.scale, and the adapter reads none of the three (it reads radiusEarth).
// ─────────────────────────────────────────────────────────────────────────────
const SEEDS = 600;
const S = [], P = [];
beforeAll(() => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const sys = StarSystemGenerator.generate(seed);
    sys.planets.forEach((entry, pi) => {
      S.push({ id: `S:${seed}:p${pi}`, rec: entry.planetData });
      (entry.moons || []).forEach((m, mi) => {
        if (m.isPlanetMoon && m.planetData) P.push({ id: `P:${seed}:p${pi}:m${mi}`, rec: m.planetData });
      });
    });
  }
});

const J = (v) => JSON.stringify(v);

/** The four DERIVED bakes, recomputed from a condition exactly as PlanetGenerator does. */
const bakesFrom = (c) => ({
  landPalette: applyAlbedoTransfer(surfacePaletteOf(c), { extra: { pigment: BIO_PIGMENT } }),
  iceness: icenessOf(c),
  lavaGlowColor: emissiveBlackbody(meltTemperatureOf(c)),
  lavaCrustColor: emissiveBlackbody(crustTemperatureOf(c)),
});
/** The same four as they were actually baked onto the record. `iceColor` is a constant. */
const bakedOn = (rec) => ({
  landPalette: rec.landPalette, iceness: rec.iceness,
  lavaGlowColor: rec.lavaGlowColor, lavaCrustColor: rec.lavaCrustColor,
});
/** Which of the four disagree between the record and a fresh render-route recompute. */
function disagreeingFields(rec) {
  const now = bakesFrom(conditionFromPlanet(rec)), was = bakedOn(rec);
  return Object.keys(now).filter((k) => J(now[k]) !== J(was[k]));
}

// ═════════════════════════════════════════════════════════════════════════════
// CHANNEL 1 — ROUTE SHAPE. Bites TODAY. One constructor, one argument.
// ═════════════════════════════════════════════════════════════════════════════
describe('Route agreement · channel 1 — both call sites pass the whole record', () => {
  it('CONTROL — the extractor REJECTS a subset literal, so a green result means something', () => {
    // Without this, channel 1 is a regex nobody has watched fail. This is the
    // exact code shape that shipped before 2026-08-07, reduced to a fixture.
    const bad = `
      static generate(rng, orbitRadiusAU) {
        const condition = conditionFromPlanet({
          radiusEarth, massEarth, composition, T_eq, age: ageGyr,
          atmosphere, tidalState, surfaceHistory, eccentricity,
        });
        const planetData = { type, iceness: icenessOf(condition) };
        return planetData;
      }`;
    const v = routeShapeOf(bad, '\n      static generate(rng, orbitRadiusAU)');
    expect(v.ok, 'the extractor accepted a nine-key subset literal — it cannot police this').toBe(false);
    expect(v.why).toMatch(/subset literal or expression/);
  });

  it('CONTROL — the extractor REJECTS an identifier that is not the returned record', () => {
    // The subtler regression: pass a *variable*, but not the one you return.
    const bad = `
      static generate(rng, orbitRadiusAU) {
        const inputs = { radiusEarth, massEarth };
        const condition = conditionFromPlanet(inputs);
        const planetData = { type };
        return planetData;
      }`;
    const v = routeShapeOf(bad, '\n      static generate(rng, orbitRadiusAU)');
    expect(v.ok, 'shape check passed').toBe(true);
    expect(
      new RegExp(`return\\s+${v.arg}\\s*;`).test(v.body),
      'the extractor accepted a condition built from an object that is NOT the returned record',
    ).toBe(false);
  });

  it('CONTROL — the source scanner survives both files intact (the GLSL-backtick trap)', () => {
    for (const rel of ['../src/generation/PlanetGenerator.js', '../src/objects/Planet.js']) {
      expect(srcOf(rel).endState, `${rel} ends inside a string or comment`).toBe('code');
    }
  });

  it('BAKE route — PlanetGenerator builds the condition from the record it returns', () => {
    const { code } = srcOf('../src/generation/PlanetGenerator.js');
    const v = routeShapeOf(code, '\n  static generate(rng, orbitRadiusAU, sunDirection = null, zones = null, forceType = null)');
    expect(v.ok, v.why).toBe(true);
    expect(
      new RegExp(`return\\s+${v.arg}\\s*;`).test(v.body),
      `PlanetGenerator.generate builds its condition from \`${v.arg}\`, but does not return \`${v.arg}\`. `
      + 'The bake route must derive from the SAME object the renderer later receives, or the two '
      + 'crossings of this seam describe different bodies. See the header of this file.',
    ).toBe(true);
  });

  it('RENDER route — Planet._createSurface builds the condition from this.data', () => {
    const { code } = srcOf('../src/objects/Planet.js');
    const v = routeShapeOf(code, '\n  _createSurface()');
    expect(v.ok, v.why).toBe(true);
    expect(
      new RegExp(`(const|let)\\s+${v.arg}\\s*=\\s*this\\.data\\s*;`).test(v.body),
      `Planet._createSurface builds its condition from \`${v.arg}\`, which is not bound to this.data.`,
    ).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CHANNEL 2 — OUTPUT AGREEMENT. For the FIELD-SET question it is vacuous today
// by construction (see header) and bites the moment a bake law starts reading one
// of the widened keys. For the TIMING question it is not vacuous and never was:
// the P stratum below watches a real post-bake mutation, and carries its own
// controls because its subject went to zero on 2026-08-08.
// ═════════════════════════════════════════════════════════════════════════════
describe('Route agreement · channel 2 — the baked five equal the render-route recompute', () => {
  it('CONTROL — the comparator can see a move, on each of the four derived bakes', () => {
    // A green channel 2 is worth nothing unless the comparison bites. T_eq is a
    // field all four laws demonstrably read; a saturated law may not move on any
    // ONE perturbation, so both directions are tried and each law must move on
    // at least one. Measured at 200 seeds: T_eq×3 moves landPalette on 748/808,
    // iceness 178, lavaGlow 224, lavaCrust 224.
    const reached = { landPalette: 0, iceness: 0, lavaGlowColor: 0, lavaCrustColor: 0 };
    for (const { rec } of S.slice(0, 300)) {
      const c = conditionFromPlanet(rec);
      for (const f of [3, 0.3]) {
        const now = bakesFrom(c), moved = bakesFrom({ ...c, T_eq: c.T_eq * f });
        for (const k of Object.keys(reached)) if (J(now[k]) !== J(moved[k])) reached[k]++;
      }
    }
    for (const [k, n] of Object.entries(reached)) {
      expect(n, `the comparator never saw ${k} move — channel 2 is blind on that law`).toBeGreaterThan(0);
    }
  });

  it('S stratum — every generated planet agrees, exactly', () => {
    expect(S.length).toBeGreaterThan(2000);
    const bad = S.filter(({ rec }) => disagreeingFields(rec).length > 0);
    expect(
      bad.map((b) => `${b.id}: ${disagreeingFields(b.rec).join(',')}`).slice(0, 8),
      `${bad.length}/${S.length} generated planets carry a baked value that the render route would `
      + 'recompute differently. One body, one function, two answers.',
    ).toEqual([]);
  });

  it('P stratum — planet-class moons agree too, and the comparator is PROVED able to say otherwise', () => {
    // ⭐ THIS TEST HELD A DECLARED EXCEPTION UNTIL 2026-08-08 AND NO LONGER DOES. The history is
    // kept because the SHAPE of the closure is the reason this file is worth having.
    //
    // ── WHAT THE EXCEPTION WAS ───────────────────────────────────────────────────────────────
    // MoonGenerator.js:317-327 builds a planet-class moon by generating a FULL PLANET at 1 AU and
    // then shrinking it:
    //     const scaledPlanetData = { ...pData, radiusEarth, massEarth: pData.massEarth * massScale, … }
    // PlanetGenerator has ALREADY baked landPalette / iceness / lava colours from the UN-shrunk
    // planet, so the record the renderer holds carries planet-scale bakes beside moon-scale
    // physical inputs. That is a TIMING divergence, not a field-set one — passing the whole record
    // cannot fix it, because the record is mutated after the bake ran. MEASURED at 600 seeds it
    // read 28 of 29 planet-class moons disagreeing (lavaGlowColor 28, lavaCrustColor 28,
    // landPalette 2, iceness 0) against 0/2485 on the S stratum, which is what proved it was the
    // rescale and not the measurement. The pin carried its own instruction: if you fix it, come
    // here, delete the exception, and say so in the plan.
    //
    // ── WHAT CLOSED IT — Step 2, and NOT by touching MoonGenerator ────────────────────────────
    // ⭐ The rescale is still there and still runs AFTER the bake. What moved is what the bake laws
    // READ. The old rule made `rawTidalIoRatio` a function of `radiusEarth^5` — precisely the field
    // the rescale overrides — so meltTemperatureOf / crustTemperatureOf saw one radius on the bake
    // route and another on the render route. Step 2 maps `tidalHeat: d.tidalHeating`, a value the
    // rescale does not touch, and both routes now read the same number: 0 of 29 disagree, on all
    // four bakes, over this file's own 600-seed corpus. Recorded in §4 Step 2 of the plan.
    //
    // ── ⛔ WHY THE ZERO IS NOT THE WHOLE TEST ─────────────────────────────────────────────────
    // Flipping the old "at least one" assertion to `toBe(0)` would have left a gate whose subject
    // had gone to zero, which is §11.1 class D — and its sibling ("diverges only in the declared
    // set") had ALREADY gone vacuous by that route: with nothing diverging, `seen` was empty and it
    // compared [] to []. A zero is indistinguishable from a broken comparator; that is exactly how
    // Instrument C failed in round 1 of this program, printing 0.000000e+0 for the one uniform that
    // had moved. So three controls run FIRST, on THESE 29 RECORDS: two that must SEE an injected
    // divergence (or the zero below is unfalsifiable) and one that names the mechanism the closure
    // rests on, so the day it stops holding this block says so rather than staying quietly green.
    expect(P.length, 'no planet-class moons in the corpus — every claim below would be vacuous').toBeGreaterThan(10);

    // ⚠ CONTROLS 2 AND 3 ARE STATED RELATIVE TO EACH BODY'S OWN BASELINE ANSWER, not against an
    // assumed empty one, and that is not fussiness. Written the naive way — "the injected set must
    // equal exactly [f]" — a control silently becomes a SECOND detector of the very defect the gate
    // below detects, and a real route divergence reds the CONTROL instead of the GATE. Measured, not
    // reasoned: growing MoonGenerator's rescale by one post-bake `tidalHeating` override reds the
    // naive control 2 on 112/116 injections and never reaches the gate, so the failure text talks
    // about the comparator when the fault is in the route. A control must report on the INSTRUMENT.
    const baselineOf = new Map(P.map(({ id, rec }) => [id, disagreeingFields(rec)]));

    // ── CONTROL 1 · PER BODY. The exception's own defect shape, injected deliberately: mutate a
    // field the bake laws demonstrably read AFTER the bake, and require the comparator to RETURN
    // SOMETHING — on every single body, not on the corpus in aggregate. `tidalHeating` is the field
    // Step 2 forwards, so this also pins the chain that closed the exception. Two values, because
    // one body can sit where a single perturbation lands back on its own colour: 0 disagrees on
    // 28/29 and 1e4 on 28/29, and they are NOT the same 28 — the union is 29/29.
    // ⛔ ABSOLUTE, not relative, and deliberately so: this one asks "could this body's zero ever
    // have been a one?", and on a body that is ALREADY diverging the answer is trivially yes and the
    // gate below is what speaks. Relative here would fail on a red baseline whose answer set has
    // saturated (27/29 under the mutant above) and bury the real finding under an instrument alarm.
    const blind = [];
    for (const { id, rec } of P) {
      const lo = disagreeingFields({ ...rec, tidalHeating: 0 });
      const hi = disagreeingFields({ ...rec, tidalHeating: 1e4 });
      if (!lo.length && !hi.length) blind.push(id);
    }
    expect(
      blind.slice(0, 8),
      `${blind.length}/${P.length} planet-class moons show NO disagreement even when the record is `
      + 'mutated after the bake. On those bodies the gate below cannot fail, so its verdict is not '
      + 'evidence of agreement — it is evidence of nothing.',
    ).toEqual([]);

    // ── CONTROL 2 · PER FIELD. Seeing *a* move is not enough: the gate's value is that it NAMES the
    // field, so the comparator has to be shown naming each of the four, with no smearing onto its
    // neighbours. A sentinel is written over one baked value at a time; the answer must gain exactly
    // that field and leave the rest of the body's answer untouched. The injection cannot feed back
    // into the recompute side — `conditionFromPlanet` reads the physical inputs and none of the four
    // bakes, which is what makes overwriting them a clean one-sided injection.
    const FIELDS = ['landPalette', 'iceness', 'lavaGlowColor', 'lavaCrustColor'];
    const missed = [];
    for (const { id, rec } of P) {
      const base = baselineOf.get(id);
      for (const f of FIELDS) {
        const named = disagreeingFields({ ...rec, [f]: '__synthetic route divergence__' });
        const without = (arr) => arr.filter((k) => k !== f);
        if (!named.includes(f) || J(without(named)) !== J(without(base))) {
          missed.push(`${id}.${f} → named ${J(named)}, baseline ${J(base)}`);
        }
      }
    }
    expect(
      missed.slice(0, 8),
      `${missed.length}/${P.length * FIELDS.length} injected divergences the comparator failed to `
      + 'name. A comparator that cannot say WHICH field moved cannot be read as saying none did.',
    ).toEqual([]);

    // ── CONTROL 3 · THE MECHANISM, NAMED AND WATCHED. The exception did not close because the
    // rescale stopped; it closed because the four bake laws stopped reading anything the rescale
    // moves. This perturbs the rescale's own axis far harder than MoonGenerator does, in both
    // directions — 29 bodies × 2 perturbations — and measures 0/58.
    // ⚠ A RED HERE IS NOT A BUG IN THIS FILE. It means a bake law has begun reading a rescaled
    // field, the timing divergence is live again on real bodies, and the declared exception has to
    // be reinstated — with a fresh delta table, per the plan's rule for anything that moves shipped
    // pixels. This is the assertion that says so before the gate below does.
    const rescaleSensitive = [];
    for (const { id, rec } of P) {
      const base = J(baselineOf.get(id));
      for (const [rf, mf] of [[0.3, 0.05], [3, 10]]) {
        const f = disagreeingFields({
          ...rec, radiusEarth: rec.radiusEarth * rf, massEarth: rec.massEarth * mf,
        });
        if (J(f) !== base) rescaleSensitive.push(`${id} radius×${rf} mass×${mf}: ${J(f)} vs ${base}`);
      }
    }
    expect(
      rescaleSensitive.slice(0, 8),
      `${rescaleSensitive.length} of ${P.length * 2} rescale perturbations moved a bake. A bake law `
      + 'now reads a field MoonGenerator overrides after the bake, so the timing divergence this '
      + 'block used to declare is constructible again. See the history above before editing.',
    ).toEqual([]);

    // ── THE GATE. Same claim as the S stratum, on the stratum that had the real defect: one body,
    // one function, one answer — across a rescale that happens between the two crossings of the seam.
    const bad = P.filter(({ rec }) => disagreeingFields(rec).length > 0);
    expect(
      bad.map((b) => `${b.id}: ${disagreeingFields(b.rec).join(',')}`).slice(0, 8),
      `${bad.length}/${P.length} planet-class moons carry a baked value that the render route would `
      + 'recompute differently. Either the MoonGenerator rescale grew a reader (control 3 above says '
      + 'which axis), or a second route asymmetry was introduced — Step 8 gives moons a second '
      + 'generator path, which is the first place a value divergence becomes constructible again.',
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CHANNEL 3 — PROVENANCE. The direct statement of the original defect: the bake
// route saw 'defaulted' for three fields the body actually measures.
// ═════════════════════════════════════════════════════════════════════════════
describe('Route agreement · channel 3 — the bake route MEASURES the widened keys', () => {
  // Reads as a claim about the bake route only in combination with channel 1,
  // which is what establishes that the generator passes this very record. Stated
  // rather than assumed, because a provenance record read off a reconstructed
  // argument would be the reconstruction's provenance, not the route's.
  const WIDENED = ['magneticField', 'habitability', 'axialTilt'];

  it('CONTROL — _provenance still says "defaulted" when the key is genuinely absent', () => {
    const bare = conditionFromPlanet({ radiusEarth: 1 })._provenance;
    for (const k of WIDENED) {
      expect(bare[k], `${k} reported '${bare[k]}' on a body that carries nothing`).toBe('defaulted');
    }
  });

  it('every generated planet measures all three — the 808/808 "defaulted" is gone', () => {
    const bad = [];
    for (const { id, rec } of S) {
      const p = conditionFromPlanet(rec)._provenance;
      for (const k of WIDENED) if (p[k] !== 'measured') bad.push(`${id}.${k}=${p[k]}`);
    }
    expect(
      bad.slice(0, 10),
      `${bad.length} readings where the record carries a value the seam recorded as defaulted. `
      + 'Before 2026-08-07 the bake route read all three as "defaulted" on 808/808 bodies while the '
      + 'render route read them as "measured" for the same planet.',
    ).toEqual([]);
  });
});
