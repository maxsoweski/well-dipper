Verification complete — all four disputed claims resolved against the tree. Writing the plan.

---

# Moon Formation: Channel Model — Plan of Record

**Branch:** `feature/world-engine-production-L1` @ `e64fae2`
**Supersedes:** the moon-sizing half of `docs/FEATURES/world-engine-reconciliations-2026-08-15.md` §3
**Status:** design agreed, not started

**Base design:** the Reservoir Model's *physics*, the Four-Channel design's *build sequence*. The three judges split along axes rather than on merit — two ranked the Reservoir Model first on mechanism fidelity, one ranked the Four-Channel design first on buildability. They are measuring different things and the graft is the answer, not a pick. Grafts from the Budget-and-Cascade design are named where they land.

## 0. Verification performed this session (read-only)

Five claims were load-bearing for the rulings below and were checked against the tree, not taken from the source documents:

- **`deriveFormation` is degenerate, worse than any design stated.** `PhysicsEngine.js:599` computes `diskMass = starMassSolar * solidFraction * (0.5 + rngFloat1)` and `:607-613` compares it to `starMassSolar * 0.008` and `* 0.025`. `starMassSolar` **cancels**. At `[Fe/H] = 0`, `solidFraction = 0.05`, so the product spans 0.025–0.075: the lower clause is unreachable and the upper is always satisfied. Archetype is decided **100% by `dissipationMyr`** — a pure uniform, `1.0 + rngFloat2 * 8.0` at `:604` — for the bulk of the population, while the docstring at `:588` claims physics-driven derivation. All three designs refuse to build on `formation`; all three are right and all three understate why.
- **In-game metallicity scatter is ±0.05 dex.** `StarSystemGenerator.js:362-363`: `metallicity = galaxyContext.metallicity + rng.gaussian(0, 0.05)`. So `10^(1.2·[Fe/H])` varies **±14% between neighbouring systems** and `solidFraction` by ±5%. No design caught this and it reshapes the model — see the ruling in §1.
- **`tidalHeating` consumes the unclamped orbit.** `MoonGenerator.js:160` computes `orbitRadiusEarth`; `:185` passes it to `_computeTidalHeating`. A Roche clamp applied later in the append block would leave `tidalHeating` derived from a value the record no longer carries. Orbit work therefore cannot be split from composition-before-size.
- **`PINNED_STREAM_SET` does not collapse from draw-count fixes alone.** The file says so itself at `tests/moon-rng-stream-identity.test.js:125-126`: the widest keys are planet-class because `_generatePlanetMoon` generates a whole planet and inherits every branch of `PlanetGenerator`'s stream. It collapses only if `_generatePlanetMoon` merges into the shared tail.
- **Citation exposure is larger than any design stated.** `tests/moon-condition-contract.test.js` is **not** in `CITE_SOURCES` and carries **12** refs into `MoonGenerator.js` (`:123, 210, 218, 251×2, 262, 266, 274, 418, 499, 536, 578`) — every one inside the edit zone. `PlanetGenerator.js:372, 560, 687` carry symbol-anchored refs from `src/worldengine/port/conditionFromBody.js:185,239,240` and `tools/port-condition-delta.mjs:142`, and every design edits `:587-596`, which moves `:687`.

Orbital arithmetic computed this session (`M_p/(3M_*)` Hill convention): Jupiter `R_H = 5.32e7 km`; Io sits at **0.0079 R_H**, Callisto at **0.0354 R_H** (26.3 R_J); Saturn's Iapetus at **0.0544 R_H**. `0.4895 R_H` is **364 R_J** — fourteen times beyond Callisto.

---

## 1. THE MODEL

### The conditioning axis, ruled first

The three designs all routed their primary conditioning through a metallicity-driven solid-supply term. Given the ±0.05 dex finding, **that axis is locally flat**: two stars a player can see from each other differ by ~14% in `10^(1.2[Fe/H])`, and the term only moves over kiloparsec scales. A design whose rarity rides on metallicity is predictable at galactic scale and constant at the scale where flying happens.

**Ruling: the conditioning rides the geometric terms.** Parent mass, `parentOrbitAU`, `R_Hill`, `P_parent`, and `a/frostLine` all vary *within a single system* and are all on the record at `MoonGenerator.js:117` with no reorder. Metallicity enters only where a mechanism genuinely demands a supply term (C4's planetesimal density), never as a channel's principal driver. This is also the independent reason the Reservoir Model scores highest on mechanism — it already put the most weight there.

### C1 — Circumplanetary disk (regular satellites)

**Physical precondition, binary, no roll.** The parent accreted a hydrogen envelope, so it had a disk to make satellites in: `planetData.massEarth ≥ ~15 M⊕` **and** `composition.volatileFraction` above the envelope threshold. Read from mass and composition, **never the type string** — `ExoticOverlay.js:353` can retype a parent after its moons were drawn, and reconciliations §2.3 already established that type and composition disagree on moons.

**Likelihood: none.** This channel does not roll. Removing the constant is a stronger answer to the owner's criterion than conditioning it, and it leaves nothing to audit. A gas giant formed beyond the frost line has regular satellites with certainty, which structurally repairs the measured `P(zero moons | gas giant)` — **12.70% on FENCE-221, 13.9% on BULK-221; ⛔ neither figure transfers, label the corpus** — an artefact of `rng.int(0, 6)` admitting zero at `PlanetGenerator.js:596`, not a physical outcome.

**Mass rule.** System total `M_sat = 1e-4 × M_parent` (Canup & Ward 2006, gas-starved disk). Verified against all three solar giants: Galileans 2.07e-4, Saturn's majors 2.48e-4, Uranus's five 1.05e-4. This is a formation constraint, not a curve fit, which is why it survives application to invented parents.

**Count rule — geometric, zero draws.** `N_reg` = the number of log-spaced feeding annuli that fit between the moon's own Roche limit (`PhysicsEngine.js:839`, using the moon's own `composition.density`, available because composition now precedes size) and the **circumplanetary disk edge**, clamped to [2, 8].

⭐ **Ruling against the Reservoir Model on the outer boundary.** It ran the ladder to the `0.4895 R_H` prograde stability limit. Verified above: that is 364 R_J for Jupiter, against Callisto's 26.3 R_J and 0.035 R_H. The span would be a factor of 130 where the Galileans span 4.5, inflating `N_reg` and depositing "regulars" at irregular distances with multi-year periods. **The disk edge is `R_H/25`**, which places Callisto and Iapetus (0.035, 0.054 R_H) just inside it and matches the Four-Channel design's independently-correct 5–30 parent-radii band. `R_H` remains in the count law — a giant close to its star has a smaller Hill sphere and fewer annuli — so the Hill-scaling *direction* the Reservoir Model wanted survives; only the boundary constant is corrected. This reaches Dobos's conclusion by geometry without borrowing Dobos's curve.

