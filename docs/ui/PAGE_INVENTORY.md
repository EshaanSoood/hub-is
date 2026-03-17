# UI Page and Route Inventory

Scope: `/Users/eshaansood/eshaan-os-ui`.
Source of truth for route declarations: `src/App.tsx`.

## A) Route-Mounted Pages/Routes

| Route | Component | File | Purpose (1 sentence) | Key dependencies | Linked from (where) | Can delete? (Y/N) | Notes |
|---|---|---|---|---|---|---|---|
| `*` (when `!signedIn`) | `LoginPage` | `src/pages/LoginPage.tsx` | Shows Keycloak-based sign-in UI and starts auth flow. | `useAuthz` (`signIn`, `keycloakConfigured`, `authError`) | Entry by any URL while signed out (App-level auth gate in `src/App.tsx`) | N | This wildcard route is only mounted in the signed-out branch. |
| `/` | `HubPage` | `src/pages/HubPage.tsx` | Renders the main dashboard/control-plane surface with multiple panels. | `ProtectedRoute(capability='hub.view')`, `AppShell`, hub feature panels | `appTabs` primary nav (`src/lib/policy.ts` -> `src/components/layout/AppShell.tsx`), `NotFoundPage`/`AccessDeniedView` return links, dashboard cards targeting `/` (`src/lib/dashboardCards.ts`) | N | Hub dashboard route. |
| `/projects` | `ProjectsPage` | `src/pages/ProjectsPage.tsx` | Lists accessible projects and links into project space. | `ProtectedRoute(capability='projects.view')`, `AppShell`, `useProjects` | `appTabs` primary nav, dashboard cards targeting `/projects`, redirects from `ProjectRouteRedirect` and `ProjectSpacePage` fallback | N | Canonical project list entry route. |
| `/projects/:projectId/overview` | `ProjectSpacePage` (`activeTab="overview"`) | `src/pages/ProjectSpacePage.tsx` | Project-space overview surface for a specific project. | `ProtectedRoute(capability='projects.view')`, `ProjectRouteGuard`, `useProjects`, `useAuthz`, project-space components | `ProjectsPage` project links, `ProjectRouteRedirect` (default), project-space top-tab navigation (`navigate`) | N | Route-mounted project space variant. |
| `/projects/:projectId/work/:paneId` | `ProjectSpacePage` (`activeTab="work"`) | `src/pages/ProjectSpacePage.tsx` | Project-space work surface for an explicit pane ID. | `ProtectedRoute(capability='projects.view')`, `ProjectRouteGuard`, `useProjects`, localStorage pane state, project-space components | Project-space internal tab/pane navigation (`navigate`) | N | Deep-linkable pane route. |
| `/projects/:projectId/work` | `ProjectSpacePage` (`activeTab="work"`) | `src/pages/ProjectSpacePage.tsx` | Project-space work entry route that may normalize to a concrete pane route. | `ProtectedRoute(capability='projects.view')`, `ProjectRouteGuard`, `useProjects`, `useNavigate` normalization logic | `NotesPanel` links (`.../work?noteId=...`), `ProjectRouteRedirect` when `noteId` exists | N | If pane ID missing, page navigates to `/work/:paneId`. |
| `/projects/:projectId/tools` | `ProjectSpacePage` (`activeTab="tools"`) | `src/pages/ProjectSpacePage.tsx` | Project-space tools surface for a specific project. | `ProtectedRoute(capability='projects.view')`, `ProjectRouteGuard`, `useProjects`, project-space components | Project-space top-tab navigation (`navigate`) | N | Route-mounted project space variant. |
| `/projects/:projectId` | `ProjectRouteRedirect` | `src/components/auth/ProjectRouteRedirect.tsx` | Redirect shim from bare project route to overview or work (if `noteId` query exists). | `useParams`, `useSearchParams`, `Navigate` | `PersonalizedDashboardPanel` “Open” links (`/projects/${project.id}`) | N | Non-page route helper component; preserves query string in redirect. |
| `/lessons` | `LessonsPage` | `src/pages/LessonsPage.tsx` | Shows lessons workflow panel. | `ProtectedRoute(capability='lessons.view')`, `AppShell`, `LessonsStudioPanel` | `appTabs` primary nav | N | Capability-gated by `lessons.view`. |
| `/media` | `MediaPage` | `src/pages/MediaPage.tsx` | Shows media flow workflow panel. | `ProtectedRoute(capability='media.view')`, `AppShell`, `MediaFlowsPanel` | `appTabs` primary nav | N | Capability-gated by `media.view`. |
| `/dev` | `DevPage` | `src/pages/DevPage.tsx` | Shows dev workflow panel. | `ProtectedRoute(capability='dev.view')`, `AppShell`, `DevWorkPanel` | `appTabs` primary nav | N | Capability-gated by `dev.view`. |
| `/blocked-inputs` | `BlockingInputsPage` | `src/pages/BlockingInputsPage.tsx` | Shows required credential/endpoint inputs for live mode. | `ProtectedRoute(capability='blockedInputs.view')`, `AppShell`, `BlockingInputsPanel` | `appTabs` primary nav | N | Capability-gated by `blockedInputs.view`. |
| `*` (signed-in fallback) | `NotFoundPage` | `src/pages/NotFoundPage.tsx` | Renders fallback UI for unknown signed-in routes. | `PageHeader`, `Link` to `/` | Direct/deep links to unknown paths while signed in | N | Signed-in wildcard fallback route. |

