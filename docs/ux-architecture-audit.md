# UX Architecture Audit

This report is a read-only audit of the current Hub OS codebase on `main`. It describes what is implemented in code as of this audit. Where mount behavior or runtime behavior cannot be proven from static inspection alone, that is called out explicitly.

## 1. Navigation and routing architecture

- Routing uses `react-router-dom` with `BrowserRouter` mounted at the app entry point in [src/main.tsx](../src/main.tsx) (lines 18-30).
  > `createRoot(...).render(<BrowserRouter> ... <App /> ... </BrowserRouter>)`
- The top-level router content is mounted inside [src/App.tsx](../src/App.tsx) (lines 110-167). `AppShell` wraps the routed content, and `<Routes>` lives inside that shell.
  > `<AppShell><Suspense ...><Routes> ... </Routes></Suspense></AppShell>`
- The route table in [src/App.tsx](../src/App.tsx) is:

| Route | Rendered tree |
| --- | --- |
| `/` | `Navigate -> /projects` |
| `/projects` | `AppShell -> ProtectedRoute -> ProjectsPage` |
| `/projects/:projectId/overview` | `AppShell -> ProtectedRoute -> ProjectRouteGuard -> ProjectSpacePage(activeTab="overview")` |
| `/projects/:projectId/work/:paneId` | `AppShell -> ProtectedRoute -> ProjectRouteGuard -> ProjectSpacePage(activeTab="work")` |
| `/projects/:projectId/work` | `AppShell -> ProtectedRoute -> ProjectRouteGuard -> ProjectSpacePage(activeTab="work")` |
| `/projects/:projectId/tools` | `AppShell -> ProtectedRoute -> ProjectRouteGuard -> ProjectSpacePage(activeTab="tools")` |
| `/projects/:projectId` | `ProjectRouteRedirect -> Navigate -> /projects/:projectId/overview` |
| `*` | `NotFoundPage` |

- Project access is enforced by [src/components/auth/ProjectRouteGuard.tsx](../src/components/auth/ProjectRouteGuard.tsx) (lines 7-87). While access is unresolved it renders `Loading project...`; when access fails it renders `AccessDeniedView`.
- Bare project routes are normalized by [src/components/auth/ProjectRouteRedirect.tsx](../src/components/auth/ProjectRouteRedirect.tsx) (lines 3-10).
- URL hierarchy is defined centrally in [src/lib/hubRoutes.ts](../src/lib/hubRoutes.ts) (lines 57-70): overview is `/projects/:projectId/overview`, work is `/projects/:projectId/work`, pane routes are `/projects/:projectId/work/:paneId`, and tools is `/projects/:projectId/tools`.

### Route-change mount / unmount findings

- `myHub (/projects) -> project overview (/projects/:projectId/overview)`:
  - `ProjectsPage` stops rendering.
  - `ProtectedRoute` remains in the same position in the route tree.
  - `ProjectRouteGuard` and `ProjectSpacePage` begin rendering.
  - Because the page type changes from `ProjectsPage` to `ProjectSpacePage`, this is a real routed-page swap. `AppShell` stays mounted.
- `project overview -> project work`:
  - The route wrappers stay `ProtectedRoute -> ProjectRouteGuard -> ProjectSpacePage`.
  - `ProjectSpacePage` receives a different `activeTab` prop.
  - Inside [src/pages/ProjectSpacePage.tsx](../src/pages/ProjectSpacePage.tsx), the `OverviewView` branch at lines 1113-1140 stops rendering and the work branch at lines 1143-1752 starts rendering.
  - I do not see a key that would force `ProjectSpacePage` itself to remount for this tab change.
- `project work (/work) -> pane route (/work/:paneId)`:
  - The same routed component tree remains active: `ProtectedRoute -> ProjectRouteGuard -> ProjectSpacePage(activeTab="work")`.
  - `ProjectSpacePage` changes which pane is active from route params.
  - Some child remounts are explicit:
    - [src/components/project-space/WorkView.tsx](../src/components/project-space/WorkView.tsx) line 609 keys `MobileModulesOverlay` by `pane.pane_id`.
    - [src/pages/ProjectSpacePage.tsx](../src/pages/ProjectSpacePage.tsx) lines 1547-1549 key `CollaborativeLexicalEditor` by `activePaneDocId`.
    - [src/components/project-space/ModuleGrid.tsx](../src/components/project-space/ModuleGrid.tsx) lines 107-118 key each `ModuleShell` by `module_instance_id`, so changing to a pane with different module IDs swaps those module instances.
  - For `ProjectSpacePage` and `WorkView` themselves, I do not see a code-level key forcing remount.
