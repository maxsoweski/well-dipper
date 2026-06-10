// Portal-A re-anchor margin vs float64 rounding noise (root cause, 2026-06-10).
//
// At the warp swap, main.js re-opens Portal A just behind the teleported
// camera and forces INSIDE. The INSIDE→OUTSIDE_A "backed out" transition
// fires on a dotA sign change (prevDotA < 0 && dotA >= 0). dotA subtracts
// two near-identical position vectors at destination coordinate magnitudes
// (1e4–1e6 scene units), where double-precision rounding is ~1e-11 to 1e-10
// per component — so any back-margin at or below that scale leaves dotA's
// SIGN as pure noise for the few render frames until the cruise moves the
// camera a real distance. One noisy negative frame followed by one noisy
// non-negative frame = spurious "backed out", and the machine can never
// recover (the camera only moves forward, away from Portal A). Live
// signature: disc B never shows (tunnel second half missing), AC4 silent
// (it only checks for stuck-INSIDE). Reproduced per-frame on GPU 9223,
// warp 9 → binary 77967870 — the camera crossed the B plane dead-center
// while the mode sat in OUTSIDE_A.
//
// These tests pin the requirement on the pure machine: the old 1e-10
// margin is sign-unstable under that noise; the production margin must
// survive it with orders of magnitude to spare. 0.5u costs 0.1% of the
// ~463u travel budget.
import { describe, it, expect } from 'vitest';
import { createTraversal, stepTraversal } from '../src/effects/portalTraversal.js';

const FWD = { x: 0, y: 0, z: -1 };           // flight axis (toward Portal B)
const CAM = { x: 81234.5, y: 2, z: -67890.25 }; // destination-scale coords
const NOISE = 1.2e-10;                        // ~float64 eps at 1e6 magnitude

// Build the post-swap frame sequence: camera pinned at the re-anchor pose
// (the interpolator resync collapses both snapshots onto it), Portal A
// `margin` behind along the flight axis, per-frame rounding jitter on the
// derived portal position (matrixWorld compose/extract round-trip noise).
function runPostSwapFrames(margin, frames = 8) {
  // Portal A normal points BACK toward the origin side (-direction), so
  // INSIDE holds dotA = -margin.
  const aNrm = { x: -FWD.x, y: -FWD.y, z: -FWD.z };
  const bPos = { x: CAM.x + FWD.x * 70, y: CAM.y + FWD.y * 70, z: CAM.z + FWD.z * 70 };
  const bNrm = { ...FWD };
  let state = createTraversal('INSIDE');
  for (let i = 0; i < frames; i++) {
    const jitter = (i % 2 === 0 ? 1 : -1) * NOISE; // alternating rounding wobble
    const aPos = {
      x: CAM.x - FWD.x * margin + aNrm.x * jitter,
      y: CAM.y - FWD.y * margin + aNrm.y * jitter,
      z: CAM.z - FWD.z * margin + aNrm.z * jitter,
    };
    state = stepTraversal(state, { camPos: CAM, aPos, aNrm, bPos, bNrm, discRadius: 3 });
  }
  return state.mode;
}

describe('post-swap Portal A margin vs rounding noise', () => {
  it('documents the bug: a 1e-10 margin is sign-unstable — INSIDE is lost', () => {
    expect(runPostSwapFrames(1e-10)).toBe('OUTSIDE_A');
  });

  it('production margin 0.5u holds INSIDE through rounding jitter', () => {
    expect(runPostSwapFrames(0.5)).toBe('INSIDE');
  });

  it('margin survives even 1000x the expected noise floor', () => {
    // belt-and-braces: rounding through deeper pipelines (rebase shifts,
    // matrix chains) still can't reach a 0.5u wobble
    const aNrm = { x: 0, y: 0, z: 1 };
    let state = createTraversal('INSIDE');
    for (let i = 0; i < 8; i++) {
      const jitter = (i % 2 === 0 ? 1 : -1) * NOISE * 1000;
      const aPos = { x: CAM.x, y: CAM.y, z: CAM.z + 0.5 + jitter };
      state = stepTraversal(state, {
        camPos: CAM, aPos, aNrm,
        bPos: { x: CAM.x, y: CAM.y, z: CAM.z - 70 }, bNrm: { x: 0, y: 0, z: -1 },
        discRadius: 3,
      });
    }
    expect(state.mode).toBe('INSIDE');
  });
});
