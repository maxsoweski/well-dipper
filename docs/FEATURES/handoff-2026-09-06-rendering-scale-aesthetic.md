# Handoff — ▶ **THE RENDERING SCALE / AESTHETIC CONSISTENCY PASS**

> ⚠ **IN-REPO ON PURPOSE** (`/tmp` does not survive a WSL restart). Supersedes
> `handoff-2026-09-05-snow-budget-then-lighting.md`; **its arc (2), the snow budget, is CLOSED and
> shipped on Max's UAT.** Its trap list is carried and extended below.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master) · **HEAD = origin =
> `d1c20f2`, verified by `git ls-remote`.**
> ⛔ **662 untracked files (mostly stray PNGs) are normal — NEVER `git add -A`.** Stage explicitly and
> audit with `git show --stat` after every commit.
> ⚠ ALWAYS `npx vitest run --dir tests --root /home/ax/projects/well-dipper`.

## 0. ⛔⛔ THE SUITE IS ALREADY RED AT HEAD — 20 tests / 8 files

Unchanged all session, and it was red before it too:

```
agent-camera-api · driver-pack-giantdeck · gas-body-lab-material · lab-shader-perframe-seam
moon-condition-contract · moon-rng-stream-identity · port-condition-contract · relief-octave-lod-ramp
```

**Capture the baseline first and diff against it.** Never attribute a pre-existing failure to your
change. The method: `npx vitest run --dir tests --root ... --reporter=json --outputFile=X`, then diff
the failed `fullName` sets before/after.

## 1. ▶ THE NEW ARC — Max's words, 2026-09-05

> *"we need to make sure the rendering scale (resolution, etc) is aesthetic appropriate for all the
> planets/moons/stars, the starfield, the giant galactic objects, the menus, and the cockpit. I have
> the sense they are not all consistent with our chosen aesthetic."*

**Seven surfaces named:** planets/moons, stars, the starfield, the giant galactic objects, the menus,
the cockpit — and the rendering scale that ties them.

### ⭐ THE CHOSEN AESTHETIC IS ALREADY A SOURCED RULING, NOT A TASTE QUESTION

`src/ui/Settings.js:12` — `posterizeLevels: 31`, and its comment records Max's 2026-08-21 reasoning:
`levels = N` yields N+1 values per channel, so **31 ⇒ 32 ⇒ 5 bits ⇒ RGB555**, the framebuffer depth of
the N64, PlayStation and Saturn alike. Max asked for *"that era's aesthetic"* and 31 is that era's
number. `docs/PILLARS.md` frames it as *"CRT retro"*, *"Not photorealistic — stylized rendering with
signature shader language per planet type"*.

**So the bar exists. The question is who obeys it.**

### ⚠ FIRST MEASUREMENT, ALREADY IN HAND — and it is a real hit

```
posterizeLevels across src/:   8.0 × 22 sites   ·   31 × 1 site
```

The lone 31 is the SETTING. The twenty-two 8.0s live in `src/main.js` and
`src/data/KnownBodyProfiles.js` — **Sol's known bodies**.

⛔ **DO NOT CALL THAT A DEFECT YET.** Sol is the one system that is NASA-photo-textured and runs a
different renderer (`memory/MEMORY.md`: *sol-is-nasa-textured-not-representative*). An 8 there may be
a deliberate choice for photographic source material. **The job is to find out which, not to
normalise 22 numbers because they differ from 1.**

### ⛔ AND THE INVENTORY IS NOT DONE — I DELIBERATELY DID NOT GUESS IT

I tried a quick grep for which of the seven surfaces route through `retroRenderer` and it matched test
files and gave junk. **A bad inventory is worse than none**, so the first real task is an honest one:

For each of the seven surfaces, answer three things with evidence:
1. **Does it go through `retroRenderer` at all**, or draw at native resolution? (`pixelScale: 3` is a
   single global — `main.js:198`, `:6261`, `:6380`, `:11606`.)
2. **Does it posterize**, and to what level?
3. **Is its answer deliberate or inherited?** — the Sol question above, asked of every surface.

