/**
 * navViewModes/starIdentity.js — the ONE answer to "is this the same star?" for the nav.
 *
 * ── ⛔ THE DEFECT THIS FILE EXISTS TO REMOVE (naming-prism-segments AC-2, plan §3.4) ─────────────
 *
 * Every place the nav went from a drawn or remembered star back to the LIVE `_localStars` row did it
 * by the 32-bit seed: the PRISM list click (`index.js`), the PRISM map click (`picking.js`), the
 * selection (`state.js`), the name and multiplicity memos (`state.js`) and the binary stash on the
 * way out of SYSTEM (`NavComputer.js`). A seed is a GENERATION INPUT, not an identity — two stars can
 * share one — so a click on one star could select, drill and warp to its twin, and the memo could
 * hand one star the other's name. Nothing in this file changes any seed; it only stops the nav from
 * using one to FIND a star.
 *
 * ── ⭐ THE RULE ─────────────────────────────────────────────────────────────────────────────────
 *
 *   · both records carry `key` (HashGridStarfield's 'p:<tier>:<cx>:<cy>:<cz>', the real-star
 *     merge's 'r:…') → the keys decide, and nothing else;
 *   · either record never carried one (a search hit, the sky's real-star copy, a KnownSystems
 *     arrival, a hand-built stand-in) → POSITION at POSITION_MATCH_TOL, the 0.1 pc same-star radius
 *     `_isCurrentSystem` and `_tryAutoSelectExternalTarget` already use. ⛔ NEVER the seed.
 *
 * Non-goals · no key is minted here (the generator and the merge own that), and no seed used as an
 * RNG input is touched — `makeRng(s.seed)`, `resolveArrivalSystem({ seed })`, `multiplicityForSeed`
 * all keep reading it.
 */
import { POSITION_MATCH_TOL } from '../../generation/RealStarCatalog.js';

/** True when `a` and `b` are the same star. See the header for the rule; `null` is never a star. */
export function sameStar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.key != null && b.key != null) return a.key === b.key;
  const dx = a.wx - b.wx, dy = (a.wy || 0) - (b.wy || 0), dz = a.wz - b.wz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) < POSITION_MATCH_TOL;
}

/**
 * The memo key for facts DERIVED from a star (its name, its multiplicity). Its identity when it has
 * one; otherwise every input the derivation reads — seed AND position — so two keyless records that
 * share a seed but sit apart can never share an entry.
 */
export function starMemoKey(s) {
  return s.key != null ? s.key : `${s.seed}@${s.wx},${s.wy},${s.wz}`;
}
