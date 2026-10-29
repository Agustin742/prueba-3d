import { readFileSync } from 'node:fs';
import { AnimationClip, AnimationMixer, Group, Mesh, NumberKeyframeTrack, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAvatar } from './load-avatar';

afterEach(() => vi.restoreAllMocks());

async function originalAvatar() {
  const bytes = readFileSync('public/models/character.glb');
  // Use this DOM realm's buffer; Node Buffer's ArrayBuffer fails Three's instanceof check.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new GLTFLoader().parseAsync(buffer, '');
}

describe('original avatar loading contract', () => {
  it('loads the public GLB, preserves its rig/materials, plays Idle and releases owned resources', async () => {
    const gltf = await originalAvatar();
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
    const stop = vi.spyOn(AnimationMixer.prototype, 'stopAllAction');
    const mesh = gltf.scene.getObjectByProperty('isMesh', true) as Mesh;
    const material = mesh.material;
    const dispose = vi.spyOn(mesh.geometry, 'dispose');
    const avatar = await loadAvatar(false);
    expect(GLTFLoader.prototype.loadAsync).toHaveBeenCalledWith('/models/character.glb');
    expect(avatar.scene).toBe(gltf.scene);
    expect(mesh.material).toBe(material);
    const skinned: SkinnedMesh[] = [];
    avatar.scene.traverse(node => { if (node instanceof SkinnedMesh) skinned.push(node); });
    expect(skinned.length).toBeGreaterThan(0);
    expect(skinned[0].skeleton.bones.length).toBeGreaterThan(0);
    avatar.update(0.25);
    expect(avatar.mixer.existingAction(gltf.animations.find(clip => clip.name === 'Idle')!)?.isRunning()).toBe(true);
    avatar.dispose();
    avatar.dispose();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('loads a custom model path while keeping the default character model', async () => {
    const gltf = await originalAvatar();
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
    const npc = await loadAvatar(false, 'models/npc/monkey.glb');
    expect(load).toHaveBeenLastCalledWith('/models/npc/monkey.glb');
    npc.dispose();
    const avatar = await loadAvatar(false);
    expect(load).toHaveBeenLastCalledWith('/models/character.glb');
    avatar.dispose();
  });

  it('switches Idle/Run without replacing the mixer or stopping all actions during movement', async () => {
    const gltf = await originalAvatar();
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
    const stop = vi.spyOn(AnimationMixer.prototype, 'stopAllAction');
    const avatar = await loadAvatar(false);
    const idle = gltf.animations.find(clip => clip.name === 'Idle')!;
    const run = gltf.animations.find(clip => clip.name === 'Run')!;
    expect(avatar.setMoving).toBeTypeOf('function');
    avatar.setMoving!(true);
    avatar.update(0.1);
    expect(avatar.mixer.existingAction(run)?.isRunning()).toBe(true);
    avatar.setMoving!(true);
    avatar.setMoving!(false);
    avatar.update(0.1);
    avatar.update(0.1);
    avatar.update(0.1);
    expect(avatar.mixer.existingAction(idle)?.isRunning()).toBe(true);
    expect(avatar.mixer.existingAction(run)?.isRunning()).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    avatar.dispose();
    avatar.setMoving!(true);
    avatar.update(0.1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(avatar.mixer.existingAction(run)).toBeNull();
  });

  it('cross-fades Idle and Run instead of cutting between poses', async () => {
    const gltf = await originalAvatar();
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
    const avatar = await loadAvatar(false);
    const idle = avatar.mixer.existingAction(gltf.animations.find(clip => clip.name === 'Idle')!)!;
    const run = gltf.animations.find(clip => clip.name === 'Run')!;
    avatar.update(0.1);
    avatar.setMoving!(true);
    avatar.update(0.05);
    const running = avatar.mixer.existingAction(run)!;
    // Mid-fade both clips contribute, so the pose blends instead of popping.
    expect(idle.isRunning()).toBe(true);
    expect(running.isRunning()).toBe(true);
    expect(idle.getEffectiveWeight()).toBeGreaterThan(0);
    expect(idle.getEffectiveWeight()).toBeLessThan(1);
    expect(running.getEffectiveWeight()).toBeGreaterThan(0);
    expect(running.getEffectiveWeight()).toBeLessThan(1);
    // update() caps each delta at 0.1s, so finish the 0.2s fade in capped steps.
    avatar.update(0.1);
    avatar.update(0.1);
    expect(idle.isRunning()).toBe(false);
    expect(running.getEffectiveWeight()).toBeCloseTo(1);
    avatar.dispose();
  });

  it('suppresses both movement clips for reduced motion and caps animation delta', async () => {
    const gltf = await originalAvatar();
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
    const avatar = await loadAvatar(true);
    expect(avatar.setMoving).toBeTypeOf('function');
    avatar.setMoving!(true);
    avatar.update(5);
    expect(avatar.mixer.time).toBeCloseTo(0.1);
    expect(avatar.mixer.existingAction(gltf.animations.find(clip => clip.name === 'Run')!)).toBeNull();
    avatar.setMoving!(false);
    expect(avatar.mixer.existingAction(gltf.animations.find(clip => clip.name === 'Idle')!)).toBeNull();
    avatar.dispose();
  });

  it('rejects a failed download rather than returning a replacement avatar', async () => {
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockRejectedValue(new Error('unavailable'));
    await expect(loadAvatar(false)).rejects.toThrow('unavailable');
  });

  it('keeps the original model still when reduced motion is requested', async () => {
    const gltf = await originalAvatar();
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
    const avatar = await loadAvatar(true);
    expect(avatar.mixer.existingAction(gltf.animations.find(clip => clip.name === 'Idle')!)).toBeNull();
    avatar.dispose();
  });

  describe('playGesture', () => {
    const clip = (name: string, duration: number) => new AnimationClip(name, duration, [
      new NumberKeyframeTrack('.position[x]', [0, duration], [0, 1]),
    ]);
    async function npcWith(names: Record<string, number>, reducedMotion = false) {
      const animations = Object.entries(names).map(([name, duration]) => clip(name, duration));
      vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue({ scene: new Group(), animations } as never);
      const avatar = await loadAvatar(reducedMotion, 'models/npc/monkey.glb');
      return { avatar, action: (name: string) => avatar.mixer.existingAction(animations.find(c => c.name === name)!) };
    }
    const run = (avatar: { update(delta: number): void }, seconds: number) => {
      for (let t = 0; t < seconds; t += 0.05) avatar.update(0.05);
    };

    it('cross-fades Idle out, plays the clip once and fades back to Idle', async () => {
      const { avatar, action } = await npcWith({ Idle: 2, Yes: 1.5 });
      avatar.update(0.1);
      let done = false;
      const finished = avatar.playGesture!([{ clip: 'Yes' }]).then(() => { done = true; });
      avatar.update(0.05);
      expect(action('Yes')!.isRunning()).toBe(true);
      expect(action('Yes')!.loop).toBe(2200); // LoopOnce
      expect(action('Idle')!.getEffectiveWeight()).toBeLessThan(1);
      run(avatar, 1.4);
      await Promise.resolve();
      expect(done).toBe(false);
      run(avatar, 0.3);
      await finished;
      run(avatar, 0.5);
      expect(done).toBe(true);
      expect(action('Idle')!.isRunning()).toBe(true);
      expect(action('Idle')!.getEffectiveWeight()).toBeCloseTo(1);
      expect(action('Yes')!.isRunning()).toBe(false);
      avatar.dispose();
    });

    it('holds a looping clip for the requested seconds between its start and end clips', async () => {
      const { avatar, action } = await npcWith({ Idle: 2, ThinkStart: 0.8, Think: 4, ThinkEnd: 0.75 });
      const order: string[] = [];
      const finished = avatar.playGesture!([
        { clip: 'ThinkStart' }, { clip: 'Think', hold: 2.5 }, { clip: 'ThinkEnd' },
      ]);
      const watch = () => {
        for (const name of ['ThinkStart', 'Think', 'ThinkEnd']) {
          if (action(name)?.isRunning() && action(name)!.getEffectiveWeight() > 0.5 && !order.includes(name)) order.push(name);
        }
      };
      for (let t = 0; t < 5; t += 0.05) {
        avatar.update(0.05); watch();
        await Promise.resolve(); await Promise.resolve(); // let the sequence reach its next step
      }
      await finished;
      expect(order).toEqual(['ThinkStart', 'Think', 'ThinkEnd']);
      expect(action('Think')!.loop).toBe(2201); // LoopRepeat
      expect(action('Think')!.isRunning()).toBe(false);
      expect(action('Idle')!.isRunning()).toBe(true);
      avatar.dispose();
    });

    it('skips missing clips and resolves without touching Idle when none exist', async () => {
      const { avatar, action } = await npcWith({ Idle: 2 });
      await avatar.playGesture!([{ clip: 'Yes' }, { clip: 'Think', hold: 2 }]);
      expect(action('Idle')!.getEffectiveWeight()).toBe(1);
      avatar.dispose();
    });

    it('does nothing for reduced motion', async () => {
      const { avatar, action } = await npcWith({ Idle: 2, Yes: 1 }, true);
      await avatar.playGesture!([{ clip: 'Yes' }]);
      expect(action('Yes')).toBeNull();
      avatar.dispose();
    });

    it('ignores a second gesture while one is playing and resolves pending ones on dispose', async () => {
      const { avatar, action } = await npcWith({ Idle: 2, Yes: 1.5, No: 1.5 });
      const first = avatar.playGesture!([{ clip: 'Yes' }]);
      await avatar.playGesture!([{ clip: 'No' }]);
      expect(action('No')).toBeNull();
      avatar.dispose();
      await first;
    });
  });
});
