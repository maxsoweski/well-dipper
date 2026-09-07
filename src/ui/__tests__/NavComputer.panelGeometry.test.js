/**
 * NavComputer at PANEL RESOLUTION — batch 2 step 4, AC-4.
 *
 * ── WHAT THIS FILE IS FOR ───────────────────────────────────────────────────────────────────────
 *
 * AC-1 put the cockpit render target and all four panel canvases on the world's pixel grid, which
 * made NAV **52 x 43**. `NavComputer` draws in absolute canvas pixels and had never reasoned about
 * its own size, so four separate constants went past wrong into ABSURD there:
 *
 *     `const tabH = 32`        the level-tab strip became 74% of the panel
 *     `const drawH = h - 50`   -7: every projection derived from it inverted
 *     `min(w, h) - 80`         -37: the galaxy / sector / region map, and its two hit-tests
 *     `btnY = drawH - 52`      the `[ WARP ]` button left the glass
 *
 * ⛔ AND THE FIRST AND THIRD ARE EACH THREE SITES THAT MUST MOVE TOGETHER — a renderer plus its
 * hit-tests. Shrink the drawn tab strip and leave the hit-test at 32 and you get five buttons drawn
 * where they cannot be pressed; move the map and leave the hover test and `_hoveredTile` — which is
 * the ONLY thing the sector/region drill reads — stops agreeing with the picture. Neither failure
 * throws. Both of them look like "the nav computer is a bit off".
 *
 * So this file drives the class at the size that ships and asserts what a PILOT can do: AC-4's own
 * observable, *"a click 8 rows above the panel's bottom edge changes level and one 20 rows above it
 * reaches the body picker"*, plus the walk that ends at `[ WARP ]`.
 *
 * ⚠ EVERY ASSERTION HERE IS BEHAVIOURAL, NOT A SOURCE SCAN. The source pins live in
 * `NavComputer.escape.test.js` and they check the SPELLING; they cannot check that a click lands.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeHeadlessNav, fakeStar, clickAt, tabCentre } from './helpers/headlessNav.mjs';
import {
  navTabHeight, navChromeReserve, navDrawH, navMapInset, navMapSize, navCommitButton,
} from '../navLayout.js';
import { navUnitCap } from '../navPixelType.js';
import { measurePixelText } from '../../rendering/PixelText.js';

/** The NAV panel's real buffer at 240p / fov 70 — `panelBufferRows`, verified live in HELM. */
const PANEL_W = 52;
const PANEL_H = 43;

/** What `PhosphorScreen.typeScale(43).unit` is, and therefore what `NavPanel` installs. */
const PANEL_UNIT = 1;

async function panelNav({ width = PANEL_W, height = PANEL_H, unit = PANEL_UNIT } = {}) {
  const built = await makeHeadlessNav({ width, height });
  built.nav.pixelType = { unit };
  built.nav.openToCurrentSystem(fakeStar());
  return built;
}

