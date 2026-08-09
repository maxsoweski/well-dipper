// tests/source-scan-helper.test.js — the gate on tests/helpers/source-scan.mjs.
//
// WHY THIS FILE EXISTS AT ALL. `stripCommentsPreservingOffsets` is about to become the thing that
// decides whether two source-execution fences are measuring live code or dead comment text. A
// scanner that silently mis-lexes would hand both of them a plausible wrong answer — this codebase's
// signature failure, and the exact reason PLAN §11.3.2 asks for a hand-authored mutant per branch
// rather than a coverage percentage.
//
// ⛔ WHAT ROUND 1 FOUND, AND WHY THE OLD HEADER LINE HAD TO GO. This file used to claim "Every
// branch of the state machine has a case below". PLAN §11.4's round 1 measured that claim FALSE:
// 18 hand-authored branch mutants, 13 of which survived the whole suite green. I re-ran round 1's
// set plus a line-comment sanity mutant plus five for the `blankLiteralText` option that had none —
// 24 in all — against this file alone, and measured 18 SURVIVING before and 0 after. Round 1's 13
// reproduces exactly. Five of the surviving branches EXECUTE on the real 44-file corpus (template
// escape 21 hits, the looksLikeRegex newline guard 10, the guard's character-class lookahead 5, the
// regex-body character class 5, the regex-body escape 12), and one mutant blanked 37 characters of
// LIVE CODE in src/worldengine/instrument/fieldSampler.js with the suite still fully green. So the
// claim was not merely unproven, it was contradicted.
//
// ⚠ TWO OF ROUND 1'S MUTANTS CANNOT BE RUN AS WRITTEN, and this is worth knowing before anyone
// reproduces the table. Its mutations of the two "unterminated comment" arms (`j = j + 2` for `/*`,
// `j = j + 3` for `<!--`) set `i` BACKWARDS whenever the branch is actually reached. MEASURED with an
// iteration cap wrapped round the main loop: both spin at i=10 and were still going at 100,000
// iterations on inputs as small as `let a = 1;\n/* let b = 2;`. The loop is SYNCHRONOUS, so vitest's
// own 5s test timeout never fires — the event loop never runs — and the whole worker hangs rather
// than reporting a failure. Those two mutants can survive a suite only by never being executed. The
// cases below are measured against terminating variants of the same arm (`? i + 2` / `? i + 4`),
// which the same harness confirms TERMINATE.
//
// ⚠ THE SHARPEST ONE, BECAUSE IT IS THIS STEP'S OWN RECORDED FAILURE MODE. `lineOf`'s only
// assertion compared lineOf-on-raw against lineOf-on-stripped. BOTH ARMS CARRY THE MUTATION, so
// `for (let i = 0; i < index; i++)` -> `i <= index` left everything green. That is a control derived
// from its own subject — ledger row C10 — reproduced one file over inside the file written to
// prevent it. The fix is not a better differential; it is an ABSOLUTE oracle, hand-counted, below.
//
// WHAT IS TRUE NOW, stated so it can be checked rather than trusted: every branch of the state
// machine, of `looksLikeRegex`, of the `literal()` helper that implements `blankLiteralText`, of
// `lineOf` and of `jsFilesUnder` has at least one case below that FAILS when that branch is
// mutated. Each was run RED against its mutant and GREEN restored. Where a case exists only to kill
// a specific mutant, the mutation it answers is named on the line.
//
// ── THE MUTANT TABLE, MEASURED 2026-08-08 ────────────────────────────────────────────────────────
// Run against a proven scratch mirror (tests/ and planet-lod-lab.html are REAL COPIES, verified with
// `realpathSync` before trusting a single number), one mutation at a time, each run being
// `npx vitest run tests/source-scan-helper.test.js`. (Both spans deliberately unwrapped: a backticked
// span broken across two source lines gives each line an ODD tick count, which is how a citation
// stops being readable to a scanner — ledger C12, recorded next door in the fence.)
// BEFORE = this file as it stood after PLAN Step 3; AFTER = as it stands now. Rewriting these
// mutations from the source lines named beside each case reproduces the table.
//
//   branch / mutation                                            BEFORE     AFTER
//   line-comment arm            -> if (false)                    KILLED     KILLED
//   blank() newline preservation-> always ' '                    KILLED     KILLED
//   /* unterminated arm         -> ? i + 2                       KILLED     KILLED
//   <!-- unterminated arm       -> ? i + 4                       SURVIVED   KILLED
//   string escape               -> j += 1                        KILLED     KILLED
//   string newline exit         -> drop || '\n'                  SURVIVED   KILLED
//   template escape             -> j += 1                        SURVIVED   KILLED
//   template `{` depth++        -> if (false)                    SURVIVED   KILLED
//   template `}` depth--        -> if (false)                    KILLED     KILLED
//   looksLikeRegex j < 0        -> return false                  SURVIVED   KILLED
//   looksLikeRegex keywords     -> drop the lookback             SURVIVED   KILLED
//   looksLikeRegex newline guard-> do not return false           SURVIVED   KILLED
//   looksLikeRegex class skip   -> if (false)                    SURVIVED   KILLED
//   regex-body escape           -> j += 1                        SURVIVED   KILLED
//   regex-body class skip       -> if (false)                    SURVIVED   KILLED
//   regex-body newline exit     -> drop || '\n'                  SURVIVED   KILLED
//   lineOf                      -> i <= index                    SURVIVED   KILLED
//   jsFilesUnder recursion      -> if (false) walk(child)        KILLED     KILLED
//   jsFilesUnder sort           -> return out                    SURVIVED   KILLED
//   blankLiteralText ignored    -> if (true)  { keep; return; }  SURVIVED   KILLED
//   blankLiteralText always on  -> if (false) { keep; return; }  KILLED     KILLED
//   literal() opening delimiter -> drop out[i] = src[i]          SURVIVED   KILLED
//   literal() closing delimiter -> if (false)                    SURVIVED   KILLED
//   literal() newline in blank  -> always ' '                    SURVIVED   KILLED
//                                                     TOTAL  18 survived  0 survived
import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripCommentsPreservingOffsets as strip, jsFilesUnder, lineOf } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB = readFileSync(join(ROOT, 'planet-lod-lab.html'), 'utf8');
const SP = (n) => ' '.repeat(n);

