// tests/instrument-tap-fence.test.js — AC-SAMPLER control leg L1, headless half.
// Workstream: world-engine-tectonic-realism-2026-07-29.
//
// WHAT THIS GUARDS. AC-SAMPLER's whole claim is that the instrument measures the field the planet
// RENDERS, because it compiles the planet's own fragmentShader string with a uniform-gated early
// return (uFieldTap) rather than assembling a second height program. That claim is STRUCTURAL — it
// is settled by string identity and by the presence of the taps at named points in the chain — so
// the half of the control that can regress silently between sessions is exactly the half that can
// run without a GPU. It lives here. The value legs (L2 composite anchor, L3 per-term sensitivity,
// L4 gradient-vs-derivative, L5 viewport parity) need a live renderer and run from
// window._lab.tapControl() on :5175; they are NOT in CI and never claim to be.
//
// THREE CLAUSE GROUPS, and what each one is for:
//
//   A. THE TAPS ARE IN THE RENDERED CHAIN, VERBATIM, AT THEIR ANCHORS. If a future session moves a
//      tap, deletes one, adds a second early return, or slips a relief term in below TAP_SOLID, the
//      instrument silently starts measuring a prefix of the chain. Named test failure instead.
//
//   B. THE DERIVED VERTEX SHADER LEAVES NO USE OF `position` BEHIND (round-3 blocker 1). A point-
//      cloud readback cannot use a perspective vertex shader, so the vertex side is DERIVED from the
//      planet's own by substitution — and the round-3 review found that the design's three
//      substitutions missed a fourth use, `vSubstellarAngle = acos(... normalize(position) ...)`,
//      which reaches h AND grad through sublimationCombiner / glacialCombiner on any tidally locked
//      preset. The fix is not "add a fourth named substitution and count it" — an enumeration is what
//      let the fourth use hide. The fence is a WHITELIST: after derivation, no bare `position` token
//      may survive anywhere except inside the single gl_Position write. A fifth use added tomorrow
//      throws at construction instead of being silently re-keyed to the texel index.
//
//   C. THE INSTRUMENT CANNOT FALL BACK TO THE ROUTER PROGRAM (round-3 blocker 2), AND IDENTITY IS
//      CHECKED ON EVERY MEASUREMENT (round-3 blocker 3). The regression this AC exists to close is an
//      OMISSION, not a token: drop the program argument at the call site and a defaulted parameter
//      silently restores HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN while every token fence stays green.
//      So the guards here are RUNTIME, not grep: the tap path has no default program to fall back to,
//      and read() re-asserts program identity before every readback.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// Namespace imports on purpose: a named import of a not-yet-existing export is a LINK error that
// takes the whole file down with one opaque message. Namespace access lets every clause below fail
// (or pass) on its own, which is what makes this file usable as a control — the pre-fix run has to
// report WHICH legs are red, not just "the file exploded".
import * as FIELD from '../src/worldengine/instrument/fieldSampler.js';
import * as RIVERS from '../planet-lod-rivers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
// ⚠ The lab's two shaders were EXTRACTED to planet-lod-shaders.glsl.js (so the game imports the
// SAME source the lab renders). The lab's source text is therefore the HTML *plus* that module —
// this fence reads both as one corpus so its assertions keep testing what the lab compiles.
const labSrc = read('planet-lod-lab.html') + '\n' + read('planet-lod-shaders.glsl.js');
const samplerSrc = read('src/worldengine/instrument/fieldSampler.js');
const riversSrc = read('planet-lod-rivers.js');

// The three tap statements, verbatim. Kept as literals here (not imported) precisely so a change to
// the shader text has to be made in TWO places by someone who has read both.
const TAP_COMPOSITE_STMT = 'if (uFieldTap == 1){ gl_FragColor = hd; return; }';
const TAP_SOLID_STMT = 'if (uFieldTap == 2){ gl_FragColor = vec4(h, grad); return; }';
const TAP_LIQUID_STMT = 'if (uFieldTap == 3){ gl_FragColor = vec4(h, grad); return; }';

const countOf = (hay, needle) => hay.split(needle).length - 1;

// Strip GLSL comments. Needed for the `position` whitelist (the lab vertex shader's own comment
// says "object-space position", which a naive token scan would flag) and for the "nothing but
// comments between TAP_SOLID and the sea cut" clause.
function stripGlslComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');
}

// Pull a /* glsl */ `…` template body out of the lab by the JS const that holds it.
function labShaderSource(constName) {
  // The two shaders were extracted to planet-lod-shaders.glsl.js, where they are exported under
  // module-scoped names. The lab still holds `const vertexShader = LAB_VERTEX_SHADER`, so the
  // literal body now lives under the export name — same text, same corpus, different const.
  const EXTRACTED = { vertexShader: 'LAB_VERTEX_SHADER', fragmentShader: 'LAB_FRAGMENT_SHADER' };
  const declName = EXTRACTED[constName] || constName;
  const at = labSrc.indexOf(`const ${declName} = /* glsl */ \``);
  expect(at, `const ${declName} = /* glsl */ \` must be present in the lab source`).toBeGreaterThanOrEqual(0);
  const open = labSrc.indexOf('`', at);
  let k = open + 1;
  while (k < labSrc.length) {
    if (labSrc[k] === '\\') { k += 2; continue; }
    if (labSrc[k] === '`') break;
    k++;
  }
  return labSrc.slice(open + 1, k);
}

