# LOD Lab Archetype Info View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explanatory archetype info block behind an ⓘ toggle next to the World folder's `archetype` field in the planet-LOD lab GUI — fully derived at runtime from `ARCHETYPES` / `FEATURES` / `featuresOf()` / live `state.*`, making the derived-archetype → relevant-feature-set logic legible.

**Architecture:** A single renderer (`buildArchetypeInfo()`) reads `driverUI.preset`, `relevantFeatureSet()`, `ARCHETYPES`, `featuresOf()`, and live `state.*` and produces a **plain DOM** `<div>` (NOT lil-gui controllers, so it never perturbs `syncDisplays()` or the reparenting relevance filter). The block is injected under the disabled `archetype` controller's field row in the World folder, shown/hidden by an **ⓘ button** appended to that same row (mirroring the title-bar DOM-injection pattern proven by `relocateEnableToTitle()`). It re-renders on preset change (hooked at the tail of `applyArchetypeFilter()`, after the `archetypeLabel` it sits beneath is updated) and refreshes its dots + K count on any feature enable-toggle. **No `planet-lod-lab-core.js` (shader/uniform) changes, no generator, no generated file, no drift guard, no unit test → no planet rendering can regress and there is nothing offline to test.**

**Tech Stack:** lil-gui (`addFolder`, controller `.domElement`/`.$name`/`.$widget`, `.controllers`), plain DOM for the block, Vite dev server (`localhost:5173`), chrome-devtools MCP on GPU Chrome `:9223` for live GUI verification (NOT Playwright, NOT image recognition), Vitest only to confirm existing suites stay green.

**Spec:** `docs/superpowers/specs/2026-06-15-lod-lab-archetype-info-view-design.md`

**Sibling plan (format reference):** `docs/superpowers/plans/2026-06-15-lod-lab-feature-info-cards.md` (Ask 2 — per-feature info cards). Ask 3 (this plan) is the info-layer twin: it reuses the same inline-ⓘ DOM mechanism but has **no prose to author**, so the generator / generated module / `package.json` script / drift-guard / unit-test tasks from Ask 2 are intentionally **absent** here.

---

## Build-ordering note: Ask 3 is INDEPENDENT of Ask 2 (read before starting)

Ask 2 (per-feature info cards) is **spec'd + planned but NOT yet built** — none of its code is in `world-engine-lab.html` yet. This plan is written to **NOT depend on Ask 2 having shipped first**:

- Ask 3 injects its ⓘ onto the **disabled `archetype` controller's field row** in the World folder (a different DOM target from Ask 2's per-feature **folder title bars**).
- Ask 3 defines its **own** `.title-info` / block CSS under a distinct selector, so it does not collide with Ask 2 if/when that lands. (If Ask 2 ships first and already defines `.lil-gui .title-info`, that rule is compatible — both want a small clickable glyph — but to stay independent this plan defines its block styling under `.archetype-info` and does not assume `.title-info` pre-exists; Step 1.2 adds the rule unconditionally and a duplicate identical `.title-info` rule is harmless.)
- The shared pattern both asks copy from is `relocateEnableToTitle()` (Phase 1, already in the file) — **not** each other.

**Either order works.** If both are being scheduled, Ask 3 can ship before, after, or in parallel with Ask 2. The only soft coupling is cosmetic CSS reuse, handled above. Raise with Max only if he wants the two ⓘ glyphs to share one CSS class for visual consistency — that's a taste call, not a technical blocker.

---

## Verification reality (read before any GUI step)

The lab GUI is an **inline `<script>` in `world-engine-lab.html`** — NOT importable by Vitest. There is **no generator** in Ask 3 (the contrast with Ask 2), so there is **no unit test** to write. Per [[well-dipper-testing-reference]] the lab is verified **live on `:9223`** (GPU Chrome, NOT Playwright, NOT image recognition) via `window._lab.*` helpers + DOM queries (`mcp__chrome-devtools__evaluate_script`). Reload `?fresh=1` before each check.

