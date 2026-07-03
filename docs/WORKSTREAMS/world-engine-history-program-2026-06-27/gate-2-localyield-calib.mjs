// ═══════════════════════════════════════════════════════════════════════════
// Gate-2 localYield(L,i) calibration harness — DESIGN-ONLY (no repo mutation).
// Discharges ROADMAP v2.1 §7b row 2 (the per-center pierce threshold; the anti-mush lynchpin).
// Run FROM REPO ROOT:  node docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-2-localyield-calib.mjs
//
// Imports ONLY the zero-dep DRIVER_PRESETS by absolute path + alea (for the seeded
// per-center draws). Reimplements the pure gate-1 L helpers verbatim so it runs anywhere.
// Determinism: every draw via alea(seedString) in the NEW 'lid:' namespace (disjoint from
// 'magma:'/'stagnant:'); fixed draw order; NO Math.random / NO Date.now.
// ═══════════════════════════════════════════════════════════════════════════
import { DRIVER_PRESETS } from '/home/ax/projects/well-dipper/driver-presets.js';
import alea from 'alea';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ─── gate-1 L (lidStrength), verbatim from gate-1-L-calib.mjs ───
function surfaceGravity(fp){ const m = fp.massEarth ?? 1.0, r = fp.radiusEarth ?? 1.0; return m/(r*r); }
const ioRef = (0.0041*0.0041)*(317.8*317.8)*Math.pow(0.286,5)/Math.pow(66,5);
function rawTidal(fp){ const ecc = fp.eccentricity ?? 0; const star = fp.starMassEarth ?? 332946;
  const R = fp.radiusEarth ?? 1.0; const orbit = fp.orbitRadiusEarth ?? 23455;
  if (fp.tidalHeat != null) return fp.tidalHeat;
  return orbit>0 ? (ecc*ecc*star*star*Math.pow(R,5)/Math.pow(orbit,5))/ioRef : 0; }
function ageNorm(fp){ return clamp01((fp.age ?? 4.5)/10); }
const LP = { Z_BASE:0.15,Z_COLD:0.55,Z_AGE:0.25,T_ZLO:200,T_ZHI:320,T_MELT_LO:1100,T_MELT_HI:1500,
  MU_DRY:0.55,MU_HEAT:0.65,T_ALO:300,T_AHI:750,V_LO:0.05,V_HI:0.20,
  W_Z:0.55,W_MU:0.75,G_EXP:0.15,GMOD_LO:0.90,GMOD_HI:1.12,RHOG_REF:5.5*0.9,K_L:0.82 };
function computeL(fp, o={}){
  const T=o.T_surf??fp.T_eq??280, V=o.V??fp.composition?.volatileFraction??0.15,
    rho=o.rho??fp.composition?.density??5.5, g=o.g??surfaceGravity(fp), aN=o.ageNorm??ageNorm(fp);
  const meltFactor=1-smoothstep(LP.T_MELT_LO,LP.T_MELT_HI,T);
  const coldness=1-smoothstep(LP.T_ZLO,LP.T_ZHI,T);
  const z=clamp01(LP.Z_BASE+LP.Z_COLD*coldness+LP.Z_AGE*aN)*meltFactor;
  const anneal=smoothstep(LP.T_ALO,LP.T_AHI,T);
  const dryness=1-smoothstep(LP.V_LO,LP.V_HI,V);
  const muProxy=clamp01(LP.MU_DRY*dryness+LP.MU_HEAT*anneal)*meltFactor;
  const gMod=clamp(LP.GMOD_LO,LP.GMOD_HI,Math.pow((rho*g)/LP.RHOG_REF,LP.G_EXP));
  return clamp01(LP.K_L*(LP.W_Z*z+LP.W_MU*muProxy)*gMod);
}

// ─── PROVISIONAL Φ (delegable #4 default; gate-4 owns the real form) ───
// Φ = sqrt(radiogenic·(C_MASS·mass + C_SIZE·d³)) + C_TIDAL·rawTidal
//   sqrt COMPRESSES the raw internal-vigor range (Mars sits ~6× below Venus raw → ~2.6× after sqrt)
//   so the pierce boolean is well-conditioned (see brief §PHI DEPENDENCE / gate-2↔gate-4 coupling).
//   d = radiusEarth is a PROVISIONAL mantle-depth proxy (gate-4 refines to a labeled d-transform).
const PHI = { C_MASS:0.5, C_SIZE:0.5, C_TIDAL:10, HEATPIPE_PEG:0.45 };
function computePhi(fp, o={}){
  const aN = o.ageNorm ?? ageNorm(fp);
  const radiogenic = 1 - aN;
  const mass = o.mass ?? fp.massEarth ?? 1.0;
  const d = o.d ?? fp.radiusEarth ?? 1.0;
  const vig = radiogenic * (PHI.C_MASS*mass + PHI.C_SIZE*d*d*d);
  const rt = o.rawTidal ?? rawTidal(fp);
  const scale = o.phiScale ?? 1.0;   // ±30% sensitivity multiplier on the INTERNAL vigor
  return Math.sqrt(Math.max(0,vig))*scale + PHI.C_TIDAL*rt;
}

