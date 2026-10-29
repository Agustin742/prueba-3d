import { deriveLayout } from './derive-layout';
import { receptionRoom } from './reception-room';
import type { Layout } from './room-definition';

// Reception-only conservative envelope at avatar height 2. Core default stays 0.25.
// Sampled original Idle/Walk box corners and all yaw rotations fit inside this radius.
export const receptionAvatarRadius = 1.1;

export type { Layout, Rectangle } from './room-definition';

// Obstacles come from module footprints transformed by the reception placements; see derive-layout.ts.
export const receptionLayout: Layout = deriveLayout(receptionRoom);

// Receptionist NPC spot: [x, z] inside the L-shaped counter pocket (counter-front and counter-return),
// facing +z toward the room. The pocket is unreachable by the player, so it needs no obstacle.
export const receptionNpcPlacement = Object.freeze({ position: [-2.6, -3.2] as const, yaw: 0 });
