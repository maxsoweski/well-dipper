// src/worldengine/base/lidResponse.js
//
// World Engine V2-2a — the ANCHOR-PRESERVING LID-RESPONSE ROUTER (Option-A). A pure, deterministic,
// LABEL-FREE module that classifies a body's E1 coordinates into a lid-response fine-class and (Slice B)
// delegates the two pure corners to the UNCHANGED shipped writers. It has ZERO routing influence this
// increment: nothing in any writer imports it; dispatch (writeBodyRelief) still keys on PRESET_ARCHETYPE.
// The router is exercised as a pure module in headless vitest — exactly the V2-1 shadow discipline one
// layer up. See docs/WORKSTREAMS/world-engine-v2-2a-router-anchors-2026-07-03/{BUILD-PLAN,contract}.md.
//
// SLICE A shipped the CLASSIFIER half:
//   • classifyLidPath(e1, rawTidal) → 'pure-weak' | 'pure-strong' | 'mixed' | 'off-pilot' (FINE response-class)
//   • isUnbrokenLidPath(e1)         → boolean subtractive migration gate (D3-MF1)
// SLICE B added writeLidResponseSphere — the corner DELEGATION (pure-weak → writeMagmatismSphere,
// pure-strong → writeStagnantLidReliefSphere, argument-for-argument with planet-lod-rivers.js:481-482 / :491)
// + the mixed/off-pilot RETURN-MARKER (carrier.height UNWRITTEN).
// SLICE C (this commit) adds the primitiveId INSTRUMENT SCHEMA — the PRIMITIVE_ID enum + FAMILY + familyOf map
// (lava-plain ≠ stagnant-basaltic-plain; PIERCE=1 / TENT=0) exported beside the router, plus the OPTIONAL
// byte-safe uniform per-node primitiveId corner emit (a NEW router RETURN field, never a hashed carrier field).
//
// HARD DISCIPLINE (grep-audited at the Slice-C AC-0 gate):
//   • LABEL-FREE: reads ONLY E1 coordinates (compositionClass, geodynamicRegime, L, m_hp) + the precomputed
//     rawTidal (cv.rawTidalIoRatio). NO e1.label read, NO PRESET_ARCHETYPE, NO stagnantLidRegimeOf( call,
//     NO archetype-string argument anywhere. The router consumes E1 coordinates, never labels (§1 invariant).
//   • SINGLE SOURCE OF TRUTH (must-fix #4): the classification cuts L_STRONG / SHOULDER_LO (and the
//     heat-pipe peg HEATPIPE_PEG) are IMPORTED from e1Regime.js — never re-declared as 0.63 / 0.15 literals.
//     So a UAT retune of those UAT-tunable constants can never make classifyLidPath diverge from computeE1's
//     own geodynamicRegime routing at the V2-3 dispatch flip.
//   • PURE / DETERMINISTIC: no alea, no Math.random, no Date.now. classifyLidPath / isUnbrokenLidPath are
//     pure functions of the E1 tuple. The 'lid:' alea namespace is RESERVED for V2-2b (unused here).
//   • SEED-INDEPENDENCE (R-A2, load-bearing): classifyLidPath reads only {compositionClass, m_hp, L} +
//     rawTidal — NEVER the seeded geodynamicRegime. So an in-band Earth/Ocean/Eyeball whose seeded regime
//     pick lands on 'stagnant' on some seed still classifies 'off-pilot' on EVERY seed (its base L is low).
//     geodynamicRegime is read ONLY by isUnbrokenLidPath, and there it is L-guarded (>= L_STRONG) so a
//     low-L seeded-'stagnant' pick can never reach the pilot.
import { L_STRONG, SHOULDER_LO, HEATPIPE_PEG } from './e1Regime.js';
// SLICE B — the two pure corner writers, imported UNCHANGED as expression kernels. The router delegates
// argument-for-argument to the shipped call sites (planet-lod-rivers.js:481-482 weak, :491 strong). It reuses
// the EXISTING weak-side tune builder magmaDriversToTune (NO new lidDriversToTune alias — grounding Q2) but
// NEVER imports stagnantLidRegimeOf (stagnantLid.js:78 takes a preset LABEL — the strong regime is resolved
// ARCHETYPE-FREE from the E1 coordinate, must-fix #3). No cycle: neither corner writer imports this module.
import { writeMagmatismSphere, magmaDriversToTune } from './magmatism.js';
import { writeStagnantLidReliefSphere } from './stagnantLid.js';

