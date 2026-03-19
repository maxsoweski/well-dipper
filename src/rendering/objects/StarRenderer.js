import * as THREE from 'three';

/**
 * StarRenderer — type-branched star rendering based on stellar evolution.
 *
 * Replaces the old Star.js (one-size-fits-all emissive sphere + glow)
 * with physics-driven rendering that branches on evolution stage:
 *
 *   main-sequence:  emissive sphere + diffraction spike flare (like old StarFlare)
 *   red-giant:      clamped-size orange sphere + limb darkening + HUGE glow
 *   white-dwarf:    tiny bright blue-white sphere + tight corona + Rayleigh halo
 *   neutron-star:   invisible core + rotating lighthouse beam
 *   black-hole:     invisible core + accretion disk + (future) lensing
 *
 * Usage:
 *   const star = StarRenderer.create(starData, physicsData, renderRadius);
 *   scene.add(star.mesh);
 *   star.update(deltaTime, camera);
 */

// Shared glow texture — created once, reused by all stars
let _glowTexture = null;
function getGlowTexture() {
  if (_glowTexture) return _glowTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.15)');
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.04)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  _glowTexture = new THREE.CanvasTexture(canvas);
  _glowTexture.magFilter = THREE.NearestFilter;
  return _glowTexture;
}

/**
 * Factory: create the right star renderer for the given physics data.
 * @param {object} starData — from StarSystemGenerator (radius, color, type, luminosity, etc.)
 * @param {object|null} physicsData — { stellarEvolution } from PhysicsEngine, or null
 * @param {number|null} renderRadius — override render radius (scene units)
 * @returns {StarRenderer}
 */
export function createStarRenderer(starData, physicsData, renderRadius = null) {
  const rr = renderRadius ?? starData.radius;
  const evo = physicsData?.stellarEvolution;

  if (!evo || !evo.evolved) {
    return new MainSequenceStar(starData, rr);
  }

  switch (evo.stage) {
    case 'red-giant':
      return new RedGiantStar(starData, rr, evo);
    case 'remnant':
      switch (evo.remnantType) {
        case 'white-dwarf':
          return new WhiteDwarfStar(starData, rr, evo);
        case 'neutron-star':
          return new NeutronStar(starData, rr, evo);
        case 'black-hole':
          return new BlackHole(starData, rr, evo);
        default:
          return new MainSequenceStar(starData, rr);
      }
    default:
      return new MainSequenceStar(starData, rr);
  }
}

// ════════════════════════════════════════════════
// BASE CLASS
// ════════════════════════════════════════════════

class StarRendererBase {
  constructor(starData, renderRadius) {
    this.data = starData;
    this._renderRadius = renderRadius;
    this.mesh = new THREE.Group();
    this.surface = null; // set by subclasses — used for raycasting
    this.type = 'unknown';
  }

  update(deltaTime, camera) {
    // Override in subclasses
  }

  updateGlow(camera) {
    // Override in subclasses
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map && child.material.map !== _glowTexture) {
          child.material.map.dispose();
        }
        child.material.dispose();
      }
    });
  }
}

// ════════════════════════════════════════════════
// MAIN SEQUENCE — standard star (current behavior)
// ════════════════════════════════════════════════

class MainSequenceStar extends StarRendererBase {
  constructor(starData, renderRadius) {
    super(starData, renderRadius);
    this.type = 'main-sequence';

    // Emissive sphere
    this.surface = this._createSurface();
    this.surface.frustumCulled = false;
    this.mesh.add(this.surface);

    // Glow corona
    this._baseGlowScale = renderRadius * 3.5;
    this.glow = this._createGlow();
    this.mesh.add(this.glow);
  }

