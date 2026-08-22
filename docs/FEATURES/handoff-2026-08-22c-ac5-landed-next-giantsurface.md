# Handoff 2026-08-22c — AC5 IS LANDED. ▶ **NEXT = MAX'S EYES ON [G], THEN `giantSurface`**

**HEAD:** `35e4cce` · **Branch:** `feature/world-engine-production-L1`
⚠ **HEAD IS UNPUSHED — 1 ahead of `origin`.** The remote sits at `2d85b4c`; the previous handoff's
"last two commits may be unpushed" was wrong, they were pushed. Confirm with Max before pushing.
**Repo:** `~/projects/well-dipper` (lane A's branch, NOT master) · tracked-clean
⭐ Dev server is UP on `:5173` serving THIS lane, and the lab is **parked on Europa** in Max's tab.
⛔ ~700 untracked PNGs are normal. **NEVER `git add -A`.**

---

## 1. WHAT MOVED — stated as capability, not as a diff

**The lab no longer computes fourteen surface-feature laws of its own.** F7 edifices, F9 chaos,
F10's shared `uCryoActivity` master, F23 frost, F22 PLD and F17 glacial now come out of driver pack
#2, `src/worldengine/drivers/solidFeatures.js` — the module the game has been applying since its
registration (`drivers/index.js:240`). Two front-ends, one law, no reconciliation.

That is the **second** pack to close the loop; `giantDeck` was the first and only precedent.
The import-back debt ledger and AC4's closed roster are both down from seven packs to six, and
`IMPORT_BACK_DEBT_CEILING` fell 11 → 10 so no unearned slot was left behind it.

## 2. ⛔ THE ONE THING THAT NEEDS MAX, AND IT IS NOT A GATE

The adoption moves **exactly three values**, all ∝1/`surfaceGravity`: `edificeMaxHeight`,
`chaosRaftJitter`, `glacialFlowVigor`. The other eleven round-trip through the condition vector
unchanged — verified live in the running lab, not argued.

**[G] flips those three between the adopted arm and the old one.** The live arm is named in the
green badge at top-centre (`#abBadge`, `planet-lod-lab.html:147`; handler `:5566`).

⭐⭐ **PARK: `Europa (icy moon)`, AND THE INSTRUMENT IS THE RADIUS SLIDER, NOT THE KEY ALONE.**
Europa is the only preset whose F9 chaos and F17 glacial masters are both fully live
(`cryoActivity` 1.0, `glacialStrength` 1.0) — and its canonical 0.5 R⊕ is exactly where the two arms
agree, so a key-press alone shows nothing there. Dragging the radius separates them completely:

```
                         chaosRaftJitter   glacialFlowVigor
  old lab arm  (any R)        0.660             0.760      ← radius-DEAF: the slider does nothing
  pack arm  R=0.20 R⊕         0.744             0.844
            R=0.50 R⊕         0.660             0.760      ← canonical: the arms meet
            R=2.00 R⊕         0.300             0.400
```

⚠ Where the KEY alone reads, at seed 1: `Lava (hot airless)` **+60%** shield-volcano height on
`volcanismStrength` 1.0; `Ocean (temperate)` **+51%** height with **+36%** glacial vigor together.
⛔ Chaos rafts are **not** judgeable by key alone on any preset — every preset with a diverging
drawn radius has `cryoActivity` ≈ 0, and the one with real cryo locks to canonical. Measured, so
nobody re-derives it.

## 3. GATES — re-run AFTER the last edit, at `35e4cce`

| gate | value |
|---|---|
| Instrument A | `npm run test:baseline` — **every test ID exactly where the baseline left it.** 341 files (6 failing, 15 non-collecting), 5711 tests, **31 failed — unchanged, no NEWLY RED** |
| Instrument C | `port-uniform-delta:check` — ZERO delta, exit 0 |
| Citations | `port-uniform-delta:citations` — **818** (was 815), exit 0. CHECKED rose |
| Fences | the 6 named suites **296/296** |
| Line counts | `planet-lod-lab.html` **6559** · `Planet.js` 2304 · `limbDeck.js` 199 |

⚠ **THE BASELINE WAS RE-RECORDED ONCE, DELIBERATELY.** `driver-pack-solidfeatures.test.js` went
33 → 38 — the five `§H` tests authored red-first LAST session and named in the previous handoff.
Declared work, no red moved. The prior handoff's "zero drift" line was already stale when written.
⚠ **THREE flaky suites remain** — `worldengine-inc3b-composite-budget`,
`worldengine-v2-4-host-channels`, and watch for more. A red that vanishes on re-run with no code
change is a flake, not a regression.

## 4. THE TWO TRAPS THIS EDIT ACTUALLY HIT — carry them forward

1. **The seam is `_dp`, the per-seed draw — NOT `_gcond` (`:1726`).** Held. Route C is measured at
   9 uniforms / 297 rows against route B's 3 / 168, and it fails SILENTLY.
2. **The import went in BEFORE the trailing `//` on `:188`**, as a third statement on that line.
   Held.
3. ⭐ **NEW, and it cost a cycle: the lab's HUD is invisible.** `#hud` is `left:12px; z-index:10`
   and lil-gui's left panel is `left:0` at `z-index:1001`, so **every one of the HUD's rows is
   covered** — found by screenshotting, where the only part of a new row that showed was the few
   characters wider than the panel. Anything an author must READ while flying needs its own element
   above 1001, which is what `#abBadge` is. ⛔ Do not add a readout to `#hud` and call it visible.
4. **Line-neutral means REUSING BLANK LINES AND SHARING LINES**, not deleting. This edit spent one
   blank line in `<body>`, one blank line inside the help template, appended a CSS rule to the
   `#hud` rule's closing line, and neutralised eleven assignments into comments in place.

## 5. ▶ NEXT: `giantSurface` — the second 0-conflict pack

`AC2-pack-law-survey.md` after refutation: `giantSurface` **4 claimed → 0 confirmed, all four
refuted.** It is the only remaining pack that needs NO ruling from Max, exactly as `solidFeatures`
was. The other four each carry a live decision — `polarDeck` 6 rows that are ONE decision,
`solidOptics` `uTermStrength`, and `rockySurface` + `craterDeck` sharing the crater-floor family.

The mechanism is now proven twice, so the work is: author `giantSurfaceLabState` +
`giantSurfaceDirectDrivers` red-first, find which condition vector the lab must hand it, make the
line-neutral edit, clear the row, drop the ceiling 10 → 9.
⚠ `giantSurface` writes 13 uniforms including `uMacroOffset`/`uDetailOffset`/`uCraterOffset` — the
lab's 🎲 transient-roll offsets, which it resets to `[0,0,0]` on preset change. **Whether those are
mirrored or left lab-owned is the first question to answer, not the last.**

## 6. OPEN FOR MAX — carried forward, still unanswered

1. **[G] on Europa** — §2 above. His eyes; no agent closes it.
2. **Push?** HEAD is 1 ahead of `origin`.
3. The second crater octave — he has ruled he wants it; not scoped yet.
4. The lab preset ages/erosion (every cratered lab preset reads `relaxation` 0 because it has no
   tidal heating and effectively no erosion; the LAW is fine — ~38% of GAME bodies degrade).
5. Crater density on Moon/Mercury, Mars, Frozen, Crystal — his eyes, still untaken.
