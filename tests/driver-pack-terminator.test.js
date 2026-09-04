// tests/driver-pack-terminator.test.js
// ─────────────────────────────────────────────────────────────────────────────
// F35's TERMINATOR, CONVERGED — one declared value (`TERMINATOR_ENABLED`, Max 2026-07-16) read by
// the GAME's gate policy and by BOTH of the LAB's producers, the bypass pair given its one display
// policy, and the lab's retyped width law deleted. Workstream
// wire-terminator-gradient-lab-into-game; contract ACs 0, 1 and 2 (the headless half). AC-3 and AC-4
// are live (chrome-devtools); AC-5 is Max's walk and no agent may pass it.
//
// ⭐ THE EVIDENCE STANDARD (§11.3.3): every gate that could be vacuous carries an EXECUTED control
// marked `[CONTROL]` — the thing the gate guards is broken IN-TEST, the gate is shown RED, the break
// is discarded. ⛔ A control that only logs is not a control. Every one below asserts red.
//
// ⛔ WHAT THIS FILE DOES NOT CLAIM:
//  1. It does not claim Max SEES the band vanish. That is AC-3's live pair and his walk (AC-5). It
//     claims the strength's gate is answered by one value that both front-ends read.
//  2. It does not re-type the lab's law as its expectation. AC-0's expectation is a FIXTURE of the
//     LAB'S OWN sliced source run at the parent f0b93aa BEFORE the deletion
//     (tests/fixtures/term-lab-baseline.json, scripts/capture-term-lab-baseline.mjs), and AC-1/AC-2's
//     is every pack's resolved drivers captured at the same commit
//     (tests/fixtures/term-pack-drivers-baseline.json).
//  3. ⛔ IT DOES NOT CLAIM 0.15. That number is the CEILING of `columnFraction × TERM_STRENGTH`, not
//     the population's constant — `rocky-3/planet/0` resolves 0.130327 at 0.105 bar. Every assertion
//     about the change is about the SET of bodies that move and about `> 0` per body.
//  4. It does not claim the LEGACY material follows the ruling. It does not: src/objects/Planet.js:1653
//     writes `uTermStrength` ungated on Sol and the gallery bodies. That divergence is DECLARED —
//     tests/material-parity-list.test.js records it, and the deny-scan below only refuses NEW ones.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DRIVER_PRESETS } from '../driver-presets.js';
import { ASSOCIATIONS, DEFAULT_DRESSING, buildDefaultDressing } from '../planet-feature-associations.js';
import { PACKS, gatesFor, GATE_POLICY_ALL_ON, GATE_POLICY_RULED, GATE_RULINGS } from '../src/worldengine/drivers/index.js';
import { SOLID_OPTICS_ENTRY, TERMINATOR_ENABLED, TERMINATOR_GATE, AURORA_GATE, solidOpticsPack } from '../src/worldengine/drivers/solidOptics.js';
import { GIANT_SURFACE_ENTRY, giantSurfacePack } from '../src/worldengine/drivers/giantSurface.js';
import { resolveDriver, PackContractError, scalar, writePackUniforms } from '../src/worldengine/port/writePackUniforms.js';
import { buildLabPlanetMaterial, TERM_BYPASS, LIMB_BYPASS } from '../src/rendering/LabPlanetMaterial.js';
import { labPackCtx, setLabGasBodiesOverride } from '../src/objects/Planet.js';
import { registerTermAB, unregisterTermAB, toggleTermAB, termOn, termOff, recordTerm } from '../src/rendering/labTermAB.js';
import { corpus, resolvedPacks, presetRows, MESH } from './fixtures/ray-pack-corpus.mjs';
import { sliceLab, runLabRows, readStateLiteralTokens } from './fixtures/term-lab-harness.mjs';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const strip = (s) => stripCommentsPreservingOffsets(s, { blankLiteralText: true });
const stripKeepText = (s) => stripCommentsPreservingOffsets(s);   // ⚠ COMMENTS GONE, STRING LITERALS KEPT — the allow-scans look for IMPORT SPECIFIERS, which live inside quotes.

const LAB_SRC = src('world-engine-lab.html');
const LAB_FIXTURE = JSON.parse(src('tests/fixtures/term-lab-baseline.json'));
const PACK_FIXTURE = JSON.parse(src('tests/fixtures/term-pack-drivers-baseline.json'));
const TERM = 'uTermStrength';

const CORPUS = corpus();
const SOLID = CORPUS.filter((b) => b.cls !== 'gas');
const GAS = CORPUS.filter((b) => b.cls === 'gas');
const byId = (id) => CORPUS.find((b) => b.id === id);
const ctxOf = (b) => labPackCtx(b.d, b.cond, MESH);

/** The entry that claims this body's terminator; their predicates are exact complements. */
const termEntryFor = (cond, ctx) => PACKS.find((e) => (e.name === 'solidOptics' || e.name === 'giantSurface') && e.applies(cond, ctx) === true);

/** Resolve the terminator triple for one body under a named policy — the writer's own route. */
function termOf(b, policy = GATE_POLICY_RULED, cond = b.cond) {
  const ctx = ctxOf(b);
  const entry = termEntryFor(cond, ctx);
  const packCtx = { ...ctx, gates: gatesFor(entry, policy) };
  const r = entry.pack(cond, packCtx);
  return {
    entry: entry.name,
    uTermStrength: resolveDriver('uTermStrength', r.drivers.uTermStrength, packCtx),
    uTermWidth: resolveDriver('uTermWidth', r.drivers.uTermWidth, packCtx),
    uTermColor: resolveDriver('uTermColor', r.drivers.uTermColor, packCtx),
  };
}

