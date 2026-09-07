# Handoff — ▶ **EVERY ELEMENT IN THE TWO NEW NAV MENUS MUST BECOME FUNCTIONAL AND NAVIGABLE. THAT IS THE WHOLE JOB.**

> ⚠ **IN-REPO ON PURPOSE.** The handoff skill says "temporary directory"; this project's standing
> convention overrides it, for the reason its predecessors give: `/tmp` does not survive a WSL restart.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master).
> ✅ **Everything is PUSHED** — verified by `git ls-remote` at **`06e8551`**. Nothing is unpushed.
> ⛔ Hundreds of untracked stray PNGs/JPEGs are normal — **never `git add -A`**.

---

## 0. THE INVOCATIONS. THERE ARE THREE SUITES AND NOW A FOURTH CHECK.

```
npx vitest run --dir tests       --root /home/ax/projects/well-dipper   # 20 failed / 8 files  (EXPECTED)
npx vitest run --dir src/cockpit --root /home/ax/projects/well-dipper   # 698 passed
npx vitest run --dir src/ui      --root /home/ax/projects/well-dipper   # 339 passed
node scripts/extract-nav-designs.mjs --check                            # designs.js vs the lab
```

The eight expected failures in `tests/`, by name — anything else is yours:
`agent-camera-api`, `driver-pack-giantdeck`, `gas-body-lab-material`, `lab-shader-perframe-seam`,
`moon-condition-contract`, `moon-rng-stream-identity`, `port-condition-contract`,
`relief-octave-lod-ramp`. ⚠ Two worldengine files flake — one run gave 22/9; re-run before believing
a drift.

---

## 1. ⭐⭐ MAX'S INSTRUCTION FOR THIS SESSION, IN HIS WORDS

> *"use workflows/subagents to continue implementation of this new menu system, beginning by
> identifying every single element you've created and scoping/planning how that functionality should
> work (every single thing needs to be functional and navigable by the player), reusing systems from
> the old design where feasible, and continue until all are functionally implemented. You should be
> able to test the basic functionality since these are all menu systems. Then you'll let me know when
> all systems are functional."*

Four things that instruction fixes, and none of them is optional:

1. **WORKFLOWS/SUBAGENTS ARE REQUESTED.** He has opted in explicitly. ⭐ `subagent-model`: pin a model
   on every `Agent(...)` call — omitting it inherits Fable at 2x Opus cost.
2. **THE INVENTORY COMES FIRST.** §3 below is a starting inventory, not a finished one. Verify it —
   some rows are marked UNVERIFIED for a reason.
3. ⭐ **"REUSING SYSTEMS FROM THE OLD DESIGN WHERE FEASIBLE."** This is the scope discipline for the
   whole session and it has already paid twice: the drill, the zoom animation, the view-stack push
   and the drill sound were ALL inherited by writing three hover fields instead of reimplementing
   them, and the commit button works because the design's rectangle is published into
   `_commitButtonRect`, the field the shipped handler already tests.
4. **HE EXPECTS YOU TO TEST IT YOURSELF** — "these are all menu systems". Do not hand him a walk to
   perform. §6 has a working browser driver.

---

## 2. WHERE THIS STANDS IN ONE SCREEN

| | |
|---|---|
| The full-screen nav renders at the world's resolution | ✅ live, 427x240 into a 1600x900 box |
| Design 1 "the 71x40" (rail) as a mode | ✅ draws all five levels |
| Design 2 "two bars and a sky" as a mode | ✅ draws all five levels |
| `V` cycles the modes, `L` design 2's list, `,` `.` the ladder | ✅ live |
| Tabs, commit, list-row picking, ladder scroll | ✅ live |
| ▶ **Everything else the menus ADVERTISE** | ▶ **THIS SESSION'S JOB** |

**Max's ruling, 2026-09-07:** *"I like both versions you've made for the new 240p menus, let's keep
both"*. ⭐ **BOTH SHIP** — so the diegetic cockpit panel eventually has TWO sources to represent, not
one. That is a later workstream; do not start it.

