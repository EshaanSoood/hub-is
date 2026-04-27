import { z } from 'zod';

export type HomeTabId = 'overview' | 'work';
export type HomeContentViewId = 'project' | 'lenses' | 'stream';
export type HomeOverviewViewId = 'timeline' | 'calendar' | 'tasks' | 'reminders';
export type HomeOverlayId = 'thoughts';

const HomeTaskRecordIdSchema = z.string().trim().min(1);
const homeRouteParamKeys = new Set(['tab', 'content', 'overview', 'project', 'pinned', 'surface']);

export const parseHomeTabId = (value: string | null): HomeTabId =>
  value === 'work' ? 'work' : 'overview';

export const parseHomeContentViewId = (value: string | null): HomeContentViewId => {
  if (value === 'stream') {
    return 'stream';
  }
  if (value === 'lenses' || value === 'project-lens') {
    return 'lenses';
  }
  return 'project';
};

export const parseHomeOverviewViewId = (value: string | null): HomeOverviewViewId => {
  if (value === 'calendar' || value === 'tasks' || value === 'reminders') {
    return value;
  }
  return 'timeline';
};

export const parseHomeOverlayId = (value: string | null): HomeOverlayId | null =>
  value === 'thoughts' ? value : null;

export const parseHomeTaskRecordId = (value: string | null): string | null => {
  const parsedTaskRecordId = HomeTaskRecordIdSchema.safeParse(value);
  return parsedTaskRecordId.success ? parsedTaskRecordId.data : null;
};

export const parseHomeProjectId = (value: string | null): string | null => {
  const parsedProjectId = HomeTaskRecordIdSchema.safeParse(value);
  return parsedProjectId.success ? parsedProjectId.data : null;
};

const buildHomeHref = ({
  content,
  extraParams,
  overview,
  overlay,
  projectId,
  pinned,
  tab,
}: {
  content?: HomeContentViewId;
  extraParams?: Record<string, string | null | undefined>;
  overview?: HomeOverviewViewId;
  overlay?: HomeOverlayId | null;
  projectId?: string | null;
  pinned?: boolean;
  tab?: HomeTabId;
}): string => {
  const params = new URLSearchParams();
  if (tab && tab !== 'overview') {
    params.set('tab', tab);
  }
  if ((tab ?? 'overview') === 'overview') {
    if (content && content !== 'project') {
      params.set('content', content);
    }
    if (overview && overview !== 'timeline') {
      params.set('overview', overview);
    }
  }
  if ((tab ?? 'overview') === 'work' && projectId) {
    params.set('project', projectId);
  }
  if (overlay) {
    params.set('surface', overlay);
  }
  if ((tab ?? 'overview') === 'work' && pinned) {
    params.set('pinned', '1');
  }
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (typeof value === 'string' && value.length > 0 && !homeRouteParamKeys.has(key) && !params.has(key)) {
        params.set(key, value);
      }
    }
  }
  const search = params.toString();
  return search ? `/projects?${search}` : '/projects';
};

export const buildHomeTabHref = (
  tab: HomeTabId,
  options?: {
    content?: HomeContentViewId;
    extraParams?: Record<string, string | null | undefined>;
    overview?: HomeOverviewViewId;
    projectId?: string | null;
    pinned?: boolean;
  },
): string => buildHomeHref({
  tab,
  content: options?.content,
  extraParams: options?.extraParams,
  overview: options?.overview,
  projectId: options?.projectId,
  pinned: options?.pinned,
});

export const buildHomeContentHref = (
  content: HomeContentViewId,
  options?: { overview?: HomeOverviewViewId },
): string => buildHomeHref({
  tab: 'overview',
  content,
  overview: options?.overview,
});

export const buildHomeOverlayHref = (
  overlay: HomeOverlayId,
  options?: {
    content?: HomeContentViewId;
    extraParams?: Record<string, string | null | undefined>;
    overview?: HomeOverviewViewId;
    projectId?: string | null;
    pinned?: boolean;
    tab?: HomeTabId;
  },
): string => buildHomeHref({
  overlay,
  tab: options?.tab,
  content: options?.content,
  extraParams: options?.extraParams,
  overview: options?.overview,
  projectId: options?.projectId,
  pinned: options?.pinned,
});

export const focusHomeLauncher = (
  launcherId: HomeTabId | HomeContentViewId | HomeOverlayId,
): boolean => {
  const launcher = document.querySelector<HTMLElement>(`[data-home-launcher="${launcherId}"]`);
  if (!launcher) {
    return false;
  }
  launcher.focus();
  return document.activeElement === launcher;
};
