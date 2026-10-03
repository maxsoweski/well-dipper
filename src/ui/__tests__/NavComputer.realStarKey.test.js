// NavComputer real-star merge — KEY assignment (naming-prism-segments AC-2,
// plan §3.2: "real and catalogue objects get their own stable identity").
//
// Where a catalogue star enters the PRISM rows (the slab loader, src/ui/prismLoader.js,
// since Phase 3) the row takes the catalogue key 'r:<name>@<x>,<y>,<z>' on BOTH
// branches: matched (it replaces its procedural twin, whose (tier, cell) slot
// must not survive in the rows) and unmatched (appended as a new row). Harness:
// helpers/loaderHarness.mjs — a bare instance, the hash grid and catalogue stubbed.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { starKey } from '../../generation/GalaxyGrid.js';
import { loaderNav, loadAll, stubGrid, proc, prismLoadScheduler } from './helpers/loaderHarness.mjs';

describe('the slab loader assigns the catalogue key to a real star (AC-2)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('MATCHED: the real row takes the catalogue key and its twin\'s procedural slot is gone', () => {
    const rs = { x: 7.998231, y: 0.024592, z: -0.001913, name: 'Sirius', spect: 'A' };
    const ident = { tier: 'K', cx: 4443, cy: 13, cz: -2 };
    stubGrid([proc(rs.x + 0.0005, rs.y, rs.z, ident)]);
    const nav = loaderNav({ ...rs, realStars: [rs] });
    loadAll(nav);

    expect(nav._localStars).toHaveLength(1);
    const s = nav._localStars[0];
    expect(s.isReal).toBe(true);
    expect(s.key).toBe('r:Sirius@7.998231,0.024592,-0.001913');
    expect(nav._localStars.some((r) => r.key === starKey(ident))).toBe(false);
    expect(s.ident).toBeNull();
  });

  it('UNMATCHED: the appended row carries the catalogue key', () => {
    const rs = { x: 8.0021, y: 0.03, z: 0.0011, name: 'TRAPPIST-1', spect: 'M' };
    stubGrid([]);
    const nav = loaderNav({ ...rs, realStars: [rs] });
    loadAll(nav);
    expect(nav._localStars[0].key).toBe('r:TRAPPIST-1@8.0021,0.03,0.0011');
  });

  it('one catalogue star gets the same key on both branches; same-named entries at different positions do not share one', () => {
    const rs = { x: 8.0011, y: -0.02, z: 0.0013, name: 'Guniibuu', spect: 'K' };
    stubGrid([]);
    const navU = loaderNav({ ...rs, realStars: [rs] });
    loadAll(navU);
    vi.restoreAllMocks();
    stubGrid([proc(rs.x + 0.0005, rs.y, rs.z - 0.0005, { tier: 'G', cx: 1, cy: 2, cz: 3 })]);
    const navM = loaderNav({ ...rs, realStars: [rs] });
    loadAll(navM);
    expect(navM._localStars[0].key).toBe(navU._localStars[0].key);

    // HYG really has 12 names used twice (e.g. 'Iot Cnc'); the key keeps them apart.
    const g = { x: 7.92155, y: 0.08545, z: -0.022322, name: 'Iot Cnc', spect: 'G' };
    const a = { x: 7.933891, y: 0.075929, z: -0.018801, name: 'Iot Cnc', spect: 'A' };
    const na = loaderNav({ ...g, realStars: [g, a] }); loadAll(na);
    const nb = loaderNav({ ...a, realStars: [g, a] }); loadAll(nb);
    expect(na._localStars.find((r) => r.name === 'Iot Cnc').key).not.toBe(nb._localStars.find((r) => r.name === 'Iot Cnc').key);
  });

  it('two same-name catalogue records in ONE column both become rows, in either order, and a reload adds neither again', () => {
    // ⛔ Astra 2026-10-02 finding 3: the seen-set gate was `real-${name}`, so the second same-name
    //    record in a block never loaded. (The two real 'Iot Cnc' records are in neighbouring 7.8 pc
    //    columns, so this pair is placed inside ONE column, at different positions.)
    const g = { x: 8.0011, y: 0.08545, z: -0.0022, name: 'Iot Cnc', spect: 'G' };
    const a = { x: 8.0031, y: 0.075929, z: 0.0018, name: 'Iot Cnc', spect: 'A' };
    stubGrid([]);
    for (const order of [[g, a], [a, g]]) {
      const nav = loaderNav({ ...g, realStars: order });
      loadAll(nav);
      expect(nav._localStars.map((s) => s.key).sort()).toEqual([
        'r:Iot Cnc@8.0011,0.08545,-0.0022', 'r:Iot Cnc@8.0031,0.075929,0.0018']);
      nav.jumpToSlab('S20'); prismLoadScheduler.drain(); nav.jumpToSlab('N1');
      loadAll(nav);
      expect(nav._localStars).toHaveLength(2);
    }
  });
});
