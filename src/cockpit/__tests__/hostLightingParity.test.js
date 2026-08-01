/**
 * AC-ONE-RIG-TWO-HOSTS, the LIGHTING half — and this file exists because the
 * divergence it guards actually happened, twice, in the session that built the
 * feature.
 *
 * ── WHY THE EXISTING BOUNDARY TESTS DO NOT CATCH THIS ───────────────────────
 *
 * `CockpitRig.test.js` pins what the RIG owns, and the rig genuinely does own
 * the lights and the glass. It cannot catch either failure below, because
 * neither is a wrong value in the rig:
 *
 * 1. **AN ABSENT CALL.** `rig.setStarLight` aims the key light at the system's
 *    star. `src/main.js` calls it every frame. If `cockpit-screens-lab.html`
 *    does not, the lab keeps the authored default direction forever and the two
 *    hosts render visibly different cabins — while every assertion about
 *    `DEFAULT_COCKPIT_LIGHTS` stays green, because the defaults ARE identical.
 *    The divergence is the call, not the value. This was the state of the lab
 *    for the first half of the lighting work.
 *
 * 2. **TWO NUMBERS TYPED BESIDE EACH OTHER.** The canopy's albedo ships in
 *    `DEFAULT_GLASS.glare.color`; the lab's GLASS GLOW slider opens on its own
 *    `value=` in the markup. Those started out disagreeing — 0x2e3a4a in the rig
 *    against a neutral 0.29 in the lab — so the lab showed a neutral canopy and
 *    the game a blue-tinted one. Caught by reading a probe, not by a test, which
 *    is the argument for this file.
 *
 * ⚠ A SOURCE SCAN, because the lab is a 4,000-line HTML page that builds a WebGL
 * renderer and a GalacticMap at load. Same standing reason as
 * `mainPointerRouting.test.js`. It proves the two hosts AGREE, not that either
 * looks right — that is the live pass's job, and the lab's own star sweep is now
 * the fast way to do it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DEFAULT_GLASS } from '../CockpitRig.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = readFileSync(resolve(HERE, '../../../cockpit-screens-lab.html'), 'utf8');
const MAIN = readFileSync(resolve(HERE, '../../main.js'), 'utf8');

/** Code only. Both files describe this feature at length in prose. */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');

describe('both hosts drive the cockpit lighting, not just one', () => {
  it('CONTROL: the strip helper really removes prose, or every scan below reads comments', () => {
    // Both files contain `setStarLight` inside explanatory comments. Without
    // this the two assertions that follow would pass against a host that only
    // TALKS about aiming the key light. That exact failure — a guard green on a
    // comment quoting the code it hunts — has happened twice in this lane.
    expect(strip('/* setStarLight */')).not.toMatch(/setStarLight/);
    expect(strip('  // setStarLight\n')).not.toMatch(/setStarLight/);
    expect(strip('<!-- setStarLight -->')).not.toMatch(/setStarLight/);
    expect(strip('rig.setStarLight({})')).toMatch(/setStarLight/);
  });

  it('the GAME aims the key light at the real star', () => {
    const src = strip(MAIN);
    expect(src, 'main.js no longer feeds starLight into rig.update').toMatch(/starLight:\s*_cockpitStarLight\(\)/);
    expect(src, 'the frame transform must come from the shared module, not be re-derived here')
      .toMatch(/starDirInCockpit\(/);
  });

  it('the LAB aims it too, or the two hosts light differently with every value equal', () => {
    const src = strip(LAB);
    expect(src, 'the lab never calls setStarLight — it would keep the authored default forever')
      .toMatch(/setStarLight\(/);
    // ...and drives it from a control, rather than setting it once to a constant
    // that happens to match. A star that cannot move cannot show what a turn
    // does to the cabin, which is the whole feature.
    expect(src, 'the lab has no star control').toMatch(/dStarAz/);
  });

  it('the lab\'s GLASS GLOW slider OPENS on the value the rig ships', () => {
    // The failure this pins: the lab applies its own slider default over the
    // rig's on load, so whatever the markup says IS what the lab shows. If that
    // disagrees with DEFAULT_GLASS, the two hosts differ from the first frame
    // and nothing anywhere says so.
    const m = LAB.match(/id="dGlassGlare"[^>]*value="([\d.]+)"/);
    expect(m, 'the GLASS GLOW slider or its value attribute was renamed — this scan is stale').toBeTruthy();
    const labLevel = Number(m[1]);

    const c = DEFAULT_GLASS.glare.color;
    const [r, g, b] = [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    // Neutral is itself part of the contract — the tint is the star's job — so a
    // tinted default would make "the same level" ambiguous between channels.
    expect(r, 'DEFAULT_GLASS.glare.color must stay neutral grey').toBe(g);
    expect(g).toBe(b);
    expect(labLevel, `lab opens at ${labLevel}, rig ships ${(r / 255).toFixed(2)}`)
      .toBeCloseTo(r / 255, 2);
  });
});
