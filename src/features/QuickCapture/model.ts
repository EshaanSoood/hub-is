import type { HubCollection, HubHomeCapture } from '../../services/hub/types';
import type { CaptureMode, CaptureSortDirection } from './types';

export const LAST_PROJECT_KEY = 'hub:last-opened-project-id';
export const PENDING_CAPTURE_DRAFT_KEY = 'hub:pending-project-capture';
export const PERSONAL_CAPTURE_TARGET = '__personal__';

export const safeGetLastProjectId = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return window.localStorage.getItem(LAST_PROJECT_KEY) || '';
  } catch {
    return '';
  }
};

export const captureModeFromIntent = (intent: string | null): CaptureMode => {
  if (intent === 'event') {
    return 'calendar';
  }
  if (intent === 'project-task') {
    return 'task';
  }
  if (intent === 'reminder') {
    return 'reminder';
  }
  return 'thought';
};

export const selectPersonalCaptureCollection = (collections: HubCollection[]): HubCollection | null => {
  if (collections.length === 0) {
    return null;
  }

  const preferred = collections.find((collection) => {
    const name = collection.name.toLowerCase();
    return ['inbox', 'capture', 'note', 'journal'].some((keyword) => name.includes(keyword));
  });

  return preferred || collections[0] || null;
};

export const selectProjectCaptureCollection = (collections: HubCollection[], mode: CaptureMode): HubCollection | null => {
  if (collections.length === 0) {
    return null;
  }

  if (mode === 'thought') {
    return selectPersonalCaptureCollection(collections);
  }

  const rankedCollectionIds = new Set<string>();
  const rankByKeywords = (keywords: string[]) => {
    for (const collection of collections) {
      const haystack = `${collection.name} ${collection.collection_id}`.toLowerCase();
      if (keywords.some((keyword) => haystack.includes(keyword))) {
        rankedCollectionIds.add(collection.collection_id);
      }
    }
  };

  if (mode === 'task') {
    rankByKeywords(['task', 'todo']);
  } else if (mode === 'reminder') {
    rankByKeywords(['reminder']);
  } else if (mode === 'calendar') {
    rankByKeywords(['event', 'calendar']);
  }

  if (rankedCollectionIds.size > 0) {
    const selected = collections.find((collection) => rankedCollectionIds.has(collection.collection_id));
    if (selected) {
      return selected;
    }
  }

  return collections[0] || null;
};

export const parseIso = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const formatRelativeDateTime = (value: string | null): string => {
  const parsed = parseIso(value);
  if (!parsed) {
    return 'No date';
  }
  const now = new Date();
  const dayDelta = Math.round((startOfDay(parsed).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (dayDelta === 0) {
    return `Today ${parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (dayDelta === 1) {
    return `Tomorrow ${parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (dayDelta > 1 && dayDelta < 7) {
    return parsed.toLocaleDateString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  }
  if (dayDelta < 0) {
    return `Overdue ${parsed.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  }
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const truncateCaptureTitle = (title: string): string => {
  const normalized = title.trim();
  if (normalized.length <= 250) {
    return normalized;
  }
  return `${normalized.slice(0, 247)}...`;
};

export const sortCaptures = (
  captures: HubHomeCapture[],
  direction: CaptureSortDirection,
): HubHomeCapture[] => {
  const sortDirection = direction === 'asc' ? 1 : -1;
  return [...captures].sort((left, right) => {
    const leftTime = parseIso(left.created_at)?.getTime() ?? 0;
    const rightTime = parseIso(right.created_at)?.getTime() ?? 0;
    if (leftTime === rightTime) {
      return left.record_id.localeCompare(right.record_id) * sortDirection;
    }
    return (leftTime - rightTime) * sortDirection;
  });
};

export const resolveTargetProjectForMode = (
  nextMode: CaptureMode,
  currentProjectId: string,
  defaultProjectCaptureTarget: string,
): string => {
  if (nextMode === 'thought') {
    return PERSONAL_CAPTURE_TARGET;
  }

  if (
    currentProjectId === PERSONAL_CAPTURE_TARGET
    && (nextMode === 'reminder' || nextMode === 'calendar')
  ) {
    return defaultProjectCaptureTarget;
  }

  return currentProjectId;
};
