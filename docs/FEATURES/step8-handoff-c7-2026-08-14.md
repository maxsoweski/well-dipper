# Handoff — Well Dipper. B7 is CLOSED and UAT-PASSED. **NEXT = C7 (Step 8b).**

**Date:** 2026-08-14 (later session) · **Repo:** `~/projects/well-dipper`, branch `feature/world-engine-production-L1`
**HEAD:** `2ac8ea7` · **tracked tree CLEAN · PUSHED** (`git ls-remote` verified `4677954`; `2ac8ea7` is one commit past it — **push it first thing**)
**All four instruments GREEN.** Instrument A 324 files / 5312 tests / **24 failed** (was 26). Instrument B 8/8.
Instrument C 0 uniforms moved. Citations **401 CHECKED / 447 UNCHECKED / 0 UNRESOLVED**, exit 0.
(~700 untracked PNGs + `scratchpad/` are normal. ⛔ **Never `git add -A`.**)

> ⭐ **IN THE REPO ON PURPOSE.** Predecessor: [`step8-handoff-2026-08-14.md`](step8-handoff-2026-08-14.md)
> — **its §3, §4, §5 and §6 ALL STILL APPLY and are not repeated here.** Read it second.

---

## ⛔ MAX'S PRIORITY, IN HIS OWN WORDS — unchanged, read before choosing anything

> *"What I care about is being able to use the systems that we created for world engine in the main
> well-dipper game. I want to make this as optimized and well-architected as possible."*

Decide what an agent can decide; state the criteria; move. ⭐ **But anything that changes what he
SEES is his call** — and see §4, because I got the *shape* of that right and the *scope* wrong.

---

## 1. WHAT CLOSED — B7, in seven commits. Do not re-derive it.

`tests/moon-condition-contract.test.js` is **15/15** (13/2 at `235adef`). Both of C6's
red-by-design gates pass and **neither was weakened by a character**.

| commit | |
|---|---|
| `10d4d1a` | src — a moon's mass follows its radius through a swap (3 moons) |
| `490db3e` | Instrument B re-bless |
| `2154de1` | src — a retyped planet keeps its own zones AND its own generation orbit (10 planets) |
| `ed8d069` | gate — 19 port-contract populations re-derived; 2 emptied pins flipped |
| `f61d092` | Instrument B re-bless + the `wd-45` pin comment |
| `952c5d0` | Instrument C re-record |
| `dc0779c` | Instrument A re-record |
| `4677954` | docs — QB-1 re-report |
| `2ac8ea7` | docs — composition-weighted τ filed |

**THREE root causes, not the two the plan named.** RC1 = un-rescaled `massEarth`. RC2 = `zones: null`,
so every swapped planet was derived as if it orbited the Sun. ⭐ **RC3 — the one C6 measured but
could not name a fix for** — `_swapPlanetType` regenerated at the wrapper's **post-migration** AU
while every other body uses its **generation-time** AU. RC2 alone reproduces C6's "3 → 1" exactly;
RC2+RC3 gives 0.

**Every commit message carries its own evidence. Read the one you are building on.**

### ✅ MAX'S UAT — PASSED 2026-08-14, on the live game, his words
Parked on `wd-45/0` (hex), `wd-79/2` (crystal), `wd-614/1` (city-lights).
- wd-79: *"i think so, yes, though crystal world rendering has not been figured out yet so the
  actual planet is still very rough"* → **B7 accepted; roughness is QB-11.**
- wd-614: *"yep, that's right."* → **B7 accepted.**
- wd-45: he re-reported **QB-1** (see §3). **B7's change accepted; the effect is pre-existing.**

---

> ## ✅ C7 IS SHIPPED — 2026-08-15. §2 below is HISTORY; its `1.0` quote is no longer the code.
>
> `4cee76a` made the change, `9ebb24b` carries the delta table it was predicted from, `ab173a3`
> re-derived the draw-stream gate, `6fe87a5`/`a07b522` blessed Instruments B and C. Instrument A
> needed NO re-record — the ID set returned to the baseline's 24. **Every predicted number held.**
> ▶ What is still open is MAX'S EYES on the 24 moons, and the open items in NOW.md.

## 2. ▶ NEXT — C7 = Step 8b. START HERE.

`MoonGenerator.js:378` generates every planet-class moon at `PlanetGenerator.generate(rng, 1.0, …)`
— a hardcoded 1 AU. ⚠ **Verify the line number before citing it; it has moved twice already.**

⛔ **8b is a UNIVERSE change, not a value change** (build plan break B6 — the plan says otherwise in
a sentence labelled *"Correction to the recon, in the plan's favour"*, and its `radiusEarth 0/400`
control measured the wrong object). It moves `radiusEarth`, `orbitRadiusEarth`, `orbitSpeed`,
`inclination` and `startAngle` on ~22% of planet-class moons — **bodies that render today**.

**The delta table must carry the GEOMETRY columns**, not just the six the plan declares. Bless three
instruments in three separate commits so the table stays falsifiable.

