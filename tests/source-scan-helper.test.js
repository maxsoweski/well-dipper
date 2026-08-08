// tests/source-scan-helper.test.js — the gate on tests/helpers/source-scan.mjs.
//
// WHY THIS FILE EXISTS AT ALL. `stripCommentsPreservingOffsets` is about to become the thing that
// decides whether two source-execution fences are measuring live code or dead comment text. A
// scanner that silently mis-lexes would hand both of them a plausible wrong answer — this codebase's
// signature failure, and the exact reason PLAN §11.3.2 asks for a hand-authored mutant per branch
// rather than a coverage percentage. Every branch of the state machine has a case below, and the
// REAL lab source is used as the oracle rather than only synthetic strings, because the synthetic
// cases are the ones I thought of.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripCommentsPreservingOffsets as strip, jsFilesUnder, lineOf } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB = readFileSync(join(ROOT, 'planet-lod-lab.html'), 'utf8');

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

  it('lineOf agrees on raw and stripped source at every 1000th offset', () => {
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

describe('jsFilesUnder — the promoted house walker', () => {
  it('walks the worldengine tree and returns sorted repo-relative .js paths', () => {
    const files = jsFilesUnder(ROOT, 'src/worldengine');
    expect(files.length).toBeGreaterThan(20);
    expect(files).toEqual([...files].sort());
    expect(files).toContain('src/worldengine/port/conditionFromPlanet.js');
    expect(files).toContain('src/worldengine/base/giant-drivers.js');
    for (const f of files) expect(f.endsWith('.js'), f).toBe(true);
  });
});