// ─── GATE-2 pinned form ───
const G2 = {
  STR_LO: 0.30,            // per-center strength floor: strength_p = STR_LO+(1-STR_LO)·u_p, u_p~U(0,1)  [lid:strength]
  SPREAD: 0.30,            // per-center yield spread: localYield_p = Ybase(L)·(1+SPREAD·(2·y_p-1))       [lid:yield]
  Y0: 0.001759, Y_K: 8.78, // Ybase(L) = Y0·exp(Y_K·L)  (yield-stress-like exponential; no dimensional τ_y)
                           //   ⇒ Ybase(0.55)=0.22, Ybase(0.728)=1.05 (kills Venus), Ybase(0.16)=0.0072 (wet-stag→pervasive)
  N_MIN:3, N_MAX:11, N_BASE:4, N_PHI:4, N_L:2,   // n = clamp(N_MIN,N_MAX, round(N_BASE + N_PHI·min(Φ,1.2) + N_L·(1-L)))
};
const Ybase = (L) => G2.Y0*Math.exp(G2.Y_K*clamp01(L));
const nCount = (L,phi) => clamp(G2.N_MIN,G2.N_MAX, Math.round(G2.N_BASE + G2.N_PHI*Math.min(phi,1.2) + G2.N_L*(1-clamp01(L))));

// One seeded body realization: draw n centers' strength (lid:strength) + yield (lid:yield), apply the boolean.
function realize(L, phi, seed, nOverride=null){
  const n = nOverride ?? nCount(L,phi);
  const rs = alea('lid:strength:'+seed);   // disjoint 'lid:' stream #1
  const ry = alea('lid:yield:'+seed);      // disjoint 'lid:' stream #2
  const yb = Ybase(L);
  let pierced = 0;
  for(let p=0;p<n;p++){
    const strength = G2.STR_LO + (1-G2.STR_LO)*rs();   // per-center plume vigor (index order)
    const localYield = yb*(1 + G2.SPREAD*(2*ry()-1));  // per-center lid yield (index order)
    if (strength*phi > localYield) pierced++;          // SHARP boolean: strength_p·Φ > localYield(L,p)
  }
  return { n, pierced };
}
function mc(L, phi, seeds=400, nOverride=null){
  let sumFrac=0,sumN=0,sumP=0,a1=0,o13=0,ge4=0; const hist={};
  for(let s=1;s<=seeds;s++){
    const {n,pierced}=realize(L,phi,s,nOverride);
    sumFrac+=pierced/n; sumN+=n; sumP+=pierced;
    if(pierced>=1)a1++; if(pierced>=1&&pierced<=3)o13++; if(pierced>=4)ge4++;
    hist[pierced]=(hist[pierced]||0)+1;
  }
  return { L,phi,nMean:sumN/seeds,pierceMean:sumP/seeds,frac:sumFrac/seeds,
    pAtLeast1:a1/seeds,pOneToThree:o13/seeds,pGe4:ge4/seeds,hist };
}
const f3=(x)=>x.toFixed(3), pd=(s,w)=>String(s).padStart(w);

