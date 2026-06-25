// ws4-epoch.test.js — WS4 T11, AC `epoch-build-identical` (unit).
//
// PRECISE CLAIM (plan §T11, critic test-validity medium — do NOT over-read the green): this unit proves a
// NARROW property — the JS carve apply pass operates on an IMMUTABLE COPY of the build snapshot, so:
//   (1) epoch 1 (the E6 build = `authored`, the routed substrate / ROUTER_MAIN field) is byte-identical
//       before/after the carve pass — the apply step does NOT mutate `authored` in place;
//   (2) epoch 2 (the E9 carve) only LOWERS height — `carved[i] - authored[i] ≤ 0 ∀i` (monotone
//       non-increasing), the contract's "epoch-2 height delta ≤ 0 at every vertex".
//
// It does NOT prove the RENDERED epoch-1 is identical with carve toggled — that is the LIVE AC's job (T12,
// `epoch-carve-visible`). Per plan §D5c, `heightAfterBuild` for THIS unit IS the routed-substrate
// `authored` field (the ROUTER_MAIN readback the router already takes), NOT a rendered-chain snapshot
// (which would need shader surgery — T12b, DEFERRED, not built in WS4).
//
// The apply step under test is `applyIncision(authored, incision) → carved` (a fresh Float32Array): the
// SINGLE place the per-node carve depth (`perNodeIncision`, T9/T10) is folded onto the build snapshot.
// Keeping it a pure helper that reads `authored` and WRITES A FRESH ARRAY is exactly the immutability
// property this AC binds to — `buildValleyGeometry`'s aDepth + the carve cube R channel derive from the
// SAME `-incision[i]`, so unit + rendered share one source (plan §D5/T9), and epoch 1 survives untouched.
//
// MESH HYDRATION IS MANDATORY (plan §D8): `buildIrregularSphere` returns `{ verts, faces, adj }` with NO
// `pos`, NO `N`. The live path bridges this in `ensureMesh`. The harness MUST replicate it BEFORE calling
// `routeAndOrder`/`perNodeIncision` or they read `undefined.length` and throw (a HARNESS bug masquerading
// as RED). `hydrateMesh` below factors that out (kept local — mirrors ws4-carve-subtractive.test.js).
import { describe, it, expect } from 'vitest';
import {
  buildIrregularSphere, routeAndOrder, perNodeIncision, applyIncision, DEFAULT_PARAMS,
} from '../planet-lod-rivers.js';

// Replicate ensureMesh's hydration: flat Float32 mesh.pos + mesh.N from mesh.verts.
function hydrateMesh(mesh) {
  const N = mesh.verts.length;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = mesh.verts[i][0];
    pos[i * 3 + 1] = mesh.verts[i][1];
    pos[i * 3 + 2] = mesh.verts[i][2];
  }
  mesh.pos = pos;
  mesh.N = N;
  return mesh;
}

// A smooth, bumpy, DETERMINISTIC height field (no rng) — low-freq sinusoids over the unit-direction
// components give real ridges + basins so the router produces a non-trivial drainage graph (channels,
// Strahler orders > 1) that the carve has something to actually cut.
function syntheticField(mesh) {
  const N = mesh.N;
  const height = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = mesh.pos[i * 3], y = mesh.pos[i * 3 + 1], z = mesh.pos[i * 3 + 2];
    const h =
      0.55 * Math.sin(3.0 * x + 1.3) * Math.cos(2.0 * y - 0.7) +
      0.30 * Math.sin(5.0 * z + 0.4) +
      0.20 * Math.cos(4.0 * x - 2.0 * z) +
      0.15 * Math.sin(7.0 * y + 1.1) * Math.sin(6.0 * x);
    height[i] = h;
  }
  return height;
}

// Ocean mask: the lowest ~frac of the height field, so every basin has a guaranteed sink.
function oceanMaskByFraction(height, frac) {
  const N = height.length;
  const sorted = Float32Array.from(height).sort();
  const thr = sorted[Math.floor(frac * N)];
  const isOcean = new Uint8Array(N);
  for (let i = 0; i < N; i++) isOcean[i] = height[i] <= thr ? 1 : 0;
  return isOcean;
}

