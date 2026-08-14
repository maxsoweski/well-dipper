// src/worldengine/base/storm-e.js
// ─────────────────────────────────────────────────────────────────────────────
// STORM-E — DRIVER-ORGANIZED GAS-GIANT VORTEX PLACEMENT + STORM/CONVECTION MASK
// (World-Engine production-L1, atmosphere increment #3b "Storms" — Slice P)
//
// WHAT THIS BUILDS (plain language). The physics PLACEMENT of discrete storm vortices on a gas-giant
// deck, plus the continuous storm/convection MASK field over the sphere — both as DATA. It REPLACES the
// old lab-local mulberry32 hash placement (planet-lod-lab.html F27/F28/F29 derivation closures) with a
// writer that places vortices by the ANTICYCLONIC-SHEAR ARGMAX over the #3a jet profile (the "PV
// staircase" read), band-confined, deterministic tie-break lowest-lat→lowest-node. Every discrete
// vortex carries a place-once seeded AGE scalar (the chromophore substrate #V-α.4 consumes) and a
// place-once seeded PHASE scalar (the oscillator substrate #4 lightning / #5 brown-dwarf / #8 Mars
// consume). It fills the EXISTING uStorm[8]/uPolar carriage; the ONE new baked attribute is the mask.
//
// WHY IT IS A SIBLING OF climate-e5.js (never edits it). #3a (climate-e5.js) owns the signed zonal jet
// field u(lat) and its analytic shear du/dφ. #3b READS those (import resolveParams/jetProfile/jetShear/
// jetShearPeak) to PLACE storms on the jets — it is a pure consumer, mirroring the emission-e.js seam.
// The jet field is the single source of truth for "where the shear is"; storms live on that shear.
//
// STATIC PLACE-ONCE (program discipline, contract designDecision-2): NO uTime anywhere. Age and phase
// ship as place-once scalars so downstream increments can animate WITHOUT #3b animating anything.
//
// GAS GATE DERIVES FROM COMPOSITION (contract designDecision-5): eligibility keys on
// drivers.composition === 'h2-he', NOT on archetype strings. Non-gas ⇒ empty record set (count 0),
// mask all-zero ⇒ the carriage writes uStormCount 0 ⇒ every GLSL storm term no-ops (AC-OFFGATE).
//
// PER-SEED VARIETY IS ROUTED OUT (contract designDecision-3): within #3b, same-regime reseeds SHARE
// storm LATITUDES (the shear argmax is a pure function of the frozen driver inputs) and vary
// longitude / phase / count-mix only. The frozen constants below (STORM_PHYS) each name their future
// deriver = the derive-not-freeze variety increment (AC-0 driver connectivity).
//
// DETERMINISM HARD-RULE: no Math.random / Date.now anywhere. Every random draw is alea seeded off the
// integer (macroSeed, stormSeed) identity in SIX DISJOINT sub-namespaces — the FOUR placement streams
// `stormE:place`, `stormE:age`, `stormE:phase`, `stormE:polar` (fixed draw order), plus the two
// APPEND-ONLY per-storm scalar streams `stormE:emboss`, `stormE:billow` drawn in a post-pass AFTER the
// vortex list is finalized (S2 substrate — the deck/spiral shading scalars). `stormE:polar` is a
// separate stream (mirrors the legacy `_polRng ^ 0x9E3779B9` fork) so the VARIABLE per-seed vortex
// count in `stormE:place` can never move the pole structure (the F5 recoupling the legacy fork avoided).
// The APPEND-ONLY rule keeps the four placement streams' draw order + values frozen ⇒
// GOLDEN_STORM_MASK_HASH + the phase bank + every #4/#5/#8 downstream consumer are byte-identical by
// construction. Same (regime, macroSeed, stormSeed, drivers) ⇒ byte-identical records + mask.
// ─────────────────────────────────────────────────────────────────────────────
import alea from 'alea';
import { clamp, clamp01 } from './mathutil.js';
import {
  E5_REGIME,
  resolveParams, jetProfile, jetShear, jetShearPeak,
} from './climate-e5.js';

// ── Frozen constants (each a DECLARED constant; deriver = the derive-not-freeze variety increment) ──
export const STORM_PHYS = Object.freeze({
  SAMPLES: 721,          // latitude sampling resolution for the shear argmax (matches climate-e5 diagnostics)
  BELT_Y_MAX: 0.75,      // band-confinement pole-avoid |sin lat| ceiling (ports the legacy _trBeltY filter)
  STAIR_GAMMA: 1.6,      // PV-staircase contrast exponent (>1 sharpens the jet-flank maxima into steps)
  MASK_FLOOR: 0.06,      // mask baseline over the deck (keeps corr(mask,|shear|) robust; ~empty-deck read)
  MASK_VORTEX_LIFT: 1.0, // peak mask lift at a placed vortex center (mask maxima at/near vortices — AC-FIELDS a)
  SPOT_R_MIN: 0.18, SPOT_R_SPAN: 0.12,     // GRS-class primary angular radius rad
  SPOT_ROT_MIN: 1.2, SPOT_ROT_SPAN: 1.3,   // primary core swirl magnitude rad (sign = anticyclonic convention)
  SPOT_ASPECT_MIN: 1.6, SPOT_ASPECT_SPAN: 0.4,  // primary E-W ellipse aspect (zonal-shear elongation)
  TRAIN_R_MIN: 0.05, TRAIN_R_SPAN: 0.04,   // train / street member angular radius rad
  TRAIN_MAX: 7,          // max discrete train members (the carriage caps total at 8 incl. primary)
  BARGE_ASPECT: 2.4,     // brown-barge cyclonic elongation (taxonomy 2.7)
  VIGOR_LO: 55, VIGOR_HI: 130,             // T_eq → personality ramp (ports the legacy _ss(55,130,T_eq))
  DARK_VIGOR: 0.35,      // below ⇒ dark (GDS/ice-giant) primary; above ⇒ warm GRS
  LATTICE_VIGOR: 0.70,   // above ⇒ hot churning deck (pearl train + polar lattice)
  POLAR_R0_MIN: 0.18, POLAR_R0_SPAN: 0.08, // polar jet / lattice-ring angular radius rad
  POLAR_N_MIN: 5, POLAR_N_SPAN: 3,         // polar wavenumber N plausible physics range 5..8 (Rider-B GUI-tunable range)
  URANIAN_OBLIQUITY: 80,  // V-β.5: NEPTUNIAN regime + obliquity ≥ this ⇒ the Uranian read (Uranus ≈ 98°). GUI-reachable via the E5 obliquity° slider. (DECLARED; the internal-heat driver that fully separates Uranus from Neptune stays frozen → derive-not-freeze, taxonomy §0.5/5.1.)
});

