import * as THREE from 'three';

/**
 * OrbitLine — a thin circle on the XZ plane showing a planet's orbit path.
 * Subtle and dim, just enough to give the system structure.
 *
 * Segment count scales with radius to keep the polygon close to the true
 * circle. At realistic scale, orbit radii can be 400-30,000 scene units
 * while planets are only 0.01-0.6 units — a fixed 128-segment polygon
 * would visibly miss the planet (the chord sags away from the arc).
 *
 * Formula: segments = max(128, ceil(√radius × 32))
 * Keeps the sagitta (max chord-to-arc gap) under ~0.005 scene units,
 * well within even the smallest rocky planet's radius (~0.013).
 */
export class OrbitLine {
  constructor(radius, color = 0x444444) {
    const segments = Math.max(128, Math.ceil(Math.sqrt(radius) * 32));
    const points = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius,
      ));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
    });

    this.mesh = new THREE.LineLoop(geometry, material);
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
