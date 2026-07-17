// Far-companion edge chips (AC4) — pure content + geometry for the SYSTEM view.
//
// A known multi-star system's WIDE members ride `systemData.farCompanions`
// (StarSystemGenerator ~:856): { name, class, type, separationAU, planets? }.
// Their separations (Proxima at ~13,000 AU; 36 Oph C at ~4,400 AU) are far
// beyond what the orrery's sqrt-AU orbital scale can place honestly, and the
// payload carries no direction vector — so they cannot be drawn as an in-scene
// orbit. Instead each renders as an informational EDGE CHIP anchored at a fixed
// view-boundary slot: name, spectral-colour dot, separation, and its planets.
// The chip is draw-only (no arrival change); positions never move.
//
// These helpers are pure (no canvas, no NavComputer state) so the wiring can be
// unit-tested at the method boundary, same split as labelPlacement.js.

/**
 * Format a separation in AU for a chip / tooltip. Groups thousands so a
 * ~13,000 AU wide companion reads legibly; keeps one decimal for sub-100
 * separations; degrades to '?' on a missing or non-finite value.
 *
 * @param {number|null|undefined} au
 * @returns {string}
 */
export function formatSeparationAU(au) {
  if (au == null || !Number.isFinite(au)) return '?';
  const rounded = au >= 100 ? Math.round(au) : Math.round(au * 10) / 10;
  const [intPart, fracPart] = String(rounded).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart ? `${grouped}.${fracPart}` : grouped;
}

/**
 * Build the chip descriptors for a system's far companions. Chips stack
 * vertically downward from `top`, each RIGHT-anchored to `right` (a consistent
 * boundary slot), and never overlap. Returns [] when there are no far members,
 * so the caller draws nothing and shifts no layout.
 *
 * Each descriptor:
 *   { name, type, fullClass, color, sepLine, planetLine, planetLetters,
 *     lines, x, y, w, h }
 *
 * @param {Array<{name?,class?,type?,separationAU?,planets?}>|null|undefined} farCompanions
 * @param {object} opts
 * @param {number} opts.right   x of the boundary the chips' right edge aligns to
 * @param {number} opts.top     y of the first chip's top edge
 * @param {(text:string)=>number} opts.measure  text-width in px
 * @param {(type:string|null)=>string} [opts.colorForType]  spectral colour lookup
 * @param {number} [opts.lineHeight=12]
 * @param {number} [opts.padX=8]
 * @param {number} [opts.padY=6]
 * @param {number} [opts.gap=6]      vertical gap between stacked chips
 * @param {number} [opts.dotGap=12]  indent reserved for the colour dot on line 1
 * @returns {Array<object>}
 */
export function buildFarCompanionChips(farCompanions, opts = {}) {
  const {
    right, top, measure,
    colorForType = null,
    lineHeight = 12, padX = 8, padY = 6, gap = 6, dotGap = 12,
  } = opts;

  const chips = [];
  let y = top;

  for (const fc of farCompanions || []) {
    if (!fc) continue;
    const name = fc.name || 'Unknown';
    const type = fc.type || null;
    const sepLine = `far companion · ${formatSeparationAU(fc.separationAU)} AU`;
    const planetLetters = (fc.planets || [])
      .map((p) => p && (p.letter || p.name))
      .filter(Boolean);
    const planetLine = planetLetters.length > 0
      ? `planets: ${planetLetters.join(', ')}`
      : null;

    const lines = [name, sepLine];
    if (planetLine) lines.push(planetLine);

    // Line 1 (name) reserves the colour-dot indent; other lines are flush.
    const nameW = dotGap + measure(name);
    const sepW = measure(sepLine);
    const planetW = planetLine ? measure(planetLine) : 0;
    const w = Math.max(nameW, sepW, planetW) + padX * 2;
    const h = lines.length * lineHeight + padY * 2;
    const x = right - w;

    chips.push({
      name,
      type,
      fullClass: fc.class || null,
      separationAU: fc.separationAU ?? null,
      color: colorForType ? colorForType(type) : null,
      sepLine,
      planetLine,
      planetLetters,
      lines,
      x, y, w, h,
    });

    y += h + gap;
  }

  return chips;
}
