import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { receptionLayout } from './reception-layout';

// Real exported GLB, not a mocked scene or a history-dependent fixture.
const bytes = readFileSync('public/models/rooms/reception.glb');
const asset = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
function bounds(name: string) {
  const node = asset.nodes.find((entry: { name: string }) => entry.name === `ITReception_${name}`);
  expect(node, name).toBeDefined();
  expect(node.matrix ?? node.translation ?? node.rotation ?? node.scale).toBeUndefined();
  const accessor = asset.accessors[asset.meshes[node.mesh].primitives[0].attributes.POSITION];
  return [...accessor.min, ...accessor.max] as number[];
}

describe('reception layout derived from the authored GLB', () => {
  it('keeps the floor inside the tile envelope, not the floating plinth or open portal', () => {
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    const first = bounds('Tile 0-0');
    const last = bounds('Tile 7-6');
    expect(receptionLayout.floor).toEqual({ minX: -5.39, maxX: 5.39, minZ: -4.716, maxZ: 4.716 });
    expect(first[0]).toBeCloseTo(-5.391);
    expect(first[5]).toBeCloseTo(4.716);
    expect(last[3]).toBeCloseTo(5.391);
    expect(last[2]).toBeCloseTo(-4.716);
    expect(bounds('Threshold')[2]).toBeLessThan(receptionLayout.floor.minZ);
  });

  it('matches structural and furniture bounds while preserving the L recess', () => {
    const sources: Record<string, string[]> = {
      'back-left': ['Back left', 'Back left lower band', 'Back left rail'],
      'back-right': ['Back right', 'Back right lower band', 'Back right rail'],
      'left-wall': ['Left wall', 'Left lower band', 'Left rail'],
      'jamb-left': ['Door jamb'], 'jamb-right': ['Door jamb.001'],
      'counter-front': ['L counter warm carcass', 'Coral counter crown'],
      'counter-return': ['L counter warm carcass', 'Coral counter crown'],
      seat: ['Seat timber cradle', 'Seat arm', 'Seat arm.001', 'Upholstered back'],
      planter: ['Tapered planter', 'Planter rim'],
      shelf: ['Layered display shelf', 'Layered display shelf.001'],
    };
    expect(receptionLayout.obstacles.map(obstacle => obstacle.id)).toEqual(Object.keys(sources));
    for (const obstacle of receptionLayout.obstacles) {
      const boxes = sources[obstacle.id].map(bounds);
      // Rounded to conservative centimetres; counter is deliberately two rectangles.
      if (!obstacle.id.startsWith('counter-')) {
        expect(Math.abs(obstacle.minX - Math.min(...boxes.map(box => box[0])))).toBeLessThan(0.011);
        expect(Math.abs(obstacle.maxX - Math.max(...boxes.map(box => box[3])))).toBeLessThan(0.011);
        expect(obstacle.minZ).toBeLessThanOrEqual(Math.min(...boxes.map(box => box[2])) + 0.011);
        expect(obstacle.maxZ).toBeGreaterThanOrEqual(Math.max(...boxes.map(box => box[5])) - 0.011);
      }
    }
    const crown = bounds('Coral counter crown');
    expect(crown[0]).toBeCloseTo(-3.8);
    expect(crown[3]).toBeCloseTo(-0.3);
    expect(crown[2]).toBeCloseTo(-3.5);
    expect(crown[5]).toBeCloseTo(-1.1);
    expect(bounds('Pendant shade')[1]).toBeGreaterThan(2.9);
    expect(bounds('Tray stationery')[1]).toBeGreaterThan(1.5);
    expect(receptionLayout.obstacles.filter(box => box.id.startsWith('counter-'))).toEqual([
      { id: 'counter-front', minX: -3.8, maxX: -0.3, minZ: -2.25, maxZ: -1.05 },
      { id: 'counter-return', minX: -1.5, maxX: -0.3, minZ: -3.5, maxZ: -2.25 },
    ]);
  });
});
