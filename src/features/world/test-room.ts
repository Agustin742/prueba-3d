import { readFileSync } from 'node:fs';
import type { Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { composeRoom } from './compose-room';
import { receptionRoom } from './reception-room';
import type { RoomDefinition } from './room-definition';
import { roomModulePath, type RoomModuleId } from './room-modules';

/** Test-only: parses a GLB from disk, no network or mocks. */
export async function parseGlb(path: string) {
  const bytes = readFileSync(path);
  const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes);
  return new GLTFLoader().parseAsync(buffer, '');
}

/** Test-only: module templates for a definition, read from the shipped module GLBs. */
export async function moduleTemplates(definition: Pick<RoomDefinition, 'placements'>) {
  const ids = [...new Set(definition.placements.map(placement => placement.module))];
  return new Map<RoomModuleId, Group>(await Promise.all(ids.map(async id => [id, (await parseGlb(`public/${roomModulePath(id)}`)).scene] as const)));
}

/** Test-only: a room (default: the real reception) composed from the shipped module GLBs. */
export async function composedReception(definition: RoomDefinition = receptionRoom) {
  return composeRoom(definition, await moduleTemplates(definition));
}
