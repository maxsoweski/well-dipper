# Live integration evidence — AC-FRAME and AC-LAB

**Commit:** `1056f30` · **Driven by:** working-Claude via chrome-devtools, in-thread
**Date:** 2026-07-28 · **URL:** `http://localhost:5179/well-dipper/cockpit-lab.html`

## Why this file exists

`verify-workstream` ran with `liveBranch:"main"`, which means it deliberately does **not**
drive a browser — live integration checks are working-Claude's job from the main thread
(`~/.claude/docs/dev-collab-os.md`). Its `verdict.json` therefore records AC-FRAME and AC-LAB
as `INSUFFICIENT`, and its adversarial pass was right to refuse the numbers in my commit
message as evidence: a prose claim is not a measurement. This file is the measurement.

Both ACs are `layer: integration`, `live: true` — objective, agent-drivable, and NOT UAT.
Driving the running app is a tool; it does not make a check UAT
(`dev-collab-scope/reference.md`, objective-vs-holistic litmus).

## AC-FRAME — "classic cockpit" as a measured number

> 25–30% frame occlusion from the eye at the origin, 70° FOV, 16:9. "Outside that band is a
> FAIL, not a judgement call."

Method: `window._cockpitLab.measureOcclusion({width:1920, height:1080, fov:70})` — renders the
cockpit alone into an offscreen RGBA target with clear alpha 0 and counts covered pixels.

| measurement | value |
|---|---|
| Measured occlusion | **0.275727237654321** (27.573%) |
| Analytic prediction (generator, exact polygon clipping in tan-space) | 0.27575 (27.575%) |
| Delta browser − analytic | **−0.0023 percentage points** |
| Band `[0.25, 0.30]` | **PASS**, mid-band |
| Repeat call, same session | bit-identical `0.275727237654321` |
| With CABIN LIGHT on vs off | bit-identical — the readback counts alpha coverage, not luminance |
| View state after measurement | unchanged (mode still `eye`) — the instrument is pure |

Breakdown from the generator's own predictor, corroborated to within 0.05 pp by an independent
Möller–Trumbore raycast during review: frame 22.78% + nose 4.80% + **screens 0.00%**. The
screens contribute nothing, which is the point — see BUILD note below.

## AC-LAB — the lab actually works

| check | result |
|---|---|
| GLB loads | `ready` → `{loaded:true, error:null}` |
| Nodes present | `Cockpit_Frame, Eye_Point, Hull_Nose, Screen_LL, Screen_LR, Screen_UL, Screen_UR` (7/7) |
| Bounding box (metres, glTF axes) | min `[-2.0846, -1.9180, -3.0000]` max `[2.0846, 1.1544, -0.7500]` — matches the generator's declared sidecar |
| ORBIT mode | camera moves, OrbitControls active, fov 50 (inspection only) |
| EYE mode | `cameraPosition [0,0,0]`, `cameraFov 70`, letterboxed to 16:9 |
| Eye position after mode round-trips + measurements | still exactly `[0,0,0]` |
| Console errors / warnings / assertions | **none** |
| Failed network requests | **none** |
| Background visible through the aperture | yes — starfield, horizon grid and a distant body all read through the opening (see screenshot) |

## Screenshots

- `eye-view-70fov-16x9.png` — the pilot's seat at the game's real FOV, letterboxed to the exact
  framing AC-FRAME measures. This is the view AC-UAT is judged from.
- `orbit-view-screens-hilited.png` — exterior orbit with `[S]` screen tint on, showing all four
  panels seated on the chamfered corners of the octagonal aperture, plus the nose wedge.

## Note on the cabin light

`1056f30` added a toggleable in-cabin point light. It is a **lab aid, not a design decision**.
With key+fill alone the interior frame faces render almost black — physically honest, since the
only light source is outside the ship, but it made the form unjudgeable, and AC-UAT cannot be
rendered on a cockpit Max cannot see. `[L]` turns it off for the true unlit read. In increment 2
the four CRT panels become the real in-cabin light source and this goes away.

It is proven not to contaminate the AC-FRAME instrument (identical occlusion on and off, above).

## Still open

`AC-UAT` — Max's alone, `deferred-to-max`. No agent renders it.
