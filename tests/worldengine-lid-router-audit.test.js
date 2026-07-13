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

// ── AC-ZERO-CLOBBER (dispatch seam) — RECONCILED for V2-2b-2a Slice C (MF1 Option B, Max-approved 2026-07-05).
//    V2-2a asserted the router was ABSENT from planet-lod-rivers.js entirely. Slice C's LAB-ONLY mixed-interior
//    render seam legitimately imports writeLidResponseSphere and calls it from route()'s null-default
//    labLidOverride hook (every PRODUCTION caller passes no override → route() stays byte-inert; the 75-golden
//    bypasses route()). The load-bearing invariant is UNCHANGED: the PRODUCTION dispatch (writeBodyRelief) keys
//    on PRESET_ARCHETYPE and touches NO router symbol — so no shipped preset reaches the mixed path. The first
//    test now confines the router reference to the labLidOverride hook; the second still fences writeBodyRelief.
describe('V2-2b-2a AC-ZERO-CLOBBER — the router reaches rivers.js ONLY via route()\'s labLidOverride lab hook', () => {
  it('planet-lod-rivers.js references the router ONLY through the null-default labLidOverride lab hook', () => {
    // MF1 Option B: the import + the single call are PERMITTED (the lab-only render seam) …
    expect(RIVERS_CODE, 'imports writeLidResponseSphere for the lab render seam')
      .toMatch(/import\s*\{[^}]*writeLidResponseSphere[^}]*\}\s*from\s+['"][^'"]*lidResponse/);
    // … but the router call is GATED on labLidOverride (the null-default lab hook), never an unconditional
    // production route: the labLidOverride guard sits immediately above the writeLidResponseSphere( call.
    const callIdx = RIVERS_CODE.indexOf('writeLidResponseSphere(');
    expect(callIdx, 'writeLidResponseSphere is called (the lab render seam)').toBeGreaterThan(-1);
    const guardWindow = RIVERS_CODE.slice(Math.max(0, callIdx - 600), callIdx);
    expect(guardWindow, 'the router call is guarded by the labLidOverride lab hook').toMatch(/labLidOverride/);
    // classifyLidPath is NEVER referenced in the dispatch file (the router classifies internally).
    expect(RIVERS_CODE, 'no classifyLidPath reference in the dispatch file').not.toMatch(/classifyLidPath/);
  });

  it('the writeBodyRelief function body itself calls no router symbol (production dispatch stays on PRESET_ARCHETYPE)', () => {
    const start = RIVERS_CODE.indexOf('function writeBodyRelief');
    expect(start, 'writeBodyRelief found in the dispatch file').toBeGreaterThan(-1);
    // the function is ~50 lines; a generous window covers its whole body without reaching unrelated code.
    const body = RIVERS_CODE.slice(start, start + 4000);
    expect(body).not.toMatch(/writeLidResponseSphere/);
    expect(body).not.toMatch(/lidResponse/);
    expect(body).not.toMatch(/classifyLidPath/);
  });
});
