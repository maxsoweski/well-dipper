# Scoping reconnaissance — Max's three asks, 2026-08-28

**Produced by** a read-only 7-agent workflow (3 sonnet surveyors → 3 opus refuters → 1 opus synthesis),
run against `feature/world-engine-production-L1` @ `3ea1876`. Nothing was edited, built, or served.
Max asked for these to be "figured out via workflows"; this is that output, not a build.

⛔ **THREE OF THE FOUR SURVEYS WERE PARTLY REFUTED, and the refutations are worth more than the surveys.**
Every ❌ below is a claim a surveyor made that an adversarial reader opened the files and killed. Read the
❌ lines before the ✅ ones.

⚠ **CORRECTIONS TO THE 2026-08-28 HANDOFF ITSELF**, which fed this workflow its "verified facts":
1. The handoff said the ORRERY/HELM mode-swap button "IS shown on mobile". It is shown on mobile
   **only inside HELM** — mobile mode-swap is deliberately ONE-WAY (`src/main.js:13323`, `:13368`).
2. The handoff's standing rule `npx vitest run --dir tests` sees 191 files under `tests/` and **misses 135
   colocated test files under `src/**/__tests__`**. Instrument A (`scripts/test-baseline.mjs`) excludes
   `.claude/`+`scratchpad/` rather than restricting to `tests/`, so it DOES cover them — Instrument A is the
   regression gate, an ad-hoc `--dir tests` run is not.

---

# Well Dipper — Reconnaissance on Max's Three Asks (2026-08-28)

Repo `/home/ax/projects/well-dipper`, branch `feature/world-engine-production-L1`, HEAD `3ea1876`. `src/main.js` is unmodified in the working tree (`git diff --stat -- src/main.js` → empty), so every line number below lands on this tree. Nothing was edited, built, or run as a server.

Ordered by leverage, highest first.

---

## Line of sight, all three in one place

| Ask | What it gets you in the world | What it does **not** get you |
|---|---|---|
| **Deep-link URL** | A link you tap on your phone that lands you in a named system, in ORRERY, as a single still frame you can judge. It is also the *delivery mechanism* for the other two. | It does not let you fly. It does not let you get back to where you were, unless we pick the expensive identity (below). |
| **Incremental changes with tests** | A repeatable way to make a small change and have a machine prove it didn't break anything — while you're away and can't check. | It produces green counts in a terminal. **You cannot see any of it.** Every increment still needs a screenshot pushed to you or it is invisible to you. |
| **Mobile ORRERY improvements** | Better buttons, labels and layout on a touch screen — the parts that hold still. | Touch camera *feel* (pan, pinch, tap-to-select) is motion. That is your gate at a desk, not today's. This is the biggest of the three and it is a multi-session job. |

---

# 1. The deep-link URL — highest leverage

**Why first:** it is the only one of the three whose finished output is a thing you can hold in your hand on a phone, and once it exists it becomes the way you look at everything else. Every future increment gets a link instead of a description.

## What is real

**The entry point already ships to production.** `window._lab` is assigned at `src/main.js:2323`, which is *outside* the `if (import.meta.env.DEV) { … }` block that opens at `src/main.js:2291` and closes at `:2315`. Confirmed in a built bundle: `dist/assets/index-Do8ra-v_.js` contains both `window._lab=` and `spawnProceduralSystem`. No un-gating work is needed.

⚠ Caveat I could not close read-only: that `dist/` is a **local build dated Aug 25 19:32**. Whether the bundle currently served at welldipper.maxsoweski.com is this one is unverified.

**The landing behaviour is already what you want.** `spawnProceduralSystem(seed = 'lab-procedural-1')` at `src/main.js:2357` already dismisses splash and title (`:2358-2366`) and its tail at `:2402-2409` sets `_pendingBootReveal = false`, `_pendingBootMode = 'orrery'`, then calls `_frameSystemForOrrery()`, `_beginOrreryArrivalZoom()`, `_syncOrbitsToMode()`. The in-code comment at `:2394` says ORRERY "is deliberate: it is what Max asked the merge for." So the deep link needs **zero mode plumbing** to be phone-safe.

**There is an exact template for the URL handler.** The D-hold boot skip is the same shape: a four-line pure reducer `bootSkipDecision({ dHeld, mode })` at `src/flight/flightModes.js:262-265`, unit-tested at `src/flight/__tests__/bootMode.test.js:79-105`, read by one call site at `src/main.js:5395`, which dispatches to `_bootSkipToSol(mode)` at `src/main.js:5416`. A `?system=` route is a sibling of that, not a new subsystem.

## What was refuted

