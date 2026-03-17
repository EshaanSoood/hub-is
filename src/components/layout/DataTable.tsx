import type { ReactNode } from 'react';

interface Column<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
}

export const DataTable = <T,>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) => (
  <div className="min-w-0 max-w-full">
    <div className="overflow-x-auto rounded-panel border border-border-muted shadow-soft">
      <table className="min-w-full divide-y divide-border-muted bg-surface">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-elevated">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-primary"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-muted">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition-colors hover:bg-surface-elevated">
              {columns.map((column) => (
                <td key={column.id} className="whitespace-nowrap px-4 py-3 text-sm text-text">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