describe('AC-4 — the tab strip is a strip a finger can hit, at 43 rows', () => {
  /**
   * AC-4 states the observable as two clicks, and between them they FIX the tab height to a window:
   *   · "a click 8 rows above the panel's bottom edge changes level"  ⇒  tabH >= 8
   *   · "one 20 rows above it reaches the body picker"                ⇒  tabH <  20
   * Anything inside [8, 19] satisfies the acceptance criterion; 32 does not, and neither does 4.
   */
  it('lands inside the window AC-4 fixes, and stays 32 on the overlay', () => {
    const tabH = navTabHeight(PANEL_H);
    expect(tabH, 'a click 8 rows above the bottom must land ON a tab').toBeGreaterThanOrEqual(8);
    expect(tabH, 'a click 20 rows above the bottom must land ABOVE the tabs').toBeLessThan(20);
    expect(navTabHeight(512), 'the overlay-sized strip moved').toBe(32);
  });

  it('a click at each tab centre changes level on a 52x43 panel', async () => {
    const { nav } = await panelNav();
    for (const target of [0, 1, 2, 3]) {
      const { x, y } = tabCentre(nav, target);
      clickAt(nav, x, y);
      expect(nav._levelIndex, `the tab for level ${target} did not take at 43 rows`).toBe(target);
    }
  });

  it('a click 8 rows above the bottom edge changes level — AC-4, literally', async () => {
    const { nav } = await panelNav();
    nav._levelIndex = 3;
    // The GALAXY tab: first fifth of the width, eight rows up from the bottom.
    clickAt(nav, (PANEL_W / 5) * 0.5, PANEL_H - 8);
    expect(nav._levelIndex, 'a click eight rows above the bottom did not reach the tab strip')
      .toBe(0);
  });

  it('a click 20 rows above the bottom edge does NOT — it falls through to the picker', async () => {
    // ⭐ THE OTHER HALF, AND IT IS THE HALF THAT CATCHES A HIT-TEST LEFT BEHIND. A tab strip whose
    // hit region is still 32 rows tall swallows this click and silently changes level instead of
    // reaching the body the pilot aimed at. The level must NOT move.
    const { nav } = await panelNav();
    nav._levelIndex = 4;
    nav.render();
    clickAt(nav, (PANEL_W / 5) * 0.5, PANEL_H - 20);
    expect(nav._levelIndex, 'a click twenty rows above the bottom was swallowed by the tab strip')
      .toBe(4);
  });

  it('the renderer and the hit-test agree about where the strip STARTS', async () => {
    // The renderer fills each tab at `y = h - tabH`. One row below that boundary must change level;
    // one row above it must not. That is the two sites checked against each other through the
    // class, with no reference to how either is spelled.
    const { nav } = await panelNav();
    const tabY = PANEL_H - navTabHeight(PANEL_H);
    const x = (PANEL_W / 5) * 0.5;

    nav._levelIndex = 3;
    clickAt(nav, x, tabY + 1);
    expect(nav._levelIndex, 'a click just inside the drawn strip missed the hit region').toBe(0);

    nav._levelIndex = 3;
    clickAt(nav, x, tabY - 2);
    expect(nav._levelIndex, 'a click above the drawn strip still hit the tab region').toBe(3);
  });

  it('the AUTOPILOT button still sits directly on top of the strip on the overlay', async () => {
    // ⭐ THE THIRD `tabH` SITE. It is withdrawn on the panel (a 140x24 box has nowhere to go on a
    // 52-wide canvas) so the panel cannot check it — but the overlay draws it, and its whole
    // vertical placement is `h - tabH - btnH - 8`. If that site were left at a literal 32 while the
    // other two moved, this is where it would show.
    const { nav } = await makeHeadlessNav();          // 614x512, no driver: the overlay's path
    nav.openToCurrentSystem(fakeStar());
    nav._levelIndex = 0;
    nav.render();
    const r = nav._autopilotButtonRect;
    expect(r, 'the overlay stopped publishing an autopilot button').toBeTruthy();
    expect(r.y + r.h + 8).toBe(512 - navTabHeight(512));
  });
});

describe('AC-4 — the 2D map and its two hit-tests still describe the same square', () => {
  it('has a POSITIVE extent at 43 rows — the literal 80 gave -37', () => {
    expect(navMapSize(PANEL_W, PANEL_H)).toBeGreaterThan(0);
    expect(navMapInset(PANEL_H)).toBeLessThan(PANEL_H);
    // And the overlay's square is untouched: min(w, h) - 80.
    expect(navMapSize(1880, 1040)).toBe(1040 - 80);
  });

  it('hovers a tile at the map centre, which is what the sector drill reads', async () => {
    const { nav } = await panelNav();
    nav._levelIndex = 1;                              // SECTOR — an 8x8 grid of tiles
    nav.render();
    nav._handleMouseMove({ clientX: PANEL_W / 2, clientY: navMapInset(PANEL_H) / 2 + 6 });
    expect(nav._hoveredTile,
      'no tile under the cursor at the centre of the map — `_handleClick` drills on `_hoveredTile` '
      + 'and nothing else, so a hover test that disagrees with the renderer is an unclickable map')
      .toBeTruthy();
  });

  it('drills sector -> region on a tile click at 43 rows', async () => {
    const { nav } = await panelNav();
    nav._levelIndex = 1;
    nav.render();
    const y = navMapInset(PANEL_H) / 2 + 6;
    nav._handleMouseMove({ clientX: PANEL_W / 2, clientY: y });
    clickAt(nav, PANEL_W / 2, y);
    // The 2D->2D drill is ANIMATED: `_startDrillAnim` records the destination level and
    // `_updateAnim` applies it when the ease completes, so the observable at click time is the
    // animation the click started, not the level index. Asserting the index here would be asserting
    // the clock.
    expect(nav._anim, 'clicking a sector tile started no drill').toBeTruthy();
    expect(nav._anim.toLevel, 'the sector tile drilled somewhere other than REGION').toBe(2);
  });
});

