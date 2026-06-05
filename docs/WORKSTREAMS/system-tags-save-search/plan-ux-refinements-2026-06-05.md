# system-tags-save-search — UX Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 10 usability findings from the 2026-06-05 UX evaluation of the system-tags debug panel, so the panel never *displays the wrong system* and never *offers a control that silently fails* — while keeping the feature inside its live dev-collab trial.

**Architecture:** Two buckets. (1) **Pure-logic** fixes (tag-summary fidelity, probe cap reporting) get extracted into testable functions in `SystemTags.js` / `SystemProbe.js` and covered by node/vitest TDD — matching the existing 40-test pattern. (2) **DOM/wiring** fixes (live tag refresh, save-button guard, affordance/label cleanup) live in `DebugPanel.js` and are verified by chrome-devtools UAT on port 9223 — the same way AC8 was verified, since the project has **no DOM test harness** (vitest runs in node, no jsdom) and standing one up is out of scope for a polish pass.

**Tech Stack:** Vanilla JS, Vite, Vitest (node env), three.js. Verification: `npm run test` (vitest) + chrome-devtools MCP on 9223.

**JOURNEY / tier:** Debug-tier tooling for the system-identity / save-share exploration (Phase 1 debug surface; player-facing UI remains Phase 2, out of scope). These refinements serve the dev-collab mechanism-match trial (AC-H) — Max judges the *polished* product, so they extend the same workstream rather than opening a new one.

---

## ⚠️ Carried context — do NOT drop (the "don't lose the other work" guardrail)

This plan is *only* the UX fixes. The following pre-existing open items stay open and must not be erased, reverted, or auto-actioned by this work:

