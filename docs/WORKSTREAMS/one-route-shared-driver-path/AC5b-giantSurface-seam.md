# AC5b — the giantSurface import-back, and the pack that needed no ruling at all

**Measured:** 2026-08-22 · **Instrument:** `tools/giant-surface-seam-probe.mjs` (reproducible by command)
**Status:** ✅ **LANDED 2026-08-22.** Driver pack #8 is the THIRD the lab imports back, after
`giantDeck` and `solidFeatures`. No decision was required of Max and no pixel moved.

---

## 1. Why this pack, and why it was quick

`AC2-pack-law-survey.md` scored it **4 claimed conflicts → 0 confirmed, all four refuted** — the only
pack besides `solidFeatures` with nothing left to rule on. The remaining four each carry a live
decision (`polarDeck`'s six-rows-one-decision, `rockySurface` + `craterDeck`'s shared crater-floor
family, and `solidOptics`' `uTermStrength`).

## 2. What the probe answered

**30 gas body-seeds (5 presets × 6 seeds), 390 comparisons. ZERO on both questions.**

| | |
|---|---|
| **Q1 — does the condition arm matter?** | **No.** Route C (frozen `_fp`) and route B (per-seed `_dp`) agree on every gas body-seed |
| **Q2 — what moves on adoption?** | **Nothing.** The lab already calls the same shared functions the pack calls |

⭐ **Q1's answer is reported as a MECHANISM, not inferred from the zero:** `drawPresetConditions`
returned the preset unchanged on **30/30** — the giants are gated out of the per-seed draw inside it,
so the lab's two conditions *cannot* differ on this pack's whole domain.
⛔ **So AC5's condition warning does NOT carry here.** `solidFeatures` failed silently on the wrong
arm; this one cannot. Saying so is as much a part of the result as the zero is.

### ⛔ Both arms have a positive control, and the run exits 2 without them

A zero from a dead comparator and a zero from an agreeing pair are the same character on a terminal,
and four instruments in this workstream were broken rather than the thing they measured.

⚠ **The first Q2 control WAS dead, and it is recorded in the tool as rejected.** It used the lab's
real pre-2026-08-21 binary `retained ? 0.15 : 0` termStrength, expecting the binary to separate from
the shared law. It reported zero — correctly, because `columnFraction` saturates to 1.0 above 0.3 bar,
so both expressions give 0.15 on every gas body. **That is the same fact that makes Q2's answer zero,
so it could never have proved the comparator alive.** It now reports as a FINDING that reproduces
`AC2-refutation.md`'s 157/157 argument, and the live control drives the same loop off a perturbed
condition instead.

## 3. The wiring, and the bug that only a page load found

The call sits in **`ensureNetworkRouted`**, not `applyDrivers`.

⛔⛔ **The first attempt put it in `applyDrivers` and threw `_gs is not defined` on load.**
`applyDrivers` ENDS at `planet-lod-lab.html:2760`; seven of this pack's thirteen outputs — the five
palette colours, `iceness`, `biosphere` — are authored in `ensureNetworkRouted`, several hundred
lines later. **Every headless gate was green with the call in the wrong function.** That is the same
shape as the 2026-08-21 import-inside-a-comment: the instruments this program owns do not read
scope, and only loading the page does.

⭐ **And the call site was then proven LIVE by sabotage, not by its output.** The pack's values are
measured identical to the lab's, so a value check cannot tell a working mirror from an absent one.
Nulling `state.macroOffset` and switching to a gas preset raised the pack's own `PackContractError`
in the console — which is what shows the line executes at all.

### The three-owner split, and why the mirror is not flat

`giantDeck` and `solidFeatures` mirror uniform → a flat `state.<field>`. This pack cannot, and the
shortfall is the seam:

| the pack's 13 | the lab's owner |
|---|---|
| the terminator triple | `applyDrivers` (`:2497` / `:2505` / `:2511`) |
| 5 palette colours | ONE object, `state.surfacePalette` (`:2820`) — not five fields |
| `uIcenessMix`, `uBioGroundCover` | `ensureNetworkRouted` (`:2785` / `:2788`) |
| `uCraterOffset` | a 🎲 transient, `state.craterOffset` |
| `uMacroOffset`, `uDetailOffset` | `updateSeedUniforms` (`:1379-1380`), straight to the material |

So `GIANT_SURFACE_LAB_BINDING` carries **six**, `giantSurfaceLabState` adds `surfacePalette` off the
pack's own `meta.palette` (the same object `surfacePaletteBlock` already built — re-deriving it at
the lab would be a second copy of the law the pack exists to single-source), and
`GIANT_SURFACE_PALETTE_MIRRORED` names the five so the subtraction-derived complement cannot swallow
them. **The complement is exactly `uMacroOffset` + `uDetailOffset`, and it is asserted to be.**

⭐ **The offsets are published by the function that owns them.** `giantSurfacePack` REQUIRES the
triple and refuses to derive it. `updateSeedUniforms` now stashes its own output onto
`state.macroOffset` / `state.detailOffset`. ⛔ Reading `uniforms.uMacroOffset` inside `applyDrivers`
instead would have grown the ratchet's set 3 — which measures *direct uniform writes* — to buy a
value the seed function can simply hand over.

## 4. ⛔ THE LEDGER SHRANK BY TWO, AND ONE OF THEM NOBODY CHOSE

`IMPORT_BACK_DEBT_CEILING` **10 → 8**.

- `drivers/giantSurface.js` cleared on its merits.
- ⚠ **`drivers/solidOptics.js` cleared TRANSITIVELY.** `giantSurface.js` imports `TERMINATOR_GATE`
  from it so the gate NAME has one home, and registration 2's criterion is **import closure —
  reachability, not exercise**. The lab does not call `solidOpticsPack` and no ruling was made on its
  one confirmed conflict. The row is deleted because the criterion is genuinely met and a row the
  liveness test calls stale cannot be left standing — **but the call-side work on `solidOptics` is
  not done, and the ledger no longer records that.**

**This is an instrument question for Max, not a bookkeeping detail:** the fence measures whether the
lab *can* reach a module, and this is the first time that diverged from whether the lab *uses* it.

## 5. What is open

| | |
|---|---|
| ⬜ `solidOptics` call-side | untracked by the ledger as of this commit — see §4 |
| ⬜ `polarDeck` | 6 rows, ONE decision, Max's |
| ⬜ `rockySurface` + `craterDeck` | the shared crater-floor family, Max's |
| ⬜ `limbDeck` | not yet surveyed for a lab seam |
