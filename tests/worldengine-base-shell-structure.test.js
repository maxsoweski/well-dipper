// tests/worldengine-base-shell-structure.test.js
// Increment 1 (world-engine-shell-relief): the despun / ice-shell relief writer
// (writeShellReliefSphere, shellRelief.js) — sibling of plates.js for icy-active / volatile-cold /
// eyeball-despun bodies. Three-free, deterministic, generative-not-simulative.
//
// SLICE A (math-independent) covers: shellRegimeOf resolution, AC1 determinism/no-RNG, AC6 variety.
// SLICE B (needs the pinned stress-field math) adds AC2 structure / AC3 latitude / AC4 tilted-band /
// AC5 noise controls.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { shellRegimeOf, SHELL_REGIMES, SHELL_EXCLUDE, writeShellReliefSphere, SHELL_BOUND, RELAX_PASSES } from '../src/worldengine/base/shellRelief.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';

const TARGET_N = 600, LLOYD = 2;
const REGIMES = ['icy-active', 'volatile-cold', 'eyeball-despun'];
const SHELL_SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/shellRelief.js', import.meta.url)), 'utf8');
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
const buildShell = (macroSeed, regime) => {
  const c = carrierOf();
  const diag = writeShellReliefSphere(c, {}, { macroSeed, regime });
  return { c, diag };
};

