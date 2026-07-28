# world-engine-gravity-selfcompression-2026-07-28 — intent

> **Status: DRAFT awaiting Max's greenlight.** The "Why we care" below is Max's, quoted from the
> record. The success criteria are working-Claude's encoding of what the grounding established —
> they have NOT yet been through Max's words. Read §"Open for Max" before treating this as scoped.

## Why we care

Max's ruling that started this thread, verbatim:

> *"We should go with whatever is scientifically predicted for super earths/large terrestrial planets."*

And the standing directive this workstream descends from, verbatim:

> *"Tectonics, craters, everything need to adjust to the new radius when adjusted. I can tell that's
> not happening across the board."*

The world engine's premise is that the laws are **derived, not chosen**. Right now
`body-condition-vector.js:37` states a law in its own comment — *"M_derived(R) = M_c·(R/R_c)³ ⇒
g = g_c·(R/R_c)"* — and that law is constant density, which is false for anything above 1 R⊕.
Larger rocky planets self-compress and get denser. The lab under-reads a 1.6 R⊕ super-Earth's
gravity by **39%**, and on the impact-airless preset by **174%**.

Gravity is upstream of relief, tectonics, magmatism *and* crater scaling. Every other exponent in
the super-Earth relief work is expressed in terms of it. Fixing it at the source is cheaper than
pre-distorting each downstream law, and it is independently correct — it does not depend on any
contested part of the relief derivation, which is still NEEDS-FIX.

## Success criteria (working-Claude's encoding — pending Max's words)

- Drag the radius slider past Earth on a rocky world and the planet's **gravity** rises the way a
  real super-Earth's does, not the way a constant-density toy does.
- The rocky law is applied **only where the literature actually covers it.** Gas giants and icy
  worlds keep the old exponent rather than getting a silicate/iron law they have no business with.
- Nothing that was already correct moves. Goldens hold, byte-identity holds, and at the canonical
  radius the change is bit-for-bit invisible.
- The engine can **prove** the new law rather than assert it — the law registry gains an entry for
  gravity-vs-radius, so a future retune fails a named test instead of drifting quietly.
- The code stops telling a future reader something false. Comments distinguish what is
  **calibrated** against a measured Solar System body from what is **derived** and untestable.

## Non-goals (named, so they don't creep in)

- **The `uPerturb` wiring gap.** The global relief-amplitude uniform is fed the *canonical,
  radius-blind* gravity (`planet-lod-lab.html:3016` ← `planet-lod-lab-core.js:609-611`), and
  `reliefEnvelope` discards its `radiusEarth` argument outright. So this fix will **not** move the
  global relief amplitude. That is a pre-existing defect of the same family as the census's
  frozen-`_fp` finding and Max's own observation (a) at the R1 ship — filed, not fixed here. The
  handoff is explicit that the gravity fix goes "first and alone."
- **The icy and sub-Neptune exponents.** Gating them out of the rocky law is not the same as being
  right about them; `^1.0` has no more support there than `^1.70`. Declared debt, not silently fixed.
- **The v2 relief-law derivation** (`Q_RELIEF`, `RELIEF_FLOOR`, the `p_C` decision, the g-break
  question). Sequenced after this. This workstream changes what `g` **is**, never what consumes it.
- **`bakeReliefCrossover` demotion** and **R2 / vertical-km calibration** — all still behind this.

## DOES / UNLOCKS card

Per the standing world-engine convention (Claude memory `feedback_worldengine-does-unlocks-map`,
linked not pasted per Rule 12). This increment emits **no new field**. It changes the VALUE of one
scalar every rocky-body law already reads, so the DOES table is a table of consequences.

**What it DOES**

| Changes | Mechanism | What it lets someone see |
|---|---|---|
| `condition.surfaceGravity` on the 8 rocky presets | `g = g_c·f(R)/f(R_c)`, `f` piecewise in absolute R (`R^(4/3)` ≤ 1, `R^1.70` > 1) | a super-Earth that actually weighs what a super-Earth weighs — 1.6 R⊕ reads **2.238 g**, not 1.166 |
| crater size, stamped count, regolith roughness | `bombardment.js` `sizeMul = (G_REF/g)^K_GS`, `D_t = 3.1/g` | fewer, smaller craters and a smoother regolith as a rocky world grows |
| relief-margin weights `w_e` / `w_i` | `reliefBudget.js` `f_I` (impact fraction of the budget) | endogenic relief taking a larger share of the budget on heavier worlds |
| body flattening descriptor | `bodyFigure.js` `f ∝ 1/g` | a heavier world is rounder at the same spin |
| the IMPLIED mass law seen by `e1Regime.massEarthOf` and `giant-drivers` | both reconstruct `M = g·R²`, so they inherit the exponent + 2 | `M ∝ R^3.7` above 1 R⊕ and `R^(10/3)` below — **nothing in those files was edited**; they changed because gravity did |
| two `LAW_REGISTRY` entries | `instrument/laws.js` | the first laws in the registry that pin what **drives** gravity rather than what gravity drives |

**Explicitly does NOT change** — the 5 gas, 4 icy and 1 carbon presets (bit-identical to the retired
law at every radius), anything at the canonical radius (bit-identical, which is what holds the
goldens), and the **global relief amplitude** (`uPerturb` reads a canonical radius-blind gravity —
see Non-goals).

**What it UNLOCKS**

- **The v2 relief-law derivation** — every exponent in it is expressed in terms of `g`, so it could
  not be written against a gravity known to be wrong. This is the reason the gravity fix was pulled
  out and sequenced first.
- **`RELIEF_FLOOR` re-derivation** — the audit's finding that 0.40 binds at R = 1.40 R⊕ is only
  computable once `g(R)` is correct.
- **The `uPerturb` wiring fix** — once the relief law and its floor are settled, connecting that feed
  becomes a decision with a known consequence rather than a surprise.
- **Taxonomy (Rule 15 check 3): N/A.** The exponents are literature constants, not drivers; there is
  no new GUI knob and the composition gate is not a selectable regime. Declared, not skipped.

## Open for Max

1. **The success criteria above are mine, not his.** They need his words before the contract is
   more than a draft.
2. **A decision on record has changed shape.** It was *"does the g = 1 relief break render as a hard
   kink or a smoothed `min()`?"* — but the Melosh chapter, now retrieved
   (`research/superearth-relief-law-citations-resolved-2026-07-28.md`), shows the data cannot locate
   a break anywhere in `g`: Mars and Mercury sit at *identical* gravity (0.378 vs 0.377) on opposite
   sides of it, a factor of 3 apart. Recommendation on the table: keep a seam at g = 1 but relabel it
   as the **edge of the data** (calibration below, derivation above), not a physical transition.
   This belongs to the v2 derivation, not to this workstream — flagged here so it isn't lost.
