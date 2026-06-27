# SLICE B — pinned stress-field math (the resolved MUST-FIX #1)

**Provenance:** research workflow `wccpy01ez` (web-grounded: Melosh 1977; Beuthe 2010 arXiv:1006.5818 eqs.90-91/171-172; Beuthe 2016 membrane eq.146; Hoppa et al. 1999b; Greenberg et al. 2002) **+ 3 adversarial skeptics**, all high-confidence. The skeptics found 3 load-bearing corrections (below) — the closed forms here are the CORRECTED versions. This resolves contract MUST-FIX #1; it is the spec SLICE B builds STEP 1 / STEP 3 / STEP 4 from.

> Convention everywhere: **TENSILE-POSITIVE** (Beuthe). `sigma1 > 0` = tension. The despin closed form folds E, Δf, etc. into one seeded positive scalar; diurnal folds `(n²R/g)·e` and the Love numbers into one seeded scalar.

## The 3 skeptic corrections (do NOT regress these)

1. **Despin most-tensile axis = MERIDIONAL (θ̂) at EVERY latitude.** `σ_θ − σ_φ = ((3μ+5) − (9μ−1))/6 = (1−μ)·... = 2·sin²θ ≥ 0`, zero only AT the pole (μ=cos2θ). The earlier "azimuthal dominates near the pole" was FALSE (contradicted Melosh eq.21 + Beuthe §5.3). Polar tension cracks strike **E-W** because the meridional **N-S** tension opens them; equatorial belt is strike-slip (~60° from N) because σ_φ is strongly compressive there. *(Numeric code path that diagonalizes the summed tensor is fine; this matters only if you hand-pick the steering axis.)*
2. **Diurnal coefficients must be NON-DEGENERATE.** With `b1=b2=g1=g2=g3=1`, `σ_tt ≡ σ_pp` ⇒ the principal axis SNAPS between ±45° ⇒ no curving cycloids. Use the **Europa elastic-limit `A=2`** set (Beuthe eqs.63-66): `(b1,b2)=(A+3,A−3)=(5,−1)`, `(g1,g2)=(A−1,A+1)=(1,3)`, `g3=1`, `f=1`. Then `σ_tt ≠ σ_pp` and the axis rotates smoothly over phase.
3. **Diagonalization: build the eigenvector DIRECTLY** (immune to the atan2 sign-convention traps). The formula `θ=0.5·atan2(2b,a−c)` is correct, but the trap descriptions were wrong and a denominator flip is a *reflection* the Rayleigh guard won't catch. Use: `v = normalize([b, λ_max − a])` (isotropic fallback when `|b|` and `|a−c|` both `< eps`); `theta_traj = atan2(λ_max − a, b)` in the {east,north} frame. Also: use the **ANALYTIC** `STRESS_REF` (resolution-independent), not the empirical max-reduction (which drifts between the 600-node and 40k meshes and would desync AC2 headless vs AC10 live).

