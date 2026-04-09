# Hub OS Antipatterns

## 1. God files

### App shell owns too many unrelated UI systems

**Files:** `src/components/layout/AppShell.tsx` (lines 55-2042)

**What's happening:** This single file mixes at least six responsibility blocks: shell/nav state + refs (~55-203), toolbar/home data loading (~204-360), quick-add creation flows (~373-526), global effects/keyboard/focus orchestration (~528-1232), install/calendar-link utility actions (~1240-1409), and full footer/dialog/menu rendering (~1412-2042). It coordinates search, notifications, capture, tasks, reminders, calendar, profile, and quick-add dialogs in one component.

**Why it matters:** A change to one toolbar feature can easily regress unrelated interaction state because all state machines are tightly co-located.

### Project page combines routing, data orchestration, mutation wiring, and dense UI composition

**Files:** `src/pages/ProjectSpacePage.tsx` (lines 192-2052)

**What's happening:** The page handles route/query parsing and navigation helpers (`src/pages/ProjectSpacePage.tsx`:233-236,510-629), composes many runtime hooks (`src/pages/ProjectSpacePage.tsx`:253-384), builds a large module runtime adapter object (`src/pages/ProjectSpacePage.tsx`:784-1006), and renders multiple major UI regions/dialogs (`src/pages/ProjectSpacePage.tsx`:1027-2052). The file therefore acts as router adapter, view-model assembler, and view implementation simultaneously.

**Why it matters:** The blast radius for edits is high because behavior and presentation are coupled across >2k lines.

### API entrypoint is a monolith despite route module extraction

**Files:** `apps/hub-api/hub-api.mjs` (lines 37-4162)

**What's happening:** The file still includes environment/config bootstrap (`apps/hub-api/hub-api.mjs`:37-98), a large invite-email template (`apps/hub-api/hub-api.mjs`:99-312), cross-cutting helper/policy/integration logic (`apps/hub-api/hub-api.mjs`:314-3185), a reminder scheduler (`apps/hub-api/hub-api.mjs`:3202-3300), a giant request router (`apps/hub-api/hub-api.mjs`:3302-4115), and WebSocket/server startup (`apps/hub-api/hub-api.mjs`:4117-4162).

**Why it matters:** Operational and feature changes must be reasoned about in one very large surface, increasing incident risk.

### Table module skin aggregates many independent concerns in one component

**Files:** `src/components/project-space/TableModuleSkin.tsx` (lines 453-1478)

**What's happening:** One component owns filtering, sorting, drag-reorder, virtualization, inline editing, bulk actions, create-row flow, and keyboard grid navigation (`src/components/project-space/TableModuleSkin.tsx`:453-1478). Supporting logic for value normalization and field parsing is also in the same file (`src/components/project-space/TableModuleSkin.tsx`:104-360).

**Why it matters:** Small feature changes require touching a dense interaction surface with many coupled states.

## 2. Duplicated concepts

### Date bucketing logic is duplicated in dashboard and app shell utilities

**Files:** `src/features/PersonalizedDashboardPanel.tsx` (lines 128-231), `src/components/layout/appShellUtils.ts` (lines 118-187)

**What's happening:** Both files implement near-identical day-boundary/date-bucket utilities (`startOfDay`, `endOfWeek`, bucket mapping) with different naming and minor condition differences. The same core concept is maintained in two places.

**Why it matters:** Divergence in time-bucket behavior creates inconsistent task/event grouping across views.

### Project color-dot hashing exists in two divergent implementations

**Files:** `src/features/PersonalizedDashboardPanel.tsx` (lines 283-301), `src/components/layout/appShellUtils.ts` (lines 210-233)

**What's happening:** Both files define project-dot color arrays and hash-to-color mapping independently. The token sets are not equivalent, so the same project can render with different color semantics depending on surface.

**Why it matters:** Visual identity and recognition consistency degrade as the same project appears with different dot colors.

### Task rendering diverges across myHub, Overview, and pane module surfaces

**Files:** `src/features/PersonalizedDashboardPanel.tsx` (lines 303-358), `src/components/project-space/OverviewView.tsx` (lines 428-516), `src/components/project-space/TasksModuleSkin.tsx` (lines 142-229, 492-634)

**What's happening:** myHub uses `ItemRow` cards, Overview wraps `TasksTab` with page-specific controls, and pane modules split S/M/L behavior with `TaskSummaryRow`/`TasksTab`. These are separate implementations of the same task-list concept with different interactions and copy.

