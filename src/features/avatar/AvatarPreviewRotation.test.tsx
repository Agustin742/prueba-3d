import { fireEvent, render, screen } from '@testing-library/react';
import { OrthographicCamera, Vector3 } from 'three';
import { beforeEach, expect, it, vi } from 'vitest';
import { AvatarPreviewCamera, AvatarPreviewRotation } from './AvatarPreviewRotation';

const camera = new OrthographicCamera(-2, 2, 2, -2);
vi.mock('@react-three/fiber', () => ({ useThree: () => ({ camera }) }));
beforeEach(() => {
  camera.zoom = 100;
  camera.position.set(4, 3.5, 4);
  camera.lookAt(0, 0, 0);
  // jsdom lacks native pointer events and capture; dispatch the same event fields.
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number;
    isPrimary: boolean;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.isPrimary = init.isPrimary ?? true;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  });
});
function setup() {
  render(<AvatarPreviewRotation>{angle => <AvatarPreviewCamera angle={angle} />}</AvatarPreviewRotation>);
  const surface = screen.getByTestId('avatar-rotation-surface');
  surface.setPointerCapture = vi.fn();
  surface.hasPointerCapture = vi.fn(() => true);
  surface.releasePointerCapture = vi.fn();
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({ width: 200 } as DOMRect);
  return surface;
}
function expectFrame(x: number, z: number) {
  expect(camera.position.x).toBeCloseTo(x);
  expect(camera.position.z).toBeCloseTo(z);
  expect(camera.position.y).toBe(3.5);
  expect(camera.zoom).toBe(100);
  expect(camera.position.length()).toBeCloseTo(Math.hypot(4, 3.5, 4));
  expect(camera.getWorldDirection(new Vector3()).dot(camera.position.clone().normalize())).toBeCloseTo(-1);
}
it('leaves the preview unobstructed without visible rotation controls', () => {
  setup();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.queryByText(/Arrastrá para girar/)).toBeNull();
});
it('supports left, right, a full revolution and exact reset without changing framing', () => {
  setup();
  const view = screen.getByRole('group', { name: 'Girar vista previa del avatar' });
  view.focus();
  expect(document.activeElement).toBe(view);
  fireEvent.keyDown(view, { key: 'ArrowLeft' });
  expectFrame(0, Math.hypot(4, 4));
  fireEvent.keyDown(view, { key: 'ArrowRight' });
  expectFrame(4, 4);
  for (let step = 0; step < 8; step++) fireEvent.keyDown(view, { key: 'ArrowRight' });
  expectFrame(4, 4);
  fireEvent.keyDown(view, { key: 'ArrowRight' });
  fireEvent.keyDown(view, { key: 'Home' });
  expectFrame(4, 4);
});
it.each(['mouse', 'touch'])('orbits through a captured %s drag and stops on release', pointerType => {
  const surface = setup();
  const event = { pointerType, pointerId: 7, isPrimary: true, button: 0 };
  fireEvent.pointerDown(surface, { ...event, clientX: 10 });
  expect(surface.setPointerCapture).toHaveBeenCalledWith(7);
  fireEvent.pointerMove(surface, { ...event, clientX: 110 });
  expectFrame(-4, -4);
  fireEvent.pointerUp(surface, event);
  expect(surface.releasePointerCapture).toHaveBeenCalledWith(7);
  fireEvent.pointerMove(surface, { ...event, clientX: 210 });
  expectFrame(-4, -4);
});
it.each(['pointerCancel', 'lostPointerCapture'])('ends interrupted gestures on %s', interruption => {
  const surface = setup();
  fireEvent.pointerDown(surface, { clientX: 0, pointerId: 1 });
  if (interruption === 'pointerCancel') fireEvent.pointerCancel(surface);
  else fireEvent.lostPointerCapture(surface);
  fireEvent.pointerMove(surface, { clientX: 100, pointerId: 1 });
  expectFrame(4, 4);
});
it('ignores hover, secondary buttons and additional pointers', () => {
  const surface = setup();
  fireEvent.pointerMove(surface, { clientX: 100 });
  fireEvent.pointerDown(surface, { button: 2, clientX: 0 });
  fireEvent.pointerMove(surface, { clientX: 100 });
  fireEvent.pointerDown(surface, { isPrimary: false, clientX: 0 });
  fireEvent.pointerMove(surface, { clientX: 100 });
  expectFrame(4, 4);
  fireEvent.pointerDown(surface, { pointerId: 1, clientX: 0 });
  fireEvent.pointerDown(surface, { pointerId: 2, clientX: 0 });
  fireEvent.pointerMove(surface, { pointerId: 2, clientX: 100 });
  fireEvent.pointerUp(surface, { pointerId: 2 });
  fireEvent.pointerMove(surface, { pointerId: 1, clientX: 100 });
  expectFrame(-4, -4);
});
it('does not spin or continue moving after an explicit turn', () => {
  vi.useFakeTimers();
  try {
    setup();
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' });
    const position = camera.position.clone();
    const direction = camera.quaternion.clone();
    vi.advanceTimersByTime(10_000);
    expect(camera.position.equals(position)).toBe(true);
    expect(camera.quaternion.equals(direction)).toBe(true);
  } finally { vi.useRealTimers(); }
});
it('keeps keyboard and pointer activation inside the preview, without capturing other inputs', () => {
  const shortcut = vi.fn();
  const click = vi.fn();
  render(<div onKeyDown={shortcut} onKeyUp={shortcut} onClick={click}>
    <input aria-label="Apodo" />
    <AvatarPreviewRotation>{angle => <AvatarPreviewCamera angle={angle} />}</AvatarPreviewRotation>
  </div>);
  const view = screen.getByRole('group');
  fireEvent.keyDown(view, { key: 'ArrowRight' });
  fireEvent.keyUp(view, { key: 'ArrowRight' });
  fireEvent.click(view);
  expect(shortcut).not.toHaveBeenCalled();
  expect(click).not.toHaveBeenCalled();
  const direction = camera.quaternion.clone();
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'a' });
  expect(camera.quaternion.equals(direction)).toBe(true);
});
