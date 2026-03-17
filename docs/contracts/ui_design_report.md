# UI Design Implementation Report (Contract V1)

## Scope
This report documents the UI implementation for the contract-critical features:
1. Node-anchored doc comments.
2. Mentions + backlinks.
3. View embeds in Lexical docs.
4. Record Inspector relation editing.

## New Bespoke Components

### `CommentRail`
- File: `src/components/project-space/CommentRail.tsx`
- Responsibility:
  - Renders doc comment threads by status.
  - Surfaces orphaned comments separately.
  - Exposes keyboard-accessible thread actions (jump/resolve/reopen).

### `CommentComposer`
- File: `src/components/project-space/CommentComposer.tsx`
- Responsibility:
  - Reusable comment body composer.
  - Mention insertion via `MentionPicker`.
  - Used for node-anchored doc comment dialog workflow.

### `MentionPicker`
- File: `src/components/project-space/MentionPicker.tsx`
- Responsibility:
  - Lightweight mention target picker (users + records).
  - Calls mention search endpoint and inserts typed mention tokens.
  - Used in doc surface and comment surfaces.

### `BacklinksPanel`
- File: `src/components/project-space/BacklinksPanel.tsx`
- Responsibility:
  - Record-inspector backlinks view powered by materialized mentions.
  - Keyboard-reachable backlink list with descriptive labels.
  - Opens source docs/panes and supports node-focus routing when available.

### `ViewEmbedBlock`
- File: `src/components/project-space/ViewEmbedBlock.tsx`
- Responsibility:
  - Renders live table/kanban previews inside Lexical docs.
  - Uses contract ViewQuery API.
  - Supports "Open" action and row/card -> record inspector action.

### `RelationsSection`
- File: `src/components/project-space/RelationsSection.tsx`
- Responsibility:
  - Renders outgoing and incoming relation lists in Record Inspector.
  - Hosts the relation add/remove interaction wiring.
  - Surfaces mutation errors inline.

### `RelationPicker`
- File: `src/components/project-space/RelationPicker.tsx`
- Responsibility:
  - Keyboard-first relation creation flow.
  - Supports target record search and relation-field selection (`via_field_id`).
  - Uses record-only relation candidate search endpoint with project membership access.

### `RelationRow`
- File: `src/components/project-space/RelationRow.tsx`
- Responsibility:
  - Accessible relation row rendering with remove action.
  - Shared by outgoing and incoming relation lists.

## Lexical Customization Additions

### `ViewRefNode`
- File: `src/features/notes/nodes/ViewRefNode.tsx`
- Behavior:
  - Custom Lexical node type: `view-ref`.
  - Stable versioned serialization (`version: 1`).
  - Stores `view_id` and `sizing`.
  - Decorates with `ViewEmbedBlock`.

### View embed runtime context
- File: `src/features/notes/viewEmbedContext.tsx`
- Behavior:
  - Provides access token and open handlers to embedded block decorators.

### Editor wiring updates
- File: `src/features/notes/CollaborativeLexicalEditor.tsx`
- Added plugins/wiring:
  - Mention insertion into current selection.
  - ViewRef insertion.
  - Programmatic node focus/scroll.
  - View embed runtime provider.

## Project Space Surface Updates
- File: `src/pages/ProjectSpacePage.tsx`
- Added behavior:
  - "Comment on block" action with dialog-based composer.
  - Doc comment jump-to-node and orphaned section.
  - Mention insertion in doc content.
  - View picker + "Insert view block" action.
  - Record inspector backlinks panel and backlink navigation.
  - Record inspector relations section with:
    - "Links from this record" (outgoing) list
    - "Links to this record" (incoming) list
    - add relation picker
    - remove relation action
  - Work timeline module now renders `TimelineFeed` on the canonical `WorkView` module path (no fallback text-only tile for `timeline`).
  - Record-inspector attachment actions are API-backed:
    - rename re-links the provider reference with updated attachment name
    - move re-links attachment metadata with destination `pane_id`

## Primitives Used
- `Dialog` (`src/components/ui/dialog.tsx`)
  - Doc comment composer and record inspector.
- `Popover` (`src/components/ui/popover.tsx`)
  - Mention target picker surface.
- Native `select`
  - Relation-field selection in relation picker.
- Native list/input/select/button semantics for minimal, fully-wired a11y baseline.

