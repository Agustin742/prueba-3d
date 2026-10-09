import React, { Suspense, useLayoutEffect, useMemo } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';

function FittedCamera() {
  const { camera, size } = useThree();

  useLayoutEffect(() => {
    camera.zoom = Math.min(size.width / 14, size.height / 10);
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

function Room() {
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
      <Model file="/models/loungeSofa.glb" position={[0.1, 0, -3.35]} size={2.8} rotation={Math.PI} />
      <Model file="/models/tableCoffee.glb" position={[0.1, 0, -1.4]} size={1.45} />
      <Model file="/models/character-female-a.glb" position={[0.25, 0, 1.55]} size={1.65} />
    </>
  );
}

export default function App() {
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
            <Room />
          </Suspense>
        </Canvas>
        <div className="canvas-caption" aria-hidden="true">A place for stories and stillness</div>
      </section>
      <footer className="page-footer">Take a moment. Look around.</footer>
    </main>
  );
}
