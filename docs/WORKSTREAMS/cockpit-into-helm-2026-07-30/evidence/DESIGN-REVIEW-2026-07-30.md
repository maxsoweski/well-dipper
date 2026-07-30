# Increment 7 — design review, 2026-07-30

A 9-agent workflow ran before any code was written: **5 read-only seam mappers** (lab assembly,
render seam, regime seam, overlay surfaces, autopilot sequence) → **1 design** → **3 adversarial
lenses** (boundary drift, two-instance/retirement, regression surface).

**133 findings · 46 mapper risks · 42 objections (8 blockers, 18 serious, 16 minor).**
All three lenses returned `SOUND_WITH_FIXES` — directionally right, eight holes.

## Why this ran before implementation

Two structural questions get expensive once code exists: where the rig module's boundary sits, and
how ~32 existing `_navComputer` references resolve now that there are two instances. Both were
attacked and both moved. The review modified no file, so it cost nothing to be wrong.

## ⭐ Three claims were spot-checked against source before acting. All three held exactly.

1. **three r0.183 hard-forces `NoToneMapping` for non-XR render targets** — verified verbatim in
   `node_modules/three/build/three.module.js`.
2. **The lab tone-maps and the game cannot** — `cockpit-screens-lab.html:466-467` sets
   `ACESFilmicToneMapping` + exposure `1.25` on a straight-to-canvas render.
3. **The 320-square minimap is operable, not a readout** — `main.js:10253-10257` calls
   `autoNav.jumpToStar()` / `jumpToPlanet(hit.planetIndex)` from a click inside the circle.

Agent reports are leads, not authorities. These three were load-bearing enough that acting on a
wrong one would have shaped the whole increment.

## The eight blockers

### B1 — [drift] That extracting the scene, lights and GLB into one module makes the two hosts' cockpits the same cockpit — and that the planted-light-intensity probe would catch it if not.

**Failure:** The two hosts render the identical rig under DIFFERENT tone-mapping regimes, and the boundary makes that invisible. The lab renders the cockpit straight to the canvas with `renderer.toneMapping = ACESFilmicToneMapping; toneMappingExposure = 1.25` (cockpit-screens-lab.html:466-467). The game renders it into `cockpitTarget` — and three 0.183.1 hard-forces `toneMapping = NoToneMapping` for any non-XR render target: in node_modules/three/build/three.module.js, `let toneMapping = NoToneMapping; if (material.toneMapped) { if (_currentRenderTarget === null || _currentRenderTarget.isXRRenderTarget === true) { toneMapping = _this.toneMapping; } }`. main.js:3831-3833 already records this exact fact ("canvas: SRGB + renderer.toneMapping; offscreen target: LinearSRGB + none"), and RetroRenderer sets no tone mapping at all (RetroRenderer.js:46-59). Concretely: DEFAULT_COCKPIT_LIGHTS' key light is a DirectionalLight at intensity 2.2 (lab :495). On a mid-grey MeshStandardMaterial at NdotL≈0.7 the linear radiance is ~0.9-1.3 — ACES at exposure 1.25 rolls that off; NoToneMapping clips it flat to white. Same for the panels' emissive (white emissive × warm-off-white ink). So the raked surfaces Max judged, and the CRT highlight structure the whole one-ink design rests on, do not reproduce in the game. And the design's chosen probe — change a light's intensity, both hosts move — PASSES while the pictures materially disagree, which is precisely the failure AC-ONE-RIG-TWO-HOSTS exists to prevent. Note the fix is NOT setting `renderer.toneMapping` around Pass 2.5: per the three source above, that has no effect on an offscreen target.

**Fix taken:** Make the tone regime part of the rig's contract, not the host's. Either (a) delete the lab's ACES + 1.25 (cockpit-screens-lab.html:466-467) so both hosts are NoToneMapping, and re-tune DEFAULT_COCKPIT_LIGHTS under Max's eye in the lab before first light — one lab session, and it keeps ONE rig honest; or (b) apply an explicit ACES curve + 1.25 exposure to the cockpit sample inside the composite fragment (RetroRenderer.js:606-613) and export the two numbers from the rig so the lab reads them too. Either way, name the chosen regime in the rig's header as a boundary invariant.

### B2 — [drift] That `camera` is purely host state the rig only reads — so the eye camera needs no representation in the module.

