---
Scope:
  base: master
  paths:
    - src/main.js
    - src/generation/DestinationPicker.js
    - src/ui/Settings.js
    - src/audio/MusicManager.js
    - src/auto/AutoNavigator.js
  features: ["deep-sky-cleanup"]
  systems: ["app-shell", "generation-system", "ui-hud", "audio", "autopilot"]
---

# Workstream: Deep-Sky Dice-Roll Arrival Cleanup

**Status:** **SHIPPED 2026-05-30** — verified live via chrome-devtools (GPU 9223), all 5 ACs PASS (AC1 zero random deep-sky arrivals across many real warps; AC2 title backdrop; AC3 gallery all 15 types; AC4 real external-galaxy click → `_isExternalGalaxy` cloud; AC5 code inspection, turn-back message stays out). Surgical removal as scoped — deep-sky renderer machinery preserved. −351 LOC. (GATE 1 passed 2026-05-29; GATE 3 Tester PASS this session; Max approved push to production GitHub Pages.)
**Migration context:** Phase 8 of the doc-system v5 migration.
**Created:** 2026-05-29. **Shipped:** 2026-05-30.

> This brief was rewritten 2026-05-29 against VERIFIED ground truth (two independent
> code sweeps). An earlier draft was authored against GUESSED file paths
> (`DeepSkyRenderer.js`, `DebugMenu.js`, a `deepsky.mp3` dice-roll cue) that DO NOT
> EXIST. All file paths and line numbers below are verified-current as of 2026-05-29.
> Line numbers drift — re-locate at implementation time.

---

## Goal

Kill the legacy RANDOM "dice-roll arrival" path so every warp lands at a real
star-system or an explicitly-chosen target — while leaving the deep-sky rendering
machinery alive for the three KEEP paths (title backdrop, debug gallery,
external-galaxy click Easter egg).

---

## Why we care

Right now, after the player decides on a warp destination, an RNG (`deepSkyChance`,
default 15%) can override that decision and dump them at a randomly-chosen deep-sky
object (a galaxy, nebula, or cluster they never asked for). That random override
makes warp arrival feel arbitrary — the player's intent gets silently discarded one
time in seven.

The scope through-line, to hold against later economy temptations: **the deep-sky
renderer is NOT the problem and does NOT get torn out.** Distant galaxies, nebulae,
and clusters still need to render for the title screen, for the debug gallery, and
for the deliberate "click an external galaxy" Easter egg. What's being removed is
exactly one thing — the *random arrival override* — plus the now-dead branches that
only that override could reach. This is surgical removal, not a teardown. If during
implementation it starts feeling like a refactor of `DestinationPicker`, that's
scope creep — stop and re-scope.

---

## Success criteria (ACs)

All behavioral ACs are verified through the REAL warp / click / load flow — NOT by
calling the picker or spawn functions programmatically. (Per
`feedback_test-actual-user-flow.md`: programmatic-API verification can pass while
the real user-input path fails.)

- **AC1 — Dice-roll arrival is gone.** After a long run of normal warps to real
  destinations, the player NEVER randomly arrives at a deep-sky object (galaxy /
  nebula / cluster) they did not explicitly target. Every warp resolves to a real
  star-system or an explicitly-chosen target.
  *Verify:* drive many real warps through the actual warp flow and confirm zero
  random deep-sky arrivals across the run. NOT via direct `pickDeepSky(...)` calls.

- **AC2 — Title-screen procedural backdrop still works.** Loading the title screen
  still shows its procedural nebula backdrop, exactly as before.
  *Verify:* load the title screen in a real browser; the emission/planetary-nebula
  backdrop renders.

- **AC3 — Debug gallery still works.** The debug gallery still cycles through every
  deep-sky type (galaxies, nebulae, clusters) and renders each one.
  *Verify:* open the debug gallery and step through the deep-sky entries; each type
  renders.

- **AC4 — External-galaxy click-warp still works.** Deliberately clicking an
  external galaxy still warps the player to it and produces the non-navigable
  galaxy cloud (`_isExternalGalaxy = true`) — the Easter egg is intact.
  *Verify:* in a real browser, actually click an external galaxy and confirm the
  warp + galaxy-cloud arrival. NOT via a programmatic destination call.

