# BUILD-PLAN — orbit-ring-conic-2026-07-21

> **Line of sight:** ORRERY orbit rings are the mode's primary nav read →
> flight-reliability / ORRERY-coherence arc → the SCREENSAVER heart. A ring that
> vanishes near its plane (the dead zone) breaks the read the mode exists to give.
> This plan replaces the plane-domain SDF band with the dig-proven screen-space
> conic + Sampson pass so "wherever LineLoop drew a line, the ring renders."

Status at plan time: contract GREENLIT (Max, 2026-07-21, `greenlight`, no
amendments). Branch `feature/supercruise-freelook`. Reference math proven in
`orrery-orbit-lab.html` `conic` mode (dig-record `e961dfd`). This document is
planning-only; no `src/` or lab file is touched by the task that produced it.

**Revised 2026-07-21 after 2-lens adversarial review.** The rebasing-safety
correction (proxy meshes stay scene children — §0 D-1), the DataTexture commitment
(§0 D-3), the multi-ring color rule (§0 D-4), and the runtime-flag switchover with
atomic rollback (§Slice C/D) are the material changes. Full adjudication at §6.

---

## 0. Architecture decision (read before the slices)

The lab probe is one fullscreen mesh reading a per-ring uniform array (CONIC_MAX=16,
single color), built from `sdfRings[i].mesh` transforms. Productizing to CONIC_MAX=64
across the full ring color set forces four structural calls that the slices below
implement. They are stated up front because every slice depends on them.

**D-1 — One persistent `OrbitConicField` singleton; per-ring `OrbitLine` proxies
that STAY scene children.** The 39 per-ring quads collapse to ONE fullscreen mesh
(AC9). Each `OrbitLine` keeps its public `.mesh` (a `THREE.Mesh` **transform/param
proxy**) and `.material` (a `ShaderMaterial` kept as the per-ring **param bag** —
`uColor`/`uOpacity`/`uVisFactor`/prox knobs + the color/opacity accessors). The
field reads each live ring's `{matrixWorld, radius, visible, color, opacity,
uVisFactor, prox uniforms}` per frame and builds its conic entry. The field is
created once and survives system swaps; per-spawn it re-reads the current `system`'s
ring lists, so a spawn needs **no** new main.js edit.

> **CORRECTION vs the pre-review draft (Lens B MUST-FIX #1/#2):** the proxy mesh
> **remains added to the render scene** — `addTo(scene)` stays a real scene-graph
> insert, NOT a no-op. This is load-bearing for world-origin rebasing. Planet
> orbit lines (`main.js:4788`) and single/binary star orbit lines (`main.js:4644,
> :4652`) are seeded once via `_placeInRebasedFrame(line.mesh)` and then kept
> aligned **solely** by `maybeRebase`'s scene-graph subtract
> (`WorldOrigin.js:144-147` iterates `scene.children` and does `child.position.sub(
> offset)`; `placeInRebasedFrame` at :168-171 seeds `position = -worldOrigin`).
> `REBASE_THRESHOLD_SQ = 100²` (`WorldOrigin.js:30`), and the dead-zone battery
> camera sits at `[3000,0,0]`, so `maybeRebase` fires immediately in the exact
> poses AC2/AC3/AC10 exercise. If the proxy were detached, planet/star rings would
> freeze at their spawn-frame position while planets track — projecting the conic
> to the wrong place, and corrupting `hitTestOrbits` (`main.js:4130` projects the
> same `mesh.matrixWorld`) and hover. Moon rings are separately safe (their
> `.mesh.position` is rewritten every sim frame as `px − _worldOriginVec`,
> `main.js:8250-8254`) but the asymmetry is exactly why detaching is unacceptable:
> it breaks planet/star rings only. Keeping the mesh a scene child preserves
> today's behavior byte-for-byte AND keeps `tests/orbit-ring-rebase.test.js` green
> unchanged (it asserts a spawned ring coincides with the rebased barycenter after
> `warpAccumulate` + a later in-system rebase — see §5).
>
> **Draw suppression, not detachment.** When the field owns rendering
> (`USE_CONIC_FIELD` ON — Slice C), each proxy mesh is kept a scene child (for
> rebasing + `matrixWorld`) but suppressed from the render list by assigning it to
> a dedicated **non-rendered layer** (`ORBIT_PROXY_LAYER`) that the ORRERY/HELM
> cameras do not include. `scene.updateMatrixWorld()` and the hit-test's own
> `mesh.updateMatrixWorld()` (`main.js` hit-test loop) run regardless of layer, so
> the transform stays live; `.mesh.visible` stays free to carry the ring's LOGICAL
> visibility (consumed by `hitTestOrbits` `if (!mesh.visible) continue` and by the
> field's per-ring `active` flag). Layers do NOT affect `hitTestOrbits`, which is
> screen-space projection over `userData.orbitHitPositions`, not raycasting — so
> picking is untouched. This yields the AC9 "39 → 1" draw-call collapse (the 39
> proxies render nothing) while leaving every consumer of `mesh.matrixWorld` /
> `mesh.position` / `mesh.visible` correct.

`scene.remove(line.mesh)` / `_placeInRebasedFrame(line.mesh)` / `.mesh.position` /
`.mesh.rotation.x` / `.mesh.visible` / `dispose()` all stay valid with zero
call-site change.

**D-1b — The fullscreen field mesh is rebase-immune by construction.** `#5` adds ONE
new scene child (`field.mesh`), so `maybeRebase` will `child.position.sub(offset)`
it every rebase. That must not disturb the fullscreen quad. The field's **vertex
shader writes clip space directly** (`gl_Position = vec4(position.xy, 0.0, 1.0)`,
ignoring `modelMatrix`/`modelViewMatrix`), `frustumCulled:false`, so its `.position`
is inert and rebasing cannot move it off-center. Pinned by a unit assertion that the
field vertex shader references no model/view/projection matrix uniform.

**D-2 — The CPU conic hook runs at RENDER time, not sim time.** Under the
fixed-timestep split, `renderFrame(alpha)` interpolates the camera and calls
`camera.updateMatrixWorld(true)` (main.js ~:9697) before `retroRenderer.render()`
(~:9873). The conic is per-pixel pose-sensitive, so it must be built from the
**interpolated render-time camera** — building it at sim time (where
`_updateOrbitVisibilityFactor()` lives, ~:9483) would lag it by the interpolation
fraction and re-introduce sub-frame drift, the exact class of artifact we are
killing. Moon-ring mesh positions are written at sim time (~:8250) and are current
by render time, so ordering is: sim writes ring transforms → renderFrame
interpolates camera + `updateMatrixWorld` → **field.update()** → `render()`. (The
sim-set-mesh / render-time-camera mismatch for moon rings is the SAME one today's
SDF rings have — not a regression; R10.)

