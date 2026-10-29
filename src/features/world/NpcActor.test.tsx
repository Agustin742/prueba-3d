import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { Sprite } from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AvatarResource } from '../avatar/load-avatar';
import { chatterBubbleMs, chatterMinDelayMs } from './npc-chatter';
import { NpcActor } from './NpcActor';

const renderer = vi.hoisted(() => ({ frames: [] as ((state: unknown, dt: number) => void)[] }));
vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, dt: number) => void) => renderer.frames.push(callback),
}));
beforeEach(() => {
  renderer.frames = [];
  // jsdom has no 2D canvas; the billboard draws nothing and keeps its sprite.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function npcResource() {
  const scene = new Group();
  const mesh = new Mesh(new BoxGeometry(2, 4, 1), new MeshBasicMaterial()); mesh.position.set(3, 4, -2); scene.add(mesh);
  return { scene, update: vi.fn(), dispose: vi.fn() } as unknown as AvatarResource;
}

it('anchors feet at Y0 with height 2 at the given XZ position and yaw', () => {
  const npc = npcResource();
  render(<NpcActor npc={npc} position={[-2.6, -3.2]} yaw={0.5} />);
  const root = npc.scene.parent!.parent!;
  expect(root.position.toArray()).toEqual([-2.6, 0, -3.2]);
  expect(root.rotation.y).toBe(0.5);
  root.updateMatrixWorld(true);
  // Measure the framed model only; the billboard sprite is not part of the body.
  const bounds = new Box3().setFromObject(npc.scene.parent!, true);
  expect(bounds.min.y).toBeCloseTo(0); expect(bounds.max.y).toBeCloseTo(2);
  expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(-2.6);
  expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(-3.2);
});

it('advances the animation mixer every frame', () => {
  const npc = npcResource();
  render(<NpcActor npc={npc} position={[0, 0]} yaw={0} />);
  (npc.update as ReturnType<typeof vi.fn>).mockClear();
  act(() => { for (const frame of renderer.frames) frame({}, 0.05); });
  expect(npc.update).toHaveBeenCalledWith(0.05);
});

it('detaches on unmount, restores the scene position and never disposes the resource', () => {
  const npc = npcResource();
  const { unmount } = render(<StrictMode><NpcActor npc={npc} position={[1, 1]} yaw={0} /></StrictMode>);
  const bounds = new Box3().setFromObject(npc.scene.parent!, true);
  expect(bounds.min.y).toBeCloseTo(0); expect(bounds.max.y).toBeCloseTo(2);
  unmount();
  expect(npc.scene.parent).toBeNull();
  expect(npc.scene.position.toArray()).toEqual([0, 0, 0]);
  expect(npc.dispose).not.toHaveBeenCalled();
});

function sprites(npc: AvatarResource) {
  return npc.scene.parent!.parent!.children.filter((node): node is Sprite => node instanceof Sprite);
}

it('shows the Mono name label, adds a bubble for a random line and plays a gesture', () => {
  vi.useFakeTimers();
  const npc = npcResource();
  const playGesture = vi.fn(() => Promise.resolve());
  npc.playGesture = playGesture;
  render(<NpcActor npc={npc} position={[0, 0]} yaw={0} random={() => 0} />);
  expect(sprites(npc)).toHaveLength(1);
  const nameOnly = sprites(npc)[0];
  act(() => { vi.advanceTimersByTime(chatterMinDelayMs); });
  expect(sprites(npc)).toHaveLength(1);
  expect(sprites(npc)[0]).not.toBe(nameOnly); // redrawn with the bubble
  expect(playGesture).toHaveBeenCalledTimes(1);
  act(() => { vi.advanceTimersByTime(chatterBubbleMs); });
  expect(sprites(npc)[0]).not.toBe(nameOnly); // redrawn again without the bubble
});

it('cancels pending chatter and removes the label on unmount, also under StrictMode', () => {
  vi.useFakeTimers();
  const npc = npcResource();
  const playGesture = vi.fn(() => Promise.resolve());
  npc.playGesture = playGesture;
  const { unmount } = render(<StrictMode><NpcActor npc={npc} position={[0, 0]} yaw={0} random={() => 0} /></StrictMode>);
  const root = npc.scene.parent!.parent!;
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(100_000);
  expect(playGesture).not.toHaveBeenCalled();
  expect(root.children.some(node => node instanceof Sprite)).toBe(false);
});

it('shows only the bubble when the NPC cannot play gestures', () => {
  vi.useFakeTimers();
  const npc = npcResource();
  render(<NpcActor npc={npc} position={[0, 0]} yaw={0} random={() => 0} />);
  expect(() => act(() => { vi.advanceTimersByTime(chatterMinDelayMs); })).not.toThrow();
  expect(sprites(npc)).toHaveLength(1);
});