- `pane route -> project work (/work)`:
  - The reverse of the above: same wrappers stay in place, active pane selection changes, and the keyed pane-specific children can remount.
- `project route -> myHub (/projects)`:
  - `ProjectRouteGuard` and `ProjectSpacePage` stop rendering.
  - `ProjectsPage` renders again.
  - `AppShell` remains mounted.

- I did not find any `window.location = ...`, `location.assign(...)`, or `location.replace(...)` calls that perform app navigation. The `window.location` references found in `src/services/hubLive.ts`, `src/lib/env.ts`, and [src/context/AuthzContext.tsx](../src/context/AuthzContext.tsx) are URL construction / auth redirect origin usage, not in-app route changes.
- I found two notable `<a>` usages:
  - [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) lines 1373-1378: a skip-link to `#main-content`.
  - [src/features/PersonalizedDashboardPanel.tsx](../src/features/PersonalizedDashboardPanel.tsx) lines 333-356: hub-home task/event rows render as `<a href={item.explicitHref}>`, but ordinary left-click is intercepted with `preventDefault()` and handled in-app. Modified clicks still fall through to native anchor navigation.

Current state summary: routing is a straightforward `BrowserRouter` setup with sibling top-level routes and a persistent `AppShell`. The app shell stays mounted across route changes, while routed pages swap under it; pane-level content has a few explicit keyed remount points, but there is no code-level route transition system.

## 2. Persistent shell and chrome

- The persistent shell is defined in [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) (lines 1368-1865).
- The shell structure is:
  - a root full-height wrapper (`div.flex.h-screen.flex-col`)
  - an sr-only header with `Hub workspace`
  - the main routed content area (`<main id="main-content">`)
  - a persistent footer toolbar (`<footer><nav aria-label="App toolbar">`)
- There is no persistent global top bar or persistent sidebar in the live route tree. The only global chrome is the bottom toolbar.
- The bottom toolbar sits outside the router outlet. In [src/App.tsx](../src/App.tsx) the route content is passed as `children` into `AppShell`; in [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) lines 1380-1382 those children render inside `<main>`, while the toolbar lives after `<main>` at lines 1384-1712.
- The toolbar is composed of:
  - home button and breadcrumb area at lines 1389-1407
  - Nav dropdown trigger and panel at lines 1410-1508
  - global search field and results popover at lines 1510-1667
  - quick-add menu at lines 1669-1712
  - Thought Pile capture control at lines 1714-1765
  - shell-mounted dialogs for Calendar, Tasks, and Reminders at lines 1767-1865
  - notifications and profile controls later in the same component
- Shell state such as `quickNavOpen`, `toolbarDialog`, `contextMenuOpen`, `captureOpen`, `notificationsOpen`, `profileOpen`, and the global search query all live inside `AppShell`. Because `AppShell` is outside the route content and I did not find a location-change effect that resets them, the shell keeps its own React state across route changes.
- The bottom toolbar does re-render on navigation. `AppShell` reads `location.pathname`, recalculates `isOnHubHome`, `currentProjectId`, and the breadcrumb, so route changes cause rerenders even though the shell itself remains mounted.
- I did not find shell-level route transition animations. The shell has control-level hover/focus/opacity transitions, but no route enter/exit animation system. The notable animations I found elsewhere are reminder completion keyframes in [src/components/project-space/RemindersModuleSkin.tsx](../src/components/project-space/RemindersModuleSkin.tsx) (lines 52-85) and the pane-chip reveal transition in [src/components/project-space/PaneSwitcher.tsx](../src/components/project-space/PaneSwitcher.tsx) (lines 113-123).

Current state summary: the app has a single persistent global chrome layer, and it is the bottom toolbar in `AppShell`. That shell persists and keeps its own local state across navigation, but navigation itself is visually abrupt because there is no shell-level transition system.

## 3. Layer transitions between myHub -> Project -> Pane

- I did not find a dedicated "project card" component on myHub. The code-backed project-to-project-space entry point on the default myHub surface is the `Go To Project` link inside each Project Lens section header in [src/features/PersonalizedDashboardPanel.tsx](../src/features/PersonalizedDashboardPanel.tsx) (lines 459-473).
- When a user goes from myHub to a project:
  - the URL changes from `/projects` to `/projects/:projectId/overview`
  - `ProjectsPage` is replaced by `ProjectSpacePage`
  - the global footer toolbar persists
  - the new page renders the `Project Space` header block, then the project overview content
  - I did not find any shared-element transition, motion layout ID, or view-transition API hook connecting the two surfaces
