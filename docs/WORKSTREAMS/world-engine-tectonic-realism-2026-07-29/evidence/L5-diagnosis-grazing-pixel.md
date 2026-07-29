# L5 — diagnosed live: one grazing pixel, not a plumbing defect (2026-07-29)

**Verdict: L5's vertex plumbing is exact. Its default sampling grid is not.** On the very body L5
"failed" on, it reads **R² 0.999999, rms 2.27e-4** once the grid is changed — about 3× the sphere
tessellation chord sag (7.5e-5), i.e. at the theoretical floor.

## The measurement that settles it

Same body throughout (Rocky (Earthlike), R = 1.0 R⊕, seeds 1234/1234, distance 2.6, frozen, rivers
routed 6029 channels). **Only the L5 sampling grid changed** — `tapControl({ l5: { size, stride } })`.

| grid | pixels | slope | R² | rms | maxAbs | pass |
|---|---|---|---|---|---|---|
| **128 / 7 — the default** | 191 | 1.00069 | 0.985863 | **2.480e-2** | 0.342773 | **false** |
| 128 / 3 | 1037 | 1.00057 | 0.999769 | 3.124e-3 | 0.100342 | true |
| 256 / 7 | 765 | 0.999967 | 0.999999 | 2.401e-4 | 2.930e-3 | true |
| 64 / 3 | 260 | 1.00012 | 0.999999 | 2.271e-4 | 1.029e-3 | true |
| 128 / 13 | 54 | 1.00020 | 0.999999 | 2.068e-4 | 9.766e-4 | true |

rms moves **120×** on an unchanged body. That cannot be a property of the field or of the plumbing.

## It is exactly one pixel

`maxAbs / sqrt(pixels)` reproduces the reported rms to five significant figures:

- default: 0.342773 / √191 = **0.024801** vs reported **0.0248031**
- 128/3:   0.100342 / √1037 = **0.003116** vs reported **0.00312449**

A single outlier accounts for the entire statistic. Every other pixel agrees essentially exactly —
which is what R² 0.999999 in the clean grids says directly.

## That pixel is grazing the silhouette

Replicating `dirForPixel` (fieldSampler.js:1116-1126) and computing each sampled pixel's
cos(incidence) between the view ray and the surface normal — 0 means perfectly grazing:

| grid | min cos(inc) | ray/sphere disc | pixels < 0.01 | median cos(inc) | rms | pass |
|---|---|---|---|---|---|---|
| **128 / 7** | **0.002898** | **8.4e-6** | **1** | 0.6695 | 2.48e-2 | false |
| 128 / 3 | 0.002898 | 8.4e-6 | 1 | 0.6807 | 3.12e-3 | true |
| 256 / 7 | 0.01787 | 3.2e-4 | 0 | 0.6770 | 2.40e-4 | true |
| 128 / 13 | 0.105 | 1.1e-2 | 0 | 0.6765 | 2.07e-4 | true |

**Perfect correlation.** The two grids that admit a sub-0.01 pixel are exactly the two with elevated
rms, and they differ from each other only by 1/√N dilution. The three grids that exclude it all land
at ~2.3e-4. At cos(inc) = 0.0029 the discriminant is 8.4e-6, so the intersection is numerically
ill-conditioned: the analytic hit direction and the direction the fragment actually shaded diverge,
and the residual there (0.343) is ~1400× the typical one.

(The same grazing pixel appears at different (px,py) in different grids because cos(incidence) depends
only on radial distance from the projected disc centre — (91,112) and (36,15) are antipodal about
(63.5, 63.5) at the same radius 55.75, hence identical to 4 significant figures.)

## One mechanism explains the cross-body ordering too

The residual at a pixel is **(angular error) × (local field gradient)**. The angular error blows up
only at grazing incidence; the gradient is a property of the body. The same grazing pixel exists on
Europa and Eyeball — same camera, same grid — but their fine-scale gradients are small, so its
residual stays small and the leg passes. Rocky's is large, so it does not.

That is why the earlier cross-body ordering (Europa 7.7e-4 < Eyeball 2.2e-3 < Rocky 2.5e-2) and the
grid sensitivity are **the same finding**, not two.

## Consequence for the leg's stated bound

The leg's note (fieldSampler.js:1154) tells the reader to read `rms` against the tessellation chord
sag. `rms` is in **field units**; the sag is a **length**. Converting between them requires the field
gradient, so the bound as written is dimensionally inconsistent — which is why "330× the sag" read as
alarming when the plumbing was in fact at its floor.

## The fix, and why it is not a tautology

**Reject pixels below an incidence threshold**, computed from geometry alone — `camO`, the ray
direction and the hit point — and therefore **independent of the field values being compared**.
Rejecting on the *residual* would be the tautology this workstream has hit seven times (discarding
precisely the data that disagrees); rejecting on incidence angle is an independent physical criterion
that can be stated before any field is sampled.

Supporting changes:
1. Raise the default sample count so no single pixel can set the statistic (the default 191 lets one
   pixel carry 100% of rms). `size 256 / stride 7` gives 765 and already reads 2.4e-4.
2. Report a robust statistic (median absolute deviation) alongside rms, and the worst-k pixels **with
   their incidence angles** — so the next run decides this rather than argues it.
3. Restate the PASS bound with the gradient factor in it, or drop the sag comparison from the note
   entirely rather than leave a dimensionally inconsistent instruction in the source.

**Not yet done:** the fix is not implemented. Everything above is measurement on the shipped code.
