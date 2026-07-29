/**
 * NavComputer — the escape rework.
 *
 * Lane F, workstream `cockpit-zoom-to-panel-2026-07-29`: AC-NO-STUCK-STATE,
 * AC-STRINGS-TELL-THE-TRUTH, and the source half of AC-ESC-DISMISSES-EVERYWHERE.
 *
 * Max, 2026-07-29: "After we bring up the nav computer, esc should just dismiss
 * it, retracting it back to its original position. Let's change the behavior so
 * we just manually click through the different nav levels and esc is not wired to
 * that function." Asked whether that meant the cockpit panel only or the ORRERY
 * overlay too, he chose EVERYWHERE — one meaning for ESC wherever the nav
 * computer is drawn.
 *
 * ── THIS FILE DRIVES THE REAL CLASS ────────────────────────────────────────
 *
 * Not a stub, not a source scan. `helpers/headlessNav.mjs` builds an actual
 * NavComputer in plain node, which the codebase asserted was impossible — the
 * claim is quoted and disproved in that file's header. It matters here because
 * unwiring ESC removes the ONLY route out of four of the five levels, and the
 * question "can the player still get back" is exactly the kind that a source scan
 * answers confidently and wrongly.
 *
 * ── WHAT IS DELIBERATELY *NOT* CHANGED ─────────────────────────────────────
 *
 * RIGHT-CLICK. `_handleClick` treats `e.button === 2` as an escape and calls
 * `handleEscape()`, and that stays. Max named ESC; right-click-to-go-back is a
 * different, shipped affordance and removing it was not asked for. So
 * `handleEscape` survives with exactly one caller, and the minimal change is a
 * single line in main.js rather than surgery on this class. A method named
 * `handleEscape` that Escape no longer calls is a trap for the next reader, which
 * is why it is asserted here rather than left to be discovered.
 *
 * (On the cockpit panel right-click is already inert and stays so: the synthetic
 * `PANEL_POINTER_EVENT` carries no `button` at all, on purpose.)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  makeHeadlessNav, fakeStar, clickAt, tabCentre, TAB_H,
} from './helpers/headlessNav.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

const SELF_CODE = readFileSync(join(HERE, 'NavComputer.escape.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
// Assembled from fragments so the pattern cannot match itself, and covering the
// options form and `.each`, both of which vitest 4.1 honours and the previous
// workstream's DISABLED_RE missed.
const DISABLED_RE = new RegExp(
  ['describe', 'it', 'test'].flatMap((k) => [
    k + '\\.skip', k + '\\.only', k + '\\.todo', k + '\\.concurrent\\.only',
    k + '\\.only\\.each', k + '\\.skip\\.each',
  ]).concat(['\\{\\s*skip\\s*:\\s*true', '\\{\\s*only\\s*:\\s*true']).join('|'),
);
if (DISABLED_RE.test(SELF_CODE)) {
  throw new Error(
    'NavComputer.escape.test.js disables one of its own tests. This runs at module scope, ' +
    'during collection, because a self-scan written as a test is one of the tests a focus ' +
    'helper skips — measured on a sibling file, which reported "1 passed | 6 skipped" and ' +
    'exited green.',
  );
}

describe('the escape rework — ESC is unwired from level navigation', () => {
  it('main.js no longer routes Escape through handleEscape', () => {
    // The whole behavioural change is one line at the ESC cascade. Checked as
    // source because main.js is 10,972 lines and is not importable in a unit
    // test; the BEHAVIOUR is checked live under AC-ESC-DISMISSES-EVERYWHERE.
    const main = readFileSync(join(REPO, 'src', 'main.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(main, 'the Escape cascade still walks the nav level stack')
      .not.toMatch(/handleEscape\s*\(\s*\)/);
  });

  it('keeps handleEscape alive for RIGHT-CLICK, which Max did not ask to change', () => {
    const src = readFileSync(join(REPO, 'src', 'ui', 'NavComputer.js'), 'utf8');
    expect(src, 'right-click-to-go-back was removed as collateral')
      .toMatch(/e\.button\s*===\s*2[\s\S]{0,120}handleEscape\s*\(\s*\)/);
  });

  it('right-click still walks back a level, driven on the real class', async () => {
    const { nav } = await makeHeadlessNav();
    nav.openToCurrentSystem(fakeStar());
    expect(nav._levelIndex).toBe(4);
    // Right-click away from the tab strip, so the tab handler cannot be what moved it.
    clickAt(nav, 100, 100, { button: 2 });
    expect(nav._levelIndex, 'right-click no longer goes back').toBe(3);
  });
});

describe('AC-NO-STUCK-STATE — every state has a click route out', () => {
  let nav;
  beforeEach(async () => {
    ({ nav } = await makeHeadlessNav());
    // Chromed, which is what the panel is whenever it is zoomed — the only state
    // in which the player is clicking any of this.
    nav.chromeless = false;
  });

  it('the tab strip walks DOWN from the deepest level to the shallowest', () => {
    nav.openToCurrentSystem(fakeStar());
    expect(nav._levelIndex).toBe(4);
    // 4 -> 3 -> 2 -> 1 -> 0, the route ESC used to provide.
    for (const target of [3, 2, 1, 0]) {
      const { x, y } = tabCentre(nav, target);
      clickAt(nav, x, y);
      expect(nav._levelIndex, `the tab for level ${target} did not take`).toBe(target);
    }
  });

  it('the tab strip walks UP again, so no level is one-way', () => {
    nav.openToCurrentSystem(fakeStar());
    const { x, y } = tabCentre(nav, 0);
    clickAt(nav, x, y);
    expect(nav._levelIndex).toBe(0);
    for (const target of [1, 2, 3]) {
      const t = tabCentre(nav, target);
      clickAt(nav, t.x, t.y);
      expect(nav._levelIndex, `could not climb back to level ${target}`).toBe(target);
    }
  });

  it('planet detail returns to the system view on a click in empty space — FOREIGN system', () => {
    nav.openToCurrentSystem(fakeStar());
    nav._systemMode = 'planet';
    nav._selectedPlanetIdx = 0;
    nav._hoveredBody = null; // empty space
    clickAt(nav, nav._canvas.width / 2, 60);
    expect(nav._systemMode, 'planet detail is a dead end without ESC').toBe('system');
  });

  it('planet detail returns to the system view on a click in empty space — CURRENT system', () => {
    // BOTH arms, because `_handleClick` branches on `_isCurrentSystem()` and the
    // two write `_systemMode = 'system'` in separate places. Covering only the
    // foreign one is not a hypothetical gap: deleting the CURRENT arm's assignment
    // left the whole suite green until this test existed.
    const star = fakeStar();
    nav.openToCurrentSystem(star);
    nav._playerX = star.wx; nav._playerY = star.wy; nav._playerZ = star.wz;
    expect(nav._isCurrentSystem(), 'the fixture is not actually the current system').toBe(true);
    nav._systemMode = 'planet';
    nav._selectedPlanetIdx = 0;
    nav._hoveredBody = null;
    clickAt(nav, nav._canvas.width / 2, 60);
    expect(nav._systemMode, 'planet detail is a dead end in the current system').toBe('system');
  });

  it('component detail returns to the system view on a click', () => {
    nav.openToCurrentSystem(fakeStar());
    nav._systemMode = 'component';
    nav._selectedComponentIdx = 0;
    clickAt(nav, nav._canvas.width / 2, 60);
    expect(nav._systemMode, 'component detail is a dead end without ESC').toBe('system');
    expect(nav._selectedComponentIdx).toBe(-1);
  });

  it('no state is reachable whose only exit was ESC', () => {
    // The claim stated as a whole rather than as four separate ones: walk every
    // (level, systemMode) pair the class can be in, apply that state's documented
    // click, and require that it left the state. A future sub-view added without
    // a click route out fails here.
    const STATES = [
      { level: 4, mode: 'planet', click: (n) => { n._hoveredBody = null; clickAt(n, n._canvas.width / 2, 60); } },
      { level: 4, mode: 'component', click: (n) => clickAt(n, n._canvas.width / 2, 60) },
      { level: 4, mode: 'system', click: (n) => { const t = tabCentre(n, 3); clickAt(n, t.x, t.y); } },
      { level: 3, mode: 'system', click: (n) => { const t = tabCentre(n, 2); clickAt(n, t.x, t.y); } },
      { level: 2, mode: 'system', click: (n) => { const t = tabCentre(n, 1); clickAt(n, t.x, t.y); } },
      { level: 1, mode: 'system', click: (n) => { const t = tabCentre(n, 0); clickAt(n, t.x, t.y); } },
    ];
    for (const s of STATES) {
      nav.openToCurrentSystem(fakeStar());
      nav._levelIndex = s.level;
      nav._systemMode = s.mode;
      const before = { level: nav._levelIndex, mode: nav._systemMode };
      s.click(nav);
      const after = { level: nav._levelIndex, mode: nav._systemMode };
      expect(
        after.level !== before.level || after.mode !== before.mode,
        `level ${s.level} / ${s.mode} did not move on its documented click — with ESC ` +
        `unwired that is a state the player cannot leave`,
      ).toBe(true);
    }
  });

  it('the tab strip is WITHDRAWN when the panel is bare, so it cannot be clicked at rest', () => {
    // The other half of the same design: at rest the NAV panel is chrome-less and
    // the tab strip is not drawn, so those pixels belong to the orrery. A live tab
    // strip under an invisible chrome would be five invisible buttons across the
    // bottom of a screen the player is only glancing at.
    nav.chromeless = true;
    nav.openToCurrentSystem(fakeStar());
    expect(nav._bare, 'the panel is not bare at SYSTEM with the intent set').toBe(true);
    const { x, y } = tabCentre(nav, 0);
    clickAt(nav, x, y);
    expect(nav._levelIndex, 'a bare panel still has live level tabs').toBe(4);
  });
});

describe('AC-STRINGS-TELL-THE-TRUTH — nothing on the glass promises ESC', () => {
  /**
   * Render one state on a FRESH instance and return every string it emitted.
   *
   * Fresh every time, not reused: rendering mutates state (`_renderSystem` writes
   * on its first frame, and `_selectedBody`/`_commitAction` persist), so a shared
   * instance leaks the previous case's setup into the next one and reports a
   * branch as covered that was never entered. Caught while writing this file —
   * a reused instance showed planet-detail drawing the SELECTED-body footer with
   * nothing selected.
   *
   * `current` puts the player AT the star, which is the only way to reach the
   * `isCurrent` arms of both footers — four of the seven strings live there.
   */
  async function textAt(setup, { current = false } = {}) {
    const { nav, rec } = await makeHeadlessNav();
    nav.chromeless = false; // chromed, i.e. zoomed — the state the text appears in
    const star = fakeStar();
    nav.openToCurrentSystem(star);
    if (current) {
      // `_isCurrentSystem()` measures against POSITION_MATCH_TOL (0.1 pc), so the
      // player has to be on top of it, not merely near.
      nav._playerX = star.wx; nav._playerY = star.wy; nav._playerZ = star.wz;
    }
    // ⚠ WARM-UP RENDER, AND IT IS LOAD-BEARING. `_renderSystem` GENERATES the
    // system on its first frame and returns before it reaches the footer, so a
    // single render measures a state the player never sees. Found by the census
    // below, which came back one footer short — the same shape of trap the
    // previous workstream hit three times over, where unequal render counts made
    // a byte-equality check compare two different amounts of work and read as a
    // pass. Warming up BEFORE `setup` also matches the real sequence: a player
    // can only drill into a planet once the system has drawn.
    nav.render();
    setup(nav);
    rec.text.length = 0;
    nav.render();
    return rec.text.map((t) => t.text);
  }

  const STATES = [
    { label: 'system view, foreign', setup: () => {} },
    { label: 'system view, foreign, nothing selected', setup: (n) => {
      // Reaching this branch takes an explicit clear. Entering SYSTEM on a
      // foreign star leaves a WARP commit action standing, so the no-selection
      // footer is only drawn once the player has cleared it — which they do by
      // clicking empty space. Without this the branch is unreachable from a
      // fresh instance and its string would go unexercised.
      n._selectedBody = null;
      n._commitAction = null;
    } },
    { label: 'system view, current', setup: () => {}, current: true },
    { label: 'system view, current, body selected', current: true, setup: (n) => {
      n._selectedBody = { type: 'planet', planetIndex: 0 };
      n._commitAction = { kind: 'burn', label: 'BURN' };
    } },
    { label: 'planet detail, foreign', setup: (n) => { n._systemMode = 'planet'; n._selectedPlanetIdx = 0; } },
    { label: 'planet detail, current', current: true, setup: (n) => {
      n._systemMode = 'planet'; n._selectedPlanetIdx = 0;
    } },
    { label: 'planet detail, current, moon selected', current: true, setup: (n) => {
      n._systemMode = 'planet';
      n._selectedPlanetIdx = 0;
      n._selectedBody = { type: 'moon', planetIndex: 0, moonIndex: 0 };
      n._commitAction = { kind: 'burn', label: 'BURN' };
    } },
    { label: 'component detail', setup: (n) => { n._systemMode = 'component'; n._selectedComponentIdx = 0; } },
  ];

  for (const s of STATES) {
    it(`draws no ESC promise — ${s.label}`, async () => {
      const drawn = await textAt(s.setup, { current: s.current });
      const offenders = drawn.filter((t) => /\bESC\b/i.test(t));
      expect(offenders, `these strings still promise ESC: ${JSON.stringify(offenders)}`)
        .toEqual([]);
    });
  }

  it('records WHICH footers were reached behaviourally, and which were not', async () => {
    // ⭐ THE HONEST-COVERAGE TEST. Seven footer strings were reworded. A suite of
    // "no state drew ESC" assertions passes just as well on a state that drew
    // NOTHING, so the count of states proves nothing on its own — this pins the
    // actual set of footers observed coming out of the real class.
    //
    // It also RECORDS THE GAPS rather than implying there aren't any. TWO of the
    // seven reworded strings are not reachable from a fresh headless instance,
    // and both were found by this test coming back short rather than by
    // inspection:
    //
    //   1. COMPONENT DETAIL's footer. `deriveComponentView` needs a system
    //      carrying `componentSystems`; 400 consecutive seeds produced none, so
    //      the sub-view degrades straight back to the system view before drawing.
    //   2. THE FOREIGN, NOTHING-SELECTED system footer ('SELECT STAR TO WARP …').
    //      Entering SYSTEM on a foreign star leaves a WARP commit action standing,
    //      and `_renderSystem` REBUILDS it every frame — so clearing it in setup
    //      does not survive to the draw. It is reachable in the game by clicking
    //      empty space; it is not reachable by assignment.
    //
    // Both are covered by the source scan below and by AC-ZOOMED-IS-OPERABLE
    // live, and by nothing in between. Written down so the next reader does not
    // have to re-derive it from a suite that passes.
    const seen = new Set();
    for (const s of STATES) {
      for (const t of await textAt(s.setup, { current: s.current })) {
        if (/GO BACK|CHANGE VIEW|TO RETURN/i.test(t)) seen.add(t);
      }
    }
    expect([...seen].sort()).toEqual([
      'CLICK EMPTY SPACE TO GO BACK',
      'DRAG TO ROTATE · TABS TO CHANGE VIEW',
      'SELECT BODY TO NAVIGATE · DRAG TO ROTATE · TABS TO CHANGE VIEW',
      'SELECT MOON TO NAVIGATE · CLICK EMPTY SPACE TO GO BACK',
      'VIEW ONLY · CLICK TO GO BACK',
    ]);
    // FIVE of the seven, and the exact number is the point of the assertion. If a
    // future change makes a sixth reachable this goes red and someone adds it; if
    // a change makes one of these five UNreachable it also goes red, instead of
    // the suite quietly asserting "no ESC" over a state that no longer draws.
    expect(seen.size).toBe(5);
  });

  it('still tells the player how to get back — the hint was replaced, not deleted', () => {
    // Deleting the footer would pass the test above and leave the player with no
    // affordance named anywhere. The replacement must point at a route
    // AC-NO-STUCK-STATE proved exists.
    const src = readFileSync(join(REPO, 'src', 'ui', 'NavComputer.js'), 'utf8');
    const footers = [...src.matchAll(/fillText\('([^']*(?:GO BACK|TO RETURN|TABS|EMPTY SPACE)[^']*)'/g)]
      .map((m) => m[1]);
    expect(footers.length, 'every "how do I get back" hint was deleted rather than reworded')
      .toBeGreaterThanOrEqual(5);
    for (const f of footers) {
      expect(f, `"${f}" does not name a click affordance`).toMatch(/TAB|CLICK|SELECT/i);
    }
  });

  it('the source carries no ESC-navigates-levels claim anywhere it can be drawn', () => {
    const src = readFileSync(join(REPO, 'src', 'ui', 'NavComputer.js'), 'utf8');
    const drawnStrings = [...src.matchAll(/fillText\(\s*'([^']*)'/g)].map((m) => m[1]);
    expect(drawnStrings.length, 'the fillText scan found nothing — it has stopped working')
      .toBeGreaterThan(5);
    for (const s of drawnStrings) {
      expect(s, `a drawn literal still promises ESC: "${s}"`).not.toMatch(/\bESC\b/i);
    }
  });
});

