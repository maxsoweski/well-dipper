# Handoff 2026-08-26 — ▶ TWO FREQUENCY PROBLEMS, AND MAX HAS ALREADY RE-FRAMED BOTH

**HEAD** `7cb2fec` · **Branch** `feature/world-engine-production-L1` · **tracked tree clean**
**Repo** `~/projects/well-dipper` (lane A's branch, **NOT** master) · lab at **6559 lines**
⛔ **~700 untracked PNGs are normal. NEVER `git add -A`.**

> ⚠ **`/tmp` DOES NOT SURVIVE A WSL RESTART** — that cost a session on 2026-08-25. The durable copy of
> this document is committed in-repo at `docs/FEATURES/handoff-2026-08-26-frequency-and-lod.md`.
> Read that one.

---

## 0. STATE — everything is pushed, and the merge is LIVE

Nothing is pending. `origin/feature/world-engine-production-L1` = `7cb2fec`; `origin/master` =
`9f141e5`; the site at `welldipper.maxsoweski.com` serves the merged build. The 2026-08-25 session
closed the import-back ledger to **2** (Max's merge gate), merged 790 commits to master as a clean
fast-forward, and fixed the deploy's dependency on a second repo. All of that is history — see
`docs/FEATURES/handoff-2026-08-25-merge-gate-reached.md`.

⛔ **DO NOT push `master`** without asking. It AUTO-DEPLOYS (`.github/workflows/deploy.yml` is
`on: push branches [master]`, no staging step).

---

## 1. ⭐⭐ READ MAX'S FRAMING BEFORE YOU READ THE DIAGNOSIS

Both problems were found by Max flying the lab's new bare-key A/Bs. He corrected the previous
session's framing on **both**, and his corrections are better. Do not re-derive the old framing.

**On terrain frequency**, 2026-08-26 — after the previous session proposed re-anchoring the law so the
curve fits what renders:

> *"I don't want to do this too haphazardly; that frequency might be right up close, and the issue
> might be that our LOD system isn't working with it properly. Or: rather than making the curve move
> to the renderable range, should we widen the renderable range to include the curve? This needs real
> attention."*

⛔ **The previous session proposed bending the physics to fit the renderer WITHOUT FIRST CHECKING
WHETHER THE RENDERER IS THE BROKEN HALF.** That was the error. Max's question — *is the frequency
right and the LOD wrong?* — is unanswered and is the actual first task.

**On crater density**, same message:

> *"the issue is not that craters CAN render at that scale, the issue is just the frequency. Maybe at
> the upper end of the possibility spectrum you could have a planet that is so cratered it looks
> carpeted, but most planets should have way less frequency than that."*

⭐ So a carpet is a LEGITIMATE EXTREME. The defect is the POPULATION — far too many bodies land at
the top. Do not "fix" it by capping the maximum.

---

## 2. THE INSTRUMENTS THAT FOUND THIS — three bare keys in the lab

`world-engine-lab.html`, badge at top-centre. **A is always the unpressed page-load arm (what ships
today); B is what the key flips to.** Every arm prints its own `A ·` / `B ·` marker.

| key | A (on load) | B (pressed) |
|---|---|---|
| `G` | RADIUS-AWARE — driver pack #2 (adopted) | RADIUS-BLIND — the old lab arm |
| `N` | LAB 4.0 (factory, never set) | **SHARED WAVELENGTH LAW** |
| `E` | LAB (amp/lump are sliders) | PORT FAMILY (strength+amp+lump) |

⚠ `[N]` is only visible on the tidally-heated presets — **Lava, Magma, Europa**. Everywhere else both
arms sit at 2.9–4.0 and the key reads as broken. Max confirmed: *"A and B for N both look fine"* on
Moon/Frozen, *"B looks messed up"* on Lava.
⚠ `[E]` forces `state.ejectaEnabled` on, because it is false on all 13 presets by default and both
arms would otherwise be blank.

**Server:** already running at `http://localhost:5173/well-dipper/world-engine-lab.html`. If not,
Max runs `npm run dev` in `~/projects/well-dipper` — ⛔ Claude must never start it.

---

## 3. ▶ PROBLEM 1 — TERRAIN FREQUENCY vs THE RENDERABLE RANGE

### What is actually shipping

⛔⛔ **THE SHARED WAVELENGTH LAW IS NOT A PROPOSAL. IT IS LIVE IN THE GAME TODAY.** Verified, not
assumed: `ROCKY_SURFACE_LAB_OWNED` (`src/worldengine/drivers/rockySurface.js:534`) is
`['uPerturb', 'uCraterScale']` — `uNoiseScale` is **not** on it, so `writePackUniforms` writes it
straight to the game's material. With `LAB_GAS_BODIES_DEFAULT = true`
(`src/objects/Planet.js:2158`, "846 of 852 planets and 632 moons"), every admitted non-gas body
renders arm B. **The lab was the last place still showing the smooth 4.0**, which is why nobody had
seen this until 2026-08-26.

### The measured distribution

Over 520 non-gas preset body-seeds, under the GAME display policy
(`tools/` — the probe is reproducible from `macroWavelengthKm` + `featureFrequencyFromKm`):

```
min 2.87   p50 2.94   p90 250.72   max 251.00      MACRO_FREQ_CEIL = 251.03
```

⚠ **The bimodality is the PRESET CORPUS, NOT A CLAMP — do not repeat the previous session's
near-miss.** The counts above 10, 25, 50, 100 and 200 are all identical (120 = 3 tidal presets × 40
seeds), which looks like saturation but is not: `macroShortening` is monotone and deliberately
UNCLAMPED at the hot end (`src/worldengine/base/macroWavelength.js` argues at length that clamping
would collapse the 67 hottest moons onto one value — the exact pathology B2 leg 1 removed). The real
corpus is continuous: that file records 985 distinct values over 1160 non-gas bodies.

Per-preset medians: Magma 251.0, Lava 250.7, Europa 219.0 — everything else 2.9–3.1.

### ⭐⭐ THE ASYMMETRY THAT IS PROBABLY THE ANSWER

**Craters already have a screen-resolvability floor. The macro wavelength law has none.**

`src/worldengine/port/craterUniforms.js:65-71` states its rule and does the arithmetic:

> *"THE SMALLEST CRATER THE SHADER DRAWS … MUST SPAN >= 4 RENDER px AT THE CLOSEST MEASURED APPROACH
> FRAMING. Why 4: 2x Nyquist, because a crater has to show bowl AND rim to read as one, not merely be
> detected."* — camera 1.2 body radii, 1600×999 dpr1 ⇒ disc radius 1078.23 screen px **÷ pixelScale 3**
> ⇒ `CRATER_VIS_FLOOR_RAD = 9.6e-4`.

Nothing equivalent gates `uNoiseScale`. The law emits a physical wavelength and the writer resolves
it at a display radius — and no step anywhere asks whether the result survives to pixels.

⭐ **THAT GIVES A PRINCIPLED WAY TO ANSWER MAX'S QUESTION INSTEAD OF PICKING A NUMBER BY EYE:** derive
a macro-wavelength floor from the SAME stated rule and the SAME framing arithmetic, and see where it
lands against the law's 251 ceiling. If the ceiling is far above the floor, the curve is
unrenderable *by the project's own established criterion* and that is a measurement, not taste. If it
is close, the LOD half below is the culprit.

### The LOD half — Max's other hypothesis, and it is a KNOWN OPEN ITEM

⛔ **Relief is FRAGMENT-SIDE, not vertex displacement** — `src/objects/Planet.js:1573` says so
explicitly ("relief is fragment-side, and tessellation does not change [it]"). So mesh vertex count
is NOT the binding constraint and a Nyquist-on-the-mesh argument is wrong. The constraint is screen
pixels across the disc, divided by `pixelScale` (3 — the lo-fi renderer, `RetroRenderer.js:811`).

The octave ramp is the other half, and it is already a tracked defect:

- `lodRampOf = smoothstep(20.0, 6.0, distanceRadii)` and `autoOctaves = mix(4, 9, lodRamp)`
  (`src/worldengine/base/labCore.js:19-27`), imported by BOTH front-ends.
- ⛔ **THE RAMP SATURATES AT 6 BODY RADII.** From 6 radii to the 1.05 floor the disc grows ~6× in
  angular size with the octave budget pinned at 9. Nothing new resolves.
- That is exactly Max's standing acceptance criterion — memory `well-dipper-approach-lod-criterion`:
  *"getting closer and closer to a planet, as opposed to … a beach ball painted to look like a
  planet."* Its SHAPE half closed at `77fff7f`; **its APPROACH-DETAIL half is NOT closed.**

⚠ Note the direction of that ramp: it adds octaves (finer detail) on approach. A field whose OCTAVE 0
is already past pixel Nyquist is not helped by more octaves — so "widen the renderable range" may
mean pixelScale, disc framing, or an anti-aliased/level-limited noise evaluation, not more octaves.
**Verify before building.**

### What the previous session already fixed here (do not re-fix)

`f299b3e` — the `[N]` instrument was resolving the wavelength at the lab's INFLATED display radius
with no display multiply, wrong by exactly `1/R`: invisible at Earth size, 3.1× on Lava, producing
444 against a law whose ceiling is 251. Now matches `:5358`'s convention (physics at REAL radius,
display multiply at the write). ⛔ **THE SYMPTOM PERSISTS AT THE CORRECTED VALUE** — Lava still
speckles at 141.6 written / 250.7 physical. That is the open problem, not the fixed one.

---

## 4. ▶ PROBLEM 2 — CRATER DENSITY: THE POPULATION, NOT THE MAXIMUM

### Measured

`tools/` probe over 104 non-gas preset body-seeds:
- craters fire on **42**;
- of those, `density` is at exactly **1.0 on 32 — 76%**;
- density 1.0 means **every voronoi cell hosts a crater**: ~6545 craters across the visible face at
  the game policy, ~1800 on Moon/Mercury at the lab's;
- and every crater is drawn from `mix(0.18, 0.55)` — a **3.06× size band with no size-frequency
  distribution at all**.

Saturated coverage plus one narrow size band is a carpet by construction, and it matches Max's words
exactly.

### The two sub-problems, and they are separable

1. **The clamp.** `craterUniforms.js:141` — `clamp01(coverageBand(...) / RENDERED_CELL_COVERAGE)`.
   The law asks for more coverage than one-crater-per-cell can express and the clamp silently
   absorbs the excess, so 76% of bodies land on the same value. ⭐ **This is the "frequency" Max
   means.** A body at the extreme SHOULD reach a carpet; three-quarters of them should not.
2. **No SFD.** The synth draws one crater per hosted cell at a hashed size in a 3× band. Real
   cratered ground is power-law: a few large, many small. Without that, even an un-saturated density
   reads as repetition.

⚠ **PRE-EXISTING, NOT CAUSED BY THE RECENT WIRING.** `:2854` has sourced density from
`craterUniformsFrom` since 2026-08-22, and the 2026-08-25 seam probe measured mirror ≡ inline on
104/104 solid rows. ⚠ BUT the crater SHAPE fix (`57e5fed`, d/D made size-invariant) plausibly made
the uniformity MORE legible — small craters used to be up to 3× deeper relative to width, which read
as variety. Say so rather than let it look like a regression.

### ⛔ The third A/B is still unbuilt, and it belongs to THIS work

`[J]` crater size — `CRATER_VIS_FLOOR_RAD` 9.6e-4 (shipped) vs 3.823e-3 — was deliberately not wired.
That floor is a module constant read inside `craterUniformsFrom`, so an A/B needs it threaded as a
display-policy field through `craterDriverBlock` and both packs' ctx: three shared signatures. Max
agreed to fold it into this crater work rather than wire it separately. ⭐ Note it is the SAME
screen-resolvability rule §3 wants to borrow for the wavelength — do these together.

---

## 5. TRAPS FROM THE LAST SESSION — every one of these bit, some more than once

1. ⛔⛔ **APPEND-PAST-A-COMMENT KILLED CODE THREE TIMES IN ONE SESSION.** `world-engine-lab.html` stays
   LINE-NEUTRAL (500+ line-anchored citations at/past `:1933`), so edits append to existing lines —
   and three times the new statement landed after that line's trailing `//`, inside the comment,
   dead. A uniform write at `:5359`, a stash at `:2879`, and the entire `craterDeckPack` call at
   `:2880`. **THE RULE, now written into `:2880` itself: every statement goes BEFORE the first `//`;
   comments only ever accrete at the end.** "Append after the last thing I wrote" is a different rule
   and is what failed. ⭐ None was found by reading — `lab-surface-ratchet`'s CONTROL F (counts
   uniform names in comments but not code) and `one-pipeline-fence` (a pack imported but not CALLED)
   caught them.
