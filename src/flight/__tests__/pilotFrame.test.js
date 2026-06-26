import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SupercruiseModel } from '../SupercruiseModel.js';
import { SupercruisePilot, PILOT_FRAME_FIELDS } from '../SupercruisePilot.js';

const DT = 1 / 60;
const mkBody = (x, y, z, r) => ({ mesh: { position: new THREE.Vector3(x, y, z) }, radius: r });

describe('PILOT_FRAME_FIELDS — the named one-shot Frame contract', () => {
  it('lists exactly the six fields, in order', () => {
    expect(PILOT_FRAME_FIELDS).toEqual(
      ['phase', 'prevPhase', 'phaseChanged', 'motionComplete', 'overshoot', 'decelStarted'],
    );
  });

  it('a real pilot.update() frame has exactly those keys', () => {
    const model = new SupercruiseModel();
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: mkBody(0, 0, -2, 0.05).mesh, bodyRadius: 0.05 });
    const frame = pilot.update(DT);
    expect(Object.keys(frame).sort()).toEqual([...PILOT_FRAME_FIELDS].sort());
  });

  it('phaseChanged is stamped (phase !== prevPhase) on the ALIGN-entry frame', () => {
    const model = new SupercruiseModel();
    const pilot = new SupercruisePilot(model);
    pilot.beginLeg({ toBody: mkBody(0, 0, -2, 0.05).mesh, bodyRadius: 0.05 });
    const frame = pilot.update(DT); // IDLE→ALIGN, prevPhase was IDLE
    expect(frame.phaseChanged).toBe(true);
    expect(frame.phase).toBe('ALIGN');
    expect(frame.prevPhase).toBe('IDLE');
  });
});
