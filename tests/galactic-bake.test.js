// Galactic Engine S1 step 2 — the per-system sky bake (plan §5; AC-7, AC-9, AC-10 headless halves).
// Atlas mapping + seam continuity, bake vs live reference, star dust by distance, the bake lifecycle
// (generation tokens, hold/release, timeout) and the controller's warp gating. Each check is a named function
// that also runs on a committed broken control which must fail it.
import { describe, it, expect } from 'vitest';
import { DataUtils } from 'three';
import { GalacticMap } from '../src/generation/GalacticMap.js';
import { findCloudSubjects, observerPositionFor, approachDirection } from '../src/galactic/subjects.js';
import { featureHistory } from '../src/galactic/featureHistory.js';
import { renderPack } from '../src/galactic/renderPacks.js';
import { integrateRay, applyColourMode, luminance } from '../src/galactic/cloudFieldCPU.js';
import {
  faceDirection, texelDirection, directionToFace, texelCoord, atlasUV, atlasPixelToTexel, sampleAtlas,
  depthCDF, starTransmittance,
} from '../src/galactic/cubeAtlas.js';
import { BakeScheduler } from '../src/rendering/galactic/bakeScheduler.js';
import { GalacticController, DEFAULT_CTX, bakeHashOf } from '../src/rendering/galactic/GalacticController.js';
import { CLOUD_BAKE_FRAG, CLOUD_COMPOSITE_FRAG, CLOUD_STAR_DUST_GLSL } from '../src/galactic/shaders/cloudField.glsl.js';

const gm = new GalacticMap('well-dipper-galaxy-1');
const subjects = findCloudSubjects(gm);
const feature = subjects.procedural;
const pack = renderPack(featureHistory(feature), { overrides: {} });
const R = pack.radiusPc;
const STEPS = DEFAULT_CTX.steps;
const N = DEFAULT_CTX.bakeFaceSize;
const half = (v) => DataUtils.fromHalfFloat(DataUtils.toHalfFloat(v)); // RGBA16F storage

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ── Atlas mapping ─────────────────────────────────────────────────────────────────────────────────────────
describe('sky atlas mapping (twin of CLOUD_ATLAS_GLSL)', () => {
  it('texel → direction → texel round-trips on every face', () => {
    for (let face = 0; face < 6; face++) {
      for (const [i, j] of [[0, 0], [1, 7], [100, 300], [255, 256], [N - 1, N - 1], [N - 1, 0]]) {
        const d = texelDirection(face, i, j, N);
        const t = texelCoord(d, N);
        if (t.face === face) {
          expect(t.x).toBeCloseTo(i, 6);
          expect(t.y).toBeCloseTo(j, 6);
        } else {
          // only possible exactly on an edge, where the neighbour face holds the same ray
          expect(i === 0 || i === N - 1 || j === 0 || j === N - 1).toBe(true);
        }
      }
    }
  });
  it('atlas pixels map to the six cells (3 x 2)', () => {
    expect(atlasPixelToTexel(0, 0, N)).toEqual({ face: 0, i: 0, j: 0 });
    expect(atlasPixelToTexel(2 * N + 5, N + 9, N)).toEqual({ face: 5, i: 5, j: 9 });
    const [u, v] = atlasUV([0, 0, -1], N); // -Z = face 5, centre of its cell
    expect(u).toBeGreaterThan(2 / 3);
    expect(v).toBeGreaterThan(0.5);
  });
  it('directionToFace picks the major axis and sign', () => {
    expect(directionToFace([0.9, 0.1, -0.2]).face).toBe(0);
    expect(directionToFace([-0.1, -0.9, 0.2]).face).toBe(3);
    expect(directionToFace([0.1, 0.2, -0.9]).face).toBe(5);
  });
});

