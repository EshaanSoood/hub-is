# Widget Height Chain Audit

## 1. Page → Work View → Widget Grid (height chain)

### `src/pages/ProjectSpacePage.tsx`
- Height chain role: this page does **not** create a viewport-bound layout container for Work view content.
- Explicit height/min/max: none for the Work page containers (`<div className="space-y-4">`, `<section className="space-y-4">`).
- Flex grow/shrink: no `flex-1`, `grow`, `shrink`, or split-project height contract between widgets and editor.
- Overflow: no page-level `overflow-y-auto` / `overflow-hidden` around the work content chain. The only `h-screen overflow-y-auto` in this file is the inspector dialog panel, not the widget area.
- Grid row sizing: none at page level.
- Tailwind height classes: no `h-full` / `h-screen` in the widget chain (again, except inspector dialog).
- JS height calculation: none (`calc(100vh - ...)` style logic is absent for work/widget layout).
- Result: `WorkView` and the workspace doc render in normal document flow as stacked blocks; height is content-driven.

### `src/components/project-space/WorkView.tsx`
- Height chain role: orchestrates widget controls + `WidgetGrid`; does not allocate fixed space between widget grid and editor.
- Explicit height/min/max: none on root (`<section className="space-y-4">`) or widget region.
- Flex grow/shrink: none for main sections.
- Overflow: none on root/widget region.
- Grid row sizing: delegated to `WidgetGrid`.
- Tailwind height classes: no `h-full` / `h-screen` in this file.
- JS height calculation: none.
- Allocation behavior (widget grid vs editor): this component does not perform a split layout. Widgets are rendered in-flow, and in the current page integration the workspace doc is rendered outside `WorkView` as a following sibling.

### `src/components/project-space/WidgetGrid.tsx`
- Height chain role: defines widget card grid width placement.
- Explicit height/min/max: none on grid container or widget cards.
- Flex grow/shrink: none on grid container/cards.
- Overflow: none on card container (`article`) or body wrapper (`<div className="mt-3">`).
- CSS grid:
- Uses `grid grid-cols-1 md:grid-cols-12` with default implicit row sizing (`auto`).
- No `grid-auto-rows`, no fixed row tracks, no row-span mapping.
- Size tiers map only to column span via `sizeClass`:
- `S -> md:col-span-3`
- `M -> md:col-span-6`
- `L -> md:col-span-12`
- Tailwind height classes: none.
- JS height calculation: none.
- Result: each card’s height is entirely intrinsic to widget content.

### `src/components/project-space/WidgetFeedback.tsx`
- Height chain role: loading/empty wrappers used by widgets.
- Explicit height/min/max:
- `WidgetLoadingState` rows use fixed bar height (`h-3`) but container has no explicit overall height.
- `WidgetEmptyState` also has no explicit fixed height.
- Flex grow/shrink: none.
- Overflow: none on wrappers.
- Grid sizing / `h-full` / JS height calc: none.

## 2. Size Tier Mapping

### Where tier is defined and normalized
- `WorkView.parseWidgets(...)` normalizes `size_tier` to `S | M | L` with fallback `M`.
- `WorkView.serializeWidgets(...)` persists `size_tier` back into `layout_config.widgets`.

### Core layout mapping (width)
- `WidgetGrid.sizeClass` is the primary visual mapping:
- `S = md:col-span-3`
- `M = md:col-span-6`
- `L = md:col-span-12`
- This affects width only (column span), not grid row height.

### Tier-driven behavior inside widgets (indirect height impact)
- `TasksWidgetSkin`: tier switches component variant (`Small`, `Medium`, `Large`) with different UI density/content volume.
- `FilesWidgetSkin`: tier switches variant (`Small`, `Medium`, `Large`) with different list/grid density.
- `RemindersWidgetSkin`: tier changes visible item cap (`S=3`, `M=6`, `L=unbounded`).
- `QuickThoughtsWidgetSkin`: tier changes composer visibility and entry truncation behavior (`M` slices visible entries, `L` can show archive section).
- `TableWidgetSkin`, `KanbanWidgetSkin`, `CalendarWidgetSkin`, `TimelineWidget` path: no tier prop used for height.

### Conclusion
- Tier is primarily a width contract at grid level.
- Height is not standardized by tier at container level; any height differences are widget-specific content behavior.

