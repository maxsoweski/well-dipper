// SCOPING PROBE — does the volatile fix ALONE open the plate path, or does the `locked`
// gate (report Block B) still bind? Counterfactual: assume every temperate body were wet.
import { StarSystemGenerator } from '/home/ax/projects/well-dipper/src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '/home/ax/projects/well-dipper/src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '/home/ax/projects/well-dipper/src/worldengine/base/e1Regime.js';

const B = { MASS_LO: 0.6, MASS_HI: 1.6, T_LO: 250, T_HI: 320 };
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
        rad: c.radiusEarth ?? 1, grav: c.surfaceGravity ?? 1,
        locked: !!c.tidalState?.locked,
        mag: c.magnetosphere?.strength ?? c.magnetosphere ?? null,
        age: c.age ?? null });
    };
    push(d, 'planet');
    for (const m of (e.moons || [])) push(m.isPlanetMoon ? { ...m.planetData, _systemSeed: m._systemSeed, _ordinal: 'pm' } : m, 'moon');
  }
}
const okM = r => r.mass >= B.MASS_LO && r.mass <= B.MASS_HI;
const okT = r => r.T >= B.T_LO && r.T <= B.T_HI;
const n = rows.length;
console.log(`${N} seeds -> ${n} solid bodies\n`);
const mt = rows.filter(r => okM(r) && okT(r));
console.log(`mass-band AND temperate: ${mt.length}`);
console.log(`  of them UNLOCKED: ${mt.filter(r => !r.locked).length}   <- the only ones the volatile fix alone could hand to plate()`);
console.log(`  of them locked  : ${mt.filter(r => r.locked).length}`);
console.log(`  planets ${mt.filter(r=>r.kind==='planet').length} / moons ${mt.filter(r=>r.kind==='moon').length}`);
console.log('\nthe mass-band+temperate bodies, one row each:');
for (const r of mt) console.log(`  ${r.kind.padEnd(6)} M ${r.mass.toFixed(3)}  R ${r.rad.toFixed(3)}  T ${r.T.toFixed(0)}K  V ${r.V.toFixed(4)}  locked=${r.locked}  age ${r.age}`);

// How many bodies are temperate at ALL, and how many of those are unlocked planets?
const temp = rows.filter(okT);
console.log(`\ntemperate (any mass): ${temp.length}  · unlocked ${temp.filter(r=>!r.locked).length}  · unlocked planets ${temp.filter(r=>!r.locked&&r.kind==='planet').length}`);
// mass distribution of temperate unlocked
const tm = temp.filter(r=>!r.locked).map(r=>r.mass).sort((a,b)=>a-b);
if (tm.length) console.log(`  their mass: min ${tm[0].toFixed(3)} · median ${tm[Math.floor(tm.length/2)].toFixed(3)} · p95 ${tm[Math.floor(tm.length*0.95)].toFixed(3)} · max ${tm[tm.length-1].toFixed(3)}`);
console.log('\nmagnetosphere sample (first temperate row):', JSON.stringify(temp[0]?.mag));
