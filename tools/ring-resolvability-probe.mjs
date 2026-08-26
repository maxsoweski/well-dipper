#!/usr/bin/env node
// tools/ring-resolvability-probe.mjs — do a planetary ring's radial bands survive to the screen?
//
// Max's ruling, 2026-08-26: a feature must span >= 4 RENDER px at the closest measured approach
// framing to READ as that feature. The terrain half of that ruling shipped. This probe measures the
// ring half BEFORE anything is built — the lesson the 2026-08-26 session paid for.
//
// ⛔ THE SCOPE DOC NAMED THE WRONG FILES. `resolvability-scope-2026-08-26.md` lists
// RingRenderer.js / ringConic.js / OrbitRingSDF.js. RingRenderer.js is DEAD (instantiated nowhere in
// src/, confirmed by FEATURE_AUDIT_LEGACY §2.4 and re-confirmed here); ringConic.js + OrbitRingSDF.js
// draw ORBIT rings, which already measure in render px and are OUT of scope by the doc's own
// boundary. The live planetary ring is Planet.js `_createRing` (:1764).
//
// WHAT THE LIVE SHADER EMITS (Planet.js:1851-1861), in frequency terms:
//   t    = (dist - innerRadius) / (outerRadius - innerRadius)      -- 0..1 across the annulus
//   band1 = sin(t * 30.0)   ->  30/2pi = 4.775 cycles across the WHOLE ring
//   band2 = sin(t * 12.0)   ->  12/2pi = 1.910 cycles
// One READABLE feature is one bright lobe = HALF a cycle. So px-per-feature = extent_px/(2*cycles).
// There is no fwidth, no derivative, no footprint term anywhere in the program.
//
// RUN: node tools/ring-resolvability-probe.mjs
const R = '/home/ax/projects/well-dipper/';
const { StarSystemGenerator } = await import(R + 'src/generation/StarSystemGenerator.js');

// ── render geometry, from the shipped defaults ──
const FOV_DEG = 70;                  // src/ui/Settings.js:40
const PIXEL_SCALE = 3;               // src/ui/Settings.js:12  (RetroRenderer.js:31)
const WINDOW_H = 999;                // the handoff's stated game framing: 534x333 render px
const RENDER_H = Math.round(WINDOW_H / PIXEL_SCALE);
const TAN_HALF = Math.tan((FOV_DEG * Math.PI) / 180 / 2);
// px subtended by a world-space size s at camera distance D
const pxPerWorld = (D) => RENDER_H / (2 * D * TAN_HALF);

const CYCLES_B1 = 30 / (2 * Math.PI);
const CYCLES_B2 = 12 / (2 * Math.PI);
const BAR_PX = 4;                    // Max's ruling

// ── A. the corpus ──
const rings = [];
const SYSTEMS = 60;
for (let i = 0; i < SYSTEMS; i++) {
  const sys = StarSystemGenerator.generate(`lab-procedural-${i}`, null);
  for (const e of sys.planets || []) {
    const d = e.planetData;
    if (!d?.rings) continue;
    rings.push({
      sys: i, type: d.type, radius: d.radius,
      inner: d.rings.innerRadius, outer: d.rings.outerRadius,
      opacity: d.rings.opacity,
      ringletCount: d.rings.physics?.ringlets?.length ?? 0,
      gapCount: d.rings.physics?.gaps?.length ?? 0,
    });
  }
}
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const W = rings.map(r => r.outer - r.inner);
const FRAC = rings.map(r => 1 - r.inner / r.outer);   // radial extent as a fraction of the ring's own outer radius

console.log(`=== A. THE CORPUS — ${SYSTEMS} generated systems ===`);
console.log(`ringed planets: ${rings.length}`);
console.log(`ring width (body radii)      min ${q(W,0).toFixed(2)}  med ${q(W,0.5).toFixed(2)}  max ${q(W,0.999).toFixed(2)}`);
console.log(`inner radius  (body radii)   min ${q(rings.map(r=>r.inner),0).toFixed(2)}  med ${q(rings.map(r=>r.inner),0.5).toFixed(2)}  max ${q(rings.map(r=>r.inner),0.999).toFixed(2)}`);
console.log(`outer radius  (body radii)   min ${q(rings.map(r=>r.outer),0).toFixed(2)}  med ${q(rings.map(r=>r.outer),0.5).toFixed(2)}  max ${q(rings.map(r=>r.outer),0.999).toFixed(2)}`);
console.log(`ringOpacity (alpha ceiling)  min ${q(rings.map(r=>r.opacity),0).toFixed(3)}  med ${q(rings.map(r=>r.opacity),0.5).toFixed(3)}  max ${q(rings.map(r=>r.opacity),0.999).toFixed(3)}`);
const withGaps = rings.filter(r => r.gapCount > 0).length;
const multiRinglet = rings.filter(r => r.ringletCount > 1).length;
console.log(`physics ringlets > 1: ${multiRinglet}/${rings.length}   physics gaps > 0: ${withGaps}/${rings.length}`);
console.log(`  ^ PlanetGenerator.js:566 passes moons: [] into generateRingPhysics, so resonance gaps`);
console.log(`    can never form and every generated ring is ONE ringlet. The physics path is inert.`);

