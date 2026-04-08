import { useEffect, useMemo, useState } from 'react';
import { HubOsWordmark, Icon } from '../../components/primitives';
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
  homeError,
  projects,
  onOpenRecord,
  initialView,
  onViewChange,
}: {
  homeData: HubHomeData;
  homeLoading: boolean;
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
    onDropFromTriage,
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
    <section className="rounded-panel border border-subtle bg-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="heading" aria-level={1} aria-label="Hub OS" className="hub-home-wordmark">
          <HubOsWordmark aria-label="Hub OS" className="block h-auto w-[116px]" width={116} />
        </div>
        {homeLoading ? <span className="text-xs text-muted">Refreshing…</span> : null}
      </div>

      {homeError ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {homeError}
        </p>
      ) : null}

      <section className={`${homeError ? 'mt-3' : 'mt-4'} rounded-panel border border-border-muted bg-surface px-3 py-2`}>
        <h2 className="sr-only">Today&apos;s overview</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text">{greeting}</p>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span
              className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1"
              aria-label={formatCountLabel(totalPipCounts.events, 'event')}
            >
              <Icon name="calendar" className="text-[13px]" aria-hidden="true" />
              <span aria-hidden="true">{totalPipCounts.events}</span>
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1"
              aria-label={formatCountLabel(totalPipCounts.tasks, 'task')}
            >
              <Icon name="tasks" className="text-[13px]" aria-hidden="true" />
              <span aria-hidden="true">{totalPipCounts.tasks}</span>
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1"
              aria-label={formatCountLabel(totalPipCounts.reminders, 'reminder')}
            >
              <Icon name="reminders" className="text-[13px]" aria-hidden="true" />
              <span aria-hidden="true">{totalPipCounts.reminders}</span>
            </span>
          </div>
        </div>
      </section>

      <DayStripSection
        filteredDailyData={filteredDailyData}
        dayCounts={dayCounts}
        activeProjectFilter={activeProjectFilter}
        projectOptions={projectOptions}
        onProjectFilterChange={setProjectFilter}
        onOpenRecord={onOpenRecord}
        onDropFromTriage={onDropFromTriage}
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
    </section>
  );
};

export type { HubDashboardItem, HubDashboardView } from './types';
export { buildTaskItems } from './hooks/useDashboardAggregation';
