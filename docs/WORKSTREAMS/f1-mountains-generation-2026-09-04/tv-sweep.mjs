// Is "no temperate WET world" a fact about the 24-seed corpus, or about the GENERATOR?
// Widen to 200 seeds and measure the temperate x wet intersection directly.
import { StarSystemGenerator } from '/home/ax/projects/well-dipper/src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '/home/ax/projects/well-dipper/src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '/home/ax/projects/well-dipper/src/worldengine/base/e1Regime.js';

const B = { MASS_LO: 0.6, MASS_HI: 1.6, T_LO: 250, T_HI: 320, V_MIN: 0.12 };
const N = Number(process.env.NSEEDS || 200);
const rows = [];
for (let i = 0; i < N; i++) {
  const sys = StarSystemGenerator.generate(`rocky-${i}`, null);
  for (const e of sys.planets) {
    const d = e.planetData || e;
    const push = (dd, kind) => {
      const c = conditionFromBody(dd);
      if (compositionClass(c) === 'gas') return;
      rows.push({ kind,
        mass: (c.surfaceGravity ?? 1) * Math.pow(c.radiusEarth ?? 1, 2),
        T: c.T_eq ?? 288, V: c.composition?.volatileFraction ?? 0.15,
        locked: !!c.tidalState?.locked });
    };
    push(d, 'planet');
    for (const m of (e.moons || [])) push(m.isPlanetMoon ? { ...m.planetData, _systemSeed: m._systemSeed, _ordinal: 'pm' } : m, 'moon');
  }
}
const okM = (r) => r.mass >= B.MASS_LO && r.mass <= B.MASS_HI;
const okT = (r) => r.T >= B.T_LO && r.T <= B.T_HI;
const okV = (r) => r.V >= B.V_MIN;
const n = rows.length;
const pc = (x) => `${x} (${(100*x/n).toFixed(2)}%)`;
console.log(`${N} seeds -> ${n} solid bodies (${rows.filter(r=>r.kind==='planet').length} planets / ${rows.filter(r=>r.kind==='moon').length} moons)\n`);
console.log('THE SEEDED BAND (mass 0.6-1.6 M⊕, T 250-320 K, V >= 0.12) — a body needs ALL THREE:');
console.log('  mass       :', pc(rows.filter(okM).length));
console.log('  temperate  :', pc(rows.filter(okT).length));
console.log('  wet        :', pc(rows.filter(okV).length));
console.log('  mass & T   :', pc(rows.filter(r=>okM(r)&&okT(r)).length));
console.log('  mass & V   :', pc(rows.filter(r=>okM(r)&&okV(r)).length));
console.log('  ⭐ T & V    :', pc(rows.filter(r=>okT(r)&&okV(r)).length));
console.log('  ALL THREE  :', pc(rows.filter(r=>okM(r)&&okT(r)&&okV(r)).length));
const unlockedBand = rows.filter(r=>okM(r)&&okT(r)&&okV(r)&&!r.locked);
console.log('  ALL THREE and NOT locked (the only bodies that could reach plate()):', unlockedBand.length);

console.log('\nWHY: what do TEMPERATE bodies have for volatiles, and what temperature do WET bodies sit at?');
const temp = rows.filter(okT), wet = rows.filter(okV);
const q = (a, f) => { const s = a.map(f).sort((x,y)=>x-y); return s.length ? `min ${s[0].toFixed(4)} · median ${s[Math.floor(s.length/2)].toFixed(4)} · p95 ${s[Math.floor(s.length*0.95)].toFixed(4)} · max ${s[s.length-1].toFixed(4)}` : '(none)'; };
console.log(`  temperate bodies (${temp.length}) — volatileFraction: ${q(temp, r=>r.V)}`);
console.log(`     of them, V >= ${B.V_MIN}: ${temp.filter(okV).length}`);
console.log(`  wet bodies (${wet.length}) — T_eq: ${q(wet, r=>r.T)}`);
console.log(`     of them, temperate: ${wet.filter(okT).length}`);
const near = rows.filter(okM).filter(okT).sort((a,b)=>b.V-a.V).slice(0,5);
console.log('\nCLOSEST MISSES (mass + temperate, ranked by volatiles):');
for (const r of near) console.log(`  M ${r.mass.toFixed(3)}  T ${r.T.toFixed(1)}  V ${r.V.toFixed(4)}  (needs ${B.V_MIN})  locked=${r.locked}`);
console.log('\nlocked share:', pc(rows.filter(r=>r.locked).length), '— the gate ABOVE the band test');
console.log('  locked planets:', rows.filter(r=>r.kind==='planet'&&r.locked).length, 'of', rows.filter(r=>r.kind==='planet').length);
console.log('  locked moons  :', rows.filter(r=>r.kind==='moon'&&r.locked).length, 'of', rows.filter(r=>r.kind==='moon').length);
