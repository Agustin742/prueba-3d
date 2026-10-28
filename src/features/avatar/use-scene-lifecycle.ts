import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

export function useSceneLifecycle(onReady: () => void, onFailure: () => void): void {
  const { gl } = useThree();
  const frames = useRef(0);
  useFrame(() => {
    // The second tick follows a completed default R3F render, not just a download.
    if (frames.current === 1) onReady();
    frames.current = Math.min(2, frames.current + 1);
  });
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onFailure(); };
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => gl.domElement.removeEventListener('webglcontextlost', lost);
  }, [gl, onFailure]);
}
