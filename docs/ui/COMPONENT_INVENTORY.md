# Component Inventory - Project Space Wireframe

This inventory covers the wireframe implementation for Project Space v1 contract routes and UI shells.

## Token Reference
- Color tokens: `surface`, `elevated`, `text`, `primary`, `accent`, `on-primary`, `muted`, `subtle`, `warning-subtle`, `danger`, `danger-subtle`, `border-subtle`, `overlay`
- Radius tokens: `panel`, `control`
- Shadow tokens: `soft`, `wireframe`
- Typography tokens: `font-sans`, `font-serif`, `font-logo`, `heading-1..4`
- Spacing tokens: `2xs`, `xs`, `sm`, `md`, `lg`, `xl`

## Navigation and Shell Components

| Component | Purpose | Props / Inputs | Variants | States | Accessibility Notes | Token Dependencies | Library Fit | Design Ownership |
|---|---|---|---|---|---|---|---|---|
| `TopNavTabs` | Project-level navigation shell with exactly Overview / Work / Tools tabs. Composes: `Card`, `TabsList`, `TabButton`, `Button`. | `activeTab`, `onNavigateTab`, `pinnedPanes`, `activePaneId`, `openedFromPinnedTab` | Top-level tab row + pinned shortcuts row | default, hover, focus-visible, selected | `role=tablist`, `role=tab`, roving focus via Radix Tabs, `aria-selected`, `aria-controls` | `bg-elevated`, `bg-surface`, `bg-accent`, `text-primary`, `text-on-primary`, `border-subtle` | Backed by shadcn/Radix Tabs; pinned shortcut row remains bespoke | Library (shadcn) |
| `PinnedPaneShortcutButton` | Quick open pinned pane in top nav | `paneId`, `title`, `onOpen`, `selected` | selected, unselected | default, hover, focus, selected | `aria-label` includes pane title | `bg-surface`, `bg-accent`, `text-primary`, `text-on-primary`, `border-subtle` | Bespoke (shortcut behavior + query intent) | Bespoke |
| `PinnedPaneUnpinButton` | Remove pinned pane shortcut | `paneId`, `onUnpin` | compact text button | default, hover, focus | Screen-reader label per pane | `border-subtle`, `text-muted`, `bg-surface` | Bespoke | Bespoke |

## Overview Components

