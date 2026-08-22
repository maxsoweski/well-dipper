#!/usr/bin/env node
// tools/crater-density-saturation-probe.mjs
//
// TWO QUESTIONS, ONE INSTRUMENT, both raised by Max on 2026-08-22 looking at the live lab.
//
// Q1 "on the rocky subtype you cannot see any craters, unlike the mercury/moon type".
//    ANSWER: WORKING AS DESIGNED, not a defect. `Rocky (Earthlike)`'s bombardment schedule DOES
//    fire, but its surviving coverage is ~6.7e-5 of a rendered cell — an Earthlike world's air and
//    active resurfacing erase its craters, exactly as Earth's are erased. craterUniformsFrom then
//    trips `density * visibleCells >= CRATER_MIN_VISIBLE` and returns CRATERS_OFF, which literally
//    reads "not even one crater would be visible on the disc". Ocean, Europa, Eyeball and Lava are
//    off for the same reason. The crater-density judgement therefore CANNOT be made on Rocky; it
//    lives on Moon/Mercury, Mars, Frozen and Crystal.
//
// Q2 the one Max did NOT ask, which this probe found while answering Q1:
//    ⛔ THE DENSITY CLAMP IS SATURATED ON EVERY CRATERED PRESET. `density` is clamp01(...) and all
//    four cratered worlds sit 1.6x-2.3x ABOVE the ceiling, so they render at an IDENTICAL 1.0.
//    Moon/Mercury 2.27x, Frozen 2.26x, Mars 2.04x, Crystal 1.60x. Mars has ~10% less raw coverage
//    than the Moon and renders indistinguishably from it. ⭐ THIS IS WHAT "crater density roughly
//    DOUBLED" ACTUALLY IS: the bodies are ~2x over the clamp, so the clamp is doing all the work and
//    the per-world variety above it is discarded.
//
// RUN: node tools/crater-density-saturation-probe.mjs
const R='/home/ax/projects/well-dipper/';
const { DRIVER_PRESETS, drawPresetConditions } = await import(R+'driver-presets.js');
const { deriveUniforms } = await import(R+'src/worldengine/base/labCore.js');
const { deriveConditionVector } = await import(R+'src/worldengine/base/conditionVector.js');
const cu = await import(R+'src/worldengine/port/craterUniforms.js');
const bomb = await import(R+'src/worldengine/base/bombardment.js');
const base = await import(R+'src/worldengine/base/baseStep.js');
console.log('preset'.padEnd(32),'RAW coverage ratio'.padStart(20),' clamped',' headroom');
for (const p of Object.keys(DRIVER_PRESETS)) {
  const dp = drawPresetConditions(p,1);
  const u = deriveUniforms(dp,1.0);
  const cond = deriveConditionVector(dp,u,DRIVER_PRESETS[p].radiusEarth ?? 1);
  const sch = bomb.craterSchedule(cond);
  if (!sch || !sch.fired) continue;
  const RE=Math.max(1e-6,cond?.radiusEarth??1), R_km=RE*6371, rpk=base.radPerKm(RE);
  const L=sch.D_LO_KM*sch.sizeMul, H=sch.D_HI_KM, lo=Math.max(L, cu.CRATER_VIS_FLOOR_RAD*R_km);
  if(!(H>lo)) continue;
  const raw = cu.coverageBand(sch,rpk,lo,H)/cu.RENDERED_CELL_COVERAGE;
  const cl = Math.min(1,Math.max(0,raw));
  console.log(p.padEnd(32), raw.toFixed(4).padStart(20), String(cl).padStart(8), raw>1?`  ⛔ ${(raw).toFixed(2)}x over the ceiling`:'  under');
}
