export type HomeViewId = 'project-lens' | 'stream';
export type HomeOverlayId = 'tasks' | 'calendar' | 'reminders' | 'thoughts';

export const parseHomeViewId = (value: string | null): HomeViewId =>
  value === 'stream' || value === 'project-lens' ? value : 'project-lens';

export const parseHomeOverlayId = (value: string | null): HomeOverlayId | null =>
  value === 'tasks' || value === 'calendar' || value === 'reminders' || value === 'thoughts'
    ? value
    : null;

const buildHomeHref = ({
  overlay,
  view,
}: {
  overlay?: HomeOverlayId | null;
  view?: HomeViewId;
}): string => {
  const params = new URLSearchParams();
  if (view) {
    params.set('view', view);
  }
  if (overlay) {
    params.set('surface', overlay);
  }
  const search = params.toString();
  return search ? `/projects?${search}` : '/projects';
};

export const buildHomeViewHref = (view: HomeViewId): string => buildHomeHref({ view });

export const buildHomeOverlayHref = (
  overlay: HomeOverlayId,
  options?: { view?: HomeViewId },
): string => buildHomeHref({ overlay, view: options?.view });
