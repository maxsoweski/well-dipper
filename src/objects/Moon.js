import * as THREE from 'three';

/**
 * Moon — a small sphere that orbits a parent planet.
 *
 * Keeps its own orbital state (angle) and updates position each frame.
 * Uses a simplified version of the planet shader — still has posterization
 * and dithering but fewer surface features (moons are small, don't need
 * as much detail).
 *
 * Supports dual-star lighting for binary systems.
 */
export class Moon {
  constructor(moonData, lightDir, lightDir2 = null, starInfo = null) {
    this.data = moonData;
    this.orbitAngle = moonData.startAngle;

    this.mesh = this._createMesh(lightDir, lightDir2, starInfo);
  }

  _createMesh(lightDir, lightDir2, starInfo) {
    // Lower poly count than planets — moons are small, 3 subdivisions is plenty
    const geometry = new THREE.IcosahedronGeometry(this.data.radius, 3);
    const d = this.data;

    // Type index: 0=captured, 1=rocky, 2=ice, 3=volcanic, 4=terrestrial
    const typeIndex = ['captured', 'rocky', 'ice', 'volcanic', 'terrestrial'].indexOf(d.type);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        baseColor: { value: new THREE.Vector3(...d.baseColor) },
        accentColor: { value: new THREE.Vector3(...d.accentColor) },
        noiseScale: { value: d.noiseScale },
        lightDir: { value: lightDir },
        lightDir2: { value: lightDir2 || new THREE.Vector3(0, 0, 0) },
        starColor1: { value: new THREE.Vector3(...(starInfo?.color1 || [1, 1, 1])) },
        starColor2: { value: new THREE.Vector3(...(starInfo?.color2 || [0, 0, 0])) },
        starBrightness1: { value: starInfo?.brightness1 ?? 1.0 },
        starBrightness2: { value: starInfo?.brightness2 ?? 0.0 },
        moonType: { value: typeIndex },
      },

      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          // World-space normal so lighting is independent of camera
          vNormal = normalize(mat3(modelMatrix) * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        uniform vec3 baseColor;
        uniform vec3 accentColor;
        uniform float noiseScale;
        uniform vec3 lightDir;
        uniform vec3 lightDir2;
        uniform vec3 starColor1;
        uniform vec3 starColor2;
        uniform float starBrightness1;
        uniform float starBrightness2;
        uniform int moonType;

        varying vec3 vNormal;
        varying vec3 vPosition;

        // ── Simplex noise (same as Planet.js) ──
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        // ── Bayer dither + posterize ──
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

        vec3 posterize(vec3 color, float levels, vec2 fragCoord, float edgeWidth) {
          float dither = bayerDither(fragCoord) - 0.5;
          vec3 dithered = color + dither * edgeWidth / levels;
          return floor(dithered * levels + 0.5) / levels;
        }

        void main() {
          // Surface pattern by moon type
          float n = snoise(vPosition * noiseScale);
          vec3 surfaceColor;

          if (moonType == 1) {
            // Rocky: cratered look — light highlands + dark maria
            float craters = snoise(vPosition * noiseScale * 2.0);
            craters = pow(max(craters, 0.0), 2.0);
            float maria = snoise(vPosition * noiseScale * 0.5);
            float mariaMask = smoothstep(0.1, 0.3, maria);
            surfaceColor = mix(accentColor, baseColor, mariaMask);
            // Bright ray craters
            surfaceColor += vec3(0.1) * craters;
          } else if (moonType == 2) {
            // Ice: white surface with colored crack lines
            float cracks = 1.0 - abs(snoise(vPosition * noiseScale * 3.0));
            cracks = pow(cracks, 5.0);
            surfaceColor = mix(baseColor, accentColor, cracks);
          } else if (moonType == 3) {
            // Volcanic: sulfur yellow with dark lava patches
            float lava = snoise(vPosition * noiseScale * 1.5);
            float lavaMask = smoothstep(-0.1, 0.2, lava);
            surfaceColor = mix(accentColor, baseColor, lavaMask);
            // Bright sulfur frost around vents
            float frost = snoise(vPosition * noiseScale * 4.0);
            frost = pow(max(frost, 0.0), 3.0);
            surfaceColor += vec3(0.15, 0.12, 0.05) * frost;
          } else if (moonType == 4) {
            // Terrestrial: ocean + land like a mini-Earth
            float continent = snoise(vPosition * noiseScale * 0.7);
            continent += snoise(vPosition * noiseScale * 1.5) * 0.3;
            continent += snoise(vPosition * noiseScale * 3.0) * 0.15;
            float height = continent * 0.5 + 0.5;
            float seaLevel = 0.48;
            float landMask = step(seaLevel, height);
            surfaceColor = mix(baseColor, accentColor, landMask);
          } else {
            // Captured: simple dark noisy surface
            float detail = n * 0.5 + 0.5;
            surfaceColor = mix(baseColor, accentColor, detail);
          }

          // ── Dual-star Lighting ──
          float diff1 = max(dot(vNormal, lightDir), 0.0);
          float diff2 = max(dot(vNormal, lightDir2), 0.0);

          // Type-specific terminator shaping (using primary star for shape)
          // Airless bodies get sharp terminators, atmospheric ones get soft
          if (moonType == 0 || moonType == 1) {
            diff1 = smoothstep(-0.02, 0.08, dot(vNormal, lightDir));
            diff2 = smoothstep(-0.02, 0.08, dot(vNormal, lightDir2));
          } else if (moonType == 3) {
            diff1 = smoothstep(-0.02, 0.08, dot(vNormal, lightDir));
            diff2 = smoothstep(-0.02, 0.08, dot(vNormal, lightDir2));
          } else if (moonType == 4) {
            diff1 = smoothstep(-0.1, 0.3, dot(vNormal, lightDir));
            diff2 = smoothstep(-0.1, 0.3, dot(vNormal, lightDir2));
          }
          // Ice (moonType 2) keeps the default smooth diffuse

          // Combined star-colored light
          vec3 starLight = starColor1 * diff1 * starBrightness1
                         + starColor2 * diff2 * starBrightness2;
          float diffuse = diff1 * starBrightness1 + diff2 * starBrightness2;

          vec3 finalColor = surfaceColor * starLight;

          // Volcanic: faint glow on dark side from lava
          if (moonType == 3) {
            float nightGlow = max(-dot(vNormal, lightDir), 0.0);
            finalColor += accentColor * nightGlow * 0.15;
          }

          // Posterize
          finalColor = min(finalColor, vec3(1.0));
          finalColor = posterize(finalColor, 6.0, gl_FragCoord.xy, 0.4);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Update orbital position around the parent planet's world position.
   * @param {number} deltaTime
   * @param {THREE.Vector3} parentPosition - the planet's world position
   */
  update(deltaTime, parentPosition) {
    this.orbitAngle += this.data.orbitSpeed * (Math.PI / 180) * deltaTime;

    const r = this.data.orbitRadius;
    const angle = this.orbitAngle;
    const incl = this.data.inclination;

    // Orbit in XZ plane, tilted by inclination
    this.mesh.position.set(
      parentPosition.x + Math.cos(angle) * r,
      parentPosition.y + Math.sin(incl) * Math.sin(angle) * r,
      parentPosition.z + Math.sin(angle) * r,
    );

    // Slow self-rotation
    this.mesh.rotation.y += 0.5 * (Math.PI / 180) * deltaTime;
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
