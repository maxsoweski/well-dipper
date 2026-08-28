// tests/relief-height-cube.test.js
// WS world-engine-baked-relief-render-2026-06-25 — Phase B verification (plan §B.6).
//
// AC1 carrier half + AC4 cube half: the sphere-native E6 height field (writeHeightSphere) is
// materialized into a direction-keyed, seam-free, WATERTIGHT height cube reusing the proven grain-cube
// machinery, baked once per route. The cube RENDER needs a GPU (can't run in vitest — Map 04 §7.3),
// so this guards the PURE geometry + the DATA-field continuity + the bake-host WIRING, not the GPU
// render. The live GPU readback is a :9223 check (Phase C/E).
//
// Modeled on tests/ws4-grain-cube.test.js (geometry shape) + tests/ws4-grain-bake-host.test.js
// (wiring source-scan) + tests/worldengine-base-sphere.test.js (Lipschitz seam continuity).
//
// ⚠ SPLIT-TRAP #3 (plan §B.5): the bake source MUST be carrier.height (generated E6 DATA), NEVER the
// in-shader sampler.read()/r.height (the noised() readback). Assertion (4) greps the route() call args.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';
import {
  buildHeightCubeGeometry, RELIEF_CUBE_SIZE,
} from '../planet-lod-tectonic.js';
import { buildIrregularSphere, computeAdjGradient } from '../planet-lod-rivers.js';

const TARGET_N = 600, LLOYD = 2;
const drivers = { despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0, surfaceGravity: 1, rockyCrust: 1 };
const SEED = 'e6:0';
const EPOCH = { name: 'tectonic-build' };

// The DOCUMENTED bound band (AC1, mirrors worldengine-base-height-sphere.test.js): per-epoch E6 ≈
// [-0.75,+1.5] normalized units, Jacobi (a convex combination) cannot expand it. Generous guard.
const BOUND = 4;

function buildCarrier() {
  const mesh = buildIrregularSphere(TARGET_N, LLOYD);
  const c = makeSphereField(mesh);
  writeGrainSphere(c, drivers);
  writeHeightSphere(c, {}, drivers, EPOCH, SEED);
  return { mesh, c };
}

// arc length (radians) between two unit dirs from their chord (used by the Lipschitz seam checks)
function arcOf(di, dj) {
  const chord = Math.hypot(di[0] - dj[0], di[1] - dj[1], di[2] - dj[2]);
  return 2 * Math.asin(Math.min(1, chord / 2));
}

describe('relief height cube — (1) buildHeightCubeGeometry is watertight + carries aHeight/aGrad', () => {
  const { mesh, c } = buildCarrier();
  const N = mesh.verts.length;
  const grad = computeAdjGradient(c);
  const geo = buildHeightCubeGeometry({ mesh, height: c.height, grad });

  const pos = geo.getAttribute('position');
  const aHeight = geo.getAttribute('aHeight');
  const aGrad = geo.getAttribute('aGrad');

  it('emits position + aHeight (float) + aGrad (vec3), ONE vertex per mesh node', () => {
    expect(pos).toBeTruthy();
    expect(aHeight).toBeTruthy();
    expect(aGrad).toBeTruthy();
    expect(pos.count).toBe(N);                 // vertex count == N
    expect(aHeight.count).toBe(N);             // aHeight len == N
    expect(aHeight.itemSize).toBe(1);
    expect(aGrad.itemSize).toBe(3);
  });

  it('each vertex sits at its mesh node unit direction (direction-keyed cube sample)', () => {
    for (let i = 0; i < N; i++) {
      expect(pos.getX(i)).toBeCloseTo(mesh.verts[i][0], 6);
      expect(pos.getY(i)).toBeCloseTo(mesh.verts[i][1], 6);
      expect(pos.getZ(i)).toBeCloseTo(mesh.verts[i][2], 6);
    }
  });

  it('aHeight carries the per-node carrier.height verbatim (the generated DATA field)', () => {
    for (let i = 0; i < N; i++) expect(aHeight.getX(i)).toBeCloseTo(c.height[i], 6);
  });

  it('is indexed from mesh.faces (watertight sphere — index count == faces*3, every index in [0,N))', () => {
    const idx = geo.getIndex();
    expect(idx).toBeTruthy();
    expect(idx.count).toBe(mesh.faces.length * 3);     // index count == faces*3
    for (let k = 0; k < idx.count; k++) {
      const v = idx.getX(k);
      expect(v).toBeGreaterThanOrEqual(0);             // indices in range
      expect(v).toBeLessThan(N);
    }
  });

  it('the gradient channel is finite (shading-only; degenerate neighbours guarded to 0)', () => {
    for (let k = 0; k < N * 3; k++) expect(Number.isFinite(aGrad.array[k])).toBe(true);
  });
});

