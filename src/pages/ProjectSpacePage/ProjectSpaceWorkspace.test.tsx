import React, { createContext, type PropsWithChildren, type ReactElement, useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ProjectSpaceWorkspace } from './ProjectSpaceWorkspace';
import { ProjectSpaceProjectSettingsDialog } from './ProjectSpaceWorkspace/ProjectSpaceProjectSettingsDialog';
import { ProjectSpaceWorkspaceDocSection } from './ProjectSpaceWorkspace/ProjectSpaceWorkspaceDocSection';
import {
  getActiveInspectorFocusTarget,
  readElementRect,
  resolveInspectorFocusTarget,
} from './ProjectSpaceWorkspace/domFocus';
import {
  collectProjectTaskCollectionIds,
  projectCanEditForUser,
  relationFieldTargetCollectionId,
} from './ProjectSpaceWorkspace/projectModel';
import { readOverviewView } from './ProjectSpaceWorkspace/overviewState';
import { toBase64 } from './ProjectSpaceWorkspace/encoding';
import { createProjectSpaceWorkspaceFixture } from './testUtils/projectSpaceWorkspaceTestFixture';
import type { HubRecordDetail } from '../../shared/api-types/records';

const fixture = createProjectSpaceWorkspaceFixture();
const fixtureInspectorSchema = fixture.inspectorRecord.schema;

const createInspectorRecord = (overrides: Partial<HubRecordDetail> = {}): HubRecordDetail => ({
  ...fixture.inspectorRecord,
  schema: fixtureInspectorSchema
    ? {
        ...fixtureInspectorSchema,
        fields: fixtureInspectorSchema.fields.map((field) => ({ ...field })),
      }
    : null,
  values: {
    ...fixture.inspectorRecord.values,
  },
  capabilities: {
    ...fixture.inspectorRecord.capabilities,
    reminders: [...fixture.inspectorRecord.capabilities.reminders],
    participants: [...fixture.inspectorRecord.capabilities.participants],
    assignments: [...fixture.inspectorRecord.capabilities.assignments],
  },
  relations: {
    outgoing: [...fixture.inspectorRecord.relations.outgoing],
    incoming: [...fixture.inspectorRecord.relations.incoming],
  },
  attachments: [...fixture.inspectorRecord.attachments],
  comments: [...fixture.inspectorRecord.comments],
  activity: [...fixture.inspectorRecord.activity],
  ...overrides,
});

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

