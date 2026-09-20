/**
 * nav-restorations-2026-09-20 — WAVE 2b, THE LAB LANE: AC-4's PAINT and HOVER rows.
 *
 * Everything asserted here is drawn in `nav-240p-lab.html` and reaches the game through
 * `scripts/extract-nav-designs.mjs` (`--check` is the audit that the two have not parted).
 *
 *   AC-4 paint   with `S.sysView === 'planet'` and `S.detailPlanet === i`, design 1's SYSTEM pane is
 *                that planet's MOON LADDER (the planet at the head, its moons at stops by orbit
 *                radius, each with `<parent tag><ordinal>` and its name, the selected one framed),
 *                its rail lists the planet then its moons and its detail block prints the selected
 *                moon's facts; design 2's pane is that planet's MOON ORRERY (the planet at the
 *                centre, a ring and a pip per moon at its own `startAngle`, names, the selected one
 *                framed, the wave-2a zoom still applied and its gauge still drawn). The ship and its
 *                trajectory are suppressed in both. Every moon is published into `S.bodyHits` with
 *                `{ type:'moon', planetIndex, moonIndex, row }` and its OWN row in `ref` — NOT the
 *                collapse-to-parent identity the whole-system picture uses.
 *   AC-4 hover   `calloutLines` gains a MOON branch, so a hover the DRIVER publishes as
 *                `kind:'body'` / `ref.type:'moon'` paints a plate naming the moon.
 *
 * ── ⭐ HOW THIS FILE READS THE GLASS ────────────────────────────────────────────────────────────
 *
 * Waves 1a/1b/2a's two instruments, unchanged (`navDefects2026.design.test.js:75-116` explains them
 * at length): an ink RECORDING CONTEXT (a Proxy whose `set` is honoured, so a fill's colour
 * survives) and a `drawPixelText` WRAPPER that records the post-`fit()` string the face was handed.
 * Every string in these designs is drawn as fillRects, so without the wrapper a scrape of the
 * context finds no text however much writing is on the screen.
 *
 * ⛔ IT IS THE SHIPPED `S` / `D`, NOT A FIXTURE — `paint()` repaints the very pair the driver has
 *    just rendered from.
 * ⛔ AND THE TWO SUB-VIEW FIELDS ARE SET DIRECTLY ON `S`, WHICH IS STATED RATHER THAN HIDDEN. The
 *    DRIVER owns every transition into and out of the sub-view (SEAM §2) and is building them in
 *    this same wave; this lane owns the PAINT. So each case below renders the real nav, then writes
 *    `drv.S.sysView = 'planet'` and `drv.S.detailPlanet = <i>` — the exact pair the driver will
 *    write — and paints. What is NOT proved here is that a click gets you into this picture; that is
 *    the driver lane's file, and the two meet at these two fields and at `S.bodyHits`.
 * ⛔ THE SELECTION GOES IN THROUGH THE HOST'S OWN FIELD (`nav._selectedBody` + `_buildCommitAction`)
 *    and is then RENDERED, so `D.selBody` is whatever `state.js` really makes of it — which is also
 *    how this file proves a `{type:'moon', planetIndex, moonIndex}` pick survives the adapter.
 *
 * ── ⛔ THE BEFORE/AFTER FRAME HASHES ARE A MEASUREMENT, NOT A CONSTANT IN THIS FILE ─────────────
 *
 * FNV-1a over the whole fillRect stream (coordinates and ink), 417x240, painted over the SAME `S`/`D`
 * by HEAD's `designs.js` (wave 2a) and by this wave's, pointer parked outside the pane, zoom 1,
 * `S.sysView` at its default, measured 2026-09-20:
 *
 *   D1 L0 5fef3d04 · L1 57057542 · L2 161c4bb5 · L3 00b85a16 · L4 9a608571   IDENTICAL
 *   D2 L0 7732510f · L1 d3d52f9f · L2 fdd2f7ba · L3 7ca714df · L4 9ef52207   IDENTICAL
 *
 *   (D1's first four are the very numbers wave 2a recorded for its own no-change levels, which is a
 *    second reading of the same invariant a wave apart.)
 *
 *   — so the `ladderAxis` lift (design 1's separation pass becomes the function the MOON ladder also
 *     calls) and the six new `sysDetail()` branches move not one texel of the whole-system picture.
 *
 * A checked-in hash is NOT the guard, for the reason all three earlier waves give: several lanes are
 * mutating this tree at once and a hash that goes red on another lane's correct work is a guard that
 * gets switched off. What is durable is the INVARIANT the measurement was for, and the first case
 * below hashes three frames inside ONE run and needs no constant: the whole-system picture before
 * the sub-view, the sub-view, and the whole-system picture after it.
 */
import { describe, it, expect } from 'vitest';
import { makeHeadlessNav, makeRecordingContext, clickAt } from './helpers/headlessNav.mjs';
import { makeDesigns } from '../navViewModes/designs.js';
import { FACE, drawPixelText, measurePixelText } from '../../rendering/PixelText.js';

const W = 417, H = 240;                 // Max's window, and the buffer every number here is for
const INK_SHIP = '#00ff80';             // designs.js's INK.SHIP — legacy's own diamond colour