## A11y Baseline Implemented
- Esc closes dialog-based doc comment composer.
- Focus returns to invoking control after composer close.
- Comment/backlink controls are keyboard reachable with descriptive labels.
- Timestamp display uses localized readable strings.
- Insert-view picker uses labeled select/listbox semantics.
- Relation picker supports keyboard navigation, labeled controls, ESC close, and focus return to "Add relation".

## Remaining UI Gaps (within current scope)
- `src/components/project-space/ViewEmbedBlock.tsx`: embed is preview-only (no inline cell editing in embedded mode by design for v1).

---

## Bespoke Integration Pass (Designer Handoff 2026-03-04)

### Source Spec
- `docs/designer-ui design elements.md`

### Bespoke elements integrated
- Project Space chrome:
  - Top rail tab shell now includes `aria-current="page"` on active items and pinned-pane tabs rendered between Work and Tools with a pin indicator dot.
  - Work-pane switcher now uses `PaneSwitcher` with toolbar semantics, arrow-key focus, Ctrl+Arrow reordering, and explicit reveal affordance when opened from pinned context.
- Views:
  - Work route now mounts `WorkView` as the canonical workspace shell, with `ModuleGrid` consuming `pane.layout_config.modules` and exposing keyboard-reachable add/remove/lens controls.
  - Table and Kanban skins remain available as dedicated view shells (`TableModuleSkin`, `KanbanModuleSkin`) for non-Work-route integrations.
  - Calendar view shell remains `CalendarModuleSkin` on the Overview calendar surface (scope toggle, month/year shells, overflow popover, focus-visible handling, empty/loading states).
- Feedback UI:
  - Bannerized warning/error surfaces in `ProjectSpacePage` with `InlineNotice`.
  - Loading skeletons and empty states introduced via shared `ModuleFeedback` helpers.
  - Toast styling updated in `src/components/ui/sonner.tsx` (error/warning/success/info class tones + text hierarchy).
- Embed polish:
  - `ViewEmbedBlock` refreshed with framed header chrome, loading skeleton, empty state, secondary metadata token use, and focus-visible action links.

### Files changed (UI shells and tokens)
- `src/pages/ProjectSpacePage.tsx`
- `src/components/project-space/PaneSwitcher.tsx`
- `src/components/project-space/ViewEmbedBlock.tsx`
- `src/components/project-space/designTokens.ts`
- `src/components/project-space/TasksTab.tsx`
- `src/components/project-space/TimelineTab.tsx`
- `src/components/project-space/CalendarTab.tsx`
- `src/components/project-space/FilterBarOverlay.tsx`
- `src/components/project-space/ModuleFeedback.tsx` (new)
- `src/components/project-space/TableModuleSkin.tsx` (new)
- `src/components/project-space/KanbanModuleSkin.tsx` (new)
- `src/components/project-space/CalendarModuleSkin.tsx` (new)
- `src/components/ui/sonner.tsx`
- `tokens.css`

### Token additions/updates
- Added:
  - `--color-text-secondary` (dark + light mode values)
  - `--color-capture-rail`
  - `--color-capture-rail-actioned`
- Updated:
  - Priority palette constants in `src/components/project-space/designTokens.ts` to:
    - high: `rgb(220 80 100)`
    - medium: `rgb(245 168 80)`
    - low: `rgb(130 190 160)`
- Added token reference comments for typography weight hierarchy (700/500/400) in `tokens.css`.

### Intentional deviations from spec
- Kanban card metadata now reads only explicit field IDs when present in view config (`priority_field_id`, `assignee_field_id`, `due_date_field_id`); if missing, metadata is omitted instead of inferred from field names.
- Pane-management controls (rename/pin/delete/membership) were preserved in a disclosure block under the switcher to avoid changing existing workflows while still applying the bespoke switcher behavior.
- Calendar week/day remain explicit stubs, matching the spec’s “coming soon” direction without changing event data contracts.

### Post-pass: Dependency + Robustness Audit

#### Dependency audit
- `@tanstack/react-table`
  - Status: used
  - Imported in: `src/components/project-space/TableModuleSkin.tsx`
  - Reachability: retained for table-skin integrations; Work route now renders `WorkView`/`ModuleGrid` as canonical pane UI
  - Action: kept
  - Why: required by live table module shell (`useReactTable`, sorting/header rendering)
