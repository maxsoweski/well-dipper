# WS4 workstream notes — `world-engine-relief-wiring-2026-06-25`

Append-only working notes for this workstream. The binding artifacts remain
`intent.md`, `contract.json` (Synthesis owns edits to it), and
`grounding-dossier.md`. This file records decisions/restatements that the
build wants to hand to the Synthesis phase WITHOUT editing `contract.json`
in-flight.

---

## T16 — Contract-wording restatement (D11)

**Status:** recorded (doc task — no code, no test). Synthesis applies the
patch to `contract.json`; this file is the source text it copies from.

### Why this exists (the conflation being corrected)

`contract.json` → `architecturalConnections.outputs` historically described
WS4 as "replace per-feature axis hashing at `initProvinces:797` /
`fbmdRidged:880`", and the `renderer-expression-only` AC referenced "the
initProvinces / fbmdRidged paths." This **conflates two independent
mechanisms**:

- `initProvinces` / `gProvince` / `provinceWeight` carry **AMPLITUDE** (the
  per-fragment *where*/strength masks — `.x` tectonic, `.y` volcanic, `.z`
  ancient/hydrologic). They do **NO** strike/orientation hashing.
- The **strike/orientation** hashing that WS4 actually replaces lives in the
  **six combiner axis reads** + their **six `deriveUniforms` hashes** + the
  `seededUnitVec3` primitive + the four grained-axis GUI rerolls.

Per **Max decision #6**, the amplitude field is **AUGMENTED (kept, behind
`uProvinceWeight`), NOT replaced**. A reader of the old cite-pair would
(a) miss 5 of the 6 real axis sites and (b) wrongly conclude the province
amplitude masks get torn out. The dossier flagged this as a SEMANTIC
CONFLATION (lines correct, mechanism wrong) — see
`grounding-dossier.md` §"Stale framings", §"Contradictions", and the D11
entry in the plan.

### Precise restatement (for Synthesis to patch into `contract.json`)

> The shader stops deriving **STRIKE / ORIENTATION** for grained features.
> The replace-set is the **SIX combiner axis reads**
> (`fbmdRidged:881`, `canyonCombiner:1917`, `scarpCombiner:1955`,
> `tesseraCombiner:2102/2110`, `lavaPlainsCombiner:2189`,
> `cryoRidgeCombiner:2621/2631`) + their **SIX `deriveUniforms` hashes**
> (orogeny:662, chasma:685, scarp:707, tessera:725, lava:772, cryo:888) +
> the `seededUnitVec3:483` primitive + the **four grained-axis GUI rerolls**
> (orogeny:3715 [`Math.random` angle, NOT `randUnitVec3`], chasma:3728,
> scarp:3743, tessera:3769).
>
> **`initProvinces:797`, `gProvince:796`, and `provinceWeight:811` are
> explicitly PRESERVED** — amplitude/where masks, AUGMENTED behind
> `uProvinceWeight` per Max decision #6, NOT replaced. The grain composes
> ORIENTATION against `gProvince` **in-shader** (a province-keyed rotation of
> the cube strike — `grainProvinceRotate`/`grainProvinceRotate2`): it READS
> `gProvince`, it never replaces it.

These three preserved cites — `initProvinces:797`, `gProvince:796`,
`provinceWeight:811` — are the canonical tokens the contract,
`grounding-dossier.md`, and the plan all use; carry them verbatim into the
patch so the audit (`renderer-expression-only`, T17) and the contract text
agree word-for-word.

### Cross-checks against the T13 replace-set table (plan §D7)

The replace-set lines above match the plan's D7 table and the corrected
`architecturalConnections.outputs`. `lavaPlainsCombiner`/`cryoRidgeCombiner`
GUI rerolls touch only OFFSETS (`lavaOffset` / `cryoRidgeOffsetV`), never
their AXES, so they are correctly absent from the gated-reroll set
(4 gates, not 6). Orogeny is the vec2 (xz-plane) special case — its cube
strike is projected `normalize(strike.xz)` before the `mix`.

### DRIFT FLAG for Synthesis (honest cite correction — re-verified 2026-06-25)

The preserved-cite line numbers in the contract/dossier (`:796` / `:797` /
`:811`) are a SNAPSHOT from before the T5/T13 in-shader build landed. The
prior WS4 commit inserted the grain uniforms + the `grainProvinceRotate`
helpers + the branch-guarded combiner reads, shifting every line below the
insertion point. In the CURRENT `planet-lod-height.glsl.js` the three
preserved constructs now live at:

| construct | contract cite | CURRENT line (2026-06-25) |
|---|---|---|
| `vec3 gProvince` declaration | `:796` | **824** |
| `void initProvinces(vec3 pos)` | `:797` | **825** |
| `float provinceWeight(int fid)` | `:811` | **839** |

The combiner axis reads have likewise shifted (e.g. `fbmdRidged` orogeny
`mix(uOrogenyAxis, …)` now at ~950; `scarpCombiner` at ~2032;
`cryoRidgeCombiner` at ~2708/2722) — all six confirmed wired through the
branch-guarded `mix(…, uTectonicGrainStrength)` path with the
`grainProvinceRotate*` province composition, and the three preserved
constructs confirmed PRESENT and untouched (amplitude only).

**Recommendation for Synthesis:** patch `contract.json` using the *semantic*
restatement above (which mechanism, which construct), and either (a) keep the
canonical `:796/:797/:811` cite tokens as the agreed shorthand the AC + audit
share, or (b) re-anchor them to the current `824/825/839` if the contract is
to track live line numbers. Do NOT silently mix the two. The semantic claim
(amplitude PRESERVED, six orientation sites REPLACED) is correct under either
choice.

### Scope boundary (what this task does NOT do)

- Does **NOT** edit `contract.json` — Synthesis owns that file (per task
  constraint + plan T16 note).
- Does **NOT** touch code, shaders, or tests — pure documentation.
- The `renderer-expression-only` audit (T17) is the operational enforcement
  of this restatement; this note only supplies the exact wording.
