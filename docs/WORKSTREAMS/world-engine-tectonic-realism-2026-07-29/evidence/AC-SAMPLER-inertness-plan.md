# AC-SAMPLER — live inertness + control test plan

**For:** working-Claude, driving `:5175` via chrome-devtools.
**Written by:** the AC-SAMPLER implementation subagent (no browser access, no server).
**Status of the code when this was written:** landed in the working tree, **not committed**.

---

## 0. Why this document exists, and what it is a net for

AC-SAMPLER buys certainty about *which field is measured* by putting the tap **inside the program the
planet renders**. The bill for that is a risk round 2 did not have: **the instrument now lives in the
render path, so "the instrument changed the render" is newly possible.**

The claim being tested is narrow and falsifiable:

> With `uFieldTap == 0`, no tap branch is taken, so the surviving path executes the identical sequence
> of expressions on identical inputs. The rendered frame is **byte-identical** to the frame before the
> edit.

That is a claim about a *driver's optimiser*, not a theorem. Introducing control flow can change
register allocation, expression sinking, and — the one that actually bites — **FMA contraction**. GLSL
leaves contraction and intermediate precision to the implementation. A 1-ULP shift in `h` propagates
through `smoothstep` edges (the F14 `liquidMask` band, the F20 shore SDF, the AC4 relief gate) and
through the Stage-6 posterize split, so a 1-ULP arithmetic change can surface as a 1/255 pixel change
at a threshold crossing.

**There is no automated net for this.** Golden `40c18aad` hashes a motion accumulator and cannot see
relief. `fence-baseline.json` and `l0-baseline.json` are CPU relief artifacts that never run the
fragment shader. **The capture pair below IS the net**, and it belongs in this directory as an
artifact.

---

## 1. Preconditions

