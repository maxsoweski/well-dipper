/**
 * panelPose — where a screen has to be for it to fill the pilot's view.
 *
 * Lane F, workstream `cockpit-zoom-to-panel-2026-07-29`, AC-POSE-DERIVED and
 * AC-EASE-LANDS-EXACTLY.
 *
 * ── WHAT THIS IS FOR ────────────────────────────────────────────────────────
 *
 * Max: "a system by which the screen will move up to fill the player's view,
 * centered, so we can interact with the full menu ... let's make the system for
 * moving around these screens flexible so that it will not need to be totally
 * reworked if we update the position of the screens in the future."
 *
 * The second half of that sentence is the one with teeth, and it is not a
 * hypothetical worry. The cockpit's panel face has already been FIVE different
 * sizes on this project, and its ASPECT changed once (3:2 to 6:5) — because the
 * metres are the output of a fit solver that re-runs every time the cabin is
 * re-proportioned, and lane E is still re-proportioning it. Any distance written
 * down here is wrong by the next regeneration of the GLB.
 *
 * So nothing is written down. This module takes the panel's MEASURED shape and
 * the camera's OWN optics and solves. Change the model and the answer changes
 * with it, with no edit here.
 *
 * ── WHY THIS FILE IMPORTS NOTHING ───────────────────────────────────────────
 *
 * Not even three. The vectors and quaternions belong in `PanelMover`, which owns
 * the scene graph; what lives here is the arithmetic, so that the arithmetic can
 * be proved in plain node — this repo's vitest has no jsdom, no happy-dom and no
 * WebGL. One place the maths lives, and the thing the tests prove is the thing
 * the game runs. It is the same split `PanelLayout.measureQuad` already uses: a
 * pure function fed from both the raw-GLB parser in tests and three.js at runtime.
 *
 * ── PIXEL FRACTION, NOT ANGULAR FRACTION ────────────────────────────────────
 *
 * "Fills the player's view" is judged by eye, so the quantity being solved for is
 * the fraction of the SCREEN the panel covers — not the fraction of the field of
 * view it subtends in angle. A perspective projection is not linear in angle, so
 * these are genuinely different numbers:
 *
 *     pixel fraction   = (height/2) / (d * tan(fov/2))       <- what we solve
 *     angular fraction = 2*atan((height/2)/d) / fov
 *
 * At the game's 70 degrees they diverge by several percent at large fills, which
 * is visible on the glass. Solving the angular form yields a panel that measures
 * correct on a protractor and looks wrong in the cockpit. AC-ZOOM-FILLS-THE-VIEW
 * measures the RENDERED FRAME, so this module solves the same quantity that AC
 * observes — otherwise the contract and the code disagree by construction and
 * whichever one is consulted first wins.
 *
 * ── WHY BOTH AXES ARE CHECKED ───────────────────────────────────────────────
 *
 * Both panel faces this project has shipped are relatively taller than a 16:9
 * viewport, so HEIGHT binds for both, so a solver that only ever looks at height
 * is indistinguishable from a correct one on every real input. That is precisely
 * the kind of hidden assumption a future re-fit turns into a panel hanging off the
 * side of the screen. The larger of the two distances is taken, so the binding
 * axis lands exactly on the requested fill and the other comes in under it.
 *
 * A consequence worth stating plainly, because it will otherwise be filed as a
 * bug: a 6:5 panel CANNOT fill a 16:9 view edge to edge. It fills top to bottom
 * and leaves margins at the sides. Making it reach the sides would mean stretching
 * the content, and the content is a nav computer.
 */

/**
 * The game's field of view, in degrees — `src/ui/Settings.js:40`.
 *
 * Exported so callers name it rather than typing 70, and so the lab and the game
 * are visibly quoting the same source. It is a DEFAULT, not a law: every solve
 * takes the live camera's fov, because the cockpit lab runs an inspection camera
 * at a different one and a panel that ignored it would be solved for a view
 * nobody is looking through.
 */
export const GAME_FOV_DEG = 70;

