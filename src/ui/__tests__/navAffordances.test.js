/**
 * AC-10 — NOTHING ON THE GLASS ADVERTISES A CONTROL THAT DOES NOT EXIST.
 *
 * ── WHAT THIS FILE IS FOR, AND WHY IT IS NOT THE OTHER NINE ─────────────────────────────────────
 *
 * The other cases in this workstream each pin ONE control. This one pins the RELATIONSHIP between
 * what the two designs SAY and what the instrument DOES, which is the thing the whole workstream is
 * about. Max, opening the session: *"every single thing needs to be functional and navigable by the
 * player."* The failure it exists to make impossible is not a broken control — it is a NEW promise,
 * added to a hint row in some later design pass, that nothing is behind. That defect ships silently,
 * because a string is not a call site and no compiler, linter or type checker will ever ask about it.
 *
 * ── ⛔ IT SCRAPES THE SOURCE, NOT THE RENDER, AND THAT IS FORCED ────────────────────────────────
 *
 * The obvious version of this test walks the recording context and reads back the drawn text. It
 * cannot work: every string on these screens goes through `drawPixelText`, which emits **fillRects**,
 * so `rec.text` is empty however much writing is on the glass. A previous case in this workstream
 * asserted the SYSTEM ladder "reveals" bodies by scraping `rec.text` and was measuring nothing at all
 * — it passed whatever the ladder did. So the promises are read out of `designs.js`'s own source
 * text, which is the only place they exist as words.
 *
 * ⚠ WHICH MAKES THE SCRAPE ITSELF LOAD-BEARING, so it is proved rather than trusted: `THE SCRAPE
 * FINDS WHAT IS ACTUALLY THERE` below asserts a known promise is in the harvest, and
 * `AN UNKNOWN PROMISE FAILS THE SWEEP` feeds the tokeniser a string that is not in the vocabulary and
 * asserts it is reported. Without those two, a scrape that silently matched nothing would report a
 * clean sweep forever.
 *
 * ── ⭐ AND EVERY PROBE DRIVES THE REAL ENTRY POINT ───────────────────────────────────────────────
 *
 * `_onKeyDown` for a key, `_handleMouseMove` + the render tail for a pick. Not a driver method. All
 * 28 view-mode tests passed while the `V` key was dead code — folded behind a `//` comment, present,
 * parsed and unreachable — because every one of them set state directly and not one drove the
 * keyboard. Max found it by playing the game. A probe here that called `drv.cycleSort()` would be
 * that same test again.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHeadlessNav } from './helpers/headlessNav.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const DESIGNS = readFileSync(join(ROOT, 'src/ui/navViewModes/designs.js'), 'utf8');

/** Drive the REAL keydown path — the one the dead `V` key proved is the only honest entry. */
const press = (nav, code, extra = {}) =>
  nav._onKeyDown({ code, preventDefault() {}, stopPropagation() {}, ...extra });

async function nav({ mode = 'rail', level = 3 } = {}) {
  const h = await makeHeadlessNav({ width: 427, height: 240 });
  h.nav._viewModesEnabled = true;
  h.nav.viewMode = mode;
  h.nav._levelIndex = level;
  h.nav.render();
  return h.nav;
}

/**
 * THE VOCABULARY: every phrase the designs may use to name a control, and the probe that proves the
 * control is there. A phrase with no entry here fails the sweep — that is the whole point.
 *
 * ⛔ A PROBE MUST ASSERT AN OBSERVABLE CONSEQUENCE, never that a binding exists. "The driver method
 * was called" is not evidence: the clause that calls it can be unreachable, which is exactly what
 * shipped on 2026-09-07.
 */