// ── STORM_DECK — the five-row vertical-column deck table (world-engine-atmo-deck-spiral S2/S3) ──
// The atmosphere is a stack of decks at increasing normalized height z ∈ [0,1]: deep floor (0.0) below
// the belts (0.35) below the zones/mush (0.7); a warm mode-0 anticyclone earns a TOWER (0.9) above the
// zone deck, and the haze / polar hood caps the column (1.0). This is a DECLARED table (no alea —
// guard-safe): its COMPUTATIONAL values are consumed by the lab carriage's per-storm deckZ derivation
// (mode 0 ⇒ mix(ZONE, TOWER, prominence); mode 1 dark spot ⇒ FLOOR — the hole reveals the deep floor)
// and, in GLSL (S3), by the hood-exposure minuend (DECK_HAZE) and the mode-1 deepBase belt-family fill
// (BELT). deckZ is DERIVED (the deck a storm occupies is what the storm IS), not a drawn scalar.
export const STORM_DECK = Object.freeze({ FLOOR: 0.0, BELT: 0.35, ZONE: 0.7, TOWER: 0.9, HAZE: 1.0 });

// V-β.2 → derive-not-freeze Slice P: per-regime canonical polar cyclone-cluster N — now the modal PRIOR
// the seed varies AROUND, not a per-seed PIN (Max re-ruling 2026-07-15 demoted Rider B's pin to a
// regime-conditioned bias). Jupiter's Juno cluster ≈ 8 (8 north), Saturn's polar hexagon = 6. Both
// `sides` (polygon/hexagon N) and `ring` (lattice member M) draw a canonical ± small delta per seed
// (see POLAR_N_DELTA_WEIGHTS / resolvePole), clamped into the plausible 5..8 range (uniforms.js:394/398),
// with MODAL N == this canonical value — so Saturn stays hexagon-LIKELY (not hexagon-pinned) and other
// regimes may morph N/shape/size per seed while the pole still reads correct on average (taxonomy 2.10/3.1).
export const POLAR_CANONICAL_N = Object.freeze({
  [E5_REGIME.GAS_GIANT]:   { sides: 8, ring: 8 },   // Juno Jovian cyclone crystal ≈ 8
  [E5_REGIME.SATURNIAN]:   { sides: 6, ring: 6 },   // Saturn north-polar hexagon
  [E5_REGIME.NEPTUNIAN]:   { sides: 6, ring: 5 },
  [E5_REGIME.SUB_NEPTUNE]: { sides: 6, ring: 5 },
  [E5_REGIME.HOT_JUPITER]: { sides: 6, ring: 6 },
});

// V-β.2 → derive-not-freeze Slice P: per-seed POLAR PRESENCE prior. Replaces the always-on pole (the old
// `strength: stormsOn ? 1 : 0`) with a per-seed coin flip against a regime-conditioned probability, so
// polar vortices "don't always appear" (Max's atmo-3b UAT finding 5). The priors are PINNED named
// constants, FROZEN this increment (AC-0 (1) declared-with-named-deriver debt): the NAMED future deriver
// is a condition-derived presence probability — seasonal/convective forcing (obliquity-phase +
// internalHeat) attenuated by hazeMute — that would replace the flat per-regime prior with a per-body
// probability; until then the asserted constant equals the effective prior this increment. Jupiter's Juno
// cyclone crystal + Saturn's hexagon are the solar system's most persistent polar structures (≈ always
// present); ice-giant / sub-Neptune dark vortices are transient / seasonal (come and go). HOT_JUPITER
// has NO entry: storms are regime-suppressed (stormsOn=false) so the prior is never consulted.
// Grounded in DERIVE-FORMS.md §4 (Adriani et al. 2018 / Fletcher et al. 2018 / Simon et al. 2019).
export const POLAR_PRESENCE_PRIOR = Object.freeze({
  [E5_REGIME.GAS_GIANT]:   0.98,   // Juno polar cyclone cluster — persistent, effectively always structured
  [E5_REGIME.SATURNIAN]:   0.97,   // north-polar hexagon + vortex, stable for decades (Voyager→Cassini)
  [E5_REGIME.NEPTUNIAN]:   0.55,   // Great Dark Spots are transient (form/dissipate every few years)
  [E5_REGIME.SUB_NEPTUNE]: 0.45,   // no polar imaging; haze-muted, presumed leaner/seasonal → below Neptune
});

// V-β.2 → derive-not-freeze Slice P: N-around-prior delta weights. The cluster count N (both `sides` and
// `ring`) is a per-seed pick of the canonical prior + a delta drawn from {−1: .25, 0: .50, +1: .25},
// weighted toward 0 so the MODAL delta is 0 ⇒ MODAL N == the canonical prior. Drawn on the APPENDED
// stormE:polar stream; the result is clamped into POLAR_N_MIN..(POLAR_N_MIN+POLAR_N_SPAN) = 5..8.
// DECLARED-with-named-deriver (AC-0 driver connectivity): this fixed triangular spread is a physics-free
// placeholder; its FUTURE deriver is a polar-vortex STABILITY calculation (the barotropic wavenumber the
// pole actually selects from rotation rate + shell depth + Rossby deformation radius — taxonomy 2.10/3.1),
// which would replace the weights with a condition-derived N distribution. Frozen this increment.
export const POLAR_N_DELTA_WEIGHTS = Object.freeze({ '-1': 0.25, '0': 0.50, '+1': 0.25 });

