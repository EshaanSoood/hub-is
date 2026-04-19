import { RecordInspectorSchemaFields } from './RecordInspectorSchemaFields';
import { RecordInspectorSharedSections } from './RecordInspectorSharedSections';
import { TaskRecordSummary } from '../record-primitives/TaskRecordSummary';
import type { ReactElement } from 'react';
import type { RecordInspectorBodyProps } from './recordInspectorTypes';

export const TaskRecordInspector = ({
  inspectorRecord,
  inspectorMutationPane,
  inspectorMutationPaneCanEdit,
  savingValues,
  onSaveRecordField,
  onOpenSourcePane,
  ...sharedSectionProps
}: RecordInspectorBodyProps): ReactElement => {
  const taskState = inspectorRecord.capabilities.task_state;

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-panel border border-border-muted p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Task</p>
        <p className="mt-1 text-xs text-muted">Collection: {inspectorRecord.schema?.name || inspectorRecord.collection_id}</p>
        <TaskRecordSummary
          className="mt-3"
          title={inspectorRecord.title}
          status={(taskState?.status as 'todo' | 'in_progress' | 'done' | 'cancelled') || 'todo'}
          dueLabel={null}
          priorityLabel={taskState?.priority || null}
          assigneeLabel={inspectorRecord.capabilities.assignments[0]?.user_id || null}
          subtaskCount={inspectorRecord.relations.outgoing.length}
        />
        {inspectorRecord.source_pane?.pane_id ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Origin: {inspectorRecord.source_pane.pane_name || inspectorRecord.source_pane.pane_id}</span>
            <button
              type="button"
              className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
              onClick={() => onOpenSourcePane?.()}
            >
              Open source pane
            </button>
          </div>
        ) : null}
        {!inspectorMutationPaneCanEdit ? (
          <p className="mt-2 text-xs text-muted">
            {inspectorMutationPane?.pane_id
              ? `Opened in read-only pane ${inspectorMutationPane.name || inspectorMutationPane.pane_id}.`
              : 'Opened outside a pane edit context.'}{' '}
            You can review this task and add comments, but only pane editors can change fields, attachments, or relations.
          </p>
        ) : null}
        <RecordInspectorSchemaFields
          fields={inspectorRecord.schema?.fields}
          values={inspectorRecord.values}
          canEdit={inspectorMutationPaneCanEdit}
          onSaveRecordField={onSaveRecordField}
        />
        {savingValues ? <p className="mt-2 text-xs text-muted">Saving...</p> : null}
      </section>

      <RecordInspectorSharedSections
        {...sharedSectionProps}
        inspectorRecord={inspectorRecord}
        inspectorMutationPaneCanEdit={inspectorMutationPaneCanEdit}
      />
    </div>
  );
};