**Orbit rule.** Ordered log-spaced sequence, 5–30 parent radii, Hill used only as a hard clamp. Ordered by construction, which *eliminates* the 60-of-321 inverted sibling pairs rather than reducing them. ⛔ `orbitSpeed` recomputed from the semi-major axis, `v ∝ sqrt(M_p/a)` — non-negotiable, because `MoonGenerator.js:171` and `:400` both compute speed as `f(moonIndex)` and an orbit fix that forgets this preserves the visible half of the Kepler violation.

### C2 — Giant impact (Band A)

**Physical precondition, binary, multiply don't roll.** Nakajima et al. 2022 (Nat. Commun. 13, 568) vaporisation gate: rocky parent below ~6 M⊕, icy parent below ~1 M⊕. The rocky/icy arm reads `composition.volatileFraction > 0.4` (`PhysicsEngine.js:412-413`), not the type label — the one place the gate discriminates *within* a type, since `ice` parents span 0.03–1.76 M⊕ and `ocean` 0.57–7.34 M⊕ while every other type sits wholly on one side. **Stated plainly: this gate is very nearly a type lookup and supplies almost no likelihood.** It is a channel *relocator* — it moves the big-moon channel off giants onto solids, which is exactly what the audit demands — and it must not be counted toward "rarity conditioned on system attributes."

**Likelihood — the one legitimate Bernoulli.** Elser et al. 2011 as measured, per directive 3: **8.3% per terrestrial planet**, bracket 2.2%–25%. Through ~3 terrestrial planets: `1 − 0.917³ = 22.9%` of systems, inside the 1-in-4 to 1-in-15 target. `P(≥2) = 1.95%` falls out of the binomial.

⭐ **No per-system cap.** Rare because the binomial says so, not because a cap was imposed. A cap would override a directive that says implement the literature as measured, and would have to be enforced by deletion in the post-pass — which can annotate but not un-draw, and would risk the `entry.moons ↔ planetData.moonCount` invariant that `ExoticOverlay.js:399` maintains and `ExoticOverlay.test.js:55-59` gates.

**Say this to Max in these words, not dressed up:** this channel carries a coin flip, and that is correct rather than a violation. Elser *measured a rate*; a measured rate implemented as a rate is not an authored constant. What would violate the criterion is an *unconditioned* rate — hence the Nakajima multiply and the crowding modulation. And per trap 5, a `namespacedFloat` threshold with a constant probability is the same dice roll with a cheaper receipt; `MoonGenerator.js:567-569` says as much about its own mechanism.

**Modulation, bounded.** Crowding — the count of solid siblings already placed *inward* of this parent, which genuinely exist at planet `i` during the loop (`StarSystemGenerator.js:510-624`) and are legitimate to read because the giant-impact era is an inner-system phenomenon. ⚠ This is an **embryo-availability proxy, not an eccentricity-excitation proxy**. It is not a dynamical temperature and must not be described as one. The modulated rate is clamped so it never leaves **[0.022, 0.25]** — grafting the Four-Channel design's construction, the only one in the set that makes a literature bracket a runtime invariant rather than an acceptance test.

**Mass rule.** Ratio centred on 1.23e-2 (Earth–Moon), with an absolute ceiling of **0.186 M⊕** (Malamud et al. 2020, MNRAS 492, 5089 — the largest mass produced across parents up to 18 M⊕). Both bounds apply; the absolute one binds on larger terrestrials. ⛔ **Cut the Pluto–Charon anchor.** Its 0.122 is the canonical *binary* ratio, and importing it here lets a 1 M⊕ parent legally emit a Charon labelled as a moon — inconsistent with deferring binaries as a separate regime.

**Density signature.** An impact moon accretes from the parent's mantle (the impactor's core merges with the parent), so it is systematically **iron-poor and less dense than its parent**. That is a real, checkable signature the current radius-fraction sampler cannot express at all, and it is the cleanest single demonstration that the rework changed something physical.

**Orbit rule.** Accretes near Roche, recedes tidally with `zones.ageGyr`. ⚠ **Honest magnitude:** under constant-Q, `a ∝ t^(2/13)`, so 1 → 9 Gyr moves the semi-major axis by **1.40×**, not the "close and huge versus far and small" contrast the Reservoir Model claimed. Real, correct in direction, ~40% in size. Ship the derivation; do not sell it as a clock.

### C3 — Pull-down capture (Band B) — directive 2's object

**Physical precondition.** Parent underwent runaway envelope accretion. Hansen 2019 (Sci. Adv. 5, eaaw8665) captures a ~10 M⊕ body around a ~2 M_J planet during envelope inflation. At 8 M⊕ around 318 M⊕ the mass ratio is 0.025 with the barycentre inside the primary below ~41 parent radii — **a satellite, generated by the satellite machinery, in the same record shape, on the same partition rule.** Directive 2 is satisfied structurally; nothing is bolted on.

⭐ **Mass comes from the circumstellar reservoir, not the parent's budget.** This is the single most important structural point in the model and it is non-optional: Canup–Ward on a 318 M⊕ Jupiter gives a *total* satellite budget of 0.032 M⊕, so an 8 M⊕ captured body is **250× the entire C1 budget**. Any design that carves it out of the 1e-4 budget is incoherent. The captured body formed in the stellar disk, so its mass tracks the embryo scale there — 3–12 M⊕ absolute, never a fraction of the parent's radius. This graft is mandatory onto whichever channel structure ships.

**Likelihood — the mechanism-derived term.** `P = eff(τ_env / P_parent) × P(co-orbital existed)`. Hansen measures capture efficiency at 10 / 100 / 1000 orbital periods → 8.5% / 2.1% / 0.3%. Envelope growth is set by disk thermodynamics, so expressed in the parent's own orbital periods the efficiency scales roughly as `1/P`. `P_parent = 365.25·sqrt(a³/M_*)` from `parentOrbitAU` (arg 7 at `StarSystemGenerator.js:594`) and `zones.starMassSolar`. ⛔ **Not** via `keplerOrbitSpeed` (`StarSystemGenerator.js:31-33`) — anchored on Mercury/Sol at `KEPLER_ANCHOR_AU = 0.387` with no stellar-mass term, wrong around exactly the non-solar-mass stars this must discriminate.

⭐ **Ruling against the Four-Channel design here.** It fixed `eta` at Hansen's central 2.1% and declined to modulate it, which discards the only measured dependence in the paper and leaves Band B's rarity resting on a supply term plus a fitted normalisation. The 28× spread across Hansen's three points is the mechanism. **Use the trend.**