describe('the headless harness itself — so nothing above is vacuous', () => {
  it('builds a REAL NavComputer, not a stand-in', async () => {
    const { nav } = await makeHeadlessNav();
    expect(nav.constructor.name).toBe('NavComputer');
    expect(typeof nav.render).toBe('function');
    expect(typeof nav._handleClick).toBe('function');
    expect(nav.level).toBe('prism');
  });

  it('actually renders, and the recorder actually records', async () => {
    const { nav, rec } = await makeHeadlessNav();
    nav.chromeless = false;
    nav.openToCurrentSystem(fakeStar());
    rec.text.length = 0;
    nav.render();
    expect(rec.text.length, 'a chromed SYSTEM frame drew no text at all — the ' +
      'recorder is not seeing the render, so every string assertion above is vacuous')
      .toBeGreaterThan(0);
  });

  it('the level gate still resolves at draw time', async () => {
    const { nav } = await makeHeadlessNav();
    nav.chromeless = true;
    expect(nav._bare, 'PRISM must keep its chrome — Max ruled the star-pick drill does').toBe(false);
    nav.openToCurrentSystem(fakeStar());
    expect(nav._bare, 'SYSTEM with the intent set must be bare').toBe(true);
  });

  it('a bare SYSTEM frame draws no text, which is what the tab test relies on', async () => {
    const { nav, rec } = await makeHeadlessNav();
    nav.chromeless = true;
    nav.openToCurrentSystem(fakeStar());
    rec.text.length = 0;
    nav.render();
    expect(rec.text.map((t) => t.text)).toEqual([]);
  });

  it('agrees with NavComputer about how tall the tab strip is', async () => {
    // TAB_H is duplicated from NavComputer's own `_handleClick`. If the class
    // shrinks it, every tab click in this file quietly starts landing on the
    // orrery instead, and the "route out" tests pass for the wrong reason.
    //
    // Checked as EVERY declaration, not the first match: the file declares
    // `tabH` in more than one place, and a scan that stops at the first one is
    // satisfied by a stale sibling while the live value has moved. Planting a
    // change in one of them left this green until it counted them all.
    const src = readFileSync(join(REPO, 'src', 'ui', 'NavComputer.js'), 'utf8');
    const declared = [...src.matchAll(/const\s+tabH\s*=\s*(\d+)\s*;/g)].map((m) => Number(m[1]));
    expect(declared.length, 'no `const tabH` in NavComputer.js — the scan has stopped working')
      .toBeGreaterThan(0);
    for (const v of declared) {
      expect(v, `NavComputer declares a ${v}px tab strip; this file clicks as if it were ${TAB_H}px`)
        .toBe(TAB_H);
    }
  });
});
