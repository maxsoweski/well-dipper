# Moon formation — the audit, the corrections, and what to build

**Date:** 2026-08-15 · Opened at `9570d9a`, on `feature/world-engine-production-L1`.
**Why:** Max asked for the moon procgen pipeline to be understood, analysed, checked against
observed and theorised astronomy, and then designed toward — *"such that the formation of these
relationships in our game is procedural and is not simply a patched on dice roll."*

**Produced by** the `wd-moon-formation-audit` workflow (12 agents: 4 code traces, 4 research
sweeps, 3 gap checks, 1 completeness critic). Raw artefacts are untracked in `scratchpad/`:
`moon-audit-gapregister.json` (72 entries), `moon-audit-critique.md`,
`moon-audit-research.json`, `moon-audit-codemap.json`.

⛔ **This is an ANALYSIS and a RANKING, not a plan of record.** Nothing here is scheduled.
The scoping interview (`dev-collab-scope`) runs off this file, not off it.

---

## 0. ⭐⭐ CORRECTIONS TO WHAT WAS PREVIOUSLY REPORTED — read first

Three claims that reached Max in conversation are **wrong**, and each one changes a decision.

**C1. "Nothing in the game can currently be irregular." FALSE, and backwards.**
Measured over 829 moons / 221 seeds: **224 (27.0%) are under 300 km, 163 (19.7%) under 200 km,
smallest 39.9 km.** The captured population runs p05 65 km / **median 200 km** / p95 2048 km.
The oversize is a **gas-giant-parent artefact, not a population-wide one** — 293 of 829 moons have
non-giant parents and 224 of those are already sub-300 km, because a rocky parent at 0.3–0.8 R⊕
times `_pickRadius`'s 0.03–0.08 fraction (`MoonGenerator.js:328-329`) lands at 57–408 km by
accident. ⭐ **Consequence: the hydrostatic/potato-radius flag is NOT blocked behind the sizing
fix.** It lands on a quarter of the existing population today. The register's own conclusion that
the flag is "moot until sizing is fixed" is the single claim most worth reversing.

**C2. "0.02–0.04 of parent = 1200–2400 km on a gas giant." WRONG NUMBER — it understates.**
That range was a sub-neptune's radius (`ScaleConstants.js:76`, `[2.5, 4.0]`) pasted onto a gas
giant's label. Gas giants are `[6.0, 14.0]` R⊕ (`ScaleConstants.js:77`), so the true figure is
**764–3568 km**. Phobos is 11 km.

**C3. "Rings and moons are independent draws." TRUE OF THE CODE, MISLEADING AS A TEST.**
They are already **correlated in output**: ringed planets have moons 73/109 = **67%** of the time,
ringless 435/839 = **52%** — because gas giants score high on both per-type tables. ⛔ **Any
acceptance test of "rings and moons should correlate" PASSES ON UNMODIFIED CODE unless it controls
for planet type.** A fix verified that way would be false-verified.

Two smaller repairs: `maxMoonsByType` is a **16**-entry table, not 18 (the 18-entry one is
`ringChance`), and it is read as `maxMoonsByType[type] ?? 1`, so `ice` and `lava` parents are
absent from it and silently take max 1. And the Hill-sphere violation count is understated
roughly 4× — recomputed against final orbits, **32 of 829 moons sit outside R_Hill outright, plus
47 more beyond the 0.4895 prograde limit** (~9.5% on non-surviving orbits).

---

## 1. THE FINDING THAT REFRAMES EVERYTHING — the channel gate is INVERTED

`MoonGenerator.js:122-124`: `isLargeParent = type === 'gas-giant' || type === 'sub-neptune'` is
the **only** gate that opens the planet-class (big-moon) branch.

> **The game produces its largest moons exclusively around the parents that physically cannot
> produce them, and forbids them around the only parents that can.**

Giant-impact is the sole channel that makes a fractionally large moon, and it requires a **solid
parent below ~6 M⊕ (rocky) / ~1 M⊕ (icy)** — above that the debris disk fully vaporises. Every
real high-mass-ratio pair sits on a solid parent: Moon/Earth 1.23e-2, Charon/Pluto 1.2e-1.
Meanwhile non-giant parents get a separate bare `rng.chance(0.12)` at `:326-327` for a 0.15–0.25
fraction — the right *order of magnitude* for an impact moon, fired on a dice roll.

