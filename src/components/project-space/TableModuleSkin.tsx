import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type Header,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { HubRecordSummary } from '../../services/hub/types';
import { cn } from '../../lib/cn';
import { Checkbox, Icon } from '../primitives';
import { ModuleEmptyState, ModuleLoadingState } from './ModuleFeedback';
import { formatShortDate } from './taskAdapter';

interface TableField {
  field_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  sort_order: number;
}

interface TableSchema {
  collection_id: string;
  name: string;
  fields: TableField[];
}

interface TableViewOption {
  view_id: string;
  name: string;
}

interface TableModuleSkinProps {
  sizeTier?: 'S' | 'M' | 'L';
  schema: TableSchema | null;
  records: HubRecordSummary[];
  loading: boolean;
  readOnly?: boolean;
  availableViews?: TableViewOption[];
  onOpenRecord: (recordId: string) => void;
  onCreateRecord?: (payload: { title: string; fields: Record<string, unknown> }) => Promise<void>;
  onSelectView?: (viewId: string) => void;
  onCreateView?: () => void;
  onUpdateRecord?: (recordId: string, fields: Record<string, unknown>) => Promise<void>;
  onDeleteRecords?: (recordIds: string[]) => Promise<void>;
  onBulkUpdateRecords?: (recordIds: string[], fields: Record<string, unknown>) => Promise<void>;
}

interface TableRowData {
  recordId: string;
  title: string;
  fields: Record<string, unknown>;
}

interface EditableCellState {
  recordId: string;
  fieldId: string;
  value: string;
  baseline: string;
  error: string | null;
}

interface CreateRowState {
  title: string;
  fields: Record<string, string>;
  error: string | null;
  isSubmitting: boolean;
}

interface TableOption {
  id: string;
  label: string;
}

const DATE_FILTER_OPTIONS = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'this-week', label: 'This week' },
] as const;

const readRecordValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const candidates = [record.name, record.display_name, record.label, record.value, record.id];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }
  return '';
};

const readFieldOptions = (config: Record<string, unknown> | undefined): TableOption[] => {
  if (!config || !Array.isArray(config.options)) {
    return [];
  }

  const parsed = config.options
    .map((entry): TableOption | null => {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        return trimmed ? { id: trimmed, label: trimmed } : null;
      }

      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const record = entry as Record<string, unknown>;
        const id = readRecordValue(record.id ?? record.value ?? record.key ?? record.name ?? record.label);
        if (!id) {
          return null;
        }
        const label = readRecordValue(record.label ?? record.name ?? id) || id;
        return { id, label };
      }

      return null;
    })
    .filter((option): option is TableOption => Boolean(option));

  const seen = new Set<string>();
  return parsed.filter((option) => {
    if (seen.has(option.id)) {
      return false;
    }
    seen.add(option.id);
    return true;
  });
};

const normalizeDateInputValue = (value: unknown): string => {
  const raw = readRecordValue(value);
  if (!raw) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().slice(0, 10);
};

const normalizeDateTimeInputValue = (value: unknown): string => {
  const raw = readRecordValue(value);
  if (!raw) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    return raw.slice(0, 16);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
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
    const timestamp = new Date(readRecordValue(value) || String(value)).getTime();
    return Number.isNaN(timestamp) ? '' : timestamp;
  }

  return readRecordValue(value).toLocaleLowerCase();
};

const formatDisplayValue = (field: TableField | null, value: unknown): string => {
  if (!field) {
    return readRecordValue(value);
  }

  const rawValue = readRecordValue(value);
  if (!rawValue) {
    return '';
  }

  if (field.type === 'select') {
    return readFieldOptions(field.config).find((option) => option.id === rawValue)?.label ?? rawValue;
  }

  if (field.type === 'date' || field.type === 'datetime') {
    return formatShortDate(rawValue) ?? rawValue;
  }

  return rawValue;
};

const isFreeformTextField = (field: TableField | null): boolean => field?.type === 'text' || field?.type === 'longText';

const isNotesField = (field: TableField): boolean => {
  const normalized = `${field.field_id} ${field.name}`.toLocaleLowerCase();
  return normalized.includes('notes');
};