Lesser notes: diurnal rotation-sense LABEL is **CCW in N hemisphere, CW in S** (Hoppa 1999b) — geometry (the `cos θ` sign flip across the equator) is already right, only the concavity/label convention swaps. Acceptance observable: *cycloids growing E→W are concave toward the equator; W→E concave toward the pole.* Render-once spatial steering at a frozen phase = a cycloid-LIKE visual analog, not a time-traced Hoppa cycloid (acceptable; don't oversell).

## STEP 1a — DESPIN tensor (about seeded paleo-axis w0), in {θ̂_w, φ̂_w} frame
```
theta_w = angle(d, w0)            // colatitude about w0
mu      = cos(2*theta_w)
A_despin = DESPIN_REF * (0.6 + 0.8 * alea('shell:despin:'+seed)())   // seeded positive amplitude
sigma_theta_despin = A_despin * (3*mu + 5) / 6     // MERIDIONAL  — bracket [2,8], tensile everywhere, max at poles
sigma_phi_despin   = A_despin * (9*mu - 1) / 6     // AZIMUTHAL   — bracket [-10,8], compressive in equatorial belt, sign flip at |paleo-lat| 48.2° (colat 41.81°, nu-independent)
// diagonal in {theta_hat_w, phi_hat_w}: no shear. theta_hat_w is the most-tensile axis everywhere.
```
The 3/2 prefactor difference vs Beuthe's `/4` brackets is absorbed into `A_despin` (shape/sign/ratio/critical-lat all preserved).

## STEP 1b — DIURNAL tensor (about seeded tidal axis t_hat, frozen phase wt=phi0), in {θ̂_t, φ̂_t}
```
theta_t = angle(d, t_hat);  phi_t = longitude of d about t_hat
c2t = cos(2*theta_t); ct = cos(theta_t); c2p = cos(2*phi_t); s2p = sin(2*phi_t)
A=2 -> b1=5, b2=-1, g1=1, g2=3, g3=1, f=1
K = A_diur                          // folds (n^2 R/g)*e + Love/rigidity; seeded per regime
// Re{ Z * e^{i wt} } = X*cos(wt) - Y*sin(wt):
X_tt = -(b1 + 3*g1*c2t) + 3*c2p*(b1 - g1*c2t);   Y_tt = -4*f*s2p*(b1 - g1*c2t)
X_pp = -(b2 + 3*g2*c2t) + 3*c2p*(b2 - g2*c2t);   Y_pp = -4*f*s2p*(b2 - g2*c2t)
X_tp = g3*ct*3*s2p;                               Y_tp = g3*ct*4*f*c2p
sigma_tt =  (3/4)*K * (X_tt*cos(phi0) - Y_tt*sin(phi0))
sigma_pp =  (3/4)*K * (X_pp*cos(phi0) - Y_pp*sin(phi0))
sigma_tp =  (-3)*K  * (X_tp*cos(phi0) - Y_tp*sin(phi0))   // nonzero shear -> smooth principal-axis rotation -> cycloids
```

## STEP 1c — sum + rotate + diagonalize (in {east,north} = carrier.tangentFrameAt(i))
```
// rotate each 2x2 from its source frame ({theta_w,phi_w} or {theta_t,phi_t}) into {east,north} via R(psi)^T M R(psi),
// where psi = signed angle from the source frame's first axis to `east`. Sum component-wise:
a = sigma_ee = w_despin*... + w_diur*...   // east-east
b = sigma_en = w_despin*0   + w_diur*...   // east-north (despin contributes 0 shear in ITS frame, but rotation into {e,n} mixes)
c = sigma_nn = ...
lam_max = (a+c)/2 + sqrt(((a-c)/2)^2 + b^2)   // = sigma1 (SIGNED)
// robust eigenvector (skeptic-3 fix):
if (|b| < eps && |a-c| < eps) theta_traj = 0           // isotropic fallback
else theta_traj = atan2(lam_max - a, b)                 // most-tensile axis in {east,north}
STRESS_REF = w_despin*A_despin*(10/6) + w_diur*A_diur*DIUR_PEAK     // ANALYTIC, resolution-independent
sigma1_n = clamp(-1, 1, lam_max / STRESS_REF)
```
Per-regime weights `w_despin/w_diur` = the REGIME_WEIGHTS DESPIN_W/DIURNAL_W already in shellRelief.js.
Store `sigma1_n -> stressTensile[i]`; `theta_traj -> thetaTraj[i] -> carrier.grainAngle`.

## STEP 3 — steered lineaments + crest rule + double-ridge cross-section
```
// steer the ridged field so ridge LINES run PERPENDICULAR to the most-tensile axis (a tension crack strikes
// perpendicular to the most-tensile stress). Pass crack-strike angle = theta_traj + PI/2 to the copied steeredNoise3
// (ridged=true). VERIFY against the despin acceptance check: eyeball/despin must give polar E-W cracks.
R[i] = normalize01( steeredNoise3(ridgeNoise, d, east, north, theta_traj + PI/2, /*ridged*/true, RIDGE_FREQ) )
lineamentNode[i] = (R[i] > CREST_THRESH) && (sigma1_n[i] > TENSILE_THRESH)   // ABSOLUTE threshold, NOT local-max (order/resolution-independent)
// analytic DOUBLE-RIDGE cross-section as f(closeness-to-crest t): central trough + two shoulders -> U oscillates ACROSS the ridge (defeats AC4 "tilted band" fake)
t = clamp01((R[i] - CREST_THRESH) / (1 - CREST_THRESH))     // 0 at edge, 1 at crest center
doubleRidge = (SHOULDER_HT * 4*t*(1-t)) - (TROUGH_DEPTH * smoothstep(0.6, 1.0, t))
lineamentRelief = (W.DESPIN_W + W.DIURNAL_W) * RIDGE_AMP * max(0, sigma1_n[i]) * doubleRidge   // gated by tension
```

## STEP 4 — chaos overlay (CHAOS_W>0 only; cell interiors, high tension)
```
chaosMask[i] = W.CHAOS_W * smoothstep(0, 1, cellInteriorness[i] * max(0, sigma1_n[i] - CHAOS_THRESH) / (1 - CHAOS_THRESH))
chaosRelief  = chaosMask[i] * (CHAOS_BASE + CHAOS_AMP * chaosNoise(d * CHAOS_FREQ))   // foundered blocks below + raised matrix
```

## STEP 5 — assemble (REPLACES the SLICE A placeholder U)
```
U[i] = SHELL_BASE + lineamentRelief + chaosRelief + DETAIL_AMP*detailNoise(d*DETAIL_FREQ)
carrier.height.set(U); bounded RELAX_PASSES Jacobi; carrier.grainAngle.set(thetaTraj); faultDensity = clamp01(|sigma1_n|)
```

## Constants to add to SHELL_DEFAULTS (locked; swept against AC2, like plates DEFAULTS)
`DESPIN_REF`, `DIUR_REF` (seed amplitude scales), `DIUR_PEAK` (analytic-STRESS_REF peak constant), `TENSILE_THRESH≈0.05`, `CHAOS_THRESH≈0.6`, `CREST_THRESH≈0.62`, `RIDGE_FREQ`, `RIDGE_AMP`, `SHOULDER_HT`, `TROUGH_DEPTH`, `CHAOS_BASE`, `CHAOS_AMP`, `CHAOS_FREQ`. Distinct `'shell:despin:'`/`'shell:diur:'` alea draws for the seeded amplitudes.

## Acceptance cross-checks (beyond the contract ACs)
- **Despin sign/geometry:** eyeball-despun → cracks strike E-W in the polar caps about w0 (meridional N-S tension). Confirms the steering ±90° is correct.
- **Cycloid concavity:** arcs growing E→W concave toward the (tidal) equator; W→E concave toward the pole (same both hemispheres).
- **Critical latitude:** σ_φ sign change at |paleo-lat| 48.2°.
