# ~~A planet-class moon renders BLACK past ~3.5 body radii~~ — ⛔ **DOES NOT REPRODUCE**

**Date:** 2026-08-15 · Branch `feature/world-engine-production-L1` · Subject `wd-27` planet 3 moon 1
(`isPlanetMoon: true`, ice, `radiusEarth` 2.165953174089925, `gameShaderVariant: 'rocky'`).

**Status: ⛔ THE DEFECT THIS FILE REPORTED IS WITHDRAWN. It was a confounded experiment.**
Kept in full, because the reasoning that killed it is worth more than the finding was, and because
a future session that re-observes a black body needs to find this refutation and not §1's table.

---

## 0. ⭐⭐ THE REFUTATION — read before anything below it

§1's table mixed **one pre-freeze screenshot** (radii 3.2, mean 56.6) with **five post-freeze
screenshots** (radii 3.9–12, all black), and read the difference as a function of camera distance.
It is not. Two independent errors produced it:

**(a) Session state, not distance.** Every black frame was taken in a session where the old
`freezeFrame` had **permanently teleported every body to `orbitAngle = 0`** — the bug documented in
§4 and since fixed (`e75cc12`). Re-measured after that fix, on a freshly reloaded page, by an
A→B→A design in which distance returns to its starting value and elapsed sim time cannot:

| order | radii | camera distance | mean L | frac > 40 |
|---|---|---|---|---|
| A (first) | 3.2 | 0.29526 | 41.8 | 0.635 |
| B | 12.0 | 1.10724 | **42.8** | 0.635 |
| C (last) | 3.2 | 0.29526 | 41.7 | 0.644 |

⭐ **The body is not black at radii 12 any more, and A ≈ B ≈ C.** Distance is refuted as the
independent variable — and so is the rival "black in every frame after the first," since C is the
last frame taken and is lit.

**(b) My region of interest was off-centre.** The lit-pixel centroid sits at x = 895 against a frame
centre of 840 — a **55 px** offset — so a frame-centred window was sampling background sky as though
it were body. Re-centred on the body: mean 41.7 → **52.2**, frac > 40 0.644 → **0.777** (0.825 on a
tighter 0.4 window).

**A third claim also dies here.** The workflow that refuted this file computed, by Monte Carlo, that
even the "lit" frame was anomalous — that no single attenuation reproduces its (mean, frac) pair, and
that `shadow1`/`shadow2` must therefore be firing. Measured directly, the shadow operands say
otherwise: `shadowPlanetCount 1`, caster radius 0.40394, **`miss / R = 3.61`** — far outside the
`smoothstep(0.85R, 1.15R, ·)` edge, so the term is fully **unshadowed**, and the guard
`tca > distToStar` is **not** tripping. Its Monte Carlo also assumed unit star brightness; the real
values are `starBrightness1 = 0.7` and `starBrightness2 = 0.434`. With registration fixed and those
in hand, the residual is inside the model's uncertainty. ⛔ **There is no confirmed rendering
defect here.**

### What this cost, and the lesson that is worth keeping
**A black body against black space cannot be measured by eye, and it is barely measurable by
crop-and-average either.** Every wrong turn in this investigation — "the disc stays the same angular
size", "the disc is ~450 px", "it goes black past 3.5 radii" — came from comparing dark regions
without an anchored reference. ⭐ **The controls that actually worked were the ones that made
something MOVE and then move back: hiding the mesh and differencing frames, and the A→B→A sweep.**
Reach for those first next time. And ⛔ **never build a sweep whose rungs are ordered in both the
independent variable and in time** — that is what made five months of session state look like physics.

---

## 0.1 WHAT SURVIVES THIS FILE

- **§4's `freezeFrame` teleport is real, was proven by intervention, and is fixed** (`e75cc12`).
  It is very probably what blacked the body in the first place — an eclipse the old `thawFrame`
  could not undo.
- **§5's three small defects stand** (dead-code fallback, asymmetric teardown, the unnamed proxy).
- The `uReliefOctaves` lead in §3 is **dead by arithmetic**: the ramp is
  `mix(4, 9, smoothstep(20, 6, d))` and cannot move at all until 6 body radii = 0.55362 scene units,
  which is 1.54× beyond the last moment the claimed transition could have occurred. The lit rung and
  three of the five black rungs all carried `uReliefOctaves = 9.000000`, bit-identical.
- ⭐ **`cameraPosition` never reaches the lighting path.** It appears once in this material —
  `Planet.js:1444` `vViewDir = cameraPosition - vWorldPos` — and `vViewDir`'s only consumer is the
  fresnel rim (`Planet.js:908-920`), which is additive and gated on `atmosphereStrength > 0`. §3's
  hypothesis was false at source.

---

**Original status line, kept for the record: "REPRODUCIBLE AND MEASURED. Cause NOT identified."
It was neither reproducible nor correctly measured.**

---

## 1. THE DEFECT

With the camera on the **lit side** and the vantage held constant, the body's rendered brightness
collapses between camera distance **0.295** and **0.360** scene units. Measured as mean luminance
over the inner 70% of the body's own predicted disc:

| `frameBody` radii | camera distance | mean L | max L | frac pixels > 40 |
|---|---|---|---|---|
| 3.2 | 0.29526 | **56.6** | 96 | **0.846** |
| 3.9 | 0.35995 | 1.0 | 5 | 0.000 |
| 4.1 | 0.37831 | 1.5 | 5 | 0.000 |
| 5.0 | 0.46135 | 1.2 | 4 | 0.000 |
| 8.0 | 0.73825 | 1.6 | 5 | 0.000 |
| 12.0 | 1.10724 | 1.3 | 5 | 0.000 |

