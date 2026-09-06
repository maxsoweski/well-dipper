/**
 * cabinMask — the cabin's SILHOUETTE, as pixels a 2D canvas can erase with.
 *
 * Max, on what the reticles should read as: *"a HUD on the glass on the cockpit
 * rather than something drawn directly on the player's eye."*
 *
 * ── WHY A SECOND RENDERER AND NOT THE ONE WE HAVE ───────────────────────────
 *
 * The reticles live on `#targeting-overlay`, a **2D** canvas that knows nothing
 * about depth (`TargetingReticle.js`). The cabin lives on the **WebGL** side, in
 * `RetroRenderer`'s `cockpitTarget`, whose alpha channel already IS this
 * silhouette — and is unreachable from a 2D context without
 * `readRenderTargetPixels`, a per-frame CPU stall beside a ~235 Hz world. That
 * readback is the thing this whole design exists to avoid.
 *
 * So: a second, tiny `WebGLRenderer` on an offscreen `<canvas>` that is never
 * added to the DOM, drawing ~782 opaque triangles flat-white on transparent
 * black. `CanvasRenderingContext2D.drawImage` accepts a WebGL-backed canvas, so
 * the bridge from that buffer to the overlay is a compositor-side copy: the
 * pixels never round-trip through JS. `globalCompositeOperation =
 * 'destination-out'` then keeps the overlay where the mask is transparent and
 * erases it where the mask is opaque — a cut at the rib's own edge, which is the
 * behaviour the centre-ray test could never produce.
 *
 * ── THREE THINGS HERE THAT WOULD FAIL QUIETLY ───────────────────────────────
 *
 * 1. ⭐ THE GLASS. `Canopy_Glass` is a VAULT covering 97.4% of the sphere
 *    (`cockpit-metrics.json` → `enclosure.sphereFraction`). Put it in an ERASE
 *    mask and every reticle in the game disappears. This module therefore has
 *    **no glass rule of its own**: `assignMaskLayer` is handed the list
 *    `collectReticleOccluders` already produced from the rig's own census, and
 *    obeys it. Two rules that could drift apart is the failure; there is one.
 *
 * 2. ⭐⭐ SIDEDNESS, and it is not a detail. `cockpit-gen.py` sets `doubleSided`
 *    PER MATERIAL: `Mat_Frame`, `Mat_Hull`, `Mat_Screen` and `Mat_Glass` are
 *    double-sided; `Mat_Body` and `Mat_Arm` are not. One `overrideMaterial` has
 *    one `side`, so it must be the union — `DoubleSide`. `FrontSide` would drop
 *    the hull tub and the arches, which are OPEN SHELLS the pilot sits INSIDE
 *    and therefore sees the back of: the largest occluders in the cabin would
 *    contribute nothing and reticles would draw straight through the fuselage.
 *    `DoubleSide` cannot over-cover in the other direction, because the
 *    single-sided parts (screen bodies, monitor arms) are closed solids whose
 *    silhouette is the same from either winding.
 *
 * 3. LAYERS, NOT VISIBILITY. The occluders are put on their own
 *    `Object3D.layers` bit once at load and the mask camera is restricted to it.
 *    Toggling `mesh.visible` per frame would mean mutating the live cabin
 *    between the mask render and the real one — two passes, one scene, and a
 *    single missed restore leaves the pilot's cockpit half gone.
 *
 * The kill switch and the coverage accessor are not conveniences: an EMPTY
 * occluder set renders as "a game that does no occlusion" and a LEAKED canopy
 * renders as "a cockpit with nothing to point at". Neither reads as wrong in a
 * screenshot, so the number is the instrument — checked against
 * `predictedOcclusionFraction` (build-time, `cockpit-gen.py`) and
 * `window._cockpitOcclusion()` (runtime raycast), neither of which knows this
 * code exists.
 */

import * as THREE from 'three';
import { resolveRenderBuffer } from '../rendering/renderBuffer.js';

/**
 * The `Object3D.layers` bit the cabin's occluders are put on.
 *
 * ⚠ NOTHING ELSE IN `src/` TOUCHES `layers` AT ALL — a scan finds only
 * `SceneInspector.js` READING `obj.layers.mask` for its inventory, so every
 * object in the project sits on the default layer 0 and every bit from 1 up is
 * free. 7 rather than 1 deliberately: the low bits are what a future
 * render-layer scheme would reach for first, and a collision here is invisible
 * (the mask would quietly gain or lose meshes).
 *
 * Occluders keep layer 0 as well — they must still render in the cockpit pass.
 * `enable`, never `set`.
 */
export const CABIN_MASK_LAYER = 7;

