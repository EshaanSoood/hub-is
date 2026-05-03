import type React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  it('does not expose the daily brief wrapper as a named region', () => {
    renderSection();

    expect(screen.queryByRole('region', { name: 'What’s Up Today' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: "What's Up Today" })).not.toBeInTheDocument();
  });

  it('renders the collapsed scheduling strip for a true zero day', () => {
    renderSection();

    expect(screen.getByTestId('daily-brief-collapsed-strip')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Today timeline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /today timeline marker at/i })).toBeInTheDocument();
    expect(screen.getByText('Chill day ahead?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Backlog\s*0\s*items/i })).toBeDisabled();
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
    expect(screen.getByRole('button', { name: /Backlog,\s*1\s*items/i })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /Backlog,\s*1\s*items/i })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Backlog').length).toBeGreaterThan(0);
    expect(screen.getByText('1 item')).toBeInTheDocument();
    expect(screen.getByRole('tree', { name: 'Backlog items' })).toBeInTheDocument();
  });

  it('lets a backlog item enter the timeline marker flow with Space', async () => {
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

    const itemEntry = screen.getByRole('treeitem', { name: 'Sketch the launch plan. Unscheduled task.' });
    expect(itemEntry).toBeInTheDocument();

    fireEvent.focus(itemEntry);
    fireEvent.keyDown(itemEntry, { key: ' ', code: 'Space' });
    await Promise.resolve();

    expect(screen.getByRole('button', { name: /schedule sketch the launch plan/i })).toHaveFocus();
  });

  it('opens a backlog item with Enter without interacting into the group', async () => {
    const onOpenRecord = vi.fn();

    render(
      <DayStripSection
        countReady
        greeting="Good evening · 0 events, 0 tasks, 0 reminders"
        now={new Date('2026-04-24T18:00:00-04:00')}
        filteredDailyData={{
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
        }}
        dayCounts={{ events: 0, tasks: 0, reminders: 0, backlog: 1 }}
        activeProjectFilter="all"
        projectOptions={projectOptions}
        onProjectFilterChange={vi.fn()}
        onOpenRecord={onOpenRecord}
        onDropFromBacklog={noopAsync}
        onCompleteTask={noopAsync}
        onRescheduleTask={noopAsync}
        onSnoozeTask={noopAsync}
        onDismissReminder={noopAsync}
        onSnoozeReminder={noopAsync}
      />,
    );

    const itemEntry = screen.getByRole('treeitem', { name: 'Sketch the launch plan. Unscheduled task.' });
    fireEvent.focus(itemEntry);
    fireEvent.keyDown(itemEntry, { key: 'Enter', code: 'Enter' });
    expect(onOpenRecord).toHaveBeenCalledWith('record-1');
  });

  it('moves focus into the reminder snooze dialog and lets Escape close it', async () => {
    renderSection({
      filteredDailyData: {
        ...emptyDailyData,
        missedReminders: [
          {
            id: 'reminder-1',
            reminderId: 'reminder-1',
            recordId: 'record-1',
            projectId: 'project-1',
            projectName: 'Main Work',
            title: 'Inventory reminder',
            remindAtIso: '2026-04-24T18:00:00.000Z',
          },
        ],
      },
      dayCounts: { events: 0, tasks: 0, reminders: 0, backlog: 1 },
    });

    const itemEntry = screen.getByRole('treeitem', { name: 'Inventory reminder. Missed reminder.' });
    fireEvent.focus(itemEntry);
    fireEvent.keyDown(itemEntry, { key: 'ArrowRight', code: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
    });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Open' }), { key: 'ArrowDown', code: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Dismiss' }), { key: 'ArrowDown', code: 'ArrowDown' });
    fireEvent.click(screen.getByRole('button', { name: 'Snooze' }));

    const input = screen.getAllByLabelText('Snooze Inventory reminder').find(
      (element): element is HTMLElement => element instanceof HTMLInputElement,
    );
    if (!(input instanceof HTMLElement)) {
      throw new Error('Expected snooze dialog input to be an HTMLElement.');
    }
    expect(input).toHaveFocus();

    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    await Promise.resolve();

    expect(screen.queryByLabelText('Snooze Inventory reminder')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('treeitem', { name: 'Inventory reminder. Missed reminder.' })).toHaveFocus();
    });
  });

  it('nests reminder actions inside the reminder tree item action boundary', async () => {
    renderSection({
      filteredDailyData: {
        ...emptyDailyData,
        missedReminders: [
          {
            id: 'reminder-1',
            reminderId: 'reminder-1',
            recordId: 'record-1',
            projectId: 'project-1',
            projectName: 'Main Work',
            title: 'Inventory reminder',
            remindAtIso: '2026-04-24T18:00:00.000Z',
          },
        ],
      },
      dayCounts: { events: 0, tasks: 0, reminders: 0, backlog: 1 },
    });

    const entry = screen.getByRole('treeitem', { name: 'Inventory reminder. Missed reminder.' });
    const group = entry.closest('li');
    if (!(group instanceof HTMLElement)) {
      throw new Error('Expected reminder item wrapper to be an HTMLElement.');
    }
    fireEvent.focus(entry);
    fireEvent.keyDown(entry, { key: 'ArrowRight', code: 'ArrowRight' });
    await waitFor(() => {
      expect(within(group).getByRole('button', { name: 'Open' })).toHaveFocus();
    });
    const actionBoundary = within(group).getByRole('group', { name: 'Task actions' });

    expect(within(actionBoundary).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(within(actionBoundary).getByRole('button', { name: 'Snooze' })).toBeInTheDocument();
    expect(entry).toHaveAccessibleDescription(
      'Due Apr 24, 2:00 PM · Main Work Interact with element to reveal actions. Press Space to place on timeline or Enter to open.',
    );
  });
});
