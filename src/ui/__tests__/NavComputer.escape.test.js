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
 * And it drives it BY CLICKING. Reaching a state by assigning `_systemMode` is
 * the same shape of mistake one level down: it answers "is this state all
 * right" while quietly assuming the state is still reachable, so it cannot go
 * red when the route to it disappears. See the census in
 * AC-STRINGS-TELL-THE-TRUTH, which claimed five reachable footers on that basis
 * and had four.
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
  makeHeadlessNav, fakeStar, clickAt, hoverAt, findHoverPoint, tabCentre, TAB_H,
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

// ── REACHING A STATE THE WAY A PLAYER REACHES IT ───────────────────────────
//
// Everything below drives states by CLICKING INTO THEM. The alternative — and
// what this file did until 2026-07-29 — is `nav._systemMode = 'planet'`, which
// looks equivalent and is not: an assignment reaches states no click route
// produces, so a census built on it cannot go red when a click route
// DISAPPEARS, which is the only regression the census exists to catch. It
// reported five reachable footers on that basis; four of them are real.
//
// The cost of honesty is that a body has to be FOUND before it can be clicked,
// because `_hoveredBody` — the only thing `_handleClick` consults for bodies —
// is computed inside the render from NavComputer's own projection. See
// `findHoverPoint` in the harness.

/** Predicates over `_hoveredBody`, named so the failure messages read. */
const A_STAR = (hb) => hb.type === 'star';
const A_MOON = (hb) => hb.type === 'moon';
const A_PLANET_WITH_MOONS = (hb, n) =>
  hb.type === 'planet' && (n._systemData?.planets?.[hb.index]?.moons?.length ?? 0) > 0;
const A_MOONLESS_PLANET = (hb, n) =>
  hb.type === 'planet' && (n._systemData?.planets?.[hb.index]?.moons?.length ?? 0) === 0;

/**
 * Where the sweep found each kind of body last time.
 *
 * A speed-up, never an oracle: the point is re-hovered on the new instance and
 * only used if THAT instance agrees a matching body is under it, otherwise the
 * sweep runs again. Sound because the geometry is deterministic — the fixture
 * star is fixed, `orbitAngle`/`startAngle` are static, and nothing here rotates
 * the view — but a cache that is trusted without checking is how a test starts
 * clicking empty space and reporting a branch as covered.
 */
const HIT_CACHE = new Map();

/** Put the cursor on a body of the named kind. Returns the point, hover live. */
function hoverBody(nav, key, pred) {
  const cached = HIT_CACHE.get(key);
  if (cached) {
    const hb = hoverAt(nav, cached.x, cached.y);
    if (hb && pred(hb, nav)) return cached;
  }
  const found = findHoverPoint(nav, pred);
  if (!found) {
    throw new Error(
      `no point on the panel hovers ${key} — either the system has no such body ` +
      `or the class stopped publishing hover, and every click route through ${key} ` +
      `below is now clicking nothing`,
    );
  }
  HIT_CACHE.set(key, { x: found.x, y: found.y });
  return found;
}

/** Hover a body of the named kind and click it, as a player would. */
function clickBody(nav, key, pred) {
  const p = hoverBody(nav, key, pred);
  clickAt(nav, p.x, p.y);
  return p;
}

/**
 * Click somewhere with nothing under it.
 *
 * The move + frame is the whole point: `_handleClick` reads the hover the LAST
 * FRAME resolved, so clicking a corner without moving there first re-clicks the
 * body the cursor is still parked on. That mistake keeps a state alive that the
 * test believes it just left.
 */