// Per-regime default equilibrium temperature — used ONLY when the caller passes no drivers.T_eq, so the
// writer's personality ramp still lands on the right regime read (Jovian hot/churning, Neptunian cold/
// bland) in headless tests. Real lab callers pass the preset's T_eq. (DECLARED; deriver = variety inc.)
const DEFAULT_T_EQ = Object.freeze({
  [E5_REGIME.GAS_GIANT]: 124, [E5_REGIME.SATURNIAN]: 95, [E5_REGIME.NEPTUNIAN]: 47,
  [E5_REGIME.SUB_NEPTUNE]: 60, [E5_REGIME.HOT_JUPITER]: 1400,
});

const TWO_PI = Math.PI * 2;
const smooth01 = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ── Chromophore aging ramp (V-α.4) — the phenomenological white→red mapping ─────
// Taxonomy §1.1/§10: a single "possibly universal" red chromophore — a thin aerosol cap
// thickened/reddened by residence time + UV dosing. age 0 = fresh NH₃-ice WHITE →
// age 1 = GRS BRICK-RED, monotone through cream→tan→orange. This is the age→uStormColor[i]
// source the lab carriage feeds (AC-FIELDS b monotonicity, AC-VIS c differentiation).
// It is a phenomenological COLOR mapping, NOT a chemistry claim (taxonomy §10 caveat).
// Mode 1 (ice-giant dark spot) does NOT redden — its "color" is a CLEARED darker hole
// (deep aerosol showing through), a low-albedo neutral branch of the same age axis
// (taxonomy 1.1 REGIME APPLICABILITY / 4.1). Pure + deterministic + headless-testable.
export const CHROMOPHORE_STOPS = Object.freeze([
  { a: 0.00, c: [0.96, 0.95, 0.93] },   // white  — fresh upwelled ammonia ice (no chromophore yet)
  { a: 0.25, c: [0.93, 0.86, 0.68] },   // cream  — Equatorial-Zone
  { a: 0.50, c: [0.88, 0.68, 0.44] },   // tan    — belt
  { a: 0.75, c: [0.82, 0.50, 0.28] },   // orange
  { a: 1.00, c: [0.74, 0.32, 0.18] },   // brick-red — aged GRS (max UV dosing)
]);
export function chromophoreColor(age, mode = 0) {
  const t = clamp01(age);
  if (mode === 1) {
    // cleared dark hole: neutral + darkened, older ⇒ MORE cleared (fainter). Never reddens.
    const k = 0.55 - 0.12 * t;
    return [0.80 * k + 0.02, 0.82 * k + 0.02, 0.86 * k + 0.04];
  }
  const S = CHROMOPHORE_STOPS;
  let i = 0;
  while (i < S.length - 1 && t > S[i + 1].a) i++;
  const lo = S[i], hi = S[Math.min(i + 1, S.length - 1)];
  const f = clamp01((t - lo.a) / ((hi.a - lo.a) || 1));
  return [
    lo.c[0] + (hi.c[0] - lo.c[0]) * f,
    lo.c[1] + (hi.c[1] - lo.c[1]) * f,
    lo.c[2] + (hi.c[2] - lo.c[2]) * f,
  ];
}

// ── Ice-giant dark-spot LIFECYCLE phase (V-β.3) — a place-once STATE, never an arc ───────────────────
// Taxonomy 4.3 / Q6 ratified: a Neptune/Uranus dark spot is one frame of a birth→drift→death arc. We
// paint ONE lifecycle phase as a seeded AGE state (STATIC — the age scalar picks which phase, #3b
// animates nothing). Three phases, keyed on the ALREADY-DRAWN place-once ageScalar (NO new rng draw):
//   precursor   (age <1/3): bright CH₄ companion clouds only, NO dark core yet — coreScale 0.
//   mature      (1/3..2/3): full dark cleared core + offset cap + a small POLEWARD latitude drift.
//   dissipating (age ≥2/3): weak-contrast dark core, drifted toward the EQUATOR (equatorward death).
// coreScale is the dark-core visibility the carriage folds into the spot color (background↔cleared);
// renderLat is the lifecycle-drifted latitude the carriage renders at (the birth latitude — the shear
// argmax — is preserved in the record's `.lat` so the arm's-length re-derivation AC-WRITER d still holds).
// Pure + deterministic + headless-testable.
export function iceGiantLifecyclePhase(age, lat) {
  const t = clamp01(age);
  if (t < 1 / 3) return { phase: 'precursor',   coreScale: 0.0,  renderLat: lat };
  if (t < 2 / 3) return { phase: 'mature',      coreScale: 1.0,  renderLat: lat + 0.06 * Math.sign(lat || 1) };  // poleward drift
  return {         phase: 'dissipating', coreScale: 0.45, renderLat: lat * 0.55 };                               // equatorward death
}

// The (macroSeed, stormSeed) placement identity — the SAME mix the legacy closures used, so a given pair
// still owns ALL storm placement (card §6 item 8), now feeding alea namespaces instead of mulberry32.
function stormIdentity(macroSeed, stormSeed) {
  return (Math.imul(macroSeed | 0, 2654435761) ^ (stormSeed | 0)) >>> 0;
}

// unit direction from (lat, lon). lon 0 = +x, +lat = +y (matches the carrier / lab spot-center convention).
function dirFromLatLon(lat, lon) {
  const c = Math.cos(lat);
  return [c * Math.cos(lon), Math.sin(lat), c * Math.sin(lon)];
}

