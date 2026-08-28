// src/worldengine/dispatch/bodyRelief.js
// THE PRODUCTION RELIEF DISPATCH — moved here from planet-lod-rivers.js:624 on 2026-08-28.
//
// WHY IT MOVED, and why it is THIS function and not the file around it. The province half of the
// ground palette (uCratonColor / uFreshColor / uSedColor, planetShaders.glsl.js:573) is gated on
// `provSum > 0.001`, and provSum comes from a province cube the GAME has never baked — because
// carrier.province is written inside this dispatch, and NOTHING under src/ could reach it. The
// blocker was read as "planet-lod-rivers.js (108 KB, 24 exports) must move first"
// (one-pipeline-two-frontends-PLAN.md:576, "still its own step").
//
// ⭐ MEASURED 2026-08-28, and the measurement is why this is a small commit rather than that step:
// over its own 122 lines, writeBodyRelief calls TWENTY-TWO imported functions, every one of them
// already living under src/worldengine/base/, and exactly ONE module-scope binding local to
// planet-lod-rivers.js — DEFAULT_GRAIN_DRIVERS, a three-key frozen literal. It touches no THREE
// symbol, no ConvexHull, no renderer, no mesh builder. So the dispatch was never coupled to the
// river module at all; it was only PARKED there. It moves alone, three-free, and the 108 KB file
// move stays a separate, still-unrun step.
//
// ⛔ THE FUNCTION IS BYTE-VERBATIM. Not a rewrite, not a tidy-up — the identical 122 lines, so the
// 75-golden byte fixtures, Instrument B and Instrument C all measure the SAME code they measured
// yesterday. planet-lod-rivers.js imports it back and re-exports it (the featureScale.js precedent,
// src/worldengine/base/featureScale.js:6-9), so every existing caller — the lab, ~40 test suites —
// keeps its import path unchanged.
//
// ⚠ ONE TEST HAD TO MOVE WITH IT, AND ITS AUTHOR HAD ALREADY DEFENDED THE MOVE.
// tests/worldengine-v2-3-dispatch-oracle.test.js slices this function by TEXT SEARCH —
// `indexOf('function writeBodyRelief')` — and that search now returns -1 against planet-lod-rivers.js.
// The obvious fear is a vacuous pass: -1 → `.slice(-1)` → the file's last byte → an AC-0 label-free
// grep that scans one character and reports green. ⭐ MEASURED, NOT ASSUMED: it does NOT do that. The
// line above the slice is `expect(fnStart, 'writeBodyRelief found').toBeGreaterThan(-1)`, and the
// move reds it loudly — "expected -1 to be greater than -1". So this was a RE-POINT, not a repair,
// and the guard that made it one stays exactly where it is.
//
// ⭐ AND THE RE-POINT CARRIES ITS OWN LIVENESS PROOF, because a grep that has followed its subject to
// a new file is indistinguishable from a grep that has stopped looking. SABOTAGE PROBE, run 2026-08-28:
// inject `const _sabotage = 'PRESET_ARCHETYPE';` beside the computeE1 call in the dispatch below and
// the AC-0 assertion reds on exactly that pattern — 25 of the suite's 26 tests still PASS, so the
// module still loads and the suite still runs, and the one failure is the grep itself.
// ⛔ THE FIRST ATTEMPT AT THIS PROBE WAS VACUOUS AND IS RECORDED HERE SO IT IS NOT REPEATED: the
// sabotage was written as a BARE identifier, which is a ReferenceError, so the module failed to import
// and vitest reported "no tests". A red from a file that never loaded proves nothing about the grep.
// The sabotage has to be something the module can execute.
//
// ⭐ WHY `dispatch/` AND NOT `base/`, and the audit is what settled it. The first attempt put this file
// in src/worldengine/base/ and tests/worldengine-e1-shadow-audit.test.js:69 went red on it: that suite
// scans EVERY .js under base/ (bar e1Regime.js and lidResponse.js) and asserts none of them imports
// computeE1 — "the base/ WRITERS stay E1-blind: writers consume args, never the tuple" (:40). This
// function is the opposite of E1-blind; deriving the route from the E1 tuple is its entire job. Adding a
// third exception to that scan would have traded a real architectural boundary for one commit's
// convenience. So the file went to its own layer instead, and the audit's invariant is untouched:
// base/ writers stay E1-blind, and the ONE thing above them that rules on E1 lives here.
//
// DELIBERATE NON-GOALS: this file does NOT bake anything, does not touch the GPU, and does not make
// the game run the dispatch. Wiring the game's province cube is the next step and needs two more
// pieces that are NOT here — the sphere mesh builder (buildIrregularSphere, three-coupled but
// GPU-free) and the province cube baker (createProvinceCube, genuinely GPU-coupled, and therefore
// bound for src/rendering/bake/ under the carried C25 ruling).