| Component | Purpose | Props / Inputs | Variants | States | Accessibility Notes | Token Dependencies | Library Fit | Design Ownership |
|---|---|---|---|---|---|---|---|---|
| `ProjectHeader` | Overview-only project identity and membership block | `projectName`, `projectSummary`, `collaborators`, `clients` | with/without clients, dense/expanded list | default | Semantic headings and grouped lists (`ul/li`) | `bg-elevated`, `bg-surface`, `text-primary`, `text-text`, `text-muted`, `border-subtle` | Bespoke | Bespoke |
| `CollaboratorChip` | Shows collaborator and role | `name`, `role` | role tone (owner/editor/viewer) | default, focusable if interactive in future | Currently static text chip | `bg-surface`, `border-subtle`, `text-text` | Could map to library Badge | Bespoke |
| `ClientReferenceRow` | Shows client reference for automations | `name`, `contact` | compact row | default | Static content | `bg-surface`, `text-primary`, `text-muted`, `border-subtle` | Bespoke | Bespoke |
| `SubViewSwitcher` | Switches Overview sub-views (Timeline/Calendar/Tasks only). Composes: `TabsList`, `TabButton`. | `activeView`, `onSelectView` | 3 fixed tabs | default, hover, focus-visible, selected | `role=tablist`, `role=tab`, roving focus via Radix Tabs, `aria-selected`, `aria-controls` | `bg-surface`, `bg-accent`, `text-primary`, `text-on-primary`, `border-subtle` | Backed by shadcn/Radix Tabs | Library (shadcn) |
| `TimelineShell` | Project-wide timeline placeholder | timeline item list | empty/non-empty | default, empty | Semantic list | `bg-surface`, `text-text`, `text-primary`, `text-muted`, `border-subtle` | Bespoke | Bespoke |
| `TimelineItemRow` | Individual timeline event row | `date`, `actor`, `text` | with/without object link | default, hover (future) | Keep readable date + actor text order | `bg-surface`, `text-primary`, `text-text`, `text-muted`, `border-subtle` | Could map to list item primitive | Bespoke |
| `CalendarShell` | Project calendar placeholder shell | date cells, weekday labels | monthly grid shell | default, empty | Landmarks + descriptive heading text | `bg-surface`, `text-muted`, `border-subtle` | Bespoke | Bespoke |
| `CalendarToolbar` | Calendar control strip (period + nav placeholders) | `monthLabel`, nav actions | month/week/day (future) | default, loading (future) | Buttons keyboard-operable with explicit labels | `bg-surface`, `bg-elevated`, `text-primary`, `text-muted`, `border-subtle` | Could map to toolbar primitive | Bespoke |
| `CalendarFilterBar` | Filter controls for calendar by user/category/search. Composes: `FilterBar`, `FilterChip`, primitive `Select`/`SearchInput`. | `userValue`, `categoryValue`, `searchValue`, handlers, options | compact / expanded | default, focus, disabled, invalid (future), empty | Labeled controls with form semantics | `bg-surface`, `text-text`, `text-muted`, `border-subtle` | Backed by shadcn/Radix Select through primitive wrapper | Library (shadcn) |
| `CalendarGrid` | Grid container for day cells | `days[]` | 7-column grid | default | Must stay readable on mobile (wrap/scroll as needed) | `border-subtle`, `bg-surface` | Bespoke | Bespoke |
| `DayCell` | Placeholder day tile | `dayIndex`, optional events | empty/with event chips | default | Semantic text and clear event labels | `bg-surface`, `text-muted`, `border-subtle` | Could map to Card | Bespoke |
| `EventChip` | Event placeholder within day cell | `label` | info/warning (future) | default | Keep short readable label | `bg-warning-subtle`, `text-text`, `border-subtle` | Badge/Chip library candidate | Bespoke |
| `TaskShell` | Project tasks placeholder shell | task rows | empty/non-empty | default, empty | Group heading + list semantics | `bg-surface`, `text-muted`, `border-subtle` | Bespoke | Bespoke |
| `TaskListToolbar` | Filter controls for tasks by user/category/search. Composes: `FilterBar`, `FilterChip`, primitive `Select`/`SearchInput`. | `userValue`, `categoryValue`, `searchValue`, handlers, options | compact / expanded | default, focus, disabled, invalid (future), empty | Labeled controls with form semantics | `bg-surface`, `text-text`, `text-muted`, `border-subtle` | Backed by shadcn/Radix Select through primitive wrapper | Library (shadcn) |
| `TaskRow` | Task item placeholder | `title`, `assignee`, `status` | status variants (todo/in-progress/done) | default, selected (future) | readable label before status pill | `bg-surface`, `text-text`, `text-muted`, `border-subtle` | Could map to Table row | Bespoke |
| `StatusPill` | Task status visual marker | `status` | todo/in-progress/done | default | Ensure text equivalent | `bg-elevated`, `text-primary`, `border-subtle` | Badge library candidate | Bespoke |

## Work Components

