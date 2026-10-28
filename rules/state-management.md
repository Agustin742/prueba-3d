# State Ownership and Synchronization

Every state value needs an identifiable source of truth and lifecycle.

## Ownership

| Kind of state | Preferred owner |
|---|---|
| Input, open controls, short-lived component state | Local React state |
| Persistent server data and query lifecycle | TanStack Query |
| Shared client-only preferences and UI coordination | Zustand |
| Authoritative synchronized room state | Realtime service and its client integration |
| Values calculated from other state | Derived values, not another mutable copy |

- Stores **MUST NOT** become parallel authoritative copies of server queries or synchronized room data.
- Form drafts **MAY** differ from saved data, but **MUST** be clearly identified as unsaved.
- Network operations **MUST NOT** be initiated merely because a presentational component reads a store.

## Updates and cleanup

- Query keys **MUST** include the relevant user and resource scope so unrelated sessions or rooms cannot share private results accidentally.
- Mutations **MUST** reconcile affected data through the query lifecycle or an explicitly documented event strategy.
- Optimistic updates **MAY** be used when rollback and conflicts are defined; pending data **MUST NOT** be presented as confirmed.
- Logout, account changes, and lost room access **MUST** clear or invalidate affected private state and release subscriptions.
- Late responses from a previous session or room **MUST NOT** restore its data into the current context.
- Persisted client state **MUST** have a justified purpose and cleanup policy; it **MUST NOT** become a substitute for server persistence.

## Verification

Changes **MUST** check relevant reload, room-switch, logout, and failed-update scenarios. State retaining sensitive content follows [Security](./security.md).
