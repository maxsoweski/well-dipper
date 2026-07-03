# Gate 2 — `localYield(L, i)` per-center pierce threshold

**File:** docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-2-localyield-DESIGN.md
**Date:** 2026-07-03
**Status:** **PRE-CODE GATE RESOLVED — feeds the V2-2 contract.** Discharges ROADMAP v2.1 §7b **row 2** (`localYield(L,i)` per-center pierce threshold — the anti-mush lynchpin) and is the second of the THREE pre-code gates that block V2-2 (§3.1 critical path). Design-only; no production code written.
**Consumes gate 1** (`L` non-monotonic per-body scalar) and **co-calibrates with gate 3** (interpenetration statistic). **Scope:** pins the per-center pierce boolean only; PHI's final form is delegable #4 and is used here **provisionally**. **Hands ONE constraint back UP:** ROADMAP §5.4 #1 (wet-stagnant coherence) needs a gate-1/E1 *effective-`L`* mechanism that gate-2's `L`→pierce map cannot supply (§4, §6) — flagged as OPEN, not silently assumed closed.

---

## Decision (BLUF)

Per province/center `p` (ROADMAP §2.4), a SHARP boolean — never a blend:

```
center p pierces (→ shield)  iff  strength_p · Φ  >  localYield(L, p)      (else → tents into corona/tessera)
```

- **`strength_p`** — per-center plume vigor, a NEW `'lid:'` draw (disjoint from `'magma:strength:'`):
  `strength_p = STR_LO + (1 − STR_LO)·u_p`,  `u_p = rng_strength()`,  `rng_strength = alea('lid:strength:'+macroSeed)`.
- **`localYield(L, p)`** — per-center lid yield = a body-global base `Ybase(L)` times a per-center seeded spread:
  `localYield(L, p) = Ybase(L)·(1 + SPREAD·(2·y_p − 1))`,  `y_p = rng_yield()`,  `rng_yield = alea('lid:yield:'+macroSeed)`,
  `Ybase(L) = Y0·exp(Y_K·L)`  — a **yield-stress-like exponential**; L is gate-1's non-monotonic per-body scalar.
- **`Φ`** = gate-4's convective-vigor proxy (**provisional here**, §2). **`n`** (center count) = `clamp(N_MIN, N_MAX, round(N_BASE + N_PHI·min(Φ,1.2) + N_L·(1−L)))` — `n = f(Φ, 1/L)`. **`n` reads the COMPRESSED Φ** (the same `min(Φ,1.2)` the pierce boolean sees), **not raw vigor**, and **does NOT carry the Mars/Venus separation** — correcting ROADMAP §2.3's n-row: compressed n is Mars 6 / Venus 7, raw-vigor n would be 5 / 6 (same gap); the actual pierce split (Mars 1.45 vs Venus 0.00) is carried by `Ybase(L)`+`L_STRONG` routing (§2, §8).
- **`L`** is gate-1's non-monotonic per-body scalar; its temperature input is the preset `T_eq` slot, which is **SURFACE temperature, not equilibrium temperature** (D3-MF2). Gate-2 consumes `L` and never re-reads temperature.

**Both `'lid:'` streams are drawn once each, in plume-index order** (`for p: strength_p = rng_strength(); … for p: y_p = rng_yield();`), disjoint from `'magma:'`/`'stagnant:'`/`'plates:'` — the mixed interior's "same centers" are NOMINAL (D2-MF6); only these `'lid:'` draws fire there. No `Math.random`/`Date.now`. **There is NO dimensional `τ_y` stress constant and NO coded pierce/Earth threshold.** `Y0/Y_K` are calibrated to the two pierce constraints that actually bite: **Venus-suppression** (`Ybase(0.728)≈1.05` ⇒ min-yield `0.735 > `Venus max-drive `0.69` ⇒ pierces never) **+ Mars-few-pierce** (`Ybase(0.551)≈0.22`) — two points fix the two constants (`Y_K = ln(1.05/0.22)/0.177 ≈ 8.8`, `Y0` back-solved). **Earth does NOT set `Y0/Y_K`:** Rocky sits at `L=0.25`, routes mobile/broken-lid, and **never reaches `localYield`** — it is *consistent* with the fit, not its anchor. (The 150–250 MPa Earth peg from `condition-to-regime-research.md §2` anchors gate-1's `L`-scale via `K_L`, a **different** constant — do not re-attribute it to `Y0/Y_K`.)

