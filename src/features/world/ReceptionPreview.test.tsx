import { act, fireEvent, render, screen } from '@testing-library/react';
import { Group } from 'three';
import { beforeEach, expect, it, vi } from 'vitest';
import { loadAvatar, type AvatarResource } from '../avatar/load-avatar';
import { loadReception, type ReceptionResource } from './load-reception';
import { ReceptionPreview } from './ReceptionPreview';

vi.mock('../avatar/load-avatar', () => ({ loadAvatar: vi.fn() }));
vi.mock('./load-reception', () => ({ loadReception: vi.fn() }));
const renderer = vi.hoisted(() => ({ crashes: false }));
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children, onPointerMissed }: { children: React.ReactNode; onPointerMissed: () => void }) => {
  if (renderer.crashes) throw new Error('renderer failed');
  return <div data-testid="canvas" onClick={onPointerMissed}>{children}</div>;
} }));
vi.mock('./ReceptionScene', () => ({ ReceptionScene: ({ onReady, onFailure, tick, onSelect, onInteract, npc }: { npc?: unknown; onReady(): void; onFailure(): void; tick(dt: number): { position: { z: number } }; onSelect(point: { x: number; y: number; z: number }): void; onInteract?(id: 'counter-bell' | 'noticeboard' | 'waiting-seat' | 'portal-doorway'): void }) => <>
  <button onClick={event => { event.stopPropagation(); onReady(); }}>Rendered</button>
  <button onClick={event => { event.stopPropagation(); onFailure(); }}>Context loss</button>
  <span data-testid="floor" onPointerUp={() => onSelect({ x: 3, y: 0, z: 2 })}>Floor</span>
  <span data-testid="narrow-floor" onPointerUp={() => onSelect({ x: 0, y: 0, z: 0 })}>Narrow floor</span>
  <span data-testid="prop-bell" onPointerUp={() => onInteract?.('counter-bell')}>Bell 3D</span>
  <span data-testid="prop-noticeboard" onPointerUp={() => onInteract?.('noticeboard')}>Noticeboard 3D</span>
  <button onClick={event => { event.stopPropagation(); screen.getByTestId('position').textContent = String(tick(0.1).position.z); }}>Tick</button>
  <span data-testid="position" />
  {npc ? <span data-testid="npc" /> : null}
</> }));
let resolveAvatar: (value: AvatarResource) => void;
let resolveRoom: (value: ReceptionResource) => void;
let rejectAvatar: (error: Error) => void;
let rejectRoom: (error: Error) => void;
let resolveNpc: (value: AvatarResource) => void;
let rejectNpc: (error: Error) => void;
const avatar = () => ({ scene: new Group(), dispose: vi.fn(), update: vi.fn() } as unknown as AvatarResource);
const room = () => ({ scene: new Group(), dispose: vi.fn() });
beforeEach(() => {
  renderer.crashes = false;
  // jsdom has no PointerEvent constructor; preserve pointer fields on real DOM events.
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number; pointerType: string;
    constructor(type: string, options: PointerEventInit = {}) {
      super(type, options); this.pointerId = options.pointerId ?? 0; this.pointerType = options.pointerType ?? 'mouse';
    }
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const avatarPromise = new Promise<AvatarResource>((yes, no) => { resolveAvatar = yes; rejectAvatar = no; });
  const npcPromise = new Promise<AvatarResource>((yes, no) => { resolveNpc = yes; rejectNpc = no; });
  vi.mocked(loadAvatar).mockImplementation((_reducedMotion, path) => path ? npcPromise : avatarPromise);
  vi.mocked(loadReception).mockReturnValue(new Promise((yes, no) => { resolveRoom = yes; rejectRoom = no; }));
});
async function loaded() { await act(async () => { resolveAvatar(avatar()); resolveRoom(room()); }); }