// ═══ 1. Per-preset (provisional Φ, router disposition) ═══
console.log('═══ 1. PER-PRESET pierce behaviour (Monte-Carlo, 400 seeds) ═══');
console.log(pd('preset',26),pd('L',6),pd('Φ',9),pd('n̄',5),pd('piercē',8),pd('frac',6),pd('P≥1',6),pd('P1-3',6),'  disposition');
for(const name of Object.keys(DRIVER_PRESETS)){
  const fp=DRIVER_PRESETS[name]; const L=computeL(fp),phi=computePhi(fp),rt=rawTidal(fp);
  const comp=fp.composition??{}; const gassy=fp.atmosphere&&fp.atmosphere.composition==='h2-he';
  const carbon=(comp.carbonToOxygen??0)>1; const rocky=smoothstep(2.5,3.9,comp.density??5.5)>=0.5;
  let disp; if(gassy)disp='gas terminal (pre-L)'; else if(carbon)disp='carbon terminal (pre-L)';
    else if(!rocky)disp='icy/volatile sib (pre-L)'; else if(rt>PHI.HEATPIPE_PEG)disp='m_hp→PURE-WEAK';
    else if(L>=0.63)disp='≥L_STRONG→PURE-STRONG'; else if(L<0.35)disp='<0.35→mobile/plates'; else disp='★ MIXED (localYield runs)';
  const r=mc(L,phi);
  console.log(pd(name,26),pd(L.toFixed(3),6),pd(phi.toExponential(2),9),pd(r.nMean.toFixed(1),5),
    pd(r.pierceMean.toFixed(2),8),pd(f3(r.frac),6),pd(f3(r.pAtLeast1),6),pd(f3(r.pOneToThree),6),'  '+disp);
}

// ═══ 2. Anchor worlds (the falsification / checkpoint targets) ═══
console.log('\n═══ 2. ANCHOR WORLDS ═══');
const anchors = {
  'Venus corner (0.728,Φ0.69)'      : {L:0.728, phi:computePhi(DRIVER_PRESETS['Venus (sulfuric shroud)'])},
  'Mars/Tharsis (0.551,Φ0.27)'      : {L:0.551, phi:computePhi(DRIVER_PRESETS['Mars (arid rocky)'])},
  'hand-set colder-Tharsis (0.575,Φ0.24)':{L:0.575, phi:0.24},
  'Corona-pierced compound (0.60,Φ0.42)':{L:0.60, phi:0.42},
  'Wet-stagnant seeded (0.157,Φ0.72)':{L:0.157, phi:0.72},
};
console.log(pd('world',36),pd('n̄',5),pd('piercē',8),pd('frac',6),pd('P≥1',6),pd('P1-3',6),pd('P≥4',6),' hist{pierced:count/400}');
for(const [nm,c] of Object.entries(anchors)){
  const r=mc(c.L,c.phi);
  const hs=Object.entries(r.hist).sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' ');
  console.log(pd(nm,36),pd(r.nMean.toFixed(1),5),pd(r.pierceMean.toFixed(2),8),pd(f3(r.frac),6),
    pd(f3(r.pAtLeast1),6),pd(f3(r.pOneToThree),6),pd(f3(r.pGe4),6),' '+hs);
}

// ═══ 3. Response surface: pierce fraction over (L,Φ) ═══
console.log('\n═══ 3. pierce-fraction surface over (L,Φ) ═══');
const phis=[0.15,0.22,0.30,0.42,0.55,0.72,0.90,1.10];
process.stdout.write('  L\\Φ '); phis.forEach(p=>process.stdout.write(pd(p.toFixed(2),7))); console.log();
for(let L=0.15;L<=0.75;L+=0.05){ process.stdout.write(pd(L.toFixed(2),5)+' ');
  for(const phi of phis) process.stdout.write(pd(f3(mc(L,phi,200).frac),7)); console.log(); }

// ═══ 4. Corona-pierced band: EXACTLY-1-to-few pierce (mean pierce∈[1,3] AND P(1-3)≥0.5) ═══
console.log('\n═══ 4. CORONA-PIERCED band (few-pierce: piercē∈[1,3] & P(1-3)≥0.5) ═══');
let cells=0,band=0;
for(const phi of [0.20,0.30,0.42,0.55,0.72]){
  let lo=null,hi=null;
  for(let L=0.10;L<=0.80;L+=0.0025){ const r=mc(L,phi,300);
    if(r.pierceMean>=1&&r.pierceMean<=3&&r.pOneToThree>=0.5){ if(lo===null)lo=L; hi=L; } }
  console.log('  Φ='+phi.toFixed(2), lo!==null?`L∈[${lo.toFixed(3)},${hi.toFixed(3)}]  width ${(hi-lo).toFixed(3)}`:'(none)');
}
// 2-D reachability: fraction of the mixed rectangle L∈[0.35,0.63]×Φ∈[0.15,0.9] giving few-pierce
for(let L=0.35;L<=0.63;L+=0.02) for(let phi=0.15;phi<=0.9;phi+=0.05){ cells++;
  const r=mc(L,phi,150); if(r.pierceMean>=1&&r.pierceMean<=3&&r.pOneToThree>=0.5)band++; }
