# World-engine reconciliations — the bug family C7 belongs to

**Date:** 2026-08-15 · **Opened at** `1c08f16`, immediately after C7 (Step 8b) shipped.
**Why this file exists:** Max, on seeing C7's result — *"want to make a fix a priority as we
continue to implement the world engine rendering system"* and *"consider what other kinds of
reconciliations like the one we just found will need to be planned/implemented."*

⛔ This is a FILING and a FRAME, not a plan of record. The deep dive is the next session's job.
Nothing here is scheduled; §4 is a candidate list with honest status flags, not a backlog.

---

## 1. THE FAMILY, NAMED

> **A generation constant was authored when the generator had no physics. Physics arrived later.
> The constant was never revisited.**

The world engine bolted real physical derivation — mass, composition, equilibrium temperature,
atmospheric retention, tidal state — onto a generator whose numbers were originally chosen so
that bodies would *look* varied and *read* well at a glance. Every such number is now an input to
a physical law it was never checked against. That is one bug family with two sub-shapes:

**A — SOL-DEFAULTS.** A missing context value silently substitutes the Sun or the Earth, and the
body is then derived as if it lived here. Never errors; produces plausible, wrong numbers.
- **B7/RC2** — `zones: null` in `_swapPlanetType`, so a swapped planet was derived as if it
  orbited the Sun. *Shipped fix: `2154de1`.*
- **B7/RC3** — `_swapPlanetType` regenerated at the **post-migration** AU while every other body
  uses its generation-time AU. *Shipped fix: same commit.*
- **C7/8b** — `PlanetGenerator.generate(rng, 1.0, …)` for every planet-class moon: a hardcoded
  **1 AU**, i.e. Earth's orbit, for a body that might be 1294 AU out. *Shipped fix: `4cee76a`.*

**B — AUTHORED-FOR-LOOKS CONSTANTS.** A range picked for visual variety, now feeding a physical
law that makes its breadth meaningful — and wrong. **This sub-shape has had NO fixes yet.**
§2 is the first confirmed instance.

⭐ **The tell for both: the code often already knows.** C7's own gate file had diagnosed break B7
in prose before anyone read it, and §2's defect is contradicted by the comment on the line above
it. **Grep the comments for the bug before assuming nobody has seen it.**

---

## 2. FILED — planet-class moons are binary planets, not moons

**Status: MEASURED, CONFIRMED, NOT FIXED. Pre-existing; C7 did not cause it.**

`MoonGenerator.js:381` `const fraction = rng.range(0.10, 0.25);` draws a planet-class moon's
radius as 10–25% of its parent's radius. The comment on `:380` reads:

> `// Moon radius: 10-25% of parent (these are big moons — Ganymede is 0.038× Jupiter)`

**The line states the real ceiling and then draws 2.6× to 6.6× above it.** Before 8a the moons
carried no mass, so the ratio was only a silhouette choice. 8a gave them real `massEarth`; mass
goes as radius³, so a 6× radius overshoot is a **~250× mass overshoot**.

Measured on `wd-27` planet 3 moon 1, live in the game and headless (agreeing to full precision):

| | moon / parent mass |
|---|---|
| Ganymede / Jupiter | 0.0078 % |
| Titan / Saturn | 0.024 % |
| our Moon / Earth (not a giant) | 1.23 % |
| **`wd-27/3/1`** | **7.1 %** |
| Charon / Pluto (a genuine binary) | 12 % |

Moon 2.166 R⊕ / 6.575 M⊕ vs parent gas giant 9.482 R⊕ / 92.611 M⊕; radius ratio **0.228**,
mass ratio **0.0710**. The orbit is fine — 190 R⊕ is ~0.04 % of the parent's Hill radius, so the
body is comfortably bound. It is the **size**, not the orbit, that is unphysical.

⚠ **C7's role, stated precisely so it is not mis-blamed later.** C7 shifted the rng stream, which
re-drew this body's `fraction` from ~0.10 to 0.228 — so it made *this instance* extreme. The
range that permits it is untouched by C7 and would produce a 0.25 ratio on some seed regardless.
7 of 24 planet-class moons on FENCE-221 had their radius re-drawn by C7; **all 24 were already
subject to the same range.**

### Two smaller mismatches on the same body, same family, also pre-existing
- **Type label vs derived composition.** The body is `type: 'ice'` with a bulk density of
  **3568 kg/m³** (Io is 3528; real ice moons are ~1880) and a `silicate` surface with
  `volatileFraction` 0.038. The type is drawn at `MoonGenerator.js:374` **before** composition is
  derived, so the two can disagree and nothing reconciles them.
- **Two densities on one body.** `composition.density` is 4380 kg/m³ while the body's bulk density
  is 3568 — a 23 % disagreement. `_generatePlanetMoon`'s mass rescale deliberately preserves
  `pData`'s bulk density (`:418-427`, and its comment is right to); that bulk density simply is
  not `composition.density`.

---

## 3. PLANNED — narrowing the range. NOT SCHEDULED; Max's call on when.

**Recommendation: do it AFTER Step 10's moon rendering, not before.** It is a one-line change
with a full universe-change cost, and it moves the same bodies Step 10 is about to re-render.
Landing both at once means Max looks at the change once instead of twice. ⛔ Do not treat this
paragraph as a decision — it is a recommendation with its cost stated.

