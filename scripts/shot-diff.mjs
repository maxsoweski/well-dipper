#!/usr/bin/env node
// scripts/shot-diff.mjs — Instrument E item 12. PLAN §12.3 E-4.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⛔ A WHOLE-FRAME PERCENTAGE IS NOT ADMISSIBLE, AND THAT IS THE ENTIRE REASON THIS FILE EXISTS.
//
// The capture is a live game with a HUD on it — cockpit panels repainting at 30 Hz, reticles, nav
// chrome, orrery text, a starfield — none of it the subject of any contract, all of it in the
// numerator. It cuts both ways, which is what makes it dangerous rather than merely noisy:
//
//   · a step whose body did not move at all CLEARS a floor built on HUD churn, and reads as a pass;
//   · a real but localised change is DILUTED below that floor, and reads as a null.
//
// Step 4 item 4's entire subject is the fresnel annulus on the lit crescent — a thin ring over part
// of a small disc — so the plan's own showcase shot can fail its admissibility rule for reasons
// having nothing whatever to do with the limb. Hence three regions, each against a floor measured in
// THE SAME REGION, and hence the sidecar: without the disc's centre and radius in pixels there is no
// disc ROI, no rim annulus, and nothing here but the whole-frame number that was already useless.
//
// ⭐ EVERY PIXEL READ HAPPENS OUTSIDE THE WEBGL CONTEXT. Frames arrive as PNGs from the page-level
// screenshot (the compositor path). That retires the entire `preserveDrawingBuffer` / all-black
// class of failure rather than re-litigating it, and it is why this is an offline script and not a
// hook on `window._lab`.
//
// ── USAGE ──────────────────────────────────────────────────────────────────────────────────────
//   node scripts/shot-diff.mjs --a on.png --b off.png --sidecar on.json \
//                              --floor-a floor1.png --floor-b floor2.png [--region rim] [--json]
//
//   --a --b            the PAIR. The step's own toggle is the ONLY thing that may differ.
//   --sidecar          `_lab.shotState()` output, written beside the frame. REQUIRED. No sidecar,
//                      no percentage — see refuse() below.
//   --floor-a/-b       two grabs at the SAME state, back-to-back, under the same freeze. The floor
//                      is what the capture path itself moves when nothing moved.
//   --region           the region DECLARED before the shot (§12.5 fact 1). Reported alongside every
//                      region so a signal declared in one and reported from another is visible.
//   --threshold        per-channel 0-255 delta counted as "moved". Default 2.
//   --json             machine-readable output.
//
// ── THE OVERRIDES, AND WHY THEY SHOUT ──────────────────────────────────────────────────────────
// `--accept-live-grain` and `--accept-tiny-disc` exist because a real operator will one day need
// them. Both stamp WAIVED into the output and into the JSON, permanently, because the failure mode
// they guard is C15 — "a score raised by deleting mutators is the same defect wearing a percentage."
// An override that leaves no trace in the artifact is a silently loosened threshold.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

// ── The two admissibility floors this script will not cross without being told to, loudly. ──────
// 24 px of RADIUS ≈ a 48 px disc. ⛔ §12.5 fact 6: "a shot at ORRERY spawn distance is a six-pixel
// disc that CANNOT FAIL." Below this, the rim annulus is a couple of hundred pixels wide and every
// number computed in it is dominated by the edge antialiasing of the disc itself.
const MIN_DISC_RADIUS_PX = 24;
const DEFAULT_THRESHOLD = 2;

function refuse(msg, detail) {
  console.error('\n⛔ shot-diff REFUSES TO PRINT A PERCENTAGE.\n');
  console.error('   ' + msg);
  if (detail) console.error('\n   ' + String(detail).split('\n').join('\n   '));
  console.error('');
  process.exit(2);
}

function parseArgs(argv) {
  const out = { threshold: DEFAULT_THRESHOLD };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'json' || key === 'accept-live-grain' || key === 'accept-tiny-disc') { out[key] = true; continue; }
    out[key] = argv[++i];
  }
  return out;
}

function readPng(file, label) {
  if (!file) refuse(`${label} not supplied.`, 'Both --a and --b are required: a single "after" image has no state in which it fails (§12.1 E-a).');
  if (!fs.existsSync(file)) refuse(`${label} does not exist: ${file}`);
  try {
    return PNG.sync.read(fs.readFileSync(file));
  } catch (e) {
    refuse(`${label} is not a readable PNG: ${file}`, e.message);
  }
}

