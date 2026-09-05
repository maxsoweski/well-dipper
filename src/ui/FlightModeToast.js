// FlightModeToast — brief centered banner naming the flight-assist mode on each
// F-cycle entry. Modeled on BodyInfo's fade-timer idiom, but its OWN element so
// it neither collides with the selection display (#body-info) nor depends on the
// supercruise HUD's flight-gated visibility — so "Exit flight" still shows as the
// HUD hides on exit.
export class FlightModeToast {
  constructor() {
    this._el = document.getElementById('flight-mode-toast');
    this._labelEl = this._el?.querySelector('.flight-mode-toast-label');
    this._hintEl = this._el?.querySelector('.flight-mode-toast-hint');
    this._fadeTimer = null;
    this._hideTimer = null;
    this._holdMs = 1600;
  }
  /**
   * ⭐ RETIRED IN HELM — AC-OVERLAYS-RETIRE-IN-HELM, a ruling the prior
   * workstream already recorded.
   *
   * The banner announces the assist mode on entry; the cockpit's DRIVE panel
   * shows `MODE: <mode>` PERSISTENTLY, which is strictly more than a 1.6 s
   * flash. Note the asymmetry this produces, and it is the right one: "Flight
   * ON" fires from `_enterFlightInternal` while `_scManual` is already true, so
   * it is suppressed — while "Flight OFF" fires from `_exitFlightInternal`
   * AFTER `setScManual(false)`, so it still shows. You are told you left the
   * cockpit; you are not told you are in it by a banner over the panel that
   * says so.
   */
  setSuppressed(on) { this._suppressed = !!on; }

  /**
   * ⭐ SUPPRESSION-BYPASSING READOUT, FOR DEBUG A/B KEYS ONLY. The suppression above is a ruling
   * about THIS BANNER's own content — the cockpit's DRIVE panel already says MODE persistently, so
   * a 1.6 s flash of the same thing is noise. A bare-key A/B readout is not that: nothing else on
   * screen names which variant is showing, and the A/B is worthless if you cannot tell. Added
   * 2026-09-07 for the `[` star-glow cycle, whose whole point is judging a look WHILE FLYING, which
   * is HELM, which is exactly where the suppression would have silenced it.
   * ⛔ Do not reach for this to bring flight-mode announcements back into HELM.
   */
  showDebug(label, hint) {
    const was = this._suppressed;
    this._suppressed = false;
    try { this.show(label, hint); } finally { this._suppressed = was; }
  }

  show(label, hint) {
    if (!this._el || this._suppressed) return;
    clearTimeout(this._fadeTimer);
    clearTimeout(this._hideTimer);
    this._labelEl.textContent = label;
    this._hintEl.textContent = hint ?? '';
    this._el.style.display = 'block';
    this._el.classList.remove('fading');
    void this._el.offsetWidth; // reflow so a rapid re-show restarts the fade
    this._fadeTimer = setTimeout(() => this._fadeOut(), this._holdMs);
  }
  _fadeOut() {
    if (!this._el) return;
    this._el.classList.add('fading');
    this._hideTimer = setTimeout(() => { if (this._el) this._el.style.display = 'none'; }, 400);
  }
}