It is **not** a night-side view. Phase angle — between moon→camera and moon→star — is
**29.65° / 29.68° / 29.69°** at radii 3.2 / 3.9 / 8. Identical, and firmly on the lit side.
`frameBody` does not change vantage with `radii`.

## 2. WHAT IT IS NOT — each killed by a measurement, not an argument

**Not an eclipse, and not `freezeFrame`.** A predecessor workflow proposed that `freezeFrame()`
zeroes `orbitAngle`, putting the moon in its parent's umbra. Live intervention proved the geometry
half exactly — **one `freezeFrame()` call moved moon→parent vs moon→star alignment from 0.885036 to
exactly 1.0, and the perpendicular miss from 3.76698 to 0.000301**, `parentDist` unchanged at
8.0919 — **and the moon still rendered fully lit in that perfectly collinear state.** Dead as a
cause. ⭐ It is nonetheless a real, separate bug: see §4.

**Not an occluding object.** A draw-eligibility walk of the scene along the view axis (filtering on
object-chain visibility **and** `material.visible` **and** layer mask, i.e. what can actually be
painted) returns, at BOTH radii 3.2 and radii 12, exactly **one drawn on-axis object: the moon.**

**Not the moon click proxy**, despite a seductive coincidence. `main.js:7859-7870` builds an
invisible pick target, `SphereGeometry(moonR * 4, 8, 6)` with
`MeshBasicMaterial({ visible: false })` and `renderOrder = -999 // never drawn`. Its radius,
0.09227 × 4 = **0.36908**, sits inside the measured transition bracket, and the camera crosses it at
`radii = 4.0` exactly. **The prediction was tested and FAILED: at radii 3.9 the camera is still
inside the shell (0.35995 < 0.36908) and the body is ALREADY black.** Independently ruled out at
source: three 0.183.1 gates the render list on `material.visible`
(`three.module.js:17686`), nothing in `src/` ever writes `material.visible`, it would draw *white*
if it drew at all, and 8×6 segments would read as a faceted octagon.

**Not a larger dark disc at all — that was a measurement error.** The original report described a
disc "roughly half the frame width." Hiding the moon mesh and differencing the frames puts **50% of
all changed pixels inside a 138.9 px circle at frame centre**, against the moon's predicted
**139 px / 9.53°**. The remainder is the retro renderer's frame-to-frame dither noise. ⛔ **A black
body against black space cannot be sized by eye; the earlier "constant angular size" and
"~450 px" readings were both artefacts of doing exactly that.**

## 3. THE ONE REAL LEAD

Across the transition, **only 4 of 67 numeric uniforms on the moon's material move**, and three are
trivial (`time` advanced 1.6; `starPos1`/`starPos2` drifted ~0.1 with orbital motion). The fourth:

> **`uReliefOctaves`: 9 (lit, radii 3.2) → 8.722759748483046 (black, radii 8)**

⚠ **No lighting uniform changes at all.** So the blackness is not driven by any uniform in
`material.uniforms` — which points at a shader reading three.js's auto-injected `cameraPosition`
directly, most likely in the relief/normal path, where a degenerate normal would kill the diffuse
term and leave the ambient floor to be posterized to 0.

⭐ This lands in known territory: the **approach-detail octave ramp** is the half of
[[well-dipper-approach-lod-criterion]] that is **not closed** — the ramp saturates around 6 body
radii. That the only mover is `uReliefOctaves` makes the ramp the first place to look.

## 4. SEPARATE CONFIRMED BUG, worth fixing on its own — `freezeFrame` teleports the system

`main.js:3200` `entry.orbitAngle = orbit` and `:3211` `moon.orbitAngle = orbit`, with
`orbit = declared.orbit ?? 0` (`:3178`). The journal `st` (`:3181-3187`) records only `rates`, so
`thawFrame` (`:3275`) **structurally cannot restore the angles** — there is no angle field to
restore. Measured live, above.

**A freeze that silently relocates every body in the system is destructive and irreversible within
a session.** ⛔ **Consequence worth checking: any past screenshot workflow that used `freezeFrame`
was photographing a relocated system.**

**Fix:** journal `orbitAngle` (and the surface/mesh spin) alongside the rates and restore them in
`thawFrame`; and default to `orbit = declared.orbit ?? null` meaning *leave the angle alone* — a
freeze should stop motion, not move the world. An explicitly declared angle stays available for
reproducible pairs.

## 5. TWO SMALL DEFECTS FOUND IN PASSING

- `main.js:7867` `moonObj.mesh.parent?.add(proxy) || scene.add(proxy)` — `Object3D.add()` returns
  `this`, always truthy, so the right-hand fallback is **dead code**.
- Creation attaches the proxy to `moonObj.mesh.parent` (`:7867`) but teardown hardcodes
  `scene.remove(...)` (`:7333`) — any future reparenting leaks proxies across rebuilds.
- ⭐ **The proxy carries no name and no `userData`**, unlike every other debug-relevant mesh in the
  repo (`assignName(...)` at `GravityWell.js:214`, `surface.userData.wd` at `Planet.js:2050`).
  Naming it would have turned a multi-workflow hunt into a five-second answer.

## 6. NEXT

Read the moon/planet fragment shader's use of `cameraPosition` and of `uReliefOctaves` in the
normal computation, and find what degenerates between camera distance 0.295 and 0.360.
The live characterisation above is complete enough that this is now a source question.
