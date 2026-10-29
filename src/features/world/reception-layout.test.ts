import { Box3, Mesh, type Group } from 'three';
import { describe, expect, it } from 'vitest';
import { deriveLayout } from './derive-layout';
import { receptionLayout } from './reception-layout';
import { receptionRoom, receptionUnitRoom } from './reception-room';
import { composedReception } from './test-room';

// Real module GLBs composed by the reception placements, not a mocked scene or a history-dependent fixture.
const unit = await composedReception(receptionUnitRoom);
const grown = await composedReception(receptionRoom);
[unit, grown].forEach(room => room.updateMatrixWorld(true));
// World AABB [minX, minY, minZ, maxX, maxY, maxZ] over every mesh whose source name matches (repeated clones and instances included).
function bounds(room: Group, name: string | RegExp) {
  const box = new Box3();
  room.traverse(node => {
    const source = node.userData.name as string | undefined;
    if (node instanceof Mesh && source !== undefined && (typeof name === 'string' ? source === name : name.test(source))) box.expandByObject(node);
  });
  expect(box.isEmpty(), String(name)).toBe(false);
  return [...box.min.toArray(), ...box.max.toArray()] as number[];
}

describe('reception layout derived from the composed module GLBs', () => {
  const layout = deriveLayout(receptionUnitRoom);
  it('keeps the unit floor inside the tile envelope, not the floating plinth or open portal', () => {
    const tiles = bounds(unit, /^Tile \d+-\d+$/);
    expect(layout.floor).toEqual({ minX: -5.39, maxX: 5.39, minZ: -4.716, maxZ: 4.716 });
    expect(tiles[0]).toBeCloseTo(-5.391);
    expect(tiles[5]).toBeCloseTo(4.716);
    expect(tiles[3]).toBeCloseTo(5.391);
    expect(tiles[2]).toBeCloseTo(-4.716);
    expect(bounds(unit, 'Threshold')[2]).toBeLessThan(layout.floor.minZ);
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
    expect(layout.obstacles.map(obstacle => obstacle.id)).toEqual(Object.keys(sources));
    for (const obstacle of layout.obstacles) {
      const boxes = sources[obstacle.id].map(name => bounds(unit, name));
      // Rounded to conservative centimetres; counter is deliberately two rectangles.
      if (!obstacle.id.startsWith('counter-')) {
        expect(Math.abs(obstacle.minX - Math.min(...boxes.map(box => box[0])))).toBeLessThan(0.011);
        expect(Math.abs(obstacle.maxX - Math.max(...boxes.map(box => box[3])))).toBeLessThan(0.011);
        expect(obstacle.minZ).toBeLessThanOrEqual(Math.min(...boxes.map(box => box[2])) + 0.011);
        expect(obstacle.maxZ).toBeGreaterThanOrEqual(Math.max(...boxes.map(box => box[5])) - 0.011);
      }
    }
    const crown = bounds(unit, 'Coral counter crown');
    expect(crown[0]).toBeCloseTo(-3.8);
    expect(crown[3]).toBeCloseTo(-0.3);
    expect(crown[2]).toBeCloseTo(-3.5);
    expect(crown[5]).toBeCloseTo(-1.1);
    expect(bounds(unit, 'Pendant shade')[1]).toBeGreaterThan(2.9);
    expect(bounds(unit, 'Tray stationery')[1]).toBeGreaterThan(1.5);
    expect(layout.obstacles.filter(box => box.id.startsWith('counter-'))).toEqual([
      { id: 'counter-front', minX: -3.8, maxX: -0.3, minZ: -2.25, maxZ: -1.05 },
      { id: 'counter-return', minX: -1.5, maxX: -0.3, minZ: -3.5, maxZ: -2.25 },
    ]);
  });
});

describe('the 4x4 reception layout against its composed GLBs', () => {
  it('insets the floor from the 32x28 tile envelope by the same margin as the unit room', () => {
    const tiles = bounds(grown, /^Tile \d+-\d+$/);
    expect(receptionLayout.floor).toEqual({ minX: -5.39, maxX: 37.79, minZ: -4.716, maxZ: 33.066 });
    expect(tiles[0]).toBeCloseTo(-5.391); expect(tiles[3]).toBeCloseTo(37.791);
    expect(tiles[2]).toBeCloseTo(-4.716); expect(tiles[5]).toBeCloseTo(33.066);
  });
  it('covers the whole back and left edges with walls and sits the door opening in the right part of the back wall', () => {
    const back = bounds(grown, /^Back (left|right)$/); const left = bounds(grown, 'Left wall');
    expect(back[0]).toBeCloseTo(-5.4); expect(back[3]).toBeCloseTo(37.8);
    expect(left[2]).toBeCloseTo(-4.8); expect(left[5]).toBeCloseTo(33.15);
    const jambs = bounds(grown, /^Door jamb/);
    expect(jambs[0]).toBeCloseTo(31.58); expect(jambs[3]).toBeCloseTo(34.02);
    expect(bounds(grown, 'Threshold')[0]).toBeGreaterThan(31.8);
    expect(bounds(grown, 'Threshold')[3]).toBeLessThan(33.81);
  });
  it('places the new planter against the left wall and the new window high on the left wall', () => {
    const planter = bounds(grown, 'Tapered planter'); const windows = bounds(grown, 'Rounded window frame');
    expect(planter[2]).toBeLessThan(11.5); expect(planter[5]).toBeGreaterThan(12.4);
    expect(windows[2]).toBeLessThan(-1); expect(windows[5]).toBeGreaterThan(19.5);
  });
});
