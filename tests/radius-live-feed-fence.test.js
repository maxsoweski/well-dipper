// tests/radius-live-feed-fence.test.js — AC-NOFROZEN.
// Workstream: world-engine-radius-live-feed-2026-07-25.
//
// THE DEFECT THIS FENCE EXISTS TO PREVENT. Six sites in planet-lod-lab.html derived a LIVE quantity
// (Rhines band drivers, the F25 jet stripe ladder, the storm-vortex drivers, the cloud-regime gate,
// the giant-dynamo gate) from `_fp = DRIVER_PRESETS[driverUI.preset]` — a FROZEN preset object the
// radius slider never mutates. The slider writes `state.planetRadiusEarth`. So dragging radius moved
// the disc and moved nothing else. That is Max's "I can tell that's not happening across the board".
// Five of the six now read the drawn radius. This fence keeps the frozen feed from silently returning.
//
// THE INVARIANT: no expression in planet-lod-lab.html may read `radiusEarth` off a frozen preset
// object (`_fp` or a `DRIVER_PRESETS[...]` subscript), EXCEPT the explicit ALLOWLIST below — and an
// allowlist entry is only legitimate if the site's canonical-radius behaviour was PROVEN by
// measurement rather than assumed (contract AC-NOFROZEN observable).
//
// COMMENT-INCLUSIVE BY DESIGN, following the house pattern of tests/vis-scale-fence.test.js. The scan
// does NOT strip comments: commented-out code is one uncomment away from being live, and a fence that
// ignores comments cannot see that coming. The cost is that PROSE about the defect trips the fence, so
// the lab's own rewire comments say "the frozen preset constant" in words rather than quoting the
// expression. That is the same trade vis-scale-fence.test.js already imposes on src/worldengine/**.
//
// PASS/FAIL CRITERION FOR THE WHOLE FILE: exact set equality on the offender list (`toEqual([])`), not
// a count or a threshold. A radius feed is either live or frozen; there is no tolerance band.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB_REL = 'planet-lod-lab.html';
const LAB = readFileSync(join(ROOT, LAB_REL), 'utf8');

// ── the deny pattern ─────────────────────────────────────────────────────────────────────────────
// Matches a `radiusEarth` member read on a FROZEN preset source, in any of the spellings the lab
// uses or could use:
//     _fp.radiusEarth   _fp?.radiusEarth   fp.radiusEarth   DRIVER_PRESETS[driverUI.preset].radiusEarth
// `\s*` around the dot spans newlines, so a line-broken member chain cannot slip past a line scan.
// It deliberately does NOT match the LIVE sources, which is what makes the fence meaningful rather
// than a blanket ban on the word: `state.planetRadiusEarth`, `_gcond.radiusEarth` /
// `_scond.radiusEarth` (the condition vector, which carries the drawn radius), `o.radiusEarth`
// (probe options), or `radiusEarth: 1` (an object-literal key). Those are all asserted below.
//
// THIRD SPELLING ADDED 2026-07-25 (lens round). The fence originally knew only `_fp` and a
// `DRIVER_PRESETS[…]` subscript — but the lab ALREADY has a third frozen-preset binding in scope on
// the radius path: the bare parameter `fp` of `buildBodyDrivers(u, fp)` and `resetDriverOverrides(u,
// fp)`, off which `fp.T_eq` and `fp.age` are already read. buildBodyDrivers is where the condition
// vector for the whole body-driver bundle is derived, i.e. the SAME class of site as the two the
// rewire just fixed, so a re-freeze written through that alias would have been invisible. `\bfp\b`
// cannot match inside `_fp` (no word boundary after `_`), so the two alternatives do not overlap.
const DENY_SRC = String.raw`(?:\b_fp\b|\bfp\b|DRIVER_PRESETS\s*\[[^\]]*\])\s*\??\.\s*radiusEarth`;
// NON-global on purpose: `.test()` on a /g regex advances and RETAINS `lastIndex`, and
// String.prototype.matchAll seeds its internal matcher FROM the source regex's lastIndex — so a
// single module-level /g regex shared between `.test()` and `matchAll` silently starts later scans
// mid-file. That bug was live here (measured: the staleness test below left lastIndex = 122, so
// every subsequent scan began at byte 122 and could not see an offender in the first 122 bytes).
// The scanner therefore builds a FRESH global matcher per call; nothing carries state between them.
const DENY = new RegExp(DENY_SRC);
const denyScanner = () => new RegExp(DENY_SRC, 'g');

