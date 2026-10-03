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
 *   · both records carry a STAR key (HashGridStarfield's 'p:<tier>:<cx>:<cy>:<cz>', the catalogue's
 *     'r:…') → the keys decide, and nothing else — however close the two stars sit;
 *   · both carry a KnownSystems SYSTEM key ('k:<name>') → the keys decide too;
 *   · otherwise — a record that never carried a key (a hand-built stand-in), or a 'k:' system held
 *     against a star row (a system is not a row: Alpha Centauri's registry point stands for
 *     Rigil Kentaurus, Toliman and Proxima) → POSITION at POSITION_MATCH_TOL, the 0.1 pc radius.
 *     ⛔ NEVER the seed.
 *
 * ⛔ AND NEVER THE FIRST ROW INSIDE 0.1 pc. The generator puts distinct stars closer than that (95
 *   pairs in one 40 × 40 × 100 pc inner-galaxy query box, Astra 2026-10-02, the closest 0.023 pc
 *   apart), so a list is searched with `findStar`, which hands back the NEAREST match — an
 *   exact-position copy finds its own row, never a neighbour that happens to come first.
 *
 * Non-goals · no key is minted here (the generator and the merge own that), and no seed used as an
 * RNG input is touched — `makeRng(s.seed)`, `resolveArrivalSystem({ seed })`, `multiplicityForSeed`
 * all keep reading it.
 */
import { POSITION_MATCH_TOL } from '../../generation/RealStarCatalog.js';

/** 'star' for a 'p:'/'r:' key, 'system' for a KnownSystems 'k:' key, null for none. */
function keyKind(k) {
  if (typeof k !== 'string') return null;
  if (k.startsWith('p:') || k.startsWith('r:')) return 'star';
  return k.startsWith('k:') ? 'system' : null;
}

const gap = (a, b) => Math.hypot(a.wx - b.wx, (a.wy || 0) - (b.wy || 0), a.wz - b.wz);

/** True when `a` and `b` are the same star. See the header for the rule; `null` is never a star. */
export function sameStar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const ka = keyKind(a.key);
  if (ka && ka === keyKind(b.key)) return a.key === b.key;
  return gap(a, b) < POSITION_MATCH_TOL;
}

/**
 * The row in `list` that IS star `s`, or null. Every row `sameStar` accepts is a candidate and the
 * NEAREST wins, so a keyed star finds only its own row and a position-only record finds the row it
 * sits on (ties keep the earlier row). ⛔ Not `list.find(sameStar)`: that is the first row inside
 * 0.1 pc, and a different star can come first.
 */
export function findStar(list, s) {
  if (!s || !list) return null;
  let best = null, bestD = Infinity;
  for (const r of list) {
    if (r === s || (s.key != null && r.key === s.key)) return r;   // the same key IS the star
    if (!sameStar(r, s)) continue;
    const d = gap(r, s);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

/** True for a star identity ('p:' / 'r:') — the keys a nav ROW can carry. */
export function isStarKey(k) { return keyKind(k) === 'star'; }

/**
 * The memo key for facts DERIVED from a star (its name, its multiplicity). Its identity when it has
 * one; otherwise every input the derivation reads — seed AND position — so two keyless records that
 * share a seed but sit apart can never share an entry.
 */
export function starMemoKey(s) {
  return s.key != null ? s.key : `${s.seed}@${s.wx},${s.wy},${s.wz}`;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⭐ "HERE" — THE PLAYER'S OWN STAR, ONE RESOLVER FOR EVERY CONSUMER (naming-prism-segments AC-5;
//    Astra phase-2 review, finding 2). Design 1 and design 2's here-mark (state.js `D.here`), the
//    legacy prism's here-star (navDrill `hereStar`), the target styling (`D.targetIsHere`) and the
//    self-warp guard (`commit()`) used to ask three different questions — nearest row inside 0.1 pc,
//    "any row with the current system's NAME", and "the target's name equals the current system's".
//    A same-name star 2 pc away read as here; an alias at the player's exact position did not, so
//    Enter warped to the system you were in. Now all of them ask the one below.
//
//    The player's identity is the star the game ARRIVED at (`nav._hereStarId`, written by
//    `openToCurrentSystem` from main.js's current-star entry, key and all) while the player is still
//    at it (inside the 0.1 pc same-star radius). Its key is authoritative under `sameStar`'s rule; a
//    player with no carried identity (a debug spawn, a frame before arrival) falls back explicitly to
//    POSITION — the nearest row inside 0.1 pc of the player. ⛔ Never the name.
// ════════════════════════════════════════════════════════════════════════════════════════════════

/** The player's own star as a record `sameStar` can compare: `{ wx, wy, wz, key?, name? }`, or null
 *  before the nav knows where the player is. */
export function playerStarOf(nav) {
  if (!nav || !Number.isFinite(nav._playerX) || !Number.isFinite(nav._playerZ)) return null;
  const P = { wx: nav._playerX, wy: Number.isFinite(nav._playerY) ? nav._playerY : 0, wz: nav._playerZ };
  const id = nav._hereStarId;
  if (id && Number.isFinite(id.wx) && Number.isFinite(id.wz) && gap(id, P) < POSITION_MATCH_TOL) {
    return { ...P, key: id.key, name: id.name };
  }
  return P;
}

/** True when `star` IS the player's own star — the self-warp guard and the "here" styling. */
export function isHereStar(nav, star) {
  const p = playerStarOf(nav);
  return !!p && !!star && sameStar(p, star);
}

/** The row in `rows` that is the player's own star, or null (not loaded, or not in these rows). */
export function hereRowOf(nav, rows) {
  const p = playerStarOf(nav);
  return p && rows && rows.length ? findStar(rows, p) : null;
}
