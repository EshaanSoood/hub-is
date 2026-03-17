# HUB UI Audit (Full App)

Scope: complete UI audit across all routed Hub surfaces in `src/App.tsx` and their primary child surfaces.

Date: 2026-03-04

## 1) Route inventory (what exists, where it lives)

### Auth-state route shell

| Condition | Route | Entry file | Notes |
|---|---|---|---|
| `!authReady` | n/a | `src/App.tsx` | Full-screen initializing message only (`Initializing secure session...`). |
| `!signedIn` | `*` | `src/pages/LoginPage.tsx` | All unauthenticated paths collapse to the login screen. No signup/forgot-password route. |
| `signedIn` | all below | `src/components/layout/AppShell.tsx` | Shared app shell with top nav, skip link, profile trigger, footer. |

### Routed pages

| Route | Guard | Page/component | Primary surface type |
|---|---|---|---|
| `/` | `ProtectedRoute(hub.view)` | `src/pages/HubPage.tsx` | Hub dashboard (multi-panel control plane). |
| `/projects` | `ProtectedRoute(projects.view)` | `src/pages/ProjectsPage.tsx` | Project index table. |
| `/projects/:projectId` | none | `src/pages/ProjectRouteRedirectPage.tsx` | Redirect helper to overview/work based on `noteId` query. |
| `/projects/:projectId/overview` | `ProtectedRoute + ProjectRouteGuard` | `src/pages/ProjectSpacePage.tsx` (`activeTab="overview"`) | Project overview with Timeline/Calendar/Tasks subtabs. |
| `/projects/:projectId/work` | `ProtectedRoute + ProjectRouteGuard` | `src/pages/ProjectSpacePage.tsx` (`activeTab="work"`) | Project work surface; auto-navigates to first pane route. |
| `/projects/:projectId/work/:paneId` | `ProtectedRoute + ProjectRouteGuard` | `src/pages/ProjectSpacePage.tsx` (`activeTab="work"`) | Pane-specific work surface. |
| `/projects/:projectId/tools` | `ProtectedRoute + ProjectRouteGuard` | `src/pages/ProjectSpacePage.tsx` (`activeTab="tools"`) | Project tools/automations placeholder surface. |
| `/lessons` | `ProtectedRoute(lessons.view)` | `src/pages/LessonsPage.tsx` | Lessons Studio workflow panel. |
| `/media` | `ProtectedRoute(media.view)` | `src/pages/MediaPage.tsx` | Media workflows panel. |
| `/dev` | `ProtectedRoute(dev.view)` | `src/pages/DevPage.tsx` | Dev work + GitHub panel. |
| `/blocked-inputs` | `ProtectedRoute(blockedInputs.view)` | `src/pages/BlockingInputsPage.tsx` | Blocking input checklist. |
| `*` | none | `src/pages/NotFoundPage.tsx` | Not found fallback. |

### Important routed behavior details

- `noteId` deep-linking exists in URL redirects and notes links (`/projects/:id/work?noteId=...`), but no note-specific renderer in `WorkView`; note deep-link intent is not actually realized.
  - Link source: `src/features/NotesPanel.tsx`
  - Redirect: `src/pages/ProjectRouteRedirectPage.tsx`
  - Missing consumer in: `src/components/project-space/WorkView.tsx`
- A duplicate redirect implementation exists and is currently unused:
  - `src/components/auth/ProjectRouteRedirect.tsx`

### Unrouted major UI assets (present but not integrated into a route)

- Collaborative note editor stack:
  - `src/features/notes/CollaborativeLexicalEditor.tsx`
  - `src/features/notes/EditorShell.tsx`
- `ProjectShell` legacy scaffold:
  - `src/components/layout/ProjectShell.tsx`

## 2) Surface-by-surface notes

## Auth / login / signup

### What exists

- Login-only screen in `src/pages/LoginPage.tsx`, no signup/reset/invite acceptance routes.
- Keycloak sign-in CTA and auth error display.

### Good

