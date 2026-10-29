// Reception-only conservative envelope at avatar height 2. Core default stays 0.25.
// Sampled original Idle/Walk box corners and all yaw rotations fit inside this radius.
export const receptionAvatarRadius = 1.1;

export type Rectangle = Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
export type Layout = Readonly<{ floor: Rectangle; obstacles: readonly (Rectangle & { readonly id: string })[] }>;

// Three XZ = Blender (X, -Y). See the recipe's compose() and the real-GLB fixture.
// Rectangles conservatively enclose bevels/trim, not every decorative mesh.
export const receptionLayout: Layout = Object.freeze({
  floor: Object.freeze({ minX: -5.39, maxX: 5.39, minZ: -4.716, maxZ: 4.716 }),
  obstacles: Object.freeze([
    { id: 'back-left', minX: -5.4, maxX: 1.4, minZ: -4.84, maxZ: -4.44 },
    { id: 'back-right', minX: 3.4, maxX: 5.4, minZ: -4.84, maxZ: -4.44 },
    { id: 'left-wall', minX: -5.52, maxX: -5.12, minZ: -4.8, maxZ: 4.8 },
    { id: 'jamb-left', minX: 1.18, maxX: 1.4, minZ: -4.68, maxZ: -4.32 },
    { id: 'jamb-right', minX: 3.4, maxX: 3.62, minZ: -4.68, maxZ: -4.32 },
    // Two pieces, NOT the whole L's AABB. Front includes protruding inlays.
    { id: 'counter-front', minX: -3.8, maxX: -0.3, minZ: -2.25, maxZ: -1.05 },
    { id: 'counter-return', minX: -1.5, maxX: -0.3, minZ: -3.5, maxZ: -2.25 },
    { id: 'seat', minX: -5.18, maxX: -3.61, minZ: 0.36, maxZ: 3.1 },
    { id: 'planter', minX: 3.84, maxX: 4.86, minZ: -4.14, maxZ: -3.12 },
    { id: 'shelf', minX: -5.34, maxX: -4.66, minZ: 2.3, maxZ: 4.5 },
  ].map(box => Object.freeze(box))),
});

// Receptionist NPC spot: [x, z] inside the L-shaped counter pocket (counter-front and counter-return),
// facing +z toward the room. The pocket is unreachable by the player, so it needs no obstacle.
export const receptionNpcPlacement = Object.freeze({ position: [-2.6, -3.2] as const, yaw: 0 });
