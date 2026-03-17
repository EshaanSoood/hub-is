# Frontend Architecture Audit

Audit target: `src/` on branch `codex/Debugs-First_round`  
Mode: read/analyze/report only  
Application code changed: no

## Executive Summary

The frontend’s main architectural risk is not raw file size by itself; it is how route state, server mutations, optimistic UI state, and cross-surface refresh logic are co-located in the same components. The highest-risk hotspot is `src/pages/ProjectSpacePage.tsx`, where one file owns project bootstrap, pane routing, view runtime loading, record inspector CRUD, doc collaboration, file uploads, asset-root provisioning, automation tools, and timeline refresh behavior.

The safest decomposition path is to start with read-heavy, low-coupling slices that already have coherent boundaries: calendar runtime, tasks overview paging, collaborator mutation UI, and tooling/automation read models. The most dangerous extractions are anything that touches `navigate`, `useSearchParams`, `location.state`, `capture=1`, `focus_node_key`, `view_id`, `kanban_view_id`, or the implicit “active pane” redirect behavior, because those effects currently coordinate multiple feature surfaces and clean up URL state in-place.

## 1. Fat File Map

### Largest `src/` files and decomposition candidates

Any file over 400 lines is flagged as a decomposition candidate.

| File | LOC | Concern summary | Candidate? |
| --- | ---: | --- | --- |
| `src/pages/ProjectSpacePage.tsx` | 4154 | 9 concerns: project bootstrap, pane routing, overview state, work views, record inspector CRUD, doc collaboration, files/assets, automation tools, and timeline refresh | Yes |
| `src/services/hubContractApi.ts` | 1564 | 3 concerns: hub transport wrapper, contract/type definitions, and every hub endpoint binding | Yes |
| `src/lib/calendar-nlp/passes/chronoPass.ts` | 1102 | 3 concerns: chrono integration, relative-date resolution, and parse warnings/debug traces | Yes |
| `src/components/layout/AppShell.tsx` | 843 | 5 concerns: shell chrome, notifications, quick nav, contextual capture routing, and account menu state | Yes |
| `src/components/project-space/WorkView.tsx` | 646 | 5 concerns: pane header controls, module-layout editing, runtime binding, lazy module rendering, and workspace placeholder framing | Yes |
| `src/pages/ProjectsPage.tsx` | 626 | 6 concerns: hub home fetch, quick capture, project creation, record inspector modal, live updates, and route/query-param handling | Yes |
| `src/lib/calendar-nlp/passes/recurrencePass.ts` | 604 | 2 concerns: recurrence extraction and recurrence confidence/debug tracing | Yes |
| `src/features/PersonalizedDashboardPanel.tsx` | 574 | 4 concerns: capability-aware dashboard selection, task/event normalization, three dashboard views, and record-opening affordances | Yes |
| `src/components/project-space/AutomationBuilder.tsx` | 537 | 4 concerns: automation rule editor state, rule list management, run history display, and delete confirmation flow | Yes |
| `src/components/project-space/FilesModuleSkin.tsx` | 518 | 4 concerns: file browsing, upload interactions, upload-progress micro-UI, and filtering/sorting | Yes |
| `src/components/project-space/InboxCaptureModuleSkin.tsx` | 511 | 3 concerns: local quick-thought persistence, editing/archive flows, and responsive presentation | Yes |
| `src/lib/calendar-nlp/utils.ts` | 454 | 3 concerns: shared parser utilities, date/time normalization, and parse bookkeeping | Yes |
| `src/features/notes/CollaborativeLexicalEditor.tsx` | 438 | 5 concerns: editor composition, Yjs provider lifecycle, embed/mention insertion plugins, focus/selection tracking, and presence reporting | Yes |
| `src/services/projectsService.ts` | 427 | 4 concerns: project CRUD, invites/grants, notes/collaboration, and snapshot/recovery operations | Yes |

### Near-threshold watch list

- `src/context/AuthzContext.tsx` — 396 lines — already combines auth bootstrap, token refresh, capability derivation, and auth actions.
- `src/components/project-space/CalendarModuleSkin.tsx` — 359 lines — presentation plus calendar behavior/state.
- `src/components/project-space/KanbanModuleSkin.tsx` — 343 lines — board rendering plus drag/drop semantics.
- `src/components/project-space/TasksTab.tsx` — 311 lines — task rendering plus interaction/filter state.

### Full `src/` inventory

Non-source artifacts are included because they currently live under `src/`.

<details>
<summary>Expand full inventory by directory</summary>

### src/.DS_Store
- `src/.DS_Store` — 5 lines — 0 concerns: stray Finder metadata artifact under `src/`; remove from source control.

### src/App.tsx
- `src/App.tsx` — 117 lines — 3 concerns: route table, auth gating, and lazy route loading.

### src/components/auth
- `src/components/auth/AccessDeniedView.tsx` — 14 lines — 1 concern: auth or project-access boundary for access denied view.
- `src/components/auth/ProfilePanel.tsx` — 96 lines — 1 concern: auth or project-access boundary for profile panel.
- `src/components/auth/ProjectRouteGuard.tsx` — 15 lines — 1 concern: auth or project-access boundary for project route guard.
- `src/components/auth/ProjectRouteRedirect.tsx` — 11 lines — 1 concern: auth or project-access boundary for project route redirect.
- `src/components/auth/ProtectedRoute.tsx` — 24 lines — 1 concern: auth or project-access boundary for protected route.

### src/components/layout
- `src/components/layout/AppShell.tsx` — 843 lines — 5 concerns: shell chrome, notifications, quick nav, contextual capture routing, and account menu state. Candidate for decomposition.
- `src/components/layout/Cluster.tsx` — 23 lines — 1 concern: layout primitive for cluster.
- `src/components/layout/DataList.tsx` — 15 lines — 1 concern: layout primitive for data list.
- `src/components/layout/DataTable.tsx` — 50 lines — 1 concern: layout primitive for data table.
- `src/components/layout/Grid.tsx` — 14 lines — 1 concern: layout primitive for grid.
- `src/components/layout/PageHeader.tsx` — 22 lines — 1 concern: layout primitive for page header.
- `src/components/layout/Panel.tsx` — 28 lines — 1 concern: layout primitive for panel.
- `src/components/layout/ProjectShell.tsx` — 47 lines — 2 concerns: project page framing and metadata sidebar composition.
- `src/components/layout/SectionHeader.tsx` — 21 lines — 1 concern: layout primitive for section header.
- `src/components/layout/Stack.tsx` — 21 lines — 1 concern: layout primitive for stack.

### src/components/primitives
- `src/components/primitives/Button.tsx` — 44 lines — 1 concern: design-system primitive for button.
- `src/components/primitives/Card.tsx` — 23 lines — 1 concern: design-system primitive for card.
- `src/components/primitives/Checkbox.tsx` — 67 lines — 1 concern: design-system primitive for checkbox.
- `src/components/primitives/Chip.tsx` — 62 lines — 1 concern: design-system primitive for chip.
- `src/components/primitives/CommandPalette.tsx` — 59 lines — 1 concern: design-system primitive for command palette.
- `src/components/primitives/Dialog.tsx` — 112 lines — 1 concern: design-system primitive for dialog.
- `src/components/primitives/Divider.tsx` — 16 lines — 1 concern: design-system primitive for divider.
- `src/components/primitives/IconButton.tsx` — 54 lines — 1 concern: design-system primitive for icon button.
- `src/components/primitives/InlineNotice.tsx` — 65 lines — 1 concern: design-system primitive for inline notice.
- `src/components/primitives/LinkButton.tsx` — 33 lines — 1 concern: design-system primitive for link button.
- `src/components/primitives/LiveRegion.tsx` — 5 lines — 1 concern: design-system primitive for live region.
- `src/components/primitives/Menu.tsx` — 46 lines — 1 concern: design-system primitive for menu.
- `src/components/primitives/Popover.tsx` — 11 lines — 1 concern: design-system primitive for popover.
- `src/components/primitives/ScrollArea.tsx` — 3 lines — 1 concern: design-system primitive for scroll area.
- `src/components/primitives/SectionHeader.tsx` — 25 lines — 1 concern: design-system primitive for section header.
- `src/components/primitives/Select.tsx` — 62 lines — 1 concern: design-system primitive for select.
- `src/components/primitives/Tabs.tsx` — 69 lines — 1 concern: design-system primitive for tabs.
- `src/components/primitives/Toast.tsx` — 17 lines — 1 concern: design-system primitive for toast.
- `src/components/primitives/ToggleButton.tsx` — 54 lines — 1 concern: design-system primitive for toggle button.
- `src/components/primitives/Tooltip.tsx` — 13 lines — 1 concern: design-system primitive for tooltip.
- `src/components/primitives/buttonStyles.ts` — 26 lines — 1 concern: design-system primitive for button styles.
- `src/components/primitives/index.ts` — 53 lines — 1 concern: design-system primitive for index.

