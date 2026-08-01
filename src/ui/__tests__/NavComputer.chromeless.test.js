/**
 * NavComputer chrome-less — lane F (cockpit-screen-content-2026-07-28),
 * AC-NAV-LEVEL-POLICY.
 *
 * ── THE TWO THINGS THIS FILE IS FOR ─────────────────────────────────────────
 *
 * The chrome-less NAV panel is one boolean written by one policy and read by
 * about three dozen guards inside four thousand lines of live game code. The two
 * ways it can be wrong have nothing in common, so this file checks both:
 *
 *   (a) THE GATE. `navChromelessForLevel` must answer true for 'system' and false
 *       for everything else — including the four levels `AutopilotNavSequence`
 *       drills through, and including strings it has never heard of. And it must be
 *       applied AT DRAW TIME, by `get _bare()`, not by the caller.
 *
 *       THAT LAST CLAUSE IS A CORRECTION, MADE 2026-07-29, AND IT IS THE POINT OF
 *       HALF THIS FILE. The design as first written had the flag "dumb" and the
 *       policy in lane F: `NavPanel` read `nav.level`, ran the policy and wrote a
 *       boolean before calling `render()`. That is unsound, and it was reproduced
 *       rather than argued. `render()` sets `this._levelIndex = 4` MID-FRAME, in
 *       the `_systemZoomAnim` completion block, long after the painter has fixed
 *       its boolean from the PRE-transition level — so the first SYSTEM frame of a
 *       prism→system zoom drew FULLY CHROMED: twelve text calls plus a published
 *       `_autopilotButtonRect`, a live invisible button on a panel whose whole
 *       contract is that it has no controls. Unreachable today only because nothing
 *       forwards pointer events at NAV; the increment that turns clicks on turns
 *       the bug on with it.
 *
 *       So `chromeless` is now an INTENT the host states unconditionally, `_bare`
 *       is the verdict this class reaches per draw, and every guard reads `_bare`.
 *       There is exactly ONE definition of the level rule and it is in
 *       `NavComputer.js`, where it is used.
 *
 *   (b) THE GUARDS. Every chrome suppression site inside `NavComputer.js` must be
 *       behind `_bare`, so that with the intent unset the drawing is byte-identical
 *       to what the game's full-screen overlay has always emitted. This is checked
 *       by reading the module as TEXT, because it cannot be checked any other way
 *       here (see below), and because the failure it guards — a new `fillText`
 *       added to `_renderSystem` months from now by someone who has never heard of
 *       this workstream — is a text-level event.
 *
 *       THE HELPER ALLOWLIST IS DERIVED, NOT TYPED. It used to name three helpers,
 *       and a fourth — `this._drawTargetMarker(ctx, 0, 0)` dropped unguarded into
 *       `_renderSystem` — left this file GREEN. Three of the four real SYSTEM chrome
 *       sites are helper CALLS, so a fourth helper is the likely shape of the exact
 *       regression this scan exists to catch. The scan now finds every text-emitting
 *       method in the class by transitive closure over `fillText`/`strokeText` and
 *       requires every call to an uncovered one to be guarded. A hand-maintained
 *       list WAS the defect.
 *
 * ── WHY THE SOURCE SCAN IS AT MODULE SCOPE AND THROWS ───────────────────────
 *
 * Measured on a sibling lane-F file, not assumed: a focus helper on ONE test made
 * vitest report the whole run GREEN, because the file's own self-scan was among
 * the tests it skipped. Module scope runs during collection, before any focus or
 * skip helper can be honoured, so a scan there cannot be turned off by one.
 *
 * The scan therefore RUNS and THROWS at module scope, and is then restated inside
 * `it()` blocks purely so the guarantee shows up by name in the report. The
 * restatements are not the check. Deleting them would lose the report line and
 * nothing else; deleting the module-scope throw would lose the check.
 *
 * ── WHY THE SUBJECT IS TEXT AND A STUB, AND WHY THAT IS NOT A DODGE ─────────
 *
 * A real `NavComputer` CANNOT be constructed here. Its constructor calls
 * `canvas.getContext('2d')` and registers seven DOM event listeners, and this
 * repo's vitest runs in plain node with no jsdom, no happy-dom and no
 * node-canvas — the same fact `NavSource.test.js` and `AlertCue.test.js` both
 * state at length. So there is no `ctx` to record calls on and no pixels to count.
 *
 * What CAN be done, and is:
 *
 *   - `Object.create(NavComputer.prototype)` gives a real instance whose real
 *     `get level()` runs, without the constructor. That is the pattern
 *     `NavComputer.level.test.js` and the five `NavComputer.merge`-family files
 *     already use, and here it does something the sibling `NavPanel.test.js`
 *     cannot: it closes the loop between the STRINGS THE REAL CLASS EMITS and the
 *     string literal the policy compares against. A stub that returns 'system'
 *     because the test author typed 'system' proves nothing about the class.
 *   - The guard structure is read out of the file with a small JavaScript scanner
 *     (below) that strips comments and string contents and tracks brace depth, so
 *     "this `fillText` is inside a block whose condition mentions the flag" is a
 *     computed fact rather than a regex guess.
 *
 * ── WHAT IS ONLY VERIFIABLE LIVE, said plainly ──────────────────────────────
 *
 * That the flag-off path is byte-identical — that is verification item 1 of the
 * design, an in-process A/B against `src/ui/NavComputer.baseline.js` in a real
 * page, and no source scan can substitute for it. This file narrows where a
 * difference could come from; it does not prove there is none. Also live-only:
 * that the survivors (star, orbits, habitable-zone ring, planet discs, the green
 * ship diamond, the dashed trajectory) still read as a system map once the words
 * are gone, and whether a full-colour NAV beside three one-ink panels looks like
 * one instrument. Those are Max's, on the glass.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NavComputer, navChromelessForLevel } from '../NavComputer.js';
import { makeNavPainter } from '../../cockpit/panels/NavPanel.js';
import * as NavPanelModule from '../../cockpit/panels/NavPanel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NAV_PATH = join(HERE, '..', 'NavComputer.js');
const NAV_RAW = readFileSync(NAV_PATH, 'utf8');

/**
 * The repo's ordinary comment-stripped view, for claims about prose-free source
 * text. Strings are deliberately left intact — an error message that names the
 * mechanism is exactly what should be kept.
 */
const NAV_CODE = NAV_RAW
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/**
 * Is this file disabling any of its own tests?
 *
 * At MODULE SCOPE and throwing, for the reason given in the header: a focus helper
 * on one test made a sibling lane-F file report GREEN while its self-scan sat
 * among the skipped. Comments are stripped and the pattern is assembled from
 * fragments so this header can discuss the helpers without matching itself.
 *
 * THE PATTERN WAS TOO NARROW AND IS NOW DERIVED FROM THE PARTS. It used to be six
 * fixed strings — `describe.skip`, `describe.only`, and the same for `it` and
 * `test` — which does not match the CHAINED forms vitest honours just as happily:
 * `it.concurrent.only`, `describe.each(table).only`, `it.sequential.skip`. Measured
 * on the sibling `NavPanel.test.js`: one `it.concurrent.only` and a deleted feature
 * reported one passed, twenty skipped, GREEN. So the middle of the chain is now
 * `[\w.]*` plus an optional call, and the tail covers `todo` and `fails` as well.
 */
