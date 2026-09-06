// src/ui/SupercruiseHud.js
//
// Minimal supercruise HUD (AC7): speed readout, throttle bar, virtual-joystick
// reticle, target marker + drop window. Pure view — main.js passes state each
// render frame. Pattern: src/ui/TargetingReticle.js (own canvas, _project).
//
// ── ⭐ THIS CANVAS LIVES ON THE WORLD'S PIXEL GRID (chrome-and-ui-at-240p, AC-6) ──
//
// Max, 2026-09-06: *"I want the whole game to read as a 5th gen game ... so we simply need to
// redesign anything that does not read properly at this new resolution; if that's true of the
// in-game hud and nav panels etc. then that's where we go next."*
//
// The backing store is the WORLD BUFFER (468x240 at the 240p setting), CSS-stretched to the window
// with `image-rendering: pixelated` — the same two declarations, in the same order, as `#canvas`
// (`style.css:22-23`). So one unit in this file is one WORLD pixel, magnified ~4.7x, and the HUD
// cannot be sharper than the thing it sits on. ⛔ "Keep the text full-res" was offered to Max and
// NOT taken; do not reintroduce it as a higher-res canvas, a DOM overlay, or a separate sharp pass.
//
// THREE CONSEQUENCES THAT ARE NOT OPTIONAL:
//
//   1. ⛔ NO `stroke()`, ANYWHERE. A 1-px stroke at an integer coordinate straddles it and lands as
//      two half-covered grey rows — a NINE-SCREEN-PIXEL smear where one crisp texel was intended.
//      Every mark here is a `fillRect` at integer coordinates. There is no stroke path on purpose.
//   2. ⛔ NO `fillText`. A vector face antialiases unconditionally and spends its detail on
//      fractional edge coverage, which magnifies into flat grey blocks. Every string goes through
//      `PixelText`, the ONE bitmap face in this repo (`src/rendering/PixelText.js`).
//   3. ⛔ NO `innerWidth`/`innerHeight` IN THE DRAWING CODE. They are the WINDOW; this canvas is
//      the BUFFER, and the two differ by the magnification. `this._w`/`this._h` are read off the
//      canvas itself every frame. Left on `innerWidth`, `_project` alone puts the at-the-body cue
//      ~4.7x off-screen.
//
// ⚠ THE RESOLUTION SETTING CHANGES THE BUFFER WITH NO WINDOW RESIZE AT ALL (`main.js:6266-6271`
// sets `renderLines` and calls `resize()`), so a `resize` listener alone strands this canvas at the
// previous resolution. `_syncBuffer()` therefore runs as the FIRST statement of `update()` as well.
import * as THREE from 'three';
import { formatSpeed, speedToBarFrac, sublightBarFrac } from './SpeedFormat.js';
import { resolveRenderBuffer } from '../rendering/renderBuffer.js';
import { drawPixelText, measurePixelText, pixelTextHeight } from '../rendering/PixelText.js';

// The CONTEXTUAL ETA gate (§targeting-brackets-contextual-eta-design-2026-06-28,
// Unit 3). The glanceable "M:SS" counter shows ONLY when the player is moving, the
// distance to the destination is known, AND the aim point is over the body they
// are travelling toward (`aimOnTarget`). Aim away → it hides; glance back to check.
// Pure + exported so the gate is unit-tested without a canvas. NOTE: this gates
// the ETA COUNTER only — the SAFE TO DROP / SLOW DOWN drop labels are an approach-
// SAFETY cue and stay on `hasTarget`, not here.
export function etaVisible({ speed, targetDistance, aimOnTarget } = {}) {
  return speed > 0 && targetDistance != null && !!aimOnTarget;
}

