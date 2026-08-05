// tests/ws4-grain-bake-host.test.js — WS4 T8 (plan §D2/§D8/§D9): the BAKE HOST.
//
// AC: bake-once (integration, live) — headless-assertable slice here; the once-per-route GPU bake +
// the uTectonicGrainCube uniform push are LIVE on :9223 (listed under liveDeferred).
//
// WHAT T8 ADDS: a host that calls bakeTectonicGrain + the grain-cube update() ONCE per body inside
// createRiverOverlay.route() (so it rides the existing route() debounce — once per (preset,seed,sea),
// not per-frame), pushes uTectonicGrainCube, and reads macroSeed from the uMacroOffset scope.
//
// WHAT IS HEADLESS-ASSERTABLE (this file): bakeGrainCube — the pure orchestration helper the route()
// host calls. It (1) derives the per-node grain (bakeTectonicGrain — pure, no GPU), (2) builds the
// cube geometry (buildGrainCubeGeometry — pure), (3) hands the geometry to the cube's update() EXACTLY
// once, and (4) returns the strike arrays so the host can probe them. We inject a FAKE cube object
// ({ update: spy }) so the bake decision/counting is proven WITHOUT a WebGL renderer. This is the
// once-per-call contract bake-once rests on; the real CubeCamera RTT + the route() wiring + the
// uniform push are the :9223 deferred checks.
//
// WHY a helper, not a full route() test: createRiverOverlay.ensureMesh() builds a real
// createHeightSampler + createCarveCubeMap, which want a WebGL RTT.
// ⚠ CORRECTED 2026-08-05: this comment used to end "...so route() cannot run headless." THAT IS
// FALSE, and the sentence cost a session: it is why the layer-4 bake probe was budgeted at a day.
// route() touches no DOM and no canvas — its only GPU coupling is renderer.render /
// readRenderTargetPixels, and a no-op renderer stub runs the whole bakedOn=true path in node
// (measured: first route ~1.0-1.3 s, mesh-dominated; steady state ~105-190 ms). What genuinely
// does NOT run headless is the uReliefBakeStrength == 0 fallback, because createHeightSampler.read()
// calls renderer.clear() (planet-lod-rivers.js:588) and then reads pixels back.
// Numbers + the per-instance cold-start finding: docs/FEATURES/lab-pipeline-into-game-PLAN.md LAYER 4.
// Extracting bakeGrainCube gives the bake logic a clean, GPU-free seam to lock in CI; the integration
// (it is CALLED once per route, and its texture is pushed to uTectonicGrainCube) is the live AC.
//
// HARD RULE: no Date.now / Math.random in the derivation (bakeTectonicGrain/macroSeedRotateDeg are
// pure — asserted in ws4-tectonic-module; here we additionally assert bakeGrainCube adds no entropy).
import { describe, it, expect, vi } from 'vitest';
import { bakeGrainCube, buildIrregularSphere } from '../planet-lod-rivers.js';

const neutralDrivers = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 };

function smallMesh() {
  const mesh = buildIrregularSphere(200, 1);
  // Replicate ensureMesh's hydration (D8): bakeTectonicGrain reads mesh.verts (present), but downstream
  // host code shares the hydrated mesh; hydrate here so the helper sees the same shape route() passes.
  const N = mesh.verts.length;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = mesh.verts[i][0]; pos[i * 3 + 1] = mesh.verts[i][1]; pos[i * 3 + 2] = mesh.verts[i][2]; }
  mesh.pos = pos; mesh.N = N;
  return mesh;
}