### src/components/project-space
- `src/components/project-space/AutomationBuilder.tsx` — 537 lines — 4 concerns: automation rule editor state, rule list management, run history display, and delete confirmation flow. Candidate for decomposition.
- `src/components/project-space/BacklinksPanel.tsx` — 58 lines — 1 concern: backlinks list presentation and backlink open affordance.
- `src/components/project-space/CalendarModuleSkin.tsx` — 359 lines — 2 concerns: calendar event rendering and scope switching.
- `src/components/project-space/CalendarTab.tsx` — 196 lines — 1 concern: calendar tab composition.
- `src/components/project-space/CommentComposer.tsx` — 87 lines — 2 concerns: comment text entry and mention insertion wiring.
- `src/components/project-space/CommentRail.tsx` — 151 lines — 2 concerns: doc-comment list rendering and comment filtering/toggling.
- `src/components/project-space/FileInspectorActionBar.tsx` — 207 lines — 2 concerns: file action UI and rename/move/remove affordances.
- `src/components/project-space/FileMovePopover.tsx` — 108 lines — 1 concern: file-move menu UI.
- `src/components/project-space/FilesModuleSkin.tsx` — 518 lines — 4 concerns: file browsing, upload interactions, upload-progress micro-UI, and filtering/sorting. Candidate for decomposition.
- `src/components/project-space/FilterBar.tsx` — 167 lines — 1 concern: filter chip bar UI.
- `src/components/project-space/FilterBarOverlay.tsx` — 139 lines — 1 concern: filter overlay presentation.
- `src/components/project-space/FocusModeToolbar.tsx` — 107 lines — 1 concern: project-space UI for focus mode toolbar.
- `src/components/project-space/InboxCaptureModuleSkin.tsx` — 511 lines — 3 concerns: local quick-thought persistence, editing/archive flows, and responsive presentation. Candidate for decomposition.
- `src/components/project-space/KanbanModuleSkin.tsx` — 343 lines — 2 concerns: kanban board rendering and drag/drop record movement.
- `src/components/project-space/MentionPicker.tsx` — 130 lines — 2 concerns: mention search fetching and picker UI state.
- `src/components/project-space/ModuleFeedback.tsx` — 43 lines — 1 concern: module empty/loading feedback components.
- `src/components/project-space/ModuleGrid.tsx` — 127 lines — 2 concerns: module layout grid rendering and module mutation controls.
- `src/components/project-space/ModuleLensControl.tsx` — 30 lines — 1 concern: module lens switcher UI.
- `src/components/project-space/OverviewHeader.tsx` — 116 lines — 1 concern: overview header presentation.
- `src/components/project-space/OverviewView.tsx` — 284 lines — 2 concerns: overview surface composition and cross-module empty/loading states.
- `src/components/project-space/PaneHeaderControls.tsx` — 174 lines — 2 concerns: pane header actions and layout toggles.
- `src/components/project-space/PaneSwitcher.tsx` — 149 lines — 2 concerns: pane tab UI and keyboard navigation.
- `src/components/project-space/PinnedPanesTabs.tsx` — 67 lines — 1 concern: pinned-pane tab presentation.
- `src/components/project-space/ProjectSpaceDialogPrimitives.ts` — 8 lines — 1 concern: project-space dialog wrappers.
- `src/components/project-space/RelationPicker.tsx` — 323 lines — 3 concerns: relation search fetching, keyboard-accessible selection UI, and relation submission state.
- `src/components/project-space/RelationRow.tsx` — 40 lines — 1 concern: single relation row presentation.
- `src/components/project-space/RelationsSection.tsx` — 111 lines — 2 concerns: relation list rendering and relation mutation wiring.
- `src/components/project-space/TableModuleSkin.tsx` — 284 lines — 2 concerns: virtualized table rendering and keyboard/sort interaction.
- `src/components/project-space/TasksTab.tsx` — 311 lines — 2 concerns: task table rendering and inline task actions/filters.
- `src/components/project-space/TimelineFeed.tsx` — 140 lines — 2 concerns: timeline clustering display and filter/load-more interaction.
- `src/components/project-space/TimelineTab.tsx` — 55 lines — 1 concern: timeline tab composition.
- `src/components/project-space/ToolsView.tsx` — 58 lines — 2 concerns: tools-page composition and tool card layout.
- `src/components/project-space/TopNavTabs.tsx` — 71 lines — 1 concern: top-level project-space tab navigation.
- `src/components/project-space/ViewEmbedBlock.tsx` — 197 lines — 3 concerns: embedded-view fetching, kanban/table preview shaping, and runtime-driven open actions.
- `src/components/project-space/WorkView.tsx` — 646 lines — 5 concerns: pane header controls, module-layout editing, runtime binding, lazy module rendering, and workspace placeholder framing. Candidate for decomposition.
- `src/components/project-space/designTokens.ts` — 32 lines — 1 concern: project-space design token constants.
- `src/components/project-space/mockProjectSpace.ts` — 288 lines — 1 concern: project-space mock fixtures.
- `src/components/project-space/tabKeyboard.ts` — 55 lines — 1 concern: project-space tab keyboard helpers.
- `src/components/project-space/types.ts` — 57 lines — 1 concern: project-space local types.

### src/components/ui
- `src/components/ui/alert-dialog.tsx` — 87 lines — 1 concern: Radix/Tailwind wrapper for alert dialog.
- `src/components/ui/checkbox.tsx` — 20 lines — 1 concern: Radix/Tailwind wrapper for checkbox.
- `src/components/ui/command.tsx` — 100 lines — 1 concern: Radix/Tailwind wrapper for command.
- `src/components/ui/context-menu.tsx` — 99 lines — 1 concern: Radix/Tailwind wrapper for context menu.
- `src/components/ui/dialog.tsx` — 64 lines — 1 concern: Radix/Tailwind wrapper for dialog.
- `src/components/ui/dropdown-menu.tsx` — 100 lines — 1 concern: Radix/Tailwind wrapper for dropdown menu.
- `src/components/ui/popover.tsx` — 26 lines — 1 concern: Radix/Tailwind wrapper for popover.
- `src/components/ui/scroll-area.tsx` — 34 lines — 1 concern: Radix/Tailwind wrapper for scroll area.
- `src/components/ui/select.tsx` — 80 lines — 1 concern: Radix/Tailwind wrapper for select.
- `src/components/ui/sonner.tsx` — 29 lines — 1 concern: Radix/Tailwind wrapper for sonner.
- `src/components/ui/tabs.tsx` — 36 lines — 1 concern: Radix/Tailwind wrapper for tabs.
- `src/components/ui/toggle-group.tsx` — 26 lines — 1 concern: Radix/Tailwind wrapper for toggle group.
- `src/components/ui/toggle.tsx` — 18 lines — 1 concern: Radix/Tailwind wrapper for toggle.
- `src/components/ui/tooltip.tsx` — 25 lines — 1 concern: Radix/Tailwind wrapper for tooltip.

### src/context/ActivityContext.tsx
- `src/context/ActivityContext.tsx` — 39 lines — 2 concerns: activity feed state and provider wiring.

### src/context/AuthzContext.tsx
- `src/context/AuthzContext.tsx` — 396 lines — 4 concerns: auth bootstrap, token/session refresh, capability helpers, and auth actions.

### src/context/ProjectsContext.tsx
- `src/context/ProjectsContext.tsx` — 67 lines — 2 concerns: project list fetching and context exposure.

### src/context/SmartWakeContext.tsx
- `src/context/SmartWakeContext.tsx` — 275 lines — 3 concerns: wake/sleep orchestration, polling, and context exposure.

### src/data/authzData.ts
- `src/data/authzData.ts` — 8 lines — 1 concern: auth/capability fixture data.

### src/data/mockData.ts
- `src/data/mockData.ts` — 168 lines — 1 concern: mock domain fixtures.

### src/features/notes
- `src/features/notes/CollaborativeLexicalEditor.tsx` — 438 lines — 5 concerns: editor composition, Yjs provider lifecycle, embed/mention insertion plugins, focus/selection tracking, and presence reporting. Candidate for decomposition.
- `src/features/notes/EditorShell.tsx` — 129 lines — 1 concern: note editor shell layout.
- `src/features/notes/lexicalState.ts` — 66 lines — 1 concern: lexical state normalization and snapshot conversion.
- `src/features/notes/lexicalTheme.ts` — 28 lines — 1 concern: Lexical theme configuration.
- `src/features/notes/mentionTokens.ts` — 72 lines — 1 concern: mention token parsing/formatting helpers.
- `src/features/notes/nodes/ViewRefNode.tsx` — 76 lines — 2 concerns: custom Lexical node definition and React rendering for embedded views.
- `src/features/notes/viewEmbedContext.tsx` — 13 lines — 1 concern: embedded-view runtime context.

### src/features/PersonalizedDashboardPanel.tsx
- `src/features/PersonalizedDashboardPanel.tsx` — 574 lines — 4 concerns: capability-aware dashboard selection, task/event normalization, three dashboard views, and record-opening affordances. Candidate for decomposition.

### src/hooks/useLiveRegion.ts
- `src/hooks/useLiveRegion.ts` — 14 lines — 1 concern: live-region announcement state.

### src/hooks/useSmartWake.ts
- `src/hooks/useSmartWake.ts` — 7 lines — 1 concern: Smart Wake context facade hook.

### src/lib/.DS_Store
- `src/lib/.DS_Store` — 1 line — 0 concerns: stray Finder metadata artifact under `src/lib/`; remove from source control.

### src/lib/blockingInputs.ts
- `src/lib/blockingInputs.ts` — 46 lines — 1 concern: blocked-input detection helper.

