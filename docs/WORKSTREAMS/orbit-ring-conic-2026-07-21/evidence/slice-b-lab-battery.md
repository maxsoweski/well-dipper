# Slice B lab GL battery — orbit-ring-conic-2026-07-21

Run against `orrery-orbit-lab.html` (conic mode repointed at the productized
`OrbitConicField`) on branch `feature/supercruise-freelook`, HEAD `8fe3826`
("Slice B fix (orbit-ring-conic): zero-alloc _packRing hot path (R5)").
Dev server :5173, debug Chrome :9223, own page reloaded `ignoreCache:true` first.
sceneTarget = **657×282** (1/3-res, matches the dig-record). MEASURE-ONLY: no
`src/`, test, or lab-file edits; all state via `evaluate_script`.

**First-run status of the lab repoint: VERIFIED WORKING.** conic-prod mode renders
(no black screen), the field's fullscreen shader compiled at boot
(SHADER DEBUG msg 62: VS=62 / FS=2964 chars), and no WebGL/shader runtime error
appeared across the entire battery.

## Console status

Boot + full-battery console clean except ONE benign 404, verbatim:

```
[error] Failed to load resource: the server responded with a status of 404 (Not Found)
  → GET http://localhost:5173/favicon.ico [404]
```

No shader-compile error, no GL error, no NaN/uniform warning through b5..b10 +
screenshots. Favicon 404 is not a module (the lab imports resolved and rendered).

## Reachability note (shapes b5b)

Only `window._orbitLab` and `window.__THREE__` (=revision string "183") are exposed.
The field instance (`conicField`), `scene`, `retro`, and `ringDefs` are all
module-scoped — NOT reachable. Consequences: (a) the lab's only two ring colors are
planet `0x00ff00` and moon `0x00bb00` (both green, moons co-located at `[5200,0,0]`),
so a clean two-arbitrary-color crossing cannot be built through the lab scene;
(b) `readRenderTargetPixels` on the internal sceneTarget is not reachable. b5b is
therefore run as a **self-contained direct render of `OrbitConicField`** via dynamic
import (`/well-dipper/src/objects/OrbitConicField.js`), which exercises the exact
productized argmax shader. This exposure limit is itself a Slice-B finding (the lab
repoint offers no introspection hook for the field).

---

## Per-test results

### b5 — dead-zone (AC2)  → **PASS**

Pose reconstructed from the dig: center `[3000,0,0]`, dist 25, camera
`[3000, 25·sinP, 25·cosP]`, look center. Prox fade neutralized. Conic cutoff 2.0.

| pitch | baseline (LineLoop) | shipped SDF | conic-prod | conic-probe (A/B) |
|------:|--------------------:|------------:|-----------:|------------------:|
| 0.002 | 657  | **0** | 657  | 657  |
| 0.005 | 1242 | **0** | 1314 | 1314 |
| 0.010 | 1029 | **0** | 1314 | 1314 |
| 0.020 | 960  | **0** | 1314 | 1314 |
| 0.050 | 926  | **0** | 1300 | 1314 |

- Baseline (LineLoop) matches the dig dead-zone table **exactly** (657/1242/1029/960/926)
  → pose reconstruction byte-correct.
- Shipped SDF paints **0 px across the whole dead zone** (reproduces the defect).
- conic-prod paints 657–1314 px (LineLoop class); hits **1314 @ pitch .01** exactly
  as the proven probe did. Zero-px rows eliminated. **PASS.**
- A/B: conic-prod == conic-probe everywhere except pitch .05 (1300 vs 1314, ≈1%) —
  attributable to the productized field's new angular-fade + log-depth path trimming
  ~14 edge px. Negligible.

### b5b — two-color overlap / single-argmax (AC7 fidelity, D-4)  → **PASS**

Self-contained `OrbitConicField` render (256×256 RT, WebGL2, logdepth): two R=100
rings — A in XZ plane (red), B in XY plane (blue) — from an oblique camera, so the
projected curves cross with the two rings at different depths. Crossing pixels found
by intersecting each ring's solo-painted mask; front ring per pixel computed on the
CPU by clip-w (`wclip = rowW·[XZ,1]`, byte-mirror of the shader / `frontBranchOK`).

