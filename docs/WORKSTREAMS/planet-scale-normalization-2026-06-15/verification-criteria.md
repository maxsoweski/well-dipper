# Footprint fan-out — pass/fail criteria (testable per feature)

> Companion to `contract.json` (AC1/AC2/AC9). Defines the objective, machine-checkable PASS/FAIL
> gate used as each footprint feature is converted to real-units km. Run by working-Claude after
> each implementation batch and by verification subagents (each on its **own** lab page — the
> objective harness mutates `state.planetRadiusEarth`, so parallel runs on one shared page race).

## Why the objective layer is sufficient for "preserve"
`featureFrequencyFromKm(RE, sizeKm, C) = C * RE*6371 / sizeKm`. With `C=1` and the default
`sizeKm = round(6371 / F0)` (F0 = the feature's pre-change frequency), the derived uniform at
**RE=1** equals F0 to within integer-rounding error. **Same uniform value ⇒ byte-identical shader
output.** So an exact uniform match at RE=1 *is* the proof the look is unchanged — a screenshot adds
nothing. The visual layer (V*) is only a smoke check that the feature still draws and shrinks.

## Per-feature table (C=1; preserve unless flagged)
| feature | uniform | sizeKm var | F0 (old freq) | default km | type |
|---|---|---|---|---|---|
| craters ✅ | uCraterScale | craterSizeKm | 6.0 | 530 | flagged-down (done c32374d) |
| lava region ✅ | uLavaScale | lavaSizeKm | 1.4 | 4551 | preserve (fd3aa70) |
| lava cracks ✅ | uCrackScale | crackSizeKm | 9.0 | 708 | preserve (fd3aa70) |
| edifices ✅ | uEdificeScale | edificeSizeKm | 3.0 | 2124 | preserve (fd3aa70) |
| chaos rafts ✅ | uChaosCellScale | chaosSizeKm | 5.0 | 1274 | preserve · fuzzy (fd3aa70) |
| crystal facets ✅ | uFacetScale | facetSizeKm | 4.0 | 1593 | preserve (fd3aa70) |
| basalt hex ✅ | uHexScale | hexSizeKm | 1.6 | 3982 | preserve (fd3aa70) |
| shatter blocks | uShatScale | shatSizeKm | 1.6 | 3982 | preserve · fuzzy |
| karst dolines | uKarstDolineFreq | karstDolineSizeKm | 9.0 | 708 | preserve |
| ecu district | uEcuDistrictScale | ecuDistrictSizeKm | 2.4 | 2655 | preserve · fuzzy |
| ecu block | uEcuBlockScale | ecuBlockSizeKm | 8.0 | 796 | preserve · fuzzy |
| sub pit | uSubPitScale | subPitSizeKm | 8.0 | 796 | preserve |
| sub polygon | uSubPolyScale | subPolySizeKm | 4.0 | 1593 | preserve |
| dunes | uDuneFreq | duneSizeKm | 16.0 | 398 | preserve |
| **rivers** | uFluvialFreq | fluvialSizeKm | 2.3 | **1385** | **flagged-down → freq ≈4.6 (~2× crater rule)** |
| outflow channels | uOutflowFreq | outflowSizeKm | 0.5 | 12742 | preserve (intentional large arcs) |

## Objective invariants (the gate — all must PASS)
For each converted feature with uniform `U`, sizeKm var `K`, default km `Kd`, old freq `F0`:

- **P1 PRESERVE@RE1** — set `state.planetRadiusEarth=1`, wait 2 frames: `U.value ≈ 6371/Kd` within
  ±0.5%. (preserve features: this also ≈ F0 within ±1%.)
- **P2 LINEAR-IN-RADIUS** — for r ∈ {0.5, 2, 3}: `U.value@RE=r / U.value@RE=1 ≈ r` within ±1%.
  (bigger planet ⇒ higher frequency ⇒ smaller + more numerous footprint.)
- **P3 INVERSE-IN-SIZE** — at fixed RE, doubling `state[K]` halves `U.value` within ±1%.
- **P4 FINITE-POSITIVE** — `U.value` finite and > 0 across the whole RE sweep (0.3..16).
- **P5 FLAGGED-DOWN (rivers only)** — `uFluvialFreq.value@RE1 > 2.3` (footprint came down vs old).

File-level (run once per batch, not per feature):
- **P6 BACKTICK-PARITY** — `grep -o '`' world-engine-lab.html | wc -l` is **even** (baseline 122).
- **P7 UNIT-GATE** — `npx vitest run tests/planet-scale.test.js tests/planet-archetypes.test.js tests/feature-associations.test.js` → 49/49 (+ generation guard 85/85 if core/src touched; not touched here).
- **P8 NO-ORPHAN-SYNC** — no `uniforms.U.value = state.<oldFreqVar>;` line survives for a converted U
  (grep: every converted U sync line calls `featureFrequencyFromKm`).

## Visual smoke layer (V — secondary; subagent, screenshots to disk)
Per feature, on its home preset with the feature visibly rendering:
- **V1 DRAWS** — RE=1 render is non-blank and shows the feature (not a dead/flat sphere).
- **V2 SHRINKS** — RE=3 render pixel-diffs from RE=1 by ≥3% and feature elements read smaller/more
  numerous. (Implied by P2; V2 is the belt-and-suspenders human-visible confirmation.)
Home presets: rivers→Rocky/Ocean · dunes→Mars/arid · sub pit+poly→Frozen/comet · ecu→ecumenopolis ·
shatter→exotic(Carbon) · karst→Rocky karst · (lava→Lava, facets/hex→Crystal/Frozen — batch 1).

## Reusable objective harness (run via chrome-devtools evaluate_script, own page)
```js
async (FEATURES) => {
  const L = window._lab, u = L.uniforms, s = L.state;
  const frame = () => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const setRE = async (re)=>{ s.planetRadiusEarth = re; await frame(); };
  const out = [];
  for (const f of FEATURES) {           // f = {uniform, sizeKmVar, F0, Kd, flaggedDown?}
    const U = u[f.uniform]; const res = {feature:f.uniform, pass:true, checks:{}};
    await setRE(1); const v1 = U.value;
    res.checks.P1 = Math.abs(v1 - 6371/f.Kd)/(6371/f.Kd) <= 0.005;
    let lin = true; for (const r of [0.5,2,3]){ await setRE(r); lin = lin && Math.abs(U.value/v1 - r) <= 0.01; }
    res.checks.P2 = lin;
    await setRE(1); const base=U.value, k0=s[f.sizeKmVar]; s[f.sizeKmVar]=k0*2; await frame();
    res.checks.P3 = Math.abs(U.value/base - 0.5) <= 0.01; s[f.sizeKmVar]=k0; await frame();
    let fin=true; for (const r of [0.3,1,8,16]){ await setRE(r); fin = fin && isFinite(U.value) && U.value>0; }
    res.checks.P4 = fin;
    if (f.flaggedDown){ await setRE(1); res.checks.P5 = U.value > f.F0; }
    await setRE(1);
    res.pass = Object.values(res.checks).every(Boolean);
    out.push(res);
  }
  return out;
}
```
PASS = every feature's `pass===true`. Any `false` → report which P# failed + the measured value.
