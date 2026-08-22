# AC2 — law-conflict survey across the 6 remaining packs

*11 agents, 2026-08-22: one surveyor per pack, then an adversarial verifier told to REFUTE every
claimed conflict and default to "not a real conflict" when uncertain. Max asked for the rulings in
one batch rather than one interruption per pack.*

## Headline: 29 claimed conflicts → 3 real decisions

⭐ **THE VERIFY PASS EARNED ITS COST.** It refuted an entire pack's worth of claims and one more
besides, by measuring rather than reasoning.

| pack | claimed | after refutation | what remains |
|---|---|---|---|
| `giantSurface` | 4 | **0** | all four refuted |
| `solidFeatures` | 0 | **0** | 14 clean uniforms, nothing to decide |
| `polarDeck` | 7 | 6 confirmed | but they are **ONE** decision — see below |
| `solidOptics` | 1 | 1 confirmed | `uTermStrength` |
| `rockySurface` | 11 | 11 confirmed | the crater-floor family |
| `craterDeck` | 6 | 6 confirmed | the same crater-floor family |

## How the refutations were earned

- **`giantSurface`, all 4.** `uTermStrength` looked like a continuous-vs-binary conflict, but this
  pack registers only on gas bodies, and `columnFractionOf` saturates to 1.0 above 0.3 bar. The
  verifier **measured the corpus — 80 seeds, 157 gas bodies, `columnFraction === 1.0` on 157/157,
  zero exceptions** — so the two expressions are bit-identical on this pack's whole domain. The
  disagreeing bodies that DO exist (~0.105 bar) are solid worlds outside its predicate.
  `uMacroOffset` was refuted on different grounds: the pack forwards it and authors no law, so there
  is nothing to conflict with.
- **`polarDeck`'s `uPolarMode`.** Refuted on BOTH prongs: `mode` consumes no rng draw at all
  (`storm-e.js:474`, a pure function of `vigor`), and the `DEFAULT_T_EQ` fallback the surveyor
  thought only the lab bypassed is unreachable from **both** front-ends.

## The three decisions

### 1. `uTermStrength` — NOT ASKED, ruled by precedent

`terminatorOptics.js:95` `columnFraction * 0.15` (continuous, keyed on pressure) vs
`planet-lod-lab.html:2497` `retained ? 0.15 : 0.0` (binary). ⭐ **This is the limb conflict again,
character for character in shape** — a continuous shared law against a binary lab override. Max ruled
that shape 2026-08-22 (shared law wins). Applying the precedent rather than re-asking.
⚠ Real divergence, measured: two bodies at ~0.105 bar resolve 0.1304 against the lab's flat 0.15.

### 2. `stormSeed` — 0 or 1234? **Max's call**

⛔ **THE 6 CONFIRMED `polarDeck` ROWS ARE ONE DECISION, NOT SIX.** The law is *provably identical* —
`storm-e.js:595` names a byte-identity control proving `resolvePolarVortex(a,b,c,d)` equals
`resolveStormE(a,b,c,d).pole`. The only divergence is upstream: the pack passes
`GAME_STORM_SEED = 0`, the lab passes its lil-gui slider default `1234`
(`planet-lod-lab.html:998`, commented "not reset on preset change"). `stormIdentity` mixes it, so the
two draw off different alea streams and every rng-drawn polar field differs.

⚠ **AND THE PACK ALREADY ARGUES ITS SIDE, DELIBERATELY** (`polarDeck.js:86-101`): it rejects copying
1234 because that "would import a GUI artifact into the game's world law". The open question is not
which is better-reasoned — it is whether `stormSeed` is a **lab authoring knob that SHOULD differ**
(in which case the divergence is correct and wants declaring, not closing), or a shared world law.

### 3. The crater floor — **Max's call**

`rockySurface`'s 11 and `craterDeck`'s 6 are the same family. Pack uses a raster-visibility floor
(`CRATER_VIS_FLOOR_RAD = 9.6e-4`); the lab uses a mesh-bake floor (`MESH_FLOOR_RAD = 0.055`) — **~57x
apart** — with different band edges and a 2.66x different normaliser.

⚠ **The verifier's own caveat, and it matters:** this is *already stated and reasoned in-tree* at
`craterUniforms.js:10-18` ("Same law, same closed forms, different floor"), so it is **a documented
decision, not an open question** — the verifier says `ruling-needed` overstates it. The real ask is
whether that decision still stands now that the goal is one route.

## Method note worth keeping

Both workflows this session produced a plan or a claim set that did not survive contact with the
adversarial pass — the wholesale-extraction plan (13 defects) and this survey (29 claims → 3
decisions). ⭐ **In both cases the refuting agent was cheaper than the work its refutation prevented.**