// The ANALYTIC branch of the lab fragment main() — the `else` of `if (uNormalMode == 1){`. Walked by
// brace matching so the slice cannot drift with line numbers.
function analyticBranch() {
  const split = labSrc.indexOf('if (uNormalMode == 1){');
  expect(split, 'the uNormalMode analytic/finite-diff split must be present').toBeGreaterThanOrEqual(0);
  const elseAt = labSrc.indexOf('} else {', split);
  expect(elseAt, 'the analytic `} else {` must follow the uNormalMode split').toBeGreaterThan(split);
  const open = labSrc.indexOf('{', elseAt + 1);
  let depth = 0, i = open;
  for (; i < labSrc.length; i++) {
    if (labSrc[i] === '{') depth++;
    else if (labSrc[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return labSrc.slice(open, i);
}

describe('AC-SAMPLER L1/A — the three taps live in the RENDERED chain, verbatim, at their anchors', () => {
  it('the lab fragment shader declares `uniform int uFieldTap;` exactly once', () => {
    // Declared lab-side only. planet-lod-height.glsl.js and planet-lod-uniforms.js are deliberately
    // untouched, so the shared GLSL, the router program and the headless/golden uniform set are
    // unchanged by this AC.
    expect(countOf(labSrc, 'uniform int uFieldTap;')).toBe(1);
    expect(read('planet-lod-height.glsl.js')).not.toMatch(/uFieldTap/);
    expect(read('planet-lod-uniforms.js')).not.toMatch(/uFieldTap/);
  });

  it('BOTH composite writes carry the baked cube\'s GRADIENT channels, not only its height (F1)', () => {
    // F1. TAP_COMPOSITE emits `hd` whole — R = height, GBA = gradient — and L2's gradient regression
    // is what makes round-2 counterexample 3 (the baked gradient dropped from the composite) fail
    // live. But the headless half did not pin the gradient channel at all: replacing
    // `baked.yzw * uReliefBakeStrength` with `vec3(0.0)` left every anchor clause below green,
    // because those clauses pin where the tap SITS, not what the chain PUTS THERE. The crater line
    // was pinned only incidentally, by the anchor regex above happening to quote the whole line.
    // Both writes are now pinned deliberately, and this is the clause that says why.
    //
    // BOTH LINES, not one: the AC2 blend and the Slice-D crater restore are two independent
    // opportunities to drop a gradient, and uCraterBakeRestore = reliefBakeStrength -
    // uReliefBakeStrength is exactly the complement that keeps craters present as the bake fades.
    expect(labSrc).toContain(
      'hd = vec4(baked.x * uReliefBakeStrength, baked.yzw * uReliefBakeStrength) + synth * (1.0 - uReliefBakeStrength);',
    );
    expect(labSrc).toContain(
      'hd += vec4(cr.x * uCraterBakeRestore, cr.yzw * uCraterBakeRestore);',
    );
    // And the synth residual the blend mixes against is a full vec4 too — a `vec4(synth.x, 0,0,0)`
    // here would zero the gradient everywhere the bake is not 1.
    expect(labSrc).toContain('vec4 synth = fbmd(vPos, uOctaves, fwBase);');
  });

  it('TAP_COMPOSITE sits immediately after the crater-restore block and before `float h = hd.x;`', () => {
    // hd is already vec4(h, grad) at this point, so the tap emits both channels with no re-packing
    // and no opportunity to substitute a different variable into the gradient slot.
    expect(labSrc).toMatch(
      /hd \+= vec4\(cr\.x \* uCraterBakeRestore, cr\.yzw \* uCraterBakeRestore\);\s*\n\s*\}\s*\n\s*if \(uFieldTap == 1\)\{ gl_FragColor = hd; return; \}/,
    );
    const tapAt = labSrc.indexOf(TAP_COMPOSITE_STMT);
    const hAt = labSrc.indexOf('float h = hd.x;');
    expect(tapAt).toBeGreaterThanOrEqual(0);
    expect(hAt).toBeGreaterThan(tapAt);
    // nothing but whitespace/comment between the tap and the h declaration
    expect(stripGlslComments(labSrc.slice(tapAt + TAP_COMPOSITE_STMT.length, hAt)).trim()).toBe('');
  });

  it('TAP_SOLID sits immediately after the AC4 carve block (post-carve, pre-liquid-cut)', () => {
    expect(labSrc).toMatch(
      /grad \+= -carveGrad \* cr \* uRiverCarveStrength;[^\n]*\n\s*\}\s*\n\s*if \(uFieldTap == 2\)\{ gl_FragColor = vec4\(h, grad\); return; \}/,
    );
  });

  it('TAP_LIQUID sits immediately after the F14 standing-liquid cut', () => {
    expect(labSrc).toMatch(
      /grad = mix\(grad, vec3\(0\.0\), liquidMask\);\s*\n\s*\}\s*\n\s*if \(uFieldTap == 3\)\{ gl_FragColor = vec4\(h, grad\); return; \}/,
    );
  });

  it('the analytic branch contains EXACTLY the three tap early-returns and no other', () => {
    // Any additional gl_FragColor write or return inside the analytic branch would either shadow a
    // tap or create a fourth exit the instrument does not know about.
    const branch = stripGlslComments(analyticBranch());
    expect(countOf(branch, 'gl_FragColor')).toBe(3);
    expect(countOf(branch, 'return;')).toBe(3);
    expect(countOf(branch, TAP_COMPOSITE_STMT)).toBe(1);
    expect(countOf(branch, TAP_SOLID_STMT)).toBe(1);
    expect(countOf(branch, TAP_LIQUID_STMT)).toBe(1);
  });

  it('NOTHING writes h or grad between TAP_SOLID and the F14 cut (the tap really is the solid surface)', () => {
    // ADDITION beyond the round-3 design, closing the reviewer's "the fence pins the tap's textual
    // anchor, not the chain's membership" finding in its cheapest form: a relief term added below the
    // carve block would render but not be measured, and every anchor clause above would still pass.
    // Today that span is pure comment; assert it stays pure comment.
    const branch = analyticBranch();
    const from = branch.indexOf(TAP_SOLID_STMT) + TAP_SOLID_STMT.length;
    const to = branch.indexOf('if (uSeaLevel > -1.0){');
    expect(from).toBeGreaterThan(0);
    expect(to).toBeGreaterThan(from);
    expect(stripGlslComments(branch.slice(from, to)).trim()).toBe('');
  });

  it('uFieldTap defaults to 0 lab-side exactly once, and the lab never writes .value on it', () => {
    // The set/restore pair lives in createHeightSampler.read()'s finally block and nowhere else. A
    // second writer is how the planet ends up rendering raw float field data as colour.
    expect(countOf(labSrc, 'uniforms.uFieldTap = { value: 0 };')).toBe(1);
    expect([...labSrc.matchAll(/uFieldTap\.value\s*=/g)].length).toBe(0);
    // The single owner of the set/restore pair. It reads the uniform through a local alias so the
    // router/tributary path can skip it entirely, hence the alias assertion rather than a `.value =`
    // grep — the point is that exactly one module drives it, and it is not the lab.
    expect(riversSrc).toMatch(/const tapU = tapProgram \? uniforms\.uFieldTap : null;/);
    expect([...riversSrc.matchAll(/tapU\.value\s*=/g)].length).toBe(2);   // set, and restore in `finally`
  });
});

