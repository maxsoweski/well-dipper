// tests/material-parity-list.test.js — PLAN §4 Step 6b, the FEATURE-parity ledger's gate.
//
// ⭐ MAX RULED 2026-08-09: Step 6's gate is FEATURE parity, not uniform-NAME parity, and **an
// accepted loss is allowed; an UNDECLARED loss is blocking.** This suite is the machine half of
// that ruling. `docs/FEATURES/step6-parity-ledger.md` is the human half, and the two are not two
// documents — THIS FILE PARSES THAT ONE and fails when they disagree. A ledger transcribed by hand
// into a test is a ledger with two versions.
//
// ⛔ THE LIST IS RE-DERIVED BY RUNNING, NEVER BY READING. Reading is what left `uLimbMix` out of the
// plan's own loss table (carried ledger C20). Every subject set below comes from one of two live
// derivations:
//   · channel 1 — BOTH materials built on the SAME body (`setLabGasBodiesOverride` false, then
//     true, on identical `planetData`) and fed to `swapLedgerOf`, the decision core of
//     `_lab.swapLedger()`.
//   · channel 2 — a brace-matched extraction over the SHIPPED legacy fragment source, so a new
//     hardcoded effect in `Planet.js`'s GLSL is an unclaimed symbol and a red build.
//
// ⛔ SOL IS NOWHERE IN THIS FILE. 18 NASA textures, a different renderer, no world-engine condition
// fields, and Step 6d excludes it in code. The corpus is `lab-procedural-N`, N = 0…199.
//
// ── WHAT THIS GATE DOES NOT SEE, INCLUDING WHAT THIS VERY COMMIT ADDS ────────────────────────────
// Step 5's ratchet shipped blind to an idiom Step 5 itself introduced, inside the function it
// watched. This commit adds two things — a markdown ledger and this suite — so the question is
// whether either can grow a loss this gate cannot see. Answered, not assumed:
//   ✓ a ROW added to the doc with no symbols            -> `every row claims at least one subject`
//   ✓ a row that claims a symbol nothing measures       -> `no row claims a subject that is not measured`
//   ✓ a MEASURED subject no row claims                  -> `every measured subject is claimed exactly once`
//   ✓ a new hardcoded effect in the legacy shader       -> channel 2 extracts it; nothing claims it
//   ✓ a body class becoming swappable in an unruled branch -> the live-branch set is DERIVED from the
//                                                          population, so the branch demands rows
//   ✓ the pack quietly ceasing to write the band deck   -> `the carried rulings name a live mechanism`
//   ✗ a feature implemented inside a GLSL HELPER, or inline with no named local. Named limit 3 and 4
//     in the ledger's §5; not closed, and recorded rather than papered over.
//   ✗ anything only a live frame can show. This suite proves the LIST; Instrument E shows the pixels.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  Planet, PLANET_SHADER_VARIANTS, shaderVariantFor,
  setLabGasBodiesOverride, labPipelineAdmits,
} from '../src/objects/Planet.js';
import { conditionFromPlanet } from '../src/worldengine/port/conditionFromPlanet.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { swapLedgerOf, isLabPlanetMaterial, LAB_SHADER_CORPUS } from '../src/rendering/LabPlanetMaterial.js';
import { stripCommentsPreservingOffsets } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER_PATH = join(ROOT, 'docs/FEATURES/step6-parity-ledger.md');
const LEDGER_MD = readFileSync(LEDGER_PATH, 'utf8');
const PLANET_SRC = readFileSync(join(ROOT, 'src/objects/Planet.js'), 'utf8');

const CORPUS_N = 200;          // systems in the census
const LEDGER_N = 60;           // systems over which both materials are built (the expensive pass)
const RULINGS = new Set(['carried', 'accepted-loss', 'blocking']);

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THE DOC IS AN INPUT. Parsed, not trusted.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
/** Rows between `<!-- LEDGER-<tag> -->` and `<!-- /LEDGER-<tag> -->`, split on the pipe. */
function ledgerRows(tag) {
  const open = `<!-- LEDGER-${tag} -->`;
  const close = `<!-- /LEDGER-${tag} -->`;
  const a = LEDGER_MD.indexOf(open);
  const b = LEDGER_MD.indexOf(close);
  if (a < 0 || b < 0 || b < a) throw new Error(`ledger region ${tag} missing from ${LEDGER_PATH}`);
  return LEDGER_MD.slice(a + open.length, b)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter((f) => /^[PGRS]-\d\d$/.test(f[1] || ''));
}
const ticked = (cell) => [...String(cell).matchAll(/`([A-Za-z_]\w*)`/g)].map((m) => m[1]);

