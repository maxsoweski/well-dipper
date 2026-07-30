# Live pass — the canopy glass

**2026-07-30.** Commit `d4d3fb5`. Driven in **both hosts**, which is the point.
Suite **2414 passed / 4 skipped** + the 15 known vendor collection errors.
Console: zero errors in the lab, zero in the game.

Screenshots: `glass-lab-star-58deg-2026-07-30.png` ·
`glass-ingame-star-astern-2026-07-30.png`

---

## ⭐ The first design was backwards, and the measurement is what said so

The canopy was given `metalness: 1` with a dim colour, on this reasoning: a metal
has no diffuse term, so under additive blending only the SPECULAR lobe survives —
pure glare, one knob for tint and strength, fresnel free. It is a tidy argument
and it rendered **almost nothing**.

Rather than tune the numbers, the mesh was measured. Probe walked all of
`Canopy_Glass`'s triangles, computed each world normal against the eye and
against the light:

```
Canopy_Glass   tris 20   frontFacingToEye 20   canSpecular 8
```

Two facts fell out. **All 20 normals point INWARD, at the pilot** — nothing is
being backface-flipped, so what is lit is the inner surface, as authored. And
8 of 20 satisfied `N·L`, so the surface *could* respond — the material was not
inert.

Which located the real error: a specular highlight requires the light's
**reflection** to reach the eye, and the pilot is INSIDE the canopy while the
star is OUTSIDE it. There is no geometry in which an external star reflects off
the inner surface into the seat. It is a transmission problem wearing a
reflection's clothes, and three's standard material does not do transmission.

**What a canopy does from the seat is let light through onto the inside.** With
`metalness: 0` the diffuse term lights each pane by how squarely the star faces
its inner surface — so a star off the **starboard** beam lights the **port**
panes, exactly as sunlight through a window falls on the far wall. Confirmed by
eye at azimuth 55°: port panes lit with a clean gradient, forward pane clear.

That the pane you look straight through stays clear is not a defect. Its inner
normal faces *you*, not the star.

## Additive, and what it bought

The old treatment alpha-blended 10% of a lit surface over the world — a faint
white fog across the one thing the canopy exists to let you see through.
Additive cannot fog: it adds where lit, adds nothing where it is not. **The view
through the canopy is measurably clearer than before, not dimmer.** `depthWrite`
stayed `false`, still doing its original job of not occluding the four screens.

## The lab now has a star, and that was not optional

Before this, `cockpit-screens-lab.html` never called `rig.setStarLight`. The lab
kept the authored default direction forever while the game aimed at a real star
— two hosts rendering visibly different cabins, with **every**
`DEFAULT_COCKPIT_LIGHTS` assertion green, because the defaults *are* identical
and the divergence was the absent CALL.

The lab now drives the same setter from STAR AZIMUTH / STAR ELEVATION sliders
and a `[J]` sweep. A sweep is instant; the equivalent look in the game costs
~35 s of boot plus a warp.

⚠ **A second divergence was caught by reading a probe, not by a test**: the rig
shipped `0x2e3a4a` (blue-tinted) while the lab's slider opened neutral, so the
two hosts differed from the first frame. Fixed by making the shipped albedo
neutral grey — the tint is the *star's* job — and `hostLightingParity.test.js`
now pins both failures.

## In the game

Verified through `RetroRenderer`'s palette remap, which the lab does not have.
It survives it: the canopy takes a faint blue lift and the surrounding bezels,
arms and rails light with it. **It reads noticeably subtler in the game than in
the lab** at the same 0.29 — the game's composite and tone path are darker. That
is a knob, not a bug: GLASS GLOW is exposed for exactly this judgement and it is
Max's eye that settles it.

## What this does NOT establish

- **Subtlety in-game is unjudged.** 0.29 is a starting value chosen in the lab,
  and the game renders it dimmer. Nobody has said it is right.
- **No refraction.** Increment 3's screen-space refraction remains unbuilt; this
  is a lighting response, not a distortion of what is behind the glass.
- **No interior reflections.** A real canopy mostly shows you the dashboard
  reflected back. Nothing here does that.
- **`glare.metalness` is exposed but shipped at 0** and the glint path was only
  looked at, not tuned.
- **One star class in the game** (the arrival system's), plus the lab's synthetic
  neutral star. The amber end of the spectral table is unit-tested only.
