import {
  AnimationMixer, Bone, Color, Matrix4, Mesh, Skeleton, SkinnedMesh, Texture,
  type BufferGeometry, type Group, type Material,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AppearanceAsset, AppearanceCatalogue } from './avatar-appearance';
import type { AvatarConfiguration } from './AvatarCustomizer';
import type { AvatarResource } from './load-avatar';

const tolerance = 1e-5;
function assertMatrix(actual: Matrix4, expected: Matrix4, label: string) {
  if (actual.elements.some((value, i) => !Number.isFinite(value) || Math.abs(value - expected.elements[i]) > tolerance)) {
    throw new Error(`Incompatible ${label}`);
  }
}

/** An uncached load transfers ownership of all parsed GPU resources to this ledger,
 * including replaced materials and discarded module skeletons. No scene-only cleanup. */
function ownedResources() {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const skeletons = new Set<Skeleton>();
  function material(value: Material) {
    materials.add(value);
    for (const property of Object.values(value)) if (property instanceof Texture) textures.add(property);
  }
  return {
    material,
    skeleton: (value: Skeleton) => skeletons.add(value),
    collect(scene: Group) {
      scene.traverse(node => {
        if (node instanceof Mesh) {
          geometries.add(node.geometry);
          (Array.isArray(node.material) ? node.material : [node.material]).forEach(material);
        }
        if (node instanceof SkinnedMesh) skeletons.add(node.skeleton);
      });
    },
    dispose() {
      skeletons.forEach(value => value.dispose());
      geometries.forEach(value => value.dispose());
      materials.forEach(value => value.dispose());
      textures.forEach(value => value.dispose());
      skeletons.clear(); geometries.clear(); materials.clear(); textures.clear();
    },
  };
}

type CanonicalJoint = { bone: Bone; inverse: Matrix4 };
function canonicalJoints(scene: Group) {
  const joints = new Map<string, CanonicalJoint>();
  scene.traverse(node => {
    if (node instanceof Bone) {
      if (joints.has(node.name)) throw new Error(`Duplicate body bone: ${node.name}`);
      joints.set(node.name, { bone: node, inverse: new Matrix4().copy(node.matrixWorld).invert() });
    }
  });
  scene.traverse(node => {
    if (!(node instanceof SkinnedMesh)) return;
    node.skeleton.bones.forEach((bone, index) => {
      const joint = joints.get(bone.name);
      if (!joint || joint.bone !== bone) throw new Error(`Missing body bone: ${bone.name}`);
      assertMatrix(node.skeleton.boneInverses[index], joint.inverse, `body inverse bind: ${bone.name}`);
    });
  });
  if (joints.size === 0) throw new Error('Missing body bones');
  return joints;
}

function remapSkin(source: SkinnedMesh, joints: Map<string, CanonicalJoint>) {
  const seen = new Set<string>();
  const bones = source.skeleton.bones.map((bone, index) => {
    const joint = joints.get(bone.name);
    if (!joint || seen.has(bone.name)) throw new Error(`Missing or duplicate module bone: ${bone.name}`);
    seen.add(bone.name);
    if (bone.parent?.name !== joint.bone.parent?.name) throw new Error(`Incompatible bone parent: ${bone.name}`);
    assertMatrix(bone.matrix, joint.bone.matrix, `bone local rest: ${bone.name}`);
    assertMatrix(bone.matrixWorld, joint.bone.matrixWorld, `bone world rest: ${bone.name}`);
    assertMatrix(source.skeleton.boneInverses[index], joint.inverse, `inverse bind: ${bone.name}`);
    return joint.bone;
  });
  // Validate that the authored mesh bind is in the same coordinate space as its rest placement.
  assertMatrix(source.bindMatrix, source.matrixWorld, 'mesh bind transform');
  return new Skeleton(bones, source.skeleton.boneInverses.map(inverse => inverse.clone()));
}

function selectedAsset(assets: readonly AppearanceAsset[], id: string, slot: AppearanceAsset['slot']) {
  const matches = assets.filter(asset => asset.id === id && asset.slot === slot);
  if (matches.length !== 1) throw new Error(`Invalid avatar ${slot} choice`);
  return matches[0];
}

/** Compose an owned body rig and selected meshes in authored units. Apply gameplay
 * placement/scale once outside this scene. Catalogue is already parsed by the caller.
 * Accessories retain authored color; hair/top use only their declared tint slots. */