// ── The PV-staircase-adjusted anticyclonic-shear PLACEMENT FIELD ──────────────
// Potential-vorticity mixing homogenizes PV inside belts and concentrates the gradient at jet cores (the
// "PV staircase"), so vortices preferentially sit on the sharpened jet flanks — the shear maxima. We
// model the placement score as the #3a analytic shear |du/dφ|, normalized by its peak, passed through a
// monotone staircase contrast map x^STAIR_GAMMA (>1) that flattens weak inter-belt shear toward 0 and
// sharpens the dominant flank maxima. This is the field the argmax runs over (AC-WRITER c).
function pvStaircaseScore(lat, P, shearPeak) {
  const s = clamp01(Math.abs(jetShear(lat, P)) / (shearPeak || 1));
  return Math.pow(s, STORM_PHYS.STAIR_GAMMA);
}

// Anticyclonic spin convention: NH anticyclones roll clockwise (negative), SH counter-clockwise
// (positive). (DECLARED sign convention; a per-flank refinement is a derive-not-freeze slot.)
function anticyclonicSign(lat) { return -Math.sign(lat) || 1; }

/**
 * Rank storm-placement candidates. PURE (no RNG). Deterministic tie-break: higher score first; on an
 * (approximate) score tie, LOWER |lat| first, then LOWER sample node index first (the ATMOSPHERE-PLAN
 * "lowest-lat → lowest-node" pin). Exported so the AC-WRITER(c)/(d) tests can re-rank arm's-length.
 */
export function rankStormCandidates(cands) {
  const EPS = 1e-9;
  return cands.slice().sort((a, b) => {
    if (Math.abs(a.score - b.score) > EPS) return b.score - a.score;      // higher score wins
    const la = Math.abs(a.lat), lb = Math.abs(b.lat);
    if (Math.abs(la - lb) > EPS) return la - lb;                           // lowest |lat| wins the tie
    return a.node - b.node;                                                // then lowest node index
  });
}

/**
 * Resolve the band-confined shear-maxima candidate latitudes and their ranking, from the resolved #3a
 * param bundle ALONE (no seed, no RNG). This is the arm's-length re-derivation target (AC-WRITER d): the
 * placed vortex LATITUDES reproduce from the returned params via this independent search.
 * @returns {{ranked: Array<{lat,score,node,y,rotSign}>, shearPeak:number}}
 */
export function resolveStormPlacement(P) {
  const n = STORM_PHYS.SAMPLES;
  const shearPeak = jetShearPeak(P) || 1;
  const lats = new Float64Array(n), score = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const lat = (-0.5 + i / (n - 1)) * Math.PI;                            // −π/2 → π/2
    lats[i] = lat;
    score[i] = pvStaircaseScore(lat, P, shearPeak);
  }
  // interior local maxima of the staircase score, pole-avoid filtered (band-confinement). Left-edge of a
  // plateau is chosen deterministically (>= on the left, > on the right).
  const cands = [];
  for (let i = 1; i < n - 1; i++) {
    if (score[i] >= score[i - 1] && score[i] > score[i + 1]) {
      const lat = lats[i], y = Math.sin(lat);
      if (Math.abs(y) <= STORM_PHYS.BELT_Y_MAX + 1e-9) {
        cands.push({ lat, y, score: score[i], node: i, rotSign: anticyclonicSign(lat) });
      }
    }
  }
  return { ranked: rankStormCandidates(cands), shearPeak };
}

// T_eq → deck personality (0 cold/bland ice-giant … 1 hot/churning Jovian). Ports the legacy _vigor ramp.
function vigorOf(regime, drivers) {
  const teq = drivers?.T_eq ?? DEFAULT_T_EQ[regime] ?? 288;
  return smooth01(STORM_PHYS.VIGOR_LO, STORM_PHYS.VIGOR_HI, teq);
}

function makeVortex(lat, lon, radius, rot, aspect, mode, role, ageScalar, phaseScalar, companion, node, score) {
  return {
    center: dirFromLatLon(lat, lon),
    lat, lon, radius, rot, aspect, mode, role,
    ageScalar, phaseScalar, companion, node, score,
  };
}

/**
 * Resolve the storm/vortex placement records + pole params from (regime, drivers, macroSeed, stormSeed).
 * PURE + deterministic (alea-only, fixed draw order). Gas gate: drivers.composition === 'h2-he'.
 *
 * @returns flat object:
 *   strength   1 on a gas deck, 0 otherwise (the master carriage gate).
 *   count      total discrete vortices (primary + train), 0 when off-gate.
 *   primary    the GRS-class / ice-giant dark-spot record at the strongest anticyclonic-shear argmax
 *              (null when off-gate).
 *   train      the vortex-street / barge / scooter members (Array; [] when off-gate).
 *   vortices   flat [primary, ...train] convenience list (drives the mask + tests).
 *   pole       { strength, mode, sides, r0, ring, pole, phase, ageScalar, phaseScalar } from stormE:polar.
 *   vigor      the deck-personality scalar (diagnostic).
 *   params     the resolved #3a param bundle P (the AC-WRITER d re-derivation source).
 *   placementLats  the ranked candidate latitudes (diagnostic / re-derivation aid).
 */
