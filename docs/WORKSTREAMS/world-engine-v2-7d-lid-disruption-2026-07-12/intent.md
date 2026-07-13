# world-engine-v2-7d-lid-disruption — intent

## Why we care (proposed phrasing — Max confirms/rephrases at greenlight)

> Build the shared lid-disruption machinery now so the cantaloupe and diapir payoffs stay
> reachable — I don't want V2-7 to arrive and find its foundation was never built.

V2-7d is the funded-but-cuttable infrastructure increment the signed ROADMAP (§3.1) placed
between the pilot and the epoch editor: generalize "basal upwelling → quasi-circular lid
deformation" from its two structurally different shipped seeds (shellRelief STEP-2 convection
cells; stagnantLid coronae) into one owned module. It is a BUILD, not a reuse — the shipped
writers are untouched; consumers arrive at V2-7 (cantaloupe-silicate epochs) and V2-9a (the
diapir-grooved-coronae option). Cutting it strikes the cantaloupe unlock and forces #4.5 to
block-jumble — funding it now is what keeps both payoffs alive.

**Orientation:** serves the JOURNEY world-engine objective (history-coherent variety) as
enabling infrastructure; PLAYER_EXPERIENCE-wise invisible this increment (no visual surface
until V2-7/V2-9a; lab-only program by charter until V2-10).

## Success criteria (process/tooling carve-out — contract-shaped: deliverable interface + verifiable observation)

- One owned module (`src/worldengine/base/lidDisruption.js`) exists that can express BOTH
  seed patterns as instances — as a FAMILY (two constructors + a shared profile library +
  one discipline), never a fake 1:1 mode-flag merge.
- The extracted radial-profile functions are provably formula-identical to the shipped inline
  arithmetic (the one legitimate 1:1 claim — those formulas are already copy-duplicated in
  `stagnantLid.js` and `mixedInterior.js`).
- Structure-reproduction is validated on synthetic inputs with enumerated statistics
  (gate-3 discipline) — explicitly NOT byte-matching shipped worlds (new `'disrupt:'`
  namespace ⇒ different bytes by design).
- Both future consumer seams are mechanically demonstrated: pluggable grooved profile
  (V2-9a diapir option alive, geometry pick NOT made) and placement/eval split with
  descriptor mutation + re-eval (the V2-7 editor seam).
- Zero production wiring: no `src/` file imports the module this increment; every shipped
  writer byte-identical by construction; full suite green unchanged.

## DOES / UNLOCKS (Rule 15 card)

**DOES:** builds `src/worldengine/base/lidDisruption.js` — `makeCellDisruption` (generalizes
shellRelief STEP-2: space-filling warped-Voronoi partition, BFS wall-distance interiorness),
`makeFociDisruption` (generalizes stagnantLid coronae: pool-∝-N field-biased rejection
sampling, heavy-tailed radii, typed features), a pure analytic profile library
(active/inactive corona ≡ shipped formulas + a NEW grooved-diapir capability profile), and
`evalFociDeformation` (evaluation split from placement) — plus its validation test suite.
New alea namespace `'disrupt:'` (the ROADMAP §2.2 "new `'lid:'` namespace" phrasing is stale —
`'lid:'` was consumed by the shipped V2-2 pilot). Zero production wiring (precedent:
`interpenetration.js`).

**UNLOCKS:** V2-7's cantaloupe-silicate epoch expression (cell disruption paintable on a
silicate host, regime-gate-free, editable descriptors); V2-9a's diapir-grooved-coronae option
(pluggable profile, low-count-graceful placement) without preempting Max's block-jumble-vs-
diapir pick (§7a); a future dedup of `mixedInterior.js`'s third inline profile copy
(deliberate non-goal now, candidate follow-up after V2-7 proves the interface).

## Deliberate non-goals (fences)

- NO rewiring of `shellRelief.js` / `stagnantLid.js` / `mixedInterior.js` — their draw streams
  and bytes are frozen; the module never byte-matches them and never tries.
- NO stress coupling inside the module — shell's `stressTensile` chaos gating is shellRelief's
  physics; disruption fields are returned raw and consumers modulate (designDecision).
- NO carrier writes (`height`/`grainAngle`/`faultDensity`/`regime` untouched); no relax passes
  inside the module (SP-RELAX belongs to writers/composers).
- NO absorption of `mixedInterior.js`'s duplicated profiles this increment (zero-wiring fence).
- NO #4.5 geometry decision — the grooved profile is a synthetic capability proof, not a
  Miranda look; no preset, no writer, no lab surface.
- NO UAT gate — infrastructure with no visible surface; believability gates arrive with
  V2-7/V2-9a. Terminal gate = VERIFIED (like V2-0/V2-1/V2-2a).
