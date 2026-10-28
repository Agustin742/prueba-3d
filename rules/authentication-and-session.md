# Authentication and Session Lifecycle

The frontend must represent session state consistently without acting as the security authority. Baseline authorization requirements remain in [Security](./security.md).

## Session states

- The application **MUST** distinguish session initialization, authenticated access, unauthenticated access, and inability to verify a session.
- Protected content **MUST NOT** flash while initial session validity is unresolved.
- A network failure **MUST NOT** automatically be treated as invalid credentials or successful logout.
- Token/cookie storage, renewal, and server-side invalidation contracts **MUST** be agreed with backend owners before implementation. This rule does not select a session mechanism.
- Redirect destinations **MUST** be constrained to approved application locations rather than trust arbitrary supplied URLs.

## Expiration and logout

- Invalid authentication **MUST** lead to the agreed unauthenticated flow. Insufficient permission **MUST NOT** cause an endless login loop.
- If renewal exists, it **MUST** have bounded recovery and **MUST NOT** replay non-idempotent operations without an explicit safe contract.
- Logout **MUST** remove protected frontend content, private cached data, and authenticated subscriptions.
- If server-side logout cannot be confirmed, feedback **MUST NOT** claim that the server session was invalidated.
- Account changes and late responses **MUST NOT** expose the previous user's data; see [State management](./state-management.md).

## Verification

Check initial loading, expired credentials, forbidden resources, offline behavior, logout, and account switching. Backend authorization **MUST** also be verified directly as required by [Security](./security.md#verification-and-ownership).