describe('stripCommentsPreservingOffsets — the offset contract', () => {
  // The whole point of blanking rather than deleting. If this breaks, every line number every
  // consumer reports is wrong, and it would be wrong QUIETLY.
  it('output is byte-length-identical to input, on the real lab', () => {
    expect(strip(LAB).length).toBe(LAB.length);
  });

  it('every newline survives at its original index, on the real lab', () => {
    // ⚠ INDEX BY CODE UNIT, NOT CODE POINT. The first version of this assertion used [...LAB], which
    // iterates by CODE POINT — and the lab is full of non-ASCII (⚠ ⛔ → ×), so those indices drift
    // from the string indices `strip` and `lineOf` actually use. It reported phantom mismatches on a
    // correct stripper. A measurement that is entirely true about the wrong quantity: the house
    // failure, reproduced inside the file written to prevent it.
    const s = strip(LAB);
    const mismatches = [];
    for (let i = 0; i < LAB.length; i++) {
      if ((LAB[i] === '\n') !== (s[i] === '\n')) mismatches.push(i);
    }
    expect(mismatches).toEqual([]);
  });

  it('lineOf: ABSOLUTE oracle, hand-counted, on a fixture that fits in one screen', () => {
    // ⭐ THIS IS THE ASSERTION THAT DID NOT EXIST, AND ITS ABSENCE IS THE POINT. The raw-vs-stripped
    // agreement test below is structurally incapable of catching a bug in `lineOf` itself: it feeds
    // the SAME function to both arms, so any off-by-one moves both answers together. Measured: with
    // tests/helpers/source-scan.mjs:207 `for (let i = 0; i < index; i++)` changed to `i <= index`,
    // the whole suite stayed green. The numbers below are counted by hand off the fixture, not
    // produced by running the subject.
    //
    //   index : 0=a  1=\n  2=b  3=b  4=\n  5=\n  6=c  7=c  8=c
    //   line  : 1    1     2    2    2     3     4    4    4
    // `lineOf(s, i)` counts the newlines STRICTLY BEFORE i, so index 1 — the newline itself — is
    // still line 1, and index 5 — the second newline — is line 3. That strictness is the whole
    // contract: a match reported at the index of its own line's terminator must not roll forward.
    const F = 'a\nbb\n\nccc';
    expect(lineOf(F, 0)).toBe(1);
    expect(lineOf(F, 1)).toBe(1);
    expect(lineOf(F, 2)).toBe(2);
    expect(lineOf(F, 4)).toBe(2);
    expect(lineOf(F, 5)).toBe(3);
    expect(lineOf(F, 6)).toBe(4);
    expect(lineOf(F, 8)).toBe(4);
    expect(lineOf(F, F.length)).toBe(4);
  });

  it('lineOf agrees on raw and stripped source at every 1000th offset', () => {
    // Kept, but demoted: this proves the OFFSET-PRESERVING property of `strip`, which is real and
    // worth holding. It proves nothing about `lineOf`. See the absolute oracle above.
    const s = strip(LAB);
    for (let i = 0; i < LAB.length; i += 1000) expect(lineOf(s, i)).toBe(lineOf(LAB, i));
  });
});

