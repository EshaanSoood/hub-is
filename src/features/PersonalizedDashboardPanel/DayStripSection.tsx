import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ContextBar } from '../../components/hub-home/ContextBar';
import { DayStrip } from '../../components/hub-home/DayStrip';
import { BacklogPanel } from '../../components/hub-home/BacklogPanel';
import { DAY_STRIP_FORWARD_WINDOW_MS } from '../../components/hub-home/dayStripWindow';
import type { BacklogDragPayload } from '../../components/hub-home/types';
import { routeFadeVariants } from '../../components/motion/hubMotion';
import { LiveRegion } from '../../components/primitives';
import { useLiveRegion } from '../../hooks/useLiveRegion';
import type { DashboardDailyData, DashboardDayCounts, ProjectOption } from './types';
import { parseIso } from './utils';

type DailyBriefState = 'active-day' | 'empty-backlog' | 'true-zero';

const SHAKESPEARE_QUOTE = 'The day is your oyster. Or carrot. Or something… — Shakespeare';

const hasActiveScheduledTime = (value: string, nowMs: number, windowEndMs: number): boolean => {
  const parsed = parseIso(value);
  if (!parsed) {
    return false;
  }
  const scheduledMs = parsed.getTime();
  return scheduledMs >= nowMs && scheduledMs <= windowEndMs;
};

const hasActiveEventTime = (startValue: string, endValue: string, nowMs: number, windowEndMs: number): boolean => {
  const start = parseIso(startValue);
  const end = parseIso(endValue);
  if (!start || !end) {
    return false;
  }
  return end.getTime() >= nowMs && start.getTime() <= windowEndMs;
};

const resolveDailyBriefState = (dailyData: DashboardDailyData, now: Date): DailyBriefState => {
  const nowMs = now.getTime();
  const windowEndMs = nowMs + DAY_STRIP_FORWARD_WINDOW_MS;

  const hasActiveDay =
    dailyData.dayEvents.some((event) => hasActiveEventTime(event.startAtIso, event.endAtIso, nowMs, windowEndMs))
    || dailyData.timedTasks.some((task) => hasActiveScheduledTime(task.dueAtIso, nowMs, windowEndMs))
    || dailyData.timedReminders.some((reminder) => hasActiveScheduledTime(reminder.remindAtIso, nowMs, windowEndMs));

  if (hasActiveDay) {
    return 'active-day';
  }

  const hasBacklog =
    dailyData.overdueTasks.length > 0
    || dailyData.untimedTasks.length > 0
    || dailyData.missedReminders.length > 0;

  return hasBacklog ? 'empty-backlog' : 'true-zero';
};

interface DayStripSectionProps {
  countReady: boolean;
  greeting: string;
  headerActions?: ReactNode;
  now: Date;
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
  headerActions,
  now,
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
  const prefersReducedMotion = useReducedMotion() ?? false;
  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat([], { weekday: 'long', month: 'long', day: 'numeric' }).format(now),
    [now],
  );
  const briefState = useMemo(() => resolveDailyBriefState(filteredDailyData, now), [filteredDailyData, now]);
  const fadeVariants = useMemo(() => routeFadeVariants(prefersReducedMotion), [prefersReducedMotion]);
  const { announcement, announce } = useLiveRegion();
  const [keyboardDragItem, setKeyboardDragItem] = useState<{
    id: string;
    title: string;
    payload: BacklogDragPayload;
  } | null>(null);
  const [restoreFocusItemId, setRestoreFocusItemId] = useState<string | null>(null);
  const [focusViewportKey, setFocusViewportKey] = useState(0);

  const handleBeginKeyboardDrag = useCallback((item: { id: string; title: string; payload: BacklogDragPayload }) => {
    setRestoreFocusItemId(null);
    setKeyboardDragItem(item);
    announce(`Picked up ${item.title}, use arrow keys to choose time, Enter to drop, Escape to cancel.`);
  }, [announce]);

  const handleKeyboardDragAnnouncement = useCallback((timeLabel: string) => {
    announce(`Target time ${timeLabel}.`);
  }, [announce]);

  const handleKeyboardCancel = useCallback(() => {
    if (keyboardDragItem) {
      setRestoreFocusItemId(keyboardDragItem.id);
    }
    setKeyboardDragItem(null);
    announce('Cancelled.');
  }, [announce, keyboardDragItem]);

  const handleKeyboardDrop = useCallback(async (assignedAt: Date) => {
    if (!keyboardDragItem) {
      return;
    }
    const { id, title, payload } = keyboardDragItem;
    try {
      await onDropFromBacklog(payload, assignedAt);
      setKeyboardDragItem(null);
      setFocusViewportKey((current) => current + 1);
      announce(`Dropped ${title} at ${assignedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
    } catch {
      setRestoreFocusItemId(id);
      announce(`Could not schedule ${title}.`);
    }
  }, [announce, keyboardDragItem, onDropFromBacklog]);

  return (
    <section
      aria-labelledby="daily-brief-heading"
      className={`mt-4 rounded-panel border border-border-muted bg-surface p-4 ${
        briefState === 'true-zero' ? 'min-h-[var(--daily-brief-collapsed-height)]' : ''
      }`}
      data-daily-brief-state={briefState}
      data-testid="daily-brief"
    >
      <h2 id="daily-brief-heading" className="font-serif text-xl font-semibold text-text">Daily Brief</h2>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text">{greeting}</p>
          <p className="text-xs text-muted">{dateLabel}</p>
        </div>
        {headerActions ? <div className="flex items-center gap-2">{headerActions}</div> : null}
      </div>
      <LiveRegion message={announcement} role="status" ariaLive="polite" />

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={briefState}
          animate="animate"
          exit="exit"
          initial="initial"
          variants={fadeVariants}
        >
          {briefState === 'true-zero' ? (
            <p className="mt-4 text-sm text-text" data-testid="daily-brief-quote">
              {SHAKESPEARE_QUOTE}
            </p>
          ) : (
            <>
              <DayStrip
                key={keyboardDragItem ? `keyboard-drag-${keyboardDragItem.id}` : 'keyboard-drag-idle'}
                className="mt-3"
                events={briefState === 'active-day' ? filteredDailyData.dayEvents : []}
                tasks={briefState === 'active-day' ? filteredDailyData.timedTasks : []}
                reminders={briefState === 'active-day' ? filteredDailyData.timedReminders : []}
                typeFilter="all"
                onOpenRecord={onOpenRecord}
                onDropFromBacklog={onDropFromBacklog}
                showEmptyTimeline={briefState === 'empty-backlog'}
                keyboardDragItem={keyboardDragItem ? { title: keyboardDragItem.title } : null}
                onKeyboardDragAnnouncement={handleKeyboardDragAnnouncement}
                onKeyboardDrop={handleKeyboardDrop}
                onKeyboardCancel={handleKeyboardCancel}
                focusViewportKey={focusViewportKey}
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
                dragToTimelineEnabled
                activeKeyboardDragItemId={keyboardDragItem?.id ?? null}
                restoreFocusItemId={restoreFocusItemId}
                onRestoreFocusHandled={() => {
                  setRestoreFocusItemId(null);
                }}
                onBeginKeyboardDrag={handleBeginKeyboardDrag}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
};
