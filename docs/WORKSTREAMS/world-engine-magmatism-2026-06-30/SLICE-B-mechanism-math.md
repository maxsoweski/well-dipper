# SLICE B — pinned volcanic-relief mechanism (`magmatism.js` · `writeMagmatismSphere`)

**Resolves contract mustFix #1.** Physics-first, closed-form, deterministic. Synthesized from three
adversarially-verified candidates: the **PHYSICS-FIRST** spec (highest-scored ordering proof + faithful
shader adoption) as the spine, grafting the **CONSISTENCY** candidate's **province swell** (the AC2
workhorse that the physics spec's sparse-edifice-only field left unproven) and the F8 flood-and-flatten
grounding, plus the **READABILITY** candidate's per-node separation intuition. Every profile below is a
pinned equation with named constants and a sign/normalization convention, plus a construction-level
ordering proof with the profile-mean integrals evaluated for the record. Matches the shell-relief
`SLICE-B-stress-math.md` build bar.

> **Line of sight.** JOURNEY milestone: *"each world looks like it has its own history."* PLAYER_EXPERIENCE
> tier: the screensaver's volcanic worlds (Lava / Magma-K2-141b / Io) currently smear to `sin²(lat)` bands;
> this writer is the sibling of `plates.js` / `shellRelief.js` that gives them real landforms —
> shield edifices on their hotspots, dark effusive lava plains in the lows, and a substellar magma-ocean
> basin under the star for extreme-T locked bodies. The writer is the **carrier-side single-source-of-truth**
> for the shipped **F7 `edificeProfile`** (`planet-lod-height.glsl.js:2218`) and **F41 magma-sea iso-angle law**
> (`planet-lod-lab.html:3617-3622`, temperature law `:1126`): it adopts both **verbatim** so the carrier
> geometry and the shader shading never drift. It authors the BASIN *geometry*; F41 remains the complementary
> surface-temperature/shading layer (retrofit note — not a rewrite of F41).

## Convention (everywhere)

- `psi` = geodesic angular distance (radians) from a node to its **nearest plume top** = `hotspotDist[i]·meanEdgeAngle`.
- `theta` = angle from the **substellar axis** = `acos(clamp(-1,1, dot(verts[i], substellarAxis)))`.
- `zeta = hotspotProximity[i]` ∈ [0,1] from SLICE A (1 AT a plume top → 0 into the province).
- Height field `U` is REPLACE-written to `carrier.height`. Higher `U` = higher relief. `MAGMA_BASE` is the
  flat volcanic-plain datum; the substellar basin is the only strongly-negative population.

---

## 0. The one correction we MUST NOT regress (the load-bearing merge decision)

**All three candidates hardcoded `BASIN_TSS = 2800` and gated the basin on the `locked` boolean. Every
skeptic flagged this as the AC9-FAILING defect, and it is confirmed against the repo:**

- `planet-lod-lab.html:2589` — `Lava (hot airless)` is `tidalState:{locked:true}` (T_eq 950).
- `planet-lod-lab.html:2694` — `Magma (K2-141b)` is `tidalState:{locked:true}` (T_eq 2000).
- `planet-lod-lab.html:3617-3622` — the shipped F41 gate is
  `_mgTss = locked ? T_eq*1.4 : 0; _magmaClass = !_gas && _mgTss > 1300; magmaSeaAngle = acos((1300/_mgTss)^4)`.

So **both** presets are locked; a `locked`-only gate with a fixed 2800 would give **both** the same wide
sea, and AC9 ("Magma strictly wider than Lava") FAILS. **The fix (this spec):** thread `T_ss` (= `T_eq·1.4`
on locked worlds, else 0) into `writeMagmatismSphere`; gate the basin on **`T_ss > LIQUIDUS` (extreme-T)**,
not on `locked`; and set the basin extent from the **F41 iso-angle** `theta_sea = acos((LIQUIDUS/T_ss)^4)`.
This reproduces the shipped law exactly:

| body | T_eq | T_ss = T_eq·1.4 | `theta_sea = acos((1300/T_ss)⁴)` | read |
|------|------|-----------------|----------------------------------|------|
| Lava (hot airless) | 950 | 1330 | **0.4208 rad (24.1°)** | small pond |
| Magma (K2-141b) | 2000 | 2800 | **1.5243 rad (87.3°)** | wide sea |

Magma strictly wider than Lava ⇒ AC9 passes by construction. `architecturalConnections.inputs` already lists
`T_ss` as a SLICE-B input; `writeBodyRelief` computes it from the body params and passes it through.

