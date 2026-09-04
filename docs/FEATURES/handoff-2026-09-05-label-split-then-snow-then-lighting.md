# Handoff — ▶ **(1) THE LABEL SPLIT**, then **(2) the snow budget**, then **(3) the lighting engine / F52**

> ⚠ **IN-REPO ON PURPOSE** (`/tmp` does not survive a WSL restart). Supersedes
> `handoff-2026-09-05-volatile-delivery-then-lighting.md`; its trap list still holds and is extended.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master) · **HEAD = origin =
> `0982ea1`, verified by `git ls-remote`.** All four instruments green. ⛔ ~700 untracked PNGs are
> normal — **NEVER `git add -A`** (this session did, and committed 705 of them; see trap 17).
> ⚠ ALWAYS `npx vitest run --dir tests --root /home/ax/projects/well-dipper`.

## 0. WHAT SHIPPED, so it is not re-litigated

**The volatile-delivery fix.** Max's UAT: *"yep, it works"*. The galaxy has Earth-like worlds in it for
the first time. Full record: `docs/WORKSTREAMS/volatile-delivery/` — contract (`verifying`, per-AC
verification block), intent, POPULATION.md, DEVIATIONS.md, LIVE-CHECK.md, and four re-runnable scripts
(`scope-probe`, `anchors`, `blast-radius`, `recapture-fixtures`). Commits `b12ff27` `36ffec2` `556e2ad`
`7484842` `257368b` `0982ea1`.

⭐ **The one sentence to carry:** `deriveComposition` was doing TWO jobs with ONE field, and the fix was
to split it — `iceFraction` (accreted bulk, the old frost-line law kept verbatim, still the only input
to density) from `volatileFraction` (surface inventory, the new §3b law). **Read that sentence twice,
because arc (1) below is the same bug in a different file.**

## 1. THE RULING (Max, 2026-09-04, after his walk)

> *"Well, it sounds like we have a bunch of systems here that are not talking to each other. The most
> obvious candidate for a fix is the label. It sounds like the label is just randomized and isn't
> actually reading the history of the planet. Am I understanding that correctly?"*

He was shown the correction (below) and ruled the order: **(1) the label, (2) the snow, (3) lighting.**

## 2. ▶ ARC (1) — THE LABEL SPLIT. Scope it with `dev-collab-scope`.

**⭐⭐ IT IS THE SAME BUG SHAPE AS THE ONE JUST FIXED: one name doing two jobs.**

`PlanetGenerator._pickType(rng, orbitRadius, zones)` is a zone-weighted roll — orbital zone
(scorching / inner / HZ / outer), star type, metallicity, disk size-bias, with real Kepler occurrence
rates cited in its own comments. So it is **not** "randomized"; it reads WHERE the planet is.

⛔ **THE CORRECTION THAT CHANGES THE FIX, AND IT IS THE WHOLE POINT: the label is UPSTREAM of the
physics, not downstream of it.** It is drawn FIRST and then *chooses*:

| line | what the label decides |
|---|---|
| `PlanetGenerator.js:332` | the radius range → the planet's size |
| `:359` | `estimateMassEarth(radiusEarth, type)` → its mass |
| `:474` | atmosphere strength |
| `:547` / `:569` | cloud chance / ring chance |
| `:616` | max moon count |
| `:344` | the legacy palette |

So the label helps CREATE the history it fails to describe. **"Make the label read the physics" is a
LOOP, not a relabel** — the physics cannot be the label's input while the label is the physics' input.

**The split:** the roll KEEPS its job as a formation seed (it legitimately decides how big a world is
and how many moons it gets); a **derived classification** is computed from the finished body and is
what the HUD, the orrery and anything descriptive read.

**MEASURED, 200 seeds, 476 solid planets** (`/tmp` script is gone — re-derive; it is ~25 lines over
`StarSystemGenerator` + `conditionFromBody`):

| label | bodies | of which actually warm ∧ wet |
|---|---:|---:|
| ice | 65 | **6** |
| rocky | 138 | 2 |
| carbon | 83 | 2 |
| **terrestrial** | 3 | 3 |
| fungal | 1 | 1 |
| **ocean** | 7 | **0** — median T_eq **355 K** |
| venus | 132 | 0 |
| lava | 45 | 0 |

⭐ **11 of the 14 Earth-like worlds carry some other label, and all 7 worlds the game calls `ocean` are
hot and dry.** The galaxy cannot tell you where its habitable worlds are — that is a DISCOVERY problem
(finding one while flying), not tidiness, and it is the reason Max picked this first.

⚠ **The label does NOT paint world-engine bodies.** Confirmed live: the lab planet material carries no
`planetType` uniform. This arc changes what the HUD and orrery TELL you, not what a planet looks like.
Do not scope it as a rendering change.

⚠ Also seen: `label says LAVA but the body is cold (<400 K)` on 15 of 476 (3.2 %).

## 3. ▶ ARC (2) — THE SNOW BUDGET

Full write-up with the numbers: `docs/WORKSTREAMS/volatile-delivery/FOLLOWUP-frost-budget.md`.

