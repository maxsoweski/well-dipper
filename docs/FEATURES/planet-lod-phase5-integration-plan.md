# Planet-LOD — Phase 5 "Integration" plan (feature co-dependence)

**This operationalizes campaign Phase 5.** It is the build-side companion to
[`cards/INTEGRATION.md`](cards/INTEGRATION.md) (the I-1…I-15 checks) and is driven by
[`feature-interaction-audit-2026-06-20.md`](feature-interaction-audit-2026-06-20.md) (the
code-verified audit: 84 should-interact edges → WIRED 30 / PARTIAL 20 / ABSENT 34; 52-gap
table). Read the CHARTER's NORTH STAR first — *features work together* is exactly what this serves.

> **Status:** PLANNING ONLY (authored 2026-06-20, master, local). No engine code changed by this
> doc. Per-workstream `intent.md` + `contract.json` are authored via `dev-collab-scope` **when each
> WS is actually built** — not here. WS1 is the recommended first build (see Sequencing).

---

## The reframe (why this is Phase 5, not a new campaign)

Campaign Phase 5 was always "Integration — verify I-1…I-15 compose." The audit is the
code-verified *execution* of those checks, and it found most ABSENT/PARTIAL. So Phase 5 changes
character:

- **Was:** verify-only — screenshot each I-check, mark 🟢/🟡/🔴.
- **Now:** *build the missing couplings* (close the 52-gap set), **then** the I-1…I-15 checks
  become the **acceptance/verification layer** that confirms the composition reads correctly.

The gap set is sequenced into **five workstreams (WS1–WS5) + one cross-cutting task**, matching
the audit's remediation order. WS-numbering is local to this plan — do **not** confuse it with the
campaign's Phase numbers (the audit's own "Phase 1–5" remediation labels are these WS rows).

---

## The five workstreams

Each WS, when built, gets its own `dev-collab-scope` pass (`intent.md` + `contract.json`) → build →
`verify-workstream` → `VERIFIED_PENDING_MAX` → Max UAT. They are **not** pre-scoped here.

