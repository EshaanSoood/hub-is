import { useEffect, useState, type ReactNode } from 'react';
import { InlineNotice } from '../../components/primitives';
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
  onOpenRecord: (recordId: string) => void;
  projectContent: ReactNode;
  projects: ProjectRecord[];
  runtime: HomeRuntime;
}

export const HomeDashboardSurface = ({
  activeContentView,
  homeError,
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
    <div className="space-y-4">
      {homeError ? (
        <InlineNotice variant="danger" title="Home unavailable">
          {homeError}
        </InlineNotice>
      ) : null}

      <DayStripSection
        countReady={runtime.homeReady}
        greeting={`${greeting} · ${formatCountLabel(totalPipCounts.events, 'event')}, ${formatCountLabel(totalPipCounts.tasks, 'task')}, ${formatCountLabel(totalPipCounts.reminders, 'reminder')}`}
        headerActions={null}
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
        <ProjectLensView items={items} projects={projects} onOpenRecord={onOpenRecord} title="Hub" />
      ) : null}
      {activeContentView === 'stream' ? (
        <section className="section-scored space-y-4 rounded-panel bg-elevated p-4 shadow-soft">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-text">Stream</h2>
            <p className="text-sm text-muted">Review active tasks and events across Home without leaving your personal space.</p>
          </div>
          <StreamView items={items} projects={projects} onOpenRecord={onOpenRecord} now={now} />
        </section>
      ) : null}
    </div>
  );
};
