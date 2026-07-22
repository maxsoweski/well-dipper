import * as THREE from 'three';

// ── orbit-ring-conic Slice D: the OrbitConicField is the unconditional ring renderer ──
//
// ORBIT_PROXY_LAYER is the dedicated non-rendered layer every per-ring OrbitRingSDF
// proxy lives on. The ORRERY/HELM camera's mask is the default (layer 0 only), so the
// camera draws NONE of these proxies — all orbit rings are painted by the single
// OrbitConicField fullscreen pass (AC9). Each proxy mesh STAYS a scene child (world-
// origin rebasing keeps its transform aligned — BUILD-PLAN D-1) and carries the live
// transform + the hit-position samples; `.mesh.visible` carries LOGICAL visibility
// (hitTestOrbits + the field's per-ring active flag), never draw state.
//
// Slice D deleted the USE_CONIC_FIELD switchover flag AND the legacy self-rendering SDF
// path (the shader strip) once the live battery went green at 47ca81f: the field is now
// the unconditional renderer, the proxy layer assignment is unconditional, and rollback
// is a git revert of the Slice-D commit (planned + acceptable).
export const ORBIT_PROXY_LAYER = 10; // camera default mask (layer 0) excludes it

/**
 * JS mirror of the proximity-fade envelope (round-3 staticky fix, 2026-07-21).
 * Exported so the unit suite, the OrbitConicField CPU adapter, and the orbit-lab
 * instrument share ONE definition — the envelope can't drift without a test failing.
 * The OrbitConicField reads it per frame (CPU-side, updateFromSystem) to fold the
 * proximity channel into each ring's descriptor alpha.
 *
 *   near = max(nearAbs, nearRel * radius)   — absolute floor for moon-scale rings,
 *                                             relative term for star-scale rings
 *   far  = near * farMul
 *   returns smoothstep(near, far, circleDist)
 *
 * @param {number} circleDist 3D distance from the camera to the ring's CIRCLE (not
 *                            its center): hypot(length(camLocal.xz) - R, camLocal.y)
 * @param {number} radius     ring radius in scene units
 * @param {object} [cfg]      {nearAbs=0.35, nearRel=0.02, farMul=3.0} — UAT taste knobs
 * @returns {number} fade factor in [0,1]; 0 standing on the circle, 1 far away
 */
export function proximityFadeFactor(circleDist, radius, { nearAbs = 0.35, nearRel = 0.02, farMul = 3.0 } = {}) {
  const near = Math.max(nearAbs, nearRel * radius);
  const far = near * farMul;
  const t = Math.min(1, Math.max(0, (circleDist - near) / (far - near)));
  return t * t * (3 - 2 * t);
}

/**
 * OrbitRingSDF — a per-ring TRANSFORM PROXY + PARAM BAG for the OrbitConicField.
 *
 * WHAT THIS IS NOW (orbit-ring-conic Slice D)
 * -------------------------------------------
 * This class no longer renders anything. The OrbitConicField (one fullscreen pass)
 * paints every orbit ring's screen-space conic. Each OrbitRingSDF is the per-ring
 * hook the field reads once per frame:
 *   - `.mesh` — a THREE.Mesh (placeholder geometry) kept as a scene child on
 *     ORBIT_PROXY_LAYER so world-origin rebasing keeps its transform aligned (D-1)
 *     while the camera draws none of it. It also carries
 *     `userData.orbitHitPositions` (published by the OrbitLine subclass) for the
 *     screen-space hit test. `.mesh.visible` carries LOGICAL visibility only.
 *   - `.material` — a minimal ShaderMaterial kept ONLY as the field's PARAM BAG: the
 *     field reads uColor / uOpacity / uVisFactor + the three prox uniforms per frame
 *     and folds them into that ring's descriptor. It has NO shaders, so it never
 *     compiles or draws; it stays a ShaderMaterial so `.uniforms`, the opacity shim,
 *     and the `instanceof ShaderMaterial` swap-test surface remain valid.
 *
 * WHY THE SELF-RENDERING SDF PATH IS GONE
 * ---------------------------------------
 * Through orrery-entry-orbits-2026-07-20 this class drew a full-quad analytic
 * coverage band to beat the 1/3-res LineLoop dropout. orbit-ring-conic replaced that
 * plane-domain band with the screen-space conic + Sampson field (dig-proven), which
 * renders "wherever LineLoop drew a line" INCLUDING the ring's own plane — the dead
 * zone the plane-domain band could not cover, which was the whole point. Slice C
 * wired the field behind USE_CONIC_FIELD (legacy SDF render retained-but-dormant);
 * Slice D, on a green live battery, deleted the flag + the SDF render shaders. The
 * field is the unconditional renderer.
 *
 * PUBLIC SURFACE — unchanged for main.js + the field + the OrbitLine subclass:
 *   new OrbitRingSDF(radius, color)
 *   .mesh (THREE.Mesh, scene child, ORBIT_PROXY_LAYER) / .mesh.visible / .mesh.position
 *   .material (ShaderMaterial param bag) / .material.opacity accessor / .material.uniforms.*
 *   .radius / .addTo(scene) / setVisibilityFactor / setProximityFade / .dispose()
 *
 * OPACITY SHIM
 * ------------
 * main.js hover reads `material.opacity` (→ _origOpacity), writes 1.0, restores it.
 * ShaderMaterial's plain `.opacity` field never reaches the field, so we back
 * `material.opacity` with the uOpacity uniform (which the field DOES read). Reading
 * returns the current uniform (0.8 default → _origOpacity captures 0.8); writing 1.0
 * flows into the field's next descriptor. No main.js change.
 */