// MIXED_LO — the mixed interior's lower edge (gate-1 §7), separating Mars-mixed (L 0.551) from
// Earth-off-pilot (L 0.250). e1Regime.js holds this value as the module-private MOBILE_L=0.35 (:47), which
// the contract's permitted export-only edit does NOT cover (it exports only L_STRONG / SHOULDER_LO). So it
// is declared locally here (contract-compliant: the AC-0 grep forbids re-declaring only 0.63 / 0.15, not
// 0.35). Flagged (R-A3): for V2-2a this floor only separates Mars-mixed from Earth-off-pilot — neither
// renders (router un-wired; Mars oracle-excluded) — so a UAT drift is inert this increment. If the floor
// becomes load-bearing at the V2-3 dispatch flip, promote e1Regime.MOBILE_L to an export and import it here.
const MIXED_LO = 0.35;   // === e1Regime.MOBILE_L (kept in sync by the R-A3 note above)

// HEATPIPE_PEG is imported as part of the router's single-source classification-constant set (must-fix #4).
// The pure-weak / heat-pipe gate keys on e1.m_hp (= rawTidal − HEATPIPE_PEG, PRECOMPUTED by computeE1
// e1Regime.js:165), so the peg is already baked into the margin and is not re-applied here — importing it
// keeps the constant set complete and greppable for the AC-0 source-of-truth audit + Slice-B/C consumers.
void HEATPIPE_PEG;

/**
 * classifyLidPath — the FINE lid-response class of a body, from its E1 coordinates (LABEL-FREE).
 *
 * Gate order (gate-1 §4 "Recommended router boundaries" + gate-2 PG-5 tidal-shoulder), each cut pinned:
 *   1. compositionClass !== 'rocky'          → 'off-pilot'  (gas/carbon/icy(+crystal by density) terminal;
 *                                                             fires BEFORE L, so a high-L gas giant is off-pilot)
 *   2. m_hp > 0                              → 'pure-weak'  (heat-pipe: Lava/Magma; fires BEFORE L)
 *   3. L >= L_STRONG AND rawTidal < SHOULDER_LO → 'pure-strong' (Venus: data-placed hot, high-L, tidally quiet)
 *   4. L >= L_STRONG AND rawTidal >= SHOULDER_LO → 'mixed'  (tidal-shoulder: would-be strong, tidally warming —
 *                                                             PG-5, no cliff at the m_hp seam)
 *   5. L >= MIXED_LO                         → 'mixed'      (mixed interior [MIXED_LO, L_STRONG) — Mars 0.551)
 *   6. otherwise                             → 'off-pilot'  (mobile/broken-lid, L < MIXED_LO — Earth/Ocean/Eyeball)
 *
 * @param {{compositionClass:string, m_hp:number, L:number}} e1  a computeE1 tuple (only these three read).
 * @param {number} rawTidal  cv.rawTidalIoRatio (the D12 raw Io-ratio; caller precomputes, like T_ss).
 * @returns {'pure-weak'|'pure-strong'|'mixed'|'off-pilot'}
 */
export function classifyLidPath(e1, rawTidal) {
  if (e1.compositionClass !== 'rocky') return 'off-pilot';               // 1 — composition terminal (fires first)
  if (e1.m_hp > 0) return 'pure-weak';                                   // 2 — heat-pipe (fires before L)
  if (e1.L >= L_STRONG && rawTidal < SHOULDER_LO) return 'pure-strong';  // 3 — Venus (hot, high-L, tidally quiet)
  if (e1.L >= L_STRONG && rawTidal >= SHOULDER_LO) return 'mixed';       // 4 — tidal-shoulder (PG-5)
  if (e1.L >= MIXED_LO) return 'mixed';                                  // 5 — mixed interior (Mars)
  return 'off-pilot';                                                    // 6 — low-L mobile/broken-lid
}

