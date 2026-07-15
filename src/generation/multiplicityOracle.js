/**
 * multiplicityOracle — ARRIVAL-TRUTH stellar multiplicity for any star/seed
 * (real-star-identity-unification-2026-07-15, AC7).
 *
 * WHAT: `multiplicityForSeed(starOrSeed, { overlay, galacticMap })` answers how
 * many stars the player would find on arrival at a star — WITHOUT generating the
 * whole system per call. A prism glyph consumes it (~dozens of markers visible)
 * so it can show a dot count that can never contradict what warping delivers.
 *
 * PRECEDENCE (identical chain to arrival, by reuse — NOT a fork): the first that
 * covers the star wins.
 *   1. KnownSystems registry (alias-aware findByAlias) — Sol, Alpha Centauri.
 *      Every alias (Rigil Kentaurus / Toliman / Proxima Centauri → Alpha Cen)
 *      routes here first, exactly as arrival routes it, so a component or far
 *      alias reports the WHOLE authored system's multiplicity (= arrival truth).
 *   2. Curated companion table + archive snum + pin-by-default — all via
 *      RealSystemOverlay.resolve(): a companionSpec it returns IS the arrival's
 *      forced structure (table multiple, table single, archive-snum single,
 *      pin-by-default single). Read straight off it — no re-derivation.
 *   3. Procgen prefix roll — a snum>=2 host (archive says multiple, structure
 *      procgen-rolled) and any non-real (procgen) star run
 *      StarSystemGenerator.stellarPrefix on the SAME seed + context arrival uses.
 *      Because generator and oracle share that one prefix function, the binary
 *      roll cannot drift (AC7 "impossible by construction").
 *
 * COUNTS: the return distinguishes CLOSE members (rendered as the marker's dot
 * cluster, AC10 2-close cap → 1 or 2) from FAR companions (wide, own catalog
 * marker where catalogued separately). `count = closeCount + farCount` equals the
 * multiplicity of the actually-generated systemData
 * (1 + star2?1:0 + farCompanions.length) — the invariant AC7's tests pin. The
 * glyph decides which of {count, closeCount} to draw at a given marker (a
 * far companion with its own marker → closeCount; one deduped into the marker →
 * count); the oracle supplies both, it does not make that rendering call.
 *
 * COST: real stars resolve through map/array lookups; procgen stars draw a few
 * RNG values (starVariation + the binary chance) via the shared prefix. Known
 * systems read their pre-resolved companion structure — no generate().
 *
 * DELIBERATE NON-GOALS: no rendering (lane D / the glyph unit consumes this); no
 * seed derivation policy (FIX-1 realStarSeed owns it — a real star's `.seed` is
 * already canonical); no overlay/generator edits (this is a pure consumer).
 */

import { StarSystemGenerator } from './StarSystemGenerator.js';
import { KnownSystems } from './KnownSystems.js';
import { realStarSeed } from './realStarSeed.js';

/**
 * Normalize the flexible input (a prism/sky/catalog star object, or a bare
 * seed) to { seed, pos, type, name }. Position is read from worldX/Y/Z (sky/
 * findVisible shape) or x/y/z (catalog shape); type from `type` or `spect`.
 */
function _normalize(input) {
  if (input == null) return { seed: null, pos: null, type: null, name: null };
  if (typeof input === 'string' || typeof input === 'number') {
    return { seed: String(input), pos: null, type: null, name: null };
  }
  let pos = null;
  if (typeof input.worldX === 'number') {
    pos = { x: input.worldX, y: input.worldY, z: input.worldZ };
  } else if (typeof input.x === 'number') {
    pos = { x: input.x, y: input.y, z: input.z };
  }
  let seed = input.seed != null ? String(input.seed) : null;
  // A real star missing an explicit seed derives the canonical F1 from position
  // (FIX-1); a procgen star always carries its grid seed, so this only backfills
  // real stars.
  if (seed == null && pos) seed = String(realStarSeed(pos.x, pos.y, pos.z));
  return {
    seed,
    pos,
    type: input.type ?? input.spect ?? null,
    name: input.name ?? null,
  };
}

