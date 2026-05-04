import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { simRandom } from '../core/SimRandom.js';

const SHIPS_BASE = 'assets/ships/';
const loader = new GLTFLoader();

// Cache loaded models so we don't fetch the same .glb twice
const modelCache = new Map();

let manifest = null;

/**
 * Loads the ship manifest (call once at startup).
 * Returns the manifest object, or null if no ships are available.
 */
export async function loadManifest() {
  if (manifest) return manifest;
  try {
    const resp = await fetch(SHIPS_BASE + 'manifest.json');
    if (!resp.ok) return null;
    manifest = await resp.json();
    return manifest;
  } catch {
    return null;
  }
}

/**
 * Returns array of archetype names that have at least one model.
 */
export function availableArchetypes() {
  if (!manifest) return [];
  return Object.keys(manifest).filter(k => manifest[k].length > 0);
}

/**
 * Returns count of models for a given archetype.
 */
export function modelCount(archetype) {
  if (!manifest || !manifest[archetype]) return 0;
  return manifest[archetype].length;
}

/**
 * Loads a .glb model and returns a cloned scene (Object3D).
 * Uses cache so repeated calls for the same file are instant.
 *
 * @param {string} archetype - e.g. 'fighters', 'cruisers'
 * @param {number} [index] - which model to load (default: random)
 * @param {function} [rng] - random function returning 0-1 (for seeded picks)
 * @returns {Promise<THREE.Object3D|null>}
 */
export async function loadShipModel(archetype, index, rng) {
  if (!manifest || !manifest[archetype] || manifest[archetype].length === 0) {
    return null;
  }

  const entries = manifest[archetype];
  if (index === undefined) {
    const r = rng ? rng() : simRandom();
    index = Math.floor(r * entries.length);
  }
  index = Math.min(index, entries.length - 1);

  const entry = entries[index];
  const url = SHIPS_BASE + entry.file;

  // Return cached clone if we already loaded this model
  if (modelCache.has(url)) {
    return modelCache.get(url).scene.clone();
  }

  try {
    const gltf = await loadGLTF(url);
    modelCache.set(url, gltf);
    return gltf.scene.clone();
  } catch (err) {
    console.warn(`Failed to load ship model: ${url}`, err);
    return null;
  }
}

function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}