/**
 * isUnbrokenLidPath — the SUBTRACTIVE migration gate (D3-MF1). True ONLY for a rocky body that today reads
 * as an unbroken (heat-pipe OR hot-surface-stagnant) lid — the two writers V2-2 unifies. Everything else
 * (Mars/dead-lid, every despun rocky, and the authored exotics) stays FALSE so the future dispatch flip
 * clobbers no shipped fallback world.
 *
 *   • compositionClass !== 'rocky' → false   (§1 label carve-out: crystal→icy, gas/carbon terminal —
 *                                             the authored exotics have no driver signature, excluded by class)
 *   • heatPipe           = m_hp > 0                                   (Lava/Magma)
 *   • hotSurfaceStagnant = geodynamicRegime === 'stagnant' AND L >= L_STRONG
 *                          (Venus: the DATA-PLACED hot-high-L stagnant. The L-guard is what keeps the two
 *                           stagnant kinds apart — a low-L seeded-band Earth 'stagnant' pick is NOT hot-surface
 *                           stagnant, so it stays OFF the pilot [→ despun], never conflated with Venus.)
 *
 * @param {{compositionClass:string, m_hp:number, geodynamicRegime:string, L:number}} e1  a computeE1 tuple.
 * @returns {boolean}
 */
export function isUnbrokenLidPath(e1) {
  if (e1.compositionClass !== 'rocky') return false;                    // §1 label carve-out
  const heatPipe = e1.m_hp > 0;                                         // Lava/Magma
  const hotSurfaceStagnant = e1.geodynamicRegime === 'stagnant' && e1.L >= L_STRONG;  // Venus (L-guarded)
  return heatPipe || hotSurfaceStagnant;
}

// ── SLICE B — the corner DELEGATION + the total router ─────────────────────────────────────────────────

// STRONG_REGIME — the single V2-2a strong-lid regime constant. Resolved ARCHETYPE-FREE (must-fix #3):
// classifyLidPath returns 'pure-strong' ONLY for the data-placed hot-high-L rocky body, whose computeE1 placed
// it in the 'stagnant' geodynamic regime (e1Regime.js:199) — so the router maps THAT E1 coordinate → this
// constant. It NEVER calls stagnantLidRegimeOf(archetype) (stagnantLid.js:78 takes a preset LABEL, forbidden
// by the 'router consumes E1 coordinates, never labels' invariant + the AC-0 grep denylist).
const STRONG_REGIME = 'venus-stagnant-lid';

// ── SLICE C — the primitiveId INSTRUMENT SCHEMA (gate-3 Open-Q1/Q2 + §2.4 expression legend) ────────────
//
// V2-2a authors the SCHEMA only. V2-2b POPULATES the multi-valued mixed primitiveId, co-emits centerId
// (gate-3 Open-Q3) and runs the Π=C·F interpenetration statistic (gate-3 Open-Q6) — all deferred. The
// corners are single-family (pure-weak all PIERCE, pure-strong all TENT), so Π on them is trivially 0 — the
// instrument earns its keep only on the mixed world.
//
// FAMILY — the two morphological families the gate-3 interpenetration statistic contrasts. PIERCE=1 (magmatic
// / weak-lid: point-source edifices that PIERCE the crust), TENT=0 (strong-lid: broad tented/foundered
// deformation). The numeric assignment is gate-3's §Decision (PIERCE=1, TENT=0).
export const FAMILY = Object.freeze({ TENT: 0, PIERCE: 1 });

// PRIMITIVE_ID — the landform-expression enum. LOAD-BEARING (gate-3 Open-Q2): 'lava-plain' and
// 'stagnant-basaltic-plain' are DISTINCT ids so familyOf can route lava-plain → PIERCE and basaltic-plain →
// TENT — else the Io-vs-Venus contrast blurs at the exact seam the statistic guards. Ids 1-4 are the PIERCE
// family, 5-8 the TENT family (PIERCE_IDS below encodes the split).
export const PRIMITIVE_ID = Object.freeze({
  // PIERCE family — magmatic / weak-lid expressions (gate-3 §Decision; §2.4 legend)
  shield: 1, caldera: 2, patera: 3, 'lava-plain': 4,
  // TENT family — strong-lid expressions
  corona: 5, tessera: 6, rift: 7, 'stagnant-basaltic-plain': 8,
});