/**
 * Put the mask camera's layer on every mesh it is handed.
 *
 * ⭐ IT TAKES THE LIST, IT DOES NOT BUILD ONE. The caller passes the very array
 * `collectReticleOccluders` filled — `_cockpitOccluders` in the game — so there
 * is no second opinion about what counts as glass and no way for the mask's set
 * and the raycast oracle's set to disagree. A function that re-derived the rule
 * here would be one edit away from erasing the whole view.
 *
 * Idempotent: `layers.enable` on an already-enabled bit is a no-op, so a rig
 * that reloads its model does not need special handling.
 *
 * @param {Array} occluders meshes from `collectReticleOccluders`
 * @param {number} [layer] the bit to enable
 * @returns {number} how many meshes were tagged
 */
export function assignMaskLayer(occluders, layer = CABIN_MASK_LAYER) {
  if (!occluders || typeof occluders.length !== 'number') return 0;
  let n = 0;
  for (let i = 0; i < occluders.length; i++) {
    const o = occluders[i];
    if (!o || !o.layers || typeof o.layers.enable !== 'function') continue;
    o.layers.enable(layer);
    n++;
  }
  return n;
}

export class CabinMask {
  /**
   * @param {object} [opts]
   * @param {number} [opts.layer] the layer `assignMaskLayer` tagged the cabin with
   */
  constructor({ layer = CABIN_MASK_LAYER } = {}) {
    this.layer = layer;
    /** Kill switch. False → `render` returns null and nothing is ever erased. */
    this.enabled = true;

    // NOT appended to the DOM, and must not be: it exists to be `drawImage`d,
    // and a canvas in the document would composite over the game.
    this.canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;

    this.renderer = null;   // built on first render — a GL context at module
    this._glFailed = false; // scope would cost one on every page that never flies

    // Mirrors the cockpit camera each frame. A SEPARATE object: mutating
    // `_cockpitCamera` would put this pass's layer mask on the camera the cabin
    // itself is drawn with, and the pilot's cockpit would vanish.
    this.camera = new THREE.PerspectiveCamera();
    this.camera.layers.set(this.layer);

    // See header note 2 for `side`. `fog: false` so a scene that ever gains fog
    // cannot tint the silhouette's alpha; `transparent: false` so the material
    // writes alpha 1 and the buffer's alpha is a clean 0-or-1 stencil.
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      fog: false,
      transparent: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    this._scene = null;
    this._srcCamera = null;
    this._w = 0;
    this._h = 0;
    this._renders = 0;
  }

  /**
   * Draw the cabin's silhouette for THIS frame and hand back the canvas.
   *
   * ⚠ THE CAMERA MUST ALREADY BE POSED. In the game the cockpit camera's head
   * pose is written by `_cockpitRig.update()`, which runs LATER in the frame
   * than the reticle draw — so the caller pins it first. A mask built from last
   * frame's head pose lags the cabin by one frame during free-look, which is
   * precisely the "drawn on your eye" tell this feature exists to remove.
   *
   * @param {object|null} scene the cockpit's own THREE.Scene
   * @param {object|null} srcCamera the live cockpit camera, already posed
   * @returns {HTMLCanvasElement|null} null when there is nothing to cut with
   */
  render(scene, srcCamera) {
    // No cabin this frame (ORRERY, a failed GLB, before the rig resolves).
    // Forgetting the source is what makes `coverage()` honestly report 0 rather
    // than re-rendering a stale scene it is no longer allowed to draw.
    if (!scene || !srcCamera) {
      this._scene = null;
      this._srcCamera = null;
      return null;
    }
    this._scene = scene;
    this._srcCamera = srcCamera;
    if (!this.enabled) return null;
    return this._draw() ? this.canvas : null;
  }

  /**
   * The opaque fraction of the mask buffer — the instrument, not a per-frame
   * path.
   *
   * ⚠ `readPixels` HERE AND NOWHERE ELSE. It is a GPU sync point, which is
   * exactly what the render path is built to avoid; this is console-invoked, so
   * the stall is paid by whoever asked. It also deliberately ignores the kill
   * switch, so the mask stays measurable while it is switched off for an A/B.
   *
   * @returns {number} 0..1, or 0 when there is no cabin to measure
   */
  coverage() {
    if (!this._scene || !this._srcCamera) return 0;
    if (!this._draw()) return 0;
    const gl = this.renderer.getContext();
    this.renderer.setRenderTarget(null);
    const px = new Uint8Array(this._w * this._h * 4);
    gl.readPixels(0, 0, this._w, this._h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let on = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 127) on++;
    return on / (this._w * this._h);
  }

