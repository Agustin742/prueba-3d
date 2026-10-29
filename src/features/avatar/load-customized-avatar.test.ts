import { readFileSync } from 'node:fs';
import { AnimationMixer, Bone, Camera, Color, Light, Matrix4, Mesh, MeshStandardMaterial, SkinnedMesh, Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppearanceBody, AppearanceCatalogue } from './avatar-appearance';
import type { AvatarConfiguration } from './AvatarCustomizer';
import { loadCustomizedAvatar } from './load-customized-avatar';

const catalogue: AppearanceCatalogue = JSON.parse(readFileSync('public/models/avatars/integration-catalogue.json', 'utf8'));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function configuration(body: AppearanceBody, patch: Partial<AvatarConfiguration> = {}): AvatarConfiguration {
  return { body: body.id, hairId: body.hair[0].id, topId: body.tops[0].id, accessoryId: null,
    hairColor: '#6c4d48', clothingColor: '#5b4f96', nickname: 'Test', ...patch };
}
async function parse(path: string) {
  const bytes = readFileSync(`public/${path.replace(/^\//, '')}`);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new GLTFLoader().parseAsync(buffer, '');
}
function mockLoads(mutate?: (gltf: GLTF, path: string) => void) {
  const loaded: GLTF[] = [];
  const spy = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async url => {
    const path = url.replace('/office/', '/');
    const gltf = await parse(path);
    mutate?.(gltf, path);
    loaded.push(gltf);
    return gltf;
  });
  return { loaded, spy };
}
function meshes(scene: GLTF['scene']) {
  const result: Mesh[] = [];
  scene.traverse(node => { if (node instanceof Mesh) result.push(node); });
  return result;
}
function nearMatrix(actual: Matrix4, expected: Matrix4) {
  actual.elements.forEach((value, i) => expect(Math.abs(value - expected.elements[i])).toBeLessThanOrEqual(1e-5));
}

