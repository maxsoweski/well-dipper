# B5 — the ordered build plan for the window (steps 1–9)

**Produced 2026-08-19** by a 14-agent read-only reconnaissance (4 step-group finders each
double-refuted, 1 instrument-toll enumerator, 1 adjudicating synthesis; ~2.0M subagent tokens).
**Plan of record for the B5 window.** Supersedes the ordering in
[`moon-formation-channel-model-PLAN-2026-08-15.md`](moon-formation-channel-model-PLAN-2026-08-15.md)
§3 B5, whose nine steps it re-sequences into twelve commits; that file remains the source for §1 THE
MODEL and the C1–C4 physics.

> ⛔ **NOT STARTED.** At the time of writing, exactly one of its twelve commits has landed — **S0-a**,
> the citation repair (`905f77e`), which was a regression repair rather than B5 work. **No B5 step
> has been cut.** See [`handoff-2026-08-19-lane-choice.md`](handoff-2026-08-19-lane-choice.md) before
> starting: Max redirected toward the world-engine lane and the pivot is cheap only while this is true.

> ⚠ **Working-Claude re-opened the load-bearing lines and the verification is in §10 at the bottom.**
> Two of the synthesis's claims needed correcting. Read §10 before trusting §7's risk ranking.

# B5 — ORDERED BUILD PLAN, steps 1–9

**Verified at real HEAD `49d1bf7`**, not the briefed `a22877d`. `49d1bf7` is docs-only (`moon-formation-handoff-2026-08-18-b5.md` +13, `docs/PARKING_LOT.md` +33 — `git show --stat` opened). **No `src`, `tests` or `tools` file differs**, so every source line number below is valid at both shas. The one consequence: the handoff was amended, and the amendment settles a conflict two finders escalated (see §8).

Every `file:line` below I opened myself at `49d1bf7`.

---

## VERIFY-THE-VERIFIERS — refuter objections I adjudicated

I re-opened every refuter objection marked `certain`/`likely` that would change the build. Nine mattered.

### UPHELD (7)

**1. `moonecc:` does NOT need re-keying in step 2.** *(steps12 soundness refuter)* — **UPHELD, and it changes step 2's code.** `MoonGenerator.js:185-186` and `:431` both call `_computeTidalHeating` downstream of size *and* orbit on their own paths; step 2 moves neither call, so nothing makes the current `moonecc:` key uncomputable. It is PLAN:172's stipulation, not a dependency. Re-keying it naively collapses **458 distinct keys over 733 records** (my own measurement, MC-197 — script `/tmp/claude/b5syn/key.mjs`). **Ruling: re-key `compSeed` only. Leave `moonecc:` byte-identical. State the deviation from PLAN:172 in step 2's commit message.**

**2. `MoonGenerator.js:571` already breaks the `:645` no-counter docstring.** *(steps12)* — **UPHELD.** `:571` reads `namespacedFloat(\`binarypair:${planetData._systemSeed}:${planetData._ordinal}\`)` — a per-system seed *and* a per-body counter, both, through `namespacedFloat`. `:645` reads `carrying no per-system seed and no per-body counter`. The docstring is already false at HEAD. This collapses the stated cost of adding `moonIndex` to `compSeed`.

**3. `MoonGenerator.js:209`'s `noiseScale` draw is unconditional and size-dependent.** *(steps34)* — **UPHELD.** `:209` `noiseScale: Math.max(rng.range(3.0, 6.0), 2.5 / moonRadiusData.radius),` sits outside every `type === 'terrestrial'` guard (guards open at `:211`, `:217`, `:222`). The record literal is **7 draws when terrestrial, 1 always** — not 6-conditional. And the aurora block is 3 draws (`:224`, `:225`, `:226`), not 2. Step 3's draw ledger must use these numbers.

**4. `ExoticOverlay` never rescales `moon.planetData.radiusEarth`.** *(steps89)* — **UPHELD, and it enlarges step 9.** `grep -n "moon\.planetData" src/generation/ExoticOverlay.js` returns **exactly one line, `:389`**, and it touches mass only. Meanwhile `src/main.js:7666` renders a planet-class moon's mesh from `radius: moonData.planetData.radiusScene`. So today a swapped parent moves a planet-class moon's nested mass by `kEarth³` while its nested radius — and therefore its **rendered size** — does not move at all. Step 9 owns this.

**5. C4 heads move the binary companion unless appended after `:600`.** *(steps89)* — **UPHELD, and it is the sharpest constraint in the plan.** `StarSystemGenerator.js:600` passes `moons.length` as the companion's `moonIndex`, and that value is read four times inside `_generatePlanetMoon` — `:387` `orbitZone = moonIndex <= 2 ? 'mid' : 'far'`, `:390` `zoneSpread = moonIndex * rng.range(3, 8)`, `:395` `mapBaseOrbit = planetData.radius * (2.0 + moonIndex * 1.8)`, `:400` `orbitSpeed / (1.0 + moonIndex * 0.6)`. It is also the `mi` in the §8.4 coordinate (`body-identity-fence.test.js:477`, `mi` = array index in the finished `entry.moons`). **Ruling: C4 heads append AFTER `:600`. Then step 8 does not move a single companion.**

**6. `:123` does NOT forbid the largest body class from rank 0.** *(steps567)* — **UPHELD.** The companion is a planet-class record that never passes through `generate()`; it enters at `moonIndex = moons.length`, which is **0** on any parent whose loop produced nothing — and `:569` restricts companions to *non*-giants, exactly the parents `:123` excludes. The two planet-class sub-populations are disjoint. Step 5's baseline must not be built on the finder's claim.

**7. Step 5 does not depend on step 7.** *(steps567)* — **UPHELD.** `N` arrives as `totalMoons`, arg 4 of `MoonGenerator.generate` (`:117`), fed `planetData.moonCount` at `StarSystemGenerator.js:595`. The partition needs the value, not the law that produced it.

### OVERRULED (2)

**8. "`moon-condition-contract.test.js:304` goes tautological under step 9, ship a replacement in the same commit."** *(steps89 finder; the refuter half-caught it)* — **OVERRULED, on a line I opened.** `:305` reads `const violators = plain` — it walks the **plain** array (`:99` `const plain = []; // surviving plain moons`), so it never covered planet-class records and step 9 cannot make it vacuous *there*. On plain moons it is a **coupling check**: it reds on any mutant that scales `moon.massEarth` and forgets `moon.radiusEarth`, or the reverse, whichever form step 9 uses. That mutant is precisely what `:389` is there to prevent. PLAN:199's reliance on it survives step 9. **No replacement required.** *(Separately: the `⛔ EXPECTED TO FAIL TODAY` comment at `:312` is stale — the fix landed at `10d4d1a`. Flag it; B7 owns the comment.)*

**9. "Escape 2 — hoist the orbit block with composition — is the right fix for step 2's collision."** *(steps12 finder's own recommendation)* — **OVERRULED, on a code reason the finder did not have.** Escape 2 works arithmetically: I measured `parent:orbit:type` at **733/733 distinct** on MC-197. But **step 6's ordered ladder with a Roche clamp requires ρ_moon — i.e. composition — ABOVE the orbit**, because the Roche floor is `2.44·(ρ_p/ρ_m)^(1/3)` (`PhysicsEngine.js:839`) and it is a floor *on the orbit*. Escape 2 puts the orbit above composition, so step 6 has to undo the hoist and re-key `compSeed` a second time — paying the whole-population composition move twice. **Ruling: escape 1. Key `compSeed` on `parent mass : parent radius : type : moonIndex`.** I measured that at **733/733 distinct** on MC-197, against the naive `parent : type` variant's **607/733** (the finder's 591/705 on survivors — same collision, different denominator). The docstring cost is already paid at `:571`.

---

## 1. THE ORDER

Twelve commits. Nine are the plan's steps; three precede them. **One deviation from 1–9: steps 5 and 6 swap.**

