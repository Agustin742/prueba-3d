import { readFileSync } from 'node:fs';
import { Box3, Mesh, type Group, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { composeRoom } from './compose-room';
import { receptionRoom } from './reception-room';
import { checkerGrid, type RoomDefinition } from './room-definition';
import { roomModuleIds, roomModulePath, type RoomModuleId } from './room-modules';

async function parse(path: string) {
  const bytes = readFileSync(path);
  const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes);
  return new GLTFLoader().parseAsync(buffer, '');
}
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
  const templatesFor = async (definition: RoomDefinition) => new Map<RoomModuleId, Group>(await Promise.all(
    [...new Set(definition.placements.map(placement => placement.module))].map(async id => [id, (await parse(`public/${roomModulePath(id)}`)).scene] as const)));

  it('places shared clones at the declared position and yaw', async () => {
    const templates = await templatesFor(receptionRoom);
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

  it('reproduces the monolithic reception: same mesh count, per-mesh bounds and overall box', async () => {
    const room = composeRoom(receptionRoom, await templatesFor(receptionRoom));
    const monolith = (await parse('public/models/rooms/reception.glb')).scene;
    const composed = meshes(room); const original = meshes(monolith);
    expect(original).toHaveLength(144); expect(composed).toHaveLength(144);
    const unmatched = original.map(key);
    for (const box of composed.map(key)) {
      const found = unmatched.findIndex(candidate => candidate.every((value, index) => Math.abs(value - box[index]!) < 0.011));
      expect(found, `no original mesh near ${box.map(value => value.toFixed(3))}`).toBeGreaterThanOrEqual(0);
      unmatched.splice(found, 1);
    }
    expect(unmatched).toHaveLength(0);
    const a = new Box3().setFromObject(room); const b = new Box3().setFromObject(monolith);
    for (const [index, value] of [...a.min.toArray(), ...a.max.toArray()].entries()) expect(value).toBeCloseTo([...b.min.toArray(), ...b.max.toArray()][index]!, 2);
  });
});
