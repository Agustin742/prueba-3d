import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import type { AvatarConfiguration } from './AvatarCustomizer';
import type { AppearanceCatalogue } from './avatar-appearance';
import type { AvatarResource } from './load-avatar';
import { loadCustomizedAvatar } from './load-customized-avatar';
import { AvatarScene } from './AvatarScene';
import { AvatarPreviewCamera, AvatarPreviewRotation } from './AvatarPreviewRotation';

export type CustomizedPreviewStatus = 'loading' | 'ready' | 'unavailable';
export interface CustomizedAvatarPreviewProps {
  configuration: AvatarConfiguration;
  catalogue: AppearanceCatalogue;
  onStatusChange(status: CustomizedPreviewStatus): void;
}

/** Nickname edits do not invalidate a rendered appearance. */
export function appearancePreviewKey(config: AvatarConfiguration): string {
  return JSON.stringify([config.body, config.hairId, config.topId, config.accessoryId,
    config.hairColor, config.clothingColor]);
}
function WebGLFailure() {
  return <p role="alert">La vista previa WebGL no está disponible. Activá la aceleración gráfica o probá otro navegador y recargá.</p>;
}
class PreviewBoundary extends Component<{ children: ReactNode; onFailure(): void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <WebGLFailure /> : this.props.children; }
}

function OwnedPreview(props: CustomizedAvatarPreviewProps & { angle: number }) {
  // This keyed owner represents exactly one visual request, even if its nickname changes.
  const [request] = useState(() => ({ configuration: props.configuration, catalogue: props.catalogue }));
  const [avatar, setAvatar] = useState<AvatarResource>();
  const [status, setStatus] = useState<CustomizedPreviewStatus>('loading');
  const [error, setError] = useState<'asset' | 'webgl'>();
  const release = useRef<() => void>(() => {});
  const active = useRef(false);
  const notify = useRef(props.onStatusChange);
  notify.current = props.onStatusChange;
  const failed = useCallback(() => {
    release.current();
    setError('webgl');
    setStatus('unavailable');
    notify.current('unavailable');
  }, []);
  const ready = useCallback(() => {
    if (!active.current) return;
    setStatus('ready');
    notify.current('ready');
  }, []);

  useEffect(() => {
    active.current = true;
    let owned: AvatarResource | undefined;
    const cleanup = () => {
      active.current = false;
      owned?.dispose();
      owned = undefined;
    };
    release.current = cleanup;
    notify.current('loading');
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      if (!context) { failed(); return cleanup; }
      context.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { failed(); return cleanup; }
    // Each request has its own cancellation flag, including StrictMode effect replay.
    let obsolete = false;
    loadCustomizedAvatar(request.configuration, request.catalogue,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches).then(resource => {
      if (obsolete || !active.current) { resource.dispose(); return; }
      owned = resource;
      setAvatar(resource);
    }).catch(() => {
      if (obsolete || !active.current) return;
      cleanup();
      setError('asset');
      setStatus('unavailable');
      notify.current('unavailable');
    });
    return () => { obsolete = true; cleanup(); };
  }, [request, failed]);

  if (error === 'webgl') return <WebGLFailure />;
  if (error === 'asset') return <p role="alert">No pudimos cargar tu avatar. Revisá los archivos locales y recargá para volver a intentarlo.</p>;
  return <PreviewBoundary onFailure={failed}>
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <p role="status" style={{ margin: '0 0 8px', fontSize: '.8rem' }}>
        {status === 'ready' ? 'Tu vista previa está lista.' : 'Preparando tu vista previa…'}
      </p>
      <div role="img" aria-label="Vista previa 3D de tu avatar" style={{ width: '100%', flex: 1, minHeight: 0 }}>
        {avatar && <Canvas orthographic camera={{ position: [4, 3.5, 4], zoom: 100 }} dpr={[1, 1.5]}>
          <AvatarPreviewCamera angle={props.angle} />
          <AvatarScene avatar={avatar} onReady={ready} onFailure={failed} />
        </Canvas>}
      </div>
    </div>
  </PreviewBoundary>;
}

export function CustomizedAvatarPreview(props: CustomizedAvatarPreviewProps) {
  // Remounting also resets frame counters and error boundaries; scenes never cross canvases.
  const key = `${appearancePreviewKey(props.configuration)}:${JSON.stringify(props.catalogue)}`;
  return <AvatarPreviewRotation>{angle => <OwnedPreview key={key} {...props} angle={angle} />}</AvatarPreviewRotation>;
}
