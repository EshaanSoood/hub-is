# Widget Empty State Audit

## Standard
The target empty state pattern is:
- Visual indicator (icon or illustration)
- Clear explanatory message ("No tasks in this project yet")
- Actionable CTA when applicable ("Create a task" button or link)
- The message should distinguish between "no data exists" vs "data exists but is filtered out" vs "not configured"

Audit note on shared wrapper behavior:
- `WidgetEmptyState` only renders a visible title. Its `description` is screen-reader-only (`sr-only`), so sighted users do not see explanatory copy.
- `WidgetLoadingState` renders skeleton lines with an `sr-only` label; there is no visible loading text or icon.

## WidgetGrid (zero widgets)
- Trigger: `widgets.length === 0`.
- What renders: Dashed empty card with `Icon name="plus"`, heading `"Let's get this project started!"`, body copy `"Add a first widget to shape the project, then keep building from there."`, and `"Add a widget"` button (when `showAddControls` is true).
- Has icon: yes (`plus`)
- Has message: yes (`"Let's get this project started!"` + explanatory body copy)
- Has CTA: yes (`"Add a widget"`, can be disabled by `disableAdd`)
- Meets standard: yes (when add controls are enabled)
- Notes: If `showAddControls` is false, CTA is intentionally absent.

## WidgetFeedback (shared wrapper)
### Empty wrapper: `WidgetEmptyState`
- Trigger: Any widget returning `<WidgetEmptyState ... />`.
- What renders: Centered panel with title only; description is not visible.
- Has icon: no
- Has message: yes (`title` is visible; `description` is sr-only)
- Has CTA: no
- Meets standard: no
- Notes: This wrapper is the main reason multiple widgets have no icon/CTA on empty.

### Loading wrapper: `WidgetLoadingState`
- Trigger: Any widget returning `<WidgetLoadingState ... />`.
- What renders: Animated skeleton rows.
- Has icon: no
- Has message: no (visible text); label is sr-only
- Has CTA: no
- Meets standard: no
- Notes: Accessible via screen reader, but no visible loading explanation.

## TableWidgetSkin
### Empty state 1: No rows
- Trigger: `!loading && schema` and `modelRows.length === 0`.
- What renders: `WidgetEmptyState` with title `"No records yet"`.
- Has icon: no
- Has message: yes (`"No records yet"`; description is sr-only: `"Add a record to populate this table widget."`)
- Has CTA: no
- Meets standard: no
- Per-tier differences: none (no tiered variant in this file).

### Empty state 2: No view bound
- Trigger: `!loading && !schema`.
- What renders: `WidgetEmptyState` with title `"No table view found yet."`.
- Has icon: no
- Has message: yes (`"No table view found yet."`; description is sr-only: `"Create or select a table view to see records here."`)
- Has CTA: no
- Meets standard: no
- Per-tier differences: none.

### Loading state
- Trigger: `loading === true`.
- What renders: `WidgetLoadingState` (`label="Loading table records"`, `rows={6}`).
- Has icon: no
- Has message: no visible loading message
- Has CTA: no
- Meets standard: no

### Error state
- Trigger: none in this file.
- What renders: no dedicated error UI.

## KanbanWidgetSkin
### Empty state 1: No grouping/columns available
- Trigger: `!loading && groups.length === 0`.
- What renders: `WidgetEmptyState` title `"No kanban grouping configured yet."`.
- Has icon: no
- Has message: yes (title visible; description sr-only: `"Set a grouping field on the view to render columns."`)
- Has CTA: no
- Meets standard: no
- Per-tier differences: none.

### Empty state 2: Empty column
- Trigger: For any group where `group.records.length === 0`.
- What renders: Inline text `"No cards"` inside that column.
- Has icon: no
- Has message: yes (`"No cards"`)
- Has CTA: no
- Meets standard: no
- Per-tier differences: none.

### Missing-configuration state (non-empty board)
- Trigger: `!groupingConfigured` with non-empty `groups`.
- What renders: Banner text `groupingMessage ?? "No grouping."`; cards also show `"Grouping is not configured for this view."` when movement is disabled for config reasons.
- Has icon: no
- Has message: yes
- Has CTA: no
- Meets standard: no
- Per-tier differences: none.

### Loading state
- Trigger: `loading === true`.
- What renders: `WidgetLoadingState` (`label="Loading kanban cards"`, `rows={6}`).
- Has icon: no
- Has message: no visible loading message
- Has CTA: no
- Meets standard: no

### Error state
- Trigger: none in this file.
- What renders: no dedicated error UI.

