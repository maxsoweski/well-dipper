/**
 * navPixelType — the per-instance TYPE DRIVER that lets one NavComputer draw at panel resolution.
 *
 * ── THE PROBLEM ─────────────────────────────────────────────────────────────────────────────────
 *
 * `NavComputer` is 4446 lines with **44** `ctx.font = '<n>px "DotGothic16", monospace'` sites, and
 * the SAME class renders two surfaces: the ~1880x1040 DOM ORRERY overlay and the cockpit's NAV
 * panel, which AC-1 put on the world's pixel grid at **52 x 43**. An 11px vector face in a 43-row
 * canvas is a quarter of the panel's height per line; Max's screenshot of it is a smear of
 * overlapping giant type.
 *
 * ── ⭐ THE SEAM, AND WHY IT IS ONE SEAM RATHER THAN 44 ──────────────────────────────────────────
 *
 * The obvious edit is to convert all 44 sites to `drawPixelText`. That is 44 chances to convert 43
 * of them — and a HALF-converted panel is indistinguishable from a correctly-defaulted one on the
 * overlay, which is the exact failure mode this change cannot detect from its own output.
 *
 * So the interception is at the CONTEXT instead. When a host installs a driver, `render()` hands the
 * whole draw tree a Proxy over the real 2D context that:
 *
 *   · traps `font =` and records the requested pixel size;
 *   · traps `fillText` / `strokeText` and emits `drawPixelText` at the matching bitmap scale;
 *   · traps `measureText` and answers in the SAME face — which is what keeps the far-companion
 *     chips, the tooltip and the prism label solver sizing boxes that still contain their text;
 *   · forwards everything else — `fillRect`, `arc`, `drawImage`, `setLineDash`, `save`/`restore` —
 *     verbatim, so every graphic the nav computer draws is untouched.
 *
 * One seam, 44 sites, and no site can be missed because none of them was edited.
 *
 * ── ⛔ WHY THE DEFAULT IS `null` AND WHAT THAT GUARANTEES ───────────────────────────────────────
 *
 * With no driver, `render()` passes the RAW context and this module is never entered. The overlay's
 * pixels are therefore unchanged by construction rather than by inspection. ⚠ AND THAT IS EXACTLY
 * THE STATE A DEAD CODE PATH ALSO PRODUCES, which is why the change ships with a sabotage probe:
 * push the tier table to an obviously wrong scale, confirm the PANEL visibly moves and the OVERLAY
 * does not, revert. A control that has never been made to fail is not yet a control.
 *
 * ── ONE SCALE, AND WHY THE DISPLAY TIER WAS TAKEN BACK OUT (2026-09-08) ─────────────────────────
 *
 * The driver carries `unit` straight from `PhosphorScreen.typeScale(panelHeight).unit`, so NAV
 * lands on the same grid as DRIVE, INFO and TARGET rather than inventing one. It shipped for an
 * afternoon with a second, `2 * unit` DISPLAY tier for any request at or above 16px, on the reading
 * that `PhosphorScreen.typeUnits()` gives a five-row face two sizes.
 *
 * ⛔ THAT TIER WAS UNREACHABLE ON THE ONLY SURFACE THAT INSTALLS A DRIVER, and unreachable is worse
 * than absent because the header called it load-bearing. There is exactly ONE `>= 16px` request in
 * the whole class — `NavComputer.js`'s `'16px …'` for the current-system name — and it sits inside
 * a HUD block the panel withdraws under `_compact`. So `unit` was the only scale that ever ran, no
 * probe could move the display branch, and the live sabotage that "proved the driver" had pushed
 * BOTH branches at once and therefore isolated neither.
 *
 * ⚠ AND ROUTING A PANEL STRING THROUGH IT WOULD NOT HAVE BEEN A LEGIBILITY WIN. At `2 * unit` a
 * glyph advances 12 texels on a 52-texel panel: a display-tier title is FOUR CHARACTERS. The panel
 * is single-scale because 52 columns is what it has, not because the tier was hard to reach.
 *
 * ── ⛔ THE UNIT IS CAPPED BY THE CHROME, NOT ONLY BY THE BUFFER ─────────────────────────────────
 *
 * `navLayout`'s chrome SATURATES above 160 rows — that saturation is what keeps the DOM overlay's
 * pixels still — while `typeScale`'s unit keeps growing with the buffer. Past ~215 rows the two
 * diverge and the type outgrows the chrome it is drawn inside: at a 512-row panel (the lab's BUFFER
 * key, and 720 lines at fov 40 in the shipped Settings) the cap height is 55 rows against a 32-row
 * tab strip, so the five level-tab labels detach and draw 35 rows ABOVE the strip, across the map.
 * `navUnitCap` is the other half of the saturation: where the chrome stops growing, so does the
 * face. Below 160 rows it never binds, so all three shipped panel buffers are untouched.
 *
 * ── ⛔ `onMissing: 'tofu'`, DELIBERATELY, AND IT IS A DOWNGRADE FROM 'throw' ────────────────────
 *
 * `drawPixelText` defaults to `'throw'` so a fixed literal with an unmappable codepoint is loud.
 * That policy is right for a painter whose strings are all literals. It is wrong HERE, because this
 * one entry point carries both kinds: `'CURRENT SYSTEM'` (a literal) and `Barnard's Star` /
 * `PVX J4K7Q2M+9XP3RWZ b` (procedural and snapshot data) reach it through the same call. And a
 * throw is not loud on this surface — `PanelHost` catches a painter throw ONCE, logs, and stops
 * uploading the texture, so the glass keeps showing the LAST GOOD FRAME: a nav computer that looks
 * like it is working and has stopped. Tofu draws a box, the way a real font stack does, and the
 * panel keeps running. The known gap the ORRERY emits — `~` in `~1,234 SYSTEMS IN BLOCK` — is
 * closed in `PixelText` instead, which is where a missing glyph is actually fixed.
 *
 * ── ⛔ TRUNCATION IS A LAYOUT DECISION AND IT NEVER REACHES THE PIPELINE ────────────────────────
 *
 * Max, 2026-09-08: *"don't get rid of any code that allows you to display what we want to display."*
 * A string that will not fit is CLIPPED HERE, at the glass, one frame at a time. Every producer
 * upstream still returns the full string, and dropping the driver restores every character. No
 * formatter is shortened, no row is removed, nothing becomes unproducible.
 */

