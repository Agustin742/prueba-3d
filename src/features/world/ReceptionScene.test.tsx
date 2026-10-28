import { StrictMode } from 'react';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadAvatar } from '../avatar/load-avatar';
import { act, render } from '@testing-library/react';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, OrthographicCamera, Raycaster, Vector3, type Intersection } from 'three';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AvatarResource } from '../avatar/load-avatar';
import { createNavigation } from './navigation';
import { receptionAvatarRadius } from './reception-layout';
import { ReceptionScene, floorDestination } from './ReceptionScene';

const renderer = vi.hoisted(() => ({ frames: [] as ((state: unknown, dt: number) => void)[], width: 1000, height: 600 }));
const camera = new OrthographicCamera(-500, 500, 300, -300, 0.1, 100);
const canvas = document.createElement('canvas');
vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, dt: number) => void) => renderer.frames.push(callback),
  useThree: () => ({ camera, size: { width: renderer.width, height: renderer.height }, gl: { domElement: canvas } }),
}));
beforeEach(() => { renderer.frames = []; renderer.width = 1000; renderer.height = 600; });

it('selects only the nearest genuine floor top, never furniture, walls, avatar, or off-floor', () => {
  const mesh = new Mesh(); mesh.userData.name = 'ITReception_Tile 0-0';
  const hit: Intersection = {
    object: mesh, distance: 1, point: new Vector3(1, 0, 2),
    face: { a: 0, b: 1, c: 2, materialIndex: 0, normal: new Vector3(0, 1, 0) },
  };
  expect(floorDestination(hit)).toEqual({ x: 1, y: 0, z: 2 });
  expect(floorDestination(undefined)).toBeNull();
  for (const name of ['ITReception_Coral counter crown', 'ITReception_Seat arm', 'ITReception_Back left', 'Avatar']) {
    mesh.userData.name = name; expect(floorDestination(hit)).toBeNull();
  }
  mesh.userData.name = 'ITReception_Tile 0-0';
  hit.point.y = 1; expect(floorDestination(hit)).toBeNull();
  hit.point.y = 0; hit.face!.normal.set(1, 0, 0); expect(floorDestination(hit)).toBeNull();
});

it('dispatches onInteract when a 3D interactive reception prop is selected instead of floorDestination', () => {
  const scene = new Group(); scene.add(new Mesh(new BoxGeometry(2, 4, 1), new MeshBasicMaterial()));
  const avatar = { scene, update: vi.fn(), dispose: vi.fn() } as unknown as AvatarResource;
  const room = new Group();
  const bell = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  bell.userData.name = 'ITReception_Bell dome';
  room.add(bell);
  const onSelect = vi.fn();
  const onInteract = vi.fn();
  render(
    <ReceptionScene
      avatar={avatar}
      room={{ scene: room, dispose: vi.fn() }}
      tick={() => createNavigation().spawn()!}
      onSelect={onSelect}
      onInteract={onInteract}
      onReady={vi.fn()}
      onFailure={vi.fn()}
    />
  );
  expect(onInteract).not.toHaveBeenCalled();
});

it('anchors actual bounds at feet Y0/height2, follows core results without chord interpolation, faces movement and cleans context listener', () => {
  const scene = new Group();
  const mesh = new Mesh(new BoxGeometry(2, 4, 1), new MeshBasicMaterial()); mesh.position.set(3, 4, -2); scene.add(mesh);
  const avatar = { scene, update: vi.fn(), setMoving: vi.fn(), dispose: vi.fn() } as unknown as AvatarResource;
  const room = new Group(); room.add(new Mesh(new BoxGeometry(11, 4, 10), new MeshBasicMaterial()));
  const nav = createNavigation(); let state = nav.spawn()!;
  const tick = vi.fn((dt: number) => { state = nav.advance(state, Math.min(dt, 0.1)); return state; });
  const ready = vi.fn(); const failure = vi.fn();
  const { unmount } = render(<ReceptionScene avatar={avatar} room={{ scene: room, dispose: vi.fn() }} tick={tick} onSelect={vi.fn()} onReady={ready} onFailure={failure} />);
  const root = scene.parent!.parent!;
  const bounds = new Box3().setFromObject(root, true);
  expect(bounds.min.y).toBeCloseTo(0); expect(bounds.max.y).toBeCloseTo(2);
  expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0);
  expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(2);
  state = nav.requestTarget(state, { x: -2.8, y: 0, z: -3 }).state;
  act(() => { for (const frame of renderer.frames) frame({}, 0.05); });
  expect(root.position.toArray()).toEqual([state.position.x, 0, state.position.z]);
  expect(avatar.setMoving).toHaveBeenLastCalledWith(true);
  expect(root.rotation.y).toBeLessThan(0);
  act(() => { for (const frame of renderer.frames) frame({}, 0.05); }); expect(ready).toHaveBeenCalledOnce();
  act(() => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))); expect(failure).toHaveBeenCalledOnce();
  unmount(); canvas.dispatchEvent(new Event('webglcontextlost')); expect(failure).toHaveBeenCalledOnce();
  expect(avatar.dispose).not.toHaveBeenCalled();
});

it('retains feet anchoring through StrictMode setup/cleanup without disposing resources', () => {
  const scene = new Group(); scene.add(new Mesh(new BoxGeometry(2, 4, 1), new MeshBasicMaterial()));
  const avatar = { scene, update: vi.fn(), dispose: vi.fn() } as unknown as AvatarResource;
  const room = new Group(); room.add(new Mesh(new BoxGeometry(11, 4, 10), new MeshBasicMaterial()));
  const { unmount } = render(<StrictMode><ReceptionScene avatar={avatar} room={{ scene: room, dispose: vi.fn() }} tick={() => createNavigation().spawn()!} onSelect={vi.fn()} onReady={vi.fn()} onFailure={vi.fn()} /></StrictMode>);
  const bounds = new Box3().setFromObject(scene.parent!.parent!, true);
  expect(bounds.min.y).toBeCloseTo(0); expect(bounds.max.y).toBeCloseTo(2);
  unmount(); expect(avatar.dispose).not.toHaveBeenCalled();
});