1. **AC-H trial verdict is still pending.** This feature is the trial of the dev-collab mechanism-match flow (scope-skill → build → verify-workflow, replacing pm/tester). The **migration is GATED** — do NOT remove the live `pm`/`tester` symlinks or edit trigger docs. State: `~/.claude/projects/-home-ax/memory/dev-collab-mechanism-match.md`.
2. **`verify-workstream.mjs` fixes are uncommitted** in the *separate* `personal-os-improvements/dev-collab/` repo (load-contract schema tightening + defensive `JSON.parse`). Max hasn't decided whether to commit them. We **depend on** that script for the verify step below — use it as-is; do not commit its changes as part of this plan.
3. **Branch `system-tags-save-search` is NOT pushed** (base `97d2322`, feature `8b048cf`). Push only if Max asks.
4. **Parking-lot features remain queued, not cancelled:** world-origin rebasing (`well-dipper-rebasing-plan.md`), binary wide-separation (`well-dipper-binary-wide-separation.md`), save/share seed-tags Phase 2 (`well-dipper-system-save-share-seedtags.md`). None are in scope here.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/generation/SystemTags.js` | Pure tag derivation + **NEW** pure formatting helpers (`tagSummary`, `isShallowTags`) | Modify — add 2 exported fns |
| `src/generation/__tests__/SystemTags.test.js` | Unit tests for derivation + formatting | Modify — add `tagSummary`/`isShallowTags` tests |
| `src/generation/SystemProbe.js` | Region sweep + filter + **NEW** `probeRegionDetailed` (returns swept/cap metadata) | Modify — add fn, keep `probeRegion` array return |
| `src/generation/__tests__/SystemProbe.test.js` | Probe tests | Modify — add detailed-metadata tests |
| `src/ui/DebugPanel.js` | The debug-panel UI surface (3 sections + wiring) | Modify — live refresh, save guard, labels, affordances, a11y |
| `docs/WORKSTREAMS/system-tags-save-search/contract.json` | Trial contract | Modify — append UX-1…UX-10 ACs |
| `docs/NOW.md`, `docs/FEATURES.md` (or row) | Doc-on-ship (Rule 3) | Modify at ship |

**Finding → AC → Task map**

| # | Finding (from UX eval) | Severity | AC | Task | Layer |
|---|------------------------|----------|----|----|------|
| 1 | SYSTEM TAGS grid stale — shows previous system after a jump/warp until panel reopened | High | UX-1 | T2 | uat |
| 2 | "★ Save current system" never disabled — rejects on click instead | High | UX-2 | T3 | uat |
| 3 | Two save paths, two fidelities, no marking (result-★ shallow vs top-save full) | Med | UX-3 | T1 | unit + uat |
| 4 | Same ★ glyph, two meanings (save-current vs save-result) | Med | UX-4 | T4 | uat |
| 5 | "500 match(es)" but 50 shown, no "showing 50 of N" / sweep-cap notice | Med | UX-5 | T5 | unit + uat |
| 6 | Probe filters use raw code labels (`isBinary`…) inconsistent with rest of panel | Med | UX-6 | T6 | uat |
| 7 | `Archetype —` bare em-dash for Sol reads like missing data | Low | UX-7 | T7 | uat |
| 8 | `✕` removes instantly, no confirm/undo | Low | UX-8 | T7 | uat |
| 9 | 12/14 panel form fields unlabeled (40× a11y console warning) | Low | UX-9 | T7 | uat |
| 10 | Fonts small (10px headings) | Low (taste) | — | **Decision D2** | n/a |

---

## Decisions (resolved 2026-06-05)

**D1 — Result-save fidelity → CONFIRM-ON-SAVE (chosen).** A result-row save fully (deterministically) generates that one system via `generateFromNavStar` and stores its full tags, so **every saved entry is always full-fidelity** — the shallow/full asymmetry is gone from the saved list. Cost is one `StarSystemGenerator.generate` per save (~tens of ms), acceptable for an explicit user action. The `~`/`isShallowTags` marker from T1 still applies to **probe result ROWS** (the list shows cheap tags until you save), so the user can see which rows are unconfirmed before acting — but the moment they save, it's confirmed. Implemented in **T4** (save handler regenerates) with T1's helpers reused for the result-row display.

**D2 — Font bump (finding #10) → WON'T-FIX (default kept).** It's a debug surface, legible at native res per the eval. Not implemented by any task.

---

## Task 0: Extend the trial contract

**Files:**
- Modify: `docs/WORKSTREAMS/system-tags-save-search/contract.json`

- [ ] **Step 1: Append the UX ACs to `acceptanceCriteria`**

Insert these objects after `AC8-debug-panel-uat` (keep valid JSON — comma after the prior entry):

```json
{
  "id": "UX-1-live-tag-refresh",
  "statement": "While the panel is open, the SYSTEM TAGS grid, the Save-button enabled state, and the probe Center label re-render whenever the active system changes (warp / jump), without requiring a panel close+reopen.",
  "verifyVia": {
    "input": "Open panel in system A; trigger a system change (probe-jump or warp) while the panel stays open; read #debug-tags-grid.",
    "observable": "The grid shows system B's tags (matching window._lab.systemInfo()), not A's, with no reopen."
  },
  "layer": "uat"
},
{
  "id": "UX-2-save-guard-visible",
  "statement": "When there is no faithful nav snapshot (_currentNavStar null), the Save button is visibly disabled with a persistent reason, instead of looking clickable and rejecting on click.",
  "verifyVia": {
    "input": "Enter a system via _lab.enterSol() (no warp); inspect #debug-save-system; then arrive via probe-jump and inspect again.",
    "observable": "Disabled (greyed, not pointer, reason shown) before a faithful arrival; enabled after."
  },
  "layer": "uat"
},
{
  "id": "UX-3-fidelity-marking",
  "statement": "Tag summaries distinguish shallow (unconfirmed rings/hab) from confirmed sets; a pure tagSummary()/isShallowTags() pair produces the string and the flag.",
  "verifyVia": {
    "input": "Call tagSummary() on a cheap-tag set (hasRings:null) vs a full set; call isShallowTags() on each.",
    "observable": "Shallow set is flagged and its summary carries the marker + omits rings/hab; full set is not flagged and shows rings/hab."
  },
  "layer": "unit"
},
{
  "id": "UX-4-distinct-save-affordance",
  "statement": "The result-row save control is visually/labelled distinct from the top 'Save current system' control, and saving a result CONFIRMS it to full fidelity (regenerates the system) so saved entries are never shallow.",
  "verifyVia": { "input": "Run a SHALLOW probe; inspect a result row's save button; save a '~'-marked row; inspect the resulting saved entry.", "observable": "Result save reads 'save' (text), not a bare '★'; the saved entry shows confirmed rings/hab tokens with NO '~' marker even though the probe row was shallow." },
  "layer": "uat"
},
{
  "id": "UX-5-result-count-truth",
  "statement": "Probe reporting tells the truth about truncation: the status names the matched count and whether the sweep hit its star cap, and the results list shows 'showing N of M'.",
  "verifyVia": {
    "input": "probeRegionDetailed() on a region denser than the sweep cap; run the probe in-panel.",
    "observable": "Returns {results, sweptCount, sweepCapped}; status notes the cap; results header reads 'showing 50 of <matched>'."
  },
  "layer": "unit"
},
{
  "id": "UX-6-human-filter-labels",
  "statement": "Probe filter labels match the human labels used in SYSTEM TAGS (Binary / Star type / Has rings / Habitable), not raw field names.",
  "verifyVia": { "input": "Inspect probe filter row labels.", "observable": "No 'isBinary'/'primaryType'/'hasRings'/'hasHabitable' code names shown to the user." },
  "layer": "uat"
},
{
  "id": "UX-7-polish",
  "statement": "Empty archetype renders a labelled '(none)' not a bare em-dash; removing a saved entry requires a confirm/arm step; new probe+saved form fields carry accessible labels (no a11y warning for them).",
  "verifyVia": { "input": "Inspect Sol's archetype row; click ✕ once then again; audit new fields for associated labels.", "observable": "'(none)'; first ✕ arms, second removes; new selects/inputs have aria-label." },
  "layer": "uat"
}
```

- [ ] **Step 2: Validate JSON**

Run: `cd ~/projects/well-dipper && node -e "JSON.parse(require('fs').readFileSync('docs/WORKSTREAMS/system-tags-save-search/contract.json','utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add docs/WORKSTREAMS/system-tags-save-search/contract.json
git commit -m "scope(system-tags): add UX-1..UX-7 refinement ACs"
```

---

## Task 1: Pure tag-summary + shallow-fidelity helpers (UX-3)

Extracts the row-summary logic out of `DebugPanel._tagSummary` into a pure, tested function, and adds a shallow-fidelity marker keyed on the `hasRings === null` signal that `deriveCheapTags` already emits.

**Files:**
- Modify: `src/generation/SystemTags.js` (add exports after `deriveSystemTags`)
- Test: `src/generation/__tests__/SystemTags.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `SystemTags.test.js`:

