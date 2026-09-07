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
  function fire(msg) {
    _violations++;
    const key = `${S.design}|${S.level}|${S.lines}|${FACE.name}|${msg}`;
    if (_fired.has(key)) return;
    _fired.add(key);
    const line = `NAV VIEW-MODE OVERFLOW [D${S.design} ${LEVELS[S.level]} ${S.lines}p ${FACE.name}] — ${msg}`;
    if (onViolation) onViolation(line, { design: S.design, level: S.level, lines: S.lines, msg });
  }

  const LEVELS = ['GALAXY', 'SECTOR', 'REGION', 'PRISM', 'SYSTEM'];

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
  /** A dotted ellipse, plotted texel by texel. This is literally what a fifth-generation orrery was. */
  function dottedEllipse(g, cx, cy, rx, ry, ink, every = 2) {
    const n = Math.max(24, Math.min(220, Math.round(2 * Math.PI * Math.max(rx, ry) / 2.2)));
    g.fillStyle = ink;
    for (let i = 0; i < n; i++) {
      if (i % every) continue;
      const t = (i / n) * Math.PI * 2;
      g.fillRect(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry), 1, 1);
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
  function levelView(level) {
    const p = D.player, sec = D.playerSector;
    if (level === 0) return { cx: 0, cz: 0, size: 44, n: 0 };
    if (level === 1) return { cx: sec.centerX, cz: sec.centerZ, size: sec.size, n: 8 };
    return { cx: p.x, cz: p.z, size: tileSize(p.x, p.z, 10000) * 16, n: 16 };
  }
  function tileSize(x, z, target) {                  // NavComputer._computeTileSize (:1596-1602)
    const R = Math.hypot(x, z), theta = Math.atan2(z, x || 1e-10);
    const d = D.gm.potentialDerivedDensity(R, 0, theta).totalDensity;
    if (d < 1e-10) return 0.02;
    const perPc3 = Math.max(0.001, d * DENSITY_TO_STARS_PER_PC3);
    return Math.cbrt(target / perPc3) / 1000;
  }

  // ── PRISM PROJECTION.  A fixed top-down-ish view; the real camera is rotatable and that is not what
  //    this page is measuring. Zoom stops are the four Design 2 and Design 3 both asked for.
  const ZOOM_STOPS = [0.0015, 0.003, 0.006, 0.01034];   // kpc — default, and the wheel ceiling
  function projectPrism(s, cx, cy, halfW, halfH, radius) {
    const dx = (s.wx - D.player.x) / radius, dz = (s.wz - D.player.z) / radius;
    const dy = (s.wy - D.player.y) / Math.max(radius, 1e-9);
    const rx = 0.92, tilt = 0.42;                      // a shallow tilt so height reads as a gap
    return { x: cx + dx * halfW * rx, y: cy + dz * halfH * tilt - dy * halfH * 0.55,
             py: cy + dz * halfH * tilt, depth: dz };
  }

  // DESIGN 1 — THE 71x40.  A character-cell nav computer: a map pane and a persistent ranked rail.
  // ════════════════════════════════════════════════════════════════════════════════════════════════
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
    const hints = ['CLICK A SECTOR OR A LIST ROW   [ ] SORT   / SEARCH   TAB LEVEL',
                   'CLICK A TILE OR A LIST ROW   [ ] SORT   / SEARCH   TAB LEVEL',
                   'CLICK A TILE OR A LIST ROW   [ ] SORT   / SEARCH   TAB LEVEL',
                   'CLICK A STAR OR A LIST ROW   [ ] SORT   / SEARCH   WASD PAN',
                   'SELECT A BODY   DRAG TO ROTATE   [ ] SORT   TAB LEVEL'];
    const hintFull = hints[S.level] + (S.sabotage ? SAB : '');
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
    const ids = d1TileRows(v, n).slice(0, 8);
    ids.forEach((t, i) => {
      const tx = ox + t.i * cell + 2, ty = mapY + t.j * cell + 2;
      if (cell < measurePixelText(t.id) + 3) return;
      plated(g, t.id, tx, ty, INK.DIM, 'map', 'tile id ' + t.id);
    });
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

  function d1Prism(g, mapW, mapY, mapH, gaugeX) {
    const radius = ZOOM_STOPS[S.zoomIdx | 0];
    const cxp = mapW / 2, cyp = mapY + mapH / 2;
    const shown = [];
    for (const s of D.starRows) {
      const p = projectPrism(s, cxp, cyp, mapW / 2, mapH / 2, radius);
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
    // ⭐ EIGHT SINGLE-CHARACTER INDEX TAGS instead of 139 labels of which 100 are already faded
    const top = D.starRows.slice(0, 9).filter((s) => s.dist > 1e-6).slice(0, 8);
    top.forEach((s, i) => {
      const p = projectPrism(s, cxp, cyp, mapW / 2, mapH / 2, radius);
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

    // the star sits at virtual 0 and scrolls off with everything else
    if (vis(sx(0))) sprite(g, sx(0), axisY, SP.star7, SPECTRAL[D.sys?.star?.type] || '#fff');
    const z = D.sys?.zones;
    if (z) {
      const a2 = Math.max(x0, sx(vpx(z.hzInnerAU))), b2 = Math.min(x1, sx(vpx(z.hzOuterAU)));
      if (b2 > a2) rect(g, a2, axisY + 2, Math.max(1, b2 - a2), 3, INK.YOU);
    }

    shown.forEach((b, i) => {
      const x = sx(vx[i]);
      if (!vis(x)) return;
      const ink = b === D.selBody ? INK.TARGET : INK.BODY;
      if (b.kind === 'belt') { for (let k = -6; k <= 6; k += 2) { if (vis(x + k)) rect(g, x + k, axisY, 1, 1, INK.DIM); } }
      else {
        sprite(g, x, axisY, b.rE > 4 ? SP.giant5 : SP.terr3, ink);
        if (b.rings) rect(g, Math.max(x0, x - 4), axisY, Math.min(9, x1 - x + 4), 1, INK.DIM);
        for (let m = 0; m < b.moons; m++) rect(g, x, axisY - 7 - m * 3, 1, 1, INK.DIM);
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
  }

  function d1Rail(g, x, y, w, cols, rowCount) {
    const LEAD = FACE.h + 1;
    const hdr = ['SECTORS', 'TILES', 'TILES', 'STARS', 'BODIES'][S.level];
    T(g, hdr, x, y, { color: INK.KEY, rgn: 'rail', what: 'rail header' });
    const cnt = [String(D.sectorRows.length), '64', '256', `${D.starRows.filter(s=>s.isReal).length}/${fmtK(D.stars.length)}`,
                 String(D.bodies.length)][S.level];
    T(g, cnt, x + w, y, { color: INK.DIM, align: 'right', rgn: 'rail', what: 'rail count' });
    rect(g, x, y + LEAD - 1, w, 1, INK.RULE);

    const listRows = Math.max(2, rowCount - 9);
    const detail = [];
    let lines = [];

    if (S.level === 0) {
      lines = D.sectorRows.slice(0, listRows).map((r, i) =>
        ({ txt: `${pad(String(i + 1), 2)} ${pad(r.s.name.toUpperCase(), cols - 16)} ${rpad(fmtK(r.n), 6)}`,
           bar: r.n / D.sectorRows[0].n, sel: r.s.id === D.playerSector?.id }));
      const s = D.playerSector;
      detail.push([s.name.toUpperCase(), INK.KEY],
        [`CENTRE  ${s.centerX.toFixed(1)}, ${s.centerZ.toFixed(1)}`, INK.BODY],
        [`SYSTEMS ${fmtK(estStars(s.centerX, s.centerZ, s.size))}`, INK.BODY],
        [`SPAN    ${s.size.toFixed(2)} KPC`, INK.BODY], ['', INK.BODY],
        [`YOU     ${fit(s.name.toUpperCase(), (cols - 8) * FACE.advance)}`, INK.YOU],
        [`TARGET  ${fit((D.target?.name || '—').toUpperCase(), (cols - 8) * FACE.advance)}`, INK.TARGET]);
    } else if (S.level === 1 || S.level === 2) {
      const v = levelView(S.level);
      const tiles = d1TileRows(v, v.n).slice(0, listRows);
      const idW = S.level === 2 ? 3 : 2;
      lines = tiles.map((t) => ({ txt: `${pad(t.id, idW)} ${pad('—', cols - idW - 13)} ${rpad(fmtK(t.n), 6)}`,
                                  bar: t.n / tiles[0].n, sel: false }));
      const t = tiles[0];
      detail.push([t.id, INK.KEY], [`CENTRE  ${t.x.toFixed(1)}, ${t.z.toFixed(1)}`, INK.BODY],
        [`SYSTEMS ${fmtK(t.n)}`, INK.BODY], [`SPAN    ${(v.size / v.n).toFixed(3)} KPC`, INK.BODY],
        ['', INK.BODY], [`YOU     ${d1PlayerTile(v)}`, INK.YOU], ['TARGET  —', INK.DIM]);
    } else if (S.level === 3) {
      lines = D.starRows.slice(0, listRows).map((s, i) => ({
        txt: `${i < 8 && s.dist > 1e-6 ? i + 1 : '·'} ${pad(s.name.toUpperCase() || 'UNNAMED', cols - 13)} ` +
             `${rpad(s.pc.toFixed(1), 5)} ${pad(s.spectral, 2)} ${s.mult > 1 ? s.mult : '·'}`,
        bar: 0, sel: s === D.selStar }));
      const s = D.selStar;
      if (s) detail.push([fit(s.name.toUpperCase(), w), INK.KEY], [`${s.spectral}   ${s.isReal ? 'CATALOG' : 'PROCEDURAL'}`, INK.BODY],
        [`DIST   ${s.pc.toFixed(2)} PC`, INK.BODY], [`       ${s.ly.toFixed(1)} LY`, INK.BODY],
        [`PLANE  ${((s.wy - D.player.y) * 1000).toFixed(0)} PC`, INK.BODY],
        [`COMPS  ${s.mult > 1 ? 'MULTIPLE (' + s.mult + ')' : 'SINGLE'}`, INK.BODY],
        ['WARP ARMED', INK.TARGET]);
    } else {
      lines = D.bodies.slice(0, listRows).map((b, i) => ({
        txt: `${'123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i] || '?'}${b.kind === 'moon' ? '-' : ' '}` +
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
    T(g, fit(`  1-${lines.length} OF ${[D.sectorRows.length, 64, 256, D.starRows.length, D.bodies.length][S.level]}   [ ] PAGE`, w),
      x, pagerY, { color: INK.DIM, rgn: 'rail', what: 'pager' });
    rect(g, x, pagerY + LEAD - 1, w, 1, INK.RULE);
    detail.forEach(([t, ink], i) => {
      if (!t) return;
      T(g, fit(t, w), x, pagerY + (i + 1) * LEAD, { color: ink, rgn: 'rail', what: 'detail ' + i });
    });
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
    if (S.level <= 2) d2TwoD(g, W, mapY, mapH);
    else if (S.level === 3) d2Prism(g, W, mapY, mapH);
    else d2System(g, W, mapY, mapH);

    // ── TOP BAR: tabs left, ONE locator right.  "Where am I" is answered here and nowhere else —
    //    today it is answered five ways in three visual languages.
    rect(g, 0, 0, W, BAR - 1, INK.BG); rect(g, 0, BAR - 1, W, 1, INK.RULE);
    let tx = 4;
    LEVELS.forEach((n, i) => {
      const w = measurePixelText(n);
      T(g, n, tx, 1, { color: i === S.level ? INK.KEY : INK.DIM, rgn: 'topbar', what: 'tab ' + n });
      if (i === S.level) rect(g, tx - 2, BAR - 2, w + 4, 1, INK.YOU);
      tx += w + 6;
    });
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
  }
  function d2Status() {
    if (S.level === 0) return ['GALAXY', (D.playerSector?.name || '').toUpperCase(),
      `${fmtK(estStars(D.playerSector.centerX, D.playerSector.centerZ, D.playerSector.size))} SYSTEMS`, 'CLICK TO ENTER'];
    if (S.level <= 2) return [LEVELS[S.level], (D.playerSector?.name || '').toUpperCase(),
      `${d1TileRows(levelView(S.level), levelView(S.level).n)[0].n} SYSTEMS IN BEST TILE`, 'CLICK TO ENTER'];
    if (S.level === 3) return S.list
      ? ['PRISM LIST', `NEAREST ${D.starRows.length}`, 'L=MAP', 'ENTER TO WARP']
      : ['PRISM', `VIEW ${(ZOOM_STOPS[S.zoomIdx | 0] * 2000).toFixed(1)} PC ACROSS`, `${D.stars.length} STARS`,
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
      const tiles = d1TileRows(v, n), max = tiles[0].n;
      for (const t of tiles) {
        const len = Math.round((cell - 4) * Math.min(1, t.n / max));
        if (len > 0) rect(g, bx + t.i * cell + 2, mapY + (t.j + 1) * cell - 2, len, 1, INK.DIM);
      }
      const pi = Math.floor(((D.player.x - v.cx) / v.size + 0.5) * n);
      const pj = Math.floor(((D.player.z - v.cz) / v.size + 0.5) * n);
      checker(g, bx + pi * cell + 1, mapY + pj * cell + 1, cell - 2, cell - 2, INK.YOU);
      frame(g, bx + pi * cell, mapY + pj * cell, cell, cell, INK.YOU);
    }
  }
  function d2Prism(g, W, mapY, mapH) {
    const radius = ZOOM_STOPS[S.zoomIdx | 0], cxp = W / 2, cyp = mapY + mapH / 2;
    if (S.list) return d2List(g, W, mapY, mapH);
    const cap = Math.max(200, Math.round(W * mapH / 160));
    let drawn = 0;
    const onScreen = [];
    for (const s of D.starRows) {
      const p = projectPrism(s, cxp, cyp, W / 2, mapH / 2, radius);
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
    const radius = ZOOM_STOPS[S.zoomIdx | 0], cxp = W / 2, cyp = mapY + mapH / 2;
    for (const s of D.starRows) {                      // the starfield, still there, knocked back
      const p = projectPrism(s, cxp, cyp, W / 2, mapH / 2, radius);
      if (p.x < 0 || p.x >= W || p.y < mapY || p.y >= mapY + mapH) continue;
      rect(g, p.x, p.y, 1, 1, INK.RULE);
    }
    checker(g, 0, mapY, W, mapH, INK.BG);              // one 50% parity pass — no alpha anywhere, and
                                                       // half the starfield survives, as the design says
    const LEAD = FACE.h + 1, rows = Math.floor((mapH - 4) / LEAD) - 1;
    const cols = [4, 22, 148, 166, 208, 250];
    const hdr = ['N', 'NAME', 'SP', 'PC', 'PLANE', 'SYSTEM'];   // '#' is not in the face; tofu would lie
    hdr.forEach((h, i) => cols[i] < W - 8 && T(g, h, cols[i], mapY + 4, { color: INK.DIM, rgn: 'map', what: 'list header ' + h }));
    D.starRows.slice(0, rows).forEach((s, i) => {
      const y = mapY + 4 + (i + 1) * LEAD;
      const sel = s === D.selStar;
      if (sel) rect(g, 2, y - 1, W - 4, LEAD, INK.KEY);
      const ink = sel ? INK.BG : (s.isReal ? INK.BODY : INK.DIM);
      const put = (c, str, maxw) => cols[c] < W - 10 &&
        T(g, fit(str, Math.min(maxw, W - cols[c] - 6)), cols[c], y, { color: ink, rgn: 'map', what: 'list row ' + i });
      put(0, String(i + 1), 16);
      put(1, (s.name || 'UNNAMED').toUpperCase(), 119);
      put(2, s.spectral, 11);
      put(3, s.pc.toFixed(2), 35);
      put(4, ((s.wy - D.player.y) * 1000).toFixed(0) + ' PC', 35);
      put(5, s.isReal ? 'CATALOG' : 'PROCEDURAL', 173);
    });
  }

  function d2System(g, W, mapY, mapH) {
    const cxp = Math.round(W / 2), cyp = Math.round(mapY + mapH / 2);
    const tagsTaken = [];
    const auMax = Math.max(1e-3, ...D.bodies.filter((b) => b.kind !== 'moon').map((b) => b.au));
    const maxR = Math.min(W / 2 - 8, mapH / 2 / 0.42 - 4);
    const rOf = (au) => 8 + (maxR - 8) * Math.sqrt(Math.max(0, au) / auMax);
    const TILT = 0.42;
    for (const b of D.bodies) {
      if (b.kind === 'moon') continue;
      const r = rOf(b.au);
      dottedEllipse(g, cxp, cyp, r, r * TILT, INK.RULE, b.kind === 'belt' ? 5 : 2);
    }
    sprite(g, cxp, cyp, SP.star7, SPECTRAL[D.sys?.star?.type] || '#fff');
    D.bodies.filter((b) => b.kind !== 'moon').forEach((b, i) => {
      const r = rOf(b.au), a = (i * 1.7 + 0.6);
      const x = Math.round(cxp + Math.cos(a) * r), y = Math.round(cyp + Math.sin(a) * r * TILT);
      if (b.kind === 'belt') { rect(g, x, y, 1, 1, INK.DIM); return; }
      sprite(g, x, y, b.rE > 4 ? SP.giant5 : SP.terr3, INK.BODY);
      if (b.rings) { rect(g, x - 3, y - 2, 7, 1, INK.DIM); rect(g, x - 3, y + 2, 7, 1, INK.DIM); }
      if (b.hab > 0.5) for (const d of [[-2,0],[2,0],[0,-2],[0,2]]) rect(g, x + d[0], y + d[1], 1, 1, INK.TARGET);
      if (b === D.selBody) frame(g, x - 4, y - 4, 9, 9, INK.KEY);
      for (let m = 0; m < b.moons; m++) rect(g, x + 4 + m * 2, y - 4, 1, 1, INK.DIM);
      const tag = roman(i + 1);
      if (r > 24) {
        const ly = placeLabel(tagsTaken, x + 4, y - 8, measurePixelText(tag), REGIONS.map);
        if (ly != null) plated(g, tag, x + 4, ly, INK.DIM, 'map', 'body tag ' + tag);
      }
    });
    sprite(g, cxp + 8, cyp, SP.diam5, INK.TARGET);
    const far = (D.sys?.binarySeparationAU > 100) ? [`» ${(D.sysStar?.name || '').toUpperCase()} B ${Math.round(D.sys.binarySeparationAU)}AU`] : [];
    if (far.length) T(g, fit(far.join('  '), W - 8), 4, mapY + 1, { color: INK.DIM, rgn: 'map', what: 'companion strip' });
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
