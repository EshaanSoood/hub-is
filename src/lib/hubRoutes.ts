import type { HubHomeEvent, HubSourcePaneContext, HubTaskSummary } from '../services/hub/types';

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const encodePathSegment = (value: string): string => encodeURIComponent(value);

const rebuildProjectFallbackHref = (fallbackHref: string, projectId: string): string => {
  const match = fallbackHref.match(/^\/projects\/[^/]+(\/.*)?$/);
  if (!match) {
    return fallbackHref;
  }
  return `/projects/${encodePathSegment(projectId)}${match[1] || ''}`;
};

const paneContextFromPayload = (payload: Record<string, unknown> | null | undefined): HubSourcePaneContext | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const paneId = asText(payload.source_pane_id);
  if (!paneId) {
    return null;
  }
  return {
    pane_id: paneId,
    pane_name: asText(payload.source_pane_name) || null,
    doc_id: asText(payload.source_doc_id) || null,
  };
};

export const sourceNodeKeyFromPayload = (payload: Record<string, unknown> | null | undefined): string | null => {
  const nodeKey = asText(payload?.source_node_key);
  return nodeKey || null;
};

export const buildPaneContextHref = ({
  projectId,
  sourcePane,
  fallbackHref,
  focusNodeKey,
}: {
  projectId: string;
  sourcePane: HubSourcePaneContext | null | undefined;
  fallbackHref: string;
  focusNodeKey?: string | null;
}): string => {
  if (!sourcePane?.pane_id) {
    return fallbackHref;
  }

  const params = new URLSearchParams();
  if (focusNodeKey) {
    params.set('focus_node_key', focusNodeKey);
  }
  const query = params.toString();
  return `/projects/${encodePathSegment(projectId)}/work/${encodePathSegment(sourcePane.pane_id)}${query ? `?${query}` : ''}`;
};

export const buildProjectOverviewHref = (projectId: string): string =>
  `/projects/${encodePathSegment(projectId)}/overview`;

export const buildProjectToolsHref = (projectId: string): string =>
  `/projects/${encodePathSegment(projectId)}/tools`;

export const buildProjectWorkHref = (projectId: string, paneId?: string | null): string => {
  const baseHref = `/projects/${encodePathSegment(projectId)}/work`;
  const resolvedPaneId = asText(paneId);
  if (!resolvedPaneId) {
    return baseHref;
  }
  return `${baseHref}/${encodePathSegment(resolvedPaneId)}`;
};

const buildPersonalTaskHref = (recordId: string): string =>
  `/projects?intent=open&task_id=${encodePathSegment(recordId)}`;

export const buildTaskDestinationHref = (task: HubTaskSummary): string =>
  task.origin_kind === 'personal'
    ? buildPersonalTaskHref(task.record_id)
    : task.project_id
      ? buildPaneContextHref({
          projectId: task.project_id,
          sourcePane: task.source_pane,
          fallbackHref: `/projects/${encodePathSegment(task.project_id)}/work`,
        })
      : '/projects';

export const buildEventDestinationHref = (event: HubHomeEvent): string => {
  const projectId = asText(event.project_id);
  if (!projectId) {
    return '/projects';
  }
  return buildPaneContextHref({
    projectId,
    sourcePane: event.source_pane,
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
  const destinationProjectId = asText(payload?.source_project_id) || projectId;
  if (!destinationProjectId) {
    return fallbackHref;
  }
  const destinationFallbackHref = rebuildProjectFallbackHref(fallbackHref, destinationProjectId);
  return buildPaneContextHref({
    projectId: destinationProjectId,
    sourcePane: paneContextFromPayload(payload),
    fallbackHref: destinationFallbackHref,
    focusNodeKey: sourceNodeKeyFromPayload(payload),
  });
};