### src/lib/calendar-nlp
- `src/lib/calendar-nlp/.DS_Store` — 1 line — 0 concerns: stray Finder metadata artifact under `src/lib/calendar-nlp/`; remove from source control.
- `src/lib/calendar-nlp/README.md` — 119 lines — 1 concern: calendar parser documentation.
- `src/lib/calendar-nlp/constants.ts` — 50 lines — 1 concern: parser constants and token dictionaries.
- `src/lib/calendar-nlp/index.ts` — 311 lines — 3 concerns: parse pipeline orchestration, confidence scoring, and fallback heuristics.
- `src/lib/calendar-nlp/passes/alertsPass.ts` — 273 lines — 1 concern: alert extraction.
- `src/lib/calendar-nlp/passes/attendeesPass.ts` — 111 lines — 1 concern: attendee extraction.
- `src/lib/calendar-nlp/passes/chronoPass.ts` — 1102 lines — 3 concerns: chrono integration, relative-date resolution, and parse warnings/debug traces. Candidate for decomposition.
- `src/lib/calendar-nlp/passes/durationPass.ts` — 99 lines — 1 concern: duration extraction.
- `src/lib/calendar-nlp/passes/locationPass.ts` — 154 lines — 1 concern: location extraction.
- `src/lib/calendar-nlp/passes/recurrencePass.ts` — 604 lines — 2 concerns: recurrence extraction and recurrence confidence/debug tracing. Candidate for decomposition.
- `src/lib/calendar-nlp/passes/titlePass.ts` — 100 lines — 1 concern: title extraction.
- `src/lib/calendar-nlp/types.ts` — 132 lines — 1 concern: parser types/contracts.
- `src/lib/calendar-nlp/utils.ts` — 454 lines — 3 concerns: shared parser utilities, date/time normalization, and parse bookkeeping. Candidate for decomposition.

### src/lib/cn.ts
- `src/lib/cn.ts` — 2 lines — 1 concern: class name join helper.

### src/lib/dashboardCards.ts
- `src/lib/dashboardCards.ts` — 58 lines — 1 concern: dashboard card registry metadata.

### src/lib/env.ts
- `src/lib/env.ts` — 73 lines — 1 concern: environment variable parsing and validation.

### src/lib/hubRoutes.ts
- `src/lib/hubRoutes.ts` — 105 lines — 2 concerns: hub entity-to-route mapping and route-state extraction helpers.

### src/lib/keycloak.ts
- `src/lib/keycloak.ts` — 23 lines — 1 concern: Keycloak singleton/bootstrap helper.

### src/lib/policy.ts
- `src/lib/policy.ts` — 40 lines — 1 concern: capability and membership policy helpers.

### src/lib/serviceRegistry.ts
- `src/lib/serviceRegistry.ts` — 76 lines — 1 concern: service catalog metadata.

### src/main.tsx
- `src/main.tsx` — 28 lines — 2 concerns: React bootstrap and provider composition.

### src/pages/LoginPage.tsx
- `src/pages/LoginPage.tsx` — 41 lines — 1 concern: sign-in screen presentation.

### src/pages/NotFoundPage.tsx
- `src/pages/NotFoundPage.tsx` — 14 lines — 1 concern: 404 fallback presentation.

### src/pages/ProjectSpacePage.tsx
- `src/pages/ProjectSpacePage.tsx` — 4154 lines — 9 concerns: project bootstrap, pane routing, overview state, work views, record inspector CRUD, doc collaboration, files/assets, automation tools, and timeline refresh. Candidate for decomposition.

### src/pages/ProjectsPage.tsx
- `src/pages/ProjectsPage.tsx` — 626 lines — 6 concerns: hub home fetch, quick capture, project creation, record inspector modal, live updates, and route/query-param handling. Candidate for decomposition.

### src/server/routes.ts
- `src/server/routes.ts` — 13 lines — 1 concern: server route contract metadata.

### src/services/apiClient.ts
- `src/services/apiClient.ts` — 25 lines — 1 concern: shared JSON request helper.

### src/services/authService.ts
- `src/services/authService.ts` — 40 lines — 1 concern: Keycloak login/logout URL helpers.

### src/services/githubService.ts
- `src/services/githubService.ts` — 53 lines — 1 concern: GitHub PR adapter.

### src/services/hubAuthHeaders.ts
- `src/services/hubAuthHeaders.ts` — 19 lines — 1 concern: auth header helpers for hub requests.

### src/services/hubContractApi.ts
- `src/services/hubContractApi.ts` — 1564 lines — 3 concerns: hub transport wrapper, contract/type definitions, and every hub endpoint binding. Candidate for decomposition.

### src/services/hubLive.ts
- `src/services/hubLive.ts` — 151 lines — 2 concerns: live message typing and websocket subscription lifecycle.

### src/services/lessonsService.ts
- `src/services/lessonsService.ts` — 43 lines — 1 concern: lessons/invoice integration adapter.

### src/services/mediaWorkflowService.ts
- `src/services/mediaWorkflowService.ts` — 34 lines — 1 concern: media workflow orchestration adapter.

### src/services/nextcloudService.ts
- `src/services/nextcloudService.ts` — 100 lines — 1 concern: Nextcloud file adapter.

### src/services/notificationService.ts
- `src/services/notificationService.ts` — 72 lines — 1 concern: outbound notification adapters.

### src/services/openProjectService.ts
- `src/services/openProjectService.ts` — 59 lines — 1 concern: OpenProject task adapter.

### src/services/projectsService.ts
- `src/services/projectsService.ts` — 427 lines — 4 concerns: project CRUD, invites/grants, notes/collaboration, and snapshot/recovery operations. Candidate for decomposition.

### src/services/sessionService.ts
- `src/services/sessionService.ts` — 26 lines — 1 concern: session bootstrap fetch.

### src/services/smartWakeService.ts
- `src/services/smartWakeService.ts` — 95 lines — 2 concerns: wake/sleep commands and service health polling.

### src/types/domain.ts
- `src/types/domain.ts` — 248 lines — 1 concern: shared frontend domain types.

### src/types/hub-api-module.d.ts
- `src/types/hub-api-module.d.ts` — 33 lines — 1 concern: ambient hub-api module typing.

### src/vite-env.d.ts
- `src/vite-env.d.ts` — 1 line — 1 concern: Vite environment typing.

</details>

## 2. `ProjectSpacePage.tsx` Shared State Dependency Table

Method: state declarations were traced against named callbacks and `useEffect` blocks in `ProjectSpaceWorkspace` and the outer `ProjectSpacePage` wrapper. Inline JSX handlers are called out in notes where relevant.

### Outer loader state

| State | Line | Read by callbacks/effects | Written by callbacks/effects | Cross-concern boundary? |
| --- | ---: | --- | --- | --- |
| `project` | 4031 | none | `refreshProjectData` (4047) | Yes: shared bootstrap state fan-outs into every workspace concern. |
| `panes` | 4032 | none | `refreshProjectData` (4047) | Yes: routing, pane permissions, work view, inspector mutation context, and file scopes all depend on it. |
| `projectMembers` | 4033 | none | `refreshProjectData` (4047) | Yes: collaborator UI and doc editor identity both depend on it. |
| `timeline` | 4034 | none | `refreshProjectData` (4047) | Yes: overview timeline, work timeline module, and many mutation callbacks refresh it. |
| `loading` | 4044 | none | `effect@4074` (4074) | No: top-level load spinner only. |
| `error` | 4045 | `refreshProjectData` (4047) | `effect@4074` (4074) | No: top-level load failure only. |

### Workspace state