/** Channel 1: `| id | uniforms | ruling | evidence |`. */
const CH1_ROWS = ledgerRows('CH1').map((f) => ({ id: f[1], subjects: ticked(f[2]), ruling: f[3] }));
/** Channel 2: `| id | variant | branch | symbols | ruling | evidence |`. */
const CH2_ROWS = ledgerRows('CH2').map((f) => ({
  id: f[1], variant: f[2], branch: f[3], subjects: ticked(f[4]), ruling: f[5],
}));

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// CHANNEL 2's EXTRACTOR — over the SHIPPED source, brace-matched, comments stripped.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
const DECL_SRC = String.raw`\b(?:float|vec2|vec3|vec4|mat3)\s+([A-Za-z_]\w*)\s*=`;

function fnBody(clean, header) {
  const i = clean.indexOf(header);
  if (i < 0) return null;
  const open = clean.indexOf('{', i);
  let depth = 1, j = open + 1;
  while (j < clean.length && depth > 0) {
    if (clean[j] === '{') depth++; else if (clean[j] === '}') depth--;
    j++;
  }
  return { start: open + 1, text: clean.slice(open + 1, j - 1) };
}

function branchSpans(text, base) {
  const spans = [];
  const re = /planetType\s*==\s*(\d+)\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    let depth = 1, i = re.lastIndex;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++; else if (text[i] === '}') depth--;
      i++;
    }
    spans.push({ pt: Number(m[1]), start: base + re.lastIndex, end: base + i - 1 });
  }
  return spans;
}

/**
 * Every named local declared in `getSurfacePattern` / `main`, split into the shared region and the
 * mutually exclusive `planetType == N` branches (§12.4 channel 3).
 * @returns {{shared: Set<string>, branch: Map<number, Set<string>>}}
 */