### ⚠ What B7 teaches you about C7's blast radius, measured
B7 was scoped as "values only" and moved **10 planets' surface colours plus one atmosphere**. C7 is
declared a universe change from the start, so expect **more**, and expect it to reach:
- **`port-condition-contract.test.js`** — 19 pinned populations moved for B7's *six* bodies. C7
  touches planet-class moons; check whether that corpus contains any before predicting.
- **Instrument B's `classes` set** — B7 *lost* a class (§3). A geometry change can add or drop one.
- **Instrument C** — B7 excluded 1 body as a STRUCTURAL BREAK. Geometry moves `planetRadius`, which
  IS a watched uniform, so C7 should actually move uniforms where B7 did not.

⭐ **Max's steer on timing, 2026-08-14, unprompted:** exotic-surface rendering is rough *across the
board* — QB-1 (terminator), QB-11 (crystal), QB-12 (exotics). I recommended holding C7 until the
lighting/rendering work lands; **he chose to continue with C7 anyway.** Do not re-litigate it.

---

## 3. ⭐ WHAT MAX SAID THIS SESSION THAT IS NOT IN ANY OTHER ARTIFACT

1. ⭐⭐ **QB-1 RE-REPORTED, UNPROMPTED, ON THE LIVE GAME** — *"it looks like a huge orange stripe, not
   a subtle effect right at the edge of twilight shadow in the atmosphere"* · *"that effect needs a
   ton of work. It has for a long time"* · *"We don't need to do that now."* Same complaint as
   2026-06-15, **after** the 6.7× taming. Recorded on the QB-1 row at `4677954`.
   ⚠ **CONFIRM THE MECHANISM BEFORE FILING A LOOK COMPLAINT.** The orange is
   `uTermColor * uTermStrength * exp(-tt*tt)` (`Planet.js:543-552`, `TERM_STRENGTH = 0.15` at
   `:1420`) — **NOT the atmosphere**, whose colour on a hex world is teal (`'hex': [0.1, 0.6, 0.7]`,
   `PlanetGenerator.js:442`) and is the halo in the same frame. His words named the atmosphere;
   the code says terminator. Filing it as written would have sent the next author to the wrong file.
2. ⛔ **THE BAND IS GATED ON HAVING AN ATMOSPHERE, and B7 removed the last exception.** `wd-45/0`
   was the ONLY airless planet in 6279 and showed no band at all until `2154de1`. B7 did not cause
   QB-1 — it moved a body INTO the population that exhibits it. Since no planet is airless any
   more, `atmoPhysics.retained === false` is **unreached for planets** and the airless gate never
   fires. Open item; wants a physics review or a deliberate gate.
3. ⭐ **"why am I looking at all these again?"** — the challenge, and it was fair. Answer, from the
   code: `src/objects/Planet.js` is **not** the old engine in isolation — it imports
   `conditionFromBody` (`:1594`), `atmosphereOpticsOf`, `icenessOf`, `biosphereOf`,
   `craterUniformsFrom`, and `landPalette`/`iceness`/`lavaGlowColor` are baked from
   `surfacePaletteOf(condition)` at `PlanetGenerator.js:801-828`. It is the game renderer with a
   large slice of the world engine already wired through it. **And a generation fix is upstream of
   every frontend** — the lab renders authored presets, not generated systems, so the game is the
   ONLY place a generation change is visible.
4. **Composition-weighted greenhouse τ — FILED at `2ac8ea7`, NOT scoped.** `world-engine-INDEX.md`
   §7 item 5 + an in-file note at the fit. `τ = 0.84·P^1.124` is **pressure-only**; 2 bar of CO₂ and
   2 bar of N₂-O₂ get an identical lift. Any fix must still reproduce the five anchors/validators
   (Earth, Venus, Mars +0.1%, Titan +3.7%, Moon 0%, Europa 0%).

---

## 4. ⛔ WHAT I GOT WRONG THIS SESSION — read this before the next UAT

1. ⭐⭐ **A WRONG INSTRUMENTATION POINT IS THE CONFIDENT ZERO IN A NEW COSTUME.** I predicted, in
   writing, "draw count unchanged on 197/197 seeds" — from a counter patching
   `SeededRandom.prototype.float`. **`range`, `chance`, `int`, `pick` and `gaussian` call
   `this.rng()` DIRECTLY** (`SeededRandom.js:25,30,35,40,53`) and never route through `float()`. The
   fence was right; I was wrong. **Correct counter: patch `float`/`range`/`chance`/`gaussian` at cost
   1/1/1/2** — `int` and `pick` delegate to `range` and would double-count. The predecessor's §3.1
   is about a wrong *property path*; this is the same failure one layer out.
2. ⭐ **I SCOPED THE UAT TOO WIDE AND MANUFACTURED NOISE.** I needed one judgement — "are the
   corrected temperatures plausible" — and instead parked Max in front of three whole planets whose
   rendering he had already filed complaints about. Two of three answers came back "yes, but the
   rendering is rough." **Ask for the quantity that changed, not for a review of the body.**
3. **I called 255 K "temperate".** It is an *equilibrium* temperature, not a surface temperature —
   Earth's is 255 K too. `wd-614/1`'s actual surface is **319.20 K = 115 °F**. Quote
   `surfaceTemperatureOf`, never raw `T_eq`, when talking to Max about how a world feels.