// ── Fence: cube edges and corners are continuous ──────────────────────────────────────────────────────────
// 1) Every edge texel's ray is held, identically, by the neighbouring face (edge-inclusive texel centres).
function checkEdgeRaysShared(texelDir, n) {
  let worst = 0;
  for (let face = 0; face < 6; face++) {
    for (let k = 0; k < n; k += Math.max(1, Math.floor(n / 16))) {
      for (const [i, j] of [[0, k], [n - 1, k], [k, 0], [k, n - 1]]) {
        const d = texelDir(face, i, j, n);
        // the nearest texel on any OTHER face whose square contains this ray
        let best = Infinity;
        for (let g = 0; g < 6; g++) {
          if (g === face) continue;
          const m = g >> 1, sg = g & 1 ? -1 : 1;
          if (Math.sign(d[m]) !== sg || Math.abs(d[m]) < 1e-9) continue;
          const a = d[(m + 1) % 3] / Math.abs(d[m]), b = d[(m + 2) % 3] / Math.abs(d[m]);
          if (Math.abs(a) > 1 + 1e-9 || Math.abs(b) > 1 + 1e-9) continue;
          const probe = { x: ((a + 1) / 2) * (n - 1), y: ((b + 1) / 2) * (n - 1) };
          const dd = texelDir(g, Math.round(probe.x), Math.round(probe.y), n);
          best = Math.min(best, dist(dd, d));
        }
        worst = Math.max(worst, best);
      }
    }
  }
  if (!(worst < 1e-9)) throw new Error(`edge rays not shared between faces (worst gap ${worst.toExponential(2)} rad)`);
  return worst;
}
// 2) A smooth sky stored in the atlas and read back along great circles that cross seams and pass near
//    corners has no jump at the seams (largest step <= 3x the median step).
function smoothSky(d) {
  return [0.5 + 0.5 * d[0] * d[1], 0.5 + 0.3 * Math.sin(3 * d[2]), 0.5 + 0.4 * d[0]];
}
function checkSeamContinuity(texel, n) {
  const circles = [[1, 1, 0], [1, 0, 1], [0.3, 1, 1], [1, -1, 1]].map((v) => v.map((c) => c / Math.hypot(...v)));
  for (const axis of circles) {
    const u = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = [axis[1] * u[2] - axis[2] * u[1], axis[2] * u[0] - axis[0] * u[2], axis[0] * u[1] - axis[1] * u[0]];
    const l1 = Math.hypot(...e1);
    const p = e1.map((c) => c / l1);
    const q = [axis[1] * p[2] - axis[2] * p[1], axis[2] * p[0] - axis[0] * p[2], axis[0] * p[1] - axis[1] * p[0]];
    const steps = 4000, vals = [];
    for (let s = 0; s <= steps; s++) {
      const a = (2 * Math.PI * s) / steps;
      const d = p.map((c, k) => c * Math.cos(a) + q[k] * Math.sin(a));
      vals.push(sampleAtlas(d, n, texel)[0] + sampleAtlas(d, n, texel)[2]);
    }
    const jumps = vals.slice(1).map((v, k) => Math.abs(v - vals[k]));
    const sorted = jumps.slice().sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const mx = sorted[sorted.length - 1];
    if (mx > 3 * Math.max(med, 1e-6)) throw new Error(`seam jump ${mx.toExponential(2)} > 3x median ${med.toExponential(2)}`);
  }
}
describe('fence: the bake atlas is continuous across cube edges and corners', () => {
  const n = 64;
  it('edge rays are shared by neighbouring faces', () => {
    expect(() => checkEdgeRaysShared(texelDirection, n)).not.toThrow();
  });
  it('BROKEN CONTROL: half-texel-inset centres ((i+0.5)/N) leave a gap at every edge', () => {
    const inset = (face, i, j, m) => faceDirection(face, -1 + (2 * (i + 0.5)) / m, -1 + (2 * (j + 0.5)) / m);
    expect(() => checkEdgeRaysShared(inset, n)).toThrow(/not shared/);
  });
  it('a smooth sky read back along seam-crossing great circles has no seam jumps', () => {
    expect(() => checkSeamContinuity((f, i, j) => smoothSky(texelDirection(f, i, j, n)), n)).not.toThrow();
  });
  it('BROKEN CONTROL: one face stored mirrored shows a seam jump', () => {
    const flipped = (f, i, j) => smoothSky(texelDirection(f, f === 0 ? n - 1 - i : i, j, n));
    expect(() => checkSeamContinuity(flipped, n)).toThrow(/seam jump/);
  });
});