- ❌ **"`?seed=` already deep-links to a system."** It does not. `?seed=` is consumed by `src/core/SimRandom.js:37` and coerced to a uint32 for the *sim* RNG. `spawnProceduralSystem`'s seed is a **string**. Reusing `seed` would both fail to select a system and silently reseed determinism. The full occupied namespace is `seed` (`SimRandom.js:37`), `lab` (`src/debug/LabMode.js:50`), `debug` (`src/debug/SceneInspector.js:51`), `portalLab` (`src/main.js:2157`), `warpDebug` (`src/main.js:4384`), `recordInput`/`replayInput` (`src/core/InputReplay.js:45-46`). Use `?system=`.
- ❌ **"This is XS — just read a param at the top of main.js."** It is not. `splashActive` is a `let` at `src/main.js:5177` and `titleScreenActive` a `let` at `src/main.js:5335`. Any dispatcher that *calls* `spawnProceduralSystem` must run **after line 5335** or it throws a temporal-dead-zone ReferenceError. Placement is a hard constraint inside a 15,073-line boot sequence.
- ❌ **"The prior workstream already covers it."** `docs/WORKSTREAMS/system-tags-save-search/contract.json` says `"status": "building"`, but `grep -rn "deriveSystemTags\|savedSystems\|systemTags" src/ tests/` returns **zero hits**. Nothing of it exists. Its own `intent.md:44-47` puts "share a link" explicitly out of scope as Phase 2.

## The thing that is bigger than it looks — shipping it

`.github/workflows/deploy.yml` triggers `on: push: branches: [master]`. This repo is on `feature/world-engine-production-L1`. Master lives in a **different working copy**, `~/projects/well-dipper-trunk` (HEAD `9f141e5`). **A deep link built here does not reach welldipper.maxsoweski.com until it merges to master in the trunk repo.** Until then the link only works against a local dev server, which is no use to you on a phone.

Query strings are orthogonal to Vite's `base` (`vite.config.js:21`, `'/'` on build) and to `public/CNAME` (`welldipper.maxsoweski.com`), so I expect no interaction there — but that is reasoning, not a measurement.

## Smallest first increment

| | |
|---|---|
| **New file** | `src/flight/flightModes.js` — add one exported reducer, e.g. `deepLinkBoot({ search })` returning `{ open: boolean, system: string \| null }`. No THREE, no DOM, no `location` read inside it — the caller passes the string. This file already has 33 top-level exports and imports nothing. |
| **main.js edit** | Two lines: a call inside `_pickBootMode`'s neighbourhood (after `:5335`), dispatching to a `_bootToSystem(seed)` sibling of `_bootSkipToSol` that calls the existing `window._lab.spawnProceduralSystem`. |
| **Tests** | (a) direct unit test of `deepLinkBoot` in `src/flight/__tests__/`, copying `bootMode.test.js:79-105` verbatim in shape — including its garbage-input and no-args cases; (b) a comment-stripped source-scan fence in `tests/` proving main.js actually calls it, modelled on `tests/agent-camera-api.test.js:37-38` + `:286`. |
| **Coverage today** | **Zero.** `grep -rln "spawnProceduralSystem" tests/ src/` returns only `src/main.js` — no test anywhere touches it. |
| **Size** | Reducer + tests: **S**. Wiring + placement: **S**. Getting it onto the live site: separate, and it is a merge to trunk, not a push from here. |

---

# 2. Incremental changes with tests baked in — second

**Why second:** the machinery already exists and has three working precedents. It costs almost nothing to adopt. But it delivers you nothing visible, so it is a *method*, not a deliverable.

## What is real

`src/main.js` has **zero top-level exports** (`grep -c '^export'` → 0) and evaluates `new THREE.PerspectiveCamera(...)` at `src/main.js:159` and `document.getElementById('canvas')` at `src/main.js:189` at module top level. So no test can import it. `src/objects/Planet.js` is the exception — **19** top-level exports, imported directly by 12 test files.

The repeatable increment shape, with real in-repo precedent:

1. **Extract the pure decision** into an existing exported module. `src/physics/Barycentre.js` (6 exports, one import, no THREE, no DOM) is the cleanest precedent.
2. **Unit-test the export directly.**
3. **Add a source-scan fence** proving main.js actually calls it — because main.js can't be imported and run.

## What was refuted

- ❌ **"`src/cockpit/NavSource.js` was extracted from main.js."** It was not. `main.js` contains zero occurrences of `NavSource`. `CameraController` appears only as a **commented-out** import at `src/main.js:21`. That "precedent" was two unrelated things fused together.
- ❌ **`tests/cockpit/__tests__/mainNavWiring.test.js`** — that path does not exist. The real file is `src/cockpit/__tests__/mainNavWiring.test.js`, and it is the **weaker** template: it brace-matches *raw* source, so a `{` inside a comment or string miscounts. The better template is **`tests/agent-camera-api.test.js`**, which reads main.js through `stripCommentsPreservingOffsets` from `tests/helpers/source-scan.mjs` with literal text blanked (`:35-38`) and then scans function bodies (`:286`, `:296`, `:310`, `:317`). 21 files import that helper. Its own header at `:23-26` says why: *"a raw grep would be satisfied by the documentation of the thing it is supposed to be checking."*

