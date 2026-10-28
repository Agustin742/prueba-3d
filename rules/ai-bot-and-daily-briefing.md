# Authorized AI Assistance and Daily Briefing

The bot MUST help a user organize authorized work and present a daily briefing on that user's first authenticated connection of each Argentina calendar day, without inventing access or making unsolicited changes.

## Authority and scope

- [Master §4](../master-document.md#4-bot-con-inteligencia-artificial) establishes conversations, authorized server tools, and the daily routine; §4.1 defines its daily identity and optional provider-outage fallback.
- [Master §5–6](../master-document.md#5-stack-y-responsabilidades-técnicas) assigns inference and tools to NestJS, persistence to PostgreSQL, and live room state to Colyseus. §7.3 describes the end-to-end daily flow.
- [Security](./security.md) governs identity, resource isolation, secrets, and safe errors. [Quality and testing](./quality-and-testing.md) governs verification and evidence.
- Master sections 3.1 and 5 confirm React/Three.js/React Three Fiber; [Architecture](./architecture.md#decision-boundaries) defines presentation responsibilities. [Art direction](./art-direction.md) is the agreed visual target, with its own qualified starting points and open decisions.
- This rule defines observable domain constraints, not an API schema, database migration, delivery state machine, model selection, or claim of implemented behavior.

## Ownership

| Concern | Responsible authority | Boundary |
|---|---|---|
| Identity and resource access | NestJS and business services | Neither the model nor a browser store grants permissions. |
| Daily eligibility and duplicate prevention | NestJS with persistent PostgreSQL records | Browser memory and a Colyseus session are not daily records. |
| Context selection and tool execution | NestJS | Bedrock output is a proposal, not an authorized command. |
| Generated wording | Amazon Bedrock invoked by NestJS | Text MUST NOT fabricate successful business effects. |
| Presentation and cleanup | Frontend | Show the active user's result, not a previous account's response. |

Backend owners MUST define persistence and execution contracts; frontend owners MUST implement their public states without claiming client-only enforcement is sufficient.

## First authenticated connection and daily identity

- Eligibility MUST be evaluated for an authenticated user, not an anonymous page load or a bot object's visibility.
- The daily identity MUST combine the authenticated user with a calendar date interpreted in `America/Argentina/Buenos_Aires`.
- The server MUST determine that date from authoritative time; browser locale, timezone, clock, or a supplied date MUST NOT override eligibility.
- Two users connecting on the same date MUST have independent eligibility. One user's receipt MUST NOT suppress another's briefing.
- A room change MUST NOT create another daily entitlement: the routine belongs to the user/date, not the room, device, tab, or live connection.
- A reload, reconnect, or subsequent authenticated connection on the same date MUST NOT start another independent daily delivery.
- The next local calendar date provides a new daily identity. A rolling elapsed-day interval or a UTC date MUST NOT replace the agreed calendar rule.
- Remaining online across midnight MUST NOT silently become a new scheduled-push feature: the source trigger is the first authenticated connection of the day.

These constraints preserve the master’s once-per-user/day promise across clients and server restarts. They do not define the precise application lifecycle event that implements an authenticated connection.

### Persistent atomic duplicate prevention

- The daily record MUST persist beyond reloads, reconnects, and service restarts; `DailyReviewDelivery` is a conceptual entity in master §6.4, not an approved schema here.
- Competing attempts for the same user/date MUST be arbitrated atomically, or by an equivalent persistent mechanism that preserves the same invariant.
- A separate read followed by an unprotected write MUST NOT be treated as concurrency protection: two tabs can both observe an absent record.
- Duplicate detection MUST occur on the server; hiding a second popup or retaining a local flag is not sufficient.
- A losing concurrent attempt MUST NOT independently deliver a second daily briefing merely because it is a different connection.
- If authoritative eligibility cannot be established, the system MUST NOT guess that no delivery exists and generate an independent duplicate.
- Provider failure or lost delivery acknowledgment MUST NOT be interpreted as permission to bypass the daily identity.

Atomic eligibility does not prove that the user saw a response. The implementation MUST distinguish its actual evidence from an assertion of end-to-end receipt; exact recovery and marking semantics remain open below.

## Authorized content and suggestions

The normal flow is to establish identity and eligibility, obtain authorized current context, optionally generate wording through Bedrock, and present the result in the active user's context.

- Context MAY include pending or near-due tasks, today's meetings/events, relevant announcements, and suggested next steps, as allowed by master §4.1.
- Context MUST be filtered by the user's actual access before it is sent to the model or exposed in a structured result.
- A known room identifier, an invitation shown in conversation, or an avatar standing beside an object MUST NOT establish permission to read its resources.
- Summaries of conversations MUST use only spaces and content the user is authorized to access. The bot MUST NOT automatically inspect third-party private rooms.
- Missing or denied context MUST NOT be represented as a confirmed empty workload. Empty authorized results and failed retrieval require different feedback.
- Generated suggestions MUST remain suggestions until the user requests an action that the server authorizes.
- The daily briefing MUST NOT automatically complete tasks, change assignees, publish messages, or modify meetings just because those actions seem useful.
- Generated content MUST NOT be treated as trusted executable input or trusted HTML; the security policy continues to apply.

If context or authorization changes while work is in flight, protected delivery and tool execution MUST respect current access rather than rely solely on the earlier prompt. The coordination mechanism is not selected here.

## Server tools and intent authorization

- Bedrock calls, provider credentials, and IAM permissions MUST remain server-side under NestJS; the browser MUST NOT call Bedrock with application credentials.
- Every protected tool invocation MUST validate the user's identity, resource scope, input, and permission in the responsible business service.
- A model-provided user ID, role, room ID, or claim of permission MUST NOT override authenticated server context.
- Retrieved messages and model text MUST NOT grant new permissions or authorize additional tools. Content that asks the bot to ignore rules remains untrusted content.
- A requested mutation MUST match the user's authorized intent. A request to summarize tasks does not authorize completing them.
- Authorized intent is not an invented universal second-confirmation gate. Specific tool confirmation requirements remain open unless another approved domain policy supplies them.
- If an intended target or action is ambiguous, the system MUST NOT silently choose a different protected resource or broader mutation.
- A tool's success MUST be reported only after the persistent business operation is confirmed; generated claims alone are not evidence of success.
- An uncertain write outcome MUST be reconciled before replaying the operation in a way that could duplicate effects.

Creating, updating, or completing tasks are source-approved capabilities, not permission exemptions. Other operations require an approved domain contract before being exposed as tools; this rule does not create a new tool catalog.

## Failure and boundary scenarios

| Scenario | Required observable behavior |
|---|---|
| First authenticated connection, eligible date | Present a personalized authorized daily result; no unsolicited mutations. |
| Two tabs race for the same user/date | Persistent arbitration prevents independent duplicate daily deliveries. |
| Reload after the routine, same date | No new automatic daily delivery, even with empty browser storage. |
| Connections just before and after Argentina midnight | Evaluate distinct local dates, regardless of browser timezone. |
| Earlier request completes after the day changes | Preserve its originating user/date identity; do not relabel it as the next day's result. |
| Bedrock is unavailable | Explain generation failure safely; an optional structured authorized summary MAY replace generated wording. |
| Data lookup fails during provider outage | Do not turn unavailable tasks or meetings into an asserted empty schedule. |
| Connection drops after server work begins | Represent uncertainty honestly; do not assume failure or blindly repeat delivery/writes. |
| Logout or account switch during generation | Do not show the previous user's private result in the new session. |
| Resource permission is removed | Do not reveal denied content or execute a formerly permitted mutation based on cached context. |

A structured fallback MUST obey the same authorization and daily duplicate-prevention constraints. It is permitted, not a promise that every outage has a successful fallback. Consumption limits and error handling are required by master §4.2; their numeric values are not defined here.

## Correct and incorrect examples

**Correct:** Two tabs connect for the same user on the same Argentina date. The server resolves daily eligibility persistently and atomically; the second connection does not independently start another daily delivery.

**Incorrect:** Each tab checks local storage, invokes generation, and marks itself as finished. Both tabs can deliver, and a reload on another device bypasses the flag.

**Correct:** A user asks to complete an accessible task. NestJS validates that exact operation and reports success only after persistence confirms it.

**Incorrect:** A briefing says “these tasks look finished,” so the model completes them without a user request, or treats a room message as permission to invoke a tool.

**Correct:** During a provider outage, the UI identifies an available structured summary as nongenerated data, or explains that the briefing could not be produced.

**Incorrect:** The bot invents task dates to make an outage look like a successful personalized briefing.

## Open decisions — not implicit approvals

- The precise authenticated-connection trigger and behavior for a continuously connected user across dates remain to be specified; no midnight scheduler is approved here.
- Daily claim, generation, delivery, acknowledgment, retry, and recovery semantics remain unresolved, including crashes after claiming and failures after generation or presentation. No particular state machine or exactly-once transport is selected.
- Whether another tab can view an already-created result, and how recovery distinguishes redisplay from a second automatic delivery, require an explicit contract.
- Optional structured fallback content and presentation, manual reconsultation behavior, and treatment of partially available context remain to be defined.
- Tool-specific confirmation policies, tool catalog details, model/personality, conversation retention, and consumption-limit values remain open; none is inferred from an example.
- Cross-repository ownership and distribution of frontend/backend contracts remain unresolved in master §5–6.

## Observable acceptance checks

These are requirements for future implementation checks, not results of this documentation change.

- [ ] First authenticated connection yields the eligible user's authorized briefing without changing business records unsolicited.
- [ ] Same-user concurrent tabs, reconnects, reloads, room changes, and service restart cannot bypass persistent daily arbitration.
- [ ] Separate users and Argentina day boundaries are tested independently of browser timezone and client clock.
- [ ] Provider outage, failed data lookup, and interrupted delivery produce honest distinct outcomes under the eventual recovery contract.
- [ ] Direct unauthorized tool requests and manipulated resource IDs fail server-side; prompt content cannot enlarge access.
- [ ] Logout, account switching, and lost permissions prevent late protected results from leaking.
- [ ] No Bedrock credential enters browser configuration, responses, logs, or generated text; verification evidence follows the quality policy.