describe('stripCommentsPreservingOffsets — one mutant per branch of the state machine', () => {
  // Each case is (input, what must survive, what must not). `x` marks text that is live code.
  const CASES = [
    { id: 'line comment', src: 'let a = 1; // let b = 2;\nlet c = 3;', gone: ['let b = 2'], kept: ['let a = 1', 'let c = 3'] },
    { id: 'block comment', src: 'let a = 1; /* let b = 2; */ let c = 3;', gone: ['let b = 2'], kept: ['let a = 1', 'let c = 3'] },
    { id: 'multi-line block comment', src: 'let a = 1;\n/* let b = 2;\n   let d = 4; */\nlet c = 3;', gone: ['let b = 2', 'let d = 4'], kept: ['let a = 1', 'let c = 3'] },
    { id: 'html comment', src: '<div></div>\n<!-- let b = 2; -->\n<span></span>', gone: ['let b = 2'], kept: ['<div>', '<span>'] },
    { id: 'unterminated block comment runs to EOF', src: 'let a = 1;\n/* let b = 2;', gone: ['let b = 2'], kept: ['let a = 1'] },

    // ── the hazards the two regex strippers in the tree get wrong ──────────────────────────────
    { id: 'double-slash inside a single-quoted string', src: "const u = 'https://x.test/p'; let a = 1;", gone: [], kept: ["'https://x.test/p'", 'let a = 1'] },
    { id: 'double-slash inside a double-quoted string', src: 'const u = "a // b"; let a = 1;', gone: [], kept: ['"a // b"', 'let a = 1'] },
    { id: 'block-comment opener inside a string', src: "const u = '/* not a comment */'; let a = 1;", gone: [], kept: ['/* not a comment */', 'let a = 1'] },
    { id: 'escaped quote inside a string does not end it', src: "const u = 'it\\'s // fine'; let a = 1;", gone: [], kept: ['let a = 1'] },
    { id: 'template literal preserves its // text', src: 'const g = `float x; // glsl comment\\nvec3 c;`; let a = 1;', gone: [], kept: ['// glsl comment', 'let a = 1'] },
    { id: 'template ${} re-entry does not close the template early', src: 'const g = `a ${ `b` } // still template`; let a = 1;', gone: [], kept: ['// still template', 'let a = 1'] },
    { id: 'regex literal containing a slash is not a comment', src: 'const r = /a\\/\\/b/; let a = 1;', gone: [], kept: ['let a = 1', 'const r ='] },
    { id: 'regex character class containing a slash', src: 'const r = /[/]/g; let a = 1;', gone: [], kept: ['let a = 1'] },
    { id: 'division is NOT treated as a regex (newline guard)', src: 'const q = a / b;\nconst z = c / d;\nlet a = 1;', gone: [], kept: ['const q = a / b', 'const z = c / d', 'let a = 1'] },

    // ── the shadow this whole file exists for ─────────────────────────────────────────────────
    { id: 'a law quoted verbatim in a comment is removed', src: 'state.bandCount = _pack.bandCount;\n//   state.bandCount = Math.round(12 * (state.planetRadiusEarth ?? 1) / _rotH);', gone: ['Math.round(12 *'], kept: ['_pack.bandCount'] },
  ];

  for (const c of CASES) {
    it(c.id, () => {
      const s = strip(c.src);
      expect(s.length, 'offset contract').toBe(c.src.length);
      for (const g of c.gone) expect(s, `must be blanked: ${g}`).not.toContain(g);
      for (const k of c.kept) expect(s, `must survive: ${k}`).toContain(k);
    });
  }

  // ── ROUND 2: THE ELEVEN BRANCHES THAT HAD NO CASE ─────────────────────────────────────────────
  // ⚠ THESE ASSERT THE WHOLE OUTPUT, NOT A SUBSTRING, AND THAT IS DELIBERATE. Every case above is a
  // `toContain` / `not.toContain` pair, which is exactly the shape that let 13 mutants through: a
  // mis-lexed span that PRESERVES text is invisible to a "must survive" check, because preserved
  // text is the same text. Each `out` below is hand-derived from the ambiguity rule (comment
  // characters become spaces, newlines stay newlines, everything else is verbatim) and then
  // confirmed character-for-character; `out: null` means "the input is returned unchanged", which
  // for these fixtures is itself the non-trivial claim.
  //
  // Several fixtures look pathological. They are, and the reason is structural rather than a taste
  // failure: because literals are PRESERVED VERBATIM in the default pass, mis-lexing one is only
  // OBSERVABLE when the mis-lexed span swallows or exposes a COMMENT. So each fixture is the
  // minimal shape that puts a comment where the two behaviours disagree. Where the only comment
  // form that fits carries no `/` — because any `/` would change the lexer's own decision — the
  // fixture uses `<!-- -->`, which is why `<!-- x -->` shows up inside things that are not HTML.
  const BRANCH_CASES = [
    {
      id: 'unterminated <!-- runs to EOF',
      // KILLS: tests/helpers/source-scan.mjs:133 `j = j === -1 ? src.length : j + 3;` -> the `-1` arm.
      // ⚠ round 1's mutant for this arm was `j = j + 3`, which sets i BACKWARDS and spins forever on
      // any input that reaches the branch — it can survive a suite only by never being executed. The
      // terminating variant of the same arm (`? i + 4`) is what this case is measured against.
      src: '<div></div>\n<!-- let b = 2;',
      out: '<div></div>\n' + SP(15),
    },
    {
      id: 'a string is closed by the newline, not by EOF',
      // KILLS: tests/helpers/source-scan.mjs:140 `if (src[j] === c || src[j] === '\n') { j++; break; }`
      // Without the newline exit an unterminated quote eats the rest of the file, and every comment
      // after it is preserved as "string content" — the silent-green direction.
      src: "const s = 'unterminated;\nlet a = 1; // gone\nlet c = 3;",
      out: "const s = 'unterminated;\nlet a = 1; " + SP(7) + '\nlet c = 3;',
    },
    {
      id: 'an escaped backtick does not close a template',
      // KILLS: the template arm of the escape skip (`j += 2` -> `j += 1`). With the escape mis-sized
      // the template closes at the escaped backtick and its `//` text becomes a real line comment.
      // ⚠ The next line is the one place in this file with an ODD backtick count, and it has to be:
      // an escaped backtick is the whole fixture. It is DATA, not a citation, so nothing is voided.
      src: 'const g = `a \\` b // still template`; let a = 1;',
      out: null,
    },
    {
      id: 'a { inside ${} keeps the template open past an inner backtick',
      // KILLS: tests/helpers/source-scan.mjs:151 `if (depth > 0 && src[j] === '{') depth++;`
      // The inner backtick has to sit BETWEEN the two candidate closing points or both behaviours
      // end the template in the same place and the mutant is invisible. That is why this fixture is
      // unbalanced: it is the minimal witness, not a plausible line of code.
      src: 'const g = `${ {a:1} ` } // c\nlet live = 1;',
      out: null,
    },
    {
      id: 'a regex at index 0 of the file is a regex',
      // KILLS: `if (j < 0) return true;` — the "nothing precedes it" arm of looksLikeRegex. Flip it
      // and the `//` inside the character class opens a line comment that blanks the rest of the line.
      src: '/[//]/.test(s); let a = 1;',
      out: null,
    },
    {
      id: 'keyword lookback: `return /…/` is a regex, not division',
      // KILLS: tests/helpers/source-scan.mjs:52 `const REGEX_KEYWORDS = ...` — drop the lookback and
      // `return` reads as a plain identifier, so the `/*` inside the class opens a block comment
      // that never closes and blanks to EOF.
      src: 'function f(){ return /[/*]x/.test(s); }',
      out: null,
    },
    {
      id: 'the newline guard: a slash that never closes on its line is not a regex',
      // KILLS: tests/helpers/source-scan.mjs:63 `if (src[k] === '\n') return false;`
      // Without the guard the scan runs on to the `/` two lines down, declares a regex, and the span
      // it preserves contains the HTML comment this case requires to be blanked.
      src: 'const r = / b <!-- x -->;\nconst s = 1 / 2;',
      out: 'const r = / b ' + SP(10) + ';\nconst s = 1 / 2;',
    },
    {
      id: 'the guard skips a character class, so a slash inside one is not the closer',
      // KILLS: tests/helpers/source-scan.mjs:64 `if (src[k] === '[') { while (k < src.length && src[k] !== ']' && src[k] !== '\n') k++; continue; }`
      src: 'const r = /[b/c<!--x-->]\nconst s = 1;',
      out: 'const r = /[b/c' + SP(8) + ']\nconst s = 1;',
    },
    {
      id: 'the regex BODY skips a character class too',
      // KILLS: tests/helpers/source-scan.mjs:161 — the body's own class skip. Without it the literal
      // ends at the first `/` inside the class and the trailing `/*` opens an unterminated block
      // comment that blanks every remaining character.
      src: 'const r = /[x//*y]/; let a = 1;',
      out: null,
    },
    {
      id: 'the regex BODY exits at a newline',
      // KILLS: tests/helpers/source-scan.mjs:162 `if (src[j] === '/' || src[j] === '\n') { j++; break; }`
      // Reachable because the guard at :64 walks PAST a newline when a character class is left open
      // (its `continue` hands control to the for-loop's own `k++`), so the body can be entered on
      // text the guard already crossed. Without the body's newline exit the "regex" runs to the next
      // slash two lines down and preserves the comment in between.
      src: 'const r = /[abc\nlet a = 1; // gone\nlet c = 3;',
      out: 'const r = /[abc\nlet a = 1; ' + SP(7) + '\nlet c = 3;',
    },
    {
      id: 'an escape inside a regex body (the fieldSampler shape)',
      // KILLS: the regex arm of the escape skip. ⭐ NOT SYNTHETIC — this is the shape of a real line
      // in the fence's own corpus, src/worldengine/instrument/fieldSampler.js, where round 1's
      // mutant blanked 37 characters of live code with the suite fully green.
      src: "const t = s.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ' '); let a = 1;",
      out: null,
    },
  ];

  for (const c of BRANCH_CASES) {
    it(c.id, () => {
      expect(strip(c.src)).toBe(c.out === null ? c.src : c.out);
    });
  }

  it('CONTROL THAT MOVED: the naive regex stripper FAILS the cases the state machine passes', () => {
    // PLAN §11.3.3 — a pass with no failing control is worthless. This is the stripper that already
    // exists twice in tests/ (worldengine-v2-3-dispatch-oracle.test.js:242, and with a partial `[^:]`
    // guard at relief-router-repoint.test.js:48). It is shown failing so the promotion of the state
    // machine is an evidenced choice and not a preference.
    const naive = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const hazards = CASES.filter((c) => c.kept.some((k) => k.includes('//') || k.includes('/*')));
    expect(hazards.length, 'the hazard cases exist').toBeGreaterThanOrEqual(4);
    const broken = hazards.filter((c) => c.kept.some((k) => k.includes('//') || k.includes('/*')
      ? !naive(c.src).includes(k) : false));
    expect(broken.length, 'the naive stripper eats live code on these').toBeGreaterThanOrEqual(4);
  });
});

