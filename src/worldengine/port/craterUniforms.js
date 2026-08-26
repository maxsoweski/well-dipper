// src/worldengine/port/craterUniforms.js — the game-side crater law. Rung 4, first landform.
//
// Turns one condition vector into the uCrater*/uEjecta* uniform values that
// src/worldengine/shaders/craterRelief.glsl.js consumes. PURE, THREE-FREE, no rng, no game imports —
// so it can be called display-side, per body, at material-build time, and cannot perturb
// PlanetGenerator's shared rng stream.
//
// ⭐ THE LAW IS THE LAB'S, WITH ONE FLOOR SWAPPED. The lab's route-time derivation
// (world-engine-lab.html, the inc3b S3-fix block; pinned by tests/worldengine-inc3b-synth-law.test.js)
// renders only the SUB-FLOOR band of the size-frequency distribution — the craters too small for its
// display MESH to stamp as real geometry — because the lab's big craters are a per-planet bake.
//
// The game has no stamp pass and no bake. It therefore has nothing to avoid double-rendering, and
// inheriting the lab's floor hands it the one part of the distribution it cannot see: measured over
// Sol's bodies, the sub-floor band's mean crater is 0.8 px across on a planet drawn 400 px wide.
// So the game clips at the floor that actually binds on it — its RASTER floor — and renders
// [CRATER_VIS_FLOOR_RAD * R_km, H] instead. Same law, same closed forms, different floor.
// Full measurement: docs/FEATURES/surface-variation-beyond-mvp.md, "RUNG 4, CRATERS".
import {
  craterSchedule, transitionDiameterKm,
  B_SFD, D_D_SIMPLE,
} from '../base/bombardment.js';
import { radPerKm } from '../base/baseStep.js';

// ── Shader facts. These are not tunables; they are properties of craterRelief.glsl.js. ───────────
// craterCombiner hashes each crater's radius as mix(0.18, 0.55) cell units.
const R_LO = 0.18, R_HI = 0.55;
// Mean per-cell covered area IF each hosted cell painted a flat disc of its hashed radius:
// craterRadius = 0.18 + 0.37u, u ~ U[0,1); area = pi*craterRadius^2;
// E[craterRadius^2] = int_0^1 (0.18 + 0.37u)^2 du = 0.18^2 + 0.18*0.37 + 0.37^2/3.
// ⚠ THIS IS THE LAB'S NUMBER AND IT IS NOT WHAT THE SHADER DRAWS. Kept because it is the quantity
// the lab's law is written in, and because the gap between it and the measured value below is the
// whole finding. Do not use it to derive a density.
export const CELL_CRATER_AREA = Math.PI * (R_LO * R_LO + R_LO * (R_HI - R_LO) + (R_HI - R_LO) ** 2 / 3);

// ⭐ What a fully-hosted crater field ACTUALLY covers, measured in-shader.
// voronoi3d partitions a 3D LATTICE, not the surface. Two things follow, and neither is in the
// analytic disc area above: a crater is a BALL of radius craterRadius about a jittered centre that
// generally does not sit on the sphere, so the surface sees a cap of radius sqrt(R^2 - z^2), not a
// disc of radius R — and that cap is then clipped to its own voronoi region, which for the top of
// the hash range is smaller than the ball. Both shrink the painted area; neither is easy to write
// down closed-form once they interact.
//
// MEASURED at uCraterDensity = 1 (every cell hosts, ~600 craters per visible hemisphere, so this is
// not the low-density sampling noise that makes coverage/density wander between 0.08 and 0.16):
//   Moon 0.1495 | Mercury 0.1593 | Callisto 0.1615 | Europa 0.1931 | Ganymede 0.1898
//   mean 0.1706, sd 0.0175 (10.3% spread — one constant fits the population about as well as
//   RELIEF_GAIN's did), against the analytic 0.4544. The analytic form over-counts by 2.66x.
// Offscreen probe, 512^2, ROCKY variant, uCraterScale 7.0711 (identical on every body whose
// visibility floor binds, which WAS all of them). ⛔ THAT PARENTHESIS IS STALE AS OF 2026-08-20 (B2 leg 1): the floor is now 9.6e-4, so a floor-bound body reads uCraterScale 32.275, and MEASURED over lab-procedural-0…199 only 440 of the 761 cratered bodies are floor-bound at all — the other 321 read the schedule's own low edge and carry 322 distinct scales between them. The 0.1706 measurement itself was NOT re-taken at the new scale and that is a known gap: it is a per-CELL fraction, which is scale-free to first order, but nobody has measured it at 32.275.
//
// ⚠ CONSEQUENCE WORTH NAMING: 0.1706 is also the CEILING. One crater per cell means the game cannot
// paint more than ~17% crater coverage however bombarded a world is, so a truly saturated surface
// renders under-cratered. That is the same single-octave limitation recorded in the register, seen
// from the amplitude side instead of the size side.
export const RENDERED_CELL_COVERAGE = 0.1706;
// craterProfile's internal cavity depth factor: `h += 0.2 * (r*r - 1.0)`.
export const CRATER_DEPTH = 0.2;
// craterProfile's rim term is `0.05 * gaussian`, peaking at r = 1. The ejecta apron is normalised to
// 1.0 at r = 1, so scaling it by this fraction of the crater amplitude makes the blanket CONTINUOUS
// with the rim crest it leaves and thin outward from there. Derived from the two profiles rather
// than tuned — the lab's own uEjectaAmp is a GUI slider whose default sits ~800x above continuity.
export const EJECTA_RIM_FRACTION = 0.05;