⚠ **Two honest qualifications that must ship in the code comment.** (a) Mapping an absolute `τ_env` onto Hansen's period axis is our interpolation, not his result, and it runs against standard core accretion where formation time to runaway *increases* with semi-major axis — so if `τ_env` grows with `a`, the `1/P` scaling partially cancels. Claim direction, not magnitude. (b) A Jupiter analogue at 5 AU sits at 1e4–1e5 periods, one to two decades **past** Hansen's measured domain; extrapolating naively gives efficiencies near 1e-4. Apply the trend inside and near the measured domain with an explicit floor, and carry **one named normalisation constant** whose target and measured value are both written in the code.

⛔ **Metallicity is refused as this channel's driver.** `PlanetGenerator.js:875` already implements a metallicity giant-occurrence law — `metalFactor = Math.pow(10, 2 * metallicity)`, consumed at `:922`, `:977` and `:991-993` — with exponent 2 where Johnson says 1.2 and a two-value stellar term (`starType === 'M' ? 0.03 : 0.10`) where Johnson is linear in `M_*`. Applying Johnson again at moon time **squares** the metallicity dependence. The Budget-and-Cascade design argued the two terms answer different physical questions; that is a rhetorical distinction with no mathematical content, since both are monotone in `10^(k[Fe/H])` and both multiply. **Refuse it.** Combined with the ±0.05 dex finding, the term would in any case be locally constant. Correcting `:875`/`:991` to Johnson's exponent is the right fix and belongs to a planet-layer workstream — filed, not done here.

⛔ **Cut the Fulton×Kipping 1-in-500 anchor.** A HEK non-detection converted to an occurrence rate is sensitivity-as-occurrence, a flagged family, and it was load-bearing on the low end of the Reservoir Model's target. Re-anchor on Hansen plus the co-orbital precondition.

### C4 — Irregular capture (the Jovian tail)

**Physical precondition.** The parent's Hill sphere can hold a distant orbit against solar tides, and it sits where a planetesimal reservoir existed (`parentOrbitAU` relative to `zones.frostLine`).

**Likelihood: none.** A count law, not a roll: `N_irr ∝ R_Hill² × Σ_local` — capture cross-section times local planetesimal density, both derivable at `MoonGenerator.js:117`. The `a²` dependence recovers the Jupiter/Uranus contrast (~80 vs 9), so the law has an independent check. **One normalisation constant, anchored on a Jupiter analogue (5 AU, solar mass, `[Fe/H]=0`, → ~100), falsified against all four giants with Neptune pre-flagged as a Triton-disrupted outlier.** That is a unit conversion anchored on a named real object and checked against four independent ones — the only honest template for a constant anywhere in this program, and it should be the pattern C3's constant follows too.

**Mass rule.** Absolute km-scale from a broken power law (shallow above ~8 km; Dohnanyi below — note the *differential* slope is `D^-3.5`, and the `-2.5` some sources quote is the cumulative exponent; label it correctly). ⭐ **Budget corrected to 2.6e-9**, not the 1e-8 all three designs used: Jupiter's irregulars total roughly 5e18 kg against 1.898e27, and the designs were ~4× generous. The four-order gap below C1's 1e-4 *is* the bimodality, and expressing it as a mass budget rather than a size band is what makes it survive the mass-first rework instead of being re-tuned by it.

⭐ **Retrograde majority becomes an output, not an authored constant.** All three designs asserted a ~0.75 retrograde fraction and capped both senses at ~0.5 R_H. Domingos et al. give **0.4895 R_H prograde and 0.9309 R_H retrograde** — a phase-space volume ratio of `(0.93/0.49)³ = 6.8`, against Jupiter's observed ~10:1. Use both coefficients and the majority falls out of the geometry. Inclinations exclude the 55–130° Kozai-unstable band.

⭐ **`retrograde` becomes a real record field.** Today `MoonGenerator.js:179` declares it as a local consumed once at `:203` as a sign flip on `orbitSpeed` and never written into the literal, while inclination is drawn separately at `:174-176` as ±0.5 rad — so a "retrograde" moon is a low-inclination body moving backwards, not the i≈152° object the capture literature means. `SolarSystemData.js:468`/`:607` **do** carry `retrograde: true`, so any law reading `moon.retrograde` works on Sol and reads `undefined` on every generated moon.

**Count rule: instantiate the head, account the tail.** Materialise the largest ~4 as real records (Himalia/Phoebe class, 85–100 km); carry the rest as `irregularSwarmCount` plus a size distribution. `main.js:7683-7696` gives every moon an unconditional 2px `Billboard`, a `PlanetBillboard` and an `OrbitLine` with no size gate anywhere, and each costs a child rng at `StarSystemGenerator.js:594` plus a record in every hash. The game gets the number, the distribution and the swarm mass — and about a dozen bodies.

### The partition rule

⭐ **`m_k ∝ Σ(a_k) · a_k · Δa_k` with `Σ ∝ a^(-p)`, evaluated deterministically, with mass rank decoupled from orbital rank.**

This is a three-way graft and each piece is there for a reason the judges established:

- **The feeding-zone law** (Reservoir Model) couples mass to orbit, which is what a real disk does and what the generator currently gets wrong in *both* directions at once — orbits unordered per §3.1, masses orbit-independent per §2.1.
- **Deterministic evaluation** (Budget-and-Cascade). The Four-Channel design's stick-breaking costs one uniform per moon, so `alpha` only shifts the distribution a parent is *drawn from* and two systems at identical `alpha` produce visibly different architectures. Determinism is the more literal reading of "based on the SYSTEM ATTRIBUTES." ⚠ **The cost, which that design never named: determinism buys anti-dice-roll credit and pays in visible sameness.** Large numbers of parents with similar mass will get near-identical mass ratios. Accept it, and measure it (§4).
- **Mass rank decoupled from orbital rank** (Four-Channel design). ⛔ This is what kills the Budget-and-Cascade design's centrepiece: `m_k = φ(1−φ)^(k−1)` indexed by orbital rank is strictly decreasing outward, placing the dominant moon *innermost*. Saturn's Titan is 6th of 7 by distance holding 95% of the mass; Jupiter's largest is Ganymede, 3rd of 4, with shares 0.227/0.122/0.377/0.274 — not monotone at all. The rule cannot reproduce either system it names. Concentration correct, placement inverted.

**Where `p` comes from — stated honestly.** `p` is a **fitted calibration parameter** with a stated monotone dependence on parent mass (a more massive parent sustains a higher-density, longer-lived disk, so several satellites survive type-I decay instead of one runaway body → lower concentration) and on the parent's position relative to `zones.frostLine`. The monotonicity is the physics; the number is a fit. ⛔ **The code comment must say so in those words.** `PhysicsEngine.js:588`'s docstring is the cautionary case one file over — a whole function claiming physics-driven derivation while `dissipationMyr` at `:604` is a bare uniform. Do not repeat that move.

