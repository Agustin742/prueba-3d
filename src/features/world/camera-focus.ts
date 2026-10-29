import { Box3, Vector3 } from 'three';
import type { Point } from './navigation';
import type { Rectangle } from './room-definition';

/** The volume the camera frames at zoom factor 1: one unit-room-sized window, so the view reads as it did before the room grew. */
export const receptionViewBox = Object.freeze(new Box3(new Vector3(-5.4, -0.9, -4.725), new Vector3(5.4, 3.6, 4.725)));

const half = receptionViewBox.getSize(new Vector3()).multiplyScalar(0.5);
const clamp = (value: number, low: number, high: number) => low > high ? (low + high) / 2 : Math.min(high, Math.max(low, value));

/**
 * Where the camera looks: the avatar, held back from the floor edges by the framed half-extent (shrinking with zoom)
 * so the window never shows past the floor while the avatar always stays inside it.
 */
export function cameraFocus(position: Point, floor: Rectangle, zoomFactor = 1): Vector3 {
  const hx = half.x / zoomFactor; const hz = half.z / zoomFactor;
  return new Vector3(
    clamp(position.x, floor.minX + hx, floor.maxX - hx),
    (receptionViewBox.min.y + receptionViewBox.max.y) / 2,
    clamp(position.z, floor.minZ + hz, floor.maxZ - hz),
  );
}