function clickEmptySpace(nav, x = 24, y = 64) {
  const hb = hoverAt(nav, x, y);
  if (hb) throw new Error(`(${x},${y}) is not empty — a ${hb.type} is under it`);
  clickAt(nav, x, y);
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
    // The first frame generates the system; before it nothing is projected and
    // nothing can be hovered, so the drill-in click would land on an empty panel.
    nav.render();
    clickBody(nav, 'a planet with moons', A_PLANET_WITH_MOONS);
    expect(nav._systemMode, 'clicking a planet in a foreign system did not drill in').toBe('planet');
    clickEmptySpace(nav);
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
    nav.render();
    // Clicked in, not assigned in: the current-system arm only drills for a
    // planet that HAS moons, so a state reached by assignment is one the arm
    // under test would never have produced.
    clickBody(nav, 'a planet with moons', A_PLANET_WITH_MOONS);
    expect(nav._systemMode, 'clicking a moon-bearing planet at home did not drill in').toBe('planet');
    clickEmptySpace(nav);
    expect(nav._systemMode, 'planet detail is a dead end in the current system').toBe('system');
  });

  it('component detail returns to the system view on a click', () => {
    // ASSIGNED, and it has to be: component detail needs a system carrying
    // `componentSystems` and no seed tried produces one headless, so there is no
    // click route to drive. What is being checked is the EXIT, which is real
    // code either way; the entry being synthetic is why this state is named in
    // the census's UNREACHABLE list rather than counted as covered.
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
    //
    // This one ASSIGNS its states on purpose, and is the only place left that
    // does. It is a walk of the state MATRIX, including combinations no click
    // route produces — that is what makes it catch a sub-view whose entry is
    // wired before its exit is. The census above must never be built this way:
    // there, the whole question is whether the route still exists, and an
    // assignment answers it by not asking.
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
  const FOOTER_RE = /GO BACK|CHANGE VIEW|TO RETURN/i;

  /**
   * Drive one state on a FRESH instance and return what it drew.
   *
   * Fresh every time, not reused: rendering mutates state (`_renderSystem`
   * writes on its first frame, and `_selectedBody`/`_commitAction` persist), so
   * a shared instance leaks the previous case's route into the next one and
   * reports a branch as covered that was never entered. Caught while writing
   * this file — a reused instance showed planet-detail drawing the
   * SELECTED-body footer with nothing selected.
   *
   * `current` puts the player AT the star. That is a direct write and stays one:
   * it is the SHIP'S POSITION, not the state under observation, and there is no
   * click that moves the ship. Everything the footer actually branches on —
   * which sub-view, what is selected — is arrived at by clicking below.
   */
  async function drive(state) {
    const { nav, rec } = await makeHeadlessNav();
    nav.chromeless = false; // chromed, i.e. zoomed — the state the text appears in
    const star = fakeStar();
    // `openToCurrentSystem` is the documented public entry and is how main.js
    // opens the panel; the click route INTO it (prism star click) needs a loaded
    // star field and is a different AC's business.
    nav.openToCurrentSystem(star);
    if (state.current) {
      // `_isCurrentSystem()` measures against POSITION_MATCH_TOL (0.1 pc), so the
      // player has to be on top of it, not merely near. Set before the warm-up:
      // the first frame GENERATES the system and asks `_isCurrentSystem()` while
      // doing it.
      nav._playerX = star.wx; nav._playerY = star.wy; nav._playerZ = star.wz;
    }
    // ⚠ WARM-UP RENDER, AND IT IS LOAD-BEARING. `_renderSystem` GENERATES the
    // system on its first frame, and until it has, nothing is projected and no
    // body can be hovered — so a route driven without it clicks an empty panel
    // and every state collapses to the same one. It is also the real sequence: a
    // player can only drill into a planet once the system has drawn.
    nav.render();
    state.route(nav);
    rec.text.length = 0;
    nav.render();
    return { nav, drawn: rec.text.map((t) => t.text) };
  }

  /**
   * Every footer state a player can get to, and the clicks that get there.
   *
   * `footer` is asserted PER STATE, not just pooled into the census set. Pooling
   * alone is too weak to catch a lost route: delete the moon-click branch and
   * the moon-selected state falls back into the plain planet-detail state, which
   * draws the same string — the pooled set never notices. The per-state
   * expectation is what makes a deleted route show up as this state stopped
   * being this state.
   */
  const STATES = [
    {
      label: 'system view, current, nothing selected',
      current: true,
      route: () => {},
      mode: 'system',
      footer: 'SELECT BODY TO NAVIGATE · DRAG TO ROTATE · TABS TO CHANGE VIEW',
    },
    {
      label: 'system view, current, planet selected — clicked a moonless planet',
      current: true,
      // A MOONLESS planet on purpose: with moons the same click drills into
      // planet detail (`hasMoons` at the current-system arm), so this is the
      // only click that selects a body and STAYS in the system view.
      route: (n) => clickBody(n, 'a moonless planet', A_MOONLESS_PLANET),
      mode: 'system',
      footer: 'DRAG TO ROTATE · TABS TO CHANGE VIEW',
      check: (n) => expect(n._selectedBody?.type, 'the planet click selected nothing').toBe('planet'),
    },
    {
      label: 'system view, current, star selected — clicked the star',
      current: true,
      route: (n) => clickBody(n, 'the star', A_STAR),
      mode: 'system',
      footer: 'DRAG TO ROTATE · TABS TO CHANGE VIEW',
      check: (n) => expect(n._selectedBody?.type, 'the star click selected nothing').toBe('star'),
    },
    {
      label: 'system view, foreign',
      route: () => {},
      mode: 'system',
      // Foreign entry force-selects the star and builds the WARP commit action on
      // the first frame, so this state has a selection without anyone clicking.
      footer: 'DRAG TO ROTATE · TABS TO CHANGE VIEW',
    },
    {
      label: 'planet detail, current — clicked a planet with moons',
      current: true,
      route: (n) => clickBody(n, 'a planet with moons', A_PLANET_WITH_MOONS),
      mode: 'planet',
      footer: 'CLICK EMPTY SPACE TO GO BACK',
    },
    {
      label: 'planet detail, current, moon selected — clicked the moon',
      current: true,
      route: (n) => {
        clickBody(n, 'a planet with moons', A_PLANET_WITH_MOONS);
        clickBody(n, 'a moon', A_MOON);
      },
      mode: 'planet',
      footer: 'CLICK EMPTY SPACE TO GO BACK',
      check: (n) => expect(n._selectedBody?.type, 'the moon click did not select the moon')
        .toBe('moon'),
    },
    {
      label: 'planet detail, foreign — clicked a planet',
      route: (n) => clickBody(n, 'a planet with moons', A_PLANET_WITH_MOONS),
      mode: 'planet',
      footer: 'VIEW ONLY · CLICK TO GO BACK',
    },
    {
      label: 'system view, current, after backing out of planet detail',
      current: true,
      // The exit is a state in its own right, not just a transition: backing out
      // CLEARS the selection, so the system view it returns to is a different
      // frame from the one the player drilled from. Deleting the current-system
      // arm of that exit leaves the panel in planet detail and this goes red —
      // 1a9628d records that exact deletion surviving a suite that only ever
      // drove the foreign arm.
      route: (n) => {
        clickBody(n, 'a planet with moons', A_PLANET_WITH_MOONS);
        clickEmptySpace(n);
      },
      mode: 'system',
      footer: 'SELECT BODY TO NAVIGATE · DRAG TO ROTATE · TABS TO CHANGE VIEW',
      check: (n) => expect(n._selectedBody, 'backing out kept the burn target selected').toBe(null),
    },
    {
      label: 'system view, foreign, after backing out of planet detail',
      route: (n) => {
        clickBody(n, 'a planet with moons', A_PLANET_WITH_MOONS);
        clickEmptySpace(n);
      },
      mode: 'system',
      footer: 'DRAG TO ROTATE · TABS TO CHANGE VIEW',
    },
  ];

  /**
   * The footers no click route reaches, each with the reason it does not.
   *
   * Named so the next reader can tell "we chose not to cover this" from "we
   * forgot", and pinned against the source below so the naming cannot go stale.
   */
  const UNREACHABLE = [
    {
      text: 'SELECT MOON TO NAVIGATE · CLICK EMPTY SPACE TO GO BACK',
      // NavComputer.js:3164. STRUCTURALLY DEAD, and this census used to claim it
      // as reached — by assigning `_systemMode = 'planet'`, which is the one way
      // to be in current-system planet detail with nothing selected. The only
      // click route in is the current-system planet arm of `_handleClick`, which
      // sets `_selectedBody` and `_commitAction` in the same breath as
      // `_systemMode = 'planet'`; `_buildCommitAction` cannot return null there
      // because it and `_isCurrentSystem()` guard on the same `_systemStar`. And
      // no click that stays in planet detail clears the selection — moon and
      // planet clicks re-select, and the empty-space click leaves the sub-view.
      // So the `isCurrent` arm of the else-branch draws only when `_bare` is
      // true, and `_bare` suppresses the draw.
      reason: 'no click route reaches current-system planet detail with no selection',
    },
    {
      text: 'SELECT STAR TO WARP · CLICK PLANET FOR DETAIL · TABS TO CHANGE VIEW',
      // Entering SYSTEM on a foreign star leaves a WARP commit action standing,
      // and `_renderSystem` REBUILDS it every frame (`!isCurrent && !_commitAction`)
      // — so no click can leave the foreign system view unselected long enough
      // for a frame to draw this.
      reason: 'the foreign system view re-selects the star every frame',
    },
    {
      text: 'VIEW ONLY · CLICK TO GO BACK',
      // Drawn from TWO sites. The foreign planet-detail one IS reached above; the
      // COMPONENT DETAIL one is not — `deriveComponentView` needs a system
      // carrying `componentSystems` and 400 consecutive seeds produced none, so
      // the sub-view degrades back to the system view before it draws. The
      // string is therefore in the observed set for the wrong site, which is
      // exactly the kind of thing that reads as coverage and is not.
      reason: 'component detail degrades away — the string is observed from the foreign planet site only',
      alsoReachable: true,
    },
  ];

  for (const s of STATES) {
    it(`draws no ESC promise — ${s.label}`, async () => {
      const { drawn } = await drive(s);
      const offenders = drawn.filter((t) => /\bESC\b/i.test(t));
      expect(offenders, `these strings still promise ESC: ${JSON.stringify(offenders)}`)
        .toEqual([]);
    });
  }

  for (const s of STATES) {
    it(`gets there by clicking, and draws that state's footer — ${s.label}`, async () => {
      // ⭐ THE ROUTE, ASSERTED. This is what the census rests on: the state was
      // ARRIVED AT, and it is the state it claims to be. Delete any click branch
      // these routes use and the state it led to collapses into a neighbouring
      // one — which the pooled set below would not notice, because the
      // neighbouring state draws a string the pool already contains.
      const { nav, drawn } = await drive(s);
      expect(nav._systemMode, `the route did not land in ${s.mode}`).toBe(s.mode);
      if (s.check) s.check(nav);
      expect(drawn.filter((t) => FOOTER_RE.test(t)), `${s.label} drew the wrong footer`)
        .toEqual([s.footer]);
    });
  }

  it('records WHICH footers were reached behaviourally, and which were not', async () => {
    // ⭐ THE HONEST-COVERAGE TEST. Seven footer draws were reworded, six distinct
    // strings. A suite of "no state drew ESC" assertions passes just as well on a
    // state that drew NOTHING, so the count of states proves nothing on its own —
    // this pins the actual set of footers observed coming out of the real class,
    // every one of them from a state a click route reached.
    //
    // It used to claim FIVE, and got its fifth by assigning `_systemMode`. An
    // assignment can reach states the game cannot, so a census built on one
    // cannot go red when a click route disappears — which is the whole job. The
    // set is four; the fifth is named in UNREACHABLE with the code that kills it.
    const seen = new Set();
    for (const s of STATES) {
      for (const t of (await drive(s)).drawn) if (FOOTER_RE.test(t)) seen.add(t);
    }
    expect([...seen].sort()).toEqual([
      'CLICK EMPTY SPACE TO GO BACK',
      'DRAG TO ROTATE · TABS TO CHANGE VIEW',
      'SELECT BODY TO NAVIGATE · DRAG TO ROTATE · TABS TO CHANGE VIEW',
      'VIEW ONLY · CLICK TO GO BACK',
    ]);
    // FOUR, and the exact number is the point of the assertion. If a future
    // change makes a fifth reachable this goes red and someone adds it; if a
    // change makes one of these four UNreachable it also goes red, instead of the
    // suite quietly asserting "no ESC" over a state that no longer draws.
    expect(seen.size).toBe(4);
  });

  it('accounts for EVERY footer in the source as reached or named-unreachable', async () => {
    // The closure over the two lists above. Without it the census is only a
    // claim about the states it happens to know: a footer added to NavComputer
    // and reachable by a route nobody wrote would sit there unexercised, and a
    // footer DELETED would take its census line with it. Here, either list can
    // absorb a change, but the union has to keep matching the source.
    const src = readFileSync(join(REPO, 'src', 'ui', 'NavComputer.js'), 'utf8');
    const inSource = [...new Set(
      [...src.matchAll(/fillText\(\s*'([^']*)'/g)].map((m) => m[1]).filter((t) => FOOTER_RE.test(t)),
    )].sort();
    const seen = new Set();
    for (const s of STATES) {
      for (const t of (await drive(s)).drawn) if (FOOTER_RE.test(t)) seen.add(t);
    }
    const accounted = [...new Set([...seen, ...UNREACHABLE.map((u) => u.text)])].sort();
    expect(accounted, 'a footer exists that is neither reached by a click route nor named unreachable')
      .toEqual(inSource);
    // And the naming cannot rot into a description of code that is gone.
    for (const u of UNREACHABLE) {
      expect(inSource, `UNREACHABLE names "${u.text}" (${u.reason}) but nothing draws it any more`)
        .toContain(u.text);
      if (!u.alsoReachable) {
        expect([...seen], `"${u.text}" is named unreachable but a route reached it`)
          .not.toContain(u.text);
      }
    }
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
