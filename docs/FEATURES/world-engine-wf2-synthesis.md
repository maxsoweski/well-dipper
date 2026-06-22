# World-Engine WF2 — by-engine research SYNTHESIS

**Status:** 2026-06-22. WF2 (by-engine research) **COMPLETE** — 18/18 engine dossiers, each
`research → adversarial-verify`, 36 agents, ~2M tokens, no runner wedge (in-thread synthesis).
Raw structured dossiers + verdicts: [`world-engine-wf2-dossiers.json`](world-engine-wf2-dossiers.json)
(480KB — query it, don't read whole). Architecture: [`world-engine-architecture-spine.md`](world-engine-architecture-spine.md).
Pickup map: [`world-engine-INDEX.md`](world-engine-INDEX.md).

This doc is the **design direction** the brainstorm converged to. It validates the 15-engine/5-tier
spine against real planetary science + real-time feasibility, fixes the build order, concretizes the
Option-A boundary, and answers Max's recurring terrain↔rivers question.

## 1. Headline result — the architecture holds

All 18 engines have a real planetary-science mechanism AND a real-time-feasible procedural
approximation. After adversarial verify: **17/18 high-confidence with a feasible cheap approximation.
The one exception is E9 (Hydrology)** — feasible but only as a **bake-time** pass (seconds), not the
per-frame "one pass" the dossier overclaimed (see §8). No engine is infeasible; nothing kills the
architecture.

## 2. ⭐ The terrain↔rivers question — ANSWERED: don't merge; share a relief substrate

**Do mountains (E6 tectonic-grain) + rivers (E9 hydrology) collapse into one engine? No — and they
shouldn't.** They have distinct mechanisms, inputs, and cost classes (E6 = closed-form Melosh stress
field + steered noise; E9 = baked-field flow routing). But WF2 shows they are **coupled through a
shared mutable relief field**, with E9 acting as an **editor-on-host** on E6's output (E9's inputs
flag `relief/elevation field` as a required upstream; E9 emits an `incision delta-height` that edits
that relief).

**The right architectural unit is therefore not a merge — it's a first-class, mutable RELIEF
SUBSTRATE** that the **build engines write** (E6 tectonic, E7 magmatism, E8a bombardment) and the
**sculpt engines edit** (E9 hydrology, E10 aeolian, E11 cryosphere), ordered by epoch. Merging E6+E9
would destroy the temporal legibility the north star demands — you must be able to *read* "a river
later cut a mountain that was already there." The host-editor model (locked) is exactly this pattern;
the relief substrate is its concrete data structure. This generalizes past E6/E9 to the whole relief
group.

## 3. Cost triage → build order (cheapest, most-depended-on first)

| Cost class | Engines | Build note |
|---|---|---|
| **closed-form** (cheapest) | E1, E2-figure, E4, E8a, E15, E2-illum | Pure per-texel/per-body math; do first. |
| **steered-noise** | E12-province | Cheap; early (it's a T1 root). |
| **baked-field** | E9, E8b, E12-palette | Bake-time GPU passes (seconds OK). E9 is the hard one (§8). |
| **hybrid** (closed-form steering + bounded relaxation) | E3, E5, E6, E7, E10, E11, E13, E14 | Steering field + a *bounded* relaxation; never offline time-stepping. |

## 4. The dependency DAG (derived from dossier inputs)

- **Roots** (L0 + base step only): E1, E2-figure, E12-province, E2-illum, E4, E15; E8a (≈root).
- **E6** ← interior/crust field *(new upstream need — see §5)*
- **E9** ← E6 relief · E5 precipitation
- **E10** ← E6 relief/slope · E1 lithology · sediment supply
- **E11** ← E6 relief · E3 stress-tensor
- **E5** ← E6 topography  *(this is the atmosphere↔surface cycle — resolve via shared field at a fixed point)*
- **E8b** ← finished surface · E4 flux · E8a craters
- **E12-palette** ← E1 composition · E4 irradiation · E5 temperature
- **E13** ← E9/E6 slope-aspect · E8a crater substrate
- **E14** ← E9 land/water · E5 insolation

## 5. The L0 boundary, concretized (Option A: expose + derive)

WF2's 77 under-supply flags confirm §4a precisely and give the exact plumbing spec:

1. **D12 tidalHeating — un-zero it. #1 priority: 10 of 18 engines need it** (E3, E4, E5, E6, E7, E8a,
   E11, E12-palette, E12-province, E2-figure). It's hard-zeroed in the game today; this single fix
   un-starves most of the stack.
