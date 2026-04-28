import { z } from 'zod';

export type HomeTabId = 'overview' | 'work';
export type HomeContentViewId = 'project' | 'lenses' | 'stream';
export type HomeOverviewViewId = 'timeline' | 'calendar' | 'tasks' | 'reminders';
export type HomeSurfaceId = 'hub' | 'stream' | 'calendar' | 'tasks' | 'reminders';
export type HomeOverlayId = 'thoughts';

const HomeTaskRecordIdSchema = z.string().trim().min(1);
const homeRouteParamKeys = new Set(['tab', 'content', 'overview', 'project', 'pinned', 'surface', 'overlay']);
const legacyHomeSurfaceParamKeys = ['tab', 'content', 'view', 'overview', 'project', 'pinned', 'record_id', 'view_id'] as const;
export const HOME_SURFACE_IDS = ['hub', 'stream', 'calendar', 'tasks', 'reminders'] as const satisfies ReadonlyArray<HomeSurfaceId>;
const HOME_SURFACE_SET = new Set<HomeSurfaceId>(HOME_SURFACE_IDS);

export const parseHomeSurfaceId = (value: string | null): HomeSurfaceId => {
  if (value && HOME_SURFACE_SET.has(value as HomeSurfaceId)) {
    return value as HomeSurfaceId;
  }
  return 'hub';
};

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

export const rewriteHomeSurfaceSearchParams = (
  current: URLSearchParams,
  surface: HomeSurfaceId,
  options?: {
    extraParams?: Record<string, string | null | undefined>;
    overlay?: HomeOverlayId | null;
  },
): URLSearchParams => {
  const next = new URLSearchParams(current);
  for (const key of legacyHomeSurfaceParamKeys) {
    next.delete(key);
  }
  if (surface !== 'hub') {
    next.set('surface', surface);
  }
  if (options?.overlay) {
    next.set('overlay', options.overlay);
  } else if (options?.overlay === null) {
    next.delete('overlay');
  }
  if (options?.extraParams) {
    for (const [key, value] of Object.entries(options.extraParams)) {
      if (typeof value === 'string' && value.length > 0 && !homeRouteParamKeys.has(key) && !next.has(key)) {
        next.set(key, value);
      }
    }
  }
  return next;
};

const buildHomeHref = ({
  content,
  extraParams,
  overview,
  overlay,
  projectId,
  pinned,
  surface,
  tab,
}: {
  content?: HomeContentViewId;
  extraParams?: Record<string, string | null | undefined>;
  overview?: HomeOverviewViewId;
  overlay?: HomeOverlayId | null;
  projectId?: string | null;
  pinned?: boolean;
  surface?: HomeSurfaceId;
  tab?: HomeTabId;
}): string => {
  const params = new URLSearchParams();
  if (surface && surface !== 'hub') {
    params.set('surface', surface);
  }
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
    params.set('overlay', overlay);
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

export const buildHomeSurfaceHref = (
  surface: HomeSurfaceId,
  options?: {
    extraParams?: Record<string, string | null | undefined>;
    overlay?: HomeOverlayId | null;
  },
): string => {
  const params = rewriteHomeSurfaceSearchParams(new URLSearchParams(), surface, {
    overlay: options?.overlay,
    extraParams: options?.extraParams,
  });
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
    surface?: HomeSurfaceId;
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
  surface: options?.surface,
});

export const focusHomeLauncher = (
  launcherId: HomeTabId | HomeContentViewId | HomeSurfaceId | HomeOverlayId,
): boolean => {
  const launcher = document.querySelector<HTMLElement>(`[data-home-launcher="${launcherId}"]`);
  if (!launcher) {
    return false;
  }
  launcher.focus();
  return document.activeElement === launcher;
};
