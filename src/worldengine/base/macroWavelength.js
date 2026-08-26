// src/worldengine/base/macroWavelength.js
// ─────────────────────────────────────────────────────────────────────────────
// THE BASE FIELD'S CHARACTERISTIC WAVELENGTH, IN KILOMETRES. B2 leg 3, 2026-08-20.
// Ledger rows P-10 (planets) and M-09 (moons).
//
// ⭐ WHAT THIS CLOSES. `uNoiseScale` was the ONE frequency in the engine with no physical size
// behind it: src/worldengine/shaders/uniforms.js:10 `      uNoiseScale: { value: 4.0 },` is the factory default on
// BOTH front-ends and NEITHER wrote it, against a km→frequency law that
// src/worldengine/port/writePackUniforms.js:13 `// 18 lab uniforms resolve as` (the symbol is quoted WITHOUT its backticked interior on purpose — the fence's parser truncates a citation at an escaped backtick, and this ref shipped BROKEN and unscanned until the module joined CITE_SOURCES on 2026-08-21)
// records 18 lab uniforms already resolving through. Max's ruling was to give the base field a
// characteristic wavelength in km, in the engine's established shape, with the wavelength
// CALIBRATED AGAINST REAL BODIES rather than chosen mid-wiring. This module is that wavelength.
//
// ⛔ IT EMITS KILOMETRES AND NEVER A FREQUENCY. The km→frequency step belongs to the pack writer,
// because the two front-ends legitimately differ on the display radius they resolve it at — the
// argument is written out at src/worldengine/port/writePackUniforms.js:11 `IS A REQUIRED PARAMETER AND NOT AN OPTIONAL ONE WITH A DEFAULT` — same escaped-backtick repair as :9.
//
// ⛔ three-free and renderer-free, like every other `base/` module. Closure: this file →
// featureScale.js (imports nothing) + adaptL0.js → mathutil.js (imports nothing), i.e. ZERO bare
// specifiers, so it costs the rockySurface pack's import closure no new npm dependency —
// tests/driver-pack-rockysurface.test.js FAMILY 24 gates that as SET CONTAINMENT against giantDeck.
import { calibrateTidal } from './adaptL0.js';
import { R_EARTH_KM } from './featureScale.js';

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE CALIBRATION, AGAINST REAL BODIES — AND WHY IT IS A RATIO, NOT A CONSTANT IN KM
// ═════════════════════════════════════════════════════════════════════════════
// The dominant macro-relief structure read off eight real bodies under TWO conventions. The ratio
// to body radius — not the absolute size — is what holds still across them:
//
//   body      R (km)   (A) largest single macro structure         λ/R    (B) dominant repeat unit    λ/R
//   Earth      6371    Africa, the largest coherent continental   1.162  an ocean basin, ~5,000 km   0.785
//                      block, long axis ~7,400 km
//   Venus      6051.8  Aphrodite Terra, ~10,000 km                1.652  Ishtar Terra, ~5,600 km     0.925
//   Mars       3389.5  the Tharsis rise, ~5,000 km                1.475  Hellas basin, 2,300 km      0.679
//   Mercury    2439.7  Caloris basin, 1,550 km                    0.635  Rembrandt basin, 715 km     0.293
//   Luna       1737.4  South Pole–Aitken, ~2,500 km               1.439  Imbrium, 1,145 km           0.659
//   Callisto   2410.3  the Valhalla ring system, ~3,800 km        1.577  the Asgard system, ~1,600   0.664
//   Ganymede   2634.1  Galileo Regio, ~3,200 km                   1.215  a sulcus block, ~1,200 km   0.456
//   Io         1821.6  a mountain, mean basal length ~157 km      0.086  a patera, mean Ø ~41 km     0.023
//
// ⚠ THE TWO COLUMNS ARE NOT DECORATION AND THE TABLE IS DISHONEST WITHOUT THEM. Column B is not a
// second measurement of the same quantity; it is the SAME body read under a different answer to
// "which structure is the dominant one?" Luna is the worked case: 1.439 R for South Pole–Aitken and
// 0.659 R for Imbrium — a factor of 2.2 from a convention choice alone. A single-column table would
// read as far more discriminating than this evidence actually is.
//
// ⛔ A CONSTANT IN KILOMETRES IS UNUSABLE HERE, and that is a measurement about the corpus rather
// than a preference. Column A's seven non-Io rows span 0.635–1.652 λ/R, a factor of 2.6, while the
// RADII in `lab-procedural-0…199` span 1823.5x from its smallest moon to its largest giant. MEASURED
// on that corpus, a fixed λ in km leaves between 249 and 615 of the 1517 bodies with under 0.3 macro
// cells across a whole body radius, depending only on which constant you pick — 249 at λ = 2,000 km,
// 499 at Earth's own 7,400 km, 615 at 10,000 km. λ = k·R is the law the reference bodies support.
//
// ⭐⭐ SAY THIS AT THE UAT: THE CALIBRATION IS A RE-CALIBRATION, NOT A DIFFERENTIATOR. Because the
// reference bodies put the macro wavelength at about one body radius all the way from Luna to Venus,
// the radius CANCELS under the game's display policy and the base law is a CONSTANT — 2.8736 against
// today's 4.0. Every per-body difference this module produces comes from §2's process term instead.
//
// ⚠ AND EARTH IS THE WEAKEST ROW IN THE TABLE, WHICH IS EXACTLY THE ROW THE CONSTANT RESTS ON. Plate
// tectonics resurfaces at every scale, so Earth has no single dominant basin the way Luna and Mercury
// do: "the" macro structure on Earth is a judgement call, and its three defensible readings — a
// continental block (7,400 km), an ocean basin (5,000 km), the whole Pacific basin (~15,000 km) —
// span 0.785 to 2.354 λ/R by themselves. The other seven bodies BRACKET that choice (0.635–1.652);
// they do not average into it. Anchoring on Earth is the engine's own established shape —
// `featureFrequencyFromKm` is written in Earth radii against `R_EARTH_KM` and documents its
// `cFeature` as "the desired look at the reference radius" — but the third digit of 1.16 is not real,
// and re-tuning it is a one-constant change in this file.
export const K_MACRO_R = 1.16;

