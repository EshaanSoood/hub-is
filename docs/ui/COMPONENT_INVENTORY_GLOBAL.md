# Component Inventory (Global)

This inventory covers all current UI surfaces across routes, layout shells, feature panels, project space, and primitive boundaries.

## Primitive Layer (`src/components/primitives`)

| Component | Purpose | Props/Inputs (high level) | Variants | States | Accessibility notes | Token dependencies | Library fit | Design ownership (Library/Hybrid/Bespoke) |
|---|---|---|---|---|---|---|---|---|
| `Button` | Primary action primitive | `variant`, `size`, `loading`, children | primary/secondary/ghost/danger | default/hover/focus/disabled/loading | Native button semantics | `bg-accent`, `bg-surface`, `border-subtle`, `text-on-primary` | Bespoke tokenized button primitive | Hybrid |
| `IconButton` | Compact icon action | `aria-label`, `variant`, `size` | ghost/secondary/danger | default/hover/focus/disabled | Requires non-empty `aria-label` | `bg-surface`, `border-subtle`, `text-primary` | Bespoke | Hybrid |
| `ToggleButton` | Pressed-state action | `pressed`, `onPressedChange` | primary/secondary/ghost | default/hover/focus/active/disabled | `aria-pressed` state | `bg-surface`, `bg-accent`, `border-subtle` | Radix Toggle-backed wrapper | Hybrid |
| `Tabs` + `TabsList` + `TabButton` | Tab semantics + roving focus | `value`, `onValueChange`, tab values | standard/compact tab visuals | default/hover/focus/selected/disabled | Radix tab semantics | `bg-surface`, `bg-accent`, `text-on-primary` | Radix Tabs via shadcn-style UI | Library |
| `Dialog` / `AccessibleDialog` | Modal surface | `open`, `onClose`, `title`, `description` | standard/hidden-header | open/close/focus-trap | Focus trap + return + Esc close | `bg-elevated`, `overlay`, `border-subtle` | Radix Dialog via shadcn-style UI | Library |
| `AlertDialog` | Confirm/cancel modal | confirm/cancel callbacks | default/destructive | open/confirming | `role=alertdialog` semantics | `bg-elevated`, `border-subtle` | Radix AlertDialog | Library |
| `Select` | Controlled picklist | `value`, `onValueChange`, `options` | single-select | default/focus/disabled/error | Keyboard + SR robust via Radix | `bg-surface`, `border-subtle`, `text-text` | Radix Select | Library |
| `Checkbox` + `CheckboxField` + `CheckboxGroup` | Binary checks and grouped checks | checked flags, legends, labels | single/grouped | default/focus/disabled/error | Radix checkbox + fieldset/legend composition | `bg-surface`, `border-subtle`, `text-text` | Radix Checkbox + bespoke composition | Hybrid |
| `DropdownMenu*` / `ContextMenu*` | Menus and context actions | trigger, items, checked/radio states | dropdown/context | closed/open/active/disabled | Menu semantics + roving focus | `bg-elevated`, `border-subtle` | Radix Menu primitives | Library |
| `Popover*` | Anchored non-modal content | trigger/content | top/right/bottom/left | closed/open | Dismissible + keyboard reachable | `bg-elevated`, `border-subtle` | Radix Popover | Library |
| `Tooltip*` | Supplemental hint content | trigger/content | default | hidden/visible | Focusable trigger, non-critical hints | `bg-elevated`, `border-subtle` | Radix Tooltip | Library |
| `ToastProvider` + `toast` | transient feedback | toast message + tone helpers | info/success/warning/error | queued/visible/dismissed | aria-live support from sonner | `bg-elevated`, `border-subtle` | sonner-backed wrapper | Library |
| `CommandPalette` | Search + action palette | `open`, items, handlers | default | closed/open/filtered/empty | Cmdk semantics in dialog shell | `bg-elevated`, `border-subtle` | cmdk + Radix dialog shell | Library |
| `ScrollArea` | Custom scroll container | children, size constraints | vertical/horizontal | idle/scrolling | Preserves keyboard scrolling | `bg-border-subtle` thumb token use | Radix ScrollArea | Library |
| `Card`, `Chip`, `FilterChip`, `InlineNotice`, `Divider`, `LinkButton`, `SectionHeader`, `LiveRegion` | Supporting UI primitives | content + style props | per-component | default and component-specific | Semantic separators, live region, note/alert roles | semantic tokens | Bespoke wrappers | Bespoke |

## App Shell + Auth + Shared Layout (`src/components/layout`, `src/components/auth`)

