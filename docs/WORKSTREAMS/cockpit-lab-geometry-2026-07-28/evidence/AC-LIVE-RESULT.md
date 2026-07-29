# Live integration evidence — AC-FRAME and AC-LAB

**Commit:** `70f2e87` — the WIDE TUB (Max's second lab pass) · **Driven by:** working-Claude via
chrome-devtools, in-thread · **Date:** 2026-07-28
**URL:** `http://localhost:5179/well-dipper/cockpit-lab.html`

Supersedes everything below the fold. The `567bcf9` section that used to head this file measured
a 1.52 m cabin with the rail at −0.34; this build is a **2.56 m cabin with the rail at −0.26**,
so the enclosure and occlusion numbers are not comparable to it category by category.

## Why this file exists

`verify-workstream` with `liveBranch:"main"` deliberately does **not** drive a browser, so it
records every `live:true` AC as `INSUFFICIENT` and its adversarial pass correctly refuses commit
-message prose as evidence. A claim in a commit message does not close a live AC. This file is
the measurement.

## AC-FORM(a) — is it still an enclosure at the new proportions?

Solid-angle coverage around the eye, 16200 ray samples, from `cockpit-metrics.json`:

| sector (within 45° of axis) | coverage | required |
|---|---|---|
| **above** | **100.0%** | ≥ 97% |
| **left** | **100.0%** | ≥ 97% |
| **right** | **100.0%** | ≥ 97% |
| **behind** | **100.0%** | ≥ 97% |
| below | 100.0% | — |
| ahead | 86.5% | *the aperture — open by design, and the anti-vacuity check* |
| whole sphere | **98.0%** | — |

Every required sector improved to 100.0% (they were 99.1% at `567bcf9`). Widening the cabin
closed the last gaps at left and right: the shell now wraps past the shoulders with room to
spare rather than just reaching them.

## AC-FRAME — measured, no band

Driven live in the browser at eye view, 70° / 16:9 letterbox:

| | |
|---|---|
| **browser readback** | **0.6475728202160493** |
| analytic predictor | 0.647421 |
| gap | **0.015 pp** |

⚠ **This is the first build where the two do NOT agree to nine decimals.** The previous build
read 0.66969 against 66.97% analytic. 0.015 pp is 1.5 parts in ten thousand of the frame — about
300 px at 1920×1080, i.e. an edge-length effect, which is consistent with this build having
much thinner members (0.030 m where the last had 0.085 m) sampled by scanline analytically and
by rasteriser in the browser. **That is a plausible cause, not a demonstrated one.** It is
recorded rather than explained because AC-FRAME is measure-and-report and 0.015 pp changes
nothing; if a future build needs the predictor to be trustworthy at that resolution, this is
the thread to pull.

Composition, which moved much more than the 66.97% → 64.74% total suggests:

| category | marginal, previous build | marginal, this build |
|---|---|---|
| seam members | 14.74% | **5.74%** |
| bulkhead + floor | 19.98% | **32.73%** |
| screens + bodies | 31.67% | **24.97%** |
| arms | 0.58% | 1.30% |
| **TOTAL (union)** | **66.97%** | **64.74%** |

The member thinning and the screen distance both paid; the raised rail spent most of it. The
section lab's sweep predicted exactly that — rail height moves the tub's share of the view
46.1% → 4.8% over −0.15 to −0.75, and this build moved it 80 mm the expensive way.

## AC-FORM(c) — the screens are legible-sized, and now fully in frame

| | previous build | this build |
|---|---|---|
| display face | 0.246 × 0.205 m | **0.252 × 0.210 m** |
| distance (upper / lower) | 0.648 / 0.681 m | **0.840 / 0.781 m** |
| subtends (upper / lower) | 21.50° / 20.49° | **17.06° / 18.32°** |
| least-visible face | **85.4% inside the frame** | **100.0%** |

The angular floor AC-FORM(c) was amended to is 16.06°, so both pairs pass — with less headroom
than before. **The screens got angularly smaller and that is Max's choice, not a regression:**
he moved them further out in the lab, and a screen's tan-space footprint falls as 1/dist², which
is where 6.7 pp of the occlusion saving came from. Increment 2 has to make 17° legible.

## AC-LAB — the lab works

Hard-reloaded, GLB re-fetched (46 nodes / 45 meshes; the tub-only build is 18 / 17). Both views
driven from the console: `setMode('eye')` + `setLook(0,0)` for the pilot's seat, orbit for the
form. **Zero console errors.** Screenshots:

- `v10-wide-tub-forward.png` — orbit, the whole model
- `v10-wide-tub-eye.png` — pilot's seat with the lab's own readout visible (occlusion 64.76%)
- `v10-wide-tub-eye-clean.png` — pilot's seat with the DOM overlays hidden, for judging composition

## Defects this build found

1. **The seat fell 3.5 mm through the floor.** Not a tuning miss — `tub_floor_z()` evaluated the
   *profile*, and the exported mesh triangulates warped floor quads across a taper. Invisible at
   1.52 m, 3.5 mm at 2.56 m. Fixed by `hull_floor_z()`, which drops a ray onto the exported
   triangles; the old function is deleted rather than left dead.
2. **Both lower arms went fully invisible** behind their own screen boxes (0.0000% of frame
   against a 0.0500% floor) and the suite refused the build. `ARM_MOUNT_Y` 0.90 → 0.70.

Both were caught by instruments, not by looking — which is the point of having them.

## Test status

58 cockpit tests passed, **0 skipped** — AC-REPRO genuinely re-ran Blender twice and compared.
Full suite **1674 passed**; the 15 `vendor/motion-test-kit` collection errors are the documented
pre-existing baseline.

---

# Superseded — the `567bcf9` enclosure build

## Why this file exists

`verify-workstream` with `liveBranch:"main"` deliberately does **not** drive a browser, so it
records every `live:true` AC as `INSUFFICIENT` and its adversarial pass correctly refuses commit
-message prose as evidence. A claim in a commit message does not close a live AC. This file is
the measurement.

## AC-FORM(a) — is it actually an enclosure? (the headline of this re-spec)

Max's correction was that the build was a WINDOW and he wanted an ENCLOSURE: *"the player should
be situated with canopy above, in front, and to either side of them."* Turned into an instrument,
that is: cast rays from the eye over the whole sphere and ask how many find cockpit rather than
empty space, solid-angle weighted.

| sector (within 45° of axis) | coverage | required |
|---|---|---|
| **above** | **100.0%** | ≥ 97% |
| **left** | **99.1%** | ≥ 97% |
| **right** | **99.1%** | ≥ 97% |
| **behind** | **100.0%** | ≥ 97% |
| below | 97.0% | — |
| ahead | **21.2%** | *open by design — this is the aperture* |
| whole sphere | 79.9% | — |

AHEAD is deliberately unconstrained: the bow ring is the pilot's windscreen, and requiring
coverage there would be requiring a windscreen made of hull. It is *also* the anti-vacuity
check — an instrument that reported "covered" everywhere would pass a solid block as readily as
a cockpit, so the aperture is asserted to read as **open**.

Confirmed visually, which is the point of the re-spec — one forward screenshot cannot show this:

- `v3-eye-forward-70fov.png` — the pilot's seat at the game's real FOV
- `v3-eye-look-left-up.png` — 70° left, 30° up: canopy ribs, a screen and the shoulder rail
- `v3-eye-look-behind.png` — 178° round: the aft bulkhead fills the view
- `v3-orbit-enclosure.png` — the vault from outside

## AC-FRAME — measured, no band

Method: `window._cockpitLab.measureOcclusion({width:1920, height:1080, fov:70})` — renders the
cockpit alone into an offscreen RGBA target with clear alpha 0 and counts covered pixels.

| measurement | value |
|---|---|
| Measured occlusion | **0.4038377700617284** (40.384%) |
| Analytic prediction (generator, exact polygon clipping in tan-space) | 40.33% |
| Delta browser − analytic | **+0.05 pp** |
| Band | **none — AC-FRAME is measure-and-report at this stage** |

Marginal breakdown from the generator's own predictor, in the fixed order
members → hull → screens → arms: seam members 16.47% + bulkhead/floor 6.91% + screens and
bodies 14.95% + arms 2.00%. `Canopy_Glass` is excluded — it is see-through by design, and with an
enclosure that matters far more than it did with a window, since the vault now wraps the pilot
and would otherwise count as near-total occlusion.

⚠ **For Max's judgement, not a pass/fail:** 40.4% is up from ceb277e's 36.9%, and the reason is
that the screens are now fully visible (100% of each display face inside the frame, contributing
14.95%) where before they hid behind the frame and contributed 0.00%. Nothing was tuned toward
this number.

## AC-LAB — the lab works

| check | result |
|---|---|
| GLB loads | `ready` → `{loaded:true, error:null}` |
| Nodes present | 41/41, exact set — no `Hull_Nose`, no `Cockpit_Frame`, no `Canopy_Frame` |
| Bounding box (metres, glTF axes) | min `[-2.3076, -1.1695, -1.8744]` max `[2.3076, 1.3200, 1.1460]` — matches the sidecar |
| ORBIT mode | camera moves, OrbitControls active, fov 50 |
| EYE mode | `cameraPosition [0,0,0]`, `cameraFov 70`, letterboxed to 16:9 |
| Free look-around | `setLook(yaw, pitch)` added to the lab API — the render loop owns the look state, so setting `camera.rotation` from the console silently did nothing. Eye stays at the origin throughout. |
| Cabin light | OFF by default |
| Phosphor palette | WHITE `#EDE8DE` on black by default; `[P]` cycles WHITE → AMBER → GREEN → ICE |
| Console errors / warnings / assertions | **none** |
| Failed network requests | **none** |

## Planted-defect verification (the discipline the last build failed)

ceb277e shipped 48/48 green with three assertions that structurally could not fail. Every new
instrument here was therefore run against a deliberate fault:

| planted defect | outcome |
|---|---|
| member standoff sign flipped — structure bolted to the **outside** of the glass (*this is ceb277e's actual shipped defect*) | generator raised; with the generator's guard disabled the GLB exported and the suite went **RED** on *"holds every member INBOARD of the glass — signed"* |
| `Arch_Mid` lifted 0.30 m off its fold seam | generator raised (`AC-FORM(b)`) |
| arms unbolted, mount pushed 0.40 m inboard of its rib | generator raised (`AC-FORM(d)`) |
| roof-edge profile shifted | generator raised (arm bend below `ARM_MIN_BEND_DEG`) |

⚠ **Honest limitation.** A true "flat window" defect could not be planted at all: the vault is
parameterised as arch rings lofted fore-aft, and a single flat pane is *unrepresentable* in it.
That is the structural fix working as intended — the old form is no longer expressible — but it
means the JS enclosure assertion has not been shown red against a real window. It is instead
pinned from **both sides inside the test**: the four sectors must read ≥ 90% covered *and* the
forward aperture must read < 75% covered, so an instrument stuck on either answer fails.

## Test status

- `tests/cockpit-geometry.test.js` — **57 passed, 0 failed** (includes the 4 AC-REPRO tests that
  spawn Blender twice and compare decoded position/index buffers; they need the sandbox disabled
  or they skip).
- Full suite — **1669 passed, 4 skipped**. The 15 failing files are all
  `vendor/motion-test-kit/tests/*`, the known pre-existing collection errors.
- **AC-NOGAME**: `git diff master...HEAD -- src/` is empty. Zero pre-existing files under `src/`
  modified.

## Still open

`AC-UAT` — Max's alone, `deferred-to-max`. No agent renders it.
