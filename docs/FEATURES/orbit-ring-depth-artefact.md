# The ORRERY orbit-ring depth artefact — measured, root-caused, fix ATTEMPTED AND REJECTED

**2026-08-10.** Max: *"in the orrery mode the green line of the orbit is visible through the planet.
Only partially and only at certain angles."*

⛔ **STATUS: OPEN. Not fixed.** One fix was written, adversarially refuted 3/3 at high severity, and
reverted. The rejected patch is preserved at `scratchpad/orbit-fix-rejected/REJECTED.patch` with its
test. **Read §4 before writing another one — the geometry in that patch is RIGHT and only the
selector is wrong, so starting from scratch would throw away the correct part.**

---

## 1. `77fff7f` IS EXONERATED — by execution, with a positive control

The artefact appeared right after planets/moons became `SphereGeometry`, so the obvious suspect was
the mesh. It is not. Runtime A/B on a live page, swapping the pre-`77fff7f`
`IcosahedronGeometry(r, 5)` back in **without moving the camera**, counting ring-green pixels inside
the planet's disc:

| elevation off orbit plane | SPHERE 96×48 (HEAD) | ICOSPHERE d5 (pre-77fff7f) |
|---|---|---|
| 0.25° | **1524** | **1524** |
| 0.50° | **1212** | **1212** |
| 0.75° | **1212** | **1212** |
| 1.00° | **1212** | **1212** |
| 2.00° | **0** | **0** |

Identical in every cell — count, `Gmax`, leak bbox and outside-disc count. Full-frame byte diff of
the two captures: **18 differing pixels out of 2,217,520**, ten inside the disc, none of them green.

⭐ **The null is a real null, not a no-op.** Positive control: replacing the same body with
`Ico(R*0.6, 5)` at the *identical* pose took green-in from 1212 → **2476** and grew the bbox. The
runtime swap demonstrably reaches the renderer.

And at 2.0 body radii, where the icosphere's limb error is actually resolvable, **the icosphere leaks
MORE** (168 vs 136) — the direction "both meshes are inscribed, so the coarser one sags further
inward and is the WEAKER occluder" predicts. `77fff7f` only removed the ragged 0.879-px limb the
artefact used to hide behind.

**Geometric proof every counted pixel is a false leak:** camera at radial distance 6750.31, the whole
ring at 6748.05, so the ring's closest point to the camera *is* the planet's own centre at 2.264,
while the planet's near surface along that ray is at 1.811. No part of the ring can legitimately be
in front of the disc.

Evidence: `scratchpad/ab-live/` — `SIDE-BY-SIDE-el0p5.png`, `AB-RESULTS.txt`, 15 PNGs, and
`count.py`/`report.py` (the counts are reproducible from the PNGs alone).

## 2. Root cause — and a correction to how it was first described

Rings are **not** `THREE.Line`. `OrbitLine`/`OrbitRingSDF` meshes sit on `ORBIT_PROXY_LAYER = 10`,
which the camera mask excludes; they never draw. Every ring is painted by ONE fullscreen pass,
`src/objects/OrbitConicField.js`, which writes its own `gl_FragDepth`.

⛔ **The first description of this bug — "the view ray meets the ring circle twice" — is WRONG and
should not be repeated.** A view ray meets the ring *plane* exactly once. It meets the *circle* twice
only in the measure-zero case where the ray lies in the plane.

**The actual defect is a mismatch between the coverage test and the depth test:**
- the Sampson band (`OrbitConicField.js:190-196`) says *"this pixel is within 0.5 px of the PROJECTED
  CIRCLE"*
- the depth (`:217-219`) is taken at the ray ∩ **PLANE** point, which at grazing **is not on the
  circle at all**

In the measured pose those two 3D points are ~1.1 units apart: a ray through the lower disc has ~1°
depression, so it pierces the plane at `0.0198/sin(1°) ≈ 1.13` — *in front of* the planet's near
surface at 1.811 — while every point of the real circle is at `w ≥ 2.264`. **That single mismatch is
the entire 1212-pixel leak.**

The `t6.z` ring-centre fallback at `:226-229` is a second, independent defect. It is NOT what leaks
in this pose (the star is ~6750 away, i.e. far behind), but it gives every star-centred ring an
*identical* `w`, manufacturing exactly the co-depth ties that `CONIC_WCLIP_TIE_EPS` exists to paper
over.

**Measured angular signature** (band px genuinely in front of the body), which is what "partially,
at certain angles" means quantitatively:

```
 6R:  86/380 @0.5°  -> 10 @2°  -> 6 @5°  -> 1 @10°  -> 0 above 25°
12R:  42/212 @0.5°  ->  8      -> 6      -> 3       -> 0
30R:  18/108 @0.5°  ->  4 @5°                       -> 0 above 25°
```

## 3. ⛔ THE SHIPPED SHADER HAS ZERO NUMERIC TEST COVERAGE

