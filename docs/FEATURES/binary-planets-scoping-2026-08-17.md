# Binary planets — the scoping answer

**Date:** 2026-08-17 · **Tree:** `feature/world-engine-production-L1` @ `a76f9e7` · read-only audit + read-only measurement
**Answers:** the question left open by [`moon-formation-channel-model-PLAN-2026-08-15.md`](moon-formation-channel-model-PLAN-2026-08-15.md) §6/Q3
**Method:** a 10-agent workflow (5 seam traces → 2 refuters + 2 lenses → synthesis), then **independent re-measurement of every load-bearing number by working-Claude before any of it was written down.** Verdicts split 3–1 in favour of "safe"; the dissenting skeptic's fatal is carried in §3 rather than discarded.

---

## §0 — The answer

**Yes — and "provisional render" turns out to be the wrong frame entirely.**

A binary pair can be generated with correct barycentric physics and drawn correctly **today, with zero renderer changes**, provided two conventions hold:

1. The companion is delivered through **`planets[i].moons[]`**, not appended to `planets[]`.
2. Its `orbitRadiusScene` carries the **full parent-relative separation `a`** — which is what that field already means everywhere.

Under those two conditions the drawn geometry is *exact*: separation, eclipses, transits, approach distance and the pair's own satellites all come out right. The only physics term absent is the primary's reflex wobble `r1 = a·q/(1+q)` — **an approximation the tree already ships on 13 of 713 existing moon/parent pairs, worst case 9.6 primary radii.** There is no second render path to build and no flag to plumb.

---

## §1 — The plan's §5, corrected — and where it was right

⚠ Written carefully, because this lane's recorded failure mode is *propagating a correction that was itself wrong*. Each item below was re-verified by hand against the tree.

### Wrong

**"…and the save format."** No referent. Every `localStorage` write in `src/` is five call sites over three keys — `Settings.js:112`/`:161`, `ShipCameraSystem.js:514`/`:522`, `Planet.js:2171`. Zero `sessionStorage`, zero `indexedDB`, no game save; systems regenerate from seed on load. Session restore is an unbuilt archived draft. **Strike the item.**

**"the renderers / the orbit lines" — backwards for the `moons[]` route.** `main.js:11248-11252` positions a planet-class moon at `parent.mesh.position + (cos θ·r, −sin i·sin θ·r, cos i·sin θ·r)`, and `:11257` passes the parent's live position to plain moons. Moon rings are re-positioned to the parent every frame (`:11265-11271`). ⭐ **Verified by hand.** A pair delivered through `moons[]` therefore renders a faithful relative orbit for free. The bug §5 describes is seeded by the *opposite* move — offsetting the **primary** at `main.js:11201`, which desyncs lighting, moon meshes and moon rings independently.

**"the partition machinery already generalises (a binary is a partition at the planet level)."** No code referent — the feeding-zone partition is plan text scheduled as B5 item 5. And the law does not transfer: both members share one circumstellar semi-major axis, so `Σ(a)·a·Δa` is identical for both and the rule forces `q = 1`. What *does* carry is the mass-first inversion.

### Right — do not overcorrect

**"the SOI/gravity model" — right, and worse than stated.** `GravityField.js:179-188` `_estimateMoonMass` never reads a mass: it returns `estimateMassEarth(r,'rocky')` for `type === 'terrestrial'` and otherwise `r^2.5 × 0.5`. Its comment at `:148-149` ("moons don't have massEarth") is stale — all 24 planet-class moons carry `planetData.massEarth`, and a planet-class moon's top-level `type` is a *planet* type, so `rocky`/`ocean`/`ice` all miss the branch. A pair would enter the flight model with a mass the generator never chose. ⛔ **§5 defers this fix as optional; a pair makes it required.**

**"would make this fix's own verification unreadable" — the strongest surviving argument in §5.** But it is a *sequencing* argument, not a renderer one, and §4 answers it.

### The binary-STAR precedent: a hardcoded singleton, and quantitatively wrong

My own scouting called this "live, moving, barycentric two-body motion." That is true of the **star meshes** — `main.js:11184-11193` rewrites both positions every frame from an advancing angle. It is **not** a reusable mechanism, and the instance is broken:

