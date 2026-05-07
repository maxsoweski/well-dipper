// Scene-inventory golden helper. Pure-data: zero engine imports.
//
// Phase 3 / Tier 3 of welldipper-scene-inspection-layer-2026-05-06.
//
// Produces a canonical, stable-sorted, UUID-stripped, position-rounded
// form of a SceneInventory so byte-comparison against committed
// tests/golden/scene-inventory/<scenario>.json files is meaningful.
//
// Drift-resistance:
//   - meshes / cameras / lights / composerPasses / domOverlays arrays
//     sorted by name (mesh) / role (material) / track (audio) / etc.
//   - uuids stripped (three.js regenerates them per page load).
//   - worldPos rounded to 3 decimals so float jitter doesn't produce
//     false diffs.

const POS_DECIMALS = 3;

function roundVec(v) {
  if (!Array.isArray(v)) return v;
  return v.map((n) => (typeof n === 'number' ? Number(n.toFixed(POS_DECIMALS)) : n));
}

function stripUuid(o) {
  if (!o || typeof o !== 'object') return o;
  const { uuid: _uuid, materialUuid: _mu, geometryUuid: _gu, textureUuid: _tu, ...rest } = o;
  if (rest.worldPos) rest.worldPos = roundVec(rest.worldPos);
  return rest;
}

function sortByKey(arr, key) {
  if (!Array.isArray(arr)) return arr;
  return [...arr].sort((a, b) => String(a?.[key] ?? '').localeCompare(String(b?.[key] ?? '')));
}

/**
 * Convert a live SceneInventory into the canonical golden form.
 * Stable-byte-equivalent for snapshots taken at the same simulation tick.
 *
 * @param {object} inv  From takeSceneInventory.
 * @returns {object}    Golden-form inventory.
 */
export function serializeForGolden(inv) {
  if (!inv) return inv;
  const out = {};
  if (Array.isArray(inv.meshes)) out.meshes = sortByKey(inv.meshes, 'name').map(stripUuid);
  if (Array.isArray(inv.cameras)) out.cameras = sortByKey(inv.cameras, 'name').map(stripUuid);
  if (Array.isArray(inv.lights)) out.lights = sortByKey(inv.lights, 'name').map(stripUuid);
  if (Array.isArray(inv.composerPasses)) out.composerPasses = sortByKey(inv.composerPasses, 'name');
  if (Array.isArray(inv.domOverlays)) out.domOverlays = sortByKey(inv.domOverlays, 'id');
  if (Array.isArray(inv.materials)) out.materials = sortByKey(inv.materials, 'role');
  if (Array.isArray(inv.renderTargets)) out.renderTargets = sortByKey(inv.renderTargets, 'name').map(stripUuid);
  if (Array.isArray(inv.audio)) out.audio = sortByKey(inv.audio, 'track');
  if (inv.clocks) out.clocks = sortRecord(inv.clocks);
  if (inv.modes) out.modes = sortRecord(inv.modes);
  if (inv.phases) out.phases = sortRecord(inv.phases);
  if (inv.input) out.input = sortRecord(inv.input);
  if (inv.rendererInfo) out.rendererInfo = inv.rendererInfo;
  return out;
}

function sortRecord(rec) {
  if (typeof rec !== 'object' || rec === null || Array.isArray(rec)) return rec;
  const keys = Object.keys(rec).sort();
  const out = {};
  for (const k of keys) out[k] = rec[k];
  return out;
}

/**
 * Pure diff: returns appeared / disappeared / changed lists between two
 * golden-form inventories. Composes with kit's diffInventories for
 * mesh-level deltas.
 *
 * @param {object} prev  Golden-form (or live) inventory.
 * @param {object} next  Golden-form (or live) inventory.
 */
export function quickGoldenDiff(prev, next) {
  const namesOf = (arr, key) => new Set((arr || []).map((e) => e?.[key]).filter(Boolean));
  const ms1 = namesOf(prev?.meshes, 'name');
  const ms2 = namesOf(next?.meshes, 'name');
  return {
    meshesAppeared: [...ms2].filter((n) => !ms1.has(n)).sort(),
    meshesDisappeared: [...ms1].filter((n) => !ms2.has(n)).sort(),
    cameraCountDelta: (next?.cameras?.length ?? 0) - (prev?.cameras?.length ?? 0),
    lightCountDelta: (next?.lights?.length ?? 0) - (prev?.lights?.length ?? 0),
  };
}