⭐ **The discriminating check, because this program's failure mode is a wire that goes nowhere:**
for each surface, CHANGE the setting and confirm the surface moves. A surface that looks right at 31
may simply never have read it. `setPosterizeLevels` is the single writer of both shared uniform
objects (`main.js:199`) — POSTERIZE_QUANTUM for the game's `uPosterizeLevels`, POSTERIZE_LEVELS for
the lab's `uLevels`. **Anything not reached by those two is unquantised, whatever it looks like.**

⚠ **`pixelScale` has a precedent defect worth reading before you touch it:** `main.js:199`'s comment
records that `pixelScale` was NOT read on boot, only on change — so the setting existed and the game
ignored it until something wrote it. Check boot-read AND change-subscription for every knob.

## 2. ⛔ PARKED BY MAX'S RULING, 2026-09-05 — the world engine features

> *"Let's handoff to a fresh session to work that and park these other world engine features."*

⭐ **TERMINOLOGY RULING, same message: "world engine" now means THE WORLD/MOON RENDERING ENGINE.**
Use it that way in docs, commits and conversation from here.

Three items, each with its evidence already written down. **None is scoped; do not start them.**

- **(1) Frozen oceans / sea ice** — `WORKSTREAMS/frost-budget/FINDING-frozen-oceans.md`.
  `planetShaders.glsl.js:452` zeroes frost on all standing liquid; `:526` says the draw order exists
  "so frost wins where cold (sea ice…)" — which `:452` makes impossible. The fix is CONDITIONAL, not a
  delete: `:452` is right for Titan's 94 K methane seas.
- **(2) An ice SHEET as geometry** — **an ADDITION, not a backlog item.** F22's card says its own
  design position outright: *"this is a COVERAGE term, not relief"*. `frostCoverage()` writes no `h`
  and no `grad`. Max: *"this is just coloring applied to continents that would be there either way."*
  He is right. F17 glacial is the only ice geometry and it moves the height field **0.26 % rms**.
- **(3) The height field's kilometre scale** — `FOLLOWUP-altitude-snowline.md`. Two instruments
  disagree: `sampling.js:44`'s conversion, applied to the field tapped off the compiled shader, makes
  the tallest mountain **1.99× the body's own radius**. Until that is settled nobody can say whether
  the altitude snowline is right. ⭐ **Not a frost problem** — it sits under every altitude-dependent
  law in the engine.

Also still parked from before: the REPORT's Block B (eats 74 % of bodies), the orrery drawing a
different system than the scene, the `compositionClass` C/O 1.0-vs-0.8 split, and `carbon` having no
physical referent.

## 3. ⛔ TRAPS — the carried ones that keep firing, plus five new

### Carried (numbering kept from the previous handoff)
10. `cd` moves the session's cwd. **Use absolute paths.**
15. ⭐⭐ A fresh `new SeededRandom(...)` for a side draw moves an instrument's stream with ZERO values
    moved. Use `namespacedFloat`.
16. ⭐ Editing `PlanetGenerator` / `MoonGenerator` / `PhysicsEngine` drifts every line-anchored
    citation. **Repair by locating the SYMBOL, never by bumping the integer.**
17. ⛔⛔ `git add -A` committed 705 stray PNGs once. Stage explicitly. Always.
18. ⭐⭐⭐ **A liveness probe can itself be vacuous.** "The control is unmoved" is NOT a liveness check —
    it passes under exactly the bug it is meant to catch. **The control must DISCRIMINATE.**
24. A month-old workflow worktree at `.claude/worktrees/wf_440dc97c-63b-4` makes vitest run a file
    TWICE if invoked by path. `--dir tests` is unaffected.

