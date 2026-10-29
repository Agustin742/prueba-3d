import type { RoomModuleId } from './room-modules';

/** `scale` stretches the module along its local axes before the yaw; default 1. */
export type Placement = Readonly<{ module: RoomModuleId; position: readonly [number, number, number]; yaw?: number; scale?: readonly [number, number, number] }>;
export type Rectangle = Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
export type Layout = Readonly<{ floor: Rectangle; obstacles: readonly (Rectangle & { readonly id: string })[] }>;
/** The walkable floor stays explicit: it is a hand-tuned envelope inside the tiles, not their union. `instanced` modules are drawn as one InstancedMesh per template mesh (repeated tiles) instead of one clone per placement. */
export type RoomDefinition = Readonly<{ floor: Rectangle; placements: readonly Placement[]; instanced?: readonly RoomModuleId[] }>;

const round4 = (value: number) => Math.round(value * 1e4) / 1e4;

/** Expands a tile grid row by row (z decreasing) so floors are not hand-listed; `accents` are [col, row] cells. */
export function checkerGrid({ origin, step, cols, rows, y, base, accent, accents }: Readonly<{
  origin: readonly [number, number]; step: number; cols: number; rows: number; y: number;
  base: RoomModuleId; accent: RoomModuleId; accents: readonly (readonly [number, number])[];
}>): Placement[] {
  const marked = new Set(accents.map(([col, row]) => `${col},${row}`));
  return Array.from({ length: cols * rows }, (_, index) => {
    const col = index % cols; const row = Math.floor(index / cols);
    return { module: marked.has(`${col},${row}`) ? accent : base, position: [round4(origin[0] + step * col), y, round4(origin[1] - step * row)] as const };
  });
}
