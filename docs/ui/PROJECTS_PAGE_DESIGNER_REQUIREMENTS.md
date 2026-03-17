# Projects Page Designer Requirements

Source inputs:
- Visual handoff: `docs/ui/implementaion notes and code samples.js`
- Canonical contract: `docs/## Project Space UI Contracts — v1 (Code.md`

This document converts the visual handoff into contract-first implementation requirements aligned to the v1 Project Space contract.

## 1) Top Pinned Panes Tab Strip (Sticky Anchors)

### A) Purpose
Provide per-user pinned pane shortcuts in top navigation that resolve to `/projects/:projectId/work/:paneId` and hide pane switcher by default when opened via pin.

### B) Contract props
```ts
interface PinnedPanesTabsProps {
  panes: Array<{ id: string; title: string }>;
  activePaneId: string | null;
  openedFromPinnedTab: boolean;
  onOpenPinnedPane: (paneId: string) => void;
  onUnpinPane: (paneId: string) => void;
}
```

### C) States & variants
- States: default, hover, focus-visible, selected, disabled, overflow-scroll.
- Variants: with pins, empty state.

### D) Accessibility invariants
- Pinned actions are keyboard reachable.
- Active pinned pane uses `aria-current="page"` when opened from pin context.
- Unpin controls have explicit labels.

### E) Token mapping
- Container: `bg-elevated`, `border-subtle`, `rounded-panel`.
- Active button: `bg-accent`, `text-on-primary`.
- Inactive button: `bg-surface`, `text-primary`.

### F) Library engine dependency
- Yes: uses button primitives only.
- No direct `/ui` imports.

### G) Designer deliverables needed
- Sticky edge treatment for first/last anchor tabs.
- Overflow fade treatment.

## 2) PaneSwitcher (Dot + Hover Reveal + Keyboard Pattern)

### A) Purpose
Switch panes quickly in Work, including toolbar semantics and VoiceOver-safe keyboard interactions.

### B) Contract props
```ts
interface PaneSwitcherProps {
  panes: Array<{ id: string; label: string; shortcutNumber?: number; disabled?: boolean }>;
  activePaneId: string | null;
  onPaneChange: (paneId: string) => void;
  onMovePane?: (paneId: string, direction: 'up' | 'down') => void;
}
```

### C) States & variants
- States: default dot, hover reveal, focus-visible reveal, active, disabled.
- Variants: static order, reorder-enabled (Ctrl+Arrow).

### D) Accessibility invariants
- `role="toolbar"` on root.
- Arrow Left/Right moves focus across panes.
- Ctrl+Left/Right reorders focused pane when reorder callback exists.
- Ctrl+Shift+Number quick-switches by shortcut number.

### E) Token mapping
- Dot inactive: `text-muted`.
- Dot active: `bg-accent`, `text-on-primary`.
- Reveal chip: `rounded-control`, `border-subtle`.

### F) Library engine dependency
- No Radix dependency required.
- Uses native buttons + project keyboard contract.

### G) Designer deliverables needed
- Exact hover delay timing and easing values.
- Dot-to-chip transform motion curve.

## 3) PaneHeaderControls (Rename + Pin/Focus/Config)

### A) Purpose
Single control row for pane identity and pane-level configuration (audience, region toggles, pinning, focus mode).

### B) Contract props
```ts
interface PaneHeaderControlsProps {
  paneName: string;
  onRename: (name: string) => void;
  isPinned: boolean;
  onPinToggle: () => void;
  isFocusMode: boolean;
  onFocusToggle: () => void;
  audience: 'project' | 'personal' | 'custom';
  audienceOptions: Array<{ id: 'project' | 'personal' | 'custom'; label: string }>;
  onAudienceChange: (audience: 'project' | 'personal' | 'custom') => void;
  regions: Array<{ id: 'modules' | 'workspace'; label: string; enabled: boolean; disabled?: boolean }>;
  onRegionToggle: (regionId: 'modules' | 'workspace', nextEnabled: boolean) => void;
  disabled?: boolean;
}
```

### C) States & variants
- States: default, hover, focus-visible, active (pin/focus/config), disabled.
- Variants: read/write, locked.