console.log(`  2-D reachability: ${band}/${cells} = ${(100*band/cells).toFixed(0)}% of the mixed (L,Φ) rectangle is few-pierce`);

// ═══ 5. m_hp seam continuity: hot MIXED body (few-pierce at 0 tidal), sweep rawTidal 0→peg ═══
// Body: L=0.58 (mixed, weak-ish lid), Φ_internal=0.25 (few-pierce at rawTidal=0). Φ = 0.25 + C_TIDAL·rawTidal.
// SHOULDER: to avoid a routing cliff, a would-be pure-strong body (L≥0.63) with rawTidal≥SHOULDER_LO must
// route MIXED (not pure-strong) so its tidal-boosted Φ ramps pierce smoothly into the heat-pipe corner.
const SHOULDER_LO = 0.15;
console.log('\n═══ 5. m_hp SEAM continuity (hot MIXED body L=0.58, Φ_int=0.25, sweep rawTidal→peg 0.45) ═══');
console.log('  rawTidal   Φ     frac   note');
for(const rt of [0,0.05,0.10,0.15,0.20,0.30,0.40,0.449,0.45,0.46]){
  const phi = 0.25 + PHI.C_TIDAL*rt;
  const routed = rt>PHI.HEATPIPE_PEG;
  const r=mc(0.58,phi,200);
  console.log('  '+pd(rt.toFixed(3),8),pd(phi.toFixed(2),6),pd(f3(routed?1.0:r.frac),7),
    ' '+(routed?'m_hp→PURE-WEAK (magmatism, pervasive)':(rt>=SHOULDER_LO?'mixed (tidal-shoulder → forced MIXED)':'mixed pierce')));
}

// ═══ 6. Φ ±30% SENSITIVITY on the ordering conclusions ═══
console.log('\n═══ 6. Φ ±30% SENSITIVITY (internal-vigor scale ×{0.7,1.0,1.3}) ═══');
console.log(pd('world',30),pd('Φ×0.7',18),pd('Φ×1.0',18),pd('Φ×1.3',18),'  (piercē | P1-3)');
const sens = {
  'Venus corner (L0.728)': {L:0.728, fp:'Venus (sulfuric shroud)'},
  'Mars/Tharsis (L0.551)': {L:0.551, fp:'Mars (arid rocky)'},
  'Compound (L0.60)'      : {L:0.60, phi0:0.42},
  'Wet-stagnant (L0.157)' : {L:0.157, phi0:0.72},
};
for(const [nm,c] of Object.entries(sens)){
  const cells=[0.7,1.0,1.3].map(sc=>{
    const phi = c.fp ? computePhi(DRIVER_PRESETS[c.fp],{phiScale:sc}) : c.phi0*sc;
    const r=mc(c.L,phi,300); return `${r.pierceMean.toFixed(2)}|${f3(r.pOneToThree)}`;
  });
  console.log(pd(nm,30),pd(cells[0],18),pd(cells[1],18),pd(cells[2],18));
}

// ═══ 7. Ordering assertions ═══
console.log('\n═══ 7. REQUIRED ORDERINGS ═══');
const V=mc(0.728,computePhi(DRIVER_PRESETS['Venus (sulfuric shroud)']));
const M=mc(0.551,computePhi(DRIVER_PRESETS['Mars (arid rocky)']));
const C=mc(0.60,0.42), Wg=mc(0.157,0.72);
const checks=[
  ['Venus almost-never pierces: P(≥1)<0.05', V.pAtLeast1<0.05],
  ['Mars/Tharsis pierces 1-3 (P(1-3)≥0.5)', M.pOneToThree>=0.5],
  ['Mars mean pierce in [0.8,3] (few, not zero, not pervasive)', M.pierceMean>=0.8&&M.pierceMean<=3],
  ['Compound is minority pierce (frac∈[0.10,0.40])', C.frac>=0.10&&C.frac<=0.40],
  ['Compound P(1-3) high (≥0.4)', C.pOneToThree>=0.4],
  ['Wet-stagnant pierces MORE than Venus (differentiated)', Wg.frac>V.frac+0.3],
  ['Mars pierces MORE than Venus (weaker lid, few plumes still punch)', M.pierceMean>V.pierceMean],
];
for(const [d,ok] of checks) console.log('  '+(ok?'PASS':'FAIL'), d);

