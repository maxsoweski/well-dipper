// AC-5 / AC-6 — WHAT MOVED, AND THE PROOF THAT ONLY ONE FIELD MOVED IT.
//
// ⭐ THE CONTROL IS THE POINT. A before/after table shows that things moved; it cannot show WHY. So this
// runs the comparison a second time with the parent's OWN volatileFraction injected back into every HEAD
// body — nothing else restored — and asserts byte-identity with the parent fixture. If restoring one
// field restores every value, then every value that moved, moved BECAUSE of that field, and no second
// cause is hiding in the diff. (feedback_identical-output-needs-a-liveness-probe, run in reverse.)
import { readFileSync } from 'node:fs';
import { corpus, resolvedPacks, presetRows, MESH } from '/home/ax/projects/well-dipper/tests/fixtures/ray-pack-corpus.mjs';
import { labPackCtx } from '/home/ax/projects/well-dipper/src/objects/Planet.js';

const PARENT = JSON.parse(readFileSync('/home/ax/projects/well-dipper/tests/fixtures/volatile-delivery-parent-population.json', 'utf8'));

// ⚠ resolvedPacks returns { pack: { drivers: {...}, attributes: {...} } } — TWO levels, not one. A
// flattener that stops at the first level compares OBJECT REFERENCES and reports every value as moved
// on both arms, which is exactly how the first cut of this script produced an identical 1,662 on the
// diff AND on its own control. The control catching that is the reason it exists.
const enc = (v) => Array.isArray(v) ? v.join(',') : (ArrayBuffer.isView(v) ? `tv:${v.length}:${Array.from(v).join(',')}` : v);
const flat = (packs, out = {}) => {
  for (const [pk, pv] of Object.entries(packs)) for (const [grp, gv] of Object.entries(pv)) {
    if (gv && typeof gv === 'object' && !Array.isArray(gv) && !ArrayBuffer.isView(gv)) {
      for (const [n, v] of Object.entries(gv)) out[`${pk}.${grp}.${n}`] = enc(v);
    } else out[`${pk}.${grp}`] = enc(gv);
  }
  return out;
};
const diff = (a, b) => {
  const moved = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k], y = b[k];
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) < 1e-12) continue;
    moved.push({ k, from: x, to: y, d: (typeof x === 'number' && typeof y === 'number') ? Math.abs(x - y) : null });
  }
  return moved;
};

const build = (restore) => {
  const C = corpus();
  if (restore) for (const b of C) {
    const p = PARENT.sweep[b.id];
    if (p && b.cond?.composition) b.cond.composition.volatileFraction = p.volatileFraction;
  }
  const out = {};
  for (const b of C) out[b.id] = flat(resolvedPacks(b.cond, labPackCtx(b.d, b.cond, MESH)));
  return out;
};

const parentPacks = {};
for (const [id, r] of Object.entries(PARENT.packs)) parentPacks[id] = flat(r.packs);

// ── (1) THE BLAST RADIUS ────────────────────────────────────────────────────────────────────────
const head = build(false);
const byName = {}, byPack = {};
let total = 0;
for (const id of Object.keys(parentPacks)) {
  for (const m of diff(parentPacks[id], head[id])) {
    total++;
    const pack = m.k.split('.')[0];
    const nm = pack + '.' + m.k.split('.')[2]; byName[nm] = (byName[nm] || 0) + 1;
    byPack[pack] = (byPack[pack] || 0) + 1;
  }
}
const bodies = Object.keys(parentPacks).length;
const totalVals = Object.values(parentPacks).reduce((n, o) => n + Object.keys(o).length, 0);
console.log(`BLAST RADIUS — ${bodies} corpus bodies, ${totalVals} resolved driver values`);
console.log(`  moved: ${total} (${(100 * total / totalVals).toFixed(1)} %)\n`);
console.log('  by pack:');
for (const [k, v] of Object.entries(byPack).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(5)}  ${k}`);
console.log('\n  by uniform (top 25):');
for (const [k, v] of Object.entries(byName).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`    ${String(v).padStart(5)}  ${k}`);

// ── (2) THE ATTRIBUTION CONTROL ─────────────────────────────────────────────────────────────────
const restored = build(true);
let residual = 0; const resNames = {};
for (const id of Object.keys(parentPacks)) for (const m of diff(parentPacks[id], restored[id])) {
  residual++; const rn = m.k.split('.')[0] + '.' + m.k.split('.')[2]; resNames[rn] = (resNames[rn] || 0) + 1;
}
console.log(`\n[CONTROL] parent volatileFraction injected back, NOTHING else restored:`);
console.log(`  residual moved values: ${residual}`);
if (residual === 0) console.log('  ⇒ EVERY moved value is attributable to composition.volatileFraction alone.');
else { console.log('  ⇒ A SECOND CAUSE IS PRESENT. Residuals:'); for (const [k, v] of Object.entries(resNames).sort((a,b)=>b[1]-a[1]).slice(0,20)) console.log(`    ${String(v).padStart(5)}  ${k}`); }

// ── (3) VACUITY: the control must be capable of failing ─────────────────────────────────────────
console.log(`\n[CONTROL — vacuity] the restore had something to restore: ${total} values moved without it.`);
process.exit(residual === 0 && total > 0 ? 0 : 1);