Workstream: `docs/WORKSTREAMS/nav-fullscreen-view-modes/` (`intent.md` + `contract.json`, status
`verifying`). ⭐ **A NEW CONTRACT IS NEEDED FOR THIS SESSION** — the existing one is about making the
designs EXIST, and Max has now scoped making them WORK. `dev-collab-scope`.

---

## 3. ▶ THE ELEMENT INVENTORY — START HERE, AND FINISH IT

Every element the two designs put on the glass. ⛔ **Rows marked UNVERIFIED are my reading of the
code, not a measurement.** Max's instruction is that every one of these becomes functional.

### ✅ WORKING, VERIFIED LIVE
| element | both/design | how it works |
|---|---|---|
| level tabs x5 | both | `remapClick` re-expresses the index; the shipped handler does the drill |
| `[ WARP ]` / `[ BURN ]` | both | design's rect published into `_commitButtonRect` |
| rail row -> select | 1 | levels 0 (sector), 3 (star), 4 (body) via `_hoveredTile` / `_hoveredLocalStar` / `_hoveredBody` |
| list row -> select | 2 | same, in `L` list mode |
| `V` mode cycle, `L` list | both | `_onKeyDown` |
| SYSTEM ladder scroll | 1 | `,` `.` and clicking the `...` caps |

### ⛔ ADVERTISED ON THE GLASS AND **NOT** WIRED — each of these is a promise the menu makes
| what the menu says | where | status |
|---|---|---|
| `CLICK A SECTOR / A TILE / A STAR` | 1, hint row | ⛔ **the MAP PANE is not a picker in either design.** Deliberate so far — inverting each design's own projection would be a third copy of code that must stay verbatim. **This is the biggest single item.** |
| `CLICK TO ENTER` | 2, status line | ⛔ same |
| `[ ] SORT` | 1, hint row (all levels) | ⛔ no sort exists anywhere |
| `[ ] PAGE` | 1, rail pager | ⛔ the rail shows `1-27 OF 43681` and cannot page |
| `/ SEARCH` | 1, hint row | ⛔ the DOM search box is `display:none` in a mode (it was lying across the chrome). Needs a DRAWN search, or the affordance removed |
| `TAB LEVEL` | 1, hint row | ⛔ `Tab` is bound nowhere in `NavComputer.js` |
| `ENTER` | 1, commit row | ⛔ UNVERIFIED — one `'Enter'` in the file; check it reaches commit |
| `DRAG TO ROTATE` | 1, SYSTEM hint | ⛔ design 1 draws a **ladder**, which has no rotation. Either the hint is wrong or the element is |
| `WASD PAN`, `R/F UP` | 1 and 2, prism | ⚠ UNVERIFIED — see §4 |
| rail rows at SECTOR / REGION | 1 | ⛔ `hover()` returns false for levels 1-2; only the map can pick a tile, and the map is not a picker |
| design 2 `SYSTEM` body picking | 2 | ⛔ its orrery is drawn but nothing selects from it |

### ⚠ THE ONE THAT NEEDS MEASURING BEFORE ANYTHING ELSE
⭐⭐ **DOES THE DESIGNS' PRISM FOLLOW THE CAMERA?** `projectPrism` anchors to **`D.player`** (the
ship) and takes its radius from **`ZOOM_STOPS[S.zoomIdx | 0]`** — and **nothing anywhere writes
`S.zoomIdx`**. The legacy camera is `_localCenter` / `_localRadius` / `_localRotX` / `_localRotY`,
and the designs read **none of them**. Moving the camera DID change the picture in a live probe, but
only because `_ensureStarsLoaded` swapped `_localStars` underneath — which is a different thing from
the view moving. ⛔ **Measure this properly before scoping the prism.** If pan/zoom/rotate are inert,
`WASD PAN` and `R/F UP` are advertised and dead, and the fix is a design decision (follow the camera,
or drop the affordance), not a patch.

---

## 4. ⛔ TRAPS — THE FIRST ONE COST A WHOLE ROUND-TRIP WITH MAX