const SELF_CODE = readFileSync(join(HERE, 'NavComputer.chromeless.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const RUNNERS = ['describe', 'it', 'test'];
const DISABLERS = ['only', 'skip', 'todo', 'fails'];
const DISABLED_RE = new RegExp(
  '\\b(?:' + RUNNERS.join('|') + ')\\b(?:[\\w.]|\\([^()]*\\))*\\.(?:' + DISABLERS.join('|') + ')\\s*\\(',
);
if (DISABLED_RE.test(SELF_CODE)) {
  throw new Error(
    'NavComputer.chromeless.test.js disables one of its own tests (a skip or focus helper is ' +
    'present in its code). This file is the whole of the guard inventory for chrome-less NAV — ' +
    'and the thing it guards, an unguarded fillText on the default draw path, breaks the ' +
    'byte-equality contract that is the only reason it was safe to put a second draw mode into ' +
    'live game code. A disabled test here reads as "every chrome site is behind the flag" when ' +
    'nothing was checked. Remove it.',
  );
}

// ── THE SCANNER ────────────────────────────────────────────────────────────

/**
 * Read `NavComputer.js` as a list of code-only lines, each carrying whether it
 * sits inside a block guarded on the chrome-less flag.
 *
 * A character walk rather than a regex, and that choice was forced rather than
 * preferred. `_renderSystem` alone contains 48 backticks: template literals whose
 * `${...}` holes contain real code with real braces. A brace count that treated a
 * template's contents as code would drift out of step within a few lines and every
 * "is this guarded" answer after that point would be noise — and noise that says
 * GUARDED is the direction that hides the bug.
 *
 * Three things are dropped: comments (so a `fillText` inside a comment is not a
 * finding, and so this file's own prose about `fillText` never becomes one),
 * quoted-string CONTENTS (so a brace inside `'{'` cannot open a block — the quotes
 * themselves are kept so a call still reads as a call), and template-literal text
 * (but NOT its `${...}` expressions, which are code and are kept).
 *
 * @param {string} raw the module source
 * @returns {{n:number, code:string, guarded:boolean, depth:number}[]}
 */
function readGuardedLines(raw) {
  const lineCount = raw.split('\n').length;
  const code = new Array(lineCount).fill('');

  // Pass 1 — strip comments and string contents, keeping line numbers.
  const modes = [{ template: false, fromTemplate: false }];
  let i = 0;
  let line = 0;
  while (i < raw.length) {
    const c = raw[i];
    const n = raw[i + 1];
    if (c === '\n') { line++; i++; continue; }
    const mode = modes[modes.length - 1];

    if (mode.template) {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { modes.pop(); i++; continue; }
      if (c === '$' && n === '{') { modes.push({ template: false, fromTemplate: true, depth: 0 }); i += 2; continue; }
      i++;
      continue;
    }

    if (c === '/' && n === '/') { while (i < raw.length && raw[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) { if (raw[i] === '\n') line++; i++; }
      i += 2;
      continue;
    }
    if (c === '\'' || c === '"') {
      code[line] += c;
      i++;
      while (i < raw.length && raw[i] !== c) { if (raw[i] === '\\') i++; if (raw[i] === '\n') line++; i++; }
      code[line] += c;
      i++;
      continue;
    }
    if (c === '`') { modes.push({ template: true }); i++; continue; }
    if (c === '{' && mode.fromTemplate) { mode.depth++; }
    if (c === '}' && mode.fromTemplate) {
      if (mode.depth === 0) { modes.pop(); i++; continue; }
      mode.depth--;
    }
    code[line] += c;
    i++;
  }

  // Pass 2 — brace depth, and a stack of "was this block opened on a line whose
  // condition mentions the flag". A line is guarded if any enclosing block was,
  // or if the line itself carries the guard inline (`if (!this.chromeless) draw()`
  // — the dominant form in the file, chosen so no existing line had to move).
  const stack = [];
  const out = [];
  for (let ln = 0; ln < lineCount; ln++) {
    const text = code[ln];
    out.push({
      n: ln + 1,
      code: text.trim(),
      depth: stack.length,
      guarded: stack.some(Boolean) || GUARD_INLINE_RE.test(text),
    });
    for (const ch of text) {
      if (ch === '{') stack.push(GUARD_INLINE_RE.test(text));
      else if (ch === '}') stack.pop();
    }
  }
  return out;
}

/**
 * `!this._bare`, however it is spaced. The suppressing sense of the DRAW-TIME
 * verdict — deliberately NOT `this.chromeless`, which is only the host's intent.
 * A guard written on the raw intent is the mid-frame race back: it would strip
 * levels 0-3, because `chromeless` is true at every level the cockpit hosts.
 */
const GUARD_INLINE_RE = /!\s*this\._bare\b/;
/** `if (this._bare) return;` — the whole-method form, however it is spaced. */
const EARLY_RETURN_RE = /^if\s*\(\s*this\._bare\s*\)\s*return\s*;?$/;

const LINES = readGuardedLines(NAV_RAW);

/**
 * Every member of the class, by name, as the span of its body.
 *
 * Built by walking depth-1 lines rather than by looking for names this file
 * already knows — the whole correction of MAJOR 2 is that a scan which only looks
 * where it was told to look reports clean about everywhere else. Getters and
 * setters are included under their bare name (`_bare`, `_systemFill`) because two
 * of the claims below are about what may appear INSIDE one.
 */
const MEMBER_SIG_RE = /^(?:(?:get|set|static|async)\s+)*([A-Za-z_$][\w$]*)\s*\(/;
const NOT_A_MEMBER = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'else', 'do', 'typeof']);

function spanFrom(startIdx) {
  let depth = 0;
  let opened = false;
  for (let k = startIdx; k < LINES.length; k++) {
    for (const ch of LINES[k].code) {
      if (ch === '{') { depth++; opened = true; }
      else if (ch === '}') depth--;
    }
    if (opened && depth === 0) return LINES.slice(startIdx, k + 1);
  }
  return null;
}

const MEMBERS = new Map();
for (let i = 0; i < LINES.length; i++) {
  if (LINES[i].depth !== 1) continue;                    // the class body, not module scope
  const m = MEMBER_SIG_RE.exec(LINES[i].code);
  if (!m || NOT_A_MEMBER.has(m[1]) || MEMBERS.has(m[1])) continue;
  const body = spanFrom(i);
  if (body) MEMBERS.set(m[1], body);
}

/**
 * The line span of a method body.
 * Throws rather than returning a default: a method that has been renamed must
 * fail loudly, not quietly scan nothing and report a clean bill of health.
 */
function methodSpan(name) {
  const body = MEMBERS.get(name);
  if (!body) {
    throw new Error(
      `NavComputer.chromeless.test.js: NavComputer.js has no member \`${name}\`. It was renamed ` +
      'or removed, and this file has been scanning nothing there ever since. Update the ' +
      'inventory below to match — an empty scan reports no findings, which reads identically ' +
      'to a clean one.',
    );
  }
  return body;
}

// ── THE INVENTORY ──────────────────────────────────────────────────────────

/**
 * Anything that puts a WORD on the canvas. The design's rule is "graphics stay,
 * words go", so `fillRect`, `stroke`, `arc` and the rest are deliberately absent —
 * guarding those would strip the orrery itself.
 */
const TEXT_CALL_RE = /\b(?:fillText|strokeText)\s*\(/;

/**
 * ── THE HELPER ALLOWLIST IS DERIVED ────────────────────────────────────────
 *
 * A word does not have to be emitted in `_renderSystem` to end up on the SYSTEM
 * screen; it only has to be emitted by something `_renderSystem` calls. Three of
 * the four real chrome sites in that method are exactly that shape — a call to a
 * helper — so the fourth one somebody adds will be too.
 *
 * The predecessor of this list NAMED three helpers, and that hand-typed list was
 * itself the defect: `this._drawTargetMarker(ctx, 0, 0)` planted unguarded inside
 * `_renderSystem` left this file at twenty-five passed, because `_drawTargetMarker`
 * was not one of the three. Six further text-emitting methods were unscanned.
 *
 * So: find every method that emits text, transitively. Start from the ones that
 * call `fillText`/`strokeText` directly, then repeatedly add any method that calls
 * one of those, until the set stops growing. The closure is what makes a helper
 * added two levels down still count.
 *
 * @param {Map<string, object[]>} members the class, by name
 * @returns {Set<string>} every member that can put a word on the canvas
 */
function deriveTextEmitters(members) {
  const emits = new Set();
  for (const [name, body] of members) {
    if (body.some((l) => TEXT_CALL_RE.test(l.code))) emits.add(name);
  }
  for (let pass = 0; pass < members.size + 1; pass++) {
    let grew = false;
    for (const [name, body] of members) {
      if (emits.has(name)) continue;
      const calls = new RegExp(`this\\.(?:${[...emits].join('|')})\\s*\\(`);
      if (body.some((l) => calls.test(l.code))) { emits.add(name); grew = true; }
    }
    if (!grew) return emits;
  }
  throw new Error('NavComputer.chromeless.test.js: the emitter closure did not settle.');
}

const TEXT_EMITTERS = deriveTextEmitters(MEMBERS);

/**
 * The floor the derivation has to clear.
 *
 * NOT a list to maintain — the scan uses `TEXT_EMITTERS`, whatever that turns out
 * to contain. This is the negative control on the DERIVATION: a closure that broke
 * and returned an empty set would make every call site trivially clean, and clean
 * is indistinguishable from correct until somebody checks. The three at the top
 * were the whole of the old hand-typed list; the six below them are what it missed.
 */
const EMITTERS_AT_MINIMUM = [
  '_drawSystemHeader', '_drawLeaderCallout', '_drawTooltip',
  '_drawTargetMarker', '_drawLabelPass', '_renderPrismMinimap',
  '_renderSectorOverlay', '_render2DLevel', '_renderLocal',
];

/**
 * The four methods where chrome is suppressed CALL BY CALL, so that the graphics
 * around each word keep drawing.
 *
 * `_renderComponentDetail` and `_renderPlanetDetail` are here even though the
 * design's inventory table lists neither — that table covers `_renderSystem` and
 * `render()`-level chrome. Both sub-views are reachable from SYSTEM by clicking a
 * planet, and while nothing in the cockpit routes pointer events at NAV today, a
 * sub-view that kept its words would be the one screen that contradicted the
 * panel it was reached from. Listing them here is what stops that being an
 * accident of nobody having looked.
 */
const PER_CALL_METHODS = ['_renderSystem', '_renderComponentDetail', '_renderPlanetDetail', '_renderHUD'];

/**
 * The two methods that are chrome ALL THE WAY DOWN, and so bail at the top.
 *
 * `_drawFarCompanionChips` is the item the handoff's list MISSED — it only draws
 * when `_systemData.farCompanions` is a non-empty array, so the baseline system
 * never exercises it and the captured baseline hash says nothing about it. Its
 * early return sits AFTER `_farChipRects = []`, which matters: bailing before that
 * would leave the panel carrying invisible hit regions for chips it never drew.
 */
const EARLY_RETURN_METHODS = ['_renderLevelTabs', '_drawFarCompanionChips'];

/**
 * Emitters whose own chrome is already accounted for, so a CALL to one needs no
 * guard of its own: the two that bail on `_bare` at their first line, and the four
 * that this same scan audits call by call. Everything else that can emit a word
 * must be called from behind a guard.
 */
const SELF_COVERED = new Set([...EARLY_RETURN_METHODS, ...PER_CALL_METHODS]);
const MUST_GUARD = [...TEXT_EMITTERS].filter((n) => !SELF_COVERED.has(n));
const CHROME_HELPER_RE = new RegExp(`this\\.(?:${MUST_GUARD.join('|')})\\s*\\(`);

// ── THE SCAN, AT MODULE SCOPE ──────────────────────────────────────────────

/** Every unguarded chrome site found, as a human-readable line. */
const FINDINGS = [];

/** Per-method detail, kept so the `it()` restatements can be specific. */
const SCANNED = {};

for (const name of EMITTERS_AT_MINIMUM) {
  if (!TEXT_EMITTERS.has(name)) {
    FINDINGS.push(
      `The derived emitter set does not contain \`${name}\`, which puts words on the canvas. The ` +
      'closure that builds that set is the instrument every call-site finding below is measured ' +
      'with; if it has stopped finding emitters, every call site reads clean for the wrong reason.',
    );
  }
}
if (MUST_GUARD.length < EMITTERS_AT_MINIMUM.length) {
  FINDINGS.push(
    `Only ${MUST_GUARD.length} text-emitting helpers require a guard at their call sites, which is ` +
    'fewer than the nine that were known to exist when this scan was written. The derivation has ' +
    'narrowed, and a narrowed allowlist is exactly the defect this replaced.',
  );
}

for (const name of PER_CALL_METHODS) {
  const body = methodSpan(name);
  const sites = body.filter((l) => TEXT_CALL_RE.test(l.code) || CHROME_HELPER_RE.test(l.code));
  const unguarded = sites.filter((l) => !l.guarded);
  SCANNED[name] = { first: body[0].n, last: body[body.length - 1].n, sites, unguarded };
  for (const l of unguarded) {
    FINDINGS.push(
      `${name} draws chrome UNGUARDED at NavComputer.js:${l.n} — \`${l.code}\`. Every word this ` +
      'class emits on the SYSTEM path has to sit behind `!this._bare` — either directly, or by ' +
      'being reached only through a method that bails on `_bare` at its first line — or the ' +
      'cockpit NAV panel keeps a label Max asked to be rid of. A CALL counts: three of the four ' +
      'real chrome sites in _renderSystem are helper calls, not fillText.',
    );
  }
  if (sites.length === 0) {
    FINDINGS.push(
      `${name} has no chrome sites at all, which means this scan is looking in the wrong place. ` +
      'A method that was emptied or renamed reports clean, and clean is indistinguishable from ' +
      'correct until somebody checks.',
    );
  }
}

for (const name of EARLY_RETURN_METHODS) {
  const body = methodSpan(name);
  const bail = body.find((l) => EARLY_RETURN_RE.test(l.code) && l.depth === body[0].depth + 1);
  const firstDraw = body.find((l) => /\bctx\.[a-zA-Z]/.test(l.code));
  SCANNED[name] = { first: body[0].n, last: body[body.length - 1].n, bail, firstDraw };
  if (!bail) {
    FINDINGS.push(
      `${name} is chrome from top to bottom and has no \`if (this._bare) return;\` at its ` +
      'top level. Without it the whole method draws on the chrome-less panel.',
    );
  } else if (firstDraw && bail.n > firstDraw.n) {
    FINDINGS.push(
      `${name} bails on the flag at NavComputer.js:${bail.n}, but has already drawn at ` +
      `NavComputer.js:${firstDraw.n}. A bail after the first stroke leaves part of the chrome on ` +
      'the glass, which is worse than leaving all of it: it reads as a rendering fault.',
    );
  }
}

/**
 * The default path must be untouched, and these three lines are where "untouched"
 * is decided. The two ternaries are the ONLY behavioural change outside a guard,
 * and each one has to reduce to the exact original expression when the flag is
 * false — `h - 50` for the chrome reserve and the literal `0.85` for the fill
 * factor. A plant that drops either default arm is invisible to a guard scan and
 * visible to nothing else until the byte-equality A/B is run in a browser.
 */
const DEFAULT_PATH_CLAIMS = [
  {
    what: 'the chrome reserve keeps its 50 px on the default path',
    re: /const\s+drawH\s*=\s*this\._bare\s*\?\s*h\s*:\s*h\s*-\s*50\s*;/,
  },
  {
    what: 'the fill factor keeps its literal 0.85 on the default path',
    re: /\(\s*this\._bare\s*\?\s*this\._systemFill\s*:\s*0\.85\s*\)/,
  },
  {
    what: 'the intent is initialised to false in the constructor',
    re: /this\.chromeless\s*=\s*false\s*;/,
  },
  {
    what: 'the fill factor is initialised to 0.95 in the constructor',
    re: /this\.systemFillFactor\s*=\s*0\.95\s*;/,
  },
  {
    what: 'the draw-time gate resolves the intent against the LIVE level, per draw',
    re: /get\s+_bare\s*\(\s*\)\s*\{[\s\S]{0,200}?navChromelessForLevel\s*\(\s*this\.level\s*\)/,
  },
  {
    what: 'the fill factor is read through a non-finite defence, not raw',
    re: /get\s+_systemFill\s*\(\s*\)\s*\{[\s\S]{0,200}?Number\.isFinite\s*\(\s*this\.systemFillFactor\s*\)/,
  },
];
for (const claim of DEFAULT_PATH_CLAIMS) {
  if (!claim.re.test(NAV_CODE)) {
    FINDINGS.push(
      `The default draw path is no longer pinned: ${claim.what} — not found in NavComputer.js. ` +
      'With the flag off this class must emit byte-identical pixels; that contract is the only ' +
      'reason a second draw mode was allowed into live game code at all.',
    );
  }
}

/**
 * The intent is a FIELD THE HOST OWNS. One assignment, in the constructor, and no
 * other. A `this.chromeless = ...` anywhere else would mean the class had started
 * writing its own host's intent, and the full-screen overlay — the same class,
 * which must keep its chrome at every level — would inherit whatever it decided.
 */
const FLAG_WRITES = LINES.filter((l) => /this\.chromeless\s*=[^=]/.test(l.code));
if (FLAG_WRITES.length !== 1) {
  FINDINGS.push(
    `NavComputer.js writes \`this.chromeless\` at ${FLAG_WRITES.length} places ` +
    `(${FLAG_WRITES.map((l) => l.n).join(', ')}); there must be exactly one, the constructor's ` +
    'default. Hosts state the intent; the class turns it into a per-draw verdict and does not ' +
    'edit the intent behind their back.',
  );
}

/**
 * ── NO GUARD MAY READ THE RAW INTENT ───────────────────────────────────────
 *
 * This is the structural statement of the whole 2026-07-29 correction, and it is
 * the one claim that makes the mid-frame race UNREPRESENTABLE rather than merely
 * fixed once. `chromeless` says what the host wants; `_bare` says what this frame
 * is. A drawing guard written on `chromeless` would strip levels 0-3 outright — the
 * cockpit sets the intent true unconditionally — and would take Max's ruling with
 * it. So the raw field may be read in exactly ONE place: inside `get _bare()`.
 */
const BARE_GETTER = methodSpan('_bare');
const FIRST_BARE = BARE_GETTER[0].n;
const LAST_BARE = BARE_GETTER[BARE_GETTER.length - 1].n;
const RAW_INTENT_READS = LINES.filter(
  (l) => /this\.chromeless\b/.test(l.code) &&
    !/this\.chromeless\s*=[^=]/.test(l.code) &&
    !(l.n >= FIRST_BARE && l.n <= LAST_BARE),
);
for (const l of RAW_INTENT_READS) {
  FINDINGS.push(
    `NavComputer.js:${l.n} reads the raw \`this.chromeless\` intent outside \`get _bare()\` — ` +
    `\`${l.code}\`. The intent is unconditional; only \`_bare\` knows whether THIS frame is a ` +
    'SYSTEM frame. Read raw, this line strips SECTOR and REGION too, and the autopilot star-pick ' +
    'drill loses the labels that are the only reason it is watchable.',
  );
}
if (!/navChromelessForLevel\s*\(\s*this\.level\s*\)/.test(BARE_GETTER.map((l) => l.code).join('\n'))) {
  FINDINGS.push(
    '`get _bare()` does not apply `navChromelessForLevel` to the LIVE `this.level`. Anything else ' +
    'is the mid-frame race back: render() moves _levelIndex to 4 part-way through the frame, and ' +
    'a verdict taken from anywhere but the live getter is a verdict from the level before that.',
  );
}

/**
 * There is exactly ONE definition of the level rule, and it is here — in the file
 * that applies it. The cockpit used to keep a second copy so that "the cockpit owns
 * what a cockpit panel looks like"; that copy was deleted with the caller-side gate,
 * because two definitions of one rule drift, and the drift symptom is that the file
 * you read says one thing and the file that runs says another.
 */
const POLICY_DEFS = NAV_CODE.match(/function\s+navChromelessForLevel\s*\(/g) || [];
if (POLICY_DEFS.length !== 1) {
  FINDINGS.push(
    `NavComputer.js defines navChromelessForLevel ${POLICY_DEFS.length} times; there must be ` +
    'exactly one, and it must be the only one in the repo.',
  );
}

/**
 * `systemFillFactor` is reached ONLY through `_systemFill`, and `_systemFill` only
 * on the bare arm of a `_bare` ternary. Read raw it would propagate a non-finite
 * write straight into the projection — one `undefined` from the lab's slider makes
 * `viewSize` NaN and the panel goes BLANK, which passes a "no words on the glass"
 * check for entirely the wrong reason. Read on the default path it would retune the
 * game's full-screen overlay every time Max moved that slider.
 */
const FILL_GETTER = methodSpan('_systemFill');
const FIRST_FILL = FILL_GETTER[0].n;
const LAST_FILL = FILL_GETTER[FILL_GETTER.length - 1].n;
const RAW_FILL_READS = LINES.filter(
  (l) => /this\.systemFillFactor\b/.test(l.code) &&
    !/this\.systemFillFactor\s*=[^=]/.test(l.code) &&
    !(l.n >= FIRST_FILL && l.n <= LAST_FILL),
);
for (const l of RAW_FILL_READS) {
  FINDINGS.push(
    `NavComputer.js:${l.n} reads \`systemFillFactor\` raw rather than through \`_systemFill\` — ` +
    `\`${l.code}\`. That field is public and the lab rewrites it every frame; one non-finite write ` +
    'NaNs viewSize and every arc() coordinate after it, and the panel goes silently blank.',
  );
}
const FILL_READS = LINES.filter(
  (l) => /this\._systemFill\b/.test(l.code) && !/this\._systemFill\s*\(/.test(l.code) &&
    !(l.n >= FIRST_FILL && l.n <= LAST_FILL),
);
for (const l of FILL_READS) {
  if (!/this\._bare/.test(l.code) && !l.guarded) {
    FINDINGS.push(
      `NavComputer.js:${l.n} reads the fill factor outside any \`_bare\` condition — ` +
      `\`${l.code}\`. That knob is Max's to set by eye; on the default path it would retune the ` +
      'full-screen overlay every time he moved a slider.',
    );
  }
}
if (FILL_READS.length === 0) {
  FINDINGS.push(
    'Nothing outside `_systemFill` reads the fill factor, so the knob is dead — a slider that ' +
    'appears to do nothing is the exact failure the removed dither parameter was deleted over.',
  );
}

if (FINDINGS.length > 0) {
  throw new Error(
    'NavComputer.js has unguarded chrome on the chrome-less path (AC-NAV-LEVEL-POLICY):\n  - ' +
    FINDINGS.join('\n  - ') +
    '\n\nThis check runs at module scope, during collection, so that it cannot be turned off by ' +
    'a focus helper on some other test in this file.',
  );
}

// ── STAND-INS FOR THE PAINTER ──────────────────────────────────────────────

/**
 * A PhosphorScreen-shaped kit. It records nothing about pixels because there are
 * none here; it exists so the painter has something of the right shape to hand
 * its ImageData to.
 */
function makeScreen(width = 64, height = 48) {
  return {
    width,
    height,
    clear() {},
    ctx: { putImageData() {} },
  };
}

/** A NavSource-shaped stand-in. `nav` is set by the caller, as NavSource does. */
function makeSource(width = 64, height = 48) {
  const src = {
    width,
    height,
    nav: null,
    resize(w, h) { src.width = w; src.height = h; return true; },
    render() {},
    readPixels() {
      return {
        width: src.width,
        height: src.height,
        data: new Array(src.width * src.height * 4).fill(0),
      };
    },
  };
  return src;
}

/**
 * A REAL NavComputer instance, minus its DOM-bound constructor.
 *
 * This is the point of putting this file in `src/ui/__tests__` rather than beside
 * the painter: `get level()` is the class's own, reading its own private `LEVELS`
 * table, so what the painter sees here is what it will see in the cockpit. The
 * sibling `NavPanel.test.js` drives a hand-written stub whose `level` returns
 * whatever the test author typed — which cannot catch the failure where the class
 * and the policy disagree about the spelling or the casing of a level name.
 *
 * `chromeless` is set here because the real constructor — the thing that would
 * have set it — is exactly what is being skipped.
 */
function navAtLevelIndex(levelIndex) {
  const nav = Object.create(NavComputer.prototype);
  nav._levelIndex = levelIndex;
  nav.chromeless = false;
  return nav;
}

/** Paint once and hand back the intent as the painter left it. */
function flagAfterPaint(nav) {
  const source = makeSource(64, 48);
  source.nav = nav;
  makeNavPainter(source)(makeScreen(64, 48), null, 0);
  return nav.chromeless;
}

/** Paint once and hand back the DRAW-TIME verdict — what the guards would see. */
function bareAfterPaint(nav) {
  flagAfterPaint(nav);
  return nav._bare;
}

/**
 * The class's draw-time resolution, driven from an EXPLICIT bare intent rather
 * than from the painter's.
 *
 * ⭐ 2026-08-01: the cockpit painter now states `chromeless = false`
 * unconditionally (Max: "we no longer need the panel to render differently when
 * its zoomed vs non zoomed in the system view"), so painting can no longer
 * produce a TRUE verdict and every test that observed the resolution THROUGH the
 * painter went uniformly false. The resolution rule itself — bare only at
 * SYSTEM, re-read per draw, never cached across a mid-frame level move — is
 * unchanged and still worth pinning, so those tests now set the intent directly.
 * That keeps them about the CLASS, which is this file's actual subject, instead
 * of about one host's current policy.
 */
function bareWithIntent(nav) {
  nav.chromeless = true;
  return nav._bare;
}

/**
 * Everything a level name could arrive as. The strings first, then the shapes an
 * out-of-range index and a missing snapshot actually produce.
 */
const NOT_SYSTEM = [
  'galaxy', 'sector', 'region', 'prism', 'unknown', '',
  'SYSTEM', 'System', 'sYsTeM', 'systems', 'subsystem', ' system', 'system ',
  'star', 'planet', 'local',
  undefined, null, 0, 4, NaN, false, true, {}, [], ['system'],
];

/** A label that survives being printed for any of the above. */
const label = (v) => (typeof v === 'string' ? `'${v}'` : Object.prototype.toString.call(v) + ' ' + String(v));

// ── 0. THE SELF-GUARD AND THE SCAN, RESTATED FOR THE REPORT ────────────────

describe('NavComputer.chromeless.test.js — this file does not disable itself', () => {
  it('contains no skip or focus helper (also enforced at module scope)', () => {
    expect(DISABLED_RE.test(SELF_CODE)).toBe(false);
  });

  it('recognises the CHAINED helpers, which are the ones the old pattern let through', () => {
    // Negative controls for the instrument. ASSEMBLED rather than written out: a
    // literal would sit in this file's own source, where the module-scope scan
    // reads it — strings are deliberately kept in that view — and the file would
    // refuse to collect while accusing itself.
    for (const runner of RUNNERS) {
      for (const chain of ['', '.concurrent', '.sequential', '.each([1])', '.concurrent.shuffle']) {
        for (const suffix of DISABLERS) {
          const bad = `${runner}${chain}.${suffix}(`;
          expect(DISABLED_RE.test(bad), bad).toBe(true);
        }
      }
    }
    for (const fine of ['it(', 'describe(', 'test(', 'RE.test(', 'expect(x).toBe(', 'audit(fails)']) {
      expect(DISABLED_RE.test(fine), fine).toBe(false);
    }
  });
});

describe('the source scan found no unguarded chrome (the check itself ran at module scope)', () => {
  it('reports an empty finding list', () => {
    // If this ever fails, the module-scope throw above failed first and the file
    // never collected — so seeing this line RED is not the expected shape of the
    // failure. It is here to name the guarantee in the report, not to enforce it.
    expect(FINDINGS).toEqual([]);
  });

  it('actually looked at chrome sites in each of the four per-call methods', () => {
    // A scan that found nothing to scan reports clean. These counts are the proof
    // it had something to be right about, and they are lower bounds rather than
    // exact numbers so that ADDING a properly guarded label does not fail a test
    // whose subject is unguarded ones.
    for (const name of PER_CALL_METHODS) {
      expect(SCANNED[name].sites.length, `${name} chrome sites`).toBeGreaterThan(0);
      expect(SCANNED[name].unguarded, `${name} unguarded chrome`).toEqual([]);
    }
    expect(SCANNED._renderSystem.sites.length, '_renderSystem chrome sites').toBeGreaterThanOrEqual(7);
  });

  it('DERIVES the helper allowlist rather than carrying a typed one', () => {
    // MAJOR 2. The predecessor named three helpers and missed six, and a fourth
    // helper — `this._drawTargetMarker(...)` unguarded in `_renderSystem` — left
    // this file at twenty-five passed. Three of the four real SYSTEM chrome sites
    // ARE helper calls, so a fourth helper is the likely shape of the very
    // regression this scan exists to catch.
    for (const name of EMITTERS_AT_MINIMUM) {
      expect(TEXT_EMITTERS.has(name), `${name} is not in the derived emitter set`).toBe(true);
    }
    // The closure reaches beyond the methods that call fillText themselves.
    expect(TEXT_EMITTERS.has('render'), 'the transitive step found nothing').toBe(true);
    expect(MUST_GUARD.length, 'the must-guard set shrank').toBeGreaterThanOrEqual(EMITTERS_AT_MINIMUM.length);
    // And it is genuinely a closure, not a re-listing: run it on a toy class where
    // the only route to a word is two calls deep.
    const toy = new Map(Object.entries({
      _leaf: [{ code: 'ctx.fillText(1, 0, 0);' }],
      _mid: [{ code: 'this._leaf(ctx);' }],
      _top: [{ code: 'this._mid(ctx);' }],
      _elsewhere: [{ code: 'ctx.arc(0, 0, 1, 0, 7);' }],
    }));
    expect([...deriveTextEmitters(toy)].sort()).toEqual(['_leaf', '_mid', '_top']);
  });

  it('would catch a fourth helper dropped unguarded into _renderSystem', () => {
    // The plant, run as a control rather than described. `_drawTargetMarker` is a
    // real text-emitting method of this class that `_renderSystem` does not call;
    // spliced in unguarded it must be seen, and spliced in guarded it must not be.
    const body = methodSpan('_renderSystem');
    const planted = { code: 'this._drawTargetMarker(ctx, 0, 0);', guarded: false, n: -1, depth: 0 };
    const shielded = { code: 'if (!this._bare) this._drawTargetMarker(ctx, 0, 0);', guarded: true, n: -1, depth: 0 };
    const scan = (lines) => lines
      .filter((l) => TEXT_CALL_RE.test(l.code) || CHROME_HELPER_RE.test(l.code))
      .filter((l) => !l.guarded);
    expect(scan([...body, planted]).length, 'the plant was not seen').toBe(1);
    expect(scan([...body, shielded]).length, 'a guarded call was reported as a finding').toBe(0);
    expect(scan(body).length, 'the real method is not clean, so this control proves nothing').toBe(0);
  });

  it('lets a call through only when the callee covers itself', () => {
    // `_renderSystem` dispatches to `_renderComponentDetail` / `_renderPlanetDetail`
    // unguarded, and that is correct: both are audited call-by-call by this same
    // scan. Same for the two that bail on `_bare` at their first line. Anything
    // else must be called from behind a guard, and the way to be sure that
    // distinction is real is to check it is not vacuous.
    for (const name of SELF_COVERED) expect(TEXT_EMITTERS.has(name), name).toBe(true);
    for (const name of SELF_COVERED) expect(CHROME_HELPER_RE.test(`this.${name}(ctx);`), name).toBe(false);
    for (const name of MUST_GUARD) expect(CHROME_HELPER_RE.test(`this.${name}(ctx);`), name).toBe(true);
  });

  it('reads the raw intent in exactly one place — inside get _bare()', () => {
    // MAJOR 1, stated structurally. `chromeless` is the host's unconditional wish;
    // `_bare` is this frame's verdict. A drawing guard on the raw field would strip
    // SECTOR and REGION as well, because the cockpit sets the wish at every level.
    expect(RAW_INTENT_READS, 'a guard reads the raw intent').toEqual([]);
    expect(BARE_GETTER.map((l) => l.code).join(' ')).toMatch(/this\.chromeless/);
    expect(BARE_GETTER.map((l) => l.code).join(' ')).toMatch(/navChromelessForLevel\(this\.level\)/);
  });

  it('keeps ONE definition of the level rule, in the file that applies it', () => {
    expect(POLICY_DEFS.length).toBe(1);
    expect(NavPanelModule.navChromelessForLevel, 'NavPanel kept a second copy').toBeUndefined();
  });

  it('bails at the top of the two methods that are chrome all the way down', () => {
    for (const name of EARLY_RETURN_METHODS) {
      const m = SCANNED[name];
      expect(m.bail, `${name} has no top-level flag bail`).toBeTruthy();
      expect(m.firstDraw, `${name} draws nothing, so the ordering claim is vacuous`).toBeTruthy();
      expect(m.bail.n, `${name} bails after it has already drawn`).toBeLessThan(m.firstDraw.n);
    }
  });

  it('leaves the far-companion chips suppressed — the item the handoff missed', () => {
    // `_drawFarCompanionChips` only draws for a wide binary, so the baseline
    // system never exercises it and the captured baseline hash is silent about it.
    // Its bail sits AFTER the two rect resets on purpose: bailing earlier would
    // leave invisible hit regions for chips that were never drawn.
    const m = SCANNED._drawFarCompanionChips;
    const body = methodSpan('_drawFarCompanionChips');
    // The two RESETS, matched by the value they write — `_hoveredFarChip` is also
    // assigned a chip inside the draw loop below, which is not a reset and must
    // not be counted as one.
    const resets = body.filter((l) => /this\._(?:farChipRects\s*=\s*\[\]|hoveredFarChip\s*=\s*null)/.test(l.code));
    expect(resets.length, 'the rect and hover resets are gone').toBe(2);
    for (const r of resets) expect(r.n, 'a reset moved below the bail').toBeLessThan(m.bail.n);
  });

  it('leaves the intent to its host — one write, in the constructor, and no other', () => {
    expect(FLAG_WRITES.length).toBe(1);
    expect(FLAG_WRITES[0].code).toMatch(/this\.chromeless\s*=\s*false/);
  });

  it('consults the fill factor only on the bare arm, and only through _systemFill', () => {
    expect(RAW_FILL_READS, 'the raw public field is read on a draw path').toEqual([]);
    expect(FILL_READS.length, 'nothing reads the fill factor, so the knob is dead').toBeGreaterThan(0);
    for (const l of FILL_READS) expect(l.code, `NavComputer.js:${l.n}`).toMatch(/this\._bare/);
  });

  it('defends the fill factor against a non-finite write instead of blanking', () => {
    // The lab rewrites `systemFillFactor` from outside on every frame. One
    // `undefined` or NaN makes `viewSize` NaN, and with it every arc() coordinate:
    // the panel goes BLANK — which passes a "no words on the glass" check for
    // entirely the wrong reason, and is the failure mode this workstream keeps
    // guarding against, a panel that fails without looking like it failed.
    const nav = Object.create(NavComputer.prototype);
    for (const bad of [undefined, null, NaN, Infinity, -Infinity, 'wide', {}]) {
      nav.systemFillFactor = bad;
      expect(Number.isFinite(nav._systemFill), label(bad)).toBe(true);
      expect(nav._systemFill, label(bad)).toBe(0.95);
    }
    // And a real value is passed straight through — a defence that clamped
    // everything would be a dead knob wearing a safety belt.
    for (const good of [0.5, 0.85, 0.95, 1.2]) {
      nav.systemFillFactor = good;
      expect(nav._systemFill, String(good)).toBe(good);
    }
  });

  it('pins every default-path arm, which no guard scan can see', () => {
    for (const claim of DEFAULT_PATH_CLAIMS) expect(NAV_CODE, claim.what).toMatch(claim.re);
  });
});

describe('the scanner is not fooled by the things that would make it lie', () => {
  // The scanner is the instrument every finding above is measured with, so it gets
  // its own negative controls. Each of these is a shape that actually occurs in
  // NavComputer.js — 48 backticks in `_renderSystem` alone — and each one, read
  // naively, produces the answer GUARDED, which is the direction that hides bugs.
  it('does not count braces inside comments, strings or template text', () => {
    const sample = [
      'a() {',
      '  // } this brace is a comment',
      '  const s = "} also not a brace";',
      '  const t = `plain ${1 + 1} text with a } in it`;',
      '  ctx.fillText(s, 0, 0);',
      '}',
    ].join('\n');
    const scanned = readGuardedLines(sample);
    const draw = scanned.find((l) => /fillText/.test(l.code));
    expect(draw.depth, 'the scanner lost track of the block depth').toBe(1);
    expect(draw.guarded, 'an unguarded draw was reported as guarded').toBe(false);
  });

  it('sees an inline guard, a block guard and no guard as three different things', () => {
    const sample = [
      'a() {',
      '  if (!this._bare) ctx.fillText(1, 0, 0);',
      '  if (x && !this._bare) {',
      '    ctx.fillText(2, 0, 0);',
      '  }',
      '  ctx.fillText(3, 0, 0);',
      '}',
    ].join('\n');
    const scanned = readGuardedLines(sample).filter((l) => /fillText/.test(l.code));
    expect(scanned.map((l) => l.guarded)).toEqual([true, true, false]);
  });

  it('closes a block guard at its closing brace rather than running to the end of the method', () => {
    const sample = [
      'a() {',
      '  if (!this._bare) {',
      '    ctx.fillText(1, 0, 0);',
      '  } else {',
      '    ctx.fillText(2, 0, 0);',
      '  }',
      '}',
    ].join('\n');
    const scanned = readGuardedLines(sample).filter((l) => /fillText/.test(l.code));
    expect(scanned.map((l) => l.guarded)).toEqual([true, false]);
  });
});

// ── 1. THE POLICY (AC-NAV-LEVEL-POLICY) ────────────────────────────────────

describe('navChromelessForLevel — SYSTEM and nowhere else, which is Max\'s ruling', () => {
  it('says yes to system, and only ever to system', () => {
    expect(navChromelessForLevel('system')).toBe(true);
  });

  it('says no to all four levels the autopilot drills through', () => {
    // Max ruled on 2026-07-29 that the star-pick drill shows WITH its chrome.
    // `AutopilotNavSequence` writes `_levelIndex` 0 → 1 → 2 → 3 directly, and
    // SECTOR and REGION are mostly labels: stripped, they are a bare grid, and you
    // would be watching the ship choose a star whose name you cannot read. This is
    // also what makes levels 0–3 need zero new code.
    for (const level of ['galaxy', 'sector', 'region', 'prism']) {
      expect(navChromelessForLevel(level), level).toBe(false);
    }
  });

  it('fails towards CHROME for everything it does not recognise', () => {
    // The direction is the whole safety of it. Failing this way, a level added
    // later draws exactly as its author built it. Failing the other way strips a
    // screen nobody has looked at, and "a nav level is missing its labels" is not
    // a symptom anybody traces back to a one-line policy function.
    for (const level of NOT_SYSTEM) {
      expect(navChromelessForLevel(level), label(level)).toBe(false);
    }
  });

  it('is total — it returns an actual boolean for every one of those, never undefined', () => {
    // A policy that returns undefined would set `chromeless = undefined`, which is
    // falsy and therefore LOOKS right, until something reads the flag back.
    for (const level of ['system', ...NOT_SYSTEM]) {
      expect(typeof navChromelessForLevel(level), label(level)).toBe('boolean');
    }
  });

  it('needs no DOM and no instance — it is a function of a string', () => {
    expect(navChromelessForLevel.length).toBe(1);
    // Called with no receiver at all. A policy that reached for `this` could not be
    // checked without building the thing it is supposed to be independent of.
    const detached = navChromelessForLevel;
    expect(detached('system')).toBe(true);
  });
});

describe('there is exactly ONE definition of the rule, and it is here', () => {
  // There used to be two — this one, and a copy in `cockpit/panels/NavPanel.js` so
  // that "the cockpit owns what a cockpit panel looks like". The copy went with the
  // caller-side gate on 2026-07-29: the gate has to be applied at draw time, so the
  // rule belongs in the file that draws. Two definitions of one rule drift, and the
  // drift symptom is the worst kind — the file you open says one thing and the file
  // that runs says another.
  it('is not re-exported from the cockpit panel', () => {
    expect(NavPanelModule.navChromelessForLevel).toBeUndefined();
    expect(Object.keys(NavPanelModule).sort()).toEqual(['default', 'makeNavPainter']);
  });

  it('compares against the class\'s own lower-case spelling', () => {
    expect(NAV_CODE).toMatch(/level === 'system'/);
    expect(navChromelessForLevel('SYSTEM')).toBe(false);
  });
});

// ── 2. THE POLICY MEETS THE REAL CLASS ─────────────────────────────────────

describe('the policy agrees with the strings NavComputer actually emits', () => {
  // This is the join the sibling NavPanel.test.js cannot make: it drives a stub
  // whose `level` returns what the test author typed. Here `get level()` is the
  // real one, indexing the real private `LEVELS` table, so a rename or a re-casing
  // in that table shows up as a failure rather than as a panel that quietly kept
  // its chrome.
  it('agrees at every index the class knows about', () => {
    expect([0, 1, 2, 3, 4].map((i) => navAtLevelIndex(i).level))
      .toEqual(['galaxy', 'sector', 'region', 'prism', 'system']);
    expect([0, 1, 2, 3, 4].map((i) => navChromelessForLevel(navAtLevelIndex(i).level)))
      .toEqual([false, false, false, false, true]);
  });

  it('agrees at the indices AutopilotNavSequence can leave behind', () => {
    // The sequence writes `_levelIndex` directly; the getter answers 'unknown' off
    // the end of the table, and the policy has to read that as chrome.
    for (const i of [-1, 5, 99, undefined, null]) {
      const nav = navAtLevelIndex(i);
      expect(nav.level, `index ${String(i)}`).toBe('unknown');
      expect(navChromelessForLevel(nav.level), `index ${String(i)}`).toBe(false);
    }
  });
});

// ── 3. THE PAINTER STATES AN INTENT; THE CLASS REACHES THE VERDICT ─────────

describe('the painter states the intent, and the class resolves it per draw', () => {
  // An intent nothing states leaves NAV drawing exactly as it always did — and
  // "the panel looks the same as before" is the one symptom nobody investigates.
  // These drive the real painter against a real `NavComputer.prototype`, so both
  // halves of the seam are the shipped ones.
  it('states the intent unconditionally, at every level there is', () => {
    // AMENDED 2026-08-01: the stated intent is now `false` at every level, not
    // `true`. UNCONDITIONAL is still the property under test — the painter must
    // not start computing this from the level again.
    for (const i of [0, 1, 2, 3, 4, -1, 99]) {
      expect(flagAfterPaint(navAtLevelIndex(i)), `level index ${i}`).toBe(false);
    }
  });

  it('never reaches a TRUE verdict through the painter, at any level', () => {
    // The always-chromed ruling, observed end to end: SYSTEM included.
    for (const i of [0, 1, 2, 3, 4, -1, 99]) {
      expect(bareAfterPaint(navAtLevelIndex(i)), `level index ${i}`).toBe(false);
    }
  });

  it('still resolves TRUE only at SYSTEM when a host DOES ask for bare', () => {
    // The class rule is untouched by the host policy change; drive it directly.
    expect(bareWithIntent(navAtLevelIndex(4)), 'SYSTEM').toBe(true);
    for (const i of [0, 1, 2, 3, -1, 99]) {
      expect(bareWithIntent(navAtLevelIndex(i)), `level index ${i}`).toBe(false);
    }
  });

  it('reaches FALSE at every level the autopilot drills through', () => {
    // Max's ruling, enforced with no cooperation from the caller: the star-pick
    // drill keeps its chrome even though the cockpit asked for bare at every level.
    for (const i of [0, 1, 2, 3]) {
      expect(bareAfterPaint(navAtLevelIndex(i)), `level index ${i}`).toBe(false);
    }
  });

  it('reaches FALSE at an index off the end of the table', () => {
    for (const i of [-1, 99]) {
      expect(bareAfterPaint(navAtLevelIndex(i)), `level index ${i}`).toBe(false);
    }
  });

  it('is a real boolean, never the level string or undefined', () => {
    // `_bare = 'system'` is truthy and would work by accident at SYSTEM while being
    // wrong everywhere the verdict is read back, logged or negated.
    for (const i of [0, 4]) {
      expect(typeof bareAfterPaint(navAtLevelIndex(i)), `level index ${i}`).toBe('boolean');
    }
    // Including when a host assigns rubbish to the intent — `&&` would hand that
    // rubbish straight back to every guard.
    const nav = navAtLevelIndex(4);
    for (const junk of [undefined, null, 0, '', NaN]) {
      nav.chromeless = junk;
      expect(typeof nav._bare, label(junk)).toBe('boolean');
      expect(nav._bare, label(junk)).toBe(false);
    }
  });

  it('stays FALSE for a host that never asked, which is what byte-equality rests on', () => {
    // The game's full-screen overlay is this same class and sets nothing. If the
    // verdict could be true without the intent, the overlay would lose its chrome
    // the moment somebody entered a system.
    const nav = navAtLevelIndex(4);
    nav.chromeless = false;
    expect(nav._bare).toBe(false);
  });
});

// ── 4. THE MID-FRAME RACE — THE REGRESSION TEST FOR MAJOR 1 ────────────────

describe('the level moving MID-FRAME cannot make the wrong screen draw', () => {
  // THIS IS THE ONE. `NavComputer.render()` assigns `this._levelIndex = 4` part-way
  // through the frame, inside the `_systemZoomAnim` completion block. Under the
  // original design the painter had already read `level`, run the policy and stored
  // a boolean — from the PRE-transition level — so the first SYSTEM frame of a
  // prism→system zoom drew fully chromed: twelve text calls plus a published
  // `_autopilotButtonRect`, a live invisible button on a screen contracted to have
  // none. Reproduced, not theorised.
  //
  // The fix is that the verdict is a GETTER, re-read at each guard. These tests
  // drive the real getter across a level change that happens between reads, which is
  // exactly what a mid-frame transition is.

  it('goes bare on the SAME frame the level becomes SYSTEM', () => {
    // AMENDED 2026-08-01: the intent is now set DIRECTLY, not via the painter.
    // The cockpit states `chromeless = false` unconditionally since Max's
    // always-chromed ruling, so painting can no longer produce a TRUE verdict —
    // but the mid-frame race this test exists for is a property of the GETTER,
    // not of any host's policy, and it must stay pinned.
    const nav = navAtLevelIndex(3);
    nav.chromeless = true;                     // a host that genuinely wants bare
    expect(nav._bare, 'PRISM must keep its chrome').toBe(false);

    nav._levelIndex = 4;                       // _systemZoomAnim lands, mid-render
    expect(nav._bare, 'the first SYSTEM frame drew fully chromed').toBe(true);
  });

  it('keeps its chrome on the SAME frame the level leaves SYSTEM', () => {
    // The mirror. `handleEscape` and the level tabs both move `_levelIndex` down,
    // and a latched verdict would strip the level it landed on.
    // AMENDED 2026-08-01: the intent is now set DIRECTLY, not via the painter.
    // The cockpit states `chromeless = false` unconditionally since Max's
    // always-chromed ruling, so painting can no longer produce a TRUE verdict —
    // but the mid-frame race this test exists for is a property of the GETTER,
    // not of any host's policy, and it must stay pinned.
    const nav = navAtLevelIndex(4);
    nav.chromeless = true;
    expect(nav._bare).toBe(true);
    nav._levelIndex = 2;
    expect(nav._bare, 'REGION drew stripped, so its labels were gone').toBe(false);
  });

  it('re-reads the verdict at every guard, not once per frame', () => {
    // A render that flips the level between two draw calls. Each guard asks again,
    // so the words that come after the transition are suppressed and the ones
    // before it are not — which is precisely what "resolved at draw time" means.
    // AMENDED 2026-08-01: the intent is now set DIRECTLY, not via the painter.
    // The cockpit states `chromeless = false` unconditionally since Max's
    // always-chromed ruling, so painting can no longer produce a TRUE verdict —
    // but the mid-frame race this test exists for is a property of the GETTER,
    // not of any host's policy, and it must stay pinned.
    const nav = navAtLevelIndex(3);
    nav.chromeless = true;
    const seen = [];
    seen.push(nav._bare);          // early in the frame — still PRISM
    nav._levelIndex = 4;           // the zoom completes
    seen.push(nav._bare);          // later in the same frame — now SYSTEM
    seen.push(nav._bare);
    expect(seen).toEqual([false, true, true]);
  });

  it('cannot be latched, because no guard holds a copy of it', () => {
    // The structural half of the same claim, and the half that survives a rewrite:
    // if some future guard cached the verdict in a local at the top of `render()`,
    // the race would come straight back and these behavioural tests would still
    // pass. So the source is checked too — every guard reads `this._bare` inline.
    const guardLines = LINES.filter((l) => /_bare/.test(l.code) && !/get\s+_bare/.test(l.code));
    expect(guardLines.length, 'nothing reads the verdict at all').toBeGreaterThan(20);
    for (const l of guardLines) {
      expect(l.code, `NavComputer.js:${l.n} does not read the verdict off \`this\``)
        .toMatch(/this\._bare\b/);
    }
    // And nowhere assigns it — a `_bare` field would shadow the getter and freeze
    // whatever value was current when it was written.
    const assigned = LINES.filter((l) => /(?:this\.)?_bare\s*=[^=]/.test(l.code));
    expect(assigned.map((l) => `${l.n}: ${l.code}`), 'the verdict is stored somewhere').toEqual([]);
  });

  it('needs no cooperation from the painter — the intent is the same at both levels', () => {
    // The proof that the fix is not just "the painter got better at it". The painter
    // writes the identical value either side of the transition; ALL of the level
    // sensitivity lives in the class.
    const before = navAtLevelIndex(3);
    const after = navAtLevelIndex(4);
    // The painter writes the IDENTICAL value either side of the transition — that
    // claim is unchanged by the always-chromed ruling, only its value is (false
    // now, true before). This is still the proof that no level sensitivity leaked
    // into the painter.
    expect(flagAfterPaint(before)).toBe(flagAfterPaint(after));
    expect(flagAfterPaint(before), 'the painter computed something from the level').toBe(false);
    // With a host that DOES want bare, all the level sensitivity is the class's.
    before.chromeless = true; after.chromeless = true;
    expect(before._bare).toBe(false);
    expect(after._bare).toBe(true);
  });
});
