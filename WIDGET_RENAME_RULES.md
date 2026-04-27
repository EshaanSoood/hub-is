# Widget Rename Rules

Canonical rule: product `module` becomes `widget`. ES/Node module-system references do not change.

## Data And API

| Current | Rename to | Notes |
|---|---|---|
| `module_picker_seed_data` | `widget_picker_seed_data` | Table name. |
| `module_type` | `widget_type` | DB column, layout JSON field, API seed row field, local variables. |
| `idx_module_picker_seed_module_size` | `idx_widget_picker_seed_widget_size` | Index name. |
| `modulePickerSeedDataStmt` | `widgetPickerSeedDataStmt` | Route dependency/statement names. |
| `createModulePickerSeedQueries` | `createWidgetPickerSeedQueries` | DB query factory. |
| `installModulePickerSeedData` | `installWidgetPickerSeedData` | DB migration/install helper. |
| `seedModulePickerSeedData` | `seedWidgetPickerSeedData` | Seed helper. |
| `allowedSizesByModule` | `allowedSizesByWidget` | Seed constant. |
| `/api/hub/module-picker/seed-data` | `/api/hub/widget-picker/seed-data` | API route path and snapshots. |
| `createModulePickerSeedDataRoutes` | `createWidgetPickerSeedDataRoutes` | Route factory. |
| `layout_config.modules` | `layout_config.widgets` | Project layout JSON array. |
| `modules_enabled` | `widgets_enabled` | Project layout JSON flag. |
| `module_instance_id` | `widget_instance_id` | Project layout JSON field. |
| `owned_by_module_instance_id` | `owned_by_widget_instance_id` | Kanban owned-view config key. |
| `module-picker-preview-project` | `widget-picker-preview-project` | Preview project ID literal. |
| `module-picker-preview-${type}` | `widget-picker-preview-${type}` | Preview widget instance ID literal. |
| `hub:module-picker-preview:*` | `hub:widget-picker-preview:*` | Preview storage key prefix. |

## TypeScript Identifiers

| Current | Rename to |
|---|---|
| `ModuleSize` | `WidgetSize` |
| `ModuleType` | `WidgetType` |
| `ProjectModule` | `ProjectWidget` |
| `ContractModuleConfig` | `ContractWidgetConfig` |
| `ModuleInsertItemType` | `WidgetInsertItemType` |
| `ModuleInsertState` | `WidgetInsertState` |
| `TableModuleContract` | `TableWidgetContract` |
| `KanbanModuleContract` | `KanbanWidgetContract` |
| `CalendarModuleContract` | `CalendarWidgetContract` |
| `FilesModuleContract` | `FilesWidgetContract` |
| `TasksModuleContract` | `TasksWidgetContract` |
| `RemindersModuleContract` | `RemindersWidgetContract` |
| `TimelineModuleContract` | `TimelineWidgetContract` |
| `QuickThoughtsModuleContract` | `QuickThoughtsWidgetContract` |
| `WorkViewModuleContracts` | `WorkViewWidgetContracts` |
| `ModulePickerSeedPayload` | `WidgetPickerSeedPayload` |
| `ModulePickerSeedData` | `WidgetPickerSeedData` |
| `ModulePickerSelection` | `WidgetPickerSelection` |
| `MODULE_PICKER_SIZE_LABELS` | `WIDGET_PICKER_SIZE_LABELS` |
| `MODULE_CATALOG` | `WIDGET_CATALOG` |

## Functions, Hooks, And Variables

| Current | Rename to |
|---|---|
| `useWorkViewModuleRuntime` | `useWorkViewWidgetRuntime` |
| `useModuleInsertState` | `useWidgetInsertState` |
| `useModulePickerFocusTrap` | `useWidgetPickerFocusTrap` |
| `useModulePickerSeedData` | `useWidgetPickerSeedData` |
| `moduleCatalogEntry` | `widgetCatalogEntry` |
| `moduleLabel` | `widgetLabel` |
| `normalizeModuleType` | `normalizeWidgetType` |
| `defaultModuleLens` | `defaultWidgetLens` |
| `normalizeModuleLens` | `normalizeWidgetLens` |
| `clampModuleSizeTier` | `clampWidgetSizeTier` |
| `parseModules` | `parseWidgets` |
| `serializeModules` | `serializeWidgets` |
| `saveModules` | `saveWidgets` |
| `handleAddModule` | `handleAddWidget` |
| `handleRemoveModule` | `handleRemoveWidget` |
| `handleSetModuleLens` | `handleSetWidgetLens` |
| `handleResizeModule` | `handleResizeWidget` |
| `handleSetModuleBinding` | `handleSetWidgetBinding` |
| `renderModuleBody` | `renderWidgetBody` |
| `moduleGrid` | `widgetGrid` |
| `modulesEnabled` | `widgetsEnabled` |
| `pendingModuleSaves` | `pendingWidgetSaves` |
| `moduleError` | `widgetError` |
| `moduleInstanceId` | `widgetInstanceId` |
| `moduleType` | `widgetType` |
| `creatingKanbanViewByModuleId` | `creatingKanbanViewByWidgetId` |
| `creatingViewByModuleId` | `creatingViewByWidgetId` |
| `readProjectHasModuleType` | `readProjectHasWidgetType` |
| `moduleTypesByCaptureKind` | `widgetTypesByCaptureKind` |
| `trackedFileToModuleItem` | `trackedFileToWidgetItem` |

