# Widget Rename Audit

Generated: 2026-04-27T21:13:13.106Z

Scope: tracked files plus untracked non-ignored files. Excludes package-lock files, ignored dependency/build artifacts, `RENAME_AUDIT.md`, `WIDGET_RENAME_AUDIT.md`, and `WIDGET_RENAME_RULES.md` to avoid third-party and generated-audit recursion.

Classification is line-level:
- `MODULE-PRODUCT`: product widget/module concept, including API fields, layout JSON, UI labels, tests, and docs.
- `MODULE-SYSTEM`: ES/Node module system, build tooling, dependency paths, or generic software-module references.
- `AMBIGUOUS`: unclear without nearby context.

## Summary

| Classification | Count |
|---|---:|
| MODULE-PRODUCT | 1780 |
| MODULE-SYSTEM | 62 |
| AMBIGUOUS | 25 |
| Total | 1867 |

## Hits

| File | Line | Classification | Line content |
|---|---:|---|---|
| .env.example | 129 | MODULE-PRODUCT | # Toggle workflow module coverage in workflow e2e helpers. |
| .env.example | 130 | MODULE-PRODUCT | WORKFLOW_MODULES=true |
| .gitignore | 1 | MODULE-SYSTEM | node_modules/ |
| .gitignore | 37 | MODULE-PRODUCT | e2e/module-verification/ |
| AGENTS.md | 127 | MODULE-SYSTEM | - Keep module boundaries explicit. |
| AGENTS.md | 128 | MODULE-PRODUCT |   Prefer typed module contracts over generic cross-module plumbing. |
| AGENTS.md | 179 | MODULE-PRODUCT | \| Adding or modifying a module \| §5 Per-module contracts \| |
| AGENTS.md | 204 | MODULE-PRODUCT | - Module contracts: `src/components/project-space/moduleContracts/index.ts` |
| apps/hub-api/.dockerignore | 1 | MODULE-SYSTEM | node_modules |
| apps/hub-api/api-snapshot.json | 210 | MODULE-PRODUCT |       "path": "/api/hub/module-picker/seed-data", |
| apps/hub-api/api-snapshot.json | 211 | MODULE-PRODUCT |       "path_pattern": "/api/hub/module-picker/seed-data", |
| apps/hub-api/api-snapshot.post-refactor.json | 210 | MODULE-PRODUCT |       "path": "/api/hub/module-picker/seed-data", |
| apps/hub-api/api-snapshot.post-refactor.json | 211 | MODULE-PRODUCT |       "path_pattern": "/api/hub/module-picker/seed-data", |
| apps/hub-api/db/modulePickerSeedInitialData.mjs | 1 | MODULE-PRODUCT | const allowedSizesByModule = { |
| apps/hub-api/db/modulePickerSeedInitialData.mjs | 70 | MODULE-PRODUCT | export const seedModulePickerSeedData = (db, nowIso) => { |
| apps/hub-api/db/modulePickerSeedInitialData.mjs | 73 | MODULE-PRODUCT |     INSERT OR IGNORE INTO module_picker_seed_data ( |
| apps/hub-api/db/modulePickerSeedInitialData.mjs | 74 | MODULE-PRODUCT |       module_type, |
| apps/hub-api/db/modulePickerSeedInitialData.mjs | 83 | MODULE-PRODUCT |   for (const [moduleType, sizes] of Object.entries(allowedSizesByModule)) { |
| apps/hub-api/db/modulePickerSeedInitialData.mjs | 85 | MODULE-PRODUCT |       insertSeed.run(moduleType, size, JSON.stringify(baseSeeds[moduleType]), now, now); |
| apps/hub-api/db/modulePickerSeedMigration.mjs | 1 | MODULE-PRODUCT | import { seedModulePickerSeedData } from './modulePickerSeedInitialData.mjs'; |
| apps/hub-api/db/modulePickerSeedMigration.mjs | 3 | MODULE-PRODUCT | export const installModulePickerSeedData = (db, nowIso) => { |
| apps/hub-api/db/modulePickerSeedMigration.mjs | 5 | MODULE-PRODUCT |     CREATE TABLE IF NOT EXISTS module_picker_seed_data ( |
| apps/hub-api/db/modulePickerSeedMigration.mjs | 6 | MODULE-PRODUCT |       module_type TEXT NOT NULL, |
| apps/hub-api/db/modulePickerSeedMigration.mjs | 11 | MODULE-PRODUCT |       PRIMARY KEY(module_type, size_tier) |
| apps/hub-api/db/modulePickerSeedMigration.mjs | 14 | MODULE-PRODUCT |     CREATE INDEX IF NOT EXISTS idx_module_picker_seed_module_size |
| apps/hub-api/db/modulePickerSeedMigration.mjs | 15 | MODULE-PRODUCT |       ON module_picker_seed_data(module_type, size_tier); |
| apps/hub-api/db/modulePickerSeedMigration.mjs | 18 | MODULE-PRODUCT |   seedModulePickerSeedData(db, nowIso); |
| apps/hub-api/db/modulePickerSeedQueries.mjs | 1 | MODULE-PRODUCT | export const createModulePickerSeedQueries = (db) => ({ |
| apps/hub-api/db/modulePickerSeedQueries.mjs | 3 | MODULE-PRODUCT |     SELECT module_type, size_tier, seed_data_json, updated_at |
| apps/hub-api/db/modulePickerSeedQueries.mjs | 4 | MODULE-PRODUCT |     FROM module_picker_seed_data |
| apps/hub-api/db/modulePickerSeedQueries.mjs | 5 | MODULE-PRODUCT |     ORDER BY module_type ASC, size_tier ASC |
| apps/hub-api/db/schema.mjs | 2 | MODULE-PRODUCT | import { installModulePickerSeedData } from './modulePickerSeedMigration.mjs'; |
| apps/hub-api/db/schema.mjs | 55 | MODULE-PRODUCT |   'module_picker_seed_data', |
| apps/hub-api/db/schema.mjs | 102 | MODULE-PRODUCT |   'idx_module_picker_seed_module_size', |
| apps/hub-api/db/schema.mjs | 774 | MODULE-PRODUCT |     installModulePickerSeedData(db, nowIso); |
| apps/hub-api/db/schema.mjs | 776 | MODULE-PRODUCT |       CREATE INDEX IF NOT EXISTS idx_module_picker_seed_module_size |
| apps/hub-api/db/schema.mjs | 777 | MODULE-PRODUCT |         ON module_picker_seed_data(module_type, size_tier); |
| apps/hub-api/db/statements.mjs | 1 | MODULE-PRODUCT | import { createModulePickerSeedQueries } from './modulePickerSeedQueries.mjs'; |
| apps/hub-api/db/statements.mjs | 6 | MODULE-SYSTEM |  * This module is the seam between application logic and the database engine: |
| apps/hub-api/db/statements.mjs | 27 | MODULE-PRODUCT |   modulePickerSeedData: createModulePickerSeedQueries(db), |
| apps/hub-api/emails/inviteTemplate.mjs | 141 | MODULE-PRODUCT |                           <span style="color: #FFA3CD;">&#9679;</span>&nbsp;&nbsp;Modules: Calendars, Tasks, Reminders, Kanban, Tables, Files &amp; Quick Thoughts |
| apps/hub-api/hub-api.mjs | 32 | MODULE-PRODUCT | import { createModulePickerSeedDataRoutes } from './routes/modulePickerSeedData.mjs'; |
| apps/hub-api/hub-api.mjs | 1413 | MODULE-PRODUCT |     toJson({ modules: [], doc_binding_mode: 'owned' }), |
| apps/hub-api/hub-api.mjs | 1976 | MODULE-PRODUCT | const modulePickerSeedDataRoutes = createModulePickerSeedDataRoutes(routeDeps); |
| apps/hub-api/hub-api.mjs | 2026 | MODULE-PRODUCT |   modulePickerSeedDataRoutes, |
| apps/hub-api/package.json | 5 | MODULE-SYSTEM |   "type": "module", |
| apps/hub-api/routeDeps.mjs | 67 | MODULE-PRODUCT |   modulePickerSeedDataStmt: stmts.modulePickerSeedData.listAll, |
| apps/hub-api/routes/modulePickerSeedData.mjs | 6 | MODULE-PRODUCT |     requestLog?.warn?.('Failed to parse module picker seed data.', { |
| apps/hub-api/routes/modulePickerSeedData.mjs | 7 | MODULE-PRODUCT |       moduleType: row.module_type, |
| apps/hub-api/routes/modulePickerSeedData.mjs | 15 | MODULE-PRODUCT | export const createModulePickerSeedDataRoutes = (deps) => { |
| apps/hub-api/routes/modulePickerSeedData.mjs | 21 | MODULE-PRODUCT |     modulePickerSeedDataStmt, |
| apps/hub-api/routes/modulePickerSeedData.mjs | 25 | MODULE-PRODUCT |     const rows = modulePickerSeedDataStmt.all(); |
| apps/hub-api/routes/modulePickerSeedData.mjs | 27 | MODULE-PRODUCT |       const moduleType = String(row.module_type \|\| ''); |
| apps/hub-api/routes/modulePickerSeedData.mjs | 29 | MODULE-PRODUCT |       if (!moduleType \|\| !sizeTier) { |
| apps/hub-api/routes/modulePickerSeedData.mjs | 32 | MODULE-PRODUCT |       acc[moduleType] = { |
| apps/hub-api/routes/modulePickerSeedData.mjs | 33 | MODULE-PRODUCT |         ...(acc[moduleType] \|\| {}), |
| apps/hub-api/routes/requestRouter.mjs | 27 | MODULE-PRODUCT |   modulePickerSeedDataRoutes, |
| apps/hub-api/routes/requestRouter.mjs | 162 | MODULE-PRODUCT |     if (request.method === 'GET' && pathname === '/api/hub/module-picker/seed-data') { |
| apps/hub-api/routes/requestRouter.mjs | 163 | MODULE-PRODUCT |       await modulePickerSeedDataRoutes.listSeedData({ request, response, requestUrl, pathname }); |
| apps/hub-api/routes/spaces.mjs | 115 | MODULE-PRODUCT |         toJson({ modules: [], doc_binding_mode: 'owned' }), |
| apps/hub-collab/.dockerignore | 1 | MODULE-SYSTEM | node_modules |
| apps/hub-collab/package.json | 5 | MODULE-SYSTEM |   "type": "module", |
| docs/empty-state-audit.md | 1 | MODULE-PRODUCT | # Module Empty State Audit |
| docs/empty-state-audit.md | 11 | MODULE-PRODUCT | - `ModuleEmptyState` only renders a visible title. Its `description` is screen-reader-only (`sr-only`), so sighted users do not see explanatory copy. |
| docs/empty-state-audit.md | 12 | MODULE-PRODUCT | - `ModuleLoadingState` renders skeleton lines with an `sr-only` label; there is no visible loading text or icon. |
| docs/empty-state-audit.md | 14 | MODULE-PRODUCT | ## ModuleGrid (zero modules) |
| docs/empty-state-audit.md | 15 | MODULE-PRODUCT | - Trigger: `modules.length === 0`. |
| docs/empty-state-audit.md | 16 | MODULE-PRODUCT | - What renders: Dashed empty card with `Icon name="plus"`, heading `"Let's get this project started!"`, body copy `"Add a first module to shape the project, then keep building from there."`, and `"Add a module"` button (when `showAddControls` is true). |
| docs/empty-state-audit.md | 19 | MODULE-PRODUCT | - Has CTA: yes (`"Add a module"`, can be disabled by `disableAdd`) |
| docs/empty-state-audit.md | 23 | MODULE-PRODUCT | ## ModuleFeedback (shared wrapper) |
| docs/empty-state-audit.md | 24 | MODULE-PRODUCT | ### Empty wrapper: `ModuleEmptyState` |
| docs/empty-state-audit.md | 25 | MODULE-PRODUCT | - Trigger: Any module returning `<ModuleEmptyState ... />`. |
| docs/empty-state-audit.md | 31 | MODULE-PRODUCT | - Notes: This wrapper is the main reason multiple modules have no icon/CTA on empty. |
| docs/empty-state-audit.md | 33 | MODULE-PRODUCT | ### Loading wrapper: `ModuleLoadingState` |
| docs/empty-state-audit.md | 34 | MODULE-PRODUCT | - Trigger: Any module returning `<ModuleLoadingState ... />`. |
| docs/empty-state-audit.md | 42 | MODULE-PRODUCT | ## TableModuleSkin |
| docs/empty-state-audit.md | 45 | MODULE-PRODUCT | - What renders: `ModuleEmptyState` with title `"No records yet"`. |
| docs/empty-state-audit.md | 47 | MODULE-PRODUCT | - Has message: yes (`"No records yet"`; description is sr-only: `"Add a record to populate this table module."`) |
| docs/empty-state-audit.md | 54 | MODULE-PRODUCT | - What renders: `ModuleEmptyState` with title `"No table view found yet."`. |
| docs/empty-state-audit.md | 63 | MODULE-PRODUCT | - What renders: `ModuleLoadingState` (`label="Loading table records"`, `rows={6}`). |
| docs/empty-state-audit.md | 73 | MODULE-PRODUCT | ## KanbanModuleSkin |
| docs/empty-state-audit.md | 76 | MODULE-PRODUCT | - What renders: `ModuleEmptyState` title `"No kanban grouping configured yet."`. |
| docs/empty-state-audit.md | 103 | MODULE-PRODUCT | - What renders: `ModuleLoadingState` (`label="Loading kanban cards"`, `rows={6}`). |
| docs/empty-state-audit.md | 113 | MODULE-PRODUCT | ## CalendarModuleSkin |
| docs/empty-state-audit.md | 116 | MODULE-PRODUCT | - What renders: `ModuleEmptyState` with scope-aware title: |
| docs/empty-state-audit.md | 128 | MODULE-PRODUCT | - What renders: `ModuleEmptyState` title `"No events today"` plus `"Create event"` button when creation is enabled. |
| docs/empty-state-audit.md | 146 | MODULE-PRODUCT | - What renders: `ModuleLoadingState` (`label="Loading calendar"`, `rows={5}`). |
| docs/empty-state-audit.md | 155 | MODULE-PRODUCT | - Notes: Creation form has inline errors (`"End time must be after start time."`, `"Failed to create event."`), but there is no module-level fetch-failed state. |
| docs/empty-state-audit.md | 157 | MODULE-PRODUCT | ## TasksModuleSkin |
| docs/empty-state-audit.md | 197 | MODULE-PRODUCT | - Trigger: no module-level fetch error path. |
| docs/empty-state-audit.md | 201 | MODULE-PRODUCT | ## RemindersModuleSkin |
| docs/empty-state-audit.md | 232 | MODULE-PRODUCT | ## FilesModuleSkin |
| docs/empty-state-audit.md | 266 | MODULE-PRODUCT | - Trigger: no module-level fetch loading branch. |
| docs/empty-state-audit.md | 273 | MODULE-PRODUCT | ## QuickThoughtsModuleSkin |
| docs/empty-state-audit.md | 296 | MODULE-PRODUCT | \| Module \| State \| Icon \| Message \| CTA \| Meets Standard \| |
| docs/empty-state-audit.md | 298 | MODULE-PRODUCT | \| ModuleGrid \| zero modules \| yes \| yes \| yes \| yes \| |
| docs/empty-state-audit.md | 299 | MODULE-PRODUCT | \| ModuleFeedback \| shared empty wrapper \| no \| partial (title only) \| no \| no \| |
| docs/empty-state-audit.md | 300 | MODULE-PRODUCT | \| ModuleFeedback \| shared loading wrapper \| no \| no (visible) \| no \| no \| |
| docs/empty-state-audit.md | 336 | MODULE-PRODUCT | 1. `ModuleFeedback.ModuleEmptyState` (shared) |
| docs/empty-state-audit.md | 342 | MODULE-PRODUCT | 2. `ModuleFeedback.ModuleLoadingState` (shared) |
| docs/empty-state-audit.md | 343 | MODULE-PRODUCT | - Icon: optional `Icon name="tasks"`/`"calendar"`/`"upload"` based on module context |
| docs/empty-state-audit.md | 350 | MODULE-PRODUCT | - Message: `"This table module is not configured yet."` |
| docs/empty-state-audit.md | 351 | MODULE-PRODUCT | - CTA: `"Select table view"` (open module binding/view picker) |
| docs/hub-os-antipatterns.md | 17 | MODULE-PRODUCT | **What's happening:** The page handles route/query parsing and navigation helpers (`src/pages/ProjectSpacePage.tsx`:233-236,510-629), composes many runtime hooks (`src/pages/ProjectSpacePage.tsx`:253-384), builds a large module runtime adapter object (`src/pages/ProjectSpacePage.tsx`:784-1006), and renders multiple major UI regions/dialogs (`src/pages/ProjectSpacePage.tsx`:1027-2052). The file therefore acts as router adapter, view-model assembler, and view implementation simultaneously. |
| docs/hub-os-antipatterns.md | 21 | MODULE-SYSTEM | ### API entrypoint is a monolith despite route module extraction |
| docs/hub-os-antipatterns.md | 29 | MODULE-PRODUCT | ### Table module skin aggregates many independent concerns in one component |
| docs/hub-os-antipatterns.md | 31 | MODULE-PRODUCT | **Files:** `src/components/project-space/TableModuleSkin.tsx` (lines 453-1478) |
| docs/hub-os-antipatterns.md | 33 | MODULE-PRODUCT | **What's happening:** One component owns filtering, sorting, drag-reorder, virtualization, inline editing, bulk actions, create-row flow, and keyboard grid navigation (`src/components/project-space/TableModuleSkin.tsx`:453-1478). Supporting logic for value normalization and field parsing is also in the same file (`src/components/project-space/TableModuleSkin.tsx`:104-360). |
| docs/hub-os-antipatterns.md | 55 | MODULE-PRODUCT | ### Task rendering diverges across myHub, Overview, and project module surfaces |
| docs/hub-os-antipatterns.md | 57 | MODULE-PRODUCT | **Files:** `src/features/PersonalizedDashboardPanel.tsx` (lines 303-358), `src/components/project-space/OverviewView.tsx` (lines 428-516), `src/components/project-space/TasksModuleSkin.tsx` (lines 142-229, 492-634) |
| docs/hub-os-antipatterns.md | 59 | MODULE-PRODUCT | **What's happening:** myHub uses `ItemRow` cards, Overview wraps `TasksTab` with page-specific controls, and project modules split S/M/L behavior with `TaskSummaryRow`/`TasksTab`. These are separate implementations of the same task-list concept with different interactions and copy. |
| docs/hub-os-antipatterns.md | 65 | MODULE-PRODUCT | **Files:** `src/components/layout/QuickAddDialogs.tsx` (lines 131-218), `src/components/project-space/RemindersModuleSkin.tsx` (lines 323-393, 456-531) |
| docs/hub-os-antipatterns.md | 73 | MODULE-PRODUCT | ### Task composer is a substantial inline component inside TasksModuleSkin |
| docs/hub-os-antipatterns.md | 75 | MODULE-PRODUCT | **Files:** `src/components/project-space/TasksModuleSkin.tsx` (lines 231-400) |
| docs/hub-os-antipatterns.md | 77 | MODULE-PRODUCT | **What's happening:** `TaskComposer` spans creation form state, submit/reset logic, parent-task linking, and error rendering while living inside `TasksModuleSkin.tsx`. It is reused by multiple size tiers (`src/components/project-space/TasksModuleSkin.tsx`:415-416,465-470,582-588). |
| docs/hub-os-antipatterns.md | 91 | MODULE-PRODUCT | **Files:** `src/components/project-space/CalendarModuleSkin.tsx` (lines 191-298) |
| docs/hub-os-antipatterns.md | 93 | MODULE-PRODUCT | **What's happening:** `CalendarMediumWeekStrip` is defined inline and contains its own rendering rules and interaction behavior, while `CalendarModuleSkin` also contains S/L and create-panel logic (`src/components/project-space/CalendarModuleSkin.tsx`:300-901). |
| docs/hub-os-antipatterns.md | 137 | MODULE-PRODUCT | **What's happening:** `ProjectSpacePage` builds a large `workViewModuleRuntime` object containing many module-specific handlers and data, then passes it as `moduleRuntime` into `WorkView`, which fans it back out to module components. Intermediate layers mostly pass through nested runtime slices. |
| docs/hub-os-antipatterns.md | 139 | MODULE-PRODUCT | **Why it matters:** The contract is hard to evolve safely and increases coupling between page orchestration and all module implementations. |
| docs/hub-os-antipatterns.md | 149 | MODULE-PRODUCT | ### ModuleInsertContext stores transient row-level selection globally |
| docs/hub-os-antipatterns.md | 151 | MODULE-PRODUCT | **Files:** `src/context/ModuleInsertContext.tsx` (lines 5-12, 32-67), `src/components/project-space/TasksModuleSkin.tsx` (lines 168-173), `src/components/project-space/RemindersModuleSkin.tsx` (lines 227-231), `src/components/project-space/InboxCaptureModuleSkin.tsx` (lines 176-183) |
| docs/hub-os-antipatterns.md | 153 | MODULE-PRODUCT | **What's happening:** A global context tracks active item id/type/title used for per-row insert affordances across multiple modules. The state is interaction-local and short-lived but globally shared. |
| docs/hub-os-antipatterns.md | 155 | MODULE-PRODUCT | **Why it matters:** Globalizing ephemeral UI state increases hidden coupling between otherwise independent module surfaces. |
| docs/hub-os-antipatterns.md | 169 | MODULE-PRODUCT | **Files:** `src/components/project-space/TasksModuleSkin.tsx` (line 351) |
| docs/hub-os-antipatterns.md | 177 | MODULE-PRODUCT | **Files:** `src/components/layout/AppShell.tsx` (lines 1431, 1464, 1489, 1626, 1698, 1961, 1996), `src/components/hub-home/DayStrip.tsx` (lines 358, 383, 395, 403, 415, 429, 435, 464, 480, 486), `src/components/project-space/FilesModuleSkin.tsx` (lines 171, 180, 192, 262, 349, 406, 457), `src/components/project-space/RemindersModuleSkin.tsx` (lines 238, 570) |
| docs/hub-os-antipatterns.md | 193 | MODULE-PRODUCT | ### “Inbox” and “quick thoughts” are both used for the same module concept |
| docs/hub-os-antipatterns.md | 195 | MODULE-PRODUCT | **Files:** `src/components/project-space/WorkView.tsx` (lines 172-176), `src/components/project-space/InboxCaptureModuleSkin.tsx` (lines 284-520) |
| docs/hub-os-antipatterns.md | 197 | MODULE-PRODUCT | **What's happening:** Runtime normalization maps `inbox` to `quick_thoughts`, while the implementation file and export names still include `InboxCaptureModuleSkin` and `QuickThoughtsModuleSkin`. Two vocabularies describe one module. |
| docs/hub-os-antipatterns.md | 199 | MODULE-PRODUCT | **Why it matters:** Naming inconsistency raises cognitive load when tracing module behavior across files. |
| docs/hub-os-antipatterns.md | 227 | MODULE-PRODUCT | ### Mock project-space data module appears unmounted from production paths |
| docs/hub-os-antipatterns.md | 231 | MODULE-PRODUCT | **What's happening:** The module defines a full mock project/template system, but import search shows no active references from production route components. |
| docs/hub-os-antipatterns.md | 245 | MODULE-PRODUCT | ### Error text is rendered without alert/live semantics in key module composers |
| docs/hub-os-antipatterns.md | 247 | MODULE-PRODUCT | **Files:** `src/components/project-space/TasksModuleSkin.tsx` (line 351), `src/components/project-space/RemindersModuleSkin.tsx` (line 531) |
| docs/hub-os-antipatterns.md | 255 | MODULE-PRODUCT | **Files:** `src/components/project-space/RemindersModuleSkin.tsx` (lines 245-263) |
| docs/hub-os-file-health.md | 10 | MODULE-PRODUCT | \| `src/components/project-space/TableModuleSkin.tsx` \| 1345 \| 4 \| 2 \| 4 \| Critical \| Critical change friction due to very high size (1345 LOC), high responsibility scope (4/5). \| |
| docs/hub-os-file-health.md | 12 | MODULE-PRODUCT | \| `src/components/project-space/KanbanModuleSkin.tsx` \| 1127 \| 4 \| 5 \| 6 \| Red \| High change friction due to large size (1127 LOC), high responsibility scope (4/5), 5 effects, 6 state hooks. \| |
| docs/hub-os-file-health.md | 13 | MODULE-PRODUCT | \| `src/components/project-space/CalendarModuleSkin.tsx` \| 935 \| 4 \| 3 \| 9 \| Red \| High change friction due to large size (935 LOC), high responsibility scope (4/5), 3 effects, 9 state hooks. \| |
| docs/hub-os-file-health.md | 24 | MODULE-PRODUCT | \| `src/components/project-space/TasksModuleSkin.tsx` \| 610 \| 4 \| 0 \| 9 \| Yellow \| Higher change friction due to mid-large size (610 LOC), high responsibility scope (4/5), 9 state hooks. \| |
| docs/hub-os-file-health.md | 30 | MODULE-PRODUCT | \| `src/components/project-space/RemindersModuleSkin.tsx` \| 562 \| 3 \| 2 \| 2 \| Yellow \| Higher change friction due to mid-large size (562 LOC), mixed responsibilities (3/5). \| |
| docs/hub-os-file-health.md | 36 | MODULE-PRODUCT | \| `src/components/project-space/FilesModuleSkin.tsx` \| 572 \| 2 \| 1 \| 1 \| Yellow \| Higher change friction due to mid-large size (572 LOC). \| |
| docs/hub-os-file-health.md | 49 | MODULE-PRODUCT | \| `src/components/project-space/InboxCaptureModuleSkin.tsx` \| 484 \| 2 \| 1 \| 3 \| Watch \| Change risk is moderate due to moderate size (484 LOC). \| |
| docs/hub-os-file-health.md | 84 | MODULE-PRODUCT | \| `src/components/project-space/ModuleGrid.tsx` \| 120 \| 2 \| 0 \| 1 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 87 | MODULE-PRODUCT | \| `src/components/project-space/AddModuleDialog.tsx` \| 150 \| 1 \| 2 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 97 | MODULE-PRODUCT | \| `src/components/project-space/moduleCatalog.ts` \| 101 \| 2 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 101 | MODULE-PRODUCT | \| `src/context/ModuleInsertContext.tsx` \| 73 \| 2 \| 1 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 158 | MODULE-PRODUCT | \| `src/components/project-space/ModuleFeedback.tsx` \| 108 \| 1 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 159 | MODULE-PRODUCT | \| `src/components/project-space/modules/index.ts` \| 8 \| 2 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 160 | MODULE-PRODUCT | \| `src/components/project-space/modules/KanbanModule.tsx` \| 104 \| 1 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 168 | MODULE-PRODUCT | \| `src/components/project-space/modules/TableModule.tsx` \| 93 \| 1 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 178 | MODULE-PRODUCT | \| `src/components/project-space/ModuleShell.tsx` \| 86 \| 1 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 203 | MODULE-PRODUCT | \| `src/components/project-space/modules/QuickThoughtsModule.tsx` \| 30 \| 1 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 209 | MODULE-PRODUCT | \| `src/components/project-space/modules/FilesModule.tsx` \| 30 \| 1 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 210 | MODULE-PRODUCT | \| `src/components/project-space/modules/TasksModule.tsx` \| 30 \| 1 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 211 | MODULE-PRODUCT | \| `src/components/project-space/modules/CalendarModule.tsx` \| 29 \| 1 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 219 | MODULE-PRODUCT | \| `src/components/project-space/modules/RemindersModule.tsx` \| 24 \| 1 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 226 | MODULE-PRODUCT | \| `src/components/project-space/ModuleLensControl.tsx` \| 28 \| 1 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 232 | MODULE-PRODUCT | \| `src/components/project-space/ModuleSettingsPopover.tsx` \| 26 \| 1 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 258 | MODULE-PRODUCT | \| `src/components/project-space/modules/TimelineModule.tsx` \| 16 \| 1 \| 0 \| 0 \| Healthy \| Small, focused file with limited state/effects and narrow dependencies. \| |
| docs/hub-os-file-health.md | 283 | MODULE-SYSTEM |    Despite extracted route modules, the file still combines bootstrap/config, templating, helpers, scheduling, request routing, and server startup (`apps/hub-api/hub-api.mjs`:37-98,99-312,314-3185,3202-3300,3302-4162). Its size and mixed concerns make backend changes hard to isolate safely. |
| docs/hub-os-file-health.md | 285 | MODULE-PRODUCT | 4. **`src/components/project-space/TableModuleSkin.tsx` (lines 104-360, 453-1478; used in `src/pages/ProjectSpacePage.tsx`:64-66,1509-1512)** |
| docs/hub-os-file-health.md | 291 | MODULE-PRODUCT | 6. **`src/components/project-space/KanbanModuleSkin.tsx` (lines 53-1221; lazy-loaded via `src/pages/ProjectSpacePage.tsx`:59-61,1463-1498)** |
| docs/hub-os-file-health.md | 292 | MODULE-PRODUCT |    The module is large and interaction-heavy (grouping, limits, card moves, inline mutations), with multiple local effects/states. Because it is a first-class focused view path in project space, defects here affect a core planning mode. |
| docs/hub-os-file-health.md | 295 | MODULE-PRODUCT |    This hook is central orchestration for collections/views/table+kanban runtime and focused view loading, with seven effects and broad state surface. Its coupling to `ProjectSpacePage` means runtime bugs propagate into several module skins at once. |
| docs/hub-os-file-health.md | 297 | MODULE-PRODUCT | 8. **`src/components/project-space/CalendarModuleSkin.tsx` (lines 191-298, 300-901; used in `src/components/layout/AppShell.tsx`:22,1792)** |
| docs/hub-os-file-health.md | 300 | MODULE-PRODUCT | 9. **`src/components/project-space/TasksTab.tsx` (lines 390-780, 782-1001; used by `src/components/project-space/TasksModuleSkin.tsx`:8,605 and `src/components/project-space/OverviewView.tsx`:9,465)** |
| docs/hub-os-file-health.md | 301 | MODULE-PRODUCT |    The row/action/menu behavior is dense and duplicated across task contexts, and this shared tab component sits underneath both module and overview experiences. Its central reuse makes it a high-leverage stability hotspot. |
| docs/hub-os-patterns.md | 9 | MODULE-PRODUCT | For an example of this pattern, see [src/components/project-space/CalendarModuleSkin/index.tsx](../src/components/project-space/CalendarModuleSkin/index.tsx). |
| docs/hub-os-patterns.md | 14 | MODULE-PRODUCT | For an example of this pattern, see [src/components/project-space/CalendarModuleSkin/hooks/useCalendarCreatePanel.ts](../src/components/project-space/CalendarModuleSkin/hooks/useCalendarCreatePanel.ts) (colocated hook). |
| docs/hub-os-patterns.md | 23 | MODULE-PRODUCT | ## 5. Per-Module Contracts: Typed Props Per Module Type |
| docs/hub-os-patterns.md | 24 | MODULE-PRODUCT | Phase 7 replaced generic context-driven module insertion plumbing (including the deleted `ModuleInsertContext`) with explicit typed contracts per module type. Each module receives a contract that matches its own capabilities (`TableModuleContract`, `KanbanModuleContract`, etc.), so type checking catches cross-module mismatches early and module wrappers stay honest about what they need. |
| docs/hub-os-patterns.md | 26 | MODULE-PRODUCT | For an example of this pattern, see [src/components/project-space/moduleContracts/index.ts](../src/components/project-space/moduleContracts/index.ts). |
| docs/hub-os-patterns.md | 36 | MODULE-PRODUCT | For an example of this pattern, see [src/components/project-space/ModuleShell.tsx](../src/components/project-space/ModuleShell.tsx). |
| docs/inline-css-token-audit-report.md | 29 | MODULE-PRODUCT | \| src/components/project-space/FilesModuleSkin.tsx \| 168 \| `width` \| `\`${Math.min(progress, 100)}%\`` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 30 | MODULE-PRODUCT | \| src/components/project-space/FilesModuleSkin.tsx \| 177 \| `animation` \| `'sparkle-out 0.4s ease-out forwards'` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 31 | MODULE-PRODUCT | \| src/components/project-space/FilesModuleSkin.tsx \| 177 \| `['--angle' as string]` \| `sparkle.angle` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 32 | MODULE-PRODUCT | \| src/components/project-space/FilesModuleSkin.tsx \| 177 \| `['--travel' as string]` \| `sparkle.travel` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 33 | MODULE-PRODUCT | \| src/components/project-space/FilesModuleSkin.tsx \| 189 \| `animation` \| `'fade-in-out 1.5s ease forwards'` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 34 | MODULE-PRODUCT | \| src/components/project-space/QuickThoughtsModuleSkin.tsx \| 197 \| `opacity` \| `entry.archived ? 0.6 : 1` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 35 | MODULE-PRODUCT | \| src/components/project-space/KanbanModuleSkin.tsx \| 117 \| `transform` \| `CSS.Transform.toString(transform)` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 36 | MODULE-PRODUCT | \| src/components/project-space/KanbanModuleSkin.tsx \| 117 \| `opacity` \| `isDragging ? 0.65 : 1` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 37 | MODULE-PRODUCT | \| src/components/project-space/RemindersModuleSkin.tsx \| 469 \| `width` \| `\`${particle.size}px\`` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 38 | MODULE-PRODUCT | \| src/components/project-space/RemindersModuleSkin.tsx \| 469 \| `height` \| `\`${particle.size}px\`` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 39 | MODULE-PRODUCT | \| src/components/project-space/RemindersModuleSkin.tsx \| 469 \| `backgroundColor` \| `particle.color` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 40 | MODULE-PRODUCT | \| src/components/project-space/RemindersModuleSkin.tsx \| 469 \| `'--sparkle-x'` \| `\`${particle.x}px\`` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 41 | MODULE-PRODUCT | \| src/components/project-space/RemindersModuleSkin.tsx \| 469 \| `'--sparkle-y'` \| `\`${particle.y}px\`` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 42 | MODULE-PRODUCT | \| src/components/project-space/RemindersModuleSkin.tsx \| 469 \| `'--sparkle-duration'` \| `\`${particle.duration}ms\`` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 43 | MODULE-PRODUCT | \| src/components/project-space/RemindersModuleSkin.tsx \| 469 \| `'--sparkle-delay'` \| `\`${particle.delay}ms\`` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 44 | MODULE-PRODUCT | \| src/components/project-space/RemindersModuleSkin.tsx \| 494 \| `clipPath` \| `'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)'` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 45 | MODULE-PRODUCT | \| src/components/project-space/TableModuleSkin.tsx \| 179 \| `gridTemplateColumns` \| `templateColumns` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 46 | MODULE-PRODUCT | \| src/components/project-space/TableModuleSkin.tsx \| 230 \| `height` \| `\`${virtualizer.getTotalSize()}px\`` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 47 | MODULE-PRODUCT | \| src/components/project-space/TableModuleSkin.tsx \| 230 \| `position` \| `'relative'` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 48 | MODULE-PRODUCT | \| src/components/project-space/TableModuleSkin.tsx \| 269 \| `transform` \| `\`translateY(${item.start}px)\`` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 49 | MODULE-PRODUCT | \| src/components/project-space/TableModuleSkin.tsx \| 269 \| `gridTemplateColumns` \| `templateColumns` \| no token reference \| |
| docs/inline-css-token-audit-report.md | 50 | MODULE-PRODUCT | \| src/components/project-space/TableModuleSkin.tsx \| 269 \| `height` \| `\`${item.size}px\`` \| no token reference \| |
| docs/module-height-audit.md | 1 | MODULE-PRODUCT | # Module Height Chain Audit |
| docs/module-height-audit.md | 3 | MODULE-PRODUCT | ## 1. Page → Work View → Module Grid (height chain) |
| docs/module-height-audit.md | 8 | MODULE-PRODUCT | - Flex grow/shrink: no `flex-1`, `grow`, `shrink`, or split-project height contract between modules and editor. |
| docs/module-height-audit.md | 9 | MODULE-PRODUCT | - Overflow: no page-level `overflow-y-auto` / `overflow-hidden` around the work content chain. The only `h-screen overflow-y-auto` in this file is the inspector dialog panel, not the module area. |
| docs/module-height-audit.md | 11 | MODULE-PRODUCT | - Tailwind height classes: no `h-full` / `h-screen` in the module chain (again, except inspector dialog). |
| docs/module-height-audit.md | 12 | MODULE-PRODUCT | - JS height calculation: none (`calc(100vh - ...)` style logic is absent for work/module layout). |
| docs/module-height-audit.md | 16 | MODULE-PRODUCT | - Height chain role: orchestrates module controls + `ModuleGrid`; does not allocate fixed space between module grid and editor. |
| docs/module-height-audit.md | 17 | MODULE-PRODUCT | - Explicit height/min/max: none on root (`<section className="space-y-4">`) or module region. |
| docs/module-height-audit.md | 19 | MODULE-PRODUCT | - Overflow: none on root/module region. |
| docs/module-height-audit.md | 20 | MODULE-PRODUCT | - Grid row sizing: delegated to `ModuleGrid`. |
| docs/module-height-audit.md | 23 | MODULE-PRODUCT | - Allocation behavior (module grid vs editor): this component does not perform a split layout. Modules are rendered in-flow, and in the current page integration the workspace doc is rendered outside `WorkView` as a following sibling. |
| docs/module-height-audit.md | 25 | MODULE-PRODUCT | ### `src/components/project-space/ModuleGrid.tsx` |
| docs/module-height-audit.md | 26 | MODULE-PRODUCT | - Height chain role: defines module card grid width placement. |
| docs/module-height-audit.md | 27 | MODULE-PRODUCT | - Explicit height/min/max: none on grid container or module cards. |
| docs/module-height-audit.md | 39 | MODULE-PRODUCT | - Result: each card’s height is entirely intrinsic to module content. |
| docs/module-height-audit.md | 41 | MODULE-PRODUCT | ### `src/components/project-space/ModuleFeedback.tsx` |
| docs/module-height-audit.md | 42 | MODULE-PRODUCT | - Height chain role: loading/empty wrappers used by modules. |
| docs/module-height-audit.md | 44 | MODULE-PRODUCT | - `ModuleLoadingState` rows use fixed bar height (`h-3`) but container has no explicit overall height. |
| docs/module-height-audit.md | 45 | MODULE-PRODUCT | - `ModuleEmptyState` also has no explicit fixed height. |
| docs/module-height-audit.md | 53 | MODULE-PRODUCT | - `WorkView.parseModules(...)` normalizes `size_tier` to `S \| M \| L` with fallback `M`. |
| docs/module-height-audit.md | 54 | MODULE-PRODUCT | - `WorkView.serializeModules(...)` persists `size_tier` back into `layout_config.modules`. |
| docs/module-height-audit.md | 57 | MODULE-PRODUCT | - `ModuleGrid.sizeClass` is the primary visual mapping: |
| docs/module-height-audit.md | 63 | MODULE-PRODUCT | ### Tier-driven behavior inside modules (indirect height impact) |
| docs/module-height-audit.md | 64 | MODULE-PRODUCT | - `TasksModuleSkin`: tier switches component variant (`Small`, `Medium`, `Large`) with different UI density/content volume. |
| docs/module-height-audit.md | 65 | MODULE-PRODUCT | - `FilesModuleSkin`: tier switches variant (`Small`, `Medium`, `Large`) with different list/grid density. |
| docs/module-height-audit.md | 66 | MODULE-PRODUCT | - `RemindersModuleSkin`: tier changes visible item cap (`S=3`, `M=6`, `L=unbounded`). |
| docs/module-height-audit.md | 67 | MODULE-PRODUCT | - `QuickThoughtsModuleSkin`: tier changes composer visibility and entry truncation behavior (`M` slices visible entries, `L` can show archive section). |
| docs/module-height-audit.md | 68 | MODULE-PRODUCT | - `TableModuleSkin`, `KanbanModuleSkin`, `CalendarModuleSkin`, `TimelineModule` path: no tier prop used for height. |
| docs/module-height-audit.md | 72 | MODULE-PRODUCT | - Height is not standardized by tier at container level; any height differences are module-specific content behavior. |
| docs/module-height-audit.md | 74 | MODULE-PRODUCT | ## 3. Module Wrappers (per module) |
| docs/module-height-audit.md | 76 | MODULE-PRODUCT | ### `TableModule` (`src/components/project-space/modules/TableModule.tsx`) |
| docs/module-height-audit.md | 77 | MODULE-PRODUCT | - Props received: `module`, `runtime`, edit capability, `onOpenRecord`, `onSetModuleBinding`. |
| docs/module-height-audit.md | 78 | MODULE-PRODUCT | - Dimension-related data: receives `module.size_tier` but does not use/pass it. |
| docs/module-height-audit.md | 83 | MODULE-PRODUCT | ### `KanbanModule` (`src/components/project-space/modules/KanbanModule.tsx`) |
| docs/module-height-audit.md | 84 | MODULE-PRODUCT | - Props: `module`, `runtime`, edit capability, `onOpenRecord`, `onSetModuleBinding`. |
| docs/module-height-audit.md | 85 | MODULE-PRODUCT | - Dimension-related data: `module.size_tier` available but unused. |
| docs/module-height-audit.md | 89 | MODULE-PRODUCT | ### `CalendarModule` (`src/components/project-space/modules/CalendarModule.tsx`) |
| docs/module-height-audit.md | 95 | MODULE-PRODUCT | ### `TasksModule` (`src/components/project-space/modules/TasksModule.tsx`) |
| docs/module-height-audit.md | 96 | MODULE-PRODUCT | - Props: `module`, `runtime`, edit capability. |
| docs/module-height-audit.md | 97 | MODULE-PRODUCT | - Dimension-related data: passes `sizeTier={module.size_tier \|\| 'M'}`. |
| docs/module-height-audit.md | 101 | MODULE-PRODUCT | ### `FilesModule` (`src/components/project-space/modules/FilesModule.tsx`) |
| docs/module-height-audit.md | 102 | MODULE-PRODUCT | - Props: `module`, `runtime`, edit capability. |
| docs/module-height-audit.md | 103 | MODULE-PRODUCT | - Dimension-related data: passes `sizeTier={module.size_tier}`. |
| docs/module-height-audit.md | 107 | MODULE-PRODUCT | ### `RemindersModule` (`src/components/project-space/modules/RemindersModule.tsx`) |
| docs/module-height-audit.md | 108 | MODULE-PRODUCT | - Props: `module`, `runtime`. |
| docs/module-height-audit.md | 109 | MODULE-PRODUCT | - Dimension-related data: passes `sizeTier={module.size_tier}`. |
| docs/module-height-audit.md | 113 | MODULE-PRODUCT | ### `QuickThoughtsModule` (`src/components/project-space/modules/QuickThoughtsModule.tsx`) |
| docs/module-height-audit.md | 114 | MODULE-PRODUCT | - Props: `module`, `runtime`, `project`, edit capability. |
| docs/module-height-audit.md | 115 | MODULE-PRODUCT | - Dimension-related data: passes `sizeTier={module.size_tier}`. |
| docs/module-height-audit.md | 119 | MODULE-PRODUCT | ### `TimelineModule` (`src/components/project-space/modules/TimelineModule.tsx`) |
| docs/module-height-audit.md | 125 | MODULE-PRODUCT | ## 4. Module Skins (outer container only) |
| docs/module-height-audit.md | 127 | MODULE-PRODUCT | ### `TableModuleSkin` (`src/components/project-space/TableModuleSkin.tsx`) |
| docs/module-height-audit.md | 134 | MODULE-PRODUCT | ### `KanbanModuleSkin` (`src/components/project-space/KanbanModuleSkin.tsx`) |
| docs/module-height-audit.md | 142 | MODULE-PRODUCT | ### `CalendarModuleSkin` (`src/components/project-space/CalendarModuleSkin.tsx`) |
| docs/module-height-audit.md | 148 | MODULE-PRODUCT | - No module-level vertical max-height/scroll container at skin root. |
| docs/module-height-audit.md | 153 | MODULE-PRODUCT | ### `TasksModuleSkin` (`src/components/project-space/TasksModuleSkin.tsx`) |
| docs/module-height-audit.md | 158 | MODULE-PRODUCT | - Overflow: no module-root vertical scroll cap. |
| docs/module-height-audit.md | 161 | MODULE-PRODUCT | ### `RemindersModuleSkin` (`src/components/project-space/RemindersModuleSkin.tsx`) |
| docs/module-height-audit.md | 166 | MODULE-PRODUCT | - no module-root max-height/scroll. |
| docs/module-height-audit.md | 169 | MODULE-PRODUCT | ### `FilesModuleSkin` (`src/components/project-space/FilesModuleSkin.tsx`) |
| docs/module-height-audit.md | 174 | MODULE-PRODUCT | - no module-root vertical max-height/scroll cap. |
| docs/module-height-audit.md | 177 | MODULE-PRODUCT | ### `QuickThoughtsModuleSkin` (`src/components/project-space/QuickThoughtsModuleSkin.tsx`) |
| docs/module-height-audit.md | 180 | MODULE-PRODUCT | - Overflow: no module-root scroll cap. |
| docs/module-height-audit.md | 184 | MODULE-PRODUCT | - `src/components/project-space/designTokens.ts`: no height/size layout tokens for module containers. |
| docs/module-height-audit.md | 185 | MODULE-PRODUCT | - `tokens.css`: includes calendar-related height token `--day-hour-height: 64px` (and `--day-ruler-width`) but no shared module-card height token. |
| docs/module-height-audit.md | 189 | MODULE-PRODUCT | - Problem 1: No viewport-to-module height contract. |
| docs/module-height-audit.md | 190 | MODULE-PRODUCT | - The chain from page (`ProjectSpacePage`) through `WorkView` to `ModuleGrid` uses normal flow blocks with no explicit container height or flex growth model. Modules expand by content, so there is no guaranteed bounded content region per module. |
| docs/module-height-audit.md | 193 | MODULE-PRODUCT | - `ModuleGrid` only maps S/M/L to column span. Row height is auto-content. This means card height consistency is not enforced and modules can become arbitrarily tall. |
| docs/module-height-audit.md | 196 | MODULE-PRODUCT | - `TableModuleSkin` has an internal `max-h-[26rem] overflow-auto`, while most other skins have no equivalent vertical cap. Result: mixed behavior where some modules scroll internally and others push page height. |
| docs/module-height-audit.md | 198 | MODULE-PRODUCT | - Problem 4: Potential clipping points exist only in local sub-elements, not in module roots. |
| docs/module-height-audit.md | 199 | MODULE-PRODUCT | - Some inner elements use `overflow-hidden` (e.g., reminder ribbons, thumbnail regions), but module roots do not provide a controlled scroll container. If inner content grows unexpectedly, clipping can occur locally while overall module still expands. |
| docs/module-height-audit.md | 207 | MODULE-PRODUCT | - Make the Work area a bounded container (viewport-anchored via app shell) and allocate module/doc regions via flex or grid (`min-h-0` on scroll parents). |
| docs/module-height-audit.md | 214 | MODULE-PRODUCT | 3. Add explicit module card structure for stable internals. |
| docs/module-height-audit.md | 221 | MODULE-PRODUCT | 5. Introduce shared tokens for module heights. |
| docs/module-height-audit.md | 222 | MODULE-PRODUCT | - Add tokens like `--module-card-max-h-s\|m\|l` (and optional min-height) and consume them in module skins instead of one-off values. |
| docs/nlp-parser-dependency-audit.md | 6 | MODULE-SYSTEM | Counts below are import statements. The `External` bucket includes Node built-ins used in tests; the third-party package list only includes non-Node packages from `node_modules`. |
| docs/swift-native-parity-assessment.md | 35 | MODULE-PRODUCT | The web app is a routed SPA built around global providers and large feature modules. |
| docs/swift-native-parity-assessment.md | 65 | MODULE-PRODUCT | - There are route modules for spaces, work projects, docs, collections, records, views, tasks, reminders, files, search, chat, notifications, automations, and users. |
| docs/swift-native-parity-assessment.md | 289 | MODULE-PRODUCT | ### 4. Advanced modules and interaction-heavy views |
| docs/swift-native-parity-assessment.md | 293 | MODULE-PRODUCT | - `src/components/project-space/TableModuleSkin.tsx` |
| docs/swift-native-parity-assessment.md | 294 | MODULE-PRODUCT | - `src/components/project-space/KanbanModuleSkin.tsx` |
| docs/swift-native-parity-assessment.md | 295 | MODULE-PRODUCT | - `src/components/project-space/CalendarModuleSkin.tsx` |
| docs/swift-native-parity-assessment.md | 297 | MODULE-PRODUCT | - `src/components/project-space/FilesModuleSkin.tsx` |
| docs/swift-native-parity-assessment.md | 298 | MODULE-PRODUCT | - `src/components/project-space/TasksModuleSkin.tsx` |
| docs/swift-native-parity-assessment.md | 569 | MODULE-PRODUCT | - advanced interactive module skins/components |
| docs/swift-native-parity-assessment.md | 592 | MODULE-PRODUCT | - advanced interactive UI modules |
| docs/ux-architecture-audit.md | 7 | MODULE-PRODUCT | - `work`: the tab where projects and their modules are opened. |
| docs/ux-architecture-audit.md | 41 | MODULE-PRODUCT | - Record inspector, module runtime, members, files, reminders, tasks, and views should remain owned by hooks below the page host. |
| docs/ux-architecture-audit.md | 48 | MODULE-PRODUCT | - Empty focused project: keep the project chrome stable and show module-specific empty states inside each module. |
| docs/ux-architecture-audit.md | 52 | MODULE-PRODUCT | - Space and project naming still passes through compatibility function names in a few route and service modules. |
| e2e/auth.setup.ts | 76 | MODULE-PRODUCT |       modules_enabled: true, |
| e2e/auth.setup.ts | 78 | MODULE-PRODUCT |       modules: [ |
| e2e/auth.setup.ts | 80 | MODULE-PRODUCT |           module_instance_id: `table-${runId}`, |
| e2e/auth.setup.ts | 81 | MODULE-PRODUCT |           module_type: 'table', |
| e2e/auth.setup.ts | 87 | MODULE-PRODUCT |           module_instance_id: `kanban-${runId}`, |
| e2e/auth.setup.ts | 88 | MODULE-PRODUCT |           module_type: 'kanban', |
| e2e/auth.setup.ts | 94 | MODULE-PRODUCT |           module_instance_id: `files-${runId}`, |
| e2e/auth.setup.ts | 95 | MODULE-PRODUCT |           module_type: 'files', |
| e2e/auth.setup.ts | 107 | MODULE-PRODUCT |       modules_enabled: true, |
| e2e/auth.setup.ts | 109 | MODULE-PRODUCT |       modules: [ |
| e2e/auth.setup.ts | 111 | MODULE-PRODUCT |           module_instance_id: `table-${runId}-private`, |
| e2e/auth.setup.ts | 112 | MODULE-PRODUCT |           module_type: 'table', |
| e2e/eshaan-os.audit.spec.ts | 139 | MODULE-PRODUCT |     await expect(page.getByLabel('Table module')).toBeVisible(); |
| e2e/eshaan-os.audit.spec.ts | 219 | MODULE-PRODUCT |     const tableModule = page.getByLabel('Table module').first(); |
| e2e/eshaan-os.audit.spec.ts | 220 | MODULE-PRODUCT |     await expect(tableModule).toBeVisible(); |
| e2e/eshaan-os.audit.spec.ts | 221 | MODULE-PRODUCT |     await expect(tableModule.getByRole('button', { name: `Open record ${fixture.tasks.todoTitle}` })).toBeVisible(); |
| e2e/eshaan-os.audit.spec.ts | 226 | MODULE-PRODUCT |     const tableModule = page.getByLabel('Table module').first(); |
| e2e/eshaan-os.audit.spec.ts | 227 | MODULE-PRODUCT |     await tableModule.getByRole('button', { name: `Open record ${fixture.tasks.todoTitle}` }).click(); |
| e2e/eshaan-os.audit.spec.ts | 240 | MODULE-PRODUCT |     await expect(page.getByLabel('Table module').first().getByRole('grid')).toBeVisible(); |
| e2e/eshaan-os.audit.spec.ts | 290 | MODULE-PRODUCT |   test('Files module renders in a project, the file list loads, and upload controls exist', async ({ page }) => { |
| e2e/eshaan-os.audit.spec.ts | 292 | MODULE-PRODUCT |     const filesModule = page.getByLabel('Files module'); |
| e2e/eshaan-os.audit.spec.ts | 293 | MODULE-PRODUCT |     await expect(filesModule).toBeVisible(); |
| e2e/eshaan-os.audit.spec.ts | 294 | MODULE-PRODUCT |     await expect(filesModule.getByRole('list', { name: 'Files' })).toBeVisible(); |
| e2e/eshaan-os.audit.spec.ts | 295 | MODULE-PRODUCT |     await expect(filesModule.getByRole('button', { name: 'Upload files' })).toBeVisible(); |
| e2e/eshaan-os.audit.spec.ts | 316 | MODULE-PRODUCT |     await expect(page.getByTestId('add-module-table')).toBeVisible(); |
| e2e/eshaan-os.audit.spec.ts | 328 | MODULE-PRODUCT |         'This fixture grants the secondary user project member access plus explicit membership on the shared project, so project-title editing remains enabled while project-level create/module controls stay hidden.', |
| e2e/eshaan-os.audit.spec.ts | 333 | MODULE-PRODUCT |       await expect(page.getByTestId('add-module-table')).toHaveCount(0); |
| e2e/package.json | 5 | MODULE-SYSTEM |   "type": "module", |
| e2e/project-space-workspace/seed.ts | 198 | MODULE-PRODUCT |       modules_enabled: true, |
| e2e/project-space-workspace/seed.ts | 200 | MODULE-PRODUCT |       modules: [ |
| e2e/project-space-workspace/seed.ts | 202 | MODULE-PRODUCT |           module_instance_id: `table-${runId}`, |
| e2e/project-space-workspace/seed.ts | 203 | MODULE-PRODUCT |           module_type: 'table', |
| e2e/project-space-workspace/seed.ts | 209 | MODULE-PRODUCT |           module_instance_id: `kanban-${runId}`, |
| e2e/project-space-workspace/seed.ts | 210 | MODULE-PRODUCT |           module_type: 'kanban', |
| e2e/project-space-workspace/seed.ts | 223 | MODULE-PRODUCT |       modules_enabled: true, |
| e2e/project-space-workspace/seed.ts | 225 | MODULE-PRODUCT |       modules: [ |
| e2e/project-space-workspace/seed.ts | 227 | MODULE-PRODUCT |           module_instance_id: `table-private-${runId}`, |
| e2e/project-space-workspace/seed.ts | 228 | MODULE-PRODUCT |           module_type: 'table', |
| e2e/project-space-workspace/verify-project-space-workspace.spec.ts | 89 | MODULE-PRODUCT |     const tableModule = page.getByLabel('Table module').first(); |
| e2e/project-space-workspace/verify-project-space-workspace.spec.ts | 90 | MODULE-PRODUCT |     await tableModule.getByRole('button', { name: new RegExp(`Open record ${escapeRegExp(fixture.recordTitle)}`, 'i') }).click(); |
| e2e/tests/event-creation.spec.ts | 24 | MODULE-PRODUCT |       modules_enabled: true, |
| e2e/tests/event-creation.spec.ts | 27 | MODULE-PRODUCT |       modules: [ |
| e2e/tests/event-creation.spec.ts | 29 | MODULE-PRODUCT |           module_instance_id: `calendar-${runId}`, |
| e2e/tests/event-creation.spec.ts | 30 | MODULE-PRODUCT |           module_type: 'calendar', |
| e2e/tests/rename-trace.spec.ts | 291 | MODULE-PRODUCT |       modules_enabled: true, |
| e2e/tests/rename-trace.spec.ts | 294 | MODULE-PRODUCT |       modules: [ |
| e2e/tests/rename-trace.spec.ts | 295 | MODULE-PRODUCT |         { module_instance_id: `tasks-${idSuffix}`, module_type: 'tasks', size_tier: 'M', lens: 'project' }, |
| e2e/tests/rename-trace.spec.ts | 296 | MODULE-PRODUCT |         { module_instance_id: `reminders-${idSuffix}`, module_type: 'reminders', size_tier: 'M', lens: 'project' }, |
| e2e/tests/rename-trace.spec.ts | 297 | MODULE-PRODUCT |         { module_instance_id: `files-${idSuffix}`, module_type: 'files', size_tier: 'M', lens: 'project' }, |
| e2e/tests/rename-trace.spec.ts | 304 | MODULE-PRODUCT |       modules_enabled: true, |
| e2e/tests/rename-trace.spec.ts | 307 | MODULE-PRODUCT |       modules: [ |
| e2e/tests/rename-trace.spec.ts | 308 | MODULE-PRODUCT |         { module_instance_id: `tasks-beta-${idSuffix}`, module_type: 'tasks', size_tier: 'M', lens: 'project' }, |
| e2e/tests/rename-trace.spec.ts | 365 | MODULE-PRODUCT |       modules_enabled: true, |
| e2e/tests/rename-trace.spec.ts | 368 | MODULE-PRODUCT |       modules: [ |
| e2e/tests/rename-trace.spec.ts | 369 | MODULE-PRODUCT |         { module_instance_id: `tasks-${idSuffix}`, module_type: 'tasks', size_tier: 'M', lens: 'project' }, |
| e2e/tests/rename-trace.spec.ts | 370 | MODULE-PRODUCT |         { module_instance_id: `reminders-${idSuffix}`, module_type: 'reminders', size_tier: 'M', lens: 'project' }, |
| e2e/tests/rename-trace.spec.ts | 371 | MODULE-PRODUCT |         { module_instance_id: `files-${idSuffix}`, module_type: 'files', size_tier: 'M', lens: 'project' }, |
| e2e/tests/rename-trace.spec.ts | 373 | MODULE-PRODUCT |           module_instance_id: `table-${idSuffix}`, |
| e2e/tests/rename-trace.spec.ts | 374 | MODULE-PRODUCT |           module_type: 'table', |
| e2e/tsconfig.json | 4 | MODULE-SYSTEM |     "module": "ESNext", |
| e2e/tsconfig.json | 6 | MODULE-SYSTEM |     "moduleResolution": "bundler", |
| e2e/tsconfig.json | 9 | MODULE-SYSTEM |     "resolveJsonModule": true, |
| e2e/tsconfig.json | 10 | MODULE-SYSTEM |     "isolatedModules": true, |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 81 | MODULE-PRODUCT | const openAddModuleDialog = async (page: Page): Promise<void> => { |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 82 | MODULE-PRODUCT |   const addModuleButton = page.getByRole('button', { name: /Add module\|Add a module/i }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 83 | MODULE-PRODUCT |   await expect(addModuleButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 84 | MODULE-PRODUCT |   await addModuleButton.click(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 85 | MODULE-PRODUCT |   await expect(page.getByRole('heading', { name: /^Add Module$/i })).toBeVisible({ timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 189 | MODULE-PRODUCT | const getFilesModule = (page: Page): Locator => page.getByRole('region', { name: 'Files module' }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 190 | MODULE-PRODUCT | const getTableModule = (page: Page): Locator => page.getByRole('region', { name: 'Table module' }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 191 | MODULE-PRODUCT | const getTasksModule = (page: Page): Locator => page.getByRole('region', { name: 'Tasks module' }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 192 | MODULE-PRODUCT | const getRemindersModule = (page: Page): Locator => page.getByRole('region', { name: 'Reminders module' }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 194 | MODULE-PRODUCT | const getKanbanModuleCard = (page: Page): Locator => { |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 196 | MODULE-PRODUCT |     .locator('[data-testid="module-card"]') |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 197 | MODULE-PRODUCT |     .filter({ has: page.getByRole('button', { name: /Kanban module actions/i }) }) |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 201 | MODULE-PRODUCT | const getCalendarModuleCard = (page: Page): Locator => { |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 205 | MODULE-PRODUCT |       has: page.getByRole('button', { name: /Calendar module actions\|New Event\|Previous week\|Previous day/i }).first(), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 210 | MODULE-PRODUCT | const ensureModuleAdded = async ( |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 212 | MODULE-PRODUCT |   moduleLabel: string, |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 220 | MODULE-PRODUCT |   await openAddModuleDialog(page); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 223 | MODULE-PRODUCT |     name: new RegExp(`^Select ${escapeRegExp(moduleLabel)} module$`, 'i'), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 229 | MODULE-PRODUCT |     name: new RegExp(`^Add ${escapeRegExp(moduleLabel)} at ${sizeTier} size$`, 'i'), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 237 | MODULE-PRODUCT | const ensureCalendarReadyForCreate = async (calendarModule: Locator): Promise<void> => { |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 238 | MODULE-PRODUCT |   const newEventButton = calendarModule.getByRole('button', { name: /^New Event$/i }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 244 | MODULE-PRODUCT |   const showAllButton = calendarModule.getByRole('button', { name: /^Show All$/i }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 247 | MODULE-PRODUCT |     await expect(calendarModule.getByText('Loading calendar')).toHaveCount(0, { timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 251 | MODULE-PRODUCT |   const allScopeButton = calendarModule.getByRole('button', { name: /^All$/i }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 254 | MODULE-PRODUCT |     await expect(calendarModule.getByText('Loading calendar')).toHaveCount(0, { timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 361 | MODULE-PRODUCT |     await runPhase(report, desktopPage, 'modules', async () => { |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 362 | MODULE-PRODUCT |       await ensureModuleAdded(desktopPage, 'Files', 'S', getFilesModule(desktopPage)); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 363 | MODULE-PRODUCT |       await ensureModuleAdded(desktopPage, 'Table', 'M', getTableModule(desktopPage)); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 364 | MODULE-PRODUCT |       await ensureModuleAdded(desktopPage, 'Kanban', 'M', getKanbanModuleCard(desktopPage)); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 365 | MODULE-PRODUCT |       await ensureModuleAdded(desktopPage, 'Calendar', 'L', getCalendarModuleCard(desktopPage)); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 366 | MODULE-PRODUCT |       await ensureModuleAdded(desktopPage, 'Tasks', 'M', getTasksModule(desktopPage)); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 367 | MODULE-PRODUCT |       await ensureModuleAdded(desktopPage, 'Reminders', 'M', getRemindersModule(desktopPage)); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 368 | MODULE-PRODUCT |       await ensureModuleAdded(desktopPage, 'Quick Thoughts', 'M', desktopPage.getByLabel('Quick Thought editor').first()); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 371 | MODULE-PRODUCT |         files: await snapshotLocator(getFilesModule(desktopPage)), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 372 | MODULE-PRODUCT |         table: await snapshotLocator(getTableModule(desktopPage)), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 373 | MODULE-PRODUCT |         kanban: await snapshotLocator(getKanbanModuleCard(desktopPage)), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 374 | MODULE-PRODUCT |         calendar: await snapshotLocator(getCalendarModuleCard(desktopPage)), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 375 | MODULE-PRODUCT |         tasks: await snapshotLocator(getTasksModule(desktopPage)), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 376 | MODULE-PRODUCT |         reminders: await snapshotLocator(getRemindersModule(desktopPage)), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 383 | MODULE-PRODUCT |       await openAddModuleDialog(desktopPage); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 387 | MODULE-PRODUCT |       const tableActionsButton = desktopPage.getByRole('button', { name: /Open Table module actions/i }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 394 | MODULE-PRODUCT |         addModuleDialog: dialogSnapshot, |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 400 | MODULE-PRODUCT |       const tableModule = getTableModule(desktopPage); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 401 | MODULE-PRODUCT |       const createRowInput = tableModule.getByRole('textbox', { name: 'New record...' }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 404 | MODULE-PRODUCT |       await tableModule.getByRole('button', { name: /^Add$/i }).first().click(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 406 | MODULE-PRODUCT |       const openRecordButton = tableModule.getByRole('button', { |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 418 | MODULE-PRODUCT |         table: await snapshotLocator(tableModule, { tableTitle: artifacts.tableTitle }), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 424 | MODULE-PRODUCT |       const kanbanModule = getKanbanModuleCard(desktopPage); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 425 | MODULE-PRODUCT |       const firstColumn = kanbanModule.locator('section[aria-label$=" column"]').first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 434 | MODULE-PRODUCT |       const openRecordButton = kanbanModule.getByRole('button', { |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 445 | MODULE-PRODUCT |       const columnSelect = kanbanModule.getByLabel(`Column for ${artifacts.kanbanTitle}`).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 449 | MODULE-PRODUCT |         kanban: await snapshotLocator(kanbanModule, { kanbanTitle: artifacts.kanbanTitle }), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 455 | MODULE-PRODUCT |       const calendarModule = getCalendarModuleCard(desktopPage); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 456 | MODULE-PRODUCT |       await ensureCalendarReadyForCreate(calendarModule); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 458 | MODULE-PRODUCT |       let newEventButton = calendarModule.getByRole('button', { name: /^New Event$/i }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 460 | MODULE-PRODUCT |         newEventButton = calendarModule.getByRole('button', { name: /^Create event for /i }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 465 | MODULE-PRODUCT |       const titleInput = calendarModule.getByLabel(/Event title\|Write an event in natural language/i).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 468 | MODULE-PRODUCT |       await calendarModule.getByLabel('Start time').first().fill('09:30'); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 469 | MODULE-PRODUCT |       await calendarModule.getByLabel('End time').first().fill('10:30'); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 470 | MODULE-PRODUCT |       await calendarModule.getByRole('button', { name: /^Create$/i }).first().click(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 474 | MODULE-PRODUCT |         calendar: await snapshotLocator(calendarModule, { calendarTitle: artifacts.calendarTitle }), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 475 | MODULE-PRODUCT |         matchingButtons: await calendarModule.getByRole('button', { |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 482 | MODULE-PRODUCT |       const tasksModule = getTasksModule(desktopPage); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 483 | MODULE-PRODUCT |       let titleInput = tasksModule.getByLabel(/New task title\|Write a task in natural language/i).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 485 | MODULE-PRODUCT |         const openComposerButton = tasksModule.getByRole('button', { name: /^New Task$/i }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 488 | MODULE-PRODUCT |         titleInput = tasksModule.getByLabel(/New task title\|Write a task in natural language/i).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 492 | MODULE-PRODUCT |       await tasksModule.getByRole('button', { name: /^(Add\|Create task\|Create)$/i }).first().click(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 495 | MODULE-PRODUCT |       const toggleButton = tasksModule.getByRole('button', { |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 500 | MODULE-PRODUCT |         tasks: await snapshotLocator(tasksModule, { taskTitle: artifacts.taskTitle }), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 511 | MODULE-PRODUCT |       const remindersModule = getRemindersModule(desktopPage); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 512 | MODULE-PRODUCT |       const input = remindersModule.getByLabel(/Reminder\|Write a reminder in natural language/i).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 515 | MODULE-PRODUCT |       await remindersModule.getByRole('button', { name: /^Add$/i }).first().click(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 517 | MODULE-PRODUCT |       await remindersModule.getByRole('button', { name: /^Add$/i }).first().click(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 521 | MODULE-PRODUCT |         reminders: await snapshotLocator(remindersModule, { |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 530 | MODULE-PRODUCT |       const filesModule = getFilesModule(desktopPage); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 531 | MODULE-PRODUCT |       const input = filesModule.locator('input[type="file"]').first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 536 | MODULE-PRODUCT |       const openButton = filesModule.getByRole('button', { |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 551 | MODULE-PRODUCT |         files: await snapshotLocator(filesModule, { uploadFileName: artifacts.uploadFileName }), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 609 | MODULE-PRODUCT |         let modulesDialog = null; |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 610 | MODULE-PRODUCT |         const modulesButton = responsivePage.getByRole('button', { name: /^Modules$/i }).first(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 611 | MODULE-PRODUCT |         if (await modulesButton.isVisible().catch(() => false)) { |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 612 | MODULE-PRODUCT |           await modulesButton.click(); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 613 | MODULE-PRODUCT |           modulesDialog = await snapshotPage(responsivePage); |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 620 | MODULE-PRODUCT |             modulesButtonVisible: await modulesButton.isVisible().catch(() => false), |
| e2e/user-journey-verification/e2e/inspect-live-contracts.ts | 621 | MODULE-PRODUCT |             modulesDialog, |
| e2e/user-journey-verification/evaluate-visuals.mjs | 64 | MODULE-PRODUCT |   const moduleVerificationEnv = await readOptionalEnvFile(resolve(__dirname, '..', 'module-verification', '.env.local')); |
| e2e/user-journey-verification/evaluate-visuals.mjs | 66 | MODULE-PRODUCT |   return String(localEnv.OPENAI_API_KEY \|\| moduleVerificationEnv.OPENAI_API_KEY \|\| e2eTokensEnv.OPENAI_API_KEY \|\| '').trim(); |
| e2e/user-journey-verification/seed-normal.ts | 41 | MODULE-PRODUCT |       modules_enabled: true, |
| e2e/user-journey-verification/seed-normal.ts | 43 | MODULE-PRODUCT |       modules: [], |
| e2e/user-journey-verification/seed-normal.ts | 51 | MODULE-PRODUCT |       modules_enabled: true, |
| e2e/user-journey-verification/seed-normal.ts | 53 | MODULE-PRODUCT |       modules: [], |
| e2e/user-journey-verification/seed-stress.ts | 54 | MODULE-PRODUCT |       modules_enabled: true, |
| e2e/user-journey-verification/seed-stress.ts | 56 | MODULE-PRODUCT |       modules: [], |
| e2e/user-journey-verification/seed-stress.ts | 64 | MODULE-PRODUCT |       modules_enabled: true, |
| e2e/user-journey-verification/seed-stress.ts | 66 | MODULE-PRODUCT |       modules: [], |
| e2e/user-journey-verification/utils/networkCoverage.ts | 56 | MODULE-PRODUCT |   'GET /api/hub/spaces/([^/]+)/automation-rules': 'Automation rules are unrelated to scoped module verification.', |
| e2e/user-journey-verification/utils/networkCoverage.ts | 57 | MODULE-PRODUCT |   'POST /api/hub/spaces/([^/]+)/automation-rules': 'Automation rules are unrelated to scoped module verification.', |
| e2e/user-journey-verification/utils/networkCoverage.ts | 58 | MODULE-PRODUCT |   'PATCH /api/hub/automation-rules/([^/]+)': 'Automation rules are unrelated to scoped module verification.', |
| e2e/user-journey-verification/utils/networkCoverage.ts | 59 | MODULE-PRODUCT |   'DELETE /api/hub/automation-rules/([^/]+)': 'Automation rules are unrelated to scoped module verification.', |
| e2e/user-journey-verification/utils/networkCoverage.ts | 60 | MODULE-PRODUCT |   'GET /api/hub/spaces/([^/]+)/automation-runs': 'Automation runs are unrelated to scoped module verification.', |
| e2e/user-journey-verification/verify-motion.spec.ts | 57 | MODULE-PRODUCT | const openAddModuleDialog = async (page: Page): Promise<void> => { |
| e2e/user-journey-verification/verify-motion.spec.ts | 58 | MODULE-PRODUCT |   const addModuleButton = page.getByRole('button', { name: /Add module\|Add a module/i }).first(); |
| e2e/user-journey-verification/verify-motion.spec.ts | 59 | MODULE-PRODUCT |   await expect(addModuleButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/verify-motion.spec.ts | 60 | MODULE-PRODUCT |   await addModuleButton.click(); |
| e2e/user-journey-verification/verify-motion.spec.ts | 61 | MODULE-PRODUCT |   await expect(page.getByRole('heading', { name: /^Add Module$/i })).toBeVisible({ timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/verify-motion.spec.ts | 64 | MODULE-PRODUCT | const ensureTableModuleAdded = async (page: Page): Promise<void> => { |
| e2e/user-journey-verification/verify-motion.spec.ts | 65 | MODULE-PRODUCT |   const tableModule = page.getByRole('region', { name: 'Table module' }).first(); |
| e2e/user-journey-verification/verify-motion.spec.ts | 66 | MODULE-PRODUCT |   if (await tableModule.isVisible().catch(() => false)) { |
| e2e/user-journey-verification/verify-motion.spec.ts | 70 | MODULE-PRODUCT |   await openAddModuleDialog(page); |
| e2e/user-journey-verification/verify-motion.spec.ts | 71 | MODULE-PRODUCT |   await page.getByRole('button', { name: /^Select Table module$/i }).first().click(); |
| e2e/user-journey-verification/verify-motion.spec.ts | 73 | MODULE-PRODUCT |   await expect(tableModule).toBeVisible({ timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/verify-motion.spec.ts | 202 | AMBIGUOUS |       await runMotionCheck(page, 'dialog_open_add_module', '.dialog-panel-size, [role="dialog"]', async () => { |
| e2e/user-journey-verification/verify-motion.spec.ts | 203 | MODULE-PRODUCT |         await openAddModuleDialog(page); |
| e2e/user-journey-verification/verify-motion.spec.ts | 208 | AMBIGUOUS |       await runMotionCheck(page, 'dialog_close_add_module', '.bg-overlay', async () => { |
| e2e/user-journey-verification/verify-motion.spec.ts | 210 | MODULE-PRODUCT |         await expect(page.getByRole('heading', { name: /^Add Module$/i })).toHaveCount(0, { timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/verify-motion.spec.ts | 231 | MODULE-PRODUCT |     await ensureTableModuleAdded(page); |
| e2e/user-journey-verification/verify-motion.spec.ts | 233 | MODULE-PRODUCT |     const tableActionsButton = page.getByRole('button', { name: /Open Table module actions/i }).first(); |
| e2e/user-journey-verification/verify-motion.spec.ts | 237 | MODULE-PRODUCT |       await runMotionCheck(page, 'module_actions_open', '[role="menu"][aria-label$="module actions"], [role="menu"]', async () => { |
| e2e/user-journey-verification/verify-motion.spec.ts | 239 | MODULE-PRODUCT |         await expect(page.getByRole('menu', { name: /Table module actions/i })).toBeVisible({ timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/verify-motion.spec.ts | 244 | MODULE-PRODUCT |       await runMotionCheck(page, 'module_actions_close', '[role="menu"][aria-label$="module actions"], [role="menu"]', async () => { |
| e2e/user-journey-verification/verify-motion.spec.ts | 246 | MODULE-PRODUCT |         await expect(page.getByRole('menu', { name: /Table module actions/i })).toHaveCount(0, { timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 47 | MODULE-PRODUCT | const openAddModuleDialog = async (page: Page): Promise<void> => { |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 48 | MODULE-PRODUCT |   const addModuleButton = page.getByRole('button', { name: /Add module\|Add a module/i }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 49 | MODULE-PRODUCT |   await expect(addModuleButton).toBeVisible({ timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 50 | MODULE-PRODUCT |   await addModuleButton.click(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 51 | MODULE-PRODUCT |   await expect(page.getByRole('heading', { name: /^Add Module$/i })).toBeVisible({ timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 54 | MODULE-PRODUCT | const ensureModuleAdded = async ( |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 56 | MODULE-PRODUCT |   moduleLabel: string, |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 64 | MODULE-PRODUCT |   await openAddModuleDialog(page); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 66 | MODULE-PRODUCT |   const selectButton = page.getByRole('button', { name: new RegExp(`^Select ${escapeRegExp(moduleLabel)} module$`, 'i') }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 70 | MODULE-PRODUCT |   const sizeButton = page.getByRole('button', { name: new RegExp(`^Add ${escapeRegExp(moduleLabel)} at ${sizeTier} size$`, 'i') }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 77 | MODULE-PRODUCT | const getKanbanModuleCard = (page: Page): Locator => { |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 79 | MODULE-PRODUCT |     .locator('[data-testid="module-card"]') |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 80 | MODULE-PRODUCT |     .filter({ has: page.getByRole('button', { name: /Kanban module actions/i }) }) |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 84 | MODULE-PRODUCT | const getFilesModule = (page: Page): Locator => page.getByRole('region', { name: 'Files module' }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 86 | MODULE-PRODUCT | const getTableModule = (page: Page): Locator => page.getByRole('region', { name: 'Table module' }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 88 | MODULE-PRODUCT | const getTasksModule = (page: Page): Locator => page.getByRole('region', { name: 'Tasks module' }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 90 | MODULE-PRODUCT | const getRemindersModule = (page: Page): Locator => page.getByRole('region', { name: 'Reminders module' }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 92 | MODULE-PRODUCT | const getCalendarModuleCard = (page: Page): Locator => { |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 96 | MODULE-PRODUCT |       has: page.getByRole('button', { name: /Calendar module actions\|New Event\|Previous week\|Previous day/i }).first(), |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 102 | MODULE-PRODUCT |   const calendarModule = getCalendarModuleCard(page); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 103 | MODULE-PRODUCT |   let calendarEventButton = calendarModule.getByRole('button', { name: new RegExp(escapeRegExp(calendarTitle), 'i') }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 105 | MODULE-PRODUCT |     const dayViewButton = calendarModule.getByRole('button', { name: /^Day$/i }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 109 | MODULE-PRODUCT |     calendarEventButton = calendarModule.getByRole('button', { name: new RegExp(escapeRegExp(calendarTitle), 'i') }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 169 | MODULE-PRODUCT | const ensureCalendarReadyForCreate = async (calendarModule: Locator): Promise<void> => { |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 170 | MODULE-PRODUCT |   const newEventButton = calendarModule.getByRole('button', { name: /^New Event$/i }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 176 | MODULE-PRODUCT |   const showAllButton = calendarModule.getByRole('button', { name: /^Show All$/i }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 179 | MODULE-PRODUCT |     await expect(calendarModule.getByText('Loading calendar')).toHaveCount(0, { timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 183 | MODULE-PRODUCT |   const allScopeButton = calendarModule.getByRole('button', { name: /^All$/i }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 186 | MODULE-PRODUCT |     await expect(calendarModule.getByText('Loading calendar')).toHaveCount(0, { timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 228 | MODULE-PRODUCT |     await captureCheckpoint({ page, scenario, phase: 'modules', state: 'before_action', viewport }); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 230 | MODULE-PRODUCT |     await ensureModuleAdded(page, 'Files', 'S', getFilesModule(page)); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 231 | MODULE-PRODUCT |     await ensureModuleAdded(page, 'Table', 'M', getTableModule(page)); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 232 | MODULE-PRODUCT |     await ensureModuleAdded(page, 'Kanban', 'M', getKanbanModuleCard(page)); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 233 | MODULE-PRODUCT |     await ensureModuleAdded( |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 237 | MODULE-PRODUCT |       getCalendarModuleCard(page), |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 239 | MODULE-PRODUCT |     await ensureModuleAdded(page, 'Tasks', 'M', getTasksModule(page)); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 240 | MODULE-PRODUCT |     await ensureModuleAdded(page, 'Reminders', 'M', getRemindersModule(page)); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 241 | MODULE-PRODUCT |     await ensureModuleAdded(page, 'Quick Thoughts', 'M', page.getByLabel('Quick Thought editor').first()); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 243 | MODULE-PRODUCT |     await captureCheckpoint({ page, scenario, phase: 'modules', state: 'post_submit', viewport }); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 249 | MODULE-PRODUCT |     const tableModule = getTableModule(page); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 251 | MODULE-PRODUCT |     const createRowInput = tableModule.getByRole('textbox', { name: 'New record...' }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 255 | MODULE-PRODUCT |     await tableModule.getByRole('button', { name: /^Add$/i }).first().click(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 257 | MODULE-PRODUCT |     const tableOpenButton = tableModule.getByRole('button', { name: new RegExp(`^Open record ${escapeRegExp(tableTitle)}$`, 'i') }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 269 | MODULE-PRODUCT |     const kanbanModule = getKanbanModuleCard(page); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 272 | MODULE-PRODUCT |     const firstColumn = kanbanModule.locator('section[aria-label$=" column"]').first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 282 | MODULE-PRODUCT |     const kanbanRecordOpenButton = kanbanModule.getByRole('button', { |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 292 | MODULE-PRODUCT |     const columnSelect = kanbanModule.getByLabel(`Column for ${kanbanTitle}`).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 312 | MODULE-PRODUCT |     const calendarModule = getCalendarModuleCard(page); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 313 | MODULE-PRODUCT |     await ensureCalendarReadyForCreate(calendarModule); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 315 | MODULE-PRODUCT |     if ((await calendarModule.getByRole('button', { name: /^New Event$/i }).count()) > 0) { |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 316 | MODULE-PRODUCT |       calendarNewEventButton = calendarModule.getByRole('button', { name: /^New Event$/i }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 318 | MODULE-PRODUCT |       calendarNewEventButton = calendarModule.getByRole('button', { name: /^Create event for /i }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 324 | MODULE-PRODUCT |     const calendarTitleInput = calendarModule.getByLabel(/Event title\|Write an event in natural language/i).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 327 | MODULE-PRODUCT |     await calendarModule.getByLabel('Start time').first().fill('09:30'); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 328 | MODULE-PRODUCT |     await calendarModule.getByLabel('End time').first().fill('10:30'); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 330 | MODULE-PRODUCT |     await calendarModule.getByRole('button', { name: /^Create$/i }).first().click(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 332 | MODULE-PRODUCT |     let calendarEventButton = calendarModule.getByRole('button', { name: new RegExp(escapeRegExp(calendarTitle), 'i') }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 334 | MODULE-PRODUCT |       const dayViewButton = calendarModule.getByRole('button', { name: /^Day$/i }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 338 | MODULE-PRODUCT |       calendarEventButton = calendarModule.getByRole('button', { name: new RegExp(escapeRegExp(calendarTitle), 'i') }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 344 | MODULE-PRODUCT |     const tasksModule = getTasksModule(page); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 346 | MODULE-PRODUCT |     let newTaskInput = tasksModule.getByLabel(/New task title\|Write a task in natural language/i).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 348 | MODULE-PRODUCT |       const openComposerButton = tasksModule.getByRole('button', { name: /^New Task$/i }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 351 | MODULE-PRODUCT |       newTaskInput = tasksModule.getByLabel(/New task title\|Write a task in natural language/i).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 356 | MODULE-PRODUCT |     const createTaskButton = tasksModule.getByRole('button', { name: /^(Add\|Create task\|Create)$/i }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 361 | MODULE-PRODUCT |     const markInProgressButton = tasksModule.getByRole('button', { |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 367 | MODULE-PRODUCT |       tasksModule.getByRole('button', { |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 375 | MODULE-PRODUCT |     const remindersModule = getRemindersModule(page); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 377 | MODULE-PRODUCT |     const reminderInput = remindersModule.getByLabel(/Reminder\|Write a reminder in natural language/i).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 381 | MODULE-PRODUCT |     await remindersModule.getByRole('button', { name: /^Add$/i }).first().click(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 383 | MODULE-PRODUCT |     await remindersModule.getByRole('button', { name: /^Add$/i }).first().click(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 387 | MODULE-PRODUCT |     const filesModule = getFilesModule(page); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 388 | MODULE-PRODUCT |     await expect(filesModule).toBeVisible({ timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 390 | MODULE-PRODUCT |     const uploadButton = filesModule.getByRole('button', { name: /^Upload files$/i }).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 399 | MODULE-PRODUCT |     const fileInput = filesModule.locator('input[type="file"]').first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 401 | MODULE-PRODUCT |     await expect(filesModule.getByText(uploadFileName).first()).toBeVisible({ timeout: LIVE_TIMEOUT_MS }); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 404 | MODULE-PRODUCT |     const openUploadedFileButton = filesModule.getByRole('button', { |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 513 | AMBIGUOUS |     if (await page.getByRole('button', { name: /^Modules$/i }).isVisible().catch(() => false)) { |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 514 | AMBIGUOUS |       await page.getByRole('button', { name: /^Modules$/i }).click(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 521 | MODULE-PRODUCT |     const tasksModule = getTasksModule(page); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 522 | MODULE-PRODUCT |     let newTaskInput = tasksModule.getByLabel(/New task title\|Write a task in natural language/i).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 524 | MODULE-PRODUCT |       await tasksModule.getByRole('button', { name: /^New Task$/i }).first().click(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 525 | MODULE-PRODUCT |       newTaskInput = tasksModule.getByLabel(/New task title\|Write a task in natural language/i).first(); |
| e2e/user-journey-verification/verify-user-journey.spec.ts | 528 | MODULE-PRODUCT |     const dueDateInput = tasksModule.getByLabel(/Due Date\|Task due date/i).first(); |
| e2e/workflow/helpers/workflowEnv.mjs | 25 | MODULE-PRODUCT |   modulesEnabled: parseBoolean(process.env.WORKFLOW_MODULES, true), |
| e2e/workflow/helpers/workflowNavigation.mjs | 87 | MODULE-PRODUCT |   const addModuleButton = page.getByTestId('add-module-table'); |
| e2e/workflow/helpers/workflowNavigation.mjs | 90 | MODULE-PRODUCT |   const addModuleText = page.getByText('Add module: Table', { exact: false }); |
| e2e/workflow/helpers/workflowNavigation.mjs | 95 | MODULE-PRODUCT |     \|\| (await addModuleButton.isVisible().catch(() => false)) |
| e2e/workflow/helpers/workflowNavigation.mjs | 98 | MODULE-PRODUCT |     \|\| (await addModuleText.isVisible().catch(() => false)) |
| e2e/workflow/helpers/workflowNavigation.mjs | 117 | MODULE-PRODUCT |       page.getByTestId('add-module-table').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null), |
| e2e/workflow/helpers/workflowNavigation.mjs | 120 | MODULE-PRODUCT |       page.getByText('Add module: Table', { exact: false }).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null), |
| e2e/workflow/WORKFLOW_TEST_RESULTS.md | 38 | MODULE-PRODUCT | - The harness created a new project named `workflow-modules-*`. |
| e2e/workflow/WORKFLOW_TEST_RESULTS.md | 39 | MODULE-PRODUCT | - A `Table` module was added through the browser UI. |
| e2e/workflow/WORKFLOW_TEST_RESULTS.md | 40 | MODULE-PRODUCT | - The new project and module count were verified through live Hub API project data. |
| e2e/workflow/WORKFLOW_TEST_RESULTS.md | 41 | MODULE-PRODUCT | - The project was reopened on a fresh authenticated page and the module count still matched. |
| e2e/workflow/WORKFLOW_TEST_RESULTS.md | 52 | MODULE-PRODUCT | - The page showed read-only copy and disabled module controls. |
| e2e/workflow/WORKFLOW_TEST_RESULTS.md | 89 | MODULE-PRODUCT | - module persistence |
| eslint.config.js | 11 | MODULE-SYSTEM |       'node_modules', |
| FILE_MAP.md | 33 | MODULE-SYSTEM | Route handler modules for Hub API resources and request policy enforcement. |
| FILE_MAP.md | 98 | MODULE-SYSTEM | src/vite-env.d.ts — Declares ambient TypeScript module types for Vite environment modules. |
| FILE_MAP.md | 146 | MODULE-PRODUCT | Project Space feature UI: tabs, module skins, overlays, comments, and workspace tooling. |
| FILE_MAP.md | 147 | MODULE-PRODUCT | src/components/project-space/AddModuleDialog.tsx — Renders add module dialog; uses state, useId. |
| FILE_MAP.md | 150 | MODULE-PRODUCT | src/components/project-space/CalendarModuleSkin.tsx — Renders calendar module skin module view; uses state, memoized data, effects, refs. |
| FILE_MAP.md | 157 | MODULE-PRODUCT | src/components/project-space/FilesModuleSkin.tsx — Renders files module skin module view; uses state, memoized data, effects, refs, useThumbnail. |
| FILE_MAP.md | 161 | MODULE-PRODUCT | src/components/project-space/QuickThoughtsModuleSkin.tsx — Renders quick thoughts module skin module view; uses state, memoized data, effects, refs. |
| FILE_MAP.md | 162 | MODULE-PRODUCT | src/components/project-space/KanbanModuleSkin.tsx — Renders kanban module skin module view; uses memoized data, useDroppable. |
| FILE_MAP.md | 164 | MODULE-PRODUCT | src/components/project-space/mockProjectSpace.ts — Exports moduleTemplates, buildCollaborators, buildClientReferences for mock project space. |
| FILE_MAP.md | 165 | MODULE-PRODUCT | src/components/project-space/moduleCatalog.ts — Exports MODULE_CATALOG, moduleCatalogEntry, moduleLabel for module catalog; used by AddModuleDialog and ModuleGrid. |
| FILE_MAP.md | 166 | MODULE-PRODUCT | src/components/project-space/ModuleFeedback.tsx — Renders module loading state module view. |
| FILE_MAP.md | 167 | MODULE-PRODUCT | src/components/project-space/ModuleGrid.tsx — Renders module grid module view; uses state, refs. |
| FILE_MAP.md | 168 | MODULE-PRODUCT | src/components/project-space/ModuleLensControl.tsx — Renders module lens control module view. |
| FILE_MAP.md | 169 | MODULE-PRODUCT | src/components/project-space/ModuleSettingsPopover.tsx — Renders module settings popover. |
| FILE_MAP.md | 179 | MODULE-PRODUCT | src/components/project-space/RemindersModuleSkin.tsx — Renders reminders module skin module view; uses state, memoized data, effects, refs. |
| FILE_MAP.md | 181 | MODULE-PRODUCT | src/components/project-space/TableModuleSkin.tsx — Renders table module skin tab; uses state, memoized data, refs, useReactTable. |
| FILE_MAP.md | 182 | MODULE-PRODUCT | src/components/project-space/taskAdapter.ts — Exports formatDueLabel, adaptTaskSummary, adaptTaskSummaries for task adapter; used by OverviewView and TasksModuleSkin. |
| FILE_MAP.md | 184 | MODULE-PRODUCT | src/components/project-space/TasksModuleSkin.tsx — Renders tasks module skin module view; uses state, memoized data. |
| FILE_MAP.md | 194 | MODULE-PRODUCT | ## src/components/project-space/modules |
| FILE_MAP.md | 195 | MODULE-PRODUCT | src/components/project-space/modules/CalendarModule.tsx — Renders calendar module view. |
| FILE_MAP.md | 196 | MODULE-PRODUCT | src/components/project-space/modules/FilesModule.tsx — Renders files module view. |
| FILE_MAP.md | 197 | MODULE-PRODUCT | src/components/project-space/modules/index.ts — Exports TableModule, KanbanModule, CalendarModule for modules; used by WorkView. |
| FILE_MAP.md | 198 | MODULE-PRODUCT | src/components/project-space/modules/KanbanModule.tsx — Renders kanban module view. |
| FILE_MAP.md | 199 | MODULE-PRODUCT | src/components/project-space/modules/QuickThoughtsModule.tsx — Renders quick thoughts module view. |
| FILE_MAP.md | 200 | MODULE-PRODUCT | src/components/project-space/modules/RemindersModule.tsx — Renders reminders module view. |
| FILE_MAP.md | 201 | MODULE-PRODUCT | src/components/project-space/modules/TableModule.tsx — Renders table module tab. |
| FILE_MAP.md | 202 | MODULE-PRODUCT | src/components/project-space/modules/TasksModule.tsx — Renders tasks module view. |
| FILE_MAP.md | 203 | MODULE-PRODUCT | src/components/project-space/modules/TimelineModule.tsx — Renders timeline module view. |
| FILE_MAP.md | 375 | MODULE-SYSTEM | src/services/apiClient.ts — Service module implementing api client integration and transport logic. |
| FILE_MAP.md | 376 | MODULE-SYSTEM | src/services/authService.ts — Service module implementing auth service integration and transport logic. |
| FILE_MAP.md | 377 | MODULE-SYSTEM | src/services/githubService.ts — Service module implementing github service integration and transport logic. |
| FILE_MAP.md | 378 | MODULE-SYSTEM | src/services/hubAuthHeaders.ts — Service module implementing hub auth headers integration and transport logic. |
| FILE_MAP.md | 379 | MODULE-SYSTEM | src/services/hubContractApi.ts — Service module implementing hub contract api integration and transport logic. |
| FILE_MAP.md | 380 | MODULE-SYSTEM | src/services/hubLive.ts — Service module implementing hub live integration and transport logic. |
| FILE_MAP.md | 381 | MODULE-SYSTEM | src/services/lessonsService.ts — Service module implementing lessons service integration and transport logic. |
| FILE_MAP.md | 382 | MODULE-PRODUCT | src/services/mediaWorkflowService.ts — Service module implementing media workflow service integration and transport logic. |
| FILE_MAP.md | 383 | MODULE-SYSTEM | src/services/nextcloudService.ts — Service module implementing nextcloud service integration and transport logic. |
| FILE_MAP.md | 384 | MODULE-SYSTEM | src/services/notificationService.ts — Service module implementing notification service integration and transport logic. |
| FILE_MAP.md | 385 | MODULE-PRODUCT | src/services/openProjectService.ts — Service module implementing open project service integration and transport logic. |
| FILE_MAP.md | 386 | MODULE-PRODUCT | src/services/projectsService.ts — Service module implementing space service integration and transport logic. |
| FILE_MAP.md | 387 | MODULE-SYSTEM | src/services/sessionService.ts — Service module implementing session service integration and transport logic. |
| FILE_MAP.md | 388 | MODULE-SYSTEM | src/services/smartWakeService.ts — Service module implementing smart wake service integration and transport logic. |
| FILE_MAP.md | 391 | MODULE-SYSTEM | Hub-specific API client modules grouped by resource domain and response normalization. |
| FILE_MAP.md | 422 | MODULE-SYSTEM | src/types/hub-api-module.d.ts — Declares ambient TypeScript module types for the hub-api module. |
| index.html | 16 | MODULE-SYSTEM |     <script type="module" src="/src/main.tsx"></script> |
| package.json | 5 | MODULE-SYSTEM |   "type": "module", |
| prompt-1-playwright-verification.md | 67 | MODULE-PRODUCT |    **Work project A — "Verify Main Project"**: `modules_enabled: true`, `workspace_enabled: true`. Modules: |
| prompt-1-playwright-verification.md | 68 | MODULE-PRODUCT |    - `table` module, size tier `L`, lens `project`, bound to the table view |
| prompt-1-playwright-verification.md | 69 | MODULE-PRODUCT |    - `kanban` module, size tier `L`, lens `project`, bound to the kanban view |
| prompt-1-playwright-verification.md | 70 | MODULE-PRODUCT |    - `calendar` module, size tier `M`, lens `project` |
| prompt-1-playwright-verification.md | 71 | MODULE-PRODUCT |    - `tasks` module, size tier `M`, lens `project` |
| prompt-1-playwright-verification.md | 72 | MODULE-PRODUCT |    - `reminders` module, size tier `S`, lens `project` |
| prompt-1-playwright-verification.md | 73 | MODULE-PRODUCT |    - `files` module, size tier `M`, lens `project` |
| prompt-1-playwright-verification.md | 74 | MODULE-PRODUCT |    - `quick-thoughts` module, size tier `S`, lens `project` |
| prompt-1-playwright-verification.md | 76 | MODULE-PRODUCT |    **Work project B — "Verify Private Project"**: `modules_enabled: true`, `workspace_enabled: true`. Modules: |
| prompt-1-playwright-verification.md | 77 | MODULE-PRODUCT |    - `table` module, size tier `M`, lens `project`, bound to table view |
| prompt-1-playwright-verification.md | 78 | MODULE-PRODUCT |    - `tasks` module, size tier `L`, lens `project` |
| prompt-1-playwright-verification.md | 123 | MODULE-PRODUCT | ### Phase 3 — Module Grid |
| prompt-1-playwright-verification.md | 125 | MODULE-PRODUCT | Navigate to the project's work view, selecting Project A (the main project with 7 modules). |
| prompt-1-playwright-verification.md | 128 | MODULE-PRODUCT | - `ModuleGrid` container is present |
| prompt-1-playwright-verification.md | 129 | MODULE-PRODUCT | - Count the number of rendered module containers — expect 7 |
| prompt-1-playwright-verification.md | 130 | AMBIGUOUS | - Each module has a visible header or label identifying its type |
| prompt-1-playwright-verification.md | 131 | MODULE-PRODUCT | - Modules at different size tiers render at visually different sizes (check that L-tier modules have a larger bounding box than S-tier modules by comparing `offsetWidth` or `offsetHeight`) |
| prompt-1-playwright-verification.md | 132 | MODULE-PRODUCT | - No modules show an error/fallback state (look for `ModuleFeedback` error indicators) |
| prompt-1-playwright-verification.md | 134 | MODULE-PRODUCT | ### Phase 4 — Individual Module Skins |
| prompt-1-playwright-verification.md | 136 | MODULE-PRODUCT | Stay on the work view with Project A. For each module type, locate it and verify its content: |
| prompt-1-playwright-verification.md | 138 | MODULE-PRODUCT | **Table module:** |
| prompt-1-playwright-verification.md | 143 | MODULE-PRODUCT | **Kanban module:** |
| prompt-1-playwright-verification.md | 148 | MODULE-PRODUCT | **Calendar module:** |
| prompt-1-playwright-verification.md | 153 | MODULE-PRODUCT | **Tasks module:** |
| prompt-1-playwright-verification.md | 157 | MODULE-PRODUCT | **Reminders module:** |
| prompt-1-playwright-verification.md | 161 | MODULE-PRODUCT | **Files module:** |
| prompt-1-playwright-verification.md | 165 | MODULE-PRODUCT | **Quick Thoughts (Inbox Capture) module:** |
| prompt-1-playwright-verification.md | 181 | MODULE-PRODUCT | From the work view, click on one of the seeded records in the table module to open it. |
| prompt-1-playwright-verification.md | 192 | MODULE-PRODUCT | Navigate to the work view, Project A, and locate the Files module. |
| prompt-1-playwright-verification.md | 195 | MODULE-PRODUCT | - Files module is present and shows empty state or file listing |
| README.md | 32 | MODULE-SYSTEM | Generated files (`dist`, `node_modules`, `tsconfig.app.tsbuildinfo`) are build/runtime artifacts. |
| RENAME_PARITY_BASELINE.md | 33 | MODULE-PRODUCT | - Missing module import: `e2e/support/hubHomeAudit.ts` imports `e2e/support/surfaceAudit.ts`, but that file is not present in the worktree. |
| RENAME_PARITY_BASELINE.md | 45 | MODULE-PRODUCT | Error: Cannot find module '<REPO_ROOT>/e2e/support/surfaceAudit.ts' imported from <REPO_ROOT>/e2e/support/hubHomeAudit.ts |
| scripts/check-authz.mjs | 22 | AMBIGUOUS | const readModuleSource = async ({ flatFilePath, moduleDirPath }) => { |
| scripts/check-authz.mjs | 23 | AMBIGUOUS |   const absoluteModuleDir = path.join(root, moduleDirPath); |
| scripts/check-authz.mjs | 25 | AMBIGUOUS |     const sourceFiles = await collectSourceFiles(absoluteModuleDir); |
| scripts/check-authz.mjs | 38 | AMBIGUOUS | const dashboardPanel = await readModuleSource({ |
| scripts/check-authz.mjs | 40 | AMBIGUOUS |   moduleDirPath: 'src/features/PersonalizedDashboardPanel', |
| scripts/check-css-drift.mjs | 9 | MODULE-SYSTEM | const ignoredDirs = new Set(['node_modules', 'dist', '.git', 'working files']); |
| scripts/dev/capture-table-overflow-check.ts | 257 | MODULE-PRODUCT |       modules_enabled: true, |
| scripts/dev/capture-table-overflow-check.ts | 259 | MODULE-PRODUCT |       modules: [ |
| scripts/dev/capture-table-overflow-check.ts | 261 | MODULE-PRODUCT |           module_instance_id: `table-overflow-${stamp}`, |
| scripts/dev/capture-table-overflow-check.ts | 262 | MODULE-PRODUCT |           module_type: 'table', |
| scripts/dev/capture-table-overflow-check.ts | 302 | MODULE-PRODUCT |     const tableModule = page.getByRole('region', { name: 'Table module' }).first(); |
| scripts/dev/capture-table-overflow-check.ts | 303 | MODULE-PRODUCT |     await tableModule.waitFor({ state: 'visible', timeout: 60_000 }); |
| scripts/dev/capture-table-overflow-check.ts | 305 | MODULE-PRODUCT |     const titleButton = tableModule |
| scripts/dev/capture-table-overflow-check.ts | 358 | MODULE-PRODUCT |     await tableModule.screenshot({ path: screenshotPath }); |
| scripts/diagnose-workspace-doc-persistence.mjs | 159 | MODULE-PRODUCT |         modules_enabled: false, |
| scripts/perf/run-hub-api-user-base.mjs | 326 | MODULE-SYSTEM |   return resolveRepoPath(`node_modules/.bin/artillery${suffix}`); |
| scripts/rename-functional-parity.e2e.test.mjs | 62 | MODULE-PRODUCT |       'module_picker_seed_data', |
| scripts/rename-functional-parity.e2e.test.mjs | 95 | MODULE-PRODUCT |       'idx_module_picker_seed_module_size', |
| scripts/rename-functional-parity.e2e.test.mjs | 1662 | MODULE-PRODUCT |           [requestKeys.layoutConfig]: { modules: [] }, |
| scripts/rename-functional-parity.e2e.test.mjs | 1678 | MODULE-PRODUCT |           [requestKeys.layoutConfig]: { modules: [] }, |
| scripts/rename-functional-parity.e2e.test.mjs | 1712 | MODULE-PRODUCT |           [requestKeys.layoutConfig]: { modules: [], doc_binding_mode: 'owned' }, |
| scripts/rename-parity-coverage.md | 61 | MODULE-PRODUCT | - `module_picker_seed_data` |
| scripts/rename-parity-coverage.md | 140 | MODULE-PRODUCT | - `idx_module_picker_seed_module_size` |
| scripts/widget-rename-trace.e2e.test.mjs | 187 | MODULE-PRODUCT |       if ((key === 'module_instance_id' \|\| key === 'widget_instance_id') && typeof child === 'string') { |
| scripts/widget-rename-trace.e2e.test.mjs | 189 | MODULE-PRODUCT |           findings.push(`${childPath} contains ${child}; expected a module/widget instance ID.`); |
| scripts/widget-rename-trace.e2e.test.mjs | 193 | MODULE-PRODUCT |       } else if ((key === 'module_instance_id' \|\| key === 'widget_instance_id') && child != null) { |
| scripts/widget-rename-trace.e2e.test.mjs | 205 | MODULE-PRODUCT |   assert.ok(seedData?.calendar, 'Module picker seed data should include calendar.'); |
| scripts/widget-rename-trace.e2e.test.mjs | 206 | MODULE-PRODUCT |   assert.ok(seedData?.tasks, 'Module picker seed data should include tasks.'); |
| scripts/widget-rename-trace.e2e.test.mjs | 209 | MODULE-PRODUCT | test('widget rename trace reports current module API shapes', async () => { |
| scripts/widget-rename-trace.e2e.test.mjs | 272 | MODULE-PRODUCT |       modules_enabled: true, |
| scripts/widget-rename-trace.e2e.test.mjs | 275 | MODULE-PRODUCT |       modules: [ |
| scripts/widget-rename-trace.e2e.test.mjs | 276 | MODULE-PRODUCT |         { module_instance_id: calendarInstanceId, module_type: 'calendar', size_tier: 'M', lens: 'project' }, |
| scripts/widget-rename-trace.e2e.test.mjs | 277 | MODULE-PRODUCT |         { module_instance_id: tasksInstanceId, module_type: 'tasks', size_tier: 'M', lens: 'project' }, |
| scripts/widget-rename-trace.e2e.test.mjs | 307 | MODULE-PRODUCT |       modules: layoutConfig.modules.map((entry) => ({ ...entry, lens: 'project' })), |
| scripts/widget-rename-trace.e2e.test.mjs | 325 | MODULE-PRODUCT |     const seedData = await expectOk(apiBaseUrl, token, '/api/hub/module-picker/seed-data', { method: 'GET' }); |
| scripts/widget-rename-trace.e2e.test.mjs | 327 | MODULE-PRODUCT |     reports.push(await traceEnvelope('module picker seed data response', seedData, context)); |
| src/App.tsx | 11 | MODULE-PRODUCT |   const module = await import('./pages/ProjectsPage'); |
| src/App.tsx | 12 | MODULE-PRODUCT |   return { default: module.ProjectsPage }; |
| src/App.tsx | 16 | MODULE-PRODUCT |   const module = await import('./pages/ProjectSpacePage'); |
| src/App.tsx | 17 | MODULE-PRODUCT |   return { default: module.ProjectSpacePage }; |
| src/App.tsx | 21 | MODULE-SYSTEM |   const module = await import('./pages/NotFoundPage'); |
| src/App.tsx | 22 | AMBIGUOUS |   return { default: module.NotFoundPage }; |
| src/components/project-space/AddModuleDialog.tsx | 3 | MODULE-PRODUCT | import type { ModuleSizeTier } from './moduleCatalog'; |
| src/components/project-space/AddModuleDialog.tsx | 4 | MODULE-PRODUCT | import { ModulePickerConfirm } from './module-picker/ModulePickerConfirm'; |
| src/components/project-space/AddModuleDialog.tsx | 5 | MODULE-PRODUCT | import { ModulePickerOverlay } from './module-picker/ModulePickerOverlay'; |
| src/components/project-space/AddModuleDialog.tsx | 6 | MODULE-PRODUCT | import { ModulePickerPreview } from './module-picker/ModulePickerPreview'; |
| src/components/project-space/AddModuleDialog.tsx | 7 | MODULE-PRODUCT | import { ModulePickerSidebar } from './module-picker/ModulePickerSidebar'; |
| src/components/project-space/AddModuleDialog.tsx | 8 | MODULE-PRODUCT | import type { ModulePickerSelection } from './module-picker/modulePickerTypes'; |
| src/components/project-space/AddModuleDialog.tsx | 9 | MODULE-PRODUCT | import { useModulePickerSeedData } from './module-picker/useModulePickerSeedData'; |
| src/components/project-space/AddModuleDialog.tsx | 11 | MODULE-PRODUCT | interface AddModuleDialogProps { |
| src/components/project-space/AddModuleDialog.tsx | 14 | MODULE-PRODUCT |   onAddModule: (moduleType: string, sizeTier: ModuleSizeTier) => void; |
| src/components/project-space/AddModuleDialog.tsx | 20 | MODULE-PRODUCT | export const AddModuleDialog = ({ |
| src/components/project-space/AddModuleDialog.tsx | 23 | MODULE-PRODUCT |   onAddModule, |
| src/components/project-space/AddModuleDialog.tsx | 27 | MODULE-PRODUCT | }: AddModuleDialogProps) => { |
| src/components/project-space/AddModuleDialog.tsx | 29 | MODULE-PRODUCT |   const [selection, setSelection] = useState<ModulePickerSelection \| null>(null); |
| src/components/project-space/AddModuleDialog.tsx | 30 | MODULE-PRODUCT |   const { seedData, loading, error } = useModulePickerSeedData(open, accessToken); |
| src/components/project-space/AddModuleDialog.tsx | 32 | MODULE-PRODUCT |   const handleSelectionChange = useCallback((nextSelection: ModulePickerSelection) => { |
| src/components/project-space/AddModuleDialog.tsx | 41 | MODULE-PRODUCT |   const handleConfirm = useCallback((nextSelection: ModulePickerSelection) => { |
| src/components/project-space/AddModuleDialog.tsx | 42 | MODULE-PRODUCT |     onAddModule(nextSelection.moduleType, nextSelection.sizeTier); |
| src/components/project-space/AddModuleDialog.tsx | 44 | MODULE-PRODUCT |   }, [handleClose, onAddModule]); |
| src/components/project-space/AddModuleDialog.tsx | 47 | MODULE-PRODUCT |     <ModulePickerOverlay |
| src/components/project-space/AddModuleDialog.tsx | 52 | MODULE-PRODUCT |       sidebar={<ModulePickerSidebar key={String(open)} onSelectionChange={handleSelectionChange} />} |
| src/components/project-space/AddModuleDialog.tsx | 53 | MODULE-PRODUCT |       preview={<ModulePickerPreview selection={selection} seedData={seedData} loading={loading} error={error} />} |
| src/components/project-space/AddModuleDialog.tsx | 54 | MODULE-PRODUCT |       confirm={<ModulePickerConfirm selection={selection} disabled={disableConfirm} onConfirm={handleConfirm} />} |
| src/components/project-space/CalendarDayView.tsx | 16 | MODULE-PRODUCT | import { ModuleEmptyState } from './ModuleFeedback'; |
| src/components/project-space/CalendarDayView.tsx | 727 | MODULE-PRODUCT |           <ModuleEmptyState title="No events today" description="Create an event to plan this day." /> |
| src/components/project-space/CalendarModuleSkin/CalendarCreatePanel.tsx | 103 | MODULE-PRODUCT |         <div className="module-toolbar px-3 py-2 text-xs text-text-secondary"> |
| src/components/project-space/CalendarModuleSkin/CalendarLargeView.tsx | 7 | MODULE-PRODUCT | import { ModuleEmptyState } from '../ModuleFeedback'; |
| src/components/project-space/CalendarModuleSkin/CalendarLargeView.tsx | 149 | MODULE-PRODUCT |         <ModuleEmptyState |
| src/components/project-space/CalendarModuleSkin/CalendarMediumWeekStrip.tsx | 106 | MODULE-PRODUCT |       <div className="module-sheet flex min-h-0 flex-1 flex-col p-3"> |
| src/components/project-space/CalendarModuleSkin/CalendarMediumWeekStrip.tsx | 133 | MODULE-PRODUCT |             <div className="module-rule min-h-0 flex-1 overflow-y-auto pt-3"> |
| src/components/project-space/CalendarModuleSkin/CalendarMediumWeekStrip.tsx | 135 | MODULE-PRODUCT |                 <div className="module-dropzone flex h-full min-h-24 items-center justify-center px-3 text-center"> |
| src/components/project-space/CalendarModuleSkin/CalendarSmallView.tsx | 3 | MODULE-PRODUCT | import { ModuleEmptyState } from '../ModuleFeedback'; |
| src/components/project-space/CalendarModuleSkin/CalendarSmallView.tsx | 67 | MODULE-PRODUCT |           <ModuleEmptyState |
| src/components/project-space/CalendarModuleSkin/index.tsx | 2 | MODULE-PRODUCT | import { ModuleLoadingState } from '../ModuleFeedback'; |
| src/components/project-space/CalendarModuleSkin/index.tsx | 10 | MODULE-PRODUCT | import type { CalendarModuleSkinProps, CalendarScope, CalendarView, MediumWeekDay } from './types'; |
| src/components/project-space/CalendarModuleSkin/index.tsx | 15 | MODULE-PRODUCT | export const CalendarModuleSkin = ({ |
| src/components/project-space/CalendarModuleSkin/index.tsx | 25 | MODULE-PRODUCT | }: CalendarModuleSkinProps) => { |
| src/components/project-space/CalendarModuleSkin/index.tsx | 151 | MODULE-PRODUCT |     return <ModuleLoadingState label="Loading calendar" rows={5} />; |
| src/components/project-space/CalendarModuleSkin/types.ts | 36 | MODULE-PRODUCT | export interface CalendarModuleSkinProps { |
| src/components/project-space/CalendarWeekView.tsx | 367 | MODULE-PRODUCT |                   'module-sheet max-h-[20rem] overflow-hidden px-3 py-2 transition-[transform,box-shadow] duration-150', |
| src/components/project-space/CalendarWeekView.tsx | 402 | MODULE-PRODUCT |                   className="module-rule mt-2 overflow-y-auto pt-2" |
| src/components/project-space/CalendarWeekView.tsx | 429 | MODULE-PRODUCT |                   'module-sheet max-h-[20rem] overflow-hidden px-3 py-2', |
| src/components/project-space/CommentRail.tsx | 57 | MODULE-PRODUCT |     <section className="module-sheet p-4" aria-label="Doc comments"> |
| src/components/project-space/FilesModuleSkin.tsx | 4 | MODULE-PRODUCT | import { useModuleInsertState, type ModuleInsertPayload, type ModuleInsertState } from './hooks/useModuleInsertState'; |
| src/components/project-space/FilesModuleSkin.tsx | 8 | MODULE-PRODUCT | export interface FilesModuleItem { |
| src/components/project-space/FilesModuleSkin.tsx | 21 | MODULE-PRODUCT | interface FilesModuleSkinProps { |
| src/components/project-space/FilesModuleSkin.tsx | 23 | MODULE-PRODUCT |   files: FilesModuleItem[]; |
| src/components/project-space/FilesModuleSkin.tsx | 25 | MODULE-PRODUCT |   onOpenFile: (file: FilesModuleItem) => void; |
| src/components/project-space/FilesModuleSkin.tsx | 26 | MODULE-PRODUCT |   onInsertToEditor?: (item: ModuleInsertPayload) => void; |
| src/components/project-space/FilesModuleSkin.tsx | 57 | MODULE-PRODUCT | const normalizeExt = (file: FilesModuleItem): string => file.ext.toLowerCase(); |
| src/components/project-space/FilesModuleSkin.tsx | 59 | MODULE-PRODUCT | const filterFiles = (files: FilesModuleItem[], filter: FilterKey): FilesModuleItem[] => { |
| src/components/project-space/FilesModuleSkin.tsx | 81 | MODULE-PRODUCT | const parseDate = (file: FilesModuleItem): number => { |
| src/components/project-space/FilesModuleSkin.tsx | 85 | MODULE-PRODUCT | const sortFiles = (files: FilesModuleItem[], key: SortKey): FilesModuleItem[] => { |
| src/components/project-space/FilesModuleSkin.tsx | 100 | MODULE-PRODUCT | const uploadLabel = (file: FilesModuleItem): string => { |
| src/components/project-space/FilesModuleSkin.tsx | 197 | MODULE-PRODUCT |     'module-dropzone relative transition-colors', |
| src/components/project-space/FilesModuleSkin.tsx | 292 | MODULE-PRODUCT |   file: FilesModuleItem; |
| src/components/project-space/FilesModuleSkin.tsx | 293 | MODULE-PRODUCT |   onOpen: (file: FilesModuleItem) => void; |
| src/components/project-space/FilesModuleSkin.tsx | 294 | MODULE-PRODUCT |   activeItemId: ModuleInsertState['activeItemId']; |
| src/components/project-space/FilesModuleSkin.tsx | 295 | MODULE-PRODUCT |   activeItemType: ModuleInsertState['activeItemType']; |
| src/components/project-space/FilesModuleSkin.tsx | 296 | MODULE-PRODUCT |   setActiveItem: ModuleInsertState['setActiveItem']; |
| src/components/project-space/FilesModuleSkin.tsx | 297 | MODULE-PRODUCT |   clearActiveItem: ModuleInsertState['clearActiveItem']; |
| src/components/project-space/FilesModuleSkin.tsx | 298 | MODULE-PRODUCT |   onInsertToEditor?: ModuleInsertState['onInsertToEditor']; |
| src/components/project-space/FilesModuleSkin.tsx | 358 | MODULE-PRODUCT |           data-module-insert-ignore="true" |
| src/components/project-space/FilesModuleSkin.tsx | 382 | MODULE-PRODUCT |   file: FilesModuleItem; |
| src/components/project-space/FilesModuleSkin.tsx | 383 | MODULE-PRODUCT |   onOpen: (file: FilesModuleItem) => void; |
| src/components/project-space/FilesModuleSkin.tsx | 384 | MODULE-PRODUCT |   activeItemId: ModuleInsertState['activeItemId']; |
| src/components/project-space/FilesModuleSkin.tsx | 385 | MODULE-PRODUCT |   activeItemType: ModuleInsertState['activeItemType']; |
| src/components/project-space/FilesModuleSkin.tsx | 386 | MODULE-PRODUCT |   setActiveItem: ModuleInsertState['setActiveItem']; |
| src/components/project-space/FilesModuleSkin.tsx | 387 | MODULE-PRODUCT |   clearActiveItem: ModuleInsertState['clearActiveItem']; |
| src/components/project-space/FilesModuleSkin.tsx | 388 | MODULE-PRODUCT |   onInsertToEditor?: ModuleInsertState['onInsertToEditor']; |
| src/components/project-space/FilesModuleSkin.tsx | 446 | MODULE-PRODUCT |           data-module-insert-ignore="true" |
| src/components/project-space/FilesModuleSkin.tsx | 482 | MODULE-PRODUCT | const FilesModuleSmall = ({ |
| src/components/project-space/FilesModuleSkin.tsx | 490 | MODULE-PRODUCT |   files: FilesModuleItem[]; |
| src/components/project-space/FilesModuleSkin.tsx | 492 | MODULE-PRODUCT |   onOpenFile: (file: FilesModuleItem) => void; |
| src/components/project-space/FilesModuleSkin.tsx | 493 | MODULE-PRODUCT |   insertState: ModuleInsertState; |
| src/components/project-space/FilesModuleSkin.tsx | 500 | MODULE-PRODUCT |     <div className="module-sheet flex h-full min-h-0 flex-col gap-xs p-sm"> |
| src/components/project-space/FilesModuleSkin.tsx | 529 | MODULE-PRODUCT | const FilesModuleMedium = ({ |
| src/components/project-space/FilesModuleSkin.tsx | 537 | MODULE-PRODUCT |   files: FilesModuleItem[]; |
| src/components/project-space/FilesModuleSkin.tsx | 539 | MODULE-PRODUCT |   onOpenFile: (file: FilesModuleItem) => void; |
| src/components/project-space/FilesModuleSkin.tsx | 540 | MODULE-PRODUCT |   insertState: ModuleInsertState; |
| src/components/project-space/FilesModuleSkin.tsx | 548 | MODULE-PRODUCT |     <div className="module-sheet flex h-full min-h-0 flex-col gap-sm p-md"> |
| src/components/project-space/FilesModuleSkin.tsx | 583 | MODULE-PRODUCT | const FilesModuleLarge = ({ |
| src/components/project-space/FilesModuleSkin.tsx | 591 | MODULE-PRODUCT |   files: FilesModuleItem[]; |
| src/components/project-space/FilesModuleSkin.tsx | 593 | MODULE-PRODUCT |   onOpenFile: (file: FilesModuleItem) => void; |
| src/components/project-space/FilesModuleSkin.tsx | 594 | MODULE-PRODUCT |   insertState: ModuleInsertState; |
| src/components/project-space/FilesModuleSkin.tsx | 604 | MODULE-PRODUCT |     <div className="module-sheet flex h-full min-h-0 flex-col gap-md p-md"> |
| src/components/project-space/FilesModuleSkin.tsx | 654 | MODULE-PRODUCT | export const FilesModuleSkin = ({ |
| src/components/project-space/FilesModuleSkin.tsx | 662 | MODULE-PRODUCT | }: FilesModuleSkinProps) => { |
| src/components/project-space/FilesModuleSkin.tsx | 663 | MODULE-PRODUCT |   const insertState = useModuleInsertState({ onInsertToEditor: previewMode ? undefined : onInsertToEditor }); |
| src/components/project-space/FilesModuleSkin.tsx | 673 | MODULE-PRODUCT |     <section className="flex h-full min-h-0 flex-col gap-2" aria-label="Files module"> |
| src/components/project-space/FilesModuleSkin.tsx | 677 | MODULE-PRODUCT |       {sizeTier === 'S' ? <FilesModuleSmall files={files} onUpload={onUpload} onOpenFile={onOpenFile} insertState={insertState} readOnly={readOnly} previewMode={previewMode} /> : null} |
| src/components/project-space/FilesModuleSkin.tsx | 678 | MODULE-PRODUCT |       {sizeTier === 'M' ? <FilesModuleMedium files={files} onUpload={onUpload} onOpenFile={onOpenFile} insertState={insertState} readOnly={readOnly} previewMode={previewMode} /> : null} |
| src/components/project-space/FilesModuleSkin.tsx | 679 | MODULE-PRODUCT |       {sizeTier === 'L' ? <FilesModuleLarge files={files} onUpload={onUpload} onOpenFile={onOpenFile} insertState={insertState} readOnly={readOnly} previewMode={previewMode} /> : null} |
| src/components/project-space/FocusModeToolbar.tsx | 3 | MODULE-PRODUCT | import type { ProjectModule } from './types'; |
| src/components/project-space/FocusModeToolbar.tsx | 8 | MODULE-PRODUCT |   modules: ProjectModule[]; |
| src/components/project-space/FocusModeToolbar.tsx | 9 | MODULE-PRODUCT |   activeModuleId: string \| null; |
| src/components/project-space/FocusModeToolbar.tsx | 10 | MODULE-PRODUCT |   onActiveModuleChange: (moduleId: string \| null) => void; |
| src/components/project-space/FocusModeToolbar.tsx | 11 | MODULE-PRODUCT |   renderModuleDialogContent?: (module: ProjectModule) => React.ReactNode; |
| src/components/project-space/FocusModeToolbar.tsx | 14 | MODULE-PRODUCT | const moduleIcon = (moduleLabel: string): string => |
| src/components/project-space/FocusModeToolbar.tsx | 15 | MODULE-PRODUCT |   moduleLabel |
| src/components/project-space/FocusModeToolbar.tsx | 24 | MODULE-PRODUCT |   modules, |
| src/components/project-space/FocusModeToolbar.tsx | 25 | MODULE-PRODUCT |   activeModuleId, |
| src/components/project-space/FocusModeToolbar.tsx | 26 | MODULE-PRODUCT |   onActiveModuleChange, |
| src/components/project-space/FocusModeToolbar.tsx | 27 | MODULE-PRODUCT |   renderModuleDialogContent, |
| src/components/project-space/FocusModeToolbar.tsx | 31 | MODULE-PRODUCT |   const activeModule = useMemo( |
| src/components/project-space/FocusModeToolbar.tsx | 32 | MODULE-PRODUCT |     () => modules.find((module) => module.id === activeModuleId) ?? null, |
| src/components/project-space/FocusModeToolbar.tsx | 33 | MODULE-PRODUCT |     [activeModuleId, modules], |
| src/components/project-space/FocusModeToolbar.tsx | 44 | MODULE-PRODUCT |         aria-label="Module shortcuts" |
| src/components/project-space/FocusModeToolbar.tsx | 47 | MODULE-PRODUCT |         {modules.map((module) => { |
| src/components/project-space/FocusModeToolbar.tsx | 48 | MODULE-PRODUCT |           const active = activeModuleId === module.id; |
| src/components/project-space/FocusModeToolbar.tsx | 51 | MODULE-PRODUCT |               key={module.id} |
| src/components/project-space/FocusModeToolbar.tsx | 53 | MODULE-PRODUCT |               aria-label={`Open ${module.label}`} |
| src/components/project-space/FocusModeToolbar.tsx | 57 | MODULE-PRODUCT |                 onActiveModuleChange(active ? null : module.id); |
| src/components/project-space/FocusModeToolbar.tsx | 66 | MODULE-PRODUCT |               {moduleIcon(module.label)} |
| src/components/project-space/FocusModeToolbar.tsx | 73 | MODULE-PRODUCT |         open={activeModule !== null} |
| src/components/project-space/FocusModeToolbar.tsx | 74 | MODULE-PRODUCT |         title={activeModule ? activeModule.label : 'Module'} |
| src/components/project-space/FocusModeToolbar.tsx | 75 | MODULE-PRODUCT |         description="Focus mode module dialog" |
| src/components/project-space/FocusModeToolbar.tsx | 76 | MODULE-PRODUCT |         onClose={() => onActiveModuleChange(null)} |
| src/components/project-space/FocusModeToolbar.tsx | 79 | MODULE-PRODUCT |         {activeModule ? ( |
| src/components/project-space/FocusModeToolbar.tsx | 81 | MODULE-PRODUCT |             {renderModuleDialogContent ? ( |
| src/components/project-space/FocusModeToolbar.tsx | 82 | MODULE-PRODUCT |               renderModuleDialogContent(activeModule) |
| src/components/project-space/FocusModeToolbar.tsx | 86 | MODULE-PRODUCT |                   Quick module actions while staying in workspace focus mode. |
| src/components/project-space/FocusModeToolbar.tsx | 89 | MODULE-PRODUCT |                   <p>Module type: {activeModule.type}</p> |
| src/components/project-space/FocusModeToolbar.tsx | 90 | MODULE-PRODUCT |                   <p>Lens: {activeModule.lens}</p> |
| src/components/project-space/FocusModeToolbar.tsx | 91 | MODULE-PRODUCT |                   <p>Size: {activeModule.size}</p> |
| src/components/project-space/FocusModeToolbar.tsx | 98 | MODULE-PRODUCT |               <Button type="button" size="sm" onClick={() => onActiveModuleChange(null)}> |
| src/components/project-space/hooks/useModuleInsertState.ts | 2 | MODULE-PRODUCT | import type { ModuleInsertItemType } from '../moduleContracts'; |
| src/components/project-space/hooks/useModuleInsertState.ts | 4 | MODULE-PRODUCT | export interface ModuleInsertPayload { |
| src/components/project-space/hooks/useModuleInsertState.ts | 10 | MODULE-PRODUCT | interface UseModuleInsertStateOptions { |
| src/components/project-space/hooks/useModuleInsertState.ts | 11 | MODULE-PRODUCT |   onInsertToEditor?: (item: ModuleInsertPayload) => void; |
| src/components/project-space/hooks/useModuleInsertState.ts | 14 | MODULE-PRODUCT | export interface ModuleInsertState { |
| src/components/project-space/hooks/useModuleInsertState.ts | 16 | MODULE-PRODUCT |   activeItemType: ModuleInsertItemType; |
| src/components/project-space/hooks/useModuleInsertState.ts | 18 | MODULE-PRODUCT |   setActiveItem: (id: string, type: ModuleInsertItemType, title: string) => void; |
| src/components/project-space/hooks/useModuleInsertState.ts | 20 | MODULE-PRODUCT |   onInsertToEditor?: (item: ModuleInsertPayload) => void; |
| src/components/project-space/hooks/useModuleInsertState.ts | 23 | MODULE-PRODUCT | export const useModuleInsertState = ({ |
| src/components/project-space/hooks/useModuleInsertState.ts | 25 | MODULE-PRODUCT | }: UseModuleInsertStateOptions = {}): ModuleInsertState => { |
| src/components/project-space/hooks/useModuleInsertState.ts | 28 | MODULE-PRODUCT |   const [activeItemType, setActiveItemType] = useState<ModuleInsertItemType>(null); |
| src/components/project-space/hooks/useModuleInsertState.ts | 31 | MODULE-PRODUCT |   const setActiveItem = useCallback((id: string, type: ModuleInsertItemType, title: string) => { |
| src/components/project-space/hooks/useModuleInsertState.ts | 53 | MODULE-PRODUCT |       if (target?.closest('[data-module-insert-ignore="true"]')) { |
| src/components/project-space/KanbanModuleSkin/hooks/useKanbanColumnLimits.ts | 2 | MODULE-PRODUCT | import type { KanbanModuleGroup } from '../types'; |
| src/components/project-space/KanbanModuleSkin/hooks/useKanbanColumnLimits.ts | 5 | MODULE-PRODUCT |   groups: KanbanModuleGroup[]; |
| src/components/project-space/KanbanModuleSkin/hooks/useKanbanGrouping.ts | 2 | MODULE-PRODUCT | import type { KanbanModuleGroup } from '../types'; |
| src/components/project-space/KanbanModuleSkin/hooks/useKanbanGrouping.ts | 5 | MODULE-PRODUCT |   groups: KanbanModuleGroup[]; |
| src/components/project-space/KanbanModuleSkin/hooks/useKanbanMutations.ts | 2 | MODULE-PRODUCT | import { UNASSIGNED_ID, type KanbanCreateState, type KanbanModuleGroup } from '../types'; |
| src/components/project-space/KanbanModuleSkin/hooks/useKanbanMutations.ts | 22 | MODULE-PRODUCT |   const handleToggleCollapse = (group: KanbanModuleGroup) => { |
| src/components/project-space/KanbanModuleSkin/index.tsx | 4 | MODULE-PRODUCT | import { ModuleEmptyState, ModuleLoadingState } from '../ModuleFeedback'; |
| src/components/project-space/KanbanModuleSkin/index.tsx | 5 | MODULE-PRODUCT | import { useModuleInsertState } from '../hooks/useModuleInsertState'; |
| src/components/project-space/KanbanModuleSkin/index.tsx | 11 | MODULE-PRODUCT | import { UNASSIGNED_ID, type KanbanModuleSkinProps } from './types'; |
| src/components/project-space/KanbanModuleSkin/index.tsx | 16 | MODULE-PRODUCT | export const KanbanModuleSkin = ({ |
| src/components/project-space/KanbanModuleSkin/index.tsx | 35 | MODULE-PRODUCT | }: KanbanModuleSkinProps) => { |
| src/components/project-space/KanbanModuleSkin/index.tsx | 41 | MODULE-PRODUCT |   } = useModuleInsertState({ onInsertToEditor }); |
| src/components/project-space/KanbanModuleSkin/index.tsx | 230 | MODULE-PRODUCT |     return <ModuleLoadingState label="Loading kanban cards" rows={6} />; |
| src/components/project-space/KanbanModuleSkin/index.tsx | 236 | MODULE-PRODUCT |         <ModuleEmptyState |
| src/components/project-space/KanbanModuleSkin/index.tsx | 247 | MODULE-PRODUCT |         <ModuleEmptyState |
| src/components/project-space/KanbanModuleSkin/KanbanCard.tsx | 634 | MODULE-PRODUCT |             data-module-insert-ignore="true" |
| src/components/project-space/KanbanModuleSkin/KanbanColumn.tsx | 13 | MODULE-PRODUCT |   type KanbanModuleGroup, |
| src/components/project-space/KanbanModuleSkin/KanbanColumn.tsx | 17 | MODULE-PRODUCT |   group: KanbanModuleGroup; |
| src/components/project-space/KanbanModuleSkin/KanbanColumn.tsx | 189 | MODULE-PRODUCT |             'module-dropzone min-h-16 space-y-2 p-2 transition-colors motion-reduce:transition-none', |
| src/components/project-space/KanbanModuleSkin/types.ts | 2 | MODULE-PRODUCT | import type { ModuleInsertState } from '../hooks/useModuleInsertState'; |
| src/components/project-space/KanbanModuleSkin/types.ts | 6 | MODULE-PRODUCT | export interface KanbanModuleGroup { |
| src/components/project-space/KanbanModuleSkin/types.ts | 28 | MODULE-PRODUCT | export interface KanbanModuleSkinProps { |
| src/components/project-space/KanbanModuleSkin/types.ts | 30 | MODULE-PRODUCT |   groups: KanbanModuleGroup[]; |
| src/components/project-space/KanbanModuleSkin/types.ts | 57 | MODULE-PRODUCT |   activeItemId: ModuleInsertState['activeItemId']; |
| src/components/project-space/KanbanModuleSkin/types.ts | 58 | MODULE-PRODUCT |   activeItemType: ModuleInsertState['activeItemType']; |
| src/components/project-space/KanbanModuleSkin/types.ts | 59 | MODULE-PRODUCT |   setActiveItem: ModuleInsertState['setActiveItem']; |
| src/components/project-space/KanbanModuleSkin/types.ts | 60 | MODULE-PRODUCT |   clearActiveItem: ModuleInsertState['clearActiveItem']; |
| src/components/project-space/KanbanModuleSkin/types.ts | 61 | MODULE-PRODUCT |   onInsertToEditor?: ModuleInsertState['onInsertToEditor']; |
| src/components/project-space/module-picker/ModulePickerConfirm.tsx | 2 | MODULE-PRODUCT | import { moduleLabel } from '../moduleCatalog'; |
| src/components/project-space/module-picker/ModulePickerConfirm.tsx | 3 | MODULE-PRODUCT | import { MODULE_PICKER_SIZE_LABELS, type ModulePickerSelection } from './modulePickerTypes'; |
| src/components/project-space/module-picker/ModulePickerConfirm.tsx | 5 | MODULE-PRODUCT | interface ModulePickerConfirmProps { |
| src/components/project-space/module-picker/ModulePickerConfirm.tsx | 6 | MODULE-PRODUCT |   selection: ModulePickerSelection \| null; |
| src/components/project-space/module-picker/ModulePickerConfirm.tsx | 8 | MODULE-PRODUCT |   onConfirm: (selection: ModulePickerSelection) => void; |
| src/components/project-space/module-picker/ModulePickerConfirm.tsx | 11 | MODULE-PRODUCT | export const ModulePickerConfirm = ({ |
| src/components/project-space/module-picker/ModulePickerConfirm.tsx | 15 | MODULE-PRODUCT | }: ModulePickerConfirmProps) => ( |
| src/components/project-space/module-picker/ModulePickerConfirm.tsx | 27 | MODULE-PRODUCT |     {selection ? `Add ${moduleLabel(selection.moduleType)} (${MODULE_PICKER_SIZE_LABELS[selection.sizeTier]})` : 'Add module'} |
| src/components/project-space/module-picker/ModulePickerOverlay.test.tsx | 5 | MODULE-PRODUCT | import { ModulePickerOverlay } from './ModulePickerOverlay'; |
| src/components/project-space/module-picker/ModulePickerOverlay.test.tsx | 6 | MODULE-PRODUCT | import { tableContract } from './modulePickerPreviewContracts'; |
| src/components/project-space/module-picker/ModulePickerOverlay.test.tsx | 8 | MODULE-PRODUCT | const ModulePickerHarness = () => { |
| src/components/project-space/module-picker/ModulePickerOverlay.test.tsx | 19 | MODULE-PRODUCT |       <ModulePickerOverlay |
| src/components/project-space/module-picker/ModulePickerOverlay.test.tsx | 56 | MODULE-PRODUCT | describe('ModulePickerOverlay', () => { |
| src/components/project-space/module-picker/ModulePickerOverlay.test.tsx | 60 | MODULE-PRODUCT |       <ModulePickerOverlay |
| src/components/project-space/module-picker/ModulePickerOverlay.test.tsx | 69 | MODULE-PRODUCT |     const overlay = document.querySelector('.module-picker-viewport-backdrop'); |
| src/components/project-space/module-picker/ModulePickerOverlay.test.tsx | 70 | MODULE-PRODUCT |     const panel = await screen.findByRole('dialog', { name: 'Add Module' }); |
| src/components/project-space/module-picker/ModulePickerOverlay.test.tsx | 72 | MODULE-PRODUCT |     expect(overlay).toHaveClass('fixed', 'inset-0', 'module-picker-viewport-backdrop'); |
| src/components/project-space/module-picker/ModulePickerOverlay.test.tsx | 73 | MODULE-PRODUCT |     expect(panel).toHaveClass('fixed', 'module-picker-viewport-panel', 'module-picker-panel-size'); |
| src/components/project-space/module-picker/ModulePickerOverlay.test.tsx | 79 | MODULE-PRODUCT |     const { container } = render(<ModulePickerHarness />); |
| src/components/project-space/module-picker/ModulePickerOverlay.test.tsx | 104 | MODULE-PRODUCT |       expect(screen.queryByRole('dialog', { name: 'Add Module' })).not.toBeInTheDocument(); |
| src/components/project-space/module-picker/ModulePickerOverlay.tsx | 3 | MODULE-PRODUCT | import { useModulePickerFocusTrap } from './useModulePickerFocusTrap'; |
| src/components/project-space/module-picker/ModulePickerOverlay.tsx | 5 | MODULE-PRODUCT | interface ModulePickerOverlayProps { |
| src/components/project-space/module-picker/ModulePickerOverlay.tsx | 15 | MODULE-PRODUCT | export const ModulePickerOverlay = ({ |
| src/components/project-space/module-picker/ModulePickerOverlay.tsx | 23 | MODULE-PRODUCT | }: ModulePickerOverlayProps) => { |
| src/components/project-space/module-picker/ModulePickerOverlay.tsx | 25 | MODULE-PRODUCT |   useModulePickerFocusTrap(open, trapRef); |
| src/components/project-space/module-picker/ModulePickerOverlay.tsx | 31 | MODULE-PRODUCT |       title="Add Module" |
| src/components/project-space/module-picker/ModulePickerOverlay.tsx | 32 | MODULE-PRODUCT |       description="Choose a module type and size, then preview it before adding it." |
| src/components/project-space/module-picker/ModulePickerOverlay.tsx | 39 | MODULE-PRODUCT |       overlayClassName="module-picker-viewport-backdrop" |
| src/components/project-space/module-picker/ModulePickerOverlay.tsx | 40 | MODULE-PRODUCT |       panelClassName="module-picker-viewport-panel module-picker-panel-size overflow-hidden p-0" |
| src/components/project-space/module-picker/ModulePickerOverlay.tsx | 48 | MODULE-PRODUCT |         <aside className="module-picker-sidebar-size flex min-h-0 flex-col border-b border-border-muted bg-surface-low md:border-b-0 md:border-r"> |
| src/components/project-space/module-picker/ModulePickerOverlay.tsx | 52 | MODULE-PRODUCT |         <section className="flex min-h-0 flex-1 overflow-hidden bg-surface p-4" aria-label="Module preview"> |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 3 | MODULE-PRODUCT | import { ModuleLoadingState } from '../ModuleFeedback'; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 4 | MODULE-PRODUCT | import { ModuleShell } from '../ModuleShell'; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 6 | MODULE-PRODUCT |   CalendarModule, |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 7 | MODULE-PRODUCT |   FilesModule, |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 8 | MODULE-PRODUCT |   KanbanModule, |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 9 | MODULE-PRODUCT |   QuickThoughtsModule, |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 10 | MODULE-PRODUCT |   RemindersModule, |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 11 | MODULE-PRODUCT |   TableModule, |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 12 | MODULE-PRODUCT |   TasksModule, |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 13 | MODULE-PRODUCT |   TimelineModule, |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 14 | MODULE-PRODUCT | } from '../modules'; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 15 | MODULE-PRODUCT | import type { ModulePickerSeedData, ModulePickerSelection } from './modulePickerTypes'; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 17 | MODULE-PRODUCT |   buildPreviewModule, |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 26 | MODULE-PRODUCT | } from './modulePickerPreviewContracts'; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 28 | MODULE-PRODUCT | interface ModulePickerPreviewProps { |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 29 | MODULE-PRODUCT |   selection: ModulePickerSelection \| null; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 30 | MODULE-PRODUCT |   seedData: ModulePickerSeedData; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 36 | MODULE-PRODUCT |   S: 'module-picker-preview-s', |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 37 | MODULE-PRODUCT |   M: 'module-picker-preview-m', |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 38 | MODULE-PRODUCT |   L: 'module-picker-preview-l', |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 42 | MODULE-PRODUCT |   project_id: 'module-picker-preview-project', |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 43 | MODULE-PRODUCT |   space_id: 'module-picker-preview-project', |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 44 | MODULE-PRODUCT |   name: 'Module Preview', |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 53 | MODULE-PRODUCT | export const ModulePickerPreview = ({ |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 58 | MODULE-PRODUCT | }: ModulePickerPreviewProps) => { |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 60 | MODULE-PRODUCT |     return <p className="text-sm text-muted">Choose a module to preview it.</p>; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 63 | MODULE-PRODUCT |     return <ModuleLoadingState label="Loading module preview data" rows={5} />; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 69 | MODULE-PRODUCT |   const module = buildPreviewModule(selection); |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 70 | MODULE-PRODUCT |   const seed = seedData[selection.moduleType]?.[selection.sizeTier] ?? {}; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 72 | MODULE-PRODUCT |     if (selection.moduleType === 'table') { |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 73 | MODULE-PRODUCT |       return <TableModule module={module} contract={tableContract(seed)} canEditProject={false} previewMode onSetModuleBinding={() => {}} />; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 75 | MODULE-PRODUCT |     if (selection.moduleType === 'kanban') { |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 76 | MODULE-PRODUCT |       return <KanbanModule module={module} contract={kanbanContract(seed)} canEditProject={false} previewMode onSetModuleBinding={() => {}} />; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 78 | MODULE-PRODUCT |     if (selection.moduleType === 'calendar') { |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 79 | MODULE-PRODUCT |       return <CalendarModule module={module} contract={calendarContract(seed)} previewMode />; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 81 | MODULE-PRODUCT |     if (selection.moduleType === 'tasks') { |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 82 | MODULE-PRODUCT |       return <TasksModule module={module} contract={tasksContract(seed)} canEditProject={false} previewMode />; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 84 | MODULE-PRODUCT |     if (selection.moduleType === 'reminders') { |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 85 | MODULE-PRODUCT |       return <RemindersModule module={module} contract={remindersContract(seed)} canEditProject={false} previewMode />; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 87 | MODULE-PRODUCT |     if (selection.moduleType === 'files') { |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 88 | MODULE-PRODUCT |       return <FilesModule module={module} contract={filesContract(seed)} canEditProject={false} previewMode />; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 90 | MODULE-PRODUCT |     if (selection.moduleType === 'quick_thoughts') { |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 91 | MODULE-PRODUCT |       return <QuickThoughtsModule module={module} contract={quickThoughtsContract(seed)} project={previewProject} canEditProject={false} previewMode />; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 93 | MODULE-PRODUCT |     return <TimelineModule contract={timelineContract(seed)} previewMode />; |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 102 | MODULE-PRODUCT |         className={cn('module-picker-readonly', previewWidthClass[selection.sizeTier])} |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 104 | MODULE-PRODUCT |         <ModuleShell moduleType={selection.moduleType} sizeTier={selection.sizeTier} readOnlyState removeDisabled previewMode onRemove={() => {}}> |
| src/components/project-space/module-picker/ModulePickerPreview.tsx | 106 | MODULE-PRODUCT |         </ModuleShell> |
| src/components/project-space/module-picker/modulePickerPreviewContracts.ts | 2 | MODULE-PRODUCT |   buildPreviewModule, |
| src/components/project-space/module-picker/modulePickerPreviewContracts.ts | 5 | MODULE-PRODUCT | } from './modulePickerPreviewCore'; |
| src/components/project-space/module-picker/modulePickerPreviewContracts.ts | 15 | MODULE-PRODUCT | } from './modulePickerPreviewPersonal'; |
| src/components/project-space/module-picker/modulePickerPreviewCore.ts | 2 | MODULE-PRODUCT | import type { ContractModuleConfig } from '../ModuleGrid'; |
| src/components/project-space/module-picker/modulePickerPreviewCore.ts | 3 | MODULE-PRODUCT | import type { KanbanModuleContract, TableModuleContract } from '../moduleContracts'; |
| src/components/project-space/module-picker/modulePickerPreviewCore.ts | 4 | MODULE-PRODUCT | import type { ModulePickerSeedPayload, ModulePickerSelection } from './modulePickerTypes'; |
| src/components/project-space/module-picker/modulePickerPreviewCore.ts | 5 | MODULE-PRODUCT | import { addMinutes, asArray, asRecord, asText, noop } from './modulePickerPreviewUtils'; |
| src/components/project-space/module-picker/modulePickerPreviewCore.ts | 7 | MODULE-PRODUCT | export const buildPreviewModule = (selection: ModulePickerSelection): ContractModuleConfig => ({ |
| src/components/project-space/module-picker/modulePickerPreviewCore.ts | 8 | MODULE-PRODUCT |   module_instance_id: `module-picker-preview-${selection.moduleType}`, |
| src/components/project-space/module-picker/modulePickerPreviewCore.ts | 9 | MODULE-PRODUCT |   module_type: selection.moduleType, |
| src/components/project-space/module-picker/modulePickerPreviewCore.ts | 15 | MODULE-PRODUCT | export const tableContract = (seed: ModulePickerSeedPayload): TableModuleContract => { |
| src/components/project-space/module-picker/modulePickerPreviewCore.ts | 56 | MODULE-PRODUCT | export const kanbanContract = (seed: ModulePickerSeedPayload): KanbanModuleContract => { |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 2 | MODULE-PRODUCT |   CalendarModuleContract, |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 3 | MODULE-PRODUCT |   FilesModuleContract, |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 4 | MODULE-PRODUCT |   QuickThoughtsModuleContract, |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 5 | MODULE-PRODUCT |   RemindersModuleContract, |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 6 | MODULE-PRODUCT |   TasksModuleContract, |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 7 | MODULE-PRODUCT |   TimelineModuleContract, |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 8 | MODULE-PRODUCT | } from '../moduleContracts'; |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 9 | MODULE-PRODUCT | import type { ModulePickerSeedPayload } from './modulePickerTypes'; |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 10 | MODULE-PRODUCT | import { addMinutes, asArray, asRecord, asText, noop, noopAsync, weekDate } from './modulePickerPreviewUtils'; |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 12 | MODULE-PRODUCT | export const calendarContract = (seed: ModulePickerSeedPayload): CalendarModuleContract => ({ |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 35 | MODULE-PRODUCT | export const tasksContract = (seed: ModulePickerSeedPayload): TasksModuleContract => ({ |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 62 | MODULE-PRODUCT | export const remindersContract = (seed: ModulePickerSeedPayload): RemindersModuleContract => ({ |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 83 | MODULE-PRODUCT | export const filesContract = (seed: ModulePickerSeedPayload): FilesModuleContract => { |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 100 | MODULE-PRODUCT | export const timelineContract = (seed: ModulePickerSeedPayload): TimelineModuleContract => ({ |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 124 | MODULE-PRODUCT | export const quickThoughtsContract = (seed: ModulePickerSeedPayload): QuickThoughtsModuleContract => ({ |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 125 | MODULE-PRODUCT |   storageKeyBase: 'hub:module-picker-preview:quick-thoughts', |
| src/components/project-space/module-picker/modulePickerPreviewPersonal.ts | 129 | MODULE-PRODUCT | export const quickThoughtEntries = (seed: ModulePickerSeedPayload) => |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 3 | MODULE-PRODUCT | import { MODULE_CATALOG, moduleIconName, type ModuleSizeTier } from '../moduleCatalog'; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 4 | MODULE-PRODUCT | import { MODULE_PICKER_SIZE_LABELS, type ModulePickerModuleType, type ModulePickerSelection } from './modulePickerTypes'; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 6 | MODULE-PRODUCT | interface ModulePickerSidebarProps { |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 7 | MODULE-PRODUCT |   onSelectionChange: (selection: ModulePickerSelection) => void; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 10 | MODULE-PRODUCT | const firstSizeForModule = (moduleType: string): ModuleSizeTier => |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 11 | MODULE-PRODUCT |   MODULE_CATALOG.find((entry) => entry.type === moduleType)?.allowedSizeTiers[0] ?? 'M'; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 13 | MODULE-PRODUCT | const initialSelection = (): ModulePickerSelection => { |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 14 | MODULE-PRODUCT |   const firstEntry = MODULE_CATALOG[0]; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 16 | MODULE-PRODUCT |     moduleType: firstEntry.type as ModulePickerModuleType, |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 21 | MODULE-PRODUCT | export const ModulePickerSidebar = ({ onSelectionChange }: ModulePickerSidebarProps) => { |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 22 | MODULE-PRODUCT |   const [expandedModule, setExpandedModule] = useState<ModulePickerModuleType>(() => initialSelection().moduleType); |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 23 | MODULE-PRODUCT |   const [selection, setSelection] = useState<ModulePickerSelection>(() => initialSelection()); |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 24 | MODULE-PRODUCT |   const moduleButtonRefs = useRef<Array<HTMLButtonElement \| null>>([]); |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 30 | MODULE-PRODUCT |   const selectModule = (moduleType: ModulePickerModuleType) => { |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 31 | MODULE-PRODUCT |     const sizeTier = firstSizeForModule(moduleType); |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 32 | MODULE-PRODUCT |     const nextSelection = { moduleType, sizeTier }; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 33 | MODULE-PRODUCT |     setExpandedModule(moduleType); |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 37 | MODULE-PRODUCT |   const selectSize = (moduleType: ModulePickerModuleType, sizeTier: ModuleSizeTier) => { |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 38 | MODULE-PRODUCT |     const nextSelection = { moduleType, sizeTier }; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 42 | MODULE-PRODUCT |   const focusModuleButton = (index: number) => { |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 43 | MODULE-PRODUCT |     const normalizedIndex = (index + MODULE_CATALOG.length) % MODULE_CATALOG.length; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 44 | MODULE-PRODUCT |     moduleButtonRefs.current[normalizedIndex]?.focus(); |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 48 | MODULE-PRODUCT |     <nav aria-label="Module types"> |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 50 | MODULE-PRODUCT |         {MODULE_CATALOG.map((entry, index) => { |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 51 | MODULE-PRODUCT |           const moduleType = entry.type as ModulePickerModuleType; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 52 | MODULE-PRODUCT |           const expanded = expandedModule === moduleType; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 53 | MODULE-PRODUCT |           const iconName = moduleIconName(entry.type) ?? 'plus'; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 58 | MODULE-PRODUCT |                   moduleButtonRefs.current[index] = node; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 63 | MODULE-PRODUCT |                 onClick={() => selectModule(moduleType)} |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 67 | MODULE-PRODUCT |                     focusModuleButton(index + 1); |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 70 | MODULE-PRODUCT |                     focusModuleButton(index - 1); |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 82 | MODULE-PRODUCT |                     const selected = selection.moduleType === moduleType && selection.sizeTier === sizeTier; |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 88 | MODULE-PRODUCT |                           onClick={() => selectSize(moduleType, sizeTier)} |
| src/components/project-space/module-picker/ModulePickerSidebar.tsx | 91 | MODULE-PRODUCT |                           {MODULE_PICKER_SIZE_LABELS[sizeTier]} |
| src/components/project-space/module-picker/modulePickerTypes.ts | 1 | MODULE-PRODUCT | import type { ModuleSizeTier } from '../moduleCatalog'; |
| src/components/project-space/module-picker/modulePickerTypes.ts | 3 | MODULE-PRODUCT | export type ModulePickerModuleType = |
| src/components/project-space/module-picker/modulePickerTypes.ts | 13 | MODULE-PRODUCT | export type ModulePickerSize = ModuleSizeTier; |
| src/components/project-space/module-picker/modulePickerTypes.ts | 15 | MODULE-PRODUCT | export interface ModulePickerSelection { |
| src/components/project-space/module-picker/modulePickerTypes.ts | 16 | MODULE-PRODUCT |   moduleType: ModulePickerModuleType; |
| src/components/project-space/module-picker/modulePickerTypes.ts | 17 | MODULE-PRODUCT |   sizeTier: ModulePickerSize; |
| src/components/project-space/module-picker/modulePickerTypes.ts | 20 | MODULE-PRODUCT | export type ModulePickerSeedPayload = Record<string, unknown>; |
| src/components/project-space/module-picker/modulePickerTypes.ts | 22 | MODULE-PRODUCT | export type ModulePickerSeedData = Partial< |
| src/components/project-space/module-picker/modulePickerTypes.ts | 23 | MODULE-PRODUCT |   Record<ModulePickerModuleType, Partial<Record<ModulePickerSize, ModulePickerSeedPayload>>> |
| src/components/project-space/module-picker/modulePickerTypes.ts | 26 | MODULE-PRODUCT | export const MODULE_PICKER_SIZE_LABELS: Record<ModulePickerSize, string> = { |
| src/components/project-space/module-picker/useModulePickerFocusTrap.ts | 37 | MODULE-PRODUCT | export const useModulePickerFocusTrap = (open: boolean, containerRef: RefObject<HTMLElement \| null>) => { |
| src/components/project-space/module-picker/useModulePickerSeedData.ts | 3 | MODULE-PRODUCT | import type { ModulePickerSeedData } from './modulePickerTypes'; |
| src/components/project-space/module-picker/useModulePickerSeedData.ts | 6 | MODULE-PRODUCT |   seedData: ModulePickerSeedData; |
| src/components/project-space/module-picker/useModulePickerSeedData.ts | 11 | MODULE-PRODUCT | const emptySeedData: ModulePickerSeedData = {}; |
| src/components/project-space/module-picker/useModulePickerSeedData.ts | 13 | MODULE-PRODUCT | export const useModulePickerSeedData = (open: boolean, accessToken?: string): SeedDataState => { |
| src/components/project-space/module-picker/useModulePickerSeedData.ts | 14 | MODULE-PRODUCT |   const cacheRef = useRef(new Map<string, ModulePickerSeedData>()); |
| src/components/project-space/module-picker/useModulePickerSeedData.ts | 33 | MODULE-PRODUCT |     void hubRequest<{ seedData: ModulePickerSeedData }>( |
| src/components/project-space/module-picker/useModulePickerSeedData.ts | 35 | MODULE-PRODUCT |       '/api/hub/module-picker/seed-data', |
| src/components/project-space/module-picker/useModulePickerSeedData.ts | 52 | MODULE-PRODUCT |           error: error instanceof Error ? error.message : 'Module previews failed to load.', |
| src/components/project-space/moduleCatalog.ts | 3 | MODULE-PRODUCT | export type ModuleSizeTier = 'S' \| 'M' \| 'L'; |
| src/components/project-space/moduleCatalog.ts | 5 | MODULE-PRODUCT | type ModuleCatalogEntry = { |
| src/components/project-space/moduleCatalog.ts | 11 | MODULE-PRODUCT |   allowedSizeTiers: readonly ModuleSizeTier[]; |
| src/components/project-space/moduleCatalog.ts | 12 | MODULE-PRODUCT |   defaultSize: ModuleSizeTier; |
| src/components/project-space/moduleCatalog.ts | 15 | MODULE-PRODUCT | export const MODULE_CATALOG = [ |
| src/components/project-space/moduleCatalog.ts | 88 | MODULE-PRODUCT | ] as const satisfies readonly ModuleCatalogEntry[]; |
| src/components/project-space/moduleCatalog.ts | 90 | MODULE-PRODUCT | export const moduleCatalogEntry = (moduleType: string) => |
| src/components/project-space/moduleCatalog.ts | 91 | MODULE-PRODUCT |   MODULE_CATALOG.find((entry) => entry.type === moduleType); |
| src/components/project-space/moduleCatalog.ts | 93 | MODULE-PRODUCT | export const moduleLabel = (moduleType: string): string => |
| src/components/project-space/moduleCatalog.ts | 94 | MODULE-PRODUCT |   moduleCatalogEntry(moduleType)?.label \|\| moduleType.replace(/_/g, ' '); |
| src/components/project-space/moduleCatalog.ts | 96 | MODULE-PRODUCT | export const moduleDescription = (moduleType: string): string => |
| src/components/project-space/moduleCatalog.ts | 97 | MODULE-PRODUCT |   moduleCatalogEntry(moduleType)?.description \|\| 'Add this module to the project.'; |
| src/components/project-space/moduleCatalog.ts | 99 | MODULE-PRODUCT | export const isLensConfigurable = (moduleType: string): boolean => |
| src/components/project-space/moduleCatalog.ts | 100 | MODULE-PRODUCT |   moduleCatalogEntry(moduleType)?.lensConfigurable ?? true; |
| src/components/project-space/moduleCatalog.ts | 102 | MODULE-PRODUCT | export const moduleIconName = (moduleType: string): IconName \| null => |
| src/components/project-space/moduleCatalog.ts | 103 | MODULE-PRODUCT |   moduleCatalogEntry(moduleType)?.iconName ?? null; |
| src/components/project-space/moduleCatalog.ts | 105 | MODULE-PRODUCT | export const moduleAllowedSizeTiers = (moduleType: string): readonly ModuleSizeTier[] => |
| src/components/project-space/moduleCatalog.ts | 106 | MODULE-PRODUCT |   moduleCatalogEntry(moduleType)?.allowedSizeTiers ?? ['S', 'M', 'L']; |
| src/components/project-space/moduleCatalog.ts | 108 | MODULE-PRODUCT | export const moduleDefaultSize = (moduleType: string): ModuleSizeTier => |
| src/components/project-space/moduleCatalog.ts | 109 | MODULE-PRODUCT |   moduleCatalogEntry(moduleType)?.defaultSize ?? 'M'; |
| src/components/project-space/moduleCatalog.ts | 111 | MODULE-PRODUCT | export const clampModuleSizeTier = (moduleType: string, sizeTier: ModuleSizeTier): ModuleSizeTier => |
| src/components/project-space/moduleCatalog.ts | 112 | MODULE-PRODUCT |   moduleAllowedSizeTiers(moduleType).includes(sizeTier) ? sizeTier : moduleDefaultSize(moduleType); |
| src/components/project-space/moduleCatalog.ts | 114 | MODULE-PRODUCT | export const moduleAccentClassName = (moduleType: string): string => { |
| src/components/project-space/moduleCatalog.ts | 115 | MODULE-PRODUCT |   if (moduleType === 'tasks') { |
| src/components/project-space/moduleCatalog.ts | 116 | MODULE-PRODUCT |     return 'module-accent-tasks'; |
| src/components/project-space/moduleCatalog.ts | 118 | MODULE-PRODUCT |   if (moduleType === 'calendar') { |
| src/components/project-space/moduleCatalog.ts | 119 | MODULE-PRODUCT |     return 'module-accent-calendar'; |
| src/components/project-space/moduleCatalog.ts | 121 | MODULE-PRODUCT |   if (moduleType === 'quick_thoughts' \|\| moduleType === 'notes') { |
| src/components/project-space/moduleCatalog.ts | 122 | MODULE-PRODUCT |     return 'module-accent-notes'; |
| src/components/project-space/moduleCatalog.ts | 124 | MODULE-PRODUCT |   if (moduleType === 'timeline' \|\| moduleType === 'stream') { |
| src/components/project-space/moduleCatalog.ts | 125 | MODULE-PRODUCT |     return 'module-accent-stream'; |
| src/components/project-space/moduleCatalog.ts | 127 | MODULE-PRODUCT |   if (moduleType === 'files') { |
| src/components/project-space/moduleCatalog.ts | 128 | MODULE-PRODUCT |     return 'module-accent-files'; |
| src/components/project-space/moduleCatalog.ts | 130 | MODULE-PRODUCT |   if (moduleType === 'reminders') { |
| src/components/project-space/moduleCatalog.ts | 131 | MODULE-PRODUCT |     return 'module-accent-reminders'; |
| src/components/project-space/moduleContracts/index.ts | 3 | MODULE-PRODUCT | import type { CalendarScope } from '../CalendarModuleSkin'; |
| src/components/project-space/moduleContracts/index.ts | 4 | MODULE-PRODUCT | import type { FilesModuleItem } from '../FilesModuleSkin'; |
| src/components/project-space/moduleContracts/index.ts | 24 | MODULE-PRODUCT | export type ModuleInsertItemType = 'task' \| 'record' \| 'file' \| 'reminder' \| 'quick-thought' \| null; |
| src/components/project-space/moduleContracts/index.ts | 26 | MODULE-PRODUCT | export interface TasksModuleContract { |
| src/components/project-space/moduleContracts/index.ts | 37 | MODULE-PRODUCT | export interface KanbanModuleContract { |
| src/components/project-space/moduleContracts/index.ts | 40 | MODULE-PRODUCT |   creatingViewByModuleId?: Record<string, boolean>; |
| src/components/project-space/moduleContracts/index.ts | 65 | MODULE-PRODUCT |   onEnsureView?: (moduleInstanceId: string, ownedViewId?: string \| null) => Promise<string \| null>; |
| src/components/project-space/moduleContracts/index.ts | 69 | MODULE-PRODUCT | export interface CalendarModuleContract { |
| src/components/project-space/moduleContracts/index.ts | 100 | MODULE-PRODUCT | export interface TableModuleContract { |
| src/components/project-space/moduleContracts/index.ts | 111 | MODULE-PRODUCT | export interface RemindersModuleContract { |
| src/components/project-space/moduleContracts/index.ts | 120 | MODULE-PRODUCT | export interface FilesModuleContract { |
| src/components/project-space/moduleContracts/index.ts | 121 | MODULE-PRODUCT |   projectFiles: FilesModuleItem[]; |
| src/components/project-space/moduleContracts/index.ts | 122 | MODULE-PRODUCT |   spaceFiles: FilesModuleItem[]; |
| src/components/project-space/moduleContracts/index.ts | 125 | MODULE-PRODUCT |   onOpenFile: (file: FilesModuleItem) => void; |
| src/components/project-space/moduleContracts/index.ts | 129 | MODULE-PRODUCT | export interface QuickThoughtsModuleContract { |
| src/components/project-space/moduleContracts/index.ts | 142 | MODULE-PRODUCT | export interface TimelineModuleContract { |
| src/components/project-space/moduleContracts/index.ts | 152 | MODULE-PRODUCT | export interface WorkViewModuleContracts { |
| src/components/project-space/moduleContracts/index.ts | 153 | MODULE-PRODUCT |   tableContract: TableModuleContract; |
| src/components/project-space/moduleContracts/index.ts | 154 | MODULE-PRODUCT |   kanbanContract: KanbanModuleContract; |
| src/components/project-space/moduleContracts/index.ts | 155 | MODULE-PRODUCT |   calendarContract: CalendarModuleContract; |
| src/components/project-space/moduleContracts/index.ts | 156 | MODULE-PRODUCT |   filesContract: FilesModuleContract; |
| src/components/project-space/moduleContracts/index.ts | 157 | MODULE-PRODUCT |   quickThoughtsContract: QuickThoughtsModuleContract; |
| src/components/project-space/moduleContracts/index.ts | 158 | MODULE-PRODUCT |   tasksContract: TasksModuleContract; |
| src/components/project-space/moduleContracts/index.ts | 159 | MODULE-PRODUCT |   timelineContract: TimelineModuleContract; |
| src/components/project-space/moduleContracts/index.ts | 160 | MODULE-PRODUCT |   remindersContract: RemindersModuleContract; |
| src/components/project-space/ModuleFeedback.tsx | 5 | MODULE-PRODUCT | export const ModuleLoadingState = ({ |
| src/components/project-space/ModuleFeedback.tsx | 18 | MODULE-PRODUCT |     <div role="status" aria-live="polite" className={cn('module-sheet-raised space-y-2 p-3', className)}> |
| src/components/project-space/ModuleFeedback.tsx | 35 | MODULE-PRODUCT | export const ModuleEmptyState = ({ |
| src/components/project-space/ModuleFeedback.tsx | 80 | MODULE-PRODUCT |         'module-sheet-raised my-auto w-full text-center', |
| src/components/project-space/ModuleGrid.tsx | 5 | MODULE-PRODUCT | import { AddModuleDialog } from './AddModuleDialog'; |
| src/components/project-space/ModuleGrid.tsx | 6 | MODULE-PRODUCT | import { ModuleShell } from './ModuleShell'; |
| src/components/project-space/ModuleGrid.tsx | 8 | MODULE-PRODUCT | export type ContractModuleLens = 'space' \| 'project' \| 'project_scratch'; |
| src/components/project-space/ModuleGrid.tsx | 10 | MODULE-PRODUCT | export interface ContractModuleConfig { |
| src/components/project-space/ModuleGrid.tsx | 11 | MODULE-PRODUCT |   module_instance_id: string; |
| src/components/project-space/ModuleGrid.tsx | 12 | MODULE-PRODUCT |   module_type: string; |
| src/components/project-space/ModuleGrid.tsx | 14 | MODULE-PRODUCT |   lens: ContractModuleLens; |
| src/components/project-space/ModuleGrid.tsx | 22 | MODULE-PRODUCT | interface ModuleGridProps { |
| src/components/project-space/ModuleGrid.tsx | 23 | MODULE-PRODUCT |   modules: ContractModuleConfig[]; |
| src/components/project-space/ModuleGrid.tsx | 24 | MODULE-PRODUCT |   onAddModule: (moduleType: string, sizeTier: ContractModuleConfig['size_tier']) => void; |
| src/components/project-space/ModuleGrid.tsx | 25 | MODULE-PRODUCT |   onRemoveModule: (moduleInstanceId: string) => void; |
| src/components/project-space/ModuleGrid.tsx | 26 | MODULE-PRODUCT |   onSetModuleLens: (moduleInstanceId: string, lens: ContractModuleLens) => void; |
| src/components/project-space/ModuleGrid.tsx | 27 | MODULE-PRODUCT |   onResizeModule: (moduleInstanceId: string, sizeTier: ContractModuleConfig['size_tier']) => void; |
| src/components/project-space/ModuleGrid.tsx | 32 | MODULE-PRODUCT |   renderModuleBody?: (module: ContractModuleConfig) => ReactNode; |
| src/components/project-space/ModuleGrid.tsx | 35 | MODULE-PRODUCT | export const ModuleGrid = ({ |
| src/components/project-space/ModuleGrid.tsx | 36 | MODULE-PRODUCT |   modules, |
| src/components/project-space/ModuleGrid.tsx | 37 | MODULE-PRODUCT |   onAddModule, |
| src/components/project-space/ModuleGrid.tsx | 38 | MODULE-PRODUCT |   onRemoveModule, |
| src/components/project-space/ModuleGrid.tsx | 43 | MODULE-PRODUCT |   renderModuleBody, |
| src/components/project-space/ModuleGrid.tsx | 44 | MODULE-PRODUCT | }: ModuleGridProps) => { |
| src/components/project-space/ModuleGrid.tsx | 48 | MODULE-PRODUCT |   const addModuleLayoutId = !prefersReducedMotion ? dialogLayoutIds.addModule : undefined; |
| src/components/project-space/ModuleGrid.tsx | 49 | MODULE-PRODUCT |   const hasModules = modules.length > 0; |
| src/components/project-space/ModuleGrid.tsx | 61 | MODULE-PRODUCT |       layoutId={addModuleLayoutId} |
| src/components/project-space/ModuleGrid.tsx | 64 | MODULE-PRODUCT |       title="Add module" |
| src/components/project-space/ModuleGrid.tsx | 65 | MODULE-PRODUCT |       aria-label="Add module" |
| src/components/project-space/ModuleGrid.tsx | 75 | MODULE-PRODUCT |     <section className="space-y-3" aria-label="Project organization modules"> |
| src/components/project-space/ModuleGrid.tsx | 77 | MODULE-PRODUCT |         <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Modules</p> |
| src/components/project-space/ModuleGrid.tsx | 81 | MODULE-PRODUCT |       {!hasModules ? ( |
| src/components/project-space/ModuleGrid.tsx | 88 | MODULE-PRODUCT |               {readOnlyState ? 'No modules in this project yet' : "Let's get this project started!"} |
| src/components/project-space/ModuleGrid.tsx | 92 | MODULE-PRODUCT |                 ? 'This project is currently read-only. Modules will appear here after they are added elsewhere.' |
| src/components/project-space/ModuleGrid.tsx | 93 | MODULE-PRODUCT |                 : 'Add a first module to shape the project.'} |
| src/components/project-space/ModuleGrid.tsx | 99 | MODULE-PRODUCT |           {modules.map((module) => ( |
| src/components/project-space/ModuleGrid.tsx | 100 | MODULE-PRODUCT |             <ModuleShell |
| src/components/project-space/ModuleGrid.tsx | 101 | MODULE-PRODUCT |               key={module.module_instance_id} |
| src/components/project-space/ModuleGrid.tsx | 102 | MODULE-PRODUCT |               moduleType={module.module_type} |
| src/components/project-space/ModuleGrid.tsx | 103 | MODULE-PRODUCT |               sizeTier={module.size_tier} |
| src/components/project-space/ModuleGrid.tsx | 106 | MODULE-PRODUCT |               onRemove={() => onRemoveModule(module.module_instance_id)} |
| src/components/project-space/ModuleGrid.tsx | 108 | MODULE-PRODUCT |               {renderModuleBody ? renderModuleBody(module) : `Module: ${module.module_type}`} |
| src/components/project-space/ModuleGrid.tsx | 109 | MODULE-PRODUCT |             </ModuleShell> |
| src/components/project-space/ModuleGrid.tsx | 113 | MODULE-PRODUCT |       <AddModuleDialog |
| src/components/project-space/ModuleGrid.tsx | 116 | MODULE-PRODUCT |         onAddModule={onAddModule} |
| src/components/project-space/ModuleGrid.tsx | 118 | MODULE-PRODUCT |         layoutId={addModuleLayoutId} |
| src/components/project-space/ModuleLensControl.tsx | 1 | MODULE-PRODUCT | import type { ModuleLens } from './types'; |
| src/components/project-space/ModuleLensControl.tsx | 4 | MODULE-PRODUCT | const lensOptions: Array<{ id: ModuleLens; label: string }> = [ |
| src/components/project-space/ModuleLensControl.tsx | 10 | MODULE-PRODUCT | export const ModuleLensControl = ({ |
| src/components/project-space/ModuleLensControl.tsx | 11 | MODULE-PRODUCT |   moduleLabel, |
| src/components/project-space/ModuleLensControl.tsx | 15 | MODULE-PRODUCT |   moduleLabel: string; |
| src/components/project-space/ModuleLensControl.tsx | 16 | MODULE-PRODUCT |   lens: ModuleLens; |
| src/components/project-space/ModuleLensControl.tsx | 17 | MODULE-PRODUCT |   onChange: (nextLens: ModuleLens) => void; |
| src/components/project-space/ModuleLensControl.tsx | 23 | MODULE-PRODUCT |         ariaLabel={`Lens for ${moduleLabel}`} |
| src/components/project-space/ModuleLensControl.tsx | 25 | MODULE-PRODUCT |         onValueChange={(value) => onChange(value as ModuleLens)} |
| src/components/project-space/modules/CalendarModule.tsx | 2 | MODULE-PRODUCT | import type { ContractModuleConfig } from '../ModuleGrid'; |
| src/components/project-space/modules/CalendarModule.tsx | 3 | MODULE-PRODUCT | import { ModuleLoadingState } from '../ModuleFeedback'; |
| src/components/project-space/modules/CalendarModule.tsx | 4 | MODULE-PRODUCT | import type { CalendarModuleContract } from '../moduleContracts'; |
| src/components/project-space/modules/CalendarModule.tsx | 6 | MODULE-PRODUCT | const CalendarModuleSkin = lazy(async () => { |
| src/components/project-space/modules/CalendarModule.tsx | 7 | MODULE-PRODUCT |   const module = await import('../CalendarModuleSkin'); |
| src/components/project-space/modules/CalendarModule.tsx | 8 | MODULE-PRODUCT |   return { default: module.CalendarModuleSkin }; |
| src/components/project-space/modules/CalendarModule.tsx | 12 | MODULE-PRODUCT |   module: ContractModuleConfig; |
| src/components/project-space/modules/CalendarModule.tsx | 13 | MODULE-PRODUCT |   contract: CalendarModuleContract; |
| src/components/project-space/modules/CalendarModule.tsx | 18 | MODULE-PRODUCT | export const CalendarModule = ({ module, contract, previewMode = false, onOpenRecord }: Props) => ( |
| src/components/project-space/modules/CalendarModule.tsx | 19 | MODULE-PRODUCT |   <Suspense fallback={<ModuleLoadingState label="Loading calendar module" rows={5} />}> |
| src/components/project-space/modules/CalendarModule.tsx | 21 | MODULE-PRODUCT |       <CalendarModuleSkin |
| src/components/project-space/modules/CalendarModule.tsx | 24 | MODULE-PRODUCT |         sizeTier={module.size_tier} |
| src/components/project-space/modules/FilesModule.tsx | 2 | MODULE-PRODUCT | import type { ContractModuleConfig } from '../ModuleGrid'; |
| src/components/project-space/modules/FilesModule.tsx | 3 | MODULE-PRODUCT | import { ModuleLoadingState } from '../ModuleFeedback'; |
| src/components/project-space/modules/FilesModule.tsx | 4 | MODULE-PRODUCT | import type { FilesModuleContract } from '../moduleContracts'; |
| src/components/project-space/modules/FilesModule.tsx | 6 | MODULE-PRODUCT | const FilesModuleSkin = lazy(async () => { |
| src/components/project-space/modules/FilesModule.tsx | 7 | MODULE-PRODUCT |   const module = await import('../FilesModuleSkin'); |
| src/components/project-space/modules/FilesModule.tsx | 8 | MODULE-PRODUCT |   return { default: module.FilesModuleSkin }; |
| src/components/project-space/modules/FilesModule.tsx | 12 | MODULE-PRODUCT |   module: ContractModuleConfig; |
| src/components/project-space/modules/FilesModule.tsx | 13 | MODULE-PRODUCT |   contract: FilesModuleContract; |
| src/components/project-space/modules/FilesModule.tsx | 18 | MODULE-PRODUCT | export const FilesModule = ({ module, contract, canEditProject, previewMode = false }: Props) => { |
| src/components/project-space/modules/FilesModule.tsx | 21 | MODULE-PRODUCT |     : module.lens === 'space' |
| src/components/project-space/modules/FilesModule.tsx | 26 | MODULE-PRODUCT |     <Suspense fallback={<ModuleLoadingState label="Loading files module" rows={4} />}> |
| src/components/project-space/modules/FilesModule.tsx | 27 | MODULE-PRODUCT |       <FilesModuleSkin |
| src/components/project-space/modules/FilesModule.tsx | 28 | MODULE-PRODUCT |         sizeTier={module.size_tier} |
| src/components/project-space/modules/FilesModule.tsx | 29 | MODULE-PRODUCT |         files={module.lens === 'space' ? contract.spaceFiles : contract.projectFiles} |
| src/components/project-space/modules/index.ts | 1 | MODULE-PRODUCT | export { TableModule } from './TableModule'; |
| src/components/project-space/modules/index.ts | 2 | MODULE-PRODUCT | export { KanbanModule } from './KanbanModule'; |
| src/components/project-space/modules/index.ts | 3 | MODULE-PRODUCT | export { CalendarModule } from './CalendarModule'; |
| src/components/project-space/modules/index.ts | 4 | MODULE-PRODUCT | export { TasksModule } from './TasksModule'; |
| src/components/project-space/modules/index.ts | 5 | MODULE-PRODUCT | export { FilesModule } from './FilesModule'; |
| src/components/project-space/modules/index.ts | 6 | MODULE-PRODUCT | export { RemindersModule } from './RemindersModule'; |
| src/components/project-space/modules/index.ts | 7 | MODULE-PRODUCT | export { QuickThoughtsModule } from './QuickThoughtsModule'; |
| src/components/project-space/modules/index.ts | 8 | MODULE-PRODUCT | export { TimelineModule } from './TimelineModule'; |
| src/components/project-space/modules/KanbanModule.tsx | 2 | MODULE-PRODUCT | import type { ContractModuleConfig } from '../ModuleGrid'; |
| src/components/project-space/modules/KanbanModule.tsx | 3 | MODULE-PRODUCT | import { ModuleEmptyState, ModuleLoadingState } from '../ModuleFeedback'; |
| src/components/project-space/modules/KanbanModule.tsx | 4 | MODULE-PRODUCT | import type { KanbanModuleContract } from '../moduleContracts'; |
| src/components/project-space/modules/KanbanModule.tsx | 6 | MODULE-PRODUCT | const KanbanModuleSkin = lazy(async () => { |
| src/components/project-space/modules/KanbanModule.tsx | 7 | MODULE-PRODUCT |   const module = await import('../KanbanModuleSkin'); |
| src/components/project-space/modules/KanbanModule.tsx | 8 | MODULE-PRODUCT |   return { default: module.KanbanModuleSkin }; |
| src/components/project-space/modules/KanbanModule.tsx | 12 | MODULE-PRODUCT |   module: ContractModuleConfig; |
| src/components/project-space/modules/KanbanModule.tsx | 13 | MODULE-PRODUCT |   contract: KanbanModuleContract; |
| src/components/project-space/modules/KanbanModule.tsx | 17 | MODULE-PRODUCT |   onSetModuleBinding: (moduleInstanceId: string, binding: ContractModuleConfig['binding']) => void; |
| src/components/project-space/modules/KanbanModule.tsx | 21 | MODULE-PRODUCT |   module: ContractModuleConfig, |
| src/components/project-space/modules/KanbanModule.tsx | 22 | MODULE-PRODUCT |   views: KanbanModuleContract['views'], |
| src/components/project-space/modules/KanbanModule.tsx | 25 | MODULE-PRODUCT |   const requested = module.binding?.view_id; |
| src/components/project-space/modules/KanbanModule.tsx | 29 | MODULE-PRODUCT |   const ownedViewId = module.binding?.owned_view_id; |
| src/components/project-space/modules/KanbanModule.tsx | 33 | MODULE-PRODUCT |   if (module.binding?.source_mode === 'owned') { |
| src/components/project-space/modules/KanbanModule.tsx | 39 | MODULE-PRODUCT | export const KanbanModule = ({ |
| src/components/project-space/modules/KanbanModule.tsx | 40 | MODULE-PRODUCT |   module, |
| src/components/project-space/modules/KanbanModule.tsx | 45 | MODULE-PRODUCT |   onSetModuleBinding, |
| src/components/project-space/modules/KanbanModule.tsx | 49 | MODULE-PRODUCT |   const isOwnedMode = module.binding?.source_mode === 'owned'; |
| src/components/project-space/modules/KanbanModule.tsx | 50 | MODULE-PRODUCT |   const ownedViewId = module.binding?.owned_view_id ?? null; |
| src/components/project-space/modules/KanbanModule.tsx | 51 | MODULE-PRODUCT |   const isCreatingView = Boolean(contract.creatingViewByModuleId?.[module.module_instance_id]); |
| src/components/project-space/modules/KanbanModule.tsx | 52 | MODULE-PRODUCT |   const selectedViewId = resolveBoundViewId(module, contract.views, contract.defaultViewId); |
| src/components/project-space/modules/KanbanModule.tsx | 74 | MODULE-PRODUCT |       const viewId = await contract.onEnsureView(module.module_instance_id, ownedViewId); |
| src/components/project-space/modules/KanbanModule.tsx | 76 | MODULE-PRODUCT |         onSetModuleBinding(module.module_instance_id, { |
| src/components/project-space/modules/KanbanModule.tsx | 77 | MODULE-PRODUCT |           ...module.binding, |
| src/components/project-space/modules/KanbanModule.tsx | 90 | MODULE-PRODUCT |   }, [acquireAutoEnsureLock, contract, module, onSetModuleBinding, ownedViewId]); |
| src/components/project-space/modules/KanbanModule.tsx | 111 | MODULE-PRODUCT |       return <ModuleLoadingState label="Preparing kanban module" visibleLabel="Preparing kanban board" rows={4} />; |
| src/components/project-space/modules/KanbanModule.tsx | 116 | MODULE-PRODUCT |         <ModuleEmptyState |
| src/components/project-space/modules/KanbanModule.tsx | 122 | MODULE-PRODUCT |           sizeTier={module.size_tier} |
| src/components/project-space/modules/KanbanModule.tsx | 137 | MODULE-PRODUCT |             onChange={(event) => onSetModuleBinding(module.module_instance_id, { |
| src/components/project-space/modules/KanbanModule.tsx | 138 | MODULE-PRODUCT |               ...module.binding, |
| src/components/project-space/modules/KanbanModule.tsx | 153 | MODULE-PRODUCT |         <Suspense fallback={<ModuleLoadingState label="Loading kanban module" rows={5} />}> |
| src/components/project-space/modules/KanbanModule.tsx | 154 | MODULE-PRODUCT |           <KanbanModuleSkin |
| src/components/project-space/modules/KanbanModule.tsx | 155 | MODULE-PRODUCT |             sizeTier={module.size_tier} |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 2 | MODULE-PRODUCT | import type { ContractModuleConfig } from '../ModuleGrid'; |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 3 | MODULE-PRODUCT | import { ModuleLoadingState } from '../ModuleFeedback'; |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 5 | MODULE-PRODUCT | import type { QuickThoughtsModuleContract } from '../moduleContracts'; |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 7 | MODULE-PRODUCT | const QuickThoughtsModuleSkin = lazy(async () => { |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 8 | MODULE-PRODUCT |   const module = await import('../QuickThoughtsModuleSkin'); |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 9 | MODULE-PRODUCT |   return { default: module.QuickThoughtsModuleSkin }; |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 13 | MODULE-PRODUCT |   module: ContractModuleConfig; |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 14 | MODULE-PRODUCT |   contract: QuickThoughtsModuleContract; |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 20 | MODULE-PRODUCT | export const QuickThoughtsModule = ({ module, contract, project, canEditProject, previewMode = false }: Props) => ( |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 21 | MODULE-PRODUCT |   <Suspense fallback={<ModuleLoadingState label="Loading Quick Thoughts module" rows={5} />}> |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 22 | MODULE-PRODUCT |     <QuickThoughtsModuleSkin |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 23 | MODULE-PRODUCT |       key={`${contract.storageKeyBase}:${project.project_id}:${module.module_instance_id}`} |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 24 | MODULE-PRODUCT |       sizeTier={module.size_tier} |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 25 | MODULE-PRODUCT |       storageKey={`${contract.storageKeyBase}:${project.project_id}:${module.module_instance_id}`} |
| src/components/project-space/modules/QuickThoughtsModule.tsx | 28 | MODULE-PRODUCT |           ? `${contract.legacyStorageKeyBase}:${project.project_id}:${module.module_instance_id}` |
| src/components/project-space/modules/RemindersModule.tsx | 2 | MODULE-PRODUCT | import type { ContractModuleConfig } from '../ModuleGrid'; |
| src/components/project-space/modules/RemindersModule.tsx | 3 | MODULE-PRODUCT | import { ModuleLoadingState } from '../ModuleFeedback'; |
| src/components/project-space/modules/RemindersModule.tsx | 4 | MODULE-PRODUCT | import type { RemindersModuleContract } from '../moduleContracts'; |
| src/components/project-space/modules/RemindersModule.tsx | 6 | MODULE-PRODUCT | const RemindersModuleSkin = lazy(async () => { |
| src/components/project-space/modules/RemindersModule.tsx | 7 | MODULE-PRODUCT |   const module = await import('../RemindersModuleSkin'); |
| src/components/project-space/modules/RemindersModule.tsx | 8 | MODULE-PRODUCT |   return { default: module.RemindersModuleSkin }; |
| src/components/project-space/modules/RemindersModule.tsx | 12 | MODULE-PRODUCT |   module: ContractModuleConfig; |
| src/components/project-space/modules/RemindersModule.tsx | 13 | MODULE-PRODUCT |   contract: RemindersModuleContract; |
| src/components/project-space/modules/RemindersModule.tsx | 18 | MODULE-PRODUCT | export const RemindersModule = ({ module, contract, canEditProject, previewMode = false }: Props) => ( |
| src/components/project-space/modules/RemindersModule.tsx | 19 | MODULE-PRODUCT |   <Suspense fallback={<ModuleLoadingState label="Loading reminders module" rows={4} />}> |
| src/components/project-space/modules/RemindersModule.tsx | 20 | MODULE-PRODUCT |     <RemindersModuleSkin |
| src/components/project-space/modules/RemindersModule.tsx | 27 | MODULE-PRODUCT |       sizeTier={module.size_tier} |
| src/components/project-space/modules/TableModule.tsx | 2 | MODULE-PRODUCT | import type { ContractModuleConfig } from '../ModuleGrid'; |
| src/components/project-space/modules/TableModule.tsx | 3 | MODULE-PRODUCT | import { ModuleLoadingState } from '../ModuleFeedback'; |
| src/components/project-space/modules/TableModule.tsx | 4 | MODULE-PRODUCT | import type { TableModuleContract } from '../moduleContracts'; |
| src/components/project-space/modules/TableModule.tsx | 6 | MODULE-PRODUCT | const TableModuleSkin = lazy(async () => { |
| src/components/project-space/modules/TableModule.tsx | 7 | MODULE-PRODUCT |   const module = await import('../TableModuleSkin'); |
| src/components/project-space/modules/TableModule.tsx | 8 | MODULE-PRODUCT |   return { default: module.TableModuleSkin }; |
| src/components/project-space/modules/TableModule.tsx | 12 | MODULE-PRODUCT |   module: ContractModuleConfig; |
| src/components/project-space/modules/TableModule.tsx | 13 | MODULE-PRODUCT |   contract: TableModuleContract; |
| src/components/project-space/modules/TableModule.tsx | 17 | MODULE-PRODUCT |   onSetModuleBinding: (moduleInstanceId: string, binding: ContractModuleConfig['binding']) => void; |
| src/components/project-space/modules/TableModule.tsx | 21 | MODULE-PRODUCT |   module: ContractModuleConfig, |
| src/components/project-space/modules/TableModule.tsx | 22 | MODULE-PRODUCT |   views: TableModuleContract['views'], |
| src/components/project-space/modules/TableModule.tsx | 25 | MODULE-PRODUCT |   const requested = module.binding?.view_id; |
| src/components/project-space/modules/TableModule.tsx | 32 | MODULE-PRODUCT | export const TableModule = ({ |
| src/components/project-space/modules/TableModule.tsx | 33 | MODULE-PRODUCT |   module, |
| src/components/project-space/modules/TableModule.tsx | 38 | MODULE-PRODUCT |   onSetModuleBinding, |
| src/components/project-space/modules/TableModule.tsx | 40 | MODULE-PRODUCT |   const selectedViewId = resolveBoundViewId(module, contract.views, contract.defaultViewId); |
| src/components/project-space/modules/TableModule.tsx | 55 | MODULE-PRODUCT |             onChange={(event) => onSetModuleBinding( |
| src/components/project-space/modules/TableModule.tsx | 56 | MODULE-PRODUCT |               module.module_instance_id, |
| src/components/project-space/modules/TableModule.tsx | 71 | MODULE-PRODUCT |         <Suspense fallback={<ModuleLoadingState label="Loading table module" rows={6} />}> |
| src/components/project-space/modules/TableModule.tsx | 72 | MODULE-PRODUCT |           <TableModuleSkin |
| src/components/project-space/modules/TableModule.tsx | 73 | MODULE-PRODUCT |             sizeTier={module.size_tier} |
| src/components/project-space/modules/TasksModule.tsx | 2 | MODULE-PRODUCT | import type { ContractModuleConfig } from '../ModuleGrid'; |
| src/components/project-space/modules/TasksModule.tsx | 3 | MODULE-PRODUCT | import { ModuleLoadingState } from '../ModuleFeedback'; |
| src/components/project-space/modules/TasksModule.tsx | 4 | MODULE-PRODUCT | import type { TasksModuleContract } from '../moduleContracts'; |
| src/components/project-space/modules/TasksModule.tsx | 6 | MODULE-PRODUCT | const TasksModuleSkin = lazy(async () => { |
| src/components/project-space/modules/TasksModule.tsx | 7 | MODULE-PRODUCT |   const module = await import('../TasksModuleSkin'); |
| src/components/project-space/modules/TasksModule.tsx | 8 | MODULE-PRODUCT |   return { default: module.TasksModuleSkin }; |
| src/components/project-space/modules/TasksModule.tsx | 12 | MODULE-PRODUCT |   module: ContractModuleConfig; |
| src/components/project-space/modules/TasksModule.tsx | 13 | MODULE-PRODUCT |   contract: TasksModuleContract; |
| src/components/project-space/modules/TasksModule.tsx | 18 | MODULE-PRODUCT | export const TasksModule = ({ module, contract, canEditProject, previewMode = false }: Props) => ( |
| src/components/project-space/modules/TasksModule.tsx | 20 | MODULE-PRODUCT |     <Suspense fallback={<ModuleLoadingState label="Loading tasks module" rows={4} />}> |
| src/components/project-space/modules/TasksModule.tsx | 21 | MODULE-PRODUCT |       <TasksModuleSkin |
| src/components/project-space/modules/TasksModule.tsx | 22 | MODULE-PRODUCT |         sizeTier={module.size_tier \|\| 'M'} |
| src/components/project-space/modules/TimelineModule.tsx | 2 | MODULE-PRODUCT | import type { TimelineModuleContract } from '../moduleContracts'; |
| src/components/project-space/modules/TimelineModule.tsx | 5 | MODULE-PRODUCT |   contract: TimelineModuleContract; |
| src/components/project-space/modules/TimelineModule.tsx | 9 | MODULE-PRODUCT | export const TimelineModule = ({ contract, previewMode = false }: Props) => ( |
| src/components/project-space/ModuleSettingsPopover.tsx | 4 | MODULE-PRODUCT | interface ModuleSettingsPopoverProps { |
| src/components/project-space/ModuleSettingsPopover.tsx | 12 | MODULE-PRODUCT | export const ModuleSettingsPopover = ({ |
| src/components/project-space/ModuleSettingsPopover.tsx | 18 | MODULE-PRODUCT | }: ModuleSettingsPopoverProps) => ( |
| src/components/project-space/ModuleShell.tsx | 12 | MODULE-PRODUCT | import { moduleAccentClassName, moduleLabel } from './moduleCatalog'; |
| src/components/project-space/ModuleShell.tsx | 14 | MODULE-PRODUCT | type ModuleSizeTier = 'S' \| 'M' \| 'L'; |
| src/components/project-space/ModuleShell.tsx | 16 | MODULE-PRODUCT | const sizeClass: Record<ModuleSizeTier, string> = { |
| src/components/project-space/ModuleShell.tsx | 22 | MODULE-PRODUCT | const sizeHeightClass: Record<ModuleSizeTier, string> = { |
| src/components/project-space/ModuleShell.tsx | 23 | MODULE-PRODUCT |   S: 'module-card-s', |
| src/components/project-space/ModuleShell.tsx | 24 | MODULE-PRODUCT |   M: 'module-card-m', |
| src/components/project-space/ModuleShell.tsx | 25 | MODULE-PRODUCT |   L: 'module-card-l', |
| src/components/project-space/ModuleShell.tsx | 28 | MODULE-PRODUCT | interface ModuleShellProps { |
| src/components/project-space/ModuleShell.tsx | 29 | MODULE-PRODUCT |   moduleType: string; |
| src/components/project-space/ModuleShell.tsx | 30 | MODULE-PRODUCT |   sizeTier: ModuleSizeTier; |
| src/components/project-space/ModuleShell.tsx | 38 | MODULE-PRODUCT | export const ModuleShell = ({ |
| src/components/project-space/ModuleShell.tsx | 39 | MODULE-PRODUCT |   moduleType, |
| src/components/project-space/ModuleShell.tsx | 46 | MODULE-PRODUCT | }: ModuleShellProps) => { |
| src/components/project-space/ModuleShell.tsx | 48 | MODULE-PRODUCT |   const label = moduleLabel(moduleType); |
| src/components/project-space/ModuleShell.tsx | 49 | MODULE-PRODUCT |   const accentClassName = moduleAccentClassName(moduleType); |
| src/components/project-space/ModuleShell.tsx | 53 | MODULE-PRODUCT |       data-testid="module-card" |
| src/components/project-space/ModuleShell.tsx | 55 | MODULE-PRODUCT |         'module-sheet relative flex flex-col overflow-hidden p-3', |
| src/components/project-space/ModuleShell.tsx | 58 | MODULE-PRODUCT |         previewMode ? 'module-picker-preview-card' : sizeHeightClass[sizeTier], |
| src/components/project-space/ModuleShell.tsx | 66 | MODULE-PRODUCT |             aria-label={`${removeDisabled ? 'View' : 'Open'} ${label} module actions`} |
| src/components/project-space/ModuleShell.tsx | 87 | MODULE-PRODUCT |                 ariaLabel={`${label} module actions`} |
| src/components/project-space/ModuleShell.tsx | 108 | MODULE-PRODUCT |         data-module-card-body="true" |
| src/components/project-space/OverviewView.tsx | 6 | MODULE-PRODUCT | import { CalendarModuleSkin } from './CalendarModuleSkin'; |
| src/components/project-space/OverviewView.tsx | 7 | MODULE-PRODUCT | import type { CalendarEventSummary, CalendarScope } from './CalendarModuleSkin/types'; |
| src/components/project-space/OverviewView.tsx | 353 | MODULE-PRODUCT |               <CalendarModuleSkin |
| src/components/project-space/ProjectHeaderControls.tsx | 12 | MODULE-PRODUCT |   id: 'modules' \| 'workspace'; |
| src/components/project-space/ProjectHeaderControls.tsx | 55 | MODULE-PRODUCT |     <div className="module-toolbar flex flex-wrap items-center gap-2 p-2"> |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 4 | MODULE-PRODUCT | import { useModuleInsertState, type ModuleInsertState } from './hooks/useModuleInsertState'; |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 6 | MODULE-PRODUCT | import { ModuleEmptyState } from './ModuleFeedback'; |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 16 | MODULE-PRODUCT | interface QuickThoughtsModuleSkinProps { |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 127 | MODULE-PRODUCT |     <div className="module-rule flex justify-between gap-2 px-xs py-1"> |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 183 | MODULE-PRODUCT |   activeItemId: ModuleInsertState['activeItemId']; |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 184 | MODULE-PRODUCT |   activeItemType: ModuleInsertState['activeItemType']; |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 185 | MODULE-PRODUCT |   setActiveItem: ModuleInsertState['setActiveItem']; |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 186 | MODULE-PRODUCT |   clearActiveItem: ModuleInsertState['clearActiveItem']; |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 187 | MODULE-PRODUCT |   onInsertToEditor?: ModuleInsertState['onInsertToEditor']; |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 293 | MODULE-PRODUCT |               data-module-insert-ignore="true" |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 309 | MODULE-PRODUCT | export const QuickThoughtsModuleSkin = ({ |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 317 | MODULE-PRODUCT | }: QuickThoughtsModuleSkinProps) => { |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 323 | MODULE-PRODUCT |   } = useModuleInsertState({ onInsertToEditor: previewMode ? undefined : onInsertToEditor }); |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 462 | MODULE-PRODUCT |     <div className="module-sheet flex h-full min-h-0 flex-col p-sm"> |
| src/components/project-space/QuickThoughtsModuleSkin.tsx | 485 | MODULE-PRODUCT |           <ModuleEmptyState |
| src/components/project-space/record-inspector/RecordInspectorSchemaFields.tsx | 1 | MODULE-PRODUCT | import { buildFieldUpdateValue, getEditableFieldValue, getEditableInputType, readFieldOptions } from '../TableModuleSkin/valueNormalization'; |
| src/components/project-space/RemindersModuleSkin.tsx | 5 | MODULE-PRODUCT | import { useModuleInsertState, type ModuleInsertState } from './hooks/useModuleInsertState'; |
| src/components/project-space/RemindersModuleSkin.tsx | 10 | MODULE-PRODUCT | import { ModuleEmptyState } from './ModuleFeedback'; |
| src/components/project-space/RemindersModuleSkin.tsx | 14 | MODULE-PRODUCT | export interface RemindersModuleSkinProps { |
| src/components/project-space/RemindersModuleSkin.tsx | 44 | MODULE-PRODUCT | const STYLE_ELEMENT_ID = 'reminders-module-animations'; |
| src/components/project-space/RemindersModuleSkin.tsx | 158 | MODULE-PRODUCT |   activeItemId: ModuleInsertState['activeItemId']; |
| src/components/project-space/RemindersModuleSkin.tsx | 159 | MODULE-PRODUCT |   activeItemType: ModuleInsertState['activeItemType']; |
| src/components/project-space/RemindersModuleSkin.tsx | 160 | MODULE-PRODUCT |   setActiveItem: ModuleInsertState['setActiveItem']; |
| src/components/project-space/RemindersModuleSkin.tsx | 161 | MODULE-PRODUCT |   clearActiveItem: ModuleInsertState['clearActiveItem']; |
| src/components/project-space/RemindersModuleSkin.tsx | 162 | MODULE-PRODUCT |   onInsertToEditor?: ModuleInsertState['onInsertToEditor']; |
| src/components/project-space/RemindersModuleSkin.tsx | 242 | MODULE-PRODUCT |             data-module-insert-ignore="true" |
| src/components/project-space/RemindersModuleSkin.tsx | 261 | MODULE-PRODUCT | export const RemindersModuleSkin = ({ |
| src/components/project-space/RemindersModuleSkin.tsx | 272 | MODULE-PRODUCT | }: RemindersModuleSkinProps) => { |
| src/components/project-space/RemindersModuleSkin.tsx | 278 | MODULE-PRODUCT |   } = useModuleInsertState({ onInsertToEditor: previewMode ? undefined : onInsertToEditor }); |
| src/components/project-space/RemindersModuleSkin.tsx | 433 | MODULE-PRODUCT |     <section className="flex h-full min-h-0 flex-col gap-3" aria-label="Reminders module"> |
| src/components/project-space/RemindersModuleSkin.tsx | 474 | MODULE-PRODUCT |           <div className="module-toolbar px-3 py-2 text-xs text-text-secondary"> |
| src/components/project-space/RemindersModuleSkin.tsx | 503 | MODULE-PRODUCT |           <p className="module-sheet-raised px-3 py-4 text-sm text-text-secondary"> |
| src/components/project-space/RemindersModuleSkin.tsx | 509 | MODULE-PRODUCT |           <ModuleEmptyState |
| src/components/project-space/TableModuleSkin/index.tsx | 6 | MODULE-PRODUCT | import { ModuleEmptyState, ModuleLoadingState } from '../ModuleFeedback'; |
| src/components/project-space/TableModuleSkin/index.tsx | 17 | MODULE-PRODUCT | import type { TableField, TableModuleSkinProps, TableRowData } from './types'; |
| src/components/project-space/TableModuleSkin/index.tsx | 27 | MODULE-PRODUCT | export const TableModuleSkin = ({ |
| src/components/project-space/TableModuleSkin/index.tsx | 43 | MODULE-PRODUCT | }: TableModuleSkinProps) => { |
| src/components/project-space/TableModuleSkin/index.tsx | 338 | MODULE-PRODUCT |     return (node.closest('[data-module-card-body="true"]') as HTMLDivElement \| null) ?? node; |
| src/components/project-space/TableModuleSkin/index.tsx | 380 | MODULE-PRODUCT |     return <ModuleLoadingState label="Loading table records" rows={6} />; |
| src/components/project-space/TableModuleSkin/index.tsx | 387 | MODULE-PRODUCT |       return <ModuleEmptyState title="No table view found yet." iconName="table" description="Table For Two?" sizeTier={sizeTier} />; |
| src/components/project-space/TableModuleSkin/index.tsx | 392 | MODULE-PRODUCT |         <ModuleEmptyState |
| src/components/project-space/TableModuleSkin/index.tsx | 441 | MODULE-PRODUCT |     <section className={cn('module-sheet flex min-h-0 flex-col', previewMode ? 'w-full' : 'h-full')} aria-label="Table module"> |
| src/components/project-space/TableModuleSkin/index.tsx | 483 | MODULE-PRODUCT |             <ModuleEmptyState |
| src/components/project-space/TableModuleSkin/TableHeader.tsx | 77 | MODULE-PRODUCT |         <div className="module-rule px-3 py-2"> |
| src/components/project-space/TableModuleSkin/TableHeader.tsx | 155 | MODULE-PRODUCT |         <div className="module-rule px-3 py-2"> |
| src/components/project-space/TableModuleSkin/types.ts | 22 | MODULE-PRODUCT | export interface TableModuleSkinProps { |
| src/components/project-space/TasksModuleSkin/index.tsx | 8 | MODULE-PRODUCT | import { ModuleEmptyState } from '../ModuleFeedback'; |
| src/components/project-space/TasksModuleSkin/index.tsx | 9 | MODULE-PRODUCT | import { useModuleInsertState, type ModuleInsertState } from '../hooks/useModuleInsertState'; |
| src/components/project-space/TasksModuleSkin/index.tsx | 12 | MODULE-PRODUCT | interface TasksModuleSkinProps { |
| src/components/project-space/TasksModuleSkin/index.tsx | 124 | MODULE-PRODUCT |   onUpdateTaskStatus?: TasksModuleSkinProps['onUpdateTaskStatus']; |
| src/components/project-space/TasksModuleSkin/index.tsx | 125 | MODULE-PRODUCT |   activeItemId: ModuleInsertState['activeItemId']; |
| src/components/project-space/TasksModuleSkin/index.tsx | 126 | MODULE-PRODUCT |   activeItemType: ModuleInsertState['activeItemType']; |
| src/components/project-space/TasksModuleSkin/index.tsx | 127 | MODULE-PRODUCT |   setActiveItem: ModuleInsertState['setActiveItem']; |
| src/components/project-space/TasksModuleSkin/index.tsx | 128 | MODULE-PRODUCT |   clearActiveItem: ModuleInsertState['clearActiveItem']; |
| src/components/project-space/TasksModuleSkin/index.tsx | 129 | MODULE-PRODUCT |   onInsertToEditor?: ModuleInsertState['onInsertToEditor']; |
| src/components/project-space/TasksModuleSkin/index.tsx | 163 | MODULE-PRODUCT |   onUpdateTaskStatus?: TasksModuleSkinProps['onUpdateTaskStatus']; |
| src/components/project-space/TasksModuleSkin/index.tsx | 164 | MODULE-PRODUCT |   activeItemId: ModuleInsertState['activeItemId']; |
| src/components/project-space/TasksModuleSkin/index.tsx | 165 | MODULE-PRODUCT |   activeItemType: ModuleInsertState['activeItemType']; |
| src/components/project-space/TasksModuleSkin/index.tsx | 166 | MODULE-PRODUCT |   setActiveItem: ModuleInsertState['setActiveItem']; |
| src/components/project-space/TasksModuleSkin/index.tsx | 167 | MODULE-PRODUCT |   clearActiveItem: ModuleInsertState['clearActiveItem']; |
| src/components/project-space/TasksModuleSkin/index.tsx | 168 | MODULE-PRODUCT |   onInsertToEditor?: ModuleInsertState['onInsertToEditor']; |
| src/components/project-space/TasksModuleSkin/index.tsx | 213 | MODULE-PRODUCT |           data-module-insert-ignore="true" |
| src/components/project-space/TasksModuleSkin/index.tsx | 227 | MODULE-PRODUCT | const TasksModuleSmall = ({ |
| src/components/project-space/TasksModuleSkin/index.tsx | 235 | MODULE-PRODUCT | }: Pick<TasksModuleSkinProps, 'tasks' \| 'tasksLoading' \| 'onCreateTask' \| 'onUpdateTaskStatus' \| 'readOnly'> & { |
| src/components/project-space/TasksModuleSkin/index.tsx | 236 | MODULE-PRODUCT |   insertState: ModuleInsertState; |
| src/components/project-space/TasksModuleSkin/index.tsx | 256 | MODULE-PRODUCT |           <ModuleEmptyState |
| src/components/project-space/TasksModuleSkin/index.tsx | 280 | MODULE-PRODUCT | const TasksModuleMedium = ({ |
| src/components/project-space/TasksModuleSkin/index.tsx | 288 | MODULE-PRODUCT | }: Pick<TasksModuleSkinProps, 'tasks' \| 'tasksLoading' \| 'onCreateTask' \| 'onUpdateTaskStatus' \| 'readOnly'> & { |
| src/components/project-space/TasksModuleSkin/index.tsx | 289 | MODULE-PRODUCT |   insertState: ModuleInsertState; |
| src/components/project-space/TasksModuleSkin/index.tsx | 298 | MODULE-PRODUCT |     <section className="module-sheet flex h-full min-h-0 flex-col p-4" aria-label="Tasks module"> |
| src/components/project-space/TasksModuleSkin/index.tsx | 321 | MODULE-PRODUCT |           <ModuleEmptyState |
| src/components/project-space/TasksModuleSkin/index.tsx | 350 | MODULE-PRODUCT | const TasksModuleLarge = ({ |
| src/components/project-space/TasksModuleSkin/index.tsx | 363 | MODULE-PRODUCT | }: Omit<TasksModuleSkinProps, 'sizeTier'> & { |
| src/components/project-space/TasksModuleSkin/index.tsx | 364 | MODULE-PRODUCT |   insertState: ModuleInsertState; |
| src/components/project-space/TasksModuleSkin/index.tsx | 428 | MODULE-PRODUCT |     <section className="flex h-full min-h-0 flex-col gap-3" aria-label="Tasks module"> |
| src/components/project-space/TasksModuleSkin/index.tsx | 430 | MODULE-PRODUCT |         <div className="module-sheet min-h-0 flex-1 overflow-y-auto p-4"> |
| src/components/project-space/TasksModuleSkin/index.tsx | 475 | MODULE-PRODUCT |         <ModuleEmptyState |
| src/components/project-space/TasksModuleSkin/index.tsx | 523 | MODULE-PRODUCT | export const TasksModuleSkin = ({ sizeTier, onInsertToEditor, previewMode = false, ...props }: TasksModuleSkinProps) => { |
| src/components/project-space/TasksModuleSkin/index.tsx | 524 | MODULE-PRODUCT |   const insertState = useModuleInsertState({ onInsertToEditor: previewMode ? undefined : onInsertToEditor }); |
| src/components/project-space/TasksModuleSkin/index.tsx | 528 | MODULE-PRODUCT |       {sizeTier === 'S' ? <TasksModuleSmall {...props} previewMode={previewMode} insertState={insertState} /> : null} |
| src/components/project-space/TasksModuleSkin/index.tsx | 529 | MODULE-PRODUCT |       {sizeTier === 'M' ? <TasksModuleMedium {...props} previewMode={previewMode} insertState={insertState} /> : null} |
| src/components/project-space/TasksModuleSkin/index.tsx | 530 | MODULE-PRODUCT |       {sizeTier === 'L' ? <TasksModuleLarge {...props} previewMode={previewMode} insertState={insertState} /> : null} |
| src/components/project-space/TasksModuleSkin/TaskComposer.tsx | 162 | MODULE-PRODUCT |         <div className="module-toolbar px-3 py-2 text-xs text-text-secondary"> |
| src/components/project-space/TasksTab/index.tsx | 5 | MODULE-PRODUCT | import type { ModuleInsertItemType } from '../moduleContracts'; |
| src/components/project-space/TasksTab/index.tsx | 62 | MODULE-PRODUCT |   activeItemType?: ModuleInsertItemType; |
| src/components/project-space/TasksTab/index.tsx | 63 | MODULE-PRODUCT |   setActiveItem?: (id: string, type: ModuleInsertItemType, title: string) => void; |
| src/components/project-space/TasksTab/TaskRow.tsx | 10 | MODULE-PRODUCT | import type { ModuleInsertItemType } from '../moduleContracts'; |
| src/components/project-space/TasksTab/TaskRow.tsx | 155 | MODULE-PRODUCT |   activeItemType?: ModuleInsertItemType; |
| src/components/project-space/TasksTab/TaskRow.tsx | 156 | MODULE-PRODUCT |   setActiveItem?: (id: string, type: ModuleInsertItemType, title: string) => void; |
| src/components/project-space/TasksTab/TaskRow.tsx | 555 | MODULE-PRODUCT |           data-module-insert-ignore="true" |
| src/components/project-space/types.ts | 9 | MODULE-PRODUCT | export type ModuleSize = 'S' \| 'M' \| 'L'; |
| src/components/project-space/types.ts | 11 | MODULE-PRODUCT | export type ModuleLens = 'space' \| 'project' \| 'project_scratch'; |
| src/components/project-space/types.ts | 13 | MODULE-PRODUCT | export type ModuleType = |
| src/components/project-space/types.ts | 35 | MODULE-PRODUCT | export interface ModuleTemplate { |
| src/components/project-space/types.ts | 36 | MODULE-PRODUCT |   type: ModuleType; |
| src/components/project-space/types.ts | 38 | MODULE-PRODUCT |   defaultSize: ModuleSize; |
| src/components/project-space/types.ts | 39 | MODULE-PRODUCT |   defaultLens: ModuleLens; |
| src/components/project-space/types.ts | 42 | MODULE-PRODUCT | export interface ProjectModule { |
| src/components/project-space/types.ts | 44 | MODULE-PRODUCT |   type: ModuleType; |
| src/components/project-space/types.ts | 46 | MODULE-PRODUCT |   size: ModuleSize; |
| src/components/project-space/types.ts | 47 | MODULE-PRODUCT |   lens: ModuleLens; |
| src/components/project-space/types.ts | 55 | MODULE-PRODUCT |   modulesEnabled: boolean; |
| src/components/project-space/types.ts | 58 | MODULE-PRODUCT |   modules: ProjectModule[]; |
| src/components/project-space/ViewEmbedBlock.tsx | 5 | MODULE-PRODUCT | import { ModuleEmptyState, ModuleLoadingState } from './ModuleFeedback'; |
| src/components/project-space/ViewEmbedBlock.tsx | 128 | MODULE-PRODUCT |       {loading ? <ModuleLoadingState label="Loading embedded view" className="mt-3" rows={3} /> : null} |
| src/components/project-space/ViewEmbedBlock.tsx | 194 | MODULE-PRODUCT |         <ModuleEmptyState title="No records in this view." className="mt-3" /> |
| src/components/project-space/WorkspaceDocSurface.tsx | 18 | MODULE-PRODUCT | import { ModuleLoadingState } from './ModuleFeedback'; |
| src/components/project-space/WorkspaceDocSurface.tsx | 29 | MODULE-PRODUCT |   const module = await import('../../features/notes/CollaborativeLexicalEditor'); |
| src/components/project-space/WorkspaceDocSurface.tsx | 30 | MODULE-PRODUCT |   return { default: module.CollaborativeLexicalEditor }; |
| src/components/project-space/WorkspaceDocSurface.tsx | 153 | MODULE-PRODUCT |         <p className="mt-2 text-sm text-muted">This project is set to modules-only mode. The workspace doc is hidden here.</p> |
| src/components/project-space/WorkspaceDocSurface.tsx | 165 | MODULE-PRODUCT |               <Suspense fallback={<ModuleLoadingState label="Loading collaborative editor" rows={8} />}> |
| src/components/project-space/WorkspaceDocSurface.tsx | 275 | MODULE-PRODUCT |           <ModuleLoadingState label="Loading workspace doc" rows={8} /> |
| src/components/project-space/WorkView.tsx | 4 | MODULE-PRODUCT | import { ModuleGrid, type ContractModuleConfig } from './ModuleGrid'; |
| src/components/project-space/WorkView.tsx | 7 | MODULE-PRODUCT | import { clampModuleSizeTier } from './moduleCatalog'; |
| src/components/project-space/WorkView.tsx | 9 | MODULE-PRODUCT |   CalendarModuleContract, |
| src/components/project-space/WorkView.tsx | 10 | MODULE-PRODUCT |   FilesModuleContract, |
| src/components/project-space/WorkView.tsx | 11 | MODULE-PRODUCT |   KanbanModuleContract, |
| src/components/project-space/WorkView.tsx | 12 | MODULE-PRODUCT |   QuickThoughtsModuleContract, |
| src/components/project-space/WorkView.tsx | 13 | MODULE-PRODUCT |   RemindersModuleContract, |
| src/components/project-space/WorkView.tsx | 14 | MODULE-PRODUCT |   TableModuleContract, |
| src/components/project-space/WorkView.tsx | 15 | MODULE-PRODUCT |   TasksModuleContract, |
| src/components/project-space/WorkView.tsx | 16 | MODULE-PRODUCT |   TimelineModuleContract, |
| src/components/project-space/WorkView.tsx | 17 | MODULE-PRODUCT | } from './moduleContracts'; |
| src/components/project-space/WorkView.tsx | 19 | MODULE-PRODUCT |   CalendarModule, |
| src/components/project-space/WorkView.tsx | 20 | MODULE-PRODUCT |   FilesModule, |
| src/components/project-space/WorkView.tsx | 21 | MODULE-PRODUCT |   KanbanModule, |
| src/components/project-space/WorkView.tsx | 22 | MODULE-PRODUCT |   QuickThoughtsModule, |
| src/components/project-space/WorkView.tsx | 23 | MODULE-PRODUCT |   RemindersModule, |
| src/components/project-space/WorkView.tsx | 24 | MODULE-PRODUCT |   TableModule, |
| src/components/project-space/WorkView.tsx | 25 | MODULE-PRODUCT |   TasksModule, |
| src/components/project-space/WorkView.tsx | 26 | MODULE-PRODUCT |   TimelineModule, |
| src/components/project-space/WorkView.tsx | 27 | MODULE-PRODUCT | } from './modules'; |
| src/components/project-space/WorkView.tsx | 35 | MODULE-PRODUCT |   modulesEnabled?: boolean; |
| src/components/project-space/WorkView.tsx | 39 | MODULE-PRODUCT |   tableContract?: Partial<TableModuleContract>; |
| src/components/project-space/WorkView.tsx | 40 | MODULE-PRODUCT |   kanbanContract?: Partial<KanbanModuleContract>; |
| src/components/project-space/WorkView.tsx | 41 | MODULE-PRODUCT |   calendarContract?: Partial<CalendarModuleContract>; |
| src/components/project-space/WorkView.tsx | 42 | MODULE-PRODUCT |   filesContract?: Partial<FilesModuleContract>; |
| src/components/project-space/WorkView.tsx | 43 | MODULE-PRODUCT |   quickThoughtsContract?: Partial<QuickThoughtsModuleContract>; |
| src/components/project-space/WorkView.tsx | 44 | MODULE-PRODUCT |   tasksContract?: Partial<TasksModuleContract>; |
| src/components/project-space/WorkView.tsx | 45 | MODULE-PRODUCT |   timelineContract?: Partial<TimelineModuleContract>; |
| src/components/project-space/WorkView.tsx | 46 | MODULE-PRODUCT |   remindersContract?: Partial<RemindersModuleContract>; |
| src/components/project-space/WorkView.tsx | 49 | MODULE-PRODUCT | const normalizeModuleType = (moduleType: unknown): string => { |
| src/components/project-space/WorkView.tsx | 50 | MODULE-PRODUCT |   return typeof moduleType === 'string' && moduleType ? moduleType : 'unknown'; |
| src/components/project-space/WorkView.tsx | 53 | MODULE-PRODUCT | const defaultModuleLens = (moduleType: string): ContractModuleConfig['lens'] => { |
| src/components/project-space/WorkView.tsx | 54 | MODULE-PRODUCT |   if (moduleType === 'quick_thoughts') { |
| src/components/project-space/WorkView.tsx | 57 | MODULE-PRODUCT |   if (moduleType === 'tasks') { |
| src/components/project-space/WorkView.tsx | 60 | MODULE-PRODUCT |   if (moduleType === 'reminders') { |
| src/components/project-space/WorkView.tsx | 66 | MODULE-PRODUCT | const normalizeModuleLens = (moduleType: string, lens: unknown): ContractModuleConfig['lens'] => { |
| src/components/project-space/WorkView.tsx | 67 | MODULE-PRODUCT |   if (moduleType === 'quick_thoughts') { |
| src/components/project-space/WorkView.tsx | 70 | MODULE-PRODUCT |   if (moduleType === 'tasks') { |
| src/components/project-space/WorkView.tsx | 73 | MODULE-PRODUCT |   if (moduleType === 'reminders') { |
| src/components/project-space/WorkView.tsx | 85 | MODULE-PRODUCT | const parseModules = (layoutConfig: Record<string, unknown> \| null \| undefined): ContractModuleConfig[] => { |
| src/components/project-space/WorkView.tsx | 89 | MODULE-PRODUCT |   const raw = Array.isArray(layoutConfig.modules) ? layoutConfig.modules : []; |
| src/components/project-space/WorkView.tsx | 90 | MODULE-PRODUCT |   const modules: ContractModuleConfig[] = []; |
| src/components/project-space/WorkView.tsx | 98 | MODULE-PRODUCT |     const moduleType = normalizeModuleType(value.module_type); |
| src/components/project-space/WorkView.tsx | 102 | MODULE-PRODUCT |     const binding: ContractModuleConfig['binding'] = |
| src/components/project-space/WorkView.tsx | 124 | MODULE-PRODUCT |     modules.push({ |
| src/components/project-space/WorkView.tsx | 125 | MODULE-PRODUCT |       module_instance_id: |
| src/components/project-space/WorkView.tsx | 126 | MODULE-PRODUCT |         typeof value.module_instance_id === 'string' && value.module_instance_id |
| src/components/project-space/WorkView.tsx | 127 | MODULE-PRODUCT |           ? value.module_instance_id |
| src/components/project-space/WorkView.tsx | 128 | MODULE-PRODUCT |           : `module-${index + 1}`, |
| src/components/project-space/WorkView.tsx | 129 | MODULE-PRODUCT |       module_type: moduleType, |
| src/components/project-space/WorkView.tsx | 130 | MODULE-PRODUCT |       size_tier: clampModuleSizeTier(moduleType, normalizedSizeTier), |
| src/components/project-space/WorkView.tsx | 131 | MODULE-PRODUCT |       lens: normalizeModuleLens(moduleType, lens), |
| src/components/project-space/WorkView.tsx | 136 | MODULE-PRODUCT |   return modules; |
| src/components/project-space/WorkView.tsx | 139 | MODULE-PRODUCT | const serializeModules = (modules: ContractModuleConfig[]): Array<Record<string, unknown>> => |
| src/components/project-space/WorkView.tsx | 140 | MODULE-PRODUCT |   modules.map((module) => ({ |
| src/components/project-space/WorkView.tsx | 141 | MODULE-PRODUCT |     module_instance_id: module.module_instance_id, |
| src/components/project-space/WorkView.tsx | 142 | MODULE-PRODUCT |     module_type: normalizeModuleType(module.module_type), |
| src/components/project-space/WorkView.tsx | 143 | MODULE-PRODUCT |     size_tier: module.size_tier, |
| src/components/project-space/WorkView.tsx | 144 | MODULE-PRODUCT |     lens: normalizeModuleLens(normalizeModuleType(module.module_type), module.lens), |
| src/components/project-space/WorkView.tsx | 146 | MODULE-PRODUCT |       module.binding?.view_id \|\| module.binding?.owned_view_id \|\| module.binding?.source_mode |
| src/components/project-space/WorkView.tsx | 149 | MODULE-PRODUCT |               ...(module.binding?.view_id ? { view_id: module.binding.view_id } : {}), |
| src/components/project-space/WorkView.tsx | 150 | MODULE-PRODUCT |               ...(module.binding?.owned_view_id ? { owned_view_id: module.binding.owned_view_id } : {}), |
| src/components/project-space/WorkView.tsx | 151 | MODULE-PRODUCT |               ...(module.binding?.source_mode ? { source_mode: module.binding.source_mode } : {}), |
| src/components/project-space/WorkView.tsx | 158 | MODULE-PRODUCT | const EMPTY_TABLE_CONTRACT: TableModuleContract = { |
| src/components/project-space/WorkView.tsx | 164 | MODULE-PRODUCT | const EMPTY_KANBAN_CONTRACT: KanbanModuleContract = { |
| src/components/project-space/WorkView.tsx | 171 | MODULE-PRODUCT | const EMPTY_CALENDAR_CONTRACT: CalendarModuleContract = { |
| src/components/project-space/WorkView.tsx | 180 | MODULE-PRODUCT | const EMPTY_FILES_CONTRACT: FilesModuleContract = { |
| src/components/project-space/WorkView.tsx | 189 | MODULE-PRODUCT | const EMPTY_QUICK_THOUGHTS_CONTRACT: QuickThoughtsModuleContract = { |
| src/components/project-space/WorkView.tsx | 195 | MODULE-PRODUCT | const EMPTY_TASKS_CONTRACT: TasksModuleContract = { |
| src/components/project-space/WorkView.tsx | 206 | MODULE-PRODUCT | const EMPTY_TIMELINE_CONTRACT: TimelineModuleContract = { |
| src/components/project-space/WorkView.tsx | 216 | MODULE-PRODUCT | const EMPTY_REMINDERS_CONTRACT: RemindersModuleContract = { |
| src/components/project-space/WorkView.tsx | 227 | MODULE-PRODUCT | const MobileModulesOverlay = ({ moduleGrid }: { moduleGrid: ReactNode }) => { |
| src/components/project-space/WorkView.tsx | 258 | MODULE-PRODUCT |     return <div>{moduleGrid}</div>; |
| src/components/project-space/WorkView.tsx | 261 | MODULE-PRODUCT |   const mobileModulesLayoutId = !prefersReducedMotion ? dialogLayoutIds.mobileModules : undefined; |
| src/components/project-space/WorkView.tsx | 266 | MODULE-PRODUCT |         layoutId={mobileModulesLayoutId} |
| src/components/project-space/WorkView.tsx | 274 | MODULE-PRODUCT |         Modules |
| src/components/project-space/WorkView.tsx | 282 | MODULE-PRODUCT |           layoutId={mobileModulesLayoutId} |
| src/components/project-space/WorkView.tsx | 283 | MODULE-PRODUCT |           title="Modules" |
| src/components/project-space/WorkView.tsx | 284 | MODULE-PRODUCT |           description="Manage and browse project modules" |
| src/components/project-space/WorkView.tsx | 290 | MODULE-PRODUCT |             <IconButton aria-label="Close modules" className="absolute right-0 top-0" onClick={() => setOverlayOpen(false)}> |
| src/components/project-space/WorkView.tsx | 293 | MODULE-PRODUCT |             {moduleGrid} |
| src/components/project-space/WorkView.tsx | 306 | MODULE-PRODUCT |   modulesEnabled = true, |
| src/components/project-space/WorkView.tsx | 320 | MODULE-PRODUCT |   const [pendingModuleSaves, setPendingModuleSaves] = useState(0); |
| src/components/project-space/WorkView.tsx | 321 | MODULE-PRODUCT |   const [moduleError, setModuleError] = useState<string \| null>(null); |
| src/components/project-space/WorkView.tsx | 333 | MODULE-PRODUCT |       <motion.section layoutId={layoutId} className="module-sheet p-4"> |
| src/components/project-space/WorkView.tsx | 339 | MODULE-PRODUCT |   const resolvedTableContract: TableModuleContract = { |
| src/components/project-space/WorkView.tsx | 343 | MODULE-PRODUCT |   const resolvedKanbanContract: KanbanModuleContract = { |
| src/components/project-space/WorkView.tsx | 347 | MODULE-PRODUCT |   const resolvedCalendarContract: CalendarModuleContract = { |
| src/components/project-space/WorkView.tsx | 351 | MODULE-PRODUCT |   const resolvedFilesContract: FilesModuleContract = { |
| src/components/project-space/WorkView.tsx | 355 | MODULE-PRODUCT |   const resolvedQuickThoughtsContract: QuickThoughtsModuleContract = { |
| src/components/project-space/WorkView.tsx | 359 | MODULE-PRODUCT |   const resolvedTasksContract: TasksModuleContract = { |
| src/components/project-space/WorkView.tsx | 363 | MODULE-PRODUCT |   const resolvedTimelineContract: TimelineModuleContract = { |
| src/components/project-space/WorkView.tsx | 367 | MODULE-PRODUCT |   const resolvedRemindersContract: RemindersModuleContract = { |
| src/components/project-space/WorkView.tsx | 372 | MODULE-PRODUCT |   const modules = parseModules(project.layout_config); |
| src/components/project-space/WorkView.tsx | 373 | MODULE-PRODUCT |   const isSavingModules = pendingModuleSaves > 0; |
| src/components/project-space/WorkView.tsx | 375 | MODULE-PRODUCT |   const saveModules = (nextModules: ContractModuleConfig[]) => { |
| src/components/project-space/WorkView.tsx | 376 | MODULE-PRODUCT |     setModuleError(null); |
| src/components/project-space/WorkView.tsx | 377 | MODULE-PRODUCT |     setPendingModuleSaves((count) => count + 1); |
| src/components/project-space/WorkView.tsx | 383 | MODULE-PRODUCT |             modules: serializeModules(nextModules), |
| src/components/project-space/WorkView.tsx | 388 | MODULE-PRODUCT |         setModuleError(error instanceof Error ? error.message : 'Module layout update failed.'); |
| src/components/project-space/WorkView.tsx | 391 | MODULE-PRODUCT |         setPendingModuleSaves((count) => Math.max(0, count - 1)); |
| src/components/project-space/WorkView.tsx | 396 | MODULE-PRODUCT |   const handleAddModule = (moduleType: string, sizeTier: ContractModuleConfig['size_tier']) => { |
| src/components/project-space/WorkView.tsx | 397 | MODULE-PRODUCT |     const normalizedModuleType = normalizeModuleType(moduleType); |
| src/components/project-space/WorkView.tsx | 398 | MODULE-PRODUCT |     const nextModules: ContractModuleConfig[] = [ |
| src/components/project-space/WorkView.tsx | 399 | MODULE-PRODUCT |       ...modules, |
| src/components/project-space/WorkView.tsx | 401 | MODULE-PRODUCT |         module_instance_id: `${moduleType}-${Date.now()}`, |
| src/components/project-space/WorkView.tsx | 402 | MODULE-PRODUCT |         module_type: normalizedModuleType, |
| src/components/project-space/WorkView.tsx | 403 | MODULE-PRODUCT |         size_tier: clampModuleSizeTier(normalizedModuleType, sizeTier), |
| src/components/project-space/WorkView.tsx | 404 | MODULE-PRODUCT |         lens: defaultModuleLens(normalizedModuleType), |
| src/components/project-space/WorkView.tsx | 405 | MODULE-PRODUCT |         binding: normalizedModuleType === 'kanban' ? { source_mode: 'owned' } : undefined, |
| src/components/project-space/WorkView.tsx | 408 | MODULE-PRODUCT |     void saveModules(nextModules); |
| src/components/project-space/WorkView.tsx | 411 | MODULE-PRODUCT |   const handleRemoveModule = (moduleInstanceId: string) => { |
| src/components/project-space/WorkView.tsx | 412 | MODULE-PRODUCT |     const nextModules = modules.filter((module) => module.module_instance_id !== moduleInstanceId); |
| src/components/project-space/WorkView.tsx | 413 | MODULE-PRODUCT |     void saveModules(nextModules); |
| src/components/project-space/WorkView.tsx | 416 | MODULE-PRODUCT |   const handleSetModuleLens = (moduleInstanceId: string, lens: ContractModuleConfig['lens']) => { |
| src/components/project-space/WorkView.tsx | 417 | MODULE-PRODUCT |     const nextModules = modules.map((module) => |
| src/components/project-space/WorkView.tsx | 418 | MODULE-PRODUCT |       module.module_instance_id === moduleInstanceId |
| src/components/project-space/WorkView.tsx | 420 | MODULE-PRODUCT |             ...module, |
| src/components/project-space/WorkView.tsx | 421 | MODULE-PRODUCT |             lens: normalizeModuleLens(module.module_type, lens), |
| src/components/project-space/WorkView.tsx | 423 | MODULE-PRODUCT |         : module, |
| src/components/project-space/WorkView.tsx | 425 | MODULE-PRODUCT |     void saveModules(nextModules); |
| src/components/project-space/WorkView.tsx | 428 | MODULE-PRODUCT |   const handleResizeModule = (moduleInstanceId: string, sizeTier: ContractModuleConfig['size_tier']) => { |
| src/components/project-space/WorkView.tsx | 429 | MODULE-PRODUCT |     const nextModules = modules.map((module) => |
| src/components/project-space/WorkView.tsx | 430 | MODULE-PRODUCT |       module.module_instance_id === moduleInstanceId |
| src/components/project-space/WorkView.tsx | 432 | MODULE-PRODUCT |             ...module, |
| src/components/project-space/WorkView.tsx | 433 | MODULE-PRODUCT |             size_tier: clampModuleSizeTier(module.module_type, sizeTier), |
| src/components/project-space/WorkView.tsx | 435 | MODULE-PRODUCT |         : module, |
| src/components/project-space/WorkView.tsx | 437 | MODULE-PRODUCT |     void saveModules(nextModules); |
| src/components/project-space/WorkView.tsx | 440 | MODULE-PRODUCT |   const handleSetModuleBinding = (moduleInstanceId: string, binding: ContractModuleConfig['binding']) => { |
| src/components/project-space/WorkView.tsx | 441 | MODULE-PRODUCT |     const nextModules = modules.map((module) => |
| src/components/project-space/WorkView.tsx | 442 | MODULE-PRODUCT |       module.module_instance_id === moduleInstanceId |
| src/components/project-space/WorkView.tsx | 444 | MODULE-PRODUCT |             ...module, |
| src/components/project-space/WorkView.tsx | 447 | MODULE-PRODUCT |         : module, |
| src/components/project-space/WorkView.tsx | 449 | MODULE-PRODUCT |     void saveModules(nextModules); |
| src/components/project-space/WorkView.tsx | 452 | MODULE-PRODUCT |   const renderModuleBody = (module: ContractModuleConfig) => { |
| src/components/project-space/WorkView.tsx | 453 | MODULE-PRODUCT |     if (module.module_type === 'table') { |
| src/components/project-space/WorkView.tsx | 455 | MODULE-PRODUCT |         <TableModule |
| src/components/project-space/WorkView.tsx | 456 | MODULE-PRODUCT |           module={module} |
| src/components/project-space/WorkView.tsx | 460 | MODULE-PRODUCT |           onSetModuleBinding={handleSetModuleBinding} |
| src/components/project-space/WorkView.tsx | 465 | MODULE-PRODUCT |     if (module.module_type === 'kanban') { |
| src/components/project-space/WorkView.tsx | 467 | MODULE-PRODUCT |         <KanbanModule |
| src/components/project-space/WorkView.tsx | 468 | MODULE-PRODUCT |           module={module} |
| src/components/project-space/WorkView.tsx | 472 | MODULE-PRODUCT |           onSetModuleBinding={handleSetModuleBinding} |
| src/components/project-space/WorkView.tsx | 477 | MODULE-PRODUCT |     if (module.module_type === 'calendar') { |
| src/components/project-space/WorkView.tsx | 478 | MODULE-PRODUCT |       return <CalendarModule module={module} contract={resolvedCalendarContract} onOpenRecord={onOpenRecord} />; |
| src/components/project-space/WorkView.tsx | 481 | MODULE-PRODUCT |     if (module.module_type === 'tasks') { |
| src/components/project-space/WorkView.tsx | 482 | MODULE-PRODUCT |       return <TasksModule module={module} contract={resolvedTasksContract} canEditProject={canEditProject} />; |
| src/components/project-space/WorkView.tsx | 485 | MODULE-PRODUCT |     if (module.module_type === 'files') { |
| src/components/project-space/WorkView.tsx | 486 | MODULE-PRODUCT |       return <FilesModule module={module} contract={resolvedFilesContract} canEditProject={canEditProject} />; |
| src/components/project-space/WorkView.tsx | 489 | MODULE-PRODUCT |     if (module.module_type === 'reminders') { |
| src/components/project-space/WorkView.tsx | 490 | MODULE-PRODUCT |       return <RemindersModule module={module} contract={resolvedRemindersContract} canEditProject={canEditProject} />; |
| src/components/project-space/WorkView.tsx | 493 | MODULE-PRODUCT |     if (module.module_type === 'quick_thoughts') { |
| src/components/project-space/WorkView.tsx | 495 | MODULE-PRODUCT |         <QuickThoughtsModule |
| src/components/project-space/WorkView.tsx | 496 | MODULE-PRODUCT |           module={module} |
| src/components/project-space/WorkView.tsx | 504 | MODULE-PRODUCT |     if (module.module_type === 'timeline') { |
| src/components/project-space/WorkView.tsx | 505 | MODULE-PRODUCT |       return <TimelineModule contract={resolvedTimelineContract} />; |
| src/components/project-space/WorkView.tsx | 508 | MODULE-PRODUCT |     return <p className="text-xs text-muted">{module.module_type}</p>; |
| src/components/project-space/WorkView.tsx | 511 | MODULE-PRODUCT |   const moduleGrid = ( |
| src/components/project-space/WorkView.tsx | 512 | MODULE-PRODUCT |     <ModuleGrid |
| src/components/project-space/WorkView.tsx | 513 | MODULE-PRODUCT |       modules={modules} |
| src/components/project-space/WorkView.tsx | 514 | MODULE-PRODUCT |       onAddModule={handleAddModule} |
| src/components/project-space/WorkView.tsx | 515 | MODULE-PRODUCT |       onRemoveModule={handleRemoveModule} |
| src/components/project-space/WorkView.tsx | 516 | MODULE-PRODUCT |       onSetModuleLens={handleSetModuleLens} |
| src/components/project-space/WorkView.tsx | 517 | MODULE-PRODUCT |       onResizeModule={handleResizeModule} |
| src/components/project-space/WorkView.tsx | 519 | MODULE-PRODUCT |       disableAdd={!canEditProject \|\| isSavingModules} |
| src/components/project-space/WorkView.tsx | 520 | MODULE-PRODUCT |       disableMutations={!canEditProject \|\| isSavingModules} |
| src/components/project-space/WorkView.tsx | 522 | MODULE-PRODUCT |       renderModuleBody={renderModuleBody} |
| src/components/project-space/WorkView.tsx | 530 | MODULE-PRODUCT |         {moduleError ? <p className="mt-2 text-xs text-danger">{moduleError}</p> : null} |
| src/components/project-space/WorkView.tsx | 533 | MODULE-PRODUCT |       {modulesEnabled ? ( |
| src/components/project-space/WorkView.tsx | 535 | MODULE-PRODUCT |           <MobileModulesOverlay key={project.project_id} moduleGrid={moduleGrid} /> |
| src/components/project-space/WorkView.tsx | 538 | MODULE-PRODUCT |         <section className="module-sheet p-4"> |
| src/components/project-space/WorkView.tsx | 539 | MODULE-PRODUCT |           <h3 className="heading-4 text-text">Structured Modules Off</h3> |
| src/components/project-space/WorkView.tsx | 540 | MODULE-PRODUCT |           <p className="mt-1 text-sm text-muted">Modules hidden.</p> |
| src/components/project-space/WorkView.tsx | 545 | MODULE-PRODUCT |         <section className="module-sheet p-4"> |
| src/components/Sidebar/CaptureInput/index.tsx | 29 | MODULE-PRODUCT |   moduleTypesByCaptureKind, |
| src/components/Sidebar/CaptureInput/index.tsx | 31 | MODULE-PRODUCT |   readProjectHasModuleType, |
| src/components/Sidebar/CaptureInput/index.tsx | 37 | MODULE-PRODUCT |   const module = await importCaptureDialog(); |
| src/components/Sidebar/CaptureInput/index.tsx | 38 | MODULE-PRODUCT |   return { default: module.CaptureDialog }; |
| src/components/Sidebar/CaptureInput/index.tsx | 85 | MODULE-SYSTEM |     const worker = new Worker(new URL('../../../workers/calendarNlpWorker.js', import.meta.url), { type: 'module' }); |
| src/components/Sidebar/CaptureInput/index.tsx | 162 | MODULE-PRODUCT |       const requiredModuleType = moduleTypesByCaptureKind[kind]; |
| src/components/Sidebar/CaptureInput/index.tsx | 163 | MODULE-PRODUCT |       const matchingProject = activeProject && readProjectHasModuleType(activeProject, requiredModuleType) |
| src/components/Sidebar/CaptureInput/index.tsx | 165 | MODULE-PRODUCT |         : currentProjectProjects.find((project) => readProjectHasModuleType(project, requiredModuleType)) \|\| null; |
| src/components/Sidebar/CaptureInput/shared.ts | 17 | MODULE-PRODUCT | export const moduleTypesByCaptureKind: Record<CaptureKind, string> = { |
| src/components/Sidebar/CaptureInput/shared.ts | 35 | MODULE-PRODUCT | export const readProjectHasModuleType = (project: HubProjectSummary, moduleType: string): boolean => { |
| src/components/Sidebar/CaptureInput/shared.ts | 36 | MODULE-PRODUCT |   const modules = Array.isArray(project.layout_config?.modules) ? project.layout_config.modules : []; |
| src/components/Sidebar/CaptureInput/shared.ts | 37 | MODULE-PRODUCT |   return modules.some((entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && entry.module_type === moduleType); |
| src/components/Sidebar/CaptureInput/shared.ts | 41 | MODULE-PRODUCT |   const modules = Array.isArray(project.layout_config?.modules) ? project.layout_config.modules : []; |
| src/components/Sidebar/CaptureInput/shared.ts | 42 | MODULE-SYSTEM |   const matchingModule = modules.find( |
| src/components/Sidebar/CaptureInput/shared.ts | 43 | MODULE-PRODUCT |     (entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && entry.module_type === 'quick_thoughts', |
| src/components/Sidebar/CaptureInput/shared.ts | 44 | MODULE-PRODUCT |   ) as { module_instance_id?: unknown } \| undefined; |
| src/components/Sidebar/CaptureInput/shared.ts | 45 | MODULE-PRODUCT |   if (!matchingModule \|\| typeof matchingModule.module_instance_id !== 'string' \|\| !matchingModule.module_instance_id.trim()) { |
| src/components/Sidebar/CaptureInput/shared.ts | 48 | MODULE-PRODUCT |   return `hub:quick-thoughts:${project.space_id}:${project.project_id}:${matchingModule.module_instance_id}`; |
| src/features/home/HomeOverviewSurface.tsx | 5 | MODULE-PRODUCT | import type { CalendarScope } from '../../components/project-space/CalendarModuleSkin/types'; |
| src/features/home/HomeOverviewSurface.tsx | 8 | MODULE-PRODUCT | import { CalendarModuleSkin } from '../../components/project-space/CalendarModuleSkin'; |
| src/features/home/HomeOverviewSurface.tsx | 9 | MODULE-PRODUCT | import { RemindersModuleSkin } from '../../components/project-space/RemindersModuleSkin'; |
| src/features/home/HomeOverviewSurface.tsx | 232 | MODULE-PRODUCT |               <CalendarModuleSkin |
| src/features/home/HomeOverviewSurface.tsx | 330 | MODULE-PRODUCT |             <RemindersModuleSkin |
| src/features/home/useHomeProjectWorkRuntime.ts | 12 | MODULE-PRODUCT | import { CalendarModuleSkin } from '../../components/project-space/CalendarModuleSkin'; |
| src/features/home/useHomeProjectWorkRuntime.ts | 14 | AMBIGUOUS | import { useWorkViewModuleRuntime } from '../../pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime'; |
| src/features/home/useHomeProjectWorkRuntime.ts | 26 | MODULE-PRODUCT |   calendarEvents: ComponentProps<typeof CalendarModuleSkin>['events']; |
| src/features/home/useHomeProjectWorkRuntime.ts | 190 | MODULE-PRODUCT |     creatingKanbanViewByModuleId, |
| src/features/home/useHomeProjectWorkRuntime.ts | 451 | MODULE-PRODUCT |   const modulesEnabled = useMemo( |
| src/features/home/useHomeProjectWorkRuntime.ts | 452 | MODULE-PRODUCT |     () => (activeProject ? readLayoutBool(activeProject.layout_config, 'modules_enabled', true) : true), |
| src/features/home/useHomeProjectWorkRuntime.ts | 460 | MODULE-PRODUCT |     (region: 'modules_enabled' \| 'workspace_enabled') => { |
| src/features/home/useHomeProjectWorkRuntime.ts | 465 | MODULE-PRODUCT |       const nextModulesEnabled = region === 'modules_enabled' ? !modulesEnabled : modulesEnabled; |
| src/features/home/useHomeProjectWorkRuntime.ts | 467 | MODULE-PRODUCT |       if (!nextModulesEnabled && !nextWorkspaceEnabled) { |
| src/features/home/useHomeProjectWorkRuntime.ts | 475 | MODULE-PRODUCT |           modules_enabled: nextModulesEnabled, |
| src/features/home/useHomeProjectWorkRuntime.ts | 483 | MODULE-PRODUCT |       modulesEnabled, |
| src/features/home/useHomeProjectWorkRuntime.ts | 517 | AMBIGUOUS |   } = useWorkViewModuleRuntime({ |
| src/features/home/useHomeProjectWorkRuntime.ts | 534 | MODULE-PRODUCT |     creatingKanbanViewByModuleId, |
| src/features/home/useHomeProjectWorkRuntime.ts | 576 | MODULE-PRODUCT |       modulesEnabled, |
| src/features/home/useHomeProjectWorkRuntime.ts | 590 | MODULE-PRODUCT |         modulesEnabled, |
| src/hooks/__tests__/useRemindersRuntime.test.ts | 8 | MODULE-PRODUCT | describe('useRemindersRuntime module surface', () => { |
| src/hooks/projectViewsRuntime/shared.ts | 5 | MODULE-PRODUCT | export const KANBAN_OWNED_VIEW_CONFIG_KEY = 'owned_by_module_instance_id'; |
| src/hooks/projectViewsRuntime/shared.ts | 133 | MODULE-PRODUCT | export const readOwnedKanbanModuleInstanceId = (config: Record<string, unknown> \| null \| undefined): string \| null => { |
| src/hooks/projectViewsRuntime/shared.ts | 142 | MODULE-PRODUCT |   view.type === 'kanban' && Boolean(readOwnedKanbanModuleInstanceId(view.config)); |
| src/hooks/useCalendarNLDraft.ts | 199 | MODULE-SYSTEM |     const worker = new Worker(new URL('../workers/calendarNlpWorker.js', import.meta.url), { type: 'module' }); |
| src/hooks/useProjectFilesRuntime.ts | 11 | MODULE-PRODUCT | import type { FilesModuleItem } from '../components/project-space/FilesModuleSkin'; |
| src/hooks/useProjectFilesRuntime.ts | 44 | MODULE-PRODUCT | const trackedFileToModuleItem = (file: HubTrackedFile): FilesModuleItem => { |
| src/hooks/useProjectFilesRuntime.ts | 90 | MODULE-PRODUCT |   const [pendingProjectFiles, setPendingProjectFiles] = useState<FilesModuleItem[]>([]); |
| src/hooks/useProjectFilesRuntime.ts | 91 | MODULE-PRODUCT |   const [trackedProjectFiles, setTrackedProjectFiles] = useState<FilesModuleItem[]>([]); |
| src/hooks/useProjectFilesRuntime.ts | 92 | MODULE-PRODUCT |   const [pendingProjectFilesByProjectId, setPendingProjectFilesByProjectId] = useState<Record<string, FilesModuleItem[]>>({}); |
| src/hooks/useProjectFilesRuntime.ts | 93 | MODULE-PRODUCT |   const [trackedProjectFilesByProjectId, setTrackedProjectFilesByProjectId] = useState<Record<string, FilesModuleItem[]>>({}); |
| src/hooks/useProjectFilesRuntime.ts | 139 | MODULE-PRODUCT |     setTrackedProjectFiles(files.map(trackedFileToModuleItem)); |
| src/hooks/useProjectFilesRuntime.ts | 150 | MODULE-PRODUCT |         [projectIdToLoad]: files.map(trackedFileToModuleItem), |
| src/hooks/useProjectFilesRuntime.ts | 185 | MODULE-PRODUCT |     (projectIdToUpdate: string, fileId: string, mapFn: (current: FilesModuleItem) => FilesModuleItem) => { |
| src/hooks/useProjectFilesRuntime.ts | 198 | MODULE-PRODUCT |   const updatePendingSpaceFile = useCallback((fileId: string, mapFn: (current: FilesModuleItem) => FilesModuleItem) => { |
| src/hooks/useProjectFilesRuntime.ts | 232 | MODULE-PRODUCT |         } satisfies FilesModuleItem, |
| src/hooks/useProjectFilesRuntime.ts | 345 | MODULE-PRODUCT |         } satisfies FilesModuleItem, |
| src/hooks/useProjectFilesRuntime.ts | 441 | MODULE-PRODUCT |   const onOpenProjectFile = useCallback((file: FilesModuleItem) => { |
| src/hooks/useProjectKanbanRuntime.ts | 14 | MODULE-PRODUCT |   readOwnedKanbanModuleInstanceId, |
| src/hooks/useProjectKanbanRuntime.ts | 46 | MODULE-PRODUCT |   const [creatingKanbanViewByModuleId, setCreatingKanbanViewByModuleId] = useState<Record<string, boolean>>({}); |
| src/hooks/useProjectKanbanRuntime.ts | 49 | MODULE-PRODUCT |   const setCreatingKanbanView = useCallback((moduleInstanceId: string, creating: boolean) => { |
| src/hooks/useProjectKanbanRuntime.ts | 50 | MODULE-PRODUCT |     setCreatingKanbanViewByModuleId((current) => { |
| src/hooks/useProjectKanbanRuntime.ts | 52 | MODULE-PRODUCT |         return { ...current, [moduleInstanceId]: true }; |
| src/hooks/useProjectKanbanRuntime.ts | 54 | MODULE-PRODUCT |       if (!current[moduleInstanceId]) { |
| src/hooks/useProjectKanbanRuntime.ts | 58 | MODULE-PRODUCT |       delete next[moduleInstanceId]; |
| src/hooks/useProjectKanbanRuntime.ts | 104 | MODULE-PRODUCT |     setCreatingKanbanViewByModuleId({}); |
| src/hooks/useProjectKanbanRuntime.ts | 354 | MODULE-PRODUCT |     async (moduleInstanceId: string, ownedViewId: string \| null \| undefined, mutationProjectId: string \| null): Promise<string \| null> => { |
| src/hooks/useProjectKanbanRuntime.ts | 355 | MODULE-PRODUCT |       const pending = ensureKanbanViewRef.current.get(moduleInstanceId); |
| src/hooks/useProjectKanbanRuntime.ts | 373 | MODULE-PRODUCT |         return candidateViews.find((view) => readOwnedKanbanModuleInstanceId(view.config) === moduleInstanceId) \|\| null; |
| src/hooks/useProjectKanbanRuntime.ts | 377 | MODULE-PRODUCT |         setCreatingKanbanView(moduleInstanceId, true); |
| src/hooks/useProjectKanbanRuntime.ts | 435 | MODULE-PRODUCT |               [KANBAN_OWNED_VIEW_CONFIG_KEY]: moduleInstanceId, |
| src/hooks/useProjectKanbanRuntime.ts | 448 | MODULE-PRODUCT |           ensureKanbanViewRef.current.delete(moduleInstanceId); |
| src/hooks/useProjectKanbanRuntime.ts | 449 | MODULE-PRODUCT |           setCreatingKanbanView(moduleInstanceId, false); |
| src/hooks/useProjectKanbanRuntime.ts | 453 | MODULE-PRODUCT |       ensureKanbanViewRef.current.set(moduleInstanceId, ensurePromise); |
| src/hooks/useProjectKanbanRuntime.ts | 476 | MODULE-PRODUCT |     creatingKanbanViewByModuleId, |
| src/hooks/useProjectViewsRuntime.ts | 70 | MODULE-PRODUCT |     creatingKanbanViewByModuleId, |
| src/hooks/useProjectViewsRuntime.ts | 183 | MODULE-PRODUCT |     creatingKanbanViewByModuleId, |
| src/lib/projectTemplates.ts | 24 | MODULE-PRODUCT |       modules_enabled: true, |
| src/lib/projectTemplates.ts | 27 | MODULE-PRODUCT |       modules: [ |
| src/lib/projectTemplates.ts | 29 | MODULE-PRODUCT |           module_type: 'table', |
| src/lib/projectTemplates.ts | 34 | MODULE-PRODUCT |           module_type: 'kanban', |
| src/lib/projectTemplates.ts | 42 | MODULE-PRODUCT |           module_type: 'calendar', |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 11 | MODULE-PRODUCT |   CalendarModuleContract, |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 12 | MODULE-PRODUCT |   FilesModuleContract, |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 13 | MODULE-PRODUCT |   KanbanModuleContract, |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 14 | MODULE-PRODUCT |   RemindersModuleContract, |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 15 | MODULE-PRODUCT |   TableModuleContract, |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 16 | MODULE-PRODUCT |   TasksModuleContract, |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 17 | MODULE-PRODUCT |   TimelineModuleContract, |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 18 | MODULE-PRODUCT |   WorkViewModuleContracts, |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 19 | MODULE-PRODUCT | } from '../../../components/project-space/moduleContracts'; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 23 | MODULE-PRODUCT |   payload: Parameters<NonNullable<TableModuleContract['onCreateRecord']>>[1], |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 30 | MODULE-PRODUCT |   fields: Parameters<NonNullable<TableModuleContract['onUpdateRecord']>>[2], |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 51 | MODULE-PRODUCT |   payload: Parameters<NonNullable<KanbanModuleContract['onCreateRecord']>>[1], |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 64 | MODULE-PRODUCT |   fields: Parameters<NonNullable<KanbanModuleContract['onUpdateRecord']>>[2], |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 69 | MODULE-PRODUCT | type EnsureKanbanView = (moduleInstanceId: string, ownedViewId: string \| null \| undefined, sourceProjectId: string \| null) => Promise<string \| null>; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 71 | AMBIGUOUS | interface UseWorkViewModuleRuntimeParams { |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 81 | MODULE-PRODUCT |   tableViews: TableModuleContract['views']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 82 | MODULE-PRODUCT |   tableViewRuntimeDataById: TableModuleContract['dataByViewId']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 88 | MODULE-PRODUCT |   kanbanViews: KanbanModuleContract['views']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 89 | MODULE-PRODUCT |   kanbanRuntimeDataByViewId: KanbanModuleContract['dataByViewId']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 90 | MODULE-PRODUCT |   creatingKanbanViewByModuleId: Record<string, boolean>; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 98 | MODULE-PRODUCT |   calendarEvents: CalendarModuleContract['events']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 100 | MODULE-PRODUCT |   calendarMode: CalendarModuleContract['scope']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 102 | MODULE-PRODUCT |   setCalendarMode: CalendarModuleContract['onScopeChange']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 104 | MODULE-PRODUCT |   projectFiles: FilesModuleContract['projectFiles']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 105 | MODULE-PRODUCT |   spaceFiles: FilesModuleContract['spaceFiles']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 106 | MODULE-PRODUCT |   onUploadProjectFiles: FilesModuleContract['onUploadProjectFiles']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 107 | MODULE-PRODUCT |   onUploadSpaceFiles: FilesModuleContract['onUploadSpaceFiles']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 108 | MODULE-PRODUCT |   onOpenProjectFile: FilesModuleContract['onOpenFile']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 110 | MODULE-PRODUCT |   projectTaskItems: TasksModuleContract['items']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 115 | MODULE-PRODUCT |   timelineClusters: TimelineModuleContract['clusters']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 116 | MODULE-PRODUCT |   timelineFilters: TimelineModuleContract['activeFilters']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 117 | MODULE-PRODUCT |   toggleTimelineFilter: TimelineModuleContract['onFilterToggle']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 121 | MODULE-PRODUCT |   reminders: RemindersModuleContract['items']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 122 | MODULE-PRODUCT |   remindersLoading: RemindersModuleContract['loading']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 123 | MODULE-PRODUCT |   remindersError: RemindersModuleContract['error']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 124 | MODULE-PRODUCT |   onDismissReminder: RemindersModuleContract['onDismiss']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 125 | MODULE-PRODUCT |   onCreateReminder: RemindersModuleContract['onCreate']; |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 128 | AMBIGUOUS | export const useWorkViewModuleRuntime = ({ |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 145 | MODULE-PRODUCT |   creatingKanbanViewByModuleId, |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 176 | MODULE-PRODUCT | }: UseWorkViewModuleRuntimeParams): WorkViewModuleContracts => { |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 189 | MODULE-PRODUCT |   return useMemo<WorkViewModuleContracts>( |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 212 | MODULE-PRODUCT |         creatingViewByModuleId: creatingKanbanViewByModuleId, |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 222 | MODULE-PRODUCT |         onEnsureView: async (moduleInstanceId, ownedViewId) => onEnsureKanbanView(moduleInstanceId, ownedViewId, activeProjectId), |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 229 | MODULE-PRODUCT |         // TODO(phase8): wire module insert-to-editor callbacks from workspace-doc runtime. |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 282 | MODULE-PRODUCT |         // TODO(phase8): wire module insert-to-editor callbacks from workspace-doc runtime. |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 288 | MODULE-PRODUCT |         // TODO(phase8): wire module insert-to-editor callbacks from workspace-doc runtime. |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 367 | MODULE-PRODUCT |         // TODO(phase8): wire module insert-to-editor callbacks from workspace-doc runtime. |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 395 | MODULE-PRODUCT |         // TODO(phase8): wire module insert-to-editor callbacks from workspace-doc runtime. |
| src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts | 409 | MODULE-PRODUCT |       creatingKanbanViewByModuleId, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 150 | MODULE-PRODUCT |     modulesEnabled, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 154 | MODULE-PRODUCT |     modulesEnabled?: boolean; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 159 | MODULE-PRODUCT |       <p>{modulesEnabled ? 'Modules enabled' : 'Modules disabled'}</p> |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 241 | MODULE-PRODUCT | vi.mock('../../components/project-space/ModuleFeedback', () => ({ |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 242 | MODULE-PRODUCT |   ModuleLoadingState: ({ label }: { label: string }) => <div>{label}</div>, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 245 | MODULE-PRODUCT | vi.mock('../../components/project-space/KanbanModuleSkin', () => ({ |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 246 | MODULE-PRODUCT |   KanbanModuleSkin: ({ onOpenRecord }: { onOpenRecord?: (recordId: string) => void }) => ( |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 248 | MODULE-PRODUCT |       <p>Focused kanban module</p> |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 254 | MODULE-PRODUCT | vi.mock('../../components/project-space/TableModuleSkin', () => ({ |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 255 | MODULE-PRODUCT |   TableModuleSkin: ({ onOpenRecord }: { onOpenRecord?: (recordId: string) => void }) => ( |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 257 | MODULE-PRODUCT |       <p>Focused table module</p> |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 288 | MODULE-PRODUCT |   creatingKanbanViewByModuleId: {}, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 484 | AMBIGUOUS | vi.mock('./hooks/useWorkViewModuleRuntime', () => ({ |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 485 | AMBIGUOUS |   useWorkViewModuleRuntime: () => ({ |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 778 | MODULE-PRODUCT |     await userEvent.click(screen.getByRole('button', { name: 'Hide modules' })); |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 781 | MODULE-PRODUCT |         modules_enabled: false, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 789 | MODULE-PRODUCT |         modules_enabled: true, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 828 | MODULE-PRODUCT |       expect(screen.getByText('This project is set to modules-only mode. The workspace doc is hidden here.')).toBeInTheDocument(); |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 1121 | MODULE-PRODUCT |   it('collects task collection ids from table and non-standalone kanban modules only', () => { |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 1124 | MODULE-PRODUCT |         modules: [ |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 1125 | MODULE-PRODUCT |           { module_type: 'table', binding: { view_id: fixture.tableView.view_id } }, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 1126 | MODULE-PRODUCT |           { module_type: 'kanban', binding: { view_id: fixture.kanbanView.view_id } }, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 1127 | MODULE-PRODUCT |           { module_type: 'kanban', binding: { view_id: 'view-standalone-kanban' } }, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 1138 | MODULE-PRODUCT |             owned_by_module_instance_id: 'module-1', |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 1223 | MODULE-PRODUCT |           modulesEnabled |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 1262 | MODULE-PRODUCT |           modulesEnabled |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 1278 | MODULE-PRODUCT |     expect(screen.getByRole('button', { name: 'Hide modules' })).toBeDisabled(); |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace.test.tsx | 1296 | MODULE-PRODUCT |           modulesEnabled |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 21 | AMBIGUOUS | import { useWorkViewModuleRuntime } from '../../hooks/useWorkViewModuleRuntime'; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 109 | MODULE-PRODUCT |     creatingKanbanViewByModuleId, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 468 | MODULE-PRODUCT |   const modulesEnabled = useMemo( |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 469 | MODULE-PRODUCT |     () => (activeProject ? readLayoutBool(activeProject.layout_config, 'modules_enabled', true) : true), |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 477 | MODULE-PRODUCT |     (region: 'modules_enabled' \| 'workspace_enabled') => { |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 482 | MODULE-PRODUCT |       const nextModulesEnabled = region === 'modules_enabled' ? !modulesEnabled : modulesEnabled; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 484 | MODULE-PRODUCT |       if (!nextModulesEnabled && !nextWorkspaceEnabled) { |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 492 | MODULE-PRODUCT |           modules_enabled: nextModulesEnabled, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 500 | MODULE-PRODUCT |       modulesEnabled, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 536 | AMBIGUOUS |   } = useWorkViewModuleRuntime({ |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 553 | MODULE-PRODUCT |     creatingKanbanViewByModuleId, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 668 | MODULE-PRODUCT |       modulesEnabled, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/hooks/useProjectSpacePageRuntime.ts | 682 | MODULE-PRODUCT |         modulesEnabled, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/projectModel.ts | 18 | MODULE-PRODUCT |   const rawModules = Array.isArray(layoutConfig.modules) ? layoutConfig.modules : []; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/projectModel.ts | 31 | AMBIGUOUS |   for (const candidate of rawModules) { |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/projectModel.ts | 36 | MODULE-PRODUCT |     const moduleConfig = candidate as { module_type?: unknown; binding?: { view_id?: unknown } \| null }; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/projectModel.ts | 37 | MODULE-PRODUCT |     const moduleType = typeof moduleConfig.module_type === 'string' ? moduleConfig.module_type : ''; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/projectModel.ts | 38 | MODULE-PRODUCT |     if (moduleType !== 'table' && moduleType !== 'kanban') { |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/projectModel.ts | 43 | MODULE-PRODUCT |       moduleConfig.binding && typeof moduleConfig.binding === 'object' && !Array.isArray(moduleConfig.binding) |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/projectModel.ts | 44 | MODULE-PRODUCT |         && typeof moduleConfig.binding.view_id === 'string' |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/projectModel.ts | 45 | MODULE-PRODUCT |         ? moduleConfig.binding.view_id |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/projectModel.ts | 47 | MODULE-PRODUCT |     const resolvedView = (requestedViewId ? viewById.get(requestedViewId) : null) ?? defaultViewByType.get(moduleType) ?? null; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/projectModel.ts | 50 | MODULE-PRODUCT |       \|\| resolvedView.type !== moduleType |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/projectModel.ts | 51 | MODULE-PRODUCT |       \|\| (moduleType === 'kanban' && isStandaloneKanbanView(resolvedView)) |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 3 | MODULE-PRODUCT | import { ModuleLoadingState } from '../../../components/project-space/ModuleFeedback'; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 6 | MODULE-PRODUCT | const KanbanModuleSkin = lazy(async () => { |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 7 | MODULE-PRODUCT |   const module = await import('../../../components/project-space/KanbanModuleSkin'); |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 8 | MODULE-PRODUCT |   return { default: module.KanbanModuleSkin }; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 11 | MODULE-PRODUCT | const TableModuleSkin = lazy(async () => { |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 12 | MODULE-PRODUCT |   const module = await import('../../../components/project-space/TableModuleSkin'); |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 13 | MODULE-PRODUCT |   return { default: module.TableModuleSkin }; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 16 | MODULE-PRODUCT | type KanbanModuleProps = ComponentProps<typeof KanbanModuleSkin>; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 17 | MODULE-PRODUCT | type TableModuleProps = ComponentProps<typeof TableModuleSkin>; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 20 | MODULE-PRODUCT |   groups: KanbanModuleProps['groups']; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 21 | MODULE-PRODUCT |   groupOptions: KanbanModuleProps['groupOptions']; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 25 | MODULE-PRODUCT |   groupableFields?: KanbanModuleProps['groupableFields']; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 26 | MODULE-PRODUCT |   metadataFieldIds?: KanbanModuleProps['metadataFieldIds']; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 35 | MODULE-PRODUCT |     schema: TableModuleProps['schema']; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 36 | MODULE-PRODUCT |     records: TableModuleProps['records']; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 45 | MODULE-PRODUCT |     payload: Parameters<NonNullable<KanbanModuleProps['onCreateRecord']>>[0], |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 54 | MODULE-PRODUCT |     fields: Parameters<NonNullable<KanbanModuleProps['onUpdateRecord']>>[1], |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 103 | MODULE-PRODUCT |           <Suspense fallback={<ModuleLoadingState label="Loading kanban module" rows={5} />}> |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 104 | MODULE-PRODUCT |             <KanbanModuleSkin |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 153 | MODULE-PRODUCT |           <Suspense fallback={<ModuleLoadingState label="Loading table module" rows={6} />}> |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceFocusedViewSection.tsx | 154 | MODULE-PRODUCT |             <TableModuleSkin |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceOverviewSurface.tsx | 3 | MODULE-PRODUCT | import type { CalendarEventSummary } from '../../../components/project-space/CalendarModuleSkin/types'; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceProjectSettingsDialog.tsx | 15 | MODULE-PRODUCT |   modulesEnabled: boolean; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceProjectSettingsDialog.tsx | 23 | MODULE-PRODUCT |   onToggleActiveProjectRegion: (region: 'modules_enabled' \| 'workspace_enabled') => void; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceProjectSettingsDialog.tsx | 34 | MODULE-PRODUCT |   modulesEnabled, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceProjectSettingsDialog.tsx | 157 | MODULE-PRODUCT |               onClick={() => onToggleActiveProjectRegion('modules_enabled')} |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceProjectSettingsDialog.tsx | 160 | MODULE-PRODUCT |               {modulesEnabled ? 'Hide modules' : 'Show modules'} |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceWorkProjectChrome.tsx | 31 | MODULE-PRODUCT |   modulesEnabled: boolean; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceWorkProjectChrome.tsx | 47 | MODULE-PRODUCT |   onToggleActiveProjectRegion: (region: 'modules_enabled' \| 'workspace_enabled') => void; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceWorkProjectChrome.tsx | 61 | MODULE-PRODUCT |   modulesEnabled, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceWorkProjectChrome.tsx | 303 | MODULE-PRODUCT |               modulesEnabled={modulesEnabled} |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceWorkSurface.tsx | 20 | MODULE-PRODUCT |   modulesEnabled: boolean; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceWorkSurface.tsx | 25 | MODULE-PRODUCT |   workViewProps: Omit<WorkViewProps, 'layoutId' \| 'project' \| 'canEditProject' \| 'modulesEnabled' \| 'showWorkspaceDocPlaceholder'>; |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceWorkSurface.tsx | 34 | MODULE-PRODUCT |   modulesEnabled, |
| src/pages/ProjectSpacePage/ProjectSpaceWorkspace/ProjectSpaceWorkSurface.tsx | 56 | MODULE-PRODUCT |           modulesEnabled={modulesEnabled} |
| src/pages/ProjectSpacePage/testUtils/projectSpaceWorkspaceTestFixture.tsx | 26 | MODULE-PRODUCT |       modules_enabled: true, |
| src/pages/ProjectSpacePage/testUtils/projectSpaceWorkspaceTestFixture.tsx | 45 | MODULE-PRODUCT |       modules_enabled: true, |
| src/server/routes.ts | 1 | MODULE-SYSTEM | // @ts-expect-error hub-api.mjs is the runtime server module for these route contracts. |
| src/styles/motion.ts | 50 | MODULE-PRODUCT |   mobileModules: 'dialog-mobile-modules', |
| src/styles/motion.ts | 57 | MODULE-PRODUCT |   addModule: 'dialog-add-module', |
| src/types/hub-api-module.d.ts | 1 | MODULE-SYSTEM | declare module '../../apps/hub-api/hub-api.mjs' { |
| tokens.css | 106 | MODULE-PRODUCT |   --module-card-min-h-s: 12rem; |
| tokens.css | 107 | MODULE-PRODUCT |   --module-card-max-h-s: 20rem; |
| tokens.css | 108 | MODULE-PRODUCT |   --module-card-min-h-m: 18rem; |
| tokens.css | 109 | MODULE-PRODUCT |   --module-card-max-h-m: 28rem; |
| tokens.css | 110 | MODULE-PRODUCT |   --module-card-min-h-l: 24rem; |
| tokens.css | 111 | MODULE-PRODUCT |   --module-card-max-h-l: 40rem; |
| tokens.css | 137 | MODULE-PRODUCT |   --module-picker-panel-width: 75vw; |
| tokens.css | 138 | MODULE-PRODUCT |   --module-picker-panel-height: 75vh; |
| tokens.css | 139 | MODULE-PRODUCT |   --module-picker-sidebar-width: 18rem; |
| tokens.css | 140 | MODULE-PRODUCT |   --module-picker-preview-width-s: 18rem; |
| tokens.css | 141 | MODULE-PRODUCT |   --module-picker-preview-width-m: 34rem; |
| tokens.css | 142 | MODULE-PRODUCT |   --module-picker-preview-width-l: 100%; |
| tokens.css | 143 | MODULE-PRODUCT |   --module-picker-preview-min-height: 34rem; |
| tokens.css | 144 | MODULE-PRODUCT |   --module-picker-overlay-z: 400; |
| tokens.css | 145 | MODULE-PRODUCT |   --module-picker-panel-z: 401; |
| tokens.css | 187 | MODULE-PRODUCT |   /* 700 — module headings, card titles, column headers, record names */ |
| tokens.css | 363 | AMBIGUOUS | @utility module-sheet { |
| tokens.css | 371 | AMBIGUOUS | @utility module-sheet-raised { |
| tokens.css | 389 | AMBIGUOUS | @utility module-toolbar { |
| tokens.css | 395 | AMBIGUOUS | @utility module-rule { |
| tokens.css | 400 | AMBIGUOUS | @utility module-dropzone { |
| tokens.css | 557 | MODULE-PRODUCT | @utility module-card-s { |
| tokens.css | 558 | MODULE-PRODUCT |   min-height: var(--module-card-min-h-s); |
| tokens.css | 559 | MODULE-PRODUCT |   max-height: var(--module-card-max-h-s); |
| tokens.css | 562 | MODULE-PRODUCT | @utility module-card-m { |
| tokens.css | 563 | MODULE-PRODUCT |   min-height: var(--module-card-min-h-m); |
| tokens.css | 564 | MODULE-PRODUCT |   max-height: var(--module-card-max-h-m); |
| tokens.css | 567 | MODULE-PRODUCT | @utility module-card-l { |
| tokens.css | 568 | MODULE-PRODUCT |   min-height: var(--module-card-min-h-l); |
| tokens.css | 569 | MODULE-PRODUCT |   max-height: var(--module-card-max-h-l); |
| tokens.css | 572 | MODULE-PRODUCT | @utility module-accent-tasks { |
| tokens.css | 577 | MODULE-PRODUCT | @utility module-accent-calendar { |
| tokens.css | 582 | MODULE-PRODUCT | @utility module-accent-notes { |
| tokens.css | 587 | MODULE-PRODUCT | @utility module-accent-stream { |
| tokens.css | 592 | MODULE-PRODUCT | @utility module-accent-files { |
| tokens.css | 597 | MODULE-PRODUCT | @utility module-accent-reminders { |
| tokens.css | 635 | MODULE-PRODUCT | @utility module-picker-viewport-backdrop { |
| tokens.css | 638 | MODULE-PRODUCT |   z-index: var(--module-picker-overlay-z); |
| tokens.css | 643 | MODULE-PRODUCT | @utility module-picker-viewport-panel { |
| tokens.css | 647 | MODULE-PRODUCT |   z-index: var(--module-picker-panel-z); |
| tokens.css | 651 | MODULE-PRODUCT | @utility module-picker-panel-size { |
| tokens.css | 652 | MODULE-PRODUCT |   width: min(calc(100vw - (var(--dialog-panel-inline-gap) * 2)), var(--module-picker-panel-width)); |
| tokens.css | 653 | MODULE-PRODUCT |   height: min(calc(100vh - (var(--dialog-panel-inline-gap) * 2)), var(--module-picker-panel-height)); |
| tokens.css | 658 | MODULE-PRODUCT | @utility module-picker-sidebar-size { |
| tokens.css | 659 | MODULE-PRODUCT |   width: min(var(--module-picker-sidebar-width), 100%); |
| tokens.css | 662 | MODULE-PRODUCT | @utility module-picker-preview-s { |
| tokens.css | 663 | MODULE-PRODUCT |   width: min(100%, var(--module-picker-preview-width-s)); |
| tokens.css | 666 | MODULE-PRODUCT | @utility module-picker-preview-m { |
| tokens.css | 667 | MODULE-PRODUCT |   width: min(100%, var(--module-picker-preview-width-m)); |
| tokens.css | 670 | MODULE-PRODUCT | @utility module-picker-preview-l { |
| tokens.css | 671 | MODULE-PRODUCT |   width: var(--module-picker-preview-width-l); |
| tokens.css | 674 | MODULE-PRODUCT | @utility module-picker-readonly { |
| tokens.css | 683 | MODULE-PRODUCT | @utility module-picker-preview-card { |
| tsconfig.app.json | 4 | MODULE-SYSTEM |     "module": "ESNext", |
| tsconfig.app.json | 7 | MODULE-SYSTEM |     "moduleResolution": "bundler", |
| tsconfig.app.json | 9 | MODULE-SYSTEM |     "resolveJsonModule": true, |
| tsconfig.app.json | 10 | MODULE-SYSTEM |     "isolatedModules": true, |
| vite.config.ts | 8 | MODULE-SYSTEM |   if (!id.includes('/node_modules/')) { |
| vite.config.ts | 13 | MODULE-SYSTEM |     id.includes('/node_modules/react/') \|\| |
| vite.config.ts | 14 | MODULE-SYSTEM |     id.includes('/node_modules/react-dom/') \|\| |
| vite.config.ts | 15 | MODULE-SYSTEM |     id.includes('/node_modules/scheduler/') |
| vite.config.ts | 20 | MODULE-SYSTEM |   if (id.includes('/node_modules/react-router/') \|\| id.includes('/node_modules/react-router-dom/')) { |
| vite.config.ts | 24 | MODULE-SYSTEM |   if (id.includes('/node_modules/keycloak-js/')) { |
| vite.config.ts | 29 | MODULE-SYSTEM |     id.includes('/node_modules/@radix-ui/') \|\| |
| vite.config.ts | 30 | MODULE-SYSTEM |     id.includes('/node_modules/@floating-ui/') \|\| |
| vite.config.ts | 31 | MODULE-SYSTEM |     id.includes('/node_modules/cmdk/') \|\| |
| vite.config.ts | 32 | MODULE-SYSTEM |     id.includes('/node_modules/sonner/') \|\| |
| vite.config.ts | 33 | MODULE-SYSTEM |     id.includes('/node_modules/react-remove-scroll') \|\| |
| vite.config.ts | 34 | MODULE-SYSTEM |     id.includes('/node_modules/react-remove-scroll-bar') \|\| |
| vite.config.ts | 35 | MODULE-SYSTEM |     id.includes('/node_modules/react-style-singleton') \|\| |
| vite.config.ts | 36 | MODULE-SYSTEM |     id.includes('/node_modules/use-callback-ref') \|\| |
| vite.config.ts | 37 | MODULE-SYSTEM |     id.includes('/node_modules/use-sidecar') \|\| |
| vite.config.ts | 38 | MODULE-SYSTEM |     id.includes('/node_modules/aria-hidden') |
