# Increment 3 — relief-scale spine + crater depth-law correction

**Workstream:** `world-engine-inc3-relief-spine-depthlaw-2026-07-21` · L1 tree, `feature/world-engine-production-L1`
**Greenlight:** Max, 2026-07-21 ("go!") — audit Increment 3 carries the overnight campaign's standing greenlight; the depth-law rider was greenlit explicitly with it after the math check.

## Why we care (the line of sight)

Max's v2-6 UAT verdict (2026-07-21, verbatim in the v2-6 contract statusNote): at low gravity + low radius, Moon/Mercury and Frozen read *"like it's made of magma almost, it's almost wavey. … I have never seen a photo of a rocky planet or moon that looks like the low gravity/low radius versions here"* — with his hypothesis *"the scales of everything may be off and require some math checking."*

The math check (`MATH-CHECK-2026-07-21.md`, wf_dc144889-350) confirmed the hypothesis with the axis corrected: **vertical scale, not lateral**. Lateral scales are right (largest basin 0.56 R vs Herschel 0.70/Caloris 0.64; SFD slope at saturation). Three convicted causes; this increment takes the two vertical ones:

1. **reliefNorm over-drives ~7×** at the worked point (uncapped 1/RE term × clamped g^-0.5) → apparent relief/radius ~0.70 vs Phobos-extreme 0.40 / Vesta 0.15.
2. **Crater depth law inverted:** d/D = 0.2546·δ^-0.5 → 0.36 at reference (real fresh simple ≈ 0.20 constant), ~1.09 near the mesh floor where most stamped craters sit — near-hemispherical pits reading as molten waves.

Cause #3 (missing small-crater peppering — 99.986% of the drawn population sub-node, folded into an unrendered roughness scalar) is **deliberately not here** — it belongs to the exogenic-dressing increment (audit Inc 8) with the mesh-density question. Cause #4 (ice relaxation compounding on Frozen) is trace-only here.

## Success in Max's words

Low-g/low-R Moon/Mercury and Frozen read as **heavily-cratered small worlds** — the Mimas/Vesta-class lumpy-but-cratered look you *do* see in photos — not "magma/wavey". Radius must still visibly drive crater scale (the v2-6 win, no regression).

## DOES / UNLOCKS (Rule 15 card)

**DOES:** bounds vertical relief into the real-body envelope via a *derived* strength-cap law at the composite/bake seam (render-side, carrier untouched), resolving the audit footnote-14 exponent double-dip in ONE derivation note; corrects crater depth/diameter to physical d/D (0.20 simple-regime constant, complex rolloff with transition ∝ 1/g).
**UNLOCKS:** radius visibly expressed in ALL height-bearing families at once (the audit Inc 3 promise); a single exponent-governance note that Inc 4 (figure render) and Inc 5 (angular widths) size against; closes the v2-6 UAT finding.

## Deliberate non-goals

- Small-crater peppering / regolith-roughness consumer / mesh-density lift → audit Inc 8 (exogenic dressing).
- Ejecta rays (fenced channel — audit Q1, Max's product call pending).
- Crystal/exotics (deferred wholesale, Max ruling 2026-07-21).
- Atmo-lane files/sections (section-ownership fence in force).
- No mesh scaling: the unit-sphere ruling stands (audit §2) — radius is expressed through feature scale.
