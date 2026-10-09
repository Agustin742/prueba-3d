import assert from 'node:assert/strict';
import test from 'node:test';
import { circleIntersectsAabb, moveWithCollisions, shortestAngleDelta, turnTowardsAngle } from '../src/movement.js';

const closeTo = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not close to ${expected}`);
};

const furniture = [
  { minX: -3.8, maxX: -2.664, minZ: -4.21, maxZ: -3.5 },
  { minX: -0.35, maxX: 2.45, minZ: -2.55, maxZ: -1.379 },
  { minX: 1.439, maxX: 2.889, minZ: -1.458, maxZ: -0.581 },
];
const openBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
const playerRadius = 0.32;

test('blocks the player against each furniture footprint', () => {
  for (const box of furniture) {
    const start = { x: box.minX - 1, z: (box.minZ + box.maxZ) / 2 };
    const result = moveWithCollisions(start, { x: 2, z: 0 }, [box], openBounds, playerRadius);

    assert.ok(result.x <= box.minX - playerRadius + 1e-9);
    assert.ok(!circleIntersectsAabb(result.x, result.z, playerRadius, box));
  }
});

test('keeps the player inside the room bounds', () => {
  const bounds = { minX: -4, maxX: 4, minZ: -3, maxZ: 3 };
  const result = moveWithCollisions({ x: 3.8, z: 2.8 }, { x: 5, z: 5 }, [], bounds, playerRadius);

  assert.deepEqual(result, { x: 4, z: 3 });
});

test('allows axis sliding along a furniture edge', () => {
  const sofa = furniture[1];
  const result = moveWithCollisions({ x: -1, z: -1.8 }, { x: 2.5, z: 0.5 }, [sofa], openBounds, playerRadius);

  assert.ok(result.z > -1.35, `expected sliding past the edge, got z=${result.z}`);
  assert.ok(!circleIntersectsAabb(result.x, result.z, playerRadius, sofa));
});

test('repeated diagonal pushes slide along adjoining sofa and table edges without penetration', () => {
  const obstacles = furniture.slice(1);
  let position = { x: -1.2, z: -2 };

  for (let step = 0; step < 100; step += 1) {
    position = moveWithCollisions(position, { x: 0.1, z: 0.02 }, obstacles, openBounds, playerRadius);
    for (const box of obstacles) {
      assert.ok(!circleIntersectsAabb(position.x, position.z, playerRadius, box), `penetrated furniture at step ${step}: ${JSON.stringify(position)}`);
    }
  }

  assert.ok(position.x > 2, `expected to slide beyond both furniture edges, got x=${position.x}`);
  assert.ok(position.z > -0.5, `expected to keep advancing along the open edge, got z=${position.z}`);
});

test('prevents tunneling through furniture during a large movement step', () => {
  const sofa = furniture[1];
  const result = moveWithCollisions({ x: -2, z: -2 }, { x: 20, z: 0 }, [sofa], openBounds, playerRadius);

  assert.ok(result.x <= sofa.minX - playerRadius + 1e-9);
});

test('leaves a reachable position at the bookcase front for E interaction', () => {
  const bookcase = furniture[0];
  const player = { x: -3.1, z: -3 };
  const result = moveWithCollisions(player, { x: 0, z: 0 }, [bookcase], {
    minX: -4, maxX: 4, minZ: -3, maxZ: 3,
  }, playerRadius);
  const distanceToInteraction = Math.hypot(result.x + 3.8, result.z + 3.5);

  assert.ok(!circleIntersectsAabb(result.x, result.z, playerRadius, bookcase));
  assert.ok(distanceToInteraction < 1.35);
});

test('chooses the shortest direction across the positive/negative pi boundary', () => {
  const current = Math.PI - 0.1;
  const target = -Math.PI + 0.1;

  closeTo(shortestAngleDelta(current, target), 0.2);
  closeTo(shortestAngleDelta(-Math.PI + 0.1, Math.PI - 0.1), -0.2);
});

test('handles a 180-degree reversal as a half-turn without exceeding it', () => {
  closeTo(Math.abs(shortestAngleDelta(0, Math.PI)), Math.PI);
  const turned = turnTowardsAngle(0, Math.PI, 0.1);
  assert.ok(turned > 0 && turned < Math.PI);
});

test('uses exponential interpolation consistently across time-step sizes', () => {
  const initial = 2.8;
  const target = -2.8;
  const oneStep = turnTowardsAngle(initial, target, 0.4);
  let manySteps = initial;
  for (let i = 0; i < 8; i += 1) {
    manySteps = turnTowardsAngle(manySteps, target, 0.05);
  }

  closeTo(shortestAngleDelta(oneStep, manySteps), 0, 1e-9);
});

test('does not change angle for zero or negative elapsed time or turn rate', () => {
  assert.equal(turnTowardsAngle(1.25, -2, 0), 1.25);
  assert.equal(turnTowardsAngle(1.25, -2, -0.1), 1.25);
  assert.equal(turnTowardsAngle(1.25, -2, 0.1, 0), 1.25);
});