### Route Behavior Notes (redirects/navigation)

- `src/App.tsx` has no nested routes; all routes are top-level declarations.
- Auth gating in `src/App.tsx`:
  - if `!authReady`: loading state (no routes rendered)
  - if `!signedIn`: only wildcard `* -> LoginPage`
  - else: signed-in route set inside `AppShell`
- Redirect route: `/projects/:projectId` uses `ProjectRouteRedirect` to send users to:
  - `/projects/:projectId/work` when `noteId` query exists
  - `/projects/:projectId/overview` otherwise
- `ProjectSpacePage` also performs internal navigations (`navigate`) between overview/work/tools and pane-specific work routes.

## B) Non-Route Pages / Orphan Surfaces (`src/pages`)

All files under `src/pages`:

| File | Imported anywhere? | Route-mounted? | Status | Notes |
|---|---|---|---|---|
| `src/pages/BlockingInputsPage.tsx` | Yes (`src/App.tsx`) | Yes (`/blocked-inputs`) | ROUTED | Capability-gated route. |
| `src/pages/DevPage.tsx` | Yes (`src/App.tsx`) | Yes (`/dev`) | ROUTED | Capability-gated route. |
| `src/pages/HubPage.tsx` | Yes (`src/App.tsx`) | Yes (`/`) | ROUTED | Hub dashboard. |
| `src/pages/LessonsPage.tsx` | Yes (`src/App.tsx`) | Yes (`/lessons`) | ROUTED | Capability-gated route. |
| `src/pages/LoginPage.tsx` | Yes (`src/App.tsx`) | Yes (`*` when signed out) | ROUTED | Signed-out wildcard route. |
| `src/pages/MediaPage.tsx` | Yes (`src/App.tsx`) | Yes (`/media`) | ROUTED | Capability-gated route. |
| `src/pages/NotFoundPage.tsx` | Yes (`src/App.tsx`) | Yes (`*` signed-in fallback) | ROUTED | Signed-in wildcard route. |
| `src/pages/ProjectSpacePage.tsx` | Yes (`src/App.tsx`) | Yes (4 project-space routes) | ROUTED | Multi-route project-space surface. |
| `src/pages/ProjectsPage.tsx` | Yes (`src/App.tsx`) | Yes (`/projects`) | ROUTED | Project list route. |

Result:
- `IMPORTED BUT NOT ROUTED`: none
- `ORPHAN`: none

## C) Navigation + Entrypoints (Reachability)

| Entry UI | File | Routes it links to | Notes |
|---|---|---|---|
| Primary top nav tabs (`NavLink`) | `src/components/layout/AppShell.tsx` + `src/lib/policy.ts` | `/`, `/projects`, `/lessons`, `/media`, `/dev`, `/blocked-inputs` | Tabs are capability-filtered via `useAuthz().canGlobal`. |
| Personalized dashboard: Accessible Projects links | `src/features/PersonalizedDashboardPanel.tsx` | `/projects/:projectId` | Hits redirect shim route (`ProjectRouteRedirect`). |
| Personalized dashboard: Card destination links | `src/features/PersonalizedDashboardPanel.tsx` + `src/lib/dashboardCards.ts` | `/`, `/projects` | Card targets are data-driven (`dashboardCardRegistry`). |
| Projects table project links | `src/pages/ProjectsPage.tsx` | `/projects/:projectId/overview` | Primary explicit UI link into project space. |
| Hub notes table note links | `src/features/NotesPanel.tsx` | `/projects/:projectId/work?noteId=...` | Redirect/normalization flow resolves to project work route. |
| Project-space top tabs + pane actions | `src/pages/ProjectSpacePage.tsx` (uses `TopNavTabs`) | `/projects/:projectId/overview`, `/projects/:projectId/tools`, `/projects/:projectId/work/:paneId`, `/projects/:projectId/work/:paneId?pinned=1` | Uses `navigate(...)` calls, not `<Link>`. |
| Not found fallback CTA | `src/pages/NotFoundPage.tsx` | `/` | “Return to hub” link. |
| Access denied CTA | `src/components/auth/AccessDeniedView.tsx` | `/` | Used by route guards when capability checks fail. |
| Auth gate entry behavior | `src/App.tsx` | `* -> LoginPage` when signed out | Signed-out users are forced into login route set. |
| Bare project redirect entry | `src/components/auth/ProjectRouteRedirect.tsx` | `/projects/:projectId/overview` or `/projects/:projectId/work` | Query-aware redirect logic (preserves query string). |
