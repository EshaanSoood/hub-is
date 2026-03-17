# Architecture Guard Report

Scope: full repo scan for illegal imports from `/src/components/ui` outside `/src/components/primitives`.

## Guard Rule
- Allowed: imports from `/src/components/ui/**` inside `/src/components/primitives/**` only.
- Disallowed: any non-primitives import from `/src/components/ui/**` or equivalent relative paths.

## Scan Patterns Used
- `@/components/ui`
- `../ui`
- `../../ui`
- `/src/components/ui`

Command used:
```bash
rg -n "@/components/ui|\.\./\.\./ui|\.\./ui|/src/components/ui" src -g '*.{ts,tsx}' | rg -v '^src/components/primitives/' || true
```

## Result
- Violations found: `0`
- Files fixed: `0`
- Final state: `PASS`

## Alignment changes applied in this pass
1. Canonical project route redirect now uses `ProjectRouteRedirect` to preserve query params and route `noteId` links into Work.
2. `NotesPanel` deep links now target `/projects/:projectId/work?noteId=...`.
3. `policy.ts` project tab model now matches routed UX (`overview/work/tools`) and includes legacy-to-canonical mapping helpers.
4. Removed legacy duplicate files from `/src/components/ui`:
   - `AccessibleDialog.tsx`
   - `LiveRegion.tsx`
   (Radix-first behavior continues via primitive wrappers.)

## Remaining discrepancy status
- No import-boundary discrepancies.
- No route/tab-model contradictions between canonical Project Space routes and policy tab definitions.

## Related guard alignment
- `check:layout-primitives` now aligns with the same contract split:
  - Non-project pages must consume `/src/components/layout/*`.
  - `ProjectSpacePage` is validated as canonical Overview/Work/Tools composition and is no longer treated as a legacy layout-import exception.
