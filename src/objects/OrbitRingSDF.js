import * as THREE from 'three';

/**
 * JS mirror of the GLSL proximity-fade envelope (round-3 staticky fix, 2026-07-21).
 * Exported so the unit suite and the orbit-lab instrument share ONE definition with
 * the shader — the envelope can't drift from its tests without a string-pin failing.
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
        // orrery-entry-orbits-2026-07-20 AC5 half (B): the LIVE AC3 orbit-visibility
        // factor. Multiplies the final alpha ORTHOGONALLY to uOpacity (hover) — see
        // gl_FragColor below. Defaults 1.0 so this uniform is a no-op until main.js
        // drives it via setVisibilityFactor(); the standalone orbit-lab (which never
        // calls the setter) renders byte-identically. Additive only — the SDF band
        // math and the 0.4R grazing cap are untouched.
        uVisFactor:  { value: 1.0 },
        // staticky-orbit fix (2026-07-20, UAT round 1): the ORRERY camera is never
        // still (autoRotateSpeed + player nav), so every intermediate-alpha pixel
        // the band produces crawls perpetually. Close to a planet the camera sits
        // nearly IN the orbit plane; fwidth(g) explodes and the 0.4R cap turns the
        // band into a huge dim world-space slab whose soft edges seethe — Max's
        // "staticky" (prod-measured: pixel ramps 102→0 over ~10 frames at
        // yaw drift 8.7e-4 rad/frame). Two knobs, both alpha-side only:
        //   uFeatherPx — soft-edge width in render px (was hardcoded 1.0). Smaller
        //                = crisper retro edge, fewer crawling mid-alpha pixels.
        // (The smear itself needs no knob: the raw-band discard in the fragment
        // shader is threshold-free — see the shader comment.)
        // Shipped default (lab matrix 2026-07-20): feather 0.5 — the 1.0px soft
        // skirt was ~half the crawling-pixel population; 0.5 keeps sub-pixel
        // coverage continuity (worst-case diagonal pixel-center distance 0.707px
        // < 0.5*width+feather = 1.0px) while restoring near-crisp retro pops.
        // 0.25 measured lower churn still but its coverage margin is 0.75px —
        // too tight to ship blind. Width + feather are Max's taste knobs at re-UAT.
        uFeatherPx:  { value: 0.5 },
        // Proximity fade (round-3 staticky fix, 2026-07-21 — Max-ratified after the
        // confirmed reproduction at 8715e27). The "mess" is the focused planet's OWN
        // orbit ring drawn from a camera standing ON its circle: near the ring's
        // on-screen horizon fwidth(g) explodes and the 1/3-res band test flips per
        // quad — torn slashes that seethe under the ORRERY's perpetual drift. No
        // alpha shaping fixes that regime (width 2.0 measured: fatter mess, same
        // tearing). So: fade a ring by the camera's 3D distance to ITS CIRCLE —
        // the line you stand on carries no information — and leave every far ring
        // (the AC5 chunky-retro look) untouched. Envelope mirrored in
        // proximityFadeFactor above; defaults validated by live mock with Max.
        // All three are his UAT taste knobs (setProximityFade).
        uProxNearAbs: { value: 0.35 },
        uProxNearRel: { value: 0.02 },
        uProxFarMul:  { value: 3.0 },
      },
      // Derivatives (fwidth) are core in WebGL2/GLSL-ES-3.0 (this codebase's
      // renderer); this flag makes the shader also valid on a WebGL1 fallback.
      extensions: { derivatives: true },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        uniform float uRadius;
        uniform float uProxNearAbs;
        uniform float uProxNearRel;
        uniform float uProxFarMul;
        varying vec3 vLocalPos;
        varying float vProxFade;
        void main() {
          // Object-space position. The mesh is only rotated/translated (never
          // scaled), so 1 object unit == 1 world unit and length(vLocalPos.xz)
          // is the true scene-unit radius at this fragment. Repositioning the
          // mesh (moon rings) moves the whole ring rigidly — geometry unchanged.
          vLocalPos = position;

          // Proximity fade: camera position in OBJECT space. Because the model
          // transform is rigid (pinned above — never scaled), undoing it is the
          // dot-product-by-columns form below — no ES-3.00-only matrix builtins,
          // which keeps this valid GLSL ES 1.00 on the WebGL1 fallback. The
          // factor is constant across the quad, so per-vertex + varying
          // interpolation is exact. Envelope mirrored in proximityFadeFactor.
          vec3 dWorld = cameraPosition - vec3(modelMatrix[3]);
          vec3 camObj = vec3(dot(modelMatrix[0].xyz, dWorld),
                             dot(modelMatrix[1].xyz, dWorld),
                             dot(modelMatrix[2].xyz, dWorld));
          float radial = length(camObj.xz) - uRadius;
          float circleDist = length(vec2(radial, camObj.y));
          float proxNear = max(uProxNearAbs, uProxNearRel * uRadius);
          vProxFade = smoothstep(proxNear, proxNear * uProxFarMul, circleDist);

          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: /* glsl */`
        #include <logdepthbuf_pars_fragment>
        uniform float uRadius;
        uniform vec3  uColor;
        uniform float uOpacity;
        uniform float uPixelWidth;
        uniform float uVisFactor;
        uniform float uFeatherPx;
        varying vec3 vLocalPos;
        varying float vProxFade;

        void main() {
          // Proximity fade floor: below the 8-bit quantization step the ring
          // contributes nothing — skip the band math entirely so a fully-faded
          // ring can't leave a residual seething contour.
          if (vProxFade < 0.004) discard;

          // staticky-orbit fix (2026-07-20): write LOG depth like every other
          // custom ShaderMaterial in this scene (WarpPortal/RingRenderer/Moon —
          // the renderer runs logarithmicDepthBuffer). Without this the band's
          // depth is standard NDC (~0.9999 at ORRERY scales) while planets write
          // log depth (~0.6): incommensurable values, so ring-vs-planet occlusion
          // was garbage. The old LineLoop was a BUILT-IN material and got the
          // chunks automatically — this regressed in the AC5 swap.
          #include <logdepthbuf_fragment>

          // Signed distance to the ideal circle, in scene units.
          float g = length(vLocalPos.xz) - uRadius;

          // fwidth(g) ~= how many scene units g changes across ONE render pixel
          // (derivatives are taken in the framebuffer currently being drawn —
          // here the 1/3-res sceneTarget). So abs(g)/fwidth(g) is the distance
          // from the ring measured in RENDER pixels. This is what makes the
          // band a constant ~1 render-px wide at every camera distance and why
          // it can never go dashed like a sampled LineLoop.
          float aaRaw = fwidth(g);
          float aa = aaRaw;

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

          // Band: solid within +-0.5*width, uFeatherPx soft edge. NearestFilter
          // then magnifies this back up to the chunky 3x retro block — but with
          // full coverage, which is exactly what the polyline lacked.
          float alpha = 1.0 - smoothstep(uPixelWidth * 0.5,
                                         uPixelWidth * 0.5 + uFeatherPx,
                                         distPx);

          // ── Smear cut (staticky-orbit fix) ──
          // The 0.4R clamp may only STABILIZE alpha inside the band — it must
          // never WIDEN coverage. Pixels that fail the UNCLAMPED screen-px band
          // test are painted purely by clamp over-paint: that is the wide dim
          // grazing smear whose soft level-sets crawl under the ORRERY's
          // perpetual camera motion — UAT round 1's "staticky". Discard them.
          // Threshold-free and scale-free: true horizon arcs and distant tiny
          // rings pass the raw test (that is WHY they are visible) and keep
          // rendering; only clamp-inflated smear pixels go. (A smooth fade
          // instead of a discard only relocates the crawling alpha contour —
          // lab-measured 2026-07-20, toggles unchanged under fade.)
          if (abs(g) / max(aaRaw, 1e-6) > uPixelWidth * 0.5 + uFeatherPx) discard;

          // Paint ONLY annulus pixels. Discarding elsewhere is essential: the
          // composite pass blends by sceneTarget alpha, so a full opaque quad
          // would black out the starfield behind the whole disc.
          if (alpha < 0.01) discard;

          // uVisFactor (AC3 shared factor) and uOpacity (hover) multiply into the
          // final alpha independently — orthogonal channels, per the ratified rule.
          gl_FragColor = vec4(uColor, alpha * uOpacity * uVisFactor * vProxFade);
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

  /**
   * orrery-entry-orbits-2026-07-20 AC5 half (B): drive the shared AC3 orbit-
   * visibility factor. Clamped to [0,1] and pushed into uVisFactor, which the
   * fragment shader multiplies into the final alpha alongside (and independently
   * of) the hover-owned uOpacity. main.js computes ONE factor per frame per system
   * (all orbits together) and calls this on every ring. Defaults to 1 (see uniform).
   * @param {number} f visibility factor in [0,1] (out-of-range values are clamped)
   */
  setVisibilityFactor(f) {
    this.material.uniforms.uVisFactor.value = Math.min(1, Math.max(0, f));
  }

  /**
   * Tune the proximity-fade envelope (round-3 staticky fix — Max's UAT taste
   * knobs). Partial updates: only the keys provided change. Non-finite or
   * non-positive values are ignored (farMul must additionally exceed 1, or the
   * smoothstep edges collapse).
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
