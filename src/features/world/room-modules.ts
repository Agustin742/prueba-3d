// Reusable room pieces split from the authored reception (scripts/blender/split_reception_modules.py).
// Pivot: bottom-centre of the module bounds. Front faces +Z. Wall runs extend along X.
export const roomModuleIds = Object.freeze([
  'floor-tile-cream', 'floor-tile-pale', 'floor-plinth',
  'wall-back-left', 'wall-back-right', 'wall-left',
  'door', 'window', 'counter-l', 'desk-bell', 'bench',
  'display-shelf', 'planter', 'pendant-lamp', 'noticeboard',
] as const);

export type RoomModuleId = (typeof roomModuleIds)[number];

// Collision footprints in module-local XZ (pivot at the origin, front +Z) for modules that block movement.
// Rectangles conservatively enclose bevels/trim and inlays, not every decorative mesh.
export type Footprint = Readonly<{ id: string; minX: number; maxX: number; minZ: number; maxZ: number }>;
export const roomModuleFootprints: Readonly<Partial<Record<RoomModuleId, readonly Footprint[]>>> = Object.freeze({
  'wall-back-left': [{ id: 'back-left', minX: -3.4, maxX: 3.4, minZ: -0.1975, maxZ: 0.2025 }],
  'wall-back-right': [{ id: 'back-right', minX: -1, maxX: 1, minZ: -0.1975, maxZ: 0.2025 }],
  'wall-left': [{ id: 'left-wall', minX: -4.8, maxX: 4.8, minZ: -0.2025, maxZ: 0.1975 }],
  door: [
    { id: 'jamb-left', minX: -1.22, maxX: -1, minZ: -0.1425, maxZ: 0.2175 },
    { id: 'jamb-right', minX: 1, maxX: 1.22, minZ: -0.1425, maxZ: 0.2175 },
  ],
  // Two pieces, NOT the whole L's AABB. Front includes protruding inlays.
  'counter-l': [
    { id: 'counter-front', minX: -1.75, maxX: 1.75, minZ: 0.0297, maxZ: 1.2297 },
    { id: 'counter-return', minX: 0.55, maxX: 1.75, minZ: -1.2203, maxZ: 0.0297 },
  ],
  bench: [{ id: 'seat', minX: -1.37, maxX: 1.37, minZ: -0.7875, maxZ: 0.7825 }],
  planter: [{ id: 'planter', minX: -0.5165, maxX: 0.5035, minZ: -0.5207, maxZ: 0.4993 }],
  'display-shelf': [{ id: 'shelf', minX: -1.1, maxX: 1.1, minZ: -0.34, maxZ: 0.34 }],
});

export const roomModulePath = (id: RoomModuleId) => `models/rooms/modules/${id}.glb`;
