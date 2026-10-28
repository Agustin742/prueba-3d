import { act, fireEvent, render, screen } from '@testing-library/react';
import { Group } from 'three';
import { beforeEach, expect, it, vi } from 'vitest';
import { AvatarPreview } from './AvatarPreview';
import { loadAvatar, type AvatarResource } from './load-avatar';

vi.mock('./load-avatar', () => ({ loadAvatar: vi.fn() }));
const renderer = vi.hoisted(() => ({ crashes: false }));
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => {
    if (renderer.crashes) throw new Error('renderer setup failed');
    return <div data-testid="canvas">{children}</div>;
  },
}));
vi.mock('./AvatarScene', () => ({
  AvatarScene: ({ onReady, onFailure }: { onReady: () => void; onFailure: () => void }) => (
    <><button onClick={onReady}>Render frame</button><button onClick={onFailure}>Lose context</button></>
  ),
}));

let resolve: (avatar: AvatarResource) => void;
let reject: (error: Error) => void;
beforeEach(() => {
  renderer.crashes = false;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
  vi.mocked(loadAvatar).mockReturnValue(new Promise((yes, no) => { resolve = yes; reject = no; }));
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});

it('announces loading and does not claim ready merely because the asset downloaded', async () => {
  const dispose = vi.fn();
  const { unmount } = render(<AvatarPreview />);
  expect(screen.getByRole('status').textContent).toMatch(/Loading/);
  await act(async () => resolve({ scene: new Group(), dispose, update: vi.fn() } as unknown as AvatarResource));
  expect(screen.getByRole('status').textContent).not.toMatch(/ready/i);
  unmount();
  expect(dispose).toHaveBeenCalledOnce();
});

it('announces download failure without leaking diagnostics or showing a substitute', async () => {
  render(<AvatarPreview />);
  await act(async () => reject(new Error('private diagnostic')));
  expect(screen.getByRole('alert').textContent).toMatch(/could not be loaded/i);
  expect(screen.queryByText(/private diagnostic/)).toBeNull();
  expect(screen.queryByTestId('canvas')).toBeNull();
});

it('announces readiness only after a frame, then replaces success on context loss', async () => {
  render(<AvatarPreview />);
  await act(async () => resolve({ scene: new Group(), dispose: vi.fn(), update: vi.fn() } as unknown as AvatarResource));
  fireEvent.click(screen.getByText('Render frame'));
  expect(screen.getByRole('status').textContent).toMatch(/ready/i);
  fireEvent.click(screen.getByText('Lose context'));
  expect(screen.getByRole('alert').textContent).toMatch(/WebGL/i);
  expect(screen.queryByRole('status')).toBeNull();
});

it('reports unavailable WebGL rather than success', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  render(<AvatarPreview />);
  expect(loadAvatar).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toMatch(/WebGL/i);
  expect(screen.queryByRole('status')).toBeNull();
});

it('replaces the preview with an accessible failure if the renderer throws', async () => {
  renderer.crashes = true;
  const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  const dispose = vi.fn();
  render(<AvatarPreview />);
  await act(async () => resolve({ dispose } as unknown as AvatarResource));
  expect(screen.getByRole('alert').textContent).toMatch(/WebGL/i);
  expect(screen.queryByRole('status')).toBeNull();
  expect(dispose).toHaveBeenCalledOnce();
  expect(diagnostic).toHaveBeenCalled();
});

it('disposes a late download after unmount', async () => {
  const dispose = vi.fn();
  const { unmount } = render(<AvatarPreview />);
  unmount();
  await act(async () => resolve({ dispose } as unknown as AvatarResource));
  expect(dispose).toHaveBeenCalledOnce();
});
