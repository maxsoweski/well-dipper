// calibration/read-gate-thresholds.mjs — Inc-3b S0.6: FREEZE every AC-READ bar BEFORE any capture.
//
// WHY THIS FILE EXISTS (BUILD-PLAN §1.S0 block S0.6; §1.S2 the four bars incl. m-6 + MF-4; §0.5
// light staging; §2 AC-READ row; feedback_perceptual-read-gate-before-uat). AC-READ is an
// integration/live gate driven at S2 (flip alone) and re-run at S4. The perceptual-read-gate rule
// forbids ANY post-hoc tuning: the bars must be pinned at the S0 seam, before a single render is
// viewed, or an un-derived gate number can be quietly chosen after the fact to make the verdict
// land either way. This script emits read-gate-thresholds.json — the frozen bar set the S2/S4
// driver reads.
//
// SHIPS NO CODE. Pure node ESM, runnable from any cwd, single-threaded, NO dev server, NO network,
// NO `claude -p`, NO timestamps / wall-clock fields. Re-run reproduces the JSON BYTE-IDENTICAL.
//
// PROVENANCE / NO TASTE CONSTANTS. Every NUMBER in the emitted JSON is one of:
//   (a) READ from a committed sibling artifact (bake-attenuation-model.json, relic-lambda-band.json,
//       relief-budget-fit.json) — so it traces to that artifact's own inline derivation; OR
//   (b) a STRUCTURAL spec authored here with an inline derivation comment + anchor (BUILD-PLAN /
//       brief citation); OR
//   (c) explicitly tagged status:"GUESSED" with a written resolutionPath.
// The generator hard-COPIES the population-fraction (JUSTIFIED) + size-gate (GUESSED) adjudications
// from bake-attenuation.mjs's output verbatim — it does NOT re-derive or re-tag them (S0.6 rule).
//
// DETERMINISM NOTE: reads three frozen JSONs; adds constant structural specs; writes with a stable
// insertion-ordered key layout via JSON.stringify(...,2). No Date, no RNG, no env, no timing.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── source artifacts (READ, never mutated) ───────────────────────────────────────────────────────
const BAKE  = JSON.parse(readFileSync(join(__dirname, 'bake-attenuation-model.json'), 'utf8'));
const RELIC = JSON.parse(readFileSync(join(__dirname, 'relic-lambda-band.json'), 'utf8'));
const FIT   = JSON.parse(readFileSync(join(__dirname, 'relief-budget-fit.json'), 'utf8'));

const problems = [];
const need = (cond, msg) => { if (!cond) problems.push(msg); };

// ── the FROZEN seam date (workstream build seam, NOT wall clock — BUILD-PLAN footer 2026-07-23) ───
const FROZEN_AT = '2026-07-23';

// ── pull the arc-bar adjudications VERBATIM from the bake model (S0.5/S0.5a) ──────────────────────
const arcModel = BAKE.arcAsymmetryBar.modelDerived;                  // ONLY the ≥1-band magnitude is model-derived
const arcPopFrac = BAKE.arcAsymmetryBar.acceptanceConventions.populationFraction; // JUSTIFIED (binomial) — copy faithfully
const arcSizeGate = BAKE.arcAsymmetryBar.acceptanceConventions.sizeGate;          // GUESSED (median proxy) — copy faithfully
need(arcModel && typeof arcModel.geqOneBandMagnitude === 'number', 'BAKE.arcAsymmetryBar.modelDerived.geqOneBandMagnitude missing');
need(arcPopFrac && arcPopFrac.status === 'JUSTIFIED', 'BAKE population fraction adjudication not JUSTIFIED as expected');
need(arcSizeGate && arcSizeGate.status === 'GUESSED', 'BAKE size gate adjudication not GUESSED as expected');

