import type { HubProjectSummary, HubView } from '../../../services/hub/types';
import { isStandaloneKanbanView } from '../../../hooks/projectViewsRuntime/shared';

export const projectCanEditForUser = (project: HubProjectSummary | null | undefined, userId: string): boolean => {
  // User-level project permissions are not enforced yet; current gating is project.can_edit.
  void userId;
  return project?.can_edit === true;
};

export const collectProjectTaskCollectionIds = (
  layoutConfig: Record<string, unknown> | null | undefined,
  availableViews: HubView[],
): string[] => {
  if (!layoutConfig || typeof layoutConfig !== 'object' || Array.isArray(layoutConfig)) {
    return [];
  }

  const rawWidgets = Array.isArray(layoutConfig.widgets) ? layoutConfig.widgets : [];
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
  for (const candidate of rawWidgets) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue;
    }

    const widgetConfig = candidate as { widget_type?: unknown; binding?: { view_id?: unknown } | null };
    const widgetType = typeof widgetConfig.widget_type === 'string' ? widgetConfig.widget_type : '';
    if (widgetType !== 'table' && widgetType !== 'kanban') {
      continue;
    }

    const requestedViewId =
      widgetConfig.binding && typeof widgetConfig.binding === 'object' && !Array.isArray(widgetConfig.binding)
        && typeof widgetConfig.binding.view_id === 'string'
        ? widgetConfig.binding.view_id
        : '';
    const resolvedView = (requestedViewId ? viewById.get(requestedViewId) : null) ?? defaultViewByType.get(widgetType) ?? null;
    if (
      !resolvedView
      || resolvedView.type !== widgetType
      || (widgetType === 'kanban' && isStandaloneKanbanView(resolvedView))
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
