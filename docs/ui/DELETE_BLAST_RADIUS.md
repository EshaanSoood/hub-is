# UI Delete Blast Radius Audit

Scope: `/Users/eshaansood/eshaan-os-ui`.
Audit-only report from current code wiring.

## 1) SAFE TO DELETE (low blast radius)

No current low-blast candidates were found in routed page surfaces.

- Every file under `src/pages` is route-mounted in `src/App.tsx`.
- No `src/pages` files are currently orphaned.

Verification performed:
- route declarations checked in `src/App.tsx`
- imports checked for each `src/pages/*.tsx`
- link/navigation sources checked with `Link`, `NavLink`, and `navigate(...)` usage

## 2) DELETE BREAKS ROUTING (medium blast radius)

### `HubPage`
- File(s): `src/pages/HubPage.tsx`
- Route(s) affected: `/`
- Nav/deep links that fail: top nav Hub tab, return-to-hub links from `NotFoundPage` and `AccessDeniedView`, dashboard cards targeting `/`
- Redirect logic to update: remove/replace `/` route element in `src/App.tsx`
- Other imports: imported by `src/App.tsx` only

### `ProjectsPage`
- File(s): `src/pages/ProjectsPage.tsx`
- Route(s) affected: `/projects`
- Nav/deep links that fail: top nav Projects tab, dashboard cards targeting `/projects`, fallbacks redirecting to `/projects`
- Redirect logic to update: remove/replace `/projects` route in `src/App.tsx`; update redirects in `ProjectRouteRedirect` and `ProjectSpacePage` that point to `/projects`
- Other imports: imported by `src/App.tsx` only

### `ProjectSpacePage`
- File(s): `src/pages/ProjectSpacePage.tsx`
- Route(s) affected: `/projects/:projectId/overview`, `/projects/:projectId/work/:paneId`, `/projects/:projectId/work`, `/projects/:projectId/tools`
- Nav/deep links that fail: project links from `ProjectsPage`, note links from `NotesPanel`, internal project-space tab/pane navigations, redirects from `/projects/:projectId`
- Redirect logic to update: remove/replace all four project-space route declarations in `src/App.tsx`; remove/update route transitions in `ProjectRouteRedirect`
- Other imports: imported by `src/App.tsx` only

### `ProjectRouteRedirect` (route helper)
- File(s): `src/components/auth/ProjectRouteRedirect.tsx`
- Route(s) affected: `/projects/:projectId`
- Nav/deep links that fail: personalized dashboard project links (`/projects/${project.id}`) lose redirection behavior
- Redirect logic to update: remove/replace `/projects/:projectId` route in `src/App.tsx`; update any links still targeting bare project route
- Other imports: imported by `src/App.tsx` only

### `LessonsPage`
- File(s): `src/pages/LessonsPage.tsx`
- Route(s) affected: `/lessons`
- Nav/deep links that fail: top nav Lessons Studio tab
- Redirect logic to update: remove/replace `/lessons` route in `src/App.tsx`; remove/update matching nav tab in `src/lib/policy.ts`
- Other imports: imported by `src/App.tsx` only

### `MediaPage`
- File(s): `src/pages/MediaPage.tsx`
- Route(s) affected: `/media`
- Nav/deep links that fail: top nav Media Flows tab
- Redirect logic to update: remove/replace `/media` route in `src/App.tsx`; remove/update matching nav tab in `src/lib/policy.ts`
- Other imports: imported by `src/App.tsx` only

### `DevPage`
- File(s): `src/pages/DevPage.tsx`
- Route(s) affected: `/dev`
- Nav/deep links that fail: top nav Dev Work tab
- Redirect logic to update: remove/replace `/dev` route in `src/App.tsx`; remove/update matching nav tab in `src/lib/policy.ts`
- Other imports: imported by `src/App.tsx` only

### `BlockingInputsPage`
- File(s): `src/pages/BlockingInputsPage.tsx`
- Route(s) affected: `/blocked-inputs`
- Nav/deep links that fail: top nav Blocking Inputs tab
- Redirect logic to update: remove/replace `/blocked-inputs` route in `src/App.tsx`; remove/update matching nav tab in `src/lib/policy.ts`
- Other imports: imported by `src/App.tsx` only

### `LoginPage`
- File(s): `src/pages/LoginPage.tsx`
- Route(s) affected: `*` (signed-out route set)
- Nav/deep links that fail: all signed-out entry URLs lose rendered route target
- Redirect logic to update: replace signed-out wildcard route in `src/App.tsx`
- Other imports: imported by `src/App.tsx` only

### `NotFoundPage`
- File(s): `src/pages/NotFoundPage.tsx`
- Route(s) affected: `*` (signed-in fallback)
- Nav/deep links that fail: unknown signed-in routes no longer render fallback page
- Redirect logic to update: replace signed-in wildcard fallback route in `src/App.tsx`
- Other imports: imported by `src/App.tsx` only

