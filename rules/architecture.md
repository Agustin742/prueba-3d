# Architecture and Responsibility Boundaries

Keep presentation, application behavior, and external integrations separate enough to change without rewriting unrelated features.

## Decision boundaries

- The expected visual design is defined by [Art direction](./art-direction.md). The [project document](../master-document.md), sections 3.1 and 5, confirms React, Three.js, and React Three Fiber for the web experience.
- React owns application interfaces; Three.js owns 3D representation and spatial selection; React Three Fiber composes the Three.js scene declaratively within React. Scene selection communicates intent, not business authorization.
- Blender is the confirmed model-authoring tool; the [decision record](../docs/decisions/rendering-and-authoring.md) records approval, trade-offs, and unresolved implementation details.
- Contributors **MUST NOT** replace the confirmed rendering stack or introduce another architectural framework or cross-repository shared package as an incidental implementation choice.
- Other agreed product and technology decisions remain governed by the [project document](../master-document.md); unresolved choices follow [decision rules](./documentation-and-decisions.md).

## Responsibilities

| Area | Responsibility |
|---|---|
| Presentation | Display data, collect input, and communicate user intent |
| Application behavior | Coordinate use cases and their observable states |
| Integration boundary | Adapt API and realtime contracts to application needs |
| Backend | Authorize operations and validate persistent business changes |
| Visual environment | Represent the agreed art direction and expose interactions |

- Visual objects **MUST NOT** be the only owners of business rules or permission decisions.
- Feature code **SHOULD** expose narrow entry points rather than depend on another feature's private implementation.
- Shared modules **MUST NOT** import feature-specific UI. Extract shared code only for an actual common responsibility.
- API and realtime access **MUST** use explicit integration boundaries rather than be scattered through unrelated UI or visual objects.
- Subscriptions, connections, and external resources **MUST** have explicit lifecycle owners and cleanup.

## Verification

A change **MUST** identify the responsible feature, its external boundaries, and how resources are released. Moving or replacing the visual implementation **SHOULD NOT** require redefining task, permission, or API rules.
