import { flexRender, type Cell } from '@tanstack/react-table';
import { cn } from '../../../lib/cn';
import type { EditableCellState, TableField, TableRowData } from './types';
import { getEditableInputType, readFieldOptions } from './valueNormalization';

interface TableCellProps {
  cell: Cell<TableRowData, unknown>;
  isEditing: boolean;
  editableCell: EditableCellState | null;
  fieldById: Map<string, TableField>;
  setEditableCell: React.Dispatch<React.SetStateAction<EditableCellState | null>>;
  handleEditableCellBlur: () => Promise<void>;
  handleEditableCellKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => Promise<void>;
}

export const TableCell = ({
  cell,
  isEditing,
  editableCell,
  fieldById,
  setEditableCell,
  handleEditableCellBlur,
  handleEditableCellKeyDown,
}: TableCellProps) => {
  const field = cell.column.id === 'title' || cell.column.id === 'select' ? null : fieldById.get(cell.column.id) ?? null;

  return (
    <div
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
              onChange={(event) => setEditableCell((current) => (current ? { ...current, value: event.target.value, error: null } : current))}
              onBlur={handleEditableCellBlur}
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
              onChange={(event) => setEditableCell((current) => (current ? { ...current, value: event.target.value, error: null } : current))}
              onBlur={handleEditableCellBlur}
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
};
