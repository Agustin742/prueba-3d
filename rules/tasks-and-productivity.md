# Tasks and Productivity

Users must be able to manage authorized tasks through list and Kanban views while retaining their input, understanding write outcomes, and preserving the surrounding room context.

## Authority and scope

- [Master §2.5](../master-document.md#25-productividad) commits to task CRUD, list/Kanban organization, dates, states, responsible users, and contextual feedback.
- [Master §2.2](../master-document.md#22-objetos-y-elementos-interactuables) makes boards and calendars illustrative interaction entry points, not exclusive access mechanisms.
- [Master §6.2](../master-document.md#62-canales-y-propiedad-de-los-datos) assigns persistent changes to NestJS/PostgreSQL and subsequent live notification to Colyseus.
- [Master §9.1](../master-document.md#91-mvp-para-el-proyecto-integrador--objetivo-de-entrega) and §10, R5, require usable, persisted task CRUD in the production journey.
- [Security](./security.md) and [Quality and testing](./quality-and-testing.md) supply the common validation, feedback, and evidence requirements.
- These rules define observable invariants, not a selected task schema, status enumeration, assignment matrix, or concurrency protocol.

## Task scope and responsibilities

| Owner | Responsibility |
|---|---|
| NestJS / PostgreSQL | Authorize task access, validate changes, and persist canonical task records and associations |
| Frontend task feature | Render list/Kanban/forms, retain safe drafts, and reconcile confirmed results |
| Colyseus | Notify authorized active clients after confirmed changes; not a competing task database |
| Backend bot tools | Apply task rules when executing an authorized user-requested action |

- Tasks **MUST** be associated with users and/or authorized rooms as established in master §2.5.
- Each read and mutation **MUST** enforce its relevant user/room boundary server-side, including access through manipulated identifiers.
- Room visibility, session presence, an open board, and a frontend store **MUST NOT** confer task permissions.
- A client **MUST NOT** invent ownership, responsible users, or room associations to make an otherwise unauthorized request valid.
- Task records **MUST** survive reloads and server restarts; drafts and optimistic cards are not persistence evidence.
- Rejected changes **MUST NOT** alter persistent task records or associations. This follows from authorization and data integrity, rather than introducing another workflow step.
- The task feature **MUST NOT** write movement or presence into the task database as a side effect of using a board.

## CRUD behavior

| Operation | Required behavior | Failure boundary |
|---|---|---|
| Create | Validate authorized scope and input; expose the confirmed new task | Do not present an unsaved draft as a persisted task |
| Read/list | Return only tasks accessible within the requested scope | Do not render a denied query as a legitimate empty list |
| Update | Validate the task, proposed values, and authority before confirming changes | Preserve useful editable input and explain rejection |
| Delete | Remove the authorized task according to the agreed persistence contract | Do not report success or permanently hide it after a rejected request |

- All four operations **MUST** be available in the authorized task journey; a decorative board or local-only CRUD does not meet the master commitment.
- The UI **MUST** distinguish loading, a genuinely empty result, available content, and query failure.
- An unsuccessful refresh **SHOULD** preserve usable prior content with a visible stale/error indication, unless access has been lost.
- Deletion confirmation, undo, soft deletion, and recovery behavior are not selected by the CRUD commitment.

## List and Kanban consistency

The views organize the same persisted tasks. Dragging a card changes presentation intent; it is not evidence that the backend accepted a change.

- List and Kanban **MUST** derive task identity and saved values from the same authoritative records.
- Equivalent scope and filters **MUST NOT** produce contradictory saved states between the views.
- A task state shown as a Kanban column **MUST** come from the agreed module contract, not from an assumed industry-standard workflow.
- Dragging across columns **MUST** request an authorized, validated state change where the module contract supports that interaction.
- A rejected move **MUST** restore or explicitly reconcile the pending presentation so it cannot appear permanently saved.
- Switching views **MUST NOT** create a duplicate task or silently discard a pending edit.
- View-specific ordering **MAY** differ when documented; manual persisted ordering and its rules are not established here.
- The agreed dnd-kit stack in master §5 **MUST NOT** be interpreted as approval for a particular board workflow.

## Input, dates, and responsible users

- Client validation **MUST** support usability; server validation **MUST** enforce integrity independently.
- Forms **MUST** expose field or form-level validation errors and preserve safe editable input after rejection; server validation remains authoritative under [Security](./security.md).
- Field requirements, lengths, date constraints, and available states **MUST** follow an agreed contract, not placeholder examples.
- Dates and responsible users **MUST** be supported within the module scope; which fields are required and who may assign whom remain open.
- A submitted responsible user or room association **MUST** be validated against the eventual assignment/access rules server-side.
- User selectors **MUST NOT** expose unauthorized user information simply to populate assignment options.
- Date handling **MUST** preserve the agreed distinction between an instant, calendar date, and local scheduled time. A date-only deadline **MUST NOT** shift merely because the browser timezone changes.
- The daily briefing timezone **MUST NOT** silently become the scheduling timezone for every task.
- Invalid or missing date values **MUST NOT** be silently converted into a misleading deadline.

## Pending writes and recovery

- Create, edit, delete, and Kanban mutations **MUST** visibly distinguish pending work from confirmed results.
- Repeated activation during a pending submission **MUST** be guarded against accidental duplicate submission.
- Safe editable input **MUST** remain available after validation or transport failure within the authorized context.
- Preserving a draft **MUST NOT** retain inaccessible private content after logout, account switch, or lost access; clear or isolate affected private state under [Security](./security.md).
- A timeout **MUST NOT** be treated as proof that a task write failed. Reconcile its outcome before repeating a potentially duplicating action.
- Automatic retries **MUST** be bounded and safe against duplicate effects. Optimistic changes **MUST** reconcile rejected outcomes; no retry count or conflict algorithm is selected here.
- Confirmed changes **MUST** update affected views through an explicit reconciliation strategy; live notifications **MUST NOT** claim a change the backend rejected.
- Concurrent edits **MUST NOT** be described as safely merged unless that behavior is defined and verified by the contract.
- Opening or using a task panel **SHOULD** preserve room context rather than force an unrelated navigation reset.

## Normal, failure, and boundary scenarios

| Scenario | Required observable result |
|---|---|
| Authorized user creates a task from a board | Confirmation appears and the task remains after reload |
| User edits a task, then switches to list view | Both views reflect the confirmed record without duplication |
| Kanban move is denied | Feedback appears and the pending card is reconciled |
| Invalid input is rejected by the backend | Field/form errors are visible and safe editable input remains |
| Create request times out after reaching the backend | Outcome is unresolved until reconciled, not blindly resubmitted |
| User substitutes a foreign task or room ID | No protected read or persistent mutation succeeds |
| Date is displayed in another browser timezone | The original date/instant meaning is preserved |
| A late response arrives after switching rooms/accounts | It cannot populate the wrong task context |
| Two clients edit the same task | Each client represents confirmed or unresolved outcomes honestly; no invented merge guarantee |

## Correct and incorrect examples

**Correct:** A card move is marked pending; after server confirmation, both views reflect the saved state. On rejection, the draft intent is reconciled and the error remains understandable.

**Incorrect:** Moving a card in a local array is announced as saved, while reloading restores a different state.

**Correct:** A date input follows the module's agreed date semantics; the backend validates the submitted association and value.

**Incorrect:** An example silently mandates a set of status names, member-to-owner assignment permissions, or a specific deadline rule.

## Observable acceptance checks

These checks guide implementation evidence under [Quality and testing](./quality-and-testing.md); this document does not certify a running feature.

- [ ] Authorized create/read/update/delete succeed and persist after reload and restart.
- [ ] Direct unauthorized CRUD and foreign-ID attempts leave persistent state unchanged.
- [ ] List and Kanban agree for equivalent scope, including after failed writes and refreshes.
- [ ] Loading, empty, error, pending, and confirmed outcomes are visibly distinct.
- [ ] Validation failure preserves safe input; pending submission does not accidentally create duplicates.
- [ ] Uncertain writes are reconciled before retrying, without assuming an unapproved conflict protocol.
- [ ] Dates and responsible-user associations follow the agreed contract and reject invalid inputs.
- [ ] Contextual panels retain usable room context and follow accessible alternative access from master §3.2.
- [ ] [Art direction](./art-direction.md) remains the sole visual target; no renderer, palette, proportions, or asset format is selected here.

## Open decisions — not implementation defaults

- Task fields, requiredness, status vocabulary, allowed transitions, and board-column mapping.
- Assignment eligibility, number of responsible users, and exact ownership/room-association capabilities.
- Deadline semantics, timezone policy, ordering, filtering, and pagination where applicable.
- Concurrency/conflict handling, mutation deduplication, and live reconciliation details.
- Deletion interaction and persistence semantics; undo and recurrence are not established requirements.
- Cross-repository contract distribution remains unresolved; examples are not published API contracts.
