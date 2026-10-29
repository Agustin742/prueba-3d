import { describe, expect, it } from 'vitest';
import { cameraFocus, receptionViewBox } from './camera-focus';

const floor = { minX: -5.39, maxX: 37.79, minZ: -4.716, maxZ: 33.066 };
const at = (x: number, z: number, zoom = 1) => cameraFocus({ x, y: 0, z }, floor, zoom);

describe('cameraFocus', () => {
  it('centres on the avatar anywhere the unit-room window stays inside the floor', () => {
    const focus = at(16, 14);
    expect(focus.x).toBe(16); expect(focus.z).toBe(14);
    expect(focus.y).toBeCloseTo((receptionViewBox.min.y + receptionViewBox.max.y) / 2);
  });
  it('clamps so the window never shows past the floor edges, and the avatar stays inside the window', () => {
    const half = receptionViewBox.getSize(receptionViewBox.min.clone()).multiplyScalar(0.5);
    const corner = at(-5, -4.5);
    expect(corner.x).toBeCloseTo(floor.minX + half.x); expect(corner.z).toBeCloseTo(floor.minZ + half.z);
    const far = at(37.7, 33);
    expect(far.x).toBeCloseTo(floor.maxX - half.x); expect(far.z).toBeCloseTo(floor.maxZ - half.z);
    expect(Math.abs(far.x - 37.7)).toBeLessThanOrEqual(half.x); expect(Math.abs(far.z - 33)).toBeLessThanOrEqual(half.z);
  });
  it('tightens the margin with zoom so a zoomed-in view still contains the avatar', () => {
    const half = receptionViewBox.getSize(receptionViewBox.min.clone()).multiplyScalar(0.5);
    for (const zoom of [1, 1.7, 2.4]) {
      const focus = at(37.7, 33, zoom);
      expect(Math.abs(focus.x - 37.7)).toBeLessThanOrEqual(half.x / zoom + 1e-9);
      expect(Math.abs(focus.z - 33)).toBeLessThanOrEqual(half.z / zoom + 1e-9);
    }
    expect(at(37.7, 33, 2.4).x).toBeGreaterThan(at(37.7, 33, 1).x);
  });
});