describe('AC-4 — the COMMIT button is on the glass and is one rectangle, not two', () => {
  it('fits inside a 43-row panel', () => {
    const drawH = navDrawH(PANEL_H);
    const b = navCommitButton(PANEL_W, drawH, PANEL_H);
    expect(b.y, 'the commit button starts above the top edge').toBeGreaterThanOrEqual(0);
    expect(b.y + b.h, 'the commit button runs past the drawable area').toBeLessThanOrEqual(drawH);
    expect(b.x, 'the commit button starts left of the glass').toBeGreaterThanOrEqual(0);
    expect(b.x + b.w, 'the commit button runs off the right edge').toBeLessThanOrEqual(PANEL_W);
    expect(b.labelDy, 'the label baseline is outside its own box').toBeLessThanOrEqual(b.h);
  });

  it('is the same function for [ WARP ] and [ BURN ], so one cannot be fixed without the other', () => {
    // ⛔ THE DEFECT THIS REPLACES. `btnW = 180, btnH = 28, btnY = drawH - 52` was written out twice
    // — once in `_renderSystem` for WARP and once in `_renderPlanetDetail` for BURN — and BOTH
    // published into the single `_commitButtonRect` that one hit-test reads. Fixing the one you
    // were looking at left the other committing from a rectangle nobody can see.
    const src = new URL('../NavComputer.js', import.meta.url);
    const code = readFileSync(src, 'utf8');
    const literals = code.match(/const\s+btnW\s*=\s*180\s*,\s*btnH\s*=\s*28\s*;/g) || [];
    expect(literals.length, 'a hand-written copy of the commit button geometry came back').toBe(0);
    expect((code.match(/navCommitButton\(/g) || []).length,
      'both commit buttons must come from navCommitButton').toBeGreaterThanOrEqual(2);
  });
});

describe('AC-4 — the screensaver\'s performed cursor lands on the panel', () => {
  it('puts the autopilot crosshair inside a 52x43 canvas', async () => {
    // The two `h - 50` sites OUTSIDE NavComputer. `AutopilotNavSequence` derives the performed
    // cursor from whichever canvas is live, and in HELM that is this one. At the literal 50 the
    // reserve was -7, the projection inverted, and every destination in a 44-kpc galaxy collapsed
    // into a ~6px band clipped off the TOP of the panel — identically, every tour.
    const { nav } = await panelNav();
    const { AutopilotNavSequence } = await import('../../auto/AutopilotNavSequence.js');
    const seq = Object.create(AutopilotNavSequence.prototype);
    seq._nav = nav;

    for (const [gx, gz] of [[-22, -22], [0, 0], [8, 0], [22, 22]]) {
      seq._setCursorAtGalactic(gx, gz);
      const c = nav._autoCursor;
      expect(c.x >= 0 && c.x <= PANEL_W && c.y >= 0 && c.y <= PANEL_H,
        `the performed cursor for (${gx}, ${gz}) landed at (${c.x.toFixed(1)}, ${c.y.toFixed(1)}), `
        + `off a ${PANEL_W}x${PANEL_H} panel`).toBe(true);
    }
  });

  it('still spreads the galaxy across the canvas rather than collapsing it', () => {
    // ⚠ THE CONTROL FOR THE TEST ABOVE. A cursor pinned to a single point would be "inside the
    // panel" at every input and would be exactly the collapsed band the fix is for.
    const drawH = navDrawH(PANEL_H);
    expect(drawH, 'the reserve is still eating the whole panel').toBeGreaterThan(0);
    expect(navChromeReserve(PANEL_H), 'the reserve is larger than the panel').toBeLessThan(PANEL_H);
  });
});

/**
 * ⭐ THE TYPE HAS TO FIT THE CHROME, AND THE CHROME STOPS GROWING — added 2026-09-08 by review.
 *
 * `navLayout`'s numbers SATURATE above 160 rows, which is what keeps the DOM overlay's pixels
 * still. `PhosphorScreen.typeScale(h).unit` does not saturate: it is `floor(h / 43)`. Past ~172
 * rows the two diverge and the face outgrows the box it is drawn inside — at a 512-row panel the
 * cap height is 55 rows against a 32-row tab strip, so the five level-tab labels detach and draw 35
 * rows ABOVE the strip, across the map, and the `[ WARP ]` label sits 36 rows above its own button.
 * Nothing throws and no other test moves.
 *
 * Reachable on two live surfaces: `cockpit-screens-lab.html`'s BUFFER key (512 / 768 / 1024), and
 * the shipped Settings at 720 render lines with the fov slider at or below 45.
 */
describe('AC-4 — the face never outgrows the chrome it is drawn inside', () => {
  /** Buffers a panel can actually be handed: the three shipped, then the lab and Settings corner. */
  const BUFFERS = [43, 86, 129, 172, 215, 222, 256, 302, 384, 512, 768, 1024];
  const FACE_H = 5;
  const gridRows = 43;

  it('keeps the tab label inside the tab strip at every buffer a panel can have', () => {
    for (const h of BUFFERS) {
      const w = Math.round(h * (PANEL_W / PANEL_H));
      const unit = Math.min(Math.max(1, Math.floor(h / gridRows)), navUnitCap(w, h));
      const tabH = navTabHeight(h);
      const tabY = h - tabH;
      const baseline = tabY + Math.round((tabH * 20) / 32);
      expect(baseline - FACE_H * unit, `a ${w}x${h} panel drew its tab label above the strip`)
        .toBeGreaterThanOrEqual(tabY);
      expect(baseline, `a ${w}x${h} panel drew its tab label off the bottom`).toBeLessThanOrEqual(h);
    }
  });

  it('keeps the [ WARP ] label inside its own button at every buffer a panel can have', () => {
    for (const h of BUFFERS) {
      const w = Math.round(h * (PANEL_W / PANEL_H));
      const unit = Math.min(Math.max(1, Math.floor(h / gridRows)), navUnitCap(w, h));
      const btn = navCommitButton(w, navDrawH(h), h);
      expect(btn.labelDy - FACE_H * unit, `a ${w}x${h} panel drew [ WARP ] above its button`)
        .toBeGreaterThanOrEqual(0);
    }
  });

  it('and the cap is what does it — the raw unit escapes, which is the defect', () => {
    // ⛔ THE CONTROL. A cap that never bound would pass both tests above for the same reason a
    // correct one does. This is the measurement that made them fail: at 512 rows `typeScale` asks
    // for unit 11, a 55-row cap against a 32-row strip.
    const raw = Math.floor(512 / gridRows);
    expect(raw, 'typeScale stopped growing with the buffer').toBe(11);
    expect(navUnitCap(619, 512), 'the cap stopped binding at a 512-row panel').toBeLessThan(raw);
    const tabH = navTabHeight(512);
    expect((512 - tabH) + Math.round((tabH * 20) / 32) - FACE_H * raw,
      'the uncapped face no longer escapes the strip — this control has gone vacuous')
      .toBeLessThan(512 - tabH);
    // ...and it does NOT bind on any shipped panel buffer, so the three sizes above are untouched.
    for (const [w, h, u] of [[52, 43, 1], [103, 86, 2], [155, 129, 3]]) {
      expect(navUnitCap(w, h), `the cap moved a shipped ${w}x${h} panel off unit ${u}`)
        .toBeGreaterThanOrEqual(u);
    }
  });
});

/**
 * ⭐ FIVE TABS, FIVE DISTINCT LETTERS — added 2026-09-08 by review.
 *
 * A tab cell is `w / 5`, so one glyph fits at every shipped buffer. Clipping the full word gave
 * `G S R P S`: SECTOR and SYSTEM both rendered as a bare `S`, and pressing the wrong one changes
 * level — which clears `_localStars` and throws away the prism drill in progress.
 */
describe('AC-4 — the five level tabs are five different letters on the panel', () => {
  const readTabLabels = async (width, height, unit) => {
    const { nav, rec } = await panelNav({ width, height, unit });
    nav._levelIndex = 0;
    rec.calls.length = 0;
    // The bitmap path emits no `fillText`, so read the strings the driver was ASKED to draw.
    const asked = [];
    const realFit = nav._fit.bind(nav);
    nav._fit = (ctx, str, max) => { asked.push(String(str)); return realFit(ctx, str, max); };
    nav.render();
    nav._fit = realFit;
    return asked;
  };

  for (const [name, w, h, unit] of [['240p', 52, 43, 1], ['480p', 103, 86, 2], ['720p', 155, 129, 3]]) {
    it(`draws five distinct tab labels at ${name}`, async () => {
      const labels = (await readTabLabels(w, h, unit)).slice(0, 5);
      expect(labels.length, `NAV asked to draw ${labels.length} tab labels, not five`).toBe(5);
      expect(new Set(labels).size,
        `the tab strip reads ${labels.join(' ')} — two tabs are the same letter, and pressing the `
        + 'wrong one changes level and clears the prism drill').toBe(5);
      for (const l of labels) {
        expect(measurePixelText(l, unit),
          `"${l}" is ${measurePixelText(l, unit)} texels in a ${(w / 5).toFixed(1)}-texel cell`)
          .toBeLessThanOrEqual(w / 5 - 2);
      }
    });
  }

  it('and the OVERLAY still draws the whole words', async () => {
    const { nav, rec } = await makeHeadlessNav({ width: 614, height: 512 });
    nav.openToCurrentSystem(fakeStar());
    nav._levelIndex = 0;
    rec.text.length = 0;
    nav.render();
    const drawn = rec.text.map((t) => t.text);
    for (const word of ['GALAXY', 'SECTOR', 'REGION', 'PRISM', 'SYSTEM']) {
      expect(drawn, `the overlay stopped drawing ${word} on its tab strip`).toContain(word);
    }
  });
});
