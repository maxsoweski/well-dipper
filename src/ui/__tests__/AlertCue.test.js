/**
 * AlertCue — lane F (cockpit-screen-content-2026-07-28), AC-ALERT-CUE-ONE-INK.
 *
 * The cockpit glass is Phosphor: ONE INK on black. src/ui/SupercruiseHud.js, the
 * full-screen 2D HUD, is not — it tells its three warnings apart BY COLOUR (a
 * green fill for the safe label, amber for slow down, red for the mass-lock
 * banner). Porting that block onto a panel is a fifteen-line copy-paste that
 * would put three hues on the glass, so the no-colour property is enforced HERE,
 * mechanically, rather than left to whoever writes the panel remembering a rule.
 *
 * The load-bearing test is the recursive walk over the returned object. It is
 * recursive on purpose: a colour smuggled in as `drop.style.color` two levels
 * down is exactly what a shallow check misses, and exactly what a renderer would
 * happily honour. The walk whitelists both the TYPES and the STRINGS that may
 * appear at all, so `tone: 'amber'` — a colour with no '#' in it — trips, and so
 * does `colorHex: 0xff7b6b`, which is the HUD's red to the byte in the form
 * three.js wants and carries no text a colour check could recognise.
 *
 * The other half is that the words must match the HUD CHARACTER FOR CHARACTER,
 * em dash included. That is proved against SupercruiseHud.js's own source TEXT
 * rather than by importing it: its constructor calls document.createElement, and
 * this project's vitest runs with no jsdom, no happy-dom and no node-canvas
 * (see package.json / vite.config.js — no `test.environment` is configured, so
 * the environment is plain node). Reading the file keeps the coupling and keeps
 * the suite DOM-free.
 *
 * No skip helper appears anywhere below, and that is proved over this file's own
 * source at MODULE SCOPE rather than from inside a test — see assertNoSkipHelpers
 * for why a guard living in an `it()` cannot police `.only`. Lane E's
 * tests/cockpit-geometry.test.js uses describe.skipIf and is entitled to: it has a
 * separate gate test standing behind it. Copying the skip without the gate is how
 * a suite goes green on a missing asset, so lane F does not copy it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ALERT_TEXT, BLINK, buildAlertCue } from '../AlertCue.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Source text with comments removed — the check is about code, never prose. */