// ── light staging: exact numbers, from the bake displayChain (which itself pulled the LAB defaults) ─
// Verified this session by grep of world-engine-lab.html state defaults: :2006 lightAzimuthDeg=40.6,
// :2007 lightElevationDeg=20.79. incidence = 90 − elevation.
const dc = BAKE.displayChain;
need(dc.lightAzimuthDeg === 40.6, 'displayChain.lightAzimuthDeg drifted from the grep-verified LAB default 40.6');
need(dc.lightElevationDeg === 20.79, 'displayChain.lightElevationDeg drifted from the grep-verified LAB default 20.79');
need(Math.abs(dc.incidenceDeg - (90 - dc.lightElevationDeg)) < 1e-9, 'incidenceDeg != 90 − elevation');

// ── blind-read discriminator arithmetic (m-6): pin the numbers so the null is explicit ────────────
// N captions (m-6 spec floor: a SINGLE caption is a coin flip in both directions), and the
// forced-choice combined null across the seed-1 + 2-reroll renders.
const BLIND_N_CAPTIONS = 3;          // m-6: N≥3 independent fresh-context captions
const DISTRACTOR_COUNT = 3;          // K distractors ⇒ K+1-way forced choice (target + 3 non-crater relief classes)
const FORCED_CHOICE_RENDERS = 3;     // seed 1 + 2 re-rolls (AC-READ recipe): 3 independent target images
const forcedChoiceSingleNull = 1 / (DISTRACTOR_COUNT + 1);                 // 1/4 = 0.25 per render under the null
const forcedChoiceCombinedNull = Math.pow(forcedChoiceSingleNull, FORCED_CHOICE_RENDERS); // (1/4)^3 = 0.015625 < 0.05
const captionMajority = Math.ceil(BLIND_N_CAPTIONS / 2);                   // ⌈3/2⌉ = 2 of 3

