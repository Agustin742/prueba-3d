import assert from 'node:assert/strict';
import test from 'node:test';
import { shortestAngleDelta, turnTowardsAngle } from '../src/movement.js';

const closeTo = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not close to ${expected}`);
};

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