| State | Line | Read by callbacks/effects | Written by callbacks/effects | Cross-concern boundary? |
| --- | ---: | --- | --- | --- |
| `overviewView` | 753 | `effect@1013` (1013), `effect@2864` (2864) | `effect@954` (954) | Yes: route query, overview tabs, and task infinite-scroll effect all depend on it. |
| `selectedOverviewKanbanViewId` | 754 | none | `effect@2822` (2822), `effect@2828` (2828) | Yes: overview UI and URL query sync both depend on it. |
| `timelineFilters` | 755 | none | `toggleTimelineFilter` (2810) | Yes: shared between overview timeline and work timeline module runtime. |
| `creatingPaneName` | 763 | `onCreatePane` (1624) | `onCreatePane` (1624) | No: create-pane form only. |
| `showPaneSwitcher` | 764 | none | `effect@947` (947) | Yes: local UI toggle is driven by the `pinned` route flag. |
| `showOtherPanes` | 765 | none | none | No: local pane navigator toggle only; written via inline JSX. |
| `otherPaneQuery` | 766 | none | none | No: local read-only pane filter only; written via inline JSX. |
| `paneMutationError` | 767 | none | `createAndOpenCaptureRecord` (1397), `onCreatePane` (1624), `onRenamePane` (1674), `onUpdatePaneFromWorkView` (1737) | Yes: reused by quick capture, pane CRUD, and module-layout mutations. |
| `projectMemberMutationError` | 768 | none | `onCreateProjectMember` (2271) | No: collaborator invite flow only. |
| `projectMemberMutationNotice` | 769 | none | `onCreateProjectMember` (2271) | No: collaborator invite flow only. |
| `collections` | 771 | `createAndOpenCaptureRecord` (1397) | `refreshViewsAndRecords` (1037) | Yes: view bootstrapping, quick capture targeting, and tool-side record type availability all depend on it. |
| `views` | 772 | none | `refreshViewsAndRecords` (1037) | Yes: focused work views, overview kanban selection, doc embeds, and work module bindings depend on it. |
| `tableViewDataById` | 773 | `effect@2448` (2448) | `refreshViewsAndRecords` (1037) | Yes: overview, work modules, and focused embedded views share it. |
| `tableLoading` | 774 | none | `refreshViewsAndRecords` (1037) | Yes: one loading flag feeds multiple table surfaces. |
| `kanbanRuntimeByViewId` | 775 | `onMoveKanbanRecord` (2714) | `refreshViewsAndRecords` (1037) | Yes: overview kanban, work modules, and focused embedded kanban all share it. |
| `kanbanLoading` | 776 | none | `refreshViewsAndRecords` (1037) | Yes: one loading flag feeds multiple kanban surfaces. |
| `recordsError` | 777 | none | `refreshViewsAndRecords` (1037), `onUploadProjectFiles` (2501), `onUploadPaneFiles` (2599), `onMoveKanbanRecord` (2714) | Yes: shared error channel for view loading, uploads, and kanban mutations. |
| `calendarMode` | 779 | `refreshCalendar` (1134) | none | Yes: shared between overview calendar and work calendar module. |
| `calendarEvents` | 780 | none | `refreshCalendar` (1134) | Yes: shared between overview calendar and work calendar module. |
| `calendarLoading` | 781 | none | `refreshCalendar` (1134) | Yes: shared between overview calendar and work calendar module. |
| `projectTasks` | 782 | `effect@1013` (1013) | `loadProjectTaskPage` (966) | No: overview tasks surface only. |
| `projectTasksLoading` | 786 | `effect@1013` (1013) | `loadProjectTaskPage` (966) | No: overview tasks surface only. |
| `projectTasksLoadingMore` | 787 | `effect@1013` (1013) | `loadProjectTaskPage` (966) | No: overview tasks surface only. |
| `projectTasksError` | 788 | none | `loadProjectTaskPage` (966) | No: overview tasks surface only. |
| `inspectorRecordId` | 791 | none | `openInspector` (1329), `closeInspector` (1384) | No: inspector open/close state only. |
| `inspectorMutationPaneId` | 792 | `onSaveRecordField` (1759), `onAddRelation` (1822), `onRemoveRelation` (1868), `onAttachFile` (1912), `onDetachInspectorAttachment` (1991), `relinkInspectorAttachment` (2028), `onRenameInspectorAttachment` (2096), `onMoveInspectorAttachment` (2120) | `openInspector` (1329), `closeInspector` (1384) | Yes: record mutations depend on current pane permissions and work-context provenance. |
| `inspectorRecord` | 793 | `effect@1516` (1516), `onSaveRecordField` (1759), `onAddRecordComment` (1786), `onAddRelation` (1822), `onRemoveRelation` (1868), `onAttachFile` (1912), `onDetachInspectorAttachment` (1991), `relinkInspectorAttachment` (2028), `onRenameInspectorAttachment` (2096), `onMoveInspectorAttachment` (2120) | `openInspector` (1329), `closeInspector` (1384), `onSaveRecordField` (1759), `onAddRecordComment` (1786), `onAddRelation` (1822), `onRemoveRelation` (1868), `onAttachFile` (1912), `onDetachInspectorAttachment` (1991), `relinkInspectorAttachment` (2028) | Yes: fields, comments, relations, attachments, backlinks, and activity all share one mutable payload. |
| `inspectorLoading` | 794 | none | `openInspector` (1329) | No: inspector fetch status only. |
| `inspectorError` | 795 | none | `openInspector` (1329), `onSaveRecordField` (1759), `onAttachFile` (1912), `onDetachInspectorAttachment` (1991), `relinkInspectorAttachment` (2028), `onRenameInspectorAttachment` (2096), `onMoveInspectorAttachment` (2120) | Yes: shared error channel for field, attachment, and inspector load failures. |
| `inspectorCommentText` | 796 | `onAddRecordComment` (1786) | `closeInspector` (1384), `onAddRecordComment` (1786) | No: record-comment form only. |
| `inspectorBacklinks` | 797 | none | `openInspector` (1329), `closeInspector` (1384), `onAddRecordComment` (1786) | No: inspector backlinks panel only. |
| `inspectorBacklinksLoading` | 798 | none | `openInspector` (1329) | No: inspector backlinks panel only. |
| `inspectorBacklinksError` | 799 | none | `openInspector` (1329), `closeInspector` (1384) | No: inspector backlinks panel only. |
| `relationMutationError` | 800 | none | `openInspector` (1329), `closeInspector` (1384), `onAddRelation` (1822), `onRemoveRelation` (1868) | No: relation mutations only. |
| `removingRelationId` | 801 | none | `openInspector` (1329), `closeInspector` (1384), `onRemoveRelation` (1868) | No: relation removal UI only. |
| `savingValues` | 802 | none | `onSaveRecordField` (1759) | No: record field save UI only. |
| `uploadingAttachment` | 803 | none | `onAttachFile` (1912) | No: attachment upload UI only. |
| `selectedAttachmentId` | 804 | none | `closeInspector` (1384), `effect@1516` (1516), `onDetachInspectorAttachment` (1991), `relinkInspectorAttachment` (2028) | Yes: attachment tabs and file action bar both depend on it. |
| `docComments` | 806 | none | `refreshDocComments` (1144) | No: workspace doc comment rail only. |
| `orphanedDocComments` | 823 | none | `refreshDocComments` (1144) | No: workspace doc comment rail only. |
| `showResolvedDocComments` | 840 | none | none | No: doc comment filter only; written via inline JSX. |
| `docCommentComposerOpen` | 841 | none | `effect@1206` (1206), `onAddDocComment` (2194), `onDocCommentDialogOpenChange` (2237) | Yes: route/doc resets and comment creation both drive it. |
| `docCommentText` | 842 | `onAddDocComment` (2194) | `onAddDocComment` (2194) | No: doc comment composer only. |
| `selectedDocNodeKey` | 843 | `onAddDocComment` (2194) | `effect@1206` (1206) | Yes: editor selection, doc comment creation, and route resets depend on it. |
| `uploadingDocAsset` | 845 | none | `onUploadDocAsset` (2149) | No: doc asset upload UI only. |
| `pendingDocAssetEmbed` | 846 | none | `onUploadDocAsset` (2149) | Yes: upload flow hands off into editor embed insertion. |
| `pendingDocMentionInsert` | 847 | none | `onInsertDocMention` (1574) | Yes: mention picker hands off into editor insertion plugin. |
| `pendingViewEmbedInsert` | 848 | none | `onInsertViewEmbed` (1586) | Yes: view selector hands off into editor insertion plugin. |
| `pendingDocFocusNodeKey` | 849 | none | `effect@1206` (1206), `effect@1219` (1219), `onJumpToDocComment` (1596) | Yes: route state, backlink jumps, and editor focus handoff all depend on it. |
| `selectedEmbedViewId` | 850 | `onInsertViewEmbed` (1586) | `refreshViewsAndRecords` (1037) | Yes: view registry bootstrapping and doc embed insertion share it. |
| `focusedWorkViewData` | 851 | none | `effect@2448` (2448) | Yes: route-selected focused view and cached runtime data share it. |
| `focusedWorkViewLoading` | 852 | none | `effect@2448` (2448) | Yes: focused-view route state and runtime fetch share it. |
| `focusedWorkViewError` | 853 | none | `effect@2448` (2448) | Yes: focused-view route state and runtime fetch share it. |
| `assetRoots` | 855 | `ensureProjectAssetRoot` (2347) | `refreshToolsData` (1184), `onAddAssetRoot` (2249), `ensureProjectAssetRoot` (2347) | Yes: tools UI, record attachment uploads, doc asset uploads, and file modules all depend on it. |
| `assetEntries` | 866 | none | `onLoadAssets` (2265) | No: tools asset listing only. |
| `assetWarning` | 867 | none | `onLoadAssets` (2265) | No: tools asset listing only. |
| `newAssetRootPath` | 868 | `onAddAssetRoot` (2249) | `onAddAssetRoot` (2249) | No: asset-root form only. |
| `automationRules` | 870 | none | `refreshToolsData` (1184) | No: tools automation UI only. |
| `automationRuns` | 873 | none | `refreshToolsData` (1184) | No: tools automation UI only. |
| `collabSession` | 876 | none | `effect@1206` (1206), `effect@1234` (1234) | Yes: pane routing, collaboration auth, and editor mounting all depend on it. |
| `collabSessionError` | 882 | none | `effect@1206` (1206), `effect@1234` (1234) | Yes: pane/doc routing resets and collaboration auth share it. |
| `pendingProjectFiles` | 883 | none | `updatePendingProjectFile` (2422), `removePendingProjectFile` (2433), `onUploadProjectFiles` (2501) | Yes: optimistic upload UI and file module rendering share it. |
| `trackedProjectFiles` | 884 | none | `refreshTrackedProjectFiles` (2380) | Yes: inspector/doc uploads refresh the same project-level file feed. |
| `pendingPaneFilesByPaneId` | 885 | none | `updatePendingPaneFile` (2408), `removePendingPaneFile` (2426), `onUploadPaneFiles` (2599) | Yes: optimistic upload UI and pane-scoped file module rendering share it. |
| `trackedPaneFilesByPaneId` | 886 | none | `refreshTrackedPaneFiles` (2385) | Yes: pane selection and pane-scoped file refresh share it. |

### State-table takeaways

- The most tangled shared state clusters are `views`/`collections`/table+kanban runtime, the entire inspector payload, doc collaboration state, and asset/file state.
- The cleanest state clusters are collaborator invite UI, overview task paging, and simple local toggles.
- Several states are technically “single concern” but are still unsafe to move early because URL sync or pane provenance decides when they reset.

## 3. High-Coupling Hotspots

### `src/pages/ProjectSpacePage.tsx`

