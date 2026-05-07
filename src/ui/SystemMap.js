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
    this.scene.name = 'hud.system-map';
    this.scene.userData = { category: 'hud', kind: 'system-map', id: 'main', generation: 0 };
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

    // ── User-controlled rotation (click-drag on minimap) ──
    this._mapYaw = 0;  // rotation around Y axis in radians

    // ── Build scene objects ──
    this._buildBackdrop();
    this._buildOrbitLines();
    this._buildBodyDots();
    this._buildCameraIndicator();
    this._buildFocusRing();
  }

  /** Trigger a 3-blink animation on the focus ring. */
  triggerBlink() {
    this._blinkTimer = 0;
  }

  /** Rotate the map by a delta (radians). Called from mouse drag on minimap. */
  rotate(deltaYaw) {
    this._mapYaw += deltaYaw;
  }

  // ── Dark backdrop disc (matches the tilted perspective) ──
  _buildBackdrop() {
    const segments = 64;
    const radius = this.extent * 1.15; // slightly larger than orbit area
    const geo = new THREE.CircleGeometry(radius, segments);
    // CircleGeometry is in XY plane — rotate to XZ (flat on the map)
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(geo, mat);
    disc.renderOrder = -1; // render behind everything
    disc.position.y = -0.1; // just below the orbit plane
    this.scene.add(disc);
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
      const mat = new THREE.LineBasicMaterial({
        color: 0x226644, transparent: true, opacity: 1.0,
        depthWrite: false, depthTest: false,
      });
      const line = new THREE.Line(geo, mat);
      line.renderOrder = 0; // render first (behind everything)
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

    // Planets: 4-14% of extent, scaled by map radius.
    // Gas giants (mapRadius 1.5-3.5) end up ~3x the size of rocky worlds (0.2-0.5),
    // giving a clear visual sense of each planet's physical scale.
    this._planetSprites = [];
    const maxMapRadius = Math.max(...this.planetMapData.map(p => p.mapRadius));
    for (const p of this.planetMapData) {
      const t = p.mapRadius / maxMapRadius; // 0–1 relative size
      const dotSize = e * (0.04 + t * 0.10); // 4%–14% of extent
      const spr = this._makeSprite(p.color, dotSize);
      this.scene.add(spr);
      this._planetSprites.push(spr);
    }
  }

  // ── Camera pointer (tiny arrow that moves with camera position and shows heading) ──
  _buildCameraIndicator() {
    // Triangular pointer — points in the camera's facing direction.
    // Moves around the map following the camera's XZ position in map-space.
    // Sized to match planet dots so it's clearly visible.
    const s = this.extent * 0.08; // pointer size (matches planet dot scale)
    const shape = new THREE.Shape();
    // Triangle pointing along +Z (forward)
    shape.moveTo(0, s * 0.6);       // tip (front)
    shape.lineTo(-s * 0.35, -s * 0.4);  // back-left
    shape.lineTo(s * 0.35, -s * 0.4);   // back-right
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    // ShapeGeometry creates in XY plane — we need XZ plane.
    // Rotate vertices: swap Y→Z so the triangle lies flat on the map.
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setXYZ(i, x, 0, -y); // -Y → +Z so tip points along -Z (up on map)
    }
    pos.needsUpdate = true;
    geo.computeBoundingSphere();

    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    this._camPointer = new THREE.Mesh(geo, mat);
    this._camPointer.renderOrder = 3; // on top of everything
    this.scene.add(this._camPointer);
  }

  // ── Focus highlight (green dot rendered behind the planet dot = stroke effect) ──
  _buildFocusRing() {
    // Use the same circle texture as body dots, but green and slightly larger.
    // Rendered BEHIND the planet sprite (renderOrder 0.5, between orbits and dots).
    this._focusRing = this._makeSprite([0.27, 1.0, 0.27], 1); // size set dynamically
    this._focusRing.renderOrder = 0.5; // behind planet dots (1), above orbits (0)
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
    spr.renderOrder = 1; // render on top of orbit lines
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

    // ── Camera pointer (position + heading in one) ──
    const cx = mainCamera.position.x * this.sceneToMap;
    const cz = mainCamera.position.z * this.sceneToMap;
    this._camPointer.position.set(cx, 0.3, cz);
    // Rotate pointer to show camera heading (account for map rotation)
    this._camPointer.rotation.y = -mainYaw - this._mapYaw;

    // ── Focus ring ──
    if (focusIndex >= 0 && focusIndex < this._planetSprites.length) {
      const planetSpr = this._planetSprites[focusIndex];
      this._focusRing.visible = true;
      this._focusRing.position.copy(planetSpr.position);
      this._focusRing.position.y = 0.05;
      // Size the highlight sprite slightly larger than the planet dot (stroke effect)
      const maxMapRadius = Math.max(...this.planetMapData.map(p => p.mapRadius));
      const t = this.planetMapData[focusIndex].mapRadius / maxMapRadius;
      const dotSize = this.extent * (0.04 + t * 0.10);
      const strokeSize = dotSize * 1.35; // slightly larger = visible green border
      this._focusRing.scale.set(strokeSize, strokeSize, 1);

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

    // ── Highlight selected planet's orbit line in bright green ──
    for (let i = 0; i < this.orbitMeshes.length; i++) {
      const orb = this.orbitMeshes[i];
      if (i === focusIndex) {
        orb.material.color.setHex(0x44ff44);
        orb.material.opacity = 1.0;
      } else {
        orb.material.color.setHex(0x226644);
        orb.material.opacity = 1.0;
      }
    }

    // ── Apply user-controlled map rotation ──
    // Orbit camera around Y at the tilt angle, rotated by _mapYaw.
    const d = this._camDist;
    const tilt = this._tiltAngle;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    this.camera.position.set(
      Math.sin(this._mapYaw) * sinT * d,
      cosT * d,
      Math.cos(this._mapYaw) * sinT * d,
    );
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Hit-test a click in HUD UV space (0-1) against map bodies.
   * Returns { type: 'star'|'planet', starIndex?, planetIndex? } or null.
   * @param {number} hudU — 0 (left) to 1 (right) within the HUD texture
   * @param {number} hudV — 0 (bottom) to 1 (top) within the HUD texture
   */
  hitTest(hudU, hudV) {
    // Work in NDC space (screen coordinates) to avoid tilt/rotation issues.
    // Project each body into NDC and compare against the click NDC.
    const clickNDC = new THREE.Vector2(hudU * 2 - 1, hudV * 2 - 1);

    // Pick radius in NDC units (fraction of the HUD texture)
    const pickRadius = 0.2; // generous — ~10% of HUD width each side
    const pickRadiusSq = pickRadius * pickRadius;
    let bestDist = pickRadiusSq;
    let bestHit = null;

    const _proj = new THREE.Vector3();

    // Check stars
    for (let s = 0; s < this._starSprites.length; s++) {
      _proj.copy(this._starSprites[s].position).project(this.camera);
      const dx = clickNDC.x - _proj.x;
      const dy = clickNDC.y - _proj.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        bestHit = { type: 'star', starIndex: s };
      }
    }

    // Check planets
    for (let p = 0; p < this._planetSprites.length; p++) {
      _proj.copy(this._planetSprites[p].position).project(this.camera);
      const dx = clickNDC.x - _proj.x;
      const dy = clickNDC.y - _proj.y;
      const d2 = dx * dx + dy * dy;
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
