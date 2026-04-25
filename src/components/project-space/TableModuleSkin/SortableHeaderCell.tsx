import { type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { flexRender, type Header } from '@tanstack/react-table';
import { cn } from '../../../lib/cn';
import type { TableRowData } from './types';

interface SortableHeaderCellProps {
  header: Header<TableRowData, unknown>;
  isReorderable: boolean;
  dragDisabled: boolean;
  previewMode?: boolean;
  onResizeKeyDown: (event: ReactKeyboardEvent<HTMLElement>, header: Header<TableRowData, unknown>) => void;
}

export const SortableHeaderCell = ({
  header,
  isReorderable,
  dragDisabled,
  previewMode = false,
  onResizeKeyDown,
}: SortableHeaderCellProps) => {
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

        {previewMode ? (
          <span className="block min-w-0 flex-1 whitespace-normal break-words text-[11px] font-bold uppercase tracking-wide text-muted">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
        ) : (
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
        )}
      </div>

      {canResize && !previewMode ? (
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
