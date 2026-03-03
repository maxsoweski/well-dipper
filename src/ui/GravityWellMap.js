import * as THREE from 'three';

/**
 * GravityWellMap — 3D gravity well visualization for the HUD minimap.
 *
 * Combines vertex displacement (3D bowl shape) with fragment-shader
 * contour lines (clear field visualization). Viewed from 45° so you
 * can see the funnel depth.
 *
 * Vertex shader: displaces Y using 1/r Plummer (stars) + Gaussian (planets)
 * — same physics as GravityWell.js.
 * Fragment shader: draws equipotential contour lines + depth glow per-pixel.
 *
 * Has its own scene + orthographic camera. Rendered into HUD via RetroRenderer.
 */

const MAX_PLANETS = 8;

export class GravityWellMap {
  /**
   * @param {number} extent — radius of the map in map units
   */
  constructor(extent) {
    this.extent = extent;
    this.totalStarMass = 1;

    this.scene = new THREE.Scene();

    // Pre-allocate planet uniform arrays
    const planetPositions = [];
    const planetMasses = [];
    const planetSigmas = [];
    for (let i = 0; i < MAX_PLANETS; i++) {
      planetPositions.push(new THREE.Vector3(0, 0, 0));
      planetMasses.push(0.0);
      planetSigmas.push(3.0);
    }

    // Well depth scales with extent so the bowl is always clearly visible
    const wellDepthScale = extent * 0.7;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        extent: { value: extent },
        wellDepthScale: { value: wellDepthScale },

        starPos1: { value: new THREE.Vector3(0, 0, 0) },
        starPos2: { value: new THREE.Vector3(0, 0, 0) },
        starMass1: { value: 1.0 },
        starMass2: { value: 0.0 },
        starSoft1: { value: 1.0 },
        starSoft2: { value: 1.0 },

        planetPos: { value: planetPositions },
        planetMass: { value: planetMasses },
        planetSigma: { value: planetSigmas },
        planetCount: { value: 0 },
        planetWellDepth: { value: 8.0 },

        contourSpacing: { value: 0.5 },
        lineColor: { value: new THREE.Vector3(0.0, 0.5, 0.7) },
        glowColor: { value: new THREE.Vector3(0.3, 0.9, 1.0) },
      },

