// galacticEngineFlag.js — the 'wd.galacticEngine' flag. Default OFF.
//
// Precedence, most explicit first: URL param `?galactic=1|0` → localStorage 'wd.galacticEngine' ('1'|'0')
// → default. Every read reports WHICH source answered (the wd.labGasBodies precedent in Planet.js), because
// "the flag was on" and "the flag defaulted off" otherwise look the same in a screenshot.

export const GALACTIC_ENGINE_KEY = 'wd.galacticEngine';
export const GALACTIC_ENGINE_PARAM = 'galactic';
export const GALACTIC_ENGINE_DEFAULT = false;

export function galacticEngineFlag(win = typeof window !== 'undefined' ? window : null) {
  try {
    const search = win?.location?.search;
    if (search) {
      const v = new URLSearchParams(search).get(GALACTIC_ENGINE_PARAM);
      if (v === '1' || v === '0') return { enabled: v === '1', source: `url:?${GALACTIC_ENGINE_PARAM}` };
    }
  } catch (e) { /* malformed URL: fall through */ }
  try {
    const raw = win?.localStorage ? win.localStorage.getItem(GALACTIC_ENGINE_KEY) : null;
    if (raw === '1' || raw === '0') return { enabled: raw === '1', source: `localStorage:${GALACTIC_ENGINE_KEY}` };
  } catch (e) { /* private-mode storage throws on read */ }
  return { enabled: GALACTIC_ENGINE_DEFAULT, source: 'default' };
}
