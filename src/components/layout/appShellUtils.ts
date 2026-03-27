import { buildNotificationDestinationHref } from '../../lib/hubRoutes';
import type { ReminderParseResult } from '../../lib/nlp/reminder-parser';
import type { HubSearchResult } from '../../services/hub/search';
import type { HubNotification } from '../../services/hub/types';

export interface ToolbarNotification {
  id: string;
  summary: string;
  body: string;
  authorInitial: string;
  avatarColor: string;
  projectId: string;
  createdAt: string;
  read: boolean;
  payload: Record<string, unknown>;
  href: string;
}

export type NotificationFilter = 'unread' | 'all';
export type QuickAddDialog = 'task' | 'event' | 'reminder' | 'project' | null;
export type ToolbarDialog = 'calendar' | 'tasks' | 'reminders' | null;
export type QuickAddOption = {
  key: Exclude<QuickAddDialog, null>;
  label: string;
  iconName: 'tasks' | 'calendar' | 'reminders' | 'menu';
};

export type QuickNavActionItem =
  | {
      id: string;
      label: string;
      iconName: 'calendar' | 'tasks' | 'reminders';
      action: 'panel';
      panel: Exclude<ToolbarDialog, null>;
    }
  | {
      id: string;
      label: string;
      iconName?: 'menu';
      action: 'navigate';
      href: string;
    };

export const QUICK_NAV_FIXED_ITEMS: QuickNavActionItem[] = [
  { id: 'quick-nav-calendar', label: 'Calendar', iconName: 'calendar', action: 'panel', panel: 'calendar' },
  { id: 'quick-nav-tasks', label: 'Tasks', iconName: 'tasks', action: 'panel', panel: 'tasks' },
  { id: 'quick-nav-reminders', label: 'Reminders', iconName: 'reminders', action: 'panel', panel: 'reminders' },
];

export const QUICK_ADD_OPTIONS: QuickAddOption[] = [
  { key: 'task', label: 'Task', iconName: 'tasks' },
  { key: 'event', label: 'Calendar Event', iconName: 'calendar' },
  { key: 'reminder', label: 'Reminder', iconName: 'reminders' },
  { key: 'project', label: 'Project', iconName: 'menu' },
];

export const relativeTimeLabel = (iso: string): string => {
  const timestamp = Number(new Date(iso));
  if (!Number.isFinite(timestamp)) {
    return 'just now';
  }
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export const parseIsoTimestamp = (value: string | null | undefined): number => {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }
  const timestamp = Number(new Date(value));
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
};

export type DateBucketId =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'rest-of-week'
  | 'later-this-month'
  | 'later-this-year'
  | 'beyond'
  | 'no-date';

export const DATE_BUCKET_ORDER: DateBucketId[] = [
  'overdue',
  'today',
  'tomorrow',
  'rest-of-week',
  'later-this-month',
  'later-this-year',
  'beyond',
  'no-date',
];

export const DATE_BUCKET_LABELS: Record<DateBucketId, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  'rest-of-week': 'Rest of the Week',
  'later-this-month': 'Later This Month',
  'later-this-year': 'Later This Year',
  beyond: 'Beyond',
  'no-date': 'No Date',
};

export const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const parseIsoDate = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export const isSameCalendarDay = (left: Date, right: Date): boolean =>
  startOfDay(left).getTime() === startOfDay(right).getTime();

export const endOfWeek = (date: Date): Date => {
  const next = startOfDay(date);
  const dayOffset = 6 - next.getDay();
  next.setDate(next.getDate() + dayOffset);
  next.setHours(23, 59, 59, 999);
  return next;
};

export const endOfMonth = (date: Date): Date => {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  next.setHours(23, 59, 59, 999);
  return next;
};

export const endOfYear = (date: Date): Date => {
  const next = new Date(date.getFullYear(), 11, 31);
  next.setHours(23, 59, 59, 999);
  return next;
};

export const bucketForDate = (value: string | null | undefined, now: Date): DateBucketId => {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return 'no-date';
  }
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const dayAfterTomorrowStart = new Date(todayStart);
  dayAfterTomorrowStart.setDate(todayStart.getDate() + 2);
  const weekEnd = endOfWeek(now);
  const hasRestOfWeekWindow = dayAfterTomorrowStart <= weekEnd;

  if (parsed < todayStart) {
    return 'overdue';
  }
  if (isSameCalendarDay(parsed, now)) {
    return 'today';
  }
  if (isSameCalendarDay(parsed, tomorrowStart)) {
    return 'tomorrow';
  }
  if (hasRestOfWeekWindow && parsed >= dayAfterTomorrowStart && parsed <= weekEnd) {
    return 'rest-of-week';
  }
  if (parsed <= endOfMonth(now)) {
    return 'later-this-month';
  }
  if (parsed <= endOfYear(now)) {
    return 'later-this-year';
  }
  return 'beyond';
};

export const formatQuickNavTime = (value: string | null | undefined, fallback = 'No date'): string => {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return fallback;
  }
  return parsed.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const tomorrowAtNineIso = (): string => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next.toISOString();
};

export const projectDotClassNames = [
  'bg-[color:var(--color-primary)]',
  'bg-[color:var(--color-primary-strong)]',
  'bg-[color:var(--color-capture-rail)]',
  'bg-[color:var(--color-text-secondary)]',
  'bg-[color:var(--color-muted)]',
];

export const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const projectDotClassName = (projectId: string | null): string => {
  if (!projectId) {
    return projectDotClassNames[0] || 'bg-[color:var(--color-primary)]';
  }
  const index = hashString(projectId) % projectDotClassNames.length;
  return projectDotClassNames[index] || projectDotClassNames[0] || 'bg-[color:var(--color-primary)]';
};

