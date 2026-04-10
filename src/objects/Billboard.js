import * as THREE from 'three';

/**
 * Billboard — a screen-space retro pixel indicator for distant bodies.
 *
 * ⚠️ DEAD CODE (2026-04-09): Planet/moon billboards are currently replaced
 * by the TargetingReticle ghost state (small empty bracket reticles) so
 * the sense of scale feels honest — distant bodies no longer masquerade
 * as visible dots. This class is still allocated/disposed with the
 * system lifecycle (entry.billboard, entry.moonBillboards) and the
 * sprites are force-hidden every frame in main.js's LOD loop. Max may
 * revive billboards with a distance-based reactivation (e.g. show
 * billboards only within X distance of the star) — in which case this
 * class will come back into service. If you're about to delete it,
 * check with Max first.
 *
 * When a planet or moon is too small to resolve at render resolution
 * (sub-pixel or just a couple of pixels), its Billboard appears as a
 * small colored dot — similar in size to the background starfield points.
 *
 * The texture is an 8×8 pixel-art circle (white on transparent).
 * NearestFilter keeps it crisp and retro. At 1-2 render pixels the dot
 * is just a point; at 3+ render pixels the circular shape shows through.
 *
 * Size targets: billboards render in the low-res scene target (1/3 res),
 * so 1 render pixel = 3×3 screen pixels ≈ a medium background star.
 * Planets default to 1.5 render pixels, moons to 1.
 */

// Shared 8×8 pixel-art circle texture for all billboards.
// White circle on transparent background, tinted per-sprite via color.
// Created once on first use, never disposed (lives for the app's lifetime).
let _sharedTexture = null;

function getSharedTexture() {
  if (_sharedTexture) return _sharedTexture;

  // Build an 8×8 circle manually via ImageData — no canvas antialiasing.
  // Center at (3.5, 3.5), radius 3.2 gives a nice round pixel shape:
  //   . . X X X X . .
  //   . X X X X X X .
  //   X X X X X X X X
  //   X X X X X X X X
  //   X X X X X X X X
  //   X X X X X X X X
  //   . X X X X X X .
  //   . . X X X X . .
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(size, size);
  const d = imageData.data;

  const cx = 3.5, cy = 3.5, r = 3.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) {
        const idx = (y * size + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = d[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  _sharedTexture = new THREE.CanvasTexture(canvas);
  _sharedTexture.magFilter = THREE.NearestFilter;
  _sharedTexture.minFilter = THREE.NearestFilter;
  return _sharedTexture;
}

export class Billboard {
  /**
   * @param {number[]} color — [r, g, b] in 0–1 range
   * @param {number} [targetPixels=1.5] — desired size in render pixels
   */
  constructor(color, targetPixels = 1.5) {
    const [r, g, b] = color;

    const material = new THREE.SpriteMaterial({
      map: getSharedTexture(),
      color: new THREE.Color(r, g, b),
      transparent: true,
      depthWrite: false,
      // depthTest stays true — dots hidden behind foreground objects
    });

    this.sprite = new THREE.Sprite(material);
    this.sprite.visible = false; // LOD controls visibility
    this._targetPixels = targetPixels;
  }

  /**
   * Recompute sprite world-space scale to maintain constant screen-space size.
   *
   * The sprite lives in the main scene which renders at low resolution
   * (pixelScale 3 = each render pixel covers 3×3 screen pixels).
   * We compute the world size needed so the sprite covers exactly
   * _targetPixels in that low-res render target.
   *
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} pixelScale — RetroRenderer.pixelScale (e.g. 3)
   */
  update(camera, pixelScale) {
    if (!this.sprite.visible) return;

    const dist = camera.position.distanceTo(this.sprite.position);
    if (dist < 0.001) return;

    // renderPixels = worldSize * renderHeight / (dist * 2 * tan(fov/2))
    // ⟹ worldSize = targetPixels * dist * 2 * tan(fov/2) / renderHeight
    const fovRad = camera.fov * Math.PI / 180;
    const renderHeight = window.innerHeight / pixelScale;
    const worldSize = this._targetPixels * dist * 2 * Math.tan(fovRad / 2) / renderHeight;

    this.sprite.scale.set(worldSize, worldSize, 1);
  }

  addTo(scene) {
    scene.add(this.sprite);
  }

  removeFrom(scene) {
    scene.remove(this.sprite);
  }

  dispose() {
    this.sprite.material.dispose();
    // Shared texture is NOT disposed — reused across all billboards
  }
}

/**
 * Compute a billboard-friendly color from a body's base color.
 * Ensures minimum brightness so dots are always visible against
 * the dark starfield background.
 *
 * @param {number[]} baseColor — [r, g, b] in 0–1 range
 * @returns {number[]} [r, g, b] with guaranteed minimum luminance
 */
export function billboardColor(baseColor) {
  const [r, g, b] = baseColor;
  // Perceived luminance (ITU-R BT.601)
  const lum = r * 0.299 + g * 0.587 + b * 0.114;
  const minLum = 0.35;

  if (lum < minLum) {
    // Scale up to hit minimum brightness, clamping at 1.0
    const scale = minLum / Math.max(lum, 0.01);
    return [Math.min(r * scale, 1), Math.min(g * scale, 1), Math.min(b * scale, 1)];
  }
  return [r, g, b];
}