  _createSurface() {
    const geo = new THREE.IcosahedronGeometry(this._renderRadius, 4);
    const [r, g, b] = this.data.color;
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(r, g, b),
    });
    return new THREE.Mesh(geo, mat);
  }

  _createGlow() {
    const [r, g, b] = this.data.color;
    const mat = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: new THREE.Color(r, g, b),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(this._baseGlowScale, this._baseGlowScale, 1);
    return sprite;
  }

  updateGlow(camera) {
    const dist = camera.position.distanceTo(this.mesh.position);
    const minAngularSize = 0.015;
    const distScale = dist * minAngularSize;
    const scale = Math.max(this._baseGlowScale, distScale);
    const maxScale = dist * 0.2;
    const finalScale = Math.min(scale, maxScale);
    this.glow.scale.set(finalScale, finalScale, 1);
  }
}

// ════════════════════════════════════════════════
// RED GIANT — huge glow, clamped surface, limb darkening
// ════════════════════════════════════════════════

class RedGiantStar extends StarRendererBase {
  constructor(starData, renderRadius, evo) {
    super(starData, renderRadius);
    this.type = 'red-giant';

    // Red giants have a physical radius up to 100× solar, but we clamp
    // the rendered surface to avoid overwhelming the scene. The glow
    // extends to the real physical size.
    this._physicalScale = Math.min(starData.radiusSolar || 10, 100);
    const surfaceRadius = renderRadius; // keep geometry at normal system scale
    this._glowScale = renderRadius * Math.max(5, this._physicalScale * 0.5);

    // Orange-red surface with limb darkening
    this.surface = this._createSurface(surfaceRadius);
    this.surface.frustumCulled = false;
    this.mesh.add(this.surface);

    // Huge warm glow
    this.glow = this._createGlow();
    this.mesh.add(this.glow);
  }

