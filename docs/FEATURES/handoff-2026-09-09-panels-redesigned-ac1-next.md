# Handoff — ▶ **THE PANELS ARE REDESIGNED, PASSED AND PUSHED. AC-1 IS THE WHOLE REMAINING JOB.**

> ⚠ **IN-REPO ON PURPOSE.** The handoff skill says "temporary directory"; this project's standing
> convention overrides it, for the reason its predecessors give: `/tmp` does not survive a WSL
> restart.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master).
> ✅ Pushed and verified by `git ls-remote` at **`c65398a`**. Nothing local and unpushed.
> ⛔ Still ASK before any push. ⛔ Hundreds of untracked stray PNGs are normal — **never `git add -A`**.
> ⚠ ALWAYS `npx vitest run --dir tests --root /home/ax/projects/well-dipper`.

---

## 0. WHERE THIS STANDS IN ONE SCREEN

| AC | subject | state |
|---|---|---|
| AC-5 | orbit lines match | ✅ closed |
| AC-6 | HUD + targeting reticle match | ✅ closed, live-verified |
| AC-7 | out-of-game harness stays sharp | ✅ untouched by construction |
| AC-8 | nothing already accepted regresses | ✅ **verified against lane A, not assumed** (§5) |
| **AC-2** | **no panel text below a legible row count** | ✅ **built + PASSED by Max** |
| **AC-3** | **the panels still say what they need to** | ✅ **built + PASSED by Max** |
| **AC-1** | **cockpit drawn at the game's resolution** | ▶ **THE NEXT AND ONLY BUILD** — unblocked |
| AC-4 | nav computer coarsens and stays operable | ⏭ after AC-1 (batch 2 step 4) |
| AC-9 | the whole game reads as 5th gen | 🔵 Max's eye alone, in HELM, after AC-1 |

**Max's UAT, 2026-09-08, against the rendered panels:** *"1. this seems good to me for now"*.
⚠ **A PASS WITH A SHELF LIFE, IN HIS OWN WORDS** — the same ruling carried *"we'll probably switch
this up in the near future"*. ⛔ Do not re-raise it (`feedback_pass-for-now-not-picky`). It reopens
if the panels change or if AC-9 says otherwise.

---

## 1. ⛔⛔ THE RULE THAT NOW GOVERNS EVERY PANEL EDIT

> *"know we'll probably switch this up in the near future so don't get rid of any code that allows
> you to display what we want to display."* — Max, 2026-09-08

**A field comes off the GLASS. It does not come out of the PIPELINE.** Those are different edits and
only the first was ever approved. The whole redesign is built to that shape and it must stay that way:

| long form (untouched, still runs) | short form (added beside it) |
|---|---|
| `INFO_ROWS[].label` / `.format` | `.abbr` / `.brief` — one `read`, two formatters |
| `ALERT_TEXT` | `ALERT_BRIEF` + `briefAlert()` |
| `FlightReadout.speedText` | `.speedValue` + `.tierLine` |
| `READOUT_TEXT.SUBLIGHT` | `.SUBLIGHT_SHORT` |
| `formatSpeedCap` / `formatTurnCap` | **exported and still tested though NOTHING DRAWS THEM** |

⭐ **The test that keeps this honest**: `InfoReadout.test.js` pins the row's exact key set, so a row
that grew a second `read` fails. Two readers is two places a value can come from, which is how the
long and short forms would eventually disagree about the same body.

---

## 2. ▶ THE NEXT BUILD, AND WHY ITS TWO HALVES CANNOT BE SPLIT

`docs/FEATURES/chrome-240p-BATCH-PLANS.md` **batch 2 step 3**. Read §0.5 there first — it carries the
corrected panel→screen map and the column arithmetic.

⛔ **DO NOT LAND `cockpitTarget` ALONE.** The plan's own ordering constraint, and it runs opposite to
intuition: today `cockpitTarget` is full window resolution, so a 512-tall panel canvas is *minified*
and looks fine. The moment it routes through `bufferForLines`, 512 across 43 rows becomes ~12:1
point-sampling and the glyphs disintegrate — and the obvious diagnosis points at the wrong change.
**The panel buffers must drop in the same commit.**

The four edits, with the line numbers verified on `c65398a`:

1. **`RetroRenderer.js:1021`** — `new THREE.WebGLRenderTarget(width, height, …)` → `renderWidth,
   renderHeight` (the locals are already in scope, assigned from `world.width`/`world.height` at
   `:939-940`). The composite samples it as `texture2D(cockpitTexture, vUv)` at `:899` — normalised
   UV, so nothing else moves — and the target is already Nearest/Nearest.
