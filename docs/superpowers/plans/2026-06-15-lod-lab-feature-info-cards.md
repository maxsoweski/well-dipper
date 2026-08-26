# LOD Lab Per-Feature Info Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rich, read-only reference card behind an ⓘ toggle in each feature folder of the planet-LOD lab GUI — prose (name/variants/examples/status) derived at build time from `docs/FEATURES/planet-visual-features.md`, structured data (processes→drivers, rendersOn, live state) read from the already-authoritative code/runtime.

**Architecture:** A small **build script** (`scripts/gen-feature-cards.mjs`) ESM-imports the feature registry + driver model, parses the `.md` feature table, joins prose to feature keys by F-number, and emits a generated data module (`planet-feature-cards.generated.js`). The lab's inline `<script>` imports that module and renders cards as **plain DOM** (a styled `<div>` injected as each folder's first child), toggled by an **ⓘ button** appended to the folder title bar — mirroring the proven `relocateEnableToTitle()` title-bar-injection pattern from the Phase-1 declutter. A drift-guard inside `doc-rot-check.sh` regenerates to a temp file and diffs, so "derived" is enforced. **No `planet-lod-lab-core.js` (shader/uniform) changes → no planet rendering can regress.**

**Tech Stack:** Node ESM (`node scripts/*.mjs`), Vitest (generator unit test — the script IS importable), lil-gui (`addFolder`, `.$title`, `.$children`, `.domElement`, `.controllers`), plain DOM for the card, Vite dev server (`localhost:5173`), chrome-devtools MCP on GPU Chrome `:9223` for live GUI verification, `bash scripts/doc-rot-check.sh` for the drift guard.

**Spec:** `docs/superpowers/specs/2026-06-15-lod-lab-feature-info-cards-design.md`

**Sibling pattern:** `docs/superpowers/plans/2026-06-15-lod-lab-menu-declutter.md` (Phase 1 of this overhaul — shipped). This is Phase 2 (Ask 2). The declutter is already merged into `world-engine-lab.html` (`fWorld`, `relocateEnableToTitle()`, `FEATURE_LAYOUT`, `fNotRelevant`, `applyArchetypeFilter()` reparenting all present).

---

## Verification reality (read before any GUI step)

The lab GUI is an **inline `<script>` in `world-engine-lab.html`** — NOT importable by Vitest. Per [[well-dipper-testing-reference]] the lab is verified **live on `:9223`** (GPU Chrome, NOT Playwright, NOT image recognition) via `window._lab.*` and DOM queries (`mcp__chrome-devtools__evaluate_script`). The **generator IS a Node module → it has a real Vitest unit test** (Task 2).

**Existing test contract that must stay green (this is the "test #16" pin the declutter plan referenced):**
`tests/planet-archetypes.test.js:14-16` scans the lab source with the regex `/\.add\(state, '(\w+Enabled)'\)/g` to learn which enable keys the panel binds (and cross-checks `cityLightsEnabled` → `PROV_CITYLIGHTS` at L111). **Our card injection is plain DOM and adds NO `.add(state, '…Enabled')` calls and removes none** — so this regex's match set is unchanged. Do not refactor any `.add(state, 'xEnabled')` line.

---

## Standing cautions

- **Line numbers are HINTS** — `grep -n` every edit site before editing (line drift is a known hazard in `world-engine-lab.html`).
- **Stage explicit paths only.** Allowed paths this plan touches: `scripts/gen-feature-cards.mjs`, `planet-feature-cards.generated.js`, `package.json`, `world-engine-lab.html`, `scripts/doc-rot-check.sh`, `tests/gen-feature-cards.test.js`, `docs/NOW.md`. **NEVER `git add -A`** — the shared working tree has unrelated warp WIP + loose `.png`/`.webm`/`.html` litter.
- Reload `localhost:5173/well-dipper/world-engine-lab.html?fresh=1` before each live verification (`:9223` may hold a stale session; `?fresh=1` opts out of the sessionStorage scenario-restore).
- End every commit message with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Decisions locked by source inspection (do NOT re-litigate)

These were the spec's open questions; resolved by reading the actual files:

1. **Generator reads the registry by ESM `import`, NOT regex.** Verified: `planet-archetypes.js`, `planet-drivers.js`, `planet-feature-associations.js` are **pure ESM with no browser-only deps** (no `THREE`, `window`, `document`, `require`). `package.json` has `"type": "module"`. So `import { FEATURES }`/`{ PROCESSES, DRIVERS, driversFor }`/`{ ASSOCIATIONS }` works in Node directly — cleaner and drift-proof vs. regexing source.

2. **F#→key bridge:** each `FEATURES[key].label` embeds its F-tag, e.g. `mountains: { label: 'Mountains (F1)' … }`. The label carries a **short** name + the F#; the **full prose name** comes from the `.md`. Extract with `/\(F(\d+)/` (note: some labels carry a sub-letter or multiple, see #3). 47 registry keys, **all** carry an F-tag.

3. **Multi-F# and gap cases (verified against the live files):**
   - `frost: 'Cryo / Frost (F23/F22)'` — two F#s in one tag. Rule: extract **all** `F(\d+)` numbers in label order; use the **first** that has a matching `.md` row. F23 has a row (`Snowline / frost-coverage boundary`), so `frost` resolves to F23.
   - `plateaus` and `tessera` **both** carry `(F6)` — two keys legitimately share one `.md` row. Both get the F6 prose. This is fine.
   - `clouds: 'Clouds & haze (F31)'` is the **one** real join gap: the `.md` has rows `F31a`–`F31f` but **no bare `F31`** row. `clouds` therefore gets **no prose entry** → renders structured-only at runtime → generator emits a **coverage warning** naming it. (A future option Max may pick: alias F31→F31a. Out of scope here; just warn.)
   - All other 44 F#s join cleanly to an exact `.md` row (verified: only `F31` is missing).

