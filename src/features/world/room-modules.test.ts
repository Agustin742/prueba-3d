import { existsSync, readFileSync } from 'node:fs';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { roomModuleIds, roomModulePath } from './room-modules';

async function parse(path: string) {
  const bytes = readFileSync(path);
  const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes);
  return new GLTFLoader().parseAsync(buffer, '');
}

describe.each(roomModuleIds)('room module %s', id => {
  const path = `public/${roomModulePath(id)}`;

  it('ships as a static mesh GLB under one root named after the module', async () => {
    expect(existsSync(path)).toBe(true);
    const gltf = await parse(path);
    expect(gltf.animations).toHaveLength(0);
    expect(gltf.scene.children).toHaveLength(1);
    const root = gltf.scene.children[0]!;
    expect(root.name).toBe(id);
    expect(root.getObjectByProperty('isMesh', true)).toBeDefined();
  });

  it('pivots at the bottom-centre of its bounds', async () => {
    const box = new Box3().setFromObject((await parse(path)).scene);
    const centre = box.getCenter(new Vector3());
    expect(box.min.y).toBeCloseTo(0, 3);
    expect(centre.x).toBeCloseTo(0, 3);
    expect(centre.z).toBeCloseTo(0, 3);
  });
});

it('normalises wall runs along X', async () => {
  for (const id of ['wall-back-left', 'wall-back-right', 'wall-left'] as const) {
    const size = new Box3().setFromObject((await parse(`public/${roomModulePath(id)}`)).scene).getSize(new Vector3());
    expect(size.x, id).toBeGreaterThan(size.z);
  }
});
