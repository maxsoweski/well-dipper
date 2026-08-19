# Handoff — the moon-formation lane. ⛔ **SUPERSEDED by [`moon-formation-handoff-2026-08-18-b5.md`](moon-formation-handoff-2026-08-18-b5.md)** — B5.0 has since landed.

> Kept because its §2 doc map, §5 techniques and §6 state are still current. ▶ NEXT is now **B5 steps 1–9**.

**Date:** 2026-08-18 · **Repo:** `~/projects/well-dipper`, branch `feature/world-engine-production-L1`
**HEAD:** `2f078b1` · tracked tree **CLEAN** · **all four instruments GREEN at `1def6da`, exit 0**
Supersedes [`moon-formation-handoff-2026-08-17.md`](moon-formation-handoff-2026-08-17.md), whose §2
next-actions (a) and (b) are now **done**. Its §3 and §4 are still worth reading.

> ⭐ **~700 untracked PNGs and `scratchpad/` are normal. ⛔ NEVER `git add -A`.**
> Three untracked `src/` files (`effects/WarpTunnel.js`, `rendering/sky/*.bak`, `WarpTunnelStarfieldLayer.js`)
> are **pre-existing and not this lane's** — leave them.

| instrument | reading at `1def6da` |
|---|---|
| A per-test-ID | 326 files · **5328** tests · **24 failed** — failing-ID set byte-identical to the 24 |
| B body-identity fence | **8/8** |
| C shipped-uniform delta | **526** bodies, ZERO delta |
| C citation fence | **423 CHECKED / 0 BROKEN** |

⚠ Instrument A's baseline still carries **dirty-tree provenance** (the ~700 PNGs guarantee it).
Inherited, documented in B4 §3d. Treat its pointer as soft.

---

## 1. ✅ THE B5 BLOCK IS CLEARED. `1ed1176` — read B4 §8 before anything else.

All three unblock conditions are done, in
[`moon-formation-b4-prediction-2026-08-17.md`](moon-formation-b4-prediction-2026-08-17.md) **§8**,
appended so nothing above line 374 moved (Rule 9 — the README cites that file at `:14`, `:39-49`,
`:130`, `:229`). All four instruments green after it. **Read §8 in full before writing B5;** the
three items below are only the headline.

1. ⛔ **The selector uses `namespacedFloat`, NOT `fnv1aString`** — the handoff offered both and they
   are not equivalent. Over `wd-0`…`wd-2999`, FNV-1a's within-system gaps collapse to **eight**
   distinct values across 9 578 adjacent-ordinal pairs (`P² mod 2³² = 0.148475·2³²`, derived and
   measured), so two companions in one system become **impossible**. Both hashes pass a χ²
   uniformity test — the failure is entirely in the joint structure. §8.1.
