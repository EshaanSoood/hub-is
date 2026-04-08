import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { UNASSIGNED_ID } from '../types';

interface UseKanbanCardMovesParams {
  canMove: boolean;
  recordGroupById: Map<string, string>;
  onMoveRecord: (recordId: string, nextGroup: string) => void;
}

export const useKanbanCardMoves = ({
  canMove,
  recordGroupById,
  onMoveRecord,
}: UseKanbanCardMovesParams) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canMove || !event.over) {
      return;
    }

    const activeId = String(event.active.id);
    if (!activeId.startsWith('record:')) {
      return;
    }
    const recordId = activeId.slice('record:'.length);

    const overId = String(event.over.id);
    let targetGroupId = overId;

    if (overId.startsWith('record:')) {
      const overRecordId = overId.slice('record:'.length);
      targetGroupId = recordGroupById.get(overRecordId) ?? '';
    }

    const sourceGroupId = recordGroupById.get(recordId) ?? '';
    if (!targetGroupId || sourceGroupId === targetGroupId) {
      return;
    }

    onMoveRecord(recordId, targetGroupId === UNASSIGNED_ID ? '' : targetGroupId);
  };

  return {
    sensors,
    handleDragEnd,
  };
};
