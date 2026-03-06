/**
 * BodyInfo — top-left HUD popup showing info about the selected body.
 *
 * Shows planet/moon/star type and key stats when a body is selected
 * (click or autopilot). Auto-hides after 5 seconds.
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
    this._timer = null;
  }

  /**
   * Show info for a planet.
   * @param {object} data — planet generation data (from planet.data)
   * @param {number} index — planet index (0-based)
   */
  showPlanet(data, index) {
    const typeName = PLANET_TYPE_NAMES[data.type] || data.type;
    const parts = [];
    if (data.radiusEarth != null) {
      parts.push(`${data.radiusEarth.toFixed(1)} R\u2295`);  // R⊕
    }
    if (data.rings) parts.push('Rings');
    if (data.clouds) parts.push('Clouds');
    if (data.atmosphere) parts.push('Atmosphere');
    this._show(typeName, parts.join(' \u00b7 '));  // middle dot separator
  }

  /**
   * Show info for a moon.
   * @param {object} data — moon generation data (from moon.data)
   * @param {number} planetIndex — parent planet index
   */
  showMoon(data, planetIndex) {
    const typeName = MOON_TYPE_NAMES[data.type] || data.type;
    const parts = [];
    if (data.radiusEarth != null) {
      parts.push(`${data.radiusEarth.toFixed(2)} R\u2295`);
    }
    parts.push(`Moon of Planet ${planetIndex + 1}`);
    if (data.clouds) parts.push('Clouds');
    if (data.atmosphere) parts.push('Atmo');
    this._show(typeName, parts.join(' \u00b7 '));
  }

  /**
   * Show info for a star.
   * @param {object} data — star generation data (from star.data)
   */
  showStar(data) {
    const typeName = `${data.type}-Class Star`;
    const parts = [];
    if (data.radiusSolar != null) {
      parts.push(`${data.radiusSolar.toFixed(2)} R\u2609`);  // R☉
    }
    this._show(typeName, parts.join(' \u00b7 '));
  }

  /** Hide immediately. */
  hide() {
    clearTimeout(this._timer);
    if (this._el) {
      this._el.classList.remove('fading');
      this._el.style.display = 'none';
    }
  }

  _show(typeName, stats) {
    if (!this._el) return;
    clearTimeout(this._timer);
    this._el.style.display = 'block';
    this._el.classList.remove('fading');
    this._typeEl.textContent = typeName;
    this._statsEl.textContent = stats;
    // Auto-hide after 5 seconds
    this._timer = setTimeout(() => this._fadeOut(), 5000);
  }

  _fadeOut() {
    if (!this._el) return;
    this._el.classList.add('fading');
    setTimeout(() => {
      if (this._el) this._el.style.display = 'none';
    }, 500);
  }
}
