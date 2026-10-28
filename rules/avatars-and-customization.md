# Avatars and Customization

Each user MUST have a recognizable human avatar whose confirmed customization persists and whose live representation is visible only within authorized shared-room participation.

## Authority and scope

- [Master document](../master-document.md), sections 1, 2.3, and 3.1, establishes customizable avatars, persistent configuration, shared presence, and the 3D visual direction.
- Master sections 5–6 assign persistent business records to NestJS/PostgreSQL and live room state to Colyseus; section 6.4 identifies `AvatarConfiguration` without defining its storage shape.
- Master sections 3.1 and 5 confirm React/Three.js/React Three Fiber. The [rendering and authoring decision](../docs/decisions/rendering-and-authoring.md) records Blender authoring; this does not finalize a customization asset pipeline or rig.
- [Art direction](./art-direction.md), especially Avatars, Camera and spatial readability, and Intellectual property, is the agreed visual target and sole source for palette and proportions.
- Its numerical starting points, optional techniques, and open questions MUST retain their qualifications. This document neither duplicates them nor makes them final.
- [Security](./security.md) supplies ownership, validation, and privacy boundaries; [Quality and testing](./quality-and-testing.md) supplies evidence expectations.

MUST and MUST NOT are requirements; SHOULD is an expectation whose exception needs a reason; MAY denotes an option, not a promised feature.
This document governs configuration integrity and observable representation. It does not define a customization catalog, animation rig, inventory, equipment system, or upload feature.

## Ownership and normal flow

| Concern | Authority | Boundary |
|---|---|---|
| Editable preview | Frontend draft state | Local preview is not a saved business record. |
| Confirmed configuration | NestJS/PostgreSQL | Validate the authenticated user's authority and accepted values. |
| Authorized live representation | Colyseus room state and authorized backend data | Synchronize relevant appearance without making room state the persistence owner. |
| Visual construction | Art direction and scene contributors | Preserve the human design and readability without inventing another style guide. |
| Identity and permissions | Server-side identity and access checks | Appearance and local stores never grant access or establish identity. |

1. The client obtains the current user's authorized confirmed configuration.
2. Available customization controls may create a visibly unsaved local draft.
3. A persistence operation reaches NestJS, which validates identity, ownership, and configuration.
4. Only a confirmed outcome is represented as saved and used as the confirmed appearance for authorized live distribution.
5. Reloads obtain the persisted configuration; joining a live session does not create another independent saved appearance.

This is an authority sequence, not a selection of manual save, autosave, endpoints, event names, or storage format.
The frontend MUST coordinate backend-dependent validation and synchronization with backend owners rather than claiming that preview behavior proves persistence.

## Human visual target and readability

- Avatars MUST represent human people, not creatures, animals, or copied game characters.
- Shape, facial language, proportions, clothing treatment, colors, and animation style MUST follow art direction rather than a new specification here.
- Customization MUST retain the shared visual language; diversity of appearance SHOULD remain compatible with that language.
- Orientation, pose or action, and the main hairstyle or accessory MUST be distinguishable at normal gameplay distance, not only in a customization close-up.
- Where accessories are offered, they MUST remain readable from the elevated camera and MUST NOT cover the eyes, as art direction requires.
- Avatars MUST remain distinguishable from the floor without relying on hue alone.
- Scene composition MUST NOT continuously hide avatars; surrounding props and walls are part of the readability check.
- Reduced/mobile views MUST be included when evaluating readability. A detailed preview alone is insufficient evidence.
- Motion SHOULD preserve the agreed soft, readable character language without requiring any particular rig, bone count, or deformation technique.
- Designs MUST be original; reference-inspired style is not permission to copy external characters, models, logos, or distinctive assets.

**Rationale:** customization supports social recognition in a shared office. Appearance that works only at close range defeats the master's presence goal even when its preview looks complete.
No screenshot or reference-image fidelity is asserted by this document; visual acceptance requires later evaluation of actual rendered results.

## Persistent configuration and validation

- The user's confirmed customization MUST persist through reloads and service restarts under the master's persistence commitment.
- NestJS MUST enforce who can read or update configuration; an identifier supplied by the browser is not evidence of ownership.
- A user MUST NOT alter another user's configuration by changing an identifier or sending a forged realtime message.
- The server MUST validate submitted values and combinations against the approved customization contract. Client controls are usability aids, not the validation boundary.
- Unsupported or invalid configuration MUST NOT be accepted merely because the browser can render it.
- Configuration MUST NOT be treated as executable markup, script, or trusted HTML.
- Stored appearance MUST remain separate from per-frame positions, interpolation, and active connections. Live movement MUST NOT rewrite customization on every step.
- Colyseus state MUST NOT become the only saved copy of the avatar; destroying a live session MUST NOT erase the user's confirmed configuration.
- A cache or client store MUST NOT silently replace authoritative saved data with a local draft.
- Concurrent updates or delayed responses MUST NOT leave the UI claiming that a rejected or superseded draft is the current confirmed appearance.

The last rule is an integrity requirement, not a chosen conflict-resolution strategy. Its purpose is to keep the saved-status claim consistent with the business authority.

## Draft, confirmation, and failure

