// tests/agent-camera-api.test.js — the headless gates on the agent-facing camera API.
//
// Contract: docs/WORKSTREAMS/agent-camera-api-2026-08-10/contract.json
//
// ⛔ WHAT THIS FILE CAN AND CANNOT GATE, stated up front so nothing here is quoted for more than it
// proves. The behavioural half of the contract (does a framing STICK? does the achieved distance
// match the rendered scene? does a sweep print the saturation?) is live-integration and is verified
// against the running app — none of it is in here, and a green run of this file is NOT evidence for
// any of it.
//
// What IS here: the pure law both front-ends share (the ladder, the LOD prediction), the live-vs-
// predicted separation that keeps an undriven body distinguishable from a correctly-far one, and
// the ORDERING GATE on the framing sequence. That last one is the point of the file.
//
// ⭐ WHY THE ORDERING GATE EXISTS. The defect this whole workstream was scoped around is a missing
// `cameraInterp.resync(camera)` whose absence produces a CONFIDENT SUCCESS REPORT — posDelta 0, the
// pose reading back correctly, and the camera hundreds of units away one frame later. A gate that
// only asked "is resync mentioned?" would pass on a file that calls it in the wrong place, and
// resync in the wrong place is WORSE than none: called before the controller has placed the camera,
// it pins the stale pose perfectly and makes the wrong frame stable and therefore convincing.
// So the assertion is on ORDER, not presence.
//
// ⚠ Every source assertion runs against comment-STRIPPED source. This file's own prose says
// "cameraInterp.resync" a dozen times and so does the module under test; a raw grep would be
// satisfied by the documentation of the thing it is supposed to be checking. That is the
// dead-comment-text class this repo built `stripCommentsPreservingOffsets` to end.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { approachLadder, lodPredictionAt, lodRampOf, autoOctaves } from '../planet-lod-lab-core.js';
import { lodStateOf, frameSequence } from '../src/camera/agentFraming.js';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readStripped = (rel) =>
  stripCommentsPreservingOffsets(readFileSync(resolve(REPO, rel), 'utf8'), { blankLiteralText: true });

/**
 * Body of the function whose signature starts at `signature`, by brace matching.
 * Safe on stripped source with literal text blanked: no brace can hide inside a string or comment.
 *
 * ⚠ THE PARAMETER LIST HAS TO BE SKIPPED FIRST, and this is not hypothetical fussiness — it is how
 * the first version of this helper was wrong. Taking the first `{` after the signature grabs a
 * DESTRUCTURING PARAMETER (`frameSequence({ camera, ... })`) or a DEFAULT VALUE
 * (`frameBody(subject = {}, ...)`), so brace matching closes on the parameter list and the returned
 * "body" is the argument names. Every assertion against it then fails for a reason that has nothing
 * to do with the code under test. So: walk the parens to their close, THEN take the next brace.
 */
function functionBodyAt(src, signature) {
  const at = src.indexOf(signature);
  if (at < 0) throw new Error(`signature not found in live code: ${signature}`);
  let i = src.indexOf('(', at);
  if (i < 0) throw new Error(`no parameter list after ${signature}`);
  let parens = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') parens++;
    else if (src[i] === ')') { parens--; if (parens === 0) { i++; break; } }
  }
  const open = src.indexOf('{', i);
  if (open < 0) throw new Error(`no body after the parameter list of ${signature}`);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  throw new Error(`unbalanced braces after ${signature}`);
}

describe('approachLadder — the rungs of an approach', () => {
  it('spans both endpoints EXACTLY, so a sweep can quote its first and last row', () => {
    const rungs = approachLadder(20, 1.2, 8);
    expect(rungs).toHaveLength(8);
    // Exact, not close: the endpoints are written rather than accumulated precisely so these two
    // assertions can be equality. An accumulating implementation drifts and would need a tolerance.
    expect(rungs[0]).toBe(20);
    expect(rungs[7]).toBe(1.2);
  });

  it('closes monotonically', () => {
    const rungs = approachLadder(20, 1.2, 8);
    for (let i = 1; i < rungs.length; i++) expect(rungs[i]).toBeLessThan(rungs[i - 1]);
  });

  it('is GEOMETRIC, not linear — equal ratios, which are equal steps in apparent size', () => {
    const rungs = approachLadder(16, 1, 5);
    // 16 -> 1 in 4 equal ratio steps is exactly halving.
    expect(rungs.map((r) => +r.toFixed(6))).toEqual([16, 8, 4, 2, 1]);
    // The linear ladder over the same span would be [16, 12.25, 8.5, 4.75, 1] — assert we are NOT
    // that, so a future "simplification" to linear spacing fails here instead of silently changing
    // where the sweep spends its samples.
    expect(rungs[1]).not.toBeCloseTo(12.25, 2);
  });

  it('refuses inputs that are not an approach', () => {
    expect(() => approachLadder(1.2, 20, 8)).toThrow(/from > to/);   // going outward
    expect(() => approachLadder(20, 20, 8)).toThrow(/from > to/);    // standing still
    expect(() => approachLadder(20, 1.2, 1)).toThrow(/at least 2/);  // cannot span two endpoints
    expect(() => approachLadder(20, 0, 8)).toThrow(/must be > 0/);   // inside the body
    expect(() => approachLadder(-5, -10, 8)).toThrow(/must be > 0/);
  });
});