// ── the allowlist ────────────────────────────────────────────────────────────────────────────────
// One entry per deliberately-canonical site. `match` is a distinctive substring of the offending
// SOURCE LINE (not a line number — line numbers rot). `why` must state the PROOF, and `evidence`
// must point at the artifact that carries it. An entry with no measured proof is not admissible.
const ALLOWLIST = [
  {
    id: 'craterboot-worldDefaultEnableSet',
    match: 'craterRelevanceOf(deriveConditionVector(',
    // PROVEN, not assumed. craterRelevanceOf was swept over the FULL slider range for all 18 presets
    // (18 × 401 log-spaced radii, the slider's own radiusFromT travel): zero flips, and no continuous
    // margin closer than 18× to any decision boundary. Stronger than the preset table — the predicate's
    // own clamps (craterSchedule floors gravity at 1e-6; isImpactSurface caps pressure at P_SURF_MAX)
    // bound the flip radius over its ENTIRE admissible input domain at R_flip_max = 0.133 R⊕, which is
    // 2.26× BELOW the slider floor of 0.3. On [0.3, 16] the predicate reduces to
    // `isImpactSurface(c) && t_exp > 0`, both radius-blind. Feeding the drawn radius here could not
    // change the answer; doing it would be churn against measured evidence.
    // The bound is re-derived and the sweep re-run on every CI run by
    // tests/radius-live-feed.test.js → "AC-CRATERBOOT", so this allowlist entry cannot go stale silently.
    // FLOOR CORRECTED 2026-07-25 (lens round): the margin used to be quoted against RADIUS_SLIDER_MIN
    // = 0.3, but state.planetRadiusEarth is not floored there — the lab's draw site passes
    // { labUnlock: true } and LAB_UNLOCKED_RANGES['Moon/Mercury (impact-airless)'] = [0.27, 0.38],
    // 27.1% of whose seeds land below 0.3. True reachable floor 0.27 ⇒ headroom 2.03x, not 2.26x.
    why: 'craterRelevanceOf is measured constant in R across the whole REACHABLE radius range [0.27, 16] '
       + 'for every preset; its own clamps bound any possible flip at 0.133 RE, 2.03x below the true '
       + 'reachable floor of 0.27 RE (the Moon/Mercury lab-unlock draw band, not the 0.3 slider floor).',
    evidence: 'docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/evidence/G2-craterboot-sweep.md',
  },
  {
    id: 'giantDynamo-compositionClassifier',
    match: '_giantDynamo = _gas && (_fp.radiusEarth',
    // PROVEN, not assumed — and proven STRUCTURALLY, which is stronger than a sweep.
    // This gate decides which INTERIOR COMPOSITION a world has (metallic-/ionic-envelope dynamo vs
    // regime-2 featureless). The ratified V2-6 frame is that the slider draws a bigger body of the
    // SAME composition — so the drawn radius is, by construction, the one quantity carrying no
    // composition information. Keying a composition classifier on it is a category error.
    // The measurement that makes it observable: 'Ice giant (Neptunian)' and 'Sub-Neptune (hazy)'
    // share the PRESET_ARCHETYPE key 'sub-neptune' (deliberate, V2-3 AC-TAXONOMY-NEPTUNE), and
    // drawPresetRadius keys its PRNG on 'draw:radius:'+seed with NO preset name (driver-presets.js
    // :271) — so at every seed the two presets receive a BIT-IDENTICAL drawn radius. A size-keyed
    // discriminator therefore returns the SAME verdict for two DIFFERENT compositions, at every
    // seed, necessarily. Feeding the drawn radius here does not make the gate more responsive; it
    // makes it non-functional, and (because the next line's guard is a strict '>' against a
    // magneticField of exactly 0.05) it ZEROES the ice giant's aurora on 67.5% of seeds including
    // the shipped default.
    // Re-checked every CI run by tests/radius-live-feed.test.js -> "AT THE RADIUS THE LAB ACTUALLY
    // DRAWS", which asserts both the identical-draw collapse and the preserved aurora, so this
    // entry cannot go stale silently.
    why: 'the giant-dynamo gate is a COMPOSITION CLASSIFIER, not a physics response. Neptunian and '
       + 'Sub-Neptune deliberately share a draw range and PRNG key, so their drawn radii are '
       + 'bit-identical at every seed — a size-keyed discriminator provably cannot separate them. '
       + 'Classifiers read canonical; physics inputs read drawn.',
    evidence: 'docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/BUILD-NOTES.md',
  },
];

