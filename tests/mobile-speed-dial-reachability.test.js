// tests/mobile-speed-dial-reachability.test.js
// The speed dial must not put a control a phone needs where a phone cannot reach it.
//
// ⭐⭐ THIS TEST EXISTS BECAUSE MAX MEASURED IT AND NOTHING ELSE COULD HAVE.
// 2026-08-28, asked to open the game on his iPhone, tap the gear and count: "6 total including the
// gear." The dial has six buttons plus the gear, so five were on screen and one was not. Which one is
// pure arithmetic off the stylesheet: every button's top edge sits at
//     (.mobile-speed-dial bottom) + (.speed-dial-btn:nth-child(N) bottom) + (.speed-dial-btn height)
//   = 64 + {56,104,152,200,248,296} + 40  =  160 / 208 / 256 / 304 / 352 / 400 px
// above the viewport bottom. Five visible, one not ⇒ his visible ceiling is between 352 and 400 CSS px,
// which is what a landscape iPhone (~390 px tall) looks like once Safari has its chrome. SETTINGS was
// sixth, at 400 — the most useful control in the menu was the one nobody could tap.
//
// ⛔ AND HIS NUMBER OVERTURNED THE AUDIT'S OWN RECOMMENDATION. The mobile pass plan dismissed the cheap
// fix — drop the dead iOS fullscreen button — as "only buys 48px and leaves settings at 352px, still
// marginal." 352px is exactly where the fifth button sits, and he can see it. The audit was guessing at
// a ceiling it had no way to measure; one look at a real phone located it.
//
// This fence pins the ORDER, not the pixels, because order is what the fix changed and order is what a
// well-meaning tidy-up would silently revert. Reordering is behaviourally inert — every handler resolves
// by data-action, never by position (src/main.js:14843, :14897, :14920, :15078).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(REPO, rel), 'utf8');

const HTML = read('index.html');
const CSS = read('src/style.css');

/** The dial's buttons, in DOM order — which IS their bottom-to-top order on screen. */
function dialOrder() {
  const block = HTML.match(/<div class="mobile-speed-dial">([\s\S]*?)<\/div>/);
  expect(block, '.mobile-speed-dial block found in index.html').toBeTruthy();
  return [...block[1].matchAll(/data-action="([a-z-]+)"/g)].map((m) => m[1]);
}

/**
 * The safe-area inset the dial anchor applies, as a declaration. ⭐ ASSERTED SEPARATELY BECAUSE THE
 * LADDER MATH CANNOT SEE IT: the anchor carries `bottom: 64px` first (the fallback for engines that do
 * not know env()) and `bottom: calc(64px + env(safe-area-inset-bottom, 0px))` second. topEdgePx below
 * matches the FIRST, so it computes the ZERO-INSET ladder — correct, and blind to the inset by
 * construction. When the insets were added this file still went green, for a reason that had nothing to
 * do with what it claims to check. So the inset gets its own explicit clause rather than riding along
 * invisibly, and the worst-case ladder is checked against the ceiling separately.
 */
function dialAnchorHasSafeArea() {
  const block = CSS.match(/\.mobile-speed-dial\s*\{[\s\S]*?\}/);
  expect(block, '.mobile-speed-dial block found').toBeTruthy();
  return /bottom:\s*calc\([^)]*env\(\s*safe-area-inset-bottom/.test(block[0]);
}

/** Top edge of the Nth (1-based) dial button, in CSS px above the viewport bottom, at ZERO inset. */
function topEdgePx(n) {
  const anchor = CSS.match(/\.mobile-speed-dial\s*\{[^}]*?bottom:\s*(\d+)px/);
  const height = CSS.match(/\.speed-dial-btn\s*\{[^}]*?height:\s*(\d+)px/s);
  const nth = CSS.match(new RegExp(`\\.speed-dial-btn:nth-child\\(${n}\\)\\s*\\{[^}]*?bottom:\\s*(\\d+)px`));
  expect(anchor, '.mobile-speed-dial bottom found').toBeTruthy();
  expect(height, '.speed-dial-btn height found').toBeTruthy();
  expect(nth, `nth-child(${n}) bottom found`).toBeTruthy();
  return Number(anchor[1]) + Number(nth[1]) + Number(height[1]);
}

// Max saw the 352px button and did not see the 400px one, so the honest reachable ceiling is 352.
// ⛔ NOT a guess and NOT a round number — it is the highest button he confirmed he could see.
const REACHABLE_CEILING_PX = 352;

describe('mobile speed dial — the controls a phone needs are where a phone can reach', () => {
  it('has the six buttons it is supposed to have, none lost in the reorder', () => {
    expect(dialOrder().slice().sort()).toEqual(
      ['autonav', 'fullscreen', 'gyro', 'minimap', 'orbits', 'settings'].sort(),
    );
  });

  it('⭐ SETTINGS is within the ceiling Max actually measured', () => {
    const idx = dialOrder().indexOf('settings');
    expect(idx, 'settings is present').toBeGreaterThan(-1);
    expect(topEdgePx(idx + 1), 'settings top edge, px above the viewport bottom')
      .toBeLessThanOrEqual(REACHABLE_CEILING_PX);
  });

  it('the controls that survive being clipped are the ones that are clipped', () => {
    // fullscreen is dead on iOS (no Fullscreen API on iPhone) and autonav is INERT in ORRERY, which is
    // the phone default — so those two are the only acceptable occupants of the top slots.
    const order = dialOrder();
    const clipped = order.filter((_, i) => topEdgePx(i + 1) > REACHABLE_CEILING_PX);
    for (const a of clipped) {
      expect(['fullscreen', 'autonav'], `"${a}" is clipped but is not one of the two that can afford to be`)
        .toContain(a);
    }
  });

  it('⭐ the dial clears the home indicator, and the ladder still fits WITH that inset applied', () => {
    // The dock and the FAB/dial were pinned to the physical bottom edge, so on an iPhone the lower part
    // of every button sat under the system's home-indicator gesture strip. The anchor now adds
    // env(safe-area-inset-bottom), which lifts all six buttons by exactly the inset, once.
    expect(dialAnchorHasSafeArea(), '.mobile-speed-dial lifts by env(safe-area-inset-bottom)').toBe(true);
    // ⚠ That lift is NOT free: it pushes the whole ladder UP, toward the ceiling. A landscape iPhone's
    // bottom inset is ~21px; 34px is the portrait home-indicator figure and is the harsher of the two,
    // so use it as the worst case rather than the flattering one.
    const WORST_INSET_PX = 34;
    const idx = dialOrder().indexOf('settings');
    expect(topEdgePx(idx + 1) + WORST_INSET_PX, 'settings still reachable at the worst realistic inset')
      .toBeLessThanOrEqual(REACHABLE_CEILING_PX);
  });

  it('CONTROL — the arithmetic is live, and reproduces the numbers Max\'s count implies', () => {
    // A geometry test that silently parsed nothing would pass every assertion above by comparing
    // undefined-ish values. Pin the actual ladder: if the stylesheet moves, this reds and says so.
    expect([1, 2, 3, 4, 5, 6].map(topEdgePx)).toEqual([160, 208, 256, 304, 352, 400]);
    // …and the ladder must genuinely straddle the ceiling, or the reachability assertions are vacuous:
    // a dial that fitted entirely on screen would pass them while proving nothing.
    expect(topEdgePx(6), 'the top slot really is out of reach — otherwise this fence tests nothing')
      .toBeGreaterThan(REACHABLE_CEILING_PX);
  });
});