- When a user goes from project overview to the Work view:
  - navigation happens through the `Work` tab in [src/pages/ProjectSpacePage.tsx](../src/pages/ProjectSpacePage.tsx) (lines 1057-1068)
  - the URL changes to `/projects/:projectId/work` or `/projects/:projectId/work/:paneId`
  - the `OverviewView` subtree stops rendering and the work subtree begins rendering
  - the project-space header block remains above the content, so there is some structural continuity at the page level, but not an animation-driven transition
- When a user clicks into a pane from the project Work view:
  - the URL changes to `/projects/:projectId/work/:paneId`
  - navigation is done through pinned pane buttons, `PaneSwitcher`, read-only pane buttons, or pane route links in the pane settings dialog
  - the page stays on the work surface, but the active pane changes
  - the pane title in `WorkView` changes, pane-scoped modules change, `MobileModulesOverlay` is keyed by pane ID, and the collaborative doc editor is keyed by doc ID
- Reverse navigation behaves symmetrically:
  - pane -> project work uses the same work route without `:paneId`
  - work/overview/tools use the project-space top tabs
  - back to myHub uses the footer home button in [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) lines 1391-1400
- I did not find:
  - Framer Motion
  - `layoutId`
  - `document.startViewTransition(...)`
  - route enter/exit animation wrappers
  - CSS transition hooks specifically tied to route changes
- The URL hierarchy does reflect the intended nesting:
  - `/projects` for myHub
  - `/projects/:projectId/overview`
  - `/projects/:projectId/work`
  - `/projects/:projectId/work/:paneId`
  - `/projects/:projectId/tools`
- The UI only partially reflects that hierarchy:
  - the footer breadcrumb shows `myHub` or `Projects > {project} > {tab}`
  - the project-space header shows the project name and the Overview/Work/Tools/pinned-pane tabs
  - the active pane name appears in `WorkView`
  - the footer breadcrumb does not include the pane name even when the URL does

Current state summary: the URL structure expresses a clean hierarchy from home to project to pane, but the visual transitions between those layers are mostly hard cuts. There is structural continuity from the persistent footer and the project-space header, but no animation or shared-element continuity across layers.

## 4. Breadcrumbs and location indicators

- Footer breadcrumb in the bottom-left of the shell:
  - implemented in [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) lines 1389-1407
  - built by [src/components/layout/appShellUtils.ts](../src/components/layout/appShellUtils.ts) lines 235-261
  - visual weight: very light; `text-xs text-muted`
  - position: bottom-left of the global footer toolbar
  - interactivity: the text breadcrumb is not clickable; only the adjacent home icon button is interactive
  - current mappings:
    - `/projects` and `/` -> `myHub`
    - project pages -> `Projects > {project name} > {segment}`
- Project-space header block:
  - implemented in [src/pages/ProjectSpacePage.tsx](../src/pages/ProjectSpacePage.tsx) lines 1028-1106
  - visual weight: much stronger than the footer breadcrumb; it has a bordered panel, uppercase `Project Space` label, and a large project title
  - position: top of the routed project page content
  - interactivity: Overview, Work, pinned-pane buttons, and Tools are all clickable
- Work-surface pane switcher:
  - implemented in [src/components/project-space/PaneSwitcher.tsx](../src/components/project-space/PaneSwitcher.tsx) lines 45-148
  - visual weight: medium; it is a compact row of dots/chips with expanding labels
  - position: inside the `Work Panes` section near the top of the work surface
  - interactivity: fully interactive; it changes panes and supports keyboard movement/reordering
- Pane title inside `WorkView`:
  - implemented in [src/components/project-space/WorkView.tsx](../src/components/project-space/WorkView.tsx) lines 600-605
  - visual weight: strong heading
  - position: top of the pane content
  - interactivity: none
- Focused View indicator:
  - implemented in [src/pages/ProjectSpacePage.tsx](../src/pages/ProjectSpacePage.tsx) lines 1438-1457
  - visual weight: medium heading (`Focused View: {name}`)
  - position: above the main `WorkView` when a view embed is focused
  - interactivity: the close button is interactive, but it closes the focus state rather than navigating up the hierarchy