**Why it matters:** Product behavior drifts by location, increasing maintenance cost and UX inconsistency.

### Reminder natural-language create UX is duplicated

**Files:** `src/components/layout/QuickAddDialogs.tsx` (lines 131-218), `src/components/project-space/RemindersModuleSkin.tsx` (lines 323-393, 456-531)

**What's happening:** Both implement reminder draft input, parse preview rendering, and inline error/submission handling separately. The shape and edge-case behavior are close but not shared.

**Why it matters:** Parser UX changes require edits in multiple places and can drift subtly.

## 3. Inline sub-components that should be extracted

### Task composer is a substantial inline component inside TasksModuleSkin

**Files:** `src/components/project-space/TasksModuleSkin.tsx` (lines 231-400)

**What's happening:** `TaskComposer` spans creation form state, submit/reset logic, parent-task linking, and error rendering while living inside `TasksModuleSkin.tsx`. It is reused by multiple size tiers (`src/components/project-space/TasksModuleSkin.tsx`:415-416,465-470,582-588).

**Why it matters:** The host file accumulates unrelated concerns and becomes harder to navigate.

### Task row action/menu component is embedded in TasksTab

**Files:** `src/components/project-space/TasksTab.tsx` (lines 390-780)

**What's happening:** `TaskRow` includes menu focus management, optimistic action paths, archive confirmation timing, and nested subtask rendering in one inline block. It is a distinct concept embedded in an already large file.

**Why it matters:** Row behavior is hard to test/reason about when packed into a multipurpose tab file.

### Calendar medium week strip is a large inline specialized view

**Files:** `src/components/project-space/CalendarModuleSkin.tsx` (lines 191-298)

**What's happening:** `CalendarMediumWeekStrip` is defined inline and contains its own rendering rules and interaction behavior, while `CalendarModuleSkin` also contains S/L and create-panel logic (`src/components/project-space/CalendarModuleSkin.tsx`:300-901).

**Why it matters:** Calendar complexity concentrates in one file and hides reusable sub-view boundaries.

## 4. Effect sprawl

### App shell has 18 effects handling many independent lifecycles

**Files:** `src/components/layout/AppShell.tsx` (useEffect at lines 528, 542, 555, 568, 575, 593, 600, 622, 628, 702, 717, 813, 868, 933, 955, 980, 1002, 1232)

**What's happening:** Effects manage quick-add autofocus, reminder parsing debounce, task panel refresh, live notifications, global key/mouse listeners, search debounce, and focus restoration. Multiple unrelated lifecycles share one component.

**Why it matters:** Behavioral coupling makes regressions likely when changing any one effect dependency chain.

### Collaborative editor has 11 effects across plugins and collaboration state

**Files:** `src/features/notes/CollaborativeLexicalEditor.tsx` (useEffect at lines 142, 184, 201, 228, 262, 294, 325, 387, 411, 451, 465)

**What's happening:** Effects span session subscription, editability toggles, mention/embed insertion, focus node handling, selection tracking, persistence debounce, and bootstrap guards. The logic is split across plugin components but still concentrated in one file.

**Why it matters:** Editor behavior is difficult to reason about end-to-end because lifecycle logic is highly fragmented.

### Project page effect count indicates orchestration overload

**Files:** `src/pages/ProjectSpacePage.tsx` (useEffect at lines 464, 471, 481, 510, 521, 548, 703, 769)

**What's happening:** Effects coordinate route correction, inspector open-from-query, quick capture query intents, focus node query cleanup, and overview view query syncing. These sit beside large runtime composition and rendering logic.

**Why it matters:** Route/state synchronization bugs become harder to isolate because concerns are mixed.

### Additional high-effect files

**Files:** `src/pages/ProjectsPage.tsx` (lines 71, 164, 170, 174, 178, 182, 186), `src/hooks/useWorkspaceDocRuntime.ts` (lines 223, 227, 401, 421, 425, 475, 501), `src/features/QuickCapture.tsx` (lines 201, 285, 292, 304, 329, 340), `src/components/project-space/FileInspectorActionBar.tsx` (lines 86, 92, 107, 134, 155, 176)

**What's happening:** Each file has 6-7 effects coordinating independent concerns (live subscriptions, debouncing, focus/mode transitions, upload dialogs, and inspector state). They are hotspots for hidden lifecycle complexity.

**Why it matters:** High effect density increases ordering bugs and stale-closure risk.

