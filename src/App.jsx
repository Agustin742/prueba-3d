import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { moveWithCollisions, turnTowardsAngle } from './movement.js';
import { RemotePlayer } from './RemotePlayer.jsx';
import { ChatOverlay } from './ChatOverlay.jsx';
import { socket } from './socket.js';

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

function Player({ nickname, onNearChange, onInteract, onMove }) {
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

    const nameTag = createNameTagSprite(nickname || 'Yo', 'rgba(43, 61, 54, 0.85)');
    clone.add(nameTag);

    return clone;
  }, [scene, nickname]);

  const idleClip = useMemo(() => animations.find((clip) => clip.name.toLowerCase() === 'idle'), [animations]);
  const runClip = useMemo(() => animations.find((clip) => clip.name.toLowerCase() === 'run'), [animations]);
  const animationController = useRef(null);
  const keys = useRef(new Set());
  const nearBookcase = useRef(false);
  const interactRef = useRef(onInteract);
  interactRef.current = onInteract;

  const lastSendTime = useRef(0);
  const wasMoving = useRef(false);

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
      // Don't capture movement if typing in an input
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }
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

      const now = performance.now();
      if (now - lastSendTime.current > 50) {
        lastSendTime.current = now;
        onMove?.([position.x, position.y, position.z], player.rotation.y, 'run');
      }
    } else if (wasMoving.current) {
      onMove?.([position.x, position.y, position.z], player.rotation.y, 'idle');
    }
    wasMoving.current = moving;

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

function Room({ nickname, remotePlayers, onNearChange, onInteract, onMove }) {
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

      {/* Local Player */}
      <Player nickname={nickname} onNearChange={onNearChange} onInteract={onInteract} onMove={onMove} />

      {/* Remote Players */}
      {Object.values(remotePlayers).map((rp) => (
        <RemotePlayer
          key={rp.id}
          nickname={rp.nickname}
          position={rp.position}
          rotation={rp.rotation}
          animation={rp.animation}
        />
      ))}
    </>
  );
}

export default function App() {
  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState('');
  const [remotePlayers, setRemotePlayers] = useState({});
  const [messages, setMessages] = useState([]);

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

  useEffect(() => {
    socket.on('room-joined', ({ players, messages: history }) => {
      const playersMap = {};
      players.forEach((p) => {
        playersMap[p.id] = p;
      });
      setRemotePlayers(playersMap);
      if (history) setMessages(history);
    });

    socket.on('player-joined', (player) => {
      setRemotePlayers((prev) => ({ ...prev, [player.id]: player }));
    });

    socket.on('player-moved', (data) => {
      setRemotePlayers((prev) => {
        if (!prev[data.id]) return prev;
        return {
          ...prev,
          [data.id]: {
            ...prev[data.id],
            position: data.position,
            rotation: data.rotation,
            animation: data.animation,
          },
        };
      });
    });

    socket.on('player-left', ({ id }) => {
      setRemotePlayers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });

    socket.on('chat-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off('room-joined');
      socket.off('player-joined');
      socket.off('player-moved');
      socket.off('player-left');
      socket.off('chat-message');
    };
  }, []);

  const handleJoin = (name) => {
    setNickname(name);
    setJoined(true);
    socket.connect();
    socket.emit('join-room', {
      roomCode: 'global',
      nickname: name,
    });
  };

  const handleSendMessage = (content) => {
    socket.emit('chat-message', { content });
  };

  const handleMove = useCallback((position, rotation, animation) => {
    socket.emit('player-move', { position, rotation, animation });
  }, []);

  const onlineCount = Object.keys(remotePlayers).length + (joined ? 1 : 0);

  return (
    <main className="page-shell">
      <header className="room-header">
        <div>
          <p className="eyebrow">A small place to pause</p>
          <h1>A Quiet Corner</h1>
        </div>
        <p className="room-note">
          {joined ? `Conectado como ${nickname}` : 'Sala compartida en tiempo real'}
        </p>
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
            <Room
              nickname={nickname}
              remotePlayers={remotePlayers}
              onNearChange={handleNearChange}
              onInteract={handleInteract}
              onMove={handleMove}
            />
          </Suspense>
        </Canvas>

        {/* Modal & Chat Overlay */}
        <ChatOverlay
          joined={joined}
          onJoin={handleJoin}
          messages={messages}
          onSendMessage={handleSendMessage}
          onlineCount={onlineCount}
        />

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