- On the specific "breadcrumb-like element" question: I did not find a breadcrumb rendered in the bottom-left of `ProjectSpacePage` itself. The breadcrumb-like UI in the bottom-left is the global AppShell footer breadcrumb. `ProjectSpacePage`'s own hierarchy indicator is the top `Project Space` panel, not a bottom-left element.

Current state summary: there are multiple location indicators, but they are split across the footer shell, the project-space header, and the pane header. The footer breadcrumb is the weakest and least interactive one, while the project-space header is the clearest hierarchy control inside project routes.

## 5. Bottom toolbar structure

- The bottom toolbar is defined in [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx). Supporting static item definitions live in [src/components/layout/appShellUtils.ts](../src/components/layout/appShellUtils.ts).
- On myHub (`/projects`), the toolbar shows:
  - breadcrumb text `myHub`
  - `Nav` button
  - global `Search...` field
  - quick-add `+` button
  - `Thought Pile` button
  - notifications button
  - profile button
- On myHub specifically, the home icon button is not shown because `isOnHubHome` is `true` in [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) line 167.
- In the Nav dropdown, the fixed items are defined in [src/components/layout/appShellUtils.ts](../src/components/layout/appShellUtils.ts) lines 44-48:
  - Calendar
  - Tasks
  - Reminders
- The Nav dropdown also appends destination items in [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) lines 777-793:
  - visible app tabs from [src/lib/policy.ts](../src/lib/policy.ts) lines 14-17: `Hub`, `Projects`
  - every project in the project list, each linking to `/projects/:id/overview`
- The quick-add menu items are defined in [src/components/layout/appShellUtils.ts](../src/components/layout/appShellUtils.ts) lines 50-55:
  - Task
  - Calendar Event
  - Reminder
  - Project
- The toolbar differs across surfaces only by state and context, not by component composition:
  - off myHub, the home icon button appears
  - the breadcrumb text changes with location
  - dialogs and search results reflect the current project/personal-project context
  - the component tree remains the same
- The toolbar-owned dialogs are:
  - Calendar dialog mounting `CalendarModuleSkin` at [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) lines 1767-1810
  - Tasks dialog mounting `TasksModuleSkin` at lines 1812-1845
  - Reminders dialog mounting `RemindersModuleSkin` at lines 1848-1865
  - quick-add event/reminder/project dialogs via [src/components/layout/QuickAddDialogs.tsx](../src/components/layout/QuickAddDialogs.tsx)
  - task quick-add via [src/components/project-space/TaskCreateDialog.tsx](../src/components/project-space/TaskCreateDialog.tsx)

Current state summary: there is one bottom toolbar for the whole app, and it is assembled centrally in `AppShell`. Surface-to-surface differences are contextual rather than architectural: the same toolbar persists, but its breadcrumb and project-aware data change with the route.

## 6. Identity persistence of items across scopes

### Tasks

- myHub stream / Project Lens:
  - rendered by `ItemRow` in [src/features/PersonalizedDashboardPanel.tsx](../src/features/PersonalizedDashboardPanel.tsx) lines 303-356
  - appearance: full-width bordered card, `Task` chip, title, project dot, project name, optional subtitle, due label on the right
- myHub day strip:
  - rendered in [src/components/hub-home/DayStrip.tsx](../src/components/hub-home/DayStrip.tsx) lines 378-409
  - appearance: small circular marker on the timeline with a short text label floating above or below it
- myHub triage panel:
  - rendered in [src/components/hub-home/TriagePanel.tsx](../src/components/hub-home/TriagePanel.tsx) lines 162-355
  - appearance: compact bordered action card with title, due/project metadata, priority chip, and Complete / Reschedule / Snooze or Assign time controls
- Project overview task view:
  - rendered through `TasksTab` in [src/components/project-space/OverviewView.tsx](../src/components/project-space/OverviewView.tsx) lines 428-513
  - primary row UI comes from `TaskRow` in [src/components/project-space/TasksTab.tsx](../src/components/project-space/TasksTab.tsx) lines 390-778
  - appearance: dense row with a status button, left accent bar, task title, subtask count pill, due label, subtask expansion, and overflow actions
- Pane tasks module, small and medium sizes:
  - rendered by `TaskSummaryRow` / `TaskSummaryRows` in [src/components/project-space/TasksModuleSkin.tsx](../src/components/project-space/TasksModuleSkin.tsx) lines 142-228 and lines 402-489
  - appearance: simpler row list, circular status button, small priority dot, task title, due label
