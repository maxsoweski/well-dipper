# rivers-dendritic-drainage — intent

**Theme A item #3** of the LOD-lab visual-quality backlog
(`docs/FEATURES/lod-lab-quality-backlog.md`) — the "wrong generation primitive" theme: a
shared cell/noise primitive misapplied to a phenomenon that needs different math. Serves the
SCREENSAVER-MVP heart (planets are the hero objects). Lab-renderer R&D; game-port deferred per
`docs/FEATURES/planet-lod-CHARTER.md`.

Two viability spikes already PASSED (do not re-litigate):
- **Sphere-routing spike** (`rivers-sphere-spike-plan-2026-06-17.md`, commit `e2f3bb5`): realistic
  drainage is viable on a sphere — but REQUIRES an **irregular spherical-Delaunay mesh**
  (Fibonacci → Lloyd-relax → convex-hull adjacency); a regular grid grid-locks channels into
  straight lines. Horton-Strahler shaping + Dunne–Leopold width give the dendritic look. Rendered as
  **explicit ribbon geometry overlaid on the sphere**, not a baked texture (that's the settled render
  method — supersedes the research's bake-path framing).
- **Terrain-coupling spike** (`rivers-terrain-lab.html`, 2026-06-17): routing on the lab's REAL
  accumulated `h(pos)` (read via FloatType render-to-texture) holds up — 0 orphans/uphill, Strahler 5,
  R_b 5.14, natural meander, seam-free at both poles, C3 confirmed by Max's eye. Surfaced two findings
  baked into the criteria below (sea-level-from-histogram; shared-height-GLSL module).

## Why we care (Max's words)

> "rivers run in straight sections and then they branch off almost like trees when they meet larger
> bodies of water; these just don't look like rivers."

The current F11 `drainageField()` is a near-zero noise-band warped by FBM with no flow direction, no
downhill coupling, no accumulation — so it draws **worm-trails**, not a drainage tree. We want rivers
that read as real dendritic drainage: straightish reaches branching like trees, widening as they run
to the seas.

## Success criteria (Max's language)

- Rivers **run in straight sections and branch like trees**, joining into bigger channels that
  **widen as they reach the larger bodies of water** — and they actually **look like rivers**, not the
  old worm-trails.
- They sit on the **planet's real terrain** — following the actual valleys between the mountains and
  craters, not a separate noise pattern laid over the top.
- **No seams or weird artifacts at the poles** or anywhere — the network is continuous all the way
  around the globe.
- The right amount of **ocean/lakes** for the planet — the seas the rivers drain into look believable,
  not a puddle or a drowned world.
- Rivers stay the **right size as the planet's size changes** (consistent with the scale work that just
  shipped) — they don't make a big planet look small.
- Changing the planet (seed, sea level, terrain) **updates the rivers** without a long freeze.

## Scope decisions (Max, 2026-06-17)

- **Render method = explicit ribbon geometry overlay** on the planet (proven in both spikes), NOT a
  texture bake / in-shader SDF carve. Rivers are a separate `THREE.Mesh` lifted ~`R*1.001` above the
  unit sphere (the lab never geometrically displaces the sphere — `h` only bends shading normals, so a
  pure overlay is the right fit; real terrain-carving into normals is deferred polish, consistent with
  the spike's G3 conform-only verdict).
- **Couple to the real `h(pos)`** via the shared-height module (below) — not the FBM stand-in.
- **Sea level solved from the live height histogram** (inverse-CDF to a target ocean fraction) per
  planet — the real combiner stack biases positive, so the FBM-era coverage formula gave ~13% ocean.
- **Extract the lab's height GLSL + uniform derivation into a reusable module** shared by the planet
  shader and the river router — the coupling spike had to copy ~2,880 lines of GLSL + ~250 uniforms
  verbatim to get faithful `h`; that is untenable as two drifting copies in production.
- **Footprint/width obey the Theme-B km scale system** (just shipped) — river width law + mesh/sampling
  resolution scale with planet radius_km.
- **Retire the old F11** in the lab — disable the `fluvialCombiner` height contribution (it self-gates
  on `uFluvialDensity`) so the overlay doesn't double up.

## Scope clarification (Max, 2026-06-18) — AC6 boundary + the close-approach split

Max opened a scoping pass on AC6 ("rivers as integrated, scale-coupled terrain"). Outcome:

- **AC6 stays the GLOBAL/macro proportioning layer** — radius-couple the existing global overlay so it
  is correctly sized for the body (this is genuinely undone: the code map confirms `DEFAULT_PARAMS` in
  `planet-lod-rivers.js` is frozen and radius-blind; nothing reads `planetRadiusEarth`).
- **"Realistic at terrestrial scale" = realistic from a SPACECRAFT POV** (Max's words), Elite-Dangerous-style:
  far orbit down to "planet fills the viewport, just above the atmosphere." At that closest approach the
  current global-bake rivers are continental-width gashes — a single 40k-vertex global mesh structurally
  cannot resolve thread-thin, numerous rivers (≈140 km vertex spacing, ≈14 km min ribbon width). Resizing
  the global bake alone cannot reach it.
- **That close-approach realism moved to a NEW spike-first workstream:**
  `docs/WORKSTREAMS/rivers-viewdependent-lod-2026-06-18/`. It builds ON TOP of this global overlay (which
  becomes the LOD-independent "authority" the view-dependent layer amplifies from).
- **Integration (Max's point #2) = rivers sit/drain correctly in the composed terrain.** The router already
  reads the full combiner-chain `h` (read-coupling), so this half is mostly owned. Physical back-coupling
  (crater lakes, river mouths widening coasts, lava/dune valley burial) hits the one-pass-bake ceiling and is
  **deferred** (named in the new workstream's intent).
  - **UAT CORRECTION (2026-06-18):** "mostly owned" was too strong. Max's holistic UAT found rivers
    *cutting through mountains*. Root cause: the read-coupling has a **resolution ceiling** — the router
    routes on the 40k-vertex mesh (~140 km spacing), which **aliases** terrain finer than its spacing
    (adjacent verts differ by up to ~35% of the height range), so a routed segment crosses rendered ridges
    the graph never saw; the carve then incised them **unconditionally**, gouging trenches through peaks.
    Fixed at the carve layer (commit `348b7a0`): a **relief gate** (`uRiverCarveGateHi`) keyed on the
    shader's per-pixel `h` — the only field that sees the sub-mesh ridge — fades the carve out on high
    ground (depth + wall-bend + floor together), so the height-modifying features *do* compose. The deeper
    fix (the route itself not crossing rendered ridges) is the **40k-mesh ceiling = the deferred
    `rivers-viewdependent-lod-2026-06-18` workstream**. So: read-coupling is owned at the carve/render
    boundary now; route-vs-render fidelity is explicitly deferred, not "mostly owned."
- **Small-body / large-channel application** (outflow channels, chasmata on moons) is a parked future hunch,
  not in scope now.

## Deferred (named, out of scope here)

- Real geometric **carve** into terrain normals/shadows (overlay sits on the surface; conform-only
  suffices per spike G3) — integration-phase polish lever.
- **Game-port** — separate, no-parity, deferred effort per the CHARTER.
- Shoreline width-clamp polish (trunks slightly blobby at the sea) — folded into AC2/AC8 acceptance,
  not a standalone deferral.
