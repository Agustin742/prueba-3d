import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';

const TURN = Math.PI * 2;
const STEP = Math.PI / 4;
const wrap = (angle: number) => ((angle % TURN) + TURN) % TURN;
const buttonStyle = { minHeight: 44, padding: '4px 8px', borderRadius: 8,
  border: '1px solid #6C4D48', background: '#FFF9EB', color: '#382F3F', cursor: 'pointer' };

/** Only the dedicated preview camera moves; the framed avatar stays untouched. */
export function AvatarPreviewCamera({ angle }: { angle: number }) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const azimuth = Math.PI / 4 + angle;
    const radius = Math.hypot(4, 4);
    camera.position.set(radius * Math.sin(azimuth), 3.5, radius * Math.cos(azimuth));
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }, [camera, angle]);
  return null;
}

export function AvatarPreviewRotation({ children }: { children(angle: number): ReactNode }) {
  const [angle, setAngle] = useState(0);
  const drag = useRef<{ id: number; x: number } | null>(null);
  const turn = (delta: number) => setAngle(current => wrap(current + delta));
  return <div role="group" aria-label="Girar vista previa del avatar"
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}
    onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
    onPointerUp={event => event.stopPropagation()}
    style={{ position: 'relative', width: '100%', height: '100%', minWidth: 0 }}>
    <div data-testid="avatar-rotation-surface"
      style={{ height: '100%', touchAction: 'pan-y', cursor: 'grab' }}
      onPointerDown={event => {
        event.stopPropagation();
        if (!event.isPrimary || event.button !== 0 || drag.current) return;
        drag.current = { id: event.pointerId, x: event.clientX };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        event.stopPropagation();
        const previous = drag.current;
        if (!previous || previous.id !== event.pointerId) return;
        // One surface-width drag makes a full turn, independent of viewport size.
        const width = Math.max(event.currentTarget.getBoundingClientRect().width, 1);
        turn((event.clientX - previous.x) / width * TURN);
        previous.x = event.clientX;
      }}
      onPointerUp={event => {
        event.stopPropagation();
        if (drag.current?.id !== event.pointerId) return;
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}>
      {children(angle)}
    </div>
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex',
      flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
      <p style={{ flexBasis: '100%', textAlign: 'center', margin: 0, fontSize: '.75rem' }}>
        Arrastrá para girar · 360°
      </p>
      <button style={buttonStyle} type="button" aria-label="Girar a la izquierda" onClick={() => turn(-STEP)}>↶ Izquierda</button>
      <button style={buttonStyle} type="button" aria-label="Restablecer vista" onClick={() => setAngle(0)}>Restablecer</button>
      <button style={buttonStyle} type="button" aria-label="Girar a la derecha" onClick={() => turn(STEP)}>Derecha ↷</button>
    </div>
  </div>;
}