import { FACE, drawPixelText, measurePixelText } from '../rendering/PixelText.js';
import { navTabHeight, navDrawH, navCommitButton } from './navLayout.js';

/**
 * The largest bitmap scale the SATURATED chrome can actually hold, for a canvas of this size.
 *
 * Two text lines on the compact path sit inside a box the chrome fixes: the level-tab label, on a
 * baseline `round(tabH * 20 / 32)` down a strip that stops growing at 32 rows, and the `[ WARP ]` /
 * `[ BURN ]` label on `labelDy` inside a button that stops growing at 28. A glyph taller than
 * either baseline's drop has its cap row ABOVE the box, which is the tab labels detaching from the
 * strip. So the face may be no taller than the shorter of the two drops.
 *
 * ⚠ THIS NEVER BINDS ON A SHIPPED PANEL BUFFER — 43, 86 and 129 rows all give back the unit
 * `typeScale` already asked for. It binds from ~172 rows up, which is the lab's BUFFER key and the
 * high-resolution / narrow-fov corner of the game's own Settings.
 */
export function navUnitCap(w, h) {
  const tabDrop = Math.round((navTabHeight(h) * 20) / 32);
  const btnDrop = navCommitButton(w, navDrawH(h), h).labelDy;
  return Math.max(1, Math.floor(Math.min(tabDrop, btnDrop) / FACE.h));
}

/** `'11px "DotGothic16", monospace'` -> `11`. Returns NaN for anything unparseable. */
export function fontPx(font) {
  const m = /(-?[\d.]+)px/.exec(String(font ?? ''));
  return m ? Number(m[1]) : NaN;
}

