# V2-3 Dispatch-Flip — Sliced BUILD-PLAN

Branch `feature/world-engine-production-L1` @ `7965ecc`. Contract:
`contract.json` (AMENDED 2026-07-11). Guardrail quartet 160/160 green at HEAD.

**All routing claims below are EMPIRICALLY VERIFIED** by running the real `computeE1`
over all 17 `DRIVER_PRESETS` (script output folded into the adjudication table §0).
Symbols were grepped, not line-numbered.

---

## §0 — The verified 17-preset adjudication table (single source for AC-ORACLE-17)

Derived route computed live from `computeE1(deriveConditionVector(fp), 1)`:

| Preset | today writer | cls | geodynamicRegime | m_hp | L | locked | modal | **derived route** | verdict |
|---|---|---|---|---|---|---|---|---|---|
| Rocky (Earthlike) | plate | rocky | stagnant* | −0.448 | 0.250 | – | episodic | **plate** | identical |
| Lava (hot airless) | volcanic | rocky | heat-pipe | +7.8e5 | 0.747 | ✓ | – | **volcanic** (router pure-weak) | identical |
| Ocean (temperate) | plate | rocky | stagnant* | −0.446 | 0.131 | – | mobile | **plate** | identical |
| Titan (methane seas) | shell:volatile-cold | icy | icy | −0.450 | 0.330 | – | – | **shell:volatile-cold** | identical |
| Frozen (airless) | shell:icy-active | icy | **dead-lid** | −0.450 | 0.330 | – | – | **despun** | **REROUTE #1** |
| Europa (icy moon) | shell:icy-active | icy | icy | +136 | 0.330 | ✓ | – | **shell:icy-active** | identical |
| Gas giant (Jovian) | despun | gas | dead-lid | – | 0.665 | – | – | **despun** | identical |
| Gas giant (Saturnian) | despun | gas | dead-lid | – | 0.634 | – | – | **despun** | identical |
| Ice giant (Neptunian) | despun | gas | dead-lid | – | 0.634 | – | – | **despun** | identical |
| Venus (sulfuric shroud) | stagnant-lid | rocky | stagnant | −0.449 | 0.728 | – | – | **stagnant-lid** (router pure-strong) | identical |
| Sub-Neptune (hazy) | despun | gas | dead-lid | – | 0.622 | – | – | **despun** | identical |
| Eyeball (locked temperate) | shell:eyeball-despun | rocky | stagnant* | −0.449 | 0.215 | ✓ | mobile | **shell:eyeball-despun** (locked-awareness) | identical |
| Hot Jupiter (locked giant) | **shell:eyeball-despun** | gas | dead-lid | – | 0.107 | ✓ | – | **despun** | **REROUTE #2** |
| Mars (arid rocky) | despun | rocky | dead-lid | −0.450 | 0.551 | – | – | **despun** | identical |
| Magma (K2-141b) | volcanic | rocky | heat-pipe | +7.6e7 | 0.000 | ✓ | – | **volcanic** (router pure-weak) | identical |
| Carbon (high C/O) | despun | carbon | dead-lid | – | 0.772 | – | – | **despun** | identical |
| Crystal (faceted) | despun | icy | dead-lid | −0.450 | 0.634 | – | – | **despun** | identical |

\* Rocky/Ocean/Eyeball's SEEDED `geodynamicRegime` varies per seed; the dispatch **never
reads it** for in-band bodies — it reads the seed-free `modalRegime` (designDecision #1).
This is exactly why Rocky's seed-1 tuple says `stagnant` yet it must route `plate`.

**Result: 15 identical + 2 reroutes {Frozen, Hot Jupiter}, both shell→despun. Confirmed.**
Hot Jupiter's today-route empirically confirmed `shell:eyeball-despun` (archetype null +
locked:true → `shellRegimeOf` locked-fallback), NOT despun — lens M2 verified against code.

---

## §1 — The flipped dispatch (condition-bearing path), byte-exact

Inside `writeBodyRelief`, when `bodyDrivers.condition` is present:

```
const cond   = bodyDrivers.condition;
const locked = cond.tidalState?.locked ?? argLocked;   // NAMED consumer (AC-0 ch.2)
const e1     = computeE1(cond, macroSeed);
const cls    = e1.compositionClass;
const rawTidal = cond.rawTidalIoRatio ?? 0;
const T_ss   = locked ? (T_eq ?? 0) * 1.4 : 0;         // shipped F41 convention, unchanged

(1) cls==='gas' || cls==='carbon'        → despun            // Gas×3, Sub-Neptune, Carbon, HOT JUPITER
(2) cls==='icy':
      e1.geodynamicRegime==='icy'        → shell(e1.shellSubRegime)  // Europa=icy-active, Titan=volatile-cold
      else                               → despun            // FROZEN (reroute), Crystal
(3) rocky:
   (3a) e1.m_hp > 0                       → unbrokenLid()     // Lava/Magma → router pure-weak
   (3b) locked                            → shell('eyeball-despun')  // Eyeball (PRECEDES in-band map)
   (3c) isUnbrokenLidPath(e1)             → unbrokenLid()     // Venus → router pure-strong
   (3d) inSeededBand(cond)               → modalRegime(V,T)==='stagnant' ? stagnantLidDirect() : plate()
   (3e) e1.geodynamicRegime==='mobile'    → plate()
   (3f) else                             → despun()          // Mars (dead-lid)
```