// index → 1-based line number, so an offender is reported where a human can find it.
function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

// The scanner under test. Returns [{ line, text }] for every DENY hit NOT covered by the allowlist.
// Exported shape is deliberately data (not a boolean) so the negative controls below can assert on
// exactly what it caught, rather than on "it failed somehow".
function scanFrozenRadiusReads(src, allowlist = ALLOWLIST) {
  const lines = src.split('\n');
  const offenders = [];
  for (const m of src.matchAll(denyScanner())) {   // fresh matcher ⇒ always starts at offset 0
    const line = lineOf(src, m.index);
    const text = lines[line - 1];
    if (allowlist.some((a) => text.includes(a.match))) continue;
    offenders.push({ line, text: text.trim() });
  }
  return offenders;
}

describe('AC-NOFROZEN — no live quantity reads radius off a frozen preset', () => {
  it('planet-lod-lab.html has no un-allowlisted frozen radius read', () => {
    // CRITERION: exact empty set. Any hit is a site the radius slider cannot reach.
    expect(scanFrozenRadiusReads(LAB)).toEqual([]);
  });

  it('the scan is not vacuous — it does find the allowlisted site in the real source', () => {
    // Guards the failure mode where the DENY regex silently stops matching anything (a rename, an
    // encoding change) and the fence goes permanently green. The allowlisted crater-boot site is a
    // REAL frozen read that must keep being detected — just not reported.
    const all = [...LAB.matchAll(denyScanner())];
    expect(all.length).toBeGreaterThanOrEqual(1);
    const allowedHits = all.filter((m) => {
      const t = LAB.split('\n')[lineOf(LAB, m.index) - 1];
      return ALLOWLIST.some((a) => t.includes(a.match));
    });
    expect(allowedHits.length).toBe(all.length);   // every real hit is an allowlisted one
  });

  it('every allowlist entry still matches a real line (no stale entries hiding drift)', () => {
    // A stale allowlist entry is worse than none: it looks like a justified exemption while its site
    // no longer exists, and it would silently forgive a DIFFERENT future line that happens to contain
    // the same substring. CRITERION: each entry matches at least one line, and that line is a DENY hit.
    for (const a of ALLOWLIST) {
      const hits = LAB.split('\n').filter((l) => l.includes(a.match));
      expect(hits.length, `allowlist entry '${a.id}' matches no line`).toBeGreaterThanOrEqual(1);
      const denies = hits.filter((l) => DENY.test(l));   // DENY is non-global ⇒ no lastIndex state
      expect(denies.length, `allowlist entry '${a.id}' covers no frozen read — delete it`).toBeGreaterThanOrEqual(1);
    }
  });

  it('INSTRUMENT CONTROL: the scanner has no cross-call regex state (the lastIndex bug, planted)', () => {
    // PLANTED DEFECT for the instrument itself. Before the 2026-07-25 fix, DENY was a single
    // module-level /g regex shared between `.test()` and `String.matchAll`. `.test()` leaves
    // lastIndex non-zero on a hit, and matchAll seeds its internal matcher FROM that lastIndex, so
    // every scan after the staleness test above began at byte offset 122 instead of 0.
    // CRITERION: an offender planted at the very START of the source must still be found AFTER the
    // exact `.test()` sequence that used to poison the state. With the old shared-/g scanner this
    // assertion fails (measured: first hit reported at 406062 instead of 4); with the fix it passes.
    for (const a of ALLOWLIST) for (const l of LAB.split('\n').filter((x) => x.includes(a.match))) DENY.test(l);
    const planted = '\n// _fp.radiusEarth — planted at the top of the file\n' + LAB;
    const offenders = scanFrozenRadiusReads(planted);
    expect(offenders.length).toBe(1);
    expect(offenders[0].line).toBe(2);                 // found at the TOP, not skipped past
  });

  it('every allowlist entry carries a stated proof and a pointer to the evidence', () => {
    // AC-NOFROZEN's observable: "the allowlist is non-empty only for sites whose canonical-radius
    // behaviour was PROVEN rather than assumed". This is the machine-checkable half of that.
    for (const a of ALLOWLIST) {
      expect(a.why, `allowlist entry '${a.id}' has no stated reason`).toBeTruthy();
      expect(a.why.length).toBeGreaterThan(40);              // a sentence, not a shrug
      expect(a.evidence).toMatch(/^docs\/WORKSTREAMS\/.+\.md$/);
    }
  });
});