describe('customized avatar public resource', () => {
  for (const body of catalogue.bodies) {
    const cases = [
      ...body.hair.map(asset => ({ label: `hair ${asset.id}`, patch: { hairId: asset.id } })),
      ...body.tops.map(asset => ({ label: `top ${asset.id}`, patch: { topId: asset.id } })),
      ...body.accessories.map(asset => ({ label: `accessory ${asset.id}`, patch: { accessoryId: asset.id } })),
    ];
    for (const entry of cases) it(`${body.id}: composes ${entry.label} on the body rig in authored space`, async () => {
      const { loaded } = mockLoads();
      const avatar = await loadCustomizedAvatar(configuration(body, entry.patch), catalogue, false);
      const originalBody = loaded[0];
      const bodySkin = meshes(originalBody.scene).find(node => node instanceof SkinnedMesh) as SkinnedMesh;
      const canonical = new Map(bodySkin.skeleton.bones.map(bone => [bone.name, bone]));
      expect(canonical.size).toBe(body.id === 'female' ? 41 : 34);
      const moduleGeometry = new Set(loaded.slice(1).flatMap(gltf => meshes(gltf.scene).map(mesh => mesh.geometry)));
      const added = meshes(avatar.scene).filter(mesh => moduleGeometry.has(mesh.geometry));
      expect(added.length).toBeGreaterThanOrEqual(2);
      for (const module of loaded.slice(1)) {
        for (const source of meshes(module.scene)) {
          const target = added.find(mesh => mesh.name === source.name) as SkinnedMesh;
          expect(target).toBeDefined();
          expect(target).not.toBe(source);
          expect(target.geometry).toBe(source.geometry);
          nearMatrix(target.matrixWorld, source.matrixWorld);
          if (source instanceof SkinnedMesh) {
            expect(target.skeleton.bones.map(bone => bone.name)).toEqual(source.skeleton.bones.map(bone => bone.name));
            target.skeleton.bones.forEach((bone, i) => {
              expect(bone).toBe(canonical.get(source.skeleton.bones[i].name));
              nearMatrix(target.skeleton.boneInverses[i], source.skeleton.boneInverses[i]);
            });
            nearMatrix(target.bindMatrix, source.bindMatrix);
            expect(target.skeleton).not.toBe(bodySkin.skeleton);
          }
        }
      }
      const bones: Bone[] = [];
      avatar.scene.traverse(node => {
        if (node instanceof Bone) bones.push(node);
        expect(node instanceof Light || node instanceof Camera).toBe(false);
      });
      expect(bones.length).toBe(canonical.size);
      expect(meshes(avatar.scene).filter(mesh => mesh.morphTargetInfluences?.length).length).toBeGreaterThanOrEqual(2);
      const idle = originalBody.animations.find(clip => clip.name === 'Idle')!;
      const walk = originalBody.animations.find(clip => clip.name === 'Walk')!;
      expect(avatar.mixer.existingAction(idle)?.isRunning()).toBe(true);
      const before = canonical.get('DEF-thighL')!.quaternion.clone();
      avatar.setMoving!(true);
      avatar.update(0.1);
      avatar.scene.updateMatrixWorld(true);
      expect(avatar.mixer.existingAction(walk)?.isRunning()).toBe(true);
      expect(canonical.get('DEF-thighL')!.quaternion.equals(before)).toBe(false);
      avatar.setMoving!(false);
      expect(avatar.mixer.existingAction(idle)?.isRunning()).toBe(true);
      expect(avatar.mixer.existingAction(walk)?.isRunning()).toBe(false);
      avatar.dispose();
    });
  }

  it('uses the length-preserving female hoodie candidate and deployment base', async () => {
    vi.stubEnv('BASE_URL', '/office/');
    const { spy } = mockLoads();
    const avatar = await loadCustomizedAvatar(configuration(catalogue.bodies[1], { topId: 'hoodie' }), catalogue, true);
    expect(spy).toHaveBeenCalledWith('/office/models/avatars-hem-correction/female/top-hoodie.glb');
    avatar.dispose();
  });

  it('rejects invalid choices and colors before any GLB load', async () => {
    const { spy } = mockLoads();
    for (const patch of [{ body: 'other' }, { hairId: 'other' }, { topId: 'other' }, { accessoryId: 'other' }, { hairColor: 'red' }, { clothingColor: '#bad' }]) {
      await expect(loadCustomizedAvatar(configuration(catalogue.bodies[0], patch as Partial<AvatarConfiguration>), catalogue, false)).rejects.toThrow();
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('leaves reduced motion static, preserves rigid faces, and makes lifecycle calls inert after disposal', async () => {
    const { loaded, spy } = mockLoads();
    const avatar = await loadCustomizedAvatar(configuration(catalogue.bodies[1]), catalogue, true);
    expect(spy).toHaveBeenCalledTimes(3); // null accessory is valid and downloads nothing.
    const face = avatar.scene.getObjectByName('eyes') as Mesh;
    const local = face.matrix.clone();
    const parent = face.parent;
    const bone = avatar.scene.getObjectByName('DEF-thighL')!;
    const before = bone.quaternion.clone();
    avatar.setMoving!(true);
    avatar.update(5);
    expect(avatar.mixer.time).toBeCloseTo(0.1);
    expect(bone.quaternion.equals(before)).toBe(true);
    nearMatrix(face.matrix, local);
    expect(face.parent).toBe(parent);
    expect(face.morphTargetInfluences?.length).toBe(4);
    for (const clip of loaded[0].animations) expect(avatar.mixer.existingAction(clip)).toBeNull();
    const stop = vi.spyOn(avatar.mixer, 'stopAllAction');
    avatar.dispose();
    avatar.dispose();
    avatar.update(1);
    avatar.setMoving!(false);
    expect(avatar.mixer.time).toBeCloseTo(0.1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('isolates declared tints, retains detail colors, and releases every owned GPU resource exactly once', async () => {
    const textures: Texture[] = [];
    mockLoads(gltf => {
      const texture = new Texture();
      vi.spyOn(texture, 'dispose');
      textures.push(texture);
      for (const mesh of meshes(gltf.scene)) {
        vi.spyOn(mesh.geometry, 'dispose');
        if (mesh instanceof SkinnedMesh) vi.spyOn(mesh.skeleton, 'dispose');
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          (material as MeshStandardMaterial).map = texture;
          vi.spyOn(material, 'dispose');
        }
      }
    });
    const body = catalogue.bodies[0];
    const first = await loadCustomizedAvatar(configuration(body, { hairId: 'dreads', topId: 'hoodie' }), catalogue, false);
    const second = await loadCustomizedAvatar(configuration(body, { hairId: 'dreads', hairColor: '#e5ad58' }), catalogue, false);
    const materials = (scene: GLTF['scene']) => meshes(scene).flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[];
    expect(materials(first.scene).filter(mat => mat.name === 'AvatarHairTint').every(mat => mat.color.equals(new Color('#6c4d48')))).toBe(true);
    expect(materials(second.scene).filter(mat => mat.name === 'AvatarHairTint').every(mat => mat.color.equals(new Color('#e5ad58')))).toBe(true);
    expect(materials(first.scene).filter(mat => mat.name === 'AvatarDetail').every(mat => !mat.color.equals(new Color('#5b4f96')))).toBe(true);
    const firstResources = [...new Set(meshes(first.scene).map(mesh => mesh.geometry)), ...new Set(materials(first.scene)),
      ...new Set(meshes(first.scene).filter((mesh): mesh is SkinnedMesh => mesh instanceof SkinnedMesh).map(mesh => mesh.skeleton))];
    const disposals = firstResources.map(resource => vi.spyOn(resource, 'dispose'));
    first.dispose();
    first.dispose();
    disposals.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    textures.slice(0, 3).forEach(texture => expect(texture.dispose).toHaveBeenCalledTimes(1));
    textures.slice(3).forEach(texture => expect(texture.dispose).not.toHaveBeenCalled());
    second.update(0.1);
    second.dispose();
  });

  for (const corruption of ['missing', 'duplicate', 'rest', 'inverse', 'parent'] as const) {
    it(`rejects ${corruption} module joints and releases loaded resources`, async () => {
      const disposals: ReturnType<typeof vi.spyOn>[] = [];
      mockLoads((gltf, path) => {
        for (const mesh of meshes(gltf.scene)) disposals.push(vi.spyOn(mesh.geometry, 'dispose'));
        if (path.includes('hair-')) {
          const mesh = meshes(gltf.scene)[0] as SkinnedMesh;
          const bone = mesh.skeleton.bones[0];
          if (corruption === 'missing') bone.name = 'missing';
          if (corruption === 'duplicate') mesh.skeleton.bones[1].name = bone.name;
          if (corruption === 'rest') bone.position.x += 0.01;
          if (corruption === 'inverse') mesh.skeleton.boneInverses[0].elements[12] += 0.01;
          if (corruption === 'parent') mesh.skeleton.bones[2].add(bone);
        }
      });
      await expect(loadCustomizedAvatar(configuration(catalogue.bodies[0]), catalogue, false)).rejects.toThrow(/bone|bind|rest|parent|joint/i);
      disposals.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    });
  }

  it('releases already loaded assets on a later download failure without starting any subsequent load', async () => {
    const body = await parse(catalogue.bodies[0].path);
    const geometry = meshes(body.scene)[0].geometry;
    const dispose = vi.spyOn(geometry, 'dispose');
    const spy = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValueOnce(body).mockRejectedValueOnce(new Error('offline'));
    await expect(loadCustomizedAvatar(configuration(catalogue.bodies[0], { accessoryId: 'cap' }), catalogue, false)).rejects.toThrow('offline');
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
