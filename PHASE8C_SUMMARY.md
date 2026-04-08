# Phase 8c Summary

## Branch
- `phase8c-calendar`

## Pre-flight
- Confirmed `src/components/project-space/CalendarModuleSkin/` is a folder.
- Confirmed Phase 2 output exists:
  - `src/components/project-space/CalendarModuleSkin/index.tsx`
  - `src/components/project-space/CalendarModuleSkin/CalendarMediumWeekStrip.tsx`

## What Changed

### Added files
- `src/components/project-space/CalendarModuleSkin/CalendarSmallView.tsx`
  - Extracted small-tier compact day summary rendering.
- `src/components/project-space/CalendarModuleSkin/CalendarLargeView.tsx`
  - Extracted large-tier rendering (scope + month/year/week/day surfaces, including month overflow popover behavior).
- `src/components/project-space/CalendarModuleSkin/CalendarCreatePanel.tsx`
  - Extracted inline create-event panel UI.
- `src/components/project-space/CalendarModuleSkin/hooks/useCalendarCreatePanel.ts`
  - Extracted create-panel state, draft/form handlers, validation, and submit flow.
- `src/components/project-space/CalendarModuleSkin/hooks/useCalendarTierSelection.ts`
  - Extracted size-tier-to-render-tier selection logic.
- `src/components/project-space/CalendarModuleSkin/types.ts`
  - Centralized module types/contracts shared across split files.
- `src/components/project-space/CalendarModuleSkin/utils.ts`
  - Centralized calendar utility/date helper logic used across tiers.

### Updated files
- `src/components/project-space/CalendarModuleSkin/index.tsx`
  - Reduced to thin composition/orchestration layer.
  - Retains shared cross-tier state and wiring.
  - Chooses tier via `useCalendarTierSelection` and renders:
    - `CalendarSmallView` for S
    - Existing medium composition (`CalendarMediumWeekStrip`) for M
    - `CalendarLargeView` for L/default
  - Wires extracted create-panel hook + component.
  - Line count now in requested range (`230` lines).

## Behavior Notes
- Event rendering logic was relocated, not redesigned.
- Existing `CalendarMediumWeekStrip.tsx` was left unchanged.
- Small tier continues using `<EventCard>` exactly as before.
- Large-tier `view` and `monthCursor` state remain owned by `index.tsx` so cross-tier behavior stays aligned with prior implementation.

## Verification
- `npx eslint src/components/project-space/CalendarModuleSkin/index.tsx src/components/project-space/CalendarModuleSkin/CalendarLargeView.tsx src/components/project-space/CalendarModuleSkin/CalendarSmallView.tsx src/components/project-space/CalendarModuleSkin/CalendarCreatePanel.tsx src/components/project-space/CalendarModuleSkin/hooks/useCalendarCreatePanel.ts src/components/project-space/CalendarModuleSkin/hooks/useCalendarTierSelection.ts src/components/project-space/CalendarModuleSkin/types.ts src/components/project-space/CalendarModuleSkin/utils.ts`
- `npm run typecheck`

## Commit
- `Phase 8c: split CalendarModuleSkin tiers into focused files`
