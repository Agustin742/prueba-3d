import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import {
  AnimationMixer,
  Box3,
  Group,
  MathUtils,
  SkinnedMesh,
  Vector3,
} from 'three';
import { createAvatarBillboard } from './AvatarBillboard';
import { ConfiguredRemotePlayer } from './ConfiguredRemotePlayer';
import type { AvatarConfiguration } from '../avatar/AvatarCustomizer';

export function turnTowardsAngle(current: number, target: number, step: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return Math.abs(diff) <= step ? target : current + Math.sign(diff) * step;
}

export interface RemotePlayerProps {
  appearance?: AvatarConfiguration;
  nickname: string;
  position: [number, number, number];
  rotation: number;
  animation?: string;
  bubbleText?: string | null;
}

export function RemotePlayer(props: RemotePlayerProps) {
  if (props.appearance === undefined) return <LegacyRemotePlayer {...props} />;
  return <ConfiguredRemotePlayer {...props} fallback={
    <LegacyRemotePlayer {...props} nickname={`${props.nickname || 'Compañero'} (apariencia no disponible)`} />
  } />;
}

function LegacyRemotePlayer({ nickname, position, rotation, animation, bubbleText }: RemotePlayerProps) {
  const { scene, animations } = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/character.glb`);
  const root = useMemo(() => new Group(), []);

  const { player, mixer, actions } = useMemo(() => {
    const clone = cloneSkinned(scene);
    const bounds = new Box3().setFromObject(clone);
    const dimensions = bounds.getSize(new Vector3());
    const height = dimensions.y;
    const scale = height > 0 ? 2 / height : 1;
    clone.scale.setScalar(scale);

    const scaledBounds = new Box3().setFromObject(clone);
    clone.position.y -= scaledBounds.min.y;

    const mx = new AnimationMixer(clone);
    const idleClip = animations.find(clip => clip.name === 'Idle' || clip.name.toLowerCase() === 'idle');
    const walkClip = animations.find(clip => clip.name === 'Walk' || clip.name.toLowerCase() === 'walk');

    const acts = {
      idle: idleClip ? mx.clipAction(idleClip) : null,
      walk: walkClip ? mx.clipAction(walkClip) : null,
    };

    if (acts.idle) {
      acts.idle.play();
    }

    clone.traverse(node => {
      if (node instanceof SkinnedMesh) {
        node.skeleton.update();
      }
    });

    return { player: clone, mixer: mx, actions: acts };
  }, [scene, animations]);

  // Manage billboard sprite (name + bubble) attached to root
  useEffect(() => {
    const billboard = createAvatarBillboard(nickname || 'Compañero', bubbleText, false);
    root.add(billboard);
    return () => {
      root.remove(billboard);
      billboard.material.map?.dispose();
      billboard.material.dispose();
    };
  }, [nickname, bubbleText, root]);

  const currentActionRef = useRef(actions.idle);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    root.add(player);
    if (!isInitializedRef.current) {
      root.position.set(position[0], 0, position[2]);
      if (typeof rotation === 'number') {
        root.rotation.y = rotation;
      }
      isInitializedRef.current = true;
    }
    return () => {
      root.remove(player);
      mixer.stopAllAction();
      mixer.uncacheRoot(player);
    };
  }, [player, root, mixer]);

  useFrame((_, delta) => {
    // Smoothly interpolate position towards target
    root.position.x = MathUtils.lerp(root.position.x, position[0], 0.25);
    root.position.z = MathUtils.lerp(root.position.z, position[2], 0.25);

    // Turn smoothly towards target angle
    if (typeof rotation === 'number') {
      root.rotation.y = turnTowardsAngle(root.rotation.y, rotation, delta * 8);
    }

    const isMoving = animation === 'run' || animation === 'walk';
    const nextAction = isMoving ? actions.walk : actions.idle;
    if (nextAction && (!nextAction.isRunning() || nextAction !== currentActionRef.current)) {
      if (currentActionRef.current && currentActionRef.current !== nextAction) {
        currentActionRef.current.fadeOut(0.2);
      }
      nextAction.reset().fadeIn(0.2).play();
      currentActionRef.current = nextAction;
    }

    mixer.update(Math.min(delta, 0.1));
  });

  return <primitive object={root} />;
}