| Component | Purpose | Props / Inputs | Variants | States | Accessibility Notes | Token Dependencies | Library Fit | Design Ownership |
|---|---|---|---|---|---|---|---|---|
| `WorkView` | Work route shell for selected pane | `panes`, `activePaneId`, `collaborators`, callbacks | normal, pinned-entry mode | loading, missing-pane, default | `role=tabpanel`; action buttons are keyboard-operable | `bg-elevated`, `text-primary`, `text-muted`, `border-subtle` | Bespoke | Bespoke |
| `PaneSwitcher` | Route-level pane selector list | `panes`, `activePaneId`, `onSelectPane` | visible / hidden-by-default (pinned entry) | default, hidden, empty | When hidden from pinned entry, reveal button provided; active pane has `aria-current` | `bg-elevated`, `bg-surface`, `text-primary`, `text-muted`, `border-subtle` | Could partially map to Tabs/Listbox | Bespoke |
| `PaneSwitcherRevealButton` | Explicitly reveal hidden switcher. Composes: `InlineNotice` + `Button`. | `onReveal` | inline action | default, focus | Clear explain text for hidden state | `bg-surface`, `text-primary`, `border-subtle` | Bespoke | Bespoke |
| `PaneListRow` | Single pane entry in switcher | `title`, `selected`, reorder handlers | selected/unselected | default, selected, disabled reorder buttons | Reorder controls have explicit labels | `bg-surface`, `bg-accent`, `text-primary`, `text-on-primary`, `border-subtle` | Bespoke | Bespoke |
| `PaneHeaderControls` | Pane metadata controls | `title`, `audience`, `members`, pin state | inline editor + audience selector + members | default, disabled (future), validation (future) | Labels bound to inputs/select; grouped via fieldset where needed | `bg-elevated`, `bg-surface`, `text-text`, `text-muted`, `text-primary`, `border-subtle` | Bespoke | Bespoke |
| `PaneRenameInput` | Rename pane | `value`, `onChange`, `onSave` | inline text control | default, focus, invalid (future) | `<label for>` wiring | `bg-surface`, `text-text`, `border-subtle` | Standard input component | Bespoke |
| `PaneAudienceSelector` | Selects `project`, `personal`, `custom-subset` | `value`, `onChange` | three contract-fixed modes | default, focus, disabled (future) | Primitive Select with explicit label wiring | `bg-surface`, `text-text`, `border-subtle` | Backed by shadcn/Radix Select | Library (shadcn) |
| `PaneAudiencePill` | Readable mode badge text | `audienceMode` | project/personal/custom-subset | default | Non-interactive text indicator | `text-muted`, `text-primary` | Badge candidate | Bespoke |
| `CustomSubsetChecklist` | Select subset members for custom audience | `collaborators`, `selectedIds`, `onToggle` | checklist | default, empty | `fieldset` + `legend`; checkbox labels | `bg-surface`, `text-text`, `text-muted`, `border-subtle` | Backed by shadcn/Radix Checkbox + bespoke `CheckboxGroup` composition | Library (shadcn) |
| `PaneRegionToggleGroup` | Enables modules-only or workspace-only pane modes | `modulesEnabled`, `workspaceEnabled`, `onSetPaneRegions` | both on, modules-only, workspace-only | default, focus, disabled-option | Checkboxes grouped in `fieldset`; at least one region stays enabled | `bg-surface`, `text-text`, `text-muted`, `border-subtle` | Bespoke (contract guard logic) | Bespoke |
| `PaneTabPinButton` | Pin/unpin active pane. Composes: `ToggleButton`. | `isPinned`, `onToggle` | pin/unpin labels | default, hover, focus, active | `aria-pressed` indicates state | `bg-surface`, `bg-accent`, `text-primary`, `text-on-primary`, `border-subtle` | Toggle button primitive | Bespoke |
| `FocusModeToggleButton` | Enables/disables focus mode. Composes: `ToggleButton`. | `focusMode`, `onToggle` | enter/exit labels | default, active | `aria-pressed` for toggle state | `bg-surface`, `bg-accent`, `text-primary`, `text-on-primary`, `border-subtle` | Toggle button primitive | Bespoke |
| `OrganizationAreaShell` | Top pane region for module layout | `modulesEnabled`, `modules`, add handlers | enabled/disabled | default, empty, full (max 6) | Region heading and explanatory text | `bg-elevated`, `bg-surface`, `text-primary`, `text-muted`, `border-subtle` | Bespoke | Bespoke |
| `ModuleGrid` | 12-column module layout container | `modules` | responsive 12-col grid | default, empty | Structural list semantics | `border-subtle` | Bespoke layout primitive | Bespoke |
| `ModuleCard` | Module instance tile | `label`, `size`, `lens`, remove action | size tiers `S/M/L`, lens `project/pane_scratch` | default, focus, removable | Remove action has explicit `aria-label` | `bg-surface`, `text-primary`, `text-muted`, `border-subtle` | Card + badge primitives | Bespoke |
| `ModuleLensControl` | First-class lens switch (Project vs Scratch) for each module. Composes: primitive `Select` inside module card shell. | `lens`, `moduleLabel`, `onChange` | `project`, `pane_scratch` | default, focus, disabled (future), invalid (future) | Select has explicit `aria-label` including module name | `bg-elevated`, `text-text`, `text-muted`, `border-subtle` | Backed by shadcn/Radix Select | Library (shadcn) |
| `AddModuleButton` | Opens module picker dialog | `onOpen`, `disabled` | enabled/disabled | default, disabled | Clear disabled state when max reached | `bg-surface`, `text-primary`, `border-subtle` | Standard button | Bespoke |
| `ModulePickerDialog` | Adds module instance to pane | `open`, `templates`, `onAdd`, `onClose` | template list | default, focus-trapped, closing | Uses Radix Dialog semantics with Esc close + focus return | `bg-elevated`, `bg-surface`, `text-primary`, `text-muted`, `border-subtle`, `overlay` | Backed by shadcn/Radix Dialog | Library (shadcn) |
| `ModulePickerRow` | Module template line item in picker | `template`, add action | per module type | default, disabled add | Add action has clear label | `bg-surface`, `text-primary`, `text-muted`, `border-subtle` | List row primitive | Bespoke |
| `FocusModeToolbar` | Collapsed module icon tools | `modules`, `onOpenModule` | up to 6 icons | default, empty | Buttons include full `aria-label` despite compact icon text | `bg-elevated`, `bg-surface`, `text-primary`, `border-subtle` | Bespoke | Bespoke |
| `FocusModeModuleIconButton` | Iconized module action in toolbar | `module`, `onOpen` | module-specific initials | default, hover, focus | `aria-label` must announce module name | `bg-surface`, `text-primary`, `border-subtle` | Could map to IconButton | Bespoke |
| `ModuleDialog` | Focus-mode module overlay | `open`, `module`, `onClose` | per module type | default, focus-trapped, closing | Dialog semantics and Esc close behavior via Radix Dialog | `bg-elevated`, `bg-surface`, `text-primary`, `text-muted`, `border-subtle`, `overlay` | Backed by shadcn/Radix Dialog | Library (shadcn) |
| `WorkspaceSurfacePlaceholder` | Bottom pane region placeholder for future Lexical/Yjs | `workspaceEnabled`, `docBindingMode` | enabled/disabled region | default, disabled region | Marked as placeholder; retains clear boundary text | `bg-elevated`, `bg-surface`, `text-text`, `text-muted`, `border-subtle` | Bespoke | Bespoke |

