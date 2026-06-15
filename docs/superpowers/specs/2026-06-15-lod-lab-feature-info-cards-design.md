# Design — Planet-LOD lab per-feature info cards (Ask 2 of the menu/info overhaul)

**Date:** 2026-06-15
**Author:** working-Claude (brainstormed with Max)
**Status:** spec — pending Max review → implementation plan
**Scope:** `planet-lod-lab.html` (GUI) + new `scripts/gen-feature-cards.mjs` + a generated data
module + a `package.json` script. **No shader/core changes** (`planet-lod-lab-core.js` untouched),
so this cannot regress any planet rendering.
**Campaign frame:** this is lab *tooling*, not a planet feature — the campaign per-feature UAT loop
does NOT govern. It's a UI/data-plumbing addition, verified live on `:9223`. Single-system
(GUI + a build script) → `dev-collab-scope` is NOT invoked (same call as the Phase-1 declutter).

## Why

The menu overhaul is Max's goal #3; it makes the per-feature quality pass *legible*. Phase 1
(declutter, `fc30eb1`) built a clean frame. This is **Ask 2**: surface *what each feature is / does*
right next to its controls, so that while tuning a feature Max can read the reference it should match
(what it looks like, real-world analogues, what physically drives it, where it should render) without
leaving the lab. In a brainstorm (2026-06-15) Max chose a **rich reference card**, **derived from the
prose doc at build time**, shown **inline behind an ⓘ toggle** in each feature folder.

## What — the design

### Data flow (derived; single source of truth)

```
planet-visual-features.md  ──gen script──▶  planet-feature-cards.generated.js  ──import──▶  planet-lod-lab.html
   (SOURCE OF TRUTH)        npm run            { featureKey: { name, variants,      inline ⓘ card
                            gen-feature-cards     examples, status, fNum } }
```

The generated module holds **only the prose** that lives nowhere in code today: feature **name**,
**variants** (the "·"-separated morphology list), real-world **examples**, the **status tag**
(`current`/`partial`/`aspirational`), and the **F-number**. Everything else on the card is read from
code/runtime that is *already* authoritative and never copied:

- **processes + drivers** ← `planet-feature-associations.js` (`processes`, derived `dependsOn.drivers`)
  and `planet-drivers.js` (`PROCESSES[Pn].label`, driver keys).
- **rendersOn** ← `planet-feature-associations.js`.
- **live state** ← runtime `state.*` enable flags + the existing `relevantFeatureSet()`.

So prose has exactly one home (the `.md`); structured data is never duplicated. This matches the
project's derive-don't-author culture (`modifies`, `dependsOn.drivers` are already derived).

### Card content & sources (per line)

| Line | Example | Source |
|---|---|---|
| Title + status | `Mountains / ranges (F1)  [aspirational]` | generated (`.md`) |
| What-it-is / variants | `Tectonic fold belt · volcanic shield · ridged crestlines` | generated (`.md` variants col) |
| Like | `Himalaya · Olympus Mons · Tharsis` | generated (`.md` examples col) |
| Driven | `Tectonic deformation · Orogeny · Volcanism → rockyCrust, tidalHeating, massGravity` | `PROCESSES[Pn].label` + derived driver **keys** (compact; not the paragraph-length driver labels) |
| Renders | `Rocky, Ocean, Venus, Eyeball, Mars, Lava` | manifest `rendersOn` |
| State | `● enabled · relevant to THIS world` / `○ off · not relevant` | runtime `state.*` + `relevantFeatureSet()` |

The **Driven** line shows process labels followed by the de-duplicated set of derived driver **keys**
(short names like `rockyCrust`), not the full `DRIVERS[].label` strings (those are sentence-length and
would bury the card). The **State** line is the only line that changes as Max works; it re-renders on
enable-toggle and preset change.

### The generator — `scripts/gen-feature-cards.mjs`

1. Read `docs/FEATURES/planet-visual-features.md`; parse the L2 feature pipe-table rows
   (`| **F1** | name | processes | variants | examples | types | status |`). Validate each row's
   column count/shape; a malformed row is a **loud warning** (named line), not a silent skip.
2. Build `{ fNum: { name, variants, examples, status } }`. (Processes/types columns are ignored — code
   is authoritative for those.)
3. Read the feature registry (`planet-archetypes.js` `FEATURES`); for each feature, extract its F# from
   the label's `(F#)` regex; join to the parsed prose by F#.