describe('stripCommentsPreservingOffsets — the real lab is the oracle', () => {
  const S = strip(LAB);

  it('removes the lab\'s own verbatim-code comments (the shadow habit, measured at 7 instances)', () => {
    // planet-lod-lab.html:6160-6161 quotes two executable statements inside a `//` comment. That habit
    // is exactly what makes the shadow reachable, so prove the stripper actually sees it.
    expect(LAB, 'the habit still exists in the source').toContain('_lab.setCarveEpoch(false);');
    expect(S, 'and the stripper removes it').not.toContain('_lab.setCarveEpoch(false);');
  });

  it('preserves every live extraction site the radius suite depends on', () => {
    // The decisive non-corruption check: if the stripper damaged live code, one of these dies. These
    // are the exact patterns tests/radius-live-feed.test.js compiles and executes.
    const SITES = [
      /const\s+_gas\s*=\s*(.+?);/,
      /const\s+_rotH\s*=\s*(.+?);/,
      /state\.bandCount\s*=\s*(.+?);\s*$/m,
      /(let _cloudRegime = 0;[\s\S]*?;)\s*\n\s*state\.cloudRegime = _cloudRegime;/,
      /const\s+_giantDynamo\s*=\s*(.+?);/,
      /(const\s+_giantDynamo\s*=[\s\S]*?state\.auroraRingWidth\s*=\s*[^;]+;)/,
      /radiusSeed:\s*(\d+)\s*,/,
    ];
    // ⚠ THE INVARIANT IS COMMUTATIVITY, NOT EQUALITY. The block sites (cloud regime, aurora chain)
    // SPAN comments, so the capture taken from stripped source is legitimately not byte-equal to the
    // one taken from raw source — the interior comments are blanked, which is the entire point.
    // Asserting equality would have forced the stripper to stop working to make the test pass. The
    // real property is that stripping and extracting COMMUTE: strip-then-extract must equal
    // extract-then-strip, modulo the whitespace the blanking leaves behind. That says the stripper
    // damaged no live code inside the capture, which is the thing actually at risk.
    const norm = (t) => t.replace(/\s+/g, ' ').trim();
    for (const re of SITES) {
      const raw = LAB.match(re);
      const str = S.match(re);
      expect(raw, `raw source must match ${re}`).toBeTruthy();
      expect(str, `stripped source must still match ${re}`).toBeTruthy();
      expect(norm(str[1]), `strip∘extract === extract∘strip for ${re}`).toBe(norm(strip(raw[1])));
    }
  });

  it('preserves the two E5 radius driver lines', () => {
    const rawLines = LAB.split('\n').filter((l) => /^\s*radius:\s*.*\/\s*11\.2\s*,/.test(l));
    const strLines = S.split('\n').filter((l) => /^\s*radius:\s*.*\/\s*11\.2\s*,/.test(l));
    expect(rawLines.length).toBe(2);
    expect(strLines.length).toBe(2);
  });

  it('MEASURED: stripping actually removes a substantial amount of text (not a no-op)', () => {
    // A stripper that returned its input unchanged would pass every "must survive" assertion above.
    // This is the control against that: the lab is heavily commented and the delta must be large.
    let blanked = 0;
    for (let i = 0; i < LAB.length; i++) if (S[i] !== LAB[i]) blanked++;
    expect(blanked, 'characters blanked').toBeGreaterThan(20000);
  });
});

