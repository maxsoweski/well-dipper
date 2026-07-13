// tests/worldengine-base-magmatism-multiply.test.js
// Increment #4-MULTIPLY (world-engine-magmatism-multiply): the volcanic DRIVER-RESPONSE + grain-aligned
// edifices pass over the #4a skeleton. Mirrors #2's plate driver-response discipline: the per-body D-vector
// (bodyDrivers) is mapped to a `tune` override via magmaDriversToTune(), anchored so magmaDriversToTune(MAGMA_REF)
// === null → the writer runs #4a BYTE-IDENTICAL at the neutral reference (AC1).
//
// SLICE A: AC1 byte-identity-at-reference + determinism of the mapper, AC2 monotone count/strength response,
// AC5 no-clobber (off-path magmaDiag null; volcanic bodyDrivers=null == #4a).
// SLICE B (added): AC3 grain anisotropy PASSES (elongated + grain-aligned) while the latitude control FAILS
// (multi-seed, per the adversary fix), and AC4 the edifice>plain>basin ordering is preserved under the sweep.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  writeMagmatismSphere, MAGMA_BOUND, MAGMA_DEFAULTS, MAGMA_REF, magmaThermal, magmaDriversToTune,
} from '../src/worldengine/base/magmatism.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import {
  buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS,
} from '../planet-lod-rivers.js';
// PRESET_ARCHETYPE-retirement (2026-07-13): the AC5 dispatch `it`s migrate to condition-bearing bundles.
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';

const TARGET_N = 600, LLOYD = 2;
const SEEDS = [1, 2, 3, 7, 42];
const LOCKS = [false, true];
const MAGMA_SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/magmatism.js', import.meta.url)), 'utf8');
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
// The real shipped preset drivers (node-computed in BUILD-PLAN.md): raw Io-normalized tidal saturates clamp01.
const LAVA_DRIVERS = { tidalHeating: 7.82e5, massGravity: 0.80, volatileFraction: 0.02 };
const MAGMA_DRIVERS = { tidalHeating: 7.58e7, massGravity: 2.22, volatileFraction: 0.0 };
const meanOverMask = (U, mask) => { let s = 0, n = 0; for (let i = 0; i < U.length; i++) if (mask[i]) { s += U[i]; n++; } return n ? s / n : 0; };
// Condition-bearing bundle for a representative preset (bundle17 idiom). deriveUniforms(fp,1.0)==QUALITY_TIER.
function condBundle(name, opts = {}) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, 1.0);
  return {
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    ...opts,
  };
}

