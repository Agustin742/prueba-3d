# Frontend Code Conventions

Organize frontend code by responsibility and feature, without prescribing an unapproved directory scaffold.

## Modules and names

- Code language follows [Quality and testing](./quality-and-testing.md#code-language).
- Feature code **SHOULD** keep its UI, integration, and tests discoverable together; shared code **MUST** have a genuinely cross-feature responsibility.
- Components **MUST** use PascalCase names. Hooks **MUST** use the use prefix and follow React hook rules.
- Contributors **MUST NOT** add generic utilities, base classes, or wrappers solely for hypothetical reuse.
- Modules **SHOULD** avoid circular dependencies and imports into another feature's private files.

## TypeScript and React

- Public module boundaries and external data **MUST** have explicit types. Type assertions **MUST NOT** substitute for runtime validation.
- Unexpected external values **SHOULD** enter as unknown until validated. Unavoidable any usage **MUST** be narrow and justified.
- Components **MUST** keep rendering free of network calls, subscriptions, and other side effects.
- Effects **MUST** clean up subscriptions and resources; repeated setup **MUST NOT** duplicate listeners or connections.
- Derived values **SHOULD** be calculated from their source instead of synchronized through extra effects.
- Lists **MUST** use stable identity when items can be reordered or edited.
- Memoization **SHOULD** address a demonstrated need rather than obscure otherwise simple code.

## Verification

Reviewers **MUST** check module responsibility, boundary types, stable identity, and lifecycle cleanup. Follow the [state ownership rules](./state-management.md) rather than inventing a separate store per component.
