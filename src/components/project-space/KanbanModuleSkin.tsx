import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { HubRecordSummary } from '../../services/hub/types';
import { cn } from '../../lib/cn';
import { useModuleInsertContext } from '../../context/ModuleInsertContext';
import { useLongPress } from '../../hooks/useLongPress';
import { getPriorityClasses } from '../../lib/priorityStyles';
import { Icon, IconButton } from '../primitives';
import type { PriorityLevel } from './designTokens';
import { ModuleEmptyState, ModuleLoadingState } from './ModuleFeedback';
import { formatShortDate } from './taskAdapter';

const UNASSIGNED_ID = '__unassigned__';

interface KanbanModuleGroup {
  id: string;
  label: string;
  records: HubRecordSummary[];
}

interface KanbanGroupOption {
  id: string;
  label: string;
}

interface KanbanGroupableField {
  field_id: string;
  name: string;
}

interface KanbanMetadataFieldIds {
  priority?: string | null;
  assignee?: string | null;
  dueDate?: string | null;
}

interface KanbanModuleSkinProps {
  sizeTier?: 'S' | 'M' | 'L';
  groups: KanbanModuleGroup[];
  groupOptions: KanbanGroupOption[];
  loading: boolean;
  groupingConfigured: boolean;
  readOnly?: boolean;
  groupingMessage?: string;
  metadataFieldIds?: KanbanMetadataFieldIds;
  groupableFields?: KanbanGroupableField[];
  wipLimits?: Record<string, number>;
  onOpenRecord: (recordId: string) => void;
  onMoveRecord: (recordId: string, nextGroup: string) => void;
  onCreateRecord?: (payload: { title: string; groupFieldValue: string }) => Promise<void>;
  onConfigureGrouping?: (fieldId: string) => void;
  onUpdateRecord?: (recordId: string, fields: Record<string, unknown>) => Promise<void>;
  onDeleteRecord?: (recordId: string) => Promise<void>;
}

interface EditableCardFields {
  title: string;
  priority: string;
  assignee: string;
  dueDate: string;
}

const PRIORITY_OPTIONS = [
  { label: 'None', value: '' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
] as const;

const isPriorityLevel = (value: string): value is PriorityLevel => value === 'high' || value === 'medium' || value === 'low';

const readStringField = (record: HubRecordSummary, fieldId: string | null | undefined): string => {
  if (!fieldId) {
    return '';
  }

  const value = record.fields[fieldId];
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value as Record<string, unknown>;
    if (typeof objectValue.name === 'string' && objectValue.name.trim()) {
      return objectValue.name.trim();
    }
    if (typeof objectValue.display_name === 'string' && objectValue.display_name.trim()) {
      return objectValue.display_name.trim();
    }
    if (typeof objectValue.label === 'string' && objectValue.label.trim()) {
      return objectValue.label.trim();
    }
  }
  return '';
};

const normalizeDateValue = (value: string): string => {
  if (!value) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().slice(0, 10);
};

const readEditableFields = (record: HubRecordSummary, metadataFieldIds?: KanbanMetadataFieldIds): EditableCardFields => {
  const priorityRaw = readStringField(record, metadataFieldIds?.priority).toLowerCase();

  return {
    title: record.title,
    priority: isPriorityLevel(priorityRaw) ? priorityRaw : '',
    assignee: readStringField(record, metadataFieldIds?.assignee),
    dueDate: normalizeDateValue(readStringField(record, metadataFieldIds?.dueDate)),
  };
};

const buildMetadataUpdate = (
  fieldId: string | null | undefined,
  value: unknown,
): Record<string, unknown> | null => {
  if (!fieldId) {
    return null;
  }
  return { [fieldId]: value };
};

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
        className="flex w-full items-center gap-2 rounded-control border border-border-muted px-2 py-1.5 text-left text-xs font-medium text-primary transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <Icon name="plus" className="h-3.5 w-3.5" />
        <span>Create card</span>
      </button>
    );
  }

  return (
    <form
      className="space-y-2 rounded-control border border-border-muted bg-surface px-2 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input
        ref={inputRef}
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Card title"
        className="w-full rounded-control border border-border-muted bg-surface px-2 py-1.5 text-sm text-text placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
          className="rounded-control border border-border-muted px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-control border border-primary bg-primary px-2 py-1 text-xs font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create
        </button>
      </div>
    </form>
  );
};