export const buildBreadcrumb = (pathname: string, projects: Array<{ id: string; name: string }>): string[] => {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0 || pathname === '/projects' || pathname === '/') {
    return ['Hub Home'];
  }

  if (segments[0] !== 'projects') {
    return segments.map((segment) => segment.replace(/-/g, ' '));
  }

  const crumb: string[] = ['Projects'];
  const projectId = segments[1];
  if (projectId) {
    const projectName = projects.find((project) => project.id === projectId)?.name || projectId;
    crumb.push(projectName);
  }
  if (segments[2]) {
    crumb.push(segments[2].charAt(0).toUpperCase() + segments[2].slice(1));
  }

  return crumb;
};

// Keep these static so notification/avatar identity colors remain stable across themes.
export const NOTIFICATION_AVATAR_COLORS = [
  'rgb(52 124 212)',
  'rgb(46 185 166)',
  'rgb(245 168 80)',
  'rgb(220 80 100)',
  'rgb(132 156 178)',
];

export const notificationAvatarColor = (value: string): string => {
  const index = hashString(value) % NOTIFICATION_AVATAR_COLORS.length;
  return NOTIFICATION_AVATAR_COLORS[index];
};

export const notificationAuthorInitial = (summary: string, fallback: string): string => {
  const source = summary.trim() || fallback.trim();
  const first = source.charAt(0);
  return first ? first.toUpperCase() : '?';
};

// Data URL avatars should not depend on page-level CSS variables.
export const ACCOUNT_AVATAR_BACKGROUNDS = [
  'rgb(40 92 170)',
  'rgb(22 121 107)',
  'rgb(181 103 18)',
  'rgb(164 61 84)',
  'rgb(86 105 125)',
];

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildAccountAvatarUrl = (initials: string, seed: string): string => {
  const background = ACCOUNT_AVATAR_BACKGROUNDS[hashString(seed || initials) % ACCOUNT_AVATAR_BACKGROUNDS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true"><rect width="64" height="64" rx="32" fill="${background}"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" fill="rgb(255 255 255)" font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="24" font-weight="700">${escapeXml(initials)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const sessionInitials = (name: string, email: string, userId: string): string => {
  const source = name.trim() || email.trim() || userId.trim();
  if (!source) {
    return '?';
  }
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.charAt(0) || ''}${words[1]?.charAt(0) || ''}`.toUpperCase();
  }
  return source.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || source.charAt(0).toUpperCase();
};

export const toToolbarNotification = (entry: HubNotification): ToolbarNotification => {
  const payloadMessage =
    typeof entry.payload?.message === 'string'
      ? entry.payload.message
      : `Entity ${entry.entity_type}:${entry.entity_id}`;
  return {
    id: entry.notification_id,
    summary: entry.reason,
    body: payloadMessage,
    authorInitial: notificationAuthorInitial(entry.reason, payloadMessage),
    avatarColor: notificationAvatarColor(`${entry.notification_id}:${entry.reason}`),
    projectId: entry.project_id,
    createdAt: entry.created_at,
    read: Boolean(entry.read_at),
    payload: entry.payload || {},
    href: buildNotificationDestinationHref({
      projectId: entry.project_id,
      entityType: entry.entity_type,
      entityId: entry.entity_id,
      payload: entry.payload || {},
      fallbackHref: `/projects/${encodeURIComponent(entry.project_id)}/work`,
    }),
  };
};

export const isTextInputElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
};

export const focusElementSoon = (element: HTMLElement | null | undefined) => {
  window.setTimeout(() => {
    if (element?.isConnected) {
      element.focus();
    }
  }, 0);
};

export const focusFirstDescendantSoon = (container: HTMLElement | null | undefined, selector: string) => {
  window.setTimeout(() => {
    const target = container?.querySelector<HTMLElement>(selector);
    if (target?.isConnected) {
      target.focus();
    }
  }, 0);
};

export const toDateTimeLocalInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

export const nowPlusHours = (hours: number): Date => new Date(Date.now() + hours * 60 * 60 * 1000);

export const hasMeaningfulReminderPreview = (preview: ReminderParseResult): boolean =>
  Boolean(preview.fields.title.trim() || preview.fields.remind_at || preview.fields.recurrence || preview.fields.context_hint);

export const emptyReminderPreview = (): ReminderParseResult => ({
  fields: {
    title: '',
    remind_at: null,
    recurrence: null,
    context_hint: null,
  },
  meta: {
    confidence: {
      title: 0,
      remind_at: 0,
      recurrence: 0,
      context_hint: 0,
    },
    spans: {
      title: [],
      remind_at: [],
      recurrence: [],
      context_hint: [],
    },
    debugSteps: [],
    maskedInput: '',
  },
  warnings: null,
});

export const SEARCH_RESULT_TYPE_LABELS: Record<HubSearchResult['type'], string> = {
  record: 'Record',
  project: 'Project',
  pane: 'Pane',
};

export const buildSearchResultHref = (result: HubSearchResult): string | null => {
  if (result.type === 'project') {
    return `/projects/${encodeURIComponent(result.id)}/overview`;
  }
  if (result.type === 'pane' && result.project_id) {
    return `/projects/${encodeURIComponent(result.project_id)}/work/${encodeURIComponent(result.id)}`;
  }
  if (result.type === 'record' && result.project_id) {
    return `/projects/${encodeURIComponent(result.project_id)}/work?record_id=${encodeURIComponent(result.id)}`;
  }
  return null;
};

export const priorityBorderColor = (priority: string | null | undefined): string => {
  switch (priority) {
    case 'high':
      return 'var(--color-danger)';
    case 'medium':
      return 'var(--color-priority-medium)';
    case 'low':
      return 'var(--color-priority-low)';
    default:
      return 'var(--color-border-muted)';
  }
};
