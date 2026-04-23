import React, { type PropsWithChildren, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ProjectsPage } from './ProjectsPage';
import type { ProjectRecord } from '../types/domain';

const mockRefreshProjects = vi.fn();
const mockUpdateProject = vi.fn();

const personalProject: ProjectRecord = {
  id: 'personal-project',
  name: 'Sunday Desk',
  status: 'active',
  summary: '',
  openProjectProjectId: null,
  nextcloudFolder: null,
  isPersonal: true,
  membershipRole: 'owner',
  position: null,
};

const teamProject: ProjectRecord = {
  id: 'team-project',
  name: 'Alpha',
  status: 'active',
  summary: '',
  openProjectProjectId: null,
  nextcloudFolder: null,
  isPersonal: false,
  membershipRole: 'owner',
  position: 1,
};

const authzContextValue = {
  accessToken: 'access-token',
  sessionSummary: {
    userId: 'user-1',
  },
};

const projectsContextValue = {
  projects: [personalProject, teamProject],
  refreshProjects: mockRefreshProjects,
};

const sidebarCollapseValue = {
  collapseSidebar: vi.fn(),
  expandSidebar: vi.fn(),
  isCollapsed: false,
};

const homeRuntime = {
  calendarScope: 'relevant',
  filteredCalendarEvents: [],
  homeData: {
    personal_project_id: personalProject.id,
    tasks: [],
    tasks_next_cursor: null,
    captures: [],
    events: [],
    notifications: [],
  },
  homeError: null,
  homeLoading: false,
  homeReady: true,
  onDismissReminder: vi.fn(),
  onSnoozeReminder: vi.fn(),
  refreshHome: vi.fn(),
  remindersRuntime: {
    reminders: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    dismiss: vi.fn(),
    create: vi.fn(),
  },
  setCalendarScope: vi.fn(),
};

const projectBootstrap = {
  error: null,
  loading: false,
  panes: [
    {
      pane_id: 'pane-1',
      project_id: personalProject.id,
      name: 'Main Work',
      sort_order: 1,
      position: 1,
      pinned: false,
      layout_config: {},
      doc_id: 'doc-1',
      members: [],
      can_edit: true,
    },
  ],
  project: {
    project_id: personalProject.id,
    name: personalProject.name,
    created_by: 'user-1',
    created_at: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T00:00:00.000Z',
    position: null,
    is_personal: true,
    membership_role: 'owner',
    needs_name_prompt: false,
  },
  projectMembers: [],
  refreshProjectData: vi.fn(),
  setPanes: vi.fn(),
  setTimeline: vi.fn(),
  timeline: [],
};

