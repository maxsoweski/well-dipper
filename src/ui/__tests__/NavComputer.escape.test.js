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
 * ── ⭐ WHO THIS GUARD IS DEFENDING AGAINST, AND WHEN IT IS DONE ────────────
 *
 * Three rounds have now gone into AC-STRINGS-TELL-THE-TRUTH. Each round a
 * skeptic found a cleverer way to get the letters E-S-C onto the glass, and each
 * round the answer was to widen the net. That can run forever, because an
 * unbounded adversary always beats a static check. It ran this long for one
 * reason: NOBODY HAD WRITTEN DOWN WHO THE GUARD IS DEFENDING AGAINST, so there
 * was no way to tell a hole from a non-hole and every finding looked like a hole.
 *
 * THE ADVERSARY IS A FUTURE SESSION OF THIS PROJECT, WORKING IN GOOD FAITH.
 *
 * Concretely: six months from now someone reworks the system view, wants to tell
 * the player how to get back out of it, and writes the most natural sentence
 * there is. Max ruled that ESC means DISMISS and nothing else. This guard exists
 * so that natural, well-meant sentence turns the suite red instead of shipping a
 * lie to the player.
 *
 * The adversary is NOT someone trying to beat the check. A commit that spells the
 * word with a Cyrillic Е, or assembles it from character codes, has a worse
 * problem in it than a stale ESC promise, and a string check is not the thing
 * that catches that.
 *
 * ── COVERED — WHAT A GOOD-FAITH AUTHOR PLAUSIBLY WRITES ────────────────────
 *
 *   'PRESS ESC TO RETURN'              the base case
 *   'PRESS ESCAPE TO RETURN'           `\bESC\b` CANNOT match ESCAPE — the
 *                                      trailing boundary fails against the A
 *   'press the escape key to go back'  lower case, spelled out, mid-sentence
 *   'PRESS ⎋ TO RETURN'                U+238B is the standard escape-key glyph
 *                                      and a reasonable typographic choice
 *   `…, w / 2, drawH-8)`               any formatter writes this, and it used to
 *                                      drop a site out of THREE checks at once
 *   `export const BACK_HINT = …` in a  a plausible refactor, and invisible to a
 *   sibling, imported and drawn        scan that reads one file
 *   'PRESS ES' + 'C TO RETURN'         two static literals — one sentence on the
 *                                      glass, so read as one
 *
 * ── DECLINED — WHAT ONLY AN EVADER WRITES ──────────────────────────────────
 *
 * Declining these was measured, not assumed: each was planted and the suite run.
 * Doing that turned up a distinction worth keeping, because the two halves of
 * this guard decline different things.
 *
 * DECLINED BY BOTH HALVES — the letters that reach the glass are not the letters
 * any pattern is looking for, so neither reading the source nor reading the
 * render finds them:
 *
 *   Cyrillic Е (U+0415), or any homoglyph substitution.  PLANTED as a live draw
 *     in `_renderSystem` beside the :2726 footer, 44/44 green.
 *   a zero-width space (U+200B) inside the word — same species: the string that
 *     reaches the glass genuinely is not the word. PLANTED the same way, 44/44
 *     green.
 *
 * DECLINED BY THE SOURCE HALF ONLY — the value is never written down as a
 * literal, so no source read reaches it; but the census reads what the class
 * actually DREW, so a runtime-assembled promise is caught anywhere a click route
 * goes:
 *
 *   String.fromCharCode(80,82,69,83,83,32,69,83,67).  PLANTED behind a branch no
 *     route enters, 44/44 green — and that guard is what made it green.
 *   `PRESS ES${''}C TO RETURN` — an interpolation whose only job is to split the
 *     word. PLANTED as a live draw beside :2726 it goes RED on four census states,
 *     because 'PRESS ESC TO RETURN' is what landed on the glass. It survives only
 *     at a draw site the census cannot reach: the three rows in UNREACHABLE, and
 *     levels 0–3.
 *   Note the asymmetry inside this one: a `${}` carrying a REAL word IS caught by
 *     the source half too, because the const resolver reads the interpolated
 *     value as a fragment. Only a word-HALF escapes, and nobody splits a word in
 *     half by accident.
 *
 * The practical reading: to get a runtime-assembled ESC promise onto the glass
 * unseen, a commit has to put it somewhere no player can go — which is a strange
 * thing to do by accident, and not a thing a wider pattern would fix.
 *
 * DECLINING IS NOT LOSING. A guard that names its limits is worth more than one
 * that implies it has none: the reader of a bounded guard knows what is still
 * theirs to check, and the reader of an unbounded claim believes it is covered.
 * The failure this lane has spent the whole session correcting is a comment
 * asserting a property the code does not have — two of them lived in this file
 * and its helper, both named in b86ea59, both disproved by a plant. Widening the
 * net without extending this list is how a fourth one gets written.
 *
 * ── THE MODEL IS AN INTENT TEST; THE IMPLEMENTATION IS A LOCATION TEST ─────
 *
 * Worth stating plainly, because it is the honest shape of what is here and a
 * skeptic found it by reading the two against each other. Everything above talks
 * about WHO writes the string. What the code actually checks is WHERE it lives:
 * NavComputer.js, the modules NavComputer imports, and whatever the headless
 * census causes the class to render. Three consequences follow, and none of them
 * needs any evasion at all — a good-faith author reaches them by walking in a
 * direction the scan does not look:
 *
 *   INBOUND VALUES. A hint handed to the class from outside — a constructor
 *     option, a setter, a config object assembled in main.js — is a plain literal
 *     in a file nothing here reads. PLANTED: `opts.backHint` passed from main.js
 *     and drawn as `this._backHint`, with the literal 'PRESS ESC TO RETURN' on the
 *     glass, 44/44 green. The scan is scoped OUTBOUND (this file plus its
 *     imports); a caller is upstream of that and always will be.
 *   NON-JS PLAYER SURFACES. index.html already carries a keybinds row —
 *     `<span class="kb-key">ESC</span><span class="kb-desc">Close menu / deselect
 *     target</span>`. It is TRUTHFUL today, so this is not a live defect. But it
 *     is the most natural place for a future session to write "ESC — back one nav
 *     level", and nothing here reads HTML.
 *   THE POSITIONAL PIN MISDIRECTS. An ESC promise added at the footer baseline
 *     reddens the "a draw site at the footer baseline computes its text" pin,
 *     whose message says nothing about ESC and tells the reader to add a pin
 *     entry. Doing exactly what it says returns green with the promise live.
 *
 * ── AND IT IS STRICTER THAN THE AC IT GUARDS ───────────────────────────────
 *
 * The AC forbids text that tells the player ESC does something it NO LONGER DOES.
 * This forbids naming the escape key at all — including truthfully. 'PRESS ESC TO
 * DISMISS' is accurate and still goes red. That is deliberate: whether a sentence
 * about ESC is true is a judgement about the design, and a regex cannot make it.
 * The cost is that restoring a legitimate ESC hint requires editing this guard,
 * which is the right amount of friction for a thing Max ruled on.
 *
 * SO THIS GUARD IS DONE WHEN THE COVERED LIST HOLDS. A finding that lands in the
 * declined list is not a defect in it, and the right response to one is a line in
 * that list, not a wider pattern. The three location gaps above are the honest
 * remainder: they are named rather than closed, because closing them means
 * scanning the whole app and the HTML, which is a different guard than this one.
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
 * ── AND IT STILL READS THE SOURCE, ON PURPOSE ──────────────────────────────
 *
 * The behavioural half cannot see a string it never causes to be drawn, and
 * NavComputer has plenty: the SELECT MOON footer is structurally dead, the
 * SELECT STAR TO WARP footer is overwritten every frame before it can draw,
 * component detail degrades away headless, and levels 0–3 are outside this
 * census entirely. An ESC promise added to any of those is invisible to a
 * behavioural test and obvious to a source read. So both halves stay, and the
 * trade is explicit: BEHAVIOUR proves a string is reachable and belongs to the
 * state it claims; SOURCE proves that no string which would break the rule is
 * WRITTEN DOWN AS A LITERAL in NavComputer.js or in the modules NavComputer
 * imports.
 *
 * That second clause used to read "no string exists anywhere that would break the
 * rule if it ever did draw" — which is exactly the kind of sentence this lane
 * keeps having to take back, and which a plant disproved. It is bounded twice
 * over, both times on purpose. Bounded by FILE: one hop of imports, so a constant
 * two modules away, or re-exported through a sibling, is not read. Bounded by
 * SHAPE: a value assembled at runtime is written down nowhere, so no source read
 * reaches it. The threat model above says why those bounds are the right ones and
 * not a to-do list.
 *
 * What changed 2026-07-29 is the INSTRUMENT. Every source scan here used to be
 * `/fillText\('([^']*)'/` — sensitive to a quote character, which a skeptic used
 * to walk a double-quoted "PRESS ESC TO RETURN" past all seven of them at a live
 * draw site. The scans now go through `helpers/drawnText.mjs`, which parses the
 * file, so a drawn string is read by VALUE and its spelling stops mattering.
 * That header carries the census of how this file actually spells them.
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
import { dirname, join, relative } from 'node:path';
import {
  makeHeadlessNav, fakeStar, clickAt, hoverAt, findHoverPoint, tabCentre, TAB_H,
} from './helpers/headlessNav.mjs';
import { collectDrawSites, collectStringLiterals, localImportPaths } from './helpers/drawnText.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const NAV_SRC_PATH = join(REPO, 'src', 'ui', 'NavComputer.js');
const navSrc = () => readFileSync(NAV_SRC_PATH, 'utf8');

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
  // ── ⭐ WHAT COUNTS AS AN ESC PROMISE ─────────────────────────────────────
  //
  // This used to be `/\bESC\b/i`, written inline at all three check sites — one
  // pattern, three copies, and the narrowest reading of the rule there is. It
  // cannot match ESCAPE at all: the trailing `\b` needs a non-word character
  // after the C and finds an A. So 'PRESS ESCAPE TO RETURN' — the FIRST thing
  // most people would write, and a promise in plain English — was green, and so
  // was the lower-case spelled-out form, and so was the ⎋ glyph 16 px above the
  // live footer.
  //
  // The axis is not the three letters. It is NAMING THE ESCAPE KEY, which a
  // good-faith author writes several ways, all covered by three patterns:
  //
  //   \bESC\b     the abbreviation
  //   \bESCAPE\b  the word, any case, anywhere in a sentence — which also covers
  //               "the escape key", "escape to go back", "Escape"
  //   U+238B ⎋    the standard escape-key glyph. No `\b` around it: it is not a
  //               word character, so a word boundary next to it is never where a
  //               reader expects it to be. Matched bare, which is right — the
  //               glyph has no other meaning.
  //
  // ── AND WHERE IT DELIBERATELY DOES NOT FIRE ──────────────────────────────
  //
  // Widening a pattern is how a guard starts crying wolf, and a guard that cries
  // wolf gets deleted by the person it wakes up. Two narrowings, both measured
  // against the file as it stands rather than imagined:
  //
  // 1. ESCAPE VELOCITY. `escape` is an ordinary English word and this is a space
  //    game whose nav computer already draws physics text (`_ pc`, masses, radii,
  //    periods). 'ESCAPE VELOCITY 4.2 KM/S' is a plausible thing to draw and is
  //    not an affordance hint — the word is an adjective on a speed there, not
  //    the name of a key. Stripped before the test rather than exempted after it,
  //    so a string that says BOTH things still trips on the other one — measured
  //    both ways: 'ESCAPE VELOCITY 4.2 KM/S' planted at a live footer runs 44/44
  //    green, and 'ESCAPE VELOCITY 4.2 KM/S · PRESS ESCAPE TO RETURN' goes red on
  //    six.
  //    Nothing in NavComputer draws it today; this is a carve-out written before
  //    it is needed, on the grounds that the alternative is a red suite landing on
  //    someone who did nothing wrong.
  // 2. The `KeyboardEvent.code` literal — handled at the literal-net check below,
  //    where it lives, and narrowed by SHAPE rather than by value.
  //
  // Every other appearance of the word is left to fire. The carve-out list is
  // deliberately this short: extend it only for a term where `escape` is
  // demonstrably not the key, and never to quiet a string that a player reads as
  // an instruction.
  //
  // MEASURED, on the file as committed: across NavComputer's 60 draw sites and
  // 63 resolvable fragments this pattern matches NOTHING, and across all 718
  // strings the net sweeps out of the file it matches exactly one — the
  // key-event code at :461 — which is why that one is narrowed by shape and
  // pinned below rather than waved through. Across the 18 modules NavComputer
  // imports, 647 strings, it matches nothing at all. So widening the axis cost
  // no false positive anywhere in the surface it covers.
  const ESC_PROMISE = /\bESC\b|\bESCAPE\b|⎋/i;
  const NOT_THE_KEY = /\bESCAPE\s+VELOCITY\b/gi;
  const promisesEscape = (s) => ESC_PROMISE.test(String(s).replace(NOT_THE_KEY, ''));

  // ── WHAT COUNTS AS A FOOTER ──────────────────────────────────────────────
  //
  // BY POSITION, NOT BY WORDING. This used to be
  // `/GO BACK|CHANGE VIEW|TO RETURN/i`, which defines the footer as the set of
  // phrases the footer currently happens to use — so a footer worded outside
  // those three fragments ('CLICK TO DISMISS', say) is not a footer as far as
  // the census is concerned. It then falls out of the behavioural set AND out
  // of the source set at the same time, and the closure test below balances
  // green with the new string in neither list. A guard that only recognises the
  // strings already written is not guarding the next string.
  //
  // Every footer in NavComputer is drawn at `drawH - 8`, centred, and the
  // renderers all compute `drawH` the same way. Both constants are duplicated
  // from production and both are PINNED against the source below, the way TAB_H
  // already is — a duplicated constant that nothing checks is how a test starts
  // measuring the wrong row of pixels and reporting silence as a pass.
  const DRAW_H_INSET = 50; // `const drawH = this._bare ? h : h - 50`
  const FOOTER_UP = 8; //     `ctx.fillText(…, w / 2, drawH - 8)`
  // Chromed only: `_bare` frames set drawH = h and draw no footer at all, and
  // every state below is driven chromed because that is the state the text
  // appears in.
  const footerY = (nav) => nav._canvas.height - DRAW_H_INSET - FOOTER_UP;
  const footersOf = (nav, rec) => rec.text.filter((t) => t.y === footerY(nav)).map((t) => t.text);

  /**
   * The baseline a footer draw sits on, read from the AST rather than matched
   * as text.
   *
   * This was `s.ySrc === 'drawH - 8'` — an exact comparison against a source
   * SLICE, so `drawH-8` matched nothing while drawing the identical pixel row.
   * That one keystroke took a site out of `footerSites()`, out of the
   * computed-baseline pin and out of the bottom-strip tripwire simultaneously,
   * and any formatter with an opinion about binary operators writes it. Same
   * species as the quote-sensitive regex the source half already threw out: a
   * check on how the code is TYPED rather than on what it MEANS. `yBase`/`yOffset`
   * come off the two AST operands, so spacing is not representable.
   */
  const FOOTER_BASE = 'drawH';
  const atFooterBaseline = (s) => s.yBase === FOOTER_BASE && s.yOffset === FOOTER_UP;

  /**
   * The footer draw sites in NavComputer.js, read out of the parsed file.
   *
   * `wholeLiteral` — the first argument is one entire string literal, in any
   * quote style. A footer is a fixed sentence on the glass; a computed argument
   * at the footer baseline is something else (today: the PRISM warp-target star
   * NAME, `s.name || 'Unnamed'` at :1863, which shares the baseline and is data,
   * not an affordance hint). The computed ones are pinned separately below
   * rather than filtered away in silence, so a real footer hiding behind a
   * variable cannot slip out of the ledger.
   */
  const footerSites = () => collectDrawSites(navSrc())
    .filter((s) => atFooterBaseline(s) && s.wholeLiteral);

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
    // WARM-UP RENDER — NOT load-bearing, which this comment used to claim.
    //
    // The claim was that without it nothing is projected, no body can be
    // hovered, and every route collapses to the same state. That was true of the
    // pre-2026-07-29 shape, where routes reached their states by assignment and
    // nothing else rendered. It is not true now: routes click, `clickBody` goes
    // through `hoverAt`, and `hoverAt` renders — so a routed state gets its
    // first frame from its own first hover whether this line is here or not.
    // Measured before this comment was rewritten: dropping this call leaves all
    // ten states' recorded text IDENTICAL, every string, x and y.
    //
    // It stays for a smaller and honest reason. The states with no route
    // (`route: () => {}`) would otherwise be measured on the COLD frame — the
    // one that generates the system — while routed states are measured warm.
    // Keeping it means every state in the census is read off a steady-state
    // frame, so the rows compare like with like.
    //
    // What IS load-bearing is the line above it: the player position has to be
    // written before the FIRST render, because that frame generates the system
    // and asks `_isCurrentSystem()` while doing it.
    nav.render();
    state.route(nav);
    rec.text.length = 0;
    nav.render();
    return { nav, drawn: rec.text.map((t) => t.text), footers: footersOf(nav, rec) };
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
   *
   * ⚠ WHERE THIS CENSUS IS BLIND, WRITTEN DOWN SO THE NEXT SKEPTIC DOES NOT
   * HAVE TO REDISCOVER IT.
   *
   * A deleted click route is caught only if the state it COLLAPSES INTO differs
   * in something asserted here, and only three things are asserted: the footer
   * string, `_systemMode`, and the state's own `check`. Two routes that draw the
   * same footer in the same sub-view are told apart by the `check` alone —
   * 'planet detail, current' and 'planet detail, current, moon selected' are
   * exactly that pair, both `planet`, both 'CLICK EMPTY SPACE TO GO BACK', and
   * only `_selectedBody.type` separates them. A future pair with no
   * distinguishing observable at all would collapse silently, and the fix when
   * that happens is a `check`, not another footer string.
   *
   * Two further limits, same species:
   *   • A route that disappears but leaves an EQUIVALENT route in place is not a
   *     regression this census can see, or should — it reaches the same state.
   *   • The harness records what the class DREW, never how it looked. A footer
   *     drawn in the right place with the right text and an invisible colour
   *     passes everything here. Pixel questions stay live.
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
    {
      label: 'system view, current, selection cleared by a click in empty space',
      current: true,
      // NavComputer.js:4196 — `_clearCommitSelection()` on an empty-space click
      // in the SYSTEM view. A player-visible footer transition in its own right:
      // with a body selected the panel draws the COMMIT button and the short
      // 'DRAG TO ROTATE' hint; deselecting puts 'SELECT BODY TO NAVIGATE' back.
      // No other state drove it — the two "after backing out of planet detail"
      // rows exit through the PLANET-detail arm at :4129, a different line — so
      // deleting :4196 was green across the whole suite.
      //
      // MOONLESS on purpose, for the same reason as the row above: it is the
      // only planet click that selects and STAYS in the system view, so the
      // empty-space click that follows lands in the system-view arm rather than
      // the planet-detail one.
      route: (n) => {
        clickBody(n, 'a moonless planet', A_MOONLESS_PLANET);
        clickEmptySpace(n);
      },
      mode: 'system',
      footer: 'SELECT BODY TO NAVIGATE · DRAG TO ROTATE · TABS TO CHANGE VIEW',
      check: (n) => expect(n._selectedBody, 'the empty-space click left the body selected')
        .toBe(null),
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
      const offenders = drawn.filter(promisesEscape);
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
      const { nav, footers } = await drive(s);
      expect(nav._systemMode, `the route did not land in ${s.mode}`).toBe(s.mode);
      if (s.check) s.check(nav);
      expect(footers, `${s.label} drew the wrong footer`).toEqual([s.footer]);
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
    for (const s of STATES) for (const t of (await drive(s)).footers) seen.add(t);
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
    //
    // BOTH SIDES ARE NOW POSITIONAL. The source side asks the parser for the
    // draw calls whose y argument is `drawH - 8` — the footer baseline — instead
    // of grepping single-quoted literals for three phrases. That is what makes a
    // newly-added 'CLICK TO DISMISS' land in `inSource` and demand an entry in
    // one of the two lists, where the phrase-based version simply did not see it.
    const inSource = [...new Set(footerSites().flatMap((s) => s.fragments))].sort();
    const seen = new Set();
    for (const s of STATES) for (const t of (await drive(s)).footers) seen.add(t);
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

  it('the footer baseline is where this file thinks it is', () => {
    // The two duplicated constants, pinned — same reason as the TAB_H check at
    // the bottom of this file. If NavComputer moves the footer up a row, every
    // positional assertion above starts reading an empty line and reporting
    // "this state drew no footer" as agreement with an empty expectation.
    const src = navSrc();
    const decls = [...src.matchAll(/const\s+drawH\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(decls.length, 'no `const drawH` in NavComputer.js — the pin has stopped working')
      .toBeGreaterThan(0);
    for (const d of decls) {
      expect(d, `NavComputer computes drawH as \`${d}\`; this file assumes h - ${DRAW_H_INSET}`)
        .toMatch(new RegExp(`(^|\\s)h - ${DRAW_H_INSET}$`));
    }
    expect(footerSites().length, `no draw site at \`${FOOTER_BASE}\` - ${FOOTER_UP} — the footer moved`)
      .toBeGreaterThanOrEqual(5);
  });

  it('nothing else is drawn on the footer baseline that this census mistakes for a footer', () => {
    // The other half of "a footer is a fixed sentence at `drawH - 8`": the draw
    // sites at that baseline whose argument is NOT one whole literal. There is
    // exactly one today and it is not a footer. Pinned by its source text rather
    // than its line, so ordinary edits above it do not disturb it and a genuine
    // footer moving behind a variable does.
    const computed = collectDrawSites(navSrc())
      .filter((s) => atFooterBaseline(s) && !s.wholeLiteral)
      .map((s) => s.argSrc);
    expect(computed, 'a draw site at the footer baseline computes its text — if that is a ' +
      'real footer it is now outside the closure above, and needs to be made a literal or ' +
      'given a census row')
      .toEqual(["s.name || 'Unnamed'"]); // PRISM warp-target banner, level 3 — a star name
  });

  it('no bottom-strip baseline exists that the footer census does not know about', () => {
    // The residual the positional definition leaves: a footer drawn at
    // `drawH - 20` would be neither a footer to this census nor visible to it. It
    // cannot be closed by guessing at offsets, so it is closed by a tripwire —
    // the set of bottom-strip baselines NavComputer uses is fixed, and a new one
    // appearing is read by a human who decides whether it is a footer.
    //
    //   8 — the footer baseline, and the selected-star name on PRISM
    //  14 — DEBUG HUD last line, and the prism-map altitude readout
    //  24 — 'WARP TARGET' caption above the star name
    //  30, 46 — DEBUG HUD upper lines
    // Read off the AST, not off the source text: the old form matched
    // `/^drawH - \d+$/` against the slice, so a reformatted `drawH-20` was not a
    // bottom-strip baseline as far as this tripwire was concerned either.
    const offsets = [...new Set(collectDrawSites(navSrc())
      .filter((s) => s.yBase === FOOTER_BASE)
      .map((s) => s.yOffset))].sort((a, b) => a - b);
    expect(offsets, 'NavComputer draws on a bottom-strip baseline this file has never seen — ' +
      'if it is a footer, the census and the closure both need to know')
      .toEqual([8, 14, 24, 30, 46]);
  });

  it('no drawn string in the source promises ESC, however it is spelled', () => {
    // ⭐ THE SCAN THAT USED TO BE A REGEX. `/fillText\(\s*'([^']*)'/` saw 17 of
    // NavComputer's 60 draw sites — the single-quoted ones — and a skeptic
    // walked a double-quoted "VIEW ONLY · PRESS ESC TO RETURN" past it at
    // :2884, a genuine ESC promise at a genuine draw site, with the suite green.
    // Widening the character class would have closed that one case; the file
    // spells drawn text six ways (see helpers/drawnText.mjs) and would have
    // grown a seventh. So the file is PARSED and the strings read by value.
    const sites = collectDrawSites(navSrc());
    expect(sites.length, 'the draw-site scan found almost nothing — it has stopped working')
      .toBeGreaterThanOrEqual(50);
    const fragments = [...new Set(sites.flatMap((s) => s.fragments))];
    expect(fragments.length, 'the scan reads no strings out of the draw sites it found')
      .toBeGreaterThanOrEqual(50);
    for (const s of sites) {
      for (const f of s.fragments) {
        expect(promisesEscape(f), `NavComputer.js:${s.line} draws a string naming the escape `
          + `key: "${f}". Max ruled ESC means DISMISS and is not wired to level navigation, and `
          + `the on-glass hints were reworded to name CLICK affordances instead.\n`
          + `⚠ THIS CHECK IS DELIBERATELY STRICTER THAN THE AC, and it will fire on a string `
          + `that is TRUE. "PRESS ESC TO DISMISS" is accurate — ESC does dismiss — and it still `
          + `goes red here, because deciding whether a given sentence about ESC is true is a `
          + `judgement about the design, not something a regex can make. If you want an ESC `
          + `hint back on the glass, that is a decision for Max and it belongs in the contract `
          + `first; widening this pattern to let it through is how the guard stops guarding.`)
          .toBe(false);
      }
    }
  });

  /**
   * The one literal in this code that names the escape key and MUST.
   *
   * `if (e.code === 'Escape')` at NavComputer.js:461 — the DOM's own name for the
   * key, inside a comparison, nowhere near the glass. Widening the pattern to
   * cover the spelled-out word makes it the ONE match across all 716 literals in
   * the file, and reddening on it would make the guard wrong about the single
   * string it has no business objecting to. That is how a guard gets deleted.
   *
   * NARROWED BY SHAPE, NOT BY VALUE. A blanket "the value 'Escape' is fine" would
   * also wave through `this._hint = 'Escape'` drawn later through a member
   * access — dynamic to the draw-site scan, and then invisible here too, which is
   * a hole in exactly the place the net exists to cover. So the exemption also
   * requires the literal to sit on a line COMPARING a key code. A bare 'Escape'
   * anywhere else still goes red, and a second key handler written some other way
   * goes red and gets read by a human.
   *
   * Not extended to 'Esc', 'Escape ' or any near-miss: no DOM API is called those.
   */
  const KEY_EVENT_CODE = /\b(?:code|key)\s*===\s*['"`]Escape['"`]/;
  const isKeyEventCode = (l, lines) =>
    l.value === 'Escape' && KEY_EVENT_CODE.test(lines[l.line - 1] ?? '');

  /** Every literal in a source that names the escape key, key-event codes aside. */
  const offendingLiterals = (src) => {
    const lines = src.split('\n');
    return collectStringLiterals(src).filter((l) => promisesEscape(l.value) && !isKeyEventCode(l, lines));
  };

  it('and neither does any string in the file, drawn or not', () => {
    // ⭐ THE NET. 21 of the 60 draw sites hand `fillText` something no source
    // read can resolve — `title`, `chip.name`, `LEVEL_NAMES[i]`, a call. A string
    // assigned in one method and drawn by another is invisible to the scan above
    // by construction, so the scan above is not on its own a guarantee.
    //
    // This sweeps every string literal and every template chunk in the file
    // instead. It over-reports on purpose: it cannot tell a drawn string from an
    // internal one, and for "nothing in this file may promise ESC" that is the
    // right direction to be wrong in — the cost is a human reading one string,
    // and the alternative is a hole the width of a variable assignment.
    //
    // It does not trip on NavComputer's several `// … after ESC` comments,
    // because the parser does not treat comments as strings — the old regex
    // scans had to strip them by hand and one of them stripped the wrong thing.
    const src = navSrc();
    const literals = collectStringLiterals(src);
    expect(literals.length, 'the literal sweep found almost nothing — it has stopped working')
      .toBeGreaterThanOrEqual(400);
    const offenders = offendingLiterals(src);
    expect(offenders.map((l) => `${l.line}: ${l.value}`),
      'a string in NavComputer.js names the escape key — if it is never drawn, say so here')
      .toEqual([]);
    // The one carve-out, EXERCISED rather than merely declared. If the key
    // handler is rewritten into a shape `KEY_EVENT_CODE` does not recognise the
    // net catches it as an offender and says so; if the handler is DELETED the
    // net stays green and the carve-out becomes dead code nobody notices. This
    // line is what makes that second case visible.
    const lines = src.split('\n');
    const exempted = literals.filter((l) => isKeyEventCode(l, lines));
    expect(exempted.map((l) => l.line),
      'the KeyboardEvent-code carve-out matches a different number of literals than the one '
      + 'key comparison it was written for — read them and decide, do not widen it')
      .toHaveLength(1);
  });

  it('and neither does any string in the modules NavComputer imports', () => {
    // ⭐ THE CROSS-MODULE HOLE. Every source check above reads ONE file, so
    // `export const BACK_HINT = 'PRESS ESC TO RETURN'` in a sibling, imported and
    // drawn, was invisible to all of them — measured with the literal forbidden
    // string, plain ASCII, no trick, 43/43 green. That is a refactor a good-faith
    // author actually performs, which is what puts it inside the threat model
    // rather than in the declined list.
    //
    // ONE HOP, and `helpers/drawnText.mjs`'s `localImportPaths` argues the scope:
    // anything NavComputer draws it must first import, so its import list is the
    // whole one-hop surface, including a `navHints.js` written tomorrow. A
    // `src/ui/**` sweep would add nothing there and would cost correctness —
    // Max ruled ESC DISMISSES, so an unrelated UI module telling the player
    // "ESC to dismiss" is telling the TRUTH, and reddening on it is the crying-
    // wolf failure. The limit is stated in the header: a constant two modules
    // away, or re-exported through a sibling, is not read.
    const mods = localImportPaths(navSrc(), NAV_SRC_PATH);
    expect(mods.length, 'NavComputer appears to import almost nothing from the repo — the '
      + 'cross-module scan has stopped finding modules and is passing vacuously')
      .toBeGreaterThanOrEqual(15);
    // The ui/ helpers whose RETURN VALUES NavComputer draws are what this scan is
    // for. Named, so the module list cannot quietly shrink to the generation/
    // modules and still satisfy the count above.
    for (const m of ['systemIdentity.js', 'componentIdentity.js', 'farCompanionChips.js', 'prismMembership.js']) {
      expect(mods.some((p) => p.endsWith(m)),
        `NavComputer no longer imports ${m} — if its strings still reach the glass by some `
        + 'other route, this scan has stopped covering them')
        .toBe(true);
    }
    let total = 0;
    const offenders = [];
    for (const p of mods) {
      const src = readFileSync(p, 'utf8');
      total += collectStringLiterals(src).length;
      for (const l of offendingLiterals(src)) offenders.push(`${relative(REPO, p)}:${l.line}: ${l.value}`);
    }
    expect(total, 'the sibling sweep read almost no strings — it has stopped working')
      .toBeGreaterThanOrEqual(400);
    expect(offenders, 'a module NavComputer imports carries a string naming the escape key. '
      + 'NavComputer draws what these modules return, so a hint constant here reaches the '
      + 'glass exactly as if it were written inline.')
      .toEqual([]);
  });

  it('still tells the player how to get back — the hint was replaced, not deleted', () => {
    // Deleting the footers would pass every test above and leave the player with
    // no affordance named anywhere: an empty source set and an empty observed set
    // close over each other perfectly. So the footers are also required to EXIST
    // and to name a route AC-NO-STUCK-STATE proved is there.
    const footers = footerSites().flatMap((s) => s.fragments);
    expect(footers.length, 'every "how do I get back" hint was deleted rather than reworded')
      .toBeGreaterThanOrEqual(5);
    for (const f of footers) {
      expect(f, `"${f}" does not name a click affordance`).toMatch(/TAB|CLICK|SELECT/i);
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
