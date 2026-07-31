// src/worldengine/port/craterUniforms.js — the game-side crater law. Rung 4, first landform.
//
// Turns one condition vector into the uCrater*/uEjecta* uniform values that
// src/worldengine/shaders/craterRelief.glsl.js consumes. PURE, THREE-FREE, no rng, no game imports —
// so it can be called display-side, per body, at material-build time, and cannot perturb
// PlanetGenerator's shared rng stream.
//
// ⭐ THE LAW IS THE LAB'S, WITH ONE FLOOR SWAPPED. The lab's route-time derivation
// (planet-lod-lab.html, the inc3b S3-fix block; pinned by tests/worldengine-inc3b-synth-law.test.js)
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
// visibility floor binds, which is all of them).
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

// ── The one constant this port owns. ─────────────────────────────────────────────────────────────
// The game's raster floor, in radians of crater diameter — the analogue of the lab's
// MESH_FLOOR_RAD = 0.055. Craters below it cannot be resolved on screen and only alias. MEASURED on
// Sol's 39 bodies as mean crater diameter in pixels on a planet drawn 400 px across:
//   sub-floor (the lab's band) 0.8 px | full SFD 3.5 px | 0.02 rad 20.6 px | 0.05 rad 32.6 px
// 0.02 puts ~50 craters of ~20 px on the visible disc, which is what reads as a cratered world.
export const CRATER_VIS_FLOOR_RAD = 0.02;

// Below this host-cell fraction a body shows LESS THAN ONE crater on the whole visible disc, so the
// pass is pure cost — a voronoi3d per fragment (27 hash33 at uVoroCells = 27) to draw nothing. The
// sphere crosses ~4*pi*scale^2 cells, half of them facing the camera, which at the derived
// scale ~7.07 is ~316 visible cells; 1e-3 of that is 0.3 craters. ⚠ This is a COST floor, not a
// physics one: Sol's Earth derives 1.4e-5 here and that number is right — Earth really does keep a
// handful of impact craters. It is below one pixel's worth of them.
export const CRATER_MIN_DENSITY = 1e-3;

// Lab defaults, carried across unchanged (both are lab-tunable knobs, not derived quantities).
const TERRACE_COUNT = 4.0;
const EJECTA_LUMP = 0.6;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export const CRATERS_OFF = Object.freeze({
  density: 0, scale: 1, amp: 0, complexD: 1, relaxation: 0, terraceCount: TERRACE_COUNT,
  ejectaStrength: 0, ejectaRampart: 0, ejectaAmp: 0, ejectaLump: EJECTA_LUMP,
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
  if (!(density >= CRATER_MIN_DENSITY)) return CRATERS_OFF;

  // uCraterAmp: radPerKm(RE)*D_char is the characteristic crater diameter as a fraction of the
  // planet radius. craterProfile applies its own CRATER_DEPTH shape factor internally, so dividing
  // it out here makes the COMPOSED on-screen depth honour Pike's d/D = D_D_SIMPLE exactly once.
  // Both constants are 0.20 today, so amp == the angular diameter — and therefore
  // amp * scale == 1 EXACTLY, which is why the crater slope is body-independent.
  const amp = (D_D_SIMPLE / CRATER_DEPTH) * rpk * Dchar;

  // uCraterComplexD, in CELL units (one cell == D_char km). ⛔ NOT the lab's value: the lab pins
  // this high to force morphology == 0, because every crater it draws is a sub-floor simple bowl.
  // The game's craters are ~0.1 R across — complex craters — and their central peaks and wall
  // terraces are most of what makes a big crater read as a crater rather than a dent.
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
