// Reusable room pieces split from the authored reception (scripts/blender/split_reception_modules.py).
// Pivot: bottom-centre of the module bounds. Front faces +Z. Wall runs extend along X.
export const roomModuleIds = Object.freeze([
  'floor-tile-cream', 'floor-tile-pale', 'floor-plinth',
  'wall-back-left', 'wall-back-right', 'wall-left',
  'door', 'window', 'counter-l', 'desk-bell', 'bench',
  'display-shelf', 'planter', 'pendant-lamp', 'noticeboard',
] as const);

export type RoomModuleId = (typeof roomModuleIds)[number];

export const roomModulePath = (id: RoomModuleId) => `models/rooms/modules/${id}.glb`;
