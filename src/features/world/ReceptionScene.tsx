import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Box3, Group, OrthographicCamera, SkinnedMesh, Vector3, type Intersection, type Object3D } from 'three';
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
  onSelectAvatar?(targetNickname: string): void;
  onReady(): void;
  onFailure(): void;
  nickname?: string;
  bubbleText?: string | null;
  bubbles?: Record<string, string>;
  remotePlayers?: Record<string, PlayerState>;
  onAvatarMove?(position: [number, number, number], rotation: number, animation: string): void;
}

/** Resolve whether a 3D raycast intersection hit a remote or reception avatar. */
export function avatarInteractionTarget(hit?: Intersection): string | null {
  if (!hit) return null;
  let current: Object3D | null = hit.object;
  while (current) {
    if (current.userData?.isAvatar && typeof current.userData.avatarNickname === 'string' && current.userData.avatarNickname.length > 0) {
      return current.userData.avatarNickname;
    }
    if (current.name === 'reception-avatar-root') {
      return typeof current.userData?.avatarNickname === 'string' && current.userData.avatarNickname.length > 0
        ? current.userData.avatarNickname
        : 'Recepción';
    }
    current = current.parent;
  }
  return null;
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
  onSelectAvatar,
  onReady,
  onFailure,
  nickname,
  bubbleText,
  bubbles,
  remotePlayers,
  onAvatarMove,
}: ReceptionSceneProps) {
  useSceneLifecycle(onReady, onFailure);
  const { camera, size, gl } = useThree();
  const root = useMemo(() => new Group(), [avatar]);
  const lastSendTime = useRef(0);
  const wasMoving = useRef(false);

  // Zoom control state: 1.0 is full-room limit, up to 2.4x close-up
  const minZoomRef = useRef(1);
  const zoomFactorRef = useRef(1);

  // Attach billboard (name + chat bubble) to local avatar root
  useEffect(() => {
    root.userData = { ...root.userData, isAvatar: true, avatarNickname: nickname || 'Recepción' };
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
    const baseZoom = 0.9 * Math.min(size.width / Math.max(span.x, 1), size.height / Math.max(span.y, 1));
    minZoomRef.current = baseZoom;
    camera.zoom = baseZoom * zoomFactorRef.current;
    camera.updateProjectionMatrix();
  }, [camera, room, size.width, size.height]);

  // Mouse wheel zoom & mobile pinch-to-zoom
  useEffect(() => {
    const dom = gl?.domElement;
    if (!dom || !(camera instanceof OrthographicCamera)) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = -event.deltaY * 0.0012;
      // Clamped between 1.0 (authored room limit) and 2.4 (close-up)
      zoomFactorRef.current = Math.min(2.4, Math.max(1.0, zoomFactorRef.current + delta));
      camera.zoom = minZoomRef.current * zoomFactorRef.current;
      camera.updateProjectionMatrix();
    };

    let initialPinchDistance = 0;
    let initialZoomFactor = 1.0;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        initialPinchDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        initialZoomFactor = zoomFactorRef.current;
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && initialPinchDistance > 0) {
        event.preventDefault();
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        const ratio = currentDistance / initialPinchDistance;
        zoomFactorRef.current = Math.min(2.4, Math.max(1.0, initialZoomFactor * ratio));
        camera.zoom = minZoomRef.current * zoomFactorRef.current;
        camera.updateProjectionMatrix();
      }
    };

    const handleTouchEnd = () => {
      initialPinchDistance = 0;
    };

    dom.addEventListener('wheel', handleWheel, { passive: false });
    dom.addEventListener('touchstart', handleTouchStart, { passive: true });
    dom.addEventListener('touchmove', handleTouchMove, { passive: false });
    dom.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      dom.removeEventListener('wheel', handleWheel);
      dom.removeEventListener('touchstart', handleTouchStart);
      dom.removeEventListener('touchmove', handleTouchMove);
      dom.removeEventListener('touchend', handleTouchEnd);
    };
  }, [camera, gl]);

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
    const avatarTarget = avatarInteractionTarget(event.intersections[0]);
    if (avatarTarget && onSelectAvatar) {
      onSelectAvatar(avatarTarget);
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
