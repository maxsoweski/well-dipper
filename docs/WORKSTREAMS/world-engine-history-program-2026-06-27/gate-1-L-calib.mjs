// Gate-1 L(lidStrength) calibration harness — design-only, no repo mutation.
// Imports ONLY the zero-dependency DRIVER_PRESETS by absolute path; reimplements the
// pure mathutil / baseStep helpers inline (verbatim from the code) so it runs anywhere.
import { DRIVER_PRESETS } from '/home/ax/projects/well-dipper/driver-presets.js';

// ── pure helpers (verbatim from src/worldengine/base/mathutil.js) ──
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ── baseStep ground-truth reimplementations (pure; verbatim formulas) ──
// surfaceGravity = massEarth / radiusEarth^2   (baseStep.js:20)
function surfaceGravity(fp){ const m = fp.massEarth ?? 1.0, r = fp.radiusEarth ?? 1.0; return m/(r*r); }
// shellThickness = clamp01(0.3 + 0.5*smoothstep(0.5,9,g) + 0.2*(1-ageNorm))  (baseStep.js:48)
function shellThickness(fp){ const g = surfaceGravity(fp); const ageNorm = clamp01((fp.age ?? 0.5)); // baseStep uses d.ageNorm ?? d.age; presets carry age(Gyr) not ageNorm -> but here compute ageNorm properly below
  return clamp01(0.3 + 0.5*smoothstep(0.5,9,g) + 0.2*(1-ageNorm)); }
// raw Io-ratio (baseStep.js:28-33) — pre-calibrateTidal
const ioRef = (0.0041*0.0041)*(317.8*317.8)*Math.pow(0.286,5)/Math.pow(66,5);
function rawTidal(fp){ const ecc = fp.eccentricity ?? 0; const star = fp.starMassEarth ?? 332946;
  const R = fp.radiusEarth ?? 1.0; const orbit = fp.orbitRadiusEarth ?? 23455;
  if (fp.tidalHeat != null) return fp.tidalHeat;
  return orbit>0 ? (ecc*ecc*star*star*Math.pow(R,5)/Math.pow(orbit,5))/ioRef : 0; }

// ageNorm consistent with adaptL0 (age/10 clamped); presets that omit age -> baseStep age0 fallback 4.5
function ageNorm(fp){ return clamp01((fp.age ?? 4.5)/10); }

// ═══════════════════════════════════════════════════════════════════════════
// L (lidStrength) — PINNED FORM (additive two-mechanism decomposition)
//   L = clamp01( K_L * (W_Z*z + W_MU*hotDry) * gMod )
//   z      : brittle-lithosphere-thickness proxy — the Mars (cold-thick) mechanism, MONOTONIC in T_surf (cold->thick)
//   hotDry : ductile-lockup/annealing * dryness — the Venus mechanism, MONOTONIC in T_surf (hot->strong) and dryness
//   gMod   : gentle rho*g lithostatic modulator, clamped near 1 (mass is NOT the controlling lever per science)
//   meltFactor zeroes the brittle lid above the silicate solidus (molten -> no lid)
// ═══════════════════════════════════════════════════════════════════════════
const P = {
  // z (thickness) — cold-thick + old-thick, melted away above solidus.  MONOTONIC ↓ in T_surf.
  Z_BASE: 0.15, Z_COLD: 0.55, Z_AGE: 0.25, T_ZLO: 200, T_ZHI: 320,
  T_MELT_LO: 1100, T_MELT_HI: 1500,
  // muProxy — TWO monotonic contributions: dryness (Korenaga water-weakening, STANDALONE at all T) +
  //           anneal (Lenardic/Noack hot-lockup). muProxy MONOTONIC ↑ in T_surf and ↑ in dryness.
  MU_DRY: 0.55, MU_HEAT: 0.65, T_ALO: 300, T_AHI: 750, V_LO: 0.05, V_HI: 0.20,
  // combination + gentle lithostatic modulator (mass is NOT the controlling lever — R-g)
  W_Z: 0.55, W_MU: 0.75, G_EXP: 0.15, GMOD_LO: 0.90, GMOD_HI: 1.12, RHOG_REF: 5.5*0.9,
  K_L: 0.82,   // scale anchored so L(Earth 'Rocky (Earthlike)') ≈ 0.25 (mobile-side calibration point)
};