| metric | value |
|---|---|
| crossing pixels | 144 |
| argmax-match (painted color == min-clip-w ring's color) | **100.0 %** |
| color-swap flip (swap A/B colors, geometry fixed → each crossing flips 1:1) | **100.0 %** |
| blended pixels (both channels present) | **0** |
| A-front / B-front crossings | 67 / 77 |

Both rings win at different crossings (67 vs 77) → selection tracks depth, not ring
order. Zero blended pixels → one ring owns each pixel (no alpha mix). Color follows
the front-most ring (swap-flip 100 %). Directly validates D-4 single-argmax
(color + alpha + depth coupled to the min-clip-w ring). **PASS.**

### b6 — drift (AC3)  → **PARTIAL** (dead-zone PASS; grazing FLAG)

Prox neutralized. `driftMeasure` 90f, 0.12°/frame. A/B conic-prod vs probe.

| pose | mode | avgGreen | avgToggles | togglePerGreen |
|---|---|---:|---:|---:|
| dead-zone boundary `[3000,0,0]` d25 p.01 | conic-prod | 1256.3 | 22.2 | **0.018** |
| " | conic-probe | 1314.0 | 0.0 | **0.000** |
| " | baseline (LineLoop) | 1027.1 | 1.4 | 0.001 |
| " | shipped SDF | 0 | 0 | — (invisible) |
| grazing @5200 `[5200,0,0]` d25 p.002 | conic-prod | 1554.6 | 344.6 | **0.222** |
| " | conic-probe | 2145.3 | 191.9 | **0.089** |
| " | baseline (LineLoop) | 1764.7 | 150.4 | 0.085 |
| " | shipped SDF | 1638.5 | 223.9 | 0.137 |

- **Dead-zone boundary: PASS** — conic-prod togglePerGreen 0.018 (avgToggles 22.2),
  well inside the stable class (dig accept ≤0.125). The bare probe achieves a perfect
  0.0, so the productized path adds ~22 toggling edge px/frame — small in absolute
  terms.
- **Grazing @5200: FLAG** — conic-prod togglePerGreen **0.222 > shipped SDF 0.137 >
  probe 0.089**. This is a genuine per-green drift regression at grazing.
- **A/B isolation:** re-running grazing at cutoff 0.001 (fade effectively off) gives
  IDENTICAL conic-prod numbers (1554.6 / 344.6 / 0.222) → **angular fade is NOT the
  cause.** The green gap (1554 vs probe 2145) appears ONLY at the moon-dominated
  grazing pose (near-equal 1256 vs 1314 at the moon-free dead-zone), consistent with
  the green counter treating the faithful dim moon color (`0x00bb00`, g≈0.73) that
  single-argmax now surfaces in front of bright planet rings differently — a
  lab-counter confound (the probe painted every ring bright green, masking it), NOT a
  ring cull. The residual real signal is the log-depth `gl_FragDepth`/argmax edge
  jitter (R6 grazing reconstruction). Recommend the live grazing drive (Slice D) as
  the true gate; if it confirms, investigate the depth-write path — do NOT patch here.

### b7 — near-field (AC4)  → **PASS** (band) + documented Slice-B GAP (envelope)

Standing-on-ring: center `[5200,0,0]` d8 p0.1, prox off. Static pose via `poseCamera`.

| measurement | value |
|---|---|
| conic-prod static contiguous band (green px) | 4086 |
| conic-prod drift, prox OFF | avgGreen 4848.3, togglePerGreen **0.084** |
| conic-prod drift, prox ON (shipped defaults) | avgGreen 4848.3, togglePerGreen **0.084** (identical) |
| shipped SDF drift, prox OFF | avgGreen 4403.1, togglePerGreen 0.096 |
| shipped SDF drift, prox ON | avgGreen 3376.8, togglePerGreen 0.001 |

- Contiguous stable band present (static 4086 green); conic drift 0.084 is smoother
  than fade-off SDF (0.096). **PASS.**
- conic-prod proxOff == proxON byte-for-byte → **the field ignores prox fade**, which
  is correct Slice-B scope (the prox envelope is Slice C). The "fade back on →
  envelope applies" leg is therefore a **GAP-by-design** for conic-prod. The SDF
  contrast confirms the envelope mechanism works there (proxON collapses green +
  toggles to 0.001 — the "regime avoidance" the dig flagged).

### b8b — cutoff calibration (AC5∩AC8)  → **DONE, calibrated cutoff = 1.0 px**

pxPerRad = 201.37 (h=282, fov=70). Measured shipped-SDF angular dropout (projected
radius in render px at which SDF stops painting), by controlling projPx directly:

| ring class | radius | measured shipped-SDF dropout (projPx) |
|---|---:|---:|
| planet | 387  | ≈ 0.8 |
| planet | 1000 | ≈ 0.8 |
| moon   | 40   | ≈ 0.6 |
| moon   | 20   | ≈ 0.45 |

The **provisional cutoff 2.0** (fade band [1.0, 2.0]) fades planet rings out by
projPx≈1.0 and removes moon r40 entirely (0 px at every reachable projPx ≤1.55) —
above where shipped SDF still paints → anti-vanish regression (see b8).

Calibrated cutoff pinned to the measured dropouts: **1.0 px** (fade band
[0.5, 1.0]), placing full-removal (0.5 px) at/below the SDF dropouts of both classes.
Recommendation for Slice C: change `DEFAULT_ANGULAR_CUTOFF_PX` **2.0 → 1.0**
(measure-only here; not edited).

### b8 — anti-vanish ladder (AC5)  → **FAIL @ provisional 2.0, PASS @ calibrated 1.0**

`perRingLadder` over 8 distances [25, 800, 8000, 40000, 120000, 300000, 600000,
900000] × 13 rings. Anti-vanish cell = shipped-SDF-visible but conic-invisible.

| cutoff | anti-vanish cells | detail |
|---:|---:|---|
| 2.0 (provisional) | **4** | planet 723 @120k, planet 1520 @300k, planet 5200 @900k, moon 40 @8000 |
| 1.3 | 1 | moon 40 @8000 |
| **1.0 (calibrated)** | **0** | — |
| 0.8 | 0 | (more small-planet persistence — too lax) |

At calibrated **1.0: zero anti-vanish regressions.** The 3 residual "far-dots"
(conic-visible where SDF-invisible) at cutoff 1.0 are small **planet** rings at
projPx≈2 (387 @40k, 1000 @120k, 5200 @600k) that SDF's flaky band dropped and conic
correctly renders — conic's intended improvement, not moon dots. **PASS @ 1.0.**

### b9 — occlusion (AC6)  → **PASS**

`driftMeasure({planet:true})` against the log-depth planet stand-in (blue
MeshBasicMaterial, writes three's logdepthbuf), ball r10 at `[5200,0,0]`, cutoff 1.0.

| pose | planet | avgGreen | togglePerGreen |
|---|---|---:|---:|
| nominal (pitch 0.35) | off | 4725.7 | 0.039 |
| nominal | on  | 3667.5 | 0.041 |
| grazing (pitch 0.02) | off | 3699.6 | 0.153 |
| grazing | on  | 3110.1 | 0.166 |

- Adding the occluder drops green **−22 %** (nominal) and **−16 %** (grazing) → the
  ring is correctly occluded behind the ball (the field's `gl_FragDepth` contests the
  three-native log-depth mesh). Ring in front stays visible.
- togglePerGreen barely moves with the occluder present (nominal +0.002, grazing
  +0.013) → **no z-fight shimmer** under 90f drift, at both nominal and grazing pitch
  (the grazing worst case where `q.z→0`, R6). **PASS.** (The grazing base 0.153 is the
  same inherent grazing drift flagged in b6, not an occlusion artifact.)

### b10 — far fade (AC8)  → **PASS** (at calibrated cutoff 1.0)

From the b8 grid at cutoff 1.0: moon rings idx 9/10/11 (r 2/8/20) render `false` at
every distance (no persistent dots); moon r40 renders only where SDF also does
(dist 8000, projPx≈0.84) and fades everywhere farther; large planet rings (≥9500)
persist `true` at all far distances. Sub-pixel moon rings fade to invisible; large
rings persist. **PASS.**

### gentle control (pitch 0.35, ~155 class)  → **PASS, no regression**

center `[5200,0,0]` d25 p0.35, 90f.

| mode | avgGreen | avgToggles | togglePerGreen |
|---|---:|---:|---:|
| conic-prod | 4612.9 | 179.2 | **0.039** |
| baseline (LineLoop) | 2717.5 | 162.6 | 0.060 |
| shipped SDF | 3779.0 | 158.5 | 0.042 |

Baseline avgToggles 162.6 and SDF 158.5 match the dig reference **exactly** (pose
byte-identical). conic-prod avgToggles 179.2 is higher only because it paints a
fuller band (4613 green vs SDF 3779); its per-green **rate 0.039 is the BEST of the
three** (< SDF 0.042 < LineLoop 0.060). No regression.

---

## Probe-vs-productized divergences (A/B summary)

1. b5 pitch .05: conic-prod 1300 vs probe 1314 px (≈1 %) — new fade/log-depth path.
2. b6 dead-zone drift: conic-prod 22.2 toggles vs probe 0.0 (togglePerGreen 0.018 —
   small absolute).
3. b6 grazing drift: conic-prod togglePerGreen **0.222 vs probe 0.089** — the
   productized log-depth/argmax + faithful-moon-color path is measurably noisier at
   grazing. Angular fade ruled out (cutoff-invariant); part confound (moon-color green
   counter), part real (R6 grazing reconstruction). **This is the one open concern.**

## Screenshots (conic-prod, cutoff 1.0)

- `slice-b-overview-conic-prod.png` — settled overview (chunky-retro rings preserved).
- `slice-b-nearfield-conic-prod.png` — standing near the 5200 ring (contiguous band).
- `slice-b-deadzone-conic-prod.png` — pitch-0.01 @ [3000,0,0]; a solid green ring
  line renders where shipped SDF paints 0 px (HUD confirms conic, 1314 green).

## Verdict roll-up

| test | verdict | headline |
|---|---|---|
| b5 dead-zone | **PASS** | conic 657–1314 px (LineLoop class); SDF 0; 1314 @ .01 |
| b5b two-color argmax | **PASS** | 144 crossings, argmax-match 100 %, swap-flip 100 %, 0 blend |
| b6 drift | **PARTIAL** | dead-zone 0.018 PASS; grazing 0.222 > SDF 0.137 FLAG |
| b7 near-field | **PASS** + GAP | contiguous band; prox envelope is Slice-C (field prox-independent) |
| b8 anti-vanish | **PASS @ 1.0** | 0 cells @1.0; 4 cells @2.0 (provisional) |
| b8b cutoff calib | **DONE** | SDF dropouts planet 0.8 / moon 0.6; calibrated cutoff **1.0** |
| b9 occlusion | **PASS** | green −16…−22 % behind ball; no shimmer (toggles +0.002/+0.013) |
| b10 far fade | **PASS** | moons fade to invisible; large rings persist |
| gentle control | **PASS** | conic per-green 0.039 (best of 3); baseline/SDF match dig |

**Actions for Slice C/D (measure-only findings; nothing patched here):**
1. Ship cutoff **1.0** (drop `DEFAULT_ANGULAR_CUTOFF_PX` 2.0 → 1.0) — provisional 2.0
   causes 4 anti-vanish regressions.
2. Confirm/close the grazing-drift regression (conic 0.222 > SDF 0.137) at the live
   grazing drive; investigate the `gl_FragDepth`/depthTest path if it reproduces
   in-game (the lab green-counter moon-color confound accounts for part but not all).
