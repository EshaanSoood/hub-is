# PHASE8F_SUMMARY

## Branch
- `phase8f-viewsruntime`

## Pre-flight
- Confirmed `src/hooks/useProjectViewsRuntime.ts` exists.
- Current line count before refactor: `896` lines (newer than the ~816 estimate in the prompt).
- Set up requested worktree and dependencies:
  - `git worktree add ../phase8f-viewsruntime -b phase8f-viewsruntime main`
  - `cd ../phase8f-viewsruntime`
  - `npm install`

## Split Result
Refactored `useProjectViewsRuntime` into focused hooks with a thin orchestration layer and no consumer API changes.

### New hooks
- `src/hooks/useProjectCollectionsRuntime.ts`
  - collections state + collection loading/warm-up.
- `src/hooks/useProjectViewsRegistry.ts`
  - views registry state, selected embed view state, focused work view selection.
- `src/hooks/useProjectTableRuntime.ts`
  - table runtime state loading and table mutation handlers.
- `src/hooks/useProjectKanbanRuntime.ts`
  - kanban runtime state loading and kanban mutation handlers.
- `src/hooks/useProjectFocusedViewLoader.ts`
  - focused work-view loading lifecycle and cache-aware behavior.

### Shared runtime helpers
- `src/hooks/projectViewsRuntime/shared.ts`
  - extracted shared types/constants and helpers (`loadCompleteViewQuery`, `buildKanbanRuntime`, kanban/table runtime types, etc.).

### Aggregator
- `src/hooks/useProjectViewsRuntime.ts`
  - now a thin aggregator/orchestrator.
  - current line count: `198` lines (under 200 target).
  - keeps the same returned shape used by `ProjectSpaceWorkspace` and `useWorkViewModuleRuntime` paths.

## Interface Stability
- Preserved the external return contract from `useProjectViewsRuntime` (state fields, handlers, and derived `tableViews`/`kanbanViews` + runtime maps).
- No consumer updates were required.

## Verification
- `npm run typecheck` ✅
- `npm run lint` ✅ (existing repo warnings remain in unrelated files; no new lint errors)
- `npm run build` ✅

## Commit
- Commit message used: `Phase 8f: split useProjectViewsRuntime into focused hooks`