4. Emit `planet-feature-cards.generated.js` keyed by **feature key** (the same keys the lab uses):
   `export const FEATURE_CARDS = { mountains: { fNum:1, name:'…', variants:'…', examples:'…', status:'aspirational' }, … }`.
   Include a generated-file header banner ("AUTO-GENERATED — edit planet-visual-features.md, run
   `npm run gen-feature-cards`").
5. **Coverage reporting:** any registry feature whose F# has no matching `.md` row → warn by name and
   omit its prose entry (the card falls back to structured-only at render time). Exit non-zero only on a
   parser/structural error, not on a missing-row warning (aspirational features legitimately lack rows).

`package.json`: add `"gen-feature-cards": "node scripts/gen-feature-cards.mjs"`.

### Drift guard

Extend the existing doc-rot mechanism so a stale generated file is caught: regenerate to a temp buffer
and compare against the committed `planet-feature-cards.generated.js`; mismatch ⇒ doc-rot failure with
the regen command in the message. Wire it where `npm run doc-rot` already runs (and thus the pre-push
hook). This makes "derived" enforceable rather than aspirational. (Exact wiring — a check inside the
doc-rot script vs. a tiny dedicated check it calls — is an implementation detail for the plan.)

### GUI rendering (inline; mirrors the declutter DOM pattern)

- Each **feature folder** gets an **ⓘ toggle button** in its title bar, beside the enable checkbox,
  using the same title-bar DOM injection already proven by `relocateEnableToTitle()` in Phase 1.
- Toggling ⓘ shows/hides a **read-only card block** injected as the folder's **first child**, above its
  sliders. The block is plain DOM (a styled `<div>`), **not** lil-gui controllers — so it never
  perturbs `syncDisplays()`, the enable controller, or the reparenting relevance filter.
- **Collapsed by default** (ⓘ off) so the menu stays lean; per-feature ⓘ state is the only new UI state.
- Works identically for relevant features and for force-enabled irrelevant ones (in the
  "Not relevant to this world" group), so the gate-testing workflow keeps its card.
- The card renderer is one function: `buildFeatureCard(featureKey) → HTMLElement`, pulling prose from
  `FEATURE_CARDS`, structured data from the manifest/drivers, and state at render time. A feature with
  no prose entry renders the structured-only subset (Driven / Renders / State) with no name/variants/
  examples block.

## Mechanics & risks (on the record)

- **`.md` table-format drift** is the main risk: a column reorder or a row that breaks the pipe shape
  would feed the parser garbage. Mitigation: the parser validates row shape and warns by line; the
  drift guard catches a stale generated file; a unit test pins parse-of-a-known-row.
- **F#→key join gaps:** a registry feature could carry an F# the `.md` doesn't list (or vice-versa).
  Handled by the coverage report + structured-only fallback — no crash.
- **Line-number drift** in `planet-lod-lab.html` is real; re-`grep -n` every edit site (do NOT trust
  line numbers from this spec or the prior plan).
- **DOM injection in the title bar** must not collide with the Phase-1 enable-in-title relocation;
  the ⓘ button is appended after the enable controller, verified live.

## Out of scope (later asks)

- Ask 3 — archetype info view (what feature set a world should exhibit + its state).
- Ask 4 — live render-audit surfacing (which features actually fire vs. dead/false-render).
- Thread B — render-correctness residuals (Carbon/Crystal mountains, faint craters, shatter/hexTess).

## Verification

- **Live on chrome-devtools GPU `:9223`** (NOT Playwright):
  `localhost:5173/well-dipper/planet-lod-lab.html?fresh=1`.
  - ⓘ on a feature shows the correct card (title/variants/examples for a prose-backed feature; e.g.
    Mountains → Olympus Mons, Driven Tectonic/Orogeny/Volcanism, Renders Rocky…Lava).
  - Card collapsed by default; toggling ⓘ shows/hides; multiple cards can be open independently.
  - **State line** tracks reality: enabling the feature flips `○ off`→`● enabled`; switching presets
    flips `relevant`↔`not relevant` per `relevantFeatureSet()`.
  - Force-enabling an irrelevant feature (in the Not-relevant group) still shows its card.
  - A structured-only feature (no `.md` row, if any) renders Driven/Renders/State with no prose block.
- **Generator:** `npm run gen-feature-cards` runs clean; coverage report lists any unmatched features;
  re-running is idempotent (no diff). A unit test parses a known `.md` row → expected object, and
  asserts the F#→key join for a sample feature (e.g. `mountains` → F1).
- **Drift guard:** touching the `.md` without regenerating fails `npm run doc-rot`.
- **Existing suites** (`feature-associations`, `planet-archetypes`, the `cityLightsEnabled` pin #16)
  stay green — this is additive.
- **Commit explicit paths only** (`planet-lod-lab.html`, `scripts/gen-feature-cards.mjs`,
  `planet-feature-cards.generated.js`, `package.json`, doc-rot wiring) — never `git add -A`
  (shared-tree litter: warp WIP + loose .png/.webm/.html).
