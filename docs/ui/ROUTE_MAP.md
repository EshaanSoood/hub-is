# Route Map (Current Code)

Routes below are extracted from `src/App.tsx` as currently implemented.

| Route path | Screen name | Layout shell | Key components | Auth requirement |
|---|---|---|---|---|
| `*` (when `signedIn=false`) | Login | No `AppShell` | `LoginPage` | Unauthenticated only; shown after `authReady=true` and before sign-in |
| `/` | Hub | `AppShell` | `HubPage`, `PersonalizedDashboardPanel`, `ProjectCorePanel`, `TasksPanel`, `NotificationsPanel`, `NotesPanel`, `FilesPanel`, `SmartWakePanel`, `ActivityLogPanel` | `ProtectedRoute(capability='hub.view')` |
| `/projects` | Projects list | `AppShell` | `ProjectsPage`, `DataTable` | `ProtectedRoute(capability='projects.view')` |
| `/projects/:projectId/overview` | Project Space Overview | `AppShell` | `ProjectSpacePage(activeTab='overview')`, `TopNavTabs`, `OverviewView` | `ProtectedRoute('projects.view')` + `ProjectRouteGuard(project.view)` |
| `/projects/:projectId/work` | Project Space Work Redirect Entry | `AppShell` | `ProjectSpacePage(activeTab='work')` -> pane resolution in page | `ProtectedRoute('projects.view')` + `ProjectRouteGuard(project.view)` |
| `/projects/:projectId/work/:paneId` | Project Space Work | `AppShell` | `ProjectSpacePage(activeTab='work')`, `TopNavTabs`, `WorkView` | `ProtectedRoute('projects.view')` + `ProjectRouteGuard(project.view)` |
| `/projects/:projectId/tools` | Project Space Tools | `AppShell` | `ProjectSpacePage(activeTab='tools')`, `TopNavTabs`, `ToolsView` | `ProtectedRoute('projects.view')` + `ProjectRouteGuard(project.view)` |
| `/projects/:projectId` | Project canonical redirect | `AppShell` | `ProjectRouteRedirect` (`noteId` -> Work, else Overview) | Same as parent route context |
| `/lessons` | Lessons Studio | `AppShell` | `LessonsPage`, `LessonsStudioPanel` | `ProtectedRoute(capability='lessons.view')` |
| `/media` | Media Flows | `AppShell` | `MediaPage`, `MediaFlowsPanel` | `ProtectedRoute(capability='media.view')` |
| `/dev` | Dev Work | `AppShell` | `DevPage`, `DevWorkPanel` | `ProtectedRoute(capability='dev.view')` |
| `/blocked-inputs` | Blocking Inputs | `AppShell` | `BlockingInputsPage`, `BlockingInputsPanel` | `ProtectedRoute(capability='blockedInputs.view')` |
| `*` (authenticated fallback) | Not Found | `AppShell` | `NotFoundPage` | Signed-in fallback; reached when no route matches |

## Notes
- Canonical project surface is `ProjectSpacePage` (Overview / Work / Tools).
- `NotesPanel` now links directly to `/projects/:projectId/work?noteId=...`.
- Base project route `/projects/:projectId` preserves query params and routes note deep links into Work.
