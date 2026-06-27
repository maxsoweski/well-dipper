// src/flight/freeLook.js
// Pure latched free-look state. Decides whether pointer motion drives the head
// (look) or the virtual joystick (steer), and signals a one-shot recenter on exit.
// Camera math lives in HeadMount; this is just the latch + routing decision so it's
// unit-testable without three.js.
export function createFreeLook() {
  let latched = false;
  let recenterPending = false;
  return {
    get latched() { return latched; },
    enter() { latched = true; },
    exit() { if (latched) { latched = false; recenterPending = true; } },
    toggle() { latched ? this.exit() : this.enter(); },
    route(dx, dy) {
      return { target: latched ? 'head' : 'joystick', dx, dy };
    },
    consumeRecenter() { const r = recenterPending; recenterPending = false; return r; },
  };
}
