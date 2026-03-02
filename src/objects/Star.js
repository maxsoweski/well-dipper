import * as THREE from 'three';

/**
 * Star — the central light source of a star system.
 *
 * Renders as:
 * 1. An emissive (unlit) sphere — flat bright color, no lighting needed
 * 2. An additive-blended glow sprite for the corona
 *
 * The surface uses MeshBasicMaterial for maximum reliability — stars
 * are self-luminous, they don't need shading or normals.
 */
export class Star {
  constructor(starData) {
    this.data = starData;
    this.mesh = new THREE.Group();

    // Emissive sphere — frustumCulled off to prevent edge-case culling
    this.surface = this._createSurface();
    this.surface.frustumCulled = false;
    this.mesh.add(this.surface);

    // Glow corona (billboard sprite)
    this.glow = this._createGlow();
    this.mesh.add(this.glow);
  }

  _createSurface() {
    const geometry = new THREE.IcosahedronGeometry(this.data.radius, 4);
    const [r, g, b] = this.data.color;

    // MeshBasicMaterial: flat color, no normals, no shading — just bright.
    // Stars are self-luminous, so no lighting calculations needed.
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(r, g, b),
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
    // Brighter center so the star always looks prominent
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.04)');
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
      // depthTest stays true — glow should be hidden by planets in front
    });

    const sprite = new THREE.Sprite(material);
    const glowScale = this.data.radius * 3.5;
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
