import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Group, OrthographicCamera, Vector3 } from 'three';
import { beforeEach, expect, it, vi } from 'vitest';
import manifest from '../../../public/models/avatars/integration-catalogue.json';
import { parseAppearanceCatalogue } from './avatar-catalogue';
import { defaultAvatarConfiguration } from './avatar-preferences';
import { loadCustomizedAvatar } from './load-customized-avatar';
import type { AvatarResource } from './load-avatar';
import { CustomizedAvatarPreview } from './CustomizedAvatarPreview';

vi.mock('./load-customized-avatar', () => ({ loadCustomizedAvatar: vi.fn() }));
const renderer = vi.hoisted(() => ({ crashes: false }));
const camera = new OrthographicCamera();
vi.mock('@react-three/fiber', () => ({ useThree: () => ({ camera }), Canvas: ({ children }: { children: React.ReactNode }) => {
  if (renderer.crashes) throw Error('private renderer diagnostic');
  return <div data-testid="canvas">{children}</div>;
} }));
vi.mock('./AvatarScene', () => ({ AvatarScene: ({ onReady, onFailure }: { onReady(): void; onFailure(): void }) => <>
  <button onClick={onReady}>Render frame</button>
  <button onClick={onFailure}>Lose context</button>
</> }));
const catalogue = parseAppearanceCatalogue(manifest);
const configuration = defaultAvatarConfiguration(catalogue);
let pending: { resolve(value: AvatarResource): void; reject(error: Error): void }[];
const resource = () => ({ scene: new Group(), dispose: vi.fn(), update: vi.fn() } as unknown as AvatarResource);
beforeEach(() => {
  renderer.crashes = false;
  camera.position.set(4, 3.5, 4);
  camera.lookAt(0, 0, 0);
  pending = [];
  vi.mocked(loadCustomizedAvatar).mockImplementation(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
});
const props = () => ({ configuration, catalogue, onStatusChange: vi.fn() });

it('loads a dedicated customized resource with reduced motion and waits for a rendered frame', async () => {
  const input = props();
  const { unmount } = render(<CustomizedAvatarPreview {...input} />);
  expect(loadCustomizedAvatar).toHaveBeenCalledWith(configuration, catalogue, true);
  expect(input.onStatusChange).toHaveBeenLastCalledWith('loading');
  const avatar = resource();
  await act(async () => pending[0].resolve(avatar));
  expect(input.onStatusChange).not.toHaveBeenCalledWith('ready');
  fireEvent.click(screen.getByText('Render frame'));
  expect(input.onStatusChange).toHaveBeenLastCalledWith('ready');
  unmount();
  expect(avatar.dispose).toHaveBeenCalledOnce();
});
it('discards out-of-order choices and never lets their frame mark the current choice ready', async () => {
  const input = props();
  const { rerender } = render(<CustomizedAvatarPreview {...input} />);
  rerender(<CustomizedAvatarPreview {...input} configuration={{ ...configuration, hairId: 'dreads' }} />);
  const stale = resource();
  await act(async () => pending[0].resolve(stale));
  expect(stale.dispose).toHaveBeenCalledOnce();
  expect(screen.queryByTestId('canvas')).toBeNull();
  expect(input.onStatusChange).not.toHaveBeenCalledWith('ready');
  await act(async () => pending[1].resolve(resource()));
  fireEvent.click(screen.getByText('Render frame'));
  expect(input.onStatusChange).toHaveBeenLastCalledWith('ready');
});
it('releases a mounted choice immediately on replacement and does not reload for nickname edits', async () => {
  const input = props();
  const { rerender } = render(<CustomizedAvatarPreview {...input} />);
  const old = resource();
  await act(async () => pending[0].resolve(old));
  rerender(<CustomizedAvatarPreview {...input} configuration={{ ...configuration, nickname: 'Sol' }} />);
  expect(loadCustomizedAvatar).toHaveBeenCalledTimes(1);
  rerender(<CustomizedAvatarPreview {...input} configuration={{ ...configuration, topId: 'tank' }} />);
  expect(old.dispose).toHaveBeenCalledOnce();
  expect(screen.queryByTestId('canvas')).toBeNull();
  expect(input.onStatusChange).toHaveBeenLastCalledWith('loading');
});
it('isolates StrictMode effect replay so an abandoned request cannot publish or leak', async () => {
  const input = props();
  const { unmount } = render(<StrictMode><CustomizedAvatarPreview {...input} /></StrictMode>);
  expect(pending).toHaveLength(2);
  const abandoned = resource();
  await act(async () => pending[0].resolve(abandoned));
  expect(abandoned.dispose).toHaveBeenCalledOnce();
  expect(screen.queryByTestId('canvas')).toBeNull();
  const current = resource();
  await act(async () => pending[1].resolve(current));
  fireEvent.click(screen.getByText('Render frame'));
  expect(input.onStatusChange).toHaveBeenLastCalledWith('ready');
  unmount();
  expect(current.dispose).toHaveBeenCalledOnce();
});
it('orbits the real preview camera to the rear without changing its resource or readiness', async () => {
  const input = props();
  const { rerender } = render(<CustomizedAvatarPreview {...input} />);
  const avatar = resource();
  await act(async () => pending[0].resolve(avatar));
  fireEvent.click(screen.getByText('Render frame'));
  const rootMatrix = avatar.scene.matrix.clone();
  const view = screen.getByRole('group', { name: 'Girar vista previa del avatar' });
  for (let step = 0; step < 4; step++) fireEvent.keyDown(view, { key: 'ArrowRight' });
  expect(camera.position.x).toBeCloseTo(-4);
  expect(camera.position.z).toBeCloseTo(-4);
  expect(camera.position.y).toBe(3.5);
  expect(camera.getWorldDirection(new Vector3()).dot(camera.position.clone().normalize())).toBeCloseTo(-1);
  expect(avatar.scene.matrix.equals(rootMatrix)).toBe(true);
  expect(avatar.dispose).not.toHaveBeenCalled();
  expect(loadCustomizedAvatar).toHaveBeenCalledTimes(1);
  expect(input.onStatusChange).toHaveBeenLastCalledWith('ready');
  rerender(<CustomizedAvatarPreview {...input} configuration={{ ...configuration, nickname: 'Sol' }} />);
  expect(loadCustomizedAvatar).toHaveBeenCalledTimes(1);
  expect(camera.position.x).toBeCloseTo(-4);
  rerender(<CustomizedAvatarPreview {...input} configuration={{ ...configuration, topId: 'tank' }} />);
  expect(avatar.dispose).toHaveBeenCalledOnce();
  const replacement = resource();
  await act(async () => pending[1].resolve(replacement));
  expect(camera.position.x).toBeCloseTo(-4);
  expect(camera.position.z).toBeCloseTo(-4);
  expect(input.onStatusChange).toHaveBeenLastCalledWith('loading');
  fireEvent.click(screen.getByText('Render frame'));
  expect(input.onStatusChange).toHaveBeenLastCalledWith('ready');
});
it('disposes late results after unmount', async () => {
  const { unmount } = render(<CustomizedAvatarPreview {...props()} />);
  unmount();
  const late = resource();
  await act(async () => pending[0].resolve(late));
  expect(late.dispose).toHaveBeenCalledOnce();
});
it('reports safe load failure and ignores obsolete rejection', async () => {
  const input = props();
  const { rerender } = render(<CustomizedAvatarPreview {...input} />);
  rerender(<CustomizedAvatarPreview {...input} configuration={{ ...configuration, hairId: 'dreads' }} />);
  await act(async () => pending[0].reject(Error('obsolete')));
  expect(screen.queryByRole('alert')).toBeNull();
  await act(async () => pending[1].reject(Error('private download diagnostic')));
  expect(screen.getByRole('alert').textContent).toMatch(/No pudimos cargar/);
  expect(screen.queryByText(/private/)).toBeNull();
  expect(input.onStatusChange).toHaveBeenLastCalledWith('unavailable');
});
it('blocks without WebGL before downloading', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const input = props();
  render(<CustomizedAvatarPreview {...input} />);
  expect(loadCustomizedAvatar).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toMatch(/WebGL/);
  expect(input.onStatusChange).toHaveBeenLastCalledWith('unavailable');
});
it.each(['loss', 'crash'])('releases its resource on renderer %s and revokes readiness', async mode => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const input = props();
  const { unmount } = render(<CustomizedAvatarPreview {...input} />);
  const avatar = resource();
  renderer.crashes = mode === 'crash';
  await act(async () => pending[0].resolve(avatar));
  if (mode === 'loss') {
    fireEvent.click(screen.getByText('Render frame'));
    fireEvent.click(screen.getByText('Lose context'));
  }
  expect(screen.getByRole('alert').textContent).toMatch(/WebGL/);
  expect(input.onStatusChange).toHaveBeenLastCalledWith('unavailable');
  expect(avatar.dispose).toHaveBeenCalledOnce();
  unmount();
  expect(avatar.dispose).toHaveBeenCalledOnce();
});
