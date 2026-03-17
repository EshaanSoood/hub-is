# V1 Gaps and Fixes - Project Space Wireframe

This document captures the contract-validation gap pass results, with an explicit bias toward shipping core v1 behaviors now.

## Core Gaps That Must Be Addressed in v1 (No Deferral)

The following core gaps were identified and implemented during this pass.

| Core Gap | Proposed / Implemented UI Behavior | Components / States | Route Fit |
|---|---|---|---|
| Missing module lens switching control | Add first-class lens control per module card (`Project Lens` vs `Scratch Lens`) and persist lens in pane state | `ModuleLensControl`, `ModuleCard`; states: default/focus; variants: `project`, `pane_scratch` | `/projects/:projectId/work/:paneId` (Organization Area) |
| Calendar view lacked concrete user/category filters | Add Calendar filter shell with user + category selects and search, plus toolbar strip | `CalendarToolbar`, `CalendarFilterBar`, shared `FilterBar`; states: default/focus/disabled-ready | `/projects/:projectId/overview?view=calendar` |
| Tasks view lacked concrete user/category filters | Add Task list filter shell with user + category selects and search | `TaskListToolbar`, shared `FilterBar`; states: default/focus/disabled-ready | `/projects/:projectId/overview?view=tasks` |
| Pane mode toggles not user-configurable | Add pane settings toggles for Organization Area and Creative Workspace with contract guard (at least one region on) | `PaneRegionToggleGroup`; states: both-on/modules-only/workspace-only; disabled guard state | `/projects/:projectId/work/:paneId` (Pane Header Controls) |
| Focus visibility depended on generic browser defaults | Enforce tokenized focus ring globally so all interactive controls have visible focus | global `:focus-visible` token mapping via `--color-focus-ring` + `--shadow-focus-ring` | All routes |

## Additional Stability/Contract Integrity Fixes (CodeRabbit + Validation)

| Issue | Fix Implemented | Why It Matters |
|---|---|---|
| Potential ID collisions for panes/modules | Added `createUniquePaneId` and `getNextModuleSequence` | Prevents rendering bugs and stale targeting after delete/recreate flows |
| Stored module parsing accepted arbitrary `type` strings | Added runtime `validTypes` guard | Prevents invalid persisted state from corrupting module UI |
| Keyboard tab-roving logic duplicated | Shared helper `handleRovingTabKeyDown` used by top tabs and overview sub-tabs | Reduces drift and inconsistent keyboard behavior |
| Existing screens still referenced `bg-info-subtle` and `bg-success-subtle` | Restored safelist classes and token aliases for compatibility | Prevents style regressions outside new wireframe screens |
| Duplicate font import + CSS import ordering issue | Removed duplicate import, corrected import order in `tokens.css` | Keeps CSS valid and avoids redundant network requests |

## Non-core Nice-to-Haves (Explicitly Deferred)

| Nice-to-have | Why Non-core for v1 | Suggested Follow-up |
|---|---|---|
| Real drag-and-drop pane reordering | Current up/down controls satisfy reorder requirement and accessibility | Add pointer DnD with keyboard parity in v1.1 |
| Persisted filter presets per user | Filter shells are present and visible/testable now | Add saved filter profiles in v1.1 |
| Rich module dialogs per module type | Focus mode behavior contract already met with generic dialog shell | Layer module-type actions once backend contracts are stable |
| Full realtime multi-user pane sync | v1 wireframe demonstrates shared-state model and constraints | Integrate collaboration transport/store after UI contract freeze |
| Tooltip/popover/toast runtime implementation | Documented in taxonomy, not needed for contract validity | Introduce with design system unification phase |

## Implementation Order (Smallest-to-Largest Risk)

1. Normalize tokens and focus-ring primitives (low risk, global consistency).
2. Fix CSS import ordering and duplicate font import (low risk, deterministic).
3. Restore compatibility safelist/tokens for existing `info/success` usages (low risk, regression prevention).
4. Add runtime module type validation for stored panes (low-medium risk).
5. Make pane and module ID generation collision-safe (medium risk, state integrity).
6. Extract shared tab keyboard-nav helper and wire into both tablists (medium risk, accessibility).
7. Implement module lens control and state updates in Work modules (medium risk, core behavior).
8. Add pane region toggles with guard for modules-only/workspace-only modes (medium-high risk due state transitions).
9. Add Calendar and Tasks filter bars/toolbars in Overview (medium-high risk due component expansion).
10. Run full validation sweep (`typecheck`, `dev smoke-check`, `build`) and update contract report docs (final verification).
