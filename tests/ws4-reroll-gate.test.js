// tests/ws4-reroll-gate.test.js — WS4 T14 (D7): gate the FOUR grained-axis GUI rerolls so a 🎲 reroll
// can't reintroduce an INDEPENDENT random strike axis once the shared grain field is authoritative.
//
// AC: one-shared-grain (closes the leak — with grain ON, all grained features keep deriving strike
// from the ONE shared cube; a per-feature reroll must NOT write a fresh Math.random / randUnitVec3
// axis that decorrelates that feature).
//
// THE REPLACE-SET (re-verified in code 2026-06-25; the plan's :3721/:3734/:3749/:3775 cites drifted —
// the live handlers are):
//   • orogeny  — fMountains 🎲: `state.orogenyAngle = Math.random()*2π - π` written DIRECTLY (NOT via
//     randUnitVec3). THE leak the original T14 missed, on the feature Max names first.
//   • chasma   — fCanyons 🎲:  `state.chasmaAxes = [randUnitVec3(), randUnitVec3(), randUnitVec3()]`
//   • scarp    — fScarps 🎲:   `state.scarpAxis = randUnitVec3()`
//   • tessera  — fTessera 🎲:  `state.tesseraAxes = [randUnitVec3(), randUnitVec3()]`
// lava (fLava 🎲) + cryo (fCryoRidge 🎲) reroll ONLY offsets (lavaOffset / cryoRidgeOffsetV), never
// their axes — their axes come solely from the seed-derived applyDrivers path — so they need NO gate.
// This test ASSERTS that fact too (a regression guard: a careless future edit must not start gating
// the offset-only rerolls, nor must the axis gate over-fire).
//
// WHY a source-scan (same rationale as the T5/T13 combiner-wire tests): the reroll handlers live in
// world-engine-lab.html PAGE scope (not an importable module), and the gate is a STRUCTURAL property of
// that handler body — when grain is ON the per-feature AXIS write must be guarded by
// uTectonicGrainStrength, so the random axis is never installed. The live `_lab.grainProbe` assertion
// (an orogeny/chasma/scarp/tessera reroll with grain ON leaves all six strikes correlated) needs the
// :9223 GPU Chrome and is listed as a LIVE-deferred check — it cannot run headless.
//
// HARD RULE: no Date.now / Math.random in DERIVATION. The handlers DO use Math.random — that is the
// grain-OFF legacy look, which is exactly why it must be gated OFF when grain is ON; the assertion is
// that the random write is GUARDED, not that Math.random is absent from the GUI.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LAB = readFileSync(join(__dirname, '..', 'world-engine-lab.html'), 'utf8');

// Extract the body of a `<folder>.add({ roll(){ … } }, 'roll')` handler whose body contains `marker`.
// We find the `.add({ roll(){` whose following body contains the marker, then brace-walk to the
// matching close of that roll() function so assertions can't bleed into an adjacent folder's handler.
function rerollBody(src, marker) {
  let from = 0;
  for (;;) {
    const add = src.indexOf('roll(){', from);
    expect(add, `a roll(){ handler containing ${marker} must exist`).toBeGreaterThanOrEqual(0);
    const open = src.indexOf('{', add + 'roll('.length); // the { of roll(){
    let depth = 0, i = open, end = -1;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    const body = src.slice(open, end);
    if (body.includes(marker)) return body;
    from = add + 'roll(){'.length;
  }
}

describe('WS4 T14 — the FOUR grained-axis rerolls are gated on uTectonicGrainStrength', () => {
  it('orogeny 🎲: the direct Math.random strike-angle write is guarded by grain strength', () => {
    // The leak: `state.orogenyAngle = Math.random()*2π - π` is written DIRECTLY (not randUnitVec3).
    const body = rerollBody(LAB, 'state.orogenyAngle = Math.random()');
    // the handler must consult uTectonicGrainStrength so the random axis is skipped when grain is ON
    expect(body, 'orogeny reroll must gate on uTectonicGrainStrength').toMatch(/uTectonicGrainStrength/);
    // the Math.random orogenyAngle write must be GUARDED — it must NOT be the unconditional first
    // statement. Concretely: the grain-strength check appears BEFORE the random axis write.
    const guardIdx = body.search(/uTectonicGrainStrength/);
    const writeIdx = body.search(/state\.orogenyAngle\s*=\s*Math\.random/);
    expect(writeIdx, 'orogeny random write must still exist (grain-OFF legacy look)').toBeGreaterThanOrEqual(0);
    expect(guardIdx, 'the grain-strength guard must precede the random orogenyAngle write')
      .toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeLessThan(writeIdx);
  });

  it('chasma 🎲: the randUnitVec3 axis write is guarded by grain strength', () => {
    const body = rerollBody(LAB, 'state.chasmaAxes = [randUnitVec3()');
    expect(body, 'chasma reroll must gate on uTectonicGrainStrength').toMatch(/uTectonicGrainStrength/);
    const guardIdx = body.search(/uTectonicGrainStrength/);
    const writeIdx = body.search(/state\.chasmaAxes\s*=\s*\[\s*randUnitVec3/);
    expect(writeIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeLessThan(writeIdx);
  });

  it('scarp 🎲: the randUnitVec3 axis write is guarded by grain strength', () => {
    const body = rerollBody(LAB, 'state.scarpAxis = randUnitVec3()');
    expect(body, 'scarp reroll must gate on uTectonicGrainStrength').toMatch(/uTectonicGrainStrength/);
    const guardIdx = body.search(/uTectonicGrainStrength/);
    const writeIdx = body.search(/state\.scarpAxis\s*=\s*randUnitVec3/);
    expect(writeIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeLessThan(writeIdx);
  });

  it('tessera 🎲: the randUnitVec3 axis write is guarded by grain strength', () => {
    const body = rerollBody(LAB, 'state.tesseraAxes = [randUnitVec3()');
    expect(body, 'tessera reroll must gate on uTectonicGrainStrength').toMatch(/uTectonicGrainStrength/);
    const guardIdx = body.search(/uTectonicGrainStrength/);
    const writeIdx = body.search(/state\.tesseraAxes\s*=\s*\[\s*randUnitVec3/);
    expect(writeIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeLessThan(writeIdx);
  });
});

describe('WS4 T14 — lava + cryo rerolls touch only OFFSETS (no axis) → must NOT be gated', () => {
  it('lava 🎲 rerolls lavaOffset only (no axis write) and stays a plain randOffset roll', () => {
    const body = rerollBody(LAB, 'state.lavaOffset = randOffset()');
    // it must not start writing an axis (no lavaAxis / randUnitVec3 leak here)
    expect(body, 'lava reroll must NOT write an axis').not.toMatch(/state\.lavaAxis\s*=/);
    expect(body, 'lava reroll must NOT call randUnitVec3').not.toMatch(/randUnitVec3/);
  });

  it('cryo 🎲 rerolls cryoRidgeOffsetV only (no axis write) and stays a plain randOffset roll', () => {
    const body = rerollBody(LAB, 'state.cryoRidgeOffsetV = randOffset()');
    expect(body, 'cryo reroll must NOT write an axis').not.toMatch(/state\.cryoRidgeAxis/);
    expect(body, 'cryo reroll must NOT call randUnitVec3').not.toMatch(/randUnitVec3/);
  });
});
