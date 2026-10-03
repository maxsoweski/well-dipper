// Galactic Engine — cloud shape v2 (reshaping guide R1-R4) vs the step-1 field (v1), measured headless on the CPU
// twin. Max, round 1: "It looks like a ring... It looks like a circle." Each check is a named function that also
// runs on a committed broken control which must fail it.
//
// Contact sheet of the same renders: node scripts/galactic-shape-contact-sheet.mjs → research/nebula-refs/shape-v1-vs-v2.png
import { describe, it, expect } from 'vitest';
import { GalacticMap } from '../src/generation/GalacticMap.js';
import { findCloudSubjects } from '../src/galactic/subjects.js';
import { featureHistory } from '../src/galactic/featureHistory.js';
import { renderPack, packHash, DEFAULT_SHAPE_VERSION, SHAPE_VERSIONS } from '../src/galactic/renderPacks.js';
import { integrateRay, homogeneousSpherePack, envelopeV2 } from '../src/galactic/cloudFieldCPU.js';
import { renderOrtho, ringMetrics, sixViews, sourceDirectionGalactic, readsAsRing } from '../src/galactic/shapeMetrics.js';

const gm = new GalacticMap('well-dipper-galaxy-1');
const subjects = findCloudSubjects(gm);
const NAMES = ['procedural', 'orion'];
const pk = (name, shapeVersion, extra = {}) => renderPack(featureHistory(subjects[name]), { overrides: {}, shapeVersion, ...extra });

// ── v1 is the step-1 field exactly ─────────────────────────────────────────────────────────────────────────
// Goldens captured at 83b300c (before shape v2 existed): the pack hash per subject x colour mode, and an FNV hash of
// 12 rays' L, T, tau, G printed to 17 significant digits (every float64 bit).
const V1_PACK_GOLDEN = {
  'procedural|photo': 'de86e73f', 'procedural|realistic': '4384f163',
  'orion|photo': 'be1bac26', 'orion|realistic': '09ba6d82',
};
const V1_RAY_GOLDEN = { procedural: 'a56f5225', orion: 'b1e6ffef' };
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
};
function rayHash(p) {
  const R = p.radiusPc, vals = [];
  for (let i = 0; i < 12; i++) {
    const d = [((i % 4) - 1.5) * 0.12, (Math.floor(i / 4) - 1) * 0.12, -1];
    const l = Math.hypot(...d);
    const r = integrateRay(p, [0.3 * R, -0.2 * R, 3 * R], d.map((v) => v / l), 48);
    vals.push(...r.L, ...r.T, r.tau, ...r.G);
  }
  return fnv(vals.map((v) => v.toPrecision(17)).join(','));
}
function checkV1Golden(name, mode, pack) {
  if (packHash(pack) !== V1_PACK_GOLDEN[`${name}|${mode}`]) throw new Error(`${name} ${mode}: pack differs from the step-1 pack`);
  if (rayHash(pack) !== V1_RAY_GOLDEN[name]) throw new Error(`${name}: rays differ from the step-1 field`);
}

describe('shapeVersion 1 reproduces the step-1 field byte for byte', () => {
  for (const name of NAMES) {
    for (const mode of ['photo', 'realistic']) {
      it(`${name} (${mode}): identical pack hash and identical ray bits`, () => {
        expect(() => checkV1Golden(name, mode, pk(name, 1, { colourMode: mode }))).not.toThrow();
      });
    }
  }
  it('BROKEN CONTROL: the v2 pack fails the step-1 golden', () => {
    expect(() => checkV1Golden('procedural', 'photo', pk('procedural', 2))).toThrow(/differs/);
  });
  it('the default is v2; an unknown version is refused', () => {
    expect(DEFAULT_SHAPE_VERSION).toBe(2);
    expect(SHAPE_VERSIONS).toEqual([1, 2]);
    expect(renderPack(featureHistory(subjects.orion), { overrides: {} }).shapeVersion).toBe(2);
    expect(() => pk('orion', 3)).toThrow(/shape version/);
  });
});