## 3. Widget Wrappers (per widget)

### `TableWidget` (`src/components/project-space/widgets/TableWidget.tsx`)
- Props received: `widget`, `runtime`, edit capability, `onOpenRecord`, `onSetWidgetBinding`.
- Dimension-related data: receives `widget.size_tier` but does not use/pass it.
- Wrapper container: `<div className="space-y-3">` (no fixed/flex height).
- Passes height constraints to skin: no.
- Skin outer behavior from wrapper perspective: unconstrained; skin handles its own internal scroller.

### `KanbanWidget` (`src/components/project-space/widgets/KanbanWidget.tsx`)
- Props: `widget`, `runtime`, edit capability, `onOpenRecord`, `onSetWidgetBinding`.
- Dimension-related data: `widget.size_tier` available but unused.
- Wrapper container: `<div className="space-y-3">`.
- Passes height constraints to skin: no.

### `CalendarWidget` (`src/components/project-space/widgets/CalendarWidget.tsx`)
- Props: `runtime`, `onOpenRecord`.
- Dimension-related data: no tier prop.
- Wrapper container: none besides `Suspense` wrapper.
- Passes height constraints to skin: no.

### `TasksWidget` (`src/components/project-space/widgets/TasksWidget.tsx`)
- Props: `widget`, `runtime`, edit capability.
- Dimension-related data: passes `sizeTier={widget.size_tier || 'M'}`.
- Wrapper container: none besides `Suspense`.
- Passes height constraints to skin: only semantic tier; no explicit px/min/max height.

### `FilesWidget` (`src/components/project-space/widgets/FilesWidget.tsx`)
- Props: `widget`, `runtime`, edit capability.
- Dimension-related data: passes `sizeTier={widget.size_tier}`.
- Wrapper container: none besides `Suspense`.
- Passes height constraints to skin: tier only; no explicit height contract.

### `RemindersWidget` (`src/components/project-space/widgets/RemindersWidget.tsx`)
- Props: `widget`, `runtime`.
- Dimension-related data: passes `sizeTier={widget.size_tier}`.
- Wrapper container: none besides `Suspense`.
- Passes height constraints to skin: tier only.

### `QuickThoughtsWidget` (`src/components/project-space/widgets/QuickThoughtsWidget.tsx`)
- Props: `widget`, `runtime`, `project`, edit capability.
- Dimension-related data: passes `sizeTier={widget.size_tier}`.
- Wrapper container: none besides `Suspense`.
- Passes height constraints to skin: tier only.

### `TimelineWidget` (`src/components/project-space/widgets/TimelineWidget.tsx`)
- Props: `runtime`.
- Dimension-related data: none.
- Wrapper container: none (direct `TimelineFeed`).
- Passes height constraints: no.

## 4. Widget Skins (outer container only)

### `TableWidgetSkin` (`src/components/project-space/TableWidgetSkin.tsx`)
- Outer container: `<section className="rounded-panel border border-border-muted bg-surface-elevated">`.
- Outer explicit height: none.
- Internal scroll constraint: content grid area uses `max-h-[26rem] overflow-auto`.
- Flex-grow/h-full usage: none.
- JS height calc: virtualization computes row placement and total virtual height, but no viewport-based parent height calc.

### `KanbanWidgetSkin` (`src/components/project-space/KanbanWidgetSkin.tsx`)
- Outer container: `<div className="space-y-3">`.
- Outer explicit height: none.
- Internal overflow:
- Board lane container uses horizontal scroll (`overflow-x-auto`).
- No explicit vertical max-height on board/columns.
- Flex-grow/h-full: none.

### `CalendarWidgetSkin` (`src/components/project-space/CalendarWidgetSkin.tsx`)
- Outer container: `<div className="space-y-3">`.
- Outer explicit height: none.
- Internal sizing:
- Month/day cells have intrinsic minimum heights (`min-h-24`, etc.).
- Top control strip allows horizontal overflow (`overflow-x-auto`).
- No widget-level vertical max-height/scroll container at skin root.
- JS height calc:
- no `vh`/`calc(100vh-...)` layout sizing;
- includes non-layout refs/timers; overflow popover positioning logic is not container height allocation.

