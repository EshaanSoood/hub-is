import { motion, useReducedMotion } from 'framer-motion';
import { Dialog } from '../../components/primitives';
import { dialogLayoutIds } from '../../styles/motion';
import type { HomeRecordInspectorRuntime } from './types';

interface HomeRecordInspectorDialogProps {
  runtime: HomeRecordInspectorRuntime;
}

export const HomeRecordInspectorDialog = ({ runtime }: HomeRecordInspectorDialogProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <>
      {!prefersReducedMotion && runtime.selectedRecordTriggerRect ? (
        <motion.div
          layoutId={dialogLayoutIds.myHubRecordInspector}
          aria-hidden="true"
          className="pointer-events-none fixed z-[299] opacity-0"
          style={{
            top: runtime.selectedRecordTriggerRect.top,
            left: runtime.selectedRecordTriggerRect.left,
            width: runtime.selectedRecordTriggerRect.width,
            height: runtime.selectedRecordTriggerRect.height,
          }}
        />
      ) : null}

      <Dialog
        open={Boolean(runtime.selectedRecordId)}
        onClose={runtime.closeRecord}
        triggerRef={runtime.selectedRecordTriggerRef}
        layoutId={dialogLayoutIds.myHubRecordInspector}
        motionVariant="fold-sheet"
        title="Record Inspector"
        description="Review the selected item without leaving Home."
      >
        {runtime.selectedRecordLoading ? <p className="text-sm text-muted">Loading record...</p> : null}
        {runtime.selectedRecordError ? (
          <p className="text-sm text-danger" role="alert">
            {runtime.selectedRecordError}
          </p>
        ) : null}
        {runtime.selectedRecord ? (
          <div className="space-y-4">
            <section className="rounded-panel border border-border-muted bg-surface p-4">
              <h2 className="text-base font-semibold text-text">{runtime.selectedRecord.title}</h2>
              <p className="mt-1 text-xs text-muted">
                Collection: {runtime.selectedRecord.schema?.name || runtime.selectedRecord.collection_id}
              </p>
              <p className="mt-2 text-xs text-muted">
                {runtime.selectedRecord.capabilities.task_state?.status || runtime.selectedRecord.capabilities.event_state ? 'Active record' : 'Record'}
                {runtime.selectedRecord.capabilities.task_state?.priority
                  ? ` · ${runtime.selectedRecord.capabilities.task_state.priority}`
                  : ''}
                {runtime.selectedRecord.origin_kind ? ` · ${runtime.selectedRecord.origin_kind}` : ''}
              </p>
            </section>

            <section className="rounded-panel border border-border-muted bg-surface p-4">
              <h3 className="text-sm font-semibold text-primary">Details</h3>
              {runtime.selectedRecord.capabilities.event_state ? (
                <p className="mt-2 text-sm text-muted">
                  Event starts {new Date(runtime.selectedRecord.capabilities.event_state.start_dt).toLocaleString()}.
                </p>
              ) : null}
              <p className="mt-2 text-sm text-muted">
                {runtime.selectedRecord.comments.length > 0
                  ? `${runtime.selectedRecord.comments.length} discussion comment(s).`
                  : 'No comments yet.'}
              </p>
              {Object.keys(runtime.selectedRecord.values).length > 0 ? (
                <dl className="mt-3 space-y-2">
                  {Object.entries(runtime.selectedRecord.values).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{key}</dt>
                      <dd className="text-sm text-text">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </section>
          </div>
        ) : null}
      </Dialog>
    </>
  );
};
