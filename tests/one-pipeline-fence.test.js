// tests/one-pipeline-fence.test.js — PLAN §4 Step 11, "the standing 'cheaper next time' fence".
//
// ⛔ THE GATE, IN THE PLAN'S OWN WORDS: *"A pass with no failing control is worthless."* Every
// registration below is paired with a DELIBERATELY-BROKEN CONTROL FIXTURE committed under
// tests/fixtures/broken-control-pack/, and the control asserts the fence goes red **by name, with
// the offending path in the message**. A registration whose control has never been executed is not
// a fence; it is a comment that runs.
//
// ⭐ WHY THE CONTROLS SCAN A FIXTURE TREE AND NOT src/. A control cannot leave a broken module under
// `src/worldengine/` — that ships. So every scanner here takes its subject as an ARGUMENT and the
// control re-enters through EXACTLY the same function the real assertion calls. A control that
// passes is therefore evidence about the shipped scanner, not about a parallel copy of it. This is
// the idiom tests/lab-surface-ratchet.test.js:233 `const LAB_SRC = process.env.WD_LAB_SURFACE_SRC` already uses for the same reason.
//
// ⚠ FIVE REGISTRATIONS PLUS THE STEP-5 RATCHET AS A SIXTH — but TWO of the six already ship, with
// their own executed controls, and are NOT re-authored here:
//   · Registration 1 (boundary) is tests/src-boundary-fence.test.js:213 `CONTROL: the scan is non-vacuous`.
//   · Registration 6 (shrink-only ratchet) is tests/lab-surface-ratchet.test.js, CONTROLS A–N.
// Copying either into this file would create a second expression of a law free to drift from the
// one under test — which is the exact hazard registration 3 exists to ban. Instead the ROLL-CALL at
// the bottom asserts both files still exist AND still carry a live control, so deleting one reds
// here rather than silently reducing the fence from six registrations to four.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { stripCommentsPreservingOffsets, jsFilesUnder, lineOf } from './helpers/source-scan.mjs';
import { PACKS } from '../src/worldengine/drivers/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = 'tests/fixtures/broken-control-pack';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// REGISTRATION 5 — no `SeededRandom` under `src/worldengine/`.
//
// ⭐ WHY THIS IS THE ONLY MECHANICAL GUARD AGAINST THE WHOLE HAZARD CLASS, stated with the measured
// reason rather than as a taste rule: `conditionFromBody` runs INSIDE the rng-consuming region of
// `PlanetGenerator.generate` — called at :726, while `noiseDetail: rng.range(0.3, 0.8)` is drawn at
// :780. A worldengine module that imported, accepted or even referenced the seeded stream could
// advance it, and every draw AFTER that point shifts. The failure surfaces as unrelated bodies
// changing, with nothing red, which is why a grep is worth more here than its cost.
//
// "IMPORT, ACCEPT OR REFERENCE" is three distinct spellings and the scan must see all three: an
// `import { SeededRandom }`, a parameter named for it, and a bare textual mention in live code.
// Comments are stripped first — the prose in these files discusses the hazard constantly, and a
// scanner that counted prose would be red on day one and get deleted.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const SEEDED_RANDOM_RE = /\bSeededRandom\b/g;

/**
 * @param {string} rel repo-relative directory to scan
 * @returns {{path: string, line: number, text: string}[]} one entry per live-code reference
 */
export function seededRandomViolations(rel) {
  const out = [];
  for (const path of jsFilesUnder(ROOT, rel)) {
    const raw = readFileSync(join(ROOT, path), 'utf8');
    // ⛔ COMMENTS STRIPPED, STRING LITERALS KEPT. Prose in this tree discusses the hazard by name
    // constantly, so counting comments would red the fence on day one and get it deleted. Literals
    // are KEPT because `require('SeededRandom')` and a dynamic `import('.../SeededRandom.js')` are
    // both string-shaped, and both are real ways to reach it.
    const code = stripCommentsPreservingOffsets(raw);
    for (const m of code.matchAll(SEEDED_RANDOM_RE)) {
      out.push({ path, line: lineOf(code, m.index), text: raw.split('\n')[lineOf(code, m.index) - 1].trim() });
    }
  }
  return out;
}

/** The message the fence dies with. The offending PATH is the load-bearing part. */
function seededRandomMessage(violations) {
  return (
    `one-pipeline-fence registration 5: \`SeededRandom\` is referenced in live code under the ` +
    `worldengine tree. It must not be imported, accepted or referenced there — see the header. ` +
    `Offending sites:\n` +
    violations.map((v) => `  · ${v.path}:${v.line} — ${v.text}`).join('\n')
  );
}

