# Design — Planet-LOD lab live render-audit surfacing (Ask 4 of the menu/info overhaul)

**Date:** 2026-06-15
**Author:** working-Claude (brainstormed with Max)
**Status:** spec — 5 open decisions LOCKED (2026-06-15) → ready for implementation plan
**Scope:** `world-engine-lab.html` (GUI) + a small extracted **pure status-mapping module**
(`lab-render-status.js`, new file) + a unit test for it (`tests/render-status.test.js`) +
`scripts/gen-render-audit.mjs` (refactored to import the shared `EPS`/`STRONG` constants from the new
module — see "Shared constants" below). **No shader/core changes** (`planet-lod-lab-core.js` untouched),
so this cannot regress any planet rendering. It REUSES the existing pure auditor (`lab-render-audit.js`)
and the existing in-page sweep (`renderDeltaSweep()`) — it adds no new GPU code, just a surface over
what already exists. The only offline-pipeline touch is the constants refactor in `gen-render-audit.mjs`,
which is behavior-preserving (verified by a byte-identical re-generation of `lab-render-audit.md`).
**Campaign frame:** this is lab *tooling*, not a planet feature — the campaign per-feature UAT loop
does NOT govern. It's a GUI/derivation addition (plus one tiny pure helper), verified live on `:9223`.
Single-system → `dev-collab-scope` is NOT invoked (same call as the Phase-1 declutter and Asks 2/3),
even though Ask 4 is the heaviest of the three info-layer GUI asks.
**Sequencing:** Ask 4 is sequenced **after Thread B** (render-correctness residuals) so the audit it
surfaces reflects the *fixed* renderer, not stale false/dead-renders. But it has **no code dependency**
on Thread B — it reads whatever the live sweep returns, so it can be built independently and will simply
report fewer violations once Thread B lands.
**Siblings:** the info-layer trio.
- **Ask 2** — per-feature info cards (`docs/superpowers/specs/2026-06-15-lod-lab-feature-info-cards-design.md`):
  *what is this feature?*
- **Ask 3** — archetype info view (`docs/superpowers/specs/2026-06-15-lod-lab-archetype-info-view-design.md`):
  *why is this feature in THIS world's roster?*
- **Ask 4** (this spec): *does each feature actually render?* — the live render-audit layer Ask 3 explicitly
  deferred to ("Ask 3 = expected roster + enable state. Ask 4 = does each feature actually render.").

## Why

