# AC5c — the crater path, converged, and the first row this ledger lost to a CONVERGENCE

**Landed:** 2026-08-26 · `afcf6ee` (game side) + `dd08faa` (lab side)
**Ruling:** Max — *"we need to converge; I need to be able to stop saying this, that the lab and game
need to have the same rendering system."*

---

## 1. What made this different from AC5 / AC5b

Those two were **import-backs**: the lab adopted a pack extracted from code it already agreed with.
This is the first **convergence** — two implementations that genuinely differed, resolved into one.

⭐ **And it went against my recommendation.** I proposed ruling the three declared divergences
permanent, on the grounds that the reasoning was already written in-tree and closing them would move
pixels. Max overruled it, and the general principle he stated is the important part: *"I need to be
able to stop saying this."* A well-documented divergence is still a divergence, and being documented
is what lets one survive — it is not what makes one correct.

## 2. What the three divergences turned out to be — MEASURED, and two were not divergences

`craterRelief.glsl.js`'s header claimed three deliberate departures. Diffed before touching anything:

| claimed | what it actually was |
|---|---|
| **1. one combiner, not two** | ⭐ REAL. The lab ran `voronoi3d` twice over the same domain, cells, per-cell hash, host gate and hashed radius. |
| **2. province gating stubbed** | Already converged 2026-08-25. The header text was historic. ⚠ But it concealed a real one — see §3. |
| **3. domain is the unit sphere, not object space** | ⛔ **NOT A DIVERGENCE.** A parameter NAME. The lab's `vPos` is `position / uBodyRadius` (planetShaders.glsl.js:73); the game passes `normalize(pos)`. Both are unit directions. |

And `hash33`, `voronoi3d`, `craterProfile`, `ejectaProfile` were **identical** between the two files,
modulo comments and whitespace. Measured, not inherited from the header's "byte-faithful" claim.

## 3. The divergence the header did NOT name

The game carries a **crater slice** of the province law; the lab has the whole thing. That is why the
module could not be spliced whole, and it is the reason for the three-way split below. A header that
lists its divergences is not a census of them.

## 4. The shape, and why two splices rather than one

`craterRelief.glsl.js` → `CRATER_CELLULAR_GLSL` / `CRATER_PROVINCE_SLICE_GLSL` / `CRATER_COMBINER_GLSL`.
`CRATER_RELIEF_GLSL` remains the concatenation, so the game's single splice is untouched.

⛔ **GLSL declaration order forces two splice points, not taste:** the cellular keystone must precede
the lab's first other `voronoi3d` consumer (`height.glsl.js:1136`); the combiner must follow the lab's
`provinceWeight` (`:850`). The lab takes both and **not** the province slice.

`initProvinces` moved out of the combiner to each host's call site — the shape the lab already had
(`planetShaders.glsl.js:209`). That call was the last host-specific line in the body.

**Net:** height.glsl.js −138 lines, six definitions deleted, two calls became one.

## 5. Ledger: IMPORT_BACK_DEBT **2 → 1**

`shaders/craterRelief.glsl.js` cleared. Row DELETED rather than rewritten, per the rule that reds on
a stale row. ⭐ The row's own text had offered exactly the two exits Max chose between.

⚠ **And the last remaining row's blocker was stale too** — corrected in the same commit. It read
"blocked by the pack rows above", and all eight packs are imported and called. **That is the third
row in this ledger to stand on a reason nobody re-checked** (after `emission-e.js` and a fence file
that never existed). The liveness test cannot catch this class: it proves a row still DIVERGES, never
that its stated reason is true.

## 6. What VERIFIED means here, and what it does not

- Four shared functions diffed identical **before** deletion.
- Full suite: **30 failing files before, the same 30 after, identical set**, +3 passing. Measured by
  stashing — the handoff's recorded baseline was stale, so it was re-measured rather than trusted.
- Citations **848/848**. Two repaired by locating the symbol; two more had moved FILE, not just line.
- Three gates fired and each was obeyed: a backtick in a comment ended the GLSL template literal; a
  new line in `Planet.js` broke 149 citations; `material-parity-list` caught a new GLSL local at
  26 → 27, so `normalize(pos)` is written twice rather than bound to a temp.

⛔ **NOT VERIFIED LIVE, AND THIS IS THE HONEST GAP.** There is no headless GL in this project — no
puppeteer, no playwright, no `gl` — so **the shader has never been compiled.** Every assertion in
this repo greps source text, and the one way this change can fail (a splice ordering that puts a call
above its declaration) produces a black planet while leaving all of them green.

⭐ Which is why a new **assembled-shader fence** landed with it: every function defined before it is
called, braces balance, no backtick survived — checked against `HEIGHT_GLSL` with the splices
resolved, not against source text. It closes that class. **It is not a compiler and does not claim to
be.** Loading the lab still needs Max's dev server, and the lab's own history says so in its own
words: *"every headless gate stayed GREEN, and the lab died only on page load."*

## 7. Two fences rewritten, both ending stronger

- The crater **transcription** fence held four functions identical between two copies. With one copy
  left it could not fail, **and its own liveness control said so by failing** — which is the fence
  working. Replaced by a **single-source** fence: not "the copies agree" but "there is one copy and
  both front-ends reach it", with a control that catches a re-declared local copy.
- `driver-pack-rockysurface`'s crater-gate assertion grepped `height.glsl.js` as raw text and stopped
  seeing a gate that is still in the compiled program. It now reads the assembled `HEIGHT_GLSL` —
  which is what it always meant.