4. **Driven line uses driver KEYS, not labels.** `driversFor(processes)` returns sorted driver **keys** (e.g. `['surfaceHistory','tidalHeating','massGravity','age','volatileFraction']`). Use `PROCESSES[Pn].label` for the process names and the bare driver **keys** for the arrow tail — NOT the sentence-length `DRIVERS[key].label` strings (the spec is explicit: those would bury the card).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `scripts/gen-feature-cards.mjs` | Parse `.md` table → join to registry by F# → emit generated module. Pure Node ESM; exports parse helpers for the unit test. | **Create** |
| `planet-feature-cards.generated.js` | `export const FEATURE_CARDS = { <featureKey>: { fNum, name, variants, examples, status } }` (prose-only). Auto-generated; banner header. | **Create** (via the generator) |
| `tests/gen-feature-cards.test.js` | Unit test: parse a known `.md` row → expected object; assert the F#→key join (`mountains`→F1). | **Create** |
| `package.json` | Add `"gen-feature-cards": "node scripts/gen-feature-cards.mjs"`. | **Modify** (`scripts` block, ~L7-19) |
| `world-engine-lab.html` | Import `FEATURE_CARDS` + `PROCESSES`/`DRIVERS`/`driversFor`; add `buildFeatureCard()` + ⓘ-toggle injection; re-render State line on enable/preset change. | **Modify** (inline `<script>`) |
| `scripts/doc-rot-check.sh` | New check: regen `planet-feature-cards.generated.js` to a temp file, diff against committed, flag on mismatch. Mirrors the existing Check-6 doc-graph snapshot/regen/diff/restore pattern. | **Modify** (add a `section` + check block) |

---

## Pre-flight (once, before Task 1)

- [ ] **Step 0.1: Confirm the data modules are import-clean and capture ground truth for the unit test.**

Run:
```bash
cd /home/ax/projects/well-dipper
node --input-type=module -e "
import { FEATURES } from './planet-archetypes.js';
import { PROCESSES, driversFor } from './planet-drivers.js';
console.log('mountains label:', FEATURES.mountains.label);
console.log('P2 label:', PROCESSES.P2.label);
console.log('mountains drivers:', driversFor(['P2','P3','P4']));
"
```
Expected (exact, used in Task 2's test):
- `mountains label: Mountains (F1)`
- `P2 label: Tectonic deformation`
- `mountains drivers: [ 'tempEq', ... ]` (sorted by D#; the set derived from P2∪P3∪P4)

If `import` throws (browser-only dep), STOP — the regex fallback would be needed and this plan's Decision #1 is wrong; re-scope with Max.

- [ ] **Step 0.2: Confirm the dev server + lab are reachable on `:9223`.**

Run (chrome-devtools MCP): `list_pages`, then `navigate_page` reload `localhost:5173/well-dipper/world-engine-lab.html?fresh=1`.
Expected: page loads, planet renders, left (Drivers/World) + right (Features) GUI panels visible.

- [ ] **Step 0.3: Snapshot the baseline GUI tree** so card injection can be verified against it.

Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  return {
    featureKeys: Object.keys(L.featureFolders),
    hasMountains: !!L.featureFolders.mountains,
    mountainsTitle: L.featureFolders.mountains.$title.textContent,
  };
}
```
Expected: 47 `featureKeys`; `hasMountains === true`; `mountainsTitle` contains "Mountains (F1)" (the enable checkbox already lives in the title from Phase 1). Record `featureKeys` for later count checks.

---

## Task 1: The generator script — parse + join + emit

Build `scripts/gen-feature-cards.mjs`. It is a pure Node module that **exports** its parse/join helpers (so Task 2 can unit-test them) and, when run as the entry point, writes `planet-feature-cards.generated.js`.

**Files:**
- Create: `scripts/gen-feature-cards.mjs`

- [ ] **Step 1.1: Write the generator.**

Create `scripts/gen-feature-cards.mjs` with exactly this content:
```js
// scripts/gen-feature-cards.mjs
// Generates planet-feature-cards.generated.js — the PROSE-ONLY half of the
// per-feature info cards (Ask 2 of the lab menu/info overhaul). Everything
// structured (processes→drivers, rendersOn, live state) is read from code/runtime
// at render time and is NOT emitted here — prose has exactly one home: the .md.
//
// SOURCE OF TRUTH: docs/FEATURES/planet-visual-features.md (L2 feature table rows).
// JOIN: FEATURES[key].label embeds an (F#) tag → matched to the .md row's F#.
//
// Re-run after editing the .md:  npm run gen-feature-cards
import { readFileSync, writeFileSync } from 'node:fs';
import { FEATURES } from '../planet-archetypes.js';

const MD_PATH = new URL('../docs/FEATURES/planet-visual-features.md', import.meta.url);
const OUT_PATH = new URL('../planet-feature-cards.generated.js', import.meta.url);

// Strip a leading `[` / trailing `]` and surrounding backticks/spaces from the
// status cell, leaving a bare tag like 'current' | 'partial' | 'aspirational'.
function parseStatus(cell) {
  const m = cell.match(/\[([a-z]+)\]/);   // first [tag] in the status column
  return m ? m[1] : '';
}

// Parse the L2 feature table rows from the .md. A feature row looks like:
// | **F1** | Mountains / ranges | P2, P3, P4 | variant · variant | Ex1, Ex2 | types | `[aspirational]` |
// Columns (0-indexed after the leading empty split): 0 id, 1 name, 2 from,
// 3 variants, 4 examples, 5 types, 6 status. We keep name/variants/examples/status.
// Returns { byFnum: { '1': {name,variants,examples,status} }, warnings: [] }.
export function parseFeatureRows(md) {
  const byFnum = {};
  const warnings = [];
  const lines = md.split('\n');
  lines.forEach((line, i) => {
    // Only rows whose first cell is **F<digits>** (allow an optional sub-letter,
    // which we record under the full id e.g. 'F31a' — bare-F# join handles the rest).
    const idMatch = line.match(/^\|\s*\*\*(F\d+[a-z]?)\*\*\s*\|/);
    if (!idMatch) return;
    const id = idMatch[1];
    // Split the pipe row; drop the leading/trailing empties from the outer pipes.
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < 7) {
      warnings.push(`gen-feature-cards: row ${id} (md line ${i + 1}) has ${cells.length} cells, expected >=7 — SKIPPED`);
      return;
    }
    // cells[0] is the **F#** id (already captured); strip the leading 'F' for the key.
    const fnum = id.slice(1);   // '1', '31a', etc.
    byFnum[fnum] = {
      name:     cells[1].replace(/\*\*/g, ''),
      variants: cells[3],
      examples: cells[4],
      status:   parseStatus(cells[6]),
    };
  });
  return { byFnum, warnings };
}