describe('lodPredictionAt — what the shared law says a distance implies', () => {
  it('reproduces the ramp and octave budget the renderers actually use', () => {
    for (const d of [40, 20, 12, 8, 6, 3, 1.05]) {
      const p = lodPredictionAt(d);
      expect(p.ramp).toBeCloseTo(lodRampOf(d), 12);
      expect(p.octaves).toBeCloseTo(autoOctaves(lodRampOf(d)), 12);
    }
  });

  it('SATURATES at 6 body radii — the whole of the approach-consistency criterion', () => {
    expect(lodPredictionAt(20).saturated).toBe(false);
    expect(lodPredictionAt(6.01).saturated).toBe(false);
    expect(lodPredictionAt(6).saturated).toBe(true);
    expect(lodPredictionAt(1.05).saturated).toBe(true);
    // ⭐ The fact that makes the criterion measurable: from 6 radii down to the floor the disc grows
    // several-fold and the octave budget does not move at all.
    expect(lodPredictionAt(6).octaves).toBe(lodPredictionAt(1.05).octaves);
    expect(lodPredictionAt(6).octaves).toBe(9);
  });

  it('runs the budget from 4 to 9 across the ramp, not from 0', () => {
    expect(lodPredictionAt(1e6).octaves).toBe(4);
    expect(lodPredictionAt(0.001).octaves).toBe(9);
  });
});

describe('lodStateOf — live and predicted stay separable', () => {
  const meshWith = (uniforms) => ({ material: { uniforms } });

  it('agrees on a body whose LOD is being driven at its own distance', () => {
    const at = 3;
    const driven = meshWith({ uOctaves: { value: autoOctaves(lodRampOf(at)) }, uLodRamp: { value: lodRampOf(at) } });
    const s = lodStateOf(driven, at);
    expect(s.agrees).toBe(true);
    expect(s.note).toBeNull();
    expect(s.live.octaves).toBe(9);
    expect(s.predicted.octaves).toBe(9);
  });

  it('⭐ DISAGREES on a body pinned at the 4.0 default while close — the planet-class-moon signature', () => {
    // A planet-class moon is built down a branch that never registers it with LODManager, so its
    // uOctaves never leaves the constructed default no matter how near the camera gets.
    const undriven = meshWith({ uOctaves: { value: 4.0 }, uLodRamp: { value: 0.0 } });
    const s = lodStateOf(undriven, 2);
    expect(s.agrees).toBe(false);
    expect(s.predicted.octaves).toBe(9);
    expect(s.note).toMatch(/DISAGREE/);
    expect(s.note).toMatch(/LODManager/);
  });

  it('does NOT cry wolf on a body that is correctly at 4 octaves because it is far away', () => {
    // Same live value as the case above — 4.0 — and this one is CORRECT. Distinguishing these two is
    // the entire reason live and predicted are reported as separate fields rather than one number.
    const farButDriven = meshWith({ uOctaves: { value: 4.0 }, uLodRamp: { value: 0.0 } });
    const s = lodStateOf(farButDriven, 40);
    expect(s.agrees).toBe(true);
    expect(s.note).toBeNull();
  });

  it('says so plainly when a body carries no LOD uniform at all', () => {
    const s = lodStateOf(meshWith({}), 3);
    expect(s.agrees).toBeNull();
    expect(s.live.octaves).toBeNull();
    expect(s.note).toMatch(/no uOctaves/);
  });
});

