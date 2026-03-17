# Checks Re-Audit

Date: 2026-03-04
Workspace: `<repo-root>`
Scope: `npm run lint`, `npm run check:layout-primitives`, and baseline `npm run typecheck`.

## Phase 0 Baseline (No code changes)

### Command: `npm run lint`
- Exit: `1`
- Summary: `16 problems (15 errors, 1 warning)`.
- Key output paths/rules:
  - `scripts/check-authz-runtime.mjs` (`no-undef`: `AbortController`)
  - `scripts/check-collab-preflight.mjs` (`no-undef`: `AbortController`)
  - `scripts/check-collab-ws-live.mjs` (`no-undef`: `AbortController`)
  - `scripts/check-hub-policy-live.mjs` (`no-undef`: `AbortController` x2)
  - `src/components/project-space/ModuleLensControl.tsx` (`jsx-a11y/label-has-associated-control`)
  - `src/components/project-space/WorkView.tsx` (`react-hooks/set-state-in-effect` x2)
  - `src/pages/ProjectSpacePage.tsx` (`react-hooks/set-state-in-effect` x3, `react-hooks/exhaustive-deps` warning x1)
  - `src/lib/calendar-nlp/passes/titlePass.ts` (`no-useless-escape`, `prefer-const`)
  - `src/lib/calendar-nlp/types.ts` (`@typescript-eslint/no-explicit-any`)
  - `src/lib/calendar-nlp/utils.ts` (`@typescript-eslint/no-unused-vars`)

### Command: `npm run check:layout-primitives`
- Exit: `1`
- Exact output:
  - `Every page must use layout primitives. Missing imports in:`
  - `- ProjectSpacePage.tsx`

### Command: `npm run typecheck` (optional baseline)
- Exit: `0`
- Output: `tsc --noEmit` passed.

## Baseline Failure Counts

### By lint rule/category
- `no-undef` (`AbortController` in scripts): 5 errors
- `react-hooks/set-state-in-effect`: 5 errors
- `jsx-a11y/label-has-associated-control`: 1 error
- `no-useless-escape`: 1 error
- `prefer-const`: 1 error
- `@typescript-eslint/no-explicit-any`: 1 error
- `@typescript-eslint/no-unused-vars`: 1 error
- `react-hooks/exhaustive-deps`: 1 warning
- `check:layout-primitives` contract failure: 1 error case

### By re-audit classification
- Spec Drift: 6 (5 `AbortController` lint + 1 outdated layout check behavior)
- Regression: 7 (a11y label + React effect-state violations + hook dependency warning)
- Overlap/WIP artifact: 4 (calendar NLP lint hygiene issues outside Project Space scope)

## Failure Table

| Failure | File | Category (Regression / Spec Drift / Overlap) | Proposed action |
|---|---|---|---|
| `AbortController` flagged as undefined in Node scripts | `scripts/check-authz-runtime.mjs`, `scripts/check-collab-preflight.mjs`, `scripts/check-collab-ws-live.mjs`, `scripts/check-hub-policy-live.mjs` | Spec Drift | Update ESLint scripts globals to include modern Node runtime global (`AbortController`). |
| `check:layout-primitives` rejects `ProjectSpacePage.tsx` | `scripts/check-layout-primitives.mjs`, `src/pages/ProjectSpacePage.tsx` | Spec Drift | Replace old “every page imports `components/layout`” rule with current contract guard (ProjectSpace canonical exception + primitives boundary). |
| Label association violation on module lens control | `src/components/project-space/ModuleLensControl.tsx` | Regression | Replace invalid `<label>` wrapper with semantic non-label container and explicit `ariaLabel` on select trigger. |
| Effect-driven state writes in Work surface | `src/components/project-space/WorkView.tsx` | Regression | Remove effect-based resets; use deterministic state initialization and keyed remount behavior from parent. |
| Effect-driven state writes and hook dependency warning in Project Space route controller | `src/pages/ProjectSpacePage.tsx` | Regression | Refactor to keyed workspace component with lazy state hydration from localStorage, persist-only effects, and no setState-in-effect calls. |
| Minor parser lint hygiene issues | `src/lib/calendar-nlp/passes/titlePass.ts`, `src/lib/calendar-nlp/types.ts`, `src/lib/calendar-nlp/utils.ts` | Overlap | Apply minimal non-functional lint fixes (`const`, regex cleanup, `unknown`, consume unused arg). |

## Phase 1 Rule Re-Audit: `check:layout-primitives`

### Rule source located
- Script entry in `package.json`: `"check:layout-primitives": "node scripts/check-layout-primitives.mjs"`
- Implementation: `scripts/check-layout-primitives.mjs`

### What the old rule enforced
- Hardcoded allowlist under `/src/components/layout`.
- Required every page in `/src/pages` to import `components/layout/*`.
- Did not account for canonical `ProjectSpacePage` composition model.

### Current contract (verified against docs + code)
- Canonical project UX is `ProjectSpacePage` with top-level sections `Overview`, `Work`, `Tools`.
- Design-system boundary is primitives-first:
  - `/src/components/ui/*` engines are only consumed by `/src/components/primitives/*` wrappers.
  - App/page code should consume `/src/components/primitives/*` or bespoke wrappers/components.
- Shared app layout primitives in `/src/components/layout/*` remain required for non-project route pages.

### Updated guard behavior (implemented)
- Keep strict allowlist for `/src/components/layout/*` files.
- For pages in `/src/pages`:
  - Non-project pages must import from `components/layout/*`.
  - `ProjectSpacePage.tsx` is a canonical exception and must include project-space contract imports:
    - `TopNavTabs`, `OverviewView`, `WorkView`, `ToolsView`.
  - `ProjectSpacePage.tsx` must contain canonical tab identifiers: `overview`, `work`, `tools`.
- Added page-level ban: pages must not import `components/ui/*` directly.

### Related docs updated
- `docs/ui/UI_CONTRACTS.md`:
  - Added explicit page-level layout contract split (non-project pages use `components/layout`; `ProjectSpacePage` is canonical exception).
- `docs/ui/ARCHITECTURE_GUARD_REPORT.md`:
  - Added alignment note that `check:layout-primitives` now matches canonical Project Space contract.

## Post-fix Verification

### Command: `npm run lint`
- Exit: `0`
- Result: pass.

### Command: `npm run check:layout-primitives`
- Exit: `0`
- Output: `Layout primitive check passed.`

### Command: `npm run typecheck`
- Exit: `0`
- Result: pass.

## Final status
- Re-audit complete.
- Old-spec `check:layout-primitives` behavior replaced with current architecture guard equivalent (not disabled).
- Lint baseline regressions and overlap artifacts resolved without adding product features.
