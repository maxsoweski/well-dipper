/**
 * panelBufferRows — the pinned table.
 *
 * ⭐ EVERY EXPECTATION HERE IS A ROW COUNT AN EYE COULD CHECK, not a re-implementation of the
 * formula. The inputs are the cockpit's REAL geometry — the four screens are 0.24 x 0.20 m and sit
 * 0.800 m (upper pair) and 0.744 m (lower pair) from `Eye_Point` — so if the model or the derivation
 * moves, these numbers move and someone has to say why. Re-deriving the expectations from the code
 * under test would pin nothing at all.
 *
 * ⛔ INFO IS ON THE LOWER PAIR. The role map is NAV → Screen_UL and DRIVE → Screen_UR (upper,
 * d = 0.800); INFO → Screen_LL and TARGET → Screen_LR (lower, d = 0.744) — PanelLayout.js:53-56. A
 * previous handoff grouped INFO with the upper pair and derived a perfectly correct number off the
 * wrong input.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { panelBufferRows } from '../panelBufferRows.js';
import { derivePanelBuffer } from '../PanelHost.js';
import { RENDER_LINE_OPTIONS } from '../../rendering/renderLines.js';

/** The glass, in metres, as the shipped cockpit.glb measures. */
const SCREEN_W = 0.24;
const SCREEN_H = 0.20;
/** Eye distances, per pair. NAV/DRIVE are the upper pair; INFO/TARGET the lower. */
const D_UPPER = 0.800;
const D_LOWER = 0.744;
/** The shipped cockpit fov, and the default the settings slider starts on. */
const FOV = 70;

/**
 * `measureQuad`-shaped metrics for a screen `d` metres straight ahead of `eyePos`.
 * Built from the screen's own dimensions so the aspect is measured, never asserted.
 */
function screenAt(d, eyePos = { x: 0, y: 0, z: 0 }) {
  return {
    width: SCREEN_W,
    height: SCREEN_H,
    aspect: SCREEN_W / SCREEN_H,
    centre: { x: eyePos.x, y: eyePos.y, z: eyePos.z - d },
    normal: { x: 0, y: 0, z: 1 },
  };
}

const ORIGIN = { x: 0, y: 0, z: 0 };
const rowsFor = (d, bufferHeight, fovDeg = FOV, eyePos = ORIGIN) =>
  panelBufferRows(screenAt(d, eyePos), { eyePos, fovDeg, bufferHeight });

describe('panelBufferRows — the shipped table', () => {
  // ⭐ NARROWED 2026-09-07 with RENDER_LINE_OPTIONS, on Max's ruling that only 240/288/360 are
  // wanted as comparison options. The dropped rows were 144: 26/28, 180: 32/35, 480: 86/92,
  // 720: 129/138 — recorded here rather than deleted, because they are what this table must say
  // again if a mode ever comes back, and re-deriving them is how a wrong number gets in.
  // lines:               240  288  360
  const UPPER = { 240: 43, 288: 51, 360: 64 };
  const LOWER = { 240: 46, 288: 55, 360: 69 };

  it('covers exactly the offered render modes and nothing else', () => {
    // If a line count is ever added to the settings, this test tells you the table is short
    // rather than silently leaving the new mode unpinned.
    expect(Object.keys(UPPER).map(Number)).toEqual([...RENDER_LINE_OPTIONS]);
    expect(Object.keys(LOWER).map(Number)).toEqual([...RENDER_LINE_OPTIONS]);
  });

  for (const lines of RENDER_LINE_OPTIONS) {
    it(`NAV/DRIVE (d=${D_UPPER} m) get ${UPPER[lines]} rows at ${lines}p`, () => {
      expect(rowsFor(D_UPPER, lines)).toBe(UPPER[lines]);
    });
    it(`INFO/TARGET (d=${D_LOWER} m) get ${LOWER[lines]} rows at ${lines}p`, () => {
      expect(rowsFor(D_LOWER, lines)).toBe(LOWER[lines]);
    });
  }

  it('the lower pair is always at least as tall as the upper — it is nearer the eye', () => {
    for (const lines of RENDER_LINE_OPTIONS) {
      expect(rowsFor(D_LOWER, lines)).toBeGreaterThanOrEqual(rowsFor(D_UPPER, lines));
    }
  });
});

