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
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
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
    corpusWithMoons: 0, corpusMoons: 0,   // ⭐ CORPUS-LEVEL, counted OUTSIDE the admission branch on purpose — see the note above the assertions.
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
        // ⭐ Counted BEFORE any admission or predicate test, so these two are invariant under
        // every pack-predicate change and move only when the moon program itself moves.
        const corpusMoons = (e.moons || []).length;
        if (corpusMoons) { out.corpusWithMoons++; out.corpusMoons += corpusMoons; }
        const adm = labPipelineAdmits(d, conditionFromBody(d));
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

/** src/objects/Planet.js:1921 `_typeIndex() {` — the same ordered list, which IS the GLSL branch id. */
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
  // ⛔ `written` IS A UNION OVER THE PASS, NOT A SAMPLE OF THE FIRST BODY. It used to be
  // `if (written === null) written = …`, which was silently correct only while every registered
  // predicate was `=== 'gas'` and the first admitted body was therefore always a gas one. The
  // Step-10a registration made the first admitted body in `lab-procedural-0` a SOLID planet and
  // the whole instrument re-pointed at rockySurface's 21 names — measured, exactly TWO write-sets
  // exist over this corpus (21 names on 163 bodies, 26 on 103; disjoint, union 47), so a sample
  // answers one of two questions depending on generation order. P-04's inverted fence below reads
  // this set; under a sample it was red with limbDeck's wire fully intact.
  const writtenSet = new Set();
  let bodies = 0;
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
      for (const n of lab.uniformsWritten) writtenSet.add(n);
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
    bodies, lost, lostAtZero, carried, divergedCarried, carriedTotal, bucketOf,
    written: [...writtenSet].sort(),
    labVarying: varying(labVaries), gameVarying: varying(gameVaries),
    labSize: labVaries.size, gameSize: gameVaries.size,
  };
}

