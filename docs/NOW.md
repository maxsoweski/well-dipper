# Now — Well Dipper

**This file changes every session. It's the single screen that says where we are.**

For longer arc, see `JOURNEY.md`. For meta-purpose, see `HEART_OF_DESIRE.md`.

> ## ▶ 2026-08-19 (evening) — **WORLD-ENGINE LANE: Steps 9a/9b/P-13/10a SHIPPED. ▶ NEXT = MOONS (Step 10b/c).**
>
> **Handoff: [`FEATURES/handoff-2026-08-19-moons-next.md`](FEATURES/handoff-2026-08-19-moons-next.md).**
> HEAD `db1cf51`, tree clean, **3 commits unpushed**. ⛔ Read the handoff's §1 first — a build agent
> checked every one of PLAN Step 10's own citations against the tree and **three are wrong**.
>
> | | |
> |---|---|
> | `f3157c5` | frame-loop guards — Step 10's stated prerequisite, with committed mutants |
> | `2e089b4` | `craterUniforms` exposes `Dchar` → the rocky pack reaches the display-policy seam |
> | `f65d2d3` | ledger: P-08 → accepted-loss, P-10 corrected, P-05 demoted to a wire |
> | `b7adc76` | the three false docs in the next session's startup path |
> | `532d246` | **Step 9a** — the `rockySurface` pack, unregistered |
> | `db1cf51` | **Step 9b + P-13 + Step 10a** — swap, per-body noise offsets, registration |
>
> ### ⭐⭐ THE FINDING THAT MATTERS FOR STEP 12
> `index.js` said *"Registration cannot move a body from the legacy material to the lab material."*
> True of the three gas packs, **FALSE as of `db1cf51`** — `Planet.js:2192` feeds `packs.length > 0`
> into the admission test, so a pack claiming bodies no other pack claimed **admits them**. Swapped
> planets **341 → 846**, and **188 newcomers lose a legacy branch** (lava 52, ocean 6, venus 130 —
> ledger rows R-05/R-06/R-07). ⭐ **Not a live regression**: `LAB_GAS_BODIES_DEFAULT = false` gates
> the whole path, so nothing reaches a player until Step 12. It IS the trajectory Step 12 commits to.
>
> ### ⛔ MOONS DID NOT SHIP, deliberately
> Step 10b/c halted with `proceed=false` rather than pile a second delta on an open one.
> `BodyRenderer` has zero references to the lab material; `tests/moon-render-path.test.js` does not
> exist. **Owed and not run:** Instrument D, the ≥95%-of-moons crater-density gate, and the per-class
> distinctness quad. All are now unblocked.
>
> ### ⭐ OPEN FOR MAX
> 1. **Moons** — greenlit, nothing waiting on him.
> 2. **R-05/R-06/R-07 scheduling** — venus banding on 130 bodies; reserved to him since 2026-08-09.
> 3. **Doc-rot triage, 3 items** — gate repairs (335 → ~92), the citation sweep (2,590 refs across
>    199 docs, currently unscanned), two deep dives. Detail in the handoff §6.
> 4. **P-10's km wavelength** — his ruling: after moons, calibrated against real bodies.
> 5. **3 commits unpushed.** ⛔ sandbox DISABLED, verify with `git ls-remote`.

> ## ✅ 2026-08-18 — **B4 COMMITTED · BINARY PLANETS SCOPED · BINARY-STAR DEFECTS FIXED + UAT-PASSED.** ▶ NEXT = amend B4 with the binary line item, then B5.
>
> **Handoff: [`FEATURES/moon-formation-handoff-2026-08-18.md`](FEATURES/moon-formation-handoff-2026-08-18.md).**
> All four instruments green at `1def6da`; everything pushed. ⛔ **B5 IS BLOCKED** — see the handoff.
>
> ### What landed
> | | |
> |---|---|
> | `492d077` | **B4 — the prediction commit.** Opens the moon window; B5's revert target. |
> | `4f795f0` | **Binary planets: scoped and ruled.** "Provisional render" was the wrong frame. |
> | `7814088` | nav screen — the moon's real orbit radius was cancelling out of its own formula |
> | `a52a2e2` | **`docs/SYSTEMS/generation/README.md`** — the generation layer's first deep dive |
> | `df78785` · `d26971d` | **binary-star mass ratio + orbit speed fixed**, as two revertable commits |
> | `1def6da` · `ee62e69` | Instrument A re-record; the design ruling recorded durably |
>
> ### ⭐ Three findings that change what B5 does
> - **B4's step-2 partition is MEASURED, not predicted:** `{systems 0, planets 502, plainMoons 770, planetClassMoons 24}`. **The 502 planets are predicted nowhere in the plan** — `systemContext.moons` (`StarSystemGenerator.js:947-952`) carries moon `tidalHeating` into the PARENT's hash, so the planet arm reds on the first sub-step and stays saturated, carrying no information for steps 3–9. 502 = every moon-bearing planet, derived two independent ways.
> - **The census's "SECOND FINDING" is WITHDRAWN** — a category error, not a `_pickType` defect. Elser 2011's "terrestrial planet" is the astrophysical rocky class; this generator's `terrestrial` is a game type meaning life-bearing. Right denominator is the measured 3.1357 solid planets/system → **23.79% of systems**, against the plan's 22.89%. Nothing to file.
> - **Binary planets fold INTO the B5 window** via `planets[i].moons[]` — zero renderer changes, and their toll *is* B5's toll. Threshold ruled: **`q ≥ 0.122`** (Pluto–Charon), distribution centred ~0.3–0.6.
>
> ### ⭐⭐ WHAT MAX LOOKED AT AND PASSED
> Binary-star geometry and lighting in the live game, `wd-272` / `wd-197` / `wd-10`. The mass-weighted centroid of the two **drawn** stars lands exactly on the rebased system origin, and the heavier star now sits on the tighter orbit. **Ruling: binary pairs stay physically correct and therefore visually static at 1×** — recorded in `SYSTEMS/generation/README.md` §7 item 2 so nobody "fixes" it back.

> ## ✅ 2026-08-15 — **C7 (Step 8b) SHIPPED, UAT-PASSED AND PUSHED.** ▶ NEXT = THE WORLD-ENGINE DEEP DIVE.
>
> **Handoff for the next session: [`FEATURES/step8-handoff-2026-08-15.md`](FEATURES/step8-handoff-2026-08-15.md).**
> Max UAT'd `wd-27/3/1` in the live game and passed it, then redirected the question —
> *"yes? you would know better than me though in terms of the sizes and what's realistic."*
> ⭐ He was right to: physical plausibility is measurable and is Claude's job, not his eyes'.
> The check that followed confirmed the temperature **and found the moon-size defect below**.
> ▶ Next session: deep-dive the remainder of the world-engine plan + hunt the bug family.
>
> Planet-class moons no longer generate at a hardcoded 1 AU. `MoonGenerator.js:378` now reads
> `Math.max(parentOrbitAU ?? 1.0, 0.01)` — the parent's **generation-time** orbit, the same
> convention `:254` already used for plain moons and the one B7's RC3 established.
>
> **Six commits, `9ebb24b` → this one.** The delta table was committed **one commit BEFORE**
> the change, so the prediction's priority is in the git history, not just in a message.
> **Every predicted number held and nothing was adjusted to fit.**
>
> | | |
> |---|---|
> | `9ebb24b` | the delta table, measured pre-change, with the geometry columns |
> | `4cee76a` | src — the universe change, isolated |
> | `ab173a3` | gate — draw-stream set re-derived; now the convention's only witness |
> | `6fe87a5` | re-bless Instrument B |
> | `a07b522` | re-record Instrument C |
> | *(this commit)* | docs — four stale references repaired |
>
> **Instrument A needed NO re-record** — the gate fix and B's re-bless returned the four
> newly-red tests to green, so the failing-ID set is exactly the baseline's 24. The build
> plan's C8 assumed a 24 → 26 re-record; it was not needed.
>
> ### ⭐⭐ WHAT MAX HAS TO LOOK AT — 24 moons, and 7 of them are a different body
> Planet-class moons are 3.0% of moons and all of them render through the **full `Planet`
> renderer** (`src/main.js:7636`), not `Moon.js`. **All 24 change.**
> - **17 of 24 — same rock, different climate.** Identical size, orbit, angle and tilt.
>   Surface temperature moves **>50 K on 24/24 and >100 K on 21/24**, median **151 K (272 °F)**;
>   17 get colder, 7 hotter. Six cross from a rocky surface to none at all (h₂-he envelope at
>   10–15 bar). Eleven **lose an aurora**. Nine shift ground colour visibly (≥0.02/channel).
> - **7 of 24 — visibly a different moon in a different orbit.** Radius **0.97×–1.97×**, orbit
>   radius **0.58×–1.40×**, a different point in that orbit (median 2.2 rad), a different plane
>   tilt (one sign flip), speed up to 34% off. **Five of the seven become tidally locked** —
>   one face forever. That is gameplay-visible, not a palette shift.
>
> ⭐ **Park him on `wd-27` planet 3 moon 1** (radius 1.97×, orbit 0.63×, 5958 K → 175 K, gains
> an atmosphere) — never a guessed seed; a random one has no planet-class mover and produces a
> green, pretty, meaningless pair. Second: `wd-174/0/1` (orbit 0.58×, locks into 3:2).
> ⛔ **Ask for the one quantity that changed, not for a review of the body** (handoff §4.2).
>
> ### ⭐ NEW — the bug FAMILY C7 belongs to, filed 2026-08-15
> [`FEATURES/world-engine-reconciliations-2026-08-15.md`](FEATURES/world-engine-reconciliations-2026-08-15.md)
> — *"what other kinds of reconciliations like the one we just found will need to be
> planned/implemented"* (Max). One family, two sub-shapes: **Sol-defaults** (a missing context
> value silently substitutes the Sun/Earth — B7 RC2, B7 RC3 and C7 are all this, all now fixed)
> and **authored-for-looks constants** never revisited once physics arrived — **zero fixes so far**.
>
> ⭐⭐ **First confirmed instance of the second shape: planet-class moons are binary planets.**
> `MoonGenerator.js:381` draws a moon at 10–25% of its parent's radius while the comment on the
> line above says *"Ganymede is 0.038× Jupiter"* — it names the real ceiling and then draws
> 2.6–6.6× above it. Mass goes as radius³, so that is a ~250× mass overshoot. Measured on
> `wd-27/3/1`: **7.1% of its parent's mass** (Ganymede/Jupiter is 0.0078%; Charon/Pluto, a real
> binary, is 12%). ⛔ **Pre-existing — C7 re-drew this body's fraction but did not widen the range.**
> ▶ Max wants a fix prioritised alongside the world-engine rendering work. Shape is in §3;
> **the target value is a game-feel call and is his** — physically honest is ~4–6× smaller moons.
>
> ### Open, filed, not done
> 1. Instrument A's baseline provenance: recorded from `952c5d0` with `dirty: true`, and the
>    instrument warns about it itself. Unresolved, pre-existing, now named.
> 2. `tools/port-uniform-delta.mjs` prints "the `bake`, `condition` and `gate` rows are
>    unaffected" — false under C7: 13 of the 31 movers are non-record tier and read a hollow
>    `0/461` because the 65 movers are excluded before those rows are computed.
> 3. ⭐ The citation fence caps a symbol span at **110 chars** (`:1142`). Repairing a ref by
>    quoting a line longer than that **silently demotes it to UNCHECKED while exit stays 0** —
>    hit live in this session, caught only by watching the counters.
> 4. Everything still open on 8a: the stale-rescale gate, `atmoPhysics.retained` unreached for
>    planets, `ExoticOverlay.js` outside `CITE_SOURCES`, composition-weighted greenhouse τ.
>
> ---
>
> ## ✅ 2026-08-14 — BREAK B7 CLOSED **AND UAT-PASSED BY MAX**.
>
> **Handoff for the next session: [`FEATURES/step8-handoff-c7-2026-08-14.md`](FEATURES/step8-handoff-c7-2026-08-14.md).**
> Max UAT'd three planets on the live game and passed B7 — *"yep, that's right"* (wd-614),
> *"i think so, yes"* (wd-79). He re-reported **QB-1** on wd-45 (*"a huge orange stripe"*) and
> deferred it: *"We don't need to do that now."* That band is the **terminator gradient**, not the
> atmosphere — and B7 only made this planet exhibit it, by ending its airlessness.
> He chose to **continue with C7** despite exotic rendering being rough across the board.
>
> `tests/moon-condition-contract.test.js` **15/15** (was 13/2). C6's two red-by-design gates both
> pass and **neither was weakened**. All four instruments green. HEAD `dc0779c`, tracked tree
> clean, **NOT PUSHED — needs Max's OK.** Seven commits, `10d4d1a` → `dc0779c`.
>
> **THREE root causes in `ExoticOverlay._swapPlanetType`, not the two the plan named.** A type
> swap was also silently moving the body to a different star (`zones: null` ⇒ derived as if it
> orbited the Sun) and a different orbit (regenerated at the **post-migration** AU while every
> other body uses its **generation-time** AU). ⭐ That second one is the defect C6 measured but
> could not name a fix for — its "3 → 1, not 0" is reproduced exactly by fixing only the first.
>
> ### ⭐⭐ WHAT MAX HAS TO LOOK AT — this changed what renders
> **10 planets** changed surface colour (`landPalette` / `lavaGlowColor` / `lavaCrustColor`), and
> `wd-45/0`'s hex planet **gained an atmosphere** — its T_eq fell 1023.57 K → 457.75 K once it
> was derived against the star it actually orbits, so atmospheric escape stopped stripping it.
> **The physics being right is measured. Whether it LOOKS right is his call**, and no instrument
> in the tree stands in for that. Seeds to park him on: `wd-45`, `wd-79`, `wd-614`.
>
> ✅ **C7 shipped 2026-08-15 — see the block above.** `MoonGenerator.js:378` no longer holds a
> hardcoded 1 AU. It was indeed a UNIVERSE change, and the measured figure is **7 of 24 = 29.2%**
> of surviving planet-class moons (the "~22%" quoted here did not reproduce on any corpus).
> Delta table: [`FEATURES/step8b-c7-delta-table-2026-08-14.md`](FEATURES/step8b-c7-delta-table-2026-08-14.md).

> ## ⭐⭐ 2026-08-12 — MAX'S THREE RULINGS, AND ONE OF THEM CORRECTS A PREMISE THAT BLOCKED WORK FOR DAYS.
>
> 1. ⭐ **THE OVER-PAINT FIX IS APPROVED — "thinner line is fine" — AND `d7db3a3` NEVER BLOCKED IT.**
>    Max: *"That statement was about a patch fix you had put in previously that would actively fade
>    out rings. That's not what we're talking about here."* ⛔ **He is right, and the record was
>    wrong.** `d7db3a3` retired the **proximity FADE** — an alpha multiply whose kill radius scaled
>    with the ORBIT radius (`near = max(0.35, 0.02*R)`), so on an r=67622 ring the line died 1352
>    units out while the planet is ~1 unit across. That is a whole line VANISHING by distance. The
>    over-paint fix changes line **WIDTH IN PIXELS** and makes it correct. Two different mechanisms;
>    the scope doc, the handoff and this file all treated the first as precedent against the second
>    and parked the work on it. **A ruling generalised past the thing it ruled on is how a fix stays
>    blocked by nobody.** The scope doc's §5 Move 2 gate is void — it was asking a question already
>    answered.
> 2. **The river/tectonic destination is DELEGATED, not answered.** Max: *"I really don't know how to
>    rule on this. Honestly, I'm not sure why it matters."* — with the criterion that replaces it:
>    ***"What I care about is being able to use the systems that we created for world engine in the
>    main well-dipper game. I want to make this as optimized and well-architected as possible."***
>    Taken under that criterion: **`src/rendering/bake/`** (ledger C25), still its own step.
> 3. **Step 8 is greenlit** — *"yes, I want to proceed that way"* — and by workflow.
>
> ⛔ **READ THE PRIORITY, NOT JUST THE RULINGS.** The over-paint fix is now unblocked and Max said of
> it *"I'm not sure why it matters, one way or the other."* It is ring cosmetics. **It is not what he
> wants next.** Do not open a session on it.

