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
 * ── WHY FOUR CHANNELS AND NOT ONE ───────────────────────────────────────────
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
//       un-overridden planet-scale values. See the declared exception below.
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
// CHANNEL 2 — OUTPUT AGREEMENT. Vacuous today by construction (see header);
// bites the moment a bake law starts reading one of the widened keys.
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

  it('P stratum — planet-class moons diverge ONLY in the declared set (a NAMED known defect)', () => {
    // ⛔ THIS IS A REAL, CURRENTLY-SHIPPING DISAGREEMENT AND IT IS PINNED, NOT FIXED.
    //
    // MoonGenerator.js:317-327 builds a planet-class moon by generating a FULL
    // PLANET at 1 AU and then shrinking it:
    //     const scaledPlanetData = { ...pData, radiusEarth, massEarth: pData.massEarth * massScale, … }
    // PlanetGenerator already baked landPalette / iceness / lava colours from the
    // UN-shrunk planet, so the record the renderer holds carries planet-scale
    // bakes beside moon-scale physical inputs. This is a TIMING divergence, not a
    // field-set one: passing the whole record cannot fix it, because the record
    // is mutated after the bake ran.
    //
    // MEASURED (600 seeds): 28 of 29 planet-class moons disagree — lavaGlowColor
    // 28, lavaCrustColor 28, landPalette 2, iceness 0. The S stratum reads 0/2485,
    // which is the control proving this is the rescale and not the measurement.
    //
    // ⛔ NOT FIXED HERE, deliberately, and for the reason the adapter gives for the
    // surfaceHistory/erosion rename: correcting it MOVES SHIPPED PIXELS on ~1% of
    // bodies (uLavaGlow / uLavaCrust / uWeatheredColor), and it would land inside a
    // step whose whole claim is that nothing moves. It needs its own step, with a
    // deliberately-not-byte-identity gate and a committed delta table.
    //
    // ⭐ IF YOU FIX IT, THIS TEST GOES RED ON THE "at least one" ASSERTION. That is
    // the pin working: come here, delete the exception, and say so in the plan.
    const DECLARED = new Set(['landPalette', 'lavaGlowColor', 'lavaCrustColor']);
    expect(P.length, 'no planet-class moons in the corpus — this exception is unmeasured').toBeGreaterThan(10);

    const seen = new Set();
    let diverged = 0;
    for (const { rec } of P) {
      const fields = disagreeingFields(rec);
      if (fields.length) diverged++;
      for (const f of fields) seen.add(f);
    }
    expect(
      [...seen].filter((f) => !DECLARED.has(f)),
      'a planet-class moon now diverges on a field outside the declared MoonGenerator-rescale set. '
      + 'Either the rescale grew, or a second route asymmetry was introduced.',
    ).toEqual([]);
    expect(
      diverged,
      'no planet-class moon diverges any more. If that was deliberate, delete this exception and '
      + 'record the pixel delta; if it was not, the corpus stopped containing the case.',
    ).toBeGreaterThan(0);
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