### `TasksWidgetSkin` (`src/components/project-space/TasksWidgetSkin.tsx`)
- Outer behavior depends on tier:
- `S`: compact composer/readonly block, no fixed height.
- `M`: `<section ... p-4>` no fixed height.
- `L`: `<section className="space-y-3">` no fixed height.
- Overflow: no widget-root vertical scroll cap.
- Flex-grow/h-full: none.

### `RemindersWidgetSkin` (`src/components/project-space/RemindersWidgetSkin.tsx`)
- Outer container: `<section className="space-y-3">`.
- Outer explicit height: none.
- Internal overflow:
- individual reminder ribbons use `overflow-hidden` with `min-h-16`;
- no widget-root max-height/scroll.
- Flex-grow/h-full: none.

### `FilesWidgetSkin` (`src/components/project-space/FilesWidgetSkin.tsx`)
- Outer container: `<section className="space-y-2">`.
- Tier subcontainers are bordered `div`s with no fixed/min/max height contract.
- Internal overflow:
- some internal elements use `overflow-hidden/visible` for cards/thumbnails;
- no widget-root vertical max-height/scroll cap.
- Flex-grow/h-full: none.

### `QuickThoughtsWidgetSkin` (`src/components/project-space/QuickThoughtsWidgetSkin.tsx`)
- Outer container: `<div className="rounded-panel border border-border-muted bg-surface-elevated p-sm">`.
- Outer explicit height: none.
- Overflow: no widget-root scroll cap.
- Flex-grow/h-full: none.

### Tokens reviewed
- `src/components/project-space/designTokens.ts`: no height/size layout tokens for widget containers.
- `tokens.css`: includes calendar-related height token `--day-hour-height: 64px` (and `--day-ruler-width`) but no shared widget-card height token.

## 5. Identified Problems

- Problem 1: No viewport-to-widget height contract.
- The chain from page (`ProjectSpacePage`) through `WorkView` to `WidgetGrid` uses normal flow blocks with no explicit container height or flex growth model. Widgets expand by content, so there is no guaranteed bounded content region per widget.

- Problem 2: Grid rows are `auto` and tier does not define height.
- `WidgetGrid` only maps S/M/L to column span. Row height is auto-content. This means card height consistency is not enforced and widgets can become arbitrarily tall.

- Problem 3: Inconsistent scrolling strategy across skins.
- `TableWidgetSkin` has an internal `max-h-[26rem] overflow-auto`, while most other skins have no equivalent vertical cap. Result: mixed behavior where some widgets scroll internally and others push page height.

- Problem 4: Potential clipping points exist only in local sub-elements, not in widget roots.
- Some inner elements use `overflow-hidden` (e.g., reminder ribbons, thumbnail regions), but widget roots do not provide a controlled scroll container. If inner content grows unexpectedly, clipping can occur locally while overall widget still expands.

- Problem 5: Future fragility if `h-full`/percentage heights are introduced.
- Current code mostly avoids `h-full`, so zero-height collapse is limited today. But because ancestors are not height-defined, any future child that relies on percentage/fill height would be prone to collapse.

## 6. Recommended Fix Approach

1. Define a single height contract at the Work surface.
- Make the Work area a bounded container (viewport-anchored via app shell) and allocate widget/doc regions via flex or grid (`min-h-0` on scroll parents).

2. Decide one scrolling model and apply it consistently.
- Option A: page-level scrolling only (remove internal caps like table max height).
- Option B: card-level scrolling (add consistent card body max-height + `overflow-y-auto` across skins).
- Avoid mixed strategy.

3. Add explicit widget card structure for stable internals.
- Use card shell pattern: header `shrink-0` + body `min-h-0 flex-1 overflow-y-auto`.
- This prevents uncontrolled growth and enables predictable content regions.

4. Expand tier mapping to include height behavior.
- Keep width spans, but optionally add per-tier height presets (or max-height presets) so S/M/L communicates both footprint and expected density.

5. Introduce shared tokens for widget heights.
- Add tokens like `--widget-card-max-h-s|m|l` (and optional min-height) and consume them in widget skins instead of one-off values.

6. Guard against future `%/h-full` collapse.
- Wherever fill-height behavior is needed, ensure every ancestor in that branch has a concrete height or flex-bounded context with `min-h-0`.
