import * as THREE from 'three';
import { OrbitRingSDF } from './OrbitRingSDF.js';

/**
 * OrbitLine — a thin ring on the XZ plane showing a planet/moon/binary-star orbit.
 *
 * WAS a THREE.LineLoop (1-px LineBasicMaterial). As of orrery-entry-orbits-2026-07-20
 * AC5 it is an OrbitRingSDF-backed THREE.Mesh: an analytic coverage ring that no
 * longer vanishes prematurely in RetroRenderer's 1/3-res sceneTarget. The MODULE
 * PATH, CLASS NAME and CONSTRUCTOR SIGNATURE are unchanged, so every main.js call
 * site (`new OrbitLine(radius, colorHex)`) is a drop-in swap.
 *
 * This subclass exists to restore the two pieces of LineBasicMaterial/LineLoop
 * SURFACE that main.js consumers rely on but the raw SDF Mesh does not provide:
 *
 *   (1) material.color — the orbit-hover highlight (main.js ~:11127-11138) reads
 *       `material.color` (clone/copy/set) to swap the ring bright green and back.
 *       A ShaderMaterial has no `.color`; the SDF encodes color as the `uColor`
 *       uniform. We re-home that uniform's value onto a THREE.Color (three uploads
 *       Color→vec3 identically to the Vector3 it replaces) and surface it as
 *       `material.color`, so hover mutations flow straight into the shader with no
 *       main.js change and no throw.
 *
 *   (2) mesh.userData.orbitHitPositions — the screen-space orbit hit test
 *       (main.js hitTestOrbits) walks a geometry's position attribute for the
 *       nearest ring point to the cursor. The SDF render geometry is a full quad
 *       (4 corners), which would collapse hover/click-select to 4 diagonal points.
 *       We publish the TRUE ring perimeter (the same segment count the old LineLoop
 *       used) so hitTestOrbits stays pixel-identical. hitTestOrbits reads this
 *       attribute in preference to the quad geometry.
 *
 * The visibility factor (setVisibilityFactor / uVisFactor) and the opacity shim
 * both live in OrbitRingSDF and are inherited unchanged.
 */
export class OrbitLine extends OrbitRingSDF {
  constructor(radius, color = 0x00ff00) {
    super(radius, color);

    // (1) material.color parity for hover. Reconstruct the exact color the SDF
    // stored (OrbitRingSDF built its uColor from `new THREE.Color(color)`), make
    // it the uniform's value, and expose it as material.color.
    const mat = this.material;
    const c = new THREE.Color(color);
    mat.uniforms.uColor.value = c;
    Object.defineProperty(mat, 'color', {
      configurable: true,
      enumerable: true,
      get() { return c; },
      // Assigning material.color = X copies into the live uniform color; hover
      // only ever mutates the returned Color in place (.set/.copy), but support
      // direct assignment too for completeness.
      set(next) { c.copy(next); },
    });

    // (2) Ring-perimeter samples for hitTestOrbits (object space, XZ plane).
    // Same formula OrbitLine's LineLoop used: segments = max(128, ceil(√r × 32)).
    const segments = Math.max(128, Math.ceil(Math.sqrt(radius) * 32));
    const pts = new Float32Array(segments * 3);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts[i * 3] = Math.cos(a) * radius;
      pts[i * 3 + 1] = 0;
      pts[i * 3 + 2] = Math.sin(a) * radius;
    }
    this.mesh.userData.orbitHitPositions = new THREE.Float32BufferAttribute(pts, 3);
  }
}
