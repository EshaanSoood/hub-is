import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthz } from '../../context/AuthzContext';
import { appTabs } from '../../lib/policy';
import { useProjects } from '../../context/ProjectsContext';
import { QuickCapturePanel } from '../../features/QuickCapture';
import { TaskCreateDialog } from '../project-space/TaskCreateDialog';
import { useRouteFocusReset } from '../../hooks/useRouteFocusReset';
import { useRemindersRuntime } from '../../hooks/useRemindersRuntime';
import { usePersonalCalendarRuntime } from '../../hooks/usePersonalCalendarRuntime';
import { listNotifications, markNotificationRead } from '../../services/hub/notifications';
import { createEventFromNlp, createTask, getHubHome, queryTasks } from '../../services/hub/records';
import { createReminder, updateReminder, type CreateReminderPayload } from '../../services/hub/reminders';
import { listProjectMembers } from '../../services/hub/projects';
import { searchHub, type HubSearchResult } from '../../services/hub/search';
import type { HubProjectMember, HubTaskSummary } from '../../services/hub/types';
import { subscribeHubLive } from '../../services/hubLive';
import { requestHubHomeRefresh } from '../../lib/hubHomeRefresh';
import { subscribeQuickAddProjectRequest } from '../../lib/quickAddProjectRequest';
import { parseReminderInput, type ReminderParseResult } from '../../lib/nlp/reminder-parser';
import { createHubProject } from '../../services/projectsService';
import { CalendarModuleSkin, type CalendarScope } from '../project-space/CalendarModuleSkin';
import { RemindersModuleSkin } from '../project-space/RemindersModuleSkin';
import { TasksModuleSkin } from '../project-space/TasksModuleSkin';
import { adaptTaskSummaries } from '../project-space/taskAdapter';
import { Dialog, Icon, Popover, PopoverAnchor, PopoverContent } from '../primitives';
import { NotificationsPanel } from './NotificationsPanel';
import { ProfileMenu } from './ProfileMenu';
import { QuickAddEventDialog, QuickAddProjectDialog, QuickAddReminderDialog } from './QuickAddDialogs';
import {
  buildAccountAvatarUrl,
  buildBreadcrumb,
  buildSearchResultHref,
  emptyReminderPreview,
  focusElementSoon,
  focusFirstDescendantSoon,
  isTextInputElement,
  nowPlusHours,
  parseIsoTimestamp,
  QUICK_ADD_OPTIONS,
  QUICK_NAV_FIXED_ITEMS,
  SEARCH_RESULT_TYPE_LABELS,
  sessionInitials,
  toDateTimeLocalInput,
  tomorrowAtNineIso,
  toToolbarNotification,
  type NotificationFilter,
  type QuickAddDialog,
  type QuickAddOption,
  type QuickNavActionItem,
  type ToolbarDialog,
  type ToolbarNotification,
} from './appShellUtils';

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
  const [toolbarDialog, setToolbarDialog] = useState<ToolbarDialog>(null);
  const [quickNavTasks, setQuickNavTasks] = useState<HubTaskSummary[]>([]);
  const [quickNavTasksLoading, setQuickNavTasksLoading] = useState(false);
  const [quickNavTasksError, setQuickNavTasksError] = useState<string | null>(null);
  const remindersDialogOpen = toolbarDialog === 'reminders';
  const calendarDialogOpen = toolbarDialog === 'calendar';
  const {
    calendarEvents: personalCalendarEvents,
    calendarLoading: personalCalendarLoading,
    calendarError: personalCalendarError,
    calendarMode: personalCalendarMode,
    setCalendarMode: setPersonalCalendarMode,
    refreshCalendar: refreshPersonalCalendar,
  } = usePersonalCalendarRuntime(accessToken ?? null, { autoload: calendarDialogOpen });
  const remindersRuntime = useRemindersRuntime(accessToken ?? null, {
    autoload: remindersDialogOpen,
    subscribeToHomeRefresh: remindersDialogOpen,
    subscribeToLive: remindersDialogOpen,
  });

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
  const eventTitleInputRef = useRef<HTMLInputElement | null>(null);
  const reminderInputRef = useRef<HTMLInputElement | null>(null);
  const projectNameInputRef = useRef<HTMLInputElement | null>(null);
  const captureRequestVersionRef = useRef(0);
  const quickNavTasksRequestVersionRef = useRef(0);
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
  const personalReminderProjectLabel = useMemo(
    () => projects.find((project) => project.isPersonal)?.name || 'Personal',
    [projects],
  );
  const selectedTaskProjectMembers = useMemo(
    () => taskProjectMembersById[quickAddProjectId] ?? [],
    [quickAddProjectId, taskProjectMembersById],
  );
  const adaptedTasks = useMemo(() => adaptTaskSummaries(quickNavTasks), [quickNavTasks]);

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

  const refreshQuickNavTasks = useCallback(async () => {
    if (!accessToken) {
      quickNavTasksRequestVersionRef.current += 1;
      setQuickNavTasks([]);
      setQuickNavTasksLoading(false);
      setQuickNavTasksError(null);
      return;
    }

    const requestVersion = quickNavTasksRequestVersionRef.current + 1;
    quickNavTasksRequestVersionRef.current = requestVersion;
    setQuickNavTasksLoading(true);
    setQuickNavTasksError(null);
    try {
      const nextTasks: HubTaskSummary[] = [];
      let nextCursor: string | undefined;
      const seenCursors = new Set<string>();

      for (let page = 0; page < 100; page += 1) {
        if (quickNavTasksRequestVersionRef.current !== requestVersion) {
          return;
        }
        const taskPage = await queryTasks(
          accessToken,
          nextCursor
            ? {
                lens: 'assigned',
                limit: 200,
                cursor: nextCursor,
              }
            : {
                lens: 'assigned',
                limit: 200,
              },
        );
        nextTasks.push(...taskPage.tasks);

        if (!taskPage.next_cursor || seenCursors.has(taskPage.next_cursor)) {
          break;
        }
        seenCursors.add(taskPage.next_cursor);
        nextCursor = taskPage.next_cursor;
      }

      if (quickNavTasksRequestVersionRef.current !== requestVersion) {
        return;
      }

      const nextItems = [...nextTasks].sort((left, right) => {
        const leftDue = parseIsoTimestamp(left.task_state.due_at);
        const rightDue = parseIsoTimestamp(right.task_state.due_at);
        if (leftDue !== rightDue) {
          return leftDue - rightDue;
        }
        return parseIsoTimestamp(right.updated_at) - parseIsoTimestamp(left.updated_at);
      });
      setQuickNavTasks(nextItems);
    } catch (error) {
      if (quickNavTasksRequestVersionRef.current !== requestVersion) {
        return;
      }
      setQuickNavTasks([]);
      setQuickNavTasksError(error instanceof Error ? error.message : 'Failed to load tasks.');
    } finally {
      if (quickNavTasksRequestVersionRef.current === requestVersion) {
        setQuickNavTasksLoading(false);
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

  const loadTaskProjectMembers = useCallback(async (projectId: string) => {
    if (!accessToken || !projectId) {
      return;
    }
    const hasMembers = taskProjectMembersById[projectId] !== undefined;
    if (hasMembers) {
      return;
    }

    const requestVersion = quickAddTaskMetadataRequestRef.current + 1;
    quickAddTaskMetadataRequestRef.current = requestVersion;
    try {
      const members = await listProjectMembers(accessToken, projectId);
      if (quickAddTaskMetadataRequestRef.current !== requestVersion) {
        return;
      }
      setTaskProjectMembersById((current) => ({ ...current, [projectId]: members }));
    } catch {
      if (quickAddTaskMetadataRequestRef.current !== requestVersion) {
        return;
      }
    }
  }, [accessToken, taskProjectMembersById]);

  const closeQuickAddDialog = useCallback(() => {
    setQuickAddDialog(null);
    setEventError(null);
    setReminderError(null);
    setProjectDialogError(null);
  }, []);

  const closeQuickNavPanel = useCallback(() => {
    setToolbarDialog(null);
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
          void loadTaskProjectMembers(defaultProjectId);
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
    [accessToken, loadTaskProjectMembers, refreshCaptureData, resolveDefaultQuickAddProjectId],
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
      void refreshCaptureData();
      requestHubHomeRefresh();
      setQuickAddDialog(null);
    } catch (error) {
      setEventError(error instanceof Error ? error.message : 'Failed to create event.');
    } finally {
      setEventSubmitting(false);
    }
  }, [accessToken, eventEndAt, eventStartAt, eventTitle, quickAddProjectId, refreshCaptureData]);

  const onCreateQuickAddReminder = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) {
      setReminderError('An authenticated session is required.');
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const latestPreview = reminderDraft.trim() ? parseReminderInput(reminderDraft, { timezone }) : emptyReminderPreview();
    const title = latestPreview.fields.title.trim() || reminderDraft.trim();
    const remindAtRaw = latestPreview.fields.remind_at;
    if (!title || !remindAtRaw) {
      setReminderError('Add a title and time to create a reminder.');
      return;
    }
    const remindAtDate = new Date(remindAtRaw);
    if (Number.isNaN(remindAtDate.getTime())) {
      setReminderError('Reminder time is invalid.');
      return;
    }

    setReminderSubmitting(true);
    setReminderError(null);
    try {
      await createReminder(accessToken, {
        title,
        remind_at: remindAtDate.toISOString(),
        recurrence_json: latestPreview.fields.recurrence ? { ...latestPreview.fields.recurrence } : null,
      });
      void refreshCaptureData();
      requestHubHomeRefresh();
      setQuickAddDialog(null);
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Failed to create reminder.');
    } finally {
      setReminderSubmitting(false);
    }
  }, [accessToken, reminderDraft, refreshCaptureData]);

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
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timer = window.setTimeout(() => {
      setReminderPreview(reminderDraft.trim() ? parseReminderInput(reminderDraft, { timezone }) : emptyReminderPreview());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [quickAddDialog, reminderDraft]);

  useEffect(() => {
    if (quickAddDialog !== 'task' || !quickAddProjectId) {
      return;
    }
    void loadTaskProjectMembers(quickAddProjectId);
  }, [loadTaskProjectMembers, quickAddDialog, quickAddProjectId]);

  useEffect(() => {
    if (quickAddDialog === 'task') {
      focusElementSoon(taskTitleInputRef.current);
      return;
    }
    if (quickAddDialog === 'event') {
      focusElementSoon(eventTitleInputRef.current);
      return;
    }
    if (quickAddDialog === 'reminder') {
      focusElementSoon(reminderInputRef.current);
      return;
    }
    if (quickAddDialog === 'project') {
      focusElementSoon(projectNameInputRef.current);
    }
  }, [quickAddDialog]);

  useEffect(() => {
    if (toolbarDialog !== 'tasks') {
      return;
    }
    void refreshQuickNavTasks();
  }, [toolbarDialog, refreshQuickNavTasks]);

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
          body: payload.source_project_id ? 'In project' : 'Hub OS',
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

  const openQuickNavPanel = useCallback((panel: Exclude<ToolbarDialog, null>) => {
    skipProfileFocusRestoreRef.current = true;
    skipNotificationsFocusRestoreRef.current = true;
    skipContextMenuFocusRestoreRef.current = true;
    setToolbarDialog(panel);
    closeQuickNav();
    closeSearch();
    setProfileOpen(false);
    setNotificationsOpen(false);
    setContextMenuOpen(false);
    closeCapturePanel({ restoreFocus: false });
  }, [closeCapturePanel, closeQuickNav, closeSearch]);

  useEffect(() => subscribeQuickAddProjectRequest(() => {
    skipQuickNavFocusRestoreRef.current = true;
    closeQuickNav();
    skipProfileFocusRestoreRef.current = true;
    skipNotificationsFocusRestoreRef.current = true;
    skipContextMenuFocusRestoreRef.current = true;
    closeQuickNavPanel();
    closeSearch();
    setProfileOpen(false);
    setNotificationsOpen(false);
    setContextMenuOpen(false);
    closeCapturePanel({ restoreFocus: false });
    void openQuickAddDialog('project');
  }), [closeCapturePanel, closeQuickNav, closeQuickNavPanel, closeSearch, openQuickAddDialog]);

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
      if (!quickAddDialog && !isTextInputElement(event.target) && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key.toLowerCase() === 'c') {
          event.preventDefault();
          openQuickNavPanel('calendar');
          return;
        }
        if (event.key.toLowerCase() === 't') {
          event.preventDefault();
          openQuickNavPanel('tasks');
          return;
        }
        if (event.key.toLowerCase() === 'r') {
          event.preventDefault();
          openQuickNavPanel('reminders');
          return;
        }
      }
      if (event.key === 'Escape') {
        closeCapturePanel();
        closeSearch();
        closeQuickNav();
        closeQuickNavPanel();
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
  }, [closeCapturePanel, closeQuickNav, closeQuickNavPanel, closeSearch, contextMenuOpen, notificationsOpen, openQuickNavPanel, profileOpen, quickAddDialog, quickNavOpen, searchOpen]);

  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

  const quickNavDestinationItems = useMemo(() => {
    const tabItems: QuickNavActionItem[] = visibleTabs.map((tab) => ({ id: tab.to, label: tab.label, action: 'navigate', href: tab.to }));
    const projectItems = projects.map((project) => ({
      id: `project-${project.id}`,
      label: project.name,
      iconName: 'menu' as const,
      action: 'navigate' as const,
      href: `/projects/${project.id}/overview`,
    }));
    const allItems = [...tabItems, ...projectItems];

    const query = quickNavQuery.trim().toLowerCase();
    if (!query) {
      return allItems;
    }
    return allItems.filter((item) => item.label.toLowerCase().includes(query));
  }, [projects, quickNavQuery, visibleTabs]);
  const quickNavItems = useMemo(
    () => [...QUICK_NAV_FIXED_ITEMS, ...quickNavDestinationItems],
    [quickNavDestinationItems],
  );

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
        const selectedItem = quickNavItems[normalizedQuickNavActiveIndex];
        if (!selectedItem) {
          return;
        }
        skipQuickNavFocusRestoreRef.current = true;
        if (selectedItem.action === 'panel') {
          openQuickNavPanel(selectedItem.panel);
          return;
        }
        setToolbarDialog(null);
        navigate(selectedItem.href);
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
  }, [closeQuickNav, navigate, normalizedQuickNavActiveIndex, openQuickNavPanel, quickNavItems, quickNavOpen]);

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
      && !toolbarDialog
      && !quickAddDialog
    ) {
      focusElementSoon(quickNavTriggerRef.current);
    }
    if (!quickNavOpen) {
      skipQuickNavFocusRestoreRef.current = false;
    }
    quickNavWasOpenRef.current = quickNavOpen;
  }, [captureOpen, contextMenuOpen, notificationsOpen, profileOpen, quickAddDialog, quickNavOpen, searchOpen, toolbarDialog]);

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
      && !toolbarDialog
      && !quickAddDialog
    ) {
      focusElementSoon(notificationsTriggerRef.current);
    }
    if (!notificationsOpen) {
      skipNotificationsFocusRestoreRef.current = false;
    }
    notificationsWereOpenRef.current = notificationsOpen;
  }, [captureOpen, contextMenuOpen, notificationsOpen, profileOpen, quickAddDialog, quickNavOpen, searchOpen, toolbarDialog]);

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
      && !toolbarDialog
      && !quickAddDialog
    ) {
      focusElementSoon(profileTriggerRef.current);
    }
    if (!profileOpen) {
      skipProfileFocusRestoreRef.current = false;
    }
    profileWasOpenRef.current = profileOpen;
  }, [captureOpen, contextMenuOpen, notificationsOpen, profileOpen, quickAddDialog, quickNavOpen, searchOpen, toolbarDialog]);

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
      && !toolbarDialog
      && !quickAddDialog
    ) {
      focusElementSoon(contextMenuTriggerRef.current);
    }
    if (!contextMenuOpen) {
      skipContextMenuFocusRestoreRef.current = false;
    }
    contextMenuWasOpenRef.current = contextMenuOpen;
  }, [captureOpen, contextMenuOpen, notificationsOpen, profileOpen, quickAddDialog, quickNavOpen, searchOpen, toolbarDialog]);

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

  const onNavigateProjectsFromProfileMenu = useCallback(() => {
    skipProfileFocusRestoreRef.current = true;
    navigate('/projects');
    setProfileOpen(false);
  }, [navigate]);

  const onLogoutFromProfileMenu = useCallback(() => {
    skipProfileFocusRestoreRef.current = true;
    void signOut();
    setProfileOpen(false);
  }, [signOut]);

  const openCapturePanel = useCallback((intent: string | null, restoreTarget?: HTMLElement | null) => {
    captureRestoreTargetRef.current = restoreTarget ?? captureTriggerRef.current;
    skipCaptureFocusRestoreRef.current = false;
    setCaptureIntent(intent && intent !== 'inbox' ? intent : null);
    setCaptureActivationKey((current) => current + 1);
    setCaptureOpen(true);
    closeSearch();
    closeQuickNav();
    closeQuickNavPanel();
    setProfileOpen(false);
    setNotificationsOpen(false);
    setContextMenuOpen(false);
  }, [closeQuickNav, closeQuickNavPanel, closeSearch]);

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
    closeQuickNavPanel();
  }, [closeCapturePanel, closeQuickNav, closeQuickNavPanel, closeSearch]);

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
      closeQuickNavPanel();
      setNotificationsOpen(false);
      setProfileOpen(false);
      setContextMenuOpen(false);
      closeCapturePanel({ restoreFocus: false });
    },
    [closeCapturePanel, closeQuickNav, closeQuickNavPanel, navigate, resetSearch],
  );

  const onSelectQuickNavItem = useCallback((item: QuickNavActionItem) => {
    skipQuickNavFocusRestoreRef.current = true;
    if (item.action === 'panel') {
      openQuickNavPanel(item.panel);
      return;
    }
    setToolbarDialog(null);
    navigate(item.href);
    closeQuickNav();
  }, [closeQuickNav, navigate, openQuickNavPanel]);

  const onOpenCalendarRecordFromDialog = useCallback((recordId: string) => {
    const event = personalCalendarEvents.find((entry) => entry.record_id === recordId);
    const targetProjectId = event?.project_id || currentProjectId || captureHomeData.personalProjectId;
    if (!targetProjectId) {
      return;
    }
    setToolbarDialog(null);
    navigate(`/projects/${encodeURIComponent(targetProjectId)}/work?record_id=${encodeURIComponent(recordId)}`);
  }, [captureHomeData.personalProjectId, currentProjectId, navigate, personalCalendarEvents]);

  const toolbarCalendarCreateProjectId =
    captureHomeData.personalProjectId
    || projects.find((project) => project.isPersonal)?.id
    || null;

  const onCreateTaskFromModule = useCallback(async (task: {
    title: string;
    priority: string | null;
    due_at: string | null;
    parent_record_id?: string | null;
  }) => {
    if (!accessToken) {
      throw new Error('An authenticated session is required.');
    }
    const projectId = resolveDefaultQuickAddProjectId();
    const priority = task.priority === 'low' || task.priority === 'medium' || task.priority === 'high' || task.priority === 'urgent'
      ? task.priority
      : null;
    await createTask(accessToken, {
      project_id: projectId || undefined,
      parent_record_id: task.parent_record_id ?? null,
      title: task.title,
      status: 'todo',
      priority,
      due_at: task.due_at ?? null,
    });
    requestHubHomeRefresh();
    await refreshQuickNavTasks();
  }, [accessToken, refreshQuickNavTasks, resolveDefaultQuickAddProjectId]);

  const onCreateReminderFromModule = useCallback(async (payload: CreateReminderPayload) => {
    if (!accessToken) {
      throw new Error('An authenticated session is required.');
    }
    const personalProjectId = captureHomeData.personalProjectId || projects.find((project) => project.isPersonal)?.id || null;
    if (!personalProjectId) {
      throw new Error('A personal project is required to create reminders.');
    }
    await createReminder(accessToken, payload);
    requestHubHomeRefresh();
    await remindersRuntime.refresh();
  }, [accessToken, captureHomeData.personalProjectId, projects, remindersRuntime]);

  const onSnoozeReminderFromModule = useCallback(async (reminderId: string) => {
    if (!accessToken) {
      throw new Error('An authenticated session is required.');
    }
    await updateReminder(accessToken, reminderId, { remind_at: tomorrowAtNineIso() });
    await remindersRuntime.refresh();
  }, [accessToken, remindersRuntime]);

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

      <footer aria-label="App toolbar">
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
              closeQuickNavPanel();
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
                {QUICK_NAV_FIXED_ITEMS.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-label={`Open ${item.label.toLowerCase()}`}
                      className="flex w-full items-center gap-2 px-md py-sm text-left text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      style={{
                        background:
                          normalizedQuickNavActiveIndex === index
                            ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                            : 'transparent',
                      }}
                      onMouseEnter={() => setQuickNavActiveIndex(index)}
                      onClick={() => onSelectQuickNavItem(item)}
                    >
                      {item.iconName ? <Icon name={item.iconName} className="text-[13px] text-muted" /> : null}
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                ))}
                <li aria-hidden="true" className="my-1 border-t border-border-muted" />
                {quickNavDestinationItems.length === 0 ? (
                  <li className="px-md py-sm text-sm text-muted">No matching destinations</li>
                ) : (
                  quickNavDestinationItems.map((item, index) => {
                    const absoluteIndex = QUICK_NAV_FIXED_ITEMS.length + index;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-md py-sm text-left text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          style={{
                            background:
                              normalizedQuickNavActiveIndex === absoluteIndex
                                ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                                : 'transparent',
                          }}
                          onMouseEnter={() => setQuickNavActiveIndex(absoluteIndex)}
                          onClick={() => onSelectQuickNavItem(item)}
                        >
                          {item.iconName ? <Icon name={item.iconName} className="text-[13px] text-muted" /> : null}
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    );
                  })
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
                closeQuickNavPanel();
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

        <Dialog
          open={toolbarDialog === 'calendar'}
          onClose={closeQuickNavPanel}
          triggerRef={quickNavTriggerRef}
          title="Calendar"
          description="Your personal calendar across all projects."
          panelClassName="!top-[calc(50%-1.5rem)] !h-[calc(100vh-5rem)] !max-h-[calc(100vh-5rem)] !w-[min(96vw,96rem)] !max-w-[min(96vw,96rem)] flex flex-col overflow-hidden"
          contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {personalCalendarError ? (
              <div className="rounded-panel border border-danger/30 bg-danger/5 p-3" role="alert">
                <p className="text-sm text-danger">{personalCalendarError}</p>
                <button
                  type="button"
                  onClick={() => {
                    void refreshPersonalCalendar();
                  }}
                  className="mt-2 rounded-control border border-border-muted px-3 py-1.5 text-sm text-text"
                >
                  Retry
                </button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <CalendarModuleSkin
                events={personalCalendarEvents}
                loading={personalCalendarLoading}
                scope={personalCalendarMode as CalendarScope}
                onScopeChange={setPersonalCalendarMode}
                onOpenRecord={onOpenCalendarRecordFromDialog}
                onCreateEvent={
                  accessToken && toolbarCalendarCreateProjectId
                    ? async (payload) => {
                        await createEventFromNlp(accessToken, toolbarCalendarCreateProjectId, payload);
                        requestHubHomeRefresh();
                        await refreshPersonalCalendar();
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </Dialog>

        <Dialog
          open={toolbarDialog === 'tasks'}
          onClose={closeQuickNavPanel}
          triggerRef={quickNavTriggerRef}
          title="Tasks"
          description="All your tasks across projects."
          panelClassName="!top-[calc(50%-1.5rem)] !h-[calc(100vh-5rem)] !max-h-[calc(100vh-5rem)] !w-[min(96vw,64rem)] !max-w-[min(96vw,64rem)] flex flex-col overflow-hidden"
          contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {quickNavTasksError ? (
              <div className="rounded-panel border border-danger/30 bg-danger/5 p-3" role="alert">
                <p className="text-sm text-danger">{quickNavTasksError}</p>
                <button
                  type="button"
                  onClick={() => {
                    void refreshQuickNavTasks();
                  }}
                  className="mt-2 rounded-control border border-border-muted px-3 py-1.5 text-sm text-text"
                >
                  Retry
                </button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <TasksModuleSkin
                sizeTier="L"
                tasks={adaptedTasks}
                tasksLoading={quickNavTasksLoading}
                onCreateTask={onCreateTaskFromModule}
                hideHeader
              />
            </div>
          </div>
        </Dialog>

        <Dialog
          open={toolbarDialog === 'reminders'}
          onClose={closeQuickNavPanel}
          triggerRef={quickNavTriggerRef}
          title="Reminders"
          description="Your active reminders."
          panelClassName="w-[min(92vw,400px)] max-w-[400px] sm:min-w-[360px]"
        >
          <RemindersModuleSkin
            sizeTier="L"
            reminders={remindersRuntime.reminders}
            loading={remindersRuntime.loading}
            error={remindersRuntime.error}
            onDismiss={remindersRuntime.dismiss}
            onSnooze={onSnoozeReminderFromModule}
            onCreate={onCreateReminderFromModule}
          />
        </Dialog>

        <TaskCreateDialog
          open={quickAddDialog === 'task'}
          onClose={closeQuickAddDialog}
          onCreated={() => {
            void refreshCaptureData();
            requestHubHomeRefresh();
            closeQuickAddDialog();
          }}
          accessToken={accessToken ?? ''}
          projectId={quickAddProjectId}
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
            void loadTaskProjectMembers(projectId);
          }}
        />

        <QuickAddEventDialog
          open={quickAddDialog === 'event'}
          onClose={closeQuickAddDialog}
          triggerRef={contextMenuTriggerRef}
          projectOptions={quickAddProjectOptions}
          selectedProjectId={quickAddProjectId}
          onSelectedProjectIdChange={setQuickAddProjectId}
          onSubmit={onCreateQuickAddEvent}
          title={eventTitle}
          onTitleChange={setEventTitle}
          startAt={eventStartAt}
          onStartAtChange={setEventStartAt}
          endAt={eventEndAt}
          onEndAtChange={setEventEndAt}
          submitting={eventSubmitting}
          error={eventError}
          titleInputRef={eventTitleInputRef}
        />

        <QuickAddReminderDialog
          open={quickAddDialog === 'reminder'}
          onClose={closeQuickAddDialog}
          triggerRef={contextMenuTriggerRef}
          draft={reminderDraft}
          onDraftChange={setReminderDraft}
          preview={reminderPreview}
          onSubmit={onCreateQuickAddReminder}
          submitting={reminderSubmitting}
          error={reminderError}
          onClearError={() => setReminderError(null)}
          inputRef={reminderInputRef}
          personalProjectLabel={personalReminderProjectLabel}
        />

        <QuickAddProjectDialog
          open={quickAddDialog === 'project'}
          onClose={closeQuickAddDialog}
          triggerRef={contextMenuTriggerRef}
          name={projectDialogName}
          onNameChange={setProjectDialogName}
          onSubmit={onCreateQuickAddProject}
          submitting={projectDialogSubmitting}
          error={projectDialogError}
          nameInputRef={projectNameInputRef}
        />

        <div className="relative" ref={notificationsRef}>
          <button
            ref={notificationsTriggerRef}
            type="button"
            onClick={() => {
              setNotificationsOpen((current) => !current);
              setProfileOpen(false);
              closeSearch();
              closeQuickNav();
              closeQuickNavPanel();
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
            <NotificationsPanel
              notifications={notifications}
              filter={notifFilter}
              onFilterChange={setNotifFilter}
              projectFilter={notifProjectFilter}
              onProjectFilterChange={setNotifProjectFilter}
              projects={projects}
              onNavigate={onNavigateNotification}
              panelRef={notificationsPanelRef}
            />
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
              closeQuickNavPanel();
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
            <ProfileMenu
              name={sessionSummary.name}
              email={sessionSummary.email}
              avatarUrl={avatarUrl}
              avatarBroken={avatarBroken}
              menuRef={profileMenuRef}
              onNavigateProjects={onNavigateProjectsFromProfileMenu}
              onLogout={onLogoutFromProfileMenu}
            />
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