2. **`PanelHost.js:405` + `:472`** — widen `bufferHeightPx` to `number | ((role, metrics) => number)`.
   `role` is already destructured at `:460`, so this is one line, and it is what makes NAV separable
   in step 4. Derive from the **PIXEL** fraction, never the angular one:
   `rows = (metrics.height / distanceFromEye) / (2·tan(fov/2)) · RENDER_BUFFER.height`.
   ⛔ **The eye is PASSED IN, never assumed to be the origin** — `CockpitRig._mountEye:586-597`
   refuses that assumption by name. Consume `RENDER_BUFFER` through `resolveRenderBuffer`; never copy
   its fields (`renderBuffer.js:9-12`).
3. **`PanelPointer.js:255`, `createPanelTexture`** — ⛔ **THE EDIT THAT DECIDES WHETHER ANY OF THE
   REST READS.** It sets `minFilter = LinearFilter` and **no `magFilter`**, so three.js defaults it to
   Linear. Once the buffer is the world grid the panel is *magnified* in every real view (52-74 rows
   as mounted against a 43-row texture) and every hard texel becomes a bilinear ramp of greys **on the
   GPU** — invisible to the one-ink test, which watches `fillStyle`, not pixels.
4. **`CockpitRig.js:851` `setBufferHeightPx`** already remounts and keeps the NavComputer, so
   re-deriving on the `renderLines` and FOV changes hangs off it.

⚠ **`main.js` HAS ~700 LINE-ANCHORED CITATIONS. EDIT WITHIN EXISTING LINES, NEVER INSERT.** Two lines
need changing and both can stay one line: `bufferHeightPx: 512,` at **`:4686`**, and the `panels:`
line at **`:4851`** which must also publish `buffers` — `window._cockpit()` exposes roles only today,
so **AC-2 is unverifiable from the console** and the batch plan's live script cannot run without it.

---

## 3. ⭐ WHAT THE LAST SESSION LEARNED, AND IT IS ALL ONE LESSON

**Every defect found was found by an instrument, and every instrument that found one was reading the
GLASS rather than the painter's own report.**

- **`decodePixelText` was INVENTING TEXT.** Its anchor search scored resolved cells and ignored
  unmatched ones, so an origin on the middle of one line reached into the next and reported runs no
  painter drew. **Every panel assertion in the repo was sitting on that.** It also could not read
  `'1'`, `'-'`, `'.'` or `'--:--'` **at all** — a run's first LIT column is not its cell's left edge
  when the leading glyph is blank down column 0, so those decoded as pure tofu and were then dropped
  silently. Both fixed; the column search is now the exact mirror of the row search that was already
  there. ⭐ If a panel test says a readout is missing, **suspect the decoder before the painter.**
- **TARGET's DIST row overlapped itself** — 3-char label + 8-char value on a 9-char panel. Not a
  clipped string: a smear of half-glyphs. Found only because the decoder returned tofu nobody asked
  about.
- **TARGET's hero was broken before this workstream** — it drew at the display tier, measured a
  probe, and on overflow cleared the WHOLE buffer and redrew one size down, at a size that also did
  not fit.
- **DRIVE could not use the even seven-slot grid at all.** `bar()` draws its pin two hairlines ABOVE
  the frame and its tick two BELOW, so a bar needs NINE rows where a line of type needs five. In a
  six-row slot the pin hit the tier line and the tick hit the throttle frame. DRIVE's rows are stated
  explicitly now, with the arithmetic beside them.

⚙ **The guard that catches all of this now exists** and it is cheap and total —
`panels.test.js`, *"nothing overlaps and nothing leaves the glass"*: every panel, at 240p/480p/720p,
on the pair of screens it **actually lives on**, asserting no ink outside the buffer, no two strings
sharing a texel, and no cell that fails to decode. **It found two more defects on its first run.**
⭐ Extend it to NAV in step 4 rather than writing a new one.

---

## 4. ⛔ TRAPS

1. ⭐⭐ **THE ARITHMETIC WAS RIGHT AND THE INPUT WAS WRONG.** The previous handoff grouped INFO with
   the UPPER pair of screens and reported a 4-character value budget. `PanelLayout.js:53-56` puts INFO
   on `Screen_LL` — the LOWER and WIDER pair — so it gets **5**, and NAV is the panel that drops to 4.
   The method was sound and reproduced the plan's own numbers on the old face; it was pointed at the
   wrong screen. **A number recomputed correctly off the wrong input is more dangerous than no number,
   because it arrives carrying the authority of having been derived.**