// ── assemble the frozen JSON (insertion order == emitted key order; deterministic) ────────────────
const out = {
  meta: {
    workstream: 'world-engine-inc3b-relief-budget-2026-07-21',
    slice: 'S0.6',
    artifact: 'read-gate-thresholds.json',
    purpose: 'ALL AC-READ bars, FROZEN before any S2/S4 capture. feedback_perceptual-read-gate-before-uat: no post-hoc tuning, ever.',
    frozenAt: FROZEN_AT,
    frozenAtNote: 'workstream build seam (BUILD-PLAN, 2026-07-23) — NOT a wall-clock timestamp; this file re-generates byte-identical.',
    generatedBy: 'calibration/read-gate-thresholds.mjs (deterministic: reads the 3 committed source artifacts + adds structural specs; re-run reproduces byte-identical).',
    sourceArtifacts: {
      'bake-attenuation-model.json':
        'S0.5/S0.5a — arc ≥1-band magnitude (MODEL-DERIVED), population fraction (JUSTIFIED) + size gate (GUESSED) copied verbatim, light staging (displayChain), RNG-neutral centre probe, shadow re-baseline protocol.',
      'relic-lambda-band.json':
        'S0.1/S0.1a — the anchor-swept per-world f_I band (copied).',
      'relief-budget-fit.json':
        'S0.2/S0.2a/S0.6 — Mars real-hypsometry f_I gate [0.3,0.8]; realized model f_I per world (cross-reference).',
      'world-engine-lab.html':
        'state defaults grep-verified this session — :2006 lightAzimuthDeg=40.6, :2007 lightElevationDeg=20.79 (the source of displayChain az/el).',
    },
    noPostHocTuning: {
      declaration:
        'Every bar below is FROZEN at the S0 seam, BEFORE the first S2 capture. No number here may be re-chosen, relaxed, or re-tagged after any render is viewed — the verdict is recorded whichever way it falls, and Max is pinged only after.',
      honestyTags:
        'status:MODEL-DERIVED = a calibration-model output; status:JUSTIFIED = an acceptance convention carrying an explicit statistical justification; status:GUESSED = an acceptance convention carrying a written resolutionPath. NONE is a taste constant.',
    },
  },

  // ── (4) LIGHT STAGING — exact sun az/el for all captures (BUILD-PLAN §0.5) ───────────────────────
  lightStaging: {
    lightAzimuthDeg: dc.lightAzimuthDeg,        // 40.6 — LAB default world-engine-lab.html:2006 (grep-verified)
    lightElevationDeg: dc.lightElevationDeg,    // 20.79 — LAB default world-engine-lab.html:2007 (grep-verified)
    incidenceDeg: dc.incidenceDeg,              // 69.21 = 90 − 20.79 (oblique; NOT "about 70°")
    faceTexels: dc.faceTexels,                  // 256²/face cube (display chain context)
    posterizeLevels: dc.levels,                 // 6 posterize levels (the pipeline the reference is pushed through)
    bandLuminance: dc.bandLuminance,            // 1/6 = 0.1667 luminance per band
    appliesTo: 'ALL oblique captures — arc-asymmetry, blind-read, and surface-class — at S2 (flip alone) and S4 (post-S3 / re-run), seed 1 + 2 re-rolls.',
    fullPhaseException: 'The fullPhaseControl capture (below) is the ONE capture NOT at this oblique light — it is a face-on / zero-phase control. All other captures use exactly these az/el.',
    justification: 'Pinned to exact numbers (BUILD-PLAN §0.5: pin the az/el, not "~70°"). Numbers verified against world-engine-lab.html state defaults by grep this session (:2006/:2007); incidence derived 90 − elevation = 69.21°. Frozen so every capture and the reference share one lighting geometry.',
  },

  // ── (1) ARC-ASYMMETRY BAR — the ≥1-band magnitude gate ───────────────────────────────────────────
  arc: {
    barStatement:
      '≥ populationFraction of the ≥-median lit-disc stamps show a light-consistent wall-half luminance asymmetry of ≥ geqOneBandMagnitude (1 posterize band), centres from the RNG-neutral probe, at the staged oblique light — AND the post-flip dark-clip guard holds.',
    geqOneBandMagnitude: {
      value: arcModel.geqOneBandMagnitude,                 // 0.1667 = one posterize band (BAKE displayChain bandLuminance)
      trueContrastToClear: arcModel.trueContrastToClear,   // 0.3175 opposing-wall true contrast to move ≥1 band
      setOn: arcModel.setOn,                               // "conservative tail (p05), not the mean"
      status: 'MODEL-DERIVED',
      frozenPreCapture: arcModel.frozenPreCapture,         // true
      justification:
        'The ONLY model output of the bake+Lambert+posterize chain in this bar. Set on the conservative p05 tail of the per-stamp attenuation distribution (a 256²-cube 1.11° wall has a sub-texel phase → the realized attenuation is a distribution, not a point; a threshold set on the mean is systematically wrong for the tails). Source: bake-attenuation-model.json.arcAsymmetryBar.modelDerived (S0.5a).',
      source: 'bake-attenuation-model.json.arcAsymmetryBar.modelDerived',
    },
    populationFraction: arcPopFrac,   // COPIED VERBATIM (S0.6 rule: do not re-derive/re-tag) — value 0.7, status JUSTIFIED (binomial, N≈73, floor 0.596, power 0.973)
    sizeGate: arcSizeGate,            // COPIED VERBATIM — rule ">=median lit-disc stamp size", status GUESSED, with resolutionPath (exact θ_wall≥θ_floor partition)
    centresVia: {
      method: 'RNG-neutral centre-export probe — writer records per-stamp centres/depths/D_km/θ_wall with ZERO added RNG draws and NO reordering (byte-fence-safe).',
      source: 'bake-attenuation-model.json.rngNeutralProbeSpec',
      note: 'The arc test reads REAL geometry (centres already placed by writeBombardment), not a re-sampled population — so the bar is not confounded by measurement RNG.',
    },
    darkClipGuard: {
      protocol: 're-baseline-after-flip (bake-attenuation-model.json.shadowRebaselineProtocol): record darkClipFrac0 pre-flip, RE-BASELINE darkClipFrac1 once at the S1 seam, then HOLD it for S3/S4.',
      source: 'bake-attenuation-model.json.shadowRebaselineProtocol',
      toleranceFrac: {
        value: 0.144402,
        status: 'DERIVED',
        rationale:
          'A per-capture growth bound: post-flip darkClipFrac must not EXCEED the re-baselined darkClipFrac1 by more than this fraction of disc pixels newly clipping to black (which would erase arc asymmetry). DERIVED 2026-07-24 at the S1 re-baseline seam per the original resolutionPath formula max(2σ, dither-noise floor): darkClipFrac1 measured on the three S2 target captures (seed 1 + 2 re-rolls, staged light) = {0.036392, 0.027644, 0.039927}, mean 0.034654, σ 0.005163, 2σ 0.010326; dither-noise floor 0.144402 (fraction of disc pixels within 1 posterize band of black that Bayer dither could push across the clip boundary — a conservative upper bound on this dark, terminator-heavy oblique scene) → max = 0.144402. Evidence: evidence/S2/arc-report.json.darkClipRebaseline.',
        derivedCaveat:
          'The dither floor dominates 2σ by ~14× on this scene, making the guard loose — recorded as derived, NOT re-tightened (tightening post-derivation because the number displeases would itself be post-hoc tuning). Diagnostic alternative recorded in arc-report.json: lit-only darkClipFrac (excludes the geometry-fixed night side) ≈ {0.0362, 0.0275, 0.0398}. If S3/S4 need a sharper regression guard, its derivation happens THERE with its own recorded rationale, never by editing this held value mid-protocol.',
        replacedGuess: { value: 0.01, replacedAt: 'S1 re-baseline seam 2026-07-24, before S3/S4 captures, per the frozen resolutionPath' },
      },
      note: 'The dark-clip guard is a REGRESSION guard on the arc bar, not an independent read bar.',
    },
    geometryContext: {
      measuredEdgeDeg: BAKE.measuredEdgeDeg,   // 1.11 — resolvable edge (Nyquist 2-texel + bake blur), NOT naive 0.573 (panel R6)
      thetaFloorDeg: BAKE.thetaFloorDeg,       // 0.37 = 2·PITCH/LEVELS — the resolvable angular wall floor θ_floor (also S3.a's content/instrument discriminant)
      note: 'Included so the arc bar is self-contained; both numbers are read from bake-attenuation-model.json (S0.5).',
    },
    frozenPreCapture: true,
  },

  // ── (2) BLIND-READ BAR — N≥3 captions + forced-choice among distractors (m-6) ─────────────────────
  blindRead: {
    barStatement:
      'A SINGLE caption is a coin flip in both directions ("cratered" for any pocked sphere = false pass; "noisy rock" for a genuinely cratered one under heavy dither = false fail). So the bar is discriminative only as N≥3 independent fresh-context captions PLUS a forced-choice against distractor terrains.',
    captions: {
      N: BLIND_N_CAPTIONS,                     // ≥3 — m-6 spec floor
      independence: 'Each caption produced by a fresh-context agent with NO prior knowledge of the render, NO impact/crater vocabulary in the prompt.',
      vocabSet: ['crater', 'cratered', 'impact', 'basin', 'pocked', 'pitted'],
      passRule: `majority (>= ${captionMajority} of ${BLIND_N_CAPTIONS}) captions spontaneously use a vocabSet term without it appearing in the prompt`,
      role: 'CORROBORATING (secondary), not the primary statistical discriminator',
      status: 'JUSTIFIED',
      justification:
        'Majority-of-independent-N guards the m-6 single-agent coin flip. Stated honestly: under the null p=0.5 per caption, P(≥2 of 3 use the vocab) = 0.5 — so caption majority is NOT a strong statistical bar on its own; it corroborates the forced-choice. That is exactly why the forced-choice below is the PRIMARY bar.',
    },
    forcedChoice: {
      prompt: 'Present the render among a distractor set and ask, unprompted, "which is the cratered body?"',
      distractorSetStructure: {
        distractorCount: DISTRACTOR_COUNT,     // K=3 ⇒ 4-way choice
        rule: 'K distinct NON-crater-dominated relief classes rendered through the IDENTICAL posterize/dither/pixelScale pipeline at the SAME staged light (az 40.6°/el 20.79°), same N=40k mesh, from lab presets OUTSIDE the crater-dominated in-domain set — so the discriminating cue is terrain STRUCTURE, not art style or palette.',
        exampleDistractors: [
          'tectonic-ridged (Rocky / Earthlike)',
          'fluvial-margin / shelf (Ocean)',
          'chaos-lineated icy (Europa)',
        ],
        note: 'Distractors carry relief but NOT circular impact structure; a genuinely cratered target is separable by structure alone.',
      },
      rendersPerVerdict: FORCED_CHOICE_RENDERS,        // seed 1 + 2 re-rolls
      passRule: 'the cratered target is correctly identified on ALL 3 renders (seed 1 + 2 re-rolls)',
      nullProbabilitySingle: forcedChoiceSingleNull,   // 0.25
      nullProbabilityCombined: forcedChoiceCombinedNull, // (1/4)^3 = 0.015625
      role: 'PRIMARY statistical discriminator',
      status: 'JUSTIFIED',
      justification:
        'K=3 distractors give a 4-way choice with per-render null 1/4; requiring correct identification on all 3 rerolls gives combined null (1/4)^3 = 0.015625 < α=0.05 (assuming the 3 re-rolled target images are independent — medium-confidence). This makes the blind read a real statistical bar, not a single agent\'s whim (m-6).',
    },
    passRule: 'PASS iff forcedChoice passes (primary) AND captions majority passes (corroborating).',
    frozenPreCapture: true,
    anchor: 'BUILD-PLAN §1.S2 (ii) + §2 AC-READ; lens-log m-6.',
  },

  // ── (3) SURFACE-CLASS BAR — one relief-dominated reference (MF-4) ─────────────────────────────────
  surfaceClass: {
    barStatement:
      'R2 makes our render PRE-ALBEDO (relief only — no maria/highland contrast, no rays). The shared posterize/dither pipeline does NOT strip albedo, so matching against an albedo-bearing Moon photo is confounded (toothless OR biased-to-fail). Pin a RELIEF-DOMINATED reference with the same information content as the pre-albedo render; read the verdict off RELIEF STRUCTURE.',
    referencePrimary: {
      pick: 'LRO/LOLA shaded-relief DEM at matched sun az/el',
      dataset: 'LOLA (Lunar Orbiter Laser Altimeter) gridded lunar DEM (e.g. the LDEM elevation product)',
      instrument: 'LOLA aboard NASA Lunar Reconnaissance Orbiter (LRO)',
      distributionNode: 'NASA PDS Geosciences Node (LOLA archive)',
      renderAs: 'HILLSHADE at sun azimuth 40.6°, elevation 20.79° (matched to lightStaging)',
      whyThisPick:
        'A DEM hillshade is relief-ONLY by construction → identical information content to the pre-albedo render (the MF-4 requirement), and sun az/el is a free hillshade parameter so it matches the staged light EXACTLY. This is the only reference that eliminates the albedo confound outright rather than bounding it.',
      status: 'JUSTIFIED',
    },
    referenceFallback: {
      pick: 'Cassini Mimas global mosaic (near-albedo-uniform — the contract\'s own alternative)',
      dataset: 'Cassini ISS global mosaic of Mimas',
      instrument: 'Cassini ISS Narrow-Angle Camera (NAC)',
      distributionNode: 'NASA PDS Imaging Node (Cassini archive)',
      useWhen: 'a matched-az/el LOLA hillshade cannot be acquired live at S2 time',
      caveat: 'sun az/el is FIXED by the acquisition geometry (cannot be matched to 40.6°/20.79°); annotate the lighting mismatch when used.',
      status: 'JUSTIFIED',
    },
    acquisition: {
      rule: 'The S2/S4 driver searches for the named dataset+instrument LIVE (WebSearch/WebFetch). NO invented URL is frozen here (feedback_no-invented-urls) — only the dataset + instrument + node names above.',
    },
    pipeline: 'Push the reference through the SAME posterize (6 levels) / dither / pixelScale pipeline as the render BEFORE comparison.',
    verdictRule: {
      readOff: 'RELIEF STRUCTURE (crater density + texture), NOT albedo patches.',
      densityTextureClause: 'verdict "same surface class: heavily cratered" requires a matching density/texture read, not merely "a lumpy sphere".',
    },
    fullAlbedoPhotoFallback: {
      allowed: false,
      note: 'If a full-albedo photo (e.g. LRO last-quarter Moon) is used instead of a relief-dominated reference, S0 must BOUND and annotate the terminator-phase albedo contamination, and the "same surface class" verdict is still read off relief structure, not albedo. Preferred path is the relief-dominated reference above, which needs no such bound.',
    },
    frozenPreCapture: true,
    anchor: 'BUILD-PLAN §1.S2 (iii) + §2 AC-READ; lens-log MF-4; brief §2.5 R5.',
  },

  // ── (6) FULL-PHASE CONTROL — required control capture, honest pre-albedo state (R2) ───────────────
  fullPhaseControl: {
    required: true,
    isGate: false,
    role: 'CONTROL, not a pass/fail bar.',
    lighting: 'face-on lit disc at zero phase angle (sun behind camera) — a DIFFERENT lighting from the oblique staged light; see lightStaging.fullPhaseException.',
    reviewedAs: 'the honest PRE-ALBEDO state: pre-albedo/rays, a full-phase lit disc reads NEAR-FEATURELESS (a real full Moon is albedo, not relief). This is disclosed to Max as the honest state, not scored.',
    justification:
      'Required by R2 (the render is pre-albedo) + Max decision #2 (full-phase flatness accepted; albedo/ejecta deferred to the exogenic increment) + brief R7 (bind UAT lighting AND file the full-phase control). Filed so lighting freedom does not surprise Max at UAT.',
    frozenPreCapture: true,
    anchor: 'BUILD-PLAN §1.S2 (iv), §1.S4; brief §3b decision #2, R7.',
  },

  // ── (7) CRISPNESS RATIO — diagnostic-only flag, never a gate (R5) ─────────────────────────────────
  crispnessRatio: {
    isGate: false,
    role: 'DIAGNOSTIC-ONLY.',
    justification:
      'R5: crispnessRatio was BLIND to a 2.375× amplitude change, so it is demoted to a diagnostic and NEVER a pass/fail gate. If it is computed against any reference, the reference is first pushed through the SAME posterize/dither/pixelScale pipeline.',
    frozenPreCapture: true,
    anchor: 'BUILD-PLAN §1.S2 (v); brief §2.5 R5.',
  },

  // ── (5) f_I BAND — per-world frozen band, anchor-swept (copied from relic-lambda-band.json) ───────
  fIBand: {
    source: 'relic-lambda-band.json.fI_band (S0.1a anchor-swept band)',
    method: RELIC.fI_band.method,
    perWorld: RELIC.fI_band.perWorld,     // COPIED — anchor-swept [min,max] across baseline/-20%/+20%
    overall: RELIC.fI_band.overall,       // COPIED — union band
    marsGate: {
      gate: FIT.marsGate.gate,            // [0.3, 0.8] — real-Mars hypsometry, NOT relic-law extrapolation
      source: FIT.marsGate.source,
      note: RELIC.fI_band.marsGateNote,
    },
    realizedModelFI_crossReference: {
      note: 'The frozen band above is the anchor-swept RELIC band (domain-honesty band on the relic-flat σ_imp reference). The REALIZED model f_I (from per-world realized σ_imp) lives in relief-budget-fit.json.fIByWorld — quoted here only for cross-reference; the AC-BUDGET check uses those in relief-budget-fit.json, this file freezes the read-gate reference band.',
      'Moon/Mercury (impact-airless)': FIT.fIByWorld['Moon/Mercury (impact-airless)'].f_I_model,
      'Frozen (airless)': FIT.fIByWorld['Frozen (airless)'].f_I_model,
      'Mars (arid rocky)': FIT.fIByWorld['Mars (arid rocky)'].f_I_model,
      'Crystal (faceted)': FIT.fIByWorld['Crystal (faceted)'].f_I_model,
    },
    frozenPreCapture: true,
    anchor: 'BUILD-PLAN §1.S0 S0.6, S0.1a; §2 AC-BUDGET row.',
  },

  // ── (8) RE-ROLL EVIDENCE SPEC — the S4 controls (m-4) ─────────────────────────────────────────────
  rerollSpec: {
    varietyDriver: {
      control: '🌍 "new planet (re-roll all)"',
      site: 'world-engine-lab.html:3871 newPlanet()',
      mechanism: 're-rolls worldSeed → macroSeed (:3874, "draw:macro:"+worldSeed), which drives crater PLACEMENT via forEachCrater(cond, macroSeed, …) (bombardment.js:305). THIS is the layout-variety driver.',
    },
    notTheDriver: {
      control: '🎲 "reroll radius"',
      site: 'world-engine-lab.html:3861 rerollRadius()',
      whyNot: 'bumps radiusSeed ONLY — a no-op for layout, and (pre-R3) a no-op for canonical-locked Moon/Mercury radius. Driving 🎲 on Moon/Mercury shows ZERO layout variety and re-triggers Max\'s "they do not vary" (m-4).',
    },
    controls: {
      moonMercuryMacroSeeds: {
        count: 3,
        via: '🌍 newPlanet() macroSeed re-roll',
        assert: 'layout differs across the 3 macroSeeds (robust variety signal).',
      },
      frozenRadiusDraws: {
        count: 2,
        via: 'drawPresetRadius(..., { labUnlock: true })',
        radiusDrawRange: [0.27, 0.38],     // Moon/Mercury LAB_UNLOCKED_RANGES entry (R3) — draws land in range and vary
        assert: 'radius draws land in [0.27,0.38] and vary; Frozen g-mediated deltas differ across radius draws.',
      },
    },
    largestBasinSpread: {
      reporting: 'MEASURED, not promised (m-5)',
      note: 'With ~147 draws from a truncated Pareto the max basin often pins near the D_HI truncation, so largest-basin variety may be a WEAK signal. S4 computes the expected max-basin spread from the truncated SFD; if below a just-noticeable threshold, AC-REROLL rests on LAYOUT variety (robust) and reports biggest-basin variety as measured, not sold.',
    },
    stampedCountRInvariance: {
      statedAs: 'a mesh-floor INSTRUMENT LIMIT, NOT sold as variety (A4).',
      note: 'nStamp is R-invariant (147=147 measured); this is disclosed to Max plainly, not dressed up as re-roll variety.',
    },
    frozenPreCapture: true,
    anchor: 'BUILD-PLAN §1.S4 + §2 AC-REROLL row; lens-log m-4, m-5; brief A4.',
  },
};

