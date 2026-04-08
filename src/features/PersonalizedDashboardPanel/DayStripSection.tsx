import { useState } from 'react';
import { ContextBar } from '../../components/hub-home/ContextBar';
import { DayStrip } from '../../components/hub-home/DayStrip';
import { TriagePanel } from '../../components/hub-home/TriagePanel';
import type { TimelineTypeFilter, TriageDragPayload } from '../../components/hub-home/types';
import type { DashboardDailyData, DashboardDayCounts, ProjectOption } from './types';

interface DayStripSectionProps {
  filteredDailyData: DashboardDailyData;
  dayCounts: DashboardDayCounts;
  activeProjectFilter: string;
  projectOptions: ProjectOption[];
  onProjectFilterChange: (value: string) => void;
  onOpenRecord: (recordId: string) => void;
  onDropFromTriage: (payload: TriageDragPayload, assignedAt: Date) => Promise<void>;
  onCompleteTask: (recordId: string) => Promise<void>;
  onRescheduleTask: (recordId: string, dueAtIso: string) => Promise<void>;
  onSnoozeTask: (recordId: string) => Promise<void>;
  onDismissReminder: (reminderId: string) => Promise<void>;
  onSnoozeReminder: (reminderId: string, remindAtIso: string) => Promise<void>;
}

export const DayStripSection = ({
  filteredDailyData,
  dayCounts,
  activeProjectFilter,
  projectOptions,
  onProjectFilterChange,
  onOpenRecord,
  onDropFromTriage,
  onCompleteTask,
  onRescheduleTask,
  onSnoozeTask,
  onDismissReminder,
  onSnoozeReminder,
}: DayStripSectionProps) => {
  const [timelineTypeFilter, setTimelineTypeFilter] = useState<TimelineTypeFilter>('all');
  const [triageOpen, setTriageOpen] = useState(false);

  return (
    <>
      <h2 className="sr-only">Timeline</h2>
      <DayStrip
        className="mt-3"
        events={filteredDailyData.dayEvents}
        tasks={filteredDailyData.timedTasks}
        reminders={filteredDailyData.timedReminders}
        typeFilter={timelineTypeFilter}
        onOpenRecord={onOpenRecord}
        onDropFromTriage={onDropFromTriage}
      />

      <ContextBar
        className="mt-3"
        projectFilter={activeProjectFilter}
        projectOptions={projectOptions}
        onProjectFilterChange={onProjectFilterChange}
        eventCount={dayCounts.events}
        taskCount={dayCounts.tasks}
        reminderCount={dayCounts.reminders}
        triageCount={dayCounts.triage}
        timelineTypeFilter={timelineTypeFilter}
        onToggleTimelineType={(type) => {
          setTimelineTypeFilter((current) => (current === type ? 'all' : type));
        }}
        onToggleTriagePanel={() => setTriageOpen((current) => !current)}
        triageOpen={triageOpen}
      />

      {triageOpen ? <h2 className="sr-only">Triage</h2> : null}
      <TriagePanel
        className="mt-3"
        open={triageOpen}
        overdueTasks={filteredDailyData.overdueTasks}
        untimedTasks={filteredDailyData.untimedTasks}
        missedReminders={filteredDailyData.missedReminders}
        onCompleteTask={onCompleteTask}
        onRescheduleTask={onRescheduleTask}
        onSnoozeTask={onSnoozeTask}
        onAssignTaskTime={onRescheduleTask}
        onDismissReminder={onDismissReminder}
        onSnoozeReminder={onSnoozeReminder}
      />
    </>
  );
};
