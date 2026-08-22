// tests/port-terminator-law.test.js — the terminator is a BAND at the day/night line, and its
// strength and width are the lab's laws rather than game-authored stand-ins.
//
// WHY THIS EXISTS. The first terminator port shipped three defects that every existing check
// missed, because every existing check measured the JS module and none of them read the GLSL.
// tests/port-limb-optics.test.js says so in its own header: "NOT tested here: that the shader
// consumes them correctly. That is a GLSL claim and was verified live in the browser instead."
// The live browser pass then confirmed "terminator on 36 of 36 bodies, 16 distinct hues" — all
// true, all measured on the JS side, and all compatible with the shader flooding the entire night
// hemisphere. So this file asserts the SHADER TEXT and the SHAPE OF THE LAW, not the module.
//
// The three defects, each of which gets an assertion below:
//   1. FLOOD. tt was computed from `diffuse`, which is built from max(dot(N,L), 0.0) and is
//      therefore 0 across the whole night side. exp(-0*0) == 1.0, so the "gaussian centred on the
//      terminator" was a half-gaussian pinned at PEAK over every dark pixel. Signed mu fixes it.
//   2. MAGNITUDE. uTermStrength shipped as columnFraction, which saturates to exactly 1.0 above
//      0.3 bar. The lab's tuned value is 0.15 — retuned there in 2026-06-15 precisely because 0.5
//      "swamped the surface into a heavy orange BELT on every atmospheric world (Max-reported)".
//      The port shipped 6.7x the value the lab had already reduced.
//   3. WIDTH. A provisional constant 0.18 stood in for the lab's log-pressure ramp on the grounds
//      that the real law was trapped in the un-extracted applyDrivers. It was not — the lab's law
//      reads only atmosphere.pressure.
//
// FENCE PATTERN: planet-lod-lab.html and the game source are read as source TEXT and compared, the
// same way the other lab fences work. This is deliberate — importing src/objects/Planet.js pulls a
// bare specifier that only resolves under Vite, and the claims here are claims about the text.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// ⭐ B3-1: THE LAW IS NOW IMPORTABLE, SO THIS FILE IMPORTS IT. Until 2026-08-21 `TERM_STRENGTH` and
// `termWidthFor` were module-private inside src/objects/Planet.js, so the only way to check them was
// to scrape the file as text and `new Function` the body out of it. They now live in
// src/worldengine/base/terminatorOptics.js, whose only import is the sibling optics module — no
// bare specifier, so vitest resolves it. The text-scrape assertions BELOW are kept and re-pointed
// rather than deleted: they are what stops the law being quietly re-authored back into the game
// material, which is the failure this whole extraction exists against.
import { TERM_STRENGTH, termWidthFor, terminatorOpticsOf } from '../src/worldengine/base/terminatorOptics.js';
import { atmosphereOpticsOf } from '../src/worldengine/base/atmosphereOptics.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLANET = readFileSync(join(ROOT, 'src/objects/Planet.js'), 'utf8');
const LAB = readFileSync(join(ROOT, 'planet-lod-lab.html'), 'utf8');
const TERMMOD = readFileSync(join(ROOT, 'src/worldengine/base/terminatorOptics.js'), 'utf8');