import { computeE1, inSeededBand, modalRegime } from '../base/e1Regime.js';
import { driversToTune, writePlateUpliftSphere } from '../base/plates.js';
import { shellDriversToTune, writeShellReliefSphere } from '../base/shellRelief.js';
import { stagnantDriversToTune, writeStagnantLidReliefSphere } from '../base/stagnantLid.js';
import { isUnbrokenLidPath, writeLidResponseSphere } from '../base/lidResponse.js';
import { writeGrainSphere, writeHeightSphere } from '../base/tectonic.js';
import { writeAccommodation, initSedimentHost } from '../base/hostChannels.js';
import { writePassiveMargins } from '../base/passiveMargins.js';
import { writeProvince } from '../base/province.js';
import { writeBombardment, craterSchedule } from '../base/bombardment.js';
import { deriveSurfaceMaterial } from '../base/surfaceMaterial.js';
import { deriveFigureDescriptor } from '../base/bodyFigure.js';
import { deriveReliefBudget } from '../base/reliefBudget.js';

// The neutral E6 grain drivers. MOVED here with the dispatch (it is this function's only local
// binding); planet-lod-rivers.js imports it back and re-exports it, so `import { DEFAULT_GRAIN_DRIVERS }
// from './planet-lod-rivers.js'` keeps working for the lab and every existing test.
export const DEFAULT_GRAIN_DRIVERS = Object.freeze({ despinAmp: 1, radialStrainSign: 1, radialStrainMag: 0 });

