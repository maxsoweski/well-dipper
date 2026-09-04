# Why the plate path claims 0 of 124 bodies — answered

Max's arc (2), from his *"1 then 3 then 2"* ruling. A GENERATION question, so it is DERIVED, not put
to him (`feedback_physics-first-worldengine-scoping`). READ-ONLY; scripts and raw JSON beside this file.

Repo `~/projects/well-dipper`, branch `feature/world-engine-production-L1`, HEAD `022ba6b`.
Run: `node --import ./scripts/node-alias-motion-test-kit.mjs docs/WORKSTREAMS/f1-mountains-generation-2026-09-04/diagnose.mjs`
(and `tv-sweep.mjs` for the 200-seed widening).

## The short answer

**The generator never makes a temperate WET world, and the plate path requires one.** Not rarely —
*never*: over **1,183 solid bodies from 200 seeds, the temperate set and the wet set do not intersect
once**, and they miss each other by a wide margin on both sides. There is a second, independent block
on top of it: the `locked` test sits ABOVE the band and eats 74 % of all bodies before the band is
ever consulted.

## The dispatch chain, and where all 124 corpus bodies actually leave it

`src/worldengine/dispatch/bodyRelief.js` — two roads reach `plate()`: the seeded band (step 6, when
its modal regime is not 'stagnant') and `geodynamicRegime === 'mobile'` (step 7).

| leaves at | bodies | planets | moons |
|---|---|---|---|
| 4 · `if (locked) return shell('eyeball-despun')` | **67** | 34 | 33 |
| 2 · icy | 29 | 7 | 22 |
| 8 · fallthrough, regime `stagnant` | 13 | 13 | 0 |
| 5 · unbroken lid (hot stagnant, L ≥ 0.63) | 10 | 10 | 0 |
| 3 · heat-pipe (`m_hp > 0`) | 4 | 1 | 3 |
| 8 · fallthrough, regime `dead-lid` | 1 | 1 | 0 |
| **6 · IN BAND** | **0** | 0 | 0 |
| **7 · regime mobile** | **0** | 0 | 0 |

**`plate()` reached by 0 of 124.**

## Block A — `locked` is tested above the band

`locked` on **92 of 124** corpus bodies (**875 of 1,183** at 200 seeds — 74 %): all 58 moons, and 34
of 66 planets. Because step 4 returns unconditionally, no locked body can reach either road to
`plate()` whatever its mass, temperature or volatiles.

⭐ **The corpus's ONE `mobile` body is locked.** `rocky-21/planet/0` — `regime: 'mobile'`, which would
take step 7 straight to `plate()` — is `locked: true` and leaves at step 4. It is also T_eq 1396 K
with L 0.116, i.e. molten, so it is not a plate-tectonics candidate on any physical reading; but it is
the proof that step 4 is a hard cap on step 7 and not merely redundant with it.

⚠ Locking moons is physically right (moons ARE tidally locked) and this report does not propose
removing the gate. It records that the gate, not the band, is what closes the door for 74 % of bodies.

## Block B — the band is empty, and the killer is temperate × wet

`inSeededBand` (`src/worldengine/base/e1Regime.js`) needs **all three**: mass ∈ [0.6, 1.6] M⊕,
T_eq ∈ [250, 320] K, volatileFraction ≥ 0.12.

Over 1,183 bodies from 200 seeds:

| term | bodies |
|---|---|
| mass in band | 135 (11.4 %) |
| temperate | 135 (11.4 %) |
| wet (V ≥ 0.12) | 352 (29.8 %) |
| mass **and** temperate | 11 (0.9 %) |
| mass **and** wet | 11 (0.9 %) |
| ⭐ **temperate and wet** | **0 (0.00 %)** |
| all three | **0** |

**And it is not a near miss on either side:**
- the **wettest temperate body in 1,183 is V = 0.0595** — half the 0.12 the band asks for;
- the **warmest wet body in 1,183 is T = 186 K** — 64 K below the 250 K the band asks for.

Two separated distributions with a gap, not a threshold that is slightly too tight.

## The root cause, in one law

