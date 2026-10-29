import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, expect, it, vi } from 'vitest';
import { loadReception } from './load-reception';
import { receptionRoom } from './reception-room';

type Gltf = Awaited<ReturnType<GLTFLoader['loadAsync']>>;
afterEach(() => vi.restoreAllMocks());

const neededModules = [...new Set(receptionRoom.placements.map(placement => placement.module))];
function stubModules(make: (id: string) => Group) {
  return vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async url => ({ scene: make(url.split('/').pop()!.replace('.glb', '')) }) as Gltf);
}

it('loads only the modules the reception needs, never the retired monolith, and composes every placement', async () => {
  const load = stubModules(() => new Group().add(new Mesh(new BoxGeometry(), new MeshBasicMaterial())));
  const room = await loadReception();
  expect(load).toHaveBeenCalledTimes(neededModules.length);
  for (const id of neededModules) expect(load).toHaveBeenCalledWith(`/models/rooms/modules/${id}.glb`);
  expect(load).not.toHaveBeenCalledWith('/models/rooms/reception.glb');
  expect(room.scene.children).toHaveLength(receptionRoom.placements.length);
});
it('releases shared geometry/material/texture exactly once across every clone', async () => {
  const texture = new Texture(); const material = new MeshBasicMaterial({ map: texture }); const geometry = new BoxGeometry();
  stubModules(() => new Group().add(new Mesh(geometry, material)));
  const geometryRelease = vi.spyOn(geometry, 'dispose'); const materialRelease = vi.spyOn(material, 'dispose'); const textureRelease = vi.spyOn(texture, 'dispose');
  const room = await loadReception(); room.dispose(); room.dispose();
  expect(geometryRelease).toHaveBeenCalledOnce(); expect(materialRelease).toHaveBeenCalledOnce(); expect(textureRelease).toHaveBeenCalledOnce();
});
it('rejects room failure instead of returning a procedural substitute', async () => {
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockRejectedValue(new Error('missing room'));
  await expect(loadReception()).rejects.toThrow('missing room');
});
