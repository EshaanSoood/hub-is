import type {
  ProjectRecord as SharedProjectRecord,
  SessionSummary as SharedSessionSummary,
} from '../shared/api-types';

export type ServiceId =
  | 'keycloak'
  | 'n8n'
  | 'postmark'
  | 'ntfy'
  | 'nextcloud'
  | 'openproject'
  | 'invoiceNinja'
  | 'github';

export type ServiceState = 'sleeping' | 'starting' | 'ready' | 'stopping' | 'error';

export interface ServiceRegistryItem {
  id: ServiceId;
  label: string;
  description: string;
  appUrl: string;
  healthUrl: string;
  ownerOnlyExternalUi?: boolean;
  wakeWorkflowUrl?: string;
  sleepWorkflowUrl?: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  projectId?: string;
  category: 'auth' | 'notification' | 'wake' | 'task' | 'file' | 'note' | 'lesson' | 'media' | 'dev';
  message: string;
}

export interface Project {
  id: string;
  name: string;
  status: 'active' | 'paused';
  summary: string;
  metadata: {
    owner: string;
    priority: 'high' | 'medium' | 'low';
    createdAt: string;
  };
  linkedExternalIds: {
    keycloakClientId: string;
    openProjectProjectId: string;
    invoiceClientId: string;
  };
  notes: HubNote[];
  files: HubFile[];
  automations: string[];
}

export type ProjectRecord = SharedProjectRecord;

export interface HubNote {
  id: string;
  title: string;
  updatedAt: string;
  url: string;
}

export interface HubFile {
  id: string;
  name: string;
  updatedAt: string;
  size: string;
  sharedUrl?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  assignee: string;
  dueAt: string;
  state: 'todo' | 'in_progress' | 'done';
}

export interface StudentProfile {
  id: string;
  name: string;
  instrument: string;
  parentEmail: string;
  lessonStatus: 'scheduled' | 'completed' | 'follow_up';
}

export interface PullRequestItem {
  id: string;
  title: string;
  repository: string;
  author: string;
  url: string;
  status: 'open' | 'draft';
}

export interface IntegrationOutcome<T> {
  data?: T;
  blockedReason?: string;
  error?: string;
}

export type GlobalCapability =
  | 'hub.view'
  | 'hub.tasks.write'
  | 'hub.notifications.write'
  | 'hub.live'
  | 'projects.view'
  | 'lessons.view'
  | 'media.view'
  | 'dev.view'
  | 'blockedInputs.view'
  | 'services.external.view';

export type ProjectCapability =
  | 'project.view'
  | 'project.activity.view'
  | 'project.notes.view'
  | 'project.files.view'
  | 'project.automations.view';

export type Capability = GlobalCapability | ProjectCapability;

export interface UserIdentity {
  id: string;
  displayName: string;
  email: string;
  role: 'owner' | 'admin' | 'operator' | 'viewer';
}

export interface ProjectMembership {
  id: string;
  userId: string;
  projectId: string;
  role: 'owner' | 'member';
  capabilities: ProjectCapability[];
}

export type SessionRole = 'Owner' | 'Collaborator' | 'Viewer';

export type SessionSummary = SharedSessionSummary;

export interface HubInviteRecord {
  id: string;
  email: string;
  projectId: string;
  membershipRole: ProjectMembership['role'];
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  token: string;
  createdAt: string;
  expiresAt: string;
}

export interface HubProjectNote {
  id: string;
  projectId: string;
  title: string;
  lexicalState: Record<string, unknown>;
  excerpt: string;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  latestRevisionId?: string | null;
  latestRevisionAt?: string | null;
  latestRevisionActor?: string | null;
  contentHash?: string | null;
  updatedSinceLastViewed?: boolean;
  lastViewedRevisionId?: string | null;
}

export interface HubNoteRevisionSnapshot {
  noteId: string;
  revisionId: string;
  actor: string;
  timestamp: string;
  plainText: string;
  contentHash: string;
}

export interface HubNoteCollaborationSession {
  roomId: string;
  websocketUrl: string;
  token: string;
  expiresAt: string;
}

export interface HubNoteUpdateEvent {
  noteId: string;
  projectId: string;
  actor: string;
  timestamp: string;
}

export interface HubAuditEvent {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  projectId: string | null;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface HubSnapshotRecord {
  id: string;
  projectId: string | null;
  scope: 'global' | 'project';
  storageRef: string;
  createdByUserId: string;
  createdAt: string;
  note: string | null;
}

export interface HubRecoveryJob {
  id: string;
  requestedByUserId: string;
  projectId: string | null;
  action: 'restore_snapshot' | 'revert_window';
  snapshotId: string | null;
  fromIso: string | null;
  toIso: string | null;
  status: 'queued' | 'done' | 'failed';
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