  _createSurface(radius) {
    const geo = new THREE.IcosahedronGeometry(radius, 4);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Vector3(0.95, 0.45, 0.15) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          // Limb darkening: edges are dimmer and redder
          float cosAngle = max(0.0, dot(vNormal, vViewDir));
          float limbDarkening = 0.4 + 0.6 * cosAngle;
          // Redden at limb
          vec3 limbColor = mix(vec3(0.7, 0.15, 0.02), uColor, cosAngle);
          gl_FragColor = vec4(limbColor * limbDarkening, 1.0);
        }
      `,
    });
    return new THREE.Mesh(geo, mat);
  }

  _createGlow() {
    const mat = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: new THREE.Color(0.95, 0.4, 0.1),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(this._glowScale, this._glowScale, 1);
    return sprite;
  }

  updateGlow(camera) {
    const dist = camera.position.distanceTo(this.mesh.position);
    const minAngularSize = 0.025; // bigger than main-seq
    const distScale = dist * minAngularSize;
    const scale = Math.max(this._glowScale, distScale);
    const maxScale = dist * 0.3;
    const finalScale = Math.min(scale, maxScale);
    this.glow.scale.set(finalScale, finalScale, 1);
  }
}

// ════════════════════════════════════════════════
// WHITE DWARF — tiny bright, tight corona, Rayleigh halo
// ════════════════════════════════════════════════

class WhiteDwarfStar extends StarRendererBase {
  constructor(starData, renderRadius, evo) {
    super(starData, renderRadius);
    this.type = 'white-dwarf';

    // White dwarfs are tiny — render at 20% of normal star size
    const surfaceRadius = renderRadius * 0.2;
    this._surfaceRadius = surfaceRadius;

    // Bright blue-white surface
    this.surface = this._createSurface(surfaceRadius);
    this.surface.frustumCulled = false;
    this.mesh.add(this.surface);

    // Tight corona (1.5× surface)
    this._baseGlowScale = surfaceRadius * 3;
    this.glow = this._createGlow(surfaceRadius);
    this.mesh.add(this.glow);

    // Rayleigh scattering halo (2.5× surface, blue-tinted)
    this.halo = this._createHalo(surfaceRadius);
    this.mesh.add(this.halo);
  }

  _createSurface(radius) {
    const geo = new THREE.IcosahedronGeometry(radius, 3);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.85, 0.9, 1.0),
    });
    return new THREE.Mesh(geo, mat);
  }

  _createGlow(surfaceRadius) {
    const mat = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: new THREE.Color(0.8, 0.85, 1.0),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const s = this._baseGlowScale;
    sprite.scale.set(s, s, 1);
    return sprite;
  }

  _createHalo(surfaceRadius) {
    const mat = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: new THREE.Color(0.4, 0.5, 0.9), // blue Rayleigh scatter
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.3,
    });
    const sprite = new THREE.Sprite(mat);
    const s = surfaceRadius * 5;
    sprite.scale.set(s, s, 1);
    return sprite;
  }

  updateGlow(camera) {
    const dist = camera.position.distanceTo(this.mesh.position);
    const minAngularSize = 0.01;
    const distScale = dist * minAngularSize;
    const scale = Math.max(this._baseGlowScale, distScale);
    this.glow.scale.set(scale, scale, 1);
    // Halo scales similarly but larger
    const haloScale = scale * 1.8;
    this.halo.scale.set(haloScale, haloScale, 1);
  }
}

// ════════════════════════════════════════════════
// NEUTRON STAR — invisible core + rotating lighthouse beam
// ════════════════════════════════════════════════

class NeutronStar extends StarRendererBase {
  constructor(starData, renderRadius, evo) {
    super(starData, renderRadius);
    this.type = 'neutron-star';

    // Tiny invisible core (neutron stars are ~10km, but we render
    // a small point for selection/raycasting)
    this._coreRadius = renderRadius * 0.05;
    this.surface = this._createCore();
    this.surface.frustumCulled = false;
    this.mesh.add(this.surface);

    // Lighthouse beam — rotating billboard cone
    this._beamAngle = 0;
    this._beamSpeed = 4.0 + Math.random() * 8.0; // 4-12 rad/s (fast!)
    this.beam = this._createBeam(renderRadius);
    this.mesh.add(this.beam);

    // Small hot glow at the pole
    this._baseGlowScale = renderRadius * 0.5;
    this.glow = this._createGlow();
    this.mesh.add(this.glow);
  }

  _createCore() {
    const geo = new THREE.IcosahedronGeometry(this._coreRadius, 2);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.7, 0.8, 1.0),
    });
    return new THREE.Mesh(geo, mat);
  }

  _createBeam(renderRadius) {
    // Two opposing beam cones rendered as a billboard quad with custom shader
    const size = renderRadius * 8;
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uBeamAngle: { value: 0.0 },
        uColor: { value: new THREE.Vector3(0.6, 0.7, 1.0) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uBeamAngle;
        uniform vec3 uColor;
        varying vec2 vUv;

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
          vec2 centered = vUv - 0.5;
          float dist = length(centered);
          float angle = atan(centered.y, centered.x);

          // Two opposing beams (180° apart)
          float beamWidth = 0.15; // angular width in radians
          float beam1 = exp(-pow(mod(angle - uBeamAngle + 3.14159, 6.28318) - 3.14159, 2.0) / (2.0 * beamWidth * beamWidth));
          float beam2 = exp(-pow(mod(angle - uBeamAngle + 6.28318, 6.28318) - 3.14159, 2.0) / (2.0 * beamWidth * beamWidth));
          float beam = max(beam1, beam2);

          // Radial falloff — brighter near center
          float radialFade = 1.0 - smoothstep(0.05, 0.5, dist);
          beam *= radialFade;

          // Center glow
          float core = exp(-dist * dist / 0.003);

          float total = beam + core * 0.5;

          float threshold = bayerDither(floor(gl_FragCoord.xy / 3.0));
          if (total < threshold * 0.4) discard;

          gl_FragColor = vec4(uColor * total, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  _createGlow() {
    const mat = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: new THREE.Color(0.6, 0.7, 1.0),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const s = this._baseGlowScale;
    sprite.scale.set(s, s, 1);
    return sprite;
  }

  update(deltaTime, camera) {
    if (!camera) return;
    // Rotate beam
    this._beamAngle += this._beamSpeed * deltaTime;
    this.beam.material.uniforms.uBeamAngle.value = this._beamAngle;

    // Billboard the beam toward camera
    this.beam.quaternion.copy(camera.quaternion);
  }

  updateGlow(camera) {
    const dist = camera.position.distanceTo(this.mesh.position);
    const minAngularSize = 0.008;
    const distScale = dist * minAngularSize;
    const scale = Math.max(this._baseGlowScale, distScale);
    this.glow.scale.set(scale, scale, 1);
  }
}

// ════════════════════════════════════════════════
// BLACK HOLE — accretion disk + (future) lensing
// ════════════════════════════════════════════════

class BlackHole extends StarRendererBase {
  constructor(starData, renderRadius, evo) {
    super(starData, renderRadius);
    this.type = 'black-hole';

    // Invisible core (just for raycasting)
    this._coreRadius = renderRadius * 0.1;
    this.surface = this._createCore();
    this.surface.frustumCulled = false;
    this.mesh.add(this.surface);

    // Accretion disk — thin ring, hot inner → cool outer
    this._diskAngle = 0;
    this.disk = this._createAccretionDisk(renderRadius);
    this.mesh.add(this.disk);
  }

  _createCore() {
    // Pure black sphere — absorbs all light
    const geo = new THREE.IcosahedronGeometry(this._coreRadius, 2);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0, 0, 0),
    });
    return new THREE.Mesh(geo, mat);
  }

  _createAccretionDisk(renderRadius) {
    // Ring geometry tilted to a random inclination
    const innerR = renderRadius * 0.3;
    const outerR = renderRadius * 2.5;
    const geo = new THREE.RingGeometry(innerR, outerR, 64, 3);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0.0 },
        uInnerR: { value: innerR },
        uOuterR: { value: outerR },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vR;
        void main() {
          vUv = uv;
          // Compute radial distance for color gradient
          vR = length(position.xy);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uInnerR;
        uniform float uOuterR;
        varying vec2 vUv;
        varying float vR;

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
          // Radial position normalized 0 (inner) to 1 (outer)
          float t = clamp((vR - uInnerR) / (uOuterR - uInnerR), 0.0, 1.0);

          // Hot inner (blue-white) → warm middle (yellow) → cool outer (orange-red)
          vec3 innerColor = vec3(0.8, 0.85, 1.0);
          vec3 midColor = vec3(1.0, 0.8, 0.3);
          vec3 outerColor = vec3(0.8, 0.3, 0.1);

          vec3 col;
          if (t < 0.4) {
            col = mix(innerColor, midColor, t / 0.4);
          } else {
            col = mix(midColor, outerColor, (t - 0.4) / 0.6);
          }

          // Brightness: inner is much brighter (inverse square-ish)
          float brightness = 0.3 + 0.7 * pow(1.0 - t, 2.0);

          // Doppler rotation effect — one side brighter
          // (simplified: just a slow angular variation)
          float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
          float doppler = 1.0 + 0.3 * sin(angle + uTime * 0.5);
          brightness *= doppler;

          float threshold = bayerDither(floor(gl_FragCoord.xy / 3.0));
          if (brightness < threshold * 0.6) discard;

          gl_FragColor = vec4(col * brightness, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geo, mat);
    // Random tilt
    mesh.rotation.x = Math.PI * 0.35 + Math.random() * 0.3;
    mesh.rotation.z = Math.random() * Math.PI * 2;
    return mesh;
  }

  update(deltaTime, camera) {
    this._diskAngle += deltaTime * 0.3;
    this.disk.material.uniforms.uTime.value = this._diskAngle;
  }

  updateGlow() {
    // Black holes have no glow — they absorb light
  }
}

// Re-export for convenience
export { MainSequenceStar, RedGiantStar, WhiteDwarfStar, NeutronStar, BlackHole };
