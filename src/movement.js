const FULL_TURN = Math.PI * 2;

export function shortestAngleDelta(current, target) {
  const difference = target - current;
  return Math.atan2(Math.sin(difference), Math.cos(difference));
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
