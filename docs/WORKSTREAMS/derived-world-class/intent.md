# derived-world-class — intent

## Why we care

Max, 2026-09-04, after his walk:

> *"Well, it sounds like we have a bunch of systems here that are not talking to each other. The most
> obvious candidate for a fix is the label. It sounds like the label is just randomized and isn't
> actually reading the history of the planet. Am I understanding that correctly?"*

Half right, and the correction is what makes this scopeable. The label is **not** randomized — it is a
zone-weighted roll over real Kepler occurrence rates. But it is drawn **FIRST**, and then it *chooses*
the radius, the mass, the atmosphere, the moon count and the palette. So the label is UPSTREAM of the
physics. "Make the label read the physics" is a LOOP, not a relabel.

The split: the roll KEEPS its job as a **formation seed**; a **derived class** is computed from the
finished body and is what anything descriptive reads.

**It is the same bug shape as the volatile-delivery fix just shipped** — one name doing two jobs
(`iceFraction` was accreted bulk AND surface inventory; `type` is formation seed AND description).

**Why it is first, ahead of the snow and the lighting:** it is a DISCOVERY problem. Measured over 200
seeds / 476 solid planets: 11 of the 14 genuinely warm-and-wet worlds carry some other name, and all 7
worlds the game calls `ocean` are hot and dry (median surface temperature 355 K). The galaxy cannot
tell you where its habitable worlds are. That is about finding a place worth flying to, not tidiness.

## Success criteria (Max's language)

- Every world the game calls an ocean world actually has water on it — and no world carries a name its
  own physics flatly contradicts (a cold lava world, a boiling ice world).
- When I fly to a warm wet world, the panel tells me that is what it is, instead of calling it a rock.
- I can spot a habitable world on the system map before I fly to it.
- When I ask the game to find me a habitable planet, the ones it hands me are habitable.
- Nothing about how the planets look, how big they are, or how many moons they have changed.

## Max's ruling on scope, 2026-09-04

**A warm, wet world two or three times Earth's mass counts as habitable.** Chosen over reusing the
renderer's existing Earth-mass band. Consequence: 14 habitable worlds per 200 systems instead of 5,
and the classifier gets its own bound rather than borrowing a rendering constant that could later move
for visual reasons and quietly start the HUD lying again.

## Deliberate non-goals

- **NOT a rendering change.** Confirmed live: the world-engine planet material carries no `planetType`
  uniform. This changes what the HUD, orrery and search TELL you, never what a planet looks like.
- **NOT a fix to `habitability` (D15).** The game already stores a physics-derived habitability score
  on every planet and it is unusable as a classifier: it has **no water term at all**, so 189 of the
  462 non-habitable bodies score at or above the lowest genuinely habitable one, and a Venus medians
  0.80. Measured, not assumed. It is left exactly as it is; the derived class does not read it.
- **NOT the `locked` gate (report Block B).** Still parked, still eats 74 % of bodies, still gets its
  own session.
- **NOT the two carbon thresholds.** `compositionClass` cuts carbon at C/O > 1.0 while
  `deriveComposition` cuts `surfaceType` at C/O > 0.8. A genuine second instance of the same
  one-name-two-meanings shape, found while scoping. Logged here, not fixed here.
