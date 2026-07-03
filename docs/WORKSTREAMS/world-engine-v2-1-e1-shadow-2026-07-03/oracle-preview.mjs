// oracle-preview.mjs — V2-1 E1 AC3 conformance-oracle preview (design-only, no repo mutation).
// The AC3 counterpart to phi-calib.mjs: empirically computes writerUnder(e1) vs writerUnder(archetype)
// across the 15 PRESET_ARCHETYPE presets and PINS the actual writer-equal / writer-divergent set + count,
// so Slice C is coded against a proven tally (not the contract's un-previewed 13/2-with-Neptunian guess).
//
// writer_today  = the REAL dispatch classification. It imports the pure headless regime resolvers
//   shellRegimeOf + stagnantLidRegimeOf VERBATIM from the base modules and inlines the two trivial
//   one-line predicates isEarthlikePlatePath / isVolcanicPath (planet-lod-rivers.js:409-437) — that file
//   itself imports three, so a `node` script can't load it; the Slice-C vitest oracle DOES compose the
//   exported predicates from planet-lod-rivers.js directly (reuse-not-reimplement). Same dispatch ORDER
//   (plate → shell → volcanic → stagnant-lid → despun), so writer_today here == the vitest oracle's.
// writer_e1     = the pinned E1 regime-based predictor (§4.4 compositionClass + §4.5 edges/seeded band,
//   §Slice C subtractive gate). In-band rocky bodies are collapsed to their MODAL (argmax-weight) regime
//   → deterministic, seed-free (must-fix #3): the seeded variation is AC5's domain, not AC3's.
// Re-run: node docs/WORKSTREAMS/world-engine-v2-1-e1-shadow-2026-07-03/oracle-preview.mjs
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '/home/ax/projects/well-dipper/driver-presets.js';
import { shellRegimeOf } from '/home/ax/projects/well-dipper/src/worldengine/base/shellRelief.js';
import { stagnantLidRegimeOf } from '/home/ax/projects/well-dipper/src/worldengine/base/stagnantLid.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ── shared physical helpers (verbatim from baseStep.js:20,28-33; identical to phi-calib.mjs) ──
const surfaceGravity = (fp) => (fp.massEarth ?? 1.0) / Math.pow(fp.radiusEarth ?? 1.0, 2);
const ioRef = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
function rawTidal(fp) {
  if (fp.tidalHeat != null) return fp.tidalHeat;
  const ecc = fp.eccentricity ?? 0, star = fp.starMassEarth ?? 332946;
  const R = fp.radiusEarth ?? 1.0, orbit = fp.orbitRadiusEarth ?? 23455;
  return orbit > 0 ? (ecc * ecc * star * star * Math.pow(R, 5) / Math.pow(orbit, 5)) / ioRef : 0;
}
// gate-1 L (constants verbatim from gate-1-L-lidstrength-form-DESIGN.md §Decision; == phi-calib.mjs)
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

// ═══ writer_today — the REAL 5-way dispatch (planet-lod-rivers.js:454-496 order) ═══
// isEarthlikePlatePath (:409): locked → false; else terrestrial|ocean. isVolcanicPath (:434): lava|volcanic.
const isEarthlikePlatePath = (arch, locked) => !locked && (arch === 'terrestrial' || arch === 'ocean');
const isVolcanicPath = (arch) => (arch === 'lava' || arch === 'volcanic');
function writerToday(name) {
  const arch = PRESET_ARCHETYPE[name];
  const locked = !!DRIVER_PRESETS[name].tidalState?.locked;
  if (isEarthlikePlatePath(arch, locked)) return 'plate';
  if (shellRegimeOf(arch, locked) !== null) return 'shell';
  if (isVolcanicPath(arch)) return 'volcanic';
  if (stagnantLidRegimeOf(arch, locked) !== null) return 'stagnant-lid';
  return 'despun';
}

