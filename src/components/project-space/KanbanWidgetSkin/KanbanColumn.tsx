import { useEffect, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '../../../lib/cn';
import { Icon } from '../../primitives';
import { KanbanCard } from './KanbanCard';
import { KanbanColumnHeader } from './KanbanColumnHeader';
import {
  UNASSIGNED_ID,
  type KanbanGroupOption,
  type KanbanInsertHandlers,
  type KanbanMetadataFieldIds,
  type KanbanWidgetGroup,
} from './types';

interface KanbanColumnProps extends KanbanInsertHandlers {
  group: KanbanWidgetGroup;
  canMove: boolean;
  canCreate: boolean;
  readOnly?: boolean;
  previewMode?: boolean;
  metadataFieldIds?: KanbanMetadataFieldIds;
  groupOptions: KanbanGroupOption[];
  isCollapsed: boolean;
  isCreateOpen: boolean;
  createTitle: string;
  createError: string | null;
  createSubmitting: boolean;
  wipLimit?: number;
  overLimit: boolean;
  editingRecordId: string | null;
  onOpenRecord: (recordId: string) => void;
  onMoveRecord: (recordId: string, nextGroup: string) => void;
  onToggleCollapse: () => void;
  onOpenCreate: (groupId: string) => void;
  onCreateTitleChange: (value: string) => void;
  onCreateRecord: () => void;
  onCancelCreate: () => void;
  onStartEditing: (recordId: string) => void;
  onStopEditing: () => void;
  onUpdateRecord?: (recordId: string, fields: Record<string, unknown>) => Promise<void>;
  onDeleteRecord?: (recordId: string) => Promise<void>;
}

const CreateCardComposer = ({
  groupId,
  isOpen,
  title,
  error,
  isSubmitting,
  onOpen,
  onTitleChange,
  onSubmit,
  onCancel,
}: {
  groupId: string;
  isOpen: boolean;
  title: string;
  error: string | null;
  isSubmitting: boolean;
  onOpen: (groupId: string) => void;
  onTitleChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpen(groupId)}
        className="ghost-button flex w-full items-center gap-2 bg-surface px-2 py-1.5 text-left text-xs font-medium text-primary transition-colors hover:bg-surface-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <Icon name="plus" className="h-3.5 w-3.5" />
        <span>Create card</span>
      </button>
    );
  }

  return (
    <form
      className="paper-card space-y-2 px-2 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input
        ref={inputRef}
        aria-label="Card title"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Card title"
        className="ghost-button w-full bg-surface px-2 py-1.5 text-sm text-text placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      />
      {error ? (
        <p className="text-[11px] text-danger" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="ghost-button bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="interactive interactive-fold cta-primary px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create
        </button>
      </div>
    </form>
  );
};

export const KanbanColumn = ({
  group,
  canMove,
  canCreate,
  readOnly = false,
  previewMode = false,
  metadataFieldIds,
  groupOptions,
  isCollapsed,
  isCreateOpen,
  createTitle,
  createError,
  createSubmitting,
  wipLimit,
  overLimit,
  editingRecordId,
  onOpenRecord,
  onMoveRecord,
  onToggleCollapse,
  onOpenCreate,
  onCreateTitleChange,
  onCreateRecord,
  onCancelCreate,
  onStartEditing,
  onStopEditing,
  onUpdateRecord,
  onDeleteRecord,
  activeItemId,
  activeItemType,
  setActiveItem,
  clearActiveItem,
  onInsertToEditor,
}: KanbanColumnProps) => {
  const { isOver, setNodeRef } = useDroppable({ id: group.id });
  const count = group.records.length;
  const showCreateComposer = !readOnly && canCreate;

  return (
    <section
      className={cn(
        'flex min-h-0 flex-col space-y-2 transition-[width] motion-reduce:transition-none',
        previewMode ? 'min-w-0 flex-1' : isCollapsed ? 'w-12 shrink-0' : 'w-[18rem] shrink-0',
      )}
      aria-label={`${group.label} column`}
    >
      <KanbanColumnHeader
        label={group.label}
        count={count}
        isCollapsed={isCollapsed}
        overLimit={overLimit}
        wipLimit={wipLimit}
        previewMode={previewMode}
        onToggleCollapse={onToggleCollapse}
      />

      {!isCollapsed ? (
        <div
          ref={setNodeRef}
          role="list"
          className={cn(
            'widget-dropzone min-h-16 space-y-2 p-2 transition-colors motion-reduce:transition-none',
            previewMode && 'min-h-0 flex-1 overflow-y-auto',
            isOver ? 'border-primary bg-primary/5' : overLimit ? 'border-danger bg-danger-subtle' : null,
          )}
          aria-label={`${group.label} drop zone`}
        >
          <SortableContext items={group.records.map((record) => `record:${record.record_id}`)} strategy={verticalListSortingStrategy}>
            {group.records.length === 0 ? <p className="py-4 text-center text-xs text-muted">No cards</p> : null}
            {group.records.map((record) => (
              <KanbanCard
                key={record.record_id}
                record={record}
                canMove={canMove}
                readOnly={readOnly}
                previewMode={previewMode}
                metadataFieldIds={metadataFieldIds}
                currentGroupValue={group.id === UNASSIGNED_ID ? '' : group.id}
                groupOptions={groupOptions}
                isEditing={editingRecordId === record.record_id}
                onOpenRecord={onOpenRecord}
                onMoveRecord={onMoveRecord}
                onStartEditing={onStartEditing}
                onStopEditing={onStopEditing}
                onUpdateRecord={onUpdateRecord}
                onDeleteRecord={onDeleteRecord}
                activeItemId={activeItemId}
                activeItemType={activeItemType}
                setActiveItem={setActiveItem}
                clearActiveItem={clearActiveItem}
                onInsertToEditor={onInsertToEditor}
              />
            ))}
          </SortableContext>

          {showCreateComposer ? (
            <CreateCardComposer
              groupId={group.id}
              isOpen={isCreateOpen}
              title={createTitle}
              error={createError}
              isSubmitting={createSubmitting}
              onOpen={onOpenCreate}
              onTitleChange={onCreateTitleChange}
              onSubmit={onCreateRecord}
              onCancel={onCancelCreate}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