- Pane tasks module, large size:
  - reuses the full `TasksTab` via [src/components/project-space/TasksModuleSkin.tsx](../src/components/project-space/TasksModuleSkin.tsx) lines 492-633
- Shared-component finding for tasks:
  - there is shared reuse inside project/pane task surfaces: `TasksTab`, `TaskRow`, `TaskSummaryRow`, and `TaskComposer`
  - myHub task rendering is a separate implementation and is not visually identical to project/pane task rendering

### Events

- myHub stream / Project Lens:
  - rendered by `ItemRow` in [src/features/PersonalizedDashboardPanel.tsx](../src/features/PersonalizedDashboardPanel.tsx) lines 303-356
  - appearance: same card shell as tasks, but with `Event` chip and no task subtitle
- myHub day strip:
  - rendered in [src/components/hub-home/DayStrip.tsx](../src/components/hub-home/DayStrip.tsx) lines 334-367
  - appearance: horizontal time-span pill placed on the timeline bar
- Project overview calendar:
  - rendered by [src/components/project-space/CalendarTab.tsx](../src/components/project-space/CalendarTab.tsx) lines 146-195
  - appearance: tiny pill-like entries inside a month grid; each has a priority dot and truncated label
  - the data here is demo data from [src/components/project-space/OverviewView.tsx](../src/components/project-space/OverviewView.tsx) lines 73-84 and 193
- Pane calendar module, month view:
  - rendered in [src/components/project-space/CalendarModuleSkin.tsx](../src/components/project-space/CalendarModuleSkin.tsx) lines 761-903
  - appearance: month cells with button-like event chips, optional time prefix, and overflow popover
- Pane calendar module, week view:
  - rendered in [src/components/project-space/CalendarWeekView.tsx](../src/components/project-space/CalendarWeekView.tsx) lines 143-203
  - appearance: stacked bordered cards with title, time range, and project label
- Pane calendar module, day view:
  - rendered in [src/components/project-space/CalendarDayView.tsx](../src/components/project-space/CalendarDayView.tsx)
  - appearance: time-based agenda/day layout rather than the myHub card or overview month-chip presentation
- Shared-component finding for events:
  - event rendering is not unified across scopes
  - the overview calendar, pane calendar views, and myHub each use different display patterns

### Reminders

- myHub day strip:
  - rendered in [src/components/hub-home/DayStrip.tsx](../src/components/hub-home/DayStrip.tsx) lines 412-441
  - appearance: diamond marker on the timeline with a floating text label
- myHub triage panel:
  - rendered in [src/components/hub-home/TriagePanel.tsx](../src/components/hub-home/TriagePanel.tsx) lines 362-420
  - appearance: compact bordered action card with title, due label, and Dismiss / Snooze actions
- Pane reminders module:
  - rendered by `ReminderRibbonRow` in [src/components/project-space/RemindersModuleSkin.tsx](../src/components/project-space/RemindersModuleSkin.tsx) lines 212-310
  - appearance: ribbon-shaped row with angled clipped right edge, title, time chip, `Later` button, and checkmark completion affordance
- Toolbar reminders dialog:
  - reuses the same `RemindersModuleSkin` from [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) lines 1848-1865
- Shared-component finding for reminders:
  - reminders reuse the same module skin between pane and toolbar contexts
  - myHub reminder rendering is separate and visually distinct

Current state summary: identity is only partially preserved across scopes. Tasks share some components inside project/pane surfaces, but myHub is separate; events and reminders change even more noticeably by scope, so the same underlying item type often looks materially different depending on where it appears.

## 7. Empty and zero states across surfaces

- myHub with only the auto-created myHub and no user-created content:
  - `DayStrip` shows the quote empty state in [src/components/hub-home/DayStrip.tsx](../src/components/hub-home/DayStrip.tsx) lines 450-455: `The day is your oyster. Or carrot. Or something… — Shakespeare`
  - `ContextBar` still renders with `0 events`, `0 tasks`, and `0 reminders` counts from [src/components/hub-home/ContextBar.tsx](../src/components/hub-home/ContextBar.tsx) lines 65-104
  - default myHub view is `Project Lens`; because empty sections default collapsed, the user sees section headers with `0 items` rather than an expanded empty message until they open a section ([src/features/PersonalizedDashboardPanel.tsx](../src/features/PersonalizedDashboardPanel.tsx) lines 455-499)
  - the explicit `No projects yet.` message at line 508 does not apply if the personal project exists
  - if the user switches to Stream, Stream shows `Nothing here.` at lines 612-614