---

## 1. Plume-field usage (mostly from SLICE A; two SLICE-B additions)

**Already built in SLICE A (do not rebuild):** `meanEdgeAngle` (geodesic rad per BFS hop); `plumeCount`
∈ [5,11) via `PLUME_COUNT_MIN + floor(rngCount()·PLUME_COUNT_SPAN)`, `rngCount = alea('magma:count:'+seed)`
(mantle plumes are sparser than the 7–13 plates / 9–18 shell cells — Earth has ~a dozen major hotspots);
`centroids[p]` (seeded `randDir`); `plumeId[i]` (domain-warped spherical-Voronoi, **strict `>` tie-break ⇒
lowest-index plume wins**); `hotspotNode[p] = argmax_i dot(verts[i], centroids[p])` (plume tops); a
multi-source BFS from all tops → `hotspotDist[i]` → `hotspotProximity zeta[i]`; `substellarAxis =
randDir(alea('magma:substellar:'+seed))` (seed-only — NO driver-response this increment).

**SLICE-B addition 1 — per-plume strength/radius/mix** (one new draw `strengthRng = alea('magma:strength:'+seed)`,
drawn in fixed plume-index order ⇒ deterministic). For each plume `p`:

```
s_p    = strengthRng();  jit_p = strengthRng();  mix_p = strengthRng()
A_e[p]   = EDIFICE_HEIGHT * (STRENGTH_LO + (1 - STRENGTH_LO)*s_p)      // peak amplitude, all > 0  → [0.4, 1.0]
Psi_e[p] = EDIFICE_RADIUS_MIN + jit_p*EDIFICE_RADIUS_SPAN              // angular radius (rad)     → [0.10, 0.26]
p_exp[p] = mix(SHIELD_P_LO, SHIELD_P_HI, clamp01(SHIELD_MIX_BASE + SHIELD_MIX_SPAN*mix_p))   // → [1.75, 2.5]
```

This produces variety (Olympus-class giant vs low patera; AC6) and keeps every shield broad and low-aspect.

**SLICE-B addition 2 — nearest-plume propagation on the SAME BFS (no new pass).** Augment the SLICE-A BFS
drain to also carry the source-plume id, exactly as `plates.js` carries `nearStress[nb] = nearStress[c]`:

```
nearestPlume = new Int32Array(N).fill(-1)
// seed (plume-index order ⇒ lowest-index wins if two tops share a node):
for p in [0,plumeCount): if (hotspotDist[hotspotNode[p]] === 0 && nearestPlume[hotspotNode[p]] < 0) nearestPlume[hotspotNode[p]] = p
// drain: when hotspotDist[nb] is first set from parent c: nearestPlume[nb] = nearestPlume[c]
```

Then per node: `pStar = nearestPlume[i]`, `r_i = psi_i / Psi_e[pStar]` (0 at the top, 1 at the edifice rim).