⭐ **The acceptance test for `p`, and it is the strongest single test in this plan:** a **single** `p`-law must reproduce Jupiter (spread across four) and Saturn (Titan at 95%) at their measured budget ratios of 2.07e-4 and 2.48e-4. Those two sit at effectively the same `q` with opposite architectures, which is why `q` was refused as the concentration driver and why a `q`-threshold would have been a fitted constant wearing Crida & Charnoz's name. ⚠ **Risk stated up front: a single `p` reproducing both may not exist.** If it does not, the fallback is mass-rank/orbit-rank decoupling with an explicit concentration parameter — not a second fitted term added quietly to rescue the first.

⚠ **Crida & Charnoz is not cited for this.** Their fast-vs-slow spreading result concerns satellites accreted from ring material spreading past the Roche limit (Saturn's mid-sized moons), a different regime from the Canup–Ward gas disk. Borrowing its direction while citing its name would be a regime mismatch.

### Mass → radius, with self-compression

⭐ **Cross-cutting correction none of the three designs caught.** All three wrote `R = (M·ρ⊕/ρ)^(1/3)` with `ρ` from composition — which has no mass dependence. At 8 M⊕ and Earth density that returns **exactly 2.00 R⊕**, the owner's number, whereas mass–radius relations for rocky composition give ~1.75–1.8 R⊕ (`R ∝ M^~0.27`, so `8^0.27 = 1.75` against `8^0.333 = 2.0`). The designs are hitting "2 R⊕" ~13–19% through an uncorrected constant-density inversion. **`ρ` must be a function of mass and composition, not composition alone**, or Band B radii are knowingly inflated. This matters most on exactly the object Max asked about.

---

## 2. HOW IT GROWS OUT OF THE EXISTING PIPELINE

Directive 2 asked for a system that *works with* rather than *gets patched onto* the generator. The concrete test of that is whether the channels use the pipeline's existing seams or add new ones. They use existing seams, and here is the seam-by-seam account.

**The data contract does not change.** Every quantity the four channels need is already on the nine-field `zones` literal (`StarSystemGenerator.js:457-467`: `frostLine, hzInner, hzOuter, starType, metallicity, sizeBias, luminosity, ageGyr, starMassSolar`) or on `planetData` at `MoonGenerator.js:117`. Two consequences worth stating because they are the cheapest facts in the plan: no new draw lands before `StarSystemGenerator.js:510`, so `rng.child('planet-' + i)` at `:512` keeps its seed and no planet, belt or trojan moves; and `PlanetGenerator`'s `||`-vs-`??` hazard (`zones?.luminosity || 1.0` at `:368`, `zones?.starMassSolar || 1.0` at `:372`, `zones?.ageGyr || 4.5` at `:373`, `zones.metallicity || 0` at `:364`/`:376`, against `MoonGenerator.js:248-251`'s documented `??`) is never exercised, because no new zones field exists to be misread.

**One system-level addition, zero draws.** `deriveFormation`'s return (`PhysicsEngine.js:620-626`) gains `solidInventory = starMassSolar × solidFraction` — the `:598` expression **without** `:599`'s `(0.5 + rngFloat1)` scatter — feeding C4's `Σ_local` only. It is free: the function already consumes its two floats at the call site (`StarSystemGenerator.js:417`), the body-identity fence's system record does not include `formation`, and `ProcgenSnapshot.test.js` is already red in `known-failures.json` with all 23 per-sample deep-equals failing. ⛔ `formation.diskMass` and `formation.dissipationMyr` are **refused** as channel inputs, and the refusal goes in the code comment: per §0, `starMassSolar` cancels out of both archetype clauses and archetype is decided entirely by a bare uniform. Hanging a channel there would launder a dice roll through a second dice roll wearing the unit "Myr."

**Per-parent count and plan — `PlanetGenerator.js:587-596`.** `maxMoonsByType` is 16 keys with no `ice` and no `lava`; `?? 1` at `:595` silently caps both at one moon, which is why the whole ice-parent type branch at `MoonGenerator.js:521-524` can currently fire at most once per parent. `rng.int(0, maxMoons)` at `:596` is **one draw regardless of ceiling**, so the count law is draw-count-neutral and nothing after it in `PlanetGenerator` shifts — storms (`:625-672`), `axialTilt` (`:687-689`), `rotationSpeed` (`:698`), `noiseDetail` (`:782`) all hold. Everything the law needs is already computed and sitting unused on that line: `radiusEarth` (`:333`), `massEarth` (`:359`), `composition` (`:363-365`), `T_eq` (`:369`), `tidalState` (`:409`), `orbitRadiusAU`, and all of `zones`.

**Channel decision — `MoonGenerator.js:122-125`.** `isLargeParent = planetData.type === 'gas-giant' || 'sub-neptune'` is the only gate opening the big-moon branch, and the channel selector replaces it in place. The Nakajima gate and the Hansen period term are computable here with **no reorder and no new argument**. ⛔ Watch the short-circuit: JS evaluates `isLargeParent && moonIndex > 0 && totalMoons >= 3 && rng.chance(0.10)` left to right, so a non-giant parent makes **zero draws** at this site today. An unconditional probability evaluation adds a draw to every moon of every rocky/ice/terrestrial parent — a draw-stream change across a large population that must be predicted, not discovered. Keep the cheap binary gate first.

**Mass sampler — replaces `_pickRadius` (`:311-338`, called at `:132`).** ⭐ The inverse identity already exists and is already defended: `MoonGenerator.js:418`'s `massScale = (radiusEarth / pData.radiusEarth) ** 3`, whose comment at `:405-417` calls preserving density "the physically correct invariant here: it is the same material, less of it." Mass-first reads that same equation backwards and turns the invariant the comment defends into the sampler's driver. That is the sharpest illustration of directive 2's "works with": the code already knows the relation, it is just being read in the wrong direction. `_pickRadius` must still emit the **map radius** (`radius: fraction * planetData.radius` at `:336`), derived from the `radiusEarth` ratio — it feeds the inverse-radius `noiseScale` floor at `:209` and `new OrbitLine(moonData.orbitRadius, …)` at `main.js:7690`.