```js
import { tagSummary, isShallowTags } from '../SystemTags.js';

describe('isShallowTags', () => {
  it('flags a cheap-tag set (rings/hab unknown) as shallow', () => {
    expect(isShallowTags({ isBinary: true, primaryType: 'K', secondaryType: 'K', planetCount: 3, hasRings: null, hasHabitable: null })).toBe(true);
  });
  it('does not flag a fully-confirmed set', () => {
    expect(isShallowTags({ isBinary: false, primaryType: 'G', secondaryType: null, planetCount: 8, hasRings: true, hasHabitable: true })).toBe(false);
  });
});

describe('tagSummary', () => {
  it('renders a confirmed single-star set with rings/hab suffixes', () => {
    expect(tagSummary({ isBinary: false, primaryType: 'G', secondaryType: null, planetCount: 8, hasRings: true, hasHabitable: true }))
      .toBe('G · 8p · rings · hab');
  });
  it('renders a confirmed binary', () => {
    expect(tagSummary({ isBinary: true, primaryType: 'K', secondaryType: 'K', planetCount: 3, hasRings: true, hasHabitable: true }))
      .toBe('K+K · bin · 3p · rings · hab');
  });
  it('marks a shallow set and omits the unconfirmed rings/hab', () => {
    expect(tagSummary({ isBinary: true, primaryType: 'K', secondaryType: 'K', planetCount: 3, hasRings: null, hasHabitable: null }))
      .toBe('~K+K · bin · 3p');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test -- src/generation/__tests__/SystemTags.test.js`
Expected: FAIL — `tagSummary is not a function` / `isShallowTags is not a function`.

- [ ] **Step 3: Implement the helpers**

Append to `src/generation/SystemTags.js`:

```js
/**
 * Is this tag set shallow (cheap fast-path)? Cheap tags leave the expensive
 * keys as null (see StarSystemGenerator.deriveCheapTags) — they were never
 * confirmed by per-planet generation.
 * @param {object} tags
 * @returns {boolean}
 */
export function isShallowTags(tags) {
  return tags.hasRings === null || tags.hasHabitable === null;
}

/**
 * Compact one-line summary of a tag set for a result/saved row.
 * Shallow sets are prefixed '~' and omit the unconfirmed rings/hab tokens.
 * @param {object} t — a tag set from deriveSystemTags or deriveCheapTags
 * @returns {string}
 */
export function tagSummary(t) {
  const parts = [];
  parts.push(t.secondaryType ? `${t.primaryType}+${t.secondaryType}` : t.primaryType);
  if (t.isBinary) parts.push('bin');
  parts.push(`${t.planetCount}p`);
  if (t.hasRings === true) parts.push('rings');
  if (t.hasHabitable === true) parts.push('hab');
  const s = parts.join(' · ');
  return isShallowTags(t) ? `~${s}` : s;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- src/generation/__tests__/SystemTags.test.js`
Expected: PASS (all, including the 3 new).

- [ ] **Step 5: Delegate DebugPanel to the shared helper (DRY)**

In `src/ui/DebugPanel.js`:
- Add `tagSummary` and `isShallowTags` to the existing import: `import { deriveSystemTags, tagSummary, isShallowTags } from '../generation/SystemTags.js';`
- Replace the whole `_tagSummary(t) { ... }` method body (lines ~927-936) with a one-line delegate:

```js
  /** Short one-line tag summary for a result/saved row. */
  _tagSummary(t) {
    return tagSummary(t);
  }
```

(Leaving the method as a thin wrapper keeps the ~6 existing call sites untouched.)

- [ ] **Step 6: Commit**

```bash
git add src/generation/SystemTags.js src/generation/__tests__/SystemTags.test.js src/ui/DebugPanel.js
git commit -m "feat(system-tags): pure tagSummary + shallow-fidelity marker (UX-3)"
```

---

## Task 2: Live tag-grid / save-state refresh while panel open (UX-1)

The grid is built only at `_populatePanel` (panel-open) time. `main.js` calls `setSystem(system, systemData)` once per system load (line 3850) — not per frame — so it is safe to refresh the live sections from there when the panel is visible.

**Files:**
- Modify: `src/ui/DebugPanel.js` — `setSystem`, `setCurrentNavStar`, add `_refreshLiveSections`

- [ ] **Step 1: Add a refresh method**

Add near the other helpers (after `_tagsRowsHtml`, ~line 920):

```js
  /**
   * Re-render the system-dependent sections in place. Cheap (innerHTML of two
   * small grids + button state); called only on system/nav change while the
   * panel is open, never per frame.
   */
  _refreshLiveSections() {
    if (!this._panelVisible || !this._panelEl) return;
    const grid = this._panelEl.querySelector('#debug-tags-grid');
    if (grid) grid.innerHTML = this._tagsRowsHtml();
    const center = this._panelEl.querySelector('#debug-probe-center');
    if (center) center.textContent = this._probeCenterLabel();
    this._updateSaveButtonState();
  }
```

- [ ] **Step 2: Call it from the data setters**

In `setSystem` (line ~67), after `this._stellarEvolution = ...;` add:
```js
    this._refreshLiveSections();
```
In `setCurrentNavStar` (line ~59), after the `this._currentNavStar = ...` assignment add:
```js
    this._refreshLiveSections();
```

- [ ] **Step 3: Build (no unit test — DOM)**

Run: `npm run build`
Expected: builds clean, no errors.

- [ ] **Step 4: Verify via chrome-devtools UAT (deferred to T8 sweep)** — covered in the consolidated UAT (Task 8, check UX-1). No commit-time browser step here.

- [ ] **Step 5: Commit**

```bash
git add src/ui/DebugPanel.js
git commit -m "fix(debug-panel): live-refresh tags/center/save-state on system change (UX-1)"
```

> Depends on `_updateSaveButtonState` from Task 3 — do **Task 3 before building/committing Task 2**, or stub `_updateSaveButtonState() {}` first. Recommended order: T1 → T3 → T2.

---

## Task 3: Visible save guard (UX-2)

Replace the click-time rejection with a button that is genuinely disabled (greyed, no pointer) and shows a persistent reason when there's no faithful snapshot.

