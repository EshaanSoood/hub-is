import { CalendarModuleSkin, type CalendarScope } from '../../components/project-space/CalendarModuleSkin';
import { RemindersModuleSkin } from '../../components/project-space/RemindersModuleSkin';
import { TasksModuleSkin } from '../../components/project-space/TasksModuleSkin';
import { adaptTaskSummaries } from '../../components/project-space/taskAdapter';
import type { HomeOverlayId } from './navigation';
import type { HomeRuntime } from './useHomeRuntime';

interface HomeOverlayHostProps {
  activeOverlay: HomeOverlayId | null;
  runtime: HomeRuntime;
  onClearOverlay: () => void;
  onOpenRecord: (recordId: string) => void;
}

const readFullPageTitle = (activeOverlay: HomeOverlayId | null) => {
  if (activeOverlay === 'tasks') {
    return 'Tasks';
  }
  if (activeOverlay === 'calendar') {
    return 'Calendar';
  }
  if (activeOverlay === 'reminders') {
    return 'Reminders';
  }
  return 'Home';
};

export const HomeOverlayHost = ({
  activeOverlay,
  runtime,
  onClearOverlay,
  onOpenRecord,
}: HomeOverlayHostProps) => {
  if (activeOverlay !== 'tasks' && activeOverlay !== 'calendar' && activeOverlay !== 'reminders') {
    return null;
  }

  const fullPageTitle = readFullPageTitle(activeOverlay);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-panel border border-subtle bg-elevated p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Home</p>
          <h2 className="text-lg font-semibold text-text">{fullPageTitle}</h2>
        </div>
        <button
          type="button"
          onClick={onClearOverlay}
          className="rounded-control border border-border-muted bg-surface px-3 py-1.5 text-sm font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          Back to Dashboard
        </button>
      </header>

      {runtime.homeError && activeOverlay !== 'reminders' ? (
        <p className="rounded-panel border border-danger bg-danger-subtle px-4 py-3 text-sm text-danger" role="alert">
          {runtime.homeError}
        </p>
      ) : null}

      <section className="rounded-panel border border-subtle bg-elevated p-4">
        {activeOverlay === 'tasks' ? (
          <TasksModuleSkin
            sizeTier="L"
            tasks={adaptTaskSummaries(runtime.homeData.tasks)}
            tasksLoading={runtime.homeLoading}
            onOpenRecord={onOpenRecord}
            readOnly
          />
        ) : null}
        {activeOverlay === 'calendar' ? (
          <CalendarModuleSkin
            sizeTier="L"
            events={runtime.filteredCalendarEvents}
            loading={runtime.homeLoading}
            scope={runtime.calendarScope as CalendarScope}
            onScopeChange={runtime.setCalendarScope}
            onOpenRecord={onOpenRecord}
          />
        ) : null}
        {activeOverlay === 'reminders' ? (
          <RemindersModuleSkin
            sizeTier="L"
            reminders={runtime.remindersRuntime.reminders}
            loading={runtime.remindersRuntime.loading}
            error={runtime.remindersRuntime.error}
            onDismiss={runtime.onDismissReminder}
            onSnooze={(reminderId) => runtime.onSnoozeReminder(reminderId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())}
            onCreate={runtime.remindersRuntime.create}
          />
        ) : null}
      </section>
    </section>
  );
};
