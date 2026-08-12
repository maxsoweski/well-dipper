# ORRERY orbit rings — the OVER-PAINT defect: scope, options, and the ruling it needs

**Status: OPEN, scoped, not fixed. Recommendation: FIX — but the fix's visible signature is a *thinner* line, and that is Max's ruling before it lands.**
**Written 2026-08-12 against `feature/world-engine-production-L1` @ `e225d0b`. Companion to `docs/FEATURES/orbit-ring-depth-artefact.md`, whose §10 named this as the thing that caps the pass.**

---

## 0. THE ANSWER TO THE FIRST QUESTION — is it visible?

**Yes as ink, no as a symptom anyone has reported — and that distinction is the whole shape of this project.**

The over-painted pixels are *not* faint. 54.3% of them carry band alpha ≥ 0.95 and 46.4% land in composited alpha [0.80, 0.95) — the same mode as the legitimate line — and they are 34.4% of every alpha this pass writes. But they are not a stray structure: every single one sits within 4 px (Chebyshev) of a genuinely-covered pixel, 88.6% of them within 1 px, none isolated. **What they look like is the orbit line drawn at about twice its intended width whenever a ring goes edge-on.** Nobody has complained about that, and §8's live A/B confirmed the visible stray-line class was already removed.

So the reason to do this is **not** appearance. It is this, which I measured and no lane had:

- **100% of over-painted pixels take the depth fallback** — 0 of 36,786 has a covering root, structurally, so the §10 depth rule can only ever guess there.
- On the 35-pose battery the depth fallback fires on **19,038 of 52,834 painted pixels (36.0%), and 18,724 of those 19,038 (98.4%) *are* the over-paint.** Remove it and the fallback goes to **2.5%**.
- **The residual leak class §10 names — "every one a pixel whose nearest in-front circle point is 1.485–1.500 px away" — is entirely over-paint, and the recommended fix removes 100% of it.** 48 px in that exact window in my battery, 0 survive; 598 px at dFront ≥ 1.485, 0 survive; the worst dFront the fix keeps is 1.4066.

That last line is the traceability: over-paint → the depth rule's fallback → the 22–24 px of green still drawn through a planet, which is Max's original sentence. **This is a correctness fix wearing a cosmetic disguise, not a cosmetic fix.**

⛔ **And the cost is not free and not deferrable:** the over-paint *is* the extra width, so removing it takes **−40.8% of the ink at Max's own repro pose (4 painted rows → 2)** and **−66.7% at exactly edge-on (3 rows → 1)**. Max ruled on the neighbouring case in `d7db3a3` — *"I do not want the lines to disappear when you get close."* This is thinning, not vanishing, but it is close enough that no agent should land it on its own authority.

**Not WONTFIX.** But do not start by writing the shader.

---

## 1. WHAT IT IS

One fullscreen pass (`src/objects/OrbitConicField.js`, `CONIC_FRAGMENT_SHADER`) paints every orbit ring. A pixel is painted when its **Sampson distance** to the ring's projected conic `Cs` is inside a band:

```
distPx = |pᵀCs p| / |2(Cs p).xy|
band   = 1 − smoothstep(uPixelWidth*0.5, uPixelWidth*0.5 + uFeatherPx, distPx)
if (band < 0.01) continue;              // OrbitConicField.js:266–269
```

At shipping defaults (`pixelWidth 1.0`, `featherPx 0.5`) that band's **reach** — the largest Sampson distance that still paints — is `pw*0.5 + f*0.941096864` = **0.970548 px**.

**Definition used throughout this document.** A painted `(pixel, ring)` contribution is **OVER-PAINTED** when there is **no point of the ring circle, in front of the camera, within 0.970548 px of the pixel centre**. It is ink where the ring is not.

### The measurements

| | |
|---|---|
| over-painted contributions | **36,786 of 91,183 = 40.3%** (118 poses) |
| share of all alpha written | **34.40%** |
| band alpha ≥ 0.95 | **54.3%** of the over-painted set (legit set: 79.6%) |
| composited alpha in [0.80, 0.95) | **46.4%**; only 4.9% below 0.05 |
| distance from a legitimate pixel | 1 px → 32,603 · 2 px → 3,867 · 3–4 px → 13 · beyond 4 → **0** · isolated → **0** |
| true in-front arc distance | 45.6% in [reach, 1.10); 98.9% below 2.0; **zero beyond 3.0** |