export function extractBranchLocals(fragmentShader) {
  const clean = stripCommentsPreservingOffsets(fragmentShader);
  const regions = ['float getSurfacePattern(vec3 pos)', 'void main()']
    .map((h) => fnBody(clean, h)).filter(Boolean);
  let spans = [];
  for (const r of regions) spans = spans.concat(branchSpans(r.text, r.start));
  const out = { shared: new Set(), branch: new Map() };
  for (const r of regions) {
    const re = new RegExp(DECL_SRC, 'g');
    let m;
    while ((m = re.exec(r.text))) {
      const abs = r.start + m.index;
      const sp = spans.find((s) => abs >= s.start && abs < s.end);
      if (sp) {
        if (!out.branch.has(sp.pt)) out.branch.set(sp.pt, new Set());
        out.branch.get(sp.pt).add(m[1]);
      } else {
        out.shared.add(m[1]);
      }
    }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THE POPULATIONS — built once. The census does NOT build materials (a Planet carries a subdivision-5
// icosahedron); `labPipelineAdmits(...).admitted` is the same expression `_createLabSurface` returns
// on, and the equivalence is ASSERTED below rather than assumed.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
const buildable = (d) => ({ sunDirection: [1, 0, 0], ...d });

function materialAt(d, starInfo, enabled) {
  setLabGasBodiesOverride(enabled);
  try { return new Planet(buildable(d), starInfo).surface; } finally { setLabGasBodiesOverride(null); }
}

function census(n) {
  const out = {
    systems: 0, binarySystems: 0, claimed: 0, swapped: 0, provenanceBlocked: 0,
    withMoons: 0, moons: 0, inBinary: 0, nonWhitePrimary: 0,
    byVariant: new Map(), byBranch: new Map(),   // 'gas:1' -> count
  };
  setLabGasBodiesOverride(true);
  try {
    for (let i = 0; i < n; i++) {
      const sys = StarSystemGenerator.generate(`lab-procedural-${i}`, null);
      out.systems++;
      if (sys.isBinary) out.binarySystems++;
      const c1 = sys.starInfo.color1;
      const white = c1[0] === 1 && c1[1] === 1 && c1[2] === 1;
      for (const e of (sys.planets || [])) {
        const d = e.planetData;
        const adm = labPipelineAdmits(d, conditionFromPlanet(d));
        if (!adm.packs.length) continue;
        out.claimed++;
        if (!adm.admitted) { out.provenanceBlocked++; continue; }
        out.swapped++;
        const v = shaderVariantFor(d.type);
        const key = `${v}:${TYPE_INDEX.indexOf(d.type)}`;
        out.byVariant.set(v, (out.byVariant.get(v) || 0) + 1);
        out.byBranch.set(key, (out.byBranch.get(key) || 0) + 1);
        const moons = (e.moons || []).length;
        if (moons) { out.withMoons++; out.moons += moons; }
        if (sys.isBinary) out.inBinary++;
        if (!white) out.nonWhitePrimary++;
      }
    }
  } finally { setLabGasBodiesOverride(null); }
  return out;
}

/** src/objects/Planet.js:1890 `_typeIndex() {` — the same ordered list, which IS the GLSL branch id. */
const TYPE_INDEX = [
  'rocky', 'gas-giant', 'ice', 'lava', 'ocean', 'terrestrial',
  'hot-jupiter', 'eyeball', 'venus', 'carbon', 'sub-neptune',
  'hex', 'shattered', 'crystal', 'fungal', 'machine',
  'city-lights', 'ecumenopolis',
];

/** Both materials on the same body, over `n` systems. The expensive pass. */
function ledgerPass(n, { starInfo = 'real' } = {}) {
  const lost = new Set(), lostAtZero = new Set(), carried = new Set();
  const divergedCarried = new Map(), carriedTotal = new Map();
  const bucketOf = new Map();          // name -> Set('lost'|'lostAtZero')
  const labVaries = new Map(), gameVaries = new Map();
  let bodies = 0, written = null;
  for (let i = 0; i < n; i++) {
    const sys = StarSystemGenerator.generate(`lab-procedural-${i}`, null);
    const si = starInfo === 'real' ? sys.starInfo : null;
    for (const e of (sys.planets || [])) {
      const d = e.planetData;
      const prevSurf = materialAt(d, si, false);
      const nextSurf = materialAt(d, si, true);
      const lab = nextSurf.userData?.wd?.lab;
      if (!lab) continue;
      // The cheap census's `admitted` and the real mount must agree, or every count above is fiction.
      expect(isLabPlanetMaterial(nextSurf.material)).toBe(true);
      bodies++;
      if (written === null) written = lab.uniformsWritten.slice().sort();
      const prev = prevSurf.material.uniforms;
      const next = nextSurf.material.uniforms;
      const led = swapLedgerOf({ prevUniforms: prev, nextUniforms: next });
      const note = (name, b) => {
        if (!bucketOf.has(name)) bucketOf.set(name, new Set());
        bucketOf.get(name).add(b);
      };
      led.buckets.lost.forEach((x) => { lost.add(x); note(x, 'lost'); });
      led.buckets.lostAtZero.forEach((x) => { lostAtZero.add(x); note(x, 'lostAtZero'); });
      for (const x of led.buckets.carried) {
        carried.add(x);
        carriedTotal.set(x, (carriedTotal.get(x) || 0) + 1);
        if (!sameValue(prev[x].value, next[x].value)) {
          divergedCarried.set(x, (divergedCarried.get(x) || 0) + 1);
        }
      }
      for (const [k, u] of Object.entries(next)) {
        if (!labVaries.has(k)) labVaries.set(k, new Set());
        labVaries.get(k).add(encodeValue(u.value));
      }
      for (const [k, u] of Object.entries(prev)) {
        if (!gameVaries.has(k)) gameVaries.set(k, new Set());
        gameVaries.get(k).add(encodeValue(u.value));
      }
    }
  }
  const varying = (m) => [...m.entries()].filter(([, s]) => s.size > 1).map(([k]) => k).sort();
  return {
    bodies, lost, lostAtZero, carried, divergedCarried, carriedTotal, bucketOf, written,
    labVarying: varying(labVaries), gameVarying: varying(gameVaries),
    labSize: labVaries.size, gameSize: gameVaries.size,
  };
}

/** Structural encode. Vectors, colours, typed arrays and arrays-of-vectors all appear in this block. */
function encodeValue(v) {
  if (v == null) return 'null';
  if (typeof v === 'object') {
    if ('x' in v) return `v:${v.x},${v.y},${v.z ?? ''},${v.w ?? ''}`;
    if ('r' in v && 'g' in v) return `c:${v.r},${v.g},${v.b}`;
    if (ArrayBuffer.isView(v)) return `a:${Array.from(v).join(',')}`;
    if (Array.isArray(v)) return `[${v.map(encodeValue).join('|')}]`;
    if (v.isTexture) return 'tex';
    return 'obj';
  }
  return String(v);
}
const sameValue = (a, b) => encodeValue(a) === encodeValue(b);

const CENSUS = census(CORPUS_N);
const LEDGER = ledgerPass(LEDGER_N);

beforeEach(() => { setLabGasBodiesOverride(null); });
afterEach(() => { setLabGasBodiesOverride(null); });

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 1. THE POPULATIONS — re-measured here, never copied from the plan.
//    PLAN §4 Step 6b tabulates five rows over an unnamed corpus of "223 gas bodies". Step 4 taught
//    that the plan's own numbers do not always reproduce, so these are taken again and PINNED. When
//    one moves, the ledger's rulings are stale by definition — that is the intended failure.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('1. the swapped population, re-measured on lab-procedural-0…199', () => {
  it('pins the counts the ledger rules against', () => {
    expect(CENSUS.systems).toBe(200);
    expect(CENSUS.binarySystems).toBe(64);
    expect(CENSUS.claimed).toBe(343);
    expect(CENSUS.provenanceBlocked).toBe(2);
    expect(CENSUS.swapped).toBe(341);
    expect(CENSUS.withMoons).toBe(228);
    expect(CENSUS.moons).toBe(456);
    expect(CENSUS.inBinary).toBe(125);
    // Not "most primaries are non-white" — every one of them. The star-colour loss (P-01) has no
    // body on which it is invisible, which is a stronger statement than the plan's "all giants".
    expect(CENSUS.nonWhitePrimary).toBe(341);
  });

  it('⭐ 114 of the 341 swapped bodies do not render the GAS program today', () => {
    // The predicate is condition-derived (drivers/index.js:97) and the legacy program is chosen by
    // the `type` LABEL (Planet.js:1422). They disagree on a third of the population, and PLAN §6b's
    // loss table enumerates the gas branch only. Ledger rows R-01…R-04 are that gap.
    expect(Object.fromEntries(CENSUS.byVariant)).toEqual({ gas: 227, rocky: 114 });
    expect(Object.fromEntries(CENSUS.byBranch)).toEqual({
      'gas:1': 53, 'gas:6': 5, 'gas:7': 3, 'gas:10': 166,
      'rocky:0': 21, 'rocky:2': 66, 'rocky:5': 1, 'rocky:9': 26,
    });
  });

  it('⭐ CONTROL THAT MOVED — the provenance test is what makes 343 into 341', () => {
    // A count with no control is a count. Re-run the same census ignoring Step 6d's provenance
    // refusal and the answer changes: 343, and the two extra bodies are `crystal` — an EXOTIC-variant
    // body, whose 20 branch blocks nothing in this ledger rules (named limit 5).
    let claimedIgnoringProvenance = 0;
    const exotic = [];
    setLabGasBodiesOverride(true);
    try {
      for (let i = 0; i < CORPUS_N; i++) {
        const sys = StarSystemGenerator.generate(`lab-procedural-${i}`, null);
        for (const e of (sys.planets || [])) {
          const d = e.planetData;
          const adm = labPipelineAdmits(d, conditionFromPlanet(d));
          if (!adm.packs.length) continue;
          claimedIgnoringProvenance++;
          if (!adm.admitted) exotic.push({ type: d.type, blockers: adm.provenance.blockers });
        }
      }
    } finally { setLabGasBodiesOverride(null); }
    expect(claimedIgnoringProvenance).toBe(343);          // ← the mutant's answer
    expect(CENSUS.swapped).toBe(341);                     // ← the shipped answer
    expect(exotic.map((x) => x.type)).toEqual(['crystal', 'crystal']);
    for (const x of exotic) expect(x.blockers).toEqual(['no _systemSeed', 'no _ordinal']);
    // …and the refused ones really are the unruled variant.
    expect(shaderVariantFor('crystal')).toBe('exotic');
  });

  it('the flag is the other half of admission, and OFF means no swap at all', () => {
    const sys = StarSystemGenerator.generate('lab-procedural-4', null);
    const gas = sys.planets.find((p) => shaderVariantFor(p.planetData.type) === 'gas'
      && labPipelineAdmits(p.planetData, conditionFromPlanet(p.planetData)).packs.length);
    expect(gas).toBeTruthy();
    expect(isLabPlanetMaterial(materialAt(gas.planetData, sys.starInfo, true).material)).toBe(true);
    expect(isLabPlanetMaterial(materialAt(gas.planetData, sys.starInfo, false).material)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 2. THE HEADLINE — how much per-body character survives the swap.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('2. the collapse in per-body variation', () => {
  it('37 of the game material’s 71 uniforms vary across bodies; 16 of the lab’s 356 do', () => {
    expect(LEDGER.gameSize).toBe(71);
    expect(LEDGER.labSize).toBe(356);
    expect(LEDGER.gameVarying.length).toBe(37);
    // ⛔ MEMBERSHIP, NOT A COUNT. Step 4 measured that a count-preserving permutation passes every
    // instrument this program owns byte-identically, so `toBe(16)` alone would accept a build in
    // which the bands stopped varying and something else started.
    expect(LEDGER.labVarying).toEqual([
      'uBandAMid', 'uBandContrast', 'uBandDeflectScale', 'uBandM', 'uBandPhaseJet', 'uBandRough',
      'uBandS2', 'uBandSEq', 'uBandTint', 'uBandWarp',
      'uBodyRadius',
      'uJetFestoon', 'uJetShearTurb', 'uJetSpeed',
      'uLightDir', 'uThermalDir',
    ]);
    // 13 band/jet drivers of the 15 the pack writes vary; `uBandStrength` and `uJetStrength` are
    // written to the SAME value on every body, which is why "15 written" is not "15 varying".
    expect(LEDGER.written.filter((n) => !LEDGER.labVarying.includes(n)))
      .toEqual(['uBandStrength', 'uJetStrength']);
  });

  it('the pack writes 15 uniforms, and the ledger’s three `carried` rulings rest on them', () => {
    // If the pack stops writing the band deck, G-01/G-04/G-07's "carried" ruling is false. Pinned as
    // a SET OF NAMES, not a length — Step 4 measured that a count-preserving permutation is
    // byte-identical to every instrument this program owns.
    expect(LEDGER.written).toEqual([
      'uBandAMid', 'uBandContrast', 'uBandDeflectScale', 'uBandM', 'uBandPhaseJet', 'uBandRough',
      'uBandS2', 'uBandSEq', 'uBandStrength', 'uBandTint', 'uBandWarp',
      'uJetFestoon', 'uJetShearTurb', 'uJetSpeed', 'uJetStrength',
    ]);
    // P-18's three `carried` names must actually VARY on the post-swap material, or "carried" is a
    // claim about a constant.
    for (const n of ['uLightDir', 'uBodyRadius']) expect(LEDGER.labVarying).toContain(n);
    expect(LAB_SHADER_CORPUS).toContain('uTime');
  });

  it('⭐⭐ the CARRIED bucket is a NAME bucket — 20 of 28 diverge in value', () => {
    // THE CONTROL IS THE TWO ANSWERS ON ONE INPUT. `swapLedgerOf` reports these names as CARRIED;
    // a value comparison over the identical pair of materials reports them as diverged. A ledger
    // that ruled the name would record 28 surviving features where at most 8 survive.
    expect(LEDGER.carried.size).toBe(28);
    expect(LEDGER.divergedCarried.size).toBe(20);
    const everyBody = [...LEDGER.divergedCarried.entries()]
      .filter(([k, v]) => v === LEDGER.carriedTotal.get(k)).map(([k]) => k);
    expect(everyBody.length).toBe(17);
    // The eight that agree, agree by ABSENCE — both sides are zero or the same constant.
    const agreeing = [...LEDGER.carried].filter((n) => !LEDGER.divergedCarried.has(n)).sort();
    expect(agreeing).toEqual([
      'uCraterDensity', 'uCraterRelaxation', 'uEjectaLump', 'uEjectaRampart', 'uEjectaStrength',
      'uFwClamp', 'uTerraceCount', 'uVoroCells',
    ]);
    for (const n of agreeing) {
      // …and every one of them is carried on every body, so "agrees" is not "was rarely compared".
      expect(LEDGER.carriedTotal.get(n)).toBe(LEDGER.bodies);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 3. CHANNEL 1 — the uniform-shaped features, and the doc's rulings over them.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('3. channel 1 — the uniform diff, run not read', () => {
  const measured = () => new Set([...LEDGER.lost, ...LEDGER.lostAtZero, ...LEDGER.divergedCarried.keys()]);

  it('the subject set is 43 lost names plus the 20 value-defaulted carried ones', () => {
    expect(new Set([...LEDGER.lost, ...LEDGER.lostAtZero]).size).toBe(43);
    expect(measured().size).toBe(63);
    // 43 lost + 28 carried = the 71 the game material declares. Nothing fell between the buckets.
    expect(new Set([...LEDGER.lost, ...LEDGER.lostAtZero, ...LEDGER.carried]).size).toBe(71);
  });

  it('every measured subject is claimed by exactly ONE ledger row', () => {
    const claimed = CH1_ROWS.flatMap((r) => r.subjects);
    const dupes = claimed.filter((x, i) => claimed.indexOf(x) !== i);
    expect(dupes).toEqual([]);
    expect([...claimed].sort()).toEqual([...measured()].sort());
  });

  it('every row carries a legal ruling and at least one subject', () => {
    expect(CH1_ROWS.length).toBeGreaterThan(0);
    for (const r of CH1_ROWS) {
      expect(RULINGS.has(r.ruling), `${r.id} ruling "${r.ruling}"`).toBe(true);
      expect(r.subjects.length, `${r.id} claims nothing`).toBeGreaterThan(0);
    }
  });

  it('⭐ CONTROL THAT MOVED — the partition assertion fails when a row drops a subject', () => {
    const mutated = CH1_ROWS.map((r) => (r.id === 'P-04' ? { ...r, subjects: [] } : r));
    const claimed = mutated.flatMap((r) => r.subjects);
    expect(claimed.length).toBe(CH1_ROWS.flatMap((r) => r.subjects).length - 1);
    expect([...claimed].sort()).not.toEqual([...measured()].sort());   // ← the mutant reds
  });

  it('⭐ CONTROL THAT MOVED — `lostAtZero` is a per-body VALUE split, not a constant', () => {
    // My own first measurement of this ledger passed `starInfo = null`, which is what a headless
    // probe reaches for, and it put `starColor2`/`starBrightness2` in `lostAtZero` on ALL 341
    // bodies — "lost, but it was off anyway". With the system's REAL starInfo the same two names
    // split, and the split is exactly the binary population. Both answers, from one function.
    const withoutStars = ledgerPass(20, { starInfo: 'none' });
    for (const n of ['starColor2', 'starBrightness2']) {
      expect(withoutStars.bucketOf.get(n)).toEqual(new Set(['lostAtZero']));   // ← the misleading answer
      expect(LEDGER.bucketOf.get(n)).toEqual(new Set(['lost', 'lostAtZero'])); // ← the honest one
    }
  });

  it('the losses with NO lab mechanism really have none — measured over the lab material', () => {
    const labNames = new Set(Object.keys(
      materialAt(
        StarSystemGenerator.generate('lab-procedural-4', null).planets
          .find((p) => labPipelineAdmits(p.planetData, conditionFromPlanet(p.planetData)).packs.length).planetData,
        null, true,
      ).material.uniforms,
    ));
    // P-01: no star-colour uniform of any kind.
    expect([...labNames].filter((n) => /star/i.test(n))).toEqual([]);
    // P-02 / P-03: no second light, no shadow term.
    expect([...labNames].filter((n) => /shadow/i.test(n))).toEqual([]);
    expect(LAB_SHADER_CORPUS.includes('uLightDir2')).toBe(false);
    expect(LAB_SHADER_CORPUS.includes('uShadow')).toBe(false);
    // P-04 / P-05: the alias shape — the counterpart EXISTS, which is why those rows are `blocking`
    // rather than `accepted-loss`.
    for (const n of ['uLimbStrength', 'uAuroraColor', 'uAuroraIntensity', 'uAuroraRingLat', 'uAuroraRingWidth']) {
      expect(labNames.has(n), `lab should declare ${n}`).toBe(true);
      expect(LEDGER.written).not.toContain(n);      // …and nothing writes it
    }
  });

  it('P-17 — `lodLevel` is read by no shader, and that is counted rather than asserted', () => {
    const hits = [...PLANET_SRC.matchAll(/\blodLevel\b/g)].length;
    expect(hits).toBe(2);                                          // the declaration + the material entry
    expect(PLANET_SRC).toContain('uniform int lodLevel;');
    // CONTROL: the same count over a source with one read added moves to 3, so `2` is a measurement.
    const mutant = PLANET_SRC.replace('uniform int lodLevel;', 'uniform int lodLevel;\nfloat q = float(lodLevel);');
    expect([...mutant.matchAll(/\blodLevel\b/g)].length).toBe(3);
  });

  it('P-16’s LOD1 row is structurally zero — the two guards are complements', () => {
    // `_applyLOD1Overrides` returns unless the body HAS a profileId; `worldEngineProvenance` refuses
    // any body that has one. No swapped body can reach that path, on any corpus, ever.
    const br = readFileSync(join(ROOT, 'src/rendering/objects/BodyRenderer.js'), 'utf8');
    expect(br).toContain('if (!profileId) return;');
    expect(PLANET_SRC).toContain("if (profileId) blockers.push('profileId=' + String(profileId));");
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 4. CHANNEL 2 — the hardcoded-GLSL features, per mutually exclusive `planetType` branch.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('4. channel 2 — the features with no uniform to diff', () => {
  const EXTRACT = { gas: extractBranchLocals(PLANET_SHADER_VARIANTS.gas.fragmentShader),
                    rocky: extractBranchLocals(PLANET_SHADER_VARIANTS.rocky.fragmentShader) };

  /** The (variant, branch) pairs that actually have a swapped body — DERIVED, never listed. */
  const liveBranches = [...CENSUS.byBranch.keys()].map((k) => {
    const [variant, pt] = k.split(':');
    return { variant, pt: Number(pt) };
  });

  it('the extraction reproduces all six lines PLAN §6b names by hand, and finds 93 more', () => {
    const g = EXTRACT.gas.branch;
    expect(g.get(1).has('stormMask')).toBe(true);      // Planet.js:434
    expect(g.get(1).has('polarDark')).toBe(true);      // Planet.js:437
    expect(g.get(6).has('hotspot')).toBe(true);        // Planet.js:446
    expect(g.get(6).has('nightSide')).toBe(true);      // Planet.js:451
    expect(g.get(7).has('ringNoise')).toBe(true);      // Planet.js:407
    expect(g.get(10).has('haze')).toBe(true);          // Planet.js:413
    const live = liveBranches.reduce((n, b) => n + EXTRACT[b.variant].branch.get(b.pt).size, 0);
    const shared = new Set([...EXTRACT.gas.shared, ...EXTRACT.rocky.shared]).size;
    expect(live + shared).toBe(99);
  });

  it('every LIVE branch has rows, and they claim its symbols exactly once', () => {
    for (const { variant, pt } of liveBranches) {
      const measured = [...EXTRACT[variant].branch.get(pt)].sort();
      const rows = CH2_ROWS.filter((r) => r.variant === variant && r.branch === `pt${pt}`);
      expect(rows.length, `no ledger row for ${variant} pt${pt} (${measured.length} symbols)`).toBeGreaterThan(0);
      const claimed = rows.flatMap((r) => r.subjects);
      expect(claimed.filter((x, i) => claimed.indexOf(x) !== i), `${variant} pt${pt} double-claims`).toEqual([]);
      expect(claimed.sort(), `${variant} pt${pt}`).toEqual(measured);
    }
  });

  it('the shared region is claimed too — it is where P-01…P-07 reach the pixel', () => {
    const measured = [...new Set([...EXTRACT.gas.shared, ...EXTRACT.rocky.shared])].sort();
    const claimed = CH2_ROWS.filter((r) => r.branch === 'shared').flatMap((r) => r.subjects);
    expect(claimed.filter((x, i) => claimed.indexOf(x) !== i)).toEqual([]);
    expect(claimed.sort()).toEqual(measured);
  });

  it('no row rules a branch that has no swapped body', () => {
    // `rocky pt3` (lava), `pt4` (ocean), `pt8` (venus) and the whole `exotic` variant have zero
    // swapped bodies today. Ruling them would be a claim about a population that does not exist;
    // the previous test is what demands rows the day one appears.
    const liveKeys = new Set(liveBranches.map((b) => `${b.variant}:pt${b.pt}`));
    for (const r of CH2_ROWS) {
      if (r.branch === 'shared') continue;
      expect(liveKeys.has(`${r.variant}:${r.branch}`), `${r.id} rules a dead branch`).toBe(true);
    }
  });

  it('every row carries a legal ruling', () => {
    for (const r of CH2_ROWS) {
      expect(RULINGS.has(r.ruling), `${r.id} ruling "${r.ruling}"`).toBe(true);
      expect(r.subjects.length, `${r.id} claims nothing`).toBeGreaterThan(0);
    }
  });

  it('⭐⭐ CONTROL THAT MOVED — a newly swappable branch DEMANDS rows, it does not pass quietly', () => {
    // The live-branch set is derived from the population, and the claim is that a body class
    // becoming swappable in an unruled branch reds the build. That claim is worth nothing until the
    // situation is constructed, so here it is: the same census with Step 6d's provenance refusal
    // ignored admits the two `crystal` bodies, and `crystal` is the EXOTIC variant — 20 branch
    // blocks this ledger rules none of (named limit 5).
    const keys = new Set();
    setLabGasBodiesOverride(true);
    try {
      for (let i = 0; i < CORPUS_N; i++) {
        const sys = StarSystemGenerator.generate(`lab-procedural-${i}`, null);
        for (const e of (sys.planets || [])) {
          const d = e.planetData;
          if (!labPipelineAdmits(d, conditionFromPlanet(d)).packs.length) continue;
          keys.add(`${shaderVariantFor(d.type)}:${TYPE_INDEX.indexOf(d.type)}`);   // provenance IGNORED
        }
      }
    } finally { setLabGasBodiesOverride(null); }
    // The shipped population has no exotic branch; the mutant population does.
    expect([...CENSUS.byBranch.keys()]).not.toContain('exotic:13');
    expect([...keys]).toContain('exotic:13');
    // And under that population the live-branch check has no row to find — the failure this gate
    // exists to produce, executed rather than asserted.
    const rows = CH2_ROWS.filter((r) => r.variant === 'exotic' && r.branch === 'pt13');
    expect(rows.length).toBe(0);
    const measured = extractBranchLocals(PLANET_SHADER_VARIANTS.exotic.fragmentShader).branch.get(13);
    expect(measured.size).toBe(9);          // 9 unruled symbols would arrive with that one body
  });

  it('⭐ CONTROL THAT MOVED — a new hardcoded effect in the legacy shader is an unclaimed symbol', () => {
    // The gate's whole job. Inject one line into a COPY of the shipped gas source, in the branch the
    // plan's own six live in, and show the extraction returns it and the partition rejects it.
    const mutant = PLANET_SHADER_VARIANTS.gas.fragmentShader.replace(
      'float stormMask = smoothstep(0.78, 0.88, bandVal);',
      'float stormMask = smoothstep(0.78, 0.88, bandVal);\n    float wdNewEffect = pow(bandVal, 2.0);',
    );
    expect(mutant).not.toBe(PLANET_SHADER_VARIANTS.gas.fragmentShader);   // the replace really fired
    const after = extractBranchLocals(mutant).branch.get(1);
    expect(after.has('wdNewEffect')).toBe(true);
    const claimed = CH2_ROWS.filter((r) => r.variant === 'gas' && r.branch === 'pt1').flatMap((r) => r.subjects);
    expect([...after].sort()).not.toEqual(claimed.sort());                // ← the partition reds
  });

  it('⭐ CONTROL THAT MOVED — the extractor really is brace-matched, not line-counted', () => {
    // A naive "everything until the next `}`" reader stops at the first nested block and would
    // silently under-report a branch. Constructed so the two readers disagree.
    const src = 'void main() {\n if (planetType == 1) {\n  if (x > 0.0) { float inner = 1.0; }\n'
              + '  float after = 2.0;\n }\n}\n';
    const got = extractBranchLocals(src).branch.get(1);
    expect([...got].sort()).toEqual(['after', 'inner']);
    const naive = src.slice(src.indexOf('planetType == 1'));
    const naiveBody = naive.slice(0, naive.indexOf('}'));
    expect(/\bfloat\s+after\b/.test(naiveBody)).toBe(false);              // ← the naive reader loses it
  });

  it('⭐ named limit 3, pinned with the construct that produced it', () => {
    // An inline effect with no named local declares nothing and is invisible to this extraction.
    // Recorded here, in the gate, where the next author meets it — not only in the ledger's §5.
    const src = 'void main() {\n if (planetType == 1) {\n  surfaceColor *= 1.0 - smoothstep(0.6, 1.0, y);\n }\n}\n';
    expect([...(extractBranchLocals(src).branch.get(1) || [])]).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 5. THE DOC AND THIS SUITE ARE ONE ARTEFACT.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('5. the ledger document', () => {
  it('declares both machine-readable regions and nothing outside them is parsed', () => {
    expect(LEDGER_MD).toContain('<!-- LEDGER-CH1 -->');
    expect(LEDGER_MD).toContain('<!-- /LEDGER-CH1 -->');
    expect(LEDGER_MD).toContain('<!-- LEDGER-CH2 -->');
    expect(LEDGER_MD).toContain('<!-- /LEDGER-CH2 -->');
    expect(CH1_ROWS.length).toBe(18);
    expect(CH2_ROWS.length).toBe(16);
  });

  it('every ruling in the document is one of the three Max named', () => {
    const rulings = new Set([...CH1_ROWS, ...CH2_ROWS].map((r) => r.ruling));
    for (const r of rulings) expect(RULINGS.has(r), `illegal ruling "${r}"`).toBe(true);
    // All three are actually used — a ledger with no losses is a ledger that was not run, and one
    // with no `carried` rows would mean the swap carries nothing, which §2 measures as false.
    expect(rulings).toEqual(new Set(['carried', 'accepted-loss', 'blocking']));
  });

  it('⭐ CONTROL THAT MOVED — the parser reads the DOC, not a copy inside this file', () => {
    // If the row table were duplicated here, editing the document would not move any assertion. Feed
    // the parser a doc with one row deleted and the row count changes; the real file is untouched.
    const shrunk = LEDGER_MD.replace(/^\| P-04 \|.*$/m, '');
    const rows = shrunk.slice(shrunk.indexOf('<!-- LEDGER-CH1 -->'), shrunk.indexOf('<!-- /LEDGER-CH1 -->'))
      .split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'))
      .map((l) => l.split('|').map((c) => c.trim()))
      .filter((f) => /^[PGRS]-\d\d$/.test(f[1] || ''));
    expect(rows.length).toBe(CH1_ROWS.length - 1);
  });
});