2. ⭐ **A HAIRLINE-TALL RECT IS NOT NECESSARILY A FRAME EDGE.** `bar()` insets its fill by `hair * 2`,
   so a bar exactly `5 * hair` tall — which is what a body-sized slot is — has a fill of precisely
   `hair`. Height alone matched four rects where two were expected and a helper threw on a panel that
   was drawn perfectly. The frame edges are the pair that SHARE an x and a width.
3. **TWO FIXTURES WOULD HAVE PASSED VACUOUSLY.** `ctx.measureText = () => ({width: NaN})` no longer
   reaches anything (the kit measures by arithmetic), so it would have gone green while testing
   nothing; and two identical banners at one baseline land on the same texels, which the decoder
   consumes once, so "expect 2 strings" was unreachable **regardless of what the kit did**. Before
   trusting a green test that survived a rewrite, ask what would make it fail.
4. **`Object.freeze` ON A LITERAL IS CORRECT FOR EXACTLY ONE FACE.** `TYPE_UNITS` was frozen numbers;
   `PixelText`'s header promises the faces are switchable so they can be compared in the running game,
   and under literals switching to 5x7 would have drawn seven-row glyphs on six-row leading with the
   layout still believing it was five. It is `typeUnits()` now, read off the live face.

Carried and still live: `preserveDrawingBuffer` is false so `gl.readPixels` on the default
framebuffer returns zeros · backticks inside a GLSL template literal terminate the string ·
⭐ **`main.js` line-anchored citations — edit WITHIN existing lines, never insert.**

---

## 5. THE BASELINE, AND HOW IT WAS ESTABLISHED

⭐ **VERIFIED AGAINST LANE A IN A THROWAWAY WORKTREE, NOT ASSUMED** — the `src` suite has 31 failures
and reasoning that "none of those files import anything I touched" is not a measurement.

| suite | this branch | lane A before the work |
|---|---|---|
| `tests/` | **20 failed / 8 files** | 20 failed / 8 files — the same eight |
| `src/` | 31 failed / 5 files | **31 failed / 5 files — identical** |
| `src/cockpit/` | **662 passed / 0 failed** | (was 23 red on the parked branch) |

The eight: `agent-camera-api`, `driver-pack-giantdeck`, `gas-body-lab-material`,
`lab-shader-perframe-seam`, `moon-condition-contract`, `moon-rng-stream-identity`,
`port-condition-contract`, `relief-octave-lod-ramp`. ⚠ Two worldengine files flake — re-run before
believing a drift.

---

## 6. WHAT IS MAX'S, AND IS OPEN

- **AC-9, the whole-game read.** His eye, in HELM, and **only after AC-1 lands** — until the cockpit
  is on the world's grid there is nothing new to see in the game.
- **Nothing else.** All three content questions are answered and recorded in
  `chrome-240p-BATCH-PLANS.md` §0.6. ⛔ Do not re-open them.

---

## 7. WORKING WITH MAX — carried forward, all confirmed again this session

- ⭐ **HE ANSWERS TERSELY AND IN ORDER** — *"1, okay 2. sounds good 3. let me see what your rec looks
  like"*, then *"1. this seems good to me for now; 2 yes"*. **Number the asks.**
- ⭐ **"LET ME SEE WHAT YOUR REC LOOKS LIKE" MEANS RENDER IT.** He would not rule on a five-character
  budget described in prose and was right not to. ⚠ **AND THE LAB MUST THEN BECOME THE REAL THING** —
  once he ruled and it was built, the hand-drawn proposal was replaced with calls to the shipped
  painters. A drawing sitting next to shipped code is how a lab quietly starts lying.
- ⭐ **A LAB IS THE RIGHT INSTRUMENT HERE, NOT THE LIVE GAME.** `feedback_showcase-by-parking-the-live-game`
  names cockpit features as its own exception, and a character budget is a static property.
- ⛔ **HE DOES NOT USE THE BROWSER CONSOLE.** An A/B he can run has to be a **key**.
- **`localhost:5175/well-dipper/` serves lane A.** ⛔ `welldipper.maxsoweski.com` is master.

---

## 8. FIRST FIVE MINUTES

1. Read `docs/NOW.md` top entry, then this file, then **`chrome-240p-BATCH-PLANS.md` §0.5 and §0.6** —
   the corrected numbers and Max's rulings.
2. Capture the baseline **before touching anything** (§5). ⛔ Do not carry a drift you did not cause.
3. Open `cockpit-panel-budget-lab.html` at `/well-dipper/` to see what the panels are now.
4. Build **batch 2 step 3 as ONE commit** (§2). Its four edits are listed with verified line numbers.
5. Then park Max in HELM at 240p for AC-9 — the first moment there is anything new to see in the game.