const getFieldColumnSizing = (
  field: TableField,
  sizeTier: 'S' | 'M' | 'L',
): Pick<ColumnDef<TableRowData>, 'size' | 'minSize' | 'maxSize'> => {
  if (sizeTier === 'L' && isNotesField(field)) {
    return {
      size: 200,
      minSize: 160,
      maxSize: 220,
    };
  }

  return {
    size: 160,
    minSize: 120,
  };
};

const getEditableFieldValue = (field: TableField | null, value: unknown): string => {
  if (!field) {
    return readRecordValue(value);
  }
  if (field.type === 'date') {
    return normalizeDateInputValue(value);
  }
  if (field.type === 'datetime') {
    return normalizeDateTimeInputValue(value);
  }
  return readRecordValue(value);
};

const buildFieldUpdateValue = (field: TableField | null, value: string): unknown => {
  if (!field) {
    return value;
  }

  if (field.type === 'date' || field.type === 'select') {
    return value || null;
  }

  if (field.type === 'datetime') {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  if (field.type === 'number') {
    if (!value.trim()) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
};

const getEditableInputType = (field: TableField | null): 'date' | 'datetime-local' | 'number' | 'text' => {
  if (field?.type === 'date') {
    return 'date';
  }
  if (field?.type === 'datetime') {
    return 'datetime-local';
  }
  if (field?.type === 'number') {
    return 'number';
  }
  return 'text';
};

const toDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const matchesDatePreset = (value: unknown, preset: string): boolean => {
  if (!preset) {
    return true;
  }

  const normalized = normalizeDateInputValue(value);
  if (!normalized) {
    return false;
  }

  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();
  const todayKey = toDayKey(today);
  const dateKey = toDayKey(date);

  if (preset === 'overdue') {
    return dateKey < todayKey;
  }

  if (preset === 'today') {
    return dateKey === todayKey;
  }

  if (preset === 'this-week') {
    const endOfWeek = new Date(today);
    endOfWeek.setHours(0, 0, 0, 0);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()) % 7);
    const endKey = toDayKey(endOfWeek);
    return dateKey >= todayKey && dateKey <= endKey;
  }

  return true;
};

const functionalUpdate = <T,>(updater: Updater<T>, input: T): T =>
  typeof updater === 'function' ? (updater as (old: T) => T)(input) : updater;

