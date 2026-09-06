/**
 * designation — fitting a body's name to a panel that is nine characters wide.
 *
 * Workstream `chrome-and-ui-at-240p`, AC-3. Shared by INFO (which draws the name as its heading)
 * and TARGET (whose whole job is to say what you are pointed at), because two copies of this rule
 * would drift and the two panels would then disagree about what the same body is called.
 *
 * ── ⛔ WHY THIS IS NOT `slice(0, cols)` ─────────────────────────────────────────────────────────
 *
 * Truncating "Caph b II" to eight characters gives **"CAPH B I"** — moon II reported as moon I.
 * That is a WRONG reading, not a shortened one, and it is worse than either a blank or an obvious
 * ellipsis because it is entirely plausible: nothing on the glass says the name was cut.
 *
 * The discriminating part of a designation is its TAIL. The leading part is the system, and inside
 * a system that is the part you already know — it is on the nav computer, and you flew here. So
 * leading words are dropped first, whole, and truncation is the last resort rather than the first.
 *
 * ⚠ TRUNCATION IS STILL REACHABLE and is left in on purpose: a single unbroken name longer than
 * the panel has no word to drop. Returning an empty string there would be a panel that says
 * nothing about a body it is pointed at, which is the one thing TARGET may not do.
 *
 * ── ⚠ THE KNOWN WEAKNESS, WRITTEN DOWN RATHER THAN DISCOVERED LATER ─────────────────────────────
 *
 * The rule is built for GENERATED designations, which are "<system> <letter> <roman>" and put the
 * distinguishing part last. It is wrong for a name whose distinguishing part comes FIRST:
 *
 *     "Barnard's Star"  at 9 columns  ->  "Star"        (true, and almost useless)
 *     "Proxima Centauri" at 9         ->  "Centauri"
 *
 * That is deliberate and it is the safer of the two failures. The alternative — keeping the head,
 * "Barnard's" — reads better here and produces "Kepler-44" from "Kepler-442 c", which is a
 * PLAUSIBLE IDENTIFIER FOR A DIFFERENT BODY. This rule can only ever be less specific than the
 * truth; the other can be confidently wrong, which is the failure "CAPH B I" is, and the reason
 * this function exists at all.
 *
 * Real-star names reach a cockpit panel only when a star is the focused body — planets and moons
 * in `real-star-supplement.json` systems carry generated designations like every other. If that
 * changes, the fix is a wider panel or a second line, not a cleverer cut.
 */

/**
 * @param {string} name the full designation, as the generator wrote it
 * @param {number} cols characters the line can hold
 * @returns {string} the longest tail of `name` that fits, on a word boundary where one exists
 */
export function fitDesignation(name, cols) {
  const full = String(name ?? '').trim();
  if (!full || !Number.isFinite(cols) || cols <= 0) return '';
  if (full.length <= cols) return full;

  const words = full.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const tail = words.slice(i).join(' ');
    if (tail.length <= cols) return tail;
  }
  return words[words.length - 1].slice(0, cols);
}

export default fitDesignation;
