// NavComputer real-star merge — KEY assignment (naming-prism-segments AC-2,
// plan §3.2: "real and catalogue objects get their own stable identity").
//
// Where a catalogue star enters the PRISM rows (_queryYRange's real-star
// overlay) the row takes the catalogue key 'r:<name>@<x>,<y>,<z>' on BOTH
// branches: matched (it replaces a procedural row, whose (tier, cell) slot it
// must drop) and unmatched (appended as a new row). Same harness as
// NavComputer.merge.test.js: a bare Object.create'd instance with
// findStarsInPrism stubbed, so only the overlay branch runs.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NavComputer } from '../NavComputer.js';
import { HashGridStarfield } from '../../generation/HashGridStarfield.js';
import { starKey } from '../../generation/GalaxyGrid.js';

const PLAYER = { x: 8.0, y: 0.025, z: 0.0 };

function makeNav(realStars) {
  const nav = Object.create(NavComputer.prototype);
  nav._localStars = [];
  nav._loadedSeen = new Set();
  nav._loadedYMin = null;
  nav._loadedYMax = null;
  nav._loadBlockCenter = { x: PLAYER.x, z: PLAYER.z };
  nav._loadBlockHalf = 0.01;
  nav._playerX = PLAYER.x;
  nav._playerY = PLAYER.y;
  nav._playerZ = PLAYER.z;
  nav._realStarCatalog = { loaded: true, findInVolume: () => realStars };
  return nav;
}

// A procedural row as the PRISM loader builds it, carrying a (tier, cell) slot.
const procRow = (p, ident) => ({
  wx: p.x, wy: p.y, wz: p.z, name: 'Procgen', spectral: ident.tier, color: '#ff9664',
  seed: 4242, dist: 0.001, distPc: '1', ident, key: starKey(ident),
});

describe('NavComputer real-star merge assigns the catalogue key (AC-2)', () => {
  beforeEach(() => { vi.spyOn(HashGridStarfield, 'findStarsInPrism').mockReturnValue([]); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('MATCHED: the replaced row takes the catalogue key and drops the procedural slot', () => {
    const rs = { x: 7.998231, y: 0.024592, z: -0.001913, name: 'Sirius', spect: 'A' };
    const nav = makeNav([rs]);
    const ident = { tier: 'K', cx: 4443, cy: 13, cz: -2 };
    nav._localStars.push(procRow({ x: rs.x + 0.0005, y: rs.y, z: rs.z }, ident));

    nav._queryYRange(rs.y - 0.005, rs.y + 0.005);

    expect(nav._localStars).toHaveLength(1);
    const s = nav._localStars[0];
    expect(s.isReal).toBe(true);
    expect(s.key).toBe('r:Sirius@7.998231,0.024592,-0.001913');
    expect(s.key).not.toBe(starKey(ident));
    expect(s.ident).toBeNull();
  });

  it('UNMATCHED: the appended row carries the catalogue key', () => {
    const rs = { x: 8.05, y: 0.03, z: 0.04, name: 'TRAPPIST-1', spect: 'M' };
    const nav = makeNav([rs]);
    nav._queryYRange(rs.y - 0.005, rs.y + 0.005);
    expect(nav._localStars[0].key).toBe('r:TRAPPIST-1@8.05,0.03,0.04');
  });

  it('one catalogue star gets the same key on both branches; same-named entries at different positions do not share one', () => {
    const rs = { x: 8.11, y: -0.02, z: 0.033, name: 'Guniibuu', spect: 'K' };
    const navU = makeNav([rs]);
    navU._queryYRange(rs.y - 0.005, rs.y + 0.005);
    const navM = makeNav([rs]);
    navM._localStars.push(procRow({ x: rs.x + 0.0005, y: rs.y, z: rs.z - 0.0005 }, { tier: 'G', cx: 1, cy: 2, cz: 3 }));
    navM._queryYRange(rs.y - 0.005, rs.y + 0.005);
    expect(navM._localStars[0].key).toBe(navU._localStars[0].key);

    // HYG really has 12 names used twice (e.g. 'Iot Cnc'); the key keeps them apart.
    const a = makeNav([{ x: 7.92155, y: 0.08545, z: -0.022322, name: 'Iot Cnc', spect: 'G' }]);
    const b = makeNav([{ x: 7.933891, y: 0.075929, z: -0.018801, name: 'Iot Cnc', spect: 'A' }]);
    a._queryYRange(0.07, 0.09);
    b._queryYRange(0.07, 0.09);
    expect(a._localStars[0].key).not.toBe(b._localStars[0].key);
  });
});
