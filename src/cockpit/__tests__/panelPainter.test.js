/**
 * panelPainter — lane F (cockpit-screen-content-2026-07-28).
 *
 * This module is four lines of code and one of the easiest things in the lane to
 * break invisibly, which is the whole reason it is out of the lab and under test.
 * Every failure it can have is SILENT: the painter throws inside `PanelHost`'s
 * catch, the host reports it once, and after that the cockpit simply has black
 * rectangles in it. Nothing is on the console, nothing is red, and the only clue
 * is that the screens do not change.
 *
 * ── THE FOUR THINGS UNDER TEST ──────────────────────────────────────────────
 *
 *   1. IT ADAPTS THE TWO CONTRACTS. The painter must receive a `PhosphorScreen`
 *      built on the panel's context — not the panel record, which has no `clear`.
 *   2. THE SIZE COMES OFF THE PANEL'S OWN CANVAS. Checked at three different
 *      buffer heights through the REAL `PanelHost`, plus a scan of the module's
 *      source for any multi-digit numeric literal. A hard-coded 512 would look
 *      completely normal and would mean the type stopped tracking the resolution
 *      knob — every string at half its intended angular size, no error.
 *   3. THE KIT IS BUILT ONCE PER PANEL. A 60 Hz path must not allocate a kit and
 *      a frozen type scale per panel per frame.
 *   4. AND THE CACHE IS INVALIDATED WHEN THE BUFFER IS. This is the trap the
 *      cache introduces and the reason (3) is not free: rebuild the buffer at a
 *      new resolution and a naive cache keeps handing out a kit sized for the old
 *      one, drawing into a context nothing renders any more. Both shapes are
 *      driven below — a new canvas under a kept panel record, and a new context
 *      at an unchanged size.
 *
 * ── HOW YOU TEST DRAWING CODE WITH NO CANVAS ────────────────────────────────
 *
 * This repo's vitest runs in plain node: no jsdom, no happy-dom, no node-canvas.
 * So the canvas factory is stubbed (`PanelHost` takes `makeCanvas` for exactly
 * this) and the 2D context is a recorder. Every size assertion below reads the
 * geometry of the rectangle `PhosphorScreen.clear()` emits, which is the buffer
 * the kit believes it is drawing into — an observable a size assertion on the
 * object alone would not give, because a kit can hold the right numbers and still
 * be pointed at the wrong context.
 *
 * WHAT A GREEN RUN DOES NOT MEAN: that the panels look right. There are no pixels
 * here. Appearance is Max's eye on the glass at the real angular size.
 *
 * Lane E's files are read, never written, and its `describe.skipIf` pattern is
 * deliberately not copied — see the module-scope self-scan below.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from 'three';

import { panelPainter, screenForPanel } from '../panelPainter.js';
import { PhosphorScreen, PHOSPHOR } from '../PhosphorScreen.js';
import { PanelHost, derivePanelBuffer, DEFAULT_PANEL_BUFFER_HEIGHT_PX } from '../PanelHost.js';
import { DEFAULT_PANEL_ROLES } from '../PanelLayout.js';
import { buildCockpitSnapshot } from '../CockpitSnapshot.js';
import { paintInfo } from '../panels/InfoPanel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(HERE, '..', 'panelPainter.js');

/**
 * Is this file disabling any of its own tests?
 *
 * Comments are stripped first and the pattern is assembled from fragments,
 * because a literal one would match itself and fail a file that is in fact clean.
 *
 * WHY THIS SITS AT MODULE SCOPE AND THROWS rather than living only inside an
 * it(). Measured on the sibling ScreenUV.test.js, not assumed: putting a focus
 * helper on one test made vitest report "1 passed | 6 skipped" and exit GREEN,
 * because the scan was one of the tests it skipped. A self-scan that only runs as
 * a test cannot see a helper that stops it running. Module scope executes during
 * COLLECTION, before the runner can honour any focus helper, so the throw below
 * fires whatever the helpers say. The it() further down is kept anyway, so the
 * guarantee appears by name in the report.
 */