      vertexShader: /* glsl */ `
        uniform float extent;
        uniform float wellDepthScale;

        uniform vec3 starPos1;
        uniform vec3 starPos2;
        uniform float starMass1;
        uniform float starMass2;
        uniform float starSoft1;
        uniform float starSoft2;

        uniform vec3 planetPos[${MAX_PLANETS}];
        uniform float planetMass[${MAX_PLANETS}];
        uniform float planetSigma[${MAX_PLANETS}];
        uniform int planetCount;
        uniform float planetWellDepth;

        varying vec2 vWorldXZ;
        varying float vRadius;

        void main() {
          vec3 pos = position;
          vWorldXZ = pos.xz;
          vRadius = length(pos.xz);

          // Cull vertices outside the circle
          if (vRadius > extent) {
            gl_Position = vec4(0.0);
            return;
          }

          // ── Compute potential and displace Y ──
          // Star 1: Plummer
          float d1 = length(pos.xz - starPos1.xz);
          float potential = starMass1 / sqrt(d1 * d1 + starSoft1 * starSoft1);

          // Star 2 (binary)
          if (starMass2 > 0.0) {
            float d2 = length(pos.xz - starPos2.xz);
            potential += starMass2 / sqrt(d2 * d2 + starSoft2 * starSoft2);
          }

          // Planets: Gaussian wells
          for (int i = 0; i < ${MAX_PLANETS}; i++) {
            if (i >= planetCount) break;
            float dp = length(pos.xz - planetPos[i].xz);
            float sigma = planetSigma[i];
            potential += planetMass[i] * planetWellDepth * exp(-(dp * dp) / (2.0 * sigma * sigma));
          }

          // Map potential → displacement via log scale (compresses huge dynamic range)
          // wellDepthScale sets max cone depth as a fraction of extent
          float logPot = log(1.0 + potential);
          // logPot peaks at ~5 near star center, so /5 normalizes to [0,1] * scale
          float displacement = -logPot * wellDepthScale / 4.5;

          // Clamp max depth
          displacement = max(displacement, -wellDepthScale * 1.2);

          pos.y += displacement;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        uniform float extent;

        uniform vec3 starPos1;
        uniform vec3 starPos2;
        uniform float starMass1;
        uniform float starMass2;
        uniform float starSoft1;
        uniform float starSoft2;

        uniform vec3 planetPos[${MAX_PLANETS}];
        uniform float planetMass[${MAX_PLANETS}];
        uniform float planetSigma[${MAX_PLANETS}];
        uniform int planetCount;
        uniform float planetWellDepth;

        uniform float contourSpacing;
        uniform vec3 lineColor;
        uniform vec3 glowColor;

        varying vec2 vWorldXZ;
        varying float vRadius;

        // 4×4 Bayer dither matrix
        float bayerDither(vec2 coord) {
          vec2 p = mod(floor(coord), 4.0);
          float t = 0.0;
          if (p.y < 0.5) {
            t = (p.x < 0.5) ? 0.0 : (p.x < 1.5) ? 8.0 : (p.x < 2.5) ? 2.0 : 10.0;
          } else if (p.y < 1.5) {
            t = (p.x < 0.5) ? 12.0 : (p.x < 1.5) ? 4.0 : (p.x < 2.5) ? 14.0 : 6.0;
          } else if (p.y < 2.5) {
            t = (p.x < 0.5) ? 3.0 : (p.x < 1.5) ? 11.0 : (p.x < 2.5) ? 1.0 : 9.0;
          } else {
            t = (p.x < 0.5) ? 15.0 : (p.x < 1.5) ? 7.0 : (p.x < 2.5) ? 13.0 : 5.0;
          }
          return t / 16.0;
        }

        void main() {
          // Circular boundary
          if (vRadius > extent) discard;
          float edgeFade = 1.0 - smoothstep(extent * 0.7, extent * 0.98, vRadius);

          // ── Recompute potential per-pixel for contour lines ──
          float d1 = length(vWorldXZ - starPos1.xz);
          float potential = starMass1 / sqrt(d1 * d1 + starSoft1 * starSoft1);

          if (starMass2 > 0.0) {
            float d2 = length(vWorldXZ - starPos2.xz);
            potential += starMass2 / sqrt(d2 * d2 + starSoft2 * starSoft2);
          }

          for (int i = 0; i < ${MAX_PLANETS}; i++) {
            if (i >= planetCount) break;
            float dp = length(vWorldXZ - planetPos[i].xz);
            float sigma = planetSigma[i];
            potential += planetMass[i] * planetWellDepth * exp(-(dp * dp) / (2.0 * sigma * sigma));
          }

          // ── Contour lines from log-potential ──
          float logPot = log(1.0 + potential);
          float scaled = logPot / contourSpacing;
          float f = abs(fract(scaled) - 0.5);
          float fw = fwidth(scaled);
          float contour = 1.0 - smoothstep(fw * 0.3, fw * 1.5, f);

          // ── Depth glow ──
          float depthGlow = smoothstep(0.0, 4.0, logPot);

          // Background fill — deeper = brighter
          float bgAlpha = depthGlow * 0.4 * edgeFade;
          vec3 bgColor = mix(vec3(0.0, 0.08, 0.12), glowColor, depthGlow * 0.5);

          // Contour lines — brighter with depth
          vec3 lineCol = mix(lineColor, glowColor, depthGlow * 0.8);
          float lineAlpha = contour * (0.4 + depthGlow * 0.6) * edgeFade;

          // Combine
          float alpha = max(bgAlpha, lineAlpha);
          vec3 color = mix(bgColor, lineCol, lineAlpha / max(alpha, 0.001));

          // Bayer dithering
          float threshold = bayerDither(gl_FragCoord.xy);
          if (alpha < threshold) discard;

          gl_FragColor = vec4(color, 1.0);
        }
      `,