describe('AC-NOFROZEN — MANDATORY NEGATIVE CHECK: the fence catches a re-frozen site', () => {
  // A fence that passes on a broken build is worse than no fence. These are PLANTED DEFECTS run on
  // every invocation: each takes the REAL current source, re-freezes one rewired site by string
  // substitution, and asserts the scanner reports it. Break ⇒ FAIL, restore ⇒ PASS, in-process.
  const PLANTED = [
    {
      id: 'bandCount (F25 jet stripe ladder)',
      live: 'Math.round(12 * (state.planetRadiusEarth ?? 1) / _rotH)',
      frozen: 'Math.round(12 * (_fp.radiusEarth ?? 1) / _rotH)',
    },
    {
      id: 'cloud regime gate (< 6 RE)',
      live: '_gas && (state.planetRadiusEarth ?? 1) < 6',
      frozen: '_gas && (_fp.radiusEarth ?? 1) < 6',
    },
    // NOTE: the giant-dynamo gate is deliberately ABSENT from this planted-defect list. It is an
    // allowlisted COMPOSITION CLASSIFIER that correctly reads the canonical radius (see the ALLOWLIST
    // entry 'giantDynamo-compositionClassifier' for the derivation and the identical-draw proof), so
    // "re-freezing" it is not a defect — it is the specified behaviour. Its inverse defect (someone
    // re-pointing it at the drawn radius, which provably destroys the Neptunian/Sub-Neptune
    // discrimination) is caught instead by the AC-0 source pin below and by the aurora assertions in
    // tests/radius-live-feed.test.js -> "AT THE RADIUS THE LAB ACTUALLY DRAWS".
    {
      id: 'E5 Rhines band driver',
      live: 'radius: (_gcond.radiusEarth ?? 1) / 11.2',
      frozen: 'radius: (_fp.radiusEarth ?? 1) / 11.2',
    },
    {
      id: 'storm-vortex driver',
      live: 'radius: (_scond.radiusEarth ?? 1) / 11.2',
      frozen: 'radius: (_fp.radiusEarth ?? 1) / 11.2',
    },
    {
      // ADDED 2026-07-25 (lens round): the bare-`fp` alias. buildBodyDrivers(u, fp) derives the
      // body-driver condition vector — the same class of site as the two the rewire fixed — and it
      // already reads fp.T_eq / fp.age, so a re-freeze here is a live drift path, not a hypothetical.
      id: 'buildBodyDrivers condition vector via the bare `fp` alias',
      live: 'const _cond = deriveConditionVector(fp, u, state.planetRadiusEarth);',
      frozen: 'const _cond = deriveConditionVector(fp, u, fp.radiusEarth);',
    },
    {
      id: 'crater boot via a DRIVER_PRESETS subscript (the other frozen spelling)',
      live: 'deriveUniforms(_fp, driverUI.qualityTier), _fp.radiusEarth))',
      frozen: 'deriveUniforms(_fp, driverUI.qualityTier), DRIVER_PRESETS[preset].radiusEarth))',
      // NB: this one is planted ON the allowlisted line, so it also proves the allowlist is keyed on
      // the SITE (the craterRelevanceOf call shape), not on "any line mentioning a preset radius".
      stillAllowlisted: true,
    },
  ];

  for (const d of PLANTED) {
    it(`re-freezing ${d.id} is caught (planted defect ⇒ fence FAILS)`, () => {
      expect(LAB.includes(d.live), `live form not found — source drifted: ${d.live}`).toBe(true);
      const broken = LAB.replace(d.live, d.frozen);
      expect(broken).not.toBe(LAB);                                   // the plant actually landed
      const offenders = scanFrozenRadiusReads(broken);
      if (d.stillAllowlisted) {
        // The crater-boot line stays exempt even in the other spelling — correct, and the reason the
        // allowlist matches on the call shape. The point of this case is that the DENY pattern itself
        // covers `DRIVER_PRESETS[...].radiusEarth`, proven by the un-allowlisted scan below.
        expect(scanFrozenRadiusReads(broken, [])).not.toEqual([]);
      } else {
        expect(offenders.length, `fence did not catch the re-frozen ${d.id}`).toBeGreaterThanOrEqual(1);
      }
      // …and the UNMODIFIED source is still clean, i.e. restore ⇒ PASS.
      expect(scanFrozenRadiusReads(LAB)).toEqual([]);
    });
  }
});