| Item | Value |
|---|---|
| Lab URL | `http://localhost:5175/world-engine-lab.html` (Max's own tab is page 2 — **never touch it**; use an isolated context) |
| Server | already running; **do not start one** |
| Browser hygiene | close every page you opened when finished (`close_page`), then sweep |
| Do NOT | re-capture goldens; `git add -A`; touch `src/auto/CameraChoreographer.js` or `src/debug/LabMode.js` |

### 1a. Producing the BEFORE page — the only safe recipe

The AC-SAMPLER work is **uncommitted**, so `git checkout -- world-engine-lab.html` would destroy it, and
`git stash` risks the two standing NOT-OURS mods. Do this instead:

1. **Commit the AC-SAMPLER work first** (explicit paths only):
   ```
   git add world-engine-lab.html planet-lod-rivers.js \
           src/worldengine/instrument/fieldSampler.js \
           tests/instrument-tap-fence.test.js \
           docs/WORKSTREAMS/world-engine-tectonic-realism-2026-07-29/evidence/AC-SAMPLER-inertness-plan.md
   git commit -m "AC-SAMPLER: in-place uFieldTap instrument tap ..."
   ```
2. Materialise the pre-edit lab **as a second page**, so both are live at once and no restore is ever
   needed:
   ```
   git show HEAD~1:world-engine-lab.html > planet-lod-lab.BEFORE.html
   ```
   `HEAD~1` = the commit before the AC-SAMPLER commit (`262e233` at the time of writing).
3. The BEFORE page is served at `http://localhost:5175/planet-lod-lab.BEFORE.html`. Its imports
   resolve to the **new** `src/...` modules — that is fine and deliberate: the pre-edit lab only calls
   `createFieldSampler` lazily inside `_ensureFieldSampler()`, which a render-only capture never
   reaches. Its **render path** is byte-for-byte HEAD~1's.
4. When finished: `rm planet-lod-lab.BEFORE.html` (that exact name — no glob, no `-f`).

> If you would rather not commit yet, the fallback is `git stash push -- world-engine-lab.html` (explicit
> path, so the NOT-OURS mods are untouched) → capture A → `git stash pop`. It is strictly riskier and
> the two-page recipe above is preferred.

---

## 2. Freezing the confound: the animation clock

**This is the step that makes the comparison possible at all.** The lab's `frame()` advances `t` by
`0.0025` every frame and writes it to `uTime`, which drives cloud drift, aurora rays, the F41 magma
shore wave and the F25 storm animation. Two pages loaded seconds apart are at different clock values,
so *every* pixel comparison would be red for reasons that have nothing to do with the tap.

A console-only freeze hook was added for exactly this (default **off** — the rendered frame is
unchanged until asked). On **both** pages, before any capture:

```js
_lab.freezeAnimation(true);     // stops t AND planet auto-spin
_lab.setAnimationClock(0);      // pin both pages to the SAME clock value
_lab.state.spinSpeed = 0;
```

Verify with `_lab.animationFrozen === true && _lab.animationClock === 0` on both pages.

---

## 3. Matching the two pages exactly

`settingsBlob()` / `applySettings()` is the reliable channel (it is the same one the existing
chrome-devtools verification uses).

On the **AFTER** page (the real lab), for each capture point:

```js
_lab.setPreset('<PRESET>');
_lab.setSeed(1234, 1234);
_lab.applySettings({ distance: <D>, yaw: 0.7, pitch: 0.25,
                     lightAzimuthDeg: 35, lightElevationDeg: 12,
                     spinSpeed: 0, normalMode: <NM>, octAuto: true, fwClamp: true,
                     pixelScale: 1, macroSeed: 1234, detailSeed: 1234 });
_lab.freezeAnimation(true); _lab.setAnimationClock(0);
JSON.stringify(_lab.settingsBlob())
```

Copy that exact blob string to the **BEFORE** page and run:

```js
_lab.setPreset('<PRESET>'); _lab.setSeed(1234, 1234);
_lab.applySettings(<paste the blob>);
_lab.freezeAnimation(true); _lab.setAnimationClock(0);
```

Then **assert the blobs are string-equal** before capturing. If they are not, stop — you are comparing
two different bodies, not two compilations of one.

> `freezeAnimation` / `setAnimationClock` do **not** exist on the BEFORE page (they are part of this
> edit). On the BEFORE page freeze by hand instead: `_lab.state.spinSpeed = 0`, and capture both pages
> at matched `uTime` by reading `_lab.uniforms.uTime.value` on each and only comparing captures whose
> values agree exactly. If they cannot be made to agree, the honest fallback is §6.

---

## 4. The capture set — 4 pairs, fixed seed 1234

| # | Preset | `distance` | `normalMode` | What it is for |
|---|---|---|---|---|
| **P1** | `Rocky (Earthlike)` | camera floor (`_lab.state.distance = _lab.state.distance` after one scroll-to-min; read the HUD `dist/radius`) | 0 (analytic) | Maximum octave trip count, every combiner live, the AC4 carve and F14 cut both reached. The primary case. |
| **P2** | `Rocky (Earthlike)` | `20` (the default far stop) | 0 (analytic) | Different `uOctaves` loop trip count and a different branch mix — a different register-allocation regime for the same edit. |
| **P3** | `Gas giant (Jovian)` | `8` | 0 (analytic) | `uBandStrength > 0`, so a different Stage-6 path and the gas-flattening branch at `perturbAnalytic`. |
| **P4** | `Rocky (Earthlike)` | camera floor | **1 (finite-diff)** | **The discriminator.** The taps are textually outside this branch, so the edit is *provably dead in source* here. Any difference on P4 is unambiguously a compiler artifact, which is exactly what step (i) of the fallback ladder needs. |

Also run **P5** if time allows: `Eyeball (locked temperate)`, `distance` 6, analytic. Not for
inertness (it adds nothing there) but because it is the preset on which the round-3 blocker-1 defect
would have been invisible — see §7.

For each: capture the **AFTER** page and the **BEFORE** page at identical settings.

---

## 5. Comparison method

Screenshot both pages the same way (`take_screenshot`, full viewport, PNG, same device pixel ratio —
set the window size once and do not resize between captures). Then compare the **decoded pixel
buffer**, not the PNG container:

```bash
node -e '
const { PNG } = require("pngjs"); const fs = require("fs"); const crypto = require("crypto");
const dec = f => PNG.sync.read(fs.readFileSync(f)).data;
const a = dec(process.argv[1]), b = dec(process.argv[2]);
const h = x => crypto.createHash("sha256").update(x).digest("hex").slice(0,16);
console.log("A", h(a), "B", h(b), a.length === b.length ? "" : "SIZE MISMATCH");
let n = 0, max = 0;
for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i]-b[i]); if (d) { n++; max = Math.max(max, d); } }
console.log("differing channels:", n, "of", a.length, "| max per-channel delta:", max);
' A.png B.png
```

`pngjs` is already a devDependency. **Any differing pixel falsifies "byte-inert".**

Store every capture and the diff numbers under
`docs/WORKSTREAMS/world-engine-tectonic-realism-2026-07-29/evidence/inertness/`.

---

## 6. If it comes back RED — the fallback ladder, so a red is a decision not a dead end

1. **Quantify.** Report differing-pixel count and max per-channel delta per pair. Then **bisect by
   tap**: comment out one insert at a time (three inserts = three separate suspects) and re-capture.
   Check P4 first — a difference there is a pure compiler artifact with no source-level explanation
   available, which tells you immediately which kind of problem you have.
2. **If bounded (≤ 1/255, confined to threshold-adjacent pixels): DECLARE it with the measurement**
   in the workstream record rather than claiming inertness. An honest measured bound is worth more
   than a false axiom — this workstream's entire complaint is about confident wrong numbers.
3. **If larger: restructure.** Collapse to a single tap point (`TAP_SOLID` only) and recover the
   composite anchor by other means, or gate the whole analytic block. **Do not proceed on an
   unexamined difference.**

---

## 7. The control legs — `_lab.tapControl()`

The structural half of L1 already runs headless and is green
(`tests/instrument-tap-fence.test.js`, 26/26). Everything below needs a GPU.

Run on the **AFTER** page, one synchronous call per configuration (do **not** await anything between a
plant and its read — the rAF `frame()` unconditionally rewrites `uOctaves`, `uLodRamp`,
`uReliefBakeStrength`, `uCraterBakeRestore`, `uPerturb`, `uNormalMode` and `uFwClamp` every frame):

```js
_lab.freezeAnimation(true);          // also stops the frame loop from clobbering L3's plants mid-run
_lab.rivers(true);                   // L2 needs a routed body (it reads the baked carrier)
// wait for the route to finish — check _lab.riverStats — then:
JSON.stringify(_lab.tapControl(), null, 1)
```

### Configurations that MUST be covered

| Config | Why it is mandatory |
|---|---|
| `Rocky (Earthlike)`, R = 1.00 (slider `t` = 0.303), bake strength 1 | The AC's own indictment. **L2 only exists here**: the frame loop re-weights `uReliefBakeStrength` by the bake→synth display crossover, which is exactly 1 only at radius 1 R⊕. Away from it L2 reports `notAnchored` and does not run. |
| One shell / volcanic preset (`Europa (icy moon)` or `Magma (K2-141b)`) | L3 coverage is **configuration-scoped**: combiners gated to zero in a preset cannot be exercised there. |
| **A tidally locked preset — `Eyeball (locked temperate)` — is NOT optional** | This is the state that defeated the round-3 design. `uFrostLocked = 1` ⇒ `glacialCombiner` and `sublimationCombiner` read `vSubstellarAngle`, which reaches **h and grad** upstream of every tap. Under the design's original three-substitution derivation, L1/L2/L3 all pass on this state (L3 even reports the gates as *covered*), and only L4/L5 discriminate — and the design's run plan pointed at Rocky, which is `locked: false`. **The fix makes it structural (see §8), but the run plan must still point at it.** |

### What to read in the verdict

- **L1** — `pass: true`, and record `programDigest`. If `problems` is non-empty, stop; nothing below it
  means anything.
- **L2** — `height.slope ≈ 1`, `height.r2 > 0.98`, **and the gradient channels**: `gradient.r2 > 0.8`
  with `gradient.gpuRms > 0`. The GBA channels are what make "the baked gradient was dropped from the
  composite" fail here. **Today's pre-AC-SAMPLER sampler regressed near R² ≈ 0 against the cube** — if
  the new number is not decisively better, the AC has not closed.
- **L3** — read the **per-gate table**, not the aggregate. Any `errors` entry means a plant was
  overwritten between set and read: that is a **leg ERROR, not a result** (the invariance clauses would
  otherwise pass *vacuously* against an unplanted field). Expect `uReliefBakeStrength` and
  `uCraterBakeRestore` to **move** `TAP_COMPOSITE` and every other live gate to move its own tap while
  leaving `TAP_COMPOSITE` byte-identical.
- **L4** — compare `real.r2` against `gradBaseMutant.r2`. If the separation is not clear (`weak: true`),
  **report the leg as WEAK, do not pass it.** Two shipped terms are knowingly gradient-inconsistent by
  construction (the AC4 carve scales height by `uRiverCarveDepth` and gradient by
  `uRiverCarveStrength`; the F14 cut neglects `∇liquidMask`), so the correct implementation has a
  nonzero residual too — that is what `floorAtComposite` is for.
- **L5** — `parity.r2 > 0.99`, `parity.slope ≈ 1`. Read `parity.rms` against the sphere tessellation
  chord error: `SphereGeometry(R, 256, 256)` has a **longitude** step of `2π/256 = 0.0245 rad`
  (sag ≈ 7.5e-5) and a **latitude** step of `π/256 = 0.0123 rad` (sag ≈ 1.9e-5). The **larger** governs;
  the round-3 design quoted the smaller. Report `fadeGap` as a **number** — it is the measured cost of
  pinning octaves and disabling the sub-pixel fade, and the octave decision is supposed to be reported
  with that number attached rather than argued.

### Second-order safety check, every time

After any `tapControl()` run or any `sampleField()` call, confirm:

```js
_lab.uniforms.uFieldTap.value === 0
```

`uFieldTap` is a live uniform on the material the planet renders with. If it is ever left nonzero the
planet renders raw float field data as colour. The set/restore pair is `finally`-blocked around a
single synchronous render, and the failure mode is loud and visible rather than silent — but check it.

---

## 8. The three round-2 counterexamples — where each one now dies

| Counterexample | Blocked by |
|---|---|
| (a) A reduced program running 6 of 26 combiners | **By construction.** There is no second program to reduce: the instrument compiles `planet.material.fragmentShader` itself, `createFieldSampler` throws without the material, and `read()` throws if the material's string drifts. Additionally caught per-term by **L3**, which names which gates went dead. |
| (b) `gradBase` substituted for `grad` at the tap | **Headless, by the fence** (verified: the substitution turns `tests/instrument-tap-fence.test.js` red on 4 clauses) **and live by L4**, which is proven red against a one-token mutant of the live string rather than assumed to discriminate. |
| (c) The baked gradient dropped from the cube composites | **L2's GBA channels** (a dropped gradient reads as zeros against nonzero cube data), and structurally: it changes what `perturbAnalytic` receives, so it becomes a *visible terrain bug in the render*, not an invisible instrument bug. |

And the round-3 blocker: a use of `position` surviving the vertex derivation — including the
`vSubstellarAngle` one that killed round 3, and any **fifth** use added later — now **throws at
construction**, because the assertion is a whitelist (no bare `position` outside the single
`gl_Position` write) rather than an enumeration of named targets.

---

## 9. What this plan does NOT close

- **UAT.** Whether the numbers are *useful* is Max's gate, not this one.
- **`uNormalMode == 1`.** The tap covers the analytic path only; the sampler throws on the finite-diff
  path rather than returning a number that came from somewhere else. AC-EXAG explicitly needs both
  paths compared (they disagree by ~24×) and that needs its own mechanism.
- **Whether the field is *right*.** This AC settles *which* field is measured and nothing else. The
  vertical axis is still uncalibrated until AC-KMUNIT lands, and `fieldSampler`'s refusal to emit km
  must stay in force until then.
- **Chain membership over time.** The fence pins that nothing writes `h`/`grad` between `TAP_SOLID` and
  the F14 cut, which closes the cheap version of "a new relief term is added below the tap". It does
  **not** snapshot the ordered combiner list; a reorder *above* the tap is still invisible to CI.
