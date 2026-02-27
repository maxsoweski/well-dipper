import * as THREE from 'three';

/**
 * Star — the central light source of a star system.
 *
 * Renders as:
 * 1. An emissive (unlit) sphere with slight limb brightening
 * 2. An additive-blended glow sprite for the corona
 *
 * Uses the same Bayer dithering as planets for visual consistency.
 */
export class Star {
  constructor(starData) {
    this.data = starData;
    this.mesh = new THREE.Group();

    // Emissive sphere
    this.surface = this._createSurface();
    this.mesh.add(this.surface);

    // Glow corona (billboard sprite)
    this.glow = this._createGlow();
    this.mesh.add(this.glow);
  }

  _createSurface() {
    const geometry = new THREE.IcosahedronGeometry(this.data.radius, 4);
    const color = this.data.color;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        starColor: { value: new THREE.Vector3(...color) },
      },

      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-worldPos.xyz);
          gl_Position = projectionMatrix * worldPos;
        }
      `,

      fragmentShader: /* glsl */ `
        uniform vec3 starColor;

        varying vec3 vNormal;
        varying vec3 vViewDir;

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
          // Limb brightening — stars are brighter at the edge (opposite of planets)
          float fresnel = 1.0 - max(dot(vNormal, vViewDir), 0.0);
          float limbBright = 1.0 + fresnel * 0.3;

          // Slight color variation across the surface
          vec3 color = starColor * limbBright;

          // Clamp to avoid over-bright posterization artifacts
          color = min(color, vec3(1.0));

          color = posterize(color, 6.0, gl_FragCoord.xy, 0.4);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    return new THREE.Mesh(geometry, material);
  }

  _createGlow() {
    // Procedural radial gradient texture for the glow
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cx = size / 2;
    const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter; // Keep it chunky at retro res

    const [r, g, b] = this.data.color;
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: new THREE.Color(r, g, b),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);
    const glowScale = this.data.radius * 5;
    sprite.scale.set(glowScale, glowScale, 1);

    return sprite;
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.surface.geometry.dispose();
    this.surface.material.dispose();
    this.glow.material.map.dispose();
    this.glow.material.dispose();
  }
}
