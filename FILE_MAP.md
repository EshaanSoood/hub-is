# FILE_MAP

## .
eslint.config.js — Configures ESLint parser, plugin rules, and TypeScript/React lint policy.
package-lock.json — Pins exact npm dependency versions and integrity hashes for reproducible installs.
package.json — Defines package metadata, scripts (43), and runtime/development dependency sets.
playwright.config.ts — Configures Playwright browser projects, retries, timeouts, and test runner defaults.
tailwind.config.js — Configures Tailwind content scanning, theme tokens, and utility generation rules.
tsconfig.app.json — Configures TypeScript settings for the app bundle and JSX transpilation.
tsconfig.json — Configures shared TypeScript compiler options and project references.
vite.config.ts — Configures Vite build/dev server settings, plugins, and path resolution behavior.

## apps/hub-api
apps/hub-api/api-snapshot.json — Captures baseline Hub API output for contract regression comparisons.
apps/hub-api/api-snapshot.mjs — CLI script that captures Hub API responses and diffs them against stored snapshot baselines.
apps/hub-api/api-snapshot.post-refactor.json — Captures post-refactor Hub API output for parity/regression comparisons.
apps/hub-api/hub-api.mjs — Hub API server entrypoint wiring auth, SQLite, route dispatch, reminders, and live websocket broadcasts.
apps/hub-api/package-lock.json — Pins exact npm dependency versions and integrity hashes for reproducible installs.
apps/hub-api/package.json — Defines package metadata, scripts (1), and runtime/development dependency sets.

## apps/hub-api/db
apps/hub-api/db/migrations.mjs — Runs ordered SQLite migrations and records applied migration versions.
apps/hub-api/db/schema.mjs — Initializes SQLite schema objects, tables, indexes, and baseline metadata.
apps/hub-api/db/search-setup.mjs — Configures SQLite full-text search tables, triggers, and synchronization setup.
apps/hub-api/db/statements.mjs — Creates prepared SQLite statements consumed across Hub API route handlers.
apps/hub-api/db/transaction.mjs — Provides transaction wrappers for atomic SQLite write/read operations.

## apps/hub-api/lib
apps/hub-api/lib/logger.mjs — Builds structured request logger instances with scoped metadata and timing fields.
apps/hub-api/lib/requestContext.mjs — Applies per-request context including IDs, auth metadata, and log bindings.

