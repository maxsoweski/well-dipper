# Handoff — ▶ **chrome-and-ui-at-240p: AC-6 CLOSED, AC-1 BLOCKED ON A PANEL REDESIGN**

> ⚠ **IN-REPO ON PURPOSE.** The handoff skill says "temporary directory"; this project's standing
> convention overrides it, for the reason its predecessor gives: `/tmp` does not survive a WSL
> restart. Same reason the batch plans were persisted.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master).
> ✅ Pushed and verified by `git ls-remote` at **`74630f6`**. ⚠ **`b3a4edc` (NOW.md) is LOCAL ONLY.**
> ⛔ Still ASK before any push. ⛔ Hundreds of untracked stray PNGs are normal — **never `git add -A`**.
> ⚠ ALWAYS `npx vitest run --dir tests --root /home/ax/projects/well-dipper`.

---

## 0. ⭐ MAX ASKED FOR THIS SESSION TO OPEN WITH A RECAP OF THE RESOLUTION REVISIONS

Do that first, before any tool call beyond reading. He wants the **overall** picture, not a
changelog. The shape that works for him is: goal → where we are → what moved as new capability →
health in plain English → what he must decide. The material is §1–§3 below.

⛔ **Do not open by asking what to work on.** §3 says what is next and §6 says what is his.

---

## 1. THE RULE THAT GOVERNS EVERYTHING — Max, 2026-09-06

> *"I want the whole game to read as a 5th gen game (there are things that are going to be
> anachronistic and I'm totally fine with that, but some things like the resolution are harder
> limits to get that aesthetic); so we simply need to redesign anything that does not read properly
> at this new resolution; if that's true of the in-game hud and nav panels etc. then that's where we
> go next."*

Resolution is not a cost to work around; it is the constraint everything else bends to. A surface
that does not read at 240p gets **REDESIGNED**.

⛔ **"EXEMPT THE TEXT" WAS OFFERED AND NOT TAKEN.** A higher-res panel target, a separate sharp text
pass, a DOM overlay for readouts are all the same rejected move.

**The split:** everything IN-GAME goes to 240p (cockpit, HUD, reticle, orbit lines, body labels, and
the nav computer because in HELM it IS a cockpit panel). The out-of-game harness does not (settings,
title screen).

---

## 2. WHERE THE NINE ACs STAND

`docs/WORKSTREAMS/chrome-and-ui-at-240p/contract.json` is the definition of done.

| AC | subject | state |
|---|---|---|
| AC-5 | orbit lines match | ✅ closed — `OrbitConicField` already worked in `gl_FragCoord`; no change needed |
| AC-6 | HUD + targeting reticle match | ✅ **closed both halves, live-verified** (`3e9d899`, `bf2879e`) |
| AC-7 | out-of-game harness stays sharp | ✅ untouched by construction |
| AC-8 | nothing already accepted regresses | ✅ baseline **20 failed / 8 files** unchanged all session |
| **AC-1** | **cockpit drawn at the game's resolution** | ⛔ **BLOCKED — see §3** |
| AC-2 | no panel text below a legible row count | ⛔ blocked with AC-1; they are one change |
| AC-3 | panels still say what they need to | ⛔ open, and **harder than the plan thinks** (§4) |
| AC-4 | nav computer coarsens and stays operable | ⏭ not started (batch 2 step 4) |
| AC-9 | the whole game reads as 5th gen | 🔵 **Max's eye alone. No agent marks this.** |

---

## 3. ⭐⭐ THE FINDING THAT DEFINES THE NEXT SESSION — MEASURED, NOT ARGUED

**AC-1 cannot land on its own.** In the live game I set `cockpitTarget` to the world buffer and
photographed both states:

- The cabin, bezels and ribs land correctly on the world's grid — **AC-1 working**.
- **In the same frame** the INFO panel becomes a column of grey mush and DRIVE loses everything below
  its speed number.

Cause: `PhosphorScreen` sizes type as *fractions of panel height* and draws it with a vector font.
At the game's resolution a panel is ~43 rows, so body text gets 2–5 pixel rows and stops being text.
**AC-1 and AC-2 are one change.** The batch plan said so; the screenshots confirm it.

### The kit conversion is done and PARKED

`wip/cockpit-kit-bitmap-face` (head `b7dd0b8`, already merged up to `74630f6`).

- Converted: integer grid instead of five independent ratios, bitmap face, absolute texel floor,
  `hair` = one grid unit. **No panel file was touched** — the panels only consume `screen.type.*`
  and `screen.text()`.
- ⛔ **23 tests still red there**, all encoding the *vector* contract: that the kit sets `ctx.font`,
  sets `textAlign`/`textBaseline` on every draw, measures under the font it is about to draw with,
  that `TYPE_RATIOS` are fractions of height, that leading is 1.4× body. Every one of those
  mechanisms is deliberately gone.
- ⭐ **Max's steer, 2026-09-07:** *"don't spend too much time here, my guess is we will substantially
  redesign these panels in the near future."* → **land this WITH the redesign**, which rewrites those
  tests anyway. Rewriting them twice is the waste. This is why it is parked and not merged.