## CalendarWidgetSkin
### Empty state 1: No events in dataset
- Trigger: `!loading && events.length === 0`.
- What renders: `WidgetEmptyState` with scope-aware title:
  - `"No relevant events yet."` when scope is `relevant`
  - `"No project events yet."` when scope is `all`
  Plus `"New Event"` button if `onCreateEvent` exists.
- Has icon: no
- Has message: yes (title visible; descriptions are sr-only)
- Has CTA: yes (`"New Event"`, conditional)
- Meets standard: no (missing icon; explanatory copy is not visible)
- Per-tier differences: none.

### Empty state 2: Day view has no events (delegated from CalendarDayView)
- Trigger: Day view active and that day has zero events.
- What renders: `WidgetEmptyState` title `"No events today"` plus `"Create event"` button when creation is enabled.
- Has icon: no
- Has message: yes
- Has CTA: yes (conditional)
- Meets standard: no
- Per-tier differences: none.

### Empty state 3: Week view day panel has no events (delegated from CalendarWeekView)
- Trigger: Week view active; a day card has `day.events.length === 0`.
- What renders: Inline text `"No events"` and a `+` create button when creation is enabled.
- Has icon: no
- Has message: yes
- Has CTA: yes (`+`, conditional)
- Meets standard: no (CTA label is not explicit; no icon/illustration)
- Per-tier differences: none.

### Loading state
- Trigger: `loading === true`.
- What renders: `WidgetLoadingState` (`label="Loading calendar"`, `rows={5}`).
- Has icon: no
- Has message: no visible loading message
- Has CTA: no
- Meets standard: no

### Error state
- Trigger: no fetch-error branch in this file.
- What renders: no top-level error UI.
- Notes: Creation form has inline errors (`"End time must be after start time."`, `"Failed to create event."`), but there is no widget-level fetch-failed state.

## TasksWidgetSkin
### Empty state 1 (M tier): No tasks
- Trigger: `sizeTier === 'M'`, `!tasksLoading`, and `displayedTasks.length === 0`.
- What renders: Text `"No tasks in this project."`.
- Has icon: no
- Has message: yes
- Has CTA: no
- Meets standard: no
- Per-tier differences: M-only.

### Empty state 2 (L tier): No tasks or all filtered out (delegated to TasksTab)
- Trigger: `sizeTier === 'L'` and `TasksTab` produces zero clusters (either no tasks or filters remove all tasks).
- What renders: Filter controls plus an empty list area (no explicit empty message).
- Has icon: no
- Has message: no
- Has CTA: partial (`"New Task"` button exists when not read-only, but not tied to explicit empty explanation)
- Meets standard: no
- Per-tier differences: L-only; also fails to distinguish "no tasks" vs "filtered out".

### Read-only informational state (S tier)
- Trigger: `sizeTier === 'S' && readOnly`.
- What renders: Text panel `"Tasks (read-only)"`.
- Has icon: no
- Has message: yes
- Has CTA: no
- Meets standard: no
- Per-tier differences: S-only.

### Loading state
- Trigger:
  - M tier: `tasksLoading` => `"Loading tasks..."`
  - L tier: `tasksLoading` => `"Loading tasks..."` (placement differs by read-only mode)
  - S tier: no loading indicator
- What renders: Inline text only.
- Has icon: no
- Has message: yes
- Has CTA: no
- Meets standard: no

### Error state
- Trigger: no widget-level fetch error path.
- What renders: no dedicated fetch error UI.
- Notes: Composer-level errors exist (`"Failed to create task."` / thrown message) but are not global data-fetch errors.

## RemindersWidgetSkin
### Empty state
- Trigger: `!error && !loading && renderedReminders.length === 0`.
- What renders: Text panel `"No reminders yet."`.
- Has icon: no
- Has message: yes
- Has CTA: no direct empty-state CTA (composer above can create)
- Meets standard: no
- Per-tier differences: same state in all tiers; tiers only change max visible count.

### Loading state
- Trigger: `loading && reminders.length === 0`.
- What renders: Text panel `"Loading reminders..."`.
- Has icon: no
- Has message: yes
- Has CTA: no
- Meets standard: no
- Notes: If `loading` is true but reminders already exist, no loading panel is shown.

### Error state
- Trigger: `error` prop truthy.
- What renders: Danger panel with raw error text.
- Has icon: no
- Has message: yes (error string)
- Has CTA: no
- Meets standard: no

### Other error visuals (input-level)
- Trigger: invalid draft or create/snooze failures.
- What renders: Inline text such as `"Add a title and time to create a reminder."`, `"Failed to create reminder."`, `"Failed to snooze reminder."`.