## Tools Components

| Component | Purpose | Props / Inputs | Variants | States | Accessibility Notes | Token Dependencies | Library Fit | Design Ownership |
|---|---|---|---|---|---|---|---|---|
| `ToolsSectionShell` | Wraps each tools section | `title`, `description`, children | Live Tools / Automation Builder | default | Section heading hierarchy | `bg-elevated`, `text-primary`, `text-muted`, `border-subtle` | Bespoke section wrapper | Bespoke |
| `LiveToolRow` | Live tool invocation row | `name`, `status`, run action | status variants | default, running (future), disabled (future), error (future) | Run button keyboard operable | `bg-surface`, `text-primary`, `text-muted`, `border-subtle` | Could map to Data row | Bespoke |
| `AutomationBuilderShell` | Placeholder shell for builder flow | placeholder slots | empty/with draft | default | Clear placeholder guidance for next implementation | `bg-surface`, `text-text`, `text-muted`, `border-subtle` | Bespoke | Bespoke |
| `PrimaryActionButton` | Base action button style used in wireframe | button text + handler | primary/neutral/danger (future) | default, hover, focus, disabled, active | Buttons must have explicit labels | `bg-accent`, `text-on-primary`, `border-subtle` | Library button primitive | Library (shadcn) |
| `SecondaryActionButton` | Neutral wireframe button | text + handler | compact/regular | default, hover, focus, disabled | Keep contrast with background | `bg-surface`, `text-primary`, `border-subtle` | Library button primitive | Library (shadcn) |

## Shared Utility Components

| Component | Purpose | Props / Inputs | Variants | States | Accessibility Notes | Token Dependencies | Library Fit | Design Ownership |
|---|---|---|---|---|---|---|---|---|
| `AccessibleDialog` (current wrapper) | Reusable accessible dialog primitive | `open`, `title`, `description`, `onClose`, `triggerRef` | standard / hidden-header | open, close, focus trap active | Escape closes, Radix focus trap and trigger focus restoration | `bg-elevated`, `border-subtle`, `overlay`, `text-primary`, `text-muted` | Backed by shadcn/Radix Dialog | Library (shadcn) |
| `HeadingUtility` (`heading-1..4`) | Semantic heading typography utilities | heading level class | 1-4 | default | Preserve heading order per route | typography tokens | Keep bespoke utility classes | Bespoke |
| `TokenAliasClasses` | Semantic wireframe classes (`bg-elevated`, `border-subtle`, `bg-accent`) | class usage only | n/a | n/a | Supports future palette swaps without component rewrites | token aliases in `tokens.css` | Keep bespoke token layer | Bespoke |
| `FilterBar` | Shared layout for calendar/task filter controls. Composes: `Card` (surface), primitive Select controls, optional `FilterChip`. | `title`, `children` | compact/wide | default, empty | Landmark label for assistive tech | `bg-surface`, `text-muted`, `border-subtle` | Hybrid: bespoke layout + shadcn/Radix Select | Hybrid |

