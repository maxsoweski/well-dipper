import * as THREE from 'three';

/**
 * GalaxyGlow — a subtle diffuse glow rendered behind the starfield points,
 * representing the unresolved billions of stars in the galaxy.
 *
 * Uses a sky density grid (from StarfieldGenerator) as a texture to shade
 * a sphere. Where density is high (galactic plane, center), you see a
 * warm/cool glow. Where density is low (halo, voids), it's black.
 *
 * This is what makes the Milky Way look "milky" — the individual stars
 * from the Starfield sit ON TOP of this smooth band.
 *
 * Renders in the starfieldScene, behind the Starfield points (no depth write).
 */
export class GalaxyGlow {
  /**
   * @param {Float32Array} skyGrid - density values [0-1], row-major (theta × phi)
   * @param {number} gridTheta - number of theta columns
   * @param {number} gridPhi - number of phi rows
   * @param {number} radius - sky sphere radius (should match Starfield)
   */
  constructor(skyGrid, gridTheta, gridPhi, radius = 499) {
    this.radius = radius;
    this.mesh = this._createGlow(skyGrid, gridTheta, gridPhi);
  }

  _createGlow(skyGrid, gridTheta, gridPhi) {
    // Create a DataTexture from the sky density grid
    // The texture maps theta (horizontal) × phi (vertical)
    const texWidth = gridTheta;
    const texHeight = gridPhi;
    const texData = new Uint8Array(texWidth * texHeight * 4);

    for (let ti = 0; ti < texWidth; ti++) {
      for (let pi = 0; pi < texHeight; pi++) {
        const density = skyGrid[ti * gridPhi + pi];
        const idx = (pi * texWidth + ti) * 4;

        // Color: warm white for dense regions, fading to black
        // Slight warm tint toward high density (galactic core = yellowish)
        const intensity = density * density; // square for more contrast
        const r = Math.min(255, Math.round(intensity * 200));
        const g = Math.min(255, Math.round(intensity * 185));
        const b = Math.min(255, Math.round(intensity * 160));
        texData[idx]     = r;
        texData[idx + 1] = g;
        texData[idx + 2] = b;
        texData[idx + 3] = 255;
      }
    }

    const texture = new THREE.DataTexture(texData, texWidth, texHeight, THREE.RGBAFormat);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    // Use a sphere geometry — low poly is fine since the texture does the work
    const geometry = new THREE.SphereGeometry(this.radius, 32, 16);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide, // Render inside of sphere
      uniforms: {
        uDensityMap: { value: texture },
        uOpacity: { value: 0.35 }, // Subtle — this is background glow, not a bright overlay
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uDensityMap;
        uniform float uOpacity;
        varying vec2 vUv;

        // 4x4 Bayer dithering matrix (matches Starfield and Planet shaders)
        float bayerDither(vec2 coord) {
          int x = int(mod(coord.x, 4.0));
          int y = int(mod(coord.y, 4.0));
          int idx = x + y * 4;
          // Bayer 4x4 thresholds (normalized to 0-1)
          float bayer[16];
          bayer[0]=0.0/16.0; bayer[1]=8.0/16.0; bayer[2]=2.0/16.0; bayer[3]=10.0/16.0;
          bayer[4]=12.0/16.0; bayer[5]=4.0/16.0; bayer[6]=14.0/16.0; bayer[7]=6.0/16.0;
          bayer[8]=3.0/16.0; bayer[9]=11.0/16.0; bayer[10]=1.0/16.0; bayer[11]=9.0/16.0;
          bayer[12]=15.0/16.0; bayer[13]=7.0/16.0; bayer[14]=13.0/16.0; bayer[15]=5.0/16.0;
          return bayer[idx];
        }

        void main() {
          vec4 density = texture2D(uDensityMap, vUv);
          float brightness = (density.r + density.g + density.b) / 3.0;

          // Dither the glow for retro aesthetic consistency
          float threshold = bayerDither(gl_FragCoord.xy);
          if (brightness * uOpacity < threshold * 0.5) discard;

          gl_FragColor = vec4(density.rgb * uOpacity, 1.0);
        }
      `,
    });

    return new THREE.Mesh(geometry, material);
  }

  update(cameraPosition) {
    this.mesh.position.copy(cameraPosition);
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.uniforms.uDensityMap.value.dispose();
    this.mesh.material.dispose();
  }
}
