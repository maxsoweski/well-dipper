// tests/worldengine-e1-shadow-audit.test.js — World Engine V2-1 AC2 / AC-0 grep audits (Slice D).
//
// The cross-file SHADOW-discipline evidence that computeE1 has ZERO routing influence and its label is
// OUTPUT-only. Slice B's regime test already audits e1Regime.js INTERNALLY (label never read; 'e1:' namespace;
// no Math.random/Date.now; no archetype input). This suite audits the OTHER side of the seam — the writers,
// the dispatch, and the lab wiring — so the emit-only contract is enforced mechanically, not by inspection:
//
//   • AC-0 check 1 (no archetype input) — every computeE1(...) call site passes the CONDITION VECTOR + macroSeed,
//     never a preset name / archetype string (post-V2-3 this includes the rivers.js dispatch call site).
//   • AC1/AC7 (REPURPOSED at V2-3, enumerated) — no base/ WRITER imports computeE1. planet-lod-rivers.js moved
//     to the legitimate-consumer set: the flipped writeBodyRelief derives its condition-bearing route from
//     computeE1 by design. The lab still computes state._lastE1 data-only and NEVER threads it into route()
//     (writeBodyRelief computes E1 itself from bodyDrivers.condition).
//   • AC2 label-invariant (cross-file) — no consumer branches on / reads e1.label outside e1Regime's own
//     emergent derivation.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = (rel) => path.resolve(__dirname, '..', rel);
const read = (rel) => readFileSync(repo(rel), 'utf8');
// Comment-blanked, offset-preserving — the house scanner. Used ONLY for the symbol-consumer arm below.
const readCode = (rel) => stripCommentsPreservingOffsets(read(rel));

const BASE_DIR = 'src/worldengine/base';
const baseFiles = readdirSync(repo(BASE_DIR)).filter((f) => f.endsWith('.js'));

// The E1-BLIND writer set — REPURPOSED at V2-3 (contract AC-ZERO-CLOBBER d, enumerated repurposing #1 of 2).
// The LEGITIMATE-CONSUMER set is now THREE files, each excluded from the blind scan:
//   • e1Regime.js          — the E1 SOURCE.
//   • lidResponse.js       — the V2-2a CONSUMER/router (imports the classification constants
//                            L_STRONG/SHOULDER_LO/HEATPIPE_PEG/MOBILE_L from e1Regime.js).
//   • planet-lod-rivers.js — NEW at V2-3: writeBodyRelief's condition-bearing dispatch derives its route
//                            from computeE1 (+ modalRegime/inSeededBand) — the flip this guardrail used to
//                            forbid is now the production invariant. Its label-freeness is guarded by the
//                            AC-0 grep in worldengine-v2-3-dispatch-oracle.test.js (function-body slice).
// The base/ WRITERS stay E1-blind: the pre-flip "E1 has zero influence inside the expression layer" target
// still holds one layer down (writers consume args, never the tuple).
// ⭐ STEP 7 ADDED A THIRD CATEGORY, AND IT IS NARROWER THAN THE EXCLUSION IT REPLACES. Moving
// body-condition-vector.js into this directory (→ conditionVector.js) put a file in the writer set
// that imports `compositionClass` from e1Regime.js — the rocky/icy/gas/carbon gate the D14 gravity
// self-compression law needs — and the second clause below bans the MODULE, not the tuple. Dropping
// it the way lidResponse.js is dropped would also stop checking it for `computeE1`, which is the
// clause that actually carries this audit's meaning. So it is excluded from the IMPORT clause only
// and still asserted computeE1-free. ⛔ A file belongs here only if it imports a NON-computeE1 symbol;
// `assertSymbolConsumersAreReal` below reds if one of them stops importing e1Regime at all (dead
// entry) or starts touching computeE1 (which is the thing the audit forbids, arriving by the side
// door). lidResponse.js keeps its blanket exclusion — it is the V2-2a ROUTER, whose whole job is the
// classification, and re-deriving that judgement is not Step 7's business.
// ⛔ AND THE `computeE1` CLAUSE IS COMMENT-BLIND FOR THESE FILES ONLY, WHICH IS A NARROWING WITH A
// MEASURED REASON. conditionVector.js names `computeE1` FOUR times (:142, :148, :153, :161) and every
// one of them asserts the OPPOSITE of a violation — "invisible to the flat-key tune builders and to
// computeE1, which read only named keys". Rewording them (this repo's usual remedy for a prose hit,
// per radius-live-feed-fence's HIT 2) would delete the greppable name from the documentation that is
// ABOUT that name, and it is evidently the file's idiom rather than a slip. So for these entries the
// clause runs against comment-BLANKED source. Every other base/ file keeps the strict raw check, so a
// commented-out `computeE1(` call elsewhere is still caught — and the planted control below proves a
// LIVE call in an exempted file is still caught too.
const E1_SYMBOL_CONSUMERS = ['conditionVector.js'];
const WRITER_DISPATCH = [
  ...baseFiles.filter((f) => f !== 'e1Regime.js' && f !== 'lidResponse.js').map((f) => `${BASE_DIR}/${f}`),
];

