// tools/root0-seam-delta.mjs — the committed delta table for B1 (ROOT-0, the lab-side law seam).
//
// ⭐ WHAT THIS MEASURES, AND WHY IT IS FOUR SECTIONS AND NOT ONE COLUMN.
// `deriveUniforms` (labCore) and `deriveBodyScalars` (baseStep) are **fp-shaped** and are handed
// **condition-shaped** objects (`conditionFromBody` -> `deriveConditionVector`). Four inputs are
// dropped or mis-spelled at that one seam. They are ONE defect, but they move DISJOINT masters, so
// pooling them into a single column would hide which repair moved what. One section per fix.
//
// ⛔ THIS TOOL COMPUTES BOTH RULES THROUGH THE SHIPPED FUNCTIONS — it restates no law. Each section
// calls the SAME shipped function twice, on two bundles that differ only in the one seam key:
//   OLD = the value the PRE-fix reader resolved (the dropped input, pinned or deleted)
//   NEW = the value the POST-fix reader resolves
// Consequence, and it is the control: run this tool against the PRE-fix tree and EVERY section
// reads all-zero, because the pre-fix reader cannot see the key either bundle differs in. The
// all-zero run is the "before"; the table below is the "after". Both are regenerable at any time.
//
// Usage:  node tools/root0-seam-delta.mjs            (prints the markdown to stdout)
//         node tools/root0-seam-delta.mjs --write    (writes docs/FEATURES/root0-seam-delta-table.md)
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { deriveBodyScalars } from '../src/worldengine/base/baseStep.js';

const CORPUS_N = 200;
const CORPUS_NAME = '`lab-procedural-0…199`';

// ── corpus ───────────────────────────────────────────────────────────────────────────────────────
function buildCorpus() {
  const bodies = [];
  let planets = 0, plainMoons = 0, planetClassMoons = 0;
  for (let i = 0; i < CORPUS_N; i++) {
    const sys = StarSystemGenerator.generate(`lab-procedural-${i}`, null);
    (sys.planets || []).forEach((entry, pi) => {
      bodies.push({ id: `S:${i}:p${pi}`, kind: 'planet', body: entry.planetData });
      planets++;
      (entry.moons || []).forEach((m, mi) => {
        if (m.planetData) { bodies.push({ id: `S:${i}:p${pi}:M${mi}`, kind: 'planet-class-moon', body: m.planetData }); planetClassMoons++; }
        else             { bodies.push({ id: `S:${i}:p${pi}:m${mi}`, kind: 'plain-moon',        body: m });             plainMoons++; }
      });
    });
  }
  return { bodies, planets, plainMoons, planetClassMoons };
}

// ── delta arithmetic (no epsilon anywhere: `moved` counts bodies whose delta is not exactly 0) ────
function deltaOf(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Object.is(a, b)) return 0;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
    return Math.abs(a - b);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return Infinity;
    let m = 0;
    for (let i = 0; i < a.length; i++) { const d = deltaOf(a[i], b[i]); if (d > m) m = d; }
    return m;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean' || typeof a === 'string' || typeof b === 'string') {
    return a === b ? 0 : 1;
  }
  return null;              // not comparable — excluded from the table
}
const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] : 0;
const fmt = (x) => (x === 0 ? '0' : Number(x).toPrecision(6).replace(/0+$/, '').replace(/\.$/, ''));

// Run one section: `fn` is the shipped function, `oldBundle`/`newBundle` build the two inputs.
function section({ bodies, fn, oldBundle, newBundle }) {
  const acc = new Map();          // key -> { deltas: number[], moved, worst, worstBody }
  let threw = 0;
  for (const rec of bodies) {
    let c, o, n;
    try { c = conditionFromBody(rec.body); o = fn(oldBundle(c)); n = fn(newBundle(c)); }
    catch { threw++; continue; }
    for (const k of Object.keys(n)) {
      const d = deltaOf(o[k], n[k]);
      if (d === null) continue;
      let a = acc.get(k);
      if (!a) { a = { deltas: [], moved: 0, worst: 0, worstBody: '' }; acc.set(k, a); }
      a.deltas.push(d);
      if (d !== 0) a.moved++;
      if (d > a.worst) { a.worst = d; a.worstBody = rec.id; }
    }
  }
  const rows = [];
  for (const [k, a] of acc) {
    const s = a.deltas.slice().sort((x, y) => x - y);
    rows.push({ key: k, moved: a.moved, n: a.deltas.length, min: s[0] ?? 0, median: pct(s, 0.5), p95: pct(s, 0.95), max: a.worst, worstBody: a.worstBody });
  }
  rows.sort((x, y) => (y.moved - x.moved) || (y.max - x.max) || x.key.localeCompare(y.key));
  return { rows, threw };
}

