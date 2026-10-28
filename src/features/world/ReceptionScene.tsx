import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Box3, Group, OrthographicCamera, SkinnedMesh, Vector3, type Intersection } from 'three';
import type { AvatarResource } from '../avatar/load-avatar';
import { useSceneLifecycle } from '../avatar/use-scene-lifecycle';
import type { ReceptionResource } from './load-reception';
import type { NavigationState, Point } from './navigation';
import { receptionInteractionTarget, type ReceptionInteractionId } from './reception-interactions';
import { RemotePlayer } from '../network/RemotePlayer';
import { createAvatarBillboard } from '../network/AvatarBillboard';
import type { PlayerState } from '../network/socket';

export interface ReceptionSceneProps {
  avatar: AvatarResource;
  room: ReceptionResource;
  tick(dt: number): NavigationState;
  onSelect(point: Point | null): void;
  onInteract?(id: ReceptionInteractionId): void;
  onReady(): void;
  onFailure(): void;
  nickname?: string;
  bubbleText?: string | null;
  bubbles?: Record<string, string>;
  remotePlayers?: Record<string, PlayerState>;
  onAvatarMove?(position: [number, number, number], rotation: number, animation: string): void;
}

/** Only the foremost actual tile top may become a floor intent. No furniture flattening. */
export function floorDestination(hit?: Intersection): Point | null {
  if (!hit || !/^ITReception_Tile \d+-\d+$/.test(hit.object.userData.name ?? '')
    || Math.abs(hit.point.y) > 0.015 || !hit.face) return null;
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  return normal.y > 0.99 ? { x: hit.point.x, y: 0, z: hit.point.z } : null;
}

export function ReceptionScene({
  avatar,
  room,
  tick,
  onSelect,
  onInteract,
  onReady,
  onFailure,
  nickname,
  bubbleText,
  bubbles,
  remotePlayers,
  onAvatarMove,
}: ReceptionSceneProps) {
  useSceneLifecycle(onReady, onFailure);
  const { camera, size } = useThree();
  const root = useMemo(() => new Group(), [avatar]);
  const lastSendTime = useRef(0);
  const wasMoving = useRef(false);

  // Attach billboard (name + chat bubble) to local avatar root
  useEffect(() => {
    if (!nickname) return;
    const billboard = createAvatarBillboard(nickname, bubbleText, true);
    root.add(billboard);
    return () => {
      root.remove(billboard);
      billboard.material.map?.dispose();
      billboard.material.dispose();
    };
  }, [nickname, bubbleText, root]);

  useLayoutEffect(() => {
    const originalPosition = avatar.scene.position.clone();
    avatar.update(0); // Evaluate the original clip before measuring skinned posed vertices.
    avatar.scene.updateMatrixWorld(true);
    avatar.scene.traverse(node => { if (node instanceof SkinnedMesh) node.skeleton.update(); });
    const bounds = new Box3().setFromObject(avatar.scene, true);
    const center = bounds.isEmpty() ? new Vector3() : bounds.getCenter(new Vector3());
    const height = bounds.getSize(new Vector3()).y;
    const frame = new Group();
    frame.scale.setScalar(height > 0 ? 2 / height : 1);
    avatar.scene.position.add(new Vector3(-center.x, bounds.isEmpty() ? 0 : -bounds.min.y, -center.z));
    frame.add(avatar.scene);
    root.name = 'reception-avatar-root'; root.add(frame);
    const { position } = tick(0); root.position.set(position.x, 0, position.z);
    return () => {
      frame.remove(avatar.scene); root.remove(frame);
      avatar.scene.position.copy(originalPosition);
      avatar.scene.updateMatrixWorld(true);
    };
  }, [avatar, root]);

  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    const bounds = new Box3().setFromObject(room.scene, true);
    const center = bounds.getCenter(new Vector3());
    camera.position.copy(center).add(new Vector3(14, 14, 14));
    camera.lookAt(center); camera.updateMatrixWorld(true);
    const viewBounds = new Box3();
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) viewBounds.expandByPoint(new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    }
    const span = viewBounds.getSize(new Vector3());
    camera.zoom = 0.9 * Math.min(size.width / Math.max(span.x, 1), size.height / Math.max(span.y, 1));
    camera.updateProjectionMatrix();
  }, [camera, room, size.width, size.height]);

  useFrame((_, delta) => {
    const { position } = tick(delta);
    const dx = position.x - root.position.x; const dz = position.z - root.position.z;
    const moving = Math.hypot(dx, dz) > 1e-8;
    if (moving) root.rotation.y = Math.atan2(dx, dz);
    root.position.set(position.x, 0, position.z);
    avatar.setMoving?.(moving); avatar.update(delta);

    if (onAvatarMove) {
      const now = performance.now();
      if (moving && now - lastSendTime.current > 50) {
        lastSendTime.current = now;
        onAvatarMove([position.x, 0, position.z], root.rotation.y, 'walk');
      } else if (!moving && wasMoving.current) {
        onAvatarMove([position.x, 0, position.z], root.rotation.y, 'idle');
      }
      wasMoving.current = moving;
    }
  });

  const select = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const interactionId = receptionInteractionTarget(event.intersections[0]);
    if (interactionId && onInteract) {
      onInteract(interactionId);
      return;
    }
    onSelect(floorDestination(event.intersections[0]));
  };

  return <>
    <hemisphereLight args={['#A9E7F4', '#B5A7D6', 2]} />
    <directionalLight position={[3, 8, 5]} color="#FFF0D8" intensity={3} />
    <group onPointerUp={select} dispose={null}>
      <primitive object={room.scene} dispose={null} />
      <primitive object={root} dispose={null} />
      {remotePlayers && Object.values(remotePlayers).map(rp => (
        <RemotePlayer
          key={rp.id}
          nickname={rp.nickname}
          position={rp.position}
          rotation={rp.rotation}
          animation={rp.animation}
          bubbleText={bubbles?.[rp.nickname]}
        />
      ))}
    </group>
  </>;
}
