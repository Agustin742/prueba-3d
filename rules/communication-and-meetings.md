# Communication and Meetings

Users must be able to exchange authorized room messages, consult persisted history, and discover relevant announcements and meetings without treating presence or a contextual interface as permission.

## Authority and scope

- [Master §2.4](../master-document.md#24-comunicación-y-reuniones) establishes room chat with persistent authorized history, contextual private messaging, meetings, notices, and attendance confirmation.
- [Master §2.2](../master-document.md#22-objetos-y-elementos-interactuables) gives phone, noticeboard, and calendar examples; they are not a fixed object catalog.
- [Master §6.2](../master-document.md#62-canales-y-propiedad-de-los-datos) assigns message history and meeting CRUD to NestJS/PostgreSQL, with live messaging through Colyseus by default.
- [Master §9.1](../master-document.md#91-mvp-para-el-proyecto-integrador--objetivo-de-entrega) requires authorized room messaging and consulting general-room announcements or meetings in the MVP journey.
- [Master §9.2](../master-document.md#92-funcionalidades-complementarias) classifies more complete direct messaging, reminders, and advanced activity summaries as complementary.
- [Security](./security.md) and [Quality and testing](./quality-and-testing.md) remain the common authorization and verification policies.
- This document defines behavior boundaries, not message lifecycle features, meeting workflows, or approved attendance values.

## Ownership and confirmed information

| Owner | Responsibility |
|---|---|
| NestJS / PostgreSQL | Authorize and persist message history, meetings, announcements, and applicable attendance records |
| Colyseus | Deliver authorized live room messaging and change notifications without becoming the history database |
| Frontend | Display scoped history and contextual panels, retain safe input, and represent pending or failed actions |
| Backend AI tools | Consult or summarize only information the requesting user may access |

- Persistent communication records **MUST** remain available under their access rules after reload or restart; a live broadcast alone does not meet the history commitment.
- Live notifications of persistent changes **MUST** correspond to backend-confirmed records, following master §6.2.
- A received realtime event **MUST NOT** independently establish permanent storage or grant access to another resource.
- Socket.IO **MAY** serve a justified independent channel under the master; it **MUST NOT** be installed by default or duplicate Colyseus room synchronization.
- Client caches and local conversation arrays **MUST NOT** become authoritative message or meeting stores.
- Frontend and backend owners **MUST** agree on observable contracts without assuming a shared package or cross-repository distribution strategy.

## Room chat and history

- Every history read and message submission **MUST** enforce identity and the applicable room/resource access rules server-side.
- Membership and live presence **MUST** remain distinct: an offline member is not a connected avatar, and a connected avatar is not a universal communication permission.
- Historical access before joining, after leaving, or after a permission change **MUST** follow an explicit contract; room membership **MUST NOT** be interpreted as an unlimited historical grant.
- History queries and caches **MUST** carry the appropriate user and room scope, so one context cannot reuse another's protected records under [Security](./security.md).
- Changing a room or message identifier **MUST NOT** reveal another room's protected history.
- Sending content **MUST** be validated server-side and handled as untrusted user content under [Security](./security.md).
- A visible chat object or open conversation panel **MUST NOT** authorize sending, reading, or summarizing content.
- Empty history **MUST** be distinguishable from loading, denied access, and failure to retrieve history.
- Presentation **SHOULD** make the current room/conversation context clear so users do not mistake one destination for another.
- A rejected send **MUST NOT** create a persisted message or confirmed room broadcast. This derives from authorization and data integrity, not an extra moderation workflow.

## Contextual private messaging

The source establishes contextual private messaging, for example through a phone interface. It does not approve a full messenger product or all possible direct-message lifecycle features.

- A private-message interface **MUST** make its intended conversation context clear before submission.
- The backend **MUST** validate access to the private conversation and its records; selecting a user in the UI is not sufficient authority.
- Private message content **MUST NOT** be broadcast to an unrelated room audience simply because participants share that room.
- Authorized persistent history **MUST** remain governed by the backend history boundary, not by whether a phone object currently exists on screen.
- The UI **MUST NOT** expose unauthorized recipients or conversations through search, cached results, or guessed identifiers.
- Contextual access **SHOULD** preserve the surrounding room experience and offer the essential alternative access required by master §3.2.
- More complete direct messaging **MAY** be developed as a complementary extension; it **MUST NOT** silently become an MVP requirement.
- Arbitrary cross-room reachability, groups, attachments, delivery/read receipts, and blocking policies are not approved by these examples.

## Announcements, meetings, and attendance

- General-room and other enabled-space announcements and meetings **MUST** respect the space's access rules; general does not mean anonymous public access.
- The MVP journey **MUST** allow users to consult announcements or meetings in the general room as stated in master §9.1.
- Publishing or changing persistent announcements/meetings **MUST** be authorized by NestJS; this document does not grant those actions to a particular role.
- A noticeboard or calendar **MUST** display backend-authorized records, not independent copies with conflicting saved details.
- Meeting/calendar representations **MUST** preserve the associated space and the contract's distinction between an instant, a calendar date, and a local scheduled time.
- Meeting schedules **MUST NOT** silently inherit the daily briefing timezone; date, instant, and local scheduled-time semantics require an explicit contract.
- Attendance confirmation **MUST** be supported within master §2.4 scope and validated for the relevant user and meeting.
- A disconnected user **MUST NOT** be treated as having withdrawn attendance; presence is not a saved attendance response.
- A connected avatar **MUST NOT** automatically count as an attendance confirmation.
- Rejected publication or attendance actions **MUST NOT** modify the persisted record or announce a successful change.
- Reminder delivery, calendar synchronization, recurring meetings, and attendance approval gates are not established requirements.

## Input and failure recovery

- Message composers and meeting/announcement forms **MUST** show validation failures and pending submissions, prevent accidental repeated submission, and preserve safe input in the authorized context.
- Pending sends or attendance changes **MUST NOT** be presented as confirmed records before acknowledgement of the persistent result.
- Failed submissions **MUST** retain safe editable input in the authorized context and provide understandable feedback.
- Draft preservation **MUST NOT** expose previous-account or inaccessible-room content after logout or lost access.
- A transport timeout **MUST NOT** be assumed to mean that nothing was saved; reconcile the outcome before repeating a write.
- Retries **MUST** be bounded and safe against duplicate effects; optimistic display **MUST** reconcile rejected or uncertain outcomes without inventing a retry interval or duplicate-suppression protocol.
- Late responses and reconnect updates **MUST NOT** inject another room's messages into the active conversation.
- A bot summary **MUST NOT** reveal communication outside the requesting user's authorized scope.

## Normal, failure, and boundary scenarios

| Scenario | Required observable result |
|---|---|
| Authorized user sends a room message | Saved content appears in authorized history and confirmed live delivery |
| Recipient reconnects or reloads | Authorized persisted history is available independently of prior live delivery |
| User opens a private conversation from a phone | Destination context is clear and backend access is checked |
| User guesses a foreign conversation identifier | Protected content remains unavailable; rejected sends leave records unchanged |
| Permission is lost while composing | Submission is denied and inaccessible content is not retained through stale client state |
| Send times out after possible persistence | UI reports uncertainty and reconciles before sending again |
| User confirms attendance then disconnects | Saved attendance is not replaced by presence state |
| Meeting appears in multiple authorized views | Schedule and associated space agree across those views |
| Room changes while history is loading | The old response cannot populate the new room's conversation |

## Correct and incorrect examples

**Correct:** A noticeboard opens authorized meeting details. An attendance action is pending until the server confirms the saved response.

**Incorrect:** Walking near the meeting table writes attendance or grants publication rights.

**Correct:** A failed message submission keeps safe editable text while clearly distinguishing it from confirmed history.

**Incorrect:** A local message bubble is counted as persisted, or an automatic retry produces another message without reconciling the first outcome.

**Correct:** A phone is one contextual entry point into private communication; permission is checked independently of the object.

**Incorrect:** The phone example is used to mandate attachments, read receipts, retention periods, or a named attendance enumeration.

## Observable acceptance checks

Use [Quality and testing](./quality-and-testing.md); these are verification expectations, not a claim of implemented runtime compliance.

- [ ] Authorized room messages remain in accessible history after reload and backend restart.
- [ ] Unauthorized reads, sends, publications, and attendance mutations cannot change or expose persistent records.
- [ ] Foreign-ID requests and stale room/account responses preserve conversation isolation.
- [ ] Loading, empty history, rejection, transport failure, pending send, and confirmed history are distinguishable.
- [ ] Safe composer input survives failure without leaking across logout or lost access.
- [ ] Private communication is not delivered to unrelated room audiences.
- [ ] Announcement/meeting views agree on authorized records and schedule meaning.
- [ ] Attendance remains separate from transient presence and changes only through authorized action.
- [ ] Contextual UI preserves [Art direction](./art-direction.md), scene readability, and human avatars without choosing a renderer or duplicating visual tokens.

## Open decisions — not implementation defaults

- Message ordering, history pagination, historical-access boundaries, and delivery reconciliation contracts.
- Message editing/deletion, retention, moderation, receipts, and attachment behavior; none is selected here.
- Private-conversation eligibility and expanded messenger features; detailed expansions remain complementary.
- Publication capabilities, meeting fields, schedule/timezone semantics, attendance values, and permitted changes.
- Meeting deletion/editing lifecycle details, reminders, recurrence, and external calendar integration.
- Transport deduplication, reconnect recovery details, and cross-repository contract publication/distribution.

These choices **MUST** be resolved explicitly by the responsible product and backend/frontend owners before examples or UI placeholders are treated as commitments.
