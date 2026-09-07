# Handoff — ▶ **AC-16's LIVE CONFIRMATION IS THE PICKUP. EVERYTHING ELSE HERE IS CONTEXT.**

> ⚠ **IN-REPO ON PURPOSE.** The handoff skill says "temporary directory"; this project's standing
> convention overrides it, for the reason its predecessors give: **`/tmp` does not survive a WSL
> restart**, and this file has to outlive one.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master).
> ✅ **Everything is PUSHED** — verified by `git ls-remote` at **`543b709`**. Zero unpushed.
> ⛔ Hundreds of untracked stray PNGs/JPEGs are normal — **never `git add -A`**.

---

## 0. THE INVOCATIONS, AND THE BASELINE THEY MUST REPRODUCE

```
npx vitest run --dir tests       --root /home/ax/projects/well-dipper   # 20 failed / 8 files  (EXPECTED)
npx vitest run --dir src/cockpit --root /home/ax/projects/well-dipper   # 698 passed
npx vitest run --dir src/ui      --root /home/ax/projects/well-dipper   # 527 passed / 28 files
node scripts/extract-nav-designs.mjs --check                            # designs.js vs the lab
wc -l src/ui/NavComputer.js src/main.js                                 # 4711 / 15161, BOTH FROZEN
```

The eight expected `tests/` failures, by name — anything else is yours: `agent-camera-api`,
`driver-pack-giantdeck`, `gas-body-lab-material`, `lab-shader-perframe-seam`,
`moon-condition-contract`, `moon-rng-stream-identity`, `port-condition-contract`,
`relief-octave-lod-ramp`.

⭐ **AND MEASURE THE TREE AROUND ANY SUITE RUN YOU INTEND TO BELIEVE.** Last session had three
agents writing one working tree, and one of them correctly **discarded a run** because a test file
was rewritten 33 seconds into it. `md5sum` the files before and check after, or serialise the lanes.

---

## 1. WHERE THIS STANDS — read these, don't re-derive them

| artifact | what it holds |
|---|---|
| `docs/NOW.md` top entry | the session summary, Max's rulings in his own words |
| `docs/WORKSTREAMS/nav-screens-close-pass/contract.json` | **17 ACs, each with a `progress` note carrying the live measurement.** This is the source of truth for what is and is not done |
| `…/intent.md` | Max's verbatim feedback — the whole scope |
| `…/INTERFACE.md` | the three-owner seam: field names, fold targets, the traps |
| `…/MEASUREMENTS.md` | everything measured off the running game, **including §8, where I correct my own §7** |
| `…/review.html` | three flip A/Bs, served at `/well-dipper/docs/WORKSTREAMS/nav-screens-close-pass/review.html` |
| `…/shots/` | the pictures Max ruled on |

**Seven of Max's eight items are built and verified live.** He has approved both pictures:
*"That's better, I like the after version better"* and *"looks good to me."*

---

## 2. ▶ THE PICKUP — AC-16, AND WHY IT IS NOT GREEN

Max's ruling set the bar: *"I want the nav screen to reflect the actual orientation of the planets
in the game."* **Planets move.** `main.js:7875` COPIES `orbitAngle` into the scene entry as a
number, and from then on the sim advances only the copy (`:11358`). The nav is handed
`system._systemData` — the raw generation data, and `:7950`'s own comment says so — so the orrery
was drawing a permanent snapshot of opening day.

**The fix is in and mutation-proved headlessly.** Two halves, and either alone *looks* fixed:
- `entry._live = planets[planets.length - 1]` folded onto **`main.js:7878`** (count still 15161).
- A **per-frame angle refresh** in `state.js`, because `buildBodies` runs ONCE PER SYSTEM
  (generating ~39 names is not cheap) and would freeze the live value straight back.
- Pinned by `navPicking.test.js` → *"⭐⭐ THE ORRERY TRACKS THE PLANET AS IT ORBITS"*. Mutants:
  removing the refresh fails with *"the orrery froze"*; ignoring `_live` fails with *"read the
  frozen generation angle"*.

