# Phase 8: Red-tier component splits (combined PR)

Six independent splits of Red-tier files into focused modules. Each split was developed in its own worktree with its own verification, then merged into this branch. All six merges were clean (no file overlap).

## Combined verification on merged branch
- npm run typecheck: ✅
- npm run lint: ✅ (11 warnings; existing `react-hooks/exhaustive-deps` warnings and a `react-hooks/incompatible-library` warning on `useReactTable`)
- npm run validate: ✅
- npm run build: ✅

## Files affected (cumulative across all six splits)
- Total new files: 57
- Total renamed files: 1 (all via git mv)
- Total lines added: 7054
- Total lines removed: 5067

## Summaries from each split

### Phase 8a: TableModuleSkin

# Phase 8a: TableModuleSkin split

## Branch
phase8a-table

## Files created
- src/components/project-space/TableModuleSkin/SortableHeaderCell.tsx
- src/components/project-space/TableModuleSkin/TableCell.tsx
- src/components/project-space/TableModuleSkin/TableCreateRow.tsx
- src/components/project-space/TableModuleSkin/TableHeader.tsx
- src/components/project-space/TableModuleSkin/TableRow.tsx
- src/components/project-space/TableModuleSkin/hooks/useTableBulkActions.ts
- src/components/project-space/TableModuleSkin/hooks/useTableCreateRow.ts
- src/components/project-space/TableModuleSkin/hooks/useTableDragReorder.ts
- src/components/project-space/TableModuleSkin/hooks/useTableFiltering.ts
- src/components/project-space/TableModuleSkin/hooks/useTableInlineEditing.ts
- src/components/project-space/TableModuleSkin/hooks/useTableKeyboardGrid.ts
- src/components/project-space/TableModuleSkin/hooks/useTableSorting.ts
- src/components/project-space/TableModuleSkin/types.ts
- src/components/project-space/TableModuleSkin/valueNormalization.ts

## Files renamed (git mv)
- src/components/project-space/TableModuleSkin.tsx → src/components/project-space/TableModuleSkin/index.tsx

## Line counts
- Before: TableModuleSkin.tsx = 1478 lines
- After: TableModuleSkin/index.tsx = 509 lines
- Other new files: (name = lines, one per line)
SortableHeaderCell.tsx = 96
TableCell.tsx = 75
TableCreateRow.tsx = 118
TableHeader.tsx = 248
TableRow.tsx = 65
types.ts = 62
valueNormalization.ts = 267
useTableBulkActions.ts = 124
useTableCreateRow.ts = 76
useTableDragReorder.ts = 84
useTableFiltering.ts = 82
useTableInlineEditing.ts = 100
useTableKeyboardGrid.ts = 67
useTableSorting.ts = 12

## Hooks extracted
- useTableFiltering: Owns filter panel state, active filter bookkeeping, and filtered-row derivation.
- useTableSorting: Owns TanStack sorting state used by the table instance.
- useTableDragReorder: Owns column drag sensors, column-order state, and drag/drop reorder handlers.
- useTableInlineEditing: Owns editable-cell state and submit/blur/key handlers for commit/cancel behavior.
- useTableBulkActions: Owns selection state, bulk delete flow, and bulk status update flow.
- useTableKeyboardGrid: Owns keyboard row navigation behavior (arrows/home/end/enter/space).
- useTableCreateRow: Owns create-row form state and submit flow (kept with extracted hooks for composition clarity).

## Components extracted
- SortableHeaderCell: Renders one draggable/resizable/sortable column header cell.
- TableHeader: Renders bulk actions bar, filter controls, and the DnD-enabled header row grid.
- TableRow: Renders one virtualized grid row container and delegates per-cell rendering.
- TableCell: Renders each grid cell, including inline edit controls for active editable cells.
- TableCreateRow: Renders the sticky create-row composer aligned to visible columns.

## Utilities extracted
- valueNormalization.ts: Centralizes record value normalization/parsing, date preset matching, display formatting, and field input conversion.
- types.ts: Centralizes table-local interfaces/types previously in the monolithic file.

