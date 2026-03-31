/**
 * FlightStates -- state constants and transition validation for FlightDynamics.
 *
 * The ship can be in one of these states at any time. Each state determines
 * how position/velocity are updated each frame:
 *
 *   IDLE       - No thrust, no significant velocity. Waiting for input.
 *   FREE       - Moving through space under gravity + optional thrust.
 *   ORBIT      - Roughly circular orbit around a body (gravity provides centripetal force).
 *   APPROACH   - Auto-navigating toward a body with braking.
 *   TRANSFER   - Hohmann-style transfer between orbits (future use).
 *   WARP       - Position/velocity frozen during warp transition.
 */

export const FlightState = {
  IDLE: 'IDLE',
  FREE: 'FREE',
  ORBIT: 'ORBIT',
  APPROACH: 'APPROACH',
  TRANSFER: 'TRANSFER',
  WARP: 'WARP',
};

/**
 * Which transitions are allowed from each state.
 *
 * Key = current state, value = Set of states you can transition TO.
 * Any transition not listed here is invalid and will be rejected
 * by validateTransition().
 */
const VALID_TRANSITIONS = {
  [FlightState.IDLE]: new Set([
    FlightState.FREE,
    FlightState.ORBIT,
    FlightState.APPROACH,
    FlightState.WARP,
  ]),
  [FlightState.FREE]: new Set([
    FlightState.IDLE,
    FlightState.ORBIT,
    FlightState.APPROACH,
    FlightState.TRANSFER,
    FlightState.WARP,
  ]),
  [FlightState.ORBIT]: new Set([
    FlightState.FREE,
    FlightState.APPROACH,
    FlightState.TRANSFER,
    FlightState.WARP,
  ]),
  [FlightState.APPROACH]: new Set([
    FlightState.FREE,
    FlightState.ORBIT,
    FlightState.WARP,
  ]),
  [FlightState.TRANSFER]: new Set([
    FlightState.FREE,
    FlightState.ORBIT,
    FlightState.WARP,
  ]),
  [FlightState.WARP]: new Set([
    FlightState.IDLE,
    FlightState.FREE,
    FlightState.ORBIT,
  ]),
};

/**
 * Check whether a state transition is allowed.
 *
 * @param {string} from - current FlightState
 * @param {string} to   - desired FlightState
 * @returns {boolean} true if the transition is valid
 */
export function validateTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.has(to);
}
