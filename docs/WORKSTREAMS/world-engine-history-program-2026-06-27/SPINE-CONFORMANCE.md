# World-Engine Spine-Conformance — the standing AC-0

**Why this exists (Max, 2026-07-01):** "How can we always be operating in such a way as to be
procedurally building this system, as opposed to me having to constantly ask 'are we tacking
something on?'" The answer is a *checked artifact*, not vigilance: every world-engine increment's
contract carries a conformance AC that the existing machinery (dev-collab-scope at scope time,
verify-workstream's adversarial pass at verify time) audits automatically. Max never has to ask;
a non-conformant increment fails its own contract.

**The rule:** every world-engine contract (`docs/WORKSTREAMS/world-engine-*/contract.json`)
includes an **AC-0 "spine conformance"** with the three falsifiable checks below, and its
`intent.md` carries the DOES/UNLOCKS card (per the standing convention in Claude memory
`feedback_worldengine-does-unlocks-map.md` — linked, not pasted, per Rule 12).

## The three checks (each is a known, already-observed tack-on signature)

1. **Driver connectivity.** Every scalar/field the increment *reads* is one of:
   (a) backed by a D1–D16 slot, (b) derived from D-slots by a named derivation, or
   (c) explicitly listed as an archetype constant **with the future increment that will derive
   it named**. Routing on an archetype *string* (rather than a condition derived from drivers)
   must be declared as accepted debt.
   *Observed instance:* `climate-e5`'s shellDepthFrac/internalHeat/dissipation had no D-slot and
   no owner until the `ATMOSPHERE-PLAN.md §e` audit caught it (2026-07-01).

2. **Named consumer.** Every field the increment *emits* has a named reader — a render seam or a
   downstream increment, sourced from the track PLAN DAG (`ATMOSPHERE-PLAN.md §b` / ROADMAP), not
   invented. No dead fields.
   *Observed instance:* the pre-program engine accumulated "procedural data that exists but never
   reaches a shader" (`FEATURE_AUDIT.md` 2026-04-20) — the pattern this check retires.

3. **Taxonomy registration.** Every new lab control, preset, or feature registers in the shared
   data layer (`planet-archetypes.js` FEATURES/PROVINCES + the GLSL province mirror). The
   `tests/planet-archetypes.test.js` drift guards enforce this mechanically — additions that skip
   registration fail the suite.
   *Observed instance:* the atmosphere-track `emissionEnabled` toggle, caught by the guard at the
   2026-07-01 merge (resolved as `emissionRegister` — register gates live outside the `*Enabled`
   feature namespace).

## Scope and limits

- **Scope:** applies to every increment touching `src/worldengine/**`, the lab dispatch, or the
  lab GUI. `dev-collab-scope` folds AC-0 in at contract time; `verify-workstream` audits it
  adversarially like any other AC.
- **Limit — this checklist does not decide the architecture.** The deeper question (archetype-first
  dispatch vs condition-first regime derivation) is owned by the standing examination
  (`/tmp/handoff-world-engine-architecture-2026-07-01.md`; research brief committed `5605174`).
  Its outcome amends this doc — in particular check 1's treatment of archetype-string routing may
  tighten from "declared debt" to "prohibited except at the regime-selection layer."