2. ⛔⛔ **NEVER PUT A BACKTICK INSIDE A GLSL TEMPLATE LITERAL.** Writing symbol names in backticks
   inside `craterRelief.glsl.js` terminated the string. The repo's GLSL comment convention is NO
   backticks. Caught only by an immediate `import()` check.
3. ⛔ **`tests/vis-scale-fence.test.js` bans the display-scale token from every file under
   `src/worldengine/**` INCLUDING COMMENTS.** Naming it in a shader comment reds five assertions.
4. ⚠ **EDITING A SHADER SHIFTS LINE-ANCHORED CITATIONS, INCLUDING ONES YOU JUST WROTE.** Three
   round-trips of `npm run port-uniform-delta:citations` in one commit. Repair by LOCATING each
   symbol; never bump the integer.
5. ⛔ **A SABOTAGE PROBE THAT CANNOT REACH ITS SUBJECT IS NOT EVIDENCE.** Two of three attempts were
   vacuous: nulling `state.craterOffset` across a preset change (`updateSeedUniforms` repopulates it
   to `[0,0,0]` first) and `_lab.riversReroute()` (`:2986` early-returns unless the ribbon overlay is
   enabled). The live one: enable the overlay, leave the preset alone. ⭐ The strongest arm was
   POSITIVE — `state.craterAmp` now has exactly one writer, so poisoning it and watching a route
   restore it cannot be explained otherwise.
