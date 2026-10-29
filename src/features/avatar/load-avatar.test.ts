import { readFileSync } from 'node:fs';
import { AnimationMixer, Mesh, SkinnedMesh } from 'three';
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
});
