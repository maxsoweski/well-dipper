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
  show(label, hint) {
    if (!this._el) return;
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