- Empty project Overview view:
  - there is no single overview-wide empty state
  - the invite-members panel and project summary always render in [src/components/project-space/OverviewView.tsx](../src/components/project-space/OverviewView.tsx) lines 305-384
  - `Timeline` and `Calendar` are not actually empty-data views in current code; they render hardcoded sample/demo data from lines 45-84 and 179-193
  - `Tasks` shows a `New Task` button and `TasksTab`, but `TasksTab` itself has no explicit zero-state message when the task list is empty
  - `Kanban` shows four columns and `No cards` within empty columns at lines 526-537
- Empty project Work view with no panes:
  - the project-space page still renders the `Project Space` header and `Work Panes` block
  - if `WorkView` receives no active pane, it renders `No pane selected.` in [src/components/project-space/WorkView.tsx](../src/components/project-space/WorkView.tsx) lines 402-407
  - `PaneSwitcher` shows `No panes available.` if it is rendered with an empty pane list in [src/components/project-space/PaneSwitcher.tsx](../src/components/project-space/PaneSwitcher.tsx) lines 41-43
  - pane creation is a fallback inline control in [src/pages/ProjectSpacePage.tsx](../src/pages/ProjectSpacePage.tsx) lines 1222-1242, not a dedicated empty-state component
- Empty pane with no modules:
  - `ModuleGrid` renders a dedicated empty state in [src/components/project-space/ModuleGrid.tsx](../src/components/project-space/ModuleGrid.tsx) lines 53-86
  - copy: `Let's get this pane started!` and `Add a first module to shape the pane, then keep building from there.`
  - CTA: `Add a module`
- Empty Tasks module:
  - small: dedicated `ModuleEmptyState` with `No tasks in this pane.` in [src/components/project-space/TasksModuleSkin.tsx](../src/components/project-space/TasksModuleSkin.tsx) lines 424-429
  - medium: dedicated `ModuleEmptyState` with `No tasks in this pane.` and CTA `New Task` at lines 473-480
  - large: dedicated `ModuleEmptyState` with `No tasks in this pane.` and description `It's Procrastinators vs ProTaskinators out here.` at lines 595-601
- Empty Calendar module:
  - large desktop calendar module with zero events: dedicated `ModuleEmptyState` in [src/components/project-space/CalendarModuleSkin.tsx](../src/components/project-space/CalendarModuleSkin.tsx) lines 580-603
  - copy is either `No relevant events yet.` or `No project events yet.`
  - CTA is `Show All` or `New Event` depending on scope and create capability
  - small compact calendar: `No events for {date}.` at lines 638-645
  - day view: `No events today` with `Create event` button in [src/components/project-space/CalendarDayView.tsx](../src/components/project-space/CalendarDayView.tsx) lines 748-761
  - week view day panels: fallback row `No events` with a `+` create button in [src/components/project-space/CalendarWeekView.tsx](../src/components/project-space/CalendarWeekView.tsx) lines 183-197
- Empty Reminders module:
  - dedicated `ModuleEmptyState` with `No reminders yet.` in [src/components/project-space/RemindersModuleSkin.tsx](../src/components/project-space/RemindersModuleSkin.tsx) lines 547-552

Current state summary: empty states are uneven. Some surfaces use dedicated reusable module empty states, but myHub and overview surfaces mix fallback copy, collapsed-zero sections, and in the overview calendar/timeline case, hardcoded sample data instead of a real empty state.

## 8. Module-level creation affordances

- Task creation from task surfaces:
  - pane task modules use the inline `TaskComposer` in [src/components/project-space/TasksModuleSkin.tsx](../src/components/project-space/TasksModuleSkin.tsx) lines 231-399
  - fields are structured: title (`New task...`), priority select, due-date input, optional parent-task selector
  - overview tasks use `TaskCreateDialog` from [src/components/project-space/OverviewView.tsx](../src/components/project-space/OverviewView.tsx) lines 486-513
  - the dialog in [src/components/project-space/TaskCreateDialog.tsx](../src/components/project-space/TaskCreateDialog.tsx) lines 259-430 supports natural-language interpretation plus structured fields
- Reminder creation from reminder surfaces:
  - reminders are created inline in [src/components/project-space/RemindersModuleSkin.tsx](../src/components/project-space/RemindersModuleSkin.tsx) lines 456-532
  - the input is a natural-language bar with placeholder `Add a reminder…`
  - typing produces a parser preview card after a short delay
  - if the parser has little to show, helper copy says `Just set a time — e.g. "call dentist tomorrow at 3pm"`
  - submit affordance is the `Add` button or Enter