// ── Region masks ────────────────────────────────────────────────────────────────────────────────
// Each returns a predicate over pixel (x, y) in PNG pixel space. The disc geometry arrives in
// VIEWPORT (CSS) pixels and is rescaled by the caller — never assumed to be 1:1, because the capture
// may run at a device pixel ratio the page never sees.
function makeRegions(disc) {
  const { cx, cy, r } = disc;
  const rIn = r * 0.85;
  const r2 = r * r, rIn2 = rIn * rIn;
  return {
    // The three DECLARABLE regions of §12.3 E-4.
    full: { label: 'full-frame', declarable: true, test: () => true },
    disc: { label: 'disc', declarable: true, test: (x, y) => ((x - cx) ** 2 + (y - cy) ** 2) <= r2 },
    rim: {
      label: 'rim-annulus 0.85R–1.00R',
      declarable: true,
      test: (x, y) => { const d2 = (x - cx) ** 2 + (y - cy) ** 2; return d2 > rIn2 && d2 <= r2; },
    },
    // ⚠ DIAGNOSTIC ONLY — NOT a declarable ROI, and it must never be reported as one.
    // It exists to make the masking itself falsifiable: a change confined to the rim MUST read ~0
    // here, and if it does not, the mask is wrong and every other number on this page is wrong with
    // it. `disc` deliberately includes the rim (it is the whole disc), so `disc` alone cannot
    // distinguish "the mask works" from "the mask leaks".
    discInterior: { label: 'disc interior 0–0.85R (control)', declarable: false, test: (x, y) => ((x - cx) ** 2 + (y - cy) ** 2) <= rIn2 },
  };
}

/**
 * Compare two equal-sized images inside one region.
 * Reports BOTH a count metric and a magnitude metric, because they fail differently: `movedPct`
 * misses a large change confined to very few pixels, `meanAbs` misses a tiny change spread over
 * many. A pair that moves one and not the other is a finding, not a rounding error.
 */
function compare(a, b, region, threshold) {
  let n = 0, moved = 0, sumAbs = 0, maxAbs = 0;
  const { width, height, data: da } = a;
  const db = b.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!region.test(x, y)) continue;
      const i = (y * width + x) * 4;
      const dr = Math.abs(da[i] - db[i]);
      const dg = Math.abs(da[i + 1] - db[i + 1]);
      const dbl = Math.abs(da[i + 2] - db[i + 2]);
      const mx = dr > dg ? (dr > dbl ? dr : dbl) : (dg > dbl ? dg : dbl);
      n++;
      sumAbs += (dr + dg + dbl) / 3;
      if (mx > maxAbs) maxAbs = mx;
      if (mx > threshold) moved++;
    }
  }
  return {
    pixels: n,
    movedPct: n ? +(100 * moved / n).toFixed(4) : 0,
    meanAbs: n ? +(sumAbs / n).toFixed(4) : 0,
    maxAbs,
  };
}

/** Lit fraction of a region, from the PNG — the pixel measurement §12.5 fact 6 asks for. */
function litPct(img, region, lumaThreshold = 24) {
  let n = 0, lit = 0;
  const { width, height, data } = img;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!region.test(x, y)) continue;
      const i = (y * width + x) * 4;
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      n++;
      if (l > lumaThreshold) lit++;
    }
  }
  return n ? +(100 * lit / n).toFixed(2) : 0;
}

// ═══ main ═══════════════════════════════════════════════════════════════════════════════════════
const args = parseArgs(process.argv.slice(2));
const waivers = [];

// ── 1. THE SIDECAR GATE. No sidecar, no percentage. ────────────────────────────────────────────
if (!args.sidecar) {
  refuse(
    '--sidecar is required and was not supplied.',
    'The sidecar is `_lab.shotState()` written beside the frame. Without it there is no disc centre\n'
    + 'and no disc radius, so the ONLY number available is a whole-frame percentage over a live HUD —\n'
    + 'which §12.3 E-4 rules inadmissible in both directions. This is not a convenience flag.',
  );
}
if (!fs.existsSync(args.sidecar)) refuse(`--sidecar file does not exist: ${args.sidecar}`);
let state;
try {
  state = JSON.parse(fs.readFileSync(args.sidecar, 'utf8'));
} catch (e) {
  refuse(`--sidecar is not valid JSON: ${args.sidecar}`, e.message);
}
const roi = state?.roi;
if (!roi?.viewport || !roi?.disc) {
  refuse('sidecar carries no `roi.viewport` / `roi.disc`.', 'It must be the object returned by `_lab.shotState()`, unmodified.');
}
if (roi.disc.onScreen !== true) {
  refuse(
    'sidecar reports the body was NOT on screen (`roi.disc.onScreen === false`).',
    'The projection still produced finite numbers; they are meaningless. Re-frame and re-shoot.',
  );
}
if (roi.disc.r == null) refuse('sidecar carries no disc radius (`roi.disc.r` is null).', 'The mesh had no readable geometry. There is no disc ROI without it.');