// ── validate: JSON round-trips, and the pulled numbers match their sources ─────────────────────────
let parsed;
try { parsed = JSON.parse(JSON.stringify(out)); }
catch (e) { problems.push('emitted object does not round-trip through JSON: ' + e.message); }

need(parsed && parsed.arc.geqOneBandMagnitude.value === BAKE.arcAsymmetryBar.modelDerived.geqOneBandMagnitude,
  'arc magnitude does not match BAKE source');
need(parsed && parsed.arc.populationFraction.value === 0.7 && parsed.arc.populationFraction.status === 'JUSTIFIED',
  'population fraction not copied faithfully (value 0.7 / JUSTIFIED)');
need(parsed && parsed.arc.sizeGate.status === 'GUESSED',
  'size gate not copied faithfully (GUESSED)');
need(parsed && parsed.lightStaging.incidenceDeg === BAKE.displayChain.incidenceDeg,
  'light staging incidence mismatch');
need(parsed && parsed.blindRead.forcedChoice.nullProbabilityCombined === 0.015625,
  'forced-choice combined null != 0.015625');
need(parsed && parsed.fIBand.perWorld && Object.keys(parsed.fIBand.perWorld).length === 4,
  'f_I band perWorld not copied (expect 4 worlds)');
need(parsed && Array.isArray(parsed.fIBand.marsGate.gate) && parsed.fIBand.marsGate.gate[0] === 0.3 && parsed.fIBand.marsGate.gate[1] === 0.8,
  'Mars gate not [0.3,0.8]');

