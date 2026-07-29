// src/worldengine/instrument/fieldSampler.js
// Non-visual analysis channel — LIVE FIELD READBACK (nonvisual-analysis-channel-2026-07-24, AC-SAMPLE).
//
// The ONE module in the instrument that touches the GPU. Everything it depends on for geometry and
// units (sampling.js) and for measurement (descriptors.js, stats.js) is THREE-free and headlessly
// tested; this file is the thin glue that gets real numbers out of the live shader.
//
// MECHANISM (research Family B — AOV readback, IN-PLACE TAP). It does not build, duplicate or
// paraphrase the height program. It renders THE PLANET'S OWN FRAGMENT SHADER — the exact string held in
// planet.material.fragmentShader — into a float RTT, with a uniform-gated early return (uFieldTap) that
// emits vec4(h, grad) at a declared point in that shader's own chain. Field identity is therefore
// STRUCTURAL rather than argued: the instrument material is constructed with the planet material's own
// fragmentShader reference and its own uniforms object, and tests/instrument-tap-fence.test.js fails if
// this module ever compiles a program of its own again. The previous sampler rendered the river
// router's own main() — bare fbmd, no baked-cube blend, no crater restore — while the lab's live
// default is a pure BAKED body, so every number it produced described a field nobody was looking at.
//
// WHICH BODY. Default read is uFieldTap == 2, TAP_SOLID: the field AFTER the AC2 baked/synth composite,
// AFTER the Slice-D crater restore, AFTER the whole relief-combiner chain, AFTER the AC4 river carve,
// and BEFORE the F14 standing-liquid level-set cut. That is the solid surface the planet displays, at
// the live bake strength. Two further points ride the same uniform: uFieldTap == 1 (TAP_COMPOSITE — the
// body before any combiner; the control's absolute anchor and the bake diagnostic) and uFieldTap == 3
// (TAP_LIQUID — after the sea cut; what stands where liquid stands). uFieldTap == 0 is the rendered
// path and no tap is taken. Hypsometry reads TAP_SOLID, not TAP_LIQUID: after the cut every submerged
// sample equals uSeaLevel exactly, which would replace the lower mode with a delta spike.
//
// WHICH VERTEX SIDE. A point-cloud readback cannot use a perspective vertex shader, so the vertex
// program is DERIVED from the planet's own by FOUR substitutions, each asserted to match exactly once
// or throw: vPos, vObjN AND vSubstellarAngle keyed to the sample direction instead of the interpolated
// sphere position, and the clip write replaced by the one-texel-per-sample point write. The fourth of
// those (vSubstellarAngle) is not cosmetic: it reaches h and grad through sublimationCombiner and
// glacialCombiner under uFrostLocked == 1 — every tidally locked preset — so leaving it keyed to
// `position` would silently make the measured cap a function of TEXEL INDEX on exactly the worlds the
// cap defines. And the assertion is a WHITELIST, not an enumeration: after substitution, NO bare
// `position` token may survive anywhere in the derived source except inside the single gl_Position
// write. An enumeration of named targets is what let the fourth use hide in the first place; a
// whitelist makes a FIFTH use added tomorrow throw at construction instead of being miskeyed.
//
// READ-ONLY, AND WHAT IT PINS. read() sets uFieldTap, pins uOctaves = 9 and uFwClamp = 0, requires
// uDebugMode == 0 and uNormalMode == 0, and restores all of them in a finally block around a single
// synchronous render. It writes no field, bakes nothing, adds no feature card, and changes nothing
// about the rendered frame.
//
// WHY IT CANNOT QUIETLY GO BACK TO MEASURING THE WRONG FIELD. The regression this AC exists to close is
// an OMISSION, not a token — drop the program argument at the call site and a defaulted parameter
// silently restores the router's own program while every grep fence stays green. So the guards are
// runtime and there is no default to fall back to: createFieldSampler REQUIRES the PLANET MESH (see
// the next paragraph — not a material) and throws if the material it resolves carries no uFieldTap;
// createHeightSampler REQUIRES an explicit tapProgram before it will honour a tapPoint, and that
// tapProgram must carry a scene-graph resolver; and both this module's read wrapper AND
// createHeightSampler.read() re-assert identity before EVERY readback, so a drifted, recompiled or
// SUBSTITUTED program throws at measurement time rather than reporting a plausible wrong number.
//
// ══ WHERE THE REFERENCE COMES FROM, AND WHY IT IS NOT THE SAMPLER'S OWN COPY ══════════════════════
//
// THE RULE, stated once here and restated at each guard: A REFERENCE VALUE MUST COME FROM A DIFFERENT
// SOURCE THAN THE THING IT GUARDS. A guard that derives its expectation from its subject is TRUE BY
// CONSTRUCTION and detects nothing — it is a tautology wearing the shape of a check. That defect has
// now been recorded SIX times in this program (five in one prior session, and once more in a session
// explicitly warned about it), so it is treated here as a structural property of the design rather
// than as a bug to patch each time it reappears.
//
// The first shipped form of this instrument violated the rule twice over:
//   · it cached `material.fragmentShader` at construction and then "checked" identity by comparing
//     `material.fragmentShader` against that cache — both sides tracing to ONE object, true at
//     construction by definition;
//   · and the material itself arrived as a PARAMETER, so shadowing that parameter with a reduced
//     ShaderMaterial that kept the three tap statements verbatim passed every guard, every string
//     comparison and the pinned call-site token. The design's rebuttal ("impossible by construction,
//     there is no second program") was simply false: nothing tied the instrument's material to the
//     material the SCENE draws with.
//
// THE FIX IS A CHANGE OF SOURCE, NOT A STRONGER COMPARISON. The instrument is handed the PLANET MESH —
// the scene node the lab renders the body with — and never a material. resolveRenderedMaterial() walks
// that mesh's parent chain to a THREE.Scene and returns `mesh.material` AT CHECK TIME. Every guard then
// asks the scene "what are you rendering with right now?" and requires OBJECT IDENTITY (===) against
// the material the tap program was compiled from. A sampler holding its own material and comparing it
// to itself can never detect a substitution; a sampler that re-reads the scene graph detects one by
// construction, and it keeps detecting one even if a future session replaces the module-scope material
// const — which is precisely the case the guard exists for.
//
// WHAT THE NUMBER STILL DEPENDS ON — declared, not neutralised. Neutralising inputs is how the previous
// sampler came to measure a body nobody looks at, so nothing here is switched off to make the number
// tidier:
//   • LOD. uOctaves is pinned to 9, the maximum autoOctaves ever returns (it is mix(4, 9, lodRamp)), so
//     the read is the field at the renderer's own highest detail. uFwClamp = 0 disables the sub-pixel
//     octave fade, which a 1-texel point render cannot reproduce in any case — fwidth over a point
//     primitive is 0, and every consumer of that value sits behind an uFwClamp == 1 guard, so pinning
//     makes it provably unused rather than silently garbage. Fine-scale vertical statistics are an
//     UPPER BOUND on any single frame; continental-scale statistics are unaffected. _lab.tapControl()
//     reports fadeGap — the measured distance between this read and the current frame — rather than
//     asserting the gap away.
//   • Camera, through the field itself. uRiverCarvePatchN/U/V is the tributary-patch centre and IS the
//     camera direction; uLodRamp is read inside facetCombiner and ecuRelief. Both are inert at today's
//     defaults (uRiverCarvePatchStrength 0; facet and ecumenopolis coverage 0 on the tectonic presets),
//     both are recorded in every sample's `env`, and when either is nonzero the rendered field genuinely
//     is camera-conditioned and the sample says so. A THIRD camera term exists in the RENDER but not in
//     the field: reliefAmp = uPerturb * mix(0.7, 1.0, uLodRamp) scales grad at perturbAnalytic, AFTER
//     TAP_LIQUID. It never touches h or the emitted grad, so it is not a dependence of this number —
//     but it is why the rendered normal and the tapped gradient do not agree by a constant.
//   • Path. The tap lives in the ANALYTIC branch. Under uNormalMode == 1 (the finite-diff production
//     path) there are no h/grad locals to tap; the sampler throws rather than returning a number that
//     came from somewhere else.
//   • Gas presets. aBand/aShear/aMush/aStorm are supplied to the point geometry as zeros. They reach
//     Stage-6 albedo only, never h or grad, so the solid field is unaffected — but a gas deck is not a
//     surface and the sample is flagged.
//   • Determinism. Same uniforms and same directions give a byte-identical readback within a session.
//     The control legs lean on that exactness instead of on thresholds wherever they can.
//
// WHY EVERY RESULT CARRIES TWO FRAMES: see the header of sampling.js. Briefly — a form held constant
// on screen is not constant in km, so a single "form size" number is ambiguous by construction. Each
// sample is therefore described in the PHYSICAL frame (km on the real body) and the ANGULAR frame
// (degrees of arc, which times the disc scale is what the eye sees). Reports quote both.
//
// ══ THE VERTICAL AXIS IS NOT CALIBRATED IN KM, AND THIS MODULE REFUSES TO PRETEND OTHERWISE ══
//
// Found while verifying AC-SAMPLE against the live lab (2026-07-24), and it is load-bearing enough
// to state at the top of the file:
//
//   HORIZONTAL distance IS calibrated. It comes from sphere geometry — angular separation times the
//   body's real radius — so wavelengths, crater diameters, drainage lengths and boundary lengths are
//   genuinely in km. Trust them.
//
//   VERTICAL height is NOT. The lab's relief is SHADED, NOT DISPLACED (planet-lod-lab.html:1544): the
//   height field drives a normal perturbation, it is never geometry. Its amplitudes are dimensionless
//   artistic values — e.g. deriveUniforms sets mountainAmp = clamp01(mix(0.25, 0.6, 1-erosion)) *
//   rockyCrust, which has no km in it anywhere. The km-named state knobs (mountainHeightKm = 9,
//   craterDepthKm = 2) exist and were intended to feed reliefAmplitudeFromKm * K, but the live write
//   at planet-lod-lab.html:6127 uses state.mountainAmp directly. On top of that the relief envelope
//   (uPerturb = perturb * reliefEnvelope(R, g)) is applied at SHADING time, downstream of the field
//   this module samples.
//
// Multiplying the sampled field by radius*6371 therefore produces a confident, wrong number: it
// reported ~488 km RMS relief and +/-1700 km elevation for an Earth-like world, which is ~200x too
// large. Reporting that would have been worse than reporting nothing — a fake physical number is
// exactly the failure mode this instrument exists to prevent.
//
// So: vertical quantities are reported in HEIGHT UNITS by default and clearly labelled as such. Pass
// an explicit `kmPerUnit` if a calibration is ever established, and only then do km appear.
//
// WHAT SURVIVES UNCALIBRATED (most of the census, as it happens):
//   valid as-is  — every wavelength, crater SFD, drainage/boundary density (horizontal only);
//                  hypsometric integral (a ratio, scale-invariant); band count; spectral slope
//                  (vertical scaling moves the intercept, not the slope).
//   units-only   — RMS relief, absolute elevation range.
//   needs kmPerUnit — slope in degrees (it divides a vertical by a horizontal, so it is meaningless
//                  as an angle until the vertical has a unit). Reported as gradient in units/km until then.

