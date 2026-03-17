# Bespoke Components Needed (Hub Cohesion Plan)

Goal: define the custom structural components required to make the Hub coherent while still composing Radix/shadcn primitives through `src/components/primitives`.

Note: this is planning only, no implementation.

## A) App Shell + Navigation bespoke

## 1) `HubGlobalHeader`

- Purpose: unify identity, global nav, session context, and profile trigger into one reusable signed-in header.
- Where used: all signed-in routes (`/`, `/projects`, `/lessons`, `/media`, `/dev`, `/blocked-inputs`, project routes).
- Data inputs: `appName`, `userName`, `roleLabel`, `tabs[] {to,label,enabled,active}`, `profileAction`.
- States: default, compact, loading-session, capability-restricted-tabs.
- Accessibility: nav landmark, keyboard-focusable links, current-page indication, skip-link integration.
- Built from primitives: `Button`, `LinkButton`, `DropdownMenu` (optional profile menu), `Tooltip`.
- Visual notes: keep `max-w-7xl`, token backgrounds, consistent active-nav treatment.

## 2) `ProjectContextHeader`

- Purpose: canonical project-scoped top header replacing wireframe copy and ad hoc title structure.
- Where used: `/projects/:projectId/overview`, `/projects/:projectId/work/:paneId`, `/projects/:projectId/tools`.
- Data inputs: `projectName`, `projectSummary`, `activeTopTab`, `topTabs[]`, `collaboratorAvatars[]`, `metaBadges[]`.
- States: default, loading-project, access-denied, long-project-name wrapping.
- Accessibility: `h1` project title, tab semantics with `aria-controls`, keyboard tab switching.
- Built from primitives: `Tabs`, `TabButton`, `Popover`, `Button`, `Chip`.
- Visual notes: same spacing rhythm as `PageHeader`; no placeholder text.

## 3) `PinnedPaneStrip`

- Purpose: standardize pinned-pane quick access and unpin controls.
- Where used: project work context currently in `TopNavTabs`/`PinnedPanesTabs`.
- Data inputs: `items[] {id,title,isActive}`, `onOpen`, `onUnpin`.
- States: empty, overflow-scroll, selected, hover, disabled.
- Accessibility: announced as tab/toolbar region; keyboard arrow navigation; clear labels for unpin buttons.
- Built from primitives: `Button`, `ScrollArea`, `Tooltip`.
- Visual notes: avoid sticky-first/last hacks unless design-justified.

## B) Page scaffolds + headers bespoke

## 4) `HubPageScaffold`

- Purpose: enforce one layout contract for non-project routed pages.
- Where used: `/`, `/projects`, `/lessons`, `/media`, `/dev`, `/blocked-inputs`, `404`, access-denied.
- Data inputs: `title`, `description`, `titleActions`, `children`, `density`.
- States: default, loading, error-banner-present.
- Accessibility: heading hierarchy starts at one `h1`; optional region labels per section.
- Built from primitives: `Card`, `InlineNotice`, `Button`.
- Visual notes: wraps `PageHeader` behavior with standard section spacing.

## 5) `ProjectPageScaffold`

- Purpose: normalize project page layering: header, tab bar, optional context controls, content region.
- Where used: all `ProjectSpacePage` tabs.
- Data inputs: `projectHeader`, `topNav`, `subHeader`, `content`.
- States: loading-project, error-project, not-found-project.
- Accessibility: deterministic focus order from top nav to content; proper tabpanel labeling.
- Built from primitives: `Tabs`, `Card`, `InlineNotice`.
- Visual notes: replace ad hoc `space-y-4` stacks with explicit slots.

## 6) `PageTitleRow`

- Purpose: single canonical title row used by both Hub and Project scaffolds.
- Where used: existing `PageHeader` + project variants.
- Data inputs: `title`, `subtitle`, `leadingMeta`, `actions`, `breadcrumbs?`.
- States: no-subtitle, with-actions, cramped-width wrapping.
- Accessibility: always renders semantic heading tag and labeled action region.
- Built from primitives: `Button`, `Chip`, `Divider`.
- Visual notes: supports two density modes (`default`, `compact`).

## C) Domain-specific bespoke (Tasks, Calendar, Timeline, Notes, Projects, Tools)

## 7) `UnifiedTaskSurface`

