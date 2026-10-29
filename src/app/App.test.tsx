import { act, fireEvent, render, screen } from '@testing-library/react';
import { Group } from 'three';
import { beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { loadCustomizedAvatar } from '../features/avatar/load-customized-avatar';
import type { AvatarResource } from '../features/avatar/load-avatar';
import { loadReception } from '../features/world/load-reception';
import { socket } from '../features/network/socket';

vi.mock('../features/avatar/load-customized-avatar', () => ({ loadCustomizedAvatar: vi.fn() }));
vi.mock('../features/avatar/load-avatar', () => ({ loadAvatar: () => new Promise(() => {}) }));
vi.mock('../features/world/load-reception', () => ({ loadReception: vi.fn() }));
vi.mock('../features/network/socket', () => ({ socket: {
  connected: true, on: vi.fn(), off: vi.fn(), emit: vi.fn(), connect: vi.fn(), once: vi.fn(),
} }));
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div> }));
vi.mock('../features/avatar/AvatarScene', () => ({ AvatarScene: ({ onReady }: { onReady(): void }) => <button onClick={onReady}>Render preview</button> }));
vi.mock('../features/world/ReceptionScene', () => ({ ReceptionScene: ({ onReady, nickname }: { onReady(): void; nickname: string }) => <>
  <button onClick={onReady}>Render reception</button><p>Avatar de {nickname}</p>
</> }));
vi.mock('../features/network/ChatOverlay', () => ({ ChatOverlay: ({ joined }: { joined: boolean }) => <p>{joined ? 'Chat disponible' : 'Unirte a la recepción'}</p> }));
let pending: ((avatar: AvatarResource) => void)[];
const resource = () => ({ scene: new Group(), update: vi.fn(), dispose: vi.fn() } as unknown as AvatarResource);
beforeEach(() => {
  pending = [];
  localStorage.clear();
  vi.mocked(loadCustomizedAvatar).mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  vi.mocked(loadReception).mockResolvedValue({ scene: new Group(), dispose: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
const enter = () => screen.getByRole('button', { name: /Entrar a la oficina/ }) as HTMLButtonElement;
async function preparedEntry() {
  fireEvent.change(screen.getByLabelText(/Apodo obligatorio/), { target: { value: 'Sol' } });
  const preview = resource();
  await act(async () => pending.at(-1)!(preview));
  expect(enter().disabled).toBe(true);
  fireEvent.click(screen.getByText('Render preview'));
  return preview;
}

it('starts each fresh visit at the dressing room even with a legacy nickname, without extra toolbar or network join', () => {
  localStorage.setItem('avatar_nickname', 'Legacy');
  render(<App />);
  expect(screen.getByRole('heading', { name: /Armá tu combinación/ })).toBeDefined();
  expect((screen.getByLabelText(/Apodo obligatorio/) as HTMLInputElement).value).toBe('Legacy');
  expect(screen.queryByLabelText('Local reception navigation')).toBeNull();
  expect(socket.emit).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /Avatar calibration/i })).toBeNull();
});
it('transfers only confirmed fields/catalogue, disposing preview before loading a distinct gameplay resource', async () => {
  const { unmount } = render(<App />);
  const preview = await preparedEntry();
  fireEvent.click(enter());
  expect(preview.dispose).toHaveBeenCalledOnce();
  expect(loadCustomizedAvatar).toHaveBeenCalledTimes(2);
  const [configuration, catalogue] = vi.mocked(loadCustomizedAvatar).mock.calls[1];
  expect(configuration.nickname).toBe('Sol');
  expect(catalogue).toBe(vi.mocked(loadCustomizedAvatar).mock.calls[0][1]);
  expect(screen.queryByText('Render preview')).toBeNull();
  expect(screen.queryByText('Unirte a la recepción')).toBeNull();
  const gameplay = resource();
  expect(gameplay.scene).not.toBe(preview.scene);
  await act(async () => pending[1](gameplay));
  expect(screen.getByText('Avatar de Sol')).toBeDefined();
  expect(screen.getByLabelText('Local reception navigation').getAttribute('aria-busy')).toBe('true');
  fireEvent.click(screen.getByText('Render reception'));
  unmount();
  expect(gameplay.dispose).toHaveBeenCalledOnce();
  expect(preview.dispose).toHaveBeenCalledOnce();
});
it('carries a failed-save warning into the active session without claiming persistence success', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
  render(<App />);
  await preparedEntry();
  fireEvent.click(enter());
  expect(screen.getByText(/No pudimos guardar/)).toBeDefined();
  expect(screen.getByText('Chat disponible')).toBeDefined();
  expect(screen.queryByText(/guardada con éxito/i)).toBeNull();
});
it('restores a confirmed choice on remount but requires a new preview and confirmation', async () => {
  const first = render(<App />);
  await preparedEntry();
  fireEvent.click(enter());
  first.unmount();
  render(<App />);
  expect((screen.getByLabelText(/Apodo obligatorio/) as HTMLInputElement).value).toBe('Sol');
  expect(enter().disabled).toBe(true);
  expect(screen.queryByLabelText('Local reception navigation')).toBeNull();
});