// ⭐ cFeature FOR THE BASE FIELD IS DERIVED, NOT CHOSEN — and it is written as a reciprocal on
// purpose. The base stack's octave 0 is
// src/worldengine/shaders/height.glsl.js:690 `        float h  = snoise(pos * uNoiseScale * 0.3 + uMacroOffset)  * 0.5;`,
// so the octave-0 frequency is `uNoiseScale * 0.3` and "λ km per cycle" means
// `uNoiseScale * 0.3 == R_km / λ_km`. Putting that through `featureFrequencyFromKm` requires exactly
// `cFeature = 1 / 0.3`. The same 0.3 is the multiplier the lab loses at ledger P-15
// (src/worldengine/shaders/heightNoise.glsl.js:115 `        float freq = uNoiseScale * 0.3 * uDispDomainScale;     // matches computeHeight's largest feature scale`),
// which is why it is spelled as that number's reciprocal rather than as 3.3333: a decimal would be a
// second, independently-driftable copy of a constant that already exists in the GLSL.
export const C_MACRO = 1 / 0.3;

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE PROCESS TERM — the only thing in here that differs from body to body
// ═════════════════════════════════════════════════════════════════════════════
// ⭐ IO IS THE SECOND ANCHOR, NOT AN OUTLIER TO DISCARD. Every non-tidal body in the table above sits
// between 0.635 and 1.652 λ/R. Io sits at 0.068 — an order of magnitude finer under EITHER convention
// (the two columns read 0.086 and 0.023 and bracket that figure), and it is the one body in the set
// whose macro relief is built by tidal heating rather than by impacts, tectonics or ice. Two anchors,
// one process axis: no tidal drive → k = K_MACRO_R; Io-grade tidal drive → k = K_MACRO_R_IO.
export const K_MACRO_R_IO = 0.068;

// ⛔ DRIVEN BY THE RAW Io-RATIO, NOT BY THE BOUNDED `tidalHeat`, AND THAT DIFFERENCE IS THE WHOLE
// TERM. A recon of this leg measured the process term against the bounded driver `baseStep` computes
// and found moons get ONE value — because that bundle's tidal input is 0 on 632 of 632 plain moons.
// That is the same dead input B1 fixed one layer up, and the precedence shape is B1's:
// src/worldengine/base/baseStep.js:29 `  const rawTidalIoRatio = (d.tidalHeat != null)   // D12 raw Io-ratio, PRE-calibrateTidal`.
// A CONDITION-shaped object spells the raw quantity `rawTidalIoRatio`
// (src/worldengine/base/conditionVector.js:154 `  rawTidalIoRatio: derived?.tidalHeat ?? bodyRawTidal(fp), // D12 RAW, explicitly named + un-calibrated (m_hp source)`);
// a BASE-STEP-shaped bundle spells the SAME raw quantity `tidalHeat`; this reader takes them in that
// order. MEASURED on `lab-procedural-0…199`: `condition.rawTidalIoRatio` is > 0 on 632 of 632 plain
// moons and carries 632 distinct values, spanning 1.85e-17 to 3.48e+3.
//
// ⭐ THE MAP IS THE ENGINE'S OWN, NOT A NEW ONE. `calibrateTidal` already turns that 20-decade raw
// ratio into a bounded, strictly-monotone dial —
// src/worldengine/base/adaptL0.js:17 `export function calibrateTidal(rawIoRatio) {` — and it is
// Io-anchored by construction, which is what makes an Io-anchored SECOND calibration expressible
// against it at all. `U_IO` is that dial's reading at Io-grade heating.
const U_IO = calibrateTidal(1);

