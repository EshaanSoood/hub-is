import type {
  HubAuditEvent,
  HubNoteCollaborationSession,
  HubNoteRevisionSnapshot,
  HubNoteUpdateEvent,
  HubInviteRecord,
  HubProjectNote,
  HubRecoveryJob,
  HubSnapshotRecord,
  IntegrationOutcome,
  ProjectMembership,
  ProjectRecord,
} from '../types/domain';
import type { HubEnvelope, HubProject } from './hub/types';
import { buildHubAuthHeaders } from './hubAuthHeaders';

interface NoteResponse {
  note?: HubProjectNote | null;
  error?: string;
}

interface EdgeGrantResponse {
  openUrl?: string;
  serviceId?: string;
  error?: string;
}

interface CollaborationSessionResponse {
  session?: HubNoteCollaborationSession;
  error?: string;
}

interface NoteNotifyResponse {
  event?: HubNoteUpdateEvent;
  error?: string;
}

const authHeaders = (accessToken: string): Headers => buildHubAuthHeaders(accessToken, true);

const parseResponse = async <T>(
  response: Response,
  requiredField: string,
  fallbackError: string,
): Promise<IntegrationOutcome<T>> => {
  const body = (await response.json().catch(() => ({}))) as
    | (Record<string, unknown> & { error?: string })
    | HubEnvelope<Record<string, unknown>>;

  const envelope = body as HubEnvelope<Record<string, unknown>>;
  if (typeof envelope?.ok === 'boolean') {
    if (!response.ok || !envelope.ok || !envelope.data) {
      return { error: envelope.error?.message || `${fallbackError} (${response.status})` };
    }
    const value = envelope.data[requiredField] as T | undefined;
    if (typeof value === 'undefined') {
      return { error: `${fallbackError} (${response.status})` };
    }
    return { data: value };
  }

  const legacy = body as Record<string, unknown> & { error?: string };
  const value = legacy[requiredField] as T | undefined;
  if (!response.ok || typeof value === 'undefined') {
    return { error: legacy.error || `${fallbackError} (${response.status})` };
  }

  return { data: value };
};

const toProjectRecord = (project: HubProject): ProjectRecord => ({
  id: project.project_id,
  name: project.name,
  status: 'active',
  summary: '',
  openProjectProjectId: null,
  nextcloudFolder: null,
  membershipRole:
    project.membership_role === 'owner' || project.membership_role === 'member'
      ? project.membership_role
      : 'member',
});

export const listHubProjects = async (accessToken: string): Promise<IntegrationOutcome<ProjectRecord[]>> => {
  try {
    const response = await fetch('/api/hub/projects', {
      method: 'GET',
      headers: authHeaders(accessToken),
    });
    const result = await parseResponse<HubProject[]>(response, 'projects', 'Project list request failed');
    if (result.error || !result.data) {
      return { error: result.error };
    }
    return { data: result.data.map(toProjectRecord) };
  } catch {
    return { error: 'Unable to reach project service endpoint.' };
  }
};

export const createHubProject = async (
  accessToken: string,
  payload: { id?: string; name: string; summary: string },
): Promise<IntegrationOutcome<ProjectRecord>> => {
  try {
    const requestBody: Record<string, string> = {
      name: payload.name,
    };
    if (payload.id && payload.id.trim()) {
      requestBody.project_id = payload.id.trim();
    }

    const response = await fetch('/api/hub/projects', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(requestBody),
    });
    const result = await parseResponse<HubProject>(response, 'project', 'Project create request failed');
    if (result.error || !result.data) {
      return { error: result.error };
    }
    return { data: toProjectRecord(result.data) };
  } catch {
    return { error: 'Unable to create project.' };
  }
};

export const listHubInvites = async (accessToken: string): Promise<IntegrationOutcome<HubInviteRecord[]>> => {
  try {
    const response = await fetch('/api/hub/invites', {
      method: 'GET',
      headers: authHeaders(accessToken),
    });
    return parseResponse<HubInviteRecord[]>(response, 'invites', 'Invite list request failed');
  } catch {
    return { error: 'Unable to load invites.' };
  }
};