export function writeBodyRelief(carrier, {
  // V2-0 Slice C: bodyDrivers carries a NESTED `bodyDrivers.condition` sub-object (the body condition-
  // vector). V2-3 (THE DISPATCH FLIP) made it the SOLE routing input: routing derives from computeE1's
  // {compositionClass, geodynamicRegime, shellSubRegime, m_hp} + dispatch-level locked-awareness — NEVER
  // an archetype string. The PRESET_ARCHETYPE migration bridge (the condition-less archetype chain) was
  // RETIRED (world-engine-preset-archetype-retirement, 2026-07-13): condition-less input now THROWS
  // loudly (below) instead of falling back. `locked` is destructured as argLocked: the condition-bearing
  // branch reads the NESTED condition.tidalState.locked (AC-PLUMB-RECONCILE a) with the argument as fallback.
  locked: argLocked = false, grainDrivers = DEFAULT_GRAIN_DRIVERS, bodyDrivers = null, macroSeed = 0, heightSeed = 'e6:0', T_eq = null,
} = {}) {
  if (bodyDrivers?.condition) {
    // ═══ V2-3 CONDITION-BEARING DERIVED DISPATCH (BUILD-PLAN §1) — label-free by construction ═══
    // The routing decision reads ONLY: the condition vector, computeE1's derived tuple, macroSeed, and the
    // dispatch-level locked flag. The AC-0 grep-audit (worldengine-v2-3-dispatch-oracle.test.js) slices
    // exactly this block and asserts it reads no archetype string, no e1 label, no label-keyed resolver.
    const cond = bodyDrivers.condition;
    const locked = cond.tidalState?.locked ?? argLocked;   // NAMED consumer (AC-0 ch.2): condition.tidalState.locked → locked-awareness + T_ss
    const e1 = computeE1(cond, macroSeed);
    const cls = e1.compositionClass;
    const rawTidal = cond.rawTidalIoRatio ?? 0;
    const T_ss = locked ? (T_eq ?? 0) * 1.4 : 0;           // shipped F41 convention, unchanged (the Lava-pond/Magma-basin split)

    // ── writer helpers: each calls the SAME writer with the SAME args as the bridge chain below, so every
    //    route-identical preset stays BIT-identical (BUILD-PLAN §1 writer-argument fidelity table). ──
    const plate = () => {
      const plateDiag = writePlateUpliftSphere(carrier, bodyDrivers, { macroSeed, tune: driversToTune(bodyDrivers) });
      return { path: 'plate', plateDiag, shellDiag: null, magmaDiag: null, stagnantDiag: null };
    };
    const shell = (regime) => {
      // V2-5s (shell driver-response): body D-vector → `tune` via shellDriversToTune(bodyDrivers, regime),
      // anchored per regime (null at each REF → the shipped icy presets render byte-identical). bodyDrivers
      // REPLACES grainDrivers as the drivers arg — byte-safe, the writer voids it. `regime` is this helper's own
      // in-scope derived-context param (no preset-string / resolver read here — the dispatch-oracle grep on this
      // block forbids them).
      const shellTune = shellDriversToTune(bodyDrivers, regime);
      const shellDiag = writeShellReliefSphere(carrier, bodyDrivers, { macroSeed, regime, tune: shellTune });
      shellDiag.appliedTune = shellTune;
      return { path: 'shell', plateDiag: null, shellDiag, magmaDiag: null, stagnantDiag: null };
    };
    const despun = () => {
      writeGrainSphere(carrier, grainDrivers);            // precondition: grain before height
      writeHeightSphere(carrier, {}, grainDrivers, { name: 'tectonic-build' }, heightSeed);
      return { path: 'despun', plateDiag: null, shellDiag: null, magmaDiag: null, stagnantDiag: null };
    };
    const unbrokenLid = () => {
      // The unbroken-lid family (heat-pipe / hot-high-L stagnant) delegates to the V2-2a router's
      // byte-preserved corners. MF#1: the strong tune is COMPUTED HERE IN THE CALLER (rivers.js already
      // imports the builder) and threaded via opts.stagnantTune — the router itself never names the builder
      // (worldengine-lid-byte-anchors.test.js AC-TUNE-NULL stays green untouched).
      const stagnantTune = stagnantDriversToTune(bodyDrivers);
      const lidRes = writeLidResponseSphere(carrier, bodyDrivers, { e1, rawTidal, macroSeed, locked, T_ss, grainDrivers, stagnantTune });
      // Re-wrap the router's return to writeBodyRelief's shape (probe parity: _lab.magmaProbe /
      // stagnantLidProbe read the identical path strings + diag fields they read today).
      if (lidRes.path === 'lid-weak') return { path: 'volcanic', plateDiag: null, shellDiag: null, magmaDiag: lidRes.magmaDiag, stagnantDiag: null };
      if (lidRes.path === 'lid-strong') return { path: 'stagnant-lid', plateDiag: null, shellDiag: null, magmaDiag: null, stagnantDiag: lidRes.stagnantDiag };
      // Unreachable from rules (3a)/(3c) for real bodies (RT1 — pinned by the 17-oracle's classifyLidPath
      // assertion); surfaced honestly rather than masked if a future tuple ever lands here.
      return { path: lidRes.path, plateDiag: null, shellDiag: null, magmaDiag: null, stagnantDiag: null };
    };
    const stagnantLidDirect = () => {
      // In-band modal-'stagnant' collapse target (contract MF-6 pinned map): the SAME direct writer call as
      // the bridge chain below, regime resolved COORDINATE-free as the single strong-lid constant (the
      // router's STRONG_REGIME value) — never the label-keyed resolver.
      const stagnantTune = stagnantDriversToTune(bodyDrivers);
      const stagnantDiag = writeStagnantLidReliefSphere(carrier, bodyDrivers, { macroSeed, regime: 'venus-stagnant-lid', tune: stagnantTune });
      stagnantDiag.appliedTune = stagnantTune;
      return { path: 'stagnant-lid', plateDiag: null, shellDiag: null, magmaDiag: null, stagnantDiag };
    };

    // ── the derived rule chain (BUILD-PLAN §1; ordering is LOAD-BEARING) ──
    // V2-4 §0 SEAM (IIFE-capture): the 9-way early-return chain resolves through the five closures above, each
    // finalizing carrier.height BEFORE it returns — so there is NO reachable "before the return" point after the
    // chain. Capture the chain in an inner IIFE (verbatim & unchanged inside; every existing return intact), then
    // post-write the byte-inert host channels on the now-finished carrier. The captured object IS exactly the
    // closure's result (plateDiag / probe parity preserved), returned unchanged below.
    const relief = (() => {
    // (1) composition terminals: gas / carbon → despun (Gas×3, Sub-Neptune, Carbon — and HOT JUPITER, the
    //     adjudicated reroute #2: today archetype-null + locked lands it on the shell locked-fallback).
    if (cls === 'gas' || cls === 'carbon') return despun();
    // (2) icy: a cryo-ACTIVE shell keeps its condition-derived sub-regime (Europa 'icy-active' ≠ Titan
    //     'volatile-cold' — distinct REGIME_WEIGHTS, §7); dead-lid icy → despun (FROZEN, the adjudicated
    //     reroute #1; Crystal stays despun as today).
    if (cls === 'icy') {
      if (e1.geodynamicRegime === 'icy') return shell(e1.shellSubRegime);
      return despun();
    }
    // (3) rocky:
    // (3a) heat-pipe BEFORE (3b) locked: Lava/Magma are LOCKED heat-pipes — today's SHELL_EXCLUDE has
    //      'lava', so a locked lava body falls THROUGH the shell locked-fallback to volcanic; (3a)-first
    //      mirrors that exactly (else they would wrongly take eyeball-despun).
    if (e1.m_hp > 0) return unbrokenLid();                 // → router pure-weak → writeMagmatismSphere
    // (3b) locked BEFORE (3d) in-band: Eyeball (in-band, modal mobile) must stay eyeball-despun
    //      byte-identical — dispatch-level locked-awareness is the V2-1 oracle's "today wins" disposition
    //      (computeE1 stays locked-BLIND; the sub-tag comes from THIS layer, never from the tuple).
    if (locked) return shell('eyeball-despun');
    // (3c) hot-high-L unbroken lid (Venus, data-placed) → router pure-strong → writeStagnantLidReliefSphere
    if (isUnbrokenLidPath(e1)) return unbrokenLid();
    // (3d) seeded temperate-wet band → seed-free MODAL collapse (contract designDecision #1). V/T are
    //      sourced from the CONDITION VECTOR (V = composition.volatileFraction, T = T_eq — RT2), NEVER the
    //      seeded e1.geodynamicRegime, so no named preset's writer choice can change with seed.
    if (inSeededBand(cond)) {
      const V = cond.composition?.volatileFraction ?? 0.15, T = cond.T_eq ?? 288;
      return modalRegime(V, T) === 'stagnant' ? stagnantLidDirect() : plate();   // pinned {mobile,episodic}→plate
    }
    // (3e) out-of-band mobile/broken lid → plate
    if (e1.geodynamicRegime === 'mobile') return plate();
    // (3f) dead-lid rocky (Mars) → despun
    return despun();
    })();
    // ── V2-4 POST-DISPATCH WRITES (BUILD-PLAN §0 seam) — byte-inert: touch only the unhashed host channels ──
    writeAccommodation(carrier);   // slice 1: sink-ranking read of the now-finished carrier.height → accommodation ∈ [0,1]
    initSedimentHost(carrier);     // slice 1: zero the sediment host (pristine bedrock; V2-8 deposits later)
    if (relief.plateDiag) writePassiveMargins(carrier, relief.plateDiag, bodyDrivers, { macroSeed });   // slice 3: plate path only — writes only the unhashed shelfDepth channel (carrier.height untouched)
    writeProvince(carrier, { seed: macroSeed });   // slice 4: UNIVERSAL (every path) — reads accommodation (order after writeAccommodation is load-bearing); writes only the unhashed Uint8Array province channel
    writeBombardment(carrier, cond, { macroSeed });   // V2-5: UNIVERSAL — self-gates on cond scalars (airless+dead+cold); writes only the unhashed signed craterField (byte-inert; new alea 'bombard:' stream); route() composites at render
    relief.figure = deriveFigureDescriptor(cond);   // slice 5: E2-figure descriptor — a return-object field (NOT a carrier array), pure fn of the condition vector, draws no RNG ⇒ byte-inert; populated on EVERY dispatch path
    relief.surfaceMaterial = deriveSurfaceMaterial(cond, craterSchedule(cond));   // V2-6 S3/S4: material channel { iceness, crystallizationPotential, regolithRoughness } — same return-object idiom as relief.figure (no carrier array, no RNG ⇒ byte-inert), populated on EVERY dispatch path. S4 (§1F): crystallizationPotential rides here as a downstream driver; the lab facet-wiring flip is deferred-to-adjudication (Lens L9)
    relief.reliefBudget = deriveReliefBudget(cond, craterSchedule(cond));   // Inc-3b S1: condition-pure relief-variance budget { inDomain, f_I, w_e, w_i } — same return-object idiom (no carrier array, no RNG ⇒ byte-inert), TOTAL (identity outside domain, never throws). route() threads it into compositeMargins(carrier, budget) at the composite seam; craterSchedule(cond) is pure so calling it twice here is byte-identical.
    return relief;
  }
  throw new Error('writeBodyRelief: bodyDrivers.condition is required — the PRESET_ARCHETYPE migration bridge was retired (world-engine-preset-archetype-retirement, 2026-07-13). Every production/lab caller must pass a condition-bearing bundle.');
}
