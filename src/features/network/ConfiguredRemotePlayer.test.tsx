import { act, render } from '@testing-library/react';
import { AnimationClip, Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial, Vector3 } from 'three';
import { beforeEach, expect, it, vi } from 'vitest';
import { RemotePlayer } from './RemotePlayer';
import { loadCustomizedAvatar } from '../avatar/load-customized-avatar';
import type { AvatarResource } from '../avatar/load-avatar';
import type { AvatarConfiguration } from '../avatar/AvatarCustomizer';

const renderer = vi.hoisted(() => ({ frame: (_: unknown, _dt: number) => {}, legacyLoad: vi.fn(), billboard: vi.fn() }));
vi.mock('@react-three/fiber', () => ({
  useFrame: (frame: typeof renderer.frame) => { renderer.frame = frame; },
  useLoader: (...args: unknown[]) => renderer.legacyLoad(...args),
}));
vi.mock('../avatar/load-customized-avatar', () => ({ loadCustomizedAvatar: vi.fn() }));
vi.mock('./AvatarBillboard', () => ({ createAvatarBillboard: (...args: unknown[]) => {
  renderer.billboard(...args); return new Sprite(new SpriteMaterial());
} }));
const appearance: AvatarConfiguration = { body: 'female', hairId: 'bun', topId: 'hoodie', accessoryId: 'earrings', hairColor: '#c77daa', clothingColor: '#7eba8b', nickname: 'Draft' };
const props = { nickname: 'Canonical', position: [4, 0, 3] as [number, number, number], rotation: 1, animation: 'run', bubbleText: 'Hi' };
function resource(): AvatarResource {
  const scene = new Group(); scene.add(new Mesh(new BoxGeometry(2, 4, 1), new MeshBasicMaterial()));
  return { scene, update: vi.fn(), setMoving: vi.fn(), dispose: vi.fn() } as unknown as AvatarResource;
}
let resolve: (value: AvatarResource) => void;
let reject: (reason: Error) => void;
beforeEach(() => {
  vi.mocked(loadCustomizedAvatar).mockReset(); renderer.legacyLoad.mockReset(); renderer.billboard.mockClear();
  vi.mocked(loadCustomizedAvatar).mockImplementation(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
  renderer.legacyLoad.mockReturnValue({ scene: resource().scene, animations: [new AnimationClip('Idle', 1, []), new AnimationClip('Walk', 1, [])] });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});

it('preserves the legacy GLB path and billboard without appearance', () => {
  const { unmount } = render(<RemotePlayer {...props} />);
  expect(renderer.legacyLoad).toHaveBeenCalled(); expect(loadCustomizedAvatar).not.toHaveBeenCalled();
  expect(renderer.billboard).toHaveBeenCalledWith('Canonical', 'Hi', false);
  unmount();
});

it('loads selected body/pieces/tints with reduced motion, canonical billboard and stable movement updates', async () => {
  const avatar = resource();
  const { rerender, unmount } = render(<RemotePlayer {...props} appearance={appearance} />);
  expect(loadCustomizedAvatar).toHaveBeenCalledWith(appearance, expect.objectContaining({ version: 1 }), true);
  expect(renderer.legacyLoad).not.toHaveBeenCalled();
  await act(async () => resolve(avatar));
  const root = avatar.scene.parent!.parent!;
  expect(root.position.toArray()).toEqual([4, 0, 3]); expect(root.rotation.y).toBe(1);
  const bounds = new Box3().setFromObject(avatar.scene.parent!, true);
  expect(bounds.min.y).toBeCloseTo(0); expect(bounds.getSize(new Vector3()).y).toBeCloseTo(2);
  expect(renderer.billboard).toHaveBeenCalledWith('Canonical', 'Hi', false);
  act(() => renderer.frame({}, 0.2));
  expect(avatar.setMoving).toHaveBeenLastCalledWith(true); expect(avatar.update).toHaveBeenLastCalledWith(0.1);
  rerender(<RemotePlayer {...props} position={[8, 0, 5]} animation="idle" appearance={{ ...appearance }} />);
  expect(loadCustomizedAvatar).toHaveBeenCalledTimes(1);
  act(() => renderer.frame({}, 0.02));
  expect(root.position.x).toBe(5); expect(avatar.setMoving).toHaveBeenLastCalledWith(false);
  unmount(); expect(avatar.dispose).toHaveBeenCalledOnce(); expect(avatar.scene.parent).toBeNull();
});

it('disposes late obsolete results and independently owns resources for each remote', async () => {
  const first = resource(); const second = resource(); const third = resource();
  const view = render(<RemotePlayer {...props} appearance={appearance} />); const oldResolve = resolve;
  view.rerender(<RemotePlayer {...props} appearance={{ ...appearance, body: 'male', hairId: 'fade', topId: 'shirt', accessoryId: null }} />);
  await act(async () => oldResolve(first)); expect(first.dispose).toHaveBeenCalledOnce(); expect(first.scene.parent).toBeNull();
  await act(async () => resolve(second));
  const peer = render(<RemotePlayer {...props} appearance={appearance} />);
  await act(async () => resolve(third));
  expect(second.scene.parent).not.toBe(third.scene.parent);
  view.unmount(); expect(second.dispose).toHaveBeenCalledOnce(); expect(third.dispose).not.toHaveBeenCalled();
  peer.unmount(); expect(third.dispose).toHaveBeenCalledOnce();
  const late = render(<RemotePlayer {...props} appearance={appearance} />); const lastResolve = resolve;
  late.unmount(); const last = resource(); await act(async () => lastResolve(last));
  expect(last.dispose).toHaveBeenCalledOnce();
});

it('replaces a loaded selection, detaches its rig, and accepts walk as moving', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  const old = resource(); const next = resource();
  const view = render(<RemotePlayer {...props} appearance={appearance} />);
  await act(async () => resolve(old));
  const root = old.scene.parent!.parent!;
  view.rerender(<RemotePlayer {...props} animation="walk" appearance={{ ...appearance, accessoryId: null, hairColor: '#e5ad58' }} />);
  expect(old.dispose).toHaveBeenCalledOnce(); expect(old.scene.parent).toBeNull();
  expect(loadCustomizedAvatar).toHaveBeenLastCalledWith(expect.objectContaining({ accessoryId: null, hairColor: '#e5ad58' }), expect.anything(), false);
  await act(async () => resolve(next));
  expect(next.scene.parent!.parent).toBe(root);
  act(() => renderer.frame({}, 0.01)); expect(next.setMoving).toHaveBeenLastCalledWith(true);
  view.rerender(<RemotePlayer {...props} nickname="Renamed" bubbleText="New" appearance={{ ...appearance, accessoryId: null, hairColor: '#e5ad58' }} />);
  expect(loadCustomizedAvatar).toHaveBeenCalledTimes(2);
  expect(renderer.billboard).toHaveBeenLastCalledWith('Renamed', 'New', false);
  view.unmount(); expect(next.dispose).toHaveBeenCalledOnce();
});

it.each(['invalid', 'download'])('uses an honest legacy fallback for %s appearance without writing preferences', async failure => {
  const store = vi.spyOn(Storage.prototype, 'setItem');
  const view = render(<RemotePlayer {...props} appearance={failure === 'invalid' ? { ...appearance, hairId: 'unknown' } : appearance} />);
  if (failure === 'download') await act(async () => reject(Error('private error')));
  expect(renderer.legacyLoad).toHaveBeenCalled();
  expect(renderer.billboard).toHaveBeenCalledWith('Canonical (apariencia no disponible)', 'Hi', false);
  if (failure === 'invalid') expect(loadCustomizedAvatar).not.toHaveBeenCalled();
  expect(store).not.toHaveBeenCalled(); view.unmount();
});