## Decisions and deviations
- Added `types.ts`, `SortableHeaderCell.tsx`, `TableCreateRow.tsx`, and `useTableCreateRow.ts` as additional seams because they reduced index composition complexity without changing behavior.
- Kept virtualization setup (`useVirtualizer`, scroll element resolution, template column sizing) in `index.tsx` because it is tightly coupled to rendered layout and refs.
- Kept table column definitions in `index.tsx` because they thread together multiple extracted hooks/components and are still a central composition seam.

## Verification
- npm run typecheck: ✅
- npm run lint: ✅ (warnings present, including existing `react-hooks/exhaustive-deps` warnings and one `react-hooks/incompatible-library` warning at `useReactTable`)
- npm run validate: ✅
- npm run build: ✅

## Risks / things a reviewer should look at carefully
- Inline edit blur/escape sequencing now crosses `useTableInlineEditing` + `TableCell`, so reviewer should sanity-check commit/cancel behavior on select/date/number/title cells.
- Column selection/filters/drag order now cross multiple hooks and components; reviewer should spot-check interactions when schema fields are added/removed.
- Virtualized row keyboard navigation now crosses `useTableKeyboardGrid` + `TableRow`; reviewer should verify focus movement and open-on-enter behavior across large datasets.

## Confirmation
- src/features/notes/ untouched: ✅
- No new npm packages: ✅
- No inline styles introduced: ✅

### Phase 8b: KanbanModuleSkin

# Phase 8b Summary

- Branch: `phase8b-kanban`
- Commit message: `Phase 8b: split KanbanModuleSkin into focused files`

## Pre-flight

- Confirmed `src/components/project-space/KanbanModuleSkin.tsx` was a single flat file before extraction.
- Observed line count at split time: `1258` lines.

## Branch Setup

- `git worktree add ../phase8b-kanban -b phase8b-kanban main`
- `cd ../phase8b-kanban`
- `npm install`

## Mechanical Split

- Converted file path via `git mv`:
  - `src/components/project-space/KanbanModuleSkin.tsx`
  - `src/components/project-space/KanbanModuleSkin/index.tsx`
- Rebuilt `index.tsx` as composition entrypoint (`200` lines) and extracted focused modules:
  - `src/components/project-space/KanbanModuleSkin/hooks/useKanbanGrouping.ts`
  - `src/components/project-space/KanbanModuleSkin/hooks/useKanbanCardMoves.ts`
  - `src/components/project-space/KanbanModuleSkin/hooks/useKanbanColumnLimits.ts`
  - `src/components/project-space/KanbanModuleSkin/hooks/useKanbanMutations.ts`
  - `src/components/project-space/KanbanModuleSkin/KanbanColumn.tsx`
  - `src/components/project-space/KanbanModuleSkin/KanbanCard.tsx`
  - `src/components/project-space/KanbanModuleSkin/KanbanColumnHeader.tsx`
  - `src/components/project-space/KanbanModuleSkin/types.ts`

## Verification

- `npm run typecheck` ✅
- `npm run check:tokens` ✅
- `npm run lint` ✅ (existing baseline warnings only; no new errors)

## Constraints Check

- No behavior-intent changes; extraction was mechanical.
- No edits under `src/features/notes/`.
- No PR opened.
- No push performed.

### Phase 8c: CalendarModuleSkin

# Phase 8c Summary

## Branch
- `phase8c-calendar`

## Pre-flight
- Confirmed `src/components/project-space/CalendarModuleSkin/` is a folder.
- Confirmed Phase 2 output exists:
  - `src/components/project-space/CalendarModuleSkin/index.tsx`
  - `src/components/project-space/CalendarModuleSkin/CalendarMediumWeekStrip.tsx`

## What Changed

### Added files
- `src/components/project-space/CalendarModuleSkin/CalendarSmallView.tsx`
  - Extracted small-tier compact day summary rendering.
- `src/components/project-space/CalendarModuleSkin/CalendarLargeView.tsx`
  - Extracted large-tier rendering (scope + month/year/week/day surfaces, including month overflow popover behavior).
- `src/components/project-space/CalendarModuleSkin/CalendarCreatePanel.tsx`
  - Extracted inline create-event panel UI.
- `src/components/project-space/CalendarModuleSkin/hooks/useCalendarCreatePanel.ts`
  - Extracted create-panel state, draft/form handlers, validation, and submit flow.
