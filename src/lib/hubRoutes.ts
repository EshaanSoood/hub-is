import type { HubHomeEvent, HubSourceProjectContext, HubTaskSummary } from '../services/hub/types';

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const encodePathSegment = (value: string): string => encodeURIComponent(value);

const rebuildProjectFallbackHref = (fallbackHref: string, projectId: string): string => {
  const match = fallbackHref.match(/^\/projects\/[^/]+(\/.*)?$/);
  if (!match) {
    return fallbackHref;
  }
  return `/projects/${encodePathSegment(projectId)}${match[1] || ''}`;
};

const projectContextFromPayload = (payload: Record<string, unknown> | null | undefined): HubSourceProjectContext | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const projectId = asText(payload.source_project_id);
  if (!projectId) {
    return null;
  }
  return {
    project_id: projectId,
    project_name: asText(payload.source_project_name) || null,
    doc_id: asText(payload.source_doc_id) || null,
  };
};

export const sourceNodeKeyFromPayload = (payload: Record<string, unknown> | null | undefined): string | null => {
  const nodeKey = asText(payload?.source_node_key);
  return nodeKey || null;
};

export const buildProjectContextHref = ({
  projectId,
  sourceProject,
  fallbackHref,
  focusNodeKey,
}: {
  projectId: string;
  sourceProject: HubSourceProjectContext | null | undefined;
  fallbackHref: string;
  focusNodeKey?: string | null;
}): string => {
  if (!sourceProject?.project_id) {
    return fallbackHref;
  }

  const params = new URLSearchParams();
  if (focusNodeKey) {
    params.set('focus_node_key', focusNodeKey);
  }
  const query = params.toString();
  return `/projects/${encodePathSegment(projectId)}/work/${encodePathSegment(sourceProject.project_id)}${query ? `?${query}` : ''}`;
};

export const buildProjectOverviewHref = (projectId: string): string =>
  `/projects/${encodePathSegment(projectId)}/overview`;

export const buildProjectWorkHref = (projectId: string, workProjectId?: string | null): string => {
  const baseHref = `/projects/${encodePathSegment(projectId)}/work`;
  const resolvedProjectId = asText(workProjectId);
  if (!resolvedProjectId) {
    return baseHref;
  }
  return `${baseHref}/${encodePathSegment(resolvedProjectId)}`;
};

const buildPersonalTaskHref = (recordId: string): string =>
  `/projects?intent=open&task_id=${encodePathSegment(recordId)}`;

export const buildTaskDestinationHref = (task: HubTaskSummary): string =>
  task.origin_kind === 'personal'
    ? buildPersonalTaskHref(task.record_id)
    : task.space_id
      ? buildProjectContextHref({
          projectId: task.space_id,
          sourceProject: task.source_project,
          fallbackHref: `/projects/${encodePathSegment(task.space_id)}/work`,
        })
      : '/projects';

export const buildEventDestinationHref = (event: HubHomeEvent): string => {
  const projectId = asText(event.space_id);
  if (!projectId) {
    return '/projects';
  }
  return buildProjectContextHref({
    projectId,
    sourceProject: event.source_project,
    fallbackHref: `/projects/${encodePathSegment(projectId)}/overview?view=calendar`,
  });
};

export const buildNotificationDestinationHref = ({
  projectId,
  entityType,
  entityId,
  payload,
  fallbackHref,
}: {
  projectId: string;
  entityType?: string | null;
  entityId?: string | null;
  payload: Record<string, unknown> | null | undefined;
  fallbackHref: string;
}): string => {
  if (asText(payload?.origin_kind) === 'personal' && entityType === 'record' && entityId) {
    return buildPersonalTaskHref(entityId);
  }
  if (!projectId) {
    return fallbackHref;
  }
  const destinationFallbackHref = rebuildProjectFallbackHref(fallbackHref, projectId);
  return buildProjectContextHref({
    projectId,
    sourceProject: projectContextFromPayload(payload),
    fallbackHref: destinationFallbackHref,
    focusNodeKey: sourceNodeKeyFromPayload(payload),
  });
};