// ── B. the reference framing: the closest framing at which the WHOLE ring still reads as a ring ──
// The ring's full diameter just fills the render height. Closer than this the camera is among the
// rings and there is no "ring" to resolve. This is the most generous framing the ruling allows.
console.log(`\n=== B. AT THE CLOSEST FRAMING THAT STILL SHOWS A RING (full diameter = ${RENDER_H} render px) ===`);
console.log(`elev`.padStart(5), `extent px`.padStart(10), `band1 px/feature`.padStart(17), `band2 px/feature`.padStart(17), `  verdict (median body)`);
const medFrac = q(FRAC, 0.5);
const rowsB = [];
for (const elevDeg of [90, 60, 45, 35, 30, 20, 15, 10, 5, 2, 1]) {
  const s = Math.sin((elevDeg * Math.PI) / 180);
  const extent = (RENDER_H / 2) * medFrac * s;
  const b1 = extent / (2 * CYCLES_B1), b2 = extent / (2 * CYCLES_B2);
  rowsB.push({ elevDeg, extent, b1, b2 });
  const v = b1 >= BAR_PX ? 'PASS' : b1 >= 1 ? 'FAIL — bands blur' : 'FAIL — SUB-PIXEL';
  console.log(String(elevDeg).padStart(4) + '°', extent.toFixed(1).padStart(10), b1.toFixed(2).padStart(17), b2.toFixed(2).padStart(17), '  ' + v);
}
// the elevation at which band1 crosses the bar, solved per body
const critElev = FRAC.map(f => {
  const s = (BAR_PX * 2 * CYCLES_B1) / ((RENDER_H / 2) * f);
  return s >= 1 ? 90 : (Math.asin(s) * 180) / Math.PI;
});
console.log(`\nband1 crosses the ${BAR_PX}px bar at elevation:  min ${q(critElev,0).toFixed(1)}°  med ${q(critElev,0.5).toFixed(1)}°  max ${q(critElev,0.999).toFixed(1)}°`);
// fraction of viewing directions below that elevation, over a uniform sphere: P(|elev| < x) = sin(x)
const frac = critElev.map(e => Math.sin((e * Math.PI) / 180));
console.log(`fraction of viewing directions BELOW it (uniform sphere, P = sin elev):`);
console.log(`   min ${(100*q(frac,0)).toFixed(0)}%   med ${(100*q(frac,0.5)).toFixed(0)}%   max ${(100*q(frac,0.999)).toFixed(0)}%   <- share of the sky where the bands fail the bar`);

// ── C. the same ring at real approach distances, face-on (the BEST case at each distance) ──
console.log(`\n=== C. FACE-ON (elev 90°, the best case) AT REAL APPROACH DISTANCES ===`);
console.log(`Distance in body radii. Median body: inner ${q(rings.map(r=>r.inner),0.5).toFixed(2)}R  outer ${q(rings.map(r=>r.outer),0.5).toFixed(2)}R`);
const medInner = q(rings.map(r => r.inner), 0.5), medOuter = q(rings.map(r => r.outer), 0.5);
console.log(`  k (radii)`.padStart(11), `ring diam px`.padStart(13), `extent px`.padStart(10), `band1 px/feat`.padStart(14), '  verdict');
for (const k of [1.5, 2, 3, 4, 6, 8, 12, 20, 40, 100]) {
  const ppw = pxPerWorld(k);                 // per body radius (R cancels: D = k*R, s in units of R)
  const diam = 2 * medOuter * ppw, extent = (medOuter - medInner) * ppw;
  const b1 = extent / (2 * CYCLES_B1);
  const note = diam > RENDER_H ? 'ring overflows the screen' : b1 >= BAR_PX ? 'PASS' : b1 >= 1 ? 'FAIL — bands blur' : 'FAIL — SUB-PIXEL';
  console.log(String(k).padStart(11), diam.toFixed(1).padStart(13), extent.toFixed(1).padStart(10), b1.toFixed(2).padStart(14), '  ' + note);
}