- Minimal focusable flow and clear single primary action.
- Uses semantic button and visible disabled state.

### Bad / inconsistent / missing

- Marked “trash” by stakeholder and functionally minimal; does not match AppShell language or Hub density.
- Uses raw button styling instead of `Button` primitive.
- No signup, no invite-accept flow, no forgot-password, no SSO failure recovery path.
- Centered card layout (`min-h-[80vh]`) deviates from scaffold system and tokenized spacing rhythm.

## Hub dashboard (non-project home)

### What exists

- Route `/` -> `HubPage` with `PageHeader`, `Grid`, and many panels (`ProjectCorePanel`, `TasksPanel`, `NotesPanel`, `FilesPanel`, etc.).

### Good

- Consistent high-level scaffold via `PageHeader` + `Stack` + `Grid`.
- Broad feature coverage in one place.

### Bad / inconsistent / missing

- Panel internals are highly inconsistent; most use raw HTML controls/buttons rather than primitives.
- Owner governance (`ProjectCorePanel`) is a monolithic surface with mixed concerns and weak form semantics.
- No canonical empty-state component; tables with empty rows often render as blank structure.

## Project Space (overview/work/tools)

### What exists

- Route-driven top-level tabs in `TopNavTabs` + `ProjectSpacePage` state orchestration.
- `OverviewView` with Timeline/Calendar/Tasks subviews.
- `WorkView` with pane switcher, pane settings popover, module grid, workspace placeholder.
- `ToolsView` placeholder cards.

### Good

- Strong use of Radix-backed primitives for tabs/popovers/dialogs/selects.
- Work surface has explicit states: no panes, pane missing, modules disabled, workspace disabled.

### Bad / inconsistent / missing

- Project header language is placeholder/wireframe copy (`Hub Project Space Wireframe`) and not aligned with Hub header semantics.
- Overview/Work/Tools mix bespoke custom controls with primitives; interaction language is fragmented.
- Multiple project controls rely on custom pressed-button groups instead of unified segmented control primitives.
- Tools/Automation content is mostly placeholder text, not structurally standardized for future productization.

## Notes (global + within projects/work panes)

### What exists

- Global notes list panel (`NotesPanel`) on Hub dashboard.
- Deep-link attempts to project work via `noteId` query.
- Full collaborative editor components exist but are not connected to any route.

### Good

- Global notes table can list by project and has live status text.

### Bad / inconsistent / missing

- Project/work note editing surface is effectively missing from routed UX.
- `noteId` URL contract exists but not consumed by rendered work surface.
- No unified notes-specific header, revision timeline UI, conflict/lock state UI in routed pages.

## Tasks (global + within projects)

### What exists

- Global tasks panel (`TasksPanel`) on Hub.
- Project tasks subview (`TasksTab`) in project overview.

### Good

- Both surfaces expose filtering/grouping or segmentation concepts.
- Global quick-actions dialog uses Radix dialog baseline.

### Bad / inconsistent / missing

- Two separate task visual languages (table-based global vs clustered list project) with no shared task row/card contract.
- No reusable empty/loading/error shell for task sections.
- No global task page route; only embedded panel.

## Calendar (global + within projects)

### What exists

- Project calendar subview (`CalendarTab`) in overview.

### Good

- Clear month-grid representation with user/category filters.

### Bad / inconsistent / missing

- No global calendar route/surface.
- Day/week/year views are placeholders only (“future layout”).
- Uses many custom micro-styles (`text-[10px]`, `text-[11px]`) outside typography scale.

## Timeline / activity views

### What exists

- Project timeline subview (`TimelineTab`).
- Hub activity log table (`ActivityLogPanel`).

### Good

- Both provide chronological context.

### Bad / inconsistent / missing

- Timeline and activity feed have unrelated visual grammar (vertical timeline vs plain table) with no shared event model UI.
- No canonical “activity item” component across surfaces.

## Files / attachments surfaces

### What exists

- Global files panel (`FilesPanel`) with upload/create/share actions.
- Work modules include “Files” module slot (placeholder).

### Good

- Global panel covers key operations and workflow status.

### Bad / inconsistent / missing

- Attachment experiences are split between global table and project module placeholder with no unified attachment card/list component.
- No dedicated project-level file page route.

## Tools / automations surfaces

### What exists

- Project tools tab with Live Tools and Automation Builder placeholders.
- Owner governance controls in `ProjectCorePanel` include recovery and snapshot tooling.

### Good

- Clear domain intent for automation and live tooling.

### Bad / inconsistent / missing

- Automation Builder is a shell only; no standardized builder scaffolding component.
- Live tools rows and owner governance rows use separate card/list grammars.

## Settings / profile / invite / membership

### What exists

- Profile modal in `ProfilePanel` (available from app shell).
- Membership table, invite controls, owner actions in `ProjectCorePanel`.

### Good

- Dialog focus restoration handled via `triggerRef` in primitives dialog.

### Bad / inconsistent / missing

- No standalone settings route.
- Profile modal uses bespoke styling separate from design system panel/dialog patterns.
- Invite/governance forms lack robust label strategy and consistent field grouping.

## Empty / error / loading states

### What exists

- Several ad hoc text states (`Loading ...`, `No ...`, inline error paragraphs).
- `WorkView` has explicit no-pane/pane-not-found variants.

### Good

- Most async surfaces at least provide a status message.

### Bad / inconsistent / missing

- No shared loading skeleton component set.
- No canonical empty-state component (icon/title/body/CTA).
- Table empty rows often render as empty body with no explanatory row.

## Headers / nav patterns across app

### What exists

- Global app shell header (`AppShell`) for signed-in routes.
- Standard page title rows (`PageHeader`) on non-project pages.
- Project-specific top header (`TopNavTabs`) in project space.

### Good

- Route-level global nav is capability-gated and stable.
- Skip link exists globally.

### Bad / inconsistent / missing

- Hub header and project header are different systems, not variants of one system.
- Page headers are not consistently used (project and auth deviate heavily).

## 3) Consistency matrix

| Surface | Header style | Layout container | Primary actions | Secondary actions | Navigation type | List/card pattern | Form pattern |
|---|---|---|---|---|---|---|---|
| Login | Standalone centered brand + panel (`LoginPage`) | `max-w-md` centered | Keycloak continue | none | none | Single panel | Raw inputs/buttons; no field abstraction |
| Hub `/` | `PageHeader` + section header | `Stack` + `Grid` | Varies per panel | Varies | App top nav | `Panel` + `DataTable` mix | Mostly raw controls |
| Projects `/projects` | `PageHeader` | `Stack` | Project name link | none | App top nav | `DataTable` | none |
| Project Overview | `TopNavTabs` + `OverviewHeader` | `space-y-4`, nested `Card` | Tab switch, filter toggles | refs popover, invite (+) | Route tabs + sub tabs | Timeline/Calendar/Tasks bespoke cards/lists | Mostly custom compact controls |
| Project Work | `TopNavTabs` + Work card heading | `space-y-4`, many `Card`s | Add pane/module, focus mode | Pin/region/audience toggles | Route tabs + pane toolbar | Module grid + placeholders | Mix of primitive toggles and raw text inputs |
| Project Tools | `TopNavTabs` | `space-y-4` cards | Run tool / Create draft automation | none | Route tabs | Tool row list | Minimal, placeholder |
| Lessons | `PageHeader` | `Stack` + `Grid` | Generate invoice, save note | Email from profile | App top nav | Panel + tables | Raw select/input/textarea/buttons |
| Media | `PageHeader` | `Stack` + `Grid` | Ingest+summarize | Export/Delete bundle | App top nav | Panel sections | Raw select/input/buttons |
| Dev | `PageHeader` | `Stack` + `Grid` | Save link | View PR/Open Actions | App top nav | Panel + table + chips | Raw input/button |
| Blocking Inputs | `PageHeader` | `Stack` | none | none | App top nav | Panel + list | none |
| Access denied / 404 | Heading + panel / `PageHeader` | `Stack` | Return to hub | none | App top nav (if signed in) | Simple panel | none |

## 4) Accessibility notes

### Positive baseline

- Skip link exists and targets `#main-content` (`src/components/layout/AppShell.tsx`).
- Radix-backed primitives are used for dialogs/popovers/selects/tabs/menus/tooltips under `src/components/primitives`.
- Dialog focus restoration via `triggerRef` is implemented in shared primitive (`src/components/primitives/Dialog.tsx`).

### Issues / risks

1. **Form labeling gaps in owner/governance surface**
- Multiple inputs in `src/features/ProjectCorePanel.tsx` depend on placeholders without explicit `<label>` associations (create project, snapshot, restore, revert groups).
- Impact: screen reader discoverability and form navigation quality are weak.

2. **Custom overlay filter panel is not a true dialog/popover primitive**
- `src/components/project-space/FilterBarOverlay.tsx` builds overlay + panel manually with a fixed full-screen button and `role="region"`.
- Impact: no guaranteed focus management/trap/escape semantics consistent with Radix popover/dialog patterns.

3. **Keyboard shortcut conflict in pane switcher**
- In `src/components/project-space/PaneSwitcher.tsx`, arrow-key handling returns before `Ctrl+Arrow` reorder branch.
- Impact: reorder shortcut path is effectively blocked for keyboard users.

4. **Tabs semantics are partially manual and inconsistent**
- Overview/project sections use Radix tab triggers, but panels are manually conditionally rendered with custom `role="tabpanel"` blocks.
- Impact: mixed semantics make interaction patterns harder to standardize and test.

5. **No routed notes editor despite notes deep-link contract**
- Notes links route to `?noteId=...`, but no note editor is mounted in work routes.
- Impact: keyboard/screen-reader users are routed to a surface that does not expose the referenced note context.

6. **Skip-link is present; no additional landmark shortcuts**
- Only one skip target (`main-content`) exists; no quick-skip landmarks for primary nav/project subnav.

### Keyboard trap status

- Hard trap not detected in Radix dialogs.
- `FilterBarOverlay` is trap-adjacent risk due custom overlay behavior and lack of primitive focus policy.

## 5) Token usage check (raw values vs tokens)

### Strong token usage areas

- App shell/layout panels use token-backed classes: `bg-surface`, `bg-elevated`, `text-muted`, `border-subtle`, `rounded-panel`.
- Shared Radix wrappers in `src/components/ui` are mostly token-aligned.

### Raw/non-token usage to normalize

1. **Project-space color palette bypasses tokens**
- `src/components/project-space/designTokens.ts`
- `src/components/project-space/ModuleGrid.tsx`
- Uses literal Tailwind palette classes (`bg-sky-300`, `text-rose-300`, etc.) for domain semantics.

2. **Arbitrary typography/dimension values**
- `src/components/project-space/CalendarTab.tsx` (`text-[10px]`, `text-[11px]`)
- `src/components/project-space/TasksTab.tsx` (`text-[10px]` badges/chevrons)
- `src/components/project-space/TimelineTab.tsx` (`max-h-[32rem]`, `text-[11px]`)
- `src/components/project-space/PaneSwitcher.tsx` (`transition-[max-width,padding,...]`, `text-[10px]`)
- `src/pages/LoginPage.tsx` (`min-h-[80vh]`)

3. **Mixed focus ring strategy**
- Global `:focus-visible` token rule exists (`globals.css`), but raw per-component focus classes are inconsistent (some components add explicit rings, others rely solely on global).

4. **Toast theme hardcoded to dark**
- `src/components/ui/sonner.tsx` uses `theme="dark"`; conflicts with token-driven light/dark variable switching.

### Architecture boundary check

- Rule validated: no imports from `/src/components/ui` outside `/src/components/primitives`.
- Observed via repo-wide import scan.