describe('WS4 T8 — bakeGrainCube orchestrates derive → build geometry → update() once', () => {
  it('is exported as a function', () => {
    expect(typeof bakeGrainCube).toBe('function');
  });

  it('calls the grain cube update() EXACTLY once per invocation, with a BufferGeometry', () => {
    const mesh = smallMesh();
    const grainCube = { update: vi.fn() };
    bakeGrainCube({ mesh, drivers: neutralDrivers, macroSeed: 42, grainCube });
    expect(grainCube.update).toHaveBeenCalledTimes(1);
    const geo = grainCube.update.mock.calls[0][0];
    // the geometry the cube renders FROM (the proven T7 builder output): position + aStrike present.
    expect(geo).toBeTruthy();
    expect(geo.getAttribute('position')).toBeTruthy();
    expect(geo.getAttribute('aStrike')).toBeTruthy();
    expect(geo.getAttribute('position').count).toBe(mesh.verts.length);
  });

  it('returns the per-node strike arrays (so the host/probe can read the shared field)', () => {
    const mesh = smallMesh();
    const grainCube = { update: vi.fn() };
    const out = bakeGrainCube({ mesh, drivers: neutralDrivers, macroSeed: 42, grainCube });
    const N = mesh.verts.length;
    expect(out.strikeWorldX.length).toBe(N);
    expect(out.strikeWorldY.length).toBe(N);
    expect(out.strikeWorldZ.length).toBe(N);
    expect(out.grainMag.length).toBe(N);
    expect(out.regime.length).toBe(N);
    // strike is a unit direction per node (interpolates as a direction in the cube — no smear)
    for (let i = 0; i < N; i++) {
      const m = Math.hypot(out.strikeWorldX[i], out.strikeWorldY[i], out.strikeWorldZ[i]);
      expect(m).toBeGreaterThan(1 - 1e-3);
      expect(m).toBeLessThan(1 + 1e-3);
    }
  });

  it('consumes macroSeed (D9): different seeds → different baked strike fields', () => {
    const mesh = smallMesh();
    const a = bakeGrainCube({ mesh, drivers: neutralDrivers, macroSeed: 1, grainCube: { update: vi.fn() } });
    const b = bakeGrainCube({ mesh, drivers: neutralDrivers, macroSeed: 999, grainCube: { update: vi.fn() } });
    // macroSeedRotateDeg shifts the latitude band placement → the strike vectors must differ for at
    // least some nodes (inter-body variety, plan §D9). A pure seed-equality would mean the seed is
    // ignored (the bug this asserts against).
    let anyDiff = false;
    for (let i = 0; i < mesh.verts.length; i++) {
      if (Math.abs(a.strikeWorldX[i] - b.strikeWorldX[i]) > 1e-5 ||
          Math.abs(a.strikeWorldY[i] - b.strikeWorldY[i]) > 1e-5 ||
          Math.abs(a.strikeWorldZ[i] - b.strikeWorldZ[i]) > 1e-5) { anyDiff = true; break; }
    }
    expect(anyDiff, 'different macroSeed must change the baked strike field (seed is consumed)').toBe(true);
  });

  it('is deterministic + adds no entropy (same mesh/drivers/seed → byte-identical strike arrays)', () => {
    const mesh = smallMesh();
    const a = bakeGrainCube({ mesh, drivers: neutralDrivers, macroSeed: 7, grainCube: { update: vi.fn() } });
    const b = bakeGrainCube({ mesh, drivers: neutralDrivers, macroSeed: 7, grainCube: { update: vi.fn() } });
    expect(Array.from(a.strikeWorldX)).toEqual(Array.from(b.strikeWorldX));
    expect(Array.from(a.strikeWorldY)).toEqual(Array.from(b.strikeWorldY));
    expect(Array.from(a.strikeWorldZ)).toEqual(Array.from(b.strikeWorldZ));
    expect(Array.from(a.regime)).toEqual(Array.from(b.regime));
  });

  it('no-op-safe: a null grainCube does NOT throw (the host may bake before the cube exists)', () => {
    const mesh = smallMesh();
    expect(() => bakeGrainCube({ mesh, drivers: neutralDrivers, macroSeed: 3, grainCube: null })).not.toThrow();
  });

  it('uses default neutral drivers when none are passed (host supplies a sensible E6 default)', () => {
    const mesh = smallMesh();
    const grainCube = { update: vi.fn() };
    const out = bakeGrainCube({ mesh, macroSeed: 5, grainCube });
    expect(grainCube.update).toHaveBeenCalledTimes(1);
    expect(out.strikeWorldX.length).toBe(mesh.verts.length);
  });
});
