# Follow-up — Max's UAT found two things, and only one of them is this workstream's

Max, 2026-09-04, on `rocky-126`'s second planet: *"yep, it works; notable: looks like it's labelled an
icy planet, not room temperature, and it does look icy, but also it has oceans. Any idea why?"*

Two separate causes. **Neither is a defect introduced by the volatile-delivery law**, but the second is
one it made VISIBLE for the first time, which is the charter's own test doing its job.

---

## 1. The LABEL `ice` — a dice roll, and it never read the physics

`PlanetGenerator._pickType(rng, orbitRadius, zones)` picks the game's legacy type string from
**`rng.float()`**, weighted by orbital zone, metallicity and the system's size bias. It does not read
composition, volatiles, density or `T_eq` — it cannot, it runs before them.

So `type: 'ice'` here means *"a random roll in this orbital zone came up ice"*, not *"this world is
icy"*. The world engine ignores it entirely and answers `compositionClass === 'rocky'` for this body,
which is why it grew oceans regardless.

⚠ **Pre-existing and unchanged.** What changed is that the disagreement is now VISIBLE: while every
warm world was a desert, no label could contradict what was drawn. This is the legacy type-branch
string the one-pipeline plan is replacing; it is not worth a patch on its own.

## 2. The WHITE — a lab frost law that had never met a warm wet world

Measured off the live material on the body Max walked:

| | |
|---|---|
| `uFrostMaxCoverage` | **0.834** (parent: **0** — the body was under the bone-dry floor) |
| `uFrostCondensationT` | 273 K (water ice) |
| `uPlanetTempEq` | 292.9 K |
| `uIcenessMix` | **0** — so this is NOT the icy-body path; it is frost deposition |

**The budget law has no temperature term at all.** `labCore.js` computes
`frostMaxCoverage = smoothstep(0.05, 0.4, volatileFraction)` — purely how much water the world has.
The temperature test is delegated entirely to the shader's `localT < condensationT`, and `localT` uses
`uFrostLatChill = 0.35`, a value `shaders/uniforms.js:268` labels **"lab knob"** — a hand-set constant,
derived from nothing.

At 0.35, the poles read 35 % colder than the equilibrium temperature, which puts the sea-level
snowline at **26° latitude** on a 293 K world. That is 56 % of the surface before any relief, and the
altitude term (`−h × 0.3 × T_eq`, i.e. −88 K per unit of relief) frosts the highlands well below it.

⭐⭐ **The law is not calibrated for this class, and the lab's own presets prove it rather than our
generator:**

| | volatiles | T_eq | frost budget | sea-level snowline |
|---|---:|---:|---:|---:|
| `rocky-126` p2 — the body Max walked | 0.309 | 293 | **0.834** | 26° |
| LAB PRESET **Ocean (temperate)** | 0.350 | 295 | **0.945** | 27° |
| LAB PRESET Rocky (Earthlike) | 0.150 | 288 | 0.198 | 23° |
| the real Earth, for scale | ~0.15 | 255 | — | **~66°**, ~10 % of the surface |

**The lab's own `Ocean (temperate)` preset scores 0.945** — a 295 K ocean world renders as 94 % snow
in the lab too, and always has. So this is a LAB defect of long standing that the game could not
display until there was a warm wet world to display it on. The volatile-delivery law did not create
it; it removed the thing that was hiding it.

⚠ Note the direction of the error. This world's *equilibrium* temperature is 293 K — **38 K warmer
than Earth's 255 K** — so with any greenhouse at all it is a hot world. It should carry LESS permanent
ice than Earth's ~10 %, not five times more.

## The fix, when it is scoped

Two halves, and they are separable:
- **(a) the budget needs a temperature term.** `frostMaxCoverage` should fall as `T_eq` rises; today a
  700 K world with volatiles gets the same budget as a 200 K one and is saved only by the shader.
- **(b) `uFrostLatChill` and `uFrostLapseRate` are undreived lab knobs** sitting where a real
  pole-to-equator gradient belongs. A 35 % falloff is far steeper than any real body's.

⛔ **NOT done here.** This workstream's contract scopes out "any change to how wet worlds LOOK" — it
changes *which* worlds are wet. Doing (a) and (b) inside it would fold an uncalibrated rendering law
into a generation fix and make the population read unattributable. It is its own small workstream, and
on Max's ruling it comes before the lighting engine only if he says so.
