// tests/worldengine-e1-shadow-audit.test.js — World Engine V2-1 AC2 / AC-0 grep audits (Slice D).
//
// The cross-file SHADOW-discipline evidence that computeE1 has ZERO routing influence and its label is
// OUTPUT-only. Slice B's regime test already audits e1Regime.js INTERNALLY (label never read; 'e1:' namespace;
// no Math.random/Date.now; no archetype input). This suite audits the OTHER side of the seam — the writers,
// the dispatch, and the lab wiring — so the emit-only contract is enforced mechanically, not by inspection:
//
//   • AC-0 check 1 (no archetype input) — every computeE1(...) call site passes the CONDITION VECTOR + macroSeed,
//     never a preset name / archetype string.
//   • AC1/AC7 shadow — no writer (src/worldengine/base/*Sphere) and not the dispatch (planet-lod-rivers.js)
//     imports computeE1; the lab computes state._lastE1 but NEVER threads it into route().
//   • AC2 label-invariant (cross-file) — no consumer branches on / reads e1.label outside e1Regime's own
//     emergent derivation.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = (rel) => path.resolve(__dirname, '..', rel);
const read = (rel) => readFileSync(repo(rel), 'utf8');

const BASE_DIR = 'src/worldengine/base';
const baseFiles = readdirSync(repo(BASE_DIR)).filter((f) => f.endsWith('.js'));

// The writer + dispatch set: every base module EXCEPT e1Regime.js itself, plus the dispatch seam.
const WRITER_DISPATCH = [
  ...baseFiles.filter((f) => f !== 'e1Regime.js').map((f) => `${BASE_DIR}/${f}`),
  'planet-lod-rivers.js',
];

const LAB = read('planet-lod-lab.html');

describe('V2-1 AC1/AC7 — computeE1 is imported by NO writer/dispatch file (shadow: zero routing influence)', () => {
  for (const rel of WRITER_DISPATCH) {
    it(`${rel} does not reference computeE1 / import e1Regime`, () => {
      const src = read(rel);
      expect(src.includes('computeE1'), `${rel} references computeE1`).toBe(false);
      expect(/from\s+['"][^'"]*e1Regime/.test(src), `${rel} imports e1Regime`).toBe(false);
    });
  }
});

describe('V2-1 AC-0 check 1 — every computeE1 call site passes the condition vector + macroSeed (no archetype input)', () => {
  it('the lab imports computeE1 and every call feeds a .condition vector as the first argument', () => {
    expect(LAB.includes("import { computeE1 } from './src/worldengine/base/e1Regime.js'")).toBe(true);
    // Grab each computeE1( ... ) call's argument list (up to the first close paren — the calls here have no
    // nested parens in the arg list) and assert the FIRST arg is a condition vector, never a preset/archetype.
    // Strip // line comments first so a prose "computeE1(...)" in a comment is not mistaken for a call site.
    const code = LAB.replace(/\/\/[^\n]*/g, '');
    const calls = [...code.matchAll(/computeE1\(([^)]*)\)/g)].map((m) => m[1]);
    expect(calls.length, 'expected computeE1 call sites in the lab (shadow compute + probe fallback)').toBeGreaterThanOrEqual(2);
    for (const args of calls) {
      const firstArg = args.split(',')[0].trim();
      expect(/\.condition\b/.test(firstArg), `computeE1 first arg "${firstArg}" is not a .condition vector`).toBe(true);
      expect(/archetype|PRESET_ARCHETYPE|preset\b/i.test(firstArg), `computeE1 first arg "${firstArg}" leaks an archetype`).toBe(false);
    }
  });
});

describe('V2-1 AC1/AC7 — the lab computes state._lastE1 but NEVER routes it (data-only shadow wiring)', () => {
  it('state._lastE1 = computeE1(...) exists at the route seam', () => {
    expect(/state\._lastE1\s*=\s*computeE1\(/.test(LAB)).toBe(true);
  });

  it('the riverOverlay.route({...}) argument block references no E1 result (E1 has zero routing influence)', () => {
    const start = LAB.indexOf('riverOverlay.route({');
    expect(start, 'riverOverlay.route({ call not found').toBeGreaterThan(-1);
    const end = LAB.indexOf('});', start);
    expect(end, 'route({ call has no closing });').toBeGreaterThan(start);
    const routeArgs = LAB.slice(start, end);
    expect(routeArgs.includes('_lastE1'), 'route args thread _lastE1').toBe(false);
    expect(routeArgs.includes('computeE1'), 'route args call computeE1').toBe(false);
    expect(/\be1\b/i.test(routeArgs.replace(/\/\/[^\n]*/g, '')), 'route args mention e1 (outside comments)').toBe(false);
  });
});

describe('V2-1 AC2 — e1.label is OUTPUT-only: no consumer (lab / oracle) branches on it', () => {
  it('the lab never reads .label off an e1 handle (state._lastE1 / e1Probe() / computeE1 result)', () => {
    // strip line comments first so a prose "label" in a comment cannot trip the grep.
    const code = LAB.replace(/\/\/[^\n]*/g, '');
    expect(code.includes('_lastE1.label'), 'lab reads state._lastE1.label').toBe(false);
    expect(/e1Probe\(\)\.label/.test(code), 'lab reads e1Probe().label').toBe(false);
    expect(/computeE1\([^)]*\)\.label/.test(code), 'lab reads computeE1(...).label').toBe(false);
    // the only e1 handles in the lab are state._lastE1 and the e1Probe() return — neither is a label branch.
  });

  it('the AC3 oracle classifies on geodynamicRegime / compositionClass — never on e1.label', () => {
    const oracle = read('tests/worldengine-e1-conformance-oracle.test.js');
    // the writerE1 predictor reads .compositionClass and .geodynamicRegime; it must not read .label to route.
    expect(/e1\.label|\.label\s*===|===\s*.*\.label/.test(oracle.replace(/\/\/[^\n]*/g, ''))).toBe(false);
    expect(oracle.includes('.geodynamicRegime') || oracle.includes('.compositionClass')).toBe(true);
  });
});