// ═══ 8. RAW-Φ COUNTERFACTUAL — is compression a CORRECTNESS necessity or a band-WIDTH preference? ═══
// Claim under test (brief §2 / PG-2): "at the raw ~6× vigor separation no smooth low-order Ybase(L)
// can give Venus ~0 AND Mars a few pierce." We falsify it: feed raw-LINEAR Φ (full ratio, no sqrt),
// re-fit k, and show Venus 0.000 / Mars few-pierce STILL hold — with narrower but FINITE bands.
console.log('\n═══ 8. RAW-Φ COUNTERFACTUAL (compression = legibility preference, not correctness) ═══');
const vigRaw = (fp)=>{ const rad=1-ageNorm(fp); const m=fp.massEarth??1, d=fp.radiusEarth??1; return rad*(PHI.C_MASS*m+PHI.C_SIZE*d*d*d); };
const vM=vigRaw(DRIVER_PRESETS['Mars (arid rocky)']), vV=vigRaw(DRIVER_PRESETS['Venus (sulfuric shroud)']);
console.log(`  raw vigor: Mars ${vM.toFixed(4)} · Venus ${vV.toFixed(4)} → ratio ${(vV/vM).toFixed(2)}× (RAW)  vs  sqrt-compressed ${(Math.sqrt(vV)/Math.sqrt(vM)).toFixed(2)}×`);
console.log(`  n reads COMPRESSED Φ (min(Φ,1.2)): Mars n=${nCount(0.551,0.268)} Venus n=${nCount(0.728,0.690)}  |  under RAW vigor: Mars n=${nCount(0.551,vM)} Venus n=${nCount(0.728,vV)}  → n does NOT carry the Mars/Venus pierce split`);
// raw-linear Φ: anchor Mars at its compressed operating point 0.268, restore the full 6.54× ratio → Venus 1.75
const phiM_raw=0.268, phiV_raw=0.268*(vV/vM);
// generic MC with explicit (Y0,k) so we can re-fit the exponential against raw Φ
function mcK(L,phi,Y0,k,seeds=400){ const yb=Y0*Math.exp(k*clamp01(L)); const n=nCount(L,phi); let sp=0,o13=0;
  for(let s=1;s<=seeds;s++){ const rs=alea('lid:strength:'+s),ry=alea('lid:yield:'+s); let pc=0;
    for(let p=0;p<n;p++){ const st=G2.STR_LO+(1-G2.STR_LO)*rs(); const ly=yb*(1+G2.SPREAD*(2*ry()-1)); if(st*phi>ly)pc++; }
    sp+=pc; if(pc>=1&&pc<=3)o13++; } return {pierceMean:sp/seeds,pOneToThree:o13/seeds}; }
const bandWidth=(Y0,k)=>{ let lo=null,hi=null; for(let L=0.10;L<=0.95;L+=0.0025){ const r=mcK(L,0.268,Y0,k,300);
  if(r.pierceMean>=1&&r.pierceMean<=3&&r.pOneToThree>=0.5){ if(lo===null)lo=L; hi=L; } } return lo!==null?{lo,hi,w:hi-lo}:null; };
console.log(`  raw-linear Φ: Mars ${phiM_raw.toFixed(3)} · Venus ${phiV_raw.toFixed(2)} (full ${(vV/vM).toFixed(2)}× ratio, no sqrt)`);
console.log('    k     Y0        Mars piercē|P1-3    Venus piercē   few-pierce band on L @Φ=0.268');
for(const k of [10,12,14,16]){
  const Y0=phiV_raw/(1-G2.SPREAD)/Math.exp(k*0.728);   // fit Y0 so Venus (L0.728) is just-suppressed
  const M2=mcK(0.551,phiM_raw,Y0,k), V2=mcK(0.728,phiV_raw,Y0,k), bw=bandWidth(Y0,k);
  console.log('   '+pd(k,3),pd(Y0.toExponential(2),9),'  '+pd(M2.pierceMean.toFixed(2)+'|'+f3(M2.pOneToThree),13),
    pd(f3(V2.pierceMean),8), bw?`  L∈[${bw.lo.toFixed(3)},${bw.hi.toFixed(3)}] width ${bw.w.toFixed(3)}`:'  (none)');
}
const bwC=bandWidth(G2.Y0,G2.Y_K);
console.log(`  COMPRESSED baseline (Y_K=${G2.Y_K}) band @Φ=0.268: L∈[${bwC.lo.toFixed(3)},${bwC.hi.toFixed(3)}] width ${bwC.w.toFixed(3)}`);
console.log('  ⇒ raw Φ is RE-DERIVABLE (k≈14: Venus 0.000, Mars few-pierce, band ~0.025); compression only WIDENS the band.');