/** Every pack's drivers under an EXPLICIT policy — the parent fixture's own harness, policy named. */
function resolvedUnder(cond, ctx, policy) {
  const out = {};
  for (const entry of PACKS) {
    if (entry.applies(cond, ctx) !== true) continue;
    const packCtx = { ...ctx, gates: gatesFor(entry, policy) };
    const r = entry.pack(cond, packCtx);
    const drivers = {};
    for (const n of Object.keys(r.drivers)) drivers[n] = resolveDriver(n, r.drivers[n], packCtx);
    out[entry.name] = drivers;
  }
  return out;
}

// ⛔ THE GAS-BODY OVERRIDE, per the standing trap: `labPipelineAdmits` reads a localStorage flag that
// does not exist under node, and without this the gas half of the corpus takes the legacy route.
beforeAll(() => { setLabGasBodiesOverride(true); });
afterAll(() => { setLabGasBodiesOverride(null); termOff(); });

// ═════════════════════════════════════════════════════════════════════════════
// AC-0 — ONE DEFINITION, ONE SOURCE EACH.
// ═════════════════════════════════════════════════════════════════════════════
describe('AC-0 (a) — the bypass pair is display policy with one declared value', () => {
  it('both constants are declared false in LabPlanetMaterial.js and the lab imports THOSE names', () => {
    expect(TERM_BYPASS).toBe(false);
    expect(LIMB_BYPASS).toBe(false);
    const mat = strip(src('src/rendering/LabPlanetMaterial.js'));
    expect(mat).toMatch(/export const TERM_BYPASS = false;/);
    expect(mat).toMatch(/export const LIMB_BYPASS = false;/);
    // ⛔ THE LAB READS THEM RATHER THAN RESTATING THEM — asserted on the TOKEN, not on the value.
    // Both commits have `false` in that slot; only the token separates "restates it" from "reads it".
    const tokens = readStateLiteralTokens(LAB_SRC);
    expect(tokens.termBypass).toBe('TERM_BYPASS');
    expect(tokens.limbBypass).toBe('LIMB_BYPASS');
  });

  it('both bypass uniforms are 0 on every corpus body and every preset material', () => {
    let materials = 0;
    for (const b of CORPUS) {
      const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
      expect(built.material.uniforms.uTermBypass.value, b.id).toBe(0);
      expect(built.material.uniforms.uLimbBypass.value, b.id).toBe(0);
      materials++;
    }
    for (const row of presetRows()) {
      const built = buildLabPlanetMaterial({ bodyRadius: 1 });
      expect(built.material.uniforms.uTermBypass.value, row.name).toBe(0);
      expect(built.material.uniforms.uLimbBypass.value, row.name).toBe(0);
      materials++;
    }
    // [CONTROL — non-empty] a claim about 174 materials, not about none.
    expect(materials).toBe(CORPUS.length + Object.keys(DRIVER_PRESETS).length);
    expect(materials).toBe(174);
  });

  it('[CONTROL] the parameter seam carries `true`, and the default carries the CONSTANT', () => {
    // ⛔ THIS IS THE CONTROL THE STORM WORKSTREAM PAID FOR (handoff-2026-09-03b §2 trap 4): "flip the
    // constant in a test copy" is not executable against a `const` export, so the constant reaches
    // the material through a parameter and the parameter is what a control flips.
    expect(buildLabPlanetMaterial({ termBypass: true }).material.uniforms.uTermBypass.value).toBe(1);
    expect(buildLabPlanetMaterial({ limbBypass: true }).material.uniforms.uLimbBypass.value).toBe(1);
    expect(buildLabPlanetMaterial({}).material.uniforms.uTermBypass.value).toBe(TERM_BYPASS ? 1 : 0);
    expect(buildLabPlanetMaterial({}).material.uniforms.uLimbBypass.value).toBe(LIMB_BYPASS ? 1 : 0);
    // ⚠ `?? CONST` and not `|| CONST`: an explicit `false` must reach the material as `false`.
    expect(buildLabPlanetMaterial({ termBypass: false }).material.uniforms.uTermBypass.value).toBe(0);
  });

  it('the bypass write is byte-INERT — the shared bag already defaults both to 0', () => {
    // Recorded rather than assumed: AC-0 claims the write changes no pixel today, and the evidence
    // is the factory default, not an argument. `uniforms.js:43` / `:51`.
    const u = strip(src('src/worldengine/shaders/uniforms.js'));
    expect(u).toMatch(/uLimbBypass:\s*\{ value: 0 \}/);
    expect(u).toMatch(/uTermBypass:\s*\{ value: 0 \}/);
  });

  it('RECORDED: uTermBypass\'s only consumer sits inside the `uTermStrength > 0.0` block', () => {
    // The 4/4 records a wired PRODUCER, not a game rendering path. Under the ruling the band's
    // strength is 0, so the branch that reads the bypass cannot be entered in the game — and it
    // becomes reachable with no further change the day Max rules the band back on. Asserted so the
    // claim is a property of the shader text rather than a sentence in a doc.
    const glsl = src('src/worldengine/shaders/planetShaders.glsl.js');
    const open = glsl.indexOf('uTermStrength > 0.0');
    expect(open, 'the `uTermStrength > 0.0` block is the anchor for this claim').toBeGreaterThan(0);
    const use = glsl.indexOf('uTermBypass', open);
    expect(use, 'uTermBypass must be read AFTER the block opens').toBeGreaterThan(open);
    // …and the block has not closed before the read: no `uTermStrength` guard re-opens between them.
    expect(glsl.slice(open, use).split('\n').length).toBeLessThan(40);
  });
});