## 3) DELETE BREAKS SHARED INFRA (high blast radius)

### `src/App.tsx` (route registry + auth branching)
- Who imports it: `src/main.tsx`
- What breaks if removed: app route tree disappears; signed-in/signed-out branching, route guards, and all page mounts are lost
- Recommended alternative (if nuking later): keep a minimal `App.tsx` with only retained routes and auth branch behavior

### `src/main.tsx` (entrypoint/provider composition)
- Who imports it: Vite app entry (`index.html` script entry)
- What breaks if removed: React app does not bootstrap; router/providers/toast root are not mounted
- Recommended alternative (if nuking later): keep minimal entry with `BrowserRouter` and only required providers for retained surfaces

### `src/components/layout/AppShell.tsx`
- Who imports it: `src/App.tsx`
- What breaks if removed: signed-in layout frame and primary nav fail; route content wrapper removed
- Recommended alternative (if nuking later): replace with slimmer shell that still wraps kept routes

### `src/lib/policy.ts`
- Who imports it: `src/components/layout/AppShell.tsx`, `src/context/AuthzContext.tsx`
- What breaks if removed: `appTabs` nav definition and auth capability helpers (`hasGlobalCapability`, `getMembershipForProject`) break
- Recommended alternative (if nuking later): retain file (or replacement module) with only required tab definitions and capability helpers

### `src/context/AuthzContext.tsx`
- Who imports it: `src/main.tsx`, `src/App.tsx`, `src/pages/LoginPage.tsx`, `src/pages/ProjectSpacePage.tsx`, `src/components/layout/AppShell.tsx`, route guards, and multiple features
- What breaks if removed: sign-in state, capability checks, access token/session data, and guard logic fail across routed surfaces
- Recommended alternative (if nuking later): keep minimal auth provider exposing the subset of auth state/functions still needed

### `src/context/ProjectsContext.tsx`
- Who imports it: `src/main.tsx`, `src/pages/ProjectsPage.tsx`, `src/pages/ProjectSpacePage.tsx`, `src/components/auth/ProfilePanel.tsx`, and hub panels
- What breaks if removed: project listing/data access hooks fail (`useProjects`), causing runtime errors in pages/features
- Recommended alternative (if nuking later): keep minimal projects provider or remove all remaining `useProjects` consumers first

### `src/components/auth/ProtectedRoute.tsx`
- Who imports it: `src/App.tsx`
- What breaks if removed: capability-gated route wrappers fail to compile; access control layer for global routes is removed
- Recommended alternative (if nuking later): replace wrappers in `App.tsx` with explicit retained-route strategy (guarded or intentionally unguarded)

### `src/components/auth/ProjectRouteGuard.tsx`
- Who imports it: `src/App.tsx`
- What breaks if removed: project-level permission checks on project space routes fail to compile/remove protection
- Recommended alternative (if nuking later): remove only alongside project-space route removal or replace with reduced guard logic

### `src/components/auth/ProjectRouteRedirect.tsx`
- Who imports it: `src/App.tsx`
- What breaks if removed: `/projects/:projectId` links lose redirect behavior to overview/work
- Recommended alternative (if nuking later): either remove bare-project links or replace with direct links to kept project-space path

### `src/context/ActivityContext.tsx`
- Who imports it: `src/main.tsx`; consumed by multiple hub/media/lessons/dev features via `useActivity`
- What breaks if removed: activity logging hooks throw runtime errors in dependent panels
- Recommended alternative (if nuking later): keep provider while any `useActivity` consumers remain, or remove those consumers first

### `src/context/SmartWakeContext.tsx`
- Who imports it: `src/main.tsx`; consumed by task/files smart-wake flows via `useSmartWakeContext`
- What breaks if removed: smart-wake hooks throw runtime errors; wake/sleep workflow state disappears
- Recommended alternative (if nuking later): keep provider while smart-wake consumers remain, or remove consumers first

## KEEP

- Login route(s):
  - `*` (signed-out route set) -> `src/pages/LoginPage.tsx`
- Hub dashboard route(s):
  - `/` -> `src/pages/HubPage.tsx`
- Project Space route(s):
  - `/projects/:projectId/overview` -> `src/pages/ProjectSpacePage.tsx`
  - `/projects/:projectId/work/:paneId` -> `src/pages/ProjectSpacePage.tsx`
  - `/projects/:projectId/work` -> `src/pages/ProjectSpacePage.tsx`
  - `/projects/:projectId/tools` -> `src/pages/ProjectSpacePage.tsx`
  - supporting redirect ingress: `/projects/:projectId` -> `src/components/auth/ProjectRouteRedirect.tsx`

## Final Summary

- `# of total routes`: 13
- `# of routed pages`: 9
- `# of orphan pages`: 0
- `# of safe-delete candidates`: 0
- `# of medium blast candidates`: 10
- `# of high blast shared-infra candidates`: 11
