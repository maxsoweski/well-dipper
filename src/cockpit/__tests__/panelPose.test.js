/**
 * panelPose — lane F (cockpit-zoom-to-panel-2026-07-29), AC-POSE-DERIVED and
 * AC-EASE-LANDS-EXACTLY.
 *
 * Max's constraint for this whole workstream is one sentence: "let's make the
 * system for moving around these screens flexible so that it will not need to be
 * totally reworked if we update the position of the screens in the future." Lane E
 * is still re-fitting cockpit geometry — the panel face has already been FIVE
 * different sizes (0.450x0.300, 0.300x0.200, 0.246x0.205, 0.252x0.210, 0.240x0.200)
 * and its ASPECT has changed once, 3:2 to 6:5. So a solver with a distance baked
 * into it is not a style problem, it is a thing that will be wrong within the week.
 *
 * This file exists to make that unrepresentable, and there are four ways it tries:
 *
 * 1. THE ROUND TRIP. Solve a distance, then re-project the panel at that distance
 *    and measure what fraction of the view it covers. If the solver has a constant
 *    in it the round trip stops closing the moment the inputs move off whatever
 *    case the constant was fitted to.
 *
 * 2. TWO REAL PANEL SIZES, NOT ONE. Both sizes that have actually shipped on this
 *    project are fed in, and the distances must come out in the RATIO OF THEIR
 *    HEIGHTS. A function that returns the same number for a 0.450 m panel and a
 *    0.240 m panel passes any single-size test and is completely broken.
 *
 * 3. A PANEL WIDE ENOUGH TO MAKE WIDTH BIND. The two shipped panels are both
 *    TALLER than the 16:9 view is, relative to their width, so height binds for
 *    both — which means a solver hard-coded to height passes every test that uses
 *    only real panels. A 2.5:1 panel is included for exactly that reason.
 *
 * 4. THE SOURCE ITSELF. No literal distance, centre, normal or corner id. The scan
 *    is crude and evadable, and it is here as a backstop to the behavioural tests
 *    above rather than as the argument.
 *
 * ── WHY PIXEL FRACTION AND NOT ANGULAR FRACTION ─────────────────────────────
 *
 * "Fill the player's view" is a thing Max judges by eye, so the fraction that
 * matters is the fraction of the SCREEN the panel covers, not the fraction of the
 * field of view it subtends in angle. Those are different numbers, because a
 * perspective projection is not linear in angle:
 *
 *     pixel fraction  =  (height/2) / (d * tan(fov/2))        <- this one
 *     angular fraction = 2*atan((height/2)/d) / fov
 *
 * At the game's 70 degrees they differ by several percent at large fills, which is
 * visible. Solving the angular form would give a panel that measures correct on a
 * protractor and looks wrong on the glass, and the glass is the authority here.
 * AC-ZOOM-FILLS-THE-VIEW measures the rendered frame, so this module has to be
 * solving for the same quantity that AC measures or the two disagree by design.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { solveFillDistance, cubicOut, GAME_FOV_DEG } from '../panelPose.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The game's own field of view — src/ui/Settings.js:40. */
const FOV = 70;
/** 16:9, the aspect the cockpit lab letterboxes to so framing matches the game. */
const WIDE = 16 / 9;

/**
 * The two panel faces that have actually been in this repo, plus one shape chosen
 * to make the OTHER axis bind.
 *
 * The third is not a real panel and is not pretending to be. Both real ones are
 * relatively taller than a 16:9 view, so height binds for both, so a solver that
 * only ever looks at height is indistinguishable from a correct one on real data.
 */
const PANELS = [
  { label: 'lane E alpha, 6:5', width: 0.240, height: 0.200, expectBinds: 'height' },
  { label: 'the older model, 3:2', width: 0.450, height: 0.300, expectBinds: 'height' },
  { label: 'a letterbox panel, 2.5:1', width: 0.500, height: 0.200, expectBinds: 'width' },
];

const FILLS = [0.25, 0.5, 0.75, 0.9, 1.0];

/**
 * What fraction of the viewport the panel actually covers, once placed.
 *
 * This is the INDEPENDENT reading — written from the projection directly rather
 * than by calling anything in the module under test, so it can disagree with it.
 * A helper that reused the module's own arithmetic would agree with a broken
 * solver just as happily as with a correct one.
 */
