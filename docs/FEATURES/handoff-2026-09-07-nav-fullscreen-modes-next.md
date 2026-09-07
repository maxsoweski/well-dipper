# Handoff — ▶ **MAX WANTS BOTH NAV DESIGNS AS MODES. BUILDING THEM IS THE WHOLE NEXT JOB.**

> ⚠ **IN-REPO ON PURPOSE.** The handoff skill says "temporary directory"; this project's standing
> convention overrides it, for the reason its predecessors give: `/tmp` does not survive a WSL restart.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master).
> ✅ Pushed and verified by `git ls-remote` at **`998669c`**. ⚠ `b7c8155` and `68ab988` are local and
> **unpushed** — ⛔ ASK before pushing.
> ⛔ Hundreds of untracked stray PNGs are normal — **never `git add -A`**.

---

## 0. ⛔⛔ THE INVOCATION THAT IS WRITTEN WRONG EVERYWHERE, INCLUDING IN THE LAST TWO HANDOFFS

There are **THREE** suites and the standing pair misses the one where every NavComputer test lives.

```
npx vitest run --dir tests       --root /home/ax/projects/well-dipper   # 20 failed / 8 files
npx vitest run --dir src/cockpit --root /home/ax/projects/well-dipper   # 698 passed
npx vitest run --dir src/ui      --root /home/ax/projects/well-dipper   # 295 passed  ⭐ THE MISSING ONE
```

⭐ `src/ui/` was in neither stated invocation for two whole sessions. It caught a real break during
AC-4 that the other two could not see. **Run all three, every time.**

The eight expected failures in `tests/`, by name — anything else is yours:
`agent-camera-api`, `driver-pack-giantdeck`, `gas-body-lab-material`, `lab-shader-perframe-seam`,
`moon-condition-contract`, `moon-rng-stream-identity`, `port-condition-contract`,
`relief-octave-lod-ramp`. ⚠ Two worldengine files flake — re-run a file alone before believing a drift.

---

## 1. WHERE THIS STANDS IN ONE SCREEN

| | | |
|---|---|---|
| AC-1 cockpit at the game's resolution | ✅ **closed, live-verified** | `5701622` `04f24b0` |
| AC-4 nav computer operable in the panel | ✅ **closed, whole walk driven live** | `b5947f5` |
| AC-2/3/5/6/7/8 | ✅ closed earlier | |
| AC-9 the whole-game read | 🔵 **Max's eye, still open** | |
| ▶ **the full-screen nav at 240p** | ▶ **DESIGNED AND RULED ON — BUILD IS NEXT** | `b7c8155` |

**The old contract (`chrome-and-ui-at-240p`) is effectively finished.** What is next is a NEW
workstream that Max opened by reversing the order of work, and it has not been scoped.

---

## 2. ⭐⭐ MAX'S RULINGS, 2026-09-06 AND 2026-09-07 — ALL FOUR

### (a) THE ORDER OF WORK IS REVERSED. THIS IS THE ONE THAT REFRAMES EVERYTHING.
> *"we're doing this the wrong way, though...we need to begin by making these nav computer screens
> work in fullscreen first (the N menu) then figure out how to represent that in the diegetic
> screens. What you've done here is fine for now."*

**THE FULL-SCREEN NAV IS THE SOURCE. THE COCKPIT PANEL IS A REPRESENTATION OF IT.** Two sessions were
spent making the 43-row panel legible — he accepts that as *fine for now* and it must not be
reverted, but it is a derivative of a design that only ever existed at desktop resolution.

### (b) HE WANTS BOTH DESIGNS, AS MODES.
> *"I love both 1 and 2 for both; I want all of these modes!"*

⚠ **"for both" IS AMBIGUOUS AND WAS NOT RESOLVED.** It reads either as *both surfaces* (full-screen
and diegetic) or as *both levels* (the prism and system views the asks named). ⭐ The reading that
satisfies every interpretation, and the one to build unless he says otherwise: **both designs exist as
switchable view modes on the FULL-SCREEN nav first** (his ruling (a)), at the levels where each makes
sense; the diegetic representation follows from whatever lands. **Confirm this with him in one line
before building — it is one question and it changes the shape.**