> ## ⭐⭐ 2026-08-12 — STEP 7 SHIPPED: THE FIVE SHARED MODULES ARE UNDER `src/` (`c479e29`..`b5b91af`).
>
> The `src/` module move — deferred eight times against *"I want to get the world engine rendering
> system into the main game ASAP."* Four commits: pre-move rulings → the move → the boundary fence →
> the Instrument A re-record.
>
> | from (repo root) | to |
> |---|---|
> | `body-condition-vector.js` | `src/worldengine/base/conditionVector.js` |
> | `planet-lod-lab-core.js` | `src/worldengine/base/labCore.js` (**whole**, 1194 lines) |
> | `planet-lod-uniforms.js` | `src/worldengine/shaders/uniforms.js` |
> | `planet-lod-shaders.glsl.js` | `src/worldengine/shaders/planetShaders.glsl.js` |
> | `planet-lod-height.glsl.js` | `src/worldengine/shaders/height.glsl.js` |
>
> **The content did not move.** `git show HEAD:<old> | diff - <new>` on each of the five: import
> specifiers only, every hunk `NcN`, and `uniforms.js` is an EMPTY diff. 210 quoted strings rewritten
> across 118 files — 190 import specifiers (the pre-flighted count, reproduced) **plus 20 path
> strings** that `readFileSync` a corpus. ⛔ Those 20 are the half a specifier-only pass misses and
> they are all inside fences.
>
> ⭐⭐ **THE REAL WORK WAS NOT THE MOVE. Three fences WALK `src/worldengine/**`, so three files
> changed meaning by arriving** — and the pre-flight had named only one of them:
>
> 1. **`radius-live-feed-fence`** — the C17 ruling, **and it was one hit short**. It said "exactly ONE
>    live DENY hit" and there were **two**: :105 (live code) *and* :95, a prose comment. The recorded
>    reason for discounting :95 — *"the scan is comment-blind"* — is **the opposite of true**; that
>    scan is comment-INCLUSIVE by design, which is why `giant-drivers.js:62`, a prose comment, was a
>    hit and was REWORDED. :95 was reworded pre-move; :105 is allowlisted as
>    `conditionVector-canonicalDenominator` (`_R_c` is the **canonical** preset radius, the D14
>    gravity denominator; rewiring it forces `gravityRadiusRatio` to 1.0 and **permanently disables
>    the self-compression law** — the "fix" deletes the physics). The file also joins
>    `REQUIRED_CARRIERS` so the scan cannot go vacuous there.
> 2. **`vis-scale-fence`** — **a REAL exception, not a false positive.** `labCore.js` DEFINES the
>    display scale (25 token hits, four exports) and now sits inside the tree that fence declares
>    token-free. One named, liveness-checked carve-out; `checkedTree()` throws if the entry is dead
>    OR stale; all three sweeps go through it. Carried **C23**, cleared by the labCore split — which
>    Step 7 itself defers. Unchanged and still proven: **no CONSUMER under `src/worldengine/**` reads
>    the token.**
> 3. **`worldengine-e1-shadow-audit`** — `conditionVector.js` imports `compositionClass` from
>    `e1Regime.js`, which the audit bans by MODULE. New `E1_SYMBOL_CONSUMERS` exempts the *import*
>    clause only (narrower than the blanket exclusion `lidResponse.js` gets) and keeps asserting
>    computeE1-freedom comment-blind, with a **planted control** proving a LIVE `computeE1()` call in
>    an exempted file is still caught.
>
> **The boundary fence does NOT claim zero.** 5 escapes measured: **one** root-module
> (`fieldSampler.js:149` → `planet-lod-rivers.js`, blocked on PLAN §7's undecided three.js question —
> **Max's call**, carried **C25**) + four test-helper. The count of root entries is pinned at one, so
> a second cannot arrive quietly. 11 tests, **six planted controls**.
>
> **Gates, all executed.** Byte-identity of the lab's resolved uniform bundle: **subject 0/18 hashes
> differ** pre-move vs post-move, **control 18/18 differ** under `radiusEarth × 1.000001` — a zero
> with no control that moved is not evidence. Lab imports 43/40-relative/**0 missing**. `npm run
> build` ✅. Four instruments green; **Instrument E 22/22 across nine fixtures**, unmoved.
>
> ⚠ The handoff predicted Instrument A would move **+2**; the true figure is **+16 with 3 renames**.
> Two of the sixteen were **generated, not authored** — the e1 audit keys its ID set on a DIRECTORY,
> so a file arriving in `src/worldengine/base/` writes tests nobody typed. A move is not ID-inert.
>
> ▶ **Next: Step 8** (moons get a real condition record, derived and never drawn) — deps Steps 2 + 7,
> both now shipped.

> ## ⭐⭐ 2026-08-12 — THE ORBIT-RING DEPTH ARTEFACT IS FIXED (`b9eeaec` + `22c8b8a`). ✅ SHIPPED — MAX UAT PASS 2026-08-12 ("yep, fixed").
>
> The ring drawn THROUGH the planet (§1–§4, open since 2026-08-10). Fourth candidate refuted (§9),
> fifth landed. **Rule:** of the ≤4 roots §8's front-arc gate already computes, keep those in front
> and within the **band's own reach**, write the **minimum** clip w. Zero extra `texelFetch`, zero
> extra `sqrt` — it reads what the gate already computed and threw away.
>
> ⛔ **Three constants, each a measurement:** *min* not screen-nearest (nearest = candidate 4, error
> `(d+R)/(d−R)`, unbounded, and it **hides** line — `d7db3a3` territory); window = band reach
> `pw·0.5 + f·0.941096864` not `uArcTolPx` (at 3.0 it writes **5962× too near** and recreates §2's
> leak); w from `rowW` not `Hfwd` (normalized ⇒ **5.3e-7×**).
>
> **Live, seed `lab-procedural-6`, scored as the PAIR** (leak *and* over-occlusion — a leak count
> alone says candidate 4 was perfect): **163/195/220/149/26 leaks and up to 20 over-occlusions →
> 0 / 0 at all seven poses.**
>
> **Instrument E 22/22 across NINE fixtures**; P1/P6 still 1114 px / 2 rows / 0 debris, so §8's
> coverage is untouched. +P8 (inclined ring, camera in-plane at d=1.002R, `wMax/wMin`=1001) and +P9
> (the front-branch guard's last decisive regime, 557 px at camera height ≈1). M1 was repointed —
> `clipw×0.37` became *vacuous*, not weak, once the depth left `wclip`.
>
> ✅ **MAX UAT PASS 2026-08-12** — parked live at planet p3, 6 body radii, just off the orbit plane.
> Verdict: *"yep, fixed"*. The orbit line stops at the limb, and nothing went missing — which was the
> direction that killed candidate 4. **Shipped.**
>
> ⛔ **STILL OPEN, and it caps this pass:** 45.9% of painted px have NO ring point within the band's
> reach at all. The Sampson band over-paints; the depth rule can only fall back there. Next to scope.

> ## ⭐⭐ 2026-08-12 — THE PHANTOM RING IS ROOT-CAUSED AND FIXED (`945f08d` + `1a3c1e3`). ✅ SHIPPED — MAX UAT PASS 2026-08-12 ("works").
>
> ⛔ **SUPERSEDES the 2026-08-11 entry below.** That fix (`03cb1dd`) is real and independent — 13
> conics entirely behind the camera were carrying the "unbounded" sentinel — but the phantom
> **survived it**. Three fixes were then proposed and refuted (artefact doc §7.2). This is the
> fourth, and the first that names the mechanism.
>
> **Root cause, one identity.** `Cs` is built from `adj(H)`. As the camera nears a ring's plane
> `adj(H)` collapses to rank 1, `adj(H) ≈ u·vᵀ`, so
> `Cs ≈ (u₀²+u₁²−R²u₂²)·v·vᵀ` — a **double line**, whose zero set `vᵀp = 0` is exactly the ring
> plane's **vanishing line**. The band paints that line. The phantom pixels are not near-misses;
> they are *on the conic the CPU handed the shader*, which is why §7.2 measured the phantom's true
> distance to it (0.663 px) **smaller** than the real ring's (0.922 px).
>
> ⛔ **And that is why all three gates were blind at once.** The reconstruction is
> `adj(H)·p = u(vᵀp)`, **zero on that same line** — a pole. Clip-w magnitude, reconstructed radius
> and exact distance-to-conic are three readings of one degenerate operator taken at its pole. So
> is `planeRatio`, the "debris" metric: it read **1.2 on phantom pixels** at low camera height and
> **2.2 on genuine ring pixels** at the bounded edge-on control. It is a signal, not evidence.
>
> **The fix** is §7.2's untried direction (a), on the **forward** map — perfectly conditioned exactly
> where the inverse collapses, the same property `axisExtentInto` already relies on. `screen_x(θ) =
> px` is *linear in (cos θ, sin θ)*: closed-form root pair, **one sqrt, no trig, no inverse, no
> `adj(H)`**. Each root is a real point *of the circle* whose clip w is evaluated forward. Both
> screen axes, minimised. `Hfwd` rides texture rows 8–9 (2 texelFetch — its third row is exactly
> `hScale·rowW`, already fetched).
>
> **Measured**, against a brute-force forward-arc oracle with no reconstruction in it, 30 poses
> (radius 0.18 → 67622, four azimuths, two inclinations, heights 1 → 200, five all-legitimate
> controls): **27625 real px max 1.525 px · 6197 phantom px min 6.439 px · 0 in between.**
> `uArcTolPx = 3.0`, scale-free by construction.
>
> ⭐ **LIVE A/B, frozen frame, seed `lab-procedural-6`, camera on the moon `Al` (p5 m2) — Max's own
> repro.** Two shots with nothing changed between them differ by **exactly 0 px**, so the frame is
> genuinely static and the rest is the gate alone. Toggling it: **10026 px change, every one green
> REMOVED, zero added**, confined to **y 285–290 (two render rows) spanning x 0–1670, the full
> width**. That is Max's sentence — *"the faint green line straight across the upper-fifth of the
> screen"* — and nothing else in the frame moves. 172 fps median, console clean.
> Oracle-audited in the live 17-ring scene at three framings: **0 real px dropped, 0 phantom kept.**
>
> **Instrument E** (shipped GLSL, not the twin): P1/P6 `1671 px / 3 rows / 557 debris` →
> `1114 / 2 / 0`; P2–P5 unchanged; **16/16 mutants killed**, incl. M14 (tolerance ×0.05 → real ring
> erodes, so the fixtures can see over-tightening) and a new **P7** — camera exactly in the plane —
> which closes a hole older than this fix: nothing exercised the `wclip = ring centre` fallback that
> keeps an edge-on ring from **vanishing** (`d7db3a3`), so `M3-drop-frontguard` had started
> surviving once the arc gate took over the coverage half of that guard's job.
>
> ✅ **MAX UAT PASS 2026-08-12** — parked live at seed `lab-procedural-6`, moon `Al`, looking away
> from the star. Verdict: *"works"*. The full-width line is gone and the real orbit curves are
> unchanged. **Shipped.**
>
> ⚠ **STILL OPEN, deliberately not bundled:** the §1–§4 **depth** artefact (ring drawn through the
> planet). The arc solve now makes it cheap — it already computes the exact θ of the nearest
> in-front circle point, which is the closed-form line∩circle solve §4 called "CORRECT and
> independently verified", reached from the well-conditioned side.

> ## ⭐⭐ 2026-08-11 — THE PHANTOM RING IS FOUND AND FIXED (`03cb1dd` + `1e4c7c8`). CARRIED OPEN ITEM 1 IS CLOSED.
>
> ⛔ **SUPERSEDES the carried reading "the phantom is a REAL conic rendered wrongly, not a spurious
> one".** Half right. There is no spurious conic — 17 conics for 17 real orbits was always correct,
> which is why hunting for an extra one kept failing. It is a real **PLANE** painted where its
> **ring** is not.
>
> **Root cause.** `buildRingConic` decided a projection was "genuinely unbounded" from `wMin > 0`
> alone. clip-w around the circle spans `[wMin, wMax]`, which admits **three** geometries, not two:
> whole circle in front (`wMin > 0`, bounded); straddling the camera plane (`wMin < 0 < wMax`,
> genuinely a hyperbola); and **whole circle BEHIND the camera** (`wMax <= 0`, nothing to draw).
> Only the first two were handled — everything else fell through to the `±CONIC_EXTENT_UNBOUNDED`
> sentinel, which **disables the extent reject**. That reject is the only bound on the edge-on
> degeneracy's infinite zero set; the shader says so itself: *"edge-on, Cs degenerates to a double
> LINE whose zero set is infinite, so the band alone paints far beyond the ring."*
>
> **Measured live**, camera on the moon `Al` of the outermost planet, `dot(forward, toStar) = -0.912`:
> **13 of 17 conics were entirely behind the camera and every one carried the sentinel** — one of
> them radius **0.18 at camDist 7183**, which cannot cross any camera plane by five orders of
> magnitude. The line sat at **y=155 of 855**; the ecliptic's vanishing line, computed independently
> from the projection matrices, images at **y=155**. Culling exactly the `wMax<0` set removed the
> phantom and nothing else.
>
> **Why it tracked the zoom** (Max: *"zoom out, it fades; zoom in, it gets more solid"*): ORRERY
> pivots on a body that is itself in the ecliptic, so camera height above the orbital plane is
> exactly `distance · sin(pitch)` — measured 12.952 against predicted 13.059.
>
> ⭐ **The fix needed NO GLSL EDIT** — an empty extent (`min > max`) in `ringConic.js`, since the
> extent reject already runs before the front-branch guard. It therefore stays clear of the ring
> **draw-through** item, which is still blocked behind building numeric coverage for
> `CONIC_FRAGMENT_SHADER`. 9 new tests in the existing `a12` idiom (7 RED at `85f227f`), incl. an
> explicit anti-over-fire gate that the two legitimate cases `a6`–`a11` pin are NOT culled.
>
> ⚠ **STILL OPEN:** the *thick* line through the planet is conic #5 — the orbit the camera is
> actually riding, correctly flagged as straddling. Whether it is drawn correctly at that grazing
> angle is the separate draw-through item; it draws through the planet.

> ## ⭐ 2026-08-11 — THE ORRERY ZOOM-INTO-STAR BUG IS FIXED (`b9ea438` + `1a2b5a6`). ✅ SHIPPED — MAX UAT PASS 2026-08-12 ("works"), ratified 24h after landing.
>
> Max: *"The camera keeps getting placed in the star whenever I zoom all the way in after clicking
> twice on a planet or moon."* Diagnosed with a 5-agent workflow (4 read-only recon lanes + an
> adversarial refuter — **all four returned CONFIRMS**), then confirmed live before any edit.
>
> **Root cause: two writers own "the body the camera is dealing with", and only one is re-issued
> every frame.** The zoom floor comes from the body you CLICKED (`selectTarget` :10011 / the click-2
> glide :13987 → `minDistance = radius * 1.05`). The orbit pivot comes from the global
> `focusIndex`/`focusMoonIndex`/`focusStarIndex` triple, re-applied 60×/s by the tracker
> (`main.js:12367-12395`) — **a triple no click path writes or clears** (18 writer sites; not one
> falls inside `selectTarget` or either click branch). So the wheel drove `distance` to a floor
> scaled by body X about a pivot on body Y, and **no pivot-relative clamp exists anywhere** in the
> camera to stop it entering Y.
>
> ⭐ **The glide MASKS it while it runs** — `_gliding` pins `this.target` on the clicked body — which
> is why the gesture looks right until the wheel is touched. The first wheel tick ends the glide,
> both guards drop, and the pivot teleports.
>
> **The fix is one invariant, not five patches:** `minDistance` and the identity of the body it came
> from are written by one function (`_setFocusAnchor`) and only that function, and `trackTarget`
> refuses a per-frame anchor that names a different body. `restoreFromWorldState` /
> `adoptCurrentPose` reset the floor (load-bearing — without it the guard would refuse the tracker
> forever). The click paths still do NOT write the focus triple: that is the bigger candidate fix and
> it would change the cockpit snapshot, NavComputer, orbit-ring highlight, system map, debug panel
> and `hasFocusedBody` all at once.
>
> **Verified.** New `src/camera/__tests__/focusAnchorCoherence.test.js` (5 gates, named in `1a2b5a6`)
> — RED at `85f227f` with *"expected 500 to be less than 0.000001"*, green now. 49 files / 739 tests
> across camera + cockpit-FocusedBody + flightExitAnchor. All four instruments green; `main.js` edit
> line-count-neutral (2/2) so no citation moved. **Live, real mousedown/mouseup + wheel:**
> cam→clicked planet **8127.3 → 0.4756** (its own 1.05R floor); cam→tracker's body 0.4755 (inside it)
> **→ 8875.2**; cam→star 1429.2 **→ 6747.6**.
>
> ⛔ **REPRO PRECONDITION — a cold ORRERY entry CANNOT reproduce this.** `_frameSystemForOrrery`
> clears the triple to -1 and `viewSystem` resets the floor. The tracker must be ARMED first
> (`_lab.beginAutopilotTour()` → `_lab.stopAutopilot()` → `stopFlythrough` launders
> `findClosestBody`'s answer, whose first probe is the star). A test that skips that step proves
> nothing — this is how the previous session's revert came to look like a cure.
>
> ⭐ **Synthetic wheel events must be dispatched on `document.getElementById('canvas')`**, never
> `window`/`document` — the listener is on the canvas, `{passive:false}`, and calls
> `preventDefault()`, so `cancelable: true` is required. `deltaY < 0` zooms in. This was the previous
> session's stated blocker and it is now solved; fix verification is exercisable end-to-end.
>
> ⚠ **Known non-goal, measured not assumed:** after a click the pivot is a one-shot copy, so the
> camera does not FOLLOW the clicked body around its orbit. Already true whenever `focusIndex` is -1;
> drift is ~0.005 units per 25 s against a moon radius of 0.04. Live following is a separate change
> with its own UAT.
>
> ▶ **STEP 7 PRE-WORK LANDED — the C17 ruling now has a number.** Moving `body-condition-vector.js`
> into `src/worldengine/base/` puts it inside the `radius-live-feed-fence` corpus
> (`jsFilesUnder(ROOT, 'src/worldengine')`, `tests/radius-live-feed-fence.test.js:102`). Measured the
> DENY pattern over all five files to be moved: **exactly ONE live hit**, `body-condition-vector.js:105`
> `const _R_c = fp.radiusEarth ?? 1.0;` (⛔ **CORRECTED 2026-08-12 at the move: the other match,
> :95, IS a hit — that scan is comment-INCLUSIVE, and :95 was reworded in `c479e29`**). It is a **FALSE POSITIVE**: `_R_c` is deliberately the *canonical* preset radius —
> the denominator of the D14 gravity mass-radius ratio — explicitly distinguished from `_R`, the
> DRAWN radius passed as the 3rd argument. **The ruling is "allowlist it with that reason", not
> "rewire it".** `planet-lod-lab-core.js`, `-uniforms.js`, `-shaders.glsl.js`, `-height.glsl.js`
> carry **0** hits, so they enter the corpus for free.

> ## ⭐ 2026-08-10 — AGENT CAMERA API SHIPPED (`606df5a`..`34046f4`). THE BEACH-BALL PROBLEM IS A NUMBER NOW.
>
> `_lab.frameBody(subject, {radii})` and `_lab.approachSweep(subject, {from,to,steps})` exist on
> **both front-ends**. Max asked for this: *"a better system for you to drive in orrery, snap to
> planets/moons/stars at various radii without having to use the human interface"*, and ruled the lab
> page in so both can be framed by the same code.
>
> **The headline, measured on both front-ends (seed `lab-procedural-6`):**
> ```
> 20 -> 13.84 -> 9.57 -> 6.62 -> 4.58 -> 3.17 -> 2.19 -> 1.52 -> 1.05  body radii
> oct  4.00     6.05    8.19    8.97    9.00    9.00    9.00    9.00    9.00
> ```
> Saturation onset in **(6.62, 4.58]**. **Five of nine rungs resolve nothing new** — the disc grows
> ~4.4× from 4.58 radii to 1.05 while the octave budget does not move. That is Max's
> approach-consistency criterion as a number for the first time. ⛔ Fixing it is **PLAN §LAYER 7,
> after Step 7** — unchanged by this.
>
> ⛔⛔ **CORRECTED SAME DAY — that sweep ran with the 6e flag ON.** `localStorage['wd.labGasBodies']`
> was `'1'` from an earlier session, so the "game" body was carrying the **lab** material and the
> comparison was the lab shader against itself. At the shipped default the same gas giant has **71
> uniforms, no `uOctaves`**, and ramps **`uReliefOctaves` 4 → 9** instead. Both shaders saturate, so
> the octave-ceiling finding stands — but the lab's advantage up close is **a 356-uniform shader
> versus 71**, i.e. a PIPELINE-PORT gap, not an LOD gap. ⛔ **THE FINGERPRINT MOVED — 71 → 72 AT B2P, 2026-08-20.** `uPosterizeLevels` joined the game material (src/rendering/posterizeLevels.js:45 `export const POSTERIZE_LEVELS = { value: 6.0 };`), so a body ON THE GAME MATERIAL now reports **72** uniforms and 71 identifies nothing. 71 was correct the day this line was measured; it is kept, annotated, rather than rewritten. Debug against `isLabPlanetMaterial` — a boolean cannot drift with the next uniform. ⭐ That makes Max's "pipeline first" ruling
> measurably correct. Full record + the M1 measurement: `FEATURES/lab-pipeline-into-game-PLAN.md`
> §LAYER 7. ⛔ **Check the flag before quoting any game-vs-lab comparison** — it is silent and sticky.
>
> ⭐ **CORRECTION TO A CARRIED CLAIM — read before touching planet-class moons.** The 2026-08-10
> handoff says their `uOctaves` is "frozen at 4.0". MEASURED: there is **no `uOctaves` to freeze**.
> A planet-class moon (`body.planet.f5791a`) is **not on the lab material at all** — 71 uniforms (**72 since B2P, 2026-08-20**; see the annotation above),
> `isLabPlanetMaterial false`, carrying `uReliefOctaves`/`lodLevel` — against an ordinary planet's
> 356 uniforms with `uOctaves` driven. The LODManager registration gap is **downstream of a material
> gap**. ⛔ Code that tests for a 4.0 will read `undefined` and conclude the wrong thing.
>
> ⚠ **Two contract premises were WRONG and are amended in place, not quietly passed:** the game has
> **no near clamp** on the `focusOn` path (asked 0.4, achieved 0.4, camera inside the body — the
> `radius*1.05` floor belongs to ORRERY focus min-distance); and AC-3's planet-class-moon prediction,
> above. ⛔ **AC-3's `agrees:false` branch is unit-tested only** — not witnessed live in any scanned
> seed. Do not quote AC-3 as fully closed.
>
> ⛔ **`setCameraPose` is FIXED** (it never called `cameraInterp.resync`, so it reported `posDelta: 0`
> with the pose reading back correctly while the camera left). Callers silently getting a stale pose
> now get the pose they asked for. **Prefer `frameBody`**: `focusOn` writes controller STATE, which
> every frame recomputes from, instead of defending a hand-written pose against the loop.
>
> Contract + evidence: `docs/WORKSTREAMS/agent-camera-api-2026-08-10/`. All four instruments green,
> citations 320.

> ## ⭐ 2026-08-06 — MASTER MERGED INTO LANE A (`a865753` + `a52b2ce`)
>
> Lane A now carries trunk's **navigation / ORRERY / cockpit**, so generated systems are
> explorable with the shipped nav stack. Direction was master → lane A only; lane A is NOT ready
> for trunk. Merge base `25fe51c`; 6 files overlapped, 2 needed hand resolution (`src/main.js`,
> this file).
>
> ⭐ **`_lab.spawnProceduralSystem(seed)` now lands you in ORRERY.** It runs master's ceremony-free
> entry tail (consume `_pendingBootReveal`/`_pendingBootMode`, frame, arrival zoom, orbit sync).
> Without that tail the spawn was half-entered and `_effectiveRegime()` lied — a merge-interaction
> bug **neither branch's tests can catch**. `commitBurn()` from ORRERY auto-swaps to HELM, so the
> Layer 2 recipe (`selectBody` → `commitBurnNow`) still flies the LOD-ramp approach.
>
> ⛔ **NEW KNOWN-FAILURE BASELINE: 24 failed / 17 failed FILES / 22685 passed.** That is GREEN —
> check here before blaming yourself. The old 4-failure baseline is gone (master FIXED
> `KnownObjects` ×3 + `GalacticFeatures` ×1). The 24 are two master-only golden suites,
> `ProcgenSnapshot.test.js` (×23) and `componentSystems.byteSafety.test.js` (×1), whose fixtures
> were captured ON master; lane A's world-engine work deliberately changed procgen output, so they
> cannot match here. Proven not-merge-damage two ways: the identical 23-seed set fails against
> **pre-merge** lane A (`373e4f5`) in a clean worktree, and every differing field
> (`age`, `metallicity`, `magneticField`, `eccentricity`, `tidalHeating`, `lavaCrustColor`,
> `iceness`, `landPalette`) is emitted by lane A's `PlanetGenerator` and by none of master's — plus
> `composition.density`, where lane A replaced master's linear blend with `1/specificVolume`.
> Fixtures deliberately **not** re-captured: they exist to prove master's workstreams were
> additive, and `_captureAuthoredParent.mjs` carries a self-guard against exactly that re-capture.
> 17 failed FILES = 15 `vendor/motion-test-kit` "no test suite" + those 2.
>
> ⛔ **RULED 2026-08-06 — leave them red; do NOT capture a lane-A procgen snapshot yet.** Max
> deferred it behind a dependency: the snapshot gets taken only once the **World Engine → game
> procgen/rendering merge is MVP**. A snapshot taken now pins a half-migrated state and would alarm
> on every legitimate remaining step. Named gating gap, verified against source: **moons are not in
> the pipeline at all** — no moon path in `src/worldengine/**`, `MoonGenerator` emits ~none of the
> condition fields (`conditions` 0 vs 1, `tidalState` 0 vs 8, `magneticField` 0 vs 8), and
> `tryLabShader` structurally excludes them (`body.planet.` filter, `src/main.js:2422`). Full record
> + reasoning: [`FEATURES/lab-pipeline-into-game-PLAN.md`](FEATURES/lab-pipeline-into-game-PLAN.md)
> header. ⛔ Do not re-propose the snapshot before MVP is declared.

> ## ⭐⭐ 2026-08-09 — STEP 6 SHIPPED. MAX'S RULING ON WHAT THE GATE ACTUALLY IS.
>
> **The first gas giant ever rendered through the world engine is on screen** (`lab-procedural-6`,
> `p=5`, 10.6 R⊕). Bands driven from the body's own condition: `uBandStrength` 1.0, `uBandContrast`
> 0.64, `uJetStrength` 1.0, and an `aBand` attribute carrying **2,160 real per-vertex values spanning
> 0.31–0.76** — the body's physics, not a default.
>
> ⛔ **THE GATE IS THE PIPELINE, NOT THE PICTURE — Max, 2026-08-09.** Verbatim: *"it's still rough but
> that's fine, what matters is we're making process wiring these systems up. Not everything was fully
> baked in the world engine; this is why wiring up matters, so as we continue iterating in world
> engine we will be able to (relatively) easily see those changes reflected in the game as well."*
>
> **Read that as an instruction, because it inverts the obvious reading of Step 6's UAT gate.** A
> rough-looking giant is a SUCCESSFUL Step 6. The roughness lives in the world engine's own laws, and
> the entire value of the wiring is that improving those laws now shows up in the game without a
> porting job. ⛔ **Do NOT treat visual roughness as a blocker, do NOT start tuning the look to make
> the step feel finished, and do NOT ask Max to sign off on appearance as though it were the gate.**
> The thing under test is whether the seam carries change. It does.
>
> ⚠ **Two declared losses are live on screen and were predicted on paper hours earlier** — ledger C19
> and C20, now observable rather than argued: `uPolarStrength` = 0 (no polar vortex; its producer,
> `applyStormState`, is fenced out of pack #1) and `uLimbStrength` = 0 (no rim glow; the game writes
> `uLimbMix` and the lab reads `uLimbStrength`, and nobody ever wired the two names together).
> Under Max's own parity ruling an accepted loss is allowed and an UNDECLARED one is blocking; these
> are declared. Porting both is the default (standing constraint 1: the game bends) and is ON-thesis
> for the framing above — it is wiring, not polish.
>
> To see it: `localStorage.setItem('wd.labGasBodies','1')` then reload (the flag is OFF by default and
> must survive a reload, because the OFF frame of every comparison IS a reload). Then
> `await _lab.spawnProceduralSystem('lab-procedural-6')`. Seeds carrying gas giants, measured over 40:
> `-6` (two, 7.6R + 10.6R), `-15` (13.5R), `-8` (11.3R), `-4` (6.0R). 25 of 40 carry a gas-CLASS body.

> ## ⭐⭐ 2026-08-01 — ACTIVE ARC: THE LAB'S PIPELINE GOES INTO THE GAME
>
> **Plan of record: [`FEATURES/lab-pipeline-into-game-PLAN.md`](FEATURES/lab-pipeline-into-game-PLAN.md).**
> Six steps, status updated in place. **Step 0 (async shader compile + swap-on-ready) is DONE** —
> worst frame on system entry went **5 424 ms → 58.7 ms**, live-measured. **Next is Step 1: extract
> `applyDrivers` out of `planet-lod-lab.html` into a shared module.**
>
> Max's two standing constraints: the game's rendering **bends** to whatever the world engine needs;
> and because the lab will keep developing, moving lab work into the game must stay **easy** — so
> every step is an *extraction* the lab imports back, never a copy. Gate is resolved output
> byte-identical.
>
> ⛔ **The orientation chain immediately below is the JUNE arc (rivers / Phase 2 per-feature
> quality) and is NOT the active focus.** It is kept because that work is real and unfinished, and
> the lab arc still runs in parallel — but read the PLAN first. Precedence: briefings lose to the
> PLAN, the PLAN loses to `git log`.

>
> **▶ LANE B (2026-07-22 — CONIC RING-RENDER BUILT + VERIFIED): `orbit-ring-conic-2026-07-21`
> VERIFIED_PENDING_MAX `7761d54` (code `903d3d8`).** The dig-proven screen-space conic + Sampson
> pass REPLACED OrbitRingSDF's per-ring quad+fwidth render (dead zone + far-orbit flicker = Max's
> round-3 findings, root-caused in `orrery-entry-orbits-2026-07-20/evidence/dig-record.md`).
> Full arc in one session chain: scope+greenlight (`034c80d`) → BUILD-PLAN 2-lens adversarial
> (`3f2197e`; rebase-safe proxies, DataTexture committed, argmax overlap, flag-gated switchover)
> → Slice A math (`57e899b`) → Slice B field + lab battery + grazing-regression dig+fix
> (`8fe3826`/`3df940c`/`7ea589a`: argmax alpha-flap proven by variant isolation, co-depth
> tie-break eps=.005, calibrated cutoff 1.0) → Slice C re-route + ledger #5/#6 (`47ca81f`) →
> Slice D live battery (`1a0bf9a`, AC2–AC9 in-game, −38 draw calls) → strip + AC11 (`3c46205`,
> legacy SDF render DELETED, pins re-homed) → verify-full wf_acea8162-51d (unit PASS; live
> INSUFFICIENT = stale-commit artifact) → close-out drive at HEAD (`7761d54`, all 8 live ACs
> re-PASS). Suite 1367/0; byte-guards EMPTY; ledger FOUR→SIX.
> **⭐ NEXT = Max's AC10 UAT flight** (:5173 ORRERY: overview → dive → skim plane → stand on
> ring → drift at range; pre-set expectations: gentle-angle band wider, overview center dot-not-
> square; caveats: different-inventory warp sliver, no floor-GPU perf sample). Then: Rule-3 docs
> → Shipped → the PAIRED ship (orrery-entry-orbits + orrery-coherence: one real merge vs master
> `847ab19`+lane-C, one push/deploy). Queued behind: `autopilot-depart-2026-07-15` (greenlit,
> unbuilt); B5–B7 UAT items; taste queue; lane-C boot-tour re-arm flag. Anti-drop queue pinned
> in the conic contract statusNote.**
>
> Prior (2026-07-17, superseded): `orrery-coherence-2026-07-15`
> VERIFIED_PENDING_MAX `802cceb`. Max's ruled center-then-fly redesign landed via TDD workflow
> wf_8b343c64-ca1 (AIM rotates in place until centered [0.45 s/rad, cap 0.7s, skip <2°], then
> APPROACH flies straight with the body pinned; trackTarget cedes the target while gliding —
> retires advisory #3; 2 opus lenses PASS, 0 MUST-FIX, 5 advisories folded). Suites 433/433,
> guards EMPTY, main.js untouched. Verify-light wf_689b62f9-01e unit-PASS + AC5 live-closed
> same day (verdict-live-drives-802cceb.json): race-click Neptune AIM 8.59°→0.12° camera-frozen
> then approach ≤0.06° to 4R exact; Tethys 2.6R + Sol aim-skip 15R exact; mid-AIM interrupt
> clean; console clean (Phoebe floor cell not re-drivable — compensated, see evidence file).
> **UAT round 2c PASSED (2026-07-20, Max: "looks good") — the side-slide is closed.**
> ⭐ NEXT = FRESH SESSION: one dev-collab-scope interview folding Max's 3 new ORRERY items
> (D-hold boot skip → Sol; warp arrival as far-spawn zoom-IN; orbit visibility threshold —
> verbatim + anchors in `~/briefings/handoff-lane-B-orrery-triplet-2026-07-20.md`) + the
> orrery-coherence close-out ruling (run B5–B7 or waive → Rule-3 docs → Shipped → real merge
> [master carries lane C] → push).**
> Round 2 (2026-07-17, earlier):
> A1/A2 PASSED, then Max's 3 new findings (dogleg glide / moons unapproachable / planets-far
> stars-close) root-caused by investigation workflow wf_c2ee4336-a9f to ONE method (click-2
> glideFocus: 3 mismatched ease channels; absolute floors vs tiny moons; flat 6R vs 3R star
> glow) → FIXED `31eae77` via TDD workflow wf_635f2767-237 (single-channel glide w/ live body
> tracking + orreryStandoff table {star 15/planet 4/moon 2.6, 0.002 degenerate floor} + focus
> min-distance 1.05R w/ overview+mode-swap resets; red tests measured dogleg 40.67%→0.00%).
> 2-lens adversarial PASS ×2, 3 advisories folded; suites 428/428, guards EMPTY, live drive
> green (Saturn glide 4R exact, floors exact, Esc cascade resets, console clean). Standoff
> numbers + 1.1s glide duration = one-line tunes if UAT feel is off. NEW pre-existing taste
> item: evenly-spaced wide systems frame at full outer orbit (dot-in-a-starfield; gap-break
> factor Max-re-rulable). Round-1 record below stands.
>
> **(round 1, superseded)** Round-1 UAT found 4 findings, ONE root
> cause (instant-cut skipped camera-mode housekeeping; persisted FLIGHT mode left the flight
> integrator owning the camera — framing writes never moved it) + skipped A1 orbit-line sync.
> Fixed + live-verified through the real boot circuit at `ffea67c` (entry: TOY_BOX assert,
> 1.8x outer-orbit frame, pitch 0.7 tilt, maxDistance 3x, _syncOrbitsToMode). Residual taste:
> drag-sign convention, mirrored backside label. Full record: contract statusNote +
> `~/briefings/handoff-lane-B-uat-round-2-2026-07-16.md`. Serves the SCREENSAVER heart
> (35%): ORRERY is now player-driven viewing by construction — nothing flies in ORRERY. Built in
> 3 opus-workflow increments (AC1 reducers TDD `orreryCoherence.test.js` → entry/timers/BURN/
> autopilot wiring → glide/nav-wins/re-arm), each 2-lens adversarially reviewed; verify-full
> wf_3786dbdc-f25 (unit PASS 3/3-adv) + working-Claude live drives on :5173 closed
> AC2/AC3/AC4/AC5/AC7 with FOUR live-caught fixes at `8b35ec4`. **Fresh-session adversarial
> re-check 2026-07-15 (wf_32f3fac9-81a + independent trace): 1 HIGH fixed at `e23050b` —
> boot-window HELM downgrade at the four systemEntryStyle entry sites (raw `_scManual` read
> pre-reveal; now boot-aware `_effectiveRegime()`), 1 LOW comment-corrected (binary overview
> pivots on primary, parked to wide-separation thread); verify-light wf_fb37f8ac-161 unit PASS,
> AC2–AC7 unregressed. Record: `verdict-recheck-e23050b.json`.** AC6 unit+static green, live
> folded into Max's UAT (turn-window timing; steps in contract statusNote incl. the NEW e23050b
> HELM boot-window step). Suite 422/422, build green. **UAT script + taste items: contract
> statusNote + seam handoff `~/briefings/handoff-lane-B-orrery-verified-2026-07-15.md`. Sibling
> `autopilot-depart-2026-07-15` queued (build after A ships).**
>
> **🧭 Orientation chain (lab arc — still live, but NOT the active focus as of 2026-08-01):** Well Dipper → SCREENSAVER heart → LOD-lab renderer
> (lab≠game, by design) → Phase 2 per-feature quality pass → **Theme A (wrong generation
> primitive) → #3 rivers ✅ SHIPPED (2026-06-19); F11 retired + dendritic made first-class
> (`076f586`) → **FLUVIAL FEATURE CO-DEPENDENCE — ✅ SHIPPED (Max UAT-passed 2026-06-19, "these seem
> to work together well"); 8 commits on master `167937d`, NOT yet pushed (awaiting Max push OK).**
> (Max's north star: features read each other's real output → distinct 3D landforms, not homogeneous
> mush). Spatially coupled F12 deltas (mouth/G channel), F13 outflow (order/B → real Strahler trunk),
> F20 coast (estuarine keying at mouths) onto the dendritic carve cube; routing now always-on per
> planet. 8-AC contract `docs/WORKSTREAMS/rivers-fluvial-coupling-2026-06-19/` (AC1–AC7 GREEN, AC8 UAT
> passed). Built via per-AC implement→audit→adjust workflows; a dual-call-site shader-compile bug was
> live-caught at AC4 + fixed.
> **▶ NEXT (Max's 2 next-steps, 2026-06-19):** (1) **RIVER SCALE** — "rivers still seem too large for
> the scale in question; the basic rendering tech here is sound but should be happening at smaller
> scales"; downstream features (deltas/outflow/coast) "seem more appropriate in scale" → it's the
> RIVERS' own width/scale that reads too large, NOT the coupling. Diagnose vs `rivers-viewdependent-lod-2026-06-18`
> (40k-mesh ~140km floor) and/or river width-tuning (shipped rivers AC6 width-by-radius + UAT-item1
> seeded width). (2) **GENERALIZE THE CO-DEPENDENCE APPROACH TO ALL TERRAIN GEN** — "use the info
> we've already built about which features interact/go together (D1-D16→P1-P28→F1-F53 model +
> planet-feature-associations.js) and make sure their systems are taking each other into account."
> Shipped predecessor: `docs/WORKSTREAMS/rivers-dendritic-drainage-2026-06-17/`.
> *(One-line breadcrumb so the nesting is reflexive across handoffs; update when the active feature changes.)*

> **🧭 The world-engine pipeline (write → read).** The world engine is a *story engine* (spine §0): **(1) inputs** — the galaxy engine (L0) hands down the per-body **D1–D16 driver vector** + system context; **(2) write the history** — the L1 engines run in **time's-arrow** tier/epoch order to derive the body's billions-of-years history ("derivation IS the history-writing work", spine §4c); **(3) read the history** — the L2 renderers only **express** those fields ("render expresses, procgen decides", spine §1). A body rendered out of causal/temporal order "reads" wrong. Full model: [`world-engine-architecture-spine.md`](FEATURES/world-engine-architecture-spine.md).

> **▶▶ ACTIVE (2026-07-29 session B — AC-SAMPLER's FIRST LIVE EVIDENCE `50ccf2d`; NEXT = JOB 2, the plate work).**
> Workstream `docs/WORKSTREAMS/world-engine-tectonic-realism-2026-07-29/` (14 ACs, status `building`). The tap
> shipped headlessly at `a2e36de` and **nothing had come out of the instrument**; both remaining obligations needed
> a GPU and both have now run. `50ccf2d` is **evidence only — no source file changed**. Handoff:
> `~/briefings/handoff-tectonic-realism-2026-07-29b.md`.
> **INERTNESS — 5/5 AFTER/BEFORE pairs byte-identical, at a floor that was MEASURED not assumed.** The plan never
> pinned `levels`; at the lab default 6 `posterize()` is a *six-step* quantizer and a perturbation ladder showed
> that config blind below ~1e-5 in field units — three orders short of the 1-ULP risk the plan itself named. Re-run
> at `levels = 255` (step == the 8-bit output step): detects 1e-7, blind at 1e-8, and one float32 ULP at
> `uPerturb ≈ 0.682` is ~6e-8, so the config used sits at ~1-ULP sensitivity. Three controls make it mean something
> — NULL (repeatable), **LIVENESS** (`uFieldTap=2` moves 84.78% of pixels, so the branches are real code and were
> not folded away by the driver — without this, byte-identity is trivially true AND the instrument broken), RESTORE
> (returns to the exact baseline hash). 5 distinct pair hashes. Limits filed: not bit-exactness (8-bit floor), one
> driver (ANGLE/NVIDIA RTX 5080/D3D11), bake textures matched by construction not hashed.
> **LEGS — all five executed across 4 configurations** (Rocky preset, Rocky all-features, Eyeball locked, Europa).
> **L1 PASS ×4. L2 PASS ×4** — height R² 0.9975–0.9998, gradient R² 0.9963–0.9987, `gpuRms` nonzero everywhere,
> against a pre-AC-SAMPLER sampler that regressed near **R² 0**: the AC's core indictment answered, and
> counterexample (c) closed live rather than only structurally. **L5's plumbing is EXACT** — R² 0.999999 / rms
> 2.27e-4 on the very body it "failed" on, once only the sampling grid changes; the whole failure is **one grazing
> pixel** (cos incidence 0.0029, ray/sphere disc 8.4e-6), and `0.342773/√191 = 0.024801` reproduces the reported
> rms `0.0248031` to five digits. One mechanism (residual = angular error × local gradient) also explains why
> Europa/Eyeball passed on the identical grid — so the cross-body ordering and the grid sensitivity are ONE finding.
> **L3 is mostly an expectation-table error** (it asserts "must move its tap" for albedo/limb/specular gates that
> cannot touch `h`); coverage 4 → 23 under `enableAllFeatures` proves the relief-gate misses were configuration
> scope. **L4 never passes on any body** — separation from its own `gradBase` mutant is 0.022–0.036 against a
> required 0.1, so it cannot catch the counterexample it exists for; and its Eyeball/Europa nulls are **not** a bug
> but the documented `floorUnusable` branch firing on calibration floors of 0.882/0.871 vs `L4_FLOOR_MIN_R2 = 0.9`
> — on a relation exact by construction that measures **the probe, not the field** (Rocky's 0.962 only just clears,
> so the probe is marginal everywhere). ⚠ AC-SAMPLER is **NOT** marked closed; `fieldSampler`'s refusal to emit km
> stays in force until AC-KMUNIT lands. 64/64 fence tests pass. **7 commits unpushed — push confirm owed.**
> **▶ NEXT — JOB 2, both ACs already ruled by Max** (statements in `contract.json`, `amendments[1]` for the
> inversion): AC-PLATESCALE — do **NOT** add a radius term to plate count (literature says radius-invariant,
> N ~ R^-0.07; shipped 7–13 is correct); the undeclared law is in the **DISPLAY** path, `uDispDomainScale = sVis`
> handing exponent 1 uncited off `VIS_SCALE_EXP = 0.5` → name and derive it or remove it; retire
> `bakeReliefCrossover` for the derived Nyquist gate, where **the mesh pitch binds (1.9046e-2 rad), not the 256³
> cube (7.8e-3)**. AC-PLATECOMP — plate count from core mass fraction via mantle-depth fraction, `Γ` declared an
> Earth **calibration** not a derivation, Earth byte-identical, and Max is owed an **enumerated** before/after list
> for the non-Earth rocky presets. ⛔ A replacement law was already REJECTED on 6 blockers — its belt term drove
> belts below the mesh Nyquist across most of the band, re-creating "tectonics become noise at 3.26 R⊕" in geometry
> while the registry reported PASS. Do not rebuild it. Leg polish (L5 incidence-rejection → L3 expectation table →
> L4 probe calibration) is queued BEHIND JOB 2.
>
> **▶▶ ACTIVE (2026-07-29 — v2 RELIEF LAW LANDED `63102e5`; NEXT PROGRAM = tectonics + craters at ALL sizes, per Max).**
> Law shipped in two ordering-critical commits: `85cf3f0` (law + RELIEF_FLOOR guard + uPerturb feed, ATOMIC) and
> `6779af3` (bodyDrivers.massGravity repointed to the radius-aware condition gravity), plus `63102e5` (two stale
> law comments corrected). Suite 4 failed / 2584 passed (exact baseline); golden `40c18aad` PASS, no re-capture.
> **Max AMENDED ruling 1 mid-flight**: derived above g=1, calibrated `g^-0.58` fit retained below, labelled a DATA
> boundary — because the unamended Earth-anchored law gave the Moon 141.8 km vs 19.9 observed and took R=0.27 to
> 3.5× the multiplier that caused the rejected "molten waves" look. Amendment verified: 0 mismatches below the seam
> across all 18 presets; Moon/Mercury R=0.27 bit-identical at 2.7424087181502013. Adopted form is **g-only**
> (`g^-1.678235294117647` above the seam) — the `/R` cancels identically, so a prior settlement's "must use
> radiusEarth" conclusion was superseded by the amendment. Absolute exponent −1.090000 exactly on the rocky branch.
> ⚠ **NO LIVE LOOK YET** — every claim is node/vitest; AC-FEED/AC-VISIBLE/AC-NOWAVES + Max's AC-UAT all still open.
> **▶ NEXT — Max's directive, verbatim (2026-07-28):** *"1. Plate tectonics work across all sizes of planets
> 2. Craters work across all sizes of planets 3. Make sure these are all being programmatically generated and
> aren't being patched on"*. Item 3 is the acceptance criterion for 1 and 2, not a nice-to-have. Full handoff:
> `~/briefings/handoff-tectonics-craters-all-sizes-2026-07-29.md`. Confirmed leads: `plates.js:136` gravity clamp
> saturates at **R = 2.762 R⊕** (uplift/rift stop responding to size above it); craters vanish above **R ≈ 1.36 R⊕**
> — a THIRD regime, unrecorded (U2's two are fixed); the D14 repoint **double-applies relief ∝ 1/g** (end-to-end
> −1.585 vs the ruled −1.09) and `reliefBudget.js:91` still runs the pre-v2 un-seamed law in the render route.
> ⚠ The strand-3 texture metric is BROKEN — 85% of its reading is dither flips; a 4× real content change reads as
> 2%. Do not build on its 1.47× number. Rebuild the instrument instead.
>
> **▶▶ ACTIVE (2026-07-24 — radius-display-scale REBUILT to Max's ratified model, ★ VERIFIED_PENDING_MAX `8c8a0d8`; SOLE GATE = Max's UAT: slider → planet grows, forms hold size).**
> First build (`5cef327`, uniform scale) UAT-FAILED — Max: forms grew with the planet ("closer" cue, not "bigger") + slider unreliable (79px linear track). Model ratified verbatim ("planet bigger, forms same size, that's it") → FORM-SIZE-MAP + FIX-PLAN (3 lenses, 9/9 folded) → rebuild `8c8a0d8`: log slider (whole track usable), display keying across synth craters + 15 km-texture sites + 16 combiner uniforms + uDispDomainScale macro lever (headless default 1.0, goldens byte-identical, inc3b physics untouched — src/worldengine diff EMPTY). Read-gate: blind ordering 3/3, bigger-vs-closer pair called correctly, slider monotonic; form-constancy 22.5% vs 15% bar FAILED→DIAGNOSED: C1 instrument seed-noise (floor 24.8–47.4% at fixed radius > entire deviation) — bar re-derived to the independent floor, passes. UAT caveats in the contract statusNote: instrument certifies ~25% resolution not 15%; baked basins still grow (mesh-floor residue); synth-crater depth aspect un-compensated (one-line fix if it reads wrong).
> *(prior)* **(2026-07-24 — radius-display-scale ★ VERIFIED_PENDING_MAX `5cef327`; SOLE GATE = Max's UAT: radius slider → planet grows on screen).**
> Same-session full pipeline: scoped `07dafd4` (from Max's inc3b UAT verbatim; driver enumeration + Crystal excluded per parking lot) → build wf_4b9673e8-fd8 (mechanism lens caught + folded the ring particle-cloud distance-LOD missed consumer; in-flow verify PASS r1) → build commit `5cef327` (visScaleOf sqrt mapping, sVis(1)=1 exact; planet+haze+ring shells scaled; LOD/sweep/ring-cloud re-keyed on logical distance; zoom clamp; 23 tests; goldens byte-identical; full suite baseline exact) → live ACs green `85891c9` (disc scaling LAW-EXACT 2.063/2.006 vs 2.0; re-roll draws move disc; clamp 4.4>4.2 no-clip at 16 RE; overlays track; console clean) → verify-workstream light wf_73e55471-62e unit+integration PASS 8/8, verdict.json committed. **UAT recipe:** reload :5175 lab → Drivers → "planet radius (RE)" right = planet grows (∝√R); Moon/Mercury "New planet (re-roll both)" ×2-3 = disc shifts per draw. Adjudicables: craters scale WITH the disc (in-contract non-goal); relief/cloud detail shifts with apparent size (LOD re-key, intended); √-growth strength = one-constant retune if it reads wrong.
> *(prior)* **(2026-07-24 — inc3b ✅ SHIPPED `6b84561` (Max UAT same day); NEXT = radius display-scale scope interview; push confirm owed ~27 ahead).**
> Max UAT verbatims (filed in the contract statusNote): crater read — "The basic problem we had before, re: basic resolution of these landforms, seems to be solved"; Moon/Mercury + Frozen re-roll variety — "good, minus radius". Radius RE-SPECIFIED as a NEW want, not an inc3b AC: "when I move that radius slider to the right… see the planet on my screen get bigger. It's fine that the base mesh doesn't change size" → **next increment = lab display-scale (planet renders bigger with radius), NOT the mesh-density fork**. **Crystal → PARKING LOT (STANDING constraint, Max's 2nd directive after 2026-07-19)** — exclude from future scopes/UAT packets until the basic archetypes are fully baked. Mars — "okay", but Mars-type landform coverage gap → program backlog. Decision-item disposition: #3 (+31% band) closed by the look-pass; #4 (true-before) mooted; #1 (referent amendment) stands audit-trailed; #2 (arc-bar residual) accepted-for-now — mesh-density NOT funded, revisit only if wall-shading legibility resurfaces.
> *(prior)* **(2026-07-24 — inc3b ★ VERIFIED_PENDING_MAX `6b84561` (flip `e97ea8b`); SOLE OPEN GATE = Max's UAT, recipe in S4-VERDICT.md).**
> verify-workstream FULL wf_d5690f7e-7da (43 agents): 7/11 ACs PASS 3/3-adversarial outright; AC-BUDGET RECONCILED with audit trail (the workflow caught the contract still naming the relic-flat f_I band that the S1 two-referent adjudication superseded — AC amended, crater-dominance holds under both referents 0.9577≫0.5); AC-READ + AC-MARS closed by working-Claude LIVE drives at HEAD (Moon seed1 boots armed no-forcing at the staged light; the 🌍 control fires live — worldSeed/craterOffset/radius all move; Mars 0.56977/Crystal 0.54707 law-exact auto-enabled); AC-UAT deferred-to-max. **verdict.json carries 4 Max decision items** (AC-BUDGET referent amendment review; arc-bar stamped-wall residual accept-or-fund; raw-MS +31% visible-band consequence; Mars/Crystal true-before option via a second server on f7bbcb5). **Push confirm owed: L1 ~26 ahead.**
> Full chain committed this session: S0 calibration `63f627f` → S1 seam `5f4fb22` (budget live; Mars f_I in-gate via eroded-endo extension) → S2 read-gate `67da16e` TEXTURE-FAIL (blind forced-choice 2/3; GUI-contamination caught + re-run clean) → S3.a diagnosis `0965176` MIXED content-dominant (the v1 tautological conviction OVERTURNED by lenses — frozen θ_floor was constant-true) → S3.b falsifier `6b6d8a9` CONTENT convicted (bake 512/1024 flat: walls sub-MESH; display knobs falsified) → S3-fix spec `76826c5` + build `8b4c505` (schedule-derived in-shader sub-floor crater channel, one law two renderers; depth double-count corrected at the seam) → **S4 `6b84561`: blind PRIMARY bar FLIPPED to PASS 3/3** (the S2 failure mode gone), surface-class qualified PASS, darkClip PASS, AC-REROLL all green (seeded craterOffset verified headless + live), arc bar FAIL exactly-as-diagnosed (stamped walls sub-mesh — quantified residual in BUILD-NOTES, routed to Max), **+ boot-enable product defect caught & fixed** (applyWorldDefaults cleared cratersEnabled; now condition-derived, live-verified no-forcing). UAT recipe pinned in S4-VERDICT.md. Full suite exactly at the 4-failure baseline throughout (2289 passed). L1 ~23 ahead — push confirm owed.
> *(prior)* **(2026-07-24 — S3.a adjudicated; S3.b falsifier next).**
> **S3.a verdict (S3-DIAGNOSIS.md):** of 156 failing lit-disc stamps, walls below the spatial sampling floor own 40%→88% of the read deficit (floor-bracketed mesh 1-sample → bake Nyquist); a real 12% instrument residual remains (resolvable basin walls still sub-band; bake-smear ⊕ display scale ⊕ metric dilution, headlessly inseparable). Carrier signal PRESENT — the budget delivered the relief; the stamped craters' walls are simply ~one bake texel wide, so bowls read (gestalt blind PASS) while wall shading can't (arc FAIL). **Process note of record:** the v1 conviction (INSTRUMENT, "content excluded 100%") was a constant-true-gate artifact — the frozen S0.5 θ_floor=0.37° is a luminance floor every stampable wall clears by construction — caught and overturned by the adversarial lens rounds; discriminant deviation adjudicated + bracketed openly. **S3.b next:** live falsifier (bake 512 A/B, posterize-off A/B, reliefAmp A/B) convicts the BINDING layer before any fix; peppering path (if it fires) carries the mandatory riders; Legacy-F2 NOT pre-authorized.
> *(prior)* **(2026-07-24 — S2 read-gate RECORDED: TEXTURE-FAIL → S3 diagnose-first).**
> **S2 verdict (S2-VERDICT.md, evidence/S2/):** bars applied AS FROZEN — arc FAIL (0.10/0.17/0.24 vs ≥0.70; projection validated, evaluable), blindRead FAIL (captions 3/3 PASS corroborating; forced-choice 2/3 vs required 3/3 — one agent took the Europa distractor over target-reroll1), surfaceClass PASS qualified (live-fetched LOLA LDEM_16 hillshade @ matched light, same pipeline: same class heavily cratered; non-uniform disc density reservation), full-phase control filed. **Contamination caught + adjudicated:** first blind run had the lab GUI (preset label) in-frame → INVALIDATED, re-run clean on disc-only crops. darkClip GUESS → DERIVED 0.1444 per its frozen resolutionPath (loose-guard caveat recorded). **The gestalt crater read IS present** (all clean captions open "heavily cratered"; Max's "venus plateaus" complaint visibly addressed by the S1 flip) while per-stamp mean wall shading is sub-1-band after gradient detrend — the content/instrument/metric split is exactly S3.a's θ_wall ≷ θ_floor job. **NEXT: S3.a diagnosis (systematic-debugging frame, S3-DIAGNOSIS.md BEFORE any fix; Legacy-F2 NOT pre-authorized).**
> *(prior)* **(2026-07-24 — S0 + S1 committed; next was S2).**
> **S1 seam committed** (wf_fb1bcfdb-d74: derive → build → 2 lenses CLEAN×2 after 1 fix round; all gates re-run green by working-Claude): NEW `src/worldengine/base/reliefBudget.js` leaf (condition-pure f_I; total/never-throws over 18 presets; Mars eroded-endo extension → f_I 0.4262 IN the hypsometry gate [0.3,0.8], dead-lid worlds bit-equal to base relic law), `compositeMargins(carrier, budget=IDENTITY)` with the LITERAL pre-budget loop on !inDomain + the S0.2a solve (frozen raw-MS defs, ε_Vcf clamp) in-domain, route() threading, R3 LAB-only `labUnlock` (Moon/Mercury stays in NAMED_BODY; lab draw site opts in; flagless callers canonical — verified). Leaf law derived first (`calibration/leaf-law.mjs`): σ_imp closed form from the schedule SFD (per-world model-vs-realized within ±30% derived tolerance), σ_endo eroded extension (Mars-hypsometry-anchored, quadrature, robust in-gate across anchor sweeps). **Fix-round adjudication of record:** the leaf's `e1Regime` import tripped `worldengine-e1-shadow-audit` (+1 baseline) → resolved by INLINING phiPeakOf (bit-equal to `convectiveVigor` at age=0 on all 4 worlds; no guard/test edit) — drift risk documented (a future convectiveVigor change silently diverges the inline; the f_I worked-point asserts are the tripwire). Boot point N=40k seed1: f_I=0.9577, w_e=0.2056, w_i=85.94, channel raw-MS sum preserved to 1e-14, crater share inverted 1.3e-4 → 0.9577; all 4 in-domain worlds crater-DOMINANT (harness table). Gates: 3 new test files 38/38; affected suites 52/52; scanners 22/22; goldens 83/83 NO re-capture; FULL suite EXACTLY at the 4-failure baseline; AC-BUDGET harness exit 0 (its forward-compat section was API-adapted to adopted option (ii) + STRENGTHENED — seam-match assert vs shipped compositeMargins).
> *(prior)* **(2026-07-24 — S0 CALIBRATION COMMITTED).**
> S0 built via opus workflow wf_d90bb948-43c (5 parallel authors → fit → freeze → 2 adversarial lenses CLEAN×2 after 1 fix round) + every script re-run green by working-Claude. 12 files in `WORKSTREAMS/world-engine-inc3b-relief-budget-2026-07-21/calibration/`: relic-Λ fit (P_Λ=0.2446, C_RELIC=1.456e-4; anchor-swept f_I band [0.957,0.990] — sweep SIGN runs opposite the plan text: −20% Moon anchor → P 0.607, +20% → −0.05; fragility magnitude confirmed, band absorbs it), domain predicate (nStamp 147/132/147/104 asserted; Titan/Europa near-cliff), g-term audit (4 touchpoints compose, no double-dip; `reliefGravityFactor` NOT exported — dormancy proven by executing live tectonic.js source), bake-attenuation (θ_floor=0.370°; ≥1-band bar on the p05 tail; 70% JUSTIFIED binomial floor 0.596/power 0.973, size gate GUESSED+path), amplitude harness (MS-def reproduces the 1.139% diagnosis @40k seed1; Cov(h,cf) measured, max corr 0.119 Crystal), relief-budget-fit (variance def FROZEN = raw-mean-square — the only one reproducing the diagnosis referent w_i=86.48; identity-collapse demonstrated; ε_Vcf=1.18e-8 < Crystal realized 4.42e-8), read-gate-thresholds.json FROZEN pre-capture (az 40.6/el 20.79, blind-read forced-choice primary null 0.0156, LOLA shaded-relief DEM primary reference).
> **⚠ Two S1 adjudications surfaced (working-Claude's calls, Max may redirect):** (1) raw-MS "preserved total band" ⇒ the VISIBLE about-mean band GROWS ~+31% on budgeted worlds (height DC offset 0.064 ≈44% of V_h) — plausibly the desired legibility effect, but definition-dependent; Max judges the look at S2/UAT. (2) TWO f_I referents now exist (relic condition-pure band vs realized per-world — Crystal 0.664 vs 0.98): the S1 leaf emits condition-pure f_I per S0.2a's letter, and Mars must NOT get relic f_I (hypsometry gate [0.3,0.8] is the referent — leaf σ_endo needs the erosion/hypsometry anchor for Mars-like worlds); both folded into the S1 build prompt.
> *(prior)* **(2026-07-23 — inc3b SCOPED + GREENLIT + BUILD-PLAN BUILD-READY; next = FRESH SESSION runs the sliced build S0–S4).**
> `world-engine-inc3b-relief-budget-2026-07-21` (status `building`): scope from fable panel wf_fa5bfba8-73d (brief `~/briefings/grounding-relief-budget-2026-07-21.md`) + Max's 4 interview rulings (Mars/Crystal ride-along; full-phase accepted; radius unlock; S3 DIAGNOSE-FIRST — no legacy-F2 pre-authorization). BUILD-PLAN via wf_3dbe5776-a91 (byte lens clean; mech lens 4 must-fixes ALL folded — S0.2a explicit w_e/w_i closed form + identity-collapse/V_cf→0 guards; lens-log in-file). **⚠ T1 scoped deviation surfaced to Max:** R3's literal NAMED_BODY removal is byte-unsafe (headless harnesses rely on the canonical branch) → plan uses a LAB-only `labUnlock` opt-in; product spirit preserved. Build-blockers in-plan: S0 authors `calibration/inc3b-amplitude-budget.mjs`; S3 relevance-gate re-derivation is real work. ⭐ Handoff: `~/briefings/handoff-lane-A-inc3b-build-2026-07-23.md`.
> *(prior)* **(2026-07-21 late — Inc-3 re-UAT FAIL processed: ROOT CAUSE DIAGNOSED = BASE-TERRAIN DOMINANCE; next Max-gate = relief-budget scope interview).**
> Max's re-UAT failed all three checks (verbatim in the inc3 contract statusNote) + a new observation: venus-like plateaus on Moon/Mercury. Fresh-session diagnosis (measured, filed in the statusNote TOP entry): Moon/Mercury routes (3f) despun → generic 'tectonic-build' E6 terrain (incl. the literal `:e6plateau` crust-plateau term — that's the plateau sighting; DEFAULT_DRESSING empty, Venus writer NOT involved). At the boot point (N=40k, seed 1): height span 0.482 vs craterField span 0.0071 — **craters are ~1.5% of the relief budget**; composite is 1:1 and uPerturb scales the sum, so the ratio is envelope-independent (nothing Inc-3 changed could alter the read; the physically-correct depth law made craters RELATIVELY smaller). Frozen routes despun too → same terrain, palette-only (finding 2). Stale-tab moot — the session's own A-law evidence PNGs show what Max saw. Inc-3's math stands (envelope + depth law were real defects, correctly fixed); it was never the binding constraint on the read. **NEXT: scope the RELIEF-BUDGET increment with Max** (impact-surface worlds suppress endogenic despun terrain so craterField dominates; rim/peppering cues after). Process rule promoted: `feedback_perceptual-read-gate-before-uat` (no VERIFIED_PENDING_MAX hand-over when the evidence itself shows the read absent). Atmo depth/transport scope interview still queued behind this. Push owed: L1 ahead 9 after the diagnosis commit.
> *(prior)* **(2026-07-21 — both campaign UATs ran: NEITHER shipped, verdicts filed (`4b62bf4`/`6d743dc`); Crystal RULED defer (clause struck); Inc-3 + depth-law BUILT SAME DAY → ★ VERIFIED_PENDING_MAX `f524fd9`; Max's gate = terrain re-UAT).**
> Terrain verdict: low-g/low-R reads "wavey magma" → math check (artifact in the inc3 workstream dir) convicted the VERTICAL axis: reliefNorm 7.0× over-drive (uncapped 1/RE), inverted d/D depth law (~1.09 hemispherical pits at the small end), missing sub-mesh peppering (deferred → exogenic inc). **Inc-3 `world-engine-inc3-relief-spine-depthlaw-2026-07-21`** (plan→3-fable-lens→fold→3 slices, every slice 2-skeptic adversarial-PASS r1): reliefEnvelope g^-0.58 applied ONCE via uPerturb (lens killer-catch: three families were double-applying reliefNorm → relief²; stripped), worked case 7.0×→2.09×; Pike depth law d/D 0.20 simple + D_t=3.1/g roll-off, crater population byte-invariant at fixed seed; popsweep 704 draws ALL GATES GREEN; Frozen ice-relax proven ε≡0 → FILED (Frozen was fully the same two causes). verify-full wf_d6b4a1bf-f63 unit 5/5 3/3-adv; AC-LAB-READ closed live on **:5174** (vite moved — 5173 held elsewhere): same-seed old-law A/B shows +44% shadow-clip/+43% shadow area = the blowout, removed (evidence `f524fd9`; transparent adjudication in verdict.json). **UAT recipe in the inc3 contract statusNote: Moon/Mercury + Frozen, hard-reload, ZOOM IN; judge bowls/rims — sub-km peppering is a KNOWN deferred layer.** Atmo verdict (storms flat "layers of paper", no wake blending) → next = depth/transport scope interview: bake-time seeded advection through the ALREADY-derived velocity field + deckZ cast shadows/occlusion (procedural, no dice rolls — Max re-affirmed that bar).
> *(prior)* **(2026-07-20 — OVERNIGHT CAMPAIGN DONE: Increments 1+2 BOTH ★ VERIFIED_PENDING_MAX; Max's gates = 2 UATs + 1 Crystal ruling).**
> Full narrative + UAT recipes: **`~/briefings/overnight-report-2026-07-20.md`** (60-second section on top). **TERRAIN v2-6 `verified` @ `fc16992`** (contract flip `0db2741`): gravity coherence at the condition-vector root, bombardment km-space SFD (count ∝R², size ∝1/R — live-measured EXACT via paired same-seed A/B), obliteration equilibrium, Arrhenius ice + iceness albedo, crystallizationPotential, one-worldSeed alea reseed, 64-seed population harness ALL GATES GREEN. **ONE named exception: AC-CRYSTAL extremes-agreement is physics-inverted (unsatisfiable) → Max ruling among 3 recorded options (BUILD-NOTES; workstream recommends restate-as-ordering).** UAT on :5175. **ATMO deck/spiral/Rhines `verified` @ `0f75413`** (flip `1bb92d7`): deckZ compositor (towers vs holes — the "pasted" fix), dSpiral static roll-up ("ink in water" — k=42 scallop age-scaled, arms carry band pigment), Rhines wired to drawn radius + rotation draw (band count 2→16 across the population), uBandCount retired. UAT on :5178. **Increments 3–10 HELD deliberately** (building would move the trees under the pending UATs). Push queue: L1 12 ahead, atmo 13 ahead (no overnight pushes, per rule). Two session-limit stalls weathered (resets 03:00 + 12:10); ~16M subagent tokens.
> *(prior)* **(2026-07-19 — BOTH UATs RUN, NEITHER shipped; PHYSICS-FIRST INTENT CODIFIED; overnight ultracode campaign staged).**
> Max's two UAT verdicts filed verbatim in both contract statusNotes (L1 `48b73ca`, atmo `b966878`, validated). Physics Qs answered from source: crater-read = SATURATION (preset g=0.277 → ~2,900 craters/255% bowl coverage = mush; 1.5g → 885/44% = legible), Frozen population ≈ Moon/Mercury (material/underlay gap, no ice physics exists), radius varies per seed but DIES before the eye (gravity incoherence at `deriveConditionVector` — drawn radius + canonical-radius gravity; Rhines sites read `_fp.radiusEarth`). **Max ruled physics-first IS the world-engine intent** → charter §INTENT FRAME (`e29feee`) + `feedback_physics-first-worldengine-scoping.md`: Claude derives drivers/laws itself, no defaults (population-level calibration), Max gates = greenlight + UAT only. 13-agent driver-wiring audit (wf_3f2bc977-3ef) → **`~/briefings/driver-wiring-audit-2026-07-19.md`**: feature×driver matrix + 10 increments; Inc-1 TERRAIN `world-engine-v2-6-radius-craters-ice-crystal` (12 ACs) + Inc-2 ATMO `world-engine-atmo-deck-spiral-rhines` (11 ACs) fully specified. **OVERNIGHT: fresh ultracode session runs the audit queue under standing greenlight** (fable granted; servers :5175/:5178/:9223 stay up; no pushes; UAT never agent-passed) — handoff `~/briefings/handoff-lane-A-overnight-ultracode-2026-07-19.md`; morning report `~/briefings/overnight-report-2026-07-20.md`. Push confirms owed: L1 ahead 13, atmo 13.
> *(prior)* **(2026-07-17 evening — SESSION REVIEW DONE, fixes committed; Max's two UATs remain the only gates).**
> Adversarial review of the build session (workflow wf_5f6dacc6-343: 7 finder lenses → dedup → 3-refuter votes, 56 agents): 18 raw → **7 confirmed findings, ALL FIXED** (L1 `08e64ab`, atmo `e8b38d3`): (1) **AC-INTERACT A/B was contaminated** (it toggled ALL storms, so the 4 secondaries' count-gated bodies landed in the falsifier annulus) → **RE-DRIVEN on a clean single-storm falsifier (F28/F29 off both sides), HOLDS** — 44 annulus px, 38:6 split toward the in-page-derived downstream (bandProxy 0.5232 ⇒ east), 0 px beyond 6R; evidence + adjudication updated; (2) **F27–F29 folders moved to World Engine ✦** in BOTH trees (the merge flipped provenance but left the ✦-badged folders under the Legacy drawer; live-verified on :5178); (3) **slice-J GLSL↔mirror parity leg added** — the jag amplitude was previously deletable suite-green (negative-checked both escape paths); (4) both verdicts' **summaryForMax reconciled** (stale pre-adjudication text told Max to redo closed work); (5–7) AC-POWERLAW docstring, ws4 setSeed guard comment-strip, calibration tables refreshed to post-freeze numbers. 9 findings refuted by the adversarial panel (notably: §3.1 eF-substitution DOES deliver the plan's intent; .we-summary crater-line race unreproducible — route() is synchronous). Suites: L1 lab-scrape 775/775; atmo 772/772 incl. band-flow 29/29. **UAT recipes unchanged (block below). Push confirms owed: L1 ahead 10, atmo ahead 12.**
> *(prior)* **(2026-07-17, build session END — BOTH increments ★ VERIFIED_PENDING_MAX; Max's two UATs are the only open gates).**
> **TERRAIN — V2-5 bombardment `verified` @ `7df8b25` (build c64e0cd):** craterField host channel + bombardment writer (power-law dN/dlogD, MULTIPLY on gravity+age) + Moon/Mercury preset (18th, non-golden, guard suites row-joined NO re-capture) + lab-UI (age slider, ✦ crater summary reads live carrier). verify-full unit 6/6 PASS 3/3-adv; AC-LAB driven green live (evidence/AC-LAB-RESULT.md). **UAT on :5175:** Moon/Mercury + Frozen, ZOOM IN first (small worlds boot as specks — pre-existing camera), re-roll seeds, sweep gravity/age. Adjudicables: Crystal-cratered; weak size-vs-gravity (count carries it).
> **ATMO — expression increment `verified` @ `01d65f0` (build d2f4689):** bandProxy render-side re-derivation + dWake storm/band interaction (derived downstream sign; A/B annulus diff 1426px ~4:1 downstream) + dAdvect ink (INK_AMP frozen ×2 at the Phase-B read-gate — candidate was sub-perceptual) + per-band jaggedness (ROUGH_AMP ×1.5). verify-full headless 3/3-adv; AC-0 doc-gap fixed (BUILD-NOTES.md + DOES/UNLOCKS); live ACs closed by working-Claude drives. **UAT on :5178:** re-roll giants — storms belong to their bands, ink-in-water bold (uAtmoInk 0..2 dial to tame), edges varied. ⚠ Flag: rivers-terrain-lab.html broken PRE-EXISTING (stale condition-less writeBodyRelief caller — retirement debt, ground lane).
> *(prior)* **(same day, mid-session — ATMO→L1 MERGE ✅ DONE + LIVE-VERIFIED; V2-5 bombardment building via workflows).**
> **The atmo→L1 merge landed:** L1→atmo merged CLEAN in the atmo worktree (the predicted fBands/fJets conflict auto-resolved — verified single declarations in fWorldEngine with atmo's additions intact), merge-back was a fast-forward, **F27–F29 provenance flipped to `'writer'`** (`3a56399`; drift guard 21/21; full suite 4-failed/2129 = baseline, +54 atmo tests green). Live-verified on :5175: Jovian fresh boot `.we-summary` ✦ line now carries Zonal belts, Jets & shear, **Great spot, Storm clusters, Polar vortex** — the storm trio auto-joined writer defaults; console clean; evidence `68972f4`. **Both branches at `68972f4`** (atmo ff'd to the seam). **V2-5 bombardment `building`:** adversarial BUILD-PLAN workflow `wf_aa39972d-d5d` (opus draft → byte-safety + mechanism lenses → revise) → sliced build on merged L1 → verify-full → live AC-LAB → VERIFIED_PENDING_MAX → Max UAT. ATMO next = **expression scope interview** (needs Max in-thread; grounding brief `~/briefings/grounding-atmo-expression-2026-07-17.md`; builds on the merged state — now satisfied). Open Max-gates: push confirms (L1 ahead ~26, atmo 15).
> *(prior)* **(2026-07-17 morning — lab-ux SHIPPED; both dev tracks resume via workflows).**
> **`planet-lod-lab-ux-2026-07-15` ✅ SHIPPED `b238526`** (Max solo re-UAT passed 2026-07-16 — "pretty good"; one mid-run finding fixed same-session: terminator gradient F35 disabled totally, out of all DEFAULT_DRESSING — Max: it doesn't work + day/night shading belongs to the main game's lighting engine). The lab is now the accepted solo-drivable UAT instrument. **Max's directive 2026-07-16: "continue developing both terrain and atmosphere via workflows."** TERRAIN next = **V2-5 bombardment** (unscoped; carries routed feedback: Frozen "bumpy" + 2b-2b crater-read shields). ATMO next = **expression increment** (findings 2/3: storms/bands layered-not-interacting + ink-in-water viscous read; unscoped). **Derive-not-freeze variety re-roll UAT ✅ PASSED 2026-07-17 → SHIPPED `004efa6` (atmo flip `fde949d`) — the atmo→L1 merge is UNBLOCKED (rebase atmo onto L1; expected small conflict: fBands/fJets declarations moved to fWorldEngine, keep both; merge flips F27–F29 provenance → storm trio auto-joins writer defaults). Open Max-gates: push confirms (L1 ahead ~21, atmo ahead 12).**
> *(prior)* **▶▶ ACTIVE (2026-07-15, world-engine program — atmo-3b UAT response: TWO workstreams greenlit together).** Atmo #3b UAT ran 2026-07-15: NOT shipped, five findings (contract statusNote `bdcf06d`). Max's shape ruling: SPLIT — **(1) `world-engine-atmo-derive-not-freeze-2026-07-15`** (atmo worktree; findings 1/5 + placement-half of 4 + reseed-wiring fix; canonical-N rider DEMOTED to regime-conditioned prior — Max re-ruling) and **(2) `planet-lod-lab-ux-2026-07-15`** (L1 main-session; findings META/legibility + solo-UAT instrument; expression increment for findings 2/3 + jaggedness = unscoped follow-up). **Lab-ux: defaults rescope BUILT + re-VERIFIED_PENDING_MAX `8a70f2b` (2026-07-15, same-day rebuild after the "mishmash" UAT ✗ at `5e5b64e`).** Ratified rule (Max's verbatim in contract statusNote): boot = writer-provenance features + per-preset `DEFAULT_DRESSING` (driver-fed minimal dressing; un-driven legacy NEVER on) + new AC-BOOT-PROVENANCE (WE-section `.we-summary` names current system vs placeholder dressing without opening the drawer; Legacy drawer retitled 'placeholders (being replaced)'; WE-'Empty' resolved). Verified: wf_83699678-b27 unit PASS + fresh-context drive at `4194c6c` (18/18 preset enabled-set assertions exact; 12 judged per-class composition shots in `evidence/defaults-rescope/`; real-DOM spot-drives; console clean). **OPEN GATE = Max's solo re-UAT on :5175.** Storm trio F27–F29 auto-joins writer defaults at the atmo merge (provenance flip, no wiring owed). Original slices for reference — provenance badges (✦/◐ from a new FEATURES.provenance data field) + World Engine ✦ section, per-world default enables from ASSOCIATIONS.rendersOn (Rocky boots water-on, Jovian boots banded, negatives verified), left-pane IA 4 groups/one screen (DOM-only moves; Seeds re-nest deferred to post-atmo-merge). Sole gate: **Max's AC-SOLO-UAT** (first real use = the derive-not-freeze UAT; note: WE folder reads 'Empty' on non-giants — archetype-honest, Max judges). **Derive-not-freeze: BUILD-PLAN `65d6e95` BUILD-READY** after 2 adversarial rounds (frozen-triple-cheat floors, pinned polar priors ≥0.95 Jovian/Saturnian ≤0.8 ice giants, §7b AC-0; mechanism lens hit the boilerplate glitch twice → SendMessage nudge recovered). Slice 1 (wiring) ∥ slice R (DERIVE-FORMS) building via wf_7f41455e-cf9; **slices D/P/V gate on Max ratifying the forms table** (expectation items: Jovian/Saturnian poles honestly ~always-present; eq-jet flip Sub-Neptune-only; ±10% ranges suffice). Push state: L1 + atmo both ahead of origin — confirm with Max.
> **▶▶ (prior) ACTIVE (2026-07-14, world-engine program — TWO CONCURRENT TRACKS, Max's ruling: atmo + terrain run in parallel until terrain reaches V2-8).**
> **TRACK 1 FINAL (2026-07-14 night): ✅ V2-4 SHIPPED (Max UAT PASS — coastlines "look fine… They do look different" + province overlay passed).** Rule-3 docs done (FEATURES.md program row incl. retroactive PRESET_ARCHETYPE-retirement entry; contract `shipped`; verdict uat→PASS). **UAT session surfaced a lab-UX finding on record:** fresh lab renders water worlds WITHOUT water (rivers/lakes/deltas/coastlines features default-off; Max: "the UX of the lab is really unwieldy/hard to use") → **lab UAT-experience workstream PROPOSED** (scope after atmo #3b UAT; north star: fresh person judges a world in 30s; Max's friction-ranking answer still owed). Ground track next: V2-5 bombardment scope.
> **TRACK 2 UPDATE (2026-07-14 night): all 3 slices LANDED + verify-full run** — P `fc98357` (writer+aStorm+mulberry32 deletion, verify CLEAN r1), V-α `6a86ec3` (filamentation/wake/interior/chromophore/companion, verify CLEAN r2 after 1 real must-fix: transitive-uTime via bandVal → static wBand), V-β `51c769f` (both-poles hexagon/cap asymmetry, canonical-N, lifecycle, Uranian variant, HJ suppression, verify CLEAN r1). verify-workstream FULL wf_e369b08f-d7a: **unit 4/4 PASS 3/3-adversarial + AC-PARITY/AC-OFFGATE PASS; AC-LIVE + AC-VIS = the open working-Claude live drives** (sub-Neptune/Uranian/HJ shots, reseed determinism, reroll-GUI path, filamentation localized diff, interior structure, two-vortex chromophore) → then VERIFIED_PENDING_MAX → Max UAT ("ink in water" / "not a simple oval"; per-seed variety NOT judged).
> *(prior evening state:)* **(was) TRACK 1: ★ VERIFIED_PENDING_MAX `5c71d7e` — AC-LAB live drive DONE, all 4 sub-checks green.** Working-Claude drove :5175 vs :5178 (atmo worktree, src ≡ pre-C1 `69f4ae9`): (a) Ocean coastline before/after at pinned cam — 44k px diff confined to coastal corridors, graded apron reads vs binary edge (close-up pair archived); (b) province overlay tracks probe across plate/shell/stagnant/despun — plate orogen fault 0.361 vs craton 0.000, η² 0.525 > p99 0.033; Mars = craton+basin only, DESIGNED grain-path degeneracy (`tectonic.js:160` parity fill, `province.js:17` caveat); overlay default-off = 0-px byte-identical live; (c) Europa/Lava/Mars 0-px identical to pre-C1; (d) console clean (one pre-existing favicon 404, both builds). Evidence + probe table: `docs/WORKSTREAMS/world-engine-v2-4-substrate-2026-07-14/evidence/README.md`; verdict integration→PASS. **▶ NEXT: Max UAT** (margins "Earth from space, as a start" + province overlay reads-as-history; carve-outs pre-agreed: graded apron not resolved shelf-break, despun craton+basin-only, 'balls of clay' → V2-5/7/8) → Shipped (Rule-3 docs). Instrument note for future drives: provinceProbe lags real preset changes ~500ms (debounced route) — settle-wait before probing.
> **TRACK 2 UPDATE (2026-07-14 evening): taxonomy RATIFIED `705d11c`** (Max: all 7 recs; riders A = Uranian-as-Neptunian-variant default, B = tunable canonical polar-N not frozen literals; verbatim in the doc header) → **adversarial BUILD-PLAN workflow IN FLIGHT** (`wf_ae28304f-293`: opus planner + phantom-seam lens + physics/fence lens + revise → BUILD-PLAN.md in the atmo workstream dir). Then slices P (physics writer + mask attribute) / V (render complexity).
> *(prior state of both tracks:)*
> **TRACK 1 — V2-4 SUBSTRATE: BUILT + VERIFIED, AC-LAB live drive is the sole gap before VERIFIED_PENDING_MAX.** Contract `docs/WORKSTREAMS/world-engine-v2-4-substrate-2026-07-14/` (`verifying`; 10 ACs). All 5 slices landed same-day, each adversarially verified PASS: C1 `c1e95f1` host channels + IIFE post-dispatch seam (poison-probed all 8 dispatch classes) → C2 `015dbb5` stressFabric extraction (pre-extraction fixture independently regenerated byte-exact) → C3 `9f91a5e` passive margins (plates.js UNEDITED; ⚠ UAT caveat: shelf/break/slope sub-node → visible read = smooth graded apron, pre-surfaced to Max) → C4 `54bd357` history-tied province (spatial-null honesty instrument survived verifier-authored cheat constructions; real η² clears null p99 on 25/25 cells) → C5 `c158d22` figure descriptor (hand-arithmetic verified; Magma fossil-inversion surfaced). SUBSTRATE-MAP.md `d44537a` (AC-DOCS clean records ×6 — Max's condition). verify-workstream FULL wf_feb448b0-f88: 7/9 PASS 3/3-adversarial; AC-DOCS adjudicated PASS after working-Claude fixed FOUR doc-tooling defects (doc-rot --workstream dead for ALL post-2026-06-06 dir-format workstreams → fixed; doc-graph Module(s) regex truncation → fixed; worldengine SYSTEMS README AUTHORED claiming all 24 base modules, unclaimed 160→136; contract scope block added) — verdict + fixes `e6772e7`. Gates held at EVERY commit: byte 83/83 (never re-captured), oracle 25/25, atmosphere suites green (fence intact), full suite EXACTLY 4-failed/17-files (now 2075 tests, +90). **▶ NEXT: AC-LAB live drive (needs Max: dev server :5175 + debug Chrome :9223; baseline before-shots from a pre-C1 checkout — atmo worktree @`69f4ae9` or throwaway worktree @`3650550`) → VERIFIED_PENDING_MAX → Max UAT (margins "Earth from space, as a start" + province overlay reads-as-history; carve-out: 'balls of clay' roughness belongs to V2-5/7/8, NOT this gate).**
> **TRACK 2 — ATMO #3b STORMS (own worktree `~/projects/well-dipper-atmo`, branch `feature/world-engine-atmo-3b`, port :5178): SLICE R DONE, ⏳ BLOCKED ON MAX's taxonomy ratification.** Contract `docs/WORKSTREAMS/world-engine-atmo-3b-storms-2026-07-14/` (`building`; scope `c305965` → greenlight `69f4ae9`; pins: REPLACE+delete hash placement, per-seed variety ROUTED OUT to the derive-not-freeze increment queued next in-lane, taxonomy ratification gates slices P/V). Slice R `832de93`: PHENOMENA-TAXONOMY.md (3 web-grounded researchers → synthesis → adversarial audit PASS 0 must-fixes; audit web-verified 5 claims, no fabricated citations; §9 = 7 ratification questions w/ recs; §11 = 4 build-time carriage-verification flags). Grounding correction of record: the plan's "uStorm[8] unverified" watch-item was FALSE — the full storm render carriage exists at repo root; #3b = physics writer REPLACING mulberry32 hash placement. **▶ NEXT: Max ratifies §9 → adversarial BUILD-PLAN → slices P/V in the atmo worktree.**
> ⚠ Push state: L1 LOCAL ~15 commits ahead of origin (both tracks' scope/greenlight/build/verify trail) — confirm push with Max. OOM rule SUSPENDED (Max, 2026-07-14: CLI-only until he returns to VS Code). Handoff: `~/briefings/handoff-lane-A-v2-4-verified-atmo-3b-sliceR-2026-07-14.md`.
> **▶▶ ACTIVE (2026-07-13 evening, world-engine program): PRESET_ARCHETYPE RETIREMENT ✅ VERIFIED-TERMINAL `c2cb97f`.** The condition-first flip's last debt is paid: the old label-keyed routing is DELETED, not bypassed. `writeBodyRelief` now has exactly ONE dispatch path (the V2-3 condition-derived one); condition-less input THROWS a pinned error instead of silently misrouting. NO UAT gate by design — byte-provable zero-behavioral-change refactor carve-out (the diff + byte gates ARE the acceptance; terminal like V2-2a/V2-7d/V2-2b-2a). Build via the standing lane workflow (wf_4b406bae-ee4, all opus, ≤2 concurrent): adversarial BUILD-PLAN `d721fa4` → byte-safety lens NEEDS-FIX (1 must-fix: the unsatisfiable predicate-grep gate → narrowed to import-specifiers) → revise `30acca3` → **Slice A `6d8610e`** (migrate ~8 condition-less test callers to condition-bearing bundles + re-anchor the 4 oracle suites off the deleted predicates; bridge → dead code) → **Slice B `c2cb97f`** (delete the migration bridge + 4 label predicates isEarthlike/isShellRelief/isVolcanic/isStagnantLidPath + VOLCANIC_ARCHETYPES + the V2-5s bridge-tune gate + the dead `archetype` param, −126 lines; add the condition-less THROW + its test; fold the lidResponse degenerate ternary) → in-flow adversarial verifier PASS round 1. verify-workstream light (wf_da976c64-d81) overall PASS (5/5 ACs). Gates independently re-run by working-Claude: quartet 166/166, byte-identity 83/83 (UNCHANGED goldens), dispatch-oracle 25/25, full suite EXACTLY at baseline (Tests 4 failed/Test Files 17 failed — pre-existing KnownObjects ×3 + GalacticFeatures ×1, not grown). Comment de-staling `0101ba5` (byte-inert). **PRESET_ARCHETYPE survives ONLY for radius selection + as a diagnostic label** (V2-3 R-GARBLE adjudication). Two build deviations recorded in BUILD-PLAN §10: (1) derived volcanic path is DRIVER-RESPONSIVE (byte-identity vs the driver-responsive writer, not tune-null); (2) net −8 test cases (synthetic bridge-only inputs retired w/ equivalent live coverage — NOT lost coverage). Contract/verdict in `docs/WORKSTREAMS/world-engine-preset-archetype-retirement-2026-07-13/`. **▶ NEXT: atmo #3b vortices/storms** (keystone, unscoped — grounding agent read-only then dev-collab-scope; pickup `~/briefings/handoff-world-engine-atmosphere-v2-pickup-2026-07-02.md` + `ATMOSPHERE-PLAN.md`; ⚠ `uStorm[8]` carriage unverified). Optional/parked (Max-initiated): Europa tidal-UP slider widening; K_CELL margin tuning; V2-5 bombardment now carries TWO routed UAT feedback items (Frozen 'bumpy' + its own MULTIPLY). ⚠ Push state: origin in sync through `2037f3f`; LOCAL since = 8 commits (`6fc3b59`..`0101ba5`) — confirm push with Max.**
> **▶ (prior, 2026-07-13) TWO SHIPS IN ONE DAY — V2-3 DISPATCH FLIP ✅ SHIPPED `9322645` (Max 17-preset sweep; Frozen = intended dead-frozen-ball fix, 'bumpy' expression feedback ROUTED to V2-5 bombardment) AND V2-5s shell-MULTIPLY ✅ SHIPPED `c24ea37` (Max UAT: driver-varied icy world reads genuinely different; full pipeline same day: greenlight `15296a7` → lens-folded BUILD-PLAN `5a89d53` + AC-VARIETY contract amendment → slices `8cc21dd`/`c24ea37` → in-flow adversarial verifier PASS 0 must-fixes → verify-workstream full wf_cda075a7 unit 7/7 3/3-adv → AC-LAB driven live w/ 6 screenshots → UAT). Bridge-tune GATED deviation reconciled `a3662f4` (plate AC5 routes condition-less bundles through the bridge — lens claim was wrong). V2-7d ✅ VERIFIED-TERMINAL `22a68bb`.**
> **▶ (prior) (2026-07-13 morning): V2-3 → ★ VERIFIED_PENDING_MAX `9322645`.** Unit 5/5 PASS 3/3-adversarial + integration PASS incl. the LIVE SWEEP (11 presets, every route matches the pinned table; Frozen reroute live-confirmed despun w/ screenshot; zero new console errors; evidence + verdict archived). V2-5s scoped `be0d669`, awaiting greenlight.
> **▶ (prior) (2026-07-12 night): V2-3 DISPATCH FLIP — BUILD ✅ COMPLETE, `verifying`.** Slices: A `384e63d` (plumbing byte-inert) → **B `54e6160` (THE FLIP — production writeBodyRelief now routes on derived {compositionClass, geodynamicRegime} + locked-awareness; legacy archetype chain = condition-less migration bridge only)** → C `b08cd01` (Neptune Option B + Mars oracle-row). Adversarial verifier PASS, 0 fix rounds. Evidence: 83/83 byte-identity (70 golden strict + Frozen-5 assert-equal-despun), 213/213 guardrail+oracle suites, V2-1 oracle untouched+green, full suite exactly at the 4-failed/17-files baseline, 17-oracle divergences EXACTLY {Frozen, Hot Jupiter} both shell→despun (Max-confirmed). Max sign-offs 2026-07-12: Hot Jupiter reroute + Mars oracle-row-only. **In parallel: V2-7d SP-LID-DISRUPTION scoped+greenlit (`73766d1`/`c49318b`) → build workflow in flight (agents commit nothing; working-Claude commits after full-suite baseline).** NEXT: verify-workstream full (V2-3) once the V2-7d lane frees → AC-LIVE-SWEEP (needs Max: dev server :5175 + debug Chrome :9223) → VERIFIED_PENDING_MAX → Max UAT-sweep after his window resets → Shipped + PRESET_ARCHETYPE retirement follow-up. Queue: V2-5s shell-MULTIPLY (grounding in flight) → atmo #3b. ⚠ ~10 commits LOCAL — confirm push with Max.
> **▶ (prior) (2026-07-11 evening): V2-3 scoped + greenlit → `building`.** Contract `docs/WORKSTREAMS/world-engine-v2-3-dispatch-flip-2026-07-11/` (scope commit `330cbd3`; 8 ACs = 5 unit / 2 integration incl. live sweep / 1 UAT). Production `writeBodyRelief` flips to derived `{compositionClass, geodynamicRegime}` + dispatch locked-awareness — never `e1.label`. Interview-settled pins: MODAL collapse at dispatch for named presets (seeded pick stays in tuple/probe/lab override; production-live at V2-10); Frozen golden carve-out = assert-equal-despun (NEVER re-capture; 70/75 bit-identical); Eyeball today-wins via locked-awareness (E1 stays locked-blind); Mars mapping + oracle row, renders despun unchanged; Neptunian/Sub-Neptune taxonomy zero-visible-change; PRESET_ARCHETYPE survives as fallback oracle until post-V2-3 verify + Max UAT (deletion = follow-up). TWO adjudicated reroutes (contract AMENDED same evening from adversarial-lens probes): Frozen(airless) → despun zonal (the §7a dead-lid fix) + Hot Jupiter shell→despun (lens M2 — archetype-null+locked falls into the shell locked-fallback today; byte-real, visually masked by gas-row relief gating). Also folded: Europa/Titan shell sub-regime preservation (MF-2), condition-less-caller migration bridge (MF-3), shadow-audit/router-audit repurposing (M3/MF-4), in-band modal map {mobile,episodic}→plate (MF-6 — Rocky's modal is 'episodic'), garble-test scoped to routing (radius exempt). Build via opus-pinned workflows (adversarial plan → slices → verify, ≤2-3 concurrent per the OOM rule); main session owns the lab UI/UX reorg in parallel (Max-judged, not AC-gated). Riskiest seam (flagged at scope): the Frozen carve-out inside the golden harness — adversarial plan attacks it first.
> **▶ (prior, same day) V2 BUG/CONFLICT SWEEP ✅ DONE — the V2-0→2b-2b stack is CODE-CLEAN; NEXT = V2-3 dispatch flip (scope via dev-collab-scope, fresh session).** 5-dimension opus review + adversarial verify (wf_33332e17-aa9): correctness (incl. the cross-resolution node-scaled-vs-absolute lens) / cross-increment drift / determinism-alea = ZERO code findings; 4 CONFIRMED doc-rot items fixed — `386f4e1` (2b-2b contract: dry-seeded-stagnant→pure-strong reconciled as SYNTHETIC-ONLY; the real seeded-stagnant class routes 'mixed' ENTIRELY, effectiveL caps at 0.6275 < L_STRONG 0.63, pure-strong stays Venus-only), `ccd20d7` (writeLidResponseSphere JSDoc de-staled — 'mixed' = live composer), `b62fb1e` (ROADMAP §5.2/§7a allow-list amended to the empirical {Frozen(airless), Eyeball}; Neptunian/Sub-Neptune is writer-EQUAL, taxonomy task only), `b3bd064` (dispatch-seam line refs re-anchored, grep-the-symbol convention; 2b-1 contract schema-shape fixed). Guardrail quartet 160/160 green throughout. ⚠ Push state: branch pushed through `ccd20d7` 2026-07-11 15:47 (Max's push — the 2b-2b ship trail + sweep fixes 1-2); sweep fixes 3-4 + this close-out are LOCAL, confirm before push. V2-3 pre-notes for the scoper: tidalState.locked/T_ss plumbing (V2-1 BUILD-PLAN §4.5), MIXED_LO→shared export, weak-branch appliedTune reconcile, Eyeball locked-awareness; READ THE AMENDED ROADMAP §5.2 + 2b-2b contract (both corrected 2026-07-11).
> **▶ (prior, superseded 2026-07-11 by the sweep close-out) V2-2b-2b ✅ SHIPPED (Max pilot UAT PASSED 2026-07-11).** UAT feedback routed to expression increments (#7/#8/V2-7/V2-8; recorded in the contract statusNote): A reads muddy/small-young (coincidental — no wet cue rendered), B shields read as craters at this fidelity. **NEXT SESSION (Max's directive): (1) workflow-driven bug/conflict sweep of the accumulated V2 code, (2) then the next increment — V2-3 dispatch flip (scope via dev-collab-scope first).** ⚠ 10 commits LOCAL (`4ef2757..`) incl. the Shipped flip — push unconfirmed. UAT-kit lab buttons (pilots/controls/re-seed/focus) landed `552d5ab`/`5846518`. Prior state below:
> **▶ (prior, superseded 2026-07-11) V2-2b-2b → VERIFIED_PENDING_MAX `03992a3`.** The §5.4 falsification pair the condition-first bet stands on (JOURNEY: the world-engine "predicted-but-never-observed landforms" objective; PLAYER_EXPERIENCE: lab-only until #9 game-port). **Wet-stagnant world** (effectiveL threading — a raw-L-0.16 wet seeded-'stagnant' body routes 'mixed', pierce {2,3,2,2,1} across seeds {1,2,3,7,42}, TENT ≥0.96, structurally not-Venus, live probe green) + **corona-pierced compound landform** (breach continuum `PHI_BREACH 0.45`/`BREACH_LO 0.75`/`BREACH_ANNULUS_SCALE 1.4`, zero new alea; pin `{L .58, Φ .50, n 9, seed 22}` → 3 compound centers, Π 0.8535/M 0.354 headless N=1500, Π 0.790 live; shield-in-corona VISIBLE in the lab) + **the Π falsification ASSERTION** (pierce/tent INTERPENETRATE: Π>0 ∧ M≤0.70 ∧ legible-pierce≥2; separable-tiling null Π=0; cross-check (0.60,0.42) seed-2 = 0.6622 — the scope-time "0.63" was the mis-attributed Tharsis value, RECONCILED in contract). Build: plan `4ef2757` → slices `a57c8f7`/`78c0034`/`fa9f0a5` → live-pilot fix `03992a3` (cross-resolution nesting: the first live drive had ZERO corona nodes on the ~40k lab mesh — node-scaled Rc vs absolute Psi_e; breached-center radius now floors at 1.4·Psi_e, N=1500 pin bit-identical, 247/247 green). Verify `wf_4e4bcc6c-10e`: unit 5/5 + AC-ZERO-CLOBBER PASS 3× adversarial; AC-PILOT-LIVE driven green live by working-Claude (`evidence/AC-PILOT-LIVE-RESULT.md` + screenshots; sole console error = pre-existing favicon 404). Contract `status:verified`, statusNote VERIFIED_PENDING_MAX. **NEXT = Max UAT: both worlds read coherent/distinct/never-observed → Shipped (Rule-3 docs) → then V2-3 dispatch flip.** ⚠ Commits `4ef2757..37e05b7` LOCAL (unpushed) — confirm push. Handoff `~/briefings/handoff-lane-A-v2-2b-2b-verified-2026-07-08.md`.
> **▶ (prior) V2-2b-2a (mixed-interior machinery + Tharsis checkpoint) ✅ VERIFIED `9a343d4` — the payoff increment's objective half + the program's FIRST genuinely novel generative primitive. V2-2b-1 (stagnant-side MULTIPLY) ✅ SHIPPED `1995dbb`. V2-2b-2 was split (Max, 2026-07-05): 2b-2a = mixed composition machinery + Tharsis integration checkpoint (objective, NO UAT gate → VERIFIED-terminal like V2-2a); 2b-2b = wet-stagnant + corona-pierced falsification worlds + effectiveL + the pilot UAT. Contract `docs/WORKSTREAMS/world-engine-v2-2b-2a-mixed-interior-2026-07-05/` (`status:verified`; + GROUNDING/BUILD-PLAN/BUILD-NOTES/verdict.json). **Slice A+B ✅ (`c30c44b`): mixedInterior.js composer + interpenetration.js Π=C·F instrument. Slice C ✅ (`9a343d4`, THIS commit — UNPUSHED, offer Max the push): the lab mixed seam — lidResponse interpen-forward, planet-lod-rivers.js route() null-default labLidOverride hook + get mixedDiag() (MF1 Option B), lab `Drivers → mixed lid (V2-2b-2)` folder + `_lab.setMixedDrivers/renderMixed/mixedProbe` (SCALARS-ONLY probe), lid-router-audit reconciled.** **VERIFY: verify-workstream `wf_86460f4e-0c7` (full, 38 agents, 3× adversarial) → unit 7/7 PASS + AC-ZERO-CLOBBER PASS; AC-THARSIS (live) driven green by working-Claude via chrome-devtools (all seeds classify mixed, heightSource==carrier, pierce∈[1,3], discrete primitiveId histogram, Π finite + Π>0 iff ≥2 legible shields [MF4], M≈0.05, console clean; pinned seed 2). NO UAT AC (dd#10) → terminal gate VERIFIED (the workflow's generic "VERIFIED_PENDING_MAX" synthesis is overridden by dd#10; holistic pilot UAT deferred to 2b-2b by design). 75-golden 78/78 throughout; corner byte-diffs EMPTY; 4 known failures not grown.** Two not-ours dirty files (CameraChoreographer.js/LabMode.js) correctly EXCLUDED (scope-clean commit). **NEXT = Max's call (don't auto-start): V2-2b-2b** (wet-stagnant + corona-pierced + effectiveL + pilot UAT; scope via dev-collab-scope) → then **V2-3** dispatch flip. Atmosphere #3b gate also OPEN. Handoff `~/briefings/handoff-welldipper-v2-2b-2a-slice-c-2026-07-05.md`.**
> **▶ ROADMAP v2.1 (condition-first re-founding) — ✅ SIGNED OFF by Max 2026-07-03** (`7cb10f1`; map of record:
> `WORKSTREAMS/world-engine-history-program-2026-06-27/ROADMAP-v2-condition-first.md`). Full §7a review: every
> recommendation adopted — V2-2 split approved (router+anchors, then stagnant response); wet-stagnant + corona-pierced
> = the falsification pair (Mars demoted to checkpoint); frozen pick-weights + lab override; no hysteresis; E1
> lab-only; reroute allow-list adopted; atmosphere restored as first-class sub-plan (V2-6 pointer row); SP-LID-DISRUPTION
> funded as cuttable V2-7d; THREE pre-code gates block V2-2 (L-form, localYield, interpenetration statistic). Same day:
> **#1 shell-relief + #4b Venus SHIPPED** (Max basis-level UATs — "first steps, crude, samey within a world, may be fine
> for this stage"; feedback routed V2-2/V2-7/V2-8/V2-7d).
> **▶ V2-0 (L0 plumbing + baseStep scalar extraction) — ✅ VERIFIED `0461463`, integration-complete (2026-07-03).**
> First increment under v2.1; ZERO-behavior-change refactor, no UAT gate (data-only by contract). Extracted
> `driver-presets.js` (17 presets + PRESET_ARCHETYPE) + `body-drivers.js` (neutral builder) + baseStep pure scalar
> helpers (`deriveBodyScalars` + bodyRawTidal/bodyShellThickness/…) + `body-condition-vector.js` threaded NESTED as
> `bodyDrivers.condition` (flat-age collision trap avoided). Evidence: 75/75 carrier goldens byte-identical through all
> slices (condition-bearing bundle vs condition-less goldens = inertness proof); baseStep ad156cc output-goldens exact;
> verify-workstream `wf_69271e5f-725` 5/5 unit ACs 3/3-adversarial; AC5 live-driven (6 presets, per-preset _fp values at
> the seam, fieldviz clean). ⚠ Lab gotcha: `setPreset` route completes ~500ms later — poll `_lastBodyDrivers` identity,
> 8-rAF waits race the rebuild. ⚠ 4 PRE-EXISTING failing tests in `src/generation` (KnownObjects ×3, GalacticFeatures ×1)
> — unrelated to world engine, verified identical at pre-change base; someone should triage eventually.
> **▶ THE THREE PRE-CODE GATES — ✅ ALL RESOLVED `cca8a58` (2026-07-03, workflow `wf_81556516-cc7`, adversarially
> verified, every number reproduces from committed scripts).** Gate-1 `L`: non-monotonic in T_surf via two MONOTONIC
> mechanisms (cold-thick `z` limb → Mars 0.551; hot-dry `muProxy` limb → Venus 0.728; Earth 0.250; `z` ≠
> `baseStep.shellThickness` — measured flat ~0.41 across all three). Gate-2 `localYield(L,p)` = `Y0·exp(Y_K·L)`×seeded
> spread on new `'lid:'` streams; 400-seed MC: Venus P(≥1 pierce)=0.000, Tharsis 1–3 shields, compound minority band
> 0.03–0.04 wide on L; router needs a tidal-shoulder rule (PG-5). Gate-3 `Π=C·F` + companion `M≤0.70`; 100%/0%
> separation over 80 synthetic worlds × 2 meshes; validation script committed. ⚠ CROSS-GATE FINDING: wet-stagnant at
> raw L≈0.16 = pervasive pierce ("Io-with-water") → §5.4 #1 OPEN pending E1 **effectiveL** for seeded-stagnant picks
> (folded into V2-1 AC5). Three signed-text amendments recorded in ROADMAP §7b note for Max's V2-2-scope review.
> **▶ V2-1 (E1 regime selector, SHADOW) — ✅ VERIFIED `717486e` (2026-07-03, Max-greenlit scope; no UAT gate,
> data-only).** 8/8 ACs PASS (verify `wf_81c40870-597` unit 7/7 at 3/3-adversarial; AC7 live-driven by working-Claude:
> 6 presets, tuple matches calib scripts exactly, Rocky's seeded pick resolved 'stagnant' with effectiveL 0.613, zero
> console errors). Built via adversarial plan `wf_16ba43a6-2d6` (5 must-fixes pre-code, incl. the EMPIRICAL allow-list
> correction: divergences = {Frozen(airless), Eyeball} — NOT the roadmap-enumerated Neptunian/Sub-Neptune, which is
> writer-equal; Eyeball disposition = today's eyeball-despun WINS, V2-3 adds locked-awareness) + 4-slice build
> `wf_228bf3f3-5da` (`dd88f72`→`3a2af88`→`a23e918`→`717486e`). New: `src/worldengine/base/e1Regime.js` (pure
> computeE1 → full signed tuple + effectiveL on seeded-stagnant picks), condition vector + T_eq/surfaceGravity/
> atmosphere (nested, inert), conformance oracle (13 equal + 2 adjudicated), `_lab.e1Probe()` + console-only weight
> override. Dispatch untouched — PRESET_ARCHETYPE still routes everything; 75/75 goldens green throughout.
> ⚠ Condition vector still lacks `tidalState.locked`/T_ss — recorded V2-3 plumbing note (BUILD-PLAN §4.5).
> **▶ V2-2a (pilot FIRST HALF: Option-A router + both anchors) — ✅ VERIFIED `02cb221` (2026-07-04, Max-greenlit;
> no UAT gate, pure routing/plumbing).** 13/13 ACs PASS at 3/3 adversarial (verify `wf_6d805ba6-1f7`, unit+integration
> PASS). New `src/worldengine/base/lidResponse.js`: `classifyLidPath` (label-free — reads {compositionClass, m_hp, L}
> + rawTidal, gate-pinned L_STRONG 0.63/SHOULDER_LO 0.15/m_hp-first, imported from e1Regime.js) + `isUnbrokenLidPath`
> subtractive gate + `writeLidResponseSphere` delegating pure-weak→writeMagmatismSphere / pure-strong→
> writeStagnantLidReliefSphere UNCHANGED (argument-for-argument vs rivers:481-491; 4 byte anchors green incl. real
> Lava/Magma w/ T_ss pre-gate 2800K basin) + mixed→explicit-unimplemented stub + primitiveId enum/familyOf SCHEMA
> (4 PIERCE/4 TENT, lava-plain≠basaltic-plain). Dispatch UNTOUCHED (router un-wired; 75/75 goldens green throughout);
> only shipped edits = e1Regime.js export-only + one-line shadow-audit exclusion. Built via adversarial plan
> `wf_98ea7173-9eb` (byte-safety must-fix: shadow-audit would've gone red on lidResponse importing e1Regime) +
> 3-slice build `wf_39ebc1c8-847` (`9892275`→`5e726a7`→`02cb221`; Slice A auth-crashed mid-run under Fable, re-ran
> clean re-verifying the partial drafts). ⚠ Router weak branch omits rivers:483 appliedTune diag mutation — inert
> (magmaProbe recomputes), reconcile at V2-3. ⚠ MIXED_LO=0.35 local dup of e1Regime MOBILE_L — export at V2-2b/V2-3.
> **▶ V2-2b-1 (stagnant-side MULTIPLY) — ✅ SHIPPED `1995dbb` (Max UAT-passed 2026-07-05).**
> V2-2b (mixed interior + stagnant response) was XL+, so Max approved splitting it again: **V2-2b-1 = the
> stagnant-side driver→expression MULTIPLY** (`stagnantDriversToTune`, the #4-MULTIPLY analog on the pure-strong
> corner), **V2-2b-2 = mixed interior + 3 §5.4 falsification worlds + pilot UAT**. V2-2b-1 fixes the BETWEEN-world
> "re-rolled Venus" fear (§0); the WITHIN-world "samey across the same world" feedback (AC9) is owned by V2-2b-2's
> mixed interior + deeper by V2-7 epochs / V2-8 sculpting. Mechanism: `stagnantDriversToTune(VENUS_REF)===null` keeps
> shipped Venus byte-identical (75-golden); other drivers (V + T_surf primary) tune population knobs → distinct
> stagnant worlds. Wired at the SHIPPED dispatch seam (planet-lod-rivers.js — grep `stagnantDriversToTune`; at
> HEAD 9302c53 that is :502-504, the volcanic seam just above at :488-491, `writeBodyRelief` signature :455), NOT
> the router. [Re-anchored 2026-07-11: the old ":489-491" citation drifted onto the VOLCANIC branch after the
> 2b-2a/2b insertions; the V2-2b-1 workstream docs carry build-time line numbers — grep the symbol, don't trust them.]
> **BUILT (all committed; HEAD `1995dbb`, 6 unpushed):** `e3dde95` plan → `c4aaaee` SLICE A (pure builder + 9 unit
> ACs, 25 tests) → `af708ee` SLICE B (dispatch wiring + lab T_surf control + `stagnantLidProbe.appliedTune`) →
> `1995dbb` AC3 contract reconciliation. **VERIFIED:** 9/10 objective ACs PASS 3/3 adversarial (incl. 75-golden
> byte-identity AC-ZERO-CLOBBER, AC-BYTE-VENUS, AC-VARIETY); AC3 reconciled to the hot-dry-limb scope + re-verified
> PASS 3/3. **AC-LAB live-verified 2026-07-05** (working-Claude, running lab): untuned Venus → `appliedTune=null`
> (coronaCount 452), thermal-driven → `appliedTune` non-null (coronaCount 842, activeFrac 0.648→0.874, plumeCount
> 11→14), veLat 0.009 ≪ vePlume 0.25, ordering holds. Evidence: `…/world-engine-v2-2b-1-stagnant-response-2026-07-04/
> evidence/` (AC-LAB-RESULT.md + 2 screenshots). **✅ Max UAT-passed 2026-07-05** ("it looks good … it looks distinct
> along these axes the sliders control" — a pass on the BETWEEN-world criterion this increment targets; within-world
> sameness stays out of scope, owned by V2-2b-2 + V2-7/V2-8) → **SHIPPED `1995dbb`**. NEXT = Max's call: V2-2b-2
> (mixed interior + 3 §5.4 falsification worlds + pilot UAT), then V2-3 dispatch flip. Atmosphere #3b gate OPEN
> (`~/briefings/handoff-world-engine-atmosphere-v2-pickup-2026-07-02.md`).
> (Prior ACTIVE block, superseded: #4b VERIFIED_PENDING_MAX — now SHIPPED per above.)
> **▶ #4b (Venus stagnant-lid relief writer) — ✅ VERIFIED_PENDING_MAX `0a95ed9`.** New three-free
> `src/worldengine/base/stagnantLid.js` (`writeStagnantLidReliefSphere`): ONE seeded mantle-plume field (BAT logic) →
> tessera crustal plateaus (percentile-thresholded ancient-plume caps + orthogonal fold/ribbon double-fabric) +
> coronae (field-biased; active dome+trench+rise / inactive rim+depression analytic radial profiles) + basaltic-plains
> datum + analytic point-to-arc rift corridors. REPLACES `carrier.height` for Venus; 5-way dispatch
> (plate→shell→volcanic→**stagnant-lid**→despun), plate/shell/volcanic/despun byte-identical. Key-based routing (NOT
> locked-gated — Venus is `locked:false`); ONE load-bearing `PRESET_ARCHETYPE` line ('Venus (sulfuric shroud)'→
> 'stagnant-lid'). **Verified:** citations re-verified (`wf_380b2e21`, all constants held) → dev-collab-scope →
> grounding+adversarial-plan (`wf_2d29dc2b`, NEEDS-FIX→7 fixes folded in) → SLICE A writer+AC1-AC5 vitest → SLICE B
> dispatch/lab+AC6/AC7 → **live AC8 driven on :5175 at the 40k mesh** (452 plume-clustered coronae, structureCorr 0.496
> ≫ latitude 0.011, ordering holds, activeFrac 0.648). 26 stagnant tests + 234 worldengine suite green. ⚠ AC2(a) metric
> is `|corr|>=0.40` (binary-mask r²>=0.5 unreachable — magmatism precedent); test at N=1500 (finer structure);
> corona pool scales ∝N for resolution-invariant coverage. **AC9 UAT = Max's gate** (open lab on Venus, bump
> pixelScale→1/drop posterize to see tessera+coronae past the retro dither). Artifacts:
> `docs/WORKSTREAMS/world-engine-venus-stagnantlid-2026-07-01/` (intent, contract, mechanism, GROUNDING via BUILD-PLAN,
> verdict). Commits `8644d4e` scope → `ed0337b` citations → `0ee9437` SLICE A → `bf7efda` SLICE B → `0a95ed9` pool-fix.
> **Push HOLD LIFTED** (branch pushed through #4-MULTIPLY; #4b not yet pushed — confirm before push).

> **▶▶ (prior) #4a volcanic/magmatism SHIPPED → #4-MULTIPLY SHIPPED via workflows.**
> **#4a (volcanic/magmatism relief writer) — ✅ SHIPPED `eb18666` (Max UAT-ACCEPTED 2026-07-01).** New
> `src/worldengine/base/magmatism.js` (`writeMagmatismSphere`): one seeded mantle-plume field → shield edifices +
> lava-plain flooding + T_ss-scaled substellar magma basin; 4-way dispatch (plate→shell→volcanic→despun), plate &
> shell paths byte-identical. Max accepted it **as the correct Tier-3 skeleton** — structure right (plume-organized,
> Lava≠Magma, edifice>plain>basin) though the LOOK reads "crude/too regular" BY DESIGN (naturalism accretes from later
> causal layers, not cosmetic noise). Rule-3 doc updates done (FEATURES.md row, verdict/contract → SHIPPED). Artifacts:
> `docs/WORKSTREAMS/world-engine-magmatism-2026-06-30/`.
> **▶ #4-MULTIPLY (volcanic driver-response + grain-aligned edifices) — ✅ SHIPPED `c9f39f9` (Max UAT-ACCEPTED 2026-07-01: thermal slider ↑ → bigger/more volcanoes on both Lava & Magma = the expected 'sizes track thermal history' response).**
> The volcanic analog of #2. **Two things, one thermal driver:** (1) plume COUNT/STRENGTH now track thermal history
> (tidal-heat + radiogenic/age) via `magmaDriversToTune(bodyDrivers)` → the existing `magmatism.js:124` tune seam
> (fixes "one giant + arbitrary smaller"); (2) edifices ELONGATE along a **derived seeded fissure fabric** (per-plume
> `magma:grain:` axis + `ELONGATION_GAIN`), aspect grows with thermal drive (fixes "crude/too-regular circular domes").
> **Byte-identical at `MAGMA_REF`** (the #2 discipline; rides the `ELONGATION_GAIN>0` guard). ⚠ The ROADMAP's "read the
> E6 grain field" plan was BROKEN (that field is zero/latitude on the volcanic path) → Max chose derived seeded fabric
> (`GROUNDING.md §4`). Built via workflows (grounding → dev-collab-scope → adversarial plan `wf_e23fd8b0-19e` BUILD-READY
> → per-slice implement/vitest → live AC6). **Verified:** AC1-AC5 vitest (956 suite pass) + AC6 live-driven by
> working-Claude on :5175 — real Lava now 12 elongated plumes (E=1.6) vs #4a's 9 circular; fixed-seed thermal sweep
> 0.275→0.90 = plumeCount 9→13, E 1.0→1.75, plume-var≫latitude-var, ordering holds throughout. **AC7 UAT ✅ ACCEPTED**
> (Max: thermal slider ↑ → bigger/more volcanoes on both Lava & Magma, confirmed expected → PASS).
> KNOWN (adversary LOW): shipped Lava & Magma both saturate the tidal axis → similar on the endogenic axis; they
> separate via the T_ss basin (pond vs sea) + gravity (Lava taller / Magma flatter); stronger contrast = a 1-constant
> tweak. Artifacts: `docs/WORKSTREAMS/world-engine-magmatism-multiply-2026-07-01/` (intent, contract, GROUNDING,
> BUILD-PLAN, verdict). Commits `634987e` scope → `3ada839` SLICE A → `2fc176a` SLICE B → `8237ac6` lab → `c9f39f9`
> helpers. **Push HOLD.**

> **▶ WORLD-ENGINE ATMOSPHERE #2 (BLACKBODY EMISSION) — ✅ SHIPPED `de4e577` (Max AC8 UAT-passed 2026-07-01).**
> Reshaped increment: the emission RENDER already existed as F32/F33 (`emissiveBlackbody` one-curve + east-advected
> `uThermalDir` hotspot + 1100K floor); the "hot giant renders cold" bug was two enable-flags defaulting false.
> #2 = (a) WIRED the Hot-Jupiter auto-glow + live `T_eq sweep` slider + master `emission register` toggle +
> retrograde east-sign, and (b) STOOD UP the tested `src/worldengine/base/emission-e.js` data-register
> (`visibleLuminance` re-anchored 1800K + Kelvin T-field substrate for #5/#6) + the missing CPU↔GLSL parity test.
> Unit PASS (AC1-3, 3× adversarial, 12/12 emission-e + 17/17 climate-e5, #3a golden hash intact). Integration PASS
> (AC4-7 live on :5177: Hot-Jupiter glows / cold giants dark; T_eq sweep red→orange→white; hotspot +14.9° east;
> emission-OFF pixel-identical to cold Jovian). **AC8 UAT PASSED by Max 2026-07-01** — screenshots in
> `screenshots/emission-*.png`. Decisions: keep shipped `(tempK/1800)^4` quartic for render; incandescent white
> core accepted (AC7 re-worded). Seed→driver derivation for the 3 interior scalars deferred to #9 (ATMOSPHERE-PLAN §e).
> **Atmosphere branch merged → L1 2026-07-01** (both tracks now in one tree; **pushed through `b996d55`** same day). Workstream
> `docs/WORKSTREAMS/world-engine-blackbody-emission-2026-07-01/`.

> **▶ WORLD-ENGINE #3a (E5 BANDS/JETS) — ✅ MAX UAT-PASSED `9c80d40` (2026-07-01).** The gas/ice-giant
> atmosphere writer. Replaces the lab shader's inline `0.25·latC·uBandCount` latitude stripe ladder with the
> climate-e5 writer's **signed, driver-organized, per-seed** band field: `writeClimateE5Sphere` (src/worldengine/
> base/climate-e5.js) emits bandField/bandNorm/turbulence/mushball/W across 4 regimes (gas-giant/saturnian/
> neptunian/sub-neptune); `bakeClimateE5Attributes` samples the SAME bandNorm onto render verts (aBand/aShear/aMush
> → vBand/vShear/vMush); `zonalBandCol` now colors from `bandVal=wBand` (planet-lod-height.glsl.js:1795), NOT
> latitude. Physics adversarially verified pre-build (7-agent workflow, all 5 laws CONFIRMED, 7 fixes applied;
> `DESIGN-physics-3a.md`). **Verdict (`verdict.json`):** unit **PASS** (AC1–AC9; verify-workstream `wf_50abf0da-f1b`
> re-ran 17/17 headless + 3/3 adversarial each — laws independently recomputed: amplitude law (Neptunian highest
> |U| at lowest energy) / Ward 54.7° pole-equator inversion / driver-flippable eqSign / shear-gated turbulence /
> distinct mushball channel / gas-giants-no-relief / determinism + golden bandField hash `-1329854088`).
> integration **PASS** (AC10–AC12 **live-driven by working-Claude** via chrome-devtools on :5176: GLSL compiles
> clean; render seam confirmed at source AND live — jets-OFF static **rotation sweep ×0.5→×3.0 ⇒ band count
> ~2-3→~6-8**, proving the running shader reads the writer field, not the old hard-coded ladder; four archetypes
> render distinct [band counts **14/11/3/3**, distinct palettes/sizes], two Jovian macroSeeds differ in band phase,
> close view = churning belts + wispy filaments (writer shear) + mushball tint, cohesive). **AC12(b)** Neptunian
> equatorial retrograde SIGN is muted-by-design live (ice giants deliberately low-contrast; band params writer-
> driven read-only) but **unit-verified via AC5**. **✅ AC13 UAT-PASSED (Max, 2026-07-01)** — flew the camera over
> the giants + re-rolled seeds live; cohesive/varied/distinct, not repetitive-3-band, not noise. **CONDITIONAL
> follow-on (named, not abandoned): belt-VISIBILITY tuning** — on Jovian ~5-6 strong belts are visible (incl. 2
> polar hoods) vs the ~14 zero-crossing readout, because only jets that clear the color window `smoothstep(0.34,
> 0.66, bandNorm)` render as saturated belts (weak mid-amplitude jets sit in the dead-zone). Accepted as "right
> number generating"; a future session can raise the visible count toward ~7-8 by narrowing the window (e.g.
> 0.42-0.58) or nudging `uBandContrast` — physics/field unchanged, display knob only. Doc close-out DONE `0f868ec`
> (FEATURES.md row, Rule 3). Atmosphere branch **merged → L1 2026-07-01**. ⚠ Global active-workstream pointer is
> on the *separate* `world-engine-magmatism-multiply-2026-07-01` (main-repo build) — left untouched; #3a is
> parked-pending-Max, not the active build. Resumed from `/tmp/handoff-world-engine-3a-live-2026-07-01.md`.
>
> **▶ PLATE/UPLIFT INCREMENT — BUILT + VERIFIED_PENDING_MAX `e07da8c` (2026-06-26).** Option-C increment 1
> (one-pass plate placement) is built, committed (local-only, **push HOLD**), and verified at the objective
> layers. NEW `src/worldengine/base/plates.js` (`writePlateUpliftSphere`, three-free): seed N centroids from
> `macroSeed` → spherical-Voronoi → per-plate Euler-pole motion → convergent/divergent/transform boundary
> stress (obliquity-attenuated) → uplift field **U** (REPLACES the latitude-band writer; sole low/mid source)
> → resolution-independent geodesic spread → bounded render-once relaxation. `route()` regime gate
> (`isEarthlikePlatePath`/`writeBodyRelief`): Earth-like→plates, else despun **byte-identical**.
> `routeAndOrder` discharge (`precipWeight`) + `computeOcean` base-level params (identity-safe, no north-star
> debt). `window._lab.plateProbe()` instrumentation. **Verdict (`verdict.json`):** unit **PASS** (AC1–AC6,
> verify-workstream re-ran 84/84 headless + 3/3 adversarial each, AC2 2/3); integration **PASS** (AC7 driven
> live by working-Claude on `:9223`, 2 seeds: **heightSource=carrier, boundary-vs-latitude variance 21–49×**,
> ocean 35%, 0 orphan/uphill, maxStrahler 5–6); **AC8 UAT = Max alone**. Built via per-AC
> implement→adversarial-audit→adjust workflows; **two independent reviews folded in** (AC2-metric-rigor →
> hardened the structure test against base-confound/self-correlation/straw-man controls; tectonics-math →
> verdict "model sound", changed oblique-convergent uplift from zeroed→attenuated, raised the AC2 test
> resolution so the geodesic belt resolves). Artifacts: `docs/WORKSTREAMS/world-engine-plate-uplift-field-2026-06-26/`
> (`BUILD.md`, `verdict.json`, `live-integration-evidence.md`). **NEXT = Max AC8 UAT** (lab-only, :9223): does
> an Earth-like body read as a coherent WORLD — plate-shaped continents, ranges at convergent boundaries,
> drainage belonging to that relief, genuinely various across seeds — not latitude bands / eroded noise? (Lab
> overlays all surface features; isolate via toggles / `reliefBakeStrength`.) UAT pass → Ship.
> **▶ LAB UI "isolate plate relief" control — BUILT + LIVE-VERIFIED (2026-06-27); AC8 UAT now UNBLOCKED.**
> New "Plate relief (UAT)" folder in `planet-lod-lab.html`: a one-click **"Isolate plate relief (AC8 view)"**
> checkbox (strips CLASH/OBSCURE/CLUTTER feature buckets, keeps drainage, forces baked relief=1, re-routes →
> plate field authors 100% of relief; OFF restores the exact prior enables via snapshot) + a **"Relief A/B:
> plates ↔ flat ocean"** button, plus the "baked relief" slider **desync fix** (one `applyReliefBake()` sync
> helper; `_lab.reliefBakeStrength` routes through it — uniform unchanged, AC2 byte-identical preserved). Built
> via understand-subagent → 3 surgical edits → multi-lens adversarial audit (1 minor finding fixed: solo→isolate
> snapshot guard) → live drive on :9223 = **PASS** (`plateProbe().heightSource=='carrier'`, boundary-vs-latitude
> variance ~22×, 0 orphan/uphill). Build note + intent/non-goals:
> `docs/WORKSTREAMS/world-engine-plate-uplift-field-2026-06-26/LAB-UI-isolate-plate-relief.md`. **NEXT = Max AC8
> UAT** with the new toggle (zoom in — renders small at distance-20). Named deferred follow-on (only if UAT finds
> the plate ranges too smooth alone): re-seat legacy orogeny F1/F4/F5 to NEST into plate boundaries — needs its
> own `dev-collab-scope` pass + brainstorm. Handoff: `/tmp/handoff-lab-plate-isolation-ui-2026-06-27.md`. Deferred
> follow-ons (named, not abandoned): precip/climate field, driver-response, game `Planet.js` port, Tier-C
> plate-motion stepping, province-as-referent rewiring, non-Earth-like regimes.
> **Lab-cosmetic follow-on (deferred 2026-06-27, Max "don't chase rabbits"):** in the isolated AC8 view the
> river-overlay ribbon reads as an unlit bright flat-blue *decal* over the lit/depth-shaded ocean (it doesn't
> belong to the sea). Root cause (lab-only, planet-lod-rivers.js): ribbon is `MeshBasicMaterial` (unlit) at
> `renderOrder:10`, color ramp `#1d3c5e→#4486bb`, scaled to ~1.0004× radius (floats above surface); ocean is
> lit `vec3(0.04,0.10,0.22)` + specular. Fix = light the ribbon so it shades like the ocean (Option 1) +/- clip
> it below sea level so it terminates INTO the sea (needs `isOcean` threaded into `buildRibbonGeometry`). NOT a
> clean one-liner; game river rendering is separate (MaterialBodyShader carve) — untouched. Diag screenshots in
> session scratchpad `diag-river-ocean-*.png`.
>
> **▶ WORLD-ENGINE HISTORY PROGRAM DESIGNED (2026-06-27) → increment 1 = DESPUN/ICE-SHELL writer (broaden-first).**
> Plate POC Max-UAT-passed ("success for the plate tectonics POC"). Via two multi-agent workflows (program-design
> `wryb3pfpb` + despun-writer design `w5wc97m7d`) the whole 9-increment history-systems roadmap + increment-1 design
> are written: `docs/WORKSTREAMS/world-engine-history-program-2026-06-27/` (`ROADMAP.md` = the 9 increments + FULL
> planet-type→increment coverage map + thin-spots-for-research; `increment-1-shell-relief-DESIGN.md` = build-ready
> despun/ice-shell writer + MUST-FIX-before-contract, headed by pinning the stress-field math). **Sequencing decision:**
> broaden-first (despun writer giving icy/volatile-cold/eyeball regimes a real history) over driver-response-first —
> max variety-per-effort + never touches the validated plate path. **NEXT (fresh session):** Max reviews the docs →
> `dev-collab-scope` increment-1 (pin the stress math + `SHELL_EXCLUDE` + verification tightenings) → per-AC build via
> `verify-workstream`. Handoff: `/tmp/handoff-world-engine-history-program-2026-06-27.md`. Thin spots flagged for
> research (ROADMAP): gas-giant storms, Venus stagnant-lid, sub-Neptune (homeless), exotic-shattered, exotics
> back-loaded into XL increment 8.
>
> **▶ INCREMENT 1 SHELL-RELIEF — SLICE A+B BUILT → VERIFIED_PENDING_MAX `54ea74d` (2026-06-27).** The despun/ice-shell
> stress-field writer is DONE. SLICE A (dispatch seam + determinism + scaffold) `70012a8`; SLICE B (the stress field)
> `54ea74d`. **What it does:** replaces the stubbed-to-zero stress in `src/worldengine/base/shellRelief.js` with real
> despun + diurnal **tidal-stress** math (despin tensor about seeded paleo-axis w0 + diurnal A=2 tensor → summed,
> rotated into {east,north}, direct-eigenvector diagonalized → thetaTraj-steered double-ridge lineaments + chaos
> overlay → carrier.height). Europa/Frozen (icy-active), Eyeball (eyeball-despun), Titan (volatile-cold) now render as
> **stress-driven** icy/despun worlds, NOT a `sin²(lat)` smear (~2→~5 of 11 archetypes genuinely distinct). Math pinned
> (adversarially-corrected) in `SLICE-B-stress-math.md`; the 3 corrections (meridional despin axis / non-degenerate A=2
> diurnal coeffs / direct-eigenvector + analytic STRESS_REF) verified honored. **Verdict (`verdict.json`):** unit
> **PASS** (AC1–AC6, 23/23 headless + 3× adversarial each); integration **PASS** (AC7–AC9 headless no-clobber/dispatch/
> seam + **AC10 live-driven by working-Claude** on :5173 (debug 9223), all 4 presets: `heightSource=='carrier'`,
> `varExplainedByStress` 0.39–0.40 **> latY AND > latW0**, `lineamentInteriorRatio` ≥2.6, `grainStressCorr` 0.77–1.00);
> **AC11 UAT = Max alone, PENDING.** Built via a build→verify→fix workflow (4 adversarial reviewers PASS round-0) then
> `verify-workstream` (`wgldmo012`, 43 agents). **A live AC10 probe degeneracy was caught + fixed before claiming pass**
> (BFS-from-high-tensile-seeds collapsed to corr=0 for despun/volatile where stress is broadly tensile → exposed a
> `reliefStress` diag field; probe predictor now arm's-length stress-geometry, zero latitude info). **NEXT = Max AC11
> UAT** (lab-only, :5173): step Europa/Frozen/Eyeball/Titan presets — accept only if each reads as a distinct,
> believable icy/despun world (cracks, cycloids, chaotic terrain), not a latitude smear, and the four feel meaningfully
> different. Renders SMALL at distance-20 (zoom in); the legacy in-shader synth (F1–F40) still overlays the carrier
> relief, so isolating may help — see the Lab-cleanup track below. **Non-blocking follow-ups:** (a)+(b) test-hardening
> pins for AC5 control-ratio-break + AC6 lineamentNode-overlap<0.2 (the load-bearing falsifiers are already green; pins
> in flight this session); (c) **AC9 CAVEAT — Titan is single-covered by its `PRESET_ARCHETYPE` line (preset unlocked →
> no locked-fallback net), so deleting that line silently regresses Titan to sin² bands.** Artifacts:
> `docs/WORKSTREAMS/world-engine-shell-relief-2026-06-27/` (`intent.md`, `contract.json`, `SLICE-B-stress-math.md`,
> `verdict.json`). **Push HOLD** (campaign-wide). Handoff resumed from `/tmp/handoff-world-engine-shell-relief-slice-b-2026-06-27.md`.
>
> **⚠ OPEN — Max's calls (don't silently resolve):** (1) **AC11 UAT** above — now with a CLEAN view (item 2 landed:
> step Europa/Frozen/Eyeball/Titan in the lab; the right "Features" panel is one collapsed "Legacy synth renderer"
> drawer). (2) ✅ **World Engine Lab cleanup DONE — `af12d67` (2026-06-27).** Renamed LOD LAB→WORLD ENGINE LAB (3
> display labels), collapsed the 5 synth groups + "Not relevant" into one CLOSED "Legacy synth renderer (F1–F49)"
> drawer (DOM-only re-parent; relevance filter keys on stored leaf parentEl → render-safe), dropped the voronoi3d
> debug spike (production uVoroCells untouched + still fed by applyDrivers). Executed directly (single-file,
> render-safe, reversible) per Max's call rather than a separate dev-collab-scope workstream; verified via
> understand→implement→3-lens adversarial review + live drive on :5173 (relevance re-sorts Rocky→Europa 15→41,
> console clean, render alive). **Deferred follow-on (named, not abandoned):** a future pass can delete the now-inert
> GLSL spike block (~L260-290) + its `uVoroScale`/`uDebugMode` uniform defs *together* (co-remove or the shader
> won't compile). Cosmetic note: the 5 synth groups sit open *inside* the closed drawer (lil-gui default-open), so
> expanding the drawer looks exactly as before — only the default view is tucked.
> (2b) ✅ **LEGACY SYNTH NOW DEFAULTS OFF — `cfbe42c` (2026-06-27, Max-directed).** The 41 legacy in-shader synth
> `*Enabled` defaults flipped true→false so the lab **boots showing ONLY the world-engine carrier** (plate/shell
> relief) — no borrowed synth detail (e.g. the frost/cryo tint that made Europa "look sort of right"), so the carrier
> is judged on its own work. **NOT broken — intentional:** all-off + a raw carrier sphere is the expected clean view;
> re-check any feature or hit **"enable all"** to restore. Carrier (`reliefBakeStrength`=1), relevance filter, base
> shading untouched. Verified the flip sticks (preset-apply makes zero `*Enabled` assignments; relevance gates via a
> multiplier; in-code comment "there is NO setPreset that re-applies `*Enabled`"); live :5173 fresh boot 0/50 enabled,
> carrier renders, holds Rocky→Europa; 468 tests pass. Drainage/rivers is pipeline-coupled (not legacy) but already
> off + gated on icy presets — re-enable when judging Earth-like carrier coherence.
> (3) **JOURNEY-vs-NOW DRIFT:** `JOURNEY.md` "Current objective" still reads the **35% SCREENSAVER-MVP** milestone (defect/
> music/10-min KRs) while the live campaign is the **world-engine history program** (60% ENRICHED depth). Reconcile the
> stated objective — Max's call. (4) **cross-tier-cycles research came back DEGENERATE** (placeholder stub, no mechanism)
> — re-run that one finding? **Other tracks landed:** ROADMAP folded with the preserved thinSpots research (`1ba3370`;
> +2 new increments 4.5 exotic-shattered, 5.5 shared-fields), research output preserved durably (`71172a1`).
>
> **▶ INCREMENT 2 (PLATE DRIVER-RESPONSE) — ✅ SHIPPED `45cca44` (2026-06-28, Max UAT-passed).** SLICE A (plumbing,
> byte-identical) `a3fe2f7` + SLICE B (calibration + lab UI, built via 2 parallel opus subagents) `143da55`. **What it
> does:** the body's real D-vector (D14 gravity / D2 volatiles / D12 tidal-heat) now reshapes the plate relief
> via a calibrated `driversToTune(D)` (gravity→UPLIFT_GAIN g^-0.5 clamp[0.4,2.5]; volatiles→CONTINENTAL_FRACTION;
> tidal→PLATE_COUNT_MIN), threaded through a NEW `bodyDrivers` channel separate from grainDrivers. Anchored to D_EARTH
> (Rocky's derived drivers: g 0.9 / vf 0.15 / tidalHeat ≈0.00174) so `driversToTune(D_EARTH)`→null→**Earth
> byte-identical** to the validated POC. Lab: 4 driver-override sliders + A/B button in the Drivers folder ("Body drivers
> → plate relief (Inc.2)") + plateProbe exposes bodyDrivers/appliedTune.
> **Verdict (`verdict.json`):** unit AC1-AC3 **PASS** + integration AC5 **PASS** (verify-workstream `wf_c793595f`,
> 3/3 adversarial each; vitest 14/14 + no-clobber harness 25/25); **AC6 live-driven GREEN by working-Claude** on :5173
> (Earth anchor `appliedTune null`; calibrated response via preset-switch + slider-drag; A/B flip; **visibly-distinct
> gravity A/B** screenshots `scratchpad/inc2-ac6-{A-tall,B-flat}.png`). **✅ Max UAT-PASSED the driver-response on
> Rocky/Ocean (2026-06-28, "these all look good").** **THEN D16 age DESCOPED at Max's direction** — age IS history, so a
> static age→continental nudge misrepresents it; its real home is the **epoch/host-editor model (#6)** + **weathering
> (#7)**. Age-drop re-verified: scoped vitest green; lab live = 3 sliders (gravity/volatiles/tidal), Rocky default
> `appliedTune null` (Earth byte-identical), gravity still responds. **✅ SHIPPED 2026-06-28** (Max UAT-passed the 3
> drivers; age descoped). **Deferred doc close-out:** FEATURES.md row + `npm run doc-rot` (skipped at ship for the
> usage-limit wrap). ⚠ **Mars sliders are INERT** (no PRESET_ARCHETYPE entry → despun
> path) — Mars correctly is NOT plate-driven (stagnant-lid in reality); its real history rides #4 volcanic / #5
> bombardment / #7 aeolian. Artifacts: `docs/WORKSTREAMS/world-engine-plate-driver-response-2026-06-27/`
> (intent, contract, SLICE-B-calibration, verdict). **Push HOLD.**
>
> **▶ INCREMENT 2 (PLATE DRIVER-RESPONSE) — SCOPED, AWAITING MAX GREENLIGHT (2026-06-27).** `dev-collab-scope` pass.
> **Active workstream switched** shell-relief → `docs/WORKSTREAMS/world-engine-plate-driver-response-2026-06-27/`
> (`intent.md` + `contract.json`, status `building`, validated, active pointer set). ⚠ **shell-relief is NOT shipped** —
> its AC11 UAT is still Max's open hands-on gate (`VERIFIED_PENDING_MAX 54ea74d`); #2 is a *sibling* effort on the plate
> path that doesn't touch the shell path, so it can build in parallel. **What #2 is:** the MULTIPLY move — thread the
> real per-body D-vector (D14 gravity / D2 volatiles / D12 tidal-heating / D16 age) through `route()`→`writeBodyRelief`→
> `writePlateUpliftSphere` via a NEW body-driver channel + a calibrated `driversToTune(D)` so PLATE_COUNT / UPLIFT_GAIN /
> CONTINENTAL_FRACTION respond to drivers. Today the plate writer ignores drivers (`void drivers`, plates.js:110) and
> varies by seed only. **Max's scoping calls (in-thread):** (1) **full driver set** (not minimal-legible); (2) accepts
> **D16 age must be surfaced first** (presets carry erosion/bombardment/resurfacing, NOT age). 7 ACs: AC1 determinism /
> AC2 **Earth byte-identity** (the load-bearing guard — `driversToTune(D_earth)`→DEFAULTS branch) / AC3 monotone
> correct-sign response / AC4 age surfaced+consumed / AC5 **no-clobber the grain bake** (separate driver channel) / AC6
> live probe / **AC7 UAT** = the UAT-RUBRICS increment-2 card folded in (two Earth-likes differing only in drivers read
> as genuinely different worlds; Earth unchanged). **#1 must-fix (calibration, build's first task):** define `D_earth`
> as a named constant + calibrate transfer fns to return DEFAULTS at the *real* Earth D-values (NOT a 0-vector;
> tidalHeatNorm≈0.19, ageNorm≈0.45). ⚠ **"Why we care" in intent.md is Claude's draft — Max to reword.** **NEXT:** Max
> greenlights `contract.json` → SLICE A (plumbing, byte-identical) → SLICE B (calibration) via `verify-workstream`.
> **Push HOLD.**
>
> **▶ PER-INCREMENT BASIS-LEVEL UAT RUBRICS — WRITTEN (2026-06-27).** Max's directive: make the basis-vs-expression
> UAT framing (from shell-relief: *"did it lay down the right BASIS?"* not *"is it believable?"*) a **standard artifact
> for every increment** of the world-engine history program. Delivered:
> `docs/WORKSTREAMS/world-engine-history-program-2026-06-27/UAT-RUBRICS.md` — one **5-field rubric card** per increment
> (Ships-as-data / Expression-path / **Visually-testable?** / Basis-level-pass-criteria / Red-flags) for all 11
> increments (1–9 + 4.5, 5.5), with #9 game port reframed as *expression-fidelity*, not basis. Grounded against live
> code: `PRESET_ARCHETYPE` (`planet-lod-lab.html:1901`) + `SHELL_REGIMES`/`SHELL_EXCLUDE` (`shellRelief.js`) → a
> **"test the PRESET the user sees, not the canonical archetype"** caveat table. **The high-value finding (the ⭐
> visually-testable column):** three increments can't be UAT'd as-is and need a proxy/probe/preset built BEFORE they're
> contracted — **#5 bombardment** (no lab preset routes to it; the only `impact-airless` preset is `Frozen`→#1), **#5.5
> shared-field pass** (ships invisible fields other writers consume → needs probes + downstream proxy), **#6 epoch model**
> (no direct look → composed-history proxy; AND its fixed-point solver is UNMECHANIZED — the degenerate cross-tier-cycles
> research = NOW-item 4 above). Also flagged: **#4.5 blocked on Max's geometry decision** (block-jumble vs diapir-grooved),
> **#8 should be split** (archetype-completers vs Tier-5 overlays = open decision c). **Push HOLD.**
>
> **▶ GRAIN-VS-LANDFORM FORK RESOLVED (2026-06-26) → answer (a) BASIS → Option-C plate-placement increment SCOPED + greenlit, build handed to fresh session via workflows.**
> The AC5 "semi-coherent" verdict was a **generative-model/content** verdict, not a wiring bug. Dig (via workflows)
> answered the fork: **(a)** — what's on screen is precursor E6 grain (latitude bands; the carve never touches the baked
> field); the landform process is genuinely deferred, not a wrong end-state. Two-part missing process: **erosion** (E9,
> already owned + UAT-passed flat) vs **construction/uplift** (unbuilt). **Then Max sharpened the bar: not "reads-as-coherent"
> but actually COHERENT** — rivers where the procgen's full history says they should be. Coherence trace: the carve IS real
> flow routing (not decoration) but is fed two historyless inputs (latitude-only height + uniform rain `accum=1`) → correct
> router over incoherent substrate = incoherent rivers. **SOTA research (Cordonnier 2016 / Cortial 2019 / Tzathas 2024)
> established a 3-tier model**: place tectonic END-STATE + run a **bounded gen-time erosion** (NOT geologic-time sim;
> compatible with locked place-once) → render once. Max's frame: **"generative, not simulative"** ("what *happened*",
> end-state determined by formation variables). **The hard gap = STAGE 1 (placing the uplift/continent field), not erosion
> (WD owns it).** Decisions: **Tier B now, built C-ready**; **branch by regime** (plate path gated to Earth-like; despun E6
> kept byte-identical for icy/locked/etc.); **lab-first**; **seed-only variety this increment** (driver-response = named
> follow-on); precip/base-level **parameterized-but-deferred** (no north-star debt). **Scoped + committed:**
> `docs/WORKSTREAMS/world-engine-plate-uplift-field-2026-06-26/` (intent + 8-AC contract, `f3662c8`, status **building**,
> active-workstream pointer set). **NEXT: fresh session BUILDS it via per-AC implement→`verify-workstream` workflows.**
> Handoff: `/tmp/handoff-world-engine-plate-uplift-field-build-2026-06-26.md`. Increment-1 baked-relief plumbing: do NOT
> revert (reusable, verified). **Push HOLD** (whole local branch since 2026-06-23).

> **▶ INCREMENT 1 (world-engine-baked-relief-render) — BUILT + VERIFIED (`e9d6cd5`); AC5 UAT → semi-coherent, see block above (2026-06-25).**
> The A-lite first step of the full-A render port. **5 phases A–E committed** (`cef95c5`→`e9d6cd5` on
> `1eb556d` plan): (A) net-new sphere-native `writeHeightSphere` — coarse E6 relief generated as DATA on a
> seam-free 3D-simplex domain (NOT lat/long), deterministic; (B) bake `carrier.height` into a seam-free 256³
> cube once-per-route; (C) lab renderer displaces from the cube behind `uReliefBakeStrength`, strength-0 =
> verbatim fallback (if/else, never mix); (D) river router re-pointed to the **same** `carrier.height` array;
> (E) seam/pole continuity gate. **The §0 invariant held: ONE field → ONE cube → BOTH consumers, ONE strength
> uniform** (the WS4 data/noise split is closed). **Verification:** AC1 unit PASS (22/22 + full-suite confirms
> the 4 pre-existing fails are untouched by the diff); AC2/AC3/AC4 integration GREEN = headless 42/42 +
> working-Claude live drive on `:9223` (**single-source router==baked diff 0 sphere-wide**; strength-0 router
> falls back to legacy; both poles no pinch + cube-corner no seam ridge); AC5 UAT **deferred-to-max**. Built
> via workflows (understand→plan→build w/ per-phase adversarial review→verify-workstream); the Phase-E
> reviewer caught a **vacuous AC4 seam test** (self-calibrated threshold) → reworked to frozen
> injection-validated thresholds. Artifacts in `docs/WORKSTREAMS/world-engine-baked-relief-render-2026-06-25/`:
> `BUILD-PLAN.md`, `verdict.json`, `live-integration-evidence.md`. **NEXT = Max AC5 UAT** (lab-only): open the
> LOD lab, slide **'baked relief (0 = synth only)'** 0→1, judge — does the relief read as **generated
> structure** (coherent landforms, not a grain on noise) with **drainage cut into that same relief**, vs the
> **WS4-scoped bar** (coherent system + drainage; NOT "where are the continents" — that's the Option-C
> follow-on). UAT pass → Ship (FEATURES row + doc-updates). Then **increment 2** = the heavy E6-build +
> E9-carve substrate swap onto the sphere. **Push HOLD** (campaign-wide). Handoff:
> `/tmp/handoff-world-engine-baked-relief-render-2026-06-25.md`.

> **▶ WS4 (world-engine-relief-wiring) — VERIFIED_PENDING_MAX `deca261` (2026-06-25).** E6 tectonic **grain** → E9 subtractive stream-power **carve** wired into the LAB (lab-only; game Planet.js deferred). One shared grain field feeds all 6 grained combiners (mix gated by `uTectonicGrainStrength`, 0=byte-identical fallback); drainage genuinely subtracts (perNodeIncision Δ≤0, epoch build-then-carve). 4 unit ACs PASS (grain-oracle, carve-subtractive, epoch-build-identical, renderer-expression-only; 3× adversarial) + 5 live integration ACs PASS on :9223 (one-shared-grain, grain-zero-identical, epoch-carve-visible, router-zero-drift ocean35/Strahler5/0-orphan-uphill/poles-clean, bake-once). **`landscape-with-history` UAT = Max's gate alone — PENDING:** walk a built world, toggle grain 0↔1 + carve epoch, judge "reads as a landscape with a history." A/B captures in `scratchpad/ws4-live/`. Built entirely via workflows (ground→plan→adversarial-critique→build→verify→live-drive). bake-once AC amended: grain is sea-level-independent. **Push HOLD** (campaign-wide).

> **▶ WS4 UAT (2026-06-25) → GENERATIVE-ARCHITECTURE PIVOT, NOT shipped.** Max walked the lab (grain slider + carve-epoch toggle + ⊞grain feature tags added for UAT, `6a172c8`). The grain *mechanism* verifies and the subtractive carve genuinely reshapes the heightfield (oceans/lakes/mountains shift). BUT UAT surfaced a fundamental gap: the procgen layer (WS1 drivers, WS2 fields) generates only a THIN latitude-banded **orientation** grain + scalars — NOT a tectonic structure/**history as DATA**; the relief is shader-synthesized noise merely *oriented* by the grain, so it reads as an orientation overlay, not "a planet with a tectonic history." That violates the spine's own **"procgen decides, render expresses / place plausible structure once per body"** principle (`world-engine-architecture-spine.md` §0/§1). **Decision: do NOT ship WS4; do NOT start WS3.** ⭐⭐ **HOLD LIFTED — MAX, 2026-08-20: "lift per your rec".** ⛔ The hold is NOT retracted as wrong; it is SATISFIED. Its condition was that the generative-architecture question be answered before building on the foundation, and it was: the 14-agent assessment (`6787146`) locked the direction ("procgen writes structure as DATA, render expresses it"), and its increment 1 — `world-engine-baked-relief-render-2026-06-25`, `e9d6cd5` — **PASSED MAX'S UAT 2026-08-20** ("I just did the UAT and it seems passable"), which closes the AC5 that had read `deferred-to-max` for ~8 weeks. The renderer now reads relief from a sphere-native BAKED field with the river router re-pointed at the SAME field, so the overlay-on-noise defect this hold was raised against no longer holds. ⚠ WS3 IS UNBLOCKED; WS4 SHIPPING IS **NOT** IMPLIED — AC2/AC3/AC4 remain `INSUFFICIENT` at the integration layer and increment 2 (the E6-build + E9-carve substrate swap) is unbuilt. See D-7 in `docs/FEATURES/comprehensive-wiring-plan-2026-08-20.md`. WS4 = reusable foundational plumbing (one shared field + a real subtractive carve). **NEXT (Max's directive): a FRESH session examines the GENERATIVE ARCHITECTURE *via a workflow*** — map what's generated as data vs synthesized in the shader across game/lab/world-engine → assess vs Max's "generate tectonic history as data → render it" vision → research prior art (procedural plate tectonics / structural heightfields) → recommend a direction → then brainstorm with Max before any build. Handoff: `/tmp/handoff-world-engine-generative-architecture-rethink-2026-06-25.md`. Push HOLD.

> **▶ GENARCH ASSESSMENT DONE → DIRECTION SET → INCREMENT 1 SCOPED (2026-06-25, this session).** Ran the
> architecture-examination workflow (14 agents: map+research+2 assess+3 adversarial critique) → committed
> `docs/FEATURES/world-engine-genarch-assessment-2026-06-25/ASSESSMENT.md` (`6787146`). **Verdict: the DIRECTION is
> right** — "procgen writes structure as DATA, render expresses it" is validated by the UAT-PASSED relief slice AND
> every production planet renderer + SOTA paper surveyed. **WS4 failed UAT because it wired only the orientation grain
> into the production shader; the relief HEIGHT stayed in-shader noise** (`height.glsl.js:950` mixes grain as an axis,
> `:972` keeps height `noised()`). 3 critics returned **refuted=false** (core call survives) but flagged that the
> synthesis OVER-SELLS the fix → folded into **ASSESSMENT.md §11**: full-A is bigger than rated (NO sphere-native height
> writer exists; E9 is flat-only), the slice's flat-DEM divergence UAT does NOT transfer to a sphere
> "reads-as-history" UAT, an **A-lite** coarse-elevation-bake middle path was never priced, **D12 zero is
> `PlanetGenerator.js:606-613` not :565** (WS1 already surfaces tidalHeating — gap is consumption), and **WS4's UAT bar
> EXCLUDES continents** (intent.md:15-16 defers them to E7/E8/E11 + Option C). **Max's call (verbatim): stop bouncing
> micro-decisions — proceed toward the outcome.** Direction locked: **reopen decision #6**, renderer expresses **baked
> structure-as-data** (full-A = destination); **B dead**; **C (one-pass plate model for continents) = follow-on**.
> **SCOPED increment 1: `world-engine-baked-relief-render-2026-06-25`** (intent+contract committed `f3e8c30`, status
> building, active-workstream switched) — reach full-A via an A-lite-shaped first increment: bake a COARSE sphere-native
> height field → DISPLACE the surface from it + re-point the river router at the SAME field + seam/pole continuity (the
> critics' first AC), de-risking the sphere/dual-source plumbing before the heavy **E6-build+E9-carve-substrate swap =
> increment 2**. 5 ACs (AC1 unit, AC2-4 live integration on :9223, AC5 Max UAT vs the WS4-scoped bar). **NEXT (fresh
> session, build via subagents per Max): present contract for greenlight → plan → build → `verify-workstream` →
> VERIFIED_PENDING_MAX → Max UAT.** LAB-only. Push HOLD. Handoff:
> `/tmp/handoff-world-engine-baked-relief-render-2026-06-25.md`.
>
> **▶ LANE C (2026-07-08): naming-census-uniqueness-2026-07-07 → VERIFIED_PENDING_MAX (code `3336dd7`,
> branch `feature/system-details`).** Serves the exploration-immersion outcome ("players never encounter
> the same system name twice"). Landed: Horsehead IC434/M78 position fix + 4 stale tests; deterministic
> name census; HYG catalog regenerated (0 `"` artifacts, 15,559 usable real names — CSV-parser root-cause
> fix); real names win on every targeting path; position-derived injective procgen naming (survey +
> multipart, zero duplicates by construction, no-position fallback now throws); shipped named-systems
> catalog (12k settled + 36k greek notables, 40% near features, 0.82MB gzip). Full verify 3/3-adversarial
> green + live chrome-devtools checks (Horsehead renders rank#2 with M78 #7; Sol 19/19 scene suite;
> revisit round-trip stable). **UAT round 1 (2026-07-08): "looks good in general, BUT" — Sirius search
> spawned Sol. FIXED `631571b` (2026-07-09):** Sol's KnownSystems match radius 5 pc → 0.5 pc (was
> swallowing 12 real stars: Sirius 2.64 pc, Rigil Kentaurus 1.32 pc, Procyon…) + teleport arrivals now
> carry the real star's name via `RealStarCatalog.findByPosition()` (same precedence warp already had).
> Re-verified: new match-radius suite incl. full-catalog sweep, 1113/1113 vitest, live Sirius→"Sirius",
> Solar preset→real Sol, scene suite 19/19; light verify addendum
> `verdict-light-sirius-fix-631571b.json` (AC1 re-checked green end-to-end). **UAT round 2 (2026-07-10):
> Sirius OK, BUT nav computer named Sol "Talimon". FIXED `d8d6b63` (2026-07-11):** AC9 catalog regen had
> dropped Sol (HYG row 0 has dist=0 → distance filter); regen script now emits Sol explicitly (catalog
> back to 15,599, +1 entry only). Plus identity-aware nav-warp arrival: nav entry named "Sol" warps to
> REAL Sol with position snapped to registry (was: blanket hasNavStar skip → procgen impostor).
> Verified: 1114/1114 vitest, live PRISM shows Sol gold-labeled + you-are-here ring, nav-style warp from
> 1 pc-off grid position spawns real Sol, negative-case nav warp unaffected, scene suite 19/19.
> **Post-fix hardening (2026-07-11, Max-directed):** 8-angle subagent code review of the two fixes → 11
> verified candidates, 6 survived → applied via workflows: `7f5fd1e` (teleport arrivals force real
> spectral type — Sirius now A-class; currentGalaxyStar realigned on known-system arrivals; dead `"`
> guard dropped; tolerance-ordering invariant exported + tested) and `a1d2d4c` (identity-join redesign:
> KnownSystems.associate() derives aliases from catalog stars within MATCH_RADIUS — self-healing across
> regens; findByAlias name gate + 3 pc belt replaces the display-name lambda; makes future Alpha
> Centauri registration work — HYG names its components Rigil Kentaurus/Toliman). 1123/1123 vitest,
> live belt accept/reject verified, scene suite 19/19. Successor flags recorded in `a1d2d4c` message.
> **✅ UAT PASSED (Max, 2026-07-11)** — Sol works; workstream CLOSED at `a1d2d4c` (FEATURES.md row
> added). **Now IN MASTER + DEPLOYED** — lane B's `847ab19` pre-deploy merge (2026-07-11) folded this
> branch in; `feature/system-details` is a strict ancestor of master (build sessions: just ff onto
> master first). Contract: `docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/`.
> **▶ SUCCESSOR SCOPED (2026-07-12): `real-universe-overlay-2026-07-12`** — interview done (Max's 4
> facets: nav-neighborhood fidelity, player search, observed characteristics, structures; rulings:
> true positions never procgen-snapping, bulk exoplanet ingest + curated companion table, structures
> = search+audit only, settled-catalog UI folds into search, seedtags stays parked). 10 ACs incl.
> AC10 engine structural support (degenerate star class, known-planet injection, far-companion; Alpha
> Cen = A+B binary + Proxima far companion, authoring proof). Contract survived a 3-lens adversarial
> review (12 findings folded, 3 blockers: multiplicity had no data source/engine support) + round-2
> re-verify (clean + 3 residuals folded). Resolves D6–D9. Contract:
> `docs/WORKSTREAMS/real-universe-overlay-2026-07-12/` (schema-valid, status building).
> **▶ GREENLIT (Max 2026-07-12) → Increment 1 (AC7 ingest) BUILT `77723c2` (2026-07-13).** AC8
> baseline captured FIRST (`1fc7357`: 24 procgen-only systems, deep-equal + re-filter hook). Archive
> verified live (pscomppars 6319 planets/4735 hosts; attribution license). Built via 5-agent workflow
> (opus builders, sonnet integrate, **fable adversarial verifier** — Max's today-only unlock) + 8
> post-build rulings (design doc §Post-build): known-binary allowlist (HD 20781/20782, TOI-2267 A/B),
> companion-table-derived duplicate exemption (Proxima vs Rigil/Toliman per contract's Alpha Cen
> architecture), Kepler-90-as-KOI-351, lum 4-sig-digits, ICU-stable sorts. Shipped: ingest script
> (byte-identical, exit 0, drops 0/7/7/27/260 reported), real-system-contents.json (4457 hosts/6030
> planets), real-star-supplement.json (14 dim hosts), stellarCompanions.js (5 web-cited entries),
> blocklist 323→325 (0 named-catalog collisions), 18 contract tests. Suite 1249 passed (vendor noise
> unchanged). ⚠ **BINDING Increment-3 input:** overlay merge joins by NAME first — 104/116 same-named
> hosts sit >0.1 pc from their HYG record (Hipparcos-vs-Gaia distance disagreement, max 141 pc).
> **▶ Increment 2 (AC10+AC5) BUILT `d106181` (2026-07-13).** Design-first (`65994e2`, 2 explorer passes),
> built via resumed 4-agent workflow (opus builders/reviewer, sonnet integrate; builder-2's report died on
> StructuredOutput — work was on disk, recovered via audit-stage resume). Landed: STAR_PROPERTIES.D
> (spec-only, never rolled) + normalizeSpectralClass ('DA2'→'D'); ctx companionSpec/knownPlanets/
> farCompanions (omitted-not-null — AC8 snapshot held byte-identical); KnownSystemAuthoring adapter routes
> declarative entries THROUGH StarSystemGenerator; Alpha Centauri entry = companionsRef only (A+B from
> stellarCompanions, Proxima planets via gen-known-system-contents.mjs generated module); Proxima alias
> derived from companion table; both anticipated test flips (findAt(RIGIL_POS)→Alpha Cen; ingest clearance
> exemption); ONE surgical main.js line (map injection at associate()). Cap rules: representation-cap.md
> (`c713625`). Suite 1276 (was 1249). Verify full ×2 (2nd run after an API-crash rerun of the AC10 check):
> **AC10 PASS 3/3 + AC7 PASS 3/3**; AC5 static-green + **LIVE-DRIVEN same day** (Max brought up :5176 +
> debug Chrome): nav-warp at Rigil, Proxima-position-targeted warp, and debug-search teleport ALL spawn
> the authored Alpha Centauri (G2V+K1V @23.5 AU, Proxima far companion w/ planets b,d, names aligned, no
> impostor); Sol intermediate spawned as Sol; **AC8 live enterSol() 19/19 CLEARED** (owed since Inc 1);
> console zero errors/warns. Addendum: `verdict-live-drives-d106181.json` (sky-click deferred w/ rationale
> — same findAt branch as teleport, plumbing untouched). ⚠ Inc-3 BINDING inputs: name-first join
> (unchanged); ExoticOverlay._applyFungal 1-candidate crash must be fixed BEFORE D-primaries become
> reachable; injected known planets need migration/stability immunity (TRAPPIST-class).
> **▶ Increment 3 (AC3+AC4 bulk overlay merge) BUILT `c68c1fb` + VERIFIED + LIVE-DRIVEN (2026-07-13).**
> Pre-work `d417a39` (fungal 1-candidate fix, TDD, cadence-preserving) + design `240ec99` (2 explorer
> passes — both died at StructuredOutput, findings recovered from transcripts → new rule
> `feedback_workflow-structuredoutput-hazard.md`). Landed: RealSystemOverlay (name-first join, dup-name
> position disambiguator, display-name→hostname bridge, unready-warn); supplement+contents ride
> RealStarCatalog.load() Promise.all (15,613 stars — TRAPPIST-1/Proxima arrivable); known-planet
> immunity (migration/resonance/cull/exotic + slot guarantee — the ~4,000-host spurious-binary threat:
> 2,437 hosts have a planet <0.1 AU); TWO surgical main.js edits (warp+teleport else-branches,
> coordinator-flagged); merged display names (real designations); cap §5. Adversarial review 1 MED
> (fill-letter dup of known designation under migration reorder) fixed in-thread + pinned. Suite
> 1278→1321; ProcgenSnapshot 24/24. Verify full at `c68c1fb`: **AC4 + AC7 + AC10 PASS 3/3**;
> AC3/AC5/AC8 live-closed same day (verdict-live-drives-c68c1fb.json): Sol 19/19, Sirius **A+D binary
> @19.8 AU**, TRAPPIST-1 **M + all 7 knowns, real designations on HUD**, Rigil→authored Alpha Cen,
> console clean. Merged-star nav-warp deferred w/ rationale (close at Inc-4 search or AC9). Structure
> stays table-only — **snum-as-single-pin parked as an AC9/UAT knob** (with Alpha-Cen fill policy).
> **▶ Increment 4 (AC2 player search) BUILT `44c7075` + VERIFIED + LIVE-DRIVEN (2026-07-13).** Design
> `f40bac2` (2 explorer passes). New pure resolver `knownObjectSearch.js` (ports DebugPanel three-source
> search + ADDS named-systems catalog class-b + registry-name bridge so 'Alpha Centauri'/'Sol' resolve +
> toNavStar seed-parity). NavComputer: DOM `<input>` overlay, `_searchFocused` capture-guard **+**
> bubble `stopPropagation` (both phases needed — build caught my design miss), result list w/ keyboard
> nav, Escape clears+blurs, 'D' swatch; select → **genuine warp** via the real `_onCommit`→
> `dispatchNavAction`→`_setWarpTargetFromNavStar` contract (never teleport, never hand-set `_warpTarget`).
> +2 flagged main.js input-wiring lines. Max-ratified NavComputer seam recorded in `increment-4-design.md`
> for lane D. Suite 1321→1340 (0 new failures); ProcgenSnapshot byte-identical. Verify full at `44c7075`:
> **AC4+AC7+AC10 PASS 3/3** (unregressed); AC2/AC3/AC5/AC8 live-closed same day
> (verdict-live-drives-44c7075.json): reachable via N; keyboard guard **both phases** ('WASDRFN' all land,
> nav stays open); all 4 resolve classes; **search→warp→Sirius = real A1V+DA2 binary @19.8 AU**
> (CLOSES the owed Gate-4 merged-star nav-warp; routes through the Inc-3 arrival merge); search→warp→Sol =
> authored Sol; Sol integration suite **19/19**; console clean. Boot-tour warp-collision edge case
> documented (in-flight boot warp overrides a mid-boot selection — NOT an AC2 defect; lane-B tour/N-gating
> territory). Parked knobs: **snum==1 single-pin ADOPTED** (Max; representation-cap §5, `cd8abd0`);
> Alpha-Cen A/B fill = Max's rec-open call at Inc-5.
> **▶ Increment 5 (AC1 + AC6 + snum-pin + fill ruling) BUILT `3e58fac` + VERIFIED + LIVE-DRIVEN (2026-07-14)
> → workstream VERIFIED_PENDING_MAX.** Design `4775f5f` (2 explorer passes; OOM sequential-builder rule
> suspended by Max → 3 parallel opus builders + gate + adversarial review, 1 fix round — the review CAUGHT the
> AC6 builder dying on the boilerplate-spawn glitch and the fix round built it). Landed: AC1
> `neighborhood-reference.json` (19 Sol / 15 Sirius neighbors, shipped-catalog distances, 6 absent-famous
> documented) + **NavComputer position-snap FIX** (matched real stars rendered at hash-grid positions up to
> 2 pc off — interview-ruling-1 violation; now catalog-true) + `window._navComputer` handle; AC6 Harris
> Part-III per-cluster radii (152 distinct, 1.9–180.2 pc, replaces uniform 30 pc) + committed audit that
> CAUGHT 3 real position errors (M13 1.53 kpc off!, M57, M45 z-sign — corrected); snum==1 single-pin
> (resolve()-side, one-directional, table-wins; AC4 case (e) amendment validated; AC3 immunity vehicle →
> 55 Cnc); Alpha-Cen **fill-ON ruled by Max** w/ zero-planet-rate condition → documentation only
> (representation-cap §6: existing 8% empty roll + astronomy basis + named-not-built calibration seam).
> Suite 1340→**1404** (0 new failures); ProcgenSnapshot 24/24; ZERO main.js edits. verify-workstream full
> (wf_1eab0d7b-3eb, 39 agents): **AC4+AC6+AC7+AC10 PASS 3/3** (AC6 flipped from FAIL-as-scheduled);
> AC1/AC2/AC3/AC5/AC8 live-closed same day, TWO circuits (`verdict-live-drives-3e58fac.json`): AC1 both
> vantages **worst error 0.03% vs ±2%** (34 assertions), TRAPPIST-1 visible @12.43 pc AND arrives as M
> SINGLE w/ exactly 7 knowns b–h (the pin live), authored Alpha Cen G2V+K1V@23.5 AU + Proxima(b,d), Sirius
> A1V+DA2@19.8 AU (table-wins), Sol 19/19 ×3, console clean. **⚠ AC9 flag: Alpha Cen A/B drew ZERO fill
> planets on the authored seed** (fill-on active; deterministic empty branch / circumbinary geometry) —
> small authoring knob if Max wants the flagship populated.
> **▶ NEXT: AC9 = Max's batched UAT over the whole workstream** (nav neighborhood from Sol, search things he
> knows, arrivals vs astronomy, structures; the α-Cen zero-planet flag above is his call). The only open
> gate. Branch UNPUSHED (merge Max-gated; deploy = Pages).
> **▶ AC9 RUN 2026-07-15: FAIL — and the 36 Oph investigation found a procgen-level identity defect
> (bigger than nav).** Max's verdict verbatim + corrected mechanism in
> `docs/WORKSTREAMS/real-universe-overlay-2026-07-12/ac9-uat-findings.md` finding #2 (commits `bd5733a`,
> `d725c27`): (1) real-star seed identity is pipeline-dependent — search/catalog quantize position to
> 0.1 pc (the 36 Oph trio collapses to ONE seed; 6 groups/13 stars total), the prism merge retains
> replaced hash-grid seeds, its unmatched branch uses a degenerate x^z XOR (**10,986/15,560 named stars
> collide**, incl. Sol/Sirius) — same named star generates DIFFERENT systems by selection path; (2) nav
> SYSTEM view for browsed systems is an overlay-less locally-generated preview (live: Guniibuu preview
> 6 planets vs arrival K+K binary + 4); (3) un-tabled/un-hosted real stars roll FABRICATED companions
> (snum pin reaches archive hosts only). **Max tabled close-out + successor scoping: investigate root
> cause → plan solutions → implement in a FRESH session (via /handoff), carrying the standing items**
> (α-Cen SHIP-AS-IS standing resolution; label-declutter mechanism designed 2026-07-15 = deferred label
> pass, lane D builds; formal close-out sequence; the 3 new scope questions: seed-identity unification,
> preview honesty, fabrication-reach ruling). New drive rule: **stop `window._autoNav` before any nav
> drive** (`feedback_wd-nav-drives-autopilot-off` — boot demo tour auto-warps under agents; contaminated
> + retracted 2 mid-investigation claims). Window parked at Sol, suite 19/19, tour OFF.
> **▶ FIX WORKSTREAM SCOPED (2026-07-15): `real-star-identity-unification-2026-07-15`** — serves
> exploration-immersion (a real star = ONE system, the same system, on every path). Interview rulings
> (Max): fabrication reach = **pin-by-default** (un-tabled/un-hosted real stars never roll fabricated
> companions; table + archive snum win both directions); lane-D render half (N-dot glyph + deferred
> label pass) **FOLDED IN under a Max-ratified NavComputer seam** (Inc-4 precedent, recorded for lane
> D); **NEW workstream** (overlay stays `verified` w/ AC9-FAIL recorded; AC9 re-runs after this ships
> to :5176). 11 ACs per `docs/WORKSTREAMS/real-star-identity-unification-2026-07-15/` (schema-valid):
> canonical F1 seed + merge-test rewrite, path-identity live, shared arrival-resolution module +
> preview honesty, pin-by-default, census companion table (36 Oph/61 Cyg/ζ Ret) + dup-row dedup w/
> the neighborhood-reference regen ripple, multiplicity oracle (shared RNG prefix, snapshot-guarded),
> glyph + label AABB pass, regression guardrail (GRID formula untouched), Max UAT via the AC9 re-run.
> Plan of record: `seed-identity-investigation.md` (882d121). **GREENLIT same day → BUILT + VERIFIED
> same day: → VERIFIED_PENDING_MAX `f6b3eff` (2026-07-15).** 6 units via build workflow (each
> adversarially verified; suite 1,404→**1,504**/0; ProcgenSnapshot 24/24; main.js net −18 lines, all
> regions on the lane-B ledger) → verify-workstream full (unit ACs 3/3-adversarial) → working-Claude
> live circuit on :5176 closed AC2/AC4/AC8/AC9/AC10 (`verdict-live-drives-f6b3eff.json` + committed
> screenshot): Denebola search≡prism-click IDENTICAL; previews ≡ arrivals ×4 classes; Guniibuu = ONE
> marker, 3 dots, honest K+K+K arrival; Rigil 2 dots + Proxima her own; zero label overlaps at max
> zoom (Rigil↔Proxima stack + leader line); Sol 19/19; console clean. **Live drives caught + TDD-fixed
> `f6b3eff`:** `_isCurrentSystem` 2 pc radius swallowed neighbors (Rigil-from-Sol previewed Sol + built
> BURN) → now POSITION_MATCH_TOL (0.1 pc = F1 bin). **NEW lane-B flag:** warp dispatch ungated during
> in-flight warp (mid-flight commit re-targets against a moving frame). Max notes: R2 Proxima-marker
> arrival = whole α Cen system (taste call); formerly-divergent stars legitimately changed contents.
> **▶ AC9 RE-RUN STARTED (2026-07-15): finding #3 recorded `d502ec8`** — far-companion systems read
> as adjacent duplicate binaries (Max verbatim + live-verified mechanism in ac9-uat-findings.md:
> SYSTEM view titles by clicked marker; `farCompanions` never rendered; no prism co-membership cue —
> DATA layer verified coherent). Options (a) system-identity titling + render fars (seam-local),
> (b) component-centric arrival (R2, bigger), (c) prism co-membership cue. **Max tabled → fresh
> session REASSESSES the fork first, then recs** (his ruling before any build). Handoff:
> `~/briefings/handoff-lane-C-far-companion-fork-2026-07-15.md`. AC9 verdict still open; overlay
> close-out remains gated on AC9-PASS. Branch 25 ahead of origin (push Max-gated). *(RESOLVED
> 2026-07-21: the AC9 re-run PASSED in the ship-cascade UAT sitting on build `6bc5177` → overlay
> Shipped `3e58fac`, unification Shipped `f6b3eff` — see the SHIPPED block below.)*

