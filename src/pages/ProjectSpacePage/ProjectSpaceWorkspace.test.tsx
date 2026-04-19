import React, { createContext, type PropsWithChildren, type ReactElement, useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ProjectSpaceWorkspace } from './ProjectSpaceWorkspace';
import { createProjectSpaceWorkspaceFixture } from './testUtils/projectSpaceWorkspaceTestFixture';

const fixture = createProjectSpaceWorkspaceFixture();

const motionFactory = (tag: keyof HTMLElementTagNameMap) =>
  ({ children, ...props }: PropsWithChildren<Record<string, unknown>>): ReactElement =>
    React.createElement(tag, props, children);

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return actual;
});

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, key) => motionFactory((typeof key === 'string' ? key : 'div') as keyof HTMLElementTagNameMap),
    },
  ),
  useReducedMotion: () => false,
}));

type DialogContextValue = {
  open: boolean;
  onOpenChange?: (nextOpen: boolean) => void;
};

const DialogContext = createContext<DialogContextValue>({ open: false });

vi.mock('../../components/project-space/ProjectSpaceDialogPrimitives', () => ({
  Dialog: ({ open, onOpenChange, children }: PropsWithChildren<{ open: boolean; onOpenChange?: (nextOpen: boolean) => void }>) => (
    <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
  ),
  DialogContent: ({ open, children }: PropsWithChildren<{ open: boolean }>) =>
    open ? <div data-testid="dialog-content">{children}</div> : null,
  DialogHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
  DialogDescription: ({ children }: PropsWithChildren) => <p>{children}</p>,
  DialogClose: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => {
    const { onOpenChange } = useContext(DialogContext);
    return (
      <button type="button" onClick={() => onOpenChange?.(false)} {...props}>
        {children}
      </button>
    );
  },
}));