- **AC5 — Turn-back Easter-egg message stays OUT of scope.** The "you've gone too
  far / turn back" arrival message is NOT built in this workstream. (The TODO at
  `main.js:3039` is removed *along with the dead branch that hosts it*, not
  implemented.)
  *Verify:* code inspection — no turn-back message logic added; the hosting branch
  is gone.

---

## The 9 deep-sky usage sites (VERIFIED 2026-05-29)

Line numbers are current as of the 2026-05-29 sweep and WILL drift — re-locate at
implementation time.

| # | Site | Current location | Behavior | Disposition |
|---|------|------------------|----------|-------------|
| 1 | External-galaxy click warp | `main.js:2866-2881` (call at 2871) | `destType==='external-galaxy'` → builds galaxy cloud, sets `_isExternalGalaxy=true`. Click Easter egg. | **KEEP** |
| 2 | `feature:` warp → star-system | `main.js:2883-2913` (generateAsync 2904) | nebula/cluster CLICK warps route to a star-system at the feature center. | **KEEP** |
| 3 | DestinationPicker Category A/B branch | `main.js:2944-2976` | only reached when the dice-roll produced a deep-sky type; routes to a real feature or falls back to star-system. Dead once dice-roll removed. | **REMOVE** |
| 4 | Rolled spiral/elliptical galaxy | `main.js:3036-3040` (TODO at 3039) | `else if (destType.includes('galaxy'))` → GalaxyGenerator. Comment 3039: `// TODO: show "you've gone too far" message on arrival`. Reached only via dice-roll. | **REMOVE** |
| 5 | Title-screen procedural background | `main.js:3404-3415` | picks emission/planetary nebula for the title backdrop. Independent of dice-roll. | **KEEP** |
| 6 | Debug gallery `GALLERY_TYPES` | `main.js:2807-2826` | the gallery's type array. | **KEEP** |
| 7 | `spawnDeepSky()` | defined `main.js:4061` (body 4061-4153), sole caller `main.js:3602` | distant/non-navigable spawn. SURVIVES — external-galaxy Easter egg (#1) produces a non-navigable galaxy that routes here. Its globular-cluster branch dies with the dice-roll. | **KEEP (function); audit callers** |
| 8 | `spawnNavigableDeepSky()` | defined `main.js:4160`, sole caller `main.js:3597` | navigable fly-inside nebula/open-cluster spawn. Its only trigger is the dice-roll (`isNavigable` destTypes come ONLY from `pickDeepSky`; nebula CLICKS route to star-systems per site #2). After dice-roll removal this has ZERO live callers. | **REMOVE** (GATE 1: clean delete — still confirm no other navigable-destType setter at impl time) |
| 9 | Gallery internal switch | `main.js:4940-4948` (galaxy branch 4943) | gallery dispatch to galaxy/nebula/cluster generators. | **KEEP** |

**The dispatch the cleanup touches:** `main.js:3591-3604` — after a destType is
resolved:
`if (isNavigable) spawnNavigableDeepSky() [3597] else if (isDeepSky) spawnDeepSky() [3602]`.
Removing the dice-roll makes the navigable branch (3597) unreachable; the
non-navigable branch (3602) stays alive for the external-galaxy Easter egg.

---

## What actually gets removed

Concrete removal list (GATE 1 resolved all open questions toward **clean delete** —
no re-enable knobs left behind):

1. **The dice-roll itself** — `main.js:2918-2924`:
   `const dsChance = settings.get('deepSkyChance')/100;` plus the RNG gate that
   calls `DestinationPicker.pickDeepSky(...)`. This is the heart of the removal.
2. **Site 3** — `main.js:2944-2976` (the deep-sky Category A/B routing branch,
   dead once the dice-roll is gone).
3. **Site 4** — `main.js:3036-3040` (the rolled spiral/elliptical galaxy branch,
   including the `// TODO` turn-back comment at 3039 — removed, NOT implemented).
4. **The navigable dispatch branch** — `main.js:3597` — plus
   `spawnNavigableDeepSky()` (`main.js:4160`). **GATE 1: full delete** (confirm no
   other navigable-destType setter at impl time first).
5. **DestinationPicker deep-sky weights** — `DestinationPicker.js:13-18` (the 6
   deep-sky entries summing to 0.15). **GATE 1: full delete** the entries. Helpers
   `pickDeepSky` (42-52), `isDeepSky` (55-57), `isNavigable` (60-62), `isDistant`
   (65-67) — remove as their live consumers disappear. Note: `pick()` (the
   full-weights variant) already has NO src/ caller — it is dead independent of
   this work.
6. **`deepSkyChance` setting** — `Settings.js:18` (`deepSkyChance: 15`) and its
   label formatting at `main.js:2453`. **GATE 1: delete entirely** (no keep-at-0 knob).
7. **Audio `'deepsky'` track** — `MusicManager.js:110` track-list entry. **GATE 1:
   remove from the list** (no live dice-roll cue; arrival context is going away).
8. **Autopilot deep-sky tour stops** — `AutoNavigator.js:90,95`
   (`buildDeepSkyQueue` / `deepsky-poi`). **GATE 1: remove** — deep-sky leaves the
   normal screensaver loop entirely.

---

## Test Coverage Plan

> No `docs/TESTING_CONVENTIONS.md` exists in this repo; layer meanings follow the
> memory feedback rules cited inline (`feedback_test-actual-user-flow.md`,
> `feedback_integration-must-cover-visible.md`, `feedback_drive-vs-watch-distinction.md`).
> (This workstream is SCOPING-ONLY; the plan below is the contract the FUTURE
> implementation session and Tester run against.)

This is a visible-behavior project, so UAT is relevant — but per
`feedback_integration-must-cover-visible.md`, anything broken at a level the player
can see must be caught at INTEGRATION before UAT runs. UAT here is confirmation of
felt-correctness once integration is GREEN, not the safety net for AC1.

| AC | Unit coverage | Integration coverage | UAT coverage |
|---|---|---|---|
| AC1 — dice-roll gone | Vitest assert against `DestinationPicker` post-edit: no deep-sky subtype is ever returned by the live resolution path (e.g. `pickDeepSky` removed / weights zeroed); deterministic over a forced-RNG sweep. | Drive N real warps through the actual warp flow (record-replay or scripted warp inputs); assert end-state destType is star-system / explicit target across ALL N, zero `isDeepSky` arrivals. This is the layer that PROVES AC1. | Max runs the screensaver a while and confirms he never lands somewhere random. (Confirmation only — AC1 must already be integration-GREEN.) |
| AC2 — title backdrop | N/A — covered at integration (rendered output). | Load title screen via the test harness; assert the nebula backdrop mesh is present/visible (scene-inventory snapshot / `meshVisibleAt`). | Max loads the title screen, confirms the backdrop looks right. |
| AC3 — debug gallery | N/A — covered at integration. | Drive the gallery toggle + step through deep-sky types; assert each type's mesh renders (scene-inventory per type). | Max opens the gallery, steps through, confirms each renders. |
| AC4 — external-galaxy click | N/A — click path is integration-shaped. | Real `click` on an external galaxy via chrome-devtools; assert warp completes and `_isExternalGalaxy === true` + galaxy cloud present. NOT a programmatic dest call. | Max clicks an external galaxy himself, confirms the Easter egg arrival feels right. |
| AC5 — turn-back stays out | Code inspection / grep: no turn-back message logic exists; the hosting branch (site 4) is gone. | N/A — pure code-absence assertion. | N/A — engineering-only (nothing for Max to see). |

UAT items above are all "Max with his own hands in his own browser" (drive-not-watch,
per `feedback_drive-vs-watch-distinction.md`). If integration is not GREEN on AC1–AC4
at Tester time, the workstream is integration-extension, not UAT-ready.

---

## In scope

- Remove the random dice-roll arrival override and every branch only it could reach.
- Trim the now-dead picker weights/helpers and the vestigial setting (final
  delete-vs-keep-at-0 shape pending Open Qs).
- Keep all three KEEP paths (title backdrop, gallery, external-galaxy click)
  fully working.

## Out of scope

- The turn-back / "you've gone too far" Easter-egg message — NOT built (AC5).
- Deleting `spawnDeepSky()` or the broader deep-sky renderer machinery — it STAYS
  for the KEEP paths (title backdrop, debug gallery, external-galaxy click).
- Any broader `DestinationPicker` refactor beyond removing the deep-sky entries.

(Note: audio track removal and autopilot tour-stop removal were moved INTO scope by
GATE 1 — see removal list items 7 and 8.)

---

## Open questions — RESOLVED at GATE 1 (2026-05-29)

Max chose a consistent **clean-delete** philosophy across the board — no re-enable
knobs, deep-sky fully out of the normal screensaver loop.

- **(a) `spawnNavigableDeepSky` (site 8):** ✅ **FULL DELETE** — remove the function
  + its dispatch branch (3597). (Confirm no other navigable-destType setter at impl.)
- **(b) `deepSkyChance` setting (`Settings.js:18` + label `main.js:2453`):**
  ✅ **DELETE ENTIRELY** — no keep-at-0 knob.
- **(c) Audio `'deepsky'` track (`MusicManager.js:110`):** ✅ **REMOVE from the
  track list.**
- **(d) Autopilot `buildDeepSkyQueue` / `deepsky-poi` (`AutoNavigator.js:90,95`):**
  ✅ **REMOVE** — autopilot tour no longer stops at deep-sky POIs.
- **(e) DestinationPicker WEIGHTS (`DestinationPicker.js:13-18`):** ✅ **FULL-DELETE**
  the 6 deep-sky entries (no zero-weight knob).

---

## GATE checkpoints

- **GATE 1 (this brief):** Max approves the scope + answers Open Qs a–e. No code
  until this passes.
- **GATE 2 (mid-implementation):** if scope shifts during the future
  implementation (e.g. an Open-Q answer turns out infeasible, or site 8 has an
  unexpected caller), stop and re-confirm with Max before continuing.
- **GATE 3 (Tester sign-off on the future implementation):**
  - AC1 — repeated REAL warps, zero random deep-sky arrivals.
  - AC2 — title screen loads, backdrop renders.
  - AC3 — gallery toggle, every deep-sky type renders.
  - AC4 — REAL external-galaxy click → warp + `_isExternalGalaxy` cloud.
  - AC5 — code inspection: no turn-back message; hosting branch gone.

---

## Systems touched

(VERIFIED against `docs/SYSTEMS.md` manual index — do not invent slugs.)

- `src/main.js` → **app-shell** — MODIFIED (core removal).
- `src/generation/DestinationPicker.js` → **generation-system** — MODIFIED (weights/helpers).
- `src/ui/Settings.js` → **ui-hud** — MODIFIED (vestigial setting).
- `src/audio/MusicManager.js` → **audio** — MODIFIED (remove `'deepsky'` track; GATE 1).
- `src/auto/AutoNavigator.js` → **autopilot** — MODIFIED (remove deep-sky tour stops; GATE 1).
- `src/objects/Galaxy.js` / `Nebula.js` → **galactic-bodies**, generators →
  **generation-galaxy** — touched-for-verification only (KEEP-path spawn targets).

---

## Handoff note to working-Claude (FUTURE implementation)

Read this brief and the verified site table first. This is **surgical removal, not a
teardown** — the deep-sky renderer machinery STAYS. Re-locate every line number at
impl time; they drift from the 2026-05-29 sweep. The single core removal is the
dice-roll at `main.js:2918-2924`; everything else in the removal list is a branch
only that dice-roll could reach. The external-galaxy Easter-egg path
(`main.js:2866-2881` → site 7 `spawnDeepSky` at 4061) keeps `spawnDeepSky` alive —
do NOT delete it. Do NOT build the turn-back message; remove its TODO along with the
dead branch (AC5). Before touching sites 8, audio, or autopilot, confirm Max's GATE 1
answers to Open Qs a–e are in the brief. "Done" looks like: AC1 holds across many
real warps AND all three KEEP paths (AC2/3/4) still render through their real flows.