  /** Buffer size + how many frames have been drawn — for the live checks. */
  stats() {
    return {
      enabled: this.enabled,
      hasCabin: !!(this._scene && this._srcCamera),
      width: this._w,
      height: this._h,
      renders: this._renders,
      layer: this.layer,
      glFailed: this._glFailed,
    };
  }

  dispose() {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
      this.renderer = null;
    }
    this.material.dispose();
    this._scene = null;
    this._srcCamera = null;
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** @returns {boolean} true if the buffer now holds a current silhouette */
  _draw() {
    const r = this._ensureRenderer();
    if (!r) return false;
    this._syncSize();

    const cam = this.camera;
    // `copy` brings pose AND projection across (fov, aspect, near/far, the
    // projection matrix itself) — so a FOV-slider change or a window resize
    // reaches the mask for free, and there is no second place for the two
    // cameras to drift apart. It also copies `layers`, hence the reset.
    cam.copy(this._srcCamera, false);
    cam.layers.set(this.layer);
    cam.updateMatrixWorld(true);

    const scene = this._scene;
    const prevOverride = scene.overrideMaterial;
    try {
      scene.overrideMaterial = this.material;
      // `autoClear` + `setClearColor(0x000000, 0)` clears to a fully
      // TRANSPARENT black first — which is the mask's whole resting state:
      // alpha 0 means "clear glass, keep the reticle". An explicit clear here
      // would just be a second full-buffer clear every frame.
      r.render(scene, cam);
    } finally {
      // In a `finally` because the alternative — the cabin left flat white for
      // the pilot — is the worst failure this file can produce, and a throw
      // inside `render` is the only way to reach it.
      scene.overrideMaterial = prevOverride;
    }
    this._renders++;
    return true;
  }

  _ensureRenderer() {
    if (this.renderer) return this.renderer;
    if (this._glFailed || !this.canvas) return null;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        // A HARD EDGE IS THE BRIEF — "cut by the real geometry at the real
        // edges". Multisampling would feather the cut by a pixel; softness is a
        // knob for UAT to ask for, not a default to ship by accident.
        antialias: false,
        premultipliedAlpha: true,
        // `drawImage` reads the drawing buffer. We render and read in the same
        // task, where it is still valid either way — this removes the question
        // rather than reasoning about compositor timing, and the canvas is
        // never composited (it is not in the DOM), so it costs nothing real.
        preserveDrawingBuffer: true,
        stencil: false,
        powerPreference: 'low-power',
      });
      this.renderer.setPixelRatio(1);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.autoClear = true;
    } catch (err) {
      // A second GL context is not guaranteed. Degrade to "no cut" — uncut
      // reticles are the old behaviour, which is survivable; a throw in the
      // draw path is not.
      this._glFailed = true;
      this.renderer = null;
      console.warn('[CABIN-MASK] no WebGL context — reticles will not be cut:', err);
      return null;
    }
    return this.renderer;
  }

  /**
   * Match `#targeting-overlay`'s BACKING STORE exactly.
   *
   * ⭐ THE SAME SOURCE, NOT THE SAME FORMULA. This was `innerWidth * dpr` — a second copy of
   * `TargetingReticle._resize`'s arithmetic, kept in step by hand. Since chrome-and-ui-at-240p the
   * overlay's backing store IS the world render buffer, so both files now read the one object
   * `RetroRenderer.resize()` writes. Two derivations of a number that must agree is exactly what
   * produced the 13.5-pixel checker (see `pixelScaleUniform.js`).
   *
   * ⛔ NOT OPTIONAL DRESSING, AND NOT A PERFORMANCE TWEAK. `_applyCabinMask` does
   * `drawImage(mask, 0, 0, canvas.width, canvas.height)` with smoothing OFF. Left at full window
   * resolution the mask would be POINT-SAMPLED down ~4.7x onto a buffer whose pixel centres do not
   * coincide with its own — a cut that flickers holes along every thin rib as the head moves. The
   * old comment's "full resolution on purpose … a reduced-resolution mask would put the whole
   * feature's credibility on whether a ~7 px rib still cuts cleanly" was right about the risk and
   * is now answered the other way round: at buffer resolution the rib and the cut are on the SAME
   * grid, so the question of a fractional rib does not arise. That is measured by
   * `_cabinMaskCoverage()` against the standing oracle, not assumed.
   */
  _syncSize() {
    const b = resolveRenderBuffer(
      (typeof window !== 'undefined' ? window.innerWidth : 1),
      (typeof window !== 'undefined' ? window.innerHeight : 1),
    );
    const w = Math.max(1, Math.round(b.width));
    const h = Math.max(1, Math.round(b.height));
    if (w === this._w && h === this._h) return;
    this._w = w;
    this._h = h;
    this.renderer.setSize(w, h, false);
  }
}
