import { InstancedMesh, type Group } from 'three';
import { composeRoom } from './compose-room';
import { loadRoomModules } from './load-room-modules';
import { receptionRoom } from './reception-room';
import type { RoomDefinition } from './room-definition';

export interface ReceptionResource { scene: Group; dispose(): void }

/** Uncached reception composed from its module GLBs; clones and instances share template resources, so this owner alone releases them. */
export async function loadReception(definition: RoomDefinition = receptionRoom): Promise<ReceptionResource> {
  const modules = await loadRoomModules(definition.placements.map(placement => placement.module));
  const scene = composeRoom(definition, modules.templates);
  let disposed = false;
  return {
    scene,
    dispose() {
      if (disposed) return;
      disposed = true;
      // InstancedMesh.dispose() only frees its own instance buffer; geometry and materials belong to the templates.
      scene.traverse(node => { if (node instanceof InstancedMesh) node.dispose(); });
      modules.dispose();
    },
  };
}