it('waits for BOTH original assets and a rendered frame, then renders a clean interactive viewport without toolbar clutter', async () => {
  render(<ReceptionPreview />);
  expect(screen.getByText(/Loading.*avatar.*reception/i)).toBeDefined();
  await act(async () => resolveAvatar(avatar())); expect(screen.queryByTestId('canvas')).toBeNull();
  await act(async () => resolveRoom(room()));
  expect(screen.queryByText(/Reception ready/i)).toBeNull();
  fireEvent.click(screen.getByText('Rendered'));
  expect(screen.getByLabelText('Local reception navigation').tabIndex).toBe(0);
  expect(screen.queryByRole('button', { name: /Stop navigation/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /Ring reception bell/i })).toBeNull();
});
it.each(['avatar', 'room'])('reports %s failure, releases the other asset including late results, without diagnostics', async asset => {
  render(<ReceptionPreview />);
  const resource = asset === 'avatar' ? room() : avatar();
  await act(async () => { (asset === 'avatar' ? rejectAvatar : rejectRoom)(new Error('private detail')); });
  expect(screen.getByRole('alert').textContent).toMatch(asset === 'avatar' ? /avatar/i : /reception/i);
  expect(screen.queryByText(/private detail/)).toBeNull();
  await act(async () => { if (asset === 'avatar') resolveRoom(resource as ReceptionResource); else resolveAvatar(resource as AvatarResource); });
  expect(resource.dispose).toHaveBeenCalledOnce(); expect(screen.queryByTestId('canvas')).toBeNull();
});
it('releases an already-loaded sibling asset when the remaining download fails', async () => {
  const a = avatar(); const { unmount } = render(<ReceptionPreview />);
  await act(async () => resolveAvatar(a));
  await act(async () => rejectRoom(new Error('missing')));
  expect(a.dispose).toHaveBeenCalledOnce(); unmount(); expect(a.dispose).toHaveBeenCalledOnce();
});
it('cleans both late downloads after unmount', async () => {
  const a = avatar(); const r = room(); const { unmount } = render(<ReceptionPreview />); unmount();
  await act(async () => { resolveAvatar(a); resolveRoom(r); });
  expect(a.dispose).toHaveBeenCalledOnce(); expect(r.dispose).toHaveBeenCalledOnce();
});
it('does not load either asset without WebGL', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  render(<ReceptionPreview />); expect(loadAvatar).not.toHaveBeenCalled(); expect(loadReception).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toMatch(/WebGL/);
});
it.each(['loss', 'crash'])('cleans both owned resources on renderer %s', async mode => {
  const a = avatar(); const r = room();
  const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<ReceptionPreview />); renderer.crashes = mode === 'crash';
  await act(async () => { resolveAvatar(a); resolveRoom(r); });
  if (mode === 'loss') fireEvent.click(screen.getByText('Context loss'));
  expect(screen.getByRole('alert').textContent).toMatch(/WebGL/);
  expect(a.dispose).toHaveBeenCalledOnce(); expect(r.dispose).toHaveBeenCalledOnce(); diagnostic.mockRestore();
});
it('uses the effective avatar footprint in the actual reception controller, rejecting narrow floor near the counter', async () => {
  render(<ReceptionPreview />); await loaded(); fireEvent.click(screen.getByText('Rendered'));
  const floor = screen.getByTestId('narrow-floor');
  fireEvent.pointerDown(floor, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerUp(floor, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
  expect(screen.getByText(/Destination not reachable/)).toBeDefined();
});
it('rejects an off-room mouse click accessibly, without claiming arrival', async () => {
  render(<ReceptionPreview />); await loaded(); fireEvent.click(screen.getByText('Rendered'));
  const canvas = screen.getByTestId('canvas');
  fireEvent.pointerDown(canvas, { pointerId: 2, button: 0, clientX: 0, clientY: 0 });
  fireEvent.pointerUp(canvas, { pointerId: 2, button: 0, clientX: 0, clientY: 0 });
  fireEvent.click(canvas);
  expect(screen.getByText(/Destination not reachable/)).toBeDefined();
});
it.each(['drag', 'cancel', 'blur'])('does not accept an interrupted or dragged tap: %s', async interruption => {
  render(<ReceptionPreview />); await loaded(); fireEvent.click(screen.getByText('Rendered'));
  const floor = screen.getByTestId('floor');
  fireEvent.pointerDown(floor, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
  if (interruption === 'cancel') fireEvent.pointerCancel(floor);
  if (interruption === 'blur') fireEvent.blur(window);
  fireEvent.pointerUp(floor, { pointerId: 1, button: 0, clientX: interruption === 'drag' ? 50 : 20, clientY: 20 });
  expect(screen.queryByText(/Moving to selected floor/)).toBeNull();
});
it('accepts a fresh touch tap without hover and cancels movement with Escape', async () => {
  render(<ReceptionPreview />); await loaded(); fireEvent.click(screen.getByText('Rendered'));
  const floor = screen.getByTestId('floor');
  fireEvent.pointerDown(floor, { pointerId: 1, button: 0, clientX: 20, clientY: 20, pointerType: 'touch' });
  fireEvent.pointerUp(floor, { pointerId: 1, button: 0, clientX: 20, clientY: 20, pointerType: 'touch' });
  expect(screen.getByText(/Moving to selected floor/)).toBeDefined();
  fireEvent.keyDown(screen.getByLabelText('Local reception navigation'), { key: 'Escape' });
  expect(screen.queryByText(/Moving to selected floor/)).toBeNull();
});

it('interacts directly with 3D reception objects, opens the Noticeboard dialog on 3D tap, pauses navigation and restores focus on close', async () => {
  render(<ReceptionPreview />); await loaded(); fireEvent.click(screen.getByText('Rendered'));
  const region = screen.getByLabelText('Local reception navigation');
  const bell3d = screen.getByTestId('prop-bell');
  fireEvent.pointerDown(bell3d, { pointerId: 1, button: 0, clientX: 15, clientY: 15 });
  fireEvent.pointerUp(bell3d, { pointerId: 1, button: 0, clientX: 15, clientY: 15 });
  expect(screen.getByText(/Reception bell rung/i)).toBeDefined();

  // Start floor movement, then tap the 3D Noticeboard directly
  const floor = screen.getByTestId('floor');
  fireEvent.pointerDown(floor, { pointerId: 2, button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerUp(floor, { pointerId: 2, button: 0, clientX: 20, clientY: 20 });
  expect(screen.getByText(/Moving to selected floor/)).toBeDefined();

  const noticeboard3d = screen.getByTestId('prop-noticeboard');
  fireEvent.pointerDown(noticeboard3d, { pointerId: 3, button: 0, clientX: 25, clientY: 25 });
  fireEvent.pointerUp(noticeboard3d, { pointerId: 3, button: 0, clientX: 25, clientY: 25 });
  const dialog = screen.getByRole('dialog', { name: /Reception noticeboard/i });
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(dialog.textContent).toMatch(/local preview|backend authorization/i);

  const closeButton = screen.getByRole('button', { name: /Close noticeboard/i });
  fireEvent.click(closeButton);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(region);
});

it('loads the NPC model in parallel and renders it without gating readiness on it', async () => {
  const n = avatar(); const { unmount } = render(<ReceptionPreview />);
  expect(loadAvatar).toHaveBeenCalledWith(false, 'models/npc/monkey.glb');
  await loaded();
  expect(screen.getByTestId('canvas')).toBeDefined(); expect(screen.queryByTestId('npc')).toBeNull();
  fireEvent.click(screen.getByText('Rendered'));
  await act(async () => resolveNpc(n));
  expect(screen.getByTestId('npc')).toBeDefined(); expect(n.dispose).not.toHaveBeenCalled();
  unmount(); expect(n.dispose).toHaveBeenCalledOnce();
});
it('still renders the reception without an NPC when its download fails, keeping the other assets', async () => {
  const a = avatar(); const r = room(); render(<ReceptionPreview />);
  await act(async () => { rejectNpc(new Error('missing npc')); resolveAvatar(a); resolveRoom(r); });
  expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByTestId('canvas')).toBeDefined();
  expect(screen.queryByTestId('npc')).toBeNull(); expect(a.dispose).not.toHaveBeenCalled(); expect(r.dispose).not.toHaveBeenCalled();
});
it('releases a late NPC when the reception is already gone', async () => {
  const n = avatar(); const { unmount } = render(<ReceptionPreview />); unmount();
  await act(async () => resolveNpc(n));
  expect(n.dispose).toHaveBeenCalledOnce();
});
