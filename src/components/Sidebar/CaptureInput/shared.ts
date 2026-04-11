import { listCollections } from '../../../services/hub/collections';
import type { HubPaneSummary } from '../../../services/hub/types';
import type { ProjectRecord } from '../../../types/domain';
import type { SidebarSurfaceId } from '../Surfaces';

export type CaptureKind = 'thought' | 'task' | 'event' | 'reminder';
export type DestinationKind = 'hub' | 'pane';
export type SidebarCaptureSurface = SidebarSurfaceId | null;

export interface CaptureDestination {
  kind: DestinationKind;
  label: string;
  pane?: HubPaneSummary | null;
  project?: ProjectRecord | null;
}

export const moduleTypesByCaptureKind: Record<CaptureKind, string> = {
  thought: 'quick_thoughts',
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
  tasks: 'task',
  calendar: 'event',
  reminders: 'reminder',
  thoughts: 'thought',
};

export const readPaneHasModuleType = (pane: HubPaneSummary, moduleType: string): boolean => {
  const modules = Array.isArray(pane.layout_config?.modules) ? pane.layout_config.modules : [];
  return modules.some((entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && entry.module_type === moduleType);
};

export const readQuickThoughtStorageKey = (pane: HubPaneSummary): string | null => {
  const modules = Array.isArray(pane.layout_config?.modules) ? pane.layout_config.modules : [];
  const matchingModule = modules.find(
    (entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && entry.module_type === 'quick_thoughts',
  ) as { module_instance_id?: unknown } | undefined;
  if (!matchingModule || typeof matchingModule.module_instance_id !== 'string' || !matchingModule.module_instance_id.trim()) {
    return null;
  }
  return `hub:quick-thoughts:${pane.project_id}:${pane.pane_id}:${matchingModule.module_instance_id}`;
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