**Failure:** The eye camera's FOV then exists in neither host's contract, and the two hosts get different cockpits with no module change. The lab pins it: `GAME_FOV = 70` with the comment 'src/ui/Settings.js:40 — the FOV the framing is judged at' (cockpit-screens-lab.html:305), `new THREE.PerspectiveCamera(GAME_FOV, GAME_ASPECT, ...)` (:474). The game side specifies nothing: the design's `_poseCockpitCamera` writes only position and quaternion, and RetroRenderer.js:813-814 writes only `aspect`. Two concrete failures. (a) If `_cockpitCamera` is constructed with three's default 50° fov, first light shows a cockpit subtending ~40% more of the view than Max approved, and `PanelMover` re-solves fill from the live fov every solve (PanelMover.js:294-310) so the zoomed panel lands at a size he never judged — with nothing to say so. (b) index.html:190 gives Max a live FOV slider (`data-setting="fov" min=30 max=120 step=5`), wired at main.js:3171-3173 to `camera.fov` ONLY. Set it to 30 and the world behind the canopy zooms in while the canopy stays at its own fov: the aperture stops framing what is behind it, parallax is wrong, no error. Also worth noting: AC-ONE-RIG-TWO-HOSTS' own observable names "a light's intensity OR THE EYE CAMERA'S FOV" as the plantable divergence, and under this boundary there is no fov in the module to plant — half the AC's stated verification is unsatisfiable by construction.

**Fix taken:** Export `EYE_FOV = 70` (and `EYE_NEAR`/`EYE_FAR`) from CockpitRig.js as the single source; both hosts construct their camera from it — the lab replaces its GAME_FOV const, so a planted fov change moves both. Then add `case 'fov':` in applySettingChange (main.js:3171) to also write `_cockpitCamera.fov` + `updateProjectionMatrix()`, or record the explicit decision that the cockpit ignores the slider and accept the aperture mismatch. Do not leave it unspecified.

### B3 — [two-instances] "One regime applier for the 320-square HUD pass, hooked at setScManual — the universal regime-flip point — rather than at the ~14 scattered setHud call sites."

**Failure:** setScManual is the universal writer of `_scManual`, but it is NOT the universal writer of the HUD slot. Fourteen sites call `retroRenderer.setHud(...)` directly and several run in HELM after the applier last fired. The decisive one is inside spawnSystem: main.js:4756-4767 does `if (minimapVisible) retroRenderer.setHud(systemMap.scene, systemMap.camera)` on EVERY arrival. Concrete sequence: boot into HELM (setScManual(true) at :6402, applier suppresses the HUD) → warp → spawnSystem :4761 restores it → the 320-square minimap is back on top of the cockpit with no further regime flip to re-suppress it. Same for toggleGravityWell (:7132-7136, V key), exitGallery (:5366-5371), the C key (:10002), the mobile 'minimap' and 'gravity' actions (:11032, :11008). This is precisely the staleness pathology the design cites against `_showReticle`/`_applyPointerHud` — nine hand-placed applier calls that go stale because :6176 flips the regime without calling the applier — reproduced with fourteen call sites instead of nine. AC-OVERLAYS-RETIRE-IN-HELM fails after the first warp, and the failure is invisible in a boot-and-look verification pass.

**Fix taken:** Do not gate at setScManual. Gate INSIDE the slot instead: make `_applyHudVisibility()` (main.js:377-391) the only writer, add `_scManual` to its decision (`if (!_hudVisible || _scManual) setHud(null,null)`), and convert all fourteen direct `setHud(...)` sites to `_applyHudVisibility()` calls. Then call `_applyHudVisibility()` from setScManual. The 320-square slot then has one door, which is what the AC's own wording ("gated at the regime rather than at a visibility flag that something else can flip") actually asks for.

### B4 — [two-instances] buildOrder step 7 says "onWarpReady/COMMIT dispatching off the live instance", and the insertionPoints list has an entry for onWarpReady (:2504-2513) but NO entry anywhere for the cockpit instance's commit callback.

