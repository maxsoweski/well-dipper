// phi-calib.mjs — V2-1 E1 delegable-#4 Φ (convective-vigor) calibration harness (design-only, no repo mutation).
// Pins the Φ size-aware proxy + the d mantle-depth transform (SH-F2), and PROVES R-Φsize (Φ(Mars) < Φ(Venus))
// on the real 17 DRIVER_PRESETS. Also emits n = f(Φ, 1/L) per gate-2. Reimplements pure helpers inline
// (verbatim from the code + gate briefs) so it runs anywhere. Re-run:
//   node docs/WORKSTREAMS/world-engine-v2-1-e1-shadow-2026-07-03/phi-calib.mjs
import { DRIVER_PRESETS } from '/home/ax/projects/well-dipper/driver-presets.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// surfaceGravity = massEarth / radiusEarth^2 (baseStep.js:20)
const surfaceGravity = (fp) => (fp.massEarth ?? 1.0) / Math.pow(fp.radiusEarth ?? 1.0, 2);
// raw Io-ratio (baseStep.js:28-33) — pre-calibrateTidal
const ioRef = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
function rawTidal(fp) {
  if (fp.tidalHeat != null) return fp.tidalHeat;
  const ecc = fp.eccentricity ?? 0, star = fp.starMassEarth ?? 332946;
  const R = fp.radiusEarth ?? 1.0, orbit = fp.orbitRadiusEarth ?? 23455;
  return orbit > 0 ? (ecc * ecc * star * star * Math.pow(R, 5) / Math.pow(orbit, 5)) / ioRef : 0;
}

// ── gate-1 L (needed for n = f(Φ, 1/L)); constants verbatim from gate-1-L-lidstrength-form-DESIGN.md §Decision ──
const LP = { Z_BASE:0.15, Z_COLD:0.55, Z_AGE:0.25, T_ZLO:200, T_ZHI:320, T_MELT_LO:1100, T_MELT_HI:1500,
  MU_DRY:0.55, MU_HEAT:0.65, T_ALO:300, T_AHI:750, V_LO:0.05, V_HI:0.20,
  W_Z:0.55, W_MU:0.75, G_EXP:0.15, GMOD_LO:0.90, GMOD_HI:1.12, RHOG_REF:5.5*0.9, K_L:0.82 };
function computeL(fp) {
  const T = fp.T_eq ?? 280, V = fp.composition?.volatileFraction ?? 0.15, rho = fp.composition?.density ?? 5.5;
  const g = surfaceGravity(fp), aN = clamp01((fp.age ?? 4.5) / 10);
  const meltFactor = 1 - smoothstep(LP.T_MELT_LO, LP.T_MELT_HI, T);
  const coldness = 1 - smoothstep(LP.T_ZLO, LP.T_ZHI, T);
  const z = clamp01(LP.Z_BASE + LP.Z_COLD * coldness + LP.Z_AGE * aN) * meltFactor;
  const anneal = smoothstep(LP.T_ALO, LP.T_AHI, T);
  const dryness = 1 - smoothstep(LP.V_LO, LP.V_HI, V);
  const muProxy = clamp01(LP.MU_DRY * dryness + LP.MU_HEAT * anneal) * meltFactor;
  const gMod = clamp(LP.GMOD_LO, LP.GMOD_HI, Math.pow((rho * g) / LP.RHOG_REF, LP.G_EXP));
  return clamp01(LP.K_L * (LP.W_Z * z + LP.W_MU * muProxy) * gMod);
}

