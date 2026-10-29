# Frontend repository

A local React/TypeScript/Vite + Three.js/React Three Fiber navigation study renders the reception and original `public/models/character.glb` directly in a clean full-viewport scene (`100vw × 100vh`), preserving materials, rig and Idle/Run animation behavior. Focus the reception for WASD, click/tap clear floor to move, or click/tap reception objects directly in 3D (counter/bell, noticeboard, waiting seat, portal doorway); `Escape` cancels movement or closes the noticeboard dialog.

This is **not the finished product**: local object interactions (reception bell, noticeboard dialog, waiting seat, and unavailable portal doorway notice) provide local-only preview feedback; authentication, backend integration, persistent tasks, chat, business actions and multiplayer are absent. Other rooms remain deferred awaiting team review. See the [navigation guide](docs/development/reception-navigation.md) for provisional world-axis controls, collision ownership, bounded local interactions, loading/failure behavior and verification limits. The reception uses a conservative effective radius of 1.1 at avatar height 2; narrow passages, the counter recess and portal are deliberately unavailable rather than allowing the larger avatar to clip through.

## Local preview

Prerequisites: Node.js 22 (current patch release) and pnpm **12.15.0**, matching `packageManager`. CI uses Corepack to select that version. No environment variables, credentials or external service endpoints are required. The model is a public static asset; Vite's public base path controls its URL at build time.

```sh
pnpm install --frozen-lockfile
pnpm dev
# Open the local URL printed by Vite; WebGL 2 and hardware acceleration are required.
pnpm test
pnpm typecheck
pnpm build
pnpm preview
# Focus only avatar tests:
pnpm exec vitest run src/features/avatar
```

`pnpm-workspace.yaml` permits only esbuild's dependency build script. Keep the original GLB read-only. Do not substitute another avatar if loading fails. The study waits for both assets and announces readiness after a rendered frame, with distinct asset/WebGL failures; recovery is a manual reload after resolving the cause. Reduced motion requested at startup suppresses Idle/Run animation while retaining local navigation.

### Local wardrobe

The entry screen dresses the original avatar with additive cosmetics: afro or dreads, hoodie or tank, and one accessory (round/square glasses, cap, headphones or backpack) or none. Hair and garment colors affect only the added modules. The original body, rig, animation controller, reception movement and NPC are unchanged. Female modules are deferred because their rig is incompatible; no replacement body is loaded.

Drag the preview horizontally to rotate it, or focus the preview rotation group and use Left/Right arrows and Home. Enter a nickname and wait for the current preview to be ready before entering the reception. Startup reduced-motion preferences are respected. Failed loads block entry; reload after resolving the cause.

Confirmation attempts to remember the selection **only in this browser** (`avatar_appearance:v1`). Draft edits do not write storage. Invalid or obsolete preferences are not overwritten during loading; a storage failure is reported and does not prevent continuing this session. Cosmetics are local-only: other participants still see the original avatar. No account persistence, appearance synchronization, Blender experiments or modular-room changes are included.

Real-browser acceptance is still pending for cosmetic fit during Idle/Run, accessory overlap, drag/touch rotation, and desktop/mobile readability. Automated checks do not establish visual acceptance.

### Ownership and verification limits

`src/features/avatar/load-avatar.ts` remains the sole avatar scene/mixer/disposal owner, with optional `setMoving` selecting Run/Idle and default calibration behavior retained. The separate reception loader owns room resources. `ReceptionPreview` owns both downloads/status and disposes obsolete results after errors/unmount; GLTF downloads cannot be aborted. `ReceptionScene` consumes the navigation controller's single state without interpolating across route corners. `AvatarPreview`, its lifecycle hook and existing tests remain unchanged. R3F owns the renderer; asset loaders explicitly release their resources.

Vitest parses the actual GLBs, checks normalized pose/rotation envelopes, navigation, animation/resource contracts and rendered control/status/view arbitration with a simulated renderer. These checks do not prove real GPU rendering, full visual clearance or visual quality. Parent browser verification remains pending for movement/contact, avatar facing/animation, desktop/narrow framing and overflow, reduced motion, and failure/context-loss behavior; hardware touch/performance remain unverified. T2's independent verification remains unresolved and is not accepted by these checks.