// ── THE `blankLiteralText` OPTION ────────────────────────────────────────────────────────────────
// ⛔ THIS OPTION SHIPPED WITH ZERO TESTS. It was added mid-round-1 to close the half of the shadow
// class that stripping comments cannot reach: a retired law parked inside a TEMPLATE LITERAL needs
// no comment markers at all, it is simply string content, and the default pass preserves it because
// the surviving text has to still compile. Measured on the real lab: 21 lines carry a `//` that
// SURVIVES the default pass, every one of them inside the lab's own `/* glsl */` templates.
//
// The option's contract is narrow and each half is load-bearing: DELIMITERS SURVIVE (so the result
// is still lexically the same shape) and OFFSETS DO NOT MOVE (so a match found on this pass can be
// spliced out of the default pass, which is the only reason it is useful). Both are asserted
// absolutely below, not against the implementation's own output.
describe('stripCommentsPreservingOffsets — blankLiteralText', () => {
  const bl = (s) => strip(s, { blankLiteralText: true });

  it('keeps the delimiters and blanks the interior, for all three literal kinds', () => {
    // Hand-derived, then confirmed: `'ab'` -> `'  '`, `` `cd` `` -> `` `  ` ``, `/ef/` -> `/  /`,
    // and the trailing `// x` is blanked by the ordinary comment path in BOTH passes.
    const src = "const s = 'ab'; const t = `cd`; const r = /ef/; // x";
    expect(strip(src), 'default pass leaves literals alone').toBe(
      "const s = 'ab'; const t = `cd`; const r = /ef/; " + SP(4));
    expect(bl(src), 'matching pass hollows them out').toBe(
      "const s = '  '; const t = `  `; const r = /  /; " + SP(4));
  });

  it('newlines inside a blanked literal survive, so line numbers still agree', () => {
    // KILLS a `literal()` that blanks with plain spaces instead of going through
    // tests/helpers/source-scan.mjs:107 `const blank = (n) => { for (let k = 0; k < n && i + k < src.length; k++) out[i + k] = src[i + k] === '\n' ? '\n' : ' '; };`.
    // A multi-line glsl template is the common case in the lab, so losing this would shift every
    // reported line number after the first template — quietly.
    expect(bl('const g = `a\nb`;')).toBe('const g = ` \n `;');
  });

  it('both passes are byte-length- and newline-identical on the real lab', () => {
    // This is what makes the two-pass protocol legal at all: match on one, splice from the other.
    const d = strip(LAB);
    const b = bl(LAB);
    expect(b.length).toBe(LAB.length);
    expect(d.length).toBe(LAB.length);
    const mismatches = [];
    for (let i = 0; i < LAB.length; i++) if ((d[i] === '\n') !== (b[i] === '\n')) mismatches.push(i);
    expect(mismatches, 'a newline in one pass and not the other').toEqual([]);
  });

  it('MEASURED on the real lab: surviving `//` lines go 21 -> 0', () => {
    // The headline number the option exists for. The default pass leaves 21 lines whose `//` is
    // still there — all of them inside `/* glsl */` templates, all of them places a retired law
    // could be parked and read as the only live match. The matching pass leaves none.
    const withSlashes = (s) => s.split('\n').filter((l) => l.includes('//')).length;
    expect(withSlashes(strip(LAB)), 'default pass').toBe(21);
    expect(withSlashes(bl(LAB)), 'matching pass').toBe(0);
    // CONTROL THAT MOVED (§11.3.3): the raw lab has two orders of magnitude more, so "0" is not the
    // trivial consequence of there being nothing to find.
    expect(withSlashes(LAB), 'raw lab').toBeGreaterThan(3000);
  });

  it('every live extraction site still matches on the matching pass, at the SAME offset', () => {
    // If blanking literal interiors moved or destroyed a site, the consumers would fail loudly — but
    // they would fail AFTER wiring, and the point of a helper gate is to fail here. Measured: all
    // seven sites match at an identical index and an identical length on both passes.
    const SITES = [
      /const\s+_gas\s*=\s*(.+?);/,
      /const\s+_rotH\s*=\s*(.+?);/,
      /state\.bandCount\s*=\s*(.+?);\s*$/m,
      /(let _cloudRegime = 0;[\s\S]*?;)\s*\n\s*state\.cloudRegime = _cloudRegime;/,
      /const\s+_giantDynamo\s*=\s*(.+?);/,
      /(const\s+_giantDynamo\s*=[\s\S]*?state\.auroraRingWidth\s*=\s*[^;]+;)/,
      /radiusSeed:\s*(\d+)\s*,/,
    ];
    const d = strip(LAB);
    const b = bl(LAB);
    for (const re of SITES) {
      const dm = d.match(re);
      const bm = b.match(re);
      expect(bm, `matching pass must still match ${re}`).toBeTruthy();
      expect(bm.index, `same offset for ${re}`).toBe(dm.index);
      expect(bm[0].length, `same span length for ${re}`).toBe(dm[0].length);
      // THE PROTOCOL ITSELF: slice the DEFAULT pass at the offsets found on the MATCHING pass.
      expect(d.slice(bm.index, bm.index + bm[0].length), `splice for ${re}`).toBe(dm[0]);
    }
  });

  it('the splice restores real string literals — the reason the protocol is two-pass at all', () => {
    // A worked example on real lab text rather than a fixture, because this is the property a
    // consumer bets on when it hands the spliced text to `new Function`: the matching pass shows
    // `'     '`, the splice hands back `'h2-he'`. Matching on the blanked text and COMPILING it
    // would silently change what the law computes.
    const re = /const\s+_gas\s*=\s*(.+?);/;
    const d = strip(LAB);
    const bm = bl(LAB).match(re);
    expect(bm[0]).toContain("'     '");
    expect(d.slice(bm.index, bm.index + bm[0].length)).toContain("'h2-he'");
  });

  it('THE POINT: matching on the blanked pass finds the LIVE law, not a copy parked in a template', () => {
    // The shadow the option was added for, in miniature. On the default pass the FIRST match is the
    // dead copy inside the template — which is exactly how a moved-out law keeps a fence green.
    const src = 'const g = `state.bandCount = 12;`;\nstate.bandCount = _pack.bandCount;';
    const re = /state\.bandCount\s*=\s*(.+?);/;
    expect(strip(src).match(re)[1], 'default pass reads the parked copy').toBe('12');
    expect(bl(src).match(re)[1], 'matching pass reads the live line').toBe('_pack.bandCount');
  });

  it('the DEFAULT pass is byte-identical to what it produced BEFORE the option existed', () => {
    // ⭐ ABSOLUTE, WITH PROVENANCE — this is not a self-comparison. The digest below was produced by
    // running the PRE-OPTION implementation over this exact frozen fixture:
    //   git show f408bb7:tests/helpers/source-scan.mjs   (verified: zero occurrences of
    //   `blankLiteralText`), then sha256 of its output on FROZEN.
    // The fixture is FROZEN precisely so the digest keeps that provenance. ⛔ If this ever goes red,
    // the option changed default behaviour — the fix is in tests/helpers/source-scan.mjs, NOT a
    // re-pin. Re-pinning against the current implementation destroys the only evidence this
    // assertion carries and leaves a test that can never fail.
    const FROZEN = [
      "const u = 'https://x.test/p';",
      'const g = `float x; // glsl\\nvec3 c;`;',
      'const r = /[x//*y]/g;',
      'let a = 1; // line comment',
      '/* block\n   comment */',
      '<!-- html comment -->',
      "const e = 'it\\'s // fine';",
      'const q = a / b;',
      'function f(){ return /[/*]x/.test(s); }',
    ].join('\n');
    expect(FROZEN.length, 'the fixture itself has not drifted').toBe(246);
    const digest = createHash('sha256').update(strip(FROZEN)).digest('hex');
    expect(digest).toBe('372829310b5ce6d10d866c83e740a7be9f9a9db2593cb32d3f3872f183509399');
  });
});