vi.mock('../../components/project-space/ProjectSwitcher', () => ({
  ProjectSwitcher: ({ projects, onProjectChange }: { projects: Array<{ id: string; label: string }>; onProjectChange: (projectId: string, source: 'click') => void }) => (
    <div role="toolbar" aria-label="Project switcher">
      {projects.map((project) => (
        <button key={project.id} type="button" onClick={() => onProjectChange(project.id, 'click')}>
          {project.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../components/project-space/WorkView', () => ({
  WorkView: ({
    project,
    modulesEnabled,
    onOpenRecord,
  }: {
    project: { name: string } | null;
    modulesEnabled?: boolean;
    onOpenRecord?: (recordId: string) => void;
  }) => (
    <section aria-label="Work view">
      <p>{project?.name ?? 'No project'}</p>
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
  MentionPicker: ({ buttonLabel, onSelect }: { buttonLabel: string; onSelect?: (value: unknown) => void }) => (
    <button type="button" onClick={() => onSelect?.({ entity_type: 'user', entity_id: 'user-2' })}>
      {buttonLabel}
    </button>
  ),
}));

vi.mock('../../components/project-space/RelationsSection', () => ({
  RelationsSection: ({
    outgoing,
    incoming,
    mutationError,
  }: {
    outgoing?: unknown[];
    incoming?: unknown[];
    mutationError?: string | null;
  }) => (
    <div>
      Relations section
      <span data-testid="relations-count">{(outgoing?.length ?? 0) + (incoming?.length ?? 0)}</span>
      {mutationError ? <span>{mutationError}</span> : null}
    </div>
  ),
}));

vi.mock('../../components/project-space/FileInspectorActionBar', () => ({
  FileInspectorActionBar: ({
    fileName,
    onRename,
    onMove,
    onRemove,
  }: {
    fileName: string;
    onRename?: (nextName: string) => void;
    onMove?: (projectId: string) => void;
    onRemove?: () => void;
  }) => (
    <div>
      <span>File action bar {fileName}</span>
      <button type="button" onClick={() => onRename?.('renamed-attachment.txt')}>Rename attachment</button>
      <button type="button" onClick={() => onMove?.('project-private')}>Move attachment</button>
      <button type="button" onClick={() => onRemove?.()}>Remove attachment</button>
    </div>
  ),
}));

vi.mock('../../components/project-space/BacklinksPanel', () => ({
  BacklinksPanel: ({
    backlinks,
    onOpenBacklink,
  }: {
    backlinks?: Array<{ mention_id: string; source_entity_type: string }>;
    onOpenBacklink?: (backlink: unknown) => void;
  }) => (
    <div>
      <span>Backlinks panel</span>
      {(backlinks ?? []).map((backlink) => (
        <button key={backlink.mention_id} type="button" onClick={() => onOpenBacklink?.(backlink)}>
          Open backlink {backlink.source_entity_type}
        </button>
      ))}
    </div>
  ),
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
const onUpdateProjectFromWorkViewMock = vi.fn();

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
  inspectorBacklinks: [] as unknown[],
  inspectorBacklinksError: null as string | null,
  inspectorBacklinksLoading: false,
  inspectorCommentText: '',
  inspectorError: null,
  inspectorLoading: false,
  inspectorMutationProject: fixture.sharedProject,
  inspectorMutationProjectCanEdit: true,
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
  relationMutationError: null as string | null,
  removingRelationId: null,
  savingValues: false,
  selectedAttachmentId: null as string | null,
  setInspectorCommentText: vi.fn(),
  setSelectedAttachmentId: vi.fn(),
  uploadingAttachment: false,
};

const projectFilesRuntimeState = {
  ensureProjectAssetRoot: vi.fn(),
  onOpenProjectFile: vi.fn(),
  onUploadProjectFiles: vi.fn(),
  onUploadSpaceFiles: vi.fn(),
  projectFiles: [],
  spaceFiles: [],
  refreshTrackedProjectFiles: vi.fn(),
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
  useProjectFilesRuntime: () => projectFilesRuntimeState,
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

vi.mock('../../hooks/useProjectMutations', () => ({
  useProjectMutations: () => ({
    onCreateProject: vi.fn(async () => ({ space_id: 'project-new', name: 'New Project' })),
    onDeleteProject: vi.fn(async () => '/projects/project-1/work/project-shared'),
    onMoveProject: vi.fn(),
    onToggleProjectMember: vi.fn(),
    onTogglePinned: vi.fn(),
    onUpdateProjectFromWorkView: onUpdateProjectFromWorkViewMock,
    projectMutationError: null,
    setProjectMutationError: vi.fn(),
  }),
}));

vi.mock('../../hooks/useProjectViewsRuntime', () => ({
  useProjectViewsRuntime: () => projectViewsRuntimeState,
}));

vi.mock('../../hooks/useRecordInspector', () => ({
  useRecordInspector: () => recordInspectorState,
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
      projectFiles: [],
      spaceFiles: [],
      onUploadProjectFiles: vi.fn(),
      onUploadSpaceFiles: vi.fn(),
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
  activeTab: 'overview' | 'work';
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
              projects={fixture.projects}
              setProjects={vi.fn()}
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
        path="/projects/:projectId/work/:workProjectId"
        element={
          <>
            <LocationEcho />
            <ProjectSpaceWorkspace
              activeTab={activeTab}
              project={fixture.project}
              projects={fixture.projects}
              setProjects={vi.fn()}
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

const renderWorkspaceDocSection = ({
  activeProject = fixture.sharedProject,
  activeProjectCanEdit = true,
  workspaceEnabled = true,
  activeProjectDocId = 'doc-shared',
  uploadingDocAsset = false,
  onUploadDocAsset = vi.fn<(event: React.FormEvent<HTMLFormElement>) => void>(),
}: {
  activeProject?: typeof fixture.sharedProject | typeof fixture.privateProject | null;
  activeProjectCanEdit?: boolean;
  workspaceEnabled?: boolean;
  activeProjectDocId?: string | null;
  uploadingDocAsset?: boolean;
  onUploadDocAsset?: (event: React.FormEvent<HTMLFormElement>) => void;
} = {}) => render(
  <MemoryRouter>
    <ProjectSpaceWorkspaceDocSection
      accessToken="token"
      projectId="project-1"
      projectMembers={fixture.projectMembers}
      sessionUserId="user-1"
      activeProject={activeProject}
      activeProjectCanEdit={activeProjectCanEdit}
      workspaceEnabled={workspaceEnabled}
      activeProjectDocId={activeProjectDocId}
      docBootstrapReady
      docBootstrapLexicalState={{}}
      collabSession={null}
      collabSessionError={null}
      onDocEditorChange={vi.fn()}
      selectedDocNodeKey={null}
      setSelectedDocNodeKey={vi.fn()}
      pendingDocFocusNodeKey={null}
      setPendingDocFocusNodeKey={vi.fn()}
      pendingDocMentionInsert={null}
      setPendingDocMentionInsert={vi.fn()}
      pendingViewEmbedInsert={null}
      setPendingViewEmbedInsert={vi.fn()}
      pendingDocAssetEmbed={null}
      setPendingDocAssetEmbed={vi.fn()}
      onInsertDocMention={vi.fn()}
      views={[fixture.tableView, fixture.kanbanView]}
      selectedEmbedViewId=""
      setSelectedEmbedViewId={vi.fn()}
      onInsertViewEmbed={vi.fn()}
      onOpenRecord={vi.fn()}
      onOpenEmbeddedView={vi.fn()}
      uploadingDocAsset={uploadingDocAsset}
      onUploadDocAsset={onUploadDocAsset}
      docCommentComposerOpen={false}
      commentTriggerRef={{ current: null }}
      onDocCommentDialogOpenChange={vi.fn()}
      docCommentError={null}
      docCommentText=""
      setDocCommentText={vi.fn()}
      onAddDocComment={vi.fn()}
      docComments={[]}
      orphanedDocComments={[]}
      onResolveDocComment={vi.fn()}
      onJumpToDocComment={vi.fn()}
      showResolvedDocComments={false}
      setShowResolvedDocComments={vi.fn()}
    />
  </MemoryRouter>,
);

describe('ProjectSpaceWorkspace characterization', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    openInspectorMock.mockReset();
    closeInspectorMock.mockReset();
    onUpdateProjectFromWorkViewMock.mockReset();
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
    recordInspectorState.inspectorMutationProjectCanEdit = true;
    recordInspectorState.inspectorBacklinks = [];
    recordInspectorState.inspectorBacklinksError = null;
    recordInspectorState.inspectorCommentText = '';
    recordInspectorState.relationMutationError = null;
    recordInspectorState.selectedAttachmentId = null;
    recordInspectorState.onAttachFile.mockClear();
    recordInspectorState.onDetachInspectorAttachment.mockClear();
    recordInspectorState.onInsertRecordCommentMention.mockClear();
    recordInspectorState.onMoveInspectorAttachment.mockClear();
    recordInspectorState.onAddRecordComment.mockClear();
    recordInspectorState.onRemoveRelation.mockClear();
    recordInspectorState.onRenameInspectorAttachment.mockClear();
    recordInspectorState.onSaveRecordField.mockClear();
    recordInspectorState.setInspectorCommentText.mockClear();
    recordInspectorState.setSelectedAttachmentId.mockClear();
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

  it('keeps Overview and Work available as top-level navigation affordances', () => {
    renderWorkspace({
      entry: '/projects/project-1/overview',
      activeTab: 'overview',
    });

    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Work' })).toBeInTheDocument();
  });

  it('does not expose a Tools navigation affordance', () => {
    renderWorkspace({
      entry: '/projects/project-1/overview',
      activeTab: 'overview',
    });

    expect(screen.queryByRole('button', { name: 'Tools' })).not.toBeInTheDocument();
  });

  it('hides the project switcher for pinned routes until the user reveals it', async () => {
    renderWorkspace({
      entry: '/projects/project-1/work/project-private?pinned=1',
      activeTab: 'work',
    });

    expect(screen.queryByLabelText('Project switcher')).not.toBeInTheDocument();
    expect(screen.getByText('Project switcher hidden. Use the focusable toggle above to reveal it.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show project switcher' }));

    expect(screen.getByLabelText('Project switcher')).toBeInTheDocument();
  });

  it('opens project settings with the current project details and keeps region toggle wiring intact', async () => {
    renderWorkspace({
      entry: '/projects/project-1/work/project-shared',
      activeTab: 'work',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Project settings' }));

    expect(screen.getByRole('button', { name: 'Project settings' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Project Settings' })).toBeInTheDocument();
    expect(screen.getByText('Manage settings for project Shared Work.')).toBeInTheDocument();
    expect(screen.getByLabelText('Project name')).toHaveValue('Shared Work');
    expect(screen.getByRole('link', { name: 'Open project' })).toHaveAttribute('href', '/projects/project-1/work/project-shared');

    await userEvent.click(screen.getByRole('button', { name: 'Hide modules' }));
    expect(onUpdateProjectFromWorkViewMock).toHaveBeenCalledWith('project-shared', expect.objectContaining({
      layout_config: expect.objectContaining({
        modules_enabled: false,
        workspace_enabled: true,
      }),
    }));

    await userEvent.click(screen.getByRole('button', { name: 'Hide workspace doc' }));
    expect(onUpdateProjectFromWorkViewMock).toHaveBeenCalledWith('project-shared', expect.objectContaining({
      layout_config: expect.objectContaining({
        modules_enabled: true,
        workspace_enabled: false,
      }),
    }));
  });

  it('clears the focused view query parameter from the work route when closed', async () => {
    projectViewsRuntimeState.focusedWorkView = fixture.tableView;
    projectViewsRuntimeState.focusedWorkViewId = fixture.tableView.view_id;

    renderWorkspace({
      entry: `/projects/project-1/work/project-shared?view_id=${fixture.tableView.view_id}`,
      activeTab: 'work',
    });

    expect(screen.getByText(`Focused View: ${fixture.tableView.name}`)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close focused view' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('/projects/project-1/work/project-shared');
      expect(screen.getByTestId('location-state')).not.toHaveTextContent('view_id=');
    });
  });

  it('renders the workspace doc hidden state when the project disables workspace content', () => {
    const originalLayout = { ...fixture.sharedProject.layout_config };

    try {
      fixture.sharedProject.layout_config = {
        ...fixture.sharedProject.layout_config,
        workspace_enabled: false,
      };

      renderWorkspace({
        entry: '/projects/project-1/work/project-shared',
        activeTab: 'work',
      });

      expect(screen.getByText('This project is set to modules-only mode. The workspace doc is hidden here.')).toBeInTheDocument();
    } finally {
      fixture.sharedProject.layout_config = originalLayout;
    }
  });

  it('gates the doc comment dialog on block selection', async () => {
    workspaceDocRuntimeState.selectedDocNodeKey = 'node-1';
    workspaceDocRuntimeState.docCommentComposerOpen = true;
    workspaceDocRuntimeState.docCommentText = 'Comment body';

    renderWorkspace({
      entry: '/projects/project-1/work/project-shared',
      activeTab: 'work',
    });

    expect(screen.getByText('Selected block:')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Comment on block' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit doc comment' })).toBeEnabled();
    workspaceDocRuntimeState.docCommentText = '';
  });

  it('shows the upload control for editable docs and hides it for read-only docs', () => {
    renderWorkspace({
      entry: '/projects/project-1/work/project-shared',
      activeTab: 'work',
    });

    expect(screen.getByRole('button', { name: 'Upload doc asset' })).toBeInTheDocument();
    cleanup();

    renderWorkspace({
      entry: '/projects/project-1/work/project-private',
      activeTab: 'work',
    });

    expect(screen.queryByRole('button', { name: 'Upload doc asset' })).not.toBeInTheDocument();
    expect(screen.getByText('Read-only doc mode. You can review the project and leave comments below.')).toBeInTheDocument();
  });

  it('renders the inspector and routes close actions back through the close hook', async () => {
    recordInspectorState.inspectorRecord = fixture.inspectorRecord;
    recordInspectorState.inspectorRecordId = fixture.inspectorRecord.record_id;

    renderWorkspace({
      entry: '/projects/project-1/work/project-shared',
      activeTab: 'work',
    });

    expect(screen.getByRole('heading', { name: 'Record Inspector' })).toBeInTheDocument();
    expect(screen.getByText('Audit task')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close inspector'));
    expect(closeInspectorMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: 'task',
      entry: '/projects/project-1/overview',
      activeTab: 'overview' as const,
      record: createInspectorRecord({
        title: 'Ship inspector refactor',
        schema: {
          collection_id: 'collection-1',
          name: 'Tasks',
          fields: [
            { field_id: 'field-title', name: 'Title', type: 'text', config: {}, sort_order: 1 },
            { field_id: 'field-priority', name: 'Priority', type: 'select', config: {}, sort_order: 2 },
          ],
        },
        values: {
          'field-title': 'Ship inspector refactor',
          'field-priority': 'high',
        },
      }),
      expected: ['Task', 'Ship inspector refactor', 'Collection: Tasks', 'Priority'],
    },
    {
      label: 'event',
      entry: '/projects/project-1/work/project-shared',
      activeTab: 'work' as const,
      record: createInspectorRecord({
        title: 'Design review',
        collection_id: 'collection-events',
        schema: {
          collection_id: 'collection-events',
          name: 'Events',
          fields: [
            { field_id: 'field-start', name: 'Start', type: 'datetime', config: {}, sort_order: 1 },
            { field_id: 'field-location', name: 'Location', type: 'text', config: {}, sort_order: 2 },
          ],
        },
        values: {
          'field-start': '2026-04-21T14:00:00.000Z',
          'field-location': 'Studio A',
        },
        capabilities: {
          capability_types: ['event'],
          task_state: null,
          event_state: {
            start_dt: '2026-04-21T14:00:00.000Z',
            end_dt: '2026-04-21T15:00:00.000Z',
            timezone: 'America/New_York',
            location: 'Studio A',
            updated_at: '2026-04-19T00:00:00.000Z',
          },
          recurrence_rule: null,
          reminders: [],
          participants: [],
          assignments: [],
        },
      }),
      expected: ['Event', 'Design review', 'Collection: Events', 'Start', 'Location'],
    },
    {
      label: 'generic',
      entry: '/projects/project-1/work/project-shared',
      activeTab: 'work' as const,
      record: createInspectorRecord({
        title: 'Knowledge base entry',
        collection_id: 'collection-reference',
        source_project: null,
        schema: {
          collection_id: 'collection-reference',
          name: 'Reference',
          fields: [
            { field_id: 'field-owner', name: 'Owner', type: 'text', config: {}, sort_order: 1 },
            { field_id: 'field-link', name: 'Link', type: 'text', config: {}, sort_order: 2 },
          ],
        },
        values: {
          'field-owner': 'Ops',
          'field-link': 'https://example.com',
        },
        capabilities: {
          capability_types: [],
          task_state: null,
          event_state: null,
          recurrence_rule: null,
          reminders: [],
          participants: [],
          assignments: [],
        },
      }),
      expected: ['Record', 'Knowledge base entry', 'Collection: Reference', 'Owner', 'Link'],
    },
  ])('renders the $label inspector body through Project Space host flows', ({ entry, activeTab, record, expected }) => {
    recordInspectorState.inspectorRecord = record;
    recordInspectorState.inspectorRecordId = record.record_id;

    renderWorkspace({
      entry,
      activeTab,
    });

    for (const text of expected) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('preserves inspector attachment actions, comment wiring, and backlink opening', async () => {
    recordInspectorState.inspectorRecord = {
      ...fixture.inspectorRecord,
      attachments: [
        {
          attachment_id: 'attachment-1',
          provider: 'local',
          asset_root_id: 'root-1',
          asset_path: '/Projects/Home/brief.txt',
          name: 'brief.txt',
          mime_type: 'text/plain',
          size_bytes: 42,
          metadata: {},
          proxy_url: '/files/brief.txt',
          created_at: '2026-04-19T00:00:00.000Z',
        },
      ],
      comments: [
        {
          comment_id: 'comment-1',
          author_user_id: 'user-1',
          body_json: { text: 'Inspector comment body' },
          status: 'open',
          created_at: '2026-04-19T00:00:00.000Z',
          updated_at: '2026-04-19T00:00:00.000Z',
        },
      ],
      relations: {
        outgoing: [{
          relation_id: 'relation-1',
          to_record_id: 'record-2',
          via_field_id: 'field-related',
        }],
        incoming: [],
      },
      activity: [
        {
          timeline_event_id: 'activity-1',
          event_type: 'record.updated',
          created_at: '2026-04-19T00:00:00.000Z',
          actor_user_id: 'user-1',
          summary_json: {},
        },
      ],
    } as typeof fixture.inspectorRecord;
    recordInspectorState.inspectorRecordId = fixture.inspectorRecord.record_id;
    recordInspectorState.selectedAttachmentId = 'attachment-1';
    recordInspectorState.inspectorCommentText = 'Need follow-up';
    recordInspectorState.inspectorBacklinks = [
      {
        mention_id: 'mention-1',
        created_at: '2026-04-19T00:00:00.000Z',
        source_entity_type: 'doc',
        source_entity_id: 'doc-1',
        target_entity_type: 'record',
        target_entity_id: fixture.inspectorRecord.record_id,
        context: null,
        source: {
          doc_id: 'doc-1',
          project_id: 'project-private',
          project_name: 'Private Work',
          node_key: 'node-1',
          comment_target_entity_type: null,
          comment_target_entity_id: null,
          comment_author_user_id: null,
        },
      },
    ];
    recordInspectorState.relationMutationError = 'Relation mutation failed';

    renderWorkspace({
      entry: '/projects/project-1/work/project-shared',
      activeTab: 'work',
    });

    expect(screen.getByText('File action bar brief.txt')).toBeInTheDocument();
    expect(screen.getByText('Inspector comment body')).toBeInTheDocument();
    expect(screen.getByTestId('relations-count')).toHaveTextContent('1');
    expect(screen.getByText('Relation mutation failed')).toBeInTheDocument();
    expect(screen.getByText(/record\.updated/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Rename attachment' }));
    expect(recordInspectorState.onRenameInspectorAttachment).toHaveBeenCalledWith('attachment-1', 'renamed-attachment.txt');

    await userEvent.click(screen.getByRole('button', { name: 'Move attachment' }));
    expect(recordInspectorState.onMoveInspectorAttachment).toHaveBeenCalledWith('attachment-1', 'project-private');

    await userEvent.click(screen.getByRole('button', { name: 'Remove attachment' }));
    expect(recordInspectorState.onDetachInspectorAttachment).toHaveBeenCalledWith('attachment-1');

    await userEvent.click(screen.getByRole('button', { name: 'Attach' }));
    expect(recordInspectorState.onAttachFile).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: '@ Mention' }));
    expect(recordInspectorState.onInsertRecordCommentMention).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(recordInspectorState.onAddRecordComment).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Open backlink doc' }));
    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent('/projects/project-1/work/project-private');
    });
  });

  it('keeps the overview and work shell behavior stable after the tools surface removal', () => {
    renderWorkspace({
      entry: '/projects/project-1/work/project-private?pinned=1',
      activeTab: 'work',
    });

    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Work' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open pinned project Private Work' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Asset Library Roots')).not.toBeInTheDocument();
    expect(screen.queryByText('Automation builder')).not.toBeInTheDocument();
  });
});

describe('ProjectSpaceWorkspace helpers', () => {
  it('parses the overview sub-view query with a safe fallback', () => {
    expect(readOverviewView(new URLSearchParams())).toBe('timeline');
    expect(readOverviewView(new URLSearchParams('view=calendar'))).toBe('calendar');
    expect(readOverviewView(new URLSearchParams('view=unknown'))).toBe('timeline');
  });

  it('uses project edit flags and ignores unrelated user identity for current gating', () => {
    expect(projectCanEditForUser(fixture.sharedProject, 'user-1')).toBe(true);
    expect(projectCanEditForUser(fixture.privateProject, 'user-1')).toBe(false);
    expect(projectCanEditForUser(null, 'user-1')).toBe(false);
  });

  it('collects task collection ids from table and non-standalone kanban modules only', () => {
    const collectionIds = collectProjectTaskCollectionIds(
      {
        modules: [
          { module_type: 'table', binding: { view_id: fixture.tableView.view_id } },
          { module_type: 'kanban', binding: { view_id: fixture.kanbanView.view_id } },
          { module_type: 'kanban', binding: { view_id: 'view-standalone-kanban' } },
        ],
      },
      [
        fixture.tableView,
        fixture.kanbanView,
        {
          ...fixture.kanbanView,
          view_id: 'view-standalone-kanban',
          collection_id: 'collection-standalone',
          config: {
            owned_by_module_instance_id: 'module-1',
          },
        },
      ],
    );

    expect(collectionIds).toEqual(['collection-1']);
  });

  it('reads relation target collection ids from supported config shapes', () => {
    expect(relationFieldTargetCollectionId({ target_collection_id: 'collection-a' })).toBe('collection-a');
    expect(relationFieldTargetCollectionId({ targetCollectionId: 'collection-b' })).toBe('collection-b');
    expect(relationFieldTargetCollectionId({ target: { collection_id: 'collection-c' } })).toBe('collection-c');
    expect(relationFieldTargetCollectionId({ target: { collectionId: 'collection-d' } })).toBe('collection-d');
    expect(relationFieldTargetCollectionId({})).toBeNull();
  });

  it('encodes uploaded files as base64 for inspector and doc attachments', async () => {
    const file = new File(['hello'], 'greeting.txt', { type: 'text/plain' });
    await expect(toBase64(file)).resolves.toBe('aGVsbG8=');
  });

  it('resolves inspector focus targets against the current active element and main content fallback', () => {
    const mainContent = document.createElement('main');
    mainContent.id = 'main-content';
    document.body.append(mainContent);

    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    expect(getActiveInspectorFocusTarget()).toBe(trigger);
    expect(resolveInspectorFocusTarget(trigger)).toBe(trigger);

    trigger.remove();

    expect(resolveInspectorFocusTarget(trigger)).toBe(mainContent);
    expect(mainContent.getAttribute('tabindex')).toBe('-1');
  });

  it('reads a focus rect only when the element is connected and measurable', () => {
    const button = document.createElement('button');
    document.body.append(button);

    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 20,
      top: 20,
      left: 10,
      bottom: 60,
      right: 110,
      width: 100,
      height: 40,
      toJSON: () => ({}),
    });

    expect(readElementRect(button)).toEqual({
      top: 20,
      left: 10,
      width: 100,
      height: 40,
    });

    expect(readElementRect(document.createElement('button'))).toBeNull();
  });
});

describe('ProjectSpaceProjectSettingsDialog', () => {
  afterEach(() => {
    cleanup();
  });

  it('commits renamed project names on blur and ignores unchanged values', async () => {
    const onUpdateProject = vi.fn();

    render(
      <MemoryRouter>
        <ProjectSpaceProjectSettingsDialog
          projectId="project-1"
          activeProject={fixture.sharedProject}
          activeProjectCanEdit
          activeEditableProjectIndex={0}
          orderedEditableProjects={[fixture.sharedProject, { ...fixture.privateProject, can_edit: true }]}
          projectMemberList={fixture.projectMembers}
          sessionUserId="user-1"
          modulesEnabled
          workspaceEnabled
          onRequestClose={vi.fn()}
          onTogglePinned={vi.fn(async () => undefined)}
          onMoveProject={vi.fn(async () => undefined)}
          onToggleProjectMember={vi.fn(async () => undefined)}
          onDeleteProject={vi.fn(async () => undefined)}
          onUpdateProject={onUpdateProject}
          onToggleActiveProjectRegion={vi.fn()}
        />
      </MemoryRouter>,
    );

    const projectNameInput = screen.getByLabelText('Project name');
    await userEvent.clear(projectNameInput);
    await userEvent.type(projectNameInput, 'Renamed Project');
    fireEvent.blur(projectNameInput);

    expect(onUpdateProject).toHaveBeenCalledWith('project-shared', { name: 'Renamed Project' });

    onUpdateProject.mockClear();
    await userEvent.clear(projectNameInput);
    await userEvent.type(projectNameInput, 'Shared Work');
    fireEvent.blur(projectNameInput);

    expect(onUpdateProject).not.toHaveBeenCalled();
  });

  it('renders read-only dialog state and keeps mutation controls disabled', () => {
    render(
      <MemoryRouter>
        <ProjectSpaceProjectSettingsDialog
          projectId="project-1"
          activeProject={fixture.privateProject}
          activeProjectCanEdit={false}
          activeEditableProjectIndex={1}
          orderedEditableProjects={[fixture.sharedProject, { ...fixture.privateProject, can_edit: true }]}
          projectMemberList={fixture.projectMembers}
          sessionUserId="user-1"
          modulesEnabled
          workspaceEnabled
          onRequestClose={vi.fn()}
          onTogglePinned={vi.fn(async () => undefined)}
          onMoveProject={vi.fn(async () => undefined)}
          onToggleProjectMember={vi.fn(async () => undefined)}
          onDeleteProject={vi.fn(async () => undefined)}
          onUpdateProject={vi.fn(async () => undefined)}
          onToggleActiveProjectRegion={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Project name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Unpin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hide modules' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hide workspace doc' })).toBeDisabled();
    expect(screen.getByText('Read-only project.')).toBeInTheDocument();
  });

  it('wires project member toggles and keeps the current user checkbox disabled', async () => {
    const onToggleProjectMember = vi.fn(async () => undefined);

    render(
      <MemoryRouter>
        <ProjectSpaceProjectSettingsDialog
          projectId="project-1"
          activeProject={fixture.sharedProject}
          activeProjectCanEdit
          activeEditableProjectIndex={0}
          orderedEditableProjects={[fixture.sharedProject, { ...fixture.privateProject, can_edit: true }]}
          projectMemberList={fixture.projectMembers}
          sessionUserId="user-1"
          modulesEnabled
          workspaceEnabled
          onRequestClose={vi.fn()}
          onTogglePinned={vi.fn(async () => undefined)}
          onMoveProject={vi.fn(async () => undefined)}
          onToggleProjectMember={onToggleProjectMember}
          onDeleteProject={vi.fn(async () => undefined)}
          onUpdateProject={vi.fn(async () => undefined)}
          onToggleActiveProjectRegion={vi.fn()}
        />
      </MemoryRouter>,
    );

    const ownerCheckbox = screen.getByRole('checkbox', { name: 'Owner Person' });
    const viewerCheckbox = screen.getByRole('checkbox', { name: 'Viewer Person' });

    expect(ownerCheckbox).toBeDisabled();
    expect(viewerCheckbox).toBeEnabled();

    await userEvent.click(viewerCheckbox);
    expect(onToggleProjectMember).toHaveBeenCalledWith(fixture.sharedProject, 'user-2');
  });
});

describe('ProjectSpaceWorkspaceDocSection', () => {
  afterEach(() => {
    cleanup();
  });

  it('routes the doc asset picker bridge through the local upload hook', async () => {
    const onUploadDocAsset = vi.fn<(event: React.FormEvent<HTMLFormElement>) => void>((event) => {
      event.preventDefault();
    });
    const { container } = renderWorkspaceDocSection({ onUploadDocAsset });
    const uploadButton = screen.getByRole('button', { name: 'Upload doc asset' });
    const uploadInput = container.querySelector('input[name="doc-asset-file"]') as HTMLInputElement;
    const uploadForm = container.querySelector('form') as HTMLFormElement;

    const clickSpy = vi.spyOn(uploadInput, 'click');
    const requestSubmitSpy = vi.spyOn(uploadForm, 'requestSubmit');

    await userEvent.click(uploadButton);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const file = new File(['hello'], 'brief.txt', { type: 'text/plain' });
    fireEvent.change(uploadInput, { target: { files: [file] } });
    expect(requestSubmitSpy).toHaveBeenCalledTimes(1);
    expect(onUploadDocAsset).toHaveBeenCalledTimes(1);

    fireEvent.submit(uploadForm);
    expect(onUploadDocAsset).toHaveBeenCalledTimes(2);
  });

  it('disables the doc asset upload controls while an upload is in flight', () => {
    const { container } = renderWorkspaceDocSection({ uploadingDocAsset: true });
    const uploadButton = screen.getByRole('button', { name: 'Upload doc asset' });
    const uploadInput = container.querySelector('input[name="doc-asset-file"]') as HTMLInputElement;

    expect(uploadButton).toBeDisabled();
    expect(uploadInput).toBeDisabled();
  });
});
