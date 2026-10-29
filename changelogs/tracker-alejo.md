# Tracker — Alejo

## 2026-10-29 — Integrate a wardrobe without replacing the original avatar

- **Status:** blocked
- **Area / files:** `src/features/avatar/`, local entry wiring in `src/app/App.tsx` and `src/features/world/ReceptionPreview.tsx`, nine cosmetic GLBs and `README.md`.
- **Change:** Reuse the wardrobe with additive afro/dreads, hoodie/tank and five accessories on the unchanged original character and animation controller. Preserve navigation, NPC, remote players and server configuration. Female modules require an incompatible rig and remain excluded; pending Blender experiments and modular-room changes are separate.
- **Reason:** Bring only the approved wardrobe/cosmetics into a fresh branch from main without undoing teammate improvements.
- **Verification:** Cosmetic/UI slices passed focused tests, full suites, TypeScript and builds (`0dbd9e6`, `8050d25`). Entry integration (`2066a50`) passed 165 tests; two TypeScript failures in its partial canvas mock were corrected, followed by successful type checks, build, five CI regression tests and 43-document link checks. Original protected paths are unchanged. Independent static verification found no severe code-caused blocker but did not grant visual acceptance. Existing Three.js/R3F test warnings and the 1,182.62 kB bundle warning remain. Preferences and appearance are local-only, not account persistence or remote synchronization.
- **Next step:** Human visual review of cosmetic fit during Idle/Run, rotation and desktop/mobile readability in the local preview. Browser proof is unavailable in this verification run; do not mark ready or publish without it. No push, PR or merge has been performed.

## 2026-10-27 — Repair project-local dependency resolution

- **Status:** completed
- **Area / files:** project-local dependency junctions under `node_modules/`; ignored repair evidence under `odd/artifacts/dependency-repair/`.
- **Change:** Diagnose and repair dependency links after the user authorized local repair with package versions, lockfile, CI and global installations unchanged. Metadata inspection found `@vitejs/plugin-react` linked to an earlier temporary verification checkout instead of its in-project package.
- **Reason:** The application verification stopped before tests because Vitest could not resolve the React plugin.
- **Verification:** The parent repaired seven local junction entries using the audited exact-version targets and retained original junction entries for rollback without traversing their external targets. All 435 dependency junctions now point inside the checkout, and 7,368 protected file hashes are unchanged. Public React-plugin import, 68/68 tests, both TypeScript checks and the Vite build passed in one command chain (exit 0). The build retains a 1,100.38 kB chunk warning. After the `gentle-ai-verify` subagent (`antigravity/claude-sonnet-5-5`) failed (`assistant reported an error`), the parent completed direct audit/code verification per the user's explicit continuation instruction.
- **Next step:** Proceed with bounded local reception interactions (`T5`) and final browser/CI verification (`T7`).

## 2026-10-27 — Build the interactive reception foundation

- **Status:** completed
- **Area / files:** `src/features/avatar/`, `src/features/world/`, application/configuration files, `scripts/blender/`, `assets/blender/reception.blend`, `public/models/rooms/reception.glb`, `docs/art/reception.md`, `docs/development/reception-navigation.md`.
- **Change:** Confirm React/Three.js/React Three Fiber and Blender authoring; create the original reception asset, reuse the existing avatar, implement local navigation/collisions, revise reception materials toward the team-approved cream, wood and turquoise palette, and add direct 3D local object interactions (`counter-bell`, `noticeboard` modal dialog, `waiting-seat`, `portal-doorway` unavailable transition notice) in a clean full-viewport reception stage without extra navigation tabs or toolbar button clutter. Additional rooms remain explicitly deferred.
- **Reason:** Establish a navigable, interactable local reception foundation and address team feedback about the previous pink/cozy emphasis without replacing the avatar or implying backend integration.
- **Verification:** Observed RED then GREEN for the 6 new interaction tests (`74/74` total tests passing across 11 test files), both TypeScript checks (`tsconfig.app.json`, `tsconfig.node.json`), Vite production build (`exit 0`, with a `1,104.60 kB` chunk warning), `7/7` Blender palette/export tests, `5/5` CI regression tests, 43-file documentation link/anchor checks, and `git diff --check`.
- **Commits:** `454dacc` (rendering/authoring decision), `3129859` (original reception asset), `4b7b966` (cream/wood/turquoise reception palette), `4f25a32` (reception navigation core and collision layout), `b5fddd4` (React Three Fiber avatar preview bootstrap), `379ee4c` (integrated reception scene navigation and controls), plus the bounded reception interactions commit slice.
- **CI:** Local CI regression suite (`5/5`), doc link/anchor checker (`43` files), whitespace check, and `pnpm test` equivalent (`74/74`) all pass locally. Remote GitHub Actions execution happens on push/PR when publication is requested.
- **Next step:** None for the local reception foundation. Additional rooms and backend/Colyseus integration remain deferred to future work units.

