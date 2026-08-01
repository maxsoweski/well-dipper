/**
 * reticleOcclusion — can the pilot actually SEE that body, or is there cockpit
 * in the way?
 *
 * Lane F, from Max in UAT 2026-08-01: *"the reticles on the hud that go around
 * worlds/stars in-game are still not being occluded by the monitors/monitor
 * arms, fuselage, or ribs as they should be."*
 *
 * ── WHY THE EXISTING TEST CANNOT ANSWER THIS ────────────────────────────────
 *
 * `main.js`'s `_isReticleOccluded` is an analytic ray/SPHERE test against a list
 * of `{mesh, radius}` rebuilt every frame in the LOD loop. That is exactly right
 * for its subject: planets, moons and stars are spheres, and there are a handful
 * of them. A cockpit is neither — it is 782 faces of ribs, booms, bezels and
 * hull, and no union of spheres describes a monitor arm.
 *
 * So this module does the other thing: a real ray/triangle cast against the
 * cockpit's own geometry. That is affordable here and would not be against the
 * world — the whole cabin is 782 faces, and the number of reticles on screen is
 * a handful. Measured cost is recorded in the commit; if it ever stops being
 * negligible the fix is a coarse proxy hull, not a different algorithm.
 *
 * ── THE COORDINATE TRICK, WHICH IS THE WHOLE OF THE MATH ────────────────────
 *
 * The cockpit is rendered by its OWN camera, in its OWN space — the cabin never
 * enters the world scene, and the ship's heading deliberately never reaches the
 * cockpit camera (`b5e0d30`: a 119° turn swung the whole cabin around the
 * pilot). So a world position cannot simply be raycast against cockpit meshes;
 * they do not share a frame and never will.
 *
 * What they DO share is the SCREEN. Two passes composite into one image, so a
 * cockpit feature and a world body land on the same pixel exactly when their
 * directions in their respective CAMERA-LOCAL frames agree. That is the whole
 * correspondence, and it is why this module converts a direction rather than a
 * position:
 *
 *     world dir → world camera's local frame → cockpit camera's world frame
 *
 * Deliberately NOT via NDC. Going through screen coordinates would make the
 * result depend on both projection matrices agreeing about aspect and near
 * plane, and would silently produce a plausible wrong answer when they did not.
 * A direction in view space is the invariant; the projections then only have to
 * agree about FIELD OF VIEW for the composite image itself to line up, which is
 * a rendering property this module does not own and cannot fix.
 *
 * ⚠ AND THE FOV DID NOT AGREE. `applySettingChange('fov')` wrote `camera.fov`
 * and never touched the cockpit camera, which is pinned at `EYE_FOV`. At the
 * default 70 they match and nothing looks wrong; move the slider and the two
 * passes disagree about where everything is. That is fixed at the setting, not
 * here — but it is written down here because this module is the first thing
 * that would have been quietly, un-debuggably wrong because of it.
 */

/**
 * The cockpit meshes a reticle can hide behind.
 *
 * ⭐ EVERYTHING OPAQUE, AND THE GLASS IS THE ONLY EXCLUSION. That is not a
 * simplification — the canopy is a VAULT that wraps the pilot and covers 97.4%
 * of the sphere (`cockpit-metrics.json`, `enclosure.sphereFraction`), so
 * including it would occlude every reticle in the game except through one
 * forward aperture. CockpitRig's own header records finding exactly that by
 * raycasting a grid through the scene: *"`Canopy_Glass` was the occluder for
 * every sample outside one central pinhole."* The generator agrees in writing —
 * `excludedFromOcclusion: true`, *"see-through by design"*.
 *
 * ⚠ TWO DISCRIMINATORS, UNIONED, BECAUSE NEITHER IS SAFE ALONE:
 *
 *   `glassNodes` is the rig's census by NAME (`/glass|canopy/i`). It is the only
 *     one that works when the glass treatment is switched off, which leaves
 *     `glassMats` empty — and an empty exclusion set there does not degrade, it
 *     occludes everything.
 *   `glassMats` is the set of materials the rig actually made transparent. It is
 *     the only one that catches a see-through mesh whose name says neither
 *     "glass" nor "canopy".
 *
 * ⚠ THE TRAP THIS LEAVES, stated because the test guards it rather than the
 * code: `/glass|canopy/i` also matches an OPAQUE part named `Canopy_*` — the
 * `Canopy_Frame` band, if it is ever reinstated. Such a part would be silently
 * excluded and reticles would draw straight through it, which is the very
 * defect this module exists to fix, arriving through the fix. The census test
 * pins the excluded names, so a new one turns it red rather than invisible.
 *
 * @param {object|null} model the rig's loaded GLB root
 * @param {{glassNodes?: Array, glassMats?: Set}} [rig] the rig's own census
 * @returns {Array} the meshes to cast against, in traversal order
 */
