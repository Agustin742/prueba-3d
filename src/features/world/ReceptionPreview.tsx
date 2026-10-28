import { Component, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { loadAvatar, type AvatarResource } from '../avatar/load-avatar';
import { loadReception, type ReceptionResource } from './load-reception';
import { ReceptionScene } from './ReceptionScene';
import {
  getReceptionInteraction,
  type ReceptionInteractionId,
} from './reception-interactions';
import { receptionAvatarRadius } from './reception-layout';
import { useNavigationControls } from './use-navigation-controls';

function WebGLFailure() {
  return <p role="alert">WebGL reception unavailable. Enable hardware acceleration or try another browser, then reload.</p>;
}
class ReceptionBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <WebGLFailure /> : this.props.children; }
}
function ReceptionContent() {
  const [avatar, setAvatar] = useState<AvatarResource>();
  const [room, setRoom] = useState<ReceptionResource>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'avatar-error' | 'room-error' | 'webgl-error'>('loading');
  const [interactionNote, setInteractionNote] = useState<string | null>(null);
  const [noticeboardOpen, setNoticeboardOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const release = useRef<() => void>(() => {});
  const controls = useNavigationControls(status === 'ready', receptionAvatarRadius);
  const dialogTitleId = useId();
  const ready = useCallback(() => setStatus(current => current === 'loading' ? 'ready' : current), []);
  const failed = useCallback(() => { release.current(); setStatus('webgl-error'); }, []);

  const triggerInteraction = useCallback((id: ReceptionInteractionId) => {
    if (status !== 'ready' || !controls.consumeTap()) return;
    const item = getReceptionInteraction(id);
    setInteractionNote(item.feedback);
    if (id === 'noticeboard') {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : controls.container.current;
      controls.stop();
      setNoticeboardOpen(true);
    }
  }, [controls, status]);

  const closeNoticeboard = useCallback(() => {
    setNoticeboardOpen(false);
    const target = returnFocusRef.current ?? controls.container.current;
    target?.focus();
  }, [controls.container]);

  useEffect(() => {
    if (!noticeboardOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeNoticeboard();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [noticeboardOpen, closeNoticeboard]);

  useEffect(() => {
    let active = true;
    const owned: { dispose(): void }[] = [];
    const cleanup = () => {
      active = false;
      for (const resource of owned.splice(0)) resource.dispose();
    };
    release.current = cleanup;
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      if (!context) { failed(); return cleanup; }
      context.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { failed(); return cleanup; }
    const accept = <T extends { dispose(): void }>(resource: T, publish: (resource: T) => void) => {
      if (!active) { resource.dispose(); return; }
      owned.push(resource); publish(resource);
    };
    const reject = (error: 'avatar-error' | 'room-error') => {
      if (active) { cleanup(); setStatus(error); }
    };
    loadAvatar(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      .then(resource => accept(resource, setAvatar)).catch(() => reject('avatar-error'));
    loadReception().then(resource => accept(resource, setRoom)).catch(() => reject('room-error'));
    // GLTF downloads cannot be aborted: every obsolete result is disposed, never mounted.
    return cleanup;
  }, [failed]);

  if (status === 'webgl-error') return <WebGLFailure />;
  if (status === 'avatar-error' || status === 'room-error') return <p role="alert">
    The original {status === 'avatar-error' ? 'avatar' : 'reception'} could not be loaded. Check the local model file and reload.
  </p>;
  return (
    <div className="reception-stage">
      {status !== 'ready' && (
        <p role="status" className="reception-loading">
          Loading original avatar and reception; preparing WebGL…
        </p>
      )}
      <div
        className="preview reception"
        ref={controls.container}
        tabIndex={0}
        role="region"
        aria-label="Local reception navigation"
        aria-busy={status !== 'ready'}
        {...controls.events}
      >
        {avatar && room && (
          <Canvas
            orthographic
            camera={{ position: [14, 14, 14], near: 0.1, far: 100 }}
            dpr={[1, 1.5]}
            onPointerMissed={() => controls.tapTarget(null)}
          >
            <ReceptionScene
              avatar={avatar}
              room={room}
              tick={controls.tick}
              onSelect={point => { setInteractionNote(null); controls.tapTarget(point); }}
              onInteract={triggerInteraction}
              onReady={ready}
              onFailure={failed}
            />
          </Canvas>
        )}
      </div>
      {noticeboardOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby={dialogTitleId} className="reception-dialog">
          <h2 id={dialogTitleId}>Reception noticeboard</h2>
          <p>{getReceptionInteraction('noticeboard').detail}</p>
          <button ref={closeButtonRef} type="button" onClick={closeNoticeboard}>Close noticeboard</button>
        </div>
      )}
      <p role="status" aria-live="polite" className="reception-hud">
        {interactionNote ?? controls.feedback}
      </p>
    </div>
  );
}
export function ReceptionPreview() {
  return <ReceptionBoundary><ReceptionContent /></ReceptionBoundary>;
}
