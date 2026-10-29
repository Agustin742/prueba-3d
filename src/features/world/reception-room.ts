import { checkerGrid, type Placement, type RoomDefinition } from './room-definition';

const quarter = Math.PI / 2;

// Placements reproduce reception.glb from its modules (Three world space, pivot at module bottom-centre).
export const receptionRoom: RoomDefinition = Object.freeze({
  placements: Object.freeze<Placement[]>([
    ...checkerGrid({
      origin: [-4.725, 4.05], step: 1.35, cols: 8, rows: 7, y: -0.05, base: 'floor-tile-pale', accent: 'floor-tile-cream',
      accents: [[0, 0], [0, 5], [1, 2], [2, 4], [3, 1], [3, 6], [4, 3], [5, 0], [5, 5], [6, 2], [7, 4]],
    }),
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
  ]),
});