4. **I tried a live before/after by reverting src under a running Vite** and could not hold camera
   pose or orbital phase constant, so the comparison was not defensible. I threw it out rather than
   show it. `freezeFrame({clock:0,spin:0,orbit:0})` **moves the body out of a frame you already set**
   — frame after freezing, or do not use it.

---

## 5. ⭐ THE TECHNIQUE THAT SAVED THE MOST TIME — reuse it in C7

**⭐⭐ LINE-COUNT-NEUTRAL SRC EDITS.** An 8-line insertion into `StarSystemGenerator.js` broke **25
live refs across 12 files**, and the citation fence could see exactly **ONE** of them — the rest are
symbol-less and rot invisibly in the UNCHECKED pile. It was thrown away and rewritten as **3 changed
lines, 0 inserted** (PLAN §11.8's technique, applied to src). Verified afterwards that all nine
cited lines still carried what they carried before.
**C7 edits `MoonGenerator.js`, which the predecessor's §3.4 already flags as a citation minefield.
Do this by default there.**

Also carried forward, all still true: **predict in writing before touching src** (it caught RC3);
**mutate the PASSING gates**; **refuse any number without its corpus**; **pin `model: 'opus'`**;
**write commit messages to a file and `git commit -F`** (the hook blocks heredocs and the word `vite`).

⭐ **AND: GREP THE GATES FOR A DESCRIPTION OF YOUR BUG BEFORE ASSUMING NOBODY HAS SEEN IT.**
`port-condition-contract.test.js` had already diagnosed B7 in prose — *"all six are exotics (5
`crystal`, 1 `shattered`) whose `metallicity` is PlanetGenerator.js:376's `|| 0` arm firing on an
ABSENT `zones`"* — and pinned it as a count of 6. Two of its pins were **empty** after the fix and
are now kept, flipped, as gates that the fabrication has not returned.

---

## 6. STILL OPEN ON 8a — filed, measured, NOT done

1. The rescale loop still leaves `tidalHeating`, `tidalState`, `surfaceHistory` on **pre-rescale
   geometry and the OLD parent type** (`GIANT_PARENT_TYPES` membership can flip in a swap).
   **Nothing gates it — it needs a gate before it needs a fix.**
   ⚠ C6's note lists `T_eq` in that stale set; that is **wrong** — no moon geometry enters `T_eq`.
2. `atmoPhysics.retained === false` unreached for planets across 6279 (§3.2).
3. `src/generation/ExoticOverlay.js` is still outside `CITE_SOURCES`, so the two refs `10d4d1a`
   added inside it are hand-verified but **ungated**. Adding it shifts three refs into
   `port-uniform-delta.mjs` (`:1090`, `:1565`, `:1628`) — one commit, adds AND gates, per §11.2.
4. Migrated/snapped planets still carry physics for an orbit they no longer occupy. RC3 made the
   swap **consistent** with that convention; it did not fix it.
5. Composition-weighted τ (§3.4).

---

## 7. STATE YOU NEED

- **Live game:** it was running this session at `http://localhost:5173/well-dipper/` with
  chrome-devtools attached, and **Max drives it — he asked not to be given console commands.**
  *"you bring me where you want me to be."* Park him with `_lab.spawnProceduralSystem(seed)` then
  `_lab.frameBody({kind:'planet', p:N}, {radii:3.2})` **yourself**, then tell him to look.
  ⭐ `spawnProceduralSystem` calls `StarSystemGenerator.generate(seed)` with **no galaxy context**,
  so it reproduces the fence/contract corpus exactly. Healthy rAF is ~240.
- ⚠ `_lab.bodySurfaces()` returns ~500 KB and will blow the tool-result limit. `_lab.systemInfo()`
  is a summary only — **record-level verification belongs headless.**
- **Corpora, and they are three different things:** fence/Instrument B = 221 seeds; the moon
  contract = 197 seeds (705 plain moons); `port-condition-contract` = 120 `pcc-*` seeds / 526
  bodies. ⛔ **Never quote a threshold from one against another.**
- ⛔ **Sol cannot validate procgen.** Master worktree is `~/projects/well-dipper-trunk`;
  `~/projects/well-dipper` is **lane A's branch, NOT master**.
- **Scratch in `$TMPDIR`**, not `<repo>/scratchpad` — but a probe that imports a repo module must
  live at the repo root and be **deleted after**.

## Suggested skills

- **`superpowers:systematic-debugging`** — it found RC3, which two prior sessions had measured
  without naming.
- **`superpowers:verification-before-completion`** — see §4.1. Every claim needs an executed control
  that MOVED, *and* an instrumentation point you have proven is measuring the thing.
- **Workflow tool** — C7's delta table needs geometry columns nobody has measured.
- **`handoff`** at the next seam — ⛔ **into `docs/FEATURES/`, not `/tmp`.**

⛔ Do **not** invoke `library-context` reflexively; the SessionStart hook nags about a three.js brief
for an unrelated project (`gesar-app-skin`). This repo is on three.js **0.183.1**.
