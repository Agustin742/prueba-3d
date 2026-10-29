import { Group } from 'three';
import type { RoomDefinition } from './room-definition';
import type { RoomModuleId } from './room-modules';

/** Clones share geometry and materials with the templates, so disposal stays with the template owner. */
export function composeRoom(definition: RoomDefinition, templates: ReadonlyMap<RoomModuleId, Group>): Group {
  const room = new Group();
  for (const { module, position, yaw = 0 } of definition.placements) {
    const template = templates.get(module);
    if (!template) throw new Error(`Missing room module template: ${module}`);
    const piece = template.clone();
    piece.position.set(...position); piece.rotation.y = yaw;
    room.add(piece);
  }
  return room;
}
