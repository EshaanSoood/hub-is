import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { ColumnOrderState, Updater } from '@tanstack/react-table';

interface UseTableDragReorderResult {
  sensors: ReturnType<typeof useSensors>;
  fieldColumnOrder: string[];
  setFieldColumnOrder: React.Dispatch<React.SetStateAction<string[]>>;
  canReorderColumns: boolean;
  columnOrder: ColumnOrderState;
  handleColumnOrderChange: (updater: Updater<ColumnOrderState>) => void;
  handleHeaderDragEnd: (event: DragEndEvent) => void;
}

const functionalUpdate = <T,>(updater: Updater<T>, input: T): T =>
  typeof updater === 'function' ? (updater as (old: T) => T)(input) : updater;

export const useTableDragReorder = (
  showBulkSelection: boolean,
  readOnly: boolean,
  fieldIds: string[] = [],
): UseTableDragReorderResult => {
  const [fieldColumnOrder, setFieldColumnOrder] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visibleFieldColumnOrder = useMemo(
    () => [
      ...fieldColumnOrder.filter((fieldId) => fieldIds.includes(fieldId)),
      ...fieldIds.filter((fieldId) => !fieldColumnOrder.includes(fieldId)),
    ],
    [fieldColumnOrder, fieldIds],
  );

  const columnOrder = useMemo<ColumnOrderState>(
    () => [...(showBulkSelection ? ['select'] : []), 'title', ...visibleFieldColumnOrder],
    [showBulkSelection, visibleFieldColumnOrder],
  );

  const handleColumnOrderChange = useCallback(
    (updater: Updater<ColumnOrderState>) => {
      const nextOrder = functionalUpdate(updater, columnOrder);
      setFieldColumnOrder(nextOrder.filter((columnId) => columnId !== 'select' && columnId !== 'title'));
    },
    [columnOrder],
  );

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

  const canReorderColumns = !readOnly && visibleFieldColumnOrder.length > 1;

  return {
    sensors,
    fieldColumnOrder: visibleFieldColumnOrder,
    setFieldColumnOrder,
    canReorderColumns,
    columnOrder,
    handleColumnOrderChange,
    handleHeaderDragEnd,
  };
};
