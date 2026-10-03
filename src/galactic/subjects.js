// subjects.js — which nebula the volume draws, the S1 test subjects, and the observer distance presets.
//
// Shared by the game (sky rebuild picks the feature; debug hooks place the observer) and the lab (feature
// picker, distance presets), so neither front end carries its own copy. Headless: no three.js.

import { featureKeyOf } from './featureHistory.js';

/** The feature the volume should draw from a findNearbyFeatures() list: the emission nebula you are inside
 *  (warping to a feature puts you at its centre), else the one with the largest angular size. */
export function pickVolumeFeature(features) {
  const nebulae = (features || []).filter((f) => f.type === 'emission-nebula');
  if (nebulae.length === 0) return null;
  const inside = nebulae.filter((f) => f.insideFeature);
  if (inside.length > 0) {
    return inside.reduce((best, f) => (f.distance / f.radius < best.distance / best.radius ? f : best));
  }
  const ang = (f) => f.radius / Math.max(f.distance, 1e-6);
  return nebulae.reduce((best, f) => (ang(f) > ang(best) ? f : best));
}

/** S1 test subjects, taken from the REAL GalacticMap records near a position (default: the Sun).
 *  procedural = the nearest procedurally placed emission nebula; orion = M42 from the known-object catalogue. */
export function findCloudSubjects(galacticMap, nearPos = galacticMap.getStartPosition(), searchKpc = 3.0) {
  const feats = galacticMap.findNearbyFeatures(nearPos, searchKpc);
  const procedural = feats.find((f) => f.type === 'emission-nebula' && !f.isKnownObject) || null;
  const orion = feats.find((f) => f.isKnownObject && f.knownProfile?.messier === 'M42') || null;
  return { procedural, orion };
}

/** Observer distance presets along one fixed direction from the nebula centre (pc from the centre). */
export const OBSERVER_PRESETS = [
  { name: '2000 pc', distancePc: 2000 },
  { name: '500 pc', distancePc: 500 },
  { name: '100 pc', distancePc: 100 },
  { name: '30 pc', distancePc: 30 },
  { name: 'edge', radiusFrac: 1.0 },
  { name: 'centre', radiusFrac: 0.0 },
];

export function presetDistancePc(preset, feature) {
  return preset.distancePc ?? preset.radiusFrac * feature.radius * 1000;
}

/** The fixed approach direction: from the nebula toward the Sun (so Orion is seen from Earth's side). */
export function approachDirection(feature, from = { x: 8.0, y: 0.025, z: 0.0 }) {
  const d = [from.x - feature.position.x, from.y - feature.position.y, from.z - feature.position.z];
  const len = Math.hypot(d[0], d[1], d[2]) || 1;
  return d.map((c) => c / len);
}

/** Galactic position (kpc) of an observer `distancePc` from the feature centre along the approach direction. */
export function observerPositionFor(feature, distancePc, dir = approachDirection(feature)) {
  const kpc = distancePc / 1000;
  return {
    x: feature.position.x + dir[0] * kpc,
    y: feature.position.y + dir[1] * kpc,
    z: feature.position.z + dir[2] * kpc,
  };
}

export { featureKeyOf };
