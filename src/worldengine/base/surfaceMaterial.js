// src/worldengine/base/surfaceMaterial.js — World Engine V2-6 condition-derived surface-material scalars.
//
// PURE, THREE-FREE, CONDITION-SCALARS-ONLY, IMPORTS NOTHING (Lens L2/L3: importing nothing keeps the module a
// leaf — bombardment.js imports FROM here with no transitive smuggling and no ESM cycle; the tiny clamp01/
// smoothstep helpers are inlined rather than pulled from mathutil so the "imports nothing" invariant holds).
// It reads ONLY condition-vector SCALARS (atmosphere.pressure, T_eq, …) and contains NO regime-dispatch
// substrings (incl. comments) — so the shadow-audit's blind-writer scan passes by construction, and it never
// reads a label / archetype / regime / PRESET_ARCHETYPE (AC-0 grep discipline).
//
// PHASED BUILD (BUILD-PLAN §1E/§1F, Lens L8): SLICE 2 created the module with `erosionOf` ONLY (the exposure-age
// erosion term bombardment.js's t_exp needs — footnote 13's erosion scalar); `icenessOf` + `deriveSurfaceMaterial`
// joined in SLICE 3; `crystallizationPotential(cond, schedule)` joins in SLICE 4 (schedule passed as an explicit
// PARAMETER — never an import — so the dependency stays strictly one-way, no ESM cycle).

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ── erosion priors (condition-pure; the waterWindow constants are RESTATED from deriveBodyScalars, cited not
//    imported, so the module stays a leaf). erosion = how fast rain+wind work the surface (footnote 13). ──────
export const P_ER_REF     = 0.5;   // bar — pressure at which wind/rain erosion is fully engaged
export const DRY_ER_FLOOR = 0.1;   // a thin dry-wind erosion floor once an atmosphere exists at all

// erosionOf(cond) — continuous [0,1] surface-erosion rate from condition scalars only.
//   pressure gate  · max(liquid-water window, dry-wind floor)
//   waterWindow = smoothstep(248,273,T)·(1−smoothstep(373,398,T)) — the deriveBodyScalars liquid-water band,
//   restated from cond scalars (NOT imported — keeps this module import-free). Airless (P=0) ⇒ erosion 0 ⇒ the
//   exposure-age erosion term never binds (Moon/Frozen/Crystal expose their full age); atmospheric worlds
//   (Rocky/Ocean/Titan) get a short crater-retention age BY EROSION, not by a binary gate.
export function erosionOf(cond) {
  const P = cond?.atmosphere?.pressure ?? 0;
  const T = cond?.T_eq ?? 288;
  const waterWindow = smoothstep(248, 273, T) * (1 - smoothstep(373, 398, T));
  return clamp01(smoothstep(0, P_ER_REF, P) * Math.max(waterWindow, DRY_ER_FLOOR));
}

// ── iceness priors (BUILD-PLAN §1E; calibration/surface-material.mjs pins them against the 18-preset table so
//    Frozen/Europa/Titan read HIGH, Crystal reads nonzero-LOW ≈0.065 (Lens L7 — its Frozen-pairing driver is
//    crystallizationPotential, S4, not iceness), and Moon/Mercury/Mars read ≈0). A low MEAN density, a volatile
//    budget, and a COLD surface together make an icy material; high-density rock or a warm surface ⇒ 0. ─────────
export const DENS_ICE_HI   = 2.0;   // g/cc — at/below this the mean density reads fully icy
export const DENS_ROCK_LO  = 3.5;   // g/cc — at/above this it reads fully rocky (the density term → 0)
export const VOL_LO        = 0.1;   // volatile-fraction low edge (below ⇒ only the dry-icy floor survives)
export const VOL_HI        = 0.5;   // volatile-fraction high edge (full volatile budget)
export const ICE_VOL_FLOOR = 0.25;  // a dry-but-icy floor — a low-density cold body can be icy without a big volatile budget
export const T_ICE_LO      = 200;   // K — below this the surface is fully frozen
export const T_ICE_HI      = 273;   // K — water ice melts; above this the cold gate → 0

// icenessOf(cond) — continuous [0,1] icy-material fraction from condition scalars only. Consumed by (1) the
// bombardment ice-relaxation gate (ε × iceness, §1D) and (2) the render-side uIcenessMix albedo uniform (§1E).
// Reads composition.density (falling back to the top-level condition-vector `density` field) + volatileFraction
// + T_eq — no label / archetype / dispatch read.
export function icenessOf(cond) {
  const density = cond?.composition?.density ?? cond?.density ?? 5.5;
  const vf = cond?.composition?.volatileFraction ?? 0;
  const T = cond?.T_eq ?? 288;
  const dens = 1 - smoothstep(DENS_ICE_HI, DENS_ROCK_LO, density);   // low density ⇒ icy
  const vol  = Math.max(smoothstep(VOL_LO, VOL_HI, vf), ICE_VOL_FLOOR);
  const cold = 1 - smoothstep(T_ICE_LO, T_ICE_HI, T);
  return clamp01(dens * vol * cold);
}

// ── crystal priors (BUILD-PLAN §1F; SLICE 4). crystallizationPotential = the slow-crystallization endmember
//    signal: an airless crust that no rain erodes, no tides/heat repave, and few impacts churn keeps a pristine
//    growing lattice. Pure fn of condition scalars + the PASSED craterSchedule (explicit parameter — this module
//    imports nothing, so the bombardment dependency stays strictly one-way). N_BOMB_REF pinned by S4's
//    crystal-scalar.mjs decision-artifact table; the ranking conclusion below is N_BOMB_REF-invariant (clamp01
//    preserves order). ────────────────────────────────────────────────────────────────────────────────────────
export const P_AIR_REF   = 0.1;    // bar — above this the surface is no longer airless (crystallization stops)
export const K_RES_TD    = 1.0;    // tidal-resurfacing weight — high-tide worlds (Europa td≈137) repave the crust
export const K_RES_TH    = 1.0;    // thermal/young-crust resurfacing weight — a young crust is still re-forming
export const AGE_RES_REF = 4.5;    // Ga — reference surface age; younger crusts gain a thermal-resurfacing term
export const N_BOMB_REF  = 1.0e7;  // craterSchedule.nAnalytic count that reads as "fully bombarded" (pinned in
                                   // crystal-scalar.mjs; Crystal's 9.47e6 ⇒ intensity≈0.95, Moon's 2.14e6 ⇒ ≈0.21)

// airlessnessOf(cond) — 1 on a bare rock (null/zero atmosphere), → 0 once a real atmosphere exists.
export function airlessnessOf(cond) {
  const P = cond?.atmosphere?.pressure ?? 0;
  return 1 - smoothstep(0, P_AIR_REF, P);
}

// resurfacingRateOf(cond) — [0,1] how fast tides/internal heat repave the crust: a tidal td term (Io/Europa-class
// worlds repave fast) + a young-crust thermal term (a crust younger than AGE_RES_REF is still forming).
export function resurfacingRateOf(cond) {
  const td  = cond?.rawTidalIoRatio ?? 0;
  const age = cond?.age ?? AGE_RES_REF;
  const tidal   = K_RES_TD * (td / (1 + td));
  const thermal = K_RES_TH * clamp01(1 - age / AGE_RES_REF);
  return clamp01(tidal + thermal);
}

// bombardmentIntensityOf(schedule) — [0,1] drawn-impact churn from the PASSED craterSchedule.nAnalytic (§1C) — the
// closed-form drawn-population count. craterSchedule is the explicit parameter (no bombardment import ⇒ no cycle).
// dN/dg = 0 by design (K_GD removed — AC-GCOUNT); radiusEarth is the impact input that moves this term (nAnalytic
// ∝ R²), which is why S4's wiring spy perturbs radiusEarth, not gravity (Lens L10).
export function bombardmentIntensityOf(schedule) {
  const n = schedule?.nAnalytic ?? 0;
  return clamp01(n / N_BOMB_REF);
}

// crystallizationPotential(cond, schedule) — continuous [0,1] slow-crystallization endmember driver. Pure fn of
// condition scalars + the passed craterSchedule; the four factors are each [0,1] so the product stays [0,1]
// (continuity AC). A pristine airless crust (airless · un-eroded · un-resurfaced · little-bombarded) reads high;
// erosion, tides/heat, or heavy impacts each pull it toward 0. A downstream driver like fungal — NOT baked into
// any carrier array, NOT RNG.
//   RECORDED FOR ADJUDICATION (BUILD-PLAN §1F / Lens L9): the presets are condition-scalar DEGENERATE where the
//   old boolean discriminated. The count law N ∝ R²·chronN(age) makes Crystal (R 0.8) the MOST-impacted airless
//   world, so the honest (1−bombardmentIntensity) term drives Crystal's derived potential BELOW Moon/Frozen —
//   inverting the old-boolean ranking (Crystal was the sole boolean-TRUE). Carbon derives ≈max while boolean-false.
//   No condition scalar repairs the split (crystal-scalar.mjs prints the full 18-preset table). S4 ships the scalar
//   + that decision artifact; the extreme-agreement thresholds + the lab facet-wiring flip are
//   deferred-to-adjudication — NOT built around.
export function crystallizationPotential(cond, schedule) {
  const airlessness = airlessnessOf(cond);
  const erosion     = erosionOf(cond);
  const resurf      = resurfacingRateOf(cond);
  const bombard     = bombardmentIntensityOf(schedule);
  return clamp01(airlessness * (1 - erosion) * (1 - resurf) * (1 - bombard));
}

// ── surface-albedo priors (the BASE GROUND COLOUR law) ────────────────────────────────────────────────────────
//    Before this, the render used ONE hard-coded `uBaseColor` rocky tone (0.46,0.40,0.34) for all 18 presets —
//    Mars, the Moon, Venus and a carbon world all stood on the same brown. Every other colour in the pipeline is
//    a tint mixed ON TOP of it (`albedoCol = mix(uBaseColor, liquidCol, liquidMask)`), so the ground itself never
//    varied with what the world is made of. This derives it from condition scalars instead.
//
//    ⚠ DRIVER-SEMANTICS TRAP this law is built around. `composition.ironFraction` is a BULK-BODY iron fraction
//    (Moon/Mercury 0.40, Mars 0.10) — NOT surface mineralogy. It is a sound proxy for how MAFIC (dark) the
//    exposed silicate is: bulk-iron-rich bodies expose dark basaltic/mare crust (lunar Bond albedo ≈0.12) while
//    iron-poorer ones expose lighter feldspathic/dusty crust (Mars ≈0.25). It is NOT a proxy for REDNESS. Mars is
//    red because its iron is OXIDISED (Fe³⁺ hematite/goethite), which needs an oxidiser and time — not because it
//    has more iron. Keying redness on ironFraction inverts both worlds (a red Moon, a grey Mars).
//
//    The discriminator that actually separates Mars from Earth is EROSION, not composition: both have oxidised
//    crust, but Earth's rain and wind continuously bury and re-expose fresh rock, while Mars's near-vacuum lets an
//    oxidised dust mantle accumulate and stay. So the oxidation term rides (1 − erosion).
export const IRON_FELSIC   = 0.08;  // bulk iron fraction at/below which the exposed crust reads fully felsic (light)
export const IRON_MAFIC    = 0.40;  // at/above which it reads fully mafic (dark basalt/mare)
export const OX_VOL_LO     = 0.03;  // volatile fraction below which there was never enough water to oxidise the crust
export const OX_VOL_HI     = 0.12;  // at/above which the oxidiser budget is saturated
export const OX_FE_LO      = 0.02;  // even an iron-poor rocky crust has ample Fe to rust — this saturates fast
export const OX_FE_HI      = 0.10;
export const AGE_OX_REF    = 4.5;   // Ga — exposure time at which oxidation/space-weathering maturity saturates
export const OX_T_LO       = 150;   // K — PALAEO liquid-water gate, low edge. Deliberately colder + wider than
export const OX_T_HI       = 250;   // K — erosionOf's present-climate band: rust records a wet PAST (Mars, 210 K
                                    // today) that Europa (~102 K) and Titan (~94 K) never had.
export const SW_STRENGTH   = 0.65;  // overall space-weathering depth
export const SW_TILT_R     = 0.35;  // per-channel attenuation — blue attenuates most, so weathering darkens AND
export const SW_TILT_G     = 0.50;  // reddens (the nanophase-iron spectral slope), instead of desaturating toward
export const SW_TILT_B     = 0.60;  // a neutral grey.

// Endmember ground colours (LINEAR RGB, pre-posterize), calibrated to observed Bond/geometric albedos.
export const MAFIC_ROCK     = [0.13, 0.12, 0.11];   // basalt / lunar mare — dark neutral
export const FELSIC_ROCK    = [0.42, 0.40, 0.36];   // anorthosite / granitic highland — light warm grey
export const OXIDE_RUST     = [0.55, 0.27, 0.15];   // hematite + goethite dust mantle (Mars)
export const WEATHERED_DARK = [0.16, 0.13, 0.11];   // nanophase-iron space weathering — darkens AND reddens
export const CARBON_CRUST   = [0.05, 0.05, 0.055];  // graphite / carbide crust (C:O > 1) — near-black
export const MELT_GLASS     = [0.14, 0.07, 0.05];   // quenched melt / lava glass on a hot surface
export const T_MELT_LO      = 900;   // K — below this no melt sheen
export const T_MELT_HI      = 1400;  // K — at/above this the surface reads as fresh quenched melt

const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ── sediment priors — transported, comminuted, sorted material. Physically it is BRIGHTER and LESS SATURATED
//    than the in-place weathered rock it derives from: grinding multiplies surface area (more scattering), and
//    fluvial/aeolian sorting concentrates light quartz+feldspar while the dark mafic minerals weather out first.
export const SED_LIGHTEN   = 0.30;  // fraction mixed toward a neutral light fines tone
export const SED_FINES     = [0.52, 0.48, 0.42];  // sorted quartz/feldspar fines — light warm neutral

// surfacePaletteOf(cond) — the three ground endmembers a world's surface is built from, each a linear-RGB triple
// in [0,1]. The BODY's condition picks the palette; the LOCAL geology field (slope, elevation, later province)
// picks where in it each pixel sits. That split is the whole point: it is what lets one world show fresh scarps,
// weathered uplands and pale basin fill without any of the three being painted on by hand.
//
//   fresh     — unaltered bedrock. What a steep slope or a freshly uplifted crest exposes, because mass wasting
//               strips regolith faster than it forms. Skips oxidation and space weathering entirely.
//   weathered — the mature in-place surface: oxidised, space-weathered. The area-dominant background.
//   sediment  — transported and deposited fines. Accumulates on flat low ground.
//
// Chain, in application order: mafic/felsic base → oxidation reddening → space weathering → carbon → melt.
// Carbon and melt apply to ALL THREE endmembers — a carbide crust or a quenched melt sheet is a property of the
// rock itself, not an alteration state, so a "fresh" exposure of it is still black.
// Reads composition scalars, atmosphere pressure, T_eq and age only — no label / archetype / regime read.
// ICE IS DELIBERATELY NOT HERE: `icenessOf` already drives the Stage-6 mix toward uIcenessAlbedo downstream, and
// duplicating it here would double-count the same condition scalars.
export function surfacePaletteOf(cond) {
  const weathered = surfaceAlbedoOf(cond);
  const fresh     = surfaceAlbedoOf(cond, { altered: false });
  // Sediment derives FROM the weathered surface (it is that surface, ground up and moved), so it inherits the
  // world's oxidation state — a rusty world gets pale rusty basins, not generically beige ones. It is lightened
  // INSIDE the chain, before the carbon and melt stages, so those still swamp it: quartz/feldspar sorting has no
  // meaning on a carbide world, and graphite fines stay black however finely they are ground.
  const sediment  = surfaceAlbedoOf(cond, { sediment: true });
  return { fresh, weathered, sediment };
}

// surfaceAlbedoOf(cond, opts) — condition-derived ground colour, linear RGB triple in [0,1]. Defaults to the
// WEATHERED endmember, which is what the single-colour caller wants and preserves the pre-palette behaviour.
// `opts.altered = false` skips the oxidation + space-weathering stages to yield the FRESH bedrock endmember.
export function surfaceAlbedoOf(cond, opts) {
  const altered  = opts?.altered !== false;
  const asFines  = opts?.sediment === true;
  const iron    = cond?.composition?.ironFraction ?? 0.3;
  const vf      = cond?.composition?.volatileFraction ?? 0;
  const co      = cond?.composition?.carbonToOxygen ?? 0;
  const T       = cond?.T_eq ?? 288;
  const age     = cond?.age ?? AGE_OX_REF;

  const maturity   = clamp01(age / AGE_OX_REF);            // exposure time available to weather the crust
  const erosion    = erosionOf(cond);                       // rain+wind rate — buries/re-exposes fresh rock
  const airless    = airlessnessOf(cond);                   // solar wind + micrometeorite exposure gate

  // 1. mafic/felsic base — bulk iron as a DARKNESS proxy (see the trap note above).
  const mafic = smoothstep(IRON_FELSIC, IRON_MAFIC, iron);
  let col = mix3(FELSIC_ROCK, MAFIC_ROCK, mafic);

  // 2. oxidation — rust needs FIVE things, and dropping any one of them mis-colours a real world:
  //      (a) iron in the crust (saturates fast — every rocky crust has ample Fe),
  //      (b) an oxidiser reservoir (volatile budget),
  //      (c) EXPOSED SILICATE, not an ice shell — without this Europa and Titan come out rust-red,
  //      (d) a surface that was EVER warm enough for liquid water. This is a PALAEO window (150–250 K), deliberately
  //          wider and colder than erosionOf's present-climate liquid band: Mars is red because of a wet past it no
  //          longer has, while Europa (~102 K) and Titan (~94 K) never had one,
  //      (e) low erosion to preserve the rust — this is the term that actually separates Mars from Earth. Both have
  //          oxidised crust; Earth's rain and wind continuously bury and re-expose fresh rock, Mars's near-vacuum
  //          lets an oxidised dust mantle accumulate and stay.
  const palaeoWater = smoothstep(OX_T_LO, OX_T_HI, T);
  const oxidation = !altered ? 0 : clamp01(
    smoothstep(OX_FE_LO, OX_FE_HI, iron) *
    smoothstep(OX_VOL_LO, OX_VOL_HI, vf) *
    (1 - icenessOf(cond)) *
    palaeoWater * maturity * (1 - erosion)
  );
  col = mix3(col, OXIDE_RUST, oxidation);

  // 3. space weathering — nanophase iron on an airless, un-eroded, un-repaved crust. Applied as a MULTIPLICATIVE
  //    darkening with a red spectral tilt (blue attenuates most), NOT a mix toward a neutral dark: real space
  //    weathering darkens AND steepens the red slope, whereas mixing toward grey desaturates and washed Mars out.
  const weathering = !altered ? 0 : clamp01(airless * (1 - erosion) * (1 - resurfacingRateOf(cond)) * maturity) * SW_STRENGTH;
  col = [col[0] * (1 - weathering * SW_TILT_R),
         col[1] * (1 - weathering * SW_TILT_G),
         col[2] * (1 - weathering * SW_TILT_B)];

  // 3b. sediment — comminution + sorting. Applied HERE, after alteration but before the carbon/melt rock-property
  //     stages, so those still swamp it (see surfacePaletteOf).
  if (asFines) col = mix3(col, SED_FINES, SED_LIGHTEN);

  // 4. carbon — a C:O > 1 crust is graphite/carbide, and swamps every silicate term above it.
  col = mix3(col, CARBON_CRUST, smoothstep(1.0, 1.3, co));

  // 5. melt — a hot enough surface is quenched glass, not weathered rock.
  col = mix3(col, MELT_GLASS, smoothstep(T_MELT_LO, T_MELT_HI, T));

  return [clamp01(col[0]), clamp01(col[1]), clamp01(col[2])];
}

// deriveSurfaceMaterial(cond, schedule) — the material channel returned on relief.surfaceMaterial (a byte-inert
// return-object field, populated on EVERY dispatch path, drawing no RNG — the relief.figure precedent). SLICE-4
// SHAPE (restated per Lens L8, declared in-plan not a deviation): exactly
// { iceness, crystallizationPotential, regolithRoughness }. `schedule` is the craterSchedule output the
// composition site computes once and passes in (explicit PARAMETER — this module imports nothing, no cycle).
export function deriveSurfaceMaterial(cond, schedule) {
  return {
    iceness: icenessOf(cond),
    crystallizationPotential: crystallizationPotential(cond, schedule),
    regolithRoughness: schedule?.regolithRoughness ?? 0,
  };
}