### (c) THE THREE FLAT 2D LEVELS STAY.
> *"We keep both for now"* — answering whether galaxy/sector/region earn a place given REGION is 256
> identical tiles. ⛔ **Do not re-raise it** (`feedback_pass-for-now-not-picky`). It reopens only if
> he raises it.

### (d) THE RESOLUTION LIST IS THREE MODES. **ALREADY LANDED** (`68ab988`).
> *"going forward for all these menus and main gameplay I only need 240, 288 and 360 as comparison
> options"*

`RENDER_LINE_OPTIONS = [240, 288, 360]` (was seven). A stored 480 snaps to 360, a stored 144 to 240.
⚠ **He did not answer the question this replaced** — "should type scale with the buffer, or should
raising the resolution keep shrinking it?" That is still open and now much narrower.

---

## 3. ▶ THE LAB HE RULED ON, AND IT IS THE SPEC

`nav-240p-lab.html` at the repo root → **`http://localhost:5175/well-dipper/nav-240p-lab.html`**
(vite is already running on :5175 serving lane A — ⛔ **do not start a server**).

Keys: `1 2 3` design · `← →` level · `R` line count · `Z` prism zoom · `S` next system · `L` design
2's list mode · `;` face 5x5↔5x7 · `X` sabotage the guard · `H` hide the legend.

It draws at **exactly 427x240** then upscales with `image-rendering: pixelated`, and everything in it
is real: `drawPixelText`, the GPU `NavGalaxyRenderer`, all 775 `GalacticSectors`, 15,606 HYG catalog
stars, `resolveArrivalSystem` (the same call `NavComputer.js:2458` makes). ⭐ Its `assertFits` guard
was **proved by sabotage** and caught four real defects before that.

**DESIGN 1 — "THE 71x40"** · a 43-column map beside a 26-column ranked star list. 27 stars with
distances readable at once, against today's one-at-a-time hover. Judges: use 30, build 31, era 26.

**DESIGN 2 — "TWO BARS AND A SKY"** · the map bleeds to all four edges; two 8-row bars and one status
line carry every word. Judges: era 30, build 30, use 24.

**DESIGN 3 — killed by all three judges** for deriving the fullscreen from the 52x43 panel, the exact
inverse of ruling (a). ⛔ Do not resurrect it. Its central mechanism also does not exist (`__navFit`
truncates from the right; it cannot turn `[ WARP ]` into `WRP`).

---

## 4. ⭐ WHAT THE MEASUREMENT FOUND, AND SOME OF IT OUTRANKS THE DESIGNS

All measured on a real headless `NavComputer` at 427x240 with the real catalog loaded.

1. **THE TEXT BUDGET IS 71 x 40 AT UNIT 1.** `PixelText`'s shipped face is 5x5 **advance 6**
   (`PixelText.js:91`). 427/6 = 71 columns; 240/6 = 40 rows. A terminal, not a cramped screen.
   ⛔ Do not design as though 240p were tight.
2. ⭐⭐ **GALAXY, SECTOR AND REGION EACH DRAW EXACTLY TEN STRINGS AND ALL TEN ARE CHROME.** Five tab
   labels, a redundant top-right level name, the CURRENT SYSTEM block, the autopilot toggle. **Not one
   string describes the map the player is being asked to click.** The only text serving the decision
   is a hovered tile's `(x, z)` in kpc, which cannot tell you what is in it.
3. **REGION IS 256 IDENTICAL GREY TILES.** The density model is flat at 0.67 kpc, so a ranked list of
   them all reads `158K`. Max's own words in the feature doc — *"we don't have a working model for
   that"* — are now a picture. He has ruled the level stays anyway (2c).
