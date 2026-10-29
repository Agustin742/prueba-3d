# Local reception navigation study

The default app view integrates the modular reception (composed from module GLBs) and the avatar GLB with T3a's deterministic local navigation core and T5's bounded local object interactions. This is a single-player experiment, not the finished product: authentication, Colyseus, persistent tasks, chat, business actions and server persistence are absent. Additional rooms remain deferred awaiting team review.

## Try the local study

1. With existing dependencies installed, run `pnpm dev` and open Vite's local URL (WebGL 2 required).
2. Wait for the scene to load, then focus the reception viewport by click/tap or Tab.
3. Use WASD, or click/tap an actual clear floor tile. `Escape` cancels ongoing navigation. A new destination replaces the old one; manual movement cancels its route.
4. Click/tap an interactive reception object directly in 3D (reception desk/bell, noticeboard, waiting seat, or portal doorway).
5. Clicking/tapping the 3D noticeboard opens a centered modal dialog (`role="dialog"`, `aria-modal="true"`), automatically stops active navigation, and restores focus to the reception when closed via **Close noticeboard** or `Escape`.

Provisional keyboard mapping is world-aligned: W → −Z, S → +Z, A → −X, D → +X, not camera-relative screen arrows. The elevated orthographic camera is fixed and fits room bounds on resize; no free-camera controls are installed. Narrow-screen readability still needs browser acceptance.

## Integration ownership

| Module | Responsibility |
| --- | --- |
| [ReceptionPreview](../../src/features/world/ReceptionPreview.tsx) | Full-viewport reception stage, asset downloads, loading/error/readiness, exclusive resource lifetime, compact floating status pill and centered noticeboard modal dialog. |
| [ReceptionScene](../../src/features/world/ReceptionScene.tsx) | Fixed bounds-fit camera, posed avatar anchoring, exact navigation-to-transform copies, facing, original Idle/Walk selection, nearest-hit floor and interactive prop selection. Reuses the unchanged scene-lifecycle hook. |
| [reception-interactions](../../src/features/world/reception-interactions.ts) | Bounded reception interaction catalog (`counter-bell`, `noticeboard`, `waiting-seat`, `portal-doorway`) and hit classification by source mesh name (`userData.name`, e.g. `Bell dome`, no prefix) across decorative responses, local dialog preview and unavailable room transition. |
| [use-navigation-controls](../../src/features/world/use-navigation-controls.ts) | The single navigation snapshot, held keys and pointer-tap arbitration. Frames call core `move`/`advance` with dt capped at 0.1 seconds; no second position or corner-cutting interpolation. |
| [load-reception](../../src/features/world/load-reception.ts) | One uncached room: loads the modules `receptionRoom` needs, composes them, and idempotently disposes the shared template geometry/materials/textures once (clones share them). Rejects on failure; no procedural substitute. Avatar ownership stays in the existing avatar loader/mixer; optional `setMoving` preserves default Idle, reduced motion and final disposal. |

Typing/contenteditable/controls and dialogs do not own world keys. Focus loss, window blur, visibility changes, inactive controls, modal insertion, pointer cancellation and view unmount discard stale intent. Recovery requires a fresh key press or tap. UI pointer activation never becomes a destination. Floor taps use PointerEvents without hover and reject drags (8 CSS-pixel threshold); taps interrupted before release are discarded.

Room picking considers only the nearest actual mesh hit: tile meshes (source names `Tile n-m`) top faces near Y0 qualify. Countertops, seats, walls, avatars and off-room misses are rejected, never projected through to the floor. Tile joints can reject a precise tap even though the movement core treats the floor envelope continuously. Rejected targets cancel the old route and announce rejection; they do not imply arrival. The open portal is not a transition.

Both original assets must download and complete a render before readiness. Asset errors and WebGL setup/context failures remain distinct from readiness, with manual reload guidance and no procedural substitutes. Failures/unmount dispose owned assets; uncancellable late downloads are disposed without mounting. The original calibration component, lifecycle hook and tests remain unchanged.

## Navigation API

Import `createNavigation` and the `NavigationState`/`Point` types from [navigation.ts](../../src/features/world/navigation.ts).