export function resolveStormE(regime = E5_REGIME.GAS_GIANT, drivers = {}, macroSeed = 0, stormSeed = 0) {
  const P = resolveParams(regime, drivers, macroSeed);
  const gas = drivers?.composition === 'h2-he';
  // V-β.6 (F6, taxonomy §6.6): HOT-JUPITER is a different machine (day–night dipole + one wide equatorial
  // jet). #3b renders it as a banded deck (#3a) + haze ONLY; ALL active storm phenomena DEFER to #4. This
  // is an EXPLICIT regime suppression gate (keyed on the regime, NOT on "low shear" — the one wide jet
  // still carries flank shear V-α.1 would filament). Suppressed ⇒ empty record set + all-zero mask, so the
  // shear×mask-gated filamentation term vanishes regardless of local shear.
  const hotJupiter = regime === E5_REGIME.HOT_JUPITER;
  const stormsOn = gas && !hotJupiter;
  // V-β.5 (Rider A, taxonomy §5): the URANIAN read is the NEPTUNIAN regime + high obliquity (Ward
  // hot-poles inversion) — NOT a new frozen preset. Reachable via the E5 obliquity° driver/GUI. It paints
  // near-empty storm slots + a seasonal polar HOOD (mode-0 cap) here; the lab adds thick haze. The
  // low-internal-heat driver that fully separates Uranus from Neptune stays frozen → derive-not-freeze.
  const uranian = regime === E5_REGIME.NEPTUNIAN && (drivers?.obliquityDeg ?? 0) >= STORM_PHYS.URANIAN_OBLIQUITY;
  const id = stormIdentity(macroSeed, stormSeed);

  // stormE:polar is drawn FIRST from its OWN disjoint stream (F5) — the variable per-seed vortex count in
  // stormE:place below can never move the pole structure.
  const rngPolar = alea('stormE:polar:' + regime + ':' + id);
  const vigor = vigorOf(regime, drivers);
  const pole = resolvePole(regime, stormsOn, vigor, rngPolar);
  if (uranian) pole.mode = 0;   // V-β.5: seasonal polar hood is a single mode-0 cap (taxonomy 5.2)

  if (!stormsOn) {
    return { strength: 0, count: 0, primary: null, train: [], vortices: [], pole, vigor, params: P, placementLats: [], uranian, hotJupiter };
  }

  const { ranked } = resolveStormPlacement(P);
  const rngPlace = alea('stormE:place:' + regime + ':' + id);
  const rngAge = alea('stormE:age:' + regime + ':' + id);
  const rngPhase = alea('stormE:phase:' + regime + ':' + id);

  // Fallback: a degenerate profile with no interior shear maximum still gets one equatorial-flank slot so
  // the deck never renders storm-less on a gas world (guards the argmax against a flat jet field).
  const primaryCand = ranked[0] || { lat: 0.38, node: 0, rotSign: 1, score: 0 };

  const darkPrimary = vigor < STORM_PHYS.DARK_VIGOR;   // cold/ice-giant deck ⇒ dark cleared spot (GDS/2006)
  // ── PRIMARY: GRS-class anticyclone (warm) or ice-giant dark spot (cleared). Placed at the argmax. ──
  const pLon = rngPlace() * TWO_PI;
  const pRadius = STORM_PHYS.SPOT_R_MIN + STORM_PHYS.SPOT_R_SPAN * rngPlace();
  const pRot = (STORM_PHYS.SPOT_ROT_MIN + STORM_PHYS.SPOT_ROT_SPAN * rngPlace()) * primaryCand.rotSign;
  const pAspect = STORM_PHYS.SPOT_ASPECT_MIN + STORM_PHYS.SPOT_ASPECT_SPAN * rngPlace();
  const pAge = rngAge();
  const pPhase = rngPhase() * TWO_PI;
  // V-α.5 DS2 sign-pack (F2): a dark spot's CH₄ companion rides the carriage .w slot with its
  // MAGNITUDE = brightness (0.8) and its SIGN = placement — negative ⇒ the DS2 bright-CORED
  // variant (companion centered ON the cleared core, taxonomy 4.4); positive ⇒ the GDS OFFSET
  // companion (~1.3R east + 0.5R poleward, the Voyager-2 read). The GLSL reads abs(comp) so a
  // negative (centered) flag still BRIGHTENS. The split is taken off the ALREADY-DRAWN place-once
  // age (NO new rng draw) so the stormE:place stream draw-order + the golden mask are undisturbed.
  const pCompanion = darkPrimary ? (pAge < 0.5 ? -0.8 : 0.8) : 0.0;
  const primary = makeVortex(
    primaryCand.lat, pLon, pRadius, pRot, pAspect,
    darkPrimary ? 1 : 0,
    darkPrimary ? 'dark-spot' : 'grs',
    pAge, pPhase,
    pCompanion,
    primaryCand.node, primaryCand.score,
  );
  // V-β.3 ice-giant dark-spot LIFECYCLE: the age scalar picks precursor / mature / dissipating. coreScale
  // (dark-core visibility) rides to the carriage; the lifecycle-drifted latitude re-points the rendered
  // center (and the mask lift, which reads .center), while .lat stays the BIRTH latitude (the shear argmax)
  // so AC-WRITER(d) re-derivation is untouched. Warm GRS primaries carry no lifecycle (coreScale left 1).
  if (darkPrimary) {
    const lc = iceGiantLifecyclePhase(pAge, primaryCand.lat);
    primary.lifecycle = lc.phase;
    primary.coreScale = lc.coreScale;
    primary.center = dirFromLatLon(lc.renderLat, pLon);
    // V-β.5 Uranian: a faint (2006-type) dark spot — low amplitude (taxonomy 5.3).
    if (uranian) { primary.radius *= 0.6; primary.rot *= 0.5; primary.coreScale *= 0.5; }
  }

  // ── TRAIN: vortex street / brown barge / scooters, on the SAME argmax latitude + next-N shear maxima,
  //    evenly-spaced longitudes from the phase bank (taxonomy 2.5/2.7/4.x). Family read from vigor. ──
  const train = [];
  if (vigor >= STORM_PHYS.LATTICE_VIGOR) {
    // STRING OF PEARLS: 4-6 pale same-latitude ovals along the primary belt, even longitudes ± jitter,
    // same-sign swirl (one anticyclonic shear zone spins the whole family the same way).
    const trN = 4 + Math.floor(rngPlace() * 3);
    const lon0 = rngPlace() * TWO_PI;
    for (let i = 0; i < trN; i++) {
      const lon = lon0 + (i + 0.3 * (rngPlace() - 0.5)) * TWO_PI / trN;
      train.push(makeVortex(
        primaryCand.lat, lon,
        STORM_PHYS.TRAIN_R_MIN + STORM_PHYS.TRAIN_R_SPAN * rngPlace(),
        (0.6 + 0.4 * rngPlace()) * primaryCand.rotSign, 1.3 + 0.5 * rngPlace(),
        0, 'pearl', rngAge(), rngPhase() * TWO_PI, 0, primaryCand.node, primaryCand.score,
      ));
    }
  } else if (vigor >= STORM_PHYS.DARK_VIGOR) {
    // BROWN BARGE (cyclonic) + a secondary anticyclone on the next shear maximum: the cyclonic-dark ↔
    // anticyclonic-bright polarity axis (taxonomy 2.7). Barge sits on the primary belt, elongated.
    const bargeLon = rngPlace() * TWO_PI;
    train.push(makeVortex(
      primaryCand.lat, bargeLon,
      STORM_PHYS.TRAIN_R_MIN + STORM_PHYS.TRAIN_R_SPAN * rngPlace(),
      -(0.6 + 0.4 * rngPlace()) * primaryCand.rotSign, STORM_PHYS.BARGE_ASPECT,
      1, 'barge', rngAge(), rngPhase() * TWO_PI, 0, primaryCand.node, primaryCand.score,
    ));
    const second = ranked[1];
    if (second) {
      train.push(makeVortex(
        second.lat, rngPlace() * TWO_PI,
        STORM_PHYS.TRAIN_R_MIN + STORM_PHYS.TRAIN_R_SPAN * rngPlace(),
        (0.6 + 0.4 * rngPlace()) * second.rotSign, 1.4 + 0.4 * rngPlace(),
        0, 'oval', rngAge(), rngPhase() * TWO_PI, 0, second.node, second.score,
      ));
    }
  } else {
    // SCOOTERS: 1-2 small bright companions on their own next-N shear-maxima belts (the ice-giant deck).
    const trN = 1 + (rngPlace() > 0.5 ? 1 : 0);
    for (let i = 0; i < trN && i < ranked.length; i++) {
      const cand = ranked[i] || primaryCand;
      train.push(makeVortex(
        cand.lat, rngPlace() * TWO_PI,
        STORM_PHYS.TRAIN_R_MIN + 0.5 * STORM_PHYS.TRAIN_R_SPAN * rngPlace(),
        (rngPlace() > 0.5 ? 1 : -1) * 0.5, 1.3,
        0, 'scooter', rngAge(), rngPhase() * TWO_PI, 0, cand.node, cand.score,
      ));
    }
  }

  // V-β.5 Uranian: near-empty storm slots — the faint primary stands alone (taxonomy 5.1 "storm mask
  // near-empty"; the low-contrast extreme, boring by design).
  if (uranian) train.length = 0;

  const vortices = [primary, ...train].slice(0, 8);      // carriage caps at 8 slots

  // ── APPEND-ONLY per-storm scalar substrate (S2): post-pass over the FINALIZED vortex list. Two NEW
  //    disjoint alea streams (stormE:emboss / stormE:billow) — they consume ZERO draws from the four
  //    placement streams above, so GOLDEN_STORM_MASK_HASH + the phase bank + every #4/#5/#8 downstream
  //    consumer stay byte-identical by construction (append-only rule; draw order of place/age/phase/
  //    polar frozen). embossDir = place-once mode-0 shading axis (S3 emboss rim / cold-annulus shading
  //    direction, footnote 17); billowPhase = place-once KH scallop azimuth phase (S4 dSpiral scallop,
  //    footnote 19). Both are STATIC place-once scalars (no uTime) — downstream slices animate nothing.
  const rngEmboss = alea('stormE:emboss:' + regime + ':' + id);
  const rngBillow = alea('stormE:billow:' + regime + ':' + id);
  for (const v of vortices) {                            // deterministic creation order
    v.embossDir = rngEmboss() * TWO_PI;
    v.billowPhase = rngBillow() * TWO_PI;
  }

  return {
    strength: 1, count: vortices.length,
    primary, train: vortices.slice(1), vortices,
    pole, vigor, params: P,
    placementLats: ranked.map((c) => c.lat),
    uranian, hotJupiter,
  };
}

