import { readFileSync } from 'node:fs';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, expect, it, vi } from 'vitest';
import { loadReception } from './load-reception';

afterEach(() => vi.restoreAllMocks());
it('loads only the authored room, preserves materials and disposes shared resources once', async () => {
  const bytes = readFileSync('public/models/rooms/reception.glb');
  const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes);
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
  const mesh = gltf.scene.getObjectByProperty('isMesh', true) as Mesh;
  const material = mesh.material;
  const release = vi.spyOn(mesh.geometry, 'dispose');
  const room = await loadReception();
  expect(GLTFLoader.prototype.loadAsync).toHaveBeenCalledWith('/models/rooms/reception.glb');
  expect(room.scene).toBe(gltf.scene); expect(mesh.material).toBe(material);
  expect(room.scene.getObjectByName('ITReception_Tile_0-0')).toBeDefined();
  room.dispose(); room.dispose(); expect(release).toHaveBeenCalledOnce();
});
it('releases shared geometry/material/texture exactly once across multiple room meshes', async () => {
  const texture = new Texture(); const material = new MeshBasicMaterial({ map: texture }); const geometry = new BoxGeometry();
  const scene = new Group(); scene.add(new Mesh(geometry, material), new Mesh(geometry, [material, material]));
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue({ scene } as Awaited<ReturnType<GLTFLoader['loadAsync']>>);
  const geometryRelease = vi.spyOn(geometry, 'dispose'); const materialRelease = vi.spyOn(material, 'dispose'); const textureRelease = vi.spyOn(texture, 'dispose');
  const room = await loadReception(); room.dispose(); room.dispose();
  expect(geometryRelease).toHaveBeenCalledOnce(); expect(materialRelease).toHaveBeenCalledOnce(); expect(textureRelease).toHaveBeenCalledOnce();
});
it('rejects room failure instead of returning a procedural substitute', async () => {
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockRejectedValue(new Error('missing room'));
  await expect(loadReception()).rejects.toThrow('missing room');
});
