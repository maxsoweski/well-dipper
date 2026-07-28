# world-engine-radius-live-feed-2026-07-25 — intent

> ⚠ **SUPERSEDED IN PART (gravity-selfcompression-2026-07-28).** Passages below describing `g = g_c·(R/R_c)` record the CONSTANT-DENSITY law that was live when this document was written. Gravity is now `g = g_c·f(R)/f(R_c)` with `f` piecewise in absolute Earth radii (`R^(4/3)` below 1 R⊕, `R^1.70` above), applied to the **rocky class only**; gas, icy and carbon presets are unchanged. Byte-exactness at canonical is unchanged. Kept as written for audit trail — do not read it as current behaviour.


## Why we care

Max, verbatim (the directive this whole line of work answers):

> "We need to get the radius adjustment working with all other systems. Tectonics, craters,
> everything need to adjust to the new radius when adjusted. **I can tell that's not happening
> across the board.**"

The census (`nonvisual-analysis-channel-2026-07-24/evidence/RADIUS-CENSUS.md`) established he is
right, and split the cause into three unrelated problems. **This workstream is the first of two**
and takes only one of them: **a group of consumers reads radius from a frozen preset constant
instead of from the live slider.** The physics in those consumers is already correct — the
atmosphere's Rhines band law (`N = RHINES_K·√(a·Ω/U)`, band count ∝ √a) is right and matches the
independent derivation. It is fed a number that never moves.

That makes this the cheapest real progress against the directive: no new physics, a wiring fix
located to specific lines, and an immediately visible result (a giant's banding starts answering
the slider). The genuinely expensive half — volcanism's population and five tectonics modules that
have no radius *and* no gravity input at all — is R2, deliberately not in this contract.

Two of Max's earlier rulings compose to settle what "adjust to the new radius" means, so neither is
re-litigated here:

- **What the slider means.** `body-condition-vector.js:37` derives `surfaceGravity = g_c·(R/R_c)`
  from M ∝ ρR³ at fixed composition density (the V2-6 gravity-coherence ruling). Sliding right =
  a *bigger body of the same composition*, with mass ∝R³ and gravity ∝R. Not "the same body drawn
  larger."
- **What it should look like.** Max, ratified verbatim on the display-scale rebuild: *"planet
  bigger, forms same size, that's it."*

Composed: **the physics responds in the physical km frame; the display keying holds on-screen form
size constant.** So the visible signature of a working radius is a change in **how many** features
there are and **how they are arranged** — never in how big each one looks. Anything that appears to
change individual form size on screen is the display keying breaking, not radius working.

## Success criteria (Max's language)

- **"Move the radius slider and the systems answer it."** On a gas giant, dragging radius changes
  the banding — visibly, at a fixed seed and preset. Today it does nothing.
- **"Not happening across the board"** stops being true of the feed: no system is still quietly
  reading a frozen radius while the slider says otherwise. Where a consumer *should* stay pinned to
  the canonical preset radius, that is proven by measurement and written down — not assumed.
- Rivers stop being a claim. The census could only say rivers "appear to" respond because it read
  the law off the source. Either it is measured, or the row does not say WIRED.
- **Nothing that worked before breaks.** At canonical radius every existing world renders exactly
  as it does today — bit-for-bit, no golden re-capture.

## Explicitly not in this workstream (R2)

Named here so the census's other two problems are not silently dropped:

- **Missing couplings** — volcanism's plume *population* (count/spacing key on thermal alone;
  `magmatism.js:121`), and `stressFabric` / `province` / `passiveMargins` / `substrate` /
  `sphereField`, which carry zero `radiusEarth` and zero `surfaceGravity` references. Real physics
  derivation, not wiring.
- **Vertical km calibration** — Max's stated item 2, already its own named workstream.
