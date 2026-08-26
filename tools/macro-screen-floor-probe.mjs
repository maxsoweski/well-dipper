// tools/macro-screen-floor-probe.mjs — 2026-08-26.
//
// MAX'S QUESTION: "that frequency might be right up close, and the issue might be that our LOD
// system isn't working with it properly. Or: rather than making the curve move to the renderable
// range, should we widen the renderable range to include the curve?"
//
// This answers it with arithmetic over SOURCE CONSTANTS. No rng, no corpus draw, no rendering.
//
// ⛔ THE RENDERING PATH IS VERIFIED, NOT ASSUMED — and the obvious wrong guess is recorded here
// because it cost a pass. Planet._createLabSurface (src/objects/Planet.js:2031) builds its material
// from `buildLabPlanetMaterial`, the LAB's factory, so an ADMITTED body carries the factory
// defaults uDispDomainScale = 1.0 (src/worldengine/shaders/uniforms.js:17) and uNormalMode = 0
// (:34), and nothing writes either. uNormalMode 0 is the ANALYTIC branch
// (src/worldengine/shaders/planetShaders.glsl.js:250), i.e. fbmd.
// ⛔ RELIEF_DOMAIN_SCALE = 1/0.3 (src/objects/Planet.js:1381) IS NOT ON THIS PATH. It is on the
// LEGACY material (:1682), which writes the drawn `d.noiseScale` and is a different calibration.
// Reading it as the lab-surface domain scale makes the law look like it double-counts C_MACRO's
// 1/0.3. It does not. CONFIRMED LIVE 2026-08-26: uDispDomainScale 1, uNormalMode 0, uFwClamp 1.
//
// ⭐ WHAT THIS FOUND: the engine carries TWO screen-resolvability rules with DIFFERENT bars, and
// the band between them is ungated. See section A.
import { macroWavelengthKm, MACRO_FREQ_CEIL, K_MACRO_R, C_MACRO } from '../src/worldengine/base/macroWavelength.js';

// ── Framing, quoted from src/worldengine/port/craterUniforms.js:65-71: "camera 1.2 body radii,
//    1600x999 dpr1 => disc RADIUS 1078.23 SCREEN px / pixelScale 3 = 359.41 RENDER px".
const GAME_DISC_PX_AT_1p2 = 359.41;
const K_GAME = GAME_DISC_PX_AT_1p2 * Math.sqrt(1.2 * 1.2 - 1);   // px ∝ tan(asin(1/d)) = 1/sqrt(d²-1)
const gameDiscPx = (d) => K_GAME / Math.sqrt(d * d - 1);
// ── The LAB's framing, MEASURED LIVE 2026-08-26: canvas 1349x844 dpr1, fov 50, NO pixelScale
//    divide. halfH/tan(fov/2) = 422/0.46631 = 905.0 px per unit tan.
const LAB_PX_PER_TAN = (844 / 2) / Math.tan(50 * Math.PI / 360);
const labDiscPx = (d) => LAB_PX_PER_TAN * Math.tan(Math.asin(Math.min(0.9999, 1 / d)));

// vPos = position/uBodyRadius (planetShaders.glsl.js:73) ⇒ the noise domain is the UNIT sphere, so
// one vPos unit spans the disc radius in px and fwBase = 1/discPx at the disc centre, face-on —
// the same convention craterUniforms.js states for its own floor.
const DOMAIN = 1.0;   // uDispDomainScale on the lab-surface material, BOTH front-ends
const octFreq = (uNS, n) => uNS * 0.3 * DOMAIN * Math.pow(2, n);   // heightNoise.glsl.js:115+104

// ── THE TWO BARS, both already stated in this repo, both in RENDER px per cycle.
const BAR_FEATURE = 4.0;   // craterUniforms.js:65-71 — ">= 4 RENDER px ... 2x Nyquist, because a
                           // crater has to show bowl AND rim to READ as one, not merely be detected"
const BAR_NYQUIST = 2.0;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const FADE_START_PX = 1 / 0.4, FADE_DONE_PX = 1 / 0.8;
const fadeW = (px) => 1 - smoothstep(0.4, 0.8, 1 / px);