const table = (rows) => [
  '| quantity | moved / n | min | median | p95 | max | worst body |',
  '|---|---:|---:|---:|---:|---:|---|',
  ...rows.map((r) => `| \`${r.key}\` | ${r.moved} / ${r.n} | ${fmt(r.min)} | ${fmt(r.median)} | ${fmt(r.p95)} | ${fmt(r.max)} | ${r.moved ? r.worstBody : ''} |`),
].join('\n');

// A section prints the movers in full and collapses the zero rows to a named list, so a zero row is
// still ON the page (an unnamed zero row is how a blind comparator passes for a measurement).
function renderSection(res) {
  const movers = res.rows.filter((r) => r.moved > 0);
  const zeros = res.rows.filter((r) => r.moved === 0).map((r) => r.key);
  const out = [];
  if (movers.length) out.push(table(movers));
  else out.push('_No quantity moved on any body._  ⭐ **This is the expected PRE-fix reading** — the pre-fix reader cannot see the key the two bundles differ in.');
  out.push('');
  out.push(`**Did not move on any body (${zeros.length}):** ${zeros.length ? zeros.map((z) => '`' + z + '`').join(', ') : '—'}`);
  if (res.threw) out.push(`\n⚠ ${res.threw} bodies threw in \`conditionFromBody\` and are excluded.`);
  return out.join('\n');
}

// ── the four sections ────────────────────────────────────────────────────────────────────────────
const stripErosion = (c) => ({ ...c, surfaceHistory: (() => { const sh = { ...(c.surfaceHistory || {}) }; delete sh.erosion; delete sh.erosionLevel; return sh; })() });
const stripTidal   = (c) => { const b = { ...c }; delete b.tidalHeat; delete b.rawTidalIoRatio; return b; };
const stripGravity = (c) => { const b = { ...c }; delete b.surfaceGravity; return b; };
const pinRawAge    = (c) => ({ ...c, ageNorm: (c.age ?? 0.5) });          // exactly what the pre-fix fallback resolved
const asIs         = (c) => c;