const SortableHeaderCell = ({
  header,
  isReorderable,
  dragDisabled,
  onResizeKeyDown,
}: {
  header: Header<TableRowData, unknown>;
  isReorderable: boolean;
  dragDisabled: boolean;
  onResizeKeyDown: (event: ReactKeyboardEvent<HTMLElement>, header: Header<TableRowData, unknown>) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.column.id,
    disabled: !isReorderable || dragDisabled,
  });

  const canSort = header.column.getCanSort();
  const canResize = header.column.getCanResize();
  const sorted = header.column.getIsSorted();
  const ariaSort =
    sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : canSort ? 'none' : undefined;

  return (
    <div
      ref={setNodeRef}
      role="columnheader"
      aria-sort={ariaSort}
      className="relative min-w-0 border-r border-border-muted/50 px-3 py-2 text-left last:border-r-0"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
      }}
    >
      <div className="flex items-center gap-2 pr-2">
        {isReorderable ? (
          <button
            type="button"
            className={cn(
              'shrink-0 rounded-control px-1 py-0.5 text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              dragDisabled && 'cursor-default opacity-50',
            )}
            aria-label={`Reorder ${String(flexRender(header.column.columnDef.header, header.getContext()))} column`}
            {...attributes}
            {...listeners}
          >
            <span aria-hidden="true">::</span>
          </button>
        ) : null}

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
            'inline-flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-left text-[11px] font-bold uppercase tracking-wide text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            !canSort && 'cursor-default',
          )}
        >
          <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
          {sorted === 'asc' ? <span aria-hidden="true">↑</span> : null}
          {sorted === 'desc' ? <span aria-hidden="true">↓</span> : null}
        </button>
      </div>

      {canResize ? (
        <button
          type="button"
          aria-label={`Resize ${String(flexRender(header.column.columnDef.header, header.getContext()))} column`}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onKeyDown={(event) => onResizeKeyDown(event, header)}
          className="absolute right-0 top-0 h-full w-[4px] cursor-col-resize bg-transparent hover:bg-primary/30 focus-visible:bg-primary/30 focus-visible:outline-none active:bg-primary/50"
        />
      ) : null}
    </div>
  );
};

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
  const skipEditableBlurRef = useRef(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [fieldColumnOrder, setFieldColumnOrder] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkActionError, setBulkActionError] = useState<string | null>(null);
  const [bulkActionPending, setBulkActionPending] = useState(false);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [editableCell, setEditableCell] = useState<EditableCellState | null>(null);
  const [createRow, setCreateRow] = useState<CreateRowState>({
    title: '',
    fields: {},
    error: null,
    isSubmitting: false,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fieldById = useMemo(() => new Map((schema?.fields ?? []).map((field) => [field.field_id, field])), [schema?.fields]);

  useEffect(() => {
    const nextFieldIds = schema?.fields.map((field) => field.field_id) ?? [];
    setFieldColumnOrder((current) => {
      const kept = current.filter((fieldId) => nextFieldIds.includes(fieldId));
      const missing = nextFieldIds.filter((fieldId) => !kept.includes(fieldId));
      return [...kept, ...missing];
    });
  }, [schema?.fields]);

  const rows = useMemo<TableRowData[]>(
    () =>
      records.map((record) => ({
        recordId: record.record_id,
        title: record.title,
        fields: record.fields,
      })),
    [records],
  );

  const filteredRows = useMemo<TableRowData[]>(() => {
    if (!schema) {
      return rows;
    }

    return rows.filter((row) =>
      schema.fields.every((field) => {
        const filterValue = activeFilters[field.field_id];
        if (!filterValue) {
          return true;
        }

        const rawValue = row.fields[field.field_id];
        if (field.type === 'date' || field.type === 'datetime') {
          return matchesDatePreset(rawValue, filterValue);
        }

        if (field.type === 'select') {
          return readRecordValue(rawValue) === filterValue;
        }

        return true;
      }),
    );
  }, [activeFilters, rows, schema]);

  const visibleRowIds = useMemo(() => new Set(filteredRows.map((row) => row.recordId)), [filteredRows]);

  useEffect(() => {
    setSelectedRecordIds((current) => {
      const next = new Set<string>();
      for (const id of current) {
        if (visibleRowIds.has(id)) {
          next.add(id);
        }
      }
      return next.size === current.size ? current : next;
    });
  }, [visibleRowIds]);

  const hasActiveFilters = useMemo(() => Object.values(activeFilters).some(Boolean), [activeFilters]);
  const activeFilterCount = useMemo(() => Object.values(activeFilters).filter(Boolean).length, [activeFilters]);

  const filterableFields = useMemo(
    () => (schema?.fields ?? []).filter((field) => field.type === 'select' || field.type === 'date' || field.type === 'datetime'),
    [schema?.fields],
  );

  const statusField = useMemo(
    () =>
      (schema?.fields ?? []).find((field) => {
        if (field.type !== 'select') {
          return false;
        }
        const normalized = `${field.field_id} ${field.name}`.toLocaleLowerCase();
        return normalized.includes('status');
      }) ?? null,
    [schema?.fields],
  );

  const statusOptions = useMemo(() => (statusField ? readFieldOptions(statusField.config) : []), [statusField]);
  const canReorderColumns = !readOnly && fieldColumnOrder.length > 1;

  const columnOrder = useMemo<ColumnOrderState>(
    () => [...(showBulkSelection ? ['select'] : []), 'title', ...fieldColumnOrder],
    [fieldColumnOrder, showBulkSelection],
  );

  const handleColumnOrderChange = useCallback(
    (updater: Updater<ColumnOrderState>) => {
      const nextOrder = functionalUpdate(updater, columnOrder);
      setFieldColumnOrder(nextOrder.filter((columnId) => columnId !== 'select' && columnId !== 'title'));
    },
    [columnOrder],
  );

  const toggleSelectedRecord = useCallback((recordId: string, checked: boolean) => {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(recordId);
      } else {
        next.delete(recordId);
      }
      return next;
    });
  }, []);

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedRecordIds.has(row.recordId));

  const renderDisplayCell = useCallback(
    (row: TableRowData, field: TableField | null) => {
      if (!field) {
        if (canEditCells) {
          return (
            <button
              type="button"
              className="truncate text-left font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() =>
                setEditableCell({
                  recordId: row.recordId,
                  fieldId: 'title',
                  value: row.title,
                  baseline: row.title,
                  error: null,
                })
              }
              onDoubleClick={() => onOpenRecord(row.recordId)}
              aria-label={`Edit title for ${row.title}`}
              data-testid={`open-record-button-${row.recordId}`}
            >
              {row.title}
            </button>
          );
        }

        return (
          <button
            type="button"
            className="truncate text-left font-semibold text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            onClick={() => onOpenRecord(row.recordId)}
            aria-label={`Open record ${row.title}`}
            data-testid={`open-record-button-${row.recordId}`}
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
            <span className={isFreeformTextField(field) ? textClassName : 'block max-w-full truncate text-[13px] font-normal text-text-secondary'} title={textTitle}>
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
    [canEditCells, onOpenRecord, sizeTier],
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
  }, [allVisibleSelected, filteredRows, renderDisplayCell, schema?.fields, selectedRecordIds, showBulkSelection, sizeTier, toggleSelectedRecord]);

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

  const handleResizeKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>, header: Header<TableRowData, unknown>) => {
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
  }, [table]);

  const handleHeaderDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (readOnly || !event.over) {
        return;
      }

      const activeId = String(event.active.id);
      const overId = String(event.over.id);
      if (activeId === overId) {
        return;
      }

      setFieldColumnOrder((current) => {
        const oldIndex = current.indexOf(activeId);
        const newIndex = current.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) {
          return current;
        }
        return arrayMove(current, oldIndex, newIndex);
      });
    },
    [readOnly],
  );

  const submitEditableCell = useCallback(async () => {
    if (!editableCell || !onUpdateRecord) {
      return;
    }

    const field = editableCell.fieldId === 'title' ? null : fieldById.get(editableCell.fieldId) ?? null;
    const nextValue = field ? editableCell.value : editableCell.value.trim();
    const baselineValue = field ? editableCell.baseline : editableCell.baseline.trim();

    if (!field && !nextValue) {
      setEditableCell((current) =>
        current && current.recordId === editableCell.recordId && current.fieldId === editableCell.fieldId
          ? { ...current, error: 'Title is required.' }
          : current,
      );
      return;
    }

    if (nextValue === baselineValue) {
      setEditableCell((current) =>
        current && current.recordId === editableCell.recordId && current.fieldId === editableCell.fieldId ? null : current,
      );
      return;
    }

    setEditableCell((current) =>
      current && current.recordId === editableCell.recordId && current.fieldId === editableCell.fieldId
        ? { ...current, error: null, value: nextValue }
        : current,
    );

    try {
      await onUpdateRecord(editableCell.recordId, {
        [editableCell.fieldId]: field ? buildFieldUpdateValue(field, nextValue) : nextValue,
      });
      setEditableCell((current) =>
        current && current.recordId === editableCell.recordId && current.fieldId === editableCell.fieldId ? null : current,
      );
    } catch (error) {
      setEditableCell((current) =>
        current && current.recordId === editableCell.recordId && current.fieldId === editableCell.fieldId
          ? { ...current, error: error instanceof Error ? error.message : 'Unable to update cell.' }
          : current,
      );
    }
  }, [editableCell, fieldById, onUpdateRecord]);

  const handleEditableCellKeyDown = useCallback(
    async (event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        await submitEditableCell();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        skipEditableBlurRef.current = true;
        setEditableCell(null);
      }
    },
    [submitEditableCell],
  );

  const submitCreateRow = useCallback(async () => {
    if (!onCreateRecord || createRow.isSubmitting) {
      return;
    }

    const trimmedTitle = createRow.title.trim();
    if (!trimmedTitle) {
      setCreateRow((current) => ({ ...current, error: 'Title is required.' }));
      return;
    }

    const fieldsPayload = Object.entries(createRow.fields).reduce<Record<string, unknown>>((accumulator, [fieldId, value]) => {
      const field = fieldById.get(fieldId);
      if (!field) {
        return accumulator;
      }

      const normalizedValue = field.type === 'text' ? value : value.trim();
      if (!normalizedValue) {
        return accumulator;
      }

      accumulator[fieldId] = buildFieldUpdateValue(field, normalizedValue);
      return accumulator;
    }, {});

    setCreateRow((current) => ({ ...current, isSubmitting: true, error: null }));

    try {
      await onCreateRecord({ title: trimmedTitle, fields: fieldsPayload });
      setCreateRow({
        title: '',
        fields: {},
        error: null,
        isSubmitting: false,
      });
      createTitleInputRef.current?.focus();
    } catch (error) {
      setCreateRow((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Unable to create record.',
        isSubmitting: false,
      }));
    }
  }, [createRow, fieldById, onCreateRecord]);

  const clearSelection = useCallback(() => {
    setSelectedRecordIds(new Set());
    setBulkDeleteConfirm(false);
    setBulkActionError(null);
  }, []);

  const runBulkDelete = useCallback(async () => {
    if (!onDeleteRecords || bulkActionPending || selectedRecordIds.size === 0) {
      return;
    }

    setBulkActionPending(true);
    setBulkActionError(null);

    try {
      await onDeleteRecords([...selectedRecordIds]);
      clearSelection();
    } catch (error) {
      setBulkActionError(error instanceof Error ? error.message : 'Unable to delete selected records.');
    } finally {
      setBulkActionPending(false);
    }
  }, [bulkActionPending, clearSelection, onDeleteRecords, selectedRecordIds]);

  const runBulkStatusUpdate = useCallback(
    async (value: string) => {
      if (!onBulkUpdateRecords || !statusField || bulkActionPending || selectedRecordIds.size === 0 || !value) {
        return;
      }

      setBulkActionPending(true);
      setBulkActionError(null);

      try {
        await onBulkUpdateRecords([...selectedRecordIds], { [statusField.field_id]: value });
        clearSelection();
      } catch (error) {
        setBulkActionError(error instanceof Error ? error.message : 'Unable to update selected records.');
      } finally {
        setBulkActionPending(false);
      }
    },
    [bulkActionPending, clearSelection, onBulkUpdateRecords, selectedRecordIds, statusField],
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
      <div className="sticky top-0 z-10 border-b border-border-muted bg-surface">
        {selectedRecordIds.size > 0 ? (
          <div className="border-b border-border-muted px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-text">{selectedRecordIds.size} selected</span>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-control border border-border-muted px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
                      className="rounded-control border border-border-muted px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="rounded-control border border-danger px-2 py-1 text-xs font-medium text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
                    onChange={async (event) => {
                      await runBulkStatusUpdate(event.target.value);
                      event.currentTarget.value = '';
                    }}
                    disabled={bulkActionPending}
                    className="rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
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

        {filterableFields.length > 0 ? (
          <div className="border-b border-border-muted px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                className="inline-flex items-center gap-2 rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleHeaderDragEnd}>
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
                      onResizeKeyDown={handleResizeKeyDown}
                    />
                  );
                })}
              </SortableContext>
            </div>
          ))}
        </DndContext>
      </div>

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
                <div
                  key={row.id}
                  ref={(node) => {
                    rowRefs.current[item.index] = node;
                  }}
                  role="row"
                  aria-rowindex={item.index + 1}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) {
                      return;
                    }
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
                  {row.getVisibleCells().map((cell) => {
                    const isEditing = editableCell?.recordId === row.original.recordId && editableCell.fieldId === cell.column.id;
                    const field = cell.column.id === 'title' || cell.column.id === 'select' ? null : fieldById.get(cell.column.id) ?? null;

                    return (
                      <div
                        key={cell.id}
                        role="gridcell"
                        className={cn(
                          'min-w-0 border-r border-border-muted/50 px-3 py-2 last:border-r-0',
                          isEditing && 'rounded-control ring-2 ring-focus-ring bg-surface-elevated',
                        )}
                      >
                        {isEditing && editableCell ? (
                          <div className="space-y-1">
                            {field?.type === 'select' ? (
                              <select
                                autoFocus
                                value={editableCell.value}
                                onChange={(event) =>
                                  setEditableCell((current) => (current ? { ...current, value: event.target.value, error: null } : current))
                                }
                                onBlur={async () => {
                                  if (skipEditableBlurRef.current) {
                                    skipEditableBlurRef.current = false;
                                    return;
                                  }
                                  await submitEditableCell();
                                }}
                                onKeyDown={handleEditableCellKeyDown}
                                className="w-full rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none"
                              >
                                <option value="">Select</option>
                                {readFieldOptions(field.config).map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                autoFocus
                                type={getEditableInputType(field)}
                                step={field?.type === 'datetime' ? 60 : field?.type === 'number' ? 'any' : undefined}
                                value={editableCell.value}
                                onChange={(event) =>
                                  setEditableCell((current) => (current ? { ...current, value: event.target.value, error: null } : current))
                                }
                                onBlur={async () => {
                                  if (skipEditableBlurRef.current) {
                                    skipEditableBlurRef.current = false;
                                    return;
                                  }
                                  await submitEditableCell();
                                }}
                                onKeyDown={handleEditableCellKeyDown}
                                className={cn(
                                  'w-full rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text placeholder:text-text-secondary focus-visible:outline-none',
                                  cell.column.id === 'title' && 'font-semibold',
                                )}
                              />
                            )}
                            {editableCell.error ? <p className="text-[11px] text-danger">{editableCell.error}</p> : null}
                          </div>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canCreate ? (
        <div className="sticky bottom-0 z-10 border-t border-border-muted bg-surface">
          <div className="grid" style={{ gridTemplateColumns: templateColumns }}>
            {createRowVisibleColumns.map((column) => {
              if (column.id === 'select') {
                return <div key={column.id} className="min-w-0 border-r border-border-muted/50 px-3 py-2 last:border-r-0" />;
              }

              if (column.id === 'title') {
                return (
                  <div key={column.id} className="min-w-0 border-r border-border-muted/50 px-3 py-2 last:border-r-0">
                    <div className="flex items-center gap-2">
                      <input
                        ref={createTitleInputRef}
                        value={createRow.title}
                        onChange={(event) => setCreateRow((current) => ({ ...current, title: event.target.value, error: null }))}
                        onKeyDown={async (event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            await submitCreateRow();
                          }
                        }}
                        placeholder="New record..."
                        className="min-w-0 flex-1 rounded-control border border-border-muted bg-surface px-2 py-1 text-sm text-text placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      />
                      <button
                        type="button"
                        onClick={submitCreateRow}
                        disabled={createRow.isSubmitting}
                        className="rounded-control border border-primary bg-primary px-2 py-1 text-xs font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                    {createRow.error ? (
                      <p className="mt-1 text-[11px] text-danger" role="alert" aria-live="polite">
                        {createRow.error}
                      </p>
                    ) : null}
                  </div>
                );
              }

              const field = fieldById.get(column.id) ?? null;
              const fieldValue = createRow.fields[column.id] ?? '';

              return (
                <div key={column.id} className="min-w-0 border-r border-border-muted/50 px-3 py-2 last:border-r-0">
                  {field?.type === 'select' ? (
                    <select
                      value={fieldValue}
                      onChange={(event) =>
                        setCreateRow((current) => ({
                          ...current,
                          fields: { ...current.fields, [column.id]: event.target.value },
                          error: null,
                        }))
                      }
                      className="w-full rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <option value="">Select</option>
                      {readFieldOptions(field?.config).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={getEditableInputType(field)}
                      step={field?.type === 'datetime' ? 60 : field?.type === 'number' ? 'any' : undefined}
                      value={fieldValue}
                      onChange={(event) =>
                        setCreateRow((current) => ({
                          ...current,
                          fields: { ...current.fields, [column.id]: event.target.value },
                          error: null,
                        }))
                      }
                      className="w-full rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="border-t border-border-muted px-3 py-1 text-right text-[11px] text-muted" aria-live="polite" aria-atomic="true">
        {modelRows.length} record{modelRows.length === 1 ? '' : 's'}
      </div>
    </section>
  );
};