## Components And Files

| Current | Rename to |
|---|---|
| `src/components/project-space/modules/` | `src/components/project-space/widgets/` |
| `src/components/project-space/module-picker/` | `src/components/project-space/widget-picker/` |
| `src/components/project-space/moduleContracts/` | `src/components/project-space/widgetContracts/` |
| `src/components/project-space/moduleCatalog.ts` | `src/components/project-space/widgetCatalog.ts` |
| `src/components/project-space/ModuleGrid.tsx` | `src/components/project-space/WidgetGrid.tsx` |
| `src/components/project-space/ModuleShell.tsx` | `src/components/project-space/WidgetShell.tsx` |
| `src/components/project-space/ModuleFeedback.tsx` | `src/components/project-space/WidgetFeedback.tsx` |
| `src/components/project-space/ModuleLensControl.tsx` | `src/components/project-space/WidgetLensControl.tsx` |
| `src/components/project-space/ModuleSettingsPopover.tsx` | `src/components/project-space/WidgetSettingsPopover.tsx` |
| `src/components/project-space/AddModuleDialog.tsx` | `src/components/project-space/AddWidgetDialog.tsx` |
| `src/components/project-space/*ModuleSkin/` | `src/components/project-space/*WidgetSkin/` |
| `src/components/project-space/*ModuleSkin.tsx` | `src/components/project-space/*WidgetSkin.tsx` |
| `src/components/project-space/modules/*Module.tsx` | `src/components/project-space/widgets/*Widget.tsx` |
| `src/pages/ProjectSpacePage/hooks/useWorkViewModuleRuntime.ts` | `src/pages/ProjectSpacePage/hooks/useWorkViewWidgetRuntime.ts` |
| `apps/hub-api/routes/modulePickerSeedData.mjs` | `apps/hub-api/routes/widgetPickerSeedData.mjs` |
| `apps/hub-api/db/modulePickerSeedQueries.mjs` | `apps/hub-api/db/widgetPickerSeedQueries.mjs` |
| `apps/hub-api/db/modulePickerSeedMigration.mjs` | `apps/hub-api/db/widgetPickerSeedMigration.mjs` |
| `apps/hub-api/db/modulePickerSeedInitialData.mjs` | `apps/hub-api/db/widgetPickerSeedInitialData.mjs` |

Component names follow the same rule: `CalendarModule`, `CalendarModuleSkin`, `ModulePickerOverlay`, `ModuleEmptyState`, etc. become `CalendarWidget`, `CalendarWidgetSkin`, `WidgetPickerOverlay`, `WidgetEmptyState`, and so on.

## CSS, Attributes, And Test Selectors

| Current | Rename to |
|---|---|
| `--module-card-*` | `--widget-card-*` |
| `--module-picker-*` | `--widget-picker-*` |
| `module-sheet` | `widget-sheet` |
| `module-sheet-raised` | `widget-sheet-raised` |
| `module-toolbar` | `widget-toolbar` |
| `module-rule` | `widget-rule` |
| `module-dropzone` | `widget-dropzone` |
| `module-card-s/m/l` | `widget-card-s/m/l` |
| `module-accent-*` | `widget-accent-*` |
| `module-picker-*` | `widget-picker-*` |
| `data-testid="module-card"` | `data-testid="widget-card"` |
| `data-module-card-body` | `data-widget-card-body` |
| `data-module-insert-ignore` | `data-widget-insert-ignore` |
| `aria-label="* module"` | `aria-label="* widget"` |
| `aria-label="* module actions"` | `aria-label="* widget actions"` |

## Tests, Scripts, And Env

| Current | Rename to |
|---|---|
| `WORKFLOW_MODULES` | `WORKFLOW_WIDGETS` |
| `e2e/module-verification/` | `e2e/widget-verification/` |
| `dialog_open_add_module` | `dialog_open_add_widget` |
| `dialog_close_add_module` | `dialog_close_add_widget` |
| `module_actions_open` | `widget_actions_open` |
| `module_actions_close` | `widget_actions_close` |
| `openAddModuleDialog` | `openAddWidgetDialog` |
| `ensureModuleAdded` | `ensureWidgetAdded` |
| `get*Module*` test helpers | `get*Widget*` |
| `test:e2e:widget-trace` | unchanged | New oracle script already uses widget naming for the trace itself while validating current module fields. |

## User-Facing Copy

| Current wording | Rename to |
|---|---|
| `Module` | `Widget` |
| `Modules` | `Widgets` |
| `Add Module` | `Add Widget` |
| `Add module` | `Add widget` |
| `Select {name} module` | `Select {name} widget` |
| `{name} module actions` | `{name} widget actions` |
| `Project organization modules` | `Project organization widgets` |
| `Structured Modules Off` | `Structured Widgets Off` |
| `Modules hidden.` | `Widgets hidden.` |
| `modules-only mode` | `widgets-only mode` |

## Do Not Rename

Do not rename ES/Node module-system references: `type: "module"`, `moduleResolution`, `resolveJsonModule`, `isolatedModules`, `node_modules`, dynamic import local variables named only for module loading, `declare module`, and generic docs about route/service modules unless the line also names the product concept.
