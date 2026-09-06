/**
 * TargetingReticle — canvas overlay that draws corner-bracket reticles
 * over selectable in-system bodies.
 *
 * Four visual states per body:
 *   - None      — no reticle
 *   - Ghost     — small dim empty brackets for sub-pixel bodies (Elite-
 *                 style). Main.js hides the mesh and emits the body as a
 *                 ghost target so it's still clickable. No name shown.
 *   - Tentative — dim, semi-transparent (mouse hover) + name
 *   - Selected  — bright, fully opaque (clicked target; persists through
 *                 the burn travel and into orbit) + name
 *
 * The reticle only draws the name of the body — full body details
 * (type, size, distance, habitability, etc.) are shown in the upper-left
 * HUD (BodyInfo) on initial click and in the NavComputer for reference.
 *
 * The renderer is driven by main.js each frame. It does NOT track state
 * itself — main.js owns `hoverTarget`, `selectedTarget`, and `ghostTargets`
 * and passes them in. This keeps the reticle a pure view: no business logic.
 *
 * Coordinate flow:
 *   world → camera.projectToScreen (NDC) → canvas pixels
 *   The overlay canvas is sized to match the game canvas (including DPR)
 *   so we can draw at native resolution with crisp edges.
 *
 * Usage from main.js:
 *   const reticle = new TargetingReticle(camera);
 *   // each frame:
 *   reticle.update(bodies, { hoverTarget, selectedTarget });
 */

import * as THREE from 'three';
import { RENDER_BUFFER, resolveRenderBuffer } from '../rendering/renderBuffer.js';
import { drawPixelText } from '../rendering/PixelText.js';

// Colors
const COLOR_GHOST     = 'rgba(120, 255, 140, 0.30)'; // very dim — "something there"
const COLOR_TENTATIVE = 'rgba(120, 255, 120, 0.45)'; // dim, semi-transparent green
const COLOR_SELECTED  = 'rgba(100, 255, 130, 1.0)';  // bright, opaque green
const COLOR_SELECTED_GLOW = 'rgba(180, 255, 200, 0.35)';
// Ship-scanner reticle (Unit 1). Cyan distinguishes ships from green body
// reticles. Same bracket geometry, same label position — feels of a piece
// with the body reticles but read instantly as a different category.
const COLOR_SHIP_TENTATIVE = 'rgba(120, 220, 255, 0.55)';
const COLOR_SHIP_SELECTED  = 'rgba(140, 230, 255, 1.0)';
const NAME_COLOR_SHIP_TENTATIVE = 'rgba(160, 220, 255, 0.85)';
const NAME_COLOR_SHIP_SELECTED  = 'rgba(180, 235, 255, 0.95)';

// ── EVERY NUMBER BELOW IS A WORLD BUFFER PIXEL (chrome-and-ui-at-240p, AC-6) ──
// They were CSS pixels against the window; this canvas's backing store is now the world render
// buffer, so one unit here is one WORLD pixel, magnified ~4.7x at the 240p setting.
//
// ⭐ THIS IS A REDESIGN, NOT A DIVISION. Two of these could not simply be scaled:
//   - THICKNESS. At 240p there are exactly TWO representable stroke weights. Selected-vs-tentative
//     therefore has to be carried by 2-vs-1. It could not be before: 3 and 4 CSS px both quantised
//     to one block (`round(3/3) === round(4/3) === 1`), so for the whole life of this file the only
//     thing separating a locked target from a hovered one was ALPHA.
//   - THE MINIMUM. 16 CSS px of half-width is 3.4 buffer px, which cannot hold a bracket with an
//     arm and a step in it. 6 is the floor at which the staircase shape survives.
// Bracket sizing (scales with projected body radius so big bodies get big brackets)
const BRACKET_MIN_HALF = 6;   // buffer px — smallest half-width of bracket square
const BRACKET_MAX_HALF = 9999; // buffer px — body fills screen (camera on body, dist<=0); callers clamp to viewport
const BRACKET_MARGIN   = 3;   // buffer px — gap between bracket square and body edge
const BRACKET_EDGE_MARGIN = 8; // buffer px — keep brackets this far from viewport edge
const BRACKET_ARM_LEN = 3;    // buffer px — 3 texels x 4.26 magnification = 12.8 screen px, which is
                              // what the old 12-CSS-px arm measured. 4 made the arms LONGER than before.
const BRACKET_THICK_TENT = 1;
const BRACKET_THICK_SEL  = 2;

// Ghost reticle (sub-pixel bodies): fixed size independent of body radius,
// so every distant body reads as the same quiet marker. Sized for a chunky
// retro feel so it doesn't get lost against the starfield.
const GHOST_HALF      = 4;    // buffer px — half-width of ghost bracket square
const GHOST_ARM_LEN   = 3;    // buffer px — clamped to 2 by the arm rule at GHOST_HALF 4
const GHOST_THICK     = 1;    // buffer px — line thickness

