# Handoff 2026-08-22b — ▶ **NEXT = THE LAB WIRING, THE SECOND HALF OF "ADOPT"**

**HEAD:** `677d295` · **Branch:** `feature/world-engine-production-L1` · ⚠ last two commits may be unpushed — check `git ls-remote`.
**Repo:** `~/projects/well-dipper` (lane A's branch, NOT master) · tracked-clean
⭐ Dev server is UP on `:5173` serving THIS lane — live verification needs no help from Max.
⛔ ~700 untracked PNGs are normal. **NEVER `git add -A`.**

---

## 1. THE ONE THING TO DO

**Wire `solidFeaturesPack` into `world-engine-lab.html`.** Max ruled **ADOPT** on the radius-aware
gravity (2026-08-22). The adapters are built, tested and shipped; only the lab edit remains.

### What is already done — do not redo it
- `solidFeaturesLabState()` + `solidFeaturesDirectDrivers()` + `SOLID_FEATURES_LAB_BINDING` are on
  `src/worldengine/drivers/solidFeatures.js`, with 5 tests written red-first (`§H`, suite 33 → 38).
- The seam is **measured and settled**: `tools/solid-features-seam-probe.mjs`.
- The full rationale is `docs/WORKSTREAMS/one-route-shared-driver-path/AC5-solidFeatures-seam.md`.

### The edit, precisely
1. **Import** `solidFeaturesPack, solidFeaturesLabState` — ⛔⛔ **INSERT BEFORE ANY TRAILING `//`.**
   Appending to a line that ends in a comment puts the import INSIDE it; both new imports were
   silently disabled that way on 2026-08-21, **every headless gate stayed green**, and the lab died
   at runtime. Only loading the page found it. The giantDeck precedent (`:188`) puts TWO import
   statements on ONE line on purpose — line budget.
2. **Build the condition — `deriveConditionVector(_dp, u, state.planetRadiusEarth)`.**
   ⛔ **NOT `_gcond`.** `_gcond` (`:1726`) is built from the FROZEN preset `_fp` and is seed-DEAF.
   Using it renders every seed with the same volcanism, frost and temperature, and NOTHING GOES RED.
   Measured: route C disagrees on 9 uniforms / 297 rows vs route B's 3 / 168.
3. **`Object.assign(state, solidFeaturesLabState(_sf))`** replacing the 14 `state.X = u.X` lines at
   **2074, 2075, 2076, 2087, 2089, 2099–2104, 2106, 2112, 2113**. ⚠ Those are INTERLEAVED with
   non-pack assignments (lavaCoverage, chaosCellScale, chaosMatrixRough, doubleRidgeFreq,
   cryoRidge*, groovedBandFreq, pldLevels, subStrength, volatileSpecies) which **must stay**.
4. **An A/B on a bare key** flipping the three changed values between pack-derived and `u`-derived —
   `edificeMaxHeight`, `chaosRaftJitter`, `glacialFlowVigor`. Max judges in the live thing, moving;
   a screenshot cannot carry this.
5. **Clear the `solidFeatures` debt row and lower `IMPORT_BACK_DEBT_CEILING` 11 → 10.**
   ⛔ The new AC4 gate makes the ceiling `=== length`, so a cleared row that leaves the ceiling up
   is now RED. That is deliberate.

### ⛔ THE HARD CONSTRAINT
**`world-engine-lab.html` must stay EXACTLY 6559 lines.** 500 line-anchored citations sit at or past
`:1933`, 175 inside 1933–2760. Freed lines get **neutralised into comments**, never deleted —
count preserved, dead code gone. Same for `Planet.js` (2304) and `limbDeck.js` (199).

### Why the three values change (the ruling)
All three derive from `surfaceGravity`. `deriveUniforms` uses the canonical **radius-BLIND** g; the
condition vector carries the **radius-AWARE** one. ⭐ The lab already made this exact conversion once
— `world-engine-lab.html:1964`, comment: *"both were radius-deaf until this line changed"* — for the
bulk relief envelope and the on-screen gravity readout. These three were never brought along.

---

## 2. GATES — measured at `677d295`

| gate | value |
|---|---|
| Instrument A | `npm run test:baseline` — **zero drift**. 341 files (6 failing, 15 non-collecting), 5706 tests, **31 failed** |
| Instrument C | `port-uniform-delta:check` — ZERO delta, exit 0 |
| Citations | `port-uniform-delta:citations` — **815**, exit 0. ⭐ CHECKED must RISE |
| Fences | one-pipeline **31/31** · the 5 named suites 176/176 |
| Line counts | `world-engine-lab.html` 6559 · `Planet.js` 2304 |

⛔ **RE-RUN GATES AFTER THE LAST EDIT, NOT BEFORE IT.**
⚠ **THREE flaky suites now, not one** — `worldengine-inc3b-composite-budget`,
`worldengine-v2-4-host-channels` (blessed a false red into the baseline once; reverted), and watch
for more. A red that vanishes on re-run with no code change is a flake, not a regression.

---

## 3. WHAT LANDED THIS SESSION

- **AC4, the import-back gate** (`bb7392d`). Roster of 7 packs frozen by name; ledger ceiling must
  EQUAL its length so a cleared row cannot leave a free slot. Proven by dropping a real probe pack
  into `src/worldengine/drivers/` and watching it red by name.
- **AC5 groundwork + adapters** (`a31359f`, `d770fb3`).
- **Three crater measurements** (`3eab31a`, `3eae35e`, `677d295`) — see §4.

## 4. THE CRATER THREAD — CLOSED FOR NOW, ONE ITEM PARKED

- **"Rocky shows no craters" is NOT a defect.** An Earthlike world's air and resurfacing erase them;
  coverage ~6.7e-5 trips `density * visibleCells >= 1` and returns `CRATERS_OFF`. Ocean, Europa,
  Lava, Eyeball are off for the same reason. ⭐ The density judgement lives on Moon/Mercury, Mars,
  Frozen, Crystal — never on Rocky.
- **The ceiling is structural, not a tuning number.** `density` is the fraction of voronoi cells
  hosting a crater; 1.0 means every cell hosts one, capping painted coverage at ~17%.
  **~20% of generated solid bodies are pinned there, median ~7x over, max 10.4x.**
  ⛔ So "remap the real range into the display range" is not available — it would scale DOWN the
  ~49% that currently render correctly. **Max's call: WIDEN the range** (a second crater octave —
  smaller craters superposed, which is what a saturated surface physically is).
- ⏸ **PARKED, needs Max's taste:** every cratered LAB preset reads `relaxation` 0 because it has no
  tidal heating and effectively no erosion, so `tExp == age`. The **law is fine** — ~38% of GAME
  bodies degrade, median 0.75. Giving the lab presets real ages/erosion is design work, not wiring.

## 5. OPEN FOR MAX
1. The second crater octave — he has ruled he wants it; not scoped yet.
2. The lab preset ages/erosion above.
3. Crater density on Moon/Mercury/Mars/Frozen/Crystal — his eyes, still untaken.
