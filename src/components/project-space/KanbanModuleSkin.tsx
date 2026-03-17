import { useMemo } from 'react';
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
import { PRIORITY_COLORS, type PriorityLevel } from './designTokens';
import { ModuleEmptyState, ModuleLoadingState } from './ModuleFeedback';

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

interface KanbanModuleSkinProps {
  groups: KanbanModuleGroup[];
  groupOptions: KanbanGroupOption[];
  loading: boolean;
  groupingConfigured: boolean;
  readOnly?: boolean;
  groupingMessage?: string;
  metadataFieldIds?: {
    priority?: string | null;
    assignee?: string | null;
    dueDate?: string | null;
  };
  onOpenRecord: (recordId: string) => void;
  onMoveRecord: (recordId: string, nextGroup: string) => void;
}

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

const SortableCard = ({
  record,
  canMove,
  readOnly = false,
  metadataFieldIds,
  currentGroupValue,
  onOpenRecord,
  groupOptions,
  onMoveRecord,
}: {
  record: HubRecordSummary;
  canMove: boolean;
  readOnly?: boolean;
  metadataFieldIds?: { priority?: string | null; assignee?: string | null; dueDate?: string | null };
  currentGroupValue: string;
  onOpenRecord: (recordId: string) => void;
  groupOptions: KanbanGroupOption[];
  onMoveRecord: (recordId: string, nextGroup: string) => void;
}) => {
  const priorityRaw = readStringField(record, metadataFieldIds?.priority).toLowerCase();
  const priority = isPriorityLevel(priorityRaw) ? priorityRaw : null;
  const assignee = readStringField(record, metadataFieldIds?.assignee);
  const dueDate = readStringField(record, metadataFieldIds?.dueDate);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `record:${record.record_id}`,
    disabled: !canMove,
  });

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
      <div className="rounded-control border border-border-muted bg-surface-elevated p-3 transition-colors hover:border-primary/50 motion-reduce:transition-none">
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            onClick={() => onOpenRecord(record.record_id)}
            aria-label={`Open record: ${record.title}`}
          >
            <span className="line-clamp-2 block text-sm font-bold text-text">{record.title}</span>
            <span className="mt-2 flex items-center gap-2">
              {priority ? (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: PRIORITY_COLORS[priority] }}
                  aria-label={`Priority: ${priority}`}
                />
              ) : null}
              {assignee ? (
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border-muted bg-surface text-[10px] font-medium text-text-secondary"
                  aria-label={assignee}
                  title={assignee}
                >
                  {assignee.slice(0, 1).toUpperCase()}
                </span>
              ) : null}
              {dueDate ? <span className="truncate text-[11px] text-text-secondary">{dueDate}</span> : null}
            </span>
          </button>

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
      {canMove ? (
        <label className="mt-2 block text-[11px] text-muted">
          Move
          <select
            value={currentGroupValue}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onMoveRecord(record.record_id, event.target.value)}
            className="mt-1 w-full rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
      ) : (
        <p className="mt-2 text-[11px] text-muted">{readOnly ? 'This board is read-only.' : 'Grouping is not configured for this view.'}</p>
      )}
    </div>
  );
};

const KanbanColumn = ({
  group,
  canMove,
  readOnly = false,
  metadataFieldIds,
  onOpenRecord,
  groupOptions,
  onMoveRecord,
}: {
  group: KanbanModuleGroup;
  canMove: boolean;
  readOnly?: boolean;
  metadataFieldIds?: { priority?: string | null; assignee?: string | null; dueDate?: string | null };
  onOpenRecord: (recordId: string) => void;
  groupOptions: KanbanGroupOption[];
  onMoveRecord: (recordId: string, nextGroup: string) => void;
}) => {
  const { isOver, setNodeRef } = useDroppable({ id: group.id });

  return (
    <section className="w-[18rem] shrink-0 space-y-2" aria-label={`${group.label} column`}>
      <header className="flex items-center justify-between gap-2 rounded-control px-1">
        <h5 className="truncate text-sm font-bold text-text">{group.label}</h5>
        <span className="text-[11px] text-muted" aria-label={`${group.records.length} cards`}>
          {group.records.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        role="list"
        className="min-h-16 space-y-2 rounded-panel border border-dashed p-2 transition-colors motion-reduce:transition-none"
        style={{
          borderColor: isOver ? 'var(--color-primary)' : 'var(--color-border-muted)',
          backgroundColor: isOver ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : 'transparent',
        }}
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
              onOpenRecord={onOpenRecord}
              groupOptions={groupOptions}
              onMoveRecord={onMoveRecord}
            />
          ))}
        </SortableContext>
      </div>
    </section>
  );
};

export const KanbanModuleSkin = ({
  groups,
  groupOptions,
  loading,
  groupingConfigured,
  readOnly = false,
  groupingMessage,
  metadataFieldIds,
  onOpenRecord,
  onMoveRecord,
}: KanbanModuleSkinProps) => {
  const canMove = groupingConfigured && !readOnly;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const recordGroupById = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const record of group.records) {
        map.set(record.record_id, group.id);
      }
    }
    return map;
  }, [groups]);

  if (loading) {
    return <ModuleLoadingState label="Loading kanban cards" rows={6} />;
  }

  if (groups.length === 0) {
    return <ModuleEmptyState title="No kanban grouping configured yet." description="Set a grouping field on the view to render columns." />;
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs text-muted">
          {canMove ? 'Drag cards between columns or use each card’s Move control.' : readOnly ? 'Read-only kanban view.' : 'Showing ungrouped cards.'}
        </p>
      </div>
      {!groupingConfigured ? (
        <p className="rounded-control border border-border-muted bg-surface px-2 py-1 text-xs text-muted">
          {groupingMessage || 'No grouping field configured. Rendering all cards in a single ungrouped column.'}
        </p>
      ) : null}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {groups.map((group) => (
            <KanbanColumn
              key={group.id}
              group={group}
              canMove={canMove}
              readOnly={readOnly}
              metadataFieldIds={metadataFieldIds}
              onOpenRecord={onOpenRecord}
              groupOptions={groupOptions}
              onMoveRecord={onMoveRecord}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
};
