// src/ui/SupercruiseHud.js
//
// Minimal supercruise HUD (AC7): speed readout, throttle bar, virtual-joystick
// reticle, target marker + drop window. Pure view — main.js passes state each
// render frame. Pattern: src/ui/TargetingReticle.js (own canvas, _project).
import * as THREE from 'three';

export class SupercruiseHud {
  constructor(camera) {
    this.camera = camera;
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 51,
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
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _project(worldPos) {
    this._v.copy(worldPos).project(this.camera);
    if (this._v.z > 1) return null;
    return { x: (this._v.x * 0.5 + 0.5) * innerWidth, y: (-this._v.y * 0.5 + 0.5) * innerHeight };
  }

  /** state: { visible, speed, throttle, deflection:{x,y}, targetPos|null,
   *           dropState: 'none'|'in-window'|'too-fast' } */
  update(state) {
    const c = this.ctx; c.clearRect(0, 0, innerWidth, innerHeight);
    this._last = state;
    if (!state.visible) return;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    c.strokeStyle = c.fillStyle = '#9fe8ff'; c.font = '13px monospace'; c.lineWidth = 1;

    // Speed readout + throttle bar (bottom-left)
    c.fillText(`SPD ${state.speed.toFixed(0)} u/s`, 24, innerHeight - 48);
    c.strokeRect(24, innerHeight - 40, 120, 8);
    c.fillRect(24, innerHeight - 40, 120 * state.throttle, 8);

    // Virtual-joystick reticle: center cross + deflection dot
    c.beginPath(); c.moveTo(cx - 10, cy); c.lineTo(cx + 10, cy);
    c.moveTo(cx, cy - 10); c.lineTo(cx, cy + 10); c.stroke();
    const jr = Math.min(innerWidth, innerHeight) * 0.25;
    c.beginPath();
    c.arc(cx + state.deflection.x * jr, cy + state.deflection.y * jr, 4, 0, Math.PI * 2);
    c.fill();

    // Target marker + drop window
    if (state.targetPos) {
      const p = this._project(state.targetPos);
      if (p) {
        c.strokeStyle = state.dropState === 'too-fast' ? '#ff7b6b'
          : state.dropState === 'in-window' ? '#7bff9e' : '#9fe8ff';
        c.strokeRect(p.x - 14, p.y - 14, 28, 28);
        if (state.dropState !== 'none') {
          c.fillStyle = c.strokeStyle;
          c.fillText(state.dropState === 'in-window' ? 'DROP READY' : 'TOO FAST', p.x + 18, p.y);
        }
      }
    }
  }

  getLastFrameState() { return this._last; }  // SceneInspector-style probe
}
