# Handoff — the moon-formation lane. ▶ NEXT = **B5 steps 1–9**. B5.0 (binaries) is DONE and UAT-parked.

**Date:** 2026-08-18 · **Repo:** `~/projects/well-dipper`, branch `feature/world-engine-production-L1`
**HEAD:** `34b502d` · tracked tree **CLEAN**
Supersedes [`moon-formation-handoff-2026-08-18.md`](moon-formation-handoff-2026-08-18.md), whose §1
next-action is done. **Its §2 doc map, §5 techniques and §6 state are still current — read them.**

> ⭐ **~700 untracked PNGs and `scratchpad/` are normal. ⛔ NEVER `git add -A`.**

## ⛔ INSTRUMENTS ARE RED BY DESIGN. The window is open.

| instrument | reading at `34b502d` | why |
|---|---|---|
| A per-test-ID | not re-recorded | ⚠ do not re-record mid-window |
| B — DRAW STREAM | ✗ **28 seeds, every one `+2`** | two grandfathered sub-rngs fire per companion |
| B — BODY IDENTITY | ✗ | the population moved |
| B — RECORD SHAPE | ✗ `planetClass.records 24 → 51` only | shapes `1`, keyCounts `[20]` **unmoved** |
| B — NEGATIVE CONTROL | ✓ **green** | scoped to `wd-0` (`:824`), which has no companion |
| C — shipped-uniform | ✗ exit 2, `bodies in capture : 526 now: 633` | POPULATION MISMATCH, the trigger §3c named |
| C — citation fence | ✓ **423 CHECKED / 0 BROKEN** | three refs repaired by symbol this session |

**B7 closes the window and re-blesses. Nothing before it should.**

---

## 1. WHAT LANDED, IN ORDER

| commit | what |
|---|---|
| `1ed1176` | **B4 §8** — the binary line item: selector, `p`, per-corpus yield, the 27-row coordinate list, the revised partition, Instrument C's 526→633, three traps. Plus `tools/binary-yield-probe.mjs`. |
| `5ddebe0` | handoff update; two of the old §3's numbers came from the concave approximation |
| `c52d397` | **B4 §8.10** — the verification pass: what §8 missed (four files, one wrong assertion, and an unreachable `q`) |
| `34b502d` | **B5.0** — the binary companion channel, plus the two required fixes |

⭐ **B5.0 landed ALONE, before steps 1–9, deliberately.** §8.5's Route-M-alone partition is this
window's only exact separable prediction and step 2 saturates the arms. It was checked and it held:
population `{961, 821, 770, 51}` identical, **51/51 coordinates in byte-identical order**, shape held
at 20 keys, Instrument C at exactly the predicted 633.

---

## 2. ⭐ THE THREE THINGS B5 STEPS 1–9 MUST NOT UNLEARN

1. **The companion is built from `hashRng`, never the generation stream** (`MoonGenerator.js`, end of
   file). Not tidiness: a stream-built companion is a function of the moon loop's draw *position*, so
   steps 2, 3 and 6 would move every companion and §8.4 — the window's only exact prediction — would
   stop being checkable after the second sub-step. **Hash-built, the pair survives the whole window
   unmoved.** ⛔ Step 4 merges `_generatePlanetMoon` into the shared tail; the merge must carry the
   `hashRng` companion path and the `targetQ` parameter with it.
2. **DRAW STREAM's red set is companions *built*; §8.4's list is companions *shipped*.** 28 vs 27.
   The extra is `wd-170`, whose ordinal 4 passes the gate before migration destroys 4 of its planets.
   ⛔ **Do not "fix" the 28 back to 27.**
3. **`q = (ρ_c/ρ_p)·f³`**, so the builder's shipped `rng.range(0.10, 0.25)` caps `q` near 0.031 —
   4× below the ruled floor. The companion path passes `targetQ` and inverts it. §8.10 item 6.

---

## 3. ⛔ THE LITERALS LEFT DELIBERATELY RED. Every one is a hand-derivation.