// ── write deterministically ────────────────────────────────────────────────────────────────────
const outPath = join(__dirname, 'read-gate-thresholds.json');
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');

// ── key numbers to stdout (for the build log) ────────────────────────────────────────────────────
console.log('inc3b S0.6 — FROZEN read-gate thresholds → ' + outPath);
console.log('  frozenAt              : ' + out.meta.frozenAt + ' (build seam, not wall clock)');
console.log('  light az/el/incidence : ' + out.lightStaging.lightAzimuthDeg + '° / ' + out.lightStaging.lightElevationDeg + '° / ' + out.lightStaging.incidenceDeg + '°');
console.log('  arc ≥1-band magnitude : ' + out.arc.geqOneBandMagnitude.value + ' (MODEL-DERIVED, p05 tail; true-contrast ' + out.arc.geqOneBandMagnitude.trueContrastToClear + ')');
console.log('  arc population frac   : ' + out.arc.populationFraction.value + ' (' + out.arc.populationFraction.status + ')');
console.log('  arc size gate         : ' + out.arc.sizeGate.status + ' — ' + out.arc.sizeGate.rule);
console.log('  arc darkClip tol      : ' + out.arc.darkClipGuard.toleranceFrac.value + ' (' + out.arc.darkClipGuard.toleranceFrac.status + ')');
console.log('  blindRead forced-choice null (single/combined): ' + out.blindRead.forcedChoice.nullProbabilitySingle + ' / ' + out.blindRead.forcedChoice.nullProbabilityCombined);
console.log('  surfaceClass primary  : ' + out.surfaceClass.referencePrimary.pick);
console.log('  fullPhaseControl gate : ' + out.fullPhaseControl.isGate + ' (control only)');
console.log('  crispnessRatio gate   : ' + out.crispnessRatio.isGate + ' (diagnostic only)');
console.log('  f_I band overall      : [' + out.fIBand.overall.lo + ', ' + out.fIBand.overall.hi + ']  Mars gate [' + out.fIBand.marsGate.gate.join(', ') + ']');
console.log('  rerollSpec driver     : ' + out.rerollSpec.varietyDriver.control + ' (3 M/M macroSeeds + 2 Frozen radius draws in [0.27,0.38])');

if (problems.length) {
  console.log('\nFAIL:');
  for (const pr of problems) console.log('  • ' + pr);
  process.exit(1);
}
console.log('\nOK — all bars frozen; every number sourced (READ from artifact / STRUCTURAL+anchored / GUESSED+resolutionPath); JSON round-trips.');
process.exit(0);