| Component | Purpose | Props/Inputs (high level) | Variants | States | Accessibility notes | Token dependencies | Library fit | Design ownership (Library/Hybrid/Bespoke) |
|---|---|---|---|---|---|---|---|---|
| `AppShell` | Authenticated global shell | children, policy-driven nav | desktop/mobile responsive | default | Skip link + semantic landmarks | `bg-surface`, `bg-surface-elevated`, `border-border-muted` | Bespoke shell | Bespoke |
| `ProfilePanel` | Account menu/dialog | session summary, projects, sign-out | closed/open | default/open/error | Dialog semantics via primitive | `bg-surface-elevated`, `bg-danger` | Hybrid composition | Hybrid |
| `ProtectedRoute` | Global capability gate | required capability + children | allowed/denied | default/denied | Denied renders explicit message | n/a | Logic wrapper | Bespoke |
| `ProjectRouteGuard` | Project-level capability gate | `projectId` + children | allowed/denied | default/denied | Denied renders explicit message | n/a | Logic wrapper | Bespoke |
| `AccessDeniedView` | Policy-denied UX surface | message | default | default/focus | Action link returns to hub | `bg-primary`, `text-on-primary` | Bespoke | Bespoke |
| `PageHeader` | Page title/description region | title/description/action | with action/no action | default | Heading hierarchy | `border-border-muted`, `text-primary` | Bespoke | Bespoke |
| `SectionHeader` (layout) | Section heading row | title/description/action | with action/no action | default | Semantic heading and optional action | `text-primary`, `text-muted` | Bespoke | Bespoke |
| `Panel` | Standard card-like section container | title/description/heading level | heading level 2/3 | default | Semantic section wrapper | `bg-surface-elevated`, `border-border-muted`, `shadow-soft` | Bespoke | Bespoke |
| `DataTable` | Generic table renderer | caption, columns, rows, rowKey | dense/regular by CSS use | default/hover-row/loading-empty | Semantic `<table>` with caption | `bg-surface`, `border-border-muted` | Bespoke | Bespoke |
| `DataList` | Label-value grid | item list | one/two column responsive | default | Semantic `dl/dt/dd` structure | `bg-surface`, `border-border-muted` | Bespoke | Bespoke |
| `Grid` / `Stack` / `Cluster` | Layout primitives | children + spacing props | xs/sm/md/lg gaps | default | Preserves reading order | spacing tokens | Bespoke | Bespoke |
| `ProjectShell` | Legacy project page shell | project metadata + children | two-column layout | default | Landmark grouping with headings | `bg-surface`, `border-border-muted` | Bespoke | Bespoke |

## Route Screens (`src/pages`)

| Component | Purpose | Props/Inputs (high level) | Variants | States | Accessibility notes | Token dependencies | Library fit | Design ownership (Library/Hybrid/Bespoke) |
|---|---|---|---|---|---|---|---|---|
| `LoginPage` | Unauthenticated sign-in screen | auth status, keycloak config | default | default/loading/error | Labeled action, semantic heading | `bg-surface`, `bg-danger-subtle` | Bespoke composition | Bespoke |
| `HubPage` | Main control-plane dashboard | none (panel composition) | default | default/loading (panel-level) | Section and heading structure | shell + panel tokens | Bespoke composition | Bespoke |
| `ProjectsPage` | Project listing route | projects from context | default | loading/error/ready | Table semantics with links | `text-primary`, `text-danger` | Bespoke composition | Bespoke |
| `ProjectSpacePage` | Project workspace contract route | `activeTab` prop from router | overview/work/tools | loading/error/ready | Tabpanel semantics in child views | project-space tokens | Bespoke + primitive composition | Hybrid |
| `LessonsPage` | Lessons route container | none | default | default | Heading + panel region | shell tokens | Bespoke composition | Bespoke |
| `MediaPage` | Media route container | none | default | default | Heading + panel region | shell tokens | Bespoke composition | Bespoke |
| `DevPage` | Dev route container | none | default | default | Heading + panel region | shell tokens | Bespoke composition | Bespoke |
| `BlockingInputsPage` | Blocking inputs route | none | default | default | Readable list/empty state | shell tokens | Bespoke composition | Bespoke |
| `NotFoundPage` | Unknown-route fallback | none | default | default | Return action keyboard reachable | `bg-primary` button style | Bespoke composition | Bespoke |

## Feature Panels (`src/features`)

