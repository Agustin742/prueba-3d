import { readFileSync } from 'node:fs';
import { AnimationMixer, Bone, Matrix4, Mesh, MeshStandardMaterial, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as original from './load-avatar';
import { parseAppearanceCatalogue } from './avatar-catalogue';
import { loadCustomizedAvatar } from './load-customized-avatar';

const configuration = { body: 'male' as const, hairId: 'afro', topId: 'hoodie', accessoryId: null, hairColor: '#353849', clothingColor: '#75B7DA' };
const catalogue = () => parseAppearanceCatalogue(JSON.parse(readFileSync('public/models/avatars/integration-catalogue.json', 'utf8')));
async function parse(path: string) {
  const bytes = readFileSync(`public/${path.replace(/^\//, '')}`);
  const buffer = new ArrayBuffer(bytes.length); new Uint8Array(buffer).set(bytes);
  return new GLTFLoader().parseAsync(buffer, '');
}
async function fixture() {
  const base = await parse('models/character.glb');
  const modules = await Promise.all(['hair-afro', 'top-hoodie'].map(id => parse(`models/avatars/male/${id}.glb`)));
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValueOnce(base);
  modules.forEach(module => load.mockResolvedValueOnce(module));
  return { base, modules, load };
}
const meshes = (scene: original.AvatarResource['scene']) => {
  const result: SkinnedMesh[] = []; scene.traverse(node => { if (node instanceof SkinnedMesh) result.push(node); }); return result;
};
afterEach(() => vi.restoreAllMocks());
describe('additive avatar ownership', () => {
  it('returns the public loader resource unchanged, preserving original identities and controller behavior', async () => {
    const { base, modules } = await fixture();
    const identities = meshes(base.scene).map(mesh => [mesh, mesh.skeleton, mesh.material]);
    const sourceDisposals = modules.flatMap(module => meshes(module.scene).flatMap(mesh => [vi.spyOn(mesh.skeleton, 'dispose'), vi.spyOn(mesh.material as MeshStandardMaterial, 'dispose')]));
    const loader = vi.spyOn(original, 'loadAvatar');
    const avatar = await loadCustomizedAvatar(configuration, catalogue(), false);
    expect(loader).toHaveBeenCalledWith(false);
    expect(avatar).toBe(await loader.mock.results[0].value);
    expect(avatar.scene).toBe(base.scene); expect(avatar.mixer).toBeInstanceOf(AnimationMixer);
    identities.forEach(([mesh, skeleton, material]) => { expect((mesh as Mesh).material).toBe(material); expect((mesh as SkinnedMesh).skeleton).toBe(skeleton); });
    const canonical = new Set<Bone>(); identities.forEach(([mesh]) => (mesh as SkinnedMesh).skeleton.bones.forEach(bone => canonical.add(bone)));
    const added = meshes(avatar.scene).slice(identities.length);
    expect(added).toHaveLength(2);
    added.forEach((mesh, i) => {
      expect(mesh.skeleton.bones.every(bone => canonical.has(bone))).toBe(true);
      expect(mesh.skeleton.boneInverses).toEqual(meshes(modules[i].scene)[0].skeleton.boneInverses);
      const tint = mesh.material as MeshStandardMaterial;
      expect(tint).not.toBe(meshes(modules[i].scene)[0].material);
      expect(tint.color.getHexString()).toBe(i ? '75b7da' : '353849');
    });
    avatar.update(0.1); avatar.setMoving!(true); avatar.update(0.05);
    const action = (name: string) => avatar.mixer.existingAction(base.animations.find(clip => clip.name === name)!);
    expect(action('Run')!.isRunning()).toBe(true);
    expect(action('Idle')!.getEffectiveWeight()).toBeLessThan(1);
    avatar.setMoving!(false); const gesture = avatar.playGesture!([{ clip: 'Run', hold: 0.1 }]);
    avatar.update(5); await gesture; expect(avatar.mixer.time).toBeCloseTo(0.25);
    const disposals = added.flatMap(mesh => [vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(mesh.material as MeshStandardMaterial, 'dispose'), vi.spyOn(mesh.skeleton, 'dispose')]);
    avatar.dispose(); avatar.dispose(); [...disposals, ...sourceDisposals].forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  });
  it('keeps reduced motion and no-accessory behavior on the original controller', async () => {
    const { base, load } = await fixture();
    const avatar = await loadCustomizedAvatar(configuration, catalogue(), true);
    avatar.setMoving!(true); await avatar.playGesture!([{ clip: 'Run' }]); avatar.update(0.1);
    expect(avatar.mixer.existingAction(base.animations.find(clip => clip.name === 'Idle')!)).toBeNull();
    expect(load).toHaveBeenCalledTimes(3); avatar.dispose();
  });
  it.each(['joint', 'parent', 'rest', 'inverse', 'rigid', 'material', 'extra-bone'])('rejects incompatible %s and cleans the base and in-flight module once', async defect => {
    const { base, modules } = await fixture(); const mesh = meshes(modules[0].scene)[0];
    if (defect === 'joint') mesh.skeleton.bones[0].name = 'unsupported';
    if (defect === 'extra-bone') modules[0].scene.add(new Bone());
    if (defect === 'parent') mesh.skeleton.bones[0].removeFromParent();
    if (defect === 'rest') mesh.skeleton.bones[0].position.x += 1;
    if (defect === 'inverse') mesh.skeleton.boneInverses[0].elements[12] += 1;
    if (defect === 'rigid') modules[0].scene.add(new Mesh(mesh.geometry, mesh.material));
    if (defect === 'material') (mesh.material as MeshStandardMaterial).name = 'Body';
    const disposals = [vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(mesh.skeleton, 'dispose'), vi.spyOn(mesh.material as MeshStandardMaterial, 'dispose'), vi.spyOn(meshes(base.scene)[0].geometry, 'dispose')];
    await expect(loadCustomizedAvatar(configuration, catalogue(), false)).rejects.toThrow();
    disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  });
  it('cleans previously attached modules on a later download failure', async () => {
    const { modules, load } = await fixture(); load.mockReset();
    load.mockResolvedValueOnce(await parse('models/character.glb')).mockResolvedValueOnce(modules[0]).mockRejectedValueOnce(Error('offline'));
    const geometry = vi.spyOn(meshes(modules[0].scene)[0].geometry, 'dispose');
    await expect(loadCustomizedAvatar(configuration, catalogue(), false)).rejects.toThrow('offline'); expect(geometry).toHaveBeenCalledTimes(1);
  });
  it('remaps module order rather than substituting the original skeleton and preserves mesh placement', async () => {
    const { modules } = await fixture(); const source = meshes(modules[0].scene)[0];
    source.skeleton.bones.reverse(); source.skeleton.boneInverses.reverse();
    // Reverse vertex indices with the joint array to retain the authored skin.
    const indices = source.geometry.getAttribute('skinIndex');
    for (let i = 0; i < indices.count; i++) for (let c = 0; c < 4; c++) indices.setComponent(i, c, 33 - indices.getComponent(i, c));
    source.position.x = 0.02; modules[0].scene.updateMatrixWorld(true);
    source.bindMatrix.copy(source.matrixWorld); source.bindMatrixInverse.copy(source.bindMatrix).invert();
    const world = source.matrixWorld.clone();
    const names = source.skeleton.bones.map(bone => bone.name);
    const avatar = await loadCustomizedAvatar(configuration, catalogue(), false);
    const target = meshes(avatar.scene).find(mesh => mesh.geometry === source.geometry)!;
    expect(target.skeleton.bones.map(bone => bone.name)).toEqual(names);
    expect(target.skeleton).not.toBe(source.skeleton);
    expect(target.matrixWorld.elements).toEqual(world.elements);
    expect(target.bindMatrix).toEqual(world);
    expect(target.skeleton.boneInverses[0]).toBeInstanceOf(Matrix4);
    avatar.dispose();
  });
  it('rejects unsupported choices and colors before loading', async () => {
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync');
    for (const change of [{ body: 'female' }, { hairId: 'original' }, { accessoryId: 'earrings' }, { hairColor: 'red' }]) {
      await expect(loadCustomizedAvatar({ ...configuration, ...change } as typeof configuration, catalogue(), false)).rejects.toThrow();
    }
    expect(load).not.toHaveBeenCalled();
  });
  it('accepts all nine real modules with authored accessory colors and isolated tints', async () => {
    const body = catalogue().bodies[0];
    for (const asset of [...body.hair, ...body.tops, ...body.accessories]) {
      const base = await parse('models/character.glb'); const selected = await parse(asset.path);
      const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValueOnce(base);
      const hair = asset.slot === 'hair' ? selected : await parse(body.hair[0].path);
      const top = asset.slot === 'top' ? selected : await parse(body.tops[0].path);
      load.mockResolvedValueOnce(hair).mockResolvedValueOnce(top);
      if (asset.slot === 'accessory') load.mockResolvedValueOnce(selected);
      const sources = meshes(selected.scene); const colors = sources.map(mesh => (mesh.material as MeshStandardMaterial).color.clone());
      const avatar = await loadCustomizedAvatar({ ...configuration, hairId: asset.slot === 'hair' ? asset.id : 'afro', topId: asset.slot === 'top' ? asset.id : 'hoodie', accessoryId: asset.slot === 'accessory' ? asset.id : null }, catalogue(), false);
      sources.forEach((mesh, i) => {
        expect((mesh.material as MeshStandardMaterial).color).toEqual(colors[i]);
        const target = meshes(avatar.scene).find(candidate => candidate.geometry === mesh.geometry)!;
        if (asset.slot === 'accessory') expect(target.material).toBe(mesh.material);
        expect(target.skeleton.bones.map(bone => bone.name)).toEqual(mesh.skeleton.bones.map(bone => bone.name));
      });
      avatar.dispose(); load.mockRestore();
    }
  });
});