| file:line | today → after B5.0 | mechanism |
|---|---|---|
| `body-identity-fence.test.js:288-293` | 24 → **51** strings, §8.4 has the list in walk order | `:477` |
| `:687` | `{961, 794, 770, 24}` → `{961, 821, 770, 51}` | `plain` is derived at `:683`, so it cancels |
| `:697` `onDisk` | `{961, 794}` → `{961, 821}` — **only after the re-bless** | sums the on-disk JSON |
| `:740-742` partition | → `{systems 27, planets 27, plainMoons 0, planetClassMoons 27}` | ⛔ classifier is `:733`, **by the `:288` literal**, so `:288` and `:740` must land together |
| `:779` | `records: 24 → 51` | shapes/keyCounts hold |
| `moon-condition-contract.test.js:162`/`:163`/`:370` | 23→**45**, 728→**750**, 23→**45** | `:161` and `:166` unchanged |
| `tools/moon-census.mjs:116` | `planetClass: 24 → 51` | ⛔ **exits 3**, "Do NOT adjust the expected numbers to match" |
| `StarSystemGenerator.binary-barycentre.test.js:163-174` | rows `wd-10` and `wd-27`, `moons 5 → 6` | ⛔ no re-bless; its own comment misdiagnoses this red |
| `moon-rng-stream-identity.test.js:349-356` **ORPHANS** | `orphanPlanetClass 2 → −20` | ⛔⛔ **not a re-number** — see below |
| `ProcgenSnapshot.test.js:81` | one sample, subject to the `:63` `active` filter | re-bless exists |

⛔⛔ **ORPHANS needs a mechanism change, not a constant.** `calls` comes off a wrapper on
`MoonGenerator.generate` (`:326`); `survivors` walks the finished system (`:339-341`). The companion
is a survivor that was never a call, so the *containment* `calls ⊇ survivors` breaks. Re-deriving the
three literals to green would **delete the invariant**. Count appended companions as their own term,
or say out loud that B5 did not. §8.10 item 1.

---

## 4. ⭐ NEW FINDING — sub-neptune, measured because Max noticed it

**It is 20.9% of all planets — joint-most-common with `rocky` (201 each of 961, FENCE-221.)**
`_pickType` gives it a band in four of the five orbital zones and only the scorching zone excludes
it: inner `roll 0.50–0.65` (15%), HZ `→0.48` (~21% after the terrestrial/ocean/eyeball draws),
**transition `roll < 0.30` (30%, its largest)**, outer `gasProb→0.68`.

**On planets the class is well-formed and defensible.** 201 bodies, radius **2.50 – 3.99 R⊕** —
exactly its `RADIUS_RANGES_EARTH` band — and mass 12.8–28.4 M⊕, which is genuinely giant-side and
justifies its place in `GIANT_PARENT_TYPES` (`MoonGenerator.js:29`). Real demographics agree that
sub-Neptunes are the commonest class.

⛔ **Two things are wrong, and neither is the rate:**

1. **The label survives a 6× shrink.** `PLANET_MOON_TYPES_BY_ZONE` includes `sub-neptune`, then
   `_generatePlanetMoon` overrides `radiusEarth` to a fraction of the parent — and the type string
   rides along. Measured over FENCE-221's 51 planet-class moons: **4 carry a giant type string**, at
   16,818 / 5,911 / 4,951 / **2,588 km**. That last is **0.41 R⊕ — six times below its own class's
   radius floor**, labelled `sub-neptune`. `wd-10`'s companion is one of these.
2. **Two subsystems disagree about the string.** `MoonGenerator.js:29` calls sub-neptune a GIANT;
   `ExoticOverlay.js:176` puts it in `_applyFungal`'s **`isRocky`** list. Same type, two
   classifications, and the second is a live giant→solid boundary crossing (§8.7 trap 2).

**Consequence for this lane:** 20.9% of planets are excluded from binary eligibility purely on the
strength of a type string, which is exactly what the plan's own rule (*"read from mass and
composition, never the type string"*, PLAN:37) exists to prevent. ⚠ **Not fixed. Scoped, not filed** —
it wants its own increment, and it overlaps B5 step 9's mass-ratio work.

---

## 5. STATE YOU NEED

- **Max is PARKED** in the live game at `http://localhost:5173/well-dipper/` on `wd-10`, planet 3
  (`Meameinath` + `Meameinath I`), camera sunward at 1.75 units, pitch 0.28, both bodies lit.
- ⛔ **A body reading BLACK is almost certainly PHASE, not a defect.** Re-observed twice this session
  and both times it was the camera on the night side. `moon-goes-black-on-approach-2026-08-15.md` is
  **WITHDRAWN** — read its §0 before re-investigating. To fix it, put the camera sunward: read
  `_lab.cameraPose()`, take `controller.target`, find `effect.starflare.<seed>` in the scene, and set
  `yaw = atan2(starX − targetX, starZ − targetZ)`. Convention, verified this session:
  `position = target + d·(cos(pitch)·sin(yaw), sin(pitch), cos(pitch)·cos(yaw))`.