## ⭐ The correction that matters most — the test command in the brief is too narrow

The brief says the runner is always `npx vitest run --dir tests`. That command sees **191 test files under `tests/`**. It does **not** see the **135 test files colocated under `src/**/__tests__`** — 35 in `src/flight`, 30 in `src/cockpit`, 30 in `src/generation`, 21 in `src/ui`.

The repo has its own instrument that does it correctly. `scripts/test-baseline.mjs` excludes `**/.claude/**` and `**/scratchpad/**` (`EXTRA_EXCLUDE`, `:88`) rather than restricting to `tests/`, and compares **sets of test IDs, not counts** — "a test that goes GREEN fails the check just as loudly as one that goes red" (`:20-22`). Its recorded baseline, `tests/baseline/known-failures.json`, covers:

- **341 collected files**, 5,717 tests, 31 failing, 5,682 passing, 4 skipped
- **6 failing files** — and **three of them live under `src/generation/__tests__/`** (`ProcgenSnapshot.test.js`, `StarSystemGenerator.binary-barycentre.test.js`, `componentSystems.byteSafety.test.js`), i.e. **invisible to `--dir tests`**
- **15 non-collecting files** — every one under `vendor/motion-test-kit/tests/`. These fail *before collecting a single assertion*; a test-count baseline cannot see that at all.

The file that pins the mobile mode-swap button (`src/cockpit/__tests__/mainHudSlot.test.js:260-270`) also lives in that blind region and is never executed by `--dir tests`.

⚠ Two honest caveats: I did **not** run the suite. And the baseline was recorded 2026-08-22 from commit `2f7402f` with a dirty tree, while HEAD is `3ea1876` — so it may itself have drifted, and its own scope note (`:87`) warns the guard reds until the next deliberate `--record`.

**Recommendation:** the regression gate for every increment should be `npm run test:baseline -- --check` (which is `node scripts/test-baseline.mjs --check`), not a file/failure count off `--dir tests`. First step is a single `--check` run to see whether the recorded baseline still matches HEAD.

## Smallest first increment

Not a code change — run `npm run test:baseline -- --check` once and see whether the recorded set still holds at `3ea1876`. Size: **XS**. Everything downstream depends on knowing whether the repo's own gate is currently green.

## The step the survey left out

Nothing in the five-step shape produces an artifact you can see. Every output is a green count. The shape needs a sixth step: **after the increment, I drive it live via chrome-devtools at a touch-emulated viewport and push you one screenshot.** That is cheap here — `_isMobile` is a plain `'ontouchstart' in window` check (`src/main.js:378`) that touch emulation genuinely flips.

⚠ But see the mobile section below: emulating touch is **not sufficient** to reproduce the mobile UI, because the mobile UI is gated on a different mechanism.

---

# 3. Mobile ORRERY improvements — third, and it is a multi-session job

**Why last:** it is the least defined, the largest, and most of what would make it better is *feel*, which is exactly the thing you cannot judge this week.

## What is real

**The mobile surface exists and is enumerable.** `index.html:271-291`:
- bottom dock (5 buttons): `prev`, `autonav-toggle`, `next`, `warp`, `nav`
- FAB + speed dial (6 buttons): `autonav`, `gyro`, `minimap`, `orbits`, `fullscreen`, `settings`

All wired through one `handleMobileAction` function inside `if (mobileControls)` at `src/main.js:14861-15049`.

**Its ORRERY-vs-HELM decisions are already extracted.** `handleMobileAction` reads pure reducers from `src/flight/flightModes.js` — `bodyCycleAction` at `src/main.js:14989`, `navAutopilotToggleAction` at `:15005`, `systemEntryStyle` at `:15026`. That file is imported at `src/main.js:63`, has 33 top-level exports, imports nothing, and already exports the mobile-aware HUD decision `pointerHudState({ regime, freeLook, isMobile })` at `src/flight/flightModes.js:380`, called at `src/main.js:546`. **Any mobile-ORRERY logic change belongs there. Do not create a new `src/mobile/` module beside it.**

## What was refuted, and one thing the brief itself gets wrong

❌ **The brief's "verified fact" that the mode-swap button is shown on mobile is true only inside HELM.** Two gates:

- `src/main.js:13323` — `if (_isMobile && !swap.exitFlight) return; // mobile: ORRERY→HELM entry not offered`. Mobile is **one-way**: HELM→ORRERY yes, ORRERY→HELM no. The reason is at `:13311-13314`: *"so a stray tap can't strand a touch player in a keyless, hands-on HELM with no F/W/S/Q/E/Z."*
- `src/main.js:13368` — the visibility predicate ends `&& (_isMobile && _scManual)`. So the button is **hidden on desktop entirely**, and on mobile shown **only in HELM**. That is deliberate and pinned by `src/cockpit/__tests__/mainHudSlot.test.js:260-270`, which quotes you at `:251-253`: *"Now that there's this stark difference between helm and orrery modes we don't need the constant label in the upper-right of the screen."*

**Consequence for scoping:** in mobile-ORRERY there is no on-screen swap button and no keyboard. Any mobile-ORRERY increment must route through the dock or the speed dial. `_isMobile` also hard-returns from two keybinds (`src/main.js:13790`, `:13842`) — it gates behaviour, not just styling.

## ⚠ A trap for verification that nobody flagged

**There are two different, independent mobile detections in this codebase, and they can disagree.**

- **JavaScript:** `const _isMobile = 'ontouchstart' in window;` (`src/main.js:378`) — a *touch-capability* probe, true on any touchscreen laptop.
- **CSS:** `@media (pointer: coarse)` (`src/style.css:37`, `:369`, `:825`, `:832`, `:1206`). `#mobile-controls { display: none }` at `:31-35`, flipped to `display: block` only inside that media query at `:37-39`.

And the bridge between them is **dead**: `document.body.classList.add('is-mobile')` at `src/main.js:383`, but `grep -rn "is-mobile"` across every `.html`, `.css`, `.js` and `.md` in the tree returns **only `src/main.js`**. Nothing reads that class. There is exactly one CSS file, `src/style.css` (1,223 lines), and it never mentions it.

So a chrome-devtools screenshot that only enables touch emulation would flip the JS branch and **leave the entire mobile dock invisible**. A faithful mobile screenshot needs touch emulation *and* a coarse-pointer/mobile-device profile *and* a mobile viewport. If we get that wrong we will push you a picture of the wrong thing and both believe it.

## The honest size

This is **not a one-increment job**. Evidence:

- The judgeable-from-a-still subset is narrow: which buttons are on screen, their size (currently 44×44 in `src/style.css`), their labels, what the body-info panel shows, portrait vs landscape layout (`src/style.css:825`, `:832`), and the forced `screen.orientation.lock('landscape-primary')` on first touch (`src/main.js:14854-14859`).
- Everything else is motion: tap-to-select and double-tap-to-warp (`src/main.js:14786-14850`), pinch/pan camera, the gyro toggle. Those are your gate at a desk.
- The dock handler is a ~190-line if/else chain at the very bottom of a 15,073-line file, and its branches already reach into `stopFlythrough`, `scControls.selectTarget`, `focusPlanet`, `_enterSystemInstantOrrery`, `_armAutopilotWithCockpit`, `_applyHudSlot`. Changing its *behaviour* touches several subsystems. Changing its *layout* does not.

**Smallest first increment:** pick one static property — e.g. what the dock's `nav`/`next`/`prev` buttons show, or the body-info panel's portrait layout — change it in `index.html` + `src/style.css` only, and gate it with a screenshot. Zero main.js edits, zero new modules. Size **XS**. Anything that changes what a dock button *does* is a reducer change in `src/flight/flightModes.js` + a unit test there + a source-scan fence, size **S** each, and there are several of them.

---

# What I need from you

Four things, and only you can answer them.

1. **When the link opens a system, should the camera glide in from far away, or should it just be sitting there already framed?** Right now it glides — `_beginOrreryArrivalZoom()` at `src/main.js:9670`. That's motion, so a screenshot of it is a picture of a half-finished camera move. My recommendation: build the still version, so what you tap is what you see, and keep the glide as the default for when you're at a desk.

2. **Should the link name a system by its recipe number, or by its actual place in the galaxy?** The recipe number is short and cheap — but the system it opens is a one-off you can't fly back to from anywhere. Naming the real place is faithful and reuses the existing warp machinery, but it's a longer link and more work. Your own note in `docs/WORKSTREAMS/system-tags-save-search/intent.md:16-19` already calls the bare recipe number "the only lossy path." My recommendation: build the cheap one first so you have a link this week, and treat the faithful one as the follow-on.

3. **Do you want this on the live site, or is a preview enough for now?** The live site only updates when something lands on `master`, which is a *different copy of the repo* (`~/projects/well-dipper-trunk`). Getting a link that works on your phone means merging across. My recommendation: build and verify on this branch, then do one deliberate merge once the link works, rather than merging mid-build.

4. **What about the mobile orrery is actually bothering you?** I can't answer this one for you and I won't guess — you named "the mobile version that uses orrery mode" but not what's wrong with it. If it's about how it *feels* to move the camera with a finger, that's a desk job and I'd park it. If it's about what's on screen — which buttons, how big, what they say, what the info panel shows — I can change that this week and send you a picture of it.