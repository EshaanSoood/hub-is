# UI Contracts (Global)

This document defines current UI contracts across the app as implemented today.
It records existing behavior first, then separate future hooks.

## 1) Global App Contract Surface

### 1.1 Session state contract
- `authReady=false`: app renders an initialization surface only.
- `authReady=true && signedIn=false`: app renders login-only route handling (`* -> LoginPage`).
- `authReady=true && signedIn=true`: app renders `AppShell` + capability-gated routes.

### 1.2 Navigation model contract
- Primary navigation is rendered by `AppShell` from `appTabs` + `canGlobal(capability)` policy checks.
- Visible nav tabs are policy-derived and may differ by user capabilities.
- Skip link to `#main-content` is always available in authenticated shell.

### 1.3 Route gate contract
- Every authenticated route is wrapped in `ProtectedRoute` with required global capability.
- Project Space routes are additionally wrapped in `ProjectRouteGuard` requiring `project.view` for `:projectId`.
- Gate failures render `AccessDeniedView` instead of route content.

### 1.4 Design-system boundary contract
- Shadcn/Radix engine files exist in `/src/components/ui`.
- Only `/src/components/primitives/*` may import from `/src/components/ui/*`.
- App code outside primitives imports primitives or bespoke components only.
- Page-level layout contract:
  - All non-project route pages import from `/src/components/layout/*`.
  - `ProjectSpacePage` is the canonical project exception and composes project-space surfaces (`TopNavTabs`, `OverviewView`, `WorkView`, `ToolsView`) for `Overview/Work/Tools`.

## 2) Screen Contracts (Current State)

## 2.1 Login screen (`LoginPage`)
- Purpose:
  - Unauthenticated entrypoint for Keycloak sign-in.
- Required regions:
  - Brand/title region.
  - Sign-in explanation region.
  - Primary sign-in action.
  - Inline auth error region when present.
- Allowed subviews:
  - Single sign-in panel only.
- Key interaction rules:
  - Primary action invokes `signIn()`.
  - Button disabled when Keycloak config is unavailable.
- Accessibility invariants:
  - Semantic heading hierarchy.
  - Native button disabled semantics.
  - Error text visible and readable without hover/tooltip.

## 2.2 Home hub (`HubPage`)
- Purpose:
  - Aggregates operational panels (dashboard, core, tasks, notifications, notes, files, wake, activity).
- Required regions:
  - Page header.
  - Execution phases section header.
  - Responsive panel grid.
  - Activity log panel.
- Allowed subviews:
  - Fixed panel composition from current feature set.
- Key interaction rules:
  - Panels may mutate service state and append activity events.
  - Panel actions stay in-page; links open external systems where configured.
- Accessibility invariants:
  - Each panel has semantic heading + descriptive text.
  - Live status text uses `aria-live` where async actions occur.

## 2.3 Projects list (`ProjectsPage`)
- Purpose:
  - List projects user can access; provide deterministic route to project space overview.
- Required regions:
  - Page header.
  - Loading/error text surfaces.
  - Data table for projects.
- Allowed subviews:
  - Single tabular view.
- Key interaction rules:
  - Project name links route to `/projects/:projectId/overview`.
- Accessibility invariants:
  - Table uses semantic `<table>` structure with caption.

## 2.4 Project Space (`ProjectSpacePage`)
- Purpose:
  - Contract-driven project workspace with top-level sections `Overview`, `Work`, `Tools`.
- Required regions:
  - `TopNavTabs` (always).
  - One active section view (`OverviewView` | `WorkView` | `ToolsView`).
  - Overview-only `OverviewHeader` (title, collaborators, refs).
- Allowed subviews:
  - Overview subviews fixed to `timeline`, `calendar`, `tasks`.
  - Work pane route fixed to `/projects/:projectId/work/:paneId`, with compatibility entry `/projects/:projectId/work`.
- Key interaction rules:
  - Route governs active pane.
  - Base project route `/projects/:projectId` is compatibility redirect:
    - with `noteId` query -> Work surface
    - otherwise -> Overview surface
  - Work entry route without pane id resolves to first available pane while preserving query params.
  - Pinned pane shortcuts may open work pane with `?pinned=1` intent.
  - Pinned-pane entry hides pane switcher by default until user reveals it.
  - Work pane audience mode is exactly one of `project | personal | custom`.
  - `custom` pane membership is constrained to project collaborators only.
  - Pane guard prevents fully empty pane regions.
  - Module grid limits: 12-col layout, S/M/L sizing, max 6 modules.
  - Focus mode collapses modules into top toolbar and opens module dialog on selection.
- Accessibility invariants:
  - Tabs are roving-focus capable via Radix-backed primitives.
  - Pane switcher uses toolbar keyboard model (Arrow nav, Ctrl+Arrow reorder, Ctrl+Shift+Number switch).
  - Dialog interactions preserve trap/return/Esc behavior through dialog primitive.
  - Checkbox groups use `fieldset/legend` composition.

## 2.5 Lessons Studio (`LessonsPage`)
- Purpose:
  - Hosts lessons workflow panel.
- Required regions:
  - Page header.
  - Single grid surface containing `LessonsStudioPanel`.
- Allowed subviews:
  - Single panel view.
- Key interaction rules:
  - Student selection controls note/email/invoice actions.
- Accessibility invariants:
  - Labeled form controls (`select`, `textarea`, inputs).
  - Status feedback uses readable text updates.

## 2.6 Media Flows (`MediaPage`)
- Purpose:
  - Hosts media workflow panel.
- Required regions:
  - Page header.
  - Single grid surface containing `MediaFlowsPanel`.
- Allowed subviews:
  - Single panel view.
- Key interaction rules:
  - Ingest -> summarize flow and export/delete bundle actions.
- Accessibility invariants:
  - Labeled controls and keyboard-operable actions.
  - Status text updates announced with `aria-live`.

## 2.7 Dev Work (`DevPage`)
- Purpose:
  - Hosts dev workflow and PR read-only visibility.
- Required regions:
  - Page header.
  - Single grid surface containing `DevWorkPanel`.
- Allowed subviews:
  - Single panel view.
- Key interaction rules:
  - Add research links locally; external links open new tab.
- Accessibility invariants:
  - Input is label-associated.
  - Table and links remain keyboard reachable.

## 2.8 Blocking Inputs (`BlockingInputsPage`)
- Purpose:
  - Show blocking env/config prerequisites for live mode.
- Required regions:
  - Page header.
  - Blocking inputs panel.
- Allowed subviews:
  - Empty state or list state.
- Key interaction rules:
  - Read-only informational screen.
- Accessibility invariants:
  - Semantic list and readable fallback message.

## 2.9 Not Found (`NotFoundPage`)
- Purpose:
  - Handle unknown authenticated routes.
- Required regions:
  - Not-found header.
  - Return-to-hub action.
- Allowed subviews:
  - Single action view.
- Key interaction rules:
  - Return action routes to `/`.
- Accessibility invariants:
  - Prominent heading and keyboard-operable action.

## 2.10 Access denied surface (`AccessDeniedView`)
- Purpose:
  - Communicate policy gate failure.
- Required regions:
  - Error heading.
  - Policy message panel.
  - Return action.
- Allowed subviews:
  - Single explanatory surface.
- Key interaction rules:
  - Rendered by route guards when capabilities fail.
- Accessibility invariants:
  - Action is keyboard-operable link.

## 3) Current Assumptions (Ambiguous/Overlapping)
- Assumption A:
  - `ProjectSpacePage` is the canonical project UX contract (Overview/Work/Tools).
- Assumption B:
  - Legacy alternate project surface has been removed; canonical routing targets Project Space only.
- Assumption C:
  - `noteId` in Project Space currently functions as preserved routing context; Work contract does not yet expose note-specific rendering.

## 4) Known Discrepancies (Observed)
- No blocking route/policy discrepancies remain for project top-level navigation.
- Residual non-blocking discrepancy:
  - Work route currently preserves `noteId` query context but does not yet render note-scoped UI by id.

## 5) Future Hooks (Documented, Not Current Behavior)
- Optional explicit note-scoped work route (`/projects/:projectId/work/notes/:noteId`) if note-by-id rendering is later required.
