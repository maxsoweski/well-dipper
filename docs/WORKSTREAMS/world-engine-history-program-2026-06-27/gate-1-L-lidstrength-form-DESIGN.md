# Gate 1 — `L` (lidStrength) functional form + Earth calibration

**File:** docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-1-L-lidstrength-form-DESIGN.md
**Date:** 2026-07-03
**Status:** **PRE-CODE GATE RESOLVED — feeds the V2-2 contract.** Discharges ROADMAP v2.1 §7b **row 1** (`L` form + Earth calibration) and closes risk **R-L**. Design-only; no production code written.
**Scope:** pins the `L` axis only. Gate 2 (`localYield(L,i)`) and gate 3 (interpenetration statistic) remain open.

---

## Decision (BLUF)

`L ∈ [0,1]` is a **pure, deterministic, per-body** scalar (no draws, no `alea`) computed from the condition vector. It is the strength axis the router and `localYield` consume. It is **non-monotonic in surface temperature by construction**, achieved by a **two-mechanism decomposition** in which each sub-mechanism stays monotonic:

```
meltFactor = 1 − smoothstep(T_MELT_LO, T_MELT_HI, T_surf)          // molten → no lid
coldness   = 1 − smoothstep(T_ZLO, T_ZHI, T_surf)                  // cold surface → thick brittle lid
z          = clamp01(Z_BASE + Z_COLD·coldness + Z_AGE·ageNorm) · meltFactor      // MARS mechanism  (↓ in T_surf)
anneal     = smoothstep(T_ALO, T_AHI, T_surf)                      // hot → ductile lockup / boundary healing
dryness    = 1 − smoothstep(V_LO, V_HI, V)                         // dry → high effective friction (Korenaga)
muProxy    = clamp01(MU_DRY·dryness + MU_HEAT·anneal) · meltFactor // VENUS mechanism (↑ in T_surf, ↑ in dryness)
gMod       = clamp(GMOD_LO, GMOD_HI, (rho·g / RHOG_REF)^G_EXP)     // gentle lithostatic ρg lever
L          = clamp01( K_L · (W_Z·z + W_MU·muProxy) · gMod )
```

**Every constant, pinned:**

| const | value | const | value | const | value |
|---|---|---|---|---|---|
| `Z_BASE` | 0.15 | `T_ALO` | 300 K | `W_Z` | 0.55 |
| `Z_COLD` | 0.55 | `T_AHI` | 750 K | `W_MU` | 0.75 |
| `Z_AGE` | 0.25 | `V_LO` | 0.05 | `G_EXP` | 0.15 |
| `T_ZLO` | 200 K | `V_HI` | 0.20 | `GMOD_LO` | 0.90 |
| `T_ZHI` | 320 K | `MU_DRY` | 0.55 | `GMOD_HI` | 1.12 |
| `T_MELT_LO` | 1100 K | `MU_HEAT` | 0.65 | `RHOG_REF` | 4.95 (= 5.5·0.9) |
| `T_MELT_HI` | 1500 K | | | `K_L` | 0.82 |

Inputs: `T_surf` = preset `T_eq` **(surface temperature, per D3-MF2 — NOT equilibrium temperature)**; `V` = `composition.volatileFraction`; `rho` = `composition.density` (g/cm³); `g` = surface gravity (`massEarth/radiusEarth²`, Earth-relative); `ageNorm` = `clamp01(age/10)`. `K_L` is anchored so **Earth (`Rocky (Earthlike)`) ≈ 0.25** — Earth is a **calibration point, not a threshold**; there is **no dimensional yield-stress constant** anywhere (the 150–250 MPa Earth peg from `condition-to-regime-research.md §2` sets the scale via `K_L`, it is never coded as a `τ_y`).

---

## 1. The SH-F5 fork — RESOLVED: Option A's *outcome* (non-monotonic `L`) via the decomposition; Φ *independently* reads Mars low-vigor

**Choice:** Mars reaches its strong/preserve placement through **`L` itself** (Option A → `L` non-monotonic in `T_surf`), but realized by the **decomposition** so the fork collapses into *"both, cleanly separated by mechanism"* — no bespoke non-monotonic hack:

