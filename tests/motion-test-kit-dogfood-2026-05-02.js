#!/usr/bin/env node
// AC #23 dogfood: re-verify the toggle-fix workstream's diagnostics
// using the kit's predicates. Reads the pre-AC-#1-fix recordings
// captured 2026-05-02 morning, converts them to kit-shape, runs the
// predicate suite, reports findings.
//
// What this verifies:
//   - The kit's deltaMagnitudeBound + monotonicityScore predicates
//     applied to the toggle-fix incident's telemetry FLAG the teleport-
//     cycle bug class that the original process (3-point sampling)
//     missed. That's the demonstration the brief calls for.
//   - Or, if the predicates pass, that's evidence the bug class isn't
//     present in those particular recordings (per AC #23's two-valid-
//     outcomes framing).
//
// Why offline: well-dipper's Vite dev server isn't running at this
// session; a fresh live capture is the ideal dogfood per AC #23 but the
// 2026-05-02 morning JSON captures hold the same data shape (after kit-
// shape conversion). When Max next runs the dev server, the live
// dogfood can be re-done via window._autopilot.telemetry — kit-shape
// fields are now emitted per AC #22.

import { readFileSync } from 'node:fs';
import {
  deltaMagnitudeBound,
  monotonicityScore,
} from '../vendor/motion-test-kit/core/predicates/index.js';

const DIAG_DIR = '/home/ax/projects/well-dipper/screenshots/diagnostics/manual-autopilot-toggle-2026-05-02';

const cases = [
  { file: 'solA-auto-to-manual-2026-05-02-telemetry.json', label: 'Sol A — autopilot → WASD interrupt' },
  { file: 'solB-manual-to-auto-2026-05-02-telemetry.json', label: 'Sol B — manual → autopilot engage' },
  { file: 'procA-auto-to-manual-2026-05-02-telemetry.json', label: 'Proc A — autopilot → WASD interrupt' },
  { file: 'procB-manual-to-auto-2026-05-02-telemetry.json', label: 'Proc B — manual → autopilot engage' },
];

// ── Convert well-dipper-shape sample → kit-shape SampleRecord ────────────
//
// Well-dipper-shape (slim, from morning diagnostics):
//   { t, cam: [x,y,z], fwd: [x,y,z], shipPhase, navPhase, framing, cameraMode,
//     speed: { scene, ly }, angRate, bodyDist, velBlend }
// Kit-shape:
//   { frame, t, dt, anchor: {pos, quat}, target: {pos, quat}|null,
//     input: {}, state: {} }

function toKitShape(slim) {
  const samples = [];
  let prevT = null;
  let frame = 0;
  for (const s of slim) {
    samples.push({
      frame: frame++,
      t: s.t,
      dt: prevT === null ? 0 : (s.t - prevT),
      anchor: {
        pos: s.cam,
        // Slim format didn't capture quaternion; reconstruct identity.
        // Predicates that read .quat (transformHashEquivalence) would
        // see no rotation; the predicates we care about for this dogfood
        // (deltaMagnitudeBound, monotonicityScore) read only .pos.
        quat: [0, 0, 0, 1],
      },
      target: null,  // diagnostics didn't record body refs in slim form
      input: {},
      state: {
        shipPhase: s.shipPhase,
        navPhase: s.navPhase,
        framingState: s.framing,
        cameraMode: s.cameraMode,
      },
    });
    prevT = s.t;
  }
  return samples;
}

console.log('# Motion-test-kit dogfood — toggle-fix AC #4 re-verification');
console.log('# Source: 2026-05-02 morning diagnostic recordings');
console.log('# Predicates applied: deltaMagnitudeBound (Z axis), monotonicityScore (Z axis)');
console.log('');

for (const c of cases) {
  const path = `${DIAG_DIR}/${c.file}`;
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  const samples = toKitShape(data.slim);

  console.log(`## ${c.label}`);
  console.log(`Samples: ${samples.length}`);

  // Predicate 1: deltaMagnitudeBound on Z. AC #4 in the toggle-fix
  // brief implicitly required no per-frame teleport. Bound 5 scene-units
  // per frame is generous (typical W thrust at ~50 unit/s × 16.667ms =
  // 0.83 unit/frame; 5 unit cap is ~6× normal).
  const dMag = deltaMagnitudeBound(samples, { axis: 'z', bound: 5 });
  console.log(`  deltaMagnitudeBound (axis=z, bound=5): ${dMag.passed ? 'PASS' : 'FAIL'} — ${dMag.violations.length} violations${dMag.violations.length > 0 ? ` (first at frame ${dMag.violations[0].frame}, value ${dMag.violations[0].value.toFixed(2)})` : ''}`);

  // Predicate 2: monotonicityScore on Z. Looks for direction reversals
  // — the teleport-cycle Max saw is a high-frequency oscillation.
  // 30-frame span ≈ 0.5s at 60Hz; > 5 flips/span = oscillation.
  const mScore = monotonicityScore(samples, { axis: 'z', windowFrames: 30, maxFlipsPerWindow: 5 });
  console.log(`  monotonicityScore  (axis=z, span=30, maxFlips=5): ${mScore.passed ? 'PASS' : 'FAIL'} — ${mScore.violations.length} violating spans${mScore.violations.length > 0 ? ` (first at frame ${mScore.violations[0].frame}, ${mScore.violations[0].value} flips)` : ''}`);

  // Predicate 3: same on X axis (procedural showed both x and z motion)
  const dMagX = deltaMagnitudeBound(samples, { axis: 'x', bound: 5 });
  const mScoreX = monotonicityScore(samples, { axis: 'x', windowFrames: 30, maxFlipsPerWindow: 5 });
  console.log(`  deltaMagnitudeBound (axis=x, bound=5): ${dMagX.passed ? 'PASS' : 'FAIL'} — ${dMagX.violations.length} violations`);
  console.log(`  monotonicityScore  (axis=x, span=30, maxFlips=5): ${mScoreX.passed ? 'PASS' : 'FAIL'} — ${mScoreX.violations.length} violating spans`);
  console.log('');
}

console.log('# Interpretation');
console.log('#');
console.log('# These captures are PRE-fix (HEAD e11fc4b, before the AC #1');
console.log('# autopilotMotion.stop() wiring landed at f674ced). The bug Max');
console.log('# observed in the recording was a teleport-cycle visible in the');
console.log('# autopilot CRUISE phase — the kind of motion-continuity violation');
console.log('# this kit was built to flag automatically.');
console.log('#');
console.log('# The original toggle-fix verification used coarse 3-point sampling');
console.log('# and called AC #4 PASS. The kit predicates above are the structural');
console.log('# replacement: per-frame Δ + sign-change rate, applied uniformly.');
console.log('#');
console.log('# For the live dogfood (post-fix at f674ced), Max starts');
console.log('#   cd ~/projects/well-dipper && npm run dev');
console.log('# and the chrome-devtools-driven capture re-runs the toggle-fix');
console.log('# scenarios against the fixed code, asserting via the same predicates.');
