# Lab renderer ≠ game renderer — the reconciliation finding

> **Status:** Active divergence, **by design**. This doc is the durable record of *why*
> the planet-LOD lab and the shipped game render planets through two unrelated systems.
> **Delete / fold into a migration doc once the lab renderer is wired into the game**
> (`src/objects/Planet.js`). Until then this is the source of truth for the divergence.
>
> Written 2026-06-14 (working-Claude), after Max picked the "reconcile" lens (C) on the
> archetype deep-dive. Supersedes the "⚠ DISCOVERY" framing in earlier handoffs, which
> flagged the divergence as a *surprise* — it is not a surprise or a drift; it is the
> documented, approved design (see §3).

## TL;DR

The lab's elaborate feature/archetype/association model is **neither the game's source of
truth nor a throwaway sandbox.** It is a **deliberately-decoupled staging ground for a
next-generation planet renderer**, with game-wiring explicitly deferred as a *separate,
no-parity* later effort. The game still runs the original March-2026 type-based renderer.

## 1. The two renderers (file:line verified)

| | **Game renderer (shipped)** | **Lab renderer (in development)** |
|---|---|---|
| File | `src/objects/Planet.js` (~1335 ln) | `planet-lod-lab-core.js` (~957 ln) + `planet-lod-lab.html` |
| Architecture | **Type-branch**: `if (planetType == 1) … else if (== 6) …` — one baked look per planet type | **Feature-composition**: per-feature combiners over a shared `grad`/`liquidMask` chain + soft province weight fields |
| What decides the look | a single `type` **string** (`PlanetGenerator._pickType` → `ExoticOverlay.apply` type-swap → `Planet._typeIndex()` shader dispatch) | per-feature **enable flags** filtered by `featuresOf()` / the archetype manifest |
| Discrete surface features | ~0 (paints by type) | 48 (F1–F51: rivers, deltas, dunes, chaos, cryo-ridges, great-spot, provinces, …) |
| Variant gating | `ExoticOverlay.js` (civilized / fungal / machine type-swaps, probabilistic) | `planet-feature-associations.js` manifest + Tier-1/Tier-2 audits |
| Born | 2026-03-14 (`319a16a` ExoticOverlay) | 2026-06-06 → 06-14 (the planet-feature-refinement campaign) |
| Cross-imports | **none** — `src/` never imports the lab; the lab never imports the game shader | |

**They share zero shader code.** The game's type-branch shader and the lab's feature-composition
shader are independent inline GLSL. The entire F1–F51 campaign, the provinces (`provinceWeight`),
and the archetype/association model exist **only** in the lab + tests + docs — `grep` confirms
`provinceWeight`, `cryoRidge`, `greatSpot`, `chaos` are absent from `src/`.

## 2. What this resolves

- **Max's original worry** ("city lights on gas giants / Venus / Mars?") — **not a game bug.**
  The game gates upstream by `type`; an in-game Venus stays `type='venus'` and never reaches the
  `city-lights`/`ecumenopolis`/`bioMats` shader branch. The "Venus/Mars cities" seen in the lab
  are a **lab-only artifact** of `relevantFeatureSet()` force-enabling every archetype-member
  feature (cityLights/ecumenopolis/bioMats are registered under the `tectonic-terrestrial`
  archetype, whose presets include Venus + Mars). That membership table drives nothing in `src/`.
- **"Is the manifest the game's source of truth?"** — No, by design. It drives the lab panel
  filter + the audit harness. It was *intended* to inform eventual game-wiring (the "future
  Stage-D provinces" hook in commit `b446047`), but that wiring has not begun.

## 3. The evidence that it is intentional, not drift

`docs/superpowers/specs/2026-06-09-planet-feature-refinement-campaign-design.md` (Max-approved):

> **Lab surface:** `planet-lod-lab.html`. Scope = lab only; **wiring into the production game
> (`src/objects/Planet.js`) is a separate later effort with no parity goal.**

…and L224: *"Production-game wiring (`src/objects/Planet.js`) — separate later effort."*

The campaign serves **SCREENSAVER-MVP visual polish** (`HEART_OF_DESIRE.md`); planets are the
hero objects on screen. The lab is where that polish is being developed ahead of the game.

## 4. What is still genuinely open (the deferred port)

The "separate later effort" to wire the lab renderer into the game **has no plan, no tracker
phase, and no scope.** Campaign Phases 5–7 (Integration / Profiles / Max review) are all
*lab-internal*. So when the lab work is mature, the port is its own project, and it carries
real decisions:

1. **Graft or replace?** Add the lab's feature combiners onto the game's type-branch shader, or
   replace `Planet.js`'s shader with the lab's composition shader.
2. **Which features ship?** "No parity goal" — the port is *selective*. The screensaver MVP
   defines which of the 48 features are worth wiring vs. left as lab R&D.
3. **Where does `type` live after?** The game's `type` string + `ExoticOverlay` type-swap vs.
   the lab's per-feature enable model — one has to become subordinate to the other.

**None of this is in scope until the lab itself is mature** (catalog complete + per-feature
quality passed). See `planet-lod-campaign-tracker.md` and the manifest functional audit
(`docs/superpowers/plans/2026-06-14-manifest-functional-audit.md`).

> **Port-readiness (river-LOD only):** the river-LOD subsystem has been made port-READY ahead of this
> decision — its importable-vs-graft-vs-glue seam is captured in
> [`river-lod-port-contract.md`](river-lod-port-contract.md) (the portable-core modules, the
> `sampleCarve`/`uRiverCarve*`/`uSeaLevel` shader graft, the now-parameterized geometric `radius`, the
> ribbon-lift and logdepthbuf/no-polygonOffset caveats, and the lab-glue to re-implement). That contract
> names WHAT crosses the seam; the graft-vs-replace question above still decides WHEN/HOW. Other
> subsystems remain un-scoped for the port.
