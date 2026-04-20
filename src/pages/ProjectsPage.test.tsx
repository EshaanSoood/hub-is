import React, { type PropsWithChildren, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ProjectsPage } from './ProjectsPage';
import type { ProjectRecord } from '../types/domain';
import type { HubRecordDetail } from '../services/hub/types';

const mockGetHubHome = vi.fn();
const mockGetRecordDetail = vi.fn();
const mockSubscribeHubLive = vi.fn();
const mockListPanes = vi.fn();
const mockRefreshReminders = vi.fn();
const mockOnDismissReminder = vi.fn();
const mockOnSnoozeReminder = vi.fn();
const mockThoughtPileRefresh = vi.fn();

const personalProject: ProjectRecord = {
  id: 'personal-project',
  name: 'Home',
  status: 'active',
  summary: '',
  openProjectProjectId: null,
  nextcloudFolder: null,
  isPersonal: true,
  membershipRole: 'owner',
  position: null,
};

const projectAlpha: ProjectRecord = {
  id: 'project-alpha',
  name: 'Alpha',
  status: 'active',
  summary: '',
  openProjectProjectId: null,
  nextcloudFolder: null,
  isPersonal: false,
  membershipRole: 'owner',
  position: 1,
};

const homeResponse = {
  personal_project_id: personalProject.id,
  tasks: [
    {
      record_id: 'task-1',
      project_id: personalProject.id,
      project_name: 'Home',
      collection_id: 'tasks',
      collection_name: 'Tasks',
      title: 'Inbox task',
      created_at: '2026-04-19T10:00:00.000Z',
      updated_at: '2026-04-19T10:00:00.000Z',
      subtask_count: 0,
      task_state: {
        status: 'todo',
        priority: null,
        completed_at: null,
        due_at: null,
        category: null,
        updated_at: '2026-04-19T10:00:00.000Z',
      },
      assignments: [],
      origin_kind: 'personal',
      source_view_id: null,
      source_pane: null,
    },
  ],
  tasks_next_cursor: null,
  captures: [],
  events: [
    {
      record_id: 'event-1',
      project_id: projectAlpha.id,
      project_name: projectAlpha.name,
      collection_id: 'events',
      collection_name: 'Events',
      title: 'Planning',
      updated_at: '2026-04-19T10:00:00.000Z',
      event_state: {
        start_dt: '2026-04-20T14:00:00.000Z',
        end_dt: '2026-04-20T15:00:00.000Z',
        timezone: 'America/New_York',
        location: null,
        updated_at: '2026-04-19T10:00:00.000Z',
      },
      participants: [],
      source_pane: null,
    },
  ],
  notifications: [],
};

const recordDetail = {
  record_id: 'task-1',
  title: 'Inbox task',
  collection_id: 'tasks',
  schema: {
    name: 'Tasks',
  },
  capabilities: {
    task_state: {
      status: 'todo',
      priority: 'medium',
    },
    event_state: null,
  },
  origin_kind: 'personal',
  comments: [
    {
      comment_id: 'comment-1',
    },
  ],
  values: {
    status: 'todo',
  },
} as unknown as HubRecordDetail;

const authzContextValue = {
  accessToken: 'access-token',
};

const projectsContextValue = {
  projects: [personalProject, projectAlpha],
};

const sidebarCollapseValue = {
  collapseSidebar: vi.fn(),
  expandSidebar: vi.fn(),
  isCollapsed: false,
};

const thoughtPileRuntime = {
  captures: [],
  loading: false,
  refresh: mockThoughtPileRefresh,
};

const omitMotionProps = (props: Record<string, unknown>) => {
  const domProps = { ...props };
  delete domProps.animate;
  delete domProps.exit;
  delete domProps.initial;
  delete domProps.layoutId;
  delete domProps.transition;
  delete domProps.variants;
  return domProps;
};

const motionFactory = (tag: keyof HTMLElementTagNameMap) =>
  ({ children, ...props }: PropsWithChildren<Record<string, unknown>>): ReactElement =>
    React.createElement(tag, omitMotionProps(props), children);

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: PropsWithChildren) => <>{children}</>,
  LayoutGroup: ({ children }: PropsWithChildren) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: (_target, key) => motionFactory((typeof key === 'string' ? key : 'div') as keyof HTMLElementTagNameMap),
    },
  ),
  useReducedMotion: () => false,
}));

vi.mock('../context/AuthzContext', () => ({
  useAuthz: () => authzContextValue,
}));

vi.mock('../context/ProjectsContext', () => ({
  useProjects: () => projectsContextValue,
}));

vi.mock('../services/hub/records', () => ({
  getHubHome: (...args: unknown[]) => mockGetHubHome(...args),
  getRecordDetail: (...args: unknown[]) => mockGetRecordDetail(...args),
}));