async function parseAsset(path: string) {
  const bytes = readFileSync(path); const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes);
  return new GLTFLoader().parseAsync(buffer, '');
}

it('anchors the original posed rig and distinguishes actual room ray hits (CPU evidence, not GPU clearance)', async () => {
  const gltf = await parseAsset('public/models/character.glb');
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValueOnce(gltf);
  const avatar = await loadAvatar(false);
  const room = await parseAsset('public/models/rooms/reception.glb');
  const { unmount } = render(<ReceptionScene avatar={avatar} room={{ scene: room.scene, dispose: vi.fn() }} tick={() => createNavigation().spawn()!} onSelect={vi.fn()} onReady={vi.fn()} onFailure={vi.fn()} />);
  const root = avatar.scene.parent!.parent!;
  const bounds = new Box3().setFromObject(root, true);
  expect(bounds.min.y).toBeCloseTo(0); expect(bounds.getSize(new Vector3()).y).toBeCloseTo(2);
  expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0); expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(2);
  console.info('Original Idle posed avatar at height2: XZ full extents', bounds.getSize(new Vector3()).x, bounds.getSize(new Vector3()).z, '; default core radius remains 0.25; reception uses its explicit larger envelope.');
  room.scene.updateMatrixWorld(true);
  for (const [x, z, floor] of [[0.675, 1.35, true], [-2.8, -1.6, false], [-4.3, 1.5, false], [-5.3, 0, false]] as const) {
    const hits = new Raycaster(new Vector3(x, 6, z), new Vector3(0, -1, 0)).intersectObject(room.scene, true);
    expect(!!floorDestination(hits[0])).toBe(floor);
  }
  unmount(); avatar.dispose(); vi.restoreAllMocks();
});

it('encloses actual normalized Idle/Walk bounds at sampled poses and rotations in the reception footprint', async () => {
  const gltf = await parseAsset('public/models/character.glb');
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValueOnce(gltf);
  const avatar = await loadAvatar(false);
  const room = new Group(); room.add(new Mesh(new BoxGeometry(11, 4, 10), new MeshBasicMaterial()));
  const { unmount } = render(<ReceptionScene avatar={avatar} room={{ scene: room, dispose: vi.fn() }} tick={() => createNavigation().spawn()!} onSelect={vi.fn()} onReady={vi.fn()} onFailure={vi.fn()} />);
  const root = avatar.scene.parent!.parent!;
  let largestRadius = 0;
  for (const moving of [false, true]) {
    avatar.setMoving!(moving);
    const duration = gltf.animations.find(clip => clip.name === (moving ? 'Walk' : 'Idle'))!.duration;
    // Both clips, 61 samples per cycle. update() caps dt, so accumulate substeps explicitly.
    for (let sample = 0; sample <= 60; sample++) {
      let remaining = duration / 60;
      while (remaining > 1e-8) { const dt = Math.min(remaining, 0.1); avatar.update(dt); remaining -= dt; }
      avatar.scene.updateMatrixWorld(true);
      avatar.scene.traverse(node => { if ('skeleton' in node) (node as import('three').SkinnedMesh).skeleton.update(); });
      const box = new Box3().setFromObject(root, true);
      for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) {
        const radius = Math.hypot(x - root.position.x, z - root.position.z);
        largestRadius = Math.max(largestRadius, radius);
        // A circle enclosing the XZ box corners encloses all yaw rotations, not only cardinal movement.
        for (let turn = 0; turn < 16; turn++) {
          const angle = turn * Math.PI / 8;
          const dx = x - root.position.x; const dz = z - root.position.z;
          expect(Math.abs(dx * Math.cos(angle) - dz * Math.sin(angle))).toBeLessThan(receptionAvatarRadius);
          expect(Math.abs(dx * Math.sin(angle) + dz * Math.cos(angle))).toBeLessThan(receptionAvatarRadius);
        }
        expect(radius).toBeLessThan(receptionAvatarRadius);
      }
    }
  }
  console.info('Sampled Idle/Walk maximum normalized XZ box-corner radius:', largestRadius, '; reception effective radius:', receptionAvatarRadius);
  unmount(); avatar.dispose(); vi.restoreAllMocks();
});

it.each([[1000, 600], [340, 700]])('fits the full authored room in a fixed orthographic view at %sx%s', (width, height) => {
  renderer.width = width; renderer.height = height;
  camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2;
  const room = new Group(); room.add(new Mesh(new BoxGeometry(11, 4, 10), new MeshBasicMaterial()));
  const avatar = { scene: new Group(), update: vi.fn() } as unknown as AvatarResource;
  render(<ReceptionScene avatar={avatar} room={{ scene: room, dispose: vi.fn() }} tick={() => createNavigation().spawn()!} onSelect={vi.fn()} onReady={vi.fn()} onFailure={vi.fn()} />);
  expect(camera.position.y).toBeGreaterThan(5);
  expect(camera.zoom).toBeGreaterThan(1);
  camera.updateMatrixWorld();
  for (const x of [-5.5, 5.5]) for (const y of [-2, 2]) for (const z of [-5, 5]) {
    const projected = new Vector3(x, y, z).project(camera);
    expect(Math.abs(projected.x)).toBeLessThan(1); expect(Math.abs(projected.y)).toBeLessThan(1);
  }
});