const SortableCard = ({
  record,
  canMove,
  readOnly = false,
  metadataFieldIds,
  currentGroupValue,
  groupOptions,
  isEditing,
  onOpenRecord,
  onMoveRecord,
  onStartEditing,
  onStopEditing,
  onUpdateRecord,
  onDeleteRecord,
}: {
  record: HubRecordSummary;
  canMove: boolean;
  readOnly?: boolean;
  metadataFieldIds?: KanbanMetadataFieldIds;
  currentGroupValue: string;
  groupOptions: KanbanGroupOption[];
  isEditing: boolean;
  onOpenRecord: (recordId: string) => void;
  onMoveRecord: (recordId: string, nextGroup: string) => void;
  onStartEditing: (recordId: string) => void;
  onStopEditing: () => void;
  onUpdateRecord?: (recordId: string, fields: Record<string, unknown>) => Promise<void>;
  onDeleteRecord?: (recordId: string) => Promise<void>;
}) => {
  const editable = !readOnly && typeof onUpdateRecord === 'function';
  const deletable = !readOnly && typeof onDeleteRecord === 'function';
  const { activeItemId, activeItemType, clearActiveItem, onInsertToEditor, setActiveItem } = useModuleInsertContext();
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const wasEditingRef = useRef(false);
  const [moveExpanded, setMoveExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableCardFields>(() => readEditableFields(record, metadataFieldIds));
  const [baseline, setBaseline] = useState<EditableCardFields>(() => readEditableFields(record, metadataFieldIds));
  const longPressHandlers = useLongPress(() => {
    if (!isEditing) {
      setActiveItem(record.record_id, 'record', record.title);
    }
  });
  const showInsertAction = activeItemId === record.record_id && activeItemType === 'record';
  const priority = isPriorityLevel(draft.priority) ? draft.priority : null;
  const dueDateLabel = draft.dueDate ? formatShortDate(draft.dueDate) ?? draft.dueDate : '';

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `record:${record.record_id}`,
    disabled: !canMove,
  });

  useEffect(() => {
    const nextState = readEditableFields(record, metadataFieldIds);

    if (!isEditing) {
      setDraft(nextState);
      setBaseline(nextState);
      setUpdateError(null);
      setShowDeleteConfirm(false);
      wasEditingRef.current = false;
    }
  }, [isEditing, metadataFieldIds, record]);

  useEffect(() => {
    if (isEditing && !wasEditingRef.current) {
      const nextState = readEditableFields(record, metadataFieldIds);
      setDraft(nextState);
      setBaseline(nextState);
      setUpdateError(null);
      setShowDeleteConfirm(false);
      wasEditingRef.current = true;
    }
  }, [isEditing, metadataFieldIds, record]);

  useEffect(() => {
    if (isEditing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditing]);

  const commitUpdate = async (fields: Record<string, unknown>, nextBaseline?: Partial<EditableCardFields>) => {
    if (!onUpdateRecord) {
      return true;
    }

    setIsSaving(true);
    setUpdateError(null);

    try {
      await onUpdateRecord(record.record_id, fields);
      if (nextBaseline) {
        setBaseline((current) => ({ ...current, ...nextBaseline }));
      }
      return true;
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Unable to update card.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveTitle = async () => {
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) {
      setUpdateError('Title is required.');
      return false;
    }
    if (trimmedTitle === baseline.title) {
      if (draft.title !== trimmedTitle) {
        setDraft((current) => ({ ...current, title: trimmedTitle }));
      }
      return true;
    }

    const success = await commitUpdate({ title: trimmedTitle }, { title: trimmedTitle });
    if (success) {
      setDraft((current) => ({ ...current, title: trimmedTitle }));
    }
    return success;
  };

  const saveAssignee = async () => {
    if (!metadataFieldIds?.assignee) {
      return true;
    }

    const trimmedAssignee = draft.assignee.trim();
    if (trimmedAssignee === baseline.assignee) {
      if (draft.assignee !== trimmedAssignee) {
        setDraft((current) => ({ ...current, assignee: trimmedAssignee }));
      }
      return true;
    }

    const payload = buildMetadataUpdate(metadataFieldIds.assignee, trimmedAssignee || null);
    if (!payload) {
      return true;
    }

    const success = await commitUpdate(payload, { assignee: trimmedAssignee });
    if (success) {
      setDraft((current) => ({ ...current, assignee: trimmedAssignee }));
    }
    return success;
  };

  const saveDueDate = async () => {
    if (!metadataFieldIds?.dueDate) {
      return true;
    }

    if (draft.dueDate === baseline.dueDate) {
      return true;
    }

    const payload = buildMetadataUpdate(metadataFieldIds.dueDate, draft.dueDate || null);
    if (!payload) {
      return true;
    }

    return commitUpdate(payload, { dueDate: draft.dueDate });
  };

  const savePriority = async (nextPriority: string) => {
    if (!metadataFieldIds?.priority) {
      return true;
    }

    setDraft((current) => ({ ...current, priority: nextPriority }));
    if (nextPriority === baseline.priority) {
      return true;
    }

    const payload = buildMetadataUpdate(metadataFieldIds.priority, nextPriority || null);
    if (!payload) {
      return true;
    }

    return commitUpdate(payload, { priority: nextPriority });
  };

  const saveAllPendingChanges = async () => {
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) {
      setUpdateError('Title is required.');
      return false;
    }

    const updates: Record<string, unknown> = {};
    const nextBaseline: Partial<EditableCardFields> = {};
    const trimmedAssignee = draft.assignee.trim();

    if (trimmedTitle !== baseline.title) {
      updates.title = trimmedTitle;
      nextBaseline.title = trimmedTitle;
    }
    if (metadataFieldIds?.priority && draft.priority !== baseline.priority) {
      updates[metadataFieldIds.priority] = draft.priority || null;
      nextBaseline.priority = draft.priority;
    }
    if (metadataFieldIds?.assignee && trimmedAssignee !== baseline.assignee) {
      updates[metadataFieldIds.assignee] = trimmedAssignee || null;
      nextBaseline.assignee = trimmedAssignee;
    }
    if (metadataFieldIds?.dueDate && draft.dueDate !== baseline.dueDate) {
      updates[metadataFieldIds.dueDate] = draft.dueDate || null;
      nextBaseline.dueDate = draft.dueDate;
    }

    if (Object.keys(updates).length === 0) {
      setDraft((current) => ({ ...current, title: trimmedTitle, assignee: trimmedAssignee }));
      return true;
    }

    const success = await commitUpdate(updates, nextBaseline);
    if (success) {
      setDraft((current) => ({ ...current, title: trimmedTitle, assignee: trimmedAssignee }));
    }
    return success;
  };

  const handleEditorExit = async () => {
    const success = await saveAllPendingChanges();
    if (success) {
      onStopEditing();
    }
  };

  const handleDelete = async () => {
    if (!onDeleteRecord) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onDeleteRecord(record.record_id);
      setShowDeleteConfirm(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete card.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      role="listitem"
      aria-label={`Card ${record.title}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
      }}
    >
      <div
        className="group/card relative rounded-control border border-border-muted bg-surface-elevated p-3 transition-colors hover:border-primary/50 motion-reduce:transition-none"
        {...(!isEditing ? longPressHandlers : {})}
      >
        {isEditing ? (
          <div ref={editorRef} className="space-y-3">
            <div className="space-y-2">
              <input
                ref={titleInputRef}
                value={draft.title}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, title: event.target.value }));
                  setUpdateError(null);
                }}
                onKeyDown={async (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    await saveTitle();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setDraft(baseline);
                    setUpdateError(null);
                    onStopEditing();
                  }
                }}
                onBlur={async (event) => {
                  if (event.relatedTarget instanceof Node && editorRef.current?.contains(event.relatedTarget)) {
                    return;
                  }
                  await saveTitle();
                }}
                className="w-full rounded-control border border-border-muted bg-surface px-2 py-1.5 text-sm font-bold text-text placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                aria-label={`Edit title for ${record.title}`}
              />
              {updateError ? (
                <p className="text-[11px] text-danger" role="alert" aria-live="polite">
                  {updateError}
                </p>
              ) : null}
            </div>

            {metadataFieldIds?.priority ? (
              <label className="block text-[11px] text-muted">
                Priority
                <select
                  value={draft.priority}
                  onChange={async (event) => {
                    setUpdateError(null);
                    await savePriority(event.target.value);
                  }}
                  className="mt-1 w-full rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value || 'none'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {metadataFieldIds?.assignee ? (
              <label className="block text-[11px] text-muted">
                Assignee
                <input
                  value={draft.assignee}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, assignee: event.target.value }));
                    setUpdateError(null);
                  }}
                  onKeyDown={async (event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      await saveAssignee();
                    }
                  }}
                  onBlur={async (event) => {
                    if (event.relatedTarget instanceof Node && editorRef.current?.contains(event.relatedTarget)) {
                      return;
                    }
                    await saveAssignee();
                  }}
                  className="mt-1 w-full rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                />
              </label>
            ) : null}

            {metadataFieldIds?.dueDate ? (
              <label className="block text-[11px] text-muted">
                Due date
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, dueDate: event.target.value }));
                    setUpdateError(null);
                  }}
                  onBlur={async (event) => {
                    if (event.relatedTarget instanceof Node && editorRef.current?.contains(event.relatedTarget)) {
                      return;
                    }
                    await saveDueDate();
                  }}
                  className="mt-1 w-full rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                />
              </label>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(baseline);
                  setUpdateError(null);
                  onStopEditing();
                }}
                disabled={isSaving}
                className="rounded-control border border-border-muted px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditorExit}
                disabled={isSaving}
                className="rounded-control border border-primary bg-primary px-2 py-1 text-xs font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              className={cn(
                'w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                (editable || deletable || canMove) && 'pr-20',
              )}
              onClick={() => onOpenRecord(record.record_id)}
              aria-label={`Open record: ${record.title}`}
            >
              <span className="line-clamp-2 block text-sm font-bold text-text">{record.title}</span>
              <span className="mt-2 flex items-center gap-2">
                {priority ? (
                  <span
                    className={cn('inline-block h-2 w-2 rounded-full', getPriorityClasses(priority).dot)}
                    aria-label={`Priority: ${priority}`}
                  />
                ) : null}
                {draft.assignee ? (
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border-muted bg-surface text-[10px] font-medium text-text-secondary"
                    aria-label={draft.assignee}
                    title={draft.assignee}
                  >
                    {draft.assignee.slice(0, 1).toUpperCase()}
                  </span>
                ) : null}
                {dueDateLabel ? <span className="truncate text-[11px] text-text-secondary">{dueDateLabel}</span> : null}
              </span>
            </button>

            <div className="absolute right-0 top-0 flex items-start gap-1">
              {editable ? (
                <IconButton
                  aria-label={`Edit ${record.title}`}
                  variant="ghost"
                  size="sm"
                  className="opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100"
                  onClick={() => {
                    setMoveExpanded(false);
                    onStartEditing(record.record_id);
                  }}
                >
                  <Icon name="edit" className="h-3.5 w-3.5" />
                </IconButton>
              ) : null}

              {deletable ? (
                <IconButton
                  aria-label={`Delete ${record.title}`}
                  variant="ghost"
                  size="sm"
                  className="opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100"
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setDeleteError(null);
                    setMoveExpanded(false);
                  }}
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </IconButton>
              ) : null}

              {canMove ? (
                <button
                  type="button"
                  className="mt-0.5 shrink-0 rounded-control border border-border-muted bg-surface px-1.5 py-1 text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  aria-label={`Drag ${record.title}`}
                  {...attributes}
                  {...listeners}
                >
                  <span aria-hidden="true">::</span>
                </button>
              ) : null}
            </div>
          </div>
        )}

        {!isEditing && showDeleteConfirm ? (
          <div className="mt-3 rounded-control border border-danger bg-danger-subtle px-2 py-2">
            <p className="text-xs font-medium text-danger">Delete this card?</p>
            {deleteError ? (
              <p className="mt-1 text-[11px] text-danger" role="alert" aria-live="polite">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="rounded-control border border-border-muted px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-control border border-danger bg-danger px-2 py-1 text-xs font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}
        {showInsertAction ? (
          <button
            type="button"
            data-module-insert-ignore="true"
            onClick={() => {
              onInsertToEditor?.({ id: record.record_id, type: 'record', title: record.title });
              clearActiveItem();
            }}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-control bg-primary px-2 py-1 text-xs font-semibold text-on-primary shadow-soft"
          >
            Insert
          </button>
        ) : null}
      </div>

      {canMove ? (
        <div className="mt-2 space-y-2">
          <button
            type="button"
            onClick={() => setMoveExpanded((current) => !current)}
            className="rounded-control px-1 py-0.5 text-[11px] font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Move
          </button>
          {moveExpanded ? (
            <label className="block text-[11px] text-muted">
              <span className="sr-only">{`Move ${record.title}`}</span>
              <select
                value={currentGroupValue}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  onMoveRecord(record.record_id, event.target.value);
                  setMoveExpanded(false);
                }}
                className="w-full rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                aria-label={`Move ${record.title}`}
              >
                <option value="">Unassigned</option>
                {groupOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const KanbanColumn = ({
  group,
  canMove,
  canCreate,
  readOnly = false,
  metadataFieldIds,
  groupOptions,
  isCollapsed,
  isCreateOpen,
  createTitle,
  createError,
  createSubmitting,
  wipLimit,
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
}: {
  group: KanbanModuleGroup;
  canMove: boolean;
  canCreate: boolean;
  readOnly?: boolean;
  metadataFieldIds?: KanbanMetadataFieldIds;
  groupOptions: KanbanGroupOption[];
  isCollapsed: boolean;
  isCreateOpen: boolean;
  createTitle: string;
  createError: string | null;
  createSubmitting: boolean;
  wipLimit?: number;
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
}) => {
  const { isOver, setNodeRef } = useDroppable({ id: group.id });
  const count = group.records.length;
  const overLimit = typeof wipLimit === 'number' && count > wipLimit;
  const showCreateComposer = !readOnly && canCreate;

  return (
    <section
      className={cn('shrink-0 space-y-2 transition-[width] motion-reduce:transition-none', isCollapsed ? 'w-12' : 'w-[18rem]')}
      aria-label={`${group.label} column`}
    >
      <header className="rounded-control px-1">
        <div className="flex items-center gap-1">
          <h5 className="flex-1 truncate text-sm font-bold text-text" title={group.label}>
            {group.label}
          </h5>
          <span className={cn('shrink-0 text-[11px] text-muted', overLimit && 'text-danger')} aria-label={`${count} cards`}>
            {count}
          </span>
          <IconButton
            aria-label={isCollapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
          >
            <Icon name="chevron-down" className={cn('h-3.5 w-3.5 transition-transform', isCollapsed && '-rotate-90')} />
          </IconButton>
        </div>
        {overLimit ? <p className="text-[11px] text-danger">Over limit ({count}/{wipLimit})</p> : null}
      </header>

      {!isCollapsed ? (
        <div
          ref={setNodeRef}
          role="list"
          className={cn(
            'min-h-16 space-y-2 rounded-panel border border-dashed p-2 transition-colors motion-reduce:transition-none',
            isOver ? 'border-primary bg-primary/5' : overLimit ? 'border-danger' : 'border-border-muted',
          )}
          aria-label={`${group.label} drop zone`}
        >
          <SortableContext items={group.records.map((record) => `record:${record.record_id}`)} strategy={verticalListSortingStrategy}>
            {group.records.length === 0 ? <p className="py-4 text-center text-xs text-muted">No cards</p> : null}
            {group.records.map((record) => (
              <SortableCard
                key={record.record_id}
                record={record}
                canMove={canMove}
                readOnly={readOnly}
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
}: KanbanModuleSkinProps) => {
  const canMove = groupingConfigured && !readOnly;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollContentRef = useRef<HTMLDivElement | null>(null);
  const [showScrollFade, setShowScrollFade] = useState(false);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [groupingFieldSelection, setGroupingFieldSelection] = useState('');
  const [createState, setCreateState] = useState<{
    groupId: string | null;
    title: string;
    error: string | null;
    isSubmitting: boolean;
  }>({
    groupId: null,
    title: '',
    error: null,
    isSubmitting: false,
  });

  const recordGroupById = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const record of group.records) {
        map.set(record.record_id, group.id);
      }
    }
    return map;
  }, [groups]);

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
              onChange={(event) => {
                const fieldId = event.target.value;
                setGroupingFieldSelection(fieldId);
                if (fieldId) {
                  onConfigureGrouping?.(fieldId);
                  setGroupingFieldSelection('');
                }
              }}
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

  const onDragEnd = (event: DragEndEvent) => {
    if (!canMove) {
      return;
    }
    if (!event.over) {
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

  const handleToggleCollapse = (group: KanbanModuleGroup) => {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(group.id)) {
        next.delete(group.id);
        return next;
      }

      next.add(group.id);

      if (createState.groupId === group.id) {
        setCreateState({
          groupId: null,
          title: '',
          error: null,
          isSubmitting: false,
        });
      }

      if (group.records.some((record) => record.record_id === editingRecordId)) {
        setEditingRecordId(null);
      }

      return next;
    });
  };

  const handleOpenCreate = (groupId: string) => {
    setCreateState((current) => {
      if (current.groupId === groupId) {
        return {
          groupId: null,
          title: '',
          error: null,
          isSubmitting: false,
        };
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
      setCreateState({
        groupId: null,
        title: '',
        error: null,
        isSubmitting: false,
      });
    } catch (error) {
      setCreateState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Unable to create card.',
        isSubmitting: false,
      }));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {canMove || !groupingConfigured ? (
        <div className="flex items-center gap-2 px-1">
          <p className="text-xs text-muted">{canMove ? 'Drag to move.' : 'Ungrouped.'}</p>
        </div>
      ) : null}
      {!groupingConfigured ? (
        <p className="rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-muted">{groupingMessage ?? 'No grouping.'}</p>
      ) : null}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="relative min-h-0 flex-1">
          <div ref={scrollContainerRef} className="h-full overflow-x-auto pb-1">
            <div ref={scrollContentRef} className="flex gap-3">
              {groups.map((group) => (
                <KanbanColumn
                  key={group.id}
                  group={group}
                  canMove={canMove}
                  canCreate={typeof onCreateRecord === 'function'}
                  readOnly={readOnly}
                  metadataFieldIds={metadataFieldIds}
                  groupOptions={groupOptions}
                  isCollapsed={collapsedGroupIds.has(group.id)}
                  isCreateOpen={createState.groupId === group.id}
                  createTitle={createState.title}
                  createError={createState.groupId === group.id ? createState.error : null}
                  createSubmitting={createState.groupId === group.id && createState.isSubmitting}
                  wipLimit={wipLimits?.[group.id]}
                  editingRecordId={editingRecordId}
                  onOpenRecord={onOpenRecord}
                  onMoveRecord={onMoveRecord}
                  onToggleCollapse={() => handleToggleCollapse(group)}
                  onOpenCreate={handleOpenCreate}
                  onCreateTitleChange={(value) => setCreateState((current) => ({ ...current, title: value, error: null }))}
                  onCreateRecord={handleCreateRecord}
                  onCancelCreate={() =>
                    setCreateState({
                      groupId: null,
                      title: '',
                      error: null,
                      isSubmitting: false,
                    })
                  }
                  onStartEditing={setEditingRecordId}
                  onStopEditing={() => setEditingRecordId(null)}
                  onUpdateRecord={onUpdateRecord}
                  onDeleteRecord={onDeleteRecord}
                />
              ))}
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
