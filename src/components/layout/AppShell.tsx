import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { appTabs } from '../../lib/policy';
import { useProjects } from '../../context/ProjectsContext';
import { QuickCapturePanel } from '../../features/QuickCapture';
import { TaskCreateDialog } from '../project-space/TaskCreateDialog';
import { useRouteFocusReset } from '../../hooks/useRouteFocusReset';
import { listCollections } from '../../services/hub/collections';
import { listNotifications, markNotificationRead } from '../../services/hub/notifications';
import { createEventFromNlp, getHubHome } from '../../services/hub/records';
import { createReminder } from '../../services/hub/reminders';
import { listProjectMembers } from '../../services/hub/projects';
import { searchHub, type HubSearchResult } from '../../services/hub/search';
import type { HubCollection, HubNotification, HubProjectMember } from '../../services/hub/types';
import { subscribeHubLive } from '../../services/hubLive';
import { buildNotificationDestinationHref } from '../../lib/hubRoutes';
import { parseReminderInput, type ReminderParseResult } from '../../lib/nlp/reminder-parser';
import { createHubProject } from '../../services/projectsService';
import { Dialog, Icon, Popover, PopoverAnchor, PopoverContent } from '../primitives';

interface ToolbarNotification {
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

type NotificationFilter = 'unread' | 'all';
type QuickAddDialog = 'task' | 'event' | 'reminder' | 'project' | null;
type QuickAddOption = {
  key: Exclude<QuickAddDialog, null>;
  label: string;
  iconName: 'tasks' | 'calendar' | 'reminders' | 'menu';
};

const QUICK_ADD_OPTIONS: QuickAddOption[] = [
  { key: 'task', label: 'Task', iconName: 'tasks' },
  { key: 'event', label: 'Calendar Event', iconName: 'calendar' },
  { key: 'reminder', label: 'Reminder', iconName: 'reminders' },
  { key: 'project', label: 'Project', iconName: 'menu' },
];

const relativeTimeLabel = (iso: string): string => {
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

const buildBreadcrumb = (pathname: string, projects: Array<{ id: string; name: string }>): string[] => {
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

const NOTIFICATION_AVATAR_COLORS = [
  'rgb(52 124 212)',
  'rgb(46 185 166)',
  'rgb(245 168 80)',
  'rgb(220 80 100)',
  'rgb(132 156 178)',
];

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const notificationAvatarColor = (value: string): string => {
  const index = hashString(value) % NOTIFICATION_AVATAR_COLORS.length;
  return NOTIFICATION_AVATAR_COLORS[index];
};

const notificationAuthorInitial = (summary: string, fallback: string): string => {
  const source = summary.trim() || fallback.trim();
  const first = source.charAt(0);
  return first ? first.toUpperCase() : '?';
};

const ACCOUNT_AVATAR_BACKGROUNDS = [
  'rgb(40 92 170)',
  'rgb(22 121 107)',
  'rgb(181 103 18)',
  'rgb(164 61 84)',
  'rgb(86 105 125)',
];

const sessionInitials = (name: string, email: string, userId: string): string => {
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

const buildAccountAvatarUrl = (initials: string, seed: string): string => {
  const background = ACCOUNT_AVATAR_BACKGROUNDS[hashString(seed || initials) % ACCOUNT_AVATAR_BACKGROUNDS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true"><rect width="64" height="64" rx="32" fill="${background}"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" fill="rgb(255 255 255)" font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="24" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const isTextInputElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
};

const focusElementSoon = (element: HTMLElement | null | undefined) => {
  window.setTimeout(() => {
    if (element?.isConnected) {
      element.focus();
    }
  }, 0);
};

const focusFirstDescendantSoon = (container: HTMLElement | null | undefined, selector: string) => {
  window.setTimeout(() => {
    const target = container?.querySelector<HTMLElement>(selector);
    if (target?.isConnected) {
      target.focus();
    }
  }, 0);
};

const findTaskCollectionId = (collections: HubCollection[]): string | null => {
  if (collections.length === 0) {
    return null;
  }
  const candidate = collections.find((collection) => {
    const normalized = collection.name.toLowerCase();
    return normalized.includes('task') || normalized.includes('todo');
  });
  return candidate?.collection_id || collections[0]?.collection_id || null;
};

const toDateTimeLocalInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const nowPlusHours = (hours: number): Date => new Date(Date.now() + hours * 60 * 60 * 1000);

const hasMeaningfulReminderPreview = (preview: ReminderParseResult): boolean =>
  Boolean(preview.title.trim() || preview.remind_at || preview.recurrence || preview.context_hint);

const emptyReminderPreview = (): ReminderParseResult => ({
  title: '',
  remind_at: null,
  recurrence: null,
  context_hint: null,
});

const SEARCH_RESULT_TYPE_LABELS: Record<HubSearchResult['type'], string> = {
  record: 'Record',
  project: 'Project',
  pane: 'Pane',
};

const buildSearchResultHref = (result: HubSearchResult): string | null => {
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

const toToolbarNotification = (entry: HubNotification): ToolbarNotification => {
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

export const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionSummary, canGlobal, accessToken, signOut } = useAuthz();
  const { projects, refreshProjects } = useProjects();

  useRouteFocusReset();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [quickNavOpen, setQuickNavOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [quickAddActiveIndex, setQuickAddActiveIndex] = useState(0);
  const [quickAddDialog, setQuickAddDialog] = useState<QuickAddDialog>(null);
  const [quickAddProjectId, setQuickAddProjectId] = useState('');
  const [taskCollectionIdByProjectId, setTaskCollectionIdByProjectId] = useState<Record<string, string | null>>({});
  const [taskProjectMembersById, setTaskProjectMembersById] = useState<Record<string, HubProjectMember[]>>({});
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartAt, setEventStartAt] = useState(() => toDateTimeLocalInput(nowPlusHours(1)));
  const [eventEndAt, setEventEndAt] = useState(() => toDateTimeLocalInput(nowPlusHours(2)));
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [reminderDraft, setReminderDraft] = useState('');
  const [reminderPreview, setReminderPreview] = useState<ReminderParseResult>(() => emptyReminderPreview());
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [projectDialogName, setProjectDialogName] = useState('');
  const [projectDialogSubmitting, setProjectDialogSubmitting] = useState(false);
  const [projectDialogError, setProjectDialogError] = useState<string | null>(null);
  const [notifFilter, setNotifFilter] = useState<NotificationFilter>('unread');
  const [notifProjectFilter, setNotifProjectFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HubSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const [quickNavQuery, setQuickNavQuery] = useState('');
  const [quickNavActiveIndex, setQuickNavActiveIndex] = useState(-1);
  const [notifications, setNotifications] = useState<ToolbarNotification[]>([]);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureIntent, setCaptureIntent] = useState<string | null>(null);
  const [captureActivationKey, setCaptureActivationKey] = useState(0);
  const [captureAnnouncement, setCaptureAnnouncement] = useState('');
  const [captureHomeData, setCaptureHomeData] = useState<{
    personalProjectId: string | null;
    captures: Awaited<ReturnType<typeof getHubHome>>['captures'];
  }>({
    personalProjectId: null,
    captures: [],
  });
  const [captureLoading, setCaptureLoading] = useState(false);

  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchDismissedRef = useRef(false);
  const searchRequestVersionRef = useRef(0);
  const quickNavRef = useRef<HTMLDivElement | null>(null);
  const quickNavTriggerRef = useRef<HTMLButtonElement | null>(null);
  const quickNavInputRef = useRef<HTMLInputElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const profileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const notificationsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const quickAddItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const quickAddTaskMetadataRequestRef = useRef(0);
  const captureTriggerRef = useRef<HTMLButtonElement | null>(null);
  const captureRestoreTargetRef = useRef<HTMLElement | null>(null);
  const taskTitleInputRef = useRef<HTMLInputElement | null>(null);
  const eventProjectSelectRef = useRef<HTMLSelectElement | null>(null);
  const reminderInputRef = useRef<HTMLInputElement | null>(null);
  const reminderProjectSelectRef = useRef<HTMLSelectElement | null>(null);
  const projectNameInputRef = useRef<HTMLInputElement | null>(null);
  const captureRequestVersionRef = useRef(0);
  const quickNavWasOpenRef = useRef(false);
  const notificationsWereOpenRef = useRef(false);
  const profileWasOpenRef = useRef(false);
  const contextMenuWasOpenRef = useRef(false);
  const skipQuickNavFocusRestoreRef = useRef(false);
  const skipNotificationsFocusRestoreRef = useRef(false);
  const skipProfileFocusRestoreRef = useRef(false);
  const skipContextMenuFocusRestoreRef = useRef(false);
  const skipCaptureFocusRestoreRef = useRef(false);

  const visibleTabs = appTabs.filter((tab) => canGlobal(tab.capability));
  const isOnHubHome = location.pathname === '/projects';
  const currentProjectId = useMemo(() => {
    const match = location.pathname.match(/^\/projects\/([^/]+)/);
    if (!match || location.pathname === '/projects') {
      return null;
    }
    return decodeURIComponent(match[1]);
  }, [location.pathname]);
  const preferredCaptureProjectId = useMemo(() => {
    if (!currentProjectId) {
      return null;
    }
    const project = projects.find((entry) => entry.id === currentProjectId) || null;
    return project && !project.isPersonal ? project.id : null;
  }, [currentProjectId, projects]);
  const breadcrumb = useMemo(
    () => buildBreadcrumb(location.pathname, projects.map((project) => ({ id: project.id, name: project.name }))),
    [location.pathname, projects],
  );
  const quickAddProjectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.isPersonal ? `${project.name} (Personal)` : project.name,
      })),
    [projects],
  );
  const selectedTaskProjectMembers = useMemo(
    () => taskProjectMembersById[quickAddProjectId] ?? [],
    [quickAddProjectId, taskProjectMembersById],
  );
  const selectedTaskCollectionId = useMemo(
    () => taskCollectionIdByProjectId[quickAddProjectId] ?? null,
    [quickAddProjectId, taskCollectionIdByProjectId],
  );

  const refreshCaptureData = useCallback(async () => {
    if (!accessToken) {
      captureRequestVersionRef.current += 1;
      setCaptureHomeData({ personalProjectId: null, captures: [] });
      setCaptureLoading(false);
      return;
    }
    const requestVersion = captureRequestVersionRef.current + 1;
    captureRequestVersionRef.current = requestVersion;
    setCaptureLoading(true);
    try {
      const next = await getHubHome(accessToken, {
        tasks_limit: 1,
        events_limit: 1,
        captures_limit: 20,
        notifications_limit: 1,
      });
      if (captureRequestVersionRef.current !== requestVersion) {
        return;
      }
      setCaptureHomeData({
        personalProjectId: next.personal_project_id,
        captures: next.captures,
      });
    } catch {
      if (captureRequestVersionRef.current !== requestVersion) {
        return;
      }
      // Best-effort toolbar data.
    } finally {
      if (captureRequestVersionRef.current === requestVersion) {
        setCaptureLoading(false);
      }
    }
  }, [accessToken]);

  const refreshNotifications = useCallback(async () => {
    if (!accessToken) {
      return [] as ToolbarNotification[];
    }

    try {
      const next = await listNotifications(accessToken);
      return next.map(toToolbarNotification);
    } catch {
      // best-effort toolbar data
      return null;
    }
  }, [accessToken]);

  const resolveDefaultQuickAddProjectId = useCallback((): string => {
    if (currentProjectId && projects.some((project) => project.id === currentProjectId)) {
      return currentProjectId;
    }
    if (captureHomeData.personalProjectId && projects.some((project) => project.id === captureHomeData.personalProjectId)) {
      return captureHomeData.personalProjectId;
    }
    const personalProjectId = projects.find((project) => project.isPersonal)?.id;
    if (personalProjectId) {
      return personalProjectId;
    }
    return projects[0]?.id || '';
  }, [captureHomeData.personalProjectId, currentProjectId, projects]);

  const loadTaskProjectMetadata = useCallback(async (projectId: string) => {
    if (!accessToken || !projectId) {
      return;
    }
    const hasMembers = taskProjectMembersById[projectId] !== undefined;
    const hasCollection = taskCollectionIdByProjectId[projectId] !== undefined;
    if (hasMembers && hasCollection) {
      return;
    }

    const requestVersion = quickAddTaskMetadataRequestRef.current + 1;
    quickAddTaskMetadataRequestRef.current = requestVersion;
    try {
      const [members, collections] = await Promise.all([
        listProjectMembers(accessToken, projectId),
        listCollections(accessToken, projectId),
      ]);
      if (quickAddTaskMetadataRequestRef.current !== requestVersion) {
        return;
      }
      setTaskProjectMembersById((current) => ({ ...current, [projectId]: members }));
      setTaskCollectionIdByProjectId((current) => ({ ...current, [projectId]: findTaskCollectionId(collections) }));
    } catch {
      if (quickAddTaskMetadataRequestRef.current !== requestVersion) {
        return;
      }
    }
  }, [accessToken, taskCollectionIdByProjectId, taskProjectMembersById]);

  const closeQuickAddDialog = useCallback(() => {
    setQuickAddDialog(null);
    setEventError(null);
    setReminderError(null);
    setProjectDialogError(null);
  }, []);

  const openQuickAddDialog = useCallback(
    async (dialogType: Exclude<QuickAddDialog, null>) => {
      if (dialogType === 'project') {
        setProjectDialogName('');
        setProjectDialogError(null);
        setQuickAddDialog(dialogType);
        return;
      }

      let defaultProjectId = resolveDefaultQuickAddProjectId();
      if (!defaultProjectId && accessToken) {
        await refreshCaptureData();
        defaultProjectId = resolveDefaultQuickAddProjectId();
      }
      setQuickAddProjectId(defaultProjectId);

      if (dialogType === 'task') {
        if (defaultProjectId) {
          void loadTaskProjectMetadata(defaultProjectId);
        }
      }
      if (dialogType === 'event') {
        setEventTitle('');
        setEventStartAt(toDateTimeLocalInput(nowPlusHours(1)));
        setEventEndAt(toDateTimeLocalInput(nowPlusHours(2)));
        setEventError(null);
      }
      if (dialogType === 'reminder') {
        setReminderDraft('');
        setReminderPreview(emptyReminderPreview());
        setReminderError(null);
      }

      setQuickAddDialog(dialogType);
    },
    [accessToken, loadTaskProjectMetadata, refreshCaptureData, resolveDefaultQuickAddProjectId],
  );

  const onCreateQuickAddEvent = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) {
      setEventError('An authenticated session is required.');
      return;
    }
    if (!quickAddProjectId) {
      setEventError('Select a project.');
      return;
    }
    const trimmedTitle = eventTitle.trim();
    if (!trimmedTitle) {
      setEventError('Event title is required.');
      return;
    }
    const startDate = new Date(eventStartAt);
    const endDate = new Date(eventEndAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
      setEventError('End time must be after start time.');
      return;
    }