**D-3 — Per-ring data is an `RGBA32F` DataTexture, committed (not a probed fallback).**
At CONIC_MAX=64 the lab's fixed-size uniform-array layout (`uniform mat3 uConic[64]`
+ `uHinv[64]` + `uRowW[64]` + color/alpha/active) declares ~640 vec4 that the
shader needs to **compile**, not merely to run — regardless of the runtime `uCount`.
A client whose `MAX_FRAGMENT_UNIFORM_VECTORS` is the common integrated/mobile
224–256 fails compilation outright. The lab only ever proved CONIC_MAX=**16**
(`orrery-orbit-lab.html:171`, ~160 vec4), so the uniform-array path at 64 is
**unproven and non-portable** — it is NOT a safe fallback and is dropped.

Decision: pack per-ring data into an `RGBA32F` `DataTexture` (CONIC_MAX texels wide
× a small fixed number of rows: `Cs` 3×3 = 3 texels + `Hinv` 3×3 = 3 texels + `rowW`
1 texel + color/alpha/params 1 texel ≈ 8 texels/ring, so an `RGBA32F` texture of
64 × 8, or 64-wide × 8-row, well within `MAX_TEXTURE_SIZE`), read with `texelFetch`,
`NEAREST` filter, no mips. This is `RGBA32F`/WebGL2-native (WebGL1 dead since three
r163) and unbounded by the fragment-uniform budget. It is the single shipping data
path — every player hits it, so it is proven in the lab (Slice B) and unit-tested
for packing parity (b4b), rather than shadowed by a uniform path that only high-end
dev/CI GPUs would ever select.

**D-4 — AC6 depth AND multi-ring overlap selection are NEW code (the probe had
neither).** The fullscreen shader writes `gl_FragDepth` by reconstructing the plane
point and matching three's log-depth formula exactly: `w_clip = dot(rowW[i],
vec3(XZ,1.0))` (already computed for the front-branch guard) → `gl_FragDepth =
log2(1.0 + w_clip) * uLogDepthBufFC * 0.5`, with `uLogDepthBufFC = 2.0 /
log2(camera.far + 1.0)` (verified against `node_modules/three`
`logdepthbuf_fragment.glsl.js`, r0.183.1). `depthTest:true`, `depthWrite:true`,
`stencilWrite:false`.

**Overlap selection rule (single argmax — color, alpha, depth coupled).** The lab
probe painted ONE color (`gl_FragColor = vec4(0.0,1.0,0.0,…)`,
`orrery-orbit-lab.html:257`), so ring crossings were never exercised. ORRERY
crossings are common (moon ring over its planet ring, binary star rings, a hovered
`0x44ff44` ring crossing a normal `0x00ff00`/`0x00bb00` ring). At a pixel where
multiple rings band-pass, the shader selects the **single front-most band-passing
ring** (min `w_clip` = nearest) and writes THAT ring's color, alpha, AND depth
together. The three outputs are never decoupled (the pre-review draft took depth
from min-`w_clip` but alpha from an argmax-alpha ring — potentially a different
ring, so color/alpha of ring A with depth of ring B). Coupling to the nearest ring
keeps depth physically correct and color coherent at crossings. Pinned by a lab/unit
case with two differently-colored overlapping rings (b5b). Writing `gl_FragDepth`
forfeits early-Z (the 64-iteration loop runs on every sceneTarget pixel), but this
is **net-neutral vs shipped** — today's OrbitRingSDF also writes
`#include <logdepthbuf_fragment>` with `depthWrite:true` (`OrbitRingSDF.js:205,268`)
and carries 39× overdraw the conic removes. Consequence: AC9 frame-time must be
sampled on the lowest-end GPU available and the bbox pre-cull (R4) is kept ready,
not merely deferred.

---

## 1. Slice decomposition

Four slices, each independently buildable, testable, and adversarially verifiable.
TDD per slice: RED tests written and failing BEFORE implementation. The 4-mode lab
+ dig scenario battery is the acceptance harness for the integration ACs (per
contract `phase`).