⭐ **This is why Max's directive and the physics point the same way.** Big moons do not need to be
banned; they need to be moved to the parents that can make them and gated on the conditions that
do. §4's channel model is that move.

---

## 2. WHY GAS GIANTS HAVE TOO FEW MOONS — the population is missing, not the count

Jupiter's ~115 is **8 regulars + ~107 captured irregulars**. The generator has one loop
(`StarSystemGenerator.js:592`) over one count (`PlanetGenerator.js:596`), and `captured` is a
*member of the same type list* as `rocky` and `ice` rather than a separate population with its own
count, size and orbit law.

⛔ **So raising `maxMoonsByType['gas-giant']` from 6 to 95 would be far WORSE than the current
bug** — it would produce 95 planet-scale bodies. The fix is a second, separately-counted
population: absolute-km sizes from a broken power law (shallow q≈1 above ~8 km, Dohnanyi q≈2.5
below), orbits in Hill-radius fractions, inclinations excluding the 55–130° Kozai band and
weighted ~3.5–6:1 retrograde, and a mass budget of ~**1e-8** of the parent — never the 1e-4 one.

**Measured today:** `P(zero moons | gas giant)` = 10 of 72 = **13.9%**.

---

## 3. NEW DEFECTS THE AUDIT FOUND THAT NO ONE WAS LOOKING FOR

**3.1 ⭐ Sibling orbits are unordered, and 18.7% are inverted.** `MoonGenerator.js:157-158` draws
`orbitMultiple = rng.range(min,max) + moonIndex * rng.range(3,8)`, and the zone bands overlap by
construction (moon 1 → 15–38 parent radii, moon 2 → 18–46). Over **321 adjacent sibling pairs, 60
(18.7%) have moon *m+1* orbiting inside moon *m***; 31 pairs sit within 10% of the same radius,
5 within 2%. Compounding it, `:171` sets `orbitSpeed = f(moonIndex)`, **not f(a)** — so an
inverted pair puts the *inner* moon moving *slower* than the outer one. ⛔ **That is a Kepler
violation visible on screen with no physics knowledge required.**

**3.2 The terrestrial moon branch is dead, and that degrades a physics input.** Zero terrestrial
plain moons across 221 seeds. So `moon.atmosphere` is `null` on 100% of the plain population,
`hasAtmosphere` into `computeSurfaceHistory` (`:300`) is a **constant**, and `erosionLevel` has one
value across the entire moon population. `_pickRadius`'s terrestrial branch (0.08–0.15) and six
record draws are unreachable in practice.

**3.3 `moon.type` is one namespace over two incompatible populations.** Census: `rocky 261,
ice 281, captured 193, volcanic 86, venus 3, sub-neptune 2, ocean 3`. Planet-class moons reuse
`rocky`/`ice`/`terrestrial`, so the only discriminator is `isPlanetMoon`. ⛔ **Any channel-first
model keyed off `moon.type` will silently merge the two populations it exists to separate.**

**3.4 Two record shapes.** Plain moons carry 25 keys including
`composition/massEarth/T_eq/age/tidalState/surfaceHistory`; planet-class carry 20 with **none** of
those — `massEarth` is present on **0 of 26**. (This is why the mass-ratio probe had to read
`m.planetData.massEarth` for one population and `m.massEarth` for the other.)

**3.5 `retrograde` exists on authored moons and not on generated ones.** `SolarSystemData.js:468`
and `:607` carry `retrograde: true`; generated moons carry no such key — it exists only as a sign
flip on `orbitSpeed` (`:203`). **Any new law reading `moon.retrograde` works on Sol and reads
`undefined` on 829/829 generated moons.** Retrograde and inclination are also conflated: a
"retrograde" generated moon has `i ∈ ±0.5 rad` *and* negative speed, which is not the same object
as `i ≈ 152°`, and `main.js:7692` tilts the orbit line by `inclination` alone.