1. `refreshViewsAndRecords` at `1037` mixes collection fetch, field preloading, view fetch, default embed-view selection, table runtime building, kanban runtime building, loading/error state, and follow-up task paging. That is data bootstrapping for at least four separate surfaces in one callback.
2. `useEffect` at `1195` mixes active-pane resolution and navigation repair. It is both state derivation and route mutation.
3. `useEffect` at `1219` mixes route-state consumption, editor focus handoff, and URL cleanup. This is a route concern and an editor concern in one effect.
4. `useEffect` at `1234` mixes pane-doc detection and collab-session authorization. It is route-driven resource acquisition.
5. `openInspector` at `1329` mixes modal state, mutation-context selection, record fetch, backlinks fetch, race cancellation, and error resetting.
6. `createAndOpenCaptureRecord` at `1397` mixes quick-capture validation, pane permission checks, collection selection, record creation, cross-surface refresh, and inspector opening.
7. `useEffect` at `1460` mixes query-param protocol handling, sessionStorage draft recovery, async record creation, and query cleanup.
8. `onUpdatePaneFromWorkView` at `1737` mixes pane mutation, optimistic local update, timeline refresh, and translated error composition.
9. `onSaveRecordField` at `1759` mixes pane permission checks, record mutation, inspector refresh, views refresh, and timeline refresh.
10. `onAddRelation` at `1822` and `onRemoveRelation` at `1868` mix relation mutation, stale-request protection, inspector refresh, views refresh, and timeline refresh.
11. `onAttachFile` at `1912` mixes file encoding, asset-root provisioning, upload, attachment creation, inspector refresh, tracked-file refresh, and timeline refresh.
12. `onUploadDocAsset` at `2149` mixes upload, editor embed handoff, tracked-file refresh, and timeline refresh.
13. `ensureProjectAssetRoot` at `2347` mixes cached state reuse, in-flight deduplication, list refresh, and asset-root creation.
14. `onUploadProjectFiles` at `2501` and `onUploadPaneFiles` at `2599` mix optimistic UI rows, progress timers, upload orchestration, asset-root provisioning, tracked-file refresh, and shared error handling.
15. `onMoveKanbanRecord` at `2714` mixes pane permission validation, kanban schema lookup, record mutation, views refresh, and timeline refresh.
16. `useEffect` at `2864` mixes overview sub-tab state and URL serialization, which makes “simple tab state” a navigation concern.
17. The inline `viewEmbedRuntime.onOpenView` handler at `3574-3598` mixes embedded-view semantics with explicit route construction for overview/work destinations.
18. `refreshProjectData` at `4047` mixes project fetch, pane fetch, timeline fetch, and member fetch, then feeds every downstream concern.
19. `useEffect` at `4074` mixes initial loading state, project bootstrap, `LAST_PROJECT_KEY` persistence, and global project-list refresh.

### `src/pages/ProjectsPage.tsx`

1. `refreshSelectedRecord` at `153` mixes modal-selection state, abort-controller lifecycle, request-versioning, and record fetch.
2. `onSaveCapture` at `301` mixes validation, direct task creation, sessionStorage draft persistence, toast/notices, modal state, and cross-route navigation handoff.
3. The live update effect at `223` mixes subscription lifecycle, home refresh, and conditional record-inspector refresh in one place.
4. Query-param effects at `88` and `104` mix route-protocol parsing (`capture`, `intent`, `task_id`) with local modal state changes.

### `src/components/layout/AppShell.tsx`

1. The effect at `279` mixes click-outside handling for three popovers plus Escape-key handling for all shell overlays.
2. `onNavigateNotification` at `424` mixes navigation, overlay dismissal, and optimistic notification mutation.
3. `navigateToCapture` at `432` mixes contextual route analysis and capture-protocol serialization.
4. The component as a whole owns layout chrome, capture routing, notifications, quick nav, and profile UI; it is both an application shell and a feature container.

### Other coupling hotspots

1. `src/features/PersonalizedDashboardPanel.tsx` at `486` mixes authz interpretation, data normalization, and rendering of three distinct dashboard modes. It is a feature coordinator, not just a panel.
2. `src/components/project-space/WorkView.tsx` at `302-626` mixes module-layout persistence, pane mutations, and lazy runtime rendering for six different module types.
3. `src/context/AuthzContext.tsx` at `98-281` mixes bootstrap branching (E2E token, dev auth, Keycloak), session fetch, refresh timers, and auth commands inside one provider.

## 4. Proposed Hook Extraction Plan

These are proposed extractions only; nothing here should be done out of order.

| Proposed hook | State it owns | Returns to component | Concerns isolated | Risk |
| --- | --- | --- | --- | --- |
| `useProjectSpaceLoader` | `project`, `panes`, `projectMembers`, `timeline`, `loading`, `error` | `project`, `panes`, `projectMembers`, `timeline`, `loading`, `error`, `refreshProjectData` | Top-level project bootstrap and refresh | Medium |
| `useProjectOverviewRouteState` | `overviewView`, `selectedOverviewKanbanViewId`, `timelineFilters` | Current overview selection, filter toggles, URL-sync helpers | Overview tab state and URL serialization | High |
| `useProjectTasksOverview` | `projectTasks`, `projectTasksLoading`, `projectTasksLoadingMore`, `projectTasksError`, sentinel ref | Task rows, loading/error flags, `loadProjectTaskPage`, sentinel ref | Overview task paging/infinite scroll | Low |
| `useProjectCalendarRuntime` | `calendarMode`, `calendarEvents`, `calendarLoading` | Calendar scope, events, loading, `refreshCalendar`, `setCalendarMode` | Calendar fetch/runtime for overview + work module | Low |
| `useProjectViewsRuntime` | `collections`, `views`, `tableViewDataById`, `tableLoading`, `kanbanRuntimeByViewId`, `kanbanLoading`, `recordsError`, `selectedEmbedViewId`, `focusedWorkViewData`, `focusedWorkViewLoading`, `focusedWorkViewError` | View registry, runtime maps, focused view data, refresh callbacks, derived view lists | Collection/view bootstrapping, table/kanban runtime, focused view state | Medium-High |
| `usePaneNavigatorUi` | `showPaneSwitcher`, `showOtherPanes`, `otherPaneQuery` | Toggle handlers, filtered pane lists, route-derived switcher visibility | Pane navigator display state only | Low-Medium |
| `usePaneMutations` | `creatingPaneName`, `paneMutationError` | Pane form state and pane mutation callbacks (`create`, `rename`, `move`, `pin`, `delete`, `toggle member`, `update from work view`) | Pane CRUD and pane-layout mutation behavior | High |
| `useProjectCollaborators` | `projectMemberMutationError`, `projectMemberMutationNotice` | Invite/add-member callback and collaborator feedback state | Collaborator invite/add flow | Low |
| `useRecordInspector` | `inspectorRecordId`, `inspectorMutationPaneId`, `inspectorRecord`, `inspectorLoading`, `inspectorError`, `inspectorCommentText`, `inspectorBacklinks`, `inspectorBacklinksLoading`, `inspectorBacklinksError`, `relationMutationError`, `removingRelationId`, `savingValues`, `uploadingAttachment`, `selectedAttachmentId` | Open/close handlers, inspector payload, relation/file/comment callbacks, mutation flags | Record inspector modal and all record-level CRUD | High |
| `useWorkspaceDocRuntime` | `docComments`, `orphanedDocComments`, `showResolvedDocComments`, `docCommentComposerOpen`, `docCommentText`, `selectedDocNodeKey`, `uploadingDocAsset`, `pendingDocAssetEmbed`, `pendingDocMentionInsert`, `pendingViewEmbedInsert`, `pendingDocFocusNodeKey`, `collabSession`, `collabSessionError` | Comment data, editor callbacks, pending insert/focus bridges, collab session state | Workspace doc comments, collaboration auth, editor handoffs, route-focus bridging | High |
| `useProjectToolsRuntime` | `assetRoots`, `assetEntries`, `assetWarning`, `newAssetRootPath`, `automationRules`, `automationRuns` | Asset-root CRUD/listing, automation CRUD, tooling refresh callbacks | Tools tab data and tooling mutations | Medium |
| `useProjectFilesRuntime` | `pendingProjectFiles`, `trackedProjectFiles`, `pendingPaneFilesByPaneId`, `trackedPaneFilesByPaneId` | Project/pane files, upload handlers, refresh callbacks, combined derived file lists | File uploads, optimistic file UI, tracked-file refresh | Medium-High |
| `useProjectSpaceRouteSync` | Minimal owned state; orchestrates route-derived writes into other hooks | Capture protocol handlers, focus-node sync, active-pane redirects, search-param cleanup helpers | Navigation effects and route-state coordination | High |

### Notes on hook boundaries

- `useProjectOverviewRouteState` should stay separate from `useProjectTasksOverview` and `useProjectCalendarRuntime`; those can be extracted without changing URL semantics.
- `useProjectToolsRuntime` should not own `ensureProjectAssetRoot` unless file uploads move with it; that function currently couples tools state to upload flows.
- `useRecordInspector` is the right place to hide repeated “mutate -> refresh inspector -> refresh views -> refresh timeline” sequences, but it should probably be split internally later into smaller hooks (`fields`, `relations`, `attachments`, `comments`).
- `useWorkspaceDocRuntime` should wrap the editor-facing handoff protocol (`pending*` insert/focus state), not just raw comments.

## 5. Safe vs. Risky Extraction Order

### Independent and relatively safe

1. `useProjectCollaborators`
2. `useProjectCalendarRuntime`
3. `useProjectTasksOverview`
4. `usePaneNavigatorUi`
5. `useProjectToolsRuntime` for read/list behavior first, keeping upload-dependent asset-root creation out until later

These are safest because they have narrow state, few external dependencies, and little or no route mutation behavior.