**Switchover shape (Lens B MUST-FIX #3 — resolved).** The field goes LIVE in prod
at **Slice C**, gated by a module-level runtime flag `USE_CONIC_FIELD` (default
**ON** in C). Slice C is otherwise **purely additive**: it wires the field and
suppresses the SDF draw when the flag is ON, but does NOT strip OrbitRingSDF's
render shaders and does NOT perform the AC11 deletion. The legacy SDF render path is
therefore **retained-but-dormant** through C, so rollback if the live battery or
UAT fails is a single-line flag flip (`USE_CONIC_FIELD = false` → the shipped SDF
render returns instantly, atomically, no slice revert). **Slice D** runs the live
integration battery; on green it deletes the flag + the dormant legacy SDF render
path (the strip), performs the AC11 deletion (which is the same edit as the strip —
you cannot remove the render shader and separately remove its dead WebGL1 comments),
and runs the AC11 audit. There is no "lab-only gate" in prod — Slice B's lab toggle
(`conic-prod`) is a lab-HTML control only. This moves the AC11 deletion from C (draft)
to D, alongside the audit it already lived with.

---

### Slice A — Pure conic math module + headless unit suite  [closes AC1]

Extract the lab's `ringConicScreen` / `inv3` into a pure, dependency-light module
and pin it with a headless suite that mirrors the exact GLSL Sampson evaluation
(GLSL-mirror-parity discipline — same reason `proximityFadeFactor` is exported).

**Files touched**
- NEW `src/objects/ringConic.js` — exports:
  - `buildRingConic(pvmMatrix|{clipCols}, radius, W, H)` → `{ Cs, Hinv, rowW }`
    (max-abs-normalized `Cs`; `null` only on non-finite/true-singular `det`).
  - `sampsonDistancePx(Cs, px, py)` → `|pᵀCs p| / |2(Cs p).xy|` — the byte-mirror
    of the fragment shader's distance, so the unit suite tests the shader's math.
  - `frontBranchOK(Hinv, rowW, px, py)` → reconstructs `XZ = (Hinv·p).xy/(Hinv·p).z`,
    returns `dot(rowW,[XZ,1]) > 0`.
  - preallocated scratch (no per-call array literals — see Risks GC note).
- NEW `src/objects/__tests__/ringConic.test.js`.

**RED tests (fail at HEAD — module absent)**
- `a1` on-circle Sampson ≈ 0 for the 4 ported dig poses (mid-range in-plane,
  grazing @5200, gentle @pitch .35, overview) — sample 32 circle points per pose,
  assert `sampsonDistancePx < ~0.5 px`.
- `a2` off-circle monotone growth: distance rises monotonically as sample points
  step radially off the circle.
- `a3` front-branch guard: a circle point on the behind-camera branch returns
  `frontBranchOK === false`; the front branch returns `true`.
- `a4` **degenerate cell** `|camY| < 1e-3`: sweep camY across 0 in 90 steps; assert
  every `Cs`/`Hinv`/`rowW` entry `Number.isFinite`, no `NaN`, and the Sampson
  **sign** of a fixed on-circle point never flaps across the sweep (double-line
  conic's ~2× distance error is allowed; sign-flap / NaN is not). NOTE: `a4` guards
  finiteness + sign-stability, NOT visibility — it does not front as the AC2/AC3
  render guarantee at the grazing pose (that is the lab/live layer). Do not
  over-credit it.
- `a5` normalization + **float32** invariance: `max|Cs| ≈ 1` for R from 2 → 67670;
  and `sampsonDistancePx` is unchanged (to float32 tolerance) when `Cs` is
  quantized into a `Float32Array` AND multiplied by an arbitrary global scalar.
  The float32 quantization inside the test is deliberate: `a5` runs in JS float64,
  so without it the invariance is trivially true and proves only algebra. The full
  catastrophic-cancellation proof at R=67670 (post-normalization entries ~1e-10)
  lives in the lab `conic` column at 16 rings (Slice B) — `a5` guards the algebraic
  + upload-scale invariant so a future refactor cannot trust a float64 test to
  cover a float32 path; the field-scale proof is Slice B, stated as such.

**Pass criteria** all assertions green; suite `failed = 0`; no `src/main.js` touch.

---

### Slice B — `OrbitConicField` fullscreen pass + shader, lab-driven  [advances AC2–AC6, AC8; no prod behavior change]

Build the productized field consuming Slice A. It is a standalone consumer of a
generic ring-descriptor list `{matrixWorld, radius, color, alpha, active}` — it
does **not** yet know about `OrbitLine` (that is Slice C). Driven and proven in the
lab behind a lab-HTML toggle before any prod wiring exists.

**Files touched**
- NEW `src/objects/OrbitConicField.js` — the singleton: one `PlaneGeometry(2,2)`
  fullscreen mesh with a **clip-space passthrough vertex shader** (D-1b, model-matrix
  independent); the `RGBA32F` `DataTexture` per-ring layout (D-3, committed);
  `ShaderMaterial` with `transparent`, `depthTest:true`, `depthWrite:true`,
  `stencilWrite:false`, `frustumCulled:false`, an explicit `renderOrder` after
  opaque bodies. Shader per pixel: loop `i < uCount` with `if (i>=uCount) break`,
  `texelFetch` the ring's packed conic, `active` skip, Sampson band
  (`uPixelWidth`/`uFeatherPx`, same knobs as the probe), front-branch guard,
  **single-argmax overlap selection** of the front-most (min `w_clip`)
  band-passing ring for color+alpha+depth together (D-4), **angular-size fade**
  multiply, **log-depth `gl_FragDepth`** (D-4). `.update(descriptors, camera,
  sceneTarget)` builds every entry CPU-side and packs the DataTexture; `.dispose()`.
- NEW `src/objects/__tests__/OrbitConicField.test.js`.
- EDIT `orrery-orbit-lab.html` — repoint the existing `conic` mode's probe at the
  productized `OrbitConicField` (import it; feed `sdfRings[i].mesh` +
  `ringDefs[i]`). **Lab file only — not a `src/` prod file.** Adds a `conic-prod`
  toggle so probe-vs-productized can be A/B'd if a number drifts.

**RED tests**
- Headless unit (`OrbitConicField.test.js`):
  - `b1` builds N descriptors → N active entries; `active=false` and
    `buildRingConic===null` both zero the ring's `active` flag; count clamps to
    CONIC_MAX.
  - `b2` **angular-size fade** JS mirror `angularFadeFactor(radius, camDist, fovDeg,
    viewportH, cutoffPx)`: 1 above the cutoff, smooth 0 below, monotone,
    **per-ring** (large-R ring = 1 while its small-R moon ring = 0 at the same
    pose). Numeric, exported, mirrored in the shader. **Cutoff is derived from the
    shipped-SDF angular-size dropout, not chosen free** — see `b8b` (AC5∩AC8 pin).
  - `b3` **log-depth constant** mirror: for a known `w_clip`, the JS helper equals
    `log2(1+w_clip) * (2/log2(far+1)) * 0.5` — pins the AC6 formula against
    three's chunk so a three bump can't silently desync it.
  - `b4` DataTexture layout: test asserts the packed texel dimensions
    (width=CONIC_MAX, rows=fixed) are within a documented `MAX_TEXTURE_SIZE` floor
    and the pack/unpack round-trips exactly in JS.
  - `b4b` **DataTexture packing parity** (new): the DataTexture-packed conic
    evaluates the SAME `sampsonDistancePx` as the direct in-memory `Cs` for a
    spread of ring indices (0, 33, 63) — catches a row-stride / texel-order /
    transpose bug that only bites ring index > 32 (second texture row) and would
    otherwise pass `b5` silently.
  - `b5c` field vertex shader contains no `modelMatrix`/`modelViewMatrix`/
    `projectionMatrix` reference (D-1b rebase-immunity pin).
- Lab integration (adversarial parity — run in the lab, the acceptance harness):
  - `b5` `measureLadder` + `poseCamera` dead-zone battery: conic paints the
    LineLoop class where SDF paints 0 (dig ref **1314 px @ pitch .01**). [AC2]
  - `b5b` **two-color overlap** (new): two differently-colored rings crossing at a
    pixel → the crossing pixel shows the front-most (min `w_clip`) ring's color and
    that ring's depth; toggling which ring is nearer flips the color deterministically
    (D-4 argmax pin, in-lab where GL runs). [AC7 fidelity]
  - `b6` `driftMeasure` 90f at dead-zone boundary → toggles/frame ≈ 0; grazing @5200
    toggle-per-green ≤ ~0.125. [AC3]
  - `b7` `poseCamera` near-field + `setProxFade({off:true})` → contiguous stable
    band; `driftMeasure` clean. [AC4]
  - `b8` `perRingLadder` 7×13 → **0** anti-vanish regressions vs shipped. [AC5]
  - `b8b` **AC5∩AC8 cutoff calibration** (new): the angular-size fade may remove a
    ring ONLY at a (pose, ring) cell where shipped-SDF ALSO drops it; the cutoff is
    pinned to the MEASURED shipped-SDF angular dropout per ring class, not chosen
    independently. Guards the latent AC5 (anti-vanish) vs AC8 (fade) tension: too
    aggressive → AC5 regression, too lax → persistent dots (AC8 fail). [AC5+AC8]
  - `b9` `driftMeasure({planet:true})` against the log-depth planet stand-in at BOTH
    a nominal pose AND a **grazing pitch** (@5200 class, where `q.z→0` makes the
    plane-point reconstruction a float32 difference of large terms — the worst case
    for depth jitter) → behind occluded / front visible / no z-fight shimmer. [AC6]
  - `b10` `perRingLadder` far rows → sub-pixel moon rings fade smoothly (no
    persistent dots), large rings persist. [AC8 in lab]

**Pass criteria** unit green; every lab-parity number matches the dig-record class
(no regression vs the proven probe); still **zero prod behavior change** (field
not yet wired into main.js). Byte-guards untouched. Suite `failed = 0`.

---

### Slice C — OrbitLine/OrbitRingSDF re-route to the field + main.js wiring (additive, flag-gated)  [closes AC7]

Re-home OrbitRingSDF from a self-rendering quad to a transform proxy + param bag
that STAYS a scene child; keep `OrbitLine`'s public surface byte-identical; wire the
field into main.js behind `USE_CONIC_FIELD`. **Additive only** — the legacy SDF
render path is retained-but-dormant (no shader strip, no AC11 deletion; those are D).

**Files touched**
- EDIT `src/objects/OrbitRingSDF.js`:
  - `.mesh` stays a `THREE.Mesh` (API/`instanceof` parity) **added to the render
    scene as today** (rebasing — D-1). Its geometry/shader are **kept intact**
    (dormant legacy path). When `USE_CONIC_FIELD` is ON the mesh is assigned to
    `ORBIT_PROXY_LAYER` (not rendered by the ORRERY/HELM camera → 0 draw); when OFF
    it renders as shipped. `.mesh.visible` continues to carry LOGICAL visibility.
  - `.material` continues to expose `uColor`, `uOpacity`, `uVisFactor`, the three
    prox uniforms, the opacity accessor, `setVisibilityFactor`, `setProximityFade`
    — the field reads these as the per-ring param bag. No uniform removed.
  - `proximityFadeFactor` stays exported unchanged (still the envelope source of
    truth; now ALSO consumed **CPU-side** by the field).
  - **No `extensions`/derivatives/WebGL1 deletion here** — that is the AC11 strip in
    Slice D (same edit as removing the render shader).
- EDIT `src/objects/OrbitLine.js`: surface unchanged — still builds
  `userData.orbitHitPositions` (perimeter samples) and the `material.color`
  accessor for hover. Verify it composes with the field-driven OrbitRingSDF.
- EDIT `src/objects/__tests__/OrbitLine.swap.test.js`: `.mesh instanceof
  THREE.Mesh` / not LineLoop / `.material instanceof ShaderMaterial` / opacity shim
  / `setVisibilityFactor`→`uVisFactor` **survive**. ADD: with `USE_CONIC_FIELD` ON
  the mesh is on `ORBIT_PROXY_LAYER` (contributes no camera draw) yet **remains a
  scene child** and `.mesh.matrixWorld` stays live (rebasing invariant); with the
  flag OFF it renders. ADD: dispose removes the ring from `system`'s ring list so
  the field's next `update()` produces no entry for it (see dispose test below).
- EDIT `src/objects/__tests__/OrbitRingSDF.proxfade.test.js`: **migrate the CPU-side
  pin only; keep the GLSL-string pins for now** (the render shader still exists in
  C). ADD a **CPU-side channel-composition pin**: the field's descriptor builder
  yields `alpha = opacity * uVisFactor * proxFade * angularFade` (the four channels
  compose, none silently dropped). The GLSL-string pins in describe (2) are RETIRED
  in **Slice D** when the shader is deleted (§4/§5) — not here.
- EDIT `src/main.js` — **LEDGER #5** and **LEDGER #6** (enumerated below), both
  gated by `USE_CONIC_FIELD`:
  - `#5` construct the `OrbitConicField` singleton once and `scene.add(field.mesh)`
    near the RetroRenderer/scene setup; when the flag is OFF, skip creation.
  - `#6` in `renderFrame`, after `camera.updateMatrixWorld(true)` (~:9697) and
    before `retroRenderer.render()` (~:9873), call
    `field.update(system, camera, retroRenderer.sceneTarget)` (reads the current
    `system`'s planet/moon/star ring lists, hover color/opacity, prox uniforms);
    when the flag is OFF, skip.
  - The flag also toggles proxy layer assignment (§D-1). Ledger stays **FOUR → SIX**
    — no WorldOrigin.js touch, no per-frame reposition wiring, precisely because the
    proxies stay scene children (this is what refutes Lens B's "≥ SEVEN" estimate:
    keeping them attached removes the need for any new rebase wiring).

**RED tests**
- `c1`–`c4` swap surface, scene-child + off-render-layer proxy, dispose→field-drop
  (stateless: after dispose + removal from `system.orbitLines`, next `field.update`
  emits no entry — there is NO per-ring registry, consistent with D-1's per-frame
  re-read), proxfade JS-mirror + CPU-channel pin.
- `c5` **rebasing invariant** (new headless, using real `WorldOrigin` + `OrbitLine`):
  a proxy spawned after `warpAccumulate` and carried through a later rebase still
  coincides with the rebased barycenter (mirrors `tests/orbit-ring-rebase.test.js`,
  now with the field-driven proxy). Fails if a refactor ever detaches the mesh.
- `c6` hover parity headless: mutating `ring.material.color.set(0x44ff44)` +
  `ring.material.opacity = 1.0` changes the field's next descriptor for that ring
  (hover highlight works with no per-ring draw).

**Pass criteria** unit green; with `USE_CONIC_FIELD` ON the field renders the ring
set as 1 draw and the SDF proxies contribute 0; with it OFF shipped SDF renders;
API parity holds; `tests/orbit-ring-rebase.test.js` stays green unchanged.
Suite `failed = 0`. Live integration (AC7 + AC2–AC9) verified in Slice D.

---

### Slice D — Prod switchover confirmation + legacy strip + AC11 deletion/audit + evidence battery  [closes AC2–AC9, AC11; AC10 → Max]

Confirm the field in the actual game (working-Claude drives chrome-devtools), then —
on a green live battery — delete the flag + dormant legacy SDF render path, perform
the AC11 deletion, audit the cleanup, and capture evidence. Rollback before the strip
is a single flag flip.

**Files touched**
- EDIT `src/objects/OrbitRingSDF.js` — **the strip + AC11 deletion** (deferred here
  from the draft's Slice C): remove the render shaders (no fwidth, no band, no clamp,
  no smear cut — the field owns rendering), reduce `.mesh` to minimal placeholder
  geometry, delete `extensions:{derivatives:true}` and every WebGL1/GLSL-ES-1.00
  comment (they justified constraints the conic path doesn't have — no derivatives,
  no in-shader `inverse(`). `proximityFadeFactor` + the param-bag uniforms/accessors
  survive.
- EDIT `src/objects/__tests__/OrbitRingSDF.proxfade.test.js` — **retire** the describe
  (2) GLSL-string pins now that the shader is gone; the CPU-channel pin added in C
  replaces them.
- EDIT `src/main.js` — remove the `USE_CONIC_FIELD` branch (field is unconditional);
  no NEW ledger edits (`#5`/`#6` already counted, now un-gated).
- EDIT `orrery-orbit-lab.html` — the lab `sdf` column's `new OrbitRingSDF(...)`
  render (`:375`) goes inert once the render shader is stripped (the conic
  transform-source `sdfRings[i].mesh.matrixWorld` still works). Stated so the dead
  `sdf` lab column is not "discovered" as a regression later; the acceptance battery
  (Slice B) ran fully BEFORE the strip, so ACs are unaffected.
- Evidence artifacts under `docs/WORKSTREAMS/orbit-ring-conic-2026-07-21/evidence/`.

**RED / gate tests**
- `d1` full vitest suite from repo dir: `tests failed = 0` (vendor/motion-test-kit
  collection noise is the known baseline). Includes `tests/orbit-ring-rebase.test.js`
  green.
- `d2` AC11 audit: grep the ring path — **no** `extensions` / `derivatives` /
  WebGL1 comments remain; **no** `inverse(` / `transpose(` in the field shader
  (new pin replacing the retired proxfade WebGL1 pin); the `inverse(`-pin decision
  is recorded in the commit + test comment (RETIRE the dead WebGL1 rationale, ADD
  the live "matrices are CPU-built, shader carries no inverse" pin — see §4).
- `d3` draw-call parity: ORRERY ring set renders **1** ring draw, not 39
  (renderer.info in-game; capture before/after with nothing else changing between
  shots and attribute the delta — `renderer.info.render.calls` is a scene-wide
  total, not a direct ring count). [AC9]

**Live drives (chrome-devtools, working-Claude — objective integration):**
- AC2 dead-zone poses in-game (prox neutralized) → line renders **qualitatively**
  ("renders where it vanished"); do NOT pin the literal lab 1314 px — the live pose
  has a focused planet body occluding part of the ring, so in-game painted-px reads
  lower than the body-free lab figure.
- AC3 drift at dead-zone boundary + grazing @5200 → no toggle flicker.
- AC4 stand on a ring, fade off → clean band; fade on → shipped envelope.
- AC5 fly the perRing ladder → nothing that renders today vanishes.
- AC6 ring segment behind/in front of a real planet at BOTH a nominal and a
  **grazing** pitch → correct occlusion, no shimmer under drift.
- AC7 hover each ring class (incl. a hovered ring CROSSING a normal ring — verify
  the crossing shows the front ring's color); toggle ORRERY/HELM
  (`_syncOrbitsToMode`); move a moon ring over frames; dispose/recreate a system →
  all behaviors intact.
- AC8 far ladder → angular-size fade, no persistent dots.
- AC9 `renderer.info` draw calls 39→1; frame-time at overview + near-field ≤ shipped,
  **sampled on the lowest-end GPU available** (early-Z is forfeit by the
  `gl_FragDepth` write — net-neutral vs shipped, but the floor-hardware sample is
  the honest gate; if it regresses, add the R4 bbox pre-cull). Note honestly:
  Max's dev hardware may not be floor-class; state the GPU the sample ran on.
- **AC10 (UAT)** → **Max only.** Verify workflow marks it `deferred-to-max`; never
  PASS. `VERIFIED_PENDING_MAX <sha>` on integration-green, then Max flies it.

**Pass criteria** suite green; all live integration ACs objectively pass; legacy
path stripped + AC11 audited; evidence captured; ledger updated; agent browser
windows swept (per browser-hygiene rule).

---

## 2. Per-slice summary table

| Slice | New files | Edited files | main.js ledger | Closes / advances |
|---|---|---|---|---|
| A | `ringConic.js`, `ringConic.test.js` | — | none | AC1 |
| B | `OrbitConicField.js`, `OrbitConicField.test.js` | `orrery-orbit-lab.html` (lab) | none | AC2–6, AC8 (in-lab) |
| C | — | `OrbitRingSDF.js`, `OrbitLine.js`, `OrbitLine.swap.test.js`, `OrbitRingSDF.proxfade.test.js` | **#5** field create+add, **#6** render-time `field.update` (both flag-gated) | AC7 (additive, flag-gated switchover) |
| D | evidence/* | `OrbitRingSDF.js` (strip + AC11), `OrbitRingSDF.proxfade.test.js` (retire GLSL pins), `main.js` (drop flag branch), `orrery-orbit-lab.html` (sdf column note) | none | AC2–9 (live), AC11 (deletion+audit); AC10→Max |

---

## 3. Risks

**R1 — float32 conic coefficients at scene scale (moon R=2 → planet R=67670+).**
`Cs = Hⁱᵀ·diag(1,1,−R²)·Hⁱ` entries scale with `R²`, spanning ~10 orders of
magnitude across the ring set — well past float32's ~7 decimal digits, so raw
upload would lose the small entries. **Strategy:** max-abs-normalize each ring's
`Cs` before packing (lab already does `Cs[i][j] /= mx`). Sampson distance
`|pᵀCs p|/|2(Cs p).xy|` is invariant to a global scalar on `Cs`, so normalization
changes nothing but keeps every entry in ~[−1,1] in float32. `a5` pins the algebraic
+ upload-scale invariant (quantizing to `Float32Array`); the field-scale
catastrophic-cancellation proof at R=67670 is the lab (Slice B). Same normalization
also protects the near-degenerate cell from overflow (R2).

**R2 — exact-in-plane degeneracy (`|camY|→0`).** The plane goes edge-on, `H`
→ near-singular, the conic → a double line. Resolution: `inv3` returns `null`
**only** on non-finite / true-singular `det` (`<1e-30`), which is far below the
`|camY|<1e-3` band — so the ring stays drawn through the grazing frame (the
double-line conic's ~2× distance error just slightly widens the band for that
measure-zero pose). No NaN, no sign flap. Pinned by `a4` (finiteness/sign only).

**R3 — fragment-uniform-vector budget → resolved by committing to DataTexture (D-3).**
A fixed-size `uniform mat3 uConic[64]` layout needs ~640 vec4 to COMPILE (not just
run), above the common 224–256 `MAX_FRAGMENT_UNIFORM_VECTORS` floor → compile
failure on integrated/mobile. The lab only proved CONIC_MAX=16. Decision: `RGBA32F`
`DataTexture` + `texelFetch` unconditionally — WebGL2-native, unbounded by the
uniform budget, within `MAX_TEXTURE_SIZE` trivially. The uniform-array path is
DROPPED (it is the LESS portable path, not a fallback). `b4`/`b4b` pin the packing;
the lab (Slice B) proves the texelFetch path compiles + renders on real GL.

**R4 — per-pixel loop cost (39–64 iterations × ~185k sceneTarget px), early-Z
forfeit.** The fullscreen shader evaluates every ring's conic per pixel, and the
`gl_FragDepth` write disables early depth rejection, so the loop runs on every
sceneTarget pixel including planet-occluded ones. This is net-neutral vs shipped
(today's per-quad SDF also writes `gl_FragDepth` and has 39× overdraw the conic
removes), but AC9 frame-time MUST be measured on floor-class hardware, and the
per-ring screen-space bbox pre-cull is kept **ready** (not merely deferred) — add it
if AC9 regresses on the low-end sample. `if (i>=uCount) break` bounds the loop to
the live ring count.

**R5 — CPU cost + GC of 39–64 conic builds/frame.** Each build is one shared
`Matrix4` chain + one 3×3 inverse + a few 3×3 mults — tens of µs total. But the
lab's `inv3` returns fresh array literals per call (64×/frame → GC churn).
Productize with preallocated scratch (Slice A requirement) + a reused
`Float32Array` DataTexture source buffer (no per-frame texture reallocation).
Update-hook placement is render-time (D-2), reusing the already-computed
`camera.matrixWorldInverse`.

**R6 — AC6 depth reconstruction + overlap selection are new, not lab-proven.** The
log-depth formula must match three's `logdepthbuf_fragment` **exactly**
(`log2(1+w_clip)·FC·0.5`, `FC=2/log2(far+1)`), or rings z-fight / float / sink
against planets. `w_clip` is free from the front-branch guard, but at grazing the
reconstruction `XZ = q.xy/q.z` blows up near the vanishing line (`q.z→0`), so
`w_clip` becomes a float32 difference of large terms → the shimmer clause of AC6 is
most at risk at grazing, not general poses. Pinned numerically (`b3`), with a
**grazing** depth-drift pose (`b9`) and a live grazing occlusion drive (Slice D).
**Overlap rule:** on a pixel touched by multiple rings, the front-most (min
`w_clip`) band-passing ring owns color + alpha + depth TOGETHER (single argmax, not
decoupled — D-4). Pinned by `b5b` (two-color overlap) + live AC7 crossing drive.

**R7 — 1/3-res sceneTarget composite (alpha + shared depth/stencil).** The field
draws into `sceneTarget` (pass 2) exactly where the per-ring quads did; off-band
pixels `discard`, so composite coverage is byte-equivalent (the known `mix`
double-alpha ≈α² is **explicitly out of scope** per contract `mustStayWorking`).
The field shares `sceneTarget`'s depth buffer with planets (AC6) but must NOT
touch stencil (`stencilWrite:false`) — other objects use it.

**R8 — hover with no per-ring material draw.** Hover mutates
`_hoveredOrbitLine.material.color` / `.opacity` / `.needsUpdate` (`main.js:11198-
11210`), storing `_origColor`/`_origOpacity` for restore. The retained
ShaderMaterial param bag keeps all three valid (no throw); the field reads the
mutated color/opacity into the ring's next descriptor → highlight appears with
zero per-ring draw. At crossings the hovered ring's bright color wins ONLY when it
is the front-most band-passing ring (D-4 argmax) — verified live (AC7 crossing
drive). `.needsUpdate` on a non-rendered material is harmless. Pinned by `c6` +
`b5b` + live AC7.

**R9 — rings beyond CONIC_MAX.** Inventory worst case is 58 < 64 (planet/moon/star
rings only), so normally none dropped. **Asteroid belts are NOT ring-count
contributors** — `main.js:4829` adds `new AsteroidBelt(...)`, a separate annulus
mesh, not an `OrbitLine`; it renders itself and never enters the conic set (verified
against the ring-inventory). Defensive: order rings **largest angular size first**
so any overflow drop is the least-visible sub-pixel moon rings; log a one-time
warning. Not expected to fire; documented so a future mega-system fails gracefully.

**R10 — sim-vs-render pose mismatch for moon rings.** Moon-ring `.mesh.position`
is written at sim rate (~:8250) and is **not** interp-registered, while the
camera is interpolated at render time. This is the *same* mismatch today's SDF
rings already have (sim-set mesh, render-time camera), so the conic build at
render time reproduces current behavior — not a regression. Noted so it is not
"discovered" as a new bug later.

**R11 — world-origin rebasing (Lens B MUST-FIX #1, folded into D-1).** Planet/star
orbit lines rely SOLELY on `maybeRebase`'s scene-graph subtract; detaching the proxy
mesh from the scene would freeze them after the first rebase (which fires immediately
at the `[3000,0,0]` dead-zone poses, `REBASE_THRESHOLD_SQ=100²`), mis-projecting the
conic AND corrupting `hitTestOrbits`/hover (both consume `mesh.matrixWorld`).
**Resolution:** proxies stay scene children (D-1); render is suppressed by layer, not
by detachment. The NEW `field.mesh` scene child is rebase-immune via its clip-space
passthrough vertex shader (D-1b). `tests/orbit-ring-rebase.test.js` stays green
unchanged; `c5` re-pins the invariant on the field-driven proxy.

---

## 4. AC coverage map

| AC | Layer | Slice | Verification instrument |
|---|---|---|---|
| AC1 conic-math-unit | unit | A | `ringConic.test.js`: Sampson mirror over 4 ported poses + 90-step `|camY|<1e-3` sweep + normalization/float32 invariance |
| AC2 dead-zone-renders | integration/live | B (lab), D (prod) | `poseCamera` dead-zone battery + `measureLadder` (lab ref 1314px); live drive stays QUALITATIVE (planet body occludes → in-game px lower) |
| AC3 far-orbit-flicker-gone | integration/live | B, D | `driftMeasure` 90f at dead-zone boundary + grazing @5200 (toggle-per-green ≤0.125) |
| AC4 nearfield-clean | integration/live | B, D | `poseCamera` near-field + `setProxFade({off:true})` + `driftMeasure` |
| AC5 anti-vanish-ladder | integration/live | B, D | `perRingLadder` 7×13 → 0 regressions + `b8b` AC5∩AC8 cutoff pin |
| AC6 occlusion-holds | integration/live | B (depth code), D (real planet) | `driftMeasure({planet:true})` nominal + grazing + `poseCamera` behind/front + `b3` log-depth mirror |
| AC7 parity-surface | integration/live + unit | C (build), D (live) | `OrbitLine.swap.test.js` + `c5` rebase invariant + `c6` hover + `b5b` two-color overlap + live hover/crossing/mode-sync/moon-track/dispose |
| AC8 angular-size-fade | integration/live | B (math+unit), D (far ladder) | `angularFadeFactor` mirror (`b2`) + `b8b` shipped-dropout-calibrated cutoff + `perRingLadder` far rows |
| AC9 single-pass-perf | integration/live | D | `renderer.info` draw calls 39→1 (`d3`, before/after delta) + frame-time on floor-class GPU at overview + near-field |
| AC10 orbit-read-coheres | uat | D handoff | **Max flies the ORRERY** — `deferred-to-max`, never agent-PASS |
| AC11 webgl1-rot-cleanup | unit | D (deletion + audit) | grep audit (`d2`) + full suite `failed=0` + `inverse(`-pin decision recorded in commit/test |

Lab instrument roster used (all already in `orrery-orbit-lab.html`): `poseCamera`,
`setProxFade`, `measureLadder`, `perRingLadder`, `driftMeasure`,
`countGreenPixels`, `soloRing`.

---

## 5. String-pin / byte-guard / ledger compliance

- **Byte-guards EMPTY vs `8f1d8e8`** (verified byte-identical at plan time): none of
  `SupercruiseModel.js`, `SupercruisePilot.js`, `AutoNavigator.js`,
  `tourStandoff.js`, `NavComputer.js` is touched by any slice. **`WorldOrigin.js` is
  also untouched** — the rebasing-safety fix (D-1) is achieved entirely by keeping
  the proxy a scene child + layer-based draw suppression, requiring no rebase-API
  change. Re-assert at each workflow increment.
- **`main.js` flight/boot/tour untouched.** The only main.js edits are the two ring
  edits **#5** (field create+add, flag-gated) and **#6** (render-time `field.update`
  call, flag-gated). The lane-B merge ledger goes **FOUR → SIX**. (This holds
  precisely because proxies stay attached — no new WorldOrigin/reposition wiring; the
  review's "≥ SEVEN" estimate assumed detachment, which D-1 rejects.) The existing
  four ring edits on this branch are: (i) `hitTestOrbits`
  `userData.orbitHitPositions` fallback; (ii) `_orbitFactorGeom()`;
  (iii) `_updateOrbitVisibilityFactor()`; (iv) its sim-time call — all unchanged by
  this workstream, still flagged. #5 and #6 are additive and ring-scoped. Slice D's
  flag-branch removal edits `main.js` again but adds no NEW ledger entry (it deletes
  a branch inside #5/#6).
- **Regression test held green (Lens B MUST-FIX #2):** `tests/orbit-ring-rebase.test.js`
  asserts a spawned ring coincides with the rebased barycenter after `warpAccumulate`
  + a later in-system rebase, using `ring.addTo(scene)`. Because D-1 keeps `addTo`
  a real scene insert, this test **stays green unchanged across all four slices** —
  it is enumerated in the `d1` suite gate and re-pinned for the field proxy by `c5`.
  It is NOT migrated or gutted.
- **String-pin migrations (conscious, AC11 — now in Slice D):**
  - `OrbitRingSDF.proxfade.test.js` describe (2) GLSL-string pins (`vProxFade`,
    `cameraPosition`, `alpha*uOpacity*uVisFactor*vProxFade`, the `inverse(`/`transpose(`
    negative pins) are **RETIRED in Slice D** — when the per-ring render shader is
    deleted (the strip). Through Slice C they remain valid (shader still present).
    Replaced by the CPU-side channel-composition pin (added in C).
  - The `inverse(` **negative pin is RE-HOMED, not dropped:** its dead WebGL1
    rationale is deleted, but the live invariant it protected (no per-pixel matrix
    inversion) moves to the field-shader pin (`d2`: field shader contains no
    `inverse(`/`transpose(`; all matrices are CPU-built). Decision recorded in the
    commit message and the test comment per AC11.
  - `OrbitLine.swap.test.js` surface pins (`instanceof THREE.Mesh`, not LineLoop,
    ShaderMaterial, opacity shim, `setVisibilityFactor`/`uVisFactor`) **survive**
    by design (D-1 keeps `.mesh`/`.material` shells).
  - `proximityFadeFactor` JS mirror + its numeric tests **survive unchanged** —
    still the envelope source of truth, now consumed CPU-side.
- **Suite gate:** `vitest run` from the repo dir; pass = `tests failed 0`
  (vendor/motion-test-kit collection noise is the known baseline). `ProcgenSnapshot`
  untouched. Run the `verify-workstream` workflow (opus-pinned, 2-lens adversarial)
  per increment; working-Claude drives the live integration ACs via chrome-devtools;
  AC10 stays Max's gate.
- **library-context (r0.183.1):** no post-cutoff change to the ShaderMaterial /
  fullscreen-pass / `gl_FragDepth` / `logarithmicDepthBuffer` / `DataTexture` /
  `texelFetch` surface; WebGL1 dead since r163 (so the committed `RGBA32F`/WebGL2
  path is safe). Build with the existing sceneTarget-composite idioms.
  `Timer`-over-`Clock` is irrelevant here. Re-check the r185
  `matrixWorldNeedsUpdate` note only if the project bumps three (the field reads
  `matrixWorld` per frame).

---

## 6. Lens adjudication

Every MUST-FIX / SHOULD finding from the 2-lens adversarial review, with
folded/rejected + rationale. Findings verified against source before folding.

### Lens A (mechanism)

| # | Sev | Disposition | Rationale |
|---|---|---|---|
| A1 multi-ring color has no selection rule | MUST-FIX | **FOLDED** | Verified: lab shader is single-color (`orrery-orbit-lab.html:257`). D-4 now specifies single-argmax: front-most (min `w_clip`) band-passing ring owns color+alpha+depth TOGETHER (no decoupling). New pin `b5b` (two-color overlap) + live AC7 crossing drive. |
| A2 CONIC_MAX=64 uniform path can't compile; keeping it inverts portability | MUST-FIX | **FOLDED** | Verified: lab is CONIC_MAX=16 (`:171`); fixed `mat3[64]` needs ~640 vec4 to compile. D-3/R3 now commit to `RGBA32F` DataTexture + `texelFetch` UNCONDITIONALLY; uniform-array path dropped (not a fallback). |
| A3 DataTexture packing has no parity test | SHOULD | **FOLDED** | Cheap. New `b4b`: packed conic evaluates same Sampson as direct `Cs` at ring indices 0/33/63 (catches second-row/transpose bug). |
| A4 `a5` can't prove the float32 strategy it's credited with | SHOULD | **FOLDED** | `a5` now quantizes `Cs` to `Float32Array` before Sampson eval; plan explicitly attributes the field-scale float32 proof to the lab (Slice B), not `a5`. |
| A5 AC5/AC8 fade cutoff never calibrated to shipped dropout | SHOULD | **FOLDED** | New `b8b`: cutoff pinned to measured shipped-SDF angular dropout; fade may remove a ring only where shipped-SDF also drops it. (Same as Lens B5.) |
| A6 AC6 shimmer worst at grazing, not targeted | SHOULD | **FOLDED** | `b9` + live AC6 now include a grazing-pitch (@5200) occlusion-drift pose, not just nominal. |
| A7 `gl_FragDepth` forfeits early-Z, unstated; AC9 needs floor hardware | SHOULD/NOTE | **FOLDED** | Verified: shipped SDF already writes `logdepthbuf_fragment` + `depthWrite:true` (`OrbitRingSDF.js:205,268`) → net-neutral. D-4/R4 now state the forfeit; AC9 sampled on lowest-end GPU available; bbox pre-cull kept ready. |
| A8 Slice C breaks lab `sdf` column | NOTE | **FOLDED** | Stated in Slice D. With the strip moved to D, the `sdf` column survives the whole Slice-B acceptance battery and only goes inert at D — noted so it is not read as a regression. |
| A9 `a4` asserts finiteness, not visibility | NOTE | **FOLDED** | `a4` description + R2 now state it guards finiteness/sign only; does not front as the AC2/AC3 grazing render guarantee. |
| A10 1314px is a body-free lab number; in-game reads lower | NOTE | **FOLDED** | Slice D + AC2 map now explicitly keep the live drive qualitative ("renders where it vanished"), no literal-1314 pin in-game. |
| A11 confirm belts aren't ring-count contributors | NOTE | **FOLDED (verified)** | Verified: `main.js:4829` uses `AsteroidBelt` (separate annulus mesh), not `OrbitLine`; never enters the conic set. R9 states it; the 58<64 margin holds. |

### Lens B (integration/regression)

| # | Sev | Disposition | Rationale |
|---|---|---|---|
| B1 detaching proxies breaks world-origin rebasing for planet/star rings | MUST-FIX | **FOLDED** | Verified: `placeInRebasedFrame`+`maybeRebase` shift only scene children (`WorldOrigin.js:144-147,168-171`); planet/star rings rely solely on that; rebase fires at `[3000,0,0]`. D-1 reversed: proxies STAY scene children, render suppressed by layer not detachment. **Sub-claim "ledger ≥ SEVEN" REJECTED** — that assumed detachment forced new rebase wiring; keeping proxies attached needs none, so the ledger stays SIX and WorldOrigin.js is untouched. |
| B2 `tests/orbit-ring-rebase.test.js` goes RED at Slice C, unenumerated | MUST-FIX | **FOLDED** | Verified the test exists and asserts post-rebase barycenter coincidence via `addTo(scene)`. With D-1 keeping `addTo` real, it stays green unchanged; now enumerated in `d1` + re-pinned by `c5`. Not migrated/gutted. |
| B3 switchover verified a slice late; no runtime fallback; "lab-only gate" self-contradictory | MUST-FIX | **FOLDED** | Resolved: field goes live at Slice C behind `USE_CONIC_FIELD` (default ON); legacy SDF render retained-but-dormant → single-flag atomic rollback. AC11 deletion + strip moved to Slice D (post live-battery). "lab-only gate" clarified as a lab-HTML toggle only. |
| B4 dispose→field-drop contradicts stateless design | SHOULD | **FOLDED** | Reworded (`c1`–`c4`): stateless per-frame re-read means dispose just removes the ring from `system.orbitLines`; next `update()` emits no entry. No registry; test asserts that mechanism. |
| B5 AC8 cutoff not pinned to AC5 anti-vanish floor | SHOULD | **FOLDED** | Same fold as A5 — `b8b` pins cutoff to shipped-SDF dropout. |
| B6 uniform-budget probe (`b4`) not a real automated gate | SHOULD | **FOLDED** | With the uniform path dropped (A2/B1), the compile-limit risk is gone; `b4` is now a DataTexture layout/round-trip unit pin + the lab (live GL) proves texelFetch compiles/renders. b4 recorded in evidence with the target GPU. |
| B7 `renderer.info` 39→1 is a total-delta, not a ring count | NOTE | **FOLDED** | `d3` now states: capture before/after with nothing else changing, attribute the delta. |
| B8 parity surface sound but conditional on the rebase fix | NOTE | **FOLDED** | Resolved by B1 fold; R11 + `c5` make the conditionality explicit and pinned. |

**Rejected:** none in full — only the "ledger ≥ SEVEN" sub-claim within B1 is
rejected (refuted by adopting the keep-attached fix, which removes the extra wiring
the estimate presupposed). All other findings folded.