**Composition before size, and the merge.** `deriveComposition` (`:250-260`) moves above `:132`. `_generatePlanetMoon` merges into the shared tail — required three times over: shape must reach the population Max actually flies to (`return this._generatePlanetMoon(...)` at `:124` exits before the append block, which is why planet-class records carry 20 keys to the plain population's 25 and why `massEarth` is absent from all 24 planet-class records), the two-record-shape defect closes, and per §0 it is the **only** thing that collapses `PINNED_STREAM_SET`.

**Orbits — `:139-176` and `:386-400`.** The overlapping bands (`close: [6,12]`, `mid: [12,30]`, `far: [30,60]` at `:150-154`) plus the *additive* `zoneSpread = moonIndex * rng.range(3, 8)` at `:157` are what let an inner-index moon land outside an outer one. Note the position costs exactly two draws today — `:157` is drawn unconditionally even at `moonIndex === 0` where the value is multiplied away, plus `rng.range(minMult, maxMult)` at `:158`. An ordered log-spaced ladder wants one, so draw-parity requires **deliberately retaining a vestigial draw** for fence parity. Verify parity before predicting the delta, not after.

**Record appends — the Step-8a block, `:230-302`**, with `composition` at `:262` and `massEarth` at `:266`. The file's own comment at `:231-236` establishes this block as byte-safe for zero-draw plain assignment. `moon.figure`, `moon.channel`, `moon.retrograde` and `contextSource` all land here. ⭐ **Assigned unconditionally on every moon, with explicit nulls** — `body-identity-fence.test.js:777-780` asserts `shapes: 1` per class, and a conditional append (exactly what a channel model naturally produces) reports as `shapes: 2, keyCounts: [25, 27]`, downgrading the strongest uniformity assertion in the tree rather than blessing itself.

**Ordering the plan deliberately does *not* change.** Migration resolves at `StarSystemGenerator.js:629` and retypes to `hot-jupiter` at `:662`; belts at `:738`; the array is still filling at `:510-624`; `ExoticOverlay` retypes at `:921` — all after the moon loop at `:592`. No channel reads any of them. ⭐ **And the belt coupling needs no reorder at all**: belts do not cause captured moons; a shared planetesimal surface density causes both. Feed the reservoir to both consumers and the correlation falls out — a causal-direction fix rather than a scheduling one. `MoonGenerator.js:293-299` already reasons its way to exactly this deferral for `nearBelt` and names the correct owner; the plan agrees with the code and then removes the need. Moving `computeMigration` earlier is *not* a small reorder — `PhysicsEngine.js:536-579` reads planet types and orbits from the finished array, so it needs the loop split into two passes, reordering every planet's draws in the game.

⚠ **The hot-jupiter incoherence is sidestepped, not fixed.** `maxMoonsByType['hot-jupiter'] = 0` is unreachable for migrants because `moonCount` was drawn while the body was a gas giant, so a natively-typed hot Jupiter has no moons and a migrated one keeps a full Jovian retinue. Gating on parent **mass** and composition rather than the type label means no channel law depends on `hot-jupiter` being a coherent class — but the retention consequence stands and belongs to the post-migration pass `MoonGenerator.js:298-299` already names.

---

## 3. THE BUILD SEQUENCE

The instrument battery charges a **fixed toll per population move**: re-derive `PINNED_STREAM_SET`'s 64 lines, ~35 `moon-condition-contract` literals, six in-file `body-identity-fence` literals, one Instrument C re-record. Neither `moon-rng-stream-identity.test.js` nor `moon-condition-contract.test.js` has any re-bless mechanism — no flag, no baseline, no `--record` — so both need a purpose-built capture harness. A one-line fix costs the same toll as a hundred-line one.

⭐ **Ruling on sequencing.** The Reservoir Model proposed 13 steps with ~6 population moves; the Budget-and-Cascade design 9 steps with 5. Both correctly stated the fixed-toll fact and then scheduled multiple tolls anyway. **One window.** And §0 removes the objection to it: the Four-Channel design justified its single window with a false claim (that fixed draw counts collapse `PINNED_STREAM_SET`), but the window is still right on sounder grounds — the *other* re-derivations are genuinely once-per-move, and the collapse does happen once `_generatePlanetMoon` merges, which is in-window for independent reasons.

⭐ **Ruling on the Budget-and-Cascade design's "each step independently valuable" priority: it does not survive.** Its step 2 promised ordered orbits plus Hill *and Roche* clamps, independent of the mass work, with the Roche clamp landing in the append block. Verified in §0: `orbitRadiusEarth` is consumed at `:161` and by `_computeTidalHeating` at `:185`, both before that block, so a late clamp ships `tidalHeating` derived from an orbit the record no longer carries — a fresh instance of the exact bug family this work exists to close. The Hill clamp alone survives at orbit time; the Roche clamp needs `ρ_moon`, hence composition, hence the window.

### B0 — Metrics tool. Cost: **zero**.
New read-only `tools/moon-census.mjs`. Emits `m̄`, mean count per parent type, Band A rate per terrestrial planet **and** per system, Band B rate per giant and per system, mass-ratio distribution, `R_Hill` and Roche violations, sibling-order inversions, regular/irregular split, and **terrestrial-planet multiplicity**. Commit today's baseline as a dated doc. A tool is not a test, so Instrument A's per-file counts are untouched. *Verification:* the tool runs and the baseline is committed. This is first because every later claim is unfalsifiable without it — the Band A target was mis-scoped once already because `m̄` was assumed at 20. ⛔ **And 3.69 is wrong too — MEASURED by this tool: 3.5928 on FENCE-221, 3.7453 / 4.0510 on the others. 3.69 reproduces on no corpus.**

### B1 — Ring-divisor fix. Cost: **zero**.
`PhysicsEngine.js:912` divides by the **moon's** `radiusEarth` under a comment claiming parent radii, and `:916` consumes it as `outerRadius`. Verified dead — `moons: []` at `PlanetGenerator.js:567` and in all three `PhysicsEngine.test.js` call sites — so the fix moves zero bodies and is provable by unit test alone. Do it before anything makes the branch live. *Verification:* new unit test; `check:instruments` green.

### B2 — Citation pre-pass. Cost: **zero to the universe**.
Add `tests/moon-condition-contract.test.js` and `src/generation/ExoticOverlay.js` to `CITE_SOURCES` (`tools/port-uniform-delta.mjs:1023-1090`) and repair the ~13 in-edit-zone refs **by symbol, before anything moves**. Also fix the already-rotten unchecked refs: `body-identity-fence.test.js:128` and `:406` cite `MoonGenerator.js:155` for "the live conditional draw," but `:155` is `const [minMult, maxMult] = orbitMultipliers[orbitZone];` and the retrograde draw is at `:179`; `:106` cites `:186-201` for draws that are at `:211-227`. *Verification:* `--check-citations` exit 0 with a **higher** checked count than today's 401/447.

### B3 — Formation context + null-zones contract. Cost: **zero draws, zero bodies**.
`solidInventory` onto `deriveFormation`'s return and the `zones` literal; nothing reads it yet. Plus the null-zones contract: `tests/moon-mass-radius-consistency.test.js:25` calls `generate` with **four** arguments, so `zones` and `parentOrbitAU` are null. ⭐ Graft the Budget-and-Cascade design's `contextSource: 'derived' | 'default'` field — the only concrete mechanism any design proposed for making a defaulted body **detectable** rather than silent, which is what stops this reintroducing reconciliations §1 sub-shape A into the fix meant to close it. Guard the white-dwarf hazard in the same commit: `STAR_PROPERTIES.D` has `radiusSolar 0.01`, so `starMassSolar = 0.01^1.25 = 0.0032 M☉` for a ~0.6–1.0 M☉ body, zeroing anything keyed on stellar mass. *Verification:* `check:instruments` green with the code in place — provable no-op.

### B4 — PREDICTION COMMIT. Cost: **zero**. Opens the window.
Per the C7 template at `9ebb24b` and the artefact shape of `docs/FEATURES/step8b-c7-delta-table-2026-08-14.md`. States in advance: the predicted moved-record partition across 961 planets / 770 plain moons / 24 planet-class moons; that Instrument C reports a **structural** population mismatch (exit 2 at `tools/port-uniform-delta.mjs:2066`, **before** the `--allow-deltas` branch at `:2071`) covering 178 moon-bearing S rows and all 64 P rows; and the predicted new rates. ⛔ **It must name the composition-value move explicitly.** Re-keying `compSeed` (`:256`, which embeds `moonRadiusData.radiusEarth` and `type`) and the `moonecc:` key at `:358` makes `namespacedFloat` (`:578`) return a different float for **every** moon in the game, moving `carbonToOxygen`, `ironFraction`, `volatileFraction`, `surfaceType` and `density` on the whole population including bodies the sizing never touched — and `namespacedFloat` takes **zero rng draws** (`:543-577`), so DRAW STREAM reports green through all of it and it surfaces only on BODY IDENTITY. ⚠ Also state that the parameter-free composition identity gate at `moon-condition-contract.test.js:528-542` will read **green** straight through that reshuffle and must not be cited as evidence the reorder was safe. ⛔ Per `world-engine-reconciliations-2026-08-15.md:241`, "plain moons stay 0/770" is now a **failure** statement; edit `body-identity-fence.test.js:740`'s partition literal accordingly. Revert target for the whole window is this commit.

### B5 — THE WINDOW. Cost: **the full toll, once.**
One coherent series, instruments red throughout, auditable against B4:

1. Channel selector before type at `:122-127`; Nakajima gate from `composition.volatileFraction`; `moon.channel` unconditional on both populations.
2. Composition before size; `compSeed` and `moonecc:` re-keyed off pre-size identity.
3. Mass-first sampler replacing `_pickRadius`; `R` from mass **with self-compression**; map radius from the `radiusEarth` ratio.
4. `_generatePlanetMoon` merged into the shared tail.
5. Feeding-zone partition, deterministic, mass rank decoupled from orbit rank.
6. Ordered orbits 5–30 R_p with Roche and Hill clamps; `orbitSpeed` recomputed from `a` at **both** `:171` and `:400`.
7. Count law at `PlanetGenerator.js:595-596`; `ice`/`lava` table repair.
8. C4 irregular tail: absolute km sizes, 2.6e-9 budget, both Domingos coefficients, real `retrograde` and inclination, head materialised / tail summarised — **with its render policy in the same commit**.
9. `ExoticOverlay.js:367-397` driven off the parent **mass** ratio, not the radius ratio, with radius re-derived from the moon's own density.

⛔ **Before deleting the 57/7 disjointness at `moon-rng-stream-identity.test.js:287-290`, write its replacement and show it fails on the same `postmigration` mutant described at `:271-278`.** It is the only assertion in the tree separating the generation-time-AU convention from the post-migration one, is marked "do not relax this to a range," and is what guards C7's fix. The replacement — every moon's derived `T_eq` equals `equilibriumTemperature(zones.luminosity, parentOrbitAU)` at the parent's generation-time AU — is a stronger and more direct test of the same property, but it is neither free nor automatic. This is the sharpest artefact any of the three designs produced and it ships regardless.

### B6 — Citation repair. Cost: **six fatal repairs, not four.**
`MoonGenerator.js:185, 217, 220, 378` (cited from `conditionFromBody.js:351,352,404,641`, `port-condition-contract.test.js:2020,2021,4019`, `PLAN.md:853`) **plus `PlanetGenerator.js:687`** (`conditionFromBody.js:185,239`), plus `:560` (`conditionFromBody.js:240`) if any insertion goes above the rings block. ⚠ `MoonGenerator.js:378`'s ref is anchored on `Math.max(parentOrbitAU ?? 1.0, 0.01)` from `PLAN.md` — the merge **dissolves** that line rather than moving it, so the repair is rewriting a shipped-plan assertion, not renumbering. *Verification:* `--check-citations` exit 0.

### B7 — The re-derivation pass. Closes the window.

**Re-blesses (a command):**
- `tests/baseline/body-identity.json` — `npm run test:body-identity:rebless`
- `tests/baseline/port-uniform-capture.json` — `node tools/port-uniform-delta.mjs --record --force` (refuses without `--force`, exit 65)
- `tests/baseline/known-failures.json` — `npm run test:baseline:record` ⚠ only on a clean tree with the 24 known failures confirmed unchanged; a re-record taken while an unrelated failure is live silently blesses it
- `src/generation/__tests__/__fixtures__/l0-moon-baseline.json` — `node .../regen-l0-moon-baseline.mjs`. Easy to miss and it is a hard byte gate over 5 moons (`world-engine-l0-plumbing.test.js:473`, `MOON_BASELINE_KEYS` intersection at `:457`); its fixed gas-giant parent at `totalMoons 5` puts rows 1–4 in the channel branch, so a row can flip population and change the key set.

**Re-DERIVATIONS (no mechanism exists):**
- `moon-rng-stream-identity.test.js`: `PINNED_STREAM_SET` (`:133-198`), `POPULATION` (`:226`), `PARTITION`/`DISJOINTNESS` (`:282-290`), two-corpus `ORPHANS` (`:349-356`). The corpus size is asserted in the same block (`:255`) because the key set is still growing at N=1500, so widening it reds by construction. Assume a capture harness is needed **even though** the merge collapses the planet-class width — the plain lines still move.
- `moon-condition-contract.test.js`: ~35 literals on **its** 197-seed corpus, not the fence's 221. Its header warns the same quantity reads 1.2499 g here and 16.16 g on `wd-0..1499`, so no threshold survives a corpus change.
- `body-identity-fence.test.js`'s six literals the env var does **not** rewrite: `PLANET_CLASS_MOONS` (`:288-293`, asserted at `:703` against the literal deliberately), population (`:687`), `onDisk` (`:697`), `moonShapeCensus` (`:777-780`), `hiddenBodyKeys` (`:787`), `bakeMisses` (`:804`).

**Two gate-semantics decisions that must be made here, not skipped.** The mass identity at `moon-condition-contract.test.js:245` goes **tautological** under mass-first — `MoonGenerator.js:266` computes exactly `radiusEarth³ × density/RHO_EARTH`, so it becomes the definition of radius. Replace it with an assertion that sampled masses sum to the channel budget under the partition rule. Its companion at `:304` (POST-OVERLAY) does **not** go vacuous — it is what catches `ExoticOverlay.js:388`'s `moon.massEarth *= kEarth ** 3` — and stays load-bearing and green.

⛔ **Do not read the post-record Instrument C green as coverage.** 242 of 526 rows were re-baselined, not verified; and because `systemContext` is data-only (`adaptL0.js:41` passes it through, nothing reads it) those 178 exclusions carry zero uniform information. Say so in the report.

### B8 — Acceptance tests and calibration.
`tests/moon-formation-rates.test.js` asserting: Band A per terrestrial planet inside [0.022, 0.25] with central near 0.083; Band A per system inside 6.7–25%; Band B per system against its Hansen-anchored target; `m̄` emitted; zero moons outside `0.4895 R_H` prograde / `0.9309 R_H` retrograde; zero inside Roche; zero inverted sibling pairs; mass-ratio tail bounded; the **Jupiter/Saturn two-point partition test at a single `p`**; the four-giant `N_irr` check with Neptune flagged. Set C3's and C4's normalisation constants here by measurement and record the values in the delta-table doc. ⛔ **No rings-vs-moons correlation test** — ringed planets already show moons 67% vs 52% purely because gas giants score high on both per-type tables, so such a test passes on unmodified code unless it controls for planet type. Costs one Instrument A re-record.

### B9 — Shape, last, per Max's ruling.
`moon.figure = { hydrostatic, R_potato_km }` by plain assignment beside composition (`:262`) and mass (`:266`) — downstream of channel → mass → composition **by placement, not by policy**. ⭐ And the ruling is vindicated rather than merely obeyed: before B5's irregular tail exists, essentially every moon is far above the hydrostatic transition, so a shape flag shipped early would read `hydrostatic` on the entire population and mean nothing. ⚠ Pin the threshold first: the ~300 km rocky potato radius is an inversion of Lineweaver & Norman, **not a citation** (the PDF did not parse). Use `R_crit ≈ sqrt(3Y/(4πGρ²))` with `Y` named as the material parameter, anchored on observations (Mimas round at 198 km, Proteus not round at 210 km, Ceres round at 470 km) and labelled as an empirical anchor.

### B10 — Separate, not a prerequisite: fix `deriveFormation`.
Per §0 the function is degenerate: `starMassSolar` cancels, both `diskMass` clauses are unreachable/always-true at solar metallicity, and archetype is decided entirely by a bare uniform while the docstring claims otherwise. Nothing in B0–B9 depends on it — which is exactly why it is last. It is filed here so the next reader does not find `formation` sitting there looking like a legitimate conditioning source.

---

## 4. INSTRUMENTS THAT DO NOT EXIST YET

**Mean moons per system (`m̄`) and the per-parent-planet rate.** Without these no target in this plan is testable, and their absence has already caused one mis-scoping: the Band A conversion assumed `m̄ ≈ 20`, turning a 3.1% per-moon figure into a hypothesised 62% of systems. ⛔ **The 3.69 written here is ALSO unmeasured — the census reads 3.5928 on FENCE-221 (3.7453 / 4.0510 on the others), so the real figure is ~11% per system.** B0 builds them first.

**Terrestrial-planet multiplicity.** ⭐ The highest-risk unknown in the plan. Elser's 8.3% converts to 1-in-4..1-in-15 systems **only** through ~3 terrestrial planets per system. If this generator's multiplicity differs, the per-system rate lands outside the bracket even with the per-planet rate exactly right. B0 measures it **before** any change, so it is caught early. ⛔ If it is off, the defect lives in `PlanetGenerator._pickType` and must be **reported, not absorbed** by tuning the moon rate to compensate — absorbing it would recreate the exact bug family this work exists to close.

**Architecture variance at fixed parent attributes.** The deterministic partition buys anti-dice-roll credit and pays in visible sameness. Measure it rather than assert it: report the spread of satellite architectures across parents at matched mass and orbit. This is the number that tells us whether "predictable" has become "identical."

**A pixel-level gate for the plain population — named, not built.** 770 bodies render through `Moon.js`, which has zero worldengine imports, and Instrument C's P stratum harvests only `m.isPlanetMoon` bodies. The population carrying the 195 over-1e-3 tail this workstream exists to close has value gates and hashes but **no visual gate at all**. This plan does not build one; it names the gap so nobody reads a green Instrument C as covering it. Per the standing rule, whether the result looks right is Max's eyes on a procedural system (`_lab.spawnProceduralSystem` or Caph) — never Sol, which is NASA-textured on a different renderer with no condition fields and cannot validate any of this.

**Not a cost, and not safety.** `tests/port-condition-contract.test.js` (526 planets, 66 tests) stays green throughout — `conditionFromBody.js` and `conditionVector.js` never read `systemContext`, and moon changes do not reorder planets. Nobody should budget for it, and nobody should cite its green as evidence.

---

## 5. WHAT IS DEFERRED

**Binary planets — deferred on the renderer, not on physics or cost.** This is the honest framing and it is a better conversation than "binaries are hard." Every consumer assumes a moon orbits its parent's centre: `main.js:7690-7692` constructs `new OrbitLine(moonData.orbitRadius, …)` and then sets the mesh position to the planet's `(px, pz)` — the orbit is a circle *centred on the planet*, by construction. A barycentric pair pushed through `moons[]` would seed a barycentre bug into the renderers, the orbit lines, the SOI/gravity model and the save format, and would make this fix's own verification unreadable. The rates are real and worth having (Ochiai et al. 2014 ~10% of systems undergoing crossing; Lazzoni et al. 2024 14.3% per simulated system, both gas-giant only) — which is precisely why they are 15–35× commoner than Band B and would materially change what a pilot encounters. ⭐ **Deferring costs nothing directive 2 asked for**: Max was told large moons and binary planets were either/or, and they are not. C3 delivers the ~2 R⊕ companion around a gas giant *now*, as a satellite with the barycentre inside the primary. Binaries are the complementary channel in the solid-parent regime. **Re-entry condition:** the partition machinery already generalises (a binary is a partition at the planet level), so this unblocks the moment the orbit stack supports a barycentre.

**Johnson et al. 2010 at the moon layer** — refused, per §1. Correcting `PlanetGenerator.js:875`/`:991` to Johnson's exponent is the right home and moves the whole 961-planet population; its own workstream.

**Dobos et al. 2021 as a multiplier** — not applied. Measured on the actual moon-hosting population, 683 of 896 parents (76%) sit above 300 days on the flat 70–90% top of the curve and only 23% fall in the discriminating 10–300 day window: a near-constant ~0.8 factor, which is trap 5 in its most seductive form. Worse, the sub-10-day population where it genuinely bites **does not exist** at moon-generation time — `computeMigration` manufactures it 37 lines later (`PhysicsEngine.js:557` sets `targetAU = 0.03 + u*0.08`, called at `StarSystemGenerator.js:629`). And it discriminates mostly *between* star types (M 61% under 300 d, A 0%) because `innerOrbitAU` and `maxOrbitAU` both scale as `sqrt(luminosity)`, so it partly restates the stellar-mass axis. The same physics enters honestly through C1's Hill-scaled annulus count and C3's `1/P` term.

**Patel 2025 / Zollinger 2017 / Barnes & O'Brien 2002** — not claimed as load-bearing. Barnes & O'Brien's `M* > 0.15 M☉` floor is never crossed (the generator's minimum is 0.181), Zollinger's ≲0.2 catches only the 0.181–0.200 sliver, and M dwarfs are weight 0.18 here (0.108 in-game at R=8 kpc) against a real ~75%. The literature's largest suppressor is nearly inert in this generator; listing it as implemented would be fiction.

