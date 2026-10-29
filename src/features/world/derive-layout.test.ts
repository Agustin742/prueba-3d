import { describe, expect, it } from 'vitest';
import { deriveLayout } from './derive-layout';
import { receptionLayout } from './reception-layout';
import { receptionRoom, receptionUnitRoom } from './reception-room';
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
  it('reproduces the previous reception layout from the unit definition footprints and placements', () => {
    const layout = deriveLayout(receptionUnitRoom);
    expect(layout.floor).toEqual({ minX: -5.39, maxX: 5.39, minZ: -4.716, maxZ: 4.716 });
    expect(layout.obstacles.map(obstacle => obstacle.id)).toEqual(previous.map(obstacle => obstacle.id));
    for (const [index, expected] of previous.entries()) {
      const actual = layout.obstacles[index]!;
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

  it('scales footprints per local axis before the yaw turns them', () => {
    const floor = { minX: -9, maxX: 9, minZ: -9, maxZ: 9 };
    const footprint = roomModuleFootprints['wall-left']![0]!;
    const [stretched] = deriveLayout({ floor, placements: [{ module: 'wall-left', position: [1, 0, 2], scale: [2, 1, 1] }] }).obstacles;
    expect(stretched!.minX).toBeCloseTo(1 + footprint.minX * 2, 6); expect(stretched!.maxX).toBeCloseTo(1 + footprint.maxX * 2, 6);
    expect(stretched!.minZ).toBeCloseTo(2 + footprint.minZ, 6); expect(stretched!.maxZ).toBeCloseTo(2 + footprint.maxZ, 6);
    const [turned] = deriveLayout({ floor, placements: [{ module: 'wall-left', position: [0, 0, 0], yaw: Math.PI / 2, scale: [2, 1, 1] }] }).obstacles;
    expect(turned!.maxZ).toBeCloseTo(-footprint.minX * 2, 6); expect(turned!.minZ).toBeCloseTo(-footprint.maxX * 2, 6);
    expect(turned!.minX).toBeCloseTo(footprint.minZ, 6); expect(turned!.maxX).toBeCloseTo(footprint.maxZ, 6);
  });

  it('declares footprints only for known modules and ignores decorative placements', () => {
    for (const id of Object.keys(roomModuleFootprints)) expect(roomModuleIds).toContain(id);
    expect(deriveLayout({ floor: receptionLayout.floor, placements: [{ module: 'desk-bell', position: [0, 0, 0] }] }).obstacles).toEqual([]);
  });
});

// The 4x4 reception: the unit room is its back-left block; walls stretch to the new edges, the door moves to the right of the back wall.
const back = (center: number, half: number, id: string) => ({ id, minX: center - half, maxX: center + half, minZ: -4.84, maxZ: -4.44 });
const grown = [
  back(-2, 3.4, 'back-left'), back(4.8, 3.4, 'back-left'), back(11.6, 3.4, 'back-left'), back(18.4, 3.4, 'back-left'),
  ...[22.8, 24.8, 26.8, 28.8, 30.8, 34.8, 36.8].map(center => back(center, 1, 'back-right')),
  { id: 'left-wall', minX: -5.52, maxX: -5.12, minZ: -4.8, maxZ: 33.15 },
  { id: 'jamb-left', minX: 31.58, maxX: 31.8, minZ: -4.68, maxZ: -4.32 },
  { id: 'jamb-right', minX: 33.8, maxX: 34.02, minZ: -4.68, maxZ: -4.32 },
  { id: 'counter-front', minX: -3.8, maxX: -0.3, minZ: -2.25, maxZ: -1.05 },
  { id: 'counter-return', minX: -1.5, maxX: -0.3, minZ: -3.5, maxZ: -2.25 },
  { id: 'seat', minX: -5.18, maxX: -3.61, minZ: 0.36, maxZ: 3.1 },
  { id: 'planter', minX: 3.84, maxX: 4.86, minZ: -4.14, maxZ: -3.12 },
  { id: 'planter', minX: -4.8165, maxX: -3.7965, minZ: 11.4793, maxZ: 12.4993 },
  { id: 'shelf', minX: -5.34, maxX: -4.66, minZ: 2.3, maxZ: 4.5 },
];

describe('the 4x4 reception layout', () => {
  it('insets the floor from the grown tile envelope exactly as the unit room does', () => {
    expect(receptionLayout.floor).toEqual({ minX: -5.39, maxX: 37.79, minZ: -4.716, maxZ: 33.066 });
  });
  it('stretches the walls, moves the door jambs, adds the left planter and keeps the other furniture', () => {
    // The grown-area decor follows these in placement order.
    expect(receptionLayout.obstacles.slice(0, grown.length).map(obstacle => obstacle.id)).toEqual(grown.map(obstacle => obstacle.id));
    for (const [index, expected] of grown.entries()) for (const side of ['minX', 'maxX', 'minZ', 'maxZ'] as const) {
      expect(receptionLayout.obstacles[index]![side], `${expected.id}#${index}.${side}`).toBeCloseTo(expected[side], 6);
    }
  });
  it('keeps the back wall continuous except for the 2 m door opening', () => {
    const runs = receptionLayout.obstacles.filter(obstacle => obstacle.id.startsWith('back-')).sort((a, b) => a.minX - b.minX);
    const gaps = runs.flatMap((run, index) => index && run.minX - runs[index - 1]!.maxX > 1e-6 ? [[runs[index - 1]!.maxX, run.minX]] : []);
    expect(runs[0]!.minX).toBeCloseTo(-5.4); expect(runs.at(-1)!.maxX).toBeCloseTo(37.8);
    expect(gaps).toHaveLength(1); expect(gaps[0]![0]).toBeCloseTo(31.8); expect(gaps[0]![1]).toBeCloseTo(33.8);
  });
  it('retains the unit-room furniture placements untouched in the grown room', () => {
    const keep = (room: typeof receptionRoom) => room.placements.filter(({ module }) => !/^(floor-|wall-|door$|window$|planter$)/.test(module));
    expect(keep(receptionRoom)).toEqual(expect.arrayContaining(keep(receptionUnitRoom)));
  });
});