describe('registration 5 — no SeededRandom under src/worldengine/', () => {
  it('the worldengine tree holds ZERO live references', () => {
    const violations = seededRandomViolations('src/worldengine');
    expect(violations, violations.length ? seededRandomMessage(violations) : undefined).toEqual([]);
  });

  it('CONTROL: the scan is non-vacuous — it DOES see a reference where one really lives', () => {
    // src/generation/ is where SeededRandom is defined and used. A scanner that found nothing here
    // would be finding nothing anywhere, and the assertion above would be a green that means zero.
    const seen = seededRandomViolations('src/generation');
    expect(seen.length).toBeGreaterThan(0);
  });

  it('CONTROL: the broken fixture makes it fail BY NAME, with the offending path in the message', () => {
    const violations = seededRandomViolations(`${FIXTURES}/seeded-random`);
    expect(violations.length).toBeGreaterThan(0);
    const msg = seededRandomMessage(violations);
    expect(msg).toContain(`${FIXTURES}/seeded-random/tainted.js`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// REGISTRATION 4 — every module under `src/worldengine/drivers/` appears in the runtime `PACKS`.
//
// ⭐ THE ONE REGISTRATION WITH A VISUAL CONTROL, and it is the whole fence's: delete `giantDeck`'s
// entry from `PACKS` and the same generated gas giant loses its bands; restore it and they return.
// Registrations 1, 2, 3 and 5 have no pixel subject and none is manufactured for them.
//
// ⚠ REGISTRATION 2 CATCHES AN ORPHAN MODULE — one nothing imports. THIS catches the strictly harder
// case: a module that IS imported, by the composition point itself, and then never applied. Nothing
// throws in that state. The pack's own suite passes, because a pack suite calls the pack directly.
// The game renders, because `applyDriverPacks` iterates `PACKS` and never reaches the entry. The
// only symptom is a feature that does not appear.
//
// ⛔ THE LINK IS THE FILENAME ↔ `name` CONVENTION, said out loud rather than left implicit, because
// it is the fence's one assumption: `giantDeck.js` ↔ `name: 'giantDeck'`. Measured at authoring —
// eight files, eight entries, 1:1. The convention is not decoration; it IS what makes an
// unregistered module detectable, so BOTH directions are asserted. A file with no entry is the
// hazard above; an entry with no file is a hand-written copy of a pack in `index.js`, which is the
// drift registration 3 bans in the other tree.
//
// `index.js` is excluded as the composition point itself — it is not a pack.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const DRIVERS_DIR = 'src/worldengine/drivers';

/**
 * @param {string} rel repo-relative drivers directory
 * @param {string[]} packNames the runtime `PACKS` names
 * @returns {{path: string, module: string}[]} one entry per module with no registration
 */
export function unregisteredDrivers(rel, packNames) {
  const registered = new Set(packNames);
  const out = [];
  for (const ent of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.js')) continue;
    if (ent.name === 'index.js') continue;           // the composition point, not a pack
    const module = ent.name.replace(/\.js$/, '');
    if (!registered.has(module)) out.push({ path: `${rel}/${ent.name}`, module });
  }
  return out.sort((a, b) => a.module.localeCompare(b.module));
}

function unregisteredMessage(violations) {
  return (
    `one-pipeline-fence registration 4: a module under \`${DRIVERS_DIR}/\` is NOT in the runtime ` +
    `\`PACKS\` array, so it can never be applied and nothing will throw. Add its entry to ` +
    `src/worldengine/drivers/index.js, or delete the module. Offending modules:\n` +
    violations.map((v) => `  · ${v.path} (expected a PACKS entry named '${v.module}')`).join('\n')
  );
}

describe('registration 4 — every drivers module is in the runtime PACKS array', () => {
  const packNames = PACKS.map((p) => p.name);

  it('ZERO drivers modules are unregistered', () => {
    const violations = unregisteredDrivers(DRIVERS_DIR, packNames);
    expect(violations, violations.length ? unregisteredMessage(violations) : undefined).toEqual([]);
  });

  it('the reverse also holds — every PACKS entry has a module file behind it', () => {
    // An entry with no file is a pack hand-written into the composition point, free to drift from
    // the gated one. Same law, other direction.
    const orphanEntries = packNames.filter((n) => !existsSync(join(ROOT, DRIVERS_DIR, `${n}.js`)));
    expect(orphanEntries).toEqual([]);
  });

  it('CONTROL: the scan is non-vacuous — it reads the REAL drivers tree, all ten of them', () => {
    // Pass an EMPTY registration list against the real tree: every module must then be reported.
    // This proves the walker sees the subject, which the green above cannot.
    const allUnregistered = unregisteredDrivers(DRIVERS_DIR, []);
    expect(allUnregistered.map((v) => v.module).sort()).toEqual(
      ['craterDeck', 'fluvialDeck', 'giantDeck', 'giantSurface', 'limbDeck', 'polarDeck', 'rockySurface', 'solidFeatures', 'solidOptics', 'stormDeck'],   // ⭐ TEN SINCE 2026-09-03 — `stormDeck` (F27/F28, pack #10) joined the tree and the registry in the same commit (workstream wire-storm-slice-lab-into-game).   // ⭐ NINE SINCE 2026-09-02 — `fluvialDeck` joined the tree. This answer GROWS as packs are added, which is the property that keeps the control from going vacuous.
    );
  });

  it('CONTROL: the broken fixture makes it fail BY NAME, with the offending path in the message', () => {
    const violations = unregisteredDrivers(`${FIXTURES}/unregistered-driver`, packNames);
    expect(violations.length).toBeGreaterThan(0);
    expect(unregisteredMessage(violations)).toContain(`${FIXTURES}/unregistered-driver/ghostDeck.js`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// REGISTRATION 3 — no surviving lab copy.
//
// ⭐ THE PRECEDENT IS NAMED IN THE PLAN AND IT IS NOT HYPOTHETICAL: `craterRelief.glsl.js` kept BOTH
// implementations, "and that copy is now a law that quietly disagrees". A law with two declarations
// has no single home, so nothing tells you which one the pixels came from. The fence's subject is
// therefore an EXPORTED worldengine symbol that the lab RE-DECLARES at module top level instead of
// importing back.
//
// ⚠ TWO ANCHORS DO THE DISCRIMINATING, and both were arrived at by MEASUREMENT, not by taste:
//   · engine side — `export`ed names only. Scanning every definition instead finds 65 collisions,
//     all of them local variables (`h`, `g`, `out`, `seed`) that share a name by coincidence. An
//     exported name is a law with a home; a local is not.
//   · lab side — declarations at EXACTLY four spaces, the real lab's module-body indent (its one
//     module script opens at world-engine-lab.html:148 `<script type="module">`). A deeper indent is a local inside
//     a function, and counting those would make every shadowed variable read as a surviving copy.
// With both anchors the real corpus yields 608 exported names against 267 lab top-level ones and
// EXACTLY ONE collision — the allowlisted entry below.
//
// ⛔ THE ALLOWLIST CARRIES WHAT REMOVES IT, and "TBD" is not an admissible value — the same
// discipline tests/src-boundary-fence.test.js states for its own single entry. It also carries a
// VALUE PIN, which is the stronger half: an allowlisted duplicate is only tolerable while the two
// declarations AGREE, so the drift the fence exists to catch is caught even on the entry that is
// permitted to exist.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const LAB_HTML = 'world-engine-lab.html';

const SURVIVING_COPY_ALLOWLIST = Object.freeze([
  Object.freeze({
    name: 'C_CRATER',
    // src/worldengine/drivers/craterDeck.js:78 `export const C_CRATER = 1.0;` declares itself "a forward of the lab's own
    // declaration", citing world-engine-lab.html:821 `const C_CRATER = 1.0;` by line. So this duplicate is DELIBERATE and
    // documented at both ends — which is what makes it allowlistable, and is also exactly why it
    // needs the value pin: a forward that stops agreeing is worse than no forward.
    clears:
      "registration 2's import-back applied to the calibration constants — the lab imports " +
      'C_CRATER from src/worldengine/drivers/craterDeck.js instead of declaring its own. Not done ' +
      'in this step because world-engine-lab.html is edited concurrently by other lanes and the ' +
      'Step-5 ratchet watches that file.',
    // Both declarations must resolve to this. If either moves, the pin reds by name.
    pinnedValue: '1.0',
  }),
]);

/** Exported symbol → defining path, over a worldengine-shaped tree. */
export function exportedEngineSymbols(rel) {
  const EXPORTED = /(?:^|\n)export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g;
  const out = new Map();
  for (const path of jsFilesUnder(ROOT, rel)) {
    const code = stripCommentsPreservingOffsets(readFileSync(join(ROOT, path), 'utf8'));
    for (const m of code.matchAll(EXPORTED)) if (!out.has(m[1])) out.set(m[1], path);
  }
  return out;
}

/** Top-level (four-space) declaration name → line, over a lab-shaped HTML file. */
export function labTopLevelDecls(rel) {
  const code = stripCommentsPreservingOffsets(readFileSync(join(ROOT, rel), 'utf8'));
  const TOPLEVEL = /\n {4}(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g;
  const out = new Map();
  for (const m of code.matchAll(TOPLEVEL)) if (!out.has(m[1])) out.set(m[1], lineOf(code, m.index + 1));
  return out;
}

export function survivingCopies(engineRel, labRel, allowlist = SURVIVING_COPY_ALLOWLIST) {
  const permitted = new Set(allowlist.map((e) => e.name));
  const engine = exportedEngineSymbols(engineRel);
  const lab = labTopLevelDecls(labRel);
  const out = [];
  for (const [name, enginePath] of engine) {
    if (permitted.has(name) || !lab.has(name)) continue;
    out.push({ name, enginePath, labPath: labRel, labLine: lab.get(name) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function survivingCopyMessage(violations) {
  return (
    `one-pipeline-fence registration 3: a law exported from the worldengine tree is ALSO declared ` +
    `at top level in the lab. Two declarations, no single home — the craterRelief.glsl.js ` +
    `precedent. Import it back, or allowlist it with what clears it AND a value pin. Offending:\n` +
    violations.map((v) => `  · ${v.name} — ${v.enginePath} vs ${v.labPath}:${v.labLine}`).join('\n')
  );
}

describe('registration 3 — no surviving lab copy', () => {
  it('ZERO un-allowlisted laws are declared in both trees', () => {
    const violations = survivingCopies('src/worldengine', LAB_HTML);
    expect(violations, violations.length ? survivingCopyMessage(violations) : undefined).toEqual([]);
  });

  it('CONTROL: the lab scan is non-vacuous — it still matches a known-present declaration', () => {
    // The plan's own non-vacuity requirement, verbatim: "proven non-vacuous by asserting it still
    // matches a known-present string". `C_CRATER` is that string, and it is also the allowlisted
    // entry — so this control ALSO proves the allowlist is live rather than vestigial.
    const decls = labTopLevelDecls(LAB_HTML);
    expect(decls.has('C_CRATER')).toBe(true);
    expect(decls.size).toBeGreaterThan(200);
  });

  it('every allowlist entry names what clears it, and "TBD" is not admissible', () => {
    for (const e of SURVIVING_COPY_ALLOWLIST) {
      expect(e.clears, `allowlist entry '${e.name}' must name what removes it`).toBeTruthy();
      expect(e.clears.trim().toUpperCase()).not.toBe('TBD');
      expect(e.clears.length).toBeGreaterThan(20);
    }
  });

  it('an allowlisted duplicate is pinned at BOTH ends — it is tolerable only while it agrees', () => {
    // The load-bearing half of the allowlist. A forward that stops agreeing is worse than no
    // forward, because both sides still look documented.
    const labSrc = readFileSync(join(ROOT, LAB_HTML), 'utf8');
    const engineFiles = jsFilesUnder(ROOT, 'src/worldengine');
    for (const e of SURVIVING_COPY_ALLOWLIST) {
      const decl = new RegExp(`\\b(?:const|let)\\s+${e.name}\\s*=\\s*([^;,]+)`);
      const labHit = labSrc.match(decl);
      expect(labHit, `${e.name} is allowlisted but no longer declared in ${LAB_HTML}`).toBeTruthy();
      expect(labHit[1].trim()).toBe(e.pinnedValue);
      const engineHit = engineFiles
        .map((f) => readFileSync(join(ROOT, f), 'utf8').match(new RegExp(`export\\s+const\\s+${e.name}\\s*=\\s*([^;,]+)`)))
        .find(Boolean);
      expect(engineHit, `${e.name} is allowlisted but no longer exported from the engine tree`).toBeTruthy();
      expect(engineHit[1].trim()).toBe(e.pinnedValue);
    }
  });

  it('CONTROL: the broken fixture makes it fail BY NAME, with the offending path in the message', () => {
    const violations = survivingCopies(
      `${FIXTURES}/surviving-copy/engine`,
      `${FIXTURES}/surviving-copy/lab-copy.html`,
      [],
    );
    expect(violations.length).toBeGreaterThan(0);
    const msg = survivingCopyMessage(violations);
    expect(msg).toContain('DUPLICATED_LAW');
    expect(msg).toContain(`${FIXTURES}/surviving-copy/engine/dupLaw.js`);
  });

  it('CONTROL: a DEEPER-indented local of the same name is NOT a surviving copy', () => {
    // lab-copy.html shadows DUPLICATED_LAW inside `usesIt()` at six spaces. Exactly one violation
    // must be reported, not two — otherwise the fence would red on every shadowed variable.
    const violations = survivingCopies(
      `${FIXTURES}/surviving-copy/engine`,
      `${FIXTURES}/surviving-copy/lab-copy.html`,
      [],
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].labLine).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// REGISTRATION 2 — import-back, GENERALISED BEYOND `drivers/`.
//
// Every pipeline module the GAME imports is also imported by `world-engine-lab.html`. ⭐ Scoping this
// to packs would never have seen `atmosphereOptics.js`, which is not a pack and is the failure that
// HAS ALREADY OCCURRED. The subject is therefore the two IMPORT CLOSURES, not a directory.
//
// ⛔⛔ THIS REGISTRATION IS RED-ON-ARRIVAL AND THAT IS THE POINT — 14 modules measured at authoring
// sit in the game's closure and not the lab's. It is not this step's job to fix them (that means
// editing world-engine-lab.html, which other lanes edit concurrently, and converting the lab's inline
// uniform writes to pack calls). It IS this step's job to make the number COUNTED, NAMED, and unable
// to GROW. So the divergence ships as a shrink-only debt ledger, and a 15th entry reds.
//
// ⭐ THE SHARPEST ROW, and the evidence is the module's OWN HEADER, not this fence's reading:
// src/worldengine/base/terminatorOptics.js:2 `ONE function object answers for both front-ends`
// says exactly that — and the lab does not import it. A module whose stated purpose is
// unmet, with nothing red. That is the whole registration in one file.
//
// ⚠ THE PRECEDENT THAT PROVES THE DISCIPLINE EXISTED AND WAS DROPPED: world-engine-lab.html:188 `giantDeckPack`
// imports it back, with a comment reading "now live in ONE module the GAME imports
// too" (PLAN §4 Step 5c, driver pack #1). Seven packs have been added since; NONE of them was
// imported back. The fence exists because that is invisible otherwise.
//
// TWO TIERS, and the split is what keeps the ledger honest:
//   · GAME_ONLY_BY_DESIGN — modules that must NEVER be in the lab's closure. Each names a reason AND
//     an in-source `evidence` phrase, and the phrase is ASSERTED to still be present. An exemption
//     whose justification has been edited away is deleted, not inherited.
//   · IMPORT_BACK_DEBT — real divergences. Each names what clears it. SHRINK-ONLY: the ceiling below
//     may be lowered, never raised, and an entry that is no longer divergent must be REMOVED (the
//     liveness test reds on a stale one, so the ledger cannot quietly accumulate fiction).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const GAME_ONLY_BY_DESIGN = Object.freeze([
  Object.freeze({
    path: 'src/worldengine/port/conditionFromBody.js',
    reason:
      'The game-side adapter itself. It converts PlanetGenerator output into a condition vector; ' +
      'the lab has no PlanetGenerator output to convert, it authors conditions from its own state. ' +
      'Importing it into the lab would give the lab a seam it has no data for.',
    evidence: 'the GAME-SIDE adapter into the world engine',
  }),
]);

// ⛔ SHRINK-ONLY. Lower it when an entry clears; NEVER raise it. Raising it is how a fence becomes a
// changelog. Measured 13 at authoring (2026-08-21), the 14 diverging modules minus the one exemption.
// ⭐ 13 -> 11 -> 10 ON 2026-08-22: `port/craterUniforms.js` and `base/terminatorOptics.js` CLEARED — the lab
// imports both now (world-engine-lab.html:178) as part of Max's converge-the-laws ruling. THE LEDGER'S
// FIRST SHRINK, and the liveness test is what forced it: the rows went stale the moment the imports
// landed and this file refused to stay green on fiction.
// world-engine-lab.html:178 `import { terminatorOpticsOf }` and world-engine-lab.html:2831 `craterUniformsFrom`. ⭐ THE SECOND SHRINK, SAME DAY: `drivers/solidFeatures.js` cleared too — the lab imports pack #2 at world-engine-lab.html:188 `solidFeaturesPack` and calls it at :2074, which is workstream AC5 and Max's ADOPT ruling on the radius-aware gravity. ⭐⭐ AND A THIRD, 10 -> 9, SAME DAY: `drivers/giantSurface.js` cleared too — the lab imports pack #8 at world-engine-lab.html:188 `giantSurfacePack` and calls it at :2465, gas-gated. ⛔⛔ AND A FOURTH, 9 -> 8, WHICH NOBODY CHOSE — AND WHICH HAS SINCE BEEN REVERSED. `drivers/solidOptics.js` cleared TRANSITIVELY on 2026-08-22: the lab never called it, no ruling was made, and it entered the lab's closure only because `giantSurface.js` imports `TERMINATOR_GATE` from it so the gate NAME has one home. The row was deleted because the criterion of the day — import closure, reachability not exercise — was genuinely met, and the call-side work went untracked with nothing red. ⭐ 2026-08-25 FIXED THE CRITERION RATHER THAN THE ROW: the criterion is now reachable-AND-CALLED, which is what every row's own `clears` text has always said, so solidOptics is a debt row again and its remaining work — one MEASUREMENT on the _giantDynamo branch, not a decision — is written into that row. ⭐ THE CEILING NEVER MOVED. `drivers/polarDeck.js` cleared on its own merits in the SAME commit — the lab imports it at world-engine-lab.html:188 `polarDeckPack` and calls it at :1916, passing its own `stormSeed` per Max's 2026-08-22 ruling that the slider is a lab authoring knob — so the ledger stayed at 8 and no correction had to buy itself a raise. THREE packs remain on the roster.
// world-engine-lab.html:178 `import { terminatorOpticsOf }` and world-engine-lab.html:2831 `craterUniformsFrom`.
// ⭐⭐ 6 -> 3 ON 2026-08-25 — THE CRATER WIRE, AND IT IS THE LARGEST SINGLE SHRINK THIS LEDGER HAS
// TAKEN. Three rows cleared in one commit: `drivers/rockySurface.js` and `drivers/craterDeck.js` on
// their own merits — the lab imports both at world-engine-lab.html:188 and calls each at
// world-engine-lab.html:2880 under exact-complement predicates — and `base/macroWavelength.js` FOR
// FREE, because `rockySurface.js` imports the wavelength law, so the lab reaches it the moment the
// pack lands. ⚠ THE FREE ROW IS THE ONE TO READ TWICE. It cleared TRANSITIVELY, which is exactly
// how `drivers/solidOptics.js` cleared wrongly on 2026-08-22 and had to be restored. It is DIFFERENT
// here and the difference is the criterion fixed on 2026-08-25: reachable-AND-CALLED. macroWavelength
// is not a pack with an uncalled entry point — it is a leaf whose only export is consumed by
// `rockySurface.js:268` inside the pack the lab now calls every route, so the law is EXERCISED, not
// merely importable. ⛔ THAT IS A MEASUREMENT AND IT WAS MADE: tools/crater-wire-seam-probe.mjs
// drives 104 solid body-seeds through the call site.
// ⭐ AND THE ROW ITSELF WARNED ABOUT THIS SHAPE — its `clears` text said B7 had already moved the
// GAME's `uNoiseScale` onto this derivation to match the lab, so the lab reaching the same number by
// a different route was 'precisely the drift this fence is for'. ⚠ WHAT THE WIRE ACTUALLY CLOSED IS
// THE IMPORT, NOT THE WRITE: `uNoiseScale` is exclusion 5 in ROCKY_SURFACE_LAB_BINDING
// (src/worldengine/drivers/rockySurface.js:441) because the lab holds NO state field for it, so the
// lab still renders the factory 4.0 and the pack's per-body wavelength reaches the lab's material
// through nothing. THE LAW IS NOW SINGLE-HOMED; ADOPTING ITS VALUE IN THE LAB IS A SEPARATE,
// VISIBLE CHANGE AND IT IS MAX'S. Saying so here is the point — a reader who sees this row gone
// would otherwise conclude the lab draws the shared frequency, and it does not.
// THREE ROWS REMAIN, and the merge gate Max ruled is `<= 2`.
// ⭐⭐ 3 -> 2 ON 2026-08-25, SAME DAY, AND THIS ONE REACHES MAX'S MERGE GATE — he ruled the gate is
// `ledger <= 2` with honest `clears` text, not zero, because zero needs a ruling he should not have to
// make plus an architecture rewrite unrelated to the lab/game split. `base/emission-e.js` cleared: the
// lab now imports `EMISSION_PHYS` and reads all three of the constants it used to spell out as
// literals (1.15, 1100, 0.26).
// ⛔ AND THE LAW HAD TWO HOMES IN ONE FILE, WHICH IS THE HALF THAT NEARLY GOT MISSED. The day-lift
// appears at world-engine-lab.html:2443 AND at :5344 — the second inside `frame()`, re-assigning
// `state.dayTempK` 60x/s and unconditionally overwriting the first. Converting :2443 alone changes
// nothing observable AND LOOKS LIKE IT WORKED, because :2452 seeds `state.thermalTempEq` from the same
// T_eq, so both routes yield the identical number until someone drags the T_eq slider. Both sites moved.
// ⚠ ONE COPY WAS DELIBERATELY LEFT: `redistribution` 3.0 still has three live homes
// (world-engine-lab.html:1043, shaders/uniforms.js:459, emission-e.js:163 — a default parameter, not an
// export) and NO debt row. It is named here rather than silently skipped: adding a key to
// EMISSION_PHYS shifts emission-e.js:164, which conditionFromBody.js:194 cites BY LINE, so closing it
// is a citation-repair job and its own decision. TWO ROWS REMAIN, and both are carried past the merge
// by design: `drivers/index.js` is a composition question and `shaders/craterRelief.glsl.js` is a
// DECLARED divergence awaiting Max's permanent-or-not ruling.
const IMPORT_BACK_DEBT_CEILING = 0;

const IMPORT_BACK_DEBT = Object.freeze([
  // ⭐ THE TWO PACK ROWS (`craterDeck`, `rockySurface`) WERE DELETED 2026-08-25 — the lab imports and
  // calls both. They are not rewritten as cleared-but-kept: the liveness test below reds on a stale
  // row precisely so this ledger cannot become a changelog of things that used to be true.
  // ⭐⭐ 1 -> 0 ON 2026-08-26. THE LEDGER IS EMPTY, and this last row was EARNED rather than
  // collected: the lab calls `selectPacks` at world-engine-lab.html's limb/optics gate, so the
  // composition point is reachable AND exercised. ⛔ THE ARM THAT PROVES IT WAS WRITTEN FIRST, IN ITS
  // OWN COMMIT — see COMPOSITION_POINT above. Until then `packEntryOf` returned null for this module
  // (every export ends in "Packs", which `\w+Pack\s*\(` cannot match) and `labExercises` returned true
  // unconditionally, so this row would have cleared on the IMPORT ALONE. That is the free clear this
  // ledger reversed once already, and it would have happened here silently.
  //
  // ⚠ WHAT CLEARED, STATED HONESTLY, BECAUSE THE ROW ASKED FOR MORE THAN WAS DELIVERED. The row's text
  // was "the lab applies packs through applyDriverPacks instead of calling each pack individually".
  // The lab still calls each pack individually. What is now SHARED is the applicability law — the
  // question "does this pack apply to this body" has one home instead of three hand-written
  // `compositionClass(...) === 'gas'` copies. A single composition point is ARCHITECTURALLY
  // UNAVAILABLE without restructuring applyDrivers, and that is measured rather than asserted: two
  // mirrors have mutually unsatisfiable positions (limbDeck's must land before the thick-haze x1.3
  // boost, solidOptics' after the terminator/aurora writes it supersedes), three of the eight call
  // sites are not in applyDrivers at all, three different condition vectors feed the eight, and
  // collapsing them reds the ratchet's bulk arm at MIN_BULK_STATE_FIELDS. The residue is recorded at
  // the call sites and is Max's ruling to make, not a row to leave standing as fiction.
  // ⭐⭐ 2 -> 1 ON 2026-08-26 — `shaders/craterRelief.glsl.js` CLEARED, and it is the first row this
  // ledger has lost to a CONVERGENCE rather than to an import-back of something the lab already had.
  // Max ruled it: "we need to converge; I need to be able to stop saying this, that the lab and game
  // need to have the same rendering system." The row's own text offered two exits — the lab adopts the
  // merged combiner, or Max rules the divergences permanent and it is promoted to GAME_ONLY_BY_DESIGN.
  // He took the first. The lab now imports CRATER_CELLULAR_GLSL + CRATER_COMBINER_GLSL at
  // height.glsl.js:13 and splices both, having deleted its own hash33, voronoi3d, craterProfile,
  // ejectaProfile, craterCombiner and ejectaCombiner (138 lines). ⚠ THE ROW IS DELETED RATHER THAN
  // REWRITTEN AS CLEARED, because the liveness test above reds on a stale row — that is the rule this
  // ledger is built on and it is what caught this one.
  // ⭐ `base/macroWavelength.js` ROW DELETED 2026-08-25 — it entered the lab's closure with the
  // crater wire, via `rockySurface.js`. The ceiling comment above states what that did and did NOT
  // close, because the distinction is the whole reason this row existed.
  // ⭐ `base/emission-e.js` ROW DELETED 2026-08-25 — the lab imports `EMISSION_PHYS` at
  // world-engine-lab.html:188 and reads it at :1042, :2443, :2446 and :5344. ⛔ THE ROW'S OWN STATED
  // BLOCKER WAS FICTION AND SAYING SO IS THE POINT: it read "the lab has no emission control surface
  // yet", and the lab has had the F32/F33 thermal family with a seven-control GUI folder since well
  // before this. A blocker nobody re-checked kept a row standing; the row was never blocked, only
  // unattended. ⚠ AND IT IS NOT A PACK — reachability alone clears it, so the row is DELETED rather
  // than rewritten, or the liveness test above reds on it.
]);

/** Import specifiers of one file, resolved to repo-relative paths that exist. */
export function resolvedImportsOf(rel) {
  const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;
  const code = stripCommentsPreservingOffsets(readFileSync(join(ROOT, rel), 'utf8'), { blankLiteralText: false });
  const out = [];
  for (const m of code.matchAll(SPEC)) {
    const spec = m[2];
    if (!spec.startsWith('.') && !spec.startsWith('/')) continue;   // bare = node_modules, not our subject
    const abs = spec.startsWith('/') ? join(ROOT, spec) : resolve(join(ROOT, dirname(rel)), spec);
    const r = relative(ROOT, abs).split('\\').join('/');
    if (existsSync(join(ROOT, r))) out.push(r);
  }
  return out;
}

function closureOf(roots) {
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    try { for (const d of resolvedImportsOf(f)) if (!seen.has(d)) stack.push(d); } catch { /* unreadable = leaf */ }
  }
  return seen;
}

/**
 * Pipeline modules in the game's closure but not the lab's.
 * @param {string} srcRel  a `src`-shaped tree; its `worldengine/` subtree is the pipeline
 * @param {string} labRel  the lab front-end
 */
export function gameOnlyPipelineModules(srcRel, labRel) {
  const engineRel = `${srcRel}/worldengine`;
  const all = jsFilesUnder(ROOT, srcRel);
  const gameEntries = all.filter(
    (f) => !f.startsWith(`${engineRel}/`) && resolvedImportsOf(f).some((d) => d.startsWith(`${engineRel}/`)),
  );
  const game = closureOf(gameEntries);
  const lab = closureOf([labRel]);
  const labCode = stripCommentsPreservingOffsets(readFileSync(join(ROOT, labRel), 'utf8'));
  return [...game].filter((f) => {
    if (!f.startsWith(`${engineRel}/`)) return false;
    if (!lab.has(f)) return true;                  // not reachable at all — the original criterion
    return !labExercises(f, labCode);              // reachable, but never exercised — see the ⛔ below
  }).sort();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// ⛔⛔ THE CRITERION IS REACHABLE-**AND-CALLED**, AND THIS IS A BUG FIX, NOT A POLICY CHANGE.
//
// Until 2026-08-25 this registration measured IMPORT CLOSURE alone. Every debt row's own `clears`
// text has always read "world-engine-lab.html imports it back AND CALLS IT" — so the implementation
// was weaker than the criterion the rows declared, and the gap was invisible while the only reason
// to import a pack was to call it.
//
// `drivers/solidOptics.js` is what pulled the two apart. `giantSurface.js` imports `TERMINATOR_GATE`
// from it so the gate NAME has one home; that alone put it in the lab's closure, its row was deleted
// as "no longer diverging", and the call-side work went untracked with nothing red. The lab has
// never called `solidOpticsPack`.
//
// ⭐ AND THE INTENT DOC SETTLES IT IN MAX'S OWN WORDS. one-route-shared-driver-path/intent.md's
// success criterion is "a change to one affects the other". Under reachability alone, a change to
// `solidOptics`' law does NOT reach the lab, and the fence called that clear — the proxy falsifying
// itself against the thing it exists to measure.
//
// ⚠ WHAT THIS STILL CANNOT SEE, stated so it is not mistaken for proof: a call in the WRONG
// FUNCTION. `giantSurface`'s call went into `applyDrivers` while seven of its outputs are authored
// in `ensureNetworkRouted` — green on every headless gate, `_gs is not defined` on page load. This
// is a stronger proxy, not a liveness test. THE PAGE STILL HAS TO BE LOADED.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The pack entry-point a driver module exports, e.g. `polarDeck.js` -> `polarDeckPack`.
 *
 * ⭐ READ OFF THE MODULE, NOT DERIVED FROM THE FILENAME. A filename-derived name silently becomes
 * unmatchable the day an export is renamed, and an unmatchable name makes this whole check vacuous
 * while still reporting green — the failure mode this registration exists to end.
 * @returns {string|null} the export name, or null for a module that is not a pack
 */
function packEntryOf(rel) {
  const code = stripCommentsPreservingOffsets(readFileSync(join(ROOT, rel), 'utf8'));
  const m = code.match(/export\s+function\s+(\w+Pack)\s*\(/);
  return m ? m[1] : null;
}

/**
 * Does the LAB actually CALL this module's pack entry, rather than merely reach it by import?
 *
 * ⚠ Matched against COMMENT-STRIPPED source on purpose: 2026-08-21 cost a cycle to an import that
 * was inside a comment and read as live by a scanner that did not strip.
 * @returns {boolean} true for a non-pack module, where reachability is the whole criterion
 */
// ⛔⛔ THE COMPOSITION POINT NEEDS ITS OWN ARM, AND WITHOUT IT THE LEDGER CANNOT TELL IMPORT FROM
// USE FOR THE ONE MODULE WHERE THAT DISTINCTION IS THE WHOLE POINT. `packEntryOf` looks for
// `export function \w+Pack(`, and src/worldengine/drivers/index.js exports `applyDriverPacks`,
// `applyDriverPacksToState` and `selectPacks` — every one of them ends in "Packs", so the regex
// matches NONE of them and `packEntryOf` returns null. The `entry == null → true` branch below then
// treats the composer as a non-pack module, where reachability IS the criterion, and the debt row
// clears the instant the lab adds the import WHETHER OR NOT IT CALLS ANYTHING.
//
// ⭐ That is precisely the free/transitive clear this ledger has had to reverse: `drivers/solidOptics.js`
// cleared on 2026-08-22 because it entered the lab's closure through another pack's import, nobody
// called it, and no gate was red. The criterion was fixed on 2026-08-25 to reachable-AND-CALLED. This
// module slipped through that fix because it fails the pack-name regex rather than the call test.
// ⚠ Verified by running it: packEntryOf('src/worldengine/drivers/index.js') === null, while
// packEntryOf('.../giantDeck.js') === 'giantDeckPack'.
const COMPOSITION_POINT = 'src/worldengine/drivers/index.js';
const COMPOSITION_POINT_CALLS = Object.freeze(['selectPacks', 'applyDriverPacksToState', 'applyDriverPacks']);

function labExercises(rel, labCode) {
  if (rel === COMPOSITION_POINT) {
    return COMPOSITION_POINT_CALLS.some((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(labCode));
  }
  const entry = packEntryOf(rel);
  if (entry == null) return true;
  return new RegExp(`\\b${entry}\\s*\\(`).test(labCode);
}

function importBackMessage(violations) {
  return (
    `one-pipeline-fence registration 2: a pipeline module is in the GAME's import closure and NOT ` +
    `the lab's, so one front-end exercises it and the other cannot. Import it back in ` +
    `world-engine-lab.html (the giantDeckPack import precedent), or add a debt row ` +
    `naming what clears it. Offending modules:\n` +
    violations.map((v) => `  · ${v}`).join('\n')
  );
}

describe('registration 2 — every pipeline module the game imports is imported by the lab', () => {
  const accounted = new Set([...GAME_ONLY_BY_DESIGN.map((e) => e.path), ...IMPORT_BACK_DEBT.map((e) => e.path)]);

  it('ZERO unaccounted modules diverge between the two closures', () => {
    const violations = gameOnlyPipelineModules('src', LAB_HTML).filter((f) => !accounted.has(f));
    expect(violations, violations.length ? importBackMessage(violations) : undefined).toEqual([]);
  });

  it('the debt ledger is SHRINK-ONLY — it may fall, never grow', () => {
    expect(IMPORT_BACK_DEBT.length).toBeLessThanOrEqual(IMPORT_BACK_DEBT_CEILING);
  });

  it('every debt row is LIVE — a cleared row is deleted, not left standing as fiction', () => {
    const diverging = new Set(gameOnlyPipelineModules('src', LAB_HTML));
    const stale = IMPORT_BACK_DEBT.filter((e) => !diverging.has(e.path)).map((e) => e.path);
    expect(
      stale,
      `these debt rows no longer diverge — DELETE them and lower IMPORT_BACK_DEBT_CEILING:\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  it('every debt row names what clears it, and "TBD" is not admissible', () => {
    for (const e of IMPORT_BACK_DEBT) {
      expect(e.clears, `debt row '${e.path}' must name what removes it`).toBeTruthy();
      expect(e.clears.trim().toUpperCase()).not.toBe('TBD');
      expect(e.clears.length).toBeGreaterThan(40);
    }
  });

  it('every by-design exemption still carries its in-source justification', () => {
    // An exemption is only as good as the reason in the file. If someone rewrites that header, the
    // exemption must fall over rather than be inherited by whatever the file became.
    for (const e of GAME_ONLY_BY_DESIGN) {
      const src = readFileSync(join(ROOT, e.path), 'utf8');
      expect(src, `${e.path} no longer states: "${e.evidence}"`).toContain(e.evidence);
    }
  });

  it('CONTROL: the closures are non-vacuous — both front-ends really do reach the pipeline', () => {
    const game = gameOnlyPipelineModules('src', LAB_HTML);
    expect(game.length).toBe(accounted.size);           // 14 at authoring, 9 after the four 2026-08-22 clears
    // ⚠ This stays an EQUALITY against `accounted`, not a hardcoded 14 — it must track the ledger as it
    // shrinks, or it becomes the next stale number in a file whose whole subject is stale numbers.
    expect(closureOf([LAB_HTML]).size).toBeGreaterThan(40);
  });

  it('CONTROL: the broken fixture makes it fail BY NAME, with the offending path in the message', () => {
    const base = `${FIXTURES}/no-lab-import`;
    const violations = gameOnlyPipelineModules(`${base}/src`, `${base}/lab-stub.html`);
    expect(violations.length).toBeGreaterThan(0);
    expect(importBackMessage(violations)).toContain(`${base}/src/worldengine/base/orphanOptics.js`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// REGISTRATION 2b — AC4. THE DRIVERS ROSTER IS CLOSED.
//
// ⭐ WHAT THIS ADDS THAT REGISTRATION 2 ABOVE DOES NOT, stated as the hole rather than as a policy.
// Registration 2 catches a diverging module and offers the author two ways out: import it back, or
// add a debt row. The second way out is the one that must not exist for PACKS — it is, precisely,
// what the rows in `IMPORT_BACK_DEBT` record having happened seven times. And the ledger's
// `<=` ceiling makes that route OPEN AGAIN the moment this workstream succeeds: the liveness test
// deletes a cleared row, the length drops, the ceiling stays where it was, and a free slot now sits
// there for the next pack. Nothing reds. That is not a hypothetical — clearing rows is the stated
// purpose of the work in flight, so the hole opens on success, which is the worst time to find it.
//
// TWO LAWS CLOSE IT, and they are separate because they fail differently:
//   · THE ROSTER IS CLOSED. The packs on it are grandfathered BY NAME, and it may only SHRINK. Any other file under
//     `src/worldengine/drivers/` must be in the lab's import closure — no ledger row can buy it in.
//     A new pack therefore has exactly one way to ship: the lab imports it. That is AC4 verbatim.
//   · THE LEDGER HAS NO SLACK. `IMPORT_BACK_DEBT_CEILING` must EQUAL the ledger length, so a
//     cleared row forces the ceiling down instead of leaving an unearned slot behind it.
//
// ⛔ THE ROSTER IS NOT DERIVED FROM THE DEBT LEDGER, and that is the whole mechanism. Deriving it
// would mean adding a debt row also extends the roster — the hole, re-opened by the fix for it. It
// is a frozen list, asserted to be a SUBSET of the ledger so the two cannot disagree, and asserted
// LIVE so an entry the lab has since imported is deleted rather than left standing as cover.
//
// ⚠ `index.js` is excluded as the composition point, exactly as registration 4 excludes it. It is
// not a pack; it is where packs are composed, and its own debt row is blocked by the pack rows above.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

// ⛔ CLOSED 2026-08-22. This list may SHRINK and may never gain an entry. A pack authored after this
// date has one route into the tree: world-engine-lab.html imports it. ⭐ Measured, not asserted — the
// non-vacuity control below drives the same scanner with an EMPTY roster and pins exactly these
// four, so the list is a reading of the tree rather than a claim about it. `giantDeck.js` is absent
// because the lab really does import it at world-engine-lab.html:188 `giantDeckPack` — the one precedent.
// ⭐⭐ THE ROSTER IS EMPTY AS OF 2026-08-25, AND AN EMPTY ROSTER IS THE SUCCESS STATE, NOT A GAP.
// It grandfathered exactly two packs — `craterDeck` and `rockySurface` — and the crater wire imported
// and called both, so registration 2b now admits NO pack that the lab does not import. ⛔ IT MUST STAY
// EMPTY: the roster is CLOSED, so a new pack cannot be added here, and the fence's own message says so.
// ⚠ AND EMPTYING IT KILLED THE CONTROL BELOW IN ITS ORIGINAL FORM — see that test's note. An expected
// list that shrinks to `[]` alongside its subject stops testing anything, and this file is about
// exactly that failure mode.
const GRANDFATHERED_UNIMPORTED_PACKS = Object.freeze([]);

/** Unearned admissions the ledger can absorb: ceiling minus rows. Must be 0. */
export function ledgerSlack(debtLength, ceiling) {
  return ceiling - debtLength;
}

/**
 * Packs under `driversRel` that the lab front-end does not import.
 * @param {string} driversRel     repo-relative drivers directory
 * @param {string} labRel         the lab front-end
 * @param {Set<string>} grandfathered  roster paths exempt while their debt rows stand
 * @returns {string[]} repo-relative paths of packs outside the roster and outside the lab's closure
 */
export function unimportedNewPacks(driversRel, labRel, grandfathered) {
  const lab = closureOf([labRel]);
  const out = [];
  for (const ent of readdirSync(join(ROOT, driversRel), { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.js')) continue;
    if (ent.name === 'index.js') continue;              // the composition point, not a pack
    const path = `${driversRel}/${ent.name}`;
    if (!grandfathered.has(path) && !lab.has(path)) out.push(path);
  }
  return out.sort();
}

function newPackMessage(violations) {
  return (
    `one-pipeline-fence registration 2b (AC4): a pack was authored under \`${DRIVERS_DIR}/\` that ` +
    `world-engine-lab.html does NOT import, and the grandfathered roster is CLOSED — it cannot take ` +
    `a newcomer. Import it back in the lab — the precedent is world-engine-lab.html:188 `+'`giantDeckPack`'+`. ` +
    `A debt row will not clear this: the roster, not the ledger, is what admits a pack. ` +
    `Offending packs:\n` + violations.map((v) => `  · ${v}`).join('\n')
  );
}

describe('registration 2b — a NEW pack cannot ship without the lab importing it (AC4)', () => {
  const CONTROL = `${FIXTURES}/new-unimported-pack`;

  it('ZERO packs outside the grandfathered roster are missing from the lab closure', () => {
    const violations = unimportedNewPacks(DRIVERS_DIR, LAB_HTML, new Set(GRANDFATHERED_UNIMPORTED_PACKS));
    expect(violations, violations.length ? newPackMessage(violations) : undefined).toEqual([]);
  });

  it('CONTROL: the scan is non-vacuous — it reads the REAL drivers tree and names EVERY pack in it', () => {
    // ⛔⛔ THIS CONTROL WAS REWRITTEN ON 2026-08-25 BECAUSE THE CRATER WIRE WOULD OTHERWISE HAVE KILLED
    // IT SILENTLY, and the shape of that near-miss is worth more than the assertion. It used to read
    // `unimportedNewPacks(DRIVERS_DIR, LAB_HTML, new Set())` and pin the answer to a HARDCODED
    // ['craterDeck', 'rockySurface'] — the two packs the lab did not yet import. The wire imported
    // both, so the honest edit was `toEqual([])` — and `expect([]).toEqual([])` passes just as well
    // when the walker returns nothing because it is BROKEN. The control's subject and its expected
    // value would have vanished together, leaving a green test that reads like coverage.
    // ⭐ THE FIX IS TO KEEP THE REAL TREE AS THE SUBJECT AND MOVE THE VARIABLE TO THE LAB SIDE: walk
    // the REAL drivers directory against a lab stub that imports none of it. Every shipped pack must
    // be named. That answer GROWS as packs are added instead of shrinking as they are wired, so it
    // cannot go vacuous the way its predecessor was one commit from doing.
    // ⚠ The two fixture controls below still cover the walker's red/green transition; this one covers
    // the thing they cannot — that the walker is pointed at what actually ships.
    const shipped = unimportedNewPacks(DRIVERS_DIR, `${CONTROL}/lab-stub-fixed.html`, new Set());
    const onDisk = readdirSync(join(ROOT, DRIVERS_DIR), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.js') && e.name !== 'index.js')
      .map((e) => `${DRIVERS_DIR}/${e.name}`).sort();
    expect(onDisk.length, 'the drivers tree is empty — the walker has nothing to read').toBeGreaterThan(7);
    expect(shipped).toEqual(onDisk);
    // And the green above is the same walker over the same tree with the real lab: it imports them all.
    expect(unimportedNewPacks(DRIVERS_DIR, LAB_HTML, new Set())).toEqual([]);
  });

  it('the roster is LIVE — a roster pack the lab now imports is DELETED, not left standing', () => {
    const lab = closureOf([LAB_HTML]);
    const stale = GRANDFATHERED_UNIMPORTED_PACKS.filter((p) => lab.has(p));
    expect(
      stale,
      `the lab now imports these — DELETE them from the roster (and their debt rows, and lower ` +
      `IMPORT_BACK_DEBT_CEILING). A roster that keeps admitting a pack the lab already imports is ` +
      `a hole with a name on it:\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  it('every roster entry has a debt row — the roster is not a second expression of the same fact', () => {
    // Registration 3 bans a law declared in two trees. This roster IS such a duplicate unless it is
    // pinned to the ledger it grandfathers, so it is asserted to be a strict subset. Adding a pack
    // here without a debt row would create exactly the free-floating exemption the fence exists for.
    const debt = new Set(IMPORT_BACK_DEBT.map((e) => e.path));
    const unbacked = GRANDFATHERED_UNIMPORTED_PACKS.filter((p) => !debt.has(p));
    expect(unbacked, `roster entries with no debt row naming what clears them:\n${unbacked.join('\n')}`).toEqual([]);
  });

  it('the debt ledger has NO SLACK — a free slot under the ceiling is an unearned admission', () => {
    expect(
      ledgerSlack(IMPORT_BACK_DEBT.length, IMPORT_BACK_DEBT_CEILING),
      `the ceiling sits ABOVE the ledger, so a new module can be admitted as debt and stay green. ` +
      `Lower IMPORT_BACK_DEBT_CEILING to ${IMPORT_BACK_DEBT.length}.`,
    ).toBe(0);
  });

  it('CONTROL: slack is detected on the exact post-clear state — a row cleared, ceiling not lowered', () => {
    // The assertion above passes today (11 === 11), so on its own it proves nothing. This drives the
    // same function with the state this workstream is actively creating — one row cleared by the
    // liveness test and the ceiling left where it was — and demands it report the free slot.
    expect(ledgerSlack(IMPORT_BACK_DEBT_CEILING - 1, IMPORT_BACK_DEBT_CEILING)).toBeGreaterThan(0);
    expect(ledgerSlack(IMPORT_BACK_DEBT_CEILING, IMPORT_BACK_DEBT_CEILING)).toBe(0);
  });

  it('CONTROL: the broken fixture makes it fail BY NAME, with the offending path in the message', () => {
    const violations = unimportedNewPacks(`${CONTROL}/drivers`, `${CONTROL}/lab-stub-broken.html`, new Set());
    expect(violations.length).toBeGreaterThan(0);
    expect(newPackMessage(violations)).toContain(`${CONTROL}/drivers/newDeck.js`);
  });

  it('CONTROL: restoring the lab import returns the SAME fixture to green', () => {
    const repaired = unimportedNewPacks(`${CONTROL}/drivers`, `${CONTROL}/lab-stub-fixed.html`, new Set());
    expect(repaired).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// ROLL-CALL — registrations 1 and 6, which ship elsewhere.
//
// ⛔ WHY THEY ARE NOT RE-AUTHORED HERE. Both already exist WITH executed controls. Copying either
// into this file would create a second expression of a law free to drift from the one under test —
// which is the exact hazard registration 3 above exists to ban, committed by the fence that bans it.
//
// ⭐ WHAT THIS ROLL-CALL BUYS, and it is not bookkeeping: without it, deleting
// src/src-boundary-fence.test.js silently reduces Step 11's fence from six registrations to four,
// and every remaining test still passes. The roll-call is what makes that deletion loud. It asserts
// each file EXISTS and still carries a live control — not merely that a filename is present.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const DISCHARGED_ELSEWHERE = Object.freeze([
  Object.freeze({
    registration: 1,
    what: 'no file under src/ imports a loose repo-root .js; allowlist entries name what clears them',
    file: 'tests/src-boundary-fence.test.js',
    controlEvidence: 'CONTROL: the scan is non-vacuous',
  }),
  Object.freeze({
    registration: 6,
    what: "the Step-5 shrink-only ratchet over world-engine-lab.html",
    file: 'tests/lab-surface-ratchet.test.js',
    controlEvidence: 'CONTROL',
  }),
]);

describe('roll-call — registrations 1 and 6 are discharged, not missing', () => {
  it('each discharged registration still has its file', () => {
    for (const e of DISCHARGED_ELSEWHERE) {
      expect(
        existsSync(join(ROOT, e.file)),
        `registration ${e.registration} (${e.what}) was discharged by ${e.file}, which is GONE. ` +
        `Step 11's fence is now missing a registration. Restore the file, or author the ` +
        `registration here and delete this roll-call row.`,
      ).toBe(true);
    }
  });

  it('each discharged registration still carries a live control of its own', () => {
    // The file existing is not enough — a fence whose control was deleted is the "pass with no
    // failing control" the gate calls worthless, and this roll-call would otherwise bless it.
    for (const e of DISCHARGED_ELSEWHERE) {
      const src = readFileSync(join(ROOT, e.file), 'utf8');
      expect(
        src.includes(e.controlEvidence),
        `${e.file} no longer contains a control matching "${e.controlEvidence}" — registration ` +
        `${e.registration} may still assert, but nothing proves it can FAIL.`,
      ).toBe(true);
    }
  });

  it('all six registrations are accounted for — four here, two discharged', () => {
    // The arithmetic is the point: Step 11 specifies five registrations plus the Step-5 ratchet as a
    // sixth. If someone deletes a describe() block above, this stays green — which is why the
    // per-registration controls, not this count, are the real gate. It exists to catch the OTHER
    // failure: a registration nobody ever wrote.
    const authoredHere = [2, 3, 4, 5];
    const discharged = DISCHARGED_ELSEWHERE.map((e) => e.registration);
    expect([...authoredHere, ...discharged].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
