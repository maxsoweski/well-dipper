// AC-6 — re-capture the four SHIPPED baseline fixtures, ONE AT A TIME, WITH THE DELTA RECORDED.
//
// ⛔ SURGICAL, NOT REGENERATED, AND THE REASON IS SCOPE. Three of the four store only the FOUR packs
// that existed when they were captured (rockySurface, solidOptics, solidFeatures, fluvialDeck); running
// today's capture over them would silently widen each fixture to eleven packs. That is a different
// change from "the values these suites already pin have moved", and it would quietly retire coverage
// each shipped workstream wrote on purpose. So this walks each fixture's OWN key set and replaces only
// the values, leaving structure, pack scope and every other top-level field byte-identical.
//
//   node --import ./scripts/node-alias-motion-test-kit.mjs docs/WORKSTREAMS/volatile-delivery/recapture-fixtures.mjs [--write]
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { corpus, resolvedPacks, presetRows, MESH } from '/home/ax/projects/well-dipper/tests/fixtures/ray-pack-corpus.mjs';
import { labPackCtx } from '/home/ax/projects/well-dipper/src/objects/Planet.js';

const WRITE = process.argv.includes('--write');
const F = '/home/ax/projects/well-dipper/tests/fixtures/';
const FIXTURES = ['pack-drivers-baseline.json', 'ray-pack-drivers-baseline.json',
                  'term-pack-drivers-baseline.json', 'solidrelief-pack-drivers-baseline.json'];
const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();

const C = corpus();
const head = {}, headPresets = {};
for (const b of C) head[b.id] = resolvedPacks(b.cond, labPackCtx(b.d, b.cond, MESH));
for (const { name, cond, ctx } of presetRows()) headPresets[name] = resolvedPacks(cond, ctx);

const same = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (typeof a === 'number' && typeof b === 'number') return a === b || Math.abs(a - b) < 1e-12;
  return a === b;
};
// Walk a fixture record's OWN keys only; never introduce a key the fixture did not already carry.
const patch = (was, now, stats, path) => {
  for (const pk of Object.keys(was)) {
    const nowPack = now?.[pk];
    if (!nowPack) { stats.missingPack.add(pk); continue; }
    for (const grp of ['drivers', 'attributes']) {
      if (!was[pk][grp]) continue;
      for (const n of Object.keys(was[pk][grp])) {
        if (!(n in (nowPack[grp] || {}))) { stats.missingName.add(`${pk}.${n}`); continue; }
        const a = was[pk][grp][n], b = nowPack[grp][n];
        if (same(a, b)) continue;
        was[pk][grp][n] = JSON.parse(JSON.stringify(b));
        stats.moved++; stats.names[`${pk}.${n}`] = (stats.names[`${pk}.${n}`] || 0) + 1;
      }
    }
  }
};

const report = [];
for (const fn of FIXTURES) {
  const j = JSON.parse(readFileSync(F + fn, 'utf8'));
  const wasFrom = j.capturedFrom;
  const stats = { moved: 0, names: {}, missingPack: new Set(), missingName: new Set() };
  const pstats = { moved: 0, names: {}, missingPack: new Set(), missingName: new Set() };
  for (const [id, rec] of Object.entries(j.bodies)) patch(rec.packs || rec, head[id], stats, id);
  for (const [nm, rec] of Object.entries(j.presets || {})) patch(rec.packs || rec, headPresets[nm], pstats, nm);
  j.capturedFrom = sha;
  j.recapture = {
    at: '2026-09-04', workstream: 'volatile-delivery', previousCapturedFrom: wasFrom,
    reason: 'deriveComposition gained a surface-volatile delivery term (PhysicsEngine §3b), so composition.volatileFraction moves on every body. VALUES ONLY — structure, pack scope and key set are unchanged; this fixture still pins exactly the packs it was written to pin.',
    bodyValuesMoved: stats.moved, presetValuesMoved: pstats.moved,
  };
  report.push({ fn, wasFrom, moved: stats.moved, presetMoved: pstats.moved,
    top: Object.entries(stats.names).sort((a, b) => b[1] - a[1]).slice(0, 6),
    missingPack: [...stats.missingPack], missingName: [...stats.missingName] });
  if (WRITE) writeFileSync(F + fn, JSON.stringify(j, null, 1));
}

console.log(WRITE ? 'WROTE (values only)\n' : 'DRY RUN — pass --write to apply\n');
for (const r of report) {
  console.log(`${r.fn}`);
  console.log(`  capturedFrom ${r.wasFrom} -> ${sha}`);
  console.log(`  body driver values moved : ${r.moved}`);
  console.log(`  PRESET values moved      : ${r.presetMoved}  ${r.presetMoved === 0 ? '⭐ zero — the 18 dev-fixture presets are untouched' : '⛔ A PRESET MOVED'}`);
  if (r.missingPack.length) console.log(`  ⛔ packs in the fixture but absent at HEAD: ${r.missingPack.join(', ')}`);
  if (r.missingName.length) console.log(`  ⛔ names in the fixture but absent at HEAD: ${r.missingName.slice(0, 8).join(', ')}${r.missingName.length > 8 ? ` (+${r.missingName.length - 8})` : ''}`);
  console.log(`  top: ${r.top.map(([k, v]) => `${k}×${v}`).join(', ')}\n`);
}