export const createHubInvite = async (
  accessToken: string,
  payload: { email: string; projectId: string; membershipRole: ProjectMembership['role'] },
): Promise<IntegrationOutcome<HubInviteRecord>> => {
  try {
    const response = await fetch('/api/hub/invites', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    });
    return parseResponse<HubInviteRecord>(response, 'invite', 'Invite create request failed');
  } catch {
    return { error: 'Unable to create invite.' };
  }
};

export const requestOwnerEdgeGrant = async (
  accessToken: string,
  serviceId: 'nextcloud' | 'openproject',
): Promise<IntegrationOutcome<{ openUrl: string; serviceId: string }>> => {
  try {
    const response = await fetch('/api/hub/edge/grants', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ serviceId }),
    });
    const body = (await response.json().catch(() => ({}))) as EdgeGrantResponse;
    if (!response.ok || !body.openUrl) {
      return { error: body.error || `Edge grant request failed (${response.status})` };
    }

    return {
      data: {
        openUrl: body.openUrl,
        serviceId: body.serviceId || serviceId,
      },
    };
  } catch {
    return { error: 'Unable to request owner edge grant.' };
  }
};

export const listProjectNotes = async (
  accessToken: string,
  projectId: string,
  query?: string,
): Promise<IntegrationOutcome<HubProjectNote[]>> => {
  try {
    const effectiveQuery = query?.trim() || '';
    const search = effectiveQuery ? `?q=${encodeURIComponent(effectiveQuery)}` : '';
    const response = await fetch(`/api/hub/projects/${encodeURIComponent(projectId)}/notes${search}`, {
      method: 'GET',
      headers: authHeaders(accessToken),
    });
    return parseResponse<HubProjectNote[]>(response, 'notes', 'Notes list request failed');
  } catch {
    return { error: 'Unable to load notes.' };
  }
};

export const createProjectNote = async (
  accessToken: string,
  projectId: string,
  payload: { title: string; lexicalState: Record<string, unknown> },
): Promise<IntegrationOutcome<HubProjectNote>> => {
  try {
    const response = await fetch(`/api/hub/projects/${encodeURIComponent(projectId)}/notes`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    });
    return parseResponse<HubProjectNote>(response, 'note', 'Note create request failed');
  } catch {
    return { error: 'Unable to create note.' };
  }
};

