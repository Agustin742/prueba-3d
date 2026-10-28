import { receptionLayout, type Layout, type Rectangle } from './reception-layout';

export type Point = Readonly<{ x: number; y: number; z: number }>;
export type NavigationState = Readonly<{ position: Point; path: readonly Point[] }>;
export type Direction = Readonly<{ x: number; z: number }>;
export type TargetRequest = Readonly<{
  state: NavigationState;
  reason?: 'invalid-target' | 'unreachable';
}>;
export type Navigation = Readonly<{
  spawn(point?: Point): NavigationState | null;
  isValidPoint(point: Point): boolean;
  isSegmentClear(from: Point, to: Point): boolean;
  move(state: NavigationState, direction: Direction, dt: number): NavigationState;
  requestTarget(state: NavigationState, target: Point): TargetRequest;
  cancelTarget(state: NavigationState): NavigationState;
  advance(state: NavigationState, dt: number): NavigationState;
}>;

// Provisional tuning, not product decisions. Square footprint conservatively encloses a disc.
const RADIUS = 0.25;
const SPEED = 2.5;
const CELL = 0.3;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const point = (x: number, z: number): Point => ({ x, y: 0, z });
const interpolate = (a: Point, b: Point, t: number): Point => point(
  a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t,
);
const snapshot = (position: Point, path: readonly Point[] = []): NavigationState => Object.freeze({
  position: Object.freeze({ ...position }),
  path: Object.freeze(path.map(value => Object.freeze({ ...value }))),
});