// Weighted pick of the N delta {−1: .25, 0: .50, +1: .25} from a uniform u ∈ [0,1). Cumulative bins:
// [0,.25)→−1, [.25,.75)→0, [.75,1)→+1. The modal (widest) bin is 0, so modal N == the canonical prior.
function pickNDelta(u) {
  const wLo = POLAR_N_DELTA_WEIGHTS['-1'];
  if (u < wLo) return -1;
  if (u < wLo + POLAR_N_DELTA_WEIGHTS['0']) return 0;
  return 1;
}

// Pole params from the stormE:polar stream. V-β.2 → derive-not-freeze Slice P (canonical-N demotion +
// per-seed presence gating — Max re-ruling 2026-07-15):
//   • PRESENCE is now gated per seed: a gas deck's pole APPEARS with regime-conditioned probability
//     (POLAR_PRESENCE_PRIOR) — Jovian/Saturnian effectively always, ice-giant/sub-Neptune transient.
//     Non-gas / hot-Jupiter (stormsOn=false) ⇒ absent regardless. Some gas seeds now have NO pole.
//   • N (sides/ring) is drawn AROUND the canonical PRIOR (± a {−1,0,+1} delta weighted toward 0) instead
//     of pinned to it — Saturn stays hexagon-LIKELY (modal 6), others may morph. Clamped into 5..8.
//   • r0, active-pole sign, phase, age still vary per seed off the disjoint stormE:polar stream.
// DRAW-ORDER DISCIPLINE (byte-safety): the five original draws (r0, poleSign, phase, ageScalar,
// phaseScalar) keep their order and values; the presence coin + the two N-deltas are APPENDED after them.
// The golden mask (GOLDEN_STORM_MASK_HASH) reads ONLY stormE:place vortices — never the pole draws — so
// appending here cannot move it; keeping the append order stable also keeps every pole-scalar test green.
function resolvePole(regime, stormsOn, vigor, rng) {
  // ── the original FIVE draws (byte-stable order — do NOT reorder) ──
  const r0 = STORM_PHYS.POLAR_R0_MIN + STORM_PHYS.POLAR_R0_SPAN * rng();
  const poleSign = rng() > 0.5 ? 1 : -1;
  const phase = rng() * TWO_PI;
  const ageScalar = rng();
  const phaseScalar = rng() * TWO_PI;
  // ── APPENDED derive-not-freeze draws (drawn unconditionally so the stream order is branch-invariant) ──
  const presenceRoll = rng();              // draw #6: per-seed presence coin
  const dSides = pickNDelta(rng());        // draw #7: sides N delta
  const dRing = pickNDelta(rng());         // draw #8: ring N delta
  // mode from the personality ramp: hot ⇒ cyclone lattice (2), mid ⇒ polygon/hexagon jet (1), cold ⇒ cap (0).
  const mode = vigor >= STORM_PHYS.LATTICE_VIGOR ? 2 : (vigor >= STORM_PHYS.DARK_VIGOR ? 1 : 0);
  const canon = POLAR_CANONICAL_N[regime] || { sides: 6, ring: 6 };
  const lo = STORM_PHYS.POLAR_N_MIN, hi = STORM_PHYS.POLAR_N_MIN + STORM_PHYS.POLAR_N_SPAN;   // 5..8
  const sides = clamp(lo, hi, canon.sides + dSides);
  const ring = clamp(lo, hi, canon.ring + dRing);
  // presence gating: appear with the regime prior; off-gate / hot-Jupiter (stormsOn=false) never appears.
  const prior = POLAR_PRESENCE_PRIOR[regime] ?? 0;
  const present = stormsOn && presenceRoll < prior;
  return {
    strength: present ? 1 : 0,
    mode, sides, r0, ring, pole: poleSign, phase, ageScalar, phaseScalar,
  };
}