vi.mock('../../components/primitives', () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true">{name}</span>,
  IconButton: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => <button type="button" {...props}>{children}</button>,
  InlineNotice: ({ title, children }: PropsWithChildren<{ title?: string }>) => (
    <div role="alert">
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('../../components/auth/AccessDeniedView', () => ({
  AccessDeniedView: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock('../../components/project-space/OverviewView', () => ({
  OverviewView: ({
    activeView,
    onSelectView,
    onOpenTimelineRecord,
    onOpenCalendarRecord,
  }: {
    activeView: string;
    onSelectView: (viewId: 'timeline' | 'calendar' | 'tasks' | 'kanban') => void;
    onOpenTimelineRecord: (recordId: string) => void;
    onOpenCalendarRecord: (recordId: string) => void;
  }) => (
    <section>
      <p data-testid="overview-active-view">{activeView}</p>
      <button type="button" onClick={() => onSelectView('calendar')}>Switch overview to calendar</button>
      <button type="button" onClick={() => onOpenTimelineRecord('record-timeline')}>Open timeline record</button>
      <button type="button" onClick={() => onOpenCalendarRecord('record-calendar')}>Open calendar record</button>
    </section>
  ),
}));

vi.mock('../../components/project-space/PaneSwitcher', () => ({
  PaneSwitcher: ({ panes, onPaneChange }: { panes: Array<{ id: string; label: string }>; onPaneChange: (paneId: string, source: 'click') => void }) => (
    <div aria-label="Pane switcher">
      {panes.map((pane) => (
        <button key={pane.id} type="button" onClick={() => onPaneChange(pane.id, 'click')}>
          {pane.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../components/project-space/WorkView', () => ({
  WorkView: ({
    pane,
    modulesEnabled,
    onOpenRecord,
  }: {
    pane: { name: string } | null;
    modulesEnabled?: boolean;
    onOpenRecord?: (recordId: string) => void;
  }) => (
    <section aria-label="Work view">
      <p>{pane?.name ?? 'No pane'}</p>
      <p>{modulesEnabled ? 'Modules enabled' : 'Modules disabled'}</p>
      <button type="button" onClick={() => onOpenRecord?.('record-work')}>Open work record</button>
    </section>
  ),
}));

vi.mock('../../components/project-space/CommentRail', () => ({
  CommentRail: ({ comments }: { comments: unknown[] }) => <div>Comment rail {comments.length}</div>,
}));

vi.mock('../../components/project-space/CommentComposer', () => ({
  CommentComposer: ({ onSubmit, disabled }: { onSubmit: () => void; disabled?: boolean }) => (
    <button type="button" disabled={disabled} onClick={onSubmit}>Submit doc comment</button>
  ),
}));

vi.mock('../../components/project-space/MentionPicker', () => ({
  MentionPicker: ({ buttonLabel }: { buttonLabel: string }) => <button type="button">{buttonLabel}</button>,
}));

vi.mock('../../components/project-space/RelationsSection', () => ({
  RelationsSection: () => <div>Relations section</div>,
}));

vi.mock('../../components/project-space/FileInspectorActionBar', () => ({
  FileInspectorActionBar: () => <div>File action bar</div>,
}));

vi.mock('../../components/project-space/BacklinksPanel', () => ({
  BacklinksPanel: () => <div>Backlinks panel</div>,
}));

vi.mock('../../components/project-space/AutomationBuilder', () => ({
  AutomationBuilder: () => <section>Automation builder</section>,
}));

vi.mock('../../components/project-space/ModuleFeedback', () => ({
  ModuleLoadingState: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock('../../components/project-space/KanbanModuleSkin', () => ({
  KanbanModuleSkin: ({ onOpenRecord }: { onOpenRecord?: (recordId: string) => void }) => (
    <div>
      <p>Focused kanban module</p>
      <button type="button" onClick={() => onOpenRecord?.('record-kanban')}>Open focused kanban record</button>
    </div>
  ),
}));

vi.mock('../../components/project-space/TableModuleSkin', () => ({
  TableModuleSkin: ({ onOpenRecord }: { onOpenRecord?: (recordId: string) => void }) => (
    <div>
      <p>Focused table module</p>
      <button type="button" onClick={() => onOpenRecord?.('record-table')}>Open focused table record</button>
    </div>
  ),
}));

vi.mock('../../features/notes/CollaborativeLexicalEditor', () => ({
  CollaborativeLexicalEditor: ({ editable }: { editable: boolean }) => (
    <div aria-label="Project note editor">{editable ? 'Editable workspace doc' : 'Read only workspace doc'}</div>
  ),
}));

const openInspectorMock = vi.fn();
const closeInspectorMock = vi.fn();
const onUpdatePaneFromWorkViewMock = vi.fn();

const projectViewsRuntimeState = {
  collections: [{ collection_id: 'collection-1', name: 'Tasks' }],
  views: [fixture.tableView, fixture.kanbanView],
  kanbanRuntimeDataByViewId: {
    'view-kanban': {
      groups: [{ id: 'todo', label: 'To Do', records: [] }],
      groupOptions: [{ id: 'todo', label: 'To Do' }],
      loading: false,
      groupingConfigured: true,
      groupableFields: [],
      metadataFieldIds: {},
      wipLimits: {},
    },
  },
  kanbanViews: [fixture.kanbanView],
  creatingKanbanViewByModuleId: {},
  focusedWorkView: null as null | typeof fixture.tableView,
  focusedWorkViewData: {
    schema: {
      collection_id: 'collection-1',
      name: 'Tasks',
      fields: [],
    },
    records: [],
  },
  focusedWorkViewError: null as string | null,
  focusedWorkViewId: '',
  focusedWorkViewLoading: false,
  onCreateKanbanRecord: vi.fn(),
  onConfigureKanbanGrouping: vi.fn(),
  onCreateTableRecord: vi.fn(),
  onDeleteKanbanRecord: vi.fn(),
  onDeleteTableRecords: vi.fn(),
  onBulkUpdateTableRecords: vi.fn(),
  onMoveKanbanRecord: vi.fn(),
  onEnsureKanbanView: vi.fn(),
  onUpdateKanbanRecord: vi.fn(),
  onUpdateTableRecord: vi.fn(),
  recordsError: null as string | null,
  refreshViewsAndRecords: vi.fn(),
  selectedEmbedViewId: '',
  setRecordsError: vi.fn(),
  setSelectedEmbedViewId: vi.fn(),
  tableViewRuntimeDataById: {},
  tableViews: [fixture.tableView],
};

const workspaceDocRuntimeState = {
  collabSession: null,
  collabSessionError: null,
  commentTriggerRef: { current: null },
  docBootstrapLexicalState: null,
  docBootstrapReady: true,
  docCommentComposerOpen: false,
  docCommentError: null,
  docCommentText: '',
  docComments: [],
  onAddDocComment: vi.fn(),
  onDocCommentDialogOpenChange: vi.fn(),
  onDocEditorChange: vi.fn(),
  onInsertDocMention: vi.fn(),
  onJumpToDocComment: vi.fn(),
  onResolveDocComment: vi.fn(),
  onUploadDocAsset: vi.fn(),
  orphanedDocComments: [],
  pendingDocAssetEmbed: null,
  pendingDocFocusNodeKey: null,
  pendingDocMentionInsert: null,
  pendingViewEmbedInsert: null,
  queueViewEmbed: vi.fn(),
  selectedDocNodeKey: null as string | null,
  setDocCommentText: vi.fn(),
  setPendingDocAssetEmbed: vi.fn(),
  setPendingDocFocusNodeKey: vi.fn(),
  setPendingDocMentionInsert: vi.fn(),
  setPendingViewEmbedInsert: vi.fn(),
  setSelectedDocNodeKey: vi.fn(),
  setShowResolvedDocComments: vi.fn(),
  showResolvedDocComments: false,
  uploadingDocAsset: false,
};

const recordInspectorState = {
  closeInspector: closeInspectorMock,
  inspectorBacklinks: [],
  inspectorBacklinksError: null,
  inspectorBacklinksLoading: false,
  inspectorCommentText: '',
  inspectorError: null,
  inspectorLoading: false,
  inspectorMutationPane: fixture.sharedPane,
  inspectorMutationPaneCanEdit: true,
  inspectorRecord: null as null | typeof fixture.inspectorRecord,
  inspectorRecordId: null as string | null,
  inspectorRelationFields: [],
  onAddRecordComment: vi.fn((event?: Event) => event?.preventDefault?.()),
  onAddRelation: vi.fn(),
  onAttachFile: vi.fn((event?: Event) => event?.preventDefault?.()),
  onDetachInspectorAttachment: vi.fn(),
  onInsertRecordCommentMention: vi.fn(),
  onMoveInspectorAttachment: vi.fn(),
  onRemoveRelation: vi.fn(),
  onRenameInspectorAttachment: vi.fn(),
  onSaveRecordField: vi.fn(),
  openInspector: openInspectorMock,
  relationMutationError: null,
  removingRelationId: null,
  savingValues: false,
  selectedAttachmentId: null,
  setInspectorCommentText: vi.fn(),
  setSelectedAttachmentId: vi.fn(),
  uploadingAttachment: false,
};

vi.mock('../../hooks/useCalendarRuntime', () => ({
  useCalendarRuntime: () => ({
    calendarEvents: [],
    calendarLoading: false,
    calendarMode: 'all',
    refreshCalendar: vi.fn(),
    setCalendarMode: vi.fn(),
  }),
}));

vi.mock('../../hooks/useProjectTasksRuntime', () => ({
  useProjectTasksRuntime: () => ({
    loadProjectTaskPage: vi.fn(),
    projectTasksError: null,
    projectTasksLoading: false,
    tasksOverviewRows: [],
  }),
}));

vi.mock('../../hooks/useProjectFilesRuntime', () => ({
  useProjectFilesRuntime: () => ({
    assetEntries: [],
    assetRoots: [],
    assetWarning: null,
    ensureProjectAssetRoot: vi.fn(),
    newAssetRootPath: '',
    onAddAssetRoot: vi.fn((event?: Event) => event?.preventDefault?.()),
    onLoadAssets: vi.fn(),
    onOpenPaneFile: vi.fn(),
    onUploadPaneFiles: vi.fn(),
    onUploadProjectFiles: vi.fn(),
    paneFiles: [],
    projectFiles: [],
    refreshTrackedProjectFiles: vi.fn(),
    setNewAssetRootPath: vi.fn(),
  }),
}));

vi.mock('../../hooks/useProjectMembers', () => ({
  useProjectMembers: () => ({
    projectMembers: fixture.projectMembers,
    inviteEmail: '',
    isSubmittingInvite: false,
    projectMemberMutationError: null,
    projectMemberMutationNotice: null,
    clearProjectMemberFeedback: vi.fn(),
    onInviteEmailChange: vi.fn(),
    onCreateProjectMember: vi.fn(),
  }),
}));

vi.mock('../../hooks/usePaneMutations', () => ({
  usePaneMutations: () => ({
    onCreatePane: vi.fn(async () => ({ pane_id: 'pane-new', name: 'New Pane' })),
    onDeletePane: vi.fn(async () => '/projects/project-1/work/pane-shared'),
    onMovePane: vi.fn(),
    onTogglePaneMember: vi.fn(),
    onTogglePinned: vi.fn(),
    onUpdatePaneFromWorkView: onUpdatePaneFromWorkViewMock,
    paneMutationError: null,
    setPaneMutationError: vi.fn(),
  }),
}));

vi.mock('../../hooks/useProjectViewsRuntime', () => ({
  useProjectViewsRuntime: () => projectViewsRuntimeState,
}));

vi.mock('../../hooks/useRecordInspector', () => ({
  useRecordInspector: () => recordInspectorState,
}));

vi.mock('../../hooks/useAutomationRuntime', () => ({
  useAutomationRuntime: () => ({
    automationRules: [],
    automationRuns: [],
    onCreateAutomationRule: vi.fn(),
    onDeleteAutomationRule: vi.fn(),
    onToggleAutomationRule: vi.fn(),
    onUpdateAutomationRule: vi.fn(),
  }),
}));

vi.mock('../../hooks/useTimelineRuntime', () => ({
  useTimelineRuntime: () => ({
    refreshTimeline: vi.fn(),
    timelineClusters: [],
    timelineFilters: [],
    toggleTimelineFilter: vi.fn(),
  }),
}));

vi.mock('../../hooks/useRemindersRuntime', () => ({
  useRemindersRuntime: () => ({
    reminders: [],
    loading: false,
    error: null,
    dismiss: vi.fn(),
    create: vi.fn(),
  }),
}));

vi.mock('../../hooks/useWorkspaceDocRuntime', () => ({
  useWorkspaceDocRuntime: () => workspaceDocRuntimeState,
}));

vi.mock('../../hooks/useQuickCapture', () => ({
  useQuickCapture: () => ({
    createAndOpenCaptureRecord: vi.fn(async () => false),
    quickCaptureInFlightRef: { current: false },
  }),
}));

vi.mock('./hooks/useWorkViewModuleRuntime', () => ({
  useWorkViewModuleRuntime: () => ({
    tableContract: {
      views: [],
      defaultViewId: null,
      dataByViewId: {},
    },
    kanbanContract: {
      views: [],
      defaultViewId: null,
      dataByViewId: {},
      onMoveRecord: vi.fn(),
    },
    calendarContract: {
      events: [],
      loading: false,
      scope: 'all',
      onScopeChange: vi.fn(),
    },
    filesContract: {
      paneFiles: [],
      projectFiles: [],
      onUploadPaneFiles: vi.fn(),
      onUploadProjectFiles: vi.fn(),
      onOpenFile: vi.fn(),
    },
    quickThoughtsContract: {
      storageKeyBase: 'quick-thoughts',
    },
    tasksContract: {
      items: [],
      loading: false,
      onCreateTask: vi.fn(async () => undefined),
      onUpdateTaskStatus: vi.fn(),
      onUpdateTaskPriority: vi.fn(),
      onUpdateTaskDueDate: vi.fn(),
      onDeleteTask: vi.fn(),
    },
    timelineContract: {
      clusters: [],
      activeFilters: [],
      loading: false,
      hasMore: false,
      onFilterToggle: vi.fn(),
      onLoadMore: vi.fn(),
      onItemClick: vi.fn(),
    },
    remindersContract: {
      items: [],
      loading: false,
      error: null,
      onDismiss: vi.fn(async () => undefined),
      onCreate: vi.fn(async () => undefined),
    },
  }),
}));

const LocationEcho = () => {
  const location = useLocation();
  return <div data-testid="location-state">{`${location.pathname}${location.search}`}</div>;
};

const renderWorkspace = ({
  entry,
  activeTab,
}: {
  entry: string;
  activeTab: 'overview' | 'work' | 'tools';
}) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route
        path="/projects/:projectId/overview"
        element={
          <>
            <LocationEcho />
            <ProjectSpaceWorkspace
              activeTab={activeTab}
              project={fixture.project}
              panes={fixture.panes}
              setPanes={vi.fn()}
              projectMembers={fixture.projectMembers}
              accessToken="token"
              sessionUserId="user-1"
              refreshProjectData={vi.fn(async () => undefined)}
              timeline={fixture.timeline}
              setTimeline={vi.fn()}
            />
          </>
        }
      />
      <Route
        path="/projects/:projectId/work/:paneId"
        element={
          <>
            <LocationEcho />
            <ProjectSpaceWorkspace
              activeTab={activeTab}
              project={fixture.project}
              panes={fixture.panes}
              setPanes={vi.fn()}
              projectMembers={fixture.projectMembers}
              accessToken="token"
              sessionUserId="user-1"
              refreshProjectData={vi.fn(async () => undefined)}
              timeline={fixture.timeline}
              setTimeline={vi.fn()}
            />
          </>
        }
      />
      <Route
        path="/projects/:projectId/tools"
        element={
          <>
            <LocationEcho />
            <ProjectSpaceWorkspace
              activeTab={activeTab}
              project={fixture.project}
              panes={fixture.panes}
              setPanes={vi.fn()}
              projectMembers={fixture.projectMembers}
              accessToken="token"
              sessionUserId="user-1"
              refreshProjectData={vi.fn(async () => undefined)}
              timeline={fixture.timeline}
              setTimeline={vi.fn()}
            />
          </>
        }
      />
    </Routes>
  </MemoryRouter>,
);

describe('ProjectSpaceWorkspace characterization', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    openInspectorMock.mockReset();
    closeInspectorMock.mockReset();
    onUpdatePaneFromWorkViewMock.mockReset();
    projectViewsRuntimeState.focusedWorkView = null;
    projectViewsRuntimeState.focusedWorkViewId = '';
    workspaceDocRuntimeState.docBootstrapReady = true;
    workspaceDocRuntimeState.docCommentComposerOpen = false;
    workspaceDocRuntimeState.selectedDocNodeKey = null;
    workspaceDocRuntimeState.onDocCommentDialogOpenChange = vi.fn();
    projectViewsRuntimeState.selectedEmbedViewId = '';
    projectViewsRuntimeState.setSelectedEmbedViewId = vi.fn();
    projectViewsRuntimeState.recordsError = null;
    recordInspectorState.inspectorRecord = null;
    recordInspectorState.inspectorRecordId = null;
    recordInspectorState.inspectorMutationPaneCanEdit = true;
  });

  it('reads the overview sub-view from the query string and syncs changes back to the URL', async () => {
    renderWorkspace({
      entry: '/projects/project-1/overview?view=tasks',
      activeTab: 'overview',
    });

    expect(screen.getByTestId('overview-active-view')).toHaveTextContent('tasks');
    await userEvent.click(screen.getByRole('button', { name: 'Switch overview to calendar' }));

    await waitFor(() => {
      expect(screen.getByTestId('overview-active-view')).toHaveTextContent('calendar');
      expect(screen.getByTestId('location-state')).toHaveTextContent('/projects/project-1/overview?view=calendar');
    });
  });

  it('wires overview callbacks into the record inspector opener', async () => {
    renderWorkspace({
      entry: '/projects/project-1/overview',
      activeTab: 'overview',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Open timeline record' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open calendar record' }));

    expect(openInspectorMock).toHaveBeenNthCalledWith(1, 'record-timeline', undefined);
    expect(openInspectorMock).toHaveBeenNthCalledWith(2, 'record-calendar', undefined);
  });

  it('hides the pane switcher for pinned routes until the user reveals it', async () => {
    renderWorkspace({
      entry: '/projects/project-1/work/pane-private?pinned=1',
      activeTab: 'work',
    });

    expect(screen.queryByLabelText('Pane switcher')).not.toBeInTheDocument();
    expect(screen.getByText('Pane switcher hidden. Use the focusable toggle above to reveal it.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show pane switcher' }));

    expect(screen.getByLabelText('Pane switcher')).toBeInTheDocument();
  });

  it('opens pane settings with the current pane details and keeps region toggle wiring intact', async () => {
    renderWorkspace({
      entry: '/projects/project-1/work/pane-shared',
      activeTab: 'work',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Pane settings' }));

    expect(screen.getByRole('heading', { name: 'Pane Settings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Pane name')).toHaveValue('Shared Work');

    await userEvent.click(screen.getByRole('button', { name: 'Hide modules' }));
    expect(onUpdatePaneFromWorkViewMock).toHaveBeenCalledWith('pane-shared', expect.objectContaining({
      layout_config: expect.objectContaining({
        modules_enabled: false,
        workspace_enabled: true,
      }),
    }));
  });

  it('clears the focused view query parameter from the work route when closed', async () => {
    projectViewsRuntimeState.focusedWorkView = fixture.tableView;
    projectViewsRuntimeState.focusedWorkViewId = fixture.tableView.view_id;

    renderWorkspace({
      entry: `/projects/project-1/work/pane-shared?view_id=${fixture.tableView.view_id}`,
      activeTab: 'work',
    });

    expect(screen.getByText(`Focused View: ${fixture.tableView.name}`)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close focused view' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('/projects/project-1/work/pane-shared');
      expect(screen.getByTestId('location-state')).not.toHaveTextContent('view_id=');
    });
  });

  it('renders the workspace doc hidden state when the pane disables workspace content', () => {
    const originalLayout = fixture.sharedPane.layout_config;
    fixture.sharedPane.layout_config = {
      ...fixture.sharedPane.layout_config,
      workspace_enabled: false,
    };

    renderWorkspace({
      entry: '/projects/project-1/work/pane-shared',
      activeTab: 'work',
    });

    expect(screen.getByText('This pane is set to modules-only mode. The workspace doc is hidden here.')).toBeInTheDocument();

    fixture.sharedPane.layout_config = originalLayout;
  });

  it('gates the doc comment dialog on block selection', async () => {
    workspaceDocRuntimeState.selectedDocNodeKey = 'node-1';
    workspaceDocRuntimeState.docCommentComposerOpen = true;
    workspaceDocRuntimeState.docCommentText = 'Comment body';

    renderWorkspace({
      entry: '/projects/project-1/work/pane-shared',
      activeTab: 'work',
    });

    expect(screen.getByText('Selected block:')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Comment on block' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit doc comment' })).toBeEnabled();
    workspaceDocRuntimeState.docCommentText = '';
  });

  it('renders the inspector and routes close actions back through the close hook', async () => {
    recordInspectorState.inspectorRecord = fixture.inspectorRecord;
    recordInspectorState.inspectorRecordId = fixture.inspectorRecord.record_id;

    renderWorkspace({
      entry: '/projects/project-1/work/pane-shared',
      activeTab: 'work',
    });

    expect(screen.getByRole('heading', { name: 'Record Inspector' })).toBeInTheDocument();
    expect(screen.getByText('Audit task')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close inspector'));
    expect(closeInspectorMock).toHaveBeenCalledTimes(1);
  });
});
