// planet-lod-tectonic.js
// WS4 orchestrator/baker — the net-new glue (dossier risk #1 / plan §D1) that builds a grain
// carrier, runs the prod E6 writer, and produces the per-node STRIKE-ONLY field the renderer will
// consume. Nothing else in the codebase does this (only vitest builds carriers today).
//
// SCOPE OF THIS FILE AT T4 (scaffold only):
//   - bakeTectonicGrain wires buildIrregularSphere → makeSphereField → writeGrainSphere and emits
//     the documented per-node arrays { grainAngleSmooth, grainMag, regime, strikeWorldX/Y/Z }.
//   - smoothStrikeAngle + the province composition are STUBBED to identity (raw quantized {0, π/2}
//     director). The continuous smooth director, the macroSeed band placement, and the cube bake
//     land in T6/T7/T8; in-shader province rotation lands in T13. T4 lands NO renderer wiring.
//
// SOURCE OF TRUTH (D10): the E6 math is imported from the PROD WS2 copy
// src/worldengine/base/tectonic.js (has the sphere path + exported band constants). The lab
// relief-e6-tectonic.js is reference only — do NOT import it (two copies → drift).
//
// MAX DECISIONS (2026-06-25) honoured here:
//   #3 move-2 / rotatePoleDeg is DROPPED. writeGrainSphere stays the EXISTING 2-arg
//      writeGrainSphere(carrier, drivers) — NO edit to src/worldengine/base/tectonic.js, and this
//      module NEVER threads rotatePoleDeg into it. bakeTectonicGrain accepts a rotatePoleDeg field
//      in its options for forward-compat / call-site stability, but it is a documented no-op.
//
// HARD RULES: no Date.now / no Math.random anywhere in this derivation. The only entropy is the
// integer macroSeed, consumed (later, T6) via the same sin-hash recipe the GLSL uses — never via
// the GUI randUnitVec3 (Math.random) helper.

import { writeGrainSphere } from './src/worldengine/base/tectonic.js';
import { makeSphereField } from './src/worldengine/base/sphereField.js';

// ── smoothStrikeAngle(sMer, sZon) ──────────────────────────────────────────────────────────────
// T4 STUB: returns the raw quantized E6 director (0 where meridional stress dominates, π/2 where
// zonal dominates) — the SAME {0, π/2} step writeGrainSphere emits. This is identity, NOT smooth.
// T6 REPLACES the body with a CONTINUOUS function of the (sMer, sZon) stress components (monotone
// through the 45° |sMer|=|sZon| crossover) and owns the continuity RED. The signature is fixed now
// so T6 is a body-only change.
export function smoothStrikeAngle(sMer, sZon) {
  return Math.abs(sMer) >= Math.abs(sZon) ? 0 : Math.PI / 2;
}

// ── bakeTectonicGrain({ mesh, drivers, macroSeed, rotatePoleDeg }) ──────────────────────────────
// Build the carrier over the SAME buildIrregularSphere mesh the router uses, run the prod
// writeGrainSphere, and emit per-node strike-only fields. At T4 the strike is derived from the raw
// quantized carrier.grainAngle (via the smoothStrikeAngle stub) and converted to a WORLD-space unit
// strike vector through the carrier's orthonormal tangent frame: strike = cos(angle)*east +
// sin(angle)*north (dossier "Slice 1 — WS4 consumer API").
//
// macroSeed and rotatePoleDeg are accepted and validated now so the bake host (T8) and the smooth
// director (T6) plug in without a signature change. At T4 they do not alter the output (Max #3:
// rotatePoleDeg is a no-op; macroSeed band placement is T6).
export function bakeTectonicGrain({ mesh, drivers, macroSeed = 0, rotatePoleDeg = 0 } = {}) {
  if (!mesh || !mesh.verts) {
    throw new Error('bakeTectonicGrain: mesh with verts is required');
  }
  // rotatePoleDeg is intentionally NOT threaded into writeGrainSphere (Max #3 — 2-arg writer).
  // Reference it so the no-op contract is explicit and lint-visible, without affecting the bake.
  void rotatePoleDeg;
  void macroSeed;

  const carrier = makeSphereField(mesh);
  // 2-arg prod writer (Max #3) — pure, zero rng → byte-identical on re-run.
  writeGrainSphere(carrier, drivers);

  const N = carrier.N;
  const grainAngleSmooth = new Float32Array(N);
  const grainMag = new Float32Array(N);
  const regime = new Uint8Array(N);
  const strikeWorldX = new Float32Array(N);
  const strikeWorldY = new Float32Array(N);
  const strikeWorldZ = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    // T4 stub: re-quantize the carrier's director through smoothStrikeAngle. The carrier exposes the
    // quantized grainAngle (0 or π/2) but not the raw sMer/sZon per node; passing cos/sin of that
    // angle recovers the same {0, π/2} classification the stub returns, so the scaffold output is the
    // identity director. (T6 will derive the smooth angle from the continuous stress components.)
    const a = carrier.grainAngle[i];
    const angle = smoothStrikeAngle(Math.cos(a), Math.sin(a));
    grainAngleSmooth[i] = angle;
    grainMag[i] = carrier.grainMag[i];
    regime[i] = carrier.regime[i];

    // Director → world-space unit strike vector via the carrier's orthonormal tangent frame.
    const { east, north } = carrier.tangentFrameAt(i);
    const ca = Math.cos(angle), sa = Math.sin(angle);
    let sx = ca * east[0] + sa * north[0];
    let sy = ca * east[1] + sa * north[1];
    let sz = ca * east[2] + sa * north[2];
    // east/north are orthonormal so |strike| is already ~1; renormalize to wash out fp drift before
    // the HalfFloat cube pack (T7) reads these back.
    const m = Math.hypot(sx, sy, sz) || 1;
    strikeWorldX[i] = sx / m;
    strikeWorldY[i] = sy / m;
    strikeWorldZ[i] = sz / m;
  }

  return { grainAngleSmooth, grainMag, regime, strikeWorldX, strikeWorldY, strikeWorldZ };
}