### NEW, and each cost time this session
25. ⭐⭐⭐ **A RELOAD CAN REPORT SUCCESS AND STILL CARRY YOUR CONTAMINATION.** `ignoreCache: true`
    returned "Successfully reloaded", `navType` read `"reload"`, `performance.now()` reset — and all
    49 lab features I had enabled were STILL ON. **Max saw it before I did**: *"a chaotic mix of every
    shader."* ⛔ The only thing that established the real baseline was **opening a separate fresh page
    and reading it before touching anything: 5 features on, not 49** — and not the 48-off/1-on the
    SOURCE claims either. **Source defaults are not the boot state.** The tell I walked past: a state
    field held its exact pre-reload value. The lab has a **"reset to world defaults"** button; use the
    app's own restore.
26. ⭐⭐ **READ THE UNIT BEFORE THE NUMBER.** I read `reliefAmplitude` (0.6…0.99) as a height and
    concluded the altitude term was 471× too weak. It is a 0–1 SOFTNESS multiplier
    (`labCore.js:1107`). Caught before it reached the contract — but the same class of error then
    produced a claim that DID reach Max ("216 K is too much") and had to be withdrawn.
27. ⭐⭐ **AN OPACITY IS NOT AN AREA.** `frostCover` is a blend weight (`planetShaders.glsl.js:610`),
    not a coverage fraction. Two of the frost contract's ACs were written in a metric that collapsed
    EXTENT and WHITENESS into one number, so a pale wash over 61 % of a world scored the same as a
    white cap over 10 %. **This trap is live for the new arc**: "resolution", "scale" and "level" are
    all quantities with units that are easy to conflate.
28. ⭐ **A CITATION CAN POINT AT NOTHING.** `planetShaders.glsl.js:448` said a deferral was "flagged
    in card §7"; §7 had no such flag and never had. Check the target before trusting a pointer.
29. ⚠ **Lab presets are ARCHETYPES, not worlds.** `drawPresetConditions` (`driver-presets.js:294`)
    re-draws condition scalars per macroSeed — `Ocean (temperate)` runs 267…315 K across seeds 0–7
    while the label says 295. Named real bodies (Titan) are excluded and hold exact values. **A live
    `⭐ surface temp (K) — DRAWN` slider now sits at the top of Cryo / Frost** so the world's real
    temperature is visible and draggable.

## 4. ⭐ WORKING WITH MAX — what this session actually demonstrated

- ⭐⭐ **HE CHECKS PREMISES AND HE IS USUALLY RIGHT IN A WAY THAT IMPROVES THE WORK.** Three times:
  *"What's wrong with the mountain snow?"* retired a recommendation I could not support. *"are these
  happening both for the game and the lab?"* was worth verifying rather than reassuring. *"this is
  just coloring applied to continents that would be there either way"* was exactly correct and named a
  capability gap nobody had written down. **Answer the premise with a measurement, not agreement.**
- ⭐⭐ **RECALCULATE THE RECOMMENDATION OUT LOUD.** I recommended fixing the altitude term, then the
  lab temperatures. Both were withdrawn after measurement — the first because I could not show the
  claim, the second because it was a designed feature. **Say the withdrawal plainly; do not let a
  stale recommendation stand.**
- ⭐ **HIS EYES FIND WHAT THE TESTS CANNOT.** Every AC I wrote passed while the thing he actually
  wanted — a cap that reads as a cap — was absent. Put him in the live thing.
- **He rules fast and in few words when the ask is concrete** — *"2 push"*, *"1 yes fix"*, *"3 go"*.
  One line per ask, recommendation stated.
- **Pushing is confirmed each time.** He said yes three times this session; that is not standing.

## 5. FIRST FIVE MINUTES

1. `docs/NOW.md` — top entry is this session.
2. `docs/PILLARS.md` §Mood and `src/ui/Settings.js:12` — the aesthetic bar, in Max's own reasoning.
3. Capture the test baseline (§0) **before** touching anything.
4. Repoint `~/.claude/state/dev-collab/active-workstream.json` (currently `frost-budget`, shipped).
5. **Build the seven-surface inventory FIRST — measured, with a discriminating check per surface —
   and put it in front of Max before proposing a single change.** He said *"I have the sense they are
   not all consistent"*; the deliverable that answers that is evidence, not a fix.