**Every constant, pinned:**

| const | value | const | value | const | value |
|---|---|---|---|---|---|
| `STR_LO` | 0.30 | `Y0` | 0.001759 | `N_MIN` | 3 |
| `SPREAD` | 0.30 | `Y_K` | 8.78 | `N_MAX` | 11 |
| | | | | `N_BASE` | 4 |
| | | | | `N_PHI` | 4 |
| | | | | `N_L` | 2 |

⇒ `Ybase(0.55)=0.220`, `Ybase(0.728)=1.05`, `Ybase(0.16)=0.0072`.

**Routing model — made unambiguous (gate-1 §4).** The router is NOT pure `L`-threshold. Gate order: **`compositionClass` terminal → `m_hp` boolean → then a JOIN of an `L`-threshold *default* AND the seeded `geodynamicRegime`.** Default (no seeded override): `L≥L_STRONG≈0.63` → pure-strong · `[≈0.35, 0.63]` → mixed (localYield runs) · `<0.35` → mobile/broken-lid. **A seeded `'stagnant'` E1 pick routes to the strong response REGARDLESS of raw `L`.** So the `<0.35→mobile` default does **not** govern a seeded-stagnant low-`L` body — that is how the wet-stagnant world (`L≈0.16`) reaches the pilot, and the reason §4/§5.4 (seeded-regime entry) do not contradict §1/§3/§5-PG5 (`L`-threshold).

---

## 1. The form — strength side, yield side, and the spread

**Strength side (which per-center strength feeds the boolean).** `magmatism` draws `s_p` in `'magma:strength:'` to set edifice *amplitude* (`A_e ∈ [0.4,1]`); that stream is byte-owned by the pure-weak corner and MUST NOT be reused. The mixed interior draws its OWN `strength_p ∈ [0.30, 1]` in `'lid:strength:'`. Physical reading: a plume's buoyant push. `STR_LO=0.30` (a hair below magma's 0.4) gives enough driving spread that at fixed `(L,Φ)` some centers clear yield and some don't — the source of "3 pierced, 5 tented" at ONE `(L,Φ)` (ROADMAP §2.1).

**Yield side.** `Ybase(L)` is exponential because the stagnant-lid transition in `L` is physically sharp (Moresi–Solomatov yield-stress control; §1 of the research), and — the load-bearing reason — because **it must climb steeply enough in `L` to make hot high-Φ Venus pierce LESS than cold low-Φ Mars** (see §2, the coupling). `Ybase` rises `0.22 (L=0.55) → 1.05 (L=0.728)`, and floors to `0.007` at the wet-stagnant `L≈0.16`.

**Why the per-center yield spread (`SPREAD`), and its magnitude.** Physically, the lithosphere is not uniformly strong — weak zones exist; `y_p` models per-province lid heterogeneity, distinct from plume-strength variation. Quantitatively `SPREAD` (with `STR_LO`) sets the variance of the pierce margin `m_p = strength_p·Φ − localYield`, hence how sharply pierce-fraction transitions as `(L,Φ)` move:
- **Too narrow** (`SPREAD→0`): `m_p` sign is nearly constant across `p` at fixed `(L,Φ)` → whole worlds flip **all-pierce ↔ all-tent** as they cross the threshold → **tiling** (a world is all shields OR all coronae; no compound landforms).
- **Too wide** (`SPREAD→1`): `m_p` variance swamps `(L,Φ)` → pierce/tent becomes a per-center coin-flip → **province placement decouples from `L` = mush**.
- **`SPREAD=0.30`** (with `STR_LO=0.30`) is the balance: it opens a legible intermediate-pierce band of measurable width (§4) without decoupling from `L`. Measured few-pierce band width on `L` is **0.03–0.04 at fixed Φ** (§4) — finite, not razor-thin, not a mush-wide plateau.

---

## 2. PHI dependence + the gate-2 ↔ gate-4 coupling (the central finding)