4. **PRISM IS THE ONLY DENSE LEVEL AND ITS DENSITY IS A CLIFF.** 23 markers on canvas at the 1.5 pc
   default; **795 markers and 139 labels at the 10.34 pc ceiling, of which 100 (72%) draw faded**
   because `placeLabels` runs out of its five slots (`labelPlacement.js:57-58`).
5. ⛔ **THE PRISM HAS NO SCREEN-BOUNDS CULL.** The only test is the Y-slab window
   (`NavComputer.js:2016-2018`). At the default zoom **143 markers are projected and 120 of them
   (84%) are off canvas**, each still costing a dashed line, a plane dot, a glyph and two hover tests.
6. **THE NAV OPENS ON SYSTEM, NOT PRISM.** `openToCurrentSystem` ends `this._levelIndex = 4`
   (`NavComputer.js:609`). The constructor's `_levelIndex = 3` and `docs/FEATURES/nav-computer.md`'s
   "Default level on open: PRISM" are **both stale**.
7. ⛔ **AT 240p EVERY `navLayout` FUNCTION IS STILL ON THE SATURATED SIDE** (the threshold is h ≥ 160).
   `navTabHeight(240) = 32`, `navChromeReserve(240) = 50`, `navMapSize(427,240) = 160`. So a 240p
   full-screen nav would inherit **desktop** chrome verbatim: the tab strip alone eats 13% of the rows
   and the 2D map is a 160x160 square — 25% of the buffer — inside a 427-wide frame. **This is the
   single biggest thing to fix and it is one file.**
8. **THE OVERLAY IS 3.58x THE WORLD'S LINES, NOT 8x.** `canvas.width = rect.width` with **no**
   devicePixelRatio multiply (`NavComputer._resizeCanvas:612-618`) over a
   `calc(100vw-40px) x calc(100vh-40px)` box = 1560x860 on Max's 1600x900. ⚠ An earlier session said
   8x; that was wrong and it does not reproduce from this code path.
9. **THE SEARCH FIELD IS DOM-ONLY** (`.nav-search-overlay`, a 320px `<input>`, `NavComputer.js:667`)
   and has therefore **never existed on the cockpit panel**.
10. **168 LINES ARE DEAD** — `_renderScaleStars`, `_getTileImage`, `_drawPlayerArrow` have zero call
    sites, and `_getTileImage` would throw (`_tileImageCache` is never assigned).
11. **Turning the resolution UP makes the type SMALLER** (magnification drops). Real, and it is
    ruling (d)'s unanswered half.

---

## 5. ⭐ WHAT LANDED THIS SESSION, AND THE ONE FINDING WORTH RE-READING

`5701622` AC-1 · `04f24b0` AC-1 verified + guard width · `b5947f5` AC-4 · `998669c` NOW (**pushed**)
· `b7c8155` the design lab · `68ab988` the resolution narrowing (**both unpushed**).

⭐⭐ **THE VACUOUS TEST, BECAUSE THE PATTERN WILL RECUR.** `PhosphorScreen.test.js` asserted
`lines === 7` "at every shipped resolution" and sampled 240/480/720 — which are 43, 86 and 129 rows,
**exactly 1x, 2x and 3x `gridRows()`**. On an exact multiple the division has no remainder and seven
is all you get, so the sample contained no other kind of number and the claim was really *"at every
multiple of the grid"*. 288 and 360 are not multiples:

    upper  43 → 7 lines    51 → 8     64 → 10
    lower  46 → 7          55 → 9     69 → 11

**Two of the three modes Max just chose hand the panel more rows than its layout is authored for.**
Not a defect — painters read `lines`, INFO draws its seven, the rest is unused space — but the panel
is *not* the identical picture at 288 and 360. The test is now split: exact line counts pinned per
mode, and the invariant that does hold universally (the type SHAPE never moves) stated separately.

⭐ **The general form: ask what would make a green test fail. If the answer is "no input in its
sample", it is pinning nothing.**

---

## 6. ⛔ TRAPS, CARRIED AND NEW

