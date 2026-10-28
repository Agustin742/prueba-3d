# Use React/Three.js/React Three Fiber and author models in Blender

**Outcome:** use React for the web application and functional interfaces, Three.js for the real 3D world, React Three Fiber (R3F) for declarative scene composition, and Blender to author original models. This aligns the rendering rules with [master sections 3.1 and 5](../../master-document.md#5-stack-y-responsabilidades-técnicas); it is not evidence of a working application.

## Approval and question resolved

The question was whether rendering remained undecided and which tool to use for model authoring. The user explicitly confirmed:

> A bueno, usemos React + Three.js + React Three Fiber para la web y Blender para crear los modelos, todo esto claro en una rama aparte, creo que no nos debemos olvidar de los Test antes con TDD cierto?

This records the actual user's approval, not an entire-team vote or merge approval. The rendering choice already appears in the master; this record resolves contradictory engine-undecided assertions in the affected rules and records Blender authoring. It does not change the [decision approval policy](../../rules/documentation-and-decisions.md) or [Git workflow](../../rules/git-workflow.md).

## Rationale and trade-offs

| Choice | Why it fits | Alternative and concession |
|---|---|---|
| Three.js | Supports the master's real 3D geometry, models, lighting, animation, and spatial interaction. | PixiJS/2.5D sprites simplify some rendering, but do not meet the current real-3D direction. Three.js requires explicit asset, camera, collision, and performance work. |
| React + R3F | Keeps application panels in React and composes Three.js scenes within the same component/lifecycle model. | Imperative Three.js integration remains possible, but requires more manual scene-to-React lifecycle coordination. R3F adds concepts and requires careful resource cleanup and frame-loop boundaries. |
| Blender | Supports authored silhouettes, bevels, materials, rigs, and animation rather than presenting placeholder primitives as finished rooms. | Code-generated meshes suit simple modules; they are not a substitute for finished art. Blender adds source/export management and requires in-engine scale, material, and animation validation. |

## Scope and contracts

- The current implementation target is a local-only navigable room foundation: reuse `public/models/character.glb`, author rooms and props, and validate movement, collisions, and object feedback. Preserve the existing avatar asset; this decision does not approve a replacement or overwrite.
- React owns functional panels when needed; scene interactions communicate intent. Decorative feedback and direct transitions need not open panels. [Architecture](../../rules/architecture.md) preserves business and integration boundaries.
- [Art direction](../../rules/art-direction.md) remains the sole visual source. This record adds no palette, proportions, room accents, or finished-art acceptance criteria.
- Work stays on the separate feature branch `feat/interactive-room-foundation`. Deterministic behavior changes require test-first RED/GREEN evidence; passive documentation has no meaningful behavior-level RED and instead receives [documentation checks](../../README.md#ci).
- This documentation slice adds no application, dependencies, or assets. Local interactions do not establish persisted business success. Authentication, backend authorization, persistence, chat, and multiplayer remain product commitments, not implemented capabilities demonstrated by this decision.

## Still unresolved

| Area | What this decision does not settle |
|---|---|
| Numeric and visual tuning | Module M, exact dimensions, speed, interaction distance, camera framing, performance budgets, final proportions, palette validation, and room accents. Orthographic projection is the master baseline; visual camera alternatives still listed in art direction require validation and explicit reconciliation before a change. |
| Rig and animation | Reuse/compatibility of existing clips in-engine, animation blending, IK, procedural deformation, morphs, and the general customization rig contract. Choosing Blender does not choose these techniques. |
| Traversal and collisions | Collision representation/library, pathfinding, destination resolution, input precedence, touch mapping, and correction tuning; see [Movement and interactions](../../rules/movement-and-interactions.md#open-decisions--not-implied-requirements). |
| Asset delivery and integration | General export settings, compression, loading/delivery budgets, customization asset contracts, and cross-repository contract ownership. Reusing a GLB does not settle the whole pipeline. |

Validate these details incrementally at gameplay and mobile scale. Record consequential new decisions and update affected authoritative documents rather than treating an example or this stack choice as blanket approval.
