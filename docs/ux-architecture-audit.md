# UX Architecture Audit

This audit uses the post-rename vocabulary:

- `space`: the top-level container and membership boundary.
- `project`: a work area inside a space.
- `work`: the tab where projects and their modules are opened.

The live frontend still uses a legacy route shape for the space home and space detail screens. Treat those route strings as compatibility surface, not product language.

## Route Ownership

| Route surface | Runtime owner |
|---|---|
| space home route | `AppShell -> ProtectedRoute -> ProjectsPage` |
| space overview route | `AppShell -> ProtectedRoute -> ProjectRouteGuard -> ProjectSpacePage(activeTab="overview")` |
| space work route | `AppShell -> ProtectedRoute -> ProjectRouteGuard -> ProjectSpacePage(activeTab="work")` |
| focused work project route | `AppShell -> ProtectedRoute -> ProjectRouteGuard -> ProjectSpacePage(activeTab="work")` |
| space tools route | `AppShell -> ProtectedRoute -> ProjectRouteGuard -> ProjectSpacePage(activeTab="tools")` |

URL construction is centralized in [src/lib/hubRoutes.ts](../src/lib/hubRoutes.ts). Page files should continue to read route state and compose feature surfaces, while durable behavior stays in feature-local hooks and sections.

## Navigation Model

The user-visible hierarchy should read as:

1. Home or space list.
2. Space overview.
3. Space work.
4. Project inside the space work tab.
5. Tools and automation for the active space.

Breadcrumbs, tab labels, search result labels, quick-add actions, and command labels should use that same hierarchy. When a route or compatibility helper still carries an older name, surrounding UI copy should still say `space` or `project` according to the layer it represents.

## Composition Notes

- `ProjectsPage` owns the space home composition and should stay thin around durable home/runtime hooks.
- `ProjectSpacePage` owns the space page composition and route-derived active tab state.
- `ProjectSpaceWorkspace` owns the overview/work/tools layout below the page host.
- Project switching belongs to the work surface and should remain importable from that feature boundary.
- Record inspector, module runtime, members, files, reminders, tasks, and views should remain owned by hooks below the page host.

## Empty States

- Empty space home: show the spaces list surface and the primary create-space action.
- Empty space overview: keep the space header and show actionable setup areas.
- Empty work surface: show an empty project list and a create-project action.
- Empty focused project: keep the project chrome stable and show module-specific empty states inside each module.

## Current Risk Areas

- Space and project naming still passes through compatibility function names in a few route and service modules.
- The space page remains a dense host. New behavior should be extracted below it before adding more route-owned state.
- The legacy frontend route shape can confuse audits. Product copy should not mirror that route name unless it is shown as a literal path.