/** Degrees to radians. Named because the conversion appearing inline three times is how one of them ends up missing. */
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Reject a value that would make the solve meaningless, naming the field.
 *
 * Zero is the value that matters and it is worth being specific about why: an
 * unmeasured panel reports zero, and a zero height turns the division into
 * Infinity rather than into an error. The panel is then placed infinitely far
 * away, renders as nothing at all, and the symptom is "the zoom does nothing" —
 * which reads as a missing feature rather than as bad input.
 */
function positive(value, field) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `panelPose: ${field} must be a positive finite number, got ${value}. ` +
      `A zero or missing ${field} is the signature of a panel that was never measured, ` +
      `and the distance derived from it would be Infinity — the panel would be placed ` +
      `where nothing is visible, which looks exactly like the zoom not working.`,
    );
  }
  return value;
}

/**
 * How far from the eye a panel must sit to cover `fill` of the viewport.
 *
 * Every input is a measured or live quantity. `width` and `height` come from
 * `PanelLayout.measureQuad` over the mesh's world vertices; `fovDeg` and `aspect`
 * come off the camera being rendered through, read per solve rather than captured
 * once, because the lab lets both change while the page is open.
 *
 * @param {object} p
 * @param {number} p.width   the panel's measured width, in metres
 * @param {number} p.height  the panel's measured height, in metres
 * @param {number} p.fovDeg  the camera's VERTICAL field of view, in degrees
 * @param {number} p.aspect  the viewport's width/height
 * @param {number} p.fill    the fraction of the viewport to cover, 0 < fill
 * @returns {{distance:number, bindingAxis:'height'|'width',
 *            coverage:{vertical:number, horizontal:number}}}
 */
export function solveFillDistance({ width, height, fovDeg = GAME_FOV_DEG, aspect, fill } = {}) {
  positive(width, 'width');
  positive(height, 'height');
  positive(aspect, 'aspect');
  positive(fill, 'fill');
  if (!Number.isFinite(fovDeg) || fovDeg <= 0 || fovDeg >= 180) {
    throw new Error(
      `panelPose: fov must be a finite angle strictly between 0 and 180 degrees, got ${fovDeg}. ` +
      `At 0 the view has no extent and at 180 the half-angle tangent is infinite, so both ` +
      `place the panel nowhere rather than reporting a bad camera.`,
    );
  }

  // The half-height of the view at unit distance. Everything below is this one
  // quantity scaled: vertically by itself, horizontally by the viewport aspect.
  const halfV = Math.tan(rad(fovDeg) / 2);

  // Solve each axis independently for the distance at which THAT axis covers
  // `fill`, then take the larger. The larger one is the constraint: at any
  // shorter distance the panel overflows on that axis.
  const forHeight = (height / 2) / (fill * halfV);
  const forWidth = (width / 2) / (fill * halfV * aspect);

  const bindingAxis = forHeight >= forWidth ? 'height' : 'width';
  const distance = Math.max(forHeight, forWidth);

  return {
    distance,
    bindingAxis,
    // Returned so a caller — and the lab's probe — can see what the OTHER axis
    // came to without re-deriving the projection and getting it subtly different.
    coverage: {
      vertical: (height / 2) / (distance * halfV),
      horizontal: (width / 2) / (distance * halfV * aspect),
    },
  };
}

/**
 * Cubic ease-out, clamped.
 *
 * Cubic-out rather than smoothstep is a recorded taste decision, not a default:
 * Max evaluated curves for `AutopilotMotion` and chose it for the firmer terminal
 * landing, having found smoothstep's symmetric asymptotic tail mushy. The two are
 * a one-line swap and the swap is invisible in a diff summary, which is why the
 * test asserts the distinction rather than trusting this comment to survive.
 *
 * It returns EXACTLY 1 at t = 1, and that exactness is load-bearing rather than
 * pedantic. The mover interpolates between the measured rest pose and the solved
 * target; a curve terminating at 0.9999999 leaves the panel permanently a fraction
 * off both of them, and since the rest pose is re-measured rather than restored
 * from a cache, the error is free to accumulate across zoom/dismiss cycles.
 * AC-REST-IS-RESTORED runs ten of them looking for exactly that drift.
 *
 * @param {number} t progress in [0,1]; outside that range it clamps
 * @returns {number}
 */
export function cubicOut(t) {
  if (!Number.isFinite(t) || t <= 0) return 0;
  if (t >= 1) return 1;
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}