### D) Accessibility invariants
- Rename input has explicit label.
- Toggle controls expose `aria-pressed`.
- Config panel supports Escape/outside close via popover primitive.

### E) Token mapping
- Surface: `bg-elevated`, `border-subtle`.
- Input: `bg-surface`, `rounded-control`.
- Active icon buttons: `border-primary`, `bg-primary/10`.

### F) Library engine dependency
- Yes: Popover primitive wrapper for config panel.

### G) Designer deliverables needed
- Icon set (pin/focus/tune) final strokes.
- Spacing rhythm between rename and right controls.

## 4) ModuleGrid System (S/M/L + Ghost + Max + Add)

### A) Purpose
Render pane Organization Area as deterministic 12-column module grid with per-instance module controls.

### B) Contract props
```ts
interface ModuleGridProps {
  modules: PaneModule[];
  maxModules: number; // v1 hard limit: 6
  onAddModule: () => void;
  onDeleteModule: (moduleId: string) => void;
  onSetModuleLens: (moduleId: string, nextLens: 'project' | 'pane_scratch') => void;
  renderModuleBody?: (module: PaneModule) => React.ReactNode;
}
```

### C) States & variants
- States: default, hover (card), focus-visible, delete-confirm open, max-reached, empty.
- Variants: S/M/L card sizing.

### D) Accessibility invariants
- Grid remains keyboard navigable by button controls.
- Delete uses alert-dialog semantics.
- Ghost placeholders are `aria-hidden`.

### E) Token mapping
- Cards: `bg-elevated`, `border-subtle`, `rounded-panel`.
- Add tile: dashed border, primary hover.
- Module accents: non-priority contextual colors.

### F) Library engine dependency
- Yes: alert-dialog primitive wrapper and lens selector primitive.

### G) Designer deliverables needed
- Final S/M/L placement rules and minimum heights.
- Module accent mapping per module type.

## 5) FocusModeToolbar (Floating Toolbar + Module Dialog)

### A) Purpose
Collapse modules into top floating shortcut bar where clicking module opens dialog over workspace.

### B) Contract props
```ts
interface FocusModeToolbarProps {
  visible: boolean;
  modules: PaneModule[];
  activeModuleId: string | null;
  onActiveModuleChange: (moduleId: string | null) => void;
  renderModuleDialogContent?: (module: PaneModule) => React.ReactNode;
}
```

### C) States & variants
- States: hidden, toolbar visible, module dialog open, module active.
- Variants: dialog content by module type.

### D) Accessibility invariants
- Toolbar exposes `role="toolbar"`.
- Dialog traps focus and closes on Escape.
- Trigger focus is restored on close.

### E) Token mapping
- Toolbar: `bg-surface`, `border-subtle`, `rounded-b-panel`.
- Active icon button: `text-primary`, `bg-elevated`.

### F) Library engine dependency
- Yes: dialog primitive wrapper.

### G) Designer deliverables needed
- Toolbar placement offsets relative to app header.
- Iconography for each module type.

## 6) OverviewHeader (Title + Date + Collaborators + Refs)

### A) Purpose
Top Overview-only project header with project title, collaborator membership, and client references.

### B) Contract props
```ts
interface OverviewHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  startDateLabel: string;
  collaborators: Collaborator[];
  refs: ClientReference[];
  onInvite: () => void;
}
```

### C) States & variants
- States: default, focus title input, refs popover open.
- Variants: refs empty/non-empty.

### D) Accessibility invariants
- Title input labeled.
- Collaborator badges expose title/label text.
- Refs popover is keyboard reachable and dismissible.

### E) Token mapping
- Header shell: `bg-elevated`, `border-subtle`.
- Avatar stack: non-priority collaborator palette.
- Refs trigger: secondary/active states.

### F) Library engine dependency
- Yes: popover primitive wrapper.

### G) Designer deliverables needed
- Avatar tone assignment and overlap spacing.
- Refs popover row spacing and empty state.

## 7) TimelineTab (Clusters + Sticky Headers)

### A) Purpose
Render project-wide timeline grouped by date cluster with sticky day headers.

### B) Contract props
```ts
interface TimelineTabProps {
  clusters: Array<{
    id: string;
    dateLabel: string;
    items: Array<{
      id: string;
      label: string;
      type: 'event' | 'task' | 'milestone';
      priority: 'high' | 'medium' | 'low';
    }>;
  }>;
}
```