## apps/hub-api/routes
Route handler modules for Hub API resources and request policy enforcement.
apps/hub-api/routes/automation.mjs — Handles GET/POST/PATCH/DELETE automation routes for /api/hub/projects/:id/automation-* and rules/:id.
apps/hub-api/routes/chat.mjs — Handles POST /api/hub/chat/provision and GET/POST/DELETE /api/hub/chat/snapshots for chat provisioning/history.
apps/hub-api/routes/collections.mjs — Handles GET/POST/PATCH/DELETE collection/record APIs under /api/hub/projects/:id and /api/hub/records/:id.
apps/hub-api/routes/docs.mjs — Handles GET/PUT /api/hub/docs/:id plus POST comment/collab routes under /api/hub/comments and /api/hub/collab/*.
apps/hub-api/routes/files.mjs — Handles GET/POST/DELETE asset/file routes under /api/hub/projects/:id/* plus POST /api/hub/files/upload.
apps/hub-api/routes/notifications.mjs — Handles GET /api/hub/notifications, POST /api/hub/notifications/:id/read, and GET /api/hub/live/authorize.
apps/hub-api/routes/panes.mjs — Handles GET/POST /api/hub/projects/:id/panes and PATCH/DELETE /api/hub/panes/:id with member updates.
apps/hub-api/routes/projects.mjs — Handles GET/POST /api/hub/projects, GET /api/hub/projects/:id, and member/invite management routes.
apps/hub-api/routes/reminders.mjs — Handles GET/POST /api/hub/reminders and POST /api/hub/reminders/:id/dismiss for reminder lifecycle.
apps/hub-api/routes/search.mjs — Handles GET /api/hub/search; executes global search across records, projects, and panes.
apps/hub-api/routes/tasks.mjs — Handles GET /api/hub/home, GET/POST /api/hub/tasks, and GET /api/hub/projects/:id/tasks task feeds.
apps/hub-api/routes/users.mjs — Handles GET /api/hub/me to return authenticated session and user identity metadata.
apps/hub-api/routes/views.mjs — Handles view APIs: GET/POST /api/hub/projects/:id/views, POST /api/hub/views/query, and calendar routes.

## apps/hub-collab
apps/hub-collab/collab-server.mjs — WebSocket collaboration server handling Yjs doc sessions, sync, awareness, and persistence.
apps/hub-collab/package-lock.json — Pins exact npm dependency versions and integrity hashes for reproducible installs.
apps/hub-collab/package.json — Defines package metadata, scripts (1), and runtime/development dependency sets.

## apps/shared
apps/shared/jwksVerifier.mjs — Exports createJwksVerifier for jwks verifier; used by hub-api and collab-server.

## scripts
Operational scripts for system checks, cleanup tasks, compliance gates, and smoke verification.
scripts/check-a11y.mjs — Runs the a11y validation check.
scripts/check-authz-runtime.mjs — Runs the authz runtime validation check.
scripts/check-authz.mjs — Runs the authz validation check.
scripts/check-collab-preflight.mjs — Runs the collab preflight validation check.
scripts/check-collab-ws-live.mjs — Runs the collab ws live validation check.
scripts/check-css-drift.mjs — Runs the css drift validation check.
scripts/check-headings.mjs — Runs the headings validation check.
scripts/check-hub-core-gate.mjs — Runs the hub core gate validation check.
scripts/check-hub-policy-live.mjs — Runs the hub policy live validation check.
scripts/check-hub-sqlite-lock.mjs — Runs the hub sqlite lock validation check.
scripts/check-hub-tasks-local.mjs — Runs the hub tasks local validation check.
scripts/check-layout-primitives.mjs — Runs the layout primitives validation check.
scripts/check-nextcloud-live.mjs — Runs the nextcloud live validation check.
scripts/check-no-inline-styles.mjs — Runs the no inline styles validation check.
scripts/check-openproject-live.mjs — Runs the openproject live validation check.
scripts/check-token-compliance.mjs — Runs the token compliance validation check.
scripts/clean.mjs — Removes generated artifacts and resets local build outputs.
scripts/cleanup-live-test-entities.mjs — Cleans up live test entities test artifacts.
scripts/cleanup-nextcloud-test-files.mjs — Cleans up nextcloud test files test artifacts.
scripts/cleanup-openproject-test-work-packages.mjs — Cleans up openproject test work packages test artifacts.
scripts/contract_smoke_test.mjs — Executes contract smoke test smoke workflow.
scripts/ensure-contract-smoke-users.mjs — Ensures contract smoke users prerequisites are present.
scripts/hub-provenance-regression.test.mjs — Regression script validating hub provenance behavior against expected event lineage.
scripts/keycloak-close-club.mjs — Closes Keycloak test-club state used by auth workflow validation scripts.
scripts/keycloak-verify-closed.mjs — Verifies Keycloak club closure state after auth workflow cleanup operations.
scripts/mint-contract-smoke-tokens.mjs — Executes mint contract smoke tokens smoke workflow.

## scripts/calendar-nlp
scripts/calendar-nlp/batch-dump-to-txt.mjs — Dumps parsed calendar NLP corpus batches to text output files for review.
scripts/calendar-nlp/corpus-harness.mjs — Runs the calendar NLP corpus harness and reports extraction confidence/statistics.
scripts/calendar-nlp/corpus.test.mjs — Regression test runner for calendar NLP corpus parsing expectations.
scripts/calendar-nlp/enhancements.test.mjs — Targeted calendar NLP enhancement regression tests for new parsing behavior.
scripts/calendar-nlp/parse-cli.mjs — CLI for parsing ad-hoc event text into structured calendar entities.
scripts/calendar-nlp/scratch-textbox.mjs — Local scratch script for iterating on freeform calendar text parsing behavior.
scripts/calendar-nlp/scratch-ui-server.mjs — Starts a local scratch UI server for manual calendar NLP experimentation.
scripts/calendar-nlp/weekday-semantics.test.mjs — Regression tests for weekday-relative date semantics in calendar NLP parsing.

## src
src/App.tsx — Renders app UI; uses useAuthz.
src/main.tsx — Renders main UI.
src/vite-env.d.ts — Declares ambient TypeScript module types for vite env.d integration.

## src/components/auth
src/components/auth/AccessDeniedView.tsx — Renders access denied view UI.
src/components/auth/ProfilePanel.tsx — Renders profile panel panel; uses state, refs, useAuthz.
src/components/auth/ProjectRouteGuard.tsx — Renders project route guard route wrapper; uses useParams.
src/components/auth/ProjectRouteRedirect.tsx — Renders project route redirect route wrapper; uses useParams.
src/components/auth/ProtectedRoute.tsx — Renders protected route route wrapper; uses useAuthz.

## src/components/layout
src/components/layout/AppShell.tsx — Renders app shell UI; uses state, memoized data, effects, refs, useLocation.
src/components/layout/Cluster.tsx — Renders cluster UI.
src/components/layout/DataList.tsx — Renders data list UI.
src/components/layout/DataTable.tsx — Renders data table tab.
src/components/layout/Grid.tsx — Renders grid UI.
src/components/layout/PageHeader.tsx — Renders page header UI.
src/components/layout/Panel.tsx — Renders panel panel.
src/components/layout/ProjectShell.tsx — Renders project shell UI.
src/components/layout/SectionHeader.tsx — Renders section header UI.
src/components/layout/Stack.tsx — Renders stack UI.

## src/components/primitives
Reusable low-level UI primitives for controls, overlays, notifications, and layout atoms.
src/components/primitives/Button.tsx — Renders button UI.
src/components/primitives/buttonStyles.ts — Exports buttonBaseClass, getButtonClassName, ButtonVariant for button styles; used by Button and IconButton.
src/components/primitives/Card.tsx — Renders card UI.
src/components/primitives/Checkbox.tsx — Renders checkbox UI.
src/components/primitives/Chip.tsx — Renders chip UI.
src/components/primitives/CommandPalette.tsx — Renders command palette UI.
src/components/primitives/Dialog.tsx — Renders dialog dialog.
src/components/primitives/Divider.tsx — Renders divider UI.
src/components/primitives/Icon.tsx — Renders checkmark icon UI; uses useId.
src/components/primitives/IconButton.tsx — Renders icon button UI; uses effects.
src/components/primitives/index.ts — Barrel file re-exporting primitive UI components, types, and helper utilities.
src/components/primitives/InlineNotice.tsx — Renders inline notice UI; uses state, memoized data.
src/components/primitives/LinkButton.tsx — Renders link button UI.
src/components/primitives/LiveRegion.tsx — Renders live region UI.
src/components/primitives/Menu.tsx — Renders dropdown menu UI.
src/components/primitives/Popover.tsx — Renders popover popover.
src/components/primitives/ScrollArea.tsx — Renders scroll area UI.
src/components/primitives/SectionHeader.tsx — Renders section header UI.
src/components/primitives/Select.tsx — Renders select UI.
src/components/primitives/Tabs.tsx — Renders tabs tab.
src/components/primitives/Toast.tsx — Renders toast provider UI.
src/components/primitives/ToggleButton.tsx — Renders toggle button UI.
src/components/primitives/Tooltip.tsx — Renders tooltip UI.

## src/components/project-space
Project Space feature UI: tabs, module skins, overlays, comments, and workspace tooling.
src/components/project-space/AddModuleDialog.tsx — Renders add module dialog dialog; uses state, useId.
src/components/project-space/AutomationBuilder.tsx — Renders automation builder UI; uses state, memoized data.
src/components/project-space/BacklinksPanel.tsx — Renders backlinks panel panel.
src/components/project-space/CalendarModuleSkin.tsx — Renders calendar module skin module view; uses state, memoized data, effects, refs.
src/components/project-space/CalendarTab.tsx — Renders calendar tab tab; uses memoized data.
src/components/project-space/CommentComposer.tsx — Renders comment composer UI; uses memoized data.
src/components/project-space/CommentRail.tsx — Renders comment rail UI.
src/components/project-space/designTokens.ts — Defines TypeScript types and interfaces for design tokens.
src/components/project-space/FileInspectorActionBar.tsx — Renders file inspector action bar UI; uses state, effects, refs.
src/components/project-space/FileMovePopover.tsx — Renders file move popover popover; uses state, effects, refs.
src/components/project-space/FilesModuleSkin.tsx — Renders files module skin module view; uses state, memoized data, effects, refs, useThumbnail.
src/components/project-space/FilterBar.tsx — Renders filter bar UI.
src/components/project-space/FilterBarOverlay.tsx — Renders filter bar overlay UI; uses state, memoized data.
src/components/project-space/FocusModeToolbar.tsx — Renders focus mode toolbar toolbar; uses memoized data, refs.
src/components/project-space/InboxCaptureModuleSkin.tsx — Renders quick thoughts module skin module view; uses state, memoized data, effects, refs.
src/components/project-space/KanbanModuleSkin.tsx — Renders kanban module skin module view; uses memoized data, useDroppable.
src/components/project-space/MentionPicker.tsx — Renders mention picker UI; uses state, memoized data, effects, refs, useId.
src/components/project-space/mockProjectSpace.ts — Exports moduleTemplates, buildCollaborators, buildClientReferences for mock project space.
src/components/project-space/moduleCatalog.ts — Exports MODULE_CATALOG, moduleCatalogEntry, moduleLabel for module catalog; used by AddModuleDialog and ModuleGrid.
src/components/project-space/ModuleFeedback.tsx — Renders module loading state module view.
src/components/project-space/ModuleGrid.tsx — Renders module grid module view; uses state, refs.
src/components/project-space/ModuleLensControl.tsx — Renders module lens control module view.
src/components/project-space/ModuleSettingsPopover.tsx — Renders module settings popover popover.
src/components/project-space/OverviewHeader.tsx — Renders overview header UI; uses state, memoized data.
src/components/project-space/OverviewView.tsx — Renders overview view UI; uses state, memoized data, refs.
src/components/project-space/PaneHeaderControls.tsx — Renders pane header controls UI; uses state, memoized data.
src/components/project-space/PaneSwitcher.tsx — Renders pane switcher UI; uses state, memoized data, refs.
src/components/project-space/PinnedPanesTabs.tsx — Renders pinned panes tabs tab.
src/components/project-space/ProjectSpaceDialogPrimitives.ts — Exports Dialog, DialogClose, DialogContent for project space dialog primitives; used by ProjectSpacePage.
src/components/project-space/RelationPicker.tsx — Renders relation picker UI; uses state, memoized data, effects, refs, useId.
src/components/project-space/RelationRow.tsx — Renders relation row UI.
src/components/project-space/RelationsSection.tsx — Renders relations section UI.
src/components/project-space/RemindersModuleSkin.tsx — Renders reminders module skin module view; uses state, memoized data, effects, refs.
src/components/project-space/tabKeyboard.ts — Exports handleRovingTabKeyDown for tab keyboard; used by Tabs.
src/components/project-space/TableModuleSkin.tsx — Renders table module skin tab; uses state, memoized data, refs, useReactTable.
src/components/project-space/taskAdapter.ts — Exports formatDueLabel, adaptTaskSummary, adaptTaskSummaries for task adapter; used by OverviewView and TasksModuleSkin.
src/components/project-space/TaskCreateDialog.tsx — Renders task create dialog dialog; uses state, effects, refs.
src/components/project-space/TasksModuleSkin.tsx — Renders tasks module skin module view; uses state, memoized data.
src/components/project-space/TasksTab.tsx — Renders tasks tab tab; uses state, memoized data, effects, refs.
src/components/project-space/TimelineFeed.tsx — Renders timeline feed UI; uses memoized data.
src/components/project-space/TimelineTab.tsx — Renders timeline tab tab.
src/components/project-space/ToolsView.tsx — Renders tools view UI.
src/components/project-space/TopNavTabs.tsx — Renders top nav tabs tab.
src/components/project-space/types.ts — Defines TypeScript types and interfaces for project space.
src/components/project-space/ViewEmbedBlock.tsx — Renders view embed block UI; uses state, memoized data, effects, useViewEmbedRuntime.
src/components/project-space/WorkView.tsx — Renders work view UI; uses state, refs.

## src/components/project-space/modules
src/components/project-space/modules/CalendarModule.tsx — Renders calendar module module view.
src/components/project-space/modules/FilesModule.tsx — Renders files module module view.
src/components/project-space/modules/index.ts — Exports TableModule, KanbanModule, CalendarModule for modules; used by WorkView.
src/components/project-space/modules/KanbanModule.tsx — Renders kanban module module view.
src/components/project-space/modules/QuickThoughtsModule.tsx — Renders quick thoughts module module view.
src/components/project-space/modules/RemindersModule.tsx — Renders reminders module module view.
src/components/project-space/modules/TableModule.tsx — Renders table module tab.
src/components/project-space/modules/TasksModule.tsx — Renders tasks module module view.
src/components/project-space/modules/TimelineModule.tsx — Renders timeline module module view.

## src/components/ui
Styled wrapper components around UI primitives and accessibility-focused interaction patterns.
src/components/ui/alert-dialog.tsx — Renders alert dialog UI.
src/components/ui/checkbox.tsx — Renders checkbox UI.
src/components/ui/command.tsx — Renders command UI.
src/components/ui/context-menu.tsx — Renders context menu UI.
src/components/ui/dialog.tsx — Renders dialog UI.
src/components/ui/dropdown-menu.tsx — Renders dropdown menu UI.
src/components/ui/popover.tsx — Renders popover UI.
src/components/ui/scroll-area.tsx — Renders scroll area UI.
src/components/ui/select.tsx — Renders select UI.
src/components/ui/sonner.tsx — Renders toaster UI.
src/components/ui/tabs.tsx — Renders tabs UI.
src/components/ui/toggle-group.tsx — Renders toggle group UI.
src/components/ui/toggle.tsx — Renders toggle UI.
src/components/ui/tooltip.tsx — Renders tooltip provider UI.

## src/context
src/context/ActivityContext.tsx — Renders activity provider context provider; uses state, memoized data, useActivity.
src/context/AuthzContext.tsx — Renders authz provider context provider; uses state, memoized data, effects, useAuthz.
src/context/ProjectsContext.tsx — Renders projects provider context provider; uses state, memoized data, effects, useAuthz.
src/context/SmartWakeContext.tsx — Renders smart wake provider context provider; uses state, memoized data, effects, refs, useSmartWakeContext.

## src/data
src/data/authzData.ts — Exports anonymousUser for authz data; used by AuthzContext.
src/data/mockData.ts — Exports nowIso, mockNotes, mockFiles for mock data; used by ActivityContext and githubService.

## src/features
src/features/PersonalizedDashboardPanel.tsx — Renders personalized dashboard panel panel; uses state, memoized data, effects, refs, useId.
src/features/QuickCapture.tsx — Renders quick capture panel UI; uses state, memoized data, effects, refs, useNavigate.

## src/features/notes
src/features/notes/CollaborativeLexicalEditor.tsx — Renders collaborative lexical editor UI; uses memoized data, effects, refs, useLexicalComposerContext.
src/features/notes/EditorShell.tsx — Renders editor shell UI.
src/features/notes/lexicalState.ts — Normalizes Lexical editor state JSON and converts editor snapshots for persisted note storage.
src/features/notes/lexicalTheme.ts — Exports notesLexicalTheme for lexical theme; used by CollaborativeLexicalEditor.
src/features/notes/mentionTokens.ts — Parses and appends mention token syntax for note/comment mention extraction and serialization.
src/features/notes/viewEmbedContext.tsx — Renders view embed provider context provider; uses useViewEmbedRuntime.

## src/features/notes/nodes
src/features/notes/nodes/ViewRefNode.tsx — Renders view ref node UI.

## src/hooks
Custom React hooks coordinating app runtime state, server sync, and project-space behaviors.
src/hooks/useAutomationRuntime.ts — Custom hook useAutomationRuntime orchestrating use automation runtime state and side-effect flows.
src/hooks/useCalendarRuntime.ts — Custom hook useCalendarRuntime orchestrating use calendar runtime state and side-effect flows.
src/hooks/useLiveRegion.ts — Custom hook useLiveRegion orchestrating use live region state and side-effect flows.
src/hooks/usePaneMutations.ts — Custom hook usePaneMutations orchestrating use pane mutations state and side-effect flows.
src/hooks/usePersonalCalendarRuntime.ts — Custom hook usePersonalCalendarRuntime orchestrating use personal calendar runtime state and side-effect flows.
src/hooks/useProjectBootstrap.ts — Custom hook useProjectBootstrap orchestrating use project bootstrap state and side-effect flows.
src/hooks/useProjectFilesRuntime.ts — Custom hook useProjectFilesRuntime orchestrating use project files runtime state and side-effect flows.
src/hooks/useProjectMembers.ts — Custom hook useProjectMembers orchestrating use project members state and side-effect flows.
src/hooks/useProjectTasksRuntime.ts — Custom hook useProjectTasksRuntime orchestrating use project tasks runtime state and side-effect flows.
src/hooks/useProjectViewsRuntime.ts — Custom hook useProjectViewsRuntime orchestrating use project views runtime state and side-effect flows.
src/hooks/useQuickCapture.ts — Custom hook useQuickCapture orchestrating use quick capture state and side-effect flows.
src/hooks/useRecordInspector.ts — Custom hook useRecordInspector orchestrating use record inspector state and side-effect flows.
src/hooks/useRemindersRuntime.ts — Custom hook useRemindersRuntime orchestrating use reminders runtime state and side-effect flows.
src/hooks/useRouteFocusReset.ts — Custom hook useRouteFocusReset orchestrating use route focus reset state and side-effect flows.
src/hooks/useSmartWake.ts — Custom hook useSmartWake orchestrating use smart wake state and side-effect flows.
src/hooks/useTimelineRuntime.ts — Custom hook useTimelineRuntime orchestrating use timeline runtime state and side-effect flows.
src/hooks/useWorkspaceDocRuntime.ts — Custom hook useWorkspaceDocRuntime orchestrating use workspace doc runtime state and side-effect flows.

## src/hooks/__tests__
src/hooks/__tests__/useRemindersRuntime.test.ts — Test suite covering reminder runtime hook behavior, updates, and regression scenarios.

## src/lib
Core shared utilities for auth, routing, policies, formatting, and service-level abstractions.
src/lib/blockingInputs.ts — Exports getBlockingInputs for blocking inputs.
src/lib/cn.ts — Exports cn for cn; used by Cluster and Grid.
src/lib/dashboardCards.ts — Defines dashboard card registry constants and filtering helpers for personalized dashboard rendering.
src/lib/env.ts — Exports env for env; used by useWorkspaceDocRuntime and blockingInputs.
src/lib/focusWhenReady.ts — Exports focusWhenReady for focus when ready; used by QuickCapture and LoginPage.
src/lib/hubHomeRefresh.ts — Exports HUB_HOME_REFRESH_EVENT, requestHubHomeRefresh, subscribeHubHomeRefresh for hub home refresh; used by AppShell.
src/lib/hubRoutes.ts — Builds Hub deep-link/context hrefs from records, panes, and lexical node metadata.
src/lib/keycloak.ts — Exports isKeycloakConfigured, getKeycloak for keycloak; used by AuthzContext.
src/lib/policy.ts — Exports appTabs, hasGlobalCapability, getMembershipForProject for policy; used by AppShell and AuthzContext.
src/lib/serviceRegistry.ts — Exports serviceRegistry, canAccessServiceExternalUi for service registry; used by SmartWakeContext.
src/lib/utils.ts — Exports toBase64 for lib; used by useProjectFilesRuntime and useWorkspaceDocRuntime.

## src/lib/__tests__
src/lib/__tests__/dashboardCards.test.ts — Test suite validating dashboard card filtering and registry behavior.

## src/lib/calendar-nlp
src/lib/calendar-nlp/constants.ts — Exports DEFAULT_LOCALE, DEFAULT_TIMEZONE, WEEKDAY_ALIASES for calendar nlp; used by recurrencePass and utils.
src/lib/calendar-nlp/index.ts — Composes calendar NLP passes and exports parse helpers, confidence scoring, and plain-search fallback.
src/lib/calendar-nlp/types.ts — Defines TypeScript types and interfaces for calendar nlp.
src/lib/calendar-nlp/utils.ts — Exports parseReferenceDate, normalizeWhitespace, clampConfidence for calendar nlp; used by corpus-harness and index.

## src/lib/calendar-nlp/passes
src/lib/calendar-nlp/passes/alertsPass.ts — Calendar NLP pass that extracts alerts pass signals from event text.
src/lib/calendar-nlp/passes/attendeesPass.ts — Calendar NLP pass that extracts attendees pass signals from event text.
src/lib/calendar-nlp/passes/chronoPass.ts — Calendar NLP pass that extracts chrono pass signals from event text.
src/lib/calendar-nlp/passes/durationPass.ts — Calendar NLP pass that extracts duration pass signals from event text.
src/lib/calendar-nlp/passes/locationPass.ts — Calendar NLP pass that extracts location pass signals from event text.
src/lib/calendar-nlp/passes/recurrencePass.ts — Calendar NLP pass that extracts recurrence pass signals from event text.
src/lib/calendar-nlp/passes/titlePass.ts — Calendar NLP pass that extracts title pass signals from event text.

## src/lib/nlp/intent
src/lib/nlp/intent/constants.ts — Defines constants/defaults used by intent parser stages.
src/lib/nlp/intent/index.ts — Composes and exports the intent parsing pipeline.
src/lib/nlp/intent/types.ts — Defines parsing contracts and shared types for intent.
src/lib/nlp/intent/utils.ts — Utility helpers shared across intent parser passes.

## src/lib/nlp/intent/__tests__
src/lib/nlp/intent/__tests__/intent-passes.test.ts — Test suite validating intent pipeline pass ordering, outputs, and regression coverage.
src/lib/nlp/intent/__tests__/intent-scoring.test.ts — Test suite validating intent confidence scoring and threshold behavior.
src/lib/nlp/intent/__tests__/intent.test.ts — Test suite validating end-to-end intent parsing behavior.

## src/lib/nlp/intent/passes
src/lib/nlp/intent/passes/confidencePass.ts — NLP pipeline pass applying confidence pass rules to extraction context.
src/lib/nlp/intent/passes/keywordPass.ts — NLP pipeline pass applying keyword pass rules to extraction context.
src/lib/nlp/intent/passes/patternPass.ts — NLP pipeline pass applying pattern pass rules to extraction context.
src/lib/nlp/intent/passes/structurePass.ts — NLP pipeline pass applying structure pass rules to extraction context.

## src/lib/nlp/reminder-parser
src/lib/nlp/reminder-parser/constants.ts — Defines constants/defaults used by reminder parser parser stages.
src/lib/nlp/reminder-parser/index.ts — Composes and exports the reminder parser parsing pipeline.
src/lib/nlp/reminder-parser/types.ts — Defines parsing contracts and shared types for reminder parser.
src/lib/nlp/reminder-parser/utils.ts — Utility helpers shared across reminder parser parser passes.

## src/lib/nlp/reminder-parser/__tests__
src/lib/nlp/reminder-parser/__tests__/recurrence.test.ts — Test suite validating reminder recurrence extraction behavior.
src/lib/nlp/reminder-parser/__tests__/reminder-parser-passes.test.ts — Test suite validating reminder parser pass sequencing and interactions.
src/lib/nlp/reminder-parser/__tests__/reminder-parser.test.ts — Test suite validating end-to-end reminder parser behavior.
src/lib/nlp/reminder-parser/__tests__/time-extraction.test.ts — Test suite validating time extraction behavior in reminder parsing.

## src/lib/nlp/reminder-parser/passes
src/lib/nlp/reminder-parser/passes/absoluteTimePass.ts — NLP pipeline pass applying absolute time pass rules to extraction context.
src/lib/nlp/reminder-parser/passes/chronoFallbackPass.ts — NLP pipeline pass applying chrono fallback pass rules to extraction context.
src/lib/nlp/reminder-parser/passes/namedDatePass.ts — NLP pipeline pass applying named date pass rules to extraction context.
src/lib/nlp/reminder-parser/passes/prefixPass.ts — NLP pipeline pass applying prefix pass rules to extraction context.
src/lib/nlp/reminder-parser/passes/recurrencePass.ts — NLP pipeline pass applying recurrence pass rules to extraction context.
src/lib/nlp/reminder-parser/passes/relativeTimePass.ts — NLP pipeline pass applying relative time pass rules to extraction context.
src/lib/nlp/reminder-parser/passes/titlePass.ts — NLP pipeline pass applying title pass rules to extraction context.

## src/lib/nlp/shared
src/lib/nlp/shared/constants.ts — Defines constants/defaults used by shared parser stages.
src/lib/nlp/shared/types.ts — Defines parsing contracts and shared types for shared.
src/lib/nlp/shared/utils.ts — Utility helpers shared across shared parser passes.

## src/lib/nlp/task-parser
src/lib/nlp/task-parser/constants.ts — Defines constants/defaults used by task parser parser stages.
src/lib/nlp/task-parser/index.ts — Composes and exports the task parser parsing pipeline.
src/lib/nlp/task-parser/types.ts — Defines parsing contracts and shared types for task parser.
src/lib/nlp/task-parser/utils.ts — Utility helpers shared across task parser parser passes.

## src/lib/nlp/task-parser/__tests__
src/lib/nlp/task-parser/__tests__/due-date-extraction.test.ts — Test suite validating due-date extraction behavior in task parsing.
src/lib/nlp/task-parser/__tests__/task-parser-passes.test.ts — Test suite validating task parser pass sequencing and interactions.
src/lib/nlp/task-parser/__tests__/task-parser.test.ts — Test suite validating end-to-end task parser behavior.
src/lib/nlp/task-parser/__tests__/title-cleanup.test.ts — Test suite validating task-title cleanup normalization behavior.

## src/lib/nlp/task-parser/passes
src/lib/nlp/task-parser/passes/assigneePass.ts — NLP pipeline pass applying assignee pass rules to extraction context.
src/lib/nlp/task-parser/passes/dateTypoCorrectionPass.ts — NLP pipeline pass applying date typo correction pass rules to extraction context.
src/lib/nlp/task-parser/passes/dueDatePass.ts — NLP pipeline pass applying due date pass rules to extraction context.
src/lib/nlp/task-parser/passes/priorityPass.ts — NLP pipeline pass applying priority pass rules to extraction context.
src/lib/nlp/task-parser/passes/titlePass.ts — NLP pipeline pass applying title pass rules to extraction context.

## src/pages
src/pages/LoginPage.tsx — Renders login page page; uses effects, refs, useAuthz.
src/pages/NotFoundPage.tsx — Renders not found page page.
src/pages/ProjectSpacePage.tsx — Renders project space page page; uses state, memoized data, effects, refs, useLocation.
src/pages/ProjectsPage.tsx — Renders projects page page; uses state, memoized data, effects, refs, useNavigate.

## src/server
src/server/routes.ts — Exports serverRouteContracts for routes.

## src/services
Service clients for auth, integrations, notifications, and app-to-backend transport.
src/services/apiClient.ts — Service module implementing api client integration and transport logic.
src/services/authService.ts — Service module implementing auth service integration and transport logic.
src/services/githubService.ts — Service module implementing github service integration and transport logic.
src/services/hubAuthHeaders.ts — Service module implementing hub auth headers integration and transport logic.
src/services/hubContractApi.ts — Service module implementing hub contract api integration and transport logic.
src/services/hubLive.ts — Service module implementing hub live integration and transport logic.
src/services/lessonsService.ts — Service module implementing lessons service integration and transport logic.
src/services/mediaWorkflowService.ts — Service module implementing media workflow service integration and transport logic.
src/services/nextcloudService.ts — Service module implementing nextcloud service integration and transport logic.
src/services/notificationService.ts — Service module implementing notification service integration and transport logic.
src/services/openProjectService.ts — Service module implementing open project service integration and transport logic.
src/services/projectsService.ts — Service module implementing projects service integration and transport logic.
src/services/sessionService.ts — Service module implementing session service integration and transport logic.
src/services/smartWakeService.ts — Service module implementing smart wake service integration and transport logic.

## src/services/hub
Hub-specific API client modules grouped by resource domain and response normalization.
src/services/hub/collections.ts — Hub API client for collections; exports listCollections, createCollection, listCollectionFields.
src/services/hub/docs.ts — Hub API client for docs; exports authorizeCollabDoc, getDocSnapshot, saveDocSnapshot.
src/services/hub/files.ts — Hub API client for files; exports uploadFile, listTrackedFiles, listAssetRoots.
src/services/hub/index.ts — Hub API client for hub; exports searchHub.
src/services/hub/notifications.ts — Hub API client for notifications; exports listNotifications, markNotificationRead.
src/services/hub/panes.ts — Hub API client for panes; exports listPanes, createPane, updatePane.
src/services/hub/projects.ts — Hub API client for projects; exports listProjects, createProject, getProject.
src/services/hub/records.ts — Hub API client for records; exports createRecord, updateRecord, archiveRecord.
src/services/hub/reminders.ts — Hub API client for reminders; exports listReminders, dismissReminder, createReminder.
src/services/hub/search.ts — Hub API client for search; exports searchHub, HubSearchResult.
src/services/hub/transport.ts — Hub API client for transport; exports normalizeSourcePane, normalizeRecordSummary, normalizeRecordDetail.
src/services/hub/types.ts — Hub API client for hub; exports HubProject, HubSourcePaneContext, HubRecordDetail.
src/services/hub/views.ts — Hub API client for views; exports listViews, createView, queryView.

## src/services/hub/__tests__
src/services/hub/__tests__/hubRoutes.test.ts — Test suite validating Hub route URL builders and parsing invariants.

## src/shared/api-types
src/shared/api-types/auth.ts — Shared API type definitions for auth.
src/shared/api-types/events.ts — Shared API type definitions for events.
src/shared/api-types/hub-home.ts — Shared API type definitions for hub home.
src/shared/api-types/index.ts — Barrel export for shared API contracts and runtime validators.
src/shared/api-types/projects.ts — Shared API type definitions for projects.
src/shared/api-types/records.ts — Shared API type definitions for records.
src/shared/api-types/reminders.ts — Shared API type definitions for reminders.
src/shared/api-types/tasks.ts — Shared API type definitions for tasks.
src/shared/api-types/validators.ts — Shared API type definitions for validators.

## src/types
src/types/domain.ts — Defines TypeScript types and interfaces for domain.
src/types/hub-api-module.d.ts — Declares ambient TypeScript module types for hub api module.d integration.
