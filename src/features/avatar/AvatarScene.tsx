import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, Vector3 } from 'three';
import type { AvatarResource } from './load-avatar';
import { useSceneLifecycle } from './use-scene-lifecycle';

interface AvatarSceneProps {
  avatar: AvatarResource;
  onReady(): void;
  onFailure(): void;
}

export function AvatarScene({ avatar, onReady, onFailure }: AvatarSceneProps) {
  useSceneLifecycle(onReady, onFailure);
  useFrame((_, delta) => avatar.update(delta));
  const framing = useMemo(() => {
    const bounds = new Box3().setFromObject(avatar.scene);
    const center = bounds.getCenter(new Vector3());
    const scale = 2 / Math.max(bounds.getSize(new Vector3()).y, 0.001);
    return { scale, offset: center.multiplyScalar(-1) };
  }, [avatar]);

  return (
    <>
      <hemisphereLight args={['#A9E7F4', '#B5A7D6', 2]} />
      <directionalLight position={[3, 5, 4]} color="#FFF0D8" intensity={3} />
      {/* Navigation can move this outer group without changing the resource owner. */}
      <group name="avatar-root" dispose={null}>
        <group scale={framing.scale}>
          <primitive object={avatar.scene} position={framing.offset} />
        </group>
      </group>
    </>
  );
}