describe('panelBufferRows — fov moves it, and by the projection not the angle', () => {
  it('43 rows at the shipped 70 degrees, 240p', () => {
    expect(rowsFor(D_UPPER, 240, 70)).toBe(43);
  });
  it('64 rows at 50 degrees — a narrower fov magnifies the panel', () => {
    expect(rowsFor(D_UPPER, 240, 50)).toBe(64);
  });
  it('30 rows at 90 degrees', () => {
    expect(rowsFor(D_UPPER, 240, 90)).toBe(30);
  });

  it('⛔ is NOT the angular fraction, which would say 49 at 240p/70', () => {
    // The tempting-and-wrong form: the share of the vertical FIELD OF VIEW the face subtends.
    // A projection is linear in the tangent, not in the angle, so this overstates by ~14% —
    // six rows of glyphs finer than the screen can ever show.
    const angular = Math.round(
      (2 * Math.atan(SCREEN_H / 2 / D_UPPER)) / ((70 * Math.PI) / 180) * 240,
    );
    expect(angular).toBe(49);
    expect(rowsFor(D_UPPER, 240, 70)).toBe(43);
  });
});

describe('panelBufferRows — feeding derivePanelBuffer', () => {
  it('240p gives upper 43 x 52 and lower 46 x 55', () => {
    const upper = screenAt(D_UPPER);
    const lower = screenAt(D_LOWER);
    const view = { eyePos: ORIGIN, fovDeg: FOV, bufferHeight: 240 };
    expect(derivePanelBuffer(upper, panelBufferRows(upper, view))).toEqual({ width: 52, height: 43 });
    expect(derivePanelBuffer(lower, panelBufferRows(lower, view))).toEqual({ width: 55, height: 46 });
  });

  it('never returns something derivePanelBuffer refuses, even at the coarsest mode', () => {
    const far = { ...screenAt(50), centre: { x: 0, y: 0, z: -50 } };
    const rows = panelBufferRows(far, { eyePos: ORIGIN, fovDeg: 170, bufferHeight: 144 });
    expect(rows).toBe(1);
    expect(derivePanelBuffer(far, rows)).toEqual({ width: 1, height: 1 });
  });
});

describe('panelBufferRows — the eye is measured, never assumed to be the origin', () => {
  // ⭐ THE ASSUMPTION `CockpitRig._mountEye` REFUSES BY NAME. If this module ever starts treating
  // `centre` as a distance-from-origin, the seat moving would resize every panel against a
  // viewpoint nobody sits at, and the picture would still look plausible.
  it('an eye moved back to 0.4 m behind the origin makes a panel at the origin-relative distance SMALLER', () => {
    const eye = { x: 0, y: 0, z: 0.4 };
    // Same screen the origin-eye case uses: centre at z = -0.800. From this eye it is 1.200 m away.
    const metrics = screenAt(D_UPPER, ORIGIN);
    const moved = panelBufferRows(metrics, { eyePos: eye, fovDeg: FOV, bufferHeight: 240 });
    const atOrigin = panelBufferRows(metrics, { eyePos: ORIGIN, fovDeg: FOV, bufferHeight: 240 });
    expect(atOrigin).toBe(43);
    // 0.20 / 1.200 / (2 tan 35) * 240 = 28.56 → 29. An origin assumption would still say 43.
    expect(moved).toBe(29);
    expect(moved).toBeLessThan(atOrigin);
  });

  it('an eye offset sideways and up still measures the true 3D distance', () => {
    const eye = { x: 0.3, y: -0.4, z: 0 };
    // centre (0,0,-0.8) is hypot(0.3, 0.4, 0.8) = 0.9433981 m from that eye.
    const metrics = screenAt(D_UPPER, ORIGIN);
    const rows = panelBufferRows(metrics, { eyePos: eye, fovDeg: FOV, bufferHeight: 240 });
    expect(rows).toBe(36);
  });

  it('translating the eye and the panel together changes nothing — only the difference matters', () => {
    const eye = { x: -7, y: 2.5, z: 11 };
    expect(rowsFor(D_UPPER, 240, FOV, eye)).toBe(43);
    expect(rowsFor(D_LOWER, 240, FOV, eye)).toBe(46);
  });
});