| # | commit | plan step | separate? |
|---|---|---|---|
| **S0-a** | citation-fence repair — 36 refs into `main.js` | — | yes, alone |
| **S0-b** | 57/7 disjointness replacement (T_eq, Route B) | test artefact | yes |
| **S0-c** | ORPHANS mechanism change | test artefact | yes |
| **1** | channel selector, `moon.channel` on both literals | 1 | yes |
| **2** | composition before size, `compSeed` re-key | 2 | yes |
| **3** | mass-first sampler | 3 | yes |
| **4** | `_generatePlanetMoon` merged — **zero-delta refactor** | 4 | yes |
| **5** | ordered orbits, Roche + Hill clamps, `orbitSpeed` from `a` | **6** | yes |
| **6** | feeding-zone partition | **5** | yes |
| **7** | count law + `ice`/`lava` repair | 7 | yes |
| **8** | C4 irregular tail + render policy | 8 | yes (render policy shares, per PLAN:178) |
| **9** | overlay mass ratio + §4b cap | 9 | yes |

**Nothing shares a commit.** Each step has one prediction to check; pairing two makes B7 unable to attribute a move.

### Why S0-a, S0-b, S0-c go first

**S0-a — the citation fence is RED at HEAD and nobody budgeted for it.** I ran it: `RESULT: 36 BROKEN CITATION(S). Exit 2.` All 36 target `src/main.js`, from two citing sources (`tools/port-uniform-delta.mjs` ~16 refs, `docs/FEATURES/one-pipeline-two-frontends-PLAN.md` ~20). They were broken by `52031fd` (the barycentre render, +118 lines in `main.js`) — a *shipped, UAT-passed* feature, not B5's deliberate window. It sits inside `npm run check:instruments`, it has **no record mode**, and every subsequent step makes it harder to tell a fresh break from this one. B6 budgets six repairs into `MoonGenerator`/`PlanetGenerator`; these 36 are additive and unrelated.

**S0-b — the 57/7 replacement is writable and provable *today*, and only today.** `moon-rng-stream-identity.test.js:279-290` is **GREEN at HEAD** (the hash-built companion draws nothing off the shared stream). It goes red at step 3. Proving its replacement kills the `postmigration` mutant requires a clean stream to measure against; after step 3 there is no clean reference.

**S0-c — a false invariant should not sit in the tree for nine sub-steps.** ORPHANS' containment already reads false at HEAD (see §4). Eight lines.

### Why 6 lands before 5 — the one deviation

PLAN:99: `m_k ∝ Σ(a_k) · a_k · Δa_k` with `Σ ∝ a^(-p)`.

The partition is a function of the semi-major axes **and the annulus widths `Δa_k`**. At HEAD, `a_k` comes from `MoonGenerator.js:157-158`:

```
157| const zoneSpread = moonIndex * rng.range(3, 8);
158| const orbitMultiple = rng.range(minMult, maxMult) + zoneSpread;
```

over three **overlapping** bands (`:141-143` `close: [6,12]`, `mid: [12,30]`, `far: [30,60]`) with `type === 'captured'` overriding the index outright (`:146-147`). **`Δa_k` is not sign-definite** — the measured adjacent-sibling inversion rate is ~20%. There is no well-defined annulus to partition until the ladder is monotone.

Landing 5 first computes every plain moon's mass from axes that step 6 then replaces — moving every mass **twice**, and validating the partition law against orbits that never ship. Step 6 has no reciprocal dependency on step 5: its Roche floor needs ρ_moon (step 2 ✓) and its Hill ceiling needs the parent and `zones` only.

---

## 2. PER STEP

### S0-a — citation-fence repair
- **Touches**: `tools/port-uniform-delta.mjs` (citation strings only), `docs/FEATURES/one-pipeline-two-frontends-PLAN.md`.
- **Change**: repair each of the 36 refs **by symbol**, per the tool's own instruction (`⭐ Do NOT just bump the integer… a ref repaired to a second wrong line is worse than the stale one`).
- **Cannot be later**: every B5 step edits the tree the fence walks; after step 1 a new break is indistinguishable from these.

### S0-b — the 57/7 disjointness replacement
- **Touches**: `tests/moon-rng-stream-identity.test.js` (new `it`, adjacent to `:279-290`).
- **See §4.** **Cannot be later**: the stream is green now and red from step 3 on.

### S0-c — ORPHANS mechanism change
- **Touches**: `tests/moon-rng-stream-identity.test.js:326-356`.
- **See §4.** **Cannot be later**: the containment is already false; **cannot be earlier**: nothing to fix before B5.0, which has landed.

---

### Step 1 — channel selector
- **`MoonGenerator.js:122-127`.** `:122` `const isLargeParent = planetData.type === 'gas-giant' || planetData.type === 'sub-neptune';` → `:123` the four-term short-circuit → `:127` `const type = this._pickType(...)`.
- **Change**: compute `channel` from `planetData.massEarth` and `planetData.composition.volatileFraction` — both in scope at `:117` before a line of `generate` runs (`PlanetGenerator.js:363-365` builds composition unconditionally via the `zones ? … : …` fallback; `:788` lands it on the record). **Zero draws.** Assign `moon.channel` in **two** places: the 8a append block (`:230-302`) and `_generatePlanetMoon`'s literal (`:433-454`) — `:124` returns before the append block ever runs.
- **⛔ Keep the cheap binary gate first in the boolean chain.** JS short-circuits left-to-right; 299 of 824 solid-parented calls spend zero draws at `:123` today. Any unconditional probability there costs +571 draws on FENCE-221 and reds DRAW STREAM — the one channel that can still detect a real leak while the window is open. **No Bernoulli in step 1.**
- **Discriminator for the companion**: `targetQ == null` inside `_generatePlanetMoon` (`:371`, the 7th parameter) separates the in-stream planet-class path from the companion path exactly. The companion gets its own label — PLAN:**61** (not :63) rules binaries a separate regime: `importing it here lets a 1 M⊕ parent legally emit a Charon labelled as a moon — inconsistent with deferring binaries as a separate regime`.
- **Derive the value once, in a helper both sites call** — otherwise step 4's merge becomes a rewrite rather than a move.
- **Cannot be earlier**: nothing precedes it. **Cannot be later**: steps 5/6 branch on the label.
- **No dependency on step 2.** The Nakajima gate reads the **parent's** composition; step 2 moves the **moon's**. Different object. PLAN:129 says so and it verifies.

### Step 2 — composition before size
- **`MoonGenerator.js:250-260` → above `:132`.** Move the derived-context consts (`ageGyr`, `luminosityRel`, `parentAU`) and `:256-260` (`compSeed`/`compFloat`/`deriveComposition`) above `:132` `const moonRadiusData = this._pickRadius(rng, type, planetData);`.
- **⛔ `:266` `moon.massEarth = moonRadiusData.radiusEarth ** 3 * (composition.density / RHO_EARTH_KGM3);` does NOT move** — it consumes the size by construction.
- **Re-key `:256`** to `mooncomp:${planetData.massEarth}:${planetData.radiusEarth}:${type}:${moonIndex}` — **733/733 distinct, measured on MC-197 at HEAD**. Amend the `:644-646` docstring; note `:571` already departs from it.
- **⛔ `:358` `moonecc:` stays byte-identical.** Deviation from PLAN:172, stated in the commit.
- **Draw-neutral**: `namespacedFloat` (`:655`) takes zero draws, so DRAW STREAM (`body-identity-fence.test.js:233` counts draws through a prototype accessor, not values) stays green. **BODY IDENTITY only.**
- **Cannot be earlier**: step 1's shape prediction must not be confounded with a whole-population value move. **Cannot be later**: step 3 is circular without it.