// ── AC1 — byte-identical at the neutral reference + mapper determinism ────────────────────────────────
describe('#4-MULTIPLY AC1 — byte-identical at MAGMA_REF + determinism', () => {
  it('magmaDriversToTune returns null at the reference and for null drivers (the identity guard)', () => {
    expect(magmaDriversToTune(MAGMA_REF)).toBeNull();
    expect(magmaDriversToTune(null)).toBeNull();
    // magmaThermal(MAGMA_REF) is the exact H_REF the guard subtracts (Hd = 0) — self-consistent by construction.
    expect(magmaThermal(MAGMA_REF)).toBeGreaterThan(0);
    expect(magmaThermal(MAGMA_REF)).toBeLessThan(1);
  });

  it('at MAGMA_REF the writer reproduces #4a byte-for-byte (every seed x locked, T_ss exercised)', () => {
    for (const s of SEEDS) for (const L of LOCKS) {
      const T_ss = L ? 2800 : 0;
      // #4a baseline: the pre-#4-MULTIPLY call form (empty drivers, no tune).
      const cBase = carrierOf();
      const base = writeMagmatismSphere(cBase, {}, { macroSeed: s, locked: L, T_ss });
      // #4-MULTIPLY at the reference: bodyDrivers = MAGMA_REF, tune = magmaDriversToTune(MAGMA_REF) (=== null).
      const cRef = carrierOf();
      const ref = writeMagmatismSphere(cRef, MAGMA_REF, { macroSeed: s, locked: L, T_ss, tune: magmaDriversToTune(MAGMA_REF) });
      const tag = `seed ${s} locked ${L}`;
      expect(Array.from(cRef.height), `${tag}: carrier.height`).toEqual(Array.from(cBase.height));
      expect(Array.from(ref.U), `${tag}: U`).toEqual(Array.from(base.U));
      expect(Array.from(ref.edificeMask), `${tag}: edificeMask`).toEqual(Array.from(base.edificeMask));
      expect(Array.from(ref.lavaPlainMask), `${tag}: lavaPlainMask`).toEqual(Array.from(base.lavaPlainMask));
      expect(Array.from(ref.magmaOceanMask), `${tag}: magmaOceanMask`).toEqual(Array.from(base.magmaOceanMask));
      expect(Array.from(ref.A_e), `${tag}: A_e`).toEqual(Array.from(base.A_e));
      expect(Array.from(ref.Psi_e), `${tag}: Psi_e`).toEqual(Array.from(base.Psi_e));
      expect(ref.plumeCount, `${tag}: plumeCount`).toBe(base.plumeCount);
      for (let i = 0; i < ref.U.length; i++) expect(Math.abs(ref.U[i]), `${tag}: |U| bound`).toBeLessThan(MAGMA_BOUND);
    }
  });

  it('magmaDriversToTune is a pure deterministic mapper (no RNG / no clock) and its inputs are read-only', () => {
    expect(String(magmaDriversToTune)).not.toMatch(/Math\.random|Date\.now/);
    const before = JSON.stringify(LAVA_DRIVERS);
    magmaDriversToTune(LAVA_DRIVERS);
    expect(JSON.stringify(LAVA_DRIVERS)).toBe(before);             // never mutates the drivers
    expect(magmaDriversToTune(LAVA_DRIVERS)).toEqual(magmaDriversToTune(LAVA_DRIVERS));   // deterministic
  });

  it('while-count unchanged (still the single BFS drain) — no new convergence loop from the driver pass', () => {
    const whileCount = (MAGMA_SRC.match(/while\s*\(/g) || []).length;
    expect(whileCount).toBe(1);
    expect(MAGMA_SRC).not.toMatch(/Math\.random\s*\(/);
    expect(MAGMA_SRC).not.toMatch(/Date\.now\s*\(/);
  });
});

// ── AC2 — monotone count/strength response (correct sign) ─────────────────────────────────────────────
describe('#4-MULTIPLY AC2 — plume count/strength track thermal history (monotone, correct sign)', () => {
  it('at a fixed seed, rising thermal drive monotonically increases plume count AND mean edifice amplitude', () => {
    const H_REF = magmaThermal(MAGMA_REF);
    const sweep = [H_REF, 0.5, 0.8];                               // H0 = reference (tune null) < H1 < H2
    for (const s of SEEDS) {
      let lastCount = -Infinity, lastAmp = -Infinity;
      for (const H of sweep) {
        const c = carrierOf();
        const tune = magmaDriversToTune({ thermalState: H });      // no massGravity → gFactor = 1 (no confound)
        const diag = writeMagmatismSphere(c, { thermalState: H }, { macroSeed: s, locked: false, tune });
        const amp = meanOverMask(diag.U, diag.edificeMask);
        expect(diag.plumeCount, `seed ${s} H ${H}: plumeCount non-decreasing`).toBeGreaterThanOrEqual(lastCount);
        expect(amp, `seed ${s} H ${H}: mean edifice amplitude non-decreasing`).toBeGreaterThanOrEqual(lastAmp - 1e-9);
        lastCount = diag.plumeCount; lastAmp = amp;
      }
    }
  });

  it('the real shipped Lava/Magma drivers produce a NON-null tune (they sit off the reference → visible change)', () => {
    const tLava = magmaDriversToTune(LAVA_DRIVERS);
    const tMagma = magmaDriversToTune(MAGMA_DRIVERS);
    expect(tLava, 'Lava tune non-null').not.toBeNull();
    expect(tMagma, 'Magma tune non-null').not.toBeNull();
    expect(tLava.PLUME_COUNT_MIN).toBeGreaterThan(MAGMA_DEFAULTS.PLUME_COUNT_MIN);   // more plumes than the #4a floor
    // gravity secondary: low-g Lava builds TALLER shields, high-g Magma FLATTER (physical reliefGravityFactor).
    expect(tLava.EDIFICE_HEIGHT, 'Lava taller than Magma (low gravity)').toBeGreaterThan(tMagma.EDIFICE_HEIGHT);
  });
});

// ── AC5 — no-clobber + dispatch safety (the volcanic branch change is byte-safe off the reference path) ─
describe('#4-MULTIPLY AC5 — no-clobber + dispatch', () => {
  const relief = (c, opts) => writeBodyRelief(c, { grainDrivers: DEFAULT_GRAIN_DRIVERS, ...opts });

  it('off the volcanic path magmaDiag is null (plate / shell / despun), even though bodyDrivers is non-null', () => {
    // M9: route via the condition (Rocky/Ocean → plate, Gas → despun); MAGMA_DRIVERS merged onto the neutral
    // bodyDrivers is inert off the volcanic path (routing reads the nested .condition, not the flat driver slots).
    for (const name of ['Rocky (Earthlike)', 'Ocean (temperate)', 'Gas giant (Jovian)']) {
      const b = condBundle(name, { macroSeed: 3 });
      b.bodyDrivers = { ...b.bodyDrivers, ...MAGMA_DRIVERS };
      const r = relief(carrierOf(), b);
      expect(r.magmaDiag, `${name}: magmaDiag null off the volcanic path`).toBeNull();
    }
  });

  it('the volcanic path threads the driver tune end-to-end (byte-identical to the driver-responsive writer)', () => {
    // (M10 REPURPOSED, PRESET_ARCHETYPE-retirement) the old bridge property — bodyDrivers=null → tune null → #4a
    // byte-identical — was a condition-LESS artifact. Post-flip the volcanic path is DRIVER-RESPONSIVE (like shell,
    // V2-5s): a condition-bearing Lava carries a NON-null magma tune. This anchors the end-to-end dispatch → the
    // driver-responsive writeMagmatismSphere call (the volcanic analog of shell-multiply call-site-1). Writer-level
    // byte-identity at MAGMA_REF (tune null) is still owned by AC1 above, untouched.
    const lavaFp = DRIVER_PRESETS['Lava (hot airless)'];
    const lavaNeutral = buildNeutralBodyDrivers(deriveUniforms(lavaFp, 1.0), lavaFp);
    const lavaTune = magmaDriversToTune(lavaNeutral);
    expect(lavaTune, 'Lava sits off MAGMA_REF → non-null tune').not.toBeNull();
    for (const s of SEEDS) {
      const cVia = carrierOf();
      const via = relief(cVia, condBundle('Lava (hot airless)', { macroSeed: s, T_eq: 950 }));
      expect(via.path).toBe('volcanic');
      expect(via.magmaDiag.appliedTune, `seed ${s}: appliedTune threads the Lava driver tune`).toEqual(lavaTune);
      const cBase = carrierOf();
      writeMagmatismSphere(cBase, lavaNeutral, { macroSeed: s, locked: true, T_ss: 950 * 1.4, tune: lavaTune });
      expect(Array.from(cVia.height), `seed ${s}: volcanic dispatch == driver-responsive writer`).toEqual(Array.from(cBase.height));
    }
  });

  it('the volcanic path with real (off-REF) drivers routes to volcanic and applies a non-null tune', () => {
    const b = condBundle('Lava (hot airless)', { macroSeed: 1, T_eq: 2000 });   // M11
    b.bodyDrivers = { ...b.bodyDrivers, ...MAGMA_DRIVERS };
    const r = relief(carrierOf(), b);
    expect(r.path).toBe('volcanic');
    expect(r.magmaDiag.appliedTune, 'appliedTune non-null with real drivers').not.toBeNull();
  });
});

// ── geometry helpers (arm's-length: rebuilt from published diag fields, not the writer's internals) ───
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const geoDist = (d, t) => Math.acos(Math.max(-1, Math.min(1, dot3(d, t))));
function unitBearing(d, top) { const dp = dot3(d, top); const b = [d[0] - dp * top[0], d[1] - dp * top[1], d[2] - dp * top[2]]; const l = Math.hypot(b[0], b[1], b[2]) || 1; return [b[0] / l, b[1] / l, b[2] / l]; }
// Per-plume edifice-footprint aspect ratio + major-axis alignment to the seeded grainAxis, via 2x2 PCA of the
// (along, cross) tangent coordinates. Returns null when the plume has < 6 edifice nodes (PCA too sparse).
function plumeAspect(c, diag, p) {
  const verts = c.verts, top = verts[diag.hotspotNode[p]], ax = diag.grainAxis[p], perp = cross3(top, ax);
  const xs = [], ys = [];
  for (let i = 0; i < c.N; i++) {
    if (diag.edificeMask[i] && diag.nearestPlume[i] === p) {
      const b = unitBearing(verts[i], top), psi = geoDist(verts[i], top);
      xs.push(psi * dot3(b, ax)); ys.push(psi * dot3(b, perp));
    }
  }
  const n = xs.length; if (n < 6) return null;
  let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; } mx /= n; my /= n;
  let sxx = 0, syy = 0, sxy = 0; for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  sxx /= n; syy /= n; sxy /= n;
  const tr = sxx + syy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - (sxx * syy - sxy * sxy)));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc; if (l2 <= 1e-12) return null;
  const vx = sxy, vy = l1 - sxx, vl = Math.hypot(vx, vy) || 1;      // major eigenvector in (along=x, cross=y) frame
  return { aspect: Math.sqrt(l1 / l2), alignAlong: Math.abs(vx / vl), n };  // alignAlong→1 ⇒ major axis ∥ grainAxis
}
const meanAspect = (c, diag) => { const a = []; for (let p = 0; p < diag.plumeCount; p++) { const r = plumeAspect(c, diag, p); if (r) a.push(r); } return a.length ? { aspect: a.reduce((s, r) => s + r.aspect, 0) / a.length, align: a.reduce((s, r) => s + r.alignAlong, 0) / a.length, plumes: a.length } : null; };
// corr^2(U, sin^2 latY) and corr^2(U, arm's-length centroid-proximity), both over non-basin nodes.
function varExplained(c, diag) {
  const verts = c.verts, N = c.N, U = diag.U, BELT = 0.10;
  const latY = new Float64Array(N), pred = new Float64Array(N);
  for (let i = 0; i < N; i++) { const y = Math.max(-1, Math.min(1, verts[i][1])); latY[i] = y * y; let best = -Infinity; for (let p = 0; p < diag.centroids.length; p++) { const dd = dot3(verts[i], diag.centroids[p]); if (dd > best) best = dd; } pred[i] = Math.exp(-Math.acos(Math.max(-1, Math.min(1, best))) / BELT); }
  const corr = (a) => { let n = 0, mu = 0, mv = 0; for (let i = 0; i < N; i++) { if (diag.magmaOceanMask[i]) continue; mu += U[i]; mv += a[i]; n++; } mu /= n; mv /= n; let cvr = 0, vu = 0, va = 0; for (let i = 0; i < N; i++) { if (diag.magmaOceanMask[i]) continue; const du = U[i] - mu, da = a[i] - mv; cvr += du * da; vu += du * du; va += da * da; } const r = cvr / (Math.sqrt(vu * va) || 1); return r * r; };
  return { latY: corr(latY), plume: corr(pred) };
}

