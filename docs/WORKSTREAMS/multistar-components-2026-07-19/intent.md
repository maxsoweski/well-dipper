# multistar-components-2026-07-19 — intent

> Increment A of the multi-star feasibility recommendation
> (`../real-universe-overlay-2026-07-12/multistar-render-feasibility.md` —
> 3-verifier adversarial passes ran at `62fe938`; corrections folded and
> committed at `7cb8253`, the anchor of record). Scoped via TRIMMED dev-collab-scope
> (precedent: lane A's PRESET_ARCHETYPE retirement, 2026-07-13) — the interview
> was pre-pinned by Max's ruling below; only the D4 default remains overridable.

## Why we care

Max's directive (2026-07-19, verbatim — the investigation trigger):

> "CAN we implement a system by which a stellar relationship like with this 3-body
> one can be rendered at the SYSTEM nav view scale and the actual system in-game
> environment scale? Can we make that feasible? [...] Because currently there
> simply is no way to select the proxima centauri part of the system that includes
> the planets orbiting that star, clicking on any of the three stars in the PRISM
> view sends us to the inner part of the system that only currently renders rigil
> and toliman"

The feasibility report answered YES (component pockets; §3.2–§3.3) and recommended
splitting delivery: **Increment A** (this workstream — data substrate + nav
drill-in + rep-cap amendment, lane C, zero main.js) then **Increment B** (in-game
component travel, joint lane B+C). Max's ruling on that recommendation
(2026-07-19, verbatim): "Great; write a handoff and loop command for me that I can
hand to a fresh session to handle implementation (and any planning/research needed
before and testing needed after)."

Line of sight: exploration-immersion — a triple like Alpha Centauri should be
*experienceable* as a triple (select the Proxima part, see her planets), not just
labeled as one.

## Ruling encoding (2026-07-19)

- **D1** (amend the representation cap) + **D2** (component = *location within*
  the one system; the §6 one-destination invariant is preserved, not renegotiated)
  = **greenlit-in-principle**.
- **D4 default = ALL authored wide multiples** — the census at scoping found
  THREE `farCompanions`-bearing table rows, all riding the same substrate:
  Alpha Centauri → Proxima (13,000 AU, planets b/d), Guniibuu/36 Oph →
  HD 156026 (4,400 AU), and Zet-1 Ret → Zet-2 Ret (3,750 AU). (The handoff
  named only the first two; the third is included by the ruling's own "ALL
  authored" default.) Matches Max's 2026-06-04 wide-binary intent ("binaries of
  all kinds should occur naturally, some close, most farther out"). **This is a
  flagged default, not a ruling — Max can override to α-Cen-only at any point
  before ship.**
- **D3** (transition experience) + **all of Increment B** (in-game component
  travel) = **OUT OF SCOPE** — deferred to a joint lane B+C scoping interview
  after orrery-coherence UAT.

## Success criteria (Max's language)

- "there simply is no way to select the proxima centauri part of the system that
  includes the planets orbiting that star" → **now there is**: clicking the far
  companion's chip in the SYSTEM view, or Proxima's own PRISM marker, opens a
  component sub-view showing Proxima with planets b and d as **real generated
  bodies with actual orbits** — never fabricated view-only orbits — with the
  breadcrumb "part of Alpha Centauri" and the clause-3 annotation ("via Proxima
  Centauri — far companion"). ESC pops back.
- "rendered at the SYSTEM nav view scale" → the sub-view IS a SYSTEM-scale nav
  view of that component (planet-detail drill pattern), satisfying all four
  system-identity grammar clauses.
- Warp/arrival behavior **UNCHANGED** in this increment: both α Cen markers still
  preview and warp to the one authored system (seed 1816942132). This increment
  makes the system's full structure *navigable in nav* and lays the data substrate
  Increment B's travel will spawn from.

## Deliberate non-goals

- **Increment B / in-game travel:** no main.js, no warp/flight/mode-ownership
  code, no travel affordance in the component view. Joint lane B+C scoping owns it.
- **D3 transition experience:** an Increment-B taste call; nothing here presumes it.
- **Sky honesty (report §3.4):** `src/rendering/sky/*` is lane D — untouched here;
  folds into whichever increment touches sky first.
- **Wide-binary procgen (S-type via components):** later work this substrate
  unlocks. Precisely: v1 never *spawns components in procgen (non-authored)
  systems* — components exist only for authored `STELLAR_COMPANIONS` rows.
  This does NOT forbid the component's internal planet roster from using
  procgen fill: an authored component's payload is its known-planet pins PLUS
  child-stream procgen fill (the fill-ON ruling), per AC1/AC2.
- **No new top-level seeds:** `realStarSeed.js` untouched — components draw child
  streams off the ONE canonical system seed (report §3.3: Proxima bins to the
  same 0.1 pc F1 cell as Rigil).