      transparent: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Subdivided plane for vertex displacement (150 divisions like the original)
    const geometry = new THREE.PlaneGeometry(extent * 2, extent * 2, 150, 150);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    // ── 45° angled orthographic camera ──
    // Frustum must contain: tilted circle (width 2R, height ~1.4R) + deep cone
    const e = extent * 1.6;
    this.camera = new THREE.OrthographicCamera(-e, e, e, -e, 0.1, extent * 8);

    // Store camera orbit params for update() rotation
    this._camHeight = extent * 3 * Math.cos(Math.PI / 4);
    this._camHorizDist = extent * 3 * Math.sin(Math.PI / 4);
    this._lookAtY = -wellDepthScale * 0.4;

    // Initial position (will be updated each frame to match player yaw)
    this.camera.position.set(0, this._camHeight, this._camHorizDist);
    this.camera.lookAt(0, this._lookAtY, 0);
  }

  /**
   * Configure star masses and softening radii.
   */
  setStars(starData1, starData2) {
    const massFactor = 200;
    const m1 = starData1.radius * massFactor;
    this.material.uniforms.starMass1.value = m1;
    this.material.uniforms.starSoft1.value = Math.max(starData1.radius, 0.8) * 1.5;

    let m2 = 0;
    if (starData2) {
      m2 = starData2.radius * massFactor;
      this.material.uniforms.starMass2.value = m2;
      this.material.uniforms.starSoft2.value = Math.max(starData2.radius, 0.8) * 1.5;
    } else {
      this.material.uniforms.starMass2.value = 0;
    }

    this.totalStarMass = m1 + m2;
  }

  /**
   * Configure planet masses and Hill sphere sigmas.
   */
  setPlanets(planetEntries) {
    const count = Math.min(planetEntries.length, MAX_PLANETS);
    this.material.uniforms.planetCount.value = count;

    for (let i = 0; i < MAX_PLANETS; i++) {
      if (i < count) {
        const entry = planetEntries[i];
        const r = entry.planet.data.radius;
        const mass = r * 1.5;
        const orbitRadius = entry.orbitRadius;

        const hillRadius = orbitRadius * Math.pow(mass / (3 * this.totalStarMass), 1 / 3);
        const sigma = Math.max(hillRadius * 0.6, 3.0);

        this.material.uniforms.planetMass.value[i] = mass;
        this.material.uniforms.planetSigma.value[i] = sigma;
      } else {
        this.material.uniforms.planetMass.value[i] = 0;
        this.material.uniforms.planetSigma.value[i] = 3.0;
      }
    }
  }

  updateStarPositions(pos1, pos2) {
    this.material.uniforms.starPos1.value.copy(pos1);
    if (pos2) {
      this.material.uniforms.starPos2.value.copy(pos2);
    }
  }

  updatePlanetPositions(planetEntries) {
    const count = Math.min(planetEntries.length, MAX_PLANETS);
    for (let i = 0; i < count; i++) {
      this.material.uniforms.planetPos.value[i].copy(planetEntries[i].planet.mesh.position);
    }
  }

  /**
   * Rotate the camera to match the player's heading.
   * @param {number} mainYaw — CameraController.smoothedYaw (radians)
   */
  update(mainYaw) {
    this.camera.position.set(
      Math.sin(-mainYaw) * this._camHorizDist,
      this._camHeight,
      Math.cos(-mainYaw) * this._camHorizDist,
    );
    this.camera.lookAt(0, this._lookAtY, 0);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
