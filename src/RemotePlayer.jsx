import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { turnTowardsAngle } from './movement.js';

function createNameTagSprite(name, bgColor = 'rgba(20, 24, 30, 0.75)') {
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

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.4, 0.35, 1);
  sprite.position.y = 2.1;
  return sprite;
}

export function RemotePlayer({ nickname, position, rotation, animation }) {
  const { scene, animations } = useLoader(GLTFLoader, '/models/character.glb');
  const player = useMemo(() => {
    const clone = cloneSkinned(scene);
    const bounds = new THREE.Box3().setFromObject(clone);
    const dimensions = bounds.getSize(new THREE.Vector3());
    clone.scale.setScalar(1.85 / Math.max(dimensions.x, dimensions.y, dimensions.z));
    const scaledBounds = new THREE.Box3().setFromObject(clone);
    clone.position.y -= scaledBounds.min.y;
    clone.position.x = position[0];
    clone.position.z = position[2];
    clone.traverse((part) => {
      if (part.isMesh) {
        part.castShadow = true;
        part.receiveShadow = true;
      }
    });

    const nameTag = createNameTagSprite(nickname || 'Amigo');
    clone.add(nameTag);

    return clone;
  }, [scene, nickname]);

  const idleClip = useMemo(() => animations.find((clip) => clip.name.toLowerCase() === 'idle'), [animations]);
  const runClip = useMemo(() => animations.find((clip) => clip.name.toLowerCase() === 'run'), [animations]);
  const animationController = useRef(null);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(player);
    const actions = {
      idle: idleClip ? mixer.clipAction(idleClip) : null,
      run: runClip ? mixer.clipAction(runClip) : null,
    };
    if (actions.idle) actions.idle.play();
    animationController.current = { mixer, actions, currentAction: actions.idle };

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(player);
      animationController.current = null;
    };
  }, [idleClip, player, runClip]);

  useFrame((_, delta) => {
    // Smoothly interpolate position towards target
    player.position.x = THREE.MathUtils.lerp(player.position.x, position[0], 0.2);
    player.position.z = THREE.MathUtils.lerp(player.position.z, position[2], 0.2);

    // Turn smoothly towards target angle
    if (typeof rotation === 'number') {
      player.rotation.y = turnTowardsAngle(player.rotation.y, rotation, delta * 2);
    }

    const controller = animationController.current;
    if (controller) {
      const isRunning = animation === 'run';
      const nextAction = isRunning ? controller.actions.run : controller.actions.idle;
      if (nextAction && nextAction !== controller.currentAction) {
        controller.currentAction?.fadeOut(0.2);
        nextAction.reset().fadeIn(0.2).play();
        controller.currentAction = nextAction;
      }
      controller.mixer.update(delta);
    }
  });

  return <primitive object={player} />;
}