**Files:**
- Modify: `src/ui/DebugPanel.js` — save button markup, new `_updateSaveButtonState`, save handler

- [ ] **Step 1: Add the state method**

Add near `_refreshLiveSections`:

```js
  /** Enable the Save button only when a faithful snapshot exists; else grey it
   * out with a persistent reason (no more click-to-find-out-it-failed). */
  _updateSaveButtonState() {
    const btn = this._panelEl?.querySelector('#debug-save-system');
    const status = this._panelEl?.querySelector('#debug-save-status');
    if (!btn) return;
    const ok = !!(this._currentNavStar && this._systemData);
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.4';
    btn.style.cursor = ok ? 'pointer' : 'not-allowed';
    btn.title = ok ? '' : 'Warp or jump to a system first — a faithful save needs its star snapshot.';
    if (status && !ok) status.textContent = 'Save needs a warp/jump arrival (faithful star snapshot).';
    else if (status && ok && status.textContent.startsWith('Save needs')) status.textContent = '';
  }
```

- [ ] **Step 2: Call it on populate**

At the end of `_wireControls`, just before `this._renderSavedList(container);` (line ~899), add:
```js
    this._updateSaveButtonState();
```

- [ ] **Step 3: Simplify the click handler**

The handler (lines ~817-827) keeps its guard as defence-in-depth but it should no longer be the primary signal. Leave the early-return guard intact (a disabled button can't be clicked, but the guard protects programmatic calls). No code change required beyond Step 1–2; the disabled attribute does the work.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/DebugPanel.js
git commit -m "fix(debug-panel): disable Save with persistent reason instead of click-time reject (UX-2)"
```

---

## Task 4: Distinct result-row save affordance + confirm-on-save (UX-4, D1-b)

Two changes: (1) the result-row save control reads `save` (text) not a bare `★`; (2) saving a result **regenerates the full system** so the stored tags are always confirmed — no shallow entries in the saved list.

**Files:**
- Modify: `src/ui/DebugPanel.js` — import, `_renderProbeResults` (line ~962), save-result delegation branch (lines ~879-885)

- [ ] **Step 1: Import the resolver**

Add to the imports at the top of `DebugPanel.js`:
```js
import { generateFromNavStar } from '../generation/SystemResolver.js';
```
(`deriveSystemTags` is already imported.)

- [ ] **Step 2: Change the result save button to a labelled control + shallow tooltip on the ROW**

Replace line ~962:
```js
      h += `<span class="dg-val"><button class="debug-btn" data-jump-result="${i}">jump</button> <button class="debug-btn" data-save-result="${i}">★</button></span>`;
```
with:
```js
      const shallow = isShallowTags(r.tags);
      const saveTitle = shallow ? 'Save — confirms rings/habitability by regenerating the system' : 'Save this system';
      h += `<span class="dg-val"><button class="debug-btn" data-jump-result="${i}">jump</button> <button class="debug-btn" data-save-result="${i}" title="${saveTitle}">save</button></span>`;
```

(The top control stays `★ Save current system`; result rows now read `jump` / `save` — no duplicated bare star. The `~` marker still shows on the row's tag-summary label, so the user sees "unconfirmed" before saving.)

- [ ] **Step 3: Confirm-on-save in the delegation handler**

Replace the `si != null` branch (lines ~879-885):
```js
        } else if (si != null) {
          const r = this._probeResults[Number(si)];
          if (r) {
            this._savedSystems.save({ navStarData: r.navStarData, tags: r.tags, name: null });
            this._renderSavedList(container);
            if (status) status.textContent = `Saved ${this._tagSummary(r.tags)}`;
          }
        }
```
with (regenerate to confirm full tags before storing):
```js
        } else if (si != null) {
          const r = this._probeResults[Number(si)];
          if (r) {
            // Confirm-on-save (D1-b): regenerate the full system so the stored
            // tags carry real rings/habitability, never the shallow nulls.
            let tags = r.tags;
            try {
              if (this._galacticMap) tags = deriveSystemTags(generateFromNavStar(this._galacticMap, r.navStarData));
            } catch { /* fall back to the probe-row tags if regen fails */ }
            this._savedSystems.save({ navStarData: r.navStarData, tags, name: null });
            this._renderSavedList(container);
            if (status) status.textContent = `Saved ${this._tagSummary(tags)}`;
          }
        }
