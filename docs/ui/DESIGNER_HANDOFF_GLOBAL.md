# Designer Handoff – Global Bespoke/Hybrid UI

This handoff lists only bespoke or hybrid components that need visual design coverage.
Pure library primitives (Dialog, Select, Tabs, etc.) are excluded except where retheme guidance is needed through composition.

## 1) Login Screen

| Component | Variants | Required states |
|---|---|---|
| `LoginHero` (title + subtitle block in `LoginPage`) | compact, roomy | default, loading |
| `SignInPanel` (`Panel` usage in login) | default, error-emphasis | default, error |
| `KeycloakPrimaryButton` | enabled, disabled | default, hover, focus-visible, disabled, loading |
| `InlineAuthError` | danger tone | default |

## 2) App Shell + Global Navigation

| Component | Variants | Required states |
|---|---|---|
| `AppShellHeader` | dense, wide | default |
| `PrimaryNavTab` (`NavLink` in `AppShell`) | active, inactive | default, hover, focus-visible, selected, disabled |
| `ProfileTriggerButton` | default | default, hover, focus-visible, disabled |
| `ProfilePanelDialogChrome` | compact profile panel | default, hover, focus-visible, loading, error |
| `AccessDeniedView` | route-denied | default, focus-visible |
| `NotFoundReturnAction` | primary | default, hover, focus-visible |

## 3) Home Hub (Bespoke Panel Surfaces)

| Component | Variants | Required states |
|---|---|---|
| `DashboardCard` (`PersonalizedDashboardPanel`) | capability-visible, hidden-by-policy | default, hover, focus-visible, disabled |
| `AccessibleProjectRow` | normal, selected/focused | default, hover, focus-visible, selected |
| `ServiceRegistryRow` (`ProjectCorePanel`) | linkable, hub-only | default, hover, focus-visible, disabled |
| `OwnerActionFormRow` | create/invite/recovery rows | default, hover, focus-visible, disabled, loading, error |
| `SmartWakeServiceCard` | sleeping, starting, stopping, ready, error | default, hover, focus-visible, selected, disabled, loading, error |
| `TaskSectionCard` (`TasksPanel`) | due-today, due-soon, overdue | default, hover, focus-visible, loading, error |
| `TaskQuickActionsDialogContent` | default | default, focus-visible, loading, error |
| `NotificationComposerFieldset` | postmark, ntfy | default, hover, focus-visible, disabled, loading, error |
| `FilesActionBar` | folder, upload, bundle actions | default, hover, focus-visible, disabled, loading, error |
| `ResearchLinkStore` (`DevWorkPanel`) | empty, populated | default, hover, focus-visible, disabled, error |
| `BlockingInputRow` | missing-input item | default, error |
| `ActivityFeedTableSkin` | dense, regular | default, hover, focus-visible, selected |

## 4) Domain Screens Outside Project Space

| Component | Variants | Required states |
|---|---|---|
| `ProjectsTableRow` | default | default, hover, focus-visible, selected |
| `LessonsStudentSelector` | default | default, hover, focus-visible, disabled, error |
| `LessonNoteComposer` | empty, populated | default, focus-visible, disabled, loading, error |
| `MediaGuestPipelineSelector` | stage-select | default, hover, focus-visible, disabled |
| `MediaSummaryCallout` | summary-present | default, loading, error |

## 5) Project Space (Reference Existing Detail)

Primary source: `docs/ui/DESIGNER_HANDOFF.md`.
Use that document as the canonical detailed checklist for Project Space bespoke surfaces.

Global-required coverage summary:
- `TopNavTabs` + pinned shortcuts row.
- `PinnedPanesTabs` sticky edge behavior for overflow.
- `PaneSwitcher` and pane row controls.
- `PaneHeaderControls` composition rhythm.
- `ModuleGrid`, `ModuleCard`, `ModuleLensControl`, add/remove affordances.
- `FocusModeToolbar`, focus icon buttons, module dialog chrome.
- Overview shells (`OverviewHeader`, `TimelineTab`, `CalendarTab`, `TasksTab`).
- `FilterBarOverlay`, `FilterChip`, `InlineNotice`, empty states.

Open bespoke design gaps still required:
- Final motion values for PaneSwitcher delayed reveal.
- Sticky-anchor visual treatment for first/last pinned tabs.
- Final icon family for pane controls and focus toolbar modules.
- Dedicated Calendar week/day/year layouts (month is implemented; others are explicit future layouts).
- Final hover timing and elevation spec for ModuleGrid cards and delete affordance.
- Priority pink palette lock remains reserved to priority-only semantics; collaborator/category palettes must remain non-pink.

For each above, design states must include where relevant:
- default
- hover
- focus-visible
- selected
- disabled
- loading
- error

## 6) Cross-cutting Layout Components (Bespoke)

| Component | Variants | Required states |
|---|---|---|
| `Panel` | default, elevated emphasis | default, hover, focus-within, loading, error |
| `PageHeader` | with action, no action | default |
| `SectionHeader` | with action, no action | default |
| `DataTable` skin | compact, regular | default, hover-row, focus-within, selected, loading, error |
| `DataList` cards | 1-col, 2-col | default, hover, focus-within |
| `Grid/Stack/Cluster` spacing rhythm | dense, regular | default |

## 7) Rethme Guidance for Library-backed Primitives

Not redesigning primitive behavior, but designer should provide token-level visual language guidance for:
- Button color/contrast ramps.
- Focus ring intensity/offset harmony.
- Dialog elevation/backdrop mood.
- Table row hover/selection contrast.