vi.mock('../services/hubLive', () => ({
  subscribeHubLive: (...args: unknown[]) => mockSubscribeHubLive(...args),
}));

vi.mock('../services/hub/panes', () => ({
  listPanes: (...args: unknown[]) => mockListPanes(...args),
}));

vi.mock('../lib/hubHomeRefresh', () => ({
  subscribeHubHomeRefresh: () => () => {},
}));

vi.mock('../hooks/useRemindersRuntime', () => ({
  useRemindersRuntime: () => ({
    reminders: [{ reminder_id: 'reminder-1', title: 'Pay rent' }],
    loading: false,
    error: null,
    refresh: mockRefreshReminders,
    create: vi.fn(),
  }),
}));

vi.mock('../features/PersonalizedDashboardPanel/hooks/useDashboardMutations', () => ({
  useDashboardMutations: () => ({
    onDismissReminder: mockOnDismissReminder,
    onSnoozeReminder: mockOnSnoozeReminder,
  }),
}));

vi.mock('../features/PersonalizedDashboardPanel', () => ({
  PersonalizedDashboardPanel: ({
    initialView = 'project-lens',
    onOpenRecord,
    onViewChange,
  }: {
    initialView?: 'project-lens' | 'stream';
    onOpenRecord: (recordId: string) => void;
    onViewChange?: (view: 'project-lens' | 'stream') => void;
  }) => (
    <section aria-label="Home dashboard">
      <p data-testid="dashboard-view">{initialView}</p>
      <button type="button" onClick={() => onViewChange?.('stream')}>Open Stream</button>
      <button type="button" onClick={() => onViewChange?.('project-lens')}>Open Project Lens</button>
      <button type="button" onClick={() => onOpenRecord('task-1')}>Open dashboard record</button>
    </section>
  ),
}));

vi.mock('../components/project-space/TasksModuleSkin', () => ({
  TasksModuleSkin: ({ tasks }: { tasks: Array<{ id: string }> }) => (
    <div data-testid="tasks-module-skin">Tasks {tasks.length}</div>
  ),
}));

vi.mock('../components/project-space/CalendarModuleSkin', () => ({
  CalendarModuleSkin: ({ events }: { events: Array<{ record_id: string }> }) => (
    <div data-testid="calendar-module-skin">Calendar {events.length}</div>
  ),
}));

vi.mock('../components/project-space/RemindersModuleSkin', () => ({
  RemindersModuleSkin: ({ reminders }: { reminders: Array<{ reminder_id: string }> }) => (
    <div data-testid="reminders-module-skin">Reminders {reminders.length}</div>
  ),
}));

vi.mock('../components/primitives', async () => {
  const actual = await vi.importActual<typeof import('../components/primitives')>('../components/primitives');
  return {
    ...actual,
    Dialog: ({
      open,
      onClose,
      triggerRef,
      title,
      children,
    }: PropsWithChildren<{
      open: boolean;
      onClose: () => void;
      triggerRef?: React.RefObject<HTMLElement | null>;
      title: string;
    }>) => (
      open ? (
        <div role="dialog" aria-label={title}>
          <button
            type="button"
            onClick={() => {
              onClose();
              triggerRef?.current?.focus();
            }}
          >
            Close dialog
          </button>
          {children}
        </div>
      ) : null
    ),
    LiveRegion: ({ message }: { message: string }) => <div data-testid="live-region">{message}</div>,
  };
});

vi.mock('../components/Sidebar/WorkspaceHeader', () => ({
  WorkspaceHeader: ({ onOpenHome }: { onOpenHome: () => void }) => (
    <button type="button" onClick={onOpenHome}>Home</button>
  ),
}));

vi.mock('../components/Sidebar/SearchButton', () => ({
  SearchButton: () => <button type="button">Search</button>,
}));

vi.mock('../components/Sidebar/CaptureInput', () => ({
  CaptureInput: () => <button type="button">Capture</button>,
}));

vi.mock('../components/Sidebar/RecentPanes', () => ({
  RecentPanes: () => <div>Recent panes</div>,
}));

vi.mock('../components/Sidebar/ProjectsTree', () => ({
  ProjectsTree: () => <div>Projects tree</div>,
}));

vi.mock('../components/Sidebar/ProfileBadge', () => ({
  ProfileBadge: () => <button type="button">Profile</button>,
}));

vi.mock('../components/Sidebar/hooks/useSidebarCollapse', () => ({
  useSidebarCollapse: () => sidebarCollapseValue,
}));

vi.mock('../features/home/useHomeThoughtPileRuntime', () => ({
  useHomeThoughtPileRuntime: () => thoughtPileRuntime,
}));