```ts
const navigation = createNavigation();
let state = navigation.spawn(); // Default feet position: { x: 0, y: 0, z: 2 }.
if (!state) throw new Error('Invalid reception spawn');
state = navigation.move(state, { x: 1, z: -1 }, 1 / 60);
const request = navigation.requestTarget(state, { x: -2.8, y: 0, z: -3 });
if (!request.reason) state = request.state;
state = navigation.advance(state, 1 / 60);
state = navigation.cancelTarget(state);
```

| Entry point | Contract |
| --- | --- |
| `createNavigation(layout?, { radius? }?)` | Optional positive finite effective radius; default remains 0.25. Reception integration explicitly supplies 1.1. |
| `spawn(point?)` | Frozen position/path snapshot, or `null` for an invalid spawn. No automatic relocation. |
| `isValidPoint(point)` | Finite XZ, exact feet Y=0, radius-inset floor, outside inflated obstacles. |
| `isSegmentClear(from, to)` | Continuous swept footprint check, not just endpoint validation. Tangent obstacles block. |
| `move(state, direction, dt)` | Normalized nonzero direction, seconds, swept stop/slide; clears the previous route. Zero/invalid input preserves the snapshot. |
| `requestTarget(state, target)` | New immutable waypoint intent, or `invalid-target`/`unreachable` with the **same unchanged state**. Same-position request clears intent. |
| `advance(state, dt)` | Consumes the route with a distance budget, rechecking every segment. Clears finished intent at the exact destination; an obstructed route stops, never teleports. |
| `cancelTarget(state)` | Clears intent without moving. |

Snapshots copy and freeze points/paths. Retain the returned state, not a second mutable position. Valid nonzero manual input interrupts a route even when blocked. Rejected destinations deliberately preserve the previous route: a UI wishing to stop on rejection must explicitly cancel it. Invalid/negative/nonfinite frame values are ignored.

T3b must map WASD to world XZ (e.g. W → negative Z), give pointer/touch the same target request, and project genuine floor selections to feet Y=0. Do not flatten upper surfaces into valid floor targets. The core creates no keyboard listeners, focus state, GPU resources or React state. T3b must arbitrate UI/text input, cancel on focus loss/transition/interruption, and distinguish interrupted control from arrival. For long frames, follow the waypoint polyline rather than interpolating a straight chord across turns.

## Geometry source and collision policy

The room is [`receptionRoom`](../../src/features/world/reception-room.ts): placements of the module GLBs in [public/models/rooms/modules/](../../public/models/rooms/modules/), composed by [`composeRoom`](../../src/features/world/compose-room.ts). Positions are Three world space with each module's pivot at its bottom-centre; modules face +Z. The original [Blender recipe](../../scripts/blender/author_reception.py) and [split script](../../scripts/blender/split_reception_modules.py) authored them (Blender XY maps to Three XZ as `(X, -Y)`; do not apply this conversion twice). Repeated pieces are clones that share their template's geometry and materials.

[reception-layout.ts](../../src/features/world/reception-layout.ts) keeps the explicit floor envelope and derives obstacles with [derive-layout.ts](../../src/features/world/derive-layout.ts): each module declares conservative XZ footprints in [room-modules.ts](../../src/features/world/room-modules.ts), transformed by its placement (quarter-turn yaw only). Resulting rectangles:

- Tile envelope X≈±5.391, Z≈±4.716, feet Y=0. Small tile joints are treated as continuous floor. The floating plinth is not extra floor.
- Back/left wall footprints include protruding lower bands/rails and both door jambs.
- Counter front: X[-3.8,-0.3], Z[-2.25,-1.05], including inlays. Return: X[-1.5,-0.3], Z[-3.5,-2.25]. These two pieces preserve the open L recess; never replace them with the whole bounding box.
- Seat footprint includes cradle/back/arms. Planter uses its rim's square envelope, not sprawling foliage. Wall shelves conservatively block their body-height footprint.
- Hanging pendants, noticeboard, leaves and tiny countertop stationery do not create independent floor obstacles. The underlying counter still blocks.