describe('AC-NOFROZEN — DENY-pattern precision (it must not ban the live sources)', () => {
  // A deny pattern that also matched the correct code would force the fence to be disabled. These
  // pin the exact boundary: what counts as frozen, and what must never be mistaken for it.
  const MUST_MATCH = [
    '_fp.radiusEarth',
    '_fp?.radiusEarth',
    '(_fp.radiusEarth ?? 1)',
    'DRIVER_PRESETS[driverUI.preset].radiusEarth',
    'DRIVER_PRESETS[preset].radiusEarth',
    "DRIVER_PRESETS['Gas giant (Jovian)'].radiusEarth",
    'DRIVER_PRESETS[p]\n        .radiusEarth',     // line-broken member chain
    'fp.radiusEarth',                              // the bare alias (buildBodyDrivers / resetDriverOverrides)
    'fp?.radiusEarth',
    'deriveConditionVector(fp, u, fp.radiusEarth)',
    'bundle.fp.radiusEarth',                       // the alias reached through a property chain
  ];
  const MUST_NOT_MATCH = [
    'state.planetRadiusEarth',
    '(state.planetRadiusEarth ?? 1)',
    '_gcond.radiusEarth',
    '_scond.radiusEarth',
    '_bodyDrivers.condition.radiusEarth',
    'o.radiusEarth != null ? +o.radiusEarth : state.planetRadiusEarth',
    'sample.radiusEarth',
    'moons: [{ orbitRadiusEarth: 9.0, radiusEarth: 1 }]',   // object-literal key, not a read
    'radiusEarth: state.planetRadiusEarth,',
    '_fp.massEarth',                                        // a different frozen field — out of scope
    'gfp.radiusEarth',                                      // `fp` inside a longer identifier — no word boundary
    'fp.T_eq',                                              // the alias on a DIFFERENT field — out of scope
  ];

  for (const s of MUST_MATCH) {
    it(`matches frozen form: ${JSON.stringify(s)}`, () => {
      expect(DENY.test(s)).toBe(true);                      // DENY is non-global ⇒ no lastIndex to reset
    });
  }
  for (const s of MUST_NOT_MATCH) {
    it(`does NOT match live/irrelevant form: ${JSON.stringify(s)}`, () => {
      expect(DENY.test(s)).toBe(false);
    });
  }
});