### Moderate risk, but still manageable with good tests

1. `useProjectSpaceLoader`
2. `useProjectViewsRuntime`
3. `useProjectFilesRuntime`

Sequence matters here:

- Extract `useProjectSpaceLoader` before anything that still expects `refreshProjectData` from the outer component.
- Extract `useProjectViewsRuntime` before `useWorkspaceDocRuntime`, because doc embeds and focused work views depend on the shared `views` registry.
- Extract `useProjectToolsRuntime` or a dedicated `useProjectAssetRoots` boundary before `useProjectFilesRuntime`, because uploads rely on `ensureProjectAssetRoot`.

### High-risk / sequence-sensitive

1. `usePaneMutations`
2. `useRecordInspector`
3. `useWorkspaceDocRuntime`
4. `useProjectSpaceRouteSync`

Why these are dangerous:

- `usePaneMutations` currently updates local pane state, triggers navigation, and refreshes timeline/project data in the same callbacks.
- `useRecordInspector` shares one mutable record payload across fields, comments, relations, attachments, backlinks, and activity; moving it carelessly can break stale-request protection.
- `useWorkspaceDocRuntime` depends on active pane/doc routing, collab authorization, editor handoff state, and file/timeline refresh behavior.
- `useProjectSpaceRouteSync` is last because it is where navigation loops can be introduced.

### Navigation and route-state effects that should be treated as high risk

- `src/pages/ProjectSpacePage.tsx:1195` — auto-redirects work routes to an active pane; easy to introduce replace-loop bugs.
- `src/pages/ProjectSpacePage.tsx:1219` — consumes `location.state` and `focus_node_key`, writes editor focus state, then rewrites the URL.
- `src/pages/ProjectSpacePage.tsx:1460` — consumes the `capture` protocol, reads sessionStorage, creates records asynchronously, then cleans query params.
- `src/pages/ProjectSpacePage.tsx:2822-2876` — keeps overview substate and URL query params in sync; very easy to clobber params from another surface.
- `src/pages/ProjectsPage.tsx:88-115` — uses query params as a modal/inspector protocol.
- `src/components/layout/AppShell.tsx:432-448` — encodes contextual capture routing in the shell.

All of these are high risk because they both derive state from the URL and mutate the URL back. If extraction changes effect timing or dependency arrays, the likely failures are duplicate navigations, stale query cleanup, broken deep links, or lost work context.

## 6. Cross-File Coupling

### Page/components directly importing and calling logic that should move behind hooks/services

| File | Direct coupling | Why it should move |
| --- | --- | --- |
| `src/pages/ProjectSpacePage.tsx` | Imports a large surface from `hubContractApi` and performs nearly all project-space mutations inline | This page is acting as page, service coordinator, mutation workflow engine, and route-state machine at once |
| `src/pages/ProjectsPage.tsx` | Calls `createHubProject`, `createPersonalTask`, `getHubHome`, `getRecordDetail`, and `subscribeHubLive` directly | Missing hooks like `useHubHome`, `useProjectCreation`, `useHubRecordInspector`, `useProjectCaptureRouting` |
| `src/components/layout/AppShell.tsx` | Calls `listNotifications`, `markNotificationRead`, and `subscribeHubLive` directly | The shell is taking on feature-specific notification data orchestration instead of using `useNotifications` |
| `src/components/project-space/MentionPicker.tsx` | Calls `searchMentionTargets` inside the UI component | Search/data lifecycle should be isolated so the picker is a dumb view + callbacks |
| `src/components/project-space/RelationPicker.tsx` | Calls `searchRelationRecords` directly | Same issue: relation search should be a hook so keyboard UI is separate from fetch lifecycle |
| `src/components/project-space/ViewEmbedBlock.tsx` | Calls `queryView` directly | Embedded-view runtime should be provided via a hook/context, not fetched ad hoc in the renderer |

### Route/navigation logic duplicated across files

1. Capture routing is spread across `src/components/layout/AppShell.tsx:432-448`, `src/pages/ProjectsPage.tsx:88-115` and `301-360`, and `src/pages/ProjectSpacePage.tsx:1460-1514`. That protocol should be centralized into one hook or route helper.
2. Work/overview navigation strings are built manually in multiple places inside `src/pages/ProjectSpacePage.tsx`, even though `src/lib/hubRoutes.ts` already centralizes some entity-to-route mapping.
3. The focused-view protocol (`view_id`) lives partly in `src/pages/ProjectSpacePage.tsx:2448-2499`, partly in inline JSX handlers at `3467-3471`, and partly in doc-embed navigation logic at `3574-3598`.

### Components that already have the right shape

- `src/components/project-space/BacklinksPanel.tsx`
- `src/components/project-space/TableModuleSkin.tsx`
- `src/components/project-space/RelationsSection.tsx` except for the nested `RelationPicker`
- Most `src/components/ui/*` and `src/components/primitives/*`

These are mostly presentational or narrowly scoped wrappers and are not the main decomposition risk.

## 7. Recommended Sequencing of Extractions

Ordered from safest to most dangerous:

1. Extract `useProjectCollaborators`
2. Extract `useProjectCalendarRuntime`
3. Extract `useProjectTasksOverview`
4. Extract `usePaneNavigatorUi`
5. Extract `useProjectToolsRuntime` for automation and asset-list read flows
6. Extract `useProjectSpaceLoader`
7. Extract `useProjectViewsRuntime`
8. Split asset-root creation into `useProjectAssetRoots` or move it into `useProjectFilesRuntime`
9. Extract `useProjectFilesRuntime`
10. Extract `usePaneMutations`
11. Extract `useRecordInspector`
12. Extract `useWorkspaceDocRuntime`
13. Extract `useProjectOverviewRouteState`
14. Extract `useProjectSpaceRouteSync`

The logic behind this order is simple:

- Start with isolated data/runtime hooks that do not write navigation state.
- Pull shared loaders before feature hooks that depend on them.
- Defer anything that coordinates `navigate`, `searchParams`, `sessionStorage`, pane provenance, or editor focus until the end.

## 8. Detailed Refactor Plan: Cohesion vs Separation of Concerns

This section is intentionally planning-only. It describes how to refactor the current architecture so a bug fix in one area does not accidentally invalidate navigation, editor state, uploads, or unrelated UI surfaces.

### Architecture rule set

#### What should remain cohesive

Keep these responsibilities together because splitting them too early would create more coordination code than value:

1. Route shells
   - `ProjectsPage` should remain the route-level shell for the Hub home screen.
   - `ProjectSpacePage` should remain the route-level shell for `/projects/:projectId/*`.
   - Their job after refactoring should be composition only: route params, auth gating, high-level feature assembly.

2. Bounded runtime state per feature surface
   - Record inspector state should remain cohesive inside one feature hook/module because fields, relations, attachments, comments, backlinks, and activity all operate on the same loaded record.
   - Workspace doc runtime should remain cohesive inside one feature hook/module because comments, collaboration session, pending embed/mention inserts, node focus, and editor lifecycle all operate on the same pane doc.
   - View runtime should remain cohesive inside one feature hook/module because collections, views, table runtimes, kanban runtimes, and focused view data are all one cached graph.

3. App-level auth/session orchestration
   - `AuthzContext` should remain the single place that answers “who is the user?” and “what are they allowed to do?”.
   - It can be refactored internally, but the app should not gain multiple competing sources of session truth.

4. Shell layout ownership
   - `AppShell` should remain responsible for layout frame, toolbar placement, and overlay anchoring.
   - What it should not own is feature-specific data fetching or route-protocol logic.

#### What should be separated

These are the boundaries that currently leak into each other and should be split:

1. Route protocol vs feature behavior
   - Capture routing, focused-view routing, overview sub-tab routing, pane repair redirects, and doc focus routing should not be embedded inside feature callbacks.
   - One route-sync layer should own URL parsing and URL writes.

2. Data fetching vs UI widgets
   - `MentionPicker`, `RelationPicker`, `ViewEmbedBlock`, and notification UI inside `AppShell` should not fetch data directly.
   - UI widgets should receive data/callbacks from hooks or context providers.

3. Mutation orchestration vs rendering
   - Callbacks that do `mutate -> refetch -> refresh timeline -> clean URL -> update modal` should move behind feature hooks.
   - JSX should call feature-intent callbacks, not inline workflows.

4. Upload pipeline vs tools listing
   - Asset-root management and file uploads should not share incidental state unless the coupling is explicit.
   - “List asset roots in Tools” and “provision an asset root during upload” are related, but not the same concern.

5. Global invalidation vs local mutation
   - Refreshing timeline, views, files, members, and project data after every mutation should become explicit invalidation helpers owned by a feature layer.
   - A bug fix in relation removal should not require knowledge of file runtime state.

### Refactor target shape

The safest target architecture is:

- Route shells
  - `ProjectsPage`
  - `ProjectSpacePage`

- Feature coordinators/hooks
  - `useHubHome`
  - `useProjectCaptureRouting`
  - `useProjectSpaceLoader`
  - `useProjectViewsRuntime`
  - `useRecordInspector`
  - `useWorkspaceDocRuntime`
  - `useProjectFilesRuntime`
  - `useProjectToolsRuntime`
  - `useNotifications`
  - `useAppCaptureNavigation`

- Mostly presentational components
  - `PersonalizedDashboardPanel`
  - `WorkView`
  - `AutomationBuilder`
  - `FilesModuleSkin`
  - `MentionPicker`
  - `RelationPicker`
  - `ViewEmbedBlock`

The key idea is: route shells compose feature hooks, and feature hooks expose stable intent-based APIs to presentational components.

