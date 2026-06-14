// scripts/gen-render-audit.mjs
// Tier-2 Phase 2.5 report generator. Reads the GPU render-delta sweep dump
// (docs/FEATURES/.sweep-raw.json, produced by window._lab.renderDeltaSweep over
// all 17 DRIVER_PRESETS via chrome-devtools on :9223), runs it through the pure
// auditor (lab-render-audit.js) against the manifest, and writes the human-facing
// audit report docs/FEATURES/lab-render-audit.md (preset×feature table grouped by
// province group, violations punch-list at top).
//
// Re-run after a fresh sweep:  node scripts/gen-render-audit.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { ASSOCIATIONS, PROVINCE_GROUPS } from '../planet-feature-associations.js';
import { expectedMatrix, auditRenderMatrix } from '../lab-render-audit.js';

const EPS = 1e-4;        // render/inert boundary: ≈14px of 140k; floor is exactly 0 (frozen+deterministic)
const STRONG = 5e-4;     // false-renders above this are "solid", below are "faint trace"

// ── load + un-double-encode the sweep dump ──────────────────────────────────
let d = JSON.parse(readFileSync(new URL('../docs/FEATURES/.sweep-raw.json', import.meta.url), 'utf8'));
if (typeof d === 'string') d = JSON.parse(d);              // chrome-devtools filePath wraps the string
const presets = Object.keys(d);
const features = Object.keys(ASSOCIATIONS);

// short column codes (the full preset names are too wide for a 17-col table)
const CODE = {
  'Rocky (Earthlike)':'Rocky','Lava (hot airless)':'Lava','Ocean (temperate)':'Ocean',
  'Titan (methane seas)':'Titan','Frozen (airless)':'Frozen','Europa (icy moon)':'Europa',
  'Gas giant (Jovian)':'GasJ','Gas giant (Saturnian)':'GasS','Ice giant (Neptunian)':'IceN',
  'Venus (sulfuric shroud)':'Venus','Sub-Neptune (hazy)':'SubN','Eyeball (locked temperate)':'Eye',
  'Hot Jupiter (locked giant)':'HotJ','Mars (arid rocky)':'Mars','Magma (K2-141b)':'Magma',
  'Carbon (high C/O)':'Carbon','Crystal (faceted)':'Cryst',
};

// ── build matrices ──────────────────────────────────────────────────────────
const manifest = Object.fromEntries(features.map(f => [f, { rendersOn: ASSOCIATIONS[f].rendersOn || [] }]));
const expected = expectedMatrix(manifest, presets);
const deltas = {};
for (const f of features) { deltas[f] = {}; for (const p of presets) deltas[f][p] = (d[p].deltas[f] ?? 0); }
const { falseRenders, deadRenders } = auditRenderMatrix(expected, deltas, { eps: EPS });

// degenerate cells (mechanical failure on a should-render preset)
const degenerates = [];
for (const p of presets) for (const f of features) {
  const g = d[p].degenerate?.[f];
  if (g) degenerates.push({ feature: f, preset: p, kind: g, should: expected[f][p] });
}

// ── group features by province group (the "association group" the report reads as) ──
const groupOrder = Object.keys(PROVINCE_GROUPS);
const byGroup = {};
for (const f of features) {
  const g = ASSOCIATIONS[f].provinceGroup || 'global';
  (byGroup[g] ||= []).push(f);
}

// ── cell glyph ──────────────────────────────────────────────────────────────
function glyph(f, p) {
  const should = expected[f][p];
  const v = deltas[f][p];
  const renders = v > EPS;
  if (should && renders)   return '✅';
  if (should && !renders)  return '⚠️D';   // dead-render: declared, inert
  if (!should && renders)  return (v > STRONG ? '🔴F' : '⚠️F');  // false-render (strong / faint)
  return '·';                              // correctly inert
}