// ═══ writer_e1 — the pinned E1 regime-based predictor ═══
const HEATPIPE_PEG = 0.45, L_STRONG = 0.63;
const ACTIVE_TIDAL = 0.5;            // rawTidalIoRatio above which an icy shell is tidally ACTIVE (Europa)
const METH_LO = 85, METH_HI = 120;   // methane-window band (volatile-cold hydrology: Titan keep; Frozen drop)
// §4.4 compositionClass (verbatim). NB: reads atmosphere.composition — same field phi-calib's classHint reads.
function compositionClass(fp) {
  if (fp.atmosphere && fp.atmosphere.composition === 'h2-he') return 'gas';
  if ((fp.composition?.carbonToOxygen ?? 0) > 1) return 'carbon';
  return smoothstep(2.5, 3.9, fp.composition?.density ?? 5.5) < 0.5 ? 'icy' : 'rocky';
}
// modal (argmax) regime for an in-band body — the deterministic seed-free collapse the AC3 oracle uses.
function modalRegime(V, T) {
  const w = { mobile: 0.45, episodic: 0.25, stagnant: 0.30 };
  w.mobile = Math.max(0, w.mobile + 1.2 * (V - 0.25));
  w.stagnant = Math.max(0, w.stagnant + 0.30 * (T - 285) / 70);
  w.episodic = Math.max(0, 1 - w.mobile - w.stagnant);
  let best = 'mobile', bv = -1;
  for (const k of ['mobile', 'episodic', 'stagnant']) if (w[k] > bv) { bv = w[k]; best = k; }
  return best;
}
function writerE1(fp) {
  const cls = compositionClass(fp);
  if (cls === 'gas' || cls === 'carbon') return 'despun';   // Stage-A terminals → off-pilot
  const T = fp.T_eq ?? 280, V = fp.composition?.volatileFraction ?? 0.15, rt = rawTidal(fp);
  if (cls === 'icy') {
    const activeTidal = rt > ACTIVE_TIDAL;
    const methaneVolatile = V >= 0.12 && T >= METH_LO && T <= METH_HI;
    return (activeTidal || methaneVolatile) ? 'shell' : 'despun';   // 'icy' regime → shell ; else dead-lid → despun
  }
  // rocky
  if (rt - HEATPIPE_PEG > 0) return 'volcanic';                 // m_hp > 0 → heat-pipe volcanic
  const mass = surfaceGravity(fp) * Math.pow(fp.radiusEarth ?? 1.0, 2);   // massEarth = g·R² (must-fix #1)
  const inBand = mass >= 0.6 && mass <= 1.6 && T >= 250 && T <= 320 && V >= 0.12;
  if (inBand) {
    const modal = modalRegime(V, T);
    return modal === 'stagnant' ? 'stagnant-lid' : 'plate';    // mobile/episodic → plate (dominant anchor)
  }
  const L = computeL(fp);
  if (L >= L_STRONG) return 'stagnant-lid';
  if (L < 0.35) return 'plate';
  return 'stagnant-lid';                                        // mixed → strong-lid dominant anchor
}

// ── run over the 15 archetype-mapped presets (Mars + Hot Jupiter excluded: no PRESET_ARCHETYPE) ──
const rows = [];
for (const name of Object.keys(DRIVER_PRESETS)) {
  if (!(name in PRESET_ARCHETYPE)) continue;
  const fp = DRIVER_PRESETS[name];
  const today = writerToday(name), e1 = writerE1(fp);
  rows.push({ name, cls: compositionClass(fp), rt: rawTidal(fp), L: computeL(fp), today, e1, equal: today === e1 });
}
const f = (x, n = 3) => (x == null || Number.isNaN(x)) ? '  -  ' : x.toFixed(n);
console.log('preset'.padEnd(28), 'cls'.padStart(7), 'rawTidal'.padStart(10), 'L'.padStart(6), 'today'.padStart(13), 'e1'.padStart(13), '  verdict');
for (const r of rows)
  console.log(r.name.padEnd(28), r.cls.padStart(7), f(r.rt, 3).padStart(10), f(r.L).padStart(6),
    r.today.padStart(13), r.e1.padStart(13), r.equal ? '  EQUAL' : '  >>> DIVERGENT');

const equal = rows.filter(r => r.equal), diverge = rows.filter(r => !r.equal);
console.log(`\n── tally: ${equal.length} writer-equal + ${diverge.length} writer-divergent (of ${rows.length}) ──`);
console.log('   divergent set:', diverge.map(r => `${r.name} [today ${r.today} → e1 ${r.e1}]`).join('; ') || '(none)');
// Neptunian/Sub-Neptune are a PRESET_ARCHETYPE key-collision NOTE, not a writer divergence — prove writer-equal:
const nep = writerToday('Ice giant (Neptunian)'), sub = writerToday('Sub-Neptune (hazy)');
const nepE1 = writerE1(DRIVER_PRESETS['Ice giant (Neptunian)']), subE1 = writerE1(DRIVER_PRESETS['Sub-Neptune (hazy)']);
console.log('\n── Neptunian/Sub-Neptune key-collision is writer-EQUAL (a taxonomy NOTE, not a divergence) ──');
console.log(`   Neptunian: today=${nep} e1=${nepE1} ; Sub-Neptune: today=${sub} e1=${subE1}  → both despun both ways: ${nep===nepE1&&sub===subE1&&nep==='despun'&&sub==='despun'}`);