// ── 2. THE FREEZE GATE. §12.2: a shot taken with grain live is inadmissible on its face. ────────
const grain = state?.freeze?.uGrainStrength;
if (state?.freeze?.frozen === false || grain == null || grain !== 0) {
  if (!args['accept-live-grain']) {
    refuse(
      `the frame was not frozen with the film grain off (uGrainStrength = ${grain ?? 'not recorded'}).`,
      'The grain re-randomises EVERY PIXEL of the composited frame at ±0.0225 ≈ ±5.7/255, which makes a\n'
      + 'full-frame identity claim unsatisfiable and raises the floor inside both ROIs. Call\n'
      + '`_lab.freezeFrame({clock:0, spin:0, orbit:0})` and re-shoot. If you genuinely must proceed,\n'
      + '--accept-live-grain stamps WAIVED into this output and into the JSON, permanently.',
    );
  }
  waivers.push(`LIVE GRAIN WAIVED (uGrainStrength = ${grain ?? 'not recorded'})`);
}

// ── 3. THE IMAGES ───────────────────────────────────────────────────────────────────────────────
const imgA = readPng(args.a, '--a');
const imgB = readPng(args.b, '--b');
if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
  refuse(`--a and --b differ in size (${imgA.width}×${imgA.height} vs ${imgB.width}×${imgB.height}).`, 'A resized window between grabs is not a pair.');
}

const hasFloor = !!(args['floor-a'] && args['floor-b']);
let floorA = null, floorB = null;
if (hasFloor) {
  floorA = readPng(args['floor-a'], '--floor-a');
  floorB = readPng(args['floor-b'], '--floor-b');
  if (floorA.width !== imgA.width || floorA.height !== imgA.height
   || floorB.width !== imgA.width || floorB.height !== imgA.height) {
    refuse('the floor pair is not the same size as the signal pair.', 'A floor measured at another resolution is not a floor for this shot.');
  }
}

// ── 4. ROI RESCALE. The capture need not be 1:1 with the viewport. ─────────────────────────────
const sx = imgA.width / roi.viewport.w;
const sy = imgA.height / roi.viewport.h;
const aspectSkew = Math.abs(sx - sy) / Math.max(sx, sy);
if (aspectSkew > 0.01) {
  refuse(
    `the PNG and the recorded viewport disagree on aspect ratio (x-scale ${sx.toFixed(4)}, y-scale ${sy.toFixed(4)}).`,
    'A non-uniform rescale puts the disc mask somewhere other than the disc, and every region below\n'
    + 'would then be measuring the wrong pixels while reporting confident numbers.',
  );
}
const discPx = { cx: roi.disc.cx * sx, cy: roi.disc.cy * sy, r: roi.disc.r * (sx + sy) / 2 };
if (discPx.r < MIN_DISC_RADIUS_PX) {
  if (!args['accept-tiny-disc']) {
    refuse(
      `the disc is ${discPx.r.toFixed(1)} px in radius, below the ${MIN_DISC_RADIUS_PX} px floor.`,
      'A shot at ORRERY spawn distance is a six-pixel disc that CANNOT FAIL — every ROI collapses to\n'
      + 'antialiasing on the body\'s own edge. Fly closer and re-shoot, or pass --accept-tiny-disc,\n'
      + 'which stamps WAIVED into this output permanently.',
    );
  }
  waivers.push(`TINY DISC WAIVED (radius ${discPx.r.toFixed(1)} px < ${MIN_DISC_RADIUS_PX} px)`);
}

// ── 5. MEASURE ──────────────────────────────────────────────────────────────────────────────────
const regions = makeRegions(discPx);
const threshold = Number(args.threshold);
const declared = roi.declaredRegion || args.region || null;

const results = {};
for (const [key, region] of Object.entries(regions)) {
  const signal = compare(imgA, imgB, region, threshold);
  const floor = hasFloor ? compare(floorA, floorB, region, threshold) : null;
  let verdict;
  if (!hasFloor) {
    verdict = 'NO FLOOR — INADMISSIBLE (§12.5 fact 4)';
  } else if (signal.movedPct > floor.movedPct && signal.meanAbs > floor.meanAbs) {
    verdict = 'SIGNAL ABOVE FLOOR';
  } else if (signal.movedPct <= floor.movedPct && signal.meanAbs <= floor.meanAbs) {
    verdict = 'AT OR BELOW FLOOR';
  } else {
    // ⚠ Named rather than resolved. The two metrics disagreeing is information about the SHAPE of
    // the change (few-and-large vs many-and-small); collapsing it to a pass or a fail throws that
    // information away and picks whichever answer the operator was hoping for.
    verdict = 'SPLIT — metrics disagree, re-shoot or declare which metric the claim rests on';
  }
  results[key] = {
    label: region.label,
    declarable: region.declarable,
    isDeclaredRegion: declared === key,
    signal,
    floor,
    verdict,
    litPctA: key === 'full' ? null : litPct(imgA, region),
  };
}

