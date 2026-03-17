# Inconsistency Fix Plan (Prioritized)

Scope: documentation-only plan for UI unification. No feature implementation included.

## P0: App shell/header unification

- [ ] Define and adopt canonical `HubGlobalHeader` contract across all signed-in routes.
  - Routes: `/`, `/projects`, `/lessons`, `/media`, `/dev`, `/blocked-inputs`, `/projects/:projectId/*`
  - Files: `src/components/layout/AppShell.tsx`, `src/lib/policy.ts`
  - Fix target: one nav/identity/profile behavior model with no route-level header forks.

- [ ] Replace project wireframe header copy and normalize project title semantics.
  - Routes: `/projects/:projectId/overview`, `/projects/:projectId/work/:paneId`, `/projects/:projectId/tools`
  - Files: `src/components/project-space/TopNavTabs.tsx`, `src/components/project-space/OverviewHeader.tsx`
  - Fix target: canonical project header language aligned with Hub title row rules.

- [ ] Standardize header scaffold slots (title, subtitle, actions, context controls).
  - Routes: all signed-in routes
  - Files: `src/components/layout/PageHeader.tsx`, `src/components/project-space/TopNavTabs.tsx`, `src/pages/LoginPage.tsx`
  - Fix target: remove ad hoc title rows and enforce one scaffold contract.

## P0: Auth/login redesign scaffolding

- [ ] Create auth scaffold spec and align login with primitive button/input patterns.
  - Routes: unauthenticated `*`
  - Files: `src/pages/LoginPage.tsx`, `src/components/layout/Panel.tsx`, `src/components/primitives/Button.tsx`
  - Fix target: move from bespoke login card to canonical auth scaffold.

- [ ] Document and reserve missing auth routes for signup/invite acceptance/reset flows.
  - Routes: future `/signup`, `/invite/:token`, `/forgot-password` (not implemented)
  - Files impacted in plan: `src/App.tsx`, `src/pages/LoginPage.tsx`
  - Fix target: route contract ready for design + backend integration.

## P1: Dashboard vs project header alignment

- [ ] Align Hub dashboard section framing with project surface framing.
  - Routes: `/` and `/projects/:projectId/*`
  - Files: `src/pages/HubPage.tsx`, `src/components/project-space/TopNavTabs.tsx`, `src/components/layout/SectionHeader.tsx`, `src/components/primitives/SectionHeader.tsx`
  - Fix target: eliminate dual `SectionHeader` pattern divergence.

- [ ] Consolidate project overview/work/tools into one predictable scaffold hierarchy.
  - Routes: `/projects/:projectId/overview`, `/projects/:projectId/work/:paneId`, `/projects/:projectId/tools`
  - Files: `src/pages/ProjectSpacePage.tsx`, `src/components/project-space/OverviewView.tsx`, `src/components/project-space/WorkView.tsx`, `src/components/project-space/ToolsView.tsx`
  - Fix target: stable content slots, shared spacing/density, consistent heading levels.

- [ ] Resolve duplicate redirect component to a single canonical file.
  - Routes: `/projects/:projectId`
  - Files: `src/pages/ProjectRouteRedirectPage.tsx`, `src/components/auth/ProjectRouteRedirect.tsx`
  - Fix target: remove duplication and keep one redirect authority.

## P1: Forms and button hierarchy

- [ ] Replace raw buttons across panels with primitive `Button`/`IconButton` variants.
  - Routes/surfaces: Hub panels and profile/auth panels.
  - Files: `src/features/*.tsx`, `src/components/auth/ProfilePanel.tsx`, `src/pages/LoginPage.tsx`
  - Fix target: enforce primary/secondary/ghost/danger hierarchy globally.

- [ ] Introduce labeled field primitives and migrate owner governance forms.
  - Routes: `/` (Hub dashboard panel content)
  - Files: `src/features/ProjectCorePanel.tsx`, `src/components/primitives/Select.tsx`, new input/textarea primitives under `src/components/primitives`
  - Fix target: eliminate placeholder-only fields and improve SR/keyboard form navigation.

- [ ] Normalize filter controls under one primitive-based filter bar pattern.
  - Routes: project overview Timeline/Calendar/Tasks
  - Files: `src/components/project-space/FilterBarOverlay.tsx`, `src/components/project-space/FilterBar.tsx`, `src/components/project-space/CalendarTab.tsx`, `src/components/project-space/TasksTab.tsx`
  - Fix target: remove custom non-Radix overlay behavior and unify filter interactions.

## P2: Lists/feeds/empty states

- [ ] Add shared empty/loading/error state component pack and apply across pages/panels.
  - Routes: all routed pages, especially `/projects`, `/`, `/projects/:projectId/*`
  - Files: `src/components/layout/DataTable.tsx`, `src/pages/ProjectsPage.tsx`, `src/pages/ProjectSpacePage.tsx`, `src/features/*Panel.tsx`
  - Fix target: no blank table states; consistent skeleton/empty/error language.

- [ ] Unify event/list row contracts for timeline, activity, tasks, files, tools.
  - Routes: `/`, `/projects/:projectId/overview`, `/projects/:projectId/tools`
  - Files: `src/features/ActivityLogPanel.tsx`, `src/components/project-space/TimelineTab.tsx`, `src/features/TasksPanel.tsx`, `src/features/FilesPanel.tsx`, `src/components/project-space/ToolsView.tsx`
  - Fix target: single list/feed design language.

- [ ] Wire notes deep-link route to actual in-project notes workspace surface.
  - Routes: `/projects/:projectId/work?noteId=...`
  - Files: `src/features/NotesPanel.tsx`, `src/pages/ProjectRouteRedirectPage.tsx`, `src/components/project-space/WorkView.tsx`, `src/features/notes/*`
  - Fix target: make note deep-link contract real and testable.

## P3: Future surfaces (Kanban)

- [ ] Define board route contract and scaffold (future only).
  - Routes: future `/projects/:projectId/tasks/board` (or equivalent)
  - Files to plan: `src/App.tsx`, future project-space board components
  - Fix target: board information architecture approved before implementation.

- [ ] Design and spec bespoke Kanban components as future domain set.
  - Surfaces: project tasks board + optional global task board
  - Spec reference: `docs/ui/BESPOKE_COMPONENTS_NEEDED.md` section E
  - Fix target: avoid ad hoc board implementation and maintain primitive composition.

## Cross-cutting guardrails (applies to all priorities)

- [ ] Keep architecture boundary intact: no `src/components/ui/*` imports outside `src/components/primitives/*`.
- [ ] Remove raw Tailwind palette colors from product surfaces and map to semantic tokens.
  - Key files: `src/components/project-space/designTokens.ts`, `src/components/project-space/ModuleGrid.tsx`
- [ ] Resolve accessibility hotspots while unifying:
  - Form labels: `src/features/ProjectCorePanel.tsx`
  - Filter overlay semantics: `src/components/project-space/FilterBarOverlay.tsx`
  - Keyboard shortcut conflict: `src/components/project-space/PaneSwitcher.tsx`

