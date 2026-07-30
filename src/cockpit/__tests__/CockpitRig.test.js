/**
 * CockpitRig — the shared assembly's contract.
 *
 * Increment 7, `cockpit-into-helm-2026-07-30`, AC-ONE-RIG-TWO-HOSTS.
 *
 * ⚠ WHAT THIS FILE CAN AND CANNOT ANSWER. There is no WebGL and no GLB here, so
 * it cannot say what the cockpit LOOKS like — that is the live pass's job. What
 * it pins is the BOUNDARY: which values are the rig's (and therefore identical in
 * both hosts), which are the host's (and therefore must be refused rather than
 * guessed), and that the module keeps its hands off the renderer.
 *
 * The boundary is the thing worth testing because the failure it prevents is
 * silent. Two hosts constructing the same rig and getting different cockpits
 * raises no error, fails no assertion anywhere else, and shows up as "the game
 * looks a bit wrong" months later.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CockpitRig, EYE_NODE_NAME, EYE_FOV, EYE_NEAR, EYE_FAR,
  COCKPIT_TONE_MAPPING, COCKPIT_TONE_EXPOSURE,
  DEFAULT_COCKPIT_LIGHTS, DEFAULT_PANEL_PAINTERS, DEFAULT_ZOOMABLE_ROLES,
  DEFAULT_GLASS, COCKPIT_GLB_URL,
} from '../CockpitRig.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'CockpitRig.js');

/** The minimum a host must supply. Deliberately not a default anywhere. */
const hostOpts = () => ({
  camera: { fov: EYE_FOV, isCamera: true },
  pinCamera: () => {},
  getViewport: () => ({ x: 0, y: 0, width: 1600, height: 900 }),
  bufferHeightPx: 512,
});