2. **Expose the system graph** (the core of Option A) — pervasively needed: orbital eccentricity,
   resonance/neighbor graph, semi-major axis / mean motion, primary mass, star SED / luminosity /
   spectral class, ring + sibling-moon inventory, dipole tilt/offset. L0 computes these; the per-body
   pipeline can't see them.
3. **New finding — a thin INTERIOR field is needed upstream of relief.** E6 needs crustal-thickness /
   lithosphere, E3 needs Love numbers, E7 needs a thermal/age field. This is best emitted by the
   **Tier-1 base step** (the same step that derives the structured fields) or a small E0-interior —
   not a per-engine recompute.
4. **L0-driver one-liners:** surface D13 magneticField (E4), a D8-derived wind-rose (E9/E10),
   D4/D5 properly to E4/E5, D7 to E9. (Spot-check the agent-reported file:lines before editing.)

## 6. Type → derived-label demotion: pervasive (all 18 engines)

Every engine's dossier independently flagged a likely "outcome hard-coded by discrete body type"
site. This confirms demotion is a **cross-cutting refactor**, not a local one. Largest sites: E1's
`deriveComposition` threshold cascade (the master), `planet-archetypes.js` `rendersOn` allowlists,
and the per-engine "if type==X draw Y" switches (palette, aurora on/off, dune type, ring yes/no,
biosphere on/off). The principle stays: **drivers + fields decide; type is a name read off the
result.**

## 7. Epoch / host-editor model: strongly validated

Of 18 engines: **11 are editor-on-host, 4 per-epoch, only 3 run once** (E1, E12-province, E2-illum).
The majority fundamentally edit earlier outputs — the host-editor model isn't a nicety, it's how most
of the stack works. Locking it was correct. (2–4 epochs; coarsest granularity that still encodes the
sequences that matter.)

## 8. Verify findings — calibration checklist (mechanism right, specifics to fix)

The adversarial pass refuted 10 claims. None are architecture killers; all are calibration/honesty fixes:

- **E9 (the one real feasibility item):** "single non-iterated incision pass reads as eroded terrain"
  and "Priority-Flood is GPU-parallel" were refuted. Reality: depression-fill = **FastFlow** (Jain
  2024), not Priority-Flood (sequential); steady-state LEMs iterate (~200×). **Resolution: E9 is a
  bake-time pass — FastFlow accumulation + a *handful* of bounded incision passes (not 1, not 200),
  seconds per body.** Acceptable for a bake; state it honestly in the slice.
- **E8a:** atmospheric crater-cutoff diameters overstated (mechanism fine; recalibrate numbers).
- **E10:** angle-of-repose is *not* gravity-independent (Kleinhans 2011) — slip-face angle must read gravity.
- **E11:** one-shot stagnant-lid scaling under-determines the final look (Sputnik Planitia) — needs the bounded relaxation.
- **E12-province:** radial "eyeball" geometry only valid for weak heat-transport; recalibrate for advective cases.
- **E8b:** maturation timescales partly right, some numbers wrong + a backwards net-effect (Mercury solar-wind) — recalibrate.
- **E1:** C/O>0.8 carbon swap is sound; 0.8 is a modeling threshold, not a hard line.

## 9. ⭐ First vertical slice — RECOMMENDED: the relief group (E6 build → E9 carve)

Prototype **E6 → E9 over 2 epochs sharing one relief substrate**, fed by a minimal base step
(D12 un-zeroed + a stub interior field + the relief field). This single slice validates *four* things
at once: (a) the shared-relief-substrate pattern, (b) the host-editor/epoch model end-to-end,
(c) the expose+derive boundary, and (d) the hardest feasibility item (the E9 bake). Success test
(north-star aligned): the result **reads as a landscape with a history** — a drainage network that
clearly post-dates and cuts the tectonic relief. Matches Max's stated priority case
(terrain↔sea↔drainage). If this proves out in the lab, the architecture is proven in miniature.

## 10. Open items carried forward

- Map the 84-edge interaction audit (`feature-interaction-audit-2026-06-20.md`) onto the engine DAG
  as a validation set (not yet done — deferred to slice planning).
- Confirm the interior-field source (base step vs a small E0-interior engine).
- E9 bake-budget target (ms/seconds per body) to set the incision-pass count.
