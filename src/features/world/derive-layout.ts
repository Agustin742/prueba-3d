import type { Layout, RoomDefinition } from './room-definition';
import { roomModuleFootprints } from './room-modules';

const round6 = (value: number) => Math.round(value * 1e6) / 1e6 + 0;

/** Scales footprints in module-local axes, then turns them by each placement's yaw; yaw must be a quarter turn so rectangles stay axis-aligned. */
export function deriveLayout({ floor, placements }: Pick<RoomDefinition, 'floor' | 'placements'>): Layout {
  return Object.freeze({
    floor,
    obstacles: Object.freeze(placements.flatMap(({ module, position: [x, , z], yaw = 0, scale: [sx, , sz] = [1, 1, 1] }) => {
      const turns = yaw / (Math.PI / 2);
      if (!Number.isInteger(Math.round(turns * 1e6) / 1e6)) throw new Error(`Placement of ${module} needs a quarter-turn yaw`);
      const cos = [1, 0, -1, 0][((Math.round(turns) % 4) + 4) % 4]!; const sin = [0, 1, 0, -1][((Math.round(turns) % 4) + 4) % 4]!;
      return (roomModuleFootprints[module] ?? []).map(({ id, minX, maxX, minZ, maxZ }) => {
        // Three rotation.y: x' = x cos + z sin, z' = z cos - x sin.
        const xs = [minX, maxX].flatMap(px => [minZ, maxZ].map(pz => x + px * sx * cos + pz * sz * sin));
        const zs = [minX, maxX].flatMap(px => [minZ, maxZ].map(pz => z + pz * sz * cos - px * sx * sin));
        return Object.freeze({ id, minX: round6(Math.min(...xs)), maxX: round6(Math.max(...xs)), minZ: round6(Math.min(...zs)), maxZ: round6(Math.max(...zs)) });
      });
    })),
  });
}
