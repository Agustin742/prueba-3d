import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { moveWithCollisions, turnTowardsAngle } from './movement.js';

function FittedCamera() {
  const { camera, size } = useThree();

  useLayoutEffect(() => {
    camera.zoom = Math.min(size.width / 15, size.height / 11);
    camera.position.set(11, 11.5, 12);
    camera.lookAt(0, 1.5, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return null;
}

function Model({ file, position, size, rotation = 0 }) {
  const { scene } = useLoader(GLTFLoader, file);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const dimensions = bounds.getSize(new THREE.Vector3());
    const scale = size / Math.max(dimensions.x, dimensions.y, dimensions.z);
    clone.scale.setScalar(scale);
    const scaledBounds = new THREE.Box3().setFromObject(clone);
    clone.position.y -= scaledBounds.min.y;
    clone.traverse((part) => {
      if (part.isMesh) {
        part.castShadow = true;
        part.receiveShadow = true;
      }
    });
    return clone;
  }, [scene, size]);

  return <primitive object={model} position={position} rotation={[0, rotation, 0]} />;
}

const BOOKCASE_POSITION = new THREE.Vector3(-3.8, 0, -3.5);
const MOVE_SPEED = 3.2;
const PLAYER_RADIUS = 0.32;
const ROOM_BOUNDS = { minX: -4, maxX: 4, minZ: -3, maxZ: 3 };
const FURNITURE_HITBOXES = [
  { minX: -3.8, maxX: -2.664, minZ: -4.21, maxZ: -3.5 },
  { minX: -0.35, maxX: 2.45, minZ: -2.55, maxZ: -1.379 },
  { minX: 1.439, maxX: 2.889, minZ: -1.458, maxZ: -0.581 },
];
const MOVEMENT_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']);

function Player({ onNearChange, onInteract }) {
  const { scene, animations } = useLoader(GLTFLoader, '/models/character.glb');
  const player = useMemo(() => {
    const clone = cloneSkinned(scene);
    const bounds = new THREE.Box3().setFromObject(clone);
    const dimensions = bounds.getSize(new THREE.Vector3());
    clone.scale.setScalar(1.85 / Math.max(dimensions.x, dimensions.y, dimensions.z));
    const scaledBounds = new THREE.Box3().setFromObject(clone);
    clone.position.y -= scaledBounds.min.y;
    clone.position.x = 0.25;
    clone.position.z = 1.55;
    clone.traverse((part) => {
      if (part.isMesh) {
        part.castShadow = true;
        part.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);
  const idleClip = useMemo(() => animations.find((clip) => clip.name.toLowerCase() === 'idle'), [animations]);
  const runClip = useMemo(() => animations.find((clip) => clip.name.toLowerCase() === 'run'), [animations]);
  const animationController = useRef(null);
  const keys = useRef(new Set());
  const nearBookcase = useRef(false);
  const interactRef = useRef(onInteract);
  interactRef.current = onInteract;

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

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (MOVEMENT_KEYS.has(key)) {
        event.preventDefault();
        keys.current.add(key);
      } else if (key === 'e' && nearBookcase.current && !event.repeat) {
        event.preventDefault();
        interactRef.current();
      }
    };
    const handleKeyUp = (event) => keys.current.delete(event.key.toLowerCase());
    const clearKeys = () => keys.current.clear();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearKeys);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearKeys);
      keys.current.clear();
    };
  }, []);

  useFrame((_, delta) => {
    const position = player.position;
    const pressed = keys.current;
    let horizontal = Number(pressed.has('d') || pressed.has('arrowright')) - Number(pressed.has('a') || pressed.has('arrowleft'));
    let vertical = Number(pressed.has('s') || pressed.has('arrowdown')) - Number(pressed.has('w') || pressed.has('arrowup'));
    const moving = horizontal !== 0 || vertical !== 0;

    if (moving) {
      const length = Math.hypot(horizontal, vertical);
      horizontal /= length;
      vertical /= length;
      // Controls follow the fixed camera: up moves toward the back of the room.
      const moveX = (horizontal + vertical) * Math.SQRT1_2;
      const moveZ = (vertical - horizontal) * Math.SQRT1_2;
      const nextPosition = moveWithCollisions(
        position,
        { x: moveX * MOVE_SPEED * delta, z: moveZ * MOVE_SPEED * delta },
        FURNITURE_HITBOXES,
        ROOM_BOUNDS,
        PLAYER_RADIUS,
      );
      position.x = nextPosition.x;
      position.z = nextPosition.z;
      const targetAngle = Math.atan2(moveX, moveZ);
      player.rotation.y = turnTowardsAngle(player.rotation.y, targetAngle, delta);
    }

    const controller = animationController.current;
    if (controller) {
      const nextAction = moving ? controller.actions.run : controller.actions.idle;
      if (nextAction && nextAction !== controller.currentAction) {
        controller.currentAction?.fadeOut(0.2);
        nextAction.reset().fadeIn(0.2).play();
        controller.currentAction = nextAction;
      }
      controller.mixer.update(delta);
    }

    const near = position.distanceTo(BOOKCASE_POSITION) < 1.35;
    if (near !== nearBookcase.current) {
      nearBookcase.current = near;
      onNearChange(near);
    }
  });

  return <primitive object={player} />;
}

