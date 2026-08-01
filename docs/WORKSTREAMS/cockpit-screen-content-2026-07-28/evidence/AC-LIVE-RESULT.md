# Live integration results — cockpit-screen-content-2026-07-28

Driven by working-Claude via chrome-devtools against the real game on Max's dev
server (`npx vite --port 5180`, Vite 7.3.1, `http://localhost:5180/well-dipper/`).
Date: 2026-07-28. Commits under test: `de48ea4` → `1219a34`.

`verify-workstream` with `liveBranch:"main"` drives no browser by design and
returns `INSUFFICIENT` on every `live: true` AC. These are the live drives.

---

## AC-SNAPSHOT — **PASS**

> "The screens read the game through ONE read-only feed, taken once a frame... Poke
> the snapshot anywhere, at any depth, and the ship doesn't move."

### Setup

Title screen dismissed, HELM chosen at the mode picker (`#splash-mode-helm`),
hands-off tour running. System `ZTA J3DUJSVG+NYPIQCP`, 4 planets.

`typeof window._cockpitSnapshot === 'function'` from the first frame; it returns a
well-formed snapshot on the splash screen too, before any system exists —
`system` null is a normal state, not a skipped frame.

### 1. The feed is live and taken once a frame

`t` (simClockMs) and `renderDt` both advance; `drive.speedCap` / `turnRateCap`
return real computed values (`692.43`, `0.668` under way). All four blocks
populate: `regime`, `drive`, `target`, `survey`, `nav`, `warp`.

### 2. Poke at every depth → nothing lands (the core assertion)

Run A, star focused — **48 writes attempted**, max depth 2.
Run B, planet focused (`Aglodus`, so `survey.composition` / `tidalState` /
`surfaceHistory` are present and get written into) — **58 writes attempted**,
max depth 2, descending into the nested physics objects and their fields.

| Check | Result |
|---|---|
| `JSON.stringify(A).includes('__POKED__')` — the poke really happened, so the test is not vacuous | **true** |
| `__POKED__` sentinel anywhere in `window._sc.model` | **[] — none** |
| `__POKED__` anywhere in `window._warpTarget` | **[] — none** |
| `__POKED__` anywhere in `window._getReticleState()` | **[] — none** |
| `__POKED__` anywhere in `window._sc.tuning` | **[] — none** |
| `__POKED__` anywhere in **`window._systemData`** (the shallow-copy aliasing target, depth 6) | **[] — none** |
| `window._systemData` planets' `composition` / `tidalState` / `T_eq`, serialised before vs after | **identical** |
| A **fresh** snapshot taken after the writes | **clean — no `__POKED__`** |

`window._systemData` is the one that matters: `scenePlanetData = { ...entry.planetData }`
is a SHALLOW copy, so `_systemData.planets[i].planetData.composition`,
`planet.data.composition` and `planet.physics.composition` are all one object,
globally reachable. Poking the snapshot's copy left it untouched.

### 3. One field drifted — and a control proves it is ambient

`drive.speedCap` differed across the poke window. `speedCap()` and `turnRateCap()`
are **functions of ship position** and the ship was flying.

Control, with **zero** poking, 120 ms apart: `19.624 → 19.919`, `capDrifted: true`,
`turnDrifted: true`. So the drift is the sim running, not a write landing. Without
this control the earlier `liveSourcesUnchanged: false` would have read as a failure.

### 4. Change real state → B differs in exactly those fields

Ambient baseline first — two snapshots, no input, 400 ms apart:

```
t · renderDt · drive.speed · drive.commandedSpeed · drive.speedCap ·
drive.turnRateCap · target.distance
```

Every action below is reported as *fields changed beyond that ambient set*:

| Action | Fields changed beyond ambient |
|---|---|
| Cut the drive (`setDrive(false)`) | **`drive.driveOn`** — exactly one |
| Step the throttle (F for the stick, then hold W) — `0.75 → 1` | **`drive.throttle`** — exactly one |
| Focus a different planet (`Aglodus` → `Derba`, via `autoNav.jumpToPlanet`) | **`survey.name`, `survey.type`, `survey.tEq`, and the 4 `survey.composition` fields that differ** — and no others |

`survey.tEq` moved `417.30 → 147.45` K. Across all four planets `T_eq` reads
`417.30 / 285.94 / 211.11 / 147.45` K — falling with orbit distance, physically
sensible, and a readout that has never existed in the game before.

### 5. Cross-checks against the live sources

- `snapshot.target` = `{kind:'planet', name:'Aglodus'}` **agrees exactly** with
  `window._getReticleState().selected`.
- `survey.kind:'star'` while a star was focused, with **`tEq: null`** — stars carry
  `temp` (photospheric), never `T_eq`. The two are not substituted.
- `survey.atmosphere: null` on every planet — `BodyRenderer.createMoon`/planet
  physics ships `atmosphere` unpopulated today. Pre-existing, not lane F.

### 6. Console

**One** error across the whole run: `400` on
`assets/music/hyperspace.mp3`. That file does not exist on disk, has no git
history, and lane F changed nothing under `public/` (`git diff --stat 7e04a38..HEAD -- public/`
is empty). **Pre-existing and unrelated.** Zero errors attributable to this work.

### Not proved here — stated rather than glossed

- **Changing the selected target** was not driven. `window._autopilot.selectBody`
  does **not exist** in this build (its API is
  `debugAccelImpulse … debugArrivalAt, telemetry`) — the handoff's note on that is
  stale — and the hover→select path needs real mouse aim. The `target` block is
  verified populated and agreeing with the reticle, but the *transition* is not.
- **The step-5 grep** for panel files reaching past the provider returned nothing
  because **no panel-content files exist yet**. It is a vacuous pass today and must
  be re-run once panels are built.
- `nav.level` reads `null` throughout: `_navComputer` is lazily constructed in
  `_initNavComputer` and the overlay was never opened. Correct behaviour now;
  re-check under AC-NAV-BUFFER.

---

## Observation for Max — not a lane-F defect, but it will look like one at UAT

`surfaceHistory` is **byte-identical across all four planets** in this system:
`bombardmentIntensity 0.6724301541519206`, `erosionLevel 0.0937849229240397`,
`resurfacingRate 0.3`.

They are four **distinct objects** (`surfaceHistorySameObjectIdentity: false`), so
this is not a snapshot leak — the generator produces the same numbers for every
planet. Consequence: the SURVEY panel's surface-history row will read the same on
every body in a system and carry no information. `composition` and `T_eq` do vary
correctly. Worth deciding whether that row earns its space before the panel ships.

---

## Still owed

Every other `live: true` AC in this contract. This session built and verified
`AC-SNAPSHOT` only; the panels, the NAV host, the zoom and the DOM retirement are
untouched. `AC-NOTHING-I-HAD-GOT-LOST` is Max's gate alone and no agent may close it.
