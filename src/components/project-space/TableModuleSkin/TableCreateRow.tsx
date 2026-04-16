import type { Column } from '@tanstack/react-table';
import type { CreateRowState, TableField, TableRowData } from './types';
import { getEditableInputType, readFieldOptions } from './valueNormalization';

interface TableCreateRowProps {
  canCreate: boolean;
  templateColumns: string;
  createRowVisibleColumns: Column<TableRowData, unknown>[];
  fieldById: Map<string, TableField>;
  createTitleInputRef: React.MutableRefObject<HTMLInputElement | null>;
  createRow: CreateRowState;
  setCreateRow: React.Dispatch<React.SetStateAction<CreateRowState>>;
  submitCreateRow: () => Promise<void>;
}

export const TableCreateRow = ({
  canCreate,
  templateColumns,
  createRowVisibleColumns,
  fieldById,
  createTitleInputRef,
  createRow,
  setCreateRow,
  submitCreateRow,
}: TableCreateRowProps) => {
  if (!canCreate) {
    return null;
  }

  return (
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
                    className="interactive interactive-fold rounded-control border border-primary bg-primary px-2 py-1 text-xs font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
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
  );
};