> **▶ FINDING #3 RESOLVED (2026-07-19): `system-identity-grammar-2026-07-17` → VERIFIED_PENDING_MAX
> `5583651`.** Fork reassessed 2026-07-17 → rec (a)+(c)+grammar-rule; **Max overrode with his own
> three-sentence directive** (intent.md verbatim: multiple dots in prism / SAME system in system view /
> one destination via nav or warp) and delegated plan/implement/test — (b) recorded as deliberate
> non-goal. Built same-directive: U1 system-identity naming `5cc6baf` (title by `_knownSystemNames.system`
> + "via <component>" annotation + real component hover names), U2 far-companion edge chips `f60cad9`
> (Proxima + b/d visible in SYSTEM view for the first time; covers every farCompanions system incl.
> 36 Oph), U3 prism co-membership cue `2cc925d` (tether on hover/selection + "· Alpha Centauri" label
> suffix through the declutter pass; new pure helpers systemIdentity/farCompanionChips/prismMembership),
> AC6 design law `5583651` (NAMING_AND_REAL_OBJECTS.md §6 — Max's directive as normative grammar; closes
> the naming→seeds→glyphs→cross-view recurrence CLASS). Each unit adversarial-PASS round 1; verify-full
> wf_35113e26-c4e 5 unit ACs PASS 3/3; gates personally re-run (suite 1,557/0, Snapshot 24/24, zero
> main.js); AC2/AC5 closed by live drives (verdict-live-drives-5583651.json + 4 screenshots: both-marker
> previews title "Alpha Centauri" seed 1816942132, both warps land the authored G+K system log-confirmed,
> instrumented dot-to-dot tether, zero label overlaps, console clean). **REMAINING: AC8 UAT = Max's AC9
> re-run** (:5176 tab parked at Sol, tour off). Overlay close-out still gated on AC9-PASS. Branch ~32
> ahead of origin (push Max-gated). *(RESOLVED 2026-07-21: AC8 PASSED in the ship-cascade UAT sitting
> on build `6bc5177` → Shipped `5583651` — see the SHIPPED block below.)*

