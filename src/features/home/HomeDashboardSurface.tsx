import { useEffect, useState } from 'react';
import { InlineNotice } from '../../components/primitives';
import type { ProjectRecord } from '../../types/domain';
import { DayStripSection } from '../PersonalizedDashboardPanel/DayStripSection';
import { useDashboardAggregation } from '../PersonalizedDashboardPanel/hooks/useDashboardAggregation';
import { useDashboardData } from '../PersonalizedDashboardPanel/hooks/useDashboardData';
import { useDashboardMutations } from '../PersonalizedDashboardPanel/hooks/useDashboardMutations';
import { useProjectLens } from '../PersonalizedDashboardPanel/hooks/useProjectLens';
import { formatCountLabel, greetingForHour } from '../PersonalizedDashboardPanel/utils';
import type { HomeSurfaceId } from './navigation';
import { HomeOverviewSurface } from './HomeOverviewSurface';
import type { HomeRuntime } from './useHomeRuntime';

interface HomeDashboardSurfaceProps {
  accessToken: string;
  activeSurface: HomeSurfaceId;
  calendarEvents: Array<{
    record_id: string;
    title: string;
    event_state: {
      start_dt: string;
      end_dt: string;
      timezone: string;
      location: string | null;
      updated_at: string;
    };
    participants: Array<{ user_id: string; role: string | null }>;
    source_project: { project_id: string | null; project_name: string | null; doc_id: string | null } | null;
  }>;
  calendarLoading: boolean;
  calendarScope: 'relevant' | 'all';
  homeError: string | null;
  onCalendarScopeChange: (scope: 'relevant' | 'all') => void;
  onOpenRecord: (recordId: string) => void;
  onRefreshTasks: () => void;
  onSelectSurface: (surface: HomeSurfaceId) => void;
  projects: ProjectRecord[];
  runtime: HomeRuntime;
  tasks: import('../../services/hub/types').HubTaskSummary[];
  tasksError: string | null;
  tasksLoading: boolean;
}

export const HomeDashboardSurface = ({
  accessToken: homeAccessToken,
  activeSurface,
  calendarEvents,
  calendarLoading,
  calendarScope,
  homeError,
  onCalendarScopeChange,
  onOpenRecord,
  onRefreshTasks,
  onSelectSurface,
  projects,
  runtime,
  tasks,
  tasksError,
  tasksLoading,
}: HomeDashboardSurfaceProps) => {
  const { accessToken: dashboardAccessToken, remindersRuntime } = useDashboardData(projects);
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
    accessToken: dashboardAccessToken,
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
    <div className="space-y-3">
      {homeError ? (
        <InlineNotice variant="danger" title="Home unavailable">
          {homeError}
        </InlineNotice>
      ) : null}

      <HomeOverviewSurface
        accessToken={homeAccessToken}
        activeSurface={activeSurface}
        calendarEvents={calendarEvents}
        calendarLoading={calendarLoading}
        calendarScope={calendarScope}
        items={items}
        now={now}
        onCalendarScopeChange={onCalendarScopeChange}
        onCreateReminder={remindersRuntime.create}
        onDismissReminder={onDismissReminder}
        onOpenRecord={onOpenRecord}
        onRefreshTasks={onRefreshTasks}
        onSelectSurface={onSelectSurface}
        onSnoozeReminder={onSnoozeReminder}
        projects={projects}
        reminders={remindersRuntime.reminders}
        remindersError={remindersRuntime.error}
        remindersLoading={remindersRuntime.loading}
        showSurfaceTabs={false}
        tasks={tasks}
        tasksError={tasksError}
        tasksLoading={tasksLoading}
        todaySection={(
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
        )}
      />
    </div>
  );
};
