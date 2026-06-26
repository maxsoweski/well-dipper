// relief-router-baked-drainage.test.js — Phase D / AC3 (headless drainage-on-the-baked-field).
//
// WHAT THIS PROVES (BUILD-PLAN §D.6(a)): the river router routes correctly on the SAME baked height
// field the renderer displaces from. It builds the mesh, builds a carrier, runs the REAL sphere-native
// E6 writers (writeGrainSphere → writeHeightSphere) to fill carrier.height — the IDENTICAL DATA the
// Phase-D re-point feeds the router (height[i] = carrier.height[i]) and the IDENTICAL DATA Phase B bakes
// into the height cube the renderer reads. Then it derives the ocean mask via the production sea solve
// (solveSeaLevel / computeOcean) and runs the REAL pure routeAndOrder on that field.
//
// This is the single-source proof at the data layer: drainage descends the baked relief, trunks reach
// the sea, the network concentrates into channels, ocean lands ~35%, Strahler order is in band. It is
// the headless half of AC3 ("router routes on the SAME baked height field; single source, no surface-
// vs-rivers split"); the live :9223 read of window._rivers.stats is the integration half (§D.6(c)).
//
// Modelled on tests/ws4-carve-subtractive.test.js:79 / ws4-epoch.test.js — which run the REAL pure
// routeAndOrder on a hand-built field — but the field here is the ACTUAL baked carrier, not a synthetic
// sinusoid. Determinism: no Math.random / no Date.now; the writers seed off the integer macroSeed only.
//
// MESH HYDRATION (plan §D8): buildIrregularSphere returns { verts, faces, adj } with NO pos / NO N.
// routeAndOrder needs both — the live path bridges this in ensureMesh (rivers.js). The harness MUST
// replicate it before routing, or routeAndOrder reads undefined.length (a HARNESS bug, not a RED).
import { describe, it, expect } from 'vitest';
import {
  buildIrregularSphere, routeAndOrder, computeOcean, computeAdjGradient,
  DEFAULT_PARAMS, DEFAULT_GRAIN_DRIVERS,
} from '../planet-lod-rivers.js';
import { solveSeaLevel } from '../planet-lod-sealevel.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';

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

// A real but small mesh: big enough for multi-order drainage on the baked field, small enough to keep
// the E6 writers + ConvexHull adjacency fast in CI. The same field/seed every run (no rng).
const PARAMS = { ...DEFAULT_PARAMS, TARGET_N: 3000, LLOYD_ITERS: 2 };
const MACRO_SEED = 1234;

// Build the SAME source the Phase-D re-point uses: carrier.height from the real sphere-native E6 writers.
function buildBakedField() {
  const mesh = hydrateMesh(buildIrregularSphere(PARAMS.TARGET_N, PARAMS.LLOYD_ITERS));
  const carrier = makeSphereField(mesh);
  // SAME call order + args as route() under bakedOn (rivers.js): grain BEFORE height; heightSeed off the
  // integer macroSeed only; crust is an inert {} (writeHeightSphere derives its own thickness blob).
  writeGrainSphere(carrier, DEFAULT_GRAIN_DRIVERS);
  writeHeightSphere(carrier, {}, DEFAULT_GRAIN_DRIVERS, { name: 'tectonic-build' }, 'e6:' + (MACRO_SEED | 0));
  const grad = computeAdjGradient(carrier);
  // height[i] = carrier.height[i] — the EXACT Phase-D re-point (the array the cube is baked from).
  const height = carrier.height;
  // Production sea solve to the AC3 ~35% target, then the production ocean mask.
  const seaLevel = solveSeaLevel(height, PARAMS.TARGET_OCEAN_FRACTION);
  const oc = computeOcean(height, seaLevel, mesh.N);
  const routed = routeAndOrder({ mesh, height, grad, isOcean: oc.isOcean, params: PARAMS });
  return { mesh, carrier, height, grad, seaLevel, oc, routed };
}

describe('Phase D / AC3 — drainage descends the BAKED height field (carrier.height, the single source)', () => {
  const { mesh, carrier, height, seaLevel, oc, routed } = buildBakedField();

  it('the baked carrier.height field is finite + bounded (AC1 precondition for a sane sea solve)', () => {
    let min = Infinity, max = -Infinity, nan = 0;
    for (let i = 0; i < mesh.N; i++) {
      const v = carrier.height[i];
      if (!Number.isFinite(v)) nan++;
      else { if (v < min) min = v; if (v > max) max = v; }
    }
    expect(nan).toBe(0);
    expect(max).toBeGreaterThan(min); // real relief, not a constant field
  });

  it('the router height IS carrier.height (single source — same array reference, not a copy)', () => {
    // The Phase-D re-point sets height = carrier.height directly; assert we routed on that exact array.
    expect(height).toBe(carrier.height);
  });

  it('routed.uphill === 0 && routed.orphan === 0 (drainage descends the baked relief; trunks reach sea)', () => {
    expect(routed.landCount).toBeGreaterThan(0);
    expect(routed.uphill).toBe(0);
    expect(routed.orphan).toBe(0);
  });

  it('drainage concentrates: max(accum) > 5 * mean(accum) (trunks form, not scatter)', () => {
    const { accum } = routed;
    let sum = 0, max = 0;
    for (let i = 0; i < accum.length; i++) { sum += accum[i]; if (accum[i] > max) max = accum[i]; }
    const mean = sum / accum.length;
    expect(mean).toBeGreaterThan(0);
    expect(max).toBeGreaterThan(5 * mean);
  });

  it('ocean fraction lands in band [0.25, 0.45] after solveSeaLevel(height, 0.35)', () => {
    const frac = oc.oceanCount / mesh.N;
    expect(frac).toBeGreaterThanOrEqual(0.25);
    expect(frac).toBeLessThanOrEqual(0.45);
    expect(Number.isFinite(seaLevel)).toBe(true);
  });

  it('maxStrahler is in band (real multi-order trunks; ~5, allow 3..8 for the small CI mesh)', () => {
    // The live full-resolution mesh (TARGET_N=40000) reads ~5; the CI mesh (3000 nodes) lands lower but
    // must still show real multi-order drainage. Band per Map 04 §7.1, widened for the reduced node count.
    expect(routed.maxOrder).toBeGreaterThanOrEqual(3);
    expect(routed.maxOrder).toBeLessThanOrEqual(8);
  });

  it('is deterministic — re-building the SAME baked field + routing yields identical uphill/orphan/maxOrder', () => {
    const again = buildBakedField();
    expect(again.routed.uphill).toBe(routed.uphill);
    expect(again.routed.orphan).toBe(routed.orphan);
    expect(again.routed.maxOrder).toBe(routed.maxOrder);
    expect(again.oc.oceanCount).toBe(oc.oceanCount);
  });
});
