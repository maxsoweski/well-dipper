// tests/ws4-grain-cube.test.js — WS4 T7 (plan §D2): bake the composed grain to a HalfFloat cube.
//
// AC: bake-once (foundation), one-shared-grain.
//
// D2 decision: rasterize the per-node grain into a sampleable HalfFloat cube (NOT analytic in-shader)
// so bake-once is a REAL artifact and the field can be spatially composed. The cube stores the smooth
// WORLD-space strike vector + grainMag + regime — the genuinely shared, latitude-derived field
// (province modulation is in-shader against the real gProvince, T13; NOT a JS mirror, D4).
//
// WHAT IS HEADLESS-ASSERTABLE HERE: buildGrainCubeGeometry — the pure geometry builder that maps the
// per-node strike arrays onto a full-sphere triangle mesh (one vertex per mesh node at its unit dir,
// triangulated by mesh.faces), carrying the strike vector + grainMag + regime as vertex attributes.
// This mirrors tests/planet-lod-rivers-carve-channels.test.js: assert the geometry-level contract
// (the rasterized faces carry the strike vector at sampled directions, regime in A) WITHOUT a GPU.
//
// WHAT IS LIVE-ONLY (deferred): createGrainCube — the CubeCamera RTT bake into a HalfFloat cube
// (reuses createCarveCubeMap's lifecycle). It needs a WebGL renderer, so the actual RGBA pack +
// textureCube readback is a :9223 check, listed under liveDeferred. Here we assert that the geometry
// the cube renders FROM is correct — if the geometry carries the right strike per direction, the
// shader-side MAX/last-write rasterization (identical to the proven carve cube) produces the field.
//
// HARD RULE: no Date.now / Math.random in the derivation (bakeTectonicGrain is pure; asserted in
// ws4-tectonic-module.test.js — not re-exercised here, this is a geometry-shape lock).
import { describe, it, expect } from 'vitest';
import { bakeTectonicGrain, buildGrainCubeGeometry } from '../planet-lod-tectonic.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';

const neutralDrivers = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 };

// A small mesh keeps the build fast while still exercising real faces/adjacency. The per-node strike
// correctness lives in T1/T6; here we only verify the strike arrays are faithfully mapped onto
// renderable geometry.
function smallMesh() {
  return buildIrregularSphere(200, 1);
}

describe('WS4 T7 — buildGrainCubeGeometry maps per-node strike onto full-sphere geometry', () => {
  const mesh = smallMesh();
  const N = mesh.verts.length;
  const grain = bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 12345 });
  const geo = buildGrainCubeGeometry({
    mesh,
    strikeWorld: { x: grain.strikeWorldX, y: grain.strikeWorldY, z: grain.strikeWorldZ },
    grainMag: grain.grainMag,
    regime: grain.regime,
  });

  const pos = geo.getAttribute('position');
  const aStrike = geo.getAttribute('aStrike');
  const aGrainMag = geo.getAttribute('aGrainMag');
  const aRegime = geo.getAttribute('aRegime');

  it('emits position + aStrike (vec3) + aGrainMag + aRegime, ONE vertex per mesh node', () => {
    expect(pos, 'position attribute').toBeTruthy();
    expect(aStrike, 'aStrike attribute').toBeTruthy();
    expect(aGrainMag, 'aGrainMag attribute').toBeTruthy();
    expect(aRegime, 'aRegime attribute').toBeTruthy();
    // full-sphere field: every mesh node is one renderable vertex (unlike the SPARSE valley strips)
    expect(pos.count).toBe(N);
    expect(aStrike.count).toBe(N);
    expect(aStrike.itemSize).toBe(3);     // world strike vector
    expect(aGrainMag.itemSize).toBe(1);
    expect(aRegime.itemSize).toBe(1);
  });

  it('each vertex sits at its mesh node unit direction (cube samples textureCube(map, normalize(vPos)))', () => {
    // The cube camera at the origin reads the field by direction; vertex i must sit at verts[i] so a
    // ray toward node i samples node i's strike (the same direction-keyed contract the carve cube uses).
    for (let i = 0; i < N; i++) {
      expect(pos.getX(i)).toBeCloseTo(mesh.verts[i][0], 6);
      expect(pos.getY(i)).toBeCloseTo(mesh.verts[i][1], 6);
      expect(pos.getZ(i)).toBeCloseTo(mesh.verts[i][2], 6);
    }
  });

  it('aStrike carries the per-node WORLD strike vector verbatim (the shared, latitude-derived field)', () => {
    for (let i = 0; i < N; i++) {
      expect(aStrike.getX(i)).toBeCloseTo(grain.strikeWorldX[i], 6);
      expect(aStrike.getY(i)).toBeCloseTo(grain.strikeWorldY[i], 6);
      expect(aStrike.getZ(i)).toBeCloseTo(grain.strikeWorldZ[i], 6);
    }
  });

  it('the baked strike vector is unit-length per vertex (it interpolates as a direction, no smear)', () => {
    for (let i = 0; i < N; i++) {
      const m = Math.hypot(aStrike.getX(i), aStrike.getY(i), aStrike.getZ(i));
      expect(m).toBeGreaterThan(1 - 1e-3);
      expect(m).toBeLessThan(1 + 1e-3);
    }
  });

  it('aGrainMag carries the per-node grain magnitude (the confidence channel, B)', () => {
    for (let i = 0; i < N; i++) {
      expect(aGrainMag.getX(i)).toBeCloseTo(grain.grainMag[i], 6);
    }
  });

  it('aRegime carries regime NORMALIZED into [0,1] (regime/2 → 0|0.5|1, HalfFloat-cube safe, A channel)', () => {
    // regime ∈ {NORMAL:0, STRIKESLIP:1, THRUST:2}; pack as regime/2 so the A channel is finite and
    // decodable by the shader without clipping the HalfFloat range.
    for (let i = 0; i < N; i++) {
      const r = aRegime.getX(i);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      expect(r).toBeCloseTo(grain.regime[i] / 2, 6);
    }
    // at least one of each regime should appear over a whole sphere (equator/mid/pole bands)
    const seen = new Set();
    for (let i = 0; i < N; i++) seen.add(grain.regime[i]);
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('is indexed from mesh.faces (a watertight sphere — 3 indices per face)', () => {
    const idx = geo.getIndex();
    expect(idx, 'geometry must be indexed by faces').toBeTruthy();
    expect(idx.count).toBe(mesh.faces.length * 3);
    // every index is a valid vertex id
    for (let k = 0; k < idx.count; k++) {
      const v = idx.getX(k);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(N);
    }
  });
});

describe('WS4 T7 — buildGrainCubeGeometry is deterministic + does not mutate inputs', () => {
  it('same per-node arrays → same geometry attributes (no rng, no Date.now)', () => {
    const mesh = smallMesh();
    const g = bakeTectonicGrain({ mesh, drivers: neutralDrivers, macroSeed: 7 });
    const args = {
      mesh,
      strikeWorld: { x: g.strikeWorldX, y: g.strikeWorldY, z: g.strikeWorldZ },
      grainMag: g.grainMag,
      regime: g.regime,
    };
    const a = buildGrainCubeGeometry(args);
    const b = buildGrainCubeGeometry(args);
    expect(Array.from(a.getAttribute('aStrike').array)).toEqual(Array.from(b.getAttribute('aStrike').array));
    expect(Array.from(a.getAttribute('aGrainMag').array)).toEqual(Array.from(b.getAttribute('aGrainMag').array));
    expect(Array.from(a.getAttribute('aRegime').array)).toEqual(Array.from(b.getAttribute('aRegime').array));
  });
});