> **✅ DONE (2026-07-19): MULTI-STAR RENDER FEASIBILITY INVESTIGATION — verdict: FEASIBLE; Max
> greenlit implementation.** Report `docs/WORKSTREAMS/real-universe-overlay-2026-07-12/`
> `multistar-render-feasibility.md` (draft `8d9f08f` → 3-verifier adversarial corrections `7cb8253`;
> material catch: Proxima F1 seed-bin inversion → one-seed + child-stream design). Headline: float32
> was never the blocker (WorldOrigin rebasing + log depth already live); rec = **Increment A** (lane C:
> `componentSystems` substrate + nav component drill-in + rep-cap amendment, zero main.js) then
> **Increment B** (JOINT lane B+C scoping: component travel via warp-swap recenter + DEPART legs).
> Max ruled 2026-07-19: "Great; … handle implementation (and any planning/research needed before and
> testing needed after)" → D1/D2 greenlit-in-principle, D4 default = all authored wide multiples,
> D3 + Increment B deferred to joint scoping. All three open UAT gates (AC9 re-run / AC11 / AC8)
> re-run on Increment A's build. **▶ NEXT: Increment A via self-paced loop session** —
> ⭐ Handoff: `~/briefings/handoff-lane-C-multistar-components-implementation-2026-07-19.md`.
> Cross-lane relay owed to coordinator: lane B board drift (orrery-coherence VERIFIED_PENDING_MAX
> `802cceb`; DEPART greenlit + `building`).

