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

⭐ **What §2 taught about sub-shape B, and it sharpens the whole audit: the constant may not merely
have the wrong VALUE — it may constrain the WRONG QUANTITY.** A looks-authored number is naturally
expressed in whatever the artist could see (a radius, a silhouette, a spacing). The physical law
that later consumes it reads something else (a mass, an energy, a timescale). When the conversion
between them is non-trivial — §2's is cubed *and* carries a density ratio — no value of the
original constant is correct across the population, so **"narrow the range" is the wrong fix by
construction.** ⛔ For every sub-shape-B candidate, ask *what quantity does the law actually read*
before asking *what should this number be*.

⭐ **The tell for both: the code often already knows.** C7's own gate file had diagnosed break B7
in prose before anyone read it, and §2's defect is contradicted by the comment on the line above
it. **Grep the comments for the bug before assuming nobody has seen it.**

---

## 2. FILED — moons are sized by the wrong quantity

**Status: MEASURED, CONFIRMED, ROOT-CAUSED, NOT FIXED. Pre-existing; C7 did not cause it.**

> ⭐ **REVISED 2026-08-15, after the root cause was found.** This section first read
> *"planet-class moons are binary planets"* and §3 proposed narrowing the radius range. That was
> the **symptom and a symptomatic fix**. The defect is not one range being too wide — it is that
> the generator constrains the wrong quantity, which is why the same shape appears in the plain
> population too. §2.1 supersedes; §3 is rewritten. Corpus for every number below:
> **FENCE-221 · 221 seeds · 961 planets · 770 plain + 24 planet-class moons**, measured by
> `scratchpad/probe-moonmass-ratio.mjs` — untracked and **parked there deliberately**: it imports
> `./src/...`, so to re-run it, copy it to the repo ROOT, run, and delete (`ls probe-*.mjs` is the
> check). It installs no wrappers and runs the shipped bytes.
>
> ⚠ **A corpus correction, filed because this file's own rule demands it.** The first writing of
> these figures quoted **n=23 planet-class / n=705 plain**. Those denominators are the
> **moon-contract** corpus (197 seeds / 705 plain); the percentiles beside them were FENCE-221's.
> Re-measured cleanly on FENCE-221 the distribution is confirmed to the quoted precision, and only
> the counts move: **12 of 24** (not 12 of 23) and **30 of 770** (not 29 of 705) exceed Earth-Moon;
> **195 of 770** (not 190 of 705) exceed 1e-3. This is the standing "never quote a threshold from
> one corpus against another" trap, caught on its own material.

### 2.1 ⭐ THE ROOT CAUSE — one equation the generator never accounts for

    mass ratio = (radius ratio)³ × (ρ_moon / ρ_parent)

**The generator constrains the left side by setting the right side's first term only.**
`_pickRadius:317-330` and `_generatePlanetMoon:381` both draw a *radius* fraction of the parent.
Every physical law downstream — surface gravity, tidal lock, tidal heating, Hill stability, whether
the pair is a moon at all — reads *mass*. Converting between them carries a density factor the
generator never sees, and that factor is **not near 1 for a giant parent**: gas giants are
600–1300 kg/m³ while rocky and icy moons are 1900–3600. So a radius fraction that looks modest
becomes a mass fraction that is not, with the error **cubed** in the radius term and **linear** in
the density term.

Measured on FENCE-221. The identity above was checked per-body, not assumed: worst relative error
**6.2e-16** (plain) and **3.75e-16** (planet-class), i.e. floating-point exact.

| population | mass ratio p05 / med / p95 / max | radius ratio med | ρ_moon/ρ_parent med / p95 | over Earth-Moon (1.23e-2) | over 1e-3 |
|---|---|---|---|---|---|
| planet-class (n=24) | 1.8e-3 / **1.5e-2** / 7.1e-2 / **1.5e-1** | 0.183 | 2.95 / 10.64 | **12 of 24** | **24 of 24** |
| plain (n=770) | 1.5e-5 / **2.8e-4** / 1.0e-2 / 4.2e-2 | 0.059 | 1.26 / 6.05 | 30 of 770 | 195 of 770 |

Real disk-formed moons, for scale: **Ganymede/Jupiter 7.8e-5 · Titan/Saturn 2.4e-4 ·
Triton/Neptune 2.1e-4.** Our Moon/Earth is 1.23e-2 and is the most extreme in the solar system;
Charon/Pluto is 1.2e-1 and is a genuine binary.