    setEventSubmitting(true);
    setEventError(null);
    try {
      await createEventFromNlp(accessToken, quickAddProjectId, {
        title: trimmedTitle,
        start_dt: startDate.toISOString(),
        end_dt: endDate.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setQuickAddDialog(null);
    } catch (error) {
      setEventError(error instanceof Error ? error.message : 'Failed to create event.');
    } finally {
      setEventSubmitting(false);
    }
  }, [accessToken, eventEndAt, eventStartAt, eventTitle, quickAddProjectId]);

  const onCreateQuickAddReminder = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) {
      setReminderError('An authenticated session is required.');
      return;
    }

    const title = reminderPreview.title.trim() || reminderDraft.trim();
    if (!title || !reminderPreview.remind_at) {
      setReminderError('Add a title and time to create a reminder.');
      return;
    }

    setReminderSubmitting(true);
    setReminderError(null);
    try {
      await createReminder(accessToken, {
        title,
        remind_at: reminderPreview.remind_at,
        recurrence_json: reminderPreview.recurrence
          ? {
              frequency: reminderPreview.recurrence.frequency,
              interval: reminderPreview.recurrence.interval,
            }
          : null,
      });
      setQuickAddDialog(null);
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Failed to create reminder.');
    } finally {
      setReminderSubmitting(false);
    }
  }, [accessToken, reminderDraft, reminderPreview]);

  const onCreateQuickAddProject = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) {
      setProjectDialogError('An authenticated session is required.');
      return;
    }
    const trimmedName = projectDialogName.trim();
    if (!trimmedName) {
      setProjectDialogError('Project name is required.');
      return;
    }

    setProjectDialogSubmitting(true);
    setProjectDialogError(null);
    try {
      const created = await createHubProject(accessToken, {
        name: trimmedName,
        summary: '',
      });
      if (created.error || !created.data) {
        setProjectDialogError(created.error || 'Project creation failed.');
        return;
      }
      setQuickAddDialog(null);
      setProjectDialogName('');
      await refreshProjects();
      navigate(`/projects/${created.data.id}/overview`);
    } catch (error) {
      setProjectDialogError(error instanceof Error ? error.message : 'Project creation failed.');
    } finally {
      setProjectDialogSubmitting(false);
    }
  }, [accessToken, navigate, projectDialogName, refreshProjects]);

  useEffect(() => {
    void refreshCaptureData();
  }, [refreshCaptureData]);

  useEffect(() => {
    if (!captureOpen) {
      return;
    }
    void refreshCaptureData();
    setCaptureAnnouncement('Quick capture panel opened.');
    const timer = window.setTimeout(() => {
      setCaptureAnnouncement('');
    }, 1500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [captureOpen, refreshCaptureData]);

  useEffect(() => {
    if (!contextMenuOpen) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      setQuickAddActiveIndex(0);
      focusElementSoon(quickAddItemRefs.current[0]);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [contextMenuOpen]);

  useEffect(() => {
    if (quickAddDialog !== 'reminder') {
      return;
    }
    const timer = window.setTimeout(() => {
      setReminderPreview(reminderDraft.trim() ? parseReminderInput(reminderDraft) : emptyReminderPreview());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [quickAddDialog, reminderDraft]);

  useEffect(() => {
    if (quickAddDialog !== 'task' || !quickAddProjectId) {
      return;
    }
    void loadTaskProjectMetadata(quickAddProjectId);
  }, [loadTaskProjectMetadata, quickAddDialog, quickAddProjectId]);

  useEffect(() => {
    if (quickAddDialog === 'task') {
      focusElementSoon(taskTitleInputRef.current);
      return;
    }
    if (quickAddDialog === 'event') {
      focusElementSoon(eventProjectSelectRef.current);
      return;
    }
    if (quickAddDialog === 'reminder') {
      focusElementSoon(reminderProjectSelectRef.current);
      return;
    }
    if (quickAddDialog === 'project') {
      focusElementSoon(projectNameInputRef.current);
    }
  }, [quickAddDialog]);

  useEffect(() => {
    let cancelled = false;
    const refreshAndStore = async () => {
      const next = await refreshNotifications();
      if (cancelled || !next) {
        return;
      }
      setNotifications(next);
    };
    const kickoff = window.setTimeout(() => {
      void refreshAndStore();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshAndStore();
    }, 45_000);
    return () => {
      cancelled = true;
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    return subscribeHubLive(accessToken, (message) => {
      if (message.type !== 'notification.new') {
        return;
      }
      const nextNotification = toToolbarNotification(message.notification);
      setNotifications((current) => {
        const existingIndex = current.findIndex((notification) => notification.id === nextNotification.id);
        if (existingIndex >= 0) {
          return current.map((notification, index) => (index === existingIndex ? nextNotification : notification));
        }
        return [nextNotification, ...current];
      });

      if ('Notification' in window && Notification.permission === 'granted') {
        const payload = message.notification?.payload ?? {};
        const title = typeof payload.message === 'string' && payload.message.trim() ? payload.message : 'New notification';
        const browserNotification = new Notification(title, {
          body: payload.source_project_id ? 'In project' : 'Eshaan OS',
          tag: message.notification?.notification_id || undefined,
          icon: '/favicon.ico',
        });
        browserNotification.onclick = () => {
          window.focus();
          browserNotification.close();
        };
      }
    });
  }, [accessToken]);

  const closeQuickNav = useCallback(() => {
    setQuickNavOpen(false);
    setQuickNavQuery('');
    setQuickNavActiveIndex(-1);
  }, []);

  const closeCapturePanel = useCallback((options?: { restoreFocus?: boolean }) => {
    skipCaptureFocusRestoreRef.current = options?.restoreFocus === false;
    setCaptureOpen(false);
  }, []);

  const resetSearch = useCallback(() => {
    searchRequestVersionRef.current += 1;
    searchDismissedRef.current = true;
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSearchLoading(false);
    setSearchOpen(false);
    setSearchActiveIndex(-1);
  }, []);

  const closeSearch = useCallback(() => {
    searchDismissedRef.current = true;
    setSearchOpen(false);
    setSearchActiveIndex(-1);
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (quickNavOpen && quickNavRef.current && !quickNavRef.current.contains(target)) {
        closeQuickNav();
      }
      if (searchOpen && searchRef.current && !searchRef.current.contains(target)) {
        closeSearch();
      }
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (contextMenuOpen && contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        setContextMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCapturePanel();
        closeSearch();
        closeQuickNav();
        setProfileOpen(false);
        setNotificationsOpen(false);
        setContextMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeCapturePanel, closeQuickNav, closeSearch, contextMenuOpen, notificationsOpen, profileOpen, quickNavOpen, searchOpen]);

  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

  const quickNavItems = useMemo(() => {
    const tabItems = visibleTabs.map((tab) => ({ id: tab.to, label: tab.label, href: tab.to }));
    const projectItems = projects.map((project) => ({
      id: `project-${project.id}`,
      label: project.name,
      href: `/projects/${project.id}/overview`,
    }));
    const allItems = [...tabItems, ...projectItems];

    const query = quickNavQuery.trim().toLowerCase();
    if (!query) {
      return allItems;
    }
    return allItems.filter((item) => item.label.toLowerCase().includes(query));
  }, [projects, quickNavQuery, visibleTabs]);

  const normalizedQuickNavActiveIndex =
    quickNavItems.length === 0 || quickNavActiveIndex < 0 || quickNavActiveIndex >= quickNavItems.length
      ? quickNavItems.length === 0
        ? -1
        : 0
      : quickNavActiveIndex;

  const normalizedSearchActiveIndex =
    !searchOpen || searchLoading || searchResults.length === 0
      ? -1
      : searchActiveIndex < 0 || searchActiveIndex >= searchResults.length
        ? 0
        : searchActiveIndex;

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    const requestVersion = searchRequestVersionRef.current + 1;
    searchRequestVersionRef.current = requestVersion;

    if (!accessToken || !trimmedQuery) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      setSearchOpen(false);
      setSearchActiveIndex(-1);
      return;
    }

    searchDismissedRef.current = false;
    setSearchLoading(true);
    setSearchError(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await searchHub(accessToken, trimmedQuery, { limit: 20 });
          if (searchRequestVersionRef.current !== requestVersion) {
            return;
          }
          setSearchResults(response.results);
          setSearchError(null);
          if (searchDismissedRef.current) {
            return;
          }
          setSearchOpen(true);
          setSearchActiveIndex(response.results.length > 0 ? 0 : -1);
        } catch {
          if (searchRequestVersionRef.current !== requestVersion) {
            return;
          }
          setSearchResults([]);
          setSearchError('Search is temporarily unavailable.');
          if (searchDismissedRef.current) {
            return;
          }
          setSearchOpen(true);
          setSearchActiveIndex(-1);
        } finally {
          if (searchRequestVersionRef.current === requestVersion) {
            setSearchLoading(false);
          }
        }
      })();
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [accessToken, searchQuery]);

  useEffect(() => {
    if (!quickNavOpen) {
      return;
    }

    const onQuickNavKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setQuickNavActiveIndex((current) => {
          if (quickNavItems.length === 0) {
            return -1;
          }
          const nextIndex = current < 0 ? 0 : current + 1;
          return nextIndex >= quickNavItems.length ? 0 : nextIndex;
        });
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setQuickNavActiveIndex((current) => {
          if (quickNavItems.length === 0) {
            return -1;
          }
          if (current <= 0) {
            return quickNavItems.length - 1;
          }
          return current - 1;
        });
        return;
      }

      if (event.key === 'Enter' && normalizedQuickNavActiveIndex >= 0 && quickNavItems[normalizedQuickNavActiveIndex]) {
        event.preventDefault();
        skipQuickNavFocusRestoreRef.current = true;
        navigate(quickNavItems[normalizedQuickNavActiveIndex].href);
        closeQuickNav();
        return;
      }

      if (event.key.length === 1 && !isTextInputElement(event.target)) {
        event.preventDefault();
        setQuickNavQuery((current) => `${current}${event.key}`);
      }
    };

    document.addEventListener('keydown', onQuickNavKeyDown);
    return () => {
      document.removeEventListener('keydown', onQuickNavKeyDown);
    };
  }, [closeQuickNav, navigate, normalizedQuickNavActiveIndex, quickNavItems, quickNavOpen]);

  useEffect(() => {
    if (quickNavOpen) {
      focusElementSoon(quickNavInputRef.current);
    } else if (
      quickNavWasOpenRef.current
      && !skipQuickNavFocusRestoreRef.current
      && !searchOpen
      && !notificationsOpen
      && !profileOpen
      && !contextMenuOpen
      && !captureOpen
    ) {
      focusElementSoon(quickNavTriggerRef.current);
    }
    if (!quickNavOpen) {
      skipQuickNavFocusRestoreRef.current = false;
    }
    quickNavWasOpenRef.current = quickNavOpen;
  }, [captureOpen, contextMenuOpen, notificationsOpen, profileOpen, quickNavOpen, searchOpen]);

  useEffect(() => {
    if (notificationsOpen) {
      focusFirstDescendantSoon(
        notificationsPanelRef.current,
        'button:not([disabled]), select:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
    } else if (
      notificationsWereOpenRef.current
      && !skipNotificationsFocusRestoreRef.current
      && !searchOpen
      && !quickNavOpen
      && !profileOpen
      && !contextMenuOpen
      && !captureOpen
    ) {
      focusElementSoon(notificationsTriggerRef.current);
    }
    if (!notificationsOpen) {
      skipNotificationsFocusRestoreRef.current = false;
    }
    notificationsWereOpenRef.current = notificationsOpen;
  }, [captureOpen, contextMenuOpen, notificationsOpen, profileOpen, quickNavOpen, searchOpen]);

  useEffect(() => {
    if (profileOpen) {
      focusFirstDescendantSoon(profileMenuRef.current, '[role="menuitem"]');
    } else if (
      profileWasOpenRef.current
      && !skipProfileFocusRestoreRef.current
      && !searchOpen
      && !quickNavOpen
      && !notificationsOpen
      && !contextMenuOpen
      && !captureOpen
    ) {
      focusElementSoon(profileTriggerRef.current);
    }
    if (!profileOpen) {
      skipProfileFocusRestoreRef.current = false;
    }
    profileWasOpenRef.current = profileOpen;
  }, [captureOpen, contextMenuOpen, notificationsOpen, profileOpen, quickNavOpen, searchOpen]);

  useEffect(() => {
    if (contextMenuOpen) {
      focusFirstDescendantSoon(contextMenuRef.current, '[role="menuitem"]');
    } else if (
      contextMenuWasOpenRef.current
      && !skipContextMenuFocusRestoreRef.current
      && !searchOpen
      && !quickNavOpen
      && !notificationsOpen
      && !profileOpen
      && !captureOpen
    ) {
      focusElementSoon(contextMenuTriggerRef.current);
    }
    if (!contextMenuOpen) {
      skipContextMenuFocusRestoreRef.current = false;
    }
    contextMenuWasOpenRef.current = contextMenuOpen;
  }, [captureOpen, contextMenuOpen, notificationsOpen, profileOpen, quickNavOpen, searchOpen]);

  const visibleNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (notifFilter === 'unread' && notification.read) {
        return false;
      }
      if (notifProjectFilter && notification.projectId !== notifProjectFilter) {
        return false;
      }
      return true;
    });
  }, [notifFilter, notifProjectFilter, notifications]);

  const onMarkNotificationRead = async (notificationId: string) => {
    if (!accessToken) {
      return;
    }

    try {
      await markNotificationRead(accessToken, notificationId);
      setNotifications((current) =>
        current.map((notification) => (notification.id === notificationId ? { ...notification, read: true } : notification)),
      );
    } catch {
      const restored = await refreshNotifications();
      if (restored) {
        setNotifications(restored);
      }
    }
  };

  const onNavigateNotification = async (notification: ToolbarNotification) => {
    navigate(notification.href);
    skipNotificationsFocusRestoreRef.current = true;
    setNotificationsOpen(false);
    if (!notification.read) {
      await onMarkNotificationRead(notification.id);
    }
  };

  const openCapturePanel = useCallback((intent: string | null, restoreTarget?: HTMLElement | null) => {
    captureRestoreTargetRef.current = restoreTarget ?? captureTriggerRef.current;
    skipCaptureFocusRestoreRef.current = false;
    setCaptureIntent(intent && intent !== 'inbox' ? intent : null);
    setCaptureActivationKey((current) => current + 1);
    setCaptureOpen(true);
    closeSearch();
    closeQuickNav();
    setProfileOpen(false);
    setNotificationsOpen(false);
    setContextMenuOpen(false);
  }, [closeQuickNav, closeSearch]);

  const onQuickCapture = () => {
    if (captureOpen && !captureIntent) {
      closeCapturePanel();
      return;
    }
    openCapturePanel(null, captureTriggerRef.current);
  };

  const focusQuickAddMenuItem = useCallback((index: number) => {
    const itemCount = QUICK_ADD_OPTIONS.length;
    if (itemCount === 0) {
      return;
    }
    const normalized = (index + itemCount) % itemCount;
    setQuickAddActiveIndex(normalized);
    focusElementSoon(quickAddItemRefs.current[normalized]);
  }, []);

  const toggleQuickAddMenu = useCallback(() => {
    setContextMenuOpen((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        setQuickAddActiveIndex(0);
      }
      return nextOpen;
    });
    closeCapturePanel({ restoreFocus: false });
    setNotificationsOpen(false);
    setProfileOpen(false);
    closeSearch();
    closeQuickNav();
  }, [closeCapturePanel, closeQuickNav, closeSearch]);

  const onSelectQuickAddOption = useCallback((option: QuickAddOption) => {
    skipContextMenuFocusRestoreRef.current = true;
    setContextMenuOpen(false);
    void openQuickAddDialog(option.key);
  }, [openQuickAddDialog]);

  const onQuickAddMenuItemKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusQuickAddMenuItem(index + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusQuickAddMenuItem(index - 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusQuickAddMenuItem(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusQuickAddMenuItem(QUICK_ADD_OPTIONS.length - 1);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setContextMenuOpen(false);
    }
  }, [focusQuickAddMenuItem]);

  const onSelectSearchResult = useCallback(
    (result: HubSearchResult) => {
      const href = buildSearchResultHref(result);
      if (!href) {
        return;
      }
      navigate(href);
      resetSearch();
      skipQuickNavFocusRestoreRef.current = true;
      closeQuickNav();
      setNotificationsOpen(false);
      setProfileOpen(false);
      setContextMenuOpen(false);
      closeCapturePanel({ restoreFocus: false });
    },
    [closeCapturePanel, closeQuickNav, navigate, resetSearch],
  );

  const accountInitials = sessionInitials(sessionSummary.name, sessionSummary.email, sessionSummary.userId);
  const avatarUrl = buildAccountAvatarUrl(accountInitials, sessionSummary.userId || sessionSummary.email || sessionSummary.name);

  return (
    <div className="flex h-screen flex-col bg-surface text-text">
      <header className="sr-only">
        <h1>Hub workspace</h1>
      </header>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[200] focus:rounded-control focus:bg-surface-elevated focus:px-md focus:py-sm focus:text-text focus:ring-2 focus:ring-focus-ring"
      >
        Skip to main content
      </a>

      <main id="main-content" className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
      </main>

      <footer>
        <nav
          aria-label="App toolbar"
          className="relative flex h-12 shrink-0 items-center gap-sm border-t border-border-muted bg-surface-elevated px-md"
        >
        <div className="mr-sm flex min-w-0 items-center gap-xs">
          {!isOnHubHome ? (
            <button
              type="button"
              onClick={() => navigate('/projects')}
              aria-label="Go home"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 7l6-5 6 5v7H10v-4H6v4H2V7z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}

          {breadcrumb.length > 0 ? (
            <span className="truncate text-xs text-muted" aria-label={`Current location: ${breadcrumb.join(' › ')}`}>
              {breadcrumb.join(' › ')}
            </span>
          ) : null}
        </div>

        <div className="relative" ref={quickNavRef}>
          <button
            ref={quickNavTriggerRef}
            type="button"
            onClick={() => {
              if (quickNavOpen) {
                closeQuickNav();
              } else {
                setQuickNavOpen(true);
                setQuickNavActiveIndex(quickNavItems.length > 0 ? 0 : -1);
              }
              closeSearch();
              setProfileOpen(false);
              setNotificationsOpen(false);
              setContextMenuOpen(false);
              closeCapturePanel({ restoreFocus: false });
            }}
            aria-label="Quick navigation"
            aria-expanded={quickNavOpen}
            className="flex h-7 items-center gap-xs rounded-control border border-border-muted px-sm text-[13px] text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            style={{
              background: quickNavOpen ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent',
            }}
          >
            <Icon name="menu" className="text-[14px]" />
            Nav
          </button>

          {quickNavOpen ? (
            <div
              role="dialog"
              aria-label="Quick navigation"
              className="absolute bottom-[calc(100%+8px)] left-0 z-[100] w-72 overflow-hidden rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
            >
              <input
                ref={quickNavInputRef}
                type="search"
                value={quickNavQuery}
                onChange={(event) => {
                  setQuickNavQuery(event.target.value);
                  setQuickNavActiveIndex(0);
                }}
                placeholder="Jump to…"
                aria-label="Navigate to a location"
                className="w-full border-b border-border-muted bg-transparent px-md py-sm text-sm text-text outline-none"
              />
              <ul className="max-h-72 overflow-y-auto py-1">
                {quickNavItems.length === 0 ? (
                  <li className="px-md py-sm text-sm text-muted">No matching destinations</li>
                ) : (
                  quickNavItems.map((item, index) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="w-full px-md py-sm text-left text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        style={{
                          background:
                            normalizedQuickNavActiveIndex === index
                              ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                              : 'transparent',
                        }}
                        onMouseEnter={() => setQuickNavActiveIndex(index)}
                        onClick={() => {
                          skipQuickNavFocusRestoreRef.current = true;
                          navigate(item.href);
                          closeQuickNav();
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mx-auto w-full max-w-xs flex-1" ref={searchRef}>
          <div className="relative">
            <input
              type="search"
              role="combobox"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchActiveIndex(0);
              }}
              onFocus={() => {
                if (searchQuery.trim()) {
                  searchDismissedRef.current = false;
                  setSearchOpen(true);
                }
                closeQuickNav();
                setProfileOpen(false);
                setNotificationsOpen(false);
                setContextMenuOpen(false);
                closeCapturePanel({ restoreFocus: false });
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  if (!searchOpen) {
                    setSearchOpen(true);
                  }
                  setSearchActiveIndex((current) => {
                    if (searchResults.length === 0) {
                      return -1;
                    }
                    const nextIndex = current < 0 ? 0 : current + 1;
                    return nextIndex >= searchResults.length ? 0 : nextIndex;
                  });
                  return;
                }

                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  if (!searchOpen) {
                    setSearchOpen(true);
                  }
                  setSearchActiveIndex((current) => {
                    if (searchResults.length === 0) {
                      return -1;
                    }
                    if (current <= 0) {
                      return searchResults.length - 1;
                    }
                    return current - 1;
                  });
                  return;
                }

                if (
                  searchOpen && !searchLoading &&
                  event.key === 'Enter' &&
                  normalizedSearchActiveIndex >= 0 &&
                  searchResults[normalizedSearchActiveIndex]
                ) {
                  event.preventDefault();
                  onSelectSearchResult(searchResults[normalizedSearchActiveIndex]);
                  return;
                }

                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeSearch();
                }
              }}
              placeholder="Search..."
              aria-label="Global search"
              aria-autocomplete="list"
              aria-controls="global-search-results"
              aria-activedescendant={normalizedSearchActiveIndex >= 0 ? `search-result-${normalizedSearchActiveIndex}` : undefined}
              aria-expanded={searchOpen}
              className="h-7 w-full rounded-control border border-border-muted bg-surface px-sm pr-16 text-[13px] text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-sm flex items-center text-[11px] text-muted"
              aria-hidden="true"
            >
              {searchLoading ? 'Searching…' : ''}
            </div>

            {searchOpen ? (
              <div
                role="dialog"
                aria-label="Global search results"
                className="absolute bottom-[calc(100%+8px)] left-0 z-[100] w-full overflow-hidden rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
              >
                {searchLoading ? (
                  <div className="px-md py-sm text-sm text-muted">Searching…</div>
                ) : (
                  <ul id="global-search-results" role="listbox" className="max-h-72 overflow-y-auto py-1">
                    {searchError ? (
                      <li className="px-md py-sm text-sm text-danger">{searchError}</li>
                    ) : searchResults.length === 0 ? (
                      <li className="px-md py-sm text-sm text-muted">No results</li>
                    ) : (
                      searchResults.map((result, index) => {
                        const href = buildSearchResultHref(result);
                        const disabled = !href;
                        return (
                          <li
                            key={`${result.type}:${result.id}`}
                            id={`search-result-${index}`}
                            role="option"
                            aria-selected={normalizedSearchActiveIndex === index}
                          >
                            <button
                              type="button"
                              disabled={disabled}
                              aria-disabled={disabled}
                              className="w-full px-md py-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
                              style={{
                                background:
                                  normalizedSearchActiveIndex === index
                                    ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                                    : 'transparent',
                              }}
                              onMouseEnter={() => {
                                if (!disabled) {
                                  setSearchActiveIndex(index);
                                }
                              }}
                              onClick={() => {
                                if (href) {
                                  onSelectSearchResult(result);
                                }
                              }}
                            >
                              <div className="flex items-center gap-sm">
                                <span className="rounded-full border border-border-muted px-2 py-[2px] text-[10px] uppercase tracking-[0.12em] text-muted">
                                  {SEARCH_RESULT_TYPE_LABELS[result.type]}
                                </span>
                                <span className={`truncate text-sm ${disabled ? 'text-muted' : 'text-text'}`}>{result.title}</span>
                              </div>
                              {result.type === 'record' || result.type === 'pane' ? (
                                <div className="mt-1 text-xs text-muted">
                                  {result.project_name || 'Unknown project'}
                                  {result.type === 'record' && result.content_type && result.content_type !== 'record'
                                    ? ` • ${result.content_type}`
                                    : ''}
                                </div>
                              ) : null}
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative" ref={contextMenuRef}>
          <button
            ref={contextMenuTriggerRef}
            type="button"
            aria-label="Open quick add menu"
            aria-haspopup="menu"
            aria-expanded={contextMenuOpen}
            onClick={toggleQuickAddMenu}
            className="flex h-7 w-7 items-center justify-center rounded-control border border-border-muted text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Icon name="plus" className="text-[14px]" />
          </button>

          {contextMenuOpen ? (
            <div
              role="menu"
              aria-label="Quick add"
              className="absolute bottom-[calc(100%+8px)] left-0 z-[200] min-w-[220px] rounded-control border border-border-muted bg-surface-elevated py-1 shadow-soft"
            >
              {QUICK_ADD_OPTIONS.map((option, index) => (
                <button
                  key={option.key}
                  ref={(node) => {
                    quickAddItemRefs.current[index] = node;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={quickAddActiveIndex === index ? 0 : -1}
                  className="flex w-full items-center gap-2 px-md py-xs text-left text-sm text-text hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  style={{
                    background:
                      quickAddActiveIndex === index ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                  }}
                  onMouseEnter={() => setQuickAddActiveIndex(index)}
                  onKeyDown={(event) => onQuickAddMenuItemKeyDown(event, index)}
                  onClick={() => onSelectQuickAddOption(option)}
                >
                  <Icon name={option.iconName} className="text-[14px] text-primary" />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Popover open={captureOpen} onOpenChange={setCaptureOpen} modal>
          <PopoverAnchor asChild>
            <button
              ref={captureTriggerRef}
              type="button"
              onClick={onQuickCapture}
              aria-label="Thought Pile"
              aria-expanded={captureOpen}
              className="flex h-7 w-7 items-center justify-center rounded-control border border-border-muted text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <Icon name="thought-pile" className="text-[14px]" />
            </button>
          </PopoverAnchor>

          {captureOpen ? (
            <PopoverContent
              side="top"
              align="center"
              sideOffset={8}
              role="dialog"
              aria-label="Thought Pile"
              className="z-[120] w-[min(92vw,440px)] rounded-panel border border-border-muted bg-surface-elevated p-4 shadow-soft"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (skipCaptureFocusRestoreRef.current) {
                  skipCaptureFocusRestoreRef.current = false;
                  return;
                }
                const restoreTarget = captureRestoreTargetRef.current;
                if (restoreTarget?.isConnected) {
                  restoreTarget.focus();
                }
              }}
            >
              <QuickCapturePanel
                accessToken={accessToken ?? null}
                projects={projects}
                personalProjectId={captureHomeData.personalProjectId}
                captures={captureHomeData.captures}
                capturesLoading={captureLoading}
                onCaptureComplete={() => void refreshCaptureData()}
                preferredProjectId={preferredCaptureProjectId}
                initialIntent={captureIntent}
                activationKey={captureActivationKey}
                onRequestClose={(options) => closeCapturePanel(options)}
              />
            </PopoverContent>
          ) : null}
        </Popover>

        <TaskCreateDialog
          open={quickAddDialog === 'task'}
          onClose={closeQuickAddDialog}
          onCreated={closeQuickAddDialog}
          accessToken={accessToken ?? ''}
          projectId={quickAddProjectId}
          tasksCollectionId={selectedTaskCollectionId}
          projectMembers={selectedTaskProjectMembers.map((member) => ({
            user_id: member.user_id,
            display_name: member.display_name,
          }))}
          triggerRef={contextMenuTriggerRef}
          projectOptions={quickAddProjectOptions}
          selectedProjectId={quickAddProjectId}
          titleInputRef={taskTitleInputRef}
          onSelectedProjectIdChange={(projectId) => {
            setQuickAddProjectId(projectId);
            void loadTaskProjectMetadata(projectId);
          }}
        />

        <Dialog
          open={quickAddDialog === 'event'}
          onClose={closeQuickAddDialog}
          triggerRef={contextMenuTriggerRef}
          title="New Calendar Event"
          description="Create a calendar event."
        >
          <form className="space-y-4" onSubmit={onCreateQuickAddEvent}>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-event-project">
                Project
              </label>
              <select
                id="quick-add-event-project"
                ref={eventProjectSelectRef}
                value={quickAddProjectId}
                onChange={(event) => setQuickAddProjectId(event.target.value)}
                className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
              >
                {quickAddProjectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-event-title">
                Event title
              </label>
              <input
                id="quick-add-event-title"
                type="text"
                value={eventTitle}
                onChange={(event) => setEventTitle(event.target.value)}
                className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                placeholder="New event"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-event-start">
                  Start
                </label>
                <input
                  id="quick-add-event-start"
                  type="datetime-local"
                  value={eventStartAt}
                  onChange={(event) => setEventStartAt(event.target.value)}
                  className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-event-end">
                  End
                </label>
                <input
                  id="quick-add-event-end"
                  type="datetime-local"
                  value={eventEndAt}
                  onChange={(event) => setEventEndAt(event.target.value)}
                  className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                />
              </div>
            </div>

            {eventError ? <p className="text-sm text-danger">{eventError}</p> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeQuickAddDialog}
                className="rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={eventSubmitting}
                className="rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {eventSubmitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </Dialog>

        <Dialog
          open={quickAddDialog === 'reminder'}
          onClose={closeQuickAddDialog}
          triggerRef={contextMenuTriggerRef}
          title="New Reminder"
          description="Create a reminder from natural language."
        >
          <form className="space-y-4" onSubmit={onCreateQuickAddReminder}>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-reminder-project">
                Project
              </label>
              <select
                id="quick-add-reminder-project"
                ref={reminderProjectSelectRef}
                value={quickAddProjectId}
                onChange={(event) => setQuickAddProjectId(event.target.value)}
                className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
              >
                {quickAddProjectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-reminder-input">
                Reminder
              </label>
              <input
                id="quick-add-reminder-input"
                ref={reminderInputRef}
                type="text"
                value={reminderDraft}
                onChange={(event) => {
                  setReminderDraft(event.target.value);
                  if (reminderError) {
                    setReminderError(null);
                  }
                }}
                placeholder="Add a reminder…"
                className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
              />
            </div>

            {hasMeaningfulReminderPreview(reminderPreview) ? (
              <div className="rounded-panel border border-border-muted bg-surface px-3 py-2 text-xs text-text-secondary">
                {reminderPreview.title ? <p><span className="font-semibold text-text">Title:</span> {reminderPreview.title}</p> : null}
                {reminderPreview.remind_at ? <p><span className="font-semibold text-text">When:</span> {reminderPreview.context_hint || reminderPreview.remind_at}</p> : null}
                {reminderPreview.recurrence ? <p><span className="font-semibold text-text">Recurs:</span> {reminderPreview.recurrence.frequency}</p> : null}
              </div>
            ) : null}

            {reminderError ? <p className="text-sm text-danger">{reminderError}</p> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeQuickAddDialog}
                className="rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reminderSubmitting}
                className="rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reminderSubmitting ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        </Dialog>

        <Dialog
          open={quickAddDialog === 'project'}
          onClose={closeQuickAddDialog}
          triggerRef={contextMenuTriggerRef}
          title="Create Project"
          description="Create a new project."
        >
          <form className="space-y-4" onSubmit={onCreateQuickAddProject}>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="quick-add-project-name">
                Project name
              </label>
              <input
                id="quick-add-project-name"
                ref={projectNameInputRef}
                type="text"
                value={projectDialogName}
                onChange={(event) => setProjectDialogName(event.target.value)}
                className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                placeholder="New project"
              />
            </div>

            {projectDialogError ? <p className="text-sm text-danger">{projectDialogError}</p> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeQuickAddDialog}
                className="rounded-control border border-border-muted px-3 py-2 text-sm font-medium text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={projectDialogSubmitting}
                className="rounded-control bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {projectDialogSubmitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </Dialog>

        <div className="relative" ref={notificationsRef}>
          <button
            ref={notificationsTriggerRef}
            type="button"
            onClick={() => {
              setNotificationsOpen((current) => !current);
              setProfileOpen(false);
              closeSearch();
              closeQuickNav();
              setContextMenuOpen(false);
              closeCapturePanel({ restoreFocus: false });
            }}
            aria-label={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : 'Notifications'}
            className="relative flex h-9 w-9 items-center justify-center rounded-control text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Icon
              name={unreadNotifications > 0 ? 'bell-unread' : 'bell-read'}
              className="text-[18px]"
            />
            {unreadNotifications > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary"
                style={{ boxShadow: '0 0 0 1.5px var(--color-surface), 0 0 0 3px var(--color-primary)' }}
              />
            ) : null}
          </button>

          {notificationsOpen ? (
            <div
              ref={notificationsPanelRef}
              role="dialog"
              aria-label="Notifications"
              className="absolute bottom-[calc(100%+8px)] right-0 z-[100] w-[360px] rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
            >
              <div className="flex items-center gap-sm border-b border-border-muted px-md py-sm">
                {(['unread', 'all'] as NotificationFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setNotifFilter(filter)}
                    className="text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    style={{
                      fontWeight: notifFilter === filter ? 500 : 400,
                      color: notifFilter === filter ? 'var(--color-text)' : 'var(--color-muted)',
                      borderBottom: notifFilter === filter ? '2px solid var(--color-primary)' : '2px solid transparent',
                    }}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}

                <select
                  value={notifProjectFilter ?? ''}
                  onChange={(event) => setNotifProjectFilter(event.target.value || null)}
                  aria-label="Filter by project"
                  className="ml-auto rounded-control border border-border-muted bg-surface-elevated px-xs py-[2px] text-xs text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <option value="">All projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <ul className="max-h-[420px] list-none overflow-y-auto p-0">
                {visibleNotifications.length === 0 ? (
                  <li className="px-xl py-xl text-center text-sm text-muted">
                    {notifFilter === 'unread' ? "You're all caught up." : 'No notifications yet.'}
                  </li>
                ) : (
                  visibleNotifications.map((notification) => (
                    <li
                      key={notification.id}
                      className="group flex items-start gap-sm border-b border-border-muted px-md py-sm last:border-b-0"
                      style={{
                        background: notification.read
                          ? 'transparent'
                          : 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onNavigateNotification(notification)}
                        className="min-w-0 flex flex-1 items-start gap-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <div
                          aria-hidden="true"
                          className="mt-[2px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-on-primary"
                          style={{ background: notification.avatarColor }}
                        >
                          {notification.authorInitial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text">{notification.summary}</p>
                          <p className="mt-[2px] line-clamp-2 text-[13px] text-muted">{notification.body}</p>
                        </div>
                      </button>

                      <div className="flex shrink-0 flex-col items-end gap-xs">
                        <span className="text-xs text-muted" title={new Date(notification.createdAt).toLocaleString()}>
                          {relativeTimeLabel(notification.createdAt)}
                        </span>

                        <div className="flex">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                            }}
                            aria-disabled="true"
                            aria-label="Add to reminders. Coming soon."
                            title="Coming soon."
                            className="cursor-not-allowed rounded-control border border-border-muted px-2 py-1 text-xs text-muted opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          >
                            Add to reminders
                          </button>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            ref={profileTriggerRef}
            type="button"
            onClick={() => {
              setProfileOpen((current) => !current);
              setNotificationsOpen(false);
              closeSearch();
              closeQuickNav();
              setContextMenuOpen(false);
              closeCapturePanel({ restoreFocus: false });
            }}
            aria-label="Account menu"
            aria-expanded={profileOpen}
            className="h-7 w-7 overflow-hidden rounded-full border-2 border-transparent bg-muted p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            style={{ borderColor: profileOpen ? 'var(--color-primary)' : 'transparent' }}
          >
            {avatarBroken ? (
              <span className="flex h-full w-full items-center justify-center text-text">
                <Icon name="user" className="text-[16px]" />
              </span>
            ) : (
              <img
                src={avatarUrl}
                alt={sessionSummary.name}
                className="h-full w-full object-cover"
                onError={() => setAvatarBroken(true)}
              />
            )}
          </button>

          {profileOpen ? (
            <div
              ref={profileMenuRef}
              role="menu"
              className="absolute bottom-[calc(100%+8px)] right-0 z-[100] w-56 overflow-hidden rounded-panel border border-border-muted bg-surface-elevated shadow-soft"
            >
              <div className="flex items-center gap-sm border-b border-border-muted px-md py-md">
                {avatarBroken ? (
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-text"
                  >
                    <Icon name="user" className="text-[18px]" />
                  </span>
                ) : (
                  <img src={avatarUrl} alt="" aria-hidden="true" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{sessionSummary.name}</p>
                  <p className="truncate text-xs text-muted">{sessionSummary.email}</p>
                </div>
              </div>

              <button
                type="button"
                role="menuitem"
                className="block w-full px-md py-sm text-left text-sm text-text hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                onClick={() => {
                  skipProfileFocusRestoreRef.current = true;
                  navigate('/projects');
                  setProfileOpen(false);
                }}
              >
                Projects
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-md py-sm text-left text-sm text-danger hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                onClick={() => {
                  skipProfileFocusRestoreRef.current = true;
                  void signOut();
                  setProfileOpen(false);
                }}
              >
                Log out
              </button>
            </div>
          ) : null}
        </div>
        </nav>
      </footer>
      <div className="sr-only" aria-live="polite">
        {captureAnnouncement}
      </div>
    </div>
  );
};