import { createHeightSampler } from '../../../planet-lod-rivers.js';
import {
  equirectDirections, patchDirections,
  physicalGrid, angularGrid, physicalPatchGrid, angularPatchGrid,
} from './sampling.js';
import {
  rmsReliefKm, hypsometricIntegral, slopeStats, radialPSD, autocorrWavelengthKm, spectralExcessPeak,
  bandCount, distributionMoments, areaWeights, totalAreaKm2,
} from './descriptors.js';

// ── THE THREE TAP POINTS ─────────────────────────────────────────────────────────────────────────
// The values the lab fragment shader's `uniform int uFieldTap` switches on. 0 is the rendered path
// and is deliberately NOT a tap: asking for it from the instrument is asking for a full shading pass
// that writes colour, not field.
export const TAP_COMPOSITE = 1;   // after the AC2 bake/synth blend + the Slice-D crater restore, before any combiner
export const TAP_SOLID     = 2;   // after the whole combiner chain and the AC4 carve, before the F14 sea cut
export const TAP_LIQUID    = 3;   // after the F14 standing-liquid level-set cut
const TAP_NAMES = { 1: 'TAP_COMPOSITE', 2: 'TAP_SOLID', 3: 'TAP_LIQUID' };

// The four substitutions that turn the planet's own vertex shader into the point-cloud tap vertex
// shader. Kept as data so the fence test can reason about them, and so a change here is a change
// someone had to make on purpose.
const TAP_VERTEX_SUBSTITUTIONS = [
  ['vPos = position;', 'vPos = normalize(aDir);'],
  ['vObjN = normalize(position);', 'vObjN = normalize(aDir);'],
  // THE ONE THE ROUND-3 REVIEW CAUGHT. vSubstellarAngle is read by sublimationCombiner and
  // glacialCombiner, both of which write h and grad, both under uFrostLocked == 1, all upstream of
  // every tap. Left keyed to `position` it would become acos(dot(normalize(clipSlot), uLightDir)) —
  // a function of the sample's index in the readback texture.
  ['vSubstellarAngle = acos(clamp(dot(normalize(position), normalize(uLightDir)), -1.0, 1.0));',
    'vSubstellarAngle = acos(clamp(dot(normalize(aDir), normalize(uLightDir)), -1.0, 1.0));'],
  ['gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    'gl_Position = vec4(position.xy, 0.0, 1.0); gl_PointSize = 1.0;'],
];
// The ONE statement in which `position` may legitimately survive: the point placement, where
// `position` really is the clip-space grid slot and nothing else.
const TAP_VERTEX_POSITION_WHITELIST = 'gl_Position = vec4(position.xy, 0.0, 1.0); gl_PointSize = 1.0;';

const countOccurrences = (hay, needle) => hay.split(needle).length - 1;
// GLSL comment strip — used ONLY for the `position` whitelist scan. The lab's own vertex shader
// comments contain the English word "position", which a raw token scan would flag; a comment cannot
// corrupt a varying, so comments are out of scope for the invariant.
const stripGlslComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');

/**
 * Derive the point-cloud tap vertex shader from the planet's OWN vertex shader.
 *
 * Everything not substituted — the vBand/vShear/vMush/vStorm plumbing, every varying a future
 * session adds — comes along unchanged, so a new varying appears in the tap program automatically
 * instead of silently going missing. The four substitutions are the irreducible divergence: a point
 * cloud has no interpolated sphere position and no perspective transform.
 *
 * THE WHITELIST IS THE POINT. Asserting "these four named targets each occur exactly once" is
 * satisfied by a shader that uses `position` a fifth time — which is exactly how the fourth use got
 * missed. So after substituting, this removes the one whitelisted statement and requires that NO
 * bare `position` token remains anywhere. A fifth use throws here, loudly, at construction.
 */
export function deriveTapVertex(planetVertexShader) {
  if (typeof planetVertexShader !== 'string' || !planetVertexShader.length) {
    throw new Error('deriveTapVertex: expected the planet material\'s vertexShader string.');
  }
  let out = planetVertexShader;
  for (const [from, to] of TAP_VERTEX_SUBSTITUTIONS) {
    const n = countOccurrences(out, from);
    if (n !== 1) {
      throw new Error(`deriveTapVertex: expected EXACTLY ONE occurrence of ${JSON.stringify(from)} in the planet vertex shader, found ${n}. The vertex side is the one place duplication is unavoidable — it must be re-read by a human, not re-run.`);
    }
    out = out.replace(from, to);
  }
  out = 'attribute vec3 aDir;\n' + out;
  // ── the whitelist ──
  const code = stripGlslComments(out);
  const whitelisted = countOccurrences(code, TAP_VERTEX_POSITION_WHITELIST);
  if (whitelisted !== 1) {
    throw new Error(`deriveTapVertex: expected exactly one point-placement write, found ${whitelisted}.`);
  }
  const residue = code.split(TAP_VERTEX_POSITION_WHITELIST).join('');
  const leftovers = residue.match(/\bposition\b/g);
  if (leftovers) {
    throw new Error(`deriveTapVertex: ${leftovers.length} use(s) of \`position\` survive the derivation outside the point-placement write. In the tap program \`position\` is the clip-space readback-grid slot, so any surviving use silently re-keys whatever it feeds to the sample's TEXEL INDEX. Substitute it (or prove it cannot reach h/grad and then whitelist it deliberately) before measuring anything.`);
  }
  return out;
}

/**
 * THE SCENE-GRAPH RESOLVER — the ONE place the instrument's reference value comes from.
 *
 * WHY A MESH AND NOT A MATERIAL, stated at the guard so a future session cannot re-introduce the
 * tautology by "simplifying" it: a material handed in as a parameter is a value the CALLER chose,
 * so every check against it is a check of the instrument against itself. A mesh reached through the
 * scene graph is a value the RENDERER chose — `planet.material` is, by definition, the program the
 * scene draws that body with on the next frame. Those are two different sources, which is the whole
 * requirement. Substituting the instrument's material (round-2 counterexample 1) is then detectable
 * by construction: the substitute is not the object this function returns.
 *
 * The parent-chain walk is load-bearing too, not decoration. Without it a bare `{ isMesh: true,
 * material }` literal would satisfy the resolver and the caller would be right back to choosing the
 * reference. Requiring the chain to terminate at a THREE.Scene means the mesh is one something
 * actually renders.
 *
 * @returns the live THREE.ShaderMaterial the mesh is currently rendering with.
 */
export function resolveRenderedMaterial(planet) {
  if (!planet || planet.isMesh !== true || !planet.geometry) {
    throw new Error('fieldSampler: `planet` must be the THREE.Mesh the lab renders the body with. A material — or any object carrying one — is exactly the substitution these guards exist to catch: a reference the CALLER supplies cannot detect a program the caller swapped. The reference has to come from the scene.');
  }
  let node = planet, hops = 0;
  while (node.parent && hops++ < 256) node = node.parent;
  if (node.isScene !== true) {
    throw new Error('fieldSampler: the supplied `planet` mesh is not attached to a THREE.Scene, so nothing renders with it. Refusing to measure a program no scene draws.');
  }
  const material = planet.material;
  if (Array.isArray(material)) {
    throw new Error('fieldSampler: the planet mesh carries a material ARRAY, so there is no single rendered program to measure.');
  }
  if (!material || typeof material.fragmentShader !== 'string' || typeof material.vertexShader !== 'string') {
    throw new Error('fieldSampler: planet.material is not a ShaderMaterial with source strings. There is no program here to compile the instrument from.');
  }
  if (!material.uniforms) {
    throw new Error('fieldSampler: planet.material carries no uniforms object.');
  }
  return material;
}

/**
 * @param renderer  the lab's THREE.WebGLRenderer
 * @param planet    the PLANET MESH — the scene node the lab renders the body with. REQUIRED, and
 *        deliberately NOT a material: see resolveRenderedMaterial above. The material is RESOLVED
 *        through this mesh at construction AND re-resolved at every measurement, so the guards'
 *        reference comes from the scene rather than from the instrument's own copy.
 * @param octavesDuringRead  LOD pinned during readback; 9 matches the river router's choice AND the
 *        maximum autoOctaves ever returns, so the read is the field at the renderer's highest detail.
 */
export function createFieldSampler({ renderer, planet, octavesDuringRead = 9 } = {}) {
  // The reference source. Throws loudly on anything that is not a mesh in a scene — including the
  // pre-fix shape (a bare material), which is how round-2 counterexample 1 got in.
  const material = resolveRenderedMaterial(planet);
  const uniforms = material.uniforms;
  if (!uniforms.uOctaves || !uniforms.uFwClamp) {
    throw new Error('createFieldSampler: planet.material.uniforms must be the live planet uniform object (uOctaves / uFwClamp missing).');
  }
  if (!uniforms.uFieldTap) {
    throw new Error('createFieldSampler: the planet material carries no uFieldTap uniform, so this program has no instrument tap. Refusing to construct a sampler that would measure something else.');
  }
  // Derived ONCE, from the live material, at construction. Every read() re-resolves the material
  // through the scene graph and re-checks that neither the object nor its sources changed underneath.
  const tapVertexShader = deriveTapVertex(material.vertexShader);
  const cachedFragmentShader = material.fragmentShader;
  const cache = new Map();   // key -> { sampler, dirs } ; height samplers own a geometry + render target

  // THE REFERENCE, RE-READ at every measurement. Not memoised on purpose: a cached answer cannot see
  // `planet.material` being reassigned after construction.
  //
  // ══ LIMITS — what these guards DO and DO NOT establish. Read before strengthening any of them. ══
  //
  // ESTABLISHED: the sampler compiled its tap from a material that carries uFieldTap; that material
  // belongs to a mesh attached to a scene; and neither the material OBJECT nor its shader SOURCE has
  // changed since construction. That is enough to close the defect AC-SAMPLER exists to close — the
  // sampler silently reading the river router's bare-fbmd program instead of the composited body.
  // There is no fallback path from here to that program; omitting the tap program throws.
  // (Naming those two shader constants here would trip this file's own fence — deliberate.)
  //
  // NOT ESTABLISHED, and NOT ESTABLISHABLE FROM INSIDE THIS MODULE: that `planet` is the body the lab
  // actually renders. Every check here runs on the reference the CALLER supplied. A decoy mesh in a
  // throwaway scene satisfies all of them. Two review rounds tried to close this — removing the
  // `material` parameter only moved the substitutable binding from `material` up to `planet`, and the
  // attempt introduced a fresh tautology (instance 7, see :485). You cannot bootstrap trust in a
  // reference from the reference itself; closing it at one level always opens it one level up.
  //
  // WHERE IT IS ACTUALLY CLOSED: by the lab's own wiring, checked once, LIVE — the tap returns numbers
  // that track the rendered planet when its drivers move. That is an AC-SAMPLER live check, not a
  // headless one, and it is deliberately not claimed here. Note the distinction that matters: a decoy
  // is SABOTAGE, not a plausible refactor. The regression this module must survive is an accidental
  // reversion to the wrong program, and that IS closed. Do not spend another round hardening against
  // a hand-built adversary at the cost of more tautologies.
  const liveMaterial = () => resolveRenderedMaterial(planet);

  function samplerFor(key, dirs) {
    let entry = cache.get(key);
    if (!entry) {
      entry = {
        sampler: createHeightSampler({
          renderer, uniforms, verts: dirs, octavesDuringRead,
          // The planet's own program. No default on this path, by construction — and the
          // scene-graph resolver travels WITH it, so the deepest guard (the one at the point the
          // number is produced) checks against the scene rather than against this same material.
          tapProgram: { material, vertexShader: tapVertexShader, renderedMaterial: liveMaterial },
          // The lab vertex shader declares these; a point cloud has no natural value for them. They
          // reach Stage-6 albedo only — never h or grad.
          extraAttributes: { aBand: 1, aShear: 1, aMush: 1, aStorm: 1 },
        }),
        dirs,
      };
      cache.set(key, entry);
    }
    return entry;
  }

  // Refuse the states in which the tapped locals either do not exist or are never reached, rather
  // than returning a number that came from somewhere else.
  function assertReadable(tapPoint) {
    if (!TAP_NAMES[tapPoint]) {
      throw new Error(`fieldSampler: tapPoint must be one of TAP_COMPOSITE (1) / TAP_SOLID (2) / TAP_LIQUID (3); got ${tapPoint}. 0 is the RENDER path, not a measurement.`);
    }
    if (uniforms.uNormalMode && uniforms.uNormalMode.value === 1) {
      throw new Error('fieldSampler: uNormalMode == 1 (the finite-diff production path). That branch has no h/grad locals to tap, so there is nothing here to measure. Switch the lab to the analytic path, or use a mechanism built for the finite-diff path (AC-EXAG needs one).');
    }
    if (uniforms.uDebugMode && uniforms.uDebugMode.value !== 0) {
      throw new Error(`fieldSampler: uDebugMode == ${uniforms.uDebugMode.value}. The debug visualiser returns before the height chain runs, so no tap is reached. Set uDebugMode = 0.`);
    }
    assertRenderedIdentity();
  }

  // ── THE ANTI-TAUTOLOGY GUARD ────────────────────────────────────────────────────────────────────
  // WHY THE REFERENCE COMES FROM WHERE IT COMES FROM (read this before changing anything here):
  //
  //   `live` is resolved by walking the PLANET MESH to its Scene and reading planet.material AT THIS
  //   MOMENT. `material` and `cachedFragmentShader` were captured at construction, from the mesh, and
  //   are what the tap program was actually compiled from. Those are TWO DIFFERENT SOURCES — the
  //   renderer's current choice, versus the instrument's committed one — which is the only reason
  //   this comparison can fail at all.
  //
  //   The shipped predecessor compared material.fragmentShader against a string cached off THAT SAME
  //   material. Both sides traced to one object, so it was true at construction by definition and
  //   could not detect the substituted-material counterexample. Do NOT "simplify" this back into a
  //   self-comparison: if both sides of a check can be reached from one object, the check is dead.
  //
  //   The === on the OBJECT is the load-bearing clause; the string and uniform comparisons catch the
  //   narrower case where the same object was mutated in place (a hot reload, a recompile).
  function assertRenderedIdentity() {
    const live = liveMaterial();
    if (live !== material) {
      throw new Error('fieldSampler: the planet mesh is NOT rendering with the material this instrument compiled its tap from. Some other program is on the body now, so every number this sampler would return describes a field nobody is looking at — the exact AC-SAMPLER defect. Dispose and rebuild the sampler against the current scene.');
    }
    if (live.fragmentShader !== cachedFragmentShader) {
      throw new Error('fieldSampler: the rendered material\'s fragmentShader string changed since this sampler was built (same object, new source — a recompile or hot reload). Refusing to measure a field the planet is not rendering; dispose and rebuild the sampler.');
    }
    if (live.uniforms !== uniforms) {
      throw new Error('fieldSampler: the rendered material no longer binds the uniforms object this sampler reads. Two uniform objects means two fields.');
    }
  }

  // Everything a reader needs to know about the state the number was taken in. Recorded rather than
  // neutralised: neutralising inputs is how the previous sampler came to measure a body nobody looks at.
  function envBlock(tapPoint) {
    const v = (name, dflt = null) => (uniforms[name] ? uniforms[name].value : dflt);
    const patchStrength = v('uRiverCarvePatchStrength', 0);
    const lodRamp = v('uLodRamp', 0);
    return {
      tapPoint, tapName: TAP_NAMES[tapPoint],
      octavesLive: v('uOctaves'), octavesPinned: octavesDuringRead,
      fwClampLive: v('uFwClamp'), fwClampPinned: 0,
      lodRamp,
      reliefBakeStrength: v('uReliefBakeStrength', 0),
      craterBakeRestore: v('uCraterBakeRestore', 0),
      seaLevel: v('uSeaLevel', -1),
      riverCarveStrength: v('uRiverCarveStrength', 0),
      riverCarvePatchStrength: patchStrength,
      bandStrength: v('uBandStrength', 0),
      // The two camera dependences that live INSIDE the field rather than in the shading. Flagged
      // only when they are actually live, so the flag means something when it appears.
      cameraConditioned: patchStrength > 0 || lodRamp > 0
        ? { riverCarvePatch: patchStrength > 0, lodRampInField: lodRamp > 0,
            note: 'uRiverCarvePatchN IS the camera direction; uLodRamp is read inside facetCombiner and ecuRelief. When these are nonzero the rendered field genuinely is camera-conditioned and so is this sample.' }
        : null,
      gasDeck: v('uBandStrength', 0) > 0
        ? 'uBandStrength > 0 — a banded gas deck is not a surface; the solid-field descriptors do not mean what they mean on a rocky body.'
        : null,
    };
  }

  /**
   * Whole-sphere sample. Returns raw height in shader units AND in km, plus the two grids the
   * descriptors read. Default 256x128 is a compromise: fine enough to resolve continental-scale form,
   * cheap enough to run M seeds x N radii without the sweep becoming an overnight job.
   */
  function sampleEquirect({ width = 256, height = 128, radiusEarth, kmPerUnit = null, tapPoint = TAP_SOLID } = {}) {
    if (!(radiusEarth > 0)) throw new Error('sampleEquirect: radiusEarth is required (physical units depend on it)');
    assertReadable(tapPoint);
    const key = `eq:${width}x${height}`;
    const dirs = cache.has(key) ? cache.get(key).dirs : equirectDirections(width, height);
    const { sampler } = samplerFor(key, dirs);
    const { height: hUnits, grad } = sampler.read(tapPoint);
    return {
      kind: 'equirect', width, height, radiusEarth,
      heightUnits: hUnits, grad, dirs,
      // Vertical calibration is opt-in and absent by default — see the header. null means "this field
      // has no km meaning on the height axis", which is the truth for the lab as it stands.
      kmPerUnit,
      heightVertical: verticalAxis(hUnits, kmPerUnit),
      grids: { physical: physicalGrid(width, height, radiusEarth), angular: angularGrid(width, height) },
      env: envBlock(tapPoint),
    };
  }

  /**
   * Km-window sample centred on a lat/lon. This is the mode that answers "how big are the forms" —
   * the patch is a flat, periodic-friendly window, which is what makes the FFT well-posed (a global
   * equirect FFT would measure the latitude seam, not the terrain).
   */
  function samplePatch({ latDeg = 0, lonDeg = 0, spanKm = 2000, width = 128, height = 128, radiusEarth, kmPerUnit = null, tapPoint = TAP_SOLID } = {}) {
    if (!(radiusEarth > 0)) throw new Error('samplePatch: radiusEarth is required (physical units depend on it)');
    assertReadable(tapPoint);
    const key = `patch:${latDeg},${lonDeg},${spanKm},${width}x${height},${radiusEarth}`;
    const dirs = cache.has(key)
      ? cache.get(key).dirs
      : patchDirections({ latDeg, lonDeg, spanKmX: spanKm, spanKmY: spanKm, radiusEarth, width, height });
    const { sampler } = samplerFor(key, dirs);
    const { height: hUnits, grad } = sampler.read(tapPoint);
    return {
      kind: 'patch', width, height, radiusEarth, latDeg, lonDeg, spanKm,
      heightUnits: hUnits, grad, dirs, kmPerUnit,
      heightVertical: verticalAxis(hUnits, kmPerUnit),
      grids: {
        physical: physicalPatchGrid(width, height, spanKm, spanKm),
        angular: angularPatchGrid(width, height, spanKm, spanKm, radiusEarth),
      },
      env: envBlock(tapPoint),
    };
  }

  /**
   * Read an ARBITRARY direction list at a chosen tap. The control legs live on this: L2 needs the
   * baked mesh's own vertex directions, L4 needs epsilon-triplet probes, L5 needs directions
   * recovered from viewport rays. Returns the raw arrays with no descriptor pass.
   */
  function sampleDirections(dirs, { tapPoint = TAP_SOLID, key = null } = {}) {
    if (!Array.isArray(dirs) || !dirs.length) throw new Error('sampleDirections: dirs must be a non-empty array of [x,y,z] unit directions');
    assertReadable(tapPoint);
    const k = key || `dirs:${dirs.length}:${dirs[0].join(',')}:${dirs[dirs.length - 1].join(',')}`;
    const { sampler } = samplerFor(k, dirs);
    const { height: hUnits, grad } = sampler.read(tapPoint);
    return { heightUnits: hUnits, grad, dirs, env: envBlock(tapPoint) };
  }

  function dispose() {
    for (const { sampler } of cache.values()) sampler.dispose();
    cache.clear();
  }

  /**
   * F2 — MAKE THE TAP-PATH OMISSION HEADLESSLY DETECTABLE.
   *
   * `tapProgram:` at the single call site in samplerFor() above is the whole no-fallback mechanism:
   * drop that one property and every height sampler this instrument builds silently renders the
   * ROUTER program (bare fbmd, no baked-cube blend, no crater restore) — which is the field
   * AC-SAMPLER exists to stop measuring. The guard against that was RUNTIME-only, so the omission
   * only surfaced in a browser and the design's CI promise was unmet.
   *
   * This builds one tiny sampler through the SAME call site the real reads go through and reports
   * what it got. Nothing here touches GL (createHeightSampler allocates THREE objects lazily and
   * defers every GL call to read()), so the fence can assert it headlessly. It is a diagnostic, not
   * a measurement: it returns no field values.
   */
  function inspectTapPath() {
    const { sampler } = samplerFor('fence:tap-path-probe', [[1, 0, 0]]);
    return {
      isTapped: sampler.isTapped,
      fragmentShader: sampler.fragmentShader,
      // Re-resolved through the scene AT CALL TIME. It must not compare against
      // `cachedFragmentShader`: that and `sampler.fragmentShader` are the same string captured from
      // the same object at the same construction moment, so the comparison was true by definition —
      // INSTANCE 7 of the guards-must-not-derive-from-the-guarded defect, committed inside the fix
      // for instance 6 and caught by review. Do not "simplify" this back to the cached value.
      // What this establishes: the material's source has not drifted since construction.
      // What it does NOT establish: that `planet` is the body the lab renders. See LIMITS below.
      compiledFromRenderedProgram: sampler.fragmentShader === liveMaterial().fragmentShader,
    };
  }

  return {
    sampleEquirect, samplePatch, sampleDirections, dispose, inspectTapPath,
    get cacheSize() { return cache.size; },
    // Exposed for the live control leg L1 and for the mutation test — both need the exact string.
    get programSource() { return cachedFragmentShader; },
    get tapVertexShader() { return tapVertexShader; },
    // The material the tap program was COMPILED FROM, captured at construction.
    get material() { return material; },
    // The material the SCENE IS RENDERING WITH, resolved through the planet mesh right now. The two
    // getters are deliberately distinct: comparing them is the only comparison that can detect a
    // substituted program, because they come from different sources. Throws if the mesh has left
    // the scene.
    get renderedMaterial() { return liveMaterial(); },
    get planet() { return planet; },
    get uniforms() { return uniforms; },
    get renderer() { return renderer; },
    get octavesDuringRead() { return octavesDuringRead; },
  };
}

/**
 * EPSILON-TRIPLET PROBES for control leg L4 (emitted gradient vs numerical derivative of emitted
 * height). For each probe direction d with orthonormal tangents t1, t2, emit d and the four
 * neighbours normalize(d ± eps·t). Because vPos is unit length (the lab's R = 1.0 and the tap vertex
 * shader sets vPos = normalize(aDir)), an arc-length step of eps along t moves position by
 * eps·t + O(eps²), so a central difference of h estimates the directional derivative directly.
 *
 * Returns { dirs, groups } where each group is { centre, t1, t2, iC, iP1, iM1, iP2, iM2 } indexing
 * into dirs.
 */
export function epsilonTripletProbes(centres, eps = 2e-3) {
  const dirs = [];
  const groups = [];
  const norm = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const step = (d, t, s) => norm([d[0] + s * eps * t[0], d[1] + s * eps * t[1], d[2] + s * eps * t[2]]);
  for (const raw of centres) {
    const d = norm(raw);
    const ref = Math.abs(d[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
    const t1 = norm(cross(d, ref));
    const t2 = cross(d, t1);           // already unit: d ⟂ t1, both unit
    const iC = dirs.length; dirs.push(d);
    const iP1 = dirs.length; dirs.push(step(d, t1, +1));
    const iM1 = dirs.length; dirs.push(step(d, t1, -1));
    const iP2 = dirs.length; dirs.push(step(d, t2, +1));
    const iM2 = dirs.length; dirs.push(step(d, t2, -1));
    groups.push({ centre: d, t1, t2, iC, iP1, iM1, iP2, iM2 });
  }
  return { dirs, groups, eps };
}

/** Least-squares y = a + b·x with R², the statistic L2 and L4 both report. */
export function regress(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return { n, slope: NaN, intercept: NaN, r2: NaN };
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const slope = sxx > 0 ? sxy / sxx : NaN;
  const r2 = (sxx > 0 && syy > 0) ? (sxy * sxy) / (sxx * syy) : NaN;
  return { n, slope, intercept: my - slope * mx, r2 };
}

/**
 * Run the descriptor pack over a sample, in BOTH frames.
 *
 * Elevation descriptors (RMS relief, hypsometry, slope) are frame-independent in the sense that they
 * are about the height axis, which is always km — but the SLOPE couples height to horizontal distance,
 * so it genuinely differs between frames and is reported per frame. Wavelengths are reported per frame
 * because that is the whole point of having frames.
 */
export function describeSample(sample) {
  const cal = sample.kmPerUnit;
  const vertUnit = cal ? 'km' : 'height-units';
  const out = {
    kind: sample.kind, radiusEarth: sample.radiusEarth,
    verticalCalibrated: !!cal, verticalUnit: vertUnit,
    physical: {}, angular: {},
  };
  // The height array used for measurement: raw units unless an explicit calibration was supplied.
  const h = sample.heightVertical;

  for (const frame of ['physical', 'angular']) {
    const grid = sample.grids[frame];
    const d = out[frame];
    d.horizontalUnit = frame === 'physical' ? 'km' : 'deg';
    d.verticalUnit = vertUnit;

    // ── valid regardless of vertical calibration ──────────────────────────────────────────────
    d.hypsometricIntegral = hypsometricIntegral(h, grid);        // a ratio: scale-invariant
    d.autocorrWavelength = autocorrWavelengthKm(h, grid);        // horizontal only
    d.totalArea = totalAreaKm2(grid);
    if (sample.kind === 'patch') {
      // THE form-size number. Not the most energetic bin — on red-noise terrain that is always the
      // window size and never moves (see spectralExcessPeak's header). This is the peak EXCESS over
      // the field's own power-law background, i.e. the scale at which there is an actual population
      // of forms rather than just roughness.
      const peak = spectralExcessPeak(h, grid);
      d.formWavelength = peak.wavelength;                        // horizontal only: km / deg by frame
      d.formExcessRatio = peak.excessRatio;                      // 1.0 = no band-limited population at all
      d.formDetected = peak.detected;
      d.spectralSlope = peak.spectralSlope;                      // vertical scaling moves the intercept, not the slope
      d.rawDominantWavelength = radialPSD(h, grid).dominantWavelengthKm;   // kept for comparison; expect ~= window size
    }
    if (sample.kind === 'equirect') d.bandCount = bandCount(h, grid).bands;

    // ── vertical-dependent: reported in whatever unit the vertical actually has ────────────────
    d.rmsRelief = rmsReliefKm(h, grid);
    const s = slopeStats(h, grid);
    d.slopeExcludedFraction = s.excludedFraction;
    if (cal) {
      d.meanSlopeDeg = s.meanDeg; d.medianSlopeDeg = s.medianDeg; d.p90SlopeDeg = s.p90Deg;
    } else {
      // atan() of a units-per-km ratio is not an angle until the vertical has a unit. Report the
      // gradient itself, and say so, rather than emitting a degree figure that means nothing.
      d.meanGradientUnitsPerHorizontal = Math.tan((s.meanDeg * Math.PI) / 180);
      d.p90GradientUnitsPerHorizontal = Math.tan((s.p90Deg * Math.PI) / 180);
      d.slopeNote = 'gradient in height-units per horizontal unit; not an angle until kmPerUnit is supplied';
    }
  }

  const w = areaWeights(sample.grids.physical);
  const m = distributionMoments(h, w);
  out.elevation = { mean: m.mean, sd: m.sd, min: m.min, max: m.max, skew: m.skew, unit: vertUnit };
  if (!cal) {
    out.verticalNote =
      'The lab relief is shaded, not displaced, and its amplitudes are dimensionless (see fieldSampler.js header). '
      + 'Vertical figures are height-units. Horizontal figures (wavelengths, densities, diameters) ARE real km.';
  }
  return out;
}

/** Apply an optional vertical calibration; returns the raw units array when there is none. */
function verticalAxis(hUnits, kmPerUnit) {
  if (!(kmPerUnit > 0)) return hUnits;
  const out = new Float64Array(hUnits.length);
  for (let i = 0; i < hUnits.length; i++) out[i] = hUnits[i] * kmPerUnit;
  return out;
}

// ═════════════════════════ THE LIVE CONTROL — window._lab.tapControl() ═════════════════════════
//
// AC-SAMPLER's control has two homes, split by what can run without a GPU. The STRUCTURAL half
// (L1's headless clauses: the taps present verbatim at their anchors, the `position` whitelist, the
// no-fallback guards) lives in tests/instrument-tap-fence.test.js and runs in the standard suite,
// because it guards what regresses silently between sessions. The VALUE half lives here and needs a
// live renderer, so it runs from the console on :5175 and its verdict is stored as a workstream
// artifact. Nothing below claims to be in CI.
//
// WHY THESE LEGS AND NOT PLANT-AND-DIFFERENCE. Round 2 of this AC died to a cancellation lemma: for
// d(x) = h_A(x) − h_B(x) differing only in a planted uniform u, every term with dg_k/du = 0 cancels
// term for term, so a sampler missing 20 of 26 combiners passed every leg. None of these legs is
// that shape:
//   L1 is not a function of field values at all — it is string identity on the compiled program.
//   L2 compares ONE configuration against independently-obtained CPU-side data, so there is no
//      second evaluation for terms to cancel against.
//   L3 plants in each term's OWN coefficient, so dg_k/du ≠ 0 for the term under test by construction,
//      and it reports a per-gate table rather than an aggregate pass.
//   L4 subtracts two DIFFERENT OBSERVABLES of one configuration (emitted gradient vs the numerical
//      derivative of emitted height), and it is proven red against the named adversary by a live
//      one-token mutation rather than assumed to discriminate.
//   L5 is the only leg that tests the one place duplication is physically unavoidable — the derived
//      vertex shader — by comparing the grid read against the planet's own mesh and vertex program.
//
/**
 * L4's VERDICT — pure, so the fence can test it without a GPU.
 *
 * F5. L4 measures the same relation at TWO tap points. At TAP_COMPOSITE both channels come out of ONE
 * cube fetch, so height and gradient are exactly consistent there BY CONSTRUCTION and whatever R²
 * shortfall remains is pure instrument noise: float readback quantisation plus the O(eps²) truncation
 * of the central difference. That number is the CEILING this probe can reach on any field — the floor
 * of achievable disagreement. The shipped leg computed it and then passed on a hardcoded
 * `real.r2 >= 0.5`, which is a silent deviation from the reviewed design: it holds the real path to a
 * constant that knows nothing about how good the probe actually is on the day.
 *
 * So the floor is USED, in two ways:
 *   · If the floor itself is not near-perfect the probe is broken, and no verdict about the real path
 *     is available — the leg reports `floorUnusable` rather than passing or failing on a number it
 *     cannot interpret. FLOOR_MIN_R2 is 0.9: the composite relation is exact, so anything materially
 *     below 1 means the epsilon, the readback or the probe geometry is wrong.
 *   · The real path is judged as a FRACTION of that measured ceiling, not against a constant. It is
 *     NOT held to the ceiling itself: two shipped terms are knowingly gradient-inconsistent by
 *     construction (the AC4 carve scales height by uRiverCarveDepth and gradient by
 *     uRiverCarveStrength; the F14 cut neglects ∇liquidMask), so the correct implementation has a
 *     genuine residual. FLOOR_FRACTION = 0.5 is a declared modelling choice, not a derivation: half
 *     the achievable R² is the most this leg can demand without failing a correct implementation.
 *
 * `separated` stays a separate and independent requirement — it is what proves the leg discriminates
 * at all, and no amount of R² substitutes for it.
 */
export const L4_FLOOR_MIN_R2 = 0.9;      // below this the PROBE is broken, not the field
export const L4_FLOOR_FRACTION = 0.5;    // declared modelling choice — see above
export function l4Verdict({ floor, real, mutant, minSeparation = 0.1 } = {}) {
  const fR2 = floor ? Number(floor.r2) : NaN;
  const rR2 = real ? Number(real.r2) : NaN;
  const mR2 = mutant ? Number(mutant.r2) : NaN;
  const separated = Number.isFinite(mR2) && Number.isFinite(rR2) && (rR2 - mR2) > minSeparation;
  if (!Number.isFinite(fR2) || fR2 < L4_FLOOR_MIN_R2) {
    return {
      pass: null, weak: !separated, separated, floorUnusable: true, floorFraction: null,
      threshold: null,
      reason: `the TAP_COMPOSITE calibration floor came back at R² = ${Number.isFinite(fR2) ? fR2.toFixed(4) : String(fR2)}, below the ${L4_FLOOR_MIN_R2} this probe must reach on a relation that is exact by construction. The instrument, not the field, is what that measures — no verdict on the real path is available until it is fixed.`,
    };
  }
  const threshold = L4_FLOOR_FRACTION * fR2;
  return {
    pass: separated && Number.isFinite(rR2) && rR2 >= threshold,
    weak: !separated, separated, floorUnusable: false,
    floorFraction: Number.isFinite(rR2) ? rR2 / fR2 : null,
    threshold,
    reason: null,
  };
}

/**
 * L2's ANCHOR GATE — pure, so the fence can test it without a GPU.
 *
 * F4. L2's claim is that at uReliefBakeStrength == 1 with uCraterBakeRestore == 0, TAP_COMPOSITE is a
 * pure textureCube of the baked relief cube and must therefore reproduce the CPU carrier the cube was
 * baked from. That claim has TWO premises, and the shipped form checked only the first:
 *
 *   1. THE UNIFORMS, right now — bake == 1, restore == 0. Away from that the composite is a blend and
 *      there is no absolute anchor to compare against.
 *
 *   2. THE CARRIER'S PROVENANCE, from the last route(). The lab already hands this in as
 *      `heightSource`, and the shipped leg never read it. route() gates on
 *      `bakedOn = uReliefBakeStrength > 0` (planet-lod-rivers.js) and records 'carrier' or 'sampler'.
 *      When the last route ran at strength 0, riverOverlay.height/grad IS the router's own bare-fbmd
 *      read — the very field AC-SAMPLER exists to stop measuring — so regressing the tap against it
 *      would compare the rendered body to bare fBm and call the disagreement a sampler bug.
 *
 * The two premises are read at DIFFERENT TIMES (the uniform now, the routing then) and can therefore
 * disagree: raise the bake strength without re-routing and premise 1 holds while premise 2 does not.
 * That is exactly the state this gate exists to refuse.
 *
 * @returns { anchored, reason } — `anchored` false means L2 must report rather than measure.
 */
export function l2AnchorGate({ reliefBakeStrength, craterBakeRestore = 0, heightSource = null } = {}) {
  const bake = Number(reliefBakeStrength), restore = Number(craterBakeRestore || 0);
  if (!Number.isFinite(bake)) return { anchored: false, reason: 'uReliefBakeStrength is not a number — the anchor state cannot be established' };
  if (Math.abs(bake - 1) > 1e-6 || Math.abs(restore) > 1e-6) {
    return { anchored: false, reason: `the absolute anchor exists only at uReliefBakeStrength == 1 and uCraterBakeRestore == 0 (radius 1 R⊕); here they are ${bake} and ${restore}, so TAP_COMPOSITE is a blend` };
  }
  if (heightSource == null) {
    return { anchored: false, reason: 'the carrier arrived with NO heightSource provenance. Without it there is no way to tell the baked carrier from the router\'s own bare-fbmd read, and regressing the tap against the latter would compare the rendered body to a field nobody displays.' };
  }
  if (heightSource !== 'carrier') {
    return { anchored: false, reason: `the last route() recorded heightSource === '${heightSource}', not 'carrier': route() gated on uReliefBakeStrength > 0 AT THAT TIME and took the router's in-shader RTT read (bare fbmd, no baked-cube blend, no crater restore). The uniform says anchored NOW; the carrier is from a differently-gated route. Re-route the body before running this leg.` };
  }
  return { anchored: true, reason: null };
}

// THREE is INJECTED rather than imported so this module keeps src/worldengine/**'s import surface
// unchanged; the caller (the lab) already holds it.
export function createTapControl({ sampler, THREE, planet, camera, getBakedCarrier = null, log = null } = {}) {
  if (!sampler || typeof sampler.sampleDirections !== 'function') throw new Error('createTapControl: `sampler` must be a createFieldSampler instance');
  if (!THREE) throw new Error('createTapControl: `THREE` must be injected (this module deliberately does not import it)');
  const uniforms = sampler.uniforms, renderer = sampler.renderer;
  // The mesh the SCENE renders with. Defaults to the sampler's own, and if the caller supplies one
  // it must be the same node — two planets would mean the control is checking a body the instrument
  // is not sampling.
  const planetMesh = planet || sampler.planet;
  const say = (m) => { if (log) log(m); };

  const bytesEqual = (a, b) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };
  const rms = (a, b) => {
    let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
    return Math.sqrt(s / Math.max(1, a.length));
  };
  const maxAbsDiff = (a, b) => {
    let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
    return m;
  };
  // A cheap, stable digest of the compiled program text. NOT sha256 — SubtleCrypto is async and this
  // whole control is deliberately synchronous so no rAF frame can land between a plant and a read.
  const digest = (s) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return `fnv1a:${h.toString(16)}:len${s.length}`;
  };
  const fib = (n) => {
    const out = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * i + 1) / n, r = Math.sqrt(Math.max(0, 1 - y * y)), phi = i * ga;
      out.push([Math.cos(phi) * r, y, Math.sin(phi) * r]);
    }
    return out;
  };

  // ── L1 — THE INSTRUMENT IS SAMPLING WHAT THE SCENE RENDERS (live half) ─────────────────────────
  //
  // ══ WHY THE REFERENCE COMES FROM THE SCENE GRAPH ══
  // The shipped form of this leg read `material.fragmentShader` off the sampler's own material and
  // compared it to `sampler.programSource`, a string the sampler had cached FROM THAT MATERIAL. Both
  // sides traced to one object, so the clause was true at construction by definition — a tautology,
  // the sixth recorded instance of that defect in this program. It also meant the leg passed against
  // a REDUCED ShaderMaterial substituted into the instrument's construction: nothing in the check
  // reached the body the lab actually draws.
  //
  // So the reference here is `sampler.renderedMaterial` — resolved by walking the PLANET MESH to its
  // Scene and reading planet.material AT CHECK TIME. That is the renderer's choice, not the
  // instrument's, and comparing the two by OBJECT IDENTITY is what makes substitution detectable.
  // DO NOT replace `rendered` with `sampler.material` to "avoid the duplicate lookup": that single
  // edit restores the tautology and deletes the leg's only real clause.
  function L1() {
    const problems = [];
    let rendered = null;
    try {
      rendered = sampler.renderedMaterial;
    } catch (e) {
      problems.push(`the rendered material could not be resolved from the scene graph: ${String(e && e.message || e)}`);
    }
    if (planetMesh && sampler.planet && planetMesh !== sampler.planet) {
      problems.push('the control was given a different planet mesh than the sampler holds — two bodies, so this leg would be checking one and measuring the other');
    }
    if (rendered && rendered !== sampler.material) {
      problems.push('SUBSTITUTION: the planet mesh renders with a different material object than the instrument compiled its tap from. Every number the sampler returns describes a field nobody is looking at.');
    }
    const frag = rendered ? rendered.fragmentShader : '';
    if (rendered && frag !== sampler.programSource) problems.push('the RENDERED material\'s fragmentShader is no longer the string the sampler compiled (same object, mutated source)');
    if (rendered && rendered.uniforms !== sampler.uniforms) problems.push('the sampler does not bind the RENDERED material\'s uniforms object');
    if (!uniforms.uFieldTap) problems.push('uFieldTap is absent from the live uniforms');
    // Read off the RENDERED program, not the sampler's copy: the taps must be present in what the
    // scene draws, which is the claim being made.
    for (const stmt of [
      'if (uFieldTap == 1){ gl_FragColor = hd; return; }',
      'if (uFieldTap == 2){ gl_FragColor = vec4(h, grad); return; }',
      'if (uFieldTap == 3){ gl_FragColor = vec4(h, grad); return; }',
    ]) if (frag.split(stmt).length - 1 !== 1) problems.push(`tap statement missing or duplicated in the RENDERED program: ${stmt}`);
    // The F2 surface, re-asserted live: the sampler this instrument builds is actually TAPPED. The
    // headless half of this clause is in the fence; here it costs nothing to confirm at runtime too.
    let tapPath = null;
    try { tapPath = sampler.inspectTapPath(); } catch (e) { problems.push(`inspectTapPath threw: ${String(e && e.message || e)}`); }
    if (tapPath && !tapPath.isTapped) problems.push('the height samplers this instrument builds carry NO tapProgram — it is rendering the router program (bare fbmd, no baked-cube blend, no crater restore)');
    if (tapPath && !tapPath.compiledFromRenderedProgram) problems.push('the built sampler did not compile the rendered program\'s own source string');
    return {
      leg: 'L1 rendered-program identity', pass: problems.length === 0, problems,
      referenceSource: 'planet mesh → Scene → mesh.material, resolved at check time (NOT the sampler\'s cached copy — that comparison is a tautology)',
      renderedIsCompiled: !!rendered && rendered === sampler.material,
      tapPath,
      programDigest: digest(frag), tapVertexDigest: digest(sampler.tapVertexShader),
      note: 'The headless half of this leg (taps at their named anchors, the `position` whitelist, the no-fallback guards, the scene-graph substitution guard, the tapped-path probe) runs in tests/instrument-tap-fence.test.js.',
    };
  }

  // ── L2 — COMPOSITE ANCHOR (absolute, one configuration, BOTH channels) ─────────────────────────
  // At uReliefBakeStrength == 1 with uCraterBakeRestore == 0, TAP_COMPOSITE is a pure textureCube of
  // the baked relief cube, so the emitted vec4 must reproduce the CPU carrier the cube was baked
  // from: R against its height, GBA against its tangent gradient.
  //
  // DECLARED NARROWING (round-3 review). This anchor exists at exactly ONE operating point: the
  // frame loop re-weights uReliefBakeStrength by the lab's bake→synth display crossover, and that
  // crossover is exactly 1 only at radius 1 R⊕. Away from that the composite is a blend and this leg
  // reports `notAnchored` instead of a number. It is "anchored at R = 1, passthrough elsewhere", NOT
  // "prefix covered everywhere". (The display-scale token itself must never appear in this file —
  // src/worldengine/** is inside the AC-ZERO-CLOBBER fence, comments included.)
  function L2({ maxPoints = 4000 } = {}) {
    if (!getBakedCarrier) return { leg: 'L2 composite anchor', pass: null, skipped: 'no getBakedCarrier supplied' };
    const carrier = getBakedCarrier();
    if (!carrier || !carrier.verts || !carrier.height) return { leg: 'L2 composite anchor', pass: null, skipped: 'no baked carrier yet — route the body first (rivers on, or reliefBakeStrength(1))' };
    const bake = uniforms.uReliefBakeStrength.value, restore = uniforms.uCraterBakeRestore ? uniforms.uCraterBakeRestore.value : 0;
    // F4 — BOTH premises, including the provenance the lab already hands us and the shipped leg
    // ignored. See l2AnchorGate's header for why the uniform alone is not enough.
    const gate = l2AnchorGate({ reliefBakeStrength: bake, craterBakeRestore: restore, heightSource: carrier.heightSource });
    if (!gate.anchored) {
      return { leg: 'L2 composite anchor', pass: null,
        notAnchored: { uReliefBakeStrength: bake, uCraterBakeRestore: restore, heightSource: carrier.heightSource ?? null },
        note: gate.reason };
    }
    const stride = Math.max(1, Math.ceil(carrier.verts.length / maxPoints));
    const dirs = [], idx = [];
    for (let i = 0; i < carrier.verts.length; i += stride) { dirs.push(carrier.verts[i]); idx.push(i); }
    const got = sampler.sampleDirections(dirs, { tapPoint: TAP_COMPOSITE, key: `L2:${stride}:${carrier.verts.length}` });
    const hCpu = [], hGpu = [], gCpu = [], gGpu = [];
    for (let k = 0; k < idx.length; k++) {
      hCpu.push(carrier.height[idx[k]]); hGpu.push(got.heightUnits[k]);
      if (carrier.grad) for (let c = 0; c < 3; c++) { gCpu.push(carrier.grad[idx[k] * 3 + c]); gGpu.push(got.grad[k * 3 + c]); }
    }
    const rH = regress(hCpu, hGpu);
    const rG = gCpu.length ? regress(gCpu, gGpu) : { n: 0, slope: NaN, r2: NaN };
    // The GBA channels are what make counterexample 3 (baked gradient dropped from the composite)
    // fail here: a dropped gradient reads as zeros against nonzero cube data, so slope collapses.
    const gpuGradMag = Math.sqrt(gGpu.reduce((s, v) => s + v * v, 0) / Math.max(1, gGpu.length));
    return {
      leg: 'L2 composite anchor', points: idx.length,
      // F4 — the provenance the anchor rests on, reported alongside the number rather than assumed.
      provenance: { heightSource: carrier.heightSource, uReliefBakeStrength: bake, uCraterBakeRestore: restore },
      height: { slope: rH.slope, r2: rH.r2 },
      gradient: { slope: rG.slope, r2: rG.r2, gpuRms: gpuGradMag },
      pass: rH.r2 > 0.98 && Math.abs(rH.slope - 1) < 0.1 && rG.r2 > 0.8 && gpuGradMag > 1e-6,
      note: 'Regression form, not exact-texel form: the relief cube\'s WebGLCubeRenderTarget is not exposed (only its texture), so per-face readRenderTargetPixels is unavailable without widening planet-lod-rivers.js\'s public surface. Tolerance therefore absorbs cube rasterisation + bilinear filtering + HalfFloat quantisation on top of the carrier→cube resampling.',
    };
  }

  // ── L3 — PER-TERM SENSITIVITY AND INVARIANCE (byte-exact, threshold-free) ──────────────────────
  // For each gate that is LIVE in this configuration: perturb it, re-read, restore, and require
  // TAP_SOLID to move IN BYTES while TAP_COMPOSITE stays byte-identical. Conversely the bake pair
  // must move TAP_COMPOSITE. GPU evaluation of one program on identical inputs is deterministic
  // within a session, so the criterion is exact equality, not a threshold.
  //
  // THE CLOBBER GUARD. The lab's rAF frame() unconditionally rewrites uOctaves, uLodRamp,
  // uReliefBakeStrength, uCraterBakeRestore, uPerturb, uNormalMode and uFwClamp every frame. If a
  // frame landed between a plant and its read, the SENSITIVITY clauses would give a loud false red —
  // but the INVARIANCE clauses would pass VACUOUSLY, because an unplanted field is trivially
  // identical to itself. So every plant is verified still in force immediately after the read, and a
  // clobber is reported as leg ERROR, never as a pass.
  const GATE_HINTS = ['uSeaLevel', 'uRiverCarveStrength', 'uRiverCarveDepth', 'uReliefBakeStrength', 'uCraterBakeRestore'];
  function liveGates() {
    const names = new Set(GATE_HINTS);
    for (const k of Object.keys(uniforms)) {
      if (/^u.*(Strength|Coverage|Amp|Density|Activity|Scale$)/.test(k) === false) continue;
      if (/Scale$/.test(k)) continue;                    // frequencies are not term gates
      names.add(k);
    }
    const out = [];
    for (const n of names) {
      const u = uniforms[n];
      if (!u || typeof u.value !== 'number') continue;
      if (n === 'uSeaLevel' ? !(u.value > -1) : !(Math.abs(u.value) > 1e-9)) continue;
      out.push(n);
    }
    return out.sort();
  }
  function L3({ dirs = null } = {}) {
    const probe = dirs || fib(1024);
    const key = 'L3:probe';
    const base = {
      [TAP_SOLID]: sampler.sampleDirections(probe, { tapPoint: TAP_SOLID, key }).heightUnits.slice(),
      [TAP_COMPOSITE]: sampler.sampleDirections(probe, { tapPoint: TAP_COMPOSITE, key }).heightUnits.slice(),
      [TAP_LIQUID]: sampler.sampleDirections(probe, { tapPoint: TAP_LIQUID, key }).heightUnits.slice(),
    };
    const table = [], errors = [];
    for (const name of liveGates()) {
      const u = uniforms[name];
      const prev = u.value;
      const planted = name === 'uSeaLevel' ? prev + 0.017 : prev * 1.37 + 0.011;
      let solid, composite, stillPlanted;
      try {
        u.value = planted;
        const which = name === 'uSeaLevel' ? TAP_LIQUID : TAP_SOLID;
        solid = sampler.sampleDirections(probe, { tapPoint: which, key }).heightUnits.slice();
        stillPlanted = u.value === planted;
        composite = sampler.sampleDirections(probe, { tapPoint: TAP_COMPOSITE, key }).heightUnits.slice();
        if (u.value !== planted) stillPlanted = false;
      } finally { u.value = prev; }
      if (!stillPlanted) { errors.push(`${name}: the plant was overwritten between set and read (the rAF frame loop owns this uniform) — leg ERROR, not a result`); continue; }
      const which = name === 'uSeaLevel' ? TAP_LIQUID : TAP_SOLID;
      const moved = !bytesEqual(base[which], solid);
      const compositeHeld = bytesEqual(base[TAP_COMPOSITE], composite);
      const isBakeTerm = name === 'uReliefBakeStrength' || name === 'uCraterBakeRestore';
      table.push({
        gate: name, value: prev, tap: which === TAP_LIQUID ? 'TAP_LIQUID' : 'TAP_SOLID',
        movedTap: moved, compositeInvariant: compositeHeld,
        expectation: isBakeTerm ? 'must move TAP_COMPOSITE' : 'must move its tap, must NOT move TAP_COMPOSITE',
        ok: isBakeTerm ? !compositeHeld : (moved && compositeHeld),
      });
    }
    return {
      leg: 'L3 per-term sensitivity and invariance', errors,
      covered: table.filter((r) => r.ok).map((r) => r.gate),
      failed: table.filter((r) => !r.ok).map((r) => r.gate),
      table,
      pass: errors.length === 0 && table.length > 0 && table.every((r) => r.ok),
      note: 'Coverage is CONFIGURATION-SCOPED and this leg never claims otherwise: combiners gated to zero in the tested preset contribute nothing to that configuration\'s field and cannot be exercised there. Run on Rocky plus at least one shell/volcanic preset AND one tidally locked preset (see L5 note).',
    };
  }

  // ── L4 — GRADIENT VS DERIVATIVE (cross-observable, mutation-tested) ────────────────────────────
  function _l4Statistic(tapPoint, tapSampler, probes) {
    const got = tapSampler(probes.dirs, tapPoint);
    const predicted = [], measured = [];
    for (const g of probes.groups) {
      const gx = got.grad[g.iC * 3], gy = got.grad[g.iC * 3 + 1], gz = got.grad[g.iC * 3 + 2];
      const d = g.centre;
      const radial = gx * d[0] + gy * d[1] + gz * d[2];
      // P·grad with P = I − dd^T: vPos is unit length, so only the tangential part of grad can show
      // up in a finite difference taken along the sphere.
      const tang = [gx - radial * d[0], gy - radial * d[1], gz - radial * d[2]];
      for (const [t, iP, iM] of [[g.t1, g.iP1, g.iM1], [g.t2, g.iP2, g.iM2]]) {
        predicted.push(tang[0] * t[0] + tang[1] * t[1] + tang[2] * t[2]);
        measured.push((got.heightUnits[iP] - got.heightUnits[iM]) / (2 * probes.eps));
      }
    }
    return { ...regress(predicted, measured), samples: predicted.length };
  }
  function L4({ centres = null, eps = 2e-3 } = {}) {
    const probes = epsilonTripletProbes(centres || fib(400), eps);
    const readReal = (dirs, tap) => sampler.sampleDirections(dirs, { tapPoint: tap, key: `L4:${dirs.length}:${eps}` });
    // FLOOR CALIBRATION, not guesswork: at TAP_COMPOSITE both channels come out of ONE cube fetch, so
    // the relation is exact there and whatever residual remains is readback + finite-difference noise.
    const floor = _l4Statistic(TAP_COMPOSITE, readReal, probes);
    const real = _l4Statistic(TAP_SOLID, readReal, probes);
    // ── the mutation: one token, on the LIVE string, never used for measurement, disposed at once ──
    const from = 'if (uFieldTap == 2){ gl_FragColor = vec4(h, grad); return; }';
    const to = 'if (uFieldTap == 2){ gl_FragColor = vec4(h, gradBase); return; }';
    // Mutate the RENDERED program's source, resolved through the scene graph — same reference source
    // as every other guard here, so the adversary is a one-token change to what the planet actually
    // draws rather than to a copy the instrument happens to hold.
    const src = sampler.renderedMaterial.fragmentShader;
    const hits = src.split(from).length - 1;
    let mutant = null, mutantMaterial = null, mutantSampler = null;
    try {
      if (hits !== 1) throw new Error(`L4 mutation: expected exactly one TAP_SOLID statement to substitute, found ${hits}`);
      mutantMaterial = new THREE.ShaderMaterial({
        vertexShader: sampler.tapVertexShader, fragmentShader: src.replace(from, to),
        uniforms, glslVersion: null,
      });
      const RIV = createTapControl._createHeightSampler;
      mutantSampler = RIV({
        renderer, uniforms, verts: probes.dirs, octavesDuringRead: sampler.octavesDuringRead,
        // THE ONE DECLARED EXCEPTION to the scene-graph reference rule. This program is deliberately
        // NOT what the planet renders — that is the entire point of an adversary — so no resolver
        // can exist for it and supplying a self-referential one would just be the tautology again.
        // createHeightSampler requires this to be said BY NAME, so silence can never pass for
        // compliance. Never used for measurement; disposed in the finally block below.
        tapProgram: { material: mutantMaterial, vertexShader: sampler.tapVertexShader,
          notTheRenderedProgram: 'L4 adversary: the rendered program with the TAP_SOLID gradient slot substituted, built to prove this leg discriminates. Measured against, never measured with.' },
        extraAttributes: { aBand: 1, aShear: 1, aMush: 1, aStorm: 1 },
      });
      const readMutant = (dirs, tap) => {
        const r = mutantSampler.read(tap);
        return { heightUnits: r.height, grad: r.grad };
      };
      mutant = _l4Statistic(TAP_SOLID, readMutant, probes);
    } finally {
      if (mutantSampler) mutantSampler.dispose();
      if (mutantMaterial) mutantMaterial.dispose();
    }
    // F5 — the floor computed above is now the CRITERION, not a discarded diagnostic. See l4Verdict.
    const verdict = l4Verdict({ floor, real, mutant });
    return {
      leg: 'L4 gradient vs derivative', eps,
      floorAtComposite: { slope: floor.slope, r2: floor.r2, samples: floor.samples },
      real: { slope: real.slope, r2: real.r2, samples: real.samples },
      gradBaseMutant: mutant ? { slope: mutant.slope, r2: mutant.r2 } : null,
      // The real path judged as a fraction of the MEASURED achievable R², with the threshold that
      // fraction implies. `floorUnusable` means the probe itself failed calibration and no verdict
      // about the field is available.
      floorFraction: verdict.floorFraction, threshold: verdict.threshold,
      floorUnusable: verdict.floorUnusable, floorNote: verdict.reason,
      pass: verdict.pass,
      weak: verdict.weak,
      note: 'If the real implementation\'s R² is not CLEARLY above the gradBase mutant\'s, this leg has lost discriminating power and must be reported as WEAK rather than passed. Two shipped terms are knowingly gradient-inconsistent by construction (the AC4 carve scales height by uRiverCarveDepth and gradient by uRiverCarveStrength; the F14 cut neglects ∇liquidMask), so the correct implementation has a nonzero residual too — which is why the bar is a declared FRACTION of the measured composite floor rather than the floor itself.',
    };
  }

  // ── L5 — VERTEX-PLUMBING PARITY AND FADE GAP ───────────────────────────────────────────────────
  // The ONLY leg that tests the one place duplication is physically unavoidable. Render the planet's
  // OWN geometry with its OWN vertex shader and the live camera into a float target at uFieldTap = 2,
  // recover each sampled pixel's object-space direction by ray-casting to the unit sphere, feed those
  // exact directions to the grid sampler, and compare. A hand-written shim with vPos un-normalised, a
  // geometry radius other than 1, or a varying keyed to the wrong thing fails here immediately.
  function L5({ size = 128, stride = 7 } = {}) {
    if (!planetMesh || !camera) return { leg: 'L5 vertex-plumbing parity', pass: null, skipped: 'planet and camera must be supplied' };
    const rt = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.FloatType, format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, stencilBuffer: false,
    });
    const proxy = new THREE.Mesh(planetMesh.geometry, planetMesh.material);   // the planet's OWN geometry and OWN program, read off the SCENE NODE
    proxy.matrixAutoUpdate = false;
    planetMesh.updateMatrixWorld(true);
    proxy.matrix.copy(planetMesh.matrixWorld);
    proxy.frustumCulled = false;
    const scn = new THREE.Scene(); scn.add(proxy);
    const prevClear = new THREE.Color();
    const inv = new THREE.Matrix4().copy(planetMesh.matrixWorld).invert();
    const camO = camera.position.clone().applyMatrix4(inv);

    function renderViewport({ octaves, fwClamp }) {
      const pOct = uniforms.uOctaves.value, pFw = uniforms.uFwClamp.value, pTap = uniforms.uFieldTap.value;
      const pTarget = renderer.getRenderTarget();
      renderer.getClearColor(prevClear); const pAlpha = renderer.getClearAlpha();
      const buf = new Float32Array(size * size * 4);
      try {
        uniforms.uOctaves.value = octaves; uniforms.uFwClamp.value = fwClamp; uniforms.uFieldTap.value = TAP_SOLID;
        renderer.setRenderTarget(rt);
        renderer.setClearColor(0x000000, 0); renderer.clear();
        renderer.render(scn, camera);
        renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
      } finally {
        renderer.setRenderTarget(pTarget); renderer.setClearColor(prevClear, pAlpha);
        uniforms.uOctaves.value = pOct; uniforms.uFwClamp.value = pFw; uniforms.uFieldTap.value = pTap;
      }
      return buf;
    }

    // Object-space ray for pixel (px, py) → the unit-sphere hit direction, or null on a miss.
    const v = new THREE.Vector3();
    function dirForPixel(px, py) {
      const ndcx = ((px + 0.5) / size) * 2 - 1, ndcy = ((py + 0.5) / size) * 2 - 1;
      v.set(ndcx, ndcy, 0.5).unproject(camera).applyMatrix4(inv);
      const d = v.sub(camO).normalize();
      const b = camO.dot(d), c = camO.dot(camO) - 1;
      const disc = b * b - c;
      if (disc <= 0) return null;
      const t = -b - Math.sqrt(disc);
      if (t <= 0) return null;
      return [camO.x + t * d.x, camO.y + t * d.y, camO.z + t * d.z];
    }

    let out;
    try {
      const octLive = uniforms.uOctaves.value, fwLive = uniforms.uFwClamp.value;
      const pinned = renderViewport({ octaves: sampler.octavesDuringRead, fwClamp: 0 });
      const live = renderViewport({ octaves: octLive, fwClamp: fwLive });
      const dirs = [], idxs = [];
      for (let py = 0; py < size; py += stride) {
        for (let px = 0; px < size; px += stride) {
          const d = dirForPixel(px, py);
          if (!d) continue;
          dirs.push(d); idxs.push((py * size + px) * 4);
        }
      }
      if (dirs.length < 16) { out = { leg: 'L5 vertex-plumbing parity', pass: null, skipped: `only ${dirs.length} pixels hit the body — point the camera at the planet` }; }
      else {
        const grid = sampler.sampleDirections(dirs, { tapPoint: TAP_SOLID, key: `L5:${dirs.length}` });
        const vp = new Float32Array(dirs.length), gr = new Float32Array(dirs.length), vpLive = new Float32Array(dirs.length);
        for (let i = 0; i < dirs.length; i++) { vp[i] = pinned[idxs[i]]; gr[i] = grid.heightUnits[i]; vpLive[i] = live[idxs[i]]; }
        const r = regress(Array.from(gr), Array.from(vp));
        out = {
          leg: 'L5 vertex-plumbing parity', pixels: dirs.length,
          parity: { slope: r.slope, r2: r.r2, rms: rms(vp, gr), maxAbs: maxAbsDiff(vp, gr) },
          // A MEASURED NUMBER for what pinning octaves and disabling the sub-pixel fade costs, not an
          // assertion that it does not matter.
          fadeGap: { rms: rms(vpLive, vp), maxAbs: maxAbsDiff(vpLive, vp), octavesLive: octLive, octavesPinned: sampler.octavesDuringRead, fwClampLive: fwLive },
          pass: r.r2 > 0.99 && Math.abs(r.slope - 1) < 0.02,
          note: 'The tolerance floor here is the sphere tessellation chord error, and the round-3 review corrected the design\'s figure: SphereGeometry(R, 256, 256) has widthSegments spanning 2π (step 0.0245 rad, sag ~7.5e-5) and heightSegments spanning π (step 0.0123 rad, sag ~1.9e-5). The LARGER of the two governs. Read the reported rms as a measurement against that scale rather than against a derived constant.',
        };
      }
    } finally {
      rt.dispose();
      scn.remove(proxy);
    }
    return out;
  }

  function run(opts = {}) {
    const o = opts || {};
    const started = Date.now();
    const legs = {};
    legs.L1 = L1();
    try { legs.L2 = L2(o.l2 || {}); } catch (e) { legs.L2 = { leg: 'L2 composite anchor', error: String(e && e.message || e) }; }
    try { legs.L3 = L3(o.l3 || {}); } catch (e) { legs.L3 = { leg: 'L3 per-term sensitivity', error: String(e && e.message || e) }; }
    try { legs.L4 = L4(o.l4 || {}); } catch (e) { legs.L4 = { leg: 'L4 gradient vs derivative', error: String(e && e.message || e) }; }
    try { legs.L5 = L5(o.l5 || {}); } catch (e) { legs.L5 = { leg: 'L5 vertex-plumbing parity', error: String(e && e.message || e) }; }
    const env = {
      octavesLive: uniforms.uOctaves.value, octavesPinned: sampler.octavesDuringRead,
      uFwClamp: uniforms.uFwClamp.value, uLodRamp: uniforms.uLodRamp ? uniforms.uLodRamp.value : null,
      uNormalMode: uniforms.uNormalMode ? uniforms.uNormalMode.value : null,
      uDebugMode: uniforms.uDebugMode ? uniforms.uDebugMode.value : null,
      uReliefBakeStrength: uniforms.uReliefBakeStrength ? uniforms.uReliefBakeStrength.value : null,
      uCraterBakeRestore: uniforms.uCraterBakeRestore ? uniforms.uCraterBakeRestore.value : null,
      uRiverCarvePatchStrength: uniforms.uRiverCarvePatchStrength ? uniforms.uRiverCarvePatchStrength.value : null,
      uFieldTapAfterRun: uniforms.uFieldTap.value,
    };
    say(`tapControl: ${Object.values(legs).filter((l) => l.pass === true).length}/5 legs green`);
    return { ac: 'AC-SAMPLER', ms: Date.now() - started, env, legs,
      verdict: Object.values(legs).every((l) => l.pass === true) ? 'all-green'
        : Object.values(legs).some((l) => l.pass === false || l.error) ? 'red' : 'incomplete' };
  }

  return { run, L1, L2, L3, L4, L5, liveGates };
}
// The mutation leg needs the sampler factory, and importing it here rather than reaching through the
// lab keeps the whole control in one file. Attached to the factory (not a module-scope import site)
// so the dependency is visible at exactly one point.
createTapControl._createHeightSampler = createHeightSampler;
