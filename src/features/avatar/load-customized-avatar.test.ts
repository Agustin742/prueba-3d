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
async function fixture(body: 'male' | 'female' = 'male') {
  const base = await parse(body === 'male' ? 'models/character.glb' : 'models/avatars/female/body.glb');
  const selected = catalogue().bodies.find(candidate => candidate.id === body)!;
  const modules = await Promise.all([selected.hair.find(asset => asset.id === 'afro')!, selected.tops.find(asset => asset.id === 'hoodie')!].map(asset => parse(asset.path)));
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValueOnce(base);
  modules.forEach(module => load.mockResolvedValueOnce(module));
  return { base, modules, load };
}
const meshes = (scene: original.AvatarResource['scene']) => {
  const result: SkinnedMesh[] = []; scene.traverse(node => { if (node instanceof SkinnedMesh) result.push(node); }); return result;
};
afterEach(() => vi.restoreAllMocks());
describe('additive avatar ownership', () => {
  it.each(['male', 'female'] as const)('returns the %s public loader resource unchanged, preserving identities and controller behavior', async body => {
    const { base, modules } = await fixture(body);
    const identities = meshes(base.scene).map(mesh => [mesh, mesh.skeleton, mesh.material]);
    const sourceDisposals = modules.flatMap(module => meshes(module.scene).flatMap(mesh => [vi.spyOn(mesh.skeleton, 'dispose'), vi.spyOn(mesh.material as MeshStandardMaterial, 'dispose')]));
    const loader = vi.spyOn(original, 'loadAvatar');
    const avatar = await loadCustomizedAvatar({ ...configuration, body }, catalogue(), false);
    if (body === 'male') expect(loader).toHaveBeenCalledWith(false);
    else expect(loader).toHaveBeenCalledWith(false, 'models/avatars/female/body.glb');
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
  it.each(['male', 'female'] as const)('keeps %s reduced motion and no-accessory behavior on the original controller', async body => {
    const { base, load } = await fixture(body);
    const avatar = await loadCustomizedAvatar({ ...configuration, body }, catalogue(), true);
    avatar.setMoving!(true); await avatar.playGesture!([{ clip: 'Run' }]); avatar.update(0.1);
    expect(avatar.mixer.existingAction(base.animations.find(clip => clip.name === 'Idle')!)).toBeNull();
    expect(load).toHaveBeenCalledTimes(3); avatar.dispose();
  });
  it.each((['male', 'female'] as const).flatMap(body => ['joint', 'parent', 'rest', 'inverse', 'rigid', 'material', 'extra-bone'].map(defect => ({ body, defect }))))('rejects incompatible $body $defect and cleans resources once', async ({ body, defect }) => {
    const { base, modules } = await fixture(body); const mesh = meshes(modules[0].scene)[0];
    if (defect === 'joint') mesh.skeleton.bones[0].name = 'unsupported';
    if (defect === 'extra-bone') modules[0].scene.add(new Bone());
    if (defect === 'parent') mesh.skeleton.bones[0].removeFromParent();
    if (defect === 'rest') mesh.skeleton.bones[0].position.x += 1;
    if (defect === 'inverse') mesh.skeleton.boneInverses[0].elements[12] += 1;
    if (defect === 'rigid') modules[0].scene.add(new Mesh(mesh.geometry, mesh.material));
    if (defect === 'material') (mesh.material as MeshStandardMaterial).name = 'Body';
    const disposals = [vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(mesh.skeleton, 'dispose'), vi.spyOn(mesh.material as MeshStandardMaterial, 'dispose'), vi.spyOn(meshes(base.scene)[0].geometry, 'dispose')];
    await expect(loadCustomizedAvatar({ ...configuration, body }, catalogue(), false)).rejects.toThrow();
    disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  });
  it('matches female uncustomized poses through Idle, Run and gestures using the original controller', async () => {
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(path => parse(String(path)));
    const baseline = await original.loadAvatar(false, 'models/avatars/female/body.glb');
    const avatar = await loadCustomizedAvatar({ ...configuration, body: 'female' }, catalogue(), false);
    expect(load).toHaveBeenCalledWith('/models/avatars/female/body.glb');
    const pose = (resource: original.AvatarResource) => {
      resource.scene.updateMatrixWorld(true);
      return meshes(resource.scene)[0].skeleton.bones.map(bone => bone.matrixWorld.elements.slice());
    };
    const step = () => { baseline.update(0.1); avatar.update(0.1); expect(pose(avatar)).toEqual(pose(baseline)); };
    step(); baseline.setMoving!(true); avatar.setMoving!(true); step(); step();
    baseline.setMoving!(false); avatar.setMoving!(false); step();
    const clip = 'Wave';
    const gltf = await parse('models/avatars/female/body.glb');
    expect(gltf.animations.some(animation => animation.name === clip)).toBe(true);
    const gestures = [baseline.playGesture!([{ clip, hold: 0.1 }]), avatar.playGesture!([{ clip, hold: 0.1 }])];
    step(); await Promise.all(gestures); step();
    baseline.dispose(); avatar.dispose();
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
  it.each(['male', 'female'] as const)('rejects the other body rig when loading %s', async body => {
    const { load } = await fixture(body);
    load.mockReset().mockResolvedValueOnce(await parse(body === 'male' ? 'models/avatars/female/body.glb' : 'models/character.glb'));
    await expect(loadCustomizedAvatar({ ...configuration, body }, catalogue(), false)).rejects.toThrow('Unsupported original rig');
  });
  it('rejects unsupported choices and colors before loading', async () => {
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync');
    for (const change of [{ body: 'unknown' }, { hairId: 'original' }, { accessoryId: 'earrings' }, { hairColor: 'red' }]) {
      await expect(loadCustomizedAvatar({ ...configuration, ...change } as typeof configuration, catalogue(), false)).rejects.toThrow();
    }
    expect(load).not.toHaveBeenCalled();
  });
  it.each(['male', 'female'] as const)('accepts all nine real %s modules with authored accessory colors and isolated tints', async id => {
    const body = catalogue().bodies.find(body => body.id === id)!;
    for (const asset of [...body.hair, ...body.tops, ...body.accessories]) {
      const base = await parse(id === 'male' ? 'models/character.glb' : 'models/avatars/female/body.glb'); const selected = await parse(asset.path);
      const canonical = new Set(meshes(base.scene).flatMap(mesh => mesh.skeleton.bones));
      const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValueOnce(base);
      const hair = asset.slot === 'hair' ? selected : await parse(body.hair[0].path);
      const top = asset.slot === 'top' ? selected : await parse(body.tops[0].path);
      load.mockResolvedValueOnce(hair).mockResolvedValueOnce(top);
      if (asset.slot === 'accessory') load.mockResolvedValueOnce(selected);
      const sources = meshes(selected.scene); const colors = sources.map(mesh => (mesh.material as MeshStandardMaterial).color.clone());
      const avatar = await loadCustomizedAvatar({ ...configuration, body: id, hairId: asset.slot === 'hair' ? asset.id : body.hair[0].id, topId: asset.slot === 'top' ? asset.id : body.tops[0].id, accessoryId: asset.slot === 'accessory' ? asset.id : null }, catalogue(), false);
      sources.forEach((mesh, i) => {
        expect((mesh.material as MeshStandardMaterial).color).toEqual(colors[i]);
        const target = meshes(avatar.scene).find(candidate => candidate.geometry === mesh.geometry)!;
        if (asset.slot === 'accessory') expect(target.material).toBe(mesh.material);
        else {
          expect(target.material).not.toBe(mesh.material);
          expect((target.material as MeshStandardMaterial).color.getHexString()).toBe(asset.slot === 'hair' ? '353849' : '75b7da');
        }
        expect(target.skeleton.bones.map(bone => bone.name)).toEqual(mesh.skeleton.bones.map(bone => bone.name));
        expect(target.skeleton.bones).toHaveLength(id === 'male' ? 34 : 41);
        expect(target.skeleton.bones.every(bone => canonical.has(bone))).toBe(true);
      });
      avatar.dispose(); load.mockRestore();
    }
  });
});