describe('jsFilesUnder — the promoted house walker', () => {
  it('ABSOLUTE oracle on a built tree: recurses, keeps only .js, and sorts', () => {
    // ⭐ THIS TREE IS BUILT RATHER THAN BORROWED FOR ONE MEASURED REASON. Against the real
    // src/worldengine tree the sort is an UNKILLABLE branch here: measured 2026-08-08, readdirSync
    // on this filesystem already returns entries in sorted order for all 42 files, so deleting
    // tests/helpers/source-scan.mjs:201 `return out.sort();` changes nothing. The old assertion
    // `expect(files).toEqual([...files].sort())` also sorts the subject's own output and compares it
    // to itself — a control derived from its own subject, ledger row C10 again.
    //
    // `b/` beside `b.js` is what breaks the tie: the walker emits `sub/b/a.js` first (directory
    // entries come before `b.js` in readdir order) but '.' (0x2E) sorts before '/' (0x2F), so the
    // SORTED answer puts `sub/b.js` first. The literal array below is therefore reachable only if
    // the sort actually runs — and `notes.txt` is absent only if the `.js` filter actually runs.
    const dir = mkdtempSync(join(tmpdir(), 'source-scan-jsfiles-'));
    try {
      mkdirSync(join(dir, 'sub', 'b'), { recursive: true });
      writeFileSync(join(dir, 'sub', 'b', 'a.js'), '');
      writeFileSync(join(dir, 'sub', 'b.js'), '');
      writeFileSync(join(dir, 'sub', 'notes.txt'), '');
      expect(jsFilesUnder(dir, 'sub')).toEqual(['sub/b.js', 'sub/b/a.js']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('walks the worldengine tree and returns sorted repo-relative .js paths', () => {
    const files = jsFilesUnder(ROOT, 'src/worldengine');
    expect(files.length).toBeGreaterThan(20);
    expect(files).toEqual([...files].sort());
    expect(files).toContain('src/worldengine/port/conditionFromPlanet.js');
    expect(files).toContain('src/worldengine/base/giant-drivers.js');
    for (const f of files) expect(f.endsWith('.js'), f).toBe(true);
  });
});