1. ⭐⭐⭐ **`NavComputer.js` KEEPS ITS LINE COUNT FIXED (4711) AND THAT IS INCOMPATIBLE WITH `//`
   COMMENTS.** ~700 line-anchored citations ride this file, so new statements are FOLDED onto
   existing lines — and **a `//` comment mid-line comments out every statement after it**. That is
   exactly how the `V` key shipped as dead code: present, parsed, unreachable, whole feature inert.
   Max found it — *"I'm still seeing the old menus"*. ⛔ **Every comment on a folded line must be
   `/* */`.** `wc -l` before and after must be equal. Same rule for `main.js` at **15161**.
2. ⭐⭐ **AND NO TEST COULD SEE IT, BECAUSE ALL 28 SET `viewMode` DIRECTLY.** Any new affordance needs
   a test that goes through the REAL entry point — `_onKeyDown`, `_handleClick`, `_handleMouseMove` —
   not through a driver method. The general form, twice-earned this session: *ask what would make
   this green test fail; if no input in its sample can, it is pinning nothing.*
3. ⭐⭐ **`designs.js` IS GENERATED. DO NOT EDIT IT.** `node scripts/extract-nav-designs.mjs`
   regenerates it from `nav-240p-lab.html`; `--check` diffs. **A design change goes in the LAB**, so
   the lab stays a living spec instead of a frozen artifact the game drifts from. Add `--check` to
   whatever you run before committing.
4. ⭐ **`S` AND `D` ARE MUTATED, NEVER REPLACED.** The design closures captured those identities once.
   A fresh object leaves every design painting the frame the factory was built on — and it repaints
   happily forever, so it reads as "the nav has frozen", not as a bug in `state.js`.
5. ⭐⭐ **THE CLICK HANDLER DRIVES OFF HOVER STATE, NOT COORDINATES.** `_hoveredTile` (2D),
   `_hoveredLocalStar` (prism), `_hoveredBody` (system). **This is the reuse seam Max is asking for**
   — write those three fields from a design's geometry and you inherit the drill, the animation, the
   stack push, the sound and the system resolution. It is how the list picker works in ~30 lines.
6. ⭐ **GEOMETRY MUST COME OUT OF THE PAINT.** `regions()` publishes every band; `d1Ladder` publishes
   `ladderStops` / `ladderMax` / `ladderCaps` / `ladderVisible` onto `S`. Restating a layout in a
   hit-test is the AC-4 defect shape — two copies of one geometry, one silently wrong.
7. ⛔ **THE LEGACY RENDERER STILL RUNS UNDERNEATH EVERY MODE FRAME, ON PURPOSE.** This class LOADS
   INSIDE ITS PAINTERS (`_renderLocal` -> `_ensureStarsLoaded` :1881; `_renderSystem` resolves
   `_systemData` :2443). Dispatching a mode before them returns early and every design draws a
   correct layout over an EMPTY star list. ⚠ Its interactive rects are still live too — that is how
   `[ WARP ]` got swallowed by the invisible 32-row legacy tab strip. Any new element in the bottom
   eighth of the screen will hit the same thing.
8. ⛔ **THE COCKPIT PANEL MUST NOT CHANGE.** Two separate instances (`main.js:4700` vs `:5895`); the
   gate is `activate()`, which `_openCockpitNav` never calls. ⛔ NOT `_bare` — permanently FALSE on
   the panel.
9. ⛔ **A FIELD COMES OFF THE GLASS, NOT OUT OF THE PIPELINE** — Max: *"don't get rid of any code that
   allows you to display what we want to display."* Say drawn-or-not, never producible-or-not.
10. ⛔ **A MISSING GLYPH OR A NULL FIELD FREEZES THE SCREEN.** `PanelHost` catches a painter throw
    ONCE, then stops uploading — the glass keeps showing the last good frame and looks alive.
    `displayClassOf` returning undefined already caused this; `state.js` now defaults name/class/AU.
