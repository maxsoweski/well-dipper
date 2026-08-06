#!/usr/bin/env node
// Leg-by-leg analysis of the Well Dipper autopilot tour telemetry dump.
import { readFileSync } from 'fs';

const raw = JSON.parse(readFileSync(new URL('./tour-telemetry.json', import.meta.url), 'utf8'));
const data = raw.result ?? raw; // tool may wrap
const { meta, samples, events } = data;

console.log('=== META ===');
console.log(`system=${meta.system.name} planets=${meta.system.planetCount} lingerMult=${meta.lingerMult}`);
console.log(`star: R=${meta.star.radius.toFixed(2)} keepOut=${meta.star.keepOut.toFixed(1)} park=${meta.star.park.toFixed(1)}`);
console.log(`samples=${samples.length} span=${samples.at(-1).t - samples[0].t}s`);

// Segment into legs by idx change
const legs = [];
let cur = null;
for (const s of samples) {
  if (!cur || s.idx !== cur.idx) {
    if (cur) legs.push(cur);
    cur = { idx: s.idx, stop: s.stop, t0: s.t, samples: [] };
  }
  cur.samples.push(s);
}
if (cur) legs.push(cur);

const phaseSet = (ss) => [...new Set(ss.map(x => x.phase))].join('>');
console.log('\n=== LEGS ===');
console.log('idx stop        t0    dur  d0->dEnd           minSpeed maxSpeed phases          arrived aborts wayp minStarDist');
let arrivals = 0, aborted = 0;
for (const L of legs) {
  const ss = L.samples;
  const dur = ss.at(-1).t - ss[0].t;
  const d0 = ss[0].distReal, dEnd = ss.at(-1).distReal;
  const held = ss.some(x => x.phase === 'HOLD');
  const ab0 = ss[0].aborts, abN = ss.at(-1).aborts;
  const wayp = ss.some(x => x.waypoint);
  const minStar = Math.min(...ss.map(x => x.starDist ?? Infinity));
  const speeds = ss.map(x => x.speed);
  if (held) arrivals++;
  if (abN > ab0) aborted++;
  console.log(
    `${String(L.idx).padStart(3)} ${L.stop.padEnd(10)} ${String(L.t0).padStart(5)} ${String(dur).padStart(4)}s ` +
    `${String(d0).padStart(8)}->${String(dEnd).padEnd(8)} ${Math.min(...speeds).toFixed(2).padStart(7)} ${Math.max(...speeds).toFixed(2).padStart(8)} ` +
    `${phaseSet(ss).padEnd(17)} ${held ? 'HOLD' : 'no  '} ${abN - ab0}      ${wayp ? 'Y' : '-'}    ${minStar.toFixed(1)}`
  );
}
console.log(`\nlegs=${legs.length} arrivals(HOLD)=${arrivals} stall-aborted=${aborted}`);

// Speed distribution
const buckets = { '<0.5': 0, '0.5-4': 0, '4-50': 0, '50-500': 0, '>500': 0 };
for (const s of samples) {
  if (s.speed < 0.5) buckets['<0.5']++;
  else if (s.speed < 4) buckets['0.5-4']++;
  else if (s.speed < 50) buckets['4-50']++;
  else if (s.speed < 500) buckets['50-500']++;
  else buckets['>500']++;
}
console.log('\n=== SPEED DISTRIBUTION (share of run time) ===');
for (const [k, v] of Object.entries(buckets)) console.log(`${k.padEnd(8)} ${(100 * v / samples.length).toFixed(1)}%`);

// Cap-dominating bodies (upgraded samples only)
const nb = samples.filter(s => s.nearBody);
if (nb.length) {
  const byBody = {};
  for (const s of nb) {
    const k = `body#${s.nearBody.i} R=${s.nearBody.R}`;
    byBody[k] = (byBody[k] ?? 0) + 1;
  }
  console.log(`\n=== CAP-DOMINATING BODY (${nb.length} upgraded samples) ===`);
  for (const [k, v] of Object.entries(byBody).sort((a, b) => b[1] - a[1]).slice(0, 8))
    console.log(`${k.padEnd(24)} ${v}s (${(100 * v / nb.length).toFixed(0)}%)`);
}

// Stall-abort context
const aborts = events.filter(e => e.ev === 'stallAbort');
console.log(`\n=== STALL-ABORTS (${aborts.length}) ===`);
for (const a of aborts) {
  const extra = a.nearBody ? ` nearBody#${a.nearBody.i}(R=${a.nearBody.R},surf=${a.nearBody.surf})` : '';
  console.log(`t=${String(a.t).padStart(5)} ${String(a.stop).padEnd(10)} starDist=${a.starDist}${a.distReal != null ? ' distReal=' + a.distReal : ''}${extra}`);
}

// Star-leg detail if present
const starLegs = legs.filter(L => L.stop.startsWith('star'));
for (const L of starLegs) {
  console.log(`\n=== STAR LEG DETAIL (idx ${L.idx}, t0=${L.t0}) ===`);
  for (const s of L.samples.filter((_, i) => i % 5 === 0 || i === L.samples.length - 1))
    console.log(`t=${s.t} phase=${s.phase} speed=${s.speed} cap=${s.cap} starDist=${s.starDist} inKO=${s.inKeepOut} stallT=${s.stallT} holdT=${s.holdT}`);
}

// Errors
const errs = events.filter(e => e.ev === 'error');
if (errs.length) console.log(`\n!!! sampler errors: ${errs.length} — first: ${errs[0].msg}`);
