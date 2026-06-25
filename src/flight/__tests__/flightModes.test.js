import { describe, it, expect } from 'vitest';
import { FlightMode, advanceFlightMode, flightModeInfo, isManualInput } from '../flightModes.js';

describe('advanceFlightMode — the 4-state ring', () => {
  it('enters at Manual from not-in-flight', () => {
    expect(advanceFlightMode(FlightMode.ASSIST, false)).toEqual({ mode: FlightMode.MANUAL, inFlight: true, exit: false });
    expect(advanceFlightMode(null, false)).toEqual({ mode: FlightMode.MANUAL, inFlight: true, exit: false });
  });
  it('cycles Manual → Align → Assist → Exit while in flight', () => {
    expect(advanceFlightMode(FlightMode.MANUAL, true)).toEqual({ mode: FlightMode.ALIGN, inFlight: true, exit: false });
    expect(advanceFlightMode(FlightMode.ALIGN, true)).toEqual({ mode: FlightMode.ASSIST, inFlight: true, exit: false });
    expect(advanceFlightMode(FlightMode.ASSIST, true)).toEqual({ mode: null, inFlight: false, exit: true });
  });
  it('a full cycle returns to entering at Manual', () => {
    let mode = null, inFlight = false;
    const seen = [];
    for (let i = 0; i < 4; i++) { const n = advanceFlightMode(mode, inFlight); seen.push(n.exit ? 'exit' : n.mode); mode = n.mode; inFlight = n.inFlight; }
    expect(seen).toEqual([FlightMode.MANUAL, FlightMode.ALIGN, FlightMode.ASSIST, 'exit']);
    expect(advanceFlightMode(mode, inFlight).mode).toBe(FlightMode.MANUAL); // next press re-enters
  });
});

describe('flightModeInfo', () => {
  it('gives a label + hint for each mode and for exit', () => {
    expect(flightModeInfo(FlightMode.MANUAL).label).toBe('Manual');
    expect(flightModeInfo(FlightMode.ALIGN).label).toBe('Align-on-select');
    expect(flightModeInfo(FlightMode.ASSIST).label).toBe('Assist');
    expect(flightModeInfo('exit').label).toBe('Exit flight');
    for (const m of [FlightMode.MANUAL, FlightMode.ALIGN, FlightMode.ASSIST, 'exit']) {
      expect(typeof flightModeInfo(m).hint).toBe('string');
    }
  });
});

describe('isManualInput', () => {
  it('is true on any throttle or any non-zero stick, false at rest', () => {
    expect(isManualInput({ x: 0, y: 0 }, 0)).toBe(false);
    expect(isManualInput(null, 0)).toBe(false);
    expect(isManualInput({ x: 0, y: 0 }, -1)).toBe(true);
    expect(isManualInput({ x: 0.0001, y: 0 }, 0)).toBe(true);
    expect(isManualInput({ x: 0, y: -0.2 }, 0)).toBe(true);
  });
});