// ── The bounding sphere covers the stretched, lobed envelope (no clipped edges) ───────────────────────────
// March outward along many directions in the nebula-local frame; the envelope's farthest non-zero point must lie
// inside boundRadiusPc (the bake, the live march and the star dust all clip to that sphere).
function envelopeExtent(pack, dirs = 400) {
  let worst = 0;
  const R = pack.radiusPc;
  for (let i = 0; i < dirs; i++) {
    const z = 1 - (2 * (i + 0.5)) / dirs, ph = i * 2.399963229728653, s = Math.sqrt(1 - z * z);
    const d = [s * Math.cos(ph), s * Math.sin(ph), z];
    for (let r = 3 * R; r > 0; r -= R / 200) {
      if (envelopeV2(d.map((c) => c * r), pack) > 0) { worst = Math.max(worst, r); break; }
    }
  }
  return worst;
}
function checkBoundCovers(pack) {
  const ext = envelopeExtent(pack);
  if (!(ext <= pack.boundRadiusPc)) throw new Error(`envelope reaches ${ext.toFixed(2)} pc > bound ${pack.boundRadiusPc.toFixed(2)} pc`);
  return ext;
}
describe('boundRadiusPc covers the v2 envelope', () => {
  for (const name of NAMES) {
    it(name, () => {
      const p = pk(name, 2);
      expect(() => checkBoundCovers(p)).not.toThrow();
      expect(envelopeExtent(p)).toBeGreaterThan(p.radiusPc); // the lobes really do reach past R
    });
  }
  it('BROKEN CONTROL: the step-1 bound (= R) clips the lobed envelope', () => {
    const p = pk('orion', 2);
    expect(() => checkBoundCovers({ ...p, boundRadiusPc: p.radiusPc })).toThrow(/bound/);
  });
});

// ── Not a ring, from every direction ──────────────────────────────────────────────────────────────────────
const N = 96;
function measure(pack, views, halfPc) {
  return views.map((v) => ringMetrics(renderOrtho(pack, v.dir, { n: N, halfPc })));
}
/** v2's claim: from each of the six views the light is NOT spread evenly round a centred annulus. */
function checkNotRing(metrics) {
  metrics.forEach((m, i) => {
    if (readsAsRing(m)) throw new Error(`view ${i} reads as a ring/circle (angular CV ${m.angularCV.toFixed(3)}, centroid offset ${m.centroidOff.toFixed(3)})`);
  });
}
/** v2's claim: every view's outline is clearly less round than a disc. */
const CIRC_MIN = 1.8; // v1 measured 1.16-1.48; v2 2.06-5.39 (2026-10-03, 96 px)
function checkNotRound(metrics) {
  metrics.forEach((m, i) => {
    if (!(m.circularity > CIRC_MIN)) throw new Error(`view ${i} outline too round (circularity ${m.circularity.toFixed(2)} <= ${CIRC_MIN})`);
  });
}

const results = {};
for (const name of NAMES) {
  const p1 = pk(name, 1), p2 = pk(name, 2);
  const views = sixViews(sourceDirectionGalactic(p1));
  const halfPc = Math.max(p1.boundRadiusPc, p2.boundRadiusPc) * 1.02; // the same framing for both versions
  results[name] = { v1: measure(p1, views, halfPc), v2: measure(p2, views, halfPc) };
}
// The broken control: a perfect spherical shell (uniform emitting gas with an empty concentric hole).
const shell = (() => {
  const p = homogeneousSpherePack({ radiusPc: 10, j: [0.02, 0.01, 0.005], k: [0.001, 0.001, 0.001] });
  return { ...p, cavity: { centrePc: [0, 0, 0], radiusPc: 7, depth: 1 } };
})();
const shellViews = sixViews([0.3, 0.8, 0.52]);
const shellMetrics = measure(shell, shellViews, 10.2);

describe('v1 reads as a ring/circle; v2 does not, from all six views (CPU twin, 96 px orthographic)', () => {
  for (const name of NAMES) {
    it(`${name}: v1 is centred and even all the way round in every view (the instrument sees what Max saw)`, () => {
      results[name].v1.forEach((m) => expect(readsAsRing(m)).toBe(true));
    });
    it(`${name}: v2 is not a ring from any view`, () => {
      expect(() => checkNotRing(results[name].v2)).not.toThrow();
    });
    it(`${name}: v2's outline is clearly less circular than v1's in every view`, () => {
      expect(() => checkNotRound(results[name].v2)).not.toThrow();
      const mean = (a) => a.reduce((s, m) => s + m.circularity, 0) / a.length;
      expect(mean(results[name].v2)).toBeGreaterThan(1.5 * mean(results[name].v1));
    });
  }
  it('BROKEN CONTROL: a perfect spherical shell fails both v2 checks', () => {
    expect(shellMetrics[0].ringRatio).toBeGreaterThan(1.5); // it is a real limb-bright ring
    expect(() => checkNotRing(shellMetrics)).toThrow(/reads as a ring/);
    expect(() => checkNotRound(shellMetrics)).toThrow(/too round/);
  });
  it('BROKEN CONTROL: the v1 field fails the v2 checks', () => {
    expect(() => checkNotRing(results.procedural.v1)).toThrow(/reads as a ring/);
    expect(() => checkNotRound(results.orion.v1)).toThrow(/too round/);
  });
});

