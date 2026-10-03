# Handoff — nav: naming + prism segments, Phases 0-3 done → batch 2 next (2026-10-03)

Lane A, branch `feature/world-engine-production-L1` (`~/projects/well-dipper`, NOT master), **pushed through `68eba12`**
(ls-remote verified). Serves the 35% SCREENSAVER MVP (the nav is the pilot's instrument for choosing where the ship goes).
Max said: stay in-session style — **build with workflows, use Astra as checker / second opinion / tester**, and he has given
**blanket push permission** for this project (memory `feedback_well-dipper-blanket-push.md`).

## 1. Where things are — read these, don't re-derive

| What | Path |
|---|---|
| The plan (draft 4, Max ruled "go with recs") | `docs/FEATURES/naming-prism-segments-PLAN-2026-10-02.md` |
| Contract + intent (15 ACs; AC-0..AC-8 VERIFIED_PENDING_MAX; AC-14 generator fixes; AC-9..13 open) | `docs/WORKSTREAMS/naming-prism-segments-2026-10-02/{intent.md,contract.json}` |
| Phase 0 ground truth (what cost the 3 s freeze) | `docs/WORKSTREAMS/naming-prism-segments-2026-10-02/PHASE0.md` |
| Max's 2026-10-03 review, verbatim, + rulings + 2 logged defects | `docs/WORKSTREAMS/naming-prism-segments-2026-10-02/UAT-review-2026-10-03.md` |
| The 09-30 UAT walk (origin of everything) | `docs/WORKSTREAMS/nav-restorations-2026-09-20/UAT-walk-2026-09-30.md` + `UAT-walk-2026-10-02-small-fixes.md` |
| Review page (Max's verdicts in db `verdicts/*`) | https://claude.ai/artifact/1ptVwjQ4oX5jFeUsShNerY — source `/tmp/claude-1000/-home-ax/e3bfb779-bd19-48ee-9c65-af3fc876407b/scratchpad/nav-review/` (ephemeral) |
| Astra-made sprite icon set for review pages (4th-gen style) | `docs/FEATURES/assets/nav-icons/` (README inside) |
| Astra job records (every review this session) | `.astra/jobs/20261002-*`, `20261003-*` |

Built this session (all pushed): five walk fixes A–E (`d918f66` `43301cd` `a2d3dd2` `320e6d2`); GPS line from the ship's
real position to planets/moons/star in all three looks (`d85ab10` `5ac7ce0`); Phase 1 grid + star identity (`5b9ba76`..`c0b2217`,
`src/generation/GalaxyGrid.js`, `star.key`); Phase 2 one cell = one place (`9284e8e`..`e4eed3c`, `src/ui/navGrid.js`,
`src/ui/navDrill.js`); Phase 3 sliced slab loader + segment bar + neighbour prism outlines (`1bc14c2`..`68eba12`,
`src/ui/prismLoader.js`). Option D (2 kpc sectors → 125 pc regions → 7.8125 pc prisms, 100 pc slabs; Sol = N10) is CONFIRMED.

## 2. Next: batch 2 — Max agreed (2026-10-03)

Order Max agreed: **batch 2 → ONE review page covering Phase 3 + batch 2** → sprite pipeline → System screen redesign →
AC-14 generator fixes → Phase 4 vocabulary (Max review page) → Phase 5 names → Phase 6 where-am-I label → nav reference
manual → cockpit (diegetic) screens. Batch 2 = Max's notes in `UAT-review-2026-10-03.md` (quote them, they are the spec):
- **CURRENT vs TARGET colour system**, consistent on every screen, text and icon (g-here, s-foreign, s-sky, s-search). "YOU"
  and the "SHIP" marker → **CURRENT** in every look and mode (FLIGHT, ORRERY, tour). Clickable CURRENT / TARGET indicators
  top-right that highlight the matching cell at whatever level you're on (g-here). Also the leftovers Phase 3 deferred: the
  selected star drawn in KEY, YOU ink on the level tabs.
- **Grid polish:** dotted midline leaders from edge labels to the grid (g-galaxy); hover label never covers the highlighted
  cell + its parenthetical numbers in the highlight colour (g-sector); screen-door / square artifacts in the grid background
  (g-sector); grid fills the window exactly, no drawn area outside it (g-drag); window-only view while dragging, cell
  boundaries visible, labels follow (g-neighbours — note: Max REJECTED clickable neighbour blocks); label the star-count +
  density-bar column in the rail table.
- **"SHIP <distance>" label** means planet-distance in one place, target-distance in another — make it one meaning (moon
  review, `.astra/jobs/20261003-002012-moon-view-gameplay-review`).
- **Defects:** N stuck after leaving HELM with the cockpit nav zoomed (`_cockpitNavZoomed()` stays true); renderer crash
  once after a HELM↔ORRERY round trip (undetermined — investigate, dumps in `C:\temp\chrome-mcp-filmstrip\Crashpad\reports\`);
  Max's s-goto question — confirm hiding the ship in ORRERY costs no serious resources; design 2 legend's right end clipped.
- Not in batch 2 (parked, logged): HELM burns stall when starting next to a body; autopilot picks stars far off the plane
  (flight lane).

Then build the **combined review page** with the `max-feedback-forms` skill (WHERE / TRY / EXPECT, a distinct live capture
per item, Astra icons, autosaved verdicts, park Max in the live game first).

## 3. Traps learned this session

- **One workflow at a time when it edits `src`:** vite HMR reloads the debug page, so live measurement and building can't overlap.
- **`designs.js` is extracted from `nav-240p-lab.html`** — edit the lab, run `node scripts/extract-nav-designs.mjs`, `--check`.
  **`NavComputer.js` keeps a fixed line count** (fold statements; mid-line comments must be closed `/* */`).
- Vitest: `--exclude '**/.claude/**' --exclude '**/node_modules/**' --testTimeout=60000`; `navPicking.test.js` alone. A
  long suite run looks idle (no token growth) while workers sit at 100% CPU — check `ps` sandbox-off before calling it hung.
- **Astra review jobs:** `astra_job.py new --type review`, sandbox OFF, background; exit 4 with `report.md` = success
  (read-only sandbox); on a timed-out round with no report, `iterate` on the same thread asking for the report now.
  **Astra 2D sheets** (icons): brief template = `well-dipper-trunk/.astra/jobs/20261002-224321-loops-icons/brief.md`.
- Chrome-devtools MCP can drop mid-session: Max reconnects with `/mcp`.
- The visual-QA stop hook blocks when a workflow edited visual files; verification belongs to the workflow's live step.
- Synthetic Tab from GALAXY needs a sector context; Max may be driving the game himself — read state before assuming it.
- Phase 3 headless harness uses a `syncView` flag production never sets.

## 4. Parked direction from Max (do not start without his go)

- Menus = **4th-gen (SNES) aesthetic**, main game 5th-gen (memory `well-dipper-aesthetic-generations.md`).
- **Sprite pipeline with Astra:** star types incl. black holes, planet types (terrestrial, gas, ringed — rings sized by
  formula), belts, moon markers; **SNES-style buttons** (possibly animated) — test full-Astra vs Astra shape + code-drawn labels.
- **System screen redesign:** design 1 ladder full width, list below, bigger selected-body panel with its sprite; design 2
  numbered markers + numbered list right + selected below; label placement with leader lines; belts depicted.
- **Nav reference manual** once Max accepts the looks. **Cockpit screens** after the overlay (Apple-watch-at-arm's-length
  legibility, mosaic-filtered LOD renders, visor HUD, screens that extend toward you).

## 5. Suggested skills

- **`wd-browser-up`** — debug Chrome on 9223 + `:5175` (Max starts the server in his own WSL window).
- **`workflow-authoring`** — before each batch's workflow (lanes on disjoint files → integrate → Astra → live → fixup).
- **`astra`** — reviews (type review) and the coming sprite sheets (type 2d).
- **`max-feedback-forms`** — the combined Phase 3 + batch 2 review page.
- **`verify-workstream`** workflow if a contract-level verify run is wanted; **`handoff`** at the next seam.