## 5. Prop drilling and context misuse

### Runtime “super-prop” is assembled then tunneled through WorkView

**Files:** `src/pages/ProjectSpacePage.tsx` (lines 784-1006), `src/components/project-space/WorkView.tsx` (lines 23-32, 161-170, 410-445, 527-580)

**What's happening:** `ProjectSpacePage` builds a large `workViewModuleRuntime` object containing many module-specific handlers and data, then passes it as `moduleRuntime` into `WorkView`, which fans it back out to module components. Intermediate layers mostly pass through nested runtime slices.

**Why it matters:** The contract is hard to evolve safely and increases coupling between page orchestration and all module implementations.

### Quick-add dialogs use broad controlled prop surfaces from AppShell

**Files:** `src/components/layout/AppShell.tsx` (lines 1891-1935), `src/components/layout/QuickAddDialogs.tsx` (lines 6-40, 131-157, 220-240)

**What's happening:** App shell threads many state/setter props into each quick-add dialog variant (project selection, field values, errors, submitting flags, refs, callbacks). Dialog components are largely prop-driven pass-through forms.

**Why it matters:** Changes to one quick-add flow propagate across a wide prop interface and increase accidental breakage.

### ModuleInsertContext stores transient row-level selection globally

**Files:** `src/context/ModuleInsertContext.tsx` (lines 5-12, 32-67), `src/components/project-space/TasksModuleSkin.tsx` (lines 168-173), `src/components/project-space/RemindersModuleSkin.tsx` (lines 227-231), `src/components/project-space/InboxCaptureModuleSkin.tsx` (lines 176-183)

**What's happening:** A global context tracks active item id/type/title used for per-row insert affordances across multiple modules. The state is interaction-local and short-lived but globally shared.

**Why it matters:** Globalizing ephemeral UI state increases hidden coupling between otherwise independent module surfaces.

## 6. Styling drift

### Tailwind `!` overrides are present in core page/dialog layout

**Files:** `src/pages/ProjectSpacePage.tsx` (line 1817), `src/components/layout/AppShell.tsx` (lines 1773, 1818)

**What's happening:** Utility `!` overrides are used to force positioning/sizing on dialog panels. This bypasses normal utility precedence and makes style intent harder to reason about.

**Why it matters:** Override-driven styling makes future layout changes brittle.

### Hardcoded color utility bypasses semantic token usage

**Files:** `src/components/project-space/TasksModuleSkin.tsx` (line 351)

**What's happening:** Error text uses `text-red-500` instead of the semantic `text-danger` token classes used elsewhere.

**Why it matters:** Hardcoded color classes weaken theme consistency and token governance.

### Inline style sprawl in core interaction surfaces

**Files:** `src/components/layout/AppShell.tsx` (lines 1431, 1464, 1489, 1626, 1698, 1961, 1996), `src/components/hub-home/DayStrip.tsx` (lines 358, 383, 395, 403, 415, 429, 435, 464, 480, 486), `src/components/project-space/FilesModuleSkin.tsx` (lines 171, 180, 192, 262, 349, 406, 457), `src/components/project-space/RemindersModuleSkin.tsx` (lines 238, 570)

**What's happening:** Many components rely on ad-hoc inline styles for colors, dimensions, and animated backgrounds rather than tokenized class-based styling. This includes high-traffic UI areas (search, timeline, files, reminders).

**Why it matters:** Styling consistency and maintainability degrade when visual rules are split between classes and per-element style objects.

### API invite template includes hardcoded hex palette and `!important`

**Files:** `apps/hub-api/hub-api.mjs` (lines 108, 119-129, 152-154)

**What's happening:** The HTML email template embeds fixed hex values and an explicit `!important` color override in CSS. These styles are disconnected from frontend token definitions.

**Why it matters:** Brand/style updates require manual edits in isolated inline-template CSS.

## 7. Vocabulary drift in code

### “Inbox” and “quick thoughts” are both used for the same module concept

**Files:** `src/components/project-space/WorkView.tsx` (lines 172-176), `src/components/project-space/InboxCaptureModuleSkin.tsx` (lines 284-520)

**What's happening:** Runtime normalization maps `inbox` to `quick_thoughts`, while the implementation file and export names still include `InboxCaptureModuleSkin` and `QuickThoughtsModuleSkin`. Two vocabularies describe one module.

**Why it matters:** Naming inconsistency raises cognitive load when tracing module behavior across files.

### “myHub” vs `/projects` route vocabulary is mixed