For scoped local validation without Vite's bundled-config temporary output, use `pnpm test --configLoader runner` and `pnpm build --configLoader runner`. These supported flags do not change package scripts or prove default CI execution. The generated validation outputs are `dist/` and `node_modules/.vite/`; never commit them.

## Development rules

Read the [project rules](rules/README.md) before contributing. They cover GitHub Projects coordination, Git collaboration, English Conventional Commits and code, architecture, state and API contracts, session handling, accessible UI and forms, data/time conventions, configuration, operations, quality, security, AI usage, and art direction. The visual target is agreed; [master sections 3.1 and 5](master-document.md#5-stack-y-responsabilidades-técnicas) confirm React, Three.js, and React Three Fiber. The [rendering and authoring decision](docs/decisions/rendering-and-authoring.md) records the user's confirmation and Blender authoring choice; detailed scene, rig, and collision choices remain open. The [course requirements](rules/project-requirements.md) preserve the academic requirements and evaluation criteria extracted from the temporary course brief; section 10 of [the project document](master-document.md#10-cumplimiento-del-enunciado-integrartec-2026) maps them to the proposed product.

The product rules develop the expected behavior for rooms/permissions, tasks, communication/meetings, the AI briefing, movement, avatars, and realtime presence. Their acceptance checklists describe future implementation evidence, not working features; open domain decisions are explicitly separated from established requirements.

## Promotion flow

Work branches enter `develop` or `main` through reviewed pull requests. When using the promotion flow, changes are promoted by pull request from `develop` to `test`, then from `test` to `main`. See [Git workflow](rules/git-workflow.md) for commit and merge conventions. CI runs for pull requests targeting `develop`, `test`, or `main` and pushes to `develop`. Work branches may target `develop` or `main`; only `develop` may target `test`, and `develop` cannot target `main` directly without `test`.

## CI

The `checks` job runs Python standard-library CI regressions and checks tracked Markdown documents for internal inline link paths and ATX (`#`) heading anchors. External URLs are ignored (no network requests); inline code and fenced examples are not links. This limited checker covers the current documentation syntax, not reference-style links, HTML anchors, or all Markdown dialects. It does not enforce document whitespace or final newlines.

CI fetches full history and runs `git diff --check` on proposed changes: PR base SHA to the checked-out merge result, or push `before` SHA to HEAD. An initial push uses the empty tree. Only added/changed lines are checked, preserving unchanged existing whitespace. CI also validates the workflow using actionlint **1.7.7**, installed into the runner's temporary directory using Go.

Run locally from the repository root (Python 3, Git, and Bash required):

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/ci -p 'test_*.py' -v
python3 scripts/ci/check_docs.py
# Compare committed and uncommitted tracked changes with the target branch:
git diff --check "$(git merge-base origin/develop HEAD)" --
# If actionlint 1.7.7 is already available:
actionlint .github/workflows/ci.yml
```

Use the actual target ref (`origin/test` or `origin/main` for promotions) instead of `origin/develop` when appropriate. The diff command includes uncommitted tracked edits; untracked files are not included. For each new file, also run `git diff --no-index --check -- /dev/null path/to/new-file` before staging (`--no-index` exit 1 alone means files differ; whitespace errors include diagnostics). Stage new Markdown files for inclusion in the default tracked-file link check, or pass their paths explicitly to `check_docs.py`. Report unavailable tools honestly; local validation does not prove a GitHub run or branch protection.

The job uses Node.js 22 and Corepack/pnpm once both `package.json` and `pnpm-lock.yaml` are present. It installs with `pnpm install --frozen-lockfile` and runs `pnpm test`; both are configured for this preview. A package without its lockfile fails clearly. Type checking and production build remain explicit local checks, not existing CI steps. CI-tooling regressions still run.

## Cross-repository contracts

Ownership and implementation of any contracts shared with the backend across repositories have not yet been decided. No shared architecture is defined here.