**Provisional Φ (delegable #4 default, realized here so the boolean is runnable):**
`Φ = sqrt( radiogenic·(C_MASS·massEarth + C_SIZE·d³) ) + C_TIDAL·rawTidalIoRatio`, with `radiogenic = 1−clamp01(age/10)`, `d = radiusEarth` (PROVISIONAL mantle-depth proxy), `C_MASS=C_SIZE=0.5`, `C_TIDAL=10`. **Exact provisional Φ assumed at each pinned vector:** Venus **0.690**, Mars **0.268**, Earth 0.740, Ocean 0.998, compound (hand-set) **0.42**, wet-stagnant (Earth-mass) **0.72**, colder-Tharsis (hand-set) **0.24**; Lava/Magma → astronomically large (tidal), but routed by `m_hp` before Φ is read.

**⚠ THE COUPLING (must land in the V2-2 contract) — compression is a LEGIBILITY preference, not a correctness necessity.** localYield's conditioning depends on Φ's *dynamic range across mixed-interior bodies*, NOT on gate-4's specific formula. The RAW size/mass/d³ vigor puts Mars **~6.5× below** Venus (measured §8: raw vigor Mars 0.070 / Venus 0.460 = **6.54×**); the `sqrt` **compresses that to ~2.56×** (Φ Mars 0.268 / Venus 0.690), which is what makes `Y_K=8.78` and its `~0.04`-wide bands work. **The earlier "*no smooth low-order `Ybase(L)` can give Venus ~0 AND Mars a few pierce → k≳8–17 razor-thin mush*" claim is RETRACTED — I re-checked it (§8).** Feeding raw-linear Φ (full 6.54× ratio, no sqrt: Mars 0.268, Venus 1.75) and re-fitting the *same smooth* `Ybase=Y0·exp(k·L)` at **k≈14** STILL gives **Venus 0.000 pierce and Mars few-pierce (piercē 1.77, P(1-3) 0.79)** — the required behaviour — with a **narrower but finite band (~0.025 on `L`, vs 0.040 compressed)**. So raw Φ is **re-derivable**, just less legible (steeper `Ybase`, tighter bands), not a correctness failure. **Recommendation to gate-4: deliver Φ compressed to ≈2–3× to keep the wider, UAT-legible bands** — but raw-linear Φ only re-fits `Y_K`≈14 (PG-2, §5), it does not break the gate. **`n` note:** `n` reads the **compressed** Φ (`min(Φ,1.2)`), not raw vigor, and **does not carry the Mars/Venus pierce split** — that is `Ybase(L)`+`L_STRONG` routing (§8; §4).

**Sensitivity (Φ internal-vigor × {0.7, 1.0, 1.3}) — piercē | P(1-3):**

| world | Φ×0.7 | Φ×1.0 | Φ×1.3 | verdict |
|---|---|---|---|---|
| Venus corner (L0.728) | 0.00 \| 0.000 | 0.00 \| 0.000 | 0.31 \| 0.270 | ~0 for Φ≤1.0×; **starts to pierce at +30%** (mitigated by routing) |
| Mars/Tharsis (L0.551) | 0.23 \| 0.210 | 1.45 \| 0.750 | 2.92 \| 0.657 | few-pierce holds; vanishes toward Φ−30% |
| Compound (L0.60) | 0.25 \| 0.227 | 1.57 \| 0.780 | 3.57 \| 0.440 | minority-pierce holds ±30% (count shifts ±1.5) |
| Wet-stagnant (L0.157) | 8.0 \| — | 9.0 \| — | 9.0 \| — | pervasive at all scales (robust) |

**Do the conclusions survive ±30%?** The **qualitative orderings survive** (Venus≈0 [routed], Mars few, compound minority, wet-stag pervasive); the **exact pierce counts shift ±1–1.5**. So: orderings HIGH-confidence, counts MEDIUM. The one soft edge is Venus at Φ+30% (starts to pierce) — but Venus is protected by the `L≥L_STRONG` route to the unchanged writer, so this is a continuity margin, not an operational failure. **Honesty note (parallel to gate-1):** localYield ALONE cannot suppress Venus against its high Φ; the `L_STRONG` routing does — exactly as `m_hp`, not `L`, separates Lava from Venus in gate 1.

---

## 3. The `m_hp` seam — no cliff into the heat-pipe corner

`m_hp = rawTidalIoRatio − HEATPIPE_PEG(≈0.45) > 0` HARD-gates the pervasive-resurfacing corner to the UNCHANGED `writeMagmatismSphere` BEFORE any pierce logic (ROADMAP §2.4). The transition is kept continuous by **Φ's tidal term**: just below the peg, tidal heat makes Φ large, so `strength_p·Φ` clears `localYield` for nearly all centers → the mixed interior ALREADY pierces pervasively where it meets the heat-pipe corner. Measured (hot MIXED body, `L=0.58`, `Φ_int=0.25`, sweep `rawTidal`):

| rawTidal | 0 | 0.05 | 0.10 | 0.15 | 0.20 | 0.30 | 0.45 | 0.46 |
|---|---|---|---|---|---|---|---|---|
| Φ | 0.25 | 0.75 | 1.25 | 1.75 | 2.25 | 3.25 | 4.75 | → |
| pierce frac | 0.049 | 0.885 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | **m_hp→PURE-WEAK** |

few (0.05) → pervasive (1.0) is **continuous**, and pervasive is reached far below the peg → **crossing `m_hp` into magmatism is seamless, not a cliff**. **Routing requirement this exposes (for the V2-2 contract):** a would-be pure-strong body (`L≥L_STRONG`) that is tidally warming (`rawTidal ≥ SHOULDER_LO≈0.15`) must route **MIXED**, not pure-strong — otherwise its Φ is ignored until `m_hp` fires and the seam becomes a cliff (0 → pervasive). The pure-strong cut is `L≥L_STRONG AND rawTidal < SHOULDER_LO`.

---

## 4. Calibration (computed — `node docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-2-localyield-calib.mjs`, 400 seeds/vector, deterministic)

| world | (L, Φ) | n̄ | piercē | frac | P(≥1) | P(1-3) | reading |
|---|---|---|---|---|---|---|---|
| **Venus corner** | (0.728, 0.69) | 7 | **0.00** | 0.000 | **0.000** | 0.000 | pierces ~never (P(≥1)=0.000 over 400 seeds); routed pure-strong regardless |
| **Mars / Tharsis** | (0.551, 0.27) | 6 | **1.45** | 0.242 | 0.780 | **0.743** | 1-3 shields of 6 centers; hist 0:88 1:132 2:108 3:57 4:13 5:2 |
| colder-Tharsis (hand-set) | (0.575, 0.24) | 6 | 0.28 | 0.047 | 0.250 | 0.250 | pushing L up → **fewer/taller piles** (mostly 0-1) — the §5.4 #3 "preserve" dial |
| **Corona-pierced compound** | (0.60, 0.42) | 6 | 1.57 | 0.263 | 0.815 | 0.770 | **minority pierce** (~2 shields among ~4 tents) — gate-3's compound world |
| **Wet-stagnant seeded** | (0.157, 0.72) | 9 | 9.00 | 1.000 | 1.000 | 0.000 | **pervasive** — sharply ≠ Venus, but a tiled all-pierce, not a mix (see below) |
| Lava / Magma | (—, huge) | 9-11 | all | 1.000 | 1.000 | — | routed pure-weak by `m_hp` **before** localYield; also sit far inside pure-weak (m_hp +7.8e5 / +7.6e7) |

**Every task target met.** Io/Lava/Magma pierce fraction ~1 (pervasive) AND sit well inside pure-weak (routed by the `m_hp` boolean, not by `L` — their high `L` never reaches localYield). Venus-like → P(≥1 pierce among 7 centers) = **0.000 < 0.05** (pinned bound). **Corona-pierced band** (exactly-1-to-few pierce, `piercē∈[1,3]` & `P(1-3)≥0.5`) is reachable, width on `L`: **0.037 (Φ0.20) / 0.040 (Φ0.30) / 0.027 (Φ0.42) / 0.032 (Φ0.55) / 0.030 (Φ0.72)** — a diagonal stripe across the mixed band occupying ~8% of the mixed `(L,Φ)` rectangle (deliberately a minority — anti-mush — but where Mars and the compound world already land). **Tharsis (`n`'s role):** low Φ (0.27) → `n≈6` (vs ~10-11 for vigorous low-`L` worlds); of the 6, only the 1-3 strongest clear localYield on a preserved datum — pushing `L` higher (colder hand-set) monotonically thins the count toward 1 (fewer, taller).

**Wet-stagnant finding — HARD gate-1/E1 dependency; gate-2 CANNOT close §5.4 #1 alone (feeds R-wetstag).** What the pierce boolean does with a seeded-wet-stagnant body depends ENTIRELY on the **effective `L`** E1 hands it, and the two cases diverge:
- **If it carries its raw mobile-band `L≈0.16`:** localYield is tiny (0.007) → **frac 1.0 pervasive pierce** = all-shields. That is the *weak-lid* pierce expression ("Io-with-water"), a tiled all-pierce that never exercises the stagnant coronae/tessera response — so it does **NOT** meet §5.4 #1's "enters the pilot's **strong-lid end** and reads as a coherent wet-stagnant world." It differentiates sharply from Venus's 0.0, but toward Io, the wrong direction.
- **To read as coronae-with-a-few-shields (a genuine strong-lid world, wet-differentiated from dry Venus):** E1's seeded-`'stagnant'` pick must feed the strong response an **effective `L` in the strong-mixed band** (from §4's band table, `L≈0.65` at Φ0.72 → few-shields), with `V`/T_surf nudging it to the *piercable* (lower) edge so a few shields emerge among coronae. That is a **NEW E1 mechanism — the seeded pick sets an effective `L`, not merely the regime label** — **owned by gate-1/E1, co-signed by Max UAT** (taste on how "wet" it reads). gate-2 only maps `L`→pierce; it hands this constraint UP.

This **corrects gate-1 §4's** "its low `L` makes it more piercable inside the strong response": at raw `L≈0.16` "more piercable" overshoots to **fully** piercable (pervasive), losing the stagnant character. Interpenetration itself stays the compound world's job (gate 3), not this world's. Until E1 pins the effective-`L`, **§5.4 #1 is OPEN.**

---

## 5. Plumbing gaps (for the V2-2 contract)

- **PG-1 — `'lid:strength:'` + `'lid:yield:'` streams.** Two new `alea` namespaces, disjoint from `'magma:'`/`'stagnant:'`/`'plates:'`/`'e1:'` (AC1). Fixed draw order (one draw per center, per stream, in plume-index order). These do not exist today; the mixed-interior writer must create them.
- **PG-2 — Φ scale is a LEGIBILITY preference, NOT a correctness blocker (the coupling, §2/§8).** Compressing Φ to ≈2–3× keeps the wider, UAT-legible `~0.04`-wide bands at `Y_K=8.78`. But raw-linear Φ (full ~6.5×) is **re-derivable** (§8): `Y_K` re-fits to ≈14, Venus still 0.000 / Mars still few-pierce, bands just narrower (~0.025). So gate-4 delivering compressed Φ is **recommended** (legibility), not **required** (correctness) — downgraded from the earlier "single hardest external dependency." `Y_K` re-derives; it does not break.
- **PG-3 — raw Io-ratio in the drivers bundle.** `body-condition-vector.js:29` already surfaces `rawTidalIoRatio` — `m_hp` and Φ's tidal term both read it. No new plumbing, but the router (not just gate-2) consumes it (see PG-5).
- **PG-4 — `L` and `Φ` on `state` for the mixed writer.** Gate-1 flagged GAP-1 (`T_eq`) + GAP-2 (`surfaceGravity`/`massEarth`) into `deriveConditionVector`; gate-2 adds no new condition-vector field but REQUIRES both `L` (gate 1) and `Φ` (gate 4) be computed and passed to `writeLidResponseSphere`.
- **PG-5 — router tidal-shoulder (§3).** The pure-strong cut must be `L≥L_STRONG AND rawTidal < SHOULDER_LO(≈0.15)`, else the `m_hp` seam is a cliff for tidally-warming high-`L` bodies. This is a ROUTER rule (gate-1/contract), surfaced here because gate-2's seam depends on it.
- **Not a gap, a MUST-NOT:** localYield reads `L` and the per-center draw ONLY. `V` (volatiles) enters via `L` (gate-1 `muProxy` dryness) — do NOT add a separate `V` term to localYield or it double-counts.

---

## 6. Confidence flags (per decision)

| decision | conf | what would change it |
|---|---|---|
| Sharp per-center boolean `strength_p·Φ > localYield` (form) | **HIGH** | it is the ROADMAP §2.4 pinned object; Moresi–Solomatov driving-vs-yield is textbook |
| Exponential `Ybase(L)` (not linear/power) | **HIGH** | forced: linear/power cannot span 0.22→1.05 over ΔL=0.18 without a near-step (measured; §2) |
| Orderings (Venus≈0 routed, Mars few, wet-stag pervasive, compound minority) | **HIGH** | robust over 400 seeds AND survive Φ±30% qualitatively |
| Exact constants `Y0, Y_K, SPREAD, STR_LO` + pierce COUNTS | **MEDIUM** | counts shift ±1–1.5 under Φ±30%; band-width taste is UAT-tunable (ROADMAP §7a) |
| `n = f(Φ, 1/L)` form + its constants | **MEDIUM** | provisional; couples to gate-4 Φ; V2-2 may retune to match corner plume counts |
| Provisional Φ absolute scale; 2–3× compression = **legibility** preference | **MEDIUM (declared)** | gate-4 owns Φ; raw-linear Φ just re-fits `Y_K`≈14 (narrower bands ~0.025), does NOT break the gate (§2/§8/PG-2) |
| Venus suppression margin against Φ over-estimate | **LOW-MEDIUM (declared)** | Venus starts piercing at Φ+30%; only routing (`L_STRONG`) fully protects it — same structure as gate-1's m_hp note |
| Wet-stag reads as coherent wet-stagnant (§5.4 #1 PRIMARY falsification) | **BLOCKED — hard gate-1/E1 dependency** | NOT closable by localYield: raw `L≈0.16` → pervasive "Io-with-water" (fails §5.4 #1); needs E1 to feed a strong-band **effective `L`** for the seeded-stagnant pick (§4). Owner **gate-1/E1 + Max UAT**; until pinned, §5.4 #1 is OPEN |

---

## 7. Open questions for the V2-2 contract

1. **PG-2 (Φ scale) is a legibility choice, NOT a blocker.** If gate-4 delivers Φ compressed to ≈2–3×, freeze `Y_K=8.78` (wide `~0.04` bands); if it ships raw-linear Φ, re-fit `Y_K≈14` (narrower `~0.025` but valid bands, §8). Either ships — this no longer gates coding.
2. **Gate-3 co-calibration (its Open-Q7).** The compound world sits at `n≈6`, ~2 pierce, area-frac ≈0.26 — inside gate-3's validated minority band `f∈[0.10,0.35]`. Gate-3's real-world dry-run should confirm `Π≥0.15 / M≤0.70` on THIS calibration; if it wants more pierced components, nudge compound Φ up (raises `n` and pierce count) — the two gates are joined at the compound world.
3. **`L_STRONG` + `SHOULDER_LO` (router, PG-5).** Pin `L_STRONG≈0.63` (gate-1) and the tidal shoulder `SHOULDER_LO≈0.15`; both are UAT-tunable band edges — surface the actual widths to Max.
4. **Wet-stag effective-`L` — HARD gate-1/E1 pre-code dependency (§4), not a taste toggle.** A raw-`L≈0.16` wet-stagnant world pierces **pervasively** ("Io-with-water"), which **fails** §5.4 #1 (must enter the strong-lid end + read coherent-wet-stagnant). §5.4 #1 stays **OPEN** until E1 defines how a seeded-`'stagnant'` pick sets a strong-band **effective `L`** (owner gate-1/E1); Max UAT then judges the wet reading. gate-2 cannot close this.
5. **`SPREAD`/`STR_LO` as UAT knobs.** Both set the few-pierce band width (0.03–0.04 on `L`); expose them like `_driverAbMode` for lab-only tuning (ROADMAP §7a: frozen constants + lab override).
6. **Heat-pipe `C_TIDAL` shape.** `C_TIDAL=10` makes the pierce ramp steep at very low tidal; the no-cliff requirement is met with a wide pervasive plateau (0.1→0.45), but `C_TIDAL` could be retuned to center the ramp — a joint call with gate-4 (Φ's tidal weight) and delegable #6 (the peg).

---
*Gate 2 of 3. Script (committed beside this brief, deterministic, three-free save for `alea`, run from repo root): `gate-2-localyield-calib.mjs` — per-preset + anchor worlds + `(L,Φ)` surface + corona-pierced band width + `m_hp` seam sweep + Φ±30% sensitivity + 7 ordering asserts (all PASS) + §8 raw-Φ counterfactual (compression = legibility, not correctness). Re-run: `node docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-2-localyield-calib.mjs`.*