// ── Bake vs live reference ────────────────────────────────────────────────────────────────────────────────
// The CPU twin plays the GPU: each atlas texel stores integrateRay at that texel's ray (half-float), the read is
// bilinear like the hardware; the reference marches the exact ray. Same steps and limits on both sides.
function makeBakedTexel(pk, observer, n, steps, quantize = true) {
  const cache = new Map();
  const q = quantize ? half : (v) => v;
  return (face, i, j) => {
    const key = (face * n + i) * n + j;
    let v = cache.get(key);
    if (!v) {
      const r = integrateRay(pk, observer, texelDirection(face, i, j, n), steps);
      v = [...r.L, r.tau, ...r.G].map(q);
      cache.set(key, v);
    }
    return v;
  };
}
function sampleDirections(observer, count, seed = 1) {
  // directions inside the cloud's angular footprint (all-sky when inside)
  let s = seed;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const toC = observer.map((c) => -c);
  const dc = Math.hypot(...toC);
  const out = [];
  while (out.length < count) {
    const z = rnd() * 2 - 1, ph = rnd() * 2 * Math.PI, r = Math.sqrt(1 - z * z);
    const d = [r * Math.cos(ph), r * Math.sin(ph), z];
    if (dc > R) {
      const cosA = (d[0] * toC[0] + d[1] * toC[1] + d[2] * toC[2]) / dc;
      if (cosA < Math.cos(Math.asin(R / dc))) continue;
    }
    out.push(d);
  }
  return out;
}
function bakeVsLiveErrors(pk, observer, n, dirs, steps = STEPS) {
  const texel = makeBakedTexel(pk, observer, n, steps);
  const live = dirs.map((d) => integrateRay(pk, observer, d, steps));
  const baked = dirs.map((d) => sampleAtlas(d, n, texel));
  const lumLive = live.map((r) => luminance(applyColourMode(r.L, pk)));
  const lumBake = baked.map((v) => luminance(applyColourMode(v.slice(0, 3), pk)));
  const maxY = Math.max(...lumLive, 1e-9);
  const eL = lumLive.map((y, k) => Math.abs(lumBake[k] - y) / maxY);
  const eT = live.map((r, k) => Math.max(...pk.extinction.rgb.map((e, c) => Math.abs(Math.exp(-baked[k][3] * e) - r.T[c]))));
  const stats = (e) => {
    const s = e.slice().sort((a, b) => a - b);
    return { rms: Math.sqrt(e.reduce((a, x) => a + x * x, 0) / e.length), p99: s[Math.floor(s.length * 0.99)] };
  };
  return { L: stats(eL), T: stats(eT) };
}
function checkBakeTolerance(res) {
  for (const k of ['L', 'T']) {
    if (res[k].rms > 0.01) throw new Error(`${k} RMS ${res[k].rms.toFixed(4)} > 1%`);
    if (res[k].p99 > 0.03) throw new Error(`${k} p99 ${res[k].p99.toFixed(4)} > 3%`);
  }
}
describe(`bake (${N}px faces) vs live march: RMS <= 1%, p99 <= 3%`, () => {
  const dir = approachDirection(feature);
  const poses = [
    ['100 pc', dir.map((c) => c * 100)],
    ['edge', dir.map((c) => c * R)],
    ['centre (inside)', [0, 0, 0]],
  ];
  for (const [name, obs] of poses) {
    it(name, () => {
      const res = bakeVsLiveErrors(pack, obs, N, sampleDirections(obs, 300));
      expect(() => checkBakeTolerance(res)).not.toThrow();
    });
  }
  it('BROKEN CONTROL: a 12px-face bake of the inside view fails the tolerance', () => {
    const res = bakeVsLiveErrors(pack, [0, 0, 0], 12, sampleDirections([0, 0, 0], 300));
    expect(() => checkBakeTolerance(res)).toThrow(/RMS|p99/);
  });
});