// ── render markdown ───────────────────────────────────────────────────────────
const L = [];
L.push('# Lab render-audit — Tier-2 correspondence gate (Phase 2.5)');
L.push('');
L.push('> **Generated** by `scripts/gen-render-audit.mjs` from a live GPU render-delta sweep');
L.push('> (`window._lab.renderDeltaSweep()` over all 17 `DRIVER_PRESETS`, chrome-devtools on the');
L.push('> RTX-5080 `:9223` Chrome). Each cell is a feature\'s **player-visible marginal contribution**');
L.push('> on a preset, measured as an A/B pixel delta on the low-res `sceneTarget`.');
L.push('');
L.push('## How each cell is measured (read this before triaging)');
L.push('');
L.push('**Baseline = the preset\'s NATURAL planet, not a bare solo.** For each (preset, feature):');
L.push('`ON = relevantFeatureSet(preset) ∪ {feature}`, `OFF = relevantFeatureSet(preset) \\ {feature}`.');
L.push('The delta is the **fraction of frame pixels that differ by >12/255 summed-abs RGB** between');
L.push('ON and OFF. This answers the question the audit actually cares about — *"does toggling this');
L.push('feature change the planet the player sees on this preset?"* — so a surface feature hidden');
L.push('under a gas giant\'s atmosphere correctly reads as **not rendering** (≈0 delta).');
L.push('');
L.push('> **Methodology note (decided this session, diverges from the literal plan).** The plan\'s');
L.push('> Phase-2.5 spec said "in-context solo (`{feature} ∪ isolationKit`) ON vs OFF". Implementing it');
L.push('> revealed that soloing a surface feature *strips the preset\'s own atmosphere/bands*, exposing a');
L.push('> bare terrain sphere the feature obviously paints — measuring **capability** (can it paint the');
L.push('> geometry?) rather than **visibility** (does the player see it?). That inflated false-renders to');
L.push('> 185, dominated by "mountains/hexTess render on a stripped gas giant" — not the bug Max is');
L.push('> hunting. The natural-baseline above measures visibility instead. **The raw solo+kit capability');
L.push('> data is still in `.sweep-raw.json` history if a capability lens is wanted; this report is the');
L.push('> visibility lens.** `isolationKit` (audit Decision 3) is therefore NOT exercised by this sweep —');
L.push('> the natural set supersedes it. Flag for Max if the capability lens is also wanted.');
L.push('');
L.push('**Sampling:** each A/B pair is captured at **2 camera hemispheres** (yaw + 0 and + π — night-side');
L.push('features like aurora / cityLights / lightning live on the unlit side) × **3 `uTime` instants**');
L.push('(0, 12, 24 — across a clouds/aurora cycle so animated features register). A pixel counts if ON/OFF');
L.push('differ at **any** of the 6 samples. Auto-spin is frozen and ON/OFF share each instant, so an inert');
L.push('feature changes **exactly 0** pixels — the noise floor is genuinely zero.');
L.push('');
L.push(`> **Thresholds:** render/inert boundary \`eps = ${EPS}\` (≈14px of ≈141k frame px);`);
L.push(`> a false-render above \`${STRONG}\` is 🔴 "solid", below is ⚠️ "faint trace".`);
L.push('');
L.push('## ⚠️ Known instrument limits (affect confidence, not yet triaged out)');
L.push('');
L.push('- **Sparse transients (`lightning`) are LOW-CONFIDENCE.** Lightning is a brief, jittered flash;');
L.push('  3 time-samples can land entirely between flashes, so its **dead-renders are likely instrument');
L.push('  misses, not real bugs.** Treat `lightning` dead-renders as "unconfirmed" pending a denser');
L.push('  time-sweep. Same caution, lesser degree, for other sparse storm transients.');
L.push('- **Very small footprints** near the eps floor (faint ⚠️ tier) may be edge-bleed from a neighboring');
L.push('  feature toggling, not the feature itself — verify the faint tier by eye before acting.');
L.push('- This is a **mechanical** gate (does it paint / where). Aesthetic "looks broken" beyond all-black /');
L.push('  blown-out stays Max\'s review-lap call.');
L.push('');
L.push('**This report is the deliverable. Fixing the violations is follow-on, triaged with Max** —');
L.push('each one disambiguates *manifest wrong* (`rendersOn` needs this preset) vs *feature buggy*');
L.push('(driver gate in `applyDrivers()`/`deriveUniforms()` derives nonzero where it should not).');
L.push('');

// ── punch-list ──────────────────────────────────────────────────────────────
L.push('## ⚠️ Violations punch-list');
L.push('');
const strongFalse = falseRenders.filter(x => x.delta > STRONG).sort((a,b)=>b.delta-a.delta);
const faintFalse  = falseRenders.filter(x => x.delta <= STRONG).sort((a,b)=>b.delta-a.delta);
L.push(`- **False-renders (renders where \`rendersOn\` says it should not):** ${falseRenders.length} `
     + `(${strongFalse.length} solid 🔴, ${faintFalse.length} faint ⚠️)`);
