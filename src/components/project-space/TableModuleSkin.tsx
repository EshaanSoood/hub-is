import { useCallback, useMemo, useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { HubRecordSummary } from '../../services/hub/types';
import { ModuleEmptyState, ModuleLoadingState } from './ModuleFeedback';
import { cn } from '../../lib/cn';

interface TableSchema {
  collection_id: string;
  name: string;
  fields: Array<{ field_id: string; name: string; type: string; config: Record<string, unknown>; sort_order: number }>;
}

interface TableModuleSkinProps {
  schema: TableSchema | null;
  records: HubRecordSummary[];
  loading: boolean;
  onOpenRecord: (recordId: string) => void;
}

interface TableRowData {
  recordId: string;
  title: string;
  fields: Record<string, unknown>;
}

const sortHeaderValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
};

const toComparable = (value: unknown, type: string): number | string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (type === 'number') {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? '' : parsed;
  }

  if (type === 'date' || type === 'datetime') {
    const timestamp = new Date(String(value)).getTime();
    return Number.isNaN(timestamp) ? '' : timestamp;
  }

  return String(value).toLocaleLowerCase();
};

export const TableModuleSkin = ({ schema, records, loading, onOpenRecord }: TableModuleSkinProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  const rows = useMemo<TableRowData[]>(
    () =>
      records.map((record) => ({
        recordId: record.record_id,
        title: record.title,
        fields: record.fields,
      })),
    [records],
  );

  const columns = useMemo<ColumnDef<TableRowData>[]>(
    () => [
      {
        id: 'title',
        accessorFn: (row) => row.title,
        header: 'Title',
        cell: ({ row }) => (
          <button
            type="button"
            className="truncate text-left font-semibold text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            onClick={() => onOpenRecord(row.original.recordId)}
            aria-label={`Open record ${row.original.title}`}
            data-testid={`open-record-button-${row.original.recordId}`}
          >
            {row.original.title}
          </button>
        ),
      },
      ...((schema?.fields ?? []).map(
        (field): ColumnDef<TableRowData> => ({
          id: field.field_id,
          accessorFn: (row) => row.fields[field.field_id],
          header: field.name,
          sortingFn: (rowA, rowB, columnId) => {
            const left = toComparable(rowA.getValue(columnId), field.type);
            const right = toComparable(rowB.getValue(columnId), field.type);
            if (left === right) {
              return 0;
            }
            return left > right ? 1 : -1;
          },
          cell: ({ getValue }) => (
            <span className="truncate text-[13px] font-normal text-text-secondary">
              {sortHeaderValue(getValue()) || '—'}
            </span>
          ),
        }),
      ) ?? []),
    ],
    [onOpenRecord, schema?.fields],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<TableRowData>({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
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

  const templateColumns = useMemo(() => {
    const fieldColumns = schema?.fields.map(() => 'minmax(10rem, 1fr)').join(' ') ?? '';
    return fieldColumns ? `minmax(16rem, 1.5fr) ${fieldColumns}` : 'minmax(16rem, 1fr)';
  }, [schema?.fields]);

  const focusRowByIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= modelRows.length) {
        return;
      }
      virtualizer.scrollToIndex(index, { align: 'auto' });
      window.requestAnimationFrame(() => {
        rowRefs.current[index]?.focus();
      });
    },
    [modelRows.length, virtualizer],
  );

  if (loading) {
    return <ModuleLoadingState label="Loading table records" rows={6} />;
  }

  if (!schema) {
    return <ModuleEmptyState title="No table view found yet." description="Create or select a table view to see records here." />;
  }

  if (modelRows.length === 0) {
    return <ModuleEmptyState title="No records yet" description="Add a record to populate this table module." />;
  }

  return (
    <section className="h-full rounded-panel border border-border-muted bg-surface-elevated" aria-label="Table module">
      <div role="rowgroup" className="sticky top-0 z-10 border-b border-border-muted bg-surface">
        {table.getHeaderGroups().map((group) => (
          <div key={group.id} role="row" className="grid" style={{ gridTemplateColumns: templateColumns }}>
            {group.headers.map((header) => {
              const canSort = header.column.getCanSort();
              const sorted = header.column.getIsSorted();
              const ariaSort =
                sorted === 'asc'
                  ? 'ascending'
                  : sorted === 'desc'
                    ? 'descending'
                    : canSort
                      ? 'none'
                      : undefined;

              return (
                <div key={header.id} role="columnheader" aria-sort={ariaSort} className="min-w-0 border-r border-border-muted/50 px-3 py-2 text-left last:border-r-0">
                  <button
                    type="button"
                    tabIndex={canSort ? 0 : -1}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    onKeyDown={(event) => {
                      if (!canSort) {
                        return;
                      }
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        header.column.getToggleSortingHandler()?.(event);
                      }
                    }}
                    className={cn(
                      'inline-flex w-full items-center gap-1 overflow-hidden text-left text-[11px] font-bold uppercase tracking-wide text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                      !canSort && 'cursor-default',
                    )}
                  >
                    <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                    {sorted === 'asc' ? <span aria-hidden="true">↑</span> : null}
                    {sorted === 'desc' ? <span aria-hidden="true">↓</span> : null}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div
        ref={scrollRef}
        role="grid"
        aria-rowcount={modelRows.length}
        aria-colcount={(schema?.fields.length ?? 0) + 1}
        className="relative"
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = modelRows[item.index];
            return (
              <div
                key={row.id}
                ref={(node) => {
                  rowRefs.current[item.index] = node;
                }}
                role="row"
                aria-rowindex={item.index + 1}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    focusRowByIndex(item.index + 1);
                    return;
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    focusRowByIndex(item.index - 1);
                    return;
                  }
                  if (event.key === 'Home') {
                    event.preventDefault();
                    focusRowByIndex(0);
                    return;
                  }
                  if (event.key === 'End') {
                    event.preventDefault();
                    focusRowByIndex(modelRows.length - 1);
                    return;
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenRecord(row.original.recordId);
                  }
                }}
                className="absolute left-0 grid w-full border-b border-border-muted text-[13px] transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none"
                style={{
                  transform: `translateY(${item.start}px)`,
                  gridTemplateColumns: templateColumns,
                  height: `${item.size}px`,
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} role="gridcell" className="min-w-0 border-r border-border-muted/50 px-3 py-2 last:border-r-0">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border-muted px-3 py-1 text-right text-[11px] text-muted" aria-live="polite" aria-atomic="true">
        {modelRows.length} record{modelRows.length === 1 ? '' : 's'}
      </div>
    </section>
  );
};