⛔ **BUT THE LIVE CHECK COULD NOT EVEN RUN, AND THAT IS THE INTERESTING PART.** Driving the game:
`nav._systemData.planets[0]._live` was `undefined` — and so was **`window._systemData`**
(`main.js:7588`). **`spawnSystem` had never run.** In the ORRERY boot state the ship is in deep
space with no system spawned, `nav._currentSystemData` is null, and `NavComputer.js:2458` falls
through to `resolveArrivalSystem` — **so the SYSTEM screen is drawing a system the nav generated
for itself.** There are no in-game planets to track, so the requirement has no referent there.

**▶ DO THIS FIRST:** get into a genuinely spawned system (select a body, commit the BURN/WARP —
`_commitAction` was `null` in my attempt because nothing was selected), then re-run the sample:
does a fast inner planet's mark travel around its ring over ~6 s, and does `_live` exist at all?
⛔ **Do not mark AC-16 green on the headless proof.** This workstream opened on a green test that
pinned nothing, and that is the whole lesson.

⚠ **A SECOND QUESTION FALLS OUT OF IT, AND IT MAY BE THE REAL ONE:** if the SYSTEM screen routinely
draws a *self-generated preview* rather than the spawned system, then "the actual orientation" is
only ever true for the system you are actually in. That may be correct by design — you browse other
stars from the nav — but nobody has decided it out loud. Worth putting to Max as a question, not
patching silently.

---

## 3. WHAT ELSE IS OPEN, IN THE ORDER I'D TAKE IT

- **AC-2 — "anything on screen should be clickable."** Fully inventoried, not built. The published
  rectangles are already named in `INTERFACE.md §6` (`S.pagerRect`, `S.yGaugeRect`, `S.minimapRect`,
  `S.orbitRings`, `S.locatorRect`, `S.listHeaderRects`, `S.companionRect`). ⭐ `S.labelHits` already
  shipped and is the worked example of the pattern.
- **AC-5's GALAXY half.** The highlight works at SECTOR (held through the whole zoom, cleared on
  landing) but **not at level 0, which is the level Max named**. The clicked cell is *not* the drill
  target there — the identity is the containing sector, 1 of 775 and irregular, and the zoom flies
  to its own centre and size — so framing the cell would have the glass promise the wrong
  destination. It needs the **sector's own rect published out of the paint**.
- **AC-9 — grabbable indicators.** The prism's y-gauge (`d1Prism`) publishes no rect at all today.
- **AC-6's inbound half.** 2D→PRISM/SYSTEM still snaps. The outbound half eases. Inbound needs the
  DESIGN to keep drawing its 2D map while the frame closes — a **lag in `S.level`**, inside
  `navViewModes/`. ⛔ Animating the legacy painter instead moves pixels nobody can see.
- **Design 2's GALAXY crops 20 of 775 sectors off the glass** (`kind:'wide'`, band ±11.54 kpc). Not
  touched — it is the opposite defect from design 1's and wants its own answer.
- **`d1Prism` drops up to 4 of 8 index tags in its worst frame** (106 of 120 frames drop none). The
  lever, if Max ever objects, is a third candidate column — not relaxing the mark test.

---

## 4. ⛔ THE TRAPS. ALL STILL LIVE.

1. ⭐⭐⭐ **`NavComputer.js` IS FROZEN AT 4711 LINES AND `main.js` AT 15161**, so new statements are
   FOLDED onto existing lines — and **a `//` comment mid-line comments out everything after it**.
   Every folded comment must be `/* */`, terminated. **Poisoned (end in `//`): 586, 4345, 4370,
   4420, 4442, 4496.** Clean: 4348, 4349, 4355, 4361, 4373, and all of `_handleMouseDown`/`Up`
   (4396-4416). The keyboard fold line is **349**.
2. ⭐⭐ **A GREEN TEST THAT DRIVES NO INPUT PINS NOTHING.** Ask of every one: *what input in its
   sample could make this fail?* Then **mutate the fix and watch it go red** — that is the standard
   this session held to and it caught real gaps.
3. ⭐⭐ **`designs.js` IS GENERATED. A design change goes in `nav-240p-lab.html`**, then
   `node scripts/extract-nav-designs.mjs`; `--check` diffs.
4. ⭐ **GEOMETRY COMES OUT OF THE PAINT.** `S.labelHits` is the newest example — `plated()` returns
   the rect it drew. Restating a layout in a hit-test is the AC-4 defect shape.
5. ⭐ **BRANCH ON A PUBLISHED `kind`, NEVER ON THE SHAPE OF `ref`.** "It has a `seed`, so it must be
   a star" is the same restatement one level down. `picking.js` does this correctly now.
