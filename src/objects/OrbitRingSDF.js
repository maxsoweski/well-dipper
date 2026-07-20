import * as THREE from 'three';

/**
 * OrbitRingSDF — an analytic, coverage-based replacement for OrbitLine.
 *
 * WHY THIS EXISTS (orrery-entry-orbits-2026-07-20, AC5)
 * -----------------------------------------------------
 * OrbitLine is a THREE.LineLoop (1-px LineBasicMaterial) rendered into
 * RetroRenderer's 1/3-resolution sceneTarget (pixelScale 3, NearestFilter,
 * antialias:false). A polyline sampled into a low-res, no-AA target goes
 * dashed and then invisible once its projected arc-length-per-render-pixel
 * drops under ~1 — so rings "vanish" while the camera is still close. That
 * is the bug this class removes.
 *
 * THE FIX
 * -------
 * Instead of drawing an outline that gets sampled, we draw a full quad that
 * COVERS the whole disc and, in the fragment shader, paint EVERY render pixel
 * whose distance to the ideal circle falls inside a constant ~1 render-pixel
 * band. Because coverage is decided per fragment (not by sampling a polyline),
 * the ring can never go dashed: any pixel the annulus touches is painted. The
 * band width is held constant in RENDER pixels via screen-space derivatives
 * (fwidth), so the ring stays ~1 render-px wide at ANY camera distance — which
 * keeps the chunky retro look while killing the premature dropout.
 *
 * DELIBERATELY a flat quad (PlaneGeometry), NOT a thin RingGeometry annulus:
 * a tessellated annulus would re-introduce the very vertex sampling we are
 * escaping. The quad is the SDF domain; the circle is evaluated analytically.
 *
 * PUBLIC SURFACE — matches OrbitLine so main.js is a drop-in swap:
 *   new OrbitRingSDF(radius, color)   — same constructor inputs
 *   .mesh                             — THREE.Mesh added to a parent group
 *   .mesh.visible                     — toggled by _applyOrbitVisibility
 *   .mesh.material.opacity            — hover swaps 0.8 <-> 1.0 (see shim below)
 *   .mesh.position                    — settable per-frame (moon rings)
 *   .radius                           — exposed for callers
 *   .addTo(scene) / .dispose()        — same helpers as OrbitLine
 *
 * OPACITY SHIM
 * ------------
 * ShaderMaterial ignores the plain `.opacity` field when rendering (opacity
 * only reaches the shader through a uniform). But main.js's hover code does
 * `newHover._origOpacity = newHover.material.opacity` (READ) then
 * `newHover.material.opacity = 1.0` (WRITE), and restores it later. To keep
 * that working unchanged we redefine `material.opacity` as an accessor backed
 * by the uOpacity uniform (Object.defineProperty). Reading returns the current
 * uniform value (0.8 by default → _origOpacity captures 0.8); writing 1.0
 * pushes straight into the shader. No main.js change required.
 */