Found while refuting the fix, and it is independent of the fix. `CONIC_FRAGMENT_SHADER` — the
~45-line GLSL depth block at `OrbitConicField.js:254-311` — **is never executed by any test.** A
refuter mutated it four separate ways, including multiplying every root's clip-w by 0.37, and **all
102 tests in the conic family stayed green.** The JS helpers that *are* tested (`ringCircleDepthW`,
`ringDepthW`) have no production caller; grep finds them only inside comments.

Any future fix here that is validated only against the JS twin is validating something that does not
ship. **This is the highest-value thing to close in this file, ahead of the artefact itself.**

## 4. THE REJECTED FIX — what was right, what was wrong, and the isolated cure

The patch replaced the ray∩plane depth with a closed-form line∩circle solve in the ring's local plane
(one `sqrt`, one `inversesqrt`, no trig). **That geometry is CORRECT and independently verified** —
`H` maps `(X,Z,1) → (px·w, py·w, w)`, the preimage-line construction lands exactly on `X²+Z²=R²`,
`wMin` is a true lower bound, head-on is clean to 4.7e-5.

⛔ **It was rejected on the SELECTOR**, `useA = h2A >= h2B` (`ringConic.js:362`,
`OrbitConicField.js:279`). `h²` measures transversality of the preimage LINE to the CIRCLE *in the
ring's own plane*. What the algorithm needs is transversality of the SCREEN line to the PROJECTED
conic. Perspective projection of a grazing circle is violently anisotropic, so the two notions
decouple completely; the justifying comment silently assumes a conformal map.

Measured, az=60° elev=0.5° — squarely inside the artefact regime — pixel (86.5, 182.5): a
20,000,000-sample scan finds 13,342 circle samples inside the 1-px band, **all** with
`w ∈ [151360.472, 151381.270]`. The patched shader writes **5818.82** (the old plane point: 5816.95).
That is **26× nearer than any real ring point** — precisely the failure it was written to eliminate.

**Why the patch's own table showed zero violations:** its invariant is `written w ≥ wMin` where
`wMin` is the ring's GLOBAL nearest point. At that pixel `wMin = −48498`, so the invariant is vacuous
and never fires. It cannot see this class of error at all. The harness was also run at **one
azimuth** — az=0°, where the patch genuinely is clean (1920/1920).

Scope of the wrongness, oracle-confirmed on painted pixels at shipping band defaults:

| pose | bad pixels (patched) | (old) |
|---|---|---|
| az 0°, elev 0.5° | 0 / 1920 | 0 |
| az 0°, elev 20° | 552 / 2528 | 640 |
| az 60°, elev 0.5° | 362 / 926 | 523 |
| az 110°, elev 0.5° | constraint B chosen for **all 979**; 957 fall through to `fbW`; 579 write >2% nearer than truth |

⭐ **THE CURE IS ISOLATED AND CHEAP — start here.** Evaluate BOTH constraints and keep any in-band
root. No other change; both m-vectors are already computed. Cost: one extra `sqrt` + `inversesqrt`,
**zero** extra `texelFetch`. Measured result: bogus-nearer pixels collapse to 0/0/0 (az 0° at
0.5/5/20°), 1/6/0 (az 60°), 1/2/5 (az 110°).

⚠ **Secondary, must be fixed in the same pass:** when no root is in band, the patch returns `fbW`
unconditionally — the depth of an arbitrarily distant circle point (measured 468 px away). Bound it
(`max(fallbackW, wMin)`, or reject the pixel) or it reintroduces an unbounded-error path by
construction.

⚠ **Test the GLSL, not the twin** (§3), and score only pixels the pass actually paints, using the
repo's own exported `sampsonDistancePx` / `withinRingExtent` / `frontBranchOK`.

## 5. Adjacent defect found on the way — `_lab.setCameraPose` does not resync the interpolator

⭐ **This is why every scripted-pose attempt this session silently failed, and it will bite the next
one.** `renderFrame` (`src/main.js:12492`) calls `CameraInterpolator.applyTo`
(`src/core/CameraInterpolator.js:71`), which does `camera.position.lerpVectors(prevPos, currPos,
alpha)` **every RAF** and overwrites any written pose from its own snapshots. `setCameraPose` never
calls `cameraInterp.resync(camera)` — the module documents `resync` as the required announcement for
exactly this discontinuity ("Discontinuity 2 — teleport"), and the warp path uses it.

⛔ **The symptom is silent and actively misleading:** `setCameraPose` returns `posDelta: 0` and
`bypassed: true`, `cameraPose().controller.distance` still reads the value you set — and the camera
is 348 units away one frame later.

The supported framing path is `cameraController.focusOn(worldPos, viewDistance)`
(`ShipCameraSystem.js:662`), which snaps `distance` AND `smoothedDistance` so `_applyOrbit()` places
the camera *from* that state instead of fighting it. It has **no `window._lab` hook**, which is why
it was unreachable from the console. Both belong in the agent-facing camera API Max scoped on
2026-08-10.

