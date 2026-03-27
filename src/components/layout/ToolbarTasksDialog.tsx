import type { FC } from 'react';
import { cn } from '../../lib/cn';
import type { HubTaskSummary } from '../../services/hub/types';
import { formatQuickNavTime, priorityBorderColor, projectDotClassName } from './appShellUtils';

interface ToolbarTasksDialogProps {
  bucketedTasks: Array<{ id: string; label: string; items: HubTaskSummary[] }>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenTask: (recordId: string) => void;
  onNewTask: () => void;
}

export const ToolbarTasksDialogContent: FC<ToolbarTasksDialogProps> = ({
  bucketedTasks,
  loading,
  error,
  onRetry,
  onOpenTask,
  onNewTask,
}) => (
  <div className="space-y-3">
    {loading ? <p className="text-sm text-muted">Loading tasks...</p> : null}
    {error ? (
      <div className="rounded-panel border border-danger/30 bg-danger/5 p-3" role="alert">
        <p className="text-sm text-danger">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-control border border-border-muted px-3 py-1.5 text-sm text-text"
        >
          Retry
        </button>
      </div>
    ) : null}
    {!loading && !error ? (
      bucketedTasks.length === 0 ? (
        <div className="space-y-3 rounded-panel border border-border-muted bg-surface px-4 py-8 text-center">
          <p className="text-sm text-muted">No tasks yet.</p>
          <button
            type="button"
            onClick={onNewTask}
            className="rounded-control border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
          >
            New task
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {bucketedTasks.map((bucket) => (
            <section key={bucket.id} aria-labelledby={`toolbar-task-bucket-${bucket.id}`} className="space-y-2">
              <h3 id={`toolbar-task-bucket-${bucket.id}`} className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {bucket.label}
              </h3>
              <div className="space-y-2">
                {bucket.items.map((task) => {
                  const projectLabel = task.project_name || 'Inbox & Unassigned';
                  const dueLabel = formatQuickNavTime(task.task_state.due_at, 'No due date');
                  return (
                    <button
                      key={task.record_id}
                      type="button"
                      onClick={() => onOpenTask(task.record_id)}
                      aria-label={`Open task ${task.title}, due ${dueLabel}`}
                      className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      style={{
                        borderLeftWidth: '3px',
                        borderLeftStyle: 'solid',
                        borderLeftColor: priorityBorderColor(task.task_state.priority),
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="truncate text-sm font-medium text-text flex-1 min-w-0">{task.title}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <span className={cn('inline-block h-2 w-2 rounded-full', projectDotClassName(task.project_id))} aria-hidden="true" />
                            <span className="truncate">{projectLabel}</span>
                          </span>
                          <span className="text-xs text-text-secondary whitespace-nowrap">{dueLabel}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )
    ) : null}
  </div>
);
