# Forms and Validation

Forms must help users correct input without losing their work. Client validation supports usability; backend validation remains authoritative.

## Form boundaries

- React forms **SHOULD** use the agreed React Hook Form and Zod stack rather than introduce a competing form system without approval.
- Validation schemas **MUST** match the agreed [API contract](./api-contracts.md), including optional values, limits, and cross-field constraints.
- Required status and format expectations **MUST** be visible before submission where relevant.
- Normalization **MUST NOT** silently alter meaningful user content; credentials **MUST NOT** be trimmed or transformed unless the authentication contract explicitly requires it.
- Field errors **MUST** be associated with their controls. Unknown server errors **MUST** remain visible at form level rather than be discarded.

## Submission and drafts

- A pending submission **MUST** have visible feedback and protection against accidental duplicate submission.
- A failed submission **MUST** preserve safe editable values. Sensitive values **MUST NOT** be persisted merely to preserve a draft.
- Forms **MUST NOT** clear or announce success before the operation is confirmed, unless explicitly presenting a reversible pending state.
- Leaving a form with meaningful unsaved changes **SHOULD** allow the user to avoid accidental loss.
- User-provided values **MUST** remain untrusted; follow [Security](./security.md).

## Verification

Check valid submission, named validation boundaries, backend rejection, repeated submission, and failure recovery. Verify both visible errors and whether user input is preserved.