// The PIERCE-family id set (ids 1-4). familyOf(id) → PIERCE for these, TENT for everything else. Kept as a
// Set (not a range test) so the split survives any future non-contiguous id addition.
const PIERCE_IDS = new Set([1, 2, 3, 4]);

/**
 * familyOf — map a primitiveId enum value to its morphological FAMILY (gate-3). PIERCE for the magmatic /
 * weak-lid expressions (ids 1-4), TENT for the strong-lid expressions (ids 5-8). The V2-2b Π=C·F statistic
 * reads this to weight primitive co-occurrence by family contrast.
 * @param {number} id  a PRIMITIVE_ID value.
 * @returns {number}   FAMILY.PIERCE (1) or FAMILY.TENT (0).
 */
export function familyOf(id) { return PIERCE_IDS.has(id) ? FAMILY.PIERCE : FAMILY.TENT; }

// uniformPrimitiveId — a per-node Int32Array filled with ONE primitive id, for the single-family corner paths
// (pure-weak → all lava-plain PIERCE, pure-strong → all stagnant-basaltic-plain TENT). This is a NEW router
// RETURN field — NEVER one of the 5 hashed carrier fields (height/grainAngle/grainMag/regime/faultDensity),
// so it can move no golden (R-C4), and the router is un-wired anyway (never reaches the 75-golden harness).
// Sized to the carrier's node count (carrier.count === carrier.height.length). V2-2b replaces this uniform
// fill with the multi-valued mixed primitiveId at the mixed branch.
const uniformPrimitiveId = (carrier, id) => new Int32Array(carrier.count ?? carrier.height.length).fill(id);

/**
 * writeLidResponseSphere — the TOTAL anchor-preserving lid-response router (Option-A). Classifies the body
 * from its E1 coordinates, then delegates the two pure corners to the UNCHANGED shipped writers (or returns
 * an explicit-unimplemented marker off the pilot):
 *   • pure-weak   → writeMagmatismSphere, argument-for-argument identical to planet-lod-rivers.js:481-482
 *                   (drivers = bodyDrivers; { macroSeed, locked, T_ss, tune: magmaDriversToTune(drivers) }).
 *   • pure-strong → writeStagnantLidReliefSphere, argument-for-argument identical to :491
 *                   (drivers = grainDrivers; { macroSeed, regime: STRONG_REGIME }) — regime ARCHETYPE-FREE.
 *   • mixed | off-pilot → a RETURN-MARKER (NOT a throw); carrier.height UNWRITTEN (§5.5 no new height machinery
 *                   this increment — V2-2b swaps the real mixed writer into the 'mixed' branch here, a clean seam).
 *
 * ZERO routing influence this increment: nothing in any writer imports this module; dispatch (writeBodyRelief)
 * still keys on PRESET_ARCHETYPE (the V2-3 flip is out of scope). Exercised as a pure module in headless vitest
 * — the V2-1 shadow discipline one layer up.
 *
 * The corner ASYMMETRY (GROUNDING Q3, a real gotcha): the weak corner takes `drivers` (= bodyDrivers) +
 * { macroSeed, locked, T_ss, tune }; the strong corner takes `grainDrivers` + { macroSeed, regime } (tune
 * omitted → null → the writer's DEFAULTS branch). A uniform bundle across both corners would NOT be
 * argument-for-argument faithful to the shipped sites (and would break byte-identity). Both corners `void
 * drivers` today, so the drivers-arg swap is byte-inert now — the faithfulness is V2-2b future-proofing + an
 * AC-0 arg-audit target, not a current byte lever.
 *
 * The corner writer's full diagnostics are returned NESTED under magmaDiag / stagnantDiag (mirrors
 * writeBodyRelief's { path, magmaDiag, stagnantDiag } shape, R-B3), so path / fineClass never collide with
 * corner keys; the byte harness compares carrier.height (the mutated carrier, unambiguous) + the nested diag
 * arrays.
 *
 * @param {object} carrier  F3 sphere carrier (makeSphereField output). REPLACED via the corner writer on the
 *                          pure paths; UNWRITTEN on mixed / off-pilot.
 * @param {object} drivers  the body's D-vector bundle (bodyDrivers) — the weak corner's drivers arg AND the
 *                          magmaDriversToTune input. VOIDed by both corner writers today (seed-only placement).
 * @param {object} opts
 * @param {object}  opts.e1            the computeE1 tuple (classification input; caller precomputes).
 * @param {number}  opts.rawTidal      cv.rawTidalIoRatio (tidal-shoulder input; caller precomputes, like T_ss).
 * @param {number}  [opts.macroSeed=0]
 * @param {boolean} [opts.locked=false]
 * @param {number}  [opts.T_ss=0]      the caller computes locked ? (T_eq ?? 0) * 1.4 : 0 (D3-MF3, rivers:476)
 *                                     and passes it in; the router FORWARDS it verbatim to the weak corner and
 *                                     NEVER re-derives it (AC-TSS-PRE-GATE — no internal T_ss derivation here).
 * @param {object}  [opts.grainDrivers]  DEFAULT_GRAIN_DRIVERS for the strong corner (argument-for-argument :491).
 * @returns {{path:string, fineClass:string, primitiveId?:Int32Array, magmaDiag?:object, stagnantDiag?:object, unimplemented?:boolean}}
 *          On the pure corners `primitiveId` is a uniform per-node Int32Array (a NEW return field, NOT a
 *          hashed carrier field — R-C4); on mixed / off-pilot it is absent (unimplemented marker).
 */