function Room({ onNearChange, onInteract }) {
  const floorTexture = useLoader(THREE.TextureLoader, '/textures/wood-floor.jpg');
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(3, 2.5);
  floorTexture.colorSpace = THREE.SRGBColorSpace;

  return (
    <>
      <color attach="background" args={['#e9e7e0']} />
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#fff8e9', '#9b8d7c', 1.2]} />
      <directionalLight
        position={[-4, 9, 6]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial map={floorTexture} roughness={0.82} />
      </mesh>

      <mesh position={[0, 2, -4]} receiveShadow castShadow>
        <boxGeometry args={[10, 4, 0.22]} />
        <meshStandardMaterial color="#eee7db" roughness={0.94} />
      </mesh>
      <mesh position={[-5, 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.22, 4, 8]} />
        <meshStandardMaterial color="#e4ddd1" roughness={0.94} />
      </mesh>

      <Model file="/models/bookcaseOpen.glb" position={[-3.8, 0, -3.5]} size={2.5} />
      <Model file="/models/loungeSofa.glb" position={[2.45, 0, -2.55]} size={2.8} rotation={Math.PI} />
      <Model file="/models/tableCoffee.glb" position={[2.45, 0, -0.8]} size={1.45} />
      <Player onNearChange={onNearChange} onInteract={onInteract} />
    </>
  );
}

export default function App() {
  const [nearBookcase, setNearBookcase] = useState(false);
  const [message, setMessage] = useState('');
  const messageTimer = useRef();
  const handleInteract = useCallback(() => {
    setMessage('A little corner for stories.');
    window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(''), 4500);
  }, []);

  useEffect(() => () => window.clearTimeout(messageTimer.current), []);
  const handleNearChange = useCallback((near) => {
    setNearBookcase(near);
    if (!near) {
      setMessage('');
      window.clearTimeout(messageTimer.current);
    }
  }, []);

  return (
    <main className="page-shell">
      <header className="room-header">
        <div>
          <p className="eyebrow">A small place to pause</p>
          <h1>A Quiet Corner</h1>
        </div>
        <p className="room-note">A room in three dimensions</p>
      </header>
      <section className="room-frame" aria-label="Three-dimensional furnished room">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [11, 11.5, 12], near: 0.1, far: 100 }}
          orthographic
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <FittedCamera />
          <Suspense fallback={null}>
            <Room onNearChange={handleNearChange} onInteract={handleInteract} />
          </Suspense>
        </Canvas>
        <div
          className={`interaction-message${message ? ' interaction-result' : nearBookcase ? ' interaction-prompt' : ''}`}
          role="status"
          aria-live="polite"
        >
          {message ? (
            message
          ) : nearBookcase ? (
            <>
              <span className="sr-only">Press E to browse the bookcase</span>
              <span className="interaction-key" aria-hidden="true">E</span>
              <span aria-hidden="true">Browse the bookcase</span>
            </>
          ) : null}
        </div>
        <div className="canvas-caption" aria-hidden="true">A place for stories and stillness</div>
      </section>
      <footer className="page-footer">Move with WASD or the arrow keys. Approach the bookcase and press E.</footer>
    </main>
  );
}
