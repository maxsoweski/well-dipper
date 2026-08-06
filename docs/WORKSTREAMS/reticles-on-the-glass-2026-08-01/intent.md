# reticles-on-the-glass-2026-08-01 — intent

## Why we care

Max, twice, and both times the same thing:

> "what I want is for the moon/planet/star reticles to be occluded by the cockpit so that they look
> like a HUD on the glass on the cockpit rather than something drawn directly on the player's eye"

> "In the new version of the game, where there's a cockpit and screens that give us all the info that
> previously used to be a non-diagetic hud. Except for the reticles. That's what should get occluded
> by everything in the cockpit other than the canopy, which would create that HUD-drawn-on-glass look."

The second quote is the one that settles the scope. The cockpit's **screens** are now the diegetic
home for everything the old non-diegetic HUD used to say. The **reticles** are the one thing that
stayed on the player's eye — and that is the remaining tell. Making them read as painted on the
canopy is what finishes the move into the cockpit.

**What this is NOT.** Max split this work himself and took the first half: **the geometry**. The
second half — reticles *looking* projected (canopy tint, glass-depth parallax, phosphor rather than
clean vector green) — is explicitly out of scope. Do not drift into it.

## Success criteria (Max's language)

- The reticles get "occluded by everything in the cockpit **other than the canopy**." Ribs, arches,
  monitor bodies, the fuselage, the arms — all of them. The canopy glass does not occlude, because
  it is the thing you are looking through.
- They read like "a HUD **on the glass** on the cockpit" — not "something drawn directly on the
  player's eye."
- Everything on the reticle layer is treated the same way. Asked what should happen to a target's
  floating **name label** when a rib covers its bracket but not the name, Max answered *"see previous
  answer"* — i.e. the label is part of the reticles, so it is cut by the cabin exactly like the
  bracket is. No special-casing, no per-element hiding rules.

## What "cut, not blinked" means, and why it is the whole point

What shipped in `5cd1118` tests the **centre point** of a target body against the cabin and hides the
**entire** reticle when it is blocked. A ~7 px rib therefore makes the whole bracket, label and all,
vanish and return whole.

A thing that disappears entire, in a shape unrelated to what is in front of it, is behaving exactly
like something drawn on the player's eye — arriving intermittently. Something painted on the glass is
**cut** by the rib: you see the part on clear glass and not the part behind the rib, and the boundary
is the rib's own silhouette.

`5cd1118` is not being reverted. A reticle fully behind a monitor body genuinely should be gone, and
it is. That behaviour must survive — it just falls out of a silhouette mask for free, so the
centre-ray *gate* is retired while the *outcome* it bought is kept.
