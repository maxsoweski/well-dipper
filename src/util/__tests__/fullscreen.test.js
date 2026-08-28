// src/util/__tests__/fullscreen.test.js
// The iOS-shaped fake document is the point of this file: nobody in this loop has an iPhone, so the
// only iOS evidence available is a faithful model of what WebKit exposes, exercised deterministically.
import { describe, it, expect, vi } from 'vitest';
import {
  fullscreenAvailable, fullscreenElementOf, isFullscreen, requestFullscreen, exitFullscreen,
} from '../fullscreen.js';

/** A desktop Chrome-shaped document. */
const desktopDoc = (over = {}) => ({
  fullscreenEnabled: true,
  fullscreenElement: null,
  documentElement: { requestFullscreen: vi.fn(() => Promise.resolve()) },
  exitFullscreen: vi.fn(() => Promise.resolve()),
  ...over,
});

/**
 * ⭐ THE iPHONE SAFARI SHAPE — and the modelling choice IS the test.
 * iOS Safari on iPhone exposes NO element-level fullscreen: no requestFullscreen, no webkit- variant on
 * an arbitrary element, and fullscreenEnabled false. That is precisely the document against which
 *     document.documentElement.requestFullscreen().catch(() => {})
 * throws a synchronous TypeError instead of rejecting a promise.
 */
const iphoneDoc = (over = {}) => ({
  fullscreenEnabled: false,
  fullscreenElement: undefined,
  documentElement: {},          // no requestFullscreen at all
  ...over,
});

describe('fullscreenAvailable', () => {
  it('true on a document that can do it', () => {
    expect(fullscreenAvailable(desktopDoc())).toBe(true);
  });

  it('⭐ FALSE on an iPhone-shaped document — the whole reason this module exists', () => {
    expect(fullscreenAvailable(iphoneDoc())).toBe(false);
  });

  it('⭐ trusts the CAPABILITY flag over the mere presence of the method', () => {
    // The iframe-without-allow case: requestFullscreen exists and calling it fails anyway. A
    // method-existence check says yes here and is wrong; fullscreenEnabled says no and is right.
    const denied = desktopDoc({ fullscreenEnabled: false });
    expect(typeof denied.documentElement.requestFullscreen).toBe('function');
    expect(fullscreenAvailable(denied)).toBe(false);
  });

  it('falls back to method presence only when no capability flag is published', () => {
    expect(fullscreenAvailable({ documentElement: { requestFullscreen: () => {} } })).toBe(true);
    expect(fullscreenAvailable({ documentElement: { webkitRequestFullscreen: () => {} } })).toBe(true);
    expect(fullscreenAvailable({ documentElement: {} })).toBe(false);
  });

  it('never throws on junk', () => {
    for (const bad of [undefined, null, {}, 0, '', []]) {
      expect(() => fullscreenAvailable(bad), String(bad)).not.toThrow();
      expect(fullscreenAvailable(bad)).toBe(false);
    }
  });
});

describe('fullscreenElementOf / isFullscreen', () => {
  it('⭐ reads the PREFIXED spelling too — the bug the settings checkbox had', () => {
    // src/main.js read only document.fullscreenElement. On a browser exposing only the webkit- name it
    // would report "not fullscreen" while fullscreen, so the next toggle would try to ENTER again.
    const el = { tag: 'html' };
    expect(fullscreenElementOf({ webkitFullscreenElement: el })).toBe(el);
    expect(isFullscreen({ webkitFullscreenElement: el })).toBe(true);
  });

  it('null when not fullscreen, and never throws on junk', () => {
    expect(fullscreenElementOf(desktopDoc())).toBe(null);
    expect(isFullscreen(desktopDoc())).toBe(false);
    for (const bad of [undefined, null, {}]) {
      expect(() => isFullscreen(bad)).not.toThrow();
      expect(isFullscreen(bad)).toBe(false);
    }
  });
});

describe('requestFullscreen', () => {
  it('calls through and reports the attempt on a capable document', () => {
    const doc = desktopDoc();
    expect(requestFullscreen(doc)).toBe(true);
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledOnce();
  });

  it('⭐⭐ ON AN iPHONE IT RETURNS FALSE AND DOES NOT THROW — the actual defect, reproduced', () => {
    const doc = iphoneDoc();
    // The shipped form throws here. Demonstrated, not asserted from memory:
    expect(() => doc.documentElement.requestFullscreen().catch(() => {})).toThrow(TypeError);
    // The guarded form does not, and tells the caller to stop offering the control.
    expect(() => requestFullscreen(doc)).not.toThrow();
    expect(requestFullscreen(doc)).toBe(false);
  });

  it('swallows a REJECTED promise without an unhandled rejection', () => {
    const doc = desktopDoc({
      documentElement: { requestFullscreen: () => Promise.reject(new Error('user gesture required')) },
    });
    expect(requestFullscreen(doc)).toBe(true);   // the attempt was made; the outcome is the promise's
  });

  it('survives a method that throws synchronously', () => {
    const doc = desktopDoc({ documentElement: { requestFullscreen: () => { throw new Error('nope'); } } });
    expect(() => requestFullscreen(doc)).not.toThrow();
    expect(requestFullscreen(doc)).toBe(false);
  });
});

describe('exitFullscreen', () => {
  it('exits only when actually fullscreen', () => {
    const notFs = desktopDoc();
    expect(exitFullscreen(notFs)).toBe(false);
    expect(notFs.exitFullscreen).not.toHaveBeenCalled();

    const fs = desktopDoc({ fullscreenElement: { tag: 'html' } });
    expect(exitFullscreen(fs)).toBe(true);
    expect(fs.exitFullscreen).toHaveBeenCalledOnce();
  });

  it('uses the prefixed exit when that is the only one, and never throws on junk', () => {
    const webkitExit = vi.fn();
    const doc = { webkitFullscreenElement: {}, webkitExitFullscreen: webkitExit };
    expect(exitFullscreen(doc)).toBe(true);
    expect(webkitExit).toHaveBeenCalledOnce();
    for (const bad of [undefined, null, {}]) expect(() => exitFullscreen(bad)).not.toThrow();
  });
});
