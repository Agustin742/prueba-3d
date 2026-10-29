import { checkerGrid, type Placement, type RoomDefinition } from './room-definition';

const quarter = Math.PI / 2;
const tileStep = 1.35;
// [col, row] cream accents of the original 8x7 checker; row 0 is the front (+Z) row.
const unitAccents = [[0, 0], [0, 5], [1, 2], [2, 4], [3, 1], [3, 6], [4, 3], [5, 0], [5, 5], [6, 2], [7, 4]] as const;

// Placements reproduce reception.glb from its modules (Three world space, pivot at module bottom-centre).
const unitPlacements = Object.freeze<Placement[]>([
  ...checkerGrid({ origin: [-4.725, 4.05], step: tileStep, cols: 8, rows: 7, y: -0.05, base: 'floor-tile-pale', accent: 'floor-tile-cream', accents: unitAccents }),
  { module: 'pendant-lamp', position: [-3.0, 2.92, -2.7] },
  { module: 'pendant-lamp', position: [-0.9, 2.92, -2.7] },
  { module: 'floor-plinth', position: [0, -0.45, 0] },
  { module: 'wall-back-left', position: [-2.0, 0, -4.6425] },
  { module: 'wall-back-right', position: [4.4, 0, -4.6425] },
  { module: 'wall-left', position: [-5.3175, 0, 0], yaw: quarter },
  { module: 'door', position: [2.4, 0, -4.5375] },
  { module: 'window', position: [-5.09, 1.615, -1.17], yaw: quarter },
  { module: 'counter-l', position: [-2.05, 0.01, -2.2797] },
  { module: 'desk-bell', position: [-2.7, 1.49, -1.65] },
  { module: 'bench', position: [-4.3925, 0.04, 1.73], yaw: quarter },
  { module: 'planter', position: [4.3565, 0.06, -3.6193] },
  { module: 'display-shelf', position: [-5.0, 1.365, 3.4], yaw: quarter },
  { module: 'noticeboard', position: [-2.7, 1.655, -4.32] },
]);

/** The original single room. Kept as the parity oracle against the retired monolithic GLB. */
export const receptionUnitRoom: RoomDefinition = Object.freeze({
  floor: Object.freeze({ minX: -5.39, maxX: 5.39, minZ: -4.716, maxZ: 4.716 }),
  placements: unitPlacements,
});

// The reception grows 4x4 from the unit room as its back-left block (x 0..3 cols of 8, z 0..3 rows of 7 from the back).
// Tiles repeat the unit checker block by block (rows count from the front, so the unit rows are the last 7).
const blocks = 4;
const cols = 8 * blocks; const rows = 7 * blocks;
const grownAccents = Array.from({ length: blocks * blocks }, (_, block) => unitAccents.map(([col, row]) => [(block % blocks) * 8 + col, Math.floor(block / blocks) * 7 + row] as const)).flat();
const floorTiles = checkerGrid({ origin: [-4.725, 4.05 + tileStep * (rows - 7)], step: tileStep, cols, rows, y: -0.05, base: 'floor-tile-pale', accent: 'floor-tile-cream', accents: grownAccents });

// Edges of the grown tiles: x -5.4..37.8, z -4.725..33.075. The unit room's furniture keeps its coordinates.
const furniture = unitPlacements.filter(({ module }) => !/^(floor-|wall-|door$|window$|planter$)/.test(module));
// Back wall: the unit's wall-back-left, three more of them and five wall-back-right tile exactly to the door opening (x 31.8..33.8); two wall-back-right close the right part.
const backWalls: Placement[] = [
  ...[-2, 4.8, 11.6, 18.4].map((x): Placement => ({ module: 'wall-back-left', position: [x, 0, -4.6425] })),
  ...[22.8, 24.8, 26.8, 28.8, 30.8, 34.8, 36.8].map((x): Placement => ({ module: 'wall-back-right', position: [x, 0, -4.6425] })),
];

export const receptionRoom: RoomDefinition = Object.freeze({
  floor: Object.freeze({ minX: -5.39, maxX: 37.79, minZ: -4.716, maxZ: 33.066 }),
  instanced: Object.freeze(['floor-tile-cream', 'floor-tile-pale'] as const),
  placements: Object.freeze<Placement[]>([
    ...floorTiles,
    ...furniture.filter(({ module }) => module === 'pendant-lamp'),
    // Plinth (11.1 x 9.9 unit) stretched to the grown tiles plus the unit margin; 16 plinths would z-fight in the grout gaps.
    { module: 'floor-plinth', position: [16.2, -0.45, 14.175], scale: [43.5 / 11.1, 1, 38.25 / 9.9] },
    ...backWalls,
    // Left wall (9.6 m) stretched to z -4.8..33.15, the unit's 0.075 m margin past the tiles; tiling four would overshoot by 0.45 m.
    { module: 'wall-left', position: [-5.3175, 0, 14.175], yaw: quarter, scale: [37.95 / 9.6, 1, 1] },
    { module: 'door', position: [32.8, 0, -4.5375] },
    { module: 'window', position: [-5.09, 1.615, -1.17], yaw: quarter },
    { module: 'window', position: [-5.09, 1.615, 20], yaw: quarter },
    ...furniture.filter(({ module }) => module === 'counter-l' || module === 'desk-bell' || module === 'bench'),
    { module: 'planter', position: [4.3565, 0.06, -3.6193] },
    { module: 'planter', position: [-4.3, 0.06, 12] },
    ...furniture.filter(({ module }) => module === 'display-shelf' || module === 'noticeboard'),
  ]),
});
