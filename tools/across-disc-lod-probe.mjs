// tools/across-disc-lod-probe.mjs — 2026-08-26.
// Max, after the isotropy fix: "It's not a diamond but the same issue persists, just now as a
// circle. I think it's also too aggressive, we're seeing it too soon. There's not a good blending
// from high LOD right in front of you, where the sphere is closest, and areas further away on the
// sphere. Also the higher lod grain that resolves seems totally unrelated to the shape of the grain
// at the lower LOD."
//
// Three separate claims. This probe measures the first two. The third is a CODE fact, in §C.
const D = Number(process.argv[2] || 4.0);
const UNS = Number(process.argv[3] || 154.86);   // Europa, arm B, as written by the lab
const EPS = 1e-5;
// ⛔ THE UNITS TRAP: dP/dsx above is per unit of TAN, not per PIXEL. It must be divided by the
// viewport's pixels-per-unit-tan or every footprint is ~900x too big and every octave reads dead.
// LAB measured live 2026-08-26: canvas 1349x844, fov 50, NO pixelScale divide.
// GAME: craterUniforms.js's stated framing, 1600x999 dpr1 / pixelScale 3.
const PX_PER_TAN = process.argv[4] === 'game'
  ? (999 / 3 / 2) / Math.tan(50 * Math.PI / 360)      // game: render target is h/pixelScale
  : (844 / 2) / Math.tan(50 * Math.PI / 360);         // lab: full canvas
const FRONT = process.argv[4] === 'game' ? 'GAME (pixelScale 3)' : 'LAB (full resolution)';

function hit(sx, sy) {
  const o = [0,0,D], dir = [sx, sy, -1], L = Math.hypot(...dir), u = dir.map(v => v/L);
  const b = 2*(o[2]*u[2]), c = D*D - 1, disc = b*b - 4*c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc))/2;
  return [u[0]*t, u[1]*t, o[2]+u[2]*t];
}
// what SHIPS as of ce0992f: sqrt of the parallelogram AREA
function footprint(sx, sy) {
  const P = hit(sx,sy), Px = hit(sx+EPS,sy), Py = hit(sx,sy+EPS);
  if (!P || !Px || !Py) return null;
  const dx = P.map((v,i)=>(Px[i]-v)/EPS), dy = P.map((v,i)=>(Py[i]-v)/EPS);
  const cr = [dx[1]*dy[2]-dx[2]*dy[1], dx[2]*dy[0]-dx[0]*dy[2], dx[0]*dy[1]-dx[1]*dy[0]];
  const s1 = Math.hypot(...dx), s2 = Math.hypot(...dy);
  return { area: Math.sqrt(Math.hypot(...cr)) / PX_PER_TAN, major: Math.max(s1,s2) / PX_PER_TAN, minor: Math.min(s1,s2) / PX_PER_TAN };
}
const clamp01 = x => Math.max(0,Math.min(1,x));
const ss = (a,b,x) => { const t = clamp01((x-a)/(b-a)); return t*t*(3-2*t); };
const aliveAt = (fw, e0, e1) => {
  let n = 0, gradTot = 0, finest = null;
  for (let i = 0; i < 9; i++) {
    const f = UNS*0.3*Math.pow(2,i);
    const w = 1 - ss(e0, e1, fw*f);
    if (w > 0.01) { n++; finest = 1/(fw*f); gradTot += 0.5*Math.pow(0.5,i)*w*f; }
  }
  return { n, finest, gradTot };
};

console.log('='.repeat(90));
console.log(`A — HOW MUCH LOD VARIES ACROSS ONE DISC  (camera ${D} radii, uNoiseScale ${UNS}, ${FRONT})`);
console.log('='.repeat(90));
console.log('"not a good blending from high LOD right in front of you ... and areas further away on the sphere"');
console.log('This is NOT about approach distance. It is one frame, centre of the disc vs out toward the limb.\n');
console.log('  across the disc   footprint   octaves alive   finest px/cycle   relief gradient total');
const limb = Math.tan(Math.asin(1/D));
for (const frac of [0.0, 0.25, 0.5, 0.7, 0.85, 0.93, 0.97]) {
  const fp = footprint(limb*frac, 0); if (!fp) continue;
  const a = aliveAt(fp.area, 0.4, 0.8);
  console.log(`  ${String(frac).padStart(15)}   ${fp.area.toExponential(2).padStart(9)}   ${String(a.n).padStart(13)}   ` +
    `${(a.finest? a.finest.toFixed(2):'—').padStart(15)}   ${a.gradTot.toFixed(1).padStart(21)}`);
}
console.log('\n⭐ Every octave lost between the centre and the limb is a RING on the body in a single frame.');
console.log('   That is what Max is seeing, and it is inherent to per-pixel LOD — but its SHARPNESS is not.');

console.log('\n' + '='.repeat(90));
console.log('B — THE TWO LEVERS ON "TOO AGGRESSIVE, TOO SOON"');
console.log('='.repeat(90));
console.log('LEVER 1 — the fade WINDOW. Shipped is smoothstep(0.4, 0.8): a 2.0x-wide ramp.\n');
console.log('  window          octaves alive at disc centre / 0.7 / 0.93     rings across the disc');
for (const [lbl, e0, e1] of [['2.0x (ships)',0.4,0.8], ['4.0x',0.2,0.8], ['8.0x',0.1,0.8], ['16.0x',0.05,0.8]]) {
  const cs = [0.0,0.7,0.93].map(f => { const fp = footprint(limb*f,0); return fp ? aliveAt(fp.area,e0,e1).n : 0; });
  console.log(`  ${lbl.padEnd(14)}  ${cs.join(' / ').padStart(42)}     ${(cs[0]-cs[2])}`);
}
console.log('\n  ⚠ A WIDER WINDOW DOES NOT REMOVE THE RINGS — it makes each octave fade over a longer');
console.log('    distance so no single one pops, but the same number of octaves is still lost by the limb.');

console.log('\nLEVER 2 — WHICH footprint. Shipped uses sqrt(AREA); the MINOR axis is what anisotropic');
console.log('texture filtering uses, and it keeps detail that an isotropic measure throws away at grazing angles.\n');
console.log('  across the disc   sqrt(area)   minor axis   anisotropy   octaves: area vs minor');
for (const frac of [0.0, 0.5, 0.85, 0.93, 0.97]) {
  const fp = footprint(limb*frac, 0); if (!fp) continue;
  console.log(`  ${String(frac).padStart(15)}   ${fp.area.toExponential(2)}   ${fp.minor.toExponential(2)}   ` +
    `${(fp.major/fp.minor).toFixed(2).padStart(10)}   ${aliveAt(fp.area,0.4,0.8).n} vs ${aliveAt(fp.minor,0.4,0.8).n}`);
}