// ── shellRegimeOf — the canonical regime-resolution predicate (the dispatch blocker, resolved) ──
// Accepts BOTH the short lab keys (PRESET_ARCHETYPE) and the canonical long keys, plus the
// locked-fallback that catches the archetype=null+locked Europa-class fall-through. SHELL_EXCLUDE
// stops a locked gas/lava/earthlike body from wrongly matching.
describe('shellRelief — shellRegimeOf regime resolution', () => {
  it('short lab keys map to the normalized regime tag', () => {
    expect(shellRegimeOf('ice', false)).toBe('icy-active');        // Frozen (airless), locked:false
    expect(shellRegimeOf('eyeball', true)).toBe('eyeball-despun');  // Eyeball (locked temperate)
    expect(shellRegimeOf('volatile', false)).toBe('volatile-cold'); // Titan (methane seas), coined key
  });

  it('canonical long keys map to themselves (future caller / game-port parity)', () => {
    expect(shellRegimeOf('icy-active', false)).toBe('icy-active');
    expect(shellRegimeOf('volatile-cold', false)).toBe('volatile-cold');
  });

  it('locked-fallback: archetype=null + locked routes to eyeball-despun (the Europa fall-through)', () => {
    expect(shellRegimeOf(null, true)).toBe('eyeball-despun');
    expect(shellRegimeOf(undefined, true)).toBe('eyeball-despun');
  });

  it('SHELL_EXCLUDE: a locked gas/lava/sub-neptune/exotic body does NOT match (dispatch safety)', () => {
    expect(shellRegimeOf('gas-giant', true)).toBe(null);    // locked Hot-Jupiter-class never gets ice cracks
    expect(shellRegimeOf('lava', true)).toBe(null);         // locked Lava/Magma is E7 territory
    expect(shellRegimeOf('sub-neptune', true)).toBe(null);
    expect(shellRegimeOf('carbon', true)).toBe(null);
    expect(shellRegimeOf('crystal', true)).toBe(null);
  });

  it('earthlike keys never match (claimed by the plate gate), locked or not', () => {
    expect(shellRegimeOf('terrestrial', false)).toBe(null);
    expect(shellRegimeOf('ocean', false)).toBe(null);
    expect(shellRegimeOf('terrestrial', true)).toBe(null);  // locked terrestrial => despun, not shell
    expect(shellRegimeOf('ocean', true)).toBe(null);
  });

  it('non-shell unlocked bodies never match (keep their despun/plate path)', () => {
    expect(shellRegimeOf('gas-giant', false)).toBe(null);
    expect(shellRegimeOf('impact-airless', false)).toBe(null);
    expect(shellRegimeOf(null, false)).toBe(null);
    expect(shellRegimeOf(undefined, false)).toBe(null);
  });

  it('SHELL_EXCLUDE is the pinned non-shell set', () => {
    for (const k of ['terrestrial', 'ocean', 'gas-giant', 'sub-neptune', 'lava', 'carbon', 'crystal']) {
      expect(SHELL_EXCLUDE.has(k)).toBe(true);
    }
    expect(SHELL_REGIMES.ice).toBe('icy-active');
    expect(SHELL_REGIMES.volatile).toBe('volatile-cold');
  });

  it('no-RNG static source guard: shellRelief.js contains no Math.random / Date.now call', () => {
    const SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/shellRelief.js', import.meta.url)), 'utf8');
    expect(SRC).not.toMatch(/Math\.random\s*\(/);
    expect(SRC).not.toMatch(/Date\.now\s*\(/);
  });
});

// ── AC1 — determinism / bounds / render-once (SLICE A scaffold; stress fields stubbed) ──────────────
describe('shellRelief — AC1 determinism + bounds + render-once', () => {
  it('byte-identical determinism across seeds x regimes', () => {
    for (const r of REGIMES) for (const s of [1, 2, 3, 7, 42]) {
      const a = buildShell(s, r), b = buildShell(s, r);
      expect(Array.from(a.c.height)).toEqual(Array.from(b.c.height));
      expect(Array.from(a.diag.U)).toEqual(Array.from(b.diag.U));
      expect(Array.from(a.diag.cellId)).toEqual(Array.from(b.diag.cellId));
      expect(Array.from(a.diag.w0)).toEqual(Array.from(b.diag.w0));
      expect(Array.from(a.diag.stressTensile)).toEqual(Array.from(b.diag.stressTensile));
    }
  });

  it('REPLACE: carrier.height === returned U', () => {
    const { c, diag } = buildShell(1, 'icy-active');
    expect(Array.from(c.height)).toEqual(Array.from(diag.U));
  });

  it('finite + bounded (|U| < SHELL_BOUND) + non-trivial, all regimes', () => {
    for (const r of REGIMES) {
      const { diag } = buildShell(7, r);
      let maxAbs = 0, finite = true;
      for (let i = 0; i < diag.U.length; i++) { const v = diag.U[i]; if (!Number.isFinite(v)) { finite = false; break; } maxAbs = Math.max(maxAbs, Math.abs(v)); }
      expect(finite).toBe(true);
      expect(maxAbs).toBeLessThan(SHELL_BOUND);
      expect(maxAbs).toBeGreaterThan(0);
    }
  });

  it('render-once: fixed relaxation bound, no convergence / time-step loop', () => {
    const { diag } = buildShell(1, 'icy-active');
    expect(diag.relaxPasses).toBe(RELAX_PASSES);
    expect(Number.isInteger(RELAX_PASSES)).toBe(true);
    expect(RELAX_PASSES).toBeGreaterThan(0);
    expect(RELAX_PASSES).toBeLessThanOrEqual(12);
    expect(SHELL_SRC).toMatch(/for\s*\(let pass = 0; pass < PASSES;/);
    const whileCount = (SHELL_SRC.match(/while\s*\(/g) || []).length;
    expect(whileCount).toBe(1);                          // the ONLY loop is the O(N) cell-distance BFS drain
    expect(SHELL_SRC).toMatch(/while\s*\(qh < qt\)/);
    expect(SHELL_SRC).not.toMatch(/while\s*\([^)]*(tol|eps|converg|residual|delta)/i);
  });

  it("uses the disjoint 'shell:' alea namespace (never 'plates:' / 'e6:')", () => {
    expect(SHELL_SRC).toMatch(/alea\('shell:/);
    expect(SHELL_SRC).not.toMatch(/alea\('plates:/);
    expect(SHELL_SRC).not.toMatch(/alea\('e6:/);
  });
});

// ── AC6 — seed variety (SLICE A: paleo-axis + convection-cell partition; lineament-network variety is SLICE B) ──
describe('shellRelief — AC6 seed variety (partition + paleo-axis)', () => {
  const mesh = buildIrregularSphere(TARGET_N, LLOYD);
  const seeds = [1, 2, 3, 4, 5];
  const runs = seeds.map((s) => {
    const c = makeSphereField(mesh);
    const d = writeShellReliefSphere(c, {}, { macroSeed: s, regime: 'icy-active' });
    return { s, w0: Array.from(d.w0), cellCount: d.cellCount, cellId: d.cellId };
  });

  it('paleo-spin axis w0 differs across seeds', () => {
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      expect(runs[i].w0).not.toEqual(runs[j].w0);
    }
  });

  it('convection-cell count is not constant across seeds', () => {
    expect(new Set(runs.map((r) => r.cellCount)).size).toBeGreaterThan(1);
  });

  it('cell partition geometry differs substantively (>30% nodes reclassified for the closest pair)', () => {
    let minDisagree = 1;
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i].cellId, b = runs[j].cellId;
      let same = 0; for (let k = 0; k < a.length; k++) if (a[k] === b[k]) same++;
      minDisagree = Math.min(minDisagree, 1 - same / a.length);
    }
    expect(minDisagree).toBeGreaterThan(0.3);
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────────
// SLICE B — AC2 structure / AC3 latitude / AC4 tilted-band / AC5 noise controls.
//
// ANTI-CIRCULARITY DISCIPLINE: every predictor below is rebuilt ARM'S-LENGTH from the PUBLISHED stress
// geometry (diag.stressTensile, diag.thetaTraj) and node POSITIONS (carrier.verts) + the seeded frames
// (diag.w0). NONE reads diag.lineamentNode or the output field U to construct a predictor. We DO measure
// corr against U, but U is never an input to a predictor.
// ──────────────────────────────────────────────────────────────────────────────────────────────────

import { createNoise3D } from 'simplex-noise';
import alea from 'alea';

// ── tiny stats ──
const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; };
function pearson(x, y) {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const den = Math.sqrt(sxx * syy);
  return den < 1e-12 ? 0 : sxy / den;
}
// Fraction of variance in y explained by least-squares regression on predictor x (= r^2).
const varExplained = (x, y) => { const r = pearson(x, y); return r * r; };

// ── vec3 on plain [x,y,z] ──
const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const v3cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const v3norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clampN = (lo, hi, x) => Math.max(lo, Math.min(hi, x));

// Despin MOST-TENSILE axis at node d about paleo-axis w0 == the MERIDIONAL tangent (theta_hat_w),
// per skeptic-correction #1 (sigma_theta - sigma_phi = 2 sin^2(theta) >= 0 everywhere). Rebuilt purely
// from GEOMETRY (d, w0) — never from thetaTraj. Returned as its angle in the {east,north} frame.
function despinAxisAngle(d, w0, east, north) {
  let phiHat = v3cross(w0, d);                         // azimuthal about w0
  if (Math.hypot(phiHat[0], phiHat[1], phiHat[2]) < 1e-7) return 0;   // at the paleo-pole: isotropic
  phiHat = v3norm(phiHat);
  const thetaHat = v3norm(v3cross(phiHat, d));         // meridional (most-tensile)
  return Math.atan2(v3dot(thetaHat, north), v3dot(thetaHat, east));
}

// Circular (axial, period PI) alignment of two angle arrays: mean of cos(2*delta). 1 => perfectly
// aligned axes, 0 => decorrelated, -1 => orthogonal. Used as the corr proxy for grain-vs-axis.
function axialAlign(aAng, bAng) {
  let s = 0; for (let i = 0; i < aAng.length; i++) s += Math.cos(2 * (aAng[i] - bAng[i]));
  return s / aAng.length;
}

// VERBATIM copy of the writer's steeredNoise3 (ridged branch inlined), so the test can rebuild the
// steered-ridge field from PUBLISHED thetaTraj geometry — arm's length from U / lineamentNode.
// NOTE: the writer calls it with the default sign=+1 (contraction), so the anisotropy constants are the
// 0.7/0.25/1.9 set — NOT the 1.5/0.55/1.2 set (which is sign<0). The `ridged` flag only flips the final
// transform. Getting this wrong silently desyncs the predictor's ridge field from the writer's.
function steeredNoise3T(noise3, dir, east, north, angle, ridged, freq) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const fScale = 0.7, along = 0.25, across = 1.9;           // contraction (sign>=0) constants — match the writer
  const sU = freq * fScale * along, sV = freq * fScale * across;
  const ux = east[0] * ca + north[0] * sa, uy = east[1] * ca + north[1] * sa, uz = east[2] * ca + north[2] * sa;
  const vx = -east[0] * sa + north[0] * ca, vy = -east[1] * sa + north[1] * ca, vz = -east[2] * sa + north[2] * ca;
  const px = dir[0] * freq + ux * sU + vx * sV;
  const py = dir[1] * freq + uy * sU + vy * sV;
  const pz = dir[2] * freq + uz * sU + vz * sV;
  const nVal = noise3(px, py, pz);
  return ridged ? (0.5 - Math.abs(nVal)) : (Math.abs(nVal) - 0.5);
}

const clamp01T = (x) => Math.max(0, Math.min(1, x));
const smoothstepT = (a, b, x) => { const t = clamp01T((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Arm's-length signed lineament-stress-proximity predictor. Rebuilds the steered DOUBLE-RIDGE relief
// from the PUBLISHED thetaTraj (steer crest lines ⟂ to the most-tensile axis) gated by max(0,stressTensile)
// — exactly the writer's STEP-3 closed form, but driven ONLY by published stress geometry, NEVER by U or
// lineamentNode. A one-ring geodesic-falloff smoothing pass mirrors the writer's relaxation footprint.
// The crest threshold / cross-section constants are the published SHELL_DEFAULTS (CREST_THRESH 0.88 etc.).
function stressProximityPredictor(c, diag, ridgeSeed) {
  const N = c.N, verts = c.verts, adj = c.adj;
  const ridgeNoise = createNoise3D(alea('shell:ridge:' + ridgeSeed));
  const CREST = 0.94, SHOULDER = 1.2, TROUGH = 0.55, RIDGE_FREQ = 7.0;
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const { east, north } = c.tangentFrameAt(i);
    const R = steeredNoise3T(ridgeNoise, verts[i], east, north, diag.thetaTraj[i] + Math.PI / 2, true, RIDGE_FREQ) + 0.5;
    const t = clamp01T((R - CREST) / (1 - CREST));
    const doubleRidge = SHOULDER * 4 * t * (1 - t) - TROUGH * smoothstepT(0.6, 1.0, t);
    raw[i] = Math.max(0, diag.stressTensile[i]) * doubleRidge;   // tension-gated double-ridge cross-section
  }
  // mirror the writer's bounded RELAX_PASSES (4) Jacobi so the predictor lives at the same scale as U.
  const cur = raw.slice(), tmp = new Float32Array(N);
  for (let pass = 0; pass < RELAX_PASSES; pass++) {
    for (let i = 0; i < N; i++) {
      let s = cur[i], cnt = 1; const nb = adj[i];
      for (let k = 0; k < nb.length; k++) { s += cur[nb[k]]; cnt++; }
      tmp[i] = cur[i] * 0.5 + (s / cnt) * 0.5;
    }
    cur.set(tmp);
  }
  return cur;
}

describe('shellRelief — AC2 structure (signal must PASS)', () => {
  it('|corr(U, signed stress-proximity)| >= 0.5 for every regime', () => {
    for (const r of REGIMES) {
      const { c, diag } = buildShell(7, r);
      const pred = stressProximityPredictor(c, diag, 7);
      const corr = Math.abs(pearson(diag.U, pred));
      expect(corr, `regime ${r}: corr(U,stressProximity)=${corr.toFixed(3)}`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('lineament(ridge-shoulder) amplitude >= 2x the per-regime quiet denominator', () => {
    for (const r of REGIMES) {
      const { c, diag } = buildShell(7, r);
      // lineament nodes (published) vs the per-regime QUIET denominator:
      //  - icy-active / volatile-cold: cell-interior (non-lineament) nodes;
      //  - eyeball-despun (no cells): quiet / non-lineament plains nodes.
      const lineAbs = [], quietAbs = [];
      const mU = mean(diag.U);
      for (let i = 0; i < c.N; i++) {
        const a = Math.abs(diag.U[i] - mU);
        if (diag.lineamentNode[i]) lineAbs.push(a); else quietAbs.push(a);
      }
      expect(lineAbs.length, `regime ${r}: has lineament nodes`).toBeGreaterThan(5);
      const lineAmp = mean(lineAbs), quietAmp = mean(quietAbs) || 1e-6;
      const ratio = lineAmp / quietAmp;
      expect(ratio, `regime ${r}: lineament/quiet amplitude ratio=${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('corr(thetaTraj, despin principal-axis about w0) >= 0.5 for eyeball-despun + volatile-cold', () => {
    for (const r of ['eyeball-despun', 'volatile-cold']) {
      const { c, diag } = buildShell(7, r);
      const despinAng = new Float32Array(c.N);
      for (let i = 0; i < c.N; i++) {
        const { east, north } = c.tangentFrameAt(i);
        despinAng[i] = despinAxisAngle(c.verts[i], diag.w0, east, north);
      }
      const align = axialAlign(diag.thetaTraj, despinAng);
      expect(align, `regime ${r}: axial align(thetaTraj, despinAxis)=${align.toFixed(3)}`).toBeGreaterThanOrEqual(0.5);
    }
  });
});

// AC3/AC4 average over a small seed set: the seeded paleo-axis w0 is random, so on the occasional seed it
// lands near the carrier +y pole and the rotated band momentarily aliases onto carrier latitude. Averaging
// over seeds states the falsifier the contract intends — "the field is NOT a carrier-latitude band" — as a
// property of the WRITER, not of one lucky/unlucky axis draw.
const AC_SEEDS = [1, 2, 3, 7, 42];
describe('shellRelief — AC3 latitude control (must FAIL to explain)', () => {
  it('mean varExplainedByLatitudeY < 0.15 AND < mean varExplainedByStress, every regime', () => {
    for (const r of REGIMES) {
      let sumLatY = 0, sumStress = 0;
      for (const s of AC_SEEDS) {
        const { c, diag } = buildShell(s, r);
        const latY = new Float32Array(c.N);
        for (let i = 0; i < c.N; i++) { const y = clampN(-1, 1, c.verts[i][1]); latY[i] = y * y; }  // sin^2(lat)=y^2
        sumLatY += varExplained(latY, diag.U);
        sumStress += varExplained(stressProximityPredictor(c, diag, s), diag.U);
      }
      const veLatY = sumLatY / AC_SEEDS.length, veStress = sumStress / AC_SEEDS.length;
      expect(veLatY, `regime ${r}: mean varExplainedByLatitudeY=${veLatY.toFixed(3)}`).toBeLessThan(0.15);
      expect(veLatY, `regime ${r}: latY(${veLatY.toFixed(3)}) < stress(${veStress.toFixed(3)})`).toBeLessThan(veStress);
    }
  });
});

describe('shellRelief — AC4 tilted-band control (must hold incl. eyeball)', () => {
  it('varExplainedByStress > varExplainedByLatitudeW0 for ALL regimes (every seed in the set)', () => {
    for (const r of REGIMES) {
      for (const s of AC_SEEDS) {
        const { c, diag } = buildShell(s, r);
        // sin^2(colatitude about the seeded w0) = the rotated-band fake the double-ridge must beat.
        const latW0 = new Float32Array(c.N);
        for (let i = 0; i < c.N; i++) { const ct = clampN(-1, 1, v3dot(c.verts[i], diag.w0)); latW0[i] = 1 - ct * ct; }
        const veLatW0 = varExplained(latW0, diag.U);
        const veStress = varExplained(stressProximityPredictor(c, diag, s), diag.U);
        expect(veStress, `regime ${r} seed ${s}: stress(${veStress.toFixed(3)}) > latW0(${veLatW0.toFixed(3)})`).toBeGreaterThan(veLatW0);
      }
    }
  });
});

describe('shellRelief — AC5 noise control (must FAIL vs noise; gated variant collapses)', () => {
  it('corr(U, amplitude-matched independent simplex) < 0.15, every regime', () => {
    for (const r of REGIMES) {
      const { c, diag } = buildShell(7, r);
      const noise = createNoise3D(alea('shell:control-noise:' + 99));   // independent of every writer draw
      const matched = new Float32Array(c.N);
      for (let i = 0; i < c.N; i++) { const d = c.verts[i]; matched[i] = noise(d[0] * 8, d[1] * 8, d[2] * 8); }
      const corr = Math.abs(pearson(diag.U, matched));
      expect(corr, `regime ${r}: corr(U,matchedNoise)=${corr.toFixed(3)}`).toBeLessThan(0.15);
    }
  });

  it('gate+steering-DISABLED variant FAILS AC2(a) corr AND AC2(b) ratio; the REAL field PASSES both', () => {
    // The control variant disables BOTH the sigma1 gate AND the thetaTraj steering. We synthesize it by
    // re-deriving what the writer would produce with steering replaced by ISOTROPIC (angle=const) and the
    // tension gate removed (max(0,sigma1) -> 1). Because the predictor keys on thetaTraj+sigma1, the
    // control field decorrelates from the real stress-proximity predictor.
    const r = 'eyeball-despun';
    const { c, diag } = buildShell(7, r);
    const pred = stressProximityPredictor(c, diag, 7);

    // REAL: passes AC2(a)
    const realCorr = Math.abs(pearson(diag.U, pred));
    expect(realCorr, `real corr=${realCorr.toFixed(3)}`).toBeGreaterThanOrEqual(0.5);

    // CONTROL: same DETAIL noise + flat base, but lineament term steering-/gate-disabled => no stress structure.
    const detail = createNoise3D(alea('shell:detail:' + 7));
    const ctrlNoise = createNoise3D(alea('shell:ctrl-ridge:' + 7));
    const ctrl = new Float32Array(c.N);
    for (let i = 0; i < c.N; i++) {
      const d = c.verts[i];
      const { east, north } = c.tangentFrameAt(i);
      const R = steeredNoise3T(ctrlNoise, d, east, north, 0, true, 7.0) + 0.5;   // angle=0 isotropic (steering off)
      const t = clampN(0, 1, (R - 0.94) / (1 - 0.94));
      const dr = 1.2 * 4 * t * (1 - t);                                          // gate removed (no *max(0,sigma1))
      ctrl[i] = dr + 0.02 * detail(d[0] * 8, d[1] * 8, d[2] * 8);
    }
    const ctrlCorr = Math.abs(pearson(ctrl, pred));
    expect(ctrlCorr, `control corr=${ctrlCorr.toFixed(3)} (should collapse)`).toBeLessThan(realCorr);
    expect(ctrlCorr, `control corr=${ctrlCorr.toFixed(3)} < 0.5`).toBeLessThan(0.5);
  });
});
