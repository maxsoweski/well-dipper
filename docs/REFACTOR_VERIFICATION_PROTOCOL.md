# Refactor verification protocol (telemetry-based equivalence)

Companion to `docs/MAX_RECORDING_PROTOCOL.md`. The recording protocol closes
the Shipped gate for **visible / animated / phased feature** workstreams —
motion evidence, Max-evaluated. This protocol closes the Shipped gate for
**pure-math refactor** workstreams — code-lift / module-split / rename work
where the explicit contract is *zero behavioral change*, and visual evidence
is the wrong instrument.

Authored 2026-04-20 after the WS 1 autopilot-navigation-subsystem split
(`c394e1e`) closed with `VERIFIED_PENDING_MAX` on pre/post canvas recordings
and Max flagged a visible difference (camera rotating around the star on the
opposite side). Diagnosis: the math is provably identical for identical
inputs; the **inputs drifted** between pre-capture and post-capture because
the test driver let a real-time orbit (P1's position at the instant travel
began) evolve across two separate recording sessions. Animation-frame timing
jitter from changed JIT state + class indirection accumulated across the
2500ms Sol-spawn wait and placed P1 on opposite sides of a decision boundary
in `_updateTravel` (the `diffCW vs diffCCW` branch). The recording AC could
not distinguish *math regression* from *input drift* and forced Max to burn
evaluation cycles on a question telemetry can answer cheaply and without
ambiguity.

The deeper lesson: for a refactor whose contract is *identical math*,
*input-identical* is the right axis of comparison. Canvas recordings
compare *Max's eyes at real-time-simulated inputs* — the wrong axis.

## Which path applies

Three verification instruments exist. Pick based on what the workstream's
contract is:

| Instrument | Closes | When |
|---|---|---|
| **Canvas recording** (`MAX_RECORDING_PROTOCOL.md`) | Phased / animated / time-windowed **authored experience** | Feature workstreams. Max's evaluation is the gate. |
| **Playwright / chrome-devtools screenshot** | Static visual change that a single frame settles | Menu swap, static HUD adjustment, stable shader still, non-animated UI. |
| **Telemetry assertion** (this doc) | Code-lift / module-split / rename where contract is *zero behavioral change* | Refactor workstreams. No Max evaluation required on pass. |

**Rule of thumb:** if the workstream's contract sentence is *"behavior is
preserved"* or *"math is equivalent"* or *"no visible change,"* this is the
right instrument. If the contract is *"the authored experience unfolds this
way,"* the recording protocol is the right instrument. If the contract is
*"this one frame looks right,"* a screenshot is enough.

A refactor workstream that ALSO introduces intentional behavior change
(e.g., fixing a latent bug surfaced by the refactor) needs telemetry on the
unchanged surfaces AND a recording (or screenshot) on the changed surfaces.
State that split explicitly in the brief's AC section. Do not bundle
silently.

## The telemetry pattern

The shape of the test is always the same:

1. **Construct minimal frozen inputs** — synthetic scene state the
   subsystem needs, nothing more. No `StarSystemGenerator`, no real-time
   orbits, no JIT-warmup-sensitive animation frames. A stub target mesh at
   a fixed world position, a fixed ship position, a fixed set of numerical
   parameters.
2. **Seed all non-determinism.** Replace `Math.random` with a seeded LCG
   for the duration of the test. If the subsystem reads wall-clock time or
   `performance.now()`, inject a monotonic counter. If it queries
   `requestAnimationFrame`, drive the loop manually with a fixed
   `deltaTime`.
3. **Load the subsystem under test.** Both versions — pre-refactor
   (reverted via `git stash` or separate branch) and post-refactor
   (current code) — run through the same harness with the same frozen
   inputs.
4. **Capture per-frame output.** Drive the subsystem with a fixed-step
   `update(deltaTime)` loop (e.g., 60 Hz for N frames covering the
   interesting motion window). After each step, read the subsystem's
   public output and push it onto a telemetry array. Capture every
   numerical output the subsystem produces — position, velocity,
   target-look-point, phase, any flags that cross the module boundary.
5. **Serialize telemetry as JSON** per version (`before.json` /
   `after.json`). Numbers to fixed precision (e.g., 6 decimal places) to
   avoid float-representation noise that isn't a real regression.
6. **Diff + assert.** A diff helper compares the two arrays frame-by-
   frame, field-by-field. **Pass condition:** every numerical field is
   within a tight epsilon (default `1e-6` for positions/velocities,
   exact match for phase strings and integer flags) at every frame.
   **Fail condition:** any field diverges beyond epsilon at any frame —
   report the frame index, field name, before/after values, and let
   working-Claude diagnose.

This is not a unit test in the conventional sense. It's a **pre/post
equivalence harness** specific to one refactor workstream. It lives
alongside the code for the duration of that workstream's verification
and stays committed as precedent for the next refactor.

## Input-freezing checklist

Every telemetry test must explicitly freeze every source of
non-determinism. If you skip one, the WS 1 failure mode returns. The
checklist:

- [ ] **`Math.random`** — overridden with a seeded LCG for test duration,
      restored after. Standard seed: `42`. LCG recipe:
      `seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000;`
- [ ] **Wall-clock / `performance.now()`** — replaced with a monotonic
      counter that advances by exactly `deltaTime` per step. No real-time
      simulation ever.
- [ ] **`requestAnimationFrame`** — not used. The harness drives
      `subsystem.update(deltaTime)` directly in a for-loop.
- [ ] **Physics accumulation / spawn waits** — bypassed. The harness
      constructs the state that the production code would have reached
      after the spawn wait, rather than waiting 2500ms in real time.
- [ ] **Starting positions** — set explicitly (`camera.position.set(...)`,
      `mesh.position.set(...)`). Nothing derived from real-time orbit math.
