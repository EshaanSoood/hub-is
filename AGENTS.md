# AGENTS.md

## Iterative UI architecture

- Assume active product iteration.
  New UI work must expect layout, navigation, and surface changes
  during implementation.

- Keep route and page files thin.
  They may read route state, choose surfaces, and wire overlays,
  but should not own durable feature behavior.

- Put durable behavior below the host layer.
  Prefer reusable feature-local hooks, sections, and typed contracts
  so pivots mostly change composition, not ownership.

- Do not hard-bind movable capabilities to one shell.
  If a capability may later move between Home, Sidebar, Space Workspace,
  or overlays, keep it importable unless the task explicitly requires
  tight coupling.

- Extract the durable seam first.
  When direction is likely to change, prefer pulling out the reusable
  runtime or section before deepening the current surface.

## Section 1 - Hard rules

- Lexical no-touch.
  Do not edit `src/features/notes/`, `src/hooks/useWorkspaceDocRuntime.ts`,
  or Yjs/Hocuspocus collaboration session lifecycle code.

- Lexical cast chains are intentional.
  Do not "clean up" cast chains or shim layers in lexical/collab files.

- Treat lexical as an exception zone.
  `src/features/notes/collabSessionManager.ts` is containment code,
  not a pattern source for regular features.

- Email template exception.
  Do not modify style strategy in
  `apps/hub-api/emails/inviteTemplate.mjs`.

- Email CSS is intentionally non-tokenized.
  Hardcoded hex values and `!important` are required for client compatibility.

- Design tokens only.
  Application UI CSS values must come from `tokens.css`.

- No inline style objects for app UI.
  Prefer token-backed classes and existing primitives.

- No magic hex values in app code.
  If a token is missing, add the token first; do not hardcode color values.

- DOM order equals reading order.
  Keep semantic order in the DOM for assistive tech and keyboard traversal.

- No CSS reordering hacks.
  Do not use `order`, `*-reverse`, or absolute positioning
  to reorder meaningful content.

- Relative paths only.
  Never use machine-local absolute paths like `/Users/...`
  in prompts, docs, issues, or code references.

- Prefer maintained npm packages.
  Check package ecosystem options before writing custom logic.

- Verification tail is mandatory.
  Every code-producing task ends with:
  `npm run typecheck && npm run lint && npm run validate && npm run build`.

- All four verification commands must pass.
  Do not report completion if any command fails.

- Pre-production data policy.
  This app is pre-production. User data is disposable during fixes,
  migrations, and test resets. Do not preserve legacy data shapes or
  compatibility paths unless explicitly requested. Keycloak accounts are
  the exception and must not be casually deleted.

- Space ID vs work-project ID.
  These are distinct string IDs and TypeScript will not catch mixups.
  `space_id` belongs to `spaces` and identifies the container; legacy
  route segment `/projects/:spaceId` still means a space. `project_id`
  belongs to `projects` and identifies the work area; route segment
  `/work/:workProjectId` means a work-project.

- Never alias space IDs into project IDs.
  A `space_id` value is never valid in a `project_id` field, request
  parameter, response key, notification payload, or DB alias. Use
  `source_project_id` only for a real work-project ID. Do not add
  dual-accept patterns such as `space_id ?? project_id`.

- Name IDs by their layer.
  Prefer `spaceId`, `workProjectId`, and `sourceProjectId`. Avoid
  ambiguous `projectId` unless the surrounding contract is explicitly
  work-project scoped. If a new or changed `project_id` field could mean
  either layer, the naming is wrong.

- Route and payload order must match the layer.
  Space IDs go in space route positions and `space_id` payload fields.
  Work-project IDs go in work route positions and `project_id` or
  `source_project_id` payload fields. For example,
  `buildProjectContextHref(spaceId, workProjectId)` must not be reversed.

- Rename trace is the guardrail.
  `npm run test:e2e:rename-trace` seeds distinguishable IDs and must show
  no `SPACE_*` value in `project_id` fields and no `prj_*` value in
  `space_id` fields across API responses and UI flows.

