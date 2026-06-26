// src/flight/Arrival.js
//
// The named arrival signal returned by ShipControls.flyTo (contract
// supercruise-control-harness-2026-06-26 §6). ONE shape, two consumption
// modes: a promise/callback for lab/headless, and a poll(frame) the live frame
// pump feeds each tick in-game. Resolves with the completing PilotFrame
// (the frame with motionComplete === true).
export function makeArrival() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  const arrival = {
    done: false,
    promise,
    then(onArrived) { promise.then(onArrived); return arrival; },
    // In-game: feed each live PilotFrame. Flips done + resolves on motionComplete.
    poll(frame) {
      if (arrival.done) return true;
      if (frame && frame.motionComplete) {
        arrival.done = true;
        resolve(frame);
        return true;
      }
      return false;
    },
    cancel() {
      if (arrival.done) return;
      arrival.done = true;
      reject(new Error('arrival cancelled'));
    },
  };
  // Swallow an unobserved cancel rejection so a cancelled in-game leg never
  // surfaces an unhandled-rejection warning when no one awaited the promise.
  promise.catch(() => {});
  return arrival;
}