// ── AC3 — grain anisotropy PASSES (elongated + grain-aligned), latitude control FAILS (multi-seed) ────
describe('#4-MULTIPLY AC3 — grain-aligned edifices, not latitude', () => {
  // The discriminator is the DELTA from the reference (elongation adds real anisotropy ALIGNED to grainAxis),
  // NOT an absolute aspect≈1 at the reference — discrete Delaunay sampling + province-wall clipping give the
  // isotropic footprint a measured aspect ~1.15-1.36 with RANDOM axis (align 0.36-0.90). Elongation lifts
  // aspect to ~1.5-1.9 and pins the major axis to grainAxis (align 0.85-0.99). Thresholds set from the diag.
  it('at high thermal drive edifices are elongated ALONG the seeded grain axis, beyond the isotropic baseline', () => {
    const H_REF = magmaThermal(MAGMA_REF);
    for (const s of SEEDS) {
      const cHi = carrierOf();
      const dHi = writeMagmatismSphere(cHi, { thermalState: 0.8 }, { macroSeed: s, locked: false, tune: magmaDriversToTune({ thermalState: 0.8 }) });
      const hi = meanAspect(cHi, dHi);
      const cRef = carrierOf();
      const dRef = writeMagmatismSphere(cRef, { thermalState: H_REF }, { macroSeed: s, locked: false, tune: magmaDriversToTune({ thermalState: H_REF }) });
      const ref = meanAspect(cRef, dRef);
      expect(hi, `seed ${s}: enough edifice nodes for PCA`).not.toBeNull();
      expect(ref, `seed ${s}: reference PCA`).not.toBeNull();
      expect(dRef.elongation, `seed ${s}: reference E==1 (isotropic)`).toBe(1);
      expect(dHi.elongation, `seed ${s}: high-thermal E>1`).toBeGreaterThan(1);
      expect(hi.aspect, `seed ${s}: edifices elongated (aspect>1.35)`).toBeGreaterThan(1.35);
      expect(hi.align, `seed ${s}: elongation grain-aligned (align>0.75)`).toBeGreaterThan(0.75);
      // the delta cancels the fixed sampling-noise baseline: elongation adds real, grain-aligned anisotropy.
      expect(hi.aspect - ref.aspect, `seed ${s}: aspect lifted above the isotropic baseline`).toBeGreaterThan(0.2);
      expect(hi.align, `seed ${s}: high-thermal axis more grain-aligned than the random reference`).toBeGreaterThan(ref.align);
    }
  });

  it('the latitude falsifier holds for EVERY seed: varByLatitudeY < 0.15 AND < varByPlume', () => {
    for (const s of SEEDS) for (const L of LOCKS) {
      const c = carrierOf();
      const T_ss = L ? 2800 : 0;
      const diag = writeMagmatismSphere(c, { thermalState: 0.8 }, { macroSeed: s, locked: L, T_ss, tune: magmaDriversToTune({ thermalState: 0.8 }) });
      const v = varExplained(c, diag);
      expect(v.latY, `seed ${s} locked ${L}: varByLatitudeY < 0.15`).toBeLessThan(0.15);
      expect(v.latY, `seed ${s} locked ${L}: latitude < plume`).toBeLessThan(v.plume);
    }
  });
});