**Rings ↔ moons coupling** — deferred past B1's divisor fix. `PlanetGenerator.js:552` draws `originRoll` and sets `ringOrigin` (including `'roche'`, which literally means a moon was destroyed) **44 lines before** `moonCount` exists at `:596`. And the ring's `moonDensity` is authored per origin at `PhysicsEngine.js:863-885` and never reads a real moon's `composition.density` — the gap is two layers deep.

**`GravityField.js:179 _estimateMoonMass`** — left alone. Cheapest fix on paper; silently changes SOI radii on a flight model Max has been flying for months with no artefact to judge it by, and its error is worst for planet-class moons, exactly the bodies a pilot enters an SOI around. Follow-on with its own before/after artefact.

**115 rendered moons at Jupiter, and any minimum render/selection size.** The game gets the count, the distribution and the swarm mass — and about a dozen bodies.

---

## 6. OPEN QUESTIONS FOR THE OWNER — ⭐⭐ ALL FOUR ANSWERED 2026-08-15

> **Q1 — visibility policy. ANSWERED: the recommendation stands.** Suppress orbit lines below a
> size threshold; give the swarm a single billboard. **B5 is unblocked.**
>
> **Q2 — Band A rate. ANSWERED: the recommendation stands.** Elser's **central 8.3%** per
> terrestrial planet, with the 2.2–25% bracket as a runtime clamp. Not the low-end bias.
>
> **Q3 — binary planets. ANSWERED, AND IT IS NOT A PLAIN "DEFER":**
> *"I would like there to be binary planets in our system… Although I do eventually want these to
> be renderable and to fly through them where appropriate. Anyhow, we can defer that side of it."*
> ⭐ **Read precisely: he wants binary planets to EXIST. What defers is the RENDER side.** §5's
> deferral was argued entirely on renderer grounds and is therefore still correct *as to rendering*
> — but "deferred until the orbit stack supports a barycentre" is no longer the whole answer,
> because the generation half was never the blocker. ⛔ **Do not let §5 be read as "binaries are
> out of scope."** The open design question is now narrower and belongs to its own scoping pass:
> can the pair be generated with correct barycentric physics while the renderer draws it
> provisionally (primary-centred, flagged) until barycentre support lands — or does a provisional
> render seed exactly the barycentre bug §5 warns about? **That question is not settled here.**
>
> **Q4 — irregular-swarm materialisation. ANSWERED: ~4 per giant "seems roughly right."**
> With the same forward note: he eventually wants the swarm renderable and flyable. Recorded as a
> direction of travel, not as scope now.

