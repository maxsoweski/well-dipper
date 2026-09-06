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
    // The map's own buffer, in texels. 0 until the first update() carries it in — every pixel
    // floor is derived from it, and _pxToWorld returns 0 rather than Infinity while it is unset.
    this._bufferPx = 0;
    this._focusRimWorld = 0;

    // ⭐⭐ ISOTROPIC SINCE 2026-09-06, AND IT IS A PRECONDITION RATHER THAN A TIDY-UP. The vertical
    // half-height was e * 1.6 against a horizontal e * 1.2 — a 1.33:1 anisotropic frustum on a
    // SQUARE target. three's sprite program scales in view space, ROTATES, and only then projects
    // (sprite.glsl.js), so a rotating sprite under an anisotropic projection is SHEARED: it changes
    // shape as it turns. The camera pointer below is now a rotating sprite, so this had to go first.
    // ⚠ The 1.6 was there to fit orbits that foreshorten under the 35-degree tilt. 1.2 keeps that
    // headroom on both axes rather than only one — the tilt compresses Z into Y, and a square
    // frustum over a square buffer means one map unit is one texel in both directions, which is what
    // makes a pixel floor expressible at all.
    const hFrustum = e * 1.2;
    const vFrustum = e * 1.2;
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
    // ⭐⭐ A SPRITE, NOT A ShapeGeometry MESH, SINCE 2026-09-06. The triangle was authored in world
    // units (extent * 0.08) and rotated in the XZ plane, so on a buffer that is now ~121 texels
    // across it became a sub-texel sliver that vanished at some headings and aliased at others — a
    // vector glyph on a pixel grid, which is the whole defect this workstream exists to remove.
    // A sprite carries a hand-authored pixel chevron and takes an absolute texel size from
    // _applyPixelFloors, so it is the same legible shape at every resolution.
    // ⚠ THIS IS WHY THE FRUSTUM HAD TO GO ISOTROPIC FIRST: three rotates a sprite in view space
    // BEFORE projecting, so an anisotropic frustum shears it as it turns.
    const S = 9;                       // odd, so the chevron has a true centre column
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    // A solid chevron pointing UP (-Y in canvas space), widening toward the base.
    const rows = [
      [4, 4], [3, 5], [3, 5], [2, 6], [2, 6], [1, 7], [1, 7], [0, 8], [0, 8],
    ];
    rows.forEach(([x0, x1], y) => ctx.fillRect(x0, y, x1 - x0 + 1, 1));
    // Notch the base so it reads as an arrowhead rather than a triangle at 9 texels.
    ctx.clearRect(3, S - 2, 3, 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;

    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: 0xffffff,
      depthWrite: false,
      depthTest: false,
    });
    this._camPointer = new THREE.Sprite(mat);
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
   * One buffer texel, expressed in map world units.
   *
   * The map camera is an isotropic orthographic box of half-extent `extent * 1.2`, drawn into a
   * square buffer of `_bufferPx` texels — so the whole box is `2 * extent * 1.2` world units across
   * `_bufferPx` texels.
   *
   * ⚠ THE ZERO GUARD IS NOT OPTIONAL. `_bufferPx` is fed from the render target and is 0 until the
   * first update() carries it. Dividing by it would hand every caller Infinity, and an Infinity
   * sprite scale is a map blown out to a white screen rather than a visibly missing feature.
   * @param {number} px @returns {number} world units
   */
  _pxToWorld(px) {
    if (!this._bufferPx) return 0;
    return (px * 2 * this.extent * 1.2) / this._bufferPx;
  }

  /**
   * Re-derive every size that needs a pixel floor, for the buffer the map currently has.
   *
   * ⭐ WHY FLOORS AT ALL. Every size in this class was a FRACTION OF EXTENT — 6% for a star, 4-14%
   * for a planet, 8% for the pointer. Those are resolution-independent in world terms and therefore
   * resolution-DEPENDENT in pixels: on the old fixed 320 buffer a 4% planet was 15 texels, and on
   * the 121-texel buffer the resolution setting now produces it is 5.8, with the smallest bodies
   * under 3. Max, 2026-09-06: anything that does not read at this resolution gets redesigned.
   *
   * ⭐ FLOORS, NOT REPLACEMENTS. The proportional law is what makes a gas giant read as bigger than
   * a rocky world, and that is worth keeping — it is the map's only size signal. So each size keeps
   * its fraction and is then RAISED to a minimum expressed in texels. At a large buffer the floors
   * are inert and the map looks exactly as it always did; at a small one they take over.
   *
   * ⚠ RECOMPUTED FROM `extent` AND `planetMapData`, never from the sprites' current scale, so this
   * is idempotent — calling it twice for the same buffer cannot ratchet sizes upward.
   */
  _applyPixelFloors() {
    const e = this.extent;
    // Texel floors. A body has to be a recognisable disc, not a lit pixel — the starfield already
    // owns "one lit pixel" and a planet that reads as a star is the illegibility being fixed.
    const STAR_MIN_PX = 7;
    const PLANET_MIN_PX = 4;
    const POINTER_PX = 9;      // absolute: the chevron's authored texture is 9 texels
    const FOCUS_RIM_PX = 2;    // rim thickness, added to the dot's diameter

    if (this._starSprites && this._starSprites.length) {
      const starSize = Math.max(e * 0.06, this._pxToWorld(STAR_MIN_PX));
      this._starSprites[0].scale.set(starSize, starSize, 1);
      if (this._starSprites[1]) {
        const s2 = Math.max(e * 0.06 * 0.85, this._pxToWorld(STAR_MIN_PX));
        this._starSprites[1].scale.set(s2, s2, 1);
      }
    }
    if (this._planetSprites && this._planetSprites.length) {
      const maxMapRadius = Math.max(...this.planetMapData.map(p => p.mapRadius));
      for (let i = 0; i < this._planetSprites.length; i++) {
        const t = this.planetMapData[i].mapRadius / maxMapRadius;
        const size = Math.max(e * (0.04 + t * 0.10), this._pxToWorld(PLANET_MIN_PX));
        this._planetSprites[i].scale.set(size, size, 1);
      }
    }
    if (this._camPointer) {
      // ⚠ ABSOLUTE, not floored. The pointer is a hand-authored 9-texel glyph; drawing it at any
      // other size resamples it and undoes the reason it stopped being a mesh.
      const p = this._pxToWorld(POINTER_PX);
      if (p > 0) this._camPointer.scale.set(p, p, 1);
    }
    this._focusRimWorld = this._pxToWorld(FOCUS_RIM_PX);
  }

  /**
   * Create a circular Sprite for the map.
   * Uses a shared circle texture so dots appear round, not square.
   * @param {number[]} color — [r, g, b] in 0–1
   * @param {number} size — world size in map units
   */
  _makeSprite(color, size) {
    if (!SystemMap._circleTexture) {
      // ⭐ AN 8x8 HARD DISC ON NEAREST, NOT A 32x32 ANTIALIASED ONE. A canvas `arc` fill is
      // antialiased, and the map's buffer is now the world's grid — so a dot a few texels across was
      // being minified from 32 with the default LinearFilter, which turns a 3-texel planet into a
      // grey smudge with no edge. Authoring the disc AT roughly the size it is drawn, with hard
      // coverage and Nearest sampling, gives it the same hard edge every other surface now has.
      const s = 8;
      const canvas = document.createElement('canvas');
      canvas.width = s;
      canvas.height = s;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      // Explicit per-texel coverage: no arc(), because arc() antialiases and that is the defect.
      const r = s / 2, c = (s - 1) / 2;
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          if ((x - c) * (x - c) + (y - c) * (y - c) <= (r - 0.5) * (r - 0.5)) ctx.fillRect(x, y, 1, 1);
        }
      }
      SystemMap._circleTexture = new THREE.CanvasTexture(canvas);
      SystemMap._circleTexture.magFilter = THREE.NearestFilter;
      SystemMap._circleTexture.minFilter = THREE.NearestFilter;
      SystemMap._circleTexture.generateMipmaps = false;
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
  update(mainCamera, mainYaw, focusIndex, deltaTime, bufferPx) {
    // ⭐ THE MAP NOW KNOWS HOW MANY PIXELS IT HAS. Its buffer used to be a fixed 320 square and is
    // now derived from the resolution setting (RetroRenderer.resize), so every size below that
    // wants a pixel floor has to be recomputed when it changes — a value cached at construction
    // would strand the map at whatever the setting was when the system loaded.
    if (Number.isFinite(bufferPx) && bufferPx >= 1 && bufferPx !== this._bufferPx) {
      this._bufferPx = bufferPx;
      this._applyPixelFloors();
    }
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
    // Rotate pointer to show camera heading (account for map rotation).
    // ⚠ SAME SIGN AS THE MESH IT REPLACED. A Sprite has no meaningful `rotation.y` — it always
    // faces the camera — so the angle moves to `material.rotation`, which spins it in screen space.
    // The expression is unchanged: negating it here to "compensate for screen space" would point
    // the chevron the wrong way, which is a heading indicator lying about heading.
    this._camPointer.material.rotation = -mainYaw - this._mapYaw;

    // ── Focus ring ──
    if (focusIndex >= 0 && focusIndex < this._planetSprites.length) {
      const planetSpr = this._planetSprites[focusIndex];
      this._focusRing.visible = true;
      this._focusRing.position.copy(planetSpr.position);
      this._focusRing.position.y = 0.05;
      // Size the highlight sprite slightly larger than the planet dot (stroke effect)
      const maxMapRadius = Math.max(...this.planetMapData.map(p => p.mapRadius));
      const t = this.planetMapData[focusIndex].mapRadius / maxMapRadius;
      // ⭐ AN ABSOLUTE RIM, NOT A RATIO. 1.35x of a dot is a proportional border: on the buffer the
      // resolution setting now produces, 1.35 x a 4-texel planet is 5.4, so the visible green rim is
      // 0.7 of a texel per side and rounds away to nothing on the smallest bodies — exactly the ones
      // hardest to see. A fixed texel rim is the same readable thickness on every body.
      // ⚠ Mirrors the floored size from _applyPixelFloors rather than the raw fraction, or the rim
      // would sit INSIDE a floored dot and never show.
      const dotSize = Math.max(this.extent * (0.04 + t * 0.10), this._pxToWorld(4));
      const strokeSize = dotSize + 2 * (this._focusRimWorld || 0);
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
