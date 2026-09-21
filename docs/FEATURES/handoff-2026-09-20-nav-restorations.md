# Handoff — ▶ **THE NINE RESTORATIONS MAX APPROVED ARE BUILT AND COMMITTED ON LANE A; THE VERIFY VERDICT AND EVERY LIVE CHECK ARE STILL OPEN BECAUSE THE DEV SERVER WAS DOWN ALL SESSION.**

> ⭐⭐ **HIS ONLY WORDS THIS SESSION (2026-09-20):** *"Go with your recs on restorations"* — on the eleven restorations of the old-vs-new page (items 13-23). The recommendations, now his rulings: 13 hover-inspect YES; 14 prism depth cues YES; 15 names + height numbers YES; 16 planet detail with moons YES; 17 ship + trajectory YES; 18 wheel zoom at SYSTEM design 2 only; 19 body names YES; 20 belts + star line YES, wide-binary list PARKED; 21 one zoom readout YES (radius in ly); 22 autopilot PARKED; 23 design-2 handles YES. He did NOT answer asks 1 and 3 of the morning's report (the two 09-18 decisions; the review's leftover defects) — carried below.

> ⚠ **IN-REPO ON PURPOSE.** Branch `feature/world-engine-production-L1` (lane A, NOT master). **PUSHED through `0100fd5` on 2026-09-21** (Max: *"3 yes"*; ls-remote verified; anything after it is unpushed until he says so again). The twelve that went: `d125f1c` scope · `c97f6bf` wave 1a · `f788d83` wave 1b · `915ef60` wave 2a · `bb74874` wave 2b · `a429c0d` the V fixup · `ab610fa` the contract's vitest line · `012d241` NOW + this note · `0da6b15` the verdict + AC-2's rewrite · `fd95a5f` docs · `6f8f6d3` the lattice spacing test · (+ this note's last edit). Ask once before pushing; "push as needed" does NOT carry over. ⛔ Hundreds of untracked PNGs/JPEGs/WEBMs at the repo root are normal — never `git add -A`. ⛔ `git push` in the sandbox fails above ~10 MB and then LIES "up-to-date" — push sandbox-off and verify with `git ls-remote`.

---

## 0. THE INVOCATIONS, AND THE BASELINE THEY MUST REPRODUCE

```
npx vitest run --dir src/ui      --root /home/ax/projects/well-dipper --exclude '**/.claude/**' --exclude '**/node_modules/**' --testTimeout=60000   # 922 passed / 44 files (~5 min; timeout: 600000)
npx vitest run --dir src/cockpit --root /home/ax/projects/well-dipper --exclude '**/.claude/**' --exclude '**/node_modules/**'                       # 698 passed
npx vitest run --dir tests       --root /home/ax/projects/well-dipper --exclude '**/.claude/**' --exclude '**/node_modules/**'                       # 20 failed / 8 files (EXPECTED, unrelated)
node scripts/extract-nav-designs.mjs --check                                                                                                          # green
wc -l src/ui/NavComputer.js src/main.js                                                                                                               # 4711 / 15161, BOTH FROZEN
```

⛔ `--testTimeout=60000` is NEW this session and not optional for the whole `src/ui` run: at vitest's 5 s default it shows ~17 contention timeouts (`navPicking` alone takes ~4 min; `navViewModes` / `navSearch` cases sit near the budget). They are green alone. Six of them pre-date this workstream. Run ONE file per invocation when you can; NEVER overlap two vitest runs (a verify workflow runs its own).

---

## 1. WHERE THIS STANDS — read these, don't re-derive them

| artifact | what it holds |
|---|---|
| **Old Nav vs New Nav** — https://claude.ai/artifact/F8Ut2bLQbK4hh5V8TJ27UY · `docs/FEATURES/nav-menu-map-old-vs-new.html` | THE SPEC IN MAX'S LANGUAGE. Items 13-23 are what this workstream built. It has NO "after the restorations" section yet — the captures need the server (§2 step 2). |
| `docs/WORKSTREAMS/nav-restorations-2026-09-20/{intent.md,contract.json,SEAM.md}` | Max's rulings in his words; 11 ACs (AC-1..10 = items 13,14,15,16,17,18,19,20,21,23; AC-11 = his UAT) each with a `progress` note saying what was built, by which lane, every measured DEPARTURE from the AC's wording, and what is still open; `followOns` (five rows); **SEAM.md = the fixed field names and owners** (`S.hover`, `D.ship`, `S.sysCam.zoom`, `S.sysView`/`S.detailPlanet`, `S.zoomGaugeRect`, `S.yGaugeRect` in design 2, `S.hoverCalloutRect`, `S.railBodies`, belt `isKuiper`, moon hits in `S.bodyHits`). |
| `docs/WORKSTREAMS/nav-restorations-2026-09-20/verdict.json` | verify-workstream FULL at `ab610fa` (run `wf_80592cf3-36a`, 43 agents, 3.8 M tokens): **unit 6/7 PASS by consensus** (AC-1/3/7/8/9/10 — AC-7 2/3, the rest 3/3); **AC-2 INSUFFICIENT 0/3** because the observable still said "1 pc spacing" while the cell doubles on zoom-out (only `progress` disclosed it) and no test asserted spacing at any zoom, plus the frame-hash clause was a build-time measurement — FIXED after the run (`0da6b15` rewrote the observable; the spacing test landed next); **AC-4/5/6 INSUFFICIENT** = no browser driven (procedural); AC-11 deferred-to-max. ⚠ The workflow does NOT write this file — the coordinator writes it from the returned object. A quiet re-run at HEAD is expected to flip AC-2 (~45 agents; not spent — Max's call). |
| `src/ui/__tests__/navRestorations{1,2,3,4}.{design,driver,host}.test.js` | 155 new cases across nine files, every fix proved RED on a named mutant; the frame-hash instrument (FNV-1a over the recorded fill+text stream) and the `at()` helper that stands the pilot ON the system star live in `navRestorations1.design.test.js`. |
| `~/.claude/projects/-home-ax/memory/well-dipper-nav-audit-2026-09-18.md` | the memory note (2026-09-20 section: rulings, waves, run ids, the Esc finding). |
| `~/.claude/skills/wd-browser-up/SKILL.md` | the browser bring-up. Chrome on 9223 was up all day; the `:5175` server was not. |

**Vocabulary:** LEGACY = viewMode null; DESIGN 1 = 'rail'; DESIGN 2 = 'bars'. The build was four workflow runs (1a: LAB+DRIVER; 1b: LAB; 2a: LAB+DRIVER+HOST; 2b: LAB+DRIVER+HOST; each + an integrator; opus/high) + one fixup agent. Scripts: session scratchpad `coord/wave{1b,2a,2b}-build.js` (ephemeral — the persisted copies are under `~/.claude/projects/-home-ax-projects-well-dipper/<session>/workflows/scripts/`).

---

## 2. ▶ THE PICKUP — in order

> ✅ **2026-09-21 UPDATE: THE LIVE CHECKS RAN.** Max started the server; a browser agent drove every AC in the running game (report folded into each AC's `progress`; AC-1..10 now `VERIFIED_PENDING_MAX 0100fd5`). The page has an **"After the restorations"** section with sixteen captures and **eight numbered findings (24-31)** — recorded in `contract.json` `liveFindings2026-09-21`. The ones that are defects: **24** Sol's planet names are generated and unstable (state.js seeds the name RNG from `star.seed`, `'Sol'` vs the hash by arrival path; legacy prefers `_knownSystemNames`) · **25** design 2's stems run through its own hint rows at the widest zoom · **26** `0.0 GYR` and bare `G` printed for absent data · **27** ladder names on one row run together · **28** mouseleave leaves the callout up. 29-31 are Max's eye. ⚠ His window gave a **480×240** buffer today, not 417 — nothing was measured at 417. The captures are in `scratchpad/nav-restorations-captures/` (untracked). Step 2 below is DONE; steps 1, 3, 4 stand.

1. **Read the verdict** (`verdict.json`). Anything judged FAIL that is not one of the recorded departures is a defect to fix; INSUFFICIENT on AC-4/5/6 was procedural and the live run closed it.
2. **The live checks — DONE 2026-09-21 (kept below as the procedure for the next batch).** Ask Max for the server (`cd ~/projects/well-dipper && npx vite --port 5175`; only he launches it), then `wd-browser-up` step 4 onward. Drive, and write each result into the AC's `progress`:
   - **AC-2 frame time** at design 2 PRISM zoomed fully OUT (wheel to the ceiling): the depth cues multiply the drawing ~5× there; headless the two 5 s-budget cases were unchanged (2928 vs 2968 ms) but Max's window is the instrument. `performance.now()` around `nc.render()` or a `requestAnimationFrame` delta.
   - **AC-1** a real mouse hover on a star, a planet, a tile, a sector — the callout appears beside the pointer and vanishes on empty map; a rail-row hover paints NONE.
   - **AC-5** the ship diamond on the body the game is actually at (`_currentFocusIndex` from main.js), the trajectory to the selected body; fly (or `_lab`) to a foreign system → no ship.
   - **AC-6** the REAL wheel over design 2's orrery (both directions to both clamps), a REAL drag on the zoom gauge; design 1's ladder unmoved by the wheel.
   - **AC-10** a real drag on design 2's prism y-gauge moves the camera height and the HEIGHT number.
   - **AC-4** select a planet with moons, click it again, click a moon, press Enter → the game burns to the moon (`main.js:5994`); right-click back out.
   - **Captures for the page** (`nc._canvas.toDataURL()` under a design): design 1 PRISM with cues + names + the detail block; design 2 PRISM status + legend row + y-gauge; a star callout; a planet callout; the named ladder; the named orrery; the star line with nothing selected; the ship + trajectory in both; the zoom gauge at 0.3 and 5.0; the moon ladder; the moon orrery with a moon armed. Add an "After the restorations" section to `nav-menu-map-old-vs-new.html` (the "After the fixes" section is the model) and republish the artifact at the SAME url.
3. **Push** — ask once.
4. **The asks** (§6), by number.

---

## 3. THE DEPARTURES FROM THE ACs' WORDING — all measured, all in `contract.json` `progress`; none is a defect

- Design 1's HEIGHT clause is two rail rows, not one `·`-joined line (179 texels in a 149-texel rail; the guard fires on the joined form).
- The plane lattice is 1 pc at the default camera and doubles (2/4/8 pc) as the camera pulls back (a true 1 pc grid at the widest stop is 13,093 texels — a wash).
- Design 2's PRISM bar hands its star count and `L=LIST · WASD PAN · R/F UP` to a legend row on the map — the bar was already overflowing before this work; `R/F UP` is drawn at PRISM for the first time.
- Design 1's PRISM rail list is 22 rows (was 27) — five rows went to the camera block.
- `R☉` and `×` are not in the face → `R SUN`, `X1.0`.
- The trajectory stops 4 texels short of both marks (no alpha at 240p; a solid run erases a 3-texel planet); dashes every other texel; a 3-texel chevron.
- Design 2's y-gauge spans the pane at x = W-20 (the old 24-texel widget could not resolve a height); six columns of starfield stop answering a click — design 1's own trade.
- The moon ladder SORTS moons by orbit radius (the axis separation pass assumes ascending order).
- The sub-view says RIGHT CLICK BACK, not ESC BACK (§4 trap 51).
- The overlap test for names is plate-against-GLYPHS (plates pad two rows; adjacent plates abut on padding).

---

## 4. ⛔ THE TRAPS — 09-18's 39-48 and everything before still hold; these are new (49-60)

49. ⭐⭐ **A REAL ESC NEVER REACHES `handleEscape`.** `_onKeyDown` (NavComputer.js:344-360) has no Escape clause; the key falls to `main.js:13557` → `toggleNavComputer()` — the whole nav closes. That is Max's 2026-07-29 ruling ("esc should just dismiss"), guarded by `NavComputer.escape.test.js` (44 cases + a source guard). `handleEscape` is reached ONLY by right-click (`:336` contextmenu → `:4489`). Any AC that says "Esc goes back one screen" is contradicting a ruling; ask him first.
50. ⭐⭐ **UNDER A DESIGN A FOREIGN-SYSTEM PLANET CLICK ARMS NO SELECTION** (`:4589-4592` sets `_selectedPlanetIdx` only; the `_systemMode` pin makes the view it wanted unreachable). So in a foreign system neither a planet target nor the moon sub-view exists. Legacy drills straight into its planet detail. HOST work, a wave of its own.
51. ⭐ **`S.hover` IS ONE FRAME STALE.** The driver publishes it at the tail of `render()` from the same pick `resolveHover` writes to the host; the callout paints from it on the NEXT frame. Headless: move the pointer (`hoverAt`), render, render again, THEN read the stream.
52. ⭐ **A CALLOUT DRAWS ONLY WHEN THE HOVER POINT IS INSIDE THE MAP PANE.** A rail-row / list-row hover resolves (`S.hover` non-null, the trajectory even re-aims to that body — legacy's own hovered-or-selected rule) but paints no plate. Before that gate (wave 1b) the plate clamped into the map's corner ~35 texels from the pointer.
53. ⭐ **`CALLOUT_GAP` IS 7, NOT 6.** `plated()` pads one texel out from the glyphs, so a plate offered at `ax+6` has its edge on the mark's half-extent, every candidate tests as "covers the mark", and the callout silently draws NOTHING at every 2D level. If callouts vanish, look here first.
54. **THE MOON SUB-VIEW IS DRIVER STATE** (`S.sysView`/`S.detailPlanet`), NOT `nav._systemMode` — the pin at `:4585/:4590` stays and no design path sets `'planet'`. Reset off level 4 (an invariant, every frame), on a design change (`state.js` `cache.design`), by `onDeactivate()`, and by the host's V clause calling `drv.onLookChange?.()` (the fixup: a V round trip through legacy paints no driver frame, so the design-change reset never saw it).
55. **INSIDE THE SUB-VIEW A MOON IS THE PICK; OUTSIDE IT COLLAPSES TO ITS PARENT.** `bodyIdentity(nav, ref, moonIdx, S)` — the fourth argument. Design 1's sub-view rail rows are NOT a `D.bodies` slice: `pickFromRow` reads `S.railBodies` (the rows the paint drew) — before that, the five drawn rows resolved to planets 0,1,2,2,3.
56. **`S.orbitRings` IS EMPTY IN THE MOON ORRERY ON PURPOSE** — an empty-map click is the way out; a ring pick would take that exit away from most of the pane.
57. **ONE PUBLISHER OF `S.yGaugeRect`:** `yGauge(g, gx, gy, gh)` in the lab, called by `d1Prism` (its old values, D1 PRISM hash identical) and `d2Prism` (x = W-20). The host's gauge routing at `:4402` accepts ANY design but only AFTER `:4401`'s `onMap` test — a gauge must lie INSIDE the map pane or its press is never reached. Same for the zoom gauge (`x = W-10`, level 4, design 2; host folds `:156/:4355/:4405/:4415`).
58. ⭐ **THE SCRATCHPAD IS SWEPT BY AGENTS TOLD "NO SCRATCH FILES LEFT".** Wave 1a's integrator deleted MY drafts. Give every agent its own `scratchpad/agents/<wave>` subdir and tell it to delete only that.
59. **NO RAW BACKTICKS INSIDE A WORKFLOW LANE PROMPT** (they are template literals): the Workflow tool refuses the script with a parse error at the backtick. Check with `new (async function(){}).constructor(...)` before launching.
60. **`isKuiper`, `moons`, `name`, `cls` ARE ON `D.bodies` ROWS NOW** (`buildBodies`); `beltLabel` prefers the flag, else the belt beyond every planet is Kuiper. A moon row's parent is by index; the sub-view tags moons `<parent letter><b..z>`.
61. ⭐ **THE HEADLESS PRISM IS AT LEGACY'S ANGLES, NOT THE DESIGNS'.** `makeHeadlessNav` leaves `_localRotX/_localRotY` at the constructor's 0.5/0.3, so the lattice is sheared and "spacing between lines" is not a row distance. Call the host's own `_seedViewModeCam()` (what V runs) before measuring any prism geometry; assert the two angles off `S.cam`.
62. **`_localCubeSize` IS UNDEFINED HEADLESS** (it comes from `setPlayerPosition`, which the harness never calls), so `_handleWheel`'s ceiling there is the `|| 0.01` fallback, not `ZOOM_STOPS[3]` = 0.01034; the floor IS the entry radius 0.0015. The wheel's 1.15 steps land on none of the middle stops — write the field for those and say so.
63. **THE VERIFY WORKFLOW DOES NOT WRITE `verdict.json`.** It returns the verdict object; the coordinator writes the file (from the journal's synthesize result, or the task output). A verdict that names a clause the build knowingly departed from is a CONTRACT defect — rewrite the observable to the measured rule and add the test that pins it (AC-2's lattice cell, this session), rather than re-running.

---

## 5. WORKING WITH MAX — re-confirmed, plus two new

- ⭐⭐ **HE ANSWERS TERSELY, IN ORDER, BY NUMBER** — and answers ONLY the ask he means to: "Go with your recs on restorations" answered ask 2 and left 1 and 3 standing. Carry the unanswered ones verbatim.
- ⭐⭐ **A "GO WITH YOUR RECS" IS THE GREENLIGHT FOR THE SCOPE AS DESCRIBED** — no second interview round-trip; write the contract from the page's rows and build.
- ⭐ **ONLY HE LAUNCHES THE DEV SERVER.** A day of build with no live check is what a down server costs; ask for it in the FIRST report, with the command, not after the build.
- ⭐ **HIS OLDER RULINGS OUTRANK MY AC TEXT.** The Esc clause I wrote into AC-4 contradicted his July ruling I had not read; the fix was to rewrite the AC to the ruling of record and carry the question, not to build against it.
- ⛔ **HE DOES NOT USE THE BROWSER CONSOLE.** His walk is keys, clicks, the wheel.

---

## 6. FOR MAX (carried; recommendation stated)

1. **The server**, so the live checks and the pictures can happen: `cd ~/projects/well-dipper && npx vite --port 5175`.
2. **Esc inside the moon sub-view**: step back one screen, or keep closing the whole nav (your July ruling)? Recommend keep; the glass says RIGHT CLICK BACK and an empty click also steps out. One host fold flips it.
3. **Push** lane A (seven commits since `8a62ad0`)? Recommend yes.
4. **Carried from 09-18:** the ladder keeps distance order under every sort; design 1's tab strip lost its level count to the legend. Recommend keep both.
5. **Carried from 09-18:** the review's leftover defects — recommend go on three (a painter throw freezing the nav until reload; design 2's PRISM map-mode status losing `R/F UP` — re-measure first, wave 1a's legend row may already carry it; one live probe of a SECTOR/REGION click drilling a double-size tile), park the rest (perf, harness hygiene, a narrow-window layout, a doc fix, the HELM `N`/`V` question).
6. **Follow-ons logged in the contract, none blocking:** foreign-system planet selection under a design (HOST); the ladder scroll not restored after a sub-view in a dense system; the 5 s vitest budget; design 1's PRISM rail digit column; the companion strip's `»` tofu.

## 7. SUGGESTED SKILLS

- **`wd-browser-up`** — the bring-up; read its traps.
- **`dev-collab-scope`** — a follow-on that spans two systems (the foreign-system planet selection) is its own unit.
- **`superpowers:systematic-debugging`** — if the verdict names a FAIL that is not a recorded departure.
- **`handoff`** at the next seam.