// ═══ Φ (delegable #4) — PINNED size-aware convective-vigor proxy (gate-2 §2 provisional, realized) ═══
//   radiogenic = 1 − clamp01(age/10)         (old → low radiogenic budget)
//   d          = radiusEarth  ← the SH-F2 mantle-depth transform: SEPARATE from z (gate-1 brittle lid)
//                and D (icy shellThickness). Earth-relative rocky mantle depth ∝ R (mantle is a ~constant
//                fraction of the planet radius). PROVISIONAL — gate-4's fuller f(mass,gravity) is a V2-2
//                refinement (confidence MEDIUM). NEVER baseStep.shellThickness, NEVER z.
//   vigor      = radiogenic·(C_MASS·massEarth + C_SIZE·d³)      [the raw size/mass vigor]
//   Φ          = sqrt(vigor) + C_TIDAL·rawTidalIoRatio          [sqrt = the ~2–3× compression, gate-2 PG-2]
const PHI = { C_MASS: 0.5, C_SIZE: 0.5, C_TIDAL: 10 };
function computePhi(fp) {
  const age = fp.age ?? 4.5, mass = fp.massEarth ?? 1.0, d = fp.radiusEarth ?? 1.0;
  const radiogenic = 1 - clamp01(age / 10);
  const vigor = radiogenic * (PHI.C_MASS * mass + PHI.C_SIZE * d * d * d);   // RAW (un-compressed) vigor
  const phi = Math.sqrt(Math.max(0, vigor)) + PHI.C_TIDAL * rawTidal(fp);
  return { phi, vigor, radiogenic };
}

// n = f(Φ, 1/L) — gate-2 §Decision (reads the COMPRESSED Φ via min(Φ,1.2))
const NP = { N_MIN: 3, N_MAX: 11, N_BASE: 4, N_PHI: 4, N_L: 2 };
const computeN = (phi, L) => clamp(NP.N_MIN, NP.N_MAX, Math.round(NP.N_BASE + NP.N_PHI * Math.min(phi, 1.2) + NP.N_L * (1 - L)));

const HEATPIPE_PEG = 0.45;
function classHint(fp) {
  const comp = fp.composition ?? {}, dens = comp.density ?? 5.5;
  if (fp.atmosphere && fp.atmosphere.composition === 'h2-he') return 'gas';
  if ((comp.carbonToOxygen ?? 0) > 1) return 'carbon';
  return smoothstep(2.5, 3.9, dens) < 0.5 ? 'icy' : 'rocky';
}

const rows = [];
for (const [name, fp] of Object.entries(DRIVER_PRESETS)) {
  const { phi, vigor } = computePhi(fp);
  const L = computeL(fp);
  rows.push({ name, phi, vigor, L, n: computeN(phi, L), mhp: rawTidal(fp) - HEATPIPE_PEG, cls: classHint(fp) });
}
rows.sort((a, b) => b.phi - a.phi);
const f = (x, n = 3) => (x == null || Number.isNaN(x)) ? '  -  ' : x.toFixed(n);
console.log('name'.padEnd(30), 'Φ'.padStart(8), 'vigor'.padStart(8), 'L'.padStart(6), 'n'.padStart(4), 'm_hp'.padStart(10), 'cls'.padStart(8));
for (const r of rows)
  console.log(r.name.padEnd(30), f(r.phi).padStart(8), f(r.vigor).padStart(8), f(r.L).padStart(6),
    String(r.n).padStart(4), f(r.mhp, 2).padStart(10), r.cls.padStart(8));

const P = Object.fromEntries(rows.map(r => [r.name, r]));
const phiOf = (n) => P[n].phi;
console.log('\n── R-Φsize + compression checks ──');
const checks = [
  ['Φ(Mars) < Φ(Venus) [R-Φsize]', phiOf('Mars (arid rocky)') < phiOf('Venus (sulfuric shroud)')],
  ['Φ(Mars) < Φ(Ocean) [tiny-cold-old lowest of the rocky anchors]', phiOf('Mars (arid rocky)') < phiOf('Ocean (temperate)')],
  ['Venus/Mars Φ-ratio in [2,3] (gate-2 PG-2 compression)', (()=>{ const r = phiOf('Venus (sulfuric shroud)')/phiOf('Mars (arid rocky)'); return r>=2 && r<=3; })()],
  ['Venus/Mars RAW-vigor ratio > 5 (proves sqrt compresses ~6.5x→~2.5x)', P['Venus (sulfuric shroud)'].vigor / P['Mars (arid rocky)'].vigor > 5],
];
for (const [d, ok] of checks) console.log(ok ? '  PASS' : '  FAIL', d);