> **Threshold crest rule (mustFix #1 — NOT a relative local-max):** a node is inside its plume's edifice
> **iff `r_i < 1`** — an *absolute, order- and resolution-independent* geodesic threshold. `edificeMask[i] =
> (!magmaOceanMask[i]) && (r_i < 1)`. This is both the flood-exclusion footprint and the edifice population.
> *Determinism edge case (byte-deterministic, not fatal):* if two plume tops share one argmax node, only the
> lowest-index plume seeds it; the other plume's region inherits a neighbour's `nearestPlume` (rare on a
> 600-node carrier; noted so the headless test author isn't surprised).

---

## 2. Edifice / shield profile (F7 `edificeProfile` transcribed VERBATIM + a Walcott moat)

For a node at normalized shield radius `r = r_i`, with `A = A_e[pStar]`, `p = p_exp[pStar]`, `c = CALDERA_FRAC`:

```
shield(r)  = (r < 1) ? pow(1 - r, p) : 0                          // F7 body: convex dome, slope 0 at rim (r=1), rising inward
caldera(r) = (r < c) ? 0.5*((r/c)^2 - 1) : 0                      // F7 summit bowl, VERBATIM (glsl.js:2226): -0.5 at r=0 → 0 at r=c
edificeShape(r) = shield(r) + caldera(r)
edifice[i]      = A * edificeShape(r)                             // ON edifice nodes (r < 1)
```

`edificeShape` is **transcribed byte-for-byte** from the shipped `edificeProfile()` — the cone body
`pow(1-r, mix(1.5,4,shieldStratoMix))` and the summit caldera `0.5*(s²−1)` (glsl.js:2218-2229). `p=1.75`
is a broad, low-slope basaltic shield (Hawaiian/Io tholus, flanks 2–10°); `p→2.5` a modestly steeper
edifice. The **crest** (high ring) is at `r=c`, value `(1−c)^p ≈ 0.72–0.78`; the caldera floor at `r=0`
sits at `1 − 0.5 = 0.5` (a summit caldera below the rim — the Io-patera / Olympus read).

**Flexural moat (Walcott 1970) — SURROUND-ONLY, applied to non-edifice nodes** (`r ≥ 1`), so it never
touches the edifice population's mean (keeps the ordering proof clean) and instead pools the flood:

```
apron(psi) = (r >= 1) ? -MOAT_DEPTH * A_e[pStar] * exp( -((psi - Psi_e[pStar]*MOAT_CTR) / (Psi_e[pStar]*MOAT_WIDTH))^2 ) : 0
```

a shallow negative Gaussian ring centred at `MOAT_CTR·Psi_e` just outside the rim — the lithospheric
flexural moat under the volcanic load. Negligible far from the edifice.

**Defaults** (add to `MAGMA_DEFAULTS`): `EDIFICE_HEIGHT=1.0`, `STRENGTH_LO=0.4`, `EDIFICE_RADIUS_MIN=0.10`,
`EDIFICE_RADIUS_SPAN=0.16`, `SHIELD_P_LO=1.5`, `SHIELD_P_HI=4.0`, `SHIELD_MIX_BASE=0.10`,
`SHIELD_MIX_SPAN=0.30`, `CALDERA_FRAC=0.15`, `MOAT_DEPTH=0.10`, `MOAT_CTR=1.20`, `MOAT_WIDTH=0.35`.

---

## 3. Province swell + pre-flood field (the AC2 workhorse)

A broad hotspot-swell dome (Hawaiian / Tharsis dynamic topography), **linear in plume proximity** — the term
that makes `corr(U, plume-proximity) ≥ 0.5` robust rather than a hope (the physics-only sparse-edifice field
covered ~6% of the sphere and its skeptic marked AC2 "asserted, not proven"; this dome carries the signal over
the *whole* non-basin field):

```
swell[i] = SWELL_GAIN * zeta[i]                                   // broad dome, high at provinces, ~0 in inter-province lows
detail[i]= DETAIL_AMP * detailNoise(d*DETAIL_FREQ)                // SLICE-A texture, tiny
H0[i]    = MAGMA_BASE + swell[i] + edifice[i] + apron(psi_i) + detail[i]     // PRE-FLOOD field
```

On **eligible** (non-edifice, non-basin) nodes `edifice[i]=0` (since `r≥1 ⇒ shield=caldera=0`), so there
`H0 = MAGMA_BASE + swell + apron + detail`. **Default `SWELL_GAIN = 0.25`.**

---

## 4. Lava-plain flooding (effusive fill-to-datum; F8 flood-and-flatten analog)

Below-ness is computed from the **pre-flood field `H0`** (mustFix requirement), via an **analytic
mean-minus-Z·std datum** — an O(N) reduction, **no sort**, matching the render-once discipline:

```
E        = { i : edificeMask[i]==0 && magmaOceanMask[i]==0 }      // eligible set
mu0      = mean_E(H0);   sigma0 = std_E(H0)                       // exact O(N) reductions
D_flood  = mu0 - FLOOD_Z * sigma0                                 // datum in the lower tail of the quiet terrain
for i in E:
   lavaPlainMask[i] = (H0[i] < D_flood) ? 1 : 0
   Uplain[i]        = D_flood + WRINKLE_AMP*wrinkleNoise(d*WRINKLE_FREQ)      // flat low plain + faint wrinkle-ridge texture
```

The datum sits in the lower tail, so the **topographic lows pond to one flat dark plain** while the swelled
provinces and shields stand above it — the lunar-mare / flood-basalt / Io-plains read. The wrinkle term is a
sub-ordering-margin cosmetic (`WRINKLE_AMP ≪ A_e`); it is NOT claimed zero-mean, and because
`WRINKLE_AMP = 0.02 ≪` the STEP-1/STEP-2 margins below it cannot perturb the ordering. Non-flooded eligible
nodes keep `U = H0` (the QUIET province — the AC2 denominator terrain). **Defaults:** `FLOOD_Z = 0.25`,
`WRINKLE_AMP = 0.02`, `WRINKLE_FREQ = 6.0`, `wrinkleNoise = createNoise3D(alea('magma:wrinkle:'+seed))`.

---

## 5. Substellar magma-ocean basin (F41 iso-angle, T_ss-THREADED — §0's fix)

A hemisphere-scale depression on `substellarAxis`, gated on **extreme-T** and shaped by the shipped F41 law:

```
isMagmaOcean = (T_ss > LIQUIDUS)                                  // = F41 _magmaClass (NOT the locked boolean)
theta_sea    = isMagmaOcean ? acos( clamp01( (LIQUIDUS / T_ss)^4 ) ) : 0        // F41 iso-angle (glsl derivation :3621)
theta_i      = acos(clamp(-1, 1, dot(verts[i], substellarAxis)))
// F41 dayside irradiation temperature (verbatim planet-lod-lab.html:1126):  T(theta) = T_ss * cos(theta)^(1/4)
g(theta)     = (theta < theta_sea) ? clamp01( (T_ss*pow(cos(theta),0.25) - LIQUIDUS) / (T_ss - LIQUIDUS) ) : 0   // normalized superheat
magmaOceanMask[i] = (isMagmaOcean && theta_i < theta_sea) ? 1 : 0
basinU(theta)     = MAGMA_BASE - BASIN_DEPTH * g(theta)           // deepest at substellar pt, continuous with base at shore
```

**Why this depth law:** melt depth scales with the temperature excess above the liquidus, so `g` is the
*normalized superheat* built directly from the F41 temperature field. It is exactly continuous with the F41
shoreline: at `theta = theta_sea`, `T_ss·cos(theta_sea)^(1/4) = T_ss·(LIQUIDUS/T_ss) = LIQUIDUS`, so `g=0`
and `basinU = MAGMA_BASE` (verified numerically: g(theta_sea)≈0.002–0.007). `g(0)=1` ⇒ deepest floor
`MAGMA_BASE − BASIN_DEPTH` at the substellar point. Extent matches the F41 molten-sea by construction (same
`theta_sea`). **Precedence: basin > edifice > plain** — the molten hemisphere drowns any edifice/plain inside
it (no solid landform stands in the deep melt). **Defaults:** `LIQUIDUS = 1300` (F41 `MG_LIQUIDUS`;
peridotite near-surface working value — see citation confidence), `BASIN_DEPTH = 2.0`. `T_ss` is a
**threaded parameter, not a constant.**

---

## 6. Assembly + elevation-ordering PROOF

**Assembly** (disjoint precedence basin > edifice > plain > quiet; REPLACE-write + bounded relax):

```
for i:
  if      (magmaOceanMask[i])  U_raw[i] = MAGMA_BASE - BASIN_DEPTH*g(theta_i)
  else if (edificeMask[i])     U_raw[i] = H0[i]                              // swell + shield + caldera
  else if (lavaPlainMask[i])   U_raw[i] = D_flood + WRINKLE_AMP*wrinkleNoise(...)
  else                         U_raw[i] = H0[i]                              // quiet province (swell + apron + detail)
  U[i] = clamp(-(MAGMA_BOUND - 1e-3), +(MAGMA_BOUND - 1e-3), U_raw[i])       // AC1 safety guard (never fires in production)
carrier.height.set(U)
for pass in 0..RELAX_PASSES:  buf[i] = U[i]*0.5 + mean(U[i], U[nb...])*0.5;  U.set(buf)   // verbatim plates/shell Jacobi
carrier.height.set(U)
carrier.faultDensity[i] = clamp01(zeta[i])                                  // activity proxy = plume proximity (parity bookkeeping)
```

Two O(N) masking passes (masks + `D_flood`, then assemble); **no while-loop.**

### Construction-level proof that mean(edifice) > mean(lava-plain) > mean(magma-ocean basin)

Four disjoint populations: **B** (basin), **E_d** (edifice, `r<1`), **P** (plain, eligible & `H0<D_flood`),
**Q** (quiet, else). Profile-mean facts (integrals evaluated for the record; disk area element `∝ 2r dr`,
exact to leading order for `Psi_e ≲ 0.26` rad):

- `diskmean(shield) = ∫₀¹ (1−r)^p · 2r dr = 2/((p+1)(p+2))` — evaluates to **0.229** (p=1.5), **0.167** (p=2),
  **0.127** (p=2.5), **0.067** (p=4).
- caldera area contribution `= ∫₀^c 0.5((r/c)²−1)·2r dr = −c²/4 = −0.00562` (c=0.15).
- ⇒ `diskmean(edificeShape) = diskmean(shield) − 0.00562` ∈ **[0.121, 0.188]** over the default `p ∈ [1.75, 2.5]`
  (softest possible `p=1.5` would give 0.223) — **strictly positive, a fixed profile constant independent of
  seed/mesh.** The load-bearing lower bound used by STEP 1 is `0.121` (steepest default shield, `p=2.5`).
- `gbar` = area-weighted mean of `g(theta)` over the cap `[0, theta_sea]` = **0.506** (Lava) / **0.666** (Magma)
  (numerically integrated).

Population means (`A_bar` = mean per-plume amplitude over the edifice population ≥ `STRENGTH_LO·EDIFICE_HEIGHT = 0.4`):

```
mean(E_d) = MAGMA_BASE + mean_{E_d}(swell) + A_bar·diskmean(edificeShape)
mean(P)   = D_flood = mu0 - FLOOD_Z·sigma0,   mu0 = MAGMA_BASE + mean_E(swell) + mean_E(apron),  mean_E(apron) ≤ 0
mean(B)   = MAGMA_BASE - BASIN_DEPTH·gbar
```

**STEP 1 — mean(E_d) > mean(P):**
```
mean(E_d) − mean(P) = A_bar·diskmean(edificeShape)
                    + [mean_{E_d}(swell) − mean_E(swell)]        // ≥ 0: edifices sit at plume tops (high ζ); E includes the lows
                    + [−mean_E(apron)]                            // ≥ 0: apron ≤ 0
                    + FLOOD_Z·sigma0                              // ≥ 0
```
Every bracket is ≥ 0 and the first term is **strictly positive** (≥ `0.4 × 0.121 = 0.048` for the steepest
default shield). **PROVEN for all seeds/meshes** (reduces to a fixed profile integral × a positive amplitude).

**STEP 2 — mean(P) > mean(B):**
```
mean(P) − mean(B) = BASIN_DEPTH·gbar + mean_E(swell) + mean_E(apron) − FLOOD_Z·sigma0
                  ≥ BASIN_DEPTH·gbar − MOAT_DEPTH·A_max − FLOOD_Z·sigma0_max
```
With `BASIN_DEPTH=2.0`, `MOAT_DEPTH·A_max = 0.10`, `FLOOD_Z·sigma0_max ≈ 0.025`:
- **Lava:** `2.0·0.506 − 0.125 = 1.011 − 0.125 = +0.886`.
- **Magma:** `2.0·0.666 − 0.125 = 1.331 − 0.125 = +1.206`.

Positive with **> 7× margin** for both bodies. **PROVEN by construction** (choose
`BASIN_DEPTH > (MOAT_DEPTH·EDIFICE_HEIGHT + FLOOD_Z·sigma0_max)/gbar_min` + margin; `gbar_min=0.506`).

Therefore **mean(edifice) > mean(lava-plain) > mean(magma-ocean basin) for every seed and body-case,
independent of mesh.** The bounded RELAX is a convex neighbour-average and cannot invert well-separated
population means. For unlocked/non-extreme-T bodies (`T_ss ≤ LIQUIDUS`) B is empty and the guarantee degrades
gracefully to STEP 1 alone.

**AC2 side-bars.** (i) `corr(U, arm's-length plume-proximity)` is measured over `magmaOceanMask==0` nodes so
the basin (a *known* separate structure on an independent axis) is scored by the ordering test, not diluted
into the linear correlation; the province swell + edifices carry `|corr| ≥ 0.5` over the remaining terrain.
(ii) Edifice-crest amplitude above the plain `≈ SWELL_GAIN + A_e·maxShield − 0 ≈ 0.25 + [0.4,1.0]·0.72 ∈
[0.54, 1.0]` vs the flat-plain denominator `≈ WRINKLE_AMP = 0.02` ⇒ ratio ≈ **27–50× ≫ 2×**.

**Control falsifiers (AC4/AC5).** AC4: swap `hotspotNode = argmax dot(centroid)` for random node picks
(decouple edifice + swell centres from the plume field), amplitude-matched — the arm's-length predictor is a
BFS falloff from the *published centroids*, so decoupled placement collapses `corr(U_control, plume-proximity)`
and breaks the ordering, while the real field passes AC2. AC5: `corr(U, independent amplitude-matched simplex)
< 0.15` because `U` is organized by discrete plume tops + a coherent basin, not broadband noise (the detail
term is tiny).

---

## 7. Normalization into `MAGMA_BOUND`

Three guarantees; **no global rescale** (a rescale would couple the three populations and could invert the
ordering — the constants are chosen so none is needed):

1. **Constant budget (bounded by construction).**
   `U_max = MAGMA_BASE + SWELL_GAIN + EDIFICE_HEIGHT·maxShield + DETAIL_AMP = 0.05 + 0.25 + 1.0·0.79 + 0.02
   = 1.11`. `U_min = MAGMA_BASE − BASIN_DEPTH = 0.05 − 2.0 = −1.95` (caldera/apron are shallower and interior).
   So `|U| ≤ 1.95 < MAGMA_BOUND = 4` — the same generous guard as `plates U_BOUND` / `shell SHELL_BOUND`,
   with ~2× headroom (survives ~2× amplitude sweeps of the headless `tune`).
2. **Pre-relax safety clamp** `U[i] = clamp(±(MAGMA_BOUND−1e-3), U_raw[i])` so AC1 `|U| < MAGMA_BOUND` holds
   even if a `tune` sweep pushes constants to extremes. Never fires in production (production passes no `tune`).
3. **Relax cannot expand the bound.** The fixed `RELAX_PASSES` Jacobi is the verbatim plates/shell
   double-buffered convex combination `buf = U·0.5 + mean(self+nbrs)·0.5`; a convex average of in-bound values
   stays in-bound.

---

## 8. Determinism / render-once (AC1)

- **Only `alea('magma:*'+seed)` draws**, disjoint `'magma:'` namespace (`count`/`centroid`/`warp`/`detail`/
  `substellar` from SLICE A + new `strength` + `wrinkle`). **No `Math.random` / no `Date.now`** anywhere,
  incl. helpers. `T_ss`/`locked` are threaded params, not entropy.
- **Render-once:** O(N) multi-source BFS (each node enqueued once) + fixed `RELAX_PASSES` Jacobi; **no
  convergence while-loop.** The flood datum is analytic mean/std (**no sort, no percentile, no watershed**).
- `writeMagmatismSphere` run twice on a fresh carrier ⇒ **byte-identical** `U`, `plumeId`,
  `hotspotProximity`, `edificeMask`, `lavaPlainMask`, `magmaOceanMask` for every `(seed, T_ss)`.
- Copy the vec3 helpers + `meanEdgeAngle` **verbatim** into `magmatism.js` (plates.js/shellRelief.js/
  tectonic.js are out-of-scope to edit — no cross-imports), matching the contract.

**Diagnostics returned** (extends the SLICE-A object): `{ U, plumeId, plumeCount, hotspotNode,
hotspotProximity, nearestPlume, substellarAxis, centroids, meanEdgeAngle, relaxPasses, edificeMask,
lavaPlainMask, magmaOceanMask, A_e, Psi_e, thetaSea, D_flood }`. `A_e`/`Psi_e` give the probe per-plume
strength; `thetaSea`/`D_flood` are the pinned scalars for the arm's-length probe and the AC9 basin-width check.

---

## 9. Surviving citations (only claims that passed a skeptic's `survivingCitations`; confidence per-claim)

**Shield / edifice morphology**
1. **Shield volcanoes are broad, gently-sloping edifices (flanks ~2–10°) built from low-viscosity basalt;
   Mauna Loa is the type example** — grounds the broad low-slope `(1−r)^1.5` shield body.
   *NPS, "Shield Volcanoes"* — `https://www.nps.gov/articles/000/shield-volcanoes.htm`. **HIGH.**
2. **Olympus Mons: basaltic shield ~600 km diameter, ~22 km high, average flank slope ~5°, summit caldera
   complex** — grounds the shield aspect ratio + the summit caldera.
   *Plescia (2004), "Morphometric properties of Martian volcanoes," JGR Planets 109, E03003,
   DOI 10.1029/2002JE002031.* **HIGH.**
3. **Paterae on Io are volcano-tectonic caldera-like depressions (mean diameter 41.0 km), the main sites of
   effusive mafic-to-ultramafic lava** — grounds the summit-caldera/patera dimple on a low shield for the Io
   case. *Radebaugh et al. (2001), "Paterae on Io: A new type of volcanic caldera?", JGR Planets 106(E12)
   33005, DOI 10.1029/2000JE001406.* **HIGH.** *(Only the confirmed 41.0 km + caldera-like + effusive-mafic
   facts are used; the "8% atop shields / 220 km max" sub-claims a skeptic could not confirm are dropped.)*

**Effusive lava plains (the flood datum)**
4. **Io's surface is dominated by volcanic plains (65.8%) + lava flow fields (28.5%) — ~94% resurfaced,
   mountains only 3.2%** — grounds effusive plains as the dominant low-terrain population between sparse
   edifices. *Williams et al. (2011), "Volcanism on Io: New insights from global geologic mapping,"
   Icarus 214(1) 91–112.* **HIGH.**
5. **Continental flood basalts emplaced as inflated compound pahoehoe sheet flows spreading into extensive,
   low-relief flat plains that bury pre-existing topography** — grounds the fill-to-datum flat plain.
   *Self et al. (1997), "Emplacement of Continental Flood Basalt Lava Flows," AGU Geophys. Monograph 100,
   381–410, DOI 10.1029/GM100p0381.* **HIGH.**
6. **Lunar maria are flat, dark, low-lying basaltic plains formed by lava flooding the lows of impact basins;
   they sit below the highlands** — grounds inter-edifice lows below a datum flooding to a low flat plain.
   *Head (1976), "Lunar volcanism in space and time," Reviews of Geophysics 14(2) 265–300,
   DOI 10.1029/RG014i002p00265.* **HIGH.**

**Flexural moat**
7. **A large volcanic load flexes the lithosphere into a peripheral moat (with an outer arch) around the
   edifice** — grounds the negative-Gaussian basal apron/moat ring. *Walcott (1970), "Flexure of the
   lithosphere at Hawaii," Tectonophysics 9(5) 435–446.* **HIGH.**

**Substellar magma ocean (the basin extent + depth law)**
8. **On a tidally-locked lava planet the dayside surface temperature follows local radiative equilibrium
   `T(theta) = T_ss·cos^(1/4)(theta)`, producing a hemispheric substellar magma ocean bounded by the melt
   iso-angle** — grounds `theta_sea = acos((T_liq/T_ss)^4)` and the basin depth-vs-superheat profile
   (identical to F41). *Castan & Menou (2011), "Atmospheres of Hot Super-Earths," ApJL 743 L36,
   DOI 10.1088/2041-8205/743/2/L36.* **HIGH.**
9. **K2-141b has a dayside magma ocean over a solid nightside (substellar ~3000 K), the shoreline set by the
   surface-temperature falloff** — grounds the K2-141b substellar basin. *Nguyen et al. (2020), "Modelling the
   atmosphere of lava planet K2-141b," MNRAS 499(4) 4605–4612, DOI 10.1093/mnras/staa2487.* **HIGH.**
   *(The unsupported "200–300 km ocean thickness" rider a skeptic flagged is dropped.)*
10. **Deep two-phase hemispherical magma ocean: dayside surface ~3000 K at the substellar point down to
    ~1500 K near the terminator, shoreline set by the surface-temperature falloff** — corroborates the
    cos^(1/4) shoreline. *Boukare, Cowan & Badro (2022), "Deep Two-phase, Hemispherical Magma Oceans on Lava
    Planets," ApJ 936, 148 (arXiv:2205.02864).* **HIGH.** *(Attribution corrected — candidates mislabeled this
    "Kang et al." / "Kite/Fegley"; the DOI/title are for Boukare, Cowan & Badro.)*
11. **Dry peridotite solidus at surface pressure ~1120 °C (~1390 K)** — the F41/basin 1300 K working liquidus
    sits in this near-surface solidus range, so it is a defensible working value, not exact. *Hirschmann
    (2000), "Mantle solidus," G-cubed 1, 2000GC000070, DOI 10.1029/2000GC000070.* **MEDIUM** (marked so
    because 1300 K is a working stand-in, not a measured liquidus).

**Repo single-source-of-truth (verified against the files)**
12. **F7 `edificeProfile`** `pow(1−r, mix(1.5,4,shieldStratoMix))` + summit caldera `0.5*(s²−1)`, zero for
    `r≥1` (`planet-lod-height.glsl.js:2218-2230`); **F8 `lavaCombiner`** flood-and-flatten `h*=(1−region)`
    (`:2265-2289`); **F41 magma-sea** `theta_sea = acos((1300/T_ss)^4)`, `T(theta)=T_ss·cos^(1/4)(theta)`,
    `T_ss=T_eq·1.4` on locked worlds (`planet-lod-lab.html:3617-3622`, `:1126`). The shield body, the
    flood-and-flatten intent, and the iso-angle + temperature law are adopted **verbatim**. **HIGH.**

**Dropped as unverified/refuted (do not cite):**
- *"Kang et al. (2022), ApJ 934"* — misattributed; the DOI/title are **Boukare, Cowan & Badro (2022), ApJ 936, 148** (now #10).
- *"Kite/Fegley-style, arXiv:2205.02864"* — same paper, wrong attribution; corrected to Boukare et al.
- *"Schaber 1986, Topographic evidence for shield volcanism on Io"* — misattributed (the paper is Moore et al. 1986); the patera facts are covered by Radebaugh 2001 (#3), so dropped.
- *K2-141b "T_ss ≈ 3038 K"* specific value — not locatable in the cited source; use ~3000 K (Boukare/Nguyen) and the shader's 2800 K working value.
- *Hamilton et al. (2013), EPSL 361* summarized as Io hotspots "≈ random/uniform" — **inverts** the paper's finding (Io volcanism is *concentrated/offset* from tidal-heating predictions); dropped (the mechanism uses seeded-random plumes and makes no claim about Io's real distribution).
- *"Crown, Greeley et al., Geologic Map of Io" + "~40% plains"* — unconfirmed attribution/figure; superseded by Williams et al. 2011 (#4) with exact figures.
- Nguyen "200–300 km ocean thickness" rider — unsupported and contradicts Boukare; dropped.

---

## 10. Open Max look-tuning decisions (recommended default in **bold**)

1. **Basin depth `BASIN_DEPTH` (2.0).** Sets how deep the magma sea reads vs the shields. **Recommended 2.0**
   (basin center at U=−1.95, ~2.5× the tallest shield rim — an unmistakable "lowest ground" read; the ordering
   proof holds for any `BASIN_DEPTH ≥ ~0.3`). Lower it toward 1.0 if the basin looks like a bottomless pit at
   distance-20; raise toward 3.0 for a more dramatic molten pit.
2. **Swell strength `SWELL_GAIN` (0.25).** The broad hotspot dome. **Recommended 0.25** — it is the AC2
   correlation workhorse; the only empirical risk point is the locked-Magma case, whose wide basin excises
   ~48% of nodes from the correlation. If a headless seed dips below `|corr|=0.5`, **raise `SWELL_GAIN`
   (0.25→0.35), never deepen the basin** (a deeper basin does not help the plume correlation and could
   over-flatten the province read).
3. **Shield breadth `SHIELD_MIX_BASE/SPAN` (0.10 / 0.30 ⇒ p∈[1.75,2.5]).** **Recommended broad** (Io/Hawaiian
   basaltic shields). Push `SHIELD_MIX_BASE` up if Max wants some steeper strato-like cones in the mix for
   silhouette variety; keep it low for the effusive-basalt look the presets target.
4. **Flood aggressiveness `FLOOD_Z` (0.25).** Higher `FLOOD_Z` ⇒ a lower datum ⇒ *less* area floods (only the
   deepest lows pond); lower ⇒ *more* of the province floods to plain. **Recommended 0.25** (floods the clear
   inter-province lows, leaves the province flanks as quiet terrain — the mare-between-highlands read).
5. **Edifice count/size** come from SLICE-A `PLUME_COUNT_*` (5–11 plumes) and `EDIFICE_RADIUS_*`
   (0.10–0.26 rad). **Recommended as-is.** If Io should read "busier," raise `PLUME_COUNT_MIN`; these are the
   driver-response seam (deferred — plume count/strength will later come from tidal-heating, as `plates.js`
   deferred its count).

> **Deliberate non-goals (record-build-intent):** driver-RESPONSE (`T_ss`, plume strengths, count are
> seed-only/threaded stand-ins for the D7-lock / tidal-heating derivation the next increment supplies via the
> `tune`/drivers seam); Venus #4b stagnant-lid; Mars stagnant-lid-rocky; wiring the writer to the F7/F41
> shaders (lab-only carrier-assessment view — the writer authors the complementary carrier geometry, not the
> shading). No 4th `carrier.regime` constant (verify.js:39 asserts {0,1,2}).
>
> **Edifice SHAPE naturalism — deferred, NOT final (added 2026-07-01 from Max's #4a UAT; this section
> previously omitted it).** The `(1-r)^p` shield is **isotropic and circular by construction** (the only shape
> variable is radial geodesic `r`); per-plume `A_e`/`Psi_e`/`p_exp` jitter *scales* the circle, it never
> *deforms* it. That circular dome is the skeleton, not the intended final look. **Grain-aligned / fissure
> asymmetry** (elongate along the E6 `grainAngle`/fault field) and **plume size/count from thermal history**
> (so the field isn't "one giant + arbitrary smaller ones") are the E7 MULTIPLY pass → **increment
> `#4-MULTIPLY`** (mirrors #2). Flank-collapse/roughness/weathering → **#7 + #8/E8b**. The `grainAngle` field
> is already available on the carrier (contract inputs) but is NOT read this increment. See the ROADMAP
> `#4-MULTIPLY` planning note.
