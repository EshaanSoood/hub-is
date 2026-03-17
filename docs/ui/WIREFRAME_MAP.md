# Wireframe Map - Project Space v1

This map links implemented routes to wireframe components and edge/empty states.

## Route Map

| Route | Screen Purpose | Components Used |
|---|---|---|
| `/projects` | Minimal project list entry screen | `ProjectsPage`, `DataTable`, project link to `/projects/:projectId/overview` |
| `/projects/:projectId` | Route normalization only | React Router redirect to `/projects/:projectId/overview` |
| `/projects/:projectId/overview` | Overview shell with project header and sub-view switcher | `ProjectSpacePage(activeTab=overview)`, `TopNavTabs`, `ProjectHeader`, `SubViewSwitcher`, `TimelineShell` |
| `/projects/:projectId/overview?view=timeline` | Default overview view | `TimelineItemRow` list |
| `/projects/:projectId/overview?view=calendar` | Calendar overview shell | `CalendarToolbar`, `CalendarFilterBar`, `CalendarShell`, `CalendarGrid`, `DayCell`, `EventChip` placeholders |
| `/projects/:projectId/overview?view=tasks` | Tasks overview shell | `TaskListToolbar`, `TaskShell`, `TaskRow`, `StatusPill` placeholders |
| `/projects/:projectId/work/:paneId` | Work pane route with route-level pane selection | `ProjectSpacePage(activeTab=work)`, `TopNavTabs`, `WorkView`, `PaneSwitcher`, `PaneHeaderControls`, `OrganizationAreaShell`, `ModuleGrid`, `WorkspaceSurfacePlaceholder` |
| `/projects/:projectId/work/:paneId?pinned=1` | Pinned shortcut open path | Same as work route plus hidden-by-default `PaneSwitcher` with explicit reveal control |
| `/projects/:projectId/tools` | Tools route with fixed two-section model | `ProjectSpacePage(activeTab=tools)`, `TopNavTabs`, `ToolsSectionShell`, `LiveToolRow`, `AutomationBuilderShell` |

## Contract Coverage by Route

| Contract Rule | Where Enforced |
|---|---|
| Top-level tabs are Overview / Work / Tools only | `TopNavTabs` main tablist |
| Overview contains exactly Timeline / Calendar / Tasks | `OverviewView` fixed `overviewViews` array |
| Work route shape is `/projects/:projectId/work/:paneId` | Router config in `App.tsx` + work view path handling |
| Work pane has Organization Area + Creative Workspace with optionality | `WorkView` uses `modulesEnabled` and `workspaceEnabled` booleans |
| Organization Area is 12-col, max 6 modules, S/M/L sizes | `ModuleGrid`, `MAX_MODULES_PER_PANE`, `getModuleColumnSpan` |
| Focus mode collapses modules into icon toolbar and opens dialog, Esc closes | `FocusModeToolbar` + `ModuleDialog` via `AccessibleDialog` |
| Module lens switching (`project` vs `pane_scratch`) is represented in UI | `ModuleLensControl` inside `ModuleCard` |
| Pane modes can be configured to modules-only or workspace-only | `PaneRegionToggleGroup` in `PaneHeaderControls` |
| Pinning is per-user and acts as live shortcut tab | localStorage key includes `userId` + project; pinned shortcuts navigate to same work route |
| Opening via pinned tab hides pane switcher by default | `?pinned=1` query handling in `WorkView` |
| Tools has Live Tools + Automation Builder sections only | `ToolsView` |
| Lexical not implemented; workspace placeholder boundary shown | `WorkspaceSurfacePlaceholder` content |

## Edge Cases and Empty States

| Route Context | Edge Case | Current Wireframe Behavior |
|---|---|---|
| Any project route | `projectId` not found | Redirect to `/projects` |
| Any project route | Project list still loading | Loading panel shown |
| Any project route | Projects service error | Error panel shown |
| Work | Invalid `paneId` in URL | Redirect to first pane if available |
| Work | No panes available | Empty state with `Create first pane` action |
| Work | Opened from pinned shortcut | Pane switcher hidden; `Show pane switcher` button appears |
| Work | Module list empty | Organization Area empty state message with add prompt |
| Work | Module count reaches 6 | Add module button disabled |
| Work | Pane is workspace-only | Organization Area disabled state panel shown |
| Work | Pane is modules-only | Workspace disabled state panel shown |
| Work | Focus mode on with no modules | Toolbar remains effectively empty and no module dialog actions |
| Overview | Unknown `view` query value | Falls back to `timeline` |
| Top nav | No pinned panes | `No pinned panes yet.` message |

## File Map

| File | Responsibility |
|---|---|
| `src/App.tsx` | Defines project-space contract routes and redirect |
| `src/pages/ProjectSpacePage.tsx` | Stateful route controller and tab-level rendering |
| `src/components/project-space/TopNavTabs.tsx` | Top-level tabs + pinned shortcuts |
| `src/components/project-space/OverviewView.tsx` | Overview header and sub-view shells |
| `src/components/project-space/WorkView.tsx` | Pane controls, module/focus/workspace wireframes |
| `src/components/project-space/ToolsView.tsx` | Live Tools and Automation Builder wireframes |
| `src/components/project-space/mockProjectSpace.ts` | Seed data, constraints, and storage parsing |
| `src/components/project-space/types.ts` | Type contracts for panes/modules/audience modes |
| `tokens.css` | Semantic token aliases used by wireframe classes |
