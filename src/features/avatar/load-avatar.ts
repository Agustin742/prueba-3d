import { AnimationMixer, Mesh, SkinnedMesh, Texture, type Group, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface AvatarResource {
  scene: Group;
  mixer: AnimationMixer;
  update(delta: number): void;
  setMoving?(moving: boolean): void;
  dispose(): void;
}

// One uncached load owns one scene, rig and its GPU resources. Do not share between avatars.
export async function loadAvatar(reducedMotion: boolean): Promise<AvatarResource> {
  const { scene, animations } = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/character.glb`);
  const mixer = new AnimationMixer(scene);
  const idle = animations.find(clip => clip.name === 'Idle');
  if (idle && !reducedMotion) mixer.clipAction(idle).play();
  const run = animations.find(clip => clip.name === 'Run');
  let moving = false;
  let disposed = false;

  return {
    scene,
    mixer,
    setMoving(next) {
      if (disposed || reducedMotion || moving === next) return;
      moving = next;
      const previous = next ? idle : run;
      const selected = next ? run : idle;
      // Cross-fade so the pose blends between clips instead of cutting in one frame.
      if (previous) mixer.existingAction(previous)?.fadeOut(0.2);
      if (selected) mixer.clipAction(selected).reset().fadeIn(0.2).play();
    },
    update: delta => { if (!disposed) mixer.update(Math.min(delta, 0.1)); },
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
      const geometries = new Set<Mesh['geometry']>();
      const materials = new Set<Material>();
      const textures = new Set<Texture>();
      const skeletons = new Set<SkinnedMesh['skeleton']>();
      scene.traverse(node => {
        if (node instanceof Mesh) {
          geometries.add(node.geometry);
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            materials.add(material);
            for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
          }
        }
        if (node instanceof SkinnedMesh) skeletons.add(node.skeleton);
      });
      geometries.forEach(resource => resource.dispose());
      materials.forEach(resource => resource.dispose());
      textures.forEach(resource => resource.dispose());
      skeletons.forEach(resource => resource.dispose());
    },
  };
}
