// src/rendering/objects/PlanetMoonBody.js
// ─────────────────────────────────────────────────────────────────────────────
// THE LOD-REGISTRABLE SHAPE FOR A PLANET-CLASS MOON.
//
// ⛔ WHY THIS FILE EXISTS, AND WHY "JUST MOVE THE register() CALL" IS THE WRONG FIX.
// `lodManager.register(moon)` sat inside the `else` arm of `if (moonData.isPlanetMoon)` in
// src/main.js — introduced that way in `4fe2dce` (2026-03-18), when the omission was invisible
// because that same commit says "LOD tier switching is a no-op until close-up detail shaders are
// built". It became a REAL loss on 2026-07-30 (`2b89132`), which added the octave ramp as one call
// site and one method on `BodyRenderer` — and the planet-class-moon branch has no BodyRenderer.
//
// But hoisting the call out of the `else` on its own THROWS, and throws in the worst place:
//   · src/rendering/LODManager.js:87 `const ratio = distance / Math.max(body.radius, 0.001);`
//     — the old wrapper carried `data.radius`, never `body.radius`, so ratio is NaN.
//   · src/rendering/LODManager.js:98 `body.setLOD(targetTier);`
//     — called UNCONDITIONALLY. Only `setReliefDetail` is optional-chained (`:102`). A wrapper with
//     no `setLOD` raises a TypeError inside the frame callback, and src/main.js:11348 already
//     records that a throw on this path "escapes before raf() is rescheduled and the render loop
//     stops permanently on a frozen frame while the caller has already reported success".
// So the missing SHAPE is upstream of the missing call, and the shape is what this module supplies.
//
// ⭐ A MODULE RATHER THAN FOUR MORE LINES INLINE IN main.js, for one reason that is not style: the
// gate. `tests/relief-octave-lod-ramp.test.js` cannot import `src/main.js`, so an inline literal is
// untestable and this fix would ship on an argument instead of on a red-then-green assertion. The
// shape was ALSO already being hand-duplicated in src/cockpit/__tests__/FocusedBody.test.js:153-156,
// so a module removes a copy rather than adding one.
//
// ⚠ POPULATION, so nobody sizes this against the one body it was found on: 48 of 1475 moons over
// 400 generated seeds (3.25% of moons, 1.5% of all bodies), across 43 of 400 systems, at most 2 per
// system — plus Titan, the only hand-authored one. `lab-procedural-6` has TWO (p=3 m=4 ice, and
// p=5 m=2 rocky, the body measured live at 4.00 octaves where the law predicts 8.72).
// ⚠ AND THEY ARE NOT ALL ON ONE MATERIAL: 11 of the 48 are claimed by giantDeck+limbDeck+polarDeck
// and, with `wd.labGasBodies` ON, render on the LAB material — whose octave uniform is `uOctaves`,
// not `uReliefOctaves`. That is exactly why the ramp is applied through the shared
// `applyReliefDetail`, which writes BOTH spellings, instead of through a local uniform poke.
// ─────────────────────────────────────────────────────────────────────────────
import { applyReliefDetail } from './BodyRenderer.js';

/**
 * Wrap a planet-class moon's `Planet` in the interface `LODManager` requires.
 *
 * @param {import('../../objects/Planet.js').Planet} planetMoon the real Planet backing this moon
 * @param {object} moonData the moon record (carries `radiusScene`, `orbitRadiusScene`, `startAngle`)
 * @returns {object} the `moons[]` entry — the pre-existing members are unchanged, four are added
 */
export function createPlanetMoonBody(planetMoon, moonData) {
  return {
    // ── unchanged from the inline literal this replaces ──
    mesh: planetMoon.mesh,
    data: { ...moonData, radius: moonData.radiusScene, orbitRadius: moonData.orbitRadiusScene },
    isPlanetMoon: true,
    planet: planetMoon,
    orbitAngle: moonData.startAngle,
    addTo(s) { s.add(planetMoon.mesh); },
    dispose() { planetMoon.dispose(); },

    // ── the four members LODManager needs ──
    // ⚠ `radius` is a SIBLING of `data.radius`, not a replacement for it. LODManager reads
    // `body.radius` (:87) while every other consumer in main.js reads `moon.data.radius`; giving
    // only one of them would move a body that is currently correct.
    radius: moonData.radiusScene,

    // ⛔ DELIBERATELY A NO-OP, AND THAT IS THE CONSERVATIVE CHOICE, NOT AN OVERSIGHT.
    // LODManager calls this unconditionally with a tier of 0/1/2. A planet-class moon has no
    // billboard/orbital/close-up mesh set to switch between — `BodyRenderer`'s tiering is what owns
    // that, and this body has no BodyRenderer. Implementing real tier switching here would be a
    // VISIBLE behaviour change (bodies popping to billboards at range) well beyond restoring the
    // octave ramp, and it would ship inside a fix nobody UAT'd for it. The no-op preserves exactly
    // today's tiering behaviour — which is "none" — while letting registration happen at all.
    setLOD() {},

    // The whole point of registering. Same law, same function, same two spellings as every
    // BodyRenderer body — see the ⭐ on `applyReliefDetail`.
    setReliefDetail(distanceRadii, cameraWorldPos) {
      applyReliefDetail(planetMoon.surface || planetMoon.mesh, distanceRadii, cameraWorldPos);
    },
  };
}
