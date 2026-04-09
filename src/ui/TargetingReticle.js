/**
 * TargetingReticle — canvas overlay that draws corner-bracket reticles
 * over selectable in-system bodies.
 *
 * Three visual states per body:
 *   - None      — no reticle
 *   - Tentative — dim, semi-transparent (mouse hover)
 *   - Selected  — bright, fully opaque + info line (clicked target;
 *                 persists through the burn travel and into orbit)
 *
 * The renderer is driven by main.js each frame. It does NOT track state
 * itself — main.js owns `hoverTarget` and `selectedTarget` and passes
 * them in. This keeps the reticle a pure view: no business logic.
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
import { SOLAR_RADIUS_AU, EARTH_RADIUS_AU, AU_TO_SCENE } from '../core/ScaleConstants.js';

// 1 R☉ ≈ 4.65 scene units, 1 R⊕ ≈ 0.0426 scene units
const SOLAR_RADIUS_SCENE = SOLAR_RADIUS_AU * AU_TO_SCENE;
const EARTH_RADIUS_SCENE = EARTH_RADIUS_AU * AU_TO_SCENE;

// Colors
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

// Info line style
const INFO_FONT = '11px "DotGothic16", monospace';
const INFO_COLOR_SELECTED = 'rgba(160, 255, 180, 0.95)';
const INFO_COLOR_TENTATIVE = 'rgba(140, 220, 140, 0.75)';
const INFO_LINE_HEIGHT = 13;

// Reusable scratch objects
const _v = new THREE.Vector3();

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
   * Draw the info block anchored at the bottom-right of the bracket square.
   * First line (name) is at the baseline aligned with the bracket's bottom
   * edge; subsequent lines (type, distance) are indented and stack downward.
   */
  _drawInfoLine(cx, cy, half, lines, color) {
    if (!lines || lines.length === 0) return;
    const ctx = this.ctx;
    ctx.font = INFO_FONT;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    // Anchor: just to the right of the bracket's bottom-right corner,
    // slightly below so the first line aligns with the bottom bracket arms.
    const tx = cx + half + 6;
    const ty = cy + half - INFO_LINE_HEIGHT + 2;
    const indentPx = 8; // indent for secondary lines (type, distance)
    for (let i = 0; i < lines.length; i++) {
      const x = i === 0 ? tx : tx + indentPx;
      ctx.fillText(lines[i], x, ty + i * INFO_LINE_HEIGHT);
    }
  }

  /**
   * Main render entry point. Called once per frame from main.js.
   *
   * @param {Object} state
   *   @param {Object|null} state.hoverTarget  — the body under the mouse
   *   @param {Object|null} state.selectedTarget — the locked target
   *   Each target: { mesh, radius, name, type, kind } (kind='star'|'planet'|'moon')
   */
  update(state) {
    if (!this.enabled) {
      this._clear();
      return;
    }
    this._clear();
    if (!state) return;

    const { hoverTarget, selectedTarget } = state;

    // Draw tentative first (so selected always overlays if they coincide)
    if (hoverTarget && hoverTarget !== selectedTarget) {
      this._drawTarget(hoverTarget, false);
    }
    if (selectedTarget) {
      this._drawTarget(selectedTarget, true);
    }
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
      // Info line
      const lines = this._buildInfoLines(target, true);
      this._drawInfoLine(screen.x, screen.y, half, lines, INFO_COLOR_SELECTED);
    } else {
      this._drawBrackets(screen.x, screen.y, half, BRACKET_ARM_LEN, BRACKET_THICK_TENT, COLOR_TENTATIVE);
      // Tentative info: just the name (if available)
      if (target.name) {
        this._drawInfoLine(screen.x, screen.y, half, [target.name], INFO_COLOR_TENTATIVE);
      }
    }

    ctx.restore();
  }

  _buildInfoLines(target, isSelected) {
    const lines = [];
    if (target.name) lines.push(target.name.toUpperCase());
    if (target.type) lines.push(target.type);
    if (isSelected) {
      const size = this._formatSize(target);
      if (size) lines.push(size);
      if (target.mesh) {
        const dist = this.camera.position.distanceTo(target.mesh.position);
        lines.push(this._formatDistance(dist));
      }
    }
    return lines;
  }

  /**
   * Format a body's physical radius for display.
   *   Stars            → solar radii  (R☉)
   *   Planets / moons  → Earth radii  (R⊕)
   *   Tiny bodies      → kilometers   (R⊕ < 0.1 falls back to km)
   */
  _formatSize(target) {
    const sceneRadius = target.radius || 0;
    if (sceneRadius <= 0) return null;

    if (target.kind === 'star') {
      const rSun = sceneRadius / SOLAR_RADIUS_SCENE;
      if (rSun >= 100) return `${rSun.toFixed(0)} R☉`;
      if (rSun >= 10)  return `${rSun.toFixed(1)} R☉`;
      return `${rSun.toFixed(2)} R☉`;
    }

    // Planets, moons — Earth radii, falling back to km for tiny bodies.
    const rEarth = sceneRadius / EARTH_RADIUS_SCENE;
    if (rEarth >= 10)  return `${rEarth.toFixed(1)} R⊕`;
    if (rEarth >= 0.1) return `${rEarth.toFixed(2)} R⊕`;
    const km = sceneRadius * 149600;
    return `${km.toFixed(0)} km`;
  }

  /**
   * Format a scene-unit distance into a human-readable label.
   * 1 AU = 1000 scene units = 1.496e8 km = 149.6 Mm (megameters).
   *
   * Thresholds:
   *   < 100 km      → "X km"      (very close, tens of km)
   *   < 1000 km     → "X km"      (hundreds of km)
   *   < 100,000 km  → "X Mm"      (megameters — close orbital distances)
   *   < 0.5 AU      → "X Mm"      (still use Mm for fractional AU)
   *   otherwise     → "X AU"
   */
  _formatDistance(sceneUnits) {
    const KM_PER_SCENE = 149600; // 1 scene unit = 149,600 km
    const km = sceneUnits * KM_PER_SCENE;
    if (km < 1000)     return `${km.toFixed(0)} km`;
    if (km < 100000)   return `${(km / 1000).toFixed(1)} Mm`;
    const au = sceneUnits / 1000;
    if (au < 0.5)      return `${(km / 1000).toFixed(0)} Mm`;
    if (au < 10)       return `${au.toFixed(3)} AU`;
    return `${au.toFixed(2)} AU`;
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
