import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { AvatarScene } from './AvatarScene';
import { loadAvatar, type AvatarResource } from './load-avatar';

function WebGLFailure() {
  return <p role="alert">WebGL preview unavailable. Enable hardware acceleration or try another browser, then reload.</p>;
}

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <WebGLFailure /> : this.props.children; }
}

function PreviewContent() {
  const [avatar, setAvatar] = useState<AvatarResource>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'asset-error' | 'webgl-error'>('loading');
  const ready = useCallback(() => setStatus(current => current === 'loading' ? 'ready' : current), []);
  const failed = useCallback(() => setStatus('webgl-error'), []);

  useEffect(() => {
    let active = true;
    let owned: AvatarResource | undefined;
    // Canvas fallback content is not a WebGL capability check: it also mounts in supported browsers.
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      if (!context) { failed(); return; }
      context.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { failed(); return; }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    loadAvatar(reduced).then(resource => {
      if (!active) { resource.dispose(); return; }
      owned = resource;
      setAvatar(resource);
    }).catch(() => { if (active) setStatus('asset-error'); });
    // GLTFLoader downloads cannot be aborted here; obsolete results are disposed, never mounted.
    return () => { active = false; owned?.dispose(); };
  }, [failed]);

  if (status === 'asset-error') return <p role="alert">The original avatar could not be loaded. Check the local model file and reload.</p>;
  if (status === 'webgl-error') return <WebGLFailure />;
  return (
    <>
      <p role="status">{status === 'ready' ? 'Original avatar preview ready.' : 'Loading original avatar and preparing WebGL…'}</p>
      <div className="preview" role="img" aria-label="Original avatar calibration preview, elevated three-quarter view">
        {avatar && <Canvas orthographic camera={{ position: [4, 3.5, 4], zoom: 100 }} dpr={[1, 1.5]}>
          <AvatarScene avatar={avatar} onReady={ready} onFailure={failed} />
        </Canvas>}
      </div>
    </>
  );
}

export function AvatarPreview() {
  return <PreviewBoundary><PreviewContent /></PreviewBoundary>;
}