- `@tanstack/react-virtual`
  - Status: used
  - Imported in: `src/components/project-space/TableModuleSkin.tsx`
  - Reachability: same table-skin integration path as above
  - Action: kept
  - Why: required for virtualized row rendering (`useVirtualizer`)
- `@dnd-kit/core`
  - Status: used
  - Imported in: `src/components/project-space/KanbanModuleSkin.tsx`
  - Reachability: retained for kanban-skin integrations; Work route canonical path is `WorkView`/`ModuleGrid`
  - Action: kept
  - Why: required for DnD context/sensors/droppable behavior
- `@dnd-kit/sortable`
  - Status: used
  - Imported in: `src/components/project-space/KanbanModuleSkin.tsx`
  - Reachability: same kanban-skin integration path as above
  - Action: kept
  - Why: required for sortable card behavior and keyboard coordinates

#### Kanban robustness changes
- Removed field-name guessing for metadata; card metadata now reads only explicit configured field IDs.
- Added deterministic fallback when grouping field is missing:
  - renders a single `Ungrouped` column with current records
  - shows guidance message that grouping is not configured
  - disables move/drop behavior (no silent reassignment assumptions)
- No backend/schema/auth/API contract changes were introduced.

#### Build warning findings
- Before post-pass split: single main chunk around `dist/assets/index-*.js` at ~1,068 kB (minified), triggering Vite’s 500 kB warning.
- Post-pass action: lazy-loaded `TableModuleSkin` and `KanbanModuleSkin` at `ProjectSpacePage` seam.
- After split (`npm run build -- --sourcemap`):
  - `dist/assets/TableModuleSkin-*.js` ~68.9 kB
  - `dist/assets/KanbanModuleSkin-*.js` ~50.5 kB
  - main `dist/assets/index-*.js` reduced to ~951.5 kB but still above warning threshold
- Sourcemap attribution:
  - TanStack and dnd-kit packages moved out of the main chunk (present in dedicated lazy chunks only).
  - Remaining large main chunk is primarily existing app/runtime dependencies (notably `react-dom`, `react-router`, `yjs/lib0`, `lexical` families).
- Further chunk reduction is deferred to a separate optimization pass to avoid broad refactors.

## Build Output / Chunk Audit (2026-03-05)

### Before (baseline from this pass)
- Build command: `npm run build -- --sourcemap`
- Output:
  - `dist/assets/index-DOI4yMW-.js` 951.88 kB (gzip 290.62 kB, map 4,207.49 kB)
  - `dist/assets/TableModuleSkin-CU8ukYzE.js` 69.26 kB
  - `dist/assets/KanbanModuleSkin-BOGRu9x8.js` 50.45 kB
- Vite warning: present (`Some chunks are larger than 500 kB`)
- Main chunk top contributors (sourcemap attribution by module):
  - `react-dom-client.production.js` ~173.2 kB
  - `lexical/Lexical.prod.mjs` ~121.4 kB
  - `yjs/dist/yjs.mjs` ~65.0 kB
  - `src/pages/ProjectSpacePage.tsx` ~44.9 kB
  - `react-router ... chunk-JZWAC4HX.mjs` ~35.4 kB

### Changes applied (low risk)
- Route lazy boundaries in `src/App.tsx`:
  - `ProjectsPage`, `ProjectSpacePage`, `LoginPage`, and `NotFoundPage` now load via `React.lazy`.
  - Added route-level `Suspense` loading state to avoid blank UI.
- Work/overview lazy boundaries in `src/pages/ProjectSpacePage.tsx`:
  - `CollaborativeLexicalEditor` now lazy-loaded behind `Suspense` with `ModuleLoadingState`.
  - `CalendarModuleSkin` now lazy-loaded behind `Suspense` in both Overview and Work surfaces.
- Import hygiene:
  - Replaced barrel import `../components/primitives` with direct `../components/primitives/InlineNotice`.

### After
- Build command: `npm run build -- --sourcemap`
- Output:
  - `dist/assets/index-DwhpF5fB.js` 480.56 kB (gzip 148.21 kB, map 2,413.77 kB)
  - `dist/assets/ProjectSpacePage-JIWZgfNY.js` 67.55 kB
  - `dist/assets/CollaborativeLexicalEditor-FynXAmpl.js` 393.48 kB
  - `dist/assets/CalendarModuleSkin-B9PgQbGK.js` 6.88 kB
  - `dist/assets/TableModuleSkin-C7crxCY2.js` 69.31 kB
  - `dist/assets/KanbanModuleSkin-fowg19BW.js` 50.50 kB