**Files:** `src/components/layout/appShellUtils.ts` (lines 235-239), `src/App.tsx` (lines 114-117), `src/components/layout/AppShell.tsx` (line 167)

**What's happening:** Breadcrumbs label root as “myHub,” while routing and tab naming center on `/projects` and project-space terminology, and the shell uses `isOnHubHome` derived from `/projects`. The same landing concept is named differently across routing and UI helpers.

**Why it matters:** Terminology drift makes navigation logic and UX copy harder to align.

## 8. Dead or unmounted code

### Legacy ProjectShell component is not wired into live imports

**Files:** `src/components/layout/ProjectShell.tsx` (lines 1-47)

**What's happening:** Import search across `src/` and `apps/` only finds the component’s own definition and no runtime import sites.

**Why it matters:** Dead components add noise and invite accidental edits with no runtime effect.

### TopNavTabs and ToolsView exist but are only referenced in comments

**Files:** `src/components/project-space/TopNavTabs.tsx` (lines 1-71), `src/components/project-space/ToolsView.tsx` (lines 1-53), `src/pages/ProjectSpacePage.tsx` (lines 55-57)

**What's happening:** Both components are defined, but the only references in the current page path are comment placeholders in `ProjectSpacePage`; no active imports mount them.

**Why it matters:** Dormant UI files create false architecture signals and increase maintenance overhead.

### Mock project-space data module appears unmounted from production paths

**Files:** `src/components/project-space/mockProjectSpace.ts` (lines 1-240)

**What's happening:** The module defines a full mock pane/template system, but import search shows no active references from production route components.

**Why it matters:** Large unmounted support files make the project harder to scan and reason about.

## 9. Accessibility gaps

### Triage drag-and-drop flow lacks keyboard-equivalent assignment interaction

**Files:** `src/components/hub-home/TriagePanel.tsx` (lines 176-180, 275-281, 377-380), `src/components/hub-home/DayStrip.tsx` (lines 304-327, 465-473)

**What's happening:** Triage items are draggable and timeline slots accept drops, but scheduling-from-triage is only implemented through pointer drag/drop paths. There is no parallel keyboard command path for moving a triage item onto the timeline.

**Why it matters:** Keyboard-only users cannot perform the same assignment flow.

### Error text is rendered without alert/live semantics in key module composers

**Files:** `src/components/project-space/TasksModuleSkin.tsx` (line 351), `src/components/project-space/RemindersModuleSkin.tsx` (line 531)

**What's happening:** Inline error messages are visually styled but do not use `role="alert"` or assertive live-region semantics in these composer paths.

**Why it matters:** Screen reader users may not be notified promptly when submissions fail.

### Button role semantics are partially implemented on non-button element

**Files:** `src/components/project-space/RemindersModuleSkin.tsx` (lines 245-263)

**What's happening:** A `div` is given `role="button"` and keyboard handlers, but it does not expose a corresponding click activation handler typical for button parity behavior.

**Why it matters:** Mixed semantics can produce inconsistent behavior expectations across input modalities.

## 10. Type safety gaps

### Assertion chains bypass type guarantees in collaboration code

**Files:** `src/features/notes/collabSessionManager.ts` (lines 125, 301, 444), `src/features/notes/lexicalState.ts` (line 34), `src/features/notes/CollaborativeLexicalEditor.tsx` (lines 306-307)

**What's happening:** The code repeatedly uses `as unknown as ...` and narrow-interface assertions to force compatibility with provider/editor APIs. These casts bypass compile-time validation of runtime shapes.

**Why it matters:** Runtime shape mismatches can slip through type checks and fail in production paths.

### Envelope parsing uses broad casts before runtime validation

**Files:** `src/services/projectsService.ts` (lines 45-49, 61-62), `src/services/hub/transport.ts` (line 41)

**What's happening:** JSON responses are cast into envelope/record shapes prior to full structural checks. Some validation exists, but the cast-first pattern reduces static confidence.

**Why it matters:** Contract drift from backend responses can become latent bugs.

### Route-state parsing relies on type assertions from `unknown`

**Files:** `src/pages/ProjectSpacePage.tsx` (lines 93-103, 97)

**What's happening:** Location state is read from `unknown` and then asserted to typed records (`state as { focusNodeKey?: unknown }`) before narrowing. This pattern repeats in helper parsing.

**Why it matters:** Repeated cast-then-narrow patterns increase the chance of missed edge cases during route-state evolution.
