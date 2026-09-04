// AC-5 — re-capture the four SHIPPED baseline fixtures, ONE AT A TIME, WITH THE DELTA RECORDED.
//
// ⭐ THE SAME INSTRUMENT volatile-delivery WROTE, REUSED RATHER THAN REWRITTEN (its header follows).
// One thing differs and it is the finding, not a defect: ⛔ FOUR PRESET VALUES MOVE HERE, where
// volatile-delivery's contract required ZERO. That is this workstream's whole point — `Ocean
// (temperate)` scored a 0.945 frost budget on a 295 K ocean world and always has, and `Rocky
// (Earthlike)` sat at 0.198. Both are SUPPOSED to move. They are enumerated by name below rather
// than waved through, and the script REFUSES to write if any preset outside that list moves.
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

// ⛔ THE PRESETS THAT MAY MOVE, BY NAME. Anything else moving is a bug in the law, not a recapture,
// and the script will refuse to write rather than bake it in. Both are warm wet worlds whose frost
// budget was set by volatiles alone: Ocean (temperate) 0.945 -> 0.657, Rocky (Earthlike) 0.198 -> 0.167
// (and each one's uPldStrength follows it, which is why it is four values and not two).
const PRESETS_MAY_MOVE = new Set(['Ocean (temperate)', 'Rocky (Earthlike)']);
const presetMovers = new Set();
const report = [];
for (const fn of FIXTURES) {
  const j = JSON.parse(readFileSync(F + fn, 'utf8'));
  const wasFrom = j.capturedFrom;
  const stats = { moved: 0, names: {}, missingPack: new Set(), missingName: new Set() };
  const pstats = { moved: 0, names: {}, missingPack: new Set(), missingName: new Set() };
  for (const [id, rec] of Object.entries(j.bodies)) patch(rec.packs || rec, head[id], stats, id);
  for (const [nm, rec] of Object.entries(j.presets || {})) {
    const before = pstats.moved;
    patch(rec.packs || rec, headPresets[nm], pstats, nm);
    if (pstats.moved > before) presetMovers.add(nm);
  }
  j.capturedFrom = sha;
  j.recapture = {
    at: '2026-09-05', workstream: 'frost-budget', previousCapturedFrom: wasFrom,
    reason: 'frostMaxCoverage gained its missing temperature term (frostPermanence, labCore): the budget was MEASURED identical from 100 K to 1200 K at the same volatileFraction, so a warm world scored a frozen world\'s snow budget. uPldStrength follows because it is frostMaxCoverage x (1-resurfacing) x 0.35. VALUES ONLY — structure, pack scope and key set are unchanged; uFrostLatChill is NEW and is deliberately NOT introduced here, so each fixture still pins exactly the packs and names it was written to pin.',
    bodyValuesMoved: stats.moved, presetValuesMoved: pstats.moved,
  };
  report.push({ fn, wasFrom, moved: stats.moved, presetMoved: pstats.moved,
    top: Object.entries(stats.names).sort((a, b) => b[1] - a[1]).slice(0, 6),
    missingPack: [...stats.missingPack], missingName: [...stats.missingName] });
  if (WRITE) writeFileSync(F + fn, JSON.stringify(j, null, 1));
}

const strays = [...presetMovers].filter((n) => !PRESETS_MAY_MOVE.has(n));
if (strays.length) {
  console.error('⛔ REFUSING TO WRITE — presets moved that this workstream did not declare: ' + strays.join(', '));
  console.error('   Declared movers: ' + [...PRESETS_MAY_MOVE].join(', '));
  process.exit(1);
}
console.log('presets that moved: ' + ([...presetMovers].join(', ') || 'none') + '  (declared: ' + [...PRESETS_MAY_MOVE].join(', ') + ')');
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
