// src/ui/SupercruiseHud.js
//
// Minimal supercruise HUD (AC7): speed readout, throttle bar, virtual-joystick
// reticle, target marker + drop window. Pure view — main.js passes state each
// render frame. Pattern: src/ui/TargetingReticle.js (own canvas, _project).
import * as THREE from 'three';
import { formatSpeed, speedToBarFrac } from './SpeedFormat.js';

export class SupercruiseHud {
  constructor(camera) {
    this.camera = camera;
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      position: 'fixed', inset: '0', display: 'block', pointerEvents: 'none', zIndex: 51,
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this._v = new THREE.Vector3();
    this._last = null;            // inspection probe
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = innerWidth * dpr; this.canvas.height = innerHeight * dpr;
    this.canvas.style.width = innerWidth + 'px';
    this.canvas.style.height = innerHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _project(worldPos) {
    this._v.copy(worldPos).project(this.camera);
    if (this._v.z > 1) return null;
    return { x: (this._v.x * 0.5 + 0.5) * innerWidth, y: (-this._v.y * 0.5 + 0.5) * innerHeight };
  }

  /** state: {
   *   visible, speed, commandedSpeed, throttle, deflection:{x,y},
   *   targetPos|null, targetDistance|null, captureSphere|null,
   *   dropMaxSpeed|null, dropState: 'none'|'in-window'|'too-fast'
   * } */
  update(state) {
    const c = this.ctx; c.clearRect(0, 0, innerWidth, innerHeight);
    this._last = state;
    if (!state.visible) return;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    c.lineWidth = 1;

    const speed = state.speed || 0;
    const commandedSpeed = state.commandedSpeed || 0;
    const hasTarget = !!state.targetPos;
    const dropMaxSpeed = state.dropMaxSpeed;

    // ── Bottom-left cluster: numeric speed, log speed bar, throttle bar ──
    const lx = 24;                 // left margin of the cluster
    const barW = 180;              // log speed bar width

    // (1) Large numeric speed (the "reads 0" bug fix).
    const spd = formatSpeed(speed);
    c.fillStyle = '#9fe8ff';
    c.font = '22px monospace';
    c.fillText(`${spd.value} ${spd.unit}`, lx, innerHeight - 66);

    // Speed-band color: blue-green in the safe drop window, red when too fast,
    // else cyan. "Safe" is dropState in-window OR (target set and speed under
    // the drop ceiling) — reproduces Elite's sweet-spot band from real physics.
    const inWindow = state.dropState === 'in-window'
      || (hasTarget && dropMaxSpeed != null && speed <= dropMaxSpeed);
    const tooFast = state.dropState === 'too-fast';
    const speedColor = tooFast ? '#ff7b6b' : inWindow ? '#7bff9e' : '#9fe8ff';

    // (2) Horizontal LOG speed bar: fill to actual; pin at commanded; drop tick.
    const sbY = innerHeight - 52, sbH = 8;
    c.strokeStyle = '#9fe8ff';
    c.strokeRect(lx, sbY, barW, sbH);
    c.fillStyle = speedColor;
    c.fillRect(lx, sbY, barW * speedToBarFrac(speed), sbH);

    // commanded "pin" (downward triangle above the bar) — actual chases this.
    const pinX = lx + barW * speedToBarFrac(commandedSpeed);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(pinX - 4, sbY - 7); c.lineTo(pinX + 4, sbY - 7); c.lineTo(pinX, sbY - 1);
    c.closePath(); c.fill();

    // drop-here tick (vertical mark across the bar) when a target is selected.
    if (hasTarget && dropMaxSpeed != null) {
      const tickX = lx + barW * speedToBarFrac(dropMaxSpeed);
      c.strokeStyle = '#7bff9e';
      c.beginPath(); c.moveTo(tickX, sbY - 2); c.lineTo(tickX, sbY + sbH + 2); c.stroke();
    }

    // (3) Throttle bar (0–100%) with its own commanded pin at the throttle pos.
    const tbY = innerHeight - 40, tbW = 120, tbH = 8;
    c.strokeStyle = '#9fe8ff';
    c.strokeRect(lx, tbY, tbW, tbH);
    c.fillStyle = '#9fe8ff';
    c.fillRect(lx, tbY, tbW * (state.throttle || 0), tbH);
    const tPinX = lx + tbW * Math.min(1, Math.max(0, state.throttle || 0));
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(tPinX - 3, tbY + tbH + 6); c.lineTo(tPinX + 3, tbY + tbH + 6); c.lineTo(tPinX, tbY + tbH);
    c.closePath(); c.fill();

    // ── Center reticle: cross + deflection dot ──
    c.strokeStyle = '#9fe8ff'; c.fillStyle = '#9fe8ff';
    c.beginPath(); c.moveTo(cx - 10, cy); c.lineTo(cx + 10, cy);
    c.moveTo(cx, cy - 10); c.lineTo(cx, cy + 10); c.stroke();
    const jr = Math.min(innerWidth, innerHeight) * 0.25;
    c.beginPath();
    c.arc(cx + state.deflection.x * jr, cy + state.deflection.y * jr, 4, 0, Math.PI * 2);
    c.fill();

    // ── Target marker: box + ETA + drop label ──
    if (hasTarget) {
      const p = this._project(state.targetPos);
      if (p) {
        c.strokeStyle = tooFast ? '#ff7b6b'
          : state.dropState === 'in-window' ? '#7bff9e' : '#9fe8ff';
        c.strokeRect(p.x - 14, p.y - 14, 28, 28);

        c.font = '13px monospace';

        // ETA "M:SS" = distance / speed (only when moving + target set).
        let eta = '--:--';
        if (speed > 0 && state.targetDistance != null) {
          const secs = state.targetDistance / speed;
          if (Number.isFinite(secs)) {
            const m = Math.floor(secs / 60);
            const s = Math.floor(secs % 60);
            eta = `${m}:${s.toString().padStart(2, '0')}`;
          }
        }
        c.fillStyle = '#9fe8ff';
        c.fillText(eta, p.x + 18, p.y);

        // Drop label: SAFE TO DROP (green) / SLOW DOWN (amber).
        if (state.dropState === 'in-window') {
          c.fillStyle = '#7bff9e';
          c.fillText('SAFE TO DROP', p.x + 18, p.y + 16);
        } else if (tooFast) {
          c.fillStyle = '#ffb84d';
          c.fillText('SLOW DOWN', p.x + 18, p.y + 16);
        }
      }
    }
  }

  getLastFrameState() { return this._last; }  // SceneInspector-style probe
}