describe('terminator: the shader computes a band, not a night-side flood', () => {
  it('uses SIGNED mu from the geometric normal at every one of the three surface branches', () => {
    const signed = PLANET.match(/float muTerm = dot\(vNormal, lightDir\);/g) || [];
    // rocky, gas and exotic each carry their own copy of the surface shader.
    expect(signed.length).toBe(3);
  });

  it('never derives the gaussian argument from the CLAMPED diffuse term', () => {
    // This is the actual bug, stated as text: `diffuse` is clamped at 0, so dividing it by the
    // width makes tt == 0 over the whole night hemisphere.
    expect(PLANET).not.toMatch(/diffuse\s*\/\s*max\(uTermWidth/);
  });

  it('uses vNormal, not the relief-perturbed shadingNormal (relief must not bend twilight)', () => {
    expect(PLANET).not.toMatch(/float muTerm = dot\(shadingNormal/);
  });

  it('produces a gaussian that PEAKS at the day/night line and vanishes at the antisolar point', () => {
    // The shape claim, evaluated numerically rather than asserted in prose. w = 0.12 is the law's
    // value at 1 bar.
    const w = 0.12;
    const profile = (mu) => Math.exp(-((mu / w) ** 2));

    // Peak sits exactly at the terminator.
    expect(profile(0)).toBeCloseTo(1.0, 12);
    // Deep night is dark. This is the assertion the shipped code failed: with clamped diffuse the
    // argument was 0 here too, giving 1.0 — full-strength tint on every dark pixel.
    expect(profile(-1.0)).toBeLessThan(1e-30);
    // Full day is dark.
    expect(profile(1.0)).toBeLessThan(1e-30);
    // Symmetric about the line, which is what "centred on the terminator" means.
    for (const mu of [0.05, 0.1, 0.2, 0.4]) {
      expect(profile(mu)).toBeCloseTo(profile(-mu), 12);
    }
  });

  it('REGRESSION SHAPE: the old clamped form was pinned at peak across the entire night side', () => {
    // Kept as an instrument, not as dead prose. If someone reintroduces the clamp, this documents
    // exactly what it does: every mu <= 0 collapses to the same maximum.
    const w = 0.12;
    const broken = (mu) => Math.exp(-((Math.max(mu, 0) / w) ** 2));
    for (const mu of [0, -0.1, -0.5, -1.0]) expect(broken(mu)).toBe(1.0);
  });
});

describe('terminator: strength and width are the LAB’s laws, not game-authored constants', () => {
  it('magnitude matches the value the lab retuned to, and is not columnFraction', () => {
    // ⭐ READ OFF THE MODULE, NOT SCRAPED OUT OF THE GAME FILE. The constant is the imported binding.
    const mod = TERMMOD.match(/export const TERM_STRENGTH = ([0-9.]+);/);
    expect(mod, 'TERM_STRENGTH must be EXPORTED from src/worldengine/base/terminatorOptics.js').toBeTruthy();
    expect(Number(mod[1])).toBe(TERM_STRENGTH);

    // ⛔⛔ THIS ASSERTION USED TO SCRAPE THE LAB'S TERNARY FOR 0.15 AND COMPARE. That worked only
    // while the lab held a SECOND COPY of the magnitude, and requiring two copies so they can be
    // compared is the two-routes disease encoded as a test. Max ruled 2026-08-22 — "the important
    // thing here is the game and lab end up working the same" — and the lab now CALLS the module:
    // planet-lod-lab.html:2497 `state.termStrength = terminatorOpticsOf(_atmoCond).termStrength;`.
    //
    // ⭐ SO THE PIN MOVES HERE, AND IT IS STRONGER THAN WHAT IT REPLACES — it pins the VALUE with
    // its provenance, and separately pins that the lab READS the module, which the scrape never did:
    //   · 0.15 is MAX'S OWN UAT RETUNE. The prior value "swamped the surface into a heavy orange
    //     BELT on every atmospheric world" (Max-reported, recorded at planet-lod-lab.html:2493-2496).
    //     It is a taste ruling, not a derived quantity, which is exactly why it needs a literal pin.
    //   · The shared law is `columnFraction * TERM_STRENGTH`, so 0.15 is a CEILING. Max's ruling
    //     cannot be violated upward by the ramp; it can only resolve lower on thin columns.
    expect(TERM_STRENGTH, "0.15 is Max's UAT retune — changing it needs a new ruling, not a refactor")
      .toBe(0.15);
    expect(LAB, 'the lab must READ the shared law, not re-fork it')
      .toMatch(/state\.termStrength = terminatorOpticsOf\(/);
    expect(LAB, 'the lab must not carry a second literal copy of the magnitude')
      .not.toMatch(/state\.termStrength = [^;]*\?\s*[0-9.]+\s*:/);

    // columnFraction saturates to exactly 1.0 above 0.3 bar and EVERY generated planet is above
    // that, so using it as the magnitude is both 6.7x too strong and identical on every body.
    // It is legitimate only as the airless gate, i.e. multiplied BY the magnitude.
    expect(TERMMOD).toMatch(/termStrength:\s*\(optics\.columnFraction \?\? 0\) \* TERM_STRENGTH,/);
  });

  it('width is the lab’s log-pressure ramp, agreeing to max delta exactly 0 over a sweep', () => {
    // Extract BOTH expressions from source and evaluate them against each other. "Max delta
    // exactly 0" is this program's definition of done for a ported law.
    const labExpr = LAB.match(/state\.termWidth = ([^;]+);/);
    expect(labExpr, 'the lab must still carry state.termWidth').toBeTruthy();

    // The lab names its already-floored pressure _tp; the shared module floors inside the function.
    const labFn = new Function('_tp', `return ${labExpr[1]};`);

    let maxDelta = 0;
    // Airless through Venus-class and beyond, log-spaced.
    for (const p of [0, 1e-6, 1e-3, 0.006, 0.01, 0.1, 0.31, 1.0, 1.5, 10, 92, 1000]) {
      const floored = Math.max(p, 1e-3);
      maxDelta = Math.max(maxDelta, Math.abs(labFn(floored) - termWidthFor(p)));
    }
    expect(maxDelta).toBe(0);
  });

  it('the provisional 0.18 constant is retired', () => {
    expect(PLANET).not.toMatch(/const TERM_WIDTH = /);
    expect(TERMMOD).not.toMatch(/const TERM_WIDTH = /);
  });

  it('width actually VARIES with pressure, so it is not silently degenerate', () => {
    // The lesson from columnFraction: a law can be wired correctly and still be a constant across
    // the whole population. Pin the spread so that failure is loud.
    const w = termWidthFor;
    const vals = [0.006, 0.31, 1.0, 1.5, 92].map(w);
    expect(new Set(vals).size).toBeGreaterThanOrEqual(4);
    expect(w(0.006)).toBeLessThan(w(1.0));   // Mars-thin reads as a hairline
    expect(w(1.0)).toBeCloseTo(0.12, 12);    // 1 bar is the law's anchor point
    // Venus at 92 bar lands just UNDER the ceiling (0.2967) — the 0.30 clamp does not bind until
    // ~101 bar, so it is the kbar gas-giant column that actually saturates, not Venus.
    expect(w(92)).toBeCloseTo(0.2967, 4);
    expect(w(92)).toBeLessThan(0.30);
    expect(w(1000)).toBe(0.30);              // gas-giant column clamps at the ceiling
    expect(w(0)).toBe(0.06);                 // airless clamps to the floor, inert behind strength 0
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B3-1 · ROUTE (iii) — THE LAW HAS EXACTLY ONE EXPRESSION AND BOTH FRONT-ENDS READ IT
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS BLOCK EXISTS AND WHAT IT IS FOR. The two assertions above prove the law is CORRECT.
// They said nothing about WHERE it lives, and that was the whole of ledger row P-11: the law was
// right and it was module-private inside src/objects/Planet.js, so nothing under src/worldengine/
// could reach it, so no driver pack could forward the band to a swapped body. The row's stated
// closure is "extract the law into a condition-shaped module both sides import". This block is the
// fence on THAT, and it is written so that re-authoring the law back into either front-end reds it.
//
// ⛔ THE CONTROL FOR THIS BLOCK IS RECORDED IN THE STAGE REPORT, NOT IMPLIED. Each of these
// assertions was reverted individually and re-run to confirm the SPECIFIC assertion reds, because
// two dead controls shipped in this lane already.
describe('B3-1 · the terminator law has ONE expression, and both front-ends import it', () => {
  it('src/objects/Planet.js imports terminatorOpticsOf and no longer DEFINES the law', () => {
    expect(PLANET, 'the game must import the shared module')
      .toMatch(/import \{ terminatorOpticsOf \} from '\.\.\/worldengine\/base\/terminatorOptics\.js'/);
    // The two definitions must be GONE from the game file. A re-authored copy here is the exact
    // drift the extraction exists against, and it would satisfy every assertion above.
    expect(PLANET, 'TERM_STRENGTH must NOT be re-defined in the game material')
      .not.toMatch(/^const TERM_STRENGTH = /m);
    expect(PLANET, 'termWidthFor must NOT be re-defined in the game material')
      .not.toMatch(/^function termWidthFor\(/m);
  });

  it('the game material writes uTermStrength/uTermWidth from the module return, not from a local', () => {
    expect(PLANET).toMatch(/const term = terminatorOpticsOf\(condition\);/);
    expect(PLANET).toMatch(/uTermStrength: \{ value: term\.termStrength \},/);
    expect(PLANET).toMatch(/uTermWidth: \{ value: term\.termWidth \},/);
  });

  it('tools/port-condition-delta.mjs no longer carries a THIRD copy of the law', () => {
    // It transcribed both, on the recorded grounds that they were unexported. They are exported now,
    // so the transcription is a copy with no excuse; the instrument must call the module instead.
    const TOOL = readFileSync(join(ROOT, 'tools/port-condition-delta.mjs'), 'utf8');
    expect(TOOL, 'the tool must not re-declare TERM_STRENGTH').not.toMatch(/^const TERM_STRENGTH = /m);
    expect(TOOL, 'the tool must not re-declare termWidthFor').not.toMatch(/^function termWidthFor\(/m);
    expect(TOOL, 'the tool must load the shared module')
      .toMatch(/terminatorOpticsOf.*terminatorOptics\.js/s);
  });

  it('terminatorOpticsOf reproduces the game expression EXACTLY, evaluated not read', () => {
    // The textual assertions above can all pass while the composite returns something else. This
    // one runs both sides over a pressure sweep crossing every branch of the optics law.
    const conds = [];
    for (const pressure of [0, 1e-4, 0.003, 0.05, 0.3, 1.0, 1.6, 12, 92, 1000]) {
      for (const composition of ['n2-o2', 'co2', 'co2-n2', 'h2-he', 'methane']) {
        for (const T_eq of [90, 150, 260, 420, 900]) {
          conds.push({ T_eq, atmosphere: { pressure, composition, retained: pressure > 0 },
                       composition: { volatileFraction: 0.2, ironFraction: 0.3 }, radiusEarth: 1 });
        }
      }
    }
    conds.push({ atmosphere: null, composition: {}, radiusEarth: 1, T_eq: 250 });   // airless
    let maxS = 0, maxW = 0;
    for (const c of conds) {
      const o = atmosphereOpticsOf(c);
      const t = terminatorOpticsOf(c);
      maxS = Math.max(maxS, Math.abs(t.termStrength - (o.columnFraction ?? 0) * TERM_STRENGTH));
      maxW = Math.max(maxW, Math.abs(t.termWidth - termWidthFor(c.atmosphere?.pressure)));
      // The HUE is atmosphereOptics.js's and is forwarded, not re-derived.
      expect(t.termColor).toEqual(o.termColor);
    }
    expect(conds.length).toBeGreaterThan(200);
    expect(maxS).toBe(0);
    expect(maxW).toBe(0);
  });

  it('the airless gate is intact: no atmosphere ⇒ strength exactly 0, width at the floor', () => {
    // ⚠ WHAT THIS DOES AND DOES NOT FENCE, STATED because the first draft of it was a DEAD CONTROL.
    // Deleting the `?? 0` from `(optics.columnFraction ?? 0)` does NOT red this test, and that is
    // not a gap in the test — it is a measured fact about the module: `atmosphereOpticsOf` returns
    // `columnFraction: 0` (a number, never undefined) for `{atmosphere:null}`, for `{}` and for
    // `undefined` alike, so the coalesce is unreachable belt-and-braces rather than a live gate.
    // Verified by running all three through `atmosphereOpticsOf` in this session. What this test
    // DOES fence is the optional chaining on the pressure read — `condition?.atmosphere?.pressure`
    // — which is live: removing either `?` makes the last two assertions throw.
    const airless = terminatorOpticsOf({ atmosphere: null, composition: {}, T_eq: 200, radiusEarth: 1 });
    expect(airless.termStrength).toBe(0);
    expect(airless.termWidth).toBe(0.06);
    expect(Number.isFinite(airless.termWidth)).toBe(true);
    // …and a condition that is entirely absent must not throw or produce NaN either.
    const empty = terminatorOpticsOf(undefined);
    expect(Number.isFinite(empty.termStrength)).toBe(true);
    expect(Number.isFinite(empty.termWidth)).toBe(true);
  });
});
