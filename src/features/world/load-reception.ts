import { Mesh, Texture, type Group, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
      const geometries = new Set<Mesh['geometry']>();
      const materials = new Set<Material>();
      const textures = new Set<Texture>();
      scene.traverse(node => {
        if (!(node instanceof Mesh)) return;
        geometries.add(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
        }
      });
      geometries.forEach(value => value.dispose());
      materials.forEach(value => value.dispose());
      textures.forEach(value => value.dispose());
    },
  };
}