- Pre-flight file reorgs.
  Before moving/renaming files, grep `scripts/`
  for hardcoded paths and update them.

- Defer out-of-scope review findings.
  Log and track unrelated findings; do not fold them
  into the current scoped change.

- Scope discipline.
  Do not "drive-by fix" unrelated files while implementing a task.

- Preserve existing architecture intent.
  If a pattern looks unusual, confirm whether it is intentional
  before refactoring.

- Keep widget boundaries explicit.
  Prefer typed widget contracts over generic cross-widget plumbing.

- Validate untrusted boundaries.
  Parse API/route/serialized inputs before use.

- Keep state ownership local.
  Hooks own state; parent components orchestrate by calling hooks.

- Keep components readable.
  Prefer folderized surfaces with `index.tsx` composition entrypoints.

- Reuse existing primitives.
  Start with components in `src/components/primitives/`
  before creating one-off UI wrappers.

- Preserve accessibility behavior.
  Do not remove existing focus handling, announcements,
  keyboard support, or ARIA semantics without replacement.

- Avoid unbounded abstraction.
  Extract only when reuse or ownership boundaries are clear.

- Keep docs references repo-relative.
  Use paths like `docs/hub-os-patterns.md`, not local filesystem paths.

- Prompt output is inline.
  Do not generate prompt files unless explicitly asked.

- Bug descriptions stay user-observable.
  Describe symptoms and expected behavior,
  not speculative internal causes.

- Keep changes reviewable.
  Prefer small, coherent diffs over broad refactors.

- Respect no-runtime-impact docs tasks.
  Documentation-only tasks must not include code behavior changes.

- When unsure, stop and ask.
  If a change collides with these rules, clarify scope before editing.

## Section 2 - Patterns pointers

Grep the specific section in `docs/hub-os-patterns.md` first,
instead of loading the full file.

| If you're... | Read |
|---|---|
| Splitting a large component into a folder | §2 Component structure |
| Deciding where a new hook lives | §3 Custom hooks |
| Extracting state from a parent component | §4 State ownership |
| Adding or modifying a widget | §5 Per-widget contracts |
| Validating external data (API, route state) | §6 Runtime validation |
| Styling a new component | §7 Design tokens |
| Building accessible markup | §8 DOM order |
| Working inside the lexical subsystem | §9 Lexical exception (read first) |

## Section 3 - Accessibility pointers

| If you're... | Grep for |
|---|---|
| Adding focus management on route change or modal open | `focus` |
| Adding a live region announcement | `live region` |
| Adding keyboard interaction to a custom control | `keyboard` |
| Building a dialog, popover, or menu | `dialog` or `popover` |
| Adding drag-and-drop | `drag` |

Use those terms against
`docs/voiceover-accessibility-codex-reference.md`
and read the matching section only.

## Section 4 - Key file locations

- Design tokens: `tokens.css`
- Motion tokens: `src/styles/motion.ts`
- Icon registry: `src/components/primitives/Icon.tsx`
- Widget contracts: `src/components/project-space/widgetContracts/index.ts`
- Patterns guide: `docs/hub-os-patterns.md`
- VoiceOver reference: `docs/voiceover-accessibility-codex-reference.md`
- Route definitions: `src/App.tsx`
- App shell: `src/components/layout/AppShell/index.tsx`
- Sidebar shell: `src/components/Sidebar/SidebarShell.tsx`

## Section 5 - Codex prompt conventions

When drafting prompts for this repo, describe bugs in plain English (symptoms and expected outcomes), avoid prescribing root causes, use only repo-relative paths, and deliver prompts inline in conversation. Prefer an established npm package before custom logic. Keep styling token-based (from `tokens.css`) and keep DOM order aligned with reading/tab order. If the change reorganizes files, pre-flight `scripts/` for hardcoded paths. If reviews surface out-of-scope issues, defer them to a tracker instead of expanding the current task. End every code-producing prompt with `npm run typecheck && npm run lint && npm run validate && npm run build`, and require all four commands to pass.