describe('the boundary — what the rig owns', () => {
  it('pins the eye optics, because a host that forgot them would get three\'s 50-degree default', () => {
    // 70 is the game's own FOV and the one every framing judgement was made at.
    // three's PerspectiveCamera defaults to 50, which would show a cockpit
    // subtending far more of the view than Max approved — and PanelMover
    // re-solves the zoom fill from the camera's LIVE fov, so the zoomed panel
    // would land at a size he has never seen.
    expect(EYE_FOV).toBe(70);
    expect(EYE_NEAR).toBeLessThanOrEqual(0.005); // a zoomed panel lands ~0.17 m out
    expect(EYE_FAR).toBeGreaterThan(1000);
  });

  it('owns the tone regime, which is the trap three sets for a two-host rig', () => {
    // three r0.183 forces NoToneMapping unless the render target is the canvas,
    // so the lab (to canvas) and the game (to a target) would silently diverge.
    // Exporting both numbers is what makes the two hosts agree by construction.
    expect(COCKPIT_TONE_EXPOSURE).toBe(1.25);
    expect(COCKPIT_TONE_MAPPING).toBeTypeOf('number');
  });

  it('owns the three lights — the divergence probe the AC names', () => {
    expect(DEFAULT_COCKPIT_LIGHTS).toHaveLength(3);
    const [ambient, key, fill] = DEFAULT_COCKPIT_LIGHTS;
    expect(ambient.type).toBe('ambient');
    expect(key.type).toBe('directional');
    expect(key.intensity).toBe(2.2);
    expect(fill.intensity).toBe(0.26);
    // Frozen so a host cannot mutate the shared defaults out from under the other.
    expect(Object.isFrozen(DEFAULT_COCKPIT_LIGHTS)).toBe(true);
    expect(Object.isFrozen(key)).toBe(true);
  });

  // ⭐ REWRITTEN 2026-07-30, NOT FLIPPED. This pinned `opacity ≈ 0.10`, and the
  // reason was sound: the canopy was a placeholder alpha-blended OVER the world,
  // so it had to be faint or it fogged the one thing the canopy exists to let
  // you see through. That premise is spent. The glass is now ADDITIVE, which
  // cannot fog anything — it adds light where lit and nothing where it is not —
  // so the dimming moved to `glare.color` and `opacity` became a master
  // brightness whose correct value is 1. Pinning 0.10 now would be pinning a
  // number whose meaning changed underneath it.
  //
  // ⚠ `depthWrite: false` IS THE CLAUSE THAT DID NOT CHANGE and the one the
  // original title was really about: a canopy that writes depth can occlude the
  // four screens, which looks plausible and raises no error.
  it('owns the glass, whose depthWrite is what stops the canopy hiding the screens', () => {
    expect(DEFAULT_GLASS.depthWrite).toBe(false);
    expect(DEFAULT_GLASS.doubleSide).toBe(true);
  });

  it('the canopy ADDS light rather than blending over the world', () => {
    expect(DEFAULT_GLASS.additive, 'alpha-blending the canopy fogs the view through it').toBe(true);
    // Under additive blending three multiplies source by alpha before adding, so
    // opacity is a master on the glare. Dimming belongs to ONE knob, and it is
    // the colour — two multiplying knobs for one visible quantity is how a lab
    // session ends up unable to say which one it just moved.
    expect(DEFAULT_GLASS.opacity).toBe(1);
    // The colour is the DIFFUSE albedo of the canopy's inner surface — see
    // DEFAULT_GLASS for why this is a wash and not a specular glint, and for the
    // measurement that killed the glint version. Under additive blending it is
    // added straight onto the world behind, so it must be DIM: a bright value
    // here is a canopy that whites out the thing it exists to let you see.
    const c = DEFAULT_GLASS.glare.color;
    expect(Number.isInteger(c)).toBe(true);
    const [r, g, b] = [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    expect(Math.max(r, g, b), 'glare F0 must stay dim or the canopy whites out').toBeLessThan(110);
    expect(DEFAULT_GLASS.glare.roughness).toBeGreaterThan(0);
    expect(DEFAULT_GLASS.glare.roughness).toBeLessThan(1);
    // metalness 0 IS the feature, not a default that happens to be falsy: a
    // metal has no diffuse term, so any value above 0 fades out the only
    // component that reaches the pilot's eye from inside the canopy.
    expect(DEFAULT_GLASS.glare.metalness).toBe(0);
    expect(Object.isFrozen(DEFAULT_GLASS.glare)).toBe(true);
  });

  it('ships all four default painters from src/, so the game never reaches into a lab file', () => {
    expect(Object.keys(DEFAULT_PANEL_PAINTERS).sort()).toEqual(['DRIVE', 'INFO', 'NAV', 'TARGET']);
    for (const [role, p] of Object.entries(DEFAULT_PANEL_PAINTERS)) {
      expect(typeof p, `${role}'s painter`).toBe('function');
    }
  });

  it('names the eye node rather than assuming the origin', () => {
    expect(EYE_NODE_NAME).toBe('Eye_Point');
    expect(COCKPIT_GLB_URL).toMatch(/cockpit\.glb$/);
  });

  it('zooms NAV only, and says so in one editable place', () => {
    expect([...DEFAULT_ZOOMABLE_ROLES]).toEqual(['NAV']);
  });
});

describe('the boundary — what the rig refuses to guess', () => {
  for (const missing of ['camera', 'pinCamera', 'getViewport']) {
    it(`refuses to construct without \`${missing}\``, () => {
      const opts = hostOpts();
      delete opts[missing];
      // Loudly, and naming the field. The alternative — a plausible default —
      // is how the two hosts end up with different cockpits: the lab passes its
      // real one, the game silently gets a stand-in, and nothing reports it.
      expect(() => new CockpitRig(opts)).toThrow(new RegExp(missing));
    });
  }

  it('constructs with the minimum a host supplies, and starts with no model and no errors', () => {
    const rig = new CockpitRig(hostOpts());
    expect(rig.model).toBeNull();
    expect(rig.loadError).toBeNull();
    expect(rig.hostError).toBeNull();
    expect(rig.navError).toBeNull();
    expect(rig.host).toBeNull();
    expect(rig.mover).toBeNull();
    expect(rig.eyeFound).toBe(false);
  });

  it('adds its lights to its own scene and nothing else', () => {
    const rig = new CockpitRig(hostOpts());
    expect(rig.scene.children.length).toBe(DEFAULT_COCKPIT_LIGHTS.length);
  });

  it('takes the zoom knobs from the host and falls back to the module defaults', () => {
    const rig = new CockpitRig({ ...hostOpts(), zoom: { fill: 0.42, durationMs: 999 } });
    expect(rig.zoom.fill).toBeCloseTo(0.42, 6);
    expect(rig.zoom.durationMs).toBe(999);
    // followCamera is the head-decoupling knob and defaults OFF — head
    // decoupling is a LATER increment and must not arrive by default.
    expect(rig.zoom.followCamera).toBe(false);
  });

  it('remount() is a no-op with no model rather than a throw', () => {
    const rig = new CockpitRig(hostOpts());
    expect(() => rig.remount()).not.toThrow();
    expect(rig.hostError).toBeNull();
  });

  it('answers navIsZoomed / navZoomLanded false with no mover, and keeps them DISTINCT', () => {
    const rig = new CockpitRig(hostOpts());
    expect(rig.navIsZoomed()).toBe(false);
    expect(rig.navZoomLanded()).toBe(false);

    // The distinction is load-bearing in both directions: the PAINTER asks the
    // first (chrome appears as the panel travels), ROUTING asks the second (a
    // press forwarded mid-travel slides under the cursor and is thrown away by
    // NavComputer's own drag rejection). A rig that collapsed them would pass
    // every test above and break both behaviours.
    rig.mover = { zoomedRole: 'NAV', state: 'toZoom' };
    expect(rig.navIsZoomed()).toBe(true);
    expect(rig.navZoomLanded()).toBe(false);
    rig.mover.state = 'zoomed';
    expect(rig.navZoomLanded()).toBe(true);
  });

  it('pickAt returns null with no picker instead of throwing at the host', () => {
    const rig = new CockpitRig(hostOpts());
    expect(rig.pickAt(10, 10)).toBeNull();
  });

  it('cameraNow() pins BEFORE handing the camera over', () => {
    // The invariant lives at this boundary rather than inside PanelMover, which
    // is handed a camera it does not own. Measured cost of solving against a
    // stale one: 350 px off centre and 65% larger than the fill knob asked for.
    const order = [];
    const opts = hostOpts();
    opts.pinCamera = () => order.push('pin');
    const rig = new CockpitRig(opts);
    const cam = rig.cameraNow();
    order.push('handed');
    expect(order).toEqual(['pin', 'handed']);
    expect(cam).toBe(opts.camera);
  });

  it('update() pins before the mover solves, and drives both clocks in real ms', () => {
    const order = [];
    const opts = hostOpts();
    opts.pinCamera = () => order.push('pin');
    const rig = new CockpitRig(opts);
    rig.mover = { update: (ms) => order.push(`mover:${ms}`) };
    rig.host = { update: (snap, now) => order.push(`host:${now}`) };
    rig.update({ snapshot: {}, nowMs: 1234, dtMs: 33 });
    expect(order).toEqual(['pin', 'mover:33', 'host:1234']);
  });
});

describe('the rig keeps its hands off the renderer and the clock', () => {
  // Source-scanned rather than behaviour-driven, and that is a real limitation:
  // a scan cannot see a call built from a computed property name. It is here
  // because the failure it guards is GLOBAL and silent — the game's renderer is
  // RetroRenderer's, shared with the world pass and the palette remap, so one
  // stray write retints the entire game rather than just the cockpit.
  const src = readFileSync(SRC, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  for (const forbidden of [
    'setSize', 'setPixelRatio', 'setClearColor', 'setViewport', 'setScissor',
    'toneMappingExposure =', 'renderer.toneMapping =', 'setRenderTarget',
  ]) {
    it(`never calls \`${forbidden}\` on the injected renderer`, () => {
      expect(src).not.toContain(forbidden);
    });
  }

  it('never advances SimClock — the hosts already do, and twice runs every drill at 2x', () => {
    expect(src).not.toContain('_advanceSimClock');
    expect(src).not.toContain('SimClock');
  });

  it('never constructs a NavComputer — makeNav is the host\'s injection point for four ACs', () => {
    expect(src).not.toContain('new NavComputer');
    expect(src).not.toContain('NavComputer.js');
  });

  it('the forbidden-list check can actually fail', () => {
    // Guards the guard. Every assertion above is a `not.toContain`, and a
    // stripped-to-nothing source would pass all of them.
    expect(src.length).toBeGreaterThan(2000);
    expect(src).toContain('class CockpitRig');
    expect(src).toContain('makeNav');
  });
});

describe('the pointer router — the hover channel must survive the extraction', () => {
  /** A rig with a stubbed adapter, so the router is tested and nothing else is. */
  function routed({ landed = true, role = 'NAV', lookDragging = false } = {}) {
    const calls = [];
    const rig = new CockpitRig({ ...hostOpts(), isLookDragging: () => lookDragging });
    rig.mover = { zoomedRole: landed ? 'NAV' : null, state: landed ? 'zoomed' : 'rest', zoom: (r) => calls.push(`zoom:${r}`), dismiss: () => calls.push('dismiss') };
    rig.pickAt = () => (role ? { role, hit: { uv: { u: 0.5, v: 0.5 } } } : null);
    rig.ensureNavAdapter = () => ({
      pointerDown: () => calls.push('down'),
      pointerMove: () => calls.push('move'),
      pointerUp: () => calls.push('up'),
      pointerHover: (h) => calls.push(`hover:${h ? 'hit' : 'miss'}`),
      pointerWheel: (h, d) => { calls.push(`wheel:${d}`); return !!h; },
    });
    return { rig, calls };
  }

  it('forwards UNPRESSED moves as hover — the whole of Max\'s "press and hold" bug', () => {
    const { rig, calls } = routed();
    rig.pointer.move(10, 10);
    expect(calls).toEqual(['hover:hit']);
  });

  it('passes a hit on ANOTHER panel as a MISS, so its uv never lands in NAV pixel space', () => {
    const { rig, calls } = routed({ role: 'DRIVE' });
    rig.pointer.move(10, 10);
    expect(calls).toEqual(['hover:miss']);
  });

  it('does not hover while the host is look-dragging, or before the panel has landed', () => {
    const a = routed({ lookDragging: true });
    a.rig.pointer.move(10, 10);
    expect(a.calls).toEqual([]);
    const b = routed({ landed: false });
    b.rig.pointer.move(10, 10);
    expect(b.calls).toEqual([]);
  });

  it('a press on the landed panel routes to the nav computer, and its moves are DRAG not hover', () => {
    const { rig, calls } = routed();
    expect(rig.pointer.down(10, 10)).toBe('nav');
    rig.pointer.move(11, 11);
    expect(rig.pointer.up(11, 11)).toBe(true);
    expect(calls).toEqual(['down', 'move', 'up']);
  });

  it('a release with no press outstanding is not consumed, so the host keeps its own drag', () => {
    const { rig } = routed();
    expect(rig.pointer.up(10, 10)).toBe(false);
  });

  it('a press on a zoomable panel at rest zooms it instead of poking the nav computer', () => {
    const { rig, calls } = routed({ landed: false });
    expect(rig.pointer.down(10, 10)).toBe('zoom');
    expect(calls).toEqual(['zoom:NAV']);
  });

  // ── The census (increment 7 step 6) — the instrument AC-A-QUICK-CLICK-IS-
  //    ENOUGH reads. Counted at the ROUTER, which is the receiver: a host that
  //    believes it forwards unpressed moves and does not would, if it counted
  //    for itself, report its own belief. ────────────────────────────────────
  it('counts a quick click as hover-then-press, with pressedMove at zero', () => {
    // The shape of a click that WORKS. Hover, then a press and release with
    // nothing in between — `{ move: false }`, the gesture that has nothing to
    // manufacture the missing move.
    const { rig } = routed();
    rig.pointer.move(10, 10);
    rig.pointer.down(10, 10);
    rig.pointer.up(10, 10);
    expect(rig.pointer.census).toMatchObject({ hover: 1, pressedMove: 0, down: 1, up: 1, navDown: 1, lastRole: 'NAV' });
  });

  it('counts press-and-hold as pressedMove, which is what the broken shape looked like', () => {
    const { rig } = routed();
    rig.pointer.down(10, 10);
    rig.pointer.move(11, 11);
    rig.pointer.move(12, 12);
    rig.pointer.up(12, 12);
    expect(rig.pointer.census).toMatchObject({ hover: 0, pressedMove: 2 });
  });

  it('records the role under a press that the router did NOT take, so a miss is legible', () => {
    // A press on DRIVE at rest: not NAV, not zoomable, so the host looks around.
    // The census still says what was under it — otherwise "the click did
    // nothing" and "the click hit the wrong panel" look identical.
    const { rig } = routed({ role: 'DRIVE', landed: false });
    expect(rig.pointer.down(10, 10)).toBe('none');
    expect(rig.pointer.census).toMatchObject({ down: 1, navDown: 0, zoomDown: 0, lastRole: 'DRIVE' });
  });

  it('records a press on nothing as a null role, not as the last panel touched', () => {
    const { rig } = routed({ role: null, landed: false });
    rig.pointer.down(1, 1);
    expect(rig.pointer.census.lastRole).toBe(null);
  });

  // ── THE WHEEL CHANNEL (2026-07-30) — Max: "Scroll wheel doesn't work in the
  //    nav menus in game." The router had press, drag and hover and no wheel,
  //    so nothing forwarded one to an offscreen canvas that can never receive
  //    a real event. Gated EXACTLY as hover is, and for the same reasons. ────
  it('forwards a wheel over the landed panel, carrying deltaY unchanged', () => {
    const { rig, calls } = routed();
    expect(rig.pointer.wheel(10, 10, -120)).toBe(true);
    expect(calls).toEqual(['wheel:-120']);
  });

  it('does not forward a wheel over ANOTHER panel — its uv is not NAV pixel space', () => {
    // Unlike a move, which is forwarded as an explicit MISS so the class can
    // clear its own hover, a wheel over the wrong panel is simply not ours.
    // There is nothing to clear and no "the pilot scrolled off the glass" state.
    const { rig, calls } = routed({ role: 'DRIVE' });
    expect(rig.pointer.wheel(10, 10, -120)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('does not forward a wheel before the panel has landed, or during a look-drag', () => {
    // At rest NAV is chrome-less and not something the pilot is working; during
    // a look-drag the head is turning and the pointer is not theirs to aim. Both
    // are the hover gate, and a wheel channel that disagreed with it would zoom
    // a map the pilot cannot see.
    const a = routed({ landed: false });
    expect(a.rig.pointer.wheel(10, 10, -120)).toBe(false);
    expect(a.calls).toEqual([]);
    const b = routed({ lookDragging: true });
    expect(b.rig.pointer.wheel(10, 10, -120)).toBe(false);
    expect(b.calls).toEqual([]);
  });

  it('counts wheels in the census, so "the wire is absent" is distinguishable from "the map ignored it"', () => {
    // This is the instrument the live pass reads. Increment 6's lesson: hover
    // at 0 with pressedMove rising is a MISSING CHANNEL, and it looks exactly
    // like a class that received the event and did nothing with it.
    const { rig } = routed();
    rig.pointer.wheel(10, 10, -120);
    rig.pointer.wheel(10, 10, 120);
    expect(rig.pointer.census).toMatchObject({ wheel: 2 });
  });

  it('a wheel with no adapter is not consumed, so the host keeps its own zoom', () => {
    const { rig } = routed();
    rig.ensureNavAdapter = () => null;
    expect(rig.pointer.wheel(10, 10, -120)).toBe(false);
  });
});