// ── The storm/convection MASK — continuous [0,1] field over node directions ────
// mask(node) = clamp01( shear-correlated baseline  +  Σ vortex-proximity lift ).
//   shear baseline  : MASK_FLOOR + (1−FLOOR)·clamp01(|jetShear(lat)|/shearPeak)   → correlates with |shear|
//   vortex lift     : Σ_i MASK_VORTEX_LIFT · exp(−(angDist/ radius_i)²)            → maxima at placed vortices
// Because vortices are PLACED at the shear maxima, both terms reinforce the shear correlation while
// lifting the mask toward 1 near the discrete storms (AC-FIELDS a: bounded, shear-correlated, vortex-
// consistent). Off-gate (non-gas) ⇒ all-zero.
function stormMaskAt(nx, ny, nz, vortices, P, shearPeak) {
  const y = clamp(-1, 1, ny);
  const lat = Math.asin(y);
  let m = STORM_PHYS.MASK_FLOOR + (1 - STORM_PHYS.MASK_FLOOR) * clamp01(Math.abs(jetShear(lat, P)) / (shearPeak || 1));
  for (let k = 0; k < vortices.length; k++) {
    const c = vortices[k].center;
    const d = clamp(-1, 1, nx * c[0] + ny * c[1] + nz * c[2]);
    const ang = Math.acos(d);                             // angular distance node↔vortex center
    const r = vortices[k].radius || 0.1;
    m += STORM_PHYS.MASK_VORTEX_LIFT * Math.exp(-(ang / r) * (ang / r));
  }
  return clamp01(m);
}

/**
 * Storm writer over a carrier sphere — RETURNS the mask field + the placement records. Mirrors
 * writeClimateE5Sphere: evaluates the closed-form mask per carrier node and returns its OWN Float32Array.
 * Never mutates the carrier.
 * @returns {{ mask:Float32Array, vortices:Array, primary, train, pole, count, strength, params, shearPeak }}
 */
export function writeStormESphere(carrier, drivers = {}, { regime = E5_REGIME.GAS_GIANT, macroSeed = 0, stormSeed = 0 } = {}) {
  const rec = resolveStormE(regime, drivers, macroSeed, stormSeed);
  const N = carrier.N;
  const verts = carrier.verts;
  const mask = new Float32Array(N);
  if (rec.strength > 0) {
    const shearPeak = jetShearPeak(rec.params) || 1;
    for (let i = 0; i < N; i++) {
      const v = verts[i];
      mask[i] = stormMaskAt(v[0], v[1], v[2], rec.vortices, rec.params, shearPeak);
    }
  }
  return { mask, vortices: rec.vortices, primary: rec.primary, train: rec.train, pole: rec.pole, count: rec.count, strength: rec.strength, params: rec.params, shearPeak: jetShearPeak(rec.params) || 1 };
}

/**
 * Bake the ONE new per-render-vertex attribute (the storm/convection mask) onto a render mesh — the
 * single permitted new baked attribute (aBand/aShear/aMush precedent). Samples the SAME closed-form mask
 * on the render verts, so aStorm is byte-faithful to writeStormESphere.mask at matching node directions
 * (AC-PARITY a). Off-gate (non-gas) ⇒ all-zero (unread; the shader gate no-ops).
 * @param {Float32Array|number[]} positions flat [x,y,z,...] object-space render-vertex positions.
 * @param {number} count  vertex count.
 * @param {number} radius render sphere radius R (positions/R = unit node dir).
 * @returns {{ aStorm:Float32Array, vortices:Array, pole, strength:number, count:number, params:object }}
 */