### C) States & variants
- States: default, scroll, empty cluster.
- Variants: item type badges and priority accents.

### D) Accessibility invariants
- Sticky headers remain readable in scroll container.
- Timeline items are plain text plus semantic type labels.

### E) Token mapping
- Priority colors use reserved pink palette only.
- Rail and separators use `border-subtle`.

### F) Library engine dependency
- No dedicated engine primitive required.

### G) Designer deliverables needed
- Priority rail/dot contrast thresholds.
- Sticky header spacing rhythm.

## 8) CalendarTab (Lens Chips + Month Grid)

### A) Purpose
Project-wide calendar with time-view lens + collaborator lens + category lens and month grid display.

### B) Contract props
```ts
interface CalendarTabProps {
  events: CalendarEvent[];
  collaborators: Array<{ id: string; label: string }>;
  categories: Array<{ id: string; label: string }>;
  timeView: 'day' | 'week' | 'month' | 'year';
  activeUserId: string;
  activeCategoryId: string;
  onTimeViewChange: (view: 'day' | 'week' | 'month' | 'year') => void;
  onUserChange: (userId: string) => void;
  onCategoryChange: (categoryId: string) => void;
}
```

### C) States & variants
- States: default, today highlight, overflow events, filtered.
- Variants: day/week/year represented as separate future layouts.

### D) Accessibility invariants
- Lens chips are keyboard toggles with `aria-pressed`.
- Day cells expose visible day labels and event text.

### E) Token mapping
- Priority dots: reserved pink palette.
- Collaborator/category chips: explicitly non-pink palette.

### F) Library engine dependency
- No dedicated engine primitive required.

### G) Designer deliverables needed
- Dedicated week/day/year layout specs.
- Event chip truncation and overflow count behavior.

## 9) TasksTab (Cluster Modes + Subtask Inheritance)

### A) Purpose
Project-wide task list with cluster modes and inherited subtask priority visualization.

### B) Contract props
```ts
interface TasksTabProps {
  tasks: TaskItem[];
  collaborators: Array<{ id: string; label: string }>;
  categories: Array<{ id: string; label: string }>;
  activeUserId: string;
  activeCategoryId: string;
  clusterMode: 'chronological' | 'category' | 'priority';
  onUserChange: (userId: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onClusterModeChange: (mode: 'chronological' | 'category' | 'priority') => void;
}
```

### C) States & variants
- States: default, hover row, expanded subtasks, collapsed cluster.
- Variants: cluster mode and priority grouping.

### D) Accessibility invariants
- Cluster headers expose `aria-expanded`.
- Task rows remain keyboard-operable.
- Subtask inheritance is visual; data model still stores `null` for inherited priority.

### E) Token mapping
- Priority bars/chips/dots use reserved pink palette.
- Category/user chips use standard accent palette.

### F) Library engine dependency
- No dedicated engine primitive required.

### G) Designer deliverables needed
- Expand/collapse chevron motion timing.
- Nested subtask depth rhythm for future recursion.

## 10) FilterBar (Overlay Panel + Priority Chip Palette)

### A) Purpose
Compact trigger that opens overlay panel with grouped filter chips and clear-all actions.

### B) Contract props
```ts
interface FilterBarOverlayProps {
  groups: Array<{ id: string; label: string; options: Array<{ id: string; label: string }> }>;
  activeFilterIds: string[];
  onToggleFilter: (filterId: string) => void;
  onClearAll: () => void;
}
```

### C) States & variants
- States: collapsed, expanded, active-count, clear-all-visible.
- Variants: group with active chips vs empty.

### D) Accessibility invariants
- Trigger uses `aria-expanded` + `aria-controls`.
- Overlay closes via outside-click and explicit close behavior.
- Chips expose `aria-pressed`.

### E) Token mapping
- Trigger active: `border-primary`, `bg-primary/10`.
- Priority chips: reserved pink priority classes.
- Panel shell: `bg-elevated`, `border-subtle`.

### F) Library engine dependency
- No dedicated engine primitive required.

### G) Designer deliverables needed
- Overlay width/breakpoint rules.
- Priority chip tint values and contrast thresholds.