2. **Yield, at the declared `p = 0.0335` per solid planet** (§8.2's derivation, exact histogram
   inversion against Ochiai's 10% of systems): FENCE-221 **27** · MC-197 **22** · PCC-120 **17** ·
   LAB-PROCEDURAL-200 **16**. Exact coordinate lists at §8.4; re-issue at any other `p` with
   `node tools/binary-yield-probe.mjs --p=<new> --stamped`.
3. **The partition is `{systems 27, planets 521, plainMoons 770, planetClassMoons 51}`** on
   FENCE-221, and ⭐ **the `systems` arm is the attribution channel** — §3a wrote it off as always
   0, but `body-identity-fence.test.js:376` puts the moon COUNT inside the per-seed `system` object.
   Through B5 regime 1 that arm moves for binaries and for nothing else.

⛔ **§8.10 is the correction pass — read it with §8.5.** A 13-agent verification found §8.5's toll
incomplete in four files and wrong in one assertion: `ORPHANS` in `moon-rng-stream-identity.test.js`
does **not** stay green, it goes to `orphanPlanetClass: −20` and the invariant dies; the *binary-star*
barycentre test reds on two of its ten hand-written pins (`wd-10`, `wd-27`); `tools/moon-census.mjs:116`
carries a population pin and **exits 3**; and ⭐⭐ **the ruled `q ≥ 0.122` is unreachable with the
builder scoping §6.2 mandates** — `MoonGenerator.js:381` draws the radius fraction from `[0.10, 0.25]`
and `q = (ρ_c/ρ_p)·f³`, capping `q` near **0.031**. Reaching 0.122 needs `f ≈ 0.40–0.84`; the ranges do
not overlap. Widen the fraction on the companion path, do **not** force `massEarth` — that route
violates `moon-condition-contract.test.js:374-378`'s density band, this one does not.

⛔ **Three traps that will otherwise be found by going red** (§8.7): `ExoticOverlay` strips
`_systemSeed`/`_ordinal` on the planets it swaps, so a coordinate list re-derived from generator
output is short by exactly one row (`wd-1403/1`); the overlay can move a planet giant → solid but
never the reverse; and ⛔⛔ **`ExoticOverlay.js:389` creates a `massEarth: NaN` on any planet-class
moon of a swapped parent, taking the record 20 keys → 21** — the `{shapes: 2}` signature §3b names as
"a conditional append shipped." Fix that in the same commit as the channel.

**Threshold is RULED:** `q ≥ 0.122` (Pluto–Charon), distribution centred ~0.3–0.6.

---

## 2. THE DOCS ARE THE WORK. Read in this order; do not re-derive them.

| doc | what it is |
|---|---|
| [`moon-formation-channel-model-PLAN-2026-08-15.md`](moon-formation-channel-model-PLAN-2026-08-15.md) | ⭐ **PLAN OF RECORD.** §3 build sequence B0–B10; §6 all four owner questions answered |
| [`moon-formation-b4-prediction-2026-08-17.md`](moon-formation-b4-prediction-2026-08-17.md) | ⭐ **B4 — B5's revert target.** §0 explains its three tiers; §2 is MEASURED |
| [`binary-planets-scoping-2026-08-17.md`](binary-planets-scoping-2026-08-17.md) | ⭐ the binary ruling. §3a records being wrong twice; §5 the sequencing |
| [`../SYSTEMS/generation/README.md`](../SYSTEMS/generation/README.md) | ⭐⭐ **NEW — the generation layer's deep dive.** Draw-stream rules, instruments, corpora, dated-doc index. **Read §3 before touching any `rng.` call.** |
| [`moon-census-baseline-2026-08-15.md`](moon-census-baseline-2026-08-15.md) | the measured baseline. ⛔ its "SECOND FINDING" is **WITHDRAWN** — see B4 §4a |
| [`world-engine-reconciliations-2026-08-15.md`](world-engine-reconciliations-2026-08-15.md) | the bug family; §3.0 owner rulings |
| [`moon-goes-black-on-approach-2026-08-15.md`](moon-goes-black-on-approach-2026-08-15.md) | ⛔ a **WITHDRAWN** defect. Read §0 before re-investigating a black body |

---

## 3. ⭐ THE THREE FINDINGS THAT CHANGE WHAT B5 DOES

1. **B4's step-2 partition is MEASURED, not predicted** (treated worktree, reverted):
   `{systems 0, planets 502, plainMoons 770, planetClassMoons 24}`.
   ⭐ **The 502 planets are predicted nowhere in the plan or the old handoff.**
   `systemContext.moons` (`StarSystemGenerator.js:947-952`) carries `{type, radiusEarth,
   orbitRadiusEarth, tidalHeating}` — **not composition** — into the PARENT's hash. So the
   `compSeed` re-key moves 0 planets while the `moonecc:` re-key moves 502; the two probes are
   each other's control. 502 = every moon-bearing planet, derived independently from the census's
   per-type `P(zero moons)` table. ⛔ **The planet arm saturates on the first sub-step and carries
   no information for steps 3–9.** Do not read "the partition matched B4" as "B5 worked."
2. **The census's "SECOND FINDING" is WITHDRAWN.** Elser 2011's "terrestrial planet" is the
   astrophysical rocky class (1-in-12 / 1-in-45 / 1-in-4 = the plan's 8.3% / 2.2% / 25%); this
   generator's `terrestrial` is a **game type string** meaning life-bearing, tuned to ~3% of
   systems (`PlanetGenerator.js:30,:947,:955`). Correct denominator is the measured **3.1357 solid
   planets/system**. ⚠ **23.79% is the concave approximation; the exact figure is 23.06%** (B4 §8.2).
   Still inside the plan's 6.67–25% bracket, so the conclusion stands: **no `_pickType` defect.**
3. **B8's two acceptance assertions are barely co-satisfiable — and ⚠ the tension is at the FLOOR,
   not the ceiling.** Recomputed exactly in B4 §8.2 (the `[6.74%, 59.43%]` and `8.766%` figures here
   come from the mean-then-exponentiate form, which overstates): the co-satisfiable per-planet band
   is **`[2.2071%, 9.1005%]`**. Elser's 8.3% clears the ceiling by **0.8005 pp**, not 0.466 — but the
   clamp floor 2.2% maps to **6.6791%**, which is **below** B8's 6.7% per-system floor. Decide
   deliberately; do not discover it by going red.

---

## 4. ⛔ WHAT I GOT WRONG THIS SESSION — every one shipped into a doc or a commit before being caught

1. ⭐⭐ **I broke two citations and Instrument A, and did not notice for three commits.** The nav
   fix added ~30 lines to `NavComputer.js`, shifting every line below it. The lane's own rule is
   *line-count-neutral src edits, then confirm citations by the counters* — I ran the fence and the
   UI suite but not `check:instruments`. **Run the full battery after ANY `src/` edit, not the
   subset you think is affected.**
2. ⭐ **I "corrected" a claim into a worse one.** The scoping doc said the NAV screen draws moons at
   a cosmetic radius. I read `Math.sqrt(moon.orbitRadiusEarth)` and the comment above it — *"use
   actual orbit data"* — and declared the radius real. The cancellation was **two lines below**.
   **A comment stating what code intends is not evidence of what it computes.** Recorded in the
   scoping doc §3a, which now carries all three drafts.
3. **I claimed planet dots move on the NAV screen. They do not.** `_systemData` is the generator's
   output; the scene copies `orbitAngle` by value (`main.js:7719`) and nothing writes back. Nothing
   on that screen moves, planets or moons.
4. **I recommended `keplerOrbitSpeed` for the pair while knowing it lacks a √(M₁+M₂) term.** The
   workflow supplied the argument I lacked (circumbinary planets share the omission, so the period
   *ratio* is currently exactly right). Right answer, but I had not earned it.
5. **I scoped the mass-ratio fix as a bare `Math.pow(radiusSolar, 1.25)` ratio**, which would have
   **inverted the pair at two real, visitable catalog stars.** The adversarial phase caught it.

---

## 5. ⭐ TECHNIQUES THAT EARNED THEIR KEEP — reuse these

- **Verify by intervention, not by passing.** Every test written this session was proven by
  reverting the fix and confirming the *specific* assertions go red. Twice this showed which
  assertions were load-bearing and which held under both arms.
- **Two probes as each other's control.** `compSeed` moved 0 planets while `moonecc:` moved 502
  through the identical reader — that is what makes 502 real rather than a reader artefact.
- **Measure in a detached worktree**, never the live tree — a dev server has been serving
  `~/projects/well-dipper` on `:5173` for days and any `src/` edit fires HMR into it.
- **Give the corpus with every number, or refuse the number.**
- **Line-count-neutral src edits**, then confirm citations **by the counters**. (See §4.1 for the
  cost of forgetting.)
- **Write the commit message to a file and `git commit -F`.**
- **Pin `model: 'opus'` on every workflow agent**, and tell them read-only, no chrome-devtools, no
  dev server, and that an honest "not found" beats a plausible invention.
- ⭐ **Let the adversarial phase overrule the design phase.** Both this session's workflows produced
  a better answer than their own first proposal, and in one case overruled a refuter by citing the
  repo's own written policy back at it.
- **Derive the same number two independent ways.** 502 from the fence and from the census table;
  the barycentre from drawn positions and from the orbit rings.

---

## 6. STATE YOU NEED

- **Live game IS running** at `http://localhost:5173/well-dipper/` (vite PID 2006011, up 4+ days).
  ⭐ **Debug Chrome is attached on port 9223**, parked on `wd-272` planet 0. Launch pattern if it
  dies: `~/.claude/projects/-home-ax/memory/chrome-devtools-9223-launch.md`.
- ⛔ **`_lab.resolveBody({kind:'star', starIndex:1})` silently ignores `starIndex`** and returns the
  primary. It briefly looked like both stars were at the same position. Find star meshes in the
  scene by name instead: `effect.starflare.<seed>` / `effect.starflare2.<seed>`.
- `_lab.setCameraPose` requires **both** `position` and `quaternion` plus a `controller` block, and
  returns `{ok:false}` otherwise. `_lab.frameBody(subject, {radii:N})` is easier.
- `window.THREE` is **not** exposed. Borrow a constructor off a scene object instead.
- ⛔ `_lab.bodySurfaces()` is ~500 KB. **Filter inside `evaluate_script`, always.**
- ⛔ **Sol cannot validate procgen.** Use `_lab.spawnProceduralSystem(seed)`.
- Master worktree is `~/projects/well-dipper-trunk`; `~/projects/well-dipper` is **lane A's branch.**
- **A probe worktree exists at `~/wd-b4-probe`** (detached at `a76f9e7`, `node_modules` symlinked).
  It is how B5 gets measured without touching the live tree. Remove with
  `git worktree remove ~/wd-b4-probe` when the lane ends.
- **Corpora are different things** — see `../SYSTEMS/generation/README.md` §5. FENCE-221 ≠ BULK-221.

---

## 7. OPEN FOR MAX

1. **Binary companion naming.** A companion delivered through `moons[]` is named "X b I"
   (`NameGenerator.js:601-607`) and loses click ties to its primary. Peer designation (X b1 / X b2)
   in the first increment, or roman numeral until it earns its own identity? *Rec: roman numeral.*
2. **Circular + coplanar pairs.** Every capture mechanism in the literature produces eccentric,
   inclined pairs; this engine renders circular coplanar orbits by explicit product cap
   (`StarSystemGenerator.js:616`). Does a perfectly flat pair read as artificial in flight?
3. ⭐ **NEW 2026-08-18 — `p = 0.0335`, the binary rate, is an AUTHORED constant.** It puts a pair in
   ~10% of systems (27 across FENCE-221's 221), derived by inverting Ochiai et al. 2014's ~10% of
   systems-undergoing-crossing. ⚠ **That anchor is soft in two ways** and B4 §8.2 says so out loud:
   Ochiai counts crossing *events* (the opportunity), not surviving pairs, and both it and Lazzoni
   are **gas-giant-only** while this channel is solid-parent. B8 resets it by measurement.
   *Rec: ship at 0.0335 and let B8 move it — the coordinate list is one command to re-issue.*
4. ⭐ **NEW — most binary pairs will be binary DWARF planets, and that is a taste call, not a bug.**
   9 of FENCE-221's 27 hosts are below 0.1 M⊕; the smallest, `wd-36/2`, is **0.0131 M⊕ / 0.319 R⊕**,
   so at the ruled `q` its companion is a ~1 400 km body. Pluto is 0.0022 M⊕, so this is exactly the
   Pluto–Charon case you anchored on — but it is what the channel will *mostly* produce.
   **No mass floor is applied.** Adding one is a one-line eligibility change plus a probe re-run.
   *Rec: no floor; judge it at UAT in the live game rather than on paper.*
5. **Standing forward-notes** (direction of travel, not scope): the irregular swarm eventually
   renderable and flyable; binary planets eventually rendered with a true barycentre.

⭐ **ALREADY RULED — do not re-ask:** the mass-ratio threshold (`q ≥ 0.122`); binaries fold into the
B5 window via `moons[]`; **binary pairs stay physically correct and therefore visually static at
1×** (recorded in `../SYSTEMS/generation/README.md` §7 item 2 — a future reader must not "fix"
motionless suns back to the map-unit number). Max UAT-passed binary geometry and lighting
2026-08-18 on `wd-272` / `wd-197` / `wd-10`.

---

## Suggested skills

- **Workflow tool** — the lane's whole method. Both workflows this session beat their own first
  proposal. ⭐ Give agents the evidence log AND the rule that an honest "not found" beats a
  plausible invention; that instruction is what produced the best results.
- **`superpowers:verification-before-completion`** — §4 is five entries long, and §4.1 cost three
  commits of silent red.
- **`superpowers:systematic-debugging`** — §4.2 was a confounded read, not a shallow bug.
- **`superpowers:test-driven-development`** — every test here was proven by reverting the fix first.
- **`handoff`** at the next seam — ⛔ **into `docs/FEATURES/`, not `/tmp`.**

⛔ Do **not** invoke `library-context` reflexively; the SessionStart hook nags about a three.js brief
for an unrelated project (`gesar-app-skin`). This repo is on three.js **0.183.1**.
