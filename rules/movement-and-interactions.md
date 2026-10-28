# Movement and Interactions

Users MUST be able to navigate the shared 3D space and reach authorized tools without confusing movement, interface input, or visual feedback with a business operation.

## Authority and scope

- [Master document](../master-document.md), sections 2.2–2.3, 3.2, and 9.1, establishes movement, spatial interactions, alternative access, and the usable product journey.
- Master sections 3.1 and 5 confirm React/Three.js/React Three Fiber. The [rendering and authoring decision](../docs/decisions/rendering-and-authoring.md) records Blender authoring; neither choice selects a physics or pathfinding implementation.
- [Art direction](./art-direction.md), especially Camera and spatial readability, governs the agreed isometric/elevated visual target. Its numeric starting points and open choices remain qualified there.
- Master sections 5–6 establish NestJS/PostgreSQL business authority and Colyseus live-state authority.
- [Security](./security.md) governs authorization and untrusted input; [Quality and testing](./quality-and-testing.md) governs verification evidence.
- These rules define observable behavior, not physics, pathfinding, camera algorithms, event schemas, or a fixed interactive-object catalog.

MUST and MUST NOT are requirements; SHOULD is an expectation whose exception needs a reason; MAY denotes an option, not an approved new feature.
Derived integrity rules below preserve the master's separation of visual intent, live state, and persistent business effects.

## Ownership and normal flow

| Responsibility | Owner and boundary |
|---|---|
| Input and scene feedback | Frontend translates user input into intent and presents pending or rejected outcomes. |
| Functional panels | React owns forms and application interfaces when the interaction needs them. |
| Live movement and presence | Colyseus owns synchronized room state and necessary server-side validation. |
| Persistent operations and access | NestJS validates business actions against authoritative records in PostgreSQL. |
| Visual readability | Scene contributors apply art direction without introducing another palette or camera specification. |

1. The user enters a room through authenticated, authorized admission.
2. Available input moves the avatar on traversable surfaces or selects an interaction.
3. The application separates movement intent, local decoration, and protected actions.
4. The relevant server authority validates protected effects; the client displays the actual outcome.
5. Other authorized occupants receive applicable live state, without database writes for every step.

A persistent product room MUST NOT be confused with a Colyseus `Room` session. Recreating a live session does not create a new persistent room or grant membership.

## Navigation contract

- Keyboard devices MUST support WASD movement. Mouse input MUST include clicking a destination, not only selecting objects.
- Mouse-driven actions MUST have touch equivalents that do not depend on hover. This requirement does not select a gesture mapping or virtual controller.
- Movement MUST occur in a real 3D world, primarily on traversable surfaces, respecting obstacles and collisions.
- A visible floor area MUST NOT automatically be treated as reachable; its surface, connections, and obstructions matter.
- A destination on another elevation MUST NOT cause passage through an intervening wall or unsupported space merely because its screen position is selectable.
- The implementation MUST distinguish navigable space from decorative geometry and interactive targets sufficiently to avoid unintended actions.
- Movement SHOULD feel fluid locally while remaining consistent with the validated live state. A local visual prediction MUST NOT become authority for room access or persistent effects.
- Server validation MUST reject movement or action claims that violate the applicable room boundary and traversal constraints. The exact validation model remains open.
- Movement MUST NOT create a PostgreSQL record for every step or rendered frame.

**Rationale:** the master commits to surfaces, obstacles, collisions, and synchronized movement, not a flat image with unrestricted coordinate changes. These constraints preserve that commitment without choosing a simulation technique.

## Input arbitration and interruption

- Typing in a form, chat, or other text control MUST NOT move the avatar through WASD or trigger unrelated world shortcuts.
- Activating a UI control MUST NOT also activate a world object behind it or issue a click destination.
- Dialogs MUST prevent accidental background interaction, manage focus, and return focus to a meaningful location when closed.
- Closing a panel MUST NOT replay an earlier pointer action or a movement key that is no longer held.
- Loss of input focus, logout, or loss of room access MUST NOT leave stale movement input driving the avatar.
- Room transitions MUST NOT carry a previous room's destination or delayed action into the newly active room.
- Disconnection or interrupted navigation MUST NOT be presented as confirmed arrival. The UI MUST distinguish unavailable control from ordinary idle presence.
- Recovery MUST reconcile with the current authorized room and live state rather than assume an old local destination remains valid.
- Users MUST have an understandable way to interrupt or replace ongoing navigation intent. The control mapping and input precedence remain open.

These constraints prevent a single user action from producing unrelated effects; they do not prescribe whether a particular nonmodal panel pauses movement.
Input and focus conventions are developed in `rules/ui-and-accessibility.md`; recovery conventions are developed in `rules/error-handling-and-feedback.md`.