function codeOf(path) {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments
    .replace(/^\s*\/\/.*$/gm, '');         // line comments
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Visit every value in an object graph, at any depth, with the path that reached
 * it. `seen` is a cycle backstop: without it a self-referential return value
 * would hang the runner, and a hang reads like an infrastructure problem rather
 * than the test failure it actually is.
 */
function walk(value, path, visit, seen = new Set()) {
  visit(value, path);
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  for (const key of Object.keys(value)) {
    visit(key, `${path} (key ${key})`);
    walk(value[key], `${path}.${key}`, visit, seen);
  }
}

/**
 * Scan this file for a helper that would take tests OUT of the run — `.skip`,
 * `.only`, `.todo`, `.fails` — and throw if one is there.
 *
 * Comments are stripped first (the header discusses lane E's skipIf) and the
 * pattern is assembled from fragments, because a literal one would match itself
 * and fail a file that is in fact clean.
 *
 * IT IS CALLED AT MODULE SCOPE, NOT FROM AN `it()`, and that is the whole point.
 * A guard living inside a test cannot police `.only`: a stray `it.only` anywhere
 * else in the file skips the guard along with everything else. Measured, not
 * assumed — `it.only` on one test here reports "Test Files 1 passed | Tests 1
 * passed | 10 skipped", green, with the guard among the ten that never ran.
 * Throwing during collection cannot be skipped by anything, so it fires first.
 */
function assertNoSkipHelpers() {
  const code = codeOf(join(HERE, 'AlertCue.test.js'));
  const helpers = ['skip', 'only', 'todo', 'fails'];
  const pattern = new RegExp(['describe', 'it', 'test']
    .flatMap((k) => helpers.map((h) => `${k}\\.${h}`)).join('|'));
  const hit = code.match(pattern);
  if (hit) {
    throw new Error(
      `AlertCue.test.js contains '${hit[0]}' — a helper that takes tests out of the ` +
      `run while the file still reports green. Lane E's tests/cockpit-geometry.test.js ` +
      `is allowed its skipIf because a separate gate test stands behind it; lane F has ` +
      `no such gate, so it has no such helper.`,
    );
  }
  return true;
}

assertNoSkipHelpers();

const DROP_STATES = ['none', 'in-window', 'too-fast'];
const MASS_LOCK_FLAGS = [false, true];

describe('buildAlertCue — words and a blink, never a colour (AC-ALERT-CUE-ONE-INK)', () => {
  it('maps each drop state to its own line, and says nothing at all for none', () => {
    expect(buildAlertCue({ dropState: 'in-window' }).drop)
      .toEqual({ text: 'SAFE TO DROP', blink: 'steady' });
    expect(buildAlertCue({ dropState: 'too-fast' }).drop)
      .toEqual({ text: 'SLOW DOWN', blink: 'slow' });
    // 'none' is null, not a cue with empty text: a panel tests one thing.
    expect(buildAlertCue({ dropState: 'none' }).drop).toBeNull();
    expect(buildAlertCue().drop).toBeNull();
  });

  it('raises the mass-lock banner on the hint, and drops it when the hint clears', () => {
    expect(buildAlertCue({ massLockHint: true }).massLock)
      .toEqual({ text: 'TOO CLOSE — SUBLIGHT ONLY', blink: 'fast' });
    expect(buildAlertCue({ massLockHint: false }).massLock).toBeNull();
    expect(buildAlertCue().massLock).toBeNull();
  });

  it('escalates the blink tier with the urgency, because one ink has nothing else', () => {
    // Steady = reassurance, slow = nag, fast = alarm. Swapping two tiers makes
    // "you may drop safely" flash harder than "the drive refused you".
    expect(buildAlertCue({ dropState: 'in-window' }).drop.blink).toBe(BLINK.STEADY);
    expect(buildAlertCue({ dropState: 'too-fast' }).drop.blink).toBe(BLINK.SLOW);
    expect(buildAlertCue({ massLockHint: true }).massLock.blink).toBe(BLINK.FAST);
    expect(new Set(Object.values(BLINK)).size).toBe(3);   // three distinct tiers
  });

  it('reports the two fields independently — all 3 x 2 rows, no interaction', () => {
    // SupercruiseHud draws the mass-lock line as its own centre-screen banner,
    // NOT as a fourth drop state, so neither field may suppress the other and
    // there is no precedence rule to get wrong. The whole table is therefore
    // each input read separately; any row where one input changed the OTHER
    // field's answer would be a precedence rule that crept in.
    const expectedDrop = {
      'none': null,
      'in-window': { text: ALERT_TEXT.DROP_SAFE, blink: BLINK.STEADY },
      'too-fast': { text: ALERT_TEXT.DROP_SLOW, blink: BLINK.SLOW },
    };
    const expectedMassLock = {
      false: null,
      true: { text: ALERT_TEXT.MASS_LOCK, blink: BLINK.FAST },
    };

    let rows = 0;
    for (const dropState of DROP_STATES) {
      for (const massLockHint of MASS_LOCK_FLAGS) {
        const cue = buildAlertCue({ dropState, massLockHint });
        const where = `dropState=${dropState} massLockHint=${massLockHint}`;

        expect(cue.drop, where).toEqual(expectedDrop[dropState]);
        expect(cue.massLock, where).toEqual(expectedMassLock[String(massLockHint)]);
        // The shape is exactly the two pinned fields — another module imports
        // this surface, so a third field appearing is a contract change.
        expect(Object.keys(cue).sort(), where).toEqual(['drop', 'massLock']);
        rows++;
      }
    }
    expect(rows).toBe(6);   // the whole table ran, not a subset
  });

  it('carries NO colour anywhere in the returned object, at any depth', () => {
    // THE load-bearing test. The HUD distinguishes these same three warnings with
    // #7bff9e / #ffb84d / #ff7b6b, and a port that brought one along would break
    // Phosphor's one-ink law on the first close approach. Recursive, so a colour
    // nested two levels down (drop.style.color) trips it too.
    //
    // It checks TYPES as well as string contents, and that is the half that is
    // easy to leave out. A colour does not have to be a string: `colorHex:
    // 0xff7b6b` is the HUD's red exactly, three.js and canvas both take it in that
    // form, and it contains no '#', no 'rgb(' and no letters a whitelist could
    // recognise. Every text check in this test is blind to it. So the rule is
    // stated the other way round — a cue may contain ONLY containers, nulls, and
    // strings from the pinned vocabulary. A number anywhere is a failure whatever
    // it means, because nothing a cue legitimately says is a number.
    const allowedStrings = new Set([...Object.values(ALERT_TEXT), ...Object.values(BLINK)]);
    const hudColours = ['#7bff9e', '#ffb84d', '#ff7b6b'];

    // Counts the words a cue actually SAYS — non-key string values, nothing else.
    // Counting every visit instead would include the containers and the field
    // names, which exist whether or not a single cue was produced, and would let a
    // module that returns { drop: null, massLock: null } for all six rows sail past
    // the vacuity check below. Measured: that degenerate module yields 30 visits
    // and 0 words.
    let words = 0;
    for (const dropState of DROP_STATES) {
      for (const massLockHint of MASS_LOCK_FLAGS) {
        const cue = buildAlertCue({ dropState, massLockHint });
        const where = `dropState=${dropState} massLockHint=${massLockHint}`;

        walk(cue, 'cue', (value, path) => {
          const isFieldName = path.includes('(key ');
          if (!isFieldName && typeof value === 'string') words++;

          if (typeof value === 'string') {
            // (1) nothing that even starts like a hex colour.
            expect(value.startsWith('#'), `${where}: ${path} = ${JSON.stringify(value)}`)
              .toBe(false);
            // (2) no colour syntax anywhere INSIDE a string either — 'solid #7bff9e'
            //     does not start with '#'.
            expect(value, `${where}: ${path}`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
            expect(value, `${where}: ${path}`).not.toMatch(/\b(?:rgba?|hsla?)\s*\(/i);
            // (3) the HUD's three specific inks, named, so the regression this
            //     module exists to prevent is called out by name.
            for (const hex of hudColours) {
              expect(value.toLowerCase(), `${where}: ${path} carries the HUD ink ${hex}`)
                .not.toContain(hex);
            }
          }

          if (isFieldName) return;   // key names are not cue content

          // (4) whitelist, by TYPE first. The only things a cue may hold are
          //     containers (the drop / massLock objects), null for "no cue", and
          //     strings from the pinned vocabulary. That catches a colour with no
          //     '#' in it (`tone: 'amber'`) AND a colour that is not a string at
          //     all (`colorHex: 0xff7b6b`), which every check above misses.
          if (value === null || typeof value === 'object') return;
          expect(typeof value === 'string',
            `${where}: ${path} is a ${typeof value} (${String(value)}) — a cue carries ` +
            `only words and a blink tier, so a non-string here is a colour, a size or ` +
            `an opacity that a renderer would honour`).toBe(true);
          expect(allowedStrings.has(value), `${where}: unexpected string at ${path}: ` +
            `${JSON.stringify(value)} — only the pinned texts and blink tiers belong here`)
            .toBe(true);
        });
      }
    }
    // Never pass vacuously: if the walk had nothing to look at it proved nothing.
    // An EQUALITY, not a threshold — the six rows raise exactly seven cues
    // (in-window and too-fast each raise a drop cue in two rows, mass-lock raises
    // its banner in three), and each cue says exactly two words: a text and a
    // blink tier. Seven times two is fourteen. A threshold would drift silently as
    // the table changed; the number has to be re-derived by hand if it ever does.
    expect(words, 'the walk inspected the wrong number of cue words — either the ' +
      'module stopped producing cues or the truth table changed shape').toBe(14);
  });

  it('writes no colour in its own source either, so none can be added by hand', () => {
    // The walk above only sees what the current inputs produce. This closes the
    // path where a colour sits in the module behind a condition the table above
    // does not reach. Comments stripped: the header DISCUSSES the HUD's inks.
    const code = codeOf(join(HERE, '..', 'AlertCue.js'));
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(code).not.toMatch(/\b(?:rgba?|hsla?)\s*\(/i);
    expect(code).not.toMatch(/\bfillStyle\b|\bstrokeStyle\b/);
    // And the NUMERIC spelling of the same thing. 0xff7b6b is the HUD's red to the
    // byte, it is the form three.js wants, and it survives every text check above
    // because it has no '#' and no colour word in it.
    expect(code).not.toMatch(/0x[0-9a-fA-F]{6}\b/);
  });

  it('says exactly what the 2D HUD says, character for character', () => {
    // Read as TEXT, not imported: SupercruiseHud's constructor calls
    // document.createElement and this suite has no DOM. Comments stripped so we
    // match what the HUD DRAWS, not what its comments mention — the file
    // discusses "SAFE TO DROP / SLOW DOWN" in prose two places.
    const hud = codeOf(join(HERE, '..', 'SupercruiseHud.js'));

    for (const text of Object.values(ALERT_TEXT)) {
      // Quoted and inside a fillText call: matching the bare substring would let
      // a truncated string ('SLOW') pass against the HUD's longer literal.
      // ⛔ `drawPixelText` TOO, AND AN OPTIONAL LEADING ARGUMENT. chrome-and-ui-at-240p moved
      // this overlay onto the repo's one bitmap face, so the words now leave via
      // `this._drawPixelText('…', …)` — matched as a substring — and a future direct call would
      // be `drawPixelText(ctx, '…', …)` with the context first. ⛔ The context's variable NAME is
      // not hard-coded: it is `c` today and pinning that would make this guard about a local.
      const drawn = new RegExp(
        `(?:fillText|drawPixelText)\\(\\s*(?:[\\w$.]+\\s*,\\s*)?'${escapeRe(text)}'`);
      expect(drawn.test(hud), `SupercruiseHud.js does not draw '${text}' — the panel ` +
        `and the HUD would show different words for the same danger`).toBe(true);
    }
  });

  it('keeps the em dash the HUD actually draws (U+2014), not a hyphen', () => {
    // Called out because it is the character most likely to be "cleaned up" by a
    // later edit or a font substitution. If a panel font lacks it, the string
    // changes in BOTH files — the test above is what forces that.
    // The CODEPOINT, by number. Asserting against a '—' typed into this file only
    // proves the two literals agree, and a blanket typographic pass over the repo
    // rewrites both at once — em dash to en dash (U+2013) across source, HUD and
    // test leaves every other assertion here green while the glass quietly draws a
    // different character. The number is the only thing such a pass cannot edit.
    const dashes = [...ALERT_TEXT.MASS_LOCK].map((ch) => ch.codePointAt(0))
      .filter((cp) => cp === 0x2014 || cp === 0x2013 || cp === 0x2212 || cp === 0x002d);
    expect(dashes, `dash codepoints in ${JSON.stringify(ALERT_TEXT.MASS_LOCK)} — ` +
      `expected exactly one em dash (U+2014)`).toEqual([0x2014]);

    expect(ALERT_TEXT.MASS_LOCK).toContain('—');
    expect(ALERT_TEXT.MASS_LOCK).toBe('TOO CLOSE — SUBLIGHT ONLY');
    expect(ALERT_TEXT.MASS_LOCK).not.toContain('--');
    expect(ALERT_TEXT.MASS_LOCK.split('—')).toHaveLength(2);
    // The three texts are distinct and non-empty — one duplicated by a
    // copy-paste would make two conditions read identically on the glass.
    const texts = Object.values(ALERT_TEXT);
    expect(new Set(texts).size).toBe(3);
    for (const t of texts) expect(t.length).toBeGreaterThan(0);
  });

  it('fails loudly, naming the value, on a drop state it does not know', () => {
    // main.js's _scDropState() owns this enum. If it is renamed, the silent
    // failure is a blank approach warning on the one screen a pilot is watching
    // while closing on a planet — with nothing anywhere to say so.
    expect(() => buildAlertCue({ dropState: 'in_window' })).toThrow(/in_window/);
    expect(() => buildAlertCue({ dropState: 'too fast' })).toThrow(/too fast/);
    // Absent is NOT unknown: no drop information this frame means no cue.
    expect(() => buildAlertCue({ dropState: null })).not.toThrow();
    expect(buildAlertCue({ dropState: null }).drop).toBeNull();
    expect(buildAlertCue({ dropState: undefined }).drop).toBeNull();
    // The empty string is NOT the absent case. `??` does not catch it, so it takes
    // the unknown-state path and throws — pinned here because the two look alike
    // and a reader would otherwise have to work out which side of the line '' sits.
    expect(() => buildAlertCue({ dropState: '' })).toThrow(/unknown dropState/);
  });

  it('freezes the pinned surface, so a caller cannot retint it at runtime', () => {
    // Another module imports ALERT_TEXT and BLINK by name. Frozen means a panel
    // that wants a tweak has to change it here, where the tests are.
    // Each carries its own message: bare booleans fail as "expected false to be
    // true", which tells whoever hits it in CI nothing about which surface thawed.
    expect(Object.isFrozen(ALERT_TEXT), 'ALERT_TEXT is not frozen').toBe(true);
    expect(Object.isFrozen(BLINK), 'BLINK is not frozen').toBe(true);
    const cue = buildAlertCue({ dropState: 'too-fast', massLockHint: true });
    expect(Object.isFrozen(cue.drop), 'the drop cue is not frozen').toBe(true);
    expect(Object.isFrozen(cue.massLock), 'the mass-lock cue is not frozen').toBe(true);

    // AlertCue.js's header promises the cue for a given state is THE SAME VALUE
    // every frame, so a panel can stash last frame's and compare by identity to
    // decide whether to re-rasterise an expensive CRT texture. Nothing else here
    // tests that: rebuilding a fresh object per call passes every other assertion
    // in this file while silently making that comparison always report "changed",
    // i.e. a full redraw at 60 Hz. If the promise is ever withdrawn, withdraw it
    // from the header in the same edit.
    const again = buildAlertCue({ dropState: 'too-fast', massLockHint: true });
    const sameValue = 'the two look identical, so the failure is IDENTITY: this call ' +
      'built a new object instead of handing back the shared frozen one';
    expect(again.drop, `drop cue: ${sameValue}`).toBe(cue.drop);
    expect(again.massLock, `mass-lock cue: ${sameValue}`).toBe(cue.massLock);
  });

  it('contains no skip helper, so a missing input can never make it green', () => {
    // The real enforcement already happened at module scope, above — see
    // assertNoSkipHelpers, and the reason it cannot live in here. This restates it
    // as a named test so the property is visible in the run output rather than
    // being an invisible side effect of importing the file.
    expect(assertNoSkipHelpers()).toBe(true);
  });
});
