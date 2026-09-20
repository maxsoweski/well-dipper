/**
 * navViewModes/designs.js — DESIGN 1 AND DESIGN 2, LIFTED VERBATIM OUT OF `nav-240p-lab.html`.
 *
 * ── ⛔ THIS FILE WAS EXTRACTED BY SCRIPT, NOT RETYPED, AND THAT IS THE POINT ────────────────────
 *
 * Max ruled on two PICTURES, not on two descriptions: *"I love both 1 and 2 for both; I want all of
 * these modes!"*, said against `nav-240p-lab.html` (`b7c8155`) rendering at exactly 427x240 with the
 * shipped face and the game's own data. Any hand-transcription of ~500 lines of texel-exact draw
 * code is a chance to ship a picture he did not rule on, and the drift would be invisible — it looks
 * like a design decision, not like a typo. So the bodies below are byte-identical to the lab's, and
 * the diff against it is the audit.
 *
 * ⭐ WHAT MADE THAT POSSIBLE IS THE LAB'S OWN SHAPE. Every design function reads exactly two
 * module-level objects — `S` (what the view is showing) and `D` (the data behind it) — and calls a
 * handful of primitives. Nothing reads a DOM node, a key handler or a canvas directly. So the whole
 * block drops into a FACTORY: the caller passes `S` and `D` in, they become closure variables under
 * the same names, and not one line of the design code has to know it moved.
 *
 * ⛔ WHICH MEANS `S` AND `D` MUST BE MUTATED, NEVER REPLACED. The closures captured those two
 * identities once. `buildViewState` writes fields onto the same objects every frame; assigning a
 * fresh object would leave every design drawing the state of the frame the factory was built on —
 * a stale picture that repaints happily and never updates.
 *
 * ⛔ DESIGN 3 IS NOT HERE AND MUST NOT BE ADDED. All three judges killed it for deriving the
 * fullscreen layout from the 52x43 cockpit panel, which is the exact inverse of Max's ruling that
 * the fullscreen nav is the SOURCE and the panel is a representation of it. Its central mechanism
 * also does not exist: it needs `__navFit` to abbreviate `[ WARP ]` to `WRP`, and `__navFit`
 * truncates from the right.
 *
 * ── THE FOUR DELIBERATE DEPARTURES FROM THE LAB, ALL OF THEM PLUMBING ───────────────────────────
 *
 *  1. `fire()` reports through an injected `onViolation` instead of `console.error`, so a headless
 *     test can assert the guard fired rather than scrape a console.
 *  2. `lumImage`'s async CPU fallback no longer calls the lab's `draw()`. The nav repaints
 *     continuously, so filling the cache is enough; calling a redraw would be a second animation
 *     loop fighting the first.
 *  3. `zoomIdx` moved onto `S` — in the lab it was a module-level key-handler variable.
 *  4. `PixelText` and the face arrive as parameters rather than imports, so a test can drive the
 *     designs against a recording context with no module graph.
 *
 * ⭐ THE GUARD CAME WITH THEM, AND IT IS THE REASON THIS PORT CAN BE TRUSTED. `assertFits` /
 * `assertClear` were proved by sabotage in the lab and caught four real defects before that. A
 * layout that overflows its region LOOKS fine on a canvas, because the canvas clips the overflow for
 * free — the guard is the only thing between "this design fits" and "this design was cropped".
 */

import { FACE as DEFAULT_FACE, drawPixelText as defaultDraw, measurePixelText as defaultMeasure } from '../../rendering/PixelText.js';

/** `NavComputer.js:69`, verbatim — the density model's stars-per-pc^3 conversion. */
const DENSITY_TO_STARS_PER_PC3 = 0.14 / 0.065;

/** The sabotage string, kept from the lab: `S.sabotage` appends it to each design's longest single
 *  line and hands the UNCLIPPED result to `assertFits`, so the guard is PROVED to fire on demand
 *  rather than asserted to work. ⛔ A guard that has never been made to fail is not yet a guard. */
const SAB = '   SABOTAGE: THIS STRING IS DELIBERATELY LONGER THAN THE ROW IT IS DRAWN INTO AND THE GUARD MUST SAY SO';

/**
 * Build the design painters over one `S` / `D` pair.
 *
 * @param {object}   io
 * @param {object}   io.S  view state — MUTATED in place each frame, never replaced
 * @param {object}   io.D  data bundle — likewise
 * @param {Function} [io.onViolation]  called with a message when the layout guard fires
 * @param {object}   [io.face]  the PixelText face (defaults to the shipped one)
 */
