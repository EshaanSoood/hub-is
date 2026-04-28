import React, { type PropsWithChildren, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ProjectsPage } from './ProjectsPage';
import type { ProjectRecord } from '../types/domain';

const mockRefreshProjects = vi.fn();
const mockUpdateSpace = vi.fn();

const personalProject: ProjectRecord = {
  id: 'personal-project',
  name: 'Sunday Desk',
  status: 'active',
  summary: '',
  openProjectProjectId: null,
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
    personal_space_id: personalProject.id,
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
  projects: [
    {
      project_id: 'project-1',
      space_id: personalProject.id,
      name: 'Main Work',
      sort_order: 1,
      position: 1,
      pinned: false,
      layout_config: {},
      docs: [{ doc_id: 'doc-1', title: 'Untitled', position: 0 }],
      members: [],
      can_edit: true,
    },
  ],
  project: {
    space_id: personalProject.id,
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
  setProjects: vi.fn(),
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

vi.mock('../hooks/useProjectProjects', () => ({
  useProjectProjects: () => ({
    error: null,
    loading: false,
    projects: projectBootstrap.projects,
    refetch: vi.fn(),
  }),
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
  updateProject: vi.fn(),
}));

vi.mock('../services/hub/spaces', () => ({
  updateSpace: (...args: unknown[]) => mockUpdateSpace(...args),
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
    activeSurface,
    onSelectSurface,
  }: {
    activeSurface: 'hub' | 'stream' | 'calendar' | 'tasks' | 'reminders';
    onSelectSurface: (surface: 'hub' | 'stream' | 'calendar' | 'tasks' | 'reminders') => void;
  }) => (
    <section aria-label="Home dashboard" data-testid="home-dashboard">
      <div role="tablist" aria-label="Home surfaces">
        {(['hub', 'stream', 'calendar', 'tasks', 'reminders'] as const).map((surface) => (
          <button
            key={surface}
            type="button"
            role="tab"
            data-home-launcher={surface}
            aria-selected={activeSurface === surface}
            onClick={() => onSelectSurface(surface)}
          >
            {surface === 'hub' ? 'Hub' : surface[0].toUpperCase() + surface.slice(1)}
          </button>
        ))}
      </div>
      <p data-testid="dashboard-content">{activeSurface}</p>
    </section>
  ),
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
  CaptureInput: ({ variant, placeholder }: { variant?: 'sidebar' | 'command-bar'; placeholder?: string }) => (
    variant === 'command-bar'
      ? <div>{placeholder}</div>
      : <button type="button">Capture</button>
  ),
}));

vi.mock('../components/Sidebar/RecentPlaces', () => ({
  RecentPlaces: () => <div>Recent places</div>,
}));

vi.mock('../components/Sidebar/ProjectsTree', () => ({
  ProjectsTree: () => <div>Projects tree</div>,
}));

vi.mock('../components/Sidebar/ProfileBadge', () => ({
  ProfileBadge: () => <button type="button">Profile</button>,
}));

vi.mock('../components/Sidebar/Surfaces', () => ({
  Surfaces: ({
    sectionExpanded,
    onSelectHomeSurface,
  }: {
    sectionExpanded: boolean;
    onSelectHomeSurface: (viewId: 'hub' | 'stream' | 'calendar' | 'tasks' | 'reminders') => void;
  }) => (
    <div>
      {sectionExpanded ? (
        <>
          <button type="button" onClick={() => onSelectHomeSurface('hub')}>Hub</button>
          <button type="button" onClick={() => onSelectHomeSurface('stream')}>Stream</button>
          <button type="button" onClick={() => onSelectHomeSurface('calendar')}>Calendar</button>
          <button type="button" onClick={() => onSelectHomeSurface('tasks')}>Tasks</button>
          <button type="button" onClick={() => onSelectHomeSurface('reminders')}>Reminders</button>
        </>
      ) : null}
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

const RouteControls = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/projects/team-project')}>
      Go external
    </button>
  );
};

const renderProjectsPage = (entry = '/projects') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <AppShell>
        <RouteControls />
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
          <Route
            path="/projects/:projectId"
            element={(
              <>
                <LocationProbe />
                <div data-testid="external-project">External project</div>
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
  mockUpdateSpace.mockReset();
  mockUpdateSpace.mockResolvedValue({
    space_id: personalProject.id,
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
  homeRuntime.homeData.personal_space_id = personalProject.id;
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
  it('defaults Home to the Hub surface and does not render Overview or Work controls', async () => {
    renderProjectsPage();

    expect(await within(screen.getByRole('main')).findByRole('tab', { name: 'Hub' })).toBeInTheDocument();
    expect(screen.getByText('Capture.')).toBeInTheDocument();
    expect(screen.getByText('Capture anything and experience the magic.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Overview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Work' })).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-content')).toHaveTextContent('hub');
    expect(screen.getByTestId('location-display')).toHaveTextContent('/projects');
  });

  it('switches Home surfaces from the sidebar using the surface search param', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Hub' }));
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects');
    });
    expect(screen.getByTestId('dashboard-content')).toHaveTextContent('hub');

    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Stream' }));
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?surface=stream');
    });
    expect(screen.getByTestId('dashboard-content')).toHaveTextContent('stream');
  });

  it('returns directly to Hub when Home is selected from another route', async () => {
    const user = userEvent.setup();
    renderProjectsPage('/projects?surface=stream');

    await user.click(screen.getByRole('button', { name: 'Go external' }));
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects/team-project');
    });

    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Home' }));
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects');
    });
    expect(screen.getByTestId('dashboard-content')).toHaveTextContent('hub');
  });

  it('ignores legacy work params on Home render', async () => {
    renderProjectsPage('/projects?tab=work&project=project-1');

    expect(screen.queryByRole('button', { name: 'Work' })).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-content')).toHaveTextContent('hub');
  });

  it('opens Quick thoughts from the top command bar and restores focus when it closes', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    const trigger = within(screen.getByRole('main')).getByRole('button', { name: 'Quick thoughts' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?overlay=thoughts');
    });
    expect(screen.getByRole('dialog', { name: 'Quick thoughts' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close quick thoughts' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Quick thoughts' })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByRole('button', { name: 'Quick thoughts' })).toHaveFocus();
    });
  });

  it('preserves the selected Home surface when Quick thoughts opens', async () => {
    const user = userEvent.setup();
    renderProjectsPage('/projects?surface=stream');

    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'Quick thoughts' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?surface=stream&overlay=thoughts');
    });
  });

  it('switches Home surfaces without leaving /projects', async () => {
    const user = userEvent.setup();
    renderProjectsPage();

    await user.click(within(screen.getByRole('main')).getByRole('tab', { name: 'Tasks' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/projects?surface=tasks');
    });
    expect(screen.getByTestId('dashboard-content')).toHaveTextContent('tasks');
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

    expect(mockUpdateSpace).toHaveBeenCalledWith('access-token', personalProject.id, {
      name: 'Sunday Desk',
    });
    expect(mockRefreshProjects).toHaveBeenCalled();
  });
});
