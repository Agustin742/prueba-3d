import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import {
  AnimationMixer,
  Box3,
  CanvasTexture,
  Group,
  MathUtils,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';

export function turnTowardsAngle(current: number, target: number, step: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return Math.abs(diff) <= step ? target : current + Math.sign(diff) * step;
}

function createNameTagSprite(name: string, bgColor = 'rgba(20, 24, 30, 0.75)') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(8, 8, 240, 48, 12);
    } else {
      ctx.rect(8, 8, 240, 48);
    }
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);
  }

  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new Sprite(material);
  sprite.scale.set(1.4, 0.35, 1);
  sprite.position.y = 2.2;
  return sprite;
}

export interface RemotePlayerProps {
  nickname: string;
  position: [number, number, number];
  rotation: number;
  animation?: string;
}

export function RemotePlayer({ nickname, position, rotation, animation }: RemotePlayerProps) {
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
    const walkClip = animations.find(clip => clip.name === 'Walk' || clip.name.toLowerCase() === 'run');

    const acts = {
      idle: idleClip ? mx.clipAction(idleClip) : null,
      walk: walkClip ? mx.clipAction(walkClip) : null,
    };

    if (acts.idle) acts.idle.play();

    const nameTag = createNameTagSprite(nickname || 'Compañero');
    clone.add(nameTag);

    return { player: clone, mixer: mx, actions: acts };
  }, [scene, animations, nickname]);

  const currentActionRef = useRef(actions.idle);

  useEffect(() => {
    root.add(player);
    root.position.set(position[0], 0, position[2]);
    return () => {
      root.remove(player);
      mixer.stopAllAction();
      mixer.uncacheRoot(player);
    };
  }, [player, root, mixer, position]);

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
    if (nextAction && nextAction !== currentActionRef.current) {
      currentActionRef.current?.fadeOut(0.2);
      nextAction.reset().fadeIn(0.2).play();
      currentActionRef.current = nextAction;
    }

    mixer.update(Math.min(delta, 0.1));
  });

  return <primitive object={root} />;
}

