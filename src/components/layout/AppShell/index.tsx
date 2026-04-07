import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, startTransition, useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthz } from '../../../context/AuthzContext';
import { appTabs } from '../../../lib/policy';
import { useProjects } from '../../../context/ProjectsContext';
import { useRouteFocusReset } from '../../../hooks/useRouteFocusReset';
import { useRemindersRuntime } from '../../../hooks/useRemindersRuntime';
import { usePersonalCalendarRuntime } from '../../../hooks/usePersonalCalendarRuntime';
import { mapReminderFailureReasonToMessage, useReminderNLDraft } from '../../../hooks/useReminderNLDraft';
import { createEventFromNlp, createTask, getHubHome, queryTasks } from '../../../services/hub/records';
import { createReminder, updateReminder, type CreateReminderPayload } from '../../../services/hub/reminders';
import { listProjectMembers } from '../../../services/hub/projects';
import type { HubProjectMember, HubTaskSummary } from '../../../services/hub/types';
import { requestHubHomeRefresh } from '../../../lib/hubHomeRefresh';
import { createHubProject } from '../../../services/projectsService';
import { adaptTaskSummaries } from '../../project-space/taskAdapter';
import { notifyError, notifyInfo, notifySuccess } from '../../primitives';
import { BottomToolbar, type CloseNotificationsOptions, type CloseQuickNavOptions } from '../BottomToolbar';
import { useCapturePanelEffects } from './hooks/useCapturePanelEffects';
import { useGlobalInteractionEffects } from './hooks/useGlobalInteractionEffects';
import { useInstallPromptEffect } from './hooks/useInstallPromptEffect';
import { useQuickAddEffects } from './hooks/useQuickAddEffects';
import { useQuickAddProjectRequestEffect } from './hooks/useQuickAddProjectRequestEffect';
import { useQuickNavEffects } from './hooks/useQuickNavEffects';
import { useTasksDialogEffects } from './hooks/useTasksDialogEffects';
import { useToolbarFocusEffects } from './hooks/useToolbarFocusEffects';
import {
  buildAccountAvatarUrl,
  buildBreadcrumb,
  focusElementSoon,
  nowPlusHours,
  parseIsoTimestamp,
  QUICK_ADD_OPTIONS,
  QUICK_NAV_FIXED_ITEMS,
  sessionInitials,
  toDateTimeLocalInput,
  tomorrowAtNineIso,
  type QuickAddDialog,
  type QuickAddOption,
  type QuickNavActionItem,
  type ToolbarDialog,
} from '../appShellUtils';

