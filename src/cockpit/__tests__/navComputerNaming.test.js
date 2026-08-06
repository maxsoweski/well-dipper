/**
 * The bare name `_navComputer` must not come back to `src/main.js`.
 *
 * Increment 7, `cockpit-into-helm-2026-07-30`, step 5 — the two-instance
 * mechanism. Supports AC-REAL-CATALOGUE-REACHES-THE-GLASS.
 *
 * ── WHY A TEXT SCAN, WHICH IS AN UNUSUAL SHAPE ──────────────────────────────
 *
 * There are two NavComputer instances now: the `#nav-computer-overlay` one and
 * the one drawn on the cockpit glass. Nothing about the TYPE distinguishes them
 * — same class, same methods, same everything — so no type check, no unit test
 * and no runtime assertion can catch a call site that reaches for the wrong one.
 * The only durable signal is the NAME, and a name is only a signal while the
 * ambiguous one is unavailable.
 *
 * The concrete failure this prevents was measured before the rename: with one
 * bare `_navComputer` in scope, `openNavComputer` and the snapshot feed and the
 * autopilot sequence all read it, and in HELM two of those three meant the other
 * instance. Re-introducing the bare name would not fail any test in the suite —
 * it would just quietly operate a nav computer nobody is looking at.
 *
 * A future session adding `_navComputer` back gets a red test with this header
 * rather than a green suite and a dead panel.
 *
 * ── THE EXEMPTION ───────────────────────────────────────────────────────────
 *
 * The doc block in main.js that STATES this rule has to spell the forbidden
 * name to state it. Those lines carry a literal `[NAMING-RULE]` tag and are the
 * only exemption. A new site cannot claim it by accident: tagging a line is a
 * deliberate act, and a tagged line that is not that doc block is visible in any
 * diff. The count is asserted too, so the exemption cannot silently grow.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAIN = resolve(HERE, '../../main.js');

/**
 * The bare name and nothing else.
 *
 * The negative lookahead is what keeps `_navComputerOpen` and `_navComputers`
 * out; the leading `[^A-Za-z0-9]` boundary is what keeps `_domNavComputer` and
 * `_cockpitNavComputer` out — those spell it `NavComputer`, capital N, which
 * this pattern's lowercase `_nav` cannot match anyway, but the boundary makes
 * the intent explicit rather than accidental.
 */
const BARE = /(^|[^A-Za-z0-9_])_navComputer(?![A-Za-z0-9_])/;

function scan(text) {
  const hits = [];
  text.split('\n').forEach((line, idx) => {
    if (BARE.test(line)) hits.push({ line: idx + 1, text: line.trim(), exempt: line.includes('[NAMING-RULE]') });
  });
  return hits;
}

describe('main.js names both nav computers explicitly', () => {
  const source = readFileSync(MAIN, 'utf8');

  it('CONTROL: the scanner actually finds the bare name', () => {
    // Without this the whole file could pass by scanning nothing — the failure
    // mode this program has named "a test that could not fail". Five shapes,
    // including the ones the real file contains.
    expect(scan('  if (_navComputer) doThing();')).toHaveLength(1);
    expect(scan('let _navComputer = null;')).toHaveLength(1);
    expect(scan('  _navComputer.setCurrentBody(1, 2);')).toHaveLength(1);
    expect(scan('  nav._navComputer = x;')).toHaveLength(1);
    expect(scan('// the `_navComputer` is gone')).toHaveLength(1);
  });

  it('CONTROL: the scanner does not fire on the names that replaced it', () => {
    expect(scan('let _domNavComputer = null;')).toHaveLength(0);
    expect(scan('_cockpitNavComputer = nav;')).toHaveLength(0);
    expect(scan('if (_navComputerOpen) closeNavComputer();')).toHaveLength(0);
    expect(scan('for (const nav of _navComputers()) {}')).toHaveLength(0);
    expect(scan('function _initNavComputer() {}')).toHaveLength(0);
  });

  it('has no un-exempt use of the bare name', () => {
    const hits = scan(source).filter((h) => !h.exempt);
    expect(
      hits,
      `src/main.js reaches for a bare \`_navComputer\`. There are two instances; ` +
      `say which — \`_domNavComputer\`, \`_cockpitNavComputer\`, or \`liveNavComputer()\`. ` +
      `Sites:\n${hits.map((h) => `  main.js:${h.line}  ${h.text}`).join('\n')}`,
    ).toEqual([]);
  });

  it('the exemption stays exactly the rule-stating doc block', () => {
    const exempt = scan(source).filter((h) => h.exempt);
    expect(exempt).toHaveLength(2);
    for (const h of exempt) expect(h.text.startsWith('//')).toBe(true);
  });

  it('both instances and the live selector exist', () => {
    // A rename that deleted the mechanism instead of building it would pass
    // every assertion above.
    expect(source).toContain('let _domNavComputer = null;');
    expect(source).toContain('let _cockpitNavComputer = null;');
    expect(source).toMatch(/function _navComputers\(\)/);
    expect(source).toMatch(/function liveNavComputer\(\)/);
    expect(source).toMatch(/function _applyCatalogsTo\(nav\)/);
  });

  it('the catalogue loaders fan out over the registry, not over one instance', () => {
    // The AC this step serves. Both loaders must push to every instance —
    // naming one is exactly the defect (`_realStarCatalog` null on the glass).
    const starLoader = source.slice(source.indexOf('realStarCatalog.load().then('), source.indexOf('// Load real feature catalog'));
    expect(starLoader).toContain('for (const nav of _navComputers()) nav.setRealStarCatalog(realStarCatalog);');

    const featureLoader = source.slice(source.indexOf('realFeatureCatalog.load().then('));
    const featureBody = featureLoader.slice(0, featureLoader.indexOf('});'));
    expect(featureBody).toContain('for (const nav of _navComputers()) nav.setRealFeatureCatalog(realFeatureCatalog);');
  });

  it('the cockpit factory registers its instance and pulls the catalogues', () => {
    const factory = source.slice(source.indexOf('makeNav: (surface) => {'));
    const body = factory.slice(0, factory.indexOf('  },'));
    expect(body).toContain('_cockpitNavComputer = nav;');
    expect(body).toContain('_applyCatalogsTo(nav);');
  });
});
