/**
 * _captureAuthoredParent — S1 baseline-capture helper for
 * multistar-components-2026-07-19 (build-plan S1, fable M4/M5/N4).
 *
 * Captures the PRE-INCREMENT authored outputs S3's additivity/byte-unchanged
 * guards deep-compare against:
 *   - authored-parent-baseline.json — Alpha Centauri via generateAuthoredSystem
 *     (the far-bearing parent; S3 compares it minus the componentSystems key)
 *   - sirius-baseline.json — Sirius via the REAL arrival pipeline
 *     (a non-far authored row; S3 compares it verbatim — AC1 'byte-unchanged')
 *
 * MUST be run at the post-S1 / pre-S2 tree (StarSystemGenerator untouched ⇒
 * authored output byte-identical to dc0f3c5). SELF-GUARD (fable N4): refuses to
 * write if a capture carries componentSystems — so a post-S2 re-run cannot
 * silently overwrite the baselines with wrong ones.
 *
 * S3's tests import buildAlphaCenBaseline/buildSiriusBaseline from THIS module,
 * so fixture and test share one construction — recipe drift is impossible.
 *
 * Run from the repo dir:  node src/generation/__tests__/_captureAuthoredParent.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { KnownSystems } from '../KnownSystems.js';
import { generateAuthoredSystem } from '../KnownSystemAuthoring.js';
import { RealSystemOverlay } from '../RealSystemOverlay.js';
import { GalacticMap } from '../GalacticMap.js';
import { StarSystemGenerator } from '../StarSystemGenerator.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WS_DIR = join(HERE, '../../../docs/WORKSTREAMS/multistar-components-2026-07-19');

// JSON round-trip — fixtures are parsed JSON, so both sides of every S3
// deep-equal must round-trip (the arrivalResolution.test.js rt idiom).
const rt = (o) => JSON.parse(JSON.stringify(o));

/** Alpha Centauri exactly as the authored registry generates it (fallback map). */
export function buildAlphaCenBaseline() {
  const entry = KnownSystems.getAll().find((k) => k.name === 'Alpha Centauri');
  return rt(generateAuthoredSystem(entry, null));
}

/**
 * Sirius through the REAL arrival pipeline — the exact AC4(c) construction from
 * RealSystemOverlay.pipeline.test.js (real shipped ingest off disk, ctx built
 * as the main.js call sites build it, seed 'sirius-ac4').
 */
export function buildSiriusBaseline() {
  const DATA = (name) => join(HERE, '../../../public/assets/data', name);
  const contents = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));
  const supplement = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
  const hyg = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));
  const ov = new RealSystemOverlay({
    contentsHosts: contents.hosts,
    supplementStars: supplement.stars,
    catalogStars: hyg.concat(supplement.stars),
  });
  const ctx = new GalacticMap('well-dipper-galaxy-1')
    .deriveGalaxyContext({ x: 8.0, y: 0.025, z: -0.001 });
  ctx.starTypeOverride = 'A'; // Sirius catalog spect
  ov.applyToContext(ctx, 'Sirius');
  return rt(StarSystemGenerator.generate('sirius-ac4', ctx));
}

function refuseIfComponentBearing(label, sys) {
  if ('componentSystems' in sys) {
    console.error(
      `[capture] REFUSING: ${label} capture carries a componentSystems key — ` +
      'this tree is post-S2; baselines must be captured at the pre-S2 tree ' +
      '(fable N4 self-guard).'
    );
    process.exit(1);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const alphaCen = buildAlphaCenBaseline();
  refuseIfComponentBearing('Alpha Centauri', alphaCen);
  const sirius = buildSiriusBaseline();
  refuseIfComponentBearing('Sirius', sirius);

  writeFileSync(join(WS_DIR, 'authored-parent-baseline.json'), JSON.stringify(alphaCen, null, 2) + '\n');
  writeFileSync(join(WS_DIR, 'sirius-baseline.json'), JSON.stringify(sirius, null, 2) + '\n');
  console.log('[capture] wrote authored-parent-baseline.json (Alpha Centauri) + sirius-baseline.json');
}
