# Live pass — the cockpit's key light is the system's star

**2026-07-30.** Commit `3e74bf1`. Booted splash → title → HELM → warp, HELM in
**13.7 s**. Console: the one pre-existing `willReadFrequently` warning, zero
errors. Suite **2409 passed / 4 skipped** + the 15 known vendor collection
errors.

Screenshots:
`starlight-star-astern-2026-07-30.png` · `starlight-star-off-starboard-beam-2026-07-30.png`

---

## The instrument

`window._cockpitKeyLight()` reads **the light object the renderer will use** —
`_cockpitRig.keyLight.position`, its colour and its target — and NOT
`_cockpitStarLight()`, which returns what main.js *decided*. The two look
identical from the computed side whenever `setStarLight` is never reached, the
`role: 'key'` tag stops matching, or a host passes `lights:` of its own. This
lane has now needed that distinction seven times.

## What was measured

At arrival, pointed at the star:

```
dirFromPilot [0, ~0, -1]    offNoseDeg 0.0    color e6ecff    intensity 2.2
```

`(0,0,-1)` is straight out through the canopy, which is where the star is. The
colour is the star's own: the system's primary is class **A**, and
`StarSystemGenerator`'s table gives A `[0.79, 0.84, 1.0]` — blue-white. The
authored default this replaced was `fff2e0`, warm, at a fixed
`[-30, 50, -60]` that never moved.

### ⚠ The first control ran and proved NOTHING — recorded because the reading looked like a pass

Twenty seconds of sampling during the arrival tour: `offNoseDeg` held at 0.0 the
whole time. That is consistent with a correct implementation *and* with one that
ignores the ship entirely — because `shipOffAxisDeg` also held at **0.04°**. The
hands-off tour was not turning `scModel` at all, so there was no input to
respond to. **A control against a stationary subject is not a control.** Two
runs were spent on this before the constant in the second column was noticed.

### The control that discriminates — a real turn, hands-on

`F` to hands-on, stick parked to starboard, sampled every 2 s:

| t (s) | light off-nose ° | hull off-axis ° | direction in the cabin |
|---|---|---|---|
| 0 | 0.0 | 0.0 | `[0, 0, -1]` — out through the canopy |
| 2 | 42.4 | 40.7 | `[-0.67, 0, -0.74]` |
| 4 | 87.5 | 81.4 | `[-1.00, 0, -0.04]` — off the port beam |
| 6 | 132.5 | 121.8 | `[-0.74, 0, 0.68]` |
| 8 | 175.2 | 162.5 | `[-0.08, 0, 1.00]` — astern |
| 10 | 144.8 | 156.4 | `[0.58, 0, 0.82]` |
| 12 | 106.7 | 115.0 | `[0.96, 0, 0.29]` |
| 14 | 86.4 | 92.5 | `[1.00, 0, -0.06]` — off the starboard beam |

**The light swept 175.2°** and walked all the way round the cabin. With the
hull's heading dropped from the transform — the failure mode this shares with
`b5e0d30`, in mirror image — column two would have stayed at 0.0 while column
three did exactly what it does here.

The two columns co-vary without being equal, which is correct and worth stating
so a later reader does not "fix" it: `offNoseDeg` is the angle from the nose to
the star, `shipOffAxisDeg` is the hull's rotation away from identity. Different
quantities, same cause.

## What it looks like

- **Star astern** (`offNoseDeg` 157.8°): the light rakes the monitor bezels,
  arms and rails from behind. Those surfaces read as physical objects; in the
  before-state they were near-black.
- **Star off the starboard beam** (`offNoseDeg` 96.0°): the port structures —
  the NAV and INFO bezels, the nose below the rail — are lit and the starboard
  side falls into shadow. The cabin is asymmetric, and the asymmetry tracks the
  turn.

## What this does NOT establish, named rather than left to be discovered

- **No shadows.** Nothing occludes anything: a rib does not darken the hull
  behind it. `shadowMap` appears nowhere in this project, and enabling it is
  RENDERER state — which `CockpitRig`'s standing contract forbids it to touch,
  because the renderer is shared with the world pass and RetroRenderer. A real
  design question, deliberately not answered here.
- **No falloff.** Intensity is constant at 2.2 regardless of distance to the
  star. Physically wrong on purpose; the alternative is a cabin that goes black
  at the system's edge, and how much it *should* dim is Max's eye.
- **Binaries use the primary only.** One key light. The secondary is ignored,
  which for a close pair is a visible simplification.
- **The canopy glass was not touched.** It is a `MeshStandardMaterial` at
  `opacity: 0.10`, so it does take the new light — but nothing was done to make
  it *catch* it (no specular treatment, no rim, no refraction). Half of Max's
  ask; the other half is still open.
- **Colour was verified on ONE star class** (A, `e6ecff`). The M-dwarf and
  O-star ends of the table are unit-tested only.