**Ordering is load-bearing:** (3a) heat-pipe MUST precede (3b) locked, or Lava/Magma (locked
heat-pipe) would wrongly take eyeball-despun — this mirrors today's `SHELL_EXCLUDE` having
`'lava'` so a locked lava body falls THROUGH the locked-fallback to volcanic. (3b) locked
precedes (3d) in-band, or Eyeball (in-band, modal=mobile) would collapse to `plate` — that IS
the shadow-oracle's Eyeball divergence, and locked-awareness is how "today wins" byte-identical.

**Writer-argument fidelity (why 14/15 golden rows stay bit-identical):** each derived route
calls the SAME writer with the SAME args as today —
`writePlateUpliftSphere(carrier, bodyDrivers, {macroSeed, tune:driversToTune(bodyDrivers)})`;
`writeShellReliefSphere(carrier, grainDrivers, {macroSeed, regime})` with `regime` = the
derived sub-tag (identical string); despun = `writeGrainSphere(carrier, grainDrivers)` +
`writeHeightSphere(carrier, {}, grainDrivers, {name:'tectonic-build'}, heightSeed)`.

**Router delegation + return re-wrap (probe parity):** `unbrokenLid()` computes
`stagnantTune = stagnantDriversToTune(bodyDrivers)` in the CALLER (rivers.js already imports it —
keeps the builder symbol OUT of `lidResponse.js`, MF#1) and calls
`writeLidResponseSphere(carrier, bodyDrivers, {e1, rawTidal, macroSeed, locked, T_ss, grainDrivers, stagnantTune})`,
then re-wraps its `{path:'lid-weak'|'lid-strong', magmaDiag|stagnantDiag}` back to
`{path:'volcanic'|'stagnant-lid', magmaDiag|stagnantDiag}` so `_lab.magmaProbe`/`stagnantLidProbe`
read identical fields.

**Why Lava/Magma/Venus survive the router corner byte-identical** — NOT via a single byte-anchor
proof (that claim was WRONG; see Lens log R1):
- **Lava/Magma (pure-weak):** the byte-anchor's direct side IS `writeMagmatismSphere(bodyDrivers,
  tune=magmaDriversToTune(bodyDrivers))`, matching today's `writeBodyRelief` volcanic call — the
  anchor genuinely proves router-corner === direct-writer here.
- **Venus (pure-strong):** the byte-anchor's Venus direct side uses `grainDrivers` + NO tune, which
  is NOT today's `writeBodyRelief` Venus call (`bodyDrivers` + `stagnantDriversToTune`) — so the
  anchor does NOT prove Venus. Venus's golden row survives instead by three separately-verified
  facts: (a) `STRONG_REGIME==='venus-stagnant-lid' === stagnantLidRegimeOf('stagnant-lid')`;
  (b) `writeStagnantLidReliefSphere` runs `void drivers;` so bodyDrivers-vs-grainDrivers is
  byte-irrelevant; (c) `stagnantDriversToTune(Venus golden)===null` (probe-verified), so the
  Slice-A/B tune-threading is byte-inert at Venus. The threading closes it STRUCTURALLY — a builder
  must NOT skip it on the false belief "the anchor proves Venus," or a future non-null stagnant tune
  would silently break the Venus golden while the anchor still passes.

**Migration bridge (condition ABSENT):** the `else` branch is today's archetype chain VERBATIM
(`isEarthlikePlatePath → shellRegimeOf → isVolcanicPath → stagnantLidRegimeOf → despun`). This
carries the ~8 legacy condition-less callers unchanged. Dies at the retirement commit.

---

## §2 — Call-site census (AC-FLIP task item 6)

`grep -n "writeBodyRelief" **/*.{js,html,mjs}`:

**CONDITION-BEARING → derived dispatch:**
- `planet-lod-rivers.js:1217` (`route()` — lab/production; lab's `buildBodyDrivers` attaches `.condition`).
- `tests/fixtures/v2-0-carrier-golden.mjs:99` (the 75-golden harness — `buildBundle` attaches `.condition`, Slice-C seam).
- `tests/worldengine-base-condition-vector.test.js:165` (AC4 seam spy — bundle carries `.condition`; asserts arrival only, no route pin).

**CONDITION-LESS → migration bridge (verified: no `.condition` in the bundle):**
- `tests/worldengine-base-magmatism-multiply.test.js:112`
- `tests/worldengine-base-magmatism-structure.test.js` (via `relief()`)
- `tests/worldengine-base-stagnantlid-structure.test.js:297`
- `tests/worldengine-base-plate-driver-response.test.js:89,90,97,98` (`bodyDrivers`=D_OFF, flat keys only)
- `tests/worldengine-plate-regime-gate.test.js:45,56,65`
- `tests/worldengine-shell-regime-gate.test.js:31`
- `tests/planet-lod-rivers-discharge-param.test.js:15`

---

## §3 — Slice A: plumbing + exports (BYTE-INERT, no routing change)

**Files touched (grep-anchored symbols):**
- `body-condition-vector.js` `deriveConditionVector` — add nested `tidalState: { locked: !!(fp.tidalState && fp.tidalState.locked) }` (byte-safe like `T_eq`/`surfaceGravity`; flat-key tune builders ignore it). AC-PLUMB-RECONCILE (a).
- `src/worldengine/base/e1Regime.js`:
  - `MOBILE_L` (`0.35`) → **`export const`** (single source of truth). AC-PLUMB-RECONCILE (b).
  - `inSeededBand` → **`export function`** (dispatch needs the in-band determination). AC-FLIP.
  - `computeE1` — on the `cls==='icy'` branch, set conditional tuple member
    `shellSubRegime` from the EXISTING `activeTidal`/`methaneVolatile` booleans:
    `activeTidal → 'icy-active'`, `methaneVolatile (and not activeTidal) → 'volatile-cold'`,
    omitted on dead-lid (mirrors the `effectiveL` conditional-member pattern; NO new
    constants, never re-derives `ACTIVE_TIDAL`/`METH_LO`/`METH_HI`). AC-FLIP shell sub-regime.
- `src/worldengine/base/lidResponse.js`:
  - `import { MOBILE_L } from './e1Regime.js'`; delete `const MIXED_LO = 0.35` → use `MOBILE_L` (R-A3, drops the local literal). AC-PLUMB-RECONCILE (b).
  - Pure-weak branch: `magmaDiag.appliedTune = tune;` (parity).
  - Pure-strong branch: pass `drivers` (the 2nd param — bodyDrivers post-flip) to
    `writeStagnantLidReliefSphere` and thread `tune: opts.stagnantTune ?? null`, set
    `stagnantDiag.appliedTune = opts.stagnantTune ?? null`. **CRITICAL (MF#1): the strong tune is
    COMPUTED IN THE CALLER, never here — do NOT `import { stagnantDriversToTune }` into
    lidResponse.js.** `worldengine-lid-byte-anchors.test.js:181` asserts `LID_CODE` does NOT match
    `/stagnantDriversToTune/`; that byte-anchor is a named quartet member (contract
    `mustStayWorking`) and is NOT one of the two enumerated repurposings, so it stays green
    UNCHANGED. Threading the value via `opts.stagnantTune` keeps the builder symbol out of the
    router. AC-PLUMB-RECONCILE (c), lens MF-5. Byte-inert in Slice A: no caller passes `stagnantTune`
    yet → null → `void drivers` → identical bytes AND identical `appliedTune` (null) at every anchor
    (the anchor's own direct call passes no `stagnantTune`).

**New/changed tests:** extend `worldengine-e1-regime.test.js` (or a new plumbing test) — assert
`shellSubRegime`: Europa `'icy-active'`, Titan `'volatile-cold'`, Frozen `undefined`; `MOBILE_L`
exported === `0.35`; `inSeededBand` exported. Extend `worldengine-base-condition-vector.test.js`
— `tidalState.locked` present + == fp for all 17, and `driversToTune`/`magmaDriversToTune`/
`stagnantDriversToTune` unchanged (byte-inert). Extend `worldengine-lid-router-audit.test.js`
single-source leg — `MOBILE_L` imported, no `0.35` literal in `lidResponse.js`.

**AC(s):** AC-PLUMB-RECONCILE (all), partial AC-FLIP (exports).

**Golden stays green at this seam:** `writeBodyRelief` is UNTOUCHED → **75/75 bit-identical,
unchanged.** V2-1 oracle green (a conditional inert field on the tuple; `toHaveProperty` subset
checks + determinism `toEqual` both hold). Byte-anchors green — the pure-strong threading is
byte-inert (Venus/MAGMA_REF tune=null → DEFAULTS) AND the forbidden `/stagnantDriversToTune/`
symbol never enters `lidResponse.js` (MF#1: computed in the caller, threaded via `opts.stagnantTune`),
so the AC-TUNE-NULL grep at line 181 stays green untouched. shadow-audit + router-audit green
(rivers.js does not yet import `computeE1`/call the router in dispatch).

**Commit seam:** "V2-3 Slice A — plumb tidalState.locked + export MOBILE_L/inSeededBand +
shellSubRegime + router appliedTune parity (byte-inert)".

---

## §4 — Slice B: THE FLIP (atomic — carve-out + repurposings co-commit)

The Frozen carve-out and the two guardrail repurposings CANNOT lag the flip — they turn red
the instant the flip lands. They MUST co-commit. (This is the justified deviation from the
task's suggested shape, which placed them in a later slice.)

**Files touched:**
- `planet-lod-rivers.js` `writeBodyRelief` — add the §1 condition-bearing derived dispatch as the
  `if (bodyDrivers?.condition)` branch; keep the existing archetype chain as the `else` bridge.
  New imports: `computeE1, modalRegime, inSeededBand, isUnbrokenLidPath`(from e1Regime/lidResponse),
  `writeLidResponseSphere` (already imported for `labLidOverride`). `isUnbrokenLidPath` lives in
  `lidResponse.js`. **MF#1: `unbrokenLid()` computes `stagnantTune = stagnantDriversToTune(bodyDrivers)`
  HERE (rivers.js already imports `stagnantDriversToTune`) and threads it into `writeLidResponseSphere`
  via `opts.stagnantTune` — the router itself never names the builder (keeps byte-anchors:181 green).**
- `tests/v2-0-byte-identity.test.js` — **Frozen carve-out** (§5).
- `tests/worldengine-e1-shadow-audit.test.js` — **repurposing #1:** remove `'planet-lod-rivers.js'`
  from `WRITER_DISPATCH` (line 31-34) — it becomes a legitimate E1 consumer like `lidResponse.js`;
  base writers stay E1-blind. Enumerate in the comment. (Lab route-args + label-invariant legs
  stay green: the lab still passes only `bodyDrivers`; `writeBodyRelief` computes E1 itself.)
- `tests/worldengine-lid-router-audit.test.js` — **repurposing #2 (a REWRITE, not a relaxation —
  enumerated):** post-flip `RIVERS_CODE.indexOf('writeLidResponseSphere(')` (test line 148) returns
  the FIRST occurrence, which is now the new `writeBodyRelief` `unbrokenLid()` call (~rivers.js:480),
  PRECEDING the existing `labLidOverride` seam call (~rivers.js:1233). The 600-char preceding window
  (line 150) therefore will NOT contain `labLidOverride` → the current "reaches rivers.js only via
  labLidOverride" assertion (141-154) BREAKS and must be re-authored to accept BOTH legitimate call
  sites (production dispatch + labLidOverride). The "writeBodyRelief body calls no router symbol"
  test (156-164) also breaks (the body now legitimately calls the router) — re-pin it so the router
  IS permitted inside `writeBodyRelief` but base writers (`magmatism`/`stagnantLid`/`shellRelief`/
  `tectonic`/`plates`/`mixedInterior`) still call no router/E1 symbol (a NEW base-writer scan to
  author — the promised "base writers call no router/E1" invariant does NOT exist in the current
  156-164 block, which only scans the writeBodyRelief-body window). AC-0 label-free leg on
  `lidResponse.js` itself stays unchanged.

**New tests:**
- `tests/worldengine-v2-3-dispatch-oracle.test.js` (17-preset post-flip oracle) — iterate ALL 17
  `DRIVER_PRESETS`; `writer_today = classifyWriterPath(PRESET_ARCHETYPE[name] ?? null, locked)`,
  `writer_derived` = the new dispatch; assert the §0 table, divergence set EXACTLY {Frozen, Hot
  Jupiter} each with a NAMED disposition, seed-invariance per preset over {1,2,3,7,42,100,777},
  and Europa≠Titan sub-regimes. **Also assert every rule-(3c) body (`isUnbrokenLidPath`→`unbrokenLid`)
  classifies pure-strong via `classifyLidPath` — never mixed/off-pilot** (pins the latent
  (3c)/classifyLidPath coupling, Known-risk RT1: `isUnbrokenLidPath`'s `hotSurfaceStagnant` gate does
  not check `rawTidal`, but `classifyLidPath`'s pure-strong cut requires `rawTidal<SHOULDER_LO`; they
  agree only because `computeE1` data-places `stagnant` at `L>=L_STRONG` solely via the
  `rawTidal<SHOULDER_LO` cut — a (3c) body that ever admitted `rawTidal>=SHOULDER_LO` would silently
  route to the mixed COMPOSER instead of stagnant-lid). **V/T sourcing pin (Known-risk RT2):** the
  (3d) `modalRegime(V,T)` call MUST source `V = cv.composition.volatileFraction` (=`e1.V`) and
  `T = cv.T_eq` — matching the V2-1 oracle's `writerE1` — NEVER the seeded `e1.geodynamicRegime`, or
  seed-invariance breaks. AC-ORACLE-17 / AC-FLIP.
- **Garble test** — zero/garble `PRESET_ARCHETYPE` entries → NO condition-bearing route changes
  (radius exempt — R-GARBLE: `drawPresetRadius` legitimately reads the map). AC-FLIP.
- **AC-0 grep-audit** — because repurposing #1 removes `planet-lod-rivers.js` from the shadow-audit
  `WRITER_DISPATCH` list, NOTHING else guards the new dispatch's label-freeness; this grep is the
  SOLE guard and MUST scope to the exact condition-bearing routing-decision region (the
  `if (bodyDrivers?.condition)` block of `writeBodyRelief`, extracted by function-body slice — NOT
  the whole file, which legitimately still contains `PRESET_ARCHETYPE` in the else-bridge/oracle and
  radius plumbing). Assert that region reads no `PRESET_ARCHETYPE` / `e1.label` / `stagnantLidRegimeOf(`
  / `isVolcanicPath(`. AC-0 ch.1.

**AC(s):** AC-FLIP-LABEL-FREE, AC-ORACLE-17, AC-ZERO-CLOBBER (a–f), AC-0 (1,2).

**Golden at this seam (§5):** 70/75 bit-identical; Frozen-5 assert-equal-despun. V2-1 oracle
UNCHANGED + green (proves the flip changed dispatch, not E1). Quartet green with the 2
enumerated repurposings. 4 known failures (KnownObjects×3, GalacticFeatures×1) do not grow.

**Commit seam:** "V2-3 Slice B — flip writeBodyRelief to derived dispatch + Frozen carve-out +
guardrail repurposings + 17-oracle (2 reroutes: Frozen/Hot Jupiter shell→despun)".

---

## §5 — Frozen carve-out mechanism (concrete; AC-ZERO-CLOBBER a)

`computeAllHashes()` iterates `Object.keys(PRESET_ARCHETYPE)` (15) × `SEEDS=[1,2,3,7,42]` → 75.
After the flip, `buildBundle` carries `.condition`, so every golden preset takes the derived
path. 14 → same writer (bit-identical). **Frozen → despun (5 rows move).**

Rewrite `tests/v2-0-byte-identity.test.js`:
- 70 rows (the 14 non-Frozen presets): `recomputed[name][seed] === GOLDEN.hashes[name][seed]` (UNCHANGED assertion; committed golden `v2-0-carrier-goldens.json` NEVER re-captured).
- Frozen's 5 rows: `recomputed['Frozen (airless)'][seed] === despunRef(seed)` where `despunRef`
  computes the DESPUN WRITER'S fresh output at the same seed on a fresh carrier — an
  adjudicated-divergence assertion, NOT a re-capture:

```
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';
import { buildIrregularSphere, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { TARGET_N, LLOYD, hashCarrier } from './fixtures/v2-0-carrier-golden.mjs';
function despunRef(seed){
  const c = makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
  writeGrainSphere(c, DEFAULT_GRAIN_DRIVERS);                                   // rivers.js:507
  writeHeightSphere(c, {}, DEFAULT_GRAIN_DRIVERS, {name:'tectonic-build'}, 'e6:'+(seed|0)); // :508
  return hashCarrier(c);
}
```

Writer functions: `writeGrainSphere`, `writeHeightSphere` (from `tectonic.js`), args
`DEFAULT_GRAIN_DRIVERS` + `heightSeed='e6:'+seed`, seeds {1,2,3,7,42} — the EXACT two lines the
flipped despun branch runs for Frozen. This proves Frozen post-flip === the despun writer,
without re-capturing. (Note: stripping `.condition` from the Frozen bundle would take the bridge
back to `shell:icy-active` — the OLD route — so the reference must be the direct despun writers.)

**Preserve the existing coverage guards (R3):** the rewrite MUST retain the meta test
(`expect(names.length).toBe(15)` / total count === 75, current ~lines 33-41) and the tune-null
anchor `describe` block (current ~lines 52-59) verbatim. Special-case ONLY `name === 'Frozen
(airless)'` for the assert-equal-despun branch; every other name keeps the strict
`recomputed[name][seed] === GOLDEN.hashes[name][seed]` assertion. A careless full-rewrite that
drops the count/anchor guards would silently shrink coverage while still reading green.

---

## §6 — Hot Jupiter reroute (verified by reading the code; AC-ORACLE-17)

Today: `PRESET_ARCHETYPE` has NO Hot Jupiter entry → `archetype=null`; `DRIVER_PRESETS['Hot
Jupiter'].tidalState.locked===true`. In `writeBodyRelief`: `isEarthlikePlatePath(null,true)`
→ false (locked); `shellRegimeOf(null,true)` → `null` not in `SHELL_REGIMES`, `locked && !SHELL_EXCLUDE.has(null)`
→ **`'eyeball-despun'`** (the locked-fallback, `shellRelief.js:51`). So today Hot Jupiter renders
the icy-shell eyeball-despun carrier — a locked GAS GIANT on the shell writer (the §5.2
"known-wrong routing to fix, not match"). Empirically confirmed: today-route = `shell:eyeball-despun`.

Derived: `computeE1` → `compositionClass='gas'` → dispatch rule (1) → **despun**. Bytes change from
the eyeball-despun lineament field to the despun zonal field. Visually masked (gas rows derive
relief gates ~0) but byte-real. **NOT in the 75-golden** (Hot Jupiter absent from
`PRESET_ARCHETYPE`), so no golden row moves — the reroute surfaces only in the 17-oracle + live
sweep. Adjudicated as a fix, same class as Frozen.

---

## §7 — Shell sub-regime mechanism (AC-FLIP; Europa/Titan/Eyeball byte-identity)

`computeE1` `cls==='icy'` branch (`e1Regime.js`): `activeTidal = rawTidal > ACTIVE_TIDAL(0.5)`
(Europa rawTidal≈136.7 → true); `methaneVolatile = V>=0.12 && T in [METH_LO 85, METH_HI 120]`
(Titan T94 → true, activeTidal false). `geodynamicRegime = (activeTidal||methaneVolatile) ? 'icy' : 'dead-lid'`.

**Exported sub-tag shape** (conditional tuple member, set only when the icy branch is active):
```
shellSubRegime = activeTidal ? 'icy-active'
               : methaneVolatile ? 'volatile-cold'
               : undefined;          // dead-lid → routes despun, sub-tag unused
```
Dispatch: `cls==='icy' && geodynamicRegime==='icy'` → `shell(e1.shellSubRegime)`. Maps Europa →
`'icy-active'`, Titan → `'volatile-cold'` — the EXACT `regime` strings `shellRegimeOf` returns
today → `writeShellReliefSphere` byte-identical (distinct `REGIME_WEIGHTS` preserved). **Eyeball's
`'eyeball-despun'` does NOT come from `computeE1`** (locked-blind, must-fix #4b) — it comes from
dispatch rule (3b) locked-awareness. `computeE1` gains NO locked input. Byte-safe: the new field
is conditional (like `effectiveL`), so `worldengine-e1-regime.test.js` (`toHaveProperty` subset +
`toEqual` determinism) stays green.

---

## §8 — Slice C: Neptunian taxonomy + Mars oracle (BYTE-INERT)

**Files:** `driver-presets.js` (`PRESET_ARCHETYPE` + the shared-key doc comment), a new
`tests/worldengine-v2-3-taxonomy.test.js`. **NOT `src/core/ScaleConstants.js`** — see MF#2.

**Neptunian/Sub-Neptune collision** — both `PRESET_ARCHETYPE` keys map to `'sub-neptune'` →
`RADIUS_RANGES_EARTH['sub-neptune']=[2.5,4.0]` (verified: `RADIUS_RANGES_EARTH` lives at
`src/core/ScaleConstants.js:67`, NOT `driver-presets.js`).

**DEFAULT = Option B (documented shared key) — MF#2.** Keep both presets on `'sub-neptune'`; add a
documentation comment in `driver-presets.js` marking it an explicitly-shared taxonomy identity
(AC-TAXONOMY-NEPTUNE's "kept key… explicitly documented as shared taxonomy" path). This touches
ONLY `driver-presets.js`, which IS in AC-ZERO-CLOBBER(g); radii and routes are provably byte-equal
(nothing moves). Option B is the safe default because it clears the collision within the frozen
diff-scope with zero out-of-scope edits.

**Option A (distinct `'ice-giant'` key) is OUT OF SCOPE without a contract amendment (MF#2).** It
would (i) edit `src/core/ScaleConstants.js` (add `'ice-giant':[2.5,4.0]`) — a file NOT in
AC-ZERO-CLOBBER(g)'s enumerated list — and (ii) trip `v2-0-slice-a-byte-safety.test.js:59`
(`PRESET_ARCHETYPE toEqual v2-0-preset-archetype.ad156cc.json`), a frozen guard also outside (g).
Do NOT take Option A unless Max FIRST explicitly expands AC-ZERO-CLOBBER(g) to enumerate BOTH
`src/core/ScaleConstants.js` AND the frozen `v2-0-preset-archetype.ad156cc.json` fixture as
adjudicated scope additions. Radii stay byte-equal either way (both ranges are `[2.5,4.0]`), so
Option A buys only a cleaner taxonomy name at the cost of two out-of-scope edits — not worth a
hard-constraint violation.

**Mars** — recommended: **oracle-only, NO `PRESET_ARCHETYPE` entry.** The 17-oracle already
iterates `DRIVER_PRESETS` (§4), so Mars adjudicates with `archetype=null` (its real today-route
despun). Adding Mars to `PRESET_ARCHETYPE` would break the 75-golden harness
(`names.length===15`, `Object.keys(PRESET_ARCHETYPE)` iteration) — see §10 ambiguity #1.

**Test:** `drawPresetRadius` + `RADIUS_RANGES_EARTH` entries for both presets byte-equal pre/post;
writer routes unchanged; the shared `'sub-neptune'` key documented (Option B) — assert the
`PRESET_ARCHETYPE` snapshot is UNCHANGED (`v2-0-slice-a-byte-safety.test.js:59` stays green).

**Golden at this seam:** no golden row moves (Neptunian stays despun; Mars not in the golden);
routes unchanged. `PRESET_ARCHETYPE` snapshot untouched under Option B → `v2-0-slice-a-byte-safety`
green. `planet-archetypes.test.js` unaffected (it reads `ARCHETYPES`/`FEATURES`, NOT
`RADIUS_RANGES_EARTH`).

**Commit seam:** "V2-3 Slice C — Neptunian shared-key taxonomy doc (Option B) + Mars oracle
finalization (byte-inert)". (Could fold into Slice B if 2 commits preferred.)

---

## §9 — Verify plan per AC (task item 7)

- **AC-0:** `npx vitest run tests/planet-archetypes.test.js`; grep the condition-bearing dispatch
  for `PRESET_ARCHETYPE`/`.label`/`stagnantLidRegimeOf(`/`isVolcanicPath(` reads; BUILD-NOTES
  conformance table maps each new channel → named reader.
- **AC-FLIP-LABEL-FREE:** `npx vitest run tests/worldengine-v2-3-dispatch-oracle.test.js` (17×seeds,
  seed-invariance, Europa≠Titan) + the garble test + the AC-0 grep.
- **AC-ORACLE-17:** the 17-oracle above + `npx vitest run tests/worldengine-e1-conformance-oracle.test.js`
  (V2-1 shadow oracle STILL green, untouched).
- **AC-PLUMB-RECONCILE:** `npx vitest run tests/worldengine-base-condition-vector.test.js`
  (tidalState.locked present + inert) + `tests/worldengine-lid-byte-anchors.test.js` (appliedTune
  on both branches, probe parity, AND line 181 `/stagnantDriversToTune/` still ABSENT from
  `lidResponse.js` — MF#1: strong tune computed in the caller, threaded via `opts.stagnantTune`) +
  grep `lidResponse.js` (no `0.35`, `MOBILE_L` imported, NO `stagnantDriversToTune` symbol).
- **AC-TAXONOMY-NEPTUNE:** `npx vitest run tests/worldengine-v2-3-taxonomy.test.js`.
- **AC-ZERO-CLOBBER:** `npx vitest run tests/v2-0-byte-identity.test.js` (Frozen carve-out) + full
  `npx vitest run`; `git show --stat` each commit (diff scope = the in-scope files only; not-ours
  `CameraChoreographer.js`/`LabMode.js` + untracked pile excluded). **MF#3 — pin BOTH suite counts,
  not just failed-CASES:** the HEAD baseline is `Test Files 17 failed | 114 passed` AND `Tests 4
  failed | 1827 passed`. The 4 failed CASES are KnownObjects×3 + GalacticFeatures×1; the 17 failed
  FILES are those 2 case-bearing files + 15 `vendor/motion-test-kit/tests/*.test.js` that fail
  collection ("No test suite found in file") — 15-vendor count verified 2026-07-12. This flip ADDS
  ≥3 new test files (dispatch-oracle, taxonomy, plumbing/garble); a collection/import error in any
  of them surfaces as a Failed SUITE (Test-Files 17→18) WITHOUT bumping Tests-failed (stays 4), so a
  gate that pins ONLY the 4-case count reads green while the flip's own 17-oracle evidence is
  silently dead. Gate MUST assert **each newly-added test file collected and ran a nonzero test
  count** (primary — robust to vendor churn) AND Tests-failed stays == 4; backstop: Test-Files-failed
  does not grow beyond the enumerated 17 baseline.
- **AC-LIVE-SWEEP** (working-Claude, chrome-devtools on `127.0.0.1:9223`, Max-started
  `npm run dev -- --port 5175`): liveness via `list_pages` (never sandbox-curl); sweep ≥9 presets
  (Venus, Lava, Magma, Rocky, Ocean, Frozen, Eyeball, Mars, one giant) — `setPreset` → poll
  `_lastBodyDrivers` identity (~500ms settle) → read `magmaProbe`/`stagnantLidProbe`/`plateProbe`
  + the dispatch route; assert renders/probes unchanged EXCEPT Frozen (now despun zonal fallback),
  console clean of NEW errors; screenshot Frozen; **close all agent pages after** (window hygiene).
- **AC-UAT-SWEEP** (Max's gate, deferred-to-max): Max sweeps all 17; before/after Frozen
  screenshot pair; confirms every known world reads as before + Frozen reads as the intended fix.

---

## §10 — Contract ambiguities surfaced

1. **Mars "gains its archetype-map entry" (designDecision-MARS) vs the frozen 75-golden.** Adding
   Mars to `PRESET_ARCHETYPE` breaks `v2-0-byte-identity.test.js` (`names.length===15`,
   `Object.keys(PRESET_ARCHETYPE)` drives `computeAllHashes`) and would grow the "75-golden" to 85.
   **Resolution taken:** Mars joins the 17-oracle via `DRIVER_PRESETS` iteration (archetype=null),
   NOT `PRESET_ARCHETYPE`. Reading "gains its archetype-map entry" as "gains its adjudication row."
2. **Neptunian taxonomy — RESOLVED to Option B (MF#2).** Option A (distinct `'ice-giant'` key)
   would edit `src/core/ScaleConstants.js` (holds `RADIUS_RANGES_EARTH`, NOT driver-presets.js) AND
   bump the frozen `v2-0-preset-archetype.ad156cc.json` snapshot (`v2-0-slice-a-byte-safety.test.js:59`)
   — TWO files outside AC-ZERO-CLOBBER(g). Default is Option B (keep `'sub-neptune'` + doc comment,
   `driver-presets.js` only, byte-equal). Option A only on Max explicitly expanding (g) to enumerate
   both out-of-scope files — not a build-plan call.
3. **Guardrail-quartet membership:** `mustStayWorking` lists the quartet as {v2-0-byte-identity,
   lid-byte-anchors, e1-shadow-audit, planet-archetypes}, but AC-ZERO-CLOBBER (d) names the two
   repurposed tests as e1-shadow-audit **+ lid-router-audit** (the latter not in that quartet
   list). Treated both repurposings as required; byte-anchors + planet-archetypes stay green
   unchanged. Non-blocking (naming, not behavior).

---

## Lens resolution log (2026-07-12)

Three adversarial lenses (frozen / routing / guardrails). Guardrails returned NEEDS-FIX with 3
mustFixes; frozen + routing returned READY. All 3 mustFixes FOLDED (each independently re-verified
against the real code before folding). No mustFix rejected.

- **MF#1 — AC-PLUMB-RECONCILE(c) trips byte-anchors AC-TUNE-NULL (`worldengine-lid-byte-anchors.test.js:181`,
  `not.toMatch(/stagnantDriversToTune/)`).** VERIFIED: grep confirms `stagnantDriversToTune` is NOT
  in `lidResponse.js` today (it lives in rivers.js, stagnantLid.js, 2 test files); the plan's §3
  mandate to `import` it into `lidResponse.js` would make line 181 fail. byte-anchors is a named
  quartet member and NOT one of the two enumerated repurposings, so it must stay green unchanged —
  a THIRD repurposing (finding's option a) would contradict AC-ZERO-CLOBBER(d)'s "No other guardrail
  edit" and need a contract amendment. **RESOLVED via option (b):** compute
  `stagnantTune = stagnantDriversToTune(bodyDrivers)` in the CALLER (`unbrokenLid()` in rivers.js —
  already imports it) and thread it into `writeLidResponseSphere` via `opts.stagnantTune`; the router
  passes `tune: opts.stagnantTune ?? null` and sets `stagnantDiag.appliedTune` from it. The builder
  symbol never enters `lidResponse.js`. Byte-inert (Venus tune=null, `void drivers`) and grep-clean.
  Amended §1 (delegation + rewrote the wrong "anchor proves Venus" claim), §3 (Slice-A lidResponse
  bullet + Golden-green reasoning), §4 (Slice-B rivers.js caller), §9 (AC-PLUMB verify).

- **MF#2 — Neptunian Option A edits `src/core/ScaleConstants.js` (outside AC-ZERO-CLOBBER(g)) + bumps
  the frozen `v2-0-preset-archetype.ad156cc.json`.** VERIFIED: `RADIUS_RANGES_EARTH` is at
  `src/core/ScaleConstants.js:67` (NOT driver-presets.js); (g)'s enumerated list omits ScaleConstants.js;
  `v2-0-slice-a-byte-safety.test.js:59` freezes `PRESET_ARCHETYPE` via `toEqual(PA_SNAPSHOT)`.
  **RESOLVED:** defaulted Slice C to Option B (keep shared `'sub-neptune'` key + doc comment in
  driver-presets.js only — byte-equal, in-scope); removed ScaleConstants.js from §8's file list;
  Option A retained ONLY as a Max-gated path requiring explicit (g) expansion. Amended §8 + §10 #2.

- **MF#3 — full-suite gate pins only "4 known failures," but `npx vitest run` reports 17 FAILED
  FILES; a new broken/empty test file would hide.** VERIFIED: 15 `vendor/motion-test-kit/tests/*.test.js`
  are present and fail as suites (baseline "17 failed files | 4 failed tests" per the lens's suite
  run; 15-vendor component corroborated 2026-07-12). Since the flip adds ≥3 new test files, a
  collection error bumps Test-Files (17→18) without bumping Tests-failed (stays 4). **RESOLVED:** §9
  gate now asserts each newly-added test file collected+ran a nonzero test count (primary) AND
  Tests-failed == 4, with Test-Files-failed ≤ 17 baseline as backstop. Amended §9 AC-ZERO-CLOBBER.

---

## Known risks (non-must-fix; mitigation slice named)

- **R1 (frozen, golden-critical wording) — the §1 "byte-anchor already PROVES Venus" claim was
  FALSE.** The anchor's Venus direct side uses `grainDrivers` + no tune, unlike today's `writeBodyRelief`
  Venus call. Venus survives by (a) `STRONG_REGIME==='venus-stagnant-lid'===stagnantLidRegimeOf('stagnant-lid')`,
  (b) `writeStagnantLidReliefSphere` `void drivers`, (c) `stagnantDriversToTune(Venus golden)===null`
  + the Slice-A/B threading. **CORRECTED IN §1** (not merely logged) so a builder cannot skip the
  threading. Mitigation: Slice A/B. Lava/Magma DO survive via the anchor (weak-side matches).

- **R3 (frozen, harness rewrite) — the byte-identity rewrite could drop the meta test
  (`names.length===15` / count===75) and the tune-null anchor `describe`.** Mitigation: §5 now
  mandates retaining both verbatim and special-casing ONLY `name==='Frozen (airless)'`. Slice B.

- **RT1 (routing, latent fragility) — (3c) `isUnbrokenLidPath` vs `classifyLidPath` coupling.**
  `isUnbrokenLidPath`'s `hotSurfaceStagnant` gate ignores `rawTidal`; `classifyLidPath`'s pure-strong
  cut requires `rawTidal<SHOULDER_LO`. They agree only because `computeE1` data-places `stagnant` at
  `L>=L_STRONG` solely via the `rawTidal<SHOULDER_LO` cut. A (3c) body admitting `rawTidal>=SHOULDER_LO`
  would silently route to the mixed COMPOSER. Inert today (Venus rawTidal≈0). Mitigation: §4 17-oracle
  now asserts every (3c) body classifies pure-strong. Slice B.

- **RT2 (routing, spec gap) — the §1 dispatch snippet doesn't show how V/T feed (3d) `modalRegime(V,T)`.**
  Mitigation: §4 pins `V=cv.composition.volatileFraction` (=`e1.V`), `T=cv.T_eq` (matches the V2-1
  oracle `writerE1`); any other sourcing (e.g. seeded `e1.geodynamicRegime`) breaks seed-invariance.
  Slice B.

- **RG1 (guardrails) — router-audit re-pin is a REWRITE handling BOTH call sites.** Post-flip the
  first `writeLidResponseSphere(` occurrence is the new production `unbrokenLid()` call (~rivers.js:480),
  preceding the `labLidOverride` seam (~:1233); the 600-char window loses `labLidOverride`, breaking
  the current guard; and the "base writers call no router" invariant is a NEW scan to author.
  Mitigation: §4 repurposing #2 rewritten to spell this out. Slice B.

- **RG2 (guardrails) — Mars contradicts the literal contract.** designDecision-MARS says Mars "gains
  its archetype-map entry," but `v2-0-slice-a-byte-safety.test.js:50` asserts `PRESET_ARCHETYPE`
  `not.toHaveProperty('Mars (arid rocky)')` and the 75-golden iterates `Object.keys(PRESET_ARCHETYPE)`
  — adding Mars would break both and grow the golden to 85. Plan resolves oracle-row-only (§10 #1);
  a defensible reading but a deliberate deviation from literal contract text — **needs Max's explicit
  sign-off**, not a build-plan reinterpretation. Slice C.

- **RG3 (guardrails) — after repurposing #1 removes rivers.js from the shadow-audit list, the AC-0
  grep is the SOLE label-freeness guard on the new dispatch.** Mitigation: §4 AC-0 grep-audit now
  scoped to the exact `if (bodyDrivers?.condition)` routing region (function-body slice, not
  whole-file). Slice B.

- **R-GARBLE (routing, confirmed sound) — the condition-bearing dispatch reads cv + computeE1 output
  only, NEVER `PRESET_ARCHETYPE`; `deriveConditionVector` reads `fp` directly.** So garbling
  `PRESET_ARCHETYPE` cannot alter any derived route or the condition vector, and `drawPresetRadius`
  legitimately remains its only consumer. Already reflected in §4 garble test + R-GARBLE note.
