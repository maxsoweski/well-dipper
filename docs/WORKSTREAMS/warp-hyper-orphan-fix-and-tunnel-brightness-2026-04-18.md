# Workstream: Warp HYPER orphan fix + tunnel wall brightness polish (2026-04-18)

## Parent feature
`docs/FEATURES/warp.md` — specifically the "Current state snapshot (2026-04-18)"
entry: *"HYPER — first half of the tunnel works; second half of the tunnel is
broken."* This workstream attacks the root cause of that break.

## Implementation plan
`docs/PLAN_warp-tunnel-v2.md` — particularly steps 6, 8, 9 (procedural
starfield in `WarpPortal.js`, wire `WarpEffect`→`WarpPortal` in `main.js`,
suppress composite tunnel during owned phases). Note: the fix landing here is
a *completion* of PLAN v2 steps that were written before the
orphan-at-re-anchor bug was understood, not a new architectural departure.

## Scope statement

Land the on-disk HYPER-phase tunnel orphaning fix that is already staged in
`src/main.js` (the `onTraversal('INSIDE')` handler now `await`s
`warpEffect.onSwapSystem()` before re-anchoring Portal A), verify it from a
cold Vite restart with a real user flow, and polish the tunnel starfield
shader's per-frame uniforms (`uScroll`, `uHashSeed`, `uDestHashSeed`) so the
stars in the cylinder actually move and match origin↔destination system
identity. One unit of work because both halves share the same verification
harness (filmstrip capture of HYPER rows) and the brightness polish only
makes sense once the tunnel is actually reaching the camera.

## How it fits the bigger picture

Advances `docs/FEATURES/warp.md` §"Success criteria — Primary — seamless":
motion continuity is the *entire feature's* acceptance rubric, and black
frames at phase transitions are the first listed failure mode. The orphan
bug is — in the feature doc's own framing — a direct violation of V1.

Also advances `docs/GAME_BIBLE.md` §"The Warp as Sacred Experience" by
keeping the *Early-game tunnel + ship shake* experience alive and
presentable. With this bug, the sacred experience is 40 frames of black
void — the opposite of sacred.

Finally closes the loop on `docs/GAME_BIBLE.md` §1A Layer 1 Screensaver,
which lists "Warp transitions with fold/hyperspace/exit animations" as
**done and working** — a claim that is currently false in the HYPER
second half. Shipping this restores the Layer-1 inventory honesty.

## Acceptance criteria

1. **Async check passes without monkey-patch.** In a freshly-reloaded
   browser tab (Chrome on port 9223, post-Vite-restart),
   `window._warpPortal.onTraversal.toString().startsWith('async')` returns
   `true`. No `evaluate_script`-installed patches remain in the page.
2. **Filmstrip shows content, not black, across all HYPER rows.** Capture
   via `~/.claude/helpers/filmstrip.js` at `fps:30, maxFrames:450` driven by
   real click + Space×3 (per `feedback_test-actual-user-flow.md` — NOT
   `window._warpEffect.start()`). Every HYPER-phase row shows radial
   streaking / star-line patterns comparable to or richer than
   `screenshots/warp-filmstrip-POSTPATCH-2026-04-17.png`. No pure-black
   frames between ENTER end and EXIT start.
3. **Sol as destination is tested explicitly.** Per
   `feedback_always-test-sol.md`, debug-mode Sol-destination warp goes through
   `KnownSystems`/`SolarSystemData` — a distinct path from the procedural
   destination. Filmstrip captured for Sol destination is visually
   indistinguishable in HYPER content from procedural destinations (black
   frames are still a fail; some extra freeze length is acceptable and is
   tracked separately as "Sol-as-destination freeze" — out of scope here).
4. **Tunnel walls read as starfield in motion, not static dots.** With
   `uScroll` wired to advance each HYPER frame, stars visibly stream past
   the camera in a contact sheet of 4 consecutive frames. With `uHashSeed`
   / `uDestHashSeed` wired from origin and destination system seeds, two
   warps between clearly different systems produce demonstrably different
   star patterns in their HYPER filmstrips (not identical frames).