### Step 3 — mass-first sampler
- **`MoonGenerator.js:311-338`** replaced. `_pickRadius` has **exactly one executable call site, `:132`**, and it sits after the `:124` early return — so **step 3 cannot move a single planet-class or companion record.** That is the prediction.
- **Change**: sample mass; derive `R(M, composition)` with self-compression; `radiusScene` via `earthRadiiToScene` (`ScaleConstants.js:57-59`, linear); **map `radius` from the `radiusEarth` ratio** so `main.js:7630-7633`'s `noiseScale * (m.radius / m.radiusScene)` stays invariant.
- **⛔ The repo has no `R(M)`.** `PhysicsEngine.js:61-73`'s `estimateMassEarth` is forward-only (rocky `M = 0.9·R^3.7`, inverse exponent `1/3.7 = 0.2703` = PLAN:115's `~0.27`); `conditionVector.js:65-68` is a *gravity* shape. Write `R(M)` beside `estimateMassEarth` with a round-trip unit test, and **pick the sub-1-R⊕ exponent out loud** — `estimateMassEarth` uses `3.7` everywhere while `conditionVector.js:128-130` states `^(10/3)` below 1 R⊕, and p50 moon radius is 0.176 R⊕, so the whole population sits on the disputed branch.
- **Draw ledger to reproduce or predict**: `_pickRadius` is **1 draw** for `terrestrial`/`captured`, **2** for both remaining branches (`:320` `rng.chance(0.2)` + range; `:326` `rng.chance(0.12)` + range). Separately, the record literal `:189-228` is **1 unconditional draw (`:209`) + 6 terrestrial-gated** — not 6.
- **⛔ Ring-render coupling nobody named.** `Barycentre.js:95` reads `moonMassEarth(moons[i].data)`, and `BodyMass.js:37` returns `Math.pow(r, 2.5) * 0.5` for plain moons — **ignoring `moon.massEarth` entirely**. So step 3 moves the barycentre through **radius**, not mass: every dominated planet's `r1`/`r2` (`Barycentre.js:113`) shifts, and some planets cross `DOMINANCE_THRESHOLD = 0.99` (`:39`) in either direction. Predict it; it is a change to a render Max UAT-passed on 2026-08-19.
- **Cannot be earlier**: step 2 breaks the circularity. **Cannot be later**: step 4's merge is only checkable as zero-delta if the sampler is already final.

### Step 4 — the merge, as a ZERO-DELTA refactor
- **`MoonGenerator.js:371-454`** collapsed into the shared tail.
- **⭐ Ruling that differs from the plan's framing: merge the COMPUTE, not the RECORD.** Two record literals stay (`:189-228` plain, `:433-454` planet-class); the 8a append block stays plain-only. Merge only what is already identical — `_computeTidalHeating` (`:185` ≡ `:431`), `zoneSpread`/`orbitMultiple` (`:157-158` ≡ `:390-391`), map orbit (`:166-167` ≡ `:395-396`), `startAngle` (`:181` ≡ `:402`) — and parameterise the eleven genuine differences (type universe, sizing law, orbit bands, speed bounds, inclination bounds, retrograde on/off, palette source, `noiseScale` source, clouds/atmosphere source, aurora presence, the nested-planet build).
- **The prediction is: BODY IDENTITY moves ZERO records beyond what step 3 left.** That is what makes step 4 checkable at all.
- **⛔ Do NOT give planet-class records a top-level `massEarth`.** Three reasons, all verified: (a) `ExoticOverlay.js:389` branches on `hasOwnProperty(moon, 'massEarth')`, and `moon.planetData` appears **exactly once in that file** — flipping the branch kills the nested rescale outright; (b) `BodyMass.js:33` `if (moonData.planetData?.massEarth != null) return moonData.planetData.massEarth;` is what the flight model and the barycentre read; (c) census confirms `planet-class moons carrying top-level massEarth (expect 0) | 0` and `carrying planetData.massEarth | 51`.
- **⛔ Never introduce `rng.child` on the shared path.** `SeededRandom.js:93-96` consumes a draw; `MoonGenerator.js:709` `child: (suffix) => hashRng(\`${key}/${suffix}\`)` consumes nothing. The comment at `:686-690` claiming the surface behaves identically is **false for `child`**, and dormant only because nothing calls it.
- **Cannot be earlier**: it would force `densityRatio`-based inversion into shared code that step 3 deletes a commit later. **Cannot be later**: step 5 (ordered orbits) then has to edit two sites.

### Step 5 (= plan step 6) — ordered orbits, clamps, `orbitSpeed` from `a`
- **`MoonGenerator.js:136-167`** (the block reads **only** `type`, `moonIndex`, `planetData` — I opened `:126-190`; zero size dependency) and the merged speed site (was `:171` and `:400`; both **exact** at HEAD).
- **Change**: monotone ladder between the moon's own Roche floor and a Hill-derived ceiling; `v ∝ sqrt(M_p / a)` with `M_p = planetData.massEarth`, `a = orbitRadiusEarth`.
- **Roche**: `PhysicsEngine.js:839` `rocheLimit(planetDensity = 5500, moonDensity = 2000)` exists but `MoonGenerator.js:4` does **not** import it. **Hill**: `OrbitalMechanics.js:89-92` exists; nothing in `src/generation/` calls it. ⚠ **Unit trap** — `hillSphereRadius`'s jsdoc documents *both* masses in solar units while `planetData.massEarth` is Earth masses; `MoonGenerator.js:618` already carries `EARTH_MASSES_PER_SUN = 332946` for exactly this.
- **⚠ Zones nullity is a nicety, not a blocker.** The in-file comment at `:242-244` (`generate` has four shipped call sites… the three test call sites pass 4 or 6) is **stale**: there are **seven** executable call sites and only **two** omit `zones` (`ExoticOverlay.test.js:18`, `moon-mass-radius-consistency.test.js:37`, both 4-arg). The one production site always supplies it.
- **⚠ Draw parity**: two draws today (`:157`, `:158`), and `:157` is drawn even at `moonIndex 0` where it is multiplied to zero. An ordered ladder wants one. Retain a vestigial draw or predict the delta.
- **⛔ Must not disturb `:381`** — the `targetQ` inversion sits directly above the block being rewritten.
- **⛔ Moves `Barycentre.js:55`** `angleOwner(moon).orbitAngle + moon.data.orbitSpeed * celestialDt` — the pair's phase on the UAT-passed render. Needs Max's eyes, not mine.
- **Cannot be earlier**: Roche needs ρ_moon (step 2) and the merged single site (step 4). **Cannot be later**: step 6's partition has no `Δa_k` without it.

### Step 6 (= plan step 5) — feeding-zone partition
- **The merged sizing path.** `m_k ∝ Σ(a_k)·a_k·Δa_k`, `Σ ∝ a^(-p)`, deterministic, mass rank decoupled from orbital rank.
- **⛔ The baseline is not "mass is orbit-independent."** `_pickRadius` takes no `moonIndex` (`:311`), but `type === 'captured'` drives **both** halves: `:318-319` gives it the file's smallest fraction (`rng.range(0.02, 0.04)`) and `:146-147` forces it to the `far` band. Mass and distance are **anti-correlated** today. Size the delta against that, not against zero.
- **⚠ `p` is unruled** — PLAN:99 calls it a fitted calibration parameter set in B8, and names its own risk that a single `p` reproducing both Jupiter and Saturn may not exist.
- **Cannot be earlier**: see §1's deviation. **Cannot be later**: step 7's count law wants a mass budget to divide.

