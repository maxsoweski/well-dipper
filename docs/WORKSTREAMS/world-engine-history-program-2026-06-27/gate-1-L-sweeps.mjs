// Gate-1 sweeps: prove (1) L(T_surf) non-monotonic from two MONOTONIC sub-mechanisms,
// (2) wet->mobile V response, (3) g-plumbing-gap graceful degradation (density-only gMod).
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const P = { Z_BASE:0.15, Z_COLD:0.55, Z_AGE:0.25, T_ZLO:200, T_ZHI:320, T_MELT_LO:1100, T_MELT_HI:1500,
  MU_DRY:0.55, MU_HEAT:0.65, T_ALO:300, T_AHI:750, V_LO:0.05, V_HI:0.20, W_Z:0.55, W_MU:0.75,
  G_EXP:0.15, GMOD_LO:0.90, GMOD_HI:1.12, RHOG_REF:5.5*0.9, K_L:0.82 };
function L(T,V,rho,g,aN,{gModMode='rhog'}={}){
  const melt = 1 - smoothstep(P.T_MELT_LO,P.T_MELT_HI,T);
  const coldness = 1 - smoothstep(P.T_ZLO,P.T_ZHI,T);
  const z = clamp01(P.Z_BASE + P.Z_COLD*coldness + P.Z_AGE*aN)*melt;
  const anneal = smoothstep(P.T_ALO,P.T_AHI,T);
  const dryness = 1 - smoothstep(P.V_LO,P.V_HI,V);
  const hotDry = clamp01(P.MU_DRY*dryness + P.MU_HEAT*anneal)*melt;   // muProxy (dryness standalone + anneal)
  const gMod = gModMode==='rhog' ? clamp(P.GMOD_LO,P.GMOD_HI,Math.pow((rho*g)/P.RHOG_REF,P.G_EXP))
             : clamp(P.GMOD_LO,P.GMOD_HI,Math.pow(rho/5.5,P.G_EXP));   // density-only fallback (g deferred)
  return { L: clamp01(P.K_L*(P.W_Z*z + P.W_MU*hotDry)*gMod), z, hotDry };
}
console.log('── (1) L(T_surf) sweep @ V=0.10 (Mars-dry), rho=4.5, g=0.7, ageNorm=0.45 — the FORK curve ──');
console.log('Tsurf'.padStart(6), 'z(cold-mech)'.padStart(12), 'hotDry(hot-mech)'.padStart(16), 'L'.padStart(7));
for (const T of [60,150,210,250,288,350,450,550,650,737,850,950,1100,1300,1500,2000]){
  const r = L(T,0.10,4.5,0.7,0.45); console.log(String(T).padStart(6), r.z.toFixed(3).padStart(12), r.hotDry.toFixed(3).padStart(16), r.L.toFixed(3).padStart(7));
}
// monotonicity assertions on the two sub-mechanisms across the sweep
let zPrev=Infinity, hdPrev=-Infinity, zMono=true, hdMono=true;
for (const T of [60,150,210,250,288,350,450,550,650,737,850,950]){ // below solidus (melt=1) so pure T-response
  const r=L(T,0.10,4.5,0.7,0.45); if (r.z> zPrev+1e-9) zMono=false; if (r.hotDry< hdPrev-1e-9) hdMono=false; zPrev=r.z; hdPrev=r.hotDry;
}
console.log(`  z monotone DECREASING in T (below solidus): ${zMono?'YES':'NO'};  hotDry monotone INCREASING in T: ${hdMono?'YES':'NO'}`);

console.log('\n── (2) V (dryness) sweep @ T=290 (temperate), rho=5.5, g=0.9 — wet->mobile ──');
for (const V of [0.0,0.02,0.05,0.10,0.15,0.20,0.25,0.30,0.40,0.50]){ const r=L(290,V,5.5,0.9,0.45); console.log('  V=',V.toFixed(2),' L=',r.L.toFixed(3)); }
console.log('  (temperate band: anneal~0 so hotDry~0 regardless of V; V bites via mu at higher T — see (2b))');
console.log('\n── (2b) V sweep @ T=650 (warm, annealing active) — dryness now load-bearing ──');
for (const V of [0.02,0.10,0.20,0.30,0.40]){ const r=L(650,V,5.5,0.9,0.45); console.log('  V=',V.toFixed(2),' L=',r.L.toFixed(3),' hotDry=',r.hotDry.toFixed(3)); }

console.log('\n── (3) g-plumbing-gap graceful degradation: rhog vs density-only gMod on the 6 pilot-relevant bodies ──');
const bodies = [['Venus',737,0.02,5.24,0.903,0.45],['Mars',210,0.10,3.93,0.381,0.45],['Earth',288,0.15,5.5,0.90,0.45],
  ['Ocean',295,0.35,5.0,1.074,0.30],['Lava',950,0.02,7.0,0.802,0.45],['Magma',2000,0.0,8.0,2.22,0.45]];
console.log('body'.padEnd(7),'L(rhog)'.padStart(8),'L(dens-only)'.padStart(13),'Δ'.padStart(7));
for (const [n,T,V,rho,g,aN] of bodies){ const a=L(T,V,rho,g,aN,{gModMode:'rhog'}).L, b=L(T,V,rho,g,aN,{gModMode:'dens'}).L;
  console.log(n.padEnd(7), a.toFixed(3).padStart(8), b.toFixed(3).padStart(13), (b-a).toFixed(3).padStart(7)); }