const VOCABULARY = [
  {
    phrase: '[ ] SORT',
    control: 'the bracket keys re-order the ranked list',
    async probe() {
      const n = await nav();
      const before = n._viewDriverInst.S.sortLabel;
      const first = n._viewDriverInst.D.starRows[0];
      press(n, 'BracketRight');
      n.render();
      return n._viewDriverInst.S.sortLabel !== before
          && n._viewDriverInst.D.starRows[0] !== first;
    },
  },
  {
    phrase: '- = PAGE',
    control: 'minus and equals page the ranked list',
    async probe() {
      const n = await nav();
      press(n, 'Equal');
      n.render();
      return (n._viewDriverInst.S.listOffset | 0) > 0;
    },
  },
  {
    phrase: '/ SEARCH',
    control: 'slash opens the drawn search',
    async probe() {
      const n = await nav();
      press(n, 'Slash');
      return n._viewDriverInst.searchActive() === true;
    },
  },
  {
    phrase: 'TAB LEVEL',
    control: 'Tab changes level',
    async probe() {
      const n = await nav({ level: 3 });
      const before = n._levelIndex;
      press(n, 'Tab');
      n.render();
      return n._levelIndex !== before;
    },
  },
  {
    phrase: 'ENTER',
    control: 'Enter fires the same commit the [ WARP ] / [ BURN ] button fires',
    async probe() {
      const n = await nav();
      let fired = null;
      n._selectedNavStar = { wx: 8, wy: 0, wz: 0, seed: 991, name: 'Probe', spectral: 'G' };
      n._onCommit = (a) => { fired = a; };
      press(n, 'Enter');
      return !!fired && fired.type === 'warp';
    },
  },
  {
    phrase: 'WASD PAN',
    control: 'the four pan letters move the prism camera the designs draw from',
    async probe() {
      const n = await nav({ level: 3 });
      const before = { ...n._localCenter };
      press(n, 'KeyD');
      for (let i = 0; i < 8; i++) n.render();
      n._onKeyUp({ code: 'KeyD' });
      // ⭐ THE CAMERA MUST REACH `S.cam`, NOT JUST MOVE. Before this workstream `_localCenter`
      //    moved perfectly well and the designs' prism was anchored to the SHIP, so the picture
      //    never moved — measured byte-identical with a liveness control. Both halves, or neither.
      const moved = n._localCenter.x !== before.x || n._localCenter.z !== before.z;
      const cam = n._viewDriverInst.S.cam;
      return moved && cam.x === n._localCenter.x && cam.z === n._localCenter.z;
    },
  },
  {
    phrase: 'R/F UP',
    control: 'R and F move the prism camera in Y',
    async probe() {
      const n = await nav({ level: 3 });
      const before = n._localCenter.y;
      press(n, 'KeyR');
      for (let i = 0; i < 8; i++) n.render();
      n._onKeyUp({ code: 'KeyR' });
      return n._localCenter.y !== before && n._viewDriverInst.S.cam.y === n._localCenter.y;
    },
  },
  {
    phrase: 'SCROLL , . OR CLICK ...',
    control: 'comma and full stop walk the SYSTEM ladder',
    async probe() {
      const n = await nav({ level: 4 });
      n._systemStar = { wx: 8, wy: 0, wz: 0, seed: 77, spectral: 'G', name: 'Crowded' };
      n._systemData = {
        star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
        planets: Array.from({ length: 40 }, (_, i) => ({
          orbitRadiusAU: 0.2 + i * 0.9, moons: [],
          planetData: { radiusEarth: 1, T_eq: 250, habitability: { score: 0.1 }, rings: false },
        })),
      };
      n.render();
      const before = n._viewDriverInst.S.ladderScroll;
      press(n, 'Period');
      n.render();
      return n._viewDriverInst.S.ladderScroll !== before;
    },
  },
  {
    phrase: 'L=LIST',
    control: "L toggles design 2's list mode",
    async probe() {
      const n = await nav({ mode: 'bars', level: 3 });
      const before = n._viewDriverInst.S.list;
      press(n, 'KeyL');
      return n._viewDriverInst.S.list !== before;
    },
  },
  { phrase: 'L=MAP', control: "L toggles design 2's list mode", sameAs: 'L=LIST' },
  {
    phrase: 'CLICK A SECTOR',
    control: 'a click in the GALAXY map picks the sector under the pointer',
    async probe() {
      const n = await nav({ level: 0 });
      const p = n._viewDriverInst.S.mapProj;
      if (!p) return false;
      // ⭐ AIMED AT THE MIDDLE OF THE DISC ON PURPOSE. The square's corners are outside the galaxy,
      //    where `getSectorAt` correctly answers null — a probe that aimed there would report a
      //    working picker as broken.
      n._mouseX = p.ox + p.sq / 2; n._mouseY = p.oy + p.sq / 2;
      n.render();
      return !!n._hoveredTile?.sector;
    },
  },
  {
    phrase: 'CLICK A TILE',
    control: 'a click in the SECTOR / REGION map picks the tile under the pointer',
    async probe() {
      for (const level of [1, 2]) {
        const n = await nav({ level });
        const p = n._viewDriverInst.S.mapProj;
        if (!p) return false;
        n._mouseX = p.ox + p.cell * 1.5; n._mouseY = p.oy + p.cell * 1.5;
        n.render();
        if (n._hoveredTile?.col === undefined) return false;
      }
      return true;
    },
  },
  {
    phrase: 'CLICK A STAR',
    control: 'a click in the PRISM map picks the star under the pointer',
    async probe() {
      const n = await nav({ level: 3 });
      const hits = n._viewDriverInst.S.prismHits;
      if (!hits?.length) return false;
      n._mouseX = hits[hits.length - 1].x; n._mouseY = hits[hits.length - 1].y;
      n.render();
      return !!n._hoveredLocalStar?.star;
    },
  },
  {
    phrase: 'CLICK TO ENTER',
    control: "design 2's map picks at GALAXY, SECTOR and REGION",
    async probe() {
      for (const level of [0, 1, 2]) {
        const n = await nav({ mode: 'bars', level });
        const p = n._viewDriverInst.S.mapProj;
        if (!p) return false;
        n._mouseX = p.kind === 'block' ? p.bx + p.blk / 2 : p.ox;
        n._mouseY = p.kind === 'block' ? p.by + p.blk / 2 : p.oy;
        n.render();
        if (!n._hoveredTile) return false;
      }
      return true;
    },
  },
  {
    phrase: 'SELECT A BODY',
    control: 'a click on a body glyph at SYSTEM selects it',
    async probe() {
      const n = await nav({ level: 4 });
      n._systemStar = { wx: 8, wy: 0, wz: 0, seed: 12, spectral: 'G', name: 'Probe' };
      n._systemData = {
        star: { type: 'G' }, zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 }, asteroidBelts: [],
        planets: [{ orbitRadiusAU: 1.0, moons: [],
                    planetData: { radiusEarth: 1, T_eq: 288, habitability: { score: 0.9 }, rings: false } }],
      };
      n.render();
      const hits = (n._viewDriverInst.S.bodyHits || []).filter((h) => h.ref);
      if (!hits.length) return false;
      n._mouseX = hits[0].x; n._mouseY = hits[0].y;
      n.render();
      return !!n._hoveredBody;
    },
  },
  {
    phrase: 'TYPE A NAME',
    control: 'printable keys reach the drawn search field',
    async probe() {
      const n = await nav();
      press(n, 'Slash');
      for (const [code, key] of [['KeyS', 's'], ['KeyO', 'o'], ['KeyL', 'l']]) press(n, code, { key });
      return n._viewDriverInst.S.search.text === 'sol';
    },
  },
  {
    phrase: 'UP DOWN MOVE',
    control: 'the arrow keys move the search highlight',
    async probe() {
      const n = await nav();
      press(n, 'Slash');
      for (const [code, key] of [['KeyS', 's'], ['KeyO', 'o'], ['KeyL', 'l']]) press(n, code, { key });
      if ((n._viewDriverInst.S.search.rows || []).length < 2) return false;
      const before = n._viewDriverInst.S.search.highlight;
      press(n, 'ArrowDown');
      return n._viewDriverInst.S.search.highlight !== before;
    },
  },
  {
    phrase: 'ENTER WARP',
    control: 'Enter warps to the highlighted search result',
    async probe() {
      const n = await nav();
      let fired = null;
      n._onCommit = (a) => { fired = a; };
      press(n, 'Slash');
      for (const [code, key] of [['KeyS', 's'], ['KeyO', 'o'], ['KeyL', 'l']]) press(n, code, { key });
      press(n, 'Enter');
      return !!fired && fired.type === 'warp';
    },
  },
  { phrase: 'ENTER TO WARP', control: 'Enter commits', sameAs: 'ENTER' },
  {
    phrase: 'ESC CLOSE',
    control: 'Escape closes the search AND ONLY closes it',
    async probe() {
      const n = await nav({ level: 3 });
      press(n, 'Slash');
      press(n, 'Escape');
      // ⛔ BOTH HALVES. The DOM widget's Escape stopped at `input.blur()` and never reached
      //    `handleEscape`; a pilot who abandons a search must not also lose a level of the drill.
      return n._viewDriverInst.searchActive() === false && n._levelIndex === 3;
    },
  },
];

