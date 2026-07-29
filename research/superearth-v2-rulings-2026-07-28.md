# Max's rulings on the v2 relief law — 2026-07-28

Four decisions, all closed in one sitting. Verbatim quotes, then what each one binds.
Evidence base: `superearth-v2-decision-brief-2026-07-28.md` (14 agents, ~100 identifiers
hostile-refereed). Supersedes the "Three decisions that are Max's" section of
`superearth-relief-law-2026-07-28.md`, which is now **closed, not open**.

---

## 1. Relief amplitude — ACCEPT the falling law

> *"1. A, but before confirming that I want you to do further research and make sure there's no
> existing scientific model(s) that model terrestrial planets at the scales we're talking about
> that might help us here."* … *"Your rec on relief is good."*

He provisionally picked **A** (extend the measured Solar-System fit past Earth ⇒ roughly constant
absolute relief) **and gated it on a literature check.** The check ran and **went against A**: no
published model supports constant relief above 1 g, and the one escape hatch (strength `Y` rising
with gravity, Heap+2017) was retrieved and refuted. He then accepted the recommendation.

**BINDING:** `h ∝ g^−1.09`, cited **Guimond, Rudge & Shorttle 2022** (doi:10.3847/PSJ/ac562e,
domain 0.1–5 M⊕). Bracket **[0.74, 1.61]** labelled an inference back-out from their Fig. 7, not a
stated result. Fractional-relief exponent `Q = q + 0.588`.

Riders that travel with it:
- **Drop the piecewise-in-g break entirely.** Guimond's law is continuous across the whole range;
  Melosh's data cannot locate a break anywhere in g.
- **Use the published SLOPE, never the published AMPLITUDE.** Guimond under-predicts observed
  Solar-System relief ~3×. Keep Earth's observed 19.9 km as the anchor and scale it.
- **`RELIEF_FLOOR` must move off 0.40** — at q = 1.09 it binds at R = 1.64 R⊕. Leaving it would
  accidentally implement constant relief while claiming to implement the derived law: Max's
  original preference wearing the wrong citation. The worst outcome available.

⚠️ **The known weakness, recorded so it isn't rediscovered as a surprise:** every model predicts
*dynamically/isostatically supported* relief; the anchor set is *total* relief including impact
basins and volcanic constructs. **Nobody has modelled total relief on any planet.** The slope and
the amplitude come from different physics.

## 2. Terrain texture scale (p_C) — NO variation with size

> *"2. Again, go with scientific models here."* … *"I don't think I really want super earths to
> read differently at the texture level...I would expect mostly the same landforms. Maybe you'd get
> some interesting ones at that scale but if nobody has simulated it yet for us to copy we don't
> have to worry about adding it"*

**BINDING: `p_C = 0`.** But the label matters, because the value that ships is the same one the v1
audit proposed for a reason that has since collapsed:

- The **Landais ~10 km break is NOT a flexural signal** — mechanism misidentified by 12–21× against
  Turcotte & Schubert's own worked number; the authors call it a hypothesis; the paper contains zero
  gravity analysis. **Strike that justification from the code comment.** It is not evidence for 0.
- **No number is derivable.** Both ends of the flexural bracket fail both available observations,
  in opposite directions (Landais: same break across 6× in g; Crooks: 5× different break at
  *equal* g). The horizontal scale cannot be located in g, exactly as the amplitude cannot.
- The defensible flexural effect is **16% finer at 1.5 R⊕ — perceptually invisible**, and elastic
  thickness varies ~16× within Earth alone, swamping it by ~12×.

So `p_C = 0` is **CHOSEN against an explicitly UNDERDETERMINED physics**, not derived. The comment
must say that. Max's second clause is a **standing scope rule**: *if nobody has simulated it, we
don't invent it* — no speculative novel super-Earth landforms.

## 3. Tectonic regime — BOTH, via the bistable band

> *"3. Uhhh why not account for both models? Can we make our proc gen pipeline accommodate both of
> those competing models?"* … *"3. Ok bistable band it is"*

**BINDING:** not a uniform dice roll and not a decreed winner — **deterministic outside the
bistable band, seeded draw only inside it, band width growing with convective vigour**
(Weller & Lenardic 2018 mono-stable/bistable/mono-stable structure, width ∝ Ra^(2/3)).

⚠️ **The recommendation previously on record — "widen the seeded radius band" — is WRONG and must
not be actioned.** Measured against the shipped code:
- **Stagnant-lid is currently UNREACHABLE for a super-Earth.** Not unlikely — unreachable. Verified
  over 2000 seeds and again with a 98%-stagnant weight override forced on. Always mobile.
- **The seeded three-way draw has zero routing influence anywhere** in the reachable parameter
  space (dispatch calls a seed-free argmax to keep presets byte-stable). Widening changes nothing.
- **`episodic` has no writer**; `mixedInterior.js` is fully built and unreachable from all 18 presets.
- The band edge is **backwards** — growing a planet flips it *toward* mobile.

Steps 1+2 are ~8 lines and byte-safe. Step 3 (the `bodyDrivers.massGravity` repoint) is the
expensive one and shares decision 1's ordering constraint.

**No published prior on the mobile-lid fraction exists**, so `SUPER_EARTH_REGIME_WEIGHTS` *is* the
declaration of the unresolved question, and must be commented as such.

## 4. Crater apparent size — PHYSICAL SIZE WINS

> *"why would I want craters' apparent size to scale up?? Yeah, fix the bug."*

This settles the one decision the brief flagged as genuinely his. The engine has a deliberate
program (the `* sVis` term, `VIS_SCALE_EXP = 0.5`, `bakeReliefCrossover`) devoted to **holding
crater apparent size constant as the disc grows**; the physics says angular crater size should fall
as ~1/R, so a bigger world reads **finer**-cratered. They are in direct opposition.

**BINDING: the physics wins. Max classifies the hold-apparent-size behaviour as a bug, not a
feature.** This unblocks Tier 1 (the draw-band fix), which was gated on exactly this call.

Two defects, two root causes, two fixes:
- **U2 — craters vanish** (`bakeReliefCrossover` fading the only cube craters live in).
  ✅ **FIXED + verified live, `f88c2c6`.** Total crater weight now 1.000000 at every radius;
  restore exactly 0 at R = 1.0 so byte-identity holds. Also fixes the total blackout at R ≥ 4.
- **U1 — craters R-invariant by construction** (both draw-band edges ∝ R against a scale-free draw,
  so R cancels identically; `K_GS` is structurally dead as a result). **Open — Tier 1.**

The target model is **Johnson et al. 2016** (doi:10.1016/j.icarus.2016.02.023) eq 4, verified
against its own worked examples to 1.2%, fed by a sampled impactor SFD — which is what Max
described. `K_DT = 3.1` and `D_D_SIMPLE = 0.20` are **correct as shipped; do not touch.**

---

## Ordering constraint that binds 1, 3 and 4-Tier-1 together

    g(R) [DONE] → v2 relief law + move RELIEF_FLOOR → repoint bodyDrivers.massGravity

Until the last step lands, **none of the adopted physics reaches the screen** — today a 4.5 M⊕
super-Earth's uplift field is bit-identical to Earth's. And if it lands *before* the relief floor
moves, the floor silently clamps every super-Earth flat.

## Still owed to Max (not decisions — surfaced BY his decisions)

**His success criterion named `/atmosphere`** (`world-engine-gravity-selfcompression-2026-07-28/intent.md`).
No atmosphere law reads the corrected gravity; scale height `H = kT/(μg)` is unwired and tracked
nowhere. That is new scope his own words opened, and it has no workstream.
