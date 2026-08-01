/**
 * realStarSeed — the ONE canonical seed for a real catalog star (the "F1"
 * position-hash of the seed-identity investigation, 2026-07-15).
 *
 * A real star's procgen identity must be the SAME wherever the star is met —
 * sky click, nav search, prism merge, debug teleport, arrival. Historically the
 * F1 formula existed as byte-identical twins in RealStarCatalog.findVisible and
 * knownObjectSearch.seedFromPos, and the NavComputer prism merge forked it two
 * more ways (retained hash-grid seed / x^z XOR). This module is the single home
 * of the formula; every real-star seed derivation imports it.
 *
 * The formula bins position to 0.1 pc (round(coord * 1e4), coords in galactic
 * kpc) and folds x, y, z through GalacticMap.hashCombine. It is byte-identical
 * to the twins it replaced — do NOT change the body without the same review the
 * twins carried (a change re-seeds every real star and breaks path identity).
 *
 * @param {number} x  galactic X (kpc)
 * @param {number} y  galactic Y (kpc)
 * @param {number} z  galactic Z (kpc)
 * @returns {number}  deterministic unsigned 32-bit seed
 */
import { GalacticMap } from './GalacticMap.js';

export function realStarSeed(x, y, z) {
  return GalacticMap.hashCombine(
    Math.round(x * 10000),
    GalacticMap.hashCombine(Math.round(y * 10000), Math.round(z * 10000)),
  );
}
