import type { Row } from '@tanstack/react-table';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { EditableCellState, TableField, TableRowData } from './types';
import { TableCell } from './TableCell';

interface TableRowProps {
  row: Row<TableRowData>;
  item: VirtualItem;
  templateColumns: string;
  setRowRef: (index: number, node: HTMLDivElement | null) => void;
  onRowKeyDown: (event: React.KeyboardEvent<HTMLDivElement>, index: number, recordId: string) => void;
  editableCell: EditableCellState | null;
  fieldById: Map<string, TableField>;
  setEditableCell: React.Dispatch<React.SetStateAction<EditableCellState | null>>;
  handleEditableCellBlur: () => Promise<void>;
  handleEditableCellKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => Promise<void>;
}

export const TableRow = ({
  row,
  item,
  templateColumns,
  setRowRef,
  onRowKeyDown,
  editableCell,
  fieldById,
  setEditableCell,
  handleEditableCellBlur,
  handleEditableCellKeyDown,
}: TableRowProps) => {
  return (
    <div
      ref={(node) => {
        setRowRef(item.index, node);
      }}
      role="row"
      aria-rowindex={item.index + 1}
      tabIndex={0}
      onKeyDown={(event) => onRowKeyDown(event, item.index, row.original.recordId)}
      className="absolute left-0 grid w-full border-b border-border-muted text-[13px] transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none"
      style={{
        transform: `translateY(${item.start}px)`,
        gridTemplateColumns: templateColumns,
        height: `${item.size}px`,
      }}
    >
      {row.getVisibleCells().map((cell) => {
        const isEditing = editableCell?.recordId === row.original.recordId && editableCell.fieldId === cell.column.id;

        return (
          <TableCell
            key={cell.id}
            cell={cell}
            isEditing={isEditing}
            editableCell={editableCell}
            fieldById={fieldById}
            setEditableCell={setEditableCell}
            handleEditableCellBlur={handleEditableCellBlur}
            handleEditableCellKeyDown={handleEditableCellKeyDown}
          />
        );
      })}
    </div>
  );
};