// Pixel grid size — brackets snap to this for retro chunky look.
// ⛔ 1, AND IT MUST STAY 1. The old 3 was a stand-in for the retro renderer's magnification, drawn
// on a canvas that did not have it; the canvas now IS the world buffer, so the grid it snaps to is
// the world's own. Snapping to 3 on top of that would be a 3-world-pixel grid — chunkier than the
// world, which is the opposite of sharing its grid.
const PX = 1;

// Name label style — centered in the negative space below the bottom brackets.
// ⛔ NO `NAME_FONT` ANY MORE. The label goes through `PixelText`: at 8 buffer px a proportional
// fallback is a smear, `fillText` antialiases unconditionally at any size, and 'Pixelify Sans' is
// a WEBFONT — a network dependency in the draw path for a label the pilot reads while flying.
// (The font link in index.html stays; five other rules in style.css still use it for DOM chrome.)
const NAME_COLOR_SELECTED  = 'rgba(160, 255, 180, 0.95)';
const NAME_COLOR_TENTATIVE = 'rgba(140, 220, 140, 0.75)';
const NAME_BOTTOM_PAD = 2;    // buffer px — gap between bottom bracket edge and the label's top row

// Off-screen ship chevron, in buffer px: tip, then the two back corners. Rasterised by hand (see
// `_fillTriangleTexels`) because `fill()` on a rotated path antialiases, and a soft-edged arrow on
// a canvas whose whole premise is hard texels is the seam AC-9 judges.
const CHEVRON = [[4, 0], [-3, -3], [-3, 3]];
const CHEVRON_EDGE_MARGIN = 7;  // buffer px from the viewport edge (was 32 CSS px)

// Reusable scratch objects
const _v = new THREE.Vector3();

/**
 * True if two target descriptors refer to the same in-system body.
 * Used to skip ghost-drawing bodies that are currently hovered or
 * selected (those get rendered by the full tentative/selected pass).
 */
function _isSameBody(a, b) {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'star') return a.starIndex === b.starIndex;
  if (a.kind === 'planet') return a.planetIndex === b.planetIndex;
  if (a.kind === 'moon') return a.planetIndex === b.planetIndex && a.moonIndex === b.moonIndex;
  return false;
}

/** Stable string key for a target (used for animation tracking). */
function _targetKey(t) {
  if (t.kind === 'star') return `s${t.starIndex}`;
  if (t.kind === 'planet') return `p${t.planetIndex}`;
  if (t.kind === 'moon') return `m${t.planetIndex}_${t.moonIndex}`;
  return '';
}

export class TargetingReticle {
  constructor(camera) {
    this.camera = camera;

    // Create + attach the overlay canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'targeting-overlay';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    // Sits above the WebGL canvas and most HUD, below modal overlays
    this.canvas.style.zIndex = '50';
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this._dpr = window.devicePixelRatio || 1;

    // ── The cabin cut (reticles-on-the-glass-2026-08-01) ──
    // INJECTED, not imported. The reticle is a pure view over targets and must
    // stay ignorant of the cockpit: `setMaskSource` hands it a function that
    // returns "an image whose opaque pixels are not glass", and it erases with
    // it. That keeps `ui/` free of a `cockpit/` dependency, and it is what lets
    // this file behave identically in the lab, in ORRERY and with no GLB at all
    // — the source simply returns null.
    this._maskSource = null;
    this._maskWarned = false;

    this._resize();
    window.addEventListener('resize', () => this._resize());

    // Hidden by default — shown when enabled
    this.enabled = true;

    // Ghost bracket lock-in animation: track when each ghost first appeared
    // so we can animate brackets from loose (far apart) to locked (default).
    this._ghostEntryTimes = new Map(); // key → timestamp (ms)
    this._ghostLockDuration = 400;     // ms — how long the lock-in takes
    this._ghostLockScale = 2.5;        // start at N× default half-width

    // Inspection-layer probe: per-update draw state so the dev-only inspection
    // layer can surface synthetic ui.reticle.* entries via SceneInspector.
    // Reset at the start of update(); populated as ghost/tentative/selected
    // draws fire. See docs/WORKSTREAMS/reticle-ghosting-fix-and-ui-overlay-
    // inspection-2026-05-09.md.
    this._lastFrame = {
      drawCallsThisFrame: 0,
      lastClearAt: 0,
      entries: [],  // { state, kind, bodyName, label, x, y, bracketHalf, frameDrawCount }
      canvasW: 0,
      canvasH: 0,
      dpr: this._dpr,
      // 0 until a cabin mask has actually been composited this frame. The
      // probe's own answer to "was the cut applied, or is there simply nothing
      // in front of the reticle?" — two states a screenshot cannot tell apart.
      maskAppliedAt: 0,
    };
  }