// ── THE LAYOUT, IN BUFFER PIXELS ──
// Every number below is world pixels, not CSS pixels. The old values were CSS px against a ~1080-tall
// window; these are their ~0.222x counterparts, re-rounded to integers and then re-spaced so the cap
// height has room. On the shipped 5x7 face the bottom-left cluster is 32 rows tall (41 with the
// SUBLIGHT tag) out of 240 — about 13% of the screen, up from 7.8% before this workstream. That
// growth is the direct cost of legibility: a letter cannot be a letter in fewer rows, and no
// magnification adds rows. The vertical spacings below are expressed in terms of TEXT_H rather than
// as constants, so the cluster re-flows when the face changes instead of overlapping itself.
// ⛔ NO MODULE-LEVEL `TEXT_H`. It was `pixelTextHeight(1)` here, read ONCE at import — which strands
// the whole vertical layout on whichever face happened to be active at boot, and the face is now
// switchable for the A/B. Same failure the shared-object comments in `renderBuffer.js` and
// `pixelScaleUniform.js` describe. It is read per-frame inside `update()` instead.
const LX = 6;                        // left margin of the cluster (was 24 CSS px)
const BAR_W = 60;                    // log speed bar width (was 180)
const BAR_H = 4;                     // bar height — 4 so a two-tone fill HAS an interior (was 8)
const TBAR_W = 40;                   // throttle bar width (was 120), same 2:3 ratio to BAR_W
const PIN_H = 4;                     // commanded-speed / throttle pin: a 1xPIN_H column (was a triangle)
const BOTTOM_MARGIN = 3;
const CROSS_GAP = 3;                 // texels of clear space between screen centre and each arm
const CROSS_ARM = 4;                 // arm length in texels
const DOT = 3;                       // deflection dot: a hard 3x3 block

// Inks. The track tone is the dim half of the two-tone bar: a `strokeRect` outline would be a 1-px
// stroke, which is exactly the smear rule 1 above forbids, so the "empty" part of a bar is a FILL.
const INK_CYAN = '#9fe8ff';
const INK_TRACK = '#1e3d47';
const INK_AMBER = '#ffb84d';
const INK_GREEN = '#7bff9e';
const INK_RED = '#ff7b6b';
const INK_RETICLE = '#64ff82';
const INK_PIN = '#ffffff';

