import type React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayStripSection } from './DayStripSection';
import type { DashboardDailyData, DashboardDayCounts, ProjectOption } from './types';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement> & {
      animate?: string;
      exit?: string;
      initial?: string;
      variants?: Record<string, unknown>;
    }) => {
      const { children, ...elementProps } = props;
      delete elementProps.animate;
      delete elementProps.exit;
      delete elementProps.initial;
      delete elementProps.variants;
      return <div {...elementProps}>{children}</div>;
    },
  },
  useReducedMotion: () => false,
}));

const projectOptions: ProjectOption[] = [
  { value: 'all', label: 'All spaces' },
];

const emptyDailyData: DashboardDailyData = {
  dayEvents: [],
  timedTasks: [],
  untimedTasks: [],
  overdueTasks: [],
  timedReminders: [],
  missedReminders: [],
};

const noopAsync = vi.fn().mockResolvedValue(undefined);

afterEach(() => {
  cleanup();
});

const renderSection = ({
  filteredDailyData = emptyDailyData,
  dayCounts = { events: 0, tasks: 0, reminders: 0, backlog: 0 },
}: {
  filteredDailyData?: DashboardDailyData;
  dayCounts?: DashboardDayCounts;
} = {}) =>
  render(
    <DayStripSection
      countReady
      greeting="Good evening · 0 events, 0 tasks, 0 reminders"
      now={new Date('2026-04-24T18:00:00-04:00')}
      filteredDailyData={filteredDailyData}
      dayCounts={dayCounts}
      activeProjectFilter="all"
      projectOptions={projectOptions}
      onProjectFilterChange={vi.fn()}
      onOpenRecord={vi.fn()}
      onDropFromBacklog={noopAsync}
      onCompleteTask={noopAsync}
      onRescheduleTask={noopAsync}
      onSnoozeTask={noopAsync}
      onDismissReminder={noopAsync}
      onSnoozeReminder={noopAsync}
    />,
  );

describe('DayStripSection', () => {
  it('renders the collapsed scheduling strip for a true zero day', () => {
    renderSection();

    expect(screen.getByTestId('daily-brief-collapsed-strip')).toBeInTheDocument();
    expect(screen.getByText('Chill day ahead?')).toBeInTheDocument();
    expect(screen.queryByText(/Shakespeare/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('daily-brief-backlog')).not.toBeInTheDocument();
  });

  it('keeps backlog visible beneath the collapsed strip when only backlog items remain', () => {
    renderSection({
      filteredDailyData: {
        ...emptyDailyData,
        untimedTasks: [
          {
            id: 'task-1',
            recordId: 'record-1',
            projectId: 'project-1',
            projectName: 'Main Work',
            title: 'Sketch the launch plan',
            dueAtIso: null,
            priority: 'medium',
          },
        ],
      },
      dayCounts: { events: 0, tasks: 0, reminders: 0, backlog: 1 },
    });

    expect(screen.getByTestId('daily-brief-collapsed-strip')).toBeInTheDocument();
    expect(screen.getByTestId('daily-brief-backlog')).toBeInTheDocument();
    expect(screen.getAllByText('Backlog').length).toBeGreaterThan(0);
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });
});