⚠ Also: `freezeFrame({orbit:0})` snaps every planet to orbital phase 0, so they line up collinearly
with the star. "The planet is where it was" is false after a freeze.

---

## 7. A SECOND, DISTINCT DEFECT IN THE SAME PASS — the phantom line is COVERAGE, not depth

**2026-08-11.** Max, parked on the moon `Al` of the outermost planet, looking AWAY from the star:
*"The faint green line straight across the upper-fifth of the screen is the phantom orbit ... when I
zoom out, this line fades away. When I continue zooming in, the line gets more solid."*

⛔ **Do not merge this with §1–§4.** Those are about the DEPTH written for painted pixels (the ring
showing through a planet). This is about pixels being **painted at all** in directions containing no
ring. Same fullscreen pass, different test, different fix.

### What it is, measured

Two lines are painted from the ORRERY vantage; they are not the same thing. Mirroring the fragment
shader's per-pixel accept in JS over the real `sceneTarget` grid (**557×285**, `pixelScale 3` — ⚠ the
conic math runs in RENDER-TARGET pixels, not CSS pixels; a probe in window coordinates is 3× off and
y-flipped, which is how the first probe this session measured nothing):

| gl row | CSS y | width | reconstructed plane point ÷ ring radius | `wclip` |
|---|---|---|---|---|
| 92  | 579 | 95%  | **1.000** — genuinely on the ring | 16.1 |
| 194 | 273 | **100%** | **1.754 – 2.023** | **4950** |

Row 194 is the phantom. Its pixels reconstruct to plane points **1.75–2× further out than the ring
itself** — they are nowhere near it. They pass the Sampson band because the near-degenerate `Cs`'s
zero set is a pair of near-parallel lines (the plane's asymptotes), and they pass the front-branch
guard because `wclip` is a healthy positive 4950.

**It sits on the ecliptic's vanishing line, twice confirmed independently of the renderer**: computed
from the projection matrices alone, the vanishing line images at y=155 in one pose (observed ~157)
and y=270 in another (observed ~273).

### Which ring, and why the obvious answers are wrong

⛔ **It is NOT a spurious conic.** 17 conics for 17 orbits was always correct — which is why two
sessions of hunting an extra one found nothing.

⛔ **It is NOT the behind-camera class fixed in `03cb1dd`.** That fix is real and independent (13 of
17 conics were entirely behind the camera carrying the "genuinely unbounded" sentinel), but the line
survives it. Dropping conic **#5 alone** — the outermost planet's orbit, the ring the camera is
riding, which **legitimately** straddles the camera plane and so **legitimately** has its extent
bound disabled — removes both lines. There is no AABB that helps: a straddling ring's projection
really is unbounded.

### The isolated cure, and why it is the non-vacuous version of §4's invariant

Conic #5's true clip-w range is `[wMin, wMax] = [−12310, +17.01]`. Every legitimately visible pixel
must therefore satisfy `0 < wclip ≤ wMax`. The real ring row measures **16.1**; the phantom measures
**4950**, which is **290× outside the ring's own depth range**. One comparison against a bound
already computed on the CPU (`wMax = _Hm[8] + radius·hypot(_Hm[6],_Hm[7])`, the exact companion of
the `wMin` already used for the extent decision), packed into the existing texture, tested per pixel.

⭐ §4's rejected patch asserted `written w ≥ wMin` and the doc records why that was toothless: at the
failing pixel `wMin = −48498`, so the invariant was vacuous and could not see the error class at all.
**`wclip ≤ wMax` is the same idea with the bound that actually binds.**

### ⚠ Gates and risks before anyone writes it

1. **It is a GLSL edit**, in the pass whose shipped shader has zero numeric coverage — the standing
   blocker §4 already names, and the reason one fix here was refuted 3/3. Build the gate first, and
   per §4: test the GLSL, not the JS twin, and score only pixels the pass actually paints.
2. **Regression risk, unresolved:** legitimate FAR-FIELD ring pixels also approach the asymptote,
   where the reconstruction is ill-conditioned. A bound that is too tight erases the distant part of
   a ring the player should see. The measured margin is large (16.1 vs 4950) but the tolerance must
   be chosen against the far field, not against this one pose.
3. **Score it at multiple azimuths.** §4's patch passed its own harness because that harness ran at
   a single azimuth. az 0° / 60° / 110° at low elevation is the minimum.

### Why it tracked the zoom

ORRERY pivots on a body that is itself in the ecliptic, so camera height above the orbital plane is
exactly `distance · sin(pitch)` — measured 12.952 against predicted 13.059. Zooming in drops the
camera toward the plane, `Cs` degenerates harder and the asymptotes tighten onto the vanishing line;
zooming out lifts it away. This is therefore **not specific to this seed, this planet or this
system** — it reproduces near any body, because being near a body in ORRERY *is* being in the plane.