## FilesWidgetSkin
### Empty state 1 (S tier): No files / query mismatch
- Trigger: `sizeTier === 'S' && visible.length === 0`.
- What renders:
  - `"No files match"` when search query is active
  - `"No files in this project (read-only)"` in read-only mode
  - `"Add files to this project"` otherwise
- Has icon: no dedicated empty-state icon (drop zone has upload icon)
- Has message: yes
- Has CTA: yes (DropZone upload button)
- Meets standard: no
- Per-tier differences: S-specific wording includes search mismatch path.

### Empty state 2 (M tier): No files
- Trigger: `sizeTier === 'M' && sorted.length === 0`.
- What renders: `"No files in this project (read-only)"` or `"Add files to this project"`.
- Has icon: no dedicated empty-state icon
- Has message: yes
- Has CTA: yes (DropZone upload button)
- Meets standard: no
- Per-tier differences: M-only.

### Empty state 3 (L tier): No files after filter
- Trigger: `sizeTier === 'L' && visible.length === 0`.
- What renders:
  - all-filter: read-only/no-files vs add-files copy
  - typed filter: `"No {filterKey} files"`
- Has icon: no dedicated empty-state icon
- Has message: yes
- Has CTA: yes (DropZone upload button)
- Meets standard: no
- Per-tier differences: L-only; does distinguish filtered-out vs no-data.

### Loading state
- Trigger: no widget-level fetch loading branch.
- What renders: no global loading UI; only per-file upload progress (`"Uploading..."` + progress bar).

### Error state
- Trigger: none in this file.
- What renders: no dedicated error UI.

## QuickThoughtsWidgetSkin
### Empty state
- Trigger: `visibleEntries.length === 0`.
- What renders: Text `"Nothing captured for this project yet."`.
- Has icon: no dedicated empty-state icon (header has `thought-pile` icon)
- Has message: yes
- Has CTA: yes (always-visible `"New Quick Thought"` plus button, disabled when read-only)
- Meets standard: no
- Per-tier differences:
  - S: no composer, list-only + top plus button
  - M: composer shown, visible entries capped at 5
  - L: composer shown, archived section available

### Loading state
- Trigger: none in this file.
- What renders: no loading UI.

### Error state
- Trigger: none in this file.
- What renders: no error UI (invalid local storage payloads silently collapse to empty).

## Summary Table

| Widget | State | Icon | Message | CTA | Meets Standard |
|--------|-------|------|---------|-----|----------------|
| WidgetGrid | zero widgets | yes | yes | yes | yes |
| WidgetFeedback | shared empty wrapper | no | partial (title only) | no | no |
| WidgetFeedback | shared loading wrapper | no | no (visible) | no | no |
| Table | loading | no | no (visible) | no | no |
| Table | no view/schema | no | yes | no | no |
| Table | no rows | no | yes | no | no |
| Table | error | no state | no state | no state | no |
| Kanban | loading | no | no (visible) | no | no |
| Kanban | no grouping/columns | no | yes | no | no |
| Kanban | empty column | no | yes | no | no |
| Kanban | unconfigured grouping banner | no | yes | no | no |
| Kanban | error | no state | no state | no state | no |
| Calendar | loading | no | no (visible) | no | no |
| Calendar | no events (scope-level) | no | yes | yes (conditional) | no |
| Calendar | day view no events | no | yes | yes (conditional) | no |
| Calendar | week day no events | no | yes | yes (conditional) | no |
| Calendar | error (fetch) | no state | no state | no state | no |
| Tasks | S read-only info | no | yes | no | no |
| Tasks | M loading | no | yes | no | no |
| Tasks | M no tasks | no | yes | no | no |
| Tasks | L loading | no | yes | no | no |
| Tasks | L no tasks/filtered out | no | no | partial | no |
| Tasks | error (fetch) | no state | no state | no state | no |
| Reminders | loading (no initial data) | no | yes | no | no |
| Reminders | empty list | no | yes | no | no |
| Reminders | error banner | no | yes | no | no |
| Files | S empty/search empty | no | yes | yes | no |
| Files | M empty | no | yes | yes | no |
| Files | L empty/filter empty | no | yes | yes | no |
| Files | loading (fetch) | no state | no state | no state | no |
| Files | error | no state | no state | no state | no |
| QuickThoughts | empty list | no | yes | yes | no |
| QuickThoughts | loading | no state | no state | no state | no |
| QuickThoughts | error | no state | no state | no state | no |

## Recommendations
For each state that does not meet the standard:

1. `WidgetFeedback.WidgetEmptyState` (shared)
- Icon: add optional `iconName` prop and render `Icon` (default: `plus`)
- Message: render `description` visibly below title (not sr-only)
- CTA: add optional `ctaLabel`/`onCta` support
- Per-tier: allow compact mode for `S` tier (smaller icon + one-line copy)

2. `WidgetFeedback.WidgetLoadingState` (shared)
- Icon: optional `Icon name="tasks"`/`"calendar"`/`"upload"` based on widget context
- Message: show visible label text above skeleton rows
- CTA: none needed for loading; keep CTA omitted
- Per-tier: reduce row count for `S` (`rows=3`) and keep larger counts for `M/L`

3. `Table no view/schema`
- Icon: `Icon name="settings"`
- Message: `"This table widget is not configured yet."`
- CTA: `"Select table view"` (open widget binding/view picker)
- Per-tier: n/a

4. `Table no rows`
- Icon: `Icon name="tasks"`
- Message: `"No records in this view yet."`
- CTA: `"Create record"` (open create-record flow)
- Per-tier: n/a

5. `Kanban no grouping/columns`
- Icon: `Icon name="settings"`
- Message: `"This board needs a grouping field before columns can render."`
- CTA: `"Configure grouping"` (open view settings)
- Per-tier: n/a

6. `Kanban empty column`
- Icon: `Icon name="plus"`
- Message: `"No cards in this column."`
- CTA: `"Create card"` (prefill this column value)
- Per-tier: n/a

7. `Kanban unconfigured grouping banner`
- Icon: `Icon name="settings"`
- Message: `"Grouping is disabled for this view."`
- CTA: `"Enable grouping"`
- Per-tier: n/a

8. `Calendar no events (scope-level)`
- Icon: `Icon name="calendar"`
- Message: visible body text should remain scope-specific:
  - no data: `"No project events yet."`
  - filtered scope: `"No relevant events right now. Try All."`
- CTA: `"New Event"` and secondary `"Switch to All"` when scope is `relevant`
- Per-tier: n/a

9. `Calendar day view no events`
- Icon: `Icon name="calendar"`
- Message: `"No events scheduled for this day."`
- CTA: `"Create event"`
- Per-tier: n/a

10. `Calendar week day no events`
- Icon: `Icon name="calendar"`
- Message: `"No events"`
- CTA: replace unlabeled `+` with `"Create"`
- Per-tier: n/a

11. `Tasks M no tasks`
- Icon: `Icon name="tasks"`
- Message: `"No tasks in this project yet."`
- CTA: `"New Task"`
- Per-tier: for `M`, keep compact icon and single-line CTA.

12. `Tasks L no tasks vs filtered out`
- Icon: `Icon name="tasks"` (no data) and `Icon name="menu"` (filtered)
- Message:
  - no tasks: `"No tasks in this project yet."`
  - filtered: `"No tasks match current filters."`
- CTA:
  - no tasks: `"New Task"`
  - filtered: `"Clear filters"`
- Per-tier: L can show both primary and secondary CTA inline.

13. `Tasks S read-only info`
- Icon: `Icon name="tasks"`
- Message: `"Tasks are read-only in this project."`
- CTA: if applicable, `"Open full tasks view"`; otherwise omit CTA intentionally
- Per-tier: keep compact with icon-only + short copy in `S`

14. `Reminders empty list`
- Icon: `Icon name="reminders"`
- Message: `"No reminders yet."`
- CTA: `"Add reminder"` (focus composer input)
- Per-tier: keep CTA as inline link/button in `S`, full button in `M/L`

15. `Reminders error banner`
- Icon: `Icon name="bell-unread"`
- Message: prepend stable copy `"Couldn't load reminders."` plus error details
- CTA: `"Retry"`
- Per-tier: same behavior for all tiers

16. `Files empty states (S/M/L)`
- Icon: `Icon name="upload"`
- Message must stay mode-specific:
  - no data: `"No files in this project yet."`
  - filtered/search: `"No files match your filters."`
  - read-only: `"No files are available in read-only mode."`
- CTA: `"Upload files"` (or `"Clear filters"` for filtered/search case)
- Per-tier: `S` can use icon + one-line copy; `L` can show both upload and clear-filter CTAs

17. `QuickThoughts empty list`
- Icon: `Icon name="thought-pile"` in the empty card itself (not only header)
- Message: `"No quick thoughts captured for this project yet."`
- CTA: `"Capture thought"` (focus composer or open editor)
- Per-tier: in `S`, keep one-button CTA; in `L`, also show `"View archived"` when archived items exist.
