import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, closestCorners, type Announcements } from '@dnd-kit/core';
import { ModuleEmptyState, ModuleLoadingState } from '../ModuleFeedback';
import { useModuleInsertState } from '../hooks/useModuleInsertState';
import { KanbanColumn } from './KanbanColumn';
import { useKanbanCardMoves } from './hooks/useKanbanCardMoves';
import { useKanbanColumnLimits } from './hooks/useKanbanColumnLimits';
import { useKanbanGrouping } from './hooks/useKanbanGrouping';
import { useKanbanMutations } from './hooks/useKanbanMutations';
import { UNASSIGNED_ID, type KanbanModuleSkinProps } from './types';

const DRAGGABLE_CARD_PREFIX = 'record:';
const KANBAN_DRAG_INSTRUCTIONS = 'To move a kanban card, press space or enter. While dragging, use arrow keys to move between columns. Press space or enter again to drop, or press escape to cancel.';

export const KanbanModuleSkin = ({
  sizeTier = 'M',
  groups,
  groupOptions,
  loading,
  groupingConfigured,
  readOnly = false,
  groupingMessage,
  metadataFieldIds,
  groupableFields,
  wipLimits,
  onOpenRecord,
  onMoveRecord,
  onCreateRecord,
  onConfigureGrouping,
  onUpdateRecord,
  onDeleteRecord,
  onInsertToEditor,
}: KanbanModuleSkinProps) => {
  const {
    activeItemId,
    activeItemType,
    setActiveItem,
    clearActiveItem,
  } = useModuleInsertState({ onInsertToEditor });

  const canMove = groupingConfigured && !readOnly;
  const canCreate = typeof onCreateRecord === 'function';
  const shouldShowMoveHint = canMove || !groupingConfigured;
  const groupingStatusMessage = groupingMessage ?? 'No grouping.';
  const emptyLimitState = { wipLimit: undefined, overLimit: false };

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollContentRef = useRef<HTMLDivElement | null>(null);
  const dragSourceGroupByRecordIdRef = useRef(new Map<string, string>());
  const dragOverGroupByRecordIdRef = useRef(new Map<string, string>());
  const [showScrollFade, setShowScrollFade] = useState(false);

  const {
    groupingFieldSelection,
    recordGroupById,
    handleGroupingFieldChange,
  } = useKanbanGrouping({
    groups,
    onConfigureGrouping,
  });
  const {
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
  } = useKanbanMutations({ onCreateRecord });
  const columnLimitStates = useKanbanColumnLimits({ groups, wipLimits });
  const getLimitState = (groupId: string) => columnLimitStates[groupId] ?? emptyLimitState;
  const { sensors, handleDragEnd } = useKanbanCardMoves({
    canMove,
    recordGroupById,
    onMoveRecord,
  });
  const groupLabelById = useMemo(() => {
    const map = new Map<string, string>();

    for (const group of groups) {
      map.set(group.id, group.label);
    }

    return map;
  }, [groups]);
  const recordTitleById = useMemo(() => {
    const map = new Map<string, string>();

    for (const group of groups) {
      for (const record of group.records) {
        map.set(record.record_id, record.title);
      }
    }

    return map;
  }, [groups]);
  const dragAnnouncements = useMemo<Announcements>(() => {
    const getRecordId = (sortableId: string) => (
      sortableId.startsWith(DRAGGABLE_CARD_PREFIX)
        ? sortableId.slice(DRAGGABLE_CARD_PREFIX.length)
        : null
    );

    const getRecordTitle = (recordId: string) => recordTitleById.get(recordId) ?? 'Card';
    const getColumnLabel = (groupId: string | null | undefined) => {
      if (!groupId || groupId === UNASSIGNED_ID) {
        return groupLabelById.get(UNASSIGNED_ID) ?? 'Unassigned';
      }
      return groupLabelById.get(groupId) ?? 'Unknown column';
    };
    const getGroupIdFromOverId = (overId: string | null): string | null => {
      if (!overId) {
        return null;
      }

      if (overId.startsWith(DRAGGABLE_CARD_PREFIX)) {
        const overRecordId = overId.slice(DRAGGABLE_CARD_PREFIX.length);
        return recordGroupById.get(overRecordId) ?? null;
      }

      return overId;
    };
    const getSourceGroupId = (recordId: string) => (
      dragSourceGroupByRecordIdRef.current.get(recordId)
      ?? recordGroupById.get(recordId)
      ?? UNASSIGNED_ID
    );
    const clearDragTracking = (recordId: string) => {
      dragSourceGroupByRecordIdRef.current.delete(recordId);
      dragOverGroupByRecordIdRef.current.delete(recordId);
    };

    return {
      onDragStart: ({ active }) => {
        const recordId = getRecordId(String(active.id));
        if (!recordId) {
          return undefined;
        }

        const sourceGroupId = recordGroupById.get(recordId) ?? UNASSIGNED_ID;
        dragSourceGroupByRecordIdRef.current.set(recordId, sourceGroupId);
        dragOverGroupByRecordIdRef.current.delete(recordId);
        return `Picked up ${getRecordTitle(recordId)} from ${getColumnLabel(sourceGroupId)}.`;
      },
      onDragMove: () => undefined,
      onDragOver: ({ active, over }) => {
        const recordId = getRecordId(String(active.id));
        if (!recordId) {
          return undefined;
        }

        const overGroupId = getGroupIdFromOverId(over ? String(over.id) : null);
        if (!overGroupId) {
          return undefined;
        }

        const previousOverGroupId = dragOverGroupByRecordIdRef.current.get(recordId) ?? null;
        if (previousOverGroupId === overGroupId) {
          return undefined;
        }

        dragOverGroupByRecordIdRef.current.set(recordId, overGroupId);
        return `${getRecordTitle(recordId)} is over ${getColumnLabel(overGroupId)}.`;
      },
      onDragEnd: ({ active, over }) => {
        const recordId = getRecordId(String(active.id));
        if (!recordId) {
          return undefined;
        }

        const sourceGroupId = getSourceGroupId(recordId);
        const destinationGroupId = getGroupIdFromOverId(over ? String(over.id) : null);
        clearDragTracking(recordId);

        if (!destinationGroupId || destinationGroupId === sourceGroupId) {
          return undefined;
        }

        return `Moved ${getRecordTitle(recordId)} to ${getColumnLabel(destinationGroupId)}.`;
      },
      onDragCancel: ({ active }) => {
        const recordId = getRecordId(String(active.id));
        if (!recordId) {
          return undefined;
        }

        const sourceGroupId = getSourceGroupId(recordId);
        clearDragTracking(recordId);
        return `Drag of ${getRecordTitle(recordId)} was cancelled. Returned to ${getColumnLabel(sourceGroupId)}.`;
      },
    };
  }, [groupLabelById, recordGroupById, recordTitleById]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const updateScrollFade = () => {
      const hasOverflow = container.scrollWidth > container.clientWidth + 1;
      const atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 1;
      setShowScrollFade(hasOverflow && !atEnd);
    };

    updateScrollFade();
    container.addEventListener('scroll', updateScrollFade, { passive: true });

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollFade);
    resizeObserver?.observe(container);
    if (scrollContentRef.current) {
      resizeObserver?.observe(scrollContentRef.current);
    }

    return () => {
      container.removeEventListener('scroll', updateScrollFade);
      resizeObserver?.disconnect();
    };
  }, [collapsedGroupIds, groups]);

  if (loading) {
    return <ModuleLoadingState label="Loading kanban cards" rows={6} />;
  }

  if (groups.length === 0) {
    if (!groupableFields?.length) {
      return <ModuleEmptyState title="No kanban grouping configured yet." iconName="kanban" description="Can You Kanban?" sizeTier={sizeTier} />;
    }

    return (
      <div className="space-y-3">
        <ModuleEmptyState title="No kanban grouping configured yet." iconName="kanban" description="Can You Kanban?" sizeTier={sizeTier} />
        <div className="mx-auto max-w-sm">
          <label className="block text-sm text-text">
            Group by field
            <select
              value={groupingFieldSelection}
              disabled={readOnly}
              onChange={(event) => handleGroupingFieldChange(event.target.value)}
              className="mt-2 w-full rounded-control border border-border-muted bg-surface px-2 py-1 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <option value="">Select a field</option>
              {groupableFields.map((field) => (
                <option key={field.field_id} value={field.field_id}>
                  {field.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {shouldShowMoveHint ? (
        <div className="flex items-center gap-2 px-1">
          <p className="text-xs text-muted">{canMove ? 'Drag to move.' : 'Ungrouped.'}</p>
        </div>
      ) : null}
      {!groupingConfigured ? (
        <p className="rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-muted">{groupingStatusMessage}</p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: dragAnnouncements,
          screenReaderInstructions: {
            draggable: KANBAN_DRAG_INSTRUCTIONS,
          },
        }}
      >
        <div className="relative min-h-0 flex-1">
          <div ref={scrollContainerRef} className="h-full overflow-x-auto pb-1">
            <div ref={scrollContentRef} className="flex gap-3">
              {groups.map((group) => {
                const limitState = getLimitState(group.id);

                return (
                  <KanbanColumn
                    key={group.id}
                    group={group}
                    canMove={canMove}
                    canCreate={canCreate}
                    readOnly={readOnly}
                    metadataFieldIds={metadataFieldIds}
                    groupOptions={groupOptions}
                    isCollapsed={collapsedGroupIds.has(group.id)}
                    isCreateOpen={createState.groupId === group.id}
                    createTitle={createState.title}
                    createError={createState.groupId === group.id ? createState.error : null}
                    createSubmitting={createState.groupId === group.id && createState.isSubmitting}
                    wipLimit={limitState.wipLimit}
                    overLimit={limitState.overLimit}
                    editingRecordId={editingRecordId}
                    onOpenRecord={onOpenRecord}
                    onMoveRecord={onMoveRecord}
                    onToggleCollapse={() => handleToggleCollapse(group)}
                    onOpenCreate={handleOpenCreate}
                    onCreateTitleChange={handleCreateTitleChange}
                    onCreateRecord={handleCreateRecord}
                    onCancelCreate={handleCancelCreate}
                    onStartEditing={setEditingRecordId}
                    onStopEditing={handleStopEditing}
                    onUpdateRecord={onUpdateRecord}
                    onDeleteRecord={onDeleteRecord}
                    activeItemId={activeItemId}
                    activeItemType={activeItemType}
                    setActiveItem={setActiveItem}
                    clearActiveItem={clearActiveItem}
                    onInsertToEditor={onInsertToEditor}
                  />
                );
              })}
            </div>
          </div>
          {showScrollFade ? (
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" aria-hidden="true" />
          ) : null}
        </div>
      </DndContext>
    </div>
  );
};