const LAB = read('planet-lod-lab.html');

describe('V2-1 AC1/AC7 (repurposed V2-3) — computeE1 is imported by NO base/ writer (writers stay E1-blind)', () => {
  for (const rel of WRITER_DISPATCH) {
    it(`${rel} does not reference computeE1 / import e1Regime`, () => {
      const isSymbolConsumer = E1_SYMBOL_CONSUMERS.includes(rel.slice(BASE_DIR.length + 1));
      const src = read(rel);
      expect((isSymbolConsumer ? readCode(rel) : src).includes('computeE1'),
        `${rel} references computeE1`).toBe(false);
      if (isSymbolConsumer) return;                                              // import clause only
      expect(/from\s+['"][^'"]*e1Regime/.test(src), `${rel} imports e1Regime`).toBe(false);
    });
  }

  it('every E1_SYMBOL_CONSUMERS entry is LIVE and is a symbol consumer, not a tuple consumer', () => {
    // The exemption's own control, per §11.2: close the class, not the instance. A dead entry (the
    // file stopped importing e1Regime, or moved away) is an exemption sitting over nothing, which is
    // how a future violation gets forgiven for free. A `computeE1` mention in one of these is the
    // exact thing the audit forbids arriving through the side door — so it is asserted here too,
    // not only in the early-returning loop above.
    expect(E1_SYMBOL_CONSUMERS.length, 'keep this list small enough to read').toBeLessThanOrEqual(3);
    for (const f of E1_SYMBOL_CONSUMERS) {
      expect(baseFiles, `E1_SYMBOL_CONSUMERS names '${f}', which is not in ${BASE_DIR}`).toContain(f);
      const src = read(`${BASE_DIR}/${f}`);
      expect(/from\s+['"][^'"]*e1Regime/.test(src),
        `'${f}' no longer imports e1Regime — the exemption is STALE, delete it`).toBe(true);
      expect(readCode(`${BASE_DIR}/${f}`).includes('computeE1'), `'${f}' references computeE1`).toBe(false);
    }
  });

  it('PLANTED: a LIVE computeE1 call in an exempted file is still caught (the narrowing has a floor)', () => {
    // A pass with no failing control is worthless. The exemption above blanks COMMENTS, not code —
    // this asserts that distinction is real rather than assumed, by re-running the exact predicate
    // over source with one live call spliced in. Nothing is written to disk.
    const f = E1_SYMBOL_CONSUMERS[0];
    const clean = readCode(`${BASE_DIR}/${f}`);
    expect(clean.includes('computeE1'), 'precondition: the real file is clean under the predicate').toBe(false);
    const planted = stripCommentsPreservingOffsets(
      read(`${BASE_DIR}/${f}`).replace('export function deriveConditionVector', 'const _e1 = computeE1(); export function deriveConditionVector'),
    );
    expect(planted.includes('computeE1'), 'the comment-blind predicate MISSED a live call').toBe(true);
  });

  it('planet-lod-rivers.js is a LEGITIMATE consumer: its ONE computeE1 call site feeds the nested condition vector + macroSeed', () => {
    const code = read('planet-lod-rivers.js').replace(/\/\/[^\n]*/g, '');
    const calls = [...code.matchAll(/computeE1\(([^)]*)\)/g)].map((m) => m[1]);
    expect(calls.length, 'exactly one dispatch call site (writeBodyRelief)').toBe(1);
    expect(calls[0].split(',')[0].trim(), 'first arg is the condition-vector handle').toBe('cond');
    // `cond` is bound to the NESTED bodyDrivers.condition (never a preset name / archetype string):
    expect(/const\s+cond\s*=\s*bodyDrivers\.condition/.test(code), 'cond = bodyDrivers.condition').toBe(true);
    expect(calls[0].split(',')[1].trim(), 'second arg is macroSeed').toBe('macroSeed');
  });
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