const BY_PHRASE = new Map(VOCABULARY.map((v) => [v.phrase, v]));

/**
 * Harvest every phrase the designs draw that NAMES a control.
 *
 * The strings live in template literals and array literals in `designs.js`. We take the source text
 * of every one and ask which vocabulary phrases occur in it — so a phrase that is drawn is found,
 * and a phrase that is drawn and is NOT in the vocabulary is reported as an unbacked promise.
 */
/**
 * `designs.js` with its comments removed.
 *
 * ⛔ THE FIRST VERSION OF THIS SWEEP SCRAPED THE WHOLE FILE AND REPORTED `DRAG TO ROTATE` AS AN
 * UNBACKED PROMISE — a string that is no longer drawn anywhere, and appears only in the comment
 * recording that it was REMOVED for lying about a ladder. A guard that fires on its own changelog is
 * a guard that gets switched off. Only code can put words on the glass, so only code is harvested.
 */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

function harvestPromises() {
  const found = new Set();
  const unknown = new Set();
  // Every single- or back-quoted literal in the file, un-nested — enough for hint rows, status
  // clauses, the pager and the commit label, which is where every promise on these screens lives.
  const literals = codeOnly(DESIGNS).match(/(['`])(?:\\.|(?!\1)[^\\\n])*\1/g) || [];
  for (const raw of literals) {
    const s = raw.slice(1, -1);
    // ⚠ `[A-Z]{2}`, NOT `{3}`. The first version of this guard wanted three consecutive capitals and
    // silently dropped `R/F UP`, whose longest run is two — so a promise that IS drawn went unswept
    // and its probe was never demanded. A filter that quietly excludes is the same failure as a
    // scrape that quietly matches nothing.
    if (!/[A-Z]{2}/.test(s)) continue;                    // prose and identifiers are not promises
    for (const v of VOCABULARY) if (s.includes(v.phrase)) found.add(v.phrase);
    for (const m of tokenize(s)) unknown.add(`${m}   (in "${s.slice(0, 70)}")`);
  }
  return { found, unknown };
}

/**
 * Which control-naming phrases does this string contain that the vocabulary does not cover?
 *
 * ⚠ DELIBERATELY NARROW. A sweep that flagged every capitalised word would drown in `GALAXY`,
 * `SYSTEMS`, `RINGED`, `NEAREST 27` — readouts, not controls — and would be switched off within a
 * week, which is the ordinary fate of a noisy guard. It matches only the shapes a CONTROL takes on
 * these screens: a bracketed key, a bare key name followed by a verb, a `KEY=THING` binding, or an
 * imperative opening with CLICK / SELECT / TYPE / PRESS / DRAG / SCROLL.
 */
function tokenize(s) {
  // ⭐ MASK THE KNOWN PHRASES FIRST, THEN LOOK FOR CONTROL SHAPES IN WHAT IS LEFT.
  //
  // ⛔ The obvious version walks the string and consumes a vocabulary phrase off the front, and it is
  // wrong twice over. `CLICK A SECTOR OR A LIST ROW   [ ] SORT   / SEARCH   TAB LEVEL` leaves
  // "OR A LIST ROW ..." behind, which is connective prose and got reported as an unbacked promise;
  // and a greedy imperative match swallows to end-of-line, so `SELECT A BODY   DRAG TO ROTATE` yields
  // only the bound half and HIDES the unbound one — this file's own defect, reintroduced inside the
  // thing that is supposed to catch it. Masking is order-independent and cannot do either.
  // ⛔ LONGEST PHRASE FIRST: `ENTER` is a phrase and it is also a prefix of `ENTER WARP`.
  let rest = s;
  for (const phrase of VOCABULARY.map((v) => v.phrase).sort((x, y) => y.length - x.length)) {
    rest = rest.split(phrase).join(' \u0000 ');
  }
  const out = [];
  const patterns = [
    /\[\s*\]\s*[A-Z]+/g,                                     // "[ ] FILTER"
    /\b(?:CLICK|SELECT|TYPE|PRESS|DRAG|SCROLL)\b[^\u0000\n]*/g,  // an unbound imperative
    /\b[A-Z]=[A-Z]+/g,                                       // "K=THING"
    /\b(?:TAB|ENTER|ESC|WASD|R\/F|UP DOWN)\b[^\u0000\n]*/g,     // a key name plus its verb
    /-\s*=\s*[A-Z]+/g,                                       // "- = PAGE"
    /\/\s*SEARCH/g,
  ];
  for (const re of patterns) {
    for (const m of rest.match(re) || []) {
      const t = m.trim().replace(/\s+/g, ' ');
      if (t) out.push(t);
    }
  }
  return out;
}

describe('AC-10 — every promise the glass makes is kept', () => {
  it('⭐ THE SCRAPE FINDS WHAT IS ACTUALLY THERE — without this the sweep below is vacuous', () => {
    const { found } = harvestPromises();
    // If the harvest ever silently matched nothing, every case in this file would pass forever.
    expect(found.size, 'the scrape found no promises at all').toBeGreaterThan(8);
    for (const known of ['[ ] SORT', '/ SEARCH', 'TAB LEVEL', 'WASD PAN', 'CLICK TO ENTER']) {
      expect(found.has(known), `the scrape missed "${known}", which designs.js definitely draws`).toBe(true);
    }
  });

  it('⛔ AN UNKNOWN PROMISE FAILS THE SWEEP — this is the defect the file exists to catch', () => {
    // A design pass adds a control to a hint row and binds nothing. The tokeniser must see it.
    expect(tokenize('CLICK A STAR   [ ] FILTER   TAB LEVEL')).toEqual(['[ ] FILTER']);
    expect(tokenize('SELECT A BODY   DRAG TO ROTATE')).toEqual(['DRAG TO ROTATE']);
    // …and must NOT fire on a readout, or the guard gets switched off for noise.
    expect(tokenize('PRISM · 27524 STARS · 3.0 PC ACROSS')).toHaveLength(0);
  });

  it('⛔ NO PHRASE ON THE GLASS IS OUTSIDE THE VOCABULARY', () => {
    const { unknown } = harvestPromises();
    expect([...unknown], 'designs.js names a control this file cannot account for').toEqual([]);
  });

  for (const v of VOCABULARY) {
    const target = v.sameAs ? BY_PHRASE.get(v.sameAs) : v;
    it(`"${v.phrase}" → ${v.control}`, { timeout: 60000 }, async () => {
      const { found } = harvestPromises();
      // Only assert the drawing for phrases the designs actually carry; `sameAs` aliases share a probe.
      if (!found.has(v.phrase) && !v.sameAs) {
        throw new Error(`"${v.phrase}" is in the vocabulary but designs.js no longer draws it — `
          + 'delete the entry, or find out why the promise disappeared.');
      }
      expect(await target.probe(), `"${v.phrase}" is drawn on the glass and ${v.control} does not happen`).toBe(true);
    });
  }
});