## Interactive Primitive Taxonomy (Strict)

### Buttons
| Primitive | Purpose | Variants | Sizes | Required States | Accessibility Notes | Token Dependencies |
|---|---|---|---|---|---|---|
| `Button` | Base command/action primitive | `primary`, `secondary`, `ghost`, `danger` | `sm`, `md`, `lg` | `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading` | Explicit `type`; disabled/loading announce correctly through native semantics | `bg-accent`, `bg-surface`, `bg-danger`, `text-on-primary`, `text-primary`, `border-subtle`, `color-focus-ring` |
| `IconButton` | Square icon-only action primitive | `ghost`, `secondary`, `danger` | `sm`, `md`, `lg` | `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading` | Requires non-empty `aria-label` (dev guard logs on missing label) | `bg-surface`, `bg-danger`, `text-primary`, `text-on-primary`, `border-subtle` |
| `ToggleButton` | Toggle action primitive with pressed state | `primary`, `secondary`, `ghost` | `sm`, `md`, `lg` | `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading` | Uses `aria-pressed`; supports controlled state via `pressed` + `onPressedChange` | `bg-accent`, `bg-surface`, `text-on-primary`, `text-primary`, `border-subtle` |
| `LinkButton` | Semantic anchor styled as action | n/a (link style) | `sm`, `md` (class-level) | `default`, `hover`, `focus-visible`, `active`, `disabled` (`aria-disabled`) | Native `<a>` semantics; optional external indicator slot | `text-primary`, `text-primary-strong`, `color-focus-ring` |

### Structure
| Primitive | Purpose | Variants | Required States | Accessibility Notes | Token Dependencies |
|---|---|---|---|---|---|
| `TabsList` | Tablist container wrapper with roving-focus integration | `standard`, `compact` | `default`, `focus-within` | `role=tablist` and roving focus via Radix Tabs | `bg-surface`, `border-subtle` |
| `TabButton` | Individual tab button primitive | `standard`, `compact` | `default`, `hover`, `focus-visible`, `selected`, `disabled` | `role=tab`, `aria-selected`, Radix-managed keyboard semantics | `bg-surface`, `bg-accent`, `text-primary`, `text-on-primary`, `border-subtle` |
| `Card` | Surface container primitive | `surface`, `elevated` | `default` | Semantic wrapper (`section`/`article`/`header`/`div`) | `bg-surface`, `bg-elevated`, `border-subtle`, `shadow-soft` |
| `SectionHeader` | Standardized section title + actions row | n/a | `default` | Heading hierarchy remains explicit | `text-primary`, `text-muted` |
| `Divider` | Visual separator | `horizontal`, `vertical` | `default` | Horizontal uses `<hr>`; vertical uses `role=separator` | `border-subtle`, `color-border-subtle` |

### Messaging and Feedback
| Primitive | Purpose | Variants | Required States | Accessibility Notes | Token Dependencies |
|---|---|---|---|---|---|
| `InlineNotice` | Inline banner/message block | `info`, `warning`, `danger`, `success` | `default`, `focus-visible`, `dismissed` | Uses `role=note` for info/warning/success and `role=alert` for danger; optional action and dismiss slot | `bg-elevated`, `bg-warning-subtle`, `bg-danger-subtle`, `bg-success-subtle`, `text-text`, `text-danger`, `border-subtle` |
| `Chip` | Compact static label/value marker | `neutral`, `selected`, `dismissible` | `default`, `focus-visible`, `disabled` | Non-interactive label by default | `bg-surface`, `bg-accent`, `text-text`, `text-on-primary`, `border-subtle` |
| `FilterChip` | Interactive chip for active filters | `neutral`, `selected`, `dismissible` | `default`, `hover`, `focus-visible`, `active`, `disabled` | Button semantics with optional dismiss action | `bg-surface`, `bg-accent`, `text-primary`, `text-on-primary`, `border-subtle` |

