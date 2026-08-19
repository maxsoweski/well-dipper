/**
 * BodyMass — the ONE mass rule, shared by the physics and the renderer.
 *
 * ⭐ WHY THIS MODULE EXISTS. The barycentre render (docs/WORKSTREAMS/
 * binary-barycentre-render-2026-08-18/) has to know each moon's mass to place
 * the primary. If it computed mass its own way, the renderer and `GravityField`
 * would disagree about where the barycentre IS — the body would be drawn at one
 * point and its gravity would act from another. So the rule lives here and both
 * call it; `GravityField._estimateMoonMass` is now a delegate.
 *
 * The rule is transcribed from what that method COMPUTED, not from what the
 * docstring above it claimed. That docstring ("Moons don't have massEarth in
 * their data, so we estimate") is contradicted by its own first line.
 */
import { estimateMassEarth } from '../generation/PhysicsEngine.js';

/**
 * Mass of a moon in Earth masses.
 *
 * ⛔ Branch 1 is load-bearing and easy to mistake for dead code: a planet-class
 * moon's top-level `type` is a PLANET type, so rocky/ocean/ice all MISS the
 * terrestrial branch below. Without branch 1 the flight model gets a mass the
 * generator never chose.
 *
 * ⚠ Plain moons DO carry a generator-computed `massEarth`
 * (MoonGenerator.js:266) that this rule ignores in favour of the r^2.5
 * estimate. That is the shipped behaviour and it is deliberately preserved:
 * changing it moves the flight model, which is not this workstream. It is
 * measured — 502 of 521 moon-bearing planets in FENCE-221 would shift, worst
 * wd-165/2 from 1.32 to 2.32 primary radii — and filed against B5 step 9.
 */
export function moonMassEarth(moonData) {
  if (moonData.planetData?.massEarth != null) return moonData.planetData.massEarth;
  const r = moonData.radiusEarth ?? 0.01;
  if (moonData.type === 'terrestrial') return estimateMassEarth(r, 'rocky');
  // Regular and captured moons: lower density ice/rock mix, M ~ R^2.5.
  return Math.pow(r, 2.5) * 0.5;
}

/**
 * Mass of a planet in Earth masses.
 *
 * ⛔⛔ THE FALLBACK IS NOT OPTIONAL. `grep -c massEarth
 * src/generation/SolarSystemData.js` returns 0 — Sol carries no mass anywhere.
 * Drop the `??` arm and `M_total` becomes `undefined`, the barycentre offset
 * becomes NaN, and every planet in Sol takes its lighting, its moons, its rings
 * and its gravity to NaN with it. Invisible on every procedural seed, because
 * `PlanetGenerator` always writes `massEarth`.
 */
export function planetMassEarth(planetData) {
  return planetData.massEarth ?? estimateMassEarth(planetData.radiusEarth, planetData.type);
}