> **✅ SHIPPED lane C (2026-07-21): MULTISTAR COMPONENTS INCREMENT A — Shipped `6bc5177`;
> Max UAT PASSED same day ("UAT passes as written"): AC10 + all three riding gates in one
> sitting.** Workstream
> `multistar-components-2026-07-19` (JOURNEY: real-universe navigability / PLAYER_EXPERIENCE:
> nav-computer tier). Headless S1–S5+S7+S8 (`a52163b`…`9904569`, each slice TDD +
> fable-adversarially verified, findings folded same-session; suite 1,557→**1,616/0**;
> ProcgenSnapshot 24/24; main.js + realStarSeed.js zero-diff; scripts/ untouched). **S6 live
> drives DONE 2026-07-21** (chrome-devtools on `:5176`, build `e8100d8`≡`6bc5177`): AC6 both
> entries (far-chip drill + PRISM pre-select, real payload b+d at archive orbits, 15 label
> pairs zero overlap, ESC round-trips) + AC7 both α Cen markers (preview seed 1816942132
> captured pre-warp; identical authored G+K @23.5 AU arrivals log-confirmed; console 0 err/
> 0 warn) — `s6-live-drive-log-e8100d8.md` + 8 screenshots (`6bc5177`). **Phase 4
> verify-workstream** wf_2dc6721a-12c at `6bc5177`: 8/8 unit ACs PASS (3/3 adversarial votes
> each); AC6/AC7 static-INSUFFICIENT by design → closed by `verdict-live-drives-6bc5177.json`;
> AC10 deferred-to-max. Contract `status: verified` / `VERIFIED_PENDING_MAX 6bc5177`.
> **✅ UAT PASSED (Max, 2026-07-21, verbatim "UAT passes as written")** — all four gates in
> one sitting on build `6bc5177`: AC10 + overlay AC9 re-run + unification AC11 + grammar AC8
> (recipe: `~/briefings/handoff-lane-C-multistar-components-verified-2026-07-21.md` §3). Max
> also confirmed no-warp-to-components is correct by design (Increment B; view only; §6
> one-destination invariant). No recording artifact — Max drove the app HIMSELF live, which
> is direct Max evaluation (motion evidence, Max-evaluated), satisfying the Shipped-gate
> principle. **SHIP CASCADE EXECUTED same day:** FOUR contracts → `shipped`, all schema-valid
> (multistar-components @`6bc5177`; grammar @`5583651` — AC8 was its last gate; unification
> @`f6b3eff` — AC11 ditto; overlay @`3e58fac` — the AC9 re-run its close-out was gated on).
> Rule 3 docs: FEATURES.md overlay row de-staled + 3 new rows (unification, grammar, component
> drill-in) + naming row → shipped-confirmed; doc-graph zero-diff; doc-rot 225 flags, no new.
> **✅ PUSHED + MERGED + DEPLOYED (Max "push & merge; go", 2026-07-21):** `feature/system-details`
> pushed to origin; master fast-forwarded `58d11f3`→`e565bee` (pure ff — origin/master was an
> ancestor; no merge commit needed) and pushed; GitHub Pages deploy run 29848620206 SUCCESS at
> `e565bee`. FEATURES.md rows → shipped-confirmed. **▶ NEXT: Increment B (component
> travel) = JOINT lane B+C scoping interview — not before Max prompts; also waits on lane B's
> orrery-coherence UAT (`802cceb`).** Watch-items for Increment B scoping:
> one 998 ms fold stall on the Sol→α Cen leg (attribution open; leg 1 clean); HELM boot-tour
> auto-warp (standing lane-B flag). Parked (out of surface, recorded in commit messages +
> seam handoff): normalizeSpectralClass prototype-key lookup quirk; silent 'M' fallback for
> non-table far classes; doc-rot scoped-mode port-check still owed.