**Two different problems, and they need different fixes:**

- **Plain moons are median-correct but have a runaway tail.** 2.8e-4 sits exactly on Titan and
  Triton. But 195 of 770 exceed 1e-3 and 30 exceed the Earth-Moon ratio. The tail is
  **doubly driven**: radius ratio reaches 0.245 *and* the density ratio reaches 10.6. All three
  worst cases are gas-giant-parented — `wd-116/3/1`, `wd-5/3/4`, `wd-165/2/4` — which is the
  density term showing itself directly.
- **Planet-class moons are wrong at the median.** The *typical* one already exceeds Earth-Moon,
  and the largest — `wd-133/4/3`, **1.5e-1**, a 2.876 R⊕ / 22.05 M⊕ body on an 11.98 R⊕ /
  150.0 M⊕ gas giant — exceeds even Pluto-Charon. **There is no seed on which they are plausible.**

### 2.2 Why this also explains the variety problem

The radius range 0.10–0.25 is only a **2.5× span**, but cubed it is a **15.6× span in mass**, then
multiplied by a density ratio that itself ranges 0.80–12.96 across the population. The current
design therefore produces **narrow size variety and wild, uncontrolled mass variety** — backwards
from what the feature wants. Density is currently an *uncontrolled multiplier on mass* rather than
a driver of apparent size.

### 2.3 The original filing, kept — the symptom as first seen

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

## 3. THE FIX — invert the parameterization. NOT SCHEDULED; Max's call on when.

⛔ **SUPERSEDES the "narrow the radius range" plan this section used to carry.** Narrowing the
range treats the symptom: it leaves mass a derived, unconstrained quantity, does nothing for the
plain population's tail, and keeps density as an uncontrolled multiplier.

**Sample the MASS ratio from a physically-motivated distribution; derive radius from that mass and
the body's own density.** The generator then constrains the quantity the physics actually reads,
and density becomes a *driver of apparent size* instead of a hidden multiplier.

**Physical basis.** Canup & Ward (2006): circumplanetary-disk accretion caps a giant's **total**
satellite-system mass near **~1e-4 of the parent** — gas inflow strips satellites into the planet
until the disk clears, which is why Jupiter's four Galileans total 2.1e-4 and Saturn's whole system
2.4e-4 despite very different architectures. That is a *formation* constraint, not a curve fit,
which is why it survives being applied to invented parents.

**Three formation channels — and this is where genuine variety comes from:**

| channel | mass-ratio target | where it applies |
|---|---|---|
| **disk-formed** (default) | system total ~1e-4, log-normal scatter, partitioned across the moons | any parent |
| **captured** | Triton-like; breaks the disk cap but stays small in absolute terms | any parent |
| **impact-origin** | the rare ~1e-2 channel (our Moon, Charon) | ⛔ **terrestrial parents only, never a giant** |

**This does not kill big moons — that is the load-bearing claim, so here it is with arithmetic.**
At a 1e-4 mass ratio on `wd-27/3/1`'s 92.6 M⊕ gas giant, an icy moon (ρ≈1500) lands at
**~0.32 R⊕** — Ganymede (0.413) / Titan (0.404) class, just under Mercury (0.383). On a 272 M⊕ hot
Jupiter, **~0.43 R⊕** — bigger than Mercury. Both are substantial worlds.

⭐ **Honest cost, stated plainly: planet-class moons shrink ~5–7× in radius** (2.166 → ~0.32 R⊕ on
the anchor body), from super-Earth to Ganymede-class. **That is the game-feel call and it is Max's.**

### 3.1 The option raised and withdrawn — keep the arithmetic so it is not re-raised

*"Keep the current sizes and raise the parent's mass instead."* It does not survive: a
2.17 R⊕ / 6.58 M⊕ moon at a plausible 1e-4 ratio needs a parent of **~65,750 M⊕ — 207 Jupiters**,
i.e. a brown dwarf, not a planet. **There is no physical route to a super-Earth moon around a gas
giant.** The only legitimate way to have two bodies that big paired is to model them as **binary
planets** (Pluto-Charon; barycentre outside the primary) — a real thing, visually distinctive, and
a much larger feature. ▶ **Queue separately if Max wants genuinely huge companions; do not smuggle
it into this fix.**

