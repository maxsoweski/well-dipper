# Motion-testing methodology for Well Dipper
**Research deliverable, 2026-05-02. Author: Dana (research librarian).**

## Why this exists

Working-Claude verified an autopilot toggle-off fix as PASS via per-frame state-machine telemetry. The Tester subagent independently re-ran and also issued PASS. Then Max watched the recording and saw rapid teleporting back-and-forth cycles of player position relative to nearby planets — a class of bug the telemetry could not see, because the harness sampled net displacement at coarse timepoints rather than per-frame Δposition with sign-change detection.

Max's framing: *"It can't just be visual trial-and-error."* The question is what the industry does instead, and which subset of that is realistically adoptable in a one-developer Three.js project with no engine test framework underneath it.

This is a one-off scoped deliverable, not the start of an ongoing research line.

---

## Bottom line up front

Five techniques, ranked by impact-per-hour-of-infrastructure for a one-dev Three.js project:

1. **Per-frame Δ-magnitude and sign-change predicates over the existing telemetry stream.** Cheapest possible win. The teleport-cycle bug is already encoded in the current telemetry buffer if you sampled position every frame. The fix is changing what you assert on, not capturing more data. Compute `|Δposition_per_frame|` and `count(sign(Δposition·v̂_expected) flips)` per window; flag when either exceeds a threshold a smooth motion would never reach. ~2 hours of work, catches the entire class of bugs the current Tester is structurally blind to.

2. **Fixed-timestep simulation under test, even though the renderer stays variable-dt.** This is the single architectural change that converts every other technique on this list from "approximation" to "exact." The accumulator pattern (Fiedler, *Fix Your Timestep*) is roughly 30 lines of JS. Keep `requestAnimationFrame` for rendering; route physics/camera/autopilot updates through a fixed-step accumulator. Pays back across every future motion-class workstream.

3. **Seeded RNG + recorded input replay, scoped to test runs only.** Once (2) is in, you get deterministic replays for free in JS — same seed + same recorded input vector → byte-equivalent state trajectory. This is what Vblank's Brian Provinciano demonstrated for *Retro City Rampage* at GDC 2015 and what Quake's `.dem` format has done since 1996. Adopt the simplest version: a `seed` query param + an array of `{frame, input}` events.

4. **A "transform hash" comparison against a golden trajectory** in the Box2D style. Once the simulation is deterministic, run it once with known-good behavior, capture a short hash of body positions/orientations at every Nth step, commit the hash to the repo. Future runs assert byte-equivalence. Catches accidental behavior changes during refactors (which is what `WS 1` was about). Box2D does this exact thing across x64/ARM/MSVC/Clang/GCC; you only need single-platform within Chrome.

5. **Flight-recorder ring buffer with on-failure dump.** Replaces the recording-as-evidence flow for the bugs that recordings are bad at. Ring-buffer the last N seconds of position/velocity/state every frame; when an assertion fires (#1) or Max trips a hotkey, dump to JSON. This is what bugnet.io's debugging-intermittent-bugs writeup (and id Software's longstanding practice of `condump`-style state dumps) describes. Roughly 50 lines of JS.

These five compose. (2) and (3) together give you replays. (1) and (4) on top of replays give you regression detection. (5) is the post-mortem capture for the bugs that escape the assertions. None of them require a build pipeline or a test framework. All of them work inside a `*-lab.html` harness or a debug-mode flag.

What I am explicitly **not** recommending: Unity Test Framework, Unreal Gauntlet, Playwright visual regression, frame-pixel-diffing against golden screenshots, or any CI infrastructure. Those are paying for problems you don't have and missing the problems you do.

---

## Industry techniques surveyed

### Replay infrastructure

The dominant pattern across two decades of FPS development is *input replay over a deterministic simulation*. Quake's `.dem` format records input commands plus the initial RNG state; on playback the engine recomputes every frame from those inputs (Quake Wiki, *Demo Recording*). The format depends on `g_synchronousClients 1` and a fixed server tick — change either and replays desync.

Vblank's Brian Provinciano gave the canonical indie talk: *Automated Testing and Instant Replays in Retro City Rampage* (GDC 2015). Same pattern. He used input replay both for end-to-end regression (every build plays the game from level 1 to final boss before shipping) and for community leaderboards (kilobytes of input bytes encode an entire run). The talk is the closest thing to a one-developer how-to that exists in the GDC vault. **Read in full** if Max wants to internalize the pattern; the YouTube version is freely available [(GDC Vault)](https://www.gdcvault.com/play/1021825/Automated-Testing-and-Instant-Replays).

The cost of this in a Three.js project is mainly architectural, not implementational. JavaScript's `requestAnimationFrame` callback receives a `DOMHighResTimeStamp`; if any gameplay logic uses it directly, replays will desync on different hardware. The fix is the accumulator pattern (Fiedler, *Fix Your Timestep*, gafferongames.com) — render at variable dt, simulate at fixed dt. Standard practice in the JS game-loop literature ([Hovhannisyan](https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/), [Tomsu](https://jakubtomsu.github.io/posts/input_in_fixed_timestep/)). Roughly 30 lines.

**What it catches.** Anything that's a function of input + simulation: physics drift, AI behavior changes, autopilot path divergence, collision regressions. Not: GPU state, shader output, audio routing.

**What it doesn't.** Bugs that depend on render dt (motion blur tuning, post-processing). Bugs that depend on real wall-clock time (animations driven by `Date.now()` rather than the simulation clock — fix the offending code, don't work around it).