- **A named second slot, not a mechanism.** `star2` appears 155× across 17 non-test source files, every consumer an `if (star2)` fork with a literal index 1. The `r1`/`r2` formula is copy-pasted at six sites in three unit systems (`main.js:7537`, `:11180`, `:11403`; `NavComputer.js:2440`, `:2485`; `SystemMap.js:271`) with no owning function.
- **The star *rings* never move** — placed once via `_placeInRebasedFrame`, correct only because a stellar barycentre is the system origin. A planet pair's barycentre orbits the star, so the correct precedent for its rings is the **moon** ring, not the star ring.
- ⭐ **The star pair disagrees with its own gravity model.** Procgen *draws* `binaryMassRatio` (`StarSystemGenerator.js:308-312`) and jitters the secondary radius independently (`:317`), while `GravityField.js:83`/`:99` derives both masses from `radiusSolar^1.25`. **Verified by hand.** Measured over 113 procgen binaries in `wd-0`…`wd-299`: `q_gravity/q_render` median **1.22**, max **8.83**; barycentre misplaced by up to **77.8 primary radii**.
- ⭐ **And it orbits 55–948× faster than Kepler.** Procgen sets `binaryOrbitSpeed = 0.003 / (binarySeparation/5)^1.5` (`:353`) from the **map-unit** separation — a separate `rng.range(3,8)` draw the authored branch's own comment labels "map/HUD only" — never passing through `orb()`/`ORBIT_REALISM_FACTOR`. The authored path uses `keplerOrbitSpeed(binarySeparationAU)` (`:344`). **Verified by hand: two mutually inconsistent implementations in one file, ~300× apart in period.**

**Ruling:** there is nothing to reuse, and anything claiming to copy "the pattern" must first pick which of two contradictory implementations is the pattern. ⛔ This is a **separate defect** from binary planets — see §6 Q4.

---

## §2 — Seam map

| Subsystem | Verdict | Cost |
|---|---|---|
| Moon render (spawn) `main.js:7623-7695` | **generalises-as-is** | none |
| Per-frame moon motion `main.js:11243-11259` | **generalises-as-is** | none for a primary-centred pair |
| Orbit rings via `moonOrbitLines` | **generalises-as-is** | none; a *new* ring array is silently never drawn (`CONIC_MAX = 64`) |
| World-origin rebasing | **generalises-as-is** | none — cannot distinguish an offset body |
| Gravity positions `GravityField.js:233-239` | **generalises-as-is** | none — physics positions *are* render positions, which is why a "physics-correct / render-provisional" split cannot exist as a runtime property |
| Supercruise / collision | **generalises-as-is** | none; already walks `moons[]` |
| Autopilot / tour / cinematic | **generalises-as-is** | none — chases live meshes |
| Targeting / click | generalises-as-is structurally | loses click ties to the primary |
| `freezeFrame` instrument | **generalises-as-is** via `moons[]` | a new accumulator would silently corrupt A/B screenshots |
| **Planet per-frame write** `main.js:11197-11205` | **hardcoded-singleton** | no offset term exists — two `planets[]` entries at one orbit collapse to a point |
| **Gravity mass** `GravityField.js:148-188` | **hardcoded-singleton** | one branch; **required**, not optional |
| SOI / dominant body | generalises-with-work | at `q=1` the boundary is `0.624·a`, not the midpoint; no mutual-Hill form exists |
| Gravity acceleration | hardcoded-singleton | discontinuity at pair-SOI crossing is first-order for a co-equal pair |
| Brackets / billboards | hardcoded-singleton | `MOON_GHOST_RANGE = 20 × a` vs the primary's 10 000 |
| ~~SystemMap (minimap)~~ | **near-irrelevant** | ⛔ **CORRECTED 2026-08-17.** `main.js:495` suppresses the minimap whenever the cockpit supplies a NAV panel (`!_cockpitReplaces('NAV')`), and `:490-494` describes it as the fallback for cockpit-glass load failure. It is not the shipped surface. Its zero moon support only bites in the degraded path |
| **Cockpit NAV panel** `NavSource.js` → `NavComputer` | generalises-with-work | ⭐ **This is the real surface.** It hosts the live `NavComputer` on a CRT. It *does* draw moons, from real data — see §3a |
| NavComputer orrery | hardcoded-singleton | moons drawn at a cosmetic radius, frozen angle |
| Naming | hardcoded-singleton | a companion is named "X b I" |
| **Persistence** | **n/a** | no referent |