**Failure:** The contract's outputs name four callbacks to install on the cockpit instance "mirroring main.js:2852-2867". Mirrored literally, the cockpit's commit callback is `nav._pendingAction = action; closeNavComputer();` (:2852-2856). In HELM `_domNavOpen` is false, so closeNavComputer's first line — `if (!el || !_navComputerOpen) return;` (:2914) — returns before `dispatchNavAction(action)` at :2926. Result: Max zooms NAV in the game, selects a destination, presses COMMIT, and nothing happens at all — no warp, no error, `_pendingAction` left set on the cockpit instance to fire on some later unrelated close. AC-COMMIT-FIRES-THE-WARP is the increment's single most visible AC and the design gives its wiring no insertion point, no line number, and no named function. The design's instruction "Leave closeNavComputer itself UNGATED" does not help: it is already gated, by the flag being renamed.

**Fix taken:** Add an explicit insertion point for the cockpit instance's four callbacks (inside the game's `makeNav(surface)` closure, since that is where the design already puts construction), and specify the commit callback as `_dispatchPendingNav(cockpitNav)` — the same read-null-dispatch helper the design already introduces at :2504-2513 — not `closeNavComputer()`. Also name where 'navOpen'/'navClose' sounds go, since the redirect bypasses :2874 and :2916.

### B5 — [two-instances] `openNavComputer`'s redirect plus `_beginHandsOffTourFromAnywhere` together handle the ORRERY→HELM autopilot paths.

**Failure:** Path 1 of the four ("the NavComputer autopilot button") is pressed while the DOM overlay is OPEN in ORRERY. `setOnAutopilotToggle` (:2863) now routes to `_beginHandsOffTourFromAnywhere`, which calls `setScManual(true)`. Nothing closes the overlay. Concrete end state: `_domNavOpen === true`, `#nav-computer-overlay` still `display:flex` covering the screen, `_navRenderLoop` (:3049-3052) still driving the DOM instance at rAF — and the cockpit pass now rendering underneath it, invisible. Worse, `liveNavComputer()` now returns `_cockpitNavComputer`, so `:2478` reports a level Max cannot see while the overlay he IS looking at is the other instance; and if the tour completes from here, `_autopilotNavSequence._nav = liveNavComputer()` (:2531) binds the COCKPIT instance while the DOM overlay is the visible surface — the screensaver performs on a panel behind a full-screen overlay. Same path via the mobile dock: 'nav' (:10964-10966) then 'autonav' (:11011). This is a direct violation of AC-OVERLAYS-RETIRE-IN-HELM's "None of the retired elements is in the DOM's rendered tree in HELM", produced by a path the design routes deliberately.

**Fix taken:** The HELM-entry applier (the same one hooked at setScManual) must close the DOM overlay on the ORRERY→HELM transition: `if (on && _domNavOpen) closeNavComputer();`. Put it before the cockpit gate so the pending-action dispatch still runs through the normal door.

### B6 — [regression] The build order is presented as the risk control that makes the un-split increment safe — step 8's rationale says each retirement 'is safe only because the cockpit is already proven by steps 3-7'.