vi.mock('../features/QuickCapture', () => ({
  QuickCapturePanel: ({ onRequestClose }: { onRequestClose?: (options?: { restoreFocus?: boolean }) => void }) => (
    <div>
      Quick thoughts
      <button type="button" onClick={() => onRequestClose?.()}>Close quick thoughts</button>
    </div>
  ),
}));

const LocationProbe = () => {
  const location = useLocation();
  return <p data-testid="location-display">{`${location.pathname}${location.search}`}</p>;
};

const renderProjectsPage = (entry = '/projects') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <AppShell>
        <Routes>
          <Route
            path="/projects"
            element={(
              <>
                <LocationProbe />
                <ProjectsPage />
              </>
            )}
          />
        </Routes>
      </AppShell>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockGetHubHome.mockResolvedValue(homeResponse);
  mockGetRecordDetail.mockResolvedValue(recordDetail);
  mockSubscribeHubLive.mockReturnValue(() => {});
  mockListPanes.mockResolvedValue([]);
  mockRefreshReminders.mockReset();
  mockOnDismissReminder.mockReset();
  mockOnSnoozeReminder.mockReset();
  mockThoughtPileRefresh.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('ProjectsPage', () => {
  it('renders Home on the /projects route and moves focus into the Home heading', async () => {
    renderProjectsPage();

    const homeHeading = await screen.findByRole('heading', { name: 'Home', level: 1, hidden: true });

    await waitFor(() => {
      expect(homeHeading).toHaveFocus();
    });

    expect(screen.getByTestId('dashboard-view')).toHaveTextContent('project-lens');
    expect(screen.getByTestId('location-display')).toHaveTextContent('/projects');
  });

  it('updates Home surface selection from sidebar controls', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    const tasksButton = screen.getByRole('button', { name: 'Tasks' });
    await user.click(tasksButton);

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?view=project-lens&surface=tasks');
    });

    expect(screen.getByRole('button', { name: 'Tasks' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Tasks', level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId('tasks-module-skin')).toHaveTextContent('Tasks 1');
  });

  it.each([
    { surface: 'tasks', label: 'Tasks', testId: 'tasks-module-skin' },
    { surface: 'calendar', label: 'Calendar', testId: 'calendar-module-skin' },
    { surface: 'reminders', label: 'Reminders', testId: 'reminders-module-skin' },
  ])('pins the current full-page $surface Home surface behavior before the overlay refactor', async ({
    surface,
    label,
    testId,
  }) => {
    const user = userEvent.setup();
    renderProjectsPage(`/projects?surface=${surface}`);

    expect(await screen.findByRole('heading', { name: label, level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId(testId)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to Dashboard' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects');
    });

    expect(screen.getByTestId('dashboard-view')).toHaveTextContent('project-lens');
  });

  it('opens Quick Thoughts from the sidebar as a Home-hosted launcher surface', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    await user.click(screen.getByRole('button', { name: 'Quick Thoughts' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?view=project-lens&surface=thoughts');
    });

    expect(screen.getByText('Quick thoughts')).toBeInTheDocument();
  });

  it.fails('opens the Home record inspector from the route task_id contract and clears the search param', async () => {
    renderProjectsPage('/projects?task_id=task-1');

    expect(await screen.findByRole('dialog', { name: 'Record Inspector' })).toBeInTheDocument();
    expect(mockGetRecordDetail).toHaveBeenCalledWith('access-token', 'task-1', { signal: expect.any(AbortSignal) });

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects');
    });

    expect(screen.getByText('Inbox task')).toBeInTheDocument();
  });

  it('restores focus to the Home trigger when the record inspector closes', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    const openRecordButton = screen.getByRole('button', { name: 'Open dashboard record' });
    openRecordButton.focus();

    await user.click(openRecordButton);
    expect(await screen.findByRole('dialog', { name: 'Record Inspector' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Record Inspector' })).not.toBeInTheDocument();
    });
    expect(openRecordButton).toHaveFocus();
  });

  it('keeps view query state wired through the Home host', async () => {
    const user = userEvent.setup();
    renderProjectsPage('/projects?view=stream');

    expect(screen.getByTestId('dashboard-view')).toHaveTextContent('stream');

    await user.click(screen.getByRole('button', { name: 'Open Project Lens' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?view=project-lens');
    });
  });

  it('selects Project Lens and Stream from Sidebar-owned Home controls', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    const sidebar = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(sidebar).getByRole('button', { name: 'Project Lens' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(sidebar).getByRole('button', { name: 'Stream' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?view=stream');
    });

    expect(screen.getByTestId('dashboard-view')).toHaveTextContent('stream');
    expect(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Stream' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Project Lens' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?view=project-lens');
    });

    expect(screen.getByTestId('dashboard-view')).toHaveTextContent('project-lens');
  });
});