**Existing test contract that must stay green:** `tests/planet-archetypes.test.js` scans the lab source with the regex `/\.add\(state, '(\w+Enabled)'\)/g` to learn which enable keys the panel binds (and cross-checks `cityLightsEnabled` → `PROV_CITYLIGHTS`, pin #16). The archetype info block is **plain DOM** and adds **no** `.add(state, '…Enabled')` calls and removes none — so this regex's match set is unchanged. Do not refactor any `.add(state, 'xEnabled')` line. `tests/feature-associations.test.js` and the Stage-D GLSL drift-guard are likewise untouched (additive GUI-only change).

---

## Standing cautions

- **Line numbers are HINTS** — `grep -n` every edit site before editing (line drift in `world-engine-lab.html` is a known hazard). Re-grep: `relevantFeatureSet`, `applyArchetypeFilter`, `fWorld`, `archetypeLabel`, `relocateEnableToTitle`.
- **Stage explicit paths only.** The ONLY source path this plan modifies is `world-engine-lab.html`; the close-out also touches `docs/NOW.md`. **NEVER `git add -A`** — the shared working tree has unrelated warp WIP + loose `.png`/`.webm`/`.html` litter.
- Reload `localhost:5173/well-dipper/world-engine-lab.html?fresh=1` before each live verification (`:9223` may hold a stale session; `?fresh=1` opts out of the sessionStorage scenario-restore).
- End every commit message with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Decisions locked by spec + source inspection (do NOT re-litigate)

These are the spec's LOCKED display decisions, confirmed against the live source. Honor every one:

1. **Header counts.** `N archetypes` = `relevantFeatureSet().archs.length`. `M relevant features` = the **DE-DUPLICATED** count = `relevantFeatureSet().set.size` (a feature in two of the world's archetypes counts **once**). `K enabled` = of those `M` relevant features, how many have `state[FEATURES[key].enableKey]` true right now. A force-enabled-but-irrelevant feature is **outside `M`** and **NOT** counted in `K` — `K` measures the world's *expected* roster only. (Spec §"Header counts (precise definitions)".)

2. **Per-archetype rosters are NOT de-duplicated.** A feature belonging to multiple of the world's archetypes (e.g. `mountains` ∈ `tectonic-terrestrial` + `volcanic`; `frost` ∈ `volatile-cold` + `icy-active`) is shown under **EACH** archetype it belongs to. Max explicitly approved this — do NOT dedup per-archetype rosters. The single de-duplicated total lives only in the header's `M`. (Spec §"Per-archetype rosters are NOT de-duplicated".)

3. **Roster layout = inline wrapping chips, NOT one row per feature.** Each archetype's roster renders as an inline, wrapping row of compact chips (`● Mountains  ○ Canyons  …`). No scroll / multi-column / collapse for v1. (Spec §"Roster layout (locked)".)

4. **Per-archetype heading carries that archetype's own roster count** (e.g. `Tectonic / terrestrial (27)`), so `27 + 5` is visible against the header's unique `M = 30`. (Spec §"Count reconciliation (locked)".)

5. **Shared-chip marker.** A feature belonging to **more than one** of the world's *current* archetypes gets a subtle "shared" marker on its chip in each roster (a trailing glyph + muted styling) so the duplicated chips that explain the `M`-vs-roster-sum gap are visually identifiable. (Spec §"Count reconciliation (locked)".) **"Shared" = shared among THIS world's current archetypes** (`relevantFeatureSet().archs`), not globally — a feature is only marked if ≥2 of the archetypes currently shown list it. Computed by counting, per relevant feature key, how many of `archs` include it via `featuresOf`.

6. **Enable-state dots:** `●` enabled / `○` off, per feature, read from `state[FEATURES[key].enableKey]` at render time. (Spec §"Enable-state dots".)

7. **Read-only roster.** Each chip is plain text + dot, **not** a link. Clickable→jump is explicit FUTURE/YAGNI — not built. (Spec §"Read-only roster in v1".)

8. **Block is plain DOM, collapsed by default.** A styled `<div>`, NOT lil-gui controllers. ⓘ off by default; the per-view ⓘ open/closed is the only new UI state. (Spec §"GUI rendering".)

9. **Re-render timing.** The block rebuilds *after* `applyArchetypeFilter()` updates `filterUI.archetypeLabel` (so header/counts match the label above it). On a mere enable-toggle, only the dots + `K` count update — N/M/rosters do not change. (Spec §"Re-render timing" + §"Live-update behavior".)

**Source facts confirmed (line numbers are HINTS):**
- `relevantFeatureSet()` returns `{ set, archs }` — `set` is a de-duplicated `Set` of feature keys, `archs` is the array of archetype keys whose `presets` include `driverUI.preset` (~L7083).
- `applyArchetypeFilter()` sets `filterUI.archetypeLabel` (~L7091) and ends with `syncDisplays();` (~L7106) — the re-render hook goes after that line.
- Preset change path: `fWorld.add(driverUI,'preset',…).onChange(applyDrivers)` (~L7115); `applyDrivers()` calls `applyArchetypeFilter()` as its last line (~L6266). So hooking the re-render at the tail of `applyArchetypeFilter()` covers BOTH the preset picker and the filter toggle.
- The disabled archetype controller is created at `fWorld.add(filterUI, 'archetypeLabel').name('archetype').disable();` (~L7116) but its return value is **not currently captured** — Task 2 changes that line to capture the controller so its `.domElement` (the field row) is the injection target.
- `relocateEnableToTitle()` (~L6935) is the reference DOM-injection pattern (`stopPropagation` on the injected control; `appendChild` onto an existing GUI element).
- `_lab` exports (~L7813): `state`, `setPreset(name)`, `solo(key)`, `unsolo()`, `setFilter(on)`, `featureFolders`, `filterUI`, `featureEnabled(key)`, `driverUI`. These drive the live verification.
- `DRIVER_PRESETS` keys include `'Venus (sulfuric shroud)'`, `'Gas giant (Jovian)'`, `'Rocky (Earthlike)'` (used in verification). Confirm exact spellings via the preset picker if a `setPreset` call no-ops.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `world-engine-lab.html` | Add `escapeHtml()` (if not already present from Ask 2) + `buildArchetypeInfo()` renderer + chip helpers; capture the archetype controller; inject the ⓘ toggle + block onto its field row; re-render at the tail of `applyArchetypeFilter()`; refresh dots+K on enable toggle. | **Modify** (inline `<script>` + one CSS block) |
| `docs/NOW.md` | Close-out: note Ask 3 landed `VERIFIED_PENDING_MAX <sha>`. | **Modify** |

No new files. No generator, no generated module, no `package.json` change, no `scripts/doc-rot-check.sh` change, no test file — all intentionally absent (Ask 3 derives everything at runtime; nothing is authored or duplicated).

---

## Pre-flight (once, before Task 1)

- [ ] **Step 0.1: Confirm the dev server + lab are reachable on `:9223`.**

Run (chrome-devtools MCP): `list_pages`, then `navigate_page` reload `localhost:5173/well-dipper/world-engine-lab.html?fresh=1`.
Expected: page loads, planet renders, left (Drivers/World) + right (Features) GUI panels visible.

- [ ] **Step 0.2: Capture ground truth for the Venus acceptance case** (so later checks have exact expected numbers).

Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  // Reach the lab's internal derivation through a tiny probe: setPreset returns derived,
  // but we need relevantFeatureSet — recompute it from the exported pieces.
  // ARCHETYPES/FEATURES/featuresOf are module-scoped (not on _lab), so derive via filterUI label + featureFolders.
  L.setPreset('Venus (sulfuric shroud)');
  const archLabel = L.filterUI.archetypeLabel;     // joined label shown in the World folder
  // Count enabled among ALL feature folders (sanity; M/K are asserted later via the block itself).
  const allKeys = Object.keys(L.featureFolders);
  return { archLabel, totalFeatureFolders: allKeys.length };
}
```
Expected: `archLabel` contains both `Tectonic / terrestrial` and `Volcanic` (joined with ` + `); `totalFeatureFolders` is the full feature count (~47). Record `archLabel` — Task 4's header must match it.

---

## Task 1: The `buildArchetypeInfo()` renderer + CSS (no UI wiring yet)

Define the renderer and its helpers, and add the CSS. No injection yet (Task 2) — this task only proves the renderer produces correct HTML from the live derivation.

**Files:**
- Modify: `world-engine-lab.html` — a CSS block near the existing title-toggle CSS (~L94-97); the renderer added after `applyArchetypeFilter()`'s definition (~L7107, so `relevantFeatureSet`/`applyArchetypeFilter` are in scope) — note these are function declarations (hoisted), so placement relative to other defs is flexible, but put it right after `applyArchetypeFilter` for readability.

- [ ] **Step 1.1: Add the CSS block.**

Re-grep the existing title-toggle CSS: `grep -n 'title-has-toggle' world-engine-lab.html` (~L94). After the `.lil-gui .title-toggle .lil-widget` rule (~L97), add:
```css
    /* Archetype info view (Ask 3) — plain DOM injected under the World folder's
       disabled `archetype` field row. Collapsed by default; ⓘ toggles .open. */
    .lil-gui .archetype-info { display: none; font-size: 11px; line-height: 1.5;
      padding: 6px 8px; margin: 2px 0 6px; background: #16161b;
      border-left: 2px solid #c9a14a; color: #cfd2d6; }
    .lil-gui .archetype-info.open { display: block; }
    .lil-gui .archetype-info .ai-header { font-weight: 600; color: #e6e8ea; margin-bottom: 4px; }
    .lil-gui .archetype-info .ai-arch { margin-top: 6px; }
    .lil-gui .archetype-info .ai-arch-h { color: #c9a14a; }
    .lil-gui .archetype-info .ai-bodies { color: #8a8f96; font-style: italic; }
    .lil-gui .archetype-info .ai-roster { margin-top: 2px; }
    /* inline wrapping chips — NOT one row per feature (spec lock #3) */
    .lil-gui .archetype-info .ai-chip { display: inline-block; margin: 1px 8px 1px 0; white-space: nowrap; }
    .lil-gui .archetype-info .ai-on  { color: #6ad06a; }   /* ● enabled */
    .lil-gui .archetype-info .ai-off { color: #8a8f96; }   /* ○ off */
    .lil-gui .archetype-info .ai-shared { opacity: 0.72; }  /* multi-archetype feature (spec lock #5) */
    .lil-gui .archetype-info .ai-note { color: #6f747b; font-size: 10px; margin-top: 6px; }
    /* the ⓘ toggle on the archetype field row */
    .lil-gui .title-info { cursor: pointer; user-select: none; opacity: 0.7; margin-left: 6px; }
    .lil-gui .title-info:hover { opacity: 1; }
```

- [ ] **Step 1.2: Add `escapeHtml()` only if it is not already defined.**

Re-grep: `grep -n 'function escapeHtml' world-engine-lab.html`.
- If it returns a hit (e.g. Ask 2 already shipped and defined it), **do NOT add a second copy** — reuse the existing one and skip to Step 1.3.
- If it returns nothing, add this helper immediately before the renderer in Step 1.3:
```js
    function escapeHtml(s){ return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
```

- [ ] **Step 1.3: Add the `buildArchetypeInfo()` renderer.**

Re-grep the end of `applyArchetypeFilter`: `grep -n 'function applyArchetypeFilter' world-engine-lab.html` (~L7089); the function ends with `syncDisplays();` then `}` (~L7106-7107). **After** that closing brace, add:
```js
    // ── Archetype info view (Ask 3) ───────────────────────────────────────────
    // A read-only, fully-derived explanation of WHY each feature is in this world's
    // roster. Returns the innerHTML for a plain <div> (NOT a lil-gui controller),
    // so it never perturbs syncDisplays(), the enable controllers, or the
    // reparenting relevance filter (applyArchetypeFilter() moves FEATURE folders;
    // this block lives on the World folder and is untouched by that loop).
    //
    // Header  : preset → N archetypes · M relevant features (DE-DUPED) · K enabled
    // Per arch: <label> (rosterCount) — like <bodies> ; then inline wrapping chips
    //           ● Enabled  ○ Off, each chip marked "shared" if ≥2 of THIS world's
    //           current archetypes list it (explains the M-vs-roster-sum gap).
    function archetypeInfoHtml(){
      const { set, archs } = relevantFeatureSet();          // set = de-duped keys; archs = current archetype keys
      const N = archs.length;
      const M = set.size;                                    // de-duplicated total (spec lock #1)
      let K = 0;                                             // enabled among the M relevant features only (spec lock #1)
      for (const key of set) if (state[FEATURES[key].enableKey]) K++;

      // Per-relevant-feature: how many of THIS world's current archetypes list it.
      // ≥2 → "shared" marker on its chip in each roster (spec lock #5).
      const archMembership = {};                             // key -> count among `archs`
      for (const a of archs) for (const k of featuresOf(a)) archMembership[k] = (archMembership[k] || 0) + 1;

      const presetName = driverUI.preset;
      const parts = [];
      parts.push(`<div class="ai-header">${escapeHtml(presetName)} &rarr; `
        + `${N} archetype${N === 1 ? '' : 's'} &middot; ${M} relevant feature${M === 1 ? '' : 's'} `
        + `&middot; ${K} enabled</div>`);

      if (N === 0) {
        parts.push(`<div class="ai-note">No archetype maps to this preset.</div>`);
        return parts.join('');
      }

      for (const a of archs) {
        const meta = ARCHETYPES[a];
        const roster = featuresOf(a);                        // NOT de-duped across archetypes (spec lock #2)
        parts.push(`<div class="ai-arch">`
          + `<span class="ai-arch-h">${escapeHtml(meta.label)} (${roster.length})</span>`   // per-arch count (lock #4)
          + (meta.bodies && meta.bodies.length
              ? ` <span class="ai-bodies">like ${escapeHtml(meta.bodies.join(', '))}</span>` : '')
          + `</div>`);
        const chips = roster.map(key => {
          const enabled = !!state[FEATURES[key].enableKey];
          const dot = enabled
            ? '<span class="ai-on">&#9679;</span>'           // ●
            : '<span class="ai-off">&#9675;</span>';         // ○
          const shared = (archMembership[key] || 0) >= 2;    // shared among THIS world's archetypes (lock #5)
          // short chip label: strip the trailing "(F#)" tag from FEATURES[key].label
          const name = FEATURES[key].label.replace(/\s*\(F[^)]*\)\s*$/, '');
          return `<span class="ai-chip${shared ? ' ai-shared' : ''}">`
            + `${dot} ${escapeHtml(name)}${shared ? '&middot;' : ''}</span>`;   // trailing ˙-style marker
        }).join('');
        parts.push(`<div class="ai-roster">${chips}</div>`);
      }

      parts.push(`<div class="ai-note">Header counts unique features (M=${M}); `
        + `per-archetype rosters list a feature under every archetype it belongs to, so `
        + `shared&middot; features are double-listed. K counts only enabled features relevant to this world.</div>`);
      return parts.join('');
    }
```
**Why a forward reference to `state` / `FEATURES` / `ARCHETYPES` / `featuresOf` / `driverUI` is fine:** `archetypeInfoHtml` is a function *declaration* (hoisted), and is only *called* at runtime (Task 2 onward), long after all module imports and `state`/`driverUI` are defined. It is never invoked at definition time.

- [ ] **Step 1.4: Prove the renderer produces correct HTML (temporary probe, removed after).**

Temporarily expose the renderer for verification by re-grepping the `_lab` export object (`grep -n 'window._lab = {' world-engine-lab.html`, ~L7813) and adding `archetypeInfoHtml,` to it (you will REMOVE this probe line in Step 1.6). Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  L.setPreset('Venus (sulfuric shroud)');
  const html = L.archetypeInfoHtml();
  // Extract header counts: "... → N archetypes · M relevant features · K enabled"
  const m = html.match(/(\d+)\s*archetype.*?(\d+)\s*relevant feature.*?(\d+)\s*enabled/);
  // Does 'Mountains' chip appear under BOTH Tectonic and Volcanic? Count its occurrences.
  const mtnChips = (html.match(/Mountains/g) || []).length;
  // Is the Mountains chip marked shared (ai-shared)?
  const mtnShared = /ai-shared[^>]*>[^<]*<span class="ai-on">[\s\S]*?Mountains/.test(html)
                 || /Mountains&middot;/.test(html);
  return {
    N: m && +m[1], M: m && +m[2], K: m && +m[3],
    hasTectonic: /Tectonic \/ terrestrial \(\d+\)/.test(html),
    hasVolcanic: /Volcanic \(\d+\)/.test(html),
    mountainsChipCount: mtnChips,
    mountainsShared: mtnShared,
    venusBodies: /like Earth, Venus, Mars/.test(html),
  };
}
```
Expected:
- `N === 2` (Tectonic/terrestrial + Volcanic for the Venus preset).
- `M` = de-duplicated relevant-feature count; `M < (tectonic roster + volcanic roster)` because `mountains`/`massWasting` etc. are double-listed (so `M` is strictly less than the sum of the two per-archetype counts).
- `hasTectonic` and `hasVolcanic` both `true`, each with a `(count)` heading.
- `mountainsChipCount === 2` (appears under BOTH archetypes — spec acceptance).
- `mountainsShared === true` (shared marker present).
- `venusBodies === true` ("like Earth, Venus, Mars" from `ARCHETYPES['tectonic-terrestrial'].bodies`).
- `K` ≤ `M`.

If any expectation fails, fix `archetypeInfoHtml` (NOT the test) before continuing. Common cause: the chip-name strip regex over-/under-matching the `(F#)` tag — verify against `FEATURES.frost.label` (`'Cryo / Frost (F23/F22)'` → chip name `Cryo / Frost`).

- [ ] **Step 1.5: Verify the Gas-giant single-archetype case.**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  L.setPreset('Gas giant (Jovian)');
  const html = L.archetypeInfoHtml();
  const m = html.match(/(\d+)\s*archetype/);
  return {
    N: m && +m[1],
    hasGasGiant: /Gas giant \(\d+\)/.test(html),
    // no shared markers expected with a single archetype (nothing can be in ≥2)
    hasShared: /ai-shared/.test(html),
  };
}
```
Expected: `N === 1`, `hasGasGiant === true`, `hasShared === false` (with one archetype no feature can be shared).

- [ ] **Step 1.6: Remove the temporary probe.**

Re-grep `grep -n 'archetypeInfoHtml,' world-engine-lab.html` and delete the `archetypeInfoHtml,` line you added to the `_lab` export in Step 1.4. (The renderer stays; only the debug export is removed — the production path calls it internally via Task 2.) Reload `?fresh=1` and confirm the page still renders (no console error from the removed reference): `list_console_messages` shows no new errors.

- [ ] **Step 1.7: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add world-engine-lab.html
git commit -m "feat(lod-lab): archetype info-view renderer + CSS (Ask 3)

archetypeInfoHtml() derives the World folder's archetype explanation at
runtime from ARCHETYPES/FEATURES/featuresOf()/live state: header N/M(de-duped)/K
counts, per-archetype roster (count + bodies) as inline wrapping chips with
enable dots and a shared marker for multi-archetype features. Plain DOM only;
no core/shader change. Not yet wired to a UI toggle (next commit).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: ⓘ toggle + inline injection on the archetype field row

Wire the renderer into the World folder: capture the disabled archetype controller, inject a hidden `<div>` block under its field row, and an ⓘ button onto that row that toggles the block. Collapsed by default.

**Files:**
- Modify: `world-engine-lab.html` — the archetype controller line (~L7116) and an injection block right after it.

- [ ] **Step 2.1: Capture the archetype controller and inject the block + ⓘ.**

Re-grep: `grep -n "fWorld.add(filterUI, 'archetypeLabel')" world-engine-lab.html` (~L7116). Change that line to **capture** the controller, then add the injection immediately after it:
```js
    const archCtrl = fWorld.add(filterUI, 'archetypeLabel').name('archetype').disable();
    // ── Archetype info block: plain DOM injected directly under the archetype field
    //    row, toggled by an ⓘ on that row (mirrors relocateEnableToTitle's injection).
    const archInfoEl = document.createElement('div');
    archInfoEl.className = 'archetype-info';                 // collapsed by default (CSS display:none)
    // Insert as the next sibling of the archetype controller's row, INSIDE the World
    // folder body, so it sits visually beneath the label it explains.
    archCtrl.domElement.insertAdjacentElement('afterend', archInfoEl);
    const archInfoBtn = document.createElement('span');
    archInfoBtn.className = 'title-info';
    archInfoBtn.textContent = 'ⓘ';
    archInfoBtn.title = 'why are these features relevant to this world?';
    archInfoBtn.addEventListener('click', e => {
      e.stopPropagation();                                  // don't disturb the disabled controller
      const opening = !archInfoEl.classList.contains('open');
      if (opening) archInfoEl.innerHTML = archetypeInfoHtml();   // build fresh on open (cheap)
      archInfoEl.classList.toggle('open');
    });
    // Append the ⓘ into the controller's NAME cell (the field's left label), after
    // the "archetype" text — the disabled widget cell stays untouched.
    (archCtrl.$name || archCtrl.domElement).appendChild(archInfoBtn);
    // Keep a single live re-render entry point used by the preset/toggle hooks below.
    function refreshArchetypeInfo(){
      if (archInfoEl.classList.contains('open')) archInfoEl.innerHTML = archetypeInfoHtml();
    }
```
**Note on `archCtrl.$name`:** lil-gui controllers expose `.$name` (the label cell) and `.$widget` (the value cell). Appending the ⓘ to `.$name` keeps it adjacent to the "archetype" text and away from the disabled widget. If `.$name` is undefined in this lil-gui version, the `|| archCtrl.domElement` fallback appends to the whole row — verify in Step 2.3 which one renders cleanly and keep the working target.

- [ ] **Step 2.2: Hook the re-render at the tail of `applyArchetypeFilter()` (preset change).**

Re-grep `function applyArchetypeFilter` (~L7089). It currently ends:
```js
      syncDisplays();
    }
```
The block's renderer is defined *after* this function in source, but `refreshArchetypeInfo` is created at GUI-build time (Step 2.1), which runs *after* all function declarations load and *before* any preset change. To avoid an ordering trap, guard the call so it no-ops until the block exists. Change the tail to:
```js
      syncDisplays();
      if (typeof refreshArchetypeInfo === 'function') refreshArchetypeInfo();   // re-derive AFTER archetypeLabel set (spec lock #9)
    }
```
**Why this ordering is safe:** `applyArchetypeFilter()` is called once during GUI build (via the initial `applyDrivers()`), possibly *before* `refreshArchetypeInfo` is assigned — the `typeof` guard makes that early call a no-op. Every later call (preset change at ~L6266, filter toggle at ~L7117) runs after `refreshArchetypeInfo` exists. Because this is the tail of `applyArchetypeFilter()`, the block rebuilds *after* `filterUI.archetypeLabel` is updated (~L7091) — so header/counts always match the label above (spec lock #9). The block only rebuilds when **open** (closed = cheap no-op).

- [ ] **Step 2.3: Verify the ⓘ toggle works live (collapsed by default, opens, closes).**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  L.setPreset('Venus (sulfuric shroud)');
  // Find the World folder, then the archetype-info block + its ⓘ.
  const block = document.querySelector('.lil-gui .archetype-info');
  const btn = document.querySelector('.lil-gui .title-info');
  const openBefore = block.classList.contains('open');
  btn.click();
  const openAfter = block.classList.contains('open');
  const text = block.textContent;
  btn.click();
  const closedAgain = !block.classList.contains('open');
  return {
    blockExists: !!block, btnExists: !!btn,
    openBefore, openAfter, closedAgain,
    headerHasCounts: /\d+ archetype.*\d+ relevant feature.*\d+ enabled/.test(text),
    hasTectonic: /Tectonic \/ terrestrial \(\d+\)/.test(text),
    hasVolcanic: /Volcanic \(\d+\)/.test(text),
  };
}
```
Expected: `blockExists` & `btnExists` true; `openBefore === false` (collapsed by default — spec lock #8); `openAfter === true`; `closedAgain === true`; `headerHasCounts`, `hasTectonic`, `hasVolcanic` all true. If `btn` is null, the `.$name` append failed — re-check Step 2.1's `.$name`/fallback and confirm in the DOM where the ⓘ landed.

- [ ] **Step 2.4: Verify the disabled-controller markup tolerates the injection** (spec: DOM injection must not clobber lil-gui's disabled-controller markup or collide with Phase-1/Ask-2 injections).

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const row = document.querySelector('.lil-gui .archetype-info').previousElementSibling; // the archetype controller row
  return {
    rowStillDisabled: row.classList.contains('disabled') || !!row.querySelector('[disabled], .disabled'),
    rowShowsLabel: /archetype/i.test(row.textContent),
    archLabelStillShows: /Tectonic|Volcanic|terrestrial/i.test(row.textContent),  // the joined label is still rendered in the widget
    blockIsSibling: row.nextElementSibling.classList.contains('archetype-info'),
  };
}
```
Expected: `rowStillDisabled === true` (the archetype field is still visibly disabled — injection didn't re-enable it); `rowShowsLabel === true`; `archLabelStillShows === true` (the disabled value text survived); `blockIsSibling === true` (the block sits immediately after the row, inside the World folder). Take a `take_screenshot` for the record — the ⓘ next to "archetype", block expanded beneath it.

- [ ] **Step 2.5: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add world-engine-lab.html
git commit -m "feat(lod-lab): inline archetype info view behind an ⓘ toggle (Ask 3)

Captures the World folder's disabled archetype controller and injects a hidden
plain-DOM block under its field row, plus an ⓘ on the row that shows/hides it
(mirrors relocateEnableToTitle). Collapsed by default; rebuilds on open and at
the tail of applyArchetypeFilter() so header counts match the archetype label
above. No core/shader change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Live-update wiring — dots + K on enable toggle, full re-derive on preset change

The block must update its enable dots + `K` count when Max toggles any feature's enable, and re-derive entirely on preset change. Preset change is already covered by Task 2.2's hook (the tail of `applyArchetypeFilter()`, which `applyDrivers()` calls on every preset change). This task adds the enable-toggle path.

**Files:**
- Modify: `world-engine-lab.html` — the feature-folder enable relocation loop (~L6944-6946) / `relocateEnableToTitle()` (~L6935).

- [ ] **Step 3.1: Refresh the block on any feature enable-toggle.**

The block's dots + `K` read live `state[…Enabled]`. When Max flips a feature's enable checkbox (relocated to the folder title in Phase 1), the block — if open — must re-render. Re-grep `function relocateEnableToTitle` (~L6935). Add an `onChange` hook to the relocated enable controller so every enable flip refreshes the block:
```js
    function relocateEnableToTitle(folder, prop){
      const ctrl = folder.controllers.find(c => c.property === prop);
      if (!ctrl) return;
      const title = folder.$title;
      title.classList.add('title-has-toggle');
      ctrl.domElement.classList.add('title-toggle');
      ctrl.domElement.addEventListener('click', e => e.stopPropagation());
      title.appendChild(ctrl.domElement);
      ctrl.onChange(() => { if (typeof refreshArchetypeInfo === 'function') refreshArchetypeInfo(); }); // enable flip → dots + K update
    }
```
**Ordering:** `relocateEnableToTitle` runs in the relocation loop at GUI build (~L6944), which is *before* `refreshArchetypeInfo` is assigned (Task 2.1 runs later at ~L7116+). The `typeof` guard makes the controller's `onChange` safe to register early; by the time Max can click an enable (after the page is interactive), `refreshArchetypeInfo` exists. Re-grep to confirm the relocation loop precedes the World-folder block creation; if so, the guard is doing its job (no card to refresh at the moment of registration, correct refresh thereafter).

**Note (`solo`/`unsolo` also change enables):** soloing/unsoloing flips many `state.*Enabled` flags programmatically. Those paths may not fire each controller's `onChange`. The block re-renders on the next *open* anyway (Step 2.1 rebuilds `innerHTML` on every open), and the spec's live-update acceptance is specifically about (a) preset change and (b) a single feature enable-toggle — both covered. If Max later wants the block to live-track solo while open, add a `refreshArchetypeInfo()` call into `soloFeature()`/`unsolo()`; that is **out of scope for v1** (YAGNI — not in the spec's acceptance list).

- [ ] **Step 3.2: Verify dots + K update on enable toggle; N/M/rosters unchanged (spec acceptance).**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  L.setPreset('Venus (sulfuric shroud)');
  const block = document.querySelector('.lil-gui .archetype-info');
  document.querySelector('.lil-gui .title-info').click();   // open
  const readK = () => (block.textContent.match(/(\d+) enabled/) || [])[1];
  const readN = () => (block.textContent.match(/(\d+) archetype/) || [])[1];
  const readM = () => (block.textContent.match(/(\d+) relevant feature/) || [])[1];
  const before = { K: readK(), N: readN(), M: readM() };
  // Toggle one relevant feature's enable via its title checkbox. 'mountains' is relevant on Venus.
  const f = L.featureFolders.mountains;
  const enableCtrl = f.$title.querySelector('.title-toggle input[type="checkbox"]');
  enableCtrl.click();                                       // flip mountains enable
  const after = { K: readK(), N: readN(), M: readM() };
  enableCtrl.click();                                       // restore
  return { before, after,
    kChanged: before.K !== after.K,
    nSame: before.N === after.N,
    mSame: before.M === after.M };
}
```
Expected: `kChanged === true` (K moved by ±1), `nSame === true`, `mSame === true` (N and M unchanged on a mere toggle — spec lock #9). If `kChanged` is false, the enable `onChange` hook isn't firing — re-check Step 3.1 and that the checkbox selector matches the relocated control's markup (inspect `f.$title` DOM).

- [ ] **Step 3.3: Verify full re-derive on preset change (already-hooked path).**

Reload `?fresh=1`. Run (`evaluate_script`):
```js
() => {
  const L = window._lab;
  const block = document.querySelector('.lil-gui .archetype-info');
  document.querySelector('.lil-gui .title-info').click();   // open
  L.setPreset('Venus (sulfuric shroud)');
  const venus = { txt: block.textContent,
                  N: (block.textContent.match(/(\d+) archetype/)||[])[1],
                  matchesLabel: block.textContent.includes(L.filterUI.archetypeLabel.split(' + ')[0]) };
  L.setPreset('Gas giant (Jovian)');
  const gas = { txt: block.textContent,
                N: (block.textContent.match(/(\d+) archetype/)||[])[1],
                matchesLabel: block.textContent.includes('Gas giant') };
  return {
    venusN: venus.N, gasN: gas.N,
    venusHasVolcanic: /Volcanic/.test(venus.txt),
    gasHasNoVolcanic: !/Volcanic/.test(gas.txt),
    venusHeaderMatchesLabel: venus.matchesLabel,
    gasHeaderMatchesLabel: gas.matchesLabel,
  };
}
```
Expected: `venusN === '2'`, `gasN === '1'`; `venusHasVolcanic === true`; `gasHasNoVolcanic === true`; both `…MatchesLabel === true` (the block's header preset/archetypes match the `archetype` label shown above it — spec lock #9, re-render-after-label-update). Take a `take_screenshot` after switching to Gas giant.

- [ ] **Step 3.4: Commit.**
```bash
cd /home/ax/projects/well-dipper
git add world-engine-lab.html
git commit -m "feat(lod-lab): live-update archetype info view on enable/preset change (Ask 3)

Enable-toggle now refreshes the open block's dots + K count (N/M/rosters
unchanged); preset change re-derives the whole view via the existing
applyArchetypeFilter() tail hook so the header matches the archetype label.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Live acceptance pass + regression sweep + close-out

- [ ] **Step 4.1: Existing unit suites stay green (additive change).**

Run: `cd /home/ax/projects/well-dipper && npx vitest run`
Expected: all green, including `tests/planet-archetypes.test.js` (the `\.add\(state, '(\w+Enabled)'\)` scan + `cityLights → PROV_CITYLIGHTS` pin #16 — we added no `.add(state,…Enabled)` and removed none), `tests/feature-associations.test.js`, and the Stage-D GLSL drift-guard. If any previously-green suite is now red, STOP and diagnose — the change is additive, so a red existing suite means an unintended edit to `world-engine-lab.html`.

- [ ] **Step 4.2: Final live acceptance pass against the spec's Verification list.**

Reload `?fresh=1`. Confirm each spec acceptance check (combine into one or two `evaluate_script` calls; the per-check assertions were proven in Tasks 1-3, this is the consolidated final sweep):
- **Venus (sulfuric shroud)** → block shows BOTH archetypes (Tectonic/terrestrial + Volcanic) with bodies, each roster with correct ●/○ dots; `mountains` appears under BOTH; header `M` counts it once. (Steps 1.4, 2.3.)
- **Gas giant (Jovian)** → gas-giant roster only, one archetype, correct dots; no shared markers. (Steps 1.5, 3.3.)
- **Toggle a feature** → dot flips ○↔● and `K` updates; N/M unchanged. (Step 3.2.)
- **Switch preset** → whole view re-derives and matches the `archetype` label above. (Step 3.3.)
- **Collapsed by default**; ⓘ shows/hides. (Step 2.3.)

Consolidated check (`evaluate_script`):
```js
() => {
  const L = window._lab;
  const block = document.querySelector('.lil-gui .archetype-info');
  const btn = document.querySelector('.lil-gui .title-info');
  const out = {};
  out.collapsedByDefault = !block.classList.contains('open');
  L.setPreset('Venus (sulfuric shroud)');
  btn.click();                                              // open
  const v = block.textContent;
  out.venusTwoArch = /(2) archetype/.test(v);
  out.venusBothLabels = /Tectonic \/ terrestrial \(\d+\)/.test(v) && /Volcanic \(\d+\)/.test(v);
  out.mountainsTwice = (v.match(/Mountains/g) || []).length === 2;
  out.hasDots = /●|○|●|○/.test(v) || /ai-on|ai-off/.test(block.innerHTML);
  L.setPreset('Gas giant (Jovian)');
  const g = block.textContent;
  out.gasOneArch = /(1) archetype/.test(g);
  out.gasNoVolcanic = !/Volcanic/.test(g);
  btn.click();                                              // close
  out.hidesAgain = !block.classList.contains('open');
  return out;
}
```
Expected: every field `true`.

- [ ] **Step 4.3: Update `docs/NOW.md`.**

Re-grep the active session / menu-overhaul block: `grep -n 'menu.*overhaul\|info-layer\|Ask 2\|Ask 3\|SESSION 2026-06-15' docs/NOW.md`. Update the menu-overhaul entry to note Ask 3 (archetype info view) landed `VERIFIED_PENDING_MAX <sha>` (use the Task 3 commit SHA — the last user-visible deliverable), and that Ask 4 (live render-audit surfacing) remains. Keep to the existing block's format/brevity. Per [[well-dipper-open-phase-status]] and the campaign tracker, this is lab *tooling* (charter: lab≠game), not a game feature — note that framing if the block records it.

- [ ] **Step 4.4: Commit the NOW.md update.**
```bash
cd /home/ax/projects/well-dipper
git add docs/NOW.md
git commit -m "docs(now): lod-lab archetype info view (Ask 3) verified-pending-Max

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (run by plan author)

**1. Spec coverage** (every spec section → a task):
- "Data flow: fully derived; nothing authored" → Task 1 `archetypeInfoHtml()` reads `relevantFeatureSet`/`ARCHETYPES`/`featuresOf`/`FEATURES`/`state` only; no file/generator. ✔
- "Placement: ⓘ next to the disabled `archetype` field; block injected under the row, inside World folder" → Task 2.1 (`archCtrl.domElement.insertAdjacentElement('afterend', …)`, ⓘ on `.$name`). ✔
- "View content & sources: header (preset → N · M · K), per-arch heading (label + roster count), bodies, roster chips with dots" → Task 1.3 (all four rows). ✔
- "Header counts: N=archs.length, M=set.size de-duped, K=enabled∩M, force-enabled-irrelevant excluded from K" → Task 1.3 (`for (const key of set) if (enabled) K++` — only iterates the de-duped relevant set). ✔
- "Per-archetype rosters NOT de-duped; multi-arch feature under EACH archetype" → Task 1.3 (`featuresOf(a)` per archetype, no cross-archetype dedup); verified `mountainsChipCount === 2` (Step 1.4). ✔
- "Roster layout = inline wrapping chips, not rows" → Task 1.1 CSS `.ai-chip { display:inline-block }`; Task 1.3 chips joined inline. ✔
- "Count reconciliation: per-arch heading count + shared marker" → Task 1.3 (`(${roster.length})` heading; `ai-shared` + `&middot;` marker when `archMembership[key] >= 2`); note line explains M-vs-sum. ✔
- "Enable dots ●/○ from live state" → Task 1.3. ✔
- "Read-only roster (no links) — clickable is FUTURE" → chips are plain `<span>`; no anchors. ✔
- "Plain DOM not lil-gui; collapsed by default" → Task 1 (`<div>`), Task 2 (CSS `display:none` default; ⓘ toggles `.open`). ✔
- "Re-render timing: rebuild AFTER applyArchetypeFilter updates the label" → Task 2.2 (hook at the function tail, after L7091's label set). ✔
- "Live-update: preset change → full re-derive; enable toggle → dots + K only (N/M/rosters unchanged)" → Task 2.2 (preset) + Task 3.1 (enable); verified `kChanged && nSame && mSame` (Step 3.2). ✔
- "Verification: live :9223; Venus both archetypes/mountains-under-both/M-once; Gas-giant one roster; toggle flips dot+K; switch preset re-derives; collapsed default; existing suites green; explicit-path commits" → Tasks 1.4-1.5, 2.3-2.4, 3.2-3.3, 4.1-4.2; all commits stage explicit paths. ✔
- "Out of scope: clickable roster (Ask 3.x), Ask 4 render-audit, Ask 2, Thread B" → not built; Ask 4 noted in Step 4.3; Ask 2 independence covered in the build-ordering note. ✔
- "No generator / no drift guard / no unit test" → none present (the deliberate contrast with Ask 2). ✔

**2. Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step shows complete code. The "re-grep before editing" notes are deliberate line-drift caution (the implementer reads the actual file), not placeholders. ✔

**3. Type/name consistency:** `archetypeInfoHtml` (renderer), `refreshArchetypeInfo` (re-render entry), `archInfoEl` (block div), `archInfoBtn` (ⓘ), `archCtrl` (captured controller), `escapeHtml` (guarded against double-def) used consistently across Tasks 1-3. `relevantFeatureSet()` destructured as `{ set, archs }` matching the source (L7083). `state[FEATURES[key].enableKey]` enable-read matches the codebase convention. The `typeof refreshArchetypeInfo === 'function'` guard appears identically in Task 2.2 and Task 3.1 (handles the build-time ordering where the function is referenced before assignment). No `.add(state, 'xEnabled')` line is touched (pin #16 stays green). ✔

**4. Verified-against-source facts baked in:** `relevantFeatureSet`/`applyArchetypeFilter`/`fWorld`/`archetypeLabel`(disabled controller)/`relocateEnableToTitle`/`syncDisplays` all exist at the cited (HINT) lines; `_lab` exposes `setPreset`/`setFilter`/`featureFolders`/`filterUI`/`state` for verification; `mountains` ∈ tectonic-terrestrial + volcanic and `tectonic-terrestrial.bodies = ['Earth','Venus','Mars']` (drives the Venus acceptance assertions). ✔

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-15-lod-lab-archetype-info-view.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**2. Inline Execution** — execute tasks in this session via superpowers:executing-plans, batch execution with checkpoints. REQUIRED SUB-SKILL: superpowers:executing-plans.

**Which approach?**