- `src/components/project-space/CalendarModuleSkin/hooks/useCalendarTierSelection.ts`
  - Extracted size-tier-to-render-tier selection logic.
- `src/components/project-space/CalendarModuleSkin/types.ts`
  - Centralized module types/contracts shared across split files.
- `src/components/project-space/CalendarModuleSkin/utils.ts`
  - Centralized calendar utility/date helper logic used across tiers.

### Updated files
- `src/components/project-space/CalendarModuleSkin/index.tsx`
  - Reduced to thin composition/orchestration layer.
  - Retains shared cross-tier state and wiring.
  - Chooses tier via `useCalendarTierSelection` and renders:
    - `CalendarSmallView` for S
    - Existing medium composition (`CalendarMediumWeekStrip`) for M
    - `CalendarLargeView` for L/default
  - Wires extracted create-panel hook + component.
  - Line count now in requested range (`230` lines).

## Behavior Notes
- Event rendering logic was relocated, not redesigned.
- Existing `CalendarMediumWeekStrip.tsx` was left unchanged.
- Small tier continues using `<EventCard>` exactly as before.
- Large-tier `view` and `monthCursor` state remain owned by `index.tsx` so cross-tier behavior stays aligned with prior implementation.

## Verification
- `npx eslint src/components/project-space/CalendarModuleSkin/index.tsx src/components/project-space/CalendarModuleSkin/CalendarLargeView.tsx src/components/project-space/CalendarModuleSkin/CalendarSmallView.tsx src/components/project-space/CalendarModuleSkin/CalendarCreatePanel.tsx src/components/project-space/CalendarModuleSkin/hooks/useCalendarCreatePanel.ts src/components/project-space/CalendarModuleSkin/hooks/useCalendarTierSelection.ts src/components/project-space/CalendarModuleSkin/types.ts src/components/project-space/CalendarModuleSkin/utils.ts`
- `npm run typecheck`

## Commit
- `Phase 8c: split CalendarModuleSkin tiers into focused files`

### Phase 8d: PersonalizedDashboardPanel

# Phase 8d Summary

## Branch
- `phase8d-dashboard`

## Pre-flight
- Confirmed source was still a flat file before split:
  - `src/features/PersonalizedDashboardPanel.tsx` = `1124` lines.

## What Changed

### Renamed (git mv)
- `src/features/PersonalizedDashboardPanel.tsx` → `src/features/PersonalizedDashboardPanel/index.tsx`

### Added files
- `src/features/PersonalizedDashboardPanel/hooks/useDashboardAggregation.ts`
  - Extracted aggregation and normalization for dashboard tasks/events/reminders, day-strip data, and pip counts.
- `src/features/PersonalizedDashboardPanel/hooks/useProjectLens.ts`
  - Extracted project-lens filter state and filtered day data/count derivation.
- `src/features/PersonalizedDashboardPanel/hooks/useDashboardData.ts`
  - Extracted runtime/authz-driven dashboard data dependencies (`useAuthz`, reminders runtime, hub-view availability).
- `src/features/PersonalizedDashboardPanel/StreamView.tsx`
  - Extracted date-banded stream rendering with sort/filter controls.
- `src/features/PersonalizedDashboardPanel/DayStripSection.tsx`
  - Extracted DayStrip + ContextBar + TriagePanel integration and local timeline/triage UI state.
- `src/features/PersonalizedDashboardPanel/ProjectLensFilter.tsx`
  - Extracted Project Lens section filter popover control.

### Additional focused extractions
- `src/features/PersonalizedDashboardPanel/ProjectLensView.tsx`
  - Isolated Project Lens section rendering from top-level composition.
- `src/features/PersonalizedDashboardPanel/ItemRow.tsx`
  - Reusable row renderer that continues using existing `<TaskCard>` / `<EventCard>` behavior.
- `src/features/PersonalizedDashboardPanel/ViewSwitcher.tsx`
  - Isolated view-switcher popover/menu keyboard behavior.
- `src/features/PersonalizedDashboardPanel/hooks/useDashboardMutations.ts`
  - Isolated task/reminder mutation callbacks and refresh flow.
- `src/features/PersonalizedDashboardPanel/types.ts`
  - Centralized dashboard-local types/contracts.