- Calendar creation from calendar surfaces:
  - I did not find a natural-language input bar in `CalendarModuleSkin`
  - calendar creation is structured and button/day-cell driven in [src/components/project-space/CalendarModuleSkin.tsx](../src/components/project-space/CalendarModuleSkin.tsx) lines 485-574
  - creation opens an inline panel with:
    - heading for the selected day
    - `Event title` input
    - `Start time` and `End time` inputs
    - `Cancel` and `Create` actions
  - entry points include:
    - `New Event` button in large view (lines 736-746)
    - clicking a month cell (lines 797-819)
    - compact `+` button in small view (lines 627-635)
    - `+`/`Create event` affordances in week/day views
- The toolbar quick-add flows are separate from module-level creation:
  - calendar quick add is the structured `QuickAddEventDialog` in [src/components/layout/QuickAddDialogs.tsx](../src/components/layout/QuickAddDialogs.tsx) lines 6-129
  - reminder quick add is the natural-language `QuickAddReminderDialog` at lines 131-218
  - task quick add uses `TaskCreateDialog`
- There is not one unified creation pattern across modules:
  - reminders use inline natural language
  - calendar uses inline structured date/time entry
  - tasks split between inline structured entry and a fuller dialog with NLP assist

Current state summary: creation UX is module-specific rather than unified. Reminders are the only clearly natural-language-first module surface; calendar is structured and inline, and tasks split between a lightweight inline composer and a separate dialog.

## 9. Layer vocabulary consistency

| Term | Where it appears | Component / file | What it refers to |
| --- | --- | --- | --- |
| `myHub` | footer breadcrumb for `/projects` | [src/components/layout/appShellUtils.ts](../src/components/layout/appShellUtils.ts), [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) | the `/projects` home surface |
| `Hub` | app tab label in quick nav; `/` route target | [src/lib/policy.ts](../src/lib/policy.ts), [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) | an app-level destination that immediately redirects to `/projects` |
| `Hub OS` | wordmark / brand text | [src/features/PersonalizedDashboardPanel.tsx](../src/features/PersonalizedDashboardPanel.tsx) | the product/application name |
| `myHub` | quick capture target label | [src/features/QuickCapture.tsx](../src/features/QuickCapture.tsx) | the personal project / personal capture target |
| `Projects` / `Project` | breadcrumb root, profile menu, quick-add label, search result type, `Project Lens`, `Go To Project`, `New Project` | [src/components/layout/appShellUtils.ts](../src/components/layout/appShellUtils.ts), [src/components/layout/ProfileMenu.tsx](../src/components/layout/ProfileMenu.tsx), [src/features/PersonalizedDashboardPanel.tsx](../src/features/PersonalizedDashboardPanel.tsx) | the project entity and project list |
| `Project Space` | top project-page label | [src/pages/ProjectSpacePage.tsx](../src/pages/ProjectSpacePage.tsx) | the whole project route surface |
| `Work` / `Work Panes` | project-space tab and section heading | [src/pages/ProjectSpacePage.tsx](../src/pages/ProjectSpacePage.tsx) | the project's work surface and its pane list |
| `Pane` | pane switcher, pane settings, create pane, other panes | [src/pages/ProjectSpacePage.tsx](../src/pages/ProjectSpacePage.tsx), [src/components/project-space/PaneSwitcher.tsx](../src/components/project-space/PaneSwitcher.tsx) | a sub-surface inside project work |
| `Module` / `Modules` | add-module dialog, module grid, module headers | [src/components/project-space/ModuleGrid.tsx](../src/components/project-space/ModuleGrid.tsx), [src/components/project-space/AddModuleDialog.tsx](../src/components/project-space/AddModuleDialog.tsx) | widgets placed inside a pane |
| `Workspace` / `Workspace Doc` | sr-only app-shell heading and pane document region | [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx), [src/pages/ProjectSpacePage.tsx](../src/pages/ProjectSpacePage.tsx), [src/components/project-space/WorkView.tsx](../src/components/project-space/WorkView.tsx) | both the whole app shell and the pane-specific document area |

