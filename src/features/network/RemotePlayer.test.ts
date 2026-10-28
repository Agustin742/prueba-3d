import { describe, expect, it } from 'vitest';
import { turnTowardsAngle } from './RemotePlayer';

describe('turnTowardsAngle', () => {
  it('turns clockwise towards target angle', () => {
    const angle = turnTowardsAngle(0, 1, 0.5);
    expect(angle).toBe(0.5);
  });

  it('turns counter-clockwise towards target angle', () => {
    const angle = turnTowardsAngle(0, -1, 0.5);
    expect(angle).toBe(-0.5);
  });

  it('snaps directly to target when step exceeds difference', () => {
    const angle = turnTowardsAngle(0, 0.2, 0.5);
    expect(angle).toBe(0.2);
  });

  it('handles shortest path wrapping around 2*PI', () => {
    const angle = turnTowardsAngle(0.1, Math.PI * 2 - 0.1, 0.1);
    expect(angle).toBeLessThan(0.1);
  });
});
