import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type Header } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../../../lib/cn';
import { Checkbox } from '../../primitives';
import { ModuleEmptyState, ModuleLoadingState } from '../ModuleFeedback';
import { TableCreateRow } from './TableCreateRow';
import { TableHeader } from './TableHeader';
import { TableRow } from './TableRow';
import { useTableBulkActions } from './hooks/useTableBulkActions';
import { useTableCreateRow } from './hooks/useTableCreateRow';
import { useTableDragReorder } from './hooks/useTableDragReorder';
import { useTableFiltering } from './hooks/useTableFiltering';
import { useTableInlineEditing } from './hooks/useTableInlineEditing';
import { useTableKeyboardGrid } from './hooks/useTableKeyboardGrid';
import { useTableSorting } from './hooks/useTableSorting';
import type { TableField, TableModuleSkinProps, TableRowData } from './types';
import {
  formatDisplayValue,
  getEditableFieldValue,
  getFieldColumnSizing,
  isFreeformTextField,
  isNotesField,
  toComparable,
} from './valueNormalization';

export const TableModuleSkin = ({
  sizeTier = 'M',
  schema,
  records,
  loading,
  readOnly = false,
  availableViews,
  onOpenRecord,
  onCreateRecord,
  onSelectView,
  onCreateView,
  onUpdateRecord,
  onDeleteRecords,
  onBulkUpdateRecords,
}: TableModuleSkinProps) => {
  const canCreate = !readOnly && typeof onCreateRecord === 'function';
  const canEditCells = !readOnly && typeof onUpdateRecord === 'function';
  const showBulkSelection = !readOnly && (typeof onDeleteRecords === 'function' || typeof onBulkUpdateRecords === 'function');

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const createTitleInputRef = useRef<HTMLInputElement | null>(null);
  const viewSelectRef = useRef<HTMLSelectElement | null>(null);
  const [selectedViewId, setSelectedViewId] = useState('');

  const rows = useMemo<TableRowData[]>(
    () =>
      records.map((record) => ({
        recordId: record.record_id,
        title: record.title,
        fields: record.fields,
      })),
    [records],
  );

  const fieldById = useMemo(() => new Map((schema?.fields ?? []).map((field) => [field.field_id, field])), [schema?.fields]);

  const { sorting, setSorting } = useTableSorting();
  const {
    sensors,
    fieldColumnOrder,
    setFieldColumnOrder,
    canReorderColumns,
    columnOrder,
    handleColumnOrderChange,
    handleHeaderDragEnd,
  } = useTableDragReorder(showBulkSelection, readOnly);

  const {
    activeFilters,
    setActiveFilters,
    filtersOpen,
    setFiltersOpen,
    filteredRows,
    hasActiveFilters,
    activeFilterCount,
    filterableFields,
    statusField,
    statusOptions,
  } = useTableFiltering(schema, rows);

  const {
    selectedRecordIds,
    setSelectedRecordIds,
    toggleSelectedRecord,
    allVisibleSelected,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    bulkActionError,
    setBulkActionError,
    bulkActionPending,
    clearSelection,
    runBulkDelete,
    runBulkStatusUpdate,
  } = useTableBulkActions({
    filteredRows,
    statusField,
    onDeleteRecords,
    onBulkUpdateRecords,
  });

  const { editableCell, setEditableCell, handleEditableCellBlur, handleEditableCellKeyDown } = useTableInlineEditing({
    fieldById,
    onUpdateRecord,
  });

  const { createRow, setCreateRow, submitCreateRow } = useTableCreateRow({
    fieldById,
    createTitleInputRef,
    onCreateRecord,
  });

  useEffect(() => {
    const nextFieldIds = schema?.fields.map((field) => field.field_id) ?? [];
    setFieldColumnOrder((current) => {
      const kept = current.filter((fieldId) => nextFieldIds.includes(fieldId));
      const missing = nextFieldIds.filter((fieldId) => !kept.includes(fieldId));
      return [...kept, ...missing];
    });
    setActiveFilters((current) => {
      const allowed = new Set(nextFieldIds);
      const next = Object.fromEntries(Object.entries(current).filter(([fieldId]) => allowed.has(fieldId)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [schema?.fields, setActiveFilters, setFieldColumnOrder]);

  const renderDisplayCell = useCallback(
    (row: TableRowData, field: TableField | null) => {
      if (!field) {
        if (canEditCells) {
          return (
            <button
              type="button"
              className="block w-full min-w-0 max-w-full truncate text-left font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => onOpenRecord(row.recordId)}
              onDoubleClick={() =>
                setEditableCell({
                  recordId: row.recordId,
                  fieldId: 'title',
                  value: row.title,
                  baseline: row.title,
                  error: null,
                })
              }
              aria-label={`Open record ${row.title}`}
              data-testid={`open-record-button-${row.recordId}`}
              title={row.title}
            >
              {row.title}
            </button>
          );
        }

        return (
          <button
            type="button"
            className="block w-full min-w-0 max-w-full truncate text-left font-semibold text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            onClick={() => onOpenRecord(row.recordId)}
            aria-label={`Open record ${row.title}`}
            data-testid={`open-record-button-${row.recordId}`}
            title={row.title}
          >
            {row.title}
          </button>
        );
      }

      const displayValue = formatDisplayValue(field, row.fields[field.field_id]);
      const displayLabel = displayValue || '—';
      const textTitle = displayValue || undefined;
      const textClassName = cn(
        'block max-w-full truncate text-[13px] font-normal text-text-secondary',
        sizeTier === 'L' && isNotesField(field) && 'max-w-[200px]',
      );

      if (canEditCells) {
        return (
          <button
            type="button"
            className="w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            onClick={() =>
              setEditableCell({
                recordId: row.recordId,
                fieldId: field.field_id,
                value: getEditableFieldValue(field, row.fields[field.field_id]),
                baseline: getEditableFieldValue(field, row.fields[field.field_id]),
                error: null,
              })
            }
            aria-label={`Edit ${field.name} for ${row.title}`}
          >
            <span
              className={isFreeformTextField(field) ? textClassName : 'block max-w-full truncate text-[13px] font-normal text-text-secondary'}
              title={textTitle}
            >
              {displayLabel}
            </span>
          </button>
        );
      }

      return (
        <span
          className={isFreeformTextField(field) ? textClassName : 'block max-w-full truncate text-[13px] font-normal text-text-secondary'}
          title={textTitle}
        >
          {displayLabel}
        </span>
      );
    },
    [canEditCells, onOpenRecord, setEditableCell, sizeTier],
  );

  const columns = useMemo<ColumnDef<TableRowData>[]>(() => {
    const fieldColumns = (schema?.fields ?? []).map(
      (field): ColumnDef<TableRowData> => ({
        id: field.field_id,
        accessorFn: (row) => row.fields[field.field_id],
        header: field.name,
        ...getFieldColumnSizing(field, sizeTier),
        sortingFn: (rowA, rowB, columnId) => {
          const left = toComparable(rowA.getValue(columnId), field.type);
          const right = toComparable(rowB.getValue(columnId), field.type);
          if (left === right) {
            return 0;
          }
          return left > right ? 1 : -1;
        },
        cell: ({ row }) => renderDisplayCell(row.original, field),
      }),
    );

    return [
      ...(showBulkSelection
        ? [
            {
              id: 'select',
              size: 40,
              minSize: 40,
              maxSize: 40,
              enableSorting: false,
              enableResizing: false,
              header: () => (
                <div className="flex justify-center">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => {
                      setSelectedRecordIds(checked ? new Set(filteredRows.map((row) => row.recordId)) : new Set());
                      setBulkDeleteConfirm(false);
                      setBulkActionError(null);
                    }}
                    aria-label="Select all rows"
                  />
                </div>
              ),
              cell: ({ row }) => (
                <div className="flex justify-center">
                  <Checkbox
                    checked={selectedRecordIds.has(row.original.recordId)}
                    onCheckedChange={(checked) => toggleSelectedRecord(row.original.recordId, checked)}
                    aria-label={`Select ${row.original.title}`}
                  />
                </div>
              ),
            } satisfies ColumnDef<TableRowData>,
          ]
        : []),
      {
        id: 'title',
        accessorFn: (row) => row.title,
        header: 'Title',
        size: 256,
        minSize: 180,
        cell: ({ row }) => renderDisplayCell(row.original, null),
      },
      ...fieldColumns,
    ];
  }, [
    allVisibleSelected,
    filteredRows,
    renderDisplayCell,
    schema?.fields,
    selectedRecordIds,
    setBulkActionError,
    setBulkDeleteConfirm,
    setSelectedRecordIds,
    showBulkSelection,
    sizeTier,
    toggleSelectedRecord,
  ]);

  const table = useReactTable<TableRowData>({
    data: filteredRows,
    columns,
    state: { sorting, columnOrder },
    onSortingChange: setSorting,
    onColumnOrderChange: handleColumnOrderChange,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: {
      minSize: 120,
      size: 160,
    },
    getRowId: (row) => row.recordId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const modelRows = table.getRowModel().rows;

  const getScrollElement = useCallback(() => {
    const node = scrollRef.current;
    if (!node) {
      return null;
    }
    return (node.closest('[data-module-card-body="true"]') as HTMLDivElement | null) ?? node;
  }, []);

  const virtualizer = useVirtualizer({
    count: modelRows.length,
    getScrollElement,
    estimateSize: () => 44,
    overscan: 8,
  });

  const templateColumns = table.getVisibleLeafColumns().map((column) => `${column.getSize()}px`).join(' ');

  const { handleRowKeyDown } = useTableKeyboardGrid({
    modelRowsLength: modelRows.length,
    rowRefs,
    scrollToIndex: (index) => virtualizer.scrollToIndex(index, { align: 'auto' }),
    onOpenRecord,
  });

  const handleResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, header: Header<TableRowData, unknown>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 20 : -20;
      const nextWidth = Math.max(header.column.columnDef.minSize ?? 80, header.column.getSize() + delta);
      table.setColumnSizing((current) => ({
        ...current,
        [header.column.id]: nextWidth,
      }));
    },
    [table],
  );

  if (loading) {
    return <ModuleLoadingState label="Loading table records" rows={6} />;
  }

  if (!schema) {
    const canSelectView = Boolean(availableViews?.length && onSelectView);

    if (!canSelectView) {
      return <ModuleEmptyState title="No table view found yet." iconName="table" description="Table For Two?" sizeTier={sizeTier} />;
    }

    return (
      <div className="space-y-3">
        <ModuleEmptyState
          title="No table view found yet."
          iconName="table"
          description="Table For Two?"
          ctaLabel="Select table view"
          onCta={() => viewSelectRef.current?.focus()}
          sizeTier={sizeTier}
        />
        <div className="mx-auto max-w-sm space-y-2">
          <label className="block text-sm text-text">
            Table view
            <select
              ref={viewSelectRef}
              value={selectedViewId}
              onChange={(event) => {
                const nextViewId = event.target.value;
                setSelectedViewId(nextViewId);
                if (nextViewId) {
                  onSelectView?.(nextViewId);
                }
              }}
              className="mt-2 w-full rounded-control border border-border-muted bg-surface px-2 py-1 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <option value="">Select a view</option>
              {availableViews?.map((view) => (
                <option key={view.view_id} value={view.view_id}>
                  {view.name}
                </option>
              ))}
            </select>
          </label>
          {onCreateView ? (
            <button
              type="button"
              onClick={onCreateView}
              className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary-strong"
            >
              Create table view
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const createRowVisibleColumns = table.getVisibleLeafColumns();
  const isEmpty = modelRows.length === 0;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-panel border border-border-muted bg-surface-elevated" aria-label="Table module">
      <TableHeader
        table={table}
        templateColumns={templateColumns}
        sensors={sensors}
        onHeaderDragEnd={handleHeaderDragEnd}
        fieldColumnOrder={fieldColumnOrder}
        canReorderColumns={canReorderColumns}
        readOnly={readOnly}
        onResizeKeyDown={handleResizeKeyDown}
        selectedRecordIds={selectedRecordIds}
        clearSelection={clearSelection}
        bulkDeleteConfirm={bulkDeleteConfirm}
        setBulkDeleteConfirm={setBulkDeleteConfirm}
        bulkActionPending={bulkActionPending}
        bulkActionError={bulkActionError}
        setBulkActionError={setBulkActionError}
        onDeleteRecords={onDeleteRecords}
        runBulkDelete={runBulkDelete}
        onBulkUpdateRecords={onBulkUpdateRecords}
        statusField={statusField}
        statusOptions={statusOptions}
        runBulkStatusUpdate={runBulkStatusUpdate}
        filterableFields={filterableFields}
        activeFilters={activeFilters}
        setActiveFilters={setActiveFilters}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
      />

      <div
        ref={scrollRef}
        role="grid"
        aria-rowcount={modelRows.length}
        aria-colcount={table.getVisibleLeafColumns().length}
        className="relative min-h-0 flex-1"
      >
        {isEmpty ? (
          <div className="p-3">
            <ModuleEmptyState
              title="No records yet"
              iconName="table"
              description="Table For Two?"
              ctaLabel={canCreate ? 'Create record' : undefined}
              onCta={canCreate ? () => createTitleInputRef.current?.focus() : undefined}
              sizeTier={sizeTier}
            />
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = modelRows[item.index];
              return (
                <TableRow
                  key={row.id}
                  row={row}
                  item={item}
                  templateColumns={templateColumns}
                  setRowRef={(index, node) => {
                    rowRefs.current[index] = node;
                  }}
                  onRowKeyDown={handleRowKeyDown}
                  editableCell={editableCell}
                  fieldById={fieldById}
                  setEditableCell={setEditableCell}
                  handleEditableCellBlur={handleEditableCellBlur}
                  handleEditableCellKeyDown={handleEditableCellKeyDown}
                />
              );
            })}
          </div>
        )}
      </div>

      <TableCreateRow
        canCreate={canCreate}
        templateColumns={templateColumns}
        createRowVisibleColumns={createRowVisibleColumns}
        fieldById={fieldById}
        createTitleInputRef={createTitleInputRef}
        createRow={createRow}
        setCreateRow={setCreateRow}
        submitCreateRow={submitCreateRow}
      />

      <div className="border-t border-border-muted px-3 py-1 text-right text-[11px] text-muted" aria-live="polite" aria-atomic="true">
        {modelRows.length} record{modelRows.length === 1 ? '' : 's'}
      </div>
    </section>
  );
};
