import { AnimationMixer, LoopOnce, LoopRepeat, Mesh, SkinnedMesh, Texture, type Group, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface AvatarResource {
  scene: Group;
  mixer: AnimationMixer;
  update(delta: number): void;
  setMoving?(moving: boolean): void;
  /**
   * Plays clips in order on top of Idle, then cross-fades back to Idle. A step plays once, or loops
   * for `hold` seconds. Missing clips are skipped; resolves early on dispose or reduced motion.
   */
  playGesture?(steps: readonly { clip: string; hold?: number }[]): Promise<void>;
  dispose(): void;
}

// One uncached load owns one scene, rig and its GPU resources. Do not share between avatars.
export async function loadAvatar(reducedMotion: boolean, modelPath = 'models/character.glb'): Promise<AvatarResource> {
  const { scene, animations } = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${modelPath}`);
  const mixer = new AnimationMixer(scene);
  const idle = animations.find(clip => clip.name === 'Idle');
  if (idle && !reducedMotion) mixer.clipAction(idle).play();
  const run = animations.find(clip => clip.name === 'Run');
  let moving = false;
  let disposed = false;
  let gesturing = false;
  // Gesture steps wait on mixer time (not wall clock), so they pause with the frame loop.
  let waiting: { remaining: number; resolve(): void } | null = null;
  const wait = (seconds: number) => new Promise<void>(resolve => { waiting = { remaining: seconds, resolve }; });

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
    async playGesture(steps) {
      if (disposed || reducedMotion || gesturing) return;
      gesturing = true;
      const idleAction = idle && mixer.clipAction(idle);
      let previous = idleAction;
      let played = false;
      try {
        for (const step of steps) {
          const clip = animations.find(candidate => candidate.name === step.clip);
          if (!clip) continue;
          const action = mixer.clipAction(clip).reset();
          if (step.hold === undefined) { action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; }
          else action.setLoop(LoopRepeat, Infinity);
          previous?.fadeOut(0.2);
          action.fadeIn(0.2).play();
          previous = action;
          played = true;
          await wait(step.hold ?? clip.duration);
          if (disposed) return;
        }
        if (!played) return;
        previous?.fadeOut(0.2);
        idleAction?.reset().fadeIn(0.2).play();
      } finally {
        gesturing = false;
      }
    },
    update(delta) {
      if (disposed) return;
      const step = Math.min(delta, 0.1);
      mixer.update(step);
      if (waiting && (waiting.remaining -= step) <= 0) { const { resolve } = waiting; waiting = null; resolve(); }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      waiting?.resolve(); waiting = null;
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