// The shortening factor: 1 at zero tidal drive, exactly `K_MACRO_R_IO / K_MACRO_R` at Io-grade, and
// BOUNDED BELOW BY CONSTRUCTION — `calibrateTidal` never reaches 1, so `u` never exceeds 1 / U_IO
// (5.3777; the 1160 NON-GAS bodies this module reaches top out at u = 5.2507 — the 5.3459 an earlier draft of this line called "the corpus" is the maximum over all 1517 INCLUDING the 357 gas bodies §4 rules out, i.e. a different denominator from every other figure in this file) and the factor never falls below 0.011447.
//
// ⭐ THE HYPERBOLIC FORM IS CHOSEN FOR THAT BOUND, and the two obvious alternatives were rejected on
// measurement rather than taste. The linear form `1 - (1 - K_MACRO_R_IO/K_MACRO_R)·u` goes NEGATIVE
// above u = 1.0623, and this module's corpus — the 1160 non-gas bodies — reaches u = 5.2507 (5.3459 over all 1517 with the gas half included; the rejection holds either way, both being far above 1.0623). The exponential form `exp(-2.8367·u)` reaches
// 2.371e-7 at the top of the dial, i.e. a frequency of 1.212e+7 — a uniform that is not merely wrong
// but unrenderable. This form is monotone, exact at both anchors, and has a ceiling this file states.
//
// ⛔ NO CLAMP AT THE HOT ANCHOR, AND THAT IS A DELIBERATE REFUSAL. Clamping u at 1 would stop the law
// extrapolating past Io — defensible — but MEASURED it would also collapse the 67 hottest plain moons
// in the corpus onto ONE shared value, which is the exact floor-bound pathology B2 leg 1 was spent
// removing (its own delta: 465 of 485 bodies sharing one `uCraterScale`). Above Io this law IS
// extrapolation. It is bounded, it is monotone, and it is declared here rather than hidden.
// ⚠ THERE IS A HARD FLOOR AT THE COLD END AND IT IS ARITHMETIC, NOT DESIGN: `log10(1 + t)` underflows to exactly 0 in float64 below t = 1.1102e-16, so every body colder than that lands on the base WAVELENGTH bit-for-bit rather than merely near it. MEASURED on `lab-procedural-0…199`: 179 of the 1160 non-gas bodies (173 planets, 5 planet-class, 1 moon), and the moon count is the load-bearing half of that — only 1 of the 632. ⚠ BIT-FOR-BIT IS TRUE OF λ AND FALSE OF THE FREQUENCY THE WRITER DERIVES FROM IT: the radius cancels algebraically but not in float64, so MEASURED those 179 bodies present as FOUR distinct written `uNoiseScale` doubles (2.8735632183908044 … 2.8735632183908058), which is why every distinct-value count in §5 names its precision. It is recorded because a reader who assumes strict monotonicity everywhere would write a test this map cannot pass, and because it is the reason the planet half of the population differentiates less than the moon half.
export function macroShortening(rawIoRatio) {
  const u = calibrateTidal(Math.max(0, rawIoRatio || 0)) / U_IO;
  return 1 / (1 + (K_MACRO_R / K_MACRO_R_IO - 1) * u);
}

// The ceiling the shortening factor implies, as the frequency a front-end whose display radius IS the
// physical radius resolves. Exported as a DERIVED value so a test can gate the bound rather than
// trust this comment. MEASURED 251.031, against a corpus maximum of 245.175 over the 1160 non-gas
// bodies this pack claims. ⛔ AN EARLIER DRAFT OF THIS LINE CALLED THE NEW RANGE A SUBSET OF WHAT THE
// LEGACY MATERIAL SPENDS. IT IS NOT ONE — the measured comparison is in §5 and it is not a subset.
export const MACRO_FREQ_CEIL = C_MACRO / (K_MACRO_R * macroShortening(Infinity));