The menu overhaul is Max's goal #3; it makes the per-feature quality pass *legible*. Phase 1
(declutter, `fc30eb1`) built a clean frame; Asks 2/3 surface *what a feature is* and *why it's in the
roster*. **Ask 4 closes the loop:** during the per-feature quality pass, surface which features
**ACTUALLY fire** vs. are **dead** (declared but inert) or **false-render** (paint where they
shouldn't) on the **current world**, so mismatches are visible *while tuning* instead of only in the
offline report. It is the third info-layer: Ask 2 = what a feature is; Ask 3 = why it's in this world's
roster; **Ask 4 = does it actually render.** In a brainstorm (2026-06-15) Max approved a **live,
on-demand audit** (no cached file), surfaced as **per-feature status glyphs** that **auto-stale on any
edit**.

## What — the design

### Freshness model = LIVE ON-DEMAND (Max's pick)

**No static/cached file dependency.** The offline pipeline
(`window._lab.renderDeltaSweep()` over all 17 presets → `.sweep-raw.json` →
`scripts/gen-render-audit.mjs` → `docs/FEATURES/lab-render-audit.md`) stays exactly as it is and is
**untouched**. Ask 4 is a *second, in-GUI consumer* of the same sweep, scoped to the **current preset
only**, run on demand:

- An **"Audit this world" button** (in the World folder, near the Ask 3 archetype view / next to the
  existing `archetype` field and `filter to relevant` controls, ~`world-engine-lab.html:7115-7121`) runs
  `renderDeltaSweep()` for the **CURRENT** preset, classifies each feature, and stores the result on
  state:
  ```js
  state.audit = {
    preset,                              // driverUI.preset at audit time
    fresh: true,                         // flips false on any subsequent edit
    results: { [featureKey]: { status, delta } }   // status = glyph tier; delta = sweep fraction
  };
  ```
- The button shows an **"Auditing…" working state** for the ~seconds the sweep runs. The sweep already
  **freezes auto-spin** (`_sweepFreeze`), drives `t` + `yaw` by hand, and **restores clock + camera +
  enables** at the end (`world-engine-lab.html:7048-7078`), so the only UI obligation is to disable the
  button while running and re-enable it after. The audit is a single `await renderDeltaSweep()` for the
  current preset, not the 17-preset offline loop, so it's far shorter than a full report sweep.

### Classification — reuse the existing pure auditor

The lab already imports `ASSOCIATIONS` (`world-engine-lab.html:111`) and already has the **47-key**
`FEATURES` registry (`planet-archetypes.js`), and their key sets are **identical** (verified: same 47
keys, different order — so the audit join is exact with no gaps). Ask 4 additionally imports the pure
auditor:

```js
import { ASSOCIATIONS } from './planet-feature-associations.js';   // already imported (line 111)
import { expectedMatrix, auditRenderMatrix } from './lab-render-audit.js';   // NEW in the lab
```

Per-feature classification, for the current preset `p`, mirrors `scripts/gen-render-audit.mjs` exactly:

1. `manifest = { [f]: { rendersOn: ASSOCIATIONS[f].rendersOn || [] } }`.
2. `expected = expectedMatrix(manifest, [p])` → `expected[f][p]` = should-this-feature-render-here.
3. From the sweep's `deltas[f]` (a single fraction for the current preset) build
   `actualDeltas = { [f]: { [p]: deltas[f] } }`.
4. `auditRenderMatrix(expected, actualDeltas, { eps })` → `{ falseRenders, deadRenders }` (the auditor's
   rule: `falseRender = !should && delta > eps`; `deadRender = should && delta <= eps`,
   `lab-render-audit.js:22-33`).
5. Per feature, derive a STATUS glyph (below), pulling the degenerate flag from the sweep's returned
   `degenerate[f]`.

### Per-feature STATUS vocabulary (the report's glyphs, exactly)

Use **the EXACT glyph strings and thresholds the offline report already emits** (`gen-render-audit.mjs`
`glyph()` at lines 56-64, `EPS`/`STRONG` at lines 14-15), so the in-GUI surface and the offline report
**agree cell-for-cell**. The vocabulary is locked to the report's strings — note the strong-false badge
keeps its **`F` suffix (`🔴F`, never bare `🔴`)**:

| Status | Glyph | Rule (current preset) |
|---|---|---|
| fires-as-declared | ✅ | `should && delta > eps` |
| strong false-render | 🔴F | `!should && delta > STRONG` |
| faint false-render | ⚠️F | `!should && eps < delta <= STRONG` |
| dead-render | ⚠️D | `should && delta <= eps` |
| correctly inert | `·` | `!should && delta <= eps` |
| degenerate (black/blown) | ⬛ | sweep `degenerate[f] != null` (`"black"` or `"blown"`) |

**Thresholds (locked to the report) — single source of truth (IN SCOPE):** `eps = 1e-4`,
`STRONG = 5e-4`. These are exported as named constants `EPS`/`STRONG` from the new pure status module
(`lab-render-status.js`, below), and **BOTH** consumers import them from there: the in-GUI badge
(`world-engine-lab.html`) **and** the offline report (`gen-render-audit.mjs`, which currently declares its
own local `const EPS`/`const STRONG` at lines 14-15 — those are deleted in favor of the import). One
copy, so the in-GUI surface and the report can never drift. (This decides the earlier "import vs. just
pin equal" question — the shared-constant refactor is in scope, not deferred.)

> **Footgun — the auditor's OWN default eps is `0.01`, NOT `1e-4`.** `auditRenderMatrix(expected,
> deltas, { eps })` defaults to `{ eps = 0.01 }` (`lab-render-audit.js:22`). That default is two orders
> of magnitude coarser than the render/inert boundary the report and lab use. Both the report and the
> live surface MUST **pass `eps` explicitly** (the shared `EPS = 1e-4`) on every `auditRenderMatrix`
> call — **never rely on the auditor default.** Omitting the explicit `eps` would silently reclassify
> faint renders as inert and make the in-GUI badge disagree with the report.

**Degenerate precedence (LOCKED): ⬛ degenerate WINS over the delta tier** for the single in-GUI badge.
A degenerate frame is a *mechanical failure on the ON frame* — if the ON frame is all-black or blown, the
delta classification is meaningless, so the badge shows ⬛ regardless of what the delta tier would say.
**This is a deliberate divergence from the offline report**, which side-channels degenerates as a
*separate* punch-list AND still prints the delta-based glyph in the matrix. For the single-glyph in-GUI
badge there is only one slot, so ⬛-wins is the honest read. Decided — not an open question.

> **Threshold note — do NOT conflate the two thresholds.** The sweep applies a **per-pixel** gate
> `perPixelThresh = 12` (i.e. `>12/255` summed-abs RGB) to decide whether *a pixel* changed
> (`world-engine-lab.html:7045,7066-7068`), and returns `delta = changedPixels / framePixels` (a
> *fraction of frame*). The auditor's `eps = 1e-4` / `STRONG = 5e-4` are applied to **that fraction**,
> not to per-pixel values. The live surface applies `eps`/`STRONG` to the sweep's returned `deltas`
> fraction — **never** the per-pixel `12/255` gate. They live at different layers and must not be mixed.

### Where badges show (state-driven; integrates with Asks 2/3)

Every surface just reads `state.audit` — so the audit produces the data once and all surfaces render the
same glyph.

- **Primary surface (independent of Asks 2/3): a STATUS GLYPH on each feature folder's title bar**,
  beside the enable toggle. The enable toggle is already relocated into the title bar by
  `relocateEnableToTitle()` (`world-engine-lab.html:6935-6946`); the audit badge is a small `<span>`
  appended to the same `folder.$title`, after the relocated toggle, mirroring that proven DOM injection.
  Plain DOM, **not** a lil-gui controller, so it never perturbs `syncDisplays()`, the enable controller,
  or the reparenting relevance filter (`applyArchetypeFilter()`).
  - **Badge on ALL features**, relevant or not. For an **irrelevant, force-enabled** feature (the
    "Not relevant to this world" group workflow), a **🔴F** is exactly the gate-testing signal Max wants
    — "this feature paints a world it has no business on." So the badge must render for force-enabled
    irrelevant features too, not just the relevant roster.
- **Ask 2 integration point (do NOT hard-depend):** the Ask 2 card's **State** line can read the same
  `state.audit.results[key].status` glyph automatically *if/when Ask 2 is built*. Ask 4 ships
  independently; state the integration point but do not require Ask 2 to exist.
- **Ask 3 integration point (do NOT hard-depend):** the Ask 3 roster **chips** (`● Mountains ○ Canyons`)
  can append the same glyph per chip *if/when Ask 3 is built*. Same independence rule.
- **World-folder summary line:** `Audit: N false · M dead · ✓ fresh` (or `⚠ stale`), rendered next to
  the "Audit this world" button. `N` = count of features whose status ∈ {🔴F, ⚠️F}; `M` = count of ⚠️D.
  (Degenerate count MAY be appended, e.g. `· D degenerate`, implementer's call.) When no audit has run
  yet, the summary reads e.g. `Audit: (not run)`.

### Staleness = AUTO-STALE-ON-EDIT (Max's pick) — the honesty mechanism + the main risk

This is the load-bearing honesty mechanism: **a green ✅ must never be trusted after the operator edits
anything.** Any **enable-toggle or slider change** *after* an audit sets `state.audit.fresh = false`;
the badges **dim** (e.g. reduced opacity) and the World-folder summary shows **"stale — re-audit."** A
re-run of "Audit this world" sets `fresh = true` and restores full-opacity badges.

**Preset change** is a special case of staleness: switching presets makes the stored
`state.audit.preset` no longer match `driverUI.preset`, so the surface MUST treat a preset mismatch as
stale (or clear the audit). The summary/badges must not show a glyph computed for a *different* world.

**Detection hook (LOCKED): one global `gui.onChange` per top-level GUI + an `_auditing` guard flag.**

lil-gui exposes a top-level `gui.onChange(event => …)` that fires for **every** controller change in that
GUI — its `_callOnChange` bubbles every controller's change up to the parent GUI
(`node_modules/lil-gui/dist/lil-gui.esm.js:149-155, 2259-2265`). So registering exactly **one**
`guiLeft.onChange(...)` **and one** `guiRight.onChange(...)`, each setting `state.audit.fresh = false`,
covers **all ~47 feature toggles and every slider** with no per-controller wiring. (Per-controller
`onChange` on all ~47 enables + every slider is the brute-force alternative — explicitly NOT chosen; it's
the most fragile/highest-churn path. The global delegated hook is decided.)

**The `_auditing` guard — and the self-trigger trap it solves.** The audit's OWN sweep mutates
`state[*enableKey]` 6× per feature and calls `syncDisplays()` — which is exactly the kind of controller
churn the global `onChange` fires on. Without protection the audit would, mid-run, fire `onChange`
dozens of times and instantly mark *itself* stale (a badge that's green for a split second and then
perpetually "stale"). To prevent this, set a boolean `state._auditing = true` for the duration of the
sweep and have **both** `onChange` handlers early-return while `_auditing` is set (ignore the change).
Clear `_auditing` after the sweep restores enables/clock/camera. This guard is the single load-bearing
detail of the staleness mechanism — it's why the hook is a guarded global rather than naive.

**Staling scope (LOCKED — conservative): ANY control change stales the audit.** Both global handlers
stale on *every* controller change they see (enables, feature sliders, preset, `filter to relevant`,
camera/view/quality knobs — all of them). This is the safe/honest default: a green ✅ is never trusted
after the operator touches anything. **Exempting pure view/camera/quality knobs** (controls that don't
affect the sweep, so arguably shouldn't stale it) is an explicit **DEFERRED / YAGNI refinement** — a
possible future curation, **not built in v1.** Don't add it now.

> **Chief implementation risk (on the record):** the `_auditing` guard must reliably bracket the *entire*
> sweep (set before the first enable mutation, cleared only after the final restore), or the audit will
> self-stale. This is the part most likely to ship subtly wrong (a perpetually-stale or never-stale
> badge), so it gets explicit live verification (below).

### The one genuinely test-worthy seam — extract a PURE status function

Almost all of Ask 4 is live-verified GUI glue. The **one** piece worth a unit test is the mapping from
*sweep outputs* → *per-feature glyph status*, because it encodes the tier boundaries. Extract it:

```js
// lab-render-status.js  (NEW, pure, DOM-free, importable in vitest + the in-page <script>)
export const EPS = 1e-4;
export const STRONG = 5e-4;
// statusOf(should, delta, degenerate) -> '✅' | '🔴F' | '⚠️F' | '⚠️D' | '·' | '⬛'
export function statusOf(should, delta, degenerate) { … }
```

`statusOf` is the single source of the tier logic; the in-GUI classifier calls it per feature
(`should` from `expectedMatrix`, `delta`/`degenerate` from the sweep). It returns the report's exact
glyph strings (strong-false = `🔴F`), and applies the **⬛-degenerate-wins** precedence (degenerate
short-circuits before the delta tiers). To keep the in-GUI surface and the offline report on identical
boundaries, `gen-render-audit.mjs` is refactored to import `EPS`/`STRONG` from this module (in scope —
see "Shared constants"); a test additionally asserts the in-GUI glyph for a known offline-report cell
matches the report.

**Unit test (`tests/render-status.test.js`) MUST cover every tier:**

| Case | Inputs | Expected |
|---|---|---|
| fires-as-declared | `should=true, delta=0.01, degen=null` | `✅` |
| strong false | `should=false, delta=0.001, degen=null` (> STRONG) | `🔴F` |
| faint false | `should=false, delta=2e-4, degen=null` (eps < δ ≤ STRONG) | `⚠️F` |
| dead | `should=true, delta=0, degen=null` | `⚠️D` |
| correctly inert | `should=false, delta=0, degen=null` | `·` |
| degenerate | `should=true, delta=0.5, degen="black"` | `⬛` (degenerate wins) |

Add a boundary case at exactly `delta === eps` and `delta === STRONG` to pin the `>` vs `<=` edges
(matching the auditor's `delta > eps` and the report's `v > STRONG`).

## Mechanics & risks (on the record)

- **Auto-stale self-triggering (chief risk)** — detailed above. The audit's own `applyEnableSet` churn
  must not mark the just-completed audit stale; the `_auditing` guard (set across the whole sweep,
  early-returned in both global `onChange` handlers) is the locked mechanism.
- **Line-number drift** in `world-engine-lab.html` is real — every line number here is a **HINT**. Re-`grep
  -n` each edit site (`renderDeltaSweep`, `relevantFeatureSet`, `relocateEnableToTitle`,
  `applyArchetypeFilter`, `fWorld`, the World-folder controller block ~7115, `window._lab`) before
  editing. Do **NOT** trust these numbers.
- **DOM injection in the title bar** must not collide with the Phase-1 enable-in-title relocation or
  Ask 2's per-feature ⓘ button (if built): the audit badge appends *after* the relocated enable toggle.
  Verify live.
- **Degenerate-glyph precedence (LOCKED, ⬛-wins)** is a deliberate divergence from the offline report
  (which side-channels degenerates and still prints the delta glyph) — see "Degenerate precedence" above.
- **Glyph parity with the report** is the correctness anchor: the in-GUI classification for any
  (current-preset, feature) cell MUST equal the offline report's glyph for the same cell. Verified by
  cross-check (below). Drift here would make the live surface lie relative to the canonical report.
- **Preset-mismatch staleness** — a stored audit for a different preset must read stale/cleared, never
  render glyphs for the wrong world.

## Out of scope (later / sibling asks)

- **Re-running the full 17-preset offline sweep / regenerating `lab-render-audit.md`** — Ask 4 does not
  touch the offline pipeline; it's current-preset only.
- **Auto-audit on preset change / on load** — v1 is explicitly *on demand* (Max's pick); auto-audit is a
  possible future, not built.
- **Ask 2 / Ask 3 surfaces themselves** — Ask 4 names the integration points but does not build or
  depend on them.
- **Thread B** — render-correctness residuals (Carbon/Crystal mountains, faint craters, shatter/hexTess).
  Ask 4 *surfaces* whatever Thread B leaves; it does not fix renders.

## Verification

- **Live on chrome-devtools GPU `:9223`** (NOT Playwright — Playwright is CPU; the sweep needs the GPU):
  `localhost:5173/well-dipper/world-engine-lab.html?fresh=1`. **Reload `?fresh=1` before each check.**
  Verify via `window._lab.*` helpers + `evaluate_script` **state/DOM queries** — NOT image recognition.
  - Pick a preset with a **KNOWN false-render** from the offline report's punch-list
    (`docs/FEATURES/lab-render-audit.md` — read it for a current 🔴F or ⚠️F cell on a specific preset), OR
    **force-enable a feature that doesn't belong** to the current world (toggle it on in the "Not relevant"
    group). Click **"Audit this world."**
    - The expected **per-feature glyphs** appear on the feature folders' title bars (✅ / 🔴F / ⚠️F /
      ⚠️D / `·` / ⬛), readable from `state.audit.results`.
    - The **World-folder summary** counts (`N false · M dead`) match the count of those glyph tiers.
    - **Cross-check the in-GUI classification against the offline report
      `docs/FEATURES/lab-render-audit.md` for the SAME preset — they MUST agree** cell-for-cell (the
      anchor invariant; both run the same auditor over the same sweep).
  - **`_auditing` guard works (self-trigger trap):** immediately after an audit completes (no operator
    edit in between), `state.audit.fresh === true` — i.e. the sweep's own ~6×/feature enable churn +
    `syncDisplays()` did NOT mark the just-finished audit stale via the global `onChange`.
  - **Edit a slider or toggle** → badges **dim** and the summary flips to **"stale — re-audit"**
    (`state.audit.fresh === false`). (Any control change stales, per the conservative scope.)
  - **Re-click "Audit this world"** → `fresh === true`, badges restore to full opacity.
  - **Switch preset** → the prior audit reads **stale/cleared** (no glyphs for the wrong world).
  - After any audit, confirm the sweep **restored auto-spin and camera** (planet resumes spinning;
    `state.yaw` / clock back to pre-audit) — i.e. the working state cleaned up.
  - Confirm the audit works for a **force-enabled irrelevant** feature (its 🔴F badge appears) — the
    gate-testing signal.
- **Unit test** (`tests/render-status.test.js`) for the pure `statusOf` mapping covering **all six tiers**
  + the `eps`/`STRONG` boundaries (table above). Run `npm test` (vitest) — green.
- **Existing suites stay green (additive):** `tests/render-audit.test.js` (the auditor — unchanged; the
  shared-constant refactor doesn't alter its logic, only where `gen-render-audit.mjs` sources `EPS`/`STRONG`),
  `feature-associations`, `planet-archetypes`, the `cityLightsEnabled` pin, the Stage-D GLSL drift-guard.
- **Shared-constant refactor is behavior-preserving (REQUIRED check):** after `gen-render-audit.mjs`
  imports `EPS`/`STRONG` from `lab-render-status.js` (replacing its local `const`s at lines 14-15),
  **re-run `node scripts/gen-render-audit.mjs` and confirm `docs/FEATURES/lab-render-audit.md` is
  byte-identical** to the committed version (e.g. `git diff --exit-code docs/FEATURES/lab-render-audit.md`
  → no diff). A byte-identical report proves the refactor changed nothing.
- **Commit explicit paths only** — `world-engine-lab.html`, `lab-render-status.js`,
  `tests/render-status.test.js`, and `scripts/gen-render-audit.mjs` (the shared-constant refactor).
  **Never `git add -A`** (shared-tree litter: warp WIP, loose `.png`/`.webm`/`.html`, and a 0-byte
  `HEAD` file).