  /**
   * Install the source of the cabin silhouette.
   *
   * @param {(() => (HTMLCanvasElement|null))|null} fn returns an image whose
   *   OPAQUE pixels are the thing the pilot cannot see through, or null when
   *   there is nothing in front of the glass this frame.
   */
  setMaskSource(fn) {
    this._maskSource = typeof fn === 'function' ? fn : null;
  }

  /**
   * Size the backing store to the WORLD BUFFER and the CSS box to the window.
   *
   * ⚠ `_cssW`/`_cssH` KEEP THEIR NAMES AND THEIR VALUES. They now mean "the CSS extent", which is
   * all the inspection probe ever wanted them for. ⛔ Do NOT delete them and reconstruct the CSS
   * extent as `_bufW * _magX`: that is a float round-trip and it makes the probe's `canvasW` report
   * 2204.999… where `SceneInspector` reads an integer 2205 off `clientWidth`.
   */
  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const b = resolveRenderBuffer(w, h);
    this._dpr = window.devicePixelRatio || 1;
    this.canvas.width = b.width;
    this.canvas.height = b.height;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this._cssW = w;
    this._cssH = h;
    this._bufW = b.width;
    this._bufH = b.height;
    this._magX = w / b.width;
    this._magY = h / b.height;
  }

  /**
   * Project a world position to CSS pixels on the overlay canvas.
   * Returns `{ x, y, inFront }` or null if the point is completely off-screen.
   */
  _project(worldPos) {
    _v.copy(worldPos).project(this.camera);
    // NDC z > 1 means behind the far plane. z in [-1,1] means in front.
    // Behind the camera: z > 1 (projected NDC flips). Use camera-space z instead.
    const inFront = _v.z >= -1 && _v.z <= 1;
    if (!inFront) return null;
    // ⛔ THE BUFFER, NOT THE CSS EXTENT. Everything downstream of this — bracket sizes, the label,
    // the viewport clamps — is in buffer px, and projecting into CSS px would scale all of it by
    // the magnification.
    const x = (_v.x * 0.5 + 0.5) * this._bufW;
    const y = (-_v.y * 0.5 + 0.5) * this._bufH;
    // Off-screen cull (with margin). 42 buffer px is the old 200 CSS px at 240p; left at 200 it
    // would be most of the buffer, and the off-screen chevron would never get its turn.
    if (x < -42 || x > this._bufW + 42 || y < -42 || y > this._bufH + 42) return null;
    return { x, y };
  }

  /**
   * Compute the on-screen pixel radius of a body based on its world-space
   * radius and distance to camera. Returns a number in CSS pixels.
   */
  _projectedPixelRadius(body) {
    const worldRadius = body.radius || 0;
    if (worldRadius <= 0) return BRACKET_MIN_HALF;
    const dist = this.camera.position.distanceTo(body.mesh.position);
    if (dist <= 0) return BRACKET_MAX_HALF;
    // Angular size in radians, converted to pixels using vertical FOV
    const fov = (this.camera.fov * Math.PI) / 180;
    const angularRadius = Math.atan(worldRadius / dist);
    // ⛔ `_bufH`, NOT `_cssH`: the answer is compared against BRACKET_MIN_HALF and added to
    // BRACKET_MARGIN, both of which are buffer px. Left on the CSS height every bracket would be
    // ~4.7x too big at 240p and the clamps below would be the only thing keeping them on screen.
    const pixelRadius = (angularRadius / (fov * 0.5)) * (this._bufH * 0.5);
    return pixelRadius;
  }

  /**
   * Draw pixelated staircase corner brackets centered at (cx, cy).
   * Each bracket is drawn as filled pixel blocks (PX × PX) snapped to a grid,
   * with a diagonal step at the corner for a retro targeting reticle feel.
   *
   * Top-left corner shape (others mirrored):
   *   ██████████          ← horizontal arm along outer edge
   *    █                  ← step: offset 1 block inward on both axes
   *    █                  ← vertical arm continues inward
   *    █
   */
  _drawBrackets(cx, cy, half, armLen, thickness, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    // ⭐ SNAP THE CENTRE TO A TEXEL FIRST. `screen.x` is a float out of the projection; a fillRect
    // at a fractional x is antialiased across two columns by the canvas, which is the one thing
    // this whole workstream is removing. Snapping here does it once for all four corners rather
    // than eight times below, so the square cannot end up half a texel wider on one side.
    const cxi = Math.round(cx);
    const cyi = Math.round(cy);
    const h = Math.round(half / PX) * PX;
    const t = Math.max(1, Math.round(thickness / PX)) * PX;
    // ⛔ THE ARM MUST BE CLAMPED OR THE CORNERS MERGE INTO A BOX. The clear span left in the middle
    // of an edge is `(2h+1) - 2*(t + arm)`; at the minimum half-width with a 2-texel selected stroke
    // an unclamped arm of 3 leaves ONE texel, which reads as a solid rectangle rather than four
    // corners. `h - t - 1` keeps at least three texels of daylight at every size and weight.
    const arm = Math.max(1, Math.min(Math.round(armLen / PX), h - t - 1));

    // ── ⭐ FOUR CORNERS OF A SLIGHTLY ROUNDED SQUARE (Max, 2026-09-07) ──
    //
    // Each corner is TWO rects and the corner block itself is left EMPTY. That hole is the whole
    // shape: it chamfers the vertex so the square reads as rounded, and it is what makes these read
    // as CORNERS rather than as tick marks.
    //
    //   . █ █ █        ← horizontal arm: t deep on the outer edge, starting ONE STROKE in
    //   █ . . .        ← the corner block, empty — this is the rounding
    //   █
    //   █              ← vertical arm: t wide on the outer edge, starting ONE STROKE down
    //
    // ⛔⛔ DO NOT "FIX" THIS BACK INTO AN L. The version of this file before 2026-09-07 carried an
    // ASCII diagram showing the vertical arm offset one block INWARD of the horizontal — and the
    // CODE did the opposite, stepping it outward. The comment was the thing that was wrong. Making
    // the code match it turned every corner into a T, which Max caught on sight: *"the reticle no
    // longer reads like the same shape at all. The shape we're going for is the four corners of a
    // slightly rounded square."* The shape is now stated as rects rather than as offsets into a
    // loop, so there is nothing left to misread.
    //
    // `band` is the t-thick strip lying ON the outer edge; `run` is the arm-long strip starting one
    // stroke in from the corner. Both are expressed as a MINIMUM coordinate, because fillRect takes
    // a top-left — which is why the two signs are not symmetric to look at even though the geometry
    // they produce is.
    const band = (o, s) => (s > 0 ? o - t + 1 : o);
    const run = (o, s) => (s > 0 ? o - t - arm + 1 : o + t);

    // Four corners: sx/sy point from center toward the corner
    const signs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [sx, sy] of signs) {
      // Outer corner point — the extreme lit texel of the square on both axes.
      const ox = cxi + sx * h;
      const oy = cyi + sy * h;
      ctx.fillRect(run(ox, sx), band(oy, sy), arm, t);   // horizontal arm
      ctx.fillRect(band(ox, sx), run(oy, sy), t, arm);   // vertical arm
    }
  }

  /**
   * Draw the name label centered horizontally on the body, sitting just
   * below the bottom edge of the bracket square (in the negative space
   * between the bottom-left and bottom-right corner brackets).
   */
  _drawNameBelow(cx, cy, half, text, color) {
    if (!text) return;
    // ⛔ `onMissing: 'tofu'`, AND THE ASYMMETRY WITH THE HUD IS DELIBERATE. SupercruiseHud draws
    // FIXED LITERALS, so a character the face cannot render there is an authoring bug and throws.
    // These are PROCEDURALLY GENERATED BODY NAMES, and a throw in this draw path would take the
    // whole reticle layer down — precisely the failure `_applyCabinMask`'s try/catch exists to
    // prevent. An unexpected codepoint draws a filled box, the way a real font stack does.
    drawPixelText(this.ctx, text, Math.round(cx), Math.round(cy + half + NAME_BOTTOM_PAD),
      { color, align: 'center', onMissing: 'tofu' });
  }

  /**
   * Main render entry point. Called once per frame from main.js.
   *
   * @param {Object} state
   *   @param {Object|null} state.hoverTarget  — the body under the mouse
   *   @param {Object|null} state.selectedTarget — the locked target
   *   @param {Object[]} [state.ghostTargets] — sub-pixel bodies whose mesh
   *     is hidden; drawn as small dim empty brackets. Bodies that are
   *     currently hovered or selected are skipped (they get the
   *     tentative/selected state instead).
   *   Each target: { mesh, radius, name, type, kind } (kind='star'|'planet'|'moon')
   */
  update(state) {
    // Reset probe state at the start of every update so frameDrawCount
    // counts draws within THIS update only. Multiple update() calls per
    // RAF tick are allowed; what we forbid is paint-without-clear.
    // ⚠ RESYNC BEFORE ANYTHING IS RECORDED. The Resolution setting changes the world buffer with
    // NO window resize at all (`main.js:6266-6271` sets renderLines and calls resize()), so the
    // resize listener alone strands this canvas at the previous resolution. Guarded on `>= 1`
    // because RENDER_BUFFER is {0,0} until the first `RetroRenderer.resize()`, and an unguarded
    // compare against the fallback would re-size the canvas every frame forever.
    // ⭐ It is ahead of the `_lastFrame` block rather than after it so `bufferW` below reports the
    // buffer this frame actually drew into, not the previous one's.
    if (RENDER_BUFFER.width >= 1
        && (RENDER_BUFFER.width !== this._bufW || RENDER_BUFFER.height !== this._bufH)) {
      this._resize();
    }
    this._lastFrame.entries = [];
    this._lastFrame.drawCallsThisFrame = 0;
    this._lastFrame.canvasW = this._cssW;
    this._lastFrame.canvasH = this._cssH;
    this._lastFrame.dpr = this._dpr;
    this._lastFrame.maskAppliedAt = 0;

    if (!this.enabled) {
      this._clear();
      return;
    }
    this._clear();
    if (!state) return;

    const { hoverTarget, selectedTarget, ghostTargets, shipTargets } = state;

    // Ghost pass first: small dim empty brackets for every sub-pixel body
    // that isn't currently being hovered or selected. Hover/select states
    // take visual priority and render on top.
    const now = performance.now();
    const activeKeys = new Set();
    if (ghostTargets && ghostTargets.length) {
      for (const ghost of ghostTargets) {
        if (_isSameBody(ghost, hoverTarget)) continue;
        if (_isSameBody(ghost, selectedTarget)) continue;
        const key = _targetKey(ghost);
        activeKeys.add(key);
        // Record entry time for new ghosts
        if (!this._ghostEntryTimes.has(key)) {
          this._ghostEntryTimes.set(key, now);
        }
        const age = now - this._ghostEntryTimes.get(key);
        this._drawGhost(ghost, age);
      }
    }
    // Prune entry times for ghosts that disappeared
    for (const key of this._ghostEntryTimes.keys()) {
      if (!activeKeys.has(key)) this._ghostEntryTimes.delete(key);
    }

    // Ship scanner pass — draw ship reticles for in-viewport ships when
    // scanner mode is active (host signals via shipTargets array). Ships
    // selected as the current _selectedTarget are skipped here; the
    // selected pass below will draw them in selected-ship colors.
    // Per Unit 2 (ship-scanner-2026-05-09): off-screen ships get an edge
    // arrow indicator instead of an in-viewport reticle. _drawShipReticle's
    // _project returns null for off-screen positions, so we branch here:
    // try the in-viewport draw first, fall back to off-screen arrow.
    if (shipTargets && shipTargets.length) {
      for (const ship of shipTargets) {
        if (selectedTarget && ship === selectedTarget) continue;
        const drewInViewport = this._drawShipReticle(ship, false);
        if (!drewInViewport) {
          this._drawShipOffscreenArrow(ship);
        }
      }
    }

    // Tentative (hover) — only if not already the selected target
    if (hoverTarget && hoverTarget !== selectedTarget) {
      this._drawTarget(hoverTarget, false);
    }
    if (selectedTarget) {
      // Ships use ship-colored brackets even when selected.
      if (selectedTarget.kind === 'ship') {
        this._drawShipReticle(selectedTarget, true);
      } else {
        this._drawTarget(selectedTarget, true);
      }
    }

    // ⭐ LAST, AND OVER EVERYTHING. The cut is one uniform erase across the
    // whole overlay rather than a per-element rule, because nothing else in
    // `src/` draws on this canvas — so ghosts, brackets, NAMES and the
    // off-screen chevron are all cut at the structure's real edge, which is
    // Max's answer ("see previous answer") to what should happen when a rib
    // covers a bracket but not its label.
    this._applyCabinMask();
  }

  /**
   * Erase whatever the cabin is standing in front of.
   *
   * `destination-out` keeps destination pixels where the SOURCE is transparent
   * and clears them where it is opaque — so a mask that is opaque exactly on
   * cabin structure cuts the reticles at that structure's silhouette, and a
   * fully transparent mask is a no-op. That is the whole mechanism.
   *
   * ⚠ THE COMPOSITE OP IS RESTORED IN A `finally`. This canvas is drawn on
   * every frame forever; leaving `destination-out` in force would mean the next
   * frame's brackets erase instead of paint, and the overlay would simply never
   * show anything again.
   */
  _applyCabinMask() {
    if (!this._maskSource) return;
    let mask = null;
    try {
      mask = this._maskSource();
    } catch (err) {
      // Once, not every frame — a mask that throws would otherwise bury the
      // console at 235 Hz. Uncut reticles are the pre-mask behaviour and are
      // survivable; a throw here would take the whole reticle layer down.
      if (!this._maskWarned) {
        this._maskWarned = true;
        console.warn('[RETICLE] cabin mask source failed; reticles will not be cut:', err);
      }
      return;
    }
    if (!mask || !mask.width || !mask.height) return;

    const ctx = this.ctx;
    // The mask's backing store matches this canvas's, so this is a 1:1 blit and
    // no resampling happens — but smoothing off is asserted rather than assumed,
    // because a softened edge is a visual change nobody would trace back here.
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'destination-out';
    // `destination-out` scales the erase by globalAlpha, so a stray value would
    // turn a cut into a dim ghost of a reticle showing through the fuselage.
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 1;
    try {
      ctx.drawImage(mask, 0, 0, this.canvas.width, this.canvas.height);
      this._lastFrame.maskAppliedAt = performance.now();
    } finally {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = prevAlpha;
      ctx.imageSmoothingEnabled = prevSmoothing;
    }
  }

  /**
   * Draw a small dim empty reticle for a sub-pixel body. Fixed size,
   * no name — just marks that something is there. Hover/click still work
   * because main.js's hitTestBodies uses mesh.position, not mesh.visible.
   */
  _drawGhost(target, age) {
    if (!target || !target.mesh) return;
    const screen = this._project(target.mesh.position);
    if (!screen) return;
    const ctx = this.ctx;
    ctx.save();

    // Lock-in animation: brackets start loose and tighten to default size.
    // easeOutCubic gives a snappy lock-in feel.
    const t = Math.min(1, age / this._ghostLockDuration);
    const eased = 1 - (1 - t) * (1 - t) * (1 - t); // easeOutCubic
    const half = GHOST_HALF * (this._ghostLockScale - (this._ghostLockScale - 1) * eased);
    // Fade opacity in during lock-in so brackets don't pop
    const alpha = 0.30 * Math.min(1, age / (this._ghostLockDuration * 0.5));
    const color = `rgba(120, 255, 140, ${alpha.toFixed(3)})`;

    this._drawBrackets(screen.x, screen.y, half, GHOST_ARM_LEN, GHOST_THICK, color);
    ctx.restore();
    this._recordDraw('ghost', target, screen, half, null);
  }

  _drawTarget(target, isSelected) {
    if (!target || !target.mesh) return;
    const screen = this._project(target.mesh.position);
    if (!screen) return;

    // Bracket half-width: body's projected radius + margin, so the brackets
    // always sit OUTSIDE the body's silhouette regardless of how close the
    // camera is. Floor at BRACKET_MIN_HALF so distant tiny bodies still have
    // a visible target square. Ceiling at viewport edge so huge near-field
    // planets don't push brackets off-screen entirely.
    const projR = this._projectedPixelRadius(target);
    const rawHalf = Math.max(BRACKET_MIN_HALF, projR + BRACKET_MARGIN);
    // Clamp so brackets stay inside the viewport (with margin for the arm + info)
    const maxHalfX = Math.max(BRACKET_MIN_HALF, Math.min(screen.x, this._bufW - screen.x) - BRACKET_EDGE_MARGIN);
    const maxHalfY = Math.max(BRACKET_MIN_HALF, Math.min(screen.y, this._bufH - screen.y) - BRACKET_EDGE_MARGIN);
    const half = Math.min(rawHalf, maxHalfX, maxHalfY);

    // ⛔ NO `ctx.scale(dpr)` ANY MORE. It existed to draw CSS-pixel geometry onto a
    // device-pixel backing store; the backing store is now the WORLD BUFFER and every constant
    // above is already in its units, so a transform here would scale them a second time.
    const ctx = this.ctx;
    ctx.save();

    let label = null;
    if (isSelected) {
      // Single-tone bright green — no glow layer
      this._drawBrackets(screen.x, screen.y, half, BRACKET_ARM_LEN, BRACKET_THICK_SEL, COLOR_SELECTED);
      if (target.name) {
        label = target.name.toUpperCase();
        this._drawNameBelow(screen.x, screen.y, half, label, NAME_COLOR_SELECTED);
      }
    } else {
      this._drawBrackets(screen.x, screen.y, half, BRACKET_ARM_LEN, BRACKET_THICK_TENT, COLOR_TENTATIVE);
      if (target.name) {
        label = target.name.toUpperCase();
        this._drawNameBelow(screen.x, screen.y, half, label, NAME_COLOR_TENTATIVE);
      }
    }

    ctx.restore();
    this._recordDraw(isSelected ? 'selected' : 'tentative', target, screen, half, label);
  }

  /**
   * Ship-scanner reticle. Mirror of _drawTarget but with cyan brackets +
   * label, and probe-tagged `kind: 'ship'` so the inspection layer
   * distinguishes ship reticles from body reticles in the inventory.
   * Per docs/WORKSTREAMS/ship-scanner-2026-05-09.md Unit 1.
   */
  _drawShipReticle(target, isSelected) {
    if (!target || !target.mesh) return false;
    const screen = this._project(target.mesh.position);
    if (!screen) return false;

    // Same sizing logic as _drawTarget, but ships are typically tiny so
    // bracketHalf usually falls to BRACKET_MIN_HALF — that's intentional,
    // ships should read as "something to find" not "something looming."
    const projR = this._projectedPixelRadius(target);
    const rawHalf = Math.max(BRACKET_MIN_HALF, projR + BRACKET_MARGIN);
    const maxHalfX = Math.max(BRACKET_MIN_HALF, Math.min(screen.x, this._bufW - screen.x) - BRACKET_EDGE_MARGIN);
    const maxHalfY = Math.max(BRACKET_MIN_HALF, Math.min(screen.y, this._bufH - screen.y) - BRACKET_EDGE_MARGIN);
    const half = Math.min(rawHalf, maxHalfX, maxHalfY);

    const ctx = this.ctx;
    ctx.save();

    let label = null;
    if (isSelected) {
      this._drawBrackets(screen.x, screen.y, half, BRACKET_ARM_LEN, BRACKET_THICK_SEL, COLOR_SHIP_SELECTED);
      if (target.name) {
        label = target.name.toUpperCase();
        this._drawNameBelow(screen.x, screen.y, half, label, NAME_COLOR_SHIP_SELECTED);
      }
    } else {
      this._drawBrackets(screen.x, screen.y, half, BRACKET_ARM_LEN, BRACKET_THICK_TENT, COLOR_SHIP_TENTATIVE);
      if (target.name) {
        label = target.name.toUpperCase();
        this._drawNameBelow(screen.x, screen.y, half, label, NAME_COLOR_SHIP_TENTATIVE);
      }
    }

    ctx.restore();
    // Record with kind='ship' so SceneInspector emits ui.reticle.ship.<name>
    // entries. The third arg to _recordDraw isn't kind directly — _recordDraw
    // reads `target.kind`. Ship targets MUST set kind='ship' upstream; the
    // host (main.js) ensures this when building shipTargets.
    this._recordDraw(isSelected ? 'selected' : 'tentative', target, screen, half, label);
    return true;
  }

  /**
   * Off-screen ship indicator. For ships outside the viewport, project
   * to NDC, drop the ones behind the camera, and draw a small chevron
   * at the viewport edge pointing toward the ship's actual direction.
   * Per docs/WORKSTREAMS/ship-scanner-2026-05-09.md Unit 2 (AC4).
   *
   * Records a synthetic inventory entry with kind='ship-offscreen' so
   * SceneInspector emits `ui.reticle.ship-offscreen.<bodyName>` entries
   * with `arrowAngle` field for predicate consumption.
   */
  _drawShipOffscreenArrow(target) {
    if (!target || !target.mesh) return;
    // Project ship to NDC. Bypass _project's culling to get the raw NDC.
    _v.copy(target.mesh.position).project(this.camera);
    // z > 1 means behind camera. Skip — direction is ambiguous (the body's
    // projection inverts when behind the eye plane, producing nonsense
    // arrow angles).
    if (_v.z > 1 || _v.z < -1) return;

    // Direction from viewport center to ship's projected position, in
    // CSS-pixel space (NDC y is flipped vs screen y).
    const dirX = _v.x;
    const dirY = -_v.y;
    const len = Math.hypot(dirX, dirY);
    if (len < 1e-6) return;  // ship projects exactly to center; no direction

    const nx = dirX / len;
    const ny = dirY / len;

    // Clamp to viewport edge with margin. Find the smaller t such that
    // |nx * t| or |ny * t| reaches the edge minus margin.
    // ⛔ BUFFER, NOT CSS. `_project` returns buffer px and this places the chevron in the same
    // space; left on the CSS extent the chevron is parked ~4.7x outside the buffer and is simply
    // never drawn — the off-screen indicator would silently stop existing.
    const halfW = this._bufW * 0.5;
    const halfH = this._bufH * 0.5;
    const margin = CHEVRON_EDGE_MARGIN;  // buffer pixels from viewport edge
    const tX = Math.abs(nx) > 1e-6 ? (halfW - margin) / Math.abs(nx) : Infinity;
    const tY = Math.abs(ny) > 1e-6 ? (halfH - margin) / Math.abs(ny) : Infinity;
    const t = Math.min(tX, tY);

    const screenX = halfW + nx * t;
    const screenY = halfH + ny * t;
    const arrowAngle = Math.atan2(ny, nx);

    // Draw the chevron. ⛔ NOT `translate`/`rotate` + `fill()`: a rotated path is antialiased
    // unconditionally, and a soft-edged arrow on a canvas whose whole premise is hard texels is
    // exactly the "chrome sitting on top" seam this workstream exists to close. Rasterised by
    // hand instead, which keeps the rotation CONTINUOUS — snapping to eight directions would make
    // the arrow lie about where the ship is, and pointing accurately is its entire job.
    this._fillTriangleTexels(screenX, screenY, arrowAngle, CHEVRON, COLOR_SHIP_TENTATIVE);

    // Record the off-screen indicator as a synthetic inventory entry.
    // kind='ship-offscreen' produces `ui.reticle.ship-offscreen.<bodyName>`
    // via SceneInspector's existing naming convention.
    const rawName = (target.name || '').toString();
    const bodyName = rawName ? rawName.toLowerCase().replace(/\s+/g, '_') : _targetKey(target);
    this._lastFrame.entries.push({
      state: 'offscreen',
      kind: 'ship-offscreen',
      bodyName,
      label: target.name ? target.name.toUpperCase() : null,
      // CSS px on the way OUT — see `_recordDraw` for why the probe's contract is CSS.
      x: screenX * this._magX,
      y: screenY * this._magY,
      bracketHalf: CHEVRON[0][0] * this._magY,  // arrow's tip-extent; nominal, for predicate compatibility
      frameDrawCount: 1,
      arrowAngle,
      offscreen: true,
    });
    this._lastFrame.drawCallsThisFrame += 1;
  }

  /**
   * Fill a rotated triangle as whole texels — a point-in-triangle test at each pixel CENTRE, so
   * every pixel is fully on or fully off and the shape is hard-edged at any angle.
   *
   * ⚠ THE HALF-PIXEL IS LOAD-BEARING. Testing at `(x, y)` rather than `(x + 0.5, y + 0.5)` tests
   * the pixel's top-left CORNER, which shifts the whole shape half a texel up-left and drops the
   * tip on shallow angles. The bounding box is at most ~9x9, so this is ~81 tests per chevron.
   *
   * @param {number} cx @param {number} cy centre, in buffer px
   * @param {number} angle radians; the model points along +X before rotation
   * @param {number[][]} model three [x, y] vertices, in buffer px, relative to the centre
   * @param {string} color
   */
  _fillTriangleTexels(cx, cy, angle, model, color) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const v = model.map(([x, y]) => [cx + x * ca - y * sa, cy + x * sa + y * ca]);
    const [a, b, c] = v;
    // Twice the signed area. Zero means the three points are collinear and there is nothing to
    // fill — bail rather than divide by it and fill the whole bounding box with NaN comparisons.
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (!Number.isFinite(den) || Math.abs(den) < 1e-9) return;
    const x0 = Math.floor(Math.min(a[0], b[0], c[0]));
    const x1 = Math.ceil(Math.max(a[0], b[0], c[0]));
    const y0 = Math.floor(Math.min(a[1], b[1], c[1]));
    const y1 = Math.ceil(Math.max(a[1], b[1], c[1]));
    const ctx = this.ctx;
    ctx.fillStyle = color;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den;
        const l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den;
        if (l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  _clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._lastFrame.lastClearAt = performance.now();
  }

  /**
   * Inspection-layer probe accessor. Returns a serializable snapshot of
   * the most recent update() call's draw state. SceneInspector reads
   * this via setReticleProvider to surface ui.reticle.* synthetic
   * entries in takeSceneInventory().
   *
   * The returned object is a fresh shallow copy; entries are referentially
   * stable within a single update() but should not be mutated by callers.
   */
  getLastFrameState() {
    return {
      canvasW: this._lastFrame.canvasW,
      canvasH: this._lastFrame.canvasH,
      dpr: this._lastFrame.dpr,
      // ⭐ THE LIVENESS PROBE FOR THE SHARED RENDER BUFFER. `RetroRenderer.resize()` is the only
      // writer of RENDER_BUFFER and until step 5 nothing read it, so step 1(c) was inert and could
      // not be verified. These three are what a live check compares against `sceneTarget`.
      bufferW: this._bufW,
      bufferH: this._bufH,
      magnification: this._magY,
      lastClearAt: this._lastFrame.lastClearAt,
      drawCallsThisFrame: this._lastFrame.drawCallsThisFrame,
      maskAppliedAt: this._lastFrame.maskAppliedAt,
      entries: this._lastFrame.entries.slice(),
    };
  }

  _recordDraw(state, target, screen, half, label) {
    if (!target) return;
    const kind = target.kind || 'unknown';
    const rawName = (target.name || '').toString();
    const bodyName = rawName ? rawName.toLowerCase().replace(/\s+/g, '_') : _targetKey(target);
    let existing = null;
    for (const e of this._lastFrame.entries) {
      if (e.kind === kind && e.bodyName === bodyName) { existing = e; break; }
    }
    // ⛔ CONVERT ON THE WAY OUT — THE PROBE'S CONTRACT IS CSS PIXELS AND IS NOT NEGOTIABLE.
    // `integration-suite.js:1103` compares these against SceneInspector's screen space, which is
    // `renderer.domElement.clientWidth/Height` with a ±2 px tolerance, and `main.js:2865-2878`
    // compares the same numbers against synthetic mouse `clientX/clientY`. Reporting buffer px
    // would put every entry ~4.7x off at 240p and quietly break both.
    const csx = screen.x * this._magX;
    const csy = screen.y * this._magY;
    const csHalf = half * this._magY;
    if (existing) {
      existing.frameDrawCount += 1;
      // The latest draw "wins" for reported state/position — same as
      // visually the latest draw is what the user sees on top.
      existing.state = state;
      existing.x = csx;
      existing.y = csy;
      existing.bracketHalf = csHalf;
      existing.label = label || null;
    } else {
      this._lastFrame.entries.push({
        state,
        kind,
        bodyName,
        label: label || null,
        x: csx,
        y: csy,
        bracketHalf: csHalf,
        frameDrawCount: 1,
      });
    }
    this._lastFrame.drawCallsThisFrame += 1;
  }

  dispose() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