**3.6 Radius has an undocumented rendering consumer.** `MoonGenerator.js:209`
`noiseScale: Math.max(rng.range(3.0,6.0), 2.5 / moonRadiusData.radius)` is an **inverse-radius
floor**. Shrinking captured moons ~100× multiplies that floor by ~100. `main.js:7643` already does
this rescale explicitly for planet-class moons (`noiseScale * pmRatio`), which proves the coupling
is known elsewhere. ⚠ There is also **no minimum render or selection size anywhere** — a correct
20 km moon is 3.1e-3 R⊕, and nothing yet asks whether it is visible, targetable, or worth an orbit
line (`main.js:7677-7690`).

---

## 4. THE TWO CHANGES WORTH MAKING FIRST — and they are not the same change

### 4.0 ⭐⭐ MAX'S RULING ON ORDER, 2026-08-15 — §4.1 does NOT go first

> *"Shape probably has a lot to do with some of the variables that generate moons… should probably
> be downstream of some of those."*

**The recommendation in §4.1 — ship the shape flag first, standalone — is WITHDRAWN.** He is right
on the substance and the reasoning is worth keeping, because §4.1's own argument is what makes it
tempting: the flag *would* land on 27% of bodies today. But the potato-radius test reads **mass and
density**, and both are about to be re-derived by §4.2. A flag computed now would be computed from
inputs the very next change replaces, and would then need re-blessing twice.

⭐ **Shape is a DERIVED property of the formation model, not a parallel feature.** It belongs
downstream of channel, mass and composition — which is also the order that makes it *correct*
rather than merely cheap: the same reorder that §4.2 performs (composition before size) is what
puts ρ in hand before the shape test needs it.

**Revised order:** §4.2 (the parameterization reorder) → channel model → **then** §4.1's
`moon.figure`, computed from the new mass and density in the same pass. §4.1 stays in this file as
a specification, not as a next step. ⛔ Its "cheapest fix in the register" framing should not be
used to argue it back to the front.

### 4.1 SPECIFICATION (NOT the next step — see §4.0): `moon.figure = { hydrostatic, R_pot }`

Computed by **plain assignment** inside the existing condition block (`MoonGenerator.js:250-302`)
from `radiusEarth` and `composition.density`, both already on the record two lines earlier at
`:262-266`. **Zero rng draws**, byte-safe under the file's own documented rule at `:231-241`.
Per C1 it lands on real data immediately: **27% of moons come out irregular, 19.7% below even the
icy threshold** — with no sizing change, no reorder, and no draw-stream re-derivation.
**Only cost:** Instrument B's RECORD SHAPE channel (`body-identity-fence.test.js:746`, key-set
equality plus `moonShapeCensus`) — one deliberate census re-bless.

⚠ **The one number it needs is one the research could not source.** The ~300 km rocky potato
radius is the researcher's own inversion of Lineweaver & Norman's anchors, **not a citation** —
the paper PDF did not parse. Pin it before shipping.

⛔ **Do NOT take the register's nominated "cheapest fix"** (`GravityField.js:179`
`_estimateMoonMass` returning `R^2.5 × 0.5`). It is cheap but it silently changes SOI radii on a
flight model Max has been flying for months, with no artefact to judge it by. Note its error is
also stated backwards in the register: for **planet-class** moons the sign flips and the absolute
error is far larger, because their type is `rocky`/`ice`/`venus`, never `terrestrial`, so they take
the same branch — and those are exactly the bodies a pilot flies to and enters an SOI around.

### 4.2 HIGHEST LEVERAGE: the ordering inversion — composition BEFORE radius

Move `deriveComposition` (`:256`) ahead of `_pickRadius` (`:311`), draw **mass** first, derive
radius last via `R = (m·ρ⊕/ρ_moon)^(1/3)`.

**The leverage is not the 1e-4 number.** It is that this single reorder is the *precondition* for
six otherwise-permanently-blocked items: the `>0.25 M⊕` terrestrial gate (`:496-499`), the Roche
test against the moon's real density, the potato radius against a real mass, the giant-impact
vapour ceiling, the tidal-survival cap, and palette-from-composition (`:134`).

⚠ **True cost is SIX commits, not two, and the register never assembles it in one place:** it
**re-derives** (not re-blesses) the 64-line pinned literal at
`tests/moon-rng-stream-identity.test.js:133`; it re-blesses `tests/baseline/body-identity.json`;
and — the buried part — it moves `systemContext.moons` at `StarSystemGenerator.js:946`, which
writes moon `radiusEarth`/`type`/`orbitRadiusEarth`/`tidalHeating` onto the **parent planet's
hashed record**, so it also reds Instrument C as a **population mismatch (exit 2, which
`--allow-deltas` does not rescue)**.