| Component | Purpose | Props/Inputs (high level) | Variants | States | Accessibility notes | Token dependencies | Library fit | Design ownership (Library/Hybrid/Bespoke) |
|---|---|---|---|---|---|---|---|---|
| `PersonalizedDashboardPanel` | Capability-filtered dashboard cards | session summary + projects | cards by capability | default/empty | Semantic list + links | panel/list tokens | Bespoke | Bespoke |
| `ProjectCorePanel` | Auth/project governance workflows | owner role, projects, audit/snapshot data | owner/non-owner | default/loading/error | Form labels + tables + aria-live status | panel + form tokens | Bespoke | Bespoke |
| `SmartWakePanel` | Service wake/sleep controls | service cards from wake hook | per service state | sleeping/starting/ready/error | aria-live status text | state badge token classes | Bespoke | Bespoke |
| `TasksPanel` | OpenProject task sections + quick actions | tasks data, selected task | due today/soon/overdue | loading/error/dialog-open | Dialog via primitive; table semantics | panel/table/dialog tokens | Hybrid composition | Hybrid |
| `NotificationsPanel` | Email/alert composition panel | form input state | postmark/ntfy | idle/loading/error/success | Fieldsets + labels + aria-live status | panel/form tokens | Bespoke | Bespoke |
| `NotesPanel` | Project note listing + deep link | selected project, notes list | no-project/loaded | loading/error/ready | Labeled project selector + table | panel/form/table tokens | Bespoke | Bespoke |
| `FilesPanel` | Nextcloud workflows | folder/upload/file list state | action rows + table | loading/error/uploading/success | Labeled file input, aria-live status | panel/form/table tokens | Bespoke | Bespoke |
| `ActivityLogPanel` | Global event feed | event list from context | default | default/empty | Table caption and row headers | panel/table tokens | Bespoke | Bespoke |
| `LessonsStudioPanel` | Student notes/email/invoice workflow | student, note, status state | per student | idle/loading/error/success | Labeled `select` + `textarea` + tables | panel/form/table tokens | Bespoke | Bespoke |
| `MediaFlowsPanel` | Meeting ingest and episode export | URL, stage, summary state | ingest/pipeline/summary | idle/loading/error/success | Labeled controls + aria-live status | panel/form/status tokens | Bespoke | Bespoke |
| `DevWorkPanel` | PR list and research links | PR data + saved links | mood/research/table | loading/error/ready | Label association and link semantics | panel/form/table tokens | Bespoke | Bespoke |
| `BlockingInputsPanel` | Missing-config checklist | blocking input list | empty/non-empty | default | Semantic list states | panel/list tokens | Bespoke | Bespoke |

## Notes Collaboration (`src/features/notes`)

| Component | Purpose | Props/Inputs (high level) | Variants | States | Accessibility notes | Token dependencies | Library fit | Design ownership (Library/Hybrid/Bespoke) |
|---|---|---|---|---|---|---|---|---|
| `EditorShell` | Collaboration status and controls chrome | save status, connection, presence | editable/read-only/locked | idle/saving/saved/error/connected/disconnected/locked | `role=status` badges, actionable reload/notify | panel/status badge tokens | Bespoke | Bespoke |
| `CollaborativeLexicalEditor` | Lexical + yjs editor integration | note/session/user/editable handlers | connected/disconnected | connecting/connected/disconnected | ARIA label on editor, keyboard formatting support | editor tokenized classes | Bespoke integration | Bespoke |

## Project Space (`src/components/project-space`)