describe('relief height cube — (2) seam continuity of the DATA field (AC4 headless half)', () => {
  const { c } = buildCarrier();

  it('the height field is Lipschitz-continuous across every adjacency edge (no seam crept in)', () => {
    // The field is a PURE function of carrier.verts[i] (writeHeightSphere samples 3D simplex on the
    // unit direction — seam-free domain, A.3). So neighbouring nodes' height delta is bounded by the
    // field's slope × arc. Failure ⇒ a seam crept into the noise domain (SPLIT-TRAP #1 regression).
    let maxRatio = 0;
    for (let i = 0; i < c.N; i++) {
      for (const j of c.adj[i]) {
        const arc = arcOf(c.verts[i], c.verts[j]);
        if (arc > 1e-9) maxRatio = Math.max(maxRatio, Math.abs(c.height[i] - c.height[j]) / arc);
      }
    }
    // The relief slope is bounded; a seam would spike this to many×. Generous bound on the small mesh.
    expect(Number.isFinite(maxRatio)).toBe(true);
    expect(maxRatio).toBeLessThan(BOUND);
  });

  it('same-direction agreement: two nodes at near-identical directions ⇒ near-identical height', () => {
    // Scan for the closest pair of nodes anywhere on the sphere (incl. across the antimeridian and at
    // the poles, where an equirect seam WOULD live). Pure-function continuity ⇒ their heights agree.
    let bestArc = Infinity, bestDelta = 0;
    const N = c.N;
    for (let i = 0; i < N; i++) {
      for (const j of c.adj[i]) {
        if (j <= i) continue;
        const arc = arcOf(c.verts[i], c.verts[j]);
        if (arc < bestArc) { bestArc = arc; bestDelta = Math.abs(c.height[i] - c.height[j]); }
      }
    }
    // for the closest neighbour pair, the height delta must be small (continuous field)
    expect(bestDelta).toBeLessThan(0.5);
  });

  it('the whole field is finite and bounded (AC1 carrier half on the cube source)', () => {
    for (let i = 0; i < c.N; i++) {
      expect(Number.isFinite(c.height[i])).toBe(true);
      expect(Math.abs(c.height[i])).toBeLessThan(BOUND);
    }
  });
});

describe('relief height cube — (3) pole-cap is finite / bounded / continuous (no pinch)', () => {
  const { c } = buildCarrier();
  // the polesAndLakes cap is |y| >= 0.92 (Map 04 §6)
  const CAP = 0.92;

  it('north + south polar caps have finite, bounded, smoothly-varying height', () => {
    let north = 0, south = 0, maxCapRatio = 0;
    for (let i = 0; i < c.N; i++) {
      const y = c.verts[i][1];
      if (y >= CAP) north++;
      if (y <= -CAP) south++;
      if (Math.abs(y) >= CAP) {
        expect(Number.isFinite(c.height[i])).toBe(true);
        expect(Math.abs(c.height[i])).toBeLessThan(BOUND);
        // neighbour deltas within/near the cap stay bounded (no pinch/spike at the pole)
        for (const j of c.adj[i]) {
          const arc = arcOf(c.verts[i], c.verts[j]);
          if (arc > 1e-9) maxCapRatio = Math.max(maxCapRatio, Math.abs(c.height[i] - c.height[j]) / arc);
        }
      }
    }
    expect(north, 'north cap should contain nodes').toBeGreaterThan(0);
    expect(south, 'south cap should contain nodes').toBeGreaterThan(0);
    expect(maxCapRatio).toBeLessThan(BOUND);
  });
});