describe('AC-0 (b) — the lab\'s retyped width law is gone, and the deletion is proven by value', () => {
  const slice = sliceLab(LAB_SRC);

  it('the retype is DELETED (detected structurally, not by text search)', () => {
    expect(LAB_FIXTURE.retypeLiveAtCapture, 'the parent must have had it or this measures nothing').toBe(true);
    expect(slice.retypeLive).toBe(false);
    // ⛔ AND THE CORPSE IS STILL IN THE FILE, deliberately — the line is padded with `//` so the 500+
    // line-anchored citations at or past :1933 do not shift. A text search would find it and call the
    // law live; the harness reads the line's STRUCTURE, which is why this assertion can hold at all.
    expect(LAB_SRC).toContain('WAS: state.termWidth = Math.min(0.30');
  });

  it('the lab\'s terminator state is UNCHANGED on 36/36 rows, in BOTH gas call orders', () => {
    const rows = runLabRows(slice, {
      literals: { terminatorEnabled: TERMINATOR_ENABLED, limbBypass: LIMB_BYPASS, termBypass: TERM_BYPASS },
      dressing: (preset) => (DEFAULT_DRESSING[preset] || []).includes('terminator'),
    });
    expect(rows.length).toBe(LAB_FIXTURE.rows.length);
    expect(rows.length).toBe(36);
    let compared = 0; const differ = [];
    for (const [i, now] of rows.entries()) {
      const was = LAB_FIXTURE.rows[i];
      expect([now.preset, now.macroSeed], `row ${i}`).toEqual([was.preset, was.macroSeed]);
      for (const order of ['orderA', 'orderB']) {
        for (const f of ['termStrength', 'termWidth', 'termColor']) {
          if (JSON.stringify(now[order][f]) !== JSON.stringify(was[order][f])) differ.push(`${was.preset}/${was.macroSeed} ${order}.${f}`);
          compared++;
        }
      }
      expect(now.gas, was.preset).toBe(was.gas);
    }
    expect(differ).toEqual([]);
    // [CONTROL — non-empty] 36 rows × 2 orders × 3 fields.
    expect(compared).toBe(216);
    // ⭐ AND THE GAS HALF IS THE ONE THAT NEEDED IT: on gas the deleted line ran LAST (:2821 lives in
    // ensureNetworkRouted), so the deletion is admissible only by value-equality in both orders.
    expect(rows.filter((r) => r.gas).length).toBe(10);
    for (const r of rows.filter((x) => x.gas)) expect(r.orderA, r.preset).toEqual(r.orderB);
  });

  it('the PARENT fixture already showed the retype and the mirror agreeing — max delta 0', () => {
    // The equality that ADMITS the deletion, read off the parent capture rather than re-derived.
    let checked = 0;
    for (const was of LAB_FIXTURE.rows) {
      expect(was.retypedWidth, was.preset).toBeCloseTo(was.orderA.termWidth, 15);
      expect(was.retypedWidth - was.orderA.termWidth, was.preset).toBe(0);
      expect(was.retypedWidth - was.orderB.termWidth, was.preset).toBe(0);
      checked++;
    }
    expect(checked).toBe(36);
  });

  it('[CONTROL] perturbing the width law\'s pressure input reds the compare on every preset with air', () => {
    const rows = runLabRows(slice, {
      literals: { terminatorEnabled: TERMINATOR_ENABLED, limbBypass: LIMB_BYPASS, termBypass: TERM_BYPASS },
      // ⛔ THE INPUT, NOT THE OUTPUT. `terminatorOpticsOf` reads the condition's atmosphere; scaling
      // the pressure is the smallest break that must reach the width on every body that has one.
      perturb: (fp) => (fp && fp.atmosphere ? { ...fp, atmosphere: { ...fp.atmosphere, pressure: fp.atmosphere.pressure * 4 } } : fp),
      dressing: () => false,
    });
    const moved = new Set(); const withAir = new Set();
    for (const [i, now] of rows.entries()) {
      const was = LAB_FIXTURE.rows[i];
      if (was.presetPressure) withAir.add(was.preset);
      if (now.orderA.termWidth !== was.orderA.termWidth) moved.add(was.preset);
    }
    expect(withAir.size, 'the control is vacuous unless some preset has air').toBeGreaterThan(5);
    // Every preset whose width the law touches (pressure below the 0.30 ceiling) must move; the
    // ones already clamped at the ceiling cannot, and they are named rather than swept up.
    // ⚠ THE EXPECTED SET IS DERIVED, NOT LISTED. The width ramp is clamped at BOTH ends — 0.06 below
    // ~0.1 bar and 0.30 at the Venus/gas-giant column — so a preset already sitting on a clamp
    // CANNOT move under a 4x pressure nudge, and demanding that it move would be a bound the law
    // forbids. The movers are exactly the presets with air whose parent width is strictly interior.
    const interior = [...withAir].filter((p) => {
      const w = LAB_FIXTURE.rows.find((r) => r.preset === p).orderA.termWidth;
      return w > 0.06 && w < 0.30;
    });
    expect([...moved].sort()).toEqual([...interior].sort());
    expect(moved.size, 'a control with no movers is not a control').toBeGreaterThan(3);
    // …and every clamped-with-air preset stayed put, which is the other half of the same claim.
    for (const p of withAir) if (!interior.includes(p)) expect([...moved], `${p} sits on a clamp`).not.toContain(p);
  });
});