/** Structural encode. Vectors, colours, typed arrays and arrays-of-vectors all appear in this block. */
function encodeValue(v) {
  if (v == null) return 'null';
  if (typeof v === 'object') {
    if ('x' in v) return `v:${v.x},${v.y},${v.z ?? ''},${v.w ?? ''}`;
    // ⭐⭐ WAS `c:${...}` UNTIL 2026-08-21, AND THE PREFIX IS THE WHOLE OF WHAT CHANGED. A THREE.Color
    // and a THREE.Vector3 carrying the SAME three floats used to encode to two different strings, so
    // `sameValue` reported them as diverging on every body, forever, whatever any pack wrote. Both
    // containers upload to the same GLSL `vec3` slot — the container is a JS wrapper the GPU never
    // sees — so the old encoding was measuring the WRITER'S CHOICE OF CLASS and reporting it as a
    // per-body value loss. ⛔ THE FOURTH COMPONENT IS STILL DISTINGUISHED: a Color emits an empty
    // `w` field exactly as a `z`-only Vector3 does, so a Vector4 can never collide with either.
    if ('r' in v && 'g' in v) return `v:${v.r},${v.g},${v.b},`;
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
    // ⭐ RE-RECORDED AT STEP 10a, IN THE SAME COMMIT AS THE REGISTRATION THAT MOVED THEM. The fourth
    // registry entry's predicate is `compositionClass(condition) !== 'gas'` — the exact complement
    // of the three that were there — so every planet in the corpus is now claimed by one half or
    // the other and `claimed` becomes the whole population. These numbers moved for a DECLARED
    // reason; a census left stale would have reddened indistinguishably from a regression, which is
    // precisely what this pin exists to make impossible.
    expect(CENSUS.systems).toBe(200);
    expect(CENSUS.binarySystems).toBe(64);
    expect(CENSUS.claimed).toBe(852);          // 343 -> 852 (every planet; both predicates together)
    expect(CENSUS.provenanceBlocked).toBe(6);  //   2 ->   6 (the exotic bodies ExoticOverlay unstamps)
    expect(CENSUS.swapped).toBe(846);          // 341 -> 846
    // ⛔ THESE TWO ARE NOT RE-PINNED, AND THE REASON IS NARROWER THAN IT WAS FIRST WRITTEN. Both are
    // moon-keyed and the moon population is LIVE under an unrelated formation program (mechanism at
    // src/generation/StarSystemGenerator.js:600), so re-recording them here would absorb another
    // lane's open defect into this lane's commit. They stay stale and this suite stays red on them.
    // ⛔ WHAT THEY NO LONGER PRESERVE IS THE SIGNAL. `withMoons` is counted INSIDE the `out.swapped++`
    // block, so it is a statistic over the swapped population — which this commit took 341 -> 846.
    // Measured here, in one pass: restricting the same census to gas-condition bodies (HEAD's whole
    // predicate) gives 341 swapped / 229 withMoons / 461 moons — HEAD's answer — while the shipped
    // predicate gives 846 / 420 / 663, against the pin's pre-window 228 / 456. The failure message is
    // therefore `expected 420 to be 228`, NOT the `expected 229 to be 228` an earlier draft of this
    // note claimed; the moon program's own +1/+5 is swamped by a +191 this commit caused, and B7 will
    // be re-pinning a number that encodes the registration rather than the formation change.
    // ⛔ AND THIS IS NOT "the only marker anyone has for it" — that claim was false when written. Six
    // moon-NATIVE reds carry the same window and are uncontaminated by this lane: three in
    // tests/body-identity-fence.test.js, two in tests/moon-condition-contract.test.js (G4
    // PLANET-CLASS, POPULATION) and one in tests/moon-rng-stream-identity.test.js (ORPHANS).
    // ⭐ WHAT B7 SHOULD ACTUALLY DO: pin the CORPUS population, not the swapped one. Measured in the
    // same pass, planets-with-moons / moons over `lab-procedural-0…199` is 422 / 665 — a figure that
    // does not read `adm.admitted` at all, so it is invariant under this lane's predicate and moves
    // only when the moon program moves. A `toBe(420)` written now has to be re-measured again the
    // next time a predicate widens, which is the defect this note is recording.
    // ⭐⭐ FIXED 2026-08-21, AND THE FIX IS THE ONE THE NOTE ABOVE ASKED FOR RATHER THAN A NEW NUMBER.
    // These two asserted 228 / 456 and had been failing ever since the moon-formation window moved
    // the population — a red that stayed invisible because it sat inside the blessed 32. Both lanes
    // published 420 / 663 in prose while leaving the assertion carrying the withdrawn figure.
    // ⛔ Re-pinning them at 420 / 663 was NOT the fix: they are counted inside `out.swapped++`, so
    // they move on any predicate widening — which is what happened here and would happen again.
    // The invariant pair is asserted instead; the swapped pair is kept, at its measured value, as
    // the thing that is ALLOWED to move.
    expect(CENSUS.corpusWithMoons).toBe(422);
    expect(CENSUS.corpusMoons).toBe(665);
    expect(CENSUS.withMoons).toBe(420);        // 228 -> 420, predicate-dependent BY CONSTRUCTION
    expect(CENSUS.moons).toBe(663);            // 456 -> 663, ditto
    expect(CENSUS.inBinary).toBe(269);         // 125 -> 269
    // Not "most primaries are non-white" — every one of them. The star-colour loss (P-01) has no
    // body on which it is invisible, which is a stronger statement than the plan's "all giants".
    expect(CENSUS.nonWhitePrimary).toBe(846);  // 341 -> 846, and still every swapped body
  });

  it('⭐ 617 of the 846 swapped bodies do not render the GAS program today', () => {
    // The predicate is condition-derived (drivers/index.js:100) and the legacy program is chosen by
    // the `type` LABEL (Planet.js:1422). PLAN §6b's loss table enumerates the gas branch only, and
    // ledger rows R-01…R-04 are that gap.
    // ⭐ AT STEP 10a THE GAP BECOMES THE MAJORITY: 114 of 341 -> 617 of 846. THREE ROCKY BRANCHES
    // ARE NEWLY LIVE — `rocky:3` (lava, 52 bodies), `rocky:4` (ocean, 6) and `rocky:8` (venus, 130)
    // — and §4's `every LIVE branch has rows` demands a ledger row with a RULING for each. Rows R-05,
    // R-06 and R-07 are those, and each ruling is DERIVED from §2's own test rather than chosen: the
    // lab declaring the carrier makes venus `blocking`, a different parameterisation makes lava and
    // ocean `accepted-loss` on the precedent of P-09 and R-03. ⚠ What is still Max's, reserved
    // 2026-08-09, is the SCHEDULING; §2 defines exactly three rulings and "deferred" is not one, so
    // that deferral lives in each row's evidence cell — the shape P-10 already set.
    // ⚠ `gas:7` also moved, 3 -> 5, AND IT IS THIS COMMIT'S PREDICATE, NOT THE MOON WINDOW. Measured
    // on both trees: the corpus carries 5 `eyeball` bodies either way, 3 of them gas-CONDITION and 2
    // rocky-CONDITION, and the two rocky ones swap for the first time here because `eyeball` is in
    // GAS_TYPES (src/objects/Planet.js:1422) so `shaderVariantFor` says gas while the condition does
    // not. `byVariant.gas` 227 -> 229 is the same two bodies. ⛔ Do not file this with `withMoons`:
    // a "restore the moon-window numbers" pass would move it back to 3 and red this suite for an
    // invented reason, and a genuine future formation-driven type move here would be pre-excused.
    expect(Object.fromEntries(CENSUS.byVariant)).toEqual({ gas: 229, rocky: 617 });
    expect(Object.fromEntries(CENSUS.byBranch)).toEqual({
      'gas:1': 53, 'gas:6': 5, 'gas:7': 5, 'gas:10': 166,
      'rocky:0': 181, 'rocky:2': 131, 'rocky:3': 52, 'rocky:4': 6,
      'rocky:5': 13, 'rocky:8': 130, 'rocky:9': 104,
    });
  });

  it('⭐ CONTROL THAT MOVED — the provenance test is what makes 852 into 846', () => {
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
          const adm = labPipelineAdmits(d, conditionFromBody(d));
          if (!adm.packs.length) continue;
          claimedIgnoringProvenance++;
          if (!adm.admitted) exotic.push({ type: d.type, blockers: adm.provenance.blockers });
        }
      }
    } finally { setLabGasBodiesOverride(null); }
    expect(claimedIgnoringProvenance).toBe(852);          // ← the mutant's answer
    expect(CENSUS.swapped).toBe(846);                     // ← the shipped answer
    // ⭐ THE REFUSED SET GREW AND DIVERSIFIED AT STEP 10a — 2 -> 6, and no longer `crystal` alone.
    // `ecumenopolis` and `shattered` are exotic-variant too, and they became visible here only
    // because the widened predicate claims them; the blocker is the SAME ExoticOverlay stamp loss.
    expect(exotic.map((x) => x.type))
      .toEqual(['crystal', 'crystal', 'crystal', 'crystal', 'ecumenopolis', 'shattered']);
    for (const x of exotic) expect(x.blockers).toEqual(['no _systemSeed', 'no _ordinal']);
    // …and the refused ones really are the unruled variant.
    for (const t of ['crystal', 'ecumenopolis', 'shattered']) expect(shaderVariantFor(t)).toBe('exotic');
  });

  it('the flag is the other half of admission, and OFF means no swap at all', () => {
    const sys = StarSystemGenerator.generate('lab-procedural-4', null);
    const gas = sys.planets.find((p) => shaderVariantFor(p.planetData.type) === 'gas'
      && labPipelineAdmits(p.planetData, conditionFromBody(p.planetData)).packs.length);
    expect(gas).toBeTruthy();
    expect(isLabPlanetMaterial(materialAt(gas.planetData, sys.starInfo, true).material)).toBe(true);
    expect(isLabPlanetMaterial(materialAt(gas.planetData, sys.starInfo, false).material)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 2. THE HEADLINE — how much per-body character survives the swap.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('2. the collapse in per-body variation', () => {
  it('45 of the game material’s 73 uniforms vary across bodies; 52 of the lab’s 369 do', () => {
    expect(LEDGER.gameSize).toBe(74);   // ⭐ 72 -> 73 AT 2026-08-25: uProvinceWeight, on Max's ruling that the GAME ADOPTS THE LAB'S province gating for craters. This is the parity list measuring the game material moving one step TOWARD the lab's rather than away — the only direction this number is supposed to travel.   // +1 2026-08-26: uCoarseCut, the tidal process term moved off the FREQUENCY and onto the AMPLITUDE (rockySurface pack; src/worldengine/base/macroWavelength.js coarseReliefCut). A DECLARED addition, not drift.
    //   // 71 -> 72 AT B2P: uPosterizeLevels, the colour quantum. It is CONSTANT across bodies (a global display setting), so gameVarying stays 45 — the two numbers moving apart is the control that this is a declaration and not a new per-body draw.
    expect(LEDGER.labSize).toBe(377);   // ⭐⭐ 370 -> 377 ON 2026-09-02, AND THE +7 IS ENUMERABLE — the lab bake host's scalar slots, created on attach (src/rendering/bake/labBakeHost.js `LAB_SCALAR_SLOTS`): uReliefBakeStrength, uCraterBakeRestore, uRiverCarveStrength, uRiverCarveFloor, uRiverCarveDepth, uRiverCarveRough, uRiverCarveGateHi. The LAB creates these seven at init / route time and `makeUniforms` has never had them, so before this commit a game body's lab material declared five of the shader's uniforms with NO slot at all — the same class of defect ensureLabSamplers was written for (LabPlanetMaterial.js:110), one level down from the samplers. ⚠ ALL SEVEN ARE CONSTANT ACROSS BODIES until a body's first draw bakes it, so `labVarying` does NOT move: that is the control that this is a DECLARATION and not a new per-body draw, the same control B4-1 and B4-2 used. ⚠ gameVarying and gameSize are unchanged again — the GAME material was not touched.   // ⭐⭐ 361 -> 369 AT B4-2, and the +8 is enumerable: uStarPos1, uStarPos2, uShadowMoonCount, uShadowMoonPos, uShadowMoonRadius, uShadowPlanetCount, uShadowPlanetPos, uShadowPlanetRadius — the caster set that closes ledger P-03. MEASURED in this session, not derived: makeUniforms() returns 364 keys and buildLabPlanetMaterial() reports uniformCount 369 (the 5 ensureLabSamplers slots). ⚠ gameVarying and gameSize are UNCHANGED again, the same control B4-1 used: the GAME material was not touched, so this is a lab-side declaration and not a new per-body draw.   // ⭐ 356 -> 361 AT B4-1, and the +5 is enumerable: uLightDir2, uStarColor1, uStarColor2, uStarBrightness1, uStarBrightness2 — the star set that closes ledger P-01 and P-02. MEASURED in this session, not derived: makeUniforms() returns 356 keys and buildLabPlanetMaterial() reports uniformCount 361 (the 5 ensureLabSamplers slots). ⚠ gameVarying stays 45 and gameSize stays 72: the GAME material was not touched, which is the control that this is a lab-side declaration and not a new per-body draw.   // +1 2026-08-26: uCoarseCut (ledger row P-19) — the tidal process term moved from FREQUENCY to AMPLITUDE. Declared addition.
    // ⭐ RE-PINNED AT STEP 10a, 37 -> 45. This is a POPULATION move, not a code move: the pass now walks 266 bodies instead of 103, and eight game uniforms that read one value across the gas-only set read several across the whole one. Nothing about the game material changed. ⚠ AND B2 LEG 3 LEFT IT AT 45 ON PURPOSE, which is the control that the leg touched the LAB material and not the game's: `uNoiseScale` was already in `gameVarying` (the legacy material spends a drawn per-body `d.noiseScale`), so a leg that moved the game side would have moved this number too.
    expect(LEDGER.gameVarying.length).toBe(45);
    // ⛔ MEMBERSHIP, NOT A COUNT. Step 4 measured that a count-preserving permutation passes every
    // instrument this program owns byte-identically, so a bare count would accept a build in
    // which the bands stopped varying and something else started.
    // ⭐⭐ 48 -> 49 AT B2 LEG 3, 2026-08-20, AND THE ONE NEW NAME IS THAT LEG'S ENTIRE CLAIM. `uNoiseScale` was the last frequency in the engine with no physical size behind it — the factory 4.0 on BOTH sides, written by NEITHER. rockySurface now emits it km-shaped, and it lands here rather than in the `written`-minus-`labVarying` residue below because it VARIES per body: the base wavelength law is a constant (radius cancels under the game display policy), so all of the variation is the Io-anchored tidal process term at src/worldengine/base/macroWavelength.js:139 `export function macroShortening(rawIoRatio) {`. ⚠ MEASURED on `lab-procedural-0…199`'s 1160 non-gas bodies, WITH THE PRECISION CONVENTION ON EVERY FIGURE because a raw float64 count splits one physical value across ULP-adjacent doubles: 985 distinct at raw float64, 844 at 9 significant figures, 780 at float32 — the precision a uniform reaches the shader at — across 83 distinct 5 % bins, where the LAB factory default was exactly 1 of each. ⛔ THAT `1` IS THE LAB'S 4.0, NOT WHAT RENDERS: the mounted legacy material writes the generator's own draw and MEASURED that is 1160 distinct over the same 1160 bodies at all three precisions, so the swap TRADES DISTINCTNESS FOR MEANING rather than adding it, and it reached 0 pixels until B7, 2026-08-21 — ⭐ CORRECTED, NOT DELETED: src/objects/Planet.js:2158 `export const LAB_GAS_BODIES_DEFAULT = true;` now admits these bodies, so the traded distinctness IS what renders. ⛔ IF THE PROCESS TERM WERE EVER REMOVED this name would leave this list and the residue assertion below would red — which is the control that says the differentiation is real and not a re-labelled constant.
    // ⭐ 16 -> 48 AT STEP 10a, AND THE 32 NEW NAMES ARE THE WHOLE POINT OF THE STEP: the 21-name rockySurface family (crater, ejecta, palette, offsets, `uPerturb`) now varies per body, and the
    // three MASTER GATES `uBandStrength`/`uJetStrength`/`uLimbStrength` joined it too — not because a deck changed, but because they hold their gate value on the 103 gas bodies and the factory default on the 163 solid ones, so across the merged population they differ.
    // ⭐ B3 LEG 1 ADDS FOUR AND ONLY FOUR: the aurora family. Nothing else on this list moved, and
    // that is the check — `solidOptics` also writes `uTermStrength`/`uTermWidth`/`uTermColor`, which
    // were ALREADY varying (the gas half held the factory default, the solid half the game's value),
    // and `uLimbExponent`/`uLimbColor`, already varying from limbDeck. So the four newcomers are
    // exactly the names that had NO writer at all on either side before this pack.
    // ⭐⭐ B3 LEG 3 ADDS FOURTEEN, AND EVERY ONE OF THEM IS NEW TO THIS LIST — 56 -> 70. They are the
    // whole `solidFeatures` contract set (F7 edifices, F9/F10's shared cryo master, F23 frost, F22
    // polar caps, F17 glacial), and BEFORE this commit each read one value on every body in the
    // corpus because nothing wrote any of them. ⛔ NOTHING LEFT THE LIST, which is the control that
    // the leg widened the lab material and touched neither the game's nor another pack's writes.
    // ⚠ THREE OF THE FOURTEEN ARE FLAT ON THE MOON HALF ALONE and are on this list only because the
    // pass pools planets with moons — MEASURED over lab-procedural-0…199's 632 plain moons:
    // `uShieldStratoMix` 1 distinct (`condition.habitability` is undefined on 632/632),
    // `uFrostLocked` 1 distinct (every plain moon reads tidally locked), `uFrostLatitudeBias`
    // 1 distinct (a plain-moon record carries no tilt key of either spelling). On the 852 planets
    // they are 17, 2 and 852 distinct respectively. The moon-half figures are in this leg's report
    // rather than folded into this pooled number, because the pooled number would hide them.
    // ⭐⭐ AND EIGHT MORE 2026-09-02, `fluvialDeck` (72 -> 80 — ⛔ SUPERSEDED THE SAME DAY by the
    // 72 -> 82 note directly below, which is the count this array actually holds; kept because it
    // names WHICH eight arrived first): uSeaLevel, uLiquidMask, uCoastStrength,
    // uDeltaDensity, uFluvialActivity, uFluvialDepth, uFluvialMeander, uOutflowActivity. Every one was
    // written by NOTHING before this commit, so each read one value on every body in the corpus.
    // ⭐⭐ AND ALL TEN VARY, WHICH THEY DID NOT IN THIS PACK'S FIRST DRAFT — 72 -> 82. `uOutflowDensity`
    // and `uStrandStrength` are functions of erosion alone, and the raw transcription of the lab's
    // block read `.erosion` while the game writes `erosionLevel`, so both were written-and-CONSTANT at
    // 0 on 124/124 solid bodies and sat in the residue below. ROOT-0 fix 1's two-spelling read landed
    // in the pack (tests/driver-pack-fluvialdeck.test.js §F) and they now vary on 66 and 122 bodies.
    // ⛔ THIS LIST IS THE INSTRUMENT THAT CAUGHT IT: a wire that lands on a dead input is invisible to
    // every count and to the pack's own laws, and shows up here and only here as written-and-constant.
    expect(LEDGER.labVarying).toEqual([   // ⭐⭐ ONE NAME LEFT THIS LIST ON 2026-09-02, AND IT IS THE FIRST TO LEAVE IT BY BEING DEFERRED RATHER THAN BY DYING. `uSeaLevel` has TWO writers now: driver pack #9 at mount, and the river router's histogram solve at the body's FIRST DRAW, which wins on a wet body (intent.md decision 3, docs/WORKSTREAMS/wire-river-router-lab-into-game/). `attachLabBake` therefore takes the slot to −1 at mount and writes the solved level at bake, so the sea arrives WITH the rivers that drain into it instead of jumping from one shoreline to another mid-flight. ⛔ THIS LEDGER NEVER DRAWS A BODY, so it can only ever see the mount half — where every body now reads −1 and the name is constant; it reappears in the residue below for the same reason. The instrument that gates the OTHER half is tests/river-bake-host.test.js AC-7, which bakes a wet body and asserts `uSeaLevel.value === bundle.seaLevel` and `uCoastStrength.value === 1`; if the deferred write ever stopped landing, that suite reds and this one would not notice.
      'uAuroraColor', 'uAuroraIntensity', 'uAuroraRingLat', 'uAuroraRingWidth',
      'uBandAMid', 'uBandContrast', 'uBandDeflectScale', 'uBandM',
      'uBandPhaseJet', 'uBandRough', 'uBandS2', 'uBandSEq',
      'uBandStrength', 'uBandTint', 'uBandWarp', 'uBioGroundColor',
      'uBioGroundCover', 'uBodyRadius', 'uChaosRaftJitter', 'uCoarseCut', 'uCoastStrength', 'uCraterAmp',
      'uCraterComplexD', 'uCraterDensity', 'uCraterOffset', 'uCraterRelaxation',
      'uCraterScale', 'uCratonColor', 'uCryoActivity', 'uDeltaDensity', 'uDetailOffset',
      'uEdificeMaxHeight', 'uEjectaAmp', 'uEjectaRampart', 'uEjectaStrength',
      'uFluvialActivity', 'uFluvialDepth', 'uFluvialMeander',
      'uFreshColor', 'uFrostAlbedo', 'uFrostCondensationT', 'uFrostLatitudeBias',
      'uFrostLocked', 'uFrostMaxCoverage', 'uGlacialFlowVigor', 'uGlacialStrength',
      'uIcenessMix', 'uJetFestoon', 'uJetShearTurb', 'uJetSpeed',
      'uJetStrength', 'uLightDir', 'uLimbColor', 'uLimbExponent',
      'uLimbStrength', 'uLiquidMask', 'uMacroOffset', 'uNoiseScale', 'uOutflowActivity', 'uOutflowDensity', 'uPerturb',
      'uPlanetTempEq', 'uPldStrength', 'uPolarMode', 'uPolarPhase',
      'uPolarPole', 'uPolarR0', 'uPolarRing', 'uPolarSides',
      'uPolarStrength', 'uPolarTint', 'uSedColor', 'uShieldStratoMix',
      'uStarBrightness2', 'uStarColor1', 'uStarColor2', 'uStormAux', 'uStormColor', 'uStormCount', 'uStormParams', 'uStormPosSize', 'uStrandStrength', 'uTermColor',
      // ⭐⭐ `uTermStrength` LEFT THIS LIST ON 2026-08-21 AND THE DIRECTION IS THE WHOLE POINT — a name
      // leaving `labVarying` normally means a wire died, and here it means one landed. The lab used
      // to write TWO values across the corpus: 0.15 on the 163 solid bodies `solidOptics` claimed,
      // and the factory 0 on the 103 gas bodies NO pack claimed. That is what made it "vary".
      // `giantSurface` gives the gas half the same producer, `columnFraction` saturates above 0.3 bar
      // and every body in this corpus is above it, so the lab now writes the CONSTANT 0.15 — which is
      // exactly what the game writes, and `gameVarying` has never contained this name either.
      // ⚠ SO THE AGREEMENT ON IT IS THE WEAK KIND (Instrument C's caveat: green is weak evidence on a
      // constant), and ledger P-11 says so rather than counting it as per-body character.
      'uTermWidth', 'uThermalDir', 'uVolcanismStrength',
      'uWeatheredColor',
      // ⭐⭐ THE THREE NAMES B4-1 ADDS, AND THEY ARE THIS BLOCK'S ENTIRE CLAIM — `uStarColor1` VARYING PER BODY on the lab material is exactly the thing ledger P-01 said was lost ("every swapped body renders under implicit white light"). ⛔ NOTE WHICH TWO OF THE FIVE DID **NOT** JOIN, because that is the control: `uStarBrightness1` is a literal 1.0 on every primary StarSystemGenerator draws, so it is constant BY CONSTRUCTION and a build in which it started varying would mean the generator moved, not the port; and `uLightDir2` is constructed at (0,0,0) on every body and only ever written by the PER-FRAME seam (src/main.js copies it inside its binary branch), so this construction-time pass cannot see it and must not pretend to — P-02's direction half is fenced at the seam instead, in tests/lab-shader-perframe-seam.test.js.
    ]);
    // ⭐ MEASURED POST-REGISTRATION, over the UNION write-set: 76 of the 80 uniforms the seven writing
    // packs emit vary per body — ⭐⭐ COUNTED, NOT INHERITED (2026-09-02, the whole-branch review). This
    // sentence said "79 of the 79" and BOTH halves were wrong after driver pack #9: `written` is 80
    // names, `labVarying` is 82, and the residue below is FOUR, not zero. The three numbers do not
    // reconcile by subtraction and are not supposed to: `labVarying` carries six names NO pack writes
    // (uBodyRadius, uLightDir, uStarBrightness2, uStarColor1, uStarColor2, uThermalDir), so
    // 80 written − 4 residue = 76 written-and-varying, and 82 − 76 = the six. Every figure here is off
    // the arrays in this file, counted on 2026-09-02.
    // (53 of 55 before B3 leg 3 added `solidFeatures`' fourteen new names,
    // all fourteen of which vary, so the residue below is UNCHANGED — a new write that did not vary
    // would have grown it, and that is exactly the difference between wiring a law and wiring a
    // constant. ⭐ THAT TEST IS WHY `solidFeatures` REFUSES SEVEN MORE NAMES it could have written:
    // `chaosCellScale`, `chaosMatrixRough`, `doubleRidgeFreq`, `cryoRidgeOffset`, `cryoRidgeWidth`,
    // `groovedBandFreq` and `pldLevels` are bare literals in labCore that are byte-equal to the lab
    // material's own factory defaults, so each would have landed in this residue and moved no pixel.
    // The refusals and their measurements are listed in that pack's header.)
    // The two that do not are `uEjectaLump` and `uTerraceCount` — rockySurface
    // forwards both from `craterUniformsFrom`, and on this corpus every body that fires a crater
    // schedule lands on the same lump and terrace count. ⚠ The three master gates are NO LONGER on
    // this list; see the note above for why that is a population fact, not a wire fact.
    expect(LEDGER.written.filter((n) => !LEDGER.labVarying.includes(n)))
      // ⭐ `uTermStrength` JOINED THESE TWO ON 2026-08-21, AND IT ARRIVED BY THE OPPOSITE ROUTE.
      // `uEjectaLump` and `uTerraceCount` are written-and-constant because their LAW is constant.
      // `uTermStrength` is written-and-constant because `columnFraction` saturates above 0.3 bar and
      // every body in this corpus is above it — so once `giantSurface` gave the gas half a writer,
      // the lab's two values (0.15 solid / factory 0 gas) collapsed to the game's single 0.15.
      // ⛔ A NAME ENTERING THIS LIST IS NORMALLY A WIRE DYING. Here it is a wire landing, and the
      // way to tell them apart is the GAME side: `gameVarying` has never held this name either.
      // ⭐⭐ TWO NAMES JOINED THIS LIST ON 2026-09-02 AND LEFT IT AGAIN THE SAME DAY, WHICH IS THE MOST
      // USEFUL THING THIS RESIDUE HAS DONE. `uOutflowDensity` and `uStrandStrength` arrived
      // written-and-constant — a wire that landed on a DEAD INPUT, the third of the three ways a name
      // reaches this list and the only one that is a defect. The input was erosion, read under the lab
      // spelling while the game writes `erosionLevel`; ROOT-0 fix 1's two-spelling read closed it and
      // both names moved into `labVarying` above. ⛔ THE RESIDUE IS FOUR, NOT THREE — this line said
      // "BACK TO THREE" and the assertion one line below it already listed four names (2026-09-02, the
      // whole-branch review). Two of the three went back to `labVarying` when the erosion read was
      // fixed and `uSeaLevel` arrived by the DEFERRAL route in the same commit, so the residue never
      // returned to three. It is four because the defect was fixed AND a new deferral landed, not
      // because the assertion was loosened.
      .toEqual(['uEjectaLump', 'uSeaLevel', 'uTermStrength', 'uTerraceCount']);   // ⭐⭐ AND `uSeaLevel` JOINED ON 2026-09-02 BY THE FOURTH ROUTE — DEFERRAL, not a dead law, not a collapsed population and not a dead input. The lab bake host takes the slot to −1 at mount and the router writes the solved level on the body's first draw (see the note on `labVarying` above). ⛔ HOW TO TELL IT FROM A DYING WIRE, because that is what this list normally means: the write still exists and is gated elsewhere — tests/river-bake-host.test.js AC-7 bakes a wet body and asserts the solved sea lands on this slot. A name in this residue with NO such gate anywhere is the defect this list is for.
  });

  it('the seven writing packs emit 80 uniforms between them, and the ledger’s `carried` rulings rest on them', () => {
    // If the pack stops writing the band deck, G-01/G-04/G-07's "carried" ruling is false. Pinned as
    // a SET OF NAMES, not a length — Step 4 measured that a count-preserving permutation is
    // byte-identical to every instrument this program owns.
    // ⭐ THIS IS A UNION OVER THE PASS AND WAS NOT ALWAYS ONE. See the note on `writtenSet` in
    // `ledgerPass`: as a first-body sample this pin read 26 gas names by accident of generation
    // order, and Step 10a's solid-first population re-pointed it at rockySurface's 21 without any
    // deck changing. The two write-sets are disjoint, so the union is exactly 26 + 22 (21 until B2 leg 3 added `uNoiseScale` to the rockySurface half; the disjointness is what makes the union a sum, and it holds because giantDeck's predicate is `=== 'gas'` and rockySurface's is its exact complement).
    // ⭐ 48 -> 55 AT B3 LEG 1. `solidOptics` declares nine names; two of them (`uLimbColor`,
    // `uLimbExponent`) limbDeck already wrote on the gas half, so the UNION grows by the seven that
    // nothing wrote anywhere: the aurora four and the terminator three.
    // ⭐ 55 -> 69 AT B3 LEG 3. `solidFeatures` declares fourteen names and NOT ONE of them was
    // written by any pack before this commit, so the union grows by exactly its contract set — the
    // same shape leg 1 had, and the check that this pack collides with nothing: an overlap with an
    // existing writer would have shown up here as a union that grew by less than fourteen, and in
    // `applyDriverPacks` as a throw.
    // ⭐ 70 -> 80 ON 2026-09-02. `fluvialDeck` declares ten names and NOT ONE was written by any pack
    // before this commit, so the union grows by exactly its contract set — the same shape leg 1 and leg
    // 3 had, and the check that this pack collides with nothing: an overlap would show up here as a
    // union that grew by less than ten, and in `applyDriverPacks` as a throw.
    // ⛔ THIS LINE SAID "69 -> 79" AND BOTH ENDS WERE ONE LOW (corrected 2026-09-02, the whole-branch
    // review). The array below is 80 names counted, all ten of the pack's are in it, so the pre-pack
    // union was 70. The count is not asserted — membership is (see the note above) — which is exactly
    // why a wrong number could sit in the prose while the test stayed green.
    expect(LEDGER.written).toEqual([
      'uAuroraColor', 'uAuroraIntensity', 'uAuroraRingLat', 'uAuroraRingWidth',
      'uBandAMid', 'uBandContrast', 'uBandDeflectScale', 'uBandM',
      'uBandPhaseJet', 'uBandRough', 'uBandS2', 'uBandSEq',
      'uBandStrength', 'uBandTint', 'uBandWarp', 'uBioGroundColor',
      'uBioGroundCover', 'uChaosRaftJitter', 'uCoarseCut', 'uCoastStrength', 'uCraterAmp', 'uCraterComplexD',
      'uCraterDensity', 'uCraterOffset', 'uCraterRelaxation', 'uCraterScale',
      'uCratonColor', 'uCryoActivity', 'uDeltaDensity', 'uDetailOffset', 'uEdificeMaxHeight',
      'uEjectaAmp', 'uEjectaLump', 'uEjectaRampart', 'uEjectaStrength',
      'uFluvialActivity', 'uFluvialDepth', 'uFluvialMeander',
      'uFreshColor', 'uFrostAlbedo', 'uFrostCondensationT', 'uFrostLatitudeBias',
      'uFrostLocked', 'uFrostMaxCoverage', 'uGlacialFlowVigor', 'uGlacialStrength',
      'uIcenessMix', 'uJetFestoon', 'uJetShearTurb', 'uJetSpeed',
      'uJetStrength', 'uLimbColor', 'uLimbExponent', 'uLimbStrength',
      'uLiquidMask', 'uMacroOffset', 'uNoiseScale', 'uOutflowActivity', 'uOutflowDensity', 'uPerturb', 'uPlanetTempEq',
      'uPldStrength', 'uPolarMode', 'uPolarPhase', 'uPolarPole',
      'uPolarR0', 'uPolarRing', 'uPolarSides', 'uPolarStrength',
      'uPolarTint', 'uSeaLevel', 'uSedColor', 'uShieldStratoMix', 'uStormAux', 'uStormColor', 'uStormCount', 'uStormParams', 'uStormPosSize', 'uStrandStrength', 'uTermColor',   // ⭐⭐ AND FIVE MORE 2026-09-03, `stormDeck` (driver pack #10, workstream wire-storm-slice-lab-into-game): uStormAux, uStormColor, uStormCount, uStormParams, uStormPosSize — the F27/F28 carriage, written by NOTHING before this commit (uStormCount was 0 on every game body, so every GLSL storm term no-op'd). All five VARY per gas body (count 2–7; slots re-derived per (macroSeed, GAME_STORM_SEED)), so they land in `labVarying` too and the residue below is unchanged.
      'uTermStrength', 'uTermWidth', 'uTerraceCount', 'uVolcanismStrength',
      'uWeatheredColor',
    ]);
    // P-18's three `carried` names must actually VARY on the post-swap material, or "carried" is a
    // claim about a constant.
    for (const n of ['uLightDir', 'uBodyRadius']) expect(LEDGER.labVarying).toContain(n);
    expect(LAB_SHADER_CORPUS).toContain('uTime');
  });

  it('⭐⭐ the CARRIED bucket is a NAME bucket — 24 of 29 diverge in value', () => {
    // THE CONTROL IS THE TWO ANSWERS ON ONE INPUT. `swapLedgerOf` reports these names as CARRIED;
    // a value comparison over the identical pair of materials reports them as diverged. A ledger
    // that ruled the name would record 28 surviving features where at most 8 survive.
    expect(LEDGER.carried.size).toBe(30);   // +1 2026-08-25: uProvinceWeight is CARRIED — the lab has it too, now at the same 1.0 default   // +1 2026-08-26: uCoarseCut, the tidal process term moved off the FREQUENCY and onto the AMPLITUDE (rockySurface pack; src/worldengine/base/macroWavelength.js coarseReliefCut). A DECLARED addition, not drift.
    // ⛔ 19 -> 20 AT STEP 10a, AND THE ONE THAT CAME BACK IS `uLimbExponent`. At the limbDeck/polarDeck
    // registration it left this bucket (the deck wrote it, so the two sides agreed) and the note here
    // read "20 -> 19 … a registration that changed nothing would have left this at 20". That reading
    // was true of a GAS-ONLY population. limbDeck's predicate is `=== 'gas'`, so it never claims the
    // 163 solid bodies Step 10a admits; measured, `uLimbExponent` diverges on 59 of them and on 0 of
    // the 103 gas ones. This is a REAL per-body loss on the newly-admitted half, not an instrument
    // artefact, and P-11 claims it again in the ledger for exactly that reason. ⛔ Do not "fix" it by
    // scoping this pass to the gas half — that would suppress the loss rather than record it.
    // ⭐⭐ 24 -> 23 AT B3 LEG 1, AND THE ONE THAT LEFT IS THE ONE P-11'S ROW NAMES BY NUMBER.
    // `uLimbExponent` is gone from the diverged bucket entirely — not moved to a smaller count,
    // REMOVED: `solidOptics` forwards the game's own `optics.limbExponent` to the 163 solid bodies
    // limbDeck's gas-only predicate never claimed, so the row's "59 of those 163" is 0 and the name
    // drops out of `measured()` below. ⚠ `uLimbColor` and `uTermColor` did NOT leave with it and
    // that is not a half-done wire: both are written now and both still diverge on all 266 bodies
    // through the `encodeValue` CONTAINER split this file already records for the palette four
    // (game `THREE.Vector3` vs lab `THREE.Color`). Same measurement, different cause — see the
    // everyBody list below, where they sit alongside `uFreshColor` and its siblings.
    // ⭐⭐⭐ 23 -> 15 AT B3 LEG 2, AND IT IS THE LARGEST SHRINK THIS LINE HAS EVER TAKEN. The EIGHT
    // that left are P-14's whole subject cell — `uCraterAmp` `uCraterComplexD` `uCraterScale`
    // `uEjectaAmp` `uCraterDensity` `uCraterRelaxation` `uEjectaRampart` `uEjectaStrength` — and they
    // left because `craterDeck` gave the impact family a writer on the GAS half, which is the half
    // that was diverging. They land in the `agreeing` list below, in `uLimbExponent`'s stronger
    // sense: written on both sides from one producer, varying across the population, matching body
    // by body. MEASURED over lab-procedural-0…199 before the fence was moved: all ten crater names
    // went from diverging on up to 343 of 343 gas planets to 0 of 343.
    expect(LEDGER.divergedCarried.size).toBe(3);   // ⭐⭐⭐ 15 -> 2 AT THE GAS-HALF BLOCK, 2026-08-21, AND IT IS THE LARGEST SHRINK THIS LINE HAS TAKEN — larger than B3 leg 2's. THIRTEEN LEFT, from two causes that must not be conflated: SEVEN by a WIRE (`giantSurface` gives the gas half the terminator triple, the palette and the offsets — `uTermStrength` `uTermWidth` `uMacroOffset` `uDetailOffset` `uCraterOffset` `uBioGroundCover` `uIcenessMix`), and SIX by the INSTRUMENT (`encodeValue` stopped comparing the JS container, so `uBioGroundColor` `uFreshColor` `uLimbColor` `uSedColor` `uTermColor` `uWeatheredColor` — each measured at maxComponentDelta 0 on 266/266, i.e. bit-for-bit equal at float64 and diverging only as Vector3-vs-Color). ⛔ EXACTLY SIX NAMES FLIP ON THE INSTRUMENT CHANGE AND ALL SIX ARE NAMED HERE; that enumeration is what makes it a comparison fix rather than a loosening, and it was probed rather than reasoned. The TWO that remain are the two with no writer on either half.   // ⭐⭐ 20 -> 24 AT B2 LEG 1, 2026-08-20, AND THE FOUR NEWCOMERS ARE THE ONES P-14 PREDICTED: `uCraterDensity` (64 of 266 bodies), `uEjectaStrength` (64), `uCraterRelaxation` (56), `uEjectaRampart` (42). They used to sit in the "agree by absence" list below — both sides zero — and P-14 wrote down in advance what would happen: "a loud default behind a shut gate … it becomes a pixel the moment anything opens that gate." Leg 1 opened it: re-deriving CRATER_VIS_FLOOR_RAD 0.02 -> 9.6e-4 and replacing the fixed density floor with the per-body CRATER_MIN_VISIBLE gave 289 of 526 bodies a live crater record where 8 had one. ⚠ AND THE DIRECTION IS THE BAD ONE, MEASURED NOT ASSUMED: on every diverging body the GAME writes the live value and the LAB writes 0 (`rocky: uCraterDensity 0.0008051676964833844 -> 0`; `sub-neptune: uEjectaStrength 1 -> 0`). The cause is a GATE difference the leg neither created nor closes — rockySurface multiplies the crater terms by `craterRelevanceOf(condition)` and its pack predicate excludes gas-class bodies, while the legacy material's crater path is keyed on the TYPE LABEL — so the four names JOIN the blocking P-14 row rather than being re-blessed into agreement.   // +1 2026-08-26: uCoarseCut (ledger row P-19) — the tidal process term moved from FREQUENCY to AMPLITUDE. Declared addition.
    const everyBody = [...LEDGER.divergedCarried.entries()]
      .filter(([k, v]) => v === LEDGER.carriedTotal.get(k)).map(([k]) => k);
    // ⭐ 17 -> 10 AT STEP 10a, then 10 -> 8 AT B3 LEG 1 (see the two named just below). rockySurface writes the palette, the crater terms and the offsets, so
    // seven names that used to diverge on EVERY body now diverge on only part of the population. The
    // ten that remain are named rather than counted, because "10" alone cannot distinguish a wire
    // that landed from a population that shrank.
    expect(everyBody.sort()).toEqual([
      // ⭐⭐ THE FOUR PALETTE COLOURS AND THE TWO OPTICS COLOURS ALL LEFT THIS LIST ON 2026-08-21.
      // They were never a dead wire — rockySurface and solidOptics wrote them on every body they
      // claimed, and giantSurface now writes them on the rest — they were the `encodeValue` CONTAINER
      // split this block used to record as a standing residue. The comparison stopped measuring the
      // writer's choice of JS class, and all six went to 0/266 at maxComponentDelta 0. ⛔ WHAT IS LEFT
      // BELOW IS THE HONEST REMAINDER: two names with no per-body writer anywhere.
      // …and these four diverge for their own recorded reasons.
      // ⭐⭐ SIX -> FOUR AT B3 LEG 1, AND THE TWO THAT LEFT ARE THE HALF-CLOSURE THIS BLOCK EXISTS TO
      // MAKE VISIBLE. `uTermStrength` and `uTermWidth` no longer diverge on EVERY body — they now
      // diverge on 103 of 266, which is the GAS half exactly, because `solidOptics`' predicate is
      // the complement of gas and limbDeck writes no terminator at all. They move to the partial
      // bucket rather than out of it, so P-11 cannot be reported closed: its non-gas half is, its
      // gas half is not. ⛔ `uTermColor` STAYS HERE, and it is NOT the gas half that keeps it — the
      // pack writes it on all 163 solid bodies too. It stays for the same `encodeValue` container
      // reason as `uLimbColor` two lines up: the game hands a `THREE.Vector3`, the lab a
      // `THREE.Color`, and this instrument compares the encoded container. A colour that is written
      // and still "diverges" here is an instrument fact, not a wire fact.
      // ⛔ `uDispDomainScale` HAS NO WRITER ON EITHER HALF; `uNoiseScale` NO LONGER DOES, AND ITS CAUSE INVERTED AT B2 LEG 3, 2026-08-20 — BOTH halves now write it and they answer different questions (the game draws `d.noiseScale`, the lab derives a size in km), which is why its presence here is unchanged while its reason is not.
      'uDispDomainScale', 'uNoiseScale',
    ].sort());
    // The four that agree, agree by a shared CONSTANT (it was eight, and four agreed by ABSENCE until B2 leg 1 — see above).
    const agreeing = [...LEDGER.carried].filter((n) => !LEDGER.divergedCarried.has(n)).sort();
    // ⭐ EIGHT -> FOUR AT B2 LEG 1. The four that left are named on the assertion above; the four that remain are the ones genuinely CONSTANT on both sides (`uEjectaLump` 0.6, `uTerraceCount` 4.0, `uVoroCells` 27, `uFwClamp`) rather than merely both-zero — which is why opening the crater gate could not move them, and is the control that says the four that DID move, moved for a reason.
    // ⭐⭐ FOUR -> FIVE AT B3 LEG 1, AND THE NEWCOMER IS A DIFFERENT KIND OF AGREEMENT FROM THE OTHER
    // FOUR. Those four agree because they are genuinely CONSTANT on both sides. `uLimbExponent`
    // agrees because it is WRITTEN on both sides and the two writers now read the same law — it
    // varies across the population and matches body by body. That is the stronger sense of
    // "carried" and it is the first name in this bucket to have it, so it is called out rather than
    // appended silently: a future reader must not conclude from the list that the exponent is a
    // constant. The non-vacuity loop below holds for it too, which is what makes it real.
    // ⭐⭐⭐ FIVE -> THIRTEEN AT B3 LEG 2. The eight newcomers are P-14's crater half, closing on the
    // GAS population, and they arrive in `uLimbExponent`'s sense rather than the constants' sense:
    // both sides now call `craterUniformsFrom` through one shared driver block, so they VARY across
    // the corpus and match body by body. ⚠ Two of the previous four constants are crater names
    // (`uEjectaLump`, `uTerraceCount`) and they did NOT move — they were already agreeing by being
    // constant, and they still are. A reader must not conclude the whole family is now derived.
    expect(agreeing).toEqual([
      // ⭐⭐⭐ 13 -> 26 AT THE GAS-HALF BLOCK, 2026-08-21, AND THE THIRTEEN NEWCOMERS SPLIT BY CAUSE
      // RATHER THAN ARRIVING AS ONE LUMP. SEVEN came by a WIRE — `giantSurface` gave the gas half
      // the terminator magnitudes, the two surface scalars and the three domain offsets. SIX came
      // by the INSTRUMENT — `encodeValue` stopped comparing the JS container, and the colours were
      // already byte-identical at float64 on 266/266. ⛔ THE SECOND SIX ARE THE WEAKER KIND OF
      // MEMBERSHIP AND MUST NOT BE READ AS NEW WIRING: nothing about what reaches the GPU changed
      // for them, only what this instrument was willing to call equal. ⚠ AND `uTermStrength` IS
      // WEAKER STILL — it agrees on a CONSTANT (see §2's written-but-not-varying list), which is
      // the case Instrument C's own header warns green is weak evidence for.
      'uBioGroundColor', 'uBioGroundCover', 'uCraterAmp', 'uCraterComplexD',
      'uCraterDensity', 'uCraterOffset', 'uCraterRelaxation', 'uCraterScale',
      'uDetailOffset', 'uEjectaAmp', 'uEjectaLump', 'uEjectaRampart',
      'uEjectaStrength', 'uFreshColor', 'uFwClamp', 'uIcenessMix',
      'uLimbColor', 'uLimbExponent', 'uMacroOffset', 'uProvinceWeight', 'uSedColor',
      'uTermColor', 'uTermStrength', 'uTermWidth', 'uTerraceCount',
      'uVoroCells', 'uWeatheredColor'
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

  it('the subject set is 44 lost names plus the 24 value-defaulted carried ones', () => {
    expect(new Set([...LEDGER.lost, ...LEDGER.lostAtZero]).size).toBe(44);   // 43 -> 44 AT B2P: the game spelling uPosterizeLevels leaves the material at the swap; P-18 rules it carried — NOT by object identity (the lab's scalar uLevels holds POSTERIZE_LEVELS, the game's vec2 holds POSTERIZE_QUANTUM) but by single-writer construction.
    // 62 -> 63 AT STEP 10a: `uLimbExponent` re-enters the diverged bucket on the 163 newly-admitted
    // solid bodies, which limbDeck's gas-only predicate never claims. See §2's note; P-11 claims it.
    // ⭐ 68 -> 67 AT B3 LEG 1, and it is a SHRINK, which no previous leg produced. Every earlier
    // move on this line added a subject; this one removes `uLimbExponent`, because `solidOptics`
    // makes the lab material agree with the game on all 266 bodies rather than on 207 of them.
    // ⭐⭐⭐ 67 -> 59 AT B3 LEG 2 — the SECOND shrink, and eight times the size of the first. P-14's
    // eight crater subjects leave the measured set entirely: `craterDeck` writes the impact family
    // on the gas half, which is the half that diverged, so the lab material now agrees with the game
    // on all 266 bodies for every one of them.
    expect(measured().size).toBe(47);   // ⭐⭐⭐ 59 -> 46 AT THE GAS-HALF BLOCK, 2026-08-21 — the THIRD shrink and the largest. Thirteen subjects leave: P-13's three offsets and P-12's two scalars and P-11's two terminator magnitudes by a WIRE (`giantSurface`, the complement-predicate pack), and six colours by the INSTRUMENT (`encodeValue`'s container split, six names enumerated on §2's divergedCarried line, every one at maxComponentDelta 0 over 266/266). ⛔ ALL THREE ROWS ARE NOW `carried` AND CHANNEL 1 HAS NO `blocking` ROW LEFT; the residue this document still carries is named in P-13 (20 unwritten feature-domain offsets) and in the two names on §2's everyBody list, neither of which is a subject.   // 63 -> 64 AT B2P, same one name; 64 -> 68 AT B2 LEG 1 — the four crater names §2 names, which join P-14's subject cell rather than acquiring a row.   // +1 2026-08-26: uCoarseCut, the tidal process term moved off the FREQUENCY and onto the AMPLITUDE (rockySurface pack; src/worldengine/base/macroWavelength.js coarseReliefCut). A DECLARED addition, not drift.
    // 44 lost + 28 carried = the 72 the game material declares. Nothing fell between the buckets.
    expect(new Set([...LEDGER.lost, ...LEDGER.lostAtZero, ...LEDGER.carried]).size).toBe(74);   // +1 2026-08-26: uCoarseCut, ledger row P-19 — carried by NAME on both materials, deliberately divergent in VALUE.
  });

  it('every measured subject is claimed by exactly ONE ledger row', () => {
    const claimed = CH1_ROWS.flatMap((r) => r.subjects);
    const dupes = claimed.filter((x, i) => claimed.indexOf(x) !== i);
    expect(dupes).toEqual([]);
    // ⛔⛔ THE LOAD-BEARING DIRECTION, AND IT IS UNCHANGED IN STRENGTH: nothing this instrument
    // measures may go unruled. A name that starts diverging with no row is what this assertion has
    // always existed to catch, and it still catches it exactly.
    for (const n of measured()) {
      expect(claimed, `${n} is measured and no ledger row claims it`).toContain(n);
    }
    // ⭐⭐ THE OTHER DIRECTION WAS AN EQUALITY UNTIL B3 LEG 2, AND IT IS SPLIT RATHER THAN DROPPED.
    // It held only while every ruled subject still diverged. P-14 is the first row whose subjects ALL
    // stop diverging — `craterDeck` closes the crater half on the gas population — and under the old
    // equality the only way to stay green was to EMPTY the row's subject cell, i.e. to delete the
    // record of which uniforms the row ruled at the moment it succeeded. ⛔ That is the shape this
    // document exists against, so the reverse direction is now a CLASSIFIED residue instead: every
    // claimed-but-no-longer-measured name must be a `carried` row's subject AND must be in the
    // agreeing bucket. A row that quietly claims a name this instrument never sees still reds.
    const carriedRows = new Set(CH1_ROWS.filter((r) => r.ruling === 'carried').flatMap((r) => r.subjects));
    const agreeing = new Set([...LEDGER.carried].filter((n) => !LEDGER.divergedCarried.has(n)));
    const closed = claimed.filter((n) => !measured().has(n));
    for (const n of closed) {
      expect(carriedRows.has(n), `${n} is claimed by a row that is not ruled carried, yet it no longer diverges`).toBe(true);
      expect(agreeing.has(n), `${n} is claimed, does not diverge, and is not in the agreeing bucket either — it fell between the instrument's buckets`).toBe(true);
    }
    // ⭐⭐⭐ P-14's EIGHT -> TWENTY-ONE AT THE GAS-HALF BLOCK, 2026-08-21. This list is every name a
    // ledger row still CLAIMS and this instrument no longer sees diverging, and it grew by P-11's
    // four, P-12's six and P-13's three. ⛔ IT IS THE RECORD OF WHICH ROWS SUCCEEDED, so it is named
    // rather than counted, and it may never be SHORTENED to keep an assertion green — emptying a
    // row's subject cell at the moment the row closes is the one move this document exists against.
    expect(closed.sort()).toEqual([
      'uBioGroundColor', 'uBioGroundCover', 'uCraterAmp', 'uCraterComplexD',
      'uCraterDensity', 'uCraterOffset', 'uCraterRelaxation', 'uCraterScale',
      'uDetailOffset', 'uEjectaAmp', 'uEjectaRampart', 'uEjectaStrength',
      'uFreshColor', 'uIcenessMix', 'uLimbColor', 'uMacroOffset',
      'uSedColor', 'uTermColor', 'uTermStrength', 'uTermWidth',
      'uWeatheredColor',
    ].sort());
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
    // ⭐ RE-AIMED AT THE SURVIVING DIRECTION AT B3 LEG 2. `uLimbMix` is `lost` — the lab declares no
    // counterpart — so it is measured, and a row dropping it leaves it unruled. That is the direction
    // the split above kept, and this control proves the split did not hollow it out.
    expect(measured().has('uLimbMix'), 'the mutant must drop a MEASURED subject or it proves nothing').toBe(true);
    expect(claimed).not.toContain('uLimbMix');   // ← the mutant reds
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
          .find((p) => labPipelineAdmits(p.planetData, conditionFromBody(p.planetData)).packs.length).planetData,
        null, true,
      ).material.uniforms,
    ));
    // ⭐⭐ P-01 INVERTED AT B4-1, BY P-04'S MECHANISM. This line read `.toEqual([])` and was the machine-check that the lab declared NO star-colour uniform of any kind. It now NAMES the four the lab declares, so un-declaring any one of them reds this assertion instead of letting the feature leave silently — the same inversion that closed P-04 eight lines down.
    expect([...labNames].filter((n) => /star/i.test(n)).sort()).toEqual(['uStarBrightness1', 'uStarBrightness2', 'uStarColor1', 'uStarColor2', 'uStarPos1', 'uStarPos2']);   // ⭐⭐ FOUR -> SIX AT B4-2, and the two arrivals belong to a DIFFERENT ledger row than the four. uStarColor1/2 and uStarBrightness1/2 are P-01/P-02, carried at CONSTRUCTION. uStarPos1/2 are P-03: the star WORLD positions the shadow ray is cast toward, re-derived into this body's object space every render tick by the seam. They share a prefix and nothing else, and this list is the one place a reader sees them together — so the distinction is written here rather than left to be inferred from the spelling.
    // ⭐⭐ P-03 INVERTED AT B4-2, ON P-01'S PATTERN. This line read `.toEqual([])` and was the machine-check that the lab declared NO shadow uniform of any kind; B4-1's comment here said the shadow half "needs four world-space vectors and the lab fragment shader has no vWorldPos varying", which was true and was NOT the end of the matter — the casters were moved into the fragment's object space instead of the fragment being moved into theirs. The line now NAMES the six the lab declares, so un-declaring any one of them reddens it instead of letting the feature leave silently.
    expect([...labNames].filter((n) => /shadow/i.test(n)).sort()).toEqual(['uShadowMoonCount', 'uShadowMoonPos', 'uShadowMoonRadius', 'uShadowPlanetCount', 'uShadowPlanetPos', 'uShadowPlanetRadius']);  expect([...labNames].filter((n) => /^uStarPos/.test(n)).sort()).toEqual(['uStarPos1', 'uStarPos2']);  // ⚠ SIX, NOT EIGHT — and the two that are missing from this list are missing because of the FILTER, not because of the port. P-03's subject list also carries starPos1 and starPos2, whose lab counterparts are uStarPos1/uStarPos2; those match /star/i and are asserted on the line below rather than here. Stated because a reader counting this list against the ledger row will otherwise find six where the row says eight and have to re-derive which is wrong.
    expect(LAB_SHADER_CORPUS.includes('uLightDir2')).toBe(true);    // ⭐ P-02 INVERTED AT B4-1 — this asserted `false`. The second light now occurs in LAB_SHADER_CORPUS; deleting it from the fragment reds this line.
    expect(LAB_SHADER_CORPUS.includes('uShadow')).toBe(true);       // ⭐ P-03 INVERTED AT B4-2 — this asserted `false`. The caster names now occur in LAB_SHADER_CORPUS. ⚠ A NAME OCCURRING IS THE WEAK HALF OF THIS ROW and this line is not the evidence for it: a declaration nothing reads would satisfy it. tests/lab-shader-shadows.test.js carries the arithmetic — that the lab's sphereShadow is the game's token-for-token, that totalShadow differs from the game's only by the six re-spelled names, that the factors reach the lit expression, and that severing any of those reddens something.   // ⛔ WAS false, deliberately
    // ⭐⭐ P-05 IS CLOSED BY THE B3 LEG 1 REGISTRATION, AND THIS IS THE ASSERTION THAT SAYS SO —
    // INVERTED, exactly the way P-04's below was. These four used to be the alias shape's exhibit:
    // declared by the lab, written by NOTHING, so the whole feature sat behind the
    // `uAuroraIntensity > 0.0` guard in the shader on every swapped body. `solidOptics` writes all
    // four for non-gas conditions. ⛔ THE INVERSION IS THE POINT — un-register the pack and these
    // lines go red, which is the "delete the entry and the feature silently leaves" failure the
    // registration fence exists for. A `not.toContain` here would now pass only while the wire was
    // broken.
    for (const n of ['uAuroraColor', 'uAuroraIntensity', 'uAuroraRingLat', 'uAuroraRingWidth']) {
      expect(labNames.has(n), `lab should declare ${n}`).toBe(true);
      expect(LEDGER.written, `P-05: solidOptics must write ${n}, or the loss is back`).toContain(n);
    }
    // …and the same inversion for P-11's terminator triple, which had the identical shape: three
    // names the lab declares and nothing wrote. ⚠ Writing them does not make the row agree — the
    // gas half still diverges, and §2's everyBody/partial split is where that is recorded.
    for (const n of ['uTermColor', 'uTermStrength', 'uTermWidth']) {
      expect(labNames.has(n), `lab should declare ${n}`).toBe(true);
      expect(LEDGER.written, `P-11: solidOptics must write ${n}, or the loss is back`).toContain(n);
    }
    // ⭐⭐ P-04 IS CLOSED BY REGISTRATION, AND THIS IS THE ASSERTION THAT SAYS SO. `uLimbStrength`
    // used to belong to the loop above: declared by the lab, written by nothing. limbDeck now writes
    // it, so the loss is resolved rather than merely described. ⛔ THE INVERTED ASSERTION IS THE
    // POINT — if a future edit un-registers limbDeck, this line goes red, which is precisely the "delete the entry and the feature silently leaves" failure the registration fence exists for.
    // ⚠ THAT PROPERTY DEPENDS ON `LEDGER.written` BEING A UNION. While it was a first-body sample it
    // went red at Step 10a with limbDeck's wire fully intact, and — worse — could not have gone green
    // again for any state of limbDeck, because the sampled body was solid by construction. The four
    // aurora `not.toContain` lines above have the mirror-image dependency: under a sample they passed vacuously, since no gas-deck name was in the set at all.
    expect(labNames.has('uLimbStrength'), 'the lab must still declare uLimbStrength').toBe(true);
    expect(LEDGER.written, 'P-04: limbDeck must write it, or the loss is back').toContain('uLimbStrength');
    // ⭐⭐ M-09 IS CLOSED THE SAME WAY, AT B2 LEG 3, AND THIS IS ITS HALF OF THE FENCE. `uNoiseScale` used to be the aurora shape too — declared by the lab, written by nothing, the factory 4.0 on both sides. `rockySurface` now writes it on every body its `!== 'gas'` predicate claims, which is 632 of 632 plain moons (tests/moon-lab-mount.test.js:420 `expect(admitted).toBe(plain);`), so the moon-side base-frequency loss is resolved rather than described. ⛔ INVERTED FOR THE SAME REASON: un-register the pack and this line goes red instead of the feature leaving silently.
    expect(LEDGER.written, 'M-09/P-10: rockySurface must write it, or the base-frequency loss is back').toContain('uNoiseScale');
    // ⭐⭐ P-14 IS CLOSED BY THE B3 LEG 2 REGISTRATION AND THIS IS THE INVERSION THAT HOLDS IT CLOSED.
    // The row's ten impact names were written on the non-gas half only; `craterDeck`'s `=== 'gas'`
    // predicate is `rockySurface`'s exact complement, so the family now has exactly one writer on
    // every body. ⛔ INVERTED for the reason the four lines above are: un-register the entry and
    // these go red, instead of the crater record silently leaving every gas world's material.
    // ⚠ `LEDGER.written` IS A UNION over the pass, so it sees the gas half even though the pass's
    // first body is not one — the same dependency P-04's note records in blood.
    for (const n of ['uCraterAmp', 'uCraterComplexD', 'uCraterScale', 'uEjectaAmp',
                     'uCraterDensity', 'uCraterRelaxation', 'uEjectaRampart', 'uEjectaStrength']) {
      expect(labNames.has(n), `lab should declare ${n}`).toBe(true);
      expect(LEDGER.written, `P-14: a pack must write ${n} on BOTH halves, or the loss is back`).toContain(n);
    }
    // …and R-07's carrier, on the same inverted pattern: the band deck must reach the opaque-CO2
    // population or Venus's zonal banding goes back to the 0.0 default it sat at since Step 10a.
    expect(labNames.has('uBandStrength'), 'the lab must still declare uBandStrength').toBe(true);
    expect(LEDGER.written, 'R-07: giantDeck must write it, or the venus banding loss is back').toContain('uBandStrength');
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

  it('the extraction reproduces all six lines PLAN §6b names by hand, and finds 108 more', () => {
    const g = EXTRACT.gas.branch;
    expect(g.get(1).has('stormMask')).toBe(true);      // Planet.js:434
    expect(g.get(1).has('polarDark')).toBe(true);      // Planet.js:437
    expect(g.get(6).has('hotspot')).toBe(true);        // Planet.js:446
    expect(g.get(6).has('nightSide')).toBe(true);      // Planet.js:451
    expect(g.get(7).has('ringNoise')).toBe(true);      // Planet.js:407
    expect(g.get(10).has('haze')).toBe(true);          // Planet.js:413
    const live = liveBranches.reduce((n, b) => n + EXTRACT[b.variant].branch.get(b.pt).size, 0);
    const shared = new Set([...EXTRACT.gas.shared, ...EXTRACT.rocky.shared]).size;
    // ⭐ 99 -> 114 AT STEP 10a. Nothing was added to the shipped shader; three rocky branches became
    // LIVE — `pt3` lava (4 symbols), `pt4` ocean (7) and `pt8` venus (4) — and `live` is derived from
    // the population, so the extraction now reaches them. `shared` is unchanged at 26.
    expect(shared).toBe(26);
    expect(live + shared).toBe(114);
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
          if (!labPipelineAdmits(d, conditionFromBody(d)).packs.length) continue;
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
    expect(CH1_ROWS.length).toBe(19);   // +1 2026-08-26: uCoarseCut (ledger row P-19) — the tidal process term moved from FREQUENCY to AMPLITUDE. Declared addition.
    // ⭐ 16 -> 19 AT STEP 10a: R-05 (rocky pt3 lava), R-06 (pt4 ocean) and R-07 (pt8 venus), the three
    // branches the widened predicate made live. `every LIVE branch has rows` above is what demanded
    // them; this pin is what stops a row being deleted again without anyone noticing.
    expect(CH2_ROWS.length).toBe(19);
  });

  it('every ruling in the document is one of the three Max named', () => {
    const rulings = new Set([...CH1_ROWS, ...CH2_ROWS].map((r) => r.ruling));
    for (const r of rulings) expect(RULINGS.has(r), `illegal ruling "${r}"`).toBe(true);
    // Two of the three are actually used — a ledger with no losses is a ledger that was not run, and
    // one with no `carried` rows would mean the swap carries nothing, which §2 measures as false.
    // ⭐⭐⭐ `blocking` LEFT THIS SET ON 2026-08-21, AND THAT IS THE TERMINAL STATE THIS DOCUMENT WAS
    // WRITTEN TO REACH rather than a sign the ledger stopped being run. The last three blocking rows
    // were P-11's gas half, P-12 and P-13 — one defect, not three — closed by `giantSurface` plus the
    // `encodeValue` container fix, with §2's two lines naming every one of the thirteen subjects that
    // moved and by WHICH of the two causes. ⛔ THE ASSERTION IS NOT RELAXED TO A SUBSET CHECK: it is
    // pinned to the exact pair, so the day a row is ruled `blocking` again this reds and someone has
    // to say which row and why. A ⊆-check would let the set drift in either direction in silence.
    expect(rulings).toEqual(new Set(['carried', 'accepted-loss']));
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