describe('panelBufferRows — every guard throws, and names its input', () => {
  const view = { eyePos: ORIGIN, fovDeg: FOV, bufferHeight: 240 };
  const ok = screenAt(D_UPPER);

  it('a missing or non-finite face height', () => {
    expect(() => panelBufferRows({ ...ok, height: undefined }, view)).toThrow(/measured height/);
    expect(() => panelBufferRows({ ...ok, height: NaN }, view)).toThrow(/measured height/);
    expect(() => panelBufferRows({ ...ok, height: 0 }, view)).toThrow(/measured height/);
    expect(() => panelBufferRows({ ...ok, height: -0.2 }, view)).toThrow(/measured height/);
    expect(() => panelBufferRows(null, view)).toThrow(/measured height/);
  });

  it('a missing or malformed centre', () => {
    expect(() => panelBufferRows({ ...ok, centre: undefined }, view)).toThrow(/world-space centre/);
    expect(() => panelBufferRows({ ...ok, centre: { x: 0, y: 0 } }, view)).toThrow(/world-space centre/);
    expect(() => panelBufferRows({ ...ok, centre: { x: 0, y: NaN, z: -1 } }, view)).toThrow(/world-space centre/);
  });

  it('a missing view', () => {
    expect(() => panelBufferRows(ok, undefined)).toThrow(/needs a view/);
    expect(() => panelBufferRows(ok, 240)).toThrow(/needs a view/);
  });

  it("a missing eye — and it says why the origin is not a safe default", () => {
    expect(() => panelBufferRows(ok, { ...view, eyePos: undefined })).toThrow(/eye position/);
    expect(() => panelBufferRows(ok, { ...view, eyePos: undefined })).toThrow(/Eye_Point/);
    expect(() => panelBufferRows(ok, { ...view, eyePos: { x: 0, y: 0, z: NaN } })).toThrow(/eye position/);
  });

  it('an fov outside (0, 180)', () => {
    for (const fovDeg of [0, -70, 180, 400, NaN, Infinity, undefined, '70']) {
      expect(() => panelBufferRows(ok, { ...view, fovDeg })).toThrow(/vertical fov/);
    }
    expect(panelBufferRows(ok, { ...view, fovDeg: 179.9 })).toBeGreaterThanOrEqual(1);
  });

  it('a buffer height under one line — the state an unresized RetroRenderer publishes', () => {
    for (const bufferHeight of [0, 0.5, -240, NaN, Infinity, undefined, '240']) {
      expect(() => panelBufferRows(ok, { ...view, bufferHeight })).toThrow(/world buffer's height/);
    }
    expect(panelBufferRows(ok, { ...view, bufferHeight: 1 })).toBe(1);
  });

  it('a panel sitting at the eye — the state a remount taken mid-zoom would be measured in', () => {
    const atEye = { ...ok, centre: { x: 0, y: 0, z: 0 } };
    expect(() => panelBufferRows(atEye, view)).toThrow(/from the eye/);
    expect(() => panelBufferRows(atEye, view)).toThrow(/ZOOMED/);
  });
});

/**
 * ⭐ THE ONE PROPERTY THE WHOLE CHOICE OF NUMBER RESTS ON — AND IT IS MEASURED, NOT ASSERTED.
 *
 * `panelBufferRows` divides by the eye's RADIAL distance and treats the face as fronto-parallel.
 * The shipped screens are neither: they sit ~41.5 degrees off the view axis and they are tilted, so
 * the glass covers MORE rows than the formula asks for, and not even a constant number of them
 * across its own width. The module's header used to claim the opposite (that off-axis faces subtend
 * less) and that claim was wrong — a perspective projection divides by DEPTH, so an off-axis face is
 * stretched, not shrunk.
 *
 * That makes the authored count a FLOOR. Keeping it there is deliberate: under Nearest sampling
 * magnifying duplicates texels and minifying deletes them, and every glyph here has one-texel stems.
 * So the property that must hold — at every resolution and every fov, not merely at 240p/70 — is
 * ⛔ THE PANEL IS NEVER MINIFIED. This projects the real corners out of the shipped metrics sidecar
 * and checks it. If a screen is re-fitted or the eye moves, this goes red and someone has to look.
 *
 * The band is scale-free by construction: the authored count and the covered count both carry the
 * same `bufferHeight / (2*tan(fov/2))` factor, so it cancels. The sweep below is what proves that
 * rather than assuming it.
 */
describe('the authored buffer is a FLOOR against the glass it actually covers', () => {
  const METRICS = JSON.parse(
    readFileSync(new URL('../../../public/assets/cockpit/cockpit-metrics.json', import.meta.url), 'utf8'),
  );

  /** Rows of the world buffer the face's near and far vertical edges really span. */
  function coveredEdgeRows(screen, fovDeg, bufferHeight) {
    const k = (bufferHeight / 2) / Math.tan((fovDeg * Math.PI) / 360);
    const [c, w, h] = [screen.centre, screen.widthAxis, screen.heightAxis];
    // Corner rows, as three's PerspectiveCamera projects them: y over DEPTH, never over |c|.
    const row = (su, sv) => {
      const p = [0, 1, 2].map((i) => c[i] + w[i] * su * (screen.width / 2) + h[i] * sv * (screen.height / 2));
      return (p[1] / -p[2]) * k;
    };
    return [Math.abs(row(1, 1) - row(1, -1)), Math.abs(row(-1, 1) - row(-1, -1))];
  }

  it('the eye really is at the origin, so these projections are in eye space', () => {
    expect(METRICS.eyePoint).toEqual([0, 0, 0]);
    expect(METRICS.eyePointNodeName).toBe('Eye_Point');
  });

  it('the shipped screens are genuinely off-axis — the premise the old comment denied', () => {
    for (const s of METRICS.screens) {
      const radial = Math.hypot(...s.centre);
      const depth = Math.abs(s.centre[2]);
      expect(depth).toBeLessThan(radial); // off-axis: depth is the SHORTER of the two
      const offAxisDeg = (Math.acos(depth / radial) * 180) / Math.PI;
      expect(offAxisDeg).toBeGreaterThan(35);
      expect(offAxisDeg).toBeLessThan(50);
    }
  });

  it('never minifies — at every shipped resolution and across the fov range', () => {
    for (const bufferHeight of RENDER_LINE_OPTIONS) {
      for (const fovDeg of [50, 60, 70, 80, 90]) {
        for (const s of METRICS.screens) {
          const authored = panelBufferRows(
            { width: s.width, height: s.height, aspect: s.width / s.height,
              centre: { x: s.centre[0], y: s.centre[1], z: s.centre[2] } },
            { eyePos: { x: 0, y: 0, z: 0 }, fovDeg, bufferHeight },
          );
          const [near, far] = coveredEdgeRows(s, fovDeg, bufferHeight);
          expect(Math.min(near, far)).toBeGreaterThanOrEqual(authored);
        }
      }
    }
  });

  it('pins the magnification band, and that it does not move with resolution or fov', () => {
    // Scale-free PER SCREEN — the upper and lower pairs sit at different depths, so they have
    // different bands. Comparing across pairs is what the first draft of this test got wrong.
    const byScreen = new Map();
    for (const bufferHeight of RENDER_LINE_OPTIONS) {
      for (const fovDeg of [50, 70, 90]) {
        for (const s of METRICS.screens) {
          const [near, far] = coveredEdgeRows(s, fovDeg, bufferHeight);
          const exact = (s.height / Math.hypot(...s.centre)) / (2 * Math.tan((fovDeg * Math.PI) / 360)) * bufferHeight;
          if (!byScreen.has(s.name)) byScreen.set(s.name, []);
          byScreen.get(s.name).push([Math.min(near, far) / exact, Math.max(near, far) / exact]);
        }
      }
    }
    // Every (resolution, fov) pair yields the SAME pair of ratios for a given screen: the
    // `bufferHeight / (2*tan(fov/2))` factor is carried by both counts and cancels.
    for (const bands of byScreen.values()) {
      for (const [lo, hi] of bands) {
        expect(lo).toBeCloseTo(bands[0][0], 6);
        expect(hi).toBeCloseTo(bands[0][1], 6);
      }
    }
    // And the ratios are the MEASURED ones, pinned to four places per pair rather than to a tidy
    // two — a rounded bound is a bound nobody derived, and this is the number AC-9's verdict is
    // about. Upper pair (d = 0.800) and lower pair (d = 0.744) differ; they are not one band.
    const band = (name) => byScreen.get(name)[0].map((x) => +x.toFixed(4));
    expect(band('Screen_UL')).toEqual([1.2111, 1.5894]);
    expect(band('Screen_UR')).toEqual([1.2111, 1.5894]);
    expect(band('Screen_LL')).toEqual([1.1628, 1.5308]);
    expect(band('Screen_LR')).toEqual([1.1628, 1.5308]);
  });

  it('the named lever — authoring from the minimum covered edge — still never minifies', () => {
    // Max's eye may say the panels sit off the world's grid (AC-9). This is the one-line answer if
    // so: 51 rows upper, 53 lower. ⛔ FLOOR, NOT ROUND — the minimum covered edge is 51.9, and
    // rounding it to 52 would minify by a tenth of a row, which is the one thing the number exists
    // to prevent. Checked here so the lever is known to be safe before anyone pulls it.
    for (const s of METRICS.screens) {
      const [near, far] = coveredEdgeRows(s, 70, 240);
      const lever = Math.floor(Math.min(near, far));
      expect(lever).toBeGreaterThanOrEqual(51);
      expect(lever).toBeLessThanOrEqual(Math.min(near, far));
      // The 7x12 grid survives it: s = floor(min(H/43, W/49)) is still 1.
      const unit = Math.floor(Math.min(lever / 43, Math.round(lever * (s.width / s.height)) / 49));
      expect(unit).toBe(1);
    }
  });
});