- ⛔ **`_lab.resolveBody` ignores `planetIndex`/`starIndex`. The working keys are `p` and `m`** —
  `resolveBody({kind:'planet', p:3})`, `resolveBody({kind:'moon', p:3, m:0})`. Undocumented until now.
- `_lab.frameBody(subject, {radii:N})` works but gives no control of azimuth, so it lands night-side
  as often as not. Use `setCameraPose` when the shot matters.
- Probe worktrees: `~/wd-b5-probe` (detached at `65d3bb5`, carries the two observation stamps) and
  `~/wd-b4-probe` (at `a76f9e7`). **Remove both when the lane ends.** The committed
  `tools/binary-yield-probe.mjs` supersedes their scripts and refuses to lie without `--stamped`.
- ⛔ **Sol cannot validate procgen.** `_lab.spawnProceduralSystem(seed)`.

---

## 6. ⛔ WHAT I GOT WRONG THIS SESSION

1. ⭐⭐ **I shipped §8.5 asserting all four stream literals stay green. ORPHANS does not, and it goes
   negative.** Caught by the verification pass, not by me, three commits after it shipped. The
   scoping doc had said "not routed through `MoonGenerator.generate` leaves the stream literals
   green" — true of three, and I generalised it to the fourth without opening the file.
2. **I imported a subagent's misreading of §4b into §8.2** — it read "clears the ceiling by 0.466 pp"
   as *exceeds* rather than *passes with headroom*. Caught before commit, but only because a refuter
   checked the sentence I had already accepted. **A trace's arithmetic being right does not make its
   reading of a document right.**
3. **My first §8 named four files and missed four more** (barycentre pins, `moon-census`'s exit-3
   pin, three `moon-condition-contract` literals, `ProcgenSnapshot`). The toll list I trusted was a
   floor and I presented it as a total.
4. **I cited `moon-census.mjs:346` for a symbol on `:345`.** Caught by re-reading before commit. The
   lane's rule is that a ref repaired to a second wrong line is worse than a stale one.

---

## 7. ⭐ TECHNIQUES THAT EARNED THEIR KEEP

- **Predict the integer, not the rate.** §8.4's 27 coordinates made B5.0 checkable in one command.
  A predicted *rate* would have been satisfied by a wrong implementation.
- **Land the separable thing first.** B5.0 alone is the only point in the window where the binary
  contribution is visible in `planets` and `planetClassMoons`. After step 2 only `systems` stays clean.
- **Verify by intervention.** The `massEarth: NaN` trap was proved by running the overlay's own
  arithmetic on a real record and watching 20 keys become 21 — not by reading the code.
- **Derive the same number two ways.** `q/f³ = 1.2093` against a measured density ratio of 1.2090.
- **Let the adversarial phase overrule the design phase**, and then check the refuter too: the
  refutation that killed my §4b claim was right; three others in the same batch were not.
- **Commit the probe, don't archive it.** The scoping doc's `scratchpad/probe-binary-criteria.mjs`
  was gone within a day.

---

## 8. OPEN FOR MAX

1. **UAT: does `Meameinath` + `Meameinath I` read as a binary planet, or as a planet with a big
   moon?** You are parked on it. `q = 0.283` there, so the companion is ~2/3 the primary's radius —
   toward the *low* end of the ruled band. Fly to `wd-34/0`, `wd-91/2` or `gc-22/1` for others.
   **This gate is yours alone.**
2. **Naming — still unruled** (carried from the previous handoff §7 item 1). The companion ships as
   `Meameinath I`, the roman numeral you leaned toward. It reads as a moon designation. Peer
   designation (`Meameinath b1` / `b2`) is the alternative. *Rec: leave it until UAT says the pair
   reads as a pair; if it does, the name is the next thing that will feel wrong.*
3. **The sub-neptune finding (§4) wants its own increment.** *Rec: fold the label-survives-shrink
   half into B5 step 9 (it is already the mass-ratio commit) and file the
   `GIANT_PARENT_TYPES`-vs-`isRocky` disagreement separately.*
4. **B5 steps 1–9 in a fresh session**, per your call. Start with step 1 (channel selector at
   `MoonGenerator.js:122-127`) — and ⛔ read §2 above before touching step 4's merge.
