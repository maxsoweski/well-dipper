# Handoff — ▶ **THE NAV AUDIT IS DONE AND ITS 22 DEFECTS ARE BUILT AND LIVE-CHECKED; MAX STILL HAS TO (a) LOOK AT FOUR PICTURES AND TWO DECISIONS, (b) RULE ON THE ELEVEN RESTORATIONS (items 13-23 on the page).**

> ⭐⭐ **HIS LAST WORDS (2026-09-18):** *"1 yes (use subagents/workflows) 2 I need to review first 3. Yes; after 1 and 3 write a handoff to a fresh session"* — on the three asks at the bottom of the comparison page: (1) go on the twelve defects, (2) the restorations wait for his review, (3) push. All three done; this is the handoff.

> ⚠ **IN-REPO ON PURPOSE.** Branch `feature/world-engine-production-L1` (lane A, NOT master). Commits since the last push (`783e32b` was pushed and verified): `96ae10f` scope · `2d30b73` wave 1 · `652a9c0` review record + wave-2 scope · `b3f7737` wave 2 · `48159e6` the home-test fix · plus this handoff's NOW/handoff commit. **He has not said push for these** — ask once, as an approval, no command. ⛔ Hundreds of untracked PNGs are normal — never `git add -A`.

---

## 0. THE INVOCATIONS, AND THE BASELINE THEY MUST REPRODUCE

```
npx vitest run --dir src/ui      --root /home/ax/projects/well-dipper --exclude '**/.claude/**'   # see NOW.md's 2026-09-18 entry for the final count (765 passed / 35 files at wave 2, +2 cases after)
npx vitest run --dir src/cockpit --root /home/ax/projects/well-dipper --exclude '**/.claude/**'   # 698 passed
npx vitest run --dir tests       --root /home/ax/projects/well-dipper --exclude '**/.claude/**'   # 20 failed / 8 files (EXPECTED, unrelated)
node scripts/extract-nav-designs.mjs --check                                                      # green
wc -l src/ui/NavComputer.js src/main.js                                                           # 4711 / 15161, BOTH FROZEN
```

⛔ `--exclude '**/.claude/**'` is not optional. `src/ui` takes ~5 min; pass `timeout: 600000`. Under load (a verify workflow running vitest at the same time) `navViewModes.test.js` has thrown "Worker exited unexpectedly" and shown 4 phantom failures that vanish when the file runs alone — re-run before believing it.

---

## 1. WHERE THIS STANDS — read these, don't re-derive them