export class OrbitRingSDF {
  /**
   * @param {number} radius  orbit radius in scene units (XZ plane, centered on mesh origin)
   * @param {number} color   ring color (default 0x00ff00, matching planet OrbitLines)
   */
  constructor(radius, color = 0x00ff00) {
    this.radius = radius;

    const col = new THREE.Color(color);
    // PARAM BAG only — the OrbitConicField reads these uniforms per frame
    // (updateFromSystem) and owns all rendering. No vertex/fragment shader: this
    // material never compiles or draws. Kept a ShaderMaterial so `.uniforms`, the
    // opacity shim, and the `instanceof ShaderMaterial` swap-test surface stay valid.
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor:      { value: new THREE.Vector3(col.r, col.g, col.b) },
        uOpacity:    { value: 0.8 },          // matches OrbitLine's default opacity
        // The LIVE AC3 orbit-visibility factor (main.js drives it via
        // setVisibilityFactor). The field folds it into descriptor alpha with
        // uOpacity (hover) and the proximity channel. Defaults 1.0 (no-op until driven).
        uVisFactor:  { value: 1.0 },
        // Proximity-fade envelope knobs — read CPU-side by the field
        // (proximityFadeFactor, above) to fold the proximity channel into descriptor
        // alpha. Mock-validated defaults; Max's UAT taste knobs (setProximityFade).
        uProxNearAbs: { value: 0.35 },
        uProxNearRel: { value: 0.02 },
        uProxFarMul:  { value: 3.0 },
      },
    });

    // ── OPACITY SHIM (see class doc) ──
    // Back material.opacity with the uOpacity uniform so main.js's hover read/write
    // (0.8 <-> 1.0) drives the field's per-frame descriptor with zero call-site change.
    Object.defineProperty(material, 'opacity', {
      configurable: true,
      enumerable: true,
      get() { return material.uniforms.uOpacity.value; },
      set(v) { material.uniforms.uOpacity.value = v; },
    });

    this.material = material;

    // Placeholder geometry: the mesh renders nothing (it is the transform proxy +
    // hit-position carrier). An empty BufferGeometry keeps .dispose() valid and
    // allocates no vertex data.
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    // Never rendered (proxy layer), so culling is moot; false is cheap insurance
    // against a future layer flip triggering an empty-geometry boundingSphere warning.
    this.mesh.frustumCulled = false;

    // The field is the unconditional renderer: always suppress this proxy's own draw
    // by putting it on ORBIT_PROXY_LAYER (a layer the ORRERY/HELM camera does not
    // include). The mesh STAYS a scene child (rebasing — D-1) and `.mesh.visible`
    // stays free to carry LOGICAL visibility; only the render list skips it.
    this.mesh.layers.set(ORBIT_PROXY_LAYER);
  }

  /** Match OrbitLine.addTo — add the mesh to a scene/group (stays a scene child, D-1). */
  addTo(scene) {
    scene.add(this.mesh);
  }

  /**
   * Drive the shared AC3 orbit-visibility factor. Clamped to [0,1] and pushed into
   * uVisFactor, which the field reads (with uOpacity + the proximity channel) into
   * the ring's descriptor alpha. main.js computes ONE factor per frame per system
   * (all orbits together) and calls this on every ring. Defaults to 1 (see uniform).
   * @param {number} f visibility factor in [0,1] (out-of-range values are clamped)
   */
  setVisibilityFactor(f) {
    this.material.uniforms.uVisFactor.value = Math.min(1, Math.max(0, f));
  }

  /**
   * Tune the proximity-fade envelope (Max's UAT taste knobs). Partial updates: only
   * the keys provided change. Non-finite or non-positive values are ignored (farMul
   * must additionally exceed 1, or the smoothstep edges collapse). The field reads
   * these uniforms per frame via proximityFadeFactor.
   * @param {object} [cfg] {nearAbs?, nearRel?, farMul?}
   */
  setProximityFade({ nearAbs, nearRel, farMul } = {}) {
    const u = this.material.uniforms;
    if (Number.isFinite(nearAbs) && nearAbs > 0) u.uProxNearAbs.value = nearAbs;
    if (Number.isFinite(nearRel) && nearRel > 0) u.uProxNearRel.value = nearRel;
    if (Number.isFinite(farMul) && farMul > 1) u.uProxFarMul.value = farMul;
  }

  /** Match OrbitLine.dispose — free GPU resources. */
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