// ── D. the alpha channel: the ring is a screen-door, and the door is locked to the screen ──
// Planet.js:1884  `if (bayerDither(gl_FragCoord.xy) > alpha) discard;`
// A 4x4 ordered dither has 16 thresholds. Coverage = the share of the 4x4 cell whose threshold < alpha.
console.log(`\n=== D. THE ALPHA TEST — Planet.js:1884, a screen-locked 4x4 ordered dither ===`);
console.log(`alpha = density * (1 - gap*0.8) * ringOpacity * edgeFade * shadowFade`);
console.log(`density = band1*0.6 + band2*0.4, so density in [0,1] and its MEAN over t is ~0.5.`);
console.log(`\nringOpacity`.padEnd(13), `alpha at density 0.5`.padStart(21), `surviving pixels /16`.padStart(21), `  effect`);
for (const p of [q(rings.map(r=>r.opacity),0), q(rings.map(r=>r.opacity),0.5), q(rings.map(r=>r.opacity),0.999)]) {
  const a = 0.5 * p;
  const kept = Math.round(a * 16);
  console.log(p.toFixed(3).padEnd(13), a.toFixed(3).padStart(21), `${kept}/16`.padStart(21), `  ${(100*kept/16).toFixed(0)}% of the ring's pixels are drawn`);
}
console.log(`\n⛔ The dither threshold is a function of gl_FragCoord — it is nailed to the SCREEN, not to`);
console.log(`   the ring. The ring rotates (Planet.js:1946) and the camera moves, so the surface slides`);
console.log(`   through a stationary 4x4 stencil and every pixel pops on and off. No coverage term, no`);
console.log(`   derivative, no mip: there is nothing in the program that can average a band once it is`);
console.log(`   narrower than a pixel.`);

// ── E. controls — things that might have been the defect and are NOT ──
console.log(`\n=== E. CONTROLS — measured, and NOT the defect ===`);
// 64-gon tessellation: RingGeometry(inner, outer, 64)
const sag = 1 - Math.cos(Math.PI / 64);
console.log(`RingGeometry(...,64) chord sagitta = ${(sag).toExponential(2)} x outer radius.`);
for (const k of [1.5, 3, 8]) {
  const px = sag * medOuter * pxPerWorld(k);
  console.log(`   at ${String(k).padStart(4)} body radii: ${px.toFixed(3)} render px  ${px < 1 ? '✓ sub-pixel, invisible' : '⚠ VISIBLE facet'}`);
}
console.log(`   -> the 64-gon is NOT the defect at any framing that shows a ring.`);
// Cassini gap edge
console.log(`Cassini gap (Planet.js:1860): plateau t=0.43..0.48 = 5% of the annulus; smoothstep edges 3% each.`);
for (const elevDeg of [90, 30, 10]) {
  const extent = (RENDER_H / 2) * medFrac * Math.sin((elevDeg * Math.PI) / 180);
  console.log(`   at elev ${String(elevDeg).padStart(2)}°: plateau ${(0.05*extent).toFixed(2)} px, edge ${(0.03*extent).toFixed(2)} px  ${0.05*extent >= BAR_PX ? '✓' : '✗ below the bar'}`);
}

// ── F. the moon-gap path — the only physics that reaches the live shader ──
// main.js:7805 planet.setRingGaps(sceneMoons) -> Planet.js:1900, which fires ONLY for a moon whose
// orbitRadius falls inside [innerR, outerR]. Gap width = moon.radius * 4.
console.log(`\n=== F. MOON GAPS — the one live gap path (Planet.js:1900, main.js:7805) ===`);
let withMoonInRing = 0; const gapW = [];
for (let i = 0; i < SYSTEMS; i++) {
  const sys = StarSystemGenerator.generate(`lab-procedural-${i}`, null);
  for (const e of sys.planets || []) {
    const d = e.planetData; if (!d?.rings) continue;
    const innerR = d.radius * d.rings.innerRadius, outerR = d.radius * d.rings.outerRadius;
    let hit = false;
    for (const m of e.moons || []) {
      const md = m.planetData || m, orb = md.orbitRadius ?? m.orbitRadius;
      if (orb == null || orb < innerR || orb > outerR) continue;
      hit = true; gapW.push(((md.radius ?? m.radius) * 4) / d.radius);
    }
    if (hit) withMoonInRing++;
  }
}
console.log(`ringed planets with a moon INSIDE the ring: ${withMoonInRing}/${rings.length}`);
if (gapW.length) {
  console.log(`gap width (body radii): min ${q(gapW,0).toFixed(3)}  med ${q(gapW,0.5).toFixed(3)}  max ${q(gapW,0.999).toFixed(3)}`);
  const medW = q(W, 0.5), share = q(gapW, 0.5) / medW;
  for (const elevDeg of [90, 30, 10]) {
    const extent = (RENDER_H / 2) * medFrac * Math.sin((elevDeg * Math.PI) / 180);
    const px = share * extent;
    console.log(`   at elev ${String(elevDeg).padStart(2)}°: ${px.toFixed(1)} px wide  ${px >= BAR_PX ? '✓ above the bar' : '✗ below'}`);
  }
}
console.log(`-> a broad, low-frequency feature. It fails ONLY where the whole ring already fails, so`);
console.log(`   it is not an independent defect and needs no separate remedy.`);
