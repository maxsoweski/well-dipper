// THE SCALE SEAM, measured: the world engine anchors Earth at volatileFraction 0.15 in THREE places;
// what does the generator actually hand it?
import { StarSystemGenerator } from '/home/ax/projects/well-dipper/src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '/home/ax/projects/well-dipper/src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '/home/ax/projects/well-dipper/src/worldengine/base/e1Regime.js';
import { shelfWidthFactor, MARGIN_VF0 } from '/home/ax/projects/well-dipper/src/worldengine/base/passiveMargins.js';

const ss = (a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const N = Number(process.env.NSEEDS || 200);
const rows = [];
for (let i = 0; i < N; i++) {
  const sys = StarSystemGenerator.generate(`rocky-${i}`, null);
  for (const e of sys.planets) {
    const d = e.planetData || e;
    const push = (dd) => { const c = conditionFromBody(dd); if (compositionClass(c)==='gas') return;
      rows.push({ V: c.composition?.volatileFraction ?? 0.15, T: c.T_eq ?? 288 }); };
    push(d); for (const m of (e.moons||[])) push(m.isPlanetMoon ? {...m.planetData,_systemSeed:m._systemSeed,_ordinal:'pm'} : m);
  }
}
const temperate = rows.filter(r => r.T >= 250 && r.T <= 320);
const pc = (x,of) => `${x}/${of} (${(100*x/of).toFixed(1)}%)`;

console.log(`${N} seeds -> ${rows.length} solid bodies · ${temperate.length} temperate (250-320 K)\n`);
console.log('THE WORLD ENGINE\'S OWN SCALE FOR THIS FIELD, from its source:');
console.log(`  passiveMargins.js:54  "anchored to 1.0 at Earth's volatile fraction (D_EARTH.volatileFraction = 0.15)" — MARGIN_VF0 = ${MARGIN_VF0}`);
console.log('  labCore.js:693        volatileGate = smoothstep(0.05, 0.2, V)   "D2 — bone-dry floor at 0.05"');
console.log('  driver-presets.js     "Rocky (Earthlike)" volatileFraction = 0.15\n');

console.log('WHAT THE GENERATOR HANDS IT — every solid body, through labCore\'s own volatileGate:');
const bucket = (set, label) => {
  const g = set.map(r => ss(0.05, 0.2, r.V));
  const dry = g.filter(x => x <= 0.0).length;
  const near = g.filter(x => x > 0 && x < 0.25).length;
  const mid = g.filter(x => x >= 0.25 && x < 0.75).length;
  const wet = g.filter(x => x >= 0.75).length;
  console.log(`  ${label}`);
  console.log(`     volatileGate == 0  (at or under the bone-dry floor) : ${pc(dry, set.length)}`);
  console.log(`     0 < gate < 0.25    (essentially dry)                : ${pc(near, set.length)}`);
  console.log(`     0.25 <= gate < 0.75                                 : ${pc(mid, set.length)}`);
  console.log(`     gate >= 0.75       (the engine reads this as wet)   : ${pc(wet, set.length)}`);
};
bucket(rows, `ALL SOLID (${rows.length})`);
bucket(temperate, `TEMPERATE ONLY (${temperate.length})`);

console.log('\nAND THE SHELF-WIDTH ANCHOR (1.0 == Earth):');
const sw = temperate.map(r => shelfWidthFactor(r.V)).sort((a,b)=>a-b);
console.log(`  temperate bodies' shelfWidthFactor: min ${sw[0].toFixed(3)} · median ${sw[Math.floor(sw.length/2)].toFixed(3)} · max ${sw[sw.length-1].toFixed(3)}`);
console.log(`  (the floor is ${0.3}; Earth is 1.0 — so every temperate world is pinned at the NARROWEST shelf the model allows)`);
console.log(`  temperate bodies at or below the floor: ${pc(sw.filter(x=>x<=0.3+1e-9).length, sw.length)}`);
