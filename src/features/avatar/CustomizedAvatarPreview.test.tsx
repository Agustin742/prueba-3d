import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import manifest from '../../../public/models/avatars/integration-catalogue.json';
import { parseAppearanceCatalogue } from './avatar-catalogue';
import { defaultAvatarConfiguration } from './avatar-preferences';
import { loadCustomizedAvatar } from './load-customized-avatar';
import type { AvatarResource } from './load-avatar';
import { CustomizedAvatarPreview } from './CustomizedAvatarPreview';
import { AvatarPreviewRotation } from './AvatarPreviewRotation';
const scene = vi.hoisted(() => ({ ready: [] as (() => void)[], failed: [] as (() => void)[], camera: { position: { set: vi.fn() }, lookAt: vi.fn(), updateMatrixWorld: vi.fn() } }));
vi.mock('./load-customized-avatar', () => ({ loadCustomizedAvatar: vi.fn() }));
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, useThree: () => ({ camera: scene.camera }) }));
vi.mock('./AvatarScene', () => ({ AvatarScene: ({ onReady, onFailure }: { onReady(): void; onFailure(): void }) => { scene.ready.push(onReady); scene.failed.push(onFailure); return null; } }));
const catalogue = parseAppearanceCatalogue(manifest), configuration = defaultAvatarConfiguration(catalogue);
let requests: { resolve(value: AvatarResource): void; reject(error: Error): void }[];
const resource = () => ({ dispose: vi.fn() } as unknown as AvatarResource);
beforeEach(() => {
  requests = []; scene.ready = []; scene.failed = [];
  // Cast the fake function, since DOM canvas overloads also include the unrelated WebGPU context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({ getExtension: () => null })) as unknown as HTMLCanvasElement['getContext']);
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.mocked(loadCustomizedAvatar).mockImplementation(() => new Promise((resolve, reject) => requests.push({ resolve, reject })));
});
it('owns StrictMode requests, ignores obsolete loads/frames, and never reloads for nickname edits', async () => {
  const status = vi.fn(), a = resource(), obsolete = resource(), b = resource();
  const view = (config = configuration) => <StrictMode><CustomizedAvatarPreview configuration={config} catalogue={catalogue} onStatusChange={status} /></StrictMode>;
  const { rerender, unmount } = render(view());
  expect(requests).toHaveLength(2);
  await act(async () => { requests[0].resolve(obsolete); requests[1].resolve(a); });
  expect(obsolete.dispose).toHaveBeenCalledOnce();
  const stale = scene.ready.at(-1)!;
  act(stale); expect(status).toHaveBeenLastCalledWith('ready');
  rerender(view({ ...configuration, nickname: 'New name' })); expect(requests).toHaveLength(2);
  rerender(view({ ...configuration, hairId: 'dreads' }));
  expect(a.dispose).toHaveBeenCalledOnce();
  act(stale); expect(status).toHaveBeenLastCalledWith('loading');
  unmount();
  await act(async () => { requests[2].resolve(b); requests[3].reject(Error('obsolete')); });
  expect(b.dispose).toHaveBeenCalledOnce();
  expect(loadCustomizedAvatar).toHaveBeenCalledWith(expect.anything(), catalogue, true);
});
it('reports asset/WebGL failures and releases owned resources once', async () => {
  const status = vi.fn(), a = resource();
  const { unmount } = render(<CustomizedAvatarPreview configuration={configuration} catalogue={catalogue} onStatusChange={status} />);
  await act(async () => requests[0].resolve(a));
  act(scene.failed.at(-1)!); act(scene.ready.at(-1)!);
  expect(status).toHaveBeenLastCalledWith('unavailable');
  expect(screen.getByRole('alert')).toBeDefined(); unmount(); expect(a.dispose).toHaveBeenCalledOnce();
});
it('rotates by focused arrows/Home and touch drag, cancels interrupted drags, with no visible controls', () => {
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number; isPrimary = true;
    constructor(type: string, options: PointerEventInit = {}) { super(type, options); this.pointerId = options.pointerId ?? 1; }
  });
  render(<AvatarPreviewRotation>{angle => <output>{angle}</output>}</AvatarPreviewRotation>);
  const group = screen.getByRole('group'), surface = screen.getByTestId('avatar-rotation-surface');
  const angle = () => Number(screen.getByRole('status').textContent);
  expect(group.tabIndex).toBe(0); expect(screen.queryByRole('button')).toBeNull();
  fireEvent.keyDown(window, { key: 'ArrowRight' }); fireEvent.keyDown(group, { key: 'ArrowRight' }); expect(angle()).toBe(0);
  group.focus(); fireEvent.keyDown(group, { key: 'ArrowRight' }); expect(angle()).toBeCloseTo(Math.PI / 4);
  fireEvent.keyDown(group, { key: 'ArrowLeft' }); expect(angle()).toBe(0);
  Object.assign(surface, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() });
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({ width: 100 } as DOMRect);
  fireEvent.pointerDown(surface, { button: 0, clientX: 0, pointerType: 'touch' });
  fireEvent.pointerMove(surface, { clientX: 25 }); expect(angle()).toBeCloseTo(Math.PI / 2);
  fireEvent.pointerCancel(surface); fireEvent.pointerMove(surface, { clientX: 50 }); expect(angle()).toBeCloseTo(Math.PI / 2);
  fireEvent.keyDown(group, { key: 'Home' }); expect(angle()).toBe(0);
});
it('blocks failed downloads and unavailable WebGL without leaking diagnostics', async () => {
  const status = vi.fn(); const { unmount } = render(<CustomizedAvatarPreview configuration={configuration} catalogue={catalogue} onStatusChange={status} />);
  await act(async () => requests[0].reject(Error('private detail')));
  expect(status).toHaveBeenLastCalledWith('unavailable'); expect(screen.getByRole('alert').textContent).not.toContain('private detail'); unmount();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  render(<CustomizedAvatarPreview configuration={configuration} catalogue={catalogue} onStatusChange={status} />);
  expect(requests).toHaveLength(1); expect(status).toHaveBeenLastCalledWith('unavailable');
});