// ── Star dust by distance (AC-7 headless) ─────────────────────────────────────────────────────────────────
function checkStarDust(Tfront, Tbehind, Tfull) {
  if (Tfront.some((t) => Math.abs(t - 1) > 1 / 255)) throw new Error(`star in front changed: ${Tfront.map((t) => t.toFixed(4))}`);
  if (!(Tbehind[1] < 1 - 1 / 255)) throw new Error('star behind is not dimmed');
  if (!(Tbehind[2] / Tbehind[0] < 1)) throw new Error('star behind is not reddened (blue/red ratio not lower)');
  if (Tbehind.some((t, c) => Math.abs(t - Tfull[c]) > 1e-6)) throw new Error('star behind is not dimmed by the full column');
}
describe('stars are dimmed by the dust in front of THEM', () => {
  const obs = approachDirection(feature).map((c) => c * 100);
  const toCentre = obs.map((c) => -c / 100);
  const ray = integrateRay(pack, obs, toCentre, STEPS);
  const T = (d) => starTransmittance(toCentre, d, ray.tau, ray.G, obs, pack.boundRadiusPc, pack.extinction.rgb);
  const Tfull = ray.T;

  it('in front: unchanged; behind: dimmed by the full column and reddened', () => {
    expect(Tfull[1]).toBeLessThan(0.99); // the column has real dust
    expect(() => checkStarDust(T(50), T(2000), Tfull)).not.toThrow();
  });
  it('a star inside the cloud gets partial dust, close to an exact march to its distance (shape v1: within 0.03)', () => {
    const p1 = renderPack(featureHistory(feature), { overrides: {}, shapeVersion: 1 });
    const r1 = integrateRay(p1, obs, toCentre, STEPS);
    for (const d of [100 - 0.5 * R, 100, 100 + 0.5 * R]) {
      const exact = integrateRay(p1, obs, toCentre, 4 * STEPS, 0, d).T;
      const approx = starTransmittance(toCentre, d, r1.tau, r1.G, obs, p1.boundRadiusPc, p1.extinction.rgb);
      for (let c = 0; c < 3; c++) {
        expect(approx[c]).toBeLessThanOrEqual(1);
        expect(approx[c]).toBeGreaterThanOrEqual(r1.T[c] - 1e-9);
        expect(Math.abs(approx[c] - exact[c])).toBeLessThan(0.03);
      }
    }
  });
  it('shape v2: partial dust within the 4-knot CDF\'s own resolution (one knot interval\'s transmittance change)', () => {
    // v2 keeps dust only in the neutral gas (a wall), so tau is concentrated along the chord and a piecewise-linear
    // CDF through 4 knots is coarser than for v1 (measured 2026-10-03: worst 0.048 vs v1's 0.026). Linear
    // interpolation inside one knot interval cannot be off by more than that interval's own transmittance change;
    // +0.005 covers the 48- vs 192-step march difference.
    const knots = [0, ...ray.G, 1];
    const maxDTau = Math.max(...knots.slice(1).map((g, k) => (g - knots[k]) * ray.tau));
    for (const d of [100 - 0.5 * R, 100, 100 + 0.5 * R]) {
      const exact = integrateRay(pack, obs, toCentre, 4 * STEPS, 0, d).T;
      const approx = T(d);
      for (let c = 0; c < 3; c++) {
        expect(approx[c]).toBeLessThanOrEqual(1);
        expect(approx[c]).toBeGreaterThanOrEqual(Tfull[c] - 1e-9);
        expect(Math.abs(approx[c] - exact[c])).toBeLessThan(1 - Math.exp(-maxDTau * pack.extinction.rgb[c]) + 0.005);
      }
    }
  });
  it('the same holds through the baked atlas (bilinear read of tau and G)', () => {
    const texel = makeBakedTexel(pack, obs, N, STEPS);
    const v = sampleAtlas(toCentre, N, texel);
    const Tb = (d) => starTransmittance(toCentre, d, v[3], v.slice(4, 8), obs, pack.boundRadiusPc, pack.extinction.rgb);
    expect(Tb(50)).toEqual([1, 1, 1]);
    expect(Tb(2000)[1]).toBeLessThan(0.99);
    for (let c = 0; c < 3; c++) expect(Math.abs(Tb(2000)[c] - Tfull[c])).toBeLessThan(0.01);
  });
  it('G is a CDF: increasing, within [0, 1]; T = exp(-tau * extRGB) exactly', () => {
    expect(ray.G.every((g, k) => g >= 0 && g <= 1 && (k === 0 || g >= ray.G[k - 1]))).toBe(true);
    for (let c = 0; c < 3; c++) expect(Math.exp(-ray.tau * pack.extinction.rgb[c])).toBeCloseTo(Tfull[c], 10);
    expect(depthCDF(ray.G, 0)).toBe(0);
    expect(depthCDF(ray.G, 1)).toBe(1);
  });
  it('BROKEN CONTROL: dimming every star by the full column (step 1) changes the star in front', () => {
    expect(() => checkStarDust(Tfull, Tfull, Tfull)).toThrow(/in front changed/);
  });
  it('BROKEN CONTROL: grey extinction does not redden', () => {
    const grey = (d) => starTransmittance(toCentre, d, ray.tau, ray.G, obs, pack.boundRadiusPc, [1, 1, 1]);
    expect(() => checkStarDust(grey(50), grey(2000), grey(2000))).toThrow(/reddened/);
  });
});

