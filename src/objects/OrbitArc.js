import * as THREE from 'three';

/**
 * OrbitArc — the component's own giant barycentric orbit, rendered as an
 * OPEN near-arc (BN3 of multistar-component-travel-2026-07-21, AC6).
 *
 * Consumes a spec from `src/generation/componentOrbit.js`
 * (deriveComponentOrbitSpec): vertex positions in COMPONENT-LOCAL
 * coordinates + a per-vertex edge-fade profile. The class is presentation
 * only — geometry math lives in the pure helper.
 *
 * Why not OrbitLine: OrbitLine builds a full LineLoop circle sized by its
 * segment formula — at a component-orbit radius (13e6 scene units for
 * Proxima) that means ~115k vertices, float32 jitter bigger than an M-dwarf,
 * and a closed loop whose far side would draw a chord across the sky. The
 * arc keeps vertices small and near the local origin; a THREE.Line (open)
 * never closes the loop.
 *
 * Far-plane edge treatment: the spec's fade profile becomes per-vertex ALPHA
 * (RGBA color attribute → three.js USE_COLOR_ALPHA path), so the arc melts
 * out before the camera far plane clips it instead of ending in a hard,
 * bug-looking edge.
 *
 * Contract parity with OrbitLine — `mesh` / `addTo(scene)` / `dispose()` —
 * so the eventual spawnSystem consumption (GB6, gated) is a drop-in next to
 * the binary starOrbitLines block: construct via the helper,
 * _placeInRebasedFrame(arc.mesh), push into system.starOrbitLines, and the
 * existing toggle/visibility/removal/disposal paths handle it for free.
 */
export class OrbitArc {
  /**
   * @param {object} spec — deriveComponentOrbitSpec() result (non-null).
   * @param {number} color — line color (binary star orbit green by default).
   */
  constructor(spec, color = 0x00dd00) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(spec.positions, 3));

    // RGBA per-vertex color: constant base color, alpha = the spec's edge
    // fade. itemSize 4 flips three.js into vertex-alpha mode, so the faded
    // ends are genuinely transparent (no dark occluding line over the
    // starfield, which a color-to-black fade with normal blending would give).
    const base = new THREE.Color(color);
    const rgba = new Float32Array(spec.vertexCount * 4);
    for (let i = 0; i < spec.vertexCount; i++) {
      rgba[i * 4] = base.r;
      rgba[i * 4 + 1] = base.g;
      rgba[i * 4 + 2] = base.b;
      rgba[i * 4 + 3] = spec.fades[i];
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(rgba, 4));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8, // matches OrbitLine's presentation; final alpha = 0.8 × fade
    });

    // OPEN arc — THREE.Line, deliberately never LineLoop.
    this.mesh = new THREE.Line(geometry, material);
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