/** A 2D context that records each fill's RECTANGLE AND ITS INK — wave 1a's own note says why. */
function inkRecordingContext() {
  const fills = [];
  const base = { fillStyle: '#000', imageSmoothingEnabled: false };
  const ctx = new Proxy(base, {
    get(t, k) {
      if (k === 'fillRect') return (x, y, w, h) => fills.push({ x, y, w, h, ink: t.fillStyle });
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
    has() { return true; },
  });
  return { ctx, fills };
}

/** FNV-1a over the whole fill stream, coordinates AND ink — one number per frame. */
function frameHash(fills) {
  let h = 0x811c9dc5;
  for (const f of fills) {
    for (const c of `${f.x},${f.y},${f.w},${f.h},${f.ink};`) {
      h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}

/** Repaint this frame's `S` / `D` through a recording face. */
function paint(nav, design) {
  const { S, D } = nav._viewDriverInst;
  const lines = [], viol = [];
  const { ctx, fills } = inkRecordingContext();
  const d = makeDesigns({
    S, D, onViolation: (l) => viol.push(l), face: FACE, measurePixelText,
    drawPixelText: (g, s, x, y, opts) => { lines.push({ s: String(s), x, y, color: opts?.color });
                                           return drawPixelText(g, s, x, y, opts); },
  });
  S.design = design;
  d.resetRegions(); d.resetViolations();
  if (design === 1) d.drawDesign1(ctx, W, H); else d.drawDesign2(ctx, W, H);
  return { fills, lines, viol, violations: d.violations(), regions: d.regions(), S, D,
           hash: frameHash(fills), text: lines.map((l) => l.s).join('\n') };
}

/**
 * ⛔ THE MOONS CARRY `orbitRadiusEarth`, `startAngle`, `type` AND `radiusEarth`, which the earlier
 *    waves' fixtures did not — those four are the whole content of this sub-view, and
 *    `buildBodies` copies NONE of them onto a `D.bodies` moon row (a moon row's `au` is its
 *    PARENT's, by design). The orbits are deliberately out of index order on planet 4 so "ordered by
 *    orbit radius" cannot pass by accident, and the angles are spread so two moons never coincide.
 */
const moonsFor = (n, seed = 0) => Array.from({ length: n }, (_, j) => ({
  type: ['ROCK', 'ICE', 'CAPTURED'][j % 3], radiusEarth: 0.12 + j * 0.03, T_eq: 90 + j,
  orbitRadiusEarth: 12 + ((j * 37 + seed * 11) % 90), startAngle: (j * 0.97 + seed * 0.3) % 6.28,
}));
const SYSTEM_DATA = {
  star: { type: 'G', radiusSolar: 1.0 }, ageGyr: 4.6, isBinary: false,
  zones: { hzInnerAU: 0.9, hzOuterAU: 1.4 },
  asteroidBelts: [{ centerRadiusAU: 2.7, widthAU: 1.2 }, { centerRadiusAU: 44, widthAU: 20, isKuiper: true }],
  planets: [0.39, 0.72, 1.0, 1.52, 5.2, 9.5, 19.2, 30.1].map((au, i) => ({
    orbitRadiusAU: au, orbitAngle: i * 0.8,
    moons: moonsFor(i === 4 ? 4 : i === 5 ? 3 : i === 2 ? 1 : 0, i),
    planetData: { radiusEarth: i >= 4 ? 6 + i : 1, T_eq: 400 - i * 40,
                  type: i >= 4 ? 'gas giant' : 'rocky',
                  habitability: { score: i === 2 ? 0.9 : 0.1 }, rings: i === 5 },
  })),
};
const MOONY = 4;                        // the planet these cases open: four moons, index 4

/** The same system with ONE planet whose moon count is `n` — the 1 / 4 / 12 guard sweep. */
const systemWithMoons = (n) => ({
  ...SYSTEM_DATA,
  planets: SYSTEM_DATA.planets.map((p, i) => (i === MOONY ? { ...p, moons: moonsFor(n, 1) } : p)),
});

async function loadedNav() {
  const h = await makeHeadlessNav({ width: W, height: H });
  h.nav._viewModesEnabled = true;
  h.nav._levelIndex = 3;
  h.nav.viewMode = 'rail';
  h.nav.render();
  return h;
}

/** Put the nav at a level, in a mode, standing on the system star — wave 2a's own `at`. */
async function at(h, mode, level, { system = SYSTEM_DATA, current = true } = {}) {
  h.nav.viewMode = mode;
  h.nav._systemZoom = 1;
  if (level === 4) {
    h.nav._systemStar = h.nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
    if (current && h.nav._systemStar) {
      h.nav._playerX = h.nav._systemStar.wx; h.nav._playerY = h.nav._systemStar.wy;
      h.nav._playerZ = h.nav._systemStar.wz;
    } else if (h.nav._systemStar) h.nav._playerX = h.nav._systemStar.wx + 0.5;
    h.nav._systemData = system;
    h.nav._levelIndex = 4;
  } else h.nav._levelIndex = level;
  h.nav._mouseX = -99; h.nav._mouseY = -99;
  h.nav.render();
  return h.nav;
}

/** Open the sub-view on `pIdx` by writing the DRIVER's own two fields — see the header. */
function openDetail(nav, pIdx = MOONY) {
  const S = nav._viewDriverInst.S;
  S.sysView = 'planet'; S.detailPlanet = pIdx;
  return S;
}
function closeDetail(nav) {
  const S = nav._viewDriverInst.S;
  S.sysView = 'system'; S.detailPlanet = -1;
  return S;
}
/** Select a moon through the HOST's own field, exactly as the driver will, then re-render. */
function selectMoon(nav, planetIndex, moonIndex) {
  nav._selectedBody = { type: 'moon', planetIndex, moonIndex };
  nav._commitAction = nav._buildCommitAction();
  nav.render();
  return nav;
}
/** The strings drawn inside a named region this frame. */
const inRegion = (p, name) => {
  const r = p.regions[name];
  return p.lines.filter((l) => r && l.x >= r.x && l.x < r.x + r.w && l.y >= r.y && l.y < r.y + r.h);
};
const moonHits = (S) => (S.bodyHits || []).filter((z) => z.type === 'moon');

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE WHOLE-SYSTEM PICTURE, AND EVERY OTHER LEVEL, IS UNTOUCHED
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-4 — the sub-view is a branch, not a change to the pictures Max ruled on', () => {
  it('⛔ EVERY LEVEL OF BOTH DESIGNS HASHES THE SAME BEFORE AND AFTER A SUB-VIEW, and only SYSTEM '
   + 'changes while one is open', async () => {
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      for (const level of [0, 1, 2, 3, 4]) {
        const nav = await at(h, mode, level);
        closeDetail(nav);
        const before = paint(nav, design);
        openDetail(nav);
        const open = paint(nav, design);
        closeDetail(nav);
        const after = paint(nav, design);
        expect(after.hash, `D${design} L${level} after a sub-view`).toBe(before.hash);
        if (level === 4) {
          expect(open.hash, `D${design} SYSTEM must DRAW the sub-view`).not.toBe(before.hash);
        } else {
          expect(open.hash, `D${design} L${level} must not know the sub-view exists`).toBe(before.hash);
        }
        expect(before.violations + open.violations + after.violations,
               `D${design} L${level} mark guard`).toBe(0);
      }
    }
  });

  it('⛔ AND `sysDetail` REFUSES A PLANET WITH NO MOONS — the state the driver refuses to enter, '
   + 'stated twice because the paint has to stand up on the lab page too', async () => {
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(h, mode, 4);
      closeDetail(nav);
      const whole = paint(nav, design);
      openDetail(nav, 0);                       // planet 0 has no moons in the fixture
      expect(paint(nav, design).hash, `D${design} opened on a moonless planet`).toBe(whole.hash);
      openDetail(nav, 99);                      // and an index that names no row at all
      expect(paint(nav, design).hash, `D${design} opened on nothing`).toBe(whole.hash);
      closeDetail(nav);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// DESIGN 1 — THE MOON LADDER AND ITS RAIL
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-4 — design 1 draws the moon ladder', () => {
  it('⛔ THE PARENT IS AT THE HEAD, THE MOONS ARE AT STOPS BY ORBIT RADIUS, AND EACH CARRIES ITS '
   + 'PARENT LETTER PLUS AN ORDINAL AND ITS NAME', async () => {
    const h = await loadedNav();
    const nav = await at(h, 'rail', 4);
    openDetail(nav);
    const p = paint(nav, 1);
    const { S, D } = nav._viewDriverInst;
    const parent = D.bodies.find((b) => b.kind === 'planet' && b.pIdx === MOONY);
    const moons = D.bodies.filter((b) => b.kind === 'moon' && b.pIdx === MOONY)
                          .sort((a, b) => a.mIdx - b.mIdx);
    expect(moons.length, 'the fixture must give this planet four moons').toBe(4);

    // the axis: one stop for the parent plus one per moon, in ORBIT order, left to right
    expect(S.ladderStops.length).toBe(1 + moons.length);
    const src = nav._systemData.planets[MOONY].moons;
    const byOrbit = moons.slice().sort((a, b) => src[a.mIdx].orbitRadiusEarth - src[b.mIdx].orbitRadiusEarth);
    expect(byOrbit.map((m) => m.mIdx), 'the fixture is deliberately not already orbit-ordered')
      .not.toEqual(moons.map((m) => m.mIdx));
    const hits = moonHits(S);
    expect(hits.length).toBe(moons.length);
    const xs = byOrbit.map((m) => hits.find((z) => z.moonIndex === m.mIdx).x);
    expect(xs.slice(1).every((x, i) => x > xs[i]), `stops ${xs} must climb with orbit radius`).toBe(true);

    // the parent sits LEFT of every moon — it is the head of this axis
    const head = (S.bodyHits || []).find((z) => z.ref === parent && !(z.moon >= 0));
    expect(head, 'the parent is published as its own planet hit').toBeTruthy();
    expect(Math.min(...hits.map((z) => z.x))).toBeGreaterThan(head.x);

    // one tag per body: the parent's letter, then that letter + b, c, d, e
    const map = inRegion(p, 'map').map((l) => l.s);
    const ptag = map.find((s) => s.length === 1);
    expect(ptag, 'the parent keeps its whole-system ladder letter').toBeTruthy();
    for (const ord of ['b', 'c', 'd', 'e'].slice(0, moons.length)) {
      expect(map, `moon tag ${ptag}${ord}`).toContain(`${ptag}${ord}`);
    }
    // and every name, in the rail's own spelling
    for (const m of moons) expect(map, `moon name ${m.name}`).toContain(m.name.toUpperCase());
    expect(map, 'the parent is named too').toContain(parent.name.toUpperCase());
    expect(p.violations, 'mark guard').toBe(0);
  });

  it('⛔ EVERY MOON IS PUBLISHED AS A MOON — its own row in `ref`, and the four explicit fields — '
   + 'NOT the collapse-to-parent identity the whole-system ladder uses', async () => {
    const h = await loadedNav();
    const nav = await at(h, 'rail', 4);

    // the whole-system ladder: a pip carries its PARENT and no `type`
    closeDetail(nav); paint(nav, 1);
    const whole = (nav._viewDriverInst.S.bodyHits || []).filter((z) => z.moon >= 0);
    expect(whole.length, 'the whole-system ladder still draws pips').toBeGreaterThan(0);
    expect(whole.every((z) => z.ref && z.ref.kind === 'planet' && z.type === undefined),
           'unchanged: a pip is its parent, with no published type').toBe(true);

    // the sub-view: a moon IS the pick
    openDetail(nav); paint(nav, 1);
    const hits = moonHits(nav._viewDriverInst.S);
    expect(hits.length).toBe(4);
    for (const z of hits) {
      expect(z.planetIndex, 'planetIndex is the open planet').toBe(MOONY);
      expect(z.ref.kind, '`ref` is the MOON row, so `bodyIdentity` sees kind moon').toBe('moon');
      expect(z.ref.pIdx).toBe(MOONY);
      expect(z.ref.mIdx).toBe(z.moonIndex);
      expect(z.row).toBe(z.ref);
      expect(z.moon).toBe(z.moonIndex);
    }
    expect(hits.map((z) => z.moonIndex).sort(), 'all four, once each').toEqual([0, 1, 2, 3]);
  });

  it('⛔ THE SHIP AND ITS TRAJECTORY ARE SUPPRESSED, even with the ship parked at this very planet',
     async () => {
    const h = await loadedNav();
    const nav = await at(h, 'rail', 4);
    nav.setCurrentBody(MOONY, -1);
    nav.render();
    closeDetail(nav);
    const whole = paint(nav, 1);
    expect(whole.fills.some((f) => f.ink === INK_SHIP), 'wave 2a still draws it out here').toBe(true);
    openDetail(nav);
    const sub = paint(nav, 1);
    expect(sub.fills.some((f) => f.ink === INK_SHIP), 'and never inside the sub-view').toBe(false);
    expect(sub.lines.some((l) => l.s === 'SHIP')).toBe(false);
  });

  it('⛔ THE RAIL LISTS THE PLANET THEN ITS MOONS, PUBLISHES THOSE ROWS, AND THE DETAIL BLOCK PRINTS '
   + 'THE SELECTED MOON\'S FACTS — and the commit row arms for the moon', async () => {
    const h = await loadedNav();
    const nav = await at(h, 'rail', 4);
    selectMoon(nav, MOONY, 1);
    const { S, D } = nav._viewDriverInst;

    // the adapter carries a moon pick through unchanged — planetIndex AND moonIndex
    expect(D.selBody, 'state.js resolves the pick to the moon row').toBeTruthy();
    expect([D.selBody.kind, D.selBody.pIdx, D.selBody.mIdx]).toEqual(['moon', MOONY, 1]);

    openDetail(nav);
    const p = paint(nav, 1);
    const parent = D.bodies.find((b) => b.kind === 'planet' && b.pIdx === MOONY);
    const moons = D.bodies.filter((b) => b.kind === 'moon' && b.pIdx === MOONY)
                          .sort((a, b) => a.mIdx - b.mIdx);

    // ⛔ THE RAIL IS IN THE LADDER'S ORDER — orbit radius outward — because AC-20's rule is that the
    //    picture and the list call the same body the same thing and read the same way.
    const src0 = nav._systemData.planets[MOONY].moons;
    const byOrbit = moons.slice().sort((a, b) => src0[a.mIdx].orbitRadiusEarth - src0[b.mIdx].orbitRadiusEarth);
    expect(byOrbit.map((m) => m.mIdx), 'the fixture is deliberately not already orbit-ordered')
      .not.toEqual(moons.map((m) => m.mIdx));
    expect(S.railBodies, 'the drawn rows, index-aligned, published by the paint')
      .toEqual([parent, ...byOrbit]);
    const rail = inRegion(p, 'rail').map((l) => l.s);
    expect(rail[0], 'the header names what the list is now').toBe('MOONS');
    expect(rail[1], 'and counts the moons, not the system\'s bodies').toBe('4');
    // ⛔ THE ROWS ARE READ BY DRAW ORDER AND MATCHED BY TAG, NOT BY NAME. `generateMoonName` builds a
    //    moon's name off its PLANET's, so a `name.includes` test matches the parent's row as well as
    //    the moon's; the tag is the one string on a row that is unique to its body.
    const ptag = inRegion(p, 'map').map((l) => l.s).find((t) => t.length === 1);
    const drawn = rail.slice(2, 2 + S.railBodies.length);
    expect(drawn[0].startsWith(ptag + ' '), `row 0 "${drawn[0]}" is the planet`).toBe(true);
    S.railBodies.slice(1).forEach((m, i) => {
      const tag = ptag + 'bcdefghijkl'[m.mIdx];
      expect(drawn[i + 1].startsWith(tag), `row ${i + 1} "${drawn[i + 1]}" carries ${tag}`).toBe(true);
      expect(drawn[i + 1], `row ${i + 1} names its moon`).toContain(m.name.toUpperCase().slice(0, 6));
    });

    const sel = moons[1], src = nav._systemData.planets[MOONY].moons[1];
    const block = rail.join('\n');
    expect(block).toContain(sel.name.toUpperCase());
    expect(block, 'the moon\'s own type').toContain(src.type);
    expect(block, 'the moon\'s own radius').toContain(`RADIUS ${src.radiusEarth.toFixed(2)} EARTH`);
    expect(block, 'the moon\'s own orbit, in EARTH RADII — not its parent\'s AU')
      .toContain(`ORBIT  ${Math.round(src.orbitRadiusEarth)} R⊕`);
    // ⚠ THE PARENT'S NAME IS FITTED INTO A 25-CHARACTER RAIL, so the assertion is on the clause and
    //   as much of the name as the rail can hold — the string on the GLASS, not the one asked for.
    expect(block, 'and whose moon it is').toContain(`MOON OF ${parent.name.toUpperCase().slice(0, 8)}`);

    const commit = inRegion(p, 'commit').map((l) => l.s).join('\n');
    expect(commit, 'the commit row arms for the MOON').toContain(`BURN TO ${sel.name.toUpperCase()}`);
    expect(commit).toContain('ENTER');
    expect(nav._commitAction, 'and the host\'s own action is a moon burn')
      .toMatchObject({ target: 'moon', planetIndex: MOONY, moonIndex: 1 });
    expect(p.violations, 'mark guard').toBe(0);
  });

  it('⛔ THE HINT ROW NAMES THE WAY OUT, AND IT FITS UNCLIPPED', async () => {
    const h = await loadedNav();
    const nav = await at(h, 'rail', 4);
    closeDetail(nav);
    // ⛔⛔ `RIGHT CLICK BACK`, NOT `ESC BACK`, AND THE CHANGE IS A MEASUREMENT. This row said
    //    `ESC BACK` when it was written; the HOST lane then measured that the Escape KEY never
    //    reaches NavComputer at all (`_onKeyDown` :344-360 has no `Escape` clause), so it falls
    //    through to `main.js:13557` and CLOSES THE WHOLE OVERLAY — Max's own 2026-07-29 ruling.
    //    The right-click does exit (the canvas's `contextmenu` listener :336 → `handleEscape()` →
    //    the wave-2b fold at :1441 → `drv.onEscape()`), and `navAffordances.test.js` now probes
    //    exactly that route for this phrase. A row that named Esc would be the defect this
    //    workstream is named for, drawn by the fix for it.
    expect(paint(nav, 1).lines.some((l) => l.s.includes('RIGHT CLICK BACK')),
           'the whole-system row is unchanged').toBe(false);
    openDetail(nav);
    const p = paint(nav, 1);
    const hint = inRegion(p, 'hint').map((l) => l.s);
    expect(hint.some((s) => s.includes('RIGHT CLICK BACK')), 'the sub-view names the way out').toBe(true);
    expect(hint.some((s) => s.includes('SELECT A MOON'))).toBe(true);
    // ⛔ THE UNCLIPPED STRING, because `fit()` would hide an overflow by eating the end of the row —
    //    the very failure AC-3's own PRISM bar was measured into.
    const row = hint.find((s) => s.includes('RIGHT CLICK BACK'));
    expect(measurePixelText(row), `"${row}" must fit ${W - 2} texels unclipped`)
      .toBeLessThanOrEqual(W - 2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// DESIGN 2 — THE MOON ORRERY
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-4 — design 2 draws the moon orrery', () => {
  it('⛔ THE PLANET IS AT THE CENTRE, EACH MOON IS ON ITS OWN RING AT ITS OWN PHASE, AND THE '
   + 'SELECTED ONE IS FRAMED', async () => {
    const h = await loadedNav();
    const nav = await at(h, 'bars', 4);
    selectMoon(nav, MOONY, 2);
    openDetail(nav);
    const p = paint(nav, 2);
    const { S, D } = nav._viewDriverInst;
    const parent = D.bodies.find((b) => b.kind === 'planet' && b.pIdx === MOONY);
    const head = (S.bodyHits || []).find((z) => z.ref === parent && !(z.moon >= 0));
    const map = p.regions.map;
    expect(head.x, 'the planet is at the pane centre').toBe(Math.round(W / 2));
    expect(head.y).toBe(Math.round(map.y + map.h / 2));

    const hits = moonHits(S);
    expect(hits.length).toBe(4);
    const src = nav._systemData.planets[MOONY].moons;
    // ⭐ THE RADIUS ORDER IS THE ORBIT ORDER — the absolute fact, with no copy of `rOf` here.
    const byOrbit = hits.slice().sort((a, b) => src[a.moonIndex].orbitRadiusEarth - src[b.moonIndex].orbitRadiusEarth);
    const rad = byOrbit.map((z) => Math.hypot(z.x - head.x, (z.y - head.y) / Math.max(1e-6, Math.sin(nav._systemRotX ?? 0.43))));
    expect(rad.slice(1).every((r, i) => r > rad[i] - 1.5), `radii ${rad.map((r) => r.toFixed(1))}`).toBe(true);
    // ⭐ AND THE PHASES ARE THE MOONS' OWN: four different angles, not one shared parent angle.
    const ang = hits.map((z) => Math.round(Math.atan2(z.y - head.y, z.x - head.x) * 100));
    expect(new Set(ang).size, `phases ${ang} must be four distinct rays`).toBe(4);

    // the selected moon wears a 9x9 frame nothing else does
    const selHit = hits.find((z) => z.moonIndex === 2);
    const frames = p.fills.filter((f) => f.w === 9 && f.h === 1);
    expect(frames.some((f) => f.x === selHit.x - 4 && f.y === selHit.y - 4),
           'the selected moon is framed at its own drawn point').toBe(true);

    const names = inRegion(p, 'map').map((l) => l.s);
    const moons = D.bodies.filter((b) => b.kind === 'moon' && b.pIdx === MOONY);
    expect(moons.some((m) => names.includes(m.name.toUpperCase())), 'the moons are named').toBe(true);
    expect(p.violations, 'mark guard').toBe(0);
  });

  it('⛔ THE WAVE-2a ZOOM STILL SCALES THIS PICTURE AND ITS GAUGE IS STILL DRAWN; THE SHIP IS NOT',
     async () => {
    const h = await loadedNav();
    const nav = await at(h, 'bars', 4);
    nav.setCurrentBody(MOONY, -1);
    nav.render();
    openDetail(nav);
    const one = paint(nav, 2);
    const S = nav._viewDriverInst.S;
    const gauge1 = S.zoomGaugeRect;
    const head1 = (S.bodyHits || []).find((z) => !(z.moon >= 0) && z.ref?.kind === 'planet');
    expect(gauge1, 'AC-6\'s gauge stays in the sub-view').toBeTruthy();
    expect(one.fills.some((f) => f.ink === INK_SHIP), 'the ship is suppressed').toBe(false);

    // ⛔ 1.5, NOT 2 — MEASURED. `maxR` already budgets the outermost ring into the pane at zoom 1,
    //    so at 2 every moon's centre has left it and AC-19's cull (correctly) publishes none; the
    //    scaling has to be read where the picture is still on the glass.
    const inner = moonHits(S).reduce((m, z) => (Math.abs(z.x - head1.x) > Math.abs(m.x - head1.x) ? z : m));
    S.sysCam.zoom = 1.5;
    paint(nav, 2);
    const same = moonHits(S).find((z) => z.moonIndex === inner.moonIndex);
    expect(same, 'the moon read at zoom 1 is still on the pane at 1.5').toBeTruthy();
    const ratio = Math.abs(same.x - head1.x) / Math.abs(inner.x - head1.x);
    expect(ratio, `the orrery magnifies with S.sysCam.zoom (${ratio.toFixed(3)})`).toBeGreaterThan(1.4);
    expect(ratio).toBeLessThan(1.6);
    expect(S.zoomGaugeRect, 'and the gauge is published at the same track').toEqual(gauge1);
    S.sysCam.zoom = 1;
  });

  it('⛔ THE STATUS LINE NAMES THE OPEN PLANET AND THE WAY OUT, AND THE MOON\'S FACTS ONCE ONE IS '
   + 'PICKED — with the chip armed', async () => {
    const h = await loadedNav();
    const nav = await at(h, 'bars', 4);
    nav._selectedBody = null; nav._commitAction = null; nav.render();
    openDetail(nav);
    const D = nav._viewDriverInst.D;
    const parent = D.bodies.find((b) => b.kind === 'planet' && b.pIdx === MOONY);
    let bar = inRegion(paint(nav, 2), 'botbar').map((l) => l.s).join('\n');
    expect(bar).toContain(parent.name.toUpperCase());
    expect(bar).toContain('4 MOONS');
    expect(bar).toContain('RIGHT CLICK BACK');

    selectMoon(nav, MOONY, 3);
    openDetail(nav);
    const p = paint(nav, 2);
    bar = inRegion(p, 'botbar').map((l) => l.s).join('\n');
    const src = nav._systemData.planets[MOONY].moons[3];
    const moon = D.bodies.find((b) => b.kind === 'moon' && b.pIdx === MOONY && b.mIdx === 3);
    expect(bar).toContain(moon.name.toUpperCase());
    expect(bar).toContain(src.type);
    expect(bar).toContain(`${src.radiusEarth.toFixed(2)} R⊕`);
    expect(bar).toContain(`ORBIT ${Math.round(src.orbitRadiusEarth)} R⊕`);
    expect(bar, 'the way out survives the ` · ` truncation, which eats from the right')
      .toContain('RIGHT CLICK BACK');
    expect(p.S.chipRect.armed, 'the chip arms for the moon').toBe(true);
    expect(p.lines.some((l) => l.s === '[BURN]'), 'at home it is a burn').toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// THE MARK GUARD, AND THE HOVER CALLOUT
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-4 — the guard and the callout', () => {
  it('⛔ THE MARK GUARD IS SILENT IN THE SUB-VIEW AT 1, 4 AND 12 MOONS, IN BOTH DESIGNS, AND A '
   + 'ZOOM THAT PUSHES MOONS OFF THE PANE CULLS THEM RATHER THAN DRAWING OFF THE GLASS', async () => {
    const h = await loadedNav();
    for (const n of [1, 4, 12]) {
      for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
        const nav = await at(h, mode, 4, { system: systemWithMoons(n) });
        openDetail(nav);
        const p = paint(nav, design);
        expect(p.viol, `D${design} with ${n} moons`).toEqual([]);
        expect(moonHits(p.S).length, `D${design} publishes ${n} moons`).toBe(n);
      }
    }
    // ⭐ AC-19's rule at this design's new draw site: at zoom 5 the outer moons leave the pane.
    const nav = await at(h, 'bars', 4, { system: systemWithMoons(12) });
    openDetail(nav);
    nav._viewDriverInst.S.sysCam.zoom = 5;
    const zoomed = paint(nav, 2);
    expect(zoomed.viol, 'the guard stays silent at zoom 5').toEqual([]);
    expect(moonHits(zoomed.S).length, 'and the moons off the pane are neither drawn nor published')
      .toBeLessThan(12);
    nav._viewDriverInst.S.sysCam.zoom = 1;
  });

  it('⛔ A HOVER THE DRIVER PUBLISHES AS A MOON PAINTS A PLATE NAMING THE MOON — its own type, '
   + 'radius and orbit, not its parent\'s AU', async () => {
    const h = await loadedNav();
    for (const [mode, design] of [['rail', 1], ['bars', 2]]) {
      const nav = await at(h, mode, 4);
      openDetail(nav);
      const first = paint(nav, design);
      const S = first.S, D = first.D;
      const hit = moonHits(S).find((z) => z.moonIndex === 2);
      const row = D.bodies.find((b) => b.kind === 'moon' && b.pIdx === MOONY && b.mIdx === 2);
      // the shape SEAM §1 + the HOVER row give a sub-view moon hover
      S.hover = { level: 4, kind: 'body', sx: hit.x, sy: hit.y,
                  ref: { type: 'moon', index: 2, planetIndex: MOONY, moonIndex: 2, row } };
      const p = paint(nav, design);
      const src = nav._systemData.planets[MOONY].moons[2];
      expect(S.hoverCalloutRect, `D${design} drew a plate`).toBeTruthy();
      const map = p.regions.map;
      expect(S.hoverCalloutRect.x).toBeGreaterThanOrEqual(map.x);
      expect(S.hoverCalloutRect.x + S.hoverCalloutRect.w).toBeLessThanOrEqual(map.x + map.w);
      const txt = inRegion(p, 'map').map((l) => l.s);
      expect(txt, `D${design} names the moon`).toContain(row.name.toUpperCase());
      expect(txt).toContain(src.type);
      expect(txt).toContain(`${src.radiusEarth.toFixed(2)} R⊕`);
      expect(txt).toContain(`ORBIT ${Math.round(src.orbitRadiusEarth)} R⊕`);
      // ⛔ AND NOT THE PLANET'S CALLOUT: a moon has no moon count and no AU of its own.
      const parent = D.bodies.find((b) => b.kind === 'planet' && b.pIdx === MOONY);
      expect(txt, 'the parent\'s AU must not be on this plate')
        .not.toContain(`${(parent.au ?? 0).toFixed(2)} AU`);
      S.hover = null;
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// AC-4 END TO END — THE THREE HALVES MEET ON ONE INSTANCE
// ══════════════════════════════════════════════════════════════════════════════════════════════════
/**
 * Written by the WAVE-2b INTEGRATOR, not by one of the three lanes, and it is the only place in this
 * workstream where the LAB's paint, the DRIVER's routing and the HOST's fold are all load-bearing in
 * the same assertion. Each lane's own file proves its half against its own mutants and stops at the
 * seam; a walk that stops at the seam cannot see a seam that does not meet.
 *
 * ⛔ NO STUBS AND NO HAND-WRITTEN STATE. `openDetail` / `selectMoon` / `closeDetail` — the helpers
 *    every case above uses to write `S.sysView` and `nav._selectedBody` directly, because the driver
 *    was being written in parallel — are FORBIDDEN here. Every transition below comes out of a real
 *    `_handleMouseMove` + `clickAt`, a real `_onKeyDown`, or the canvas's own registered
 *    `contextmenu` handler, and every geometry the walk clicks is read off `S.bodyHits`, which the
 *    paint published at its draw site.
 *
 * ⛔⛔ AND THE Esc KEY IS DRIVEN AS THE MEASUREMENT IT IS, NOT AS THE PROMISE THE SEAM MADE. AC-4's
 *    verifyVia says "Esc … returns to the whole-system picture". It does not, and cannot without
 *    reversing a ruling Max made himself: `NavComputer._onKeyDown` (:344-360) has no `Escape`
 *    clause, so a real Escape is neither preventDefault()ed nor stopPropagation()ed here and reaches
 *    `main.js:13557`, which closes the WHOLE overlay ("after we bring up the nav computer, esc
 *    should just dismiss", 2026-07-29, guarded by `NavComputer.escape.test.js`). Step 6 below drives
 *    the key and asserts that measured fact, so the gap is pinned rather than described; the walk
 *    then leaves by the route that does work and that the glass now names — the right-click, through
 *    the canvas's own `contextmenu` listener (:336) → `handleEscape()` → the wave-2b fold at :1441 →
 *    `drv.onEscape()`.
 */

/** A nav whose canvas KEEPS its listeners, so the LIVE right-click route can be driven. No browser
 *  fires a `click` event for the secondary button, so `_handleClick`'s `e.button === 2` twin at
 *  :4488 is not the route the pilot walks — this is. (Same shape as navRestorations4.host.test.js.) */
async function navWithCanvasListeners() {
  await makeHeadlessNav({ width: W, height: H });   // installs the DOM globals NavComputer reaches for
  const listeners = new Map();
  const canvas = {
    width: W, height: H, style: {}, parentElement: null,
    addEventListener: (type, fn) => { listeners.set(type, fn); },
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H }),
  };
  const { ctx } = makeRecordingContext(canvas);
  canvas.getContext = () => ctx;
  const { NavComputer } = await import('../NavComputer.js');
  const { GalacticMap } = await import('../../generation/GalacticMap.js');
  return { nav: new NavComputer(canvas, new GalacticMap(), null), listeners };
}

/** Stand that nav at SYSTEM, in `mode`, on the star it is orbiting, in `SYSTEM_DATA`. */
async function walkNav(mode) {
  const { nav, listeners } = await navWithCanvasListeners();
  nav._viewModesEnabled = true;
  nav._levelIndex = 3;
  nav.viewMode = mode;
  nav._systemZoom = 1;
  nav.render();                                    // loads `_localStars` through the real loader
  nav._systemStar = nav._localStars.reduce((m, s) => (m == null || s.dist < m.dist ? s : m), null);
  nav._playerX = nav._systemStar.wx; nav._playerY = nav._systemStar.wy; nav._playerZ = nav._systemStar.wz;
  nav._systemData = SYSTEM_DATA;
  nav._currentSystemData = SYSTEM_DATA;
  nav._levelIndex = 4;
  nav._mouseX = -99; nav._mouseY = -99;
  nav.render();
  return { nav, listeners, drv: nav._viewDriverInst };
}

/** Move the pointer and let a FRAME resolve what is under it — the click reads the LAST frame's pick. */
const point = (nav, x, y) => { nav._handleMouseMove({ clientX: x, clientY: y }); nav.render(); };
/** The paint's own mark for a whole-system planet, off `S.bodyHits`. */
const planetMark = (drv, pIdx) => (drv.S.bodyHits || []).find(
  (z) => z && !z.star && z.ref && z.ref.kind === 'planet' && z.ref.pIdx === pIdx && z.moon === -1);
/** A right-click as the browser fires it: mousedown, then the canvas's own `contextmenu` handler. */
function rightClick(nav, listeners, x, y) {
  nav._handleMouseDown({ clientX: x, clientY: y, button: 2 });
  listeners.get('contextmenu')({ clientX: x, clientY: y, preventDefault() {} });
  nav._handleMouseUp();
}

describe('AC-4 END TO END — the pilot\'s own walk, with nothing stubbed', () => {
  it.each([['rail', 1], ['bars', 2]])(
    '⭐⭐ %s: select the planet, drill it, hover a moon (the plate names it), pick the moon '
  + '(the burn arms for it), and come back out',
    async (mode, design) => {
      const { nav, listeners, drv } = await walkNav(mode);
      expect(drv.S.sysView, 'a fresh SYSTEM is the whole system').toBe('system');

      // ── 1. THE FIRST CLICK SELECTS THE PLANET, AND CHANGES NO PICTURE ─────────────────────────
      let mk = planetMark(drv, MOONY);
      expect(mk, `${mode}: the paint published no mark for planet ${MOONY}`).toBeTruthy();
      point(nav, mk.x + 0.5, mk.y + 0.5);
      clickAt(nav, mk.x + 0.5, mk.y + 0.5);
      expect(nav._selectedBody).toEqual({ type: 'planet', planetIndex: MOONY });
      expect(drv.S.sysView, 'one click is a selection, not a screen change').toBe('system');

      // ── 2. THE SECOND CLICK OPENS THE SUB-VIEW, AND KEEPS THE SELECTION ───────────────────────
      nav.render();
      mk = planetMark(drv, MOONY);
      point(nav, mk.x + 0.5, mk.y + 0.5);
      clickAt(nav, mk.x + 0.5, mk.y + 0.5);
      expect(drv.S.sysView, 'the second click did not drill').toBe('planet');
      expect(drv.S.detailPlanet).toBe(MOONY);
      expect(nav._selectedBody, 'the drill threw the selection away')
        .toEqual({ type: 'planet', planetIndex: MOONY });
      expect(nav._systemMode, 'nothing here sets the LEGACY sub-mode (intent.md)').toBe('system');
      expect(nav._levelIndex, 'and it is not a level change').toBe(4);

      // ── 3. A MOON HOVER PAINTS A PLATE THAT NAMES THE MOON ────────────────────────────────────
      nav.render();
      const pip = (drv.S.bodyHits || []).find((z) => z && z.type === 'moon' && z.moonIndex === 1);
      expect(pip, `${mode}: the sub-view published no pip for moon 1`).toBeTruthy();
      const moonRow = drv.D.bodies.find((b) => b.kind === 'moon' && b.pIdx === MOONY && b.mIdx === 1);
      point(nav, pip.x + 0.5, pip.y + 0.5);
      expect(drv.S.hover, 'the driver published no hover for a moon pip').toBeTruthy();
      expect(drv.S.hover.kind).toBe('body');
      expect(drv.S.hover.ref, 'a moon in the sub-view must NOT collapse onto its parent')
        .toMatchObject({ type: 'moon', planetIndex: MOONY, moonIndex: 1 });
      expect(nav._hoveredBody).toEqual({ type: 'moon', index: 1 });
      const ph = paint(nav, design);
      const cr = ph.S.hoverCalloutRect;
      expect(cr, 'no callout plate was drawn for the moon').toBeTruthy();
      const plate = ph.lines.filter((l) => l.x >= cr.x - 2 && l.x <= cr.x + cr.w + 2
                                        && l.y >= cr.y - 2 && l.y <= cr.y + cr.h + 2)
                            .map((l) => l.s).join('\n');
      expect(plate, 'the plate names the moon').toContain(moonRow.name.toUpperCase());
      expect(plate, 'and its own orbit, not its parent\'s AU')
        .toContain(`ORBIT ${Math.round(SYSTEM_DATA.planets[MOONY].moons[1].orbitRadiusEarth)} R⊕`);

      // ── 4. THE MOON CLICK ARMS A MOON BURN, BOTH INDICES ──────────────────────────────────────
      clickAt(nav, pip.x + 0.5, pip.y + 0.5);
      expect(nav._selectedBody).toEqual({ type: 'moon', planetIndex: MOONY, moonIndex: 1 });
      // ⛔ THE PAYLOAD main.js:5994 CONSUMES, not a shape this file invented.
      expect(nav._commitAction)
        .toMatchObject({ type: 'burn', target: 'moon', planetIndex: MOONY, moonIndex: 1 });

      // ── 5. AND THE GLASS SAYS SO, IN THIS DESIGN'S OWN LANGUAGE ───────────────────────────────
      nav.render();
      const p = paint(nav, design);
      expect(p.violations, 'mark guard').toBe(0);
      if (design === 1) {
        expect(inRegion(p, 'commit').map((l) => l.s).join('\n'))
          .toContain(`BURN TO ${moonRow.name.toUpperCase()}`);
      } else {
        expect(p.S.chipRect.armed, 'the chip did not arm').toBe(true);
        expect(p.lines.some((l) => l.s === '[BURN]'), 'at home it is a burn').toBe(true);
        expect(inRegion(p, 'botbar').map((l) => l.s).join('\n')).toContain(moonRow.name.toUpperCase());
      }

      // ── 6. ⛔ THE Esc KEY IS MEASURED, NOT ASSUMED — see this block's header ───────────────────
      let prevented = 0, stopped = 0;
      nav._onKeyDown({ code: 'Escape', preventDefault() { prevented++; }, stopPropagation() { stopped++; } });
      expect(prevented, 'NavComputer claimed the Escape key — AC-4\'s Esc observable may now be live, '
                      + 'and this walk and navRestorations4.host.test.js:288 both need re-reading').toBe(0);
      expect(stopped).toBe(0);
      expect(drv.S.sysView, 'the key never reaches this class; main.js:13598 closes the overlay')
        .toBe('planet');

      // ── 7. THE ROUTE THAT WORKS, AND THAT THE HINT NOW NAMES: THE RIGHT-CLICK ─────────────────
      rightClick(nav, listeners, mk.x + 0.5, mk.y + 0.5);
      expect(drv.S.sysView, 'right-click did not leave the sub-view').toBe('system');
      expect(drv.S.detailPlanet).toBe(-1);
      expect(nav._levelIndex, 'and it must not also pop a level').toBe(4);
      expect(nav._selectedBody, 'the target the pilot picked was thrown away on the way out')
        .toEqual({ type: 'moon', planetIndex: MOONY, moonIndex: 1 });
      expect(nav._commitAction).toMatchObject({ target: 'moon', moonIndex: 1 });

      // ── 8. A SECOND ONE DOES WHAT IT ALWAYS DID: POPS THE LEVEL ───────────────────────────────
      nav.render();
      rightClick(nav, listeners, mk.x + 0.5, mk.y + 0.5);
      expect(nav._levelIndex, 'the second escape must behave as before').toBe(3);
      expect(nav._selectedBody, 'and it clears, as the level-4 arm always has').toBe(null);
    }, 120000);

  /**
   * AC-4's last clause: *"In design 1 a moon's rail row selects the moon directly, without the
   * sub-view."* Driven on the DRAWN row — the band `S.listGeom` published for it — and read back off
   * the glass, so the row the pilot sees and the body the click names are the same body.
   */
  it('⭐ design 1: a moon\'s RAIL ROW, clicked from the whole system, names that moon and changes '
   + 'no picture', async () => {
    const { nav, drv } = await walkNav('rail');
    const lg = drv.S.listGeom;
    expect(lg, 'design 1 published no rail grid at SYSTEM').toBeTruthy();
    const idx = drv.D.bodies.findIndex((b) => b.kind === 'moon' && b.pIdx === MOONY && b.mIdx === 2);
    const row = idx - lg.offset;
    expect(row, 'that moon is not on the drawn page').toBeLessThan(lg.rows);
    const x = lg.x0 + 20.5, y = lg.top + (row + 1) * lg.lead + lg.lead / 2;
    point(nav, x, y);
    clickAt(nav, x, y);
    expect(nav._selectedBody).toEqual({ type: 'moon', planetIndex: MOONY, moonIndex: 2 });
    expect(nav._commitAction).toMatchObject({ target: 'moon', planetIndex: MOONY, moonIndex: 2 });
    expect(drv.S.sysView, 'a LIST row must not change which picture is on the glass').toBe('system');
    nav.render();
    const moonRow = drv.D.bodies[idx];
    expect(inRegion(paint(nav, 1), 'commit').map((l) => l.s).join('\n'))
      .toContain(`BURN TO ${moonRow.name.toUpperCase()}`);
  }, 120000);

  /**
   * ⛔ AND THE SUB-VIEW'S OWN RAIL ROWS PICK THE BODIES THEY DRAW. Measured during integration:
   *    `pickFromRow` (index.js:496) indexed `D.bodies` by `rowBase() + row` at level 4, and the
   *    sub-view's rail is NOT a `D.bodies` page — it is the open planet followed by its own moons in
   *    orbit order. With the sub-view open on a planet whose first moon is `D.bodies[9]`, the five
   *    drawn rows resolved to planets 0, 1, 2, 2 and 3: every row in the picture named the wrong
   *    body. The LAB published what it drew as `S.railBodies`; the picker now reads it.
   * ⛔ MUTANT: put `D.bodies[i]` back in `pickFromRow`. Every row below resolves to a planet and the
   *    first assertion is red.
   */
  it('⛔ design 1: inside the sub-view, EVERY drawn rail row picks the body printed on it', async () => {
    const { nav, drv } = await walkNav('rail');
    let mk = planetMark(drv, MOONY);
    point(nav, mk.x + 0.5, mk.y + 0.5); clickAt(nav, mk.x + 0.5, mk.y + 0.5);
    nav.render();
    mk = planetMark(drv, MOONY);
    point(nav, mk.x + 0.5, mk.y + 0.5); clickAt(nav, mk.x + 0.5, mk.y + 0.5);
    nav.render();
    expect(drv.S.sysView).toBe('planet');
    const lg = drv.S.listGeom, drawn = drv.S.railBodies;
    expect(drawn, 'the sub-view rail published no row list').toBeTruthy();
    expect(drawn[0], 'the parent heads the list').toMatchObject({ kind: 'planet', pIdx: MOONY });
    for (let r = 0; r < Math.min(drawn.length, lg.rows); r++) {
      const want = drawn[r];
      const y = lg.top + (r + 1) * lg.lead + lg.lead / 2;
      point(nav, lg.x0 + 20.5, y);
      expect(nav._hoveredBody, `drawn row ${r} prints "${want.name}" and picks something else`)
        .toEqual(want.kind === 'moon' ? { type: 'moon', index: want.mIdx }
                                      : { type: 'planet', index: want.pIdx });
    }
  }, 120000);
});