export function makeDesigns({ S, D, onViolation = null, face = DEFAULT_FACE,
                              drawPixelText = defaultDraw, measurePixelText = defaultMeasure }) {
  const FACE = face;

  const _fired = new Set();
  let _violations = 0;
  /** Every region a design declares this frame, so a caller cannot invent one that is not on the glass. */
  let REGIONS = {};
  function region(name, x, y, w, h) { REGIONS[name] = { x, y, w, h }; return REGIONS[name]; }

  /**
   * @param {string} what   what was being drawn (appears in the console error)
   * @param {string} rname  the declared region it must stay inside
   * @param {number} x @param {number} y @param {number} w @param {number} h  the ink's bounding box
   */
  function assertFits(what, rname, x, y, w, h) {
    const r = REGIONS[rname];
    if (!r) { fire(`${what}: region ${JSON.stringify(rname)} was never declared this frame`); return false; }
    const over = [];
    if (x < r.x)                 over.push(`left by ${(r.x - x).toFixed(1)}`);
    if (y < r.y)                 over.push(`top by ${(r.y - y).toFixed(1)}`);
    if (x + w > r.x + r.w)       over.push(`right by ${(x + w - r.x - r.w).toFixed(1)}`);
    if (y + h > r.y + r.h)       over.push(`bottom by ${(y + h - r.y - r.h).toFixed(1)}`);
    if (!over.length) return true;
    fire(`${what} overflows ${rname} — ${over.join(', ')} texel(s). ` +
         `ink ${w.toFixed(1)}x${h.toFixed(1)} at (${x.toFixed(1)},${y.toFixed(1)}); ` +
         `region ${r.w}x${r.h} at (${r.x},${r.y}).`);
    return false;
  }
  /** Two blocks that each fit their region can still land on top of each other — which is exactly what
   *  Design 1's status line does at 144p, and what assertFits alone cannot see. */
  function assertClear(what, rgn, leftEnd, rightStart) {
    if (leftEnd <= rightStart) return true;
    fire(`${what} collides inside ${rgn} — the left block ends at ${Math.round(leftEnd)} and the ` +
         `right block starts at ${Math.round(rightStart)}, ${Math.round(leftEnd - rightStart)} texel(s) of overlap.`);
    return false;
  }
  /**
   * ⭐⭐ THE MARK GUARD — `assertFits` FOR INK THAT IS NOT TYPE.
   *
   * ⛔ `assertFits` IS REACHED ONLY THROUGH `T()`, AND THEREFORE ONLY THROUGH `plated()`. Every other
   * mark on the glass — `rect`, `sprite`, `dottedEllipse`, `frame`, `checker` — has always been
   * unguarded, so a mark that walks off its pane is CLIPPED BY THE CANVAS FOR FREE and the violation
   * counter stays at zero. That was invisible while every mark's position was a fixed literal. It
   * stops being invisible the moment a camera angle is an input: at `rotX = π/2` the orrery's minor
   * axis becomes its major one and the outer ring overshoots the map pane by ~93 texels per side,
   * straight through the topbar and off the canvas, WITHOUT FIRING ANYTHING.
   *
   * ⛔ IT IS CALLED PER SHAPE, NEVER PER TEXEL. `dottedEllipse` plots up to 220 texels and `checker`
   * plots w*h of them; a guard inside those loops would be the most expensive thing on the page. So
   * the caller hands over the shape's BOUNDING BOX once — which is also the only box that means
   * anything, since a partially-clipped ring is exactly as broken as a fully-clipped one.
   *
   * ⚠ IT ROUNDS THE WAY `rect()` ROUNDS. The marks are drawn at `Math.round`ed coordinates, so a box
   * measured off the raw floats would report half-texel overflows the glass never had.
   */
  function assertMark(what, rname, x, y, w, h) {
    return assertFits(what, rname, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function fire(msg) {
    _violations++;
    const key = `${S.design}|${S.level}|${S.lines}|${FACE.name}|${msg}`;
    if (_fired.has(key)) return;
    _fired.add(key);
    const line = `NAV VIEW-MODE OVERFLOW [D${S.design} ${LEVELS[S.level]} ${S.lines}p ${FACE.name}] — ${msg}`;
    if (onViolation) onViolation(line, { design: S.design, level: S.level, lines: S.lines, msg });
  }

  const LEVELS = ['GALAXY', 'SECTOR', 'REGION', 'PRISM', 'SYSTEM'];

  // ── ⭐⭐ THE TWO CAMERAS' DEFAULT ANGLES — DERIVED FROM THE PICTURE, NEVER THE PICTURE FROM THEM ──
  //
  // `projectPrism` and `d2System` each used to carry a FIXED tilt spelled as a bare literal, and those
  // literals ARE the picture Max ruled on. So they stay the source of truth and the ANGLE is what gets
  // computed. Reversing that — storing the angle and recovering the gains — moves the picture:
  //
  // ⛔ THE PRISM'S ROUND TRIP IS NOT BIT-IDENTICAL. Its two gains are not a rotation matrix;
  //    `hypot(0.42, 0.55) = 0.692… ≠ 1`, so the picture factors as an elevation-only rotation TIMES an
  //    anisotropic scale K. Recovering the gains from the angle gives `K*sin(ROTX0)` =
  //    0.42000000000000004 and `K*cos(ROTX0)` = 0.5500000000000002 — each 1-2 ULP off. Every texel
  //    consumer rounds, so nothing visible would move; but the same raw floats feed the bounds culls
  //    and go UNROUNDED into `S.prismHits`, where the picker measures distance to the cursor. So
  //    `projectPrism` keeps an explicit default path spelled with the literals themselves, and the
  //    trigonometry runs only once the pilot has actually turned the camera.
  // ⭐ THE ORRERY'S ROUND TRIP *IS* EXACT — `Math.sin(Math.asin(0.42)) === 0.42` — because 0.42 there
  //    is a true sine and not half of an anisotropic pair. `d2System` therefore just reads the angle.
  //
  // ⛔ TWO PAIRS, NOT ONE. The game keeps `_localRot*` and `_systemRot*` distinct and clamps them
  //    differently; folding them into one field would make a prism drag turn the orrery.
  const PRISM_TILT0 = 0.42;                                   // the prism's default z-gain …
  const PRISM_RISE0 = 0.55;                                   // … and its default y-gain
  const PRISM_K = Math.hypot(PRISM_TILT0, PRISM_RISE0);       // 0.6920260110718384
  const PRISM_ROTX0 = Math.atan2(PRISM_TILT0, PRISM_RISE0);   // 0.6521714117570698 rad = 37.3667°
  const PRISM_ROTY0 = 0;
  const SYS_TILT0 = 0.42;                                     // the orrery's default minor-axis gain
  const SYS_ROTX0 = Math.asin(SYS_TILT0);                     // 0.43344532006988595 rad = 24.8346°
  const SYS_ROTY0 = 0;
  /** ⛔ THE ORRERY'S RADIUS BUDGET DIVIDES BY THE MINOR-AXIS GAIN, so a top-down orrery (rotX → 0)
   *  divides by zero and a nearly-flat one divides by a hair. This floor is what leaves the WIDTH term
   *  winning the `Math.min` instead of handing it an Infinity. */
  const SYS_MIN_SIN = 1e-3;


  // ── INKS.  Solid fills only.  Batch 1 established that at 240p there are exactly two representable
  // stroke weights and that alpha alone has never separated selected from tentative, so every "dim"
  // tone here is a literal darker ink or a 1-texel parity checker — never globalAlpha.
  const INK = {
    BG:     '#04070c',
    RULE:   '#1d3a4a',
    DIM:    '#2f6b7a',
    BODY:   '#7fd8e8',
    KEY:    '#d8fbff',
    YOU:    '#2ee6c0',
    TARGET: '#ffb03a',
    WARN:   '#e8674f',
    // ── AC-2 (restorations) — THE PRISM'S DEPTH CUES GET INKS, NOT LITERALS ───────────────────────
    // Legacy drew all three in `rgba(...)` at 0.12-0.18 alpha over a 1560x860 vector canvas
    // (NavComputer.js:1997 the grid, :2078 the drop line, :2110 the catalogue ring). At 240p alpha is
    // not representable (see this table's own note), so each one becomes a literal dark tone that sits
    // BELOW `RULE` — the dimmest ink the designs already own — so the marks still win the eye.
    GRID:   '#0f2430',   // the 1 pc plane lattice, under everything
    ABOVE:  '#1f6b52',   // a drop line standing a mark UP off the plane   (legacy's green)
    BELOW:  '#6b2f28',   // …and one hanging it BELOW                       (legacy's red)
    HALO:   '#6b4a18',   // the catalogue ring, design 1                    (legacy's amber glow)
    // ── AC-5 (restorations) — THE SHIP, AND IT IS ITS OWN INK ON PURPOSE ─────────────────────────
    // Legacy draws the diamond, the word SHIP and the trajectory in one colour, `#00ff80`
    // (NavComputer.js:2937/2953/2977), and that colour is not `YOU`: `YOU` is *where the pilot is in
    // the GALAXY* — the player's plane on the y-gauge, his tile, his sector — and this is *where the
    // SHIP is in this system*, one level down. At 240p two greens a few degrees apart read as one, so
    // the ink is legacy's own literal rather than a shade of `YOU`, and the two never share a picture:
    // `YOU` does not appear at SYSTEM in either design.
    SHIP:   '#00ff80',   // the ship diamond, its word and its trajectory    (legacy's own)
  };
  /** BURN or WARP is not "which level am I on" — it is NavComputer._isCurrentSystem() (:1098-1105), a
   *  0.1 pc identity test. Browsing a foreign system from SYSTEM still arms a WARP. */
  const isHere = () => S.level === 4 && (D.isCurrent != null ? !!D.isCurrent : !!(D.sysStar && D.here && D.sysStar.seed === D.here.seed));   // the game publishes D.isCurrent from NavComputer._isCurrentSystem(); the seed test is only the lab's own stand-in (in Sol the two seeds are 'Sol' and a hash number, so it was false at home)
  const SPECTRAL = { O:'#9db0ff', B:'#abbfff', A:'#c9d6ff', F:'#f7f7ff', G:'#fff5ea',
                     K:'#ffd1a1', M:'#ff9f70', D:'#d9e6ff' };

  // PRIMITIVES.  fillRect only.  There is no arc, no stroke, no dash and no roundRect in this file,
  // because a 1-px stroke at an integer coordinate straddles it and lands as a nine-screen-pixel grey
  // smear at 3.75x (PixelText.js:382-385).
  // ════════════════════════════════════════════════════════════════════════════════════════════════
  function rect(g, x, y, w, h, ink) {
    if (w <= 0 || h <= 0) return;
    g.fillStyle = ink; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function frame(g, x, y, w, h, ink, t = 1) {   // four fillRects, never strokeRect
    rect(g, x, y, w, t, ink); rect(g, x, y + h - t, w, t, ink);
    rect(g, x, y + t, t, h - 2 * t, ink); rect(g, x + w - t, y + t, t, h - 2 * t, ink);
  }
  function checker(g, x, y, w, h, ink, parity = 0) {   // the third tone, from two colours and no alpha
    g.fillStyle = ink;
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    for (let j = 0; j < h; j++) for (let i = (j + parity) & 1; i < w; i += 2) g.fillRect(x + i, y + j, 1, 1);
  }
  /** A sprite from a row-width table, centred on (cx,cy). The era's own vocabulary: no discs, tables. */
  function sprite(g, cx, cy, widths, ink) {
    const h = widths.length, top = Math.round(cy) - ((h - 1) >> 1);
    for (let r = 0; r < h; r++) {
      const w = widths[r]; if (!w) continue;
      rect(g, Math.round(cx) - ((w - 1) >> 1), top + r, w, 1, ink);
    }
  }
  /**
   * ⭐⭐ AC-19 — THE CLIPPED FORMS OF `rect` / `frame` / `sprite`, FOR MARKS THAT MOVE WITH A CAMERA.
   *
   * ⛔ `rect()` CLIPS NOTHING, AND THE CANVAS ONLY CLIPS AT THE BUFFER'S EDGE. A mark placed through a
   * map transform therefore leaves its pane the moment the pane's camera is panned, and keeps painting
   * — over the status row, over the ranked rail, over the tab strip. The mark guard cannot see it
   * either: `assertMark` is advisory, and it was never called from the 2D painters, so the YOU marker
   * walking onto the chrome was a silent, shipped picture (REVIEW C19).
   *
   * ⚠ THEY ROUND THE WAY `rect()` ROUNDS, AND THEN CLIP THE ROUNDED BOX. `rect()` rounds x, y, w and h
   *   INDEPENDENTLY, so clipping `round(x + w)` instead of `round(x) + round(w)` would move an edge by
   *   a texel on a mark that is wholly inside its pane — i.e. it would change the picture Max ruled on
   *   in order to fix the picture he did not. Fully inside, every call below is byte-for-byte the
   *   unclipped one.
   *
   * ⚠ AND THEY RETURN THE CLIPPED BOX, so the caller can hand exactly what landed to `assertMark`
   *   rather than the box it asked for: a guard fed the unclipped box would fire on every pan, which
   *   is a guard that gets switched off.
   */
  function clipBox(x, y, w, h, cl) {
    const rx = Math.round(x), ry = Math.round(y), rw = Math.round(w), rh = Math.round(h);
    if (!cl) return { x: rx, y: ry, w: rw, h: rh };
    const x0 = Math.max(rx, cl.x), y0 = Math.max(ry, cl.y);
    const x1 = Math.min(rx + rw, cl.x + cl.w), y1 = Math.min(ry + rh, cl.y + cl.h);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function rectClip(g, x, y, w, h, ink, cl) {
    const b = clipBox(x, y, w, h, cl);
    if (b.w > 0 && b.h > 0) rect(g, b.x, b.y, b.w, b.h, ink);
    return b;
  }
  function frameClip(g, x, y, w, h, ink, cl, t = 1) {   // the same four rects `frame()` draws, each clipped
    rectClip(g, x, y, w, t, ink, cl); rectClip(g, x, y + h - t, w, t, ink, cl);
    rectClip(g, x, y + t, t, h - 2 * t, ink, cl); rectClip(g, x + w - t, y + t, t, h - 2 * t, ink, cl);
    return clipBox(x, y, w, h, cl);
  }
  function spriteClip(g, cx, cy, widths, ink, cl) {     // `sprite()`, row by row, through the same clip
    const h = widths.length, top = Math.round(cy) - ((h - 1) >> 1);
    const wMax = Math.max(...widths);
    for (let r = 0; r < h; r++) {
      const w = widths[r]; if (!w) continue;
      rectClip(g, Math.round(cx) - ((w - 1) >> 1), top + r, w, 1, ink, cl);
    }
    return clipBox(Math.round(cx) - ((wMax - 1) >> 1), top, wMax, h, cl);
  }
  const SP = {
    star7:  [3, 5, 7, 7, 7, 5, 3],
    giant5: [3, 5, 5, 5, 3],
    terr3:  [1, 3, 1],
    moon3:  [1, 3, 1],
    diam5:  [1, 3, 5, 3, 1],
    plus3:  [1, 3, 1],
  };
  function plus(g, cx, cy, ink) {           // the real-catalog star: 5 texels of ink
    rect(g, cx - 1, cy, 3, 1, ink); rect(g, cx, cy - 1, 1, 3, ink);
  }
  /**
   * A dotted ellipse, plotted texel by texel. This is literally what a fifth-generation orrery was.
   *
   * ⭐⭐ THE DOTS ARE SPACED ALONG THE PERIMETER, NOT ALONG THE ANGLE, AND THAT IS THE WHOLE FIX.
   *
   * ⛔ Both halves of the old line were tied to `rx` alone: the sample COUNT came off
   * `max(rx, ry)` — effectively `rx`, since the tilt only ever shrinks `ry` — and the samples were
   * then laid down at equal steps in `t`. On a circle those two facts are the same fact. On a
   * FLATTENED ellipse they come apart: equal steps in `t` cover `hypot(rx·sin t, ry·cos t)` texels of
   * arc, which at `ry/rx = 0.1` is ten times further at the ring's left and right ends than along its
   * top and bottom. The dots therefore bunch into two dashes at the ends and thin to nothing across
   * the middle — the "1-texel stroke straddling its own coordinate" failure this file exists to
   * avoid, appearing ONLY under rotation and only once `rotX` became an input.
   *
   * So: RAMANUJAN'S SECOND APPROXIMATION gives the real perimeter (error < 1e-5 at every eccentricity
   * this page can produce), that fixes the count at the same ~2.2-texel sample pitch the circle had,
   * and a single arc-length walk places each sample at a constant distance from the last. A ring that
   * flattens now loses dots rather than redistributing them, which is what "flatter" should look like.
   *
   * ⛔ STILL `fillRect` ONLY — no arc, no stroke, no dash, no ellipse(). See the PRIMITIVES banner.
   */
  /* ⭐ AC-6 (restorations) — AND `cl` CLIPS IT, PER DOT. The orrery's rings are the one mark on this
   *    page whose radius is a CAMERA value: `S.sysCam.zoom` runs to 5.0, which puts the outer ring
   *    five times outside the pane, and `rect()` clips nothing while the canvas clips only at the
   *    buffer's edge — so without this the rings paint straight through the topbar and the status bar
   *    (AC-19 of the defects batch, the same defect `rectClip`/`spriteClip` were written for).
   * ⛔ PER TEXEL HERE, NOT PARAMETRIC LIKE `lineTexels`, and it is affordable for the reason the walk
   *    is bounded: `n` is capped at 220 dots however big the ellipse gets, so the test runs at most
   *    220 times per ring rather than once per texel of arc.
   * ⚠ IT CANNOT MOVE THE PICTURE MAX RULED ON: at `zoom = 1` every dot of every ring is inside the
   *   pane (`maxR` budgets it), so every test passes and the fill stream is byte-identical. */
  function dottedEllipse(g, cx, cy, rx, ry, ink, every = 2, cl = null) {
    const a = Math.abs(rx), b = Math.abs(ry);
    const s = a + b;
    const hh = s > 0 ? ((a - b) * (a - b)) / (s * s) : 0;
    const per = Math.PI * s * (1 + (3 * hh) / (10 + Math.sqrt(Math.max(0, 4 - 3 * hh))));
    const n = Math.max(24, Math.min(220, Math.round(per / 2.2)));
    g.fillStyle = ink;
    // The walk. `M` fine steps integrate |d/dt (a cos t, b sin t)| = hypot(a sin t, b cos t); a dot is
    // dropped each time the accumulated arc passes the next multiple of the sample pitch. 4 fine steps
    // per sample keeps the placement error under a third of a texel, which the round() eats anyway.
    const pitch = per / n;
    const M = Math.max(256, n * 4), dt = (Math.PI * 2) / M;
    let acc = 0, next = 0, i = 0;
    for (let m = 0; m < M && i < n; m++) {
      const t = m * dt, ct = Math.cos(t), st = Math.sin(t);
      if (acc >= next) {
        if (!(i % every)) {
          const dx = Math.round(cx + ct * rx), dy = Math.round(cy + st * ry);
          if (!cl || (dx >= cl.x && dx < cl.x + cl.w && dy >= cl.y && dy < cl.y + cl.h)) g.fillRect(dx, dy, 1, 1);
        }
        i++; next += pitch;
      }
      acc += Math.hypot(a * st, b * ct) * dt;
    }
  }

  /*  Function · a one-texel line between two points, laid down as `fillRect`s and clipped to a box.
   *  Intent · AC-2 (restorations). The prism's plane grid and its per-mark drop lines are LINES, and
   *    this file owns no `stroke`, no `lineTo` and no `setLineDash` — the PRIMITIVES banner above says
   *    why: a 1-px stroke at an integer coordinate straddles it and lands as a nine-screen-pixel grey
   *    smear at 3.75x. So a line here is what a line is in pixel art: a run of single texels stepped
   *    along the longer axis, which is the same thing `dottedEllipse` already does around a curve.
   *  ⛔ THE CLIP IS PARAMETRIC (Liang-Barsky), NOT PER-TEXEL. The callers hand in segments spanning the
   *    pane's WORLD bounding box, which under rotation is a good deal longer than the pane; walking
   *    that and throwing texels away would put tens of thousands of dead iterations in every frame.
   *    Clipping first makes the walk's length the PANE's, whatever the caller asked for.
   *  ⚠ `every` drops texels for a dotted line. The grid uses 2; a drop line is a stem and uses 1.
   *  Deliberate non-goals · no anti-aliasing, no width, no dash PATTERN, no end caps, no depth fade. */
  function lineTexels(g, x0, y0, x1, y1, ink, cl, every = 1) {
    if (![x0, y0, x1, y1].every(Number.isFinite)) return;
    let ax = x0, ay = y0, bx = x1, by = y1;
    if (cl) {
      const dx = bx - ax, dy = by - ay;
      let t0 = 0, t1 = 1;
      const ps = [-dx, dx, -dy, dy];
      const qs = [ax - cl.x, cl.x + cl.w - 1 - ax, ay - cl.y, cl.y + cl.h - 1 - ay];
      for (let i = 0; i < 4; i++) {
        const pp = ps[i], qq = qs[i];
        if (pp === 0) { if (qq < 0) return; continue; }        // parallel and outside → nothing to draw
        const t = qq / pp;
        if (pp < 0) { if (t > t1) return; if (t > t0) t0 = t; }
        else { if (t < t0) return; if (t < t1) t1 = t; }
      }
      ax = x0 + t0 * dx; ay = y0 + t0 * dy; bx = x0 + t1 * dx; by = y0 + t1 * dy;
    }
    const span = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    const steps = Math.min(2048, Math.max(0, Math.round(span)));
    g.fillStyle = ink;
    for (let i = 0; i <= steps; i += every) {
      const t = steps === 0 ? 0 : i / steps;
      g.fillRect(Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t), 1, 1);
    }
  }

  // ── TYPE.  Every character on this page goes through the shipped face at unit 1 unless a design
  // says otherwise, and every draw is bounds-checked against its declared region.
  function T(g, s, x, y, opts = {}) {
    const { color = INK.BODY, scale = 1, align = 'left', rgn = null, what = '' } = opts;
    const str = String(s);
    const w = measurePixelText(str, scale), h = FACE.h * scale;
    const left = align === 'right' ? Math.round(x) - w : align === 'center' ? Math.round(x - w / 2) : Math.round(x);
    if (rgn) assertFits(what || `"${str.slice(0, 22)}"`, rgn, left, Math.round(y), w, h);
    drawPixelText(g, str, left, y, { color, scale, onMissing: 'tofu' });
    return w;
  }
  /** Clip at the glass — navPixelType's __navFit, the mechanism that keeps a field OFF THE GLASS
   *  without taking it OUT OF THE PIPELINE. Every producer upstream still returns the full string. */
  function fit(s, maxTexels, scale = 1) {
    let str = String(s);
    while (str.length && measurePixelText(str, scale) > maxTexels) str = str.slice(0, -1);
    return str;
  }
  const pad = (s, n) => String(s).slice(0, n).padEnd(n, ' ');
  const rpad = (s, n) => String(s).slice(0, n).padStart(n, ' ');
  /**
   * ⭐⭐ ONE LABEL SLOT SOLVER, SHARED BY EVERY DESIGN THAT PUTS NAMES ON A MAP — AC-14.
   *
   * Shared on purpose: if each design got its own placement code the comparison would be measuring my
   * code, not theirs. ⛔ AND IT STAYS A PLACEMENT SOLVER, NOT A TYPOGRAPHY ONE. No leader lines, no
   * callouts, no second face, no alpha — the file's `fillRect`-only rule stands. A label either lands
   * somewhere legible or it is not drawn.
   *
   * ── ⛔ WHAT IT USED TO BE, AND THE ONE THING IT COULD NOT SEE ──────────────────────────────────
   *
   * Seven VERTICAL offsets off one fixed side, tested against the already-placed labels and NOTHING
   * ELSE. Two consequences, and the second is AC-14:
   *
   *  1. A cluster that is vertical cannot be solved by moving vertically. Real orbital angles cluster
   *     (AC-13 put them on the glass), so the tags of four inner planets 13 texels apart chase each
   *     other down a single column and the ones past the seventh slot are dropped.
   *  2. ⛔⛔ IT WAS BLIND TO THE MARKS. `plated()` knocks out a BG rect before drawing, so those texels
   *     visually belong to the label — while a click there resolves through `S.prismHits` /
   *     `S.bodyHits` to whatever mark is UNDERNEATH. Measured over 120 frames per case before this
   *     change: 819 labels-covering-a-foreign-mark at Sol's SYSTEM, 951/1010/1015 on three clustered
   *     procedural systems, 284 on a dense prism field, 145 on design 1's index tags. Every one of
   *     those is a texel that names one object and selects another.
   *
   * ── ⭐ WHAT IT IS NOW ──────────────────────────────────────────────────────────────────────────
   *
   * FOURTEEN candidates, not seven: the same 6-texel-pitch ladder on the RIGHT of the mark and then
   * the same ladder on its LEFT. ⛔ RIGHT FIRST, AND THE FIRST CANDIDATE IS EXACTLY TODAY'S POSITION,
   * so an uncrowded field is byte-identical and only a label that had nowhere to go moves.
   *
   * Each candidate is rejected against BOTH the placed labels AND the drawn marks. `self` is the mark
   * this label names — a label may touch its own object, because that adjacency is what makes it read
   * as belonging to it — and everything else is a foreign object the plate must not cover.
   * ⚠ A MOON PIP IS NOT ITS PLANET, even though it carries the planet in `ref`. The pip strip lives at
   *   the same `x + 4` the body tag starts from, so without this the tag's plate erased the very pips
   *   it sits beside. `moon >= 0` marks are therefore foreign to their own parent's tag.
   *
   * ⛔ AND WHEN NOTHING FITS THE LABEL IS DROPPED, NOT OVERPRINTED. Two smeared glyphs read as neither;
   * one legible glyph and one absent is strictly more information. ⚠ THE TRADE IS DELIBERATE AND IT
   * COSTS NOTHING REACHABLE: the body keeps its entry in `S.bodyHits` / `S.prismHits`, so a dropped
   * label leaves an object UNNAMED, never UNPICKABLE.
   *
   * @param {Array}  taken   labels already placed this frame — MUTATED
   * @param {Array}  marks   the drawn marks, `[{x,y,r,ref,moon?}]`, as the paint published them
   * @param {number} ax @param {number} ay   the MARK's own position — candidates are generated about it
   * @param {number} gx @param {number} gy   this design's gap from the mark, right/up
   * @param {number} w       the label's measured width
   * @param {object} bounds  the rectangle the plate must stay inside
   * @param {object} self    the object this label names, or null
   * @returns {{x:number,y:number}|null}
   */
  function placeLabel(taken, marks, ax, ay, gx, gy, w, bounds, self) {
    for (const side of [1, -1]) {
      // ⭐ ROUNDED HERE, ONCE, BECAUSE THE GLASS IS. `plated()` lays its plate through `rect()` and its
      // glyphs through `drawPixelText`, and BOTH round — so a candidate tested at `p.x + 3.4` is not
      // the rectangle that gets drawn, and a half-texel near-miss becomes a real overlap on the glass.
      // ⛔ IT MOVES NOTHING: `Math.round(a) - 1 === Math.round(a - 1)`, so the plate lands where it
      //    always did, and `drawPixelText` already did `Math.round(y)` on its own line (`:399-400`).
      //    It also means `S.labelHits` publishes integers, which is what a hit-test wants.
      const x = Math.round(side > 0 ? ax + gx : ax - gx - w);
      for (const dy of [0, -6, 6, -12, 12, -18, 18]) {
        const y = Math.round(ay - gy + dy);
        if (x + w + 2 > bounds.x + bounds.w || x < bounds.x) continue;
        if (y < bounds.y || y + FACE.h + 2 > bounds.y + bounds.h) continue;
        if (taken.some((t) => Math.abs(t.y - y) < FACE.h + 1 && x - 2 < t.x + t.w && x + w + 2 > t.x)) continue;
        if (marks && marks.some((m) => foreignMarkUnder(m, self, x, y, w))) continue;
        taken.push({ x: x - 2, y, w: w + 4 });
        return { x, y };
      }
    }
    return null;
  }
  /** Does this mark belong to something else, and would the PLATE cover it? `plated()` lays
   *  `(x-1, y-1, w+2, FACE.h+2)`, so that rect — not the glyph box — is what has to be clear. */
  function foreignMarkUnder(m, self, x, y, w) {
    if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return false;
    if (self && m.ref === self && !(m.moon >= 0)) return false;      // its own object, not its pips
    const r = (Number.isFinite(m.r) && m.r > 0) ? m.r : 3;
    // ⛔ THE MARK'S CENTRE IS ROUNDED, BECAUSE THE MARK IS. `projectPrism` publishes unrounded floats
    //    and every primitive that draws them rounds, so a test against the raw float is a test against
    //    a rectangle that is not on the glass — measured, it let a mark sit one texel inside a plate it
    //    should have been refused. Plate texels are `x-1 .. x+w` by `y-1 .. y+FACE.h`, inclusive.
    const mx = Math.round(m.x), my = Math.round(m.y);
    if (mx + r < x - 1 || mx - r > x + w) return false;              // cheap horizontal cull first
    return my + r >= y - 1 && my - r <= y + FACE.h;
  }

  /** A knockout plate under on-map type. Without it a label over a bright arm is invisible.
   *  ⭐ IT RETURNS THE RECTANGLE IT DREW, which is what every `S.labelHits` entry is built from. A
   *  caller that re-measured the string would be a SECOND copy of this geometry — the AC-4 defect
   *  shape — and the copy that drifts is always the one nothing draws. */
  function plated(g, s, x, y, ink, rgn, what) {
    const w = measurePixelText(s);
    rect(g, x - 1, y - 1, w + 2, FACE.h + 2, INK.BG);
    T(g, s, x, y, { color: ink, rgn, what });
    return { x, y, w, h: FACE.h };
  }

  function estStars(x, z, sizeKpc) {
    const R = Math.hypot(x, z), theta = Math.atan2(z, x || 1e-10);
    const d = D.gm.potentialDerivedDensity(R, 0, theta).totalDensity;
    const perPc3 = Math.max(0.001, d * DENSITY_TO_STARS_PER_PC3);
    const volPc3 = (sizeKpc * 1000) ** 2 * 600;                  // a 600 pc-thick disc slab
    return Math.round(perPc3 * volPc3);
  }

  const LUM_CAP = 448;
  /** ⭐ THE NAV'S OWN OPTION BLOCK, copied verbatim from NavComputer._getOrRenderMap (:1738-1752).
   *  Without it the CPU renderer draws a washed-out disc with no arms — which is a fact about the
   *  DEFAULTS, not about the galaxy, and a lab that showed it would be lying about the picture.
   *  ⚠ The nav's PRIMARY path is the GPU NavGalaxyRenderer (:1722); this is its CPU fallback, chosen
   *  here because a standalone page has no WebGL renderer to hand it. Same model, same overrides. */
  function lumOptions(ext) {
    const components = {};
    if (ext < 10) { components.arms = { gain: 4.0, stretch: 400 }; components.disk = { gain: 3.0, stretch: 350 }; }
    if (ext < 2)  { components.arms = { gain: 5.0, stretch: 500, gamma: 0.6 };
                    components.disk = { gain: 4.0, stretch: 400 }; components.core = { gain: 0.2 }; }
    return { dustStrength: ext > 10 ? 0.5 : ext > 2 ? 0.3 : 0.1,
             noiseStrength: ext > 10 ? 0.4 : ext > 2 ? 0.6 : 0.8, components };
  }
  function lumImage(cx, cz, ext, res) {
    if (D.nav) {                                     // GPU: synchronous, 512², cached inside the renderer
      try { return D.nav.render(cx, cz, ext); }
      catch (e) { D.fail.push('NavGalaxyRenderer.render: ' + e.message); D.nav = null; }
    }
    const capped = Math.min(res, LUM_CAP);
    const key = `${cx.toFixed(4)}|${cz.toFixed(4)}|${ext.toFixed(5)}|${capped}`;
    if (D.lumCache.has(key)) return D.lumCache.get(key);
    D.lumCache.set(key, null);                       // placeholder: this frame draws a holding pattern
    setTimeout(() => {
      try { D.lumCache.set(key, D.lum.render(cx, cz, ext, capped, lumOptions(ext))); }
      catch (e) { D.fail.push('luminosity: ' + e.message); D.lumCache.set(key, 'FAIL'); }
    }, 0);
    return null;
  }
  /** Blit a square luminosity image into a rect with NEAREST sampling and no smoothing.
   *  `sq` is the destination SQUARE side in texels; the destination rect crops it. */
  function blitLum(g, img, dx, dy, dw, dh, sqSide) {
    if (!img || img === 'FAIL') {
      checker(g, dx, dy, dw, dh, INK.RULE);
      T(g, img === 'FAIL' ? 'DENSITY FAILED' : 'COMPUTING DENSITY', dx + 4, dy + 4, { color: INK.DIM });
      return;
    }
    g.imageSmoothingEnabled = false;                 // the nav sets this TRUE today, immediately before
    const sx = (sqSide - dw) / 2, sy = (sqSide - dh) / 2;   // a 3.2x bilinear downsample (NavComputer.js:1709)
    const k = img.width / sqSide;
    g.drawImage(img, Math.max(0, sx * k), Math.max(0, sy * k),
                Math.min(img.width, dw * k), Math.min(img.height, dh * k), dx, dy, dw, dh);
  }

  // ── The extents each level looks at, taken from NavComputer._setupViewStackForPlayer (:1200-1225).
  // ⭐ LEVELS 1-2 NOW COME FROM `S.view` — THE CALLER'S FRAME, NOT A SELF-SUPPLIED ONE. These two
  //    lines used to anchor to the PLAYER at every level, so clicking a sector drilled the game into
  //    it while both designs kept drawing the player's: the picture did not follow the pilot, which is
  //    "CLICK A SECTOR" being false in the way that matters. The driver writes `S.view` from
  //    `nav._viewCenter`/`_viewSize`; this page writes it from `labViewForLevel`, which returns
  //    exactly what the deleted lines computed — so the picture is unchanged here, and unchanged at
  //    the game's entry state too, where `_setupViewStackForPlayer` builds the same two frames.
  // ⭐⭐ AND LEVEL 0 READS `S.view` TOO, SINCE 2026-09-08 — THE FIXED DISC WAS THREE DEFECTS AT ONCE.
  //    This line used to return the literal `{ cx: 0, cz: 0, size: 44 }` on the argument that the disc
  //    is "the whole galaxy by definition". Measured live on the running game (417x240, design 2 at
  //    GALAXY): a 60-texel drag moved `_viewCenter.x` 0 → -16.5 kpc and the canvas hash did not change
  //    by one bit — the host's own 2D pan (`_handleMouseMove`'s `_panStartCenter` branch, live at every
  //    2D level in today's nav) was moving a frame nothing drew. Three things hung off that: design 2's
  //    wide crop keeps 20 of 775 sectors off the band with NO way to reach them (a drag is the way);
  //    the `HERE · SECTOR` locator's level-0 re-centre eased a field nobody painted; and a GALAXY drill,
  //    whose `_startDrillAnim` walks `_viewCenter`/`_viewSize` 44 → 0.5 exactly as a SECTOR drill does,
  //    CUT to SECTOR after 500 ms instead of zooming — Max: *"clicking on a cell from the grid should
  //    highlight it, then zoom into it"*. Reading the frame closes all three with one line.
  // ⛔ THE ENTRY FRAME IS UNMOVED, BY THE SAME ARGUMENT LEVELS 1-2 USE: `_setupViewStackForPlayer` puts
  //    `{ center: (0, 0), size: 44 }` in `_viewStack[0]` and `_applyLevelView` loads it on every entry,
  //    so `S.view` at level 0 IS the literal this used to return until a gesture moves it. This page's
  //    own stand-in (`labViewForLevel`) returns the same literal, so the lab picture is byte-identical.
  // ⚠ Design 1's re-fit (`d1GalaxyView`, `Math.min(v.size, 2R)`) composes with it: at rest the square
  //   is still 36 kpc; under a pan the cull keeps a cell drawn only where its centre resolves, so no
  //   dead ground comes in from the rim; under a drill the square closes on the sector.
  function levelView(level) {
    const v = S.view;
    if (level === 0) return { cx: v.cx, cz: v.cz, size: v.size, n: 0 };
    if (level === 1) return { cx: v.cx, cz: v.cz, size: v.size, n: 8 };
    return { cx: v.cx, cz: v.cz, size: v.size, n: 16 };
  }
  function tileSize(x, z, target) {                  // NavComputer._computeTileSize (:1596-1602)
    const R = Math.hypot(x, z), theta = Math.atan2(z, x || 1e-10);
    const d = D.gm.potentialDerivedDensity(R, 0, theta).totalDensity;
    if (d < 1e-10) return 0.02;
    const perPc3 = Math.max(0.001, d * DENSITY_TO_STARS_PER_PC3);
    return Math.cbrt(target / perPc3) / 1000;
  }

  // ── PRISM PROJECTION.  A top-down-ish view whose ANGLE now arrives with the frame, defaulting to
  //    the fixed shallow tilt these designs were drawn at. Zoom stops: the four D2 and D3 both asked for.
  const ZOOM_STOPS = [0.0015, 0.003, 0.006, 0.01034];   // kpc — default, and the wheel ceiling
  // This page's own cycle index for the Z key; it writes S.cam.radius and nothing else reads it.
  // ⛔ IT MUST STAY ON ITS OWN LINE INSIDE THE EXTRACTED SPAN — the extractor's departure 3 asserts
  //    on this exact declaration, newline included, before stripping it out of the game's copy.
  /**
   * ⭐ THE CAMERA IS THE CALLER'S, NOT THIS PAGE'S. Anchor `S.cam.x/y/z`, scale `S.cam.radius`, both
   * in kpc. This used to anchor to `D.player` and scale by `ZOOM_STOPS[S.zoomIdx | 0]`, which is why moving
   * the game's camera left the prism BYTE-IDENTICAL while moving the ship changed it: nothing the
   * pilot could touch was an input to the picture, and `WASD PAN` / `R/F UP` were printed anyway.
   * ⭐⭐ AND ROTATION IS NOW AN INPUT TOO. Measured with a liveness control, the pilot's drag was
   * already turning `_localRotX` / `_localRotY` while this function stayed BYTE-IDENTICAL — one hop
   * missing on a pipe that already existed. `S.cam.rotY` is the azimuth and `S.cam.rotX` the
   * elevation, both in radians.
   *
   * ⛔ THE AZIMUTH IS APPLIED TO (dx, dz) BEFORE THE GAINS, NOT AFTER. `rx = 0.92` is a HORIZONTAL
   * GAIN and the tilt is a vertical one; they are not equal, so a rotation composed after them is not
   * a rotation at all — it SHEARS the field, and a spinning prism would slide its stars sideways past
   * each other instead of turning them. Rotate in world-ish space, then scale to the pane.
   *
   * ⛔ AND THE DEFAULT PICTURE IS SPELLED WITH THE LITERALS, ON ITS OWN PATH. See PRISM_ROTX0's block:
   * `K*sin(ROTX0)` is 0.42000000000000004, one ULP off 0.42, and `S.prismHits` publishes these
   * coordinates UNROUNDED for the picker to measure against. An explicit early return is the only way
   * bit-identity at the default is PROVABLE rather than probable, so that is what this is.
   */
  function projectPrism(s, cx, cy, halfW, halfH) {
    const cam = S.cam, r = Math.max(cam.radius, 1e-9);
    const dx = (s.wx - cam.x) / r, dz = (s.wz - cam.z) / r;
    const dy = (s.wy - cam.y) / r;
    const rx = 0.92;                                   // the horizontal gain — rotation does not touch it
    const rotX = cam.rotX === undefined ? PRISM_ROTX0 : cam.rotX;
    const rotY = cam.rotY === undefined ? PRISM_ROTY0 : cam.rotY;
    if (rotX === PRISM_ROTX0 && rotY === PRISM_ROTY0) {   // ⛔ THE PICTURE MAX RULED ON, UNTOUCHED
      return { x: cx + dx * halfW * rx, y: cy + dz * halfH * PRISM_TILT0 - dy * halfH * PRISM_RISE0,
               py: cy + dz * halfH * PRISM_TILT0, depth: dz };
    }
    const ca = Math.cos(rotY), sa = Math.sin(rotY);
    const ax = dx * ca - dz * sa, az = dx * sa + dz * ca;   // azimuth FIRST, in the isotropic plane
    const tilt = PRISM_K * Math.sin(rotX), rise = PRISM_K * Math.cos(rotX);
    return { x: cx + ax * halfW * rx, y: cy + az * halfH * tilt - dy * halfH * rise,
             py: cy + az * halfH * tilt, depth: az };
  }

  /*  Function · the 1 pc lattice on the prism's plane, drawn UNDER the marks and clipped to the pane.
   *  Intent · AC-2 (restorations), the page's prism table: legacy draws a plane grid at
   *    `_localGridCell` (NavComputer.js:1191 = 0.001 kpc = 1 pc) across the whole view
   *    (:1994-2014); neither design draws one, and without it a field of bare dots has no surface to
   *    be above or below. Max: *"height above the plane is the prism's whole point."*
   *  ⛔ IT IS DRAWN ON THE PLANE THE FEET ARE ON, WHICH IS THE CAMERA'S, NOT LEGACY'S y = 0.
   *    `projectPrism`'s `py` is the star projected with `dy` zeroed — i.e. at `S.cam.y` — so every
   *    plane dot in both designs already sits on the camera's plane. A lattice drawn at the GALACTIC
   *    plane would be a second, contradictory horizon that the feet visibly did not touch, and the
   *    drop line (below) would end nowhere. One plane, and it is the one the picture already uses.
   *  ⛔ AND THE INVERSE PROJECTION IS USED ONLY TO CHOOSE WHICH LINES CAN REACH THE PANE. The line
   *    itself is drawn through the SAME forward arithmetic `projectPrism` uses, spelled once here, so
   *    a grid line through a star's foot passes through that foot.
   *  ⚠ EDGE-ON IS A REAL STATE AND IT DIVIDES BY ZERO. The game clamps the prism's elevation to
   *    [0, pi/2] and at 0 the tilt is `K*sin(0)` = 0: the plane collapses to a horizontal line and the
   *    inverse's `az` term goes to Infinity. There is no lattice to draw there, so there is none.
   *  Deliberate non-goals · no player-cell highlight (legacy's is debug-mode only, :1938-1950), no
   *    horizon fade, no axis labels, no second cell size at zoom — 1 pc is legacy's own constant. */
  const PLANE_CELL_KPC = 0.001;    // NavComputer.js:1191 `_localGridCell`, verbatim — 1 pc
  const PLANE_MAX_LINES = 48;      // a bound on the loop at the widest zoom stop, not a picture choice
  const PLANE_MIN_TEXELS = 8;      // ⛔ below this a lattice is a FILL — see `prismPlane`'s doubling
  const PLANE_DOT = 3;             // the lattice's dot pitch; the drop line's is 1 or 2 (`prismDrop`)
  function prismPlane(g, cxp, cyp, halfW, halfH, cl) {
    const cam = S.cam, r = Math.max(cam.radius, 1e-9);
    if (!cl || !(halfW > 0) || !(halfH > 0) || !Number.isFinite(cam.x) || !Number.isFinite(cam.z)) return;
    const rx = 0.92;                                   // the horizontal gain, as in `projectPrism`
    const rotX = cam.rotX === undefined ? PRISM_ROTX0 : cam.rotX;
    const rotY = cam.rotY === undefined ? PRISM_ROTY0 : cam.rotY;
    const def = (rotX === PRISM_ROTX0 && rotY === PRISM_ROTY0);
    const tilt = def ? PRISM_TILT0 : PRISM_K * Math.sin(rotX);
    if (!(Math.abs(tilt) > 1e-6)) return;              // edge-on: the plane IS a line
    const ca = def ? 1 : Math.cos(rotY), sa = def ? 0 : Math.sin(rotY);
    const fx = (dx, dz) => cxp + (dx * ca - dz * sa) * halfW * rx;
    const fy = (dx, dz) => cyp + (dx * sa + dz * ca) * halfH * tilt;
    // …and the inverse, for the pane's four corners only.
    const back = (x, y) => { const ax = (x - cxp) / (halfW * rx), az = (y - cyp) / (halfH * tilt);
                             return { dx: ax * ca + az * sa, dz: -ax * sa + az * ca }; };
    let dxMin = Infinity, dxMax = -Infinity, dzMin = Infinity, dzMax = -Infinity;
    for (const [x, y] of [[cl.x, cl.y], [cl.x + cl.w, cl.y], [cl.x, cl.y + cl.h], [cl.x + cl.w, cl.y + cl.h]]) {
      const b = back(x, y);
      if (!Number.isFinite(b.dx) || !Number.isFinite(b.dz)) return;
      dxMin = Math.min(dxMin, b.dx); dxMax = Math.max(dxMax, b.dx);
      dzMin = Math.min(dzMin, b.dz); dzMax = Math.max(dzMax, b.dz);
    }
    /*  ⛔ THE CELL IS 1 pc AT THE DEFAULT ZOOM AND DOUBLES AS THE CAMERA PULLS BACK, AND THAT IS A
     *  MEASUREMENT, NOT A PREFERENCE. The prism's vertical gain is the tilt, so a cell that is 128
     *  texels wide is only ~30 tall at the default stop — and at the widest stop (`ZOOM_STOPS[3]`,
     *  0.01034 kpc) it is 3.6 texels tall. Measured at 417x240: a true 1 pc lattice there draws 13,093
     *  texels of z-lines about seven texels apart, which at 240p is not a grid, it is a wash over the
     *  starfield the grid exists to give a floor to — and it is 13x the fill count the whole frame had.
     *  So the cell steps up in POWERS OF TWO (1, 2, 4, 8 pc) until the tighter of its two on-screen
     *  spacings clears `PLANE_MIN_TEXELS`. ⭐ AT THE DEFAULT CAMERA THE MULTIPLIER IS 1 and the lattice
     *  is exactly legacy's 1 pc; nothing about the picture Max will look at first is approximate.
     *  ⚠ THE TWO SPACINGS ARE THE AXIS-ALIGNED ONES, USED AS A PROXY. Under a rotated azimuth the
     *    lines are slanted and their true perpendicular spacing mixes both terms; the proxy is within a
     *    factor of sqrt(2) of it, which is inside the doubling's own granularity. */
    const unit = PLANE_CELL_KPC / r;                   // one 1 pc cell, in camera radii
    if (!(unit > 0)) return;
    const spX = unit * halfW * rx, spZ = unit * halfH * Math.abs(tilt);
    let mult = 1;
    while (mult < 64 && Math.min(spX, spZ) * mult < PLANE_MIN_TEXELS) mult *= 2;
    const cell = unit * mult;
    if ((dxMax - dxMin) / cell > PLANE_MAX_LINES * 4) return;   // absurd zoom: no lattice
    const run = (lo, hi, draw) => {
      const i0 = Math.ceil(lo / cell), i1 = Math.floor(hi / cell);
      for (let i = i0; i <= i1 && i - i0 < PLANE_MAX_LINES; i++) draw(i * cell);
    };
    // the grid is anchored to the WORLD, not to the camera, so it slides under a pan instead of with it
    const offX = cam.x / r, offZ = cam.z / r;
    run(dxMin + offX, dxMax + offX, (wx) => {
      const dx = wx - offX;
      lineTexels(g, fx(dx, dzMin), fy(dx, dzMin), fx(dx, dzMax), fy(dx, dzMax), INK.GRID, cl, PLANE_DOT);
    });
    run(dzMin + offZ, dzMax + offZ, (wz) => {
      const dz = wz - offZ;
      lineTexels(g, fx(dxMin, dz), fy(dxMin, dz), fx(dxMax, dz), fy(dxMax, dz), INK.GRID, cl, PLANE_DOT);
    });
  }

  /*  Function · the one-texel stem from a mark's foot on the plane to the mark itself.
   *  Intent · AC-2 (restorations). Legacy draws a dashed vertical reference line per on-screen star,
   *    green when the star is above the plane and red when it is below (NavComputer.js:2074-2079).
   *    Both designs already draw the FOOT (the `INK.RULE` plane dot) and the MARK; the line between
   *    them is the cue that says the two belong to one star, and it is the only thing on the glass
   *    that gives a dot a height. Both endpoints are already computed — `projectPrism` returns `y`
   *    and `py` — so this is drawing, not new data.
   *  ⛔ ABOVE/BELOW IS READ OFF THE DRAWN POINTS, NOT OFF `wy`. The two inks have to agree with the
   *    direction the stem visibly runs, and under a rotated camera the sign of `y - py` is the only
   *    thing that knows it. `py` is the star at the camera's height, so `y < py` IS "above".
   *  ⚠ SOLID WHILE IT IS SHORT, DOTTED ONCE IT IS LONG, AND BOTH HALVES ARE MEASURED. Legacy's dash
   *    is [2,5] — 28% of the texels — on a canvas 3.6x this one's line count. At 240p a stem at the
   *    default zoom averages five texels, and a dash there renders as two dots that cannot be told
   *    from the foot and the mark; at the widest zoom stop the 584 stems of design 2 average
   *    seventeen and, drawn solid, are 10,796 texels in one frame. So: solid under `DROP_SOLID`,
   *    every second texel above it, which is still denser than legacy's dash.
   *  Deliberate non-goals · no tether lines to co-members and no pulsing rings (intent.md's non-goals),
   *    no depth fade, and no cap on the stem's LENGTH — the length is the reading. */
  const DROP_SOLID = 10;
  function prismDrop(g, p, cl) {
    if (!p || !Number.isFinite(p.y) || !Number.isFinite(p.py)) return;
    if (Math.round(p.y) === Math.round(p.py)) return;            // on the plane: the foot dot says it
    lineTexels(g, p.x, p.py, p.x, p.y, p.y < p.py ? INK.ABOVE : INK.BELOW, cl,
               Math.abs(p.y - p.py) > DROP_SOLID ? 2 : 1);
  }

  /**
   * ⭐ THE COMMITTED CLICK, FOR THE FRAME BEFORE THE ZOOM TAKES IT AWAY (INTERFACE §5).
   *
   * `S.pick = { level, i, j, tMs } | null` — the driver writes it on a committed map click and clears
   * it when the drill lands. Measured live, the designs' map ALREADY zooms on a drill; what was
   * missing was the acknowledgement, so a click read as "nothing happened" for the first ~100 ms.
   *
   * ⛔ `i`/`j` ARE THE DESIGN'S OWN GRID COORDINATES. The game's `row` counts +z upward and `j` counts
   * it downward (`row = n - 1 - j`); handing one through as the other frames the mirrored tile, which
   * looks like the highlight simply being wrong rather than like a flipped axis.
   * ⚠ Returns null on a missing field, a stale level or a non-finite index — a painter that throws
   *   freezes the glass, and the host catches exactly once before it stops uploading frames at all.
   */
  function pickCell(level) {
    const p = S.pick;
    if (!p || p.level !== level) return null;
    if (!Number.isFinite(p.i) || !Number.isFinite(p.j)) return null;
    return { i: Math.round(p.i), j: Math.round(p.j) };
  }

  /**
   * ⭐⭐ AT GALAXY THE ACKNOWLEDGEMENT IS THE SECTOR, NOT THE CELL — AC-5's REMAINING HALF.
   *
   * At SECTOR and REGION the thing clicked and the thing drilled are the same rectangle, so framing
   * the cell is honest and `pickCell` above is the whole story. ⛔ AT LEVEL 0 THEY ARE DIFFERENT
   * OBJECTS. The click resolves through `pickSector` to one of 775 IRREGULAR sectors and the drill
   * flies to THAT sector's own centre and size, while the grid over it is a plain 8x8 of the re-fitted
   * square. A frame on the cell would light up a rectangle the zoom does not go to — a promise the
   * next 350 ms visibly breaks, which is worse than the nothing it replaces.
   *
   * ⭐ SO THE DRIVER PUBLISHES THE SECTOR IT ACTUALLY PICKED, out of the SAME `pickSector` call the
   * drill uses, and each design frames it through its OWN projection. One picked object, two pictures,
   * no third copy of anybody's geometry.
   * ⚠ NULL ON A MISSING OR NON-FINITE SECTOR, and every caller is guarded on `S.level === 0` besides.
   *   A painter that throws freezes the glass LOOKING ALIVE: `PanelHost` catches once and then stops
   *   uploading, so the last good frame stays on the screen.
   */
  function pickedSector() {
    const p = S.pick;
    if (!p || p.level !== 0) return null;
    const s = p.sector;
    if (!s || !Number.isFinite(s.centerX) || !Number.isFinite(s.centerZ) || !Number.isFinite(s.size)) return null;
    return s;
  }

  // DESIGN 1 — THE 71x40.  A character-cell nav computer: a map pane and a persistent ranked rail.
  // ════════════════════════════════════════════════════════════════════════════════════════════════
  /** ⭐ THE HINT ROW WHILE THE DRAWN SEARCH IS OPEN, AND IT NAMES EVERY KEY THE FIELD CONSUMES.
   *  50 characters against the 62 of the GALAXY hint, so no buffer clips it any sooner than that one.
   *  ⛔ It says ESC CLOSE and not ESC BACK: the field's Escape closes the field and nothing else. */
  const SEARCH_HINT = 'TYPE A NAME   UP DOWN MOVE   ENTER WARP   ESC CLOSE';

  function drawDesign1(g, W, H) {
    // ⭐ EVERY LABEL THIS FRAME DRAWS, CLEARED BEFORE IT DRAWS ANY (INTERFACE §6). Design 2 clears its
    // whole published set at the head of its own paint for the same reason; a stale label rectangle
    // makes a hit-test that should say "nothing there" quietly answer against the frame before it.
    // ⛔ AN ASSIGNMENT, NOT A `||= []`: a design that draws no labels must publish an EMPTY array, and
    //    a picker reading `undefined.length` inside `render()`'s tail freezes the glass.
    S.labelHits = [];
    // ⭐ AND THE SAME CLEAR FOR AC-2's REMAINING RECTANGLES (INTERFACE §8). Design 2 clears its own
    // set at the head of `drawDesign2`, and the driver's `resetPicks` clears every one of them for both
    // designs before either paints. One press of V must not leave design 2's list headers or its
    // locator live under design 1's rail, and design 1's pager must not answer a click after the pilot
    // has switched to design 2 — a rectangle published by a design that did not paint this frame is
    // geometry out of NOBODY'S paint, which is the same lie as geometry restated in a hit-test.
    // ⚠ MEASURED 2026-09-08, AND THE COMMENT SAYS SO RATHER THAN CLAIMING A GUARD: with the driver's
    //   clear in place this line kills no test — the adversarial pass deleted it, and the mirror line in
    //   `drawDesign2`, and the driver's, one at a time, and the suite stayed green each time; only
    //   removing all three at once goes red. The clears are load-bearing as a SET and redundant one by
    //   one. This one is kept because this page is also the SPEC and has to stand without the driver
    //   (the lab page has no `resetPicks`), not because a test holds it on its own.
    // ⛔ ASSIGNED TO `null`, NEVER DELETED, for the reason `S.labelHits = []` is an assignment: a
    //    picker dereferencing a field that is not there freezes the glass, and it freezes it LOOKING
    //    ALIVE — `PanelHost` catches a painter throw once and then stops uploading frames.
    S.pagerRect = null; S.ladderCounterRect = null;
    // ⛔ AC-4's ROW LIST ON THE SAME RULE. `S.railBodies` is published only by the SUB-VIEW's rail
    //    branch, so without a clear here the rows of a planet the pilot left would stay on offer under
    //    the whole-system list — geometry out of nobody's paint, which is the defect this block names.
    S.railBodies = null;
    // ⛔ AC-1's RECTANGLE IS CLEARED HERE TOO. `hoverCallout` nulls it on every path, but a frame
    //    that never reaches the map painter (there is none today) would otherwise leave last frame's
    //    plate live for the driver's press guard to find.
    S.listHeaderRects = null; S.locatorRect = null; S.companionRect = null; S.hoverCalloutRect = null;
    const CELL = FACE.advance, LEAD = FACE.h + 1;
    const cols = Math.floor((W + 1) / CELL), rows = Math.floor(H / LEAD);
    const cx = (c) => c * CELL, ry = (r) => r * LEAD;
    const railC = Math.min(26, Math.max(10, Math.round(cols * 0.366)));
    const mapC = cols - railC - 2;                      // -1 y-gauge, -1 rule
    const railX = cx(cols - railC), railW = railC * CELL - 1;
    const mapW = mapC * CELL, mapY = ry(1), mapH = ry(rows - 3) - ry(1);
    const gaugeX = cx(mapC), ruleX = cx(mapC + 1) + 2;

    region('status', 0, 0, W, FACE.h);
    region('map', 0, mapY, mapW, mapH);
    region('rail', railX, mapY, railW, mapH);
    region('hint', 0, ry(rows - 3), W, FACE.h);
    region('tabs', 0, ry(rows - 2), W, FACE.h);
    region('commit', 0, ry(rows - 1), W, FACE.h);

    rect(g, 0, 0, W, H, INK.BG);
    rect(g, 0, ry(1) - 1, W, 1, INK.RULE);              // the rule lives in the LEADING texel: 0 rows
    rect(g, 0, ry(rows - 3) - 1, W, 1, INK.RULE);
    rect(g, ruleX, mapY, 1, mapH, INK.RULE);

    // ── STATUS, row 0 ────────────────────────────────────────────────────────────────────────────
    const sys = D.here?.name || 'UNKNOWN';
    const identW = T(g, fit(sys.toUpperCase(), 14 * CELL), 1, 0, { color: INK.KEY, rgn: 'status', what: 'status ident' });
    rect(g, 1 + 15 * CELL, 2, 1, 1, INK.RULE);
    const secW = T(g, fit((D.playerSector?.name || '').toUpperCase(), 17 * CELL), 1 + 17 * CELL, 0,
      { color: INK.DIM, rgn: 'status', what: 'status sector' });
    const tgt = `TGT ${(D.target?.name || '—').toUpperCase()}  ${(D.target?.ly || 0).toFixed(1)} LY`;
    const tgtW = measurePixelText(fit(tgt, 34 * CELL));
    T(g, fit(tgt, 34 * CELL), W - 1, 0, { color: INK.TARGET, align: 'right', rgn: 'status', what: 'status target' });
    assertClear('status ident/sector vs TGT', 'status',
                Math.max(1 + identW, 1 + 17 * CELL + secW) + CELL, W - 1 - tgtW);

    // ── THE MAP PANE ─────────────────────────────────────────────────────────────────────────────
    if (S.level <= 2) d1TwoD(g, mapW, mapY, mapH);
    else if (S.level === 3) d1Prism(g, mapW, mapY, mapH, gaugeX);
    else d1Ladder(g, mapW, mapY, mapH);
    // ⭐ AC-1 (restorations) — THE HOVER CALLOUT, LAST THING ON THE MAP AND ONLY ON THE MAP. It is
    // placed off `S.hover`'s own texel point and clamped into `REGIONS.map`, so it can never reach the
    // rail, the hint row, the tabs or the commit row. ⛔ NOT DRAWN UNDER THE DRAWN SEARCH: the driver
    // already nulls the hover while the field is open (`index.js:551`), and this page's own `labSearch`
    // does not — so the gate is stated here rather than inherited from a caller.
    if (!S.search.open) hoverCallout(g);

    // ── THE RAIL ─────────────────────────────────────────────────────────────────────────────────
    d1Rail(g, railX, mapY, railW, railC, rows - 4);

    // ── HINT ─────────────────────────────────────────────────────────────────────────────────────
    // ⭐ THE HINT NAMES THE ACTIVE SORT KEY. Max never opens a browser console, so a control he can
    // use has to be legible ON THE GLASS or it does not exist for him. `S.sortLabel` is the driver's
    // one-word name for the key that is on; empty is the honest default and the row then degrades to
    // exactly what it has always said, which is why nothing here moves until a sort is wired.
    const sortHint = S.sortLabel ? `[ ] SORT ${S.sortLabel}` : '[ ] SORT';
    // ⛔ THE SYSTEM HINT SAID `DRAG TO ROTATE` OVER A LADDER, AND A LADDER HAS NO ROTATION. This
    //    design draws no orrery at SYSTEM — it draws a scrolling sqrt(AU) axis — so the row now names
    //    that axis's real controls: `,` and `.` step the window between stops, and the `...` caps
    //    drawn at either end are click targets for the same step. 62 characters, which is exactly the
    //    length of the GALAXY hint, so no buffer clips it any sooner than it already clipped that one.
    const hints = [`CLICK A SECTOR OR A LIST ROW   ${sortHint}   / SEARCH   TAB LEVEL`,
                   `CLICK A TILE OR A LIST ROW   ${sortHint}   / SEARCH   TAB LEVEL`,
                   `CLICK A TILE OR A LIST ROW   ${sortHint}   / SEARCH   TAB LEVEL`,
                   // ⭐ AC-12 — `R` AND `F` RAISE AND LOWER THE PRISM CAMERA AND NOTHING SAID SO. They
                   // are bound at PRISM and only at PRISM, they move the picture Max is looking at, and
                   // this row is the only place design 1 names a key.
                   // ⛔ AND `OR A LIST ROW` PAID FOR IT, WHICH IS A MEASUREMENT AND NOT A PREFERENCE.
                   //    At 417 the hint row is 69 characters. With the longest key this level owns
                   //    (`CATALOG`, `SORT_KEYS[3]`) the old row is already 67; adding `   R/F UP` makes
                   //    76 and `fit()` truncates from the RIGHT — so the new promise would disappear at
                   //    exactly the moment a pilot sorted by anything. Dropping the clause that names
                   //    the rail (which is DRAWN, two texels to the right, with its rows highlighted)
                   //    leaves 62 at the worst key. A row that fits is the only kind that can be read.
                   `CLICK A STAR   ${sortHint}   / SEARCH   WASD PAN   R/F UP`,
                   // ⭐ THE SCROLL CONTROLS ARE NAMED ONLY WHEN THE LADDER HAS SOMEWHERE TO SCROLL. `d1Ladder`
                   // has already run (the map pane paints before this row), so `S.ladderMax` is this
                   // frame's own answer: 0 means no `...` cap is drawn and `,` / `.` move nothing, and a
                   // hint naming a click target that is not on the glass is the lie AC-10 sweeps for.
                   // Measured 2026-09-08: Sol's 15 stops end at 222 against a 226-texel window at Max's
                   // 417x240, so on Sol this row reads `SELECT A BODY   [ ] SORT AU   TAB LEVEL`.
                   // ⭐ AC-12 — `/` OPENS THE DRAWN SEARCH AT SYSTEM TOO, AND THIS ROW NEVER SAID SO.
                   // ⛔ `TAB LEVEL` PAID FOR IT, AND ONLY ON THIS ROW. With the ladder overflowing and
                   //    the longest key this level owns the row is already 65 characters of 69; adding
                   //    `   / SEARCH` makes 78. The tab strip is drawn on the very next row with the
                   //    active tab filled, so TAB is the one control on this row a pilot can SEE, and
                   //    the strip's own legend (below) names SHIFT+TAB. The other four rows keep it.
                   `SELECT A BODY   ${(S.ladderMax || 0) > 0 ? 'SCROLL , . OR CLICK ...   ' : ''}${sortHint}   / SEARCH`];
    /*  Function · AC-4 — the SYSTEM row while a planet is open.
     *  Intent · page item 16. Legacy's own sub-view prints `SELECT MOON TO NAVIGATE · CLICK EMPTY
     *    SPACE TO GO BACK` (NavComputer.js:3533) — the way OUT is half of what that row says, because
     *    a screen a pilot cannot leave is a trap.
     *  ⛔⛔ IT SAYS `RIGHT CLICK BACK` AND NOT `ESC BACK`, AND THAT IS A MEASUREMENT, NOT A STYLE
     *    CHOICE. Wave 2b drew `ESC BACK` here on the seam's EXIT row; the HOST lane then measured
     *    that the Escape KEY never reaches this overlay's class at all — `NavComputer._onKeyDown`
     *    (:344-360) has no `Escape` clause, so the key falls through to `main.js:13557`, which sees
     *    the nav open and closes THE WHOLE OVERLAY (Max's own 2026-07-29 ruling, guarded by
     *    `src/ui/__tests__/NavComputer.escape.test.js`: *"esc should just dismiss"*). A hint row that
     *    named Esc would therefore promise the pilot a way back and take the whole screen away, which
     *    is the exact defect class this workstream is named for. RIGHT-CLICK does exit, through the
     *    canvas's own `contextmenu` listener (`NavComputer.js:336`) → `handleEscape()` → the wave-2b
     *    fold at :1441 → `drv.onEscape()`; the empty-map click exits too (the driver's own INSIDE
     *    rule). Whether Esc should ALSO pop the sub-view is a reversal of a ruling Max made himself,
     *    so it is reported to him rather than decided here.
     *  ⛔ NOTHING IS CUT FROM AN EXISTING CLAUSE: this is a NEW row for a state that had none. It
     *    measures 59 characters of the 69 this buffer holds at the longest key this level owns
     *    (`[ ] SORT NAME`), and 58 with the scroll clause — so both fit unclipped.
     *  ⚠ THE SORT AND SEARCH CLAUSES YIELD TO THE SCROLL CLAUSE, AND ONLY TO IT. All three together
     *    are 82, well past the row; the scroll clause names a control that is ON THE GLASS this frame
     *    (the `...` caps), while `[ ]` and `/` are named on the four other rows. */
    const subDet = S.level === 4 ? sysDetail() : null;
    if (subDet) {
      const scrollC = (S.ladderMax || 0) > 0 ? 'SCROLL , . OR CLICK ...' : '';
      hints[4] = `SELECT A MOON   RIGHT CLICK BACK   ${scrollC || `${sortHint}   / SEARCH`}`;
    }
    // ⭐ AND WHILE THE DRAWN SEARCH IS OPEN THE ROW NAMES THE SEARCH'S OWN CONTROLS. The field takes
    // the rail, so the row that would say "CLICK A LIST ROW" would be naming rows that are not there.
    // ⛔ ESC CLOSES AND ONLY CLOSES — it must never also drill a level, which is the one behaviour the
    //    DOM widget got right and the reason its Escape handler stopped at `input.blur()`.
    const hintFull = (S.search.open ? SEARCH_HINT : hints[S.level]) + (S.sabotage ? SAB : '');
    T(g, fit(hintFull, W - 2), 1, ry(rows - 3), { color: INK.DIM, rgn: 'hint', what: 'hint line' });
    // the guard must see the UNCLIPPED string, or it is not a guard — it is the clip
    if (S.sabotage) assertFits('D1 hint line (unclipped)', 'hint', 1, ry(rows - 3), measurePixelText(hintFull), FACE.h);

    // ── TABS + COUNTS, row rows-2 ────────────────────────────────────────────────────────────────
    const tabW = Math.floor(Math.min(8, Math.floor(cols * 0.11)) * CELL);
    LEVELS.forEach((name, i) => {
      const x = i * tabW;
      const lbl = fit(name, tabW - 2);
      const lx = x + (tabW - measurePixelText(lbl)) / 2;
      if (i === S.level) { rect(g, x, ry(rows - 2) - 1, tabW, LEAD, INK.YOU);
                           T(g, lbl, lx, ry(rows - 2), { color: INK.BG, rgn: 'tabs', what: 'tab ' + name }); }
      // ⭐ SYSTEM is drawn in the rule's own ink — dimmer than an inactive tab — when the ship is in no
      //   system (`S.noSystem`, Max 2026-09-07: *"disable the system screen when not in a system"*). The
      //   driver refuses the level on the same flag, so the tab looks and acts disabled off ONE value.
      else T(g, lbl, lx, ry(rows - 2), { color: (i === 4 && S.noSystem) ? INK.RULE : INK.DIM, rgn: 'tabs', what: 'tab ' + name });
    });
    // ⭐⭐ AC-12 — THE FREE RUN RIGHT OF THE FIFTH TAB NOW NAMES THE THREE KEYS NO ROW EVER NAMED.
    //    `V` cycles the whole look, `SHIFT+TAB` walks back up the drill and `ESC` is the way out — all
    //    three bound in every design at every level, and all three invisible until a pilot was told.
    //    ⭐ AND THIS IS THE ROW THEY BELONG ON: it is the tab strip, so the key that moves between tabs
    //    is legible beside the tabs it moves between.
    // ⛔ THE LEVEL COUNTS GAVE UP THIS RUN, AND THEY ARE NOT LOST — MEASURED. The run is 207 texels at
    //    417 (five 42-texel tabs); the legend is 197 and the counts up to 71, so the two cannot share
    //    it at any spelling. `d1Rail` already draws the SAME number as its header's right-hand column
    //    (`SECTORS 775`, `TILES 64`, `TILES 256`, `STARS 12/27K`, `BODIES 9`) at every level, four
    //    texels to the right of where this row printed it — so what is removed here is the SECOND copy
    //    of a readout, which is the shape this codebase names as a defect everywhere else.
    // ⛔ AND IT IS NOT DRAWN OVER THE DRAWN SEARCH'S OWN LEGEND. `d1Search` takes the rail, not this
    //    row, so the strip keeps saying what it always says; `SEARCH_HINT` names ESC for the FIELD.
    const legend = 'V LOOK  SHIFT+TAB BACK  ESC CLOSE';
    T(g, fit(legend, W - 5 * tabW - 2), W - 1, ry(rows - 2), { color: INK.DIM, align: 'right', rgn: 'tabs', what: 'global legend' });

    // ── COMMIT, full width ───────────────────────────────────────────────────────────────────────
    const cur = isHere();
    // ⭐ AC-2 — A SELECTION CAN BE NOTHING, AND THE ROW HAS TO BE ABLE TO SAY SO. `D.selBody` was
    // resolved to a fallback planet whenever nothing was picked, so this row has never drawn an
    // unarmed state at home: it said `BURN TO <some planet>` over a selection the pilot never made.
    // With `state.js` now publishing `null`, the row reads as a PROMPT and the bar drops to the rule's
    // own ink — the same "drawn but not live" treatment design 2's chip already gives its `armed`.
    // ⚠ SCOPED TO HOME ON PURPOSE. `!cur || …` leaves levels 0-3 exactly as they were, including the
    //   full TARGET bar with no target armed; that is design 2's chip's business (`armed` there reads
    //   `D.target`) and changing it here would move a picture no AC in this batch asked about.
    // ⛔ AND A STAR IS NOT A PLANET: `au` on a star row is 0 by construction, so `0.00 AU` would be a
    //    number the instrument does not mean. The star names its CLASS in the same slot instead.
    const armed = !cur || !!D.selBody;
    const label = cur ? (D.selBody
                          ? `BURN TO ${(D.selBody.name || '—').toUpperCase()} · ${D.selBody.kind === 'star'
                              ? (D.selBody.cls || 'STAR').toUpperCase() : `${(D.selBody.au ?? 0).toFixed(2)} AU`} · ENTER`
                          : 'SELECT A BODY TO BURN')
                      : `WARP TO ${(D.target?.name || '—').toUpperCase()} · ${(D.target?.ly || 0).toFixed(1)} LY · ENTER`;
    // ⭐⭐ AC-11 — THE BAR STARTS AT `ry(rows - 1)`, NOT ONE TEXEL ABOVE IT.
    //    `region('commit', …)` above declares row 39 (y 234 at 240p) and `geometry.js`'s `commitY` says
    //    the same, but this fill started at 233 — which is the LAST row of the tab band
    //    (`tabY = (rows-2)*LEAD = 228`, band 228-233). So the top row of the drawn commit bar answered
    //    the tab strip's hit-test: at SYSTEM a press on what looks like BURN changed level instead.
    //    Moving the fill down one texel makes the button the pilot sees and the button the driver tests
    //    the same rectangle. ⚠ Nothing else moves: the LABEL was already drawn at `ry(rows - 1)`, and
    //    240 / LEAD 6 leaves exactly six rows here, so 234-239 is the last full row on the glass.
    rect(g, 0, ry(rows - 1), W, LEAD, armed ? (cur ? INK.YOU : INK.TARGET) : INK.RULE);
    T(g, fit(label, W - 4), W / 2, ry(rows - 1), { color: armed ? INK.BG : INK.DIM, align: 'center', rgn: 'commit', what: 'commit label' });
  }

  /**
   * ⭐⭐ THE REACHABLE GALAXY, MEASURED OFF `getSectorAt` INSTEAD OF ASSUMED — AC-1's FIRST HALF.
   *
   * Max: *"I like removing the negative space; the chunky cells of design1 today are good but there are
   * too many cells that are not selectable, so the solution is simply to remove the negative/
   * non-selectable space and redraw the cells from there."* So the GALAXY square stops being the
   * nominal 44 kpc disc and becomes the bounding box of the ground a click can actually land on.
   *
   * ⛔ AND THE AUTHORITY IS THE PICKER'S OWN. `D.sectors` is the very object `picking.js:pickSector`
   * calls (`state.js:491` assigns `nav._sectors` to it), so the picture cannot disagree with the
   * picker — which is the entire risk in this AC, and the reason this is a MEASUREMENT rather than a
   * radius of my own. `getSectorAt`'s only `null` path is `R > GalacticMap.GALAXY_RADIUS * 1.2`
   * (`GalacticSectors.js:44-46`); inside that it always answers, by bounds containment or by the
   * nearest-centre fallback for the pruned outer cells. So the reachable set is a disc about the
   * origin, and bisecting outward along 32 rays finds its edge to floating-point precision. On the
   * shipped seed that lands on **18.000 kpc exactly**, against a nominal view of 44 — which is where
   * the wasted space came from: 47.5% of the drawn square resolved to nothing.
   *
   * ⚠ IT CAN ONLY TIGHTEN, NEVER LOOSEN (`Math.min` at the call site). A footprint wider than the
   *   nominal view would mean ZOOMING OUT — showing less galaxy per texel to reveal ground that is
   *   already off the glass — which is a different change and not the one he asked for.
   * ⚠ MEMOISED ON THE AUTHORITY'S IDENTITY. ~1,400 probes, once, for the life of the `GalacticSectors`
   *   instance; the galaxy is generated from a fixed seed and its edge cannot move under us.
   * ⛔ NULL WHEN THERE IS NO AUTHORITY — `state.js:325` defaults `D.sectors` to `null`, so for a frame
   *   it can simply be absent. The caller then draws today's picture unchanged. Degrading to a guess
   *   would be this page inventing a galaxy edge; degrading to nothing would blank the map.
   */
  let _fitOwner = null, _fitR = null;
  function reachableRadius() {
    const sec = D.sectors;
    if (!sec || typeof sec.getSectorAt !== 'function') return null;
    if (_fitOwner === sec) return _fitR;
    const at = (x, z) => { try { return !!sec.getSectorAt({ x, z }); } catch (e) { return false; } };
    let R = 0;
    for (let k = 0; k < 32; k++) {
      const th = Math.PI * k / 16, cx = Math.cos(th), cz = Math.sin(th);
      let lo = 0, hi = 1;
      while (hi < 4096 && at(cx * hi, cz * hi)) { lo = hi; hi *= 2; }
      for (let s = 0; s < 24; s++) { const m = (lo + hi) / 2; if (at(cx * m, cz * m)) lo = m; else hi = m; }
      if (lo > R) R = lo;
    }
    _fitOwner = sec; _fitR = R > 0 ? R : null;
    return _fitR;
  }

  /**
   * ⭐ THE GALAXY VIEW, RE-FITTED TO THAT FOOTPRINT — and it is DESIGN 1's, not `levelView`'s.
   *
   * ⛔ `levelView` IS SHARED BY ALL THREE DESIGNS AND MUST NOT MOVE. Design 2's GALAXY renders the
   * square at the WIDE extent and crops a band out of the middle, so shrinking the extent there would
   * NARROW that band from ±11.54 kpc to ±9.4 and push more of its 20 already-off-glass sectors further
   * off. Design 2's failure is the opposite one and is not in this pass; this re-fit is applied where
   * the square is actually drawn.
   * ⚠ LEVELS 1-2 ARE RETURNED UNTOUCHED — the same object, not a copy. Their picker is `pickTile`,
   *   which answers for every cell inside the picture; there is no unreachable ground down there to
   *   remove, and a sector question asked of a tile grid would be a category error.
   */
  function d1GalaxyView(level) {
    const v = levelView(level);
    const R = level === 0 ? reachableRadius() : null;
    return R ? { cx: v.cx, cz: v.cz, size: Math.min(v.size, 2 * R), n: v.n } : v;
  }

  /**
   * ⭐⭐ AND THEN THE CELLS THAT STILL HOLD NOTHING ARE NOT DRAWN — AC-1's SECOND HALF.
   *
   * ⛔ A SQUARE GRID OVER A DISC ALWAYS HAS DEAD CORNERS, so the re-fit alone cannot finish the job:
   * at 36 kpc across, 8x8, the corner cells still reach R = 22.3 where nothing resolves. Removing them
   * is the rest of *"remove the non-selectable space"*.
   *
   * ⭐ THE TEST IS THE CELL'S CENTRE, THROUGH `getSectorAt` — because the centre is where a pilot aims,
   * and because "every cell you can see, you can click" is the promise the grid makes. MEASURED on the
   * re-fitted square: 52 of 64 cells resolve at their centre, and **94.2% of the ground those 52 cells
   * cover resolves to a sector**, against 52.5% of the square today.
   * ⚠ THE ONE THING THIS COSTS, MEASURED RATHER THAN ARGUED. Eight boundary cells are centre-dead but
   *   hold a live sliver in the corner nearest the galaxy — each **16.0% live, 2.55% of all live ground
   *   on the square** — and they are no longer advertised. That is the direction that could have traded
   *   one defect for a worse one, so it was checked at the level that matters: sampling the whole square
   *   at 1200x1200 and bucketing every answer by cell, **774 sectors are reachable inside a DRAWN cell
   *   and ZERO are reachable only through an undrawn one.** No sector lost its affordance.
   * ⚠ AND THE RE-FIT IS WHAT MADE THE CENTRE TEST SAFE. On the 44 kpc square it would have blanked 32
   *   cells, 20 of them with live ground — the failure `MEASUREMENTS.md` §7's ring is really measuring.
   *   Re-fit first, then cull: the disputed band drops from 20 cells to 8.
   *
   * ⛔ MEMOISED ON THE FRAME'S OWN EXTENT, so a change of view can never serve a stale answer, and the
   * GALAXY extent is derived once — 64 probes for the life of the page, not per frame.
   */
  let _liveCellsKey = null, _liveCellsOwner = null, _liveCells = null;
  function liveGridCells(level, v, n) {
    const sec = D.sectors;
    if (level !== 0 || !sec || typeof sec.getSectorAt !== 'function' || !(n > 0)) return null;
    const key = `${v.cx}|${v.cz}|${v.size}|${n}`;
    if (_liveCellsKey === key && _liveCellsOwner === sec) return _liveCells;
    const set = new Set(), k = v.size / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let hit = true;                                    // a throwing authority draws, never blanks
      try { hit = sec.getSectorAt({ x: v.cx + (i + 0.5 - n / 2) * k, z: v.cz + (j + 0.5 - n / 2) * k }); }
      catch (e) { hit = true; }
      if (hit) set.add(j * n + i);
    }
    _liveCellsKey = key; _liveCellsOwner = sec; _liveCells = set;
    return set;
  }

  function d1TwoD(g, mapW, mapY, mapH) {
    const v = d1GalaxyView(S.level);
    const sq = Math.min(mapW, mapH), ox = Math.round((mapW - sq) / 2);
    blitLum(g, lumImage(v.cx, v.cz, v.size / 2, sq), ox, mapY, sq, sq, sq);
    const n = S.level === 0 ? 8 : v.n;
    // ⭐ THE GRID IS LAID DOWN ONE CELL AT A TIME, so a cell holding no clickable ground simply is not
    // drawn. ⛔ The two forms below are the SAME TEXELS when nothing is culled: a cell's four edges are
    // sub-segments of the same `ox + round(sq*i/n)` rules, and the union over `j` of `[Y_j, Y_{j+1})`
    // is exactly the full-height line the fallback draws. So the fallback is not a second layout — it
    // is the same one, spelled in fewer calls for the levels that have nothing to remove.
    // ⚠ `n` IS STILL 8 AND THE SQUARE IS STILL `sq` TEXELS, so the cell is still 27 texels across —
    //   *"the chunky cells of design1 today are good"*. The re-fit changed how much GALAXY a cell
    //   covers (5.5 kpc → 4.5), never how big it is on the glass.
    const live = liveGridCells(S.level, v, n);
    const gx = (i) => ox + Math.round(sq * i / n), gy = (j) => mapY + Math.round(sq * j / n);
    if (!live) {
      for (let i = 0; i <= n; i++) { rect(g, gx(i), mapY, 1, sq, INK.RULE); rect(g, ox, gy(i), sq, 1, INK.RULE); }
    } else for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (!live.has(j * n + i)) continue;
      const x0 = gx(i), x1 = gx(i + 1), y0 = gy(j), y1 = gy(j + 1);
      rect(g, x0, y0, 1, y1 - y0, INK.RULE); rect(g, x1, y0, 1, y1 - y0, INK.RULE);
      rect(g, x0, y0, x1 - x0, 1, INK.RULE); rect(g, x0, y1, x1 - x0, 1, INK.RULE);
    }
    const toX = (x) => ox + ((x - v.cx) / v.size + 0.5) * sq;
    const toY = (z) => mapY + ((z - v.cz) / v.size + 0.5) * sq;
    // YOU — a 1-texel frame plus a 3x3 block, no pulse
    const px = toX(D.player.x), py = toY(D.player.z);
    const cell = sq / n;
    // ⭐⭐ AC-19 — CLIPPED TO THE PAINTED SQUARE, WHICH IS THE PICTURE AND NOT THE PANE. `ox`/`sq` are
    // what the luminosity blit and the grid were drawn at; the columns either side of the square are
    // inside the map REGION and outside the map, which is the same distinction the pick geometry
    // published two paragraphs down ("a click there is a MISS, never a clamp").
    // ⛔ THE HOST'S 2D PAN IS LIVE AT LEVELS 0-2 AND MOVES `v.cx`/`v.cz`, so these three marks are the
    //    only things on this pane whose position a pilot can drive off it. Unclipped they painted over
    //    the status row and the ranked rail and SURVIVED TO THE FINAL FRAME — design 1 repaints
    //    neither (REVIEW C19). Nothing here moves while the camera is where Max ruled on it.
    // ⚠ THE MARKS ARE GUARDED AS WELL AS CLIPPED, and against the box that LANDED. An empty
    //   intersection is not asserted at all: a 0x0 box at a clamped corner is not a mark, and
    //   `assertFits` would read it as one.
    const sqPane = { x: ox, y: mapY, w: sq, h: sq };
    const youCell = frameClip(g, Math.floor((px - ox) / cell) * cell + ox,
                              Math.floor((py - mapY) / cell) * cell + mapY, cell, cell, INK.YOU, sqPane);
    if (youCell.w > 0 && youCell.h > 0) assertMark('YOU cell', 'map', youCell.x, youCell.y, youCell.w, youCell.h);
    const youDot = rectClip(g, px - 1, py - 1, 3, 3, INK.YOU, sqPane);
    if (youDot.w > 0 && youDot.h > 0) assertMark('YOU marker', 'map', youDot.x, youDot.y, youDot.w, youDot.h);
    if (D.target) {
      const tg = spriteClip(g, toX(D.target.wx), toY(D.target.wz), SP.diam5, INK.TARGET, sqPane);
      if (tg.w > 0 && tg.h > 0) assertMark('target diamond', 'map', tg.x, tg.y, tg.w, tg.h);
    }
    // the eight ranked tiles carry a 2-char id; at 16x16 the cell is 13 texels and only the listed
    // tiles are tagged, which is the design saying so rather than the glyphs colliding
    const ids = d1TileOrder(d1TileRows(v, n)).slice(0, 8);
    ids.forEach((t, i) => {
      const tx = ox + t.i * cell + 2, ty = mapY + t.j * cell + 2;
      if (cell < measurePixelText(t.id) + 3) return;
      // ⛔ AND NEVER A PLATE ON A CELL THAT IS NOT DRAWN. A named tile with no cell around it is the
      //   same promise the culled cells were removed for making, and `plated()` knocks out a BG rect
      //   first, so it would ALSO punch a hole in the density behind it. Total rather than incidental:
      //   at this seed the eight densest tiles are all central and this has never fired.
      if (live && !live.has(t.j * n + t.i)) return;
      // ⚠ THE ONE UNAMBIGUOUS LABEL ON THE PAGE, AND IT NEEDS NO PLACER. A tile id is drawn INSIDE its
      //   own cell, guarded by the `cell < measurePixelText + 3` test above, so it can neither collide
      //   with another label nor sit on a mark it does not name. It is published all the same, because
      //   a picker that has to special-case which labels are hit-testable is a second rule.
      S.labelHits.push({ ...plated(g, t.id, tx, ty, INK.DIM, 'map', 'tile id ' + t.id), ref: t, kind: 'tile' });
    });
    // ⭐ THE CLICK-HIGHLIGHT (INTERFACE §5). Drawn LAST so it sits over the grid, the tile ids and the
    // YOU marker — a "you hit this one" that a rule can cross is not an acknowledgement.
    const pk = pickCell(S.level);
    if (pk) frame(g, ox + pk.i * cell, mapY + pk.j * cell, cell, cell, INK.KEY);
    // ⭐ AND AT GALAXY THE HIGHLIGHT IS THE SECTOR (AC-5). Same ink, same drawn-last rule, different
    // geometry — see `pickedSector`. Both edges of each axis go through THIS pane's own `toX`/`toY`
    // and are rounded ONE EDGE AT A TIME, which is exactly how the grid's rules are laid down
    // (`gx(i) = ox + round(sq * i / n)`): rounding a width instead would let the frame drift a texel
    // off the boundaries the grid already draws on.
    // ⛔ INTERSECTED WITH THE PAINTED SQUARE, AND SKIPPED WHEN THE INTERSECTION IS EMPTY. A sector can
    //    straddle the re-fitted footprint's edge and `rect()` clips nothing, so an unclipped frame
    //    would paint over the map's rule, the rail and the status row — chrome that is not the map's
    //    to write on, and the failure the region guard exists to catch elsewhere.
    // ⛔ AND IT DRAWS NOTHING WHEN `S.pick` IS NULL, which is every frame until a click commits: the
    //    default picture Max ruled on cannot move.
    const ps = S.level === 0 ? pickedSector() : null;
    if (ps) {
      const sx0 = Math.max(ox, Math.round(toX(ps.centerX - ps.size / 2)));
      const sy0 = Math.max(mapY, Math.round(toY(ps.centerZ - ps.size / 2)));
      const sx1 = Math.min(ox + sq, Math.round(toX(ps.centerX + ps.size / 2)));
      const sy1 = Math.min(mapY + sq, Math.round(toY(ps.centerZ + ps.size / 2)));
      if (sx1 > sx0 && sy1 > sy0) frame(g, sx0, sy0, sx1 - sx0, sy1 - sy0, INK.KEY);
    }
    // ⭐ THE PICK GEOMETRY, PUBLISHED BY THE CODE THAT DREW IT — the same principle as `region()` and
    // as `S.ladderStops` below. A hit-test that restates `ox` / `sq` / `n` is a SECOND COPY of this
    // layout, and two copies of one geometry with one silently wrong is the whole AC-4 defect shape.
    // ⚠ THE PICTURE IS THE SQUARE, NOT THE REGION. The map region is `mapW` wide and the square is
    //   `sq` wide at `ox`, so the columns either side are inside the region and outside the picture:
    //   a click there is a MISS, never a clamp. That is why `ox`/`sq` are published and not the pane.
    // ⛔ A PURE WRITE, PLACED AFTER EVERY DRAW CALL IT READS FROM. Not one texel above moves.
    S.mapProj = { design: 1, level: S.level, kind: 'square',
                  ox, oy: mapY, sq, n, cell, cx: v.cx, cz: v.cz, size: v.size };
  }

  const AZ = 'ABCDEFGHIJKLMNOP';
  function d1TileRows(v, n) {
    const out = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = v.cx + (i + 0.5 - n / 2) * (v.size / n);
      const z = v.cz + (j + 0.5 - n / 2) * (v.size / n);
      out.push({ i, j, id: AZ[i] + (j + 1), x, z, n: estStars(x, z, v.size / n) });
    }
    return out.sort((a, b) => b.n - a.n);
  }

  /**
   * ⭐ THE BIGGEST ESTIMATE IN A RANKING — WHAT EVERY DENSITY BAR ON THIS PAGE NORMALISES AGAINST.
   *
   * ⛔ AND IT IS A FUNCTION RATHER THAN `rows[0].n` BECAUSE `rows[0]` IS ONLY THE MAXIMUM WHILE THE
   * LIST HAPPENS TO BE COUNT-SORTED, AND THAT STOPPED BEING TRUE THE DAY `[` AND `]` LANDED. Measured
   * at GALAXY under the NAME key, on a 427x240 buffer: `D.sectorRows[0]` estimates 32,078,857 stars
   * against a true maximum of 6,836,551,510, so the drawn page's worst row asked for **90 bar squares
   * instead of four**, 583 of them a frame against nought, and **475 fills landed off the buffer** —
   * the furthest at x = 940 on a canvas 427 texels wide. The tile branch had already been given the
   * whole-ranking fix ("THE BAR NORMALISES AGAINST THE WHOLE RANKING, NOT THE PAGE"); this is that
   * same fix, spelled once, for every caller that needs a denominator rather than an order.
   * ⚠ IDENTICAL TO `rows[0].n` UNDER EVERY DEFAULT — every list here opens count-sorted, which is
   *   exactly why the defect was invisible until a second sort key existed.
   */
  function rankMax(rows) {
    let m = 0;
    for (const r of rows) if (r && r.n > m) m = r.n;
    return m || 1;
  }

  /**
   * ⭐ THE TILES, RE-ORDERED BY THE ACTIVE SORT KEY (AC-8 at SECTOR and REGION).
   *
   * The driver publishes `S.sortIdx` / `S.sortLabel` at every level, but levels 1-2 are the two whose
   * rows are not in `D` at all — they are built and ranked INSIDE this paint — so the driver cannot
   * re-order them the way it re-orders `D.sectorRows` / `D.starRows` / `D.bodies`. The key was
   * therefore published, drawn on the hint row, and honoured by nothing: pressing `]` at SECTOR moved
   * a label and left the list exactly as it was.
   *
   * ⛔ THE DISCRIMINATOR IS `S.sortLabel`, THE ONE-WORD NAME THE DRIVER ALREADY PUBLISHES AND THIS
   * DESIGN ALREADY DRAWS. A copy of the driver's key TABLE here would be two lists of sort keys with
   * no mechanism holding them together — the AC-4 defect shape wearing a different hat — whereas the
   * label is a value that arrives with the frame and is on the glass beside the list it ordered.
   * ⚠ AND THE ID ORDER IS `(i, j)`, NOT `localeCompare(id)`. The ids read A1..A16, and a string sort
   *   puts A10 between A1 and A2, which is not what "sorted by ID" means to anyone reading the rail.
   * ⛔ IT RETURNS THE ARRAY UNTOUCHED UNDER THE DEFAULT KEY — the same array identity, not a copy —
   *   so the count-ranked picture Max ruled on is reproduced by never running.
   */
  function d1TileOrder(rows) {
    if (S.sortLabel !== 'ID') return rows;
    return rows.slice().sort((a, b) => (a.i - b.i) || (a.j - b.j));
  }

  function d1Prism(g, mapW, mapY, mapH, gaugeX) {
    const cxp = mapW / 2, cyp = mapY + mapH / 2;
    const shown = [];
    for (const s of D.starRows) {
      const p = projectPrism(s, cxp, cyp, mapW / 2, mapH / 2);
      if (p.x < 0 || p.x >= mapW || p.y < mapY || p.y >= mapY + mapH) continue;   // ⭐ THE BOUNDS CULL
      shown.push({ s, p });                                                       // (there is none today)
      if (shown.length >= 240) break;                                             // and the draw cap
    }
    /*  Function · the three depth cues, in the order they have to be painted.
     *  Intent · AC-2 (restorations). Legacy sorts the on-screen set far-first (NavComputer.js:2029,
     *    `b.starP.depth - a.starP.depth`) so a near star's glyph lands ON TOP of a far one's; draws a
     *    plane grid under everything (:1994-2014); and hangs a drop line off each mark (:2074-2079).
     *    This design drew none of the three: 240 identical dots with no depth order and no horizon.
     *  ⛔ THE SORT IS OVER THE CAPPED SET, AND THE CAP AND THE CULL ARE UNTOUCHED. The loop above
     *    still decides WHICH marks exist; this only decides the ORDER they are painted in — and
     *    `S.prismHits` is published off the same array afterwards, so it stays exactly "in DRAW
     *    ORDER" as its own note requires. `Array.prototype.sort` is stable, so equal depths keep the
     *    catalogue's order. ⚠ `depth` is `projectPrism`'s own third return, the rotated z; legacy's
     *    descending sort is reproduced sign for sign.
     *  Deliberate non-goals · no per-mark size or brightness by depth (the low-fi mark is Max's
     *    ruling on item 14: *"keep the low-fi marks"*), no z-buffer, no occlusion test. */
    shown.sort((a, b) => b.p.depth - a.p.depth);
    prismPlane(g, cxp, cyp, mapW / 2, mapH / 2, REGIONS.map);
    for (const { s, p } of shown) {
      prismDrop(g, p, REGIONS.map);                                                // the stem, under the mark
      rect(g, p.x, p.py, 1, 1, INK.RULE);                                          // the plane dot
      if (s === D.selStar) { frame(g, p.x - 2, p.y - 2, 5, 5, INK.TARGET); continue; }
      if (s.dist < 1e-6)   { frame(g, p.x - 2, p.y - 2, 5, 5, INK.YOU); continue; }
      // ⭐ AC-2 — A CATALOGUE STAR TAKES ITS SPECTRAL INK AND A RING; A PROCEDURAL ONE KEEPS THE DOT.
      //    Legacy colours every marker by `star.color` and rings the catalogue ones in amber
      //    (NavComputer.js:2104/2109-2113). Design 2 already spends the SPECTRAL table; design 1 spent
      //    exactly one bit — `plus` or dot — so its prism could not say what KIND of star anything
      //    was. The ring is `frame`'s four one-texel rects, the only ring this file can draw.
      // ⚠ THE RING IS 5x5, OUTSIDE `plus`'s 3 texels and inside the picker's r = 3, so it adds no
      //   pickable area and cannot be confused with the 5x5 SELECTED/YOU frames — both of those
      //   `continue` above and are drawn in their own inks.
      if (s.isReal) { plus(g, p.x, p.y, SPECTRAL[s.spectral] || INK.BODY);
                      frame(g, p.x - 2, p.y - 2, 5, 5, INK.HALO); }
      else rect(g, p.x, p.y, 1, 1, INK.DIM);
    }
    // ⭐ EVERY STAR MARK, IN DRAW ORDER, OUT OF THE ARRAY THE CULL AND THE CAP BUILT. `shown` IS the
    // publication's whole value: the bounds cull and the 240-mark draw cap live in the loop above and
    // nowhere else, so a picker walking `D.starRows` would offer marks that are not on the glass.
    // r = 3 is the largest drawn glyph's half-extent plus a texel — the two selection frames are 5x5
    // and `plus` is 5 texels across — and the picker takes the NEAREST inside r, so marks that
    // overlap at this radius resolve to the near one instead of to whichever was tested first.
    S.prismHits = shown.map(({ s, p }) => ({ x: p.x, y: p.y, r: 3, ref: s }));
    // ⭐ THE MAP'S LABELS. Until AC-3 (restorations) these were EIGHT SINGLE-CHARACTER INDEX TAGS —
    //    chosen over 139 labels of which 100 were already faded, and replaced now by the NAMES of the
    //    catalogue stars, which is what legacy put here. The placer's history below still holds: it is
    //    the same call, at the same site, with a longer string.
    // ⛔⛔ AND THIS IS THE SITE THAT NEVER CALLED THE PLACER AT ALL — a bare `p.x + 3, p.y - 6` over a
    //    field of up to 240 marks. It is the only one of the four that could actually DESTROY a label:
    //    measured over 120 frames before this change, 507 texels of one tag's glyphs erased by a later
    //    tag's knockout plate, worst frame 50 — because `plated()` lays its BG rect first, so the tag
    //    drawn second rubs out the one drawn first. The three sites that DID call the placer scored
    //    zero on that same measurement; they were dropping labels, not smearing them.
    // ⚠ THE MANUAL BOUNDS TEST IS GONE, NOT LOST: `placeLabel` makes the same test against the declared
    //   region and then tries thirteen more slots, so a tag that used to be skipped for being 3 texels
    //   from the right edge now goes on the star's left instead.
    /*  Function · the NAME of every catalogue star that can find a slot, in place of the eight digits.
     *  Intent · AC-3 (restorations), page item 15. Max: *"names yes"*. Legacy labels exactly the rows
     *    this one does — `star.isReal && star.name` (NavComputer.js:2109-2133) through a placement
     *    solver (:2337-2387) — and the page's prism table scores this design NAMES ON THE MAP 0: eight
     *    digits that are a cross-reference to the rail and say nothing about the thing under them.
     *  ⛔ THE PRIORITY IS SELECTED > CURRENT > NEAREST, AND IT IS THE DRAW ORDER, NOT A SCORE.
     *    `placeLabel` gives the first caller first pick of fourteen slots and refuses anything that
     *    would overlap a placed label or cover a foreign mark, so ordering the callers IS the
     *    priority: the selected star is asked first and therefore always gets a slot if one exists,
     *    and a lower-priority name with nowhere to go is DROPPED rather than overprinted. The guard
     *    stays silent because a dropped label draws nothing.
     *  ⚠ THE STAR KEEPS ITS ENTRY IN `S.prismHits` EITHER WAY — a dropped label leaves a star
     *    UNNAMED, never UNPICKABLE (`placeLabel`'s own note).
     *  ⚠ AND THE CAP IS DESIGN 2'S, SPELLED THE SAME WAY (`mapH / 22`), because the question it
     *    answers — how many names a pane this tall can carry before it is a wall of type — is a
     *    property of the pane, not of the design.
     *  Deliberate non-goals · the eight index tags are GONE, so the rail's leading 1-8 column now
     *    cross-references a mark that carries its own name instead of a digit; no membership suffix
     *    (legacy's `Proxima · Alpha Centauri`, NavComputer.js:2115-2130) — not in item 15. */
    const nameCap = Math.max(4, Math.floor(mapH / 22));
    const rank = (s) => (s === D.selStar ? 0 : s.dist < 1e-6 ? 1 : 2);
    const named = shown.filter(({ s }) => s.isReal && s.name)
                       .sort((a, b) => (rank(a.s) - rank(b.s)) || ((a.s.dist ?? 0) - (b.s.dist ?? 0)));
    const nameTaken = [];
    let namesDrawn = 0;
    for (const { s, p } of named) {
      if (namesDrawn >= nameCap) break;
      const txt = fit(String(s.name).toUpperCase(), mapW - 8);
      const pos = placeLabel(nameTaken, S.prismHits, p.x, p.y, 3, 6, measurePixelText(txt), REGIONS.map, s);
      if (!pos) continue;                                                        // dropped, never faded
      S.labelHits.push({ ...plated(g, txt, pos.x, pos.y, INK.KEY, 'map', 'prism label ' + txt),
                         ref: s, kind: 'star' });
      namesDrawn++;
    }
    // the Y-gauge: 6 texels carrying the whole 60x160 minimap
    //
    // ── ⭐ AC-9 — IT IS A HANDLE, AND WHAT IT HANDLES IS A CONTROL MAX ALREADY ASKED FOR ──────────
    //
    // Max, UAT 2026-08-01: *"I still can't use the up/down controls to rise and lower below the
    // galactic plane on the prism menu."* That is `R` / `F` (`NavComputer:1392-1393`), which moves
    // `_localCenter.y` — and the LEGACY prism drew it: a camera mark at `camScreenY` (`:3618`), a
    // height in pc beside it (`:3669`) and a literal `WASD move · R/F up/down` hint. This design's
    // gauge kept the SELECTED STAR's offset and dropped the camera entirely, so the one readout that
    // told you where you were vertically went with it. Max, 2026-09-07: *"The indicators on the prism
    // and system screens should be grabbable."*
    //
    // ⛔ THE MAPPING IS DECLARED ONCE AND USED BY BOTH MARKS, and it is published as `S.yGaugeRect` so
    //    the drag can invert exactly the arithmetic that drew it. The star mark is algebraically the
    //    line it replaces — `dy = (wy - base)/HALF` then `dy * mapH/2` is `((wy - base)/HALF) * span`
    //    — so the picture Max ruled on is reproduced texel for texel, not approximately.
    // ⛔ AND THE CAMERA MARK IS DRAWN ONLY ONCE THE CAMERA HAS LEFT THE PLAYER'S PLANE. At entry
    //    `_localCenter` IS the player (`NavComputer:1186`), so the default picture gains no mark at
    //    all and AC-11's regression guard holds; the mark appears the moment R, F or a drag moves it,
    //    which is the only moment it says anything.
    // ⚠ THE STRIP'S OWN SCALE IS THE DRAG'S RANGE. +/-2 pc is what the gauge DISPLAYS, so it is what
    //   the grab traverses — one scale for the readout and the handle. Beyond it the keys still go
    //   further and the mark pegs at the end, exactly as a star's mark already does.
    // ⭐ AC-10 (restorations) — THE STRIP ITSELF IS NOW `yGauge`, SHARED WITH DESIGN 2's PRISM. The
    //    five draws, the mapping and the eight published fields moved there VERBATIM (see its header
    //    for why it is one function and not two); `gy + gh/2` and `gh/2` are exactly the `mapY +
    //    mapH/2` and `mapH/2` this site used, so design 1's PRISM is byte-identical.
    yGauge(g, gaugeX, mapY, mapH);
  }

  /**
   * ⭐⭐ AC-20 — ONE ORDERING FOR BOTH HALVES OF THE SYSTEM SCREEN, AND ONE TAG PER BODY.
   *
   * ⛔ THE SCREEN USED TO SPELL THE SAME ALPHABET TWICE AND FEED IT TWO DIFFERENT INDICES. The ladder
   * tagged `D.bodies.filter(kind !== 'moon')` by position; the rail tagged `D.bodies` — moons included
   * — by position. `state.js` pushes each moon straight after its parent, so the two indices diverged
   * at the FIRST MOON and every non-moon body after it carried a different letter on the two halves of
   * one frame: Mars "4" on the ladder and "5" in the rail, Jupiter "5" and "8" (REVIEW C20). The tag is
   * display-only — picking resolves by object — so nothing mis-targeted; what broke is the only
   * cross-reference the screen has, from a row you are reading to the mark you are looking at.
   *
   * ⭐ THE ORDERING IS THE LADDER'S, BY AU, AND THE RAIL PRINTS IT WHATEVER IT IS SORTED BY. The ladder
   * is a PICTURE of the system — the axis is sqrt(AU) — so its left-to-right order is the one that
   * means something about the place; the rail is a LIST, and `[`/`]` re-orders it by name or
   * temperature on the pilot's say-so. A tag that followed the list would renumber the picture every
   * time the list was re-sorted, which is the opposite of a landmark.
   *
   * ⛔ AND SORTING HERE FIXES THE LADDER'S OWN ARITHMETIC UNDER A NON-AU KEY, WHICH WAS ALSO BROKEN.
   *    The minimum-separation pass walks the list left to right and pushes any body within 8 texels of
   *    its predecessor further RIGHT; fed a DESCENDING list (the TEMP key, which on a normal system is
   *    AU reversed) it pushed every body past the last one and off the window — measured on a 5-planet
   *    system at 417x240, the TEMP key drew 2 of 5 ladder tags and the rest scrolled out of `vis()`.
   *    Under the default AU key `D.bodies` is already AU-ascending (`state.js`'s SORT_KEYS[4][0]), so
   *    this sort is a stable no-op and the picture Max ruled on does not move a texel.
   *
   * ⚠ A MOON CARRIES ITS PARENT'S TAG, because a moon has no mark of its own on this ladder — it is a
   *   pip ON its parent's stem. So `3-` in the rail reads "a moon of 3", which is where the pilot's eye
   *   has to go anyway, and it survives a NAME sort that scatters moons away from their planets.
   *   ⛔ MATCHED BY `au`, NOT BY `parent`. A moon row's `au` IS its parent's `orbitRadiusAU` — both
   *      builders set it from the same field (`state.js:578`, and this lab's own `buildSystem`) —
   *      whereas `parent` is an index into `_systemData.planets` that the lab's rows carry and the
   *      ladder's ordering does not preserve.
   */
  const BODY_TAGS = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function d1LadderOrder() {
    return D.bodies.filter((b) => b.kind !== 'moon').slice().sort((a, b) => (a.au ?? 0) - (b.au ?? 0));
  }
  /** The tag for any body, moons included, off one ordering. Returns a function so the map is built once. */
  function d1BodyTagger(order = d1LadderOrder()) {
    const tags = new Map();
    order.forEach((b, i) => tags.set(b, BODY_TAGS[i] || '?'));
    return (b) => {
      if (!b) return '?';
      if (b.kind !== 'moon') return tags.get(b) || '?';
      const parent = order.find((o) => o.kind === 'planet' && o.au === b.au);
      return (parent && tags.get(parent)) || '?';
    };
  }
  /*  Function · AC-4's one question, answered once for both designs: is the SYSTEM screen showing a
   *    planet's moons right now, and if so which planet, which moons, and where is each moon on its
   *    orbit? Returns `null` for the whole-system picture, which is every frame before this wave.
   *  Intent · page item 16, Max's ruling *"yes — a design-side sub-view, not a switch back to the old
   *    one."* Legacy pins `_systemMode = 'planet'` and draws `_renderPlanetDetail`
   *    (NavComputer.js:3256-3537); under a design that pin is deliberately skipped (intent.md's own
   *    non-goal), so the sub-view is a pair of fields on `S` — `S.sysView` and `S.detailPlanet`, both
   *    owned by the DRIVER (SEAM §2) — and this is the ONE place either design reads them.
   *  ⛔ ONE READER, BECAUSE FOUR PAINTERS ASK THE SAME QUESTION. `d1Ladder`, `d1Rail`, `d2System` and
   *    `d2Status` all have to agree about which planet is open and what its moons are; four copies of
   *    `S.sysView === 'planet' && D.bodies.find(...)` is four chances for the rail to list one
   *    planet's moons under another planet's ladder.
   *  ⛔ THE TWO SOURCES ARE JOINED HERE AND NOWHERE ELSE. The NAME is the `D.bodies` moon row — the
   *    rail's own spelling, which AC-7 made the rule for every label on this screen — and the ORBIT,
   *    the PHASE and the RADIUS are `D.sys.planets[i].moons[m]`, the generator's own numbers, which
   *    `buildBodies` does not copy across (a moon row's `au` is its PARENT's AU, by design:
   *    state.js's own note). `mIdx` is the correspondence between them.
   *  ⛔ `sqrt(orbitRadiusEarth)` AND THE `10 + m * 8` FALLBACK ARE LEGACY'S OWN (`:3327`), so the
   *    ordering of the moons on both pictures is the ordering legacy drew.
   *  ⚠ `startAngle` IS READ WITH `Number.isFinite`, NOT WITH LEGACY'S `||` — a moon whose phase is
   *    exactly 0 is at a real angle, and `||` would move it to `m * 2.4`. That is a departure in the
   *    PICTURE, which each design draws in its own language; the fallback for an ABSENT angle is
   *    legacy's own number.
   *  ⛔ AND IT ANSWERS `null` FOR A PLANET WITH NO MOONS, so a sub-view can never be painted with
   *    nothing in it — the same state the DRIVER refuses to enter (SEAM: `moons > 0`), stated twice
   *    because the paint has to stand up on the lab page, which has no driver.
   *  Deliberate non-goals · no caching (it is a find over ~40 rows, once per painter per frame), no
   *    writing to `S` (the DRIVER owns every transition), and no opinion about the SELECTION — that
   *    is `D.selBody`'s, and each design tests it where it frames or names something. */
  function sysDetail() {
    if (!D.bodies || S.sysView !== 'planet') return null;
    const pi = Number.isFinite(S.detailPlanet) ? (S.detailPlanet | 0) : -1;
    if (pi < 0) return null;
    const parent = D.bodies.find((b) => b && b.kind === 'planet' && b.pIdx === pi) || null;
    if (!parent) return null;
    const src = ((((D.sys && D.sys.planets) || [])[pi] || {}).moons) || [];
    const moons = D.bodies.filter((b) => b && b.kind === 'moon' && b.pIdx === pi)
      .sort((a, b) => (a.mIdx | 0) - (b.mIdx | 0))
      .map((row) => {
        const j = row.mIdx | 0, m = src[j] || {};
        const rE = Number(m.radiusEarth);
        const orbitR = Number(m.orbitRadiusEarth) || (10 + j * 8);      // legacy's own fallback, :3327
        return { row, mIdx: j, orbitR, orbit: Math.sqrt(orbitR),
                 ang: Number.isFinite(m.startAngle) ? m.startAngle : j * 2.4,   // legacy's own, :3341
                 type: String(m.type || row.cls || 'MOON').toUpperCase(),
                 rE: Number.isFinite(rE) ? rE : (Number(row.rE) || 0) };
      });
    if (!moons.length) return null;
    // ⛔ ORDERED BY ORBIT RADIUS, NOT BY THE GENERATOR'S INDEX, AND THE LADDER IS WHY — MEASURED.
    //    `ladderAxis` is a SEPARATION pass over a list it assumes is ascending (`d1LadderOrder` hands
    //    it AU order); fed the generator's order it pushes every out-of-order stop 8 texels right of
    //    the one before, so on the four-moon fixture the axis ran 242 texels into a 226-texel window
    //    and the outermost moon was culled off the glass. Sorting here also puts design 2's rings in
    //    inner-to-outer draw order, which is the order legacy draws them in. `mIdx` breaks the tie, so
    //    two moons on the same orbit keep the generator's order between them.
    moons.sort((a, b) => (a.orbitR - b.orbitR) || (a.mIdx - b.mIdx));
    return { pIdx: pi, parent, moons };
  }
  /** The moon currently selected inside `det`, or `null`. ⛔ `D.selBody` is the `D.bodies` moon ROW
   *  (state.js resolves `{type:'moon', planetIndex, moonIndex}` to it), so the test is on `kind` and
   *  the two indices — never on the shape of the object, and never on identity with `row`, because a
   *  re-`refresh()` rebuilds the rows. */
  function selMoonOf(det) {
    const b = D.selBody;
    if (!det || !b || b.kind !== 'moon' || b.pIdx !== det.pIdx) return null;
    return det.moons.find((m) => m.mIdx === (b.mIdx | 0)) || null;
  }
  /*  Function · the virtual axis BOTH of design 1's ladders stand on: the separated stop positions,
   *    how far the axis runs past the window, and the true-position projector the habitable band uses.
   *  Intent · AC-4 gives this design a SECOND ladder (the moons of one planet), and `S.ladderStops` /
   *    `S.ladderMax` are what the DRIVER's scroll control inverts. Two spellings of the separation
   *    pass would be two ladders that scroll by different rules off one set of keys.
   *  ⛔ LIFTED VERBATIM OUT OF `d1Ladder` — the `4 +` margin on both ends, the 8-texel minimum
   *    separation, the unbounded run and the `+ 4` (not `+ 8`) at the end are all ITS measurements and
   *    its comments explain each one; nothing here is new arithmetic.
   *  Deliberate non-goals · it draws nothing and publishes nothing; the caller publishes what it drew. */
  function ladderAxis(values, winW) {
    const vMaxV = Math.max(1e-3, ...values, 1e-3);
    const vpx = (v) => Math.round(4 + (winW - 8) * Math.sqrt(Math.max(0, v) / vMaxV));
    const vx = [];
    let lastV = -99;
    for (const v of values) { let p = vpx(v); if (p - lastV < 8) p = lastV + 8; lastV = p; vx.push(p); }
    const vMax = (vx.length ? vx[vx.length - 1] : 0) + 4;
    return { vpx, vx, maxScroll: Math.max(0, vMax - winW) };
  }
  /** A moon's tag on design 1: its parent's own ladder letter plus a lower-case ordinal — `Cb`, `Cc`.
   *  ⚠ THE SHIPPED FACE HAS NO LOWER CASE (`PixelText.glyphFor` falls back to the upper-case glyph),
   *    so what lands on the glass is `CB`. The string keeps the case the seam specified because the
   *    tag is still exactly one per body and still unique, and a face that authors lower case renders
   *    it as intended with no edit here. */
  const MOON_ORDS = 'bcdefghijklmnopqrstuvwxyz';
  const moonTag = (parentTag, j) => `${parentTag}${MOON_ORDS[j] || '?'}`;

  function d1Ladder(g, mapW, mapY, mapH) {
    // ⛔ THE ROTATABLE ORRERY IS NOT DRAWN. An ellipse at 240p is a 1-texel stroke straddling its own
    // coordinate; this design's answer is a sqrt(AU) LADDER with zero curves.
    //
    // ⭐⭐ IT SCROLLS. Max, 2026-09-07, ruling on the "+3 OFF AXIS" pile-up this had before:
    // *"Let's make it scrollable; rather than 'off axis' have the line end in a '...' that we can
    // scroll toward horizontally, revealing the other bodies in that direction."*
    //
    // ── WHAT CHANGED, AND WHY IT IS A VIRTUAL AXIS RATHER THAN A SMALLER SCALE ────────────────────
    //
    // The obvious fix — shrink the AU scale until everything fits — is the one that cannot work, and
    // the separation pass is the reason. Its job is to keep 8 texels between neighbours so they are
    // distinguishable at all; on Sol, fifteen laddered bodies need 120 texels of separation alone,
    // against a 240p pane that has about 230. Any scale that fits them all puts them back on top of
    // each other, which is the problem the pass exists to solve.
    //
    // So the pass now runs UNBOUNDED and produces however much axis the system actually needs, and the
    // pane is a WINDOW onto it. Bodies keep their true sqrt(AU) position wherever they fit and are
    // pushed right only where they would collide — exactly as before. Nothing is dropped, nothing is
    // piled up, and nothing is drawn in WARN, because running past the end is no longer a failure.
    //
    // ⚠ THE HABITABLE-ZONE BAND STAYS ON TRUE AU while bodies drift right of it under separation.
    // That mismatch is inherited, not introduced — it is what the pass has always done — and it is
    // more visible now that you can scroll along the axis. Logged, not fixed here.
    // ⭐ AC-4 (restorations) — AND WHEN A PLANET IS OPEN THIS PANE IS ITS MOONS' LADDER INSTEAD.
    //    `sysDetail()` answers `null` for every frame that is not in the sub-view, so the whole-system
    //    ladder below is reached by exactly the path it always was and is byte-identical there.
    const det = sysDetail();
    if (det) { d1MoonLadder(g, mapW, mapY, mapH, det); return; }
    const axisY = Math.round(mapY + mapH * 0.62);
    const x0 = 8, x1 = mapW - 10;
    const winW = x1 - x0 - 8;
    rect(g, x0, axisY, x1 - x0, 1, INK.RULE);
    const shown = d1LadderOrder();          // AC-20 — the one ordering, by AU; see `d1LadderOrder`
    const tagOf = d1BodyTagger(shown);

    // ── THE VIRTUAL AXIS ─────────────────────────────────────────────────────────────────────────
    // ⭐ AC-4 — THE PASS ITSELF MOVED INTO `ladderAxis`, AND NOT ONE TEXEL WITH IT. The moon sub-view
    //    is a second ladder that the same `,` / `.` keys and the same `...` caps scroll, and
    //    `S.ladderStops` / `S.ladderMax` are what the DRIVER's control inverts — so the separation
    //    pass has to have ONE spelling or the two pictures scroll by different rules off one key.
    //    Same expressions, same order, same `Math.max(1e-3, ...values, 1e-3)`; see its header.
    const { vpx, vx, maxScroll } = ladderAxis(shown.map((b) => b.au), winW);
    // ⛔⛔ `+ 4`, NOT `+ 8` — AND THE 8 MADE EVERY LADDER OVERFLOW BY EXACTLY FOUR TEXELS. `vpx` already
    //    carries the axis's 4-texel margin on BOTH ends (`4 + (winW - 8) * …` runs 4 .. winW - 4), so
    //    the furthest body always lands at `winW - 4` and the right margin it needs is the same 4 the
    //    left one got. Adding 8 counted that margin twice: `vMax = winW + 4`, `maxScroll = 4` on ONE
    //    planet, four planets or forty (measured 2026-09-08, probing [1], [1,4], [1,4,12], [1,4,12,30],
    //    six and forty bodies — 4 every time, and only the EMPTY ladder read 0). So the `...` cap was
    //    drawn on every system that has a body, promising four texels of nothing beyond the last one,
    //    and the `N-M OF K` counter read `1-N OF N` — the cap Max asked for exists to say "there is
    //    more this way", and it was saying it where there was not. A ladder that fits now publishes
    //    `maxScroll` 0, draws no cap MARKS and no counter (`S.ladderCaps`, the geometry, is published
    //    regardless — the driver's cap clause gates on `ladderMax`); one that does not keeps all three,
    //    four texels shorter, with its last body still at `x1 - 8` when scrolled to the end.
    // ⚠ AND SOL FITS. The first version of this comment said Sol at 427x240 "keeps all three"; it was
    //   written from the old `1-14 OF 15` readout, not measured. Measured live 2026-09-08 at Max's
    //   417x240: Sol's 15 stops end at 222 against a 226-texel window, so no cap and no counter are
    //   drawn on Sol, and the counter appears on a denser system or a narrower buffer (227 wide:
    //   `maxScroll` 21). The counter is a control for the ladders that need it, which Sol is not.
    const scroll = Math.max(0, Math.min(maxScroll, Math.round(S.ladderScroll || 0)));
    // ⭐ PUBLISHED FOR THE SCROLL CONTROL, so the thing that moves the window and the thing that draws
    // it cannot disagree about where the stops are. Same principle as `region()`: it comes OUT of the
    // paint. ⛔ A second copy of this arithmetic in the hit-test is the AC-4 defect exactly.
    S.ladderStops = vx; S.ladderMax = maxScroll; S.ladderScroll = scroll;
    S.ladderCaps = { axisY, x0, x1 };   // where the two "..." marks are, so the thing you CLICK is
                                        // placed by the thing that DREW them and cannot drift from it

    const sx = (v) => x0 + 4 + v - scroll;
    const vis = (x) => x >= x0 && x <= x1;
    // ⭐ AND THE MARKS THEMSELVES, on the same principle as the three lines above it: extended from
    // "where the window stops" to "what a pilot can click". Every entry is pushed beside the draw
    // that makes its mark and under the SAME `vis()` test, so a body that has scrolled off the axis
    // is not offered to the picker — which is the one thing a restated layout could never get right.
    const hits = [];
    const nameQ = [], tagPlates = [];   // AC-7/AC-8 — filled at the tag's draw site, drained below

    // the star sits at virtual 0 and scrolls off with everything else
    if (vis(sx(0))) sprite(g, sx(0), axisY, SP.star7, SPECTRAL[D.sys?.star?.type] || '#fff');
    // ⭐ THE SYSTEM STAR IS A TARGET. It is the one mark on this ladder a pilot will certainly click,
    // and `ref: null` with `star: true` is how the picker tells it from a row of `D.bodies`.
    if (vis(sx(0))) hits.push({ x: sx(0), y: axisY, r: 4, ref: null, moon: -1, star: true });
    // ⭐ AC-2 — AND WHEN THE STAR IS WHAT IS SELECTED, THE FRAME FOLLOWS IT. The mark was already a
    // target the picker offers (`star: true`, above), but nothing on this ladder could SHOW that the
    // pick had landed: `D.selBody` only ever held a planet or a moon, so clicking the star left the
    // frame sitting on whichever planet was selected before — the defect AC-2 names.
    // ⛔ THE SAME 9x9 AT THE SAME `r = 4`, so the frame and the hit radius stay one number apart from
    //    each other, and `INK.TARGET` because that is the ink every other selected body here wears.
    if (vis(sx(0)) && D.selBody?.kind === 'star') frame(g, sx(0) - 4, axisY - 4, 9, 9, INK.TARGET);
    const z = D.sys?.zones;
    if (z) {
      const a2 = Math.max(x0, sx(vpx(z.hzInnerAU))), b2 = Math.min(x1, sx(vpx(z.hzOuterAU)));
      if (b2 > a2) rect(g, a2, axisY + 2, Math.max(1, b2 - a2), 3, INK.YOU);
    }

    shown.forEach((b, i) => {
      const x = sx(vx[i]);
      if (!vis(x)) return;
      // r = 4 matches the 9x9 selection frame this body gets when it IS selected. A belt lands here
      // too, with its own `ref.kind`, so the picker can recognise one and decline rather than leave a
      // stale selection under a click that meant something.
      hits.push({ x, y: axisY, r: 4, ref: b, moon: -1, star: false });
      const ink = b === D.selBody ? INK.TARGET : INK.BODY;
      if (b.kind === 'belt') { for (let k = -6; k <= 6; k += 2) { if (vis(x + k)) rect(g, x + k, axisY, 1, 1, INK.DIM); } }
      else {
        sprite(g, x, axisY, b.rE > 4 ? SP.giant5 : SP.terr3, ink);
        if (b.rings) rect(g, Math.max(x0, x - 4), axisY, Math.min(9, x1 - x + 4), 1, INK.DIM);
        // ⭐ THE ONE PUBLICATION FOLDED INTO A DRAWN LINE, and only because the alternative is a
        // second copy of `axisY - 7 - m * 3`. `rect()` now receives that value through `my`, which is
        // the same expression evaluated once: identical arguments, identical texels.
        for (let m = 0; m < b.moons; m++) { const my = axisY - 7 - m * 3; hits.push({ x, y: my, r: 2, ref: b, moon: m, star: false }); rect(g, x, my, 1, 1, INK.DIM); }
        if (b === D.selBody) frame(g, x - 4, axisY - 4, 9, 9, INK.TARGET);
      }
      const tag = tagOf(b);   // AC-20 — the same letter `d1Rail` prints beside this body's row
      const tw = T(g, tag, x - 2, axisY + 8, { color: b === D.selBody ? INK.KEY : INK.DIM, rgn: 'map', what: 'ladder tag ' + tag });
      // ⭐ AC-7/AC-8 (restorations) — THE NAME IS QUEUED HERE AND PLACED BELOW, for the reason
      //    `d2System`'s tag queue gives: a placer that refuses a slot covering a foreign mark can only
      //    run once `hits` is COMPLETE, and inside this loop it holds only the bodies drawn so far.
      // ⛔ THE LETTER IS NOT REPLACED. AC-20 of the defects batch is that the ladder prints ONE letter
      //    per body and the rail prints the same letter beside that body's row; dropping it for a name
      //    would leave the two halves of this screen unable to refer to each other. The name goes
      //    BESIDE it, which is the half of item 19's wording this design takes. Its own plate is put
      //    into `taken` so a name cannot land on a letter.
      nameQ.push({ b, x, tag });
      tagPlates.push({ x: Math.round(x - 2) - 2, y: axisY + 8, w: tw + 4 });
    });

    // ── ⭐ THE LINE ENDS IN "..." WHERE THERE IS MORE, AND ONLY WHERE THERE IS ────────────────────
    // Three texels on the axis row, in KEY so they read as an affordance rather than as more rule.
    // Absent at an end with nothing beyond it, so the mark always MEANS something.
    if (scroll > 0)         for (let k = 0; k < 3; k++) rect(g, x0 + k * 2, axisY, 1, 1, INK.KEY);
    if (scroll < maxScroll) for (let k = 0; k < 3; k++) rect(g, x1 - 5 + k * 2, axisY, 1, 1, INK.KEY);
    const first = vx.findIndex((v) => sx(v) >= x0);
    const lastI = vx.reduce((acc, v, i2) => (sx(v) <= x1 ? i2 : acc), -1);
    // ⭐ WHICH BODIES ARE ACTUALLY ON THE GLASS, published by the code that put them there. It is what
    // the "N-M OF K" readout below prints, and it is the only honest way to ASSERT that scrolling
    // reveals anything: the tags are drawn by `drawPixelText`, which emits fillRects, so a test that
    // scrapes the context for text finds nothing and passes vacuously whatever the ladder does.
    S.ladderVisible = [first, lastI];
    if (maxScroll > 0) {
      const cStr = `${first + 1}-${lastI + 1} OF ${shown.length}`;
      const cW = T(g, cStr, x1 - 4, axisY + 16,
        { color: INK.DIM, align: 'right', rgn: 'map', what: 'ladder window' });
      // ⭐ AC-9 — THE COUNTER IS A HANDLE, AND ITS BAND IS THE STRING'S OWN. `T()` returns the width it
      // measured and the right align subtracts exactly that from `x1 - 4`, so `x` here is the left edge
      // the glyphs landed on — not `measurePixelText` called a second time on a face that arrives as a
      // parameter and could differ.
      // ⛔ PUBLISHED ONLY INSIDE THIS BRANCH. The readout is drawn only when there is a window to
      //    report (`maxScroll > 0`); a rectangle published when the whole ladder fits would be a
      //    scrubber for a range with one stop in it, grabbable and inert.
      // ⚠ THE COUNTER'S OWN TEXELS DO NOT MOVE UNDER THE DRAG — it is a READOUT, `N-M OF K`, and what
      //   moves is the window it reports. A drawn thumb would be a new element on a SYSTEM picture Max
      //   ruled on and is his call, not this pass's.
      S.ladderCounterRect = { x: x1 - 4 - cW, y: axisY + 16, w: cW, h: FACE.h };
    }
    if (vis(sx(0))) rect(g, sx(0) - 1, axisY - 1, 3, 3, INK.YOU);
    /*  Function · AC-7 and AC-8 — every body and belt on this ladder that has room carries its NAME.
     *  Intent · page items 19 and 20, Max's ruling *"yes"* on both: *"The name is one click away in a
     *    list, not on the thing"*, and *"belts are anonymous dots."* Legacy printed a name under every
     *    body (`NavComputer.js:2833`) and a belt's own label at mid-radius (`:2644`); this design drew
     *    a letter and a run of grey texels.
     *  ⛔ PLACED BY `placeLabel`, SO A NAME NEVER COVERS A BODY IT DOES NOT NAME. Fourteen candidate
     *    slots off each stop, tested against both the labels already placed and every mark in `hits`;
     *    a name with nowhere to go is DROPPED and the body keeps its letter, which is AC-7's own rule
     *    (*"a name that would collide yields to its tag"*) and leaves that body unnamed, never
     *    unpickable — its `hits` entry is untouched.
     *  ⭐ `gy = -14` PUTS THE LADDER'S NAMES BELOW THE AXIS, under the letter row: the moon pips climb
     *    UPWARD from every stop (`axisY - 7 - m*3`), so the room on this picture is downward.
     *  ⭐ AND THE PLATES GO INTO `S.labelHits` WITH `kind: 'body'`, which `picking.pickBody` already
     *    tests before the mark list — so clicking a name selects the body it names, and a belt's label
     *    routes through `bodyIdentity` to the same "no identity, clear the selection" its dots give.
     *  Deliberate non-goals · no leader lines, no second tag, no re-ordering of the axis (AC-20's AU
     *    order is untouched), and no name on the system star — AC-8 gives the star a LINE, not a label. */
    const taken = tagPlates.slice();
    for (const q of bodyLabelOrder(nameQ)) {
      const txt = fit(bodyLabelText(q.b), mapW - 8);
      if (!txt) continue;
      const pos = placeLabel(taken, hits, q.x, axisY, 4, -14, measurePixelText(txt), REGIONS.map, q.b);
      if (!pos) continue;
      S.labelHits.push({ ...plated(g, txt, pos.x, pos.y, q.b === D.selBody ? INK.KEY : INK.DIM,
                                   'map', 'ladder name ' + txt), ref: q.b, kind: 'body' });
    }
    /*  Function · AC-5 — the ship's diamond on this ladder, its word, and the dashed line to the
     *    target. `drawShip` is design 2's too; see its header for why the position is looked up in
     *    `hits` rather than recomputed.
     *  Intent · page item 17, Max's ruling *"yes"*. This design drew NO ship at all — the page's
     *    ladder table scores it 0 on *"See where the ship is"* — so on the one screen where a burn is
     *    committed, the pilot could not see which stop he was leaving from.
     *  ⛔ THE SHIP'S STOP IS THE LADDER'S, INCLUDING ITS SCROLL. `hits` is built under `vis()`, so a
     *    ship whose body has scrolled off the window has no entry and NOTHING draws — which is the
     *    honest picture: the axis does not currently show where the ship is.
     *  ⭐ AND IT IS DRAWN AFTER THE NAMES, so `taken` already holds every body label and the word SHIP
     *    yields to them rather than plating over one.
     *  Deliberate non-goals · no heading, no burn time, no second diamond in the rail. */
    drawShip(g, hits, taken);
    S.bodyHits = hits;
  }

  /*  Function · AC-4 — design 1's PLANET DETAIL, drawn in this design's own language: the same
   *    scrolling ladder, with the open planet at its head and its moons at stops by orbit radius.
   *  Intent · page item 16, Max's ruling *"yes — a design-side sub-view, not a switch back to the old
   *    one."* The audit's sentence: *"Moons cannot be seen on their orbits or chosen as burn
   *    targets; a pip click selects the parent."* Legacy answers with an in-scene orrery of moons
   *    (`_renderPlanetDetail`, NavComputer.js:3256-3537) and that is the CONTENT spec — every moon on
   *    its orbit, named, the selected one framed, a burn armed — but not the PICTURE spec: this design
   *    draws no curves at all (see `d1Ladder`'s header), so the moons stand on a ladder.
   *  ⛔ IT IS THE SAME AXIS, NOT A SECOND ONE. `ladderAxis` is `d1Ladder`'s own separation pass, so
   *    `S.ladderStops` / `S.ladderMax` / `S.ladderScroll` mean exactly what they mean on the
   *    whole-system ladder and the `,` / `.` keys and the `...` caps work here for free.
   *  ⛔ THE MOON HITS CARRY THEIR OWN IDENTITY, WHICH IS THE HALF THAT MAKES A MOON A BURN TARGET.
   *    In the whole-system picture a moon pip is published with its PARENT in `ref` and collapses to
   *    the parent downstream (`bodyIdentity`) — that is the defect item 16 names. Here each moon's
   *    `ref` IS the moon's own `D.bodies` row, and the entry additionally carries the explicit
   *    `{ type:'moon', planetIndex, moonIndex, row }` the seam fixed, so the DRIVER can select the
   *    moon without inferring anything from the shape of `ref`.
   *  ⛔ THE SHIP AND ITS TRAJECTORY ARE SUPPRESSED (the seam's PAINT row). `D.ship` names a body in the
   *    SYSTEM's frame — a planet index and a moon index — and this axis is measured in a planet's own
   *    moon-orbit radii; a diamond placed from `hits` here would stand on whatever moon happened to
   *    share the ship's index, which is a mark that lies rather than a mark that is missing.
   *  ⛔ AND NO `INK.YOU` MARK ON THE HEAD. On the whole-system ladder the 3x3 at virtual 0 sits on the
   *    system's star; here virtual 0 is a planet, and `YOU` is the ink this glass reserves for where
   *    the pilot is.
   *  Deliberate non-goals · no habitable band (it is an AU band about the star), no moon pips under a
   *    moon, no second tag, no re-ordering (orbit radius outward, legacy's own `sqrt` order). */
  function d1MoonLadder(g, mapW, mapY, mapH, det) {
    const axisY = Math.round(mapY + mapH * 0.62);
    const x0 = 8, x1 = mapW - 10;
    const winW = x1 - x0 - 8;
    rect(g, x0, axisY, x1 - x0, 1, INK.RULE);
    // ⭐ THE HEAD IS VIRTUAL 0 AND THE MOONS ARE THEIR OWN ORBIT RADII, so the parent sits where the
    //    star sits on the other ladder and the axis reads outward from it exactly as that one does.
    // ⛔ THE RAW ORBIT RADIUS, NOT ITS SQUARE ROOT. `ladderAxis` takes the root itself (it is the AU
    //    ladder's own `sqrt(au)` compression), so handing it `det.moons[].orbit` — already a root for
    //    design 2's rings — would put these stops on a FOURTH root and bunch the outer moons.
    const { vx, maxScroll } = ladderAxis([0, ...det.moons.map((m) => m.orbitR)], winW);
    const scroll = Math.max(0, Math.min(maxScroll, Math.round(S.ladderScroll || 0)));
    S.ladderStops = vx; S.ladderMax = maxScroll; S.ladderScroll = scroll;
    S.ladderCaps = { axisY, x0, x1 };
    const sx = (v) => x0 + 4 + v - scroll;
    const vis = (px) => px >= x0 && px <= x1;
    const hits = [];
    const nameQ = [], tagPlates = [];
    const parentTag = d1BodyTagger()(det.parent);
    const selM = selMoonOf(det);
    // ── THE OPEN PLANET, AT THE HEAD ─────────────────────────────────────────────────────────────
    const hx = sx(vx[0]);
    if (vis(hx)) {
      sprite(g, hx, axisY, det.parent.rE > 4 ? SP.giant5 : SP.terr3, INK.KEY);
      if (det.parent.rings) rect(g, Math.max(x0, hx - 4), axisY, Math.min(9, x1 - hx + 4), 1, INK.DIM);
      hits.push({ x: hx, y: axisY, r: 4, ref: det.parent, moon: -1, star: false });
      if (D.selBody === det.parent) frame(g, hx - 4, axisY - 4, 9, 9, INK.TARGET);
      const tw = T(g, parentTag, hx - 2, axisY + 8,
                   { color: INK.KEY, rgn: 'map', what: 'moon ladder tag ' + parentTag });
      nameQ.push({ b: det.parent, x: hx, tag: parentTag });
      tagPlates.push({ x: Math.round(hx - 2) - 2, y: axisY + 8, w: tw + 4 });
    }
    // ── THE MOONS ────────────────────────────────────────────────────────────────────────────────
    det.moons.forEach((m, i) => {
      const mx = sx(vx[i + 1]);
      if (!vis(mx)) return;
      const sel = selM === m;
      sprite(g, mx, axisY, SP.moon3, sel ? INK.TARGET : INK.BODY);
      // ⭐ THE ENTRY THE DRIVER READS. `ref` is the MOON's row (so `bodyIdentity` sees `kind:'moon'`
      //    with a real `pIdx`/`mIdx`), `moon` is its index (so the mark list's existing shape is
      //    unchanged), and the four explicit fields are the seam's own — a pick that says what it is
      //    rather than one that has to be inferred from the shape of `ref`.
      hits.push({ x: mx, y: axisY, r: 4, ref: m.row, moon: m.mIdx, star: false,
                  type: 'moon', planetIndex: det.pIdx, moonIndex: m.mIdx, row: m.row });
      if (sel) frame(g, mx - 4, axisY - 4, 9, 9, INK.TARGET);
      const tag = moonTag(parentTag, m.mIdx);
      const tw = T(g, tag, mx - 2, axisY + 8,
                   { color: sel ? INK.KEY : INK.DIM, rgn: 'map', what: 'moon ladder tag ' + tag });
      nameQ.push({ b: m.row, x: mx, tag });
      tagPlates.push({ x: Math.round(mx - 2) - 2, y: axisY + 8, w: tw + 4 });
    });
    // ── THE CAPS AND THE COUNTER, `d1Ladder`'s own rules ─────────────────────────────────────────
    if (scroll > 0)         for (let k = 0; k < 3; k++) rect(g, x0 + k * 2, axisY, 1, 1, INK.KEY);
    if (scroll < maxScroll) for (let k = 0; k < 3; k++) rect(g, x1 - 5 + k * 2, axisY, 1, 1, INK.KEY);
    const first = vx.findIndex((v) => sx(v) >= x0);
    const lastI = vx.reduce((acc, v, i2) => (sx(v) <= x1 ? i2 : acc), -1);
    S.ladderVisible = [first, lastI];
    if (maxScroll > 0) {
      const cStr = `${first + 1}-${lastI + 1} OF ${vx.length}`;
      const cW = T(g, cStr, x1 - 4, axisY + 16,
                   { color: INK.DIM, align: 'right', rgn: 'map', what: 'moon ladder window' });
      S.ladderCounterRect = { x: x1 - 4 - cW, y: axisY + 16, w: cW, h: FACE.h };
    }
    // ── THE NAMES, placed by `placeLabel` against the finished mark list — AC-7's rule, unchanged ──
    const taken = tagPlates.slice();
    for (const q of bodyLabelOrder(nameQ)) {
      const txt = fit(bodyLabelText(q.b), mapW - 8);
      if (!txt) continue;
      const pos = placeLabel(taken, hits, q.x, axisY, 4, -14, measurePixelText(txt), REGIONS.map, q.b);
      if (!pos) continue;
      S.labelHits.push({ ...plated(g, txt, pos.x, pos.y, q.b === D.selBody ? INK.KEY : INK.DIM,
                                   'map', 'moon ladder name ' + txt), ref: q.b, kind: 'body' });
    }
    S.bodyHits = hits;
  }

  function d1Rail(g, x, y, w, cols, rowCount) {
    const LEAD = FACE.h + 1;
    // ⭐ THE DRAWN SEARCH TAKES THE RAIL, BECAUSE THE RAIL IS WHERE THIS DESIGN ALREADY PUTS A RANKED
    // LIST YOU PICK A DESTINATION OFF. A floating box would have had to invent a plate, a frame and a
    // shadow this design does not own — and at 240p that is exactly what the DOM widget did wrong.
    // ⛔ AND IT RETURNS, so `S.listGeom` is never published while the field is open: the rail rows the
    //    picker would resolve against are not on the glass, and a picker reading last frame's grid
    //    would drill a sector the pilot cannot see.
    if (S.search.open) { d1Search(g, x, y, w, cols, rowCount); return; }
    // ⭐ AC-4 (restorations) — THE ONE READ OF THE SUB-VIEW, AND EVERY BRANCH BELOW HANGS OFF IT.
    //    `null` at levels 0-3 and in the whole-system picture, so this rail is byte-identical there.
    const detPlanet = S.level === 4 ? sysDetail() : null;
    const hdr = detPlanet ? 'MOONS' : ['SECTORS', 'TILES', 'TILES', 'STARS', 'BODIES'][S.level];
    T(g, hdr, x, y, { color: INK.KEY, rgn: 'rail', what: 'rail header' });
    const cnt = detPlanet ? String(detPlanet.moons.length)
              : [String(D.sectorRows.length), '64', '256', `${D.starRows.filter(s=>s.isReal).length}/${fmtK(D.stars.length)}`,
                 String(D.bodies.length)][S.level];
    T(g, cnt, x + w, y, { color: INK.DIM, align: 'right', rgn: 'rail', what: 'rail count' });
    rect(g, x, y + LEAD - 1, w, 1, INK.RULE);

    // ⭐ AC-3/AC-9 (restorations) — THE DETAIL BLOCK'S HEIGHT IS NOW A NUMBER, NOT A `9` IN A SUM.
    //    `rowCount - 9` was 1 header + 1 pager + a SEVEN-line detail block, and the 9 said so nowhere.
    //    PRISM's block gains five lines — HEIGHT, its region, PLAYER Y, Y RANGE and VIEW — so the
    //    budget has to be named to be spent. ⛔ EVERY OTHER LEVEL KEEPS SEVEN and therefore keeps
    //    `rowCount - 9` exactly: levels 0, 1, 2 and 4 are byte-identical, which is the AC's own bar.
    //    ⚠ THE COST IS FIVE PRISM LIST ROWS, 27 → 22 at Max's 417x240. The rail is full: the seventh
    //      detail line already lands on the last row above the hint rule, so the only place five lines
    //      can come from is the list — and the list is paged (`- = PAGE`) while the numbers are not.
    const detailRows = S.level === 3 ? 12 : 7;
    const listRows = Math.max(2, rowCount - 2 - detailRows);
    // ⭐ PAGING, AND THE SPLIT IT OBEYS. The pager reads `1-27 OF 27524` and there has never been a way
    // to see the 28th. The CONTROL writes `S.listOffset`; THIS is the code that slices by it, and it
    // publishes what it actually sliced as `S.listGeom` so the pager label, the drawn rows and the row
    // picker cannot come apart. Exactly the `S.ladderScroll` / `S.ladderStops` split, one level up.
    // ⛔ AT OFFSET 0 EVERY SLICE BELOW IS `slice(0, listRows)` EXACTLY AS IT ALWAYS WAS, and the label
    //    reads `1-N OF T` exactly as it always did — nothing moves until a key is pressed.
    const total = detPlanet ? 1 + detPlanet.moons.length
                : [D.sectorRows.length, 64, 256, D.starRows.length, D.bodies.length][S.level];
    const off = Math.max(0, Math.min(Math.max(0, total - listRows), S.listOffset | 0));
    S.listOffset = off;   // clamped here too, so a stale offset cannot page off the end of the data
    const detail = [];
    let lines = [];

    if (S.level === 0) {
      // ⚠ THE BAR NORMALISES AGAINST THE WHOLE RANKING, NOT AGAINST ROW 0 — the same fix the tile
      //   branch below already carries, arriving here because `[ ]` gave this list a second order.
      //   `D.sectorRows[0]` is the densest sector only while the list is count-sorted; under NAME the
      //   first row estimated 32M against a true maximum of 6.8B and the worst row asked for 90 bar
      //   squares instead of four, off the right edge of the rail. Identical under the default key.
      const secMax = rankMax(D.sectorRows);
      lines = D.sectorRows.slice(off, off + listRows).map((r, i) =>
        ({ txt: `${pad(String(off + i + 1), 2)} ${pad(r.s.name.toUpperCase(), cols - 16)} ${rpad(fmtK(r.n), 6)}`,
           bar: r.n / secMax, sel: r.s.id === D.playerSector?.id }));
      // ⛔⛔ `D.playerSector` IS NULLABLE, AND DEREFERENCING IT RAW HERE WAS A FREEZE, NOT A BLANK ROW.
      //    `state.js:495` falls back to `getSectorAt(D.player)`, which answers `null` for any player
      //    past `GALAXY_RADIUS * 1.2` — and `D.ready` (`state.js:594`) gates only on `gm && player`, so
      //    a painter runs with it null. `PanelHost` catches a painter throw ONCE and then stops
      //    uploading: the glass keeps showing the last good frame and LOOKS ALIVE, which is the worst
      //    failure mode this surface has. ⚠ AND THE TELL WAS ON THE LINE ABOVE — the row list already
      //    writes `D.playerSector?.id`, and then this line forgot.
      // ⚠ EM-DASHES, NEVER A FABRICATED SECTOR. A placeholder `{ centerX: 0, size: 0 }` would put four
      //   plausible numbers on the glass for a sector that does not exist, which is exactly the
      //   swallowed failure this file is written against. "—" says the instrument does not know.
      const s = D.playerSector;
      detail.push([s ? s.name.toUpperCase() : 'UNKNOWN SECTOR', INK.KEY],
        [`CENTRE  ${s ? `${s.centerX.toFixed(1)}, ${s.centerZ.toFixed(1)}` : '—'}`, INK.BODY],
        [`SYSTEMS ${s ? fmtK(estStars(s.centerX, s.centerZ, s.size)) : '—'}`, INK.BODY],
        [`SPAN    ${s ? `${s.size.toFixed(2)} KPC` : '—'}`, INK.BODY], ['', INK.BODY],
        [`YOU     ${fit(s ? s.name.toUpperCase() : 'UNKNOWN', (cols - 8) * FACE.advance)}`, INK.YOU],
        [`TARGET  ${fit((D.target?.name || '—').toUpperCase(), (cols - 8) * FACE.advance)}`, INK.TARGET]);
    } else if (S.level === 1 || S.level === 2) {
      const v = levelView(S.level);
      // ⚠ THE BAR NORMALISES AGAINST THE WHOLE RANKING, NOT THE PAGE. `ranked[0]` is the densest tile
      //   there is; against `tiles[0]` every page after the first would draw four full bars and say
      //   nothing. Identical on page 1, which is the only page that existed before.
      const ranked = d1TileRows(v, v.n);
      // ⭐ AND THE ROWS ARE ORDERED BY THE ACTIVE KEY BEFORE THEY ARE PAGED, WHICH IS AC-8's SECOND
      //   HALF. `ranked` stays the count ranking because that is what the bar's denominator means;
      //   `ordered` is what the pilot asked to read. Under the default key the two are one array.
      // ⛔ `S.railTiles` IS SLICED OFF `ordered`, NOT OFF `ranked` — the published tiles have to be
      //    the DRAWN tiles or the picker names a different tile from the one the row shows.
      const secMax = rankMax(ranked);
      const ordered = d1TileOrder(ranked);
      const tiles = ordered.slice(off, off + listRows);
      // ⭐ THE RAIL'S OWN ROWS, PUBLISHED. Rows are drawn at SECTOR and REGION today and clicking them
      // does nothing at all, because nothing outside this branch could know which tile row N names.
      // ⛔ It is THIS array — already ranked, already sliced, index-aligned with the drawn rows — and
      //    not a second `d1TileRows(v, v.n)` call, whose ranking would have to agree with this one by
      //    luck. `estStars` is deterministic, so it would agree today and stop agreeing silently.
      S.railTiles = tiles;
      const idW = S.level === 2 ? 3 : 2;
      lines = tiles.map((t) => ({ txt: `${pad(t.id, idW)} ${pad('—', cols - idW - 13)} ${rpad(fmtK(t.n), 6)}`,
                                  bar: t.n / secMax, sel: false }));
      const t = tiles[0];
      detail.push([t.id, INK.KEY], [`CENTRE  ${t.x.toFixed(1)}, ${t.z.toFixed(1)}`, INK.BODY],
        [`SYSTEMS ${fmtK(t.n)}`, INK.BODY], [`SPAN    ${(v.size / v.n).toFixed(3)} KPC`, INK.BODY],
        ['', INK.BODY], [`YOU     ${d1PlayerTile(v)}`, INK.YOU], ['TARGET  —', INK.DIM]);
    } else if (S.level === 3) {
      lines = D.starRows.slice(off, off + listRows).map((s, i) => ({
        txt: `${off + i < 8 && s.dist > 1e-6 ? off + i + 1 : '·'} ${pad(s.name.toUpperCase() || 'UNNAMED', cols - 13)} ` +
             `${rpad(s.pc.toFixed(1), 5)} ${pad(s.spectral, 2)} ${s.mult > 1 ? s.mult : '·'}`,
        bar: 0, sel: s === D.selStar }));
      /*  Function · the camera block — where the eye is, in the units legacy used.
       *  Intent · AC-3 and AC-9 (restorations). Max, UAT 2026-08-01, on this very screen: *"I still
       *    can't use the up/down controls to rise and lower below the galactic plane."* R and F move
       *    `_localCenter.y` and legacy printed the result in three lines; this design printed none, so
       *    the key moved a picture with no number attached to it. The y-gauge (`d1Prism`) draws the
       *    same fact as a MARK; this is the READOUT, and the two come off the same `S.cam.y`.
       *  ⛔ DRAWN WHETHER OR NOT A STAR IS SELECTED, AND FIRST. It is a fact about the level, not
       *    about a selection, so it holds the top of the block at a fixed row the way legacy's
       *    fixed-y HUD block did — and it is the only thing this block says at all when nothing is
       *    selected, which was seven blank rows before.
       *  ⚠ THE REGION TAKES ITS OWN LINE. The rail is `railC * CELL - 1` = 149 texels = 25 characters
       *    at Max's window, and `HEIGHT 0 PC ABOVE · THIN DISK` measures 179 — `fit()` would eat
       *    ` DISK`. Nothing is CUT: the clause is split at the `·` onto a continuation line, which is
       *    the idiom this same block already uses for `DIST … PC` / `      … LY`.
       *  Deliberate non-goals · no kpc, no gauge duplication, no plane-crossing alarm. */
      const pn = prismNumbers();
      detail.push([pn.height, INK.BODY], [`       ${pn.region}`, INK.DIM],
        [pn.playerY, INK.BODY], [pn.yRange, INK.DIM], [pn.view, INK.BODY]);
      const s = D.selStar;
      if (s) detail.push([fit(s.name.toUpperCase(), w), INK.KEY], [`${s.spectral}   ${s.isReal ? 'CATALOG' : 'PROCEDURAL'}`, INK.BODY],
        [`DIST   ${s.pc.toFixed(2)} PC`, INK.BODY], [`       ${s.ly.toFixed(1)} LY`, INK.BODY],
        [`PLANE  ${((s.wy - D.player.y) * 1000).toFixed(0)} PC`, INK.BODY],
        [`COMPS  ${s.mult > 1 ? 'MULTIPLE (' + s.mult + ')' : 'SINGLE'}`, INK.BODY],
        ['WARP ARMED', INK.TARGET]);
    } else if (detPlanet) {
      /*  Function · AC-4 — the rail while a planet is open: the planet, then its moons, and the
       *    detail block showing whichever of them is selected.
       *  Intent · page item 16. Legacy's planet detail prints a header of `<name> · <type> · <R⊕> ·
       *    <AU> · <n> moons` and a `moon.type` label under each moon (NavComputer.js:3495/3364); this
       *    rail is 25 characters wide, so the same facts become a ROW per moon and a block for the one
       *    selected — the split `d1Rail` already makes at every other level.
       *  ⛔ THE ROW CARRIES THE LADDER'S OWN TAG (`Cb`), because AC-20's rule — the picture and the
       *    list must call the same body the same thing — is exactly as load-bearing one level down.
       *  ⛔ AND THE ORBIT IS IN EARTH RADII, NOT AU. Every moon of one planet has the SAME AU (its
       *    parent's, by construction in `buildBodies`), so an AU column here would print one number
       *    four times over; `orbitRadiusEarth` is the number that tells two moons apart and it is the
       *    one legacy's own sub-view scales its picture by.
       *  Deliberate non-goals · no temperature column (a moon row's `T` is the generator's, often
       *    absent, and the type says more per character), no habitability, no pips. */
      // ⛔ THE ROWS THIS BRANCH DRAWS ARE PUBLISHED, because they are NOT a slice of `D.bodies` — they
      //    are the open planet followed by its own moons, in the LADDER's order. `pickFromRow`
      //    (index.js:496) indexes `D.bodies` directly at level 4, so without this every row here
      //    resolves to a different body. Same split as `S.railTiles`: the paint publishes what it
      //    actually drew, index-aligned with the drawn rows, and the picker reads the paint. Cleared
      //    to `null` at the head of both designs, so the whole-system list never offers stale rows.
      const ptag = d1BodyTagger()(detPlanet.parent);
      const rows = [{ b: detPlanet.parent, tag: ptag, orbit: '—', type: String(detPlanet.parent.cls || '').toUpperCase() },
        ...detPlanet.moons.map((m) => ({ b: m.row, tag: moonTag(ptag, m.mIdx),
                                         orbit: String(Math.round(m.orbitR)), type: m.type }))];
      S.railBodies = rows.slice(off, off + listRows).map((r) => r.b);
      lines = rows.slice(off, off + listRows).map((r) => ({
        txt: `${pad(r.tag, 3)}${pad(String(r.b.name || '—').toUpperCase(), cols - 14)} ` +
             `${rpad(r.orbit, 4)} ${pad(r.type, 5)}`,
        bar: 0, sel: r.b === D.selBody }));
      const sm = selMoonOf(detPlanet);
      if (sm) detail.push([fit(String(sm.row.name || '—').toUpperCase(), w), INK.KEY],
        [fit(sm.type, w), INK.BODY],
        [`RADIUS ${sm.rE ? sm.rE.toFixed(2) + ' EARTH' : '—'}`, INK.BODY],
        [`ORBIT  ${Math.round(sm.orbitR)} R⊕`, INK.BODY],
        [fit(`MOON OF ${String(detPlanet.parent.name || '—').toUpperCase()}`, w), INK.DIM]);
      else detail.push([fit(String(detPlanet.parent.name || '—').toUpperCase(), w), INK.KEY],
        [String(detPlanet.parent.cls || '').toUpperCase(), INK.BODY],
        [`RADIUS ${detPlanet.parent.rE ? detPlanet.parent.rE.toFixed(2) + ' EARTH' : '—'}`, INK.BODY],
        [`ORBIT  ${(detPlanet.parent.au ?? 0).toFixed(2)} AU`, INK.BODY],
        [`MOONS  ${detPlanet.moons.length}`, INK.BODY],
        ['SELECT A MOON', INK.DIM]);
    } else {
      // ⭐ AC-20 — THE TAG COMES OFF THE LADDER'S ORDERING, NOT OFF THIS ROW'S POSITION. `off + i` is
      // where the body sits in a list the pilot can re-sort and page; the letter has to name where it
      // sits in the PICTURE, or the two halves of this screen call the same planet two things. See
      // `d1BodyTagger`. ⚠ A moon prints its parent's letter and keeps its `-`.
      const tagOf = d1BodyTagger();
      lines = D.bodies.slice(off, off + listRows).map((b) => ({
        txt: `${tagOf(b)}${b.kind === 'moon' ? '-' : ' '}` +
             `${pad((b.kind === 'moon' ? ' ' : '') + b.name.toUpperCase(), cols - 14)} ` +
             `${rpad(b.au.toFixed(2), 5)} ${rpad(b.T ? Math.round(b.T) + 'K' : '—', 5)}`,
        bar: 0, sel: b === D.selBody }));
      const b = D.selBody;
      // ⭐⭐ AC-2 — THE TWO STATES THIS BLOCK COULD NOT DRAW, AND WHY SILENCE WAS THE WRONG ANSWER.
      //    `if (b)` was already here, so a null selection drew NOTHING — seven blank rows under the
      //    pager, which on a 240p glass reads as "the instrument is still thinking", not as "nothing is
      //    selected". `state.js` never produced that state (it resolved to a fallback planet), so the
      //    branch was untested; now that null is reachable the block has to SAY the thing.
      // ⛔ ONE LINE, NOT SEVEN EM-DASHES. A `RADIUS —  ORBIT —  TEMP —` skeleton would be the readout
      //    of a body that does not exist, which is the failure `d1Rail`'s sector branch already names.
      // ⭐ AND A STAR GETS ITS OWN THREE ROWS. Fed through the planet form it would print `ORBIT 0.00
      //   AU` and `MOONS 0` — four plausible numbers about the thing every orbit is measured FROM.
      /*  Function · with nothing selected this block prints the STAR's line instead of saying nothing
       *    is selected. Intent · AC-8 (restorations), page item 20 — *"the star has no line of text."*
       *  ⛔ TWO ROWS, NOT ONE, AND THE SPLIT IS MEASURED. The rail is `railC * CELL - 1` = 149 texels =
       *    25 characters at Max's window; `G2 · 8 PLANETS · 4.6 GYR` is 24 and fits, but a binary's
       *    `G2+M4 BINARY · 8 PLANETS · 4.6 GYR` is 34 and `fit()` would eat ` GYR`. Nothing is cut: the
       *    class takes the KEY row this block gives every title and the two numbers take the next, which
       *    is the same continuation idiom the camera block above uses for `HEIGHT` / its region.
       *  ⚠ AND THE OLD STRING SURVIVES FOR THE ONE STATE THAT HAS NO STAR EITHER. `sysStarClauses()`
       *    answers `[]` when `D.sys` is null, and AC-2 of the defects batch is that this block SAYS the
       *    no-selection state rather than drawing seven blank rows. */
      if (!b) {
        const sc = sysStarClauses();
        if (sc.length) detail.push([fit(sc[0], w), INK.KEY], [fit(sc.slice(1).join(' · '), w), INK.BODY]);
        else detail.push(['NO BODY SELECTED', INK.DIM]);
      }
      else if (b.kind === 'star') detail.push([fit((b.name || '—').toUpperCase(), w), INK.KEY],
        [(b.cls || '').toUpperCase(), INK.BODY], ['PRIMARY', INK.DIM]);
      else if (b) detail.push([fit(b.name.toUpperCase(), w), INK.KEY], [b.cls.toUpperCase(), INK.BODY],
        [`RADIUS ${b.rE ? b.rE.toFixed(2) + ' EARTH' : '—'}`, INK.BODY],
        [`ORBIT  ${b.au.toFixed(2)} AU`, INK.BODY],
        [`TEMP   ${b.T ? Math.round(b.T) + ' K' : '—'}`, INK.BODY],
        [`HAB    ${b.hab != null ? b.hab.toFixed(2) : '—'}`, b.hab > 0.5 ? INK.YOU : INK.BODY],
        [`MOONS  ${b.moons}${b.rings ? '   RINGED' : ''}`, INK.BODY]);
    }

    lines.forEach((L, i) => {
      const yy = y + (i + 1) * LEAD;
      if (L.sel) rect(g, x - 1, yy - 1, w + 2, LEAD, INK.RULE);
      T(g, fit(L.txt, w), x, yy, { color: L.sel ? INK.KEY : INK.BODY, rgn: 'rail', what: 'rail row ' + i });
      if (L.bar > 0) for (let k = 0; k < Math.round(4 * L.bar); k++) rect(g, x + w - 23 + k * 6, yy + 1, 4, 4, INK.BODY);   // c67-c70
    });
    const pagerY = y + (lines.length + 1) * LEAD;
    // ⛔ THE PAGER CANNOT ALSO BE SPELLED `[ ]`. The hint row two lines up has already given the
    //    brackets to SORT, and two different controls sharing one name on one screen is a lie
    //    whichever of them the key turns out to drive. SORT keeps `[` `]` because its hint is the one
    //    repeated at every level; PAGE names `-` and `=`. Same eight characters, so nothing reflows.
    // ⚠ AND THE RANGE GROWS AS YOU PAGE, WHICH EATS THE KEYS OFF THE RIGHT-HAND END. `fit()` truncates
    //   from the right, so `1000-1026 OF 27524   - = PAGE` loses `- = PAGE` — the control's own name
    //   disappears at exactly the moment you are using it. The compact form is only ever reached WHEN
    //   PAGED, so the offset-0 row stays byte-identical to the one Max ruled on, at every buffer.
    let pagerTxt = `  ${off + 1}-${off + lines.length} OF ${total}   - = PAGE`;
    if (off > 0 && measurePixelText(pagerTxt) > w) pagerTxt = `  ${off + 1}-${off + lines.length}/${fmtK(total)}  - = PAGE`;
    T(g, fit(pagerTxt, w), x, pagerY, { color: INK.DIM, rgn: 'rail', what: 'pager' });
    // ⭐ AC-2 — THE PAGER ROW READS `- = PAGE` AND HAS NEVER ANSWERED A CLICK. Two halves, out of the
    // three values the row was laid out with: `x` and `w` are the rail's own, `pagerY` is
    // `y + (lines.length + 1) * LEAD` — the number of rows this frame actually DREW, so the band moves
    // down with a shorter list instead of being pinned to where a full page would have put it.
    // ⛔ `mid` IS PUBLISHED, NOT LEFT TO THE PICKER. A consumer computing `x + w / 2` would be a second
    //    copy of this row's geometry, and the half it computed would silently stop matching the row the
    //    moment the rail's width changed — the AC-4 defect shape at its smallest.
    // ⚠ AND IT IS ABSENT WHILE THE DRAWN SEARCH IS OPEN, because `d1Rail` returns into `d1Search`
    //   above and this line never runs: the pager is not on the glass, so it is not on offer.
    S.pagerRect = { x0: x, mid: x + w / 2, x1: x + w, y: pagerY, h: FACE.h };
    rect(g, x, pagerY + LEAD - 1, w, 1, INK.RULE);
    detail.forEach(([t, ink], i) => {
      if (!t) return;
      T(g, fit(t, w), x, pagerY + (i + 1) * LEAD, { color: ink, rgn: 'rail', what: 'detail ' + i });
    });
    // ⭐ THE RAIL'S ROW GRID AND THE WINDOW IT IS SHOWING. `rows` is what was DRAWN and `offset` is
    // what was SLICED, so a picker adding `offset` to a drawn row index lands on the row under the
    // pointer at any page. Row i is drawn at `top + (i + 1) * lead`, the header sits on `top`.
    S.listGeom = { top: y, lead: LEAD, rows: lines.length, x0: x - 1, x1: x + w + 1, offset: off, total };
  }
  /**
   * ⭐⭐ THE DRAWN SEARCH, DESIGN 1 — AC-11, AND IT IS DRAWN IN THIS DESIGN'S OWN INK AND FACE.
   *
   * Both hint rows have said `/ SEARCH` since the first frame Max ruled on, and behind that promise
   * was a 320px DOM `<input>` at `top:12px left:12px` that had to be hidden under a view mode
   * (`style.css:1289`) because at 240p it lay across exactly the rows these designs put their chrome
   * in — measured on the live overlay, it covered "GALAXY SECTOR". So the affordance advertised
   * nothing at all. This is the field, on the canvas, at the buffer's own resolution.
   *
   * ── ⭐ WHAT IS DRAWN HERE AND WHAT IS NOT ───────────────────────────────────────────────────────
   *
   * NOTHING here resolves a name. `S.search` arrives with four fields — `open`, `text`, `highlight`
   * and `rows` — and this function turns them into rail. In the game the driver types into
   * NavComputer's OWN `_runSearch`, which calls `resolveKnownObjects` over the catalog, the
   * KnownSystems registry, the named-systems box and the structures, and mirrors `_searchResults` /
   * `_searchHighlight` back onto `S.search`; on this page `labSearch()` does a name filter over the
   * prism instead. Neither is visible from in here, which is the point: the PRESENTATION was the only
   * DOM-bound half of that pipeline and it is the only half this replaces.
   *
   * ── THE ROWS ARE THIS RAIL'S OWN ROWS ──────────────────────────────────────────────────────────
   *
   * Same `LEAD`, same left edge, same `INK.RULE` plate under the highlighted row and `INK.KEY` on its
   * text as `d1Rail` draws for a selected sector or star — because a second visual language for "the
   * row you are on" is how a design comes apart. The query line carries the same plate, permanently:
   * it is always the row you are on.
   * ⛔ AND THE RESULT ROWS ARE PUBLISHED AS `S.searchGeom`, so a MOUSE can pick one. The DOM widget
   *    bound `mousedown` on each row deliberately — selection had to fire before the input's blur —
   *    and dropping that would be a regression from a widget this replaces.
   */
  function d1Search(g, x, y, w, cols, rowCount) {
    const LEAD = FACE.h + 1;
    const rows = S.search.rows || [];
    T(g, 'SEARCH', x, y, { color: INK.KEY, rgn: 'rail', what: 'search header' });
    T(g, String(rows.length), x + w, y, { color: INK.DIM, align: 'right', rgn: 'rail', what: 'search count' });
    rect(g, x, y + LEAD - 1, w, 1, INK.RULE);

    // ── THE QUERY LINE. `_` is the caret: this face has no cursor and a blinking one at 240p is a
    //    texel of noise, so the field ends in the character a teletype would have left there.
    const qy = y + LEAD;
    rect(g, x - 1, qy, w + 2, FACE.h, INK.RULE);
    T(g, fit('>' + String(S.search.text || '').toUpperCase() + '_', w - 2), x, qy,
      { color: INK.KEY, rgn: 'rail', what: 'search query' });

    // ── THE RESULTS. ⛔ THE WINDOW FOLLOWS THE HIGHLIGHT rather than the other way round: the cursor
    //    wraps (`_moveSearchHighlight` is modular), so an offset that only ever grew would leave the
    //    pilot pressing UP at row 0 and watching the selection vanish off the top of a static page.
    const listRows = Math.max(1, rowCount - 2);
    const hi = Number.isFinite(S.search.highlight) ? S.search.highlight : -1;
    const off = Math.min(Math.max(0, rows.length - listRows), Math.max(0, hi - listRows + 1));
    const shown = rows.slice(off, off + listRows);
    shown.forEach((r, i) => {
      const yy = qy + (i + 1) * LEAD;
      const sel = off + i === hi;
      if (sel) rect(g, x - 1, yy - 1, w + 2, LEAD, INK.RULE);
      const kind = fit(String(r.kind || '').toUpperCase(), 8 * FACE.advance);
      const kw = measurePixelText(kind);
      const nameW = T(g, fit(String(r.name || '').toUpperCase(), w - kw - FACE.advance), x, yy,
                      { color: sel ? INK.KEY : INK.BODY, rgn: 'rail', what: 'search row ' + i });
      T(g, kind, x + w, yy, { color: sel ? INK.BODY : INK.DIM, align: 'right', rgn: 'rail', what: 'search kind ' + i });
      assertClear('search row ' + i + ' name vs kind', 'rail', x + nameW + 2, x + w - kw);
    });
    if (!shown.length) {
      T(g, S.search.text ? 'NO MATCHES' : 'TYPE A NAME', x, qy + LEAD,
        { color: INK.DIM, rgn: 'rail', what: 'search empty' });
    }
    // ⭐ THE ROW GRID, OUT OF THE CODE THAT DREW IT — row i sits at `top + (i + 1) * lead`, which is
    // the same arithmetic `S.listGeom` publishes, so one picker shape reads both.
    S.searchGeom = { design: 1, top: qy, lead: LEAD, rows: shown.length,
                     x0: x - 1, x1: x + w + 1, offset: off, total: rows.length };
  }

  function d1PlayerTile(v) {
    const i = Math.floor(((D.player.x - v.cx) / v.size + 0.5) * v.n);
    const j = Math.floor(((D.player.z - v.cz) / v.size + 0.5) * v.n);
    return (AZ[Math.max(0, Math.min(v.n - 1, i))] || '?') + (Math.max(0, Math.min(v.n - 1, j)) + 1);
  }
  /*  Function · the four camera numbers legacy printed at PRISM and neither design did, spelled once.
   *  Intent · AC-3 and AC-9 (restorations), page items 15 and 21. Legacy's own block
   *    (NavComputer.js:4272-4296): `VIEW: <n> ly` = round(_localRadius * 1000 * 3.26); `HEIGHT: <n> pc
   *    above|below plane (<region>)` off `_localCenter.y` with thin disk < 0.3 kpc / thick disk < 1.0 /
   *    halo; `PLAYER Y: <n> pc`; `Y RANGE: <a> to <b> pc` at _playerY +/- 2.0 kpc. Max ruled the numbers
   *    go into design 1's detail block and design 2's status line, and that all three looks print ONE
   *    zoom readout in ONE unit — the old nav's radius in light-years.
   *  ⛔ ONE COPY FOR TWO DESIGNS, BECAUSE THE WHOLE OF ITEM 21 IS THAT THE THREE LOOKS AGREE. Two
   *    spellings of `round(radius * 3260)` is two numbers that can drift apart by a rounding mode, and
   *    the defect being closed is literally that design 2 said `10.0 PC ACROSS` where legacy said
   *    `16 ly` about the same camera.
   *  ⚠ EVERY INPUT IS GUARDED. `S.cam` and `D.player` both have defaults in `state.js`, but `D.player`
   *    is `null` until the first `refresh()` (`state.js:466`) and a painter that throws freezes the
   *    glass on the last good frame — so a missing number reads 0 rather than taking the screen down.
   *  Deliberate non-goals · no kpc form beside the pc one (legacy prints both; the rail is 25
   *    characters wide), no plane-crossing warning, no per-level variant — this is PRISM's block. */
  function prismNumbers() {
    const camY = (S.cam && Number.isFinite(S.cam.y)) ? S.cam.y : 0;
    const rad  = (S.cam && Number.isFinite(S.cam.radius)) ? S.cam.radius : 0;
    const pY   = (D.player && Number.isFinite(D.player.y)) ? D.player.y : 0;
    const a = Math.abs(camY);
    return {
      height:  `HEIGHT ${Math.round(camY * 1000)} PC ${camY >= 0 ? 'ABOVE' : 'BELOW'}`,
      region:  a < 0.3 ? 'THIN DISK' : a < 1.0 ? 'THICK DISK' : 'HALO',
      playerY: `PLAYER Y ${Math.round(pY * 1000)} PC`,
      yRange:  `Y RANGE ${Math.round((pY - 2.0) * 1000)} TO ${Math.round((pY + 2.0) * 1000)} PC`,
      view:    `VIEW ${Math.round(rad * 3260)} LY`,
    };
  }
  /*  Function · THE PRISM Y-GAUGE, for whichever design asks for one: a 6-texel vertical strip at
   *    `(gx, gy, 6, gh)` carrying the player's plane, the selected star's height and the camera's —
   *    drawn, and published as `S.yGaugeRect` so the drag can invert exactly the arithmetic that drew
   *    it (`index.js` `gaugeGrab` / `gaugeDragTo`, which read the four derived fields below).
   *  Intent · AC-10 (restorations), page item 23: *"Grabbable handles in design 2 to match design 1."*
   *    Max, 2026-09-07: *"The indicators on the prism and system screens should be grabbable."* Design
   *    1 had this gauge since the close pass; design 2's PRISM corner carried a 24-texel scale column
   *    with a fixed mark on it — a picture of a control, with nothing behind it.
   *  ⛔ ONE FUNCTION, TWO CALLERS, BECAUSE THE SEAM SAYS "EXACTLY THE SHAPE DESIGN 1 PUBLISHES". The
   *    host's `_handleMouseDown:4402` already arms the gauge for ANY design and the driver already
   *    inverts whatever rect is published, so design 2 only has to draw one — and a SECOND spelling of
   *    `cy`/`span`/`halfKpc`/`base` is two mappings free to drift, where the drift is a mark that does
   *    not land under the pointer. Lifting it out of `d1Prism` moves no texel: `gy + gh/2` and `gh/2`
   *    are `mapY + mapH/2` and `mapH/2` at design 1's call site, the five draws are in the same order
   *    with the same inks, and the published object has the same eight fields.
   *  ⚠ THE STRIP'S OWN SCALE IS THE DRAG'S RANGE (design 1's note, unchanged): ±2 pc is what the gauge
   *    DISPLAYS, so it is what a grab traverses. R and F still go further and the mark pegs.
   *  ⛔ AND THE CAMERA MARK IS DRAWN ONLY ONCE THE CAMERA HAS LEFT THE PLAYER'S PLANE — at entry
   *    `_localCenter` IS the player, so the default picture gains no mark in either design.
   *  Deliberate non-goals · no numbers on the strip (design 1's rail block and design 2's status line
   *    both print HEIGHT — AC-3), no thumb, no ticks, and no second gauge at any other level. */
  function yGauge(g, gx, gy, gh) {
    const GAUGE_HALF_KPC = 0.002, gaugeCy = gy + gh / 2, gaugeSpan = gh / 2;
    const gaugeTexel = (kpc) => gaugeCy - Math.max(-gaugeSpan + 2, Math.min(gaugeSpan - 2,
                                  ((kpc - D.player.y) / GAUGE_HALF_KPC) * gaugeSpan));
    rect(g, gx + 3, gy + 2, 1, gh - 4, INK.RULE);
    rect(g, gx + 1, gaugeCy, 3, 1, INK.YOU);
    if (D.selStar) rect(g, gx, gaugeTexel(D.selStar.wy), 5, 1, INK.TARGET);
    const camY = (S.cam && Number.isFinite(S.cam.y)) ? S.cam.y : D.player.y;
    if (Math.abs(camY - D.player.y) > 1e-9) rect(g, gx + 1, gaugeTexel(camY), 4, 1, INK.KEY);
    S.yGaugeRect = { x: gx, y: gy, w: 6, h: gh,
                     cy: gaugeCy, span: gaugeSpan, halfKpc: GAUGE_HALF_KPC, base: D.player.y };
  }

  /* ────────────────────────────────────────────────────────────────────────────────────────────────
   * AC-7, AC-8 AND AC-1 (restorations) — THE THREE THINGS BOTH SYSTEM PICTURES HAVE TO SAY, SPELLED
   * ONCE.  Design 1's ladder and design 2's orrery draw the same bodies out of the same `D.bodies`;
   * two spellings of "what is this belt called" or "what does the star's line read" is two answers
   * that drift, which is the defect `prismNumbers()` above was written against for the camera numbers.
   * ──────────────────────────────────────────────────────────────────────────────────────────────── */

  /*  Function · ASTEROID BELT or KUIPER BELT for a `D.bodies` belt row.
   *  Intent · AC-8 (restorations), page item 20: *"Belts are anonymous dots."* Legacy names every belt
   *    at 45° mid-radius off the generator's own flag (NavComputer.js:2644,
   *    `belt.isKuiper ? 'KUIPER BELT' : 'ASTEROID BELT'`), and that flag is set in exactly two places —
   *    `StarSystemGenerator.js:769` for the outer belt and `SolarSystemData.js:875` for Sol's.
   *  ⛔ THE FLAG IS READ FIRST AND THE FALLBACK IS GEOMETRY, NOT A GUESS AT THE NAME. Neither body-list
   *    builder copies `isKuiper` across today — this page's `buildSystem` now does, the game's
   *    `state.js:645` does not (reported to the coordinator; one field on one row closes it). Until it
   *    does, a belt beyond EVERY planet is the outer belt by the generator's own construction
   *    (`shouldOuterBeltExist` places it past the last planet, `StarSystemGenerator.js:759`), so the
   *    fallback answers the same question from the same data rather than defaulting to one label and
   *    silently mis-naming Sol's Kuiper belt.
   *  ⚠ `isKuiper` IS EITHER `true` OR ABSENT upstream, never `false`, so an absent flag cannot be told
   *    from a negative one — hence `!= null` rather than a truth test: once the driver publishes
   *    `isKuiper: !!b.isKuiper` the explicit `false` wins over the geometry, which is what we want.
   *  Deliberate non-goals · no trojan/shepherd belts (the flat list carries none), no per-belt ordinal
   *    (`BELT A` is the row's internal name and is not drawn anywhere). */
  function beltLabel(b) {
    if (b && b.isKuiper != null) return b.isKuiper ? 'KUIPER BELT' : 'ASTEROID BELT';
    let maxAu = 0;
    for (const r of D.bodies) if (r && r.kind === 'planet' && (Number(r.au) || 0) > maxAu) maxAu = Number(r.au) || 0;
    return (maxAu > 0 && (Number(b && b.au) || 0) > maxAu) ? 'KUIPER BELT' : 'ASTEROID BELT';
  }

  /*  Function · the star's fact line as CLAUSES — `['G2', '8 PLANETS', '4.6 GYR']`, or
   *    `['G2+M4 BINARY', …]` — for the two places AC-8 puts it. Empty when there is no system.
   *  Intent · AC-8 (restorations), page item 20: *"the star has no line of text."* Legacy prints it in
   *    the SYSTEM header (NavComputer.js:966-969) and both designs print an empty-selection string
   *    where it should be. ⛔ CLAUSES, NOT A JOINED STRING, because the two consumers have different
   *    room: design 2's bar already joins with ` · ` (so it gets legacy's exact sentence for free) and
   *    design 1's rail is 25 characters, where `G2+M4 BINARY · 8 PLANETS · 4.6 GYR` is 34 — see the
   *    split in `d1Rail`'s SYSTEM branch.
   *  ⚠ THE PLANET COUNT IS `D.bodies`', NOT `sys.planets`'. `buildBodies` drops a planet with no
   *    `planetData` (state.js:583), so the two can differ — and the number on the glass has to be the
   *    number of things the glass DREW, or the line contradicts the picture beside it.
   *  Deliberate non-goals · the wide-binary member list (item 20's third clause) is PARKED; no
   *    metallicity, no luminosity class, no separation. */
  function sysStarClauses() {
    const sys = D.sys;
    if (!sys) return [];
    const c1 = String((sys.star && sys.star.type) || '?').toUpperCase();
    const c2 = sys.star2 ? String(sys.star2.type || '?').toUpperCase() : '';
    const cls = (sys.isBinary && c2) ? `${c1}+${c2} BINARY` : c1;
    const n = D.bodies.filter((b) => b && b.kind === 'planet').length;
    return [cls, `${n} PLANET${n === 1 ? '' : 'S'}`, `${(Number(sys.ageGyr) || 0).toFixed(1)} GYR`];
  }

  /*  Function · the words that go beside one SYSTEM body's mark — its NAME, or, for a belt, its kind.
   *  Intent · AC-7 and AC-8 (restorations), page items 19 and 20: *"The name is one click away in a
   *    list, not on the thing."* The rail's spelling, upper-cased, so the two halves of design 1's
   *    SYSTEM screen call the same planet the same thing. */
  function bodyLabelText(b) {
    if (!b) return '';
    return (b.kind === 'belt') ? beltLabel(b) : String(b.name || '').toUpperCase();
  }
  /** ⛔ NO CHARACTER CAP ON A BODY NAME, AND THE FIRST DRAFT HAD ONE — 15 characters, which MEASURED
   *  WORSE THAN NO CAP AT ALL. Procedural names are `<system> b`, `<system> c`, `<system> d`
   *  (`state.js:583`), so the one character that tells four planets apart is the LAST one, and `fit()`
   *  truncates from the right: the ladder read `WANVEB-4OQSLX96` four times over. A label either fits
   *  the pane and is placed, or it is refused a slot and the body keeps its tag — which is AC-7's own
   *  rule and needs no second rule beside it. The cap that remains is the PANE's.
   *  ⚠ The cost is measured and stated in the test header: fewer names placed on a system with long
   *    names, and the full spelling is in design 1's rail row either way. */

  /*  Function · the order names are OFFERED slots in: selected first, then the body the ship is at,
   *    then by AU outward. Returns a re-ordered copy of the queue; ties keep queue order.
   *  Intent · AC-7's own rule (*"selected > current > by AU"*). `placeLabel` is first-come-first-served
   *    against the slots already taken, so the ORDER of the queue IS the priority — which is why this
   *    is a sort and not a scoring pass inside the placer.
   *  ⚠ `D.ship` IS WAVE 2's FIELD AND IT IS ALREADY PUBLISHED (state.js:484/945, `null` unless the
   *    pilot is in this system). Reading it here costs nothing and means the priority does not have to
   *    change when wave 2 draws the diamond. This page never sets it, so on the lab the rank collapses
   *    to selected-then-AU, which is the lab's honest state: it has no ship. */
  function bodyLabelOrder(queue) {
    const rank = (b) => {
      if (b && b === D.selBody) return 0;
      if (b && D.ship && b.kind !== 'moon' && Number.isFinite(b.pIdx) && b.pIdx === D.ship.planetIndex) return 1;
      // ⭐ A BELT OUTRANKS A PLANET, AND AC-8 IS WHY — MEASURED. On an eight-planet system with two
      //    belts, AU order alone put the main belt seventh in the queue and it was refused every slot:
      //    the picture kept ASTEROID BELT off the glass while naming four planets whose names are ALSO
      //    printed in the rail beside them. A belt has no rail row and no sprite — it is the *"anonymous
      //    dot"* item 20 names — so its label is the only thing that identifies it at all, which buys
      //    more per slot than a fifth planet name does.
      if (b && b.kind === 'belt') return 2;
      return 3;
    };
    return queue.map((q, i) => ({ q, i })).sort((p, r) =>
      rank(p.q.b) - rank(r.q.b) || ((Number(p.q.b && p.q.b.au) || 0) - (Number(r.q.b && r.q.b.au) || 0)) || p.i - r.i
    ).map((p) => p.q);
  }

  /*  Function · AC-6 — design 2's SYSTEM zoom gauge: a vertical track at the pane's right edge with a
   *    mark at the current magnification and an `X<n.n>` readout above it, published at its draw site
   *    as `S.zoomGaugeRect` so `zoomGrab` / `zoomDragTo` can invert what was drawn.
   *  Intent · page item 18 plus the close pass's AC-9 principle, which Max's 2026-09-07 ruling states
   *    generally: *"The indicators on the prism and system screens should be grabbable."* An
   *    indicator that shows a position along a range is a handle, so drawing the wheel's value and
   *    making it draggable are one job.
   *  ⛔ LOGARITHMIC, BECAUSE THE WHEEL IS. `_handleWheel` MULTIPLIES by 1.15 and 0.87, so a notch is a
   *    constant distance in log space; on a linear track the whole of 0.3..1.0 — half the notches —
   *    would be the bottom seventh of the strip. `t = (ln z − ln 0.3) / (ln 5 − ln 0.3)`, the seam's
   *    own mapping, off the host's own two clamps.
   *  ⛔ `t = 0` AT THE BOTTOM AND `t = 1` AT THE TOP: up is more magnification, which is the direction
   *    every other vertical instrument on this glass reads in.
   *  ⛔ AND IT IS INSIDE THE MAP PANE, WHICH IS NOT DECORATION. `NavComputer._handleMouseDown` returns
   *    at `:4401` unless the press is on the map, so a gauge drawn in the bottom bar could be armed by
   *    nothing; the six texels it stands on stop answering a body click and become a control, which is
   *    the same trade design 1's y-gauge made (the plate rule, INTERFACE §6).
   *  ⚠ THE MARK IS CLAMPED TO THE TRACK'S LAST ROW AT EITHER END, so at `zoom = 0.3` it is on `y+h-1`
   *    rather than on `y+h`, one texel outside the rect. The driver's inverse therefore reads back
   *    `t = 1/h` instead of 0 — a 0.007x difference in zoom at the very bottom of a range the host
   *    clamps anyway, against a mark that would otherwise sit off its own track.
   *  ⚠ `X`, NOT `×`: the shipped face has no multiplication sign (checked against `hasGlyph`, the same
   *    test that turned legacy's `R☉` into `R SUN` in the callout).
   *  Deliberate non-goals · no numbers at the ends of the track (the readout is the number), no notch
   *    ticks, no gauge in design 1 (Max's ruling) and none at any other level. */
  const SYS_ZOOM_MIN = 0.3, SYS_ZOOM_MAX = 5.0;   // NavComputer._handleWheel:4707-4708's own clamp
  function zoomGauge(g, W, mapY, mapH, zoom) {
    const gx = W - 10, gy = mapY + 10, gh = mapH - 24;
    if (gh < 8) { S.zoomGaugeRect = null; return; }
    const lo = Math.log(SYS_ZOOM_MIN), hi = Math.log(SYS_ZOOM_MAX);
    const z = (Number.isFinite(zoom) && zoom > 0) ? zoom : 1;
    const t = Math.max(0, Math.min(1, (Math.log(z) - lo) / (hi - lo)));
    rect(g, gx + 3, gy, 1, gh, INK.RULE);                       // the track
    rect(g, gx + 1, gy, 3, 1, INK.RULE);                        // its two ends, so the range is visible
    rect(g, gx + 1, gy + gh - 1, 3, 1, INK.RULE);
    rect(g, gx, Math.round(gy + (1 - t) * (gh - 1)), 6, 1, INK.KEY);
    S.zoomGaugeRect = { x: gx, y: gy, w: 6, h: gh };
    const txt = fit(`X${z.toFixed(1)}`, 40);
    plated(g, txt, gx + 5 - measurePixelText(txt), mapY + 2, INK.DIM, 'map', 'zoom readout');
  }

  /* ────────────────────────────────────────────────────────────────────────────────────────────────
   * ⭐⭐ AC-5 (restorations) — THE SHIP, AND THE LINE FROM IT TO WHERE A BURN WOULD GO.
   *
   * Page item 17, Max's ruling *"yes"*, and the audit's sentence: *"You cannot see where you are in
   * the system or where a burn would take you."* Legacy draws all of it (NavComputer.js:2905-3005):
   * a diamond at the focused body's projected point, the word SHIP under it, and a dashed line to the
   * hovered-or-selected body ending in an arrowhead — the whole block gated on `_isCurrentSystem()`.
   * Design 2 drew a diamond at a FIXED screen offset (`cxp + 8`, whose own comment called it *"the ONE
   * mark on this orrery that visibly refuses to move"*) and design 1 drew nothing at all.
   *
   * ⛔⛔ THE POSITION COMES OUT OF `hits`, WHICH IS THE PAINT'S OWN PUBLICATION, AND THAT IS THE WHOLE
   *    DESIGN OF THIS FUNCTION. The two pictures place a body by completely different arithmetic — the
   *    orrery by `rOf`, `TILT`, the real orbit angle, the azimuth and two roundings; the ladder by
   *    `sqrt(AU)`, an unbounded minimum-separation pass and a scroll offset — and NOTHING outside
   *    either painter can reconstruct where a planet actually landed. So this asks the array the
   *    painter just filled, and the diamond's texel EQUALS the focused body's drawn texel by
   *    construction rather than by two pieces of arithmetic agreeing. That is also why it is one
   *    function for both designs: what differs between them is the geometry, and the geometry is the
   *    part this never touches.
   * ⛔ `D.ship` IS `null` IN A FOREIGN SYSTEM (`state.js:945`, gated on `D.isCurrent`, the host's 0.1 pc
   *    identity test) and NOTHING here draws — the diamond, the word and the line all hang off the one
   *    early return, exactly as legacy hangs its whole block off `isCurrent`.
   * ⚠ `planetIndex` IS AN INDEX INTO `_systemData.planets`, NOT INTO `D.bodies`, and `pIdx` is the
   *   correspondence the adapter rides on the rows (`state.js:618-622`). A row lookup by position in
   *   `D.bodies` would be wrong the moment `[`/`]` re-sorts the list.
   * ⚠ A MOON RESOLVES TO ITS PIP, which is each design's own answer to *"the moon band"*: design 2's
   *   pip strip beside the planet, design 1's pips climbing off the stop. Legacy offsets onto a drawn
   *   moon ring; neither design draws one at this level (the moon sub-view is AC-4, wave 2b), so the
   *   pip IS the moon on these two pictures. With no pip for that index the ship falls back to the
   *   planet, which is where a pilot at one of its moons is to within a texel on a ladder anyway.
   */
  function shipHit(hits) {
    const sh = D.ship;
    if (!sh || !Array.isArray(hits) || !hits.length) return null;
    const pi = Number.isFinite(sh.planetIndex) ? sh.planetIndex : -1;
    if (pi < 0) return hits.find((z) => z.star) || null;            // -2 / -1: at the primary
    const mine = (z) => z.ref && z.ref.kind === 'planet' && z.ref.pIdx === pi;
    const mi = Number.isFinite(sh.moonIndex) ? sh.moonIndex : -1;
    if (mi >= 0) { const pip = hits.find((z) => mine(z) && z.moon === mi); if (pip) return pip; }
    return hits.find((z) => mine(z) && !(z.moon >= 0)) || null;
  }
  /** ⭐ THE TARGET IS THE HOVERED BODY IF THE POINTER IS ON ONE, ELSE THE SELECTION — legacy's own
   *  `this._hoveredBody || this._selectedBody` (`:2960`), read off `S.hover` because that is the
   *  published form of the same pick (SEAM §1). ⛔ BRANCHED ON `hv.kind` AND `ref.type`, NEVER ON THE
   *  SHAPE OF `ref` — the callout's rule, for the same reason. ⚠ ONLY A PLANET OR THE PRIMARY GETS A
   *  LINE, which is legacy's own set: its `destP` stays null for a `'moon'` target and no line draws.
   *  A belt likewise gets none — it is a ring, not a place to burn to. */
  function trajectoryHit(hits) {
    const hv = S.hover;
    let want = null;
    if (hv && hv.kind === 'body' && hv.ref && (hv.ref.type === 'planet' || hv.ref.type === 'star')) {
      want = hv.ref.type === 'star' ? 'STAR' : (hv.ref.row || null);
    } else if (D.selBody) {
      want = D.selBody.kind === 'star' ? 'STAR' : (D.selBody.kind === 'planet' ? D.selBody : null);
    }
    if (!want) return null;
    if (want === 'STAR') return hits.find((z) => z.star) || null;
    return hits.find((z) => z.ref === want && !(z.moon >= 0)) || null;
  }
  /**
   * @param {Array} hits   the SYSTEM picture's finished mark list — `S.bodyHits`, before it is published
   * @param {Array} taken  the labels this frame has already placed, so `SHIP` yields to a body's name
   *
   * ⛔ THE LINE STOPS SHORT OF BOTH MARKS, AND LEGACY'S DOES NOT — a stated departure, measured. Legacy
   *    strokes ship-centre to body-centre at `globalAlpha = 0.6` over a 1560-wide vector canvas, so the
   *    body shows through the line. At 240p there is no alpha (the INK table's own note) and the line
   *    is drawn AFTER the marks, so a run of solid texels through a 3-texel planet sprite ERASES the
   *    planet. `BACK = 4` is the largest drawn body's half-extent, so the dashes start and end on clear
   *    glass and both ends of the line still say exactly which two things it joins.
   * ⛔ EVERY OTHER TEXEL, WHICH IS WHAT `setLineDash([6, 4])` BECOMES HERE. `lineTexels`' `every`
   *    parameter is the same mechanism the plane lattice uses; a 6-on-4-off pattern at this length is
   *    two dashes and reads as a broken line rather than a dashed one.
   * ⭐ THE ARROWHEAD IS THREE TEXELS — a tip and two flanks a texel back on the perpendicular. Legacy's
   *    filled triangle is 8x4 px on a canvas 3.7x this one's width; the same shape here is a blob.
   * ⛔ AND NOTHING DRAWS WHEN THE TARGET IS THE SHIP'S OWN BODY. Legacy has the same case and draws a
   *    zero-length line nobody sees; here it would be an arrowhead on top of the diamond, claiming a
   *    burn to where the ship already is.
   * ⚠ `SHIP` GOES THROUGH `placeLabel` AGAINST THE LABELS ALREADY PLACED, so the word yields to a
   *   body's NAME rather than the other way round — AC-5's own rule, and `taken` is why this has to be
   *   called after each design's label pass. It is NOT pushed into `S.labelHits`: the word names the
   *   ship, the ship is not a pickable body, and a hit that resolves to nothing is worse than none.
   */
  function drawShip(g, hits, taken) {
    const sp = shipHit(hits);
    if (!sp) return;
    const cl = REGIONS.map;
    const tp = trajectoryHit(hits);
    if (tp && tp !== sp) {
      const dx = tp.x - sp.x, dy = tp.y - sp.y, len = Math.hypot(dx, dy);
      const BACK = 4;
      if (len > BACK * 2 + 2) {
        const ux = dx / len, uy = dy / len;
        const bx = tp.x - ux * BACK, by = tp.y - uy * BACK;
        lineTexels(g, sp.x + ux * BACK, sp.y + uy * BACK, bx, by, INK.SHIP, cl, 2);
        rectClip(g, bx, by, 1, 1, INK.SHIP, cl);
        rectClip(g, bx - ux * 2 + uy * 2, by - uy * 2 - ux * 2, 1, 1, INK.SHIP, cl);
        rectClip(g, bx - ux * 2 - uy * 2, by - uy * 2 + ux * 2, 1, 1, INK.SHIP, cl);
      }
    }
    const box = spriteClip(g, sp.x, sp.y, SP.diam5, INK.SHIP, cl);
    if (box.w > 0 && box.h > 0) assertMark('ship diamond', 'map', box.x, box.y, box.w, box.h);
    if (!cl) return;
    const txt = fit('SHIP', cl.w - 8);
    // ⛔ `self` IS `null`, SO THE WORD IS FOREIGN TO EVERY MARK INCLUDING THE ONE IT STANDS ON. The
    //    diamond is drawn OVER a body's own sprite, and a plate allowed to touch "its own object"
    //    would knock that body out of the picture to name the ship sitting on it.
    const pos = placeLabel(taken, hits, sp.x, sp.y, 4, -10, measurePixelText(txt), cl, null);
    if (pos) plated(g, txt, pos.x, pos.y, INK.SHIP, 'map', 'ship label');
  }

  // ── ⭐⭐ AC-1 — THE HOVER CALLOUT, ONE BLOCK FOR TEN SCREENS ───────────────────────────────────────
  //
  // Page item 13, Max's ruling *"yes, PRISM and SYSTEM first"*, and the audit's own sentence: *"It is
  // the only way to learn what a thing is without selecting it."* Legacy draws four different tooltips
  // at four levels (NavComputer.js:1856 the sector name, :1677 the tile's kpc pair, :2200 the star
  // block, :2858 the body callout) and the two designs draw none. `S.hover` — published by the DRIVER
  // at the tail of `render()` from the SAME pick a click would consume (SEAM §1) — is the one input.
  //
  // ⛔ IT BRANCHES ON `hv.kind`, NEVER ON THE SHAPE OF `hv.ref`. Guessing "it has a `seed`, so it is a
  //    star" is a second copy of the driver's classification and the AC-4 defect shape; the kind is
  //    published for exactly this reason.
  // ⛔ NOTHING HERE IS A SECOND HIT TEST. The plate is placed off `(hv.sx, hv.sy)`, which the pick
  //    itself carries, and it is REFUSED any position that would cover the mark it names — so the
  //    pointer that summoned the callout is never inside it, and a click always reaches the thing
  //    underneath. That is also why it needs no entry in `S.labelHits`: it cannot be clicked.
  // ⚠ ONE FRAME OF LAG, DELIBERATELY. `S.hover` is written at the tail of `render()` and read by the
  //   NEXT paint, which is the same lag legacy's own mousemove-then-draw has.
  // ⛔ `GAP` MUST EXCEED `MARK + 1`, AND AT 6 IT DID NOT — MEASURED. `plated`'s box starts one texel
  //    left of the glyphs, so a plate offered at `ax + 6` has its edge on `ax + 5`, which is exactly
  //    the mark's own half-extent: every candidate at every 2D level tested as "covers the mark" and
  //    the callout silently drew nothing at levels 0-3 in both designs. 7 leaves one clear texel.
  const CALLOUT_GAP = 7;    // texels between the mark's edge and the plate's own
  const CALLOUT_MARK = 5;   // the half-extent of the hovered mark the plate must stay clear of
  function hoverCallout(g) {
    S.hoverCalloutRect = null;
    const hv = S.hover, rgn = REGIONS.map;
    if (!hv || !rgn) return;
    /*  Function · the callout draws only for a pointer that is ON THE MAP.
     *  Intent · the wave 1b finding, measured live by the integrator: design 1's call site is gated
     *    only on `!S.search.open`, so hovering a RAIL ROW — which resolves a real pick and publishes a
     *    real `S.hover` (`picking.js` answers for rows as well as marks) — painted a callout whose
     *    anchor `(sx, sy)` is inside the rail. Every candidate below is CLAMPED into the map pane, so
     *    the plate landed ~35 texels away in the map's corner, naming a row the pointer is nowhere
     *    near. Design 2 never showed it because its call already sits inside the legend gate and its
     *    list mode replaces the pane.
     *  ⛔ THE GATE IS HERE, NOT AT THE TWO CALL SITES, because it is one rule about one input: the
     *    plate is placed off `(hv.sx, hv.sy)` and is meaningless when that point is not in the pane
     *    the plate is clamped into. Spelling it twice is two copies of one condition, free to drift —
     *    and the second copy would be the one a third design forgets.
     *  ⚠ IT COSTS THE MAP NOTHING. Every pick the map itself resolves carries a point inside
     *    `REGIONS.map` by construction, so the ten screens AC-1 swept are unchanged texel for texel;
     *    what stops drawing is exactly the row hover.
     *  Deliberate non-goals · the ROW keeps its own highlight and its own click; nothing here changes
     *    what a row hover resolves to, only whether the map paints a plate about it. */
    if (!(hv.sx >= rgn.x && hv.sx < rgn.x + rgn.w && hv.sy >= rgn.y && hv.sy < rgn.y + rgn.h)) return;
    const lines = [];
    for (const raw of calloutLines(hv)) {
      const s = fit(String(raw == null ? '' : raw).toUpperCase(), rgn.w - 8);
      if (s) lines.push(s);
    }
    if (!lines.length) return;
    const LEAD = FACE.h + 1;
    // ⛔ AS MANY LINES AS FIT THE PANE, AND THE NAME IS NEVER THE ONE DROPPED — it is line 0 and the
    //    truncation is from the END. A 240p pane holds every one of these today (six lines is 36
    //    texels against ~200); the clamp is for the 144p buffer the lab also draws at.
    const room = Math.max(1, Math.floor((rgn.h - 2) / LEAD));
    if (lines.length > room) lines.length = room;
    let w = 0;
    for (const s of lines) w = Math.max(w, measurePixelText(s));
    const h = lines.length * LEAD - 1;
    const minX = rgn.x + 1, maxX = rgn.x + rgn.w - w - 1;
    const minY = rgn.y + 1, maxY = rgn.y + rgn.h - h - 1;
    if (maxX < minX || maxY < minY) return;        // a pane that cannot hold the plate draws nothing
    const ax = Math.round(hv.sx), ay = Math.round(hv.sy);
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    // ⭐ THE SIDE WITH THE MOST ROOM FIRST, then the other side, then below, then above. Each candidate
    //    is CLAMPED into the pane before it is tested, so the test is against the rectangle that would
    //    actually be drawn and not against the one that was asked for.
    const leftRoom = ax - rgn.x, rightRoom = rgn.x + rgn.w - ax;
    const side = rightRoom >= leftRoom ? 1 : -1;
    const midY = ay - Math.floor(h / 2), midX = ax - Math.floor(w / 2);
    const cands = side > 0
      ? [{ x: ax + CALLOUT_GAP, y: midY }, { x: ax - CALLOUT_GAP - w, y: midY }]
      : [{ x: ax - CALLOUT_GAP - w, y: midY }, { x: ax + CALLOUT_GAP, y: midY }];
    cands.push({ x: midX, y: ay + CALLOUT_GAP }, { x: midX, y: ay - CALLOUT_GAP - h });
    let box = null;
    for (const c of cands) {
      const bx = cl(Math.round(c.x), minX, maxX), by = cl(Math.round(c.y), minY, maxY);
      const covers = bx - 1 <= ax + CALLOUT_MARK && bx + w >= ax - CALLOUT_MARK
                  && by - 1 <= ay + CALLOUT_MARK && by + h >= ay - CALLOUT_MARK;
      if (!covers) { box = { x: bx, y: by }; break; }
    }
    if (!box) return;
    // ⭐ ONE PLATE FOR THE WHOLE BOX, not one per line: `plated()` lays a rect per string, which on a
    //    four-line block leaves three one-texel seams of map showing between the rows.
    rect(g, box.x - 1, box.y - 1, w + 2, h + 2, INK.BG);
    lines.forEach((s, i) => T(g, s, box.x, box.y + i * LEAD,
      { color: i === 0 ? INK.KEY : INK.BODY, rgn: 'map', what: 'callout line ' + i }));
    // ⭐ PUBLISHED FROM THE PLATE'S OWN RECTANGLE (INTERFACE §6). Nothing reads it this wave — the
    //    callout is never under the pointer that summoned it, so no press can land on it — but the
    //    DRIVER's press guard is the consumer for it and re-deriving this box there would be a second
    //    copy of the placement above.
    S.hoverCalloutRect = { x: box.x - 1, y: box.y - 1, w: w + 2, h: h + 2 };
  }

  /*  Function · legacy's own tooltip CONTENT for whatever `S.hover` is holding, line by line, name
   *    first. Upper-casing and fitting belong to `hoverCallout`; this returns the words.
   *  Intent · AC-1's spec is literally four legacy blocks (see `hoverCallout`'s header for the line
   *    numbers), so each branch below is one of them, re-spelled for a face that has no lower case.
   *  ⚠ `R☉` IS NOT IN THE FACE AND `R⊕` IS (checked against `hasGlyph` on both 5x5 and 5x7), so the
   *    solar radius reads `R SUN` and the Earth radius keeps legacy's glyph. That is the only word cut
   *    from any of the four blocks.
   *  ⚠ THE PLANE IS `y = 0`, legacy's own (`NavComputer.js:1896`, `const planeY = 0`) — the GALACTIC
   *    plane, not the camera's height and not the player's.
   *  Deliberate non-goals · no habitability percentage (legacy prints it above 0.3; the rail's detail
   *    block already carries `HAB` and the callout has to stay short enough to place), no binary line
   *    on a prism star (item 20's member list is parked), no companion separation. */
  function calloutLines(hv) {
    const r = hv.ref;
    if (hv.kind === 'sector') return [(r && r.name) || 'UNKNOWN SECTOR'];
    if (hv.kind === 'tile') {
      if (!r || !Number.isFinite(r.kx) || !Number.isFinite(r.kz)) return [];
      return [`(${r.kx.toFixed(1)}, ${r.kz.toFixed(1)})`];
    }
    if (hv.kind === 'star') {
      if (!r) return [];
      // ⚠ THE ROW ARRIVES IN TWO SHAPES. A pick off the MAP hands back the live `_localStars` entry
      //   (`picking.js:275`), which carries `dist` in kpc and no `pc`/`ly`; a pick off a RAIL ROW hands
      //   back the `D.starRows` row, which carries both (`state.js:883`). Deriving from `dist` when
      //   they are absent is the same arithmetic `state.js` used to make them.
      const pc = Number.isFinite(r.pc) ? r.pc
               : Number.isFinite(r.distPc) ? Number(r.distPc) : (Number(r.dist) || 0) * 1000;
      const ly = Number.isFinite(r.ly) ? r.ly : pc * 3.26;
      const wy = Number(r.wy) || 0;
      return [r.name || 'UNNAMED', `${r.spectral || '?'} CLASS`,
              `${pc.toFixed(2)} PC (${ly.toFixed(1)} LY)`,
              `${(wy * 1000).toFixed(0)} PC ${wy >= 0 ? 'ABOVE' : 'BELOW'} PLANE`];
    }
    if (hv.kind !== 'body' || !r) return [];
    const row = r.row || null;
    if (r.type === 'belt') {
      if (!row) return [];
      const au = Number(row.au) || 0, half = (Number(row.widthAU) || 0) / 2;
      return [beltLabel(row), half > 0 ? `${Math.max(0, au - half).toFixed(1)} TO ${(au + half).toFixed(1)} AU`
                                       : `${au.toFixed(2)} AU`];
    }
    if (r.type === 'star') {
      // ⛔ THE STAR'S FACTS COME OFF `D.sys`, NOT OFF `row`. The driver publishes `D.sysStar` there —
      //    a PRISM row, with a spectral letter and a distance — and none of the four numbers legacy's
      //    primary-star callout prints (radius, age, planet count) exist on it.
      const st = (D.sys && D.sys.star) || null;
      const n = D.bodies.filter((b) => b && b.kind === 'planet').length;
      const out = [(row && row.name) || (D.sysStar && D.sysStar.name) || 'PRIMARY',
                   `${(st && st.type) || (row && row.spectral) || '?'} CLASS`];
      if (st && Number.isFinite(st.radiusSolar)) out.push(`${st.radiusSolar.toFixed(2)} R SUN`);
      out.push(`AGE ${(Number(D.sys && D.sys.ageGyr) || 0).toFixed(1)} GYR`,
               `${n} PLANET${n === 1 ? '' : 'S'}`);
      return out;
    }
    /*  Function · AC-4's half of AC-1 — the callout over a MOON, which only the sub-view can produce.
     *  Intent · the seam's HOVER row: inside the sub-view a moon IS the pick, so `S.hover` carries
     *    `kind:'body'` with `ref.type === 'moon'` and the plate has to name the moon rather than the
     *    planet it orbits. Legacy's own moon tooltip is name, `moon.type` and `R⊕`
     *    (NavComputer.js:3370-3378); the orbit is added because it is the one number that tells two
     *    moons of one planet apart, and it is what both designs draw this picture from.
     *  ⛔ THE FACTS COME OFF `D.sys.planets[i].moons[j]`, NOT OFF THE ROW. `buildBodies` gives a moon
     *    row its PARENT's `au` and no orbit radius at all (state.js's own note), so a callout built
     *    from the row would print the planet's distance from the star under the moon's name.
     *  ⚠ THE ROW STILL OWNS THE NAME, because AC-7's rule is that the rail and the picture spell a
     *    body the same way. */
    if (r.type === 'moon') {
      const src = ((((D.sys && D.sys.planets) || [])[r.planetIndex] || {}).moons) || [];
      const m = src[r.moonIndex] || {};
      const out = [(row && row.name) || `MOON ${(r.moonIndex | 0) + 1}`,
                   String(m.type || (row && row.cls) || 'MOON')];
      const rE = Number.isFinite(m.radiusEarth) ? m.radiusEarth : Number(row && row.rE);
      if (Number.isFinite(rE)) out.push(`${rE.toFixed(2)} R⊕`);
      const orb = Number(m.orbitRadiusEarth);
      if (Number.isFinite(orb) && orb > 0) out.push(`ORBIT ${Math.round(orb)} R⊕`);
      return out;
    }
    // A PLANET — and in the WHOLE-SYSTEM picture a moon pip has already collapsed to its parent
    // upstream (SEAM §1; inside the sub-view it does not, which is the branch above), so this is the
    // only body branch left. `row` is the `D.bodies` row the same click would select.
    if (!row) return [];
    const out = [row.name || '—'];
    out.push(`${row.cls || ''}${Number.isFinite(row.rE) ? ` · ${row.rE.toFixed(1)} R⊕` : ''}`);
    out.push(`${(Number(row.au) || 0).toFixed(2)} AU`);
    if (row.T) out.push(`${Math.round(row.T)} K`);
    const m = row.moons | 0;
    out.push(`${m} MOON${m === 1 ? '' : 'S'}`);
    if (row.rings) out.push('RINGED');
    return out;
  }

  function fmtK(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return String(n);
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════
  // DESIGN 2 — TWO BARS AND A SKY.  The map owns the frame; two 8-row bars carry every word.
  // ════════════════════════════════════════════════════════════════════════════════════════════════
  function drawDesign2(g, W, H) {
    const BAR = Math.max(7, FACE.h + 3);
    const mapY = BAR, mapH = H - BAR * 2;
    region('topbar', 0, 0, W, BAR);
    region('map', 0, mapY, W, mapH);
    region('botbar', 0, H - BAR, W, BAR);

    rect(g, 0, 0, W, H, INK.BG);
    // ⛔ LAST FRAME'S CANDIDATES DIE WITH LAST FRAME'S PICTURE. The fill above has just erased
    // everything that was pickable; without this, a level change — or one press of L into list mode —
    // leaves the previous picture's marks live UNDERNEATH the new one and the pilot clicks a star
    // that is not there. Whichever painter runs below republishes what it actually draws, so this
    // costs exactly one frame of nothing and closes a whole class of stale-pick defect at the source.
    S.mapProj = null; S.prismHits = null; S.bodyHits = null; S.listGeom = null; S.labelHits = []; S.orbitRings = null;
    // ⭐ AC-2's REMAINING RECTANGLES, CLEARED ON THE SAME PRINCIPLE AND FOR BOTH DESIGNS' FIELDS
    // (INTERFACE §8). Three of these five are design 2's own — the list headers only exist in list
    // mode, the companion strip only in a wide binary — so each is republished by the branch that
    // draws it and by nothing else; the two design 1 fields are cleared here for the mirror-image
    // reason `drawDesign1` clears design 2's. (The minimap publishes nothing — see `d2Prism`.)
    // ⚠ Measured redundant one by one and load-bearing as a set — see the note on `drawDesign1`'s.
    S.listHeaderRects = null; S.locatorRect = null; S.companionRect = null; S.hoverCalloutRect = null;
    S.pagerRect = null; S.ladderCounterRect = null;
    // ⛔ AC-4's ROW LIST ON THE SAME RULE. `S.railBodies` is published only by the SUB-VIEW's rail
    //    branch, so without a clear here the rows of a planet the pilot left would stay on offer under
    //    the whole-system list — geometry out of nobody's paint, which is the defect this block names.
    S.railBodies = null;
    if (S.level <= 2) d2TwoD(g, W, mapY, mapH);
    else if (S.level === 3) d2Prism(g, W, mapY, mapH);
    else d2System(g, W, mapY, mapH);
    // ⭐ THE DRAWN SEARCH GOES OVER THE MAP, AFTER IT, IN THIS DESIGN'S OWN IDIOM (AC-11). Design 2's
    // premise is that there is no floating box anywhere — its ONE floating widget, the prism minimap,
    // is drawn as a stated contradiction — so the field cannot be a panel. It is the treatment `d2List`
    // already established for "something else is on the map now": one 50% parity checker over the whole
    // plane, no alpha, and the picture still faintly behind it.
    // ⛔ IT RUNS AFTER THE MAP PAINTER, NOT INSTEAD OF IT — the painter is what publishes this frame's
    //    `mapProj` / `prismHits` / `bodyHits`, and skipping it would leave the candidates from the
    //    frame BEFORE the search opened live under the overlay.
    if (S.search.open) d2Search(g, W, mapY, mapH);
    // ⭐⭐ AC-12 — THE LEGEND ROWS, AND WHY THEY ARE ON THE MAP AND NOT IN A BAR.
    //
    // This design is two 8-texel bars and a sky, and BOTH BARS ARE FULL — measured, not assumed. The
    // top bar is five tabs (203 texels at 417) plus the locator, which is already fitted into what is
    // left. The bottom bar is `W - 8 - chipW - 4` = 364 texels, 60 characters, and the PRISM clause set
    // alone is 68 before any of this — `fit()` is already eating the end of that row. There is no third
    // bar to add without moving the picture Max ruled on, so the only surface left is the sky.
    //
    // ⛔ SO IT IS DRAWN AS STRUCTURE, NOT AS DATA: `INK.RULE`, the dimmest ink this design owns, the
    //    one it uses for rules and for the disabled SYSTEM tab. Two rows at the pane's bottom-left, the
    //    corner every one of the three map painters leaves emptiest. The design's premise survives —
    //    no plate, no frame, no box, and no word that could be mistaken for a readout.
    // ⛔ AND ONLY WHILE THE MAP IS ON THE GLASS. List mode and the drawn search REPLACE the pane with
    //    full-pane content of their own, each with its own legend in the bar (`L=MAP`, `ESC CLOSE`), so
    //    drawing this under them would be text over text. `S.list` is the same flag `d2List` runs on.
    // ⭐ THE SYSTEM ROW IS LEVEL-4 ONLY, because those three are the only controls in this design bound
    //    at exactly one level and drawn nowhere: the orrery answers a click, a drag turns it, and Enter
    //    commits. Two 33-character rows do not fit one 417-texel row together, so they take one each.
    // ⛔ IT SAYS `ENTER`, NOT `ENTER BURN`, AND THE CHIP IS THE REASON. `[BURN]` and `[WARP]` are the
    //    SAME button under `isHere()` — browsing a foreign system from SYSTEM still arms a warp — so a
    //    legend that said BURN would be wrong on every foreign system. The chip is drawn eight texels
    //    below this row with the right word already on it; the legend names the key and lets the button
    //    name the act, which is the one spelling that cannot go out of step with `S.chipRect.armed`.
    if (!S.search.open && !(S.level === 3 && S.list)) {
      const LEG = 'V LOOK  SHIFT+TAB BACK  ESC CLOSE';
      const legY = mapY + mapH - FACE.h - 1;
      if (S.level === 4) T(g, fit('SELECT A BODY  DRAG ROTATE  ENTER', W - 8), 4, legY - (FACE.h + 1),
                           { color: INK.RULE, rgn: 'map', what: 'system legend' });
      /*  Function · PRISM's own legend row: the loaded-star count and the three keys this level owns.
       *  Intent · AC-3/AC-9 (restorations) took the bar for HEIGHT and VIEW (see `d2Status`). These
       *    four clauses were on the bar; two of them were already being eaten by `fit()` there, and
       *    `R/F UP` was invisible at every buffer. This row is the same slot, the same ink and the same
       *    corner SYSTEM's legend already uses, and it is 33 characters against 68 of room.
       *  ⛔ THE COUNT IS DRAWN IN `DIM`, NOT IN `RULE`, AND SEPARATELY. The legend rows are deliberately
       *    structure-ink so *"no word could be mistaken for a readout"* — and a star count IS a
       *    readout. Two draws on one row, each in the ink its content earns; `cw` is the measured width
       *    the first draw returned, so the second starts where the first actually ended.
       *  ⚠ `fmtK`, LIKE EVERY OTHER COUNT IN EITHER DESIGN. This was the last raw `.length` on a bar
       *    (AC-18 of the defects batch caught the other one) and in a loaded prism it is five digits.
       *  Deliberate non-goals · no sort key here (the bar has no room and PRISM's list mode names it),
       *    no pager, and nothing at all in list mode or under the search — both replace the pane. */
      if (S.level === 3) {
        const cw = T(g, `${fmtK(D.stars.length)} STARS`, 4, legY - (FACE.h + 1),
                     { color: INK.DIM, rgn: 'map', what: 'prism count' });
        T(g, fit('L=LIST  WASD PAN  R/F UP', W - 10 - cw - 6), 4 + cw + 6, legY - (FACE.h + 1),
          { color: INK.RULE, rgn: 'map', what: 'prism legend' });
      }
      T(g, fit(LEG, W - 8), 4, legY, { color: INK.RULE, rgn: 'map', what: 'global legend' });
      // ⭐ AC-1 (restorations) — THE CALLOUT RIDES THE SAME GATE AS THE LEGEND, AND FOR THE SAME
      // REASON: list mode and the drawn search REPLACE the pane with full-pane content of their own,
      // and a callout over either would be naming a mark that is no longer on the glass. It is drawn
      // AFTER the legend so its plate wins where the two meet — the legend is structure-ink at the
      // pane's bottom-left, the callout is a readout the pilot summoned.
      hoverCallout(g);
    }

    // ── TOP BAR: tabs left, ONE locator right.  "Where am I" is answered here and nowhere else —
    //    today it is answered five ways in three visual languages.
    rect(g, 0, 0, W, BAR - 1, INK.BG); rect(g, 0, BAR - 1, W, 1, INK.RULE);
    let tx = 4;
    const tabRects = [];
    LEVELS.forEach((n, i) => {
      const w = measurePixelText(n);
      T(g, n, tx, 1, { color: i === S.level ? INK.KEY : (i === 4 && S.noSystem) ? INK.RULE : INK.DIM, rgn: 'topbar', what: 'tab ' + n });   // SYSTEM dims on S.noSystem — see design 1's tab row
      if (i === S.level) rect(g, tx - 2, BAR - 2, w + 4, 1, INK.YOU);
      tabRects.push({ x: tx - 2, y: 0, w: w + 4, h: BAR });
      tx += w + 6;
    });
    // ⭐ THE STRIP'S OWN RECTANGLES. These tabs are proportionally spaced off the FACE, so their edges
    // are knowable only to the loop that laid them out — the underline this loop draws under the
    // active tab is `tx - 2, w + 4`, and so is the button. Restating `measurePixelText(n) + 6`
    // anywhere else is the AC-4 defect with a face swap (`;`) as its trigger.
    S.tabRects = tabRects;
    const loc = `${(D.here?.name || '—').toUpperCase()} · ${(D.playerSector?.name || '').toUpperCase()}`;
    const locW = measurePixelText(fit(loc, W - tx - 6));
    T(g, fit(loc, W - tx - 6), W - 4, 1, { color: INK.BODY, align: 'right', rgn: 'topbar', what: 'locator' });
    assertClear('tab strip vs locator', 'topbar', tx, W - 4 - locW);
    // ⭐ AC-2 — `HERE · SECTOR` IS THE ONE THING THIS DESIGN SAYS ABOUT WHERE YOU ARE, and clicking it
    // has always done nothing. `locW` is the FITTED string's width — the very value the right align
    // above subtracts from `W - 4` — so the band is the text that LANDED, not the text that was asked
    // for: at a narrow buffer `fit()` eats characters off the right and the band shrinks with them.
    // ⛔ PUBLISHED AT EVERY LEVEL, because the topbar is drawn at every level. It is cleared at the
    //    head of this same function, so the one frame where it is stale cannot exist.
    S.locatorRect = { x: W - 4 - locW, y: 1, w: locW, h: FACE.h };

    // ── BOTTOM BAR: one 63-character status line, ' · '-joined so truncation eats the VERB first.
    rect(g, 0, H - BAR, W, 1, INK.RULE); rect(g, 0, H - BAR + 1, W, BAR - 1, INK.BG);
    const chipW = measurePixelText('[WARP]') + 6;
    // ⭐ AC-18 — THE BUDGET IS MEASURED BEFORE THE LINE IS WRITTEN, NOT AFTER. `avail` moved two lines
    // up so `d2Status` can be handed it: the one clause whose length this design does not control is
    // the SECTOR NAME, and a line assembled blind is a line `fit()` has to rescue from the right —
    // where the affordance is.
    const avail = W - 8 - chipW - 4;
    const clauses = d2Status(avail);
    const full = clauses.join(' · ') + (S.sabotage ? SAB : '');
    if (avail < measurePixelText('PRISM')) fire('status line has no room left beside the commit chip');
    T(g, fit(full, avail), 4, H - BAR + 2, { color: INK.BODY, rgn: 'botbar', what: 'status line' });
    if (S.sabotage) assertFits('D2 status line (unclipped)', 'botbar', 4, H - BAR + 2, measurePixelText(full), FACE.h);
    const armed = !!(isHere() ? D.selBody : D.target);
    const chipX = W - chipW - 2;
    if (armed) rect(g, chipX, H - BAR, chipW, BAR, INK.TARGET);
    T(g, isHere() ? '[BURN]' : '[WARP]', chipX + 3, H - BAR + 2,
      { color: armed ? INK.BG : INK.DIM, rgn: 'botbar', what: 'commit chip' });
    // ⭐ THE CHIP'S RECTANGLE AND ITS ARMED STATE, from the two locals the fill and the label already
    // used. The button that LOOKS live and the button that IS live now cannot come apart, and neither
    // can WARP and BURN: one rectangle, one `armed`, one commit.
    S.chipRect = { x: chipX, y: H - BAR, w: chipW, h: BAR, armed };
  }
  function d2Status(avail = Infinity) {
    // ⭐ THE STATUS LINE NAMES THE SEARCH'S CONTROLS WHILE IT IS OPEN — this bar is the only place
    // design 2 says anything, so a field with no legend would be a field with no keys.
    if (S.search.open) return ['SEARCH', `${(S.search.rows || []).length} MATCHES`,
                               'UP DOWN MOVE', 'ENTER WARP', 'ESC CLOSE'];
    // ⛔ SAME NULLABLE FIELD, SAME TELL, SAME LINE: the name is optional-chained and the three numbers
    //    beside it are not. See `d1Rail`'s block for why a null here freezes the glass rather than
    //    blanking a row.
    const ps = D.playerSector;
    if (S.level === 0) return ['GALAXY', (ps?.name || '').toUpperCase(),
      `${ps ? fmtK(estStars(ps.centerX, ps.centerZ, ps.size)) : '—'} SYSTEMS`, 'CLICK TO ENTER'];
    // ⭐⭐ AC-18 — THE LINE THAT ADVERTISED A CONTROL AND THEN PUSHED IT OFF THE GLASS. At Max's own
    // 417x240 buffer this clause list measured 431 texels against a 364-texel bar, and `fit()` eats
    // from the RIGHT, so what SECTOR and REGION actually read was "… 22124140697 SYSTEMS IN BEST TILE
    // · CL" — the one thing on the bar a pilot can act on, truncated mid-word (REVIEW C18).
    //
    // ⛔ TWO CAUSES, AND `fmtK` ALONE CLOSES NEITHER. The count was the ONE number in either design not
    //    passed through `fmtK` — compare the GALAXY clause one line up — so it spent eleven characters
    //    saying what five say better; and the clause itself ("SYSTEMS IN BEST TILE") was the longest on
    //    any bar in either design. Measured, `fmtK` on its own still ran 395 against 364. So the count
    //    is formatted AND the clause loses the word the sentence can spare: the bar already says
    //    SECTOR, and a count under a "BEST TILE" label in a level whose rail is a tile ranking is not
    //    ambiguous about what is being counted.
    //
    // ⭐ AND THE SECTOR NAME — THE ONE CLAUSE WHOSE LENGTH THIS FILE DOES NOT CHOOSE — IS FITTED TO
    // WHAT IS LEFT, so the truncation that has to happen somewhere happens in the name, where it is
    // both visible and harmless, instead of in the affordance at the far end. `avail` is the bar's own
    // budget, handed down by the caller that drew it rather than re-derived here.
    if (S.level <= 2) {
      const tile = `${fmtK(rankMax(d1TileRows(levelView(S.level), levelView(S.level).n)))} BEST TILE`;
      const fixed = [LEVELS[S.level], '', tile, 'CLICK TO ENTER'];
      const room = avail - measurePixelText(fixed.join(' · '));
      return [LEVELS[S.level], fit((D.playerSector?.name || '').toUpperCase(), room), tile, 'CLICK TO ENTER'];
    }
    // ⭐⭐ AC-12 — LIST MODE NAMES THE TWO KEYS THAT ONLY WORK IN LIST MODE. `[` `]` re-order the list
    //    and `-` `=` page it; both are bound at PRISM, both were bound at every OTHER level too (AC-5
    //    takes that away), and neither has ever been printed in this design. This bar is the only place
    //    design 2 says anything, so a key not named here is a key that does not exist for the pilot.
    // ⛔ `ENTER TO WARP` PAID FOR THEM, AND IT IS THE CLAUSE THAT COULD AFFORD TO GO — MEASURED. The
    //    bar is `W - 8 - chipW - 4` = 364 texels at 417, 60 characters. With the longest key this level
    //    owns (`CATALOG`) the new row is 58; keeping `ENTER TO WARP` makes 74 and `fit()` truncates
    //    from the right, which would eat the very clauses this AC adds. And the commit chip is drawn at
    //    the right-hand end of this same bar, lit, reading `[WARP]` — Enter's promise is a BUTTON here,
    //    two texels away, which is more than the other five clauses can say for themselves.
    // ⛔ AND `PRISM LIST` LOST ITS FIRST WORD FOR THE LAST 6 CHARACTERS: 58 of 60 at the worst key, and
    //    the tab strip is drawn across the top of this same frame with PRISM filled, which is where
    //    this design says which level is on the glass in the first place.
    /*  Function · PRISM's bar, rebuilt around the two numbers item 21 and item 15 ask every look to say.
     *  Intent · AC-9 — one zoom readout for all three looks, same quantity and unit, which is the old
     *    nav's radius in light-years: `VIEW 16 LY` where this bar said `VIEW 10.0 PC ACROSS` about the
     *    same camera. AC-3 — design 2's status line prints HEIGHT with its region.
     *  ⛔ THE BAR IS 364 TEXELS = 60 CHARACTERS AND IT WAS ALREADY OVERFLOWING — MEASURED, before any
     *    of this: `PRISM · VIEW 10.0 PC ACROSS · 212 STARS · L=LIST · WASD PAN · R/F UP` is 69, and
     *    what the glass actually read was `… · L=LIST · WASD PAN ` with `R/F UP` gone entirely. So the
     *    numbers could not simply be added: anything appended would have been invisible, and anything
     *    inserted would have pushed a clause that IS drawn off the right-hand end.
     *  ⭐ SO THE THREE KEYS AND THE COUNT MOVE TO THE SKY, which is the surface AC-12 of the defects
     *    batch established for exactly this overflow (*"There is no third bar to add without moving the
     *    picture Max ruled on, so the only surface left is the sky"*) and which SYSTEM's own legend row
     *    already uses. NOTHING IS CUT — `R/F UP`, which no pilot has ever seen at PRISM, is drawn for
     *    the first time. See `drawDesign2`'s legend block for the row.
     *  ⚠ WHAT IS LEFT MEASURES 50 CHARACTERS at Max's window, which leaves ten for a HEIGHT number
     *    out in the halo (`HEIGHT -12345 PC BELOW · THICK DISK` is 56).
     *  Deliberate non-goals · no kpc, no `PC ACROSS` kept beside the ly (item 21 is that there is ONE
     *    readout), and list mode's clause set is untouched — it names its own keys and has no camera. */
    if (S.level === 3) {
      if (S.list) return ['LIST', `NEAREST ${D.starRows.length}`, 'L=MAP', d2SortHint(), '- = PAGE'];
      const pn = prismNumbers();
      return ['PRISM', pn.view, pn.height, pn.region];
    }
    /*  Function · AC-4 — the bar while a planet is open.
     *  Intent · page item 16. This bar is the only place design 2 says anything, so the sub-view's
     *    subject (which planet) and its way OUT have to be here or neither exists for the pilot
     *    — legacy's own sub-view spends half its hint row on `CLICK EMPTY SPACE TO GO BACK` (:3533).
     *  ⛔⛔ AND THE WAY OUT IT NAMES IS THE RIGHT-CLICK, NOT Esc — see `drawDesign1`'s hint block for
     *    the measurement. The Escape key never reaches this class; it closes the whole overlay
     *    (`main.js:13557`, Max's 2026-07-29 ruling). Right-click reaches `drv.onEscape()` through the
     *    canvas's `contextmenu` listener, and an empty-map click exits too.
     *  ⛔ THE MOON'S FACTS REPLACE THE PLANET'S ONCE ONE IS PICKED, rather than being added to them:
     *    the bar is 60 characters and the chip two texels to its right already reads BURN or WARP for
     *    whatever is armed. `RIGHT CLICK BACK` is the last clause because ` · `-joined truncation eats
     *    from the right — and it is the one clause that must never be eaten, so every form here is
     *    measured short (the longest, a named moon with all four facts, is 58 characters).
     *  ⚠ THE ORBIT IS IN EARTH RADII — see `d1Rail`'s sub-view branch for why AU would print one
     *    number over and over. */
    const det = sysDetail();
    if (det) {
      const sm = selMoonOf(det);
      if (sm) return [String(sm.row.name || '—').toUpperCase(), sm.type,
                      `${sm.rE.toFixed(2)} R⊕`, `ORBIT ${Math.round(sm.orbitR)} R⊕`, 'RIGHT CLICK BACK'];
      const n = det.moons.length;
      return [String(det.parent.name || '—').toUpperCase(), `${n} MOON${n === 1 ? '' : 'S'}`, 'RIGHT CLICK BACK'];
    }
    const b = D.selBody;
    // ⭐ AC-2 — THREE STATES, NOT ONE. `null` already had its clause pair and was unreachable until
    // `state.js` stopped inventing a fallback; the STAR is new, and it is not run through the planet
    // form for the reason `d1Rail`'s detail block gives — `0.00 AU` and `0 MOONS` about the body every
    // orbit is measured from are four plausible numbers the instrument does not mean.
    if (b && b.kind === 'star') return [(b.name || '—').toUpperCase(), (b.cls || '').toUpperCase(), 'PRIMARY'];
    // ⭐ AC-8 (restorations) — AND THE FOURTH STATE IS THE STAR'S OWN LINE, in the clause form this
    // bar already joins with ` · `, so what the glass reads is legacy's sentence verbatim:
    // `SYSTEM · G2 · 8 PLANETS · 4.6 GYR` (NavComputer.js:966-969). 33 characters against 60 of bar.
    // ⛔ `['SYSTEM', 'NO BODY SELECTED']` STAYS for the system-less case — see `d1Rail`'s twin.
    if (!b) { const sc = sysStarClauses(); return sc.length ? ['SYSTEM', ...sc] : ['SYSTEM', 'NO BODY SELECTED']; }
    return [b.name.toUpperCase(), b.cls.toUpperCase(), `${b.au.toFixed(2)} AU`,
            b.T ? `${Math.round(b.T)} K` : '—', `${b.moons} MOONS`, ...(b.rings ? ['RINGED'] : [])];
  }
  /** The active sort key, named — design 1's hint row builds the same string inline (`sortHint` there).
   *  Empty is the honest default: with no key on, the row degrades to `[ ] SORT`. */
  function d2SortHint() { return S.sortLabel ? `[ ] SORT ${S.sortLabel}` : '[ ] SORT'; }
  function d2TwoD(g, W, mapY, mapH) {
    const v = levelView(S.level);
    // ⭐ FULL BLEED WITH SQUARE WORLD PIXELS.  NavGalaxyRenderer/GalaxyLuminosityRenderer are square by
    // signature, so the honest way to get a wide field is to render the square at the WIDE extent and
    // crop the middle band — no upstream change, and one world pixel stays one texel.
    const extWide = v.size / 2;
    blitLum(g, lumImage(v.cx, v.cz, extWide, W), 0, mapY, W, mapH, W);
    const toX = (x) => ((x - v.cx) / v.size + 0.5) * W;
    const toY = (z) => mapY + mapH / 2 + ((z - v.cz) / v.size) * W;

    if (S.level === 0) {
      for (const { s } of D.sectorRows) {
        const x = toX(s.centerX), y = toY(s.centerZ);
        if (x < 0 || x >= W || y < mapY || y >= mapY + mapH) continue;
        rect(g, x, y, 1, 1, INK.DIM);
      }
      const px = toX(D.player.x), py = toY(D.player.z);
      // ⭐ AC-19 — CLIPPED TO THE PAINTED BAND, on the same rule as the picked sector forty lines below
      // ("CLIPPED TO THE PAINTED BAND ... an unclipped frame would draw over the topbar's rule and the
      // status bar"). The wide field is only ±(mapH/2)·kpc, so a pan puts the player outside it.
      // ⚠ NOTHING SURVIVING THE FRAME CHANGES HERE, MEASURED: `drawDesign2` repaints the topbar and the
      //   bottom bar AFTER this painter, so design 2's escaped marks were already overpainted (REVIEW
      //   C19 refutes that half of the claim). The clip is here because the paint order is the only
      //   thing that was saving it — the marks themselves were as unbounded as design 1's.
      const bandPane = { x: 0, y: mapY, w: W, h: mapH };
      const you0 = frameClip(g, px - 2, py - 2, 5, 5, INK.YOU, bandPane);
      if (you0.w > 0 && you0.h > 0) assertMark('YOU marker', 'map', you0.x, you0.y, you0.w, you0.h);
      for (const d of [[0, -4], [0, 4], [-4, 0], [4, 0]]) rectClip(g, px + d[0], py + d[1], d[0] ? 3 : 1, d[0] ? 1 : 3, INK.YOU, bandPane);
      // ⭐ THE WIDE PROJECTION, PUBLISHED. `toX`/`toY` above are isotropic — the square is rendered at
      // the WIDE extent and cropped, so one world pixel is one texel in BOTH axes — which collapses
      // the whole inverse to an origin and a scale: wx = cx + (x - ox)*kpc, wz = cz + (y - oy)*kpc.
      // ⚠ THE VERTICAL FIELD IS ONLY ±(mapH/2)·kpc, so about half the disc is off the glass BY
      //   CONSTRUCTION. `clip` is the band that was actually painted; outside it a click is a miss.
      S.mapProj = { design: 2, level: S.level, kind: 'wide', ox: W / 2, oy: mapY + mapH / 2,
                    kpc: v.size / W, cx: v.cx, cz: v.cz, clip: { x: 0, y: mapY, w: W, h: mapH } };
      // ⭐ THE CLICK-HIGHLIGHT AT GALAXY IS THE SECTOR, WHICH IS WHAT A GALAXY CLICK ACTUALLY DRILLS
      // (AC-5) — see `pickedSector`. Through THIS design's `toX`/`toY`, which are isotropic at
      // `W / v.size` texels per kpc, so a 0.5 kpc sector is the same handful of texels in both axes and
      // nothing of design 1's square comes across with it. Drawn last, over the YOU marker.
      // ⛔ THERE IS NO CELL FRAME HERE ANY MORE, AND THERE NEVER COULD HAVE BEEN ONE. A `pickCell` block
      //    sat above this until 2026-09-08, framing an 8x8 world cell at level 0; the adversarial pass
      //    found it unreachable — the driver's `notePick` writes `{ level: 0, sector }` and never `i`/`j`,
      //    and `pickCell` refuses a pick without them — so it was five lines of paint and nine of
      //    argument for a frame the build cannot draw. Deleted rather than defended.
      // ⛔ CLIPPED TO THE PAINTED BAND. The wide field is only ±(mapH/2)·kpc — about half the disc is
      //    off the glass BY CONSTRUCTION — so a picked sector can be partly or wholly outside it, and
      //    an unclipped frame would draw over the topbar's rule and the status bar. Empty
      //    intersection, nothing drawn: the honest answer for a sector the crop does not show.
      const ps0 = pickedSector();
      if (ps0) {
        const qx0 = Math.max(0, Math.round(toX(ps0.centerX - ps0.size / 2)));
        const qy0 = Math.max(mapY, Math.round(toY(ps0.centerZ - ps0.size / 2)));
        const qx1 = Math.min(W, Math.round(toX(ps0.centerX + ps0.size / 2)));
        const qy1 = Math.min(mapY + mapH, Math.round(toY(ps0.centerZ + ps0.size / 2)));
        if (qx1 > qx0 && qy1 > qy0) frame(g, qx0, qy0, qx1 - qx0, qy1 - qy0, INK.KEY);
      }
    } else {
      // the drillable block is SQUARE in world space; the density bleeding past it is real map and is
      // knocked back with a 50% parity checker rather than a translucency that cannot survive 240p
      const blk = mapH, bx = Math.round((W - blk) / 2);
      checker(g, 0, mapY, bx, mapH, INK.BG); checker(g, bx + blk, mapY, W - bx - blk, mapH, INK.BG);
      const n = v.n, cell = blk / n;
      for (let i = 0; i <= n; i++) {
        if (cell >= 20) { rect(g, bx + Math.round(cell * i), mapY, 1, blk, INK.DIM); rect(g, bx, mapY + Math.round(cell * i), blk, 1, INK.DIM); }
        else { for (let k = 0; k < blk; k += 2) { rect(g, bx + Math.round(cell * i), mapY + k, 1, 1, INK.DIM); rect(g, bx + k, mapY + Math.round(cell * i), 1, 1, INK.DIM); } }
      }
      // ⭐ THE PER-CELL DENSITY BAR — one fillRect, and the first per-tile information these levels
      // have ever carried (today the only text is a kpc coordinate pair on hover)
      const tiles = d1TileRows(v, n), max = rankMax(tiles);
      for (const t of tiles) {
        const len = Math.round((cell - 4) * Math.min(1, t.n / max));
        if (len > 0) rect(g, bx + t.i * cell + 2, mapY + (t.j + 1) * cell - 2, len, 1, INK.DIM);
      }
      const pi = Math.floor(((D.player.x - v.cx) / v.size + 0.5) * n);
      const pj = Math.floor(((D.player.z - v.cz) / v.size + 0.5) * n);
      // ⭐ AC-19 — AND THE BLOCK'S OWN YOU CELL IS CLIPPED TO THE BLOCK. `pi`/`pj` are unclamped floors
      // of the player's position in cell units, so a pan that takes the player out of the drillable
      // square puts this cell outside it — over the checkered surround at best and over the bars at
      // worst. ⚠ The checker's parity is shifted by the amount the clip ate, so the texels that remain
      // are the ones it would have drawn anyway; fully inside, the shift is 0 and the call is identical.
      const blkPane = { x: bx, y: mapY, w: blk, h: mapH };
      const youIn = clipBox(bx + pi * cell + 1, mapY + pj * cell + 1, cell - 2, cell - 2, blkPane);
      if (youIn.w > 0 && youIn.h > 0) {
        checker(g, youIn.x, youIn.y, youIn.w, youIn.h, INK.YOU,
                (youIn.x - Math.round(bx + pi * cell + 1) + youIn.y - Math.round(mapY + pj * cell + 1)) & 1);
      }
      const youCell2 = frameClip(g, bx + pi * cell, mapY + pj * cell, cell, cell, INK.YOU, blkPane);
      if (youCell2.w > 0 && youCell2.h > 0) assertMark('YOU cell', 'map', youCell2.x, youCell2.y, youCell2.w, youCell2.h);
      // ⭐ THE CLICK-HIGHLIGHT (INTERFACE §5), on the block's OWN cell — over the YOU frame, because a
      // drill onto the tile you are already in must still read as a drill.
      const pk = pickCell(S.level);
      if (pk) frame(g, bx + pk.i * cell, mapY + pk.j * cell, cell, cell, INK.KEY);
      // ⛔ THE BLOCK, AND NOT `toX`/`toY`. This branch never calls them: it lays a `blk`-wide square
      //    at `bx` for the same `v.size` kpc that the density behind it spends the full `W` on. A
      //    picker built on the wide projection therefore drills a tile roughly TWICE the size the
      //    pilot clicked — which looks like an off-by-one in the grid and is not one.
      S.mapProj = { design: 2, level: S.level, kind: 'block', bx, by: mapY, blk, n, cell,
                    cx: v.cx, cz: v.cz, size: v.size };
    }
  }
  function d2Prism(g, W, mapY, mapH) {
    const cxp = W / 2, cyp = mapY + mapH / 2;
    if (S.list) return d2List(g, W, mapY, mapH);
    const cap = Math.max(200, Math.round(W * mapH / 160));
    let drawn = 0;
    const onScreen = [];
    for (const s of D.starRows) {
      const p = projectPrism(s, cxp, cyp, W / 2, mapH / 2);
      if (p.x < -2 || p.x > W + 2 || p.y < mapY - 2 || p.y > mapY + mapH + 2) continue;
      onScreen.push({ s, p });
      if (++drawn >= cap) break;
    }
    // ⭐ AC-2 (restorations) — THE SAME THREE CUES DESIGN 1 GAINS, AND THE SAME TWO LINES OF CODE.
    //    Far-first (legacy NavComputer.js:2029), the 1 pc plane lattice under the marks (:1994-2014)
    //    and a drop line per mark (:2074-2079). ⛔ THE CULL AND THE CAP ARE THIS DESIGN'S OWN and are
    //    untouched — see the `S.prismHits` note below for why they must not be unified with design 1's.
    //    ⛔ AND NO HALO AND NO NEW INK FOR THE MARKS HERE: design 2 already spends SPECTRAL on every
    //    mark and rings nothing, which is the picture Max ruled on; item 14's halo clause is design 1's.
    // ⚠ THE LABEL LOOP KEEPS THE CULL'S ORDER, WHICH IS THE ACTIVE SORT KEY'S. Sorting `onScreen`
    //   far-first would hand the label cap to the FARTHEST stars — the depth order is about which
    //   glyph lands on top, not about which star is worth naming — so the names are placed off a
    //   snapshot taken before the sort and the picture Max ruled on keeps naming the nearest.
    const byRank = onScreen.slice();
    onScreen.sort((a, b) => b.p.depth - a.p.depth);
    prismPlane(g, cxp, cyp, W / 2, mapH / 2, REGIONS.map);
    for (const { s, p } of onScreen) {
      prismDrop(g, p, REGIONS.map);                             // the stem — the dashed line, restored
      rect(g, p.x, p.py, 1, 1, INK.RULE);                       // plane dot, not a dashed line
      if (s.dist < 1e-6) { for (const d of [[-4,-4],[2,-4],[-4,2],[2,2]]) { rect(g, p.x+d[0], p.y+d[1], 3, 1, INK.YOU); rect(g, p.x+d[0], p.y+d[1], 1, 3, INK.YOU); } continue; }
      if (s === D.selStar) { frame(g, p.x - 3, p.y - 3, 7, 7, INK.KEY); continue; }
      if (s.isReal) { plus(g, p.x, p.y, SPECTRAL[s.spectral] || INK.BODY); if (s.mult > 1) { rect(g, p.x+2, p.y-2, 1, 1, INK.BODY); rect(g, p.x-2, p.y+2, 1, 1, INK.BODY); } }
      else rect(g, p.x, p.y, 1, 1, SPECTRAL[s.spectral] || INK.DIM);
    }
    // ⭐ EVERY STAR MARK, IN DRAW ORDER, OUT OF THE ARRAY THIS DESIGN'S OWN CULL AND CAP BUILT.
    // ⚠ IT IS NOT DESIGN 1'S ARRAY AND MUST NOT BE UNIFIED WITH IT: this cull carries ±2 texels of
    //   slop so a glyph straddling the edge still draws, and this cap is `W*mapH/160` rather than a
    //   flat 240. Both facts are only true here, and both change which marks exist.
    S.prismHits = onScreen.map(({ s, p }) => ({ x: p.x, y: p.y, r: 3, ref: s }));
    // ⭐ LABELS ARE CAPPED AND NEVER FADED. A label that cannot find a slot IS NOT DRAWN — today 100
    // of 139 on-canvas labels at max zoom are drawn at 0.35 alpha, which at 240p reads as damage.
    const capN = Math.max(4, Math.floor(mapH / 22));
    const taken = [];
    let placed = 0;
    for (const { s, p } of byRank) {
      if (placed >= capN) break;
      if (!s.name || !s.isReal) continue;
      const txt = s.name.toUpperCase(), w = measurePixelText(txt);
      const pos = placeLabel(taken, S.prismHits, p.x, p.y, 3, 6, w, REGIONS.map, s);
      if (!pos) continue;                                        // not drawn — never faded
      // ⚠ THE 1-TEXEL TICK MIRRORS WITH THE LABEL. It is not a leader line and does not become one:
      //   it is the same single texel column in the same 3-texel gap this design has always drawn,
      //   on whichever side the name actually landed. Drawn on the star's left when the name is.
      const tick = pos.x < p.x ? p.x - 1 : p.x + 1;
      rect(g, tick, Math.min(p.y, pos.y + 2), 1, Math.abs(pos.y + 2 - p.y) + 1, INK.RULE);
      S.labelHits.push({ ...plated(g, txt, pos.x, pos.y, INK.KEY, 'map', 'prism label ' + txt),
                         ref: s, kind: 'star' });
      placed++;
    }
    // the minimap — drawn AS SPECIFIED, a 40x24 widget in the corner of a design whose premise is
    // that there is no floating box anywhere. That contradiction is on the glass on purpose.
    const mw = 24, mh = 24, mx = W - 44, my = mapY + mapH - mh - 5;
    for (const d of [[0,0],[mw-3,0],[0,mh-3],[mw-3,mh-3]]) { rect(g, mx+d[0], my+d[1], 3, 1, INK.DIM); rect(g, mx+d[0], my+d[1], 1, 3, INK.DIM); }
    rect(g, mx + mw / 2, my + mh / 2, 1, 1, INK.YOU);
    /*  Function · AC-10 — the 24-texel scale column beside the minimap becomes a REAL y-gauge,
     *    spanning the pane and published as `S.yGaugeRect`.
     *  Intent · page item 23, Max's ruling *"yes"*: design 1 has two handles at these two levels and
     *    design 2 had none. *"Your ruling was look-agnostic; only design 1 has them."* What was drawn
     *    here was a 1-texel column 24 texels tall with a fixed mark at its middle — it moved with
     *    nothing, it reported nothing, and a press on it rotated the prism.
     *  ⛔ IT IS THE PANE'S HEIGHT, NOT THE WIDGET'S, AND THAT IS THE DIFFERENCE BETWEEN A READOUT AND A
     *    HANDLE. The mapping is ±2 pc across `span = h/2`; over the old 24-texel column that is 0.17 pc
     *    per texel, so the entire thin disk lived in three texels and a drag could not resolve a
     *    height at all. Across the pane it is design 1's own resolution, because it is design 1's own
     *    strip — the ONE difference between the two designs' gauges is where it stands: design 1 has a
     *    dedicated 6-texel column between map and rail, design 2 is full-bleed, so its gauge stands
     *    INSIDE the map at the right edge, which it must anyway — the host returns at `:4401` unless
     *    the press is on the map, so a gauge outside the pane could never be grabbed.
     *  ⛔ AND IT EATS THE PRESSES ON ITS OWN SIX TEXELS. That is the plate rule (INTERFACE §6) and the
     *    trade design 1 already made: six columns of starfield stop answering a click and become a
     *    control. It is drawn over the starfield rather than knocked out of it, exactly as the minimap
     *    beside it is, so what is behind the gauge stays visible — only the press changes hands.
     *  ⚠ NOT DRAWN IN LIST MODE: `d2Prism` returns into `d2List` above this line, and `resetPicks()`
     *    clears the rect every frame, so the list's pane publishes no gauge and grabs nothing.
     *  Deliberate non-goals · the minimap is untouched (it still publishes no rectangle and eats no
     *    press — see the note below), and design 1 is untouched. */
    yGauge(g, W - 20, mapY, mapH);
    // ⛔ AC-2 — THIS WIDGET PUBLISHES NO RECTANGLE AND EATS NO PRESS, AND FOR HALF A DAY IT DID BOTH.
    //    The first build (88510cb) published `S.minimapRect` and the driver swallowed every click inside
    //    it, on the plate rule (INTERFACE §6): texels belong to the thing drawn on them. The adversarial
    //    pass measured the premise false. The plate rule holds for `plated()` labels because `plated()`
    //    KNOCKS OUT a BG rect first, so nothing under a label is visible; this widget is four corner
    //    brackets, a dot, a scale column and a 5-texel mark — about 49 texels of ink in a 720-texel box —
    //    over a starfield that is drawn BEFORE it and shows straight through. A star inside the box is on
    //    the glass, hoverable, and the pilot can see it; the band turned a click on it into nothing. That
    //    trades the mis-selection AC-2 was closing for a lost pick, which is the opposite of the AC.
    //    So the starfield under the widget keeps answering, exactly as it did before part 3. What the
    //    widget itself DOES on a click is still nothing, and marking it visibly as a readout is a
    //    picture change that goes to Max, not into this pass.
  }
  /** DESIGN 2'S LIST MODE — 'L'. A 60% checker plate over the whole map plane (the starfield stays
   *  faintly behind it) and rows of real terminal at the repo's 6-texel pitch. ⛔ IT REPLACES THE MAP:
   *  that is the design, and it is the reason judge 2 rejected D2 as the base — a row cannot be
   *  cross-referenced against a dot when the dots are gone. Drawn so that objection is LOOKED AT. */
  function d2List(g, W, mapY, mapH) {
    const cxp = W / 2, cyp = mapY + mapH / 2;
    for (const s of D.starRows) {                      // the starfield, still there, knocked back
      const p = projectPrism(s, cxp, cyp, W / 2, mapH / 2);
      if (p.x < 0 || p.x >= W || p.y < mapY || p.y >= mapY + mapH) continue;
      rect(g, p.x, p.y, 1, 1, INK.RULE);
    }
    checker(g, 0, mapY, W, mapH, INK.BG);              // one 50% parity pass — no alpha anywhere, and
                                                       // half the starfield survives, as the design says
    const LEAD = FACE.h + 1, rows = Math.floor((mapH - 4) / LEAD) - 1;
    // The same paging split as design 1's rail: the control writes `S.listOffset`, this slices by it.
    const total = D.starRows.length;
    const off = Math.max(0, Math.min(Math.max(0, total - Math.max(0, rows)), S.listOffset | 0));
    S.listOffset = off;
    const cols = [4, 22, 148, 166, 208, 250];
    const hdr = ['N', 'NAME', 'SP', 'PC', 'PLANE', 'SYSTEM'];   // '#' is not in the face; tofu would lie
    // ⭐ AC-2 — THE COLUMN HEADERS SORT THE LIST, AND EACH BAND IS THE ONE ITS OWN HEADER DREW.
    // ⛔ THE GUARD IS THE DRAW'S OWN `cols[i] < W - 8`, evaluated once for both: at a narrow buffer the
    //    right-hand headers are never painted, and a rectangle published for a header that is not on
    //    the glass is a click target with nothing above it — the same "the glass promises what nothing
    //    keeps" defect the culled GALAXY cells were removed for, one column wide.
    // ⭐ `T()` RETURNS THE WIDTH IT MEASURED, so the band is the string's own. Calling
    //    `measurePixelText(h)` again here would be a second measurement of a face that arrives as a
    //    parameter — it agrees today and would stop agreeing silently.
    // ⚠ `N` IS THE ROW ORDINAL AND SORTING BY IT IS THE IDENTITY, so it publishes `sortId: null`
    //   (INTERFACE §8a). The click is still EATEN — the header is drawn, so it must answer — and it
    //   does nothing. Inventing a key for it would be this design specifying a sort the driver has no
    //   comparator for, which is a promise made in the wrong file.
    const HDR_SORT = { N: null, NAME: 'name', SP: 'class', PC: 'dist', PLANE: 'plane', SYSTEM: 'catalog' };
    S.listHeaderRects = [];
    hdr.forEach((h, i) => { if (!(cols[i] < W - 8)) return;
      const hw = T(g, h, cols[i], mapY + 4, { color: INK.DIM, rgn: 'map', what: 'list header ' + h });
      S.listHeaderRects.push({ x: cols[i], y: mapY + 4, w: hw, h: FACE.h, sortId: HDR_SORT[h] }); });
    const drawn = D.starRows.slice(off, off + rows);
    drawn.forEach((s, i) => {
      const y = mapY + 4 + (i + 1) * LEAD;
      const sel = s === D.selStar;
      if (sel) rect(g, 2, y - 1, W - 4, LEAD, INK.KEY);
      const ink = sel ? INK.BG : (s.isReal ? INK.BODY : INK.DIM);
      const put = (c, str, maxw) => cols[c] < W - 10 &&
        T(g, fit(str, Math.min(maxw, W - cols[c] - 6)), cols[c], y, { color: ink, rgn: 'map', what: 'list row ' + i });
      put(0, String(off + i + 1), 16);
      put(1, (s.name || 'UNNAMED').toUpperCase(), 119);
      put(2, s.spectral, 11);
      put(3, s.pc.toFixed(2), 35);
      put(4, ((s.wy - D.player.y) * 1000).toFixed(0) + ' PC', 35);
      put(5, s.isReal ? 'CATALOG' : 'PROCEDURAL', 173);
    });
    // ⭐ THE ROW GRID, AND ONLY WHEN A LIST ACTUALLY PAINTED. This function runs at level 3 in list
    // mode and nowhere else, so a picker trusting a stale `listGeom` picks list rows off a prism.
    // `rows` here is what was DRAWN, not what would fit — the two differ at the end of the catalog,
    // and the difference is rows the pilot can click that carry nobody.
    if (drawn.length) S.listGeom = { top: mapY + 4, lead: LEAD, rows: drawn.length, x0: 2, x1: W - 2, offset: off, total };
  }

  /**
   * ⭐⭐ THE DRAWN SEARCH, DESIGN 2 — the same four fields as `d1Search`, in this design's language.
   *
   * ⛔ IT IS NOT `d1Search` MOVED. Design 1 has a rail to give the field, so the field takes the rail
   * and the map keeps working beside it. Design 2 has no rail: it is a full-bleed map between two
   * bars, and the only surface a list can occupy is the map itself — which is exactly the trade
   * `d2List` makes, and exactly the objection judge 2 raised against design 2 as a base. Drawing the
   * search the same way makes that trade visible on the search too, rather than hiding it behind a
   * borrowed layout. The rows run the full width because there is nothing beside them to collide with,
   * the highlight is the `INK.KEY` knockout `d2List` uses, and the legend is the bottom bar.
   */
  function d2Search(g, W, mapY, mapH) {
    const LEAD = FACE.h + 1;
    checker(g, 0, mapY, W, mapH, INK.BG);        // the same 50% knockback list mode uses, not an alpha
    const rows = S.search.rows || [];
    const top = mapY + 4;
    const cnt = `${rows.length} MATCHES`;
    const cw = measurePixelText(cnt);
    const qw = T(g, fit('>' + String(S.search.text || '').toUpperCase() + '_', W - 12 - cw), 4, top,
                 { color: INK.KEY, rgn: 'map', what: 'search query' });
    T(g, cnt, W - 4, top, { color: INK.DIM, align: 'right', rgn: 'map', what: 'search count' });
    assertClear('search query vs match count', 'map', 4 + qw + 4, W - 4 - cw);

    const listRows = Math.max(1, Math.floor((mapH - 4) / LEAD) - 1);
    const hi = Number.isFinite(S.search.highlight) ? S.search.highlight : -1;
    const off = Math.min(Math.max(0, rows.length - listRows), Math.max(0, hi - listRows + 1));
    const shown = rows.slice(off, off + listRows);
    shown.forEach((r, i) => {
      const yy = top + (i + 1) * LEAD;
      const sel = off + i === hi;
      if (sel) rect(g, 2, yy - 1, W - 4, LEAD, INK.KEY);
      const kind = fit(String(r.kind || '').toUpperCase(), 12 * FACE.advance);
      const kw = measurePixelText(kind);
      const nameW = T(g, fit(String(r.name || '').toUpperCase(), W - 12 - kw), 4, yy,
                      { color: sel ? INK.BG : INK.BODY, rgn: 'map', what: 'search row ' + i });
      T(g, kind, W - 4, yy, { color: sel ? INK.BG : INK.DIM, align: 'right', rgn: 'map', what: 'search kind ' + i });
      assertClear('search row ' + i + ' name vs kind', 'map', 4 + nameW + 4, W - 4 - kw);
    });
    if (!shown.length) {
      T(g, S.search.text ? 'NO MATCHES' : 'TYPE A NAME', 4, top + LEAD,
        { color: INK.DIM, rgn: 'map', what: 'search empty' });
    }
    S.searchGeom = { design: 2, top, lead: LEAD, rows: shown.length,
                     x0: 2, x1: W - 2, offset: off, total: rows.length };
  }

  function d2System(g, W, mapY, mapH) {
    // ⭐ AC-4 (restorations) — A PLANET IS OPEN, SO THE SKY IS ITS MOONS' ORRERY. `sysDetail()` is
    //    `null` for every whole-system frame, so the picture below is reached exactly as it was.
    const det = sysDetail();
    if (det) { d2MoonSystem(g, W, mapY, mapH, det); return; }
    const cxp = Math.round(W / 2), cyp = Math.round(mapY + mapH / 2);
    const tagsTaken = [], tagQueue = [];
    const hits = [];
    const auMax = Math.max(1e-3, ...D.bodies.filter((b) => b.kind !== 'moon').map((b) => b.au));
    // ⭐ THE ORRERY'S OWN CAMERA. `TILT` was the literal 0.42 and is now a true sine — exactly, because
    // `Math.sin(Math.asin(0.42)) === 0.42` — so at the default angle every texel below is unmoved.
    const sc = S.sysCam || {};
    const sysRotX = sc.rotX === undefined ? SYS_ROTX0 : sc.rotX;
    const sysRotY = sc.rotY === undefined ? SYS_ROTY0 : sc.rotY;
    const TILT = Math.sin(sysRotX);
    // ⛔⛔ THE SECOND HARD-CODED 0.42 WAS A LATENT PANE OVERFLOW, AND ROTATION IS WHAT ARMS IT.
    //    This is the radius BUDGET: the widest ring must fit the pane in BOTH axes, so the vertical
    //    term has to divide by the ring's actual minor-axis gain. Frozen at 0.42 it was inert (the
    //    width term wins, 205.5 < 262.7) right up until the tilt could change — at rotX = π/2 the
    //    minor axis IS the radius, 205.5 texels against a 112-texel half-pane: 93.5 texels of ink per
    //    side, through the topbar and off the canvas, and (until `assertMark` above) counted nowhere.
    // ⛔⛔ AND THE ALLOWANCE GOES INSIDE THE DIVIDE, WHICH IS THE HALF THE FIRST FIX MISSED. Written as
    //    `mapH/2/sin - 4` the budget yields `r·sin ≤ mapH/2 - 4·sin`: the 4-texel margin for the mark
    //    drawn AROUND the ring SHRINKS WITH THE TILT, and when the WIDTH term wins the vertical term is
    //    not applied at all. Measured over a 2,880-frame sweep of both designs at every level: one
    //    firing, `body mark <ringed planet> overflows map — bottom by 1.0 texel(s)`, a ringed giant's
    //    bars at `y + 2` on a body already at the pane's edge. Dividing the WHOLE budget bounds
    //    `r·sin ≤ mapH/2 - 4` whichever term wins.
    // ⚠ IT CANNOT MOVE THE PICTURE MAX RULED ON. At the default tilt this computes 108/0.42 = 257.14
    //   against the width term's 205.5, so `Math.min` still returns the width term, unchanged.
    const maxR = Math.min(W / 2 - 8, (mapH / 2 - 4) / Math.max(TILT, SYS_MIN_SIN));
    /*  Function · AC-6 — the orrery's magnification. Every radius on this picture is `rOf`, so one
     *    multiplier here scales the orbits, the bodies, the belts and (because their slots are placed
     *    off the body points) the labels, together.
     *  Intent · page item 18, Max's ruling *"design 2 yes; design 1 no — its ladder is a scroll, not a
     *    zoom."* `NavComputer._handleWheel:4701-4710` has ALWAYS scaled `_systemZoom` by 1.15/0.87
     *    inside [0.3, 5.0] at level 4 with no `viewMode` gate, and only the legacy orrery read it
     *    (`:2531`) — so under a design the wheel moved a number and nothing drew it. The audit's
     *    sentence: *"The wheel still changes a value; nothing draws it."*
     *  ⛔ IT MULTIPLIES THE RADIUS, WHICH IS WHY THE STAR DOES NOT MOVE. `rOf` is a distance FROM
     *    `(cxp, cyp)` and the primary is drawn AT `(cxp, cyp)`, so scaling the radius re-centres the
     *    zoom on the star by construction — no pan term, no second centre, nothing to keep in step.
     *    Legacy's own orrery does exactly this (`projScale * _systemZoom`, `:2531`).
     *  ⛔ AND DESIGN 1 NEVER READS IT — `d1Ladder` has no `S.sysCam` reference at all, which is Max's
     *    ruling spelled as an absence rather than as a gate that could be flipped.
     *  ⚠ THE `8` INNER RADIUS SCALES TOO. It is the star sprite's own clearance, not a constant of the
     *    picture: leaving it fixed would make the inner planets pile onto the primary at 0.3 and float
     *    off it at 5.0, i.e. the orrery would not be the same picture magnified.
     *  ⚠ A DEFAULT IS MANDATORY (`state.js`'s own note): an `undefined` multiplier does not draw a
     *    small orrery, it draws `NaN` radii, and `PanelHost` freezes the glass on the first throw. The
     *    lab page never sets it, so the lab draws at 1.
     *  Deliberate non-goals · no clamp here (the host owns [0.3, 5.0] and a second copy would be free
     *    to drift), no zoom at any other level, no zoom for the ladder. */
    const zoom = (sc && Number.isFinite(sc.zoom) && sc.zoom > 0) ? sc.zoom : 1;
    const rOf = (au) => (8 + (maxR - 8) * Math.sqrt(Math.max(0, au) / auMax)) * zoom;
    // ⭐ AC-19 — AND EVERYTHING BELOW IS DRAWN THROUGH THE PANE. At `zoom > 1` a ring, a body, its
    //    rings, its pips and its habitability cross can all legitimately land outside the map, and
    //    every primitive this file owns paints wherever it is told. `pane` is the clip every draw
    //    below is handed; `onPane` is the CULL for a body whose own centre has left the picture, and
    //    it gates the `hits` entry as well as the draw, on `d1Ladder`'s `vis()` rule: a mark that is
    //    not on the glass must not be offered to the picker.
    // ⚠ AT `zoom = 1` NEITHER FIRES. `maxR` budgets the widest ring into the pane in both axes, so no
    //   body's centre leaves it and every clipped draw is byte-for-byte its unclipped form.
    const pane = REGIONS.map;
    const onPane = (x, y) => !pane || (x >= pane.x && x < pane.x + pane.w && y >= pane.y && y < pane.y + pane.h);
    // ⭐ AC-2 — THE ORBIT ELLIPSES ANSWER A CLICK, AND THE GEOMETRY COMES OUT OF THE PAINT.
    // A ring is the ONE mark on this orrery that is large, unambiguous and completely inert: it is
    // drawn per body, it names that body by construction, and until now clicking anywhere on it
    // resolved to nothing. `rx`/`ry` are the SAME two expressions `dottedEllipse` was handed, so the
    // band the pilot can grab cannot drift from the band that was drawn — restating `rOf(b.au)` and
    // the tilt in the hit-test is the AC-4 defect exactly.
    // ⚠ A BELT'S RING IS PUBLISHED TOO, and it is not an oversight: `bodyIdentity` answers "no
    //   identity" for a belt, which CLEARS the selection rather than leaving a stale body armed —
    //   the same answer its centre mark already gives. Omitting it would make a belt's ring fall
    //   through to whatever concentric ring happened to be next, which is a wrong pick, not a
    //   missing one.
    S.orbitRings = [];
    for (const b of D.bodies) {
      if (b.kind === 'moon') continue;
      const r = rOf(b.au);
      dottedEllipse(g, cxp, cyp, r, r * TILT, INK.RULE, b.kind === 'belt' ? 5 : 2, pane);
      S.orbitRings.push({ cx: cxp, cy: cyp, rx: r, ry: r * TILT, ref: b });
      // ⭐ THE GUARD IS FED WHAT LANDED, NOT WHAT WAS ASKED FOR (AC-19's own rule). A ring past the
      //    pane's edge at `zoom > 1` is CLIPPED, so handing `assertMark` the unclipped box would fire
      //    on every notch of the wheel — which is a guard that gets switched off. At `zoom = 1` the
      //    box is wholly inside and `clipBox` returns exactly the four numbers this line passed before.
      const rb = clipBox(cxp - r, cyp - r * TILT, 2 * r, 2 * r * TILT, pane);
      if (rb.w > 0 && rb.h > 0) assertMark('orbit ring ' + b.name, 'map', rb.x, rb.y, rb.w, rb.h);
    }
    sprite(g, cxp, cyp, SP.star7, SPECTRAL[D.sys?.star?.type] || '#fff');
    hits.push({ x: cxp, y: cyp, r: 4, ref: null, moon: -1, star: true });
    // ⭐ AC-2 — THE FRAME SITS ON THE STAR WHEN THE STAR IS WHAT IS SELECTED. Same as `d1Ladder`: the
    // primary has always been a target the picker offers (`star: true`, the line above) with no way to
    // show that the pick landed, because `D.selBody` only ever held a planet or a moon. Same 9x9 at the
    // same `r = 4`, same `INK.KEY` the selected planets wear, and its own `assertMark` — the pane
    // centre cannot overflow the pane, but an unguarded mark is how the orrery's ring got off the glass.
    if (D.selBody?.kind === 'star') { frame(g, cxp - 4, cyp - 4, 9, 9, INK.KEY);
                                      assertMark('star selection frame', 'map', cxp - 4, cyp - 4, 9, 9); }
    D.bodies.filter((b) => b.kind !== 'moon').forEach((b, i) => {
      // ⭐⭐ THE PLANET'S REAL ORBITAL ANGLE, AND FIXING IT CLOSES A LIVE DEFECT.
      //    This was `i * 1.7 + 0.6` — the DRAW-LOOP INDEX, dressed as an angle. `D.bodies` is
      //    re-sorted by `[` / `]` (AU / NAME / TEMP), so pressing the sort key at SYSTEM teleported
      //    every planet around its ring: the ranking key was silently also the geometry.
      //    ⭐ The angle was never missing, only dropped. `StarSystemGenerator` draws `orbitAngle` per
      //    planet and the LEGACY orrery already reads it (`NavComputer.js:2756`, `p.orbitAngle || 0`);
      //    the body-list builder just never copied it across. `b.ang` is that number, on both sides of
      //    the seam. ⚠ A BELT KEEPS NO ANGLE — it is a full ring, and 0 is the honest value there.
      const a = (Number(b.ang) || 0) + sysRotY;
      const r = rOf(b.au);
      const x = Math.round(cxp + Math.cos(a) * r), y = Math.round(cyp + Math.sin(a) * r * TILT);
      // ⭐ AC-6/AC-19 — A BODY THE ZOOM HAS PUSHED OFF THE PICTURE IS NOT DRAWN AND NOT PICKABLE.
      //    `d1Ladder`'s `vis()` rule, at the one site on this design that can now need it. Returning
      //    before `hits.push` is the load-bearing half: a hit left behind for a mark nobody drew is
      //    the stale-pick defect `drawDesign2`'s clear block exists to prevent, arriving by a new road.
      if (!onPane(x, y)) return;
      // ⭐ AC-8 (restorations) — A BELT IS QUEUED FOR A LABEL, AND UNCONDITIONALLY. The `r > 24` gate
      //    below is for ORDINAL tags, which say nothing worth crowding an inner orbit for; ASTEROID
      //    BELT / KUIPER BELT is the belt's whole identity on this picture, and `placeLabel` is what
      //    decides whether there is room for it. `tag: ''` so the fallback below has nothing to fall
      //    back TO: a belt gets its name or it gets nothing — it has no ordinal.
      if (b.kind === 'belt') { hits.push({ x, y, r: 3, ref: b, moon: -1, star: false }); rectClip(g, x, y, 1, 1, INK.DIM, pane);
                               tagQueue.push({ b, tag: '', x, y }); return; }
      hits.push({ x, y, r: 4, ref: b, moon: -1, star: false });
      // ⛔ THE CLIPPED FORMS, UNCONDITIONALLY — not "when zoomed", which would be a second picture with
      //    its own bugs. `rectClip`/`spriteClip`/`frameClip` round exactly as `rect` rounds and then
      //    intersect, so a mark wholly inside its pane is byte-for-byte the unclipped draw (AC-19's own
      //    note); the branch that never taken is the one that cannot rot.
      spriteClip(g, x, y, b.rE > 4 ? SP.giant5 : SP.terr3, INK.BODY, pane);
      if (b.rings) { rectClip(g, x - 3, y - 2, 7, 1, INK.DIM, pane); rectClip(g, x - 3, y + 2, 7, 1, INK.DIM, pane); }
      if (b.hab > 0.5) for (const d of [[-2,0],[2,0],[0,-2],[0,2]]) rectClip(g, x + d[0], y + d[1], 1, 1, INK.TARGET, pane);
      if (b === D.selBody) frameClip(g, x - 4, y - 4, 9, 9, INK.KEY, pane);
      // ⭐ THE MARK GUARD, ONE CALL PER BODY (see `assertMark`) — the union of what the four branches
      // ABOVE actually drew, off the same `x`/`y` they drew it from, never a worst-case box. A fixed
      // 9x9 would report the selection frame on bodies that never draw one, which is the guard crying
      // wolf; and the wolf here is real, so it has to be believable.
      const g0 = b.rE > 4 ? 2 : 1;                                     // giant5 vs terr3, half-extent
      let l = x - g0, t = y - g0, rr = x + g0, bb = y + g0;
      if (b.rings)     { l = Math.min(l, x - 3); rr = Math.max(rr, x + 3); t = Math.min(t, y - 2); bb = Math.max(bb, y + 2); }
      if (b.hab > 0.5) { l = Math.min(l, x - 2); rr = Math.max(rr, x + 2); t = Math.min(t, y - 2); bb = Math.max(bb, y + 2); }
      if (b === D.selBody) { l = x - 4; t = Math.min(t, y - 4); rr = Math.max(rr, x + 4); bb = Math.max(bb, y + 4); }
      // ⭐ AC-6/AC-19 — THE CLIPPED UNION, for the reason the orbit ring's guard gives: the draws above
      //    are clipped now, so the box handed over has to be what LANDED. Inside the pane `clipBox`
      //    returns these same four numbers and the call is unchanged.
      const mb = clipBox(l, t, rr - l + 1, bb - t + 1, pane);
      if (mb.w > 0 && mb.h > 0) assertMark('body mark ' + b.name, 'map', mb.x, mb.y, mb.w, mb.h);
      // ⭐⭐ THE PIP STRIP GOES ON WHICHEVER SIDE OF THE BODY HAS ROOM — AC-15, AND THE MARK GUARD
      //   ABOVE IS THE ONLY THING THAT COULD HAVE FOUND IT. `rect` was unguarded until this pass, so a
      //   moon-rich planet on an outer orbit near `cos(a) ≈ 1` ran its pips off the right edge and the
      //   canvas CLIPPED them for free: zero firings at the default tilt — which is exactly why no
      //   suite was red — and 30 across a rotation sweep.
      // ⚠ IT STAYS A SCREEN-SPACE BADGE. What changes is which side it STARTS from, never its shape:
      //   the strip is a COUNT, and tilting it into the orbit plane would make it read as four more
      //   bodies in orbit. Right is the side it has always used and the side it keeps whenever it
      //   fits, so the picture Max ruled on is reproduced by the ordinary case never taking a new
      //   branch — and `m = 0` stays the pip nearest its planet on both sides, so a pip's index still
      //   means the same thing to `S.bodyHits` as it did.
      // ⛔⛔ AND THE STRIP DROPS BELOW THE BODY WHEN THERE IS NO ROOM ABOVE, WHICH THE FIX'S OWN SWEEP
      //   FOUND. The right-edge overflow is only the half that was measured first: `maxR` budgets the
      //   pane for the RING, `min(W/2 - 8, mapH/2/sin(rotX) - 4)`, and when the WIDTH term wins the
      //   vertical term is not applied at all — so at `rotX ≈ 0.5` a body can legitimately sit within
      //   2 texels of the pane's top edge and the badge, 4 texels above it, is outside. Measured over
      //   the same 1200-frame sweep: 11 firings, "top by 1-2 texel(s)". Same defect, same answer —
      //   put the badge on the side that has room.
      // ⛔ WITH ROOM ON NEITHER SIDE THE STRIP IS CLAMPED ONTO THE GLASS AND `fire()` SAYS SO. That
      //   needs a pane narrower than `8 + 2·moons` or shorter than 9 texels, which design 2's
      //   full-bleed map cannot be — but a badge silently drawn over its own planet is the same
      //   swallowed failure this AC exists to end, so the branch reports through the guard's own
      //   channel rather than looking deliberate.
      // The folded publication, for the same reason as the ladder's: `mx`/`my` are the ONE evaluation
      // of the pip's position, and `rect()`, `hits` and `assertMark` all get exactly those values.
      if (b.moons > 0) {
        const rgn = REGIONS.map, span = (b.moons - 1) * 2;
        const lLim = rgn ? rgn.x : -Infinity, rLim = rgn ? rgn.x + rgn.w - 1 : Infinity;
        const tLim = rgn ? rgn.y : -Infinity, bLim = rgn ? rgn.y + rgn.h - 1 : Infinity;
        let px = x + 4, step = 2, my = y - 4, tight = false;
        if (px + span > rLim) {
          if (x - 4 - span >= lLim) { px = x - 4; step = -2; }
          else { px = Math.max(lLim, rLim - span); tight = true; }
        }
        if (my < tLim) { if (y + 4 <= bLim) my = y + 4; else { my = tLim; tight = true; } }
        if (tight) fire(`moon pips ${b.name}: ${b.moons} pips need ${span + 1}x1 texels and fit on no side of the ` +
                        `body at (${x},${y}) inside map [${lLim}..${rLim}]x[${tLim}..${bLim}] — clamped onto its own planet.`);
        for (let m = 0; m < b.moons; m++) { const mx = px + m * step; hits.push({ x: mx, y: my, r: 2, ref: b, moon: m, star: false }); rectClip(g, mx, my, 1, 1, INK.DIM, pane); }
        assertMark('moon pips ' + b.name, 'map', Math.min(px, px + span * step / 2), my, span + 1, 1);
      }
      // ⛔⛔ THE TAG IS QUEUED, NOT DRAWN — because a placer that can see the marks has to be run AFTER
      //    the marks exist. Placing tag 3 inside this loop meant `hits` held bodies 1-3 and nothing
      //    else, so every tag was mark-aware only about the bodies drawn BEFORE it and blind to every
      //    one after — which is most of them, and the outer planets are exactly the ones a tag drifts
      //    onto. ⚠ Tags therefore now paint OVER all bodies instead of interleaved with them. No mark
      //    moves; a tag that a later planet used to overpaint is now legible, which is the point.
      if (r > 24) tagQueue.push({ b, tag: roman(i + 1), x, y });
    });
    /*  Function · AC-7 and AC-8 — the orrery's labels, placed against the finished picture (AC-14).
     *    `hits` is complete here — every body, every belt, every moon pip — so a label can be refused a
     *    slot that covers any of them.
     *  Intent · page items 19 and 20: *"Body names on the ladder and the orrery, placed like the prism
     *    labels, in place of or beside the letter and roman tags"*, and belts named at all.
     *  ⛔ THIS DESIGN TAKES THE "IN PLACE OF" HALF, WHERE DESIGN 1 TAKES "BESIDE" — and the difference
     *    is not a preference, it is what each picture can carry. Design 1's letter is load-bearing
     *    (AC-20: the rail prints the same letter beside the same body's row), so a name has to sit next
     *    to it. This orrery's roman numeral names nothing outside itself — it is the draw loop's
     *    position in a list `[` / `]` re-sorts — so the NAME is strictly more information in the same
     *    slot, and drawing both would be the second tag AC-20 forbids.
     *  ⭐ THE ORDINAL IS THE FALLBACK, NOT THE REPLACEMENT. A name that finds no slot retries as the
     *    two-or-three-texel-wide numeral, which usually does fit — so a crowded orrery degrades to
     *    exactly the picture it draws today rather than to a blank one.
     *  ⚠ THE QUEUE IS RE-ORDERED BEFORE IT IS PLACED (`bodyLabelOrder`): selected first, then the body
     *    the ship is at, then outward by AU. `placeLabel` is first-come-first-served, so the order IS
     *    the priority. */
    for (const q of bodyLabelOrder(tagQueue)) {
      const name = fit(bodyLabelText(q.b), W - 8);
      let txt = '', pos = null;
      if (name) { pos = placeLabel(tagsTaken, hits, q.x, q.y, 4, 8, measurePixelText(name), REGIONS.map, q.b); txt = name; }
      if (!pos && q.tag) { pos = placeLabel(tagsTaken, hits, q.x, q.y, 4, 8, measurePixelText(q.tag), REGIONS.map, q.b); txt = q.tag; }
      if (!pos || !txt) continue;
      S.labelHits.push({ ...plated(g, txt, pos.x, pos.y, INK.DIM, 'map', 'body label ' + txt),
                         ref: q.b, kind: 'body' });
    }
    // ⭐⭐ AC-5 (restorations) — AND THE NUMBER TO GUESS FROM NOW EXISTS, SO THE DIAMOND MOVED.
    //   What stood here was `sprite(g, cxp + 8, cyp, SP.diam5, INK.TARGET)` — a bare screen offset
    //   whose own note read *"the ONE mark on this orrery that visibly refuses to move… giving it a
    //   position would be this page guessing where the ship is, and there is no such number in the
    //   pipeline to guess from."* `D.ship` (SEAM §2, `state.js:945`) IS that number: the game's
    //   `_currentFocusIndex` / `_currentMoonIndex`, the same pair legacy places its diamond from. So
    //   the fixed offset is GONE and the diamond stands on the focused body's own drawn point, out of
    //   `hits`. ⛔ It is drawn AFTER the labels because the word `SHIP` has to yield to a body's name,
    //   and the dashed line crossing a label plate is legacy's own order too (`:2959`, after `:2833`).
    // ⚠ The ring bars, the moon pips and the habitability cross above are SCREEN-SPACE BADGES and stay
    //   that way, as do the selection frames. That is the low-fi idiom, not a mark that failed to turn.
    drawShip(g, hits, tagsTaken);
    // ⭐ AC-6 — THE ZOOM GAUGE, LAST ON THE MAP AND ONLY ON THIS DESIGN'S SYSTEM SCREEN. Drawn after
    //    everything it reports on, so its plate wins where it meets a ring or a label.
    zoomGauge(g, W, mapY, mapH, zoom);
    const far = (D.sys?.binarySeparationAU > 100) ? [`» ${(D.sysStar?.name || '').toUpperCase()} B ${Math.round(D.sys.binarySeparationAU)}AU`] : [];
    // ⭐ AC-2 — THE COMPANION STRIP, AND IT IS EATEN RATHER THAN ACTED ON. `» STAR B nnAU` names a
    // star this nav cannot reach: nothing in the pipeline resolves a companion to a system, so an
    // action here would be invented. What the rectangle buys is the plate rule (INTERFACE §6) — the
    // strip is drawn across the top of the orrery, directly over the outer orbit rings, and without it
    // a press on the text selects whichever ring passes beneath.
    // ⛔ PUBLISHED ONLY WHEN THE STRIP IS DRAWN (`far.length`), from the FITTED string's own returned
    //    width — a band sized from the unfitted string would extend past the glyphs at a narrow buffer.
    if (far.length) { const fW = T(g, fit(far.join('  '), W - 8), 4, mapY + 1, { color: INK.DIM, rgn: 'map', what: 'companion strip' });
      S.companionRect = { x: 4, y: mapY + 1, w: fW, h: FACE.h }; }
    // ⭐ THE ORRERY'S BODY MARKS, OUT OF THE ORBIT ARITHMETIC THAT PLACED THEM. Even now that the
    // angle is the planet's REAL `orbitAngle`, the drawn position also carries `rOf`, `TILT`, the
    // azimuth offset and two roundings — so nothing else in the build could reconstruct where a
    // planet actually landed, which is precisely why this has to come out of the paint.
    // ⚠ A MOON PIP CARRIES ITS PARENT IN `ref` AND ITS PIP INDEX IN `moon`. Downstream a moon pick is
    //   only consumed in planet detail; in the mode this orrery is drawn in it falls through and
    //   CLEARS the selection, so the parent is the live walk and `{type:'moon'}` is a dead click.
    // ⚠ A BELT GETS AN ENTRY TOO, so the picker can RECOGNISE one and return no pick, rather than
    //   silently leaving whatever was selected before under a click that clearly meant the belt.
    S.bodyHits = hits;
  }
  /*  Function · AC-4 — design 2's PLANET DETAIL: the open planet at the centre of the pane with each
   *    of its moons on its own ring, at its own phase, named, and the selected one framed.
   *  Intent · page item 16, Max's ruling *"yes — a design-side sub-view, not a switch back to the old
   *    one."* Legacy draws exactly this picture (`_renderPlanetDetail`, NavComputer.js:3256-3537) in
   *    arcs and alpha on a 1560-wide vector canvas; this is the same CONTENT in this design's own
   *    vocabulary — dotted ellipses, sprites and knockout plates, at 240p with no curves and no alpha.
   *  ⛔ IT IS `d2System`'S OWN CAMERA, NOT A SECOND ONE: the same `rotX` / `rotY` off `S.sysCam`, the
   *    same `maxR` budget, the same `zoom`, the same clipped primitives and the same `onPane` cull. A
   *    drag turns this picture exactly as it turns the system's, and AC-6's wheel and gauge still work
   *    — which is the seam's own rule that the zoom gauge STAYS in the sub-view.
   *  ⛔ THE RADIUS IS THE MOON'S ORBIT IN EARTH RADII, LINEAR IN `sqrt` SPACE — legacy's own scale
   *    (`projScale = (viewSize/2) / sqrt(maxMoonR * 1.3)`, `:3284`), so two moons keep the spacing
   *    legacy gave them. `det.moons[].orbit` is that square root, taken once in `sysDetail`.
   *  ⛔ AND THE PHASE IS THE MOON'S `startAngle`, NOT ITS PARENT'S. `buildBodies` gives a moon ROW its
   *    parent's angle on purpose (a moon row is placed on the STAR's ring in the whole-system picture,
   *    where its own phase has no meaning) — here the frame IS the planet, so the moon's own phase is
   *    the only honest one, and it is read from `D.sys` rather than from the row.
   *  ⛔ NO ORBIT-RING PICKS (`S.orbitRings = []`). An empty-map click is this sub-view's way OUT (the
   *    seam's INSIDE row), and legacy's own planet detail says so on its hint row; a moon's thin ring
   *    answering a click would take that exit away from most of the pane.
   *  ⛔ THE SHIP AND ITS TRAJECTORY ARE SUPPRESSED — see `d1MoonLadder`'s header for why a diamond
   *    placed from these hits would be a mark that lies.
   *  Deliberate non-goals · no companion strip (it names a star, not a moon), no habitability crosses
   *    on a moon, no pip strip under a moon, and no second picture for the parent's rings. */
  function d2MoonSystem(g, W, mapY, mapH, det) {
    const cxp = Math.round(W / 2), cyp = Math.round(mapY + mapH / 2);
    const tagsTaken = [], tagQueue = [];
    const hits = [];
    const sc = S.sysCam || {};
    const sysRotX = sc.rotX === undefined ? SYS_ROTX0 : sc.rotX;
    const sysRotY = sc.rotY === undefined ? SYS_ROTY0 : sc.rotY;
    const TILT = Math.sin(sysRotX);
    const maxR = Math.min(W / 2 - 8, (mapH / 2 - 4) / Math.max(TILT, SYS_MIN_SIN));
    const zoom = (sc && Number.isFinite(sc.zoom) && sc.zoom > 0) ? sc.zoom : 1;
    const oMax = Math.max(1e-3, ...det.moons.map((m) => m.orbit));
    const rOf = (o) => (8 + (maxR - 8) * (Math.max(0, o) / oMax)) * zoom;
    const pane = REGIONS.map;
    const onPane = (px, py) => !pane || (px >= pane.x && px < pane.x + pane.w && py >= pane.y && py < pane.y + pane.h);
    S.orbitRings = [];
    const selM = selMoonOf(det);
    // ── THE MOON ORBITS, UNDER EVERYTHING ────────────────────────────────────────────────────────
    for (const m of det.moons) {
      const r = rOf(m.orbit);
      dottedEllipse(g, cxp, cyp, r, r * TILT, INK.RULE, 3, pane);
      const rb = clipBox(cxp - r, cyp - r * TILT, 2 * r, 2 * r * TILT, pane);
      if (rb.w > 0 && rb.h > 0) assertMark('moon orbit ' + m.row.name, 'map', rb.x, rb.y, rb.w, rb.h);
    }
    // ── THE OPEN PLANET, AT THE CENTRE ───────────────────────────────────────────────────────────
    const pSp = det.parent.rE > 4 ? SP.giant5 : SP.terr3;
    spriteClip(g, cxp, cyp, pSp, INK.KEY, pane);
    if (det.parent.rings) { rectClip(g, cxp - 3, cyp - 2, 7, 1, INK.DIM, pane); rectClip(g, cxp - 3, cyp + 2, 7, 1, INK.DIM, pane); }
    hits.push({ x: cxp, y: cyp, r: 4, ref: det.parent, moon: -1, star: false });
    if (D.selBody === det.parent) frameClip(g, cxp - 4, cyp - 4, 9, 9, INK.KEY, pane);
    {
      const g0 = det.parent.rE > 4 ? 2 : 1;
      let l = cxp - g0, t = cyp - g0, rr = cxp + g0, bb = cyp + g0;
      if (det.parent.rings) { l = Math.min(l, cxp - 3); rr = Math.max(rr, cxp + 3); t = Math.min(t, cyp - 2); bb = Math.max(bb, cyp + 2); }
      if (D.selBody === det.parent) { l = cxp - 4; t = Math.min(t, cyp - 4); rr = Math.max(rr, cxp + 4); bb = Math.max(bb, cyp + 4); }
      const mb = clipBox(l, t, rr - l + 1, bb - t + 1, pane);
      if (mb.w > 0 && mb.h > 0) assertMark('detail planet ' + det.parent.name, 'map', mb.x, mb.y, mb.w, mb.h);
    }
    tagQueue.push({ b: det.parent, tag: '', x: cxp, y: cyp });
    // ── THE MOONS ────────────────────────────────────────────────────────────────────────────────
    det.moons.forEach((m) => {
      const a = m.ang + sysRotY;
      const r = rOf(m.orbit);
      const x = Math.round(cxp + Math.cos(a) * r), y = Math.round(cyp + Math.sin(a) * r * TILT);
      // ⭐ AC-19's rule, at this design's other draw site: a mark the camera has pushed off the pane
      //    is neither drawn NOR published, so the picker is never offered a mark nobody can see.
      if (!onPane(x, y)) return;
      const sel = selM === m;
      spriteClip(g, x, y, SP.moon3, sel ? INK.TARGET : INK.BODY, pane);
      // ⭐ THE SEAM'S OWN HIT SHAPE — see `d1MoonLadder`'s note: `ref` is the MOON's row and the four
      //    explicit fields say what the pick IS, so the DRIVER never infers it from `ref`.
      hits.push({ x, y, r: 4, ref: m.row, moon: m.mIdx, star: false,
                  type: 'moon', planetIndex: det.pIdx, moonIndex: m.mIdx, row: m.row });
      if (sel) frameClip(g, x - 4, y - 4, 9, 9, INK.TARGET, pane);
      let l = x - 1, t = y - 1, rr = x + 1, bb = y + 1;
      if (sel) { l = x - 4; t = y - 4; rr = x + 4; bb = y + 4; }
      const mb = clipBox(l, t, rr - l + 1, bb - t + 1, pane);
      if (mb.w > 0 && mb.h > 0) assertMark('moon mark ' + m.row.name, 'map', mb.x, mb.y, mb.w, mb.h);
      tagQueue.push({ b: m.row, tag: roman(m.mIdx + 1), x, y });
    });
    // ── THE NAMES, wave 1b's own pass: the name in the slot, the ordinal as the fallback ─────────
    for (const q of bodyLabelOrder(tagQueue)) {
      const name = fit(bodyLabelText(q.b), W - 8);
      let txt = '', pos = null;
      if (name) { pos = placeLabel(tagsTaken, hits, q.x, q.y, 4, 8, measurePixelText(name), REGIONS.map, q.b); txt = name; }
      if (!pos && q.tag) { pos = placeLabel(tagsTaken, hits, q.x, q.y, 4, 8, measurePixelText(q.tag), REGIONS.map, q.b); txt = q.tag; }
      if (!pos || !txt) continue;
      S.labelHits.push({ ...plated(g, txt, pos.x, pos.y, q.b === D.selBody ? INK.KEY : INK.DIM,
                                   'map', 'moon label ' + txt), ref: q.b, kind: 'body' });
    }
    // ⭐ AC-6 — THE ZOOM GAUGE STAYS (the seam's PAINT row): the wheel and the drag still magnify this
    //    picture, so the instrument that reports them has to be on the glass that they move.
    zoomGauge(g, W, mapY, mapH, zoom);
    S.bodyHits = hits;
  }
  function roman(n) { return ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI'][n - 1] || String(n); }

  return { drawDesign1, drawDesign2, LEVELS, INK, SPECTRAL, isHere, levelView, projectPrism, ZOOM_STOPS,
           regions: () => REGIONS, violations: () => _violations,
           resetViolations: () => { _violations = 0; _fired.clear(); },
           // ⛔ REGIONS MUST BE CLEARED BETWEEN FRAMES OR THE GUARD GOES SOFT. `assertFits` reports
           // "region X was never declared this frame" — but with a stale map it cannot tell, so a
           // design asserting against a region only the OTHER design declares would pass against
           // last frame's rectangle. The lab never hit this because it drew one design per page load.
           resetRegions: () => { REGIONS = {}; } };
}
