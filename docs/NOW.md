# Now — Well Dipper

**This file changes every session. It's the single screen that says where we are.**

For longer arc, see `JOURNEY.md`. For meta-purpose, see `HEART_OF_DESIRE.md`.

> **🧭 Working the planet-LOD lab? READ `docs/FEATURES/planet-lod-CHARTER.md` FIRST** — it's
> the durable strategic frame (lab≠game by design, the program arc, the canonical model
> location). It exists because fresh sessions keep losing that wider context. Then NOW.md
> (this file) for live state + the tracker for which feature is next.
>
> **Parallel campaign note (2026-06-13):** The supercruise/warp content below remains the
> paused primary workstream. SEPARATELY, the **planet-LOD campaign** (tracker:
> `docs/FEATURES/planet-lod-campaign-tracker.md`; pickup memory `well-dipper-lod-terrain-campaign.md`)
> shipped **F51 rings v2** (3D-LOD particle ring, impostor far + emergent THREE.Points cloud near,
> 6 lab sliders) → 🟢 VERIFIED_PENDING_MAX `71eea7a`, Max approved-in-principle, awaiting his
> slider-driven UAT. Phase-4c remaining: F38 airglow + F39 cloud-optics (build both).
> Next session (Max's ask): **review the overall feature-development roadmap for the LOD lab**
> (`docs/FEATURES/planet-lod-campaign-tracker.md` — phases 1→7, F1–F51 status). Orientation,
> not a brainstorm. Handoff `/tmp/handoff-f51-lod-workstream-2026-06-13.md`.

> **Feature-association manifest — Tier-1 + Tier-2 landed (2026-06-14):** Tier-1 added the
> cross-source (vs-shader) test tier + grounded defect fixes (`modifies` DERIVED from
> `dependsOn.features`; massWasting deps→20 grad-writers; lakes→frost/dust/sunglint/cityLights;
> spurious lakes→rivers deleted; hexTess `rendersOnDivergent`). **Tier-2 (Phase 2 + 2.5) now
> SHIPPED (`4ae2507`, `cb05c43`, `9d13d01`, master, unpushed):** non-destructive solo +
> isolationKit-aware soloMode (`lab-isolation.js`, 7 tests); pure render-auditor
> (`lab-render-audit.js`, 3 tests); live GPU render-delta sweep (`window._lab.renderDeltaSweep()`
> over all 17 presets, :9223). **Audit report = `docs/FEATURES/lab-render-audit.md`** (generator
> `scripts/gen-render-audit.mjs`, raw `docs/FEATURES/.sweep-raw.json`). Measures PLAYER-VISIBLE
> render via a **natural-baseline** A/B delta (relevantFeatureSet ∪/∖ feature), 2 hemispheres × 3
> uTime samples. **Findings: 109 false-renders (92 solid), 85 dead-renders, 0 degenerate** —
> dominant: civilization overlays (machine/cityLights/ecumenopolis/bioMats) paint on ALL 17
> presets incl. gas giants (visually confirmed: Jovian in a city-lights grid); exotic geometry
> (hexTess/shatter) leaks onto rocky presets. **STOPPED at the report per plan — violations are a
> punch-list for Max to triage (manifest-wrong vs feature-buggy), NOT auto-fixed.** Methodology
> diverged from the plan's solo+kit baseline (documented in the report; flag for Max if a
> capability lens is also wanted). lightning dead-renders flagged LOW-CONFIDENCE (sparse transient).
> Tests: 21 green + 1 skip.
>
> **RECONCILED (2026-06-14): lab renderer ≠ game renderer — by design.** Max picked lens C.
> The lab's feature/archetype/association model is a **deliberately-decoupled staging ground
> for a next-gen planet renderer**, NOT the game's source of truth and NOT a throwaway sandbox.
> The game still runs the March-2026 **type-branch** shader (`Planet.js`, gated by a `type`
> string via `PlanetGenerator._pickType` → `ExoticOverlay.apply` → `_typeIndex` dispatch); the
> lab runs a **feature-composition** shader (`planet-lod-lab-core.js`, the F1–F51 campaign +
> provinces). They share ZERO shader code. Game-wiring is an explicitly-deferred, no-parity
> separate effort (Max-approved campaign spec, 2026-06-09 L8-9/L224) with no plan/scope yet.
> The "Venus/Mars cities" worry was a lab force-enable artifact — in-game Venus stays type
> 'venus' and never hits the city-lights branch. **Durable record + the deferred-port decisions:
> `docs/FEATURES/lab-vs-game-renderer-divergence.md` (keep until the port happens).**
> Handoffs: `/tmp/handoff-archetype-game-audit-2026-06-14.md`, `/tmp/handoff-manifest-tier2-render-audit-2026-06-14.md`.
>
> **▶ CURRENT FOCUS (Max, 2026-06-14): make the LOD lab itself good — not game-wiring.** Two
> phases: (1) **catalog — DONE 2026-06-14.** The comprehensive planet-type×feature×driver model
> already existed (`docs/FEATURES/planet-visual-features.md`: L0 drivers D1–D16 → L1 processes
> P1–P28 → L2 features F1–F53, + Appendix A 18 types), and the game's `PhysicsEngine.js` already
> computes those drivers (incl. `habitabilityScore` as a result of composition/atmo/magneto/orbit).
> The recent manifest had DRIFTED from it (hand-listed derived lab uniforms, 16/47 driver stubs).
> **Re-based all 47 on D1–D16:** new `planet-drivers.js` (canonical DRIVERS D1–D16 + PROCESSES
> P1–P28 transcribed from the model); each feature now declares `processes:[P#]` and DERIVES
> `dependsOn.drivers` (can't drift, like `modifies`). Overlays → `habitability` (cityLights/
> ecumenopolis/machine; bioMats); carbon → D10. Guard test rewritten (was Claim-8 skip) → 36 green.
> (2) **per-feature quality pass — IN PROGRESS** (Max picked: reuse the campaign per-feature UAT
> loop, spec §13; start = triage the Tier-2 109-false/85-dead punch-list, worst offenders first).
> **Triage round 1 LANDED 2026-06-14 (lab html only, verified :9223, 36 green):** the dominant
> false-render cluster (machine/ecumenopolis/cityLights/bioMats painting gas giants etc., ~52 of
> 92 solid) was ungated — coverage was a pure lab knob, never × the preset's D15 habitability,
> AND all 4 (+ hexTess/shatter exotic geometry) defaulted ON, so EVERY default view was a
> "blue-checkerboard city-world" (Max's report). Fix: (a) **default-OFF** machine/city/ecu/bio +
> hexTess/shatter (opt-in toggles; clean natural baseline); (b) **habitability gate** — `applyDrivers`
> stores `state.habGate = smoothstep(0.1,0.4, preset.habitability)`, the 4 overlay writers ×= it,
> so coverage→0 on hab≤0.05 worlds (gas giants/lava/frozen/europa/titan/venus/mars/magma/carbon/
> crystal) even when force-enabled. Verified: Jovian force-all-overlays-on → clean bands+GRS;
> Rocky → ecu paints. **DECISION PENDING (Max):** the hab gate also zeroes Venus(0)/Mars(0.05) —
> in some overlays' declared `rendersOn` — and can't tell Mars from Titan (both 0.05); if Max wants
> colonies on Mars/Venus the right gate is archetype-membership, not habitability. **Remaining
> triage:** hexTess/shatter still leak if force-enabled (need archetype gate); surface-relief cluster
> (mountains/dust/lava/frost/glacial on wrong presets, ~20); prune manifest rendersOn to match the gate.
>
> **▶ SESSION 2026-06-15 (orange-belt + surface-relief triage, handed off mid-stream):**
> (1) **F35 terminator "orange belt" FIXED** (`c4b46cf`, VERIFIED_PENDING_MAX) — Max-reported orange
> band on every planet type was F35 terminator-gradient strength flat 0.5 × saturated hue → swamped
> surface. Dropped to 0.15 (width ramp untouched). Live-verified Rocky+Venus. Tunable via live sliders.
> (2) **Relief triage — research + Bucket A SHIPPED** (`be989f4`, VERIFIED_PENDING_MAX, 36 green).
> 7 research subagents grounded each surface-relief false-render in planetary science → **~half were
> the MANIFEST being too narrow, not driver bugs.** Bucket A broadened rendersOn+archetypes: frost/
> glacial/sublimation+Europa, mountains+Lava (Io), lava/edifices+Venus, craters/ejecta+Mars/Rocky/
> Eyeball, massWasting blanket-all-solid. Verdict table: `docs/FEATURES/relief-triage-verdicts-2026-06-15.md`.
> (3) **Bucket B (driver tightening) — SHIPPED 2026-06-15** (`5ef6ca9`, VERIFIED_PENDING_MAX, 173 green).
> Density-based `rockyCrust` gate (smoothstep 2.5→3.9 g/cm³) on the silicate-relief family
> (mountains/lava/edifices/tessera) kills it on icy worlds (Europa/Titan/Frozen) while keeping
> Io-grade Lava/Magma/Venus/Rocky/Ocean/Mars; `_noSurface` gate zeros dust on the 5 h2-he giants;
> `_opaqueHaze` gate kills weatherBands on Titan. Numeric sweep (17 presets) + Europa visual confirm.
> Render-audit **refreshed** (`248b355`): false-renders 109→64, dead 85→51; targeted leaks all cleared.
> Residuals (expected): Carbon/Crystal mountains (exotic), faint craters on Ocean/Europa (next round).
> **All session commits PUSHED to origin/master.** Remaining solid cluster = shatter/hexTess (exotics
> on non-exotic worlds) — distinct future triage, not this workstream.
> (4) **Max's bigger ask = MENU/INFO OVERHAUL** (his goal #3) — ◀ **NEXT, needs Max brainstorming first
> (real UI design).** relevance indicators + per-feature info cards + archetype info view + auto-correct
> mismatches + a USABILITY/QA pass (menus too complex, dedup archetype-selector vs indicator). Substrate
> exists: `relevantFeatureSet()`/`applyArchetypeFilter()` (~L7067). Handoff `/tmp/handoff-lod-triage-round3-2026-06-15.md`.
> (5) **Parking-lot:** "outpost worlds" feature idea (Mars/Venus-type sparse nightside outpost lights,
> distinct from ecumenopolis/cities) — capture as a NEW campaign feature (dossier card + heavy loop), NOT inline.

Last updated: 2026-06-10 by working-Claude (flash session: **Max's entry flash FIXED `4278037`, VERIFIED_PENDING_MAX.** Root cause was NONE of the handoff's 4 candidates — it predates the swap: `updateTraversal` ran in simStep (60Hz) while the rendered camera interpolates per render frame (240Hz), so the camera crossed Portal A's plane up to ~4 rendered frames before the mode flipped; those frames drew stencil-ON with the disc behind the camera → empty stencil mask → tunnel invisible → ~3 frames (~12ms) of raw origin sky. Proven by in-page per-frame canvas capture frame-aligned with signed plane distance (sky-bright frames == sd<0 ∧ OUTSIDE_A exactly, 2 pre-fix warps). Fix: detection moved to renderFrame after camera interpolation. Post-fix: 3 warps, 0 stale frames (was 3/warp), flat crossing brightness, no AC4/AC10 warnings. Headless 54/54. Prior session's 3 goals all VERIFIED_PENDING_MAX `c85480f`. TEMP `__swapTiming` instrumentation still in main.js — remove before workstream ships. **Pushed + Pages deploy green 2026-06-10. Flash fix UAT-PASSED, belts CONFIRMED, far-opening residual CONFIRMED FINE — Max, post-fix ride. All 3 goals + flash SHIPPED.** Next (Max, 2026-06-10): arrival distance — exit farther from system center so star(s) show as billboards on emergence, consistent with the starfield-version of the star seen from the origin system when warping via starfield targeting (vs nav comp). **ARRIVAL-DISTANCE IMPLEMENTED same day (`4afd58e` `29405f5` `04d3437`, master, unpushed): orbitDist now derived from new `StarFlare.billboardSwitchDistance()` × 1.3 (knob `window._warpArrivalMargin`), both warp paths, binaries take max+sep. Spec/plan in docs/superpowers/{specs,plans}/2026-06-10-warp-arrival-billboard-distance*. 6/6 unit tests; subagent spec+quality reviews clean. **Live verify (Task 3) COMPLETE — ARRIVAL-DISTANCE VERIFIED_PENDING_MAX `04d3437`.** 5 controlled warps all-state-tools (no screenshots, game muted per Max's directives): warp 1 full PASS (prior session), warp 3 starfield emergence PASS w/ in-eval center-raycast + >100px mesh sweep (only sky-dome scenery; NO giant flare — §3 anomaly did NOT reproduce at 2 instrumented emergences, CLOSED as runaway-tour scenery), LOD crossover observed BOTH directions (disc 3186–3408 / billboard ≥3631, brackets switchDist ≈ emergence/1.3), nav-comp path PASS via real AutopilotNavSequence (overlay→commit→dispatch→arrival), binary (M+M, seed 175217743) BOTH stars `bbVis=true, discVis=false` at emergence incl. the dim-companion +sep worst case, large-orbitDist arrival ~4.9k units clean. Note: dist-at-idle-detection jitters around orbitDist (coast before / fly-in after the idle flip) — invariant is billboard-range emergence, held every observation. Console: only the known pre-existing travel-telemetry oscillation warning; no AC4/AC5. Fresh: 6/6 unit, build clean. Seed-targeted nav-data warps work from console (replicate `_setWarpTargetFromNavStar` field writes on `window._warpTarget` + `_beginWarpTurn`). **Max UAT next: ride starfield + nav-comp warp, tune `window._warpArrivalMargin` (default 1.3, read per-warp) — confirmed value gets baked. Then remove TEMP `__swapTiming` + push on Max's word.**

---

## Active workstream

**`supercruise-freelook-2026-06-10`** — **AUTOPILOT HALF BUILT (Tasks 1–7 of 13),
paused at a clean seam 2026-06-10.** Elite-style supercruise is now THE in-system
mover for the **autopilot**: tour legs AND post-warp fly-in both fly the new
`SupercruiseModel` (one model, two drivers). Manual piloting / freelook / HUD /
old-mover retirement (Tasks 8–13) deferred to a fresh session.
Contract (9 ACs) + intent + plan:
`docs/WORKSTREAMS/supercruise-freelook-2026-06-10/` +
`docs/superpowers/plans/2026-06-10-supercruise-freelook.md`.
**Built + committed (all unit + live-verified on GPU :9223):**
- `src/flight/SupercruiseModel.js` — nose-vector flight, throttle, gravity-well
  speed cap (scale-free: `CAP_MIN_FRAC` 0.5 + `CAP_MIN_ABS` 1e-5 — production
  radii span 4e-5…5, two scale bugs found+fixed live), capped turn rate. 40 unit tests.
- `src/flight/HeadMount.js` — rotation-only head/ship split (hold-to-look, eased
  recenter); ready for Task 8/10 input wiring + the future cockpit (computed math,
  NOT Object3D parenting — WorldOrigin rebase constraint).
- `src/flight/SupercruisePilot.js` — ALIGN/CRUISE/HOLD autopilot driver issuing the
  SAME throttle/steer a player will; drop-window capture vs overshoot; HOLD settle ease.
- `src/main.js` — sc mover branch in simStep (drives `ShipChoreographer` for the
  AC6 shake beats); tour-leg + warp-fly-in cutover; `_seedScPoseFromCameraIfIdle()`
  helper; warp-path pilot stops; `window._sc` live-tuning probe.
- Commits: `53f4766 b09015d a258eeb 5b5dcfe f40f59c de78ab7 a710919 64a614a 51cd579 259f855 d5e4e2f 2fd8981 0dce7b3 ec0f932` (master, UNPUSHED).
**NOT yet built (Tasks 8–13):** manual W/S throttle + mouse virtual joystick + F→manual
takeover + manual drop (AC3); freelook input binding (AC4 live); minimal HUD
speed/throttle/reticle/target (AC7); COMMIT BURN cutover `focus*`→pilot, `focusShip`
quarantine (AC5c); retire AutopilotMotion + NavigationSubsystem from live path (AC8
loop + Task 12); full verify-workstream + Max UAT (AC9).
**Handoff:** `/tmp/well-dipper-supercruise-handoff-2026-06-10.md`.
**Maps to journey:** rebuilds the travel-loop foundation the 35% SCREENSAVER-MVP
autopilot rides; first GAME-tier (85%) capability lands with Tasks 8–10.
**⚠ Live tree note:** the screensaver autopilot now flies supercruise — if Max runs
the dev server before Tasks 8–13, the tour/warp loop works but manual F-mode still
routes to the legacy FlightDynamics drive (not yet rewired).

### Prior active (pending-UAT items remain)

**`warp-tunnel-pocket-traversal-2026-06-06`** — **cruise-visual tuning.**
**Problem #2 (walls reverse halfway) FIXED `8bda388`, VERIFIED_PENDING_MAX.**
Root cause: two opposing wall-motion sources — the constant `uScroll += dt*0.5`
drift (static-camera lab holdover) vs real camera parallax; the AC5 dead-stop
park exposed the drift as a reversal. Per Max's decision (continuous flight):
drift removed; park is now a soft creep (`parkBackDepth()` in
`portalTraversal.js`, eases 20u→6u over min-cruise, entry-depth-capped so the
swap's shallow drop-in — measured ~14.7u live — can't re-freeze it). Live
telemetry (GPU 9223, 241fps, 3 warps): uScroll 0 throughout, zero frozen frames
(was 280/843 gated), real INSIDE→OUTSIDE_B crossings, no AC4 force-flip.
Headless 37/37. **Max UAT: ride warps — does the reversal go away?**

**Task B blocker FIXED `87d5560`, VERIFIED_PENDING_MAX** — distB at cruise start
was ~15-32u (varying), not 60: the swap fires at the Portal-A crossing DURING
enter, and the remainder of ENTER (22.5→45 u/s, up to ~1.5s) flew the camera
into the fresh pocket before HYPER. Fix: enter→hyper at `_swapFired` (WarpEffect)
— cruise now starts at the full pocket length (live: 59.8/58.1 across 2 runs,
deterministic; speed snap at the seam also shrank, ~26→20 vs 45→20).

**Max rode both fixes (UAT positive: "Much better already" / "Quite good") and set
3 next goals (2026-06-09, his words):** (1) Portal A spawns too far away — often
behind the nearest planet; should spawn "like 100m away"; (2) asteroid belt shows
through the tunnel walls; (3) entry hitch — "everything stops moving" at tunnel
entry. Target feel for all three: *one* long tunnel; after a few seconds of travel
the far end appears, grows, and the new system shows through it.
**3-goals session 1 (2026-06-10): Goal 1 shipped `ec47b84` (spawn 10u, live-verified,
window._warpPreviewDist UAT knob). Goal 3 partially fixed `db2388d` (swap compile
gate; stall inventory + open leads in handoff). Goal 2 statically diagnosed
(logdepthbuf mismatch), no fix yet.**
**3-goals session 2 (2026-06-10 cont.): Goals 2+3 FIXED** (`81fe37b` `094e8a2`
`f75842e` `c85480f`). **All 3 goals VERIFIED_PENDING_MAX. Max RODE it → flagged
"a little flash where the tunnel disappears after we enter it."**
**Flash session (2026-06-10): FIXED `4278037`, UAT-PASSED + SHIPPED (deployed)** —
sim-vs-render cadence bug at the Portal-A crossing, NOT a swap/load artifact; no
latency spent (Max's offered levers unneeded — load was already hidden; see
Last-updated line). Known residual nobody has felt yet: the far-end opening shows
black (gated sky) for the ~0.4s compile
window post-swap, then destination stars pop in — small (3u opening at ~60u),
measured sub-0.2%-of-pixels; fix candidates exist (keep old sky alive through
the gate) if he feels it. Other residuals: one unattributed ~530ms hyper frame
(1-in-10, likely GC).
**Handoff trail: `/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-10b.md`** (its
§0 candidate mechanisms 1-4 all ruled out by evidence; §3 test method still current).
Older: `/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-10.md` (§3 test method
still current; §1-2 closed).
Older context: `/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-09b.md`,
`/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-07b.md`,
`/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-09.md`.

Prior sub-state — **Tasks 0–3 DONE; entry-reliability
Fix D implemented + live-verified, VERIFIED_PENDING_MAX (UAT).** Root cause was the
off-axis approach (camera advanced along mid-slerp facing, missing the 3u gate).
**Fix D** (`src/main.js` ~6753, UNCOMMITTED): advance camera *position* along the
locked `_tunnelForward` axis (orientation slerp unchanged); guard falls back to
facing post-swap. Preserves AC2 → no contract change. **Live result (GPU 9223, full
speed): fresh enterSol → 12/12 ALL_REGISTERED; 13–24 consecutive → 10/12.** Headless
`warp-tunnel-rebase.test.js` 4/4. Residual deep-state 2/12 = finding-#4 turn-alignment
accumulation (DEFERRED, separate thread). Off-axis root cause + Fix D writeup:
`docs/WORKSTREAMS/warp-tunnel-pocket-traversal-2026-06-06/entry-reliability-rootcause-2026-06-06.md` (session-3 addendum).
- Plan (8 tasks, 4–7 not started): `docs/superpowers/plans/2026-06-06-warp-tunnel-pocket-traversal.md` (`31b3c93`)
- Telemetry committed `4fc9a36`; warp commits (UNPUSHED, master): `5a94a19` (T0), `1427ebb`+`9c334c2` (T1), `a16d617`+`39fa8f2` (T2), `7064478` (T3)
- **Next:** Max UAT (ride warps — into Portal A / cruise / out Portal B, repeats + far targets) → commit Fix D → resume T4–7. Deferred: finding-#4 turn-alignment accumulation.

**Maps to journey:** Travel-loop signature moment (35% SCREENSAVER-MVP).

### Also pending Max UAT (separate)
- **`warp-landing-strip-persists-2026-05-10`** — VERIFIED_PENDING_MAX @ `e31ee65`.

## Next 1-3 queued (in priority order)

0. **`planet-refinement-campaign` — Phase 4b DONE 2026-06-10
   (`5460789`…`e5e9a45`, two sessions): all 10 atmosphere cards built +
   verdicted 🟡 taste-call VERIFIED_PENDING_MAX — F24-F26 bands, F27-F29
   storms, F30 lightning (emissive point process; review caught
   cell-boundary blob clipping pre-verify; 1 tune: intensity 2→4),
   F31 clouds family (regime dispatch: weather/haze/venus/eyeball; Rocky
   coverage 0.9→0.645 rebalance — the F26 burial fixed; F31e shells
   parked for 4c/F34), F32+F33 thermal pair (one energy-balance curve,
   two owned consumers, superrotation offset A/B'd). SEVEN new presets
   this phase: 3 gas giants, Venus, Sub-Neptune, Eyeball, Hot Jupiter
   (+ new hot-jupiter archetype). Vitest 19/19; evidence shots repo root
   (F24-*…F33-*). Taste forks recorded per card §7 for the Phase-7
   lap.** Next: Max starts a FRESH session and pastes the tracker's
   **Phase-4c `/goal` launch card** (optical+exotic+overlay+rings,
   15 cards + F38/F39 call). Session notes that carry: same-tick uniform
   reads lie (double-rAF or read state.*), freeze jetSpeed before A/Bs,
   sessionStorage restores stale solo/knob state over reloads (re-run
   setPreset + re-enable gates), solo() kills the bands substrate for
   band-riders (lightning/thermal are emissive-channel, immune).
1. **`warp-landing-strip-persists` Max UAT** — confirm the fix in Max's
   browser, then flip to Shipped + push.
2. **`warp-tunnel-second-half-not-rendering`** — **SHIPPED 2026-06-10:
   Max UAT-passed ("Looks like it works!") `1787c3f` + `2c23ee8`, pushed
   same day** (no rewrite needed). Arrival-distance (`04d3437`) UAT-passed
   in the same ride — margin stays at default 1.3 (no tune requested). TWO independent causes, both reproduced per-frame on GPU 9223
   after Max's UAT report ("freeze + second half missing on binary
   destinations"): (a) Portal-A re-anchor margin 1e-10 < float64 rounding
   at destination coords → spurious INSIDE→OUTSIDE_A one frame post-swap
   → disc B can never reveal, AC4 silent; binary correlation was larger
   orbitDist coords, not binarity. Margin → 0.5u + anchor from portal pos.
   (b) Null-seed known objects (IC1396/IC434/CasA/IC2602 — no messier/ngc)
   crash SkyFeatureLayer._hashSeed inside onSwapSystem → gate held, AC4
   stall, arrived system stranded with no sky/starfield. Seed falls back
   to catalog key + _hashSeed fails soft. 12-warp post-fix ride clean
   (dotA −0.5 invariant, everB all warps incl. binaries); IC1396-adjacent
   warp clean + follow-up warp not stranded. Tests:
   `portal-traversal-margin.test.js`, `known-object-feature-seed.test.js`.
   **NEW LATENT BUG found while pinning (separate, unfixed): IC434
   Horsehead shares IDENTICAL galacticPos with M78 and the known-object
   injection dedup splices it — Horsehead never renders anywhere.**
   Also shipped 2026-06-10: **default-mute** (`19134e9`) — app opens
   silent every load; session-only "Sound Enabled" checkbox in settings.
3. **`world-origin-reset-on-system-swap-2026-06-04`** — SCOPED (`466a0c5`),
   **awaiting GATE 1**, queued behind MVP. Structural fix to the rebasing
   bug class (wire dead `resetWorldOrigin()` + invariant test). Full review:
   `~/briefings/well-dipper-rebasing-review-2026-06-04.md`. (Rebasing fix
   #2 — duplicate-call/telemetry — committed `a1a01b6`, not pushed, live
   telemetry confirm pending.)

## Recently shipped

- **world-origin spawn-once-body centering** (2026-06-04) — single (non-binary)
  system stars, planet orbit rings, and asteroid belts were spawned at the raw
  scene origin and never rewritten per-frame, so in warp-reached systems they
  were displaced from the barycenter by `worldOrigin`-at-spawn (star "above the
  orbital plane"; rings/belts off-center). Fix: seed each into the rebased frame
  at spawn via `WorldOrigin.placeInRebasedFrame` (`main.js` single star @3557,
  binary-star rings, planet ring, belt; new `WorldOrigin.js` export). TDD'd
  (`tests/orbit-ring-rebase.test.js` — star invariant + characterization), Tester
  PASS, verified live: single-star `|planet−star| == orbitRadiusScene` 0% error +
  coplanar, planet rings centered on star/barycenter with exact radii, binaries
  unaffected. (WU7a `3946dca` deployed alongside — Tester PASS, planets render
  clean.)
- **Audit-3 remediation WU1 + WU3 + WU5** (2026-05-31) — three audit-3 bug-fix
  work-units shipped to production, each one commit + Tester PASS + deploy green:
  WU1 camera FrameDiagnostics ruler + NaN guard (`416a171`); WU3 disposal
  completeness across renderers + tunnel star-wrap seam (`45866f9`); WU5
  binary-system planet light-direction rebase fix (`fe9303a`). Plan + remaining
  WU6-WU9 in `~/briefings/well-dipper-audit3-remediation-plan.md`.
- **deep-sky-cleanup dead-code follow-up** (2026-05-31, `d018c60`) — multi-agent
  blast-radius audit of the cleanup found 0 bugs / all KEEP paths intact; only
  residue was orphaned `_navigable` machinery (the deleted `spawnNavigableDeepSky`
  was its sole writer). Removed `buildNavigableQueue`/`populateNavigableQueueRefs`,
  7 always-false branches, 8 always-true conjuncts, orphaned `simRandom` import;
  −160 LOC, no behavior change. Audit report:
  `~/briefings/well-dipper-deepsky-blast-radius-audit-2f1a878.md`. (Audits #3 bug /
  #2 architecture / #1 whole-codebase queued for later sessions.)
- **`deep-sky-cleanup-2026-05-29` SHIPPED** (2026-05-30) — removed the legacy
  random dice-roll arrival (`deepSkyChance` roll + `DestinationPicker` deep-sky
  weights/helpers + `spawnNavigableDeepSky` + `'deepsky'` audio track + autopilot
  deep-sky tour stops); −351 LOC. Every warp now lands a real star-system or
  explicit target. 3 KEEP paths intact (title backdrop, debug gallery,
  external-galaxy click). All 5 ACs verified live (chrome-devtools GPU); pushed
  to production GitHub Pages.
- **Doc-system v5 migration COMPLETE** (2026-05-29) — Phase 8
  (deep-sky-cleanup PM-scoped + GATE-1 approved) and Phase 11 (Scope
  frontmatter on all 39 workstreams; 3 transitional docs archived to
  `ARCHIVE/*_LEGACY.md`; README "Transitional artifacts" section removed;
  this NOW.md post-migration rewrite). All 11 phases done.
- **Phase 7 — FEATURES/{autopilot,warp}.md standardized to v5** (2026-05-29, `a4ddc47`) — `**Systems touched:**` lines + `## Player Beats` (F&F-MVP + ENRICHED/GAME, Keith form, observable ACs); prior prose preserved; `doc-rot` clean.
- **4 net-new FEATURES deep dives** (2026-05-25, `0373d1f`→`039b52c`) — galactic-rendering, nebulae, planet-rendering, nav-computer; nav-computer Level 4 COLUMN→PRISM rename (`039b52c`).
- **Phase 6 — SYSTEMS.md + SYSTEMS/app-shell/** (2026-05-19, `cb1fc4d`) — 26-system flat map, `app-shell` deep dive, doc-graph + doc-rot clean.
- `ac4b477` — **Phase 5 — FEATURES.md** Max-authoritative inventory (69 rows)
- `5a97e41` — **Phase 9 — CLAUDE.md transform** (62 → 81 lines) + JOURNEY structural-debt section
- `81c9f22` — **Phase 4 — MOOD index** wired
- `75c4a35` — **Phase 3 — Scripts** (doc-rot, doc-graph, uat-status, mood-bootstrap, pre-push hook)
- `8625a8a` — **Phase 2 — Infrastructure** (PILLARS, PLAYER_EXPERIENCE, 8 PROTOCOLS, README)
- `fd98f23` — **Phase 1 — Archive** (~50 file moves)
- **Phase 10** — pre-push hook (fires `npm run doc-rot` on every push)

## Open structural decisions (from session)

- **Historical-workstream Scope `# unverified` back-fill** — Phase 11
  added Scope frontmatter to all 37 historical workstreams, but `paths:`
  were left `[] # unverified` (not back-filled from shipped commits), and
  6 process/ambiguous ones have `systems: [] # unverified`
  (canvas-recording-workflow-formalization, dev-collab-three-layer-testing,
  warp-shipped-gate-process-fix, ooi-capture-and-exposure-system). Back-fill
  each when its workstream is next touched. Not blocking.
- **code-explorer + code-architect version control** — currently no git tracking. Max flagged for revisit. Options: `well-dipper/docs/PERSONAS/` + symlink up; separate `claude-agents` repo; accept untracked.
- **Ship NPC spawning disable for F&F** — `ShipSpawner` turned off before F&F ship; preserve code for ENRICHED reactivation. Small follow-up workstream; not yet scoped.
- **Christian (Max's brother) music tracks status** — `hyperspace / warp-charge / arrival` wired in MusicManager but absent on disk. (`deepsky` track removed from the list in deep-sky-cleanup, shipped 2026-05-30.) Status of brother's deliveries unknown.

## Deferred (deliberate)

- **Per-system SYSTEMS/<sys>/ROADMAPs** — authored fresh when each system gets its first deep dive (Rule 1 no empty folders).
- **Sol-naming triage** — `body.star.sol` not tagged in partial inspection layer.
- **PARKING_LOT.md** — P1/P2/P3 deferred items; migrate to per-system Open Questions when those systems get deep dives (tracked in JOURNEY structural debt).

## What's NOT in the queue right now

- Layer-3 GAME features (15+ rows in FEATURES.md GAME section) — gated by F&F MVP ship completion.
- New ENRICHED work — gated by F&F MVP ship. 4 ENRICHED rows currently.
- Doc system v6 — not foreseen; v5 expected to hold ≥6 months.

## Session checklist (start of each working session)

1. Re-read `HEART_OF_DESIRE.md`
2. Skim `JOURNEY.md` current-objective section
3. Read THIS file's Active workstream + Next 1-3
4. Check `~/.claude/state/dev-collab/active-workstream.json` matches Active workstream (if mismatched, this file is stale — update before proceeding)

## How this file updates

- **Working-Claude updates at session end** per CLAUDE.md session-end protocol
- **Max edits** when priorities shift, when items move in/out of queue, when deferred status changes
- Don't let this file grow past one screen.
