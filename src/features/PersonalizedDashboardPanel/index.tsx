import { useEffect, useMemo, useState } from 'react';
import { HubOsWordmark } from '../../components/primitives';
import type { ProjectRecord } from '../../types/domain';
import { DayStripSection } from './DayStripSection';
import { ProjectLensView } from './ProjectLensView';
import { StreamView } from './StreamView';
import { ViewSwitcher } from './ViewSwitcher';
import { useDashboardAggregation } from './hooks/useDashboardAggregation';
import { useDashboardData } from './hooks/useDashboardData';
import { useDashboardMutations } from './hooks/useDashboardMutations';
import { useProjectLens } from './hooks/useProjectLens';
import type { HubDashboardView, HubHomeData } from './types';
import { formatCountLabel, greetingForHour } from './utils';

const VIEW_ORDER: HubDashboardView[] = ['project-lens', 'stream'];

export const PersonalizedDashboardPanel = ({
  homeData,
  homeLoading,
  homeReady,
  homeError,
  projects,
  onOpenRecord,
  initialView,
  onViewChange,
}: {
  homeData: HubHomeData;
  homeLoading: boolean;
  homeReady: boolean;
  homeError: string | null;
  projects: ProjectRecord[];
  onOpenRecord: (recordId: string) => void;
  initialView?: HubDashboardView;
  onViewChange?: (view: HubDashboardView) => void;
}) => {
  const { accessToken, remindersRuntime, hasHubView } = useDashboardData(projects);
  const [activeView, setActiveView] = useState<HubDashboardView>(initialView ?? 'project-lens');
  const [now, setNow] = useState(() => new Date());

  const availableViewIds = useMemo(
    () => (hasHubView ? VIEW_ORDER : (['project-lens'] as HubDashboardView[])),
    [hasHubView],
  );
  const selectedView = availableViewIds.includes(activeView) ? activeView : availableViewIds[0];

  const { items, dailyData, totalPipCounts } = useDashboardAggregation({
    homeData,
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
    const timerId = window.setTimeout(() => {
      setActiveView(initialView ?? 'project-lens');
    }, 0);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [initialView]);

  useEffect(() => {
    onViewChange?.(selectedView);
  }, [onViewChange, selectedView]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const greeting = greetingForHour(new Date().getHours());

  return (
    <div className="relative rounded-panel border border-subtle bg-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-hidden="true" className="shrink-0 text-text">
          <HubOsWordmark className="block text-text" width={116} />
        </div>
        {homeLoading ? <span className="text-xs text-muted">Refreshing…</span> : null}
      </div>

      {homeError ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {homeError}
        </p>
      ) : null}

      <DayStripSection
        countReady={homeReady}
        greeting={`${greeting} · ${formatCountLabel(totalPipCounts.events, 'event')}, ${formatCountLabel(totalPipCounts.tasks, 'task')}, ${formatCountLabel(totalPipCounts.reminders, 'reminder')}`}
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

      <ViewSwitcher
        selectedView={selectedView}
        availableViewIds={availableViewIds}
        onSelectView={setActiveView}
      />

      <div className="mt-3">
        {selectedView === 'project-lens' ? (
          <ProjectLensView items={items} projects={projects} onOpenRecord={onOpenRecord} />
        ) : null}
        {selectedView === 'stream' ? (
          <StreamView items={items} projects={projects} onOpenRecord={onOpenRecord} now={now} />
        ) : null}
      </div>
    </div>
  );
};

export type { HubDashboardItem, HubDashboardView } from './types';
export { buildTaskItems } from './hooks/useDashboardAggregation';
