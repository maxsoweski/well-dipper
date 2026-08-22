# Handoff 2026-08-22d — THREE PACKS IMPORTED BACK. ▶ **NEXT NEEDS A RULING, NOT A WIRE**

**HEAD:** `4e8e6ac` · **Branch:** `feature/world-engine-production-L1` · **PUSHED** (`origin` matches).
**Repo:** `~/projects/well-dipper` (lane A's branch, NOT master) · tracked-clean
⭐ Dev server UP on `:5173` serving THIS lane. ⛔ ~700 untracked PNGs are normal. **NEVER `git add -A`.**

---

## 1. WHERE THE PROGRAM STANDS

The goal is one pipeline with two front-ends. **This session took the lab from one pack closing that
loop to three**, and closed the two — and only the two — that needed no decision from Max:

| pack | closed | what the lab stopped computing itself |
|---|---|---|
| `giantDeck` | earlier | bands / jets |
| `solidFeatures` (#2) | today | 14 surface-feature laws — edifices, chaos, frost, PLD, glacial |
| `giantSurface` (#8) | today | the gas half of the terminator triple, ground palette, iceness, biosphere, 3 offsets |

`IMPORT_BACK_DEBT_CEILING` **11 → 8**. AC5 is landed and **Max closed its UAT** — *"One seems right
to me"* — so the lab's three ∝1/g morphology terms now derive from the radius-AWARE gravity.

## 2. ▶ NEXT: THE EASY ONES ARE GONE

`AC2-pack-law-survey.md` after refutation — every remaining pack carries a live decision:

| pack | what must be ruled |
|---|---|
| `polarDeck` | 7 claimed, 6 confirmed — **but they are ONE decision** |
| `rockySurface` + `craterDeck` | 11 + 6 confirmed, the **same** crater-floor family — one ruling covers both |
| `solidOptics` | 1 confirmed, `uTermStrength` — ⚠ and see §3 |
| `limbDeck` | never surveyed for a lab seam |

⭐ **The wiring mechanism is now proven three times and is no longer the hard part.** What is left is
Max's taste on the crater floors and on polarDeck. **Do not start a wire that needs a ruling he has
not made** — that was AC5's whole lesson, and it is why these two went fast.

⭐ **`rockySurface` is the highest-value target** and it is the SOLID complement of the pack that
landed today: they share `surfacePaletteBlock` and `offsetDriverBlock` by import, so closing it
collapses the composition branch this session had to introduce, and the lab's inline palette /
iceness / biosphere path disappears for all 18 presets rather than 5.

## 3. ⛔ THE ONE THING THAT NEEDS MAX AND IS NOT A TASTE CALL

**`solidOptics` left the debt ledger without anyone deciding it should.**

`giantSurface.js` imports `TERMINATOR_GATE` from `solidOptics.js` so the gate NAME has one home. That
put `solidOptics.js` in the lab's import closure — and registration 2's criterion is **import
closure: reachability, not exercise.** The lab does not call `solidOpticsPack`, no ruling was made on
its one confirmed conflict, and its row is now gone because the liveness test refuses to let a row it
considers stale keep standing.

**The fence measures whether the lab CAN reach a module. This is the first time that came apart from
whether the lab USES it.** Recorded in the fence and in `AC5b-giantSurface-seam.md` §4 so it is not
laundered, but the call-side work on `solidOptics` is now untracked. Options are (a) tighten the
criterion to reachable-AND-called, (b) add a third list for reachable-not-called, or (c) accept it.
**Max's call — it changes what the fence means, not just what it counts.**

## 4. GATES — re-run AFTER the last edit, at `4e8e6ac`

| gate | value |
|---|---|
| Instrument A | every test ID where the baseline left it. 341 files, 5717 tests, **31 failed — unchanged** |
| Instrument C | ZERO delta, exit 0 |
| Citations | **826** (815 at session start), exit 0 |
| Fences | the 8 named suites **363/363** |
| Line counts | `planet-lod-lab.html` **6559** · `Planet.js` 2304 · `limbDeck.js` 199 |

⚠ **FLAKES CONFIRMED, NOT ASSUMED.** The first full pass showed two NEWLY RED —
`GalacticFeatures.test.js` and `worldengine-inc3b-composite-budget`. Both passed in isolation AND on
a second full pass. ⭐ `GalacticFeatures` is a NEW addition to the flake list; the handoff before this
one named three, so treat that list as growing rather than fixed.

## 5. THE THREE TRAPS THIS SESSION ACTUALLY HIT — all three cost a cycle

1. ⛔⛔ **A pack call in the wrong FUNCTION is invisible to every headless gate.** `giantSurface`'s
   call went into `applyDrivers`, which ENDS at `:2760`, while seven of its outputs are authored in
   `ensureNetworkRouted`. Green everywhere; `_gs is not defined` on page load. Same shape as the
   2026-08-21 import-inside-a-comment. **These instruments do not read scope. Load the page.**
2. ⭐ **When a pack's values are measured IDENTICAL to the lab's, output cannot prove the wire.**
   Sabotage it instead — nulling `state.macroOffset` raised the pack's own `PackContractError`, which
   is what showed the line executes at all.
3. ⛔ **A control can be vacuous for the very reason the answer is zero.** The first Q2 control in the
   seam probe used the lab's real pre-extraction binary termStrength and reported zero — because
   `columnFraction` saturates, which is *also* why Q2's answer is zero. Recorded in the tool as
   rejected. A control must exercise the COMPARATOR, not re-express the law.

⚠ And one claim I made in `2f7402f` was **wrong and is retracted** in the probe: the palette, iceness
and biosphere do NOT read a frozen condition — `buildBodyDrivers:1674`'s `fp` is a parameter, and its
live caller passes the per-seed draw. There was no lab inconsistency. The numbers never moved,
because on gas both arms are identical — which is how a wrong reading survived producing right numbers.

## 6. OPEN FOR MAX

1. **§3 — what should the import-back fence MEAN?** reachable, or reachable-and-called.
2. **Which ruling next** — the crater-floor family (unblocks `rockySurface` + `craterDeck`, the
   highest-value target) or `polarDeck`'s one decision. Recommend the crater floors.
3. The second crater octave — he has ruled he wants it; not scoped.
4. The lab presets' ages/erosion.
5. Crater density on Moon/Mercury, Mars, Frozen, Crystal — his eyes, still untaken.
