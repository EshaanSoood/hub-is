import { useState } from 'react';
import { UNASSIGNED_ID, type KanbanCreateState, type KanbanModuleGroup } from '../types';

interface UseKanbanMutationsParams {
  onCreateRecord?: (payload: { title: string; groupFieldValue: string }) => Promise<void>;
}

const createEmptyState = (): KanbanCreateState => ({
  groupId: null,
  title: '',
  error: null,
  isSubmitting: false,
});

export const useKanbanMutations = ({
  onCreateRecord,
}: UseKanbanMutationsParams) => {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [createState, setCreateState] = useState<KanbanCreateState>(() => createEmptyState());

  const handleToggleCollapse = (group: KanbanModuleGroup) => {
    setCollapsedGroupIds((current) => {
      if (group.records.some((record) => record.record_id === editingRecordId)) {
        return current;
      }

      const next = new Set(current);
      if (next.has(group.id)) {
        next.delete(group.id);
        return next;
      }

      next.add(group.id);

      if (createState.groupId === group.id) {
        setCreateState(createEmptyState());
      }

      return next;
    });
  };

  const handleOpenCreate = (groupId: string) => {
    setCreateState((current) => {
      if (current.groupId === groupId) {
        return createEmptyState();
      }

      return {
        groupId,
        title: '',
        error: null,
        isSubmitting: false,
      };
    });
  };

  const handleCreateRecord = async () => {
    if (!onCreateRecord || !createState.groupId || createState.isSubmitting) {
      return;
    }

    const trimmedTitle = createState.title.trim();
    if (!trimmedTitle) {
      setCreateState((current) => ({ ...current, error: 'Title is required.' }));
      return;
    }

    setCreateState((current) => ({ ...current, error: null, isSubmitting: true }));

    try {
      await onCreateRecord({
        title: trimmedTitle,
        groupFieldValue: createState.groupId === UNASSIGNED_ID ? '' : createState.groupId,
      });
      setCreateState(createEmptyState());
    } catch (error) {
      setCreateState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Unable to create card.',
        isSubmitting: false,
      }));
    }
  };

  const handleCreateTitleChange = (value: string) => {
    setCreateState((current) => ({ ...current, title: value, error: null }));
  };

  const handleCancelCreate = () => {
    setCreateState(createEmptyState());
  };

  const handleStopEditing = () => {
    setEditingRecordId(null);
  };

  return {
    collapsedGroupIds,
    editingRecordId,
    createState,
    setEditingRecordId,
    handleStopEditing,
    handleToggleCollapse,
    handleOpenCreate,
    handleCreateTitleChange,
    handleCreateRecord,
    handleCancelCreate,
  };
};
