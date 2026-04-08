# Phase 8a: TableModuleSkin split

## Branch
phase8a-table

## Files created
- src/components/project-space/TableModuleSkin/SortableHeaderCell.tsx
- src/components/project-space/TableModuleSkin/TableCell.tsx
- src/components/project-space/TableModuleSkin/TableCreateRow.tsx
- src/components/project-space/TableModuleSkin/TableHeader.tsx
- src/components/project-space/TableModuleSkin/TableRow.tsx
- src/components/project-space/TableModuleSkin/hooks/useTableBulkActions.ts
- src/components/project-space/TableModuleSkin/hooks/useTableCreateRow.ts
- src/components/project-space/TableModuleSkin/hooks/useTableDragReorder.ts
- src/components/project-space/TableModuleSkin/hooks/useTableFiltering.ts
- src/components/project-space/TableModuleSkin/hooks/useTableInlineEditing.ts
- src/components/project-space/TableModuleSkin/hooks/useTableKeyboardGrid.ts
- src/components/project-space/TableModuleSkin/hooks/useTableSorting.ts
- src/components/project-space/TableModuleSkin/types.ts
- src/components/project-space/TableModuleSkin/valueNormalization.ts

## Files renamed (git mv)
- src/components/project-space/TableModuleSkin.tsx → src/components/project-space/TableModuleSkin/index.tsx

## Line counts
- Before: TableModuleSkin.tsx = 1478 lines
- After: TableModuleSkin/index.tsx = 509 lines
- Other new files: (name = lines, one per line)
SortableHeaderCell.tsx = 96
TableCell.tsx = 75
TableCreateRow.tsx = 118
TableHeader.tsx = 248
TableRow.tsx = 65
types.ts = 62
valueNormalization.ts = 267
useTableBulkActions.ts = 124
useTableCreateRow.ts = 76
useTableDragReorder.ts = 84
useTableFiltering.ts = 82
useTableInlineEditing.ts = 100
useTableKeyboardGrid.ts = 67
useTableSorting.ts = 12

## Hooks extracted
- useTableFiltering: Owns filter panel state, active filter bookkeeping, and filtered-row derivation.
- useTableSorting: Owns TanStack sorting state used by the table instance.
- useTableDragReorder: Owns column drag sensors, column-order state, and drag/drop reorder handlers.
- useTableInlineEditing: Owns editable-cell state and submit/blur/key handlers for commit/cancel behavior.
- useTableBulkActions: Owns selection state, bulk delete flow, and bulk status update flow.
- useTableKeyboardGrid: Owns keyboard row navigation behavior (arrows/home/end/enter/space).
- useTableCreateRow: Owns create-row form state and submit flow (kept with extracted hooks for composition clarity).

## Components extracted
- SortableHeaderCell: Renders one draggable/resizable/sortable column header cell.
- TableHeader: Renders bulk actions bar, filter controls, and the DnD-enabled header row grid.
- TableRow: Renders one virtualized grid row container and delegates per-cell rendering.
- TableCell: Renders each grid cell, including inline edit controls for active editable cells.
- TableCreateRow: Renders the sticky create-row composer aligned to visible columns.

## Utilities extracted
- valueNormalization.ts: Centralizes record value normalization/parsing, date preset matching, display formatting, and field input conversion.
- types.ts: Centralizes table-local interfaces/types previously in the monolithic file.

## Decisions and deviations
- Added `types.ts`, `SortableHeaderCell.tsx`, `TableCreateRow.tsx`, and `useTableCreateRow.ts` as additional seams because they reduced index composition complexity without changing behavior.
- Kept virtualization setup (`useVirtualizer`, scroll element resolution, template column sizing) in `index.tsx` because it is tightly coupled to rendered layout and refs.
- Kept table column definitions in `index.tsx` because they thread together multiple extracted hooks/components and are still a central composition seam.

## Verification
- npm run typecheck: ✅
- npm run lint: ✅ (warnings present, including existing `react-hooks/exhaustive-deps` warnings and one `react-hooks/incompatible-library` warning at `useReactTable`)
- npm run validate: ✅
- npm run build: ✅

## Risks / things a reviewer should look at carefully
- Inline edit blur/escape sequencing now crosses `useTableInlineEditing` + `TableCell`, so reviewer should sanity-check commit/cancel behavior on select/date/number/title cells.
- Column selection/filters/drag order now cross multiple hooks and components; reviewer should spot-check interactions when schema fields are added/removed.
- Virtualized row keyboard navigation now crosses `useTableKeyboardGrid` + `TableRow`; reviewer should verify focus movement and open-on-enter behavior across large datasets.

## Confirmation
- src/features/notes/ untouched: ✅
- No new npm packages: ✅
- No inline styles introduced: ✅