> **▶ LATEST (2026-06-20): river-LOD methodology SPEC done + Max-approved → BUILD next.** Pursuing
> river scale via a GENERAL structured-feature-LOD methodology (instance #1 = rivers). Brainstormed
> WITH Max + approved. Spec: `docs/superpowers/specs/2026-06-19-structured-feature-lod-methodology-design.md`
> (commits `19f98b3` + radius `a21a5e7`, local-only). Decisions: ribbon(legibility)+carve(co-dependence)
> render; α-carries-zoom / gridRes fixed-per-feature-per-planet ~448 (O(Nf²) snap→O(1) hex-lattice
> inverse); 3 full-strength co-dependence reads (real height, sea-level outlets, ocean-mask bake);
> static-cap v1; **legibility GPU gate** (LEGIBLE not just DIFFERS). Radius = realistic seed-derived
> `state.planetRadiusEarth·6371`, no gen change. Pickup spec: `docs/superpowers/specs/2026-06-19-structured-feature-lod-methodology-design.md`.

> **▶ LATEST (2026-06-20 late): both legibility decisions RESOLVED → threshold done + ribbon
> UN-OCCLUDED; next = lightweight port-READY pass.** (1) §8.10 fine-channel render threshold:
> default 4 + GUI slider, committed (through `21e4e2a`), twice adversarially reviewed. (2) **Ribbon
> un-occlude: committed `eeddaab`** — `riverOverlayState.ribbonLift` (default 1.0014) applied as a
> uniform mesh scale to both ribbon meshes (carve `LIFT` 0.999 untouched), `depthTest` stays true,
> new `ribbon lift (occlude↔float)` GUI slider; verified live (trunk ribbon now renders over the
> surface, far hemisphere occluded). Cluster **369 green**. Max reframed: build river-LOD
> **port-READY** (radius-param the geometry + a port-contract doc) WITHOUT wiring into the game.
> **NEXT SESSION:** `/tmp/handoff-river-lod-portready-2026-06-20.md` (two parallel `code-explorer`
> runs already mapped both pipelines — both are non-displaced spheres; the river stack is mostly
> portable-core; the carve is a surface-shader graft). **STILL Max-owned:** UAT of ribbon-vs-carve
> reading (now unblocked) + the deferred graft-vs-replace renderer-unification call.

> **▶ LATEST (2026-06-20, port-ready pass LANDED).** Both pieces done, local-only on master.
> (§1) **Radius-parameterized the ribbon builders** (`63159a6`): `buildRibbonGeometry` +
> `buildFineRibbonGeometry` take `params.radius` (default 1.0 = lab no-op); the whole ribbon scales
> uniformly (centerline `dir*radius*LIFT` AND width `*radius`) so the game's
> `IcosahedronGeometry(d.radius,5)` surface is supported. **Audit's sharper finding:** only the two
> RIBBON builders depend on radius — `buildValleyGeometry` (direction-keyed carve cube) +
> `buildFineValleyGeometry` (angle-keyed ortho patch, planar tan-space) are radius-invariant by
> construction, deliberately NOT threaded. `radius` orthogonal to `radiusEarth` (width) + `ribbonLift`
> (mesh scale). TDD `tests/planet-lod-river-radius.test.js`; cluster **369→374 green**; live-verified
> default path renders rivers unchanged (ribbon radii=0.999=LIFT). (§2) **Port-contract doc**
> (`0233cf3`): `docs/FEATURES/river-lod-port-contract.md` — portable-core modules, the
> `sampleCarve`/`uRiverCarve*`/`uSeaLevel` shader graft, radius param, ribbon-lift + logdepthbuf/
> no-polygonOffset caveats, lab-glue to re-implement; linked from divergence §4. Contract not a plan —
> wiring stays deferred. **STILL Max-owned (unchanged):** UAT of ribbon-vs-carve (esp. grazing angles)
> + the graft-vs-replace renderer-unification call.
>
> **▶ LATEST (2026-06-20, Phase-5 Integration SCOPED — planning only, local).** After the
> feature-interaction audit (`0606313`: 84 edges → 52 gaps), Max approved scoping it as a campaign
> and delegated the framing call to working-Claude. **Call made:** it IS campaign **Phase 5
> "Integration"** (was `pending`), reframed from verify-only → *build the couplings*; the I-1…I-15
> checks become the acceptance layer run AFTER the builds. 52 gaps sequenced into **WS1–WS5 +
> cross-cutting**, full gap→WS + I-check→WS mapping in the new
> **`docs/FEATURES/planet-lod-phase5-integration-plan.md`**. WS1 (keystone: surface the discarded
> per-basin `filled` → lake mask + rim breach; closes 7 gaps incl. Max's crater-lake example) =
> recommended FIRST build. WS5 = cross-link to the existing `rivers-viewdependent-lod-2026-06-18`
> workstream (NOT duplicated). **Second call: planning-only this session** — each WS is built via its
> own `dev-collab-scope` pass when Max greenlights it (none built yet; respects the scope+UAT gates).
> Updated: CHARTER program-3 line, campaign-tracker Phase-5 row, INTEGRATION.md header pointer,
> view-dependent intent (WS5 role). All local/unpushed.
>
> **▶ REFINED (2026-06-21, via workflow `wf_df308f40-79d`).** Max's topo-map observation —
> *the same tectonic activity produces both mountains AND the structured valleys that shape
> rivers* — exposed a blind spot. Code-verified (4-agent workflow): the river router DOES route
> on real finished mountain relief (RTT of the real combiner chain → priority-flood; lateral read,
> WIRED, I-1), so the visible effect mostly works. BUT the engine has **no shared tectonic
> lineament field** — relief features share only a scalar province amplitude-mask (`gProvince.x`),
> each with its own seed-hashed axis; inter-range lows are incidental noise minima, not orogenic
> drainage corridors. So **shared-driver CO-GENESIS** (one cause → many coherent features =
> *vertical* coupling) is categorically distinct from the audit's 52 gaps (all *lateral*
> output-reads) and was never enumerated (audit rubric excludes shared-driver as "co-occurrence").
> Added to the plan: a **"lateral reads vs. vertical co-genesis" scope-boundary section** + **WS4
> sub-item 7 (orogenic drainage-corridor co-genesis, mountains↔rivers)** — fidelity-tier, below WS1,
> kept DISTINCT from WS4's relief×relief partition generator (don't conflate). Plan + NOW.md updated;
> local/unpushed.
>
> **▶ (2026-06-20 PM): §7 BUILT + headless-green + review-hardened; live GPU gate run →
> objective plumbing PASSES, but LEGIBILITY needs 2 Max decisions (NOT a clean pass).** 4 commits on
> master (local-only): `7de1f7d` §7.1 co-dependence field-reads (height coeff 1.0 / sea outlets /
> ocean mask), `38f817c` §7.2 O(1) hex-lattice inverse + seed-derived gridRes, `d220d04` §7.2 review
> fixes (snapToLattice rim-widen + skip O(Nf·N_base) macro scan on GPU path — both HIGH-sev, caught by
> a 10-agent adversarial review workflow), `0135fdc` §7.3 fine ribbon + order-graded dry→flood carve.
> Headless: **366 green** (was 339; +27 new across 3 test files). **GPU gate (page 3, `:9223`)
> findings:** pipeline wired (segmentCount ~200k), console clean, **regression-safe at strength 0** ✓,
> fine CARVE adds finer dendrites that read (A/B differs, legible at a higher channel threshold) ✓,
> feeds-the-sea/ocean-mask headless-verified ✓. **TWO open decisions (Max's, UAT-layer):**
> **(1) fine RIBBON (Fork A) is depth-OCCLUDED** in the lab — the TRUNK ribbon is too (LIFT 0.999 sits
> inside the radius-1.0 sphere) → rivers read via CARVE flood/dark-floors only (matches the handoff's
> "shipped rivers read via flooding, not ribbon"); Fork A is a no-op here until the ribbon is
> un-occluded or the game-port. **(2) DENSITY**: at the derived gridRes 550 the default fine-channel
> threshold (Strahler≥2 → ~102k channels) reads as a SMEAR; a higher render threshold (≥4 → ~22k)
> reads as legible dendrites — needs a default-raise + a GUI slider to tune. Gate screenshots:
> `river-lod-gate-{A..G}*.jpeg` (repo root, NOT committed). Campaign memory updated with full findings.

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

> **▶ ACTIVE WORKSTREAM (2026-06-15/16): `planet-scale-normalization`** — Theme B of the
> LOD-lab quality backlog (`docs/FEATURES/lod-lab-quality-backlog.md` #2). Building a **real-units
> scale system** into the lab (planet radius + feature sizes + relief heights in km; `deriveUniforms`
> converts to unit-sphere uniforms). Scope/design/contract in
> `docs/WORKSTREAMS/planet-scale-normalization-2026-06-15/` (intent + design + 10-AC contract).
> **Phase A done** (`a329891`: conversion helpers + `radiusRangesEarth`→`ScaleConstants` extraction,
> oracle 13/13, gen-guard 85/85). **Crater slice done + Max-approved** (`c32374d`). **SHIPPED 2026-06-17 — Max UAT-PASSED + PUSHED
> (`aafa94c`, runtime `dc04806`).** Footprint fan-out + AC3 relief (physically-
> plausible heights × gravity factor, M2) + AC4 animation-rate + AC5 seeded size-source (named-body
> locks vs archetype draws, M3) + self-resetting-slider fix + AC7 km readout all landed.
> `verify-workstream` ran: AC6/8/9 PASS (3/3 adversarial); AC2/3/5/7 PASS live on :9223 (evidence in
> `scale-gallery.html`); AC1 calibration test added + AC1 reworded to the AC8 architecture; AC5
> headless-oracle logged as test-debt. **Max UAT-PASSED (AC10) 2026-06-17 → Shipped + pushed.** AC4's
> small-world lava-rate floor is DEFERRED — Max scoped **lava itself as the next Theme-A re-think**
> (backlog #10, rivers-style), so the rate tweak waits until that restructuring. Handoff:
> `/tmp/handoff-planet-scale-normalization-crater-slice-2026-06-16.md`.
> **▶ Rivers (Theme-A #3) sphere-seam viability spike: VIABLE (`e2f3bb5`, 2026-06-17).** Seam-free
> dendritic drainage proven on an **irregular spherical Delaunay mesh** (regular icosphere grid-locks
> channels straight); G1 (routing) + G2 (dendritic look) both Max-eye-approved; conform-only suffices
> (carve deferred). Plan/verdict: `docs/FEATURES/rivers-sphere-spike-plan-2026-06-17.md`.
> **▶ Rivers full feature SCOPED + Max-GREENLIT (2026-06-17, scope commit `e9ea4b5`).** A 2nd
> (terrain-coupling) spike passed (C1–C4, C3 Max-eye-approved; `rivers-terrain-lab.html` untracked).
> ⭐ **Render method = ribbon-geometry OVERLAY, NOT texture-bake** (the research/older-plan bake-path
> framing is STALE — superseded). 8-AC contract in
> `docs/WORKSTREAMS/rivers-dendritic-drainage-2026-06-17/` (intent + contract; AC1 shared-height-GLSL
> module, AC3 sea-level-from-histogram = the two coupling-spike findings). Active workstream flipped to
> rivers. **BUILD IN PROGRESS:** **AC1 (shared-height-module) DONE `8fcfaeb`; AC2+AC3 DONE + committed
> `03cf22a`** (2026-06-18). AC2 (real-terrain RTT coupling) — router lab reads the lab's REAL h+grad at
> ~40k verts via the SHARED AC1 modules (the "both consumers" proof); verified live on :9223: h+grad
> finite, ocean == real level-set, terrain dial moves the read-back heights; zero-drift vs the spike;
> obsolete verbatim copies removed, router lab graduated to tracked source. AC3 (sea-level-from-histogram,
> TDD) — `planet-lod-sealevel.js` inverse-CDF solver (6 oracle tests); per-planet sea solve lands all 5
> reseeds at exactly 35% ocean (was ~13%). Also fixed an AC1 regression `planet-archetypes.test.js` missed
> (GLSL-mirror parse repointed to the shared module). 273/273 planet cluster green. **AC4 (ribbon overlay
> on the actual lab planet + retire F11) DONE + committed `c3f0e7b`** (2026-06-18). Extracted the proven
> router/ribbon pipeline into a SHARED module `planet-lod-rivers.js` (AC1-style, no third verbatim copy) —
> repointed the router lab at it as a zero-drift regression gate (stats reproduce: ocean 35%, orphan/uphill 0,
> maxStrahler 5), then wired `createRiverOverlay` into `planet-lod-lab.html` bound to the lab's LIVE uniforms.
> Ribbon parented to `planet` (co-rotates), lazily mesh-built on enable (556ms), re-route reuses the cached
> mesh (133ms — AC7 preview). New "Rivers — dendritic overlay (AC4)" GUI folder: enabling forces F11 off
> (state.riversEnabled→0, the per-frame gate) and drives the planet sea to the histogram 35% so water + river
> outlets agree. LIVE-VERIFIED on :9223 from 4 viewpoints (equator, BOTH poles clean = no pole/seam artifact,
> basin close-up): dendritic network, trunks to seas, tributaries branching upslope, no F11 double-pattern,
> 0 console errors. **Max review of AC4: "looks good but isn't integrated, it's like an overlay."** →
> **AC4 INTEGRATION WIP committed `b0e8f08`** (river→landscape carve; default-off toggle, planet byte-identical
> when off): de-glow + seat (deep-water palette, LIFT 0.999) + **valley carve** — routed network rasterized
> into a direction-keyed depth CUBE map (`buildValleyGeometry` + `createCarveCubeMap` in planet-lod-rivers.js;
> shader samples by surface dir → bends normal into a V + darkens floor, along the REAL network so no F11
> worm-trails; cube → no seam/pole). GUI sliders (carve depth/floor). Router lab regression holds.
> **2 OPEN ISSUES (Max, next session — handoff `/tmp/handoff-rivers-AC4-carve-2026-06-18.md`): (1) channel
> edges too smooth/artificial (Chaikin + clean V → need natural roughness/meander); (2) valleys don't FILL
> with water (carve darkens the floor but doesn't lower h, and the water ribbon is thinner than the valley →
> dry groove + thin line, not a water-filled channel).** Then AC5 (routing metrics; ⚠ R_b 6.16 at 35% ocean
> vs [3,5.5] band — address via CHANNEL_ORDER/width-law/ocean-target) → AC6/AC7. Build handoff
> `/tmp/handoff-rivers-build-2026-06-17.md`.
> **▶ AC4 carve — the 2 review fixes LANDED + committed (2026-06-18):** (1) **edges roughened** —
> carve depth + wall gradient × a surface-keyed fbm (breaks the clean Chaikin V; rides ON the real
> network, no F11 worm-trail); (2) **valleys FILL with water (Max chose Option B)** — the carve now
> lowers `h` BEFORE the F14 sea cut so the floor drops below sea level and floods via the same
> level-set as the oceans (water albedo + glint + coast for free). Both gated by `uRiverCarveStrength`
> (default-off ⇒ planet byte-identical). All shader-side in `planet-lod-lab.html` — `planet-lod-rivers.js`
> UNTOUCHED, so router-lab regression is structurally safe. 2 new live sliders (flood depth, edge
> roughness). Live-verified on :9223 (before/after close-up basin); 282/282 planet tests green.
> **▶ THEN Max reframed the whole feature → SCALE (2026-06-18, this session's pivot):** current rivers
> are **continental-width + radius-INDEPENDENT** (40k mesh ⇒ ~88km cell floor; ribbons 14–285km wide,
> valleys ×4 >1000km) — they look planet-spanning, not riverine, which is why they're visible from orbit
> when real Earth rivers aren't. Max's framing: current global-bake tech is RIGHT for small bodies /
> large channels (with mods), but for Earth+ it's "scaled up way too far," AND rivers must compose with
> the OTHER terrain-modification combiners (they form as part of the terrain, not an overlay).
> **Decision: scope AC6 (scale-coupling) properly** — bigger than the contract's current AC6 ("width+mesh
> scale with radius_km" via Theme-B): now also (a) the resolution-floor reality (Earth rivers go
> sub-visible / need a local/zoom-gated regime, not just "finer"), (b) rivers as a first-class member of
> the combiner chain. **Next session: dev-collab-scope pass to revise AC6** (grounded in the Theme-B km
> scale system that already exists + the two-regime split). NOTE: the geometric carve was DEFERRED in
> intent.md but Max REOPENED it (now landed) — note the reversal when the contract is revised. Handoff:
> `/tmp/handoff-rivers-AC6-scale-scope-2026-06-18.md`.

> **▶ F11 RETIRED + DENDRITIC RIVERS MADE FIRST-CLASS `076f586` (2026-06-19, post-ship).** Max:
> remove the old F11 river feature + wire the new one like the others (checkbox by the folder
> name). Done via subagents. Removed the F11 worm-trail VISUAL (height-carve + `fluvTint`) + its
> GUI folder; promoted the dendritic network to THE rivers feature with full first-class treatment
> (title-bar enable checkbox + ⓘ info + relevance filter via the `rivers`/`state.riversEnabled`
> key; folder → 'Rivers & valleys (F11)'). Verified 282/282, backtick parity even, rivers off/on
> confirmed live on :9223. **⚠ BEHAVIOR CHANGE — deltas dormant:** F12 `deltaCombiner` is spatially
> gated by `fluvialWet`, seeded ONLY by the F11 network (shared `planet-lod-height.glsl.js`); F11
> off ⇒ `fluvialWet`=0 ⇒ delta aprons dormant until re-coupled to the dendritic mouths. F13 outflow
> unaffected. This is the lead-in to the next workstream. Push PENDING Max. Handoff:
> `/tmp/handoff-rivers-fluvial-coupling-2026-06-19.md`.
>
> **▶ NEXT WORKSTREAM (scope, don't build yet) — FLUVIAL FEATURE CO-DEPENDENCE.** Max's priority:
> generation where features inform each other → distinct 3D landforms (not "semi-homogeneous slop").
> First concrete step: spatially couple the fluvial family (F12 deltas, F13 outflow, F20 coast) onto
> the dendritic carve map so they form AT the real rivers. Validated feasible (subagent, 2026-06-19):
> carve map = HalfFloat RGBA cube, **R=depth, G/B free**, built once per route. Need: retain the
> router graph (`strahler/receiver/accum`, currently discarded), bake mouth field (F12/F20) +
> Strahler order (F13) into spare channels, and make the network route unconditionally per planet
> (always-on) so always-on features can read it. Findings:
> `~/briefings/welldipper-carvemap-coupling-feasibility-2026-06-19.md`. Scope via `dev-collab-scope`
> (spans 2+ systems). Slug suggestion: `rivers-fluvial-coupling-2026-06-19`.

> **✅ GLOBAL RIVERS SHIPPED `f45c804` (2026-06-19).** Max's AC8 UAT passed — walked the clean
> Earth-like lab on :9223 (Rocky preset, seed 1, frozen, distance 2.6, all 3 fixes live: relief
> gate 0.18 / wall-bend 0.01 / per-seed width 0.773, 0 width violations) and called it: *"looks
> good to me."* Rivers read as real dendritic drainage to the seas, no longer cut through
> mountains, sized right, a clear win over the old F11 worm-trails. No tuning changes; defaults
> stand. All 8 ACs green (unit + integration driven live 2026-06-18 + UAT). `verdict.json` →
> SHIPPED; `contract.json` status → SHIPPED. **DEFERRED BY DESIGN:** the route itself still
> crosses rendered ridges (40k global mesh can't resolve them) → the already-scoped
> **`rivers-viewdependent-lod-2026-06-18`** workstream, the next pickup (Max's sequencing). Was
> VERIFIED_PENDING_MAX `f45c804`; pushed to origin/master last session.
>
> ---
> *History below (chronological, oldest of this thread at the bottom):*

> **▶ AC6 SCOPE PASS DONE + Max-GREENLIT (2026-06-18, commit `2669e53`).** dev-collab-scope pass.
> Max sharpened "realistic at scale" → **realistic from a SPACECRAFT POV** (Elite-Dangerous: far orbit
> down to "planet fills the viewport, just above atmosphere"). The single global 40k-vertex bake
> structurally can't resolve thread-thin close-approach rivers (≈140km vertex floor, ≈14km min width) →
> **the close-approach realism SPLIT OUT into a new spike-first workstream:
> `docs/WORKSTREAMS/rivers-viewdependent-lod-2026-06-18/`** (intent + 7-AC contract, validated). Arch is
> research-forced (5-agent prior-art + code-map scan in the two `research/` dirs): keep the existing
> global route as a LOD-independent **authority**, deterministically **amplify** local detail (Dendry,
> Gaillard I3D 2019) conditioned on it; **evaluate SDF-in-shader render vs the current ribbon** (S5
> reverses the global overlay's "ribbon, NOT SDF" call — sub-pixel ribbons shimmer). S4 (faint-at-orbit →
> resolve-on-approach) KEPT. Integration = rivers **sit/drain in the composed terrain** (read-coupling,
> mostly owned); physical back-coupling (crater lakes, mouths, burial) DEFERRED + named. The
> small-body/large-channel idea is a parked hunch. **AC6 in the GLOBAL contract reduced to the
> macro/proportioning layer only** (+ forward-pointer; stale line refs fixed). The earlier "two-regime
> split" framing in the handoff is SUPERSEDED (small-body parked; the work is the Earth+ spacecraft regime).
> **SEQUENCING (Max): FINISH GLOBAL RIVERS FIRST** — remaining AC5 (R_b=6.16 @ 35% ocean vs [3,5.5] band),
> AC7 (regen budget), AC8 (Max UAT) — **THEN** start the view-dependent spike. Active workstream stays
> `rivers-dendritic-drainage-2026-06-17`.

> **▶ GLOBAL RIVERS → VERIFIED_PENDING_MAX `d420c85` (2026-06-18).** Sequence (Max's pick: AC6 hookup →
> verify → UAT) executed:
> • **AC5 routing metrics** `74bbe87` — added the missing monotonic-width metric (reads 0); R_b guard band
>   **calibrated [3,5.5]→[3,7]** per Max ("calibrate to reality": 6.16 is a global-POOLED estimate, textbook
>   3-5 is per-basin; every structural check clean + look eye-passed at AC4, so calibrate the yardstick, don't
>   retune generation). All 7 metrics pass: orphan/uphill/widthViolations 0, maxStrahler 6, near-collinear 0%,
>   median turn 30.7°.
> • **AC6 scale-coupling** `d420c85` — radius-coupled the global overlay: object-space river width ∝
>   1/radiusEarth (inverse of the Theme-B `featureFrequencyFromKm`), `widthRadiusFactor`/`paramsForRadius` in
>   `planet-lod-rivers.js`, threaded via `route({radiusEarth})`, wired from `state.planetRadiusEarth`. Live
>   RE1→RE3: factor 1.0→0.333, network valid, smaller disk-fraction. Mesh-res scaling **deferred-by-design** to
>   the view-dependent workstream (a 40k global mesh can't resolve big-world thread-thin rivers).
> • **AC7 regen budget** — live-verified: mesh built once (710ms), NOT rebuilt on sea-level OR terrain change
>   (mesh-ref stable), re-route 113-202ms.
> • **verify-workstream** (`wf_d829c028-886`, full, liveBranch=main): Unit PASS (AC1/AC3); the 5 live-integration
>   ACs I drove green on :9223 (working-Claude); AC4's stale "floating ribbon ~R*1.001" wording **reconciled** in
>   the contract (shipped = LIFT 0.999 seated + carve Option-B flood). `verdict.json` written. **AC8 UAT = Max's
>   gate, OUTSTANDING** — load a wet preset (~35% ocean), overlay ON, judge vs the old F11 worm-trails.
> Pushes NOT done (Max confirms). After UAT-PASS → start the view-dependent spike (`rivers-viewdependent-lod-2026-06-18`).

> **▶ UAT 3 FIXES BUILT + verified → re-VERIFIED_PENDING_MAX (2026-06-18).** All three landed on `master`
> (unpushed); rivers/planet cluster 282/282; router-lab regression re-checked clean (0 orphan/uphill,
> Strahler 5, R_b 5.15). **Item 3 (biggest) ROOT-CAUSED** via systematic-debugging + live carve-OFF A/B:
> the artifact is the **carve, applied UNCONDITIONALLY** along the routed network (never checking local
> rendered relief); the route sits on high ground because the 40k mesh **aliases** terrain (adjacent verts
> differ up to 35% of the height range) — the deep resolution gap = the deferred view-dependent workstream.
> Max chose **Layer-1 relief gate**: `348b7a0` — new `uRiverCarveGateHi` (0.18) gates carve depth + wall-bend
> + floor-darkening by the shader's own per-pixel `h` (the only field that sees the sub-mesh ridge), so it
> incises lowland valleys but fades on peaks ("features work together"). **Item 2** `ce84c1f` — wall-bend
> (`carveStrength`) default 0.7→0.01, slider re-ranged 0–0.15. **Item 1** `827e40f` (both levers, Max-picked):
> floor `WIDTH_RADIUS_FLOOR` 0.2→0.08 (r11 now 0.091=1/11, was clamped) + per-planet seeded width draw
> `widthSeedFactor(seed)`∈[0.6,1.5] threaded `route({widthSeed:state.macroSeed})` (live: seed 1/7/42 →
> 0.773/0.631/1.469, deterministic; same-terrain A/B visibly thinner/thicker). All identity-safe. **NEXT:
> Max UAT on :9223 (lab live, all 3 in); optional `verify-workstream` re-run; intent honesty on the
> read-coupling ceiling reconciled in the contract.** Handoff: `/tmp/handoff-rivers-UAT-fixes-2026-06-18.md`.

> **▶ MAX UAT (2026-06-18) RETURNED 3 FIXES — workstream REOPENED (not shipped).** Handoff:
> `/tmp/handoff-rivers-UAT-fixes-2026-06-18.md`. In Max's words: (1) **scale must go SMALLER, seed-dependent**
> (today width is seed-invariant + floored at `WIDTH_RADIUS_FLOOR 0.2`); (2) **"wall bend (normal)" looks
> best at ~0.01** (`carveStrength` default 0.7 → re-default/re-range); (3) **BIGGEST: rivers cut straight
> INTO mountains/high terrain instead of flowing down/around** — "all features that modify terrain height
> need to work together." Ruled out = missing combiners (`ROUTER_MAIN` runs the full chain). Prime
> hypotheses: (A) router under-resolves fine relief (40k verts ~140km + `octavesDuringRead:9` vs full-res
> shader → routes across peaks it can't see); (B) carve is unconditional along the path → gouges trenches
> through rendered mountains. Fix is an INTEGRATION decision (raise router fidelity vs relief-aware
> routing/carve vs. it may force starting the view-dependent workstream) — brainstorm with Max, don't
> param-nudge. **Next session: fix item 3 first (systematic-debugging), then 1 + 2, then re-run verify.**

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
> Residuals (Carbon/Crystal mountains (exotic), faint craters on Ocean/Europa) + remaining solid cluster
> = shatter/hexTess (exotics on non-exotic worlds) → **IN THIS WORKSTREAM (Max, 2026-06-15): finish the
> render-correctness residuals as part of the per-feature quality pass BEFORE integration**, not parked.
> **All Bucket-A/B commits PUSHED to origin/master.**
> (4) **Max's bigger ask = MENU/INFO OVERHAUL** (his goal #3), 4 phases. **Phase 1 (declutter)
> SHIPPED 2026-06-15 — VERIFIED_PENDING_MAX `fc30eb1`** (3 commits `6214510`/`3424ef7`/`fc30eb1`,
> GUI-only in planet-lod-lab.html, no shader/core change; full vitest delta = 0 new failures vs the
> pre-existing 17-file baseline; live-verified on :9223). Three moves landed: (a) top-of-left **World**
> folder consolidating the preset picker + derived archetype label + filter/solo (kills the
> selector-vs-indicator dup); (b) dedicated **bioMats(F46)/cityLights(F48)** right-panel folders (sliders
> moved out of shared Envelope; `cityLightsEnabled` literal preserved); (c) `applyArchetypeFilter()`
> now **reparents** feature folders — relevant → their category in declaration order, irrelevant → one
> collapsed **"Not relevant to this world (N)"** group (filter ON default; force-enable still 1 click away).
> Spec/plan: `docs/superpowers/{specs,plans}/2026-06-15-lod-lab-menu-declutter*`. **Remaining in the
> per-feature quality pass (all BEFORE integration):** info-layer asks 2–4 (per-feature info cards →
> archetype info view → live render-audit surfacing, each its own brainstorm→spec→plan) + the
> render-correctness residuals folded in from (3) above (Carbon/Crystal mountains, faint craters
> Ocean/Europa, shatter/hexTess exotic leak). Substrate: `relevantFeatureSet()`/`applyArchetypeFilter()`.
> **Commits `6214510`/`3424ef7`/`fc30eb1`/`9aebb53`/`b198057` are LOCAL — push pending Max + his UAT.**
> Planning handoff for the remaining asks: `/tmp/handoff-lod-menu-overhaul-PLANNING-NEXT-2026-06-15.md`.
> (5) **Parking-lot:** "outpost worlds" feature idea (Mars/Venus-type sparse nightside outpost lights,
> distinct from ecumenopolis/cities) — capture as a NEW campaign feature (dossier card + heavy loop), NOT inline.
> (6) **PLANNING SESSION 2026-06-15 (cont.) — all 4 remaining quality-pass items SPEC'd + PLANNED, ready for
> Max to greenlight execution (each brainstormed→spec→plan w/ Max; specs/plans LOCAL, UNPUSHED):**
> - **Ask 2 — per-feature info cards** (rich card derived from planet-visual-features.md at build time via a
>   generator + drift guard; inline ⓘ in each feature folder). spec `73bb42d`, plan `fef95fe`.
>   **SHIPPED 2026-06-15 — VERIFIED_PENDING_MAX `b30f811`** (6 commits `ec9f0f4`→`261ca9d`, LOCAL/unpushed):
>   generator `scripts/gen-feature-cards.mjs` + `planet-feature-cards.generated.js` (46/47 cards; clouds(F31)
>   structured-only); unit test pins parser+F#→key join; `npm run gen-feature-cards`; inline ⓘ card per feature
>   folder (prose+driven/renders/state, plain DOM, no core/shader change); doc-rot drift guard (also fixed a
>   pre-existing Check-7 `set -e` abort). Live-verified on :9223 (all 5 spec criteria + multi-open). 3 plan-pinned
>   suites green (planet-archetypes incl. cityLights pin, feature-associations, gen-feature-cards); pre-existing
>   17-file vitest baseline unchanged. Asks 3–4 + Thread B remain.
> - **Ask 3 — archetype info view** (inline ⓘ on the World-folder archetype label; runtime-derived roster of
>   what the world should exhibit + per-feature state; no generator). spec `abf3d56`+`e4bff7f`, plan `002b033`.
>   **SHIPPED 2026-06-15 — VERIFIED_PENDING_MAX `a6b4950`** (3 commits `a44a762`→`a6b4950`, LOCAL/unpushed):
>   `archetypeInfoHtml()` renderer + `.archetype-info` CSS (Task 1); ⓘ on the disabled archetype field row +
>   plain-DOM block injected under it, collapsed by default (Task 2); live-update — enable toggle refreshes
>   dots+K, preset change re-derives via `applyArchetypeFilter()` tail hook (Task 3). Plain DOM, no
>   core/shader change → cannot regress rendering. Reconciled cleanly with Ask 2 (merged single-slot
>   onChange so card-State AND archetype-info both refresh; reused existing `escapeHtml`/`.title-info`). Lab
>   *tooling*, not a game feature (charter: lab≠game). Live-verified on :9223 (all 5 spec criteria: Venus
>   2-arch/mountains-under-both/M-counts-once, Gas-giant 1-arch, toggle flips dot+K w/ N/M held, preset
>   re-derive matches label, collapsed-default); Ask 2 card-State non-regression confirmed (●↔○ flips). 2
>   plan-pinned suites green (planet-archetypes incl. cityLights pin #16, feature-associations); pre-existing
>   17-file vitest baseline unchanged. Ask 4 + Thread B remain.
> - **Thread B — render-correctness residuals** (per-feature relevance hard-gate for shatter/hexTess + targeted
>   Carbon/Crystal knockdown for mountains; carbon/facets already honest; faint Ocean/Europa craters ACCEPTED
>   doc-only; lab-level only, ZERO core touches; gets Max UAT). spec `09ff72a`→`e339b9f`, plan `473ac8d`.
>   **SHIPPED 2026-06-15 — VERIFIED_PENDING_MAX `27d8b8e`** (4 commits `340e2ae`→`ccbdaf5`, LOCAL/unpushed):
>   `applyDrivers()` derives `state.featureRelevant.{shatter,hexTess}` from `ASSOCIATIONS[key].rendersOn` (honors
>   hexTess's `rendersOnDivergent` Frozen membership — the raw `relevantFeatureSet().set` does NOT) +
>   `state.isExoticCarbonOrGeometric`, both 1.0/0.0 (habGate idiom); three one-line `×=` writer multiplies
>   (`uShatStrength`/`uHexStrength` × relevance, `uMountainAmp` × `(1−exoticCG)`). Lab-level only, NO core/shader
>   change, NO manifest edit. Lab *tooling* (charter: lab≠game). Live-verified on :9223 via direct uniform probe
>   (writer outputs): Rocky force-enable shat/hex → `uShat=uHex=0` (gate beats enable); Frozen member → `=1`
>   (byte-identical); Carbon/Crystal `uMountainAmp=0` while derivedAmp>0; Rocky `uMountainAmp=0.46=derivedAmp`
>   (member unchanged). Europa mountains-preview asymmetry held. D2 canary `frozen.hexRel===1`. 2 plan-pinned
>   suites green (feature-associations incl. rendersOn⊆archetype-union+divergent exemption — proves no manifest
>   drift; planet-archetypes incl. cityLights pin #16); pre-existing 17-file vitest baseline unchanged.
>   **Render-audit Δ re-run NOT used (CONCERN):** a fresh `?fresh=1` sweep measures at ~60–100× smaller pixel-
>   fraction scale than the committed `248b355` sweep (untouched features clouds/canyons/craters collapsed
>   identically) → not apples-to-apples; the committed report (`248b355`, 64/51) was left as-is. The uniform-level
>   live probe is the integration proof instead. Ask 4 should re-baseline the audit under a captured sweep config.
>   Max UAT remains.
> - **Ask 4 — live render-audit surfacing** ("Audit this world" button → live current-preset sweep → existing
>   pure auditor → per-feature glyph badges + World summary; auto-stale-on-edit; shared EPS/STRONG via new
>   pure lab-render-status.js imported by lab AND gen-render-audit.mjs). spec `5c20886`→`dd733ce`, plan `d3282de`.
>   **SHIPPED 2026-06-15 — VERIFIED_PENDING_MAX `5679e8d`** (6 commits `a22a1fc`→`5679e8d`, LOCAL/unpushed):
>   pure `lab-render-status.js` (`statusOf` + EPS=1e-4/STRONG=5e-4, ⬛-degen-wins, 10-assert unit test);
>   `gen-render-audit.mjs` imports those consts → report re-gens byte-identical (64/51, `git diff --exit-code`
>   clean); lab `runAudit()` runs `renderDeltaSweep()` for current preset, classifies 47 features (eps passed
>   EXPLICITLY — not the 0.01 default), writes `state.audit`; World-folder button + summary ("N false · M dead ·
>   ✓ fresh|⚠ stale"); plain-DOM glyph badge per feature title bar; two global `gui.onChange` hooks auto-stale on
>   any edit, guarded by `_auditing` so the sweep can't self-stale. **NO core/shader change** (`planet-lod-lab-core.js`
>   untouched; `git diff ba972d5..HEAD` = 4 files only). Lab *tooling* (charter: lab≠game — no Max-UAT gate required,
>   but live :9223 verify mandatory + done). Live-verified on :9223 (state/DOM, not images): self-stale guard
>   (`fresh===true` right after audit), badges===state cell-for-cell, stale-on-edit + re-audit-restores-fresh +
>   preset-switch-stales (via real dropdown), `machine`-on-Ocean force-irrelevant → `🔴F` (delta 0.0053). Cross-check
>   vs committed report: strong-signal home-preset cells agree (Rocky 9/10); `shatter`/`hexTess` Venus 🔴F→· =
>   EXPECTED Thread-B fix showing through (delta exactly 0); eps-knife-edge faint features diverge per the known
>   fresh-sweep scale issue (same as Thread B's CONCERN above), NOT an eps bug (canyons@1.3e-4→✅ proves eps=1e-4
>   reaches statusOf). 4 plan-pinned suites green (render-status, render-audit, feature-associations,
>   planet-archetypes incl. cityLights pin); pre-existing 17-file galaxy/vendor baseline unchanged. Max UAT optional.
> Recommended execution order (Max's earlier pick): **Ask 2 → Ask 3 → Thread B → Ask 4** (Ask 4 last so the
> surfaced audit reflects Thread B's fixes; Asks 2/3/4 are GUI-independent of each other and of Thread B).
> Execution-ready handoff: `/tmp/handoff-lod-quality-pass-EXECUTE-READY-2026-06-15.md`. **Still pending: Max UAT
> of Phase-1 declutter + push authorization for ALL local commits (declutter + these 8 spec/plan docs).**
>
> **▶ SESSION 2026-06-15 (cont. — audit re-baseline + F38 airglow; both PUSHED `369ec02..35efaa7`):**
> (1) **Render-audit re-baseline — DONE `b0e980f`.** Root-caused the fresh-sweep-vs-committed scale
> mismatch (the prior session's CONCERN): `renderDeltaSweep()` measures `changedPixels/frameTotal`, which
> scales with planet coverage (∝1/distance²), and never pinned `state.distance` — the committed
> `.sweep-raw.json` was captured at distance≈**2.6**, fresh sweeps at default 20 read ~64–100× smaller.
> Fix: pinned `SWEEP_DISTANCE=2.6` (save/restore) inside `renderDeltaSweep()` → offline report AND live
> Ask-4 badges now capture at one scale by construction. Re-baselined raw+report: **dead 51=51, false
> 64→40** (the −24 = Thread B's hexTess/shatter + mountains×Carbon/Crystal finally clearing to `·`); live
> badges == offline report 0/94. Lab tooling, no core touch.
> (2) **F38 airglow BUILT — VERIFIED_PENDING_MAX `35efaa7`** (campaign Phase-4c heavy loop, full
> card→implement→review→live-A/B, all subagent-driven). Thin uniform night-limb emissive band, all
> latitudes (not polar), airglow-green, emissive-bypass channel, gated on atmosphere (not field); distinct
> from F37/F34/F33. Card `docs/FEATURES/cards/F38-airglow.md` (§7 verdict + 3 taste-forks for Max's lap).
> Code-review fixes: Mars+Titan→rendersOn (real airglow, in archetype union), floor 0.30→0.12 (honest
> density ramp Venus 0.70>Earth 0.40>Mars 0.12; airless=0). 8/8 ACs green live; enforced suites 36/36; no
> core touch. **Pending Max: F38 UAT + its taste-forks.**
> (3) **F39 cloud-optics BUILT — VERIFIED_PENDING_MAX `9fb6f6c`** (campaign Phase-4c heavy loop, Max out of
> loop; full card→implement→code-review APPROVE→live-A/B, all subagent-driven). Backscatter GLORY: discrete
> 2–3 colour-banded concentric rings at the antisolar point (`dot(V,uLightDir)≈1`) on the LIT cloud deck,
> riding the F31 deck (dependsOn/isolationKit clouds; `solo('cloudOptics')` re-enables the deck — F36
> sunglint→lakes precedent). Flagged the WORST envelope-fit + a strong park candidate — it **beat the
> envelope** by leaning INTO discreteness (3 hard floor() colour-step bands on the emissive-bypass channel,
> never double-quantized). Carriers terrestrial/ocean/venus (Venus brightest). Live A/B (GPU :9223, objective
> pixel reads): all 8 ACs green — antisolar 3-band read at d15, distinct hues survive the envelope, cloud +
> dayside gates clean, off⇒vec3(0) deterministic, Venus brightest, antisolar-locked (vanishes 25° off-axis).
> `PROV_CLOUDOPTICS=47`; enforced suites 36/36; backtick parity even; NO core touch. Card
> `docs/FEATURES/cards/F39-cloud-optics.md` (§7 verdict + 3 taste-forks for Max's lap: d4/bright-Venus
> inner-blue clip→2-band read, stylized-large uGloryRadius=0.06, rainbow-42°-arc cut to v1). **Max UAT
> verdict (2026-06-15): DISABLED BY DEFAULT — taste-call** (read as a "bullseye"; too hi-fidelity for the
> lo-fi aesthetic). `cloudOpticsEnabled` default flipped true→false (opt-in via GUI, like city-lights/machine
> after Phase-1 declutter); code/registry/verification all retained, parked-as-built. **Commits `9fb6f6c` +
> `235fc53` PUSHED** (`52e3e7b..235fc53`).
> (4) **BUILD CAMPAIGN COMPLETE** — F38+F39 were the last two unbuilt features; Phase 4c build is done. **Next
> phase = finish the render-correctness residuals BEFORE Integration (Phase 5).** Max's chosen next-session
> plan (2026-06-15): **(Step 1)** run the systematic render-correctness audit via the "Audit this world" tool
> (Ask 4) → full residual punch-list → triage manifest-wrong vs feature-buggy → fix the clear bugs in the lab,
> surface taste-y ones to Max; **(Step 2)** then a guided tour of the menu/info tooling (Asks 2/3/4) for Max's
> UAT. Handoff (full project frame): **`/tmp/handoff-lod-render-correctness-audit-2026-06-15.md`**.
> **⚠ Known artifact Max spotted (queued for Step 1):** F34 limb glow renders "two rings OUTSIDE the planet" =
> the F31e companion shell (detached double-arc ~1.15R on Titan/Venus/Sub-Neptune). Root-caused + fix-options
> logged in `docs/FEATURES/cards/F34-limb-glow.md` §7 — it's a taste call (retune/gate/disable the shell).
> (5) **Still pending Max UAT (carried):** F38 airglow + its 3 taste-forks; Phase-1 declutter + Thread B + Asks
> 2/3/4 (the menu/info tooling — covered by Step 2's tour).
>
> **▶ SESSION 2026-06-15 (cont. — render-correctness TERRAIN punch-list CLEARED, 40→18):** Triaged the audit's
> 40 false-renders; the terrain cluster was mostly the manifest being too narrow, not driver bugs. **5 commits,
> master, LOCAL/unpushed, all uniform+live verified on :9223, NO core touch, 36/36 gate:** `fd45f36` manifest
> broadenings (edifices/sublimation/glacial/frost/machine + canyons/scarps/plateaus+Lava; technogenic archetype
> broadened, kept distinct from F48/F49); `8937387` **craters driven by climate/age** (one `_craterWeathering`
> from atmosphere-pressure+erosion+resurfacing → density/amp/relaxation; Frozen sharp/numerous ↔ Rocky/Venus
> eroded — first instance of Max's recurring ask = a SYSTEM for per-planet-type variable tuning); `e2d167a`
> relief writers hard-gated to rendersOn (Thread B `featureRelevant` idiom → mountains/scarps/plateaus/canyons/
> tessera, icy+exotic leaks → 0); `33a253f` crater/ejecta residual (broaden natural-solid, gate exotic Carbon/
> Crystal); `73a8d5f` **re-baseline** (fresh 17-preset GPU sweep → false 40→18, dead 51→54, degen 0). Holistic
> live confirm on the 3 worst worlds (Europa/Magma/Crystal): terrain leaks gone, only legit members render.
> **Remaining 18 are a NEW smaller set** the fresh sweep surfaced (now 49 features vs 45): 11× airglow/cloudOptics
> on giants/SubN (= F38/F39 UAT; cloudOptics default-OFF), faint Mars leaks (glacial/machine/polarVortex ~0.005),
> lightning@Titan (low-conf, don't chase). **Next session (Max drives, tour-first):** STEP 1 info-tooling tour
> (Asks 2/3/4 UAT on :9223) → STEP 2 second cleanup round on the 18 (+ glacial@Mars quick broaden). Full frame +
> standing cautions: **`/tmp/handoff-lod-tour-and-cleanup-2026-06-15.md`**. All today's commits + prior info-tool
> backlog = LOCAL/unpushed, push pending Max.

> **▶ SESSION 2026-06-15 (cont. — F38/F39 taste-calls + STEP-2 cleanup DONE, both PUSHED; new backlog parked):**
> Gathered Max's F38/F39 taste-calls, then cleared STEP 2 (the 18 false-renders → **2**). **`6d4b2fa` (pushed):**
> Thread-B `featureRelevant` gate extended to airglow (off gas-giants/SubN — green OI is terrestrial; giants'
> airglow is UV, unmodeled), cloudOptics (→ declared Rocky/Ocean/Venus only; dormant, default-OFF), machine@Mars
> + polarVortex@Mars (off — enforce declared intent); glacial broadened rendersOn += Mars (real lobate-debris
> glaciers; ⊆-union held). 16 fixed + verified (uniform reads, exact 0; 36/36 gate; backtick parity 122). Full
> re-baseline sweep: false 18→2 = lightning@Titan (deliberate don't-chase) + magma@Ocean (**sweep artifact** —
> re-measures 0.0, a Lava→Ocean transition state-bleed, zero magma code touched); dead 54→63 = floor-flicker on
> already-declared presets, not these edits. **`64474f9` (pushed):** F38 card §7 UAT verdict — (a) Mars/Titan KEEP,
> (b) faint-Mars 0.12 ACCEPTED (Max live: "looks good", intended-subtle), (c) flat green KEEP. Ask-4 "Audit this
> world" demoed — Max confirmed **0-false** on Rocky/Ocean/Neptune. **Tour (STEP 1) + cleanup (STEP 2) both
> complete.** ⭐ **NEW: Max parked a 14-item lab visual-quality backlog → `docs/FEATURES/lod-lab-quality-backlog.md`
> (his words, untriaged).** Next session OPENS with the **order-of-attack** decision (Claude flagged 2 candidate
> roots: a shared cell/Worley-noise primitive misapplied across rivers/sublimation/lava/crystal/ecumenopolis/
> canyons; + feature-scale-vs-planet-radius normalization). Handoff: **`/tmp/handoff-lod-step2-done-backlog-parked-2026-06-15.md`**.

Last updated: 2026-06-10 by working-Claude (flash session: **Max's entry flash FIXED `4278037`, VERIFIED_PENDING_MAX.** Root cause was NONE of the handoff's 4 candidates — it predates the swap: `updateTraversal` ran in simStep (60Hz) while the rendered camera interpolates per render frame (240Hz), so the camera crossed Portal A's plane up to ~4 rendered frames before the mode flipped; those frames drew stencil-ON with the disc behind the camera → empty stencil mask → tunnel invisible → ~3 frames (~12ms) of raw origin sky. Proven by in-page per-frame canvas capture frame-aligned with signed plane distance (sky-bright frames == sd<0 ∧ OUTSIDE_A exactly, 2 pre-fix warps). Fix: detection moved to renderFrame after camera interpolation. Post-fix: 3 warps, 0 stale frames (was 3/warp), flat crossing brightness, no AC4/AC10 warnings. Headless 54/54. Prior session's 3 goals all VERIFIED_PENDING_MAX `c85480f`. TEMP `__swapTiming` instrumentation still in main.js — remove before workstream ships. **Pushed + Pages deploy green 2026-06-10. Flash fix UAT-PASSED, belts CONFIRMED, far-opening residual CONFIRMED FINE — Max, post-fix ride. All 3 goals + flash SHIPPED.** Next (Max, 2026-06-10): arrival distance — exit farther from system center so star(s) show as billboards on emergence, consistent with the starfield-version of the star seen from the origin system when warping via starfield targeting (vs nav comp). **ARRIVAL-DISTANCE IMPLEMENTED same day (`4afd58e` `29405f5` `04d3437`, master, unpushed): orbitDist now derived from new `StarFlare.billboardSwitchDistance()` × 1.3 (knob `window._warpArrivalMargin`), both warp paths, binaries take max+sep. Spec/plan in docs/superpowers/{specs,plans}/2026-06-10-warp-arrival-billboard-distance*. 6/6 unit tests; subagent spec+quality reviews clean. **Live verify (Task 3) COMPLETE — ARRIVAL-DISTANCE VERIFIED_PENDING_MAX `04d3437`.** 5 controlled warps all-state-tools (no screenshots, game muted per Max's directives): warp 1 full PASS (prior session), warp 3 starfield emergence PASS w/ in-eval center-raycast + >100px mesh sweep (only sky-dome scenery; NO giant flare — §3 anomaly did NOT reproduce at 2 instrumented emergences, CLOSED as runaway-tour scenery), LOD crossover observed BOTH directions (disc 3186–3408 / billboard ≥3631, brackets switchDist ≈ emergence/1.3), nav-comp path PASS via real AutopilotNavSequence (overlay→commit→dispatch→arrival), binary (M+M, seed 175217743) BOTH stars `bbVis=true, discVis=false` at emergence incl. the dim-companion +sep worst case, large-orbitDist arrival ~4.9k units clean. Note: dist-at-idle-detection jitters around orbitDist (coast before / fly-in after the idle flip) — invariant is billboard-range emergence, held every observation. Console: only the known pre-existing travel-telemetry oscillation warning; no AC4/AC5. Fresh: 6/6 unit, build clean. Seed-targeted nav-data warps work from console (replicate `_setWarpTargetFromNavStar` field writes on `window._warpTarget` + `_beginWarpTurn`). **Max UAT next: ride starfield + nav-comp warp, tune `window._warpArrivalMargin` (default 1.3, read per-warp) — confirmed value gets baked. Then remove TEMP `__swapTiming` + push on Max's word.**

---

## Active workstream

> **▶▶ BARYCENTRE RENDER — ✅ SHIPPED + UAT-PASSED 2026-08-19.** Max: *"Looks like it's working."*
> ⛔ **ORBIT-LINE LOCAL-SYSTEM OCCLUSION — REVERTED `baa4935`. Max rejected the PREMISE, not the build.**
> *"we should just have the larger orbit intersect with the barycenter; I don't think having those
> smaller orbits occlude it actually works."* Every AC passed and the mechanism measured working live;
> the idea failed. The renderer is byte-identical to `e0b6fa8` again. Record kept and marked
> `withdrawn`: `intent.md`, `implementation-plan.md`, `live-integration-evidence.md`, `contract.json`.
> ⭐ Two things there outlive the feature — the FOUR real AC defects the design pass found, and the
> warning that the tempting `ring.radius > disc.radius` fail-safe silently disarms the assertion
> protecting the pair's inner ring.
>
> ⛔⛔ **PAUSED AT A CLEAN SEAM 2026-08-19. ▶ THE LANE CHOICE IS MAX'S AND IT IS OPEN.**
> ▶▶ **START HERE: `docs/FEATURES/handoff-2026-08-19-lane-choice.md`.**
> Max: *"I want to drive to getting all the world engine rendering into the main welldipper game."*
> That is `lab-pipeline-into-game-PLAN.md` (6 layers, layer 2 done, layer 0 underneath everything) —
> a DIFFERENT lane from B5, which advances none of it. ⭐ **Zero B5 steps have been cut**, so the
> pivot is free now and expensive after step 1. *Rec: pivot, starting at layer 0 — it also makes the
> B5 window safer to open later.*
> B5's plan of record if it resumes: `docs/FEATURES/moon-formation-b5-build-plan-2026-08-19.md`.
> ⛔ Historical below — kept because the HMR lesson in it is the most expensive one this lane learned.
> ⭐ Full state + next action: `docs/FEATURES/moon-formation-handoff-2026-08-18-b5.md` **§11**.
> ⛔ **RELOAD THE PAGE BEFORE ANY BROWSER MEASUREMENT** — HMR-duplicated module state faked a
> constant 0.779424x moon-orbit error that cost three commits and a 13-agent workflow. §11 leads with it.
> ▶ NEXT: **queue item 2 (orbit-line occlusion), building**; then Sol, as a workflow.
> ⭐ Max also ruled the two item-2 behaviours flagged for him — the gap persisting when the camera is
> INSIDE a local system, and the far arc still drawing down a ring's tangent: *"Looks good also.
> We can proceed."* Both stand as designed; no pop-on-boundary, no screen-space silhouette clause.
>
> ### 2026-08-19 — the re-look is SET UP, and the HMR diagnosis is CONFIRMED by measurement
> Page reloaded clean, wd-10 planet 3 framed sunward, orbits on. Re-measured in a fresh session:
> `r1 = 5.5332` R_p, `r2 = 19.5492`, **both bodies on their rings at ratio 1.000000**, out-of-plane
> −5e-8, `cos∠ = −1`, 16/16 ring proxies. ⭐ **Max's UAT item 1 — "one of the planets is not riding
> along its orbit line" — DOES NOT REPRODUCE.** The §11 HMR-artifact diagnosis holds. His subjective
> read is still the gate; the numbers only retire the objective half.
>
> ### 2026-08-19 — queue item 2 is PLANNED, not started (`971eb7a`)
> `docs/WORKSTREAMS/orbit-line-local-system-occlusion-2026-08-18/implementation-plan.md` — 13-agent
> read-only design pass, then working-Claude re-opened every load-bearing line. **World-space ball**
> keep-out tested against the circle point `arcRoot` already builds, packed into 8 new rows of the
> **existing** DataTexture; predicate = same-local-system exemption + 3-D containment, **no radius
> comparison**. Zero `src/main.js` edits. Predicate measured against wd-10's real ring set before any
> code: 1 of 14 foreign rings masked (the right one, `gap² = 0`), nearest false positive off by ~3e6.
> The pass also found **four real defects in the contract**, all corrected — including an AC clause
> naming an asteroid-belt ring that cannot exist, and an observable that passed with or without the
> feature. ⛔ **Code waits on the UAT re-look**: an `src` edit fires HMR into the page Max is judging.
> `docs/WORKSTREAMS/binary-barycentre-render-2026-08-18/` (`intent.md` + `contract.json`, 8 ACs, scoped at `ea2681e`).
> Queue item 1 of the moon-formation lane — see `docs/FEATURES/moon-formation-handoff-2026-08-18-b5.md` §10.
> **Why:** B5.0's binary companion generated correctly and then **failed UAT on the first pair, first look** —
> Max: *"planet with a big moon because the orbit lines center one planet in orbit around the other rather than
> both around a shared empty gravitational center."* The primary is pinned to its orbital point; the reflex
> wobble is the whole read.
> **Max's rulings this session:** (1) the barycentre term applies to **every moon, no mass-ratio cutoff** —
> so it also corrects 16 existing pairs whose barycentre is already outside the primary and visibly moves 111
> more, across 90 of 221 systems; (2) **ring topology branch kept** — barycentric rings where one moon
> dominates (all 27 companions at share ≥ 0.99), planet-following rings on the 16 epicyclic planets, so no body
> is ever drawn off its own line; (3) **naming closed** — largest body holds the primary designation, measured
> already true for 97/97 companions.
> ⛔ The moon-formation window's instruments are **RED BY DESIGN**; `AC-ZERO-GENERATION-DRIFT` pins this change
> to *bit-identical* generation output rather than to green. B7 is what re-blesses.
> **Journey/tier:** serves the procedural-worlds milestone; PLAYER_EXPERIENCE tier — what you see out the canopy.

> **▶▶ RADIUS LIVE FEED (R1) — ✅ SHIPPED 2026-07-28. Max re-UAT PASSED: _"okay, passes"_.**
> Re-UAT ran on the new **"hold apparent size (radius read)"** toggle; the headline promise — drag radius, see the
> banding answer — is delivered. **Two Max observations raised at the same moment, both FILED not folded:**
> ⚠ **(a) His hypothesis for the composite gap**, verbatim: _"i do suspect that many of these legacy shader systems are
> not fully wired up into our proc gen model though, based on what you're saying about the band channel."_ Concrete
> anchor already in the lab: the WE panel's provenance line reads **"relief: LEGACY synth (carrier off)"** whenever
> `carrierOn` is false (`planet-lod-lab.html:4294` — needs `reliefBakeStrength > 0` AND `heightSource === 'carrier'`).
> → routed to the **R2 scope** and the **38-finding triage** as a named question.
> ⚠ **(b) Parking-lot item — tectonics turns to noise past a certain radius.** ROOT CAUSE FOUND FROM SOURCE (derived,
> unmeasured): `bakeReliefCrossover(sVis) = 1 − smoothstep(0, 1.0, |log2 sVis|)` fades the **baked** relief to zero as
> the disc departs `sVis=1`; with `sVis=√R` that is **half gone at R=2, entirely gone at R≥4**. On Rocky/Earthlike the
> baked cube is exactly where the plate-Voronoi tectonics lives; `fbmd` replacing it is generic fBm. Disclosed tradeoff
> of radius-display-scale ("continent CHARACTER, not size"), but never weighed against tectonics needing to *express*.
> Max's ordering note is the diagnosis: **tectonics predates the radius system.** Filed to the campaign-tracker
> parking-lot with the scope question. *(prior: the close-out that produced the pass — ★ VERIFIED_PENDING_MAX on a
> RE-SPECIFIED AC-BANDS.)*
> No code changed since `6d120c4` — what changed is that the AC had been closed on the **wrong quantity**.
> **The dead-zone suspect is KILLED** (`evidence/G4-rendered-belt-count.md`): the RENDERED belt count *does* rise with
> radius, 4→12 on Jovian across R=2–16, fitted **R^0.532 ± 0.029** (n=7, dof=5, t95=2.571, r²=0.986) — PASS vs the Rhines
> 0.5 and separable from null. The real mechanism is an **exponent collision**: Rhines ∝ R^0.5 *and* the lab display scale
> `visScaleOf` ∝ R^0.5 (`VIS_SCALE_EXP=0.5`), so at a fixed camera on-screen band **density is invariant** (+0.031 ± 0.029
> ≈ 0) while the roughness Max *did* see rides `uBandCount` ∝ R^1.0 (+0.361 ± 0.040). Those two fits are the two halves of
> his sentence. **Lab-only — the game has no stake:** zero `visScaleOf`/`VIS_SCALE_EXP` in `src/`, nothing in `src/`
> consumes `aBand`/`HEIGHT_GLSL`, and the game bands from hard-coded literals (`src/objects/Planet.js:256`).
> ⭐ **Max accepted the disposition ("that seems fine to me"): do NOT retune `VIS_SCALE_EXP`; judge band count at PINNED
> ANGULAR SIZE.** AC-BANDS re-specified accordingly (`contract.json → amendments[]`).
> **Close-out re-measurement (in-page at HEAD, isolated context, page closed after):** disc held at constant apparent
> size, Jovian seed 1 jets ON, spin frozen — the rendered band channel goes **3.03 → 6.01 cycles** across the disc for
> R=4→16 by an **amplitude-independent spectral estimator** (planted-defect control passed first). Ratio 1.983 over a 4×
> radius change = **R^0.494** — the Rhines exponent, reproduced by a method sharing nothing with the 7-point fit.
> ⭐ **SHIPPED THE UAT AFFORDANCE, not a console paste** (`feedback_uat-keybind-design`): new **"hold apparent size
> (radius read)"** checkbox in the Drivers folder under the radius readouts. OFF by default, `frame()`-only, pure camera —
> it preserves the LOGICAL distance `distance/sVis`, so **wheel zoom stays fully live**. Pure helper
> `holdApparentDistance` in `planet-lod-lab-core.js`; `tests/hold-apparent-size.test.js` (incl. a planted no-op control).
> ⭐ **RE-UAT RECIPE:** lab :5175 → **Drivers → tick "hold apparent size (radius read)"** → **Gas giant (Jovian) or
> (Saturnian) ONLY** → **JETS ON** → hold seed → drag "planet radius (log)", pausing for the **220 ms** debounce.
> **Without the toggle the effect is invisible by construction — that is the finding, not a workaround.**
> ⚠ Carve-outs: form size is held constant on screen *by design*; contrast also rises, so part of the change may read as
> "bands got more legible" rather than purely "more bands".
> ❌ **WITHDRAWN (was committed in `0b9f133`, corrected same session):** a framebuffer claim of "11→15 runs (+36%)". It
> was a hand-rolled single-strip run count — **amplitude-confounded** (run counting is not a frequency measure) and
> longitude-sensitive (the lab auto-spins). Repeats of the same state gave 13→14; the 9-strip mean went the *other* way.
> The F31-haze hypothesis it supported is dead too (dressing OFF changes nothing: 5.85→5.23 vs 5.92→5.24).
> ⚠ **OPEN, stated not resolved:** that same estimator on screenshot *pixels* does not reproduce the doubling at the
> high-R end (3→4 cycles) while the in-page band channel does — at R=4 they agree exactly. Cause unadjudicated (lighting /
> F25 jets ∝R¹ / Bayer posterize / foreshortening). No claim either way; it is named in AC-UAT so Max's eye judges it.
> 🔴 **PROCESS LESSONS (both promoted):** (1) a visible-read AC must close on the RENDERED quantity under a stated
> viewing condition — `bandCount` (diagnostic) ≠ `rhinesWavenumber` (law) ≠ RENDERED belt count →
> `memory/feedback_measure-the-quantity-the-user-sees.md`. (2) **Use the built instrument, don't hand-roll one beside it**
> (Max: *"didn't we put controls in place that can mathmatically read what's being rendered? You visually verifying stuff
> is usually inefficient"*) → `memory/feedback_use-the-built-instrument-not-a-hand-rolled-one.md`.
> **What stands (keep):** frozen-feed fix + fence; the CLASSIFIER-reads-canonical / PHYSICS-INPUT-reads-drawn rule + 2
> allowlisted sites; 85 tests w/ planted-defect controls; the ice-giant aurora regression caught+prevented; 4 durable
> findings (uBandCount NOT retired; river population radius-blind; rivers = on-screen-constancy frame; crater boot R-stable).
> **▶ QUEUE (Max's order, unchanged):** (1) **triage the 38 capped-unverified review findings BEFORE features** —
> `docs/WORKSTREAMS/nonvisual-analysis-channel-2026-07-24/evidence/review-2026-07-25-adversarial-findings.json`;
> (2) **R2 — the missing couplings** (scope artifact = `RADIUS-CENSUS.md`); (3) **vertical km calibration**.
>
> *(build detail, still accurate)* **RADIUS LIVE FEED — objective ACs green `6d120c4`.**
> Scoped `710f8a2` off the radius census (Max's ruling: SPLIT R1 feed-fix / R2 couplings; UAT bar =
> "visible where it can be, measured where it can't"). Built via workflow wf_fa5b81cb-be8 (8 opus agents:
> 3 ground-truth → rewire → 3 adversarial lenses → fix round). **Six frozen sites adjudicated, not
> uniformly rewired:** four now read the drawn radius (Rhines band driver, storm/vortex driver, F25 jet
> ladder, cloud-regime gate); **two read canonical on measured proof** (crater boot-enable; giant dynamo).
> **RULE ADOPTED: a CLASSIFIER reads canonical; a PHYSICS INPUT reads drawn.**
> ⚠ **AC-REGIME AMENDED mid-build** (audit trail in `contract.json → amendments[]`): rewiring the dynamo
> gate was a DEFECT all three lenses caught. `PRESET_ARCHETYPE` deliberately maps Neptunian and
> Sub-Neptune to the same `'sub-neptune'` key and `drawPresetRadius` keys its PRNG on `'draw:radius:'+seed`
> with NO preset name ⇒ **bit-identical drawn radii at every seed (2001/2001)**, so a size-keyed
> discriminator provably cannot separate them — and it EXTINGUISHED the ice giant's aurora (0.6→0.0,
> strict `>` guard against magneticField exactly 0.05) on **67.5% of seeds incl. the shipped default**.
> Live evidence (`evidence/LIVE-ACS.md`, isolated context, page closed): **AC-BANDS** Jovian band count
> **5 → 14** across R 3→16 at fixed seed (r² 0.991), previously constant — and the *law* audits at
> exponent **0.500000** unrounded (0.49647 ± 0.00925 as shipped, dof 38). ⚠ `bandCount` (zero-crossing
> diagnostic, R^0.632) ≠ `rhinesWavenumber` (the law, √a) — conflating them nearly produced a false
> law-failure verdict. **AC-REGIME** cloud regime flips exactly once in [5.848, 6.510] (threshold 6);
> Neptunian aurora constant 0.6 and Sub-Neptune 0.1 across R 1→16 — invariant AND still separated.
> **AC-RIVERS** width law measured live at **−1.00003 ± 0.00058** (r² 0.999997), frame = on-screen
> constancy; **NEW: river POPULATION is radius-blind** (channelCount 5215 flat across 9.6× R, LOD steps)
> — same class as volcanism → R2. Gates: golden `40c18aad` unchanged NO re-capture; full suite
> **4 failed / 2533 passed** = 2452 exact baseline + 85 new tests, every one with a stated pass/fail
> criterion and planted-defect control. **UAT recipe: lab :5175 → Jovian or Saturnian (the two with
> leverage; Neptunian/Sub-Neptune/HotJ sit at the clamp floor) → JETS ON (else zero visible difference)
> → drag radius. Judge band COUNT and arrangement, NOT form size — the display keying holds that
> constant by your own ratification.** Adjudicable: if you want the dynamo to answer the slider, the
> honest route is R2's composition-aware model, not re-pointing the size proxy.
> ⚠ **`uBandCount` is NOT retired** (the 2026-07-20 entry below says it is). It still drives the F25
> jet/shear/festoon geometry behind `uJetStrength > 0`; only the band-VALUE consumer was retired.
> R2 (unscoped): volcanism population, 5 radius-blind tectonics modules, river population, composition-
> aware dynamo. Then vertical km calibration (Max's stated item 2).

<details><summary>Prior active entry — non-visual analysis channel (kept as record)</summary>

> **▶ NON-VISUAL ANALYSIS CHANNEL — instrument build, 4/10 ACs green (2026-07-24, `70f2829`, NOT pushed).**
> Max's directive: "a way other than visual for you to be able to analyse what's happening in the lab."
> Research + proposal → scoped (`dev-collab-scope`) → building. **AC-0 / AC-MATH / AC-SAMPLE / AC-CURVE
> green**; AC-POSCTRL, AC-REGRESS, AC-LAWS, AC-DIAG, AC-REAL, AC-CENSUS remain; AC-TRUST is Max's UAT.
> New read-only instrument at `src/worldengine/instrument/` (descriptors, stats with three-valued
> PASS/FAIL/**UNRESOLVABLE** verdicts, sampling geometry, float-RTT field readback, sweep orchestration),
> lab API `_lab.sampleField / fieldProbe / responseCurve / planSweep`, 84 tests.
> **Banked results:** form-wavelength noise floor **8.8%** vs the retired band-width instrument's
> 24.8–47.4%; radius response measured with error bars — physical form size **+0.458 ± 0.015**,
> on-screen **−0.042 ± 0.015** (Max's "planet bigger, forms same size" is true in the screen frame,
> false in physical km where forms grow ≈√R). **Two findings that constrain future work:** the lab has
> NO vertical km calibration (relief is shaded not displaced; vertical reports height-units — a named
> follow-on workstream), and "most energetic spectral bin" is a dead form-size metric on scale-free
> terrain. Artifacts + evidence: `docs/WORKSTREAMS/nonvisual-analysis-channel-2026-07-24/`.
> Handoff: `~/briefings/handoff-lane-A-nonvisual-instrument-2026-07-25.md` (supersedes the 07-24 one).
> **NEXT = AC-POSCTRL** (plant a known defect, prove the audit names it) → AC-LAWS → census.
> Two named follow-on workstreams (Max's calls): vertical km calibration; game-side pipeline telemetry.
> Still open upstream: Max's radius-across-all-systems directive
> (`~/briefings/handoff-lane-A-radius-systems-2026-07-24.md`) — the census is its scope artifact.
> **(2026-07-25: R1 of that directive is built — see the active entry above.)**

</details>

<details><summary>Earlier active entries (kept as record)</summary>

> **▶ WORLD-ENGINE HISTORY PROGRAM — GROUND track, increment #4a (volcanic/magmatism) — `VERIFIED_PENDING_MAX eb18666` (2026-06-30).**
> New `src/worldengine/base/magmatism.js` (`writeMagmatismSphere`): one seeded mantle-plume field → shield edifices + lava-plain flooding + a T_ss-scaled substellar magma basin (F41 iso-angle law); `writeBodyRelief` now 4-way plate→shell→volcanic→despun (plate+shell paths byte-identical). **Live AC10 driven + PASS** (Lava & Magma, seed 1234): heightSource=carrier, regime=volcanic, plume-variance crushes latitude (0.74/0.76 vs 0.0003/0.0001), edifice>plain>basin ordering holds, Magma basin (1.52 rad) strictly wider than Lava (0.42 rad). Headless: 19 files/196 + magma structure 28/28. Artifacts: `docs/WORKSTREAMS/world-engine-magmatism-2026-06-30/` (contract + intent + SLICE-B-mechanism-math + **verdict.json**). **NEXT = Max AC11 UAT** (does Lava/Magma read as distinct volcanic worlds). ⚠ UAT gotcha: the seed-derived magma-basin axis is ~opposite the lab's fixed sun, so the basin defaults to the NIGHT side — a new adjustable world-light control (`_lab.setLightDir(az,el)` + GUI) lets Max rotate the sun onto it. Program SoT: memory `[[well-dipper-world-engine-program]]` + newest `/tmp/handoff-world-engine-*.md`. (#1 shell-relief + #2 plate-driver already VERIFIED_PENDING_MAX/SHIPPED; the WS1/WS2 block below is the 2026-06-24/25 base-step history, kept as record.)
> **#4a UAT (2026-07-01) → next = #4-MULTIPLY.** Max UAT'd: structure right, look reads "crude/too regular" (circular analytic domes; "one giant + arbitrary sizes"). Root-caused vs the spine (naturalism accretes from later causal layers, not cosmetic noise). Recorded 2 un-owned gaps (`816800b`): new ROADMAP increment **#4-MULTIPLY** (E7 driver-response + grain-aligned asymmetry, mirroring #2) + a #7 volcanic-terrain note + "circular dome = skeleton not final" deferrals in the #4a docs. Also shipped an adjustable lab **world-light control** (`a21270f`, Max's request — the seed-placed Magma basin defaults to the night side). **NEXT (fresh session, via workflows): build #4-MULTIPLY** (design skeleton is in the ROADMAP note; mirror #2's byte-identical-at-neutral-ref discipline). Max's #4a AC11 UAT (accept-as-skeleton → ship) is his parallel gate. Handoff: `/tmp/handoff-world-engine-4multiply-2026-07-01.md`.

</details>

**`world-engine` PRODUCTION-L1 PORT — WS1 (L0 plumbing) BUILT + ✅ VERIFIED 2026-06-24
(`05bf668`, branch `feature/world-engine-production-L1`; `master` preserved at `25fe51c`; push HOLD).
→ WS2 (Tier-1 base step) ✅ SHIPPED 2026-06-25 (Max UAT-passed; `b71d3ec`). NEXT (fresh session): WS3 (type-demotion) ∥ WS4 (wire E6→E9) — see the WS2 bullet below.**
First of 4 production-L1 workstreams (lab-only scope locked by Max 2026-06-23; campaign plan
`docs/FEATURES/world-engine-production-L1-plan.md`). WS1 is STRICTLY ADDITIVE: surfaces six real L0
drivers on per-body `planetData` — `age`, `metallicity`, `magneticField` (single-source dynamo),
`eccentricity` (was dead code; data-only; dedicated rng → zero shared-stream draws), `tidalHeating`
(real for moons+planets; surfaced-only, NOT wired into rendering), `systemContext` (flat,
serialization-safe) — with ZERO behavioral change (frozen 23-key additive gate held byte-identical).
Built last session via subagent-driven TDD (7 tasks); contract+intent
`docs/WORKSTREAMS/world-engine-l0-plumbing-2026-06-23/`.
- **This session (2026-06-24): workflow audit → fix → re-verify.** A 6-dimension adversarial audit
  (each finding 3-lens verified) cleared the additive invariant but surfaced ONE real correctness
  defect: `systemContext.resonancePartners` resolved resonance pairs via PRE-cull indices against the
  POST-cull `planets` array → wrong partner/ratio (and dropped culled pairs) in binary+resonant+culled
  systems. Fixed via TDD (object-identity partner resolution; trigger seed `scan-2606`, RED→GREEN,
  independently reproduced; live GPU-runtime confirmed on `:5173`, fps 242). Plus 5 test/comment
  hardening items (AC1 generated-planet tidalHeating pin; moon frozen-baseline additive gate;
  exact-equality assertions; eccSeed comment; nit comment). Committed `05bf668`.
- **✅ verify-workstream at `05bf668`: all 6 ACs PASS** (5 integration + 1 unit, all headless/live=false),
  3/3 adversarial each; additive-gate golden independently confirmed untouched; `uat = N/A` (no UAT AC)
  → WS1 DONE. WS1 suite 33/33; the 4 broader-cluster failures are pre-existing `searchKnownObjects`, untouched.
- **▶ WS2 (Tier-1 base step) — ✅ SHIPPED 2026-06-25 (Max UAT-passed; `b71d3ec`, local-only, NOT pushed).**
  `docs/WORKSTREAMS/world-engine-base-step-2026-06-24/` (intent.md + contract.json [16 ACs] + scoping-dossier.md
  + **verdict.json**). NEW three-free `src/worldengine/base/` tree (8 modules: substrate, mathutil, adaptL0,
  baseStep, tectonic, sphereField, verify, fieldViz) ports the proven `relief-*` formulas; `src/generation/` +
  `relief-*` + `Planet.js` byte-untouched (Option A). Plan `docs/superpowers/plans/2026-06-24-world-engine-base-step.md`.
  Built via: grounding workflow (7 extractors+critic, verbatim code) → plan → **5-critic adversarial plan pass**
  (caught 4 blockers PRE-code: the stress-band-constant cluster — true 38.33/57.69 boundaries + 45° grain flip +
  1.5° seam tol) → **sequential subagent implement→review→fix per task** (11 commits).
  **Gate — verify-workstream (`wf_fbd25257-ca1`, full, 3× adversarial) + targeted F7 re-verify (`wf_e4fab211-129`):
  15/16 ACs PASS, 1 deferred-to-max (AC-VIZ-distinct).** WS2 suite 47/47; lab reference 63/63 (no regression);
  no three.js/Math.random/Date.now in the base tree. F3 reuses the router's `buildIrregularSphere` via a plain-mesh
  DI (three lives only in the test). One gate-caught gap closed: the F7 fixture set now threads the **F2-adapter
  output** (not just the 5 presets) through the determinism+verifier gate.
  **✅ Max UAT (2026-06-25):** each preset reads categorically distinct → AC-VIZ-distinct PASS (16/16 ACs). Two
  deliberate behaviors documented in `KNOWN-BEHAVIORS.md`: (1) same-class worlds share a byte-identical
  `crustalThickness` layout (lava≡magma `-1:sil`, rocky≡terrestrial `1:sil`; 0/16384 cells differ) — regime/grain
  still differ (4608/16384), Max accepted; (2) tidal Io-anchor `TIDAL_LOG_KNEE=1.6` (Io~0.19) confirmed — retune is
  a one-constant change. Both flagged inline in `adaptL0.js` + `baseStep.js`.
  **▶ NEXT (fresh session, Max's seam): WS3 (type→label demotion) ∥ WS4 (wire E6→E9 into the renderer)** — WS4 is
  where the FULL "planet reads as a landscape with a history" UAT lands. Campaign plan `world-engine-production-L1-plan.md`.
- **Open (Max's):** push (HOLD, campaign-wide); whether to merge `feature/world-engine-production-L1`
  → `master` after WS1 (merging triggers the master-only Pages deploy — rec: keep accumulating WS2–4 first).

---

**`world-engine` relief-group slice — BUILT (isolated harness), ✅ Max UAT-PASSED 2026-06-23
(`90b66f7`). Push: HOLD (Max). Branch plan: preserve `master` as-is; production-L1 integration
goes on a DEDICATED branch (this slice is isolated/additive — safe on master as a checkpoint).**
First vertical slice of the co-genesis
**"world-engine" L1 layer** for the planet-LOD lab: the RELIEF GROUP — E6 tectonic
*builds* relief → E9 hydrology *carves* drainage, over 2 epochs sharing ONE mutable
height substrate, fed by a minimal base step. Built in an **isolated harness — NOT
wired into the game or the main planet-lod-lab.** Objective gate is GREEN: **33/33
vitest pass**; the north-star verifier `verifyReliefSlice` returns `pass=true` on
rocky/lava/europa presets across seeds; live GPU (RTX 5080, chrome-devtools `:5173`)
A/B confirmed — epoch-2 OFF shows uncut tectonic relief, epoch-2 ON shows a dendritic
drainage network carved into the SAME relief (`screenshots/relief-slice-A-epoch2-off-uncut.png`,
`screenshots/relief-slice-B-epoch2-on-carved.png`). Validates the 4 wf2-synthesis §9
items: shared-relief-substrate pattern, host-editor/epoch model end-to-end, expose+derive
(Option A) boundary, E9 bake feasibility.
- **New files (all committed at repo root):** `relief-substrate.js`, `relief-base-step.js`,
  `relief-presets.js`, `relief-e6-tectonic.js`, `relief-e9-hydrology.js`, `relief-slice.js`,
  `world-engine-relief-lab.html`, `world-engine-relief-lab.main.js`,
  `tests/world-engine-relief-slice.test.js`.
- **Plan (10 TDD tasks):** `docs/FEATURES/world-engine-relief-slice-plan.md`.
- **Master pickup index:** `docs/FEATURES/world-engine-INDEX.md` (read it first).
- **⚠ SCOPE CAVEATS (do not overclaim):** UAT — "does it read as a landscape with a
  history" — was **MAX'S GATE ALONE** and is now **✅ PASSED (2026-06-23)**; the slice is proven
  in the lab but **NOT pushed and NOT wired into production** (a separate, large effort). Flat 2D
  latitude-band DEM (NOT sphere/cubemap — sphere mapping is deferred
  integration; cubemap-seam lake breakage is a known later hazard). E9 is a CPU bake-time
  reference (GPU FastFlow/Jain-2024 bake deferred). D12 stubbed/derived in the slice's own
  base step (NO edit to the production `PlanetGenerator.js:565` hard-zero). Hack's-law
  exponent (~0.41–0.45) is REPORTED as a quality metric, NOT a pass-gate signal; the gate is
  the 5 resolution-robust core signals (subtractive, carve-correlates-relief, no-uphill,
  depressions-filled, accumulation-spread).
- **▶ NEXT:** Max UAT on the live harness (`world-engine-relief-lab.html`, GPU). If it reads
  right, scope the production **L1 layer** via `dev-collab-scope`.
- **Maps to journey:** the deferred "Phase 2" L1 generative layer the LOD-lab charter names —
  upstream of rendering so features express a shared history, not a bag of toggled effects.

**▶ RELIEF BODY-TYPE DIVERGENCE BUILD — DONE, objective gate GREEN → `VERIFIED_PENDING_MAX`
(harness commit this session; build pre-harness `842b649`). Push: HOLD.** Max's post-UAT ask:
the relief slice should produce **categorically different worlds per body type** (the prior slice
was AMPLITUDE-only by design). Built additively in the same isolated lab across 5 compounding
layers: **L1 regime** (un-damped strain sign flips the Anderson regime mix per body),
**L2 geometry** (regime/sign branches steeredNoise → across- vs along-strike relief),
**L3 seed** (a composition/regime discriminator folds into the crust seed → composition-keyed
LAYOUT; toggleable via `discriminate`), **L4 carve** (liquidStability gates ocean fraction +
fluvial carve — airless≈0, temperate-wet=full network), **L5 terrestrial** (a temperate
liquid-water bundle completing the wet/frozen/airless trio vs europa, lava).
- **DECISIVE GATE redefined → `divergenceReport` in `relief-slice.js`** (exported): a pair PASSES
  iff it diverges on ≥1 ROBUST, RESEED-INVARIANT axis — **regime | hydrology(|liquidStability|) |
  carve** (thresholds 0.2 / 0.3 / 0.05). Reseed-invariant by construction → a reshuffle of the
  same world cannot pass. **The spec's original "decisive gate = held-seed HYPSOMETRIC" did NOT
  hold up** — a 15-seed sweep showed cross-regime hypsometric is seed-fragile (6/15 fail at n=192),
  so hypsometric + directional anisotropy are now REPORTED to corroborate, NOT gated (Task 4.5
  EARLY-EXIT GO + Task 7 redefinition).
- **✅ DONE + Max UAT-PASSED 2026-06-23 (`ef63554`):** 63/63 vitest pass (`tests/world-engine-relief-slice.test.js`) + whole-branch review clean + live integration check (chrome-devtools `:5173`) + **Max UAT "they all read as distinct."**
- **Harness (this session, lab-only):** preset selector now offers `terrestrial` (auto from
  `Object.keys(PRESETS)`); HUD shows the current preset's drivers (dominant regime / liquidStability /
  anisotropy) every render (cheap — read off the current run), plus an **on-demand "divergence vs lava"
  button** that runs `divergenceReport` at n=128 (NOT per-frame). `window._relief.divergence(against,n)`
  exposes it for scripted live checks. **Renderer (buildMesh/displacement/coloring) stays PRESET-BLIND.**
- **New file:** `relief-divergence.js` (the measuring instrument: hypsometric / perCellRMS /
  regimeHistogram / directionalAnisotropy / carveFraction / channelFraction). Build-intent headers
  updated in `relief-slice.js` (non-goal flipped to "now realized"), `relief-presets.js`, `relief-divergence.js`.
- **Spec / plan / SDD:** `docs/superpowers/specs/2026-06-23-world-engine-body-divergence-design.md`,
  `docs/superpowers/plans/2026-06-23-world-engine-body-divergence.md`, task briefs+reports in `.superpowers/sdd/`.
- **▶ NEXT — UAT ✅ PASSED; build closed.** Live integration check done (3-world A/B + screenshots
  `screenshots/relief-divergence-{terrestrial,europa,lava}.png`), Max UAT passed. Open decision: **push**
  (still HOLD — Max's call). Then the production-L1 port: dedicated branch off `master` →
  `dev-collab-scope` the L1 layer (wiring engines into the real renderers + type-demotion refactor,
  high blast radius). Lab left clean on `terrestrial`.

### Supercruise / in-system flight — SHIPPED TO MASTER 2026-06-28 (incl. sublight + 2 UAT fixes)

> **▶ SHIPPED TO MASTER + DEPLOYED (2026-06-28).** The whole supercruise/free-look/arrival-modes
> arc (149 commits) merged & deployed to GitHub Pages — master `09db316`. Same arc added **sublight
> propulsion** (drive-OFF throttle → forward/stop/reverse at SUBLIGHT_CAP), a **hard collision
> barrier** (never fly through a body), and **mass-based forced-drop/mass-lock** near stars. Then
> **two post-ship UAT fixes pushed `15d7189`** (code `f455f39` + Rule-3 docs): **(A)** in HELM
> hands-on the cursor is hidden and the mouse IS the flight stick, so **left-click now selects the
> body under the center reticle** — planets/moons selectable, not just background stars; **(B)**
> forced-drop/mass-lock is **direction-aware** — engage + fly off when pointed AWAY from a star, a
> head-on approach still drops you (capture). Both live-verified via chrome-devtools (reticle-on-
> Mercury click → Mercury selected; sim-loop nose-toward force-drops / nose-away stays engaged);
> **259 unit tests green, build clean.** Spec `docs/superpowers/specs/2026-06-28-uat-fixes-select-masslock-design.md`.
> The "deploy deferred" status below is SUPERSEDED. Handoff resolved (both issues closed):
> `/tmp/well-dipper-supercruise-uat-fixes-handoff-2026-06-28.md`.
>
> **▶ ALSO FIXED + PUSHED (2026-06-28) — procedural orbital realism `a04bf4a`.** Max UAT
> (sublight): planets visibly drifted away when parked near them in procedural systems (Sol was
> fine). Root cause: `StarSystemGenerator` anchored Kepler's law on the system's innermost-planet
> AU (a VISUAL map-layout quantity), not the physical Mercury reference (0.387 AU) Sol uses →
> procedural orbits ran 1.6×–100× too fast (worst on luminous/binary stars). Fix: `keplerOrbitSpeed()`
> anchored on physical AU; migration + resonance-snap now recompute speed (a stale-speed migrant bug
> the test also caught). At `celestialTimeMultiplier 1.0` (realistic, default) motion is imperceptible
> by design — now true for procedural too. Test `StarSystemGenerator.orbit-realism.test.js` (8 seeds,
> ±30% of real Kepler). Build clean; pre-existing KnownObjects/GalacticFeatures failures unrelated.
> **Max UAT pending:** warp to a procedural system, park at sublight, confirm planets sit still.
>
> **▶ NEXT (deferred to a fresh session, Max 2026-06-28) — Orrery/God's-Eye navigation UX.** Click a
> star system → travel there; click a planet → instantly move to it; orbit lines ON by default
> (`showOrbits: false`→true, `Settings.js:21`). Feature w/ 3 small feel decisions → brainstorm first.
> Handoff with anchors: `/tmp/well-dipper-orrery-navigation-handoff-2026-06-28.md`.

**`supercruise-freelook-2026-06-10`** — **ALL 13 tasks + control harness BUILT,
live-verified, and UAT-PASSED by Max** (live ride 2026-06-27: "it's good to ship").
Elite-style supercruise is now THE in-system mover for BOTH drivers — autopilot
(tour legs + post-warp fly-in + COMMIT BURN) and the player (manual W/S throttle +
mouse virtual-joystick + hold-to-look freelook + screen-space HUD). **F is a 2-state
ON/OFF flight toggle**; flight TYPE (Manual / Align-on-select / Assist) is a Settings
enum. The control harness `src/flight/ShipControls.js` is the single-door surface both
drivers go through; legacy `AutopilotMotion` + `NavigationSubsystem` + `FlythroughCamera`
motion roles are RETIRED from the live path (files kept; NPC `ShipSpawner` spawn gated
off via `SHIPS_ENABLED=false`).
Contract (9 ACs) + intent + plan:
`docs/WORKSTREAMS/supercruise-freelook-2026-06-10/` +
`docs/superpowers/plans/2026-06-10-supercruise-freelook.md`.
**Status:** UAT-passed on branch `feature/supercruise-freelook` @ `7bd261c` (pushed to
origin). **Master merge + GitHub-Pages deploy DEFERRED** — the next arc (reach-the-planet
drop-out + mode restructure) builds directly on these same systems, and master has an
active World-Engine session (main.js/NOW.md merge-conflict surface). Merge when both arcs
are ready to land. Headless at the ship commit (verified 2026-06-27): build clean, flight
+ camera + ui suites green (200/200). Last fix `7bd261c`: F-off no longer snaps back to the focused body (clears focus
on exit). Full arc trail: `memory/well-dipper-supercruise-progress.md`.
**Maps to journey:** completes the travel-loop foundation the 35% SCREENSAVER-MVP
autopilot rides + lands the first player-flight (GAME-tier) capability.
**Known quirk (not blocking, deferred):** Assist sometimes fails to converge within ~55s
and auto-flips its target to a moon (e.g. Dione) — separate flight/selection issue.
**▶ NEXT arc (scoping now):** reach-the-planet drop-out + forced-out-near-planet +
enter/exit camera-shake FX + mode restructure (Toybox / Flight / Free-look, autopilot as
a flight subset). Research workflow running; brainstorm + scope pending.

### Prior active — warp tunnel (pending-UAT items remain)

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

- **world-engine port (lane L1), rung 3 decided + rung 4 scouted** (2026-07-30) — `bea2438`
  **rung 3 verdict: keep transcribing**, but the handoff's stated blocker (per-planet
  `ShaderMaterial` × 343 uniforms) **does not exist** — 18 planets across all 18 types compile to
  **4 shared programs**, the ROCKY program has 53 active uniforms, and 343-vs-53 upload costs
  +0.19 ms (1.1% of a 60 fps budget). The real blocker is **cold shader compile: ~29 s wholesale**
  vs 4.08 s for the game's three variants today (that 4.08 s is a pre-existing, previously
  unmeasured first-load hitch — async warmup is a cheap open item, `KHR_parallel_shader_compile`
  is available and the game boots into an intro). Budget rule: **~26–81 ms cold compile per KB of
  fragment shader**. ⚠ Measuring this is booby-trapped by Chrome's shader disk cache — cache-bust
  the source or you time the cache. `be073f3` **rung 4 scouted**: 17 fns / 19.4 KB / +1.1–1.6 s;
  province-neutral is exactly `uProvinceWeight = 0.0`; ⛔ mountains + canyons reach
  `sampleGrainStrike` → `textureCube`, and the game binds zero textures, so craters+ejecta and
  plateaus go first.

- **world-engine port (lane L1), slice 3 rung 2** (2026-07-30) — `2b89132` **`uReliefOctaves` ramps
  4→9 with distance**, using the lab's own law imported not copied
  (`autoOctaves(lodRampOf(d))` = `mix(4,9,smoothstep(20,6,d))`, d in body radii). Driven by the
  CONTINUOUS ratio `LODManager` already computes, **not** the discrete `lodLevel` tier — a
  tier-driven ramp would pop five octaves in one frame. Octaves buy more relief than the gain raise
  did (rocky +312%, ice +137%; terrestrial/lava +19–23%, the same self-limiting shape). Pinned by
  `tests/relief-octave-lod-ramp.test.js` (7 cases, mutation-checked) because the ramp **cannot be
  exercised by flying** — every Sol body is 10⁵–10⁷ radii away and the world rebases around a
  near-origin camera. Contact sheet: `~/briefings/relief-octave-ramp-closeup-2026-07-30.png`.
  **Next rung is a decision, not code**: transcribe further vs import the lab shader wholesale
  (blocked on per-planet `ShaderMaterial` × 343 uniforms — measure first).

- **world-engine port (lane L1), slice 3 rungs 0–1** (2026-07-30) — ✅ **MAX UAT PASSED** on the 6×
  relief raise (_"I'm fine with it btw it looks good to me"_).
  `f77d9ff` **the hoist**: `hash3`/`noised`/`fbmd` now live only in
  `src/worldengine/shaders/heightNoise.glsl.js` and are spliced back into `HEIGHT_GLSL` at the two
  (non-contiguous) points they occupied — resolved string **byte-identical, 265 920 bytes**; the
  duplicate copy and its byte-lock test are gone, and `vis-scale-fence` was re-pointed at the
  resolved string rather than losing its guard. `bef6bf3` **relief strength ×6**
  (`RELIEF_NORMAL_GAIN` 6.54 → 39.24), the band-collapse fix the first increment deferred; zero
  frame cost *provably* (it is a uniform, so the compiled shader is unchanged). The gain
  self-limits: flattest types +71–120% local contrast, already-varied types +8–17%. 60° clamp fires
  0.000% even at 12×; Venus and gas-giant controls byte-identical across the whole sweep. Contact
  sheet `~/briefings/relief-strength-6x-2026-07-30.png`. Register:
  `docs/FEATURES/surface-variation-beyond-mvp.md` § "SLICE 3, SECOND INCREMENT". Suite = baseline
  (20773 / 4). **Next rung** (`uReliefOctaves` LOD ramp) deliberately NOT started so the visual
  change can be UAT'd alone — and it has two open snags: the `lodLevel` tier is discrete so 4→9
  will pop, and the game passes `fwBase = 0` so fbmd's anti-shimmer clamp is inert.

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

- ✅ **STEP 6 UAT PASSED — Max, 2026-08-11.** On `PVX J3DK6GAO+RBJGI5M g` (p=5,
  `lab-procedural-6`) at 3.0 body radii: north polar cap (`uPolarPole +1`, 6 sides),
  `uLimbStrength 0.7`, `uBandContrast 0.64`, octaves 9/9 saturated, live agreeing with
  predicted. **Gas giants are shipped through the pipeline in the game.** Coverage
  9 of 50 bodies (18%).
  ⭐ **Step 12's gate is now half closed.** Step 12 (delete `GAS_BODY`, `Moon.js`'s
  shader, and the 6e flag) depends on Max's UAT on Steps 6 **and 10** — 6 is done, 10 is
  not built. Do NOT read this as licence to remove the flag.
- ⭐ **RULED 2026-08-11 (Max): Step 10 is its own workstream, not a `PACKS` registration.**
  The plan's §4 reads Steps 9 and 10 as symmetric — "one entry each". Measured, they
  are not. `applyDriverPacks` has exactly ONE production caller
  (`src/objects/Planet.js:2030`), so the array's "admitting a class does not touch the
  mount sites" claim **holds for Step 9** (rocky planets reach `_createSurface` by the
  same two routes gas planets do) and **breaks for Step 10** — and `Planet.js:2120-2125`
  already says so in its own words: a plain moon carries neither provenance stamp, so
  *"on the day Step 10 routes plain moons through `BodyRenderer.createMoon`, THIS
  FUNCTION WOULD ADMIT SOL'S MOONS."* `Planet.js:2087-2092` adds that the single-call-site
  property holds *"by luck"* today. Step 10 therefore needs, before it can be one array
  entry: a provenance stamp on plain moons, `src/objects/Moon.js` ported (it is still a
  third renderer), and `BodyRenderer.createMoon` admitted as the array's second consumer.
  **Order is unchanged** (7 → 8 → 9 → 10 → 11 → 12); what changed is that 10 gets
  `dev-collab-scope` (intent.md + contract.json) when it starts, and 9 does not.
  Evidence: `docs/FEATURES/review-2026-08-11-camera-api-and-packs.md` §PASS B.2.
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
- ⭐ **Camera aim choreography (`CameraChoreographer`) — DEFERRED 2026-08-09 by Max, and now a REQUIREMENT for screensaver-mode MVP shipping.** Built, committed (`92614e5`), **dormant** — it does not execute at HEAD (`SHIPS_ENABLED = false`), has zero tests, and its intended successor path is dead. ⛔ **Resumption is Max-gated by name** — do not pick this up opportunistically. ⚠ The screensaver requirement is bigger than the module: today's tour is HeadMount-welded first-person with no independent aim axis, so satisfying it means the screensaver grows one. Full state, the three repairs a revival owes, and the retired-by-record conflict: `docs/FEATURES/autopilot.md` §Deferred — camera aim choreography.

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

## 2026-07-28 (later) — gravity self-compression: VERIFIED_PENDING_MAX 06b0030

**Active workstream:** `world-engine-gravity-selfcompression-2026-07-28` — status `verified`,
awaiting Max's UAT. JOURNEY milestone: the world engine's physics-first premise (laws derived, not
chosen). PLAYER_EXPERIENCE tier: world generation fidelity.

Surface gravity moved off the constant-density law `g = g_c·(R/R_c)` onto the piecewise
self-compression law `g = g_c·f(R)/f(R_c)` — `R^(4/3)` below 1 R⊕, `R^1.70` above — **rocky class
only**. A 1.6 R⊕ world reads 2.22 g, not 1.60. Goldens untouched.

**Next 1–3:**
1. **v2 relief-law derivation** — handoff `~/briefings/handoff-lane-A-v2-relief-law-2026-07-28.md`.
   All three citations now retrieved; Melosh undercuts the g=1 break, so Max's open decision changed
   shape ("should there be a g-break at all?").
2. **`uPerturb` wiring fix** — filed at the workstream's `evidence/FINDING-uperturb-radius-blind.md`,
   deliberately sequenced after the v2 law.
3. **R2 / vertical km calibration** — unchanged, still behind both.

**Owed by Max:** success criteria in his own words, and AC-UAT.
