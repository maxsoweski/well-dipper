# Handoff — ▶ **MAX HAS WALKED BOTH NAV MENUS AND GIVEN SCREEN-BY-SCREEN FEEDBACK. THAT LIST IS THE JOB.**

> ⚠ **IN-REPO ON PURPOSE.** The handoff skill says "temporary directory"; this project's standing
> convention overrides it, for the reason its predecessors give: `/tmp` does not survive a WSL restart.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master).
> ✅ **Everything is PUSHED** — verified by `git ls-remote` at **`3ec0e2a`**. Nothing is unpushed.
> ⛔ Hundreds of untracked stray PNGs/JPEGs are normal — **never `git add -A`**.

---

## 0. THE INVOCATIONS

```
npx vitest run --dir tests       --root /home/ax/projects/well-dipper   # 20 failed / 8 files  (EXPECTED)
npx vitest run --dir src/cockpit --root /home/ax/projects/well-dipper   # 698 passed
npx vitest run --dir src/ui      --root /home/ax/projects/well-dipper   # 480 passed
node scripts/extract-nav-designs.mjs --check                            # designs.js vs the lab
```

The eight expected failures in `tests/`, by name — anything else is yours:
`agent-camera-api`, `driver-pack-giantdeck`, `gas-body-lab-material`, `lab-shader-perframe-seam`,
`moon-condition-contract`, `moon-rng-stream-identity`, `port-condition-contract`,
`relief-octave-lod-ramp`. ⚠ Two worldengine files flake — re-run before believing a drift.

---

## 1. ⭐⭐ MAX'S FEEDBACK, VERBATIM. THIS IS THE WHOLE SCOPE.