### Step 7 — count law + `ice`/`lava`
- **`PlanetGenerator.js:587-596`.** `:595` `const maxMoons = maxMoonsByType[type] ?? 1;` `:596` `const moonCount = rng.int(0, maxMoons);` — **one draw regardless of ceiling**, which is what keeps the planet stream neutral.
- **The `ice`/`lava` defect, confirmed**: the table (`:587-594`) enumerates 16 of `TYPES`' 18 (`:47-52`); `ice` and `lava` fall through `?? 1`. That it is an omission and not a policy is provable from the sibling `ringChance` table 47 lines up, which carries `'ice': 0.2` and `'lava': 0.02` explicitly (`:540-541`). **211 of 961 FENCE-221 planets — 22.0% — silently capped at ≤1 moon by two absent object keys.**
- **⛔ `N_reg` is not computable where the plan puts it.** It needs the **moon's own** `composition.density` for Roche; at `:595` the moon does not exist. The Hill half *is* computable (`:359` massEarth, `:372` starMassSolar, `orbitRadiusAU` as arg). Either accept `rocheLimit`'s `moonDensity = 2000` default as a parent-side proxy, or move the count law out of `PlanetGenerator` — and moving it perturbs the planet stream, which is forbidden (see §7 risk 2).
- **⛔ This is the ONE step that moves the binary companion.** `moonCount` changes `moons.length` at `StarSystemGenerator.js:600`, which is the companion's `moonIndex` (feeding `:387`, `:390`, `:395`, `:400`) and the `mi` of the §8.4 coordinate. **Its `targetQ` and delivered `q` do NOT move** — the hash key is `binarypair:${_systemSeed}:${planetData._ordinal}` and `planetData._ordinal = i` (`StarSystemGenerator.js:567`), the *planet* index. Restate the coordinate list here.
- **Cannot be earlier**: it invalidates every population literal at once, so it must land where the fewest steps follow. **Cannot be later**: step 8's C4 heads need a count law to hang off.

### Step 8 — C4 irregular tail + render policy
- **`MoonGenerator.js`** (new channel), **`StarSystemGenerator.js:600+`**, **`src/main.js:7699-7724`**.
- **⛔ Append C4 heads AFTER `StarSystemGenerator.js:600`.** Then step 8 moves zero companions.
- **⛔ Park the tail summary on the WRAPPER, not `planetData`.** `ExoticOverlay.js:401` `planetEntry.planetData = newData;` replaces it wholesale.
- **`retrograde` becomes a real field.** Today it is a local at `:179`, consumed once at `:203` as a sign flip, never written into the literal. `SolarSystemData.js:468` carries `retrograde: true`, so any law reading `moon.retrograde` works on Sol and reads `undefined` on every generated moon.
- **Render policy — the corrected insertion point.** PLAN:95's `main.js:7683-7696` is stale: `:7683` is `} else {`, `:7696` is `moon.addTo(scene);`. At HEAD the primitives are `:7701` `Billboard` (**dead** — force-hidden at `:11566`, stated at `:11505-11506`), `:7706` `PlanetBillboard` (gated on `mIsGhost && moonNearby` at `:11576`), `:7718` `OrbitLine` (**ungated by size — the only one**).
- **⛔⛔ The size gate must construct, push, and suppress — NEVER skip the push.** Two positional identities break otherwise: `:7717` `const _isBary = _domRings != null && moonOrbitLines.length === _domRings.index;` (a skipped push hands the barycentric `r2` to the wrong body) and `:7940` `_orbitLineTargets.set(entry.moonOrbitLines[m].mesh, …)` bounded by `entry.moons.length` at `:7939` (a skipped push reads `undefined.mesh` and throws at spawn). The mirror trap is already documented at `:7936`.
- **⛔ Any pass over `moonOrbitLines` must skip `line._baryCentred`** — `:7742`/`:7747` push the primary's own ring into the same array with no moon behind it.
- **Honour the flag at all three wholesale writers**: `:7723`, `:8466`, `:10605`. (`:10677` `setVisibilityFactor` is a fade factor; leave it.)
- **Threshold: 100 km (`0.01570 R⊕`), keyed on `moonData.radiusEarth`.** My call. It puts C4's 85–100 km head below the gate — consistent with head-materialised / tail-billboarded — and it also removes rings from **49 moons that ship today** (p05 is 95 km). ⛔ **That last consequence belongs in the UAT ask**, not in the discovery.
- **⚠ The Domingos acceptance instrument already exists but is on a different AU convention.** `tools/moon-census.mjs:451-453` reports `overProgradeLimit` (0.4895 R_H), `overRetrogradeLimit` (0.9309 R_H) and `beyondDomingos` — but its stated convention is `a_p = FINAL wrapper.orbitRadiusAU` (post-migration), while `MoonGenerator.js:370` marks the build-time AU as `the parent's GENERATION-time orbit, never its post-migration one`. A generator that places every irregular inside the limits at generation-time AU can still red the census on any migrated system. Restate the acceptance number in the generation-time convention, or the instrument is not the gate it looks like.
- **Cannot be earlier**: needs step 7's counts. **Cannot be later**: step 9 rescales its records.