/** Local flat-floor core. Optional layout is trusted authored data, not a room-access API. */
export function createNavigation(
  layout: Layout = receptionLayout,
  { radius = RADIUS }: Readonly<{ radius?: number }> = {},
): Navigation {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Navigation radius must be positive and finite');
  const floor = {
    minX: layout.floor.minX + radius, maxX: layout.floor.maxX - radius,
    minZ: layout.floor.minZ + radius, maxZ: layout.floor.maxZ - radius,
  };
  const obstacles = layout.obstacles.map(box => ({
    minX: box.minX - radius, maxX: box.maxX + radius,
    minZ: box.minZ - radius, maxZ: box.maxZ + radius,
  }));
  const inside = (p: Point, box: Rectangle) => p.x >= box.minX && p.x <= box.maxX
    && p.z >= box.minZ && p.z <= box.maxZ;
  const isValidPoint = (p: Point): boolean => Number.isFinite(p.x) && Number.isFinite(p.z)
    && p.y === 0 && inside(p, floor) && !obstacles.some(box => inside(p, box));

  // Slab intersection of a whole segment with each inflated box, including tangency.
  // Convex floor: valid endpoints imply the entire segment stays inside its boundary.
  function isSegmentClear(from: Point, to: Point): boolean {
    if (!isValidPoint(from) || !isValidPoint(to)) return false;
    return !obstacles.some(box => {
      let enter = 0;
      let leave = 1;
      for (const axis of ['x', 'z'] as const) {
        const min = axis === 'x' ? box.minX : box.minZ;
        const max = axis === 'x' ? box.maxX : box.maxZ;
        const delta = to[axis] - from[axis];
        if (delta === 0) {
          if (from[axis] < min || from[axis] > max) return false;
        } else {
          const a = (min - from[axis]) / delta;
          const b = (max - from[axis]) / delta;
          enter = Math.max(enter, Math.min(a, b));
          leave = Math.min(leave, Math.max(a, b));
          if (enter > leave) return false;
        }
      }
      return true;
    });
  }

  // Maximal collision-free prefix, even when the final point is beyond an obstacle.
  function sweep(from: Point, to: Point): Point {
    if (isSegmentClear(from, to)) return to;
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 48; iteration++) {
      const middle = (low + high) / 2;
      if (isSegmentClear(from, interpolate(from, to, middle))) low = middle;
      else high = middle;
    }
    return interpolate(from, to, Math.max(0, low - 1e-10));
  }

  function move(state: NavigationState, direction: Direction, dt: number): NavigationState {
    const magnitude = Math.hypot(direction.x, direction.z);
    if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(magnitude) || magnitude === 0
      || !isValidPoint(state.position)) return state;
    const travel = SPEED * dt;
    if (!Number.isFinite(travel)) return state;
    const target = point(state.position.x + direction.x / magnitude * travel,
      state.position.z + direction.z / magnitude * travel);
    const hit = sweep(state.position, target);
    // Stable X-then-Z sliding; each leg uses the same continuous collision owner.
    const slideX = sweep(hit, point(target.x, hit.z));
    const slideZ = sweep(slideX, point(slideX.x, target.z));
    return snapshot(slideZ);
  }

  function findPath(from: Point, target: Point): readonly Point[] | null {
    if (isSegmentClear(from, target)) return distance(from, target) === 0 ? [] : [target];
    // Small reception lattice. No giant matrices or frame-sized collision sampling.
    const nodes: Point[] = [];
    const cells = new Map<string, number>();
    for (let x = Math.ceil(floor.minX / CELL); x <= Math.floor(floor.maxX / CELL); x++) {
      for (let z = Math.ceil(floor.minZ / CELL); z <= Math.floor(floor.maxZ / CELL); z++) {
        const value = point(x * CELL, z * CELL);
        if (isValidPoint(value)) {
          cells.set(`${x},${z}`, nodes.length);
          nodes.push(value);
        }
      }
    }
    const costs = new Map<number, number>();
    const parents = new Map<number, number>();
    const open = new Set<number>();
    // Exact endpoints connect only via clear segments; never snap through an obstacle.
    nodes.forEach((node, id) => {
      if (isSegmentClear(from, node)) {
        costs.set(id, distance(from, node));
        parents.set(id, -1);
        open.add(id);
      }
    });
    const closed = new Set<number>();
    while (open.size) {
      let current = -1;
      let best = Infinity;
      for (const id of open) {
        const score = costs.get(id)! + distance(nodes[id], target);
        if (score < best || (score === best && id < current)) {
          best = score;
          current = id;
        }
      }
      open.delete(current);
      closed.add(current);
      const here = nodes[current];
      if (isSegmentClear(here, target)) {
        const path = [target];
        for (let id = current; id !== -1; id = parents.get(id)!) path.unshift(nodes[id]);
        return path;
      }
      const x = Math.round(here.x / CELL);
      const z = Math.round(here.z / CELL);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const id = cells.get(`${x + dx},${z + dz}`);
          if (id === undefined || closed.has(id) || !isSegmentClear(here, nodes[id])) continue;
          const cost = costs.get(current)! + distance(here, nodes[id]);
          if (cost < (costs.get(id) ?? Infinity)) {
            costs.set(id, cost);
            parents.set(id, current);
            open.add(id);
          }
        }
      }
    }
    return null;
  }

  function requestTarget(state: NavigationState, target: Point): TargetRequest {
    if (!isValidPoint(target)) return { state, reason: 'invalid-target' };
    if (!isValidPoint(state.position)) return { state, reason: 'unreachable' };
    const path = findPath(state.position, target);
    return path === null ? { state, reason: 'unreachable' } : { state: snapshot(state.position, path) };
  }

  function advance(state: NavigationState, dt: number): NavigationState {
    if (!Number.isFinite(dt) || dt <= 0 || !state.path.length || !isValidPoint(state.position)) return state;
    let budget = SPEED * dt;
    let position = state.position;
    const path = [...state.path];
    while (path.length) {
      const next = path[0];
      if (!isSegmentClear(position, next)) return snapshot(position); // Interrupted, not arrived.
      const length = distance(position, next);
      if (length > budget) return snapshot(interpolate(position, next, budget / length), path);
      position = next;
      budget -= length;
      path.shift();
    }
    return snapshot(position);
  }

  return {
    isValidPoint, isSegmentClear, move, requestTarget, advance,
    spawn: (value: Point = point(0, 2)): NavigationState | null => isValidPoint(value) ? snapshot(value) : null,
    cancelTarget: (state: NavigationState): NavigationState => state.path.length ? snapshot(state.position) : state,
  };
}