11. **`git push` on WD fails in-sandbox above ~10MB** — TLS error, then a lying "Everything
    up-to-date". Disable the sandbox and **verify with `git ls-remote`**.

---

## 5. THE ARCHITECTURE, IN FIVE FILES

```
nav-240p-lab.html                  THE SPEC. Design changes go HERE.
  -> scripts/extract-nav-designs.mjs   generates, --check diffs
src/ui/navViewModes/designs.js     GENERATED. Verbatim designs 1 + 2 as a factory over (S, D).
src/ui/navViewModes/state.js       THE ADAPTER. Live NavComputer state -> the lab's S/D shape.
src/ui/navViewModes/index.js       THE DRIVER. Mode cycle, buffer, hover, click remap, ladder scroll.
src/ui/navViewModes/geometry.js    Control geometry the paint cannot publish (tab subdivision only).
src/ui/NavComputer.js              8 folded hooks. LINE-STABLE AT 4711.
```

`S` = `design level lines list sabotage zoomIdx buf ladder*`.
`D` = `gm sectors lum nav player playerSector sectorRows stars starRows sys bodies target selStar selBody sysStar here fail lumCache`.

---

## 6. ⭐ THE BROWSER, AND THE THING WORTH REMEMBERING

⛔ **The `chrome-devtools` MCP server failed to connect for this entire session.** That is **NOT** the
same as the browser being unreachable. Chrome exposes the DevTools Protocol on **port 9223**, and
Node 24 has a native `WebSocket`, so a dependency-free driver works:

```
node -e "fetch('http://127.0.0.1:9223/json/list').then(r=>r.json()).then(l=>console.log(l.map(p=>p.url)))"
```

`scripts/cdp-driver.mjs` is that driver — `evaluate` / `key` / `click` / `shot`, ~35 lines. ⚠ Run it
with the sandbox disabled. Try the MCP server first; fall back to this.

**The walk:** splash -> **ORRERY** (⛔ **not HELM** — in HELM `N` opens the cockpit panel and there is
no overlay) -> `Enter` -> `N` -> `V`. Vite is already on **:5175** serving lane A — ⛔ **do not start
a server**. A page open from before an edit keeps the OLD module: `NavComputer.js` has no HMR
handler, so **reload before measuring**.

---

## 7. WORKING WITH MAX — all re-confirmed this session

- ⭐⭐ **"LET ME SEE WHAT YOUR REC LOOKS LIKE" MEANS RENDER IT.** He ruled on three designs in one
  message because they were on a screen, and on the ladder redesign the same way. He will not rule on
  prose and he is right not to.
- ⭐ **HE ANSWERS TERSELY AND IN ORDER — NUMBER THE ASKS.**
- ⛔ **HE DOES NOT USE THE BROWSER CONSOLE.** Every A/B he runs is a keypress.
- ⭐ **HE REPORTS REAL DEFECTS PLAINLY AND HE IS RIGHT.** *"I'm still seeing the old menus"* was the
  whole feature being inert. Check the running game before disputing.
- ⛔ **NO AFFIRMATIONS.** He said *"Looks like the basic functionality works, nice"* — do not
  reciprocate, just engage with the substance.
- **He commits without being asked; he is asked before every `git push`.**

---

## 8. FIRST FIVE MINUTES

1. Read `docs/NOW.md` top three entries, then this file. Capture all THREE baselines (§0) plus
   `--check` **before touching anything**.
2. **Open the game and press `V` twice** (§6). The two pictures are what the session is about.
3. **Finish the inventory in §3** — verify every UNVERIFIED row against the running game, and settle
   §3's prism question first, because it decides whether four advertised affordances are dead.
4. **`dev-collab-scope` a NEW contract.** The existing one is "the designs exist"; this session is
   "every element works". One AC per element class, each with the user input and the observable.
5. Then fan out with subagents per Max's instruction — the element groups in §3 are close to
   independent. ⭐ **Pin a model on every agent call.** Start with the map pane: it is the biggest
   item, it blocks four advertised affordances, and it is the one that most needs the projections
   lifted out of `designs.js` first.
