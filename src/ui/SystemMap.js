import * as THREE from 'three';
import { AU_TO_SCENE } from '../core/ScaleConstants.js';

/**
 * SystemMap — retro pixel minimap showing the system layout at exaggerated scale.
 *
 * Renders into its own small THREE.Scene with an orthographic camera looking
 * straight down the -Y axis. The camera rotates around Y to match the main
 * camera's yaw, so the map always feels "oriented" to the player's view
 * (like a radar in a flight sim — your heading points up).
 *
 * Bodies are positioned using map-unit coordinates (the old exaggerated scale)
 * so the entire system fits in a small square. Bodies are drawn as colored
 * Points (via ShaderMaterial), orbits as thin LineLoop circles.
 *
 * A bright dot shows the main camera's position on the map, and the
 * currently-focused body gets a highlight ring.
 */
export class SystemMap {
  /**
   * @param {object} systemData — raw generator output
   * @param {object} systemState — the live system state (planets array with orbitAngle etc.)
   */
  constructor(systemData, systemState) {
    this.scene = new THREE.Scene();
    this.systemState = systemState;

    // Conversion: sceneUnits → mapUnits
    this.sceneToMap = systemData.mapUnitsPerAU / AU_TO_SCENE;

    // ── Compute map extent (fits outermost orbit + margin) ──
    const outerOrbit = systemData.planets[systemData.planets.length - 1].orbitRadius;
    this.extent = outerOrbit * 1.3;

    // ── Orthographic camera — looks down -Y ──
    const e = this.extent;
    this.camera = new THREE.OrthographicCamera(-e, e, e, -e, 0.1, 100);
    this.camera.position.set(0, 50, 0);
    this.camera.lookAt(0, 0, 0);

    // ── Star data ──
    this.starColor = systemData.star.color;
    this.starRadius = systemData.star.radius;
    this.isBinary = systemData.isBinary;
    if (this.isBinary) {
      this.star2Color = systemData.star2.color;
      this.star2Radius = systemData.star2.radius;
      this.binarySeparation = systemData.binarySeparation;
      this.binaryMassRatio = systemData.binaryMassRatio;
    }

    // ── Planet data (map-unit orbit radii & colors) ──
    this.planetMapData = systemData.planets.map(p => ({
      orbitRadius: p.orbitRadius,
      color: p.planetData.baseColor,
      mapRadius: p.planetData.radius,
    }));

    // ── Build scene objects ──
    this._buildOrbitLines();
    this._buildBodyDots();
    this._buildCameraIndicator();
    this._buildFocusRing();
  }

