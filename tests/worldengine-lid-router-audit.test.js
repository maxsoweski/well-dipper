// tests/worldengine-lid-router-audit.test.js — World Engine V2-2a Slice C.
//
// The router's self-audit: AC1 (determinism + reserved 'lid:' namespace), AC-MIXED-STUB (the
// explicit-unimplemented marker, carrier.height UNWRITTEN), AC-0's grep leg (label-free + single-source),
// and AC-ZERO-CLOBBER's dispatch-absence grep. All headless, source-grep + direct-call.
//
//   • AC1              — lidResponse.js source contains no Math.random / Date.now and NO alea at all (so zero
//                        'lid:' draws — the namespace is RESERVED for V2-2b); repeat-call on a fixed (e1, opts)
//                        → identical fineClass + identical carrier.height + identical primitiveId.
//   • AC-MIXED-STUB    — a hand-set mixed vector → { path:'lid-mixed', fineClass:'mixed', unimplemented:true };
//                        carrier.height byte-unchanged from a pre-filled sentinel; no corner emit; no 'lid:' draw.
//   • AC-0 grep leg    — the router reads no e1.label, no PRESET_ARCHETYPE, calls no stagnantLidRegimeOf( (nor any
//                        archetype-string arg); IMPORTS L_STRONG/SHOULDER_LO from e1Regime.js (no re-declared
//                        0.63/0.15 literals); resolves the strong regime from geodynamicRegime==='stagnant'.
//   • AC-ZERO-CLOBBER  — RECONCILED (V2-2b-2a Slice C / MF1 Option B): the router reaches planet-lod-rivers.js
//                        ONLY via route()'s null-default labLidOverride LAB hook; the PRODUCTION dispatch
//                        (writeBodyRelief) keys on PRESET_ARCHETYPE and touches no router symbol — un-wired.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeLidResponseSphere } from '../src/worldengine/base/lidResponse.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { computeE1 } from '../src/worldengine/base/e1Regime.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { buildBundle, TARGET_N, LLOYD } from './fixtures/v2-0-carrier-golden.mjs';

const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
const arr = (a) => Array.from(a);
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const readSrc = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const LID_SRC = readSrc('../src/worldengine/base/lidResponse.js');
const LID_CODE = stripComments(LID_SRC);          // comments stripped: the router names forbidden symbols in
                                                  // "we don't do this" comments; only DEFINITIONS/USES count.
const RIVERS_CODE = stripComments(readSrc('../planet-lod-rivers.js'));
// V2-2b-2a — the 'lid:' namespace goes LIVE. The composer OWNS it; the router + the two pure corner writers
// must still make ZERO 'lid:' draws (so corner byte-identity holds). Corners + composer stripped for the
// per-file ownership greps below.
const MAGMA_CODE = stripComments(readSrc('../src/worldengine/base/magmatism.js'));
const STAGNANT_CODE = stripComments(readSrc('../src/worldengine/base/stagnantLid.js'));
const COMPOSER_CODE = stripComments(readSrc('../src/worldengine/base/mixedInterior.js'));