`labCore.js` computes `frostMaxCoverage = smoothstep(0.05, 0.4, volatileFraction)` — **no temperature
term at all.** The whole temperature test is delegated to the shader's `localT`, which uses
`uFrostLatChill = 0.35`, a value `shaders/uniforms.js:268` itself labels **"lab knob"**. At 0.35 the
sea-level snowline lands at **26° latitude on a 293 K world** — 56 % of the surface before any relief,
and the altitude term is −88 K per unit of relief on top. Earth's is ~66° / ~10 %.

⭐ **It is a LAB defect of long standing, not one this project introduced.** The lab's own
`Ocean (temperate)` preset (V 0.35, T_eq 295) scores a **0.945** budget and always has. The game had no
warm wet world to display it on until 2026-09-04. Two separable halves: **(a)** the budget needs a
temperature term; **(b)** `uFrostLatChill` / `uFrostLapseRate` are underived knobs sitting where a real
pole-to-equator gradient belongs.

## 4. ⛔ STILL PARKED

**The REPORT's Block B** — `if (locked) return shell('eyeball-despun')` sits ABOVE both roads to
`plate()` and still eats **74 %** of bodies (875 of 1,183, unchanged). Max agreed it gets its own
session. ⚠ The class it shuts out is real: tidally-locked temperate worlds are the commonest
habitable-zone configuration in the real galaxy, and the lab has a preset for them
(`Eyeball (locked temperate)`, V 0.25). By the charter's own test that is a whole class of
physically-real world the dispatch cannot draw with plate relief.

## 5. ⛔ TRAPS — the fourteen carried forward, plus three this session paid for

1–14 as listed in `handoff-2026-09-05-volatile-delivery-then-lighting.md` §5. Especially #10 (`cd`
moves the session's cwd), #11 (an import appended past a trailing `//` is dead), #12 (a screenshot pair
of a ROTATING body measures the rotation).

15. ⭐⭐ **NEW — A FRESH `new SeededRandom(...)` FOR A SIDE DRAW MOVES INSTRUMENT B'S DRAW STREAM,
    WITH ZERO VALUES MOVED.** It instruments `SeededRandom.prototype.rng`, i.e. EVERY instance, so a
    sub-rng that touches nothing on the shared stream still moved the per-yield profile on **212 of 221
    seeds**. `MoonGenerator`'s own comment already warned this red must not be spent, because DRAW
    STREAM is the only channel that detects a real leak and a real leak's signature is byte-identical
    to a benign construction's. **Use `namespacedFloat`** — LIFTED this session to `SeededRandom.js:140`,
    one copy, both generators.
16. ⭐ **NEW — EDITING `PlanetGenerator` / `MoonGenerator` / `PhysicsEngine` DRIFTS EVERY LINE-ANCHORED
    CITATION INTO THEM.** 34 broke here; all 858 resolve at the parent, so every break was ours. Repair
    **by locating the symbol**, never by bumping the integer — the fence's own instruction, because a
    ref repaired to a second wrong line reads as freshly verified. ⚠ Some refs use the SHORT form
    (`:539 \`symbol\`` after the file is named earlier on the line) and a naive `File.js:NNN` search
    misses them.
17. ⛔⛔ **NEW — `git add -A` COMMITTED 705 STRAY PNGs**, despite the previous handoff warning about
    exactly this in its own trap #1. Caught by auditing `git show --stat` after the fact and reset.
    **Stage explicitly in this repo. Always. Audit the commit before moving on.**

⚠ **And one methodological note worth as much as the traps.** The first cut of the §3b law put **34 of
1,183 bodies exactly ON the 0.7 clamp** where the parent had 0, because the two system proxies were
MULTIPLIED — they are correlated readings of one quantity, so multiplying squared the metallicity
dependence. Geometric mean + a soft asymptotic ceiling brought it to 0. **A saturated field is a defect
(QB-23), not a population**, and the way it was caught was measuring the clamp count as a first-class
number rather than eyeballing the distribution.

## 6. WORKING WITH MAX

- ⭐⭐ **THE RECAP IS A STATUS REPORT AGAINST THE ROADMAP, IN HIS LANGUAGE.** Read
  `feedback_director-level-recaps.md` and `feedback_asks-in-his-language-not-the-contract-s.md` IN
  FULL. No AC ids, no file paths, no bare keys in the asks.
- ⭐ **HE CHECKS PREMISES AND HE IS USUALLY HALF RIGHT IN A WAY THAT IMPROVES THE FIX.** *"the label is
  just randomized and isn't actually reading the history — am I understanding that correctly?"* was
  half right; the correction (it is UPSTREAM, so it is a loop not a relabel) is what makes arc (1)
  scopeable. **Answer the premise precisely rather than agreeing.** Same pattern produced the
  coverage gap, the paint-over seam, and this whole generation defect.
- **He rules fast and in few words when the ask is concrete** — "1 yes", "2 yes", "yep, it works".
  Keep asks to one line each with a recommendation stated.
- **Pushing is confirmed each time.** He said yes once this session; that is not standing.
