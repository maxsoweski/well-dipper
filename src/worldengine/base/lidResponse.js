// src/worldengine/base/lidResponse.js
//
// World Engine V2-2a — the ANCHOR-PRESERVING LID-RESPONSE ROUTER (Option-A). A pure, deterministic,
// LABEL-FREE module that classifies a body's E1 coordinates into a lid-response fine-class and (Slice B)
// delegates the two pure corners to the UNCHANGED shipped writers. It has ZERO routing influence this
// increment: nothing in any writer imports it; dispatch (writeBodyRelief) still keys on PRESET_ARCHETYPE.
// The router is exercised as a pure module in headless vitest — exactly the V2-1 shadow discipline one
// layer up. See docs/WORKSTREAMS/world-engine-v2-2a-router-anchors-2026-07-03/{BUILD-PLAN,contract}.md.
//
// SLICE A (this file, first commit) ships ONLY the CLASSIFIER half:
//   • classifyLidPath(e1, rawTidal) → 'pure-weak' | 'pure-strong' | 'mixed' | 'off-pilot' (FINE response-class)
//   • isUnbrokenLidPath(e1)         → boolean subtractive migration gate (D3-MF1)
// Slice B adds writeLidResponseSphere (corner delegation + mixed return-marker); Slice C adds the
// primitiveId enum + familyOf schema. Those are intentionally absent here.
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