---

## 5. ⛔ WHERE "PROCEDURAL" WOULD STILL BE A DICE ROLL WEARING A FORMULA

Max's directive fails if these are not addressed, and each is a real trap:

1. ⭐ **The channel gate itself.** Every proposal hangs the impact channel's probability on "system
   dynamical temperature", then names `zones.metallicity`, `zones.ageGyr`, `formation.archetype`,
   `formation.diskMass` as proxies. **None of those is a dynamical temperature** — metallicity and
   disk mass are solid inventory, age is elapsed time. The generator carries no eccentricity
   excitation, no embryo count, no instability epoch, and `migrationHistory` resolves at
   `StarSystemGenerator.js:629`, *after* the moon loop. Outcome if unaddressed: a smooth reskin of
   `rng.chance(0.10)` varying slowly with [Fe/H]. **The real fix nobody proposed: derive a
   per-system instability/impact-era flag BEFORE the planet loop, alongside `deriveFormation` at
   `:417`, where `formation` is already computed.**
2. **Metallicity as a single shared latent variable** produces *correlation, not architecture* —
   two systems with the same [Fe/H] get statistically identical moon systems.
3. **The 1e-4 budget without a partition rule** constrains only the sum. The variety Max actually
   asked about — four medium moons vs one dominant one — lives entirely in the unspecified half.
   The research names the real controller (Crida & Charnoz fast-vs-slow spreading) and concedes in
   its own `uncertain` block that it never found the dimensionless threshold, because
   arXiv:1301.3808's main text was font-corrupted.
4. **Forced eccentricity from sibling period ratios** presumes orbits come from a law under which
   period ratios mean anything. Per §3.1 they do not — a near-resonance detector would fire on
   noise. Resonance must come *after* an ordered Keplerian orbit law.
5. **`namespacedFloat` (`:578`) is not physics.** It is a hash of a key — a deterministic
   pseudo-random draw with different accounting. It buys byte-safety, not derivation.

---

## 6. ⛔ THE MISSING NUMBER — the acceptance bar cannot be met without it

Max's operative clause is *"so long as they're **rare**."* **Nothing in the research or the
register operationalises "rare."**

Measured today: planet-class moons are **26 of 829 = 3.1%** of all moons.

**Until a target rate exists — per moon, and per system a player actually visits — every proposed
fix is unfalsifiable and the acceptance bar cannot be met by construction.** This is a design
number, not a physical one, and it is Max's.

Also unsourced and needed before the relevant work: the rocky potato radius (§4.1); a
**non-resonant regular** eccentricity distribution (the tidal-heating critique wants to replace
`eccRng.range(0.0, 0.012)` at `:357`, and the research supplies only *forced* and *capture*
eccentricities); and satellite primordial spin/obliquity, without which
`PRIMORDIAL_SPIN_HOURS = 8` survives any "fix" as an authored constant.

⚠ One already-written coupling would emit a wrong value if wired as-is: `PhysicsEngine.js:911-916`
sets `outerRadius = innermostMoonOrbit × (0.85 + f×0.1)`; moons start at 6 parent radii while ring
inner sits near 2 R_p, so wiring it yields rings **~5 R_p wide on every ringed body** — far wider
than Saturn's 2.27 R_S. Six register entries call this "already written, just starved" and **none
checks the value it emits.**

---

## 7. HOW TO READ THE RAW REGISTER

72 entries, but it is a **duplicate list, not a queue**: channel-first budget appears ×3, captured
absolute sizing ×3, Hill bound ×3, potato radius ×3, ring↔moon reservoir ×3, Roche ×3,
Boomerang/Slingshot ×2 — **each copy carrying a different `priority` and a different `blockedBy`.**
Status split: 24 absent · 21 contradicted · 18 partial · 9 represented; 58 of 72 not procedural
today. ⛔ Deduplicate before treating any of it as a backlog.

**What is genuinely already right** (do not "fix" these): composition from metallicity/frost
line/position, and density → mass from it; zone-gated moon type; tidal lock from real masses,
radii, orbit and age; surface history responding to the body's own gravity; ring density decaying
with age.
