import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { HubRecordSummary } from '../../../services/hub/types';
import { cn } from '../../../lib/cn';
import { useLongPress } from '../../../hooks/useLongPress';
import { getPriorityClasses } from '../../../lib/priorityStyles';
import { Icon, IconButton } from '../../primitives';
import type { PriorityLevel } from '../designTokens';
import { formatShortDate } from '../taskAdapter';
import type {
  EditableCardFields,
  KanbanGroupOption,
  KanbanInsertHandlers,
  KanbanMetadataFieldIds,
} from './types';

interface KanbanCardProps extends KanbanInsertHandlers {
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

export const KanbanCard = ({
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
  activeItemId,
  activeItemType,
  setActiveItem,
  clearActiveItem,
  onInsertToEditor,
}: KanbanCardProps) => {
  const editable = !readOnly && typeof onUpdateRecord === 'function';
  const deletable = !readOnly && typeof onDeleteRecord === 'function';
  const showColumnSelector = canMove && !readOnly;
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const wasEditingRef = useRef(false);
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
  const hasDirtyChanges = draft.title.trim() !== baseline.title
    || draft.priority !== baseline.priority
    || draft.assignee.trim() !== baseline.assignee
    || draft.dueDate !== baseline.dueDate;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `record:${record.record_id}`,
    disabled: !canMove,
  });

  useEffect(() => {
    const nextState = readEditableFields(record, metadataFieldIds);

    if (!isEditing) {
      if (wasEditingRef.current && hasDirtyChanges) {
        return;
      }
      setDraft(nextState);
      setBaseline(nextState);
      setUpdateError(null);
      setShowDeleteConfirm(false);
      wasEditingRef.current = false;
    }
  }, [hasDirtyChanges, isEditing, metadataFieldIds, record]);

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
                className="interactive interactive-fold rounded-control border border-primary bg-primary px-2 py-1 text-xs font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
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
            </button>

            <div className="mt-2 flex flex-wrap items-center gap-2">
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
              {showColumnSelector ? (
                <select
                  value={currentGroupValue}
                  onPointerDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onMoveRecord(record.record_id, event.target.value)}
                  className="w-full rounded-control border border-border-muted bg-surface px-1.5 py-0.5 text-[11px] text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:ml-auto sm:w-auto sm:max-w-[11rem]"
                  aria-label={`Column for ${record.title}`}
                >
                  <option value="">Unassigned</option>
                  {groupOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="absolute right-0 top-0 flex items-start gap-1">
              {editable ? (
                <IconButton
                  aria-label={`Edit ${record.title}`}
                  variant="ghost"
                  size="sm"
                  className="opacity-100 transition-opacity md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100"
                  onClick={() => onStartEditing(record.record_id)}
                >
                  <Icon name="edit" className="h-3.5 w-3.5" />
                </IconButton>
              ) : null}

              {deletable ? (
                <IconButton
                  aria-label={`Delete ${record.title}`}
                  variant="ghost"
                  size="sm"
                  className="opacity-100 transition-opacity md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100"
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setDeleteError(null);
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
    </div>
  );
};
