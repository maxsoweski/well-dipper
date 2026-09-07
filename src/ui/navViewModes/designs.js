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
  };
  /** BURN or WARP is not "which level am I on" — it is NavComputer._isCurrentSystem() (:1098-1105), a
   *  0.1 pc identity test. Browsing a foreign system from SYSTEM still arms a WARP. */
  const isHere = () => S.level === 4 && D.sysStar && D.here && D.sysStar.seed === D.here.seed;
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
  function dottedEllipse(g, cx, cy, rx, ry, ink, every = 2) {
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
        if (!(i % every)) g.fillRect(Math.round(cx + ct * rx), Math.round(cy + st * ry), 1, 1);
        i++; next += pitch;
      }
      acc += Math.hypot(a * st, b * ct) * dt;
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
  /** ONE label slot solver, shared by every design that puts names on a map — a 7-offset ladder over
   *  the repo's own 6-texel pitch, and A LABEL THAT CANNOT FIND A SLOT IS NOT DRAWN. Shared on purpose:
   *  if each design got its own placement code the comparison would be measuring my code, not theirs. */
  function placeLabel(taken, x, y, w, bounds) {
    for (const dy of [0, -6, 6, -12, 12, -18, 18]) {
      const yy = y + dy;
      if (x + w + 2 > bounds.x + bounds.w || x < bounds.x) continue;
      if (yy < bounds.y || yy + FACE.h + 2 > bounds.y + bounds.h) continue;
      if (taken.some((t) => Math.abs(t.y - yy) < FACE.h + 1 && x - 2 < t.x + t.w && x + w + 2 > t.x)) continue;
      taken.push({ x: x - 2, y: yy, w: w + 4 });
      return yy;
    }
    return null;
  }

  /** A knockout plate under on-map type. Without it a label over a bright arm is invisible. */
  function plated(g, s, x, y, ink, rgn, what) {
    const w = measurePixelText(s);
    rect(g, x - 1, y - 1, w + 2, FACE.h + 2, INK.BG);
    T(g, s, x, y, { color: ink, rgn, what });
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
  // ⛔ LEVEL 0 IS NOT READ FROM `S.view`: it is the whole 44 kpc disc by definition, and there is no
  //    drill above it that could have moved it.
  function levelView(level) {
    if (level === 0) return { cx: 0, cz: 0, size: 44, n: 0 };
    const v = S.view;
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

  // DESIGN 1 — THE 71x40.  A character-cell nav computer: a map pane and a persistent ranked rail.
  // ════════════════════════════════════════════════════════════════════════════════════════════════
  /** ⭐ THE HINT ROW WHILE THE DRAWN SEARCH IS OPEN, AND IT NAMES EVERY KEY THE FIELD CONSUMES.
   *  50 characters against the 62 of the GALAXY hint, so no buffer clips it any sooner than that one.
   *  ⛔ It says ESC CLOSE and not ESC BACK: the field's Escape closes the field and nothing else. */
  const SEARCH_HINT = 'TYPE A NAME   UP DOWN MOVE   ENTER WARP   ESC CLOSE';

  function drawDesign1(g, W, H) {
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
                   `CLICK A STAR OR A LIST ROW   ${sortHint}   / SEARCH   WASD PAN`,
                   `SELECT A BODY   SCROLL , . OR CLICK ...   ${sortHint}   TAB LEVEL`];
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
      else T(g, lbl, lx, ry(rows - 2), { color: INK.DIM, rgn: 'tabs', what: 'tab ' + name });
    });
    const counts = [`${D.sectorRows.length} SECTORS`, '64 TILES', '256 TILES',
                    `${D.stars.length} STARS`, `${D.bodies.length} BODIES`][S.level];
    T(g, fit(counts, W - 5 * tabW - 2), W - 1, ry(rows - 2), { color: INK.DIM, align: 'right', rgn: 'tabs', what: 'level counts' });

    // ── COMMIT, full width ───────────────────────────────────────────────────────────────────────
    const cur = isHere();
    const label = cur ? `BURN TO ${(D.selBody?.name || '—').toUpperCase()} · ${(D.selBody?.au ?? 0).toFixed(2)} AU · ENTER`
                      : `WARP TO ${(D.target?.name || '—').toUpperCase()} · ${(D.target?.ly || 0).toFixed(1)} LY · ENTER`;
    rect(g, 0, ry(rows - 1) - 1, W, LEAD, cur ? INK.YOU : INK.TARGET);
    T(g, fit(label, W - 4), W / 2, ry(rows - 1), { color: INK.BG, align: 'center', rgn: 'commit', what: 'commit label' });
  }

  function d1TwoD(g, mapW, mapY, mapH) {
    const v = levelView(S.level);
    const sq = Math.min(mapW, mapH), ox = Math.round((mapW - sq) / 2);
    blitLum(g, lumImage(v.cx, v.cz, v.size / 2, sq), ox, mapY, sq, sq, sq);
    const n = S.level === 0 ? 8 : v.n;
    for (let i = 0; i <= n; i++) {
      rect(g, ox + Math.round(sq * i / n), mapY, 1, sq, INK.RULE);
      rect(g, ox, mapY + Math.round(sq * i / n), sq, 1, INK.RULE);
    }
    const toX = (x) => ox + ((x - v.cx) / v.size + 0.5) * sq;
    const toY = (z) => mapY + ((z - v.cz) / v.size + 0.5) * sq;
    // YOU — a 1-texel frame plus a 3x3 block, no pulse
    const px = toX(D.player.x), py = toY(D.player.z);
    const cell = sq / n;
    frame(g, Math.floor((px - ox) / cell) * cell + ox, Math.floor((py - mapY) / cell) * cell + mapY, cell, cell, INK.YOU);
    rect(g, px - 1, py - 1, 3, 3, INK.YOU);
    if (D.target) sprite(g, toX(D.target.wx), toY(D.target.wz), SP.diam5, INK.TARGET);
    // the eight ranked tiles carry a 2-char id; at 16x16 the cell is 13 texels and only the listed
    // tiles are tagged, which is the design saying so rather than the glyphs colliding
    const ids = d1TileOrder(d1TileRows(v, n)).slice(0, 8);
    ids.forEach((t, i) => {
      const tx = ox + t.i * cell + 2, ty = mapY + t.j * cell + 2;
      if (cell < measurePixelText(t.id) + 3) return;
      plated(g, t.id, tx, ty, INK.DIM, 'map', 'tile id ' + t.id);
    });
    // ⭐ THE CLICK-HIGHLIGHT (INTERFACE §5). Drawn LAST so it sits over the grid, the tile ids and the
    // YOU marker — a "you hit this one" that a rule can cross is not an acknowledgement.
    const pk = pickCell(S.level);
    if (pk) frame(g, ox + pk.i * cell, mapY + pk.j * cell, cell, cell, INK.KEY);
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
    for (const { s, p } of shown) {
      rect(g, p.x, p.py, 1, 1, INK.RULE);                                          // the plane dot
      if (s === D.selStar) { frame(g, p.x - 2, p.y - 2, 5, 5, INK.TARGET); continue; }
      if (s.dist < 1e-6)   { frame(g, p.x - 2, p.y - 2, 5, 5, INK.YOU); continue; }
      if (s.isReal) plus(g, p.x, p.y, INK.BODY);
      else rect(g, p.x, p.y, 1, 1, INK.DIM);
    }
    // ⭐ EVERY STAR MARK, IN DRAW ORDER, OUT OF THE ARRAY THE CULL AND THE CAP BUILT. `shown` IS the
    // publication's whole value: the bounds cull and the 240-mark draw cap live in the loop above and
    // nowhere else, so a picker walking `D.starRows` would offer marks that are not on the glass.
    // r = 3 is the largest drawn glyph's half-extent plus a texel — the two selection frames are 5x5
    // and `plus` is 5 texels across — and the picker takes the NEAREST inside r, so marks that
    // overlap at this radius resolve to the near one instead of to whichever was tested first.
    S.prismHits = shown.map(({ s, p }) => ({ x: p.x, y: p.y, r: 3, ref: s }));
    // ⭐ EIGHT SINGLE-CHARACTER INDEX TAGS instead of 139 labels of which 100 are already faded
    const top = D.starRows.slice(0, 9).filter((s) => s.dist > 1e-6).slice(0, 8);
    top.forEach((s, i) => {
      const p = projectPrism(s, cxp, cyp, mapW / 2, mapH / 2);
      if (p.x < 1 || p.x + 3 + FACE.w + 1 >= mapW || p.y < mapY + 7 || p.y >= mapY + mapH) return;
      plated(g, String(i + 1), p.x + 3, p.y - 6, INK.TARGET, 'map', 'index tag ' + (i + 1));
    });
    // the Y-gauge: 6 texels carrying the whole 60x160 minimap
    rect(g, gaugeX + 3, mapY + 2, 1, mapH - 4, INK.RULE);
    rect(g, gaugeX + 1, mapY + mapH / 2, 3, 1, INK.YOU);
    if (D.selStar) {
      const dy = (D.selStar.wy - D.player.y) / 0.002;
      rect(g, gaugeX, mapY + mapH / 2 - Math.max(-mapH / 2 + 2, Math.min(mapH / 2 - 2, dy * mapH / 2)), 5, 1, INK.TARGET);
    }
  }

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
    const axisY = Math.round(mapY + mapH * 0.62);
    const x0 = 8, x1 = mapW - 10;
    const winW = x1 - x0 - 8;
    rect(g, x0, axisY, x1 - x0, 1, INK.RULE);
    const shown = D.bodies.filter((b) => b.kind !== 'moon');
    const auMax = Math.max(1e-3, ...shown.map((b) => b.au), 1e-3);

    // ── THE VIRTUAL AXIS ─────────────────────────────────────────────────────────────────────────
    const vpx = (au) => Math.round(4 + (winW - 8) * Math.sqrt(Math.max(0, au) / auMax));
    const vx = [];
    let lastV = -99;
    for (const b of shown) { let v = vpx(b.au); if (v - lastV < 8) v = lastV + 8; lastV = v; vx.push(v); }
    const vMax = (vx.length ? vx[vx.length - 1] : 0) + 8;
    const maxScroll = Math.max(0, vMax - winW);
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

    // the star sits at virtual 0 and scrolls off with everything else
    if (vis(sx(0))) sprite(g, sx(0), axisY, SP.star7, SPECTRAL[D.sys?.star?.type] || '#fff');
    // ⭐ THE SYSTEM STAR IS A TARGET. It is the one mark on this ladder a pilot will certainly click,
    // and `ref: null` with `star: true` is how the picker tells it from a row of `D.bodies`.
    if (vis(sx(0))) hits.push({ x: sx(0), y: axisY, r: 4, ref: null, moon: -1, star: true });
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
      const tag = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i] || '?';
      T(g, tag, x - 2, axisY + 8, { color: b === D.selBody ? INK.KEY : INK.DIM, rgn: 'map', what: 'ladder tag ' + tag });
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
      T(g, `${first + 1}-${lastI + 1} OF ${shown.length}`, x1 - 4, axisY + 16,
        { color: INK.DIM, align: 'right', rgn: 'map', what: 'ladder window' });
    }
    if (vis(sx(0))) rect(g, sx(0) - 1, axisY - 1, 3, 3, INK.YOU);
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
    const hdr = ['SECTORS', 'TILES', 'TILES', 'STARS', 'BODIES'][S.level];
    T(g, hdr, x, y, { color: INK.KEY, rgn: 'rail', what: 'rail header' });
    const cnt = [String(D.sectorRows.length), '64', '256', `${D.starRows.filter(s=>s.isReal).length}/${fmtK(D.stars.length)}`,
                 String(D.bodies.length)][S.level];
    T(g, cnt, x + w, y, { color: INK.DIM, align: 'right', rgn: 'rail', what: 'rail count' });
    rect(g, x, y + LEAD - 1, w, 1, INK.RULE);

    const listRows = Math.max(2, rowCount - 9);
    // ⭐ PAGING, AND THE SPLIT IT OBEYS. The pager reads `1-27 OF 27524` and there has never been a way
    // to see the 28th. The CONTROL writes `S.listOffset`; THIS is the code that slices by it, and it
    // publishes what it actually sliced as `S.listGeom` so the pager label, the drawn rows and the row
    // picker cannot come apart. Exactly the `S.ladderScroll` / `S.ladderStops` split, one level up.
    // ⛔ AT OFFSET 0 EVERY SLICE BELOW IS `slice(0, listRows)` EXACTLY AS IT ALWAYS WAS, and the label
    //    reads `1-N OF T` exactly as it always did — nothing moves until a key is pressed.
    const total = [D.sectorRows.length, 64, 256, D.starRows.length, D.bodies.length][S.level];
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
      const s = D.playerSector;
      detail.push([s.name.toUpperCase(), INK.KEY],
        [`CENTRE  ${s.centerX.toFixed(1)}, ${s.centerZ.toFixed(1)}`, INK.BODY],
        [`SYSTEMS ${fmtK(estStars(s.centerX, s.centerZ, s.size))}`, INK.BODY],
        [`SPAN    ${s.size.toFixed(2)} KPC`, INK.BODY], ['', INK.BODY],
        [`YOU     ${fit(s.name.toUpperCase(), (cols - 8) * FACE.advance)}`, INK.YOU],
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
      const s = D.selStar;
      if (s) detail.push([fit(s.name.toUpperCase(), w), INK.KEY], [`${s.spectral}   ${s.isReal ? 'CATALOG' : 'PROCEDURAL'}`, INK.BODY],
        [`DIST   ${s.pc.toFixed(2)} PC`, INK.BODY], [`       ${s.ly.toFixed(1)} LY`, INK.BODY],
        [`PLANE  ${((s.wy - D.player.y) * 1000).toFixed(0)} PC`, INK.BODY],
        [`COMPS  ${s.mult > 1 ? 'MULTIPLE (' + s.mult + ')' : 'SINGLE'}`, INK.BODY],
        ['WARP ARMED', INK.TARGET]);
    } else {
      lines = D.bodies.slice(off, off + listRows).map((b, i) => ({
        txt: `${'123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[off + i] || '?'}${b.kind === 'moon' ? '-' : ' '}` +
             `${pad((b.kind === 'moon' ? ' ' : '') + b.name.toUpperCase(), cols - 14)} ` +
             `${rpad(b.au.toFixed(2), 5)} ${rpad(b.T ? Math.round(b.T) + 'K' : '—', 5)}`,
        bar: 0, sel: b === D.selBody }));
      const b = D.selBody;
      if (b) detail.push([fit(b.name.toUpperCase(), w), INK.KEY], [b.cls.toUpperCase(), INK.BODY],
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
    S.mapProj = null; S.prismHits = null; S.bodyHits = null; S.listGeom = null;
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

    // ── TOP BAR: tabs left, ONE locator right.  "Where am I" is answered here and nowhere else —
    //    today it is answered five ways in three visual languages.
    rect(g, 0, 0, W, BAR - 1, INK.BG); rect(g, 0, BAR - 1, W, 1, INK.RULE);
    let tx = 4;
    const tabRects = [];
    LEVELS.forEach((n, i) => {
      const w = measurePixelText(n);
      T(g, n, tx, 1, { color: i === S.level ? INK.KEY : INK.DIM, rgn: 'topbar', what: 'tab ' + n });
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

    // ── BOTTOM BAR: one 63-character status line, ' · '-joined so truncation eats the VERB first.
    rect(g, 0, H - BAR, W, 1, INK.RULE); rect(g, 0, H - BAR + 1, W, BAR - 1, INK.BG);
    const chipW = measurePixelText('[WARP]') + 6;
    const clauses = d2Status();
    const full = clauses.join(' · ') + (S.sabotage ? SAB : '');
    const avail = W - 8 - chipW - 4;
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
  function d2Status() {
    // ⭐ THE STATUS LINE NAMES THE SEARCH'S CONTROLS WHILE IT IS OPEN — this bar is the only place
    // design 2 says anything, so a field with no legend would be a field with no keys.
    if (S.search.open) return ['SEARCH', `${(S.search.rows || []).length} MATCHES`,
                               'UP DOWN MOVE', 'ENTER WARP', 'ESC CLOSE'];
    if (S.level === 0) return ['GALAXY', (D.playerSector?.name || '').toUpperCase(),
      `${fmtK(estStars(D.playerSector.centerX, D.playerSector.centerZ, D.playerSector.size))} SYSTEMS`, 'CLICK TO ENTER'];
    if (S.level <= 2) return [LEVELS[S.level], (D.playerSector?.name || '').toUpperCase(),
      `${rankMax(d1TileRows(levelView(S.level), levelView(S.level).n))} SYSTEMS IN BEST TILE`, 'CLICK TO ENTER'];
    if (S.level === 3) return S.list
      ? ['PRISM LIST', `NEAREST ${D.starRows.length}`, 'L=MAP', 'ENTER TO WARP']
      : ['PRISM', `VIEW ${(S.cam.radius * 2000).toFixed(1)} PC ACROSS`, `${D.stars.length} STARS`,
         'L=LIST', 'WASD PAN', 'R/F UP'];
    const b = D.selBody;
    return b ? [b.name.toUpperCase(), b.cls.toUpperCase(), `${b.au.toFixed(2)} AU`,
                b.T ? `${Math.round(b.T)} K` : '—', `${b.moons} MOONS`, ...(b.rings ? ['RINGED'] : [])]
             : ['SYSTEM', 'NO BODY SELECTED'];
  }
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
      frame(g, px - 2, py - 2, 5, 5, INK.YOU);
      for (const d of [[0, -4], [0, 4], [-4, 0], [4, 0]]) rect(g, px + d[0], py + d[1], d[0] ? 3 : 1, d[0] ? 1 : 3, INK.YOU);
      // ⭐ THE WIDE PROJECTION, PUBLISHED. `toX`/`toY` above are isotropic — the square is rendered at
      // the WIDE extent and cropped, so one world pixel is one texel in BOTH axes — which collapses
      // the whole inverse to an origin and a scale: wx = cx + (x - ox)*kpc, wz = cz + (y - oy)*kpc.
      // ⚠ THE VERTICAL FIELD IS ONLY ±(mapH/2)·kpc, so about half the disc is off the glass BY
      //   CONSTRUCTION. `clip` is the band that was actually painted; outside it a click is a miss.
      S.mapProj = { design: 2, level: S.level, kind: 'wide', ox: W / 2, oy: mapY + mapH / 2,
                    kpc: v.size / W, cx: v.cx, cz: v.cz, clip: { x: 0, y: mapY, w: W, h: mapH } };
      // ⭐ THE CLICK-HIGHLIGHT AT GALAXY (INTERFACE §5), AND THE ONE PLACE IT NEEDS A WORD OF DEFENCE.
      // ⛔ This branch draws NO cell grid — it is a full-bleed density field with sector dots on it —
      //    so there is no drawn rectangle to reuse and `kind: 'wide'` publishes no `n`. What IS
      //    unambiguous is the WORLD cell: GALAXY is the whole 44 kpc disc in both designs and the
      //    galaxy grid is 8x8 over it (`d1TwoD`'s `S.level === 0 ? 8`). So the cell's world bounds go
      //    through THIS design's own `toX`/`toY` and nothing about design 1's picture comes with them.
      // ⚠ It can land outside the painted band — the wide field is ±(mapH/2)·kpc and about half the
      //   disc is off the glass BY CONSTRUCTION — so it is deliberately NOT `assertMark`ed: that is
      //   the projection's documented crop, not a mark that escaped its pane.
      const pk0 = pickCell(S.level);
      if (pk0) {
        const gn = 8, gc = W / gn;
        frame(g, pk0.i * gc, mapY + mapH / 2 + (pk0.j / gn - 0.5) * W, gc, gc, INK.KEY);
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
      checker(g, bx + pi * cell + 1, mapY + pj * cell + 1, cell - 2, cell - 2, INK.YOU);
      frame(g, bx + pi * cell, mapY + pj * cell, cell, cell, INK.YOU);
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
    for (const { s, p } of onScreen) {
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
    for (const { s, p } of onScreen) {
      if (placed >= capN) break;
      if (!s.name || !s.isReal) continue;
      const txt = s.name.toUpperCase(), w = measurePixelText(txt);
      const ly = placeLabel(taken, p.x + 3, p.y - 6, w, REGIONS.map);
      if (ly == null) continue;                                  // not drawn — never faded
      rect(g, p.x + 1, Math.min(p.y, ly + 2), 1, Math.abs(ly + 2 - p.y) + 1, INK.RULE);
      plated(g, txt, p.x + 3, ly, INK.KEY, 'map', 'prism label ' + txt);
      placed++;
    }
    // the minimap — drawn AS SPECIFIED, a 40x24 widget in the corner of a design whose premise is
    // that there is no floating box anywhere. That contradiction is on the glass on purpose.
    const mw = 24, mh = 24, mx = W - 44, my = mapY + mapH - mh - 5;
    for (const d of [[0,0],[mw-3,0],[0,mh-3],[mw-3,mh-3]]) { rect(g, mx+d[0], my+d[1], 3, 1, INK.DIM); rect(g, mx+d[0], my+d[1], 1, 3, INK.DIM); }
    rect(g, mx + mw / 2, my + mh / 2, 1, 1, INK.YOU);
    rect(g, W - 17, my, 1, mh, INK.DIM);
    rect(g, W - 19, my + mh / 2, 5, 1, INK.YOU);
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
    hdr.forEach((h, i) => cols[i] < W - 8 && T(g, h, cols[i], mapY + 4, { color: INK.DIM, rgn: 'map', what: 'list header ' + h }));
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
    const cxp = Math.round(W / 2), cyp = Math.round(mapY + mapH / 2);
    const tagsTaken = [];
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
    const maxR = Math.min(W / 2 - 8, mapH / 2 / Math.max(TILT, SYS_MIN_SIN) - 4);
    const rOf = (au) => 8 + (maxR - 8) * Math.sqrt(Math.max(0, au) / auMax);
    for (const b of D.bodies) {
      if (b.kind === 'moon') continue;
      const r = rOf(b.au);
      dottedEllipse(g, cxp, cyp, r, r * TILT, INK.RULE, b.kind === 'belt' ? 5 : 2);
      assertMark('orbit ring ' + b.name, 'map', cxp - r, cyp - r * TILT, 2 * r, 2 * r * TILT);
    }
    sprite(g, cxp, cyp, SP.star7, SPECTRAL[D.sys?.star?.type] || '#fff');
    hits.push({ x: cxp, y: cyp, r: 4, ref: null, moon: -1, star: true });
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
      if (b.kind === 'belt') { hits.push({ x, y, r: 3, ref: b, moon: -1, star: false }); rect(g, x, y, 1, 1, INK.DIM); return; }
      hits.push({ x, y, r: 4, ref: b, moon: -1, star: false });
      sprite(g, x, y, b.rE > 4 ? SP.giant5 : SP.terr3, INK.BODY);
      if (b.rings) { rect(g, x - 3, y - 2, 7, 1, INK.DIM); rect(g, x - 3, y + 2, 7, 1, INK.DIM); }
      if (b.hab > 0.5) for (const d of [[-2,0],[2,0],[0,-2],[0,2]]) rect(g, x + d[0], y + d[1], 1, 1, INK.TARGET);
      if (b === D.selBody) frame(g, x - 4, y - 4, 9, 9, INK.KEY);
      // ⭐ THE MARK GUARD, ONE CALL PER BODY (see `assertMark`) — the union of what the four branches
      // ABOVE actually drew, off the same `x`/`y` they drew it from, never a worst-case box. A fixed
      // 9x9 would report the selection frame on bodies that never draw one, which is the guard crying
      // wolf; and the wolf here is real, so it has to be believable.
      const g0 = b.rE > 4 ? 2 : 1;                                     // giant5 vs terr3, half-extent
      let l = x - g0, t = y - g0, rr = x + g0, bb = y + g0;
      if (b.rings)     { l = Math.min(l, x - 3); rr = Math.max(rr, x + 3); t = Math.min(t, y - 2); bb = Math.max(bb, y + 2); }
      if (b.hab > 0.5) { l = Math.min(l, x - 2); rr = Math.max(rr, x + 2); t = Math.min(t, y - 2); bb = Math.max(bb, y + 2); }
      if (b === D.selBody) { l = x - 4; t = Math.min(t, y - 4); rr = Math.max(rr, x + 4); bb = Math.max(bb, y + 4); }
      assertMark('body mark ' + b.name, 'map', l, t, rr - l + 1, bb - t + 1);
      // The second and last folded publication, for the same reason as the ladder's: `mx`/`my` are
      // the one evaluation of `x + 4 + m * 2` and `y - 4`, and `rect()` gets exactly those values.
      for (let m = 0; m < b.moons; m++) { const mx = x + 4 + m * 2, my = y - 4; hits.push({ x: mx, y: my, r: 2, ref: b, moon: m, star: false }); rect(g, mx, my, 1, 1, INK.DIM); }
      // ⚠ THE PIP STRIP IS A SCREEN-SPACE BADGE and stays one — it does not turn with the orrery, by
      //   design. It still gets a box, because it is the ONE mark here whose length is data-driven: a
      //   moon-rich planet on the outermost orbit runs its pips off the right edge of the pane, and
      //   until now the canvas swallowed them.
      if (b.moons) assertMark('moon pips ' + b.name, 'map', x + 4, y - 4, (b.moons - 1) * 2 + 1, 1);
      const tag = roman(i + 1);
      if (r > 24) {
        const ly = placeLabel(tagsTaken, x + 4, y - 8, measurePixelText(tag), REGIONS.map);
        if (ly != null) plated(g, tag, x + 4, ly, INK.DIM, 'map', 'body tag ' + tag);
      }
    });
    // ⚠ THE SHIP DIAMOND HAS NO WORLD POSITION AT ALL — a bare `cxp + 8` screen offset — so under
    //   rotation it is the ONE mark on this orrery that visibly refuses to move. Logged, not invented:
    //   giving it a position would be this page guessing where the ship is in the system, and there is
    //   no such number in the pipeline to guess from.
    // ⚠ The ring bars, the moon pips and the habitability cross above are SCREEN-SPACE BADGES and stay
    //   that way, as do the selection frames. That is the low-fi idiom, not a mark that failed to turn.
    sprite(g, cxp + 8, cyp, SP.diam5, INK.TARGET);
    const far = (D.sys?.binarySeparationAU > 100) ? [`» ${(D.sysStar?.name || '').toUpperCase()} B ${Math.round(D.sys.binarySeparationAU)}AU`] : [];
    if (far.length) T(g, fit(far.join('  '), W - 8), 4, mapY + 1, { color: INK.DIM, rgn: 'map', what: 'companion strip' });
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