**Shape, when it happens — it is a C7 clone and should reuse C7's exact machinery:**
1. **Predict first, in a committed doc, one commit BEFORE the edit.** C7's delta table
   (`9ebb24b`) is the template, and its ordering-in-history is the point.
2. **Two harnesses, each with a byte-identical control**, or the numbers are not evidence.
3. Expected blast radius, by analogy with C7 and **NOT yet measured**. ⚠ **Wider than the
   superseded plan's**, because inverting the parameterization touches both populations, not just
   the 24: it moves `radiusEarth` and `massEarth` on **all 794 moons**, hence `surfaceGravity`,
   `reliefEnvelope`, tidal lock, tidal heating and every gravity-dependent law. Instrument B BODY
   IDENTITY red on 24 planet-class + up to 770 plain + the `systemContext` planets; Instrument C
   red on the 64 P bodies and some of the 372 S. ⛔ **The old line "plain moons must stay 0/770" is
   now WRONG and must not be carried into the delta table** — under this fix a green plain
   population means the fix did not reach the population with 195 over-1e-3 bodies.
4. ⛔ **It is NOT draw-count-neutral.** Deriving radius from a sampled mass changes what is drawn
   and in what order; `_pickRadius`'s `rng.chance(0.2)` / `chance(0.12)` branches (`:321`, `:326`)
   are themselves draws. Re-derive the draw-stream gate the way C7 did, and check the tidal-lock
   gate (`PlanetGenerator.js:691-698`) for changed branch outcomes.
5. **Preserve the two invariants `_generatePlanetMoon` already gets right**, both documented in its
   own comments at `:411-421`: mass must be rescaled *with* radius (never override one alone), and
   the rescale must preserve `pData`'s **density**, because that density was derived for the
   body's material and not for its size. The inverted parameterization makes both easier, not
   harder — density becomes the *input*.
6. **Reconcile the type/composition ordering while in here** (§2.3's first smaller mismatch). The
   new sampler needs ρ_moon *before* it can derive radius, so composition must be derived before
   size — which is the opposite of today's order (`:374` draws the type, composition comes later)
   and removes the `type: 'ice'` / 3568 kg/m³ contradiction as a side effect rather than as a
   separate fix.

---

## 4. CANDIDATES FOR THE NEXT SESSION'S AUDIT — with honest status

⛔ **None of these is confirmed. Each needs the C7 treatment before it is called anything.**

| # | Candidate | Status |
|---|---|---|
| 1 | `PlanetGenerator.js:368` `zones?.luminosity \|\| 1.0`, `:372` `starMassSolar \|\| 1.0`, `:373` `ageGyr \|\| 4.5` use `\|\|`, so a legitimate **0** falls back to a Sol default. `MoonGenerator.js:248` documents the opposite convention in its own comment — *"`??` not `\|\|`: metallicity and ageGyr are legitimately 0"* — and uses `??`. **The two generators disagree with each other.** | **LATENT.** Whether any of the three is ever 0 in practice is UNMEASURED. Cheap to settle. |
| 2 | Moon orbit multiples — `MoonGenerator.js:142` `mid:[12,30]`, `far:[30,60]`, and `:388` `{mid:[12,30], far:[30,60]}` for planet-class — authored against Io/Europa/Ganymede/Callisto. Now feed `tidalHeating` and `tidalLockTimescale`. | **UNMEASURED.** Same sub-shape B as §2. |
| 3 | `_pickRadius` plain-moon fractions (`:317-330`, 0.02–0.25 of parent) — same authored-for-looks origin as §2, on the 770-body plain population. | ⭐ **NO LONGER A CANDIDATE — MEASURED AND FOLDED INTO §2.1.** Median 2.8e-4 is correct (Titan/Triton); the defect is the tail: **195 of 770 over 1e-3, 30 over Earth-Moon**, driven by radius ratio → 0.245 *and* density ratio → 10.57. §3's fix owns it. |
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
   ⭐ **Then ask §1's third question: is the constant expressed in the quantity the law reads?**
   If not, write the conversion out and check whether it is near 1 across the *population* — §2's
   density term is 0.80–12.96, which is what turned a 2.5× radius span into a 90× mass span. This
   question is what separates a value bug from a parameterization bug, and only the second kind
   needs the fix rewritten rather than the number retuned.
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