// ═════════════════════════════════════════════════════════════════════════════
// 3. THE READER
// ═════════════════════════════════════════════════════════════════════════════
// λ in kilometres for this body. ⛔ NO FALLBACK ON THE RADIUS, on purpose: a missing radius yields a
// non-finite size and
// src/worldengine/port/writePackUniforms.js:191 `    if (typeof d.featureSizeKm !== 'number' || !Number.isFinite(d.featureSizeKm) || d.featureSizeKm <= 0) {`
// refuses it BY DRIVER NAME. A `?? 1` here would instead render an Earth-sized wavelength on a body of
// unknown size — finite, plausible and invisible, which is the failure mode the pack contract's header
// exists to refuse. The tidal term DOES fall back, to 0, because "this condition carries no tidal
// record" and "this body is not tidally driven" are the same rendering answer.
export function macroWavelengthKm(condition) {
  const c = condition || {};
  const t = c.rawTidalIoRatio ?? c.tidalHeat ?? 0;
  return K_MACRO_R * macroShortening(t) * c.radiusEarth * R_EARTH_KM;
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. ⛔ WHAT THIS MODULE DELIBERATELY DOES NOT REACH — THE GAS RULING
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ `uNoiseScale` IS NOT ADDED TO `giantDeck`, AND THE REFUSAL IS RULED HERE RATHER THAN LEFT TO
// LOOK LIKE AN OVERSIGHT. On a gas body the same uniform is a BAND-WARP frequency, not a terrain
// wavelength: `bandWarpField` and `jetsDisp` reach it through `fbmd`, whose octave 0 is
// src/worldengine/shaders/heightNoise.glsl.js:115 `        float freq = uNoiseScale * 0.3 * uDispDomainScale;     // matches computeHeight's largest feature scale`,
// and a zonal-flow warp has no macro-relief structure to calibrate against — none of the eight
// reference bodies in §1 is a gas giant, and the process term's Io anchor is a solid-body anchor.
// Writing this name into the gas deck would give the SAME SPELLING TWO QUANTITIES, which is ledger
// P-15's exact shape (`uDispDomainScale`, ruled `accepted-loss` because the lab declares the NAME
// and not the QUANTITY). So the 357 gas bodies in `lab-procedural-0…199` keep the factory 4.0, the
// rockySurface predicate (`compositionClass(condition) !== 'gas'`) is what holds the line, and a
// band-warp calibration is a separate question with its own reference set.
//
// ⚠ AND THE BLAST RADIUS ON THE 1160 THIS DOES REACH IS DECLARED RATHER THAN DISCOVERED, because
// this uniform is not confined to the base stack. MEASURED by reading the shader source: nine
// direct reads of `uNoiseScale` (four are the base 4-tap at src/worldengine/shaders/height.glsl.js:690-693;
// three are the INTERNAL octave-0 of `fbmdRidged`, `fbmdHetero` and `fbmdDamped` — F1 mountains,
// plateaus and F17 glacial, whose OUTER scales `uMountainScale`/`uPlateauScale`/`uGlacialScale` are
// already km-keyed, so those three features now carry a km-keyed term at BOTH ends; one is `fbmd`
// itself; one is the game's analytic-normal mirror at src/objects/Planet.js:317 `  float baseFreq = uNoiseScale * 0.3 * uDispDomainScale;   // fbmd's octave-0 frequency`),
// plus sixteen `fbmd(...)` call sites that inherit it — clouds, the F40 dust shred, the F33 district
// fields and the gas band/jet pair among them. Moving this uniform moves all of that.
//
// ⚠ THE ONE THING THAT GETS FINER THAN IT HAS EVER BEEN RENDERED, stated for the UAT: at the top of
// the range the base stack's 2x and 4x octaves (0.3 of its 1.15 total weight) fall below two render
// pixels. B2 leg 1 measured the framing this rests on — the scene renders at 1/3 resolution and a
// disc is 359.4 RENDER pixels in radius at the closest measured approach — so octave 0 still spans
// 4.9 render pixels at the corpus maximum of 245.175 and stays above leg 1's "reads as a feature"
// bar of 4, while the two fine octaves do not. ⛔ NO CEILING IS IMPOSED FOR IT, and the reason is
// §5's measured comparison plus one fact: a ceiling would re-collapse the hot tail onto one shared
// value — MEASURED, clamping u at 1 puts the 67 hottest plain moons back on a single number.

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ⛔ WHAT THIS IS AGAINST WHAT SHIPS — THE TWO SENTENCES A READER MUST NOT GET WRONG
// ═══════════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ (1) NOTHING HERE IS VISIBLE IN A DEFAULT FRAME TODAY, AND THAT IS THE PLAN'S OWN DESIGN.
// src/objects/Planet.js:2158 `export const LAB_GAS_BODIES_DEFAULT = true;` (⛔ B7, 2026-08-21 — THE SENTENCE AROUND THIS CITATION IS SUPERSEDED AND IS KEPT AS THE THING CORRECTED: it was written when this line read = false, and it reasons from a flag that is now ON. What it says about SOL remains true — Sol is excluded by PROVENANCE, not by the flag, at any flag value.) and the admission test at
// src/objects/Planet.js:2199 `    admitted: flag.enabled && provenance.isWorldEngine && packs.length > 0,`
// mean `Planet._createLabSurface` returns null on every body in a default frame. MEASURED over
// `lab-procedural-0…199`: `rockySurface` SELECTS 1160 of 1160 non-gas bodies and 0 of 1160 are
// ADMITTED at the default flag — the flag alone refuses all 1160. So this module writes nothing a
// player sees until the flip. B2, B3 and B4 are all like this by construction; B7 is the plan's only
// player-facing node. This is not a defect and it is not a caveat to bury.
//
// ⭐⭐ (2) POST-FLIP THIS REPLACES A 1160-DISTINCT LEGACY DRAW WITH A LESS DISTINCT DERIVED ONE,
// AND THAT IS THE INTENDED TRADE RATHER THAN A DIFFERENTIATION WIN. What the mounted legacy material
// spends today is NOT one shared value: src/objects/Planet.js:1681 `        uNoiseScale:      { value: d.noiseScale },`
// and src/objects/Moon.js:73 `      noiseScale:      { value: d.noiseScale },` write the generator's own
// `rng.range(2.0, 5.0)`-shaped draw, and MEASURED it is 1160 DISTINCT values over the 1160 non-gas
// bodies at every precision tested (509 planets 1.5055…4.9970 · 632 plain moons 4.8319…510.6324 · 19
// planet-class 2.1662…4.6128). The "one shared 4.0" this module replaces is
// src/worldengine/shaders/uniforms.js:10 `      uNoiseScale: { value: 4.0 },` — the LAB factory
// default, which is a real loss on the lab side and is what ledger rows P-10/M-09 rule on, but it is
// not what renders today. ⛔ THE HONEST LEDGER OF THE SWAP, one precision convention stated on every
// figure, over the 1160 non-gas: LEGACY 1160 distinct at raw float64, at 9 significant figures and at
// float32 alike → DERIVED 985 at raw float64, 844 at 9 sig figs, 780 at float32 (the precision a
// uniform reaches the shader at). FEWER distinct values, deliberately, because Max ruled the value
// must be a PHYSICAL wavelength rather than a random draw. What the swap buys is that the number now
// MEANS something — 0 of 1160 lab values agree with the legacy draw, by construction, because one is
// derived from a size in km and the other is drawn.
//
// ⛔ AND IT IS NOT A SUBSET OF WHAT SHIPS. An earlier draft of this file asserted twice that the new
// range sits inside what the legacy material already spends. MEASURED per population, which is the
// only way the comparison means anything — pooling all three kinds hides it:
//   632 plain moons   NEW [2.8736, 245.175]  LEGACY [4.8319, 510.632]  → 483 of 632 (76.4 %) fall
//                     BELOW the legacy minimum: three quarters of the moons now carry a LONGER macro
//                     wavelength than any moon the game has ever shipped. 0 of 632 exceed the top.
//   509 planets       NEW [2.8736, 56.4358]  LEGACY [1.5055, 4.9970]   → 33 of 509 sit ABOVE the
//                     legacy maximum, up to 11.3× it. 0 fall below.
//   19 planet-class   NEW [2.8736, 69.8999]  LEGACY [2.1662, 4.6128]   → 1 of 19 above, 0 below.
// The pooled reading (0 of 1160 outside [1.5055, 510.632]) is the one that made "subset" look true;
// it is true only because the moons' ceiling covers the planets' and the planets' floor covers the
// moons'. No population is a subset of its own legacy range. ⛔⛔ AND THE `LEGACY` COLUMN ABOVE IS THE RECORD FIELD `d.noiseScale`, NOT THE VALUE THE MOUNTED UNIFORM HOLDS — main.js interposes a measured 5.90–17.52x factor before it reaches a shader. So these three rows establish THAT the ranges differ and do NOT establish BY HOW MUCH, and the per-population percentages must not be quoted as if they did. ⚠ THREE CONSECUTIVE PASSES HAVE NOW MEASURED THIS COMPARISON OFF THE WRONG FIELD, each one "correcting" the last. Re-measure off the mounted uniform before drawing any conclusion from it; do not transcribe these figures.
