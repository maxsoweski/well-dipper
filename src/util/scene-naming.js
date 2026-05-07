// Scene-naming helper for the inspection layer
// (welldipper-scene-inspection-layer-2026-05-06).
//
// Convention: Object3D.name = "<category>.<kind>.<id>", with mirror metadata
// on Object3D.userData so the inspection layer can group / filter / hash
// without re-parsing the dotted name string.
//
// IDs:
//   - Sol bodies: profileId mapped to a canonical short id (e.g. 'sol-moon'
//     → 'luna', 'sol-mars' → 'mars'). Stable across loads because the
//     profile map is part of the build.
//   - Procedural bodies: 6-char fnv1aString(systemSeed + ':' + ordinal)
//     hex hash. Stable across reloads because procedural systems regenerate
//     deterministically from systemSeed.
//
// The full FNV-1a hash is preserved on userData.id so collisions across
// systems (~1 in 16M at 6 hex chars) don't produce same-id-different-meaning
// confusion when the inventory is sliced per-system.

import { fnv1aString, toHex } from 'motion-test-kit/core/hash/fnv1a.js';

// Sol carve-out: KnownBodyProfiles uses 'sol-' prefixes; the inspection
// layer wants the brief's canonical short ids.
//
// Brief examples: body.planet.earth, body.planet.mars, body.moon.luna.
// 'sol-moon' is the only profileId that doesn't trivially strip; it maps
// to 'luna' explicitly.
const SOL_ID_OVERRIDES = {
  'sol-moon': 'luna',
};

/**
 * Resolve a stable id segment from a body data record.
 *
 * @param {object} bodyData            From PlanetGenerator / MoonGenerator
 *                                     or KnownBodyProfiles. Must carry
 *                                     `profileId` (canonical) OR `_systemSeed`
 *                                     + `_ordinal` (procedural).
 * @param {string|number} [fallbackOrdinal] Used only when bodyData has
 *                                     neither profileId nor an ordinal of
 *                                     its own. Saves call sites from
 *                                     mutating bodyData.
 * @returns {{ id: string, fullHash: string|null, isCanonical: boolean }}
 *          `id` = 5-6 chars (canonical name OR hex hash prefix).
 *          `fullHash` = 8-char hex of the full fnv1a (procedural only).
 *          `isCanonical` = true for Sol bodies.
 */
export function resolveBodyId(bodyData, fallbackOrdinal) {
  const profileId = bodyData?.profileId;
  if (typeof profileId === 'string' && profileId.length > 0) {
    if (SOL_ID_OVERRIDES[profileId]) {
      return { id: SOL_ID_OVERRIDES[profileId], fullHash: null, isCanonical: true };
    }
    if (profileId.startsWith('sol-')) {
      return { id: profileId.slice(4), fullHash: null, isCanonical: true };
    }
    // Non-Sol profile id (future canonical sets) — use as-is.
    return { id: profileId, fullHash: null, isCanonical: true };
  }
  // Procedural — derive from systemSeed + ordinal. Both are required for
  // determinism. Falls through to a noisy default when missing so it's
  // visible in the inventory rather than silently anonymous.
  const seed = bodyData?._systemSeed;
  const ordinal = bodyData?._ordinal ?? fallbackOrdinal;
  if (seed != null && ordinal != null) {
    const fullHex = toHex(fnv1aString(`${seed}:${ordinal}`));
    return { id: fullHex.slice(0, 6), fullHash: fullHex, isCanonical: false };
  }
  // No systemSeed available — emit a placeholder id that's still queryable
  // but signals "naming-policy gap" to the inspection layer.
  return { id: 'unseeded', fullHash: null, isCanonical: false };
}

/**
 * Apply naming + userData mirror to a THREE.Object3D.
 *
 * @param {object} obj  Three.js Object3D-shaped (Mesh / Group / Points / …).
 * @param {{
 *   category: string,
 *   kind: string,
 *   id: string,
 *   generation?: number,
 *   systemSeed?: string|number,
 *   fullHash?: string|null,
 * }} info
 */
export function assignName(obj, info) {
  if (!obj) return;
  if (!info?.category || !info?.kind || info?.id == null) {
    throw new Error('assignName: { category, kind, id } required');
  }
  obj.name = `${info.category}.${info.kind}.${info.id}`;
  // Preserve any pre-existing userData fields (LOD/lighting flags etc.).
  obj.userData = {
    ...(obj.userData || {}),
    category: info.category,
    kind: info.kind,
    id: info.id,
    generation: info.generation ?? 0,
  };
  if (info.systemSeed != null) obj.userData.systemSeed = info.systemSeed;
  if (info.fullHash) obj.userData.fullHash = info.fullHash;
}

/**
 * Re-tag an already-named Object3D as an "origin" snapshot during multi-
 * instance lifecycles (warp crossover demotes current layers to origin
 * slots while new destination layers are constructed). Overrides the id
 * segment to `origin` so the inspection layer can distinguish demoted
 * snapshots from the live layer.
 *
 * Example: `sky.starfield.main` -> `sky.starfield.origin`.
 *
 * No-op if the object has no pre-existing userData.category / kind.
 *
 * @param {object} obj
 */
export function markAsOrigin(obj) {
  if (!obj || !obj.userData?.category || !obj.userData?.kind) return;
  if (!obj.userData.priorId) obj.userData.priorId = obj.userData.id;
  obj.userData.id = 'origin';
  obj.name = `${obj.userData.category}.${obj.userData.kind}.origin`;
}

/**
 * Assign a body name (planet / moon / asteroid-belt / star) given the data
 * record. Convenience wrapper around resolveBodyId + assignName.
 *
 * @param {object} obj
 * @param {'planet'|'moon'|'asteroid-belt'|'star'} kind
 * @param {object} bodyData
 * @param {string|number} [fallbackOrdinal]
 */
export function assignBodyName(obj, kind, bodyData, fallbackOrdinal) {
  const { id, fullHash } = resolveBodyId(bodyData, fallbackOrdinal);
  assignName(obj, {
    category: 'body',
    kind,
    id,
    systemSeed: bodyData?._systemSeed,
    fullHash,
  });
}
