import { useEffect, useState, type ReactNode } from 'react';
import { Icon, InlineNotice } from '../../components/primitives';
import type { ProjectRecord } from '../../types/domain';
import { DayStripSection } from '../PersonalizedDashboardPanel/DayStripSection';
import { ProjectLensView } from '../PersonalizedDashboardPanel/ProjectLensView';
import { StreamView } from '../PersonalizedDashboardPanel/StreamView';
import { useDashboardAggregation } from '../PersonalizedDashboardPanel/hooks/useDashboardAggregation';
import { useDashboardData } from '../PersonalizedDashboardPanel/hooks/useDashboardData';
import { useDashboardMutations } from '../PersonalizedDashboardPanel/hooks/useDashboardMutations';
import { useProjectLens } from '../PersonalizedDashboardPanel/hooks/useProjectLens';
import { formatCountLabel, greetingForHour } from '../PersonalizedDashboardPanel/utils';
import type { HomeContentViewId } from './navigation';
import type { HomeRuntime } from './useHomeRuntime';

interface HomeDashboardSurfaceProps {
  activeContentView: HomeContentViewId;
  homeError: string | null;
  homeLoading: boolean;
  onOpenQuickThoughts: () => void;
  onOpenRecord: (recordId: string) => void;
  projectContent: ReactNode;
  projects: ProjectRecord[];
  runtime: HomeRuntime;
}

export const HomeDashboardSurface = ({
  activeContentView,
  homeError,
  homeLoading,
  onOpenQuickThoughts,
  onOpenRecord,
  projectContent,
  projects,
  runtime,
}: HomeDashboardSurfaceProps) => {
  const { accessToken, remindersRuntime } = useDashboardData(projects);
  const [now, setNow] = useState(() => new Date());

  const { items, dailyData, totalPipCounts } = useDashboardAggregation({
    homeData: runtime.homeData,
    reminders: remindersRuntime.reminders,
    projects,
    now,
  });
  const {
    activeProjectFilter,
    projectOptions,
    filteredDailyData,
    dayCounts,
    setProjectFilter,
  } = useProjectLens({
    dailyData,
    projects,
  });
  const {
    onCompleteTask,
    onRescheduleTask,
    onSnoozeTask,
    onDismissReminder,
    onSnoozeReminder,
    onDropFromBacklog,
  } = useDashboardMutations({
    accessToken,
    refreshReminders: remindersRuntime.refresh,
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const greeting = greetingForHour(now.getHours());

  return (
    <section className="space-y-4" aria-label="Home overview">
      {homeError ? (
        <InlineNotice variant="danger" title="Home unavailable">
          {homeError}
        </InlineNotice>
      ) : null}

      <DayStripSection
        countReady={runtime.homeReady}
        greeting={`${greeting} · ${formatCountLabel(totalPipCounts.events, 'event')}, ${formatCountLabel(totalPipCounts.tasks, 'task')}, ${formatCountLabel(totalPipCounts.reminders, 'reminder')}`}
        headerActions={(
          <>
            {homeLoading ? <span className="text-xs text-muted">Refreshing…</span> : null}
            <button
              type="button"
              data-home-launcher="thoughts"
              onClick={onOpenQuickThoughts}
              className="inline-flex items-center gap-2 rounded-control border border-border-muted bg-surface px-3 py-2 text-sm font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <Icon name="thought-pile" className="text-sm" />
              <span>Quick thoughts</span>
            </button>
          </>
        )}
        now={now}
        filteredDailyData={filteredDailyData}
        dayCounts={dayCounts}
        activeProjectFilter={activeProjectFilter}
        projectOptions={projectOptions}
        onProjectFilterChange={setProjectFilter}
        onOpenRecord={onOpenRecord}
        onDropFromBacklog={onDropFromBacklog}
        onCompleteTask={onCompleteTask}
        onRescheduleTask={onRescheduleTask}
        onSnoozeTask={onSnoozeTask}
        onDismissReminder={onDismissReminder}
        onSnoozeReminder={onSnoozeReminder}
      />

      {activeContentView === 'project' ? projectContent : null}
      {activeContentView === 'lenses' ? (
        <ProjectLensView items={items} projects={projects} onOpenRecord={onOpenRecord} title="Lenses" />
      ) : null}
      {activeContentView === 'stream' ? (
        <section className="space-y-4 rounded-panel border border-subtle bg-elevated p-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-text">Stream</h2>
            <p className="text-sm text-muted">Review active tasks and events across Home without leaving your personal project.</p>
          </div>
          <StreamView items={items} projects={projects} onOpenRecord={onOpenRecord} now={now} />
        </section>
      ) : null}
    </section>
  );
};