- **Venus side** — `muProxy` rises monotonically with heat (`anneal`) and dryness. Hot + bone-dry ⇒ high `muProxy`, thin `z`. `L` is carried by μ.
- **Mars side** — `z` (brittle-lithosphere thickness) rises monotonically as `T_surf` falls (cold ⇒ thick conductive lid). Cold ⇒ high `z`, low `anneal`. `L` is carried by `z`.
- **Earth trough** — temperate (`anneal ≈ 0`) + wet (`dryness ≈ 0`) + mid `z` ⇒ low `L`.

Verified monotonic on a `T_surf` sweep (60→950 K, sub-solidus): `z` monotone **decreasing**, `muProxy` monotone **increasing**; the product `L` is **non-monotonic** — 0.577 (cold-dry) → trough 0.358 (~350 K) → plateau 0.685 (Venus-hot) → 0 (molten). This is the exact R-L requirement (hot-annealed Venus AND cold-thick Mars both high, temperate Earth low) with two textbook-monotonic levers.

**Why not pure Option B (Mars only via low Φ, `muProxy` monotonic):** the Tharsis "stationary-hotspot pile" (§2.4 / §5.4 #3) needs **strong `L`** (a preserved datum only the 1–3 strongest centers pierce). A monotonic-in-T `L` puts cold Mars *low*, so the pile could not form. Mars **must** have high-ish `L`. The decomposition delivers that via `z`.

**The Tharsis triple at Mars — `L` supplies only "strong-enough L"; Φ supplies the rest.** `L` places Mars at **0.551** (strong, mixed band). The **LOW Φ** and **LOW n** come from gate-4's size-aware vigor proxy (tiny + cold + old → low Φ; `n = f(Φ, 1/L)` → few centers) — a **separate axis**, not `L`. So the triple is: strong `L` (this gate, z-limb) × low Φ × low n (gate 4). The §5.4 #3 checkpoint uses a **hand-set** D-vector (colder/older than the F40 Mars preset) that can dial `L` further into the preserve zone if UAT wants fewer/taller piles; the real Mars preset already lands solidly strong at 0.551.

---

## 2. `z` semantics (SH-F2 triple-duty) — DISTINCT transform, NOT `shellThickness`

`L` consumes **`z` = brittle lithosphere thickness**, defined by the transform above. It is **not** `baseStep.shellThickness`. Three reasons, one of them empirical:

1. **Wrong sign in age.** `shellThickness = clamp01(0.3 + 0.5·smoothstep(0.5,9,g) + 0.2·(1−ageNorm))` grows with **youth**. A brittle lid grows with **age** (an old body cools, the brittle layer thickens). My `z` uses `+Z_AGE·ageNorm` (older → thicker).
2. **No temperature term.** `shellThickness` has no `T_surf` dependence, so it **cannot** produce the cold→thick Mars limb the fork needs. My `z` is driven by `coldness(T_surf)`.
3. **It does not separate the anchors — measured.** On the real presets `shellThickness` is ~0.41 for Venus, Mars, **and** Earth alike (g-smoothstep + fixed age dominate). My `z` gives Mars **0.802** vs Earth **0.359** vs Venus **0.263** — real separation.

**Keep z / D / d explicitly distinct (the SH-F2 hazard).** `shellThickness` currently serves triple duty: lithosphere *z* (this gate), icy-shell *D* (shell-Ra, siblings), rocky mantle-depth *d* (Φ's d³, gate 4). **`L` consumes `z` only.** V2-1 must **NOT** feed `shellThickness` to `L` as-is, and must give *z*, *D*, *d* three separate transforms. This gate owns *z*; gate 4 owns *d*; the icy siblings own *D*.

---

## 3. `muProxy(V, T_surf)` form + the contested-mechanism hedge

`muProxy = clamp01(MU_DRY·dryness + MU_HEAT·anneal)·meltFactor` — two **additive, standalone** contributions:

- **Dryness (Korenaga water-weakening, `condition-to-regime-research.md §1,§3,§5`).** Water lowers effective friction and is closer to a *necessary condition* for mobile-lid than any mass threshold; dry → high μ → stagnant. Crucially this term is **standalone (fires at all temperatures)**, not gated behind heat — so a temperate **dry** world is stagnant-leaning while temperate **wet** Earth/Ocean is mobile (verified: at `T=290`, `L` runs 0.50 bone-dry → 0.16 wet). An earlier heat-gated form left `V` inert in the temperate band; that is fixed.
- **Anneal (Lenardic stress-reduction *vs* Noack/Breuer healing, §1,§3).** Hot surface → stagnant. **Outcome agreed, mechanism contested** — Lenardic-2008 lowers sub-lithospheric viscosity and *reduces convective stress on the lid*; Noack/Breuer speed *boundary healing / grain growth*. The two disagree on **intermediate cases** (warm-wet early Venus, tidally-heated temperate). `muProxy` uses only the **agreed outcome** (monotone ↑ in T) and is therefore **data-placed at the hot edge, not physics-derived** (Venus's high-`L` is a calibrated placement — D3-MF2). Confidence downgraded accordingly (§6).

`meltFactor` zeroes both `z` and `muProxy` above the silicate solidus (~1100–1500 K, aligned to magmatism's `LIQUIDUS=1300`): a molten surface has no lid. This is what drives **Magma → L≈0**.

---

## 4. Calibration table (computed — `node docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-1-L-calib.mjs` over the real `DRIVER_PRESETS`)

Sorted by `L`. `m_hp = rawTidalIoRatio − 0.45` (heat-pipe peg, delegable #6). `cls` = compositionClass hint. **The router consults `compositionClass` and `m_hp` BEFORE `L`** — so gas/icy/carbon rows are **diagnostic only** (their `L` is meaningless; the `dryness` ramp misreads h2-he's low `volatileFraction` as "dry rock").

| preset | **L** | z | muProxy | Tsurf | V | g | m_hp | path disposition |
|---|---|---|---|---|---|---|---|---|
| Carbon (high C/O) | 0.772 | 0.263 | 1.00 | 600 | 0.02 | 1.16 | − | carbon terminal (excluded pre-L) |
| Lava (hot airless) | **0.747** | 0.263 | 1.00 | 950 | 0.02 | 0.80 | **+7.8e5** | **pure-weak via m_hp** |
| Venus (sulfuric shroud) | **0.728** | 0.263 | 1.00 | 737 | 0.02 | 0.90 | −0.45 | **pure-strong anchor** |
| Gas Jovian / Saturnian / Neptunian | 0.63–0.67 | 0.813 | 0.55 | 55–125 | 0.04 | — | − | gas terminal (excluded) |
| Crystal (faceted) | 0.634 | 0.813 | 0.55 | 150 | 0.02 | 0.78 | − | crystal label carve-out (excluded) |
| Sub-Neptune (hazy) | 0.622 | 0.263 | 0.93 | 550 | 0.04 | 1.12 | − | gas terminal (excluded) |
| **Mars (arid rocky)** | **0.551** | 0.802 | 0.41 | 210 | 0.10 | 0.38 | −0.45 | **mixed (Tharsis, V2-3)** |
| Titan / Frozen / Europa | 0.330 | 0.813 | 0.00 | 60–110 | 0.30–0.50 | — | (Europa +136) | icy/volatile sibling (excluded) |
| MAGMA_REF (pseudo) | 0.270 | 0.405 | 0.14 | 280* | 0.15* | 0.90 | − | reference (see note) |
| **Rocky (Earthlike)** | **0.250** | 0.359 | 0.14 | 288 | 0.15 | 0.90 | −0.45 | **calibration anchor — mobile/broken-lid** |
| Eyeball (locked temperate) | 0.215 | 0.469 | 0.00 | 270 | 0.25 | 1.00 | −0.45 | despun (excluded by subtractive gate) |
| Ocean (temperate) | 0.131 | 0.287 | 0.00 | 295 | 0.35 | 1.07 | −0.45 | mobile/broken-lid (wettest) |
| Hot Jupiter (locked giant) | 0.107 | 0.041 | 0.16 | 1400 | 0.04 | 2.37 | − | gas terminal (excluded) |
| **Magma (K2-141b)** | **0.000** | 0.000 | 0.00 | 2000 | 0.00 | 2.22 | **+7.6e7** | **pure-weak via m_hp (molten)** |

*MAGMA_REF carries no `T_eq`/`density`/`V`; defaulted to a temperate-moderate body (T 280, V 0.15, ρ 5.5). Its `L` is a floor sanity check only.

**Every required ordering PASSES:** `L(MAGMA_REF) 0.270 < L(Venus) 0.728`; Venus high (>0.6); Earth 0.250 & Ocean 0.131 low; `Ocean ≤ Earth` (wetter → more mobile); `Mars 0.551 > Earth 0.250` and Mars in the mixed band; `Magma 0.000 ≈ 0`.

**Key honesty note — `L` cannot separate Venus from Lava, and should not.** Both are hot + bone-dry ⇒ near-identical `L` (0.728 vs 0.747). What distinguishes stagnant Venus from heat-pipe Lava is **tidal flux (`m_hp`)**, not lid strength. This is *why* the response space is ≥2-D: **`m_hp` (boolean) routes Lava/Magma to pure-weak; `L` never gets the chance to mis-strengthen them.** "Lava/Magma well inside pure-weak" (ROADMAP §5.1) is delivered by the enormous `m_hp` margin (Lava +7.8e5, Magma +7.6e7), with Magma additionally at `L≈0` from melt.

### Recommended router boundaries on `L` (V2-2 pins; give margin — D3-MF3)

`L` is **not the sole router input.** Recommended gate order and cuts:
1. `compositionClass` terminal (gas/carbon/crystal/icy) → off-pilot. **Fires before `L`.**
2. `m_hp > 0` (boolean) → **pure-weak** (Lava/Magma). **Fires before `L`.**
3. Remaining rocky, non-heat-pipe bodies classify on `L` + the seeded regime:
   - **pure-strong:** `L ≥ L_STRONG`, recommend **L_STRONG ≈ 0.63** (Venus 0.728 → +0.10; Mars 0.551 → −0.08). Plausible range **[0.60, 0.66]**.
   - **mixed interior:** **[≈0.35, 0.63]** (Mars 0.551 sits here).
   - Below ≈0.35 with no heat-pipe and no seeded-stagnant pick = mobile/broken-lid (plates) — **off the unbroken-lid pilot** (Earth 0.250, Ocean 0.131).
4. **Seeded wet-stagnant world** (§5.4 #1) enters the strong response via `geodynamicRegime='stagnant'` **regardless of its low `L`** (~0.16). Verified: temperate-wet `L ≈ 0.157` vs Venus `0.728`. **[CORRECTED BY GATE 2 §4, 2026-07-03]** — this section originally claimed the low `L` "makes its lid more piercable inside the strong response, serving R-wetstag." Gate 2's calibration falsifies that: at raw `L≈0.16`, `localYield≈0.007` → **pervasive pierce (frac 1.0) = "Io-with-water"**, which fails §5.4 #1 (must read as a coherent *strong-lid* wet world). The seeded-`'stagnant'` pick must therefore set an **effective `L` in the strong-mixed band** (E1 mechanism — owner: this gate's `L` + E1/V2-1; `V`/T_surf nudge it to the piercable edge). Until that mechanism is pinned, **§5.4 #1 stays OPEN** — see gate-2 §4 + its Open-Q4.

---

## 5. Plumbing gaps (verified against `body-condition-vector.js:23-33`) — for the V2-1 contract

`deriveConditionVector` **carries** what `L` needs for `V`, `rho`, `ageNorm` (`composition.volatileFraction`, `density`, `age`). It **MISSES two inputs `L` requires:**

- **GAP-1 `T_eq` (surface temperature).** Not copied today. `L`'s `z`, `anneal`, and `meltFactor` all key on it. Add `T_eq` to the condition vector (documented as **surface temperature**, D3-MF2). *(Note: `T_eq` already exists on the raw preset and is read internally by `baseStep.deriveBodyScalars` for `liquidStability` — it simply is not surfaced onto the condition vector.)*
- **GAP-2 `surfaceGravity` (or `massEarth`).** Not copied today (`radiusEarth` is present but `g = massEarth/radiusEarth²` needs mass). Used by `gMod`. `baseStep.deriveBodyScalars` already computes `surfaceGravity` internally — **expose the scalar.** This is a **shared** need: gate-4 Φ also requires mass/size, so plumbing it here is not `L`-specific overhead.
  - **Graceful fallback if GAP-2 slips:** a density-only `gMod` (density is present) preserves every ordering; max deviation is Mars +0.031, Venus/Earth/Magma ~0. So `L` is buildable on GAP-1 alone if `g` plumbing is deferred.

Not a gap but a **must-not**: `shellThickness` **is** present — do **not** wire it into `L` as `z` (§2).

---

## 6. Confidence flags (per decision)

| decision | conf | what would change it |
|---|---|---|
| **`L` must be non-monotonic in T_surf (R-L)** | **HIGH** | textbook: cold→thick lid + hot→stagnant are both established; only the *mechanism* of the hot limb is contested, not the outcome |
| **Decomposition (two monotonic levers) vs a bespoke non-monotonic μ** | **HIGH** | the cleanest honest realization; verified monotone. Would only change if a reviewer wants the hot limb removed entirely (Option-B camp) — but that breaks Tharsis |
| **`z` distinct from `shellThickness`** | **HIGH** | empirically forced: `shellThickness` is ~0.41 flat across Venus/Mars/Earth (no separation) and has the wrong age sign |
| **Ordering of the anchors (Venus/Mars high, Earth/Ocean low, Magma 0)** | **HIGH** | robust to constant jitter; passes on real preset numbers |
| **Exact constants / `L` magnitudes (0.25, 0.55, 0.73)** | **MEDIUM** | Earth anchors the scale, but the specific values are modeling choices; UAT band-width taste (§7a) may retune `L_STRONG` and the weights |
| **`V` ramp (0.05–0.20)** | **MEDIUM** | tuned to the preset `volatileFraction` clustering (0.02/0.10/0.15/0.35); a different volatile convention would shift it |
| **`muProxy` absolute magnitude + MU_HEAT/MU_DRY balance** | **LOW** | the effective-μ strength paradox: `condition-to-regime-research.md §5` is blunt that μ is **not derivable**. Anneal-vs-dryness split is a labeled choice, not physics |
| **`gMod` (mass as a lever), R-g** | **LOW (declared)** | the Valencia/O'Neill sign is unresolved; kept deliberately weak (±≤12%) and flagged as a modeling choice, per R-g's modal position (weakening dominates, mass is not controlling) |

---

## 7. Open questions for the V2-2 contract

1. **`L_STRONG` and the mixed floor** — pin the pure-strong/mixed cut (recommend 0.63, range [0.60,0.66]) and the mixed floor (~0.35). These are UAT-tunable band widths (§7a); surface the actual band to Max.
2. **Gate-2 coupling.** `localYield(L,i)` must be calibrated so Mars at `L≈0.55` **with low Φ** yields only 1–3 pierces (Tharsis), Venus at 0.728 almost never pierces, and Io/Lava (routed by `m_hp`, not `L`) pierce pervasively. `L` is an *input* to that boolean; the boolean itself is gate 2.
3. **Dispatch 2-tuple ordering (delegable #10).** `L` is only meaningful on the rocky/unbroken-lid path. The contract must guarantee `compositionClass` (gas/carbon/crystal terminal) and `m_hp` fire **before** any `L`-classification, or the diagnostic gas/icy `L` values (0.6+) would misroute.
4. **Plumbing GAP-1 (`T_eq`) and GAP-2 (`surfaceGravity`/`massEarth`)** into `deriveConditionVector` — GAP-1 is hard-required; GAP-2 has a density-only fallback.
5. **z / D / d separation (SH-F2).** The contract must not let V2-1 collapse the three thicknesses; `L` consumes `z` only. Gate 4 must define `d` separately for Φ.
6. **The hot-limb mechanism hedge (Lenardic vs Noack).** `muProxy`'s hot term is the agreed *outcome* only; if V2-6/greenhouse work later derives `T_surf = f(T_eq, pressure, CO₂)`, the Venus placement should be revisited (currently data-placed, D3-MF2).
7. **MAGMA_REF as an `L` input** — it is not a full condition vector; if any future code calls `L(MAGMA_REF)` it must supply the documented defaults, or better, never route it through `L` (it is the magma tuner's neutral point, not a body).

---
*Gate 1 of 3. Scripts (committed beside this brief, dependency-free, run from repo root): `gate-1-L-calib.mjs` (full 17-preset + MAGMA_REF table + ordering asserts), `gate-1-L-sweeps.mjs` (fork curve, V response, g-fallback sensitivity). Re-run: `node docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-1-L-calib.mjs`.*
