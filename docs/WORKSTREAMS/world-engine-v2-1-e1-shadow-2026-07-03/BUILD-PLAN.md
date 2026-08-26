<!-- Provenance: authored by working-Claude 2026-07-03 from the SIGNED contract.json (8 ACs, greenlit) +
     intent.md + ROADMAP-v2-condition-first.md (v2.1 SIGNED OFF) §1/§2.3/§2.4#3/§5.1-5.2/§7b + the three
     committed gate briefs (cca8a58: gate-1 L form, gate-2 localYield/effectiveL hand-up, gate-3 = NO V2-1
     surface). Code-grounded: every path + line number verified by reading the file at cc267a4. The Φ form
     is pinned by phi-calib.mjs (committed beside this plan; reproduces gate-2 §2's provisional Φ verbatim
     and proves R-Φsize). The AC3 writer-tally is pinned by oracle-preview.mjs (committed beside this plan; imports the
     REAL shellRegimeOf/stagnantLidRegimeOf + proves 13 writer-equal + 2 divergent {Frozen, Eyeball}, reconciling AC3).
     Baseline confirmed green pre-build: tests/v2-0-byte-identity.test.js (75/75) +
     tests/worldengine-base-condition-vector.test.js + tests/planet-archetypes.test.js = 127 passing. -->
# BUILD PLAN — V2-1 "E1 regime selector (SHADOW mode)" (code-grounded, sliced, self-auditing)

Branch `feature/world-engine-production-L1`, base `cc267a4` (clean). Contract AC-0, AC1–AC7. **Zero
behavioral change is the standing gate (AC1): the 75 carrier goldens NEVER re-capture.** All paths are
repo-relative to `/home/ax/projects/well-dipper`.

