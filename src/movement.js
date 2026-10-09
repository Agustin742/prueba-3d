const FULL_TURN = Math.PI * 2;
const COLLISION_STEP = 0.1;

export function shortestAngleDelta(current, target) {
  const difference = target - current;
  return Math.atan2(Math.sin(difference), Math.cos(difference));
}

export function circleIntersectsAabb(x, z, radius, box) {
  const nearestX = Math.max(box.minX, Math.min(x, box.maxX));
  const nearestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
  const offsetX = x - nearestX;
  const offsetZ = z - nearestZ;
  return offsetX * offsetX + offsetZ * offsetZ < radius * radius;
}

export function moveWithCollisions(position, displacement, obstacles, bounds, radius) {
  const next = { x: position.x, z: position.z };
  const targetX = Math.max(bounds.minX, Math.min(next.x + displacement.x, bounds.maxX));
  const targetZ = Math.max(bounds.minZ, Math.min(next.z + displacement.z, bounds.maxZ));
  const distance = Math.max(Math.abs(targetX - next.x), Math.abs(targetZ - next.z));
  const steps = Math.max(1, Math.ceil(distance / COLLISION_STEP));
  const stepX = (targetX - next.x) / steps;
  const stepZ = (targetZ - next.z) / steps;

  for (let step = 0; step < steps; step += 1) {
    const candidateX = next.x + stepX;
    if (!obstacles.some((box) => circleIntersectsAabb(candidateX, next.z, radius, box))) {
      next.x = candidateX;
    }

    const candidateZ = next.z + stepZ;
    if (!obstacles.some((box) => circleIntersectsAabb(next.x, candidateZ, radius, box))) {
      next.z = candidateZ;
    }
  }
  next.x = Math.max(bounds.minX, Math.min(next.x, bounds.maxX));
  next.z = Math.max(bounds.minZ, Math.min(next.z, bounds.maxZ));
  return next;
}

export function turnTowardsAngle(current, target, deltaSeconds, turnRate = 8) {
  if (deltaSeconds <= 0 || turnRate <= 0) return current;

  const delta = shortestAngleDelta(current, target);
  const fraction = 1 - Math.exp(-turnRate * deltaSeconds);
  let result = current + delta * fraction;

  // Keep the accumulated rotation bounded while preserving its equivalent angle.
  result = ((result + Math.PI) % FULL_TURN + FULL_TURN) % FULL_TURN - Math.PI;
  return result;
}
