/**
 * SavedSystems — a persisted, tag-searchable list of saved star systems.
 *
 * Each entry stores a navStarData position snapshot
 * ({worldX,worldY,worldZ,seed,type}) plus the system's derived tags. Reloading
 * an entry feeds its navStarData back through the deterministic resolver
 * (SystemResolver / the warp Priority-1 path), so a saved system reloads to the
 * IDENTICAL system — never a near-miss. We deliberately store the position
 * snapshot, NOT a bare seed: the bare-seed spawn path is lossy (it drops the
 * galaxy context that the generator needs to reproduce the system).
 *
 * Persistence is via a localStorage-like backend, injectable for testing
 * (defaults to the global localStorage in the browser). All access is guarded
 * so a missing/blocked/corrupt store degrades to an empty list rather than
 * throwing — matching the project's Settings.js convention.
 */

const STORAGE_KEY = 'well-dipper-saved-systems-v1';

/** Stable id for an entry, derived from its position snapshot (so re-saving
 * the same system upserts rather than duplicating). */
function entryId(navStarData) {
  const x = Number(navStarData.worldX).toFixed(5);
  const y = Number(navStarData.worldY).toFixed(5);
  const z = Number(navStarData.worldZ).toFixed(5);
  return `${navStarData.seed}@${x},${y},${z}`;
}

export class SavedSystems {
  /**
   * @param {{getItem,setItem,removeItem}} [storage] — defaults to globalThis.localStorage
   */
  constructor(storage = (typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined)) {
    this._storage = storage || null;
    this._entries = this._load();
  }

  _load() {
    if (!this._storage) return [];
    try {
      const json = this._storage.getItem(STORAGE_KEY);
      if (!json) return [];
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return []; // corrupt or unavailable
    }
  }

  _persist() {
    if (!this._storage) return;
    try {
      this._storage.setItem(STORAGE_KEY, JSON.stringify(this._entries));
    } catch {
      // full or blocked — keep in-memory copy, silently skip persistence
    }
  }

  /**
   * Save (upsert) a system.
   * @param {{ navStarData, tags, name? }} input
   * @returns {object} the stored entry
   */
  save({ navStarData, tags, name = null }) {
    const snapshot = {
      worldX: navStarData.worldX,
      worldY: navStarData.worldY,
      worldZ: navStarData.worldZ,
      seed: navStarData.seed,
      type: navStarData.type,
    };
    const id = entryId(snapshot);
    const entry = { id, navStarData: snapshot, tags, name, savedAt: Date.now() };
    const idx = this._entries.findIndex(e => e.id === id);
    if (idx >= 0) {
      // upsert: preserve original savedAt, take the newer name/tags
      entry.savedAt = this._entries[idx].savedAt;
      this._entries[idx] = entry;
    } else {
      this._entries.push(entry);
    }
    this._persist();
    return entry;
  }

  /** All saved entries (most-recently-saved last). */
  list() {
    return this._entries.slice();
  }

  /** Remove an entry by id. */
  remove(id) {
    const before = this._entries.length;
    this._entries = this._entries.filter(e => e.id !== id);
    if (this._entries.length !== before) this._persist();
  }

  /** Remove all saved systems. */
  clear() {
    this._entries = [];
    this._persist();
  }

  /**
   * Filter the saved list by tag (scalar equality on each filter key).
   * @param {object} filter — tag -> expected value
   * @returns {object[]} matching entries
   */
  filterByTag(filter = {}) {
    const keys = Object.keys(filter);
    return this._entries.filter(e =>
      keys.every(k => e.tags && e.tags[k] === filter[k])
    );
  }
}