describe('AC-0 (c) — the deny-scans', () => {
  const SRC_FILES = ['world-engine-lab.html', 'src/worldengine/base/terminatorOptics.js',
    'src/worldengine/drivers/solidOptics.js', 'src/worldengine/drivers/giantSurface.js',
    'src/objects/Planet.js', 'src/main.js', 'src/rendering/LabPlanetMaterial.js', 'src/rendering/labTermAB.js'];

  it('DENY: exactly ONE live `termWidthFor`-shaped expression exists, and it is the law itself', () => {
    // The retype's signature is the log ramp's coefficient pair. Scanned over LIVE code only.
    const hits = [];
    for (const f of SRC_FILES) {
      const code = strip(src(f));
      for (const m of code.matchAll(/0\.12\s*\+\s*0\.09\s*\*\s*Math\.log10/g)) hits.push(`${f}@${m.index}`);
    }
    expect(hits.map((h) => h.split('@')[0])).toEqual(['src/worldengine/base/terminatorOptics.js']);
  });

  it('DENY: no NEW `terminator:` gate literal — and the three deliberately ungated ones still say true', () => {
    const found = [];
    for (const f of SRC_FILES) {
      const code = strip(src(f));
      for (const m of code.matchAll(/terminator\s*:\s*(true|false)/g)) found.push(`${f}:${m[1]}`);
      for (const m of code.matchAll(/\[TERMINATOR_GATE\]\s*:\s*(true|false)/g)) found.push(`${f}:${m[1]}`);
    }
    // ⛔ THREE, ALL `true`, ALL DELIBERATE — and they must NOT be converged onto the constant. The lab
    // re-applies its own ✓ checkbox at its per-frame writer (:5044), so a mirror ctx closed by
    // TERMINATOR_ENABLED would zero `state.termStrength` and red AC-4 in Chrome.
    expect(found.sort()).toEqual([
      'src/worldengine/drivers/giantSurface.js:true',
      'src/worldengine/drivers/solidOptics.js:true',
      'world-engine-lab.html:true',
    ]);
    // …read back at their declared sites, so a flip to `false` is loud rather than absorbed by a count.
    expect(strip(src('src/worldengine/drivers/solidOptics.js'))).toMatch(/\[TERMINATOR_GATE\]:\s*true/);
    expect(strip(src('src/worldengine/drivers/giantSurface.js'))).toMatch(/\[TERMINATOR_GATE\]:\s*true/);
    expect(strip(LAB_SRC)).toMatch(/gates:\s*\{\s*terminator:\s*true\s*\}/);
  });

  it('DENY: no NEW `uTermStrength` producer beyond the two packs and the declared legacy line', () => {
    const producers = [];
    for (const f of SRC_FILES) {
      const code = strip(src(f));
      // A PRODUCER writes the name: `uTermStrength:` in a driver/uniform object, or `.uTermStrength.value =`.
      for (const m of code.matchAll(/uTermStrength\s*:/g)) producers.push(`${f}:key@${code.slice(0, m.index).split('\n').length}`);
      for (const m of code.matchAll(/uTermStrength\.value\s*=/g)) producers.push(`${f}:write@${code.slice(0, m.index).split('\n').length}`);
    }
    const files = [...new Set(producers.map((p) => p.split(':')[0]))].sort();
    expect(files).toEqual([
      'src/objects/Planet.js',            // :1653 the DECLARED legacy producer (Sol + gallery), ungated
      'src/rendering/labTermAB.js',       // the A/B instrument's own arm write — a dev key, not a mount path
      'src/worldengine/drivers/giantSurface.js',
      'src/worldengine/drivers/solidOptics.js',
      'world-engine-lab.html',            // :5044 the lab's per-frame writer, gated on its ✓ checkbox
    ].sort());
    // Planet.js carries exactly ONE, and it is the one the contract declares.
    expect(producers.filter((p) => p.startsWith('src/objects/Planet.js')).length).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC-1 — THE GATE IS CONVERGED BY ONE DECLARED VALUE.
// ═════════════════════════════════════════════════════════════════════════════
describe('AC-1 — one constant, read by the game\'s policy and by both of the lab\'s producers', () => {
  it('the RULED policy is the default and resolves the two entries as declared', () => {
    expect(TERMINATOR_ENABLED).toBe(false);
    expect(GATE_RULINGS.terminator).toBe(TERMINATOR_ENABLED);
    expect(Object.isFrozen(GATE_RULINGS)).toBe(true);
    expect(gatesFor(SOLID_OPTICS_ENTRY)).toEqual({ [TERMINATOR_GATE]: false, [AURORA_GATE]: true });
    expect(gatesFor(GIANT_SURFACE_ENTRY)).toEqual({ [TERMINATOR_GATE]: false });
    expect(gatesFor(SOLID_OPTICS_ENTRY, GATE_POLICY_RULED)).toEqual(gatesFor(SOLID_OPTICS_ENTRY));
  });

  it('[CONTROL] ALL_ON is KEPT and still means all-on — Max\'s ruling #4 stays truthful', () => {
    expect(gatesFor(SOLID_OPTICS_ENTRY, GATE_POLICY_ALL_ON)).toEqual({ [TERMINATOR_GATE]: true, [AURORA_GATE]: true });
    expect(gatesFor(GIANT_SURFACE_ENTRY, GATE_POLICY_ALL_ON)).toEqual({ [TERMINATOR_GATE]: true });
    // …and an unknown policy still throws, under BOTH names existing.
    expect(() => gatesFor(SOLID_OPTICS_ENTRY, 'everything')).toThrow(PackContractError);
  });

  it('[CONTROL] a ruling ANSWERS a declared gate and never ADDS one', () => {
    expect(gatesFor({ gates: [] })).toEqual({});
    expect(gatesFor({ gates: [] }, GATE_POLICY_RULED, { terminator: false, invented: false })).toEqual({});
    // …and a name the rulings map does not mention still resolves true.
    expect(gatesFor({ gates: ['aurora'] })).toEqual({ aurora: true });
    // …and the seam carries a ruling the other way, which is what makes it a parameter and not a const.
    expect(gatesFor(SOLID_OPTICS_ENTRY, GATE_POLICY_RULED, { terminator: true })).toEqual({ terminator: true, aurora: true });
  });

  it('[CONTROL] a driver gated on a RULED-but-UNDECLARED name still throws PackContractError', () => {
    // writePackUniforms.js:180 — "an absent gate is not an off gate and is not an on gate, it is an
    // unanswered rendering decision". A ruling must not be able to satisfy that throw.
    const gates = gatesFor({ gates: ['aurora'] });        // terminator ABSENT, and ruled
    expect('terminator' in gates).toBe(false);
    const u = { uX: { value: 0 } };
    expect(() => writePackUniforms(u, { uX: scalar(1, { gate: TERMINATOR_GATE }) }, { displayRadiusEarth: 1, animRate: 1, relevance: {}, gates }))
      .toThrow(PackContractError);
  });

  it('uTermStrength resolves to +0 on 156/156 admitted bodies, width and colour UNCHANGED', () => {
    let checked = 0; const nonZero = [];
    for (const b of CORPUS) {
      const now = termOf(b);
      const was = PACK_FIXTURE.termStrength[b.id];
      expect(was, b.id).toBeDefined();
      expect(now.uTermStrength, b.id).toBe(0);
      expect(Object.is(now.uTermStrength, -0), `${b.id} must be +0, not -0`).toBe(false);
      if (now.uTermStrength > 0) nonZero.push(b.id);
      // …and the two ungated siblings still carry the parent's derived values.
      const parent = PACK_FIXTURE.bodies[b.id][now.entry].drivers;
      expect(now.uTermWidth, `${b.id} width`).toBe(parent.uTermWidth);
      expect(JSON.stringify(now.uTermColor), `${b.id} colour`).toBe(JSON.stringify(parent.uTermColor));
      checked++;
    }
    expect(nonZero).toEqual([]);
    expect(checked).toBe(156);
    // …the aurora gate is untouched on every solid body.
    for (const b of SOLID.slice(0, 20)) expect(gatesFor(termEntryFor(b.cond, ctxOf(b)))[AURORA_GATE]).toBe(true);
  });

  it('[CONTROL — THE CHANGE SET] under ALL_ON the derived value comes back, on exactly the parent\'s bodies', () => {
    const moved = []; const zero = [];
    for (const b of CORPUS) {
      const v = termOf(b, GATE_POLICY_ALL_ON).uTermStrength;
      const parent = PACK_FIXTURE.termStrength[b.id].value;
      expect(v, b.id).toBe(parent);          // deep-equal to the parent fixture, per body
      (v > 0 ? moved : zero).push(b.id);
      if (v > 0) expect(v, b.id).toBeGreaterThan(0);
      if (v > 0) expect(v, `${b.id} must not exceed the law's ceiling`).toBeLessThanOrEqual(0.15);
    }
    // ⛔ THE SET, NEVER A FLAT MAGNITUDE. 0.15 is a ceiling; asserting it as the population's value
    // would pass a build that clamped every thin column up to it.
    expect(moved.sort()).toEqual([...PACK_FIXTURE.changeSet.bodies].sort());
    expect(moved.length).toBe(100);
    expect(zero.length).toBe(56);
    const distinct = [...new Set(moved.map((id) => PACK_FIXTURE.termStrength[id].value))].sort((a, b) => a - b);
    expect(distinct.length, 'a single value across 100 bodies would mean the law had been flattened').toBeGreaterThan(1);
    expect(distinct[0]).toBeCloseTo(0.130327, 6);
    expect(distinct[distinct.length - 1]).toBe(0.15);
  });

  it('the change set over the 18 presets is the 11 the parent recorded', () => {
    const moved = [];
    for (const row of presetRows()) {
      const entry = termEntryFor(row.cond, row.ctx);
      const allOn = { ...row.ctx, gates: gatesFor(entry, GATE_POLICY_ALL_ON) };
      const ruled = { ...row.ctx, gates: gatesFor(entry) };
      const r = entry.pack(row.cond, allOn);
      expect(resolveDriver(TERM, r.drivers[TERM], ruled), row.name).toBe(0);
      const v = resolveDriver(TERM, r.drivers[TERM], allOn);
      expect(v, row.name).toBe(PACK_FIXTURE.termStrengthPresets[row.name].value);
      if (v > 0) moved.push(row.name);
    }
    expect(moved.sort()).toEqual([...PACK_FIXTURE.changeSet.presets].sort());
    expect(moved.length).toBe(11);
  });

  it('[CONTROL — the lab\'s own producer] DEFAULT_DRESSING follows the rulings BOTH ways', () => {
    const renders = ASSOCIATIONS.terminator.rendersOn;
    // ⚠ ELEVEN, not the thirteen the 2026-07-16 commit message said — asserted against `rendersOn`
    // rather than against a literal so the number cannot drift again.
    expect(renders.length).toBe(11);
    const on = buildDefaultDressing({ terminator: true });
    const withTerm = Object.entries(on).filter(([, v]) => v.includes('terminator')).map(([k]) => k);
    expect(withTerm.sort()).toEqual([...renders].sort());
    // …and every entry stays ⊆ rendersOn, which is the file's own boot-drift invariant.
    for (const [preset, keys] of Object.entries(on)) {
      for (const k of keys) expect(ASSOCIATIONS[k].rendersOn, `${preset}/${k}`).toContain(preset);
    }
    // …the DEFAULT omits it on all 18.
    expect(Object.entries(DEFAULT_DRESSING).filter(([, v]) => v.includes('terminator'))).toEqual([]);
    expect(Object.keys(DEFAULT_DRESSING).length).toBe(18);
    expect(DEFAULT_DRESSING).toEqual(buildDefaultDressing());
  });

  it('the DEFAULT dressing is byte-identical to the literal it replaced', () => {
    // ⛔ HARD-CODED FROM THE PRE-CHANGE FILE, not re-derived — a refactor that claims byte-identity
    // and is checked against its own output has checked nothing.
    expect(DEFAULT_DRESSING).toEqual({
      'Rocky (Earthlike)':          ['lakes', 'coastlines', 'clouds', 'limb'],
      'Ocean (temperate)':          ['lakes', 'coastlines', 'clouds', 'limb', 'sunglint'],
      'Eyeball (locked temperate)': ['lakes', 'coastlines', 'clouds', 'limb'],
      'Venus (sulfuric shroud)':    ['clouds', 'limb'],
      'Mars (arid rocky)':          ['dust', 'limb'],
      'Titan (methane seas)':       ['lakes', 'coastlines', 'clouds', 'limb'],
      'Magma (K2-141b)':            ['magma'],
      'Carbon (high C/O)':          ['carbon'],
      'Crystal (faceted)':          ['facets'],
      'Gas giant (Jovian)':         ['clouds', 'limb'],
      'Gas giant (Saturnian)':      ['clouds', 'limb'],
      'Ice giant (Neptunian)':      ['clouds', 'limb'],
      'Sub-Neptune (hazy)':         ['clouds', 'limb'],
      'Hot Jupiter (locked giant)': ['clouds', 'limb'],
      'Lava (hot airless)':         [],
      'Frozen (airless)':           [],
      'Europa (icy moon)':          [],
      'Moon/Mercury (impact-airless)': [],
    });
    // …and the ruled-on table reproduces the PRE-2026-07-16 literal, position included (b238526).
    const on = buildDefaultDressing({ terminator: true });
    expect(on['Ocean (temperate)']).toEqual(['lakes', 'coastlines', 'clouds', 'limb', 'terminator', 'sunglint']);
    expect(on['Mars (arid rocky)']).toEqual(['dust', 'limb', 'terminator']);
    expect(on['Lava (hot airless)']).toEqual([]);
  });

  it('the lab reads the constant at its state literal, and the import sits OUTSIDE the comment', () => {
    expect(readStateLiteralTokens(LAB_SRC).terminatorEnabled).toBe('TERMINATOR_ENABLED');
    // ⛔ THE COLUMN TEST, and it exists because an import appended past this line's trailing `//`
    // lands INSIDE the comment: two imports were silently disabled exactly that way on 2026-08-21,
    // every headless gate stayed GREEN, and the lab died only on page load.
    const line = LAB_SRC.split('\n')[187];
    expect(line).toContain('TERMINATOR_ENABLED');
    const firstComment = line.indexOf('//');
    expect(firstComment, 'the :188 import row is expected to carry a trailing comment').toBeGreaterThan(0);
    for (const name of ['TERMINATOR_ENABLED', 'TERM_BYPASS', 'LIMB_BYPASS']) {
      expect(line.indexOf(name), `${name} must be imported BEFORE the row's first //`).toBeLessThan(firstComment);
    }
    // …and the specifiers are the real modules, read off live text with string literals preserved.
    const live = stripKeepText(LAB_SRC);
    expect(live).toContain("import { TERMINATOR_ENABLED } from './src/worldengine/drivers/solidOptics.js';");
    expect(live).toContain("import { TERM_BYPASS, LIMB_BYPASS } from './src/rendering/LabPlanetMaterial.js';");
  });

  it('the game\'s provenance string names the RULED policy that actually ran', () => {
    const main = strip(src('src/main.js'));
    expect(main).toMatch(/drivers\.gatesFor\(entry, drivers\.GATE_POLICY_RULED\)/);
    expect(main).not.toMatch(/gatesFor\(entry, drivers\.GATE_POLICY_ALL_ON\)/);
    // …and applyDriverPacks — the composition point both front-ends share — takes the default.
    expect(strip(src('src/worldengine/drivers/index.js'))).toMatch(/const entryGates = gatesFor\(entry\);/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC-2 — NOTHING ELSE MOVES, and the compare is proven non-empty.
// ═════════════════════════════════════════════════════════════════════════════
describe('AC-2 — every other driver of every pack is byte-inert', () => {
  it('deep-compare against the f0b93aa fixture: ZERO drivers other than uTermStrength differ', () => {
    // ⭐ THE PROVENANCE PIN MOVED, DELIBERATELY AND ONCE — workstream volatile-delivery, 2026-09-04.
    // The fixture was NOT regenerated: `deriveComposition` split into an accreted-bulk-ice field and a
    // surface-volatile field (PhysicsEngine §3b), so composition moves on every body, and the fixture's
    // VALUES were patched in place while its structure, its pack scope and its key set stayed
    // byte-identical — this suite still pins exactly the packs it was written to pin. 792 of its body
    // driver values moved and ZERO of its 18 preset values did. The per-fixture delta and the
    // attribution control (restore that ONE field and all 12,481 resolved values return to
    // byte-identity) are recorded in docs/WORKSTREAMS/volatile-delivery/DEVIATIONS.md.
    // WAS 'f0b93aa' (the shipped capture).
    expect(PACK_FIXTURE.capturedFrom).toBe('36ffec2');
    let cells = 0; const differ = []; const termMoved = []; const added = new Set();
    for (const b of CORPUS) {
      const was = PACK_FIXTURE.bodies[b.id];
      expect(was, b.id).toBeDefined();
      const now = resolvedUnder(b.cond, ctxOf(b), GATE_POLICY_RULED);
      // ⭐ THE PACK SET MAY GROW; THE OLD PACKS MAY NOT MOVE. `solidRelief` (pack #11,
      // workstream solid-relief-deck, 2026-09-04) postdates this fixture, so it is subtracted here
      // BY NAME rather than the assertion being loosened — every pack the fixture knows must still
      // be present and byte-inert, and an UNDECLARED new pack still reds.
      expect(Object.keys(now).filter((n) => n !== 'solidRelief').sort(), b.id).toEqual(Object.keys(was).sort());
      for (const pack of Object.keys(was)) {
        for (const n of Object.keys(now[pack])) if (!(n in was[pack].drivers)) added.add(`${pack}.${n}`);
        for (const n of Object.keys(was[pack].drivers)) {
          const same = JSON.stringify(now[pack][n]) === JSON.stringify(was[pack].drivers[n]);
          if (!same) (n === TERM ? termMoved : differ).push(`${b.id} :: ${pack}.${n}`);
          cells++;
        }
      }
    }
    for (const row of presetRows()) {
      const was = PACK_FIXTURE.presets[row.name];
      const now = resolvedUnder(row.cond, row.ctx, GATE_POLICY_RULED);
      for (const pack of Object.keys(was)) {
        for (const n of Object.keys(now[pack])) if (!(n in was[pack].drivers)) added.add(`${pack}.${n}`);
        for (const n of Object.keys(was[pack].drivers)) {
          const same = JSON.stringify(now[pack][n]) === JSON.stringify(was[pack].drivers[n]);
          if (!same) (n === TERM ? termMoved : differ).push(`${row.name} :: ${pack}.${n}`);
          cells++;
        }
      }
    }
    expect(differ).toEqual([]);
    expect([...added]).toEqual([]);   // this workstream emits no new driver name
    // ⛔ THE ONE INTENDED DELTA, enumerated: exactly the 100 bodies + 11 presets whose law is non-zero.
    expect(termMoved.map((s) => s.split(' :: ')[0]).sort())
      .toEqual([...PACK_FIXTURE.changeSet.bodies, ...PACK_FIXTURE.changeSet.presets].sort());
    expect(termMoved.length).toBe(111);
    // [CONTROL — non-empty] the compare is not a claim about the empty set.
    expect(cells).toBeGreaterThan(8000);
    expect(cells).toBe(10492);   // RECORDED off the f0b93aa fixture: 9,425 body cells + 1,067 preset cells
  });

  it('[CONTROL — non-empty] the fixture\'s body-id list deep-equals the corpus\'s', () => {
    expect(Object.keys(PACK_FIXTURE.bodies).sort()).toEqual(CORPUS.map((b) => b.id).sort());
    expect(CORPUS.length).toBe(156);
    expect(Object.keys(PACK_FIXTURE.presets).sort()).toEqual(Object.keys(DRIVER_PRESETS).sort());
    expect(SOLID.length).toBe(124);
    expect(GAS.length).toBe(32);
  });

  it('[CONTROL] nudging one body\'s pressure reds the compare on exactly that body and name', () => {
    const target = SOLID.find((b) => b.cond.atmosphere && b.cond.atmosphere.pressure > 0);
    expect(target, 'an air-bearing solid body is needed or this control is vacuous').toBeTruthy();
    const perturbed = { ...target.cond, atmosphere: { ...target.cond.atmosphere, pressure: target.cond.atmosphere.pressure * 1.5 } };
    const moved = [];
    for (const b of SOLID.slice(0, 40)) {
      const cond = b.id === target.id ? perturbed : b.cond;
      const now = resolvedUnder(cond, ctxOf(b), GATE_POLICY_RULED);
      const was = PACK_FIXTURE.bodies[b.id];
      for (const pack of Object.keys(was)) {
        for (const n of Object.keys(was[pack].drivers)) {
          if (n === TERM) continue;   // the intended delta, already enumerated above
          if (JSON.stringify(now[pack][n]) !== JSON.stringify(was[pack].drivers[n])) moved.push(`${b.id} ${pack}.${n}`);
        }
      }
    }
    expect(moved.length, 'the nudge must move something').toBeGreaterThan(0);
    expect([...new Set(moved.map((m) => m.split(' ')[0]))]).toEqual([target.id]);
    expect([...new Set(moved.map((m) => m.split(' ')[1]))].sort()).toContain('solidOptics.uTermWidth');
  });

  it('the ALL_ON arm reproduces the parent fixture EXACTLY — the change is the policy, not the packs', () => {
    // ⛔ THIS IS THE LIVENESS HALF of the compare above. "uTermStrength went to 0" is compatible with
    // the pack's law having been broken; only re-running the SAME packs under ALL_ON and getting the
    // parent's numbers back shows the law is intact and the gate is what moved.
    let cells = 0; const differ = [];
    for (const b of CORPUS) {
      const was = PACK_FIXTURE.bodies[b.id];
      const now = resolvedUnder(b.cond, ctxOf(b), GATE_POLICY_ALL_ON);
      for (const pack of Object.keys(was)) {
        for (const n of Object.keys(was[pack].drivers)) {
          if (JSON.stringify(now[pack][n]) !== JSON.stringify(was[pack].drivers[n])) differ.push(`${b.id} ${pack}.${n}`);
          cells++;
        }
      }
    }
    expect(differ).toEqual([]);
    expect(cells).toBe(9425);   // the body half of the compare above, recorded
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// THE A/B INSTRUMENT — the headless half of AC-3 (the live pair is working-Claude's).
// ═════════════════════════════════════════════════════════════════════════════
describe('the `.` A/B instrument — registry, arms and record', () => {
  const surfaceFor = (b) => {
    const built = buildLabPlanetMaterial({ bodyRadius: b.d.radius });
    const entry = termEntryFor(b.cond, ctxOf(b));
    const ctx = { ...ctxOf(b), gates: gatesFor(entry) };
    writePackUniforms(built.material.uniforms, entry.pack(b.cond, ctx).drivers, ctx);
    return { material: built.material };
  };

  it('the key is `Period` and the handler ignores every modifier', () => {
    const code = stripKeepText(src('src/rendering/labTermAB.js'));   // ⚠ LITERALS KEPT: `strip` blanks them and the key IS a string literal.
    expect(code).toMatch(/e\.code === 'Period'/);
    expect(code).toMatch(/if \(e\.shiftKey \|\| e\.ctrlKey \|\| e\.altKey \|\| e\.metaKey \|\| e\.repeat\) return;/);
    // …and it is registered from Planet.js's existing mount line, not from a new one.
    expect(strip(src('src/objects/Planet.js'))).toMatch(/registerTermAB\(surface, \{ condition, ctx: labPackCtx\(d, condition, null\), packs \}\);/);
  });

  it('toggle writes each body\'s OWN law value and off restores the shipped 0', () => {
    const air = SOLID.find((b) => b.cond.atmosphere);
    const airless = SOLID.find((b) => !b.cond.atmosphere);
    const gas = GAS[0];
    const subjects = [air, airless, gas].map((b) => ({ b, s: surfaceFor(b) }));
    for (const { b, s } of subjects) expect(registerTermAB(s, { condition: b.cond, ctx: ctxOf(b), packs: { applied: [] } }), b.id).toBe(true);
    termOff();
    for (const { b, s } of subjects) expect(s.material.uniforms.uTermStrength.value, b.id).toBe(0);
    const on = termOn();
    expect(on.on).toBe(true);
    expect(on.materials).toBeGreaterThanOrEqual(3);
    for (const { b, s } of subjects) {
      const rec = recordTerm(s);
      expect(rec, b.id).not.toBeNull();
      expect(rec.lawValue, b.id).toBe(termOf(b, GATE_POLICY_ALL_ON).uTermStrength);
      expect(rec.shipped, b.id).toBe(0);
      expect(rec.uniformValue, b.id).toBe(rec.lawValue);
      expect(rec.state).toBe('on');
      expect(rec.hasAir, b.id).toBe(!!b.cond.atmosphere);
    }
    // ⛔ THE AIRLESS CONTROL IS NOT VACUOUS: it is registered (record non-null) AND its law is 0.
    const moon = subjects[1];
    expect(recordTerm(moon.s).lawValue).toBe(0);
    expect(recordTerm(moon.s).hasAir).toBe(false);
    // …the air-bearing and gas arms move, so a 0 elsewhere is a law fact and not a dead instrument.
    expect(recordTerm(subjects[0].s).lawValue).toBeGreaterThan(0);
    expect(recordTerm(subjects[2].s).lawValue).toBeGreaterThan(0);
    // ⛔ NEVER A LITERAL 0.15 — the instrument writes the pack's own answer, ceiling included.
    expect(recordTerm(subjects[0].s).lawValue).toBeLessThanOrEqual(0.15);
    termOff();
    for (const { b, s } of subjects) expect(s.material.uniforms.uTermStrength.value, b.id).toBe(0);
    expect(recordTerm(subjects[0].s).state).toBe('shipped');
    for (const { s } of subjects) unregisterTermAB(s);
  });

  it('[CONTROL] the registry releases on the material\'s own dispose, not only on unregister', () => {
    // ⛔ MEASURED ON THE SIBLING INSTRUMENT the day this was written: the ray A/B registers every lab
    // material but only Planet.js:2001 unregisters, while MOONS tear down through Moon.js:704 — one
    // re-approach grew that registry 17 → 28 with 11 dead moon materials in it. AC-3 reads the
    // registry SIZE as its admission evidence for the airless-moon 0-px control, so a leak makes that
    // control unreadable in the direction that looks like success.
    const b = SOLID.find((x) => x.cond.atmosphere);
    const s = surfaceFor(b);
    const before = globalThis._labTerm.size();
    expect(registerTermAB(s, { condition: b.cond, ctx: ctxOf(b), packs: { applied: [] } })).toBe(true);
    expect(globalThis._labTerm.size()).toBe(before + 1);
    s.material.dispatchEvent({ type: 'dispose' });
    expect(globalThis._labTerm.size(), 'a disposed material must leave the registry').toBe(before);
    expect(recordTerm(s), 'and its record must go null, so a stale body cannot be measured').toBeNull();
  });

  it('a legacy material (no uTermStrength) registers NOTHING — Sol is not reachable from this key', () => {
    expect(registerTermAB({ material: { uniforms: {} } }, { condition: SOLID[0].cond, ctx: ctxOf(SOLID[0]) })).toBe(false);
    expect(registerTermAB(null, {})).toBe(false);
    expect(recordTerm({ material: { uniforms: {} } })).toBeNull();
  });

  it('toggleTermAB is idempotent under force and reports the material count', () => {
    const b = GAS[0]; const s = surfaceFor(b);
    registerTermAB(s, { condition: b.cond, ctx: ctxOf(b) });
    expect(toggleTermAB(true).on).toBe(true);
    expect(toggleTermAB(true).on).toBe(true);
    expect(toggleTermAB(false).on).toBe(false);
    expect(globalThis._labTerm.all().every((r) => r.state === 'shipped')).toBe(true);
    unregisterTermAB(s);
  });
});