### `decodePixelText` is the asset on that branch

Reads strings back OUT of drawn texels, so panel assertions stay **at the glass** rather than
becoming a painter self-report — which is what this lane refuses everywhere else. It took the
cockpit suite from 46 red to 25 on its own. It has two hard-won behaviours: **multi-anchor** (an
all-lowercase run's first lit row is its x-height, not the cell top) and texel consumption.

---

## 4. ⛔ THE FONT CHANGE INVALIDATED THE BATCH-2 COLUMN ARITHMETIC

`docs/FEATURES/chrome-240p-BATCH-PLANS.md` is still the plan of record, and its **row** maths holds
(both faces are 5 rows tall, so DRIVE still totals 43 rows exactly). Its **column** maths does not.
The shipped face is 6 texels per character where the 3×5 was 4:

| | plan assumed | actual on the 5×5 face |
|---|---|---|
| DRIVE / INFO (upper, 51.41 cols) | 12 chars | **8** |
| TARGET / NAV (lower, 55.28 cols) | 13 chars | **9** |

A row is a 3-char label hard-left and its value hard-right, so **values get about 4 characters**.
`co2-n2 0.85 bar` is impossible in any form. The plan's line *"INFO keeps all seven fields… nothing
comes off, so there is nothing to ask"* was written against 12 columns and **is no longer true**.
The seven rows survive; their values do not.

⭐ **So the content question moved.** It is no longer "which fields come off" but "what can a field
say in four characters". Max has been told this and has not answered it.

⚠ Verify the 8/9 figures before designing on them: `(W - 2·pad + 1) / FACE.advance`, with W from the
head-on projection in the plan's §0. My arithmetic reproduces the plan's 12 exactly on the old face,
which is what validates the method.

---

## 5. ⭐ THE LESSON OF THE SESSION, AND IT COST REAL WORK

**A measurement of MY OWN DRAFT is not a measurement of the design space.** Four times:

1. I reported 5×5 as "disqualifying — S/5, 6/8 and 8/9 blur, a false economy". Redrawing six glyphs
   beat the 5×7 on the same gate. **Max's "make it 30% smaller" is what exposed it.**
2. I nearly reported that a 5-row cell cannot carry lowercase — first draft scored eight confusable
   pairs, a/e and u/v one pixel apart. Redrawing eight glyphs took it to three. Caught before saying.
3. The 3×5 face I authored had **twelve** confusable pairs, M/N one pixel apart of fifteen. The
   defect was CELL WIDTH, not resolution — which is why it looked fine in a spec and wrong on screen.
4. I followed a batch-plan instruction that was actively wrong (§7 trap 1) without rendering the
   result.

⚙ The gate that makes this checkable now lives in `tests/pixel-text.test.js`: it renders every glyph
through the real `drawPixelText` and counts pairs within 2 lit pixels. **Every allowance is listed
with a reason.** A new entry means a glyph needs redrawing, not that the expectation needs widening.

---

## 6. ⛔ WHAT IS MAX'S, AND IS STILL OPEN

Mechanism is ours; what a panel **stops saying** is his. Full argument in the batch plans §4.

- **(a) Can `CAP` and `TURN` come off the DRIVE screen?** Recommendation is to cut both — CAP's real
  job is already drawn as the drop tick on the speed bar. Neither of us has flown by them.
- **(b) When locked onto a planet, what does TARGET shout?** It prints the full designation today and,
  when that overflows, redraws it *below the legibility floor* — so that panel is broken **now**,
  before any of this.
- **(c) NEW, and he has not answered it: is a ~4-character value acceptable on an INFO row?** (§4.)
  If not, the levers are the panel's screen fraction or a narrower face — worth knowing *before*
  designing content around a budget he would reject.
- **AC-9** — the whole-game read. His eye, never an agent's.

---

## 7. ⛔ TRAPS — THE FOUR THAT COST TIME THIS SESSION

1. ⭐⭐ **THE BATCH PLAN CONTAINS AN INSTRUCTION THAT IS ACTIVELY WRONG.** It says the reticle's
   `vx = ox + sx * PX` is "one block outward, contradicting its own comment and the ASCII art" and
   prescribes moving it inward. **The ASCII art was wrong and the outward step WAS the rounding.**
   Applied as written every bracket corner becomes a **T**; Max caught it on sight. Now flagged in
   `chrome-240p-BATCH-PLANS.md` **§3.5 item 2** — read that section before touching `_drawBrackets`.
   ⭐ General form: a plan noting that a comment and its code disagree tells you one of them is
   wrong, **not which**.
2. ⭐ **VACUOUS SCANS.** I grepped `src/cockpit/NavComputer.js` and read the zeros; the file is at
   `src/ui/NavComputer.js`. A scan over a file that is not there reports zero problems — the most
   dangerous possible pass. The coverage test now `existsSync`-guards every path and has a
   non-vacuity case; that guard immediately caught `AlertCue.js` listed under the wrong directory.
3. ⭐ **THE WRONG INSTRUMENT READS PLAUSIBLY.** "Count semi-transparent pixels" proved the HUD had no
   antialiasing — and is meaningless on the reticle, whose inks are deliberately `rgba(…, 0.45)`.
   The right instrument there was *how many distinct alpha values exist* (2, both declared inks).
   Before believing a number, ask what it is actually the length of.
4. **A ZERO CAN BE VACUOUS.** `_cabinMaskCoverage()` returned 0 and it meant "no cockpit is up", not
   "the cut broke". Check `window._cabinMask()` → `hasCabin` first.

Carried and still live: `preserveDrawingBuffer` is false so `gl.readPixels` on the default
framebuffer returns zeros · backticks inside a GLSL template literal terminate the string ·
`~700 line-anchored citations ride `main.js` — edit **within** existing lines, never insert.

---

## 8. WORKING WITH MAX — what this session demonstrated

- ⭐⭐⭐ **HIS EYE FINDS THE CLASS IN ONE LOOK, THREE TIMES.** "the reticle no longer reads like the
  same shape at all", "when it's selected it gets too bold to read properly", "this font is no longer
  a good fit for this resolution". Each was real, each was mine, and in each case the *cause* was not
  what the words named — the font one was cell WIDTH, not resolution. **Take the report as precise
  and go find the mechanism; do not fix the surface he described.**
- ⭐ **HE ANSWERS TERSELY AND IN ORDER** — *"1 sounds good… 2. I'd prefer…"*. **Number the asks.**
- ⭐ **HE GENERALISES RATHER THAN RETREATING.** Bring him the corrected number; do not soften it.
- ⭐ **"WHERE CAN I SEE IT" MEANS THE RUNNING GAME.** `localhost:5175/well-dipper/` serves lane A.
  ⛔ `welldipper.maxsoweski.com` is master and has none of this.
- ⛔ **HE DOES NOT USE THE BROWSER CONSOLE.** An A/B he can run has to be a **key**.
- **He is testing live while you work.** Open your own page; close it when done.

---

## 9. LIVE-VERIFICATION NOTES (they cost time to rediscover)

- Getting into the cockpit from a fresh page: click `#splash-screen` → `_lab.enterSol()` → dismiss
  `#title-screen` (**dispatch a `keydown` AND click it**; `press_key` alone did not always take) →
  press `m` for HELM. `_lab.frameBody({name:'Earth'})` takes an **object**, not a string.
- `_lab.spawnProceduralSystem` skips real system entry, so the minimap and cockpit are unreachable
  from it. `_lab.enterSol()` is real entry. ⚠ Sol is NASA-textured and cannot validate procgen — but
  it is fine for reticle/cabin/panel work, which is renderer-independent.
- The chrome-devtools `resize_page` **did not resize this browser window** (pinned 2023×1023). That
  is why `AC-MASK-AGREES-WITH-THE-ORACLE`'s absolute half is unclosable here: its 0.587202 is a
  **16:9, head-centred** figure. Its portable half — agreement with same-session
  `_cockpitOcclusion()` — held at 0.0063.
- ⚠ **RELOAD before measuring** in any session where `src` was edited.

---

## 10. SUGGESTED SKILLS

- **`dev-collab-scope`** — ⭐ **the right next move if Max greenlights the cockpit redesign.** It
  spans the kit, four panels and the nav computer, which is squarely this project's 2+ systems rule.
  It is an interview, not a build. ⛔ Do **not** re-scope `chrome-and-ui-at-240p` itself; that
  contract exists and he greenlit it.
- **`superpowers:systematic-debugging`** — if a live check disagrees with the plan. Most of this
  session's wrong turns were instruments, not code.
- **`verify-workstream`** — at the END of a batch, not per step.
  `Workflow({scriptPath:"/home/ax/projects/personal-os-improvements/dev-collab/workflows/verify-workstream.mjs", args:{contractPath:"docs/WORKSTREAMS/chrome-and-ui-at-240p/contract.json", mode:"full", liveBranch:"main"}})`
- ⛔ **NOT `library-context`** — a three.js brief was generated for this project on 2026-09-06.
- ⛔ **NOT `brainstorming`** — the direction is settled; §6 is decisions, not exploration.

---

## 11. FIRST FIVE MINUTES

1. Read `docs/NOW.md` top entry, then this file, then the contract's nine ACs.
2. **Give Max the overall recap (§0).** It is what he asked this session to open with.
3. Capture the test baseline **before touching anything** — `20 failed / 8 files`, the same eight:
   `agent-camera-api`, `driver-pack-giantdeck`, `gas-body-lab-material`, `lab-shader-perframe-seam`,
   `moon-condition-contract`, `moon-rng-stream-identity`, `port-condition-contract`,
   `relief-octave-lod-ramp`. ⚠ Two worldengine files flake intermittently — re-run before believing
   a drift.
4. Put §6 in front of him — (c) is the one he has not answered and it gates the redesign's shape.
5. ⚠ `b3a4edc` (NOW.md) is unpushed. Ask before pushing.