---

## §3 — The provisional-render question, ruled

### The real fork is the record convention, not the renderer

**Convention A — RULE FOR THIS.** `orbitRadiusScene` = the full parent-relative separation `a`. This is what the field already means (`MoonGenerator.js:161-162` writes it, `main.js:11249` reads it as distance-from-parent).

**Convention B — FATAL, AND SILENT.** Store the barycentric element `r2 = a/(1+q)`. This is what a good-faith implementer of "correct barycentric physics in the record" naturally reaches for — it *is* the barycentric orbital element. At `q = 1` the pair is drawn **half as far apart as generated**, its SOI is undersized by the same factor, and every subsystem stays self-consistent with the wrong number. ⛔ **No test in the battery measures a drawn separation.** Mitigation is one unit test asserting `record.orbitRadiusScene === a`, and it costs nothing.

### Survived adversarial verification

| # | Scenario | Verdict |
|---|---|---|
| 1 | Record stores `r2` not `a` → pair silently half-size everywhere, no instrument notices | **fatal** |
| 2 | Gravity fabricates the companion's mass (`R^2.5 × 0.5`), flight-model `q` off by 2–3× | serious |
| 3 | At `q→1` the SOI boundary is `0.624·a`; the primary's Hill sphere never gains the companion's mass | serious |
| 4 | Gravity discontinuity at pair-SOI crossing, integrated straight into ship velocity | serious |
| 5 | The pair reads weakly on the cockpit NAV screen — see §3a for what is actually true | serious — **but not render-caused**; reproduces identically under a fully barycentric renderer |
| 6 | Offsetting the **primary** post-write desyncs lighting, moon meshes and moon rings | fatal — for the true-barycentre step only |
| 7 | Two `planets[]` entries at one orbit collapse to a point | **fatal for the `planets[]` route** |

### ⭐ §3a — what the cockpit NAV screen does with moons. TWICE CORRECTED — read the whole entry.

**Draft 1** said moons are drawn "at a cosmetic pixel radius at a frozen angle."
**Draft 2 "corrected" that to "radius uses real data."** ⛔ **Draft 2 was wrong. Draft 1 was right,
and for a reason neither draft had.** The full arithmetic at `src/ui/NavComputer.js:2546-2551`:

```
const moonOrbitWorld = Math.sqrt(moon.orbitRadiusEarth || (10 + m * 8));
const moonOrbitScale = (baseR + 6 + m * 4) / (moonOrbitWorld * projScale);
const moonOrbitR     = moonOrbitWorld * moonOrbitScale;
```

`moonOrbitWorld` appears once in the numerator and once in the denominator. **It cancels exactly:**

> `moonOrbitR = (baseR + 6 + m·4) / projScale`

`baseR` (`:2519`) is a function of the *parent's* radius; `projScale` (`:2284`) of the viewport.
Neither depends on the moon. ⛔ **The moon's real orbit radius has ZERO effect on where it is
drawn. The distance is a function of its INDEX.** Two moons at 6 and 75 parent radii drew at the
same place whenever they shared an index.

⚠ **How draft 2 got it wrong, recorded because it is the reusable lesson:** the block opens with
`Math.sqrt(moon.orbitRadiusEarth)` under a comment reading *"Use actual orbit data with sqrt
compression."* Reading the top of the block confirms the **intent**. The cancellation is two lines
below. **A comment stating what code intends is not evidence of what it computes** — and this lane
had already recorded "propagating a correction that was itself wrong" as a failure mode before
doing it again here.