1. ⭐⭐ **`_bare` IS NOT THE PANEL-VS-OVERLAY DISCRIMINATOR.** It is `chromeless && level === 'system'`,
   and `NavPanel.js:222` writes `chromeless = false` **unconditionally every paint** under Max's
   2026-08-01 ruling, pinned by two tests. So on the panel `_bare` is permanently FALSE at every
   level. Keying anything off it is a no-op **that looks exactly like a wiring failure**.
   `dimSurface`'s own comment (`NavComputer.js:205-216`) records that mistake being made once and
   corrected. The per-instance axis to copy is `dimSurface`; the type driver is `pixelType`.
2. ⛔ **A FIELD COMES OFF THE GLASS, NOT OUT OF THE PIPELINE** — Max, 2026-09-08. *"don't get rid of
   any code that allows you to display what we want to display."* Say **drawn-or-not**, never
   **producible-or-not**. If an edit makes a string unproducible it is the wrong edit.
3. ⛔ **`main.js` CARRIES ~700 LINE-ANCHORED CITATIONS. EDIT WITHIN EXISTING LINES, NEVER INSERT.**
   `wc -l` before and after must be equal — it is 15161.
4. ⛔ **ONE GLYPH SET.** `PixelText.js` has a 5x5 and a 5x7 face and `setPixelFace` switches them.
   A second face goes THERE or nowhere.
5. ⛔ **A missing glyph blanks the panel.** `drawPixelText` defaults `onMissing:'throw'` and
   `PanelHost` catches a painter throw **once**, then leaves the screen frozen. Fixed literals may
   throw; anything from a snapshot or a procedural body name must pass `'tofu'`.
6. **`git push` on WD fails in-sandbox above ~10MB** — TLS error, then a lying "Everything
   up-to-date". Disable the sandbox and **verify with `git ls-remote`**.
7. **The cockpit nav panel's graphics are still absolute-pixel** — prism star radii 4.5/3.5 px, the
   planet discs, and 12-14 px body hit radii, on a 52-texel panel. Logged, deliberately untouched,
   and **the first thing Max will react to**. It should probably be answered by the fullscreen design
   rather than patched separately.

---

## 7. WORKING WITH MAX — all re-confirmed this session

- ⭐⭐ **"LET ME SEE WHAT YOUR REC LOOKS LIKE" MEANS RENDER IT.** He ruled on three nav designs in one
  message because they were on a screen. He will not rule on prose and he is right not to.
- ⭐ **HE ANSWERS TERSELY AND IN ORDER — NUMBER THE ASKS.** *"1. I love both... 2. We keep both for
  now 3. going forward..."*
- ⛔ **HE DOES NOT USE THE BROWSER CONSOLE.** Any A/B he runs is a **keypress**.
- ⛔ **NO AFFIRMATIONS.** He said *"Excellent work, very exciting"* — do not reciprocate, do not thank,
  just engage with the substance.
- **He commits without being asked; he is asked before every `git push`.**
- To reach HELM live: splash → HELM → `Enter` past the title → `M` (mode swap) → `F` (hands off, which
  is what gives a cursor for panel interaction). `window._lab.spawnProceduralSystem(seed)` for a
  system. ⛔ **Never Sol** for anything rendering-related.

---

## 8. FIRST FIVE MINUTES

1. Read `docs/NOW.md` top entry, then this file. Then **open the lab** and press `1` and `2` — the
   whole next job is those two pictures.
2. Capture all THREE baselines (§0) **before touching anything**.
3. **Ask Max the one question in §2(b)** — both designs as modes on the full-screen nav first, with
   the diegetic representation following? One line, numbered.
4. Then **scope it**: this is a new multi-system workstream past the rough-pitch stage, so
   `dev-collab-scope` (`intent.md` + `contract.json`) before any code — not a continuation of
   `chrome-and-ui-at-240p`, which is finished.
5. ⭐ The cheapest real win, and it is independent of which design wins: **§4.7** — `navLayout`'s
   saturation means a 240p overlay inherits desktop chrome. And **§4.5**, the missing prism cull, is a
   pure performance fix with no design content at all.
