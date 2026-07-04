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
//   • AC-ZERO-CLOBBER  — planet-lod-rivers.js (writeBodyRelief / the dispatch seam) neither imports nor calls
//                        the router: writeLidResponseSphere / lidResponse appear NOWHERE in the dispatch file.
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

// ── AC1 — determinism + reserved 'lid:' namespace ───────────────────────────────────────────────────────
describe('V2-2a AC1 — the router is pure/deterministic; zero RNG; the \'lid:\' namespace is RESERVED (unused)', () => {
  it('router source has no Math.random / Date.now and imports/draws NO alea (⇒ zero \'lid:\' draws)', () => {
    expect(LID_CODE, 'no Math.random').not.toMatch(/Math\.random\s*\(/);
    expect(LID_CODE, 'no Date.now').not.toMatch(/Date\.now\s*\(/);
    expect(LID_CODE, 'router draws no alea at all (classifier is pure; corners keep their own streams)').not.toMatch(/\balea\b/);
    // The 'lid:' alea namespace (V2-2b 'lid:strength:'/'lid:yield:') is RESERVED — zero such literals here.
    // (The path markers use 'lid-weak'/'lid-strong'/'lid-mixed'/'lid-offpilot' — a hyphen, NOT the 'lid:' colon.)
    expect(LID_CODE, "the 'lid:' namespace is reserved, not used").not.toMatch(/lid:/);
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

// ── AC-MIXED-STUB — the explicit-unimplemented marker; carrier.height UNWRITTEN ─────────────────────────
describe('V2-2a AC-MIXED-STUB — a mixed vector hits the return-marker with NO height written', () => {
  // A hand-set mixed vector: rocky, no heat-pipe, L in [MIXED_LO(0.35), L_STRONG(0.63)) → 'mixed' (Mars-like).
  const mixedE1 = { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.5 };

  it('return === {path:\'lid-mixed\', fineClass:\'mixed\', unimplemented:true}; carrier.height byte-unchanged; no corner emit', () => {
    const c = carrierOf();
    const SENTINEL = 123.5;
    c.height.fill(SENTINEL);
    const before = arr(c.height);
    const r = writeLidResponseSphere(c, {}, { e1: mixedE1, rawTidal: 0, macroSeed: 1 });
    expect(r).toEqual({ path: 'lid-mixed', fineClass: 'mixed', unimplemented: true });
    expect(r.primitiveId, 'no corner emit on the mixed marker').toBeUndefined();
    expect(arr(c.height), 'carrier.height byte-unchanged from the pre-filled sentinel').toEqual(before);
    // No 'lid:' alea draw is even POSSIBLE — the router source contains no alea (AC1 grep leg above).
  });

  it('an off-pilot vector likewise returns a marker (path lid-offpilot) with height UNWRITTEN', () => {
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

  it('resolves the strong regime ARCHETYPE-FREE from geodynamicRegime===\'stagnant\' → the single constant', () => {
    expect(LID_CODE, "reads the E1 coordinate geodynamicRegime==='stagnant'").toMatch(/geodynamicRegime\s*===\s*['"]stagnant['"]/);
    expect(LID_CODE, 'maps to the single strong constant').toMatch(/venus-stagnant-lid/);
  });
});

// ── AC-ZERO-CLOBBER (dispatch seam) — the router is ABSENT from planet-lod-rivers.js ─────────────────────
describe('V2-2a AC-ZERO-CLOBBER — writeBodyRelief neither imports nor calls the router (un-wired dispatch)', () => {
  it('planet-lod-rivers.js references neither lidResponse nor writeLidResponseSphere anywhere', () => {
    expect(RIVERS_CODE, 'no import of lidResponse.js').not.toMatch(/from\s+['"][^'"]*lidResponse/);
    expect(RIVERS_CODE, 'no writeLidResponseSphere reference (the router is absent from the dispatch file)').not.toMatch(/writeLidResponseSphere/);
    expect(RIVERS_CODE, 'no classifyLidPath reference in the dispatch file').not.toMatch(/classifyLidPath/);
  });

  it('the writeBodyRelief function body itself calls no router symbol', () => {
    const start = RIVERS_CODE.indexOf('function writeBodyRelief');
    expect(start, 'writeBodyRelief found in the dispatch file').toBeGreaterThan(-1);
    // the function is ~50 lines; a generous window covers its whole body without reaching unrelated code.
    const body = RIVERS_CODE.slice(start, start + 4000);
    expect(body).not.toMatch(/writeLidResponseSphere/);
    expect(body).not.toMatch(/lidResponse/);
    expect(body).not.toMatch(/classifyLidPath/);
  });
});