5. **Brightness polish verified in the isolated lab first.** Per
   `feedback_isolated-test-harnesses.md`, `starfield-cylinder-lab.html`
   confirms the uniform wiring before a single line of production shader
   code is touched. Lab is captured in a screenshot showing brightness /
   wrap / seed-variation behavior.
6. **Commit lands with filmstrip evidence.** Final commit message:
   `"Fix HYPER tunnel orphaning by awaiting onSwapSystem before re-anchoring
   Portal A"`. Commit body or PR references the before/after filmstrips
   from `screenshots/`.

## Principles that apply

(From `docs/GAME_BIBLE.md` §11 Development Philosophy. Four principles are
load-bearing here; the other two are not relevant to this work and are
intentionally omitted.)

- **Principle 6 — First Principles Over Patches.** This is the dominant
  principle for this workstream. The HYPER orphan bug has already drawn
  multiple patch attempts across multiple sessions (see Drift risks). The
  root cause — synchronous fire-and-forget of an async callback followed by
  a re-anchor against the pre-teleport camera — is known. The fix must be
  the structural one (`await`) already staged, not yet another band-aid
  on top (e.g., "just wait 60 ms before re-anchoring," "teleport the
  tunnel to chase the camera"). If anything about this workstream starts to
  feel like a fourth patch attempt, stop and escalate.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer Consumes.**
  Applies to the brightness-polish half. The star-seed data for origin and
  destination systems already exists at the Model layer (star seeds from
  `HashGridStarfield`). Any approach that *invents* seed values at the
  Renderer layer (random constants, hashes of clock time, the current
  hardcoded `Vector3(123.34, 456.21, 45.32)` literal in
  `WarpPortal.js:142`) violates this principle. The polish work must pull
  real seeds through the pipeline, not fabricate them at render time.

- **Principle 3 — Per-Object Retro Aesthetic.** The tunnel shader is a
  per-object fragment shader — polish MUST stay inside the object's shader.
  Do not add screen-space filters, post-process brightness passes, or
  `pixelScale` hacks to "make the tunnel pop." Any brightness tuning lives
  in the existing `StarLayer` function in `WarpPortal.js`.

- **Principle 2 — No Tack-On Systems.** If the procedural starfield tunnel
  doesn't read bright enough with real seeds wired through, the correct
  move is to change the shader (renderer) OR the seed-carrying pipeline,
  not to add a "tunnel brightness compensator" as a new surface-level
  knob. Small, targeted uniforms on the existing material only.

## Drift risks

Patch-loop history for this exact area is long enough to warrant explicit
listing. Treat these as known failure modes, not theoretical possibilities.

- **Risk: Fourth patch attempt on the orphan bug.** The progress memo
  records three prior attempts whose shape is "change one constant or add
  one guard and hope it sticks" — the `-1 scene unit` → `-1e-10` Portal A
  re-anchor offset, the `_swapFired`-guarded slerp skip, the
  freeze-2 `spawnSystem` async-chunk (reverted in commit `8349e53`). All
  fixed a symptom of the same root cause without addressing it.
  **Why it happens:** every patch-attempt visually produced *something*
  (a filmstrip that wasn't quite as black as before), which felt like
  progress and obscured that the re-anchor was firing in the wrong
  sequence. **Guard:** verify the exact async check in AC #1 and compare
  filmstrips HYPER-row-by-HYPER-row against the POSTPATCH baseline
  screenshot. If rows 3-6 are not demonstrably richer than POSTPATCH,
  *stop* and escalate — do not patch.

- **Risk: Re-attempting Freeze 2 in the same commit.** Explicit out-of-scope
  item below; mentioning here because the revert commit `8349e53` is
  recent and the temptation to "while we're in the warp code" will be
  strong. **Why it happens:** working-Claude reads `PLAN_transition-freeze-fix.md`
  and sees the preSpawn/activate split as "almost done," loops it in.
  **Guard:** Max already wrote in the session plan that Freeze 2 may be
  re-attempted ONLY AFTER this orphan fix is verified via filmstrip. Mixing
  them into one commit makes bisection impossible if HYPER regresses again.

- **Risk: Brightness polish lands with invented seeds.** The current
  `uHashSeed` default is a literal `Vector3(123.34, 456.21, 45.32)` —
  obviously a placeholder. The tempting shortcut is to plug in
  `Math.random()`-derived values or a `performance.now()` hash. This
  violates Principle 5 (Model → Pipeline → Renderer) and also Principle 6
  (the whole point of the hash grid is deterministic per-star identity —
  fabricated seeds defeat it). **Why it happens:** pulling real seeds
  through `WarpEffect` → `WarpPortal` requires knowing which seed API
  the origin system + destination system expose, and that's extra reading.
  **Guard:** if the origin+destination seed plumbing is more than a small
  local edit, *split the polish into its own workstream* instead of
  faking seeds to close this one. Shipping orphan-fix alone is acceptable.

- **Risk: Verification via `window._warpEffect.start()` instead of real
  flow.** Multiple prior sessions regressed this way; synthetic entry
  points skip the state machine between `beginWarpTurn()` and
  `warpEffect.start()`, so bugs that depend on slerp-during-turn or
  `_swapFired`-guarded paths never fire. Fresh in-session lesson per
  `feedback_test-actual-user-flow.md`. **Why it happens:** the synthetic
  call is two lines in the console and the real flow requires clicking a
  star and hitting Space thrice. **Guard:** AC #2 and AC #3 specify
  real-click + Space×3. The Director should reject any "verified" claim
  that references a direct `_warpEffect.start()` invocation.

- **Risk: Declaring "done" without taking filmstrips yourself.** Per
  `feedback_visual-qa-mandatory.md` and `feedback_visual-evidence-required.md`,
  every visual claim requires a visible artifact. A text-only
  `console.log('HYPER is now streaming')` does not satisfy AC #2 or AC #4.
  **Why it happens:** the `await` change is syntactically trivial and
  feels "obviously correct" after reading the diff. **Guard:** the commit
  must reference PNG paths in `screenshots/` that were captured *after*
  the Vite restart, not before.

## In scope

- The staged `src/main.js:432-452` `async onTraversal` + `await onSwapSystem`
  edit, reviewed once more from the on-disk file and committed if no
  regressions appear in verification.
- Wiring `uScroll` to advance per HYPER frame in whichever class owns the
  HYPER update tick (`WarpEffect` → `WarpPortal.setScroll(v)` exists at
  `WarpPortal.js:619`; wire-up site is main.js's warp update block).
- Wiring `uHashSeed` and `uDestHashSeed` from the origin and destination
  system seeds via `WarpPortal.setHashSeed(x,y,z)` / `setDestHashSeed` —
  whose accessors already exist at `WarpPortal.js:624`/`:629`. The seed
  *values* must originate from the galactic-pipeline system seeds, not
  from renderer-layer constants.
- `starfield-cylinder-lab.html` iteration on the brightness / seed-swap
  behavior BEFORE touching `WarpPortal.js`. Lab output screenshot.
- Filmstrip capture (POST-restart baseline + post-polish) for procedural
  destination AND Sol destination.
- One commit for the orphan fix; optionally a second for the brightness
  polish if that lands the same session. Do not combine them.

## Out of scope

Redirect all of these away from this workstream:

- **Freeze 2 (`spawnSystem` split into preSpawn/activate).** Live in
  `docs/PLAN_transition-freeze-fix.md`. May be re-attempted in a *separate*
  workstream ONLY after this one's AC #2 passes. Revert commit `8349e53`
  means the fix is not landed; keep it that way for now.
- **Freeze 1 / shader-compile ~980 ms.** Handled in session 2026-04-17
  overnight (async-chunk `StarSystemGenerator`, etc.). Not this workstream.
- **Sol-as-destination freeze.** `SolarSystemData.generateSolarSystem` is
  synchronous and ~2 s; async refactor is listed in the progress memo as a
  future workstream candidate.
- **Portal B post-warp FP drift.** Blocked on world-origin rebasing per
  `docs/PLAN_world-origin-rebasing.md` and `well-dipper-rebasing-plan.md`.
- **ENTER 1–2 s freeze** listed as "primary bug blocking V1" in the
  feature doc. Separate root cause from HYPER orphaning. Separate
  workstream.
- **EXIT forensics** (is the working EXIT version still in the code or was
  it reverted?). Feature doc marks this as open; not this workstream.
- **Audio transition shape** (warp-charge → hyperspace crossfade). Music
  integration workstream, not this one.
- **Bible updates** — `docs/FEATURES/_drafts/GAME_BIBLE_diff_warp.md` is
  proposed but not merged. Director-owned. Not touched here.
- **PLAN_warp-tunnel-v2.md steps 1-5 and 11-13** (accretion disk rim,
  portal handoff lab, exit handoff lab, destination seed blending bridge,
  iris wipe). Those are the larger PLAN v2 execution; this brief
  carves out the minimum work that restores HYPER to "visible and
  moving" against the already-staged fix.

## SYSTEM_CONTRACTS.md gaps (flag for Director)

`docs/SYSTEM_CONTRACTS.md` does not currently contain a §Warp section
describing the phase state machine, the `onPrepareSystem`/`onSwapSystem`/
`onTraversal` callback contract, the async ordering invariant that is
load-bearing in THIS fix, or the `WarpEffect`↔`WarpPortal`↔`main.js`
three-way wiring. The only warp mentions are scattered (§4 Warp
Destinations covers which hash-grid star a warp resolves to; §5.3 mentions
Warp as a drive state).

The contract this workstream is enforcing — *"Portal A must not be
re-anchored until `onSwapSystem` has resolved and the camera has been
teleported to post-swap coordinates"* — is exactly the kind of invariant
SYSTEM_CONTRACTS is for. Future sessions will regress on this again
without a written contract.

**Flag for Director:** after AC #2 passes, Director should add a §Warp
section to SYSTEM_CONTRACTS.md capturing (at minimum) the callback
ordering invariant. PM can draft it on request; promotion is
Director-owned per `docs/FEATURES/**` / `docs/GAME_BIBLE.md` / registry
artifacts ownership.

## Handoff to working-Claude

Read this brief, then `docs/FEATURES/warp.md` (Current state snapshot +
Success criteria), then `docs/PLAN_warp-tunnel-v2.md`. Confirm the
on-disk `main.js` still has the `async onTraversal` + `await` shape
staged. Then: (1) Max restarts Vite; you reload Chrome on port 9223.
(2) Verify AC #1 — the async toString check. (3) Real-click + Space×3 +
filmstrip, AC #2. (4) Sol destination filmstrip, AC #3. If AC #2 and #3
pass, commit the orphan fix alone with the specified commit message and
filmstrip references. *Stop there and take stock* before starting Task
#4 polish. For Task #4: build in `starfield-cylinder-lab.html` first
(AC #5), confirm the brightness/seed behavior reads, then land the
production edit and re-filmstrip. Do NOT bundle Freeze 2 or any other
deferred item. If any verification step fails in a way that feels like
"just needs one more tweak," stop and escalate per Drift Risk #1 — the
lesson of this exact area is that next-tweak-loops cost more than a
redesign.

Artifacts expected at close: two filmstrip PNGs (procedural + Sol,
post-restart), one lab screenshot (starfield-cylinder brightness),
one commit (orphan fix), optionally one commit (brightness polish).
Update this brief's Status line to `Shipped` with the commit SHAs.

## Status
Drafted by PM 2026-04-18. Ready for working-Claude execution. Director
audit requested.