- Purpose: merge global task table and project task clusters into one composable task surface system.
- Where used: Hub tasks panel and project overview tasks tab.
- Data inputs: `tasks[]`, `viewMode (table|cluster|board-future)`, `filters`, `groupBy`, `actions`.
- States: default, empty, loading, error, read-only.
- Accessibility: list/table semantics per mode, keyboard action menu, announced status changes.
- Built from primitives: `Tabs`, `DropdownMenu`, `AlertDialog`, `Checkbox`, `Chip`.
- Visual notes: one priority badge language and one row/action layout.

## 8) `CalendarWorkspace`

- Purpose: canonical calendar surface for month/week/day with shared toolbar/filter pattern.
- Where used: project overview calendar now; future global calendar route.
- Data inputs: `events[]`, `view`, `range`, `filters`, `onNavigateDate`, `onSelectEvent`.
- States: month/day/week/year, empty-range, loading, error.
- Accessibility: grid semantics for month, list semantics for agenda/day, keyboard date navigation.
- Built from primitives: `Tabs`, `Select`, `Popover`, `Button`, `Tooltip`.
- Visual notes: remove raw `text-[10px]`/`text-[11px]`; map to typography tokens.

## 9) `TimelineActivitySurface`

- Purpose: unify timeline and activity-log event representation.
- Where used: project timeline tab + Hub activity feed panel.
- Data inputs: `events[] {id,time,type,priority,project,actor,message}`, `grouping`, `filters`.
- States: chronological, grouped, empty, loading, error.
- Accessibility: semantic list with headings per date group; keyboard-jump by section.
- Built from primitives: `Card`, `Chip`, `ScrollArea`, `FilterChip`.
- Visual notes: one event dot/badge style, one timestamp style.

## 10) `ProjectNotesWorkspace`

- Purpose: actual routed note editing and revision surface for project work context.
- Where used: `/projects/:projectId/work?noteId=...` and in-pane notes mode.
- Data inputs: `projectId`, `noteId`, `noteMeta`, `lexicalState`, `collabSession`, `permissions`.
- States: default-editing, read-only, disconnected, locked, saving, error, missing-note.
- Accessibility: labeled editor region, presence/status live region, shortcut hints.
- Built from primitives: `Card`, `InlineNotice`, `Button`, `Dialog`, `Popover`.
- Visual notes: compose existing `features/notes/EditorShell` + lexical editor styles under one shell.

## 11) `ProjectIndexSurface`

- Purpose: standard project list and project cards with consistent metadata/actions.
- Where used: `/projects` and potentially dashboard “Accessible Projects” list.
- Data inputs: `projects[]`, `sort`, `filters`, `onOpenProject`, `onCreateProject?`.
- States: empty, loading, error, filtered-none.
- Accessibility: table/card mode switch must preserve keyboard and headings.
- Built from primitives: `DataTable` successor + `Card`, `Button`, `Select`.
- Visual notes: unify with dashboard project-list styling in `PersonalizedDashboardPanel`.

## 12) `ToolsAutomationWorkbench`

- Purpose: replace placeholder tools/automation blocks with a reusable builder + run panel shell.
- Where used: project tools tab and future global tools route.
- Data inputs: `tools[]`, `automationDraft`, `triggers`, `conditions`, `actions`, `runStatus`.
- States: default, empty (no tools), loading, run-in-progress, run-error, draft-invalid.
- Accessibility: keyboard-stepper for builder, labeled sections, confirm dialogs for destructive actions.
- Built from primitives: `Tabs`, `Select`, `Dialog`, `AlertDialog`, `Button`, `Checkbox`.
- Visual notes: one row contract for live tool items; one panel contract for builder sections.

## D) Cross-cutting bespoke patterns

## 13) `UnifiedFilterBar`

- Purpose: one filter-shell pattern across tasks/calendar/timeline/files.
- Where used: project overview subviews and future list-heavy Hub screens.
- Data inputs: `filters[]`, `search`, `activeCount`, `onClearAll`, `onApply`.
- States: collapsed, expanded, active-filters, empty, loading-options.
- Accessibility: must use Radix popover/dialog semantics, not custom fixed overlays.
- Built from primitives: `Popover` or `Dialog`, `Select`, `FilterChip`, `Button`.
- Visual notes: replace `FilterBarOverlay` custom overlay implementation.