`src/generation/PhysicsEngine.js` `deriveComposition` makes volatiles a **pure function of orbital
distance**, via `frostRatio = orbitAU / frostLineAU`:

```
frostRatio < 0.5   →  V = 0.01 … 0.06     bone dry
frostRatio < 1.0   →  V = 0.05 … 0.35     transitioning
frostRatio ≥ 1.0   →  V = 0.25 … 0.55+    volatile-rich
```

`T_eq` is a function of *the same variable*, running the other way: closer to the star is hotter. The
frost line is BY DEFINITION where it is cold enough for ice to survive. So "temperate" means "well
inside the frost line" means "bone dry", **by construction**. The two terms of the band are the same
axis read in opposite directions, and no body can satisfy both.

For scale: Earth sits at roughly 0.37 of its frost line, which lands in the *bone-dry* bucket —
**this law would generate Earth itself with V ≤ 0.06**, while the band that gates plate tectonics
demands V ≥ 0.12.

## Why the band asks for a number the generator cannot make

Because **the band was calibrated against the lab's hand-authored presets, and the generator is on a
different scale for the same field.** Measured over all 18 presets, THREE are both temperate and wet
and would enter the band:

| preset | volatileFraction | T_eq |
|---|---|---|
| **Rocky (Earthlike)** | **0.15** | 288 |
| Ocean (temperate) | 0.35 | 295 |
| Eyeball (locked temperate) | 0.25 | 270 |

The lab's own Earth analogue carries **V = 0.15**. The generator's ceiling for any temperate body is
**0.0595** — **2.5× lower**. In the lab the band is reachable and mountains render; in the game the
same band is unreachable, and neither side is aware of the other's scale.

⚠ **Which side is "right" is a real question and this report does not settle it.** Earth's actual
bulk water fraction is ~0.02 % by mass, far below BOTH numbers, so `volatileFraction` is not literally
bulk water on either side. What IS established: the band's `V_MIN = 0.12` is anchored to a preset,
not to physics, and the generator's law is anchored to orbital distance. That is the seam.

## What this means beyond F1

⭐⭐ **There are no Earth-analogue worlds in Well Dipper.** No generated body is simultaneously
Earth-mass, room-temperature and wet — over 1,183 samples, zero. This is much larger than "mountains
do not render", and it is consistent with a number already on record: the river work measured **2 of
124** corpus bodies as fluvially "wet", and both are 0.45 R⊕ carbon worlds, not Earth analogues.

It also explains, without any new measurement, two of the three "unnamed gaps" the 2026-09-03
coverage audit found and could not account for:
- **`writePassiveMargins` never fires** — it is called only on `relief.plateDiag`, i.e. the plate
  path, which no body takes. Same single cause.
- The third gap (no bake crossover below 0.22 R⊕) is unrelated — that one is a display-crossover
  floor, not a dispatch question.

## The forks, for scoping — none of them is "wire `uMountainAmp`"

The runtime gate is already wired and live on 103 of 124 bodies (workstream `solid-relief-deck`), so
mountains DO render today through the analytic combiner. What is missing is the **generative** half:
the plate model that would place ranges along real convergent boundaries.

1. **Re-anchor the band's `V_MIN` to the generator's scale** — the smallest change. At the generator's
   temperate ceiling of 0.0595, a `V_MIN` near 0.04–0.05 would admit the 11 mass-and-temperate bodies.
   ⛔ But it changes what "wet enough for plate tectonics" MEANS, and the same field feeds
   `liquidStability` (`V × 2`, so the fluvial stack), so the blast radius is not local.
2. **Re-anchor the generator's volatile law** so a temperate world can be wet — i.e. decouple surface
   water from bulk ice fraction. The physically honest fix, and the biggest: it moves every body's
   composition and therefore the fluvial, karst, dune and dust populations this session just wired.
3. **Move the `locked` test below the band**, so a locked-but-otherwise-qualifying planet can take the
   plate path. Independent of 1 and 2, and on its own it changes nothing — 0 locked bodies pass the
   band today — so it is only worth doing as part of 1 or 2.

