import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useSceneLifecycle } from './use-scene-lifecycle';

const renderer = vi.hoisted(() => ({ frame: (() => {}) as () => void, canvas: null as HTMLCanvasElement | null }));
vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: () => void) => { renderer.frame = callback; },
  useThree: () => ({ gl: { domElement: renderer.canvas } }),
}));
beforeEach(() => { renderer.canvas = document.createElement('canvas'); });

it('reports the first rendered frame once and releases the context-loss listener', () => {
  const ready = vi.fn();
  const failure = vi.fn();
  const { unmount } = renderHook(() => useSceneLifecycle(ready, failure));
  expect(ready).not.toHaveBeenCalled();
  act(() => { renderer.frame(); renderer.frame(); renderer.frame(); });
  expect(ready).toHaveBeenCalledOnce();
  const loss = new Event('webglcontextlost', { cancelable: true });
  act(() => renderer.canvas!.dispatchEvent(loss));
  expect(loss.defaultPrevented).toBe(true);
  expect(failure).toHaveBeenCalledOnce();
  unmount();
  renderer.canvas!.dispatchEvent(new Event('webglcontextlost'));
  expect(failure).toHaveBeenCalledOnce();
});
