import { describe, expect, it } from 'vitest';
import { deriveLayout } from './derive-layout';
import { receptionLayout } from './reception-layout';
import { roomModuleFootprints, roomModuleIds } from './room-modules';

// The hand-tuned reception obstacles that predate footprint derivation.
const previous = [
  { id: 'back-left', minX: -5.4, maxX: 1.4, minZ: -4.84, maxZ: -4.44 },
  { id: 'back-right', minX: 3.4, maxX: 5.4, minZ: -4.84, maxZ: -4.44 },
  { id: 'left-wall', minX: -5.52, maxX: -5.12, minZ: -4.8, maxZ: 4.8 },
  { id: 'jamb-left', minX: 1.18, maxX: 1.4, minZ: -4.68, maxZ: -4.32 },
  { id: 'jamb-right', minX: 3.4, maxX: 3.62, minZ: -4.68, maxZ: -4.32 },
  { id: 'counter-front', minX: -3.8, maxX: -0.3, minZ: -2.25, maxZ: -1.05 },
  { id: 'counter-return', minX: -1.5, maxX: -0.3, minZ: -3.5, maxZ: -2.25 },
  { id: 'seat', minX: -5.18, maxX: -3.61, minZ: 0.36, maxZ: 3.1 },
  { id: 'planter', minX: 3.84, maxX: 4.86, minZ: -4.14, maxZ: -3.12 },
  { id: 'shelf', minX: -5.34, maxX: -4.66, minZ: 2.3, maxZ: 4.5 },
];

describe('deriveLayout', () => {
  it('reproduces the previous reception layout from module footprints and placements', () => {
    expect(receptionLayout.floor).toEqual({ minX: -5.39, maxX: 5.39, minZ: -4.716, maxZ: 4.716 });
    expect(receptionLayout.obstacles.map(obstacle => obstacle.id)).toEqual(previous.map(obstacle => obstacle.id));
    for (const [index, expected] of previous.entries()) {
      const actual = receptionLayout.obstacles[index]!;
      for (const side of ['minX', 'maxX', 'minZ', 'maxZ'] as const) expect(actual[side], `${expected.id}.${side}`).toBeCloseTo(expected[side], 6);
    }
  });

  it('translates and rotates footprints by quarter-turn yaw, keeping rectangles axis-aligned', () => {
    const floor = { minX: -9, maxX: 9, minZ: -9, maxZ: 9 };
    const footprint = roomModuleFootprints.planter![0]!;
    const turned = deriveLayout({ floor, placements: [{ module: 'planter', position: [1, 0, 2], yaw: Math.PI / 2 }] }).obstacles[0]!;
    expect(turned.minX).toBeCloseTo(1 + footprint.minZ, 6); expect(turned.maxX).toBeCloseTo(1 + footprint.maxZ, 6);
    expect(turned.minZ).toBeCloseTo(2 - footprint.maxX, 6); expect(turned.maxZ).toBeCloseTo(2 - footprint.minX, 6);
    const plain = deriveLayout({ floor, placements: [{ module: 'planter', position: [1, 0, 2] }] }).obstacles[0]!;
    expect(plain.id).toBe(footprint.id); expect(plain.minX).toBeCloseTo(1 + footprint.minX, 6); expect(plain.maxZ).toBeCloseTo(2 + footprint.maxZ, 6);
  });

  it('declares footprints only for known modules and ignores decorative placements', () => {
    for (const id of Object.keys(roomModuleFootprints)) expect(roomModuleIds).toContain(id);
    expect(deriveLayout({ floor: receptionLayout.floor, placements: [{ module: 'desk-bell', position: [0, 0, 0] }] }).obstacles).toEqual([]);
  });
});