// All F-numbers embedded in a registry label, in order. 'Cryo / Frost (F23/F22)'
// → ['23','22']; 'Mountains (F1)' → ['1'].
export function fNumsOf(label) {
  return [...label.matchAll(/\(?F(\d+[a-z]?)/g)].map(m => m[1]);
}

// Join registry features to parsed prose by F#. For multi-F# labels, use the FIRST
// F# that has a matching row. Returns { cards, missing } where missing = feature
// keys with no matching .md row (rendered structured-only at runtime).
export function buildCards(byFnum) {
  const cards = {};
  const missing = [];
  for (const [key, def] of Object.entries(FEATURES)) {
    const fnums = fNumsOf(def.label);
    const hit = fnums.find(f => byFnum[f]);
    if (!hit) { missing.push({ key, fnums }); continue; }
    const row = byFnum[hit];
    cards[key] = { fNum: hit, name: row.name, variants: row.variants, examples: row.examples, status: row.status };
  }
  return { cards, missing };
}

export function emit(cards) {
  const body = Object.entries(cards)
    .map(([k, c]) => `  ${k}: ${JSON.stringify(c)},`)
    .join('\n');
  return `// AUTO-GENERATED by scripts/gen-feature-cards.mjs — DO NOT EDIT BY HAND.
// Edit the prose in docs/FEATURES/planet-visual-features.md, then run:
//   npm run gen-feature-cards
// Prose only (name/variants/examples/status/fNum). Structured data (processes,
// drivers, rendersOn, live state) is read from code/runtime at render time.
export const FEATURE_CARDS = {
${body}
};
`;
}

// Entry point: parse → join → write. Warnings are loud (named lines). Exit non-zero
// ONLY on a structural parse error, NOT on a missing-row coverage warning
// (aspirational features legitimately lack rows; e.g. clouds→F31 has only F31a-f).
function main() {
  const md = readFileSync(MD_PATH, 'utf8');
  const { byFnum, warnings } = parseFeatureRows(md);
  for (const w of warnings) console.warn(w);
  if (warnings.length) { console.error(`gen-feature-cards: ${warnings.length} structural parse warning(s) above`); process.exitCode = 1; }
  const { cards, missing } = buildCards(byFnum);
  writeFileSync(OUT_PATH, emit(cards));
  console.log(`gen-feature-cards: wrote ${Object.keys(cards).length}/${Object.keys(FEATURES).length} cards to planet-feature-cards.generated.js`);
  if (missing.length) {
    console.warn(`gen-feature-cards: ${missing.length} feature(s) have NO matching .md row (structured-only at render):`);
    for (const m of missing) console.warn(`  - ${m.key} (label F#s: ${m.fnums.join('/') || 'none'})`);
  }
}

// Run main only when invoked as the script (not when imported by the test).
if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 1.2: Run the generator and read the coverage report.**

Run: `cd /home/ax/projects/well-dipper && node scripts/gen-feature-cards.mjs`
Expected (per source inspection): writes `46/47 cards`; coverage warning lists exactly **`clouds (label F#s: 31)`** as the one missing row; **no structural parse warnings**; exit code 0.

- [ ] **Step 1.3: Eyeball the generated file for the known-good row.**

Run: `cd /home/ax/projects/well-dipper && grep -n "mountains:\|clouds:\|frost:" planet-feature-cards.generated.js`
Expected:
- `mountains:` line present with `"fNum":"1"`, `"name":"Mountains / ranges"`, examples containing `Olympus Mons`, `"status":"aspirational"`.
- `frost:` line present with `"fNum":"23"` (first-matching-F# rule: F23 row exists).
- **`clouds:` ABSENT** (the one structured-only fallback).

- [ ] **Step 1.4: Commit (script + first generated artifact together).**
```bash
cd /home/ax/projects/well-dipper
git add scripts/gen-feature-cards.mjs planet-feature-cards.generated.js
git commit -m "feat(lod-lab): generator for per-feature info-card prose

Reads docs/FEATURES/planet-visual-features.md, joins prose to feature keys
by F#, emits planet-feature-cards.generated.js (prose only; structured data
stays in code). 46/47 features covered; clouds(F31) structured-only (md has
F31a-f, no bare F31).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Generator unit test

The generator is a Node module → directly testable. Pin the parse-of-a-known-row and the F#→key join.

**Files:**
- Create: `tests/gen-feature-cards.test.js`

- [ ] **Step 2.1: Write the failing test.**

Create `tests/gen-feature-cards.test.js`:
```js
// tests/gen-feature-cards.test.js
import { describe, it, expect } from 'vitest';
import { parseFeatureRows, fNumsOf, buildCards } from '../scripts/gen-feature-cards.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const md = readFileSync(path.resolve(__dirname, '../docs/FEATURES/planet-visual-features.md'), 'utf8');

describe('gen-feature-cards parser', () => {
  it('parses a known F-row into the expected object', () => {
    const row = '| **F1** | Mountains / ranges | P2, P3, P4 | tectonic fold belt · volcanic shield/strato · ridged crestlines | Himalaya, Olympus Mons, Tharsis | rocky, terrestrial, venus, lava, ice, carbon | `[aspirational]` |';
    const { byFnum, warnings } = parseFeatureRows(row);
    expect(warnings).toEqual([]);
    expect(byFnum['1']).toEqual({
      name: 'Mountains / ranges',
      variants: 'tectonic fold belt · volcanic shield/strato · ridged crestlines',
      examples: 'Himalaya, Olympus Mons, Tharsis',
      status: 'aspirational',
    });
  });

  it('extracts all F#s from a multi-F# label, in order', () => {
    expect(fNumsOf('Mountains (F1)')).toEqual(['1']);
    expect(fNumsOf('Cryo / Frost (F23/F22)')).toEqual(['23', '22']);
  });

  it('joins the registry to the real .md: mountains -> F1 prose', () => {
    const { byFnum } = parseFeatureRows(md);
    const { cards, missing } = buildCards(byFnum);
    expect(cards.mountains.fNum).toBe('1');
    expect(cards.mountains.name).toBe('Mountains / ranges');
    expect(cards.mountains.examples).toContain('Olympus Mons');
    // frost uses the FIRST matching F# (F23 has a row)
    expect(cards.frost.fNum).toBe('23');
    // clouds (F31) is the one structured-only fallback: md has F31a-f, no bare F31
    expect(cards.clouds).toBeUndefined();
    expect(missing.map(m => m.key)).toContain('clouds');
  });
});
```

- [ ] **Step 2.2: Run it to verify it passes** (the generator from Task 1 already satisfies it — this is a regression pin, so it should pass immediately; if it fails, the generator has a bug to fix before proceeding).

Run: `cd /home/ax/projects/well-dipper && npx vitest run tests/gen-feature-cards.test.js`
Expected: 3 passing tests. If red, fix `scripts/gen-feature-cards.mjs` (not the test) until green.

- [ ] **Step 2.3: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add tests/gen-feature-cards.test.js
git commit -m "test(lod-lab): pin feature-card parser + F#->key join

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: package.json script

**Files:**
- Modify: `package.json` (the `"scripts"` block, ~L7-19)

- [ ] **Step 3.1: Add the `gen-feature-cards` script.**

Re-grep the scripts block: `grep -n '"generate-glow":' package.json`. Add the new line directly after `"generate-glow:test"`:
```json
    "gen-feature-cards": "node scripts/gen-feature-cards.mjs",
```
(Place it so it sits with the other `generate-*`/`gen-*` script entries; ensure the trailing comma is valid JSON — the line after it must still exist.)

- [ ] **Step 3.2: Verify the npm script runs.**

Run: `cd /home/ax/projects/well-dipper && npm run gen-feature-cards`
Expected: same output as Step 1.2 (`46/47 cards`, the `clouds` coverage warning, exit 0). Confirm `git status --short planet-feature-cards.generated.js` shows **no diff** (idempotent — already committed at the current `.md` state).

- [ ] **Step 3.3: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add package.json
git commit -m "chore(lod-lab): add npm run gen-feature-cards

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Lab GUI — imports + the card renderer

Add the data imports and the `buildFeatureCard()` renderer. No DOM injection yet (Task 5) — this task only defines the pieces and proves the data resolves.

**Files:**
- Modify: `world-engine-lab.html` — imports (~L108-115); a new `buildFeatureCard()` near the feature-folder plumbing (after `featureFolders`/`relocateEnableToTitle`, ~L6943-6946)

- [ ] **Step 4.1: Add the imports.**

Re-grep `import { ASSOCIATIONS } from './planet-feature-associations.js'` (~L111). Immediately after it add:
```js
    import { PROCESSES, DRIVERS, driversFor } from './planet-drivers.js';   // card "Driven" line: process labels + derived driver keys
    import { FEATURE_CARDS } from './planet-feature-cards.generated.js';     // card prose (name/variants/examples/status); AUTO-GENERATED
```
(`FEATURES`, `ARCHETYPES`, `featuresOf`, `ASSOCIATIONS` are already imported — do not duplicate them.)

- [ ] **Step 4.2: Add a CSS block for the card.**

Re-grep the existing title-toggle CSS: `grep -n 'title-has-toggle' world-engine-lab.html` (~L94). After the `.lil-gui .title-toggle .lil-widget` rule (~L97), add:
```css
    /* Per-feature info card (Ask 2) — plain DOM injected as a folder's first child. */
    .lil-gui .feature-card { display: none; font-size: 11px; line-height: 1.45; padding: 6px 8px;
      margin: 2px 0 4px; background: #1a1a1f; border-left: 2px solid #4a90d9; color: #cfd2d6; }
    .lil-gui .feature-card.open { display: block; }
    .lil-gui .feature-card .fc-row { margin: 2px 0; }
    .lil-gui .feature-card .fc-k { color: #8a8f96; }                 /* row label */
    .lil-gui .feature-card .fc-status { float: right; opacity: 0.8; }
    .lil-gui .feature-card .fc-state-on  { color: #6ad06a; }
    .lil-gui .feature-card .fc-state-off { color: #8a8f96; }
    .lil-gui .title-info { cursor: pointer; user-select: none; opacity: 0.7; margin-left: 4px; }
    .lil-gui .title-info:hover { opacity: 1; }
```

- [ ] **Step 4.3: Add the `buildFeatureCard()` renderer.**

Re-grep the enable-relocation loop: `grep -n 'relocateEnableToTitle(folder, FEATURES\[key\].enableKey)' world-engine-lab.html` (~L6945, inside the `for … of Object.entries(featureFolders)` loop ending ~L6946). **After** that loop closes, add:
```js
    // ── Per-feature info card (Ask 2) ─────────────────────────────────────────
    // Read-only reference card. Prose comes from FEATURE_CARDS (generated from the
    // .md); structured data (processes→drivers, rendersOn) from the manifest +
    // driver model; live state from state.* + relevantFeatureSet() at render time.
    // Returns a plain <div> (NOT a lil-gui controller) so it never perturbs
    // syncDisplays(), the enable controller, or the reparenting relevance filter.
    function escapeHtml(s){ return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
    function buildFeatureCard(key){
      const el = document.createElement('div');
      el.className = 'feature-card';
      const prose = FEATURE_CARDS[key];                 // may be undefined → structured-only
      const assoc = ASSOCIATIONS[key] || {};
      const rows = [];

      // Title + status (prose-backed only).
      if (prose) {
        rows.push(`<div class="fc-row"><b>${escapeHtml(prose.name)} (F${escapeHtml(prose.fNum)})</b>`
          + (prose.status ? `<span class="fc-status">[${escapeHtml(prose.status)}]</span>` : '') + `</div>`);
        if (prose.variants) rows.push(`<div class="fc-row"><span class="fc-k">is:</span> ${escapeHtml(prose.variants)}</div>`);
        if (prose.examples) rows.push(`<div class="fc-row"><span class="fc-k">like:</span> ${escapeHtml(prose.examples)}</div>`);
      }

      // Driven: process labels → derived driver KEYS (compact; not DRIVERS[].label).
      const procs = assoc.processes || [];
      if (procs.length) {
        const procLabels = procs.map(p => (PROCESSES[p] && PROCESSES[p].label) || p).join(' · ');
        const driverKeys = driversFor(procs, assoc.directDrivers || []).join(', ');
        rows.push(`<div class="fc-row"><span class="fc-k">driven:</span> ${escapeHtml(procLabels)}`
          + (driverKeys ? ` &rarr; ${escapeHtml(driverKeys)}` : '') + `</div>`);
      }

      // Renders: manifest rendersOn.
      const renders = assoc.rendersOn || [];
      if (renders.length) rows.push(`<div class="fc-row"><span class="fc-k">renders:</span> ${escapeHtml(renders.join(', '))}</div>`);

      // State: the ONLY line that changes as Max works. Filled by refreshCardState().
      rows.push(`<div class="fc-row fc-state" data-key="${escapeHtml(key)}"></div>`);

      el.innerHTML = rows.join('');
      refreshCardState(el.querySelector('.fc-state'), key);
      return el;
    }

    // Re-fill a single card's State line from live runtime. Safe to call repeatedly.
    function refreshCardState(stateEl, key){
      if (!stateEl) return;
      const enabled = !!state[FEATURES[key].enableKey];
      const relevant = relevantFeatureSet().set.has(key);
      const dot = enabled ? '<span class="fc-state-on">&#9679; enabled</span>' : '<span class="fc-state-off">&#9675; off</span>';
      const rel = relevant ? 'relevant to THIS world' : '<span class="fc-state-off">not relevant</span>';
      stateEl.innerHTML = `<span class="fc-k">state:</span> ${dot} &middot; ${rel}`;
    }
```
**Note:** `relevantFeatureSet()` is defined later in the file (~L7083) but `buildFeatureCard`/`refreshCardState` are only *called* at runtime (after all defs load), so the forward reference is fine — these are function declarations, hoisted, and never invoked at definition time.

- [ ] **Step 4.4: Verify the data resolves live (renderer exists, not yet wired to UI).**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  // buildFeatureCard is in module scope, not on window — exercise it via a probe
  // we add only if needed. Instead, assert the imports resolved by checking _lab
  // can see the generated module indirectly: confirm a known card key exists.
  return {
    // These are import-time proofs the module loaded without error (page rendered = imports OK).
    pageOk: !!window._lab,
    mountainsFolder: !!window._lab.featureFolders.mountains,
  };
}
```
Expected: `{ pageOk: true, mountainsFolder: true }`. (If the page failed to load, an import path is wrong — check the console via `list_console_messages` for a 404 on `planet-feature-cards.generated.js` or `planet-drivers.js`.)

- [ ] **Step 4.5: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add world-engine-lab.html
git commit -m "feat(lod-lab): card renderer + imports for per-feature info cards

buildFeatureCard(key) builds a read-only DOM card (prose from FEATURE_CARDS,
structured data from the manifest/driver model, live state). Not yet wired to
a UI toggle (next commit). No core/shader change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Lab GUI — ⓘ toggle + inline injection

Wire `buildFeatureCard()` into each feature folder: an ⓘ button in the title bar (mirroring `relocateEnableToTitle()`), injecting the card as the folder's first child, collapsed by default. Re-render the State line on enable/preset change.

**Files:**
- Modify: `world-engine-lab.html` — extend the feature-folder loop (~L6944-6946); hook State refresh into `applyDrivers`/`applyArchetypeFilter` and the enable controllers

- [ ] **Step 5.1: Inject the ⓘ button + card per feature folder.**

Re-grep the enable-relocation loop again (`grep -n 'for (const \[key, folder\] of Object.entries(featureFolders))' world-engine-lab.html` — there are two such loops: the `relocateEnableToTitle` one ~L6944 and the solo-button one ~L7110). Add a **new** loop immediately after `buildFeatureCard`/`refreshCardState` are defined (end of Task 4's block):
```js
    // Inject an ⓘ toggle into each feature folder's title bar and a (hidden) card
    // as the folder's FIRST body child. Mirrors relocateEnableToTitle()'s title-bar
    // DOM injection; stopPropagation so clicking ⓘ doesn't collapse the folder.
    const featureCards = {};   // key -> { cardEl, stateEl } for live State refresh
    for (const [key, folder] of Object.entries(featureFolders)) {
      const cardEl = buildFeatureCard(key);
      folder.$children.insertBefore(cardEl, folder.$children.firstChild);   // above the sliders
      featureCards[key] = { cardEl, stateEl: cardEl.querySelector('.fc-state') };
      const info = document.createElement('span');
      info.className = 'title-info';
      info.textContent = 'ⓘ';
      info.title = 'feature info';
      info.addEventListener('click', e => {
        e.stopPropagation();                 // don't toggle the folder's open/close
        cardEl.classList.toggle('open');
      });
      folder.$title.appendChild(info);       // after the enable toggle relocated in Phase 1
    }
    // Refresh every visible card's State line (enable dots + relevance). Cheap — text only.
    function refreshAllCardStates(){
      for (const key of Object.keys(featureCards)) refreshCardState(featureCards[key].stateEl, key);
    }
```

- [ ] **Step 5.2: Re-render State on preset change (relevance can flip).**

Re-grep `function applyArchetypeFilter()` (~L7089) — it runs on every preset change and filter toggle. Add `refreshAllCardStates();` as the **last** line of its body, right before the closing brace (after `syncDisplays();`):
```js
      syncDisplays();
      refreshAllCardStates();   // relevance/enable may have changed → update card State lines
    }
```

- [ ] **Step 5.3: Re-render State on enable toggle.**

The State dot must flip when Max toggles a feature's enable checkbox. The enable controllers were relocated to the title in Phase 1; their `.onChange` is not currently set. Re-grep the `relocateEnableToTitle` definition (~L6935). Add an `onFinishChange`/`onChange` hook to the enable controller **inside** that function so every relocated enable refreshes its own card:
```js
    function relocateEnableToTitle(folder, prop){
      const ctrl = folder.controllers.find(c => c.property === prop);
      if (!ctrl) return;
      const title = folder.$title;
      title.classList.add('title-has-toggle');
      ctrl.domElement.classList.add('title-toggle');
      ctrl.domElement.addEventListener('click', e => e.stopPropagation());
      title.appendChild(ctrl.domElement);
      ctrl.onChange(() => refreshAllCardStates());   // enable flip → card State dot updates
    }
```
**Caution:** verify `relocateEnableToTitle` is defined **after** `refreshAllCardStates` in source order, OR that `refreshAllCardStates` is hoisted before the relocation loop runs. The relocation loop (~L6944) runs at GUI build; `refreshAllCardStates` is a function declaration (hoisted) — safe. But `featureCards` (a `const`) must be populated before any `onChange` fires; it is (cards are built in Step 5.1's loop, which runs before any user interaction). If the relocation loop currently runs *before* Step 5.1's card loop, `refreshAllCardStates` will no-op harmlessly on an empty `featureCards` at build time and work correctly thereafter. Re-grep to confirm ordering; if the relocation loop precedes card creation, that's fine (no card exists to refresh yet).

- [ ] **Step 5.4: Verify live on `:9223` — the core acceptance checks.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  const folder = L.featureFolders.mountains;
  const info = folder.$title.querySelector('.title-info');
  const card = folder.$children.querySelector('.feature-card');
  const openedBefore = card.classList.contains('open');
  info.click();                                   // toggle ⓘ on
  const openedAfter = card.classList.contains('open');
  const text = card.textContent;
  info.click();                                   // toggle back off
  const closedAgain = !card.classList.contains('open');
  return { openedBefore, openedAfter, closedAgain, text };
}
```
Expected: `openedBefore === false` (collapsed by default), `openedAfter === true`, `closedAgain === true`. `text` contains "Mountains / ranges", "Olympus Mons", "Tectonic deformation" (a P2 label), "rockyCrust"-style driver keys are NOT present (correct — drivers are keys like `tidalHeating`, `massGravity`), "renders" + "Rocky", and a "state:" line.

- [ ] **Step 5.5: Verify the State line tracks reality.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  const stateText = () => L.featureFolders.mountains.$children.querySelector('.fc-state').textContent;
  L.setPreset('Rocky (Earthlike)');               // mountains relevant here
  const relevantLine = stateText();
  L.solo('mountains');                             // force mountains enabled
  const enabledLine = stateText();
  L.unsolo();
  L.setPreset('Gas giant (Jovian)');              // mountains NOT relevant on a gas giant
  const notRelevantLine = stateText();
  L.setPreset('Rocky (Earthlike)');               // restore
  return { relevantLine, enabledLine, notRelevantLine };
}
```
Expected: `relevantLine` contains "relevant to THIS world"; `enabledLine` contains "enabled" (filled dot); `notRelevantLine` contains "not relevant". (Confirms State re-renders on both preset change and enable toggle.)

- [ ] **Step 5.6: Verify the structured-only fallback (clouds) renders without a prose block.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  const card = L.featureFolders.clouds.$children.querySelector('.feature-card');
  const t = card.textContent;
  return {
    hasDriven: /driven:/.test(t),     // structured line present
    hasRenders: /renders:/.test(t),
    hasState: /state:/.test(t),
    hasNoProse: !/is:/.test(t) && !/like:/.test(t),   // no variants/examples block (clouds has no .md row)
  };
}
```
Expected: `{ hasDriven: true, hasRenders: true, hasState: true, hasNoProse: true }`.

- [ ] **Step 5.7: Verify a force-enabled irrelevant feature in the Not-relevant group still shows its card.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  L.setPreset('Rocky (Earthlike)');               // magma irrelevant → tucked into Not-relevant
  L.setFilter(true);
  const folder = L.featureFolders.magma;
  const info = folder.$title.querySelector('.title-info');
  info.click();
  const card = folder.$children.querySelector('.feature-card');
  const open = card.classList.contains('open');
  const hasState = /state:/.test(card.textContent);
  info.click();
  return { open, hasState, parentIsNotRelevant: folder.domElement.parentElement === document.querySelector('.lil-gui') ? false : true };
}
```
Expected: `open === true`, `hasState === true` (the card works regardless of which DOM group the folder currently lives in — reparenting moves `folder.domElement`, the card is its child and moves with it).

- [ ] **Step 5.8: Screenshot for the record** (`take_screenshot`): with ⓘ expanded on Mountains, the card sits above the sliders with title/is/like/driven/renders/state lines; folder still collapses/expands normally via its title.

- [ ] **Step 5.9: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add world-engine-lab.html
git commit -m "feat(lod-lab): inline per-feature info cards behind an ⓘ toggle

Each feature folder gets an ⓘ title-bar button (mirrors relocateEnableToTitle)
that shows/hides a read-only card injected as the folder's first child.
Collapsed by default; State line re-renders on preset change + enable toggle;
structured-only fallback for features with no .md prose row.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Drift guard in doc-rot

Extend `scripts/doc-rot-check.sh` so a stale `planet-feature-cards.generated.js` is caught. Mirror the existing Check-6 (doc-graph) snapshot/regen/diff/restore pattern.

**Files:**
- Modify: `scripts/doc-rot-check.sh` (add a new `section` + check block alongside the other checks, before the Summary block ~L322)

- [ ] **Step 6.1: Add the check block.**

Re-grep the doc-graph check to copy its shape: `grep -n 'SYSTEMS.md graph staleness' scripts/doc-rot-check.sh` (~L256). Re-grep the end-of-checks anchor: `grep -n '^  echo "## Summary"' scripts/doc-rot-check.sh` (~L325). Insert this block **before** the Summary section (after the last existing check, before the `echo ""; echo "---"` that precedes Summary):
```bash
# ---- Check: feature-cards generated-file staleness ----
section "Feature-cards generated-file staleness"
if [ -f "planet-feature-cards.generated.js" ] && [ -f "scripts/gen-feature-cards.mjs" ]; then
  # Snapshot committed file; regen; diff; restore (never silently update).
  FC_SNAPSHOT=$(mktemp)
  cp planet-feature-cards.generated.js "$FC_SNAPSHOT"
  if node scripts/gen-feature-cards.mjs >/dev/null 2>&1; then
    if ! diff -q "$FC_SNAPSHOT" planet-feature-cards.generated.js >/dev/null 2>&1; then
      flag "feature-cards-stale" "planet-feature-cards.generated.js differs from fresh gen — run 'npm run gen-feature-cards' and commit"
      mv "$FC_SNAPSHOT" planet-feature-cards.generated.js   # restore committed version
    else
      rm -f "$FC_SNAPSHOT"
    fi
  else
    # exit non-zero from the generator here means a STRUCTURAL parse error (not a coverage warning)
    warn "feature-cards-check" "gen-feature-cards errored (structural parse?); cannot verify staleness"
    mv "$FC_SNAPSHOT" planet-feature-cards.generated.js
  fi
else
  echo "  (skipped — planet-feature-cards.generated.js or gen-feature-cards.mjs missing)" >> "$REPORT"
fi
```
**Note on the generator's exit code:** `main()` sets `process.exitCode = 1` only on a **structural parse warning**, never on a missing-row coverage warning. The `clouds`/F31 coverage warning is printed to stderr but exit stays 0 — so a clean tree does NOT trip `warn "feature-cards-check"`. Confirm by re-reading Task 1's `main()` before relying on this.

- [ ] **Step 6.2: Verify the guard passes on a clean tree.**

Run: `cd /home/ax/projects/well-dipper && npm run doc-rot`
Expected: exit 0; the report (in `~/briefings/well-dipper-doc-rot-<sha>.md`) shows the "Feature-cards generated-file staleness" section with **no** `feature-cards-stale` flag. Confirm `git status --short planet-feature-cards.generated.js` is clean (the check restores the snapshot — no working-tree mutation).

- [ ] **Step 6.3: Verify the guard FAILS when the generated file is stale.**

Run (deliberately corrupt the generated file, run the guard, confirm it flags, then restore):
```bash
cd /home/ax/projects/well-dipper
cp planet-feature-cards.generated.js /tmp/fc-good.js
printf '\n// DRIFT TEST\n' >> planet-feature-cards.generated.js
WELL_DIPPER_DOC_ROT_BLOCK=true npm run doc-rot; echo "exit=$?"
# restore the good file regardless of outcome
cp /tmp/fc-good.js planet-feature-cards.generated.js
git status --short planet-feature-cards.generated.js
```
Expected: the run reports `feature-cards-stale` and (with `WELL_DIPPER_DOC_ROT_BLOCK=true`) exits 1; after restore, `git status` shows the generated file clean. (Without the env var the script is warn-only/exit-0 by design — the flag in the report is the signal.)

- [ ] **Step 6.4: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add scripts/doc-rot-check.sh
git commit -m "chore(lod-lab): doc-rot drift guard for feature-cards generated file

Regenerates planet-feature-cards.generated.js to a temp file and diffs against
the committed copy; flags 'feature-cards-stale' on mismatch (makes the derive
contract enforceable via npm run doc-rot + the pre-push hook).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Regression sweep + close-out

- [ ] **Step 7.1: Full unit-test run — existing suites stay green.**

Run: `cd /home/ax/projects/well-dipper && npx vitest run`
Expected: all green, including:
- `tests/planet-archetypes.test.js` — the `\.add\(state, '(\w+Enabled)'\)` scan + `cityLights → PROV_CITYLIGHTS` pin (we added no `.add(state,…Enabled)` and removed none).
- `tests/feature-associations.test.js` — unchanged manifest.
- `tests/gen-feature-cards.test.js` — the new parser pin (Task 2).
If any previously-green suite is now red, STOP and diagnose before close-out (the change is additive — a red existing suite means an unintended edit).

- [ ] **Step 7.2: Final live acceptance pass against the spec's Verification list.**

Reload `?fresh=1`. Confirm by eye + `evaluate_script`:
- ⓘ on Mountains shows title/variants/examples/driven/renders/state (Step 5.4). ✔
- Cards collapsed by default; multiple can be open independently (open ⓘ on Mountains AND Craters; both stay open). ✔
- State line flips `off`↔`enabled` on solo and `relevant`↔`not relevant` on preset change (Step 5.5). ✔
- Force-enabled irrelevant feature still shows its card (Step 5.7). ✔
- `clouds` renders structured-only (Step 5.6). ✔

Multi-open check (`evaluate_script`):
```js
() => {
  const L = window._lab;
  L.featureFolders.mountains.$title.querySelector('.title-info').click();
  L.featureFolders.craters.$title.querySelector('.title-info').click();
  return {
    mtnOpen: L.featureFolders.mountains.$children.querySelector('.feature-card').classList.contains('open'),
    crtOpen: L.featureFolders.craters.$children.querySelector('.feature-card').classList.contains('open'),
  };
}
```
Expected: `{ mtnOpen: true, crtOpen: true }`.

- [ ] **Step 7.3: Update `docs/NOW.md`.**

Re-grep the active session block: `grep -n 'SESSION 2026-06-15\|menu declutter\|info-layer' docs/NOW.md`. Update the menu-overhaul entry to note Ask 2 (per-feature info cards) landed `VERIFIED_PENDING_MAX <sha>` (use the Task 5 commit SHA — the user-visible deliverable), and that Asks 3–4 (archetype info view; live render-audit surfacing) remain. Keep it to the existing block's format/brevity.

- [ ] **Step 7.4: Commit the NOW.md update.**
```bash
cd /home/ax/projects/well-dipper
git add docs/NOW.md
git commit -m "docs(now): lod-lab info cards (Ask 2) verified-pending-Max

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (run by plan author)

**1. Spec coverage:**
- Spec "Data flow: .md → gen script → generated.js → import" → **Task 1** (generator) + **Task 4.1** (import). ✔
- Spec "generated module holds ONLY prose (name/variants/examples/status/fNum)" → Task 1 `emit()` emits exactly those 5 fields. ✔
- Spec "Card content per line (Title/is/like/driven/renders/state) + sources" → **Task 4.3** `buildFeatureCard()` builds all 6 lines from the spec'd sources; Driven uses `PROCESSES[].label` + driver **keys** (not `DRIVERS[].label`). ✔
- Spec "generator: parse rows, validate shape, loud warning, build {fNum:…}, key by feature key, banner header, coverage report, exit non-zero only on structural error" → **Task 1.1** (`parseFeatureRows` warns by line; `emit` banner; `main` coverage report + `exitCode` only on structural warning). ✔
- Spec "package.json gen-feature-cards script" → **Task 3**. ✔
- Spec "Drift guard: regen to temp, diff committed, mismatch = doc-rot failure, wired where npm run doc-rot runs" → **Task 6** (mirrors Check-6). ✔
- Spec "GUI: ⓘ toggle in title bar (mirror relocateEnableToTitle); card as folder first child; plain DOM not lil-gui; collapsed by default; works for relevant + force-enabled irrelevant; one buildFeatureCard(key) function; structured-only fallback" → **Tasks 4-5** (4.3 renderer, 5.1 injection, 5.6 fallback, 5.7 irrelevant). ✔
- Spec "State line re-renders on enable-toggle and preset change" → **Task 5.2** (applyArchetypeFilter) + **5.3** (enable onChange). ✔
- Spec risks "F#→key join gaps → coverage + structured-only fallback, no crash" → `clouds`/F31 handled (Task 1.2, 5.6); frost multi-F# handled (Task 1.3, 2.1). ✔
- Spec "Verification: live :9223; generator unit test parses known row + asserts mountains→F1; drift guard fails on stale; existing suites green; commit explicit paths" → Tasks 2, 5, 6.3, 7.1; explicit-path commits throughout. ✔
- Spec "Out of scope: Asks 3-4, Thread B" → not in plan; Asks 3-4 noted in Step 7.3. ✔

**2. Placeholder scan:** No TBD/TODO/"handle edge cases". The "re-grep before editing" notes are deliberate line-drift caution (the implementer reads the actual file), not placeholders — every code step has complete code. ✔

**3. Type/name consistency:** `buildFeatureCard`, `refreshCardState`, `refreshAllCardStates`, `featureCards`, `FEATURE_CARDS`, `parseFeatureRows`, `fNumsOf`, `buildCards`, `emit` used consistently across tasks. Generated object shape `{ fNum, name, variants, examples, status }` matches between `emit()` (Task 1), the test (Task 2), and `buildFeatureCard()`'s reads (Task 4). `driversFor(procs, directDrivers)` signature matches the verified source. The `.add(state, 'xEnabled')` literals are NOT touched (test #16 stays green). ✔

**4. Verified-against-source facts baked in:** all three data modules are pure-ESM importable (Pre-flight 0.1 gates it); `relevantFeatureSet()`/`applyArchetypeFilter()`/`relocateEnableToTitle()`/`featureFolders`/`fNotRelevant`/`FEATURE_LAYOUT` exist at the cited (hint) lines; `clouds`/F31 is the single coverage gap; `frost` is the single multi-F# label. ✔

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-15-lod-lab-feature-info-cards.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**2. Inline Execution** — execute tasks in this session via superpowers:executing-plans, batch execution with checkpoints. REQUIRED SUB-SKILL: superpowers:executing-plans.

**Which approach?**
