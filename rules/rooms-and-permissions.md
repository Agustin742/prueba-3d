# Rooms and Permissions

Users must be able to enter authorized spaces without confusing a visible room, a persistent membership, or a live connection with permission to use its resources.

## Authority and scope

- [Master §2.1](../master-document.md#21-oficinas-y-habitaciones) defines room types, automatic personal rooms, invitations, privacy, and persistent room identity.
- [Master §2.6](../master-document.md#26-acceso-roles-y-permisos) establishes minimum owner/member roles and server-side isolation.
- [Master §6](../master-document.md#6-arquitectura-general-actualizada) establishes persistence, realtime responsibilities, and authentication boundaries.
- [Security](./security.md) governs protected operations; [Quality and testing](./quality-and-testing.md) governs evidence.
- These rules refine established behavior and derived integrity constraints, not an approved permission matrix or database schema.
- Master sections 3.1 and 5 confirm React/Three.js/React Three Fiber; [Architecture](./architecture.md#decision-boundaries) defines presentation responsibilities. [Art direction](./art-direction.md) remains the agreed visual target, with its own qualified starting points and open choices.

## Room types and durable identity

| Type | Established access boundary | Established purpose |
|---|---|---|
| Personal | Private by default; visibility configurable | A user's own organization, avatar, and personalization space |
| Shared | Membership, permissions, or invitation as applicable | Collaboration, tasks, messages, and member presence |
| General | Enabled users, not unrestricted anonymous access | Gathering, announcements, meetings, and access to other rooms |

- Registration **MUST** provide the user with an automatically created personal room, as required by master §2.1 and the MVP.
- Personal-room creation **MUST NOT** depend on opening the scene or establishing a Colyseus connection.
- A failed provisioning attempt **MUST NOT** be presented as a successfully available room; recovery mechanics remain a backend contract decision.
- Rooms **MUST** remain persistent product resources when nobody is connected.
- A room type **MUST NOT** silently determine every resource permission: access to tasks, messages, settings, or meetings still requires the relevant authorization.
- The general room **MUST NOT** be treated as publicly readable merely because it serves as a common gathering place.
- Personal-room visibility changes **MUST NOT** implicitly make all associated private records public.

### Membership is not presence

A membership describes a durable user-to-room relationship. Presence describes an authenticated live connection associated with a room. They answer different questions.

- Disconnecting **MUST NOT** remove a membership or delete the room's persistent resources.
- A membership **MUST NOT** imply that the user currently has a visible avatar in the room.
- A live connection **MUST NOT** be treated as proof that every later operation is authorized.
- A persistent product room and a Colyseus `Room` session **MUST** have distinct identities and lifecycles, with their association controlled by the server.
- Client-supplied room or session identifiers **MUST NOT** establish that association authoritatively.
- Movement and presence **MUST NOT** generate a PostgreSQL write per step; they belong to the live session boundary.

## Ownership and authorization

| Owner | Required responsibility |
|---|---|
| NestJS / PostgreSQL | Persistent rooms, memberships, privacy settings, and authorized business changes |
| Colyseus | Live session admission, presence, movement, and permission checks for received actions |
| Frontend | Show context, request actions, represent pending/rejected results, and clear inaccessible state |
| Backend and frontend maintainers | Agree on consumed contracts without assuming a cross-repository distribution mechanism |

- Authorization **MUST** distinguish at least room administrator/owner and member, as established by master §2.6.
- Implementations **MUST NOT** infer an exact capability matrix from those names. Additional roles and global administrators remain undecided.
- Every protected read or mutation **MUST** verify identity and applicable role, ownership, or membership server-side.
- Visibility, discovery, admission, and resource modification **MUST NOT** be treated as interchangeable permissions.
- A visible door, an open panel, a cached room, or a client store **MUST NOT** grant authority.
- Bot-mediated room actions **MUST** obey the same backend permission boundary as direct actions.
- A rejected action **MUST NOT** change persistent room, membership, or resource state. This is derived from authorization and integrity, not a new room feature.
- HTTP authentication and permission failures **MUST** follow [Security](./security.md); realtime rejection **MUST** preserve equivalent access boundaries without inventing HTTP codes for WSS messages.

## Privacy and invitations

- Authorized users **MUST** be able to manage the established configurable privacy/visibility behavior; which role may change each setting remains an explicit capability decision.
- Shared-room creation and invitations by link or code **MUST** be supported within the source scope.
- Invitation validation **MUST** occur on the server before granting the resulting access.
- Possession of a link or code **MUST NOT** bypass authentication or authorize unrelated resources.
- An invalid or unauthorized invitation attempt **MUST NOT** create a membership or reveal protected room contents.
- Invitation presentation **SHOULD** explain rejection without exposing sensitive room or user information.
- Link/code lifetime, reuse, revocation, and whether acceptance creates membership **MUST NOT** be guessed by a client implementation.
- Entry requests are contemplated in master §2.6 and classified as complementary in §9.2; a mandatory approval workflow **MUST NOT** be added to every room.

## Normal and boundary scenarios

| Scenario | Required observable result |
|---|---|
| Newly registered user enters their personal room | The persistent room exists and server-authorized admission precedes live presence |
| Authorized member reconnects to a shared room | Session presence returns without recreating membership or business records |
| Last connected user leaves | Live presence ends; the persistent room and its records remain |
| User approaches a visible but unauthorized door | Entry is rejected; spatial proximity grants no permission |
| User changes an identifier to another personal room | Protected data remains unavailable and rejected writes leave state unchanged |
| Privacy changes while a panel is open | Later protected actions use current server authorization, not the panel's previous access |
| Admission cannot be verified because of a network failure | UI reports an unresolved connection, not confirmed membership or access |
| Logout or account switch races with a room response | Old private data cannot populate the new context |

A permission change **MUST NOT** be defeated by a stale cache or already-open connection. The propagation mechanism and timing remain contract decisions; later protected actions must still be checked.

## Correct and incorrect examples

**Correct:** A door sends an entry intention for a persistent room. The server validates the user and room authorization, then associates the accepted live session with that space.

**Incorrect:** A door sets `canEnter = true` in Zustand and connects using any room identifier supplied by the browser.

**Correct:** An offline shared-room member still has the durable relationship; their avatar appears only after authorized connection.

**Incorrect:** Removing the final avatar deletes the shared room or silently removes all offline members.

**Correct:** A settings panel reflects capabilities returned through the agreed contract and handles a later server denial.

**Incorrect:** An example grants members invitation powers or owners every administrative action merely because of their role name.

## Observable acceptance checks

Apply [Quality and testing](./quality-and-testing.md); these checks describe required evidence, not current runtime compliance.

- [ ] Registration yields a persistent personal room that is private by default.
- [ ] Shared-room creation and invitation access are checked through their agreed public contracts.
- [ ] Personal/shared/general access scenarios preserve their distinct boundaries.
- [ ] Direct API and realtime attempts with missing identity, insufficient permissions, and foreign IDs cannot bypass authorization.
- [ ] Failed protected mutations leave persisted records unchanged.
- [ ] Disconnect/reconnect preserves room and membership records while presence changes.
- [ ] Visible objects, frontend stores, and bot requests cannot independently authorize access.
- [ ] Lost access, logout, and late responses clear or isolate affected private state under [Security](./security.md), without leaking it into another account or room.
- [ ] Room layouts preserve readable doors, routes, and human avatars under [Art direction](./art-direction.md) within the confirmed rendering stack.

## Open decisions — not implementation defaults

- Exact owner/member capabilities; possible guest/global roles; ownership transfer and room removal behavior.
- Privacy/visibility options, discovery behavior, and the scope of any direct-access or entry-request flow.
- Invitation validity, reuse, revocation, and membership effects; no expiration or one-use policy is selected here.
- Permission-change propagation and active-session handling; no timeout or eviction protocol is selected here.
- Personal-room provisioning recovery and the mapping of persistent rooms to live instances.
- Authoritative contract publication and distribution between the independent repositories.

Decisions **MUST** be recorded with the responsible backend and frontend owners before consumers rely on them. Examples above demonstrate invariants only, not additional approved roles or workflows.