```

- [ ] **Step 4: Build & commit**

```bash
npm run build && git add src/ui/DebugPanel.js && git commit -m "feat(debug-panel): 'save' label + confirm-on-save full fidelity for results (UX-4, D1-b)"
```

---

## Task 5: Truthful probe counts (UX-5)

Add a `probeRegionDetailed` that reports swept count + cap, keep `probeRegion`'s array contract for existing callers/tests, and surface "showing N of M" + a cap note in the panel.

**Files:**
- Modify: `src/generation/SystemProbe.js`
- Test: `src/generation/__tests__/SystemProbe.test.js`
- Modify: `src/ui/DebugPanel.js` — probe handler + `_renderProbeResults`

- [ ] **Step 1: Write the failing tests**

Add to `SystemProbe.test.js` (reuse its existing `map`, `CENTER`):

```js
import { probeRegionDetailed } from '../SystemProbe.js';

describe('UX-5 — probeRegionDetailed metadata', () => {
  it('reports sweptCount and sweepCapped, with results === probeRegion output', () => {
    const region = { shape: 'radius', center: CENTER, radiusKpc: 0.03, maxResults: 50 };
    const detailed = probeRegionDetailed(map, region, {}, { scanDepth: 'shallow' });
    expect(Array.isArray(detailed.results)).toBe(true);
    expect(detailed.sweptCount).toBeGreaterThan(0);
    // dense solar neighborhood overflows a 50-star cap
    expect(detailed.sweepCapped).toBe(true);
    expect(detailed.sweptCount).toBe(50);
  }, 30000);

  it('sweepCapped is false when the region fits under the cap', () => {
    const region = { shape: 'radius', center: CENTER, radiusKpc: 0.0005, maxResults: 500 };
    const detailed = probeRegionDetailed(map, region, {}, { scanDepth: 'shallow' });
    expect(detailed.sweepCapped).toBe(false);
    expect(detailed.results.length).toBe(detailed.sweptCount);
  }, 30000);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm run test -- src/generation/__tests__/SystemProbe.test.js`
Expected: FAIL — `probeRegionDetailed is not a function`.

- [ ] **Step 3: Refactor `probeRegion` to delegate to `probeRegionDetailed`**

In `src/generation/SystemProbe.js`, replace the `export function probeRegion(...)` body so the loop lives in a detailed variant, and `probeRegion` returns just the array (unchanged contract):

```js
export function probeRegionDetailed(galacticMap, region, filter = {}, options = {}) {
  const scanDepth = options.scanDepth || 'shallow';
  const { cheap, expensive } = splitFilter(filter);
  const hasExpensive = Object.keys(expensive).length > 0;

  const stars = sweepRegion(galacticMap, region);
  const cap = region.maxResults ?? (region.shape === 'prism' ? 3000 : 500);
  const sweepCapped = stars.length >= cap;
  const results = [];

  for (const star of stars) {
    const navStarData = toNavStarData(star);
    const { seed, galaxyContext } = resolveNavStar(galacticMap, navStarData);
    const cheapTags = StarSystemGenerator.deriveCheapTags(seed, galaxyContext);
    if (!matchesFilter(cheapTags, cheap)) continue;
    if (scanDepth === 'deep' && hasExpensive) {
      const fullTags = deriveSystemTags(StarSystemGenerator.generate(seed, galaxyContext));
      if (!matchesFilter(fullTags, expensive)) continue;
      results.push({ navStarData, tags: fullTags });
    } else if (scanDepth === 'deep') {
      const fullTags = deriveSystemTags(StarSystemGenerator.generate(seed, galaxyContext));
      results.push({ navStarData, tags: fullTags });
    } else {
      results.push({ navStarData, tags: cheapTags });
    }
  }
  return { results, sweptCount: stars.length, sweepCapped };
}

/** Backward-compatible array-returning wrapper (existing callers/tests). */
export function probeRegion(galacticMap, region, filter = {}, options = {}) {
  return probeRegionDetailed(galacticMap, region, filter, options).results;
}
```

- [ ] **Step 4: Run to verify pass (new + existing all green)**

Run: `npm run test -- src/generation/__tests__/SystemProbe.test.js`
Expected: PASS — new metadata tests pass AND all pre-existing AC3/AC4 tests still pass (they call `probeRegion`, contract unchanged).

- [ ] **Step 5: Wire the panel to the detailed counts**

In `src/ui/DebugPanel.js`:
- Update the import: `import { probeRegion, probeRegionDetailed } from '../generation/SystemProbe.js';`
- In the probe handler (line ~842-852), replace the `probeRegion` call + status line:

```js
          const region = { shape: 'radius', center, radiusKpc };
          const detailed = probeRegionDetailed(this._galacticMap, region, filter, { scanDepth });
          this._probeResults = detailed.results;
          const capNote = detailed.sweepCapped
            ? ` (scan capped at ${detailed.sweptCount} nearest stars — narrow the radius for full coverage)`
            : '';
          if (probeStatus) probeStatus.textContent = `${this._probeResults.length} match(es) in ${radiusKpc} kpc (${scanDepth})${capNote}.`;
```

- In `_renderProbeResults` (line ~957-964), add a "showing N of M" header row before the loop:

```js
    let h = '';
    const shown = results.slice(0, 50);
    if (results.length > shown.length) {
      h += `<span class="dg-label" style="color:#8cf">showing ${shown.length} of ${results.length}</span><span class="dg-val"></span>`;
    }
```

- [ ] **Step 6: Build & commit**

```bash
npm run build && git add src/generation/SystemProbe.js src/generation/__tests__/SystemProbe.test.js src/ui/DebugPanel.js && git commit -m "feat(probe): truthful swept/cap counts + 'showing N of M' (UX-5)"
```

---

## Task 6: Human-readable probe filter labels (UX-6)

**Files:**
- Modify: `src/ui/DebugPanel.js` — probe filter markup (lines ~506-509)

- [ ] **Step 1: Rename the four filter labels to match SYSTEM TAGS**

Replace the `<label class="dg-label">isBinary</label>` → `Binary`, `primaryType` → `Star type`, `hasRings` → `Has rings`, `hasHabitable` → `Habitable`. (Only the visible `<label>` text changes; the `id`s `debug-f-binary` etc. and `_readProbeFilter` stay the same.)

- [ ] **Step 2: Build & commit**

```bash
npm run build && git add src/ui/DebugPanel.js && git commit -m "fix(debug-panel): human filter labels matching SYSTEM TAGS (UX-6)"
```

---

## Task 7: Polish — archetype label, remove-confirm, a11y labels (UX-7)

**Files:**
- Modify: `src/ui/DebugPanel.js`

- [ ] **Step 1: Archetype `(none)` instead of bare em-dash (#7)**

In `_tagsRowsHtml` (line ~918) replace:
```js
    h += this._row('Archetype', t.archetype ?? '—');
```
with:
```js
    h += this._row('Archetype', t.archetype ?? '(none)');
```

- [ ] **Step 2: Arm-to-confirm on ✕ remove (#8)**

In the delegation handler's `rm` branch (lines ~889-892), replace the immediate remove with a two-click arm:
```js
        } else if (rm != null) {
          if (t.dataset.armed === '1') {
            this._savedSystems.remove(rm);
            this._renderSavedList(container);
          } else {
            t.dataset.armed = '1';
            t.textContent = 'sure?';
            setTimeout(() => { if (t.isConnected) { t.dataset.armed = '0'; t.textContent = '✕'; } }, 2500);
          }
        }
```

- [ ] **Step 3: Accessible labels on the new form fields (#9)**

Add `aria-label` to each new control so the 40× "No label associated with form field" warning stops firing for this feature's fields:
- `#debug-probe-radius` → `aria-label="Probe radius in kiloparsecs"`
- `#debug-probe-depth` → `aria-label="Scan depth"`
- `#debug-f-binary` → `aria-label="Filter: binary"`
- `#debug-f-ptype` → `aria-label="Filter: star type"`
- `#debug-f-rings` → `aria-label="Filter: has rings"`
- `#debug-f-hab` → `aria-label="Filter: habitable"`
- `#debug-saved-filter` → `aria-label="Saved-systems filter"`

(Pre-existing non-feature fields — `debug-grain`, `debug-star-bright`, `debug-mouse-sens`, `debug-seed-input`, `debug-star-search` — are **out of scope** for this workstream; note in NOW.md that they still warn, as a separate cleanup.)

- [ ] **Step 4: Build & commit**

```bash
npm run build && git add src/ui/DebugPanel.js && git commit -m "fix(debug-panel): archetype label, ✕ arm-to-confirm, a11y labels (UX-7)"
```

---

## Task 8: Consolidated verification (dev-collab trial flow)

This is the trial's verify step. Run the dev-collab verify-workflow against the extended contract, then a single chrome-devtools UAT sweep for every `uat`-layer AC.

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite green**

Run: `cd ~/projects/well-dipper && npm run test`
Expected: all pass, including the 2 pre-existing known failures' baseline unchanged (compare to the verdict.json baseline — no NEW failures). Capture output.

- [ ] **Step 2: Run the dev-collab verify-workflow**

Run: `node ~/projects/personal-os-improvements/dev-collab/workflows/verify-workstream.mjs --workstream system-tags-save-search --contract ~/projects/well-dipper/docs/WORKSTREAMS/system-tags-save-search/contract.json`
(Use the script as-is — its uncommitted fixes are carried context, not part of this plan. Confirm exact flags with `--help` first.)
Expected: unit/integration ACs PASS; uat ACs flagged for manual UAT (Step 3).

- [ ] **Step 3: chrome-devtools UAT sweep (port 9223)**

Per `~/.claude/projects/-home-ax/memory/well-dipper-testing-reference.md` §7.5/§7.6: **hard-reload first**, open panel with ArrowDown (window only), `_lab.enterSol()` + `_lab.stopAutopilot()`. Then verify each:
- **UX-1:** enter Sol, open panel, probe→jump to a result; WITHOUT reopening, confirm `#debug-tags-grid` matches `window._lab.systemInfo()` of the new system.
- **UX-2:** in `enterSol` state, confirm `#debug-save-system.disabled === true`, greyed, `title` set; after a probe-jump confirm it's enabled and Save succeeds.
- **UX-3/UX-4:** run a SHALLOW probe; a result ROW reads `~…` summary + `jump`/`save` (the `~` flags unconfirmed); click `save`; confirm the resulting SAVED entry has NO `~` and shows confirmed rings/hab tokens (confirm-on-save regenerated it). The `~` marker therefore only ever appears on probe result rows, never on saved entries.
- **UX-5:** dense probe shows `showing 50 of <N>` and a cap note in status.
- **UX-6:** filter labels read Binary / Star type / Has rings / Habitable.
- **UX-7:** Sol archetype reads `(none)`; first ✕ → `sure?`, second removes; `list_console_messages` shows no "No label associated" warning for the new field ids.
- **GPU hygiene:** navigate the 9223 tab to `about:blank` when done.

- [ ] **Step 4: Doc-on-ship (Rule 3) + verdict**

- Update `docs/NOW.md` (what landed) and the `FEATURES.md` row for this workstream.
- Append a `verdict-ux.json` (or extend `verdict.json`) with the UX-AC evidence.
- Run: `npm run doc-rot -- --workstream system-tags-save-search` — expect no doc gap.

- [ ] **Step 5: Commit docs (do NOT push)**

```bash
git add docs/ && git commit -m "docs(system-tags): UX-refinement verdict + NOW/FEATURES (Rule 3)"
```

Leave the branch unpushed (carried context #3). Surface the AC-H trial verdict to Max — the polished product is now ready for his judgment of the dev-collab flow.

---

## Self-Review

- **Spec coverage:** All 10 findings mapped (table above). #1→T2, #2→T3, #3→T1, #4→T4, #5→T5, #6→T6, #7/#8/#9→T7, #10→Decision D2 (won't-fix default). ✓
- **Placeholders:** none — every code step has real code/strings and exact line anchors. ✓
- **Type/name consistency:** `tagSummary`/`isShallowTags` (T1) reused in T4; `probeRegionDetailed` returns `{results, sweptCount, sweepCapped}` (T5) consumed identically in panel; `_updateSaveButtonState` defined T3, called T2/T3 (ordering note flagged in T2). ✓
- **Ordering dependency:** T1 → T3 → T2 → T4 → T5 → T6 → T7 → T8 (T2 needs T3's `_updateSaveButtonState`). ✓
