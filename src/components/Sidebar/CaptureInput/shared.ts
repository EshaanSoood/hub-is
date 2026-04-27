import { listCollections } from '../../../services/hub/collections';
import type { HubProjectSummary } from '../../../services/hub/types';
import type { ProjectRecord } from '../../../types/domain';
import type { SidebarSurfaceId } from '../Surfaces';

export type CaptureKind = 'thought' | 'task' | 'event' | 'reminder';
export type DestinationKind = 'hub' | 'project';
export type SidebarCaptureSurface = SidebarSurfaceId | null;

export interface CaptureDestination {
  kind: DestinationKind;
  label: string;
  project?: HubProjectSummary | null;
  space?: ProjectRecord | null;
}

export const widgetTypesByCaptureKind: Record<Exclude<CaptureKind, 'thought'>, string> = {
  task: 'tasks',
  event: 'calendar',
  reminder: 'reminders',
};

export const labelForCaptureKind: Record<CaptureKind, string> = {
  thought: 'Quick Thought',
  task: 'Task',
  event: 'Calendar Event',
  reminder: 'Reminder',
};

export const captureKindBySidebarSurface: Record<Exclude<SidebarCaptureSurface, null>, CaptureKind> = {
  thoughts: 'thought',
};

export const readProjectHasWidgetType = (project: HubProjectSummary, widgetType: string): boolean => {
  const widgets = Array.isArray(project.layout_config?.widgets) ? project.layout_config.widgets : [];
  return widgets.some((entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && entry.widget_type === widgetType);
};

export const readQuickThoughtStorageKey = (project: HubProjectSummary): string | null => {
  return `hub:quick-thoughts:${project.space_id}:${project.project_id}`;
};

export const selectCollectionId = async (
  accessToken: string,
  projectId: string,
  keywords: string[],
): Promise<string | null> => {
  const collections = await listCollections(accessToken, projectId);
  if (collections.length === 0) {
    return null;
  }
  const preferred = collections.find((collection) => {
    const haystack = `${collection.name} ${collection.collection_id}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
  return preferred?.collection_id || collections[0]?.collection_id || null;
};

export const createQuickThoughtEntry = (storageKey: string, text: string) => {
  const now = new Date().toLocaleString();
  const nextEntry = {
    id: `quick-thought-${Date.now()}`,
    text,
    createdAt: now,
    updatedAt: null,
    archived: false,
  };
  const currentEntries = (() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  window.localStorage.setItem(storageKey, JSON.stringify([nextEntry, ...currentEntries]));
};