- [ ] **Orbit targets that move** — if the refactor's math depends on a
      target body's current position, set that position explicitly to a
      fixed value. The P1-moved-during-spawn-wait drift is the canonical
      failure here.
- [ ] **External state** — no `window._something`, no module-level
      globals the subsystem reads. Inputs flow in via the test harness's
      construction of the subsystem's input object.

If the subsystem's API can't be driven without one of these, that's a
signal the API is leaking — name the leak and escalate to Director before
writing the test.

## Where telemetry tests live

**Committed to git at `tests/refactor-verification/<workstream-slug>.html`.**

Rationale:

- **HTML, not a Node test.** The project runs Three.js in the browser
  (`vite` dev server). An HTML harness loads the production modules via
  the same import paths the game uses — no module-resolution drift. Same
  convention as `tunnel-lab.html` / `galaxy-glow-viewer.html` per
  `docs/CONVENTIONS_test-harnesses.md`.
- **Self-contained.** The harness imports only the subsystem under test
  and a stub Three.js scene (mesh at fixed position, fixed camera). Does
  NOT import the full game. Telemetry lives in a `window._telemetry`
  object exposed for programmatic capture.
- **Run path:** `cd ~/projects/well-dipper && npx vite` → browse to
  `http://localhost:5173/well-dipper/tests/refactor-verification/<slug>.html`.
  The harness exposes buttons: `Run Before` / `Run After` / `Diff`. Max
  can click manually if he wants to spot-check; working-Claude drives it
  via `chrome-devtools` MCP for the actual verification pass.
- **Committed, not discarded.** Unlike canvas recordings (which live in
  `screenshots/max-recordings/` but are gitignored), refactor-verification
  harnesses commit to `tests/refactor-verification/` and survive the
  workstream. Future refactor workstreams copy-paste the template. The
  pre/post JSON telemetry artifacts themselves are gitignored — too
  large and too workstream-specific to retain — but the harness that
  produced them is the durable precedent.

**Slug convention:** matches the brief filename without `.md` and without
trailing date. E.g., WS 1's brief is
`autopilot-navigation-subsystem-split-2026-04-20.md` → harness is
`tests/refactor-verification/autopilot-navigation-subsystem-split.html`.

## How the pass/fail feeds the Shipped gate

Refactor workstreams close through the same `VERIFIED_PENDING_MAX <sha>`
→ `Shipped <sha>` transition as other workstreams, but the artifact
cited is different:

- **Pass:** `Shipped <sha> — verified against tests/refactor-verification/<slug>.html (pre/post telemetry diff: 0 regressions across N frames)`
- **Fail:** Diagnose the divergence. Either (a) the refactor genuinely
  changed math — fix the code, re-run; or (b) the test's input-freezing
  is incomplete — fix the test, re-run; or (c) the refactor intentionally
  changed behavior on a specific surface — re-scope the workstream's
  contract and document the intentional delta.

**Max's role on refactor workstreams with telemetry-clean pass:**
**none by default.** The diff is the gate. Working-Claude flips the brief
directly from `VERIFIED_PENDING_MAX <sha>` to `Shipped <sha>` on a
zero-regression diff, citing the harness path.

**Spot-check is optional.** If working-Claude or the Director has any
residual uncertainty about a particular behavior surface the telemetry
didn't cover (e.g., a surface the subsystem doesn't expose numerically,
like perceived smoothness of an easing curve), they can request a
sanity-check canvas recording. That is a targeted ask, not a default.
Max is not the default instrument for refactor verification.

**Edge case — behavior surface the subsystem doesn't expose.** If the
refactor touches code whose output is *only* perceptually verifiable
(e.g., an easing curve where numerical equivalence at sample points
doesn't guarantee perceptual equivalence because the samples might skip
a discontinuity), note it explicitly in the brief's AC section as a
surface requiring canvas-recording verification alongside telemetry.
This should be rare; a well-scoped refactor mostly deals in numerical
state.

## Scope of the protocol

Applies to: **code-lift / module-split / rename / extract-method /
reduce-to-facade** workstreams whose explicit contract is zero
behavioral change. The WS 1 autopilot-navigation-subsystem split is the
founding case.

Does NOT apply to:

- Pure-docs workstreams (no code → nothing to verify).
- Feature workstreams (behavior changes intentionally → recording protocol).
- Bug fixes (behavior changes intentionally → screenshot or recording).
- Performance workstreams (math identical, but the *purpose* is measured
  frame-time change → use a perf-telemetry harness, spec separate).

When in doubt, read the workstream's contract sentence in its Scope
statement. *"Zero behavioral change"* / *"behavior preserved"* / *"math
is equivalent"* → this protocol. Anything that describes a desired
behavior change → not this protocol.

## See also

- `docs/MAX_RECORDING_PROTOCOL.md` — recording protocol for visible /
  animated feature workstreams. Sister instrument to this doc.
- `docs/CONVENTIONS_test-harnesses.md` — HTML harness convention this
  protocol reuses (same import model, same `window._lab` exposure
  pattern, same run path).
- `docs/PERSONAS/pm.md` §"Per-phase AC rule" — authoring guidance for
  feature-workstream ACs. The telemetry-assertion AC shape defined here
  is the refactor-workstream analogue.
- `docs/PERSONAS/director.md` §"Documentation stewardship" — the Director
  audits refactor ACs against this protocol the same way feature-workstream
  ACs are audited against `MAX_RECORDING_PROTOCOL.md`.
- `docs/WORKSTREAMS/autopilot-navigation-subsystem-split-2026-04-20.md`
  §"Telemetry verification spec" — worked application of this protocol;
  first brief to carry a telemetry-assertion AC.