## 14) `SplitPaneWorkbench`

- Purpose: standardized two-region (organization/workspace) layout for project work panes.
- Where used: `WorkView` organization area + creative workspace.
- Data inputs: `leftRegion`, `rightRegion`, `layoutMode`, `resizable`, `collapsedStates`.
- States: dual, left-only, right-only, both-disabled-guarded, loading.
- Accessibility: keyboard-operable resize handles and collapse toggles with ARIA values.
- Built from primitives: `Card`, `Divider`, `Button`, `Tooltip`.
- Visual notes: formalize module/workspace boundary and resizable behavior.

## 15) `SurfaceStatePack`

- Purpose: one reusable set for loading/empty/error/informational states.
- Where used: all pages/panels currently showing ad hoc text states.
- Data inputs: `stateType`, `title`, `description`, `actions[]`, `icon`.
- States: loading-skeleton, empty, error, warning, success-confirmation.
- Accessibility: uses `role=status`/`role=alert` appropriately; focus target on recoverable errors.
- Built from primitives: `InlineNotice`, `Card`, `Button`, `Skeleton` (new primitive needed).
- Visual notes: ensures every surface has consistent state language and spacing.

## 16) `GovernanceFormSection`

- Purpose: standardized labeled form sections for owner/invite/membership/recovery workflows.
- Where used: `ProjectCorePanel` owner actions and future settings screens.
- Data inputs: `sectionTitle`, `fields[]`, `helperText`, `actions[]`, `status`.
- States: idle, validating, submitting, success, error, read-only.
- Accessibility: explicit labels/ids for every field; grouped with legends and descriptions.
- Built from primitives: `Card`, `Select`, `Input` (new primitive), `Textarea` (new primitive), `Button`.
- Visual notes: breaks monolithic governance form into predictable chunks.

## E) Future surfaces (Kanban)

Status: **future** (no implementation now).

## 17) `KanbanBoardShell` (future)

- Purpose: route-level board scaffold for task board workflows.
- Where used: future project task board route and optional global tasks board.
- Data inputs: `boardMeta`, `columns[]`, `filters`, `swimlanes`, `permissions`.
- States: default, empty-board, loading, archived-view, error.
- Accessibility: keyboard board navigation, column headings, drag-and-drop fallback actions.
- Built from primitives: `ScrollArea`, `Dialog`, `DropdownMenu`, `Button`, `Tooltip`.
- Visual notes: horizontal board with sticky column headers and token spacing.

## 18) `KanbanColumn` (future)

- Purpose: standard lane container for card grouping.
- Where used: within `KanbanBoardShell`.
- Data inputs: `columnId`, `title`, `wipLimit`, `cards[]`, `dropState`.
- States: default, empty-column, over-limit, collapsed.
- Accessibility: landmark/region labeling, keyboard move targets, announce card counts.
- Built from primitives: `Card`, `Chip`, `Popover`, `Button`.
- Visual notes: fixed/min width per density token, consistent lane gutters.

## 19) `KanbanTaskCard` (future)

- Purpose: reusable draggable/selectable task card with metadata and quick actions.
- Where used: board columns.
- Data inputs: `task`, `priority`, `assignee`, `dueDate`, `tags`, `isSelected`.
- States: default, selected, dragging, blocked, overdue.
- Accessibility: keyboard reorder actions + non-pointer move controls; high-contrast status markers.
- Built from primitives: `Card`, `DropdownMenu`, `Tooltip`, `Dialog`.
- Visual notes: aligns with unified task row language in non-board views.

## 20) `KanbanBoardFilterBar` (future)

- Purpose: board-level filter/search/sort controls.
- Where used: top of future board surface.
- Data inputs: `filters`, `assignees`, `labels`, `search`, `sort`.
- States: default, active-filters, collapsed, no-results.
- Accessibility: clear labels, keyboard chips, reset control.
- Built from primitives: `Select`, `FilterChip`, `Popover`, `Button`.
- Visual notes: must visually match `UnifiedFilterBar`.

## Coverage summary

- App shell/navigation bespoke count: 3
- Page scaffolds/headers bespoke count: 3
- Domain-specific bespoke count: 6
- Cross-cutting bespoke count: 4
- Future Kanban bespoke count: 4

These components are sufficient to begin full design specs and engineering contracts without changing current runtime behavior.