- Vite warning: removed (main chunk now below 500 kB)
- Attribution after split:
  - Lexical/Yjs/lib0 and Prism stack moved out of main into `CollaborativeLexicalEditor-*.js`.
  - Main chunk is now primarily app shell/runtime + auth/router/radix surfaces.

### Deferred (intentional)
- `manualChunks` tuning for `react-dom` / `react-router` vendor groups:
  - deferred because warning is already resolved and this can affect cache behavior and chunk request patterns.
- Further `ProjectSpacePage` decomposition by feature module:
  - deferred because it is a broader structural refactor with higher regression risk than this pass.

## Accessibility Audit Pass (2026-03-05)

### Audit method
- Ran `npm run lint` (existing lint rules).
- Performed manual keyboard + screen-reader semantics pass on:
  - Project Space tab chrome and pane switcher.
  - Record Inspector + relation picker.
  - Table and kanban module skins.
  - Inline notices, toasts, and empty states.
  - Motion-reduction behavior on bespoke controls.

### Manual keyboard checklist
- [x] Tab to Overview/Work/Tools and pinned-pane tabs; verify arrow/Home/End tab navigation and visible focus.
- [x] Open Work pane switcher from pinned context; verify reveal toggle exposes controlled region and pane controls are keyboard-operable.
- [x] Open Record Inspector from multiple launch points; close with Escape/close button and verify focus returns to invoker.
- [x] In RelationPicker, verify combobox announces expanded state, ArrowUp/ArrowDown option movement, Enter selection, and Escape close.
- [x] In Table module, verify rows/actions are focusable, ArrowUp/ArrowDown/Home/End row movement works, and Enter/Space opens record.
- [x] In Kanban module, verify non-DnD move control is keyboard accessible and drag handle has explicit label.
- [x] Trigger InlineNotice/Toast/empty states and verify announcement roles and labeled dismiss controls.
- [x] With `prefers-reduced-motion`, verify pane-switcher reveal transitions do not rely on motion.

### Issues found and fixes applied
- Top Project Space tabs and Overview sub-tabs lacked complete roving-tab keyboard behavior and tabpanel wiring.
  - Added roving arrow/Home/End navigation with focus movement.
  - Added `id`/`aria-controls`/`aria-labelledby` wiring and `tabIndex` management for tab semantics.
- Pane switcher needed stronger keyboard discoverability and reduced-motion compliance in reveal behavior.
  - Added shortcut guidance text, Home/End key support, and `motion-reduce` delay fallback.
  - Added `aria-expanded`/`aria-controls` reveal-state wiring from the hide/show affordance.
- Record Inspector open/close did not consistently restore focus to the invoking control.
  - Added explicit invoker capture on open and focus restoration on close.
- `RelationPicker` search input was not exposed as a combobox with active option semantics.
  - Added combobox/listbox linkage (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`).
  - Added keyboard option navigation (ArrowUp/ArrowDown), Enter selection, and Escape close.
- Table virtualized rows lacked explicit keyboard row traversal shortcuts.
  - Added row keyboard navigation (ArrowUp/ArrowDown/Home/End) with virtualized scroll-to-row focus.
  - Preserved visible focus states and row/action keyboard open behavior.
- Kanban card drag interactions were bound to the card button and lacked an explicit drag handle label.
  - Split card open action from drag action by adding a dedicated, labeled drag handle.
  - Kept keyboard-accessible non-DnD fallback via existing “Move” select control.
  - Added list/listitem semantics to columns/cards.
- Feedback semantics were inconsistent for assistive announcements.
  - `InlineNotice` now uses `role="alert"` for warning/danger and `role="status"` for info/success with live-region attributes.
  - Toaster now enables close buttons, limits concurrent toasts (`visibleToasts=3`), and keeps focus-visible close control styling.
  - Empty states now render semantic headings in `ModuleEmptyState`.

### Remaining known gaps
- No automated `axe` integration was added in this pass; validation remains lint + manual keyboard/semantic checks.
- Global chunk-size warning during build remains unchanged from prior state and is unrelated to accessibility scope.