Per pose (Instrument E's own fixtures): **P1 0% · P3 67.0% · P7 67.0% · P8 49.8% · P9 33.3%**; Max's grazing repro geometry **50.0%**. These match the figures §10 recorded (45.9 / 50.0 / 66.7 / 67.0) at every directly comparable cell.

Bounded above by construction, not luck: the §8 arc gate rejects `arc.x > uArcTolPx = 3.0`, and that closed form is an axis-**constrained** minimum so it can only overstate. Every painted pixel therefore has dFront ≤ 3.0, and the over-painted set can never be more than a rim ~2.03 px wider than the band's reach.

### Root cause: a factor of exactly two

`Cs = adj(H)ᵀ·diag(1,1,−R²)·adj(H)`. As the camera nears a ring's plane `adj(H)` collapses to rank 1, `adj(H) ≈ u·vᵀ`, so `Cs ≈ k·v·vᵀ` — a **double line**. Then

```
pᵀCs p = k(vᵀp)²      |2(Cs p).xy| = 2|k||vᵀp|·|v.xy|
⇒ Sampson = |vᵀp| / (2|v.xy|) = EXACTLY HALF the true distance to that line.
```

Sampson is a **first-order** estimate; a double line is precisely where the second-order term is the entire function. **Verified independently: 20,000 random `(k, v)` pairs give `Sampson/d_true ∈ [0.500000000, 0.500000005]`, constant in `k` to 9 digits.** So the band's effective reach at the degeneracy is **1.941 px, not 0.9705** — and the over-painted set is exactly the outer half of that doubled band.

Measured on real poses: `d_true/Sampson ∈ [1.9, 2.1)` on 59.7% of the over-painted set. At **P7** `det(Cs) = 0.000e+0` exactly and rows 141/143 read Sampson **0.49964** against a true distance of **1.0050**.

### Why the band accepts them — three classes, not one

| | count | share | ink |
|---|---|---|---|
| **Sampson first-order error** — the conic's zero set really is beyond reach | 31,158 | **84.7%** | 16,639 |
| **back branch** — a real point of the projected circle is within reach, but *behind the camera* | 5,590 | **15.2%** | 4,156 |
| degenerate component — on the `Cs` zero set but on no circle point | 38 | 0.1% | 27 |

These are different geometry and one rule need not serve both. The back-branch class is the *brightest* (78.2% at band ≥ 0.95) and in my battery it is concentrated at one pose (P9-straddle-in-plane, 557 px, all at dFront 1.36–1.39 — i.e. **below** the 1.485 leak threshold, so it carries none of the correctness payload).

### The anatomy, at one pose

**P3-edgeon-bounded.** The true in-front arc lies at `y ∈ [142.490, 142.504]`. The band's design intent — reach 0.9705, a 1.941 px window — is **2 rows generically, 1 at the knife edge**. It paints **3**, 211 px each: row 142 at dFront 0.000–1.146 (legitimate) and rows 141/143 at dFront 0.990–1.523, over-painted by a margin of **0.0295 px**.

### ⭐ A precision finding that constrains every option

At **exactly** edge-on, the ring's own row is a genuine `0/0`. Measured at P7 pixel (278.5, 142.5): `pᵀCs p = −3.5237e-8`, `|grad| = 2.0373e-10`.

| | float64 | float32 (what ships) |
|---|---|---|
| Sampson | 172.96 → band 0 | **0.00000 → band 1** |
| row 142 pixels passing the band | **0 / 557** | **557 / 557** |

Instrument E records 633 px / 3 rows at P7, which only the float32 branch produces. **At exactly edge-on the ring is visible at all because a `0/0` rounds to zero.** Today that does not matter — the two over-painted flanking rows paint regardless, so the line survives either way. **After any over-paint removal the edge-on line IS that single row, and its existence rests on a rounding accident.** This applies to *every* option below, not just the recommended one, and it is the sharpest `d7db3a3` exposure in this file.

---

## 2. WHY IT MATTERS (and the honest limit of that)

**Visual.** A ring's drawn line width is currently a function of how edge-on it is: ~1 px face-on, 3 px exactly edge-on, at full opacity throughout. At `pixelScale 3` that is 9 CSS px of full-brightness green where 3 belongs, on every edge-on / thin-ellipse / grazing approach. That is a defect against any reading where alpha means coverage — but it is not a reported symptom, and it may read as a feature ("a ring compressing to edge-on gets heavier").

**Correctness — this is the real case.** Measured, on the 35-pose battery:

| | shipped | after the recommended fix |
|---|---|---|
| depth-rule FALLBACK rate | **19,038 / 52,834 = 36.0%** | **877 / 34,647 = 2.5%** |
| of which are over-paint | 18,724 = **98.4%** | — |
| §10's residual-leak class, dFront ∈ [1.485, 1.500] | 48 px | **0** |
| all painted px at dFront ≥ 1.485 | 598 px | **0** |

The §10 depth rule is doing the best available thing on those pixels — written `w` is within 1% of the true `w` of the nearest in-front circle point on 98.5% of them — but it is depth-sorting ink that is not the ring, which is exactly how it survives over a planet limb.

**What it caps.** §10 shipped the depth fix and closed with *"45.9% of painted pixels have NO in-front ring point within the band's reach at all … it bounds what this pass can achieve."* That bound is quantified above: **the pass cannot get its fallback rate below ~36% without this, and it cannot remove the named residual leaks at all.**

**What it does NOT buy.** No occluder was in any scene in any lane, so §9's **pair metric** (`LEAK` = ring behind the body drawn in front; `OVER-OCCLUDE` = ring in front drawn behind) is **not scored for any option here**. Every number in this document is coverage and ink. §9's ruling is that a candidate scored on one half of the pair is not scored.

---

## 3. WHAT IS ALREADY KNOWN — read this before writing anything

### The rulings

- ⛔ **`d7db3a3` — Max: "I do not want the lines to disappear when you get close."** A fix that reduces over-paint by thinning or shortening *legitimate* line is REFUSED, not traded. Every candidate below changes the line's *weight*; that is what needs his ruling.
- ⛔ **`d0b5170`'s carve-out** — a ring the camera is inside genuinely projects unbounded, so its extent AABB is deliberately the `±1e30` sentinel. Any plan that leans on the AABB as a filter is dead in exactly the regime this artefact lives in.
- ⭐ **§9's metric ruling** — score the PAIR. Over-paint removal that costs legitimate ink is the same class of mistake this file has made four times.

### The gates any change must pass

| instrument | what it is | current state |
|---|---|---|
| **Instrument E** — `npm run check:conic-gl` (`tools/conic-gl-gate.mjs`) | Compiles the **shipped GLSL string** in real WebGL2 (headless Chrome/ANGLE), 22 mutants × 9 fixtures, reads back RGBA32F **and** a depth texture. | **22/22 killed at HEAD** (predicted; see §7). ⚠ **Chrome cannot launch inside an agent sandbox** — `socket() failed: Operation not permitted`, no flag fixes it. Run from a normal terminal or with the sandbox disabled. |
| **Instrument A** — `npm run test:baseline` | Per-test-ID baseline over the whole vitest suite. | **69 tests green** in the four conic files at HEAD (re-executed). Changing a per-test-ID result requires re-blessing **by name** — precedent `1a3c1e3`. |

**Instrument E's M0 baselines at HEAD** (painted px / distinct rows / debris): P1 1114/2/0 · P2 638/56/0 · P3 633/3/422 · P4 656/72/0 · P5 432/61/0 · P6 1114/2/0 · P7 633/3/633 · P8 1343/285/0 · P9 1671/3/0.
**§8's headline that must not move: P1/P6 = 1114 px / 2 rows / 0 debris.**

**The 38 unit tests coupled to the current accept**, which will need re-blessing if it changes:
- `src/objects/__tests__/ringConic.frontarc.test.js` — **all ten**. `paintedByOldGates()` (lines 100–118) **is** the shipped accept chain mirrored in JS; f3/f4/f8/f9 assert against `TOL = arcTolerancePx(1.0,0.5) = 3.0`; f10 asserts the constant by construction.
- `src/objects/__tests__/ringConic.extent.test.js` — a6, a8, a9 and two of a12, 13 tests, all through `painted()` (line 89–93) whose `HALF_BAND` is **1.5** — already *not* the shader's 0.970548 reach, i.e. that mirror is one step stale **today**.
- `src/objects/__tests__/ringConic.test.js` a1/a2/a5 (14 tests) + `OrbitConicField.test.js` b4b — these pin `sampsonDistancePx` as the coverage notion.

### The traps — every one of these cost a lane real time

1. ⛔ **A uniform-θ sweep is not an oracle here.** At the artefact pose `n = 24000` lands **155 screen px** apart on the near arc and reports the far arc. Use algebraic root-finding on `|z| = 1` (Durand–Kerner on the degree-6 polynomial from a 16-point DFT), or adaptive subdivision on **screen chord** (~0.05 px).
2. ⛔ **The Weierstrass substitution `t = tan(θ/2)` silently loses roots** (pole at θ=π; roots at |t| ~ 1e7 at grazing).
3. ⛔ **An adaptive screen-chord polyline needs explicit breaks at `w → 0`.** Without them a straddling ring's two arc halves are joined by a spurious chord across the frame and every pixel it crosses fabricates as "covered". This was hit and fixed in this scoping round.
4. ⛔ **`planeRatio` / anything built on `adj(H)·p` is NOT ground truth** — it has a pole exactly on the vanishing line. Instrument E still reports it as `debris`/`worstPR`; that is fine as a *signal*, inadmissible as a label.
5. ⚠ **Reach is load-bearing, not a detail.** Report every number at **both** the band's reach (0.970548) and `uArcTolPx` (3.0). The sign of some comparisons moves between them.
6. ⚠ **The band must be float32-emulated in any CPU mirror** (`Math.fround` per operation, GLSL `dot` order). Trap 5's edge-on `0/0` means a float64 mirror reads 2 rows at P7 where the shader reads 3, and every kill-matrix prediction is then scored against the wrong baseline.
7. ⚠ **The conic math runs in RENDER-TARGET pixels (557×285 at `pixelScale 3`), not CSS pixels.** A probe in window coordinates is 3× off and y-flipped.
8. ⚠ **`resolveBody` ignores `index`** and silently resolves `p = 0`. Use `{kind:'planet', p:5}` / `{kind:'moon', p:5, m:2}`.
9. ⚠ **`uArcTolPx` is rewritten from the band knobs every frame** in `update()`. A plain assignment to the uniform is reverted before the next draw; redefine the property to A/B it, then restore.

### What is already in hand at the decision point

The pass already computes, per pixel per ring, the exact screen distance to the nearest **in-front** circle point (`frontArcSolve` / `ringConic.js frontArcDistPx`). The information needed to reject an over-painted pixel is already in a register. That is why several options below cost nothing extra in fetches.

### The floor on `uArcTolPx`, because two options turn on it

The worst `frontArcDistPx` on a pixel carrying **real** ring ink — the number that bounds how far the §8 gate can be tightened:

| source | value |
|---|---|
| the 636-pose battery quoted in §10's handover | **1.53560** |
| **Instrument A's own f8 `outside-edgeon` control** (in-repo, re-measured) | **1.52421** |
| a 235-pose lane battery | 1.40880 |

Treat **1.5356** as binding. **A gate at 1.45 already fails `npm test`.** And §10's residual leaks sit at **1.485–1.500** — *below* both credible floors. **No gate value separates the class the doc names from the worst legitimate pixel.**

---

## 4. THE OPTIONS

**Ranking criterion, stated so it can be disputed.** In order: (1) does it remove the pixels that cap the depth rule — i.e. the dFront ≥ 1.485 class; (2) legitimate ink lost *beyond* what removing the over-paint inherently costs, weighted by whether the loss is scattered or forms connected gaps; (3) does Instrument E still kill its mutants (this file's history is that an unwatched fix here gets refuted after landing, twice); (4) temporal stability, because the `b6` grazing flap is a known failure mode; (5) per-frame cost; (6) blast radius on shipped code and on Instrument A.

---

### ⭐ R1 — RECOMMENDED · THE SECOND-ORDER BAND, AS A REFINEMENT (+ recentred `Cs`)

**Mechanism.** Sampson measures `|Q(p)| / |∇Q(p)|` — the first-order Newton step to the conic. Restrict the conic to the line `p + t·n̂`, `n̂ = ∇Q/|∇Q|`: the restriction is an **exact quadratic**, `Q(p + t n̂) = a t² + b t + c` with `a = n̂ᵀCs₂ₓ₂n̂`, `b = |∇Q|`, `c = Q(p)`. **Sampson is precisely its `a → 0` limit.** Keep the smaller root in the numerically stable form:

```
d_exact = 2|c| / ( |∇Q| + sqrt(|∇Q|² − 4ac) )
```

Insert **after** `if (band < 0.01) continue;` (`OrbitConicField.js:269`) as a separate statement — the shipped Sampson block above it untouched:

```glsl
float aq   = 4.0 * (csR0.x*cp.x*cp.x + 2.0*csR0.y*cp.x*cp.y + csR1.y*cp.y*cp.y)
           / max(gmag*gmag, 1e-30);
float disc = max(gmag*gmag - 4.0*aq*vnum, 0.0);
distPx = 2.0 * abs(vnum) / max(gmag + sqrt(disc), 1e-12);
band   = 1.0 - smoothstep(uPixelWidth*0.5, uPixelWidth*0.5 + uFeatherPx, distPx);
if (band < 0.01) continue;
```

`csR0.x / csR0.y / csR1.y` are `Cs00 / Cs01 / Cs11`, already in registers from `t0`/`t1`. Mirror it in `ringConic.js` **beside** `sampsonDistancePx` — do not modify that function; 14 Instrument A tests pin it and it must stay live code.

Because it runs on the already-accepted set it is **monotone: it can only remove pixels, never add one.**

**Measured** (35 poses / 52,834 accepted pairs; every figure below re-executed for this scope):

| | |
|---|---|
| over-paint removed | **18,153 / 18,724 = 97.0%** — **99.9% of the reachable ceiling** |
| §10's residual-leak class (dFront ≥ 1.485) removed | **598 / 598 = 100%** |
| legitimate pairs lost | **34 = 0.10%**, *all* at band alpha ∈ [0.010, 0.0125) — ≤1% opacity — with **no connected runs at all** |
| legitimate ink kept | **98.7%** (it *rises* above 100% at 10 of 35 poses; on the concave side `d_exact < Sampson`) |
| pixels ADDED | **0**, by construction |
| depth fallback | **36.0% → 2.5%** |
| temporal (41-step camera-height sweep through edge-on) | worst frame-to-frame **ink** jump **0.4%** (shipped 0.0%; the hard-reject option 20.9–46.9%) |
| no-vanish (`d7db3a3`) | **0 of 35 poses** falls below 1% of baseline ink; worst-hit P7 at 33.3% |
| cost | **+0.56% mul+add, +1.27% div, +0.64% sqrt** at the worst framing. **Zero extra `texelFetch`, zero extra arc solves, zero uniforms, no DataTexture row moves.** 0.023 G(mul+add)/s at 60 fps — three orders of magnitude below accept-first. |
| Instrument E (CPU mirror) | **24/25 killed**; sole survivor M11 |

**Why it keeps the gate's mutants where every covering test loses five.** A covering/exact *accept* answers the extent question, the front-branch question and the arc-gate question all at once, so M3/M4/M12/M13 go vacuous. The correction answers **only the band's** question, so every other gate stays testable — and the Sampson block stays **live code**, so M2 (band ×4) and M5 (sampson-nograd) still mutate something the shader executes.

**Fixture movement** (painted px, A0 → R1): P1 1114→1114 · P2 638→632 · P3 633→**211** · P4 656→651 · P5 432→426 · P6 1114→1114 · P7 633→**211** · P8 1343→671 · P9 1671→1671. Seven of nine move and must be re-blessed by name. **P1/P6 hold at 1114 px / 2 rows / 0 debris — §8's headline survives.**

**M11 survives for a fixture reason, not a behaviour reason.** P5's second ring is R = 0.9 at camDist 33,941 — projected radius 0.0054 px, so the shipped angular fade already zeroes it; it paints 8 px *only* when M11 disables the fade, and it paints those 8 px *only* through Sampson's under-report. A measured replacement: a second ring of **R = 125** at the P5 camera projects to 0.750 px, `angularFade` 0.499, painting 16 px shipped → 8 px corrected — inside the fade band and still discriminating. (R = 160 also works.)

#### ⚠ THE ONE MEASUREMENT THAT REFUTES IT, AND ITS MEASURED MITIGATION

`disc = |∇Q|² − 4ac` is a **catastrophic cancellation**, and it cancels hardest exactly at the degeneracy where the correction does its work. Over all 52,834 painted pixels, `|alpha_f32 − alpha_f64|`:

| | err > 0.02 | worst | accept flips |
|---|---|---|---|
| SHIPPED Sampson | 2 (0.004%) | 1.0000 | **1** |
| R1 direct | 88 (0.167%) | 1.0000 | **226 (0.428%)** |
| SHIPPED + recentred | **0** | 0.0008 | **0** |
| **R1 + recentred** | 104 (0.197%) | **0.0689** | **6 (0.011%, all at alpha ≤ 0.05)** |

79 of the 88 are at P8 (thin **inclined** ellipse, d = 1.002R — §9's own regime), and the worst flip takes alpha 1.000 → 0.000: full-brightness pixels vanishing. That is a stipple risk in the one regime this file already knows is rounding-decided.

**It is a conditioning defect, not an algebraic one.** `Cs` is max-abs normalised but evaluated at raw render-pixel coordinates up to (557, 285), so `cx` must cancel from ~1e2 to ~1e-7 on the curve — 9 digits, and float32 has 7. **Recentring `Cs` on the screen centre** (`Cs′ = TᵀCs T`, nine CPU multiply-adds per ring per frame; one `vec2` subtract in the shader; no extra texel, since the origin is a constant already folded into `H`) turns catastrophic flips into small wobbles **and removes the shipped band's own two sensitive pixels as well.**

⚠ **Implementation constraint, measured:** in float64 the recentred and original conics disagree on **exactly one pixel out of 52,834** — `(278.5, 142.5)` at P8, which *is* the recentring origin and *is* a pixel centre (`gl_FragCoord` samples at `i+0.5`, and `W/2 = 278.5`, `H/2 = 142.5`). It is already a genuine `0/0` there. **Offset the origin by a quarter pixel** or accept that one pixel.

⇒ **Ship the recentring in the same commit.** It is the only measured refutation of R1 and this closes it.

#### What R1 does NOT fix

- **The back branch** — 557 px, 3.0% of the over-paint, at band alpha 0.887, all at one pose. Those pixels are genuinely within reach of the projected circle; the covering point is merely behind the camera. **No distance-to-the-conic rule can see them** — that is the measured ceiling, not a shortfall against it. They carry none of the §10 leak class.
- **14 px beyond the arc's ends** (2 each at P3/P7/C-outside-edgeon, 4 each at two scale rungs): the conic's zero set extends past the circle's image segment. Extent-margin class, untouched.
- **Pixels the shipped band wrongly DROPS.** Today's Sampson band rejects **4,750 of 39,209 genuinely covered pixels = 12.11%** — at the midline between the conic's two near-parallel branches `|∇Q|` vanishes and Sampson *diverges*. At Max's repro pose the shipped pass draws the line **one row off**: it paints a row that is not ring (dTrue 1.0000, alpha 0.5445) and drops a row that is (dTrue 0.7757, Sampson 3.4586, alpha 0). R1 runs downstream of the band, so it cannot recover them. R5 or R2 can.
- **The §9 pair.** No occluder anywhere.
- **The UAT question.** R1 commits the line's alpha to meaning "coverage of the projected curve" and makes the width uniform.

---

### R2 — ALPHA FROM A RENORMALISED TANGENT STEP ON THE ARC SOLVE

**Mechanism.** Each root of the §8 axis solve is already a point on the circle carrying its `(cos, sin)`. `dq/dθ` is free (the root's own `(X,Z)` swapped and negated). Take one tangent-guided step toward the pixel, **renormalise back onto the unit circle**, forward-project, and use that distance as the alpha's smoothstep argument. `arcFold` becomes a `vec4`; **the §8 gate (`arc.x`) and the §10 depth window (`arc.z`) stay byte-identical.**

**Why it is theoretically the best option here.** Because `cs1` is renormalised, `P(cs1)` is a genuine ring point *no matter how bad the step is*, so `d_refine ≥ d_true` **always**. Zero over-paint is a **theorem**, not a measurement (worst measured understatement 2.048e-10 px over 409,565 roots).

**Measured:** over-paint removed **100%** (including the back branch) · legitimate ink **104.8% of A0** — it *recovers* the 12.11% of covered pixels the band drops · coverage of the true covered set 87.04% → **98.71%** · **pixel-for-pixel and ink-for-ink identical to the exact algebraic oracle** (worst |d_refine − d_true| 0.0094 px) · depth fallback 36.1% → 0.8% · flicker 0.4% · zero extra `texelFetch`, ~2× the cost of `frontArcSolve`.

**⛔ Why it ranks below R1: it needs a prefilter, and both candidates are refuted.**
- **Sampson at K × reach is unboundable.** The same identity that produces the over-paint (`Sampson = |L1·L2| / |L1+L2|` for two branches at signed distances L1, L2) makes Sampson **diverge** at the midline. Measured over a 201-rung elevation sweep: worst `Sampson/reach` at a *genuinely covered* pixel is **30.68**, rising monotonically toward a singularity, 25 of 201 rungs above 4×. **There is no constant K.**
- **And a Sampson prefilter can make the edge-on ring VANISH.** At P7, of 18 single-ulp perturbations of the packed `Cs`, **8 drop the ring's own row at K = 1×, 8 at 4×, 8 at 10×, and 4 at 100× reach.** Unperturbed, 557/557 pass. That is the exact `d7db3a3` failure, introduced by a fix meant to be conservative.
- **The extent AABB is lossless but dead where it is needed:** for a straddling ring it is the `±1e30` sentinel (`d0b5170`) and admits the whole frame — 158,745 px at P1/P9/C-inside-*.
- ⛔ **The depth window must NOT be re-sourced from the refined distance.** If it is, 20,725 roots cross the covering window (`dAxis > reach ≥ dRefine`), 19,979 of them by more than 0.5 px, worst `dAxis − dRefine` = 6,286 px — against §10's measured headroom of **0.0292 px**. That recreates §9's refuted failure wholesale on 557 of 1114 px.

**Take R2 as the follow-on** if the back branch or the 12.11% dropped-coverage class turns out to matter, and only with a hybrid prefilter (AABB where `wMin > 0`, widened Sampson only at the sentinel) whose safety at the straddle poses is **unmeasured**.

---

### R3 — REQUIRE A COVERING ROOT (zero cost). **REFUTED on temporal stability + erosion shape.**

`wclip = arc.z < 1e30 ? arc.z : arc.y;` becomes `if (!(arc.z < 1e30)) continue;`. One comparison the shader already makes. Identical to setting `uArcTolPx` to the band's reach.

**Measured:** over-paint removed **100%, guaranteed** (the axis solve overstates, so a covering root implies a covering point). Cost **zero**. But: legitimate ink lost **0.92%**, and ⛔ **it is not scattered noise** — it is the √2 axis overstatement landing as **1–8 px connected GAPS on the diagonal segments of ordinary ellipses**: C-outside-high 24 px in 14 runs, P2 48 px in 30 runs, P4 84 px in 56 runs (8.6% of that pose's real pixels), P8 120 px in 120 single-px runs (17.8%). A stippled ellipse is a UAT question in its own right. And ⛔ **worst frame-to-frame ink jump 20.9–46.9%** on a camera-height sweep — a hard cut sitting on a 0.0295 px margin, which is the `b6` grazing-flap class the tie-break epsilon exists to kill. Instrument E **17/22**, survivors M3, M4, M11, M12, M13.

---

### R4 — TIGHTEN `uArcTolPx` (free rider, not a fix)

`ARC_TOLERANCE_MARGIN_PX: 2.0 → 0.55` (`src/objects/ringConic.js:123`), giving T = 1.55. No GLSL edit.

**Measured:** over-paint ink removed **9.0%** · legitimate px lost **0 at 235 poses** · max dTrue among painted 2.4428 → 1.5445 · px at dTrue ≥ 2.0: 57 → **0** · line weight at P3/P7 **unchanged** · cost **exactly zero** (identical band-pass / extent-pass / arc-solve counts) · temporal neutral.

⛔ **Three kills.** (a) It does not touch the defect — the over-paint is a rim at dTrue ≈ 1.0, and a gate can only cut above ~1.5; in the three regimes carrying 64% of all over-paint ink it removes 6.8–9.6%. (b) ⭐ **It costs Instrument E two mutants**: M3-drop-frontguard's entire remaining decisive coverage is 557 px at P9 at arc distance **2.3600–2.3877**, and M4-drop-extent's is 6 px each at P3/P7 at **2.1507–3.0**. `ARC_TOLERANCE_MARGIN_PX = 2.0` is not slack — it is the interval in which two other gates are still testable. The largest tightening that keeps 22/22 is **T = 2.36, worth 0.05%**. (c) It cannot remove §10's named class: that sits at 1.485–1.500, below the 1.52421 floor Instrument A's own f8 control already enforces.

⇒ **Worth taking as a rider on R1** — it bounds the worst surviving over-paint at 1.55 px instead of 2.44 px — never as the fix, and only alongside the two new fixtures M3/M4 would need.

---

### R5 — THE CORRECTION AS THE BAND'S ONLY ARGUMENT (R1 without the "refinement" placement)

Same 97.0% removal, but it **ADDS 4,582 pixels — all legitimate, none new over-paint** — because on the concave side `d_exact < Sampson`, and it is finite at the midline where Sampson diverges. So it fixes the one-row-off drop-out R1 cannot. **The line moves rather than only thinning**, which gives up the monotonicity that makes R1's blast radius provable, and it must be computed on every `(pixel, ring)` pair rather than the 0.5% the band accepts. **Not recommended before Max has ruled on line weight** — but note it, because it is the only option that is *more* line, not less, and if his ruling is "hold the weight" this is the honest way to hold it.

---

### DEAD — do not re-derive these

| | why |
|---|---|
| **Narrow the band** (`pw 0.5 / f 0.25`) | 66,298 legitimate px lost; **7 poses erased**, 147 of 235 halved; **P9 goes 1671 px / 3 rows → 58 px / 1 row / ink 1**; depth fallback 3.4% → 8.6% and over-occlusions 100 → 187; worst temporal jump 65.3% → **100%**. `d7db3a3` forbids it. |
| **Narrow the band AND retighten the gate to its new floor** | The gate floor scales with the reach, so `{reach r, gate ≈ 1.58r}` is self-similar: the over-paint share of the painted *width* stays ~37% at **any** r while total ink scales with r. **No band below the shipped one has any T that keeps 100% of legitimate ink.** |
| **Widen the band and tighten the gate** | Scores well only under an *aggregate* ink metric, where ink gained at healthy poses pays for ink lost at degenerate ones — §9's class of mistake. Per pose: 13,374 legit px lost across 166 poses, 6 erased. Also introduces 2 px writing >1% too NEAR — a leak class the shipped shader does not have. |
| **A single global band reach that separates the classes** | ⭐ **Proven impossible.** Over 270 ring-poses, **201 (74.4%) have `rMin ≥ rMax`** — no reach works even for that one ring at that one pose. Within a single draw call, **all 6 multi-ring frames are infeasible**, including P2 (two ordinary bounded ellipses, camera high, nothing degenerate): needs `r ≥ 0.96649` AND `r < 0.95184`. The required reach spans 24.9× **within one frame**. |
| **Band alpha from the exact distance to `Cs`** (§7.2's candidate 2 repurposed) | Keeps 21.5% of the over-paint **and** **erases the ring at 23 of 118 poses** including P3 and P8. Worse on both axes. |
| **The tangent-corrected PERPENDICULAR distance as an alpha source** | UNDERSTATES by up to 2.9873 px, keeps 8.65% of the over-paint ink, and **manufactures over-paint in the regime that is clean today** (C-outside-high 390 → 468 px). Admissible only as a covering test downstream of the 3.0 gate, never as a distance the alpha reads. |
| **Renormalising / conditioning `Cs` to fix the over-paint** | For `Cs = k·v·vᵀ`, Sampson `= |vᵀp|/(2|v.xy|)`, **independent of k** (measured constant to 9 digits over k ∈ ±5), and `adj(H) → rank 1` is exact mathematics at `det(H) = 0`, not a float artefact. Conditioning is the right tool for R1's float32 **noise** and the wrong tool for the over-paint. |
| **A distinct render regime for "camera near the ring plane"** (§7.2's untried direction (c)) | Subsumed: the exact solve *becomes* the exact point-to-line distance there, **continuously**. A regime switch buys the identical answer plus a discontinuity of exactly the class measured at 46.9% frame-to-frame ink. |

---

## 5. THE FIRST MOVE

### Move 0 — before anything else, and it kills this whole document if it fails

**Run `npm run check:conic-gl` at HEAD, from a normal terminal** (or an agent shell with the sandbox disabled — Chrome cannot open a socket inside it).

**Why this first:** every Instrument E figure in this document, in all four scoping lanes, is a **CPU-mirror prediction**. No line of shipped GLSL has been executed. The mirrors reproduce the published M0 baselines at 8–9 of 9 fixtures and kill 22/22 at the shipped accept, which is the strongest validation available without a browser — and §7.2 records a fix that read as a no-op *only when Instrument E ran it*.

**What would kill it:** if HEAD does not report **22/22 killed** with P1/P6 = 1114 px / 2 rows / 0 debris and P7 = 633 px / 3 rows, then the baseline every prediction here is scored against is wrong and the scope must be re-derived before anything is written. Cost: minutes.

### Move 1 — the smallest change that produces the decision

On a branch, in one commit:

1. **`src/objects/OrbitConicField.js`**, immediately after line 269 (`if (band < 0.01) continue;`): the five-line second-order block from §R1. Do not touch the Sampson block above it, `if (arc.x > uArcTolPx) continue;`, or `wclip = arc.z < 1.0e30 ? arc.z : arc.y;`.
2. **`src/objects/ringConic.js`**: a new exported mirror **beside** `sampsonDistancePx` (line 357). Do not modify `sampsonDistancePx` — 14 Instrument A tests pin it.
3. **The recentring rider**: pack `Cs′ = TᵀCs T` in `buildRingConic`, origin `(W/2 + 0.25, H/2 + 0.25)`; the shader subtracts it from `gl_FragCoord.xy`. `Hinv`, `Hfwd`, `rowW` and the extent AABB stay in the original frame and must not move.
4. **`tools/conic-gl-gate.mjs`**: add **M23-drop-correction**, **M24-correction-a-zero** (sets `aq = 0`, silently reverting to Sampson while the shader text changes — this is the one Instrument E's no-op detector *cannot* catch), **M25-correction-larger-root**. Repoint **M11**'s fixture: P5's second ring `R = 0.9 → R = 125`.
5. Update the two stale mirrors in the same commit: `paintedByOldGates()` (`ringConic.frontarc.test.js:100–118`) and `painted()` (`ringConic.extent.test.js:89–93`, whose `HALF_BAND` is 1.5 and is already one step stale today).

**Then measure, in this order, and stop at the first failure:**

| check | what kills it |
|---|---|
| `npm run check:conic-gl` | **M24 surviving.** If the fixture set cannot kill "the correction silently reverts to Sampson", the fix ships with exactly the blindness §3 documents and must not land. Also: any movement at **P1 or P6** away from 1114 px / 2 rows / 0 debris — that is §8's headline and it must survive by construction. |
| the float32 flip count at **P8**, read off the GPU | more than the CPU model's **6 flips**, or any flip at alpha > 0.05. The recentring is the only measured answer to R1's one refutation; if the GPU disagrees with the model, R1 is unlanded. |
| `npm run test:baseline` | any conic test failing for a reason **other** than the seven fixture counts moving. Those seven re-bless by name (precedent `1a3c1e3`); anything else is a real break. |
| **live, at Max's own repro pose** — seed `lab-procedural-6`, planet 5 at 6 body radii, 0.25° off the orbit plane, `window.__depthProbe()` | the residual multi-ring leak count not going to **0**. The prediction is that it does, because 598/598 of the dFront ≥ 1.485 class is removed on fixtures. If it does not, the correctness case for this project is gone and it reverts to a pure line-width question — which is a WONTFIX conversation, not a fix. |

### Move 2 — the ruling, and it is not an agent's

Park Max in the live game at the pose above with the branch built, and let him toggle. **The number to put in front of him, not a screenshot of it:** the line goes **4 rows → 2 at his own repro pose (−40.8% ink)** and **3 rows → 1 at exactly edge-on (−66.7%)**, and is **unchanged (−0.3%) on a healthy ellipse**. The question is one sentence: *does the thinner line read as correct, or as the line getting thin when you get close?* If the answer is "hold the weight", `pixelWidth` must go 1.0 → ≈1.28 alongside — which thickens the face-on line where nothing is currently wrong — or the mechanism changes to R5.

---

## 6. HOW IT WILL BE VERIFIED

**Instrument E** (`npm run check:conic-gl`, from a normal terminal):
- Existing 22 mutants must stay killed except the documented M11 fixture repoint.
- **Three new mutants are required and were scored in the mirror**: M23-drop-correction, M24-correction-a-zero, M25-correction-larger-root. All three are killed by the existing nine fixtures in the mirror. **M24 is the one that matters** — it is the mutant the no-op detector cannot see.
- **A mutant on the alpha's ARGUMENT does not exist today** and should be added regardless of which option lands: swap the smoothstep's argument for the raw Sampson `distPx`; it should move every fixture.
- Seven of nine fixture counts move under R1 and are re-blessed by name: P2 638→632 · P3 633→211 · P4 656→651 · P5 432→426 · P7 633→211 · P8 1343→671. **P1/P6/P9 must not move.**

**Instrument A** (`npm run test:baseline`): 69 tests in the four conic files are green at HEAD (re-executed for this scope). Under R1 **no assertion breaks** — `sampsonDistancePx` is untouched and every arc-gate claim holds on the superset the band now feeds — but the two JS mirrors go stale and must move in the same commit.

**Live integration, in the game, driven by an agent** (chrome-devtools MCP; this is objective and is *not* Max's job):
- `window.__depthProbe()` at seed `lab-procedural-6`, planet 5, at 6R / 4R / 12R / 2.5R and 0.25° / 0.5° / 2.01°, plus planet 3 at 6R / 1.15°. Scored as **the §9 pair** — `LEAK` **and** `OVER-OCCLUDE` — never a leak count alone. §10's table is all-zeros today at those poses; it must stay all-zeros, and the residual multi-ring leaks (22–24 px) should go to 0.
- The `d0b5170` regime: the moon `Al` (p5 m2) looking away from the star. §8.1's result — ring #5 legitimately paints **zero** pixels there — must hold.
- Frame time: 172 fps median / p95 6.4 ms is the recorded baseline at the `Al` pose.
- ⚠ Use the **null control** first: two screenshots with nothing changed must differ by exactly 0 px (`_lab.freezeFrame()`), or the animated starfield and retro dither make a raw diff read ~14% changed and mean nothing.
- ⚠ `_lab.setCameraPose` does not resync the camera interpolator; the camera is 348 units away one frame later while the API reports success. Use `cameraController.focusOn(worldPos, viewDistance)`.

**⭐ What only Max's eyes can settle, and no agent may close:**
1. **Whether the thinner line is right.** −40.8% ink at his repro pose, −66.7% at exactly edge-on. Every appearance claim in this document is a row count and an ink mass computed from distances. Nothing here has been rendered and nobody has looked at it.
2. **What the line's alpha MEANS.** Two coherent readings: (a) alpha = how much of this pixel the ring's projected curve covers — then the pass is wrong by 2× at the degeneracy and R1 is the fix; (b) alpha = proximity to the conic the CPU handed the shader — then there is no defect, the pixels really are on that conic, and the correct action is to close this as *"the line thickens near edge-on, by design"* and take only R4 as a bound. Everything in §4 assumes (a).
3. Whether a **stippled ellipse** (R3's 1–8 px connected gaps) would be acceptable, if R3 is ever revisited.

---

## 7. WHAT IS UNMEASURED

1. **NO GPU RUN, ANYWHERE.** Chrome cannot launch in the agent sandbox, so `npm run check:conic-gl` was never executed by any lane and no line of shipped GLSL was touched. Every Instrument E figure in this document — the 22/22 at HEAD, R1's 24/25, R3's 17/22, every fixture count — is a **CPU-mirror prediction**. The mirrors reproduce the published M0 baselines at 8–9 of 9 fixtures from `readConic()`'s float32 pack, which is the strongest validation available without a browser and **is not proof**. Marginal kills at float32 can differ.
2. **THE FLOAT32 MODEL IS `Math.fround` PER OPERATION IN GLSL DOT ORDER.** The real shader runs on ANGLE/SwiftShader or a driver that may fuse multiply-adds and reassociate. R1's 226-flip figure, the 6-flip figure after recentring, and the P7 1-row-vs-2-rows split are all model output. P7 in particular is decided by 0.0295 px of margin against 3.4e-2 relative noise — genuinely coin-flip territory.
3. **THE RECENTRING RIDER IS SCORED ONLY FOR NOISE.** It changes no float64 answer (one pixel, at the origin) and cuts the flips 226 → 6. The over-paint scoring, the kill matrix and the flicker sweep were **not** re-run with it in place, and nobody checked what the translation does to the packed float32 **dynamic range** (max-abs normalisation is re-applied after it, so the entries move). Both are cheap and both are open.
4. **NO OCCLUDER, SO §9's PAIR IS NOT SCORED FOR ANY OPTION.** Every number here is coverage and ink. R1 removes 22.3% of the painted ink, which changes the pixel set §10's depth rule was measured on, so `LEAK` and `OVER-OCCLUDE` must be re-scored — and **against `SphereGeometry(96×48)`, not an analytic sphere**. The structural argument that R1 cannot create an over-occlusion (it removes only ink no ring point covers) is an argument, not a measurement, and it does not cover the 2.5% residual fallback.
5. **NOT MAX'S SCENE.** The multi-ring poses are synthesised to the *shape* of seed `lab-procedural-6` (8 planet orbits + 9 moon rings, radii and inclinations invented), not read from the live game. The per-pose figures that are directly comparable to §10's handover match exactly (P3 67.0%, P7 67.0%, P1 0%, Max's grazing geometry 50.0%); the global percentages are over a different ladder.
6. **TEMPORAL COVERAGE IS ONE SWEEP** — 41 camera heights through the edge-on pose. No azimuth sweep, no orbital motion, no approach through the thin-ellipse or straddle regimes. The `b6` grazing flap is a temporal failure a single axis of motion can miss. R1's 0.4% is evidence, not proof.
7. **MULTI-RING OWNERSHIP IS BARELY TESTED.** `CONIC_WCLIP_TIE_EPS` arbitrates co-depth ownership on band coverage `a`, and every option changes how `a` is computed. Measured at P4 only, statically, with no motion: **333 overlap px, 4 owner flips (1.2%), 0 pixels dropped entirely.** P2 and P5 have no overlap pixels to test at all. M8/M10 are the mutants that would see this and they were not exercised.
8. **THE `disc < 0` FALLBACK IS CHARACTERISED, NOT BOUNDED.** It fires on 6.9% of band-passing pairs and returns the shipped Sampson value there. None of the 571 surviving over-paint pixels is attributable to it — but "the fallback never keeps over-paint" is an observation over 35 poses, and a hyperbola whose gradient line misses both branches is exactly the geometry that would break it.
9. **THE ARC SOLVE'S OVERSTATEMENT RATIO IS NOT √2.** §8 sized `ARC_TOLERANCE_MARGIN_PX = 2.0` on "at most √2 for a locally straight curve". Measured over 214,951 band-passing pixels: p50 1.0002, p99 1.2594, **max 188.26** at a near-tangency. What actually binds is the absolute worst on a covered pixel, and that can only ever be **sampled** — it has already moved once (1.525 in §8 → 1.5356 in §10's handover) and it can only move up.
10. **THE FLOOR IS ONE NUMBER AND THREE BATTERIES STRADDLE THE TARGET.** 1.40880 / **1.52421 (Instrument A's own f8 control)** / 1.53560. §10's residual-leak class sits at 1.485. R1's case does not depend on this — it removes that class without a gate — but any future gate argument does, and settling it is one script over a wide battery.
11. **NO FRAME-COST PROFILE.** R1's `+0.56% mul+add / +1.27% div / +0.64% sqrt` are **static op counts** off the shipped GLSL against a synthesised 17-ring funnel, not a measured frame time.
12. **THE ONE-DIVIDE ALGEBRAIC VARIANT WAS NOT COSTED.** `d = 2|c|·|∇Q| / (|∇Q|² + sqrt(|∇Q|⁴ − 16Ac))` removes a division but squares the cancellation's operands into the 1e13 range; its float32 behaviour is unknown and could be better or worse than the form measured.
13. **R2's HYBRID PREFILTER IS UNVERIFIED AT THE STRADDLE POSES.** Only P7 (bounded, edge-on) was ulp-perturbed. Whether Sampson is equally fragile at P1/P9/C-inside-* — where the AABB sentinel forces Sampson to be the prefilter — is exactly the question the hybrid's safety turns on.
14. **THE MIDLINE SINGULARITY WAS SAMPLED, NOT SOLVED.** Worst `Sampson/reach` at a covered pixel is 30.68 over a 201-rung sweep; the identity says it is unbounded, so that is where the pixel grid happened to land, not a ceiling.

---

## Appendix — provenance

Every number in this document was re-executed against `e225d0b` while writing it. Probes (read-only on `src/**`):

- `scratchpad/c1-overpaint/{report,edgeon-knife}.mjs` — the over-paint census, the alpha histograms, the cause split, the spatial structure, the edge-on `0/0`.
- `scratchpad/c2-lane/{07-a4-erosion}.mjs`, `scratchpad/c2-lane/{lib,poses}.mjs` — the covering test's connected-gap erosion; the shared 35-pose battery and its validated algebraic oracle.
- `scratchpad/c3-bandgate/{08-interval,11-instrumentA}.mjs` — the interval refutation of any global reach; Instrument A's own floor on `uArcTolPx`.
- `scratchpad/c3-exact-accept/{02-refine,07-final}.mjs` — the renormalised-tangent variant, the 12.11% dropped-coverage finding, the prefilter ulp kill, the line-weight table.
- `scratchpad/c3-structural/{01-identity,02-score,04-cost,05-kill,06-refute,09-f32-fair2,09b-check}.mjs` — the exactly-2× identity, the recommended option's scores, its cost, its kill matrix, its temporal/no-vanish/erosion/ownership refutations, the float32 exposure and the recentring mitigation.
- **New for this scope:** `scratchpad/scope-verify-1.mjs` (does the fix remove §10's named residual-leak class — 598/598 yes) and `scratchpad/scope-verify-2.mjs` (the depth-fallback rate, 36.0% → 2.5%, and that 98.4% of it is over-paint).
- `npx vitest run src/objects/__tests__/ringConic*.test.js src/objects/__tests__/OrbitConicField.test.js` → **69 passed** at HEAD.