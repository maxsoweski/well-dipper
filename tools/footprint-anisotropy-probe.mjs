// tools/footprint-anisotropy-probe.mjs — 2026-08-26.
// Max, flying the lab: "I still see a diamond-shaped point where the higher LOD suddenly appears;
// it doesn't blend properly."  This locates that diamond in the arithmetic, with no rendering.
//
// SUBJECT: src/worldengine/shaders/planetShaders.glsl.js:256 and src/worldengine/shaders/height.glsl.js:3065
//   float fwBase = max(max(fwidth(vPos.x), fwidth(vPos.y)), fwidth(vPos.z));
// fwidth(p) == abs(dFdx(p)) + abs(dFdy(p)), so this is an L-INFINITY norm over the three OBJECT-SPACE
// axes of an L1 norm over the two screen axes. It is the ONLY input to the octave clamp, so every
// octave switches on/off along ITS iso-contours.
const D = 4.0;          // camera distance in body radii
const N = 41;           // sample grid across the disc
const EPS = 1e-4;

// ray -> unit sphere at origin, camera at (0,0,D) looking down -z; screen coords in tan-space
function hit(sx, sy) {
  const o = [0, 0, D], dir = [sx, sy, -1];
  const L = Math.hypot(...dir); const u = dir.map(v => v / L);
  const b = 2 * (o[0]*u[0] + o[1]*u[1] + o[2]*u[2]);
  const c = D*D - 1;
  const disc = b*b - 4*c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / 2;
  return [o[0]+u[0]*t, o[1]+u[1]*t, o[2]+u[2]*t];
}
const measures = (sx, sy) => {
  const P = hit(sx, sy), Px = hit(sx+EPS, sy), Py = hit(sx, sy+EPS);
  if (!P || !Px || !Py) return null;
  const dx = P.map((v,i) => (Px[i]-v)/EPS), dy = P.map((v,i) => (Py[i]-v)/EPS);
  // WHAT SHIPS: L-infinity over object axes of (L1 over screen axes)
  const linf = Math.max(...[0,1,2].map(i => Math.abs(dx[i]) + Math.abs(dy[i])));
  // CANDIDATE 2: the OpenGL mip-selection scale factor rho (GL spec 8.14.1).
  // ⛔ STILL A max(), SO IT STILL CREASES — just along screen axes instead of object axes.
  const rho = Math.max(Math.hypot(...dx), Math.hypot(...dy));
  // CANDIDATE 3: the side of the equivalent SQUARE footprint = sqrt of the parallelogram AREA.
  // ⭐ Area is invariant under rotation of the screen axes, and there is no max() to crease.
  const cr = [dx[1]*dy[2]-dx[2]*dy[1], dx[2]*dy[0]-dx[0]*dy[2], dx[0]*dy[1]-dx[1]*dy[0]];
  const area = Math.sqrt(Math.hypot(...cr));
  return { linf, rho, area, argmax: [0,1,2].map(i => Math.abs(dx[i]) + Math.abs(dy[i])).indexOf(linf) };
};

const lim = Math.sin(Math.asin(1 / D)) * 1.02 * D / Math.sqrt(D*D-1) * Math.sqrt(D*D-1) / D * 1.25;
console.log('='.repeat(84));
console.log('A — WHICH OBJECT AXIS WINS THE max(), across the visible disc  (camera at %s radii)', D);
console.log('='.repeat(84));
console.log('Each cell prints the axis the max() selects: x, y or z. ⭐ A BOUNDARY BETWEEN LETTERS IS A');
console.log('CREASE — the measure is continuous but its DERIVATIVE jumps, so the octave clamp changes');
console.log('slope there. Those boundaries are the diamond.\n');
for (let j = N - 1; j >= 0; j--) {
  let row = '  ';
  for (let i = 0; i < N; i++) {
    const sx = (i/(N-1)*2-1)*lim, sy = (j/(N-1)*2-1)*lim;
    const m = measures(sx, sy);
    row += m ? 'xyz'[m.argmax] : ' ';
  }
  console.log(row);
}

let lo = Infinity, hi = -Infinity;
const ratios = [];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const sx = (i/(N-1)*2-1)*lim, sy = (j/(N-1)*2-1)*lim;
  const m = measures(sx, sy); if (!m) continue;
  const r = m.linf / m.rho; ratios.push(r); lo = Math.min(lo, r); hi = Math.max(hi, r);
}
console.log('\n' + '='.repeat(84));
console.log('B — HOW MUCH THE SHIPPED MEASURE VARIES WITH DIRECTION ALONE');
console.log('='.repeat(84));
console.log(`  shipped L-inf / isotropic rho:  min ${lo.toFixed(4)}   max ${hi.toFixed(4)}   spread ${(hi/lo).toFixed(3)}x`);
console.log(`  ⭐ ${( (hi/lo-1)*100 ).toFixed(1)}% swing in the CLAMP'S ONLY INPUT from viewing direction alone, on a`);
console.log('     perfect sphere with no terrain. An octave crosses the fade threshold at different');
console.log('     DISTANCES depending on which way it faces — so the transition is a SHAPE on the body,');
console.log('     not a ring, and it is locked to object space, so it rides the planet as it rotates.');
console.log('\n  The fade band is smoothstep(0.4, 0.8) — a 2.00x window. A ' + (hi/lo).toFixed(2) +
            'x directional swing is a large');
console.log('  fraction of that window, which is why the boundary reads as a hard edge rather than a blend.');

console.log('\n' + '='.repeat(84));
console.log('C — ⭐ THE DECISIVE TEST: AT CONSTANT DISC RADIUS, AN ISOTROPIC MEASURE MUST BE CONSTANT');
console.log('='.repeat(84));
console.log('Walk a full circle at a fixed distance from the disc centre. Foreshortening depends only on');
console.log('that distance, so ANY variation around the circle is pure artifact.\n');
console.log('   ring    OLD max-of-fwidth    rho = max(len dFdx, len dFdy)    sqrt(footprint AREA)');
const limb = Math.asin(1 / D);
for (const frac of [0.25, 0.50, 0.75, 0.90]) {
  const r = Math.tan(limb) * frac;
  const sw = (k) => { let a = Infinity, b = -Infinity;
    for (let d = 0; d < 360; d += 3) { const th = d * Math.PI/180;
      const m = measures(r*Math.cos(th), r*Math.sin(th)); if (!m) continue;
      a = Math.min(a, m[k]); b = Math.max(b, m[k]); }
    return (b/a - 1) * 100; };
  console.log(`   ${String(frac).padEnd(6)}  ${(sw('linf').toFixed(1)+' %').padStart(17)}   ${(sw('rho').toFixed(1)+' %').padStart(29)}   ${(sw('area').toFixed(4)+' %').padStart(20)}`);
}
console.log('\n⭐ Only the AREA measure is flat around the ring. Both max() forms vary around a circle they');
console.log('   have no physical reason to vary around, and that variation is the visible artifact:');
console.log('   max-of-fwidth creases along OBJECT axes (a diamond that rides the planet as it turns),');
console.log('   rho creases along SCREEN axes (a 4-fold pattern locked to the viewport).');
console.log('\n⚠ WHAT THIS DOES NOT FIX: each octave still switches over a 2x-wide window, so a transition');
console.log('   can still read as a soft RING on approach — but a ring is a function of distance alone,');
console.log('   which is what an LOD boundary is allowed to be. Widening that window is a separate knob.');
