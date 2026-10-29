import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, expect, it, vi } from 'vitest';
import { loadRoomModules } from './load-room-modules';

type Gltf = Awaited<ReturnType<GLTFLoader['loadAsync']>>;
afterEach(() => vi.restoreAllMocks());

function stubModules(scenes: Record<string, Group>) {
  return vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async url => ({ scene: scenes[url.split('/').pop()!.replace('.glb', '')]! }) as Gltf);
}

it('loads each requested module once by id from its static path', async () => {
  const bell = new Group(); const lamp = new Group();
  const load = stubModules({ 'desk-bell': bell, 'pendant-lamp': lamp });
  const modules = await loadRoomModules(['desk-bell', 'pendant-lamp', 'desk-bell']);
  expect(load).toHaveBeenCalledTimes(2);
  expect(load).toHaveBeenCalledWith('/models/rooms/modules/desk-bell.glb');
  expect(load).toHaveBeenCalledWith('/models/rooms/modules/pendant-lamp.glb');
  expect(modules.templates.get('desk-bell')).toBe(bell); expect(modules.templates.get('pendant-lamp')).toBe(lamp);
  expect(modules.templates.size).toBe(2);
});
it('releases geometry/material/texture shared across modules exactly once', async () => {
  const texture = new Texture(); const material = new MeshBasicMaterial({ map: texture }); const geometry = new BoxGeometry();
  const a = new Group().add(new Mesh(geometry, material)); const b = new Group().add(new Mesh(geometry, [material, material]));
  stubModules({ 'desk-bell': a, bench: b });
  const geometryRelease = vi.spyOn(geometry, 'dispose'); const materialRelease = vi.spyOn(material, 'dispose'); const textureRelease = vi.spyOn(texture, 'dispose');
  const modules = await loadRoomModules(['desk-bell', 'bench']); modules.dispose(); modules.dispose();
  expect(geometryRelease).toHaveBeenCalledOnce(); expect(materialRelease).toHaveBeenCalledOnce(); expect(textureRelease).toHaveBeenCalledOnce();
});
it('rejects a module failure instead of returning a procedural substitute', async () => {
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockRejectedValue(new Error('missing module'));
  await expect(loadRoomModules(['bench'])).rejects.toThrow('missing module');
});