describe('relief height cube — (4) bake-host wiring source-scan (planet-lod-rivers.js)', () => {
  const riversSrc = readFileSync(fileURLToPath(new URL('../planet-lod-rivers.js', import.meta.url)), 'utf8');
  // ⭐ ADDED 2026-08-28: writeBodyRelief moved to src/worldengine/dispatch/bodyRelief.js, taking the
  // `writeGrainSphere(carrier, …)` call with it (it lives in the dispatch's despun() closure). The bake
  // call site itself stayed in rivers.js's route(), so this scan now legitimately spans two files —
  // one assertion per file, each still reading its own subject. ⛔ Not a widening: the grain-before-height
  // clause below is asserted on the dispatch source ONLY, so it cannot be satisfied by an unrelated
  // match somewhere in rivers.js's 1500 lines.
  const dispatchSrc = readFileSync(fileURLToPath(new URL('../src/worldengine/dispatch/bodyRelief.js', import.meta.url)), 'utf8');

  it('imports the height writer + cube fns + carrier builder', () => {
    expect(riversSrc).toMatch(/import\s*\{[^}]*\bwriteHeightSphere\b[^}]*\}\s*from\s*['"]\.\/src\/worldengine\/base\/tectonic\.js['"]/);
    expect(riversSrc).toMatch(/import\s*\{[^}]*\bmakeSphereField\b[^}]*\}\s*from\s*['"]\.\/src\/worldengine\/base\/sphereField\.js['"]/);
    expect(riversSrc).toMatch(/import\s*\{[^}]*\bcreateHeightCube\b[^}]*\}\s*from\s*['"]\.\/planet-lod-tectonic\.js['"]/);
    expect(riversSrc).toMatch(/import\s*\{[^}]*\bbuildHeightCubeGeometry\b[^}]*\}\s*from\s*['"]\.\/planet-lod-tectonic\.js['"]/);
    expect(riversSrc).toMatch(/import\s*\{[^}]*\bbakeHeightCube\b[^}]*\}\s*from\s*['"]\.\/planet-lod-tectonic\.js['"]/);
  });

  it('creates the height cube in ensureMesh() and exposes reliefTexture/reliefBakeCount getters', () => {
    expect(riversSrc).toMatch(/heightCube\s*=\s*createHeightCube\(/);
    expect(riversSrc).toMatch(/get\s+reliefTexture\s*\(\s*\)/);
    expect(riversSrc).toMatch(/get\s+reliefBakeCount\s*\(\s*\)/);
  });

  it('calls bakeHeightCube inside route() and increments heightBakeCount', () => {
    expect(riversSrc).toMatch(/bakeHeightCube\(\s*\{/);
    expect(riversSrc).toMatch(/heightBakeCount\+\+/);
  });

  it('⚠ SPLIT-TRAP #3: bakeHeightCube is fed marginHeight (DATA), NOT sampler.read()/r.height', () => {
    // V2-4 slice-3: the bake takes `marginHeight` (= composited || carrier.height — carrier.height + the own
    // shelfDepth channel, carrier.height never mutated) as its height source — generated DATA, not the RTT.
    expect(riversSrc).toMatch(/bakeHeightCube\(\s*\{[^}]*height\s*:\s*marginHeight/);
    // and must NOT feed the in-shader RTT readback (r.height / sampler.read()) into the bake
    const bakeCall = riversSrc.match(/bakeHeightCube\(\s*\{[^}]*\}\s*\)/);
    expect(bakeCall, 'bakeHeightCube call site present').toBeTruthy();
    // \br\.height\b would also match the tail of "carrier.height"; require a NON-word char (or start)
    // before the bare `r` so only the standalone sampler readback `r.height` is caught.
    expect(bakeCall[0]).not.toMatch(/(^|[^A-Za-z0-9_])r\.height\b/);
    expect(bakeCall[0]).not.toMatch(/sampler\.read/);
    // the carrier feeding the bake comes from writeHeightSphere (generated DATA), grain written first.
    // RE-POINTED 2026-08-28 → the dispatch file, which is where that ordering now lives.
    expect(dispatchSrc).toMatch(/writeGrainSphere\(\s*carrier\s*,/);
    expect(dispatchSrc).toMatch(/writeHeightSphere\(\s*carrier\s*,/);   // RE-POINTED 2026-08-28 with its sibling above
  });
});

describe('relief height cube — (5) no-RNG static guard on the new tectonic + rivers code', () => {
  it('the new HEIGHT cube functions in planet-lod-tectonic.js use no Math.random / Date.now', () => {
    const src = readFileSync(fileURLToPath(new URL('../planet-lod-tectonic.js', import.meta.url)), 'utf8');
    const i0 = src.indexOf('export const RELIEF_CUBE_SIZE');
    expect(i0).toBeGreaterThan(-1);
    const block = src.slice(i0);                 // the entire baked-relief section
    expect(block).not.toMatch(/Math\.random/);
    expect(block).not.toMatch(/Date\.now/);
  });

  it('computeAdjGradient (planet-lod-rivers.js) uses no Math.random / Date.now', () => {
    const src = readFileSync(fileURLToPath(new URL('../planet-lod-rivers.js', import.meta.url)), 'utf8');
    const i0 = src.indexOf('export function computeAdjGradient');
    const i1 = src.indexOf('\n}', i0);
    expect(i0).toBeGreaterThan(-1);
    const block = src.slice(i0, i1 + 2);
    expect(block).not.toMatch(/Math\.random/);
    expect(block).not.toMatch(/Date\.now/);
  });

  it('computeAdjGradient is deterministic + finite over a built carrier', () => {
    const { c } = buildCarrier();
    const a = computeAdjGradient(c);
    const b = computeAdjGradient(c);
    expect(Array.from(a)).toEqual(Array.from(b));   // byte-identical
    for (let k = 0; k < a.length; k++) expect(Number.isFinite(a[k])).toBe(true);
  });
});
