import * as THREE from 'three';

/**
 * StarRays — star with thin lines radiating outward in all directions.
 *
 * Renders as:
 * 1. Emissive sphere (same as Star.js)
 * 2. Lines radiating from center, evenly distributed on a sphere
 *    Each ray is a thin line segment from the star surface outward.
 *    Rays have varying lengths and fade with distance from center.
 */
export class StarRays {
  constructor(starData, renderRadius = null) {
    this.data = starData;
    this._renderRadius = renderRadius !== null ? renderRadius : starData.radius;
    this.mesh = new THREE.Group();

    // Emissive sphere
    this.surface = this._createSurface();
    this.surface.frustumCulled = false;
    this.mesh.add(this.surface);

    // Radiating rays
    this.rays = this._createRays();
    this.mesh.add(this.rays);

    this._time = 0;
  }

  _createSurface() {
    const geometry = new THREE.IcosahedronGeometry(this._renderRadius, 4);
    const [r, g, b] = this.data.color;
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(r, g, b),
    });
    return new THREE.Mesh(geometry, material);
  }

  _createRays() {
    const R = this._renderRadius;
    const [cr, cg, cb] = this.data.color;
    const rayCount = 120;

    // Each ray = 2 vertices (inner + outer)
    const positions = new Float32Array(rayCount * 2 * 3);
    const colors = new Float32Array(rayCount * 2 * 3);

    // Golden angle distribution for even sphere coverage
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < rayCount; i++) {
      // Fibonacci sphere point
      const y = 1 - (2 * i) / (rayCount - 1);
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      const dx = radiusAtY * Math.cos(theta);
      const dy = y;
      const dz = radiusAtY * Math.sin(theta);

      // Vary ray length: 2-5x star radius
      // Use a simple hash for per-ray variation
      const hash = Math.abs(Math.sin(i * 127.1 + 311.7)) * 43758.5453 % 1;
      const rayLen = R * (2.0 + hash * 3.0);

      const innerR = R * 1.05;  // start just outside surface
      const outerR = innerR + rayLen;

      const idx = i * 6;
      // Inner point
      positions[idx]     = dx * innerR;
      positions[idx + 1] = dy * innerR;
      positions[idx + 2] = dz * innerR;
      // Outer point
      positions[idx + 3] = dx * outerR;
      positions[idx + 4] = dy * outerR;
      positions[idx + 5] = dz * outerR;

      // Inner: bright star color
      colors[idx]     = Math.min(1, cr + 0.3);
      colors[idx + 1] = Math.min(1, cg + 0.3);
      colors[idx + 2] = Math.min(1, cb + 0.3);
      // Outer: faded toward star color
      const fade = 0.15 + hash * 0.15;
      colors[idx + 3] = cr * fade;
      colors[idx + 4] = cg * fade;
      colors[idx + 5] = cb * fade;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return new THREE.LineSegments(geometry, material);
  }

  update(deltaTime) {
    this._time += deltaTime;
    // Slow rotation so rays catch different angles
    this.rays.rotation.y = this._time * 0.03;
  }

  updateGlow() {
    // No glow sprite — rays are the visual effect
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.surface.geometry.dispose();
    this.surface.material.dispose();
    this.rays.geometry.dispose();
    this.rays.material.dispose();
  }
}