  // ── Orbit line circles (thin, dim) ──
  _buildOrbitLines() {
    this.orbitMeshes = [];
    const segments = 64;

    for (const p of this.planetMapData) {
      const points = [];
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * p.orbitRadius, 0, Math.sin(a) * p.orbitRadius));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color: 0x224422, transparent: true, opacity: 0.6 });
      const line = new THREE.Line(geo, mat);
      this.scene.add(line);
      this.orbitMeshes.push(line);
    }
  }

  // ── Body dots (stars + planets as Points) ──
  _buildBodyDots() {
    // Size dots as a fraction of the map extent so they're always visible
    const e = this.extent;

    // Stars: ~6% of extent — big, bright, unmissable
    this._starSprites = [];
    const starSize = e * 0.06;
    const starSpr = this._makeSprite(this.starColor, starSize);
    this.scene.add(starSpr);
    this._starSprites.push(starSpr);

    if (this.isBinary) {
      const s2Spr = this._makeSprite(this.star2Color, starSize * 0.85);
      this.scene.add(s2Spr);
      this._starSprites.push(s2Spr);
    }

    // Planets: ~2.5-4% of extent, scaled by relative mass
    this._planetSprites = [];
    const maxMapRadius = Math.max(...this.planetMapData.map(p => p.mapRadius));
    for (const p of this.planetMapData) {
      const t = p.mapRadius / maxMapRadius; // 0–1 relative size
      const dotSize = e * (0.025 + t * 0.015); // 2.5%–4% of extent
      const spr = this._makeSprite(p.color, dotSize);
      this.scene.add(spr);
      this._planetSprites.push(spr);
    }
  }

  // ── Camera position indicator (bright white dot) ──
  _buildCameraIndicator() {
    this._camIndicator = this._makeSprite([1.0, 1.0, 1.0], this.extent * 0.015);
    this.scene.add(this._camIndicator);
  }

  // ── Focus ring (highlight around focused body) ──
  _buildFocusRing() {
    const segments = 32;
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.8 });
    this._focusRing = new THREE.Line(geo, mat);
    this._focusRing.visible = false;
    this.scene.add(this._focusRing);
  }

  /**
   * Create a simple Sprite for the map.
   * @param {number[]} color — [r, g, b] in 0–1
   * @param {number} size — world size in map units
   */
  _makeSprite(color, size) {
    const [r, g, b] = color;
    const mat = new THREE.SpriteMaterial({
      color: new THREE.Color(r, g, b),
      depthWrite: false,
      depthTest: false,
    });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(size, size, 1);
    return spr;
  }

  /**
   * Sync map state with the live simulation.
   * Call every frame.
   *
   * @param {THREE.PerspectiveCamera} mainCamera
   * @param {number} mainYaw — CameraController.smoothedYaw (radians)
   * @param {number} focusIndex — -1 = overview, 0+ = planet index
   */
  update(mainCamera, mainYaw, focusIndex) {
    const sys = this.systemState;

    // ── Update star positions ──
    if (this.isBinary) {
      const q = this.binaryMassRatio;
      const sep = this.binarySeparation;
      const r1 = sep * q / (1 + q);
      const r2 = sep * 1.0 / (1 + q);
      const angle = sys.binaryOrbitAngle;
      this._starSprites[0].position.set(Math.cos(angle) * r1, 0.1, Math.sin(angle) * r1);
      this._starSprites[1].position.set(-Math.cos(angle) * r2, 0.1, -Math.sin(angle) * r2);
    } else {
      this._starSprites[0].position.set(0, 0.1, 0);
    }

    // ── Update planet positions (map-unit orbits) ──
    for (let i = 0; i < sys.planets.length; i++) {
      const entry = sys.planets[i];
      const mapOrbit = this.planetMapData[i].orbitRadius;
      const px = Math.cos(entry.orbitAngle) * mapOrbit;
      const pz = Math.sin(entry.orbitAngle) * mapOrbit;
      this._planetSprites[i].position.set(px, 0.1, pz);
    }

    // ── Camera indicator (convert scene pos → map pos) ──
    const cx = mainCamera.position.x * this.sceneToMap;
    const cz = mainCamera.position.z * this.sceneToMap;
    this._camIndicator.position.set(cx, 0.2, cz);

    // ── Focus ring ──
    if (focusIndex >= 0 && focusIndex < this._planetSprites.length) {
      const planetSpr = this._planetSprites[focusIndex];
      this._focusRing.visible = true;
      this._focusRing.position.copy(planetSpr.position);
      this._focusRing.position.y = 0.05;
      // Scale ring to be just larger than the planet dot
      const maxMapRadius = Math.max(...this.planetMapData.map(p => p.mapRadius));
      const t = this.planetMapData[focusIndex].mapRadius / maxMapRadius;
      const dotSize = this.extent * (0.025 + t * 0.015);
      const ringSize = dotSize * 1.4;
      this._focusRing.scale.set(ringSize, 1, ringSize);
    } else {
      this._focusRing.visible = false;
    }

    // ── Rotate map camera to match player heading ──
    // The main camera yaw rotates the map so the player's facing is "up"
    const camDist = 50;
    this.camera.position.set(
      Math.sin(-mainYaw) * 0.001,   // tiny offset so lookAt isn't degenerate
      camDist,
      Math.cos(-mainYaw) * 0.001,
    );
    this.camera.up.set(Math.sin(-mainYaw), 0, Math.cos(-mainYaw));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    // Dispose all geometries and materials in the map scene
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }
}