// ── The two constants this port owns. ⭐ BOTH RE-DERIVED 2026-08-20 (B2 leg 1) FROM STATED RULES. ────────
// ⭐ FLOOR RULE — re-close it by changing the "4" and re-running the arithmetic. THE SMALLEST CRATER THE
// SHADER DRAWS (2*R_LO = 0.36 CELL units; one cell == D_char, so its angular diameter is 0.36*sqrt(f*C_BASIN)
// rad with C_BASIN 1.0) MUST SPAN >= 4 RENDER px AT THE CLOSEST MEASURED APPROACH FRAMING. Why 4: 2x Nyquist,
// because a crater has to show bowl AND rim to read as one, not merely be detected. CONVENTION: read at the
// DISC CENTRE, face-on, small-angle — where a crater is largest, so the rule bounds the BEST case on the disc.
export const CRATER_VIS_FLOOR_RAD = 9.6e-4;   // ARITHMETIC: camera 1.2 body radii, 1600x999 dpr1 ⇒ disc RADIUS 1078.23 SCREEN px ÷ pixelScale 3 (src/rendering/RetroRenderer.js:811 `const renderWidth = Math.ceil(width / this.pixelScale);`, src/ui/Settings.js:12 pixelScale 3) = 359.41 RENDER px; 0.36*sqrt(f)*359.41 >= 4 ⇒ f >= 9.557e-4. ⚠ THE SHIPPED 0.02 WAS NOT THIS RULE — it measured D_char (the band's geometric mean, sqrt(f) rad), not the smallest DRAWN crater, and that is the whole of the sqrt in its "px = K*sqrt(floor)": 20.6/32.6 = 0.6325 = sqrt(0.02/0.05) to 4 dp. Its residual K = 0.36425*disc_px against centre-of-disc geometry's 0.5*disc_px is NOT reproducible from any convention written in source, so it is recorded and not adopted. Derivation, the corpus table and the named COST at distance: docs/FEATURES/crater-floors-calibration-2026-08-20.md.

// ⭐ RETIRED `CRATER_MIN_DENSITY = 1e-3` INTO THE QUANTITY IT WAS ALWAYS TRYING TO EXPRESS. That constant's
// own comment refused bodies showing "less than one crater on the whole visible disc" — which a fixed
// DENSITY cannot state, because craters are counted in CELLS and the visible cell count is 2*PI*scale^2, a
// number this file's own floor moves. MEASURED at the shipped pair: scale 7.0711 ⇒ 314 visible cells, so
// 1e-3 admitted 0.3 craters and 119 of 485 cratered bodies rendered UNDER ONE CRATER. Any fixed replacement
// goes stale the moment the floor moves — which is exactly what the line above just did — so the gate is
export const CRATER_MIN_VISIBLE = 1.0;   // per-body: `density * visibleCells >= this`, in which 1.0 literally reads "at least one crater is visible on the disc". ⚠ It is still a COST floor and not a physics one, and the old comment's example survives the change: Sol's Earth really does keep a handful of impact craters, below one visible crater's worth. MEASURED after: 0 of 761 cratered bodies render under one crater, over lab-procedural-0…199's 1160 non-gas bodies.

