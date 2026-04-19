import React, { createContext, type PropsWithChildren, type ReactElement, useContext, useEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HubPaneSummary, HubProject } from '../../../services/hub/types';
import type { HubRecordDetail } from '../../../shared/api-types/records';
import { ProjectSpaceInspectorOverlay, type ProjectSpaceInspectorOverlayProps } from './ProjectSpaceInspectorOverlay';

const motionFactory = (tag: keyof HTMLElementTagNameMap) =>
  ({ children, ...props }: PropsWithChildren<Record<string, unknown>>): ReactElement =>
    React.createElement(tag, props, children);

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, key) => motionFactory((typeof key === 'string' ? key : 'div') as keyof HTMLElementTagNameMap),
    },
  ),
}));

type DialogContextValue = {
  open: boolean;
  onOpenChange?: (nextOpen: boolean) => void;
};

const DialogContext = createContext<DialogContextValue>({ open: false });

vi.mock('../../../components/project-space/ProjectSpaceDialogPrimitives', () => ({
  Dialog: ({ open, onOpenChange, children }: PropsWithChildren<{ open: boolean; onOpenChange?: (nextOpen: boolean) => void }>) => (
    <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
  ),
  DialogContent: ({
    open,
    children,
    onCloseAutoFocus,
  }: PropsWithChildren<{
    open: boolean;
    onCloseAutoFocus?: (event: { preventDefault: () => void }) => void;
  }>) => {
    const wasOpenRef = useRef(open);

    useEffect(() => {
      if (wasOpenRef.current && !open) {
        onCloseAutoFocus?.({ preventDefault: () => undefined });
      }
      wasOpenRef.current = open;
    }, [onCloseAutoFocus, open]);

    return open ? <div data-testid="dialog-content">{children}</div> : null;
  },
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

vi.mock('../../../components/primitives', () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true">{name}</span>,
  InlineNotice: ({ title, children }: PropsWithChildren<{ title?: string }>) => (
    <div role="alert">
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('../../../components/project-space/MentionPicker', () => ({
  MentionPicker: ({ buttonLabel, onSelect }: { buttonLabel: string; onSelect?: (value: unknown) => void }) => (
    <button type="button" onClick={() => onSelect?.({ entity_type: 'user', entity_id: 'user-2' })}>
      {buttonLabel}
    </button>
  ),
}));

vi.mock('../../../components/project-space/RelationsSection', () => ({
  RelationsSection: ({
    outgoing,
    incoming,
    mutationError,
    readOnly,
  }: {
    outgoing?: unknown[];
    incoming?: unknown[];
    mutationError?: string | null;
    readOnly?: boolean;
  }) => (
    <div>
      <span data-testid="relations-count">{(outgoing?.length ?? 0) + (incoming?.length ?? 0)}</span>
      <span data-testid="relations-read-only">{readOnly ? 'read-only' : 'editable'}</span>
      {mutationError ? <span>{mutationError}</span> : null}
    </div>
  ),
}));

vi.mock('../../../components/project-space/FileInspectorActionBar', () => ({
  FileInspectorActionBar: ({
    fileName,
    onRename,
    onMove,
    onRemove,
    readOnly,
  }: {
    fileName: string;
    onRename?: (nextName: string) => void;
    onMove?: (paneId: string) => void;
    onRemove?: () => void;
    readOnly?: boolean;
  }) => (
    <div>
      <span>File action bar {fileName}</span>
      <span data-testid="attachment-read-only">{readOnly ? 'read-only' : 'editable'}</span>
      <button type="button" onClick={() => onRename?.('renamed-attachment.txt')}>Rename attachment</button>
      <button type="button" onClick={() => onMove?.('pane-private')}>Move attachment</button>
      <button type="button" onClick={() => onRemove?.()}>Remove attachment</button>
    </div>
  ),
}));

vi.mock('../../../components/project-space/BacklinksPanel', () => ({
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

const project: HubProject = {
  project_id: 'project-1',
  name: 'Project Atlas',
  created_by: 'user-1',
  created_at: '2026-04-19T00:00:00.000Z',
  updated_at: '2026-04-19T00:00:00.000Z',
  position: 1,
  is_personal: false,
  membership_role: 'owner',
};

const panes: HubPaneSummary[] = [
  {
    pane_id: 'pane-shared',
    project_id: 'project-1',
    name: 'Shared Work',
    sort_order: 1,
    position: 1,
    pinned: false,
    layout_config: {},
    doc_id: 'doc-shared',
    members: [{ user_id: 'user-1', display_name: 'Owner Person' }],
    can_edit: true,
  },
  {
    pane_id: 'pane-private',
    project_id: 'project-1',
    name: 'Private Work',
    sort_order: 2,
    position: 2,
    pinned: true,
    layout_config: {},
    doc_id: 'doc-private',
    members: [{ user_id: 'user-1', display_name: 'Owner Person' }],
    can_edit: false,
  },
];

const createRecord = (overrides: Partial<HubRecordDetail> = {}): HubRecordDetail => ({
  record_id: 'record-1',
  project_id: 'project-1',
  collection_id: 'collection-1',
  title: 'Audit task',
  origin_kind: 'pane',
  source_view_id: 'view-1',
  source_pane: {
    pane_id: 'pane-shared',
    pane_name: 'Shared Work',
    doc_id: 'doc-shared',
  },
  schema: {
    collection_id: 'collection-1',
    name: 'Tasks',
    fields: [{ field_id: 'field-title', name: 'Title', type: 'text', config: {}, sort_order: 1 }],
  },
  values: {
    'field-title': 'Audit task',
  },
  capabilities: {
    capability_types: ['task'],
    task_state: {
      status: 'todo',
      priority: 'medium',
      completed_at: null,
      updated_at: '2026-04-19T00:00:00.000Z',
    },
    event_state: null,
    recurrence_rule: null,
    reminders: [],
    participants: [],
    assignments: [],
  },
  relations: {
    outgoing: [],
    incoming: [],
  },
  attachments: [],
  comments: [],
  activity: [],
  created_at: '2026-04-19T00:00:00.000Z',
  updated_at: '2026-04-19T00:00:00.000Z',
  archived_at: null,
  ...overrides,
});

const createProps = (overrides: Partial<ProjectSpaceInspectorOverlayProps> = {}): ProjectSpaceInspectorOverlayProps => {
  const record = overrides.inspectorRecord ?? createRecord();

  return {
    accessToken: 'token',
    project,
    panes,
    inspectorTriggerRect: null,
    inspectorTriggerRef: { current: null },
    prefersReducedMotion: false,
    inspectorLoading: false,
    inspectorError: null,
    inspectorRecord: record,
    inspectorRecordId: record?.record_id ?? null,
    inspectorMutationPane: panes[0],
    inspectorMutationPaneCanEdit: true,
    inspectorRelationFields: [],
    inspectorBacklinks: [],
    inspectorBacklinksLoading: false,
    inspectorBacklinksError: null,
    inspectorCommentText: '',
    relationMutationError: null,
    removingRelationId: null,
    savingValues: false,
    selectedAttachmentId: null,
    uploadingAttachment: false,
    setSelectedAttachmentId: vi.fn(),
    setInspectorCommentText: vi.fn(),
    closeInspectorWithFocusRestore: vi.fn(),
    navigate: vi.fn(),
    onSaveRecordField: vi.fn(async () => undefined),
    onRenameInspectorAttachment: vi.fn(async () => undefined),
    onMoveInspectorAttachment: vi.fn(async () => undefined),
    onDetachInspectorAttachment: vi.fn(async () => undefined),
    onAttachFile: vi.fn(async (event) => event.preventDefault()),
    onAddRelation: vi.fn(),
    onRemoveRelation: vi.fn(async () => undefined),
    onInsertRecordCommentMention: vi.fn(),
    onAddRecordComment: vi.fn(async (event) => event.preventDefault()),
    onOpenBacklink: vi.fn(),
    ...overrides,
  };
};

describe('ProjectSpaceInspectorOverlay', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each([
    {
      label: 'event',
      record: createRecord({
        title: 'Design review',
        collection_id: 'collection-events',
        schema: {
          collection_id: 'collection-events',
          name: 'Events',
          fields: [
            { field_id: 'field-start', name: 'Start', type: 'datetime', config: {}, sort_order: 1 },
            { field_id: 'field-end', name: 'End', type: 'datetime', config: {}, sort_order: 2 },
            { field_id: 'field-location', name: 'Location', type: 'text', config: {}, sort_order: 3 },
          ],
        },
        values: {
          'field-start': '2026-04-21T14:00:00.000Z',
          'field-end': '2026-04-21T15:00:00.000Z',
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
      expected: ['Event', 'Design review', 'Collection: Events', 'Start', 'End', 'Location'],
    },
    {
      label: 'task',
      record: createRecord({
        title: 'Ship inspector refactor',
        schema: {
          collection_id: 'collection-1',
          name: 'Tasks',
          fields: [
            { field_id: 'field-title', name: 'Title', type: 'text', config: {}, sort_order: 1 },
            { field_id: 'field-priority', name: 'Priority', type: 'select', config: {}, sort_order: 2 },
            { field_id: 'field-due', name: 'Due date', type: 'datetime', config: {}, sort_order: 3 },
          ],
        },
        values: {
          'field-title': 'Ship inspector refactor',
          'field-priority': 'high',
          'field-due': '2026-04-22T12:00:00.000Z',
        },
      }),
      expected: ['Task', 'Ship inspector refactor', 'Collection: Tasks', 'Priority', 'Due date'],
    },
    {
      label: 'file',
      record: createRecord({
        title: 'Quarterly Plan.pdf',
        collection_id: 'collection-files',
        schema: {
          collection_id: 'collection-files',
          name: 'Files',
          fields: [
            { field_id: 'field-name', name: 'Filename', type: 'text', config: {}, sort_order: 1 },
            { field_id: 'field-type', name: 'File type', type: 'text', config: {}, sort_order: 2 },
            { field_id: 'field-size', name: 'Size', type: 'text', config: {}, sort_order: 3 },
          ],
        },
        values: {
          'field-name': 'Quarterly Plan.pdf',
          'field-type': 'application/pdf',
          'field-size': '2.4 MB',
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
      expected: ['File', 'Quarterly Plan.pdf', 'Collection: Files', 'Filename', 'File type', 'Size'],
    },
    {
      label: 'reminder',
      record: createRecord({
        title: 'Renew domain',
        collection_id: 'collection-reminders',
        schema: {
          collection_id: 'collection-reminders',
          name: 'Reminders',
          fields: [
            { field_id: 'field-when', name: 'Remind at', type: 'datetime', config: {}, sort_order: 1 },
            { field_id: 'field-repeat', name: 'Repeat', type: 'text', config: {}, sort_order: 2 },
          ],
        },
        values: {
          'field-when': '2026-04-23T09:00:00.000Z',
          'field-repeat': 'Weekly',
        },
        capabilities: {
          capability_types: [],
          task_state: null,
          event_state: null,
          recurrence_rule: { frequency: 'weekly', interval: 1 },
          reminders: [{ reminder_id: 'reminder-1', remind_at: '2026-04-23T09:00:00.000Z', channels: ['in_app'], created_at: '2026-04-19T00:00:00.000Z', fired_at: null }],
          participants: [],
          assignments: [],
        },
      }),
      expected: ['Reminder', 'Renew domain', 'Collection: Reminders', 'Remind at', 'Repeat'],
    },
  ])('renders $label-specific record content', ({ record, expected }) => {
    render(<ProjectSpaceInspectorOverlay {...createProps({ inspectorRecord: record, inspectorRecordId: record.record_id })} />);

    for (const text of expected) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('renders a generic fallback record when no typed cues are available', () => {
    const record = createRecord({
      title: 'Knowledge base entry',
      collection_id: 'collection-generic',
      source_pane: null,
      schema: {
        collection_id: 'collection-generic',
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
    });

    render(<ProjectSpaceInspectorOverlay {...createProps({ inspectorRecord: record, inspectorRecordId: record.record_id })} />);

    expect(screen.getByText('Knowledge base entry')).toBeInTheDocument();
    expect(screen.getByText('Record')).toBeInTheDocument();
    expect(screen.getByText('Collection: Reference')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Link')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open source pane' })).not.toBeInTheDocument();
  });

  it('preserves shared attachments, relations, comments, backlinks, and activity behavior', async () => {
    const onRenameInspectorAttachment = vi.fn(async () => undefined);
    const onMoveInspectorAttachment = vi.fn(async () => undefined);
    const onDetachInspectorAttachment = vi.fn(async () => undefined);
    const onAttachFile = vi.fn(async (event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const onInsertRecordCommentMention = vi.fn();
    const onAddRecordComment = vi.fn(async (event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const onOpenBacklink = vi.fn();
    const setSelectedAttachmentId = vi.fn();

    const record = createRecord({
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
        outgoing: [{ relation_id: 'relation-1', to_record_id: 'record-2', via_field_id: 'field-related' }],
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
    });

    render(
      <ProjectSpaceInspectorOverlay
        {...createProps({
          inspectorRecord: record,
          inspectorRecordId: record.record_id,
          selectedAttachmentId: 'attachment-1',
          inspectorCommentText: 'Need follow-up',
          inspectorBacklinks: [
            {
              mention_id: 'mention-1',
              created_at: '2026-04-19T00:00:00.000Z',
              source_entity_type: 'doc',
              source_entity_id: 'doc-1',
              target_entity_type: 'record',
              target_entity_id: record.record_id,
              context: null,
              source: {
                doc_id: 'doc-1',
                pane_id: 'pane-private',
                pane_name: 'Private Work',
                node_key: 'node-1',
                comment_target_entity_type: null,
                comment_target_entity_id: null,
                comment_author_user_id: null,
              },
            },
          ],
          relationMutationError: 'Relation mutation failed',
          onRenameInspectorAttachment,
          onMoveInspectorAttachment,
          onDetachInspectorAttachment,
          onAttachFile,
          onInsertRecordCommentMention,
          onAddRecordComment,
          onOpenBacklink,
          setSelectedAttachmentId,
        })}
      />,
    );

    expect(screen.getByText('File action bar brief.txt')).toBeInTheDocument();
    expect(screen.getByText('Inspector comment body')).toBeInTheDocument();
    expect(screen.getByTestId('relations-count')).toHaveTextContent('1');
    expect(screen.getByText('Relation mutation failed')).toBeInTheDocument();
    expect(screen.getByText(/record\.updated/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Rename attachment' }));
    expect(onRenameInspectorAttachment).toHaveBeenCalledWith('attachment-1', 'renamed-attachment.txt');

    await userEvent.click(screen.getByRole('button', { name: 'Move attachment' }));
    expect(onMoveInspectorAttachment).toHaveBeenCalledWith('attachment-1', 'pane-private');

    await userEvent.click(screen.getByRole('button', { name: 'Remove attachment' }));
    expect(onDetachInspectorAttachment).toHaveBeenCalledWith('attachment-1');

    await userEvent.click(screen.getByRole('button', { name: 'Attach' }));
    expect(onAttachFile).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: '@ Mention' }));
    expect(onInsertRecordCommentMention).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(onAddRecordComment).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Open backlink doc' }));
    expect(onOpenBacklink).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'brief.txt' }));
    expect(setSelectedAttachmentId).toHaveBeenCalledWith('attachment-1');
  });

  it('applies permission gating to fields, relations, and attachments', () => {
    const record = createRecord({
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
    });

    render(
      <ProjectSpaceInspectorOverlay
        {...createProps({
          inspectorRecord: record,
          inspectorRecordId: record.record_id,
          inspectorMutationPane: panes[1],
          inspectorMutationPaneCanEdit: false,
          selectedAttachmentId: 'attachment-1',
        })}
      />,
    );

    expect(screen.getByText('Opened in read-only pane Private Work. You can review this task and add comments, but only pane editors can change fields, attachments, or relations.')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeDisabled();
    expect(screen.getByText('Attachments are read-only in this pane.')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-read-only')).toHaveTextContent('read-only');
    expect(screen.getByTestId('relations-read-only')).toHaveTextContent('read-only');
    expect(screen.queryByRole('button', { name: 'Attach' })).not.toBeInTheDocument();
  });

  it('closes the inspector and navigates to the source pane context', async () => {
    const closeInspectorWithFocusRestore = vi.fn();
    const navigate = vi.fn();

    render(
      <ProjectSpaceInspectorOverlay
        {...createProps({
          closeInspectorWithFocusRestore,
          navigate,
        })}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open source pane' }));

    expect(closeInspectorWithFocusRestore).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(
      '/projects/project-1/work/pane-shared',
      expect.objectContaining({
        state: expect.any(Object),
      }),
    );
  });

  it('restores focus to the invoking control when the inspector closes', async () => {
    const user = userEvent.setup();

    const FocusHarness = () => {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLElement | null>(null);
      const record = createRecord();
      const baseProps = createProps();

      return (
        <>
          <button
            type="button"
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setOpen(true);
            }}
          >
            Open inspector
          </button>
          <ProjectSpaceInspectorOverlay
            {...baseProps}
            inspectorTriggerRef={triggerRef}
            inspectorRecord={open ? record : null}
            inspectorRecordId={open ? record.record_id : null}
            closeInspectorWithFocusRestore={() => setOpen(false)}
          />
        </>
      );
    };

    render(<FocusHarness />);

    const trigger = screen.getByRole('button', { name: 'Open inspector' });
    await user.click(trigger);
    expect(screen.getByRole('heading', { name: 'Record Inspector' })).toBeInTheDocument();

    await user.click(screen.getByLabelText('Close inspector'));

    await waitFor(() => {
      expect(screen.queryByTestId('dialog-content')).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});