| Component | Purpose | Props/Inputs (high level) | Variants | States | Accessibility notes | Token dependencies | Library fit | Design ownership (Library/Hybrid/Bespoke) |
|---|---|---|---|---|---|---|---|---|
| `TopNavTabs` | Top-level project nav + pinned pane shortcuts | active tab + pinned panes + handlers | overview/work/tools + pinned row | default/hover/focus/selected | Radix-backed tab semantics + labeled pinned controls | `bg-elevated`, `bg-surface`, `bg-accent` | Hybrid (tabs lib + bespoke pinned behavior) | Hybrid |
| `PinnedPanesTabs` | Per-user pinned pane strip with sticky edge anchors | pinned panes + open/unpin handlers + active pin context | pinned list/empty | default/hover/focus/selected/overflow | Active pin uses `aria-current`; each action explicitly labeled | `bg-elevated`, `border-subtle`, `bg-accent` | Bespoke composition using button primitives | Bespoke |
| `PaneSwitcher` | Dot-to-chip pane switcher with keyboard-first toolbar pattern | panes + active pane + select/reorder handlers | static/reorder-enabled | default/hover/focus/active/disabled | `role=toolbar`, Arrow focus nav, Ctrl+Arrow reorder, Ctrl+Shift+Number quick switch | `bg-accent`, `text-on-primary`, `text-muted` | Bespoke | Bespoke |
| `PaneHeaderControls` | Pane identity/config row (rename, audience, regions, pin, focus) | pane fields + audience/region handlers | editable/disabled | default/hover/focus/active/disabled | Popover config controls, labeled input, `aria-pressed` toggles | `bg-elevated`, `bg-surface`, `border-subtle` | Hybrid (Popover primitive + bespoke contract UI) | Hybrid |
| `ModuleGrid` | 12-column module system with S/M/L cards and max-count guard | modules + add/remove/lens handlers + max modules | S/M/L cards, empty, maxed | default/hover/focus/delete-confirm/max | Alert-dialog for destructive delete; ghost fillers are `aria-hidden` | `bg-elevated`, `border-subtle`, `bg-surface` | Hybrid (AlertDialog + bespoke grid logic) | Hybrid |
| `FocusModeToolbar` | Floating top toolbar that opens module dialogs over workspace | visible + modules + active module dialog handlers | hidden/visible | default/active/dialog-open | `role=toolbar`; dialog trap + Escape close + trigger focus return | `bg-surface`, `border-subtle`, `rounded-b-panel` | Hybrid (Dialog primitive + bespoke toolbar) | Hybrid |
| `OverviewView` | Overview shell with timeline/calendar/tasks subviews | project summary + collaborators + view state | timeline/calendar/tasks | default/filtering | Subview tab semantics + labeled controls | overview tokens | Bespoke composition | Bespoke |
| `OverviewHeader` | Overview-only project header (title, collaborators, refs) | title/edit handlers + collaborator list + refs | refs empty/non-empty | default/focus/popover-open | Labeled title input; refs popover dismiss behavior via primitive | `bg-elevated`, `border-subtle` | Hybrid (Popover primitive + bespoke header) | Hybrid |
| `TimelineTab` | Clustered timeline feed with sticky date headers | date clusters + item type/priority metadata | clustered list | default/scroll/filtered | Sticky headers in local scroll container; semantic item labels | priority pink set + `border-subtle` | Bespoke | Bespoke |
| `CalendarTab` | Project calendar lens surface (time/user/category) | events + lens state + change handlers | day/week/month/year (month implemented) | default/filtered/today-highlight | Lens chips use `aria-pressed`; readable event chips in day cells | priority pink + non-pink collaborator/category palette | Bespoke | Bespoke |
| `TasksTab` | Clustered tasks with subtask priority inheritance | tasks + cluster mode + user/category filters | chronological/category/priority | default/expanded/collapsed/filtered | Cluster headers expose `aria-expanded`; inheritable subtask visual priority | priority pink set + `border-subtle` | Bespoke | Bespoke |
| `FilterBarOverlay` | Trigger + overlay filter panel with grouped chips | filter groups + active ids + toggle/clear handlers | collapsed/expanded | default/active-count/expanded | Trigger uses `aria-expanded`; chips use `aria-pressed`; outside close control | `bg-elevated`, `border-subtle`, priority pink chips | Bespoke | Bespoke |
| `WorkView` | Pane workspace shell | panes + active pane + callbacks | normal/pinned-entry/focus-mode | loading/missing-pane/default | Dialogs via primitive, fieldset groupings, labeled actions | work tokens | Hybrid composition | Hybrid |
| `ToolsView` | Project tools shell | none | live tools/automation builder | default | Structured headings and actionable buttons | tools tokens | Bespoke composition | Bespoke |
| `FilterBar` (+ `CalendarFilterBar`, `TaskListToolbar`) | Legacy filter layout region retained for reference | select/search/chip props | calendar/tasks | default/filtered | Labeled controls and landmarking | `bg-surface`, `border-subtle` | Hybrid (Select primitive + bespoke layout) | Hybrid |
| `ModuleLensControl` | Module lens selector | lens + module label + handler | project/scratch | default/focus | explicit aria-label includes module name | elevated select tokens | Hybrid (Select primitive + bespoke context) | Hybrid |
| `mockProjectSpace` helpers | Pane/module seed rules | project + collaborator ids | seed variants | n/a | n/a | n/a | Logic-only | Bespoke |
| `tabKeyboard` helper | Legacy tab key helper | items + active + callbacks | n/a | n/a | keyboard nav utility | n/a | Logic-only | Bespoke |

## Summary
- Library-owned components: primitives backed directly by shadcn/Radix/sonner/cmdk wrappers.
- Hybrid-owned components: domain compositions that depend on library primitives but have bespoke layout/contract behavior.
- Bespoke-owned components: screens, shells, feature panels, and domain contracts.
