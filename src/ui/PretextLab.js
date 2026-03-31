/**
 * PretextLab — Experimental overlay for testing @chenglou/pretext text layout
 * Toggle with X key. A playground for exploring text rendering ideas for Well Dipper.
 *
 * Three demo modes (cycle with Tab while open):
 *   1. Terminal Log — procedural star system text with live reflow
 *   2. Typographic ASCII — proportional-font particle art (brightness + width matching)
 *   3. Illuminated Text — flowing text with animated decoration (future: EG liturgy experiments)
 */

import { prepare, layout, prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

// ── Demo mode enum ──
const MODES = ['terminal', 'ascii', 'illuminated'];
const MODE_LABELS = ['TERMINAL LOG', 'TYPOGRAPHIC ASCII', 'ILLUMINATED TEXT'];

export class PretextLab {
  constructor() {
    this._canvas = null;
    this._ctx = null;
    this._overlay = null;
    this._active = false;
    this._mode = 0;
    this._frame = 0;
    this._rafId = null;
    this._onKey = null;

    // ASCII art state
    this._particles = [];
    this._brightness = null;
    this._charMetrics = null;
    this._gridW = 80;
    this._gridH = 40;

    // Terminal state
    this._logLines = [];
    this._logScroll = 0;

    // Illuminated state
    this._illuminatedTime = 0;
  }

  // ── Lifecycle ──

  activate() {
    this._overlay = document.getElementById('pretext-lab-overlay');
    this._canvas = document.getElementById('pretext-lab-canvas');
    if (!this._canvas || !this._overlay) return;
    this._ctx = this._canvas.getContext('2d');
    this._active = true;
    this._frame = 0;

    // Size canvas to panel
    this._resize();

    // Init current mode
    this._initMode();

    // Keyboard handler (Tab to switch modes)
    this._onKey = (e) => {
      if (e.code === 'Tab' && this._active) {
        e.preventDefault();
        e.stopPropagation();
        this._mode = (this._mode + 1) % MODES.length;
        this._initMode();
      }
    };
    window.addEventListener('keydown', this._onKey, true);

    // Start render loop
    this._renderLoop();
  }

  deactivate() {
    this._active = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._onKey) {
      window.removeEventListener('keydown', this._onKey, true);
      this._onKey = null;
    }
  }

  _resize() {
    const panel = this._canvas.parentElement;
    const w = panel.clientWidth - 2; // minus border
    const h = panel.clientHeight - 50; // minus header area
    this._canvas.width = w * window.devicePixelRatio;
    this._canvas.height = h * window.devicePixelRatio;
    this._canvas.style.width = w + 'px';
    this._canvas.style.height = h + 'px';
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this._canvasW = w;
    this._canvasH = h;
  }

  _renderLoop() {
    if (!this._active) return;
    this._frame++;
    this._render();
    this._rafId = requestAnimationFrame(() => this._renderLoop());
  }

  // ── Mode initialization ──

  _initMode() {
    const mode = MODES[this._mode];
    if (mode === 'terminal') this._initTerminal();
    else if (mode === 'ascii') this._initAscii();
    else if (mode === 'illuminated') this._initIlluminated();
  }

  // ── TERMINAL LOG MODE ──

  _initTerminal() {
    this._logLines = [];
    this._logScroll = 0;

    // Generate some star system flavor text
    const systemNames = [
      'KEPLER-442', 'HD 219134', 'TRAPPIST-1', 'ROSS 128', 'PROXIMA CENTAURI',
      'GLIESE 667C', 'TAU CETI', 'WOLF 1061', 'LUYTEN-b', 'BARNARD\'S STAR'
    ];
    const bodyTypes = ['gas giant', 'rocky world', 'ice giant', 'molten dwarf', 'ocean world', 'desert planet'];
    const events = [
      'Gravitational anomaly detected in outer belt.',
      'Spectral analysis complete. Atmosphere: N₂/O₂ mix.',
      'WARNING: Radiation levels exceed safe threshold.',
      'Navigation beacon acquired. Signal age: 4,200 years.',
      'Subsurface ocean confirmed via tidal flexion data.',
      'Magnetic field orientation: retrograde.',
      'Uncharted asteroid cluster — recommend deceleration.',
      'Binary companion detected at 0.3 AU separation.',
      'Surface temperature: 287K. Liquid water probable.',
      'Deep scan reveals metallic core, 40% iron by mass.',
      'Atmospheric lightning detected on nightside.',
      'Ring system: silicate dust, ~12,000 km radius.',
      'Orbital resonance: 3:2 with inner neighbor.',
      'Cryovolcanic plumes observed at southern pole.',
    ];

    const sys = systemNames[Math.floor(Math.random() * systemNames.length)];
    const numBodies = 3 + Math.floor(Math.random() * 5);

    this._logLines.push(`╔══════════════════════════════════════════════╗`);
    this._logLines.push(`║  WELL-DIPPER NAVIGATION TERMINAL v2.4.1     ║`);
    this._logLines.push(`╚══════════════════════════════════════════════╝`);
    this._logLines.push('');
    this._logLines.push(`> SYSTEM: ${sys}`);
    this._logLines.push(`> BODIES: ${numBodies} detected`);
    this._logLines.push(`> DISTANCE: ${(Math.random() * 500 + 10).toFixed(1)} ly from Sol`);
    this._logLines.push('');
    this._logLines.push('─── SCAN LOG ───');
    this._logLines.push('');

    for (let i = 0; i < numBodies; i++) {
      const type = bodyTypes[Math.floor(Math.random() * bodyTypes.length)];
      const radius = (Math.random() * 15 + 0.3).toFixed(1);
      const orbit = (Math.random() * 30 + 0.1).toFixed(2);
      this._logLines.push(`[${String(i + 1).padStart(2, '0')}] ${type.toUpperCase()} — R: ${radius} R⊕  Orbit: ${orbit} AU`);
      // Add 1-2 random events per body
      const numEvents = 1 + Math.floor(Math.random() * 2);
      for (let j = 0; j < numEvents; j++) {
        const evt = events[Math.floor(Math.random() * events.length)];
        this._logLines.push(`     ${evt}`);
      }
      this._logLines.push('');
    }

    this._logLines.push('─── END SCAN ───');
    this._logLines.push('');
    this._logLines.push('This text is laid out using @chenglou/pretext — no DOM measurement.');
    this._logLines.push('Resize your browser window to see live reflow. The height calculation');
    this._logLines.push('is pure arithmetic after the initial prepare() call.');
    this._logLines.push('');
    this._logLines.push('Press TAB to cycle demo modes.');
  }

  // ── TYPOGRAPHIC ASCII MODE ──

  _initAscii() {
    // Particle system — 80 particles, 2 attractors
    this._particles = [];
    for (let i = 0; i < 80; i++) {
      this._particles.push({
        x: Math.random() * this._gridW,
        y: Math.random() * this._gridH,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
      });
    }
    this._brightness = new Float32Array(this._gridW * this._gridH);

    // Pre-measure character widths with pretext for brightness mapping
    const charset = ' .,:;!+-=*#@%&';
    this._charMetrics = [];
    for (const ch of charset) {
      try {
        const p = prepareWithSegments(ch, '14px monospace');
        const { lines } = layoutWithLines(p, 1000, 16);
        const w = lines.length > 0 ? lines[0].width : 8;
        this._charMetrics.push({ ch, width: w });
      } catch {
        this._charMetrics.push({ ch, width: 8 });
      }
    }
    // Sort by "visual weight" (approximated by char code density)
    this._charMetrics.sort((a, b) => {
      const wa = a.ch === ' ' ? 0 : a.ch.charCodeAt(0) % 30;
      const wb = b.ch === ' ' ? 0 : b.ch.charCodeAt(0) % 30;
      return wa - wb;
    });
  }

  // ── ILLUMINATED TEXT MODE ──

  _initIlluminated() {
    this._illuminatedTime = 0;
  }

  // ── Main render dispatch ──

  _render() {
    const ctx = this._ctx;
    const w = this._canvasW;
    const h = this._canvasH;

    // Clear
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);

    // Mode label
    ctx.fillStyle = 'rgba(100, 180, 255, 0.5)';
    ctx.font = '11px "DotGothic16", monospace';
    ctx.fillText(`MODE: ${MODE_LABELS[this._mode]}  [TAB to switch]`, 12, 18);

    const mode = MODES[this._mode];
    if (mode === 'terminal') this._renderTerminal(ctx, w, h);
    else if (mode === 'ascii') this._renderAscii(ctx, w, h);
    else if (mode === 'illuminated') this._renderIlluminated(ctx, w, h);

    ctx.restore();
  }

  // ── TERMINAL RENDER ──

  _renderTerminal(ctx, w, h) {
    const padding = 16;
    const maxWidth = w - padding * 2;
    const lineHeight = 18;
    const font = '13px "DotGothic16", monospace';
    let y = 36;

    ctx.fillStyle = '#88ccff';
    ctx.font = font;

    for (const line of this._logLines) {
      if (line.length === 0) {
        y += lineHeight * 0.6;
        continue;
      }

      try {
        // Use pretext to measure — the key demo!
        const prepared = prepare(line, font);
        const result = layout(prepared, maxWidth, lineHeight);

        // Draw with wrapping info from pretext
        if (result.lineCount <= 1) {
          // Single line — simple draw
          const isHeader = line.startsWith('╔') || line.startsWith('╚') || line.startsWith('║') || line.startsWith('───');
          const isWarning = line.includes('WARNING');
          const isLabel = line.startsWith('>');

          ctx.fillStyle = isWarning ? '#ff6655'
            : isHeader ? 'rgba(100, 180, 255, 0.6)'
            : isLabel ? '#66ddaa'
            : '#88ccff';
          ctx.fillText(line, padding, y);
          y += lineHeight;
        } else {
          // Multi-line wrap — use pretext's height
          ctx.fillStyle = '#88ccff';
          // Simple word-wrap rendering (pretext told us the height)
          const words = line.split(' ');
          let currentLine = '';
          for (const word of words) {
            const test = currentLine ? currentLine + ' ' + word : word;
            const testPrep = prepare(test, font);
            const testResult = layout(testPrep, maxWidth, lineHeight);
            if (testResult.lineCount > 1 && currentLine) {
              ctx.fillText(currentLine, padding, y);
              y += lineHeight;
              currentLine = word;
            } else {
              currentLine = test;
            }
          }
          if (currentLine) {
            ctx.fillText(currentLine, padding, y);
            y += lineHeight;
          }
        }
      } catch {
        // Fallback: just draw the line
        ctx.fillStyle = '#88ccff';
        ctx.fillText(line, padding, y);
        y += lineHeight;
      }

      if (y > h - 10) break;
    }
  }

  // ── ASCII ART RENDER ──

  _renderAscii(ctx, w, h) {
    const gw = this._gridW;
    const gh = this._gridH;
    const br = this._brightness;

    // Decay brightness
    for (let i = 0; i < br.length; i++) {
      br[i] *= 0.85;
    }

    // Move attractors
    const t = this._frame * 0.02;
    const ax1 = gw * 0.5 + Math.cos(t) * gw * 0.25;
    const ay1 = gh * 0.5 + Math.sin(t * 0.7) * gh * 0.25;
    const ax2 = gw * 0.5 + Math.cos(t * 1.3 + 2) * gw * 0.2;
    const ay2 = gh * 0.5 + Math.sin(t * 0.9 + 1) * gh * 0.2;

    // Update particles
    for (const p of this._particles) {
      // Attract to both points
      const dx1 = ax1 - p.x, dy1 = ay1 - p.y;
      const dx2 = ax2 - p.x, dy2 = ay2 - p.y;
      const d1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) + 1;
      const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) + 1;

      p.vx += (dx1 / d1) * 0.08 + (dx2 / d2) * 0.05;
      p.vy += (dy1 / d1) * 0.08 + (dy2 / d2) * 0.05;

      // Damping
      p.vx *= 0.96;
      p.vy *= 0.96;

      p.x += p.vx;
      p.y += p.vy;

      // Wrap
      if (p.x < 0) p.x += gw;
      if (p.x >= gw) p.x -= gw;
      if (p.y < 0) p.y += gh;
      if (p.y >= gh) p.y -= gh;

      // Splat brightness
      const gx = Math.floor(p.x);
      const gy = Math.floor(p.y);
      const r = 2;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = ((gx + dx) % gw + gw) % gw;
          const ny = ((gy + dy) % gh + gh) % gh;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= r) {
            br[ny * gw + nx] = Math.min(1, br[ny * gw + nx] + (1 - dist / r) * 0.4);
          }
        }
      }
    }

    // Render characters
    const cellW = Math.floor((w - 24) / gw);
    const cellH = Math.floor((h - 40) / gh);
    const fontSize = Math.min(cellW, cellH, 14);
    const chars = this._charMetrics || [{ ch: '.', width: 8 }];

    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';

    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const val = br[gy * gw + gx];
        if (val < 0.01) continue;

        // Pick character by brightness
        const idx = Math.min(Math.floor(val * chars.length), chars.length - 1);
        const ch = chars[idx].ch;
        if (ch === ' ') continue;

        // Color: blue-white gradient based on brightness
        const r = Math.floor(100 + val * 155);
        const g = Math.floor(150 + val * 105);
        const b = Math.floor(200 + val * 55);
        const a = 0.3 + val * 0.7;
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;

        const px = 12 + gx * cellW;
        const py = 30 + gy * cellH;
        ctx.fillText(ch, px, py);
      }
    }
  }

  // ── ILLUMINATED TEXT RENDER ──

  _renderIlluminated(ctx, w, h) {
    this._illuminatedTime += 0.016;
    const t = this._illuminatedTime;

    const text = `In the space between thoughts, awareness shines of its own accord. ` +
      `Not produced, not maintained — simply present, like the sky behind clouds. ` +
      `Every sensation arrives already complete, already luminous, already free. ` +
      `The practice is not to create this, but to notice it is already the case.`;

    const padding = 40;
    const maxWidth = w - padding * 2;
    const font = '18px Georgia, serif';
    const lineHeight = 28;

    try {
      const prepared = prepareWithSegments(text, font);
      const { lines, height } = layoutWithLines(prepared, maxWidth, lineHeight);

      // Center vertically
      const startY = Math.max(50, (h - height) / 2);

      // Draw decorative border (animated)
      this._drawIlluminatedBorder(ctx, w, h, t, padding - 20, startY - 30, maxWidth + 40, height + 60);

      // Draw each line with animated color
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const y = startY + i * lineHeight;

        // Gentle color wave
        const hue = 35 + Math.sin(t * 0.5 + i * 0.3) * 15;
        const lightness = 70 + Math.sin(t * 0.3 + i * 0.5) * 10;
        ctx.fillStyle = `hsl(${hue}, 50%, ${lightness}%)`;
        ctx.font = font;
        ctx.fillText(line.text, padding, y);
      }

      // Mode hint
      ctx.fillStyle = 'rgba(100, 180, 255, 0.3)';
      ctx.font = '11px "DotGothic16", monospace';
      ctx.fillText('Text laid out by pretext — resize window to see live reflow', padding, h - 20);
    } catch {
      ctx.fillStyle = '#88ccff';
      ctx.font = '14px monospace';
      ctx.fillText('Illuminated mode loading...', padding, h / 2);
    }
  }

  _drawIlluminatedBorder(ctx, canvasW, canvasH, t, x, y, w, h) {
    ctx.strokeStyle = `hsla(${35 + Math.sin(t * 0.4) * 20}, 50%, 50%, 0.3)`;
    ctx.lineWidth = 1;

    // Outer border
    ctx.strokeRect(x, y, w, h);

    // Corner flourishes (animated rotation)
    const cornerSize = 12;
    const corners = [
      [x, y], [x + w, y], [x + w, y + h], [x, y + h]
    ];

    for (let i = 0; i < corners.length; i++) {
      const [cx, cy] = corners[i];
      const angle = t * 0.5 + i * Math.PI / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(-cornerSize, 0);
      ctx.lineTo(0, 0);
      ctx.lineTo(0, -cornerSize);
      ctx.stroke();
      ctx.restore();
    }

    // Floating dots along edges
    const numDots = 20;
    for (let i = 0; i < numDots; i++) {
      const progress = (i / numDots + t * 0.05) % 1;
      const perimeter = 2 * (w + h);
      const dist = progress * perimeter;

      let dx, dy;
      if (dist < w) { dx = x + dist; dy = y; }
      else if (dist < w + h) { dx = x + w; dy = y + (dist - w); }
      else if (dist < 2 * w + h) { dx = x + w - (dist - w - h); dy = y + h; }
      else { dx = x; dy = y + h - (dist - 2 * w - h); }

      const alpha = 0.15 + Math.sin(t + i) * 0.1;
      ctx.fillStyle = `hsla(35, 50%, 70%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