/** Close-member count a companionSpec (or resolve() result) forces. A 'multiple'
 *  forces one close pair per component (1 or 2, AC10 cap); a 'single' forces 1. */
function _closeFromSpec(spec) {
  if (spec.kind === 'multiple' && Array.isArray(spec.components)) {
    return spec.components.length;
  }
  return 1; // 'single' (table single, archive-snum, pin-by-default)
}

/** Procgen close-member count: run the SHARED pre-binary-roll prefix on the same
 *  seed + arrival context, so the roll matches generation byte-for-byte. */
function _procgenClose(seed, pos, type, galacticMap) {
  let ctx = null;
  if (galacticMap && pos) {
    ctx = galacticMap.deriveGalaxyContext(pos);
    if (type) ctx.starTypeOverride = type;
  }
  const { isBinary } = StarSystemGenerator.stellarPrefix(String(seed), ctx);
  return isBinary ? 2 : 1;
}

/**
 * @typedef {Object} Multiplicity
 * @property {number} count       total stellar members (== generated systemData)
 * @property {number} closeCount  members in the close cluster (marker dots; 1–2)
 * @property {number} farCount    wide companions (own marker where catalogued)
 * @property {string} source      'known' | 'table' | 'archive-snum' |
 *                                 'pin-by-default' | 'archive-roll' | 'procgen'
 */

/**
 * Resolve a star's (or seed's) arrival multiplicity.
 *
 * @param {object|string|number} starOrSeed — a star object ({ seed, type|spect,
 *   name, worldX/Y/Z or x/y/z }) or a bare seed (procgen best-effort only).
 * @param {object} [deps]
 * @param {RealSystemOverlay|null} [deps.overlay] — ready overlay (real-star chain)
 * @param {GalacticMap|null} [deps.galacticMap] — for the procgen roll's context
 * @returns {Multiplicity}
 */
export function multiplicityForSeed(starOrSeed, { overlay = null, galacticMap = null } = {}) {
  const { seed, pos, type, name } = _normalize(starOrSeed);

  // 1. KnownSystems (alias-aware) — highest precedence, exactly as arrival routes.
  if (name) {
    const ks = KnownSystems.findByAlias(name, pos);
    if (ks) {
      // Declarative entry carries its resolved companion structure; a hand-built
      // entry (Sol) has none — read its static names (star2 => close pair).
      let closeCount;
      let farCount;
      if (ks._companion) {
        closeCount = _closeFromSpec({ kind: 'multiple', components: ks._companion.components });
        farCount = Array.isArray(ks._companion.farCompanions) ? ks._companion.farCompanions.length : 0;
      } else {
        closeCount = 1 + (ks.names?.star2 ? 1 : 0);
        farCount = 0;
      }
      return { count: closeCount + farCount, closeCount, farCount, source: 'known' };
    }
  }

  // 2. Real-universe overlay chain (table / archive-snum / pin-by-default).
  if (name && overlay && overlay.ready) {
    const r = overlay.resolve(name, pos);
    if (r.companionSpec) {
      const closeCount = _closeFromSpec(r.companionSpec);
      const farCount = Array.isArray(r.farCompanions) ? r.farCompanions.length : 0;
      const source = r.companionSpec.source
        || (r.companionSpec.kind === 'multiple' ? 'table' : 'table');
      return { count: closeCount + farCount, closeCount, farCount, source };
    }
    // A real host with snum>=2 supplies no companionSpec — arrival rolls the
    // companion procedurally (archive multiplicity honored via the live roll).
    if (r.host) {
      const closeCount = _procgenClose(seed, pos, type, galacticMap);
      return { count: closeCount, closeCount, farCount: 0, source: 'archive-roll' };
    }
  }

  // 3. Non-real (procgen) star — the shared prefix roll IS the arrival truth.
  const closeCount = _procgenClose(seed, pos, type, galacticMap);
  return { count: closeCount, closeCount, farCount: 0, source: 'procgen' };
}
