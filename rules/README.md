# Project Rules

This directory contains the project's **permanent rules and conventions**. Its documents establish consistent expectations for design, technology usage, architecture, module responsibilities, and development practices.

Rules describe **how the project must be designed and built**. They are not implementation tasks, step-by-step tutorials, feature backlogs, or work plans.

## Relationship to the project document

- The main project document defines the product's overall scope, capabilities, and technology choices.
- The files in `rules/` define the standards and constraints that govern those choices.
- The implementation must follow both. A rule must not silently override the main project document.
- The [course requirements](./project-requirements.md) preserve academic requirements and evaluation criteria extracted from the temporary course brief; they do not depend on retaining its PDF. Section 10 of the [project document](../master-document.md#10-cumplimiento-del-enunciado-integrartec-2026) maps them to the product; do not duplicate that checklist here.
- Proposed product or technology choices require explicit team agreement before they become implementation constraints. Conflicts with the official brief must be resolved explicitly, not silently reinterpreted.

## Writing criteria

- **Write every rule in English**, including headings, explanations, and examples.
- Use English filenames for project documents and source files; use lowercase hyphen-separated names for rule documents, such as `art-direction.md`. Keep personal names and standard filenames such as `README.md` unchanged.
- Use clear, direct, unambiguous language.
- Use **MUST** and **MUST NOT** for mandatory requirements and prohibitions; use **SHOULD** for preferred practices and **MAY** for permitted alternatives.
- Write reusable rules applicable across the project, not instructions for a specific task.
- Define responsibilities, boundaries, conventions, and restrictions only where relevant to the rule's subject.
- Explain important constraints when the rationale helps prevent misuse.
- Avoid restating the same rule in multiple files; link to its authoritative document when necessary.
- Do not introduce technologies, features, or decisions that conflict with the main project document.
- Use examples only to clarify a rule, not to introduce requirements by accident.
- Keep documents current when the underlying contract changes.

## Rule index

### Product behavior

- [Rooms and permissions](./rooms-and-permissions.md) — room types, durable membership, privacy, invitations, and server-authorized access.
- [Tasks and productivity](./tasks-and-productivity.md) — persisted CRUD, list/Kanban consistency, validation, and uncertain writes.
- [Communication and meetings](./communication-and-meetings.md) — authorized history, contextual messaging, announcements, meetings, and attendance.
- [AI bot and daily briefing](./ai-bot-and-daily-briefing.md) — authorized tools, Argentina-local daily identity, duplicate prevention, and provider failure.
- [Movement and interactions](./movement-and-interactions.md) — WASD/click/touch navigation, input arbitration, collisions, and accessible interaction.
- [Avatars and customization](./avatars-and-customization.md) — confirmed appearance, persistence, authorized visibility, and fallback integrity.
- [Realtime and presence](./realtime-and-presence.md) — authoritative sessions, reconnection, stale-state cleanup, and persistence-before-broadcast.

### Coordination and decisions

- [GitHub Projects](./github-projects.md) — work ownership, status, issue/PR traceability, and completion evidence without assuming board configuration.
- [Documentation and decisions](./documentation-and-decisions.md) — approved choices, proposals, exceptions, and authoritative sources.

### Architecture and integration

- [Architecture](./architecture.md) — responsibility boundaries for the confirmed React/Three.js/React Three Fiber stack.
- [Frontend conventions](./frontend-conventions.md) — modules, TypeScript boundaries, React composition, and lifecycle cleanup.
- [State management](./state-management.md) — local, server, shared client, and realtime state ownership.
- [API contracts](./api-contracts.md) — cross-repository ownership, payloads, compatibility, and integration evidence.
- [Authentication and session](./authentication-and-session.md) — session states, expiration, logout, and account isolation without selecting a session mechanism.
- [Data and time](./data-and-time.md) — opaque identity, optional values, dates, time zones, and persistence boundaries.

### Experience and operation

- [UI and accessibility](./ui-and-accessibility.md) — consistent controls, keyboard/touch access, focus, responsive behavior, and motion.
- [Forms and validation](./forms-and-validation.md) — schemas, field/server errors, pending submissions, and safe draft preservation.
- [Error handling and feedback](./error-handling-and-feedback.md) — visible states, bounded recovery, and uncertain operation outcomes.
- [Configuration and environments](./configuration-and-environments.md) — public configuration, validation, and environment isolation.
- [Observability and privacy](./observability-and-privacy.md) — safe diagnostics, collection boundaries, and evidence.
- [Deployment and operations](./deployment-and-operations.md) — deployment ownership, revision-bound verification, and recovery planning.

### Existing project-wide policies

- [Course requirements and evaluation](./project-requirements.md) — academic minimums, recommendations, documentation, milestones, and evaluation criteria.
- [Git and GitHub workflow](./git-workflow.md) — branches, English Conventional Commits, pull requests, reviews, and merges.
- [Code quality and testing](./quality-and-testing.md) — English code, verification, and definition of done.
- [Security](./security.md) — secrets, permissions, validation, and frontend/backend boundaries.
- [Responsible AI usage](./ai-usage.md) — human verification, privacy, and declaration of use.
- [Art direction](./art-direction.md) — visual language, palette, avatars, environments, materials, lighting, camera, and acceptance criteria.

## How to use the rules

Read the relevant rules before designing, implementing, modifying, or reviewing a part of the project. Apply them consistently regardless of whether the work is performed manually or with an AI coding assistant.

When a rule needs to change, update its source document explicitly rather than silently deviating in code.

The expected art direction is agreed; React, Three.js, and React Three Fiber are confirmed by the [project document](../master-document.md), sections 3.1 and 5. The [rendering and authoring decision](../docs/decisions/rendering-and-authoring.md) records the user's confirmation and Blender authoring choice. Detailed scene, rig, and collision choices remain open. The product rules separate these unresolved choices from requirements. No rule here claims that application code, board automation, or deployed infrastructure already exists.

## Document template

[`example.md`](./example.md) is a **neutral writing template**. Its headings and placeholders show a possible format only: they do not establish any technical, visual, or architectural rule. Adapt or omit sections to fit each subject.