- Inconsistencies / collisions found:
  - `Hub` means at least three different things in user-facing strings: the product brand (`Hub OS`), the app tab label (`Hub`), and the personal capture destination (`myHub`).
  - `myHub` is the breadcrumb label for `/projects`, but the routed page/component names are `ProjectsPage` / `Projects`, and the app tab label for `/` is `Hub`.
  - `Project Space` is the name of the live project page, but URLs and breadcrumbs speak in `Projects` plus tab names rather than `Space`.
  - `Workspace` is overloaded: the app shell says `Hub workspace`, while project panes have a `Workspace Doc`.
  - `Space` also appears in unused or not-currently-mounted files:
    - [src/components/layout/ProjectShell.tsx](../src/components/layout/ProjectShell.tsx) line 35: `Notes Space`
    - [src/components/project-space/TopNavTabs.tsx](../src/components/project-space/TopNavTabs.tsx) lines 34-35: `Project Space` / `Hub Project Space Wireframe`
    - I did not find either component in the live route tree.

Current state summary: the live vocabulary is not fully consistent. The same conceptual layers are described with a mix of `Hub`, `myHub`, `Projects`, `Project Space`, and `Workspace`, and a few terms are overloaded enough that the hierarchy is not named the same way everywhere.

## 10. Calendar event date picker layout issue

- I did not find a dedicated event-creation dialog inside `CalendarModuleSkin`. The module-level event creator is an inline panel, not a dialog, in [src/components/project-space/CalendarModuleSkin.tsx](../src/components/project-space/CalendarModuleSkin.tsx) lines 485-574.
- That inline creator currently renders:
  - selected date heading
  - `Event title` input
  - a two-column row with `Start time` and `End time`
  - inline error region
  - `Cancel` and `Create` buttons
- The inline creator is inserted at different places depending on the view:
  - after the large zero-state at line 601
  - after the small compact day state at line 665
  - below the large month/week/year/day content at line 903
- There is a separate quick-add dialog for calendar events in [src/components/layout/QuickAddDialogs.tsx](../src/components/layout/QuickAddDialogs.tsx) lines 6-129.
  - It renders `Project`, `Event title`, then a two-column `Start` / `End` `datetime-local` row, then actions.
- The dialog primitive itself in [src/components/ui/dialog.tsx](../src/components/ui/dialog.tsx) lines 22-39 and [tokens.css](../tokens.css) lines 206-225 only defines width/max-width utility classes by default. I did not find a default dialog max-height there that would by itself crop the bottom row.
- I did find one important container-level constraint for the toolbar calendar surface in [src/components/layout/AppShell.tsx](../src/components/layout/AppShell.tsx) lines 1767-1775:
  > `panelClassName="... !h-[calc(100vh-5rem)] !max-h-[calc(100vh-5rem)] ... overflow-hidden"`
  - That toolbar dialog also wraps the module in an inner `div` with `overflow-y-auto` at line 1791.
  - So the toolbar calendar is height-constrained, but the intended behavior is internal scrolling rather than simple clipping.
- Based on code inspection alone:
  - the module-level creator is inline, not dialog-based
  - the quick-add event dialog does not have its own explicit max-height/overflow crop rule
  - the toolbar-hosted calendar module does live inside a constrained-height dialog shell
  - I did not find code that specifically targets or isolates the date/time row for cropping

Current state summary: the "calendar event creation dialog" is split between an inline module creator and a separate quick-add dialog. The only clear height constraint I found is on the toolbar-hosted calendar dialog shell, where the content is supposed to scroll inside a fixed-height container.

## Key observations

1. The app has a persistent bottom-toolbar shell, but routed content swaps abruptly underneath it because there is no route-transition or shared-element system.
2. The hierarchy is cleaner in the URL than in the UI vocabulary: `/projects -> /projects/:projectId -> /projects/:projectId/work/:paneId` is consistent, while `Hub`, `myHub`, `Projects`, `Project Space`, and `Workspace` are not.
3. `ProjectSpacePage` is the central project surface for overview, work, and tools, and same-project tab changes mostly happen inside that one component rather than through a deeper nested-router structure.
4. The footer breadcrumb is present but very low-emphasis and non-clickable; the stronger location cue is the project-space header block, not the shell breadcrumb.
5. Identity persistence across scopes is weak for events and reminders and only partial for tasks; the same item type is often rendered in very different ways on myHub, in overview surfaces, and inside pane modules.
6. Empty-state behavior is inconsistent: some modules have dedicated empty states, myHub relies on collapsed zero-count sections, and the project overview timeline/calendar are currently populated by hardcoded demo data instead of true empty-state behavior.
7. Calendar creation UX is structured and inline inside the module, reminders are natural-language-first, and tasks split between inline and dialog-based creation, so there is no consistent cross-module creation pattern today.