6. ⚠ **A STALE WORKFLOW WORKTREE IS IN THE TEST PATH.** `.claude/worktrees/wf_440dc97c-63b-4` sits at
   the old `47170f9` and doubles a bare `npx vitest run` to 680 files. `npm run test:baseline` and
   `test:body-identity` exclude it; nothing else does.

---

## 6. ⛔ THE INSTRUMENT-A BASELINE IS STALE AND WILL READ AS DRIFT

`npm run test:baseline` compares against **31 failed / 6 files**, recorded from a DIRTY tree. Reality
is **36 failed / 8 files, 15 non-collecting**, from two deliberate generation changes (another lane's
binary-companion channel `34b502d`, and the ocean-world change). **That 36/8 is the expected reading;
anything else is drift.** Every commit on 2026-08-25 was verified against it.

⚠ The 15 non-collecting files are `vendor/motion-test-kit/tests` — not vitest suites, failing
identically on an untouched worktree. Long-standing, unrelated.

⛔ Before any re-bless: run the four known flaky tests (`GalacticFeatures`,
`worldengine-inc3b-composite-budget`, `ringConic.frontarc`, +1) **in isolation**, or a random failure
gets frozen in. And `test:body-identity:rebless` is **INCOMPLETE** — it rewrites only the JSON; three
values are hardcoded in the test source at `:687`, `:288-293`, `:777-780`.

