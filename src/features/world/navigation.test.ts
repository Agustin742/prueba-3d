import { describe, expect, it } from 'vitest';
import { createNavigation, type Point } from './navigation';
import { receptionLayout } from './reception-layout';

const nav = createNavigation();
const p = (x: number, z: number, y = 0): Point => ({ x, y, z });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

describe('flat reception navigation public API', () => {
  it('creates a deterministic valid spawn and rejects invalid spawns', () => {
    expect(nav.spawn()).toEqual(nav.spawn());
    expect(nav.isValidPoint(nav.spawn()!.position)).toBe(true);
    expect(nav.spawn(p(-2, -1.5))).toBeNull();
  });

  it.each([
    ['off-floor', p(37.6, 0)], ['portal beyond floor', p(32.8, -4.8)],
    ['back wall', p(0, -4.5)], ['left wall', p(-5.15, 0)],
    ['counter front', p(-2.8, -1.6)], ['counter return', p(-0.9, -3)],
    ['seat', p(-4.3, 1.5)], ['planter', p(4.35, -3.63)], ['left planter', p(-4.3, 12)], ['old door position, now wall', p(2.4, -4.4)],
    ['shelf', p(-4.9, 4)], ['unsupported elevation', p(0, 0, 0.1)],
    ['nonfinite point', p(NaN, 0)], ['radius tangent to counter', p(-2, -0.8)],
  ])('rejects %s without replacing position or stored intent', (_name, target) => {
    const state = nav.requestTarget(nav.spawn()!, p(3, 2)).state;
    const before = JSON.stringify(state);
    expect(nav.isValidPoint(target)).toBe(false);
    const rejected = nav.requestTarget(state, target);
    expect(rejected.reason).toBe('invalid-target');
    expect(rejected.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keeps the open counter recess and overhead decoration navigable', () => {
    expect(nav.isValidPoint(p(-2.8, -3))).toBe(true);
    expect(nav.isValidPoint(p(-3, -2.7))).toBe(true); // Below a pendant.
    expect(nav.isValidPoint(p(32.8, -4.4))).toBe(true); // Inside the moved portal, not outside floor.
    expect(nav.isValidPoint(p(37.54, 0))).toBe(true); // Radius inset, inclusive floor edge.
    expect(nav.isValidPoint(p(5.14, 20))).toBe(true); // Open floor of the grown room.
  });

  it('normalizes diagonal input, supports variable dt, and leaves the input snapshot unchanged', () => {
    const start = nav.spawn()!;
    const straight = nav.move(start, { x: 1, z: 0 }, 0.2);
    const diagonal = nav.move(start, { x: 1, z: 1 }, 0.2);
    expect(distance(straight.position, start.position)).toBeCloseTo(1);
    expect(distance(diagonal.position, start.position)).toBeCloseTo(1);
    const halves = nav.move(nav.move(start, { x: 1, z: 0 }, 0.1), { x: 1, z: 0 }, 0.1);
    expect(halves.position).toEqual(straight.position);
    expect(start).toEqual(nav.spawn());
  });

  it('sweeps continuous segments, preventing large-dt tunnelling and sliding along obstacles', () => {
    const start = nav.spawn(p(-2.8, 0))!;
    expect(nav.isSegmentClear(start.position, p(-2.8, -4))).toBe(false);
    expect(nav.isSegmentClear(p(-2.8, -3), p(0, -3))).toBe(false);
    // Both endpoints valid, but a diagonal may not cut the inflated counter corner.
    expect(nav.isValidPoint(p(-4.2, -2))).toBe(true);
    expect(nav.isValidPoint(p(-3.8, -2.6))).toBe(true);
    expect(nav.isSegmentClear(p(-4.2, -2), p(-3.8, -2.6))).toBe(false);
    const stopped = nav.move(start, { x: 0, z: -1 }, 10);
    expect(stopped.position.z).toBeGreaterThan(-0.8);
    expect(stopped.position.z).toBeLessThan(-0.79);
    const slide = nav.move(start, { x: 1, z: -1 }, 0.8);
    expect(slide.position.x).toBeGreaterThan(start.position.x + 1);
    expect(nav.isValidPoint(slide.position)).toBe(true);
    for (const direction of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
      expect(nav.isValidPoint(nav.move(nav.spawn()!, direction, 100).position)).toBe(true);
    }
  });

  it('finds a deterministic route around the L and reaches the exact target over clear segments', () => {
    const start = nav.spawn(p(-2.8, 0))!;
    const target = p(-2.8, -3);
    const requested = nav.requestTarget(start, target);
    expect(requested.reason).toBeUndefined();
    expect(requested.state.path.length).toBeGreaterThan(1);
    expect(nav.requestTarget(start, target)).toEqual(requested);
    let state = requested.state;
    for (const point of state.path) {
      expect(nav.isSegmentClear(state.position, point)).toBe(true);
      state = { ...state, position: point };
    }
    state = requested.state;
    for (let frame = 0; frame < 600 && state.path.length; frame++) {
      const next = nav.advance(state, 0.05);
      expect(nav.isSegmentClear(state.position, next.position)).toBe(true);
      state = next;
    }
    expect(state.position).toEqual(target);
    expect(state.path).toEqual([]);
    expect(nav.advance(requested.state, 100).position).toEqual(target);
    expect(start.path).toEqual([]);
  });

  it('rejects disconnected valid floor rather than reporting arrival', () => {
    const split = createNavigation({ ...receptionLayout, obstacles: [
      { id: 'sealed test divider', minX: -0.1, maxX: 0.1, minZ: -5, maxZ: 34 },
    ] });
    const start = split.spawn(p(-2, 0))!;
    expect(split.isValidPoint(p(2, 0))).toBe(true);
    const result = split.requestTarget(start, p(2, 0));
    expect(result).toEqual({ state: start, reason: 'unreachable' });
    expect(result.state).toBe(start);
  });

  it('replaces or cancels targets and manual movement interrupts the old route', () => {
    const first = nav.requestTarget(nav.spawn()!, p(3, 2)).state;
    const second = nav.requestTarget(first, p(1, 1)).state;
    expect(second.path.at(-1)).toEqual(p(1, 1));
    expect(first.path.at(-1)).toEqual(p(3, 2));
    const canceled = nav.cancelTarget(second);
    expect(canceled.path).toEqual([]);
    expect(nav.advance(canceled, 1)).toBe(canceled);
    expect(nav.move(first, { x: 1, z: 0 }, 0.1).path).toEqual([]);
    expect(nav.requestTarget(first, first.position).state.path).toEqual([]);
    expect(Object.isFrozen(second.position)).toBe(true);
    expect(Object.isFrozen(second.path)).toBe(true);
  });

  it('supports an explicit conservative avatar footprint without changing the default contract', () => {
    const wide = createNavigation(undefined, { radius: 1.1 });
    expect(nav.isValidPoint(p(-2.8, -3))).toBe(true);
    expect(wide.isValidPoint(p(-2.8, -3))).toBe(false);
    expect(wide.isValidPoint(p(32.8, -4.4))).toBe(false); // Portal narrower than diameter 2.2.
    expect(wide.spawn()).not.toBeNull();
    const start = wide.spawn()!;
    const moved = wide.move(start, { x: 0, z: -1 }, 100);
    expect(wide.isValidPoint(moved.position)).toBe(true);
    expect(moved.position.z).toBeGreaterThan(0.05); // Counter maxZ + effective radius.
    const rejected = wide.requestTarget(start, p(-2.8, -3));
    expect(rejected.reason).toBe('invalid-target'); expect(rejected.state).toBe(start);
    for (const radius of [-1, 0, NaN, Infinity]) expect(() => createNavigation(undefined, { radius })).toThrow(RangeError);
  });

  it('ignores invalid frame inputs without mutating a pending route', () => {
    const state = nav.requestTarget(nav.spawn()!, p(3, 2)).state;
    for (const dt of [-1, NaN, Infinity]) {
      expect(nav.move(state, { x: 1, z: 0 }, dt)).toBe(state);
      expect(nav.advance(state, dt)).toBe(state);
    }
    expect(nav.move(state, { x: Infinity, z: 0 }, 1)).toBe(state);
    expect(nav.move(state, { x: 0, z: 0 }, 0)).toBe(state);
  });
});

describe('grown reception routes', () => {
  it('routes across the whole room to the door pocket and the far corner within the same deterministic result', () => {
    const start = nav.spawn()!;
    for (const target of [p(32.8, -4.4), p(37.5, 32.8), p(-4.6, 32.8)]) {
      const request = nav.requestTarget(start, target);
      expect(request.reason, JSON.stringify(target)).toBeUndefined();
      expect(request.state.path.at(-1)).toEqual(target);
      expect(nav.requestTarget(start, target)).toEqual(request);
      let state = request.state;
      for (let guard = 0; guard < 400 && state.path.length; guard++) state = nav.advance(state, 1);
      expect(state.position).toEqual(target);
    }
  });
});