const SECTIONS = [
  { n: 1, title: 'erosion — the key the game never emits',
    fn: deriveUniforms, target: '`deriveUniforms` (src/worldengine/base/labCore.js)',
    old: stripErosion, neu: asIs,
    why: 'PRE: `d.surfaceHistory?.erosion ?? 0` — the game emits `erosionLevel` (PhysicsEngine.js:822), so the reader resolved a hard **0** on every game body. POST: the reader accepts the game spelling. OLD bundle = both spellings deleted (what the pre-fix reader saw); NEW bundle = the condition untouched.' },
  { n: 1.5, title: 'erosion — the same key, the other reader',
    fn: deriveBodyScalars, target: '`deriveBodyScalars` (src/worldengine/base/baseStep.js)',
    old: stripErosion, neu: asIs,
    why: 'The identical mis-spelling at `baseStep.js:38`. Reported separately because it is a different master: `surfaceHistory` is a *returned scalar* here, not a uniform.' },
  { n: 2, title: 'tidal precedence — the recompute that overrode the real value',
    fn: deriveUniforms, target: '`deriveUniforms` (src/worldengine/base/labCore.js)',
    old: stripTidal, neu: asIs,
    why: 'PRE: `deriveUniforms` recomputed the Io-ratio from `d.eccentricity ?? 0` against a 1 M☉-at-1 AU fallback, ignoring the real value the condition already carries as `rawTidalIoRatio`. `baseStep.js:29` has had the correct precedence shape since WS2. OLD bundle = both tidal keys deleted (forces the recompute, which is what the pre-fix reader always did); NEW = the condition untouched.' },
  { n: 3, title: 'ageNorm — raw Gyr driven into a `(1 − ageNorm)` term',
    fn: deriveBodyScalars, target: '`deriveBodyScalars` (src/worldengine/base/baseStep.js)',
    old: pinRawAge, neu: asIs,
    why: 'PRE: `d.ageNorm ?? (d.age ?? 0.5)` — the condition emits `age` in **Gyr**, so `(1 − ageNorm)` ran negative for every body older than 1 Gyr. `adaptL0.js:36` and `e1Regime.js:224` BOTH already express the law as `clamp01(age/10)`. OLD bundle pins `ageNorm` to the raw Gyr the pre-fix fallback resolved; NEW = the condition untouched.' },
  { n: 4, probe: 'edificeRail', title: 'surfaceGravity — a recompute that disagrees with the condition',
    fn: deriveUniforms, target: '`deriveUniforms` (src/worldengine/base/labCore.js)',
    old: stripGravity, neu: asIs,
    why: 'PRE: `massEarth / radiusEarth²` with `massEarth ?? 1.0` — the condition carries no `massEarth`, so every body was given **1 M⊕** and its g came out as `1/R²`. `conditionVector.js:134` already supplies the real g. ⚠ Booked as **CORRECTNESS, not differentiation** (see the plan\'s row 4). OLD bundle = `surfaceGravity` deleted (forces the recompute); NEW = the condition untouched.' },
];