export class SupercruiseHud {
  constructor(camera) {
    this.camera = camera;
    this.canvas = document.createElement('canvas');
    // ⭐ The id is what `#supercruise-hud` in style.css hangs the `image-rendering` pair on. It is
    // NOT set inline here: a browser that supports both declarations must resolve this canvas and
    // `#canvas` to the same resampling, and the only way to guarantee that is the same two
    // declarations in the same order in the same stylesheet.
    this.canvas.id = 'supercruise-hud';
    Object.assign(this.canvas.style, {
      position: 'fixed', inset: '0', display: 'block', pointerEvents: 'none', zIndex: 51,
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this._v = new THREE.Vector3();
    this._last = null;            // inspection probe
    this._drawn = [];             // what _drawPixelText put on the glass this frame
    this._w = 1; this._h = 1;
    this._cssW = -1; this._cssH = -1;
    this._syncBuffer();
    window.addEventListener('resize', () => this._syncBuffer());
  }

  /**
   * Match the backing store to the world buffer and the CSS box to the window.
   *
   * ⛔ NOT A `_resize()` AND NOT DPR-SCALED. The old one multiplied the window by `devicePixelRatio`
   * and set a matching context transform, which is the "draw the chrome as sharp as the display
   * allows" move this whole workstream exists to undo. There is no transform here at all: one unit
   * is one buffer pixel.
   */
  _syncBuffer() {
    const b = resolveRenderBuffer(innerWidth, innerHeight);
    if (this.canvas.width !== b.width || this.canvas.height !== b.height) {
      this.canvas.width = b.width;
      this.canvas.height = b.height;
    }
    // Guarded because `update()` calls this every frame and an unconditional style write is a
    // layout invalidation per frame for no change.
    if (this._cssW !== innerWidth || this._cssH !== innerHeight) {
      this._cssW = innerWidth; this._cssH = innerHeight;
      this.canvas.style.width = innerWidth + 'px';
      this.canvas.style.height = innerHeight + 'px';
    }
    this._w = this.canvas.width;
    this._h = this.canvas.height;
  }

  /**
   * The one text path. A WRAPPER, deliberately — not a `push` beside each call site, because two
   * adjacent statements drift and the recorded list would then disagree with the glass.
   *
   * ⚠ HONEST WEAKENING, FLAGGED NOT HIDDEN. `getDrawnText()` is a class SELF-REPORT, where
   * `helpers/headlessNav.mjs` deliberately asks the CONTEXT what it drew — because this lane's
   * source scans were proven evadable seven ways. Bitmap text reaches the context as `fillRect`
   * calls with no string in them, so a recording context cannot recover it without decoding the
   * texels back through the glyph table. Mitigations: this single wrapper, the default
   * `onMissing:'throw'` (an unrenderable literal is loud, not silent), and the reticle geometry
   * assertions staying at the glass where they always were.
   */
  _drawPixelText(str, x, y, opts) {
    this._drawn.push(String(str));
    return drawPixelText(this.ctx, str, x, y, opts);
  }

  /** Every string this HUD put on the glass during the last `update()`, in draw order. */
  getDrawnText() { return this._drawn.slice(); }

  _project(worldPos) {
    this._v.copy(worldPos).project(this.camera);
    if (this._v.z > 1) return null;
    return { x: (this._v.x * 0.5 + 0.5) * this._w, y: (-this._v.y * 0.5 + 0.5) * this._h };
  }

  /**
   * Keep a label fully on the buffer. ⛔ THE FIX IS A CLAMP, NOT A SHORTER STRING. 'SAFE TO DROP'
   * is 47 buffer px wide where the old 13px-monospace form was ~20, so near the right edge it now
   * runs off — and it is a readout the pilot flies with, so shortening it is not available.
   */
  _clampX(x, str, scale = 1) {
    return Math.max(2, Math.min(Math.round(x), this._w - measurePixelText(str, scale) - 2));
  }

  /** state: {
   *   visible, speed, commandedSpeed, throttle, deflection:{x,y},
   *   targetPos|null, targetDistance|null, captureSphere|null,
   *   aimOnTarget?: boolean,  // aim point is over the travelled-toward body —
   *                           // gates the contextual ETA counter only (Unit 3).
   *   dropMaxSpeed|null, dropState: 'none'|'in-window'|'too-fast',
   *   flightMode: 'manual'|'align'|'assist'|null,
   *   showReticle?: boolean   // gate the center cross + deflection dot (the
   *                           // STEERING indicators). Default true (back-compat);
   *                           // set false in free-look so they hide while looking
   *                           // around.
   *   showReadouts?: boolean  // gate the NUMBERS — the bottom-left speed/throttle
   *                           // cluster and the MODE line. Default true; set false
   *                           // in HELM, where the cockpit's DRIVE panel is their
   *                           // replacement. See the block below.
   * } */
  update(state) {
    this._syncBuffer();
    const c = this.ctx; c.clearRect(0, 0, this._w, this._h);
    this._drawn.length = 0;
    this._last = state;
    if (!state.visible) return;
    const w = this._w, h = this._h;
    const cx = Math.round(w / 2), cy = Math.round(h / 2);
    const TEXT_H = pixelTextHeight(1);   // 7 on the shipped 5x7 face — read live, see the note above

    const speed = state.speed || 0;
    const commandedSpeed = state.commandedSpeed || 0;
    const hasTarget = !!state.targetPos;
    const dropMaxSpeed = state.dropMaxSpeed;

    // ⭐ READOUT vs CONTROL — the line AC-OVERLAYS-RETIRE-IN-HELM is drawn on.
    //
    // This canvas draws six things, and DIEGETIC-ONLY retires some of them and
    // not others. The AC's words are "the DOM/canvas flight READOUTS are gone",
    // and the discriminator is whether the cockpit can replace it:
    //
    //   RETIRED in HELM (`showReadouts: false`) — the bottom-left speed +
    //     throttle cluster and the top-centre MODE line. Both are duplicated
    //     verbatim on the DRIVE panel's glass; before this they were on screen
    //     TWICE at once, which is the exact contradiction DIEGETIC-ONLY exists
    //     to remove.
    //
    //   KEPT — the centre reticle cross and deflection dot, because they are a
    //     CONTROL, not a readout: they are how the stick is aimed, and no panel
    //     can draw a cross at screen centre. Retiring the canvas wholesale would
    //     have taken them, and taking them breaks aiming — the subject of
    //     AC-IT-FEELS-LIKE-FLYING-FROM-INSIDE.
    //
    //   KEPT — the mass-lock "TOO CLOSE" hint (a transient alert with no panel
    //     equivalent) and the ETA / SAFE-TO-DROP cue, which is drawn AT THE BODY
    //     in world space. The TARGET panel carries the same words, but not the
    //     same information: the panel says how far, the world cue says WHICH.
    //     ⚠ That last one is a judgement call and Max can reverse it by moving
    //     the `hasTarget` block under this flag — it is one line.
    const showReadouts = state.showReadouts !== false;

    // Speed-band color: blue-green in the safe drop window, red when too fast,
    // else cyan. "Safe" is dropState in-window OR (target set and speed under
    // the drop ceiling) — reproduces Elite's sweet-spot band from real physics.
    // ⚠ COMPUTED ABOVE THE READOUT GATE ON PURPOSE: `tooFast` also drives the
    // SLOW DOWN label in the target-cue block, which is KEPT in HELM. Leaving it
    // inside the gate would put that label in a TDZ the moment the readouts go.
    const inWindow = state.dropState === 'in-window'
      || (hasTarget && dropMaxSpeed != null && speed <= dropMaxSpeed);
    const tooFast = state.dropState === 'too-fast';
    const speedColor = tooFast ? INK_RED : inWindow ? INK_GREEN : INK_CYAN;

    // ── Bottom-left cluster: numeric speed, log speed bar, throttle bar ──
    // Stacked upward from the bottom margin so the whole cluster tracks the buffer height rather
    // than a hard-coded 1080-tall window.
    const tbY = h - BOTTOM_MARGIN - PIN_H - BAR_H;   // throttle bar top
    const sbY = tbY - 7;                             // speed bar top
    const spdY = sbY - PIN_H - 1 - TEXT_H - 2;       // numeric speed, top row
    const subY = spdY - TEXT_H - 2;                  // SUBLIGHT tag, top row

    if (showReadouts) {
    // (1) Large numeric speed (the "reads 0" bug fix). formatSpeed returns a
    // magnitude (Math.abs), so prefix "REV " when reversing to read clearly.
    // ⛔ "Large" is now FIVE ROWS, not 22px. The face has one authored size and the lever if Max
    // says the speed does not read is `scale: 2` here — which doubles it to a 10-row cap, ~47
    // screen px at 240p. Not taken on the first landing: 3x today's is a big jump to make unasked.
    const spd = formatSpeed(speed);
    const spdPrefix = speed < 0 ? 'REV ' : '';
    this._drawPixelText(`${spdPrefix}${spd.value} ${spd.unit}`, LX, spdY, { color: INK_CYAN });

    // SUBLIGHT mode tag — shown whenever the supercruise drive is dropped out, so
    // the player knows they left supercruise (distinct axis from the flight-assist
    // MODE: readout up top). Amber to match the reverse tone.
    if (state.driveOn === false) {
      this._drawPixelText('SUBLIGHT', LX, subY, { color: INK_AMBER });
    }

    // (2) Horizontal LOG speed bar: fill to actual magnitude (speedToBarFrac is
    // not abs-safe; speed can be negative in reverse); pin at commanded; drop tick.
    // ⛔ The track is a FILL, not a strokeRect. At BAR_H = 4 an outline would eat two of the four
    // rows and leave a two-row interior; the two-tone fill keeps all four rows readable as a level.
    c.fillStyle = INK_TRACK;
    c.fillRect(LX, sbY, BAR_W, BAR_H);
    if (state.driveOn === false) {
      // SUBLIGHT: linear bipolar bar — center zero, right = forward, left (amber) = reverse.
      const cxBar = LX + Math.round(BAR_W / 2);
      const frac = sublightBarFrac(speed, state.sublightCap || 1);
      const bw = Math.round((BAR_W / 2) * Math.abs(frac));
      c.fillStyle = frac < 0 ? INK_AMBER : speedColor;
      if (frac >= 0) c.fillRect(cxBar, sbY, bw, BAR_H);
      else c.fillRect(cxBar - bw, sbY, bw, BAR_H);
      // center zero-mark: a 1-px column crossing the bar, one row proud top and bottom so it is
      // still visible where the fill already covers it.
      c.fillStyle = INK_CYAN;
      c.fillRect(cxBar, sbY - 1, 1, BAR_H + 2);
    } else {
      c.fillStyle = speedColor;
      c.fillRect(LX, sbY, Math.round(BAR_W * speedToBarFrac(Math.abs(speed))), BAR_H);
    }

    // commanded "pin" — actual chases this. A 1-px column standing ON the bar, not a triangle: at
    // this size a triangle is three rows of 3/2/1 texels and reads as a smudge, a column does not.
    const pinX = LX + Math.round(BAR_W * speedToBarFrac(commandedSpeed));
    c.fillStyle = INK_PIN;
    c.fillRect(Math.min(pinX, LX + BAR_W - 1), sbY - PIN_H - 1, 1, PIN_H);

    // drop-here tick (vertical mark across the bar) when a target is selected.
    if (hasTarget && dropMaxSpeed != null) {
      const tickX = LX + Math.round(BAR_W * speedToBarFrac(dropMaxSpeed));
      c.fillStyle = INK_GREEN;
      c.fillRect(Math.min(tickX, LX + BAR_W - 1), sbY - 1, 1, BAR_H + 2);
    }

    // (3) BIDIRECTIONAL throttle bar (-100%..+100%). The model now allows reverse
    // throttle, so the bar fills RIGHT of a center zero-mark for forward and LEFT
    // (amber = reverse) for negative throttle, with a commanded pin at the tip.
    const tbCenterX = LX + Math.round(TBAR_W / 2);        // zero-throttle mark
    const throttle = Math.min(1, Math.max(-1, state.throttle || 0));
    c.fillStyle = INK_TRACK;
    c.fillRect(LX, tbY, TBAR_W, BAR_H);
    // fill from center: right = forward (cyan), left = reverse (amber).
    const fillW = Math.round((TBAR_W / 2) * Math.abs(throttle));
    if (throttle >= 0) {
      c.fillStyle = INK_CYAN;
      c.fillRect(tbCenterX, tbY, fillW, BAR_H);
    } else {
      c.fillStyle = INK_AMBER;                            // distinct amber reverse tone
      c.fillRect(tbCenterX - fillW, tbY, fillW, BAR_H);
    }
    c.fillStyle = INK_CYAN;
    c.fillRect(tbCenterX, tbY - 1, 1, BAR_H + 2);         // center zero-mark
    const tPinX = tbCenterX + Math.round((TBAR_W / 2) * throttle);   // pin at the fill tip
    c.fillStyle = INK_PIN;
    c.fillRect(Math.min(tPinX, LX + TBAR_W - 1), tbY + BAR_H + 1, 1, PIN_H);
    } // end showReadouts — the bottom-left cluster

    // ── Center reticle: cross + deflection dot ── (STEERING indicators)
    // Game reticle green (#64ff82 — TargetingReticle's selected-reticle green)
    // so the supercruise aim cross reads as one piece with the body reticles.
    // Gated by showReticle (default true): hidden in free-look, where the cross +
    // deflection dot don't belong (§free-look-interaction-redesign Part 1). The
    // speed/throttle readouts above always draw — only these two hide.
    // ⛔ FOUR fillRect ARMS AROUND A GAP, NOT A STROKED CROSS. The old cross was one path stroked
    // 1px wide through the exact centre pixel, which straddles it: the mark the pilot aims with was
    // two grey half-rows. These are four opaque texel bars with a CROSS_GAP hole at centre, so the
    // body being aimed at is never covered by the aiming mark.
    if (state.showReticle !== false) {
      c.fillStyle = INK_RETICLE;
      c.fillRect(cx + CROSS_GAP, cy, CROSS_ARM, 1);
      c.fillRect(cx - CROSS_GAP - CROSS_ARM + 1, cy, CROSS_ARM, 1);
      c.fillRect(cx, cy + CROSS_GAP, 1, CROSS_ARM);
      c.fillRect(cx, cy - CROSS_GAP - CROSS_ARM + 1, 1, CROSS_ARM);
      const jr = Math.min(w, h) * 0.25;
      const dx = Math.round(cx + state.deflection.x * jr);
      const dy = Math.round(cy + state.deflection.y * jr);
      c.fillRect(dx - ((DOT - 1) >> 1), dy - ((DOT - 1) >> 1), DOT, DOT);
    }

    // ── Target cue: ETA + drop label ──
    // The game's green TargetingReticle already marks the selected body, so we
    // draw no box here (it duplicated the reticle). The ETA + drop cue sits
    // BELOW the body so it clears the reticle's name label above/beside it.
    if (hasTarget) {
      const p = this._project(state.targetPos);
      if (p) {
        const cueY = Math.round(p.y) + 7;   // offset below the body, clear of the name label

        // ETA "M:SS" = distance / speed. CONTEXTUAL (§targeting-brackets-
        // contextual-eta Unit 3): the counter LINE is drawn ONLY when the aim
        // point is over the body you're travelling toward (state.aimOnTarget) —
        // aim away → it hides ENTIRELY (no '--:--' placeholder left lingering,
        // which is what made it feel non-contextual). When aimed-on but not yet
        // moving / distance unknown it shows '--:--'. Only the COUNTER is gated;
        // the drop labels below stay on `hasTarget` (approach-safety cue).
        if (state.aimOnTarget) {
          let eta = '--:--';
          if (etaVisible({ speed, targetDistance: state.targetDistance, aimOnTarget: state.aimOnTarget })) {
            const secs = state.targetDistance / speed;
            if (Number.isFinite(secs)) {
              const m = Math.floor(secs / 60);
              const s = Math.floor(secs % 60);
              eta = `${m}:${s.toString().padStart(2, '0')}`;
            }
          }
          this._drawPixelText(eta, this._clampX(p.x + 4, eta), cueY, { color: INK_CYAN });
        }

        // Drop label: SAFE TO DROP (green) / SLOW DOWN (amber).
        if (state.dropState === 'in-window') {
          this._drawPixelText('SAFE TO DROP', this._clampX(p.x + 4, 'SAFE TO DROP'),
            cueY + TEXT_H + 2, { color: INK_GREEN });
        } else if (tooFast) {
          this._drawPixelText('SLOW DOWN', this._clampX(p.x + 4, 'SLOW DOWN'),
            cueY + TEXT_H + 2, { color: INK_AMBER });
        }
      }
    }

    // ── Flight-assist mode readout (upper-center, reticle green) ──
    // The toast announces each mode on entry; this is the persistent indicator
    // of which assist mode is live while flying. One string, no new layout.
    if (state.flightMode && showReadouts) {
      this._drawPixelText(`MODE: ${state.flightMode.toUpperCase()}`, cx, 6,
        { color: INK_RETICLE, align: 'center' });
    }

    // Mass-lock hint: a brief "TOO CLOSE" when the player tried to re-engage
    // supercruise inside a body's forced-drop zone (spec §Unit 5).
    if (state.massLockHint) {
      this._drawPixelText('TOO CLOSE — SUBLIGHT ONLY', cx, cy + 12,
        { color: INK_RED, align: 'center' });
    }
  }

  getLastFrameState() { return this._last; }  // SceneInspector-style probe
}