export const updateProjectNote = async (
  accessToken: string,
  projectId: string,
  noteId: string,
  payload: {
    title?: string;
    lexicalState?: Record<string, unknown>;
    archived?: boolean;
    revisionId?: string;
    plainText?: string;
    contentHash?: string;
  },
): Promise<IntegrationOutcome<HubProjectNote | null>> => {
  try {
    const response = await fetch(`/api/hub/projects/${encodeURIComponent(projectId)}/notes/${encodeURIComponent(noteId)}`, {
      method: 'PATCH',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as NoteResponse;
    if (!response.ok || !('note' in body)) {
      return { error: body.error || `Note update request failed (${response.status})` };
    }

    return { data: body.note ?? null };
  } catch {
    return { error: 'Unable to update note.' };
  }
};

export const createProjectNoteSnapshot = async (
  accessToken: string,
  projectId: string,
  noteId: string,
  payload: HubNoteRevisionSnapshot & { lexicalState?: Record<string, unknown>; title?: string },
): Promise<IntegrationOutcome<HubProjectNote>> => {
  try {
    const response = await fetch(
      `/api/hub/projects/${encodeURIComponent(projectId)}/notes/${encodeURIComponent(noteId)}/snapshots`,
      {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify(payload),
      },
    );
    return parseResponse<HubProjectNote>(response, 'note', 'Note snapshot request failed');
  } catch {
    return { error: 'Unable to create note snapshot.' };
  }
};

export const createProjectNoteCollaborationSession = async (
  accessToken: string,
  projectId: string,
  noteId: string,
): Promise<IntegrationOutcome<HubNoteCollaborationSession>> => {
  try {
    const response = await fetch(
      `/api/hub/projects/${encodeURIComponent(projectId)}/notes/${encodeURIComponent(noteId)}/collab/session`,
      {
        method: 'POST',
        headers: authHeaders(accessToken),
      },
    );
    const body = (await response.json().catch(() => ({}))) as CollaborationSessionResponse;
    if (!response.ok || !body.session) {
      return { error: body.error || `Collaboration session request failed (${response.status})` };
    }

    return { data: body.session };
  } catch {
    return { error: 'Unable to create note collaboration session.' };
  }
};

export const acknowledgeProjectNoteRevision = async (
  accessToken: string,
  projectId: string,
  noteId: string,
  payload?: { revisionId?: string },
): Promise<IntegrationOutcome<HubProjectNote>> => {
  try {
    const response = await fetch(
      `/api/hub/projects/${encodeURIComponent(projectId)}/notes/${encodeURIComponent(noteId)}/views`,
      {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify(payload || {}),
      },
    );
    return parseResponse<HubProjectNote>(response, 'note', 'Acknowledge note revision request failed');
  } catch {
    return { error: 'Unable to acknowledge note revision.' };
  }
};

export const notifyProjectNoteUpdated = async (
  accessToken: string,
  projectId: string,
  noteId: string,
  payload?: { message?: string },
): Promise<IntegrationOutcome<HubNoteUpdateEvent>> => {
  try {
    const response = await fetch(
      `/api/hub/projects/${encodeURIComponent(projectId)}/notes/${encodeURIComponent(noteId)}/notify`,
      {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify(payload || {}),
      },
    );
    const body = (await response.json().catch(() => ({}))) as NoteNotifyResponse;
    if (!response.ok || !body.event) {
      return { error: body.error || `Notify event request failed (${response.status})` };
    }

    return { data: body.event };
  } catch {
    return { error: 'Unable to notify collaborators.' };
  }
};

export const listHubAuditEvents = async (
  accessToken: string,
  projectId?: string,
): Promise<IntegrationOutcome<HubAuditEvent[]>> => {
  try {
    const search = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const response = await fetch(`/api/hub/audit${search}`, {
      method: 'GET',
      headers: authHeaders(accessToken),
    });
    return parseResponse<HubAuditEvent[]>(response, 'events', 'Audit event request failed');
  } catch {
    return { error: 'Unable to load audit events.' };
  }
};

export const listHubSnapshots = async (
  accessToken: string,
  projectId?: string,
): Promise<IntegrationOutcome<HubSnapshotRecord[]>> => {
  try {
    const search = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const response = await fetch(`/api/hub/snapshots${search}`, {
      method: 'GET',
      headers: authHeaders(accessToken),
    });
    return parseResponse<HubSnapshotRecord[]>(response, 'snapshots', 'Snapshot list request failed');
  } catch {
    return { error: 'Unable to load snapshots.' };
  }
};

export const registerHubSnapshot = async (
  accessToken: string,
  payload: { scope: 'global' | 'project'; projectId?: string; storageRef: string; note?: string },
): Promise<IntegrationOutcome<HubSnapshotRecord>> => {
  try {
    const response = await fetch('/api/hub/snapshots', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    });
    return parseResponse<HubSnapshotRecord>(response, 'snapshot', 'Snapshot register request failed');
  } catch {
    return { error: 'Unable to register snapshot.' };
  }
};

export const listHubRecoveryJobs = async (accessToken: string): Promise<IntegrationOutcome<HubRecoveryJob[]>> => {
  try {
    const response = await fetch('/api/hub/recovery/jobs', {
      method: 'GET',
      headers: authHeaders(accessToken),
    });
    return parseResponse<HubRecoveryJob[]>(response, 'jobs', 'Recovery job list failed');
  } catch {
    return { error: 'Unable to load recovery jobs.' };
  }
};

export const requestSnapshotRestore = async (
  accessToken: string,
  payload: { snapshotId: string; projectId?: string; reason?: string },
): Promise<IntegrationOutcome<HubRecoveryJob>> => {
  try {
    const response = await fetch('/api/hub/recovery/restore-snapshot', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    });
    return parseResponse<HubRecoveryJob>(response, 'job', 'Snapshot restore request failed');
  } catch {
    return { error: 'Unable to request snapshot restore.' };
  }
};

export const requestRevertWindow = async (
  accessToken: string,
  payload: { projectId?: string; fromIso: string; toIso: string; reason?: string },
): Promise<IntegrationOutcome<HubRecoveryJob>> => {
  try {
    const response = await fetch('/api/hub/recovery/revert-window', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    });
    return parseResponse<HubRecoveryJob>(response, 'job', 'Revert window request failed');
  } catch {
    return { error: 'Unable to request revert window.' };
  }
};
