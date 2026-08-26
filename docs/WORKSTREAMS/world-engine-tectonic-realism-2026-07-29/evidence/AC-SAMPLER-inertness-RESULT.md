# AC-SAMPLER — inertness capture pair: RESULT (2026-07-29)

**Executes:** `AC-SAMPLER-inertness-plan.md` §1–§6.
**Ran by:** working-Claude, live in chrome-devtools against `:5175`.
**Captures + comparator:** `evidence/inertness/` (`compare-frames.cjs` decodes both PNGs and
compares the pixel buffers, not the containers).

---

## Verdict

**All five AFTER/BEFORE pairs are byte-identical**, at a capture configuration whose detection
floor was *measured* rather than assumed: **~1e-7 in field units, i.e. approximately one float32
ULP at O(1) magnitudes.**

The honest statement of what that buys is in §5. It is stronger than the plan asked for and it is
still not a proof of bit-exactness.

| Pair | Preset | dist | normalMode | SHA-256/16 (both pages) | Verdict |
|---|---|---|---|---|---|
| P1 | Rocky (Earthlike) | 1.1 (camera floor) | 0 analytic | `a4f5dc84ffc77e94` | IDENTICAL |
| P2 | Rocky (Earthlike) | 20 | 0 analytic | `6ae3c7f28100559f` | IDENTICAL |
| P3 | Gas giant (Jovian) | 8 | 0 analytic | `4e2082fa915c1fb1` | IDENTICAL |
| P4 | Rocky (Earthlike) | 1.1 | **1 finite-diff** | `dd398ad601466634` | IDENTICAL |
| P5 | Eyeball (locked temperate) | 6 | 0 analytic | `80b8085643c40e05` | IDENTICAL |

Every pair: 0 differing channels of 6,916,560; max per-channel delta 0.

P1 was additionally run at the shipped `levels = 6` quantizer: also IDENTICAL (`ea5d0a57e9e3bc82`).

**The five hashes are mutually distinct**, which is itself a control — the capture responds to
configuration, so "identical" is not an artifact of capturing the same frame five times.

---

## 1. How BEFORE was produced

`git show 2a5daa0:world-engine-lab.html > planet-lod-lab.BEFORE.html`, served alongside the live lab
so both are up at once and no working-tree restore is ever needed. `2a5daa0` is `a2e36de~1` — the
commit before AC-SAMPLER landed. Confirmed on the live BEFORE page: no `uFieldTap` uniform,
`fragmentShader.includes('uFieldTap') === false`, no `freezeAnimation`/`tapControl`.

The AC-SAMPLER diff to `world-engine-lab.html` touches GLSL in exactly four places — the
`uniform int uFieldTap;` declaration and three uniform-gated early returns. Everything else in the
commit is JS.

## 2. Freezing the clock

`frame()` advances `t` by 0.0025/frame and `t` reaches the render through **one** write site,
`uniforms.uTime.value = t`. On AFTER: `freezeAnimation(true)` + `setAnimationClock(0)`. On BEFORE
those hooks do not exist (they are part of the commit under test), so `uTime` was pinned by
redefining that uniform's `value` accessor, plus `state.spinSpeed = 0` and
`planet.rotation.set(0,0,0)` on both. **That substitution is JS-only and therefore cannot reach GLSL
compilation, which is the thing under test.** Verified: `uTime` held at 0 across 120 frames, rotation
drift 0.

## 3. Proving the two pages were the same body

`settingsBlob()` came back **string-equal** on every pair. Beyond the plan's requirement, a full
fingerprint (all ~330 `state` keys + every uniform value + camera + rotation + scale + canvas dims)
was diffed across pages. **Six entries differ, all expected:**

- `uniforms.uFieldTap` — present on AFTER, absent on BEFORE. *That is the edit.*
- five `CubeTexture`/`DataTexture` **object UUIDs** (relief bake, crater bake, river carve, carve
  patch, tectonic grain) — per-page instances of the same seeded bake.