export async function loadCustomizedAvatar(
  configuration: AvatarConfiguration,
  catalogue: AppearanceCatalogue,
  reducedMotion: boolean,
): Promise<AvatarResource> {
  const bodies = catalogue.bodies.filter(body => body.id === configuration.body);
  if (bodies.length !== 1) throw new Error('Invalid avatar body choice');
  if (![configuration.hairColor, configuration.clothingColor].every(color => /^#[\da-f]{6}$/i.test(color))) {
    throw new Error('Invalid avatar tint color');
  }
  const body = bodies[0];
  const selected = [selectedAsset(body.hair, configuration.hairId, 'hair'), selectedAsset(body.tops, configuration.topId, 'top')];
  if (configuration.accessoryId !== null) selected.push(selectedAsset(body.accessories, configuration.accessoryId, 'accessory'));
  const url = (path: string) => `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${path.replace(/^\//, '')}`;
  const resources = ownedResources();
  const loader = new GLTFLoader();
  let mixer: AnimationMixer | undefined;
  let scene: Group | undefined;
  try {
    // Sequential loads deliberately leave no in-flight promises to leak after rejection.
    const bodyGltf = await loader.loadAsync(url(body.path));
    scene = bodyGltf.scene;
    resources.collect(scene);
    scene.updateMatrixWorld(true);
    const joints = canonicalJoints(scene);
    for (const asset of selected) {
      const module = await loader.loadAsync(url(asset.path));
      resources.collect(module.scene);
      module.scene.updateMatrixWorld(true);
      const sources: Mesh[] = [];
      module.scene.traverse(node => { if (node instanceof Mesh) sources.push(node); });
      if (!sources.length) throw new Error('Empty avatar module');
      for (const source of sources) {
        const target = source.clone(false);
        if (source instanceof SkinnedMesh && target instanceof SkinnedMesh) {
          const skeleton = remapSkin(source, joints);
          resources.skeleton(skeleton);
          target.bind(skeleton, source.bindMatrix.clone());
        }
        // Flatten non-bone containers, not their transform. Rigid bone attachments
        // follow the canonical parent; no module bones, cameras or lights enter the scene.
        const parent = source.parent instanceof Bone ? joints.get(source.parent.name)?.bone : scene;
        if (!parent) throw new Error('Missing rigid module parent bone');
        target.matrix.copy(new Matrix4().copy(parent.matrixWorld).invert().multiply(source.matrixWorld));
        target.matrix.decompose(target.position, target.quaternion, target.scale);
        target.matrixAutoUpdate = false;
        const tint = asset.slot === 'hair' ? configuration.hairColor : asset.slot === 'top' ? configuration.clothingColor : null;
        const cloneMaterial = (material: Material) => {
          const clone = material.clone();
          resources.material(clone);
          if (tint && asset.tintMaterials.includes(material.name) && 'color' in clone && clone.color instanceof Color) clone.color.set(tint);
          return clone;
        };
        target.material = Array.isArray(source.material) ? source.material.map(cloneMaterial) : cloneMaterial(source.material);
        parent.add(target);
      }
    }
    scene.updateMatrixWorld(true);
    mixer = new AnimationMixer(scene);
    const idle = bodyGltf.animations.find(clip => clip.name === 'Idle');
    const walk = bodyGltf.animations.find(clip => clip.name === 'Walk');
    const ownedMixer = mixer;
    const ownedScene = scene;
    if (idle && !reducedMotion) ownedMixer.clipAction(idle).play();
    let moving = false;
    let disposed = false;
    return {
      scene: ownedScene,
      mixer: ownedMixer,
      setMoving(next) {
        if (disposed || reducedMotion || next === moving) return;
        moving = next;
        const previous = next ? idle : walk;
        const selectedClip = next ? walk : idle;
        if (previous) ownedMixer.existingAction(previous)?.stop();
        if (selectedClip) ownedMixer.clipAction(selectedClip).reset().play();
      },
      update(delta) { if (!disposed) ownedMixer.update(Math.min(delta, 0.1)); },
      dispose() {
        if (disposed) return;
        disposed = true;
        ownedMixer.stopAllAction();
        ownedMixer.uncacheRoot(ownedScene);
        resources.dispose();
      },
    };
  } catch (error) {
    if (mixer && scene) { mixer.stopAllAction(); mixer.uncacheRoot(scene); }
    resources.dispose();
    throw error;
  }
}
