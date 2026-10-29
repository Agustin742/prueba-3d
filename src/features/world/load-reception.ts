import { type Group } from 'three';
import { composeRoom } from './compose-room';
import { loadRoomModules } from './load-room-modules';
import { receptionRoom } from './reception-room';

export interface ReceptionResource { scene: Group; dispose(): void }

/** Uncached reception composed from its module GLBs; clones share template resources, so this owner alone releases them. */
export async function loadReception(): Promise<ReceptionResource> {
  const modules = await loadRoomModules(receptionRoom.placements.map(placement => placement.module));
  return { scene: composeRoom(receptionRoom, modules.templates), dispose: modules.dispose };
}