- `src/features/PersonalizedDashboardPanel/utils.ts`
  - Centralized dashboard-local date/sort/label utility helpers.

### Updated composition
- `src/features/PersonalizedDashboardPanel/index.tsx`
  - Reduced to orchestration/composition layer that:
    - calls `useDashboardAggregation`
    - applies `useProjectLens`
    - renders `DayStripSection` + `ProjectLensView` / `StreamView`
  - Line count now `177` (target 150-300 met).

## Behavior Notes
- Existing card rendering is preserved (`<TaskCard>`, `<EventCard>` unchanged in behavior).
- Aggregation logic was moved, not redesigned.
- DayStrip/ContextBar/Triage behavior remains wired to the same underlying data and mutation flows.

## Verification
- `npm run typecheck` ✅
- `npm run lint` ✅ (warnings only; pre-existing `react-hooks/exhaustive-deps` warnings in unrelated files)

## Commit
- `Phase 8d: split PersonalizedDashboardPanel into aggregation and rendering`

### Phase 8e: TasksTab

# Phase 8e Summary - TasksTab cleanup

## Branch
- `phase8e-taskstab`

## Pre-flight
- Confirmed `src/components/project-space/TasksTab/` exists as a folder.
- Confirmed both Phase 2 files exist:
  - `src/components/project-space/TasksTab/index.tsx`
  - `src/components/project-space/TasksTab/TaskRow.tsx`

## Assessment
- `TasksTab/index.tsx` was **486 lines** (over the `< 400` target).
- `TaskRow` was already extracted from Phase 2.
- No non-trivial inline archive confirmation timing logic found.
- No substantial dedicated empty-state block found in `index.tsx` to extract as `TasksTabEmptyState.tsx`.

## Cleanup performed
- Extracted top controls/header UI into:
  - `src/components/project-space/TasksTab/TasksTabHeader.tsx`
- Extracted tab-local filter/sort/cluster logic into:
  - `src/components/project-space/TasksTab/hooks/useTasksTabFiltering.ts`
- Updated:
  - `src/components/project-space/TasksTab/index.tsx`
    - now composes `TasksTabHeader`
    - now consumes `useTasksTabFiltering`
    - keeps optimistic status + row rendering in-tab

## Line-count outcome
- `src/components/project-space/TasksTab/index.tsx`
  - Before: **486**
  - After: **243**

## Verification
- `npm run typecheck` (pass)
- `npm run lint` (pass with pre-existing warnings in unrelated files under `BottomToolbar` and `QuickCapture`; no new errors)
- `npm run build` (pass)

## Commit
- Commit message: `Phase 8e: TasksTab cleanup`

### Phase 8f: useProjectViewsRuntime

# PHASE8F_SUMMARY

## Branch
- `phase8f-viewsruntime`

## Pre-flight
- Confirmed `src/hooks/useProjectViewsRuntime.ts` exists.
- Current line count before refactor: `896` lines (newer than the ~816 estimate in the prompt).
- Set up requested worktree and dependencies:
  - `git worktree add ../phase8f-viewsruntime -b phase8f-viewsruntime main`
  - `cd ../phase8f-viewsruntime`
  - `npm install`

## Split Result
Refactored `useProjectViewsRuntime` into focused hooks with a thin orchestration layer and no consumer API changes.

### New hooks
- `src/hooks/useProjectCollectionsRuntime.ts`
  - collections state + collection loading/warm-up.
- `src/hooks/useProjectViewsRegistry.ts`
  - views registry state, selected embed view state, focused work view selection.
- `src/hooks/useProjectTableRuntime.ts`
  - table runtime state loading and table mutation handlers.
- `src/hooks/useProjectKanbanRuntime.ts`
  - kanban runtime state loading and kanban mutation handlers.
- `src/hooks/useProjectFocusedViewLoader.ts`
  - focused work-view loading lifecycle and cache-aware behavior.

### Shared runtime helpers
- `src/hooks/projectViewsRuntime/shared.ts`
  - extracted shared types/constants and helpers (`loadCompleteViewQuery`, `buildKanbanRuntime`, kanban/table runtime types, etc.).

