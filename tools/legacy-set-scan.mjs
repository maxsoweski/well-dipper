// tools/legacy-set-scan.mjs — AC1 of the `one-route-shared-driver-path` workstream.
//
// ⭐ WHY THIS EXISTS, in Max's words (2026-08-21): "we have develop features in world engine that are
// now legacy and not actually used in the lod lab; i don't want to waste time on those." `applyDrivers`
// is 828 lines and some of what it reaches is dead. Extracting wholesale would carry that into the
// shared pipeline permanently, where every future reader pays for it. So the legacy set is NAMED,
// with evidence, BEFORE anything moves.
//
// ⛔ WHAT THIS DELIBERATELY DOES NOT FLAG, because the naive version is useless: an exported CONSTANT
// with no consumer. Measured at authoring — 344 exported symbols have zero non-test consumers, and the
// large majority are physical constants (`DENS_ICE_HI`, `VOL_LO`, `HAZE_T_COLD`) exported so a test can
// pin them. Exporting a constant for testability is correct practice, not rot. Flagging them would bury
// the real finding under noise and the list would be ignored — which is how a legacy list dies.
//
// THE THREE FRONT-ENDS, all tracked, none of them optional:
//   · world-engine-lab.html      — the LOD lab, the authoring surface
//   · the game                 — every src/ file outside src/worldengine/ that reaches into it
//   · worldengine-fieldviz.html — the field-visualiser harness. ⚠ NAMED EXPLICITLY because omitting
//     it would falsely condemn `base/fieldViz.js`, which it is the only consumer of.
//
// ⚠ A TEST-ONLY CONSUMER IS NOT A CONSUMER, and that is the whole point of the `tested` column rather
// than an exclusion: a law with tests and no front-end is EXACTLY the thing Max is describing — work
// that was done, proven correct, and never connected to anything. Tests prove it works; they do not
// prove anyone wants it.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripCommentsPreservingOffsets, jsFilesUnder } from '../tests/helpers/source-scan.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = 'src/worldengine';
const FRONT_ENDS = ['world-engine-lab.html', 'worldengine-fieldviz.html'];

const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;
// Only `export function|class` — a LAW. `export const` is excluded by construction; see the header.
const LAW = /(?:^|\n)export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/g;

const read = (rel) => stripCommentsPreservingOffsets(readFileSync(join(ROOT, rel), 'utf8'), { blankLiteralText: false });

function importsOf(rel) {
  const out = [];
  for (const m of read(rel).matchAll(SPEC)) {
    const s = m[2];
    if (!s.startsWith('.') && !s.startsWith('/')) continue;
    const abs = s.startsWith('/') ? join(ROOT, s) : resolve(join(ROOT, dirname(rel)), s);
    const r = relative(ROOT, abs).split('\\').join('/');
    if (existsSync(join(ROOT, r))) out.push(r);
  }
  return out;
}

function closure(roots) {
  const seen = new Set(); const stack = [...roots];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    try { for (const d of importsOf(f)) if (!seen.has(d)) stack.push(d); } catch { /* leaf */ }
  }
  return seen;
}

const engineFiles = jsFilesUnder(ROOT, ENGINE);
const gameEntries = jsFilesUnder(ROOT, 'src')
  .filter((f) => !f.startsWith(`${ENGINE}/`) && importsOf(f).some((d) => d.startsWith(`${ENGINE}/`)));

const reach = {
  game: closure(gameEntries),
  lab: closure(['world-engine-lab.html']),
  fieldviz: closure(['worldengine-fieldviz.html']),
};
const liveSomewhere = (f) => reach.game.has(f) || reach.lab.has(f) || reach.fieldviz.has(f);

// Consumer text: every tracked file that could name a symbol.
const consumerFiles = new Set([
  ...jsFilesUnder(ROOT, 'src'), ...jsFilesUnder(ROOT, 'tests'), ...FRONT_ENDS,
  ...readdirSync(ROOT).filter((f) => /\.(js|mjs|html)$/.test(f)),
]);
const consumerText = new Map();
for (const c of consumerFiles) { try { consumerText.set(c, read(c)); } catch { /* unreadable */ } }