### Form and Overlay Primitives (Current)
| Primitive | Purpose | Variants | Required States | Accessibility Notes | Token Dependencies |
|---|---|---|---|---|---|
| `Input` | Text input fields | `text`, `search` | `default`, `focus`, `invalid`, `disabled`, `help`, `error` | Always paired with label/help/error ids | `bg-surface`, `text-text`, `text-muted`, `border-subtle`, `color-focus-ring` |
| `Select` | Controlled option selection | `single-select` | `default`, `focus`, `invalid`, `disabled`, `help`, `error` | Label + `id`; robust keyboard/screen-reader semantics via Radix Select | `bg-surface`, `text-text`, `border-subtle` |
| `Checkbox` | Binary toggle | `default` | `default`, `focus`, `disabled`, `error` | Label click target required; state managed by Radix Checkbox | `text-primary`, `border-subtle` |
| `CheckboxGroup` | Related boolean settings | `vertical`, `horizontal` | `default`, `focus-within`, `invalid`, `disabled`, `help`, `error` | Use `fieldset` + `legend` | `bg-surface`, `text-text`, `text-muted`, `border-subtle` |
| `Dialog` (`AccessibleDialog`) | Blocking contextual surface | `standard`, `module`, `picker` | `closed`, `opening`, `open`, `submitting`, `error` | `role=dialog`, `aria-modal`, Esc close, focus trap, trigger focus restore via Radix Dialog | `bg-elevated`, `border-subtle`, `overlay`, `text-primary`, `text-muted` |
| `AlertDialog` | Confirm/cancel modal flow for destructive or irreversible actions | `default`, `destructive` | `closed`, `open`, `confirming` | `role=alertdialog`, focus trap, Esc close, focus return via Radix AlertDialog | `bg-elevated`, `border-subtle`, `overlay`, `text-primary`, `text-muted` |
| `Popover` | Non-blocking anchored details | `top`, `bottom`, `left`, `right` | `closed`, `open`, `disabled` | Dismissible, keyboard reachable via Radix Popover | `bg-elevated`, `border-subtle`, `shadow-soft` |
| `Menu` (`DropdownMenu`, `ContextMenu`) | Action list from trigger | `context`, `dropdown` | `closed`, `open`, `active-item`, `disabled-item` | Arrow-key roving focus and menu semantics via Radix Menu primitives | `bg-elevated`, `border-subtle`, `text-text`, `text-muted` |
| `Tooltip` | Supplemental hint text | `default`, `rich` | `hidden`, `visible` | Trigger remains focusable; content rendered via Radix Tooltip | `bg-elevated`, `text-text`, `border-subtle` |
| `Toast` | Non-blocking transient status | `info`, `success`, `warning`, `danger` | `queued`, `visible`, `dismissed` | `aria-live` handling via sonner | `bg-surface`, `bg-warning-subtle`, `bg-danger-subtle`, `text-text`, `text-danger` |
| `CommandPalette` | Global quick actions / search list | `default` | `closed`, `open`, `filtered`, `empty` | Cmdk listbox semantics in Radix-backed dialog shell | `bg-elevated`, `text-text`, `border-subtle` |
| `EmptyState` | No-data guidance block | `neutral`, `actionable` | `default`, `loading`, `error` | Includes clear next-step affordance | `bg-surface`, `text-muted`, `border-subtle` |
| `SkeletonLoader` (planned) | Loading placeholder structure | `line`, `card`, `table-row` | `loading`, `hidden` | Use with `aria-busy` on parent region | `bg-subtle`, `border-subtle` |

## Notes for Library Sourcing
- Adopted foundation: Tabs, Dialog, AlertDialog, Select, Checkbox, Popover, Tooltip, DropdownMenu, ContextMenu, Toast, CommandPalette.
- Hybrid adoption: ToggleButton/ToggleGroup (Radix internals + bespoke tokenized layout API), FilterBar layout + primitive Select controls.
- Keep bespoke: pane model UI, pinned-pane shortcuts, focus-mode toolbar behavior, module grid sizing logic, route-aware pane switcher visibility behavior.