| artifact | what it holds |
|---|---|
| **Old Nav vs New Nav** — https://claude.ai/artifact/F8Ut2bLQbK4hh5V8TJ27UY · `docs/FEATURES/nav-menu-map-old-vs-new.html` | THE SPEC IN MAX'S LANGUAGE. The old nav mapped like the walk sheet; every screen beside both designs; lost/gained; the prism inventory; the ladder; the consistency table; **23 numbered items** (1-12 defects, done; 13-23 restorations, HIS TO RULE). Now with an "After the fixes" section: the captures he should look at. |
| `docs/WORKSTREAMS/nav-defects-batch-2026-09-18/{intent.md,contract.json}` | 22 ACs with a `progress` note each (what was built, by which lane, what a live check found). AC-21's note records the one deliberate partial (WASDRF chords still eaten). |
| `docs/WORKSTREAMS/nav-defects-batch-2026-09-18/REVIEW-2026-09-18.md` | the code review: 37 confirmed / 3 refuted / 13 nits, with the critic. AC-13..22 cite its C-numbers. The confirmed items NOT in the batch are §3 below. |
| `docs/WORKSTREAMS/nav-defects-batch-2026-09-18/verdict.json` | verify-workstream FULL (90 agents) at `b3f7737`: **15 of 22 PASS by 3/3 or 2/3 consensus; 7 INSUFFICIENT for procedural reasons, none judged broken** — AC-2/3/7/8 were "live check pending" (driven the same day; evidence in the contract's progress notes), AC-10/12/21 were judged while the home-test fix was landing in the tree (re-run alone: green). ⚠ Its `perLayer` still reads INSUFFICIENT; a quiet re-run at HEAD would flip it, at ~90 agents — Max's call whether that is worth the burn. |
| `~/.claude/projects/-home-ax/memory/well-dipper-nav-audit-2026-09-18.md` | the memory note; `well-dipper-nav-walk-sheet.md` carries the sheet's corrections. |
| `~/.claude/skills/wd-browser-up/SKILL.md` | the browser bring-up (new this session, baseline-tested). |

**Sessions' vocabulary:** LEGACY = viewMode null; DESIGN 1 = 'rail'; DESIGN 2 = 'bars'. The page IS the spec: when a row there and the code disagree, the page was measured from the code by 21 readers and a critic; check, don't assume.

---

## 2. ▶ THE PICKUP — in order

0. **Do not build any restoration (page items 13-23).** He said *"I need to review first."* If he answers by number, each yes is its own scoped unit (most touch the lab → extractor → designs.js pipeline; hover-inspect (13) needs a hovered ref published on S first; planet detail (16) needs a design-side sub-mode before the `_systemMode` pin at NavComputer.js:4585/4590 can be lifted).
1. **Push** — ask once.
2. **His four pictures + two decisions** are on the page's "After the fixes" section: design 2's chip unarmed/armed, design 1's unarmed row, the legends (design 1 PRISM hint + tab-strip legend; design 2 SYSTEM legend), the pips, the ladder letters under a sort, design 2's SECTOR status, the panned GALAXY. Decisions: (a) the ladder is now sort-independent (AU order) so its letters match the rail — one line to revert (lab `:1477` / `designs.js:1201`); (b) design 1's tab-strip level counts and two hint clauses were cut to fit the legends at 417 texels (the count still prints in the rail header).
3. **The review's confirmed items not in the batch** (§3) — offer them as the next defect batch; none blocks.
4. Then the restorations, as he rules.

---

## 3. REVIEW FINDINGS STILL OPEN (confirmed, not built) — from REVIEW-2026-09-18.md

- **C13** every background star-load growth rebuilds and re-sorts all starRows; D.here/D.selStar rescan (perf risk at PRISM).
- **C15** the prism wheel clamp was widened in legacy with no recorded ruling (legacy now zooms in past the old floor? — check `NavComputer.js:4705` against the AC-3 byte-identity claim).
- **C21** both designs' chrome breaks below ~205 (design 2) / ~241 (design 1) texels wide — not at Max's window.
- **C22** the mark-guard dedup key is cleared per frame so one persistent violation floods the console (`designs.js` returned API `resetViolations` — outside the generated block, fixable without the lab).
- **C23** SECTOR/REGION tile ranking rebuilt twice per frame (perf).
- **C26** navViewModes' sabotage probe proves the plumbing, not the per-draw guard.
- **C28** headlessNav rebinds `document.createElement` globally (pre-existing harness hygiene).
- **C33** a painter throw permanently stops the overlay render loop (pre-existing; a try/catch + restart in `_navRenderLoop` is the fix, main.js is frozen → fold).
- **C34** in HELM, N opens the cockpit panel, which can never take a design, so V looks dead — a HELM/ORRERY question for Max.
- **C37** AC-18's verifyVia (close-pass contract) asks for Tab in legacy where Tab is not bound — doc fix.
- The critic's hypothesis #1: design 2's SECTOR/REGION `'block'` projection vs `cellAt` may drill a tile twice the size clicked; `pickTile`/`cellAt` have no direct test. Worth one live probe.
- Design 2's PRISM **map-mode** status line overflows 417 by ~8 characters so `fit()` eats `R/F UP` (integrator wave 1, §8) — same class as AC-12/AC-18, on the one row neither named. Four characters to fix; it is a string Max ruled on.

---

## 4. ⛔ THE TRAPS — the walk-sheet handoff's 31-38 and part 4's 1-30 still hold; these are new (39-48)

39. ⭐⭐ **`isHere()` WAS A SEED COMPARISON AND IT IS FALSE IN SOL.** `D.sysStar.seed` is the string `'Sol'`, `D.here.seed` the hash number 163760118. Anything that decides "home vs foreign" in the designs must read `D.isCurrent` (mirrors `nav._isCurrentSystem()`, 0.1 pc identity). The headless harness never saw it because `at()` used a procgen nearest star; it now stands the pilot ON the system star.
40. ⭐ **SYNTHETIC KEYS REACH `_onKeyDown` ONLY WHEN DISPATCHED ON `document`**, not `window`. `press_key '/'` does NOT open the drawn search (no `Slash` code); dispatch a KeyboardEvent with `code:'Slash'` on document. `press_key n` while the drawn search is open TYPES "n" into the query (the search swallows N by design) — Esc first.
41. ⭐ **VITE DID NOT RELOAD THE GAME PAGE ON SOURCE EDITS FROM THIS SESSION.** Check `performance.now()/1000` (seconds since load) and fetch the served module for your marker before measuring; `navigate_page reload ignoreCache` when in doubt. A page also reloaded once for no cause I found — re-locate `nc` by `_canvas` after any gap.
42. **Right-click needs raw CDP** (`Input.dispatchMouseEvent` button `'right'`); the MCP's `click` has no button option. `scratchpad/rightclick.mjs` was the instrument (session scratchpad, ephemeral) — the shape is `scripts/cdp-driver.mjs`'s.
43. **A synthetic click at an exact texel row lands ~0.2 texel short** (client px rounding through the 4.84× scale); probe the middle of a texel row (y + 0.5), never its edge. The AC-11 headless case is exact because the harness rect equals the buffer.
44. **`remapClick` now refuses a click whose mousedown was > 5 texels away (AC-13)** — any test or probe that calls `remapClick` bare, with no preceding `_handleMouseDown`, is answered "that was a drag" (constructor `_dragStartX/Y` are 0). Give it the press.
45. **`deactivate()` folds go on line 621, not 620**: `NavComputer.prismPan.test.js:249` source-scans the `deactivate() {` signature line.
46. **`,`/`.` on line 349 are level-gated (`=== 4`) and no longer preventDefault at 0-3**; `V`/`L` ignore Ctrl/Meta/Alt; the WASDRF clause still eats chords ON PURPOSE (Ctrl+W would close the tab).
47. **The commit row/chip press is eaten when unarmed** (returns null, nothing clears) — a headless case that presses it expecting a selection clear will now fail; select first if it wants a commit.
48. **The full `src/ui` run must not overlap another vitest** (verify workflows run their own): worker crashes look like 4 real failures in navViewModes.

---

## 5. WORKING WITH MAX — re-confirmed, plus two new

- ⭐⭐ **HE ANSWERS TERSELY, IN ORDER, BY NUMBER** — number the asks, recommendation stated.
- ⭐⭐ **HE REFRAMES THE PICKUP.** The handoff said "read walk/results"; he never filled the sheet — he tinkered and named two issues, and the page answered them. Build the instrument that lets him rule.
- ⭐ **"USE SUBAGENTS/WORKFLOWS"** was his explicit word for the build; three-owner disjoint-file lanes + an integrator worked twice with zero merge conflicts. Keep the seam text fixed in the prompt.
- ⭐ **HE WANTS TO REVIEW RESTORATIONS BEFORE ANY IS BUILT** — do not fold "obvious" ones in.
- ⛔ **HE DOES NOT USE THE BROWSER CONSOLE.** Every live check here was driven by me; his walk is keys and clicks.

---

## 6. FOR MAX (carried)

1. Push the lane-A commits since `783e32b`? Recommend yes.
2. The "After the fixes" pictures and the two decisions (ladder sort-independence; the legend cuts) — say if either is wrong.
3. Items 13-23 on the page: yes / no / park by number. My recommendations are on each; 13 (hover-inspect) and 14 (prism drop lines + grid) first.

---

## 7. SUGGESTED SKILLS

- **`wd-browser-up`** — the bring-up; read its traps.
- **`dev-collab-scope`** — each restoration he says yes to is its own unit.
- **`superpowers:test-driven-development`** / **`systematic-debugging`** — the batch's discipline: drive the real input, red on a mutant, then fix.
- **`handoff`** at the next seam.
