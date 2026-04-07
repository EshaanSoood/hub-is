import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, startTransition, useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthz } from '../../../context/AuthzContext';
import { useProjects } from '../../../context/ProjectsContext';
import { useRouteFocusReset } from '../../../hooks/useRouteFocusReset';
import { useRemindersRuntime } from '../../../hooks/useRemindersRuntime';
import { usePersonalCalendarRuntime } from '../../../hooks/usePersonalCalendarRuntime';
import { mapReminderFailureReasonToMessage, useReminderNLDraft } from '../../../hooks/useReminderNLDraft';
import { createEventFromNlp, getHubHome } from '../../../services/hub/records';
import { createReminder, updateReminder, type CreateReminderPayload } from '../../../services/hub/reminders';
import { listProjectMembers } from '../../../services/hub/projects';
import type { HubProjectMember } from '../../../services/hub/types';
import { requestHubHomeRefresh } from '../../../lib/hubHomeRefresh';
import { createHubProject } from '../../../services/projectsService';
import {
  BottomToolbar,
  type CloseContextMenuOptions,
  type CloseNotificationsOptions,
  type CloseProfileOptions,
  type CloseQuickNavOptions,
} from '../BottomToolbar';
import { useCapturePanelEffects } from './hooks/useCapturePanelEffects';
import { useGlobalInteractionEffects } from './hooks/useGlobalInteractionEffects';
import { useQuickAddEffects } from './hooks/useQuickAddEffects';
import { useQuickAddProjectRequestEffect } from './hooks/useQuickAddProjectRequestEffect';
import { useToolbarFocusEffects } from './hooks/useToolbarFocusEffects';
import {
  buildBreadcrumb,
  focusElementSoon,
  nowPlusHours,
  QUICK_ADD_OPTIONS,
  toDateTimeLocalInput,
  tomorrowAtNineIso,
  type QuickAddDialog,
  type QuickAddOption,
} from '../appShellUtils';