## 2026-10-22 — Develop source-grounded functional rules

- **Status:** completed
- **Area / files:** seven domain rule documents under `rules/`, `rules/README.md`, `master-document.md`, `odd/tasks/domain-rules.md`.
- **Change:** Develop deep behavior contracts for rooms, productivity, communication, AI, interaction, avatars, and realtime presence.
- **Reason:** Expand agreed product commitments without choosing a rendering engine or inventing unresolved domain decisions.
- **Verification:** Seven rules (914 lines) received writer self-review and parent readback. Per-unit link checks passed; one initial accented-anchor error in Unit A was corrected before delivery. The parent seam check passed all 5 existing CI-tooling tests and links/anchors across 37 Markdown files; tracked/new-file whitespace passed and art direction is unchanged. Runtime, RED/GREEN, typecheck, and differential checks are not applicable to passive documentation. Native assessments, including committed slices, were unavailable because the provider requires an explicit declaration for pre-existing untracked files; no review started or approval claimed.
- **Commits:** `67104c9` (movement/avatars), `aa28d67` (AI/realtime), `44707e8` (rooms/tasks/communication), `52e013c` (integration), followed by closure bookkeeping on `docs/domain-rules`.
- **Next step:** Human review of the rules and explicit resolution of open product decisions before their implementation. No push, PR, or merge performed; prior general-rule changes remain uncommitted separately.

## 2026-10-22 — Define general development and coordination rules

- **Status:** completed
- **Area / files:** `rules/`, `README.md`, `master-document.md`.
- **Change:** Add 14 general coordination, architecture, integration, UX, and operational rules; update the index and Git coordination reference. Preserve the agreed art direction while clarifying that the rendering engine remains undecided.
- **Reason:** Establish reusable team constraints without inventing board configuration, session mechanisms, or engine-specific decisions.
- **Verification:** Five existing CI-tooling regression tests passed; links/anchors passed across 29 Markdown files including all untracked rules; tracked and new-file whitespace checks passed. Confirmed no diff in `rules/art-direction.md`. Application runtime tests and RED/GREEN are not applicable to passive documentation. Reading GitHub Projects failed because the current CLI token lacks `read:project`; no permissions or remote settings were changed. Native assessment was unassessable because it requires explicit untracked scope; no native review started. An initial assessment invocation through the batching tool was rejected before execution; the direct assessment returned that unavailable result.
- **Commit follow-up:** The user requested committing the previously separate general-rule changes. Readback confirmed the 14 rule documents and their index/workflow references; all 5 CI-tooling tests, links across 37 documents, and tracked/new-file whitespace checks passed again before staging.
- **Next step:** Team review of the new policies and mapping to actual Project fields when read access is available. Commit locally as a separate general-rule unit; no push is authorized.

## 2026-10-22 — Preserve literal Markdown in CI summaries

- **Status:** completed
- **Area / files:** `.github/workflows/ci.yml`, `scripts/ci/test_checks.py`.
- **Change:** Correct two shell quoting warnings without changing the notices or job summaries; pin their literal output in regression fixtures.
- **Reason:** GitHub run 39814978244 failed with ShellCheck SC2016; local Windows actionlint did not include ShellCheck.
- **Evidence:** Repository commit `67dc20c` contains the workflow correction and regression tests. This bookkeeping update does not assert a new test run or a successful remote GitHub run.
- **Next step:** Check the applicable GitHub run when remote verification is authorized; the local code correction is committed.