function coverageAt(distance, { width, height }, fovDeg, aspect) {
  const halfV = Math.tan((fovDeg * Math.PI) / 180 / 2);
  return {
    vertical: (height / 2) / (distance * halfV),
    horizontal: (width / 2) / (distance * halfV * aspect),
  };
}

describe('solveFillDistance — the distance is solved, never typed', () => {
  it('places the panel so it covers exactly the fraction it was asked for', () => {
    for (const panel of PANELS) {
      for (const fill of FILLS) {
        const { distance } = solveFillDistance({ ...panel, fovDeg: FOV, aspect: WIDE, fill });
        const cover = coverageAt(distance, panel, FOV, WIDE);
        const binding = Math.max(cover.vertical, cover.horizontal);
        expect(binding, `${panel.label} at fill ${fill}`).toBeCloseTo(fill, 9);
      }
    }
  });

  it('never lets the OTHER axis overflow the view', () => {
    // The binding axis hits `fill` exactly; the other must come in under it, or
    // the panel is off the side of the screen while measuring correct on height.
    for (const panel of PANELS) {
      const { distance } = solveFillDistance({ ...panel, fovDeg: FOV, aspect: WIDE, fill: 1.0 });
      const cover = coverageAt(distance, panel, FOV, WIDE);
      expect(cover.vertical, `${panel.label} vertical`).toBeLessThanOrEqual(1 + 1e-9);
      expect(cover.horizontal, `${panel.label} horizontal`).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('reports which axis bound, and width really can bind', () => {
    for (const panel of PANELS) {
      const { bindingAxis } = solveFillDistance({ ...panel, fovDeg: FOV, aspect: WIDE, fill: 1.0 });
      expect(bindingAxis, panel.label).toBe(panel.expectBinds);
    }
  });

  it('returns DIFFERENT distances for the two panel sizes that have shipped', () => {
    // The whole point. Both are height-bound, so the distances must stand in the
    // ratio of their heights: 0.300 / 0.200 = 1.5. A solver with a constant in it
    // returns the same number twice and this is the assertion that says so.
    const small = solveFillDistance({ width: 0.240, height: 0.200, fovDeg: FOV, aspect: WIDE, fill: 1 });
    const large = solveFillDistance({ width: 0.450, height: 0.300, fovDeg: FOV, aspect: WIDE, fill: 1 });
    expect(large.distance).not.toBeCloseTo(small.distance, 6);
    expect(large.distance / small.distance).toBeCloseTo(0.300 / 0.200, 9);
  });

  it('moves the panel when the FOV changes and nothing else does', () => {
    const panel = { width: 0.240, height: 0.200 };
    const narrow = solveFillDistance({ ...panel, fovDeg: 50, aspect: WIDE, fill: 0.9 });
    const wide = solveFillDistance({ ...panel, fovDeg: 90, aspect: WIDE, fill: 0.9 });
    // A wider lens fits the same panel at a closer distance.
    expect(wide.distance).toBeLessThan(narrow.distance);
    // And each still covers the fraction it was asked for, at its own FOV.
    expect(coverageAt(narrow.distance, panel, 50, WIDE).vertical).toBeCloseTo(0.9, 9);
    expect(coverageAt(wide.distance, panel, 90, WIDE).vertical).toBeCloseTo(0.9, 9);
  });

  it('moves the panel when the viewport aspect changes, for a width-bound panel', () => {
    const panel = { width: 0.500, height: 0.200 };
    const wideView = solveFillDistance({ ...panel, fovDeg: FOV, aspect: 16 / 9, fill: 1 });
    const squareView = solveFillDistance({ ...panel, fovDeg: FOV, aspect: 1, fill: 1 });
    expect(squareView.distance).toBeGreaterThan(wideView.distance);
  });

  it('scales linearly with the panel, so a uniform re-fit needs no re-solve by hand', () => {
    // Lane E's SCREEN_FIT_SCALE is a UNIFORM scale on the whole screen assembly,
    // applied every time the cabin is re-proportioned. Under it the solved distance
    // must scale by exactly the same factor — that is what makes the angles Max
    // approved survive a re-fit, which is the property lane E built the uniform
    // scale to preserve in the first place.
    const k = 0.801 / 0.842; // an actual re-fit from this project's history
    const base = { width: 0.252, height: 0.210 };
    const scaled = { width: base.width * k, height: base.height * k };
    const a = solveFillDistance({ ...base, fovDeg: FOV, aspect: WIDE, fill: 0.9 });
    const b = solveFillDistance({ ...scaled, fovDeg: FOV, aspect: WIDE, fill: 0.9 });
    expect(b.distance / a.distance).toBeCloseTo(k, 12);
  });

  it('refuses input that would put the panel nowhere, loudly', () => {
    const ok = { width: 0.24, height: 0.2, fovDeg: FOV, aspect: WIDE, fill: 0.9 };
    // Zero is the value that matters: it is what an unmeasured panel reports, and
    // it turns the solve into Infinity rather than into an error anyone can read.
    expect(() => solveFillDistance({ ...ok, height: 0 })).toThrow(/height/);
    expect(() => solveFillDistance({ ...ok, width: 0 })).toThrow(/width/);
    expect(() => solveFillDistance({ ...ok, fill: 0 })).toThrow(/fill/);
    expect(() => solveFillDistance({ ...ok, fill: NaN })).toThrow(/fill/);
    expect(() => solveFillDistance({ ...ok, fovDeg: 0 })).toThrow(/fov/i);
    expect(() => solveFillDistance({ ...ok, fovDeg: 180 })).toThrow(/fov/i);
    expect(() => solveFillDistance({ ...ok, aspect: 0 })).toThrow(/aspect/);
    expect(() => solveFillDistance({ ...ok, height: undefined })).toThrow(/height/);
  });

  it('exposes the game FOV as a named value rather than leaving callers to type 70', () => {
    expect(GAME_FOV_DEG).toBe(70);
  });
});

describe('cubicOut — the travel lands, and lands firmly', () => {
  it('starts at 0 and ends at exactly 1', () => {
    // Exactly. A curve that ends at 0.9999999 leaves the panel a fraction of a
    // millimetre off the pose it was solved to reach, forever, and the error
    // accumulates across zoom/dismiss cycles.
    expect(cubicOut(0)).toBe(0);
    expect(cubicOut(1)).toBe(1);
  });

  it('never overshoots and never goes backwards', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      const v = cubicOut(i / 1000);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      prev = v;
    }
  });

  it('clamps outside [0,1] rather than flying off', () => {
    expect(cubicOut(-0.5)).toBe(0);
    expect(cubicOut(1.5)).toBe(1);
  });

  it('is cubic-out and NOT smoothstep', () => {
    // Max evaluated curves for AutopilotMotion and chose cubic-out over smoothstep
    // for its firmer terminal landing; smoothstep's symmetric tail read as mushy.
    // The two are trivially swapped and the swap is invisible in a diff summary,
    // so the distinction is asserted rather than left to a comment.
    const smoothstep = (t) => t * t * (3 - 2 * t);
    expect(cubicOut(0.5)).toBeCloseTo(0.875, 12);   // 1 - 0.5^3
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 12);
    // Front-loaded: cubic-out is well ahead of linear early on.
    expect(cubicOut(0.25)).toBeGreaterThan(0.5);
    // And its final approach is shallower than smoothstep's, which is the
    // "firmer landing" property — most of the distance is already covered.
    expect(cubicOut(0.9)).toBeGreaterThan(smoothstep(0.9));
  });
});

describe('panelPose — the source carries no geometry', () => {
  const SOURCE = readFileSync(join(HERE, '..', 'panelPose.js'), 'utf8');
  const CODE = SOURCE
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('imports nothing from three — the maths must be provable without a browser', () => {
    expect(CODE).not.toMatch(/from\s+['"]three['"]/);
    expect(CODE).not.toMatch(/\bimport\b/);
  });

  it('holds no baked panel geometry', () => {
    // The five face sizes this project has shipped, and the distances they were
    // measured at. Any of them appearing as a literal means the solve was
    // short-circuited for one particular cockpit.
    const BAKED = [
      '0.45', '0.30', '0.246', '0.205', '0.252', '0.210', '0.240', '0.200',
      '0.648', '0.681', '0.800', '0.744', '0.842', '0.801',
    ];
    for (const n of BAKED) {
      expect(CODE, `a literal ${n} in panelPose.js is baked geometry`).not.toContain(n);
    }
  });

  it('names no cockpit node', () => {
    expect(CODE).not.toMatch(/Screen_(UL|UR|LL|LR)/);
    expect(CODE).not.toMatch(/ScreenBody_/);
    expect(CODE).not.toMatch(/Eye_Point/);
  });
});