### Step 9 — overlay mass ratio + §4b
- **`ExoticOverlay.js:367-397`** — **the PLAN's citation is EXACT at HEAD**; I opened the whole block.
- **Change**: introduce `kMass = newData.massEarth / oldData.massEarth`; drive mass off it; re-derive radius. `:369` `kEarth` and `:370` `kMap` survive **for the orbits only**.
- **⛔ The orbits stay on `kEarth`/`kMap`.** `MoonGenerator.js:161` `orbitRadiusEarth = planetData.radiusEarth * orbitMultiple` — the orbit is expressed *in parent radii*. `:374-375` and `:377` are correct today. The step statement's "not the radius ratio" applies to the **mass/size pair only**; an implementer following it literally breaks every rescaled orbit.
- **⛔ `composition.density` is not rescaled.** `:380-381` already rules it: `bulk density is a property of what the moon is made of, not of how big its parent is`.
- **Recommended form**: `radiusEarth_new = radiusEarth_old · cbrt(kMass)`. It preserves the body's own implied density, is identical to `composition.density` on every plain moon by construction, and keeps `moon-condition-contract.test.js:304` a live coupling check rather than a tautology.
- **⛔ ADD the planet-class arm the step statement omits.** `moon.planetData.radiusEarth`, `.radiusScene` and `.radius` are never rescaled at HEAD, while `main.js:7666` renders the mesh from `moonData.planetData.radiusScene`. Scale them by `cbrt(kMass)` alongside `:389`'s nested mass, or the swapped planet-class moon's rendered size and its mass stay divorced.
- **⛔ `BodyMass.js:25-30` names a third mass rule and files itself against step 9.** I rule **do not touch it.** `moonMassEarth` returns `planetData.massEarth` for planet-class and `r^2.5·0.5` for plain, and it is what `GravityField`, the SOI and `Barycentre.js:95` read. Changing it moves the flight model on 502 of 521 moon-bearing planets, which neither PLAN:179 nor Max's ruling scoped. **Separate queue item; state the deferral in the commit.**
- **§4b (Max's ruling)**: `MoonGenerator.js:381` — split the one line into three named steps (band / inversion / clamp) so the clamp is an editable expression, then act on it per §8.
- **Cannot be earlier**: it repeats step 3's `R(M, ρ)` law, and it rescales step 8's records. **Cannot be later**: it is last.

---

## 3. ⛔⛔ THE COMPANION-PRESERVATION CONTRACT

*Re-read this before every commit from step 1 on. It is the section that decides whether the window's only exact prediction survives.*

### The three invariants, restated as things you check

**I-1. The companion is built from `hashRng`, never the generation stream.**
`MoonGenerator.js:606` — `return this._generatePlanetMoon(hashRng(key), planetData, moonIndex, parentZone, zones, parentOrbitAU, targetQ);`
`hashRng` (`:694-702`) is a positional counter: `const next = () => namespacedFloat(\`${key}#${n++}\`);`. Its key is `binarypair:${planetData._systemSeed}:${planetData._ordinal}` (`:597`), and `planetData._ordinal = i` — the **planet** index (`StarSystemGenerator.js:567`). **Therefore the companion's selection, its `targetQ`, and every value it draws are independent of which moons exist.** They depend only on the *order and count* of draws consumed inside `_generatePlanetMoon`.

**I-2. 28 built vs 27 shipped. `wd-170` is the extra. Do not "fix" it.**
DRAW STREAM's red set counts companions BUILT; the §8.4 coordinate list counts companions SHIPPED.

**I-3. `q = (ρ_c/ρ_p)·f³`, and `targetQ` inverts it exactly.**
`:381` `const fraction = targetQ == null ? rng.range(0.10, 0.25) : Math.min(0.95, Math.cbrt(targetQ * densityRatio(planetData, pData)));`
Exactness rests on two things: `densityRatio` (`:672-676`) reading the *implied* density `mass/radius³`, and the cube at `:418` `const massScale = pData.radiusEarth > 0 ? (radiusEarth / pData.radiusEarth) ** 3 : 1;` preserving `pData`'s density through the shrink. **Break either and `q` moves silently while the coordinate list still matches.**

### What EVERY step must do

1. **Never route the companion through the shared `rng`.** `hashRng(key)` at `:606` is the entry point. If a step needs a new value on the companion, derive it from a `namespacedFloat` key, not a draw.
2. **Preserve the companion's draw COUNT and ORDER inside `_generatePlanetMoon` exactly.** Today: **#0** `rng.pick(allowed)` at `:374`; **#1…** `PlanetGenerator.generate` at `:378`; **zero at `:381`** (the `targetQ != null` arm short-circuits past `rng.range(0.10, 0.25)`); then `:390`, `:391`, `:396`, `:400`, `:401`, `:402`. Any insertion, deletion or reorder moves every companion.
3. **⛔ Never call `rng.child(...)` on any shared path.** `hashRng.child` (`:709`) consumes nothing; `SeededRandom.child` (`SeededRandom.js:93-96`) consumes a draw. The plain population would advance and the companion would not, invisibly to DRAW STREAM (which cannot see `hashRng`) and to the coordinate list (which is hash-derived). The comment at `:686-690` asserts the opposite.
4. **Anything that changes `moons.length` at `StarSystemGenerator.js:600` moves every companion's ORBIT and its `mi` coordinate.** Only **step 7** is permitted to do this, and it must restate the §8.4 list in its own commit. **Step 8's C4 heads append AFTER `:600`.**
5. **Do not give planet-class records a top-level `massEarth`** (see step 4).
6. **Do not re-evaluate `selectsBinaryCompanion` against `generate()`'s output** to build any check. `:563-566` says it: `ExoticOverlay` retypes afterwards and strips `_systemSeed`/`_ordinal` (`ExoticOverlay.js:401`), and `:570` bails on null — so a post-generation re-evaluation is **short by exactly one row on FENCE-221** and would silently skip the overlay-swapped companions, which are precisely the ones most likely to have moved.

### What STEP 4's MERGE MUST CARRY — the checklist

The merged signature and body must carry, without exception:

- **the `hashRng` entry point at `:606`** — `generateBinaryCompanion` keeps calling the merged tail *directly*, not through `generate`;
- **the `targetQ` parameter** (`:371`, 7th positional, default `null`). ⚠ `generate` already takes 7 positionals (`:117`) and its **seven** call sites pass 4, 6 and 7 args. An 8th positional is fragile — use an options object, and update all seven sites;
- **`targetQ`'s zero-draw property at the sizing step.** The ternary must keep short-circuiting;
- **`PlanetGenerator.generate` as draw-consumer #1 with the same five arguments**, including `Math.max(parentOrbitAU ?? 1.0, 0.01)` — the *generation-time* AU. This is the line the `postmigration` mutant substitutes;
- **`:387`'s `moonIndex <= 2 ? 'mid' : 'far'` band, `:390`'s spread, `:395`'s map base and `:400`'s speed divisor as the companion sees them** — step 4 is zero-delta, so these keep their current values on the companion; step 5 (ordered orbits) changes them once, deliberately, for both populations;
- **`isPlanetMoon: true` (`:435`) and `planetData` (`:436`)** in the returned literal — population membership is a presence test (`body-identity-fence.test.js:471-475`), and `BodyMass.js:33` and `moon-condition-contract.test.js:108` (`if (out && !out.planetData)`) both branch on it;
- **the `massScale` cube at `:418`**;
- **the 20-key shape.** `body-identity-fence.test.js:779` pins `planetClass: { shapes: 1, keyCounts: [20], records: 24 }`. Step 1 takes it to `[21]`. Nothing else may.

**Step 4's acceptance test is that the companion's records are byte-identical before and after the merge.** If they are not, the merge is wrong, not the prediction.

---

## 4. THE TWO TEST ARTEFACTS THAT SHIP REGARDLESS

### (a) The ORPHANS mechanism change — lands as **S0-c**

**What is broken.** `calls` comes off a wrapper on `MoonGenerator.generate` (`:326` `MoonGenerator.generate = function counting(...args) {`). `survivors` walks the finished system (`:338-341`). The companion never passes through `generate` — `MoonGenerator.js:606` calls `_generatePlanetMoon` directly. At HEAD `:349`'s `{calls: 758, plainCalls: 733, planetClassCalls: 25}` **still passes** while `:351` measures `survivors 750, survivingPlanetClass 45`. So `:355`'s `orphanPlanetClass = 25 − 45 = −20`. **A negative orphan count is the containment `calls ⊇ survivors` — the invariant the test exists to state — reading false.** Re-deriving the literal would leave a green test asserting an impossibility.

**What it asserts after the change.** Add a third counter wrapping **`MoonGenerator.generateBinaryCompanion`** — ⛔ **not `_generatePlanetMoon`**, which after step 4 is on the shared tail and would double-count every merged planet-class moon. Restate:

```
expect({ calls, companions, survivors })          // containment inputs
orphans: (calls + companions) − survivors
```

**Mutant proof.** The existing `keeporphans` mutant (`:318` — *remove the binary-stability cull; `orphans` goes to 0 and this reds*) must still red the restated arithmetic. Run it the way the file already runs `extradraw`: as a parameterised live control inside the harness (`:295-297`), not from a comment.

**Cost**: ~8 lines. The wrapper site already exists two lines up.

### (b) The 57/7 disjointness replacement — lands as **S0-b**

**What it replaces.** `moon-rng-stream-identity.test.js:279-282` (the 57/7 partition) and `:287-290` (the four span assertions). `:273-274` records why: `Math.min(...nums(planetClass))` **is the only assertion in the tree that separates the two AU conventions**, and it is marked *do not relax this to a range*. Step 4 dissolves its anchor, `MoonGenerator.js:378`.

**What the replacement asserts.** Every planet-class record's `T_eq` equals `equilibriumTemperature(zones.luminosity, generationAU)` where `generationAU = Math.max(parentOrbitAU ?? 1.0, 0.01)` — the **generation-time** parent orbit.

Three construction requirements, each from a line I opened:
1. **Capture at the planet-class layer** — wrap `MoonGenerator._generatePlanetMoon`, not `generate`. ⛔ The existing T_eq gate at `moon-condition-contract.test.js:397-402` **cannot serve**: its wrapper filters planet-class out at `:108` (`if (out && !out.planetData)`), and the `postmigration` mutant lives *inside* `_generatePlanetMoon`. It would read green through the mutant.
2. **Read `T_eq` off `planetData`, not the moon.** A planet-class record is 20 keys and carries none of its own.
3. **Assert a discriminating count**, or the test is vacuous wherever pre- and post-migration AU coincide.

**How the mutant proof is run — Route B, self-contained.**
⛔ Stryker cannot do it: `stryker.conf.mjs` scopes mutation to `tests/helpers/source-scan.mjs` and three named test files; `MoonGenerator.js` is in neither. A hand-applied `sed` in a detached probe worktree works but is a proof that can be forgotten. **Instead, compute both conventions inside the test**: `equilibriumTemperature(lum, generationAU)` and `equilibriumTemperature(lum, finalAU)` — assert the record matches the first, assert it *differs* from the second on exactly the pinned count, and assert that count is non-zero. That is the mutant proof, permanently. It is the same idiom `:295-299` already uses.

**Corpus.** Write it in `moon-rng-stream-identity.test.js` on its own `wd-0…wd-1499`, where the measured margin is **307/307 exact, 33 discriminating** — not on the contract's 197 seeds, where it is 45/45 with only **4** discriminating and one corpus change from vacuity. Pin `discriminating: 33` beside the equality.

**When.** Before step 3, while the stream is still green.

---

## 5. THE INSTRUMENT LEDGER

**Red at HEAD (verified by running the tools):** 8 newly-red tests over a blessed baseline of 24; `moon-census` exit 3 (`planet-class moons 51 vs 24`); `port-uniform-delta` structural break exit 2 (`526 → 633` bodies); **citation fence 36 BROKEN, exit 2.**

| instrument | HEAD | B5 moves it? | how it closes | kind |
|---|---|---|---|---|
| **A** per-test-ID (`known-failures.json`) | ✗ 8 newly red | yes, every step | `npm run test:baseline:record` | **re-recordable** |
| **B** `body-identity.json` | ✗ DRAW STREAM `:646`, BODY IDENTITY `:687`, RECORD SHAPE `:777` | yes — 1, 3, 5, 6, 7, 8, 9 | `WD_REBLESS_BODY_IDENTITY=1` | **re-recordable** |
| **B** `PLANET_CLASS_MOONS` `:288-293` | ✗ 24 vs 51 live | **yes, at steps 7 only** (8 is neutral if heads append after `:600`) | hand | **hand-derived** |
| **B** population `:687` | ✗ | yes — 7, 8 | hand | **hand-derived** |
| **B** `onDisk` `:697` | ✓ **green** (reads the on-disk baseline) | not by code | moves once, at B7's re-bless; edit in the same commit | **hand-derived** |
| **B** moved partition `:740-742` | ✗ | yes; ⛔ **must land in the same commit as `:288`** — the classifier at `:733` reads `planetClass.has(key)` | hand | **hand-derived** |
| **B** shape census `:777-780` | ✗ `records 24` vs 51 | yes — step 1 takes `plain [25]→[26]` and `planetClass [20]→[21]`; steps 7/8 move `records` | hand, **4 numbers not 1** | **hand-derived** |
| **B** `hiddenBodyKeys` `:787`, `bakeMisses` `:804` | ✓ green | only if step 1 appends non-enumerably (don't) | keep green | — |
| **C** shipped uniforms | ✗ exit 2 structural | yes | `node tools/port-uniform-delta.mjs --record --force` (exit 65 without `--force`) | **re-recordable** |
| **C** citation fence | ✗ **36 broken, unaccounted** | yes (B6 adds its own) | ⛔ **no record mode** — repair by symbol | **hand-derived** |
| `moon-rng-stream-identity` ORPHANS `:349-356` | ✗ | yes, plus a **mechanism** change (§4a) | hand + harness | **hand-derived** |
| `moon-rng-stream-identity` 57/7 `:279-290` | ✓ **green** | red from step 3 | replaced (§4b), not re-derived | **hand-derived** |
| `moon-rng-stream-identity` `PINNED_STREAM_SET` | ✓ | yes — step 3 reorganises per-`(parentType, moonIndex, resultType)` draw counts | hand | **hand-derived** |
| `moon-condition-contract` | ✗ `:162`, `:370` | yes — **13 population-coupled literals** (`705`×6 at `:171/:213/:221/:492/:537/:690`, `733`×3 at `:166/:254/:402`, `728` at `:163`, `23`×2 at `:162/:370`) | hand | **hand-derived** |
| `moon-condition-contract:245` | ✓ | **goes tautological at step 3** (mass-first defines the identity) | note it; `:304` carries the load | — |
| `moon-condition-contract:304` | ✓ | **stays live** — walks `plain` (`:99`), reds on any decoupled mass/radius mutant | keep green | — |
| `moon-condition-contract:542` (`>600`) | ✓ | ⛔ **the gate step 2's key must clear.** Measured: `parent:type` = 607/733 built (591/705 survivors — fails); `+moonIndex` = 733/733 | keep green | — |
| `tools/moon-census.mjs:116` | ✗ exit 3 | yes — `plain` and `planetClass` both, at 7/8 | ⛔ no mechanism **by design** (`:830-831`: *Do NOT adjust the expected numbers to match. Report it.*) | **hand-derived** |
| `binary-barycentre.test.js:163-174` | ✗ 2 of 10 rows (`wd-10`, `wd-27`, both `moons 5→6`) | yes, any count change | hand | **hand-derived** |
| `material-parity-list.test.js:288-289` | ✗ **absent from handoff §3** — `withMoons 228→229`; `:289` `moons 456→461` **masked** | yes | hand, **2 literals** (the other 7 pins are unmoved) | **hand-derived** |
| `ProcgenSnapshot.test.js` | ✗ 23/23, blessed | already maximally red — no further signal | `node scripts/capture-procgen-snapshot.mjs` | **re-recordable** |
| `l0-moon-baseline.json` | ✓ | yes at step 3 | `node src/generation/__tests__/__fixtures__/regen-l0-moon-baseline.mjs` | **re-recordable** |
| `port-condition-contract.test.js:286` `CORPUS_BODIES = 526` | ✓ **green** | ⛔ **must not move** | no mechanism — a break is a hand-repair with no net | **must stay green** |
| `tools/binary-yield-probe.mjs` | ✗ exit 3, 33 unresolved | — | ⛔ **stale**: re-applies the companion channel on a tree that ships it (`50 → 76`); needs re-basing past B5.0 before it generates `:288` | — |

**⛔ Masking.** Vitest stops an `it` at its first failure. Five literals are already red-in-waiting behind a visible one (`material-parity-list:289`, `body-identity-fence:703`/`:740`, `binary-barycentre`'s `wd-27` row). **Measure every population-coupled literal directly; never infer the toll from what is currently red.**

**Six instruments have no re-record mechanism.** B7 is four commands **plus ~70 hand-derived numbers across six files, on five non-interchangeable corpora** (FENCE-221 / MC-197 / PCC-526 / STREAM-1500 / LAB-PROCEDURAL-200). Stamp every number with its corpus.

**"Do not re-record mid-window"** appears in writing exactly once — handoff `:17`. Its four in-code justifications are `known-failures.json._readme`, `scripts/test-baseline.mjs:73-77`, `tools/port-uniform-delta.mjs:1685` (*A blanket re-record is how a regression becomes the new baseline*) and `body-identity-fence.test.js:56-57`. Promote it into the PLAN's B7 section with those citations.

---

## 6. STALE REFS FOUND — consolidated

**PLAN, `docs/FEATURES/moon-formation-channel-model-PLAN-2026-08-15.md`:**

| cited | actual | note |
|---|---|---|
| PLAN:138 (`Assigned unconditionally…`) | **PLAN:137**; :138 is blank | I opened `sed -n '136,139p'` |
| PLAN:167 (B4 prediction para) | **PLAN:166**; :165 is the heading, :167 blank | |
| PLAN:63 (binaries refused) | **PLAN:61** — `⛔ Cut the Pluto–Charon anchor… inconsistent with deferring binaries as a separate regime`. :63 is the density signature | the ruling exists, at a different line |
| `MoonGenerator.js:150-154` (orbit bands) | **`:140-144`** | ⚠ already wrong at `e64fae2` |
| `MoonGenerator.js:160` (`orbitRadiusEarth`) | **`:161`**; :160 is the comment | ⚠ already wrong at `e64fae2` |
| `MoonGenerator.js:567-569` | **`:644-646`** | +77 from B5.0 |
| `MoonGenerator.js:578` / `:543-577` (`namespacedFloat`) | **`:655`** / **`:655-664`**, docblock `:620-654` | +77 |
| `MoonGenerator.js:536` (`RHO_EARTH_KGM3`) | **`:613`** | +77 |
| `MoonGenerator.js:250-260` (`deriveComposition`) | call is **`:258-260`**; `:250-257` are the guards + seed, which move **with** it | imprecise, load-bearing |
| `StarSystemGenerator.js:594` (arg-7 site) | **`:595`**; :594 is the child rng | PLAN is internally inconsistent — §2 says :595 |
| `StarSystemGenerator.js:457-467` "nine-field `zones`" | span correct, **twelve keys** since B3 | field count, not line |
| `main.js:7683-7696` (render primitives) | **`:7699-7724`** — Billboard `:7701` (**dead**), PlanetBillboard `:7706`, OrbitLine `:7713-7724` | ⛔ step 8's own edit site |
| `main.js:7690` (`new OrbitLine(moonData.orbitRadius, …)`) | **`:7718`**, now `new OrbitLine(_isBary ? _domRings.r2 : moonData.orbitRadius, 0x00bb00)` | drift is +23…+28, non-uniform |
| PLAN §5 "the orbit is a circle *centred on the planet*, by construction" | **false at HEAD** — `main.js:7749-7751` centres `_baryCentred` rings on the empty point | claim, not line |
| `ExoticOverlay.js:388` (in PLAN:199) | **`:389`**; :388 is a comment | |
| PLAN §3 **B1** — ring divisor described as pending | **DONE** at `3800dff`. `PhysicsEngine.js:912` reads `params.planetRadiusEarth`. Line number never moved | stale *finding* |
| PLAN §3 **B2** — `CITE_SOURCES` widening + three rotten-ref repairs described as pending | **DONE**. `tools/port-uniform-delta.mjs:1086` carries the widening; `body-identity-fence.test.js:128`/`:406`/`:106` are repaired | stale *finding* |
| `tests/moon-mass-radius-consistency.test.js:25` (4-arg call) | **`:37`** | ⚠ already wrong at `e64fae2` |
| PLAN:51 `ocean` 0.57–**7.34** M⊕ | measures **7.18** at HEAD; the straddle claim holds | corpus drift |

**In-tree comments that are stale (flag, do not fix — B6/B7 own them):**

| location | says | actual |
|---|---|---|
| `MoonGenerator.js:242-244` | `generate` has **four** shipped call sites; three tests pass 4 or 6 | **seven** executable sites; only **two** omit `zones`; `moon-condition-contract.test.js:812` passes all seven |
| `MoonGenerator.js:686-690` | the `hashRng` surface behaves identically to `SeededRandom` | **false for `child`** (`:709` vs `SeededRandom.js:95`) |
| `MoonGenerator.js:644-646` | keys carry no per-system seed and no per-body counter | `:571` already does both |
| `moon-condition-contract.test.js:312` | `⛔ EXPECTED TO FAIL TODAY` | the `*= kEarth ** 3` fix landed at `10d4d1a`; B5.0 only added the guard |
| `body-identity-fence.test.js:699-702` | `baseline.planetClassMoons` does not exist on disk | it does — 24 strings |
| `moon-rng-stream-identity.test.js:126/:235/:246/:263/:269` | `MoonGenerator.js:100 / :157 / :245 / :320 / :346` | `:124 / :181 / :257 / :378 / :402` |
| `tools/binary-yield-probe.mjs:62` | `MoonGenerator.js:578-587` | `:655-664` |
| `docs/SYSTEMS/generation/README.md:221` | the `:123` gate fires on 28.36% | **30.70%** on FENCE-221 (253/824). Corpus-stamp both |

---

## 7. RISK REGISTER — ranked

1. **⛔ Step 7 is the single widest blast radius and it is the one step that moves the companion.** It moves 705, 733, 728 and 23 simultaneously across six files, restates the §8.4 coordinate list, and if it perturbs any *planet*-layer draw it reds `port-condition-contract.test.js:286`'s 526-body pin, which has **no re-bless**. **Early warning**: run `port-condition-contract` alone, first, before touching any other literal. `PlanetGenerator.js:596`'s one-draw-regardless-of-ceiling property is what keeps it green — treat it as load-bearing, not a nicety.

2. **⛔ The step-2 key decision is a fork with a measured wrong branch.** The naive pre-size key fails `moon-condition-contract.test.js:542`'s own `>600` floor. **Early warning**: run that single gate as the first thing after step 2 lands. If it reds, the key is wrong, not the corpus.

3. **⛔ Step 3 moves a render Max UAT-passed four days ago, by a path nobody named.** `Barycentre.js:95` reads `moonMassEarth`, and `BodyMass.js:37` returns `r^2.5·0.5` for plain moons — so a *radius* change moves every dominated planet's ring radii and can flip planets across `DOMINANCE_THRESHOLD = 0.99`. **Early warning**: `binary-barycentre.test.js`'s ten PINS; count how many of the ten `moons`/ring columns move against the two already red.

4. **⛔ Step 4's density collision, if the merge unifies the record.** Two mass models disagree by up to ~3× on the same body. Delivered `q` would move while the coordinate list still matched — **silently**, because §8.4 checks coordinates, not `q`. **Early warning**: measure delivered `q` on every uncapped companion before and after step 4 and refuse to land on any move. ⛔ Build the check from the **pre-overlay** list, not by re-evaluating `selectsBinaryCompanion` on `generate()`'s output (`:563-566`).

5. **⛔ Step 8's size gate can silently mis-assign the barycentric ring.** A skipped `moonOrbitLines.push` breaks `:7717`'s positional identity *and* throws at `:7940`. **Early warning**: `moonOrbitLines.length` per planet must equal `entry.moons.length` (+1 when dominated) at all times.

6. **⚠ RECORD SHAPE will carry three or four causes on one assertion after step 1** — `plain [25]→[26]`, `planetClass [20]→[21]`, and the already-red `records 24→51`. If B4's prediction does not enumerate all of them, B7 cannot distinguish an expected move from an accident and will bless whatever is there.

7. **⚠ Instrument A's baseline was recorded from a DIRTY tree** (`recordedFromCommit d26971d, dirty: true`). Do not treat the 24-failure baseline as reproducible from a clean checkout of that commit.

8. **⚠ Cross-corpus quoting has already bitten this lane repeatedly.** Three finders quoted FENCE-221, MC-197, BULK-192, `wd-0…wd-299` and `wd-0…wd-1499` numbers in the same paragraph. `tools/moon-census.mjs:19-25` exists because of this. **Stamp every number.**

9. **⚠ `_pickRadius`'s terrestrial branch is nearly unexercised** on small corpora (it needs an HZ giant parent plus `rng.chance(0.03)` at `:499`). It *does* fire in the 1500-seed fence corpus (`moon-rng-stream-identity.test.js:179`, `:185` pin two terrestrial lines). Do not treat "0 occurrences on 300 seeds" as evidence about the branch.

10. **⚠ The C4 acceptance instrument measures a different AU than the generator can see** (post-migration vs generation-time). Restate the acceptance number, or step 8 can red an instrument it satisfies.

---

## 8. OPEN QUESTIONS FOR MAX

**Exactly one.** Everything else I have decided above.

**The §4b `0.95` cap disposition — a naming call with a visible consequence.**

The cap (`MoonGenerator.js:381`) protects one thing: *the companion is never physically bigger than its primary*, which is what makes your naming ruling true by construction. Removing it makes **4 of 99 companions wider than their primary while still lighter** (`q ≤ BINARY_Q_MAX = 0.83`, `:554`) — worst `wd-234/5`, 17% wider. So "larger" stops being decidable from one number, and your ruling was written against a population where the case could not occur.

**And it moves a render you passed on 2026-08-19.** Companion mass ∝ `f³` (`:382`, `:418`), and `Barycentre.js:113` `r1 = a · massFraction` reads that mass through `BodyMass.js:33`. On `wd-234` removing the cap takes `f` from 0.95 to 1.1685 — mass ×1.86, and the pair's two rings resize by nearly that. All 7 cap-binding pairs are ring-bearing.

| option | recovers | worst residual shortfall | ring cost |
|---|---|---|---|
| A — leave at 0.95 | 0/7 | 46.3% | none |
| B — raise to 1.00 | 3/7 fully | 37.6% (`wd-234`) | ≤1.17× on 3 pairs |
| **C — remove; designate the primary by MASS** | **7/7** | **0%** | up to 1.86× on 1 pair, 4 pairs read wider |

**My recommendation: C**, with `moon.qDelivered` / `qClipped` recorded regardless. "Primary" is a mass word everywhere in the two-body literature, `q` is already defined that way at `:381`, and `Barycentre.js:95` already keys dominance off mass × orbit radius. If you prefer B, the receipt makes the residual clip visible instead of silent.

**The number you need: 4 of 99 pairs, worst 17% wider, always lighter; one pair's rings grow 1.86×.**

*Two things I decided rather than asked, both flagged for your UAT rather than your ruling:* the small-moon threshold is **100 km**, and that commit **removes orbit rings from 49 moons that ship today** (p05 is 95 km) — a visible change to the current game, not only to C4's output. And step 5 (ordered orbits) recomputes `orbitSpeed`, which moves the barycentre pair's phase every frame — it is not broken by it, but it needs your eyes once.

---

## 9. NOT FOUND

Established read-only; each with what would settle it.

1. **No ruled numeric value for C1's volatile-envelope threshold.** PLAN:37 says `composition.volatileFraction above the envelope threshold` and never fixes the number, unlike C2's explicit `0.4` (cross-referenced to `PhysicsEngine.js:412-413`, verified). **Settled by**: one number, ruled before step 1 is written.
2. **No defined `channel` value for the parents satisfying neither C1's mass arm nor C2's precondition** (~55 of 824 calls on FENCE-221). PLAN:137 requires unconditional assignment with explicit nulls. **Settled by**: naming the value in step 1's commit.
3. **No `moon.channel`, `moon.figure`, `irregularSwarmCount` or any swarm field anywhere in `src/`, `tools/` or `tests/`.** All new.
4. **No `R(M)` function in the repo.** `estimateMassEarth` is radius→mass; `gravityRadiusShape` is radius→gravity-shape. **Settled by**: writing it in `PhysicsEngine.js` beside the forward law, with a round-trip test.
5. **No replacement values for `ice` and `lava` in `maxMoonsByType`.** PLAN §3 step 7 says only "table repair." Two numbers that move 22.0% of the planet population. **Settled by**: a ruling in step 7's commit, or by the geometric count law retiring the table entirely.
6. **No value or law for the partition exponent `p`.** PLAN:99 calls it a fitted parameter set in B8, and states its own risk that one `p` may not fit both Jupiter and Saturn.
7. **No normalisation constant for `v ∝ sqrt(M_p/a)`.** `orbitSpeed` is consumed as radians per `celestialDt` (`main.js:11314`, `Moon.js:589`). **Settled by**: one constant anchored on a named real body, in the `N_irr` template §1 C4 already calls "the only honest template."
8. **No test anywhere compares a moon's radius or mass to its parent's.** I looked specifically for what the `0.95` cap protects. `moon-mass-radius-consistency.test.js:70` bounds bulk density only; `moon-condition-contract.test.js:245`/`:304` assert within-body identity only. **The cap's only protection is prose** — handoff §8 item 2.
9. **No ruling on where the C4 tail summary is stored.** My recommendation (the wrapper, not `planetData`) is derived from `ExoticOverlay.js:401`'s behaviour, not read off a decision.
10. **No prior decision on whether step 9's mass ratio applies to the orbit scalings** (`ExoticOverlay.js:374-377`). My ruling (leave them on `kEarth`/`kMap`) is derived from `MoonGenerator.js:161`'s parent-radii convention.
11. **No re-derivation source for `body-identity-fence.test.js:288`'s 51-entry coordinate list that works at HEAD.** `tools/binary-yield-probe.mjs` is the intended generator (`:241`) but exits 3 unstamped, needs a detached probe worktree per its own header (`:33`), and its "today" baseline predates B5.0 so it double-applies the channel (`50 → 76`). **Settled by**: re-basing the probe's baseline past B5.0, then running it stamped in a worktree. ⚠ Its "today" also reads 50 where `moon-census` reads 51 — close that one-body gap first.
12. **I did not run the full suite.** The instrument-toll agent's 8-newly-red measurement is its own; I independently reproduced the citation fence (36 broken, exit 2), `moon-census` (exit 3, 961/770/51/821), and the step-2 key cardinalities on MC-197. Everything else in §5 I read but did not execute.
---

## 10. ⭐ WORKING-CLAUDE'S VERIFICATION — 2026-08-19, before any step was cut

Per the lane rule *"VERIFY THE VERIFIERS."* Lines opened at `49d1bf7`/`905f77e`.

### Upheld, by direct measurement

| claim | verified how |
|---|---|
| **citation fence RED, 36 broken** | Ran it: `RESULT: 36 BROKEN CITATION(S). Exit 2.` ✅ **Now repaired at `905f77e` — 423/0, exit 0.** |
| broken by `52031fd` | `git show 30b030b:src/main.js \| sed -n '7657p'` returns the cited symbol exactly; at HEAD that line reads `const moonOrbitLines = [];`. Attribution exact. |
| `_pickRadius` has ONE executable call site | `grep -n _pickRadius` → `:26` (comment), `:132` (call), `:311` (definition). `:132` sits AFTER the `:124` early return, so **step 3 provably cannot move a planet-class or companion record.** |
| `SeededRandom.child` consumes a draw | `SeededRandom.js:95` `return new SeededRandom(this.rng() + '-' + suffix);` — `this.rng()` IS the draw. `MoonGenerator.js:709` `child: (suffix) => hashRng(...)` consumes nothing. **The in-file comment at `:686-690` claiming parity is false.** |
| ORPHANS containment already false | Ran the file. `:349`'s `{calls, plainCalls, planetClassCalls}` **passes** (25 planet-class calls) while `:351` measures `survivingPlanetClass: 45` ⇒ orphans **−20**. |
| the `0.95` cap, verbatim | `MoonGenerator.js:381` — the `targetQ == null` ternary short-circuits past `rng.range(0.10, 0.25)`, so the companion path really is zero-draw there. |
| `StarSystemGenerator.js:600` passes `moons.length` | Confirmed on the single long line; `_ordinal` is `${i}.${moons.length}`. |

### ⛔ CORRECTED — two synthesis claims that do not survive

1. **Risk #3 calls the step-3 barycentre coupling "a path nobody named." That is FALSE.**
   `src/physics/BodyMass.js:25-31` documents it explicitly, *with a measurement*, and already files it
   against step 9: *"Plain moons DO carry a generator-computed `massEarth` (MoonGenerator.js:266) that
   this rule ignores in favour of the r^2.5 estimate … 502 of 521 moon-bearing planets in FENCE-221
   would shift, worst wd-165/2 from 1.32 to 2.32 primary radii — and filed against B5 step 9."*
   ⭐ **What IS new and undocumented is the direction:** step 3 moves the barycentre through the moon's
   **radius** (because `moonMassEarth` reads `r^2.5`), *without anyone touching the rule*. That half of
   the risk stands and is worth the ranking. The novelty claim does not.

2. **"All 36 target `src/main.js`, from two citing sources" — the source count is wrong.**
   Measured: **8** citing sources, not 2 — `tools/port-uniform-delta.mjs` (16),
   `docs/FEATURES/one-pipeline-two-frontends-PLAN.md` (16), `src/objects/Planet.js` (2), and one each
   from `tests/port-route-agreement.test.js`, `tests/gas-body-lab-material.test.js`,
   `src/worldengine/port/conditionFromBody.js`, `src/worldengine/drivers/index.js`,
   `src/rendering/objects/BodyRenderer.js`. Two of those are in `src/`, which the "docs and tools only"
   reading would have skipped.

### ⭐ How S0-a was actually repaired — the method generalises, use it again

Repairing by "nearest line carrying the symbol" is a **heuristic**, and 12 of the 36 had multiple
candidate lines where it could pick wrong — exactly what the tool warns against (*"a ref repaired to a
second wrong line is worse than the stale one, because it now reads as freshly verified"*). The proof
used instead:

> for each stale ref `(file:N, symbol S)` — confirm line `N` carried `S` **at the last-good commit**,
> take that occurrence's **ORDINAL** in the old file, and map to the same ordinal at HEAD.

All 36 resolved with occurrence counts unchanged, so none is a guess. ⚠ **3 of the 36 are written in a
shorthand continuation form** (`:8822` rather than `main.js:8822`) and need their own pass — a naive
repair script misses them silently and the fence keeps failing with no visible cause.