---

## 7. WORKING WITH MAX

⭐⭐ **Read `feedback_director-level-recaps.md` IN FULL before any end-of-turn summary** — from the
file, not `MEMORY.md`'s gloss. **CUT TEST**: delete everything above the asks; do they still stand
alone? He is the director, does not read code, cannot reconstruct context mid-decision.

⭐ **He re-frames problems better than the diagnosis does.** Twice on 2026-08-26 he corrected a
framing that had quietly assumed the fix. Put the OBSERVATION and the MEASUREMENT in front of him and
let him choose the frame; do not arrive with the conclusion pre-baked.

⛔ **`feedback_showcase-by-parking-the-live-game`** — a property that needs MOTION cannot be judged
from a screenshot. Bare key flipped while flying, and the arm must be readable ON SCREEN (this is why
the badge now prints `A ·` / `B ·`: he had to ask which was which).

⛔ **`feedback_max-does-not-run-console-commands`** — he never uses the browser console. Drive
`localStorage` / JS yourself via chrome-devtools `evaluate_script`.

⛔ He noticed oscillation once: *"you keep going back and forth on this."* Once he reaffirms a
decision it is made.

---

## Suggested skills

- **`superpowers:systematic-debugging`** — ⭐ INVOKE THIS FIRST FOR PROBLEM 1. Max's question is
  literally "which half is broken, the law or the LOD?" and the previous session skipped straight to
  a fix. Root-cause before proposing anything.
- **`superpowers:brainstorming`** — before any code on either problem. Both are shared-law changes
  that alter how the LIVE game looks; the design space (screen-floor rule vs pixelScale vs octave
  ramp; density curve vs SFD) needs opening before narrowing.
- **`superpowers:verification-before-completion`** — a green gate is not evidence until a probe that
  can reach its subject proves the thing is live. Three probes were vacuous last session.
- **`dev-collab-scope`** — if either fix turns out to span 2+ systems (likely for problem 1, which
  touches the law, the writer, the renderer and the LOD ramp), write `intent.md` + `contract.json`
  before coding.

## Not in scope

The import-back ledger (at 2, Max's merge gate, met), the deploy/submodule incident (closed), and the
`[G]` and `[E]` A/Bs (built, and `[E]`'s own question — whether the port's ejecta family is the right
look — is still an open preference call for Max, unrelated to the two problems above).
