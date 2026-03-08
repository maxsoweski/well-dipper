import * as THREE from 'three';

/**
 * StarFlare — star with lens diffraction spikes and a soft halo.
 *
 * Mimics real camera lens artifacts:
 * 1. Emissive sphere (core)
 * 2. 4 or 6 diffraction spikes (long thin quads, additive blended)
 * 3. Circular halo ring at ~3x radius (lens flare ghost)
 *
 * All elements are billboard (face camera) for consistent look from any angle.
 */
export class StarFlare {
  constructor(starData, renderRadius = null) {
    this.data = starData;
    this._renderRadius = renderRadius !== null ? renderRadius : starData.radius;
    this.mesh = new THREE.Group();

    // Emissive sphere
    this.surface = this._createSurface();
    this.surface.frustumCulled = false;
    this.mesh.add(this.surface);

    // Diffraction spikes (billboard)
    this._spikeGroup = new THREE.Group();
    this._createSpikes();
    this.mesh.add(this._spikeGroup);

    // Halo ring (billboard)
    this.halo = this._createHalo();
    this.mesh.add(this.halo);

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

  _createSpikes() {
    const R = this._renderRadius;
    const [cr, cg, cb] = this.data.color;
    const spikeCount = 6;  // 6-pointed star diffraction

    // Each spike is a thin quad (two triangles) stretching from center outward
    // We use a PlaneGeometry rotated and colored with a gradient via vertex colors
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI; // 0 to π (each spike goes both directions)

      // Spike dimensions — long and thin
      const length = R * 12;  // total length tip-to-tip
      const width = R * 0.15; // narrow

      const geometry = new THREE.PlaneGeometry(width, length, 1, 8);
      const posAttr = geometry.getAttribute('position');
      const colorAttr = new Float32Array(posAttr.count * 3);

      // Color gradient: bright at center, fading toward tips
      for (let v = 0; v < posAttr.count; v++) {
        const vy = posAttr.getY(v); // ranges from -length/2 to +length/2
        const distFromCenter = Math.abs(vy) / (length / 2);

        // Exponential falloff from center
        const brightness = Math.exp(-distFromCenter * 3.0);

        // Taper width toward tips
        const taper = 1.0 - distFromCenter * distFromCenter;
        const vx = posAttr.getX(v);
        posAttr.setX(v, vx * Math.max(0.1, taper));

        // Color: white at center fading to star color at tips
        const white = brightness * 0.6;
        colorAttr[v * 3]     = Math.min(1, cr * brightness + white);
        colorAttr[v * 3 + 1] = Math.min(1, cg * brightness + white);
        colorAttr[v * 3 + 2] = Math.min(1, cb * brightness + white);
      }

      geometry.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));
      posAttr.needsUpdate = true;

      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const spike = new THREE.Mesh(geometry, material);
      // Rotate spike around Z to create the star pattern
      spike.rotation.z = angle;
      this._spikeGroup.add(spike);
    }
  }

  _createHalo() {
    const R = this._renderRadius;
    const [cr, cg, cb] = this.data.color;

    // Ring geometry — a thin torus-like ring
    const haloRadius = R * 3.5;
    const ringWidth = R * 0.3;
    const segments = 64;

    const geometry = new THREE.RingGeometry(
      haloRadius - ringWidth / 2,
      haloRadius + ringWidth / 2,
      segments,
    );

    // Vertex colors: subtle, mostly transparent feel via low color values
    const posAttr = geometry.getAttribute('position');
    const colorAttr = new Float32Array(posAttr.count * 3);
    for (let v = 0; v < posAttr.count; v++) {
      colorAttr[v * 3]     = cr * 0.4;
      colorAttr[v * 3 + 1] = cg * 0.4;
      colorAttr[v * 3 + 2] = cb * 0.4;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  update(deltaTime, camera) {
    this._time += deltaTime;

    // Billboard: spikes and halo always face camera
    if (camera) {
      this._spikeGroup.quaternion.copy(camera.quaternion);
      this.halo.quaternion.copy(camera.quaternion);
    }
  }

  updateGlow() {
    // No glow sprite — spikes and halo replace it
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose() {
    this.surface.geometry.dispose();
    this.surface.material.dispose();
    for (const spike of this._spikeGroup.children) {
      spike.geometry.dispose();
      spike.material.dispose();
    }
    this.halo.geometry.dispose();
    this.halo.material.dispose();
  }
}
