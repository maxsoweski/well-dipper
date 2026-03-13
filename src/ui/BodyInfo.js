/**
 * BodyInfo — top-left HUD showing info about the selected body.
 *
 * Terminal-style typewriter effect: a blinking cursor writes text
 * left-to-right, top-to-bottom. No border, no background — just
 * big chunky bold letters punched onto the screen.
 */

const PLANET_TYPE_NAMES = {
  'rocky': 'Rocky World',
  'gas-giant': 'Gas Giant',
  'ice': 'Ice World',
  'lava': 'Lava World',
  'ocean': 'Ocean World',
  'terrestrial': 'Terrestrial',
  'hot-jupiter': 'Hot Jupiter',
  'eyeball': 'Tidally Locked',
  'venus': 'Venusian',
  'carbon': 'Carbon World',
  'sub-neptune': 'Sub-Neptune',
};

const MOON_TYPE_NAMES = {
  'captured': 'Captured Moon',
  'rocky': 'Rocky Moon',
  'ice': 'Icy Moon',
  'volcanic': 'Volcanic Moon',
  'terrestrial': 'Terrestrial Moon',
};

export class BodyInfo {
  constructor() {
    this._el = document.getElementById('body-info');
    this._typeEl = this._el?.querySelector('.body-info-type');
    this._statsEl = this._el?.querySelector('.body-info-stats');
    this._cursorEl = null;
    this._timer = null;
    this._typewriterTimer = null;
    this._blinkTimer = null;

    // Typewriter state
    this._fullType = '';
    this._fullStats = '';
    this._charIndex = 0;
    this._typing = false;
    this._charsPerTick = 1;
    this._tickMs = 55; // milliseconds per character (slower, more deliberate)

    // Create cursor element (moves between _typeEl and _statsEl as typing progresses)
    if (this._el) {
      this._cursorEl = document.createElement('span');
      this._cursorEl.className = 'body-info-cursor';
      this._cursorEl.textContent = '\u258C'; // left half block character ▌
    }
  }

  showPlanet(data, index, name) {
    const typeName = PLANET_TYPE_NAMES[data.type] || data.type;
    const title = name ? `${name} \u2014 ${typeName}` : typeName;
    const parts = [];
    if (data.radiusEarth != null) {
      parts.push(`${data.radiusEarth.toFixed(1)} R\u2295`);
    }
    if (data.rings) parts.push('Rings');
    if (data.clouds) parts.push('Clouds');
    if (data.atmosphere) parts.push('Atmosphere');
    this._show(title, parts.join(' \u00b7 '));
  }

  showMoon(data, planetIndex, name) {
    const typeName = MOON_TYPE_NAMES[data.type] || data.type;
    const title = name ? `${name} \u2014 ${typeName}` : typeName;
    const parts = [];
    if (data.radiusEarth != null) {
      parts.push(`${data.radiusEarth.toFixed(2)} R\u2295`);
    }
    if (data.clouds) parts.push('Clouds');
    if (data.atmosphere) parts.push('Atmo');
    this._show(title, parts.join(' \u00b7 '));
  }

  showWarpTarget(name) {
    this._show(name, 'Warp Target');
  }

  showStar(data, name) {
    const typeName = `${data.type}-Class Star`;
    const title = name ? `${name} \u2014 ${typeName}` : typeName;
    const parts = [];
    if (data.radiusSolar != null) {
      parts.push(`${data.radiusSolar.toFixed(2)} R\u2609`);
    }
    this._show(title, parts.join(' \u00b7 '));
  }

  hide() {
    clearTimeout(this._timer);
    clearInterval(this._typewriterTimer);
    clearInterval(this._blinkTimer);
    this._typing = false;
    if (this._el) {
      this._el.classList.remove('fading');
      this._el.style.display = 'none';
    }
  }

  _show(typeName, stats) {
    if (!this._el) return;

    // Stop any running typewriter
    clearTimeout(this._timer);
    clearInterval(this._typewriterTimer);
    clearInterval(this._blinkTimer);

    // Store full text, reset display
    this._fullType = typeName.toUpperCase();
    this._fullStats = stats;
    this._charIndex = 0;
    this._typing = true;

    this._typeEl.textContent = '';
    this._statsEl.textContent = '';
    this._el.style.display = 'block';
    this._el.classList.remove('fading');

    // Show cursor inline with the first text element
    if (this._cursorEl) {
      this._cursorEl.style.display = 'inline';
      this._cursorEl.classList.add('blinking');
      this._typeEl.appendChild(this._cursorEl);
    }

    // Type out characters one by one
    const totalChars = this._fullType.length + this._fullStats.length;
    this._typewriterTimer = setInterval(() => {
      if (this._charIndex >= totalChars) {
        // Typing complete — stop and start idle blink
        clearInterval(this._typewriterTimer);
        this._typing = false;
        // Auto-hide after 4 seconds
        this._timer = setTimeout(() => this._fadeOut(), 4000);
        return;
      }

      // Type next character, keeping cursor immediately after the last character
      if (this._charIndex < this._fullType.length) {
        // Typing first line — set text, then re-append cursor (keeps it at the end)
        this._typeEl.textContent = this._fullType.substring(0, this._charIndex + 1);
        this._typeEl.appendChild(this._cursorEl);
      } else {
        // First line done — move cursor to stats element
        if (this._charIndex === this._fullType.length) {
          this._typeEl.textContent = this._fullType;
        }
        const statsIdx = this._charIndex - this._fullType.length;
        this._statsEl.textContent = this._fullStats.substring(0, statsIdx + 1);
        this._statsEl.appendChild(this._cursorEl);
      }
      this._charIndex++;
    }, this._tickMs);
  }

  _fadeOut() {
    if (!this._el) return;
    // Hide cursor before fading
    if (this._cursorEl) {
      this._cursorEl.style.display = 'none';
    }
    this._el.classList.add('fading');
    setTimeout(() => {
      if (this._el) this._el.style.display = 'none';
    }, 500);
  }
}