### Snapshot / golden-state regression

Box2D's *Determinism* writeup (Aug 2024) is the cleanest description of the technique. They run a "Falling Hinges" scenario, hash the final transform of every body, and compare the hash to a known value (`0x5e70e5fe` in their reference run). CI fails if the hash drifts. They run the same scenario on x64 and ARM, MSVC and Clang and GCC, and require byte-equivalence across all six.

To get there they had to:
- Disable `-ffast-math` everywhere (reorders FP ops, breaks determinism)
- Disable FMA via `-ffp-contract=off` (rounds differently on hardware that has FMA vs. hardware that doesn't)
- Replace `sinf`/`cosf`/`atan2f` with custom implementations because libm differs across platforms

For a JS project the floating-point story is simpler: V8 is the only engine in scope, on the only architecture in scope (Max's machine + Cloudflare Pages users running Chrome). You skip the cross-platform hardening entirely. The technique reduces to: pick a scenario, run it once, hash the trajectory, commit the hash. **Rigor flag: this is real engineering, not handwaving** — it's what every multiplayer-deterministic-lockstep RTS has done since *Age of Empires* (Bettner & Terrano's GDC 2001 *1500 Archers on a 28.8* describes the same lineage).

**What it catches.** Refactor-class bugs. Anything that's supposed to preserve behavior. The exact failure mode `WS 1` (navigation subsystem split) was structured to catch.

**What it doesn't.** Behavior changes that are *correct* — if you intentionally tune autopilot easing, the hash changes and you re-bless it. The technique doesn't tell you whether the new behavior is good, only that it's different.

### Property-based / invariant testing

This is the technique most relevant to Max's specific bug, and the worst-documented in game-dev literature. Property-based testing comes from the functional-programming world (QuickCheck, Hughes 2000); industry adoption in games is patchy and mostly informal.

What studios actually assert on, when they do it (drawn from the bugnet.io intermittent-bugs writeup, the *Sea of Thieves* GDC 2019 talk by Robert Masella, and scattered postmortems):

- **Position bounds.** Player Y > ground plane. Player position inside known world bounds.
- **Velocity bounds.** `|velocity| < c_max` for some game-specific c_max. Catches NaN propagation, collision-resolution explosions.
- **Per-frame Δ bounds.** `|position(t) - position(t-1)| < maxSpeed × dt + ε`. This is the invariant that would have caught the teleport-cycle bug. It's the simplest motion-continuity assertion that exists.
- **Monotonicity under zero input.** Zero controller input → zero acceleration in the player's local frame. A frequent regression site; controllers that drift on idle violate this.
- **Sign-stability of approach velocity.** When autopilot is approaching a target, `sign(d|target − player|/dt) ≤ 0` for the entire approach phase. Sign flips mean the controller is overshooting and oscillating. **This is the predicate that names Max's bug.**
- **Conservation laws.** Total energy bounded above by initial energy + work done by inputs. Specific to physics-driven games; orbital mechanics in well-dipper would benefit.
- **State-machine well-formedness.** No transitions to states that don't exist. No simultaneous occupancy of mutually-exclusive states.

The vocabulary for these in industry literature is informal. The closest named term is *invariants* (Hoare-style), borrowed from formal-methods CS; game-dev usage is much looser. Nystrom's *Game Programming Patterns* discusses them only briefly in the *Component* chapter. Gregory's *Game Engine Architecture* mentions assertions throughout but doesn't taxonomize motion-specific ones. There is no industry-standard term for "the predicate that turns a felt-jank claim into a measurable test."

**This gap is real and is part of what Max is bumping into.** The reason the Tester's telemetry didn't catch the teleport-cycle is that the vocabulary for "teleport-cycle" as an invariant doesn't exist in canonical game-testing literature. It has to be invented per-bug-class and added to the harness.

**Read in full:** Llopis' *Backwards Is Forward: Making Better Games with Test-Driven Development* (Games From Within). The most honest indie perspective on what's worth testing and what isn't. He's blunt that physics-coupled gameplay code is the hardest thing to test and most projects shouldn't try; the value is in testing the *deterministic computational kernel* (path planning, AI decisions, controller math) and accepting that emergent physical behavior gets caught by replays + recordings.

### Telemetry harnesses inside engines

What the public-facing engines actually expose:

- **Source engine** (`developer 1`/`developer 2`/`developer 4`). Console-toggled overlay. Higher levels show physics penetration errors, hitboxes, collision anomalies. Output goes to a console buffer that can be `condump`-ed to disk. (Valve Developer Community, *Console Command List*.)
- **idTech** (Quake/Doom lineage). Cvar-driven; `r_showtris`, `r_showShader` style toggles. State dumps via `condump`. The pattern across idTech variants is consistent: every subsystem owns its debug overlay; activation is one cvar; output structure is plain-text key-value pairs.
- **Unity.** Profiler captures frame-level timing and Debug.Log messages; the Test Framework's PlayMode tests run as coroutines so they can span multiple frames and assert on physics outcomes (Unity docs, *Workflow: How to create a Play Mode test*).
- **Unreal.** *Insights* for performance, *Stat* commands for per-system overlays, the assertion family (`check`, `verify`, `ensure`) for invariant checks (Unreal Engine 4.27 docs, *Asserts*).
- **Sea of Thieves (Rare).** Masella's GDC 2019 talk describes a tiered framework: unit tests for kernels, integration tests for systems, "ScenarioTests" that spawn a server + AI-controlled clients and assert on multiplayer interactions. The non-determinism handling is explicit isolation: kernels are deterministic and tested as such; gameplay-emergent behavior is tested with bots and looser invariants. **Note: I could not pull the PDF directly through the WebFetch tool — it returned binary; the Game Developer / GDConf summaries are sufficient for the methodology, but Max should watch the YouTube version if he wants the specifics ([video link](https://www.youtube.com/watch?v=X673tOi8pU8)).**

The abstraction that makes a telemetry harness reusable rather than one-shot: **typed event buses with cheap append, expensive query**. Every subsystem pushes structured events (`{type: 'autopilot.transition', from: 'cruise', to: 'lhokon', frame: 1247, pos: [...]}`). Queries are post-hoc — you don't analyze in flight, you analyze after the assertion fires. This is what Grenouille Bouillie's *real-time, lock-free, multi-CPU flight recorder* writeup (2016) describes, and it's the same pattern the Go runtime's flight recorder formalized in Go 1.25 (2025).

### Per-frame analysis primitives

Industry vocabulary for "this motion is jank, reduced to a measurable predicate":

- **Frame pacing / frame-time variance.** Well-defined. Variance below 2-4 ms² is smooth; above 10 ms² is perceptibly stuttery. Tools: PresentMon, CapFrameX, NVIDIA FrameView. **This is for render smoothness, not simulation correctness** — orthogonal to Max's bug, but worth knowing the term exists.
- **1% lows, 0.1% lows.** Percentile frame times. Standard benchmarking vocabulary.
- **Δ-magnitude.** Not a named term; standard in numerical analysis as the *first finite difference*. `Δx(t) = x(t) - x(t-1)`.
- **Sign-change rate / zero-crossings.** Named in signal processing; not in game-dev literature directly. The *Nature of Code* (Shiffman) chapter on oscillation uses the term informally. Industrial-process control uses it for "hunting" / "ringing" detection (PiControl Solutions, *Online Oscillation Detection*) — the same shape of bug as Max's teleport-cycle.
- **FFT / spectral analysis on motion data.** Used in mocap jitter detection (Scitepress, *Fast Detection of Jitter Artifacts in Human Motion Capture Models*, 2025). Overkill for game-dev unless you're in animation tooling.
- **Monotonicity scoring.** Not a named term. Trivially: `count(sign(Δx) flips) / window_size`. Smooth approach motion has a flip count near zero; oscillation has it near 0.5.

Honest assessment: there is no consensus vocabulary. Every studio invents its own predicate names. The useful move for Max isn't to find the right word — it's to give each named bug-class an invariant and a name in his own harness, and accumulate a vocabulary local to well-dipper.

### Recording-as-evidence

Where studios actually use video:

1. **Felt-experience evaluation.** "Does this feel right?" — game feel, juice, hand-feel of controls. Recordings are the right tool here because the question is subjective and the judge is a human.
2. **Reproducer captures from QA / players.** "I saw this weird thing." Recording captures something the player can't articulate yet; engineers extract the structured data afterwards.
3. **Marketing and milestone gates.** Demo videos for stakeholders, not for engineering verification.

Where studios *don't* use video, where Max's current process does:

- **Automated regression.** Nobody runs a CI suite that watches videos. The "watch the recording" gate is structurally incompatible with rapid iteration.
- **Numerically-specifiable bugs.** If the bug can be named as an invariant violation, asserting on the invariant is faster, cheaper, and more reliable than human evaluation of footage.

The teleport-cycle bug is in the second category. It *can* be named as an invariant (sign-stability of approach velocity, or Δ-magnitude bounds). Max evaluating the recording was the fallback, not the right tool. The right tool is the invariant + an automated assertion + a flight-recorder dump when the assertion fires. The recording then becomes the *human-readability layer* for the failure mode, not the primary detector.

This matches the well-dipper-internal protocol in `docs/REFACTOR_VERIFICATION_PROTOCOL.md` (telemetry-equivalence over canvas-recording for refactor workstreams) and `feedback_motion-evidence-for-motion-features.md` (motion-class evidence for motion-class features). The principle generalizes: **the recording is the right tool for felt-experience gates and the wrong tool for invariant-class bugs. Both kinds exist in well-dipper. The current gate doesn't distinguish them.**

---

## Vocabulary worth importing

For future PM briefs that author motion-class ACs, the following named primitives are unambiguous and let an AC reduce to a one-line predicate:

| Term | Definition | Bug class it names |
|---|---|---|
| **Δ-magnitude bound** | `\|x(t) - x(t-1)\| < B` | Teleports, frame-skip, init bugs |
| **Sign-stability** | `sign(Δd_target/dt)` doesn't flip during named phase | Oscillation, overshoot, controller hunt |
| **Monotonicity score** | flip count in window / window size | Quantifies how oscillatory motion is |
| **Approach-phase invariant** | `d_target` is non-increasing during approach | Autopilot regressions like the one Max saw |
| **Zero-input null-action** | `input == 0 ⟹ Δv == 0` (in player frame) | Drift, controller stickiness |
| **Velocity bound** | `\|v\| < c_max` | NaN, explosion, integration blow-up |
| **State-transition well-formedness** | every transition exists in declared state machine | Race conditions, illegal states |
| **Transform-hash equivalence** | hash(positions, orientations) at frame N matches golden | Refactor regressions |
| **Frame-time variance** | var(frame_dt) < V_smooth | Render-smoothness bugs (separate concern) |

These are not industry-standard terms in the sense that you'd find them in *Game Engine Architecture*'s index. They are precise enough that a PM brief written using them can produce an AC the Tester can mechanically verify.

---

## Adoption recommendations for well-dipper

Order matters. Each builds on the previous.

### 1. Add per-frame Δ-predicates to the existing telemetry harness (~2h)

Cheapest, biggest-impact, no architectural changes. The current telemetry already samples enough state; the gap is what gets asserted. Add to whichever module owns the verify pass:

- For autopilot, add an "approach-phase invariant" check: during phases where the brief specifies `target_distance` is non-increasing, fail the verdict if `Δd_target > +ε` for any frame.
- For ship motion, add a Δ-magnitude bound: `|position(t) - position(t-1)| < (maxSpeed + ε) × dt`. ε is whatever covers legitimate teleports (warp, system jumps).
- For autopilot interrupts, add zero-input null-action: when player input is zero and autopilot is not active, ship Δv == 0 in body frame.

These three predicates would have caught the teleport-cycle directly. They also catch a category of future bugs Max hasn't hit yet but will (NaN propagation, integration blow-up, controller drift).

### 2. Refactor the simulation update path to a fixed-timestep accumulator (~half-day)

The accumulator pattern from gafferongames.com, ported to JS. Render stays variable-dt via `requestAnimationFrame`; physics + camera + autopilot move into a `for (; accum >= STEP; accum -= STEP) update(STEP)` loop. ~30 lines of code. The catch: every existing `update(dt)` call needs to either accept the fixed step (preferred) or get migrated.

This is the change that pays back across every future motion-class workstream, because it's the precondition for everything downstream. Without it, replays drift. With it, the sim becomes byte-equivalent across runs given the same input.

### 3. Add seeded RNG + input-replay capability behind a debug flag (~2-3h after step 2)

`?seed=12345&replay=path-to-recording.json` URL params. Replace any `Math.random()` with a seeded PRNG (mulberry32 is 7 lines and deterministic). Record an input vector during normal play; replay against it during test runs. This is the *Retro City Rampage* / Quake `.dem` pattern, scoped down to JS.

Use case: the Tester subagent can now run a replay deterministically, and any per-frame predicate that fails is reproducible byte-for-byte. The current "Tester re-runs and gets different state" failure mode goes away.

### 4. Add a transform-hash golden trajectory for refactor workstreams (~1-2h after step 3)

Box2D-style. Pick a canonical scenario (probably "warp to Sol, autopilot to Earth, manual disengage" — covers the systems Max is actively iterating). Run it once, hash the position/orientation state at every Nth fixed-step (every 60th step = once per second), commit the hashes to the repo. Refactor workstreams assert hash-equivalence; non-refactor workstreams re-bless when behavior intentionally changes.

This is exactly the gap `WS 1` (navigation subsystem split) and the manual-flying-toggle work both need. The current `docs/REFACTOR_VERIFICATION_PROTOCOL.md` is the right *spec*; the transform-hash is the *implementation* that makes it cheap.

### 5. Flight-recorder ring buffer + on-failure dump (~half-day, optional)

Ring-buffer the last 5 seconds of state every frame (~300 frames at 60 fps). When any predicate from step 1 fires, dump the buffer + the next 60 frames to JSON. Bind a hotkey for Max to trigger manually when he sees something visually wrong but the predicates didn't catch it.

Use case: the next time Max watches a recording and sees jank that the harness missed, he hits the hotkey, the dump tells him what frames to look at, and the failure becomes a new predicate. The harness's vocabulary grows from each escape rather than each escape being a one-off investigation.

### What I'm explicitly *not* recommending

- **Unity Test Framework / Unreal Gauntlet.** Wrong project type.
- **Pixel-diffing screenshots against goldens.** Three.js + variable GPU drivers + Cloudflare Pages = endless flake. The *Backwards Is Forward* warning about testing through a wrapped graphics API applies here.
- **A CI pipeline.** No build, no test runner; adding one is a workstream of its own and doesn't pay back on Max's iteration cadence.
- **Property-based fuzzing (QuickCheck-style).** Cool technique; wrong project. The space of meaningful inputs is too narrow to fuzz productively. Hand-authored scenarios outperform.
- **Frame-pacing tooling (PresentMon, CapFrameX).** Solves a different problem (render smoothness) than Max has (simulation correctness). Worth knowing the vocabulary, not worth installing.

---

## What this research didn't reach

- **The actual Sea of Thieves talk.** I could not pull the PDF through WebFetch; I worked from the GDConf article summary, the Game Developer 4-part series secondary coverage, and the Glasp Q&A summary. If Max wants to see the framework Rare actually built, watching the YouTube version (~50 min) is the canonical move.
- **Naughty Dog / Rockstar engineering practices.** Both studios are extremely closed. There are scattered tweets and one or two postmortems, but nothing comparable in depth to the Rare or Vblank material. Skipped on purpose.
- **Specific JS-ecosystem libraries.** I didn't survey what (if anything) exists for deterministic-replay-as-a-library in JS. There may be a thin one; there's no canonical one I could find. The recommendation in step 3 above is build-it-yourself, ~50 lines total, because the dependency surface isn't worth importing for that scope.
- **Source-engine demo format internals.** The Quake `.dem` format is well-documented; Source's `.dem` is a closer relative to what Three.js would need (entity-state-snapshot rather than pure input replay) and would be worth looking at if Max ever wanted compressed save-states rather than input replays. Skipped because step 3 above doesn't need it.
- **Floating-point determinism in V8 across Chrome versions.** I treated this as a non-issue (single-engine, single-arch in scope). If well-dipper ever needs cross-browser-deterministic replays — multiplayer, leaderboards, server-side validation — this becomes a real problem and would need its own research pass. Box2D's writeup is the starting point.
- **Game-feel / juice / hand-feel evaluation methodology.** Out of scope for this question; that is the part the recording-as-evidence gate genuinely belongs to. If Max wants research on *that* — the methodology of authoring and verifying felt-experience targets — it's a different deliverable.
- **The contemporary academic SE-on-games literature.** There's a small corpus (Pascarella et al., Politowski et al.) on game testing as a practice. I sampled and found it descriptive rather than prescriptive — useful for "what do studios do on average" rather than "what should Max do." Skipped.

If Max wants any of these expanded, they're standalone research scoping conversations.

---

## Sources

**Read in full** if Max wants to internalize the patterns:

- Brian Provinciano, *Automated Testing and Instant Replays in Retro City Rampage*, GDC 2015. The canonical indie how-to. [Vault](https://www.gdcvault.com/play/1021825/Automated-Testing-and-Instant-Replays). YouTube version available.
- Glenn Fiedler, *Fix Your Timestep!*, gafferongames.com. The accumulator pattern, foundational. [Link](https://gafferongames.com/post/fix_your_timestep/).
- Noel Llopis, *Backwards Is Forward: Making Better Games with Test-Driven Development*, Games From Within. The honest indie perspective on what TDD gives and doesn't. [Link](https://gamesfromwithin.com/backwards-is-forward-making-better-games-with-test-driven-development).
- Erin Catto, *Determinism*, box2d.org (Aug 2024). The transform-hash pattern in practice. [Link](https://box2d.org/posts/2024/08/determinism/).

**Reference / supporting:**

- Robert Masella, *Automated Testing of Gameplay Features in 'Sea of Thieves'*, GDC 2019. [YouTube](https://www.youtube.com/watch?v=X673tOi8pU8). Coverage: [GDConf article](https://gdconf.com/article/sea-of-thieves-devs-share-automated-testing-tips-at-gdc-2019/).
- bugnet.io, *How to Debug Intermittent Game Bugs*. Practical methodology compendium. [Link](https://bugnet.io/blog/how-to-debug-intermittent-game-bugs).
- Quake Wiki, *Demo Recording*. The original `.dem` format docs. [Link](https://quakewiki.org/wiki/Demo_Recording).
- Aleksandr Hovhannisyan, *Performant Game Loops in JavaScript*. The fixed-timestep pattern in idiomatic JS. [Link](https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/).
- Jakub Tomsu, *Reliable fixed timestep & inputs*. Replay-correctness considerations specifically. [Link](https://jakubtomsu.github.io/posts/input_in_fixed_timestep/).
- Grenouille Bouillie, *A real-time, lock-free, multi-CPU flight recorder*. Ring-buffer telemetry pattern. [Link](https://grenouillebouillie.wordpress.com/2016/12/09/a-real-time-lock-free-multi-cpu-flight-recorder/).
- Unity, *Workflow: How to create a Play Mode test*. Reference for what a mature framework provides. [Link](https://docs.unity3d.com/Packages/com.unity.test-framework@1.1/manual/workflow-create-playmode-test.html).
- Valve Developer Community, *Console Command List* and *Developer*. Source engine's debug-overlay pattern. [Link](https://developer.valvesoftware.com/wiki/Console_Command_List).
- PiControl Solutions, *Online Oscillation Detection*. Industrial-process vocabulary for the same bug shape as the teleport-cycle. [Link](https://www.picontrolsolutions.com/papers/papers-online-oscillation-detection/).

**Rigor flags:**
- *Rigorous, primary*: Catto (Box2D), Fiedler (Gaffer on Games), Provinciano (Vblank), Masella (Rare). All practitioners writing about systems they built.
- *Rigorous, secondary*: bugnet.io, Hovhannisyan, Tomsu. Synthesizing well-known patterns; not original research but accurate.
- *Reference / spec*: Unity docs, Unreal docs, Valve dev wiki. Authoritative for their own systems.
- *Adjacent / borrowed vocabulary*: PiControl, Scitepress mocap-jitter paper. Useful for vocabulary, not direct game-dev sources.

The asymmetry Max asked about — AAA infrastructure vs. one-dev adoptable subset — is real and is the central finding. AAA studios run thousands of bots through CI nightly with deterministic replay, recorded inputs, and assertion frameworks. A one-dev Three.js project gets ~80% of the bug-class coverage from the five techniques in the BLUF, none of which require infrastructure he doesn't already have.