⭐ **1 and 2 are both world-generation product calls with wide blast radius, not derivations.** The
physics-first rule says derive what physics can answer; *which* of two internally-consistent scales
the field should carry is not one of those — it decides what kind of galaxy the game has. That one
goes to Max.

---

# ADDENDUM — the seam is far wider than F1, and Max has ruled on the direction

Max, 2026-09-04, asked whether the galaxy should contain Earth-like worlds:

> **"yes; I want this to be a simulation of the milky way galaxy with a wide variety of
> physically-plausible worlds"**

That converts the fork in the section above from a product call into a **derivation target**, and it
raises the stakes, because the seam is not confined to the plate gate.

## Every temperate world in Well Dipper is a desert to the world engine

The world engine anchors this field at **Earth = 0.15** in three independent places:

- `src/worldengine/base/passiveMargins.js:54` — *"anchored to 1.0 at Earth's volatile fraction
  (D_EARTH.volatileFraction = 0.15)"*, `MARGIN_VF0 = 0.15`
- `src/worldengine/base/labCore.js:693` — `volatileGate = smoothstep(0.05, 0.2, V)`, *"D2 — bone-dry
  floor at 0.05"*
- `driver-presets.js` — `"Rocky (Earthlike)"` `volatileFraction: 0.15`

Run the generator's output through the engine's OWN gate, 1,183 solid bodies from 200 seeds:

| | all solid | **temperate (250–320 K)** |
|---|---|---|
| `volatileGate == 0` — at or under the bone-dry floor | 626 (52.9 %) | **106 (78.5 %)** |
| `0 < gate < 0.25` — essentially dry | 185 (15.6 %) | **29 (21.5 %)** |
| `0.25 ≤ gate < 0.75` | 56 (4.7 %) | **0** |
| `gate ≥ 0.75` — the engine reads this as WET | 316 (26.7 %) | **0** |

⭐⭐ **Not one temperate world in 1,183 reads as wet, and 100 % read as dry or essentially dry.** The
generator CAN make wet worlds — 26.7 % of all solid bodies clear the gate — but every one of them is
frozen. The population is bimodal: **hot deserts and cold ice, with nothing in between.**

The same seam shows in the shelf model: every temperate body's `shelfWidthFactor` lands in
0.652–0.774 against an Earth anchor of 1.0, so every temperate world in the game gets a narrower
continental shelf than Earth, none wider, and the spread is 0.12 wide where the model allows 0.3–3.0.

This is not an F1 problem with a side effect. It is the input half of the fluvial stack, karst, dunes,
dust, coastal margins and the plate gate all reading the same field off a scale the generator does
not share.

## The physics, and therefore the shape of the fix

The current law (`PhysicsEngine.deriveComposition`) is not wrong so much as **doing two jobs with one
field**:

- **Accreted bulk ice fraction** — genuinely a function of where the body formed relative to the frost
  line. The existing law models this correctly and should keep doing so.
- **Surface volatile inventory** — what a body actually has available as water. Inside the frost line a
  terrestrial planet accretes essentially dry and then **receives** its volatiles: Earth's water is
  delivered late, from outer-system material scattered inward, and amounts to only ~0.02 % of Earth's
  mass. That delivery is stochastic and largely decoupled from the body's own frost ratio.

The current law has only the first, so "temperate" implies "formed inside the frost line" implies
"dry", by construction, with no delivery term to break the implication. **That missing term is the
whole defect, and adding it is exactly the "wide variety of physically-plausible worlds" Max asked
for**: temperate worlds would draw a *distribution* of water — mostly low, occasionally Earth-like —
governed by real mechanisms (the system's giant-planet architecture doing the scattering, the body's
mass governing retention, its temperature governing loss) rather than by a single monotone dial.

⛔ **This is a NEW multi-system workstream, not a patch.** It changes composition on every body, and
composition feeds the fluvial / karst / dune / dust / margin / plate populations this session just
wired. It needs `dev-collab-scope`, a parent capture of the current population before any edit, and
acceptance measured on the DRAWN population rather than on a preset — the charter's own rule.
