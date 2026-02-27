import * as THREE from 'three';

/**
 * OrbitLine — a thin circle on the XZ plane showing a planet's orbit path.
 * Subtle and dim, just enough to give the system structure.
 */
export class OrbitLine {
  constructor(radius, color = 0x444444) {
    const segments = 128;
    const points = [];
    for (let i = 0; i <= segments; i++) {
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
      opacity: 0.12,
    });

    this.mesh = new THREE.Line(geometry, material);
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