describe('frameSequence — the ordering that makes a framing stick', () => {
  const harness = (initial = {}) => {
    const calls = [];
    const camera = { position: { x: 0, y: 0, z: 0 }, updateMatrixWorld: () => calls.push('updateMatrixWorld') };
    const cameraController = {
      bypassed: initial.bypassed ?? false,
      autoRotateActive: initial.autoRotateActive ?? false,
      focusOn: (pos, dist) => calls.push(`focusOn:${dist}`),
      update: (dt) => calls.push(`update:${dt}`),
    };
    const cameraInterp = { resync: () => calls.push('resync') };
    return { calls, camera, cameraController, cameraInterp };
  };

  it('⭐ places the camera BEFORE announcing the teleport', () => {
    const h = harness();
    frameSequence({ ...h, worldPos: { x: 1 }, viewDistance: 42 });
    // The order is the assertion. resync collapses both interpolator snapshots onto the camera's
    // CURRENT pose — run before update() it pins the pose the camera is leaving, which is the
    // failure mode that is worse than omitting resync entirely because the stale frame becomes stable.
    expect(h.calls).toEqual(['focusOn:42', 'update:0', 'updateMatrixWorld', 'resync']);
    expect(h.calls.indexOf('resync')).toBeGreaterThan(h.calls.indexOf('update:0'));
  });

  it('updates with dt 0, so nothing eases part-way toward the requested pose', () => {
    const h = harness();
    frameSequence({ ...h, worldPos: {}, viewDistance: 10 });
    expect(h.calls).toContain('update:0');
  });

  it('⛔ clears `bypassed` FIRST — update() returns immediately when it is set', () => {
    // This is not defensive tidying. `setCameraPose` leaves bypassed true and never clears it, so
    // without this the whole call no-ops against a controller that never moves the camera, and
    // reports success while doing nothing.
    const h = harness({ bypassed: true });
    const out = frameSequence({ ...h, worldPos: {}, viewDistance: 10 });
    expect(h.cameraController.bypassed).toBe(false);
    expect(out.bypassClearedFrom).toBe(true);
    expect(h.calls).toContain('update:0');
  });

  it('turns off auto-rotate and reports that it had to', () => {
    // 0.67 deg/s is nothing over one frame and enough to move the disc between two rungs of a sweep.
    const h = harness({ autoRotateActive: true });
    const out = frameSequence({ ...h, worldPos: {}, viewDistance: 10 });
    expect(h.cameraController.autoRotateActive).toBe(false);
    expect(out.autoRotateClearedFrom).toBe(true);
  });

  it('reports a clean controller as clean, so the flags mean something when they are true', () => {
    const out = frameSequence({ ...harness(), worldPos: {}, viewDistance: 10 });
    expect(out).toEqual({ bypassClearedFrom: false, autoRotateClearedFrom: false });
  });
});

describe('AC-6 — the resync call cannot be silently deleted', () => {
  it('frameSequence calls resync in LIVE code, after the placement', () => {
    const body = functionBodyAt(readStripped('src/camera/agentFraming.js'), 'export function frameSequence');
    const iFocus = body.indexOf('focusOn');
    const iUpdate = body.indexOf('.update(');
    const iResync = body.indexOf('cameraInterp.resync');
    expect(iFocus, 'focusOn missing from live code').toBeGreaterThan(-1);
    expect(iUpdate, 'update() missing from live code').toBeGreaterThan(-1);
    expect(iResync, 'resync missing from live code').toBeGreaterThan(-1);
    expect(iResync).toBeGreaterThan(iUpdate);
    expect(iUpdate).toBeGreaterThan(iFocus);
  });

  it('setCameraPose calls resync in LIVE code — the hook whose omission started this', () => {
    const body = functionBodyAt(readStripped('src/main.js'), 'setCameraPose(pose)');
    expect(body).toMatch(/cameraInterp\.resync\(camera\)/);
  });

  it('the game frameBody measures AFTER awaiting frames, not before', () => {
    const body = functionBodyAt(readStripped('src/main.js'), 'async frameBody(subject');
    const iAwait = body.indexOf('requestAnimationFrame');
    const iMeasure = body.indexOf('measureFraming(');
    expect(iAwait, 'frameBody does not await a frame').toBeGreaterThan(-1);
    expect(iMeasure, 'frameBody does not measure').toBeGreaterThan(-1);
    // Measuring before the loop has run measures the REQUEST. That is precisely how the previous
    // scripted-pose hook produced numbers that were confident, printable and wrong.
    expect(iMeasure).toBeGreaterThan(iAwait);
  });
});