⚠ **One number in this plan's own framing was already corrected by it and must not regress:**
`m̄` is **measured at 3.5928 on FENCE-221** (⛔ the 3.69 first written here reproduces on no corpus), not the 20 used illustratively upstream — so today's 3.1% per-moon
figure is roughly **11% per system**, not 62%. **B0 replaces the estimate with a measurement; no
rate claim survives without it.**

---

### The original four, kept for the record

**1. The visibility policy for small moons — this gates B5 and needs answering before it, not at UAT.** Physically-correct captured moons are 10–100 km, and `main.js:7683-7696` gives every moon an unconditional 2px `Billboard`, a `radiusScene`-sized `PlanetBillboard` and a full green `OrbitLine` with no size gate anywhere. So the first thing you see on a live gas giant after B5 is a set of green orbit rings around bodies you cannot see. The options are a minimum render size, orbit-line suppression below a threshold, targetability rules, or a swarm-billboard treatment — and which of those reads right is taste, not physics.

**2. Band A will make Moon-class satellites commoner than the current game suggests, and I want that confirmed rather than assumed.** Directive 3 says implement the literature as measured, and Elser's 8.3% per terrestrial planet gives ~23% of systems with at least one. Today the audit measures **zero** terrestrial plain moons across 221 seeds, so this goes from "never" to "roughly one system in four." ⚠ Worth knowing before you answer: Elser is one 2011 study, 64 simulations, perfect-accretion assumption with a flat 30% angular-momentum correction, in open dispute with Raymond et al. 2009, who found only 4% of late giant impacts met Canup's criteria and concluded the Moon "must be a cosmic rarity." That dispute sits inside the 2.2–25% bracket. Implement the central value, or bias toward the low end of the bracket?

**3. Confirm the binary-planet deferral on the renderer grounds in §5.** The physics is ready and the partition machinery generalises; what is missing is barycentric orbit support. If you want binaries sooner, the work to schedule is in the orbit/render stack, not in the generator.

**4. The irregular-swarm materialisation cap.** The plan records ~4 bodies per giant and carries the rest as a count plus distribution. That gives Jupiter its honest 107 in the data model and about a dozen bodies in the sky. If you want the swarm to be something you can fly through rather than something the record knows about, that is a different and larger scope.

---

**Open items for you**

- **Q1 (visibility policy) blocks B5** — everything before it (B0–B4) can proceed today. My recommendation: suppress orbit lines below a size threshold and give the swarm a single billboard, but it is your eyes.
- **Q2 (Band A rate)** — my recommendation is Elser's central 8.3% with the bracket as a runtime clamp, since directive 3 pins it to the literature; say the word if you want the low-end bias instead.
- **Q3 and Q4** are confirmations, not blockers.
- Three numbers still need pinning before their steps ship: the potato-radius threshold (blocks B9), and C3's and C4's normalisation constants (set by measurement in B8, not by taste).