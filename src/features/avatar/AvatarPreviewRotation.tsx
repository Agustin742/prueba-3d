import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
const TURN = Math.PI * 2;
/** Rotate only the preview camera, never the original rig or controller. */
export function AvatarPreviewCamera({ angle }: { angle: number }) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const azimuth = Math.PI / 4 + angle, radius = Math.hypot(4, 4);
    camera.position.set(radius * Math.sin(azimuth), 3.5, radius * Math.cos(azimuth));
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  }, [camera, angle]);
  return null;
}
export function AvatarPreviewRotation({ children }: { children(angle: number): ReactNode }) {
  const [angle, setAngle] = useState(0);
  const drag = useRef<{ id: number; x: number } | null>(null);
  const turn = (delta: number) => setAngle(current => ((current + delta) % TURN + TURN) % TURN);
  return <div role="group" aria-label="Girar vista previa del avatar" tabIndex={0}
    aria-description="Arrastrá para girar. Con teclado: flechas izquierda y derecha; Inicio para restablecer."
    style={{ width: '100%', height: '100%', minWidth: 0 }}
    onBlur={() => { drag.current = null; }}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.target !== event.currentTarget || document.activeElement !== event.currentTarget) return;
      if (['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'Home') setAngle(0);
        else turn(event.key === 'ArrowLeft' ? -Math.PI / 4 : Math.PI / 4);
      }
    }} onKeyUp={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <div data-testid="avatar-rotation-surface" style={{ height: '100%', touchAction: 'pan-y', cursor: 'grab' }}
      onPointerDown={event => {
        event.stopPropagation();
        if (!event.isPrimary || event.button !== 0 || drag.current) return;
        drag.current = { id: event.pointerId, x: event.clientX };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event => {
        const previous = drag.current;
        if (!previous || previous.id !== event.pointerId) return;
        event.stopPropagation();
        turn((event.clientX - previous.x) / Math.max(event.currentTarget.getBoundingClientRect().width, 1) * TURN);
        previous.x = event.clientX;
      }} onPointerUp={event => {
        event.stopPropagation();
        if (drag.current?.id !== event.pointerId) return;
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      {children(angle)}
    </div>
  </div>;
}
