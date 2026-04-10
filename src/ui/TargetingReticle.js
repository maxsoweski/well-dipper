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

// Bracket sizing (scales with projected body radius so big bodies get big brackets)
const BRACKET_MIN_HALF = 16;  // px — smallest half-width of bracket square
const BRACKET_MARGIN   = 12;  // px — gap between bracket square and body edge
const BRACKET_EDGE_MARGIN = 40; // px — keep brackets this far from viewport edge
const BRACKET_ARM_LEN = 10;   // px — length of each L arm
const BRACKET_THICK_TENT = 1.5;
const BRACKET_THICK_SEL  = 2.5;

// Ghost reticle (sub-pixel bodies): fixed size independent of body radius,
// so every distant body reads as the same quiet marker. Sized for a chunky
// retro feel so it doesn't get lost against the starfield.
const GHOST_HALF      = 14;   // px — half-width of ghost bracket square
const GHOST_ARM_LEN   = 6;    // px — length of each L arm
const GHOST_THICK     = 2;    // px — line thickness

// Name label style — centered in the negative space below the bottom brackets
const NAME_FONT = '12px "DotGothic16", monospace';
const NAME_COLOR_SELECTED  = 'rgba(160, 255, 180, 0.95)';
const NAME_COLOR_TENTATIVE = 'rgba(140, 220, 140, 0.75)';
const NAME_BOTTOM_PAD = 4;    // px — gap between bottom bracket edge and name baseline

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

    this._resize();
    window.addEventListener('resize', () => this._resize());

    // Hidden by default — shown when enabled
    this.enabled = true;
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
   * Draw a set of corner brackets of half-width `half` centered at (cx, cy).
   * Corner brackets are four L-shapes at the corners of a square.
   */
  _drawBrackets(cx, cy, half, armLen, thickness, color) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'square';
    ctx.beginPath();

    const corners = [
      { x: cx - half, y: cy - half, hx: 1,  vy: 1 },   // top-left
      { x: cx + half, y: cy - half, hx: -1, vy: 1 },   // top-right
      { x: cx - half, y: cy + half, hx: 1,  vy: -1 },  // bottom-left
      { x: cx + half, y: cy + half, hx: -1, vy: -1 },  // bottom-right
    ];
    for (const c of corners) {
      // Horizontal arm
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + c.hx * armLen, c.y);
      // Vertical arm
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x, c.y + c.vy * armLen);
    }
    ctx.stroke();
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
    if (!this.enabled) {
      this._clear();
      return;
    }
    this._clear();
    if (!state) return;

    const { hoverTarget, selectedTarget, ghostTargets } = state;

    // Ghost pass first: small dim empty brackets for every sub-pixel body
    // that isn't currently being hovered or selected. Hover/select states
    // take visual priority and render on top.
    if (ghostTargets && ghostTargets.length) {
      for (const ghost of ghostTargets) {
        if (_isSameBody(ghost, hoverTarget)) continue;
        if (_isSameBody(ghost, selectedTarget)) continue;
        this._drawGhost(ghost);
      }
    }

    // Tentative (hover) — only if not already the selected target
    if (hoverTarget && hoverTarget !== selectedTarget) {
      this._drawTarget(hoverTarget, false);
    }
    if (selectedTarget) {
      this._drawTarget(selectedTarget, true);
    }
  }

  /**
   * Draw a small dim empty reticle for a sub-pixel body. Fixed size,
   * no name — just marks that something is there. Hover/click still work
   * because main.js's hitTestBodies uses mesh.position, not mesh.visible.
   */
  _drawGhost(target) {
    if (!target || !target.mesh) return;
    const screen = this._project(target.mesh.position);
    if (!screen) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this._dpr, this._dpr);
    this._drawBrackets(screen.x, screen.y, GHOST_HALF, GHOST_ARM_LEN, GHOST_THICK, COLOR_GHOST);
    ctx.restore();
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

    if (isSelected) {
      // Draw outer glow first
      this._drawBrackets(screen.x, screen.y, half + 2, BRACKET_ARM_LEN + 2, BRACKET_THICK_SEL + 1.5, COLOR_SELECTED_GLOW);
      this._drawBrackets(screen.x, screen.y, half, BRACKET_ARM_LEN, BRACKET_THICK_SEL, COLOR_SELECTED);
      if (target.name) {
        this._drawNameBelow(screen.x, screen.y, half, target.name.toUpperCase(), NAME_COLOR_SELECTED);
      }
    } else {
      this._drawBrackets(screen.x, screen.y, half, BRACKET_ARM_LEN, BRACKET_THICK_TENT, COLOR_TENTATIVE);
      if (target.name) {
        this._drawNameBelow(screen.x, screen.y, half, target.name.toUpperCase(), NAME_COLOR_TENTATIVE);
      }
    }

    ctx.restore();
  }

  _clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  dispose() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