// ── Brightness calibration (R2 moved the budget: emission ∝ rho²·x, no neutral floor) ─────────────────────
// V2_ION_WEIGHT is set so v2's brightest gas (99.5th-percentile pixel over the six views) matches v1's.
function p995(metricsImgs) {
  const a = metricsImgs.flatMap((im) => Array.from(im.Y)).sort((x, y) => x - y);
  return a[Math.floor(a.length * 0.995)];
}
describe('v2 brightness stays in v1\'s range', () => {
  for (const name of NAMES) {
    it(`${name}: 99.5th-percentile luminance within 0.6x-1.6x of v1`, () => {
      const p1 = pk(name, 1), p2 = pk(name, 2);
      const views = sixViews(sourceDirectionGalactic(p1)).slice(0, 3);
      const halfPc = Math.max(p1.boundRadiusPc, p2.boundRadiusPc) * 1.02;
      const r = p995(views.map((v) => renderOrtho(p2, v.dir, { n: 48, halfPc }))) / p995(views.map((v) => renderOrtho(p1, v.dir, { n: 48, halfPc })));
      expect(r).toBeGreaterThan(0.6);
      expect(r).toBeLessThan(1.6);
    });
  }
});

// ── Declared directions of the v2 physics ─────────────────────────────────────────────────────────────────
describe('v2 field: declared directions', () => {
  const p = pk('orion', 2);
  const src = p.ionizing.centrePc, n = p.shape.openDir;
  it('R1: the source sits toward the open side and the cavity breaks through the surface', () => {
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const v1 = pk('orion', 1);
    expect(dot(src, n)).toBeGreaterThan(dot(v1.ionizing.centrePc, n)); // moved outward
    // straight out along n from the cavity centre, the density reaches the cavity floor before the envelope ends
    const c = p.cavity.centrePc;
    expect(Math.hypot(...c) + p.cavity.radiusPc).toBeGreaterThan(Math.hypot(...src));
  });
  it('R2 + R3: glow and dust come from the same front — dust is missing exactly where the gas is ionized', async () => {
    const { sampleMediumV2, densityV2, luminance } = await import('../src/galactic/cloudFieldCPU.js');
    const M = p.rotation;
    const R = p.boundRadiusPc;
    let ionized = 0, neutral = 0, n2 = 0;
    for (let i = 0; i < 30000; i++) {
      const g = [Math.sin(i * 12.9898) * R, Math.sin(i * 78.233) * R, Math.sin(i * 37.719) * R];
      const rho = densityV2([M[0] * g[0] + M[3] * g[1] + M[6] * g[2], M[1] * g[0] + M[4] * g[1] + M[7] * g[2], M[2] * g[0] + M[5] * g[1] + M[8] * g[2]], p);
      if (!(rho > 1e-3)) continue;
      const { j, k } = sampleMediumV2(g, p);
      const xFromGlow = luminance(j) / (p.emission.scale * rho * rho);              // line colours have unit luminance
      const xFromDust = (1 - k[1] / (p.extinction.scale * rho * p.extinction.rgb[1])) / p.shape.dustDestroy;
      expect(Math.abs(xFromGlow - xFromDust)).toBeLessThan(1e-9);
      if (xFromGlow > 0.99) ionized++;
      if (xFromGlow < 0.01) neutral++;
      n2++;
    }
    expect(n2).toBeGreaterThan(100);
    expect(ionized).toBeGreaterThan(0.05 * n2); // there is a lit zone
    expect(neutral).toBeGreaterThan(0.05 * n2); // and dark neutral gas that only absorbs (no 0.25 glow floor)
  });
});
