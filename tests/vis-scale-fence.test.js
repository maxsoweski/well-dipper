// Radius display-scale — DISPLAY-FREQUENCY fence (AC-ZERO-CLOBBER) + AC-LOD-KEY source pins.
// Workstream: world-engine-radius-display-scale-2026-07-24.
//
// RE-SCOPED at Slice B (D1). The bar "hold surface forms constant while the disc grows" is
// satisfiable ONLY by freq_render ∝ sVis, which necessarily puts sVis into named display-
// frequency terms at the LIVE lab write. So the invariant is no longer "sVis touches no
// frequency anywhere" — it is:
//   sVis MAY set a NAMED display-frequency term at the live lab frame write — the P4 synth-
//   crater scale, the P5b fixed-uniform relief combiners, and (Slice C) one uDispDomainScale
//   lever (allowlist below). It must STILL never appear in: the height/river GLSL strings,
//   run-golden.mjs, canonical-scenario.js, or ANY src/worldengine/** file; and no physics-
//   frequency surface may key featureFrequencyFromKm on the display scale. sVis=1 (radius 1
//   R⊕) is identity everywhere, so goldens/headless stay byte-identical by construction.
// This suite codifies that fence and pins the four LOD-keying call sites in the lab source.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { featureFrequencyFromKm, visScaleOf, bakeReliefCrossover, BAKE_CROSS_SPAN } from '../src/worldengine/base/labCore.js';
import { makeUniforms } from '../src/worldengine/shaders/uniforms.js';
import { HEIGHT_GLSL } from '../src/worldengine/shaders/height.glsl.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// ⚠ The lab's two shaders were EXTRACTED to src/worldengine/shaders/planetShaders.glsl.js (so the game imports the
// SAME source the lab renders). The lab's source text is therefore the HTML *plus* that module —
// this fence reads both as one corpus so its assertions keep testing what the lab compiles.
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
  + (rel === 'world-engine-lab.html' ? '\n' + readFileSync(join(ROOT, 'src/worldengine/shaders/planetShaders.glsl.js'), 'utf8') : '');

// The three tokens that carry the display scale. \bsVis\b so it can't match e.g. a
// substring; the pure-fn names are distinctive enough to match plainly.
const DENY = /visScaleOf|\bsVis\b|VIS_SCALE_EXP/;

// ── the one carve-out, and it is an EXCEPTION rather than a false positive ────────────────────────
// ⭐ STEP 7 (2026-08-12) MOVED THE FILE THAT DEFINES THE DISPLAY SCALE INTO THE TREE THIS FENCE
// DECLARES TOKEN-FREE. `planet-lod-lab-core.js` → `src/worldengine/base/labCore.js`, carrying
// VIS_SCALE_EXP, visScaleOf, minCameraDistance and bakeReliefCrossover — 25 token hits, four exports.
// This file's own :50 already recorded it as "DELIBERATELY excluded — it DEFINES the exports"; that
// exclusion was free while the file sat at the repo root and costs something now, so it is written
// down as a list with a liveness check instead of living in a comment.
//
// ⛔ STATED PLAINLY SO NOBODY LATER READS IT AS A MIS-SCAN: a display concern genuinely now sits
// inside the physics tree. That is a real boundary exception, carried as ledger C23, and it is
// deferred rather than accepted — PLAN §4 Step 7 rules labCore moves WHOLE because "splitting is a
// judgement call that must not ride in a mechanical commit." The step that lifts the four
// display-scale exports into their own module deletes this list.
//
// WHAT THE FENCE STILL PROVES, unchanged, and it is the property it was written for: no CONSUMER
// under src/worldengine/** reads the token. Exactly one definer is exempt, by name, and `checkedTree`
// below asserts the exemption is LIVE — the file must exist AND must still carry the tokens, so a
// stale entry reds rather than silently widening the hole.
const DEFINES_THE_DISPLAY_SCALE = ['src/worldengine/base/labCore.js'];

// The worldengine tree MINUS the definer. Every DENY sweep over the tree goes through here, so the
// carve-out cannot be applied in one sweep and forgotten in another.
function checkedTree() {
  const all = jsFilesUnder('src/worldengine');
  for (const rel of DEFINES_THE_DISPLAY_SCALE) {
    const i = all.indexOf(rel);
    if (i === -1) throw new Error(
      `vis-scale carve-out '${rel}' is not in the worldengine tree. The file moved or was deleted; `
      + 'delete the entry in the same commit rather than leaving an exemption pointed at nothing.');
    if (!DENY.test(read(rel))) throw new Error(
      `vis-scale carve-out '${rel}' no longer carries any display-scale token, so the exemption is `
      + 'STALE and is now silently forgiving a future one. Delete the entry — the split it stands in '
      + 'for (ledger C23) has evidently happened.');
    all.splice(i, 1);
  }
  return all;
}

// Recursively collect every .js under a dir (worldengine is deeper than base/).
function jsFilesUnder(rel) {
  const out = [];
  const walk = (d) => {
    for (const ent of readdirSync(join(ROOT, d), { withFileTypes: true })) {
      const child = `${d}/${ent.name}`;
      if (ent.isDirectory()) walk(child);
      else if (ent.name.endsWith('.js')) out.push(child);
    }
  };
  walk(rel);
  return out;
}

describe('AC-ZERO-CLOBBER — display-only fence (procgen surfaces are sVis-free)', () => {
  // NB: src/worldengine/base/labCore.js is DELIBERATELY excluded — it DEFINES the exports, so
  // it legitimately contains the tokens. The fence is that no PROCGEN surface consumes them.
  const procgenSurfaces = [
    'src/worldengine/shaders/height.glsl.js',
    'planet-lod-river-amplifier.glsl.js',
    'tests/golden-trajectories/run-golden.mjs',
    'tests/golden-trajectories/canonical-scenario.js',
    // Slice D (lens #9): planet-lod-rivers.js hosts route()/compositeMargins/the relief-cube
    // bake. The Slice-D crossover is lab-side (re-weights the blend uniform), so rivers.js stays
    // sVis-token-free — lock that: the display scale never enters the bake/route/budget module.
    'planet-lod-rivers.js',
  ];

  for (const rel of procgenSurfaces) {
    it(`${rel} contains no display-scale token`, () => {
      expect(read(rel)).not.toMatch(DENY);
    });
  }

  it('every src/worldengine/**/*.js except the one DEFINER is free of the display-scale token', () => {
    const files = checkedTree();
    expect(files.length).toBeGreaterThan(20);   // sanity: we actually walked the tree
    const offenders = files.filter((f) => DENY.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('the carve-out is exactly one file, and it is the one that DEFINES the display scale', () => {
    // The exemption's own control. `checkedTree` throws if the entry is dead or stale; this asserts
    // the hole is the size it claims to be, and that the fence would SEE a token there — i.e. that
    // the carve-out is doing work rather than sitting over an already-clean file.
    expect(DEFINES_THE_DISPLAY_SCALE).toEqual(['src/worldengine/base/labCore.js']);
    expect(jsFilesUnder('src/worldengine').length - checkedTree().length).toBe(1);
    const core = read('src/worldengine/base/labCore.js');
    for (const sym of ['VIS_SCALE_EXP', 'visScaleOf', 'minCameraDistance', 'bakeReliefCrossover']) {
      expect(core.includes(`export function ${sym}`) || core.includes(`export const ${sym}`), sym).toBe(true);
    }
  });
});

describe('AC-ZERO-CLOBBER — the lab GLSL regions are sVis-free (breach only allowed in JS wiring)', () => {
  // Extract every /* glsl */ `…` template-literal body from the lab. sVis IS present in
  // the lab's JS frame loop (that's the display wiring); the fence is that it never
  // reaches a shader string. Interpolations (${…}) are captured too, so injecting sVis
  // INTO a shader via interpolation would also fail this.
  function extractGlslRegions(src) {
    const regions = [];
    const marker = '/* glsl */';
    let i = 0;
    while ((i = src.indexOf(marker, i)) !== -1) {
      let j = src.indexOf('`', i + marker.length);
      if (j === -1) break;
      // scan to the matching closing backtick (these GLSL templates have no nested
      // backticks, so the next unescaped backtick closes the literal).
      let k = j + 1;
      while (k < src.length) {
        if (src[k] === '\\') { k += 2; continue; }
        if (src[k] === '`') break;
        k++;
      }
      regions.push(src.slice(j + 1, k));
      i = k + 1;
    }
    return regions;
  }

  it('finds the lab shader blocks and none contains a display-scale token', () => {
    const lab = read('world-engine-lab.html');
    const regions = extractGlslRegions(lab);
    expect(regions.length).toBeGreaterThanOrEqual(6)   // ⭐ 8 -> 6 ON 2026-08-27, AND THE TWO BLOCKS DID NOT STOP BEING CHECKED — THEY MOVED SOMEWHERE STRICTER. F51 lifted the lab's ring vertex + fragment shaders out of world-engine-lab.html into src/worldengine/shaders/ringRelief.glsl.js, which the GAME splices too. This floor exists so the sVis scan cannot silently find zero inline blocks; the ring's GLSL is now under src/worldengine/**, where THIS SAME FILE bans the display-scale token outright, COMMENTS INCLUDED — a strictly harder arm than the one it left. Verified: the module carries no sVis/visScale token.;   // the 8 /* glsl */ blocks
    const offending = regions.filter((r) => DENY.test(r));
    expect(offending).toEqual([]);
  });

  it('the physics-frequency surfaces never key featureFrequencyFromKm on sVis (real-R only)', () => {
    // RE-ANCHORED (was: "lab never passes sVis to featureFrequencyFromKm"). P5 now
    // DELIBERATELY passes the display radius (_dispR === sVis) into featureFrequencyFromKm
    // at the LIVE lab write — that is the display-frequency keying that holds km-texture
    // forms constant. The real-R guarantee moves onto the surfaces that MUST stay physics-
    // exact: the golden harness, the canonical scenario, and the whole worldengine tree.
    // None may key a frequency on the display scale, and none may carry the token at all.
    const ffkSvis = /featureFrequencyFromKm\([^)]*\bsVis\b/;
    const realRSurfaces = [
      'tests/golden-trajectories/run-golden.mjs',
      'tests/golden-trajectories/canonical-scenario.js',
      ...checkedTree(),
    ];
    for (const rel of realRSurfaces) {
      const src = read(rel);
      expect(src).not.toMatch(ffkSvis);
      expect(src).not.toMatch(DENY);
    }
  });

  it('only the display-frequency allowlist may carry sVis in a planet uniform write', () => {
    const lab = read('world-engine-lab.html');
    // Re-scope (D1): sVis MAY set a NAMED display-frequency term at the live frame write.
    // The allowlist = P4 synth craters + the P5b fixed-uniform relief combiners (incl. warp
    // partners) + Slice C's single uDispDomainScale lever + the P5 km-keyed writes (which
    // take _dispR === sVis today, so they don't literally carry the token, but are listed
    // for forward-safety). EVERY OTHER planet uniform write must stay sVis-free — physics /
    // amplitude / mask / strength / width content never keys on the display scale.
    const ALLOW = new Set([
      // Slice C global macro-domain lever (forward-declared; not yet written)
      'uDispDomainScale',
      // Slice D — bake→synth crossover: a display-BLEND term (not a frequency), but a legitimate
      // display-only sVis-driven planet-uniform write. effective = base · bakeReliefCrossover(sVis)
      // fades the baked cube out and the Slice-C domain-scaled synth body in as the disc departs 1.
      'uReliefBakeStrength',
      // P4 — synth sub-floor craters (·sVis on the real-R value)
      'uCraterScale',
      // ⭐ ADDED 2026-08-25 — the [N] bare-key A/B's arm B, and it is the SAME shape as uCraterScale
      // one line up: the physics is resolved at the REAL radius and the display multiply is applied
      // at the write. ⛔ IT IS ON THIS LIST BECAUSE OF THAT SHAPE, NOT BECAUSE IT NEEDED TO PASS.
      // The first cut resolved the wavelength at the lab's INFLATED display radius and applied no
      // multiply at all — which is the arrangement this whole fence exists to forbid, and it was
      // wrong by exactly 1/R, so it vanished at Earth size and reached 3.1x on Lava. That version
      // would not have tripped this assertion, because it carried no sVis token to catch. Landing on
      // the allowlist is what being RIGHT looks like here; the wrong version was invisible to it.
      'uNoiseScale',
      // P5b — fixed-uniform relief combiners + their warp-domain partners
      'uMountainScale', 'uScarpFreq', 'uScarpWarpFreq', 'uPlateauScale',
      'uTesseraFreq', 'uTesseraWarpFreq', 'uWrinkleFreq', 'uDoubleRidgeFreq',
      'uGroovedBandFreq', 'uBladeFreq', 'uGlacialScale', 'uLineationFreq',
      'uLineationWarpFreq', 'uMachDistrictScale', 'uMachBlockScale', 'uCityScale',
      // P5 — km-keyed texture writes (pass _dispR today; allowlisted for forward-safety)
      'uOutflowFreq', 'uKarstDolineFreq', 'uDuneFreq', 'uFacetScale', 'uHexScale',
      'uShatScale', 'uEcuDistrictScale', 'uEcuBlockScale', 'uEdificeScale', 'uLavaScale',
      'uCrackScale', 'uChaosCellScale', 'uSubPitScale', 'uSubPolyScale', 'uFluvialFreq',
    ]);
    // Every planet `uniforms.<name>.value = <expr with sVis>` (ringCloud.material excluded).
    const re = /(?<!ringCloud\.material\.)uniforms\.(\w+)\.value\s*=\s*[^;]*\bsVis\b/g;
    const found = [...lab.matchAll(re)].map((m) => m[1]);
    const offenders = found.filter((n) => !ALLOW.has(n));
    expect(offenders).toEqual([]);
    // sanity: the scan actually finds the P4 + P5b display writes (guards against the regex
    // silently matching nothing and passing vacuously).
    expect(found.length).toBeGreaterThanOrEqual(15);
  });
});

describe('AC-LOD-KEY — the four lab call sites key on logical distance (source pins)', () => {
  const lab = read('world-engine-lab.html');
  it('defines logicalDist = state.distance / sVis', () => {
    expect(lab).toMatch(/const\s+logicalDist\s*=\s*state\.distance\s*\/\s*sVis/);
  });
  it('lodRampOf keys on logicalDist', () => {
    expect(lab).toMatch(/lodRampOf\(\s*logicalDist\s*\)/);
  });
  it('lodHysteresis keys on logicalDist', () => {
    expect(lab).toMatch(/lodHysteresis\(\s*logicalDist\s*,/);
  });
  it('autoOctaves re-keys transitively via lod (lodRampOf output)', () => {
    expect(lab).toMatch(/autoOctaves\(\s*lod\s*\)/);
  });
});

describe('AC-0 — sVis derivation reads ONLY state.planetRadiusEarth (spine conformance)', () => {
  const lab = read('world-engine-lab.html');
  it('the sVis assignment takes exactly planetRadiusEarth (no label/archetype/regime read)', () => {
    expect(lab).toMatch(/sVis\s*=\s*visScaleOf\(\s*state\.planetRadiusEarth\s*\)/);
  });
  it('visScaleOf is never called on a label / archetype / regime field', () => {
    expect(lab).not.toMatch(/visScaleOf\([^)]*\.(label|archetype|regime|rendersOn)/);
  });
});

describe('P4/P5/P5b — display-frequency keying is identity at sVis=1 (Slice B)', () => {
  const lab = read('world-engine-lab.html');

  it('featureFrequencyFromKm(sVis=1, …) === the real-R value at radius 1 (identity)', () => {
    // visScaleOf(1) === 1 exactly, so the P5 pseudo-radius swap is a no-op at radius 1 R⊕ —
    // the km-texture render frequency is bit-identical to the pre-increment real-R value.
    const sizeKm = 398, C = 1.0;
    expect(visScaleOf(1)).toBe(1);
    expect(featureFrequencyFromKm(visScaleOf(1), sizeKm, C))
      .toBe(featureFrequencyFromKm(1, sizeKm, C));
  });

  it('featureFrequencyFromKm(sVis, …) scales ∝ sVis at sVis>1 (holds the form constant)', () => {
    // freq_render ∝ sVis ⇒ θ ∝ 1/sVis ⇒ on-screen size S = θ·sVis is CONSTANT as the disc
    // grows. featureFrequencyFromKm is linear in its radius arg, so the ratio is exactly sVis.
    const sizeKm = 398, C = 1.0;
    const base = featureFrequencyFromKm(1, sizeKm, C);
    for (const sVis of [Math.SQRT2, 2, 2 * Math.SQRT2, 4]) {   // discs 1.41× / 2× / 2.83× / 4×
      expect(featureFrequencyFromKm(sVis, sizeKm, C)).toBeCloseTo(base * sVis, 6);
    }
  });

  it('P5 keys km-texture writes on the _dispR pseudo-radius, defined as sVis (D2 = hold-constant)', () => {
    // The D2 knob: _dispR === sVis holds forms constant; flipping it to state.planetRadiusEarth
    // in ONE line restores the inc3b ∝R "finer texture on a bigger world" read.
    expect(lab).toMatch(/const\s+_dispR\s*=\s*sVis\s*;/);
    expect(lab).toMatch(/featureFrequencyFromKm\(_dispR,/);
  });

  it('uShatSubFreq is NOT ·sVis-scaled — it rides shatQ=pos·uShatScale (no double-scale)', () => {
    // uShatScale is a P5 write (already ∝sVis via _dispR); the sub-fracture octave samples
    // shatQ·uShatSubFreq, so uShatScale's scaling already propagates. Scaling uShatSubFreq too
    // would give the sub-fracture ∝sVis² (over-held, shrinks). It stays the real ratio.
    expect(lab).toMatch(/uShatSubFreq\.value\s*=\s*state\.shatSubFreq\s*;/);
  });
});

describe('Slice C RETIRED — uDispDomainScale is pinned at 1.0 (AC-PLATESCALE item 2)', () => {
  const WORLD_LIGHT = new THREE.Vector3(1, 0, 0);
  const lab = read('world-engine-lab.html');
  // RESOLVED, not raw source. These assertions are about the shader that actually COMPILES, and
  // as of the hash3/noised/fbmd hoist (2026-07-30) one of the read sites below — fbmd's
  // `uNoiseScale * 0.3 * uDispDomainScale` — lives in src/worldengine/shaders/heightNoise.glsl.js
  // and is spliced in. Reading the raw file was always a proxy for the compiled string; reading
  // HEIGHT_GLSL is the thing itself, and stays correct wherever the text is hoisted to next.
  const heightGlsl = HEIGHT_GLSL;
  const heightGlslSrc = read('src/worldengine/shaders/height.glsl.js');

  it('uDispDomainScale defaults to 1.0 — now the value it renders at on EVERY path', () => {
    // Was "identity ⇒ headless/golden byte-identical" when the frame loop wrote sVis over it. With
    // the writer gone this default is no longer just the headless value; it is the ONLY value, so
    // this test became the load-bearing pin for the whole retirement.
    const u = makeUniforms(WORLD_LIGHT);
    expect(u.uDispDomainScale).toBeDefined();
    expect(u.uDispDomainScale.value).toBe(1.0);
  });

  it('the GLSL read sites are RETAINED as exact no-ops (so the shader binary cannot shift)', () => {
    // DELIBERATE non-goal: the retirement is a JS-write deletion ONLY. Stripping `* uDispDomainScale`
    // out of the shader would remove a multiply, which can change GLSL FMA/reassociation and lose the
    // bit-for-bit-identical compiled program that makes the byte-identity claim airtight. At 1.0 every
    // site below is an exact IEEE no-op (x*1.0 === x, x/1.0 === x), so keeping them costs nothing.
    expect(heightGlsl).toMatch(/uniform\s+float\s+uDispDomainScale\s*;/);
    expect(heightGlsl).toMatch(/uNoiseScale\s*\*\s*0\.3\s*\*\s*uDispDomainScale/);
    const posScales = [...heightGlsl.matchAll(/pos\s*\*=\s*uDispDomainScale\s*;/g)];
    expect(posScales.length).toBe(2);   // computeHeight + initProvinces
    // the two de-double-scale DIVISIONS (F47 machCoverageMask, F49 ecuCoverageMask) also stay
    const divisions = [...heightGlsl.matchAll(/\/\s*uDispDomainScale/g)];
    expect(divisions.length).toBe(2);
    // still carries no display-scale TOKEN (re-assert the fence at the Slice-C surface).
    // Both surfaces: the compiled string AND the raw source file, whose PROSE is fenced too.
    expect(heightGlsl).not.toMatch(DENY);
    expect(heightGlslSrc).not.toMatch(DENY);
  });

  it('NOTHING writes uDispDomainScale — the exponent-1 display law is retired (AC-PLATESCALE item 2)', () => {
    // INVERTED 2026-07-29. This assertion used to REQUIRE `uDispDomainScale.value = sVis` — i.e. the
    // fence was pinning the invented law IN PLACE. The literature falsified its premise (plate
    // structure is angularly radius-invariant, N ~ R^-0.07; contract.json amendments[1]), so Max
    // ruled the law REMOVED rather than derived. The regression guard therefore inverts: any write
    // at all re-introduces a radius→macro-frequency coupling, and the exponent it would introduce is
    // an algebraic side effect of the CAMERA constant VIS_SCALE_EXP, not a physical claim.
    const writes = [...lab.matchAll(/uDispDomainScale\.value\s*=/g)];
    expect(writes.length).toBe(0);
    // and specifically not the retired sVis feed, whatever else may change around it
    expect(lab).not.toMatch(/uniforms\.uDispDomainScale\.value\s*=\s*sVis\s*;/);
  });

  it('the uniform therefore renders at its 1.0 initializer at EVERY radius, not just the anchor', () => {
    // With no writer, makeUniforms' default is the value the shader sees for the whole 0.27–16 R⊕
    // band. That is what makes the 5 GLSL read sites exact no-ops rather than merely identity-at-1.
    const u = makeUniforms(WORLD_LIGHT);
    expect(u.uDispDomainScale.value).toBe(1.0);
    // No assignment by ANY spelling — bracket access or Object.assign would evade the `.value =`
    // regex above. Deliberately not a ban on the identifier itself: the retirement is DOCUMENTED at
    // the old write site, so prose mentions must stay legal or the record could not be kept.
    expect(lab).not.toMatch(/uDispDomainScale\s*(?:\.value|\[\s*['"]value['"]\s*\])\s*=[^=]/);
    expect(lab).not.toMatch(/Object\.assign\s*\(\s*uniforms\.uDispDomainScale/);
  });
});

describe('Slice D — bake→synth crossover (P2 reaches the live bake=1 default)', () => {
  const lab = read('world-engine-lab.html');

  it('bakeReliefCrossover(1) === 1 exactly (identity ⇒ byte-identical at radius 1 R⊕)', () => {
    // sVis=1 ⇒ |log2(1)|=0 ⇒ smoothstep(0,SPAN,0)=0 ⇒ crossover=1. The frame write is then
    // base·1 = base = the value applyReliefBake already set, so radius 1 is behavior-identical.
    expect(bakeReliefCrossover(1)).toBe(1);
    expect(visScaleOf(1)).toBe(1);   // and the input at radius 1 is exactly 1
  });

  it('fades toward 0 as the disc departs 1, symmetric in disc-doublings (|log2 sVis|)', () => {
    // NB: the arg is sVis (the disc factor), NOT radius. Monotone non-increasing in |log2 sVis|;
    // grow (sVis>1) and shrink (sVis<1) fade equally. Sample INSIDE the fade band |log2 sVis|<SPAN
    // (with SPAN=1.0 that is sVis ∈ (0.5, 2)); beyond the band it clamps to 0.
    expect(bakeReliefCrossover(1.5)).toBeCloseTo(bakeReliefCrossover(1 / 1.5), 12);  // symmetry grow vs shrink
    expect(bakeReliefCrossover(Math.SQRT2)).toBeCloseTo(bakeReliefCrossover(Math.SQRT1_2), 12);
    expect(bakeReliefCrossover(1.2)).toBeLessThan(bakeReliefCrossover(1));           // any disc growth ⇒ more synth
    expect(bakeReliefCrossover(1.5)).toBeLessThan(bakeReliefCrossover(1.2));         // farther out ⇒ more synth
    // fully synth once |log2 sVis| ≥ SPAN (clamped): pick a disc well past the span both ways.
    const farUp = Math.pow(2, BAKE_CROSS_SPAN + 1), farDn = Math.pow(2, -(BAKE_CROSS_SPAN + 1));
    expect(bakeReliefCrossover(farUp)).toBe(0);
    expect(bakeReliefCrossover(farDn)).toBe(0);
  });

  it('stays within [0,1] across the whole radius span (a valid blend weight)', () => {
    for (const R of [0.3, 0.5, 1, 2, 4, 8, 16]) {
      const c = bakeReliefCrossover(visScaleOf(R));
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it('the frame loop re-weights uReliefBakeStrength by the crossover (base · crossover(sVis))', () => {
    // The mechanism reaches the render: the effective bake strength is the live base times the
    // sVis crossover, so the baked cube fades out and the Slice-C synth body fades in as R grows.
    expect(lab).toMatch(
      /uniforms\.uReliefBakeStrength\.value\s*=\s*grainCarveUI\.reliefBakeStrength\s*\*\s*bakeReliefCrossover\(\s*sVis\s*\)\s*;/,
    );
  });

  it('the crossover is byte-safe: it edits NO src/worldengine/** file (no re-bake)', () => {
    // The whole point of the crossover vs a route-rebake: it re-weights an existing blend uniform
    // lab-side, so every worldengine height writer (and its byte-goldens) is untouched. Re-assert
    // the worldengine tree carries no display-scale token at the Slice-D surface.
    const files = checkedTree();
    expect(files.filter((f) => DENY.test(read(f)))).toEqual([]);
  });
});
