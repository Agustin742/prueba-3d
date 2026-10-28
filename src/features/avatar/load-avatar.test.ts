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

  it('switches Idle/Walk without replacing the mixer or stopping all actions during movement', async () => {
    const gltf = await originalAvatar();
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
    const stop = vi.spyOn(AnimationMixer.prototype, 'stopAllAction');
    const avatar = await loadAvatar(false);
    const idle = gltf.animations.find(clip => clip.name === 'Idle')!;
    const walk = gltf.animations.find(clip => clip.name === 'Walk')!;
    expect(avatar.setMoving).toBeTypeOf('function');
    avatar.setMoving!(true);
    avatar.update(0.1);
    expect(avatar.mixer.existingAction(walk)?.isRunning()).toBe(true);
    avatar.setMoving!(true);
    avatar.setMoving!(false);
    avatar.update(0.1);
    expect(avatar.mixer.existingAction(idle)?.isRunning()).toBe(true);
    expect(avatar.mixer.existingAction(walk)?.isRunning()).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    avatar.dispose();
    avatar.setMoving!(true);
    avatar.update(0.1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(avatar.mixer.existingAction(walk)).toBeNull();
  });

  it('suppresses both movement clips for reduced motion and caps animation delta', async () => {
    const gltf = await originalAvatar();
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
    const avatar = await loadAvatar(true);
    expect(avatar.setMoving).toBeTypeOf('function');
    avatar.setMoving!(true);
    avatar.update(5);
    expect(avatar.mixer.time).toBeCloseTo(0.1);
    expect(avatar.mixer.existingAction(gltf.animations.find(clip => clip.name === 'Walk')!)).toBeNull();
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