// Lab defaults, carried across unchanged (both are lab-tunable knobs, not derived quantities).
const TERRACE_COUNT = 4.0;
const EJECTA_LUMP = 0.6;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export const CRATERS_OFF = Object.freeze({
  density: 0, scale: 1, amp: 0, complexD: 1, relaxation: 0, terraceCount: TERRACE_COUNT,
  ejectaStrength: 0, ejectaRampart: 0, ejectaAmp: 0, ejectaLump: EJECTA_LUMP,
  // ⛔ `Dchar: 0` MEANS "there is no characteristic diameter", NOT "the diameter is zero". A body
  // reaching here has no resolvable crater band at all, so a consumer must NOT resolve a display
  // frequency from it — `featureFrequencyFromKm` would divide by it. The paired `scale: 1` above is
  // the value that ships today for this case and stays the answer; see the guard in
  // src/worldengine/drivers/rockySurface.js, which forwards `scale` verbatim when `Dchar` is 0.
  Dchar: 0,
});

// Areal coverage of the craters in [lo, hi] ⊆ [L, H]. BOUNDED Pareto, exponent B_SFD, normalised so
// the full band returns the schedule's whole population — coverage = N·E[D²]·radPerKm²/16, the same
// closed form craterSchedule uses for its own `coverage` field.
//
// ⚠ The normalisation is not decoration. Written with the UNBOUNDED tail (count = nAnalytic·(L/lo)^B,
// which is what the schedule uses for P_STAMP), the full band comes back short by exactly (L/H)^B and
// this stops reproducing `coverage`. That term is ~2.5e-8, so the error is invisible in any rendered
// frame and would have sat here forever; the test that caught it compares to 12 decimals on purpose.
export function coverageBand(sch, rpk, lo, hi) {
  if (!sch.fired || !(hi > lo) || !(lo > 0)) return 0;
  const L = sch.D_LO_KM * sch.sizeMul;
  const H = sch.D_HI_KM;
  const tail = (x) => Math.pow(L / x, B_SFD);          // N(>x) / nAnalytic, unnormalised
  const whole = tail(L) - tail(H);
  if (!(whole > 0)) return 0;
  const count = sch.nAnalytic * Math.max(0, tail(lo) - tail(hi)) / whole;
  const ED2 = 2 * lo * lo * Math.log(hi / lo) / (1 - Math.pow(lo / hi, 2));
  return count * rpk * rpk * ED2 / 16;
}

/**
 * craterUniformsFrom(condition) — the whole per-body crater derivation.
 *
 * TOTAL: never throws, returns CRATERS_OFF for any body whose schedule does not fire (molten, deep
 * envelope) or whose resolvable band is empty or uncovered. `density` is the single gate — the
 * shader early-outs at density <= 0, so an un-cratered body pays nothing and renders byte-identically
 * to a build without this feature.
 */
