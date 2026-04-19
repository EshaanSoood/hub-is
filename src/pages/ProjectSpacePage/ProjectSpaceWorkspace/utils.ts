import type { HubPaneSummary, HubView } from '../../../services/hub/types';
import { isStandaloneKanbanView } from '../../../hooks/projectViewsRuntime/shared';
import type { OverviewSubView } from './types';

export const readPlainComment = (bodyJson: Record<string, unknown>): string => {
  const text = bodyJson.text;
  if (typeof text === 'string') {
    return text;
  }
  const content = bodyJson.content;
  if (typeof content === 'string') {
    return content;
  }
  return JSON.stringify(bodyJson);
};

export const paneCanEditForUser = (pane: HubPaneSummary | null | undefined, userId: string): boolean => {
  // User-level pane permissions are not enforced yet; current gating is pane.can_edit.
  void userId;
  return pane?.can_edit === true;
};

export const readOverviewView = (searchParams: URLSearchParams): OverviewSubView => {
  const value = searchParams.get('view');
  if (value === 'calendar' || value === 'tasks' || value === 'kanban') {
    return value;
  }
  return 'timeline';
};

export const collectPaneTaskCollectionIds = (
  layoutConfig: Record<string, unknown> | null | undefined,
  availableViews: HubView[],
): string[] => {
  if (!layoutConfig || typeof layoutConfig !== 'object' || Array.isArray(layoutConfig)) {
    return [];
  }

  const rawModules = Array.isArray(layoutConfig.modules) ? layoutConfig.modules : [];
  const viewById = new Map(availableViews.map((view) => [view.view_id, view]));
  const defaultViewByType = new Map<string, HubView>();
  for (const view of availableViews) {
    if (view.type === 'kanban' && isStandaloneKanbanView(view)) {
      continue;
    }
    if (!defaultViewByType.has(view.type)) {
      defaultViewByType.set(view.type, view);
    }
  }

  const collectionIds: string[] = [];
  for (const candidate of rawModules) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue;
    }

    const moduleConfig = candidate as { module_type?: unknown; binding?: { view_id?: unknown } | null };
    const moduleType = typeof moduleConfig.module_type === 'string' ? moduleConfig.module_type : '';
    if (moduleType !== 'table' && moduleType !== 'kanban') {
      continue;
    }

    const requestedViewId =
      moduleConfig.binding && typeof moduleConfig.binding === 'object' && !Array.isArray(moduleConfig.binding)
        && typeof moduleConfig.binding.view_id === 'string'
        ? moduleConfig.binding.view_id
        : '';
    const resolvedView = (requestedViewId ? viewById.get(requestedViewId) : null) ?? defaultViewByType.get(moduleType) ?? null;
    if (
      !resolvedView
      || (moduleType === 'kanban' && isStandaloneKanbanView(resolvedView))
      || collectionIds.includes(resolvedView.collection_id)
    ) {
      continue;
    }
    collectionIds.push(resolvedView.collection_id);
  }

  return collectionIds;
};

export const relationFieldTargetCollectionId = (config: Record<string, unknown>): string | null => {
  const directTarget = config.target_collection_id;
  if (typeof directTarget === 'string' && directTarget.trim()) {
    return directTarget.trim();
  }
  const camelTarget = config.targetCollectionId;
  if (typeof camelTarget === 'string' && camelTarget.trim()) {
    return camelTarget.trim();
  }
  const target = config.target;
  if (target && typeof target === 'object' && !Array.isArray(target)) {
    const targetRecord = target as Record<string, unknown>;
    const nestedSnake = targetRecord.collection_id;
    if (typeof nestedSnake === 'string' && nestedSnake.trim()) {
      return nestedSnake.trim();
    }
    const nestedCamel = targetRecord.collectionId;
    if (typeof nestedCamel === 'string' && nestedCamel.trim()) {
      return nestedCamel.trim();
    }
  }
  return null;
};

export const toBase64 = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 8192;
  const chunks: string[] = [];
  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
  }
  return window.btoa(chunks.join(''));
};

export const readLayoutBool = (
  config: Record<string, unknown> | null | undefined,
  key: string,
  fallback: boolean,
): boolean => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return fallback;
  }
  const value = config[key];
  return typeof value === 'boolean' ? value : fallback;
};