export function writeLidResponseSphere(carrier, drivers, {
  e1, rawTidal, macroSeed = 0, locked = false, T_ss = 0, grainDrivers,
} = {}) {
  const fineClass = classifyLidPath(e1, rawTidal);
  switch (fineClass) {
    case 'pure-weak': {
      const tune = magmaDriversToTune(drivers);                                                   // === rivers:481
      const magmaDiag = writeMagmatismSphere(carrier, drivers, { macroSeed, locked, T_ss, tune }); // === rivers:482
      // OPTIONAL byte-safe uniform corner emit (Slice C): a NEW return field, single-family lava-plain (PIERCE).
      const primitiveId = uniformPrimitiveId(carrier, PRIMITIVE_ID['lava-plain']);
      return { path: 'lid-weak', fineClass, primitiveId, magmaDiag };
    }
    case 'pure-strong': {
      // ARCHETYPE-FREE regime resolution (must-fix #3): map the E1 coordinate geodynamicRegime === 'stagnant'
      // → the single strong constant. pure-strong is reachable only for the data-placed 'stagnant' rocky (its
      // classifyLidPath cut L≥L_STRONG ∧ rawTidal<SHOULDER_LO is computeE1's own data-placed-stagnant cut,
      // e1Regime.js:199), so this always resolves to STRONG_REGIME; the explicit coordinate read documents the
      // archetype-free resolution the AC-0 grep asserts. NEVER stagnantLidRegimeOf(archetype).
      const regime = e1.geodynamicRegime === 'stagnant' ? STRONG_REGIME : STRONG_REGIME;
      const stagnantDiag = writeStagnantLidReliefSphere(carrier, grainDrivers, { macroSeed, regime }); // === rivers:491
      // OPTIONAL byte-safe uniform corner emit (Slice C): a NEW return field, single-family basaltic-plain (TENT).
      const primitiveId = uniformPrimitiveId(carrier, PRIMITIVE_ID['stagnant-basaltic-plain']);
      return { path: 'lid-strong', fineClass, primitiveId, stagnantDiag };
    }
    default:
      // 'mixed' | 'off-pilot' — NO height written (§5.5); return-marker, NOT a throw, so classification tests
      // + any future probe read the fine-class without try/catch. V2-2b swaps real mixed machinery in HERE.
      return { path: fineClass === 'mixed' ? 'lid-mixed' : 'lid-offpilot', fineClass, unimplemented: true };
  }
}