// ── AC1 — determinism + 'lid:' namespace OWNERSHIP (live in the composer, forbidden in the router + corners) ─
describe('V2-2b-2a AC1 — the router stays pure/zero-RNG; the \'lid:\' namespace is OWNED by the composer (corners + router zero)', () => {
  it('router draws NO alea + NO \'lid:\' colon; corners make ZERO \'lid:\' draws; the composer OWNS lid:centers:/lid:strength:', () => {
    expect(LID_CODE, 'no Math.random').not.toMatch(/Math\.random\s*\(/);
    expect(LID_CODE, 'no Date.now').not.toMatch(/Date\.now\s*\(/);
    // The router delegates to the composer; it acquires NO alea and NO 'lid:' colon ('./mixedInterior.js' has
    // no colon; the path markers use 'lid-mixed' etc. — a hyphen, NOT the 'lid:' colon).
    expect(LID_CODE, 'router draws no alea at all (it delegates to the composer)').not.toMatch(/\balea\b/);
    expect(LID_CODE, "router carries no 'lid:' colon").not.toMatch(/lid:/);
    // The two pure corners still make ZERO 'lid:' draws ⇒ corner byte-identity is preserved.
    expect(MAGMA_CODE, "magmatism corner makes no 'lid:' draw").not.toMatch(/lid:/);
    expect(STAGNANT_CODE, "stagnant corner makes no 'lid:' draw").not.toMatch(/lid:/);
    // The composer OWNS the 'lid:' namespace (the FIRST code to draw in it).
    expect(COMPOSER_CODE, 'composer owns lid:centers:').toMatch(/lid:centers:/);
    expect(COMPOSER_CODE, 'composer owns lid:strength:').toMatch(/lid:strength:/);
  });

  it('repeat-call on a fixed (e1, opts) → identical fineClass + identical carrier.height + identical primitiveId', () => {
    const b = buildBundle('Lava (hot airless)', 7);
    const T_ss = b.locked ? (b.T_eq ?? 0) * 1.4 : 0;
    const e1 = computeE1(b.bodyDrivers.condition, 7);
    const rawTidal = b.bodyDrivers.condition.rawTidalIoRatio;
    const opts = { e1, rawTidal, macroSeed: 7, locked: b.locked, T_ss, grainDrivers: b.grainDrivers };
    const c1 = carrierOf(); const r1 = writeLidResponseSphere(c1, b.bodyDrivers, opts);
    const c2 = carrierOf(); const r2 = writeLidResponseSphere(c2, b.bodyDrivers, opts);
    expect(r1.fineClass).toBe(r2.fineClass);
    expect(arr(c1.height), 'carrier.height identical across repeat calls').toEqual(arr(c2.height));
    expect(arr(r1.primitiveId), 'primitiveId identical across repeat calls').toEqual(arr(r2.primitiveId));
  });
});

// ── AC-MIXED-STUB (flipped, V2-2b-2a) — the 'mixed' arm now runs the REAL composer; off-pilot still a marker ─
describe('V2-2b-2a AC-MIXED-STUB — a mixed vector WRITES height via the composer; off-pilot still a marker', () => {
  // A hand-set mixed vector: rocky, no heat-pipe, L in [MIXED_LO(0.35), L_STRONG(0.63)) → 'mixed' (Mars-like).
  // Now carries Φ + n (the composer reads e1.n center count + e1.Φ convective vigor).
  const mixedE1 = { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.5, Φ: 0.3, n: 6 };

  it('mixed WRITES carrier.height (byte-changed from a sentinel); emits multi-valued primitiveId + centerId; unimplemented ABSENT', () => {
    const c = carrierOf();
    const SENTINEL = 123.5;
    c.height.fill(SENTINEL);
    const before = arr(c.height);
    const r = writeLidResponseSphere(c, {}, { e1: mixedE1, rawTidal: 0, macroSeed: 1 });
    expect(r.path, 'lid-mixed path').toBe('lid-mixed');
    expect(r.fineClass, 'mixed fine-class').toBe('mixed');
    expect(r.unimplemented, 'the unimplemented marker is GONE (real machinery)').toBeUndefined();
    // carrier.height is now WRITTEN (byte-changed from the pre-filled sentinel).
    expect(arr(c.height), 'carrier.height byte-changed from the sentinel (height written)').not.toEqual(before);
    // primitiveId is present, per-node, and MULTI-VALUED (not a single uniform corner fill).
    expect(r.primitiveId, 'primitiveId emitted').toBeInstanceOf(Int32Array);
    expect(r.primitiveId.length, 'primitiveId is per-node').toBe(c.count);
    const distinct = new Set(arr(r.primitiveId));
    expect(distinct.size, `primitiveId is multi-valued (ids ${[...distinct].join(',')})`).toBeGreaterThan(1);
    for (const id of distinct) expect([1, 2, 5, 6, 7, 8], `id ${id} in the enum`).toContain(id);
    // centerId co-emitted, per-node.
    expect(r.centerId, 'centerId emitted').toBeInstanceOf(Int32Array);
    expect(r.centerId.length, 'centerId is per-node').toBe(c.count);
    expect(r.mixedDiag, 'mixedDiag emitted').toBeTruthy();
  });

  it('an off-pilot vector STILL returns a marker (path lid-offpilot) with height UNWRITTEN', () => {
    const offE1 = { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.30 }; // below MIXED_LO
    const c = carrierOf();
    c.height.fill(7.25);
    const before = arr(c.height);
    const r = writeLidResponseSphere(c, {}, { e1: offE1, rawTidal: 0, macroSeed: 1 });
    expect(r).toEqual({ path: 'lid-offpilot', fineClass: 'off-pilot', unimplemented: true });
    expect(arr(c.height)).toEqual(before);
  });
});

// ── AC-0 grep leg — LABEL-FREE + single-source-of-truth ─────────────────────────────────────────────────
describe('V2-2a AC-0 — the router is LABEL-FREE + single-source (grep-audited)', () => {
  it('reads no e1.label, no PRESET_ARCHETYPE, calls no stagnantLidRegimeOf( (nor any archetype-string arg)', () => {
    expect(LID_CODE, 'no e1.label read').not.toMatch(/\.label\b/);
    expect(LID_CODE, 'no PRESET_ARCHETYPE read').not.toMatch(/PRESET_ARCHETYPE/);
    expect(LID_CODE, 'no stagnantLidRegimeOf( call/import (it takes a preset LABEL)').not.toMatch(/stagnantLidRegimeOf/);
  });

  it('IMPORTS L_STRONG / SHOULDER_LO / HEATPIPE_PEG from e1Regime.js (no re-declared 0.63 / 0.15 literals)', () => {
    expect(LID_CODE, 'imports the cuts from e1Regime.js').toMatch(/import\s*\{[^}]*\bL_STRONG\b[^}]*\bSHOULDER_LO\b[^}]*\}\s*from\s*['"]\.\/e1Regime\.js['"]/);
    expect(LID_CODE, 'no re-declared 0.63 literal (single source of truth)').not.toMatch(/\b0\.63\b/);
    expect(LID_CODE, 'no re-declared 0.15 literal (single source of truth)').not.toMatch(/\b0\.15\b/);
  });

  it('V2-3 Slice A — IMPORTS MOBILE_L from e1Regime.js; the local 0.35 literal is GONE (R-A3 promotion executed)', () => {
    expect(LID_CODE, 'imports MOBILE_L from e1Regime.js (the single source of truth for the mixed floor)')
      .toMatch(/import\s*\{[^}]*\bMOBILE_L\b[^}]*\}\s*from\s*['"]\.\/e1Regime\.js['"]/);
    expect(LID_CODE, 'no re-declared 0.35 literal (single source of truth)').not.toMatch(/\b0\.35\b/);
  });

  it('resolves the strong regime ARCHETYPE-FREE from geodynamicRegime===\'stagnant\' → the single constant', () => {
    expect(LID_CODE, "reads the E1 coordinate geodynamicRegime==='stagnant'").toMatch(/geodynamicRegime\s*===\s*['"]stagnant['"]/);
    expect(LID_CODE, 'maps to the single strong constant').toMatch(/venus-stagnant-lid/);
  });
});

// ── AC-ZERO-CLOBBER (dispatch seam) — REWRITTEN at V2-3 (contract AC-ZERO-CLOBBER d, enumerated repurposing
//    #2 of 2; BUILD-PLAN §4 / RG1). The V2-2b-2a version pinned the PRE-flip invariant ("the router reaches
//    rivers.js ONLY via labLidOverride; writeBodyRelief touches no router symbol") — exactly the invariant the
//    V2-3 flip exists to retire. POST-flip there are TWO legitimate writeLidResponseSphere call sites:
//      1. PRODUCTION: writeBodyRelief's condition-bearing unbrokenLid() delegation (heat-pipe + hot-high-L
//         stagnant → the router's byte-preserved corners), INSIDE the writeBodyRelief function body.
//      2. LAB: route()'s null-default labLidOverride hook (the V2-2b-2a mixed-interior render seam), OUTSIDE it.
//    The re-pin: router symbols are PERMITTED inside writeBodyRelief; the base/ WRITERS (magmatism/stagnantLid/
//    shellRelief/tectonic/plates/mixedInterior) still call no router/E1 symbol (the NEW base-writer scan).
describe('V2-3 AC-ZERO-CLOBBER (repurposed) — exactly TWO legitimate router call sites; base writers router/E1-free', () => {
  // Slice writeBodyRelief's exact function body by paren-matching the parameter list (which itself contains
  // a destructuring `{`), then brace-matching the body — not a fixed window.
  function functionBody(code, marker) {
    const start = code.indexOf(marker);
    expect(start, `${marker} found`).toBeGreaterThan(-1);
    const lparen = code.indexOf('(', start);
    let pdepth = 0, j = lparen;
    for (; j < code.length; j++) {
      if (code[j] === '(') pdepth++;
      else if (code[j] === ')') { pdepth--; if (pdepth === 0) break; }
    }
    const open = code.indexOf('{', j);            // the FUNCTION BODY brace (past the destructured params)
    let depth = 0, i = open;
    for (; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) break; }
    }
    return { body: code.slice(open, i + 1), start, end: i + 1 };
  }

  // ⭐ RE-POINTED 2026-08-28, AND THE INVARIANT NOW SPANS TWO FILES BECAUSE THE CODE DOES.
  // writeBodyRelief moved to src/worldengine/dispatch/bodyRelief.js, so the production call site and the
  // lab-seam call site no longer live in one file. The clause is UNCHANGED in substance — still exactly two
  // writeLidResponseSphere call sites in the whole pipeline, one production (inside the dispatch function)
  // and one lab seam (guarded by labLidOverride) — it is only counted across both files now.
  // ⛔ Leaving it on rivers.js alone would have counted ONE and reddened on `1 === 2`; loud, not vacuous.
  const DISPATCH_CODE = stripComments(readSrc('../src/worldengine/dispatch/bodyRelief.js'));

  it('writeLidResponseSphere has EXACTLY two call sites pipeline-wide: production dispatch (inside writeBodyRelief) + labLidOverride (rivers.js lab seam)', () => {
    expect(DISPATCH_CODE, 'the dispatch file imports writeLidResponseSphere')
      .toMatch(/import\s*\{[^}]*writeLidResponseSphere[^}]*\}\s*from\s+['"][^'"]*lidResponse/);
    expect(RIVERS_CODE, 'rivers.js imports writeLidResponseSphere for the lab seam')
      .toMatch(/import\s*\{[^}]*writeLidResponseSphere[^}]*\}\s*from\s+['"][^'"]*lidResponse/);

    // 1. the PRODUCTION dispatch call, inside writeBodyRelief's condition-bearing branch:
    const wbr = functionBody(DISPATCH_CODE, 'function writeBodyRelief');
    const dispatchCalls = [...DISPATCH_CODE.matchAll(/writeLidResponseSphere\(/g)].map((m) => m.index);
    expect(dispatchCalls.length, 'exactly one call site in the dispatch file').toBe(1);
    expect(dispatchCalls.filter((i) => i > wbr.start && i < wbr.end).length,
      'that call is INSIDE writeBodyRelief (the derived unbrokenLid delegation)').toBe(1);

    // 2. the LAB seam call, guarded by the null-default labLidOverride hook:
    const riversCalls = [...RIVERS_CODE.matchAll(/writeLidResponseSphere\(/g)].map((m) => m.index);
    expect(riversCalls.length, 'exactly one call site in rivers.js (the lab render seam)').toBe(1);
    const guardWindow = RIVERS_CODE.slice(Math.max(0, riversCalls[0] - 600), riversCalls[0]);
    expect(guardWindow, 'the lab call is guarded by the labLidOverride hook').toMatch(/labLidOverride/);

    // …and no third site has appeared in either file.
    expect(dispatchCalls.length + riversCalls.length, 'exactly two call sites pipeline-wide').toBe(2);

    // The dispatch still never calls classifyLidPath (the router classifies internally; the dispatch reads
    // only the SUBTRACTIVE gate isUnbrokenLidPath). Asserted on BOTH files, so the move added no hiding place.
    expect(DISPATCH_CODE, 'no classifyLidPath in the dispatch file').not.toMatch(/classifyLidPath/);
    expect(RIVERS_CODE, 'no classifyLidPath in rivers.js').not.toMatch(/classifyLidPath/);
  });

  // The NEW base-writer scan (BUILD-PLAN §4 repurposing #2): the six base/ WRITERS the dispatch routes to
  // reference no router symbol and no E1 symbol — routing stays ABOVE the expression layer. (lidResponse.js
  // itself is the router; e1Regime.js is the source; both are the audited files, not scanned writers.
  // lidResponse legitimately calls writeMagmatismSphere/writeStagnantLidReliefSphere/writeMixedInteriorSphere —
  // this scan reads what the WRITERS reference, not who references them.)
  const BASE_WRITERS = ['magmatism.js', 'stagnantLid.js', 'shellRelief.js', 'tectonic.js', 'plates.js', 'mixedInterior.js'];
  for (const f of BASE_WRITERS) {
    it(`base writer ${f} calls no router/E1 symbol (writeLidResponseSphere/classifyLidPath/isUnbrokenLidPath/computeE1/modalRegime/inSeededBand)`, () => {
      const code = stripComments(readSrc(`../src/worldengine/base/${f}`));
      expect(code, 'no writeLidResponseSphere').not.toMatch(/writeLidResponseSphere/);
      expect(code, 'no classifyLidPath').not.toMatch(/classifyLidPath/);
      expect(code, 'no isUnbrokenLidPath').not.toMatch(/isUnbrokenLidPath/);
      expect(code, 'no computeE1').not.toMatch(/computeE1/);
      expect(code, 'no modalRegime').not.toMatch(/\bmodalRegime\b/);
      expect(code, 'no inSeededBand').not.toMatch(/\binSeededBand\b/);
      expect(code, 'no lidResponse import').not.toMatch(/from\s+['"][^'"]*lidResponse/);
      expect(code, 'no e1Regime import').not.toMatch(/from\s+['"][^'"]*e1Regime/);
    });
  }
});
