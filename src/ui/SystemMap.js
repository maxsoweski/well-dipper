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

    // ── Orthographic camera — tilted ~35° from vertical ──
    // Looking at the map from an angle gives a 3D perspective effect,
    // like a holographic radar display tilted toward the viewer.
    const e = this.extent;
    const tiltAngle = 35 * (Math.PI / 180);  // 35° from vertical
    // Camera must be far enough that ALL orbit geometry is in front of the near plane.
    // At 35° tilt, orbit points on the camera's side can end up behind it if camDist is small.
    const camDist = e * 2;
    this._tiltAngle = tiltAngle;
    this._camDist = camDist;

    // Wider frustum to account for foreshortened view at tilt angle
    const hFrustum = e * 1.2;
    const vFrustum = e * 1.6;  // taller to fit orbits that compress vertically
    const farPlane = camDist + e * 2;  // far enough to see everything through the tilted view
    this.camera = new THREE.OrthographicCamera(-hFrustum, hFrustum, vFrustum, -vFrustum, 0.1, farPlane);
    this.camera.position.set(0, camDist * Math.cos(tiltAngle), camDist * Math.sin(tiltAngle));
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

    // ── Blink animation state ──
    this._blinkTimer = -1;        // -1 = not blinking
    this._blinkDuration = 1.8;    // total blink duration (6 blinks)

    // ── Build scene objects ──
    this._buildOrbitLines();
    this._buildBodyDots();
    this._buildCameraIndicator();
    this._buildFocusRing();
  }

  /** Trigger a 3-blink animation on the focus ring. */
  triggerBlink() {
    this._blinkTimer = 0;
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
      const mat = new THREE.LineBasicMaterial({ color: 0x226644, transparent: true, opacity: 1.0 });
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

    // Planets: ~8-12% of extent, scaled by relative mass
    this._planetSprites = [];
    const maxMapRadius = Math.max(...this.planetMapData.map(p => p.mapRadius));
    for (const p of this.planetMapData) {
      const t = p.mapRadius / maxMapRadius; // 0–1 relative size
      const dotSize = e * (0.08 + t * 0.04); // 8%–12% of extent
      const spr = this._makeSprite(p.color, dotSize);
      this.scene.add(spr);
      this._planetSprites.push(spr);
    }
  }

  // ── Camera position indicator (bright white dot) ──
  _buildCameraIndicator() {
    this._camIndicator = this._makeSprite([1.0, 1.0, 1.0], this.extent * 0.02);
    this.scene.add(this._camIndicator);

    // ── Compass arrow (shows camera heading in bottom-right of map) ──
    // A small arrow that rotates to show which direction the camera faces.
    const arrowLen = this.extent * 0.12;
    const arrowGeo = new THREE.BufferGeometry();
    // Arrow shape: line with two angled tips
    const pts = [
      // Shaft
      new THREE.Vector3(0, 0, -arrowLen * 0.5),
      new THREE.Vector3(0, 0, arrowLen * 0.5),
      // Left tip
      new THREE.Vector3(0, 0, arrowLen * 0.5),
      new THREE.Vector3(-arrowLen * 0.2, 0, arrowLen * 0.25),
      // Right tip
      new THREE.Vector3(0, 0, arrowLen * 0.5),
      new THREE.Vector3(arrowLen * 0.2, 0, arrowLen * 0.25),
    ];
    arrowGeo.setFromPoints(pts);
    const arrowMat = new THREE.LineBasicMaterial({
      color: 0x44ff44, transparent: true, opacity: 0.9,
      depthWrite: false, depthTest: false,
    });
    this._compassArrow = new THREE.LineSegments(arrowGeo, arrowMat);
    // Position in bottom-right quadrant of the map
    this._compassArrow.position.set(this.extent * 0.65, 0.3, this.extent * 0.65);
    this.scene.add(this._compassArrow);
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
   * Create a circular Sprite for the map.
   * Uses a shared circle texture so dots appear round, not square.
   * @param {number[]} color — [r, g, b] in 0–1
   * @param {number} size — world size in map units
   */
  _makeSprite(color, size) {
    if (!SystemMap._circleTexture) {
      const s = 32;
      const canvas = document.createElement('canvas');
      canvas.width = s;
      canvas.height = s;
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      SystemMap._circleTexture = new THREE.CanvasTexture(canvas);
      SystemMap._circleTexture.needsUpdate = true;
    }

    const [r, g, b] = color;
    const mat = new THREE.SpriteMaterial({
      map: SystemMap._circleTexture,
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
   * @param {number} deltaTime — frame time in seconds (for blink animation)
   */
  update(mainCamera, mainYaw, focusIndex, deltaTime) {
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
      const dotSize = this.extent * (0.08 + t * 0.04);
      const ringSize = dotSize * 1.4;
      this._focusRing.scale.set(ringSize, 1, ringSize);

      // Blink animation: 3 quick on/off flashes when transitioning
      if (this._blinkTimer >= 0 && deltaTime) {
        this._blinkTimer += deltaTime;
        // 3 blinks in 0.9s → 3.33 Hz sine wave, visible when positive
        const blink = Math.sin(this._blinkTimer * Math.PI * 2 * 3.33) > 0;
        this._focusRing.visible = blink;
        if (this._blinkTimer >= this._blinkDuration) {
          this._blinkTimer = -1;
          this._focusRing.visible = true;
        }
      }
    } else {
      this._focusRing.visible = false;
    }

    // ── Compass arrow — rotate to show camera heading ──
    // Arrow points in the direction the camera is facing (yaw).
    // Rotation around Y axis: yaw=0 means looking along -Z, so arrow
    // should point along -Z (up on the map). Rotate by -yaw.
    this._compassArrow.rotation.y = -mainYaw;
  }

  /**
   * Hit-test a click in HUD UV space (0-1) against map bodies.
   * Returns { type: 'star'|'planet', starIndex?, planetIndex? } or null.
   * @param {number} hudU — 0 (left) to 1 (right) within the HUD texture
   * @param {number} hudV — 0 (bottom) to 1 (top) within the HUD texture
   */
  hitTest(hudU, hudV) {
    // Convert HUD UV to world coordinates in the map scene.
    // The orthographic camera maps [-extent, extent] to the HUD texture.
    // But the camera also rotates with yaw, so we need to unproject properly.
    //
    // NDC: hudU → -1..+1 (left to right), hudV → -1..+1 (bottom to top)
    const ndcX = hudU * 2 - 1;
    const ndcY = hudV * 2 - 1;

    // Unproject from NDC through the ortho camera to get world XZ
    const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(this.camera);

    // Find the closest body (star or planet) to this world position
    const pickRadiusSq = (this.extent * 0.12) ** 2; // generous pick radius (matches larger dots)
    let bestDist = pickRadiusSq;
    let bestHit = null;

    // Check stars
    for (let s = 0; s < this._starSprites.length; s++) {
      const sp = this._starSprites[s].position;
      const dx = worldPos.x - sp.x;
      const dz = worldPos.z - sp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDist) {
        bestDist = d2;
        bestHit = { type: 'star', starIndex: s };
      }
    }

    // Check planets
    for (let p = 0; p < this._planetSprites.length; p++) {
      const sp = this._planetSprites[p].position;
      const dx = worldPos.x - sp.x;
      const dz = worldPos.z - sp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDist) {
        bestDist = d2;
        bestHit = { type: 'planet', planetIndex: p };
      }
    }

    return bestHit;
  }

  dispose() {
    // Dispose all geometries and materials in the map scene
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }
}