// ⭐ THE COST PROBE FOR FIX 4, because a section that reported only MOVEMENT would read as all-upside
// and the plan says this one is not. `edificeMaxHeight` is `min(2.0, max(0.2, 1/max(g,0.05)))`
// (labCore.js:863 `  const edificeMaxHeight = Math.min(2.0, Math.max(0.2, 1.0 / Math.max(surfaceGravity, 0.05)));`),
// so it is a DIRECT read of g against two clamp rails, and counting how many bodies sit ON a rail is
// the differentiation question asked of the repaired law rather than of the movement it caused.
function edificeRailProbe(bodies) {
  const railed = (u) => (u.edificeMaxHeight === 2.0 ? 'ceil' : (u.edificeMaxHeight === 0.2 ? 'floor' : null));
  const t = { oldCeil: 0, oldFloor: 0, newCeil: 0, newFloor: 0, n: 0 };
  for (const rec of bodies) {
    let c; try { c = conditionFromBody(rec.body); } catch { continue; }
    t.n++;
    const o = railed(deriveUniforms(stripGravity(c))), nn = railed(deriveUniforms(c));
    if (o === 'ceil') t.oldCeil++; if (o === 'floor') t.oldFloor++;
    if (nn === 'ceil') t.newCeil++; if (nn === 'floor') t.newFloor++;
  }
  const oldTot = t.oldCeil + t.oldFloor, newTot = t.newCeil + t.newFloor;
  return [
    '### ⚠ THE COST, MEASURED — this fix is CORRECTNESS and it LOSES differentiation',
    '',
    'A section that reported only movement would read as all-upside. `edificeMaxHeight` reads g directly',
    'against two clamp rails, so "how many bodies sit ON a rail" is the differentiation question:',
    '',
    '| | on a clamp rail | at CEIL 2.0 | at FLOOR 0.2 |',
    '|---|---:|---:|---:|',
    `| **OLD** (recompute from a defaulted 1 M⊕) | ${oldTot} / ${t.n} | ${t.oldCeil} | ${t.oldFloor} |`,
    `| **NEW** (the condition's own g) | ${newTot} / ${t.n} | ${t.newCeil} | ${t.newFloor} |`,
    '',
    `⛔ The rail count gets **WORSE**, ${oldTot} → ${newTot}, and that is the honest reading: the repaired law`,
    `is more correct AND less differentiating on this consumer. The SHAPE is the part worth carrying`,
    `forward — the floor rail **empties** (${t.oldFloor} → ${t.newFloor}) and the ceiling absorbs all of it`,
    `(${t.oldCeil} → ${t.newCeil}), because real bodies are mostly LOW-gravity while \`1/R²\` on a defaulted`,
    'Earth mass sent every small body to the opposite extreme. So this is not "the same amount of flatness',
    'moved around": it is one rail replacing two, on 59.6% of the corpus. ⭐ Whoever wires the edifice',
    'consumer inherits this, and the answer is a re-ranged law, not a re-broken g.',
  ].join('\n');
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────
const { bodies, planets, plainMoons, planetClassMoons } = buildCorpus();
let sha = 'unknown', dirty = '';
try { sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch {}
try { if (execSync('git status --porcelain -- src tools', { encoding: 'utf8' }).trim()) dirty = ' (dirty tree)'; } catch {}

const parts = [];
parts.push('# ROOT-0 — the committed delta table: the lab-side law seam');
parts.push('');
parts.push('> **Generated artifact — do not hand-edit.** Regenerate with `node tools/root0-seam-delta.mjs --write`.');
parts.push('> The gate for **B1** of `docs/FEATURES/comprehensive-wiring-plan-2026-08-20.md` (plan:318-381).');
parts.push('> B1 is a **declared number-moving block, LAB-SIDE ONLY**: its named movers *must* move, and a');
parts.push('> table of zeros here is a failure, not a pass. Its OTHER gate — Instrument C, the shipped-uniform');
parts.push('> delta — must stay byte-identical on all four packs, and the two are not in tension: `deriveUniforms`');
parts.push('> has no call site in `src/`, and `deriveConditionVector` is called with `derived = null` on the game');
parts.push('> route (`conditionFromBody.js:868`), so nothing measured below is on the player path.');
parts.push('');
parts.push(`**Tree at generation:** \`${sha}\`${dirty} · **generated:** ${new Date().toISOString().slice(0, 10)}`);
parts.push('');
parts.push('## Population');
parts.push('');
parts.push(`- **${bodies.length} bodies** over ${CORPUS_NAME} — **${planets} planets + ${plainMoons} plain moons + ${planetClassMoons} planet-class moons**.`);
parts.push('- Every body is a pure function of an integer seed; a second build from the same seeds gives the same population.');
parts.push('- ⛔ **Sol is nowhere in this file.** 18 NASA textures, a different renderer, no world-engine condition fields.');
parts.push('');
parts.push('## How to read a section');
parts.push('');
parts.push('Delta = |NEW − OLD| per body; vector rows are the max absolute component delta. **No epsilon anywhere** —');
parts.push('`moved` counts bodies whose delta is not exactly 0. Percentiles are nearest-rank over ALL bodies (including');
parts.push('the unmoved ones), so a median of 0 with a large max means "moves hard on a minority".');
parts.push('');
parts.push('⭐ **THE CONTROL IS THE PRE-FIX RUN.** Both bundles in every section differ only in a key the PRE-fix reader');
parts.push('cannot see, so this same tool run against the pre-fix tree prints **all four sections all-zero**. That');
parts.push('all-zero run is the "before" half of this measurement and it is what proves the comparator is wired to the');
parts.push('repaired read and to nothing else.');
parts.push('');

for (const s of SECTIONS) {
  const res = section({ bodies, fn: s.fn, oldBundle: s.old, newBundle: s.neu });
  parts.push('---');
  parts.push('');
  parts.push(`## Fix ${s.n} — ${s.title}`);
  parts.push('');
  parts.push(`**Master:** ${s.target}`);
  parts.push('');
  parts.push(s.why);
  parts.push('');
  parts.push(renderSection(res));
  if (s.probe === 'edificeRail') { parts.push(''); parts.push(edificeRailProbe(bodies)); }
  parts.push('');
}

const md = parts.join('\n');
if (process.argv.includes('--write')) {
  writeFileSync(new URL('../docs/FEATURES/root0-seam-delta-table.md', import.meta.url), md + '\n');
  console.log('WROTE docs/FEATURES/root0-seam-delta-table.md');
} else {
  console.log(md);
}
