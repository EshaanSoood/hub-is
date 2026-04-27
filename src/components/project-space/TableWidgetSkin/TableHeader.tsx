import { type ComponentProps, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { flexRender, type Header, type Table } from '@tanstack/react-table';
import { cn } from '../../../lib/cn';
import { Icon } from '../../primitives';
import { SortableHeaderCell } from './SortableHeaderCell';
import type { TableField, TableOption, TableRowData } from './types';
import { DATE_FILTER_OPTIONS, readFieldOptions } from './valueNormalization';

interface TableHeaderProps {
  table: Table<TableRowData>;
  templateColumns: string;
  sensors: ComponentProps<typeof DndContext>['sensors'];
  onHeaderDragEnd: (event: DragEndEvent) => void;
  fieldColumnOrder: string[];
  canReorderColumns: boolean;
  readOnly: boolean;
  previewMode?: boolean;
  onResizeKeyDown: (event: ReactKeyboardEvent<HTMLElement>, header: Header<TableRowData, unknown>) => void;
  selectedRecordIds: Set<string>;
  clearSelection: () => void;
  bulkDeleteConfirm: boolean;
  setBulkDeleteConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  bulkActionPending: boolean;
  bulkActionError: string | null;
  setBulkActionError: React.Dispatch<React.SetStateAction<string | null>>;
  onDeleteRecords?: (recordIds: string[]) => Promise<void>;
  runBulkDelete: () => Promise<void>;
  onBulkUpdateRecords?: (recordIds: string[], fields: Record<string, unknown>) => Promise<void>;
  statusField: TableField | null;
  statusOptions: TableOption[];
  runBulkStatusUpdate: (value: string) => Promise<void>;
  filterableFields: TableField[];
  activeFilters: Record<string, string>;
  setActiveFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  filtersOpen: boolean;
  setFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

export const TableHeader = ({
  table,
  templateColumns,
  sensors,
  onHeaderDragEnd,
  fieldColumnOrder,
  canReorderColumns,
  readOnly,
  previewMode = false,
  onResizeKeyDown,
  selectedRecordIds,
  clearSelection,
  bulkDeleteConfirm,
  setBulkDeleteConfirm,
  bulkActionPending,
  bulkActionError,
  setBulkActionError,
  onDeleteRecords,
  runBulkDelete,
  onBulkUpdateRecords,
  statusField,
  statusOptions,
  runBulkStatusUpdate,
  filterableFields,
  activeFilters,
  setActiveFilters,
  filtersOpen,
  setFiltersOpen,
  hasActiveFilters,
  activeFilterCount,
}: TableHeaderProps) => {
  return (
    <div className="sticky top-0 z-10 bg-surface-low">
      {selectedRecordIds.size > 0 && !previewMode ? (
        <div className="widget-rule px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-text">{selectedRecordIds.size} selected</span>
            <button
              type="button"
              onClick={clearSelection}
              className="ghost-button bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              Deselect all
            </button>
            {onDeleteRecords ? (
              bulkDeleteConfirm ? (
                <>
                  <span className="text-xs text-danger">Delete selected records?</span>
                  <button
                    type="button"
                    onClick={runBulkDelete}
                    disabled={bulkActionPending}
                    className="rounded-control border border-danger bg-danger px-2 py-1 text-xs font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkDeleteConfirm(false)}
                    disabled={bulkActionPending}
                    className="ghost-button bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBulkDeleteConfirm(true);
                    setBulkActionError(null);
                  }}
                  className="ghost-button bg-surface px-2 py-1 text-xs font-medium text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  Delete
                </button>
              )
            ) : null}
            {onBulkUpdateRecords && statusField && statusOptions.length > 0 ? (
              <label className="ml-auto flex items-center gap-2 text-xs text-muted">
                <span>Set status</span>
                <select
                  defaultValue=""
                  onChange={(event) => {
                    const selectEl = event.currentTarget;
                    const value = selectEl.value;
                    void runBulkStatusUpdate(value).finally(() => {
                      selectEl.value = '';
                    });
                  }}
                  disabled={bulkActionPending}
                  className="ghost-button bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select</option>
                  {statusOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {bulkActionError ? (
            <p className="mt-2 text-xs text-danger" role="alert" aria-live="polite">
              {bulkActionError}
            </p>
          ) : null}
        </div>
      ) : null}

      {filterableFields.length > 0 && !previewMode ? (
        <div className="widget-rule px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
              className="ghost-button inline-flex items-center gap-2 bg-surface px-2 py-1 text-xs font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <Icon name="chevron-down" className={cn('h-3.5 w-3.5 transition-transform', filtersOpen && 'rotate-180')} />
              <span>Filter</span>
            </button>
            {hasActiveFilters ? (
              <>
                <span className="rounded-control border border-border-muted bg-surface px-2 py-1 text-[11px] font-medium text-text">
                  Active filters {activeFilterCount}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveFilters({})}
                  className="text-xs font-medium text-primary underline underline-offset-2 hover:text-primary-strong"
                >
                  Clear all
                </button>
              </>
            ) : null}
          </div>

          {filtersOpen ? (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              {filterableFields.map((field) => {
                const options = field.type === 'select' ? readFieldOptions(field.config) : DATE_FILTER_OPTIONS;

                return (
                  <label key={field.field_id} className="block text-[11px] text-muted">
                    {field.name}
                    <select
                      value={activeFilters[field.field_id] ?? ''}
                      onChange={(event) =>
                        setActiveFilters((current) => ({
                          ...current,
                          [field.field_id]: event.target.value,
                        }))
                      }
                      className="mt-1 rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <option value="">All</option>
                      {options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onHeaderDragEnd}>
        {table.getHeaderGroups().map((group) => (
          <div key={group.id} role="row" className="grid" style={{ gridTemplateColumns: templateColumns }}>
            <SortableContext items={fieldColumnOrder} strategy={horizontalListSortingStrategy}>
              {group.headers.map((header) => {
                const isSelectionColumn = header.column.id === 'select';
                const isTitleColumn = header.column.id === 'title';

                if (isSelectionColumn) {
                  return (
                    <div
                      key={header.id}
                      role="columnheader"
                      className="min-w-0 border-r border-border-muted/50 px-3 py-2 text-left last:border-r-0"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </div>
                  );
                }

                return (
                  <SortableHeaderCell
                    key={header.id}
                    header={header}
                    isReorderable={!isTitleColumn && canReorderColumns}
                    dragDisabled={readOnly}
                    previewMode={previewMode}
                    onResizeKeyDown={onResizeKeyDown}
                  />
                );
              })}
            </SortableContext>
          </div>
        ))}
      </DndContext>
    </div>
  );
};