## 9. Phase-by-Phase Refactor Program

### Phase 0: Stabilize public boundaries before moving logic

Goal: reduce blast radius before extraction.

Apply these constraints first:

1. Keep the exported component names stable
   - Keep exporting `ProjectsPage`, `ProjectSpacePage`, `AppShell`, and `PersonalizedDashboardPanel`.
   - This avoids route-level and import-level churn during early refactors.

2. Add no-op seam modules before moving behavior
   - Example future files:
     - `src/features/projects/useHubHome.ts`
     - `src/features/project-space/useProjectSpaceLoader.ts`
     - `src/features/project-space/useProjectViewsRuntime.ts`
     - `src/features/project-space/useRecordInspector.ts`
     - `src/features/project-space/useWorkspaceDocRuntime.ts`
   - Even if these initially delegate back into existing logic, they create a stable destination.

3. Centralize protocol names
   - Capture route keys, focused-view keys, and doc-focus keys should be defined in one module.
   - Today these are string literals spread across `AppShell`, `ProjectsPage`, `ProjectSpacePage`, and `hubRoutes`.

Why this phase matters:

- It makes future patches small and mechanical.
- It preserves call sites while internals move.

### Phase 1: Extract low-risk data/runtime hooks

Move first:

1. `useProjectCollaborators`
2. `useProjectCalendarRuntime`
3. `useProjectTasksOverview`
4. `usePaneNavigatorUi`
5. `useProjectToolsRuntime` for tooling read/list logic only

Expected blast radius:

- Local to `ProjectSpacePage.tsx`
- Mostly import updates and prop plumbing
- Minimal route risk

Why this is safe:

- These slices do not own URL writes.
- They have narrow mutable state.
- They can be tested in isolation without recreating full page routing.

### Phase 2: Extract shared data loaders and caches

Move next:

1. `useProjectSpaceLoader`
2. `useProjectViewsRuntime`
3. `useHubHome`
4. `useNotifications`

Expected blast radius:

- `ProjectSpacePage.tsx`
- `ProjectsPage.tsx`
- `AppShell.tsx`

Why this is the right middle phase:

- These hooks reduce the number of places that know how to fetch core project/home data.
- They replace ad hoc refresh fan-out with explicit feature-owned refresh methods.

### Phase 3: Extract mutation engines

Move after caches/loaders are stable:

1. `useProjectFilesRuntime`
2. `usePaneMutations`
3. `useRecordInspector`
4. `useWorkspaceDocRuntime`

Expected blast radius:

- `ProjectSpacePage.tsx`
- `WorkView.tsx`
- `AutomationBuilder.tsx`
- `FilesModuleSkin.tsx`
- `CollaborativeLexicalEditor.tsx`
- relation/comment/mention supporting components

Why this is higher risk:

- These modules currently own optimistic UI, mutation retries, timeline refreshes, and stale-request protection.
- If extracted before data/runtime boundaries exist, they will just re-import the same tangle elsewhere.

### Phase 4: Extract route-sync and protocol handling last

Move last:

1. `useProjectSpaceRouteSync`
2. `useProjectCaptureRouting`
3. `useAppCaptureNavigation`

Expected blast radius:

- `AppShell.tsx`
- `ProjectsPage.tsx`
- `ProjectSpacePage.tsx`
- `hubRoutes.ts`

Why this must be last:

- These are the most timing-sensitive effects in the app.
- They currently clean URL state, recover sessionStorage drafts, redirect to fallback panes, and preserve editor focus.
- Any dependency mistake here can cause navigation loops or broken deep links.

## 10. File-by-File Plan, Call Sites, and Patch Map

This section answers three questions for each high-risk file:

1. Where is it currently called/imported?
2. After refactoring, what should stay cohesive vs be separated?
3. What patches would need to be applied downstream?

### `src/pages/ProjectSpacePage.tsx`

#### Current call sites

- `src/App.tsx:14-16` lazy-imports the page module.
- `src/App.tsx:74` renders `<ProjectSpacePage activeTab="overview" />`
- `src/App.tsx:84` renders `<ProjectSpacePage activeTab="work" />`
- `src/App.tsx:94` renders `<ProjectSpacePage activeTab="work" />`
- `src/App.tsx:104` renders `<ProjectSpacePage activeTab="tools" />`

#### What should stay cohesive

- Route-shell composition for project routes
- Final assembly of:
  - loader output
  - overview runtime
  - work runtime
  - tools runtime
  - inspector
  - workspace doc

#### What should be separated

- Project bootstrap/loading
- View runtime loading and cache maintenance
- Pane mutations
- Record inspector mutation workflows
- Workspace doc runtime and collaboration lifecycle
- Files runtime
- Route/query-param synchronization

#### Planned downstream patches after refactor

Recommended low-blast patch strategy:

1. Preserve the exported name `ProjectSpacePage`
   - Patch required in `src/App.tsx`: none if export stays stable.

2. Replace internal monolith sections with feature hooks
   - Patch inside `src/pages/ProjectSpacePage.tsx`:
     - add hook imports
     - replace large state blocks with hook results
     - keep returned JSX shape initially identical

3. Move route protocol handling to a dedicated hook last
   - Patch inside `src/pages/ProjectSpacePage.tsx` only
   - No route-level patch in `src/App.tsx` if props stay the same

4. Once stable, optionally split the page shell from the route export
   - Future patch in `src/App.tsx` only if the route export changes from `ProjectSpacePage` to something like `ProjectSpaceRoute`
   - This is optional and should not be phase 1

#### Bug-isolation payoff

- Pane bugs stop affecting editor state
- Inspector bugs stop affecting overview/task/calendar runtime
- File-upload bugs stop sharing error channels with kanban/runtime loading
- Route-protocol bugs become testable without booting the entire project workspace

### `src/pages/ProjectsPage.tsx`

#### Current call sites

- `src/App.tsx:9-11` lazy-imports the page module.
- `src/App.tsx:65` renders `<ProjectsPage />`

#### What should stay cohesive

- Hub home route-shell composition
- Final layout of:
  - dashboard panel
  - project creation card
  - projects list
  - capture dialog
  - record inspector modal

#### What should be separated

- Hub home fetch/live refresh
- project creation workflow
- capture protocol handling
- record inspector fetch lifecycle

#### Planned downstream patches after refactor

1. Preserve the exported name `ProjectsPage`
   - Patch required in `src/App.tsx`: none if export stays stable.

2. Extract `useHubHome`
   - Patch inside `src/pages/ProjectsPage.tsx`:
     - replace `refreshHome`, live subscription effect, and home state with hook result

3. Extract `useProjectCreation`
   - Patch inside `src/pages/ProjectsPage.tsx`:
     - replace `name`, `creating`, `createError`, `onCreateProject`

4. Extract `useProjectCaptureRouting`
   - Patch inside:
     - `src/pages/ProjectsPage.tsx`
     - later `src/components/layout/AppShell.tsx`
     - later `src/pages/ProjectSpacePage.tsx`

5. Extract `useHubRecordInspector`
   - Patch inside `src/pages/ProjectsPage.tsx` only if modal JSX stays there
   - Alternative: patch to mount `<HubRecordInspectorDialog />` child and pass hook result

#### Bug-isolation payoff

- Hub home refresh bugs stop affecting project creation
- capture bugs stop affecting modal inspector behavior
- record inspector fetch bugs stop affecting dashboard refresh

### `src/components/layout/AppShell.tsx`

#### Current call sites

- `src/App.tsx:3` imports `AppShell`
- `src/App.tsx:57` renders `<AppShell>{...routes...}</AppShell>`

#### What should stay cohesive

- Layout frame
- toolbar positioning
- overlay anchoring
- local open/close state for shell surfaces

#### What should be separated

- notifications data fetching/subscription
- contextual capture navigation protocol
- quick-nav filtering logic if it grows further

#### Planned downstream patches after refactor

1. Preserve `AppShell` export
   - Patch required in `src/App.tsx`: none if export stays stable.

2. Extract `useNotifications`
   - Patch inside `src/components/layout/AppShell.tsx`:
     - remove direct `listNotifications`, `markNotificationRead`, `subscribeHubLive` orchestration
     - replace with hook return values and intent callbacks

3. Extract `useAppCaptureNavigation`
   - Patch inside `src/components/layout/AppShell.tsx`
   - Later patch in `src/pages/ProjectsPage.tsx` and `src/pages/ProjectSpacePage.tsx` to share the same route protocol module

4. Extract `useShellOverlays`
   - Patch inside `src/components/layout/AppShell.tsx` to centralize click-outside and Escape handling without moving layout markup

#### Bug-isolation payoff

- Notification bugs stop risking toolbar navigation behavior
- capture-route bugs stop leaking into shell overlay state
- shell layout fixes stop touching websocket logic

### `src/features/PersonalizedDashboardPanel.tsx`

#### Current call sites

- `src/pages/ProjectsPage.tsx:8` imports `PersonalizedDashboardPanel`
- `src/pages/ProjectsPage.tsx:392` renders `<PersonalizedDashboardPanel ... />`

#### What should stay cohesive

- Dashboard panel presentation
- view switching between daily brief / project lens / stream

#### What should be separated

- task/event normalization
- capability-based available-view calculation
- large per-view subcomponents if they keep growing

#### Planned downstream patches after refactor

1. Preserve `PersonalizedDashboardPanel` export
   - Patch required in `src/pages/ProjectsPage.tsx`: none if prop API stays stable.

2. Extract normalization helpers or `useDashboardItems`
   - Patch inside `src/features/PersonalizedDashboardPanel.tsx` only

