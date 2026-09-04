// AC-6 — what moves in each of the four SHIPPED baseline fixtures, measured BEFORE any re-capture.
// ⛔ No fixture is re-captured silently. This produces the per-fixture row that goes in DEVIATIONS.md.
import { readFileSync } from 'node:fs';
import { corpus, resolvedPacks, presetRows, MESH } from '/home/ax/projects/well-dipper/tests/fixtures/ray-pack-corpus.mjs';
import { labPackCtx } from '/home/ax/projects/well-dipper/src/objects/Planet.js';

const F = '/home/ax/projects/well-dipper/tests/fixtures/';
const FIXTURES = ['pack-drivers-baseline.json', 'ray-pack-drivers-baseline.json',
                  'term-pack-drivers-baseline.json', 'solidrelief-pack-drivers-baseline.json'];

const enc = (v) => Array.isArray(v) ? v.join(',') : (ArrayBuffer.isView(v) ? Array.from(v).join(',') : v);
const flat = (packs, out = {}) => {
  for (const [pk, pv] of Object.entries(packs || {})) for (const [grp, gv] of Object.entries(pv || {})) {
    if (gv && typeof gv === 'object' && !Array.isArray(gv) && !ArrayBuffer.isView(gv))
      for (const [n, v] of Object.entries(gv)) out[`${pk}.${n}`] = enc(v);
    else out[`${pk}.${grp}`] = enc(gv);
  }
  return out;
};

const C = corpus();
const head = {};
for (const b of C) head[b.id] = flat(resolvedPacks(b.cond, labPackCtx(b.d, b.cond, MESH)));
const headPresets = {};
for (const { name, cond, ctx } of presetRows()) headPresets[name] = flat(resolvedPacks(cond, ctx));

for (const fn of FIXTURES) {
  let j; try { j = JSON.parse(readFileSync(F + fn, 'utf8')); } catch { console.log(`${fn}: NOT FOUND`); continue; }
  const bodies = j.bodies || j.corpus || {};
  const presets = j.presets || {};
  let moved = 0, total = 0, maxD = 0; const names = {}; let presetMoved = 0, presetTotal = 0;
  for (const [id, rec] of Object.entries(bodies)) {
    const was = flat(rec.packs || rec);
    const now = head[id]; if (!now) continue;
    for (const k of Object.keys(was)) {
      total++;
      const a = was[k], b = now[k];
      if (a === b) continue;
      if (typeof a === 'number' && typeof b === 'number') { const d = Math.abs(a - b); if (d < 1e-12) continue; maxD = Math.max(maxD, d); }
      moved++; const nm = k; names[nm] = (names[nm] || 0) + 1;
    }
  }
  for (const [nm, rec] of Object.entries(presets)) {
    const was = flat(rec.packs || rec), now = headPresets[nm]; if (!now) continue;
    for (const k of Object.keys(was)) { presetTotal++; if (was[k] !== now[k]) presetMoved++; }
  }
  console.log(`\n${fn}   capturedFrom ${j.capturedFrom ?? '?'}`);
  console.log(`  corpus values: ${moved} of ${total} moved (${(100*moved/Math.max(total,1)).toFixed(1)} %)   max |Δ| ${maxD.toExponential(2)}`);
  console.log(`  PRESET values: ${presetMoved} of ${presetTotal} moved  ${presetMoved === 0 ? '⭐ ZERO — the 18 driver presets are untouched, as the contract requires' : '⛔ A PRESET MOVED — presets are dev fixtures and must not'}`);
  const top = Object.entries(names).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if (top.length) console.log('  top names:', top.map(([k,v])=>`${k}×${v}`).join(', '));
}
