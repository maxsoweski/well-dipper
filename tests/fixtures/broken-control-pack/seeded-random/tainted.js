// tests/fixtures/broken-control-pack/seeded-random/tainted.js
//
// ⛔⛔ THIS FILE IS BROKEN ON PURPOSE. DO NOT "FIX" IT. DO NOT MOVE IT UNDER src/.
//
// It is the executed control for one-pipeline-fence registration 5 — "no `SeededRandom` under
// `src/worldengine/`". A fence that has only ever been seen to pass is worthless; this file is what
// proves registration 5 can go red, and the control asserts the fence names THIS PATH in its message.
//
// Why the hazard is real and not hypothetical: `conditionFromBody` runs INSIDE the rng-consuming
// region of `PlanetGenerator.generate` (called at :726, while `noiseDetail: rng.range(0.3, 0.8)` is
// drawn at :780). A worldengine module that touched the seeded stream would shift every draw after
// it, changing bodies that have nothing to do with the edit.
import { SeededRandom } from '../../../../src/generation/SeededRandom.js';

export function tainted(seed) {
  const rng = new SeededRandom(seed);
  return rng.range(0.3, 0.8);
}