// ── Bake lifecycle (generation tokens, hold, timeout) ─────────────────────────────────────────────────────
function clock() {
  const c = { t: 0, now: () => c.t };
  return c;
}
/** Run tiles until `pred` or `maxFrames`; returns frames used. */
function runFrames(s, perFrame, maxFrames = 1000, pred = () => false) {
  let f = 0;
  while (f < maxFrames && !pred()) {
    for (const t of s.nextTiles(perFrame)) s.tileDone(t.gen, t.tile);
    f++;
  }
  return f;
}
// Fence: whatever is published is complete and is the newest request's generation.
function checkNeverPartial(s, history) {
  for (const h of history) {
    if (h.published && h.publishedDone < s.tilesPerBake) throw new Error(`partial bake published (gen ${h.published})`);
  }
}
function recordedRun(s, frames, perFrame, onFrame = () => {}) {
  const history = [];
  for (let f = 0; f < frames; f++) {
    onFrame(f);
    for (const t of s.nextTiles(perFrame)) s.tileDone(t.gen, t.tile);
    const p = s.published;
    history.push({ published: p ? p.gen : null, publishedDone: p ? (s.job && s.job.gen === p.gen ? s.job.done : s.tilesPerBake) : null });
  }
  return history;
}

describe('bake scheduler: atomic publication, generation tokens, warp hold, timeout', () => {
  it('publishes only when every tile is done', () => {
    const s = new BakeScheduler({ tilesPerBake: 12, now: clock().now });
    s.request({ id: 'A' });
    const hist = recordedRun(s, 20, 1);
    expect(() => checkNeverPartial(s, hist)).not.toThrow();
    expect(hist[10].published).toBe(null);
    expect(hist[11].published).toBe(1);
  });
  it('BROKEN CONTROL: a scheduler that publishes on its first tile fails the fence', () => {
    class Eager extends BakeScheduler {
      tileDone(gen, tile) { const r = super.tileDone(gen, tile); if (this.job.state === 'baking') { this.published = { gen, snapshot: this.job.snapshot, set: this.job.set }; } return r; }
    }
    const s = new Eager({ tilesPerBake: 12, now: clock().now });
    s.request({ id: 'A' });
    expect(() => checkNeverPartial(s, recordedRun(s, 20, 1))).toThrow(/partial/);
  });
  it('a late tile from a superseded generation is discarded and never published', () => {
    const s = new BakeScheduler({ tilesPerBake: 4, now: clock().now });
    const a = s.request({ id: 'A' });
    const tilesA = s.nextTiles(3);
    const b = s.request({ id: 'B' }); // retarget mid-bake
    for (const t of tilesA) expect(s.tileDone(t.gen, t.tile)).toBe(false); // late A completions
    expect(s.stats.discardedTiles).toBe(3);
    runFrames(s, 1, 50, () => !!s.published);
    expect(s.published.gen).toBe(b);
    expect(s.published.snapshot.id).toBe('B');
    expect(a).not.toBe(b);
  });
  it('a finished-but-held bake that gets superseded is never shown', () => {
    const s = new BakeScheduler({ tilesPerBake: 2, now: clock().now });
    s.request({ id: 'origin' });
    runFrames(s, 2, 1);
    s.setHold(true);
    s.request({ id: 'dest1' });
    runFrames(s, 2, 1);                // dest1 ready, waiting
    expect(s.published.snapshot.id).toBe('origin');
    s.request({ id: 'dest2' });         // superseded while waiting
    s.setHold(false);                   // swap point before dest2 is done → billboard fallback
    expect(s.published).toBe(null);
    runFrames(s, 2, 1);
    expect(s.published.snapshot.id).toBe('dest2');
    expect(s.drainEvents().filter((e) => e.type === 'publish').length).toBe(2); // origin + dest2, never dest1
  });
  it('warp hold: the origin stays untouched while the destination bakes; released → destination', () => {
    const s = new BakeScheduler({ tilesPerBake: 6, now: clock().now });
    s.request({ id: 'origin' });
    runFrames(s, 6, 1);
    const origin = s.published;
    s.setHold(true);
    s.request({ id: 'dest' });
    const hist = recordedRun(s, 10, 1);
    expect(hist.every((h) => h.published === origin.gen)).toBe(true);
    expect(s.job.state).toBe('ready');
    expect(s.job.set).not.toBe(origin.set); // baked into the back set
    s.setHold(false);
    expect(s.published.snapshot.id).toBe('dest');
  });
  it('timeout: a delayed bake fails, publishes nothing and stops rendering tiles', () => {
    const c = clock();
    const s = new BakeScheduler({ tilesPerBake: 6, timeoutMs: 1000, now: c.now });
    s.request({ id: 'A' });
    s.stalled = true;               // a deliberately delayed bake
    expect(s.nextTiles(6)).toEqual([]);
    c.t = 1500;
    expect(s.nextTiles(6)).toEqual([]);
    expect(s.job.state).toBe('failed');
    expect(s.published).toBe(null);
    expect(s.stats.timeouts).toBe(1);
    s.stalled = false;
    expect(s.nextTiles(6)).toEqual([]); // a failed job never resumes
  });
  it('a staged (prepared, not live) request waits for the live sky\'s unfinished bake instead of pre-empting it', () => {
    const s = new BakeScheduler({ tilesPerBake: 4, now: clock().now });
    const live = s.request({ id: 'live' });
    s.nextTiles(2).forEach((t) => s.tileDone(t.gen, t.tile));
    const staged = s.request({ id: 'title' }, { staged: true });
    expect(s.job.gen).toBe(live);
    runFrames(s, 4, 3);
    expect(s.published.gen).toBe(live);      // the sky on screen got its volume
    expect(s.job.gen).toBe(staged);          // then the prepared one started
    runFrames(s, 4, 3);
    expect(s.published.gen).toBe(live);      // and is not shown until it goes live
    s.commit(staged);
    expect(s.published.gen).toBe(staged);
  });
  it('an interrupted warp (hold never released) lapses after holdTimeoutMs', () => {
    const c = clock();
    const s = new BakeScheduler({ tilesPerBake: 2, holdTimeoutMs: 5000, now: c.now });
    s.setHold(true);
    s.request({ id: 'dest' });
    runFrames(s, 2, 1);
    expect(s.published).toBe(null);
    c.t = 6000;
    s.nextTiles(1);
    expect(s.hold).toBe(false);
    expect(s.published.snapshot.id).toBe('dest');
  });
});