**And planets are frozen too.** Draft 2 said "a moon never moves on the NAV display, while planet
dots do." Also wrong. `NavComputer._systemData` is the generator's output (`:135`
*"StarSystemGenerator.generate() result"*). There are exactly **two** `orbitAngle` advances in
`src/main.js` — `:11198` on `entry` from the **scene** array and `:11243` on the **scene** moon
object — and the scene entry copies `orbitAngle` **by value** at `:7719`. **Nothing writes back to
`systemData`.** So `p.orbitAngle` (`:2509`) and `moon.startAngle` (`:2567`) are both generation-time
values, and **nothing on that screen moves.**

**What has since been FIXED** (`src/ui/NavComputer.js`, `moonBandRadius` + `NavComputer.moonBandRadius.test.js`):
the cancellation. Moon distance is now proportional to the real orbit within a visible band, in the
same sqrt space `_renderPlanetDetail` (`:3066`) already used — the two views had disagreed about
where the same moon was. The outermost moon lands exactly where index-based drawing put it, so the
view's extent is unchanged. The ship-position marker (`:2674`, whose comment demanded it "match the
moon orbit formula used in rendering") now calls the same helper, so the two cannot drift again.

**What remains:** nothing on the NAV screen moves, for planets or moons, because `_systemData`
carries no live angle. That is the nav-screen rework, not a quick fix.

**Consequence for a binary companion:** it appears on the cockpit NAV glass at a distance that now
honestly reflects its real separation under compression — but static, and with the visual weight of
an ordinary moon dot.

### Refuted

- **"Provisional render seeds a NEW barycentre bug."** Refuted by measurement — see §4. The honest cost is *"the wobble amplitude grows,"* not *"a new bug family appears."*
- **"…and the save format."** No referent.
- **"The primary becomes unreachable / SOI flicker at `q≈1`."** The two members have different parents, so their SOIs are never comparable; the primary falls inside the companion's SOI only at `q ≥ 4.11`, unreachable if "primary" means the heavier member.
- **"A flag would contain it."** `GravityField.tick()` is a blind mesh copy with no per-body branch; `_scBodies`/`_occluders` are flat `{position, radius}` pushes. A flag here is documentation, not containment.

**Ruling: "provisional render" is unnecessary as a concept.** What exists is a **missing term of known, bounded magnitude** (`r1 ≤ a/2`) in an otherwise exact drawing. The two things needing a decision are the record convention (A) and the delivery array (`moons[]`).

---

## §4 — ⭐⭐ Two definitions of "binary planet", and they disagree by 13×

**Measured independently by working-Claude**, `wd-0`…`wd-191` (the 192 bulk seeds of FENCE-221), 713 moon/parent pairs carrying mass on both sides. Script archived at `scratchpad/probe-binary-criteria.mjs`.

**DYNAMICAL** — barycentre outside the primary's surface, `r1/R_p = (a/R_p)·q/(1+q) > 1`. The formal definition.

| threshold | bodies | systems | % of systems |
|---|---:|---:|---:|
| `r1/R_p > 1` | **13** | **10** | **5.2%** |
| `r1/R_p > 2` | 6 | 5 | 2.6% |
| `r1/R_p > 5` | 1 | 1 | 0.5% |

7 of the 13 are planet-class. Worst: `wd-133/4/3`, `r1/R_p = 9.618` at `q = 0.147`, `a/R_p = 75.0`.

**PERCEPTUAL** — mass ratio alone, "do they look like a pair".

| threshold | bodies | systems | % of systems |
|---|---:|---:|---:|
| `q ≥ 0.5` | **0** | 0 | 0.0% |
| `q ≥ 0.25` | **0** | 0 | 0.0% |
| `q ≥ 0.122` (Pluto–Charon) | 1 | 1 | 0.5% |
| `q ≥ 0.05` | 4 | 3 | 1.6% |
| `q ≥ 0.0123` (Earth–Moon) | 40 | 29 | 15.1% |

⭐ **The two criteria answer different questions and the gap is the whole finding.** By the formal definition the generator **already makes binary planets in 5.2% of systems** — half of Ochiai's ~10%. By the perceptual reading it makes **none**: zero bodies above `q = 0.25`.

⛔ **This is almost certainly why Max believes the game has no binary planets: the ones it has do not look like binaries.** They are low-`q` bodies far enough out that the barycentre clears the primary's surface — dynamically a binary, visually a distant moon. A channel that only chases the dynamical criterion would add more of those and change nothing he can see.