6. ⛔ **`S` AND `D` ARE MUTATED, NEVER REPLACED.**
7. ⛔ **A NULL FIELD FREEZES THE GLASS AND IT LOOKS ALIVE.** `PanelHost` catches a painter throw
   ONCE, then stops uploading. Four `D.playerSector` derefs were fixed for exactly this; every new
   field a design reads needs a default in `state.js`.
8. ⛔ **THE LEGACY RENDERER STILL RUNS UNDER EVERY MODE FRAME ON PURPOSE** — it is also the lazy
   loader — and it rewrites all three hover fields every frame, which is why hover resolves at the
   **tail of the driver's `render()`**.
9. ⛔ **THE COCKPIT PANEL MUST NOT CHANGE.** The gate is `activate()`, never `_bare`.
10. **`git push` fails in-sandbox above ~10MB** — TLS error, then a lying "Everything up-to-date".
    Disable the sandbox and **verify with `git ls-remote`**.

---

## 5. ⛔ THE BROWSER — what actually worked

`chrome-devtools` MCP works; the game is on **:5175** (lane A). ⛔ **Do not start a server.**

1. ⛔ **`window._navComputer` IS NOT NECESSARILY THE OVERLAY.** Resolve by canvas:
   ```js
   const c = document.getElementById('nav-computer-canvas');
   const n = [window._navComputer, window._domNavComputer].filter(Boolean).find(x => x._canvas === c);
   ```
2. ⭐ **FOREGROUND THE TAB** (`select_page` with `bringToFront: true`). The sim clock is rAF-driven;
   backgrounded it freezes and `_handleClick`'s `if (this._anim) return;` then eats every click,
   which looks exactly like a selection bug. Foregrounded it ran at 1000 ms/s and the trap never
   fired.
3. **The walk:** splash → **ORRERY** (click the `BUTTON.splash-mode-btn` through the DOM) → a key to
   dismiss the title → `N` (sometimes twice) → `V` cycles `null → rail → bars`.
4. ⛔ **RELOAD BEFORE MEASURING.** `NavComputer.js` has no HMR handler, and an agent regenerating
   `designs.js` will hot-reload the page under you mid-measurement.
5. ⭐ **A PIXEL HASH OF THE NAV CANVAS IS NOT A STABLE INSTRUMENT** — two consecutive frames with no
   input already differ. Use the **published geometry** (`S.prismHits`, `S.bodyHits`, `S.labelHits`)
   and always run a **liveness control** beside the probe.

---

## 6. WORKING WITH MAX — re-confirmed all session

- ⭐⭐ **HE RULES ON PICTURES.** `review.html`'s **flip** A/B is what worked — side-by-side makes the
  eye hunt; flipping one image in place hands him the difference. Build the instrument, don't
  describe the change.
- ⭐ **HE ANSWERS TERSELY AND IN ORDER — NUMBER THE ASKS.** ("1 push 2 looks good to me")
- ⛔ **HE DOES NOT USE THE BROWSER CONSOLE.** Drive everything yourself.
- ⭐ **HIS RULINGS OFTEN WIDEN SCOPE, AND HE IS RIGHT.** I scoped the galaxy fix to "hide the dead
  cells, move nothing"; he ruled *"redraw the cells from there"* — the better answer. **Don't
  present a risk-minimising default as if it were the goal.**
- ⭐ **SAY WHAT YOU GOT WRONG.** I told him the numerals were overlapping each other; measured, they
  were overlapping the *planets*. Correcting that mattered more than the fix.
- **He commits without being asked; ask before every `git push`.**

---

## 7. SUGGESTED SKILLS

- **`superpowers:systematic-debugging`** — for AC-16's live confirmation. There are at least two
  live hypotheses (no spawned system at all vs. the nav using a self-generated preview by design)
  and they want separating before anything is changed.
- **`dev-collab-scope`** — only if AC-2 is taken as a unit; it spans both designs, the lab, the
  adapter and the picker. The existing contract may just be extended instead.
- **`verify-workstream`** — against `nav-screens-close-pass/contract.json` after each coherent unit.
- **`library-context`** — only if anything reaches for three.js. The nav is 2D canvas; it does not.
- **`handoff`** — at the next seam.
