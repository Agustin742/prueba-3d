import { Box3, Mesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { composeRoom } from './compose-room';
import { receptionRoom } from './reception-room';
import { checkerGrid } from './room-definition';
import { roomModuleIds } from './room-modules';
import monolith from './__fixtures__/reception-monolith-bounds.json';
import { moduleTemplates } from './test-room';

const meshes = (root: Object3D) => { root.updateMatrixWorld(true); const found: Mesh[] = []; root.traverse(node => { if (node instanceof Mesh) found.push(node); }); return found; };
const key = (mesh: Mesh) => { const box = new Box3().setFromObject(mesh); return [...box.min.toArray(), ...box.max.toArray()]; };

describe('checkerGrid', () => {
  it('expands the grid row by row with accent cells overriding the base module', () => {
    const tiles = checkerGrid({ origin: [0, 0], step: 2, cols: 2, rows: 2, y: -1, base: 'floor-tile-pale', accent: 'floor-tile-cream', accents: [[1, 0]] });
    expect(tiles).toEqual([
      { module: 'floor-tile-pale', position: [0, -1, 0] }, { module: 'floor-tile-cream', position: [2, -1, 0] },
      { module: 'floor-tile-pale', position: [0, -1, -2] }, { module: 'floor-tile-pale', position: [2, -1, -2] },
    ]);
  });
});

describe('composeRoom', () => {
  it('places shared clones at the declared position and yaw', async () => {
    const templates = await moduleTemplates(receptionRoom);
    const room = composeRoom({ placements: [{ module: 'bench', position: [1, 2, 3], yaw: Math.PI / 2 }] }, templates);
    const [clone] = room.children;
    expect(clone!.position.toArray()).toEqual([1, 2, 3]); expect(clone!.rotation.y).toBeCloseTo(Math.PI / 2);
    const [mesh] = meshes(clone!); const [source] = meshes(templates.get('bench')!);
    expect(mesh!.geometry).toBe(source!.geometry); expect(mesh!.material).toBe(source!.material);
  });
  it('fails loudly when a placement has no loaded template', () => {
    expect(() => composeRoom({ placements: [{ module: 'bench', position: [0, 0, 0] }] }, new Map())).toThrow('bench');
  });
  it('uses only known modules', () => {
    for (const { module } of receptionRoom.placements) expect(roomModuleIds).toContain(module);
  });

  // Fixture: per-mesh world boxes of the retired reception.glb (git 49070f7), rounded to 3 decimals.
  it('reproduces the retired monolithic reception: same mesh count, per-mesh bounds and overall box', async () => {
    const room = composeRoom(receptionRoom, await moduleTemplates(receptionRoom));
    const composed = meshes(room);
    expect(monolith.meshes).toHaveLength(144); expect(composed).toHaveLength(144);
    const unmatched = [...monolith.meshes];
    for (const box of composed.map(key)) {
      const found = unmatched.findIndex(candidate => candidate.every((value, index) => Math.abs(value - box[index]!) < 0.011));
      expect(found, `no original mesh near ${box.map(value => value.toFixed(3))}`).toBeGreaterThanOrEqual(0);
      unmatched.splice(found, 1);
    }
    expect(unmatched).toHaveLength(0);
    const a = new Box3().setFromObject(room);
    for (const [index, value] of [...a.min.toArray(), ...a.max.toArray()].entries()) expect(value).toBeCloseTo(monolith.box[index]!, 2);
  });
});
