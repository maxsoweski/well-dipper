import * as THREE from 'three';

/**
 * Creates a starfield — thousands of tiny points on a large sphere
 * surrounding the camera. The sphere moves WITH the camera so you
 * never fly past the stars (they're a backdrop, like a skybox).
 */
export class Starfield {
  constructor(count = 3000, radius = 500) {
    this.count = count;
    this.radius = radius;
    this.mesh = this._createStars();
  }

  _createStars() {
    // Each star needs x, y, z position and r, g, b color
    const positions = new Float32Array(this.count * 3);
    const colors = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      // Distribute points uniformly on a sphere surface.
      // The math: pick a random direction in 3D, then normalize to the sphere radius.
      // Using spherical coordinates with uniform distribution.
      const theta = Math.random() * Math.PI * 2;       // 0 to 360 degrees
      const phi = Math.acos(2 * Math.random() - 1);    // uniform distribution on sphere
      const r = this.radius;

      const i3 = i * 3;
      positions[i3]     = r * Math.sin(phi) * Math.cos(theta);  // x
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);  // y
      positions[i3 + 2] = r * Math.cos(phi);                     // z

      // Most stars are white-ish, but some have a slight color tint.
      // This mimics real star colors (blue = hot, red = cool, yellow = sun-like).
      const colorRoll = Math.random();
      if (colorRoll < 0.05) {
        // Blue-white (hot star) — 5% chance
        colors[i3]     = 0.7;
        colors[i3 + 1] = 0.8;
        colors[i3 + 2] = 1.0;
      } else if (colorRoll < 0.10) {
        // Red-orange (cool star) — 5% chance
        colors[i3]     = 1.0;
        colors[i3 + 1] = 0.6;
        colors[i3 + 2] = 0.4;
      } else if (colorRoll < 0.15) {
        // Yellow (sun-like) — 5% chance
        colors[i3]     = 1.0;
        colors[i3 + 1] = 0.95;
        colors[i3 + 2] = 0.7;
      } else {
        // White — 85% of stars
        const brightness = 0.6 + Math.random() * 0.4; // vary brightness
        colors[i3]     = brightness;
        colors[i3 + 1] = brightness;
        colors[i3 + 2] = brightness;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2,                       // size in pixels (at render resolution)
      sizeAttenuation: false,        // constant size regardless of distance
      vertexColors: true,            // use the per-point colors we set above
      transparent: true,
      opacity: 0.9,
    });

    return new THREE.Points(geometry, material);
  }

  /**
   * Call this every frame to keep the starfield centered on the camera.
   * Since it's a skybox-like backdrop, it should never appear to move.
   */
  update(cameraPosition) {
    this.mesh.position.copy(cameraPosition);
  }

  /**
   * Add the starfield to a Three.js scene.
   */
  addTo(scene) {
    scene.add(this.mesh);
  }
}