// ── AC4 — #4a elevation ordering preserved under elongation + the driver sweep ────────────────────────
describe('#4-MULTIPLY AC4 — ordering preserved under sweep', () => {
  it('mean(edifice) > mean(lava-plain) > mean(basin) holds across the thermal sweep and both body-cases', () => {
    const H_REF = magmaThermal(MAGMA_REF);
    for (const H of [H_REF, 0.5, 0.8]) for (const L of LOCKS) {
      const T_ss = L ? 2800 : 0;
      for (const s of SEEDS) {
        const c = carrierOf();
        const d = writeMagmatismSphere(c, { thermalState: H }, { macroSeed: s, locked: L, T_ss, tune: magmaDriversToTune({ thermalState: H }) });
        const mean = (mask) => { let sm = 0, n = 0; for (let i = 0; i < c.N; i++) if (mask[i]) { sm += d.U[i]; n++; } return n ? sm / n : null; };
        const mEd = mean(d.edificeMask), mPl = mean(d.lavaPlainMask), mBa = mean(d.magmaOceanMask);
        const tag = `H ${H} locked ${L} seed ${s}`;
        if (mEd != null && mPl != null) expect(mEd, `${tag}: edifice>plain`).toBeGreaterThan(mPl);
        if (mPl != null && mBa != null) expect(mPl, `${tag}: plain>basin`).toBeGreaterThan(mBa);
      }
    }
  });
});