3. Extract capability filtering into `useDashboardAvailability`
   - Patch inside `src/features/PersonalizedDashboardPanel.tsx` only

4. If view subcomponents get moved out
   - Patch imports within `src/features/PersonalizedDashboardPanel.tsx`
   - No external call-site patch needed if props stay stable

#### Bug-isolation payoff

- Capability logic bugs stop affecting item formatting
- Stream view changes stop risking daily brief grouping

### `src/components/project-space/WorkView.tsx`

#### Current call sites

- `src/pages/ProjectSpacePage.tsx:85` imports `WorkView`
- `src/pages/ProjectSpacePage.tsx:3518` renders `<WorkView ... />`

#### What should stay cohesive

- Module-grid rendering
- pane-level module layout presentation
- module runtime delegation

#### What should be separated

- Pane-layout persistence (`saveModules`, `runPaneUpdate`)
- pane header editing actions
- runtime binding selection logic if it keeps growing

#### Planned downstream patches after refactor

1. Extract `usePaneModuleLayout`
   - Patch inside `src/components/project-space/WorkView.tsx`
   - No caller patch if prop API stays the same

2. Extract `PaneHeaderEditor`
   - Patch inside `src/components/project-space/WorkView.tsx`
   - No caller patch if mounted internally

3. Optional future patch in `src/pages/ProjectSpacePage.tsx`
   - If `WorkView` becomes a thinner presentational component, the page may pass more pre-shaped props and fewer mutation callbacks

#### Bug-isolation payoff

- Module-layout bugs stop risking pane-name/pin controls
- rendering bugs in one module type stop affecting pane persistence code

### `src/components/project-space/AutomationBuilder.tsx`

#### Current call sites

- `src/pages/ProjectSpacePage.tsx:83` imports `AutomationBuilder`
- `src/pages/ProjectSpacePage.tsx:3776` renders `<AutomationBuilder ... />`

#### What should stay cohesive

- Automation-builder UI
- rule-editing form interactions

#### What should be separated

- form-state machine
- rule save/delete/toggle workflow helpers
- run-history formatting if it grows

#### Planned downstream patches after refactor

1. Internal-only refactor first
   - Patch inside `src/components/project-space/AutomationBuilder.tsx`
   - No caller patch if public props stay stable

2. If split into subcomponents
   - Patch only internal imports initially
   - Keep `AutomationBuilder` as façade so `ProjectSpacePage` does not change

#### Bug-isolation payoff

- Form validation bugs stop risking run-history display

### `src/components/project-space/FilesModuleSkin.tsx`

#### Current call sites

- `src/pages/ProjectSpacePage.tsx:87` imports the `FilesModuleItem` type
- `src/components/project-space/WorkView.tsx:6` imports the `FilesModuleItem` type
- `src/components/project-space/WorkView.tsx:133-135` lazy-imports `FilesModuleSkin`
- `src/components/project-space/WorkView.tsx:582` renders `<FilesModuleSkin ... />`

#### What should stay cohesive

- File-module rendering
- sorting/filtering interactions
- upload dropzone UX

#### What should be separated

- upload-progress animation internals
- row rendering
- filter/sort utilities

#### Planned downstream patches after refactor

1. Split purely internal helpers first
   - Patch inside `src/components/project-space/FilesModuleSkin.tsx`
   - No caller patch if prop API stays stable

2. Keep `FilesModuleItem` in a stable shared type module
   - If moved, apply patch in:
     - `src/pages/ProjectSpacePage.tsx`
     - `src/components/project-space/WorkView.tsx`
   - Best target would be `src/components/project-space/types.ts` or a dedicated files-runtime types file

3. Keep `FilesModuleSkin` export stable during early phases
   - No patch needed in `WorkView.tsx` if the lazy import target stays the same

#### Bug-isolation payoff

- Dropzone or progress animation bugs stop touching file list sort/filter code

### `src/features/notes/CollaborativeLexicalEditor.tsx`

#### Current call sites

- `src/pages/ProjectSpacePage.tsx:110-112` lazy-imports `CollaborativeLexicalEditor`
- `src/pages/ProjectSpacePage.tsx:3546` renders `<CollaborativeLexicalEditor ... />`

#### What should stay cohesive

- Editor composition
- collaboration provider lifecycle
- editor plugin registration

#### What should be separated

- Yjs/WebSocket provider lifecycle helper
- embed insertion plugins
- focus/selection tracking plugins
- presence status adapter

#### Planned downstream patches after refactor

1. Internal plugin extraction first
   - Patch inside `src/features/notes/CollaborativeLexicalEditor.tsx`
   - No caller patch if prop API stays stable

2. Extract collaboration provider factory
   - Patch inside `src/features/notes/CollaborativeLexicalEditor.tsx`
   - No caller patch if `CollaborativeLexicalEditor` still accepts the same session props

3. Optional future patch in `src/pages/ProjectSpacePage.tsx`
   - If workspace doc runtime gets stronger ownership, page may pass a single `editorRuntime` object instead of many individual props

#### Bug-isolation payoff

- Presence or focus bugs stop risking provider connection behavior
- embed insertion bugs stop risking editor bootstrapping

### `src/components/project-space/MentionPicker.tsx`

#### Current call sites

- `src/pages/ProjectSpacePage.tsx:78` imports `MentionPicker`
- `src/pages/ProjectSpacePage.tsx:3605` renders `MentionPicker` for doc insertion
- `src/pages/ProjectSpacePage.tsx:3971` renders `MentionPicker` for record comments
- `src/components/project-space/CommentComposer.tsx:2` imports `MentionPicker`
- `src/components/project-space/CommentComposer.tsx:57` renders `MentionPicker`

#### What should stay cohesive

- picker popover UI
- query input UX

#### What should be separated

- mention search fetching
- debounce/cancellation behavior

#### Planned downstream patches after refactor

Recommended least-risk path:

1. Extract `useMentionTargets` but keep `MentionPicker` public API the same
   - Patch inside `src/components/project-space/MentionPicker.tsx` only
   - No caller patch needed

Alternative stricter separation path:

2. Make `MentionPicker` purely presentational
   - Caller patches required in:
     - `src/pages/ProjectSpacePage.tsx`
     - `src/components/project-space/CommentComposer.tsx`
   - Not recommended as the first move because it widens churn

#### Bug-isolation payoff

- Search API bugs stop leaking into popover interaction code

### `src/components/project-space/RelationPicker.tsx`

#### Current call sites

- `src/components/project-space/RelationsSection.tsx:1` imports `RelationPicker`
- `src/components/project-space/RelationsSection.tsx:38` renders `<RelationPicker ... />`
- `src/pages/ProjectSpacePage.tsx:86` imports the `RelationFieldOption` type

#### What should stay cohesive

- relation picker UI
- keyboard-accessible selection behavior

#### What should be separated

- relation search fetching
- submission workflow state

#### Planned downstream patches after refactor

1. Extract `useRelationSearch`
   - Patch inside `src/components/project-space/RelationPicker.tsx`
   - No caller patch if public props stay stable

2. If `RelationFieldOption` type moves
   - Patch required in:
     - `src/components/project-space/RelationsSection.tsx`
     - `src/pages/ProjectSpacePage.tsx`

#### Bug-isolation payoff

- Search/result bugs stop risking keyboard navigation logic

### `src/components/project-space/ViewEmbedBlock.tsx`

#### Current call sites

- `src/features/notes/nodes/ViewRefNode.tsx:10` imports `ViewEmbedBlock`
- `src/features/notes/nodes/ViewRefNode.tsx:69` renders `<ViewEmbedBlock ... />`

#### What should stay cohesive

- Embedded-view rendering
- compact vs expanded preview behavior

#### What should be separated

- `queryView` fetch lifecycle
- kanban preview data shaping

#### Planned downstream patches after refactor

1. Extract `useViewEmbedData`
   - Patch inside `src/components/project-space/ViewEmbedBlock.tsx`
   - No caller patch if props stay stable

2. If embed runtime becomes fully context-owned
   - Patch may be needed in `src/features/notes/nodes/ViewRefNode.tsx` only if the block export or required props change

#### Bug-isolation payoff

- Embedded query bugs stop risking rendering of the Lexical node wrapper

## 11. How This Reduces Bug Blast Radius

### Current failure pattern

Today, one mutation often has to know too much:

- save a field
- refresh inspector
- refresh views
- refresh timeline
- preserve pane provenance
- maybe preserve route state

That means a local fix can easily regress another surface.

### Target failure containment

After refactoring, a bug should ideally be contained to one bounded context:

1. Route bug
   - confined to route-sync hooks and route helper modules

2. Data loading bug
   - confined to one feature runtime hook (`useHubHome`, `useProjectViewsRuntime`, `useNotifications`)

3. Mutation bug
   - confined to one mutation engine (`useRecordInspector`, `usePaneMutations`, `useProjectFilesRuntime`)

4. Rendering bug
   - confined to presentational components (`PersonalizedDashboardPanel`, `FilesModuleSkin`, `AutomationBuilder`, `WorkView`)

5. Editor/plugin bug
   - confined to `useWorkspaceDocRuntime` or editor plugin modules, not route handling

### The key design principle

Fixes should cross boundaries only through explicit inputs/outputs:

- route shell passes params into a feature hook
- feature hook returns data and intent callbacks
- presentational component renders and emits UI intents

Once that rule is in place, bugs in one feature surface stop having “crazy system impacts” because unrelated concerns no longer share the same callback bodies, effect timing, and error channels.