export function craterUniformsFrom(condition) {
  const sch = craterSchedule(condition);
  if (!sch.fired) return CRATERS_OFF;

  const RE = Math.max(1e-6, condition?.radiusEarth ?? 1.0);
  const R_km = RE * 6371;
  const rpk = radPerKm(RE);
  const L = sch.D_LO_KM * sch.sizeMul;
  const H = sch.D_HI_KM;

  // The band the raster can resolve. A body small enough that even its basins fall under the floor
  // gets no craters — correctly, since it could not show them.
  const lo = Math.max(L, CRATER_VIS_FLOOR_RAD * R_km);
  if (!(H > lo)) return CRATERS_OFF;

  const Dchar = Math.sqrt(lo * H);
  const density = clamp01(coverageBand(sch, rpk, lo, H) / RENDERED_CELL_COVERAGE);
  const visibleCells = 2 * Math.PI * (R_km / Dchar) ** 2;   // == 2*PI*uCraterScale^2 — the camera-facing half
  if (!(density * visibleCells >= CRATER_MIN_VISIBLE)) return CRATERS_OFF;   // ⭐ per-body, not a fixed density
  // uCraterAmp: radPerKm(RE)*D_char is the characteristic crater diameter as a fraction of the
  // planet radius. craterProfile applies its own CRATER_DEPTH shape factor internally, so dividing
  // it out here makes the COMPOSED on-screen depth honour Pike's d/D = D_D_SIMPLE exactly once.
  // Both constants are 0.20 today, so amp == the angular diameter — and therefore
  // amp * scale == 1 EXACTLY, which is why the crater slope is body-independent.
  const amp = (D_D_SIMPLE / CRATER_DEPTH) * rpk * Dchar;

  // uCraterComplexD, in CELL units (one cell == D_char km). ⛔ NOT the lab's value: the lab pins
  // this high to force morphology == 0, because every crater it draws is a sub-floor simple bowl.
  // The game's craters are ~0.1 R across — complex craters — and their central peaks and wall
  // terraces are most of what makes a big crater read as a crater rather than a dent. ⛔ THE "~0.1 R" ON THE LINE ABOVE IS SUPERSEDED, 2026-08-20 (B2 leg 1) — it was sqrt(0.02); the re-derived floor makes D_char sqrt(9.6e-4) = 0.031 R on a floor-bound body, so the drawn crater is 4.6x smaller and complexD 4.6x larger. The CLAIM the line makes about morphology survives on the population and the sentence's number does not: MEASURED over lab-procedural-0…199, all-complex bodies went 241 of 485 (49.7%) to 386 of 761 (50.7%) and all-simple 182 of 485 (37.5%) to 210 of 761 (27.6%).
  const g = Math.max(1e-6, condition?.surfaceGravity ?? 0.5);
  const complexD = transitionDiameterKm(g) / Dchar;

  // uCraterRelaxation: the fraction of the surface age LOST to resurfacing/erosion degrades the
  // surviving craters into palimpsests. Airless dead worlds retain the whole age (tExp == ageEff,
  // so 0, sharp); eroded or tidally worked worlds truncate it.
  const ageEff = Math.min(4.6, Math.max(0, condition?.age ?? 4.0));
  const relaxation = (sch.tExp > 0 && ageEff > 0) ? clamp01(1 - sch.tExp / ageEff) : 0;

  // Ejecta wraps the SAME craters, so it needs no placement law of its own — only a presence gate
  // and a morphology. ⚠ The lab drives uEjectaStrength from craterDensity, which makes each apron
  // fainter on a less-cratered world; an individual crater's apron does not know how many neighbours
  // it has. Here strength is the on/off gate (and the negative control) and nothing else.
  const vf = condition?.composition?.volatileFraction ?? 0.15;
  return {
    density,
    // ⭐ `Dchar` IS EXPOSED, and `scale` IS KEPT — deliberately both, not one replacing the other.
    // `scale` is an ALREADY-RESOLVED display frequency (R_km / Dchar). A driver pack that emitted it
    // as a plain number would route around the display-policy seam entirely, and PLAN.md:419's whole
    // reason for the rocky pack going second is that it is the first pack with a km-keyed frequency
    // and therefore the first real test of that seam. So the pack takes `Dchar` — the physical
    // diameter, in km, policy-free — and lets `featureFrequencyFromKm` resolve it. Under the GAME
    // policy (`gameDisplayRadiusEarth(R) === R`) the two are byte-identical; under the LAB's they are
    // not, and that difference is the thing the seam exists to make visible instead of silent.
    // `scale` stays because Planet.js's legacy material still reads it.
    Dchar,
    scale: R_km / Dchar,
    amp,
    complexD,
    relaxation,
    terraceCount: TERRACE_COUNT,
    ejectaStrength: 1,
    // 0 = dry smooth skirt, 1 = fluidized lobate rampart: ground ice fluidizes ejecta (Mars).
    ejectaRampart: smoothstep(0.15, 0.4, vf),
    ejectaAmp: EJECTA_RIM_FRACTION * amp,
    ejectaLump: EJECTA_LUMP,
  };
}