L.push(`- **Dead-renders (declared in \`rendersOn\` but inert):** ${deadRenders.length}`);
L.push(`- **Degenerate frames (black / blown-out on a should-render cell):** `
     + `${degenerates.filter(x=>x.should).length}`);
L.push('');

if (strongFalse.length) {
  L.push('### 🔴 Solid false-renders — highest-priority (feature clearly paints a planet it should not)');
  L.push('');
  L.push('| feature | renders on (unexpected) | Δ | declared `rendersOn` | divergent? |');
  L.push('|---|---|---:|---|:--:|');
  for (const x of strongFalse) {
    const a = ASSOCIATIONS[x.feature];
    L.push(`| \`${x.feature}\` | **${CODE[x.preset]}** | ${x.delta.toFixed(4)} | ${(a.rendersOn||[]).map(p=>CODE[p]).join(', ')||'—'} | ${a.rendersOnDivergent?'yes':''} |`);
  }
  L.push('');
}
if (faintFalse.length) {
  L.push('### ⚠️ Faint false-renders — trace pixels (sub-' + STRONG + '; may be edge bleed or a real faint leak)');
  L.push('');
  L.push('| feature | preset | Δ |');
  L.push('|---|---|---:|');
  for (const x of faintFalse) L.push(`| \`${x.feature}\` | ${CODE[x.preset]} | ${x.delta.toFixed(5)} |`);
  L.push('');
}
if (deadRenders.length) {
  L.push('### ⚠️ Dead-renders — declared but inert (manifest optimistic, kit insufficient, or driver gate broken)');
  L.push('');
  // sparse-transient features whose dead-renders are low-confidence instrument misses
  const TRANSIENT = new Set(['lightning']);
  L.push('| feature | preset (declared) | Δ | confidence |');
  L.push('|---|---|---:|---|');
  for (const x of deadRenders.sort((a,b)=>a.feature.localeCompare(b.feature))) {
    const conf = TRANSIENT.has(x.feature) ? 'LOW — sparse transient, likely instrument miss' : 'measured inert';
    L.push(`| \`${x.feature}\` | ${CODE[x.preset]} | ${x.delta.toFixed(5)} | ${conf} |`);
  }
  L.push('');
}
if (degenerates.filter(x=>x.should).length) {
  L.push('### 🔧 Degenerate frames');
  L.push('');
  L.push('| feature | preset | kind |');
  L.push('|---|---|---|');
  for (const x of degenerates.filter(x=>x.should)) L.push(`| \`${x.feature}\` | ${CODE[x.preset]} | ${x.kind} |`);
  L.push('');
}

// ── per-group matrices ────────────────────────────────────────────────────────
L.push('## Render matrix by province group');
L.push('');
L.push('Legend: ✅ renders-as-declared · `·` correctly inert · ⚠️D dead-render · '
     + '🔴F solid false-render · ⚠️F faint false-render. Columns are presets (codes below).');
L.push('');
L.push('**Preset codes:** ' + presets.map(p=>`\`${CODE[p]}\`=${p}`).join(' · '));
L.push('');
const head = '| feature | ' + presets.map(p=>CODE[p]).join(' | ') + ' |';
const sep  = '|---|' + presets.map(()=>':--:').join('|') + '|';
for (const g of groupOrder) {
  const fs = byGroup[g]; if (!fs || !fs.length) continue;
  L.push(`### ${g}`);
  L.push('');
  L.push(head); L.push(sep);
  for (const f of fs.sort()) {
    L.push('| `' + f + '` | ' + presets.map(p=>glyph(f,p)).join(' | ') + ' |');
  }
  L.push('');
}

L.push('---');
L.push('');
L.push('*Raw deltas: `docs/FEATURES/.sweep-raw.json`. Auditor: `lab-render-audit.js` '
     + '(`tests/render-audit.test.js`). Sweep harness: `window._lab.renderDeltaSweep()` '
     + 'in `planet-lod-lab.html`.*');

writeFileSync(new URL('../docs/FEATURES/lab-render-audit.md', import.meta.url), L.join('\n') + '\n');
console.log(`Wrote docs/FEATURES/lab-render-audit.md`);
console.log(`  presets=${presets.length} features=${features.length}`);
console.log(`  false-renders=${falseRenders.length} (solid=${strongFalse.length} faint=${faintFalse.length})`);
console.log(`  dead-renders=${deadRenders.length} degenerate(should)=${degenerates.filter(x=>x.should).length}`);