const PARAMS = { ...DEFAULT_PARAMS, TARGET_N: 2000, LLOYD_ITERS: 2 };

function buildRouted() {
  const mesh = hydrateMesh(buildIrregularSphere(PARAMS.TARGET_N, PARAMS.LLOYD_ITERS));
  const height = syntheticField(mesh);
  const isOcean = oceanMaskByFraction(height, 0.35);
  const routed = routeAndOrder({ mesh, height, grad: null, isOcean, params: PARAMS });
  return { mesh, height, isOcean, routed };
}

describe('WS4 epoch-build-identical — the carve apply pass operates on an IMMUTABLE COPY of the build snapshot', () => {
  const { mesh, height, routed } = buildRouted();
  // epoch 1 = the E6 build snapshot (the routed substrate). Keep a pristine deep copy to compare against.
  const authored = Float32Array.from(height);
  const authoredBefore = Float32Array.from(authored); // independent byte-for-byte reference

  const incision = perNodeIncision({ mesh, routed, authored, params: PARAMS });
  const carved = applyIncision(authored, incision); // epoch 2 = build + Δ, on a FRESH array

  it('applyIncision returns a fresh Float32Array of length N (a distinct object, not the input)', () => {
    expect(carved).toBeInstanceOf(Float32Array);
    expect(carved.length).toBe(mesh.N);
    expect(carved).not.toBe(authored); // a different array instance — no aliasing of the build snapshot
  });

  it('epoch 1 is byte-identical before/after the carve pass — authored is NOT mutated in place', () => {
    // THE epoch-build-identical property: applying the carve must leave the build snapshot untouched.
    expect(authored.length).toBe(authoredBefore.length);
    for (let i = 0; i < authored.length; i++) {
      // exact byte-equality (no tolerance) — an in-place `authored[i] += incision[i]` would fail this
      expect(authored[i]).toBe(authoredBefore[i]);
    }
  });

  it('epoch 2 only lowers height: (carved[i] - authored[i]) ≤ 0 ∀i (monotone non-increasing)', () => {
    for (let i = 0; i < carved.length; i++) {
      // carved = authored + Δ, Δ ≤ 0 ⇒ carved ≤ authored at every vertex (the contract's epoch-2 delta)
      expect(carved[i] - authored[i]).toBeLessThanOrEqual(1e-9);
    }
  });

  it('the carve is EXACTLY authored + Δ folded into the fresh array (no extra term, no re-raising clamp)', () => {
    // The apply step is EXACTLY authored + Δ — no extra term, no clamp that could re-raise height. This
    // pins applyIncision as the single fold of perNodeIncision onto the snapshot (no hidden mutation).
    // Compare against the float32 round-trip of (authored + incision): carved lives in a Float32Array, so
    // the stored value is `Math.fround(authored[i] + incision[i])`. Asserting the raw double-subtraction
    // `=== incision[i]` would falsely fail on float32 quantization (a storage artifact, not a logic bug).
    for (let i = 0; i < carved.length; i++) {
      expect(carved[i]).toBe(Math.fround(authored[i] + incision[i]));
    }
  });

  it('carve actually changed SOME vertices (the snapshot-immutability proof is non-vacuous)', () => {
    // If incision were all-zero the "no mutation" + "≤0" asserts would pass vacuously. Require real cuts.
    let changed = 0;
    for (let i = 0; i < carved.length; i++) if (carved[i] !== authored[i]) changed++;
    expect(changed).toBeGreaterThan(0);
  });

  it('is deterministic — same (authored, incision) → byte-identical carved on re-run (no rng/Date.now)', () => {
    const again = applyIncision(authored, incision);
    expect(again.length).toBe(carved.length);
    for (let i = 0; i < carved.length; i++) expect(again[i]).toBe(carved[i]);
    // and STILL no mutation of authored on the second apply
    for (let i = 0; i < authored.length; i++) expect(authored[i]).toBe(authoredBefore[i]);
  });
});