**Failure:** Steps 3-7 are proven by AGENT-driven integration checks. The one gate that can say 'this panel is the wrong instrument' — AC-IT-FEELS-LIKE-FLYING-FROM-INSIDE, contract.json:170-176, 'UAT, Max's gate alone... No agent drives or passes this' — is scheduled in step 11, AFTER every deletion. So the overlays Max would compare a wrong panel against are gone before he has ever looked at the cockpit. The design already knows the fix and writes it down without taking it: step 7's rationale says '⭐ EVERYTHING TO HERE IS PURELY ADDITIVE: stop at this step and the game is strictly better than before, with every overlay still present to compare a wrong panel against.' That sentence is a checkpoint the plan declines to use. Concrete failure: INFO answers about focusIndex while BodyInfo answers about the selected body (the design's own decisionsForMax #3) — with BodyInfo already deleted at step 9, Max's first look at INFO in step 11 has no reference surface, and the recovery is a revert of four commits rather than a comparison.

**Fix taken:** Insert a hard stop between step 7 and step 8: commit, push, hand to Max for a first-light UAT pass with every overlay still live, and only then start the retirements. This is NOT the increment split he declined — the increment still ships whole; it is one pause inside it, at the seam the design itself identifies.

### B7 — [regression] twoInstanceStrategy Step C + insertionPoints src/main.js:6538-6543: the cockpit NavComputer's state is kept current by a `_syncNavComputers()` applier carrying setPlayerPosition / _currentSystemName / setAutopilotState / setExternalTarget.

**Failure:** `openToCurrentSystem` is missing, and openNavComputer:2898 is its ONLY caller in the whole file. It is the call that sets `_systemStar`, `_selectedNavStar`, `_systemData`, `_currentSystemData`, `_systemMode='system'`, `_systemZoom=1.0` and `_levelIndex=4` (NavComputer.js:338-353). The design's very first statement in openNavComputer is `if (_scManual && cockpitRig) { _zoomCockpitNav(); return; }`, so on the cockpit instance it is never called at all. Two concrete failures: (a) AC-ZOOM-AND-WORK-THE-MENU-IN-GAME's 'a planet opens planet detail' cannot pass — the SYSTEM renderer reads `const sys = this._systemData` (NavComputer.js:2164) and `_systemData` is null on that instance; (b) after every warp the cockpit NAV still describes the PREVIOUS system, because `_currentSystemData` is written only at NavComputer.js:346. `setCurrentBody` (:2882) is likewise absent from the applier's list even though the design keeps the `_syncNavBody` site.

**Fix taken:** Add `openToCurrentSystem(currentStar, sysData)` + `setCurrentBody(focusIndex, focusMoonIndex)` to the cockpit instance, fired on SYSTEM ARRIVAL (beside the `_currentSystemName =` write at main.js:4826 / warpRevealSystem), not from the focus sites.

### B8 — [regression] insertionPoints src/main.js:6538-6543: 'Also add setPlayerPosition / _currentSystemName / setAutopilotState / setExternalTarget to one `_syncNavComputers()` applier, called from the existing sites.'

**Failure:** The existing sites are the four `_syncNavBody()` calls — inside focusShip (:6927), focusPlanet (:6983), focusStar (:7036), focusMoon (:7078), which fire on Tab, 1-9 and dispatchNavAction's burn branch. `setPlayerPosition` is destructive, not a sync: NavComputer.js:912-930 does `_localStars = []`, `_resetPrismLoad()`, `_selectedNavStar = null`, and rewrites `_localCenter`/`_localCubeSize`/`_localRadius`/`_localGridCell` and the view stack. Concrete: Max zooms NAV in HELM, drills to PRISM, selects a star, then presses Tab to look at a planet — the prism view snaps back to the player's position and the selection is gone. Worse during the screensaver: if a focus change lands while `_selectStar` is inside its 20 × 300 ms `_localStars` retry (AutopilotNavSequence.js:375-388), the list is emptied under it, no pick happens, and `_finish()` runs with no `_pendingAction` — the silent dead-end the design's own risk #7 describes.

**Fix taken:** Split the applier in two: an ARRIVAL applier (setPlayerPosition + openToCurrentSystem + _currentSystemName + setExternalTarget) fired once per system, and a FOCUS applier (setCurrentBody only) fired from the four existing sites.

## Build order (11 steps)

Steps 1-7 are **purely additive** — stop anywhere in them and the game is strictly better than
before, with every overlay still present. Step 8 is the point of no return.

1. **Extract CockpitRig and convert the lab into a caller. Promote paintNavHoldingCard into src/cockpit/panels/. Update the lab's two text-scan tests honestly (shorter lists, not looser assertions).**
   - closes: `AC-ONE-RIG-TWO-HOSTS, AC-BASELINE-GREEN`
   - why here: Nothing else can be built without it, and building the game path first creates the second copy this AC exists to prevent. Verified by: the lab looks and probes identically (all ~30 probe methods, perturbScreens/restoreScreens via rig.remount()), plus a headless planted-divergence test — change a light's intensity in the module and both hosts move.

2. **The render seam, cockpit dark. setCockpit + cockpitTarget + Pass 2.5 + the composite uniform and sample + resize wiring + the explicit autoClear=false + the SceneInspector 'cockpit' entry + the compileAsync warm-up.**
   - closes: `—`
   - why here: A pure renderer capability with setCockpit(null,null) everywhere: suite green, zero visual change, hudEnabled unchanged. It must precede first light because the pass is where the HELM gate physically lives, and it must come before anything that hands it a scene so a failure here cannot be confused with a rig failure.

3. **First light. Construct the rig in the game, HELM-gate it fresh from _scManual per frame, pose the cockpit camera from scHead + shake, settle the viewport convention and expose window._cockpit.viewport().**
   - closes: `AC-COCKPIT-IS-THERE, AC-HELM-ONLY, AC-LETTERBOX-Y-SETTLED-HERE`
   - why here: The first thing Max can see, and every later step is judged against it. Boot HELM → cockpit on screen with the world behind the aperture; M to ORRERY → no pass at all; the hands-off tour → still there (scActive at :8521 is true via `|| _scManual` throughout, so the plain regime gate suffices). Panels may still be drawing the empty-snapshot frame at this point — that is fine and is why step 4 is separate.

4. **Wire the snapshot feed: pass _cockpitSnapshotProvider.get() into rig.update() each frame.**
   - closes: `AC-PANELS-READ-THE-REAL-FLIGHT`
   - why here: Separated from step 3 so 'the cockpit is there' and 'the numbers are right' fail independently. Verified by changing throttle / selecting a body / targeting / engaging the drive and watching each panel, plus the write-through attempt landing nothing.

5. **The two-instance mechanism: rename, liveNavComputer(), the _navComputers registry, the catalogue fan-out, the named window handles, and the text-scan test that _navComputer is gone.**
   - closes: `AC-REAL-CATALOGUE-REACHES-THE-GLASS`
   - why here: Must precede any callback or routing work, because everything downstream reaches for 'the live nav computer' and doing this after would mean writing those references twice. Verified alone: both instances report both catalogues loaded, ORRERY's N still opens and drives, and the far-companion chip is drawn (Proxima → Alpha Centauri).

6. **The pointer router: rig.pointer wired into the game's four mouse handlers, gated on cursor-visible HELM, with the hover channel intact.**
   - closes: `AC-A-QUICK-CLICK-IS-ENOUGH, AC-ZOOM-AND-WORK-THE-MENU-IN-GAME, AC-FLIGHT-AND-ORRERY-SURVIVE`
   - why here: Needs a live NavComputer on the glass (step 5) to route into. Verified with a gesture that has NOTHING between press and release — hover onto a planet with the button up, then press and release without moving; the pointer census must show hover>0 and pressed-moves==0, and a control run with no preceding hover must do nothing. Do NOT verify with clickGlass, which fires down→move→up and is how increment 6's live pass walked past this bug.

7. **The nav callbacks, the autopilot routing and the screensaver: the four callbacks on the cockpit instance, the four autopilot paths routed through the HELM-preserving hands-off start, autopilot-OFF on _stopTourStayInShip, openNavComputer redirecting, and onWarpReady/COMMIT dispatching off the live instance.**
   - closes: `AC-AUTOPILOT-BUTTON-TOGGLES, AC-COMMIT-FIRES-THE-WARP, AC-AUTOPILOT-ALWAYS-HAS-A-COCKPIT, AC-SCREENSAVER-LOOP-STAYS-CLOSED`
   - why here: Last of the additive work; needs the router (a press has to reach the button) and the live instance. All four autopilot paths exercised individually — the wasAutopilot re-arm requires Shift+N or Shift+L, never a warp (spawnSystem returns at :4844 before the re-arm at :4896), and the two debug bypasses window._startFlythrough (:1854) and window._lab.beginAutopilotTour (:2105) call startFlythrough BARE, so driving either exercises the old path and proves nothing. ⭐ EVERYTHING TO HERE IS PURELY ADDITIVE: stop at this step and the game is strictly better than before, with every overlay still present to compare a wrong panel against.

8. **⛔ POINT OF NO RETURN. Retire SupercruiseHud's readouts (keep the centre cross and the deflection dot, keep the module and its source-text assertions on disk).**
   - closes: `AC-OVERLAYS-RETIRE-IN-HELM`
   - why here: The first step whose failure mode is 'something Max had is gone' rather than 'something new does not work yet'. It goes first among the retirements because it is the one whose replacement (DRIVE + TARGET) has been in front of Max longest, and because it is the only one carrying a control regression to mitigate. Every step from here is a deletion that only a revert undoes, and each is safe only because the cockpit is already proven by steps 3-7.

9. **Suppress BodyInfo in HELM at BodyInfo._show() via a setScManual-driven applier that also hides an in-flight printout, and add the warp-destination row to TARGET.**
   - closes: `AC-ORRERY-KEEPS-WHAT-IT-OPERATES`
   - why here: Paired with the TARGET row in one step because suppressing BodyInfo without it silently removes the only announcement of a warp destination — the snapshot carries warp.targetName and no panel reads it. Verified alone: ORRERY select shows info, HELM select does not, and a HELM warp commit names its destination on the glass.

10. **Gate the 320-square HUD pass OFF in HELM only, via one applier at setScManual. ORRERY untouched pending Max's ruling.**
   - closes: `AC-OVERLAYS-RETIRE-IN-HELM`
   - why here: After BodyInfo because it is the retirement with an unresolved conflict against a prior recorded ruling, and doing the uncontested half of the demolition first keeps this one revertible in isolation. Verified alone: no minimap or gravity well in HELM; C and V, both Settings rows and both mobile actions all still work in ORRERY.

11. **Delete DebugPanel.js:189-197 (COMP/ATMO/TIDAL only). Then the full suite, then hand to Max.**
   - closes: `AC-OVERLAYS-RETIRE-IN-HELM, AC-BASELINE-GREEN, AC-IT-FEELS-LIKE-FLYING-FROM-INSIDE`
   - why here: Smallest and last: three rows out of fourteen, behind a dev key, with no cockpit surface replacing the other eleven. Left to the end so the debug HUD's FPS, LOD and galactic-position rows are available as diagnostics throughout every earlier step.

## Contract corrections this review forced

- **The 320-square slot was mis-classified as a readout.** It is operable, a prior ruling already
  said 'GONE in HELM, KEPT in ORRERY', and the slot also hosts `GravityWellMap`, which has no
  NavComputer level, no cockpit panel and no snapshot field — so gating the whole slot off in HELM
  would delete gravity wells outright. Now: minimap suppressed in HELM only, V key live in both
  modes, ORRERY untouched.
- **Two surfaces were missing from the retire list**, both found by review: `#commit-burn-btn` (a
  DOM burn affordance that would sit beside the cockpit's own COMMIT — the exact contradiction
  DIEGETIC-ONLY exists to remove) and `#flight-mode-toast`. `#mode-swap-btn` must SURVIVE on
  mobile: it is mobile-HELM's only tour exit.
- **INFO describes the wrong body**, and retiring BodyInfo is what would have made it visible.
  Resolved from Max's own charter words — *'info about whichever system object is SELECTED'* — so
  INFO follows selection and the `focusIndex` wiring is the defect. He was not asked again.
- **The casualty hunt paid.** BodyInfo's radius line and its Rings / Clouds / Atmosphere chips have
  no INFO row and no snapshot field at all. Added before BodyInfo is suppressed, or this increment
  silently loses them — which is what `AC-NOTHING-I-HAD-GOT-LOST` is for.

## The one thing awaiting Max

**A hard stop between steps 7 and 8, for a first-light UAT pass before any overlay is deleted.**

Review's strongest finding, and it is about process rather than code. The build order calls step 8
the point of no return and schedules `AC-IT-FEELS-LIKE-FLYING-FROM-INSIDE` — the only gate that can
say *'this panel is the wrong instrument'*, and Max's alone — at step 11, **after every deletion.**
So the overlays he would compare a wrong panel against are gone before he has ever looked at the
cockpit. The design writes the checkpoint into step 7's own rationale and then declines to use it.

This is **not** the increment split he declined. The increment still ships whole. It is one pause
inside it, at the seam the design itself identified.

## Deliberately unresolved

- ORRERY's half of the minimap (retiring it there would also take the C key, V key, gravity wells,
  two Settings rows, two mobile actions and the 'now targeting' blink cue).
- Routing the four autopilot paths into HELM also fires `_updateModeSwapButton` and
  `_syncOrbitsToMode` (ORRERY orbit lines off). Both follow from the regime genuinely changing.
- The articulated arm: out of scope, wants its own scoping conversation.

## Transcripts

Run `wf_1c02b817-cf8` — per-agent returns in
`~/.claude/projects/-home-ax/87b9ca55-ddf2-485d-bc1a-66fb13c9c32e/subagents/workflows/wf_1c02b817-cf8/journal.jsonl`.
The 18 serious and 16 minor objections are there in full; they are implementation-time corrections
rather than plan changes, and are not restated here.