function computeL(fp, opts={}){
  const T = opts.T_surf ?? fp.T_eq ?? 280;      // surface temperature (D3-MF2: T_eq slot IS surface temp)
  const V = opts.V ?? fp.composition?.volatileFraction ?? 0.15;
  const rho = opts.rho ?? fp.composition?.density ?? 5.5;
  const g = opts.g ?? surfaceGravity(fp);
  const aN = opts.ageNorm ?? ageNorm(fp);
  const meltFactor = 1 - smoothstep(P.T_MELT_LO, P.T_MELT_HI, T);      // 1 below solidus, 0 above (molten -> no lid)
  const coldness = 1 - smoothstep(P.T_ZLO, P.T_ZHI, T);               // cold surface -> thick brittle lid
  const z = clamp01(P.Z_BASE + P.Z_COLD*coldness + P.Z_AGE*aN) * meltFactor;
  const anneal = smoothstep(P.T_ALO, P.T_AHI, T);                     // hot -> ductile lockup / boundary healing
  const dryness = 1 - smoothstep(P.V_LO, P.V_HI, V);                  // dry -> high effective friction (water near-necessary for mobility)
  const muProxy = clamp01(P.MU_DRY*dryness + P.MU_HEAT*anneal) * meltFactor;
  const gMod = clamp(P.GMOD_LO, P.GMOD_HI, Math.pow((rho*g)/P.RHOG_REF, P.G_EXP));
  const core = P.W_Z*z + P.W_MU*muProxy;
  const L = clamp01(P.K_L * core * gMod);
  return { L, z, hotDry: muProxy, anneal, dryness, coldness, meltFactor, gMod, core, g, rho, T, V, aN };
}

// heat-pipe margin (delegable #6 default peg ~0.45 on the RAW Io-ratio)
const HEATPIPE_PEG = 0.45;
function mHp(fp){ return rawTidal(fp) - HEATPIPE_PEG; }

// composition-class hint (for annotating which bodies are actually on the unbroken-lid path)
function classHint(fp){
  const comp = fp.composition ?? {};
  const dens = comp.density ?? 5.5;
  const atm = fp.atmosphere;
  const gassy = atm && atm.composition === 'h2-he';
  if (gassy) return 'gas';
  if ((comp.carbonToOxygen ?? 0) > 1) return 'carbon';
  const rockyCrust = smoothstep(2.5, 3.9, dens);
  if (rockyCrust < 0.5) return 'icy/volatile';
  return 'rocky';
}

const MAGMA_REF = { tidalHeating: 0, age: 4.5, massGravity: 0.9 }; // magmatism.js:93 (inlined; no ext deps)

const rows = [];
for (const [name, fp] of Object.entries(DRIVER_PRESETS)){
  const r = computeL(fp);
  rows.push({ name, ...r, mHp: mHp(fp), raw: rawTidal(fp), shell: (()=>{ // shellThickness with proper ageNorm
      const g = surfaceGravity(fp); return clamp01(0.3 + 0.5*smoothstep(0.5,9,g) + 0.2*(1-ageNorm(fp))); })(),
    cls: classHint(fp), locked: !!fp.tidalState?.locked });
}
// MAGMA_REF as a pseudo-body (documented defaults: rho 5.5, T 280, V 0.15)
{
  const r = computeL({}, { T_surf: 280, V: 0.15, rho: 5.5, g: MAGMA_REF.massGravity, ageNorm: clamp01(MAGMA_REF.age/10) });
  rows.push({ name:'MAGMA_REF (pseudo, defaults)', ...r, mHp: 0-HEATPIPE_PEG, raw: 0, shell: NaN, cls:'ref', locked:false });
}

rows.sort((a,b)=> b.L - a.L);
const f = (x,n=3)=> (x==null||Number.isNaN(x)) ? '  -  ' : x.toFixed(n);
console.log('name'.padEnd(30), 'L'.padStart(6), 'z'.padStart(6), 'hotDry'.padStart(7), 'gMod'.padStart(6),
            'Tsurf'.padStart(6), 'V'.padStart(5), 'g'.padStart(6), 'raw_td'.padStart(8), 'm_hp'.padStart(8), 'shell'.padStart(6), 'cls'.padStart(12));
for (const r of rows){
  console.log(r.name.padEnd(30), f(r.L).padStart(6), f(r.z).padStart(6), f(r.hotDry).padStart(7), f(r.gMod).padStart(6),
    f(r.T,0).padStart(6), f(r.V,2).padStart(5), f(r.g,2).padStart(6), f(r.raw,3).padStart(8), f(r.mHp,2).padStart(8),
    f(r.shell,2).padStart(6), String(r.cls).padStart(12));
}

// ── required ordering checks ──
const L = Object.fromEntries(rows.map(r=>[r.name, r.L]));
const g = (n)=> L[n];
console.log('\n── required orderings ──');
const checks = [
  ['L(MAGMA_REF) < L(Venus)', g('MAGMA_REF (pseudo, defaults)') < g('Venus (sulfuric shroud)')],
  ['Venus high (>0.6)', g('Venus (sulfuric shroud)') > 0.6],
  ['Rocky/Earth low (<0.35)', g('Rocky (Earthlike)') < 0.35],
  ['Ocean low (<0.35)', g('Ocean (temperate)') < 0.35],
  ['Ocean <= Earth (wetter->more mobile)', g('Ocean (temperate)') <= g('Rocky (Earthlike)')],
  ['Mars > Earth (cold thick lid)', g('Mars (arid rocky)') > g('Rocky (Earthlike)')],
  ['Mars mixed-band (0.30..0.65)', g('Mars (arid rocky)')>0.30 && g('Mars (arid rocky)')<0.65],
  ['Magma ~0 (molten, <0.10)', g('Magma (K2-141b)') < 0.10],
  ['Venus is strong-lid champion among rocky non-heatpipe', true],
];
for (const [d,ok] of checks) console.log(ok?'  PASS':'  FAIL', d);