## Object interactions and permission boundaries

| Interaction class | Required distinction | Illustrative example, not a catalog |
|---|---|---|
| Local decorative response | Animation MUST NOT imply a persistent business effect. | A decorative prop reacts visually. |
| Functional interface | React presents the interface when needed; opening it does not authorize its operations. | A board opens a task view. |
| Direct protected action | The server validates the action even if no panel opens. | A door requests a room transition. |

- Interactions MUST NOT be required to open a React panel universally. Decoration and direct transitions are valid interaction classes in master section 2.2.
- Selection, proximity, object visibility, and successful animation MUST NOT confer permission to read or change a resource.
- Every protected action MUST be authorized server-side, whether requested from a scene object, alternative interface, forged message, or AI tool.
- A frontend store, scene object, or AI response MUST NOT decide permissions or manufacture confirmed business success.
- The interface MUST distinguish pending, confirmed, denied, and uncertain outcomes when relevant; a local animation MUST NOT replace that feedback.
- An inaccessible destination MUST NOT produce forbidden traversal or false arrival. A denied business action MUST leave its protected records unchanged; feedback MUST explain the limitation without exposing private destination content.
- A transition MUST NOT expose destination-room resources before authorized admission. A visible door is an affordance, not an access credential.
- Essential functions MUST have keyboard-accessible or alternative UI access without requiring precise selection of a 3D object.
- Alternative access MUST use the same resource scope and server checks as scene interaction, not a privileged bypass.

## Spatial readability and camera

- The camera MUST preserve the agreed isometric or elevated three-quarter reading. Free-camera navigation is not an initial product requirement.
- Routes, doors, obstacles, and enough surrounding floor to anticipate movement MUST remain understandable at normal view and reduced/mobile sizes.
- Scene composition MUST NOT continuously hide avatars behind walls or vegetation; the solution is not prescribed here.
- Interactive affordances and focus MUST NOT depend on color alone; touch users MUST receive usable feedback without hover.
- Decorative density and motion SHOULD preserve clear routes and distinguish actual controls from ambient animation.
- Camera angles, projection choice, dimensions, palette, and avatar proportions MUST remain sourced from art direction, including its unresolved parameters.

## Scenarios and examples

| Scenario | Correct behavior | Incorrect behavior |
|---|---|---|
| Normal navigation | WASD and click destination move within valid space; touch offers equivalent actions. | Mouse selects props but cannot request a destination. |
| Obstructed or disconnected surface | Report or visibly indicate inability to reach the target without false arrival. | Move through furniture or across an unconnected elevation. |
| Typing and dialog use | Chat input owns keystrokes; dialog activation does not click through. | Typing a word containing W moves the avatar. |
| Permission changes before action | Revalidate the protected effect and reject lost access. | Trust permissions captured when a door first appeared. |
| Network interruption | Indicate interrupted control and reconcile authorized live state on recovery. | Keep showing successful remote travel from local prediction. |
| Essential tool is occluded | Offer equivalent accessible UI for the authorized tool. | Require pixel-precise selection behind a wall. |
| Decorative selection | Show only the intended local response. | Treat a prop's animation as a confirmed task update. |

## Observable acceptance checks

These are future implementation checks, not claims of runtime compliance.

- [ ] WASD, mouse click destination, and touch equivalents reach valid destinations without bypassing obstacles.
- [ ] An unreachable surface, blocked destination, and different elevation do not produce false arrival or unauthorized traversal.
- [ ] Typing, modal focus, pointer activation over UI, focus loss, and resumed input do not leak stale movement.
- [ ] Room switching, disconnect, and revoked access discard or reconcile old intent without exposing another room.
- [ ] A decorative response, panel-opening object, and direct transition demonstrate distinct outcomes.
- [ ] Direct unauthorized requests fail even when a local object or panel remains visible.
- [ ] Essential functions remain usable with keyboard/alternative UI and touch without hover or precise world pointing.
- [ ] Normal and reduced views preserve avatars, routes, and object affordances under the art-direction criteria.
- [ ] Live movement uses Colyseus state without a persistent write per step; persistent effects remain business-authorized.

## Open decisions — not implied requirements

- Input precedence, gesture mapping, interruption controls, movement speed, and interaction distance remain undecided.
- Traversal representation, collision/physics implementation, pathfinding, destination resolution, and correction tuning remain undecided.
- Camera implementation, projection choice, occlusion treatment, and performance budgets require decisions consistent with art direction.
- Object-specific trigger conditions and failure feedback need definition as interactions are approved; example objects do not establish a mandatory catalog.
- Reconnection timing and precise recovery behavior require a shared realtime contract; this document selects no timeout or automatic replay policy.
- Cross-repository contract ownership and distribution remain unresolved in master section 5; no shared package or transport schema is selected here.
