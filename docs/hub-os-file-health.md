# Hub OS File Health

This report ranks audited files by change friction using a composite of line count (`loc`, excluding blank/comment-only lines), responsibility count (1-5), `useEffect` count, state-hook count (`useState`/`useReducer`), import breadth, and export count. Tiers are judgment-based using the requested thresholds (Critical to Healthy), with size treated as one signal rather than the only signal.

| File path | Line count | Responsibility count | Effect count | State var count | Health tier | One-sentence justification |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `src/components/layout/AppShell.tsx` | 1910 | 5 | 18 | 26 | Critical | Critical change friction due to very high size (1910 LOC), high responsibility scope (5/5), 18 effects, 26 state hooks, broad import surface (29). |
| `src/pages/ProjectSpacePage.tsx` | 2017 | 5 | 8 | 6 | Critical | Critical change friction due to very high size (2017 LOC), high responsibility scope (5/5), 8 effects, 6 state hooks, broad import surface (32). |
| `apps/hub-api/hub-api.mjs` | 3801 | 5 | 0 | 0 | Critical | Critical change friction due to very high size (3801 LOC), high responsibility scope (5/5), broad import surface (27). |
| `src/components/project-space/TableWidgetSkin.tsx` | 1345 | 4 | 2 | 4 | Critical | Critical change friction due to very high size (1345 LOC), high responsibility scope (4/5). |
| `src/features/PersonalizedDashboardPanel.tsx` | 1130 | 5 | 4 | 5 | Red | High change friction due to large size (1130 LOC), high responsibility scope (5/5), 4 effects. |
| `src/components/project-space/KanbanWidgetSkin.tsx` | 1127 | 4 | 5 | 6 | Red | High change friction due to large size (1127 LOC), high responsibility scope (4/5), 5 effects, 6 state hooks. |
| `src/components/project-space/CalendarWidgetSkin.tsx` | 935 | 4 | 3 | 9 | Red | High change friction due to large size (935 LOC), high responsibility scope (4/5), 3 effects, 9 state hooks. |
| `apps/hub-api/routes/collections.mjs` | 1175 | 3 | 0 | 0 | Red | High change friction due to large size (1175 LOC), mixed responsibilities (3/5). |
| `src/lib/nlp/reminder-parser/utils.ts` | 1077 | 4 | 0 | 0 | Red | High change friction due to large size (1077 LOC), high responsibility scope (4/5). |
| `src/lib/calendar-nlp/passes/chronoPass.ts` | 1148 | 3 | 0 | 0 | Red | High change friction due to large size (1148 LOC), mixed responsibilities (3/5). |
| `src/components/project-space/TasksTab.tsx` | 926 | 4 | 2 | 4 | Red | High change friction due to large size (926 LOC), high responsibility scope (4/5). |
| `src/hooks/useProjectViewsRuntime.ts` | 816 | 4 | 3 | 4 | Red | High change friction due to large size (816 LOC), high responsibility scope (4/5), 3 effects. |
| `src/lib/nlp/task-parser/utils.ts` | 914 | 4 | 0 | 0 | Red | High change friction due to large size (914 LOC), high responsibility scope (4/5). |
| `src/features/QuickCapture.tsx` | 751 | 3 | 6 | 4 | Yellow | Higher change friction due to mid-large size (751 LOC), mixed responsibilities (3/5), 6 effects. |
| `src/features/notes/CollaborativeLexicalEditor.tsx` | 507 | 4 | 11 | 1 | Yellow | Higher change friction due to mid-large size (507 LOC), high responsibility scope (4/5), 11 effects, broad import surface (24). |
| `src/hooks/useWorkspaceDocRuntime.ts` | 675 | 3 | 7 | 5 | Yellow | Higher change friction due to mid-large size (675 LOC), mixed responsibilities (3/5), 7 effects. |
| `src/components/project-space/CalendarDayView.tsx` | 743 | 3 | 3 | 2 | Yellow | Higher change friction due to mid-large size (743 LOC), mixed responsibilities (3/5), 3 effects. |
| `src/components/project-space/TasksWidgetSkin.tsx` | 610 | 4 | 0 | 9 | Yellow | Higher change friction due to mid-large size (610 LOC), high responsibility scope (4/5), 9 state hooks. |
| `src/services/hub/records.ts` | 777 | 3 | 0 | 0 | Yellow | Higher change friction due to mid-large size (777 LOC), mixed responsibilities (3/5). |
| `src/hooks/useRecordInspector.ts` | 642 | 3 | 1 | 5 | Yellow | Higher change friction due to mid-large size (642 LOC), mixed responsibilities (3/5). |
| `src/components/project-space/OverviewView.tsx` | 513 | 4 | 0 | 7 | Yellow | Higher change friction due to mid-large size (513 LOC), high responsibility scope (4/5), 7 state hooks. |
| `apps/hub-api/db/statements.mjs` | 760 | 2 | 0 | 0 | Yellow | Higher change friction due to mid-large size (760 LOC). |
| `src/components/project-space/WorkView.tsx` | 570 | 3 | 1 | 3 | Yellow | Higher change friction due to mid-large size (570 LOC), mixed responsibilities (3/5). |
| `src/components/project-space/RemindersWidgetSkin.tsx` | 562 | 3 | 2 | 2 | Yellow | Higher change friction due to mid-large size (562 LOC), mixed responsibilities (3/5). |
| `apps/hub-api/routes/docs.mjs` | 723 | 2 | 0 | 0 | Yellow | Higher change friction due to mid-large size (723 LOC). |
| `apps/hub-api/db/schema.mjs` | 703 | 2 | 0 | 0 | Yellow | Higher change friction due to mid-large size (703 LOC). |
| `apps/hub-api/routes/files.mjs` | 704 | 2 | 0 | 0 | Yellow | Higher change friction due to mid-large size (704 LOC). |
| `apps/hub-api/db/migrations.mjs` | 654 | 2 | 0 | 0 | Yellow | Higher change friction due to mid-large size (654 LOC). |
| `src/components/project-space/FileInspectorActionBar.tsx` | 320 | 3 | 6 | 6 | Yellow | Higher change friction due to moderate size (320 LOC), mixed responsibilities (3/5), 6 effects, 6 state hooks. |
| `src/components/project-space/FilesWidgetSkin.tsx` | 572 | 2 | 1 | 1 | Yellow | Higher change friction due to mid-large size (572 LOC). |
| `src/components/primitives/Icon.tsx` | 519 | 3 | 0 | 0 | Yellow | Higher change friction due to mid-large size (519 LOC), mixed responsibilities (3/5). |
| `src/lib/calendar-nlp/passes/recurrencePass.ts` | 569 | 2 | 0 | 0 | Yellow | Higher change friction due to mid-large size (569 LOC). |
| `apps/hub-api/routes/views.mjs` | 542 | 2 | 0 | 0 | Yellow | Higher change friction due to mid-large size (542 LOC). |
| `apps/hub-api/routes/projects.mjs` | 535 | 2 | 0 | 0 | Yellow | Higher change friction due to mid-large size (535 LOC). |
| `src/pages/ProjectsPage.tsx` | 287 | 2 | 7 | 2 | Yellow | Higher change friction due to 7 effects. |
| `src/context/SmartWakeContext.tsx` | 234 | 2 | 5 | 3 | Yellow | Higher change friction due to 5 effects. |
| `src/hooks/useRemindersRuntime.ts` | 133 | 2 | 5 | 1 | Yellow | Higher change friction due to 5 effects. |
| `src/components/primitives/index.ts` | 52 | 3 | 0 | 0 | Yellow | Higher change friction due to mixed responsibilities (3/5), broad import surface (21). |
| `src/components/project-space/TaskCreateDialog.tsx` | 421 | 3 | 3 | 5 | Watch | Change risk is moderate due to moderate size (421 LOC), mixed responsibilities (3/5), 3 effects. |
| `src/components/project-space/AutomationBuilder.tsx` | 491 | 3 | 0 | 6 | Watch | Change risk is moderate due to moderate size (491 LOC), mixed responsibilities (3/5), 6 state hooks. |
| `src/hooks/useProjectFilesRuntime.ts` | 437 | 3 | 4 | 1 | Watch | Change risk is moderate due to moderate size (437 LOC), mixed responsibilities (3/5), 4 effects. |
| `src/components/project-space/CalendarWeekView.tsx` | 427 | 3 | 3 | 0 | Watch | Change risk is moderate due to moderate size (427 LOC), mixed responsibilities (3/5), 3 effects. |
| `src/components/project-space/InboxCaptureModuleSkin.tsx` | 484 | 2 | 1 | 3 | Watch | Change risk is moderate due to moderate size (484 LOC). |
| `src/components/hub-home/DayStrip.tsx` | 468 | 2 | 2 | 1 | Watch | Change risk is moderate due to moderate size (468 LOC). |
| `src/components/project-space/RelationPicker.tsx` | 312 | 3 | 2 | 5 | Watch | Change risk is moderate due to moderate size (312 LOC), mixed responsibilities (3/5). |
| `src/features/notes/collabSessionManager.ts` | 408 | 3 | 0 | 0 | Watch | Change risk is moderate due to moderate size (408 LOC), mixed responsibilities (3/5). |
| `src/components/layout/appShellUtils.ts` | 392 | 3 | 0 | 0 | Watch | Change risk is moderate due to moderate size (392 LOC), mixed responsibilities (3/5). |
| `src/services/projectsService.ts` | 395 | 3 | 0 | 0 | Watch | Change risk is moderate due to moderate size (395 LOC), mixed responsibilities (3/5). |
| `src/lib/calendar-nlp/utils.ts` | 398 | 3 | 0 | 0 | Watch | Change risk is moderate due to moderate size (398 LOC), mixed responsibilities (3/5). |
| `src/components/hub-home/TriagePanel.tsx` | 437 | 2 | 0 | 0 | Watch | Change risk is moderate due to moderate size (437 LOC). |
| `src/lib/nlp/intent/passes/patternPass.ts` | 418 | 2 | 0 | 0 | Watch | Change risk is moderate due to moderate size (418 LOC). |
| `apps/hub-api/routes/tasks.mjs` | 409 | 2 | 0 | 0 | Watch | Change risk is moderate due to moderate size (409 LOC). |
| `apps/hub-api/routes/chat.mjs` | 408 | 2 | 0 | 0 | Watch | Change risk is moderate due to moderate size (408 LOC). |
| `src/context/AuthzContext.tsx` | 311 | 2 | 2 | 2 | Watch | Change risk is moderate due to moderate size (311 LOC). |
| `apps/hub-api/lib/validators.mjs` | 308 | 3 | 0 | 0 | Watch | Change risk is moderate due to moderate size (308 LOC), mixed responsibilities (3/5). |
| `apps/hub-collab/collab-server.mjs` | 303 | 2 | 0 | 0 | Watch | Change risk is moderate due to moderate size (303 LOC). |
| `apps/hub-api/routes/projects.mjs` | 308 | 2 | 0 | 0 | Watch | Change risk is moderate due to moderate size (308 LOC). |
| `src/components/auth/ProjectRouteGuard.tsx` | 78 | 2 | 3 | 2 | Watch | Change risk is moderate due to 3 effects. |
| `src/lib/calendar-nlp/index.ts` | 279 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/layout/QuickAddDialogs.tsx` | 271 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hubLive.ts` | 279 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/mockProjectSpace.ts` | 251 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/intent/utils.ts` | 218 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/CalendarTab.tsx` | 176 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `apps/hub-api/routes/search.mjs` | 273 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `apps/hub-api/routes/reminders.mjs` | 257 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/useProjectMutations.ts` | 241 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/calendar-nlp/passes/alertsPass.ts` | 249 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/reminder-parser/constants.ts` | 169 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/features/notes/nodes/MediaEmbedNode.tsx` | 155 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hub/types.ts` | 166 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/task-parser/constants.ts` | 155 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/FilterBar.tsx` | 157 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/intent/passes/keywordPass.ts` | 233 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/ViewEmbedBlock.tsx` | 180 | 1 | 1 | 1 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/FilterBarOverlay.tsx` | 122 | 2 | 0 | 1 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/TimelineFeed.tsx` | 137 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/WidgetGrid.tsx` | 120 | 2 | 0 | 1 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/shared/utils.ts` | 143 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/MentionPicker.tsx` | 146 | 1 | 1 | 3 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/AddWidgetDialog.tsx` | 150 | 1 | 2 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hub/files.ts` | 122 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/mediaEmbed.ts` | 129 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/features/notes/EditorShell.tsx` | 115 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `apps/hub-api/routes/automation.mjs` | 197 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/hubRoutes.ts` | 112 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/useProjectTasksRuntime.ts` | 113 | 1 | 2 | 2 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/calendar-nlp/types.ts` | 115 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/Dialog.tsx` | 107 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/command.tsx` | 91 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/widgetCatalog.ts` | 101 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/dropdown-menu.tsx` | 93 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/context-menu.tsx` | 92 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/taskAdapter.ts` | 90 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/context/WidgetInsertContext.tsx` | 73 | 2 | 1 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/useProjectBootstrap.ts` | 118 | 1 | 1 | 1 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `apps/hub-api/lib/fetch-utils.mjs` | 98 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/select.tsx` | 80 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/nextcloudService.ts` | 84 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/useQuickCapture.ts` | 162 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/reminder-parser/index.ts` | 132 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/ProjectHeaderControls.tsx` | 143 | 1 | 0 | 1 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/alert-dialog.tsx` | 78 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/task-parser/index.ts` | 124 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/smartWakeService.ts` | 80 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/dashboardCards.ts` | 79 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/intent/passes/structurePass.ts` | 150 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hub/projects.ts` | 73 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/features/notes/nodes/MediaEmbedComponent.tsx` | 134 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hub/transport.ts` | 69 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/FileMovePopover.tsx` | 101 | 1 | 2 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/useAutomationRuntime.ts` | 125 | 1 | 1 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/intent/constants.ts` | 74 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/intent/passes/confidencePass.ts` | 142 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hub/spaces.ts` | 65 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/Tabs.tsx` | 60 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/calendar-nlp/passes/titlePass.ts` | 140 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/features/notes/nodes/ViewRefNode.tsx` | 63 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/Checkbox.tsx` | 61 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/dialog.tsx` | 57 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/ToggleButton.tsx` | 48 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/usePersonalCalendarRuntime.ts` | 78 | 1 | 2 | 1 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/context/ProjectsContext.tsx` | 82 | 1 | 1 | 2 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/CommentRail.tsx` | 142 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/ProjectSwitcher.tsx` | 136 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/calendar-nlp/passes/locationPass.ts` | 135 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/layout/NotificationsPanel.tsx` | 130 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/features/notes/mentionTokens.ts` | 62 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/TimelineTab.tsx` | 49 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/features/notes/lexicalState.ts` | 57 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/reminder-parser/types.ts` | 55 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/features/notes/MediaAutoEmbedPlugin.tsx` | 72 | 1 | 2 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/shared/constants.ts` | 58 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/Select.tsx` | 57 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/shared/title-utils.ts` | 53 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/hub-home/types.ts` | 52 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/CommandPalette.tsx` | 56 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hub/reminders.ts` | 51 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/task-parser/types.ts` | 48 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/useTimelineRuntime.ts` | 119 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/intent/types.ts` | 42 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/priorityStyles.ts` | 50 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hub/collections.ts` | 42 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/OverviewHeader.tsx` | 97 | 1 | 0 | 1 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hub/views.ts` | 41 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/types.ts` | 47 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/auth/ProfilePanel.tsx` | 97 | 1 | 0 | 1 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/tabs.tsx` | 32 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/calendar-nlp/constants.ts` | 44 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/hub-home/ContextBar.tsx` | 115 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/mediaWorkflowService.ts` | 29 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/WidgetFeedback.tsx` | 108 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/widgets/index.ts` | 8 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/widgets/KanbanWidget.tsx` | 104 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/FocusModeToolbar.tsx` | 100 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/popover.tsx` | 24 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hub/docs.ts` | 32 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/tooltip.tsx` | 23 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/policy.ts` | 34 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/RelationsSection.tsx` | 101 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/useProjectMembers.ts` | 76 | 1 | 0 | 2 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/widgets/TableWidget.tsx` | 93 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/buttonStyles.ts` | 21 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/calendar-nlp/passes/attendeesPass.ts` | 97 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `apps/hub-api/lib/logger.mjs` | 102 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/useCalendarRuntime.ts` | 57 | 1 | 1 | 1 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/shared/types.ts` | 22 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/Toast.tsx` | 12 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/hubHomeRefresh.ts` | 19 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/quickAddProjectRequest.ts` | 19 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/CommentComposer.tsx` | 82 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/WidgetShell.tsx` | 86 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/layout/ProfileMenu.tsx` | 87 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/designTokens.ts` | 15 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/calendar-nlp/passes/durationPass.ts` | 91 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/features/notes/viewEmbedContext.tsx` | 9 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/Popover.tsx` | 10 | 2 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/IconButton.tsx` | 51 | 1 | 1 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/useLongPress.ts` | 58 | 1 | 1 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `apps/hub-api/db/search-setup.mjs` | 84 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/intent/index.ts` | 55 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/InlineNotice.tsx` | 59 | 1 | 0 | 1 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/TopNavTabs.tsx` | 66 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/serviceRegistry.ts` | 74 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/useRouteFocusReset.ts` | 43 | 1 | 1 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/notificationService.ts` | 63 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/PinnedProjectsTabs.tsx` | 63 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/layout/ProjectShell.tsx` | 43 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/Chip.tsx` | 59 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `apps/hub-api/routes/notifications.mjs` | 64 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/openProjectService.ts` | 49 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/githubService.ts` | 45 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/BacklinksPanel.tsx` | 52 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/lessonsService.ts` | 37 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/layout/DataTable.tsx` | 48 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/ToolsView.tsx` | 48 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/widgets/QuickThoughtsWidget.tsx` | 30 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `apps/hub-api/routes/users.mjs` | 49 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/env.ts` | 49 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/Button.tsx` | 40 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `apps/hub-api/lib/requestContext.mjs` | 39 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/tabKeyboard.ts` | 43 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/widgets/FilesWidget.tsx` | 30 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/widgets/TasksWidget.tsx` | 30 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/widgets/CalendarWidget.tsx` | 29 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/context/ActivityContext.tsx` | 33 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/blockingInputs.ts` | 41 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/reminder-parser/passes/relativeTimePass.ts` | 37 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/task-parser/passes/priorityPass.ts` | 37 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/Menu.tsx` | 44 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/scroll-area.tsx` | 32 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/authService.ts` | 34 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/widgets/RemindersWidget.tsx` | 24 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/RelationRow.tsx` | 39 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/reminder-parser/passes/absoluteTimePass.ts` | 31 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/task-parser/passes/dueDatePass.ts` | 31 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/LinkButton.tsx` | 30 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/reminder-parser/passes/chronoFallbackPass.ts` | 30 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/auth/ProtectedRoute.tsx` | 20 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/WidgetLensControl.tsx` | 28 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/toggle-group.tsx` | 24 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hub/search.ts` | 32 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/reminder-parser/passes/recurrencePass.ts` | 27 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/task-parser/passes/assigneePass.ts` | 27 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/layout/Panel.tsx` | 26 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/WidgetSettingsPopover.tsx` | 26 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/reminder-parser/passes/prefixPass.ts` | 26 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/reminder-parser/passes/namedDatePass.ts` | 25 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/layout/SectionHeader.tsx` | 20 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/sonner.tsx` | 28 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/checkbox.tsx` | 19 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hub/notifications.ts` | 23 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `apps/hub-api/routes/records.mjs` | 26 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/reminder-parser/passes/titlePass.ts` | 22 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/sessionService.ts` | 18 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/layout/PageHeader.tsx` | 21 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/ui/toggle.tsx` | 17 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/task-parser/passes/titlePass.ts` | 21 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/layout/Cluster.tsx` | 20 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/SectionHeader.tsx` | 24 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/features/notes/lexicalTheme.ts` | 28 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/focusWhenReady.ts` | 28 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/useLiveRegion.ts` | 11 | 1 | 0 | 1 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/nlp/task-parser/passes/dateTypoCorrectionPass.ts` | 19 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/layout/Stack.tsx` | 18 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/keycloak.ts` | 18 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/apiClient.ts` | 22 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `apps/hub-api/db/transaction.mjs` | 21 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/auth/AccessDeniedView.tsx` | 13 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/pages/NotFoundPage.tsx` | 13 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/Card.tsx` | 20 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/widgets/TimelineWidget.tsx` | 16 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/layout/Grid.tsx` | 13 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/Divider.tsx` | 14 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hub/index.ts` | 12 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/layout/DataList.tsx` | 14 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/auth/ProjectRouteRedirect.tsx` | 8 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/Tooltip.tsx` | 12 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/project-space/ProjectSpaceDialogPrimitives.ts` | 8 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/hooks/useSmartWake.ts` | 6 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/utils.ts` | 9 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hubAuthHeaders.ts` | 9 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/ScrollArea.tsx` | 2 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/components/primitives/LiveRegion.tsx` | 5 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/lib/cn.ts` | 2 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |
| `src/services/hubContractApi.ts` | 1 | 1 | 0 | 0 | Healthy | Small, focused file with limited state/effects and narrow dependencies. |

## Refactor priority

1. **`src/components/layout/AppShell.tsx` (lines 55-2042; mounted at `src/App.tsx`:111-167)**
   The shell is both global app frame and feature host, with 18 effects and 26 state hooks coordinating unrelated systems (`src/components/layout/AppShell.tsx`:528-1232,1412-2042). Because every authenticated route renders inside this shell (`src/App.tsx`:111-167), this file has the largest central-path risk and highest regression blast radius.

2. **`src/pages/ProjectSpacePage.tsx` (lines 192-2052; routed at `src/App.tsx`:126-159)**
   This page mixes routing/query sync, runtime orchestration, and large UI composition (`src/pages/ProjectSpacePage.tsx`:233-629,784-1006,1027-2052). It is the entry point for overview/work/tools project routes, so complexity here directly affects the app's highest-frequency workspace flows.

3. **`apps/hub-api/hub-api.mjs` (lines 37-4162)**
   Despite extracted route widgets, the file still combines bootstrap/config, templating, helpers, scheduling, request routing, and server startup (`apps/hub-api/hub-api.mjs`:37-98,99-312,314-3185,3202-3300,3302-4162). Its size and mixed concerns make backend changes hard to isolate safely.

4. **`src/components/project-space/TableWidgetSkin.tsx` (lines 104-360, 453-1478; used in `src/pages/ProjectSpacePage.tsx`:64-66,1509-1512)**
   The table skin packs normalization, filtering, sorting, drag-reorder, inline editing, and keyboard grid behavior in one file. It is directly used in focused work-view mode, so maintenance friction in this file impacts core structured-record workflows.

5. **`src/features/PersonalizedDashboardPanel.tsx` (lines 128-358, 660-1224; mounted at `src/pages/ProjectsPage.tsx`:6,248)**
   This panel owns hub-home aggregation logic plus multiple rendering regions and interaction paths, and it is the primary content surface of the spaces home route. High responsibility density on a top-level page makes drift and duplicated behavior likely across home and space views.

6. **`src/components/project-space/KanbanWidgetSkin.tsx` (lines 53-1221; lazy-loaded via `src/pages/ProjectSpacePage.tsx`:59-61,1463-1498)**
   The widget is large and interaction-heavy (grouping, limits, card moves, inline mutations), with multiple local effects/states. Because it is a first-class focused view path in project space, defects here affect a core planning mode.

7. **`src/hooks/useProjectViewsRuntime.ts` (lines 296-896; consumed in `src/pages/ProjectSpacePage.tsx`:24,389)**
   This hook is central orchestration for collections/views/table+kanban runtime and focused view loading, with seven effects and broad state surface. Its coupling to `ProjectSpacePage` means runtime bugs propagate into several widget skins at once.

8. **`src/components/project-space/CalendarWidgetSkin.tsx` (lines 191-298, 300-901; used in `src/components/layout/AppShell.tsx`:22,1792)**
   Calendar rendering and create affordances are concentrated in one large file with inline sub-view logic (including medium week strip). It is used in the global shell surface, so issues are user-visible even outside project deep-link routes.

9. **`src/components/project-space/TasksTab.tsx` (lines 390-780, 782-1001; used by `src/components/project-space/TasksWidgetSkin.tsx`:8,605 and `src/components/project-space/OverviewView.tsx`:9,465)**
   The row/action/menu behavior is dense and duplicated across task contexts, and this shared tab component sits underneath both widget and overview experiences. Its central reuse makes it a high-leverage stability hotspot.

10. **`src/features/QuickCapture.tsx` (lines 168-180, 201-340, 552-818; mounted at `src/components/layout/AppShell.tsx`:6,1751)**
   Quick capture combines multi-mode form state, assignment flows, and several lifecycle effects in a global shell entry point. Since users can trigger capture from anywhere in the app shell, regressions in this file have broad product impact.
