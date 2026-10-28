import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createNavigation, type Point } from './navigation';

const modalOpen = () => !!document.querySelector('dialog[open], [role="dialog"]:not([hidden]), [aria-modal="true"]:not([hidden])');
const uiTarget = (target: EventTarget | null) => target instanceof Element
  && !!target.closest('input, textarea, select, button, a, [contenteditable], [role="dialog"], dialog');

/** One navigation snapshot owner; rendering consumes tick results without a second position. */
export function useNavigationControls(active: boolean, radius?: number) {
  const container = useRef<HTMLDivElement>(null);
  // Footprint is fixed for this mounted controller; a different avatar requires a new view.
  const [navigation] = useState(() => createNavigation(undefined, { radius }));
  const state = useRef(navigation.spawn()!);
  const keys = useRef(new Set<string>());
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const tap = useRef(false);
  const [feedback, setFeedback] = useState('Focus the reception to move.');
  const available = () => active && !document.hidden && !modalOpen()
    && document.activeElement === container.current;
  const stop = useCallback(() => {
    keys.current.clear(); gesture.current = null; tap.current = false;
    state.current = navigation.cancelTarget(state.current);
    setFeedback('Navigation stopped. Use a fresh key or floor tap to continue.');
  }, [navigation]);

  useEffect(() => {
    if (!active) stop();
    const released = (event: globalThis.KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const focus = () => { if (document.activeElement !== container.current || modalOpen()) stop(); };
    const observer = new MutationObserver(() => { if (modalOpen()) stop(); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'role', 'aria-modal', 'hidden'] });
    window.addEventListener('keyup', released);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    document.addEventListener('focusin', focus);
    return () => {
      observer.disconnect(); window.removeEventListener('keyup', released);
      window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop);
      document.removeEventListener('focusin', focus);
      keys.current.clear(); gesture.current = null; tap.current = false;
      state.current = navigation.cancelTarget(state.current);
    };
  }, [active, navigation, stop]);

  const target = (point: Point | null) => {
    if (!available()) { stop(); return; }
    keys.current.clear();
    state.current = navigation.cancelTarget(state.current);
    const request = point && navigation.requestTarget(state.current, point);
    if (!request || request.reason) { setFeedback('Destination not reachable. Select clear floor inside the reception.'); return; }
    state.current = request.state;
    setFeedback(request.state.path.length ? 'Moving to selected floor.' : 'Already at selected floor.');
  };
  return {
    container, feedback, stop, target,
    consumeTap() {
      if (!tap.current) return false;
      tap.current = false;
      return true;
    },
    tapTarget(point: Point | null) { if (tap.current) { tap.current = false; target(point); } },
    tick(dt: number) {
      if (!available()) { if (keys.current.size || state.current.path.length) stop(); return state.current; }
      const x = Number(keys.current.has('d')) - Number(keys.current.has('a'));
      const z = Number(keys.current.has('s')) - Number(keys.current.has('w'));
      const seconds = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
      const routed = state.current.path.length > 0;
      state.current = x || z ? navigation.move(state.current, { x, z }, seconds) : navigation.advance(state.current, seconds);
      if (routed && !state.current.path.length) setFeedback('Route ended on selected floor.');
      return state.current;
    },
    events: {
      onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (!available() || uiTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
        const key = event.key.toLowerCase();
        if (key === 'escape') { event.preventDefault(); stop(); }
        if (!'wasd'.includes(key) || key.length !== 1) return;
        event.preventDefault();
        if (!event.repeat) {
          keys.current.add(key); state.current = navigation.cancelTarget(state.current);
          setFeedback('Manual movement.');
        }
      },
      onPointerDownCapture(event: PointerEvent<HTMLDivElement>) {
        if (uiTarget(event.target)) { stop(); return; }
        if (!active || modalOpen() || event.button !== 0) return;
        container.current?.focus();
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; tap.current = false;
      },
      onPointerUpCapture(event: PointerEvent<HTMLDivElement>) {
        const start = gesture.current; gesture.current = null;
        tap.current = !!start && start.id === event.pointerId && available()
          && Math.hypot(start.x - event.clientX, start.y - event.clientY) < 8 && !uiTarget(event.target);
      },
      onPointerCancel: stop,
      onBlur: stop,
    },
  };
}

export type NavigationControls = ReturnType<typeof useNavigationControls>;