export const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionSummary, calendarFeedUrl, canGlobal, accessToken, signOut } = useAuthz();
  const { projects, upsertProject } = useProjects();

  useRouteFocusReset();

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
  const {
    calendarEvents: personalCalendarEvents,
    calendarLoading: personalCalendarLoading,
    calendarError: personalCalendarError,
    calendarMode: personalCalendarMode,
    setCalendarMode: setPersonalCalendarMode,
    refreshCalendar: refreshPersonalCalendar,
  } = usePersonalCalendarRuntime(accessToken ?? null, { autoload: true });
  const remindersRuntime = useRemindersRuntime(accessToken ?? null, {
    autoload: true,
    subscribeToHomeRefresh: true,
    subscribeToLive: true,
  });

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
  const contextMenuWasOpenRef = useRef(false);
  const skipContextMenuFocusRestoreRef = useRef(false);
  const skipCaptureFocusRestoreRef = useRef(false);
  const toolbarSearchCloseRef = useRef<() => void>(() => {});
  const toolbarNotificationsCloseRef = useRef<(options?: CloseNotificationsOptions) => void>(() => {});
  const toolbarQuickNavCloseRef = useRef<(options?: CloseQuickNavOptions) => void>(() => {});
  const toolbarQuickNavPanelCloseRef = useRef<() => void>(() => {});
  const toolbarQuickNavPanelOpenRef = useRef<(panel: 'calendar' | 'tasks' | 'reminders') => void>(() => {});
  const toolbarProfileCloseRef = useRef<(options?: CloseProfileOptions) => void>(() => {});

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
  const defaultTaskProjectId = useMemo(() => {
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

  const closeCapturePanel = useCallback((options?: { restoreFocus?: boolean }) => {
    skipCaptureFocusRestoreRef.current = options?.restoreFocus === false;
    setCaptureOpen(false);
  }, []);

  const closeContextMenu = useCallback((options?: CloseContextMenuOptions) => {
    skipContextMenuFocusRestoreRef.current = options?.restoreFocus === false;
    setContextMenuOpen(false);
  }, []);

  const onSearchCloseAvailable = useCallback((closeSearch: () => void) => {
    toolbarSearchCloseRef.current = closeSearch;
  }, []);

  const onNotificationsCloseAvailable = useCallback((closeNotifications: (options?: CloseNotificationsOptions) => void) => {
    toolbarNotificationsCloseRef.current = closeNotifications;
  }, []);

  const onQuickNavCloseAvailable = useCallback((closeQuickNav: (options?: CloseQuickNavOptions) => void) => {
    toolbarQuickNavCloseRef.current = closeQuickNav;
  }, []);

  const onQuickNavPanelCloseAvailable = useCallback((closeQuickNavPanel: () => void) => {
    toolbarQuickNavPanelCloseRef.current = closeQuickNavPanel;
  }, []);

  const onQuickNavPanelOpenAvailable = useCallback((openQuickNavPanel: (panel: 'calendar' | 'tasks' | 'reminders') => void) => {
    toolbarQuickNavPanelOpenRef.current = openQuickNavPanel;
  }, []);

  const onProfileCloseAvailable = useCallback((closeProfile: (options?: CloseProfileOptions) => void) => {
    toolbarProfileCloseRef.current = closeProfile;
  }, []);

  const closeToolbarSearch = useCallback(() => {
    toolbarSearchCloseRef.current();
  }, []);

  const closeToolbarNotifications = useCallback((options?: CloseNotificationsOptions) => {
    toolbarNotificationsCloseRef.current(options);
  }, []);

  const closeToolbarQuickNav = useCallback((options?: CloseQuickNavOptions) => {
    toolbarQuickNavCloseRef.current(options);
  }, []);

  const closeToolbarQuickNavPanel = useCallback(() => {
    toolbarQuickNavPanelCloseRef.current();
  }, []);

  const openToolbarQuickNavPanel = useCallback((panel: 'calendar' | 'tasks' | 'reminders') => {
    toolbarQuickNavPanelOpenRef.current(panel);
  }, []);

  const closeToolbarProfile = useCallback((options?: CloseProfileOptions) => {
    toolbarProfileCloseRef.current(options);
  }, []);

  useQuickAddProjectRequestEffect({
    closeCapturePanel,
    closeQuickNav: closeToolbarQuickNav,
    closeQuickNavPanel: closeToolbarQuickNavPanel,
    closeProfile: closeToolbarProfile,
    closeContextMenu,
    closeSearch: closeToolbarSearch,
    closeNotifications: closeToolbarNotifications,
    openQuickAddDialog,
  });

  useGlobalInteractionEffects({
    closeCapturePanel,
    closeQuickNav: closeToolbarQuickNav,
    closeQuickNavPanel: closeToolbarQuickNavPanel,
    openQuickNavPanel: openToolbarQuickNavPanel,
    closeProfile: () => closeToolbarProfile(),
    closeSearch: closeToolbarSearch,
    closeNotifications: closeToolbarNotifications,
    closeContextMenu,
    contextMenuOpen,
    contextMenuRef,
    quickAddDialog,
  });

  useToolbarFocusEffects({
    captureOpen,
    contextMenuOpen,
    contextMenuRef,
    contextMenuTriggerRef,
    contextMenuWasOpenRef,
    quickAddDialog,
    skipContextMenuFocusRestoreRef,
    toolbarDialog: null,
  });

  const openCapturePanel = useCallback((intent: string | null, restoreTarget?: HTMLElement | null) => {
    captureRestoreTargetRef.current = restoreTarget ?? captureTriggerRef.current;
    skipCaptureFocusRestoreRef.current = false;
    setCaptureIntent(intent && intent !== 'inbox' ? intent : null);
    setCaptureActivationKey((current) => current + 1);
    setCaptureOpen(true);
    closeToolbarSearch();
    closeToolbarNotifications({ restoreFocus: false });
    closeToolbarQuickNav({ restoreFocus: false });
    closeToolbarQuickNavPanel();
    closeToolbarProfile({ restoreFocus: false });
    closeContextMenu({ restoreFocus: false });
  }, [closeContextMenu, closeToolbarNotifications, closeToolbarProfile, closeToolbarQuickNav, closeToolbarQuickNavPanel, closeToolbarSearch]);

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
    closeToolbarProfile({ restoreFocus: false });
    closeToolbarQuickNav({ restoreFocus: false });
    closeToolbarQuickNavPanel();
  }, [closeCapturePanel, closeToolbarNotifications, closeToolbarProfile, closeToolbarQuickNav, closeToolbarQuickNavPanel, closeToolbarSearch]);

  const onSelectQuickAddOption = useCallback((option: QuickAddOption) => {
    closeContextMenu({ restoreFocus: false });
    void openQuickAddDialog(option.key);
  }, [closeContextMenu, openQuickAddDialog]);

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
      closeContextMenu();
    }
  }, [closeContextMenu, focusQuickAddMenuItem]);

  const onOpenCalendarRecordFromDialog = useCallback((recordId: string) => {
    const event = personalCalendarEvents.find((entry) => entry.record_id === recordId);
    const targetProjectId = event?.project_id || currentProjectId || captureHomeData.personalProjectId;
    if (!targetProjectId) {
      return;
    }
    closeToolbarQuickNavPanel();
    navigate(`/projects/${encodeURIComponent(targetProjectId)}/work?record_id=${encodeURIComponent(recordId)}`);
  }, [captureHomeData.personalProjectId, closeToolbarQuickNavPanel, currentProjectId, navigate, personalCalendarEvents]);

  const toolbarCalendarCreateProjectId =
    captureHomeData.personalProjectId
    || projects.find((project) => project.isPersonal)?.id
    || null;

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
        onQuickNavCloseAvailable={onQuickNavCloseAvailable}
        onQuickNavPanelCloseAvailable={onQuickNavPanelCloseAvailable}
        onQuickNavPanelOpenAvailable={onQuickNavPanelOpenAvailable}
        onProfileCloseAvailable={onProfileCloseAvailable}
        isOnHubHome={isOnHubHome}
        navigate={navigate}
        breadcrumb={breadcrumb}
        canGlobal={canGlobal}
        setContextMenuOpen={setContextMenuOpen}
        closeContextMenu={closeContextMenu}
        closeCapturePanel={closeCapturePanel}
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
        defaultTaskProjectId={defaultTaskProjectId}
        captureLoading={captureLoading}
        refreshCaptureData={refreshCaptureData}
        preferredCaptureProjectId={preferredCaptureProjectId}
        captureIntent={captureIntent}
        captureActivationKey={captureActivationKey}
        personalCalendarError={personalCalendarError}
        refreshPersonalCalendar={refreshPersonalCalendar}
        personalCalendarEvents={personalCalendarEvents}
        personalCalendarLoading={personalCalendarLoading}
        personalCalendarMode={personalCalendarMode}
        setPersonalCalendarMode={setPersonalCalendarMode}
        onOpenCalendarRecordFromDialog={onOpenCalendarRecordFromDialog}
        toolbarCalendarCreateProjectId={toolbarCalendarCreateProjectId}
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
        sessionSummary={sessionSummary}
        calendarFeedUrl={calendarFeedUrl}
        signOut={signOut}
      />
      <div className="sr-only" aria-live="polite">
        {captureAnnouncement}
      </div>
    </div>
  );
};