| Situation | Required user-visible distinction |
|---|---|
| Loading configuration | Loading is not evidence that the user has no saved customization. |
| Editing a preview | Draft changes are clearly unsaved and do not redefine the confirmed record. |
| Persistence pending | Pending is distinct from confirmed; a changed preview is not proof of success. |
| Confirmed operation | The UI reconciles to the accepted configuration rather than assuming every submitted value was stored. |
| Rejected operation | Explain the failure safely; retain useful draft input when possible without presenting it as saved. |
| Uncertain network result | Reconcile with authoritative data before claiming success or repeating a potentially completed write. |
| Missing or unusable visual resources | Explain the limitation where needed and preserve a safe, understandable representation. |

- Draft customization MUST NOT be published to other occupants as confirmed appearance before the business operation is confirmed.
- A failed update MUST NOT destroy or replace the last confirmed configuration with an invalid preview.
- Expected cancellation MUST NOT be reported as a persistence failure. Canceling a draft MUST NOT falsely imply that an already confirmed operation was undone.
- Logout or account changes MUST clear or invalidate private draft/configuration state and associated subscriptions.
- Late responses for another account or obsolete room context MUST NOT restore its private data into the current context.
- Recovery MUST NOT assume that a timeout proves no write occurred. An explicit contract is required before automatically retrying writes.

Draft and cache lifecycle conventions are developed in `rules/state-management.md`; pending/uncertain outcomes are developed in `rules/error-handling-and-feedback.md`.
These references describe integration seams, not new storage or save workflows.

## Live visibility and fallback boundaries

- Other users' avatars MUST be shown in the context of authorized co-room participation, consistent with master section 2.3.
- Room admission and applicable configuration access MUST be server-authorized. Seeing an avatar or accessory grants no membership, role, or business permission.
- A persistent room and a Colyseus `Room` session MUST remain distinct; a new connection does not create another persistent avatar identity.
- Join and reconnect flows MUST reconcile appearance with the authoritative confirmed configuration rather than reuse an unrelated cached user's appearance.
- Leaving, disconnecting, or losing access MUST NOT leave a representation falsely implying active authorized presence; exact reconnection timing belongs to the realtime contract.
- Appearance updates MUST NOT broadcast private configuration data to unrelated rooms or unauthorized recipients. Only data appropriate for authorized rendering should cross that boundary.
- Public profile visibility beyond shared-room participation is not established by these rules.
- If a resource cannot render, fallback MUST preserve the association with the correct user and the distinction between confirmed data and a rendering problem.
- A visual fallback MUST NOT silently overwrite persistent configuration or create a saved default merely because a resource is unavailable.
- Fallback SHOULD preserve readable presence and access to essential authorized UI where feasible; it MUST NOT invent another user's appearance or claim an unrendered accessory is visible.

**Rationale:** persistence failure, resource-loading failure, and lost room access are different conditions. Treating all three as a reset would lose customization or misrepresent who is present.
This rule deliberately selects no fallback model, color, accessory, storage migration, or default configuration.

## Scenarios and examples

| Scenario | Correct behavior | Incorrect behavior |
|---|---|---|
| Confirmed change and reload | Reload retrieves the accepted persistent configuration. | Reload restores only the preview stored in a browser tab. |
| Two authorized occupants | Both render the user's confirmed appearance in the shared room. | Publish appearance into every room because a user is online. |
| Rejected customization | Keep the last confirmed record and identify the draft failure. | Broadcast the preview as saved before validation. |
| Forged owner identifier | Reject modification of another user's configuration server-side. | Trust the owner selected in a client store. |
| Resource load failure | Keep confirmed data intact and use an honest visual fallback. | Persist a replacement default over valid customization. |
| Normal elevated view | Orientation and the offered main accessory remain legible. | Accept an accessory because it looks clear only in close-up. |
| Pending update during account switch | Discard or isolate old-account responses and drafts. | Apply the old response to the new user's avatar. |

## Observable acceptance checks

These are future implementation checks, not evidence that runtime behavior already exists.

- [ ] Human design, original assets, and normal-view readability satisfy art direction without a second palette/proportion specification.
- [ ] Offered customization remains readable in an occupied room and at reduced/mobile view, including orientation and accessories where present.
- [ ] Confirmed appearance survives reload and service restart; destroying a live session does not erase configuration.
- [ ] Draft, pending, confirmed, rejected, and uncertain outcomes are distinguishable and do not mislead other occupants.
- [ ] Direct requests using another user's identity or unsupported values cannot alter their configuration or bypass validation.
- [ ] Authorized occupants see applicable confirmed appearance; unrelated rooms and unauthorized users do not receive private configuration.
- [ ] Disconnect, room changes, logout, and account changes reconcile presence and clear or isolate stale state.
- [ ] Missing resources do not overwrite confirmed configuration or falsely associate an avatar with another user.
- [ ] Concurrent or delayed updates do not label a rejected or superseded preview as current saved appearance.

## Open decisions — not implied requirements

- Catalog contents, selectable categories, slots, option counts, combinations, and customization limits remain undecided.
- Save triggers, preview layout, draft recovery, simultaneous-edit conflict policy, and exact validation contracts require product/backend agreement.
- Initial configuration and fallback appearance remain undecided; examples above do not choose defaults or require a reset feature.
- The general customization asset contract, delivery pipeline, rigs, morph systems, and animation implementation remain undecided. Reusing the existing `public/models/character.glb` for the local foundation does not finalize those contracts or authorize replacing the asset.
- Uploads, inventory, unlocks, commerce, public profiles, and expanded decoration are not required by this document; they need separate approval if proposed.
- Live update delivery details, reconnect windows, and the cross-repository distribution of contracts remain unresolved; no event schema, timeout, or shared package is selected.
- Art direction retains its own open choices, including final measurements and animation complexity; these rules do not close them.