console.log('='.repeat(94));
console.log('A — THE TWO RULES, AND THE UNGATED BAND BETWEEN THEM');
console.log('='.repeat(94));
console.log(`craters      an octave must span >= ${BAR_FEATURE.toFixed(2)} px/cycle to READ as a feature   craterUniforms.js:65-71`);
console.log(`noise stack  full weight until ${FADE_START_PX.toFixed(2)} px/cycle, zero at ${FADE_DONE_PX.toFixed(2)} px/cycle       heightNoise.glsl.js:122-124`);
console.log(`\n⭐ ${FADE_START_PX.toFixed(2)} .. ${BAR_FEATURE.toFixed(2)} px/cycle is kept at ~FULL weight and is below the repo's own`);
console.log('   legibility bar. NOTHING in the engine gates it. The noise stack\'s only screen-awareness');
console.log('   is an ANTI-SHIMMER fade set at Nyquist — its own comment says "kills dither shimmer".');
console.log('\n⚠ AND THE GRADIENT IS WHAT THE EYE READS. fbmd accumulates grad += amp*w*freq*n.yzw with');
console.log('   amp halving and freq doubling, so amp*freq is CONSTANT across octaves: every surviving');
console.log('   octave contributes EQUALLY to the surface normal regardless of its height weight.');

console.log('\n' + '='.repeat(94));
console.log('B — WHERE THE LAW\'S RANGE LANDS IN THE GAME, AT THE CLOSEST MEASURED APPROACH (1.2 radii)');
console.log('='.repeat(94));
const CORPUS = [['base law — min & p50 (radius cancels)', C_MACRO / K_MACRO_R],
                ['corpus max, non-gas', 245.175],
                ['MACRO_FREQ_CEIL', MACRO_FREQ_CEIL]];
for (const [label, uNS] of CORPUS) {
  const px0 = gameDiscPx(1.2);
  let gTot = 0, gBad = 0, alive = 0, band = 0, finest = null;
  const cells = [];
  for (let n = 0; n < 9; n++) {
    const f = octFreq(uNS, n), px = px0 / f, w = fadeW(px), gw = 0.5 * Math.pow(0.5, n) * w * f;
    gTot += gw; if (w > 0.01) { alive++; finest = px; if (px < BAR_FEATURE) { band++; gBad += gw; } }
    if (n < 3) cells.push(`oct${n} ${px.toFixed(2)}px w=${w.toFixed(2)}`);
  }
  console.log(`\n${label} — uNoiseScale ${uNS.toFixed(4)}`);
  console.log(`  ${cells.join('  |  ')}`);
  console.log(`  octaves alive ${alive}, of which ${band} under the 4px bar; finest kept ${finest?.toFixed(2)}px;` +
    `  ⭐ ${(100 * gBad / gTot).toFixed(0)}% of the surface NORMAL comes from under the bar`);
}

console.log('\n' + '='.repeat(94));
console.log('C — ⭐ THE INSTRUMENT UNDERSTATES THE DEFECT. LAB vs GAME AT THE SAME FRAMING (1.2 radii)');
console.log('='.repeat(94));
console.log('Two independent reasons, both MEASURED LIVE in the lab on 2026-08-26:');
console.log('  1. the lab writes `physical * sVis` (world-engine-lab.html:5359) and sVis < 1 on small bodies;');
console.log('  2. the lab renders at full canvas resolution; the game divides by pixelScale 3.\n');
console.log('  preset          physical   lab written   lab oct-0 px   game oct-0 px   the lab is this much kinder');
for (const [nm, phys, written] of [['Lava', 250.717, 141.575], ['Europa', 219.002, 154.857], ['Magma', 251.005, 307.417]]) {
  const labPx = labDiscPx(1.2) / octFreq(written, 0);
  const gamePx = gameDiscPx(1.2) / octFreq(phys, 0);
  console.log(`  ${nm.padEnd(14)}  ${phys.toFixed(1).padStart(8)}   ${written.toFixed(1).padStart(11)}   ` +
    `${labPx.toFixed(2).padStart(12)}   ${gamePx.toFixed(2).padStart(13)}   ${(labPx / gamePx).toFixed(1)}x`);
}