The portal is geometrically open, but movement cannot leave the floor. It grants no access or room transition. Layout, interaction and scene tests compose the **real module GLBs** and check relevant bounds and source mesh names. The only fixture is `reception-monolith-bounds.json` (per-mesh world boxes of the retired monolith), which `compose-room.test.ts` uses to prove the composed room reproduces it.

## Provisional tuning and limitations

Speed 2.5 units/second, default radius 0.25 and grid cell 0.3 remain unchanged implementation starting points, not approved product tuning. The reception controller explicitly supplies `receptionAvatarRadius = 1.1` through the nonbreaking optional `createNavigation(layout?, { radius? })` argument. Invalid/nonpositive radii throw `RangeError`. Inflating rectangles by the selected radius models a conservative square enclosing an avatar disc. It can reject visually empty rounded corners. Movement uses whole-segment slab intersection, a bounded prefix search and deterministic X-then-Z sliding; it is not timestep sampling or a general physics engine.

Path requests use a reception-sized 8-neighbor A* lattice (roughly 1,000 cells). Exact endpoints connect only by clear segments; diagonals cannot cut corners. Tie-breaking is stable. Routes are deterministic but not guaranteed shortest; sub-grid narrow passages may conservatively return `unreachable`. The optional `Layout` argument exists for small trusted authored fixtures such as a sealed divider, not untrusted runtime geometry or another-room authorization.

Only one flat reception is supported: no stairs, jumping, navmesh, dynamic bodies, multiplayer, persistence or permission logic. Existing default-core behavior and layout geometry remain intact. CPU measurements of the original Idle posed rig at height 2 give full XZ extents approximately **1.3753 × 0.9737**, exceeding the default core's 0.5 diameter. Keeping that default for this avatar would risk clipping.

The integration therefore uses a documented **1.1-unit effective radius (2.2 diameter)**. A real-GLB regression samples 61 poses across each original Idle/Walk cycle: maximum normalized XZ AABB-corner radius measured **0.86722**, leaving about 0.23278 margin. The test checks rotated corners at 16 yaw angles; the enclosing-circle bound also covers intermediate yaw. This is deterministic sampled animation-envelope evidence, not an analytic proof of every continuous animation instant or a GPU/hardware result. It does not cover other clips, changed proportions, or alternate avatars.

**Consequential layout restriction:** the counter recess, narrow left-side passages and 2-unit portal are not traversable with the 2.2-unit conservative footprint. For example `(-2.8, 0, -3)` and `(2.4, 0, -4.4)` are rejected; the central/front/right floor remains the study area. Some apparently empty floor near furniture is deliberately unavailable. The two L colliders remain separate; no room geometry is changed, no snap-through occurs, and the portal never transitions rooms. Recovering those narrow routes would require a separately reviewed footprint/pose/layout design, not silently reverting clearance.

Parent browser checks must still examine actual counter/seat/wall contact, walking turns, overhead decorative intersections, feet and camera occlusion before gameplay/visual acceptance. The conservative footprint protects the authored structural footprints; it is not a general mesh-collision solver and does not establish that arms can never intersect decoration.

Scene tests measure real posed vertices, actual room ray hits, camera projection and core-to-transform results with a simulated R3F frame loop. Expected custom-element warnings arise from that DOM simulation. These are not GPU rendering, visual collision clearance, real touch or performance evidence. Actual browser desktop/narrow-screen behavior, hardware touch/performance and T2 independent proof remain pending. No CLI behavior changed, so a CLI differential is not applicable; original avatar regression tests retain default Idle, reduced-motion, failure and disposal coverage.

## Verify

With the existing dependencies already installed (no new dependencies needed):

```bash
pnpm test --configLoader runner src/features/world src/features/avatar/load-avatar.test.ts src/app/App.test.tsx
pnpm test --configLoader runner
pnpm typecheck
pnpm build --configLoader runner
python scripts/ci/check_docs.py docs/development/reception-navigation.md README.md
git diff --check
```

The runner config loader avoids Vite's bundled-config `.vite-temp` output; this is a scoped local validation command, not proof of default CI execution. Tests retain the original 32 cases and add rendered input/status/view arbitration, real-asset loader/animation regression, anchoring, floor picking and cleanup checks. No dependencies, manifests, CI, original models or other rooms change. These checks do not accept T2 or replace browser verification.