const deadModules = [];
const deadLaws = [];
for (const f of engineFiles) {
  if (!liveSomewhere(f)) {
    const testers = [...consumerText.keys()].filter((c) => c.startsWith('tests/') && consumerText.get(c).includes(f.split('/').pop()));
    deadModules.push({ file: f, testers: testers.length });
    continue;                                   // its laws are covered by the module verdict
  }
  const code = readFileSync(join(ROOT, f), 'utf8');
  for (const m of stripCommentsPreservingOffsets(code).matchAll(LAW)) {
    const sym = m[1];
    const re = new RegExp(`\\b${sym}\\b`);
    // ⛔⛔ A SAME-FILE REFERENCE COUNTS AS USE, AND THE FIRST VERSION OF THIS SCAN GOT IT WRONG IN THE
    // MOST EMBARRASSING POSSIBLE WAY: excluding same-file references reported `rockySurface.js`,
    // `solidOptics.js`, `solidFeatures.js` and `polarDeck.js` as WHOLLY UNREACHED — the four shipped
    // driver packs B7 put in front of players. They are consumed through an exported `*_ENTRY` const
    // that names the pack function IN THE SAME FILE, so the only reference is one the scan refused to
    // look at. A legacy list that condemns shipped features is worse than no list.
    // ⚠ THE `g` FLAG IS LOAD-BEARING AND ITS ABSENCE COST A ROUND: String.match WITHOUT it returns
    // only the FIRST match, so this counter read 1 for every symbol and the guard below never fired.
    const selfRefs = (code.match(new RegExp(`\\b${sym}\\b`, 'g')) || []).length;
    let prod = 0, test = 0;
    for (const [c, t] of consumerText) {
      if (c === f || !re.test(t)) continue;
      if (c.startsWith('tests/')) test++; else prod++;
    }
    // >1 because the definition itself is one match. A second occurrence in a LIVE module means some
    // other binding here names it, and that binding may well be the exported one.
    if (prod === 0 && selfRefs <= 1) deadLaws.push({ file: f, sym, test });
  }
}

const p = (s) => process.stdout.write(s + '\n');
p('');
p('LEGACY-SET SCAN — world-engine code no front-end exercises');
p('='.repeat(72));
p(`engine modules: ${engineFiles.length} · reached by lab ${engineFiles.filter((f) => reach.lab.has(f)).length}` +
  ` · game ${engineFiles.filter((f) => reach.game.has(f)).length} · fieldviz ${engineFiles.filter((f) => reach.fieldviz.has(f)).length}`);
p('');
p(`── DEAD MODULES — no front-end imports them at all (${deadModules.length}) ──`);
for (const d of deadModules) p(`   ${d.file}${d.testers ? `   [${d.testers} test file(s) import it — tested, unused]` : '   [nothing imports it at all]'}`);
p('');
p(`── DEAD LAWS — exported function/class in a LIVE module, no front-end consumer (${deadLaws.length}) ──`);
let cur = '';
for (const d of deadLaws.sort((a, b) => a.file.localeCompare(b.file) || a.sym.localeCompare(b.sym))) {
  if (d.file !== cur) { cur = d.file; p(`   ${cur}`); }
  p(`      ${d.sym}${d.test ? `   [tested x${d.test}, no front-end]` : '   [NO consumer at all]'}`);
}
p('');
// ── ROLLUP BY MODULE — the unit Max actually rules on ──────────────────────────────────────────
// ⚠ WHY THE PER-SYMBOL LIST ABOVE OVERSTATES, stated rather than left for a reader to trip on: a
// same-file caller is excluded by construction (`c === f`), so when a whole subgraph is unreached
// EVERY symbol in it is listed individually even though they call each other. `craterAmplitude` is
// called at bombardment.js:253 — by `relaxedCraterProfile`, which is itself unreached. The honest
// unit is therefore the CLUSTER, not the symbol: a module where EVERY law is unreached is a feature
// area no front-end has ever asked for; one where only some are is a live module with dead branches,
// and those two want different decisions.
const totalLaws = new Map();
for (const f of engineFiles) {
  if (!liveSomewhere(f)) continue;
  const n = [...stripCommentsPreservingOffsets(readFileSync(join(ROOT, f), 'utf8')).matchAll(LAW)].length;
  if (n) totalLaws.set(f, n);
}
const deadByFile = new Map();
for (const d of deadLaws) deadByFile.set(d.file, (deadByFile.get(d.file) || 0) + 1);
const whole = [], partial = [];
for (const [f, dn] of deadByFile) ((dn === totalLaws.get(f)) ? whole : partial).push([f, dn, totalLaws.get(f)]);
p(`── WHOLLY UNREACHED MODULES — every law in them, no front-end (${whole.length}) ──`);
p('   These are feature areas nothing has ever asked for. The clearest "legacy" candidates.');
for (const [f, dn] of whole.sort()) p(`   ${f}   [${dn}/${dn} laws]`);
p('');
p(`── PARTIALLY UNREACHED — live modules carrying dead branches (${partial.length}) ──`);
p('   ⚠ These are NOT delete candidates. The module is in use; some branch of it is not.');
for (const [f, dn, tot] of partial.sort((a, b) => b[1] - a[1])) p(`   ${f}   [${dn}/${tot} laws unreached]`);
p('');
p(`TOTAL: ${deadModules.length} dead module(s), ${whole.length} wholly-unreached module(s), ` +
  `${partial.length} partially-unreached, ${deadLaws.length} unreached law(s) in all.`);
p('⚠ This is a CANDIDATE list for Max to rule on. "Unused" is measured; "deprecated" is his call.');