export function collectReticleOccluders(model, { glassNodes = [], glassMats = null } = {}) {
  if (!model || typeof model.traverse !== 'function') return [];

  // Every node at or under a glass node, resolved up front. A glass node is a
  // GROUP in the general case, so testing the node itself is not enough — the
  // meshes that actually carry the panes are its children.
  const glassSubtree = new Set();
  for (const n of glassNodes) {
    if (n && typeof n.traverse === 'function') n.traverse((o) => glassSubtree.add(o));
    else if (n) glassSubtree.add(n);
  }

  const out = [];
  model.traverse((o) => {
    if (!o || !o.isMesh) return;
    if (glassSubtree.has(o)) return;
    if (glassMats && _anyMaterialIn(o.material, glassMats)) return;
    out.push(o);
  });
  return out;
}

function _anyMaterialIn(material, set) {
  if (!material) return false;
  if (Array.isArray(material)) return material.some((m) => m && set.has(m));
  return set.has(material);
}

/**
 * Point `out` along the ray that, in the COCKPIT's frame, lands on the same
 * pixel the reticle is drawn at.
 *
 * Returns null when the target is at or behind the eye — there is no reticle to
 * occlude there, and a behind-the-camera ray would cheerfully report the aft
 * bulkhead as an occluder for something that was never on screen.
 *
 * ⚠ `out` IS RETURNED, NOT ALLOCATED. This runs once per reticle per frame and
 * the caller owns a scratch vector; a `new Vector3()` here is per-frame garbage
 * in a function whose entire justification is that it is cheap.
 *
 * @param {object} out a THREE.Vector3 to write the direction into
 * @param {object} targetPos the body's WORLD position
 * @param {object} worldCamera the camera the reticle was projected with
 * @param {object} cockpitCamera the camera the cabin is drawn with
 * @returns {object|null} `out`, normalised, or null if there is nothing to test
 */
export function reticleDirInCockpit(out, targetPos, worldCamera, cockpitCamera) {
  if (!out || !targetPos || !worldCamera || !cockpitCamera) return null;

  out.set(
    targetPos.x - worldCamera.position.x,
    targetPos.y - worldCamera.position.y,
    targetPos.z - worldCamera.position.z,
  );
  const len = out.length();
  if (!(len > 1e-9)) return null;
  out.divideScalar(len);

  // Into the world camera's local frame. `applyQuaternion` with the conjugate
  // is the inverse rotation for a UNIT quaternion, which a camera's always is —
  // and it avoids allocating an inverted copy every call.
  _conj(_q, worldCamera.quaternion);
  out.applyQuaternion(_q);

  // Behind the eye. three's cameras look down LOCAL -Z, so a positive z here is
  // a body the pilot has flown past.
  if (out.z >= 0) return null;

  // …and back out into the cockpit camera's world frame, which is a different
  // world from the one we started in and is exactly the point.
  return out.applyQuaternion(cockpitCamera.quaternion);
}

/**
 * Scratch conjugate, module-scoped for the same no-garbage reason.
 *
 * A PLAIN OBJECT, and deliberately: `Vector3.applyQuaternion` reads only x/y/z/w
 * off what it is handed, so this module needs no `three` import at all — which
 * is what lets its whole contract be tested without a WebGL context.
 */
const _q = { x: 0, y: 0, z: 0, w: 1 };
function _conj(dst, q) {
  dst.x = -q.x; dst.y = -q.y; dst.z = -q.z; dst.w = q.w;
  return dst;
}