export const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionSummary, calendarFeedUrl, canGlobal, accessToken, signOut } = useAuthz();
  const { projects, upsertProject } = useProjects();

  useRouteFocusReset();

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
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [projectDialogName, setProjectDialogName] = useState('');
  const [projectDialogSubmitting, setProjectDialogSubmitting] = useState(false);
  const [projectDialogError, setProjectDialogError] = useState<string | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<{ installed: boolean; iosSafari: boolean }>({
    installed: false,
    iosSafari: false,
  });
  const [quickNavQuery, setQuickNavQuery] = useState('');
  const [quickNavActiveIndex, setQuickNavActiveIndex] = useState(-1);
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
  const {
    draft: reminderDraft,
    setDraft: setReminderDraft,
    preview: reminderPreview,
    clear: clearReminderDraft,
    createPayload: createReminderPayload,
  } = useReminderNLDraft({
    enabled: quickAddDialog === 'reminder',
    parseDelayMs: 250,
  });
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

  const quickNavRef = useRef<HTMLDivElement | null>(null);
  const quickNavTriggerRef = useRef<HTMLButtonElement | null>(null);
  const quickNavInputRef = useRef<HTMLInputElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const profileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
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
  const profileWasOpenRef = useRef(false);
  const contextMenuWasOpenRef = useRef(false);
  const skipQuickNavFocusRestoreRef = useRef(false);
  const skipProfileFocusRestoreRef = useRef(false);
  const skipContextMenuFocusRestoreRef = useRef(false);
  const skipCaptureFocusRestoreRef = useRef(false);
  const toolbarSearchCloseRef = useRef<() => void>(() => {});
  const toolbarNotificationsCloseRef = useRef<(options?: CloseNotificationsOptions) => void>(() => {});

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
        clearReminderDraft();
        setReminderError(null);
      }

      setQuickAddDialog(dialogType);
    },
    [accessToken, clearReminderDraft, loadTaskProjectMembers, refreshCaptureData, resolveDefaultQuickAddProjectId],
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

    const payloadResult = createReminderPayload({
      fallbackTitleFromDraft: true,
      forceReparse: true,
    });
    if (!payloadResult.payload) {
      setReminderError(mapReminderFailureReasonToMessage(payloadResult.failureReason));
      return;
    }

    setReminderSubmitting(true);
    setReminderError(null);
    try {
      await createReminder(accessToken, payloadResult.payload);
      void refreshCaptureData();
      requestHubHomeRefresh();
      setQuickAddDialog(null);
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Failed to create reminder.');
    } finally {
      setReminderSubmitting(false);
    }
  }, [accessToken, createReminderPayload, refreshCaptureData]);

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
      const createdProject = created.data;
      setQuickAddDialog(null);
      setProjectDialogName('');
      upsertProject(createdProject);
      startTransition(() => {
        navigate(`/projects/${encodeURIComponent(createdProject.id)}/overview`);
      });
    } catch (error) {
      setProjectDialogError(error instanceof Error ? error.message : 'Project creation failed.');
    } finally {
      setProjectDialogSubmitting(false);
    }
  }, [accessToken, navigate, projectDialogName, upsertProject]);

  useCapturePanelEffects({
    captureOpen,
    refreshCaptureData,
    setCaptureAnnouncement,
  });

  useQuickAddEffects({
    contextMenuOpen,
    setQuickAddActiveIndex,
    quickAddItemRefs,
    quickAddDialog,
    taskTitleInputRef,
    eventTitleInputRef,
    reminderInputRef,
    projectNameInputRef,
  });

  useTasksDialogEffects({
    toolbarDialog,
    refreshQuickNavTasks,
  });

  const closeQuickNav = useCallback((options?: CloseQuickNavOptions) => {
    skipQuickNavFocusRestoreRef.current = options?.restoreFocus === false;
    setQuickNavOpen(false);
    setQuickNavQuery('');
    setQuickNavActiveIndex(-1);
  }, []);

  const closeCapturePanel = useCallback((options?: { restoreFocus?: boolean }) => {
    skipCaptureFocusRestoreRef.current = options?.restoreFocus === false;
    setCaptureOpen(false);
  }, []);

  const onSearchCloseAvailable = useCallback((closeSearch: () => void) => {
    toolbarSearchCloseRef.current = closeSearch;
  }, []);

  const onNotificationsCloseAvailable = useCallback((closeNotifications: (options?: CloseNotificationsOptions) => void) => {
    toolbarNotificationsCloseRef.current = closeNotifications;
  }, []);

  const closeToolbarSearch = useCallback(() => {
    toolbarSearchCloseRef.current();
  }, []);

  const closeToolbarNotifications = useCallback((options?: CloseNotificationsOptions) => {
    toolbarNotificationsCloseRef.current(options);
  }, []);

  const openQuickNavPanel = useCallback((panel: Exclude<ToolbarDialog, null>) => {
    skipProfileFocusRestoreRef.current = true;
    skipContextMenuFocusRestoreRef.current = true;
    setToolbarDialog(panel);
    closeToolbarSearch();
    closeToolbarNotifications({ restoreFocus: false });
    closeQuickNav();
    setProfileOpen(false);
    setContextMenuOpen(false);
    closeCapturePanel({ restoreFocus: false });
  }, [closeCapturePanel, closeQuickNav, closeToolbarNotifications, closeToolbarSearch]);

  useQuickAddProjectRequestEffect({
    closeCapturePanel,
    closeQuickNav,
    closeQuickNavPanel,
    closeSearch: closeToolbarSearch,
    closeNotifications: closeToolbarNotifications,
    openQuickAddDialog,
    setProfileOpen,
    setContextMenuOpen,
    skipQuickNavFocusRestoreRef,
    skipProfileFocusRestoreRef,
    skipContextMenuFocusRestoreRef,
  });

  useGlobalInteractionEffects({
    closeCapturePanel,
    closeQuickNav,
    closeQuickNavPanel,
    closeSearch: closeToolbarSearch,
    closeNotifications: closeToolbarNotifications,
    contextMenuOpen,
    contextMenuRef,
    openQuickNavPanel,
    profileOpen,
    profileRef,
    quickAddDialog,
    quickNavOpen,
    quickNavRef,
    setContextMenuOpen,
    setProfileOpen,
  });

  const quickNavDestinationItems = useMemo(() => {
    const tabItems: QuickNavActionItem[] = visibleTabs.map((tab) => ({ id: tab.to, label: tab.label, action: 'navigate', href: tab.to }));
    const projectItems = projects.map((project) => ({
      id: `project-${project.id}`,
      label: project.name,
      iconName: 'menu' as const,
      action: 'navigate' as const,
      href: `/projects/${encodeURIComponent(project.id)}/overview`,
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

  useQuickNavEffects({
    captureOpen,
    closeQuickNav,
    contextMenuOpen,
    navigate,
    normalizedQuickNavActiveIndex,
    openQuickNavPanel,
    profileOpen,
    quickAddDialog,
    quickNavInputRef,
    quickNavItems,
    quickNavOpen,
    quickNavTriggerRef,
    quickNavWasOpenRef,
    setQuickNavActiveIndex,
    setQuickNavQuery,
    setToolbarDialog,
    skipQuickNavFocusRestoreRef,
    toolbarDialog,
  });

  useToolbarFocusEffects({
    captureOpen,
    contextMenuOpen,
    contextMenuRef,
    contextMenuTriggerRef,
    contextMenuWasOpenRef,
    profileMenuRef,
    profileOpen,
    profileTriggerRef,
    profileWasOpenRef,
    quickAddDialog,
    quickNavOpen,
    skipContextMenuFocusRestoreRef,
    skipProfileFocusRestoreRef,
    toolbarDialog,
  });

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
    closeToolbarSearch();
    closeToolbarNotifications({ restoreFocus: false });
    closeQuickNav();
    closeQuickNavPanel();
    setProfileOpen(false);
    setContextMenuOpen(false);
  }, [closeQuickNav, closeQuickNavPanel, closeToolbarNotifications, closeToolbarSearch]);

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
    closeToolbarSearch();
    closeToolbarNotifications({ restoreFocus: false });
    setProfileOpen(false);
    closeQuickNav();
    closeQuickNavPanel();
  }, [closeCapturePanel, closeQuickNav, closeQuickNavPanel, closeToolbarNotifications, closeToolbarSearch]);

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
    await createReminder(accessToken, payload);
    requestHubHomeRefresh();
    await remindersRuntime.refresh();
  }, [accessToken, remindersRuntime]);

  const onSnoozeReminderFromModule = useCallback(async (reminderId: string) => {
    if (!accessToken) {
      throw new Error('An authenticated session is required.');
    }
    await updateReminder(accessToken, reminderId, { remind_at: tomorrowAtNineIso() });
    requestHubHomeRefresh();
    await remindersRuntime.refresh();
  }, [accessToken, remindersRuntime]);

  useInstallPromptEffect({
    setDeferredInstallPrompt,
    setInstallState,
  });

  const onCopyCalendarLink = useCallback(() => {
    const url = calendarFeedUrl.trim();
    if (!url) {
      notifyError('Could not copy calendar link.', 'Calendar link is not available yet.');
      return;
    }

    const fallbackCopy = () => {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.setAttribute('readonly', 'true');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);
      return copied;
    };

    if (navigator.clipboard?.writeText) {
      const copyRequest = navigator.clipboard.writeText(url);
      void copyRequest
        .then(() => {
          notifySuccess('Calendar link copied — paste in Google Calendar, Outlook, or Apple Calendar to subscribe.');
        })
        .catch(() => {
          if (fallbackCopy()) {
            notifySuccess('Calendar link copied — paste in Google Calendar, Outlook, or Apple Calendar to subscribe.');
            return;
          }
          notifyError('Could not copy calendar link.');
        });
      return;
    }

    if (fallbackCopy()) {
      notifySuccess('Calendar link copied — paste in Google Calendar, Outlook, or Apple Calendar to subscribe.');
      return;
    }
    notifyError('Could not copy calendar link.');
  }, [calendarFeedUrl]);

  const onInstallHubOs = useCallback(async () => {
    if (installState.installed) {
      return;
    }

    if (deferredInstallPrompt) {
      setProfileOpen(false);
      const promptEvent = deferredInstallPrompt;
      setDeferredInstallPrompt(null);
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'dismissed') {
          notifyInfo('Install cancelled.');
        }
      } catch {
        notifyError('Could not open the install prompt.');
      }
      return;
    }

    if (installState.iosSafari) {
      setProfileOpen(false);
      notifyInfo('Add to Home Screen', 'In Safari, tap Share, then tap Add to Home Screen.');
    }
  }, [deferredInstallPrompt, installState.installed, installState.iosSafari]);

  const installMenuLabel = useMemo(() => {
    if (installState.installed) {
      return null;
    }
    if (deferredInstallPrompt) {
      return 'Install Hub OS';
    }
    if (installState.iosSafari) {
      return 'Add to Home Screen';
    }
    return null;
  }, [deferredInstallPrompt, installState.installed, installState.iosSafari]);
  const hasCalendarFeedUrl = calendarFeedUrl.trim().length > 0;

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

      <BottomToolbar
        onSearchCloseAvailable={onSearchCloseAvailable}
        onNotificationsCloseAvailable={onNotificationsCloseAvailable}
        isOnHubHome={isOnHubHome}
        navigate={navigate}
        breadcrumb={breadcrumb}
        quickNavRef={quickNavRef}
        quickNavTriggerRef={quickNavTriggerRef}
        quickNavOpen={quickNavOpen}
        closeQuickNav={closeQuickNav}
        setQuickNavOpen={setQuickNavOpen}
        setQuickNavActiveIndex={setQuickNavActiveIndex}
        quickNavItems={quickNavItems}
        setProfileOpen={setProfileOpen}
        setContextMenuOpen={setContextMenuOpen}
        closeQuickNavPanel={closeQuickNavPanel}
        closeCapturePanel={closeCapturePanel}
        quickNavInputRef={quickNavInputRef}
        quickNavQuery={quickNavQuery}
        setQuickNavQuery={setQuickNavQuery}
        normalizedQuickNavActiveIndex={normalizedQuickNavActiveIndex}
        onSelectQuickNavItem={onSelectQuickNavItem}
        quickNavDestinationItems={quickNavDestinationItems}
        contextMenuRef={contextMenuRef}
        contextMenuTriggerRef={contextMenuTriggerRef}
        contextMenuOpen={contextMenuOpen}
        toggleQuickAddMenu={toggleQuickAddMenu}
        quickAddItemRefs={quickAddItemRefs}
        quickAddActiveIndex={quickAddActiveIndex}
        setQuickAddActiveIndex={setQuickAddActiveIndex}
        onQuickAddMenuItemKeyDown={onQuickAddMenuItemKeyDown}
        onSelectQuickAddOption={onSelectQuickAddOption}
        captureOpen={captureOpen}
        setCaptureOpen={setCaptureOpen}
        captureTriggerRef={captureTriggerRef}
        onQuickCapture={onQuickCapture}
        skipCaptureFocusRestoreRef={skipCaptureFocusRestoreRef}
        captureRestoreTargetRef={captureRestoreTargetRef}
        accessToken={accessToken}
        projects={projects}
        captureHomeData={captureHomeData}
        captureLoading={captureLoading}
        refreshCaptureData={refreshCaptureData}
        preferredCaptureProjectId={preferredCaptureProjectId}
        captureIntent={captureIntent}
        captureActivationKey={captureActivationKey}
        toolbarDialog={toolbarDialog}
        personalCalendarError={personalCalendarError}
        refreshPersonalCalendar={refreshPersonalCalendar}
        personalCalendarEvents={personalCalendarEvents}
        personalCalendarLoading={personalCalendarLoading}
        personalCalendarMode={personalCalendarMode}
        setPersonalCalendarMode={setPersonalCalendarMode}
        onOpenCalendarRecordFromDialog={onOpenCalendarRecordFromDialog}
        toolbarCalendarCreateProjectId={toolbarCalendarCreateProjectId}
        quickNavTasksError={quickNavTasksError}
        refreshQuickNavTasks={refreshQuickNavTasks}
        adaptedTasks={adaptedTasks}
        quickNavTasksLoading={quickNavTasksLoading}
        onCreateTaskFromModule={onCreateTaskFromModule}
        remindersRuntime={remindersRuntime}
        onSnoozeReminderFromModule={onSnoozeReminderFromModule}
        onCreateReminderFromModule={onCreateReminderFromModule}
        quickAddDialog={quickAddDialog}
        closeQuickAddDialog={closeQuickAddDialog}
        quickAddProjectId={quickAddProjectId}
        selectedTaskProjectMembers={selectedTaskProjectMembers}
        quickAddProjectOptions={quickAddProjectOptions}
        taskTitleInputRef={taskTitleInputRef}
        setQuickAddProjectId={setQuickAddProjectId}
        loadTaskProjectMembers={loadTaskProjectMembers}
        onCreateQuickAddEvent={onCreateQuickAddEvent}
        eventTitle={eventTitle}
        setEventTitle={setEventTitle}
        eventStartAt={eventStartAt}
        setEventStartAt={setEventStartAt}
        eventEndAt={eventEndAt}
        setEventEndAt={setEventEndAt}
        eventSubmitting={eventSubmitting}
        eventError={eventError}
        eventTitleInputRef={eventTitleInputRef}
        reminderDraft={reminderDraft}
        setReminderDraft={setReminderDraft}
        reminderPreview={reminderPreview}
        onCreateQuickAddReminder={onCreateQuickAddReminder}
        reminderSubmitting={reminderSubmitting}
        reminderError={reminderError}
        setReminderError={setReminderError}
        reminderInputRef={reminderInputRef}
        personalReminderProjectLabel={personalReminderProjectLabel}
        projectDialogName={projectDialogName}
        setProjectDialogName={setProjectDialogName}
        onCreateQuickAddProject={onCreateQuickAddProject}
        projectDialogSubmitting={projectDialogSubmitting}
        projectDialogError={projectDialogError}
        projectNameInputRef={projectNameInputRef}
        profileRef={profileRef}
        profileTriggerRef={profileTriggerRef}
        profileOpen={profileOpen}
        avatarBroken={avatarBroken}
        avatarUrl={avatarUrl}
        sessionSummary={sessionSummary}
        setAvatarBroken={setAvatarBroken}
        profileMenuRef={profileMenuRef}
        hasCalendarFeedUrl={hasCalendarFeedUrl}
        onCopyCalendarLink={onCopyCalendarLink}
        installMenuLabel={installMenuLabel}
        onInstallHubOs={onInstallHubOs}
        onNavigateProjectsFromProfileMenu={onNavigateProjectsFromProfileMenu}
        onLogoutFromProfileMenu={onLogoutFromProfileMenu}
      />
      <div className="sr-only" aria-live="polite">
        {captureAnnouncement}
      </div>
    </div>
  );
};