export function bakeStormEAttributes(positions, count, radius, { regime = E5_REGIME.GAS_GIANT, drivers = {}, macroSeed = 0, stormSeed = 0 } = {}) {
  const rec = resolveStormE(regime, drivers, macroSeed, stormSeed);
  const aStorm = new Float32Array(count);
  if (rec.strength > 0) {
    const shearPeak = jetShearPeak(rec.params) || 1;
    for (let i = 0; i < count; i++) {
      const nx = positions[3 * i] / radius, ny = positions[3 * i + 1] / radius, nz = positions[3 * i + 2] / radius;
      aStorm[i] = stormMaskAt(nx, ny, nz, rec.vortices, rec.params, shearPeak);
    }
  }
  return { aStorm, vortices: rec.vortices, pole: rec.pole, strength: rec.strength, count: rec.count, params: rec.params };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THE POLAR SLICE, REACHABLE WITHOUT THE STORM SLICE (PLAN §4 Step 5 / ledger C19)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
//
// ⭐ THIS APPENDS AT EOF AND SHIFTS NOTHING, ON PURPOSE. Two live `line + symbol` refs resolve into
// this file — both onto storm-e.js:68 `URANIAN_OBLIQUITY: 80` from conditionFromBody.js — and
// line-shift citation rot has cost this program 71 repairs across two steps. Everything below is
// additive; `resolveStormE` above is byte-identical to HEAD and is NOT rewritten to call this.
//
// ⛔ IT IS NOT REWRITTEN, AND THE REASON IS THAT THE EQUALITY IS THE EVIDENCE. Refactoring
// `resolveStormE` to delegate here would make the two agree BY CONSTRUCTION, which is exactly the
// shape of measurement this program keeps catching: entirely true and entirely uninformative. Left
// duplicated, "the wrapper reproduces the pole" is a claim a test can falsify, and
// tests/driver-pack-polardeck.test.js falsifies it on demand by breaking one line and showing red.
// The duplication is therefore load-bearing until someone retires it deliberately.
//
// ⭐ WHAT MAKES THE POLAR FAMILY SEPARABLE FROM THE STORM FAMILY — read this before assuming the
// fence moved. The separation is not a boundary this lane drew; it is one the file already draws and
// documents, at storm-e.js:33 `identity in SIX DISJOINT sub-namespaces — the FOUR placement streams`.
// `stormE:polar` is a DISJOINT alea stream, drawn FIRST (storm-e.js:308 `const rngPolar = alea('stormE:polar:' + regime + ':' + id);`)
// so the variable per-seed vortex count can never move the pole structure — the F5 recoupling the
// legacy `_polRng ^ 0x9E3779B9` fork avoided. `resolvePole` reads FOUR things: the regime, the
// `stormsOn` boolean, the vigor ramp and its own rng. It never touches `P = resolveParams(...)`,
// never touches the ranked candidate list, never touches the mask. So this function reproduces
// the polar block of `resolveStormE` EXACTLY — it does not reproduce a simplification of it — while
// the placement machinery that begins at storm-e.js:317 `const { ranked } = resolveStormPlacement(P);` is not reachable from here at all.
//
// ⛔ CONSEQUENTLY THIS IS NOT A DOOR INTO THE STORM SLICE. It calls neither `resolveStormE` nor
// `writeStormESphere` nor `bakeStormEAttributes`, so a caller cannot reach a vortex record, a
// `uStorm*` value or the `aStorm` mask through it. tests/driver-pack-polardeck.test.js asserts that
// as a SOURCE SCAN over the pack that consumes this, not as a promise in prose.
//
// ⚠ WHAT IS GENUINELY NEW AND IS NOT HIDDEN BY THE ABOVE: this module becomes reachable from the
// GAME's module graph for the first time, and `stormE:polar` becomes a game-side draw. The golden
// mask reads only `stormE:place` (storm-e.js:460 `reads ONLY stormE:place vortices — never the pole draws — so`),
// so drawing the pole alone cannot move `GOLDEN_STORM_MASK_HASH` — but "cannot" there is a claim
// about draw streams, and the polar-deck test re-runs the existing storm suite's own identity
// expectations rather than restating it.
/**
 * The F29 polar-vortex parameter bank, resolved WITHOUT running storm placement.
 *
 * Deliberately carries the SAME positional signature as `resolveStormE` so the byte-identity control
 * is `resolvePolarVortex(a,b,c,d)` vs `resolveStormE(a,b,c,d).pole` with no adapter in between — an
 * adapter is a place for the two to be made to agree.
 *
 * @param {string} regime      an `E5_REGIME` value. ⛔ Classify the UN-DRAWN condition: `giantRegimeOf`
 *   on `drawGiantConditions`' OUTPUT flips the label on 3.15% of draws, and the lab measured that
 *   getting this wrong moves `polarSides`/`polarR0` on 52/52 (preset, seed) pairs while `polarStrength`
 *   and the storm count stay 0 — invisible to every off-gate check.
 * @param {object} drivers     reads `composition` (the gas gate), `T_eq` (the vigor ramp) and
 *   `obliquityDeg` (the Uranian branch). Nothing else.
 * @param {number} macroSeed   the per-body identity half of the placement pair.
 * @param {number} stormSeed   the placement half. A front-end with no storm UI must DECLARE one.
 * @returns {{strength:number, mode:number, sides:number, r0:number, ring:number, pole:number,
 *   phase:number, ageScalar:number, phaseScalar:number}} — `strength` is the per-seed PRESENCE flag
 *   (`POLAR_PRESENCE_PRIOR`), NOT a master gate: a gas giant can legitimately answer 0.
 */
export function resolvePolarVortex(regime = E5_REGIME.GAS_GIANT, drivers = {}, macroSeed = 0, stormSeed = 0) {
  // ── the gas gate + hot-Jupiter regime suppression, verbatim from storm-e.js:291 `const gas = drivers?.composition === 'h2-he';` on ──
  const gas = drivers?.composition === 'h2-he';
  const hotJupiter = regime === E5_REGIME.HOT_JUPITER;
  const stormsOn = gas && !hotJupiter;
  // ── the V-β.5 Uranian read, verbatim from storm-e.js:303 `const uranian = regime === E5_REGIME.NEPTUNIAN && (drivers?.obliquityDeg ?? 0) >= STORM_PHYS.URANIAN_OBLIQUITY;` ──
  const uranian = regime === E5_REGIME.NEPTUNIAN && (drivers?.obliquityDeg ?? 0) >= STORM_PHYS.URANIAN_OBLIQUITY;
  // ── the identity mix, the disjoint stream, the vigor ramp and the pole — storm-e.js:304 `const id = stormIdentity(macroSeed, stormSeed);` on ──
  const id = stormIdentity(macroSeed, stormSeed);
  const rngPolar = alea('stormE:polar:' + regime + ':' + id);
  const vigor = vigorOf(regime, drivers);
  const pole = resolvePole(regime, stormsOn, vigor, rngPolar);
  if (uranian) pole.mode = 0;
  return pole;
}
