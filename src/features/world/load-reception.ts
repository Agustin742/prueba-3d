import { type Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeResources } from './dispose-resources';

export interface ReceptionResource { scene: Group; dispose(): void }

/** Uncached authored room; this owner alone releases its GPU resources. */
export async function loadReception(): Promise<ReceptionResource> {
  const { scene } = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/rooms/reception.glb`);
  let disposed = false;
  return {
    scene,
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeResources([scene]);
    },
  };
}
