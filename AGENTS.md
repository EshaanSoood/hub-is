# AGENTS.md

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

- Keep module boundaries explicit.
  Prefer typed module contracts over generic cross-module plumbing.

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
| Adding or modifying a module | §5 Per-module contracts |
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
- Module contracts: `src/components/project-space/moduleContracts/index.ts`
- Patterns guide: `docs/hub-os-patterns.md`
- VoiceOver reference: `docs/voiceover-accessibility-codex-reference.md`
- Route definitions: `src/App.tsx`
- App shell: `src/components/layout/AppShell/index.tsx`
- Bottom toolbar: `src/components/layout/BottomToolbar/index.tsx`

## Section 5 - Codex prompt conventions

When drafting prompts for this repo, describe bugs in plain English (symptoms and expected outcomes), avoid prescribing root causes, use only repo-relative paths, and deliver prompts inline in conversation. Prefer an established npm package before custom logic. Keep styling token-based (from `tokens.css`) and keep DOM order aligned with reading/tab order. If the change reorganizes files, pre-flight `scripts/` for hardcoded paths. If reviews surface out-of-scope issues, defer them to a tracker instead of expanding the current task. End every code-producing prompt with `npm run typecheck && npm run lint && npm run validate && npm run build`, and require all four commands to pass.