describe('AC-SAMPLER L1/B — deriveTapVertex leaves NO use of `position` behind (blocker 1)', () => {
  const labVert = labShaderSource('vertexShader');

  it('the lab vertex shader is the one this derivation was written against', () => {
    // Pin the premise. If the lab vertex main changes shape, the derivation must be re-read, not
    // silently re-run: this is the one place duplication is physically unavoidable.
    expect(labVert).toMatch(/vPos = position;/);
    expect(labVert).toMatch(/vObjN = normalize\(position\);/);
    expect(labVert).toMatch(/vSubstellarAngle = acos\(clamp\(dot\(normalize\(position\), normalize\(uLightDir\)\), -1\.0, 1\.0\)\);/);
    expect(labVert).toMatch(/gl_Position = projectionMatrix \* modelViewMatrix \* vec4\(position, 1\.0\);/);
  });

  it('deriveTapVertex is exported from the instrument', () => {
    expect(typeof FIELD.deriveTapVertex).toBe('function');
  });

  it('the derived source has NO bare `position` outside the single gl_Position write (the whitelist)', () => {
    const derived = FIELD.deriveTapVertex(labVert);
    const code = stripGlslComments(derived);
    // Remove the ONE whitelisted statement, then no `position` token may remain anywhere.
    const whitelisted = 'gl_Position = vec4(position.xy, 0.0, 1.0); gl_PointSize = 1.0;';
    expect(countOf(code, whitelisted)).toBe(1);
    expect(code.split(whitelisted).join('')).not.toMatch(/\bposition\b/);
  });

  it('vPos, vObjN AND vSubstellarAngle are all keyed to aDir (the missed fourth substitution)', () => {
    const derived = FIELD.deriveTapVertex(labVert);
    expect(derived).toContain('attribute vec3 aDir;');
    expect(derived).toContain('vPos = normalize(aDir);');
    expect(derived).toContain('vObjN = normalize(aDir);');
    // THE blocker. vSubstellarAngle reaches h and grad via sublimationCombiner and glacialCombiner
    // under uFrostLocked == 1 (Eyeball / Europa / Hot Jupiter presets), upstream of all three taps.
    expect(derived).toContain('vSubstellarAngle = acos(clamp(dot(normalize(aDir), normalize(uLightDir)), -1.0, 1.0));');
    expect(derived).toContain('gl_PointSize = 1.0;');
  });

  it('a FIFTH use of `position` added to the vertex shader makes derivation THROW', () => {
    // This is the clause that makes the whitelist load-bearing rather than decorative. An
    // enumeration of named targets passes on exactly this input; the whitelist does not.
    const withFifthUse = labVert.replace(
      'vBand = aBand;',
      'vMush = position.y * 0.5;\n        vBand = aBand;',
    );
    expect(withFifthUse).not.toBe(labVert);
    // F3 — the pattern must name the WHITELIST throw specifically. /position/i does not: every
    // substitution-target string in TAP_VERTEX_SUBSTITUTIONS contains the word `position`, so a
    // substitution-COUNT failure satisfies it just as well and this clause would pass while testing
    // something else entirely.
    expect(() => FIELD.deriveTapVertex(withFifthUse)).toThrow(/survive the derivation outside the point-placement write/);
  });

  it('derivation THROWS when a substitution target is missing or duplicated', () => {
    // F3 — every clause here used a bare .toThrow(), which any error satisfies. It passed VACUOUSLY
    // before the fix: a TypeError from a not-yet-existing export is an error too. Each pattern below
    // now names the specific failure AND its count, so a missing-target throw cannot stand in for a
    // duplicated-target throw or for a link error.
    expect(() => FIELD.deriveTapVertex(labVert.replace('vPos = position;', 'vPos = vec3(0.0);')))
      .toThrow(/expected EXACTLY ONE occurrence of "vPos = position;"[\s\S]*found 0/);
    expect(() => FIELD.deriveTapVertex(labVert.replace('vObjN = normalize(position);', 'vObjN = normalize(position); vObjN = normalize(position);')))
      .toThrow(/expected EXACTLY ONE occurrence of "vObjN = normalize\(position\);"[\s\S]*found 2/);
    expect(() => FIELD.deriveTapVertex(''))
      .toThrow(/expected the planet material's vertexShader string/);
  });
});

describe('AC-SAMPLER L1/C — the instrument cannot fall back to the router program (blockers 2 + 3)', () => {
  // A minimal stand-in for the planet material. Only the fields the instrument reads.
  const makeUniformsStub = () => ({
    uOctaves: { value: 5 }, uFwClamp: { value: 1 }, uFieldTap: { value: 0 },
    uNormalMode: { value: 0 }, uDebugMode: { value: 0 },
  });
  const makeMaterialStub = (uniforms = makeUniformsStub()) => (
    { fragmentShader: 'void main(){ gl_FragColor = vec4(1.0); }', vertexShader: labShaderSource('vertexShader'), uniforms }
  );
  // A minimal stand-in for the SCENE NODE. The instrument takes this, not a material: its reference
  // for "what am I supposed to be sampling" has to come from the renderer's choice, not the
  // caller's. `parent` terminating at an isScene object is part of the contract — without it a bare
  // `{ isMesh: true, material }` literal would put the caller back in charge of the reference.
  const makePlanetStub = (material = makeMaterialStub()) => (
    { isMesh: true, geometry: {}, material, parent: { isScene: true, parent: null } }
  );
  const verts = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0]];

  it('fieldSampler.js still mentions neither HEIGHT_FRAG nor ROUTER_MAIN (token fence, third net)', () => {
    expect(samplerSrc).not.toMatch(/HEIGHT_FRAG|ROUTER_MAIN/);
  });

  it('createFieldSampler THROWS without the planet MESH — omission is loud, not defaulted', () => {
    expect(typeof FIELD.createFieldSampler).toBe('function');
    expect(() => FIELD.createFieldSampler({ renderer: {}, octavesDuringRead: 9 })).toThrow(/must be the THREE\.Mesh/);
    expect(() => FIELD.createFieldSampler({ renderer: {} })).toThrow(/must be the THREE\.Mesh/);
  });

  it('createFieldSampler REFUSES a material — the reference must come from the scene, not the caller (B1)', () => {
    // THE ROOT OF BLOCKERS 1 AND 2. While the instrument accepted a material as a PARAMETER, every
    // identity guard it ran was a comparison of the caller's own choice against itself: `cachedFrag =
    // material.fragmentShader` at construction, then `material.fragmentShader !== cachedFrag` as the
    // "check". True by construction, and blind to a caller who handed in a different material.
    // Closing that means removing the channel, not strengthening the comparison — so there is no
    // material parameter at all now, and passing one is indistinguishable from passing nothing.
    const m = makeMaterialStub();
    expect(() => FIELD.createFieldSampler({ renderer: {}, material: m })).toThrow(/must be the THREE\.Mesh/);
    // …including the exact shape of round-2 counterexample 1: an object that merely CARRIES a
    // material is not a scene node either.
    expect(() => FIELD.createFieldSampler({ renderer: {}, planet: { material: m } })).toThrow(/must be the THREE\.Mesh/);
  });

  it('createFieldSampler THROWS when the mesh is not attached to a Scene (nothing renders with it)', () => {
    // The parent-chain walk is load-bearing, not decoration: without it, `{ isMesh: true, material }`
    // would satisfy the resolver and the CALLER would be choosing the reference again.
    const orphan = makePlanetStub();
    orphan.parent = null;
    expect(() => FIELD.createFieldSampler({ renderer: {}, planet: orphan })).toThrow(/not attached to a THREE\.Scene/);
    const detached = makePlanetStub();
    detached.parent = { isScene: false, parent: null };   // a Group that is in no scene
    expect(() => FIELD.createFieldSampler({ renderer: {}, planet: detached })).toThrow(/not attached to a THREE\.Scene/);
  });

  it('createFieldSampler THROWS when the material carries no uFieldTap (no tap ⇒ no measurement)', () => {
    const m = makeMaterialStub();
    delete m.uniforms.uFieldTap;
    expect(() => FIELD.createFieldSampler({ renderer: {}, planet: makePlanetStub(m) })).toThrow(/uFieldTap/);
  });

  it('SUBSTITUTING planet.material after construction makes the NEXT measurement THROW (B2)', () => {
    // ROUND-2 COUNTEREXAMPLE 1, closed structurally and headlessly. The counterexample shadowed the
    // instrument's material with a REDUCED ShaderMaterial that kept the three taps verbatim; it
    // passed the pinned call-site token, live L1, and read()'s identity assert, because every one of
    // those compared the substitute against itself.
    //
    // The guard now resolves the material through the SCENE GRAPH at check time and compares by
    // OBJECT IDENTITY, so a substitution is detectable by construction. Note the substitute here
    // shares the SAME uniforms object and would pass any string comparison you care to write — the
    // === on the object is the only clause that catches it.
    const uniforms = makeUniformsStub();
    const planet = makePlanetStub(makeMaterialStub(uniforms));
    const s = FIELD.createFieldSampler({ renderer: {}, planet });
    planet.material = makeMaterialStub(uniforms);   // a DIFFERENT object, identical source and uniforms
    expect(() => s.sampleDirections(verts, { tapPoint: FIELD.TAP_SOLID }))
      .toThrow(/NOT rendering with the material this instrument compiled/);
    // …and the live control leg's reference getter agrees, from the same source.
    expect(s.renderedMaterial).not.toBe(s.material);
    s.dispose();
  });

  it('the sampler this instrument BUILDS is tapped — the call-site omission is headless now (F2)', () => {
    // F2. `tapProgram:` at the single call site in samplerFor() is the entire no-fallback mechanism:
    // drop that one property and every sampler the instrument builds renders the ROUTER program
    // (bare fbmd, no baked-cube blend, no crater restore) — the field AC-SAMPLER exists to stop
    // measuring. The guard was RUNTIME-only, so the omission only ever surfaced in a browser and the
    // design's stated CI promise was unmet. It is checkable headlessly: createHeightSampler decides
    // tapped-vs-router at CONSTRUCTION, long before any GL work.
    const planet = makePlanetStub();
    const s = FIELD.createFieldSampler({ renderer: {}, planet });
    const probe = s.inspectTapPath();
    expect(probe.isTapped).toBe(true);
    expect(probe.compiledFromRenderedProgram).toBe(true);
    expect(probe.fragmentShader).toBe(planet.material.fragmentShader);
    s.dispose();
  });

  it('createHeightSampler.read() THROWS when asked for a tap it was not given a program for', () => {
    // THE blocker-2 shape. Drop the program at the call site and the old design silently reverted to
    // HEIGHT_FRAG. There is no default on the tap path now: the sampler refuses.
    const sampler = RIVERS.createHeightSampler({ renderer: {}, uniforms: makeUniformsStub(), verts });
    expect(() => sampler.read(FIELD.TAP_SOLID)).toThrow(/tapProgram|explicit program|router/i);
    sampler.dispose();
  });

  it('createHeightSampler THROWS on a partial tapProgram (all THREE parts required, no defaults)', () => {
    const uniforms = makeUniformsStub();
    const material = makeMaterialStub(uniforms);
    const rendered = () => material;
    expect(() => RIVERS.createHeightSampler({ renderer: {}, uniforms, verts, tapProgram: { material, renderedMaterial: rendered } }))
      .toThrow(/tapProgram\.vertexShader is required/);
    expect(() => RIVERS.createHeightSampler({ renderer: {}, uniforms, verts, tapProgram: { vertexShader: 'void main(){}', renderedMaterial: rendered } }))
      .toThrow(/tapProgram\.material must be/);
    // uniforms identity is part of the contract: the tap program must bind the SAME object.
    expect(() => RIVERS.createHeightSampler({
      renderer: {}, uniforms: makeUniformsStub(), verts,
      tapProgram: { material, vertexShader: 'void main(){}', renderedMaterial: rendered },
    })).toThrow(/uniforms/i);
    // B1 AT THE DEEPEST GUARD. Without a scene-graph resolver every identity check inside read() is
    // a comparison of the tap material against a value taken from that same material, i.e. a
    // tautology — so the resolver is REQUIRED, and its absence is a construction-time throw rather
    // than a silently weaker guard. The single legitimate exception (a program deliberately not the
    // rendered one) has to be declared by name.
    expect(() => RIVERS.createHeightSampler({
      renderer: {}, uniforms, verts, tapProgram: { material, vertexShader: 'void main(){}' },
    })).toThrow(/renderedMaterial is REQUIRED/);
    // A pre-resolved VALUE is not acceptable either: a snapshot is a reference the caller chose.
    expect(() => RIVERS.createHeightSampler({
      renderer: {}, uniforms, verts, tapProgram: { material, vertexShader: 'void main(){}', renderedMaterial: material },
    })).toThrow(/must be a FUNCTION/);
    // …and the declared exception is accepted, so the L4 adversary stays constructible.
    const adversary = RIVERS.createHeightSampler({
      renderer: {}, uniforms, verts,
      tapProgram: { material, vertexShader: 'void main(){}', notTheRenderedProgram: 'unit test: the declared exception' },
    });
    expect(adversary.isTapped).toBe(true);
    adversary.dispose();
  });

  it('read() RE-ASSERTS program identity on EVERY measurement, not only in the control leg', () => {
    // Blocker 3. The `=== planet.material.fragmentShader` check used to live in tapControl(), so a
    // real sampleField() could run against a drifted program and report nothing. It lives in read()
    // now: drift the material's fragmentShader and the very next readback throws.
    const material = makeMaterialStub();
    const holder = { material };
    const sampler = RIVERS.createHeightSampler({
      renderer: {}, uniforms: material.uniforms, verts,
      tapProgram: { material, vertexShader: FIELD.deriveTapVertex(material.vertexShader), renderedMaterial: () => holder.material },
    });
    material.fragmentShader = 'void main(){ gl_FragColor = vec4(0.0); }';   // a drifted / recompiled program
    expect(() => sampler.read(FIELD.TAP_SOLID)).toThrow(/PROGRAM IDENTITY DRIFT/);
    sampler.dispose();
  });

  it('read() THROWS when the SCENE swapped the material out from under it (B2, deepest guard)', () => {
    // The same close as the createFieldSampler clause above, asserted at the point the NUMBER IS
    // PRODUCED. Drift (same object, new source) and substitution (new object) are different
    // failures and need different clauses: the drift check above cannot see this one, because the
    // substitute's source string is byte-identical to what was compiled.
    const uniforms = makeUniformsStub();
    const material = makeMaterialStub(uniforms);
    const holder = { material };
    const sampler = RIVERS.createHeightSampler({
      renderer: {}, uniforms, verts,
      tapProgram: { material, vertexShader: FIELD.deriveTapVertex(material.vertexShader), renderedMaterial: () => holder.material },
    });
    holder.material = makeMaterialStub(uniforms);   // the scene now draws with a different object
    expect(holder.material.fragmentShader).toBe(material.fragmentShader);   // …byte-identical source
    expect(() => sampler.read(FIELD.TAP_SOLID)).toThrow(/RENDERED-PROGRAM SUBSTITUTION/);
    sampler.dispose();
  });

  it('the gradBase mutant is constructible ONLY inside the live control leg', () => {
    // Round-3 residual risk 6: the L4 mutation compiles a one-token string substitution of the live
    // shader into a throwaway material. It is derived, never used for measurement, and disposed
    // immediately — but it IS a program that is not the planet's, so it must never be reachable from
    // the measurement path. Pin it to the control.
    const controlAt = samplerSrc.indexOf('export function createTapControl');
    expect(controlAt).toBeGreaterThan(0);
    expect(samplerSrc.slice(0, controlAt)).not.toContain('gradBase');
    expect(samplerSrc.slice(controlAt)).toContain('gradBase');
  });

  it('the tap constants are the three declared points and nothing else', () => {
    expect(FIELD.TAP_COMPOSITE).toBe(1);
    expect(FIELD.TAP_SOLID).toBe(2);
    expect(FIELD.TAP_LIQUID).toBe(3);
  });

  it('the lab builds the field sampler FROM THE PLANET MESH (not from a material or a uniforms bag)', () => {
    // The call site is pinned, but note what the pin is worth and what it is NOT worth: round-2
    // counterexample 1 passed this clause by shadowing the `material` binding INSIDE
    // _ensureFieldSampler. A token pin cannot see a shadowed local.
    //
    // AN EARLIER VERSION OF THIS COMMENT CLAIMED THE RUNTIME CLAUSES CLOSE THAT HOLE. THEY DO NOT.
    // Removing the `material` parameter moved the shadowable binding from `material` to `planet`; a
    // decoy Mesh carrying a reduced material, added to a throwaway Scene, satisfies every runtime
    // clause. Review confirmed it. See the LIMITS block in fieldSampler.js — the reference is always
    // caller-supplied, so no check inside the instrument can close this, and each attempt to close it
    // has cost a fresh tautology.
    //
    // This clause's job is therefore narrower and honest: keep the SHAPE of the call site honest so a
    // reader is not misled about where the reference comes from. The substitution attack is sabotage,
    // not a plausible refactor; the regression actually being fenced is accidental reversion to the
    // router program, which the tapProgram clauses do close.
    expect(labSrc).toMatch(/createFieldSampler\(\{\s*renderer,\s*planet,\s*octavesDuringRead:\s*9\s*\}\)/);
    expect(labSrc).not.toMatch(/createFieldSampler\(\{\s*renderer,\s*uniforms,/);
    expect(labSrc).not.toMatch(/createFieldSampler\(\{\s*renderer,\s*material\b/);
  });

  it('the existing router / tributary callers pass NO tapProgram (byte-inert)', () => {
    // route() and the tributary patch must keep rendering ROUTER_MAIN exactly as before. If either
    // ever grows a tapProgram, that is a different field and this test says so.
    expect(riversSrc).toMatch(/sampler = createHeightSampler\(\{ renderer, uniforms, verts: mesh\.verts, octavesDuringRead \}\)/);
    expect(read('planet-lod-tributary-patch.js')).toMatch(/createHeightSampler\(\{ renderer, uniforms, verts: fverts, octavesDuringRead: octaves \}\)/);
  });
});

describe('AC-SAMPLER L1/E — the live legs\' verdict logic, extracted so it can be tested without a GPU', () => {
  // L2 and L4 decide pass/fail from a handful of scalars. Those decisions were buried inside legs
  // that only run in a browser, which is how F4 (a premise the lab already supplied and the leg
  // never read) and F5 (a floor computed and then discarded) survived review. The decisions are pure
  // functions now, so the fence can hold them.

  it('l2AnchorGate REQUIRES the carrier provenance the lab passes, not only the uniform (F4)', () => {
    // F4. L2's anchor claim rests on TWO premises read at DIFFERENT TIMES: the uniforms NOW, and the
    // carrier's provenance from the LAST route(). route() gates on `uReliefBakeStrength > 0` at route
    // time and records 'carrier' or 'sampler'. Raise the bake strength without re-routing and the
    // uniform says anchored while the carrier is still the router's own bare-fbmd read — the exact
    // field AC-SAMPLER exists to stop measuring. The shipped gate checked the uniform alone, so it
    // would have regressed the rendered body against bare fBm and blamed the sampler.
    expect(typeof FIELD.l2AnchorGate).toBe('function');
    expect(FIELD.l2AnchorGate({ reliefBakeStrength: 1, craterBakeRestore: 0, heightSource: 'carrier' }).anchored).toBe(true);
    // THE CLAUSE THAT WAS MISSING: uniforms anchored, provenance disagrees.
    const stale = FIELD.l2AnchorGate({ reliefBakeStrength: 1, craterBakeRestore: 0, heightSource: 'sampler' });
    expect(stale.anchored).toBe(false);
    expect(stale.reason).toMatch(/heightSource/);
    // Provenance absent entirely is also a refusal, not a default-to-trusting — and it reports a
    // DIFFERENT reason from a disagreeing provenance, because they are different faults: one is a
    // carrier from a differently-gated route, the other is a caller that stopped passing the field.
    // (Asserting the reason, not just `anchored`: without it the two branches are interchangeable
    // and the absent-provenance branch is unfalsifiable.)
    for (const absent of [{}, { heightSource: null }, { heightSource: undefined }]) {
      const g = FIELD.l2AnchorGate({ reliefBakeStrength: 1, craterBakeRestore: 0, ...absent });
      expect(g.anchored).toBe(false);
      expect(g.reason).toMatch(/NO heightSource provenance/);
    }
    // …and the pre-existing uniform premise still holds on its own.
    expect(FIELD.l2AnchorGate({ reliefBakeStrength: 0.5, craterBakeRestore: 0, heightSource: 'carrier' }).anchored).toBe(false);
    expect(FIELD.l2AnchorGate({ reliefBakeStrength: 1, craterBakeRestore: 0.3, heightSource: 'carrier' }).anchored).toBe(false);
  });

  it('l4Verdict USES the composite floor it computes, instead of a hardcoded bar (F5)', () => {
    // F5. The shipped leg measured the TAP_COMPOSITE floor — the ceiling this probe can reach on a
    // relation that is exact by construction — and then passed on `real.r2 >= 0.5`, a constant that
    // knows nothing about how good the probe was on the day. Two clauses make the floor load-bearing:
    // a bad floor means NO VERDICT (the instrument is what failed, not the field), and a good floor
    // sets the bar as a declared fraction of itself.
    expect(typeof FIELD.l4Verdict).toBe('function');
    const good = { r2: 0.99 }, mutantR2 = { r2: 0.2 };
    // Same `real` figure, three different floors ⇒ three different verdicts. A hardcoded bar cannot
    // produce this table, which is what makes the clause discriminating.
    const v1 = FIELD.l4Verdict({ floor: good, real: { r2: 0.7 }, mutant: mutantR2 });
    expect(v1.pass).toBe(true);
    expect(v1.threshold).toBeCloseTo(FIELD.L4_FLOOR_FRACTION * 0.99, 10);
    expect(v1.floorFraction).toBeCloseTo(0.7 / 0.99, 10);
    // Floor below the calibration minimum ⇒ the probe is broken ⇒ pass is NULL, not false and not true.
    const v2 = FIELD.l4Verdict({ floor: { r2: 0.4 }, real: { r2: 0.7 }, mutant: mutantR2 });
    expect(v2.pass).toBe(null);
    expect(v2.floorUnusable).toBe(true);
    expect(v2.reason).toMatch(/calibration floor/);
    // A real R² that would clear the old hardcoded 0.5 but NOT half the measured floor now fails.
    expect(FIELD.l4Verdict({ floor: good, real: { r2: 0.49 }, mutant: mutantR2 }).pass).toBe(false);
    // Separation stays an independent requirement — no R² substitutes for a discriminating adversary.
    expect(FIELD.l4Verdict({ floor: good, real: { r2: 0.9 }, mutant: { r2: 0.88 } }).pass).toBe(false);
    expect(FIELD.l4Verdict({ floor: good, real: { r2: 0.9 }, mutant: { r2: 0.88 } }).weak).toBe(true);
    // The declared constants are exported so a retune is a visible edit, not a drifting literal.
    expect(FIELD.L4_FLOOR_MIN_R2).toBe(0.9);
    expect(FIELD.L4_FLOOR_FRACTION).toBe(0.5);
  });

  it('L1 takes its reference from the SCENE, not from the sampler\'s own copy (B1, anti-tautology)', () => {
    // L1 is a LIVE leg — it needs a GPU, so no headless clause can execute it. But the defect it
    // carried is textual and recurring: `const frag = material.fragmentShader` followed by
    // `sampler.programSource !== frag`, both sides tracing to one object, true by construction. This
    // is the sixth recorded instance of that shape in this program, and the previous five were each
    // fixed locally without preventing the next. So the SHAPE is pinned, not just the behaviour: the
    // reference must be resolved through the scene graph, and the identity comparison must be on the
    // OBJECT. A future "simplification" back to the cached copy fails here.
    const l1At = samplerSrc.indexOf('function L1() {');
    expect(l1At).toBeGreaterThan(0);
    const body = samplerSrc.slice(l1At, samplerSrc.indexOf('── L2', l1At));
    expect(body).toContain('sampler.renderedMaterial');          // the scene-graph reference
    expect(body).toMatch(/rendered !== sampler\.material/);      // …compared by OBJECT identity
    // the shipped tautology, in both of the forms it took
    expect(body).not.toMatch(/const frag = material\.fragmentShader/);
    expect(body).not.toMatch(/sampler\.programSource !== frag/);
    // and the module must expose the two as DISTINCT sources, or the comparison collapses
    expect(samplerSrc).toContain('get renderedMaterial() { return liveMaterial(); }');
    expect(samplerSrc).toContain('const liveMaterial = () => resolveRenderedMaterial(planet);');
  });

  it('L2 actually PASSES the provenance to the gate, and the lab actually SUPPLIES it (F4)', () => {
    // Mutation testing of the clause above found this hole in my own work: dropping
    // `heightSource: carrier.heightSource` from L2's call fails CLOSED (the gate then reports
    // not-anchored forever, so it cannot produce a wrong number) — but it silently disables the leg,
    // which is a regression a green suite would not have shown. Both ends of the wire are pinned.
    expect(samplerSrc).toContain('l2AnchorGate({ reliefBakeStrength: bake, craterBakeRestore: restore, heightSource: carrier.heightSource })');
    // Scoped to getBakedCarrier's own object literal. A bare toContain on
    // 'heightSource: riverOverlay.heightSource' was FAIL-OPEN: that substring occurs a SECOND time in
    // an unrelated _lab probe, so deleting it from getBakedCarrier left the fence green. Match the
    // grad/heightSource pair that only the carrier literal has.
    expect(labSrc).toMatch(/grad:\s*riverOverlay\.grad,\s*\n\s*heightSource:\s*riverOverlay\.heightSource/);
    // …and the router still records it, so there is something real on the other end of that getter.
    expect(riversSrc).toMatch(/lastHeightSource = bakedOn \? 'carrier' : 'sampler';/);
    expect(riversSrc).toMatch(/get heightSource\(\) \{ return lastHeightSource; \}/);
  });

  it('L4 reads its verdict from l4Verdict and carries no second hardcoded R² bar', () => {
    // Guard the extraction itself: re-introducing `real.r2 >= <literal>` inside the leg would restore
    // the silent deviation the extraction exists to remove.
    const l4At = samplerSrc.indexOf('function L4({');
    expect(l4At).toBeGreaterThan(0);
    const body = samplerSrc.slice(l4At, samplerSrc.indexOf('── L5', l4At));
    expect(body).toContain('l4Verdict({ floor, real, mutant })');
    expect(body).not.toMatch(/real\.r2\s*>=\s*[0-9]/);
  });
});

describe('AC-SAMPLER L1/D — the edit does not disturb the standing fences', () => {
  it('the instrument carries no display-scale token (re-assert at the new surface)', () => {
    const DENY = /visScaleOf|\bsVis\b|VIS_SCALE_EXP/;
    expect(samplerSrc).not.toMatch(DENY);
    expect(riversSrc).not.toMatch(DENY);
  });

  it('the lab still carries at least the 8 /* glsl */ markers vis-scale-fence counts', () => {
    expect(countOf(labSrc, '/* glsl */')).toBeGreaterThanOrEqual(8);
  });

  it('no tap comment contains a backslash (it would swallow the fence extractor\'s region boundary)', () => {
    // tests/vis-scale-fence.test.js:88 treats `\` as an escape and skips the next character, so a
    // trailing backslash in a shader comment reshapes which text the DENY scan sees.
    for (const stmt of [TAP_COMPOSITE_STMT, TAP_SOLID_STMT, TAP_LIQUID_STMT]) {
      const at = labSrc.indexOf(stmt);
      expect(at).toBeGreaterThanOrEqual(0);
      const lineEnd = labSrc.indexOf('\n', at);
      expect(labSrc.slice(at, lineEnd)).not.toContain('\\');
    }
    const decl = labSrc.indexOf('uniform int uFieldTap;');
    expect(labSrc.slice(decl - 400, decl)).not.toContain('\\');
  });
});
