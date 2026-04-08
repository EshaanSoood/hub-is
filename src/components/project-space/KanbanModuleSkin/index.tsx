import { useEffect, useRef, useState } from 'react';
import { DndContext, closestCorners } from '@dnd-kit/core';
import { ModuleEmptyState, ModuleLoadingState } from '../ModuleFeedback';
import { useModuleInsertState } from '../hooks/useModuleInsertState';
import { KanbanColumn } from './KanbanColumn';
import { useKanbanCardMoves } from './hooks/useKanbanCardMoves';
import { useKanbanColumnLimits } from './hooks/useKanbanColumnLimits';
import { useKanbanGrouping } from './hooks/useKanbanGrouping';
import { useKanbanMutations } from './hooks/useKanbanMutations';
import type { KanbanModuleSkinProps } from './types';


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
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
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