const omitMotionProps = (props: Record<string, unknown>) => {
  const domProps = { ...props };
  return Object.fromEntries(
    Object.entries(domProps).filter(([key]) => {
      if (
        key === 'animate'
        || key === 'custom'
        || key === 'exit'
        || key === 'initial'
        || key === 'layout'
        || key === 'layoutId'
        || key === 'transition'
        || key === 'variants'
        || key === 'viewport'
        || key === 'whileInView'
        || key === 'onAnimationStart'
        || key === 'onAnimationComplete'
        || key === 'onUpdate'
      ) {
        return false;
      }
      if (key.startsWith('drag') || key.startsWith('while')) {
        return false;
      }
      return true;
    }),
  );
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

vi.mock('../features/home/useHomeRuntime', () => ({
  useHomeRuntime: () => homeRuntime,
}));

vi.mock('../hooks/useProjectBootstrap', () => ({
  useProjectBootstrap: () => projectBootstrap,
}));

vi.mock('../hooks/useCalendarRuntime', () => ({
  useCalendarRuntime: () => ({
    calendarEvents: [],
    calendarLoading: false,
    calendarMode: 'all',
    refreshCalendar: vi.fn(),
    setCalendarMode: vi.fn(),
  }),
}));

vi.mock('../hooks/useProjectTasksRuntime', () => ({
  useProjectTasksRuntime: () => ({
    loadProjectTaskPage: vi.fn(),
    projectTasksError: null,
    projectTasksLoading: false,
    projectTasksLoadingMore: false,
    projectTasksNextCursor: null,
    projectTasksSentinelRef: { current: null },
    tasksOverviewRows: [],
  }),
}));

vi.mock('../hooks/useRemindersRuntime', () => ({
  useRemindersRuntime: () => ({
    reminders: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    dismiss: vi.fn(),
    create: vi.fn(),
  }),
}));

vi.mock('../hooks/useTimelineRuntime', () => ({
  useTimelineRuntime: () => ({
    refreshTimeline: vi.fn(),
    timelineClusters: [],
    timelineFilters: ['task', 'event', 'milestone', 'file', 'workspace'],
    toggleTimelineFilter: vi.fn(),
  }),
}));

vi.mock('../services/hub/projects', () => ({
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
}));

vi.mock('../features/home/useHomeRecordInspectorRuntime', () => ({
  useHomeRecordInspectorRuntime: () => ({
    closeRecord: vi.fn(),
    openRecord: vi.fn(),
    selectedRecord: null,
    selectedRecordError: null,
    selectedRecordId: null,
    selectedRecordLoading: false,
    selectedRecordTriggerRect: null,
    selectedRecordTriggerRef: { current: null },
  }),
}));

vi.mock('../features/home/HomeRecordInspectorDialog', () => ({
  HomeRecordInspectorDialog: () => null,
}));

vi.mock('../features/home/HomeDashboardSurface', () => ({
  HomeDashboardSurface: ({
    activeContentView,
    onOpenQuickThoughts,
    projectContent,
  }: {
    activeContentView: 'project' | 'lenses' | 'stream';
    onOpenQuickThoughts: () => void;
    projectContent: React.ReactNode;
  }) => (
    <section aria-label="Home dashboard" data-testid="home-dashboard">
      <p data-testid="dashboard-content">{activeContentView}</p>
      <button type="button" data-home-launcher="thoughts" onClick={onOpenQuickThoughts}>Quick thoughts</button>
      {activeContentView === 'project' ? projectContent : null}
    </section>
  ),
}));

vi.mock('../features/home/HomeOverviewSurface', () => ({
  HomeOverviewSurface: ({ projectName }: { projectName: string }) => (
    <div data-testid="overview-surface">{projectName}</div>
  ),
}));

vi.mock('../features/home/HomeProjectWorkSection', () => ({
  HomeProjectWorkSection: () => <div data-testid="work-surface">Home work surface</div>,
}));

vi.mock('../features/home/HomeProjectNamingDialog', () => ({
  HomeProjectNamingDialog: ({
    open,
    projectName,
    onSubmit,
    onValueChange,
  }: {
    open: boolean;
    projectName: string;
    onSubmit: () => void;
    onValueChange: (value: string) => void;
  }) => (open ? (
    <div role="dialog" aria-label="Name your Home space">
      <input
        aria-label="Space name"
        value={projectName}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      />
      <button type="button" onClick={onSubmit}>Save name</button>
    </div>
  ) : null),
}));

vi.mock('../features/home/useHomeThoughtPileRuntime', () => ({
  useHomeThoughtPileRuntime: () => ({
    captures: [],
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('../features/QuickCapture', () => ({
  QuickCapturePanel: ({ onRequestClose }: { onRequestClose?: (options?: { restoreFocus?: boolean }) => void }) => (
    <div>
      Quick thoughts
      <button type="button" onClick={() => onRequestClose?.()}>Close quick thoughts</button>
    </div>
  ),
}));

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

vi.mock('../components/Sidebar/Surfaces', () => ({
  Surfaces: ({
    onSelectHomeContentView,
    onSelectSurface,
  }: {
    onSelectHomeContentView: (viewId: 'lenses' | 'stream') => void;
    onSelectSurface: (surfaceId: 'thoughts') => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSelectHomeContentView('lenses')}>Lenses</button>
      <button type="button" onClick={() => onSelectHomeContentView('stream')}>Stream</button>
      <button type="button" onClick={() => onSelectSurface('thoughts')}>Quick thoughts</button>
    </div>
  ),
}));

vi.mock('../components/Sidebar/hooks/useSidebarCollapse', () => ({
  useSidebarCollapse: () => sidebarCollapseValue,
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
  mockRefreshProjects.mockReset();
  mockRefreshProjects.mockResolvedValue(undefined);
  mockUpdateProject.mockReset();
  mockUpdateProject.mockResolvedValue({
    project_id: personalProject.id,
    name: 'Sunday Desk',
    created_by: 'user-1',
    created_at: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T00:00:00.000Z',
    position: null,
    is_personal: true,
    membership_role: 'owner',
    needs_name_prompt: false,
  });
  projectsContextValue.projects = [personalProject, teamProject];
  homeRuntime.homeData.personal_project_id = personalProject.id;
  projectBootstrap.project = {
    ...projectBootstrap.project,
    name: personalProject.name,
    needs_name_prompt: personalProject.needsNamePrompt === true,
  };
});

afterEach(() => {
  cleanup();
});

describe('ProjectsPage', () => {
  it('renders Home as the named personal project on /projects', async () => {
    renderProjectsPage();

    const heading = await screen.findByRole('heading', { name: 'Home', level: 1 });

    await waitFor(() => {
      expect(heading).toHaveFocus();
    });

    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('dashboard-content')).toHaveTextContent('project');
    expect(screen.getByTestId('overview-surface')).toHaveTextContent('Sunday Desk');
  });

  it('swaps the lower Home region from sidebar-owned Lenses and Stream toggles', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Lenses' }));
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?content=lenses');
    });
    expect(screen.getByTestId('dashboard-content')).toHaveTextContent('lenses');

    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Stream' }));
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?content=stream');
    });
    expect(screen.getByTestId('dashboard-content')).toHaveTextContent('stream');
  });

  it('opens Quick thoughts from the compact dashboard control and restores focus when it closes', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    const trigger = within(screen.getByTestId('home-dashboard')).getByRole('button', { name: 'Quick thoughts' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?surface=thoughts');
    });
    expect(screen.getByRole('dialog', { name: 'Quick thoughts' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close quick thoughts' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Quick thoughts' })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(within(screen.getByTestId('home-dashboard')).getByRole('button', { name: 'Quick thoughts' })).toHaveFocus();
    });
  });

  it('preserves the Home work pane when Quick thoughts is opened from the sidebar', async () => {
    const user = userEvent.setup();
    renderProjectsPage('/projects?tab=work&pane=pane-1');

    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Quick thoughts' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?tab=work&pane=pane-1&surface=thoughts');
    });
  });

  it('switches to the Home work tab without leaving /projects', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    await user.click(screen.getByRole('button', { name: 'Work' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?tab=work');
    });
    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('work-surface')).toBeInTheDocument();
  });

  it('shows the first-run personal-project naming dialog and persists the rename', async () => {
    const user = userEvent.setup();
    projectsContextValue.projects = [
      { ...personalProject, needsNamePrompt: true, name: "Eshaan's Project" },
      teamProject,
    ];
    projectBootstrap.project = {
      ...projectBootstrap.project,
      name: "Eshaan's Project",
      needs_name_prompt: true,
    };

    renderProjectsPage();

    const dialog = await screen.findByRole('dialog', { name: 'Name your Home space' });
    const input = within(dialog).getByRole('textbox', { name: 'Space name' });
    await user.clear(input);
    await user.type(input, 'Sunday Desk');
    await user.click(within(dialog).getByRole('button', { name: 'Save name' }));

    expect(mockUpdateProject).toHaveBeenCalledWith('access-token', personalProject.id, {
      name: 'Sunday Desk',
    });
    expect(mockRefreshProjects).toHaveBeenCalled();
  });
});
