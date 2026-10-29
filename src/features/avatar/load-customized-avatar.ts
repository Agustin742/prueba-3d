import { Bone, Color, Matrix4, Mesh, Skeleton, SkinnedMesh, Texture, type Group, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AppearanceAsset, AppearanceCatalogue, AvatarConfiguration } from './avatar-appearance';
import { parseAppearanceCatalogue } from './avatar-catalogue';
import { loadAvatar, type AvatarResource } from './load-avatar';

function assertMatrix(actual: Matrix4, expected: Matrix4) {
  if (actual.elements.some((value, i) => !Number.isFinite(value) || Math.abs(value - expected.elements[i]) > 1e-5)) throw Error('Incompatible avatar transform');
}
/** Discarded source resources exclude everything transferred to the original owner. */
function resources(scene: Group) {
  const result = new Set<{ dispose(): void }>();
  scene.traverse(node => {
    if (node instanceof Mesh) {
      result.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        result.add(material);
        for (const value of Object.values(material)) if (value instanceof Texture) result.add(value);
      }
    }
    if (node instanceof SkinnedMesh) result.add(node.skeleton);
  });
  return result;
}
function canonicalJoints(scene: Group, body: AvatarConfiguration['body']) {
  const joints = new Map<string, { bone: Bone; inverse: Matrix4 }>();
  scene.traverse(node => {
    if (!(node instanceof Bone)) return;
    if (joints.has(node.name)) throw Error('Duplicate original bone');
    joints.set(node.name, { bone: node, inverse: node.matrixWorld.clone().invert() });
  });
  if (joints.size !== (body === 'male' ? 34 : 41)) throw Error('Unsupported original rig');
  scene.traverse(node => {
    if (node instanceof SkinnedMesh) node.skeleton.bones.forEach((bone, i) => {
      const joint = joints.get(bone.name);
      if (!joint || joint.bone !== bone) throw Error('Invalid original skin');
      assertMatrix(node.skeleton.boneInverses[i], joint.inverse);
    });
  });
  return joints;
}
function remap(source: SkinnedMesh, joints: ReturnType<typeof canonicalJoints>) {
  if (source.skeleton.bones.length !== joints.size) throw Error('Unsupported module topology');
  const seen = new Set<string>();
  const bones = source.skeleton.bones.map((bone, i) => {
    const joint = joints.get(bone.name);
    if (!joint || seen.has(bone.name) || bone.parent?.name !== joint.bone.parent?.name) throw Error('Incompatible module joint');
    seen.add(bone.name);
    assertMatrix(bone.matrix, joint.bone.matrix); assertMatrix(bone.matrixWorld, joint.bone.matrixWorld);
    assertMatrix(source.skeleton.boneInverses[i], joint.inverse);
    return joint.bone;
  });
  assertMatrix(source.bindMatrix, source.matrixWorld);
  return bones;
}
/** Attach in rest pose, before the caller's first update. The public loader alone owns animation. */
export async function loadCustomizedAvatar(configuration: AvatarConfiguration, input: AppearanceCatalogue, reducedMotion: boolean): Promise<AvatarResource> {
  const body = parseAppearanceCatalogue(input).bodies.find(body => body.id === configuration.body);
  if (!body || ![configuration.hairColor, configuration.clothingColor].every(color => /^#[\da-f]{6}$/i.test(color))) throw Error('Invalid avatar configuration');
  const select = (items: readonly AppearanceAsset[], id: string) => {
    const asset = items.find(item => item.id === id); if (!asset) throw Error('Unsupported avatar choice'); return asset;
  };
  const selected = [select(body.hair, configuration.hairId), select(body.tops, configuration.topId)];
  if (configuration.accessoryId !== null) selected.push(select(body.accessories, configuration.accessoryId));
  const avatar = body.id === 'female'
    ? await loadAvatar(reducedMotion, 'models/avatars/female/body.glb') : await loadAvatar(reducedMotion);
  try {
    avatar.scene.updateMatrixWorld(true);
    const joints = canonicalJoints(avatar.scene, body.id);
    // Sequential loads mean a failed module leaves no outstanding downloads to collect.
    for (const asset of selected) {
      const module = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${asset.path.slice(1)}`);
      const discarded = resources(module.scene);
      try {
        module.scene.updateMatrixWorld(true);
        const sources: SkinnedMesh[] = [];
        const moduleBones = new Set<string>();
        module.scene.traverse(node => {
          if (node instanceof Bone) {
            if (!joints.has(node.name) || moduleBones.has(node.name)) throw Error('Unsupported module rig');
            moduleBones.add(node.name);
          }
          if (node instanceof Mesh) {
            if (!(node instanceof SkinnedMesh)) throw Error('Unsupported rigid module');
            sources.push(node);
          }
        });
        if (!sources.length || moduleBones.size !== joints.size) throw Error('Empty or incomplete avatar module');
        for (const source of sources) {
          const bones = remap(source, joints);
          const originals = Array.isArray(source.material) ? source.material : [source.material];
          const names = [...asset.tintMaterials, ...asset.detailMaterials, ...(asset.slot === 'accessory' ? ['AvatarAccessoryTint'] : [])];
          if (originals.some(material => !names.includes(material.name)) || !asset.tintMaterials.every(name => originals.some(material => material.name === name && 'color' in material && material.color instanceof Color))) throw Error('Incompatible module materials');
          const target = source.clone(false);
          // Transfer geometry and authored materials first, so failure cleanup always has an owner.
          avatar.scene.add(target);
          target.bind(new Skeleton(bones, source.skeleton.boneInverses.map(inverse => inverse.clone())), source.bindMatrix.clone());
          target.matrix.copy(avatar.scene.matrixWorld.clone().invert().multiply(source.matrixWorld));
          target.matrix.decompose(target.position, target.quaternion, target.scale); target.matrixAutoUpdate = false;
          const tint = asset.slot === 'hair' ? configuration.hairColor : configuration.clothingColor;
          const clone = (material: Material) => {
            if (!asset.tintMaterials.includes(material.name)) return material;
            const copy = material.clone();
            if ('color' in copy && copy.color instanceof Color) copy.color.set(tint);
            return copy;
          };
          target.material = Array.isArray(source.material) ? originals.map(clone) : clone(source.material);
        }
      } finally {
        const retained = resources(avatar.scene);
        discarded.forEach(resource => { if (!retained.has(resource)) resource.dispose(); });
      }
    }
    avatar.scene.updateMatrixWorld(true);
    return avatar;
  } catch (error) { avatar.dispose(); throw error; }
}