describe('AC-0 — the rewired sites are NAMED consumers of the live driver (source pins)', () => {
  // Spine conformance (Rule 15): each rewired consumer must be visibly wired to the driver it now
  // reads. These are the positive half of the fence — the negative half only proves the OLD feed is
  // gone, not that the NEW one is present.
  const PINS = [
    // site, expected live expression, the driver it now names
    ['E5 Rhines band bake (rebakeE5Bands)', /radius:\s*\(_gcond\.radiusEarth\s*\?\?\s*1\)\s*\/\s*11\.2/],
    ['storm/vortex bake (applyStormState)', /radius:\s*\(_scond\.radiusEarth\s*\?\?\s*1\)\s*\/\s*11\.2/],
    ['F25 jet stripe ladder (state.bandCount)', /state\.bandCount\s*=\s*Math\.min\(16,\s*Math\.max\(3,\s*Math\.round\(12\s*\*\s*\(state\.planetRadiusEarth\s*\?\?\s*1\)\s*\/\s*_rotH\)\)\)/],
    ['cloud regime gate', /_gas\s*&&\s*\(state\.planetRadiusEarth\s*\?\?\s*1\)\s*<\s*6/],
  ];
  for (const [name, re] of PINS) {
    it(`${name} reads the drawn radius`, () => expect(LAB).toMatch(re));
  }

  // The INVERSE pin. The giant-dynamo gate must keep reading the CANONICAL radius: it classifies
  // interior composition, and Neptunian/Sub-Neptune draw bit-identical radii at every seed, so a
  // drawn-radius discriminator cannot separate them (ALLOWLIST 'giantDynamo-compositionClassifier').
  // This asserts BOTH directions so the site cannot drift either way unnoticed.
  it('giant dynamo gate reads the CANONICAL radius (composition classifier, not a physics input)', () => {
    expect(LAB).toMatch(/_giantDynamo\s*=\s*_gas\s*&&\s*\(_fp\.radiusEarth\s*\?\?\s*1\)\s*>=\s*3\.5/);
    expect(LAB).not.toMatch(/_giantDynamo\s*=\s*_gas\s*&&\s*\(state\.planetRadiusEarth/);
  });

  it('the two condition vectors the E5/storm sites read are derived from the DRAWN radius', () => {
    // The chain that makes _gcond/_scond legitimate live sources: both are built by the single-source
    // deriveConditionVector fed state.planetRadiusEarth. If that ever became _fp.radiusEarth the sites
    // above would look live while being frozen — so pin the derivation, not just the read.
    const derives = [...LAB.matchAll(/deriveConditionVector\(\s*_fp\s*,\s*_[a-z]+\s*,\s*([^)]+)\)/g)].map((m) => m[1].trim());
    expect(derives.length).toBeGreaterThanOrEqual(2);
    for (const arg of derives) expect(arg).toBe('state.planetRadiusEarth');
  });

  it('the crater-boot site is the ONLY deriveConditionVector call still fed a canonical radius', () => {
    // Belt and braces on the allowlist: exactly one canonical-fed derivation, and it is the one the
    // G2 sweep proved cannot change its answer.
    const canonicalFed = [...LAB.matchAll(/deriveConditionVector\([^)]*\)[^)]*\)/g)]
      .map((m) => m[0]).filter((s) => /_fp\.radiusEarth/.test(s));
    expect(canonicalFed.length).toBe(1);
    expect(canonicalFed[0]).toContain('driverUI.qualityTier');
  });
});
