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

// Bracket sizing (scales with projected body radius so big bodies get big brackets)
const BRACKET_MIN_HALF = 16;  // px — smallest half-width of bracket square
const BRACKET_MAX_HALF = 9999; // px — body fills screen (camera on body, dist<=0); callers clamp to viewport
const BRACKET_MARGIN   = 12;  // px — gap between bracket square and body edge
const BRACKET_EDGE_MARGIN = 40; // px — keep brackets this far from viewport edge
const BRACKET_ARM_LEN = 12;   // px — length of each L arm
const BRACKET_THICK_TENT = 3;
const BRACKET_THICK_SEL  = 4;

// Ghost reticle (sub-pixel bodies): fixed size independent of body radius,
// so every distant body reads as the same quiet marker. Sized for a chunky
// retro feel so it doesn't get lost against the starfield.
const GHOST_HALF      = 14;   // px — half-width of ghost bracket square
const GHOST_ARM_LEN   = 8;    // px — length of each L arm
const GHOST_THICK     = 3;    // px — line thickness (matches retro pixelScale)

// Pixel grid size — brackets snap to this for retro chunky look
const PX = 3; // matches retro renderer pixelScale

// Name label style — centered in the negative space below the bottom brackets
const NAME_FONT = '16px "Pixelify Sans", system-ui';
const NAME_COLOR_SELECTED  = 'rgba(160, 255, 180, 0.95)';
const NAME_COLOR_TENTATIVE = 'rgba(140, 220, 140, 0.75)';
const NAME_BOTTOM_PAD = 6;    // px — gap between bottom bracket edge and name baseline

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

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this._dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * this._dpr);
    this.canvas.height = Math.round(h * this._dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this._cssW = w;
    this._cssH = h;
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
    const x = (_v.x * 0.5 + 0.5) * this._cssW;
    const y = (-_v.y * 0.5 + 0.5) * this._cssH;
    // Off-screen cull (with margin)
    if (x < -200 || x > this._cssW + 200 || y < -200 || y > this._cssH + 200) return null;
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
    const pixelRadius = (angularRadius / (fov * 0.5)) * (this._cssH * 0.5);
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
    const h = Math.round(half / PX) * PX;
    const arm = Math.max(3, Math.round(armLen / PX));
    const t = Math.max(1, Math.round(thickness / PX)) * PX;

    // Four corners: sx/sy point from center toward the corner
    const signs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [sx, sy] of signs) {
      // Outer corner point
      const ox = cx + sx * h;
      const oy = cy + sy * h;

      // Horizontal arm: along the outer edge, running inward (toward center)
      for (let i = 0; i < arm; i++) {
        const bx = ox - sx * i * PX;
        ctx.fillRect(bx - (sx > 0 ? 0 : t - PX), oy - (sy > 0 ? 0 : t - PX), t, t);
      }

      // Vertical arm: offset 1 block inward on the horizontal axis,
      // running inward (toward center) on the vertical axis.
      // Starts 1 block from the corner (block 0 is the step/gap).
      for (let i = 1; i < arm; i++) {
        const by = oy - sy * i * PX;
        const vx = ox + sx * PX; // 1 block inward on X
        ctx.fillRect(vx - (sx > 0 ? 0 : t - PX), by - (sy > 0 ? 0 : t - PX), t, t);
      }
    }
  }

  /**
   * Draw the name label centered horizontally on the body, sitting just
   * below the bottom edge of the bracket square (in the negative space
   * between the bottom-left and bottom-right corner brackets).
   */
  _drawNameBelow(cx, cy, half, text, color) {
    if (!text) return;
    const ctx = this.ctx;
    ctx.font = NAME_FONT;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, cx, cy + half + NAME_BOTTOM_PAD);
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
    ctx.scale(this._dpr, this._dpr);

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
    const maxHalfX = Math.max(BRACKET_MIN_HALF, Math.min(screen.x, this._cssW - screen.x) - BRACKET_EDGE_MARGIN);
    const maxHalfY = Math.max(BRACKET_MIN_HALF, Math.min(screen.y, this._cssH - screen.y) - BRACKET_EDGE_MARGIN);
    const half = Math.min(rawHalf, maxHalfX, maxHalfY);

    // Scale the canvas for high-DPR rendering
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this._dpr, this._dpr);

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
    const maxHalfX = Math.max(BRACKET_MIN_HALF, Math.min(screen.x, this._cssW - screen.x) - BRACKET_EDGE_MARGIN);
    const maxHalfY = Math.max(BRACKET_MIN_HALF, Math.min(screen.y, this._cssH - screen.y) - BRACKET_EDGE_MARGIN);
    const half = Math.min(rawHalf, maxHalfX, maxHalfY);

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this._dpr, this._dpr);

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
    const halfW = this._cssW * 0.5;
    const halfH = this._cssH * 0.5;
    const margin = 32;  // CSS pixels from viewport edge
    const tX = Math.abs(nx) > 1e-6 ? (halfW - margin) / Math.abs(nx) : Infinity;
    const tY = Math.abs(ny) > 1e-6 ? (halfH - margin) / Math.abs(ny) : Infinity;
    const t = Math.min(tX, tY);

    const screenX = halfW + nx * t;
    const screenY = halfH + ny * t;
    const arrowAngle = Math.atan2(ny, nx);

    // Draw the chevron.
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this._dpr, this._dpr);
    ctx.translate(screenX, screenY);
    ctx.rotate(arrowAngle);
    ctx.fillStyle = COLOR_SHIP_TENTATIVE;
    // Filled triangle pointing in +X (then rotation places it correctly).
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-7, -7);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

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
      x: screenX,
      y: screenY,
      bracketHalf: 10,  // arrow's tip-extent; nominal value for predicate compatibility
      frameDrawCount: 1,
      arrowAngle,
      offscreen: true,
    });
    this._lastFrame.drawCallsThisFrame += 1;
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
    if (existing) {
      existing.frameDrawCount += 1;
      // The latest draw "wins" for reported state/position — same as
      // visually the latest draw is what the user sees on top.
      existing.state = state;
      existing.x = screen.x;
      existing.y = screen.y;
      existing.bracketHalf = half;
      existing.label = label || null;
    } else {
      this._lastFrame.entries.push({
        state,
        kind,
        bodyName,
        label: label || null,
        x: screen.x,
        y: screen.y,
        bracketHalf: half,
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