## 2026-10-22 — Check work pull requests and documentation

- **Status:** completed
- **Area / files:** `.github/workflows/ci.yml`, `scripts/ci/`, `README.md`, `rules/git-workflow.md`.
- **Change:** Add develop pull-request checks, local Markdown link/anchor validation, proposed-diff whitespace checks, CLI regression fixtures, and actionlint pinned to 1.7.7 in CI.
- **Reason:** Check work before integration without weakening promotion restrictions, rewriting existing whitespace, or introducing an application stack.
- **Verification:** Observed RED for the develop guard/trigger and missing checker, then GREEN; correction RED reproduced overbroad whitespace/final-newline rejection, then GREEN. Focused and full unittest discovery passed (four methods); all 15 tracked Markdown files passed. Target-base diff and working-tree whitespace checks passed; new-file checks emitted only CRLF conversion warnings (exit 1: differences). Ephemeral differential against 15f5ff6 preserved eight promotion cases exactly and intentionally changed develop feature acceptance; package/install/test steps remained unchanged, with exact notice/summary and stubbed command-invocation checks passing. Real diff fixtures preserved unchanged whitespace and rejected added whitespace; PR/push/initial-push base selection passed. S1–S5 self-review completed. Fixture cleanup and Windows path/newline issues encountered during verification were corrected; no fixtures or caches remain.
- **Additional verification:** Independent verification found no in-scope code blockers and passed all four regression tests, the 15-document link check, and tracked diff whitespace checks. The authorized temporary actionlint 1.7.7 Windows ZIP was checked against its official SHA-256 manifest; workflow validation exited 0. An initial incorrect archive URL returned HTTP 404 before execution; the release asset listing identified the correct ZIP. All temporary validator files were removed.
- **Next step:** Commit and push this CI work to `docs/project-development-rules` as explicitly authorized, then observe the existing pull request and its GitHub Actions run. At the time of this entry, GitHub execution and branch protections remain unverified; no GitHub settings changes are included.

## 2026-10-22 — Standardize English document filenames

- **Status:** completed
- **Area / files:** `rules/`, `master-document.md`.
- **Change:** Rename the art direction file and translate planned document paths, updating their references.
- **Reason:** Keep filenames in English consistently with the project conventions.
- **Verification:** 32 local links/anchors passed; old Spanish document paths are absent from active documentation; art direction SHA-256 is unchanged; the master document differs only in filename translations; `git diff --check` passed. Application tests do not apply to documentation-only renames.
- **Next step:** None for this change. No commits made.

## 2026-10-22 — Preserve course requirements without the PDF

- **Status:** completed
- **Area / files:** `rules/`, `README.md`.
- **Change:** Extract the academic requirements into a self-contained rule and replace links to the temporary PDF.
- **Reason:** The PDF is reading material only; the user will remove it from the repository.
- **Verification:** Nine Markdown documents and 32 local links/anchors checked successfully with PDF links explicitly forbidden; R1–R8 and required sections present; `git diff --check` passed. Application tests do not apply to this documentation-only correction.
- **Next step:** The user may remove the temporary PDF; documentation does not depend on it. No PDF deletion or commits performed.

## 2026-10-22 — Establish development rules

- **Status:** completed
- **Area / files:** `rules/`, `README.md`.
- **Change:** Document Git workflow, quality, security, and AI usage conventions; require English Conventional Commits and English code.
- **Reason:** Establish shared development expectations aligned with the course requirements.
- **Verification:** Checked six documents and 28 local links/anchors; `git diff --check` passed. Application tests are not applicable (documentation only, no package). Native review assessment was unavailable because untracked files require explicit scope selection; no review started.
- **Next step:** Agree on when to enforce the documented policy in GitHub settings and CI. The initial PDF retention assumption was superseded by the correction recorded above; no GitHub settings, workflow changes, or commits were made.