export class OrbitRingSDF {
  /**
   * @param {number} radius  orbit radius in scene units (XZ plane, centered on mesh origin)
   * @param {number} color   ring color (default 0x00ff00, matching planet OrbitLines)
   * @param {object} [opts]
   * @param {number} [opts.pixelWidth=1.0]  target band width in RENDER pixels
   * @param {number} [opts.pad]             extra quad margin beyond radius (world units)
   */
  constructor(radius, color = 0x00ff00, { pixelWidth = 1.0, pad = null } = {}) {
    this.radius = radius;

    // The quad must be a little larger than the orbit so the ~1px band (plus
    // grazing-angle slack) always has geometry underneath it. A tiny relative
    // pad is enough because the band is pixel-thin, not world-thin.
    const p = pad ?? Math.max(radius * 0.02, 2.0);
    const size = 2 * (radius + p);                 // FULL quad — not an annulus

    const geometry = new THREE.PlaneGeometry(size, size);
    // PlaneGeometry lies in XY; bake a rotation so it lies flat in world XZ,
    // exactly like OrbitLine's circle. After this, object-space `position` is
    // (x, 0, z) and length(position.xz) is the radius at that fragment.
    geometry.rotateX(-Math.PI / 2);

    const col = new THREE.Color(color);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uRadius:     { value: radius },
        uColor:      { value: new THREE.Vector3(col.r, col.g, col.b) },
        uOpacity:    { value: 0.8 },          // matches OrbitLine's default opacity
        uPixelWidth: { value: pixelWidth },   // constant band width, in render px
      },
      // Derivatives (fwidth) are core in WebGL2/GLSL-ES-3.0 (this codebase's
      // renderer); this flag makes the shader also valid on a WebGL1 fallback.
      extensions: { derivatives: true },
      vertexShader: /* glsl */`
        varying vec3 vLocalPos;
        void main() {
          // Object-space position. The mesh is only rotated/translated (never
          // scaled), so 1 object unit == 1 world unit and length(vLocalPos.xz)
          // is the true scene-unit radius at this fragment. Repositioning the
          // mesh (moon rings) moves the whole ring rigidly — geometry unchanged.
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uRadius;
        uniform vec3  uColor;
        uniform float uOpacity;
        uniform float uPixelWidth;
        varying vec3 vLocalPos;

        void main() {
          // Signed distance to the ideal circle, in scene units.
          float g = length(vLocalPos.xz) - uRadius;

          // fwidth(g) ~= how many scene units g changes across ONE render pixel
          // (derivatives are taken in the framebuffer currently being drawn —
          // here the 1/3-res sceneTarget). So abs(g)/fwidth(g) is the distance
          // from the ring measured in RENDER pixels. This is what makes the
          // band a constant ~1 render-px wide at every camera distance and why
          // it can never go dashed like a sampled LineLoop.
          float aa = fwidth(g);

          // ── Grazing-angle clamp ──
          // When the camera sits nearly IN the orbit plane, the plane is almost
          // edge-on to the view ray: g changes enormously across one pixel and
          // fwidth(g) blows up, which would let a huge world-space band satisfy
          // the pixel test and SMEAR the fill across the whole annulus. Clamp aa
          // so the band can never flood the disc. The cap must stay ABOVE R/3:
          // at the AC3 fade threshold the outermost ring is ~3 render px in
          // radius, where a legitimate (non-grazing) fwidth reaches ~R/3 — a
          // tighter cap (0.03R, first draft) strangled distant mid rings into
          // the same dashes the SDF exists to kill (orbit-lab regression,
          // 2026-07-20). 0.4R keeps the worst grazing smear a bounded annulus
          // (inner 60% of the disc never floods) while every ring the AC3
          // factor wants visible stays paintable.
          float aaMax = max(uRadius * 0.4, 1e-4);
          aa = clamp(aa, 1e-6, aaMax);

          float distPx = abs(g) / aa;                 // render-pixels from centerline

          // Band: solid within +-0.5*width, ~1px soft edge. NearestFilter then
          // magnifies this back up to the chunky 3x retro block — but with full
          // coverage, which is exactly what the polyline lacked.
          float alpha = 1.0 - smoothstep(uPixelWidth * 0.5,
                                         uPixelWidth * 0.5 + 1.0,
                                         distPx);

          // Paint ONLY annulus pixels. Discarding elsewhere is essential: the
          // composite pass blends by sceneTarget alpha, so a full opaque quad
          // would black out the starfield behind the whole disc.
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(uColor, alpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: true,          // like OrbitLine (LineBasicMaterial default)
      depthTest: true,
      side: THREE.DoubleSide,
    });

    // ── OPACITY SHIM (see class doc) ──
    // Back material.opacity with the uOpacity uniform so main.js's hover
    // read/write (0.8 <-> 1.0) drives the shader with zero call-site changes.
    Object.defineProperty(material, 'opacity', {
      configurable: true,
      enumerable: true,
      get() { return material.uniforms.uOpacity.value; },
      set(v) { material.uniforms.uOpacity.value = v; },
    });

    this.material = material;
    this.mesh = new THREE.Mesh(geometry, material);
    // The quad's bounding sphere is huge and centered on the star; leave it
    // always-drawn so panning never culls a ring that should be visible (the
    // fragment discard keeps off-band pixels cheap). Mirrors the intent that
    // orbit visibility is owned by _applyOrbitVisibility, not frustum culling.
    this.mesh.frustumCulled = false;
  }

  /** Match OrbitLine.addTo — add the mesh to a scene/group. */
  addTo(scene) {
    scene.add(this.mesh);
  }

  /** Match OrbitLine.dispose — free GPU resources. */
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