/**
 * Wrap a 2D context so its text becomes bitmap text.
 *
 * ⚠ THE SHADOW STATE IS TRACKED HERE AND NOT READ BACK OFF THE CONTEXT. `font`, `textAlign` and
 * `fillStyle` are captured on the way through the `set` trap AND forwarded, rather than read with
 * `ctx.textAlign` at draw time. Two reasons, and the second one is the one that bites: a headless
 * recording context answers every unknown property with a function, so a read-back would hand the
 * aligner a function instead of `'center'`; and a real context normalises colours, so a read-back
 * would not round-trip a caller's own string.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{unit:number}} driver
 */
export function wrapPixelTypeCtx(ctx, driver) {
  const state = { px: 10, align: 'left', fill: '#ffffff' };
  const stack = [];

  // ⛔ ONE SCALE. `state.px` is still tracked and still forwarded, because a caller may read
  // `ctx.font` back; it just does not pick a size any more. See the header for why the display
  // tier came out.
  const scale = () => Math.max(1, Math.floor(driver.unit) || 1);

  /** How many texels a string may occupy before it would leave the glass, given the anchor. */
  const room = (x) => {
    const w = ctx.canvas ? ctx.canvas.width : Infinity;
    if (!Number.isFinite(w)) return Infinity;
    if (state.align === 'center') return Math.max(0, 2 * Math.min(x, w - x));
    if (state.align === 'right') return Math.max(0, x);
    return Math.max(0, w - x);
  };

  /** Clip a string to a texel budget. Layout only — the caller's string is untouched upstream. */
  const fit = (str, maxTexels) => {
    let s = String(str ?? '');
    if (!Number.isFinite(maxTexels)) return s;
    const sc = scale();
    while (s.length > 0 && measurePixelText(s, sc) > maxTexels) s = s.slice(0, -1);
    return s;
  };

  const emit = (str, x, y, maxWidth) => {
    const sc = scale();
    const budget = Number.isFinite(maxWidth) ? Math.min(maxWidth, room(x)) : room(x);
    const s = fit(str, budget);
    if (s.length === 0) return;
    drawPixelText(ctx, s, x, y - FACE.h * sc, {
      color: state.fill,
      scale: sc,
      align: state.align,
      // See the header: this one entry point carries literals AND procedural names, and a throw
      // here freezes the panel on its last good frame rather than reporting anything.
      onMissing: 'tofu',
    });
  };

  /** The first baseline at which a glyph of the current tier is fully on the glass. */
  const clampY = (y) => {
    const h = ctx.canvas ? ctx.canvas.height : Infinity;
    const cap = FACE.h * scale();
    if (!Number.isFinite(h)) return y;
    return Math.min(h, Math.max(cap, y));
  };

  const shim = {
    fillText: emit,
    strokeText: emit,
    measureText: (s) => ({ width: measurePixelText(String(s ?? ''), scale()) }),
    save: () => { stack.push({ ...state }); ctx.save(); },
    restore: () => { const p = stack.pop(); if (p) Object.assign(state, p); ctx.restore(); },
  };

  return new Proxy(ctx, {
    get(target, prop) {
      if (prop === '__navPixelType') return driver;
      if (prop === '__navFit') return fit;
      if (prop === '__navClampY') return clampY;
      if (prop === '__navTop') return 1 + FACE.h * scale();
      if (prop === '__navCap') return FACE.h * scale();
      if (Object.prototype.hasOwnProperty.call(shim, prop)) return shim[prop];
      if (prop === 'font') return `${state.px}px monospace`;
      if (prop === 'textAlign') return state.align;
      if (prop === 'fillStyle') return state.fill;
      const v = Reflect.get(target, prop);
      return typeof v === 'function' ? v.bind(target) : v;
    },
    set(target, prop, value) {
      if (prop === 'font') { const p = fontPx(value); if (Number.isFinite(p)) state.px = p; }
      else if (prop === 'textAlign') state.align = String(value);
      else if (prop === 'fillStyle') state.fill = value;
      try { Reflect.set(target, prop, value); } catch { /* a read-only stub property */ }
      return true;
    },
    has() { return true; },
  });
}
