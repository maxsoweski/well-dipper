# agent-camera-api-2026-08-10 — intent

## Why we care

Max, 2026-08-10:

> "we pretty obviously need to build/modify a better system for you to drive in orrery, snap to
> planets/moons/stars at various radii without having to use the human interface"

And his ruling on which front-ends: **include the lab page**, so both can be framed by the same
code and produce paired A/B stills.

The thing underneath the request is the approach-consistency criterion Max stated on 2026-08-10:

> "in the lab, I can get really close and the LOD stays pretty consistent... as opposed to getting
> closer and closer to a beach ball painted to look like a planet. This is critical to the visuals
> working, even though we are using a lo-fi aesthetic."

That criterion **cannot currently be measured at all.** Answering it means putting the camera at a
known multiple of a body's radius on each front-end and reading back what the renderer actually did
there. Today that is a session of hand-work per data point, and the two most recent attempts to do it
by script both failed *silently* (see the traps below). This workstream turns that into one call.

## Line of sight to the outcome

Tooling, not player-facing. It serves the World Engine program's **lab-pipeline-into-game** track by
making the approach-detail half of Max's criterion (PLAN §LAYER 7) measurable. It is a precondition
for that build, not the build itself — nothing here makes a planet resolve better; it makes "does it
resolve?" answerable in one command instead of a session.

## What this is NOT

- **Not the in-motion HELM approach.** `commitBurn()` swaps to HELM and there the director owns the
  camera. This frames in ORRERY. Stills at a ladder of radii answer "does detail keep resolving?";
  they do not answer "how does the approach feel in motion." Declared out of scope, not overlooked.
- **Not a fix for approach detail.** The sweep will most likely *print* the saturation (the octave
  budget pinned at 9 from 6 body radii inward). Printing it is the deliverable; fixing it is PLAN
  §LAYER 7, which Max ruled comes after Step 7.
- **No AC-0 spine conformance.** Rule 15 attaches AC-0 to world-engine increments. This reads no
  D-slot, emits no field, and registers no lab control or preset — the three checks have nothing to
  bind to. Including one would be ritual. Judgment recorded here rather than left implicit.

## The three traps this design exists to defeat

Each was paid for in a previous session; each is why an obvious-looking implementation fails.

1. **The game overwrites a written camera every RAF.** `CameraInterpolator.applyTo`
   (`src/core/CameraInterpolator.js:71`) lerps from its own snapshots. `_lab.setCameraPose` never
   calls `cameraInterp.resync(camera)`. The symptom is silent and actively misleading — it returns
   `posDelta: 0`, `bypassed: true`, and `cameraPose()` still reads what you set, while the camera is
   348 units away one frame later.
2. **The lab overwrites a written camera every frame too**, for a different reason: `frame()`
   recomputes `camera.position` from `state.distance/yaw/pitch`
   (`world-engine-lab.html:4896`). So on *both* front-ends the API must write the state the frame loop
   reads, never the camera object.
3. **The game rebases coordinates.** `cameraPose().position` and `mesh.matrixWorld` are in different
   frames — a camera genuinely at 1.8 body radii measured as 26,824. The rebase-immune method
   already exists and is used by `_lab.shotState` (`getWorldPosition` + `getWorldScale`); this reuses
   it rather than re-deriving it.

## Success criteria (Max's language)

- I can tell you "put me at 2 body radii on planet 3" and you do it, on either front-end, without
  touching the human interface — and it *stays* there.
- The answer comes back with what you actually achieved, not what I asked for. If the renderer
  clamped me at its floor, I see the number it clamped to.
- The answer tells me what the renderer was doing at that distance — how much detail it had turned
  on — so a side-by-side is two pictures **with numbers attached**, not two pictures.
- I can ask for the whole approach in one go: walk a planet from far out down to nearly touching it,
  and give me the table. That is where I see whether detail keeps resolving or whether I'm flying at
  a beach ball painted to look like a planet.
- Stars and moons work, not just planets.
