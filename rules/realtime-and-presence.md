# Authoritative Realtime Rooms and Presence

Authorized users MUST see live presence and movement in their shared space without turning transient connections into persistent business records or treating visual access as permission.

## Authority and scope

- [Master §2.1–2.3](../master-document.md#21-oficinas-y-habitaciones) distinguishes persistent product rooms from live sessions and commits to movement, reconnection, disconnected-avatar removal, and remote movement interpolation/adjustment.
- [Master §6](../master-document.md#6-arquitectura-general-actualizada) assigns Colyseus live state, NestJS/PostgreSQL persistent business authority, and confirmed-change notification ordering.
- [Master §7.4](../master-document.md#74-despliegue-red-y-operación) establishes separate services and an initial single Colyseus service instance; this rule does not choose a distributed presence design.
- [Security](./security.md) applies to admission and every protected action. [Quality and testing](./quality-and-testing.md) defines verification reporting.
- [Art direction](./art-direction.md) remains the agreed visual target. Master sections 3.1 and 5 confirm React/Three.js/React Three Fiber; [Architecture](./architecture.md#decision-boundaries) defines presentation responsibilities. This rule selects no physics library, camera implementation, or asset format.
- This document defines reusable synchronization invariants, not wire event names, schemas, tick rates, reconnect durations, or evidence that a server already implements them.

## Separate persistent and live identity

| Concept | Owner | Meaning |
|---|---|---|
| Product room | NestJS/PostgreSQL | Persistent space with its privacy, membership, and business resources. |
| Colyseus `Room` session | Colyseus | Live session associated with an authorized product space and connected participants. |
| User identity and permission | Authenticated backend context | Determines who may enter, observe, or act. |
| Transient position and presence | Authoritative Colyseus state | Describes live participation, not a durable activity ledger. |
| Rendered avatar and smoothing | Frontend presentation | Represents server state; cannot create membership or permission. |

- A persistent room MUST remain a product resource when no users are connected; an empty live session is not a deletion instruction.
- A Colyseus session identifier MUST NOT be assumed to be the PostgreSQL room identifier or a durable invitation.
- The mapping between a live session and its persistent room MUST be controlled by the server, not inferred from a client-provided label.
- Recreating a live session MUST NOT create another persistent room or copy its memberships by accident.
- Closing or losing a live session MUST NOT erase tasks, messages, avatar configuration, or other persistent records.

This separation allows ephemeral sessions to recover without changing the business identity or rights of the space.

## Ownership and admission

Backend owners MUST define coherent authorization across NestJS and Colyseus. Frontend integration owners MUST manage connection/subscription lifecycle and display confirmed versus unresolved state accurately.

- Admission MUST require verifiable authenticated identity and authorization for the associated persistent room before protected room state is exposed.
- A guessed session ID, visible door, local route, or client store membership MUST NOT bypass admission checks.
- Room type alone MUST NOT replace its access rules: personal rooms are private by default, shared rooms depend on authorized access, and general rooms are for enabled users under master §2.1.
- The client MUST NOT select another participant's identity or authoritative role through a message payload.
- Protected actions received after joining MUST still be authorized for their target and current context; admission is not a permanent grant to every resource.
- Lost membership, invalid authentication, or revoked access MUST NOT leave the client entitled to receive protected updates or perform protected actions.
- HTTP failures follow the master/security `401` and `403` distinction. Realtime rejection MUST preserve that distinction in meaning without assuming HTTP status codes for every message.
- A connection outage MUST NOT be presented as proof of a permission denial, nor a denied join as proof of an empty room.

How permission changes reach live sessions is an integration decision. The invariant is that stale client state cannot extend access; this rule does not choose a polling interval or invalidation channel.

## Movement and presence authority

- Colyseus MUST own authoritative live presence and synchronized movement; the browser sends intent under a validated contract rather than assigning trusted world state.
- The server MUST validate positions, room access, and actions as necessary to preserve master §2.3's navigable world, obstacles, collisions, and access boundaries.
- Malformed input, spoofed participant identity, or an unauthorized room target MUST NOT alter authoritative presence or movement.
- A claimed position beyond a door MUST NOT grant membership, access another room's data, or authorize a business action there.
- Transient movement, per-frame render state, and interpolated positions MUST NOT produce a database write for every step.
- The persisted avatar configuration remains separate from a live avatar's position and connection lifecycle.
- Presence MUST describe the authoritative live context, not assert that an offline user is physically in a room because they have a membership record.
- Elaborate availability statuses remain a complementary feature in master §9.2; this rule MUST NOT create a status enumeration or infer activity from network silence alone.

The precise movement envelope, collision-validation strategy, input schema, and abuse thresholds remain open. “Server-authoritative” establishes ownership, not a chosen simulation algorithm.

## Client representation and interpolation

- The frontend MUST render synchronized state without making its visual objects or stores a parallel permission authority.
- Remote motion MUST support interpolation or visual adjustment as contemplated by master §2.3, while converging on accepted server state.
- Smoothing MUST NOT convert a rejected movement into a confirmed position or keep an unauthorized room visible as though access succeeded.
- Any displayed pending or locally estimated movement MUST remain subordinate to authoritative correction; this rule does not mandate prediction.
- Visual movement and corrections MUST preserve scene readability and settled human avatars under art direction, rather than replacing them with a different avatar concept.
- Presence indicators MUST NOT imply current connectivity when the client cannot establish it; stale/unresolved state needs honest feedback.
- Essential application interfaces and permission checks MUST NOT depend on the bot, avatar, or rendering engine being the authority.

For navigation and interaction detail, see `rules/movement-and-interactions.md`; for avatar behavior, see `rules/avatars-and-customization.md`. Neither path here defines a rendering implementation.

## Reconnect, removal, and scope cleanup

| Situation | Required behavior | Boundary |
|---|---|---|
| Authorized initial join | Receive the correct room's authoritative live state. | Do not reuse another room's cached participants as current. |
| Temporary connection loss | Show uncertainty and support the agreed reconnect flow. | Do not claim uninterrupted presence or invent a fixed grace period. |
| Reconnect attempt | Establish valid identity, room association, and current access. | A prior session alone does not preserve revoked permission. |
| Server recognizes disconnection/removal | Remove the departed avatar from the relevant authoritative live state and clients. | Removal timing remains unspecified, not optional forever. |
| Room switch | Release old room subscriptions and reconcile the destination context. | Late old-room data cannot populate the destination. |
| Logout or account switch | Release authenticated subscriptions and clear affected private state. | A late callback cannot restore the previous account's room. |
| Live session is recreated | Reconcile with its authoritative current state. | Do not treat an obsolete session snapshot as the new session's truth. |
| Admission fails | Explain the failure without exposing protected room contents. | Do not fabricate successful presence. |

- Reconnection MUST reconcile current authoritative state; it MUST NOT blindly replay an old local snapshot as trusted room state.
- Duplicate or late messages MUST NOT create duplicate participants, resurrect removed participants, or repeat persistent business effects.
- Data MUST remain scoped to the authenticated account, persistent room, and relevant live session lifecycle; a matching display name is not sufficient correlation.
- Older data MUST NOT overwrite newer authoritative state simply because it arrives later. The contract MUST make stale/duplicate handling unambiguous without relying on arrival order alone.
- Cleanup MUST include listeners and in-flight work that could apply results after the owning room or account has changed.

These invariants require a defined contract, but do not choose sequence fields, ordering algorithms, timeouts, or a multi-tab identity policy. One avatar per connection versus per user remains unresolved below.

## Persistent changes before broadcast

- NestJS/PostgreSQL MUST remain the authority for persistent tasks, room settings, messages, meetings, and other business records.
- Colyseus MUST coordinate persistent operations through secure backend application contracts, not trust a client assertion that a write succeeded.
- A persistent change MUST be authorized, validated, and confirmed by the business authority before it is broadcast as a successful change.
- Pending visual feedback MAY be shown only as pending; it MUST NOT be represented as a confirmed broadcast or saved record.
- Failed persistence MUST NOT produce a successful task-change, message, or meeting announcement to other participants.
- A notification MUST NOT create a second write merely because another client receives it; repeated delivery cannot duplicate the business effect.
- Broadcast recipients MUST be authorized for the resource. Being in a live room MUST NOT disclose a user's unrelated private resource.
- If persistence succeeds but notification fails, feedback MUST NOT falsely say the persistent operation failed. Reconciliation MUST use the business authority instead of blindly repeating a write.

Master §6.2's event names are illustrative, not approved protocol identifiers. Default live room synchronization belongs to Colyseus; a separate Socket.IO channel MUST NOT be introduced without a justified independent need and an agreed contract.

## Correct and incorrect examples

**Correct:** A user selects a door. The server checks identity and destination access, maps the authorized product room to a live session, and only then exposes its protected state.

**Incorrect:** The browser changes its room ID and starts receiving participants because the door was visible in the scene.

**Correct:** The frontend adjusts a remote avatar toward accepted server movement and removes it when authoritative state removes that participant.

**Incorrect:** A stale update from the previous session recreates the avatar after a room switch, or each interpolated step is saved in PostgreSQL.

**Correct:** A task mutation succeeds in NestJS/PostgreSQL before authorized peers receive a change notification. If notification fails, clients reconcile against persisted data.

**Incorrect:** Colyseus announces a completed task immediately from a client message, then tries to save it; a rejected write leaves peers believing it succeeded.

## Open decisions — not implicit approvals

- Exact admission credentials, session mapping contracts, reconnect behavior, removal timing, and handling of permission changes require backend/frontend agreement; no timeout or token format is chosen here.
- Multi-tab or multi-device identity, simultaneous participation across rooms, and how duplicate connections map to avatars remain unresolved; examples MUST NOT settle one-avatar-per-user or one-avatar-per-connection.
- Movement bounds, validation algorithms, tick/update frequency, interpolation technique, and correction presentation remain to be specified separately from the confirmed rendering stack.
- Ordering, deduplication, snapshot reconciliation, missed-notification recovery, and mutation correlation mechanisms need explicit contracts; this rule defines outcomes only.
- Additional activity states and any justified dedicated messaging channel require separate decisions, not assumed enums or Socket.IO installation.
- Horizontal scaling requires the strategy identified in master §7.4; no broker, distributed presence layer, or multi-instance architecture is selected here.
- Cross-repository contract distribution and ownership remain unresolved. Frontend types or illustrative events MUST NOT silently become a shared contract package.

## Observable acceptance checks

These describe future implementation evidence; passing a documentation check does not prove realtime compliance.

- [ ] Unauthorized direct joins, spoofed identities, and protected messages fail without exposing another room's state.
- [ ] Two authorized users observe shared presence and server-accepted movement; client claims cannot grant access or override rejected movement.
- [ ] Movement does not produce per-step database rows, and leaving an empty live session does not delete the persistent room.
- [ ] Disconnect, removal, reconnect, permission loss, logout, and room/account switches reconcile state without private leaks or ghost participants.
- [ ] Delayed and duplicate data cannot resurrect removed participants, contaminate another room, or duplicate a business mutation.
- [ ] Persistence failure produces no success broadcast; notification failure after persistence does not cause an unsafe duplicate write.
- [ ] Visual corrections remain readable under art direction within the confirmed rendering stack, without claiming image-reference fidelity.
