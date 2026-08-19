# Live integration evidence — `52031fd`, wd-10, 2026-08-18

Driven by working-Claude via chrome-devtools against the running game. **Integration, not UAT** —
these are objective assertions with right answers. The holistic "does it read as a pair" judgment
is Max's alone and is not recorded here.

## AC-SEPARATION — PASS

Drawn separation `|moon mesh − planet mesh|` against each record's `orbitRadiusScene`, all five
planets of wd-10:

| planet | moons | max error |
|---|---:|---:|
| 1, 2, 3, 4 | 6 total | **0** |

The companion at planet 3 measures **1.151999** scene units — the full `a`, 25.1 primary radii.
Not `a/(1+q)` = 0.898. Scoping §3's Convention-B trap is not present.

## AC-WOBBLE — PASS, on §9's prediction

Barycentre recovered from the live meshes (`B = P + (q/(1+q))·(M − P)`), not from the code under test:

| | predicted §9 | **measured live** |
|---|---:|---:|
| primary about the empty point `r1/R_p` | 5.53 | **5.5332** |
| companion `r2/R_p` | 19.55 | **19.5492** |
| sum (= `a/R_p`) | 25.1 | 25.08 |

wd-10's other planets wobble 0.011 / 0.0026 / 0.007 R_p — present, and invisible, as intended.

## AC-PAIR-RINGS — PASS, both branches

All 16 ring proxies on layer 10 enumerated and accounted for, by distance to each planet:

| rings | where | reading |
|---:|---|---|
| 7 | at the star | heliocentric planet + belt rings, unchanged |
| 2 | planet 1's barycentre (0.011 R_p off the planet) | dominated → barycentric |
| 2 | planet 2's barycentre (0.003 R_p) | dominated → barycentric |
| **2** | **planet 3's barycentre (5.533 R_p off the planet)** | **the pair** |
| 3 | glued to planet 4 (0.000 R_p) | 3 moons, undominated → planet-following |

⭐ Zero unaccounted proxies, so the extra ring is not leaking a ring per spawn.

**Screen check** (working-Claude's gate only — two rings vs one, not whether it *reads* right):
two concentric circles about a point with **no body at it**, `MEAMEINATH` sitting on the inner
one. The satellite read — one ring centred on the primary — is gone.

## AC-PAIR-RINGS — the epicyclic branch, closed at wd-133 planet 4 — PASS

Six moons, top share 0.626, so it must NOT get barycentric rings:

| | |
|---|---|
| rings glued to the planet | **6 / 6**, at two samples 900 ms apart |
| max offset from the planet | **0.000002 R_p** |
| planet travelled between samples | 285.19 scene units |

The rings translate as a rigid group with the wobbling primary. No barycentric ring was added.

## AC-LIGHTING-AND-MOONS-FOLLOW — PASS

⛔ **CORRECTION to the first draft of this file, which said "wd-10 is single-star".** It is not:
`_systemData.isBinary === true`, two stars, and the 7 ring proxies at the star centre are 5
heliocentric planet rings **plus 2 star-orbit rings** — itself the binary signature. Measured on the
offset primary at wd-10 planet 3: `_lightDir` and `_lightDir2` are both unit vectors and distinct,
and the moon's copies of both match the planet's to the last digit.

**The arm this change actually edited is the SINGLE-star one, which never runs at wd-10.** Closed
separately at **wd-17 planet 3** (`isBinary === false`, barycentre offset 8.05 R_p): the shipped
`_lightDir` against the true planet→star direction measures **dot = 1 exactly**. The old closed form
`(-px, 0, -pz)` pointed from the barycentre, not the planet.

## ⚠ FILED, NOT FOLDED — a pre-existing separation discrepancy at wd-133 planet 4

Two of its six moons — **both `isPlanetMoon: true`** — draw at a **stable 0.77942×** their record
`orbitRadiusScene` (38.31 → 29.86 and 44.08 → 34.36). Identical ratio for both, unchanged across
four samples, so it is a constant scale and not a render-interpolation artifact.

⛔ **It cannot have been introduced here, on two independent grounds:** `git diff 30b030b..HEAD --
src/main.js` touches no moon-placement line, and a common offset applied to a planet and its moon
leaves their separation invariant by construction. The planet-class companion at wd-10 planet 3
measures error **exactly 0**, so it is not "all planet-class moons" — the two systems differ in that
wd-133 planet 4 MIXES plain and planet-class moons. Unresolved between a real placement defect and a
`_lab.resolveBody` index/handle mismatch in the probe. **Not investigated further: out of scope, and
provably not this change.**

## AC-FLIGHT-STILL-WORKS — PARTIAL

Verified: both bodies resolve and select, every drawn coordinate is finite, the primary sits off
the `y = 0` plane, and the console holds **zero errors or warnings** since navigation.
⛔ **NOT verified live:** an autopilot run to each member, and `dominantBodyAt` near the companion.

## Full-suite count — the verify workflow's headline objection, overturned

`verdict.json` rated three unit ACs INSUFFICIENT because two agents reported counts it judged
"a gap that cannot both describe one repo state." They can. They are two different commands, and
both reproduce on one clean tree at `52031fd`:

| command | files | tests | failed |
|---|---:|---:|---:|
| `npx vitest run tests/` | 192 | 3289 | **7** |
| `npx vitest run` | 329 | 5348 | **32** |

The delta is exactly the four files the path filter excludes — `ProcgenSnapshot` (23 failures),
`componentSystems.byteSafety` (1), `StarSystemGenerator.binary-barycentre` (1), and a scratchpad
collection error (0). **23 + 1 + 1 = 25, and 32 − 25 = 7.** The premise was false; the three ACs it
sank stand on their evidence.
