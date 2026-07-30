/**
 * NavHoldingCard — NAV's fallback card, shown only when no nav computer exists.
 *
 * PROMOTED OUT OF `cockpit-screens-lab-panels.js` on 2026-07-30 (increment 7,
 * AC-ONE-RIG-TWO-HOSTS). It sat beside three shipped painters that live in
 * `src/cockpit/panels/`, which was fine while the lab was the only host — and
 * stops being fine the moment the GAME builds the same rig, because the rig
 * would then have to reach out of `src/` into a lab file for one of its four
 * default painters. `cockpit-screens-lab-panels.js` re-exports it, so its own
 * test keeps proving there is ONE implementation rather than two.
 */
export const NAV_HOLDING_TEXT = Object.freeze({ TITLE: 'NAV', NOTE: 'NO SOURCE' });

/** Where the two words sit, as fractions of the buffer height. */
const NAV_LAYOUT = Object.freeze({ TITLE_BASELINE: 0.42, NOTE_BASELINE: 0.58 });

/**
 * NAV's fallback card — shown ONLY when no nav computer could be built.
 *
 * Two words and nothing else, on purpose. Leaving the glass dark was the
 * alternative and it was rejected: a dark panel among three lit ones is
 * indistinguishable from a panel whose painter threw, and the first minutes of
 * the demo would go on working out which. A card that says NO SOURCE carries the
 * cause without the guesswork.
 *
 * IT READS NOTHING FROM THE SNAPSHOT, and that restraint is the whole design.
 * The system name and the nav level are both right there on the frame, and
 * putting either on this panel would make it look like a working nav computer —
 * the one impression it must not give, because AC-PANEL-CONTENT's NAV clause is
 * about the real thing being live from the first frame after boot, and a
 * plausible-looking placeholder is how that gets ticked off by mistake. That
 * argument is the reason the card is two flat words and not, say, a level name.
 *
 * Same `(screen, snapshot, nowMs)` shape as the three shipped painters, so all
 * four register interchangeably; a painter with a different arity is a wiring
 * bug waiting to happen.
 *
 * @param {import('./src/cockpit/PhosphorScreen.js').PhosphorScreen} screen
 */
export function paintNavHoldingCard(screen) {
  // The host does not clear before a painter runs — it owns no palette and so
  // cannot choose a background colour. Same first line as the other three.
  screen.clear();
  screen.text(NAV_HOLDING_TEXT.TITLE, screen.width / 2, screen.height * NAV_LAYOUT.TITLE_BASELINE, {
    size: screen.type.display,
    align: 'centre',
  });
  screen.text(NAV_HOLDING_TEXT.NOTE, screen.width / 2, screen.height * NAV_LAYOUT.NOTE_BASELINE, {
    align: 'centre',
  });
}

/**
 * The raw `(screen, …)` painters by role, before adaptation. Exported for the
 * test, which exercises them against a stand-in kit without a PanelHost.
 */
