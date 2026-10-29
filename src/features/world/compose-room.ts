import { Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import type { Placement, RoomDefinition } from './room-definition';
import type { RoomModuleId } from './room-modules';

const up = new Vector3(0, 1, 0);
const one = [1, 1, 1] as const;

/**
 * Clones share geometry and materials with the templates, so disposal stays with the template owner.
 * Modules listed in `instanced` become one InstancedMesh per template mesh instead of one clone per placement.
 */
export function composeRoom(definition: Pick<RoomDefinition, 'placements' | 'instanced'>, templates: ReadonlyMap<RoomModuleId, Group>): Group {
  const room = new Group();
  const instanced = new Set(definition.instanced);
  const batches = new Map<RoomModuleId, Placement[]>();
  for (const placement of definition.placements) {
    if (!templates.has(placement.module)) throw new Error(`Missing room module template: ${placement.module}`);
    if (instanced.has(placement.module)) { batches.set(placement.module, [...batches.get(placement.module) ?? [], placement]); continue; }
    const { module, position, yaw = 0, scale = one } = placement;
    const piece = templates.get(module)!.clone();
    piece.position.set(...position); piece.rotation.y = yaw; piece.scale.set(...scale);
    room.add(piece);
  }
  for (const [module, placements] of batches) {
    const template = templates.get(module)!;
    template.updateMatrixWorld(true);
    const inverse = template.matrixWorld.clone().invert();
    template.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const local = inverse.clone().multiply(node.matrixWorld);
      const mesh = new InstancedMesh(node.geometry, node.material, placements.length);
      mesh.name = node.name; mesh.userData = structuredClone(node.userData);
      placements.forEach(({ position, yaw = 0, scale = one }, index) => {
        const matrix = new Matrix4().compose(new Vector3(...position), new Quaternion().setFromAxisAngle(up, yaw), new Vector3(...scale));
        mesh.setMatrixAt(index, matrix.multiply(local));
      });
      mesh.instanceMatrix.needsUpdate = true;
      room.add(mesh);
    });
  }
  return room;
}
