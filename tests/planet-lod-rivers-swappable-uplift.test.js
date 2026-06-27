// tests/planet-lod-rivers-swappable-uplift.test.js
// AC3 — U is a SWAPPABLE interface, built C-ready. The U field reaches the erosion/carve ONLY through
// the carrier.height single-source seam + the routed graph's accum; the routing + carve operand contain
// NO branch on the U source. A future Tier-C plate-MOTION pass that wrote the SAME carrier.height flows
// through unchanged. Proven by substituting an ALTERNATE-U writer of identical shape behind the seam and
// observing routeAndOrder -> perNodeIncision -> applyIncision run the IDENTICAL path for both.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writePlateUpliftSphere } from '../src/worldengine/base/plates.js';
import { buildIrregularSphere, routeAndOrder, computeOcean, perNodeIncision, applyIncision, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import { solveSeaLevel } from '../planet-lod-sealevel.js';

const TARGET_N = 700, LLOYD = 2;

function meshWithPos() {
  const carrier = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
  const N = carrier.N;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = carrier.verts[i][0]; pos[i * 3 + 1] = carrier.verts[i][1]; pos[i * 3 + 2] = carrier.verts[i][2]; }
  carrier.pos = pos;   // perNodeIncision reads mesh.pos; routeAndOrder reads mesh.verts
  return carrier;
}

// run the IDENTICAL downstream path (route -> incise -> apply) on whatever carrier.height holds.
function routeAndCarve(carrier) {
  const N = carrier.N;
  const seaLevel = solveSeaLevel(carrier.height, 0.35);
  const { isOcean } = computeOcean(carrier.height, seaLevel, N);
  const routed = routeAndOrder({ mesh: carrier, height: carrier.height, grad: null, isOcean });
  const incision = perNodeIncision({ mesh: carrier, routed, authored: carrier.height });
  const carved = applyIncision(carrier.height, incision);
  return { routed, incision, carved, isOcean };
}

describe('AC3 — U is a swappable interface (carrier.height + accum), no source branch downstream', () => {
  // (a) the real one-pass PLATE writer
  const plate = meshWithPos();
  writePlateUpliftSphere(plate, DEFAULT_GRAIN_DRIVERS, { macroSeed: 1 });
  const authoredPlate = Float32Array.from(plate.height);
  const rPlate = routeAndCarve(plate);

  // (b) a STUB alternate-U writer of identical shape (a different deterministic low/mid field). This
  //     stands in for ANY future U source (e.g. a Tier-C plate-MOTION pass) that writes carrier.height.
  const stub = meshWithPos();
  for (let i = 0; i < stub.N; i++) {
    const d = stub.verts[i];
    stub.height[i] = 0.3 + 0.4 * Math.sin(3.0 * d[0] + 1.7) * Math.cos(2.0 * d[1] - 0.5) + 0.2 * d[2];
  }
  const authoredStub = Float32Array.from(stub.height);
  const rStub = routeAndCarve(stub);

  it('routing + carve produce a VALID carved field for BOTH U sources via the identical path', () => {
    for (const [authored, r] of [[authoredPlate, rPlate], [authoredStub, rStub]]) {
      let finite = true, subtractive = true;
      for (let i = 0; i < authored.length; i++) {
        if (!Number.isFinite(r.carved[i])) finite = false;
        if (r.incision[i] > 1e-9) subtractive = false;            // incision <= 0 (height only drops)
        if (r.carved[i] > authored[i] + 1e-9) subtractive = false; // carved <= authored
      }
      expect(finite).toBe(true);
      expect(subtractive).toBe(true);
      // the carve actually did something on at least some channels (not a degenerate all-zero)
      let anyCarved = false; for (let i = 0; i < r.incision.length; i++) if (r.incision[i] < 0) { anyCarved = true; break; }
      expect(anyCarved).toBe(true);
    }
  });

  it('applyIncision writes a FRESH immutable array — the authored substrate is never mutated', () => {
    // authoredPlate was snapshotted BEFORE routeAndCarve; plate.height must still equal it.
    expect(Array.from(plate.height)).toEqual(Array.from(authoredPlate));
    expect(rPlate.carved).not.toBe(plate.height);   // a different array instance
  });

  it('the stub-U substitution succeeds through the UNCHANGED path == the swappability proof', () => {
    // both sources yielded a valid routed graph with accum + a valid carve, with NO source-specific code.
    expect(rPlate.routed.accum.length).toBe(plate.N);
    expect(rStub.routed.accum.length).toBe(stub.N);
  });

  it('no source-specific branch exists in routeAndOrder / the carve operand (grep guard)', () => {
    const src = readFileSync(fileURLToPath(new URL('../planet-lod-rivers.js', import.meta.url)), 'utf8');
    // isolate the two functions and assert they reference neither the plate source nor a regime discriminator.
    const slice = (name) => { const s = src.indexOf('export function ' + name); const e = src.indexOf('\nexport function ', s + 1); return src.slice(s, e < 0 ? undefined : e); };
    for (const fn of ['routeAndOrder', 'perNodeIncision', 'applyIncision']) {
      const body = slice(fn);
      expect(body).not.toMatch(/plate|archetype|isEarthlike|writePlateUplift|U source|upliftField/i);
    }
  });
});
