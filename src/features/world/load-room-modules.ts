import { type Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeResources } from './dispose-resources';
import { roomModulePath, type RoomModuleId } from './room-modules';

export interface RoomModules { templates: ReadonlyMap<RoomModuleId, Group>; dispose(): void }

/** Uncached module templates; clones share their resources, so this owner alone releases them. */
export async function loadRoomModules(ids: readonly RoomModuleId[]): Promise<RoomModules> {
  const loader = new GLTFLoader();
  const unique = [...new Set(ids)];
  const scenes = await Promise.all(unique.map(async id => (await loader.loadAsync(`${import.meta.env.BASE_URL}${roomModulePath(id)}`)).scene));
  const templates = new Map(unique.map((id, index) => [id, scenes[index]!] as const));
  let disposed = false;
  return {
    templates,
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeResources(templates.values());
    },
  };
}
