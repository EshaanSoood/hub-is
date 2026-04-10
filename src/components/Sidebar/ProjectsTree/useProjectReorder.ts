import { useCallback } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export const useProjectReorder = ({
  enabled,
  itemIds,
  onReorder,
}: {
  enabled: boolean;
  itemIds: string[];
  onReorder: (nextItemIds: string[]) => Promise<void> | void;
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!enabled || !event.over) {
        return;
      }

      const activeId = String(event.active.id);
      const overId = String(event.over.id);
      if (!activeId || !overId || activeId === overId) {
        return;
      }

      const oldIndex = itemIds.indexOf(activeId);
      const newIndex = itemIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      void onReorder(arrayMove(itemIds, oldIndex, newIndex));
    },
    [enabled, itemIds, onReorder],
  );

  return {
    orderedItemIds: itemIds,
    sensors,
    handleDragEnd,
  };
};