console.log('\n' + '='.repeat(94));
console.log('D — THE CEILING THE 4px RULE IMPLIES, IF IT WERE APPLIED THE WAY CRATERS APPLY IT (GAME)');
console.log('='.repeat(94));
const px0 = gameDiscPx(1.2);
console.log(`octave 0 only — what macroWavelength.js §4 actually checked:   uNoiseScale <= ${(px0 / BAR_FEATURE / 0.3).toFixed(2)}`);
for (const keep of [2, 3, 4]) {
  console.log(`the finest of ${keep} kept octaves must clear 4px:                  uNoiseScale <= ${(px0 / BAR_FEATURE / 0.3 / Math.pow(2, keep - 1)).toFixed(2)}`);
}
console.log(`\ntoday's law ceiling MACRO_FREQ_CEIL = ${MACRO_FREQ_CEIL.toFixed(3)}`);
console.log('\n⛔ NOT A RECOMMENDATION. Which of these rows is right depends on how many octaves the');
console.log('   field is meant to show, which is a LOOK decision and is Max\'s. Recorded so the number');
console.log('   is derived from a stated rule rather than picked by eye.');

console.log('\n' + '='.repeat(94));
console.log('E — ⭐ MAX\'S TARGET: "a pixel scale roughly equivalent to the PS1/N64 era" (2026-08-26)');
console.log('='.repeat(94));
console.log('⛔ THE GAME RENDERS NATIVELY SMALL — it is NOT a high-fidelity render post-processed down.');
console.log('   src/rendering/RetroRenderer.js:826 builds sceneTarget at ceil(w/pixelScale) x ceil(h/pixelScale),');
console.log('   NearestFilter both ways, antialias:false (:48), then magnifies. There is no downsample and');
console.log('   no supersample anywhere. So the fragment shader runs ONCE PER RETRO PIXEL and sub-pixel');
console.log('   octaves cannot average into anything — they are point-sampled, i.e. pure aliasing that');
console.log('   CRAWLS as the camera moves. That is what the fwidth fade exists to suppress.\n');
console.log('Reference native resolutions: PS1 320x240 (some 512x240) · N64 320x240, 640x480 hi-res mode.\n');
console.log('  pixelScale   render target @1600x999   vs PS1/N64        disc px @1.2R   oct-0 px at the law ceiling');
for (const ps of [1, 2, 3, 4, 5, 6]) {
  const rw = Math.ceil(1600 / ps), rh = Math.ceil(999 / ps);
  const disc = 1078.23 / ps;
  const px0 = disc / octFreq(MACRO_FREQ_CEIL, 0);
  const era = rw >= 1200 ? 'far finer than the era' : rw >= 700 ? 'finer than N64 hi-res'
            : rw >= 480 ? 'between PS1 and N64 hi-res' : rw >= 300 ? '⭐ PS1 / N64 NATIVE' : 'coarser than the era';
  const verdict = px0 >= BAR_FEATURE ? 'clears the 4px bar' : px0 >= BAR_NYQUIST ? '⛔ UNDER THE BAR' : '⛔⛔ PAST NYQUIST';
  console.log(`  ${String(ps).padStart(10)}   ${(rw+'x'+rh).padStart(21)}   ${era.padEnd(27)}   ${disc.toFixed(1).padStart(13)}   ${px0.toFixed(2).padStart(6)} px  ${verdict}`);
}
console.log('\n⭐⭐ THE CONSEQUENCE FOR THE LAW. Today (pixelScale 3) the hottest bodies clear the 4px bar at');
console.log('    their FUNDAMENTAL by a hair. Move toward true PS1/N64 native and even the fundamental');
console.log('    stops clearing — so at the target aesthetic the law\'s hot end has NO renderable content');
console.log('    as SHAPE at all, not merely unrenderable harmonics.');
console.log('\n    The ceiling the 4px rule implies, per pixelScale, keeping N octaves legible:');
console.log('      pixelScale   1 oct     2 oct     3 oct');
for (const ps of [3, 4, 5]) {
  const disc = 1078.23 / ps;
  const c = (n) => (disc / BAR_FEATURE / 0.3 / Math.pow(2, n - 1)).toFixed(1);
  console.log(`      ${String(ps).padStart(10)}   ${c(1).padStart(6)}   ${c(2).padStart(7)}   ${c(3).padStart(7)}      (today's law ceiling ${MACRO_FREQ_CEIL.toFixed(1)})`);
}
