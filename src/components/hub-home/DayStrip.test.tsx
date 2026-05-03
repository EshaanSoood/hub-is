import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DayStrip } from './DayStrip';

describe('DayStrip accessibility runtime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T17:45:00-04:00'));
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('exposes the timeline explorer as a group with marker shortcuts', () => {
    const onAccessibilityAnnouncement = vi.fn();

    render(
      <DayStrip
        events={[
          {
            id: 'event-1',
            recordId: 'event-record-1',
            projectId: 'space-1',
            projectName: 'Home',
            title: 'Meeting With Shawn',
            startAtIso: '2026-05-01T18:00:00-04:00',
            endAtIso: '2026-05-01T18:30:00-04:00',
          },
        ]}
        tasks={[]}
        reminders={[]}
        typeFilter="all"
        onOpenRecord={vi.fn()}
        onAccessibilityAnnouncement={onAccessibilityAnnouncement}
      />,
    );

    const timelineGroup = screen.getByRole('group', { name: 'Today timeline' });
    expect(timelineGroup).toBeInTheDocument();

    const timelineNavigator = screen.getByRole('button', { name: /today timeline marker/i });
    fireEvent.focus(timelineNavigator);
    expect(onAccessibilityAnnouncement).toHaveBeenLastCalledWith('5:45 PM');

    fireEvent.keyDown(timelineNavigator, { key: '.', code: 'Period' });
    expect(onAccessibilityAnnouncement).toHaveBeenLastCalledWith('Meeting With Shawn at 6:00 PM.');
  });

  it('treats a same-time drop as opening the focused record', async () => {
    const onAccessibilityAnnouncement = vi.fn();
    const onOpenRecord = vi.fn();

    render(
      <DayStrip
        events={[]}
        tasks={[
          {
            id: 'task-1',
            recordId: 'task-record-1',
            projectId: 'space-1',
            projectName: 'Home',
            title: 'Review agenda',
            dueAtIso: '2026-05-01T18:00:00-04:00',
            status: 'todo',
          },
        ]}
        reminders={[]}
        typeFilter="all"
        onOpenRecord={onOpenRecord}
        onAccessibilityAnnouncement={onAccessibilityAnnouncement}
      />,
    );

    const taskButton = screen.getByRole('button', { name: 'Review agenda at 6:00 PM.' });
    fireEvent.keyDown(taskButton, { key: ' ', code: 'Space' });
    await Promise.resolve();

    const timelineNavigator = screen.getByRole('button', { name: /move review agenda/i });
    expect(timelineNavigator).toHaveFocus();

    fireEvent.keyDown(timelineNavigator, { key: ' ', code: 'Space' });
    expect(onOpenRecord).toHaveBeenCalledWith('task-record-1');
  });

  it('moves a scheduled task in 5 minute increments', async () => {
    const onAccessibilityAnnouncement = vi.fn();
    const onMoveTask = vi.fn().mockResolvedValue(undefined);

    render(
      <DayStrip
        events={[]}
        tasks={[
          {
            id: 'task-1',
            recordId: 'task-record-1',
            projectId: 'space-1',
            projectName: 'Home',
            title: 'Review agenda',
            dueAtIso: '2026-05-01T18:00:00-04:00',
            status: 'todo',
          },
        ]}
        reminders={[]}
        typeFilter="all"
        onOpenRecord={vi.fn()}
        onMoveTask={onMoveTask}
        onAccessibilityAnnouncement={onAccessibilityAnnouncement}
      />,
    );

    const taskButton = screen.getByRole('button', { name: 'Review agenda at 6:00 PM.' });
    fireEvent.keyDown(taskButton, { key: ' ', code: 'Space' });
    await Promise.resolve();

    const timelineNavigator = screen.getByRole('button', { name: /move review agenda/i });
    expect(timelineNavigator).toHaveFocus();

    fireEvent.keyDown(timelineNavigator, { key: '>', code: 'Period', shiftKey: true });
    fireEvent.keyDown(timelineNavigator, { key: ' ', code: 'Space' });
    await Promise.resolve();
    expect(onMoveTask).toHaveBeenCalledWith('task-record-1', '2026-05-01T22:05:00.000Z');
    expect(onAccessibilityAnnouncement).toHaveBeenLastCalledWith('Moved Review agenda to 6:05 PM.');
  });

  it('uses the same marker runtime for backlog scheduling', async () => {
    const onAccessibilityAnnouncement = vi.fn();
    const onKeyboardDrop = vi.fn();
    const onKeyboardCancel = vi.fn();

    render(
      <DayStrip
        events={[]}
        tasks={[]}
        reminders={[]}
        typeFilter="all"
        onOpenRecord={vi.fn()}
        keyboardDragItem={{ title: 'Sketch the launch plan' }}
        onKeyboardDrop={onKeyboardDrop}
        onKeyboardCancel={onKeyboardCancel}
        onAccessibilityAnnouncement={onAccessibilityAnnouncement}
        showEmptyTimeline
      />,
    );

    await Promise.resolve();

    const timelineNavigator = screen.getByRole('button', { name: /schedule sketch the launch plan/i });
    expect(timelineNavigator).toHaveFocus();

    fireEvent.keyDown(timelineNavigator, { key: '>', code: 'Period', shiftKey: true });
    fireEvent.keyDown(timelineNavigator, { key: ' ', code: 'Space' });

    expect(onKeyboardDrop).toHaveBeenCalledWith(new Date('2026-05-01T21:50:00.000Z'));

    fireEvent.keyDown(timelineNavigator, { key: 'Escape', code: 'Escape' });
    expect(onKeyboardCancel).toHaveBeenCalled();
  });
});