// ── The controller's warp gating, headless (fake renderer: no GL; the scheduler + bindings are real) ─────
function fakeRenderer() {
  const r = {
    autoClear: true,
    extensions: { has: () => true },
    getContext: () => null,
    setRenderTarget() {}, render() { r.draws++; }, clear() {}, setClearColor() {},
    draws: 0,
  };
  return r;
}
describe('controller: warp lifecycle with immutable snapshots', () => {
  const orion = subjects.orion;
  const originPos = observerPositionFor(feature, 100);
  const destPos = { ...orion.position }; // warp INTO Orion
  const mk = () => {
    const c = new GalacticController({ bakeTilesPerFrame: 4 });
    const r = fakeRenderer();
    c.setTarget(feature, originPos);
    for (let i = 0; i < 20; i++) c.preRender(r);
    return { c, r };
  };

  it('origin published; FOLD prepares the destination under hold; origin untouched until release', () => {
    const { c, r } = mk();
    expect(c.skipKey()).toBe(c.featureKey);
    const originGen = c.snapshot().bake.publishedGeneration;
    const bytes = c.textureBytes();
    let publishes = 0;
    c.onPublishChange = () => { publishes++; };
    c.setWarpHold(true);                          // main.js onPrepareSystem
    c.prepare([orion], destPos);                  // SkyRenderer.prepareForPositionAsync (FOLD)
    for (let i = 0; i < 10; i++) c.preRender(r);  // FOLD/ENTER frames
    expect(c.snapshot().bake.staged).toBe(true);   // prepared, not live yet
    expect(c.onSkyFeatures([orion], destPos)).toBe(`emission-nebula:${feature.seed}`); // activate (HYPER start): origin still drawn
    for (let i = 0; i < 10; i++) c.preRender(r);  // HYPER frames
    const s = c.snapshot();
    expect(s.bake.state).toBe('ready');
    expect(s.bake.publishedGeneration).toBe(originGen);
    expect(s.drawnFeatureId).toBe(`emission-nebula:${feature.seed}`);
    expect(publishes).toBe(0);
    c.setWarpHold(false);                         // emergence crossing
    expect(c.snapshot().bake.publishedGeneration).toBe(s.bake.generation);
    expect(c.skipKey()).toBe(`emission-nebula:${orion.seed}`);
    expect(publishes).toBe(1);
    expect(c.textureBytes()).toBe(bytes);         // no GPU texture growth after warm-up
    c.dispose();
  });
  it('a prepared sky that never goes live (title screen) is baked but never shown', () => {
    const { c, r } = mk();
    const originGen = c.snapshot().bake.publishedGeneration;
    c.prepare([orion], destPos);                 // prepareForPosition without activate()
    for (let i = 0; i < 30; i++) c.preRender(r);
    expect(c.snapshot().bake.state).toBe('ready');
    expect(c.snapshot().bake.publishedGeneration).toBe(originGen);
    c.onSkyFeatures([orion], destPos);           // activate(): now it goes live
    expect(c.snapshot().bake.publishedGeneration).not.toBe(originGen);
    c.dispose();
  });
  it('colour-mode flips do not re-bake (the bake hash ignores display parameters)', () => {
    const { c } = mk();
    const gen = c.snapshot().bake.generation;
    c.setColourMode('realistic');
    c.setColourMode('photo');
    expect(c.snapshot().bake.generation).toBe(gen);
    expect(bakeHashOf(c.getPack())).toBe(bakeHashOf({ ...c.getPack(), colourMode: 'realistic' }));
    c.dispose();
  });
  it('the job bakes its frozen snapshot even if the controller moves on mid-bake', () => {
    const { c } = mk();
    const job = c.scheduler.job;
    expect(Object.isFrozen(job.snapshot)).toBe(true);
    c.dispose();
  });
});

// ── Shader text fences for the new chunks ─────────────────────────────────────────────────────────────────
describe('bake / composite / star-dust shaders', () => {
  it('the composite builds rays from the FOV (never the inverse projection) and samples in screen space', () => {
    expect(CLOUD_COMPOSITE_FRAG).toMatch(/uCompTanHalf/);
    expect(CLOUD_COMPOSITE_FRAG).not.toMatch(/uInvProjection|projectionMatrixInverse/);
    expect(CLOUD_COMPOSITE_FRAG).toMatch(/cloudAtlasUV\(rd/);
  });
  it('the bake writes (L, tau) and G through the one integrator', () => {
    expect(CLOUD_BAKE_FRAG).toMatch(/integrateCloud\(uObserverPc, rd, L, T, tau, G\)/);
    expect(CLOUD_BAKE_FRAG).toMatch(/outLT = vec4\(L, tau\)/);
  });
  it('star dust reads the star distance attribute', () => {
    expect(CLOUD_STAR_DUST_GLSL).toMatch(/attribute float aDistPc/);
  });
});
