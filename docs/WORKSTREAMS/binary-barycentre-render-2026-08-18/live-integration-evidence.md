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

---

# Max's UAT, 2026-08-18 — two items

> *"good but one of the planets is not riding along its orbit line; also, the two concentric orbit
> lines intersect with the larger orbit line they ride around the star; I'd like the larger orbit
> line to not cut into the binary planets' orbits."*

## Item 1 — the body off its line. CONFIRMED, QUANTIFIED, and NOT caused by this change.

It is the **companion**, not the primary. At wd-10 planet 3, one instant, all quantities together:

| | |
|---|---:|
| record separation `a` | 1.151999 |
| **drawn separation** | **0.897895** |
| primary → barycentre | 0.254133 |
| its ring's radius | **0.254133** — exact |
| companion → barycentre | 0.643762 |
| its ring's radius | **0.897895** — short by 0.254 |
| `cos∠` between the two about the barycentre | **−1.000000** |

So the *barycentric geometry is right* — the bodies are exactly antipodal and the primary rides its
ring to six decimals. What is wrong is the companion's **distance from the primary**: it draws at
`0.779423 × a`.

### It is a pre-existing defect in planet-class moons, made conspicuous by the new rings

- ⛔ **Not the Convention-B trap**, though it looks exactly like one at this seed: `1/(1+q) = 0.779399`
  for wd-10's `q = 0.283`. But the *same constant* `0.779424` appears on both planet-class moons of
  **wd-133 planet 4**, whose `1/(1+q)` are `0.871839` and `0.944685`. A mass-ratio effect cannot be
  q-independent. The wd-10 agreement is a coincidence of that seed.
- ⛔ **Not render interpolation.** The ratio is identical live and under `_lab.freezeFrame` (0.779423
  both), so it is a static position, not a lerp chord between sim frames.
- ⛔ **Cannot originate here.** `git diff 30b030b..HEAD -- src/main.js` touches no moon-placement
  line, and wd-133 planet 4 is on the *planet-following* branch where no barycentric ring exists at
  all — yet it shows the same constant.
- **Plain moons are exact** (error 0 at every one measured, both systems). It is specific to
  `isPlanetMoon` bodies.
- Before this change the companion's ring was radius `a` centred on the planet, so the body sat 22%
  inside it then too. The barycentric rings did not create the error; they made it legible.

### Root cause NOT yet isolated — and what it will take

`main.js`'s planet-class write is `pp + (cos·r, −sin(incl)·sin, cos(incl)·sin)·r` with
`r = moon.data.orbitRadius`, whose magnitude is `r` exactly. So **`moon.data.orbitRadius` holds
0.897895 at runtime while the record says 1.151999.** `createPlanetMoonBody`
(`PlanetMoonBody.js:51`) sets it from `moonData.orbitRadiusScene`, so something between the generator
record and that wrapper is scaling it by a constant. The wrapper is not reachable from `_lab`
(`resolveBody().holder` is the inner `Planet`, whose `.data` is the moon's own body record and
carries no `orbitRadius`), so closing this needs one instrumentation hook. **Not guessed at.**

## Item 2 — the word is OCCLUSION, and the file it needs is PARKED

What Max describes — a line that treats another as solid and does not cross it — is **occlusion**
(masking); in draughting, the crossing convention is a *line hop* or *bridge*.

⛔ **This is not depth occlusion.** Bodies hide rings behind them via the depth buffer for free, which
is the behaviour he is comparing to. Line-vs-line hopping is a **shader feature** and
`OrbitConicField` is the only thing that puts ring pixels on screen (`OrbitRingSDF.js:49` — "This
class no longer renders anything").

⛔ **`docs/PARKING_LOT.md:239-241`: "Do NOT touch `OrbitConicField.js` before then — it is the
renderer under UAT."** Max's own sequencing ruling, 2026-08-01, deferred until lane B's UAT ships and
the merge arc lands. ⚠ **That precondition now appears met** — lane B's ORRERY triplet shipped and
the trunk merge landed 2026-08-01 — but this tree is lane A's branch, and lifting his own hold is
his call, not mine. The same parking-lot entry already says this area "warrants `dev-collab-scope`
before code."