**Consequence:** the channel must target **high `q`**, not barycentre position. Reclassifying existing bodies — the obvious zero-cost option — yields **one body in 192 systems** and is dead.

---

## §5 — Sequencing: fold generation into the B5 window, via `moons[]`

The two delivery routes have **almost disjoint instrument tolls, and the cheap-toll route is the one with no working render**:

| Route | Render | Toll |
|---|---|---|
| **M — `planets[i].moons[]`** | correct today, zero renderer changes | moves the **moon** population → fence population + `moonShapeCensus` + `PLANET_CLASS_MOONS`, `moon-condition-contract` (~35 literals), `moon-census.mjs:116` pin, Instrument C P-stratum |
| **P — append to `planets[]`** | **broken** — no offset term at `main.js:11197-11205` | moves the **planet** population → `port-condition-contract.test.js:286` `CORPUS_BODIES = 526` + ~62 literals, `material-parity-list`, Instrument C S-stratum |

**Route M's toll *is* B5's toll.** B5 already moves moon counts and masses, which reds every one of those files. Folding companions in means **the same literals get different numbers — zero additional files, zero additional derivation tooling.** Deferring charges the entire moon toll a second time, and **four of those files have no re-bless mechanism** (`grep -c process.env` → 0 for each).

**Three toll facts that reduce the cost below the plan's estimate:**

1. ⭐ **`moon-rng-stream-identity.test.js` does not count sub-rng draws.** Its header (`:30-32`) says it counts the shared stream only. A companion built from a pure hash and **not routed through `MoonGenerator.generate`** leaves `PINNED_STREAM_SET` (64 lines) and the call-count literals entirely green. **The single largest non-re-blessable component of the toll is avoidable.**
2. `_ordinal` is stamped once (`StarSystemGenerator.js:567`) and the migration re-sort at `:666-667` does not restamp — appending never renames an existing body.
3. There are zero `rng` draws in `_generateIterator` after the trojan loop; any post-loop emission after `:806` is unconditionally draw-neutral.

### The one real cost — B4 attribution — is answerable

Folding binaries in means a wrong binary rate and a wrong moon-mass sampler produce the same red. **Mitigation:** make the channel selector a **deterministic zero-draw hash** (the `namespacedFloat` pattern, whose docstring records that the `SeededRandom` alternative moved the draw profile on 197 of 221 fence seeds while the hash moved 0 of 221). Then the exact set of `(seed, planet)` coordinates receiving a companion is **computable read-only before a line of generator code is written**, and B4 states it as a separate line item with an exact coordinate list. `namespacedFloat` is module-private — lift it, or use `fnv1aString` from `motion-test-kit`.

### Also correct the plan's cost note

Plan §4 says `tests/port-condition-contract.test.js` "stays green throughout… nobody should budget for it." **True for B5 and true for Route M; false the instant anything is added to `planets[]`.** And `material-parity-list.test.js`'s `withMoons 228` / `moons 456` (`:290-291`) **do** move under B5 alone — that file is absent from the B7 re-derivation list.

---

## §6 — The first increment

**The solid-parent binary-companion channel, primary-centred.**

1. A pure, exported, **zero-draw** predicate over `fnv1aString(\`binarypair:${_systemSeed}:${_ordinal}\`)` selecting a declared fraction of solid-parent planets.
2. One record appended to `moons[]` **after the moon loop closes** (`planetRng` is provably dead after `StarSystemGenerator.js:594`), built by the existing planet-class-moon builder so the 20-key shape is unchanged.
3. `orbitRadiusScene` = full relative separation (Convention A). `isPlanetMoon: true`. Mass derived to a target `q`.
4. **One physics fix in the same commit:** `GravityField._estimateMoonMass` reads `moonData.planetData?.massEarth ?? moonData.massEarth` first, and its stale comment at `:148-149` is corrected.
5. **Zero renderer changes.**

**Acceptance criteria:** rate matches the coordinate list predicted in B4 · stream literals green (or the binary contribution to the delta is exactly N, as predicted) · `moonShapeCensus.planetClass.shapes === 1` · a unit test asserting `orbitRadiusScene === a` and not `a/(1+q)` · `dominantBodyAt` returns the companion 0.1·a from it · working-Claude confirms the drawn separation and ring in the live game · **UAT — does it read as a binary planet or as a big moon — is Max's gate alone.**