### Aggregator
- `src/hooks/useProjectViewsRuntime.ts`
  - now a thin aggregator/orchestrator.
  - current line count: `198` lines (under 200 target).
  - keeps the same returned shape used by `ProjectSpaceWorkspace` and `useWorkViewModuleRuntime` paths.

## Interface Stability
- Preserved the external return contract from `useProjectViewsRuntime` (state fields, handlers, and derived `tableViews`/`kanbanViews` + runtime maps).
- No consumer updates were required.

## Verification
- `npm run typecheck` ✅
- `npm run lint` ✅ (existing repo warnings remain in unrelated files; no new lint errors)
- `npm run build` ✅

## Commit
- Commit message used: `Phase 8f: split useProjectViewsRuntime into focused hooks`

## Punch list for CodeRabbit review

Based on reading all six summaries, here is the categorized list of what a reviewer should pay attention to, organized by severity:

### High severity (real risk of regression)
- Table inline-edit commit/cancel sequencing across `useTableInlineEditing` and `TableCell` (blur, enter, escape, and type-specific editors).
- Table keyboard/focus behavior across virtualization boundaries (`useTableKeyboardGrid` + `TableRow`), including open-on-enter behavior and large datasets.
- Kanban card movement and WIP-limit enforcement across extracted mutation/grouping hooks (`useKanbanCardMoves`, `useKanbanColumnLimits`, `useKanbanMutations`).
- Dashboard interaction parity after extraction: Project Lens filter, Stream date-band navigation, and DayStrip/Triage mutation flows.
- `useProjectViewsRuntime` split hook interactions (focused view loading + table/kanban runtime registries) for stale closure/order-of-operations regressions.
- Any keyboard, focus, drag, or screen-reader behavior regressions in extracted table/kanban/dashboard components.

### Medium severity (structural questions worth a second look)
- Calendar tier-splitting boundaries: `index.tsx` ownership of `view`/`monthCursor` with `useCalendarTierSelection`, `CalendarLargeView`, and `CalendarSmallView`.
- Table additional seams beyond prompt minimum (`useTableCreateRow`, `TableCreateRow`, `types.ts`, `valueNormalization.ts`) were intentional; verify readability-to-complexity tradeoff.
- Views runtime decomposition into five hooks + shared helpers: ensure state threading remains coherent and consumer contract is unchanged.
- TasksTab split kept optimistic status + row rendering in `index.tsx`; verify that remaining responsibilities are still appropriately placed.

### Low severity (style / nit)
- Existing repository `react-hooks/exhaustive-deps` warnings in unrelated BottomToolbar/QuickCapture hooks.
- `react-hooks/incompatible-library` warning for TanStack `useReactTable` call in TableModuleSkin.
- Some prop threading remains verbose after mechanical extractions and may be tightened later.

### Expected CodeRabbit noise (safe to dismiss)
- Mechanical extraction churn comments ("consider splitting/combining" in newly created modules).
- Non-actionable memoization/dependency suggestions on extracted hooks where behavior is intentionally preserved.
- Naming/export-order/style nits on newly split files without behavior impact.
- Move-related diff noise where logic was relocated but not redesigned.

## VoiceOver smoke test checklist

A single manual pass against this branch should cover:
- TableModuleSkin: keyboard grid navigation (arrow keys across cells), inline cell edit (enter to edit, escape to cancel, tab to commit and move), bulk select with shift+click or keyboard, drag reorder if possible via keyboard alternative
- KanbanModuleSkin: column navigation, card focus, moving a card between columns (whatever the current mechanism is), verifying WIP limits still enforce
- CalendarModuleSkin: switching between small/medium/large tiers by resizing the pane, creating an event via the create panel, verifying event list announcements
- PersonalizedDashboardPanel: Project Lens filter interaction, Stream scroll and date band navigation, DayStrip interaction
- TasksTab: verify nothing regressed (lowest risk since Phase 2 did the heavy work)
- useProjectViewsRuntime: exercise table→kanban view switching in a project with multiple views

## Confirmations
- src/features/notes/ untouched across all six splits: ✅
- No new npm packages introduced: ✅
- No inline styles introduced: ✅
- All six split branches verified green individually before merge: ✅
- Combined branch verification passes: ✅