**Shape, when it happens — it is a C7 clone and should reuse C7's exact machinery:**
1. **Predict first, in a committed doc, one commit BEFORE the edit.** C7's delta table
   (`9ebb24b`) is the template, and its ordering-in-history is the point.
2. **Two harnesses, each with a byte-identical control**, or the numbers are not evidence.
3. Expected blast radius, by analogy with C7 and NOT yet measured: it moves `radiusEarth` and
   `massEarth` on **all** planet-class moons (not 7 of 24 — this changes the draw's *range*, so
   every draw moves), hence `surfaceGravity`, `reliefEnvelope`, and every gravity-dependent law.
   Instrument B BODY IDENTITY red on 24 planet-class moons + the `systemContext` planets;
   Instrument C red on the 64 P bodies. Plain moons must stay 0/770.
4. ⛔ **It is NOT draw-count-neutral if the range's edges change branch outcomes** — check the
   tidal-lock gate (`PlanetGenerator.js:691-698`) the same way C7 did.
5. **What value?** Unresolved. Ganymede is 0.038× Jupiter by radius; a range like 0.02–0.06 is
   defensible physically but shrinks planet-class moons by ~4–6×, and they exist *because* a
   big moon is interesting to fly to. **This is a game-feel decision, not a physics one, and it
   is Max's.** A physically honest alternative is to keep the size and raise the parent's mass.

---

## 4. CANDIDATES FOR THE NEXT SESSION'S AUDIT — with honest status

⛔ **None of these is confirmed. Each needs the C7 treatment before it is called anything.**

| # | Candidate | Status |
|---|---|---|
| 1 | `PlanetGenerator.js:368` `zones?.luminosity \|\| 1.0`, `:372` `starMassSolar \|\| 1.0`, `:373` `ageGyr \|\| 4.5` use `\|\|`, so a legitimate **0** falls back to a Sol default. `MoonGenerator.js:248` documents the opposite convention in its own comment — *"`??` not `\|\|`: metallicity and ageGyr are legitimately 0"* — and uses `??`. **The two generators disagree with each other.** | **LATENT.** Whether any of the three is ever 0 in practice is UNMEASURED. Cheap to settle. |
| 2 | Moon orbit multiples — `MoonGenerator.js:142` `mid:[12,30]`, `far:[30,60]`, and `:388` `{mid:[12,30], far:[30,60]}` for planet-class — authored against Io/Europa/Ganymede/Callisto. Now feed `tidalHeating` and `tidalLockTimescale`. | **UNMEASURED.** Same sub-shape B as §2. |
| 3 | `_pickRadius` plain-moon fractions (`:317-330`, 0.02–0.25 of parent) — same authored-for-looks origin as §2, on the 770-body plain population. | **UNMEASURED.** Larger population than §2. |
| 4 | Still-open 8a items, all previously filed: the rescale loop leaves `tidalHeating`/`tidalState`/`surfaceHistory` on pre-rescale geometry and the OLD parent type; `atmoPhysics.retained === false` unreached for planets across 6279; migrated/snapped planets carry physics for an orbit they no longer occupy. | **FILED, MEASURED, UNGATED.** Item 3 wants a gate before it wants a fix. |
| 5 | Composition-weighted greenhouse τ — `τ = 0.84·P^1.124` is pressure-only, so 2 bar of CO₂ and 2 bar of N₂-O₂ lift identically. Any fix must still reproduce the five anchors (Earth, Venus, Mars +0.1 %, Titan +3.7 %, Moon 0 %, Europa 0 %). | **FILED at `2ac8ea7`, NOT SCOPED.** |
| 6 | `tools/port-uniform-delta.mjs` prints *"the `bake`, `condition` and `gate` rows are unaffected"* — false under C7: 13 of 31 movers are non-record tier and read a hollow `0/461`. | **CONFIRMED, tool defect, not a generator one.** |

### How to run the audit — the method, not a vibe
1. **Grep the generators' own comments for real-world anchors** (`Ganymede`, `Titan`, `Io`,
   `Europa`, `Callisto`, `Earth`). §2 was found because the comment named the real ratio.
   Every such comment is a testable claim about the constant beside it.
2. **For each constant, ask the two questions that separate the family:** *(a)* did it exist
   before the physics that now consumes it? *(b)* does a physical law read it, or only a shader?
   Only (a)+(b) together is this family.
3. ⛔ **Verify every candidate against a known-good result before believing it.** While writing
   this file a probe reported `luminosity` null on **221/221** systems. It was a wrong property
   path — `sys.zones` on the returned object is not the `zones` built at
   `StarSystemGenerator.js:457` and passed to the generators. It was caught ONLY because it
   contradicted C7's already-verified temperature. **A confident, dramatic zero is a probe bug
   until proven otherwise**, and this family's bugs all *look* like dramatic zeros.

---

## 5. WHAT C7 PROVED ABOUT THE METHOD, WORTH REUSING

- **Commit the prediction one commit BEFORE the change.** Every number held; because the ordering
  is in git history rather than in a sentence, that is checkable by someone who does not trust it.
- **Two independent harnesses, each with a byte-identical control**, before any delta is accepted.
- **A physical result can be verified without trusting the generator.** C7's 165.65 K was checked
  against the star's OWN habitable zone (520–750 AU ⇒ ~3×10⁵ L☉ ⇒ an HZ spanning 261 K → 217 K,
  which brackets Earth's 255 K). That is a stronger check than any instrument in the tree, and it
  is the check that answered "is this realistic" when Max asked.