⛔ **Deliberate non-goals, so they are not discovered at UAT:** no primary wobble; no minimap or nav-computer representation; no bracket-range parity; no pair-aware naming or click precedence; no mutual-Hill SOI; no eccentricity or inclination (`y` is hardcoded 0 at every write site).

---

## §7 — Still unknown

1. **The predicate's exact yield per corpus** (120 `pcc-*` / 197 / 200 `lab-procedural-*` / 221 FENCE). Every count in §5 is a *files-affected* ceiling, not a moved-literal count. **Compute read-only before B4's binary line item.**
2. **Whether the binary channel has a physical home.** The generator's only orbit-crossing event (migration scatter) fires in ~3.1% of systems, ~30× below Ochiai's ~10%. Hooking there yields ~0.3%; forcing 10–14% makes the constant do all the work — the authored-constant bug family the reconciliations doc exists to close. ⛔ **Upstream design work, not toll work, and not settled.**
3. **Post-B5 wobble magnitude.** The 13-of-713 measurement is on today's tree; B5's mass-first sampler is designed to change exactly that distribution.
4. `ExoticOverlay.js:369-377` multiplies a moon's radius/orbit/mass by the **primary's** swap ratio — meaningless for a co-equal companion, silently changes `q`. Flagged, not traced.
5. **The toll list is a floor, not a total.** Seven further files importing `StarSystemGenerator` were not audited for population-pinned literals.
6. Not examined at all: `BodyRenderer.createPlanet` / `LODManager.register` constraints on two comparable-radius bodies at one orbit slot.

---

## §8 — Open questions for Max

1. ✅ **RULED 2026-08-17 — Max confirmed the PERCEPTUAL reading, floor at `q ≥ 0.122`** (Pluto–Charon;
   companion ≈ half the primary's radius), with the channel's distribution centred higher (~0.3–0.6),
   since Ochiai/Lazzoni pairs come from gas-giant orbit crossing. The dynamical criterion is NOT the
   target: the generator already satisfies it in 5.2% of systems and those bodies read as distant
   moons. ⛔ **Reclassification is dead — the channel must create bodies.** Original question kept below
   for the record.

   ~~**Which definition do you mean?**~~ By the formal one (barycentre outside the primary) the game **already has binary planets in 5.2% of systems** and you have not noticed them, because they are low-`q` distant moons. By the perceptual one (two comparably-sized bodies) it has **zero above `q = 0.25`**. My read is that you mean the second — but it determines the channel's entire target and it is a taste call, so it is yours.
2. ⛔ **SUPERSEDED 2026-08-17 — the minimap framing was wrong** (Max: "there's no minimap anymore;
   it's all the screen in-game in cockpit now"). Verified: `main.js:495`. **The correctly specified
   question is:**

   > A binary companion *will* appear on the cockpit NAV screen — at a compressed distance, at a
   > frozen angle, as an ordinary moon dot (§3a). So on the glass, a binary pair looks like "a planet
   > with one more moon", and it does not move. **Is that acceptable for the first increment — with
   > the pair only reading as a pair once you fly to it — or does the NAV screen need to show it as
   > two co-equal bodies before binaries are worth shipping?**
   >
   > Two sub-parts, because they cost differently: (i) **weight** — drawing the companion with
   > planet-class emphasis rather than a moon dot is cheap and local to the moon-drawing branch;
   > (ii) **motion** — un-freezing the angle means feeding live `orbitAngle` instead of `startAngle`,
   > which changes how *every* moon renders on that screen and is therefore its own change with its
   > own UAT.

   *Recommendation: exist first; take (i) if it is genuinely a few lines, and file (ii) separately.*
3. **Naming.** A `moons[]` companion is "X b I". Peer designation (X b1 / X b2) in the first increment, or roman numeral until it earns its own identity?
4. **The star pair is measurably broken** (§1). Separate defect. *Recommendation: file as its own workstream — fixing it moves generated values and wants its own window.*
