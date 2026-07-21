# Critical code dig — is the proximity fade a patch? (2026-07-21)

Mission (Max, UAT round 3): "This fix reeks of a patch on top of an unresolved issue.
Let's handoff to a fresh session, where I want you to dig in and look at the code
critically." Plus the new finding: "I'm seeing some flickering happen on far-away
orbits when we are close to the orbit's plane."

## Verdict: YES — the fade is regime-avoidance, and the defect underneath is
## DEEPER than the round-2/3 diagnosis said

The shipped band math (`OrbitRingSDF.js`) measures distance to the circle in the
PLANE's domain (`g = length(pos.xz) - R`, world units) and converts to render
pixels by dividing by the per-pixel footprint (`fwidth(g)`). That domain choice —
not fwidth noise — is the root defect. At grazing view angles the footprint
legitimately explodes, and the three shipped mitigations each trade one artifact
for another:

- **0.4R clamp** (round 2, anti-smear): computes alpha from the CLAMPED footprint.
  When the true footprint exceeds 0.4R, alpha evaluates ~0 for fragments the RAW
  band test says are ON the curve → **rings vanish entirely**.
- **Smear cut** (round 2): discards raw-test failures — correct as far as it goes,
  but per-quad fwidth noise makes the raw test flip at the regime boundary.
- **Proximity fade** (round 3): keys on camera-to-CIRCLE distance, which is a
  CORRELATE of the failing regime (standing on the circle ⇒ grazing at your feet),
  not the regime itself (grazing geometry anywhere). The mid-range grazing case —
  Max's far-orbit flicker — has fade ≈ 1 and is fully exposed.

## The dead zone (NEW finding, not in any prior round's record)

Lab (`orrery-orbit-lab.html`, all measurements at 1/3-res sceneTarget 657×282,
fade neutralized where noted):

| camera pitch above plane (mid-system, [3000,0,0], dist 25) | LineLoop px | shipped SDF px | analytic-estimator px |
|---|---|---|---|
| 0.002 | 657 | **0** | **0** |
| 0.005 | 1242 | **0** | **0** |
| 0.01 | 1029 | **0** | **0** |
| 0.02 | 960 | **0** | **0** |
| 0.05 | 926 | **0** | **0** |
| 0.1 | 858 | 123 | 75 |
| 0.2 | 657 | 561 | 517 |

Within ~3–6° of the orbit plane at mid-range, **shipped rings do not render at
all** where the old LineLoop drew a solid visible line. Discriminator: setting
band width to 50 px paints 483 px at pitch 0.01 → fragments EXIST; the clamp's
alpha kills them (not raster starvation). Max's "far-away orbits flicker near the
plane" is the boundary of this dead zone crossing under camera drift.

Screenshots: `dig-midrange-baseline-visible.png` (line present) vs
`dig-midrange-sdf-empty.png` (nothing) — same pose.

## Estimator-noise hypothesis: REFUTED as primary (probe: 'analytic' lab mode)

Swapping fwidth for the exact per-pixel plane→screen Jacobian gradient (zero quad
quantization) — the round-3 handoff's leading repair idea:
- Dead zone: unchanged (0 px — the clamp, not the noise, is the killer).
- Grazing toggles @5200: 309.8 vs shipped 322.0 (−4%; LineLoop floor 214.6).
- Gentle control: 158.3 ≈ shipped 158.5. No regression.
- Near-field structure: visibly smoother band, tearing reduced but present-class.

Quad noise is real but SECONDARY texture on top of the domain defect.

## Domain-correct candidate: PROVEN in-lab ('conic' lab mode)

Each ring's circle projects to a conic; the CPU builds the screen conic per ring
per frame (H = screen∘[P·V·M cols x,z,w]; Cs = H⁻ᵀ·diag(1,1,−R²)·H⁻¹); one
fullscreen pass paints pixels by Sampson distance |pᵀCs p|/|2(Cs p).xy| — screen
pixels measured IN screen space. No derivatives, no clamp, no smear cut needed.

| scenario | metric | LineLoop | shipped SDF | conic |
|---|---|---|---|---|
| mid-range in-plane (pitch .01) | painted px | 1314 | 0 | **1314 (identical px)** |
| same, drift 90f | toggles/frame | 0.8 | 0 (invisible) | **0** |
| grazing @5200 (pitch .002) | toggle-per-green | 0.118 | 0.184 | **0.125** |
| gentle control (pitch .35) | toggles/frame | 162.6 | 158.5 | **154.9** |
| perRingLadder 7×13 | anti-vanish regressions | — | 0 | **0** |

Near-field (standing on the ring, fade off): clean stable solid lines — the
tearing/blotch structure is GONE (`dig-nearfield-conic.png` vs
`dig-nearfield-sdf-fadeoff.png`). Overview look preserved
(`dig-overview-conic.png` vs `dig-overview-sdf.png` — same chunky retro).

**Honest flags for a real implementation:**
- Sub-pixel rings persist as dots at extreme range (Sampson degeneracy) where
  other modes drop out — needs the AC3 fade factor (exists) or an angular-size
  cutoff. Ladder rows: moon rings visible at 4 far distances vs 0 elsewhere.
- Probe has no depth write; real impl reconstructs the plane point per pixel
  (already computed for the front-branch guard) → log-depth `gl_FragDepth`, same
  per-fragment-depth cost class as today's rings.
- Exact-in-plane degenerate conic (camera y=0): Sampson on the double-line conic
  is stable but ~2× distance error — needs one lab check at |camY| < 1e-3.
- Hover opacity / AC3 factor / prox fade all become per-ring uniform floats
  (prox fade is already camera-only ⇒ CPU-computable exactly).
- Replaces 39 quad draws with 1 fullscreen draw (loop over ring array) — also
  removes today's 39×-overdraw + frustumCulled:false + early-Z-disabled cost.

## Also noted in the critical read (no action taken)

- `extensions: { derivatives: true }` + the GLSL-ES-1.00/WebGL1-fallback
  rationale in OrbitRingSDF comments is dead: three r0.183.1 removed WebGL1
  support at r163. Harmless, but the comments justify constraints that no
  longer exist (incl. the proxfade test's `inverse(` pin rationale).
- Rigid-transform pin VERIFIED: `placeInRebasedFrame` is translation-only; moon
  rings set position + rotation.x only; no ring mesh is ever scaled.
- Composite double-alpha: sceneTarget blend then `mix(bg, scene.rgb, scene.a)`
  applies ring alpha twice (≈α²) — systemic to all transparent scene objects,
  not a flicker cause; noted for completeness.

## What this means for the open items

- The fade can stay as UX (a line you stand on carries no information) — but it
  is NOT the fix for either artifact. If the conic pass ships, the "orbits
  disappear a little too early" taste item (round-3 item 3) may dissolve or be
  re-tuned against a working grazing render.
- A conic-pass build is a STRUCTURAL rework of OrbitRingSDF's render path →
  dev-collab-scope interview, Max's ratification (AC5 anti-vanish + chunky-retro
  pins re-verified; ladder + drift instruments now cover all four modes and are
  the acceptance harness).

Lab work committed at `e961dfd` (prod files untouched; suite 1330/1330 with the
known vendor collection noise; byte-guards EMPTY).
