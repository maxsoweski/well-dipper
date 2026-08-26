# FINDING — the global relief-amplitude uniform is radius-blind AND gravity-frozen

**Filed 2026-07-28 out of the g(R) grounding. NOT fixed here — Max's ruling was "build g(R) alone,
file the wiring gap." This is the file.**

**Status:** open, unscoped. Needs its own workstream.
**Class:** broken feed. Same family as the census's frozen-`_fp` finding and Max's own R1-ship
observation (a), verbatim: *"i do suspect that many of these legacy shader systems are not fully
wired up into our proc gen model though."* This is a third instance of that pattern.

## What it is

`uniforms.uPerturb.value` — the global relief-amplitude uniform, i.e. how tall the terrain is — is
computed from a gravity that **cannot move with the radius slider**, and multiplied by an envelope
that **discards the radius argument it is handed**.

```
world-engine-lab.html:2999   const u = deriveUniforms(DRIVER_PRESETS[driverUI.preset], driverUI.qualityTier);
world-engine-lab.html:3016   state.surfaceGravity = u.surfaceGravity;          // <- SOLE writer
world-engine-lab.html:5903   const _RE = state.planetRadiusEarth, _gNow = state.surfaceGravity ?? 1.0;
world-engine-lab.html:5908   uniforms.uPerturb.value = state.perturb * reliefEnvelope(_RE, _gNow);
```

`grep -n "state\.surfaceGravity" world-engine-lab.html` returns exactly three hits: `:3016` (the sole
writer), `:4261` (a disabled GUI readout), `:5903` (this read).

`deriveUniforms` computes gravity from the **canonical** preset radius, never the drawn one:

```
planet-lod-lab-core.js:609-611
  const radiusEarth = d.radiusEarth ?? 1.0;
  const massEarth   = d.massEarth ?? 1.0;
  const surfaceGravity = massEarth / (radiusEarth * radiusEarth);
```

And the envelope throws its first argument away:

```
planet-lod-lab-core.js:1103-1105
export function reliefEnvelope(radiusEarth, surfaceGravity) {
  return Math.min(RELIEF_CEIL, Math.max(RELIEF_FLOOR, Math.pow(Math.max(surfaceGravity, 1e-3), -Q_RELIEF)));
}
```

So `uPerturb` is radius-invariant **twice over**: once because `radiusEarth` is unused, once because
the `g` it receives is the frozen canonical value rather than `condition.surfaceGravity`.

## Why it matters more than a normal wiring bug

It makes an **in-source comment false**. `planet-lod-lab-core.js:1088-1099` justifies dropping the
old explicit `1/RE` term on exactly these grounds:

> *"Post-v2-6 `deriveConditionVector` sets `surfaceGravity = g_c·(R/R_c)`, so g is MONOTONIC in the
> drawn radius at fixed composition — **g ALREADY carries the radius signal**. Radius therefore flows
> through g exactly ONCE (the audit footnote-14 double-dip resolved) and the explicit 1/RE is DROPPED."*

The reasoning is sound *about the condition vector*. But the call site at `:5908` does not pass the
condition vector's gravity — it passes `state.surfaceGravity`, the canonical one. **The radius signal
the comment relies on never arrives.** The `1/RE` term was removed on the strength of a channel that
was not connected to this consumer.

Net effect today: dragging the radius slider does not change global relief amplitude at all, on any
preset. That is not what any of the three surrounding comments describe.

## Blast radius of a fix (why it is not a one-liner and must not be bolted onto a physics change)

Repointing `:5908` at `condition.surfaceGravity` is a **visible-render change on every preset
simultaneously** — it turns a currently-inert lever live across the whole preset table at once. It
also interacts with two live decisions:

1. **`RELIEF_FLOOR = 0.40`.** The v2 relief audit already flags that at the corrected exponent it
   binds at R = 1.40 R⊕ and would clamp the entire super-Earth branch flat. Connecting the feed
   *before* that floor is re-derived would ship the clamp as the visible behaviour.
2. **`reliefEnvelope`'s unused `radiusEarth` argument.** Whether it should be used at all is a live
   question in the v2 derivation (the `E = h/R` versus `h` framing). Wiring the feed without settling
   that decides it by accident.

So the honest sequence is: **g(R) (this workstream) → v2 relief law → then this fix**, at which point
the floor and the frame are settled and connecting the feed is a decision rather than a surprise.

## What would settle the open question

The grounding could not determine whether this state is *known and accepted* or *a live defect*.
Neither is proven. To settle it, read
`docs/WORKSTREAMS/world-engine-inc3-relief-spine-depthlaw-2026-07-21/BUILD-NOTES.md` and
`world-engine-radius-live-feed-2026-07-25/intent.md` for an explicit disposition; if none exists,
it is a defect by default and this file is its first record.

## Scope qualifier — do not overstate this

The g(R) fix is **not** made invisible by this. `condition.surfaceGravity` still reaches the rendered
surface through the World Engine writer/carrier path — `bombardment.js` → `carrier.craterField` and
`reliefBudget.js` → `compositeMargins` weights — and the baked carrier is blended in via
`uReliefBakeStrength`. What is inert is the **global relief-amplitude uniform** specifically. That
distinction is carried into the g(R) contract's AC-UAT as a disclosed carve-out, so Max is not sent
looking for something that cannot happen.