| WS | Name | Nature | Gates the build needs | Closes / unblocks |
|----|------|--------|----------------------|-------------------|
| **WS1** | **Keystone — surface per-basin `filled`** | Wiring (data already exists CPU-side) | `dev-collab-scope` (it's multi-system + visible/UAT-gated) | **7 gaps:** craters×rivers, craters×lakes, rivers×lakes, lakes×deltas, karst×lakes (fully) + unblocks glacial×lakes, outflow×lakes (completed in WS3) |
| **WS2** | **Wire-now batch** | One-line shader couplings on signals already in scope | Single `dev-collab-scope` for the batch (or `verify-workstream --light` per cluster) | ~14 gaps — see mapping |
| **WS3** | **Resolve-pass / re-order** | Re-order existing combiners; no new arch, reads existing fields | `dev-collab-scope` (touches relief combiner order) | ~10 gaps |
| **WS4** | **Architecture** | New machinery; **each sub-item gets its own design spec/spike FIRST** | Per sub-item: brainstorm → spec → `dev-collab-scope` | ~17 gaps (the "designed, not ad-hoc'd" tier) |
| **WS5** | **View-dependent rich tier** | = the EXISTING `rivers-viewdependent-lod-2026-06-18` workstream | Already scoped there — **cross-link, don't duplicate** | glacial U-valley carving, dune orientation/echo dunes, gorge depth |
| **X** | **Cross-cutting (once)** | Re-derive `ASSOCIATIONS.dependsOn` from the shader | `verify-workstream --light` | manifest under-declares ~4 honored couplings |

### WS1 — Keystone (recommended first build)
The router's priority-flood already computes per-basin pour-point `filled` levels
(`planet-lod-rivers.js` ~L288-309) but rendering **discards** it and uses a global sea-level cut
only (`planet-lod-lab.html` L435). Surface `filled` as a carve-cube channel / per-basin fill
texture → `max()` into the liquid mask; let the river carve breach a rim where its basin overtopped.
**One discarded signal closes seven gaps** — including Max's own crater-lake example. Wireable now;
no new architecture. This is the highest leverage-per-effort item in the whole audit.

### WS4 sub-groups (each its own design pass)
1. **Router re-route feedback** — the router samples height *once* and never re-routes; this blocks
   ALL reverse-direction couplings (landslide dams, basin gouging, sediment fill). Unblocking it is
   a prerequisite for several other items → design this one first within WS4.
2. **Weather × surface feedback buffer** — a writable ping-pong buffer the forward pass lacks
   (dust loft/redeposit, hotspot cloud-clearing, storm-genesis banding).
3. **Cross-feature partition generator** — a shared tectonic/lineament field so dividing features
   read each other (canyons/scarps, plateaus/scarps, tessera/plateaus, chaos/cryoRidge, dust/dunes).
4. **Lava-as-fluid routing** — route lava through the accumulation field (leveed channels/rilles;
   edifice vents as flow sources).
5. **Insolation/aspect term** — a per-cell sun-axis·slope proxy for cold-trap frost & sublimation
   in shadowed crater floors / pole-facing scarps.
6. **Chaos shallow-liquid class** + **ecumenopolis×cityLights continuum merge** + **carbon hot
   variant** — smaller standalone arch items.

---

## Full gap → WS mapping (all 52)

Sourced from the audit appendix (severity `Sev`, tractability `Tract`). "WS5↗" = handled in the
existing view-dependent workstream. Optional/near-moot edges flagged.

| Edge | Verdict | Sev | Tract | WS |
|------|---------|-----|-------|----|
| craters × rivers | PARTIAL | 4 | wireable-now | **WS1** |
| craters × lakes | PARTIAL | 4 | wireable-now | **WS1** |
| rivers × lakes | PARTIAL | 3 | wireable-now | **WS1** |
| lakes × deltas | PARTIAL | 2 | wireable-now | **WS1** |
| karst × lakes | PARTIAL | 1 | wireable-now | **WS1** |
| glacial × lakes | ABSENT | 2 | resolve-pass | **WS3** (needs WS1 fill + negative-carve) |
| outflow × lakes | ABSENT | 1 | resolve-pass | **WS3** (needs WS1 fill + head anchoring) |
| clouds × sunglint | ABSENT | 2 | wireable-now | **WS2** |
| clouds × cityLights | ABSENT | 1 | wireable-now | **WS2** |
| clouds × terminator | ABSENT | 1 | wireable-now | **WS2** |
| clouds × limb | ABSENT | 1 | wireable-now | **WS2** |
| lava × frost | ABSENT | 1 | wireable-now | **WS2** |
| bioMats × frost | ABSENT | 1 | wireable-now | **WS2** |
| lakes × bioMats | ABSENT | 2 | wireable-now | **WS2** |
| lakes × dunes | ABSENT | 2 | wireable-now | **WS2** |
| hexTess × shatter | ABSENT | 1 | wireable-now | **WS2** |
| weatherBands × dustStorm | ABSENT | 1 | wireable-now | **WS2** |
| jets × greatSpot | ABSENT | 2 | wireable-now | **WS2** |
| lightning × dustStorm | ABSENT | 1 | wireable-now | **WS2** |
| magma × lava | PARTIAL | 2 | wireable-now | **WS2** |
| magma × terminator | PARTIAL | 1 | wireable-now | **WS2** (low value) |
| dunes × craters | PARTIAL | 2 | wireable-now | **WS2** (low priority — already emergent) |
| airglow × limb | PARTIAL | 2 | wireable-now | **WS2** ⚠ partly by-design — confirm w/ Max whether deliberate layering stays |
| aurora × nightsideThermal | ABSENT | 1 | wireable-now | **WS2** (cosmetic) |
| airglow × nightsideThermal | ABSENT | 1 | wireable-now | **WS2** (near-moot — disjoint rendersOn) |
| lava × mountains | PARTIAL | 2 | resolve-pass | **WS3** |
| machine × craters | PARTIAL | 2 | resolve-pass | **WS3** |
| magma × edifices | PARTIAL | 2 | resolve-pass | **WS3** |
| edifices × craters | ABSENT | 2 | resolve-pass | **WS3** (or rely on co-sited lava) |
| plateaus × canyons | ABSENT | 1 | resolve-pass | **WS3** |
| karst × rivers | ABSENT | 1 | resolve-pass | **WS3** (inject karst into router + re-route) |
| glacial × frost | PARTIAL | 2 | wireable-now | **WS3** (shared volatile budget — group w/ sublimation) |
| sublimation × frost | PARTIAL | 2 | wireable-now | **WS3** (shared volatile budget) |
| glacial × mountains | PARTIAL | 3 | view-LOD | **WS3** (grad-bias flow now) + **WS5↗** (U-valley carving) |
| dustStorm × dust | ABSENT | 3 | needs-arch | **WS4** (feedback buffer) |
| edifices × lava | ABSENT | 3 | needs-arch | **WS4** (lava-as-fluid / vent routing) |
| lava × rivers | ABSENT | 2 | needs-arch | **WS4** (lava-as-fluid routing) |
| rivers × massWasting | PARTIAL | 2 | needs-arch | **WS4** (router re-route feedback — prereq item) |
| frost × craters | ABSENT | 2 | needs-arch | **WS4** (insolation/aspect term) |
| sublimation × craters | ABSENT | 1 | needs-arch | **WS4** (insolation/aspect term) |
| canyons × scarps | ABSENT | 2 | needs-arch | **WS4** (partition generator) |
| plateaus × scarps | ABSENT | 2 | needs-arch | **WS4** (partition generator) |
| tessera × plateaus | ABSENT | 2 | needs-arch | **WS4** (partition generator / province re-plumb) |
| chaos × cryoRidge | ABSENT | 2 | needs-arch | **WS4** (partition generator / mutual relief read) |
| dust × dunes | ABSENT | 1 | needs-arch | **WS4** (shared sediment-supply buffer) |
| chaos × lakes | ABSENT | 1 | needs-arch | **WS4** (shallow-liquid class) |
| daysideThermal × clouds | ABSENT | 2 | needs-arch | **WS4** (thermal→cloud plumbing) |
| ecumenopolis × cityLights | PARTIAL | 1 | needs-arch | **WS4** (continuum merge) |
| carbon × lava | ABSENT | 1 | needs-arch | **WS4** (hot-carbon variant / preset) |
| aurora × bands | ABSENT | 1 | needs-arch | **WS4** (low value — optional) |
| clouds × greatSpot | ABSENT | 1 | needs-arch | **WS4** (low sev — optional, gas-giant close-up) |
| dunes × mountains | PARTIAL | 2 | view-LOD | **WS5↗** (orientation steering) |

**Tally:** WS1 = 5 (+2 unblocked) · WS2 = 18 · WS3 = 10 (one shared w/ WS5) · WS4 = 17 · WS5 = 2.
(WS1+WS3 share the 7-gap keystone cascade; some WS2 entries are cosmetic/optional and may be
dropped at scope time.)

---

## I-1…I-15 reconciliation (the verification layer)

The Integration card's checks become Phase-5 **acceptance targets**, run *after* the WS builds
close the gaps. Where a check exposes a specific audit gap, that gap's WS does the build; otherwise
the check is verify-only (the audit found it already composes).

| I-check | Subject | Disposition |
|---------|---------|-------------|
| I-1 | Rivers × canyons | Verify-only (not a flagged gap; presumed WIRED via shared canyon accumulator) |
| I-2 | Rivers × lakes/seas | **WS1** (rivers×lakes pour-point) |
| I-3 | Deltas × coastlines × seas | Mostly WIRED (shipped fluvial coupling) + **WS1** for elevated-lake datum (lakes×deltas) |
| I-4 | Frost/caps over relief | Verify-only (orographic lapse WIRED) + **WS2** lava×frost + **WS4** frost×craters aspect |
| I-5 | Glacial × mountains | **WS3** (grad-bias) + **WS5↗** (carving) |
| I-6 | Sublimation × frost | **WS3** (shared volatile budget) + **WS4** sublimation×craters aspect |
| I-7 | Dunes × dust mantles | **WS4** dust×dunes supply + **WS2** lakes×dunes/dunes×craters |
| I-8 | Clouds over terrain × bands | Verify-only (readable) + **X** (weatherBands×clouds declare) + **WS4** daysideThermal×clouds |
| I-9 | Bands × storms | Mostly WIRED (bands/storms spine solid) + **WS2** jets×greatSpot |
| I-10 | Atmosphere gate consistency | Verify-only (airless gates whole stack off) |
| I-11 | Aurora × magnetic gate | Verify-only + **WS4** aurora×bands (optional) |
| I-12 | Rings × eclipse shadows | Verify-only (not a flagged gap) |
| I-13 | Thermal day/night × tidal lock × eyeball | Verify-only + **WS4** daysideThermal×clouds (hotspot clearing) |
| I-14 | Overlay compositing | **WS4** ecumenopolis×cityLights merge + **WS2** clouds×cityLights |
| I-15 | LOD coherence | **WS5↗** (view-dependent) + general verify |

When all WS builds Max wants are in, run the I-1…I-15 verdict lap (card §7) as the Phase-5
acceptance gate. Verdicts stay `VERIFIED_PENDING_MAX` until Max's Phase-7 review lap (campaign convention).

---

## Sequencing (recommended)

1. **WS1 first** — highest leverage, wireable-now, closes the crater-lake example Max raised. Next
   session: `dev-collab-scope` WS1 → build → `verify-workstream` → live :9223 integration check → Max UAT.
2. **WS2** — broad, cheap, mostly cosmetic wins; can batch. Drop the near-moot/optional rows at scope time.
3. **WS3** — relief-combiner re-order; depends on WS1 for the lake-fill cascade (glacial/outflow × lakes).
4. **WS4** — architecture, **one sub-item at a time**, each with its own design spec/spike. Do the
   **router re-route feedback** item early (it unblocks the most reverse-direction couplings).
5. **WS5** — already scoped as `rivers-viewdependent-lod-2026-06-18`; this plan only cross-links it.
6. **X (cross-cutting)** — re-derive `dependsOn` from the shader; can run anytime (independent).

**Each WS build is Max-greenlit and Max-UAT'd separately** — this plan does not authorize builds.

---

> **Provenance:** authored 2026-06-20 from the feature-interaction audit (`0606313`). The framing
> call (Phase-5 reframe + planning-only this session) was delegated to working-Claude by Max
> ("you make the call, after reviewing in a new session"). Per-WS scope artifacts come later.