const SELF_CODE = readFileSync(join(HERE, 'panelPainter.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const DISABLED_RE = new RegExp(
  ['describe', 'it', 'test'].flatMap((k) => [k + '\\.skip', k + '\\.only']).join('|'),
);
const SELF_DISABLES_TESTS = DISABLED_RE.test(SELF_CODE);
if (SELF_DISABLES_TESTS) {
  throw new Error(
    'panelPainter.test.js disables one of its own tests (a skip or focus helper is present in ' +
    'its code). This file is the whole of the guarantee that the game gets the same bridge the ' +
    'lab does, and every failure it guards against is a silently black screen, so a disabled ' +
    'test here reads as "the panels are wired" when nothing was checked. Remove the helper.',
  );
}

/**
 * The module's own source, comments stripped.
 *
 * Stripped because the header DISCUSSES the numbers being scanned for — it names
 * 512 and 1024 and 60 Hz while explaining why none of them may appear in the code
 * — and a scan that fired on prose would make honest documentation impossible.
 * Comments do not reach the glass; code does.
 */
const MODULE_CODE = readFileSync(MODULE_PATH, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ─────────────────────────────────────────────────────────────────────────────
// Stand-ins for the platform
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A 2D context that records rather than rasterises.
 *
 * It keeps the GEOMETRY of every `fillRect`, not just a count, because that is
 * where the size assertions live: `PhosphorScreen.clear()` emits one rectangle
 * covering the whole buffer, so the last clear's `w` and `h` are the buffer the
 * kit actually believes it has. A stub that only counted calls could not tell a
 * kit sized for a 256 buffer from one sized for 512.
 *
 * The style properties are REAL SETTERS, not plain fields, for the reason
 * PanelHost.test.js states at length: a colour reaches the glass through an
 * ASSIGNMENT, which a plain field swallows in silence.
 */
function recordingCtx(canvas) {
  const rects = [];
  const texts = [];
  const state = { fillStyle: null, font: null };
  const ctx = {
    canvas,
    _rects: rects,
    _texts: texts,
    clearRect() {},
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, style: state.fillStyle }); },
    fillText(text, x, y) { texts.push({ text: String(text), x, y, style: state.fillStyle }); },
    // Scales with the font size, so a measurement taken under the wrong font
    // produces a width that matches nothing rather than one that quietly passes.
    measureText(text) {
      const m = /(\d+(?:\.\d+)?)px/.exec(state.font || '');
      const size = m ? Number(m[1]) : 1;
      return { width: String(text).length * size * 0.6 };
    },
    save() {}, restore() {}, translate() {}, scale() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {},
  };
  for (const prop of ['fillStyle', 'strokeStyle', 'font', 'textAlign', 'textBaseline']) {
    Object.defineProperty(ctx, prop, {
      enumerable: true,
      get: () => state[prop],
      set: (next) => { state[prop] = next; },
    });
  }
  return ctx;
}

/** The injected canvas factory. Reports exactly the size it was asked for. */
function stubCanvas(width, height) {
  const canvas = { width, height };
  const ctx = recordingCtx(canvas);
  canvas.getContext = (kind) => (kind === '2d' ? ctx : null);
  return canvas;
}
const makeCanvas = (w, h) => stubCanvas(w, h);

/** A bare panel record of the shape `PanelHost` hands to a painter. */
function fakePanel(width, height, role = 'INFO') {
  const canvas = stubCanvas(width, height);
  return { role, nodeName: 'Screen_LL', canvas, ctx: canvas.getContext('2d') };
}

