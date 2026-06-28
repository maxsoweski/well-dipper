# Design — Orrery navigation UX + roll axis & flight-control remap

**Date:** 2026-06-28 · **Worktree:** `well-dipper-supercruise` · **Branch:** `feature/supercruise-freelook`
**Status:** design approved (decisions locked with Max in brainstorming) → ready to implement.

**Line of sight:** HELM hands-on flight + Orrery (God's-eye) navigation are the player's
two primary ways of moving through a system. Both currently have friction Max hit live:
the orbital map doesn't show orbits / doesn't move you on click, and HELM flight
accumulates uncorrectable roll because there's no roll axis. This serves the
flight-feel + exploration spine of the screensaver/game.

Two independent threads, shippable together or separately.

---

## Thread A — Orrery (God's-Eye / `CameraMode.TOY_BOX`) navigation UX

**A1. Orbit lines default-ON in Orrery only.**
- Today `Settings.showOrbits=false` (`src/ui/Settings.js:21`) drives `orbitsVisible`
  (`main.js:306`), applied per `OrbitLine.mesh.visible` (`main.js:4386`).
- Change: orbit-line visibility follows **camera mode** — ON in `TOY_BOX` (Orrery),
  OFF in `FLIGHT` (HELM) — so the cockpit view stays clean. The Settings toggle
  remains a user override of the default.

**A2. Click a planet in Orrery → fast smooth ease (~0.3s).**
- Today the Orrery/minimap planet-click flies a smooth supercruise burn via
  `focusPlanet`/`focusStar` (`main.js:6491`/`6553`, `scControls.flyTo`), and the
  Manual-mode body click (`main.js:9364-9369`) does the same.
- Change: in Orrery, planet/star click re-frames the God's-eye camera with a
  **fast (~0.3s) eased move**, not the full burn and not a hard snap. The eye can
  follow where the view went (preserves spatial orientation on the map).

**A3. Click another star system in Orrery → select, then confirm.**
- Today a background-star click routes through `trySelect` (`main.js:9329`) →
  `trySelectWarpTarget` (`main.js:9442`), which **selects + blinks** a warp target;
  the warp commits later via `beginWarpTurn`/`warpEffect.start`.
- Change: keep select+blink; **add: a second click on the already-selected star
  commits the warp** (in addition to the existing Space). No single-click
  system-leaving — guards against accidental warp-out.

---

## Thread B — Roll axis + key remap

**B2 root cause (verified):** HELM flight is **yaw+pitch only** — the virtual mouse
stick maps mouse-X→yaw, mouse-Y→pitch (`aimAssist.js`, `SupercruisePilot.js`,
`CameraPhysics.js` all carry `{yaw,pitch}`; `HeadMount.js:72` pins roll to 0).
`SupercruiseModel.update` integrates orientation by composing **ship-local
yaw+pitch increments** each frame (`SupercruiseModel.js:128-134`:
`euler.set(pitch, yaw, 0,'YXZ')` then `orientation.multiply(q)`). Composing yaw &
pitch in the body frame over a curved maneuver **accumulates roll** — the horizon
tilts and there's no axis to un-tilt it. This is inherent to free yaw+pitch
integration, not a stray bug line.

**B1. Add a roll axis.**
- `SupercruiseModel.turnInput` gains a `roll` field; `update` writes it into the
  `0` slot: `euler.set(pitch, yaw, roll,'YXZ')` (or an equivalent local-Z roll
  increment). Driven by **Q / E** (roll left / right) at a capped rate.

**B2. Roll behavior is per flight mode** (`FlightMode`, `flightModes.js:10`):
- **MANUAL** (`'you fly'`) → **control only**: ship holds whatever roll you leave it
  at; no auto-correct. Genre-faithful (Elite flight-assist-off).
- **ASSIST** (`'auto-flies to target'`) → **control + gentle auto-level**: when no
  roll key is held, a small corrective roll returns the ship toward level; Q/E still
  override. Kills the "I keep getting roll" annoyance in the assisted regime.
- **ALIGN** (transitional, `'nose centers on target'`) → folded with ASSIST
  (auto-level on). *Spec decision — flag for Max if ALIGN should instead be free.*
- **"Level" reference:** world **+Y** — VERIFIED as the system orbital plane normal
  (planets placed `cos→x, sin→z` about +Y: `StarSystemGenerator.js:380-381`,
  `main.js:4280-4281`). Roll the ship so its local up re-aligns with +Y projected
  perpendicular to forward (wings level to the system plane). Gentle gain; skip near
  the forward‖up degeneracy (nose pointing at the world poles).

**B3. Key remap.** Q/E→roll and drive-toggle→R each displace a binding; two relocate.

| Key | Was | Becomes |
|---|---|---|
| **Q** | autopilot tour (`main.js:9217`) | **roll left** |
| **E** | supercruise drive toggle (`main.js:9145`) | **roll right** |
| **R** | minimap toggle (`main.js:9121`) | **supercruise/sublight drive toggle** (from E) |
| **C** *(free)* | — | **minimap toggle** (from R) |
| **Z** *(free)* | — | **autopilot tour** (from Q) |

Update the in-game keybinds overlay / any HUD hint text to match.

---

## Acceptance criteria

1. **A1:** Entering Orrery shows orbit lines by default; entering HELM hides them;
   the Settings toggle still overrides. No orbit lines bleed into the cockpit view.
2. **A2:** Clicking a planet in Orrery moves the view to it in ~0.3s with an eased
   (not instant, not full-burn) motion.
3. **A3:** First click on a background star selects+blinks it; a second click on the
   same selected star commits the warp; Space still commits. A single click never
   warps.
4. **B1:** Q rolls left, E rolls right in HELM flight, at a controlled rate.
5. **B2-manual:** In MANUAL, roll is held (no auto-correct) — bank and it stays banked.
6. **B2-assist:** In ASSIST, releasing roll returns the ship toward level on its own;
   Q/E still override while held.
7. **B3:** R toggles supercruise/sublight drive; C toggles the minimap; Z toggles the
   autopilot tour; no key does two things; keybind UI reflects the new map.
8. **No regression:** F free-look, M Orrery↔HELM swap, W/A/S/D, Space, and selection
   still behave as before.

## Out of scope / non-goals
- 6DOF translational strafe (only rotational roll is added).
- Touch/mobile roll (mobile is Orrery-locked; no HELM stick).
- Reworking the yaw+pitch integration math beyond adding the roll slot.
- Auto-level in MANUAL (deliberately excluded per Max).

## Risks
- **Auto-level reference:** RESOLVED — systems orbit in the world XZ-plane, so +Y is
  correct (see B2).
- **ALIGN ambiguity:** treated as assisted (auto-level); minor, confirm with Max.
- **Roll in the body-frame euler** changes the composition order; verify it doesn't
  interact badly with the existing yaw+pitch drift (roll is now intentional, so the
  drift becomes a feature in MANUAL and is corrected in ASSIST).
- **Muscle memory:** C/Z are non-mnemonic; acceptable per Max (low-churn pick).