> *"overall, very good, but we need to look at each screen closely. For example: on the galaxy screen
> there are many sectors in the grid that are not accessible, so there's wasted space. Also, anything
> on screen should be clickable, and selecting one thing should not prevent a second selection, as is
> currently the case on the system screen. The prism screen will need the most work--I like this
> low-fi way of rendering the star column but it's important to be able to rotate it in 3D. The
> previous system for the prism view was more functional in that sense. We have also lost much of the
> animation between screens (e.g., on the galaxy to region screens, clicking on a cell from the grid
> should highlight it, then zoom into it, resulting in the next screen (galaxy > sector > region). The
> indicators on the prism and system screens should be grabbable. I want to be able to grab and drag
> the system line view to look at the further planets from the star, rather than having to press a
> button exclusively. On the orbits view of the system screen, I want to be able to rotate the view in
> 3D like I could with the previous one."*

⭐ **THE THROUGH-LINE, AND IT IS ONE SENTENCE:** *the previous nav did these things and the new
designs lost them.* Rotation, drag, the drill animation — every one of these already exists and
already works in the LEGACY renderer running underneath every mode frame. This is a **wiring**
session, not a building one, and `converge-dont-declare-divergence` is the governing rule: a
lab/game difference is debt until proven otherwise.

⛔ **AND ONE OF THEM OVERTURNS A DELIBERATE DECISION I MADE.** Last session's contract says, in
AC-5's own words, *"ROTATION IS NOT WIRED AND THAT IS DELIBERATE — neither prism hint advertises it,
and replacing the designs' fixed shallow tilt with the legacy's full 3D rotation would change the
picture Max ruled on."* **He has now ruled the other way.** Do not re-litigate it; wire the rotation.
The reasoning was about not changing a ruled picture, and he is the one who rules.

---

## 2. WHERE THIS STANDS

Last session closed `nav-menu-elements-functional` (AC-1..AC-11 green, verified live; AC-12 is his
UAT, which this feedback IS). Full record: `docs/WORKSTREAMS/nav-menu-elements-functional/` —
`intent.md`, `contract.json` (status `verifying`, every AC carries a `progress` note with the live
measurements), and **`INTERFACE.md`**, which is the file to read before touching any of this.

| | |
|---|---|
| The map is a picker at all five levels, both designs | ✅ live |
| `Tab` / `Enter` / `[ ]` / `- =` / `/` all bound and working | ✅ live |
| The prism follows the camera (WASD/R/F pan, wheel zoom) | ✅ live |
| A drawn search, reusing the whole existing search pipeline | ✅ live |
| ▶ **Max's seven items below** | ▶ **THIS SESSION'S JOB** |

**A NEW CONTRACT IS NEEDED.** The existing one is "every element works"; this is "each screen holds
up close". `dev-collab-scope`.

---

## 3. ▶ THE SEVEN ITEMS, WITH WHAT I ALREADY KNOW ABOUT EACH

### ⭐ ITEM 4+7 ARE THE SAME JOB AND ARE MUCH SMALLER THAN THEY LOOK — START HERE

> *"it's important to be able to rotate it in 3D... On the orbits view of the system screen, I want to
> be able to rotate the view in 3D like I could with the previous one."*

**The drag-rotate handlers are ALREADY LIVE under both modes and already writing the right fields.**
`_handleMouseMove` (:4348-4360) rotates `_localRotX`/`_localRotY` at PRISM and
`_systemRotX`/`_systemRotY` at SYSTEM, at 0.008 rad/px, clamped `[0, π/2]` and `[0.1, π/2]`. And the
mode's early return at `:4345` is written `if (this.viewMode && !this._dragging && …)` — **`!this._dragging`
means a drag falls through to the legacy branch on purpose.** So the pilot is already rotating a
camera; the designs simply do not read it.

What is missing is one hop, and the plumbing for it shipped last session:
- `S.cam` already carries `{x, y, z, radius}` from `_localCenter`/`_localRadius`. **Add `rotX`/`rotY`**
  and make `projectPrism` apply them in place of its fixed `rx = 0.92, tilt = 0.42`.
- `d2System` uses a fixed `TILT = 0.42` and **fake angles** `a = i * 1.7 + 0.6` (a list-index
  placement, not an orbital angle). Give it `S.sysCam` from `_systemRotX`/`_systemRotY`.

⛔ **PRESERVE THE LOW-FI LOOK — HE ASKED FOR IT BY NAME:** *"I like this low-fi way of rendering the
star column."* The answer is a rotation applied to the existing texel-quantised marks, **not** the
legacy renderer's arcs and strokes. `d1Ladder`'s own header records why: *"AN ELLIPSE AT 240p IS A
1-TEXEL STROKE STRADDLING ITS OWN COORDINATE."*
⚠ **The default picture must stay where it is at the rotation the view opens at**, the way `S.cam`
and `S.view` already do — that is what made the camera safe to wire, and the same discipline applies.
⚠ **`_localRotY` is unclamped and unwrapped** — it grows without bound across drags.

### ITEM 1 — GALAXY WASTES SPACE, AND THERE ARE TWO DIFFERENT WASTES

> *"on the galaxy screen there are many sectors in the grid that are not accessible, so there's wasted space."*

⛔ **MEASURED, so do not re-derive it:** there are **775 sectors** and the furthest sits at
**R = 21.2 kpc**. Design 1's GALAXY map draws an **8×8 grid over the whole 44 kpc disc** in a
216-texel square, so the square's corners reach R ≈ 31 kpc where **no sector exists at all** — a live
probe at R = 19.3 already returns `null`, correctly. Roughly a fifth of the pane can never be clicked.

⚠ **AND THE DEEPER INCOHERENCE IS WORSE THAN THE EMPTY CORNERS.** That 8×8 grid is **galaxy tiles,
not sectors** — 64 arbitrary cells over a population of 775 named, density-adaptive ones — while the
**rail beside it lists all 775**. A map pick and a rail pick therefore reach a sector by two different
routes (the map inverts to a world point and asks `getSectorAt`; the rail hands the object straight
over). That is worth putting in front of Max as a design question, not just a fit.

⚠ **DESIGN 2 WASTES SPACE THE OPPOSITE WAY.** Its GALAXY projection is `kind:'wide'` — the square
rendered at the wide extent and cropped to the middle band, isotropically — so the vertical field is
only **±11.33 kpc** at 427×240. About **half the disc is off the glass by construction**. Nothing is
wasted; content is missing. Two screens, two different failures of the same question.

### ITEM 2 — "ANYTHING ON SCREEN SHOULD BE CLICKABLE"

Pickable today: map marks, rail/list rows, the five tabs, the commit chip, the ladder's `...` caps,
search result rows. **Not** pickable: the rail's detail block, the status line, the y-gauge, design
2's minimap, the density bars, the HZ band, the orbit ellipses, the tile-ID plates, the prism's index
tags and the placed labels.

⭐ **THE SEAM IS ALREADY BUILT FOR THIS.** Every one of those is drawn by code that could publish its
own rectangle the way `S.mapProj` / `S.prismHits` / `S.bodyHits` / `S.tabRects` / `S.chipRect` /
`S.searchGeom` already do. Read `INTERFACE.md §1`. ⛔ Never restate a layout in the hit-test — that is
the AC-4 defect shape, two copies of one geometry, one silently wrong.
⚠ **A label is a plate over someone else's glyph.** `plated()` knocks out a BG rect before drawing;
making labels clickable means deciding whether a click on the plate belongs to the label's object or
to whatever is underneath. Ask.

### ITEM 3 — A SECOND SELECTION IS REFUSED AT SYSTEM

> *"selecting one thing should not prevent a second selection, as is currently the case on the system screen."*

⛔ **NOT YET DIAGNOSED — DO THIS FIRST AND DO IT LIVE.** The suspects, in order:
1. `_handleClick` opens `if (this._anim) return;` — a selection that starts an animation eats every
   click until it finishes. ⚠ **And see §5: the drill animation runs off the SIM CLOCK, which does
   not advance in a background browser tab**, so it can hang indefinitely under automation and would
   look exactly like this.
2. `_systemMode` flips to `'planet'` when the selected body has moons (`:4583-4586`), which replaces
   the orrery with planet detail — a second click is then in a different view.
3. `_clearCommitSelection()` at `:4594-4596` fires on a click that resolves to nothing, and the
   belt/unknown paths reach it.
Reproduce it on the running game before touching anything.

### ITEM 5 — THE ZOOM ANIMATION ⭐ **CHECK THIS FIRST: IT MAY ALREADY BE BACK**

> *"clicking on a cell from the grid should highlight it, then zoom into it, resulting in the next screen."*

⭐⭐ **MEASURED AFTER HIS FEEDBACK, AND THE ANSWER SURPRISED ME.** Wiring `levelView` to `S.view` last
session had a side effect nobody scoped: `S.view` is written from `_viewCenter`/`_viewSize`, which
`_updateAnim` **interpolates**. Driving a real drill headlessly, `S.view.size` walks
**44 → 42.65 → 36.03 → 24.96 → 13.80 → 6.98 → 5.50** across six frames. **So the designs' map should
now zoom.** Verify live before scoping any work here — Max may have been looking at a build without it.

What is still missing either way is the **highlight before the zoom** — he asked for cell → highlight
→ zoom, and there is no click-highlight state at all.
⚠ **The drill animation only runs for 2D→2D** (`idx <= 2 && _levelIndex <= 2`, `:4450`). PRISM and
SYSTEM transitions take the else branch and snap. His example is GALAXY→SECTOR→REGION, which is
exactly the animated case; the unanimated ones may be the "much of" in *"lost much of the animation"*.

### ITEM 6 — DRAG THE LADDER, DON'T PRESS A KEY

> *"I want to be able to grab and drag the system line view to look at the further planets from the
> star, rather than having to press a button exclusively."*

Today `S.ladderScroll` moves only on `,` / `.` and on a click in the two `...` cap zones. `_dragging`,
`_dragStartX/Y` and the mouse-down/move/up trio are all live and, at level 4, currently feed
`_systemRotX/_systemRotY`. **So item 6 and item 7 both want the SYSTEM drag** — design 1's SYSTEM is a
ladder that should pan, design 2's is an orrery that should rotate. **One gesture, two meanings,
chosen by which design is active.** Decide that deliberately rather than letting whichever handler
runs first win.
⛔ The ladder's stops come from the paint (`S.ladderStops`), and a drag must land on a stop, not on a
continuous offset — otherwise it scrolls to a position with no body in it.

---

## 4. ⛔ THE TRAPS. THE FIRST TWO HAVE EACH COST A ROUND-TRIP WITH MAX.

1. ⭐⭐⭐ **`NavComputer.js` KEEPS ITS LINE COUNT FIXED (4711) AND THAT IS INCOMPATIBLE WITH `//`
   COMMENTS.** ~700 line-anchored citations ride it, so new statements are FOLDED onto existing lines
   — and **a `//` comment mid-line comments out every statement after it**. That is how the `V` key
   shipped as dead code. ⛔ **Every comment on a folded line must be `/* */`, terminated.** The
   established keyboard fold line is **349**; lines **586, 4345, 4420, 4442** end in `//` and are
   poisoned. Same rule for `main.js` at **15161**. ⚠ A previous agent nearly shipped this exact wound
   *inside the comment explaining the trap* by writing a literal terminator in it.
2. ⭐⭐ **A GREEN TEST THAT DRIVES NO INPUT IS PINNING NOTHING.** All 28 view-mode tests passed while
   `V` was unreachable, because none drove the keyboard. And the shipped list picker was acting on the
   **wrong star** because the suite rendered *before* the mousemove and never *between* the mousemove
   and the click. Ask of every green test: *what input in its sample could make this fail?*
3. ⭐⭐ **`designs.js` IS GENERATED. DO NOT EDIT IT.** `node scripts/extract-nav-designs.mjs`
   regenerates it from `nav-240p-lab.html`; `--check` diffs. **A design change goes in the LAB.**
4. ⭐ **`S` AND `D` ARE MUTATED, NEVER REPLACED.** A fresh object leaves every design painting the
   frame the factory was built on, forever, and it repaints happily — so it reads as "the nav has
   frozen", not as a bug in `state.js`.
5. ⭐⭐ **GEOMETRY COMES OUT OF THE PAINT.** `INTERFACE.md §1` lists everything already published.
   Restating a layout in a control is the AC-4 defect shape.
6. ⛔ **THE LEGACY RENDERER STILL RUNS UNDERNEATH EVERY MODE FRAME, ON PURPOSE** — it LOADS inside its
   painters (`_renderLocal` → `_ensureStarsLoaded` :1881; `_renderSystem` resolves `_systemData` :2443).
   ⚠ **It also rewrites all three hover fields every frame from `_mouseX`/`_mouseY` against LEGACY
   geometry**, which is why the picker resolves at the TAIL of the driver's `render()`. Any new
   pointer state must be written there too, or the legacy pass will win.
7. ⛔ **THE COCKPIT PANEL MUST NOT CHANGE.** Two instances (`main.js:4700` vs `:5895`); the gate is
   `activate()`, which `_openCockpitNav` never calls. ⛔ NOT `_bare` — permanently FALSE on the panel.
8. ⛔ **A MISSING GLYPH OR A NULL FIELD FREEZES THE SCREEN.** `PanelHost` catches a painter throw
   ONCE, then stops uploading — the glass keeps showing the last good frame and looks alive. Every new
   field the designs read needs a default in `state.js`.
9. ⛔ **`_autopilotButtonRect` IS A LIVE INVISIBLE BUTTON** that `_handleClick` tests FIRST. The driver
   withdraws it under a mode. Any new interactive rect competes with that ordering.
10. **`git push` on WD fails in-sandbox above ~10MB** — TLS error, then a lying "Everything
    up-to-date". Disable the sandbox and **verify with `git ls-remote`**.

---

## 5. ⛔ THE BROWSER — THREE THINGS THAT COST ME TIME LAST SESSION

`scripts/cdp-driver.mjs` (`evaluate` / `key` / `click` / `shot`) works; Chrome exposes CDP on **9223**
and Node 24 has a native `WebSocket`. Run it with the sandbox disabled. Try the `chrome-devtools` MCP
server first.

1. ⛔ **`window._navComputer` IS NOT THE OVERLAY.** It is whichever NavComputer was CONSTRUCTED last,
   and across boots that was sometimes the **52×43 cockpit panel**. Resolve the instance by canvas:
   ```js
   const c = document.querySelector('.nav-computer-panel canvas');
   const n = [window._navComputer, window._domNavComputer].filter(Boolean)
             .find(x => x && x._canvas === c);
   ```
2. ⛔ **CDP's synthetic click does not reliably land on the splash's mode cards.** Click them through
   the DOM instead — find the `SPAN.splash-mode-name` whose text is `ORRERY`, walk up to its
   `BUTTON.splash-mode-btn`, and call `.click()`.
3. ⛔⛔ **THE SIM CLOCK DOES NOT ADVANCE IN A BACKGROUND TAB, AND THE DRILL ANIMATION RUNS OFF IT.**
   `_updateAnim` uses `simClockMs()`, which only moves on sim ticks, which are rAF-driven. Measured: it
   sat frozen at 1600 ms for the whole session. **So `_anim` never completes and `_handleClick`'s
   `if (this._anim) return;` eats every later click** — which will look exactly like item 3's bug and
   is not it. Pump it in a probe:
   `const m = await import('/well-dipper/src/core/SimClock.js'); m._advanceSimClock(16.667);`

**The walk:** splash → press a key → **ORRERY** (⛔ **not HELM** — in HELM `N` opens the cockpit panel
and there is no overlay) → `N` → `V`. Vite is already on **:5175** serving lane A — ⛔ **do not start a
server**. `NavComputer.js` has no HMR handler, so **reload before measuring**.

---

## 6. THE ARCHITECTURE, IN SIX FILES

```
nav-240p-lab.html                  THE SPEC. Design changes go HERE.
  -> scripts/extract-nav-designs.mjs   generates, --check diffs
src/ui/navViewModes/designs.js     GENERATED. Designs 1 + 2 as a factory over (S, D).
src/ui/navViewModes/state.js       THE ADAPTER. Live NavComputer state -> the lab's S/D shape.
src/ui/navViewModes/index.js       THE DRIVER. Modes, buffer, the render-tail picker, controls.
src/ui/navViewModes/picking.js     Hit-testing over what the paint published.
src/ui/navViewModes/search.js      The drawn search's control half.
src/ui/navViewModes/geometry.js    The last two restatements, now only a fallback.
src/ui/NavComputer.js              LINE-STABLE AT 4711.
```

`S` = `design level lines list sabotage buf cam view sortIdx sortLabel listOffset search
mapProj prismHits bodyHits railTiles listGeom searchGeom tabRects chipRect ladder*`.
`D` = `gm sectors lum nav player playerSector sectorRows stars starRows sys bodies target selStar
selBody sysStar here fail lumCache`.

---

## 7. WORKING WITH MAX — all re-confirmed last session

- ⭐⭐ **"LET ME SEE WHAT YOUR REC LOOKS LIKE" MEANS RENDER IT.** He rules on pictures, not prose, and
  he is right to.
- ⭐ **HE ANSWERS TERSELY AND IN ORDER — NUMBER THE ASKS.**
- ⛔ **HE DOES NOT USE THE BROWSER CONSOLE.** Every A/B he runs is a keypress or a click, and every
  control must be legible on the glass.
- ⭐ **HE REPORTS REAL DEFECTS PLAINLY AND HE IS RIGHT.** Check the running game before disputing.
- ⛔ **NO AFFIRMATIONS.** He opened this feedback with *"overall, very good"* — do not reciprocate.
- **He commits without being asked; he is asked before every `git push`.**

---

## 8. FIRST FIVE MINUTES

1. Read `docs/NOW.md`'s top entry, then this file, then
   `docs/WORKSTREAMS/nav-menu-elements-functional/INTERFACE.md` IN FULL. Capture all four baselines
   (§0) **before touching anything**.
2. **Open the game and walk both designs** (§5 — mind all three browser traps).
3. **Settle §3 item 5 first**: does the map already zoom on a GALAXY→SECTOR drill? It should, and it
   changes how much of his animation complaint is left.
4. **Then diagnose §3 item 3 live** — a second selection at SYSTEM — because three different
   mechanisms could produce it and one of them is a measurement artifact of a throttled tab.
5. **`dev-collab-scope` a new contract**, one AC per item, in his words.
6. Then fan out with subagents on disjoint files, the way `INTERFACE.md` set up last session — it
   worked, and the file ownership table in it is still accurate. ⭐ **Pin a model on every agent call.**
   Start with items 4+7: they are one job, the handlers are already live, and they are what he called
   *"the most work"*.

---

## 9. SUGGESTED SKILLS

- **`dev-collab-scope`** — before any code. This is a multi-AC feature spanning both designs, the
  adapter, the driver and the lab. §8.5.
- **`superpowers:systematic-debugging`** — for item 3 (a second selection is refused) before proposing
  any fix. Three candidate mechanisms, and one of them is an artifact of the throttled sim clock.
- **`superpowers:brainstorming`** — for item 1. "Wasted space at GALAXY" has at least three different
  answers (crop the grid to the sector footprint, draw real sectors instead of galaxy tiles, or change
  the projection), the two designs fail it in opposite directions, and it is a design question for Max
  rather than a fit to be patched.
- **`library-context`** — only if the rotation work reaches for three.js. It does not today; both
  designs are 2D canvas.
- **`verify-workstream`** — after each coherent unit, against the new contract.
- **`handoff`** — at the seam, per `feedback_handoff-at-seam.md`.
