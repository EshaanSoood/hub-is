import { useMemo } from 'react';
import { ContextBar } from '../../components/hub-home/ContextBar';
import { DayStrip } from '../../components/hub-home/DayStrip';
import { BacklogPanel } from '../../components/hub-home/BacklogPanel';
import type { BacklogDragPayload } from '../../components/hub-home/types';
import type { DashboardDailyData, DashboardDayCounts, ProjectOption } from './types';

interface DayStripSectionProps {
  countReady: boolean;
  greeting: string;
  filteredDailyData: DashboardDailyData;
  dayCounts: DashboardDayCounts;
  activeProjectFilter: string;
  projectOptions: ProjectOption[];
  onProjectFilterChange: (value: string) => void;
  onOpenRecord: (recordId: string) => void;
  onDropFromBacklog: (payload: BacklogDragPayload, assignedAt: Date) => Promise<void>;
  onCompleteTask: (recordId: string) => Promise<void>;
  onRescheduleTask: (recordId: string, dueAtIso: string) => Promise<void>;
  onSnoozeTask: (recordId: string) => Promise<void>;
  onDismissReminder: (reminderId: string) => Promise<void>;
  onSnoozeReminder: (reminderId: string, remindAtIso: string) => Promise<void>;
}

export const DayStripSection = ({
  countReady,
  greeting,
  filteredDailyData,
  dayCounts,
  activeProjectFilter,
  projectOptions,
  onProjectFilterChange,
  onOpenRecord,
  onDropFromBacklog,
  onCompleteTask,
  onRescheduleTask,
  onSnoozeTask,
  onDismissReminder,
  onSnoozeReminder,
}: DayStripSectionProps) => {
  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat([], { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()),
    [],
  );

  return (
    <section aria-labelledby="daily-brief-heading" className="mt-4 rounded-panel border border-border-muted bg-surface p-4">
      <h2 id="daily-brief-heading" className="font-serif text-xl font-semibold text-text">Daily Brief</h2>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text">{greeting}</p>
          <p className="text-xs text-muted">{dateLabel}</p>
        </div>
      </div>

      <DayStrip
        className="mt-3"
        events={filteredDailyData.dayEvents}
        tasks={filteredDailyData.timedTasks}
        reminders={filteredDailyData.timedReminders}
        typeFilter="all"
        onOpenRecord={onOpenRecord}
        onDropFromBacklog={onDropFromBacklog}
      />

      <ContextBar
        className="mt-3"
        projectFilter={activeProjectFilter}
        projectOptions={projectOptions}
        onProjectFilterChange={onProjectFilterChange}
        eventCount={dayCounts.events}
        taskCount={dayCounts.tasks}
        reminderCount={dayCounts.reminders}
        backlogCount={dayCounts.backlog}
      />

      <BacklogPanel
        className="mt-3"
        countReady={countReady}
        overdueTasks={filteredDailyData.overdueTasks}
        untimedTasks={filteredDailyData.untimedTasks}
        missedReminders={filteredDailyData.missedReminders}
        onOpenRecord={onOpenRecord}
        onCompleteTask={onCompleteTask}
        onRescheduleTask={onRescheduleTask}
        onSnoozeTask={onSnoozeTask}
        onAssignTaskTime={onRescheduleTask}
        onDismissReminder={onDismissReminder}
        onSnoozeReminder={onSnoozeReminder}
      />
    </section>
  );
};