/** A four-corner quad mesh, in float32 exactly as a GLTF loader would produce. */
function quadMesh(name, corners, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

/** A 6:5 face — the shape the shipped cockpit's screens actually are today. */
const ASPECT = 1.2;
const CORNERS_6_5 = [
  [-0.120, -0.100, -1], [0.120, -0.100, -1], [-0.120, 0.100, -1], [0.120, 0.100, -1],
];
const shift = (corners, dx, dy) => corners.map(([x, y, z]) => [x + dx, y + dy, z]);

/**
 * A synthetic cockpit: four display faces sharing ONE material, as the real model
 * does. Built here rather than parsed from a GLB because nothing in this file is
 * about geometry — PanelHost.test.js owns the measurement-against-the-asset work,
 * and this only needs a host with four real panels on it.
 */
function syntheticCockpit() {
  const root = new THREE.Group();
  const screenMaterial = new THREE.MeshStandardMaterial({ name: 'Mat_Screen' });
  const offsets = [[-0.3, 0.2], [0.3, 0.2], [-0.3, -0.2], [0.3, -0.2]];
  Object.values(DEFAULT_PANEL_ROLES).forEach((name, i) => {
    const [dx, dy] = offsets[i % offsets.length];
    root.add(quadMesh(name, shift(CORNERS_6_5, dx, dy), screenMaterial));
  });
  return root;
}

/** A real host over that cockpit, at whatever buffer height is asked for. */
const hostAt = (bufferHeightPx) => PanelHost.fromRoot(syntheticCockpit(), {
  makeCanvas, ...(bufferHeightPx === undefined ? {} : { bufferHeightPx }),
});

/** A real snapshot from the real builder — never a hand-shaped lookalike. */
const snap = () => buildCockpitSnapshot({});

/** A painter that records the kit it was handed and clears the glass. */
function recordingPainter() {
  const screens = [];
  const fn = (screen, snapshot, nowMs) => {
    screens.push({ screen, snapshot, nowMs });
    screen.clear();
  };
  fn.screens = screens;
  return fn;
}

/** The last full-buffer clear the kit emitted into this context. */
const lastClear = (ctx) => ctx._rects.filter((r) => r.x === 0 && r.y === 0).at(-1) ?? null;

let consoleSpies;
beforeEach(() => {
  consoleSpies = { error: vi.spyOn(console, 'error').mockImplementation(() => {}) };
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('panelPainter — adapting the host\'s panel to the painters\' kit', () => {
  it('hands the painter a PhosphorScreen built on the panel\'s own context', () => {
    // The failure this catches is the whole reason the bridge exists: pass the
    // PANEL through and `PhosphorScreen`'s constructor is never reached, so the
    // first symptom is `screen.clear is not a function` from inside the host's
    // catch — logged once, then a frozen screen.
    const panel = fakePanel(614, 512);
    const paint = recordingPainter();
    panelPainter(paint)(panel, snap(), 1234);

    expect(paint.screens).toHaveLength(1);
    const { screen, nowMs } = paint.screens[0];
    expect(screen).toBeInstanceOf(PhosphorScreen);
    expect(screen.ctx).toBe(panel.ctx);
    expect(nowMs).toBe(1234);
    // And the snapshot and clock go through untouched.
    expect(paint.screens[0].snapshot.drive).toBeTruthy();
  });

  it('passes the snapshot through by identity, adding and removing nothing', () => {
    const panel = fakePanel(614, 512);
    const paint = recordingPainter();
    const s = snap();
    panelPainter(paint)(panel, s, 0);
    expect(paint.screens[0].snapshot).toBe(s);
  });

  it('refuses a non-function painter at WIRING time, not at the first repaint', () => {
    // Registered unchecked, a non-function throws on the first repaint from
    // inside the host's catch: reported once, and then that screen simply stays
    // as it was — indistinguishable from a panel with nothing to say.
    for (const bad of [null, undefined, 0, 'paintDrive', {}]) {
      expect(() => panelPainter(bad), `painter ${JSON.stringify(bad)}`)
        .toThrow(/needs a painter function/);
    }
  });

  it('refuses anything that is not a panel carrying a ctx and a canvas', () => {
    const wired = panelPainter(() => {});
    for (const bad of [null, undefined, {}, { role: 'NAV' }, { ctx: {} }, { canvas: {} }]) {
      expect(() => wired(bad, snap(), 0), `panel ${JSON.stringify(bad)}`)
        .toThrow(/needs a PanelHost panel/);
    }
  });

  it('lets a painter\'s throw reach PanelHost, which is the only thing that reports it', () => {
    // A catch inside the bridge would swallow the error before the host saw it.
    // The host would then count the panel as painted and re-upload an unchanged
    // texture forever, with nothing logged anywhere — the exact silent failure
    // this module was promoted out of the lab to prevent.
    const host = hostAt();
    const boom = () => { throw new Error('painter exploded'); };
    host.setPainter('INFO', panelPainter(boom));
    expect(() => host.update(snap(), 0)).not.toThrow();
    expect(consoleSpies.error).toHaveBeenCalledTimes(1);
    expect(String(consoleSpies.error.mock.calls[0][0])).toMatch(/INFO painter threw/);
  });
});

describe('panelPainter — the buffer size comes off the panel, never a literal', () => {
  it('sizes the kit from the panel\'s own canvas at every resolution setting', () => {
    // Driven through the REAL host so the canvas really was sized by
    // `derivePanelBuffer` from the face's measured aspect. A kit that read a
    // constant would agree with the default and disagree with every other knob
    // setting — which is precisely how a hard-coded size survives review.
    for (const heightPx of [256, 300, 512, 768]) {
      const host = hostAt(heightPx);
      const paint = recordingPainter();
      host.setPainter('INFO', panelPainter(paint));
      host.update(snap(), 0);

      const panel = host.panel('INFO');
      const expected = derivePanelBuffer({ aspect: ASPECT }, heightPx);
      expect(panel.canvas.height, `knob ${heightPx}`).toBe(expected.height);

      const { screen } = paint.screens.at(-1);
      expect(screen.height, `knob ${heightPx}: kit height`).toBe(panel.canvas.height);
      expect(screen.width, `knob ${heightPx}: kit width`).toBe(panel.canvas.width);
      // And the size the kit DRAWS at, which is the thing the pilot sees. A kit
      // can hold the right numbers and still be pointed at the wrong context.
      const clear = lastClear(panel.ctx);
      expect(clear, `knob ${heightPx}: nothing was cleared`).toBeTruthy();
      expect([clear.w, clear.h], `knob ${heightPx}: cleared the wrong buffer`)
        .toEqual([panel.canvas.width, panel.canvas.height]);
      expect(clear.style).toBe(PHOSPHOR.BACK);
    }
  });

  it('gives a differently-shaped face a differently-shaped kit', () => {
    // Two panels, same height, different aspect: the widths must differ. A kit
    // that derived width from height (or from a constant) would hand both the
    // same buffer and draw the 6:5 face with 3:2 pixels.
    const wide = fakePanel(1024, 512);
    const tall = fakePanel(256, 512);
    expect(screenForPanel(wide).width).toBe(1024);
    expect(screenForPanel(tall).width).toBe(256);
  });

  it('writes down no buffer size of its own — the source carries no such number', () => {
    // The second, independent form of the check. Watching what gets drawn catches
    // a literal on a path this file happens to exercise; scanning the source
    // catches one sitting on a path it does not. Any multi-digit number in this
    // module's CODE is a buffer size, a type size or a resolution — none of which
    // it is allowed to know. (Comments are stripped: the header names 512 and
    // 1024 precisely to explain why they may not appear below.)
    const literals = MODULE_CODE.match(/\d\d+/g) ?? [];
    expect(literals, `panelPainter.js code contains numeric literals: ${literals.join(', ')}`)
      .toEqual([]);
    // And it does not reach for the host's default buffer height either.
    expect(MODULE_CODE).not.toContain('DEFAULT_PANEL_BUFFER_HEIGHT_PX');
  });

  it('takes the size off panel.canvas, not off whatever the context is attached to', () => {
    // The behavioural form of "reads the panel's own canvas", and the reason the
    // source scan above no longer tries to make that claim. A scan for the string
    // 'panel.canvas' is satisfied by the null-guard at the top of the function and
    // says nothing at all about where the two numbers came from — measured, not
    // assumed: rewriting the size read to `ctx.canvas` left this file entirely
    // green while the lab suite failed for an unrelated reason (its recorder
    // happens to expose no `canvas`), which is a guard held up by an accident.
    //
    // In a browser `panel.ctx.canvas` and `panel.canvas` are the same object, so
    // this can only be driven with a deliberately disagreeing pair. Which one is
    // right is not a coin toss: `PanelHost` sizes `panel.canvas` from the face's
    // MEASURED aspect and hands that record to the painter, so the panel record is
    // the contract and the context's own back-reference is an implementation
    // detail of whatever made it.
    const real = stubCanvas(614, 512);
    const ctx = real.getContext('2d');
    // A decoy of a different size hanging off the same context.
    ctx.canvas = stubCanvas(1229, 1024);

    const screen = screenForPanel({ role: 'INFO', canvas: real, ctx });
    expect([screen.width, screen.height], 'the kit was sized off ctx.canvas')
      .toEqual([614, 512]);
  });
});

describe('panelPainter — one kit per panel, rebuilt when the buffer is', () => {
  it('builds the kit ONCE and reuses it across every repaint', () => {
    // A 60 Hz paint path, four panels wide. Allocating an object and a frozen
    // type scale per panel per frame to hold three numbers that did not change is
    // waste, and the kit is stateless precisely so it need not be.
    const panel = fakePanel(614, 512);
    const paint = recordingPainter();
    const wired = panelPainter(paint);
    for (let i = 0; i < 60; i++) wired(panel, snap(), i * 16);

    expect(paint.screens).toHaveLength(60);
    const distinct = new Set(paint.screens.map((c) => c.screen));
    expect(distinct.size, 'a new kit was built per frame').toBe(1);
  });

  it('REBUILDS the kit when the buffer is rebuilt under the same panel record', () => {
    // THE TRAP. The lab's BUFFER RESOLUTION control — and any future quality
    // setting in the game — replaces a panel's canvas and context. A cache that
    // only asks "does this panel already have a kit" keeps handing out one whose
    // type scale came from the OLD height, drawing into a context nothing renders
    // any more. Nothing errors. The glass either freezes or shows type sized for
    // a buffer that no longer exists, and both read as "the knob does nothing".
    const panel = fakePanel(614, 512);
    const paint = recordingPainter();
    const wired = panelPainter(paint);

    wired(panel, snap(), 0);
    const before = paint.screens.at(-1).screen;
    expect([before.width, before.height]).toEqual([614, 512]);
    expect([lastClear(panel.ctx).w, lastClear(panel.ctx).h]).toEqual([614, 512]);

    // Rebuild the buffer exactly as the host does: a new canvas, a new context,
    // the same panel record.
    const rebuilt = stubCanvas(307, 256);
    panel.canvas = rebuilt;
    panel.ctx = rebuilt.getContext('2d');

    wired(panel, snap(), 16);
    const after = paint.screens.at(-1).screen;
    expect(after, 'the stale kit was handed out again').not.toBe(before);
    expect([after.width, after.height], 'the kit kept the old buffer\'s size').toEqual([307, 256]);
    expect(after.ctx, 'the kit kept the old, unrendered context').toBe(panel.ctx);
    // The type scale is what the pilot actually notices, and it is derived from
    // the height — so a stale kit means type at the wrong angular size.
    expect(after.type.body).not.toBe(before.type.body);
    // And the drawing landed in the new buffer, at the new size.
    const clear = lastClear(panel.ctx);
    expect([clear.w, clear.h], 'cleared the wrong buffer after the rebuild').toEqual([307, 256]);
  });

  it('rebuilds when the canvas is resized IN PLACE, record and context unchanged', () => {
    // The second shape of the same failure, and the one a ctx-identity check
    // alone would miss: same panel, same context, different dimensions.
    const panel = fakePanel(614, 512);
    const wired = panelPainter(recordingPainter());
    wired(panel, snap(), 0);
    const before = screenForPanel(panel);

    panel.canvas.width = 1229;
    panel.canvas.height = 1024;
    wired(panel, snap(), 16);

    const after = screenForPanel(panel);
    expect(after).not.toBe(before);
    expect([after.width, after.height]).toEqual([1229, 1024]);
    expect([lastClear(panel.ctx).w, lastClear(panel.ctx).h]).toEqual([1229, 1024]);
  });

  it('rebuilds when the context is replaced at an unchanged size', () => {
    // And the shape a dimensions-only check would miss: same numbers, different
    // context. The kit would keep drawing into a canvas nothing renders.
    const panel = fakePanel(614, 512);
    const wired = panelPainter(recordingPainter());
    wired(panel, snap(), 0);
    const stale = panel.ctx;
    const before = screenForPanel(panel);

    const replacement = stubCanvas(614, 512);
    panel.canvas = replacement;
    panel.ctx = replacement.getContext('2d');
    const drawnOnStale = stale._rects.length;

    wired(panel, snap(), 16);
    expect(screenForPanel(panel)).not.toBe(before);
    expect(stale._rects.length, 'kept drawing into the replaced context').toBe(drawnOnStale);
    expect(lastClear(panel.ctx), 'drew nothing into the new context').toBeTruthy();
  });

  it('caches per PANEL, not per role or per adapter', () => {
    // A kit cached once for the whole module — or once per role — would hand all
    // four screens one context, and the cockpit would show four copies of
    // whichever panel painted last. Four panels, four kits, four contexts.
    const host = hostAt();
    const painters = {};
    for (const role of Object.keys(DEFAULT_PANEL_ROLES)) {
      painters[role] = recordingPainter();
      host.setPainter(role, panelPainter(painters[role]));
    }
    host.update(snap(), 0);

    const screens = Object.keys(DEFAULT_PANEL_ROLES).map((r) => painters[r].screens.at(-1).screen);
    expect(new Set(screens).size, 'roles shared a kit').toBe(4);
    expect(new Set(screens.map((s) => s.ctx)).size, 'roles shared a context').toBe(4);
    for (const role of Object.keys(DEFAULT_PANEL_ROLES)) {
      const panel = host.panel(role);
      expect(painters[role].screens.at(-1).screen.ctx, `${role} drew into another panel's glass`)
        .toBe(panel.ctx);
    }
  });

  it('shares one kit between two adapters pointed at the same panel', () => {
    // The cache belongs to the PANEL, not to the wrapper around a painter. Two
    // adapters holding two kits onto one canvas is not wrong so much as
    // pointless — and it is the shape a closure-scoped cache would take.
    const panel = fakePanel(614, 512);
    const a = recordingPainter();
    const b = recordingPainter();
    panelPainter(a)(panel, snap(), 0);
    panelPainter(b)(panel, snap(), 16);
    expect(b.screens[0].screen).toBe(a.screens[0].screen);
  });
});

describe('panelPainter — against the real host and a real painter', () => {
  it('puts a shipped painter on real glass with nothing else in between', () => {
    // The end-to-end shape the game will use the day the cockpit is wired into
    // main.js: `host.setPainter(role, panelPainter(paintInfo))`. `paintInfo` draws
    // one row per INFO_ROWS entry, so text reaching this context at all is the
    // whole chain — host, bridge, kit, painter — proving it fits together.
    const host = hostAt();
    host.setPainter('INFO', panelPainter(paintInfo));
    expect(host.update(snap(), 0)).toBeGreaterThan(0);

    const ctx = host.panel('INFO').ctx;
    expect(ctx._texts.length, 'the INFO painter reached no glass').toBeGreaterThanOrEqual(7);
    // One ink and one background, and nothing else, all the way through.
    const styles = new Set([...ctx._rects, ...ctx._texts].map((d) => d.style));
    expect([...styles].sort()).toEqual([PHOSPHOR.BACK, PHOSPHOR.INK].sort());
    // Nothing was reported, because nothing threw.
    expect(consoleSpies.error).not.toHaveBeenCalled();
  });

  it('keeps the same kit across the host\'s ambient repaints', () => {
    const host = hostAt();
    const paint = recordingPainter();
    host.setPainter('INFO', panelPainter(paint));
    for (let i = 0; i < 20; i++) host.update(snap(), i * 100);
    expect(paint.screens.length).toBeGreaterThan(5);
    expect(new Set(paint.screens.map((c) => c.screen)).size).toBe(1);
  });

  it('defaults to the host\'s own buffer height when the knob is untouched', () => {
    const host = hostAt();
    const paint = recordingPainter();
    host.setPainter('INFO', panelPainter(paint));
    host.update(snap(), 0);
    expect(paint.screens.at(-1).screen.height).toBe(DEFAULT_PANEL_BUFFER_HEIGHT_PX);
  });
});

describe('panelPainter — the suite\'s own guarantee', () => {
  it('does not disable any of its own tests', () => {
    // The real enforcement is at module scope, which runs during collection and
    // therefore cannot be skipped. This exists so the guarantee shows up by name
    // in the report rather than being an invisible side effect of importing.
    expect(SELF_DISABLES_TESTS).toBe(false);
  });
});