Every numeric state value and every numeric uniform matched exactly, including
`planetRadiusEarth = 0.8188630066346377`, `uOctaves`, `sVis`-derived `planet.scale`, and bake counters.

## 4. Controls — the part that makes the result mean something

| Control | Question it answers | Result |
|---|---|---|
| **Null** — AFTER captured twice, no state change | Is the capture even repeatable? | IDENTICAL. Rules out compositor/on-demand-render noise. |
| **Liveness** — `uFieldTap = 2` vs `0`, same state | Are the tap branches real code in the compiled program, or did the driver fold them away? | **84.78% of pixels differ**, max Δ172. The branches exist and execute. |
| **Restore** — force the tap ON, then back to 0 | Does the set/restore pair leave residue? | Returns to `a4f5dc84ffc77e94` exactly. |
| **Sensitivity** — see §5 | What can this instrument actually see? | Floor measured at ~1e-7. |

## 5. The measured detection floor — and why the quantizer was changed

The plan did not pin `levels`. At the lab's default `levels = 6`, `posterize()` is
`floor(c*levels + 0.5)/levels` — a **six-step** quantizer. Measured against a perturbation of
`state.perturb` (domain-warp amplitude, so it moves `h` at every sample):

| perturbation | `levels = 6` (shipped default) | `levels = 255` (used for the pairs) |
|---|---|---|
| +1e-4 | 115 px, max Δ43 | — |
| +1e-5 | 13 px, max Δ42 | — |
| +1e-6 | **0 px — blind** | — |
| +1e-7 | — | **1 px, Δ1** |
| +1e-8 | — | **0 px — blind** |

So the pairs were re-run at `levels = 255`, where the quantizer step equals the 8-bit output step and
the instrument is ~100× more sensitive. `uPerturb ≈ 0.682`; one float32 ULP there is ≈6e-8 — i.e.
**the configuration used sits at roughly 1-ULP sensitivity**, which is exactly the magnitude the plan
identified as the risk (FMA contraction / register-allocation drift).

Had the pairs been run at the default `levels = 6`, "byte-identical" would have excluded only
differences above ~1e-5 — three orders of magnitude short of the claim.

## 6. What this does NOT establish

1. **Not bit-exactness.** The output is 8-bit; a difference below the ~1e-7 floor cannot surface. The
   claim supported is: *no arithmetic difference at or above ~1 ULP at O(1) magnitudes, at these five
   capture points.*
2. **One driver.** `ANGLE (NVIDIA GeForce RTX 5080, D3D11)`, Chrome 150, WebGL2, `highp` fragment
   precision 23. The claim is about a driver's optimiser, so it is a claim about **this** one. A
   different GPU/driver is a different experiment.
3. **Texture contents were not hashed.** The five bake textures were matched by construction (same
   preset, same seeds, same bake counters) and by every numeric uniform agreeing, but their texel
   data was not compared byte-wise.
4. **Five viewpoints, not the whole configuration space.** P4 is the discriminator the plan wanted:
   under `normalMode = 1` the taps are provably dead in *source*, so identity there is evidence about
   the compiler specifically, and it holds.
5. **Nothing about whether the numbers are useful.** That is AC-UAT, and it is Max's gate.

## 7. Side observation, filed not actioned

At P2 (whole disc, Rocky Earthlike, seed 1234) the planet reads as a uniform dry tan sphere — no
coastline, no land/sea split, no belt structure. That is not a defect in this test; it is the
AC-HYPSO / AC-PROVINCE gap this workstream exists to close, visible in a captured artifact.

## 8. Reproducing

Both pages were opened in an isolated browser context and closed afterwards; `planet-lod-lab.BEFORE.html`
was removed by exact name. To re-run, redo §1, then drive `__setup({preset, distance, normalMode,
levels: 255, macroSeed: 1234, detailSeed: 1234})` on both pages, screenshot each, and

```
node docs/WORKSTREAMS/world-engine-tectonic-realism-2026-07-29/evidence/inertness/compare-frames.cjs A.png B.png
```

Exit code 0 = identical, 1 = different.