// ── 6. REPORT ───────────────────────────────────────────────────────────────────────────────────
const report = {
  tool: 'shot-diff',
  a: path.resolve(args.a),
  b: path.resolve(args.b),
  floorA: hasFloor ? path.resolve(args['floor-a']) : null,
  floorB: hasFloor ? path.resolve(args['floor-b']) : null,
  sidecar: path.resolve(args.sidecar),
  threshold,
  image: { w: imgA.width, h: imgA.height },
  viewport: roi.viewport,
  discPx: { cx: +discPx.cx.toFixed(2), cy: +discPx.cy.toFixed(2), r: +discPx.r.toFixed(2) },
  declaredRegion: declared,
  waivers,
  reproduction: {
    commit: state.commit ?? null,
    seed: state.seed ?? null,
    body: state.body?.name ?? null,
    planetType: state.body?.planetType ?? null,
    e1CompositionClass: state.body?.e1CompositionClass ?? null,
    gameShaderVariant: state.body?.gameShaderVariant ?? null,
    fps: state.fps ?? null,
    throttled: state.throttled ?? null,
  },
  regions: results,
};

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

// Pad the absent-value marker to the SAME width as a number. A short em-dash shifts every column
// to its right, and a floor column that has slid under the signal column is exactly the misreading
// this table exists to prevent.
const pct = (v) => (v === null ? '—'.padStart(10) : String(v.toFixed(4)).padStart(10));
console.log('');
console.log('shot-diff — Instrument E item 12 (PLAN §12.3 E-4)');
console.log('─'.repeat(96));
console.log(`  A          ${report.a}`);
console.log(`  B          ${report.b}`);
console.log(`  floor      ${hasFloor ? report.floorA + '  vs  ' + report.floorB : '⛔ NONE SUPPLIED'}`);
console.log(`  image      ${imgA.width}×${imgA.height}   viewport ${roi.viewport.w}×${roi.viewport.h}   scale ${sx.toFixed(3)}`);
console.log(`  disc       cx ${discPx.cx.toFixed(1)}  cy ${discPx.cy.toFixed(1)}  r ${discPx.r.toFixed(1)} px`);
console.log(`  threshold  ${threshold} / 255 per channel`);
console.log('');
console.log(`  commit ${report.reproduction.commit ?? '⚠ NOT FILLED — set it from `git rev-parse HEAD`'}`);
console.log(`  seed ${report.reproduction.seed}   body ${report.reproduction.body}   planetType ${report.reproduction.planetType}`);
console.log(`  e1CompositionClass ${report.reproduction.e1CompositionClass}   gameShaderVariant ${report.reproduction.gameShaderVariant}`);
console.log(`  fps ${report.reproduction.fps}${report.reproduction.throttled ? '   ⛔ THROTTLED — every per-frame verdict is meaningless' : ''}`);
if (declared) console.log(`  declared region: ${declared}   ⚠ a signal declared in one region and reported from another is inadmissible (§12.1 E-e)`);
else console.log('  declared region: ⚠ NONE. §12.5 fact 1 requires the region to be named BEFORE the shot.');
console.log('');
console.log('  region                              signal%    floor%   signalΔ    floorΔ   lit%   verdict');
console.log('  ' + '─'.repeat(92));
for (const [key, r] of Object.entries(results)) {
  const mark = r.isDeclaredRegion ? '▶' : (r.declarable ? ' ' : '·');
  const name = (r.label + (r.declarable ? '' : '')).padEnd(32);
  console.log(`  ${mark} ${name}${pct(r.signal.movedPct)}${pct(r.floor?.movedPct ?? null)}`
            + `${pct(r.signal.meanAbs)}${pct(r.floor?.meanAbs ?? null)}`
            + `${r.litPctA === null ? '      —' : String(r.litPctA.toFixed(1)).padStart(7)}   ${r.verdict}`);
}
console.log('');
console.log('  · = diagnostic, NOT a declarable ROI. `disc interior` exists to prove the mask itself:');
console.log('    a change confined to the rim MUST read ~0 there, and `disc` (which includes the rim)');
console.log('    cannot tell "the mask works" from "the mask leaks".');
if (waivers.length) {
  console.log('');
  for (const w of waivers) console.log(`  ⛔ ${w}`);
  console.log('  These waivers are part of the artifact. An override that leaves no trace is C15.');
}
console.log('');