**Grounding done (read at cc267a4, line numbers cited below are load-bearing):**
`body-condition-vector.js` (`deriveConditionVector` :23-33, imports `bodyShellThickness,bodyRawTidal` :15;
`rawTidalIoRatio` uses the `derived?.tidalHeat ?? helper(fp)` fallback shape :29 — the AC6 template);
`src/worldengine/base/baseStep.js` (`deriveBodyScalars` :16-84 computes `surfaceGravity = massEarth/radiusEarth²`
internally :20; helpers `bodySurfaceGravity` :92, `bodyAgeNorm` :93, `bodyShellThickness` :88, `bodyRawTidal`
:87; `T_eq` read internally at :52 for liquidStability but NOT returned — hence AC6 sources `T_eq` from the raw
preset, not baseStep); `driver-presets.js` (`DRIVER_PRESETS` 17 entries :15-169 — **all 17 define `T_eq`** verified;
`PRESET_ARCHETYPE` 15 map :174-190); `body-drivers.js` (`buildNeutralBodyDrivers`/`presetDriverDefaults`);
`planet-lod-rivers.js` — the **dispatch seam** `writeBodyRelief` :448-497 routes **plate→shell→volcanic→stagnant-lid→despun**
via the exported predicates `isEarthlikePlatePath` :410, `isShellReliefPath` :422 (→ `shellRegimeOf`,
`shellRelief.js:48`), `isVolcanicPath` :435 (`VOLCANIC_ARCHETYPES={'lava','volcanic'}` :434), `isStagnantLidPath`
:444 (→ `stagnantLidRegimeOf`, `stagnantLid.js:78`) — the AC3 oracle's `writerUnder(PRESET_ARCHETYPE)` composes
these four **verbatim** (extract-don't-reimplement); the condition vector already threads inside `bodyDrivers`
(:448-452 comment, unconsumed = shadow); `world-engine-lab.html` — imports :164-166; `buildBodyDrivers` :2702-2719
attaches `condition:` :2717; the route seam `ensureNetworkRouted` sets `state._lastBodyDrivers` :3627 then calls
`riverOverlay.route({archetype:PRESET_ARCHETYPE[_preset]||null … macroSeed:state.macroSeed})` :3628-3645;
`_driverAbMode` :2685 + `_onDriverDrag` :3799 = the lab-only-override precedent; `magmaProbe` :6036-6092 /
`stagnantLidProbe` :6099 = the `_lab` probe pattern AC7 mirrors; `state.macroSeed` :1945 = the `'e1:'` seed source;
alea namespaces in use in `src/worldengine/base/` are `'magma:*'` + `'plates:*'` + `'shell:*'` + `'stagnant:*'` (grep — all
four writer namespaces; NO `'lid:'` exists) — **`'e1:'` is new + prefix-disjoint from all four**; tests
`tests/v2-0-byte-identity.test.js` (75 goldens + tune-null anchors), `tests/worldengine-base-condition-vector.test.js`
(`NAMED_FIELDS` :29-30, inertness block :124-153), `tests/planet-archetypes.test.js` (`*Enabled` scrape :21-23,
drift guards), harness `tests/fixtures/v2-0-carrier-golden.mjs` (`buildBundle` :59-81 single-sources
`deriveConditionVector` :75 — so AC6 flows through the harness with **no harness edit**).

**Hard-rule ledger (grep-enforced at the Slice-D gate):** no `Math.random`/`Date.now` in `e1Regime.js`;
seeded `alea` only, fixed draw order; new fields NESTED under `condition` (the V2-0 R1 flat-age trap); goldens
never re-captured; **E1 emits, never routes** (no `computeE1` import in any `write*Sphere`; the label has zero
branch sites in `src/` or the lab); Mars + Hot Jupiter excluded from the oracle; the module lives at
`src/worldengine/base/e1Regime.js` (ROADMAP §5); E1 **does NOT read `condition.shellThickness`** (SH-F2: `z`/`d`
get their own transforms).

---

## 1. Slice ordering (4 slices; AC-0 + AC1 are gates run after EACH, not slices)

Ordered so E1 has its real inputs before it computes (A), computes+self-proves headlessly before anything
reads it (B), is adjudicated against today's routing (C), then goes live shadow last (D). Each slice is
independently testable and committable. **AC1 (byte-identity) + the drift guards run after every slice.**

**Slice A — AC6 condition-vector plumbing (`T_eq` + `surfaceGravity`). FIRST.**
Why first: E1's `L` (`z`/`anneal`/`meltFactor`) and `gMod` need surface temperature + gravity (gate-1 GAP-1/GAP-2),
and both are *missing* from the vector today (`body-condition-vector.js:23-33`). Widen the vector before E1 reads it.
- **Edit `body-condition-vector.js`:** extend the import (:15) to add `bodySurfaceGravity`; add two NESTED fields to
  the `deriveConditionVector` return (:23-33), documented:
  - `T_eq: fp.T_eq ?? 288,` — **SURFACE temperature** (D3-MF2; NOT equilibrium temp). Sourced from the raw preset
    (all 17 define it); baseStep reads `T_eq` internally but does not return it, so this is a raw-preset read, not a
    baseStep re-derive. `288` fallback matches the lab route default (:3643); documented as unreached (every preset defines `T_eq`).
  - `surfaceGravity: derived?.surfaceGravity ?? bodySurfaceGravity(fp),` — **exposed from baseStep, NOT re-derived**
    (mirrors the `rawTidalIoRatio` :29 fallback shape exactly; `derived` = `deriveUniforms(fp,tier)`, which returns
    `surfaceGravity` — `planet-lod-lab-core.js:514`/:930; the `bodySurfaceGravity(fp)` helper — `baseStep.js:92` — is the headless fallback).
- **Byte-safety:** both fields are NESTED under `condition`; the tune builders read only flat keys (the inertness
  block `worldengine-base-condition-vector.test.js:124-153` already proves this over all 17 presets). AC1's 75
  goldens are condition-LESS; the gate re-runs the condition-BEARING bundle (now +2 fields) and must still match
  byte-for-byte — that IS the inertness proof. No harness edit (buildBundle single-sources `deriveConditionVector`).
- **Extend `tests/worldengine-base-condition-vector.test.js`:** add `'T_eq','surfaceGravity'` to `NAMED_FIELDS`
  (:29-30); add value asserts — Venus `T_eq===737`; `surfaceGravity===derived.surfaceGravity` AND
  `===bodySurfaceGravity(fp)` (proves not-re-derived); Mars `surfaceGravity` ≈ 0.107/0.53² = 0.381; a data-only
  guard stays (magneticField/metallicity undefined).
- **Commit gate:** `npx vitest run tests/worldengine-base-condition-vector.test.js tests/v2-0-byte-identity.test.js`
  — both new fields present + **75/75 carrier hashes unchanged** + both tune-null anchors hold.

**Slice B — `e1Regime.js` core: `computeE1`. SECOND (the payload).**
Independent of the oracle/lab. NEW `src/worldengine/base/e1Regime.js` — a pure function emitting the full signed
tuple. Reads ONLY the condition vector + `macroSeed` (AC-0 check 1: no archetype input). Contents pinned in §4.
- Emits `{compositionClass, geodynamicRegime, label, L, Φ, V, n, m_hp, e1Seed, positionWithinRegime}` + `effectiveL`
  when the seeded-`'stagnant'` pick fires.
- **NEW `tests/worldengine-e1-regime.test.js` (AC2):** `computeE1` over all 17 presets × seeds {1,2,3,7,42}: full
  tuple present on every body; repeat-call byte-equality; the seeded stream is `alea('e1:regime:'+macroSeed)` and
  the emitted `e1Seed` is deterministic; grep + a runtime assert that permuting `label` leaves the rest of the tuple
  identical (label-invariant); a source grep asserting no `Math.random`/`Date.now` and the `'e1:'` namespace disjoint
  from ALL FOUR in-use namespaces `'magma:'`/`'plates:'`/`'shell:'`/`'stagnant:'` (the real inventory — drop the phantom
  `'lid:'`, add the real `'shell:'`; disjointness holds by prefix — `'e1:'` shares no prefix with any of the four).
- **NEW `tests/worldengine-e1-gate-fidelity.test.js` (AC4):** the E1-computed `L` table reproduces gate-1's
  calibration table over all 17 presets + `MAGMA_REF` and passes its **9 ordering asserts** (diff against
  `gate-1-L-calib.mjs`'s output — reproduced as an inline fixture table, values in §4); `Φ` separates Mars (0.268)
  from Venus (0.690) — **R-Φsize** — and the Venus/Mars ratio sits in [2,3] (gate-2 PG-2 compression); `n` per gate-2;
  `m_hp = rawTidalIoRatio − 0.45` at the pinned vectors.
- **NEW `tests/worldengine-e1-seeded-middle.test.js` (AC5):** an Earth-mass temperate-wet vector across ≥200
  macroSeeds — pick distribution matches the frozen weights ±tol; **wetter→more mobile picks**, **hotter→more
  stagnant picks** (directional nudge checks); every seeded-`'stagnant'` pick carries `effectiveL` inside the
  strong-mixed band [0.60,0.66]; identical seeds → identical picks; the lab-only weight override changes the
  distribution while frozen defaults are restored.
- **Commit gate:** the three new suites green + **AC1 75/75 unchanged** (e1Regime is imported by no writer yet, so
  this holds trivially — belt-and-suspenders).

**Slice C — AC3 conformance oracle (writer-equality, shadow). THIRD.**
Depends on B (`computeE1`) + A (widened vector). NEW `tests/worldengine-e1-conformance-oracle.test.js`.
- `writerUnder(PRESET_ARCHETYPE)` = a thin `classifyWriterPath(archetype, locked)` composing the **existing
  exported predicates** (`isEarthlikePlatePath→isShellReliefPath→isVolcanicPath→isStagnantLidPath→'despun'`) in the
  `writeBodyRelief` :454-496 order — **reuse, not re-implement** (imports from `planet-lod-rivers.js`).
- `writerUnder(e1)` = a NEW pure predictor mapping E1's tuple → path via the subtractive gate (ROADMAP §5.1), with NO
  `locked` input (E1 has no locked flag — it reads `rawTidalIoRatio` for "active"): `compositionClass` terminals
  gas/carbon → off-pilot/`despun`; **`'icy'` splits** — `'icy'` regime→`shell` IF active-tidal
  (`rawTidalIoRatio>ACTIVE_TIDAL≈0.5`, catches **Europa** rt≈137) OR methane-window volatile-cold (`V≥0.12 ∧ T∈[85,120]`,
  catches **Titan** T94) ELSE dead-lid→`despun` (**Frozen** T60, **Crystal** T150 — both cold-dead icy) → then for
  `'rocky'`: `m_hp>0`→volcanic (**Lava/Magma**) → in-band→**MODAL** pick (mobile/episodic→plate, stagnant→stagnant-lid;
  seed-free for the oracle, §4.5) → else `L≥L_STRONG`→stagnant-lid (**Venus** L 0.728) / `L<0.35`→plate / mixed→dominant
  anchor. Diagnostic-only — grep-clean of any dispatch wiring. **Every branch is empirically exercised in `oracle-preview.mjs`.**
- Assert over the **15** `PRESET_ARCHETYPE` presets (Mars + Hot Jupiter EXCLUDED): **13 writer-equal**, **2
  allow-listed divergences asserted AS divergent** — the set + count **EMPIRICALLY PINNED by `oracle-preview.mjs`**
  (committed beside this plan, mirroring `phi-calib.mjs`; it imports the REAL `shellRegimeOf`/`stagnantLidRegimeOf` +
  inlines the two one-line plate/volcanic predicates, so its `writer_today` == the vitest oracle's dispatch — `planet-lod-rivers.js`
  itself imports three and can't be `node`-loaded, but the vitest oracle DOES compose its exported predicates directly).
  With the V2-3 disposition named — (i) `Frozen(airless)` today → `shell` (icy-active) but E1 → dead-lid/`despun`
  (V2-3: reroute off shell to dead-lid); (ii) `Eyeball(locked temperate)` today → `shell` (eyeball-despun) but E1 →
  `plate` (rocky locked body, no E1 shell path — seed-robust; V2-3: dispatch gains locked-awareness and Eyeball
  STAYS on eyeball-despun byte-identical — today's routing wins, see §4.5 disposition-direction note).
  **`Neptunian/Sub-Neptune` is a PRESET_ARCHETYPE key-collision NOTE, NOT a writer divergence** — both route `despun`
  today AND under E1 (writer-EQUAL); recorded for V2-3, never asserted as divergent (asserting it AS divergent, per the
  signed AC3 text, would FAIL — the oracle would find them equal). Lava/Magma/Venus asserted writer-equal (the
  byte-identical trio). Oracle failure prints the full diverging e1 tuple. Tally + today-routing pinned in §4.6 + `oracle-preview.mjs`.
- **Commit gate:** the oracle green (13 equal + 2 asserted-divergent **{Frozen, Eyeball}**, matching `oracle-preview.mjs`)
  + full suite-so-far green.

**Slice D — Lab shadow wiring + AC7 live probe + AC-0 close. LAST.**
Depends on B (`computeE1`). Data-only in the lab; zero rendered-byte change.
- **Edit `world-engine-lab.html`:** import `computeE1` (import block :164-166); in `ensureNetworkRouted` right after
  `state._lastBodyDrivers = _bodyDrivers;` (:3627), add `state._lastE1 = computeE1(_bodyDrivers.condition, state.macroSeed);`
  — computed from the vector + seed, **not passed to `route()`** (no routing influence; `archetype` at :3637 stays
  `PRESET_ARCHETYPE[_preset]`). Add a `_lab.e1Probe()` in the `_lab` object (~:6036, sibling of `magmaProbe`) that
  returns `state._lastE1` (or recomputes from `state._lastBodyDrivers.condition` if absent) — the full tuple.
- **Lab-only seeded-weight override (AC5), mirroring `_driverAbMode`:** expose `_lab.e1RegimeWeights({...})` /
  `_lab.e1RegimeWeightsReset()` as a **console/`_lab` API only** (no GUI panel binding). Console-only ⇒ no
  `.add(state,'…Enabled')` key ⇒ `planet-archetypes.test.js` drift guards stay green with no taxonomy change.
  **IF** a future GUI toggle is added it MUST register in `planet-archetypes.js` (AC-0 check 3) — flagged, not built.
- **AC7 live (chrome-devtools, `:5173`, base `/well-dipper/`):** step ≥6 presets — **Venus, Lava, Magma, Rocky,
  Frozen (airless), one giant** — via `setPreset`; poll `_lab.state._lastBodyDrivers` object identity after each
  setPreset (the route lands ~500ms later; 8-rAF waits race it, so poll identity change); read `_lab.e1Probe()`;
  `list_console_messages` = zero errors; regime/label match the AC3 oracle expectation for those presets; take a
  screenshot to confirm the render is visually unchanged (shadow). Close all chrome-devtools pages at the end
  (browser-window hygiene).
- **Commit gate:** full `npx vitest run` green (no pre-existing test dropped; the 4 known KnownObjects×3/GalacticFeatures×1
  failures excluded as known) + `npx vitest run tests/planet-archetypes.test.js` (AC-0 drift guards) + the AC7 live
  pass + the grep audits (no archetype input to `computeE1`; no `computeE1` import in `write*Sphere`; zero
  `e1.label` branch sites in `src/`+lab).

Reorder freedom: B is independent of A only for its non-`L` fields; since `L` needs A's `T_eq`/`surfaceGravity`,
A precedes B. C needs B; D needs B. Chosen A→B→C→D.

---

## 2. Per-slice AC coverage map (every AC → the slice + test that discharges it)

| AC | Statement (short) | Slice | Test file(s) / gate | Layer |
|---|---|---|---|---|
| **AC6** | condition-vector gains `T_eq`(surface) + `surfaceGravity`(from baseStep), nested-only | **A** | `tests/worldengine-base-condition-vector.test.js` (extended `NAMED_FIELDS` + value asserts) | unit |
| **AC1** | ZERO behavioral change; 75 goldens + tune-null anchors hold; no pre-existing test dropped | **A,B,C,D (after each)** | `tests/v2-0-byte-identity.test.js` (75/75) + full `npx vitest run` | unit |
| **AC2** | full tuple; determinism; `'e1:'` disjoint; no `Math.random`/`Date.now`; label OUTPUT-only | **B** | `tests/worldengine-e1-regime.test.js` + grep audit (D) | unit |
| **AC4** | `L` == gate-1 table (9 orderings); `n` per gate-2; `m_hp=rawTidal−0.45`; Φ separates Mars<Venus | **B** | `tests/worldengine-e1-gate-fidelity.test.js` (diff vs `gate-1-L-calib.mjs` + `phi-calib.mjs`) | unit |
| **AC5** | seeded temperate-wet middle; V↑→mobile / T↑→stagnant; effectiveL in [0.60,0.66] on stagnant; lab override | **B** | `tests/worldengine-e1-seeded-middle.test.js` | unit |
| **AC3** | `writerUnder(e1)===writerUnder(PRESET_ARCHETYPE)`: 13 equal + 2 divergent **{Frozen, Eyeball}** (Neptunian/Sub-Neptune = a writer-EQUAL taxonomy NOTE) | **C** | `tests/worldengine-e1-conformance-oracle.test.js` (tally pinned by `oracle-preview.mjs`) | unit |
| **AC7** | live `_lab.e1Probe()` tuple per preset; zero console errors; render visually unchanged | **D** | chrome-devtools (`:5173`, /well-dipper/) — 6 presets | integration (live) |
| **AC-0** | spine: driver-connectivity + named-consumer + taxonomy-registration; drift guards green | **A–D (gate); table §3** | §3 conformance table + `tests/planet-archetypes.test.js` + grep audits (D) | unit |

---

## 3. AC-0 conformance table (every scalar READ × every field EMITTED — the V2-0 §4 worked-example form)

**A — driver connectivity (every scalar `computeE1` reads is D-slot-backed or a named derivation; NO archetype input):**

| `computeE1` reads (from the condition vector / seed) | D-slot / named backing | used for |
|---|---|---|
| `T_eq` (surface temp) | D3-MF2 slot; **AC6 plumbing** (raw preset) | `L` (`z`,`anneal`,`meltFactor`); seeded-band gate |
| `composition.volatileFraction` (`V`) | **D2** | `L` (`dryness`); `V` passthrough; pick weights |
| `composition.density` (ρ) | D2/composition | `compositionClass` (icy/rocky); `L` (`gMod`) |
| `composition.carbonToOxygen` | **D10** | `compositionClass` carbon terminal |
| `atmosphere.composition` (`'h2-he'`) | composition/atmosphere passthrough | `compositionClass` gas terminal |
| `age` | **D16** | Φ radiogenic; `L` (`ageNorm`) |
| `radiusEarth` (`d`) | radius (drawn) | Φ `d³` mantle-depth term (SH-F2 `d`) |
| `surfaceGravity` (g) | **D14**; **AC6 plumbing** (baseStep, not re-derived) | `L` (`gMod`); `massEarth` reconstruction |
| `massEarth` (**NAMED DERIVATION** `surfaceGravity·radiusEarth²`; the vector carries NO mass field — g=mass/R² exact) | D14+radius reconstruction (NOT a vector field; NEVER `fp.massEarth`) | Φ vigor (`C_MASS·massEarth`); seeded-band mass gate |
| `rawTidalIoRatio` | **D12 raw** (pre-`calibrateTidal`) | `m_hp` (peg); Φ tidal term |
| `macroSeed` | lab seed → `alea('e1:regime:'+macroSeed)` | seeded middle pick + `positionWithinRegime` + `e1Seed` |
| *(NOT read: `shellThickness` [SH-F2 — `z`/`d` own transforms], `magneticField`/`metallicity` [data-only])* | — | — |

**B — named consumer (every emitted tuple member has a reader from the ROADMAP-v2 DAG):**

| E1 emits | set by (driver → derivation) | named consumer |
|---|---|---|
| `compositionClass` | density/D9/D10/atmosphere → Stage-A terminals + §1 label carve-out | **oracle (AC3) now**; V2-3 dispatch 2-tuple |
| `geodynamicRegime` | edges (dead-lid/heat-pipe/icy/hot-surface) + seeded middle (`'e1:regime:'`) | **oracle+probe now**; V2-2 router, V2-3 dispatch |
| `label` | emergent from the above | **diagnostic/probe ONLY** — never an input (grep-enforced) |
| `L` (+`effectiveL`) | gate-1 pinned form: `z(T_surf,age)·μProxy(V,T_surf)·gMod` | V2-2 router + `localYield(L,i)` |
| `Φ` | delegable #4: `sqrt(radiogenic·(C_MASS·m + C_SIZE·d³)) + C_TIDAL·rawTidal` | V2-2 pierce boolean + `n` |
| `V` | D2 passthrough | V2-2 stagnant response; pick weights |
| `n` | gate-2: `clamp(3,11,round(4 + 4·min(Φ,1.2) + 2·(1−L)))` | V2-2 SP-CENTERS count |
| `m_hp` | `rawTidalIoRatio − HEATPIPE_PEG(0.45)` (delegable #6, tunable) | V2-2 heat-pipe hard gate |
| `e1Seed`, `positionWithinRegime` | macroSeed draw + band position | V2-2 within-region continua |

**C — taxonomy registration:** Slice D exposes the seeded-weight override as a **console/`_lab` API only** (no
`.add(state,'…Enabled')` binding) ⇒ `planet-archetypes.test.js` drift guards stay green with no taxonomy change.
No new preset/feature/province. (If a GUI toggle is ever added it registers in `planet-archetypes.js` — flagged.)

---

## 4. Design decisions the plan PINS (not left to the slices)

### 4.1 `L` — gate-1 form + constants, reproduced VERBATIM (AC4)
`e1Regime.js` implements `gate-1-L-lidstrength-form-DESIGN.md §Decision` letter-for-letter. Constants (the pinned
table): `Z_BASE 0.15, Z_COLD 0.55, Z_AGE 0.25, T_ZLO 200, T_ZHI 320, T_MELT_LO 1100, T_MELT_HI 1500, T_ALO 300,
T_AHI 750, V_LO 0.05, V_HI 0.20, MU_DRY 0.55, MU_HEAT 0.65, W_Z 0.55, W_MU 0.75, G_EXP 0.15, GMOD_LO 0.90, GMOD_HI
1.12, RHOG_REF 4.95, K_L 0.82`. Form: `z = clamp01(Z_BASE+Z_COLD·coldness+Z_AGE·ageNorm)·meltFactor`;
`muProxy = clamp01(MU_DRY·dryness+MU_HEAT·anneal)·meltFactor`; `gMod = clamp(GMOD_LO,GMOD_HI,(ρ·g/RHOG_REF)^G_EXP)`;
`L = clamp01(K_L·(W_Z·z+W_MU·muProxy)·gMod)`. Inputs: `T_surf=T_eq`, `V=volatileFraction`, `ρ=density`,
`g=surfaceGravity`, `ageNorm=clamp01(age/10)`. **`L` MUST NOT read `shellThickness`** (SH-F2 §2). The AC4 test
diffs the E1 `L` table against these gate-1 reference values (`node …/gate-1-L-calib.mjs`), sorted, with the 9 orderings:

| preset | L | | preset | L | | preset | L |
|---|---|---|---|---|---|---|---|
| Carbon | 0.772 | | Sub-Neptune | 0.622 | | Ocean | 0.131 |
| Lava | 0.747 | | **Mars** | **0.551** | | Hot Jupiter | 0.107 |
| **Venus** | **0.728** | | Titan/Frozen/Europa | 0.330 | | **Magma** | **0.000** |
| Gas(Jov/Sat/Nep) | 0.63–0.67 | | MAGMA_REF | 0.270 | | | |
| Crystal | 0.634 | | **Rocky (Earth)** | **0.250** | | | |

9 orderings (all PASS in gate-1): `L(MAGMA_REF)<L(Venus)`; Venus>0.6; Rocky<0.35; Ocean<0.35; `Ocean≤Rocky`
(wetter→mobile); `Mars>Rocky`; Mars∈(0.30,0.65); Magma<0.10; Venus = strong-lid champion among rocky non-heatpipe.

### 4.2 `Φ` — the size-aware vigor proxy + the `d` transform (delegable #4, SH-F2, R-Φsize) — PROVEN
Pinned formula (realized from gate-2 §2's provisional; committed + run in `phi-calib.mjs` beside this plan):
```
massEarth  = surfaceGravity·radiusEarth²   // NAMED DERIVATION (must-fix): the condition vector carries NO mass field
                                //   (deriveConditionVector body-condition-vector.js:23-33 returns density/composition/
                                //   age/radiusEarth/ecc/rawTidal/shellThickness/mag/metallicity; AC6 adds only T_eq +
                                //   surfaceGravity). g = mass/R² EXACTLY (baseStep.js:20), so mass reconstructs cleanly
                                //   from surfaceGravity (AC6) + radiusEarth — both present post-AC6, same source.
                                //   computeE1 uses THIS; it NEVER reads fp.massEarth (only phi-calib.mjs does — it has fp).
radiogenic = 1 − clamp01(age/10)
d          = radiusEarth        // SH-F2 mantle-depth transform: SEPARATE from z (gate-1) and D (icy shellThickness).
                                //   Earth-relative rocky mantle depth ∝ R. PROVISIONAL — gate-4's fuller f(mass,gravity)
                                //   is a V2-2 refinement (confidence MEDIUM). NEVER baseStep.shellThickness, NEVER z.
vigor      = radiogenic·(C_MASS·massEarth + C_SIZE·d³)          // C_MASS = C_SIZE = 0.5   (raw, un-compressed)
Φ          = sqrt(vigor) + C_TIDAL·rawTidalIoRatio             // C_TIDAL = 10; sqrt = the ~2–3× compression (PG-2)
```
`phi-calib.mjs` node output over the real 17 presets (reproduces gate-2 §2 verbatim): **Venus 0.690, Mars 0.268,
Earth 0.740, Ocean 0.998**. `phi-calib.mjs` reads `fp.massEarth` for the calibration table; computeE1 instead
reconstructs `massEarth = surfaceGravity·radiusEarth²` (the §4.2 named derivation) — **identical value (exact, g=mass/R²),
so this quoted table is unchanged**, and the AC4 test diffs the E1 Φ table (computed via the reconstruction) against it.
**R-Φsize PASSES:** Φ(Mars) 0.268 < Φ(Venus) 0.690; ratio 2.57× ∈ [2,3] (honors PG-2);
raw-vigor ratio 6.57× confirms `sqrt` compresses. Gas/heat-pipe rows (Magma 7.6e8, gas giants 15–27) carry huge
diagnostic Φ but are **routed OFF the Φ path by `compositionClass`+`m_hp` BEFORE Φ is read** (exactly gate-1's `L`
diagnostic-only note). **Deviation recorded:** `d = radiusEarth` is the gate-2 provisional, not a mass/gravity
derivation — flagged MEDIUM; `Y_K` re-fit implications are gate-2's (V2-2), not V2-1's.

### 4.3 `n` and `m_hp`
`n = clamp(3,11, round(4 + 4·min(Φ,1.2) + 2·(1−L)))` (gate-2 constants `N_BASE 4, N_PHI 4, N_L 2, N_MIN 3, N_MAX
11`; reads the **compressed** Φ). `m_hp = rawTidalIoRatio − HEATPIPE_PEG`, `HEATPIPE_PEG = 0.45` (delegable #6, an
**exported/tunable** constant on the raw pre-`calibrateTidal` Io-ratio — NEVER the visual-tuned `calibrateTidal` knee).

### 4.4 `compositionClass` Stage-A + the §1 label carve-out (R-exotic)
Order: `atmosphere.composition==='h2-he' → 'gas'`; else `carbonToOxygen>1 → 'carbon'` (R-exotic: the C/O terminal
must beat density→rocky — care on Carbon); else `smoothstep(2.5,3.9,density)<0.5 → 'icy'`; else `'rocky'`.
**Label carve-out:** crystal/technogenic/geometric have NO distinguishing driver signature (D3-MF1/R-exotic) — E1
CANNOT derive them and does not try; they fall to their density class (`Crystal`→`'icy'`). The oracle (AC3) handles
the consequence: today Crystal's archetype matches no path predicate → `despun`; E1's cold-dead-icy Crystal →
dead-lid → `despun` — **writer-equal** (both land despun). Frozen is the contrasting case (below).

### 4.5 `geodynamicRegime` edges + the SEEDED MIDDLE (AC5) — the band, weights, nudge, effectiveL
**Edges (deterministic, per condition-to-regime-research). E1 has NO `locked` input (must-fix #4b) — it keys
"active" on the RAW Io-ratio, not the locked flag:** `m_hp>0 → 'heat-pipe'`; icy shell → `'icy'` when icy class AND
[**active tidal** `rawTidalIoRatio > ACTIVE_TIDAL` (Europa rt≈137) OR **methane-window volatile-cold**
`V≥0.12 ∧ T_surf∈[85,120]` (Titan T94)]; else icy class → `'dead-lid'` (Frozen T60, Crystal T150 — cold-dead icy, the
Frozen divergence); cold-dead rocky (low T, low Φ, no tidal) → `'dead-lid'`; hot-surface high-`L` (`L≥L_STRONG`,
`rawTidal<SHOULDER_LO`) → `'stagnant'` (Venus, data-placed). `L_STRONG = 0.63`, `SHOULDER_LO = 0.15`,
`ACTIVE_TIDAL = 0.5` (gate-1 §4 / gate-2 PG-5, UAT-tunable band edges). The methane-window bound is what SEPARATES
Titan (kept as `'icy'`→shell, writer-equal) from Frozen (→`'dead-lid'`→despun, the allow-listed divergence).

**Seeded band (the temperate-wet Earth-mass window, §2.4 #3) — PINNED boundaries, derived from the preset landscape:**
`massEarth ∈ [0.6, 1.6] AND T_surf ∈ [250, 320] AND V ≥ 0.12`, where `massEarth = surfaceGravity·radiusEarth²` (the
§4.2 named derivation — the vector carries no mass; the band gate uses the SAME reconstruction Φ does). Which presets
fall IN: **Rocky** (0.9, 288, 0.15), **Ocean** (1.3, 295, 0.35), **Eyeball** (1.0, 270, 0.25). OUT: Mars (mass 0.107 —
too small; deterministic dead/z-limb), Venus (T 737, V 0.02 — deterministic hot-dry stagnant via `muProxy`), all
gas/heat-pipe/cold bodies. (Rocky/Ocean's low `L` means their *default* route is mobile/plate; the seeded pick can
still resolve `'stagnant'`, which is exactly the wet-stagnant world R-wetstag names — see effectiveL below.)

**Oracle determinism of in-band bodies (AC3, must-fix): the seeded pick is AC5's domain, NOT AC3's.** For the
writer-equality oracle the in-band regime is COLLAPSED to its MODAL (argmax-weight) pick — deterministic, seed-free —
so "13 writer-equal" is reproducible, not seed-dependent. Modal picks (frozen weights + nudge, verified in
`oracle-preview.mjs`): Rocky → episodic → **plate**, Ocean → mobile → **plate** (both REACH their today-anchor);
Eyeball → mobile → **plate** (episodic and mobile both map to the plate dominant-anchor; only a `stagnant` modal would
give stagnant-lid). The seeded *stochastic* pick (a body occasionally resolving `'stagnant'` → stagnant-lid)
is the intended NEW multistable behavior AC5 sweeps — absent from today's routing, so never an AC3 divergence.
**Eyeball is a GENUINE writer-divergence, not writer-equal (must-fix):** it is rocky (density 5.5 → `'rocky'` class),
so E1 has NO icy-shell path for it — every seed resolves it to plate or (rarely) stagnant-lid, **NEVER shell**. Today
it routes to the eyeball-despun SHELL writer (`shellRegimeOf('eyeball', locked=true)='eyeball-despun'`, shellRelief.js:51)
purely because it is LOCKED (`isEarthlikePlatePath` returns false for locked bodies, planet-lod-rivers.js:409). E1 has
no `locked` input in shadow, so it cannot see the reason → Eyeball joins the allow-list as the **2nd
divergence** (§4.6). Its divergence is SEED-ROBUST (holds for every seed), so the equality claim stays deterministic.
**Disposition direction (corrected by working-Claude review, 2026-07-03): today's routing WINS, not E1's.** The
eyeball-despun destination SURVIVES per the signed coverage map (ROADMAP §3.3, P-LID-ICY row) and §5.1's
two-despun-destinations contract-author note; `tidalState.locked` is legitimate driver DATA (not an archetype
string), so the V2-3 fix is **dispatch/E1 gaining locked-awareness (locked temperate rocky → eyeball-despun,
byte-identical)** — NOT rerouting the shipped eyeball world onto plates. This also flags a V2-3 plumbing note:
the condition vector does not carry `tidalState.locked`/T_ss today (§5.1 D3-MF3 requires T_ss pre-gate at V2-2/V2-3).

**Frozen weights + nudge shape (frozen constants + lab override, AC5):** base
`{mobile: 0.45, episodic: 0.25, stagnant: 0.30}`. Nudge (linear, around band centers `V0=0.25`, `T0=285`, clamped ≥0
then renormalized): `mobile += K_V·(V − V0)` (`K_V = 1.2` → wetter → more mobile); `stagnant += K_T·(T_surf − T0)/70`
(`K_T = 0.30` → hotter → more stagnant); `episodic` absorbs the remainder. Draw order (fixed): `rng = alea('e1:regime:'+macroSeed)`
→ `pick = weightedPick(rng, weights)` → `positionWithinRegime = rng()` (a second draw, [0,1] within-band coordinate).
`e1Seed = macroSeed>>>0`. Lab override (`_lab.e1RegimeWeights`) replaces the base weights (mirrors `_driverAbMode`);
default restored by `_lab.e1RegimeWeightsReset()`.

**effectiveL on a seeded-`'stagnant'` pick (gate-2 §4 hand-up — the R-wetstag mechanism):** a seeded-stagnant
temperate-wet body (raw `L≈0.16`) would pierce **pervasively** ("Io-with-water", fails §5.4 #1) if its raw `L` reached
`localYield`. So E1 sets `effectiveL` in the **strong-mixed band**: `effectiveL = clamp(0.60, 0.66, EFF_L_BASE −
EFF_L_WET·wetness)`, `EFF_L_BASE = 0.65`, `EFF_L_WET = 0.05`, `wetness = smoothstep(V_LO,V_HI,V)` — wetter nudges
toward the **piercable lower edge (0.60)** so a *few* shields emerge among coronae (gate-2 §4's "L≈0.65 at Φ0.72 →
few-shields"). `effectiveL` is emitted ONLY on the stagnant pick (AC2 conditional tuple member); the base `L` stays
emitted always. Confidence MEDIUM (UAT taste on how "wet" it reads — Max's gate, §5.4 #1 stays OPEN until his UAT).

### 4.6 `computeE1` attach point (lab data flow) + the `writerUnder` extraction shape
- **Attach:** `world-engine-lab.html:3627`, immediately after `state._lastBodyDrivers = _bodyDrivers;`, inside
  `ensureNetworkRouted` — `state._lastE1 = computeE1(_bodyDrivers.condition, state.macroSeed);`. This is the exact seam
  where the vector + seed are both live and where `route()` is called next (:3628) — but E1's result is NOT threaded
  into the `route()` args (data-only; `archetype:` at :3637 stays `PRESET_ARCHETYPE[_preset]`).
- **`writerUnder(PRESET_ARCHETYPE)`** = `classifyWriterPath(archetype, locked)` composing the four EXPORTED predicates
  (`isEarthlikePlatePath`/`isShellReliefPath`/`isVolcanicPath`/`isStagnantLidPath`) in dispatch order → `'despun'`
  fallback. Zero re-implementation of the archetype-string logic (it delegates to the shipped predicates).
- **`writerUnder(e1)`** = the new subtractive-gate predictor (§Slice C). **Today-routing** (writerUnder archetype) over
  the 15: plate = {Rocky, Ocean}; volcanic = {Lava, Magma}; shell = {Frozen, Eyeball, Europa, Titan}; stagnant-lid =
  {Venus}; despun = {Gas Jovian, Gas Saturnian, Neptunian, Sub-Neptune, Carbon, Crystal}. **The tally is EMPIRICALLY
  PINNED by `oracle-preview.mjs`** (committed beside this plan, mirroring `phi-calib.mjs`): **13 writer-equal**;
  **2 allow-listed divergent** — (i) **Frozen** (today `shell`/icy-active → E1 `despun`/dead-lid: cold-dead icy, no
  active tidal, T 60 below the methane window; V2-3 reroute off shell to dead-lid); (ii) **Eyeball** (today
  `shell`/eyeball-despun → E1 `plate`: a rocky LOCKED body shadow-E1 has no shell path for; seed-robust; V2-3:
  dispatch gains locked-awareness, Eyeball STAYS eyeball-despun byte-identical — §4.5 disposition-direction note).
  **`Neptunian/Sub-Neptune` is NOT a writer divergence** — both are `sub-neptune`+`h2-he`,
  so both → `despun` today (`sub-neptune` ∈ SHELL_EXCLUDE, shellRelief.js:39) AND both → `'gas'`→`despun` under E1
  (writer-EQUAL, proven in `oracle-preview.mjs`); the short-key collision is a recorded **PRESET_ARCHETYPE taxonomy
  NOTE** for V2-3 (add an ice-giant range or keep the key), never a `writerUnder` inequality. `oracle-preview.mjs`
  output: **13 equal + 2 divergent {Frozen, Eyeball}**, Neptunian & Sub-Neptune both `despun` both ways.

---

## 5. Risks + rollback (per slice; no clock-time estimates)

- **R1 — AC1 byte-safety of the widened vector (Slice A, HIGH→GATED).** New `T_eq`/`surfaceGravity` under `condition`
  must stay inert. *Mitigation:* NESTED-only (never flat — the R1 flat-age trap); the inertness block
  (`worldengine-base-condition-vector.test.js:124-153`) + the 75-golden gate are the mechanical proof. *Rollback:*
  revert the two added lines in `body-condition-vector.js`; the vector returns to its cc267a4 shape.
- **R2 — `L`/`Φ` transcription drift from the gates (Slice B, MED→GATED).** A mistyped constant silently changes the
  response space. *Mitigation:* AC4 diffs the E1 `L` table against `gate-1-L-calib.mjs` (9 orderings) and Φ against
  `phi-calib.mjs` (R-Φsize) — both committed reference scripts. *Rollback:* `e1Regime.js` is new + imported by nothing
  shipped; delete it and its tests, AC1 is untouched.
- **R3 — SH-F2 thickness conflation (Slice B, MED).** Feeding `shellThickness` to `L` (as `z`) or Φ (as `d`) reintroduces
  the triple-duty bug. *Mitigation:* E1 computes `z` from `T_eq`/`age` and `d` from `radiusEarth`; a source grep in the
  AC4 test asserts `e1Regime.js` never reads `condition.shellThickness`. *Rollback:* n/a (guarded at author time).
- **R4 — `writerUnder(e1)` re-implements routing (Slice C, MED).** The predictor could drift from the shipped predicates.
  *Mitigation:* the `PRESET_ARCHETYPE` side composes the EXPORTED predicates verbatim; the e1 side is diagnostic-only,
  grep-clean of dispatch wiring, and adjudicated against the pinned today-routing table; the tally (13 equal + 2
  divergent {Frozen, Eyeball}) is EMPIRICALLY pre-proven by `oracle-preview.mjs` before Slice C is coded (the AC3
  counterpart to phi-calib.mjs). *Rollback:* the oracle is a test file only — delete it; no src change to revert.
- **R5 — R-wetstag / effectiveL is a modeling choice, not closed (Slice B, MED-DECLARED).** effectiveL's band edge is
  taste. *Mitigation:* emitted deterministically + bounds-tested (AC5); §5.4 #1 stays OPEN pending Max UAT (declared in
  intent). *Rollback:* effectiveL is a conditional tuple member; removing it degrades to base-`L` (the OPEN state).
- **R6 — label leaks into a branch (Slice B/D, LOW→GATED).** *Mitigation:* the label-invariant runtime assert (AC2) +
  the Slice-D grep audit (zero `e1.label` branch sites in `src/`+lab). *Rollback:* n/a (caught before commit).
- **R7 — lab wiring perturbs the render (Slice D, LOW→GATED).** *Mitigation:* `state._lastE1` is set but never passed to
  `route()`; AC7 screenshots + AC1 full-suite confirm zero-byte shadow. *Rollback:* remove the `state._lastE1` line +
  `e1Probe` + the console override; the lab returns to cc267a4 behavior.
- **R8 — "no pre-existing test dropped" bookkeeping (all slices, LOW).** V2-1 adds ~4 new test files (count rises). AC1's
  clause is read as "no pre-existing test dropped/skipped; the 4 known KnownObjects×3/GalacticFeatures×1 failures do not
  grow" (contract AC1 already amends this). *Mitigation:* full `npx vitest run` diff vs the pre-change baseline at the
  Slice-D gate. *Rollback:* n/a (bookkeeping).
