import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthz } from '../../../context/AuthzContext';
import { useProjects } from '../../../context/ProjectsContext';
import { usePersonalCalendarRuntime } from '../../../hooks/usePersonalCalendarRuntime';
import { useRemindersRuntime } from '../../../hooks/useRemindersRuntime';
import { requestHubHomeRefresh } from '../../../lib/hubHomeRefresh';
import { createReminder, updateReminder, type CreateReminderPayload } from '../../../services/hub/reminders';
import { buildBreadcrumb, tomorrowAtNineIso } from '../appShellUtils';
import { CalendarDialog } from './ToolbarDialogs/CalendarDialog';
import { QuickAddDialogs } from './ToolbarDialogs/QuickAddDialogs';
import { RemindersDialog } from './ToolbarDialogs/RemindersDialog';
import { TasksDialog } from './ToolbarDialogs/TasksDialog';
import { ToolbarBreadcrumb } from './ToolbarBreadcrumb';
import { useGlobalInteractionEffects } from './hooks/useGlobalInteractionEffects';
import { useToolbarCapture } from './hooks/useToolbarCapture';
import { useToolbarNotifications } from './hooks/useToolbarNotifications';
import { useToolbarPaneName } from './hooks/useToolbarPaneName';
import { useToolbarProfile } from './hooks/useToolbarProfile';
import { useToolbarQuickAdd } from './hooks/useToolbarQuickAdd';
import { useToolbarQuickNav } from './hooks/useToolbarQuickNav';
import { useToolbarSearch } from './hooks/useToolbarSearch';
import { ToolbarNav } from './ToolbarNav';
import { ToolbarNotifications } from './ToolbarNotifications';
import { ToolbarPanels } from './ToolbarPanels';
import { ToolbarProfile } from './ToolbarProfile';
import { ToolbarQuickAdd } from './ToolbarQuickAdd';
import { ToolbarSearch } from './ToolbarSearch';
import { ToolbarThoughtPile } from './ToolbarThoughtPile';
import type {
  BottomToolbarProps,
  CloseNotificationsOptions,
  CloseProfileOptions,
  CloseQuickNavOptions,
} from './types';

export type {
  BottomToolbarProps,
  CloseContextMenuOptions,
  CloseNotificationsOptions,
  CloseProfileOptions,
  CloseQuickNavOptions,
} from './types';

export const BottomToolbar = ({ setCaptureAnnouncement }: BottomToolbarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionSummary, calendarFeedUrl, canGlobal, accessToken, signOut } = useAuthz();
  const { projects, upsertProject } = useProjects();

  const searchCloseRef = useRef<() => void>(() => {});
  const notificationsCloseRef = useRef<(options?: CloseNotificationsOptions) => void>(() => {});
  const quickNavCloseRef = useRef<(options?: CloseQuickNavOptions) => void>(() => {});
  const quickNavPanelCloseRef = useRef<() => void>(() => {});
  const profileCloseRef = useRef<(options?: CloseProfileOptions) => void>(() => {});

  const closeToolbarSearch = useCallback(() => {
    searchCloseRef.current();
  }, []);

  const closeToolbarNotifications = useCallback((options?: CloseNotificationsOptions) => {
    notificationsCloseRef.current(options);
  }, []);

  const closeToolbarQuickNav = useCallback((options?: CloseQuickNavOptions) => {
    quickNavCloseRef.current(options);
  }, []);

  const closeToolbarQuickNavPanel = useCallback(() => {
    quickNavPanelCloseRef.current();
  }, []);

  const closeToolbarProfile = useCallback((options?: CloseProfileOptions) => {
    profileCloseRef.current(options);
  }, []);

  const isOnHubHome = location.pathname === '/projects';
  const currentProjectId = useMemo(() => {
    const match = location.pathname.match(/^\/projects\/([^/]+)/);
    if (!match || location.pathname === '/projects') {
      return null;
    }
    return decodeURIComponent(match[1]);
  }, [location.pathname]);
  const currentPaneId = useMemo(() => {
    const match = location.pathname.match(/^\/projects\/[^/]+\/work\/([^/]+)/);
    if (!match) {
      return null;
    }
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }, [location.pathname]);
  const currentPaneName = useToolbarPaneName({
    accessToken,
    projectId: currentProjectId,
    paneId: currentPaneId,
  });
  const currentProjectName = useMemo(() => {
    if (!currentProjectId) {
      return null;
    }
    return projects.find((project) => project.id === currentProjectId)?.name || 'Unknown project';
  }, [currentProjectId, projects]);
  const breadcrumb = useMemo(
    () => (
      currentProjectName && currentPaneId
        ? [currentProjectName, currentPaneName || currentPaneId]
        : buildBreadcrumb(location.pathname, projects.map((project) => ({ id: project.id, name: project.name })))
    ),
    [currentPaneId, currentPaneName, currentProjectName, location.pathname, projects],
  );

  const capture = useToolbarCapture({
    accessToken,
    projects,
    currentProjectId,
    setCaptureAnnouncement,
  });

  const quickAdd = useToolbarQuickAdd({
    accessToken,
    projects,
    currentProjectId,
    captureHomeData: capture.captureHomeData,
    preferredCaptureProjectId: capture.preferredCaptureProjectId,
    refreshCaptureData: capture.refreshCaptureData,
    closeCapturePanel: capture.closeCapturePanel,
    closeQuickNav: closeToolbarQuickNav,
    closeQuickNavPanel: closeToolbarQuickNavPanel,
    closeProfile: closeToolbarProfile,
    closeSearch: closeToolbarSearch,
    closeNotifications: closeToolbarNotifications,
    captureOpen: capture.captureOpen,
    navigate,
    upsertProject,
  });

  const profile = useToolbarProfile({
    sessionSummary,
    calendarFeedUrl,
    navigate,
    signOut,
    contextMenuOpen: quickAdd.contextMenuOpen,
    captureOpen: capture.captureOpen,
    quickAddDialog: quickAdd.quickAddDialog,
  });

  const quickNav = useToolbarQuickNav({
    accessToken,
    canGlobal,
    navigate,
    projects,
    defaultTaskProjectId: capture.defaultTaskProjectId,
    closeProfile: profile.closeProfile,
    closeContextMenu: quickAdd.closeContextMenu,
    closeCapturePanel: capture.closeCapturePanel,
    contextMenuOpen: quickAdd.contextMenuOpen,
    profileOpen: profile.profileOpen,
    captureOpen: capture.captureOpen,
    quickAddDialog: quickAdd.quickAddDialog,
  });

  const search = useToolbarSearch({
    accessToken,
    navigate,
    closeQuickNav: quickNav.closeQuickNav,
    closeQuickNavPanel: quickNav.closeQuickNavPanel,
    closeProfile: profile.closeProfile,
    closeContextMenu: quickAdd.closeContextMenu,
    closeCapturePanel: capture.closeCapturePanel,
  });

  const notifications = useToolbarNotifications({
    accessToken,
    navigate,
    closeSearch: search.closeSearch,
    closeQuickNav: quickNav.closeQuickNav,
    closeQuickNavPanel: quickNav.closeQuickNavPanel,
    closeProfile: profile.closeProfile,
    closeContextMenu: quickAdd.closeContextMenu,
    closeCapturePanel: capture.closeCapturePanel,
    quickNavOpen: quickNav.quickNavOpen,
    profileOpen: profile.profileOpen,
    contextMenuOpen: quickAdd.contextMenuOpen,
    captureOpen: capture.captureOpen,
    toolbarDialog: quickNav.toolbarDialog,
    quickAddDialog: quickAdd.quickAddDialog,
    searchOpen: search.searchOpen,
  });

  useEffect(() => {
    searchCloseRef.current = search.closeSearch;
    notificationsCloseRef.current = notifications.closeNotifications;
    quickNavCloseRef.current = quickNav.closeQuickNav;
    quickNavPanelCloseRef.current = quickNav.closeQuickNavPanel;
    profileCloseRef.current = profile.closeProfile;
  }, [notifications.closeNotifications, profile.closeProfile, quickNav.closeQuickNav, quickNav.closeQuickNavPanel, search.closeSearch]);

  const openQuickNavPanel = useCallback((panel: 'calendar' | 'tasks' | 'reminders') => {
    search.closeSearch();
    notifications.closeNotifications({ restoreFocus: false });
    quickNav.openQuickNavPanel(panel);
  }, [notifications, quickNav, search]);

  const closeContextMenu = quickAdd.closeContextMenu;
  const closeQuickNavPanel = quickNav.closeQuickNavPanel;

  const onQuickCapture = useCallback(() => {
    if (capture.captureOpen && !capture.captureIntent) {
      capture.closeCapturePanel();
      return;
    }

    closeToolbarSearch();
    closeToolbarNotifications({ restoreFocus: false });
    closeToolbarQuickNav({ restoreFocus: false });
    closeToolbarQuickNavPanel();
    closeToolbarProfile({ restoreFocus: false });
    closeContextMenu({ restoreFocus: false });
    capture.openCapturePanel(null, capture.captureTriggerRef.current);
  }, [
    capture,
    closeToolbarNotifications,
    closeToolbarProfile,
    closeToolbarQuickNav,
    closeToolbarQuickNavPanel,
    closeToolbarSearch,
    closeContextMenu,
  ]);

  useGlobalInteractionEffects({
    closeCapturePanel: capture.closeCapturePanel,
    closeQuickNav: quickNav.closeQuickNav,
    closeQuickNavPanel: quickNav.closeQuickNavPanel,
    openQuickNavPanel,
    closeProfile: profile.closeProfile,
    closeSearch: search.closeSearch,
    closeNotifications: notifications.closeNotifications,
    closeContextMenu: quickAdd.closeContextMenu,
    contextMenuOpen: quickAdd.contextMenuOpen,
    contextMenuRef: quickAdd.contextMenuRef,
    quickAddDialog: quickAdd.quickAddDialog,
  });

  const {
    calendarEvents: personalCalendarEvents,
    calendarLoading: personalCalendarLoading,
    calendarError: personalCalendarError,
    calendarMode: personalCalendarMode,
    setCalendarMode: setPersonalCalendarMode,
    refreshCalendar: refreshPersonalCalendar,
  } = usePersonalCalendarRuntime(accessToken ?? null, {
    autoload: true,
    subscribeToHomeRefresh: true,
  });

  const remindersRuntime = useRemindersRuntime(accessToken ?? null, {
    autoload: true,
    subscribeToHomeRefresh: true,
    subscribeToLive: true,
  });
  const refreshReminders = remindersRuntime.refresh;

  const onOpenCalendarRecordFromDialog = useCallback((recordId: string) => {
    const event = personalCalendarEvents.find((entry) => entry.record_id === recordId);
    const targetProjectId = event?.project_id || currentProjectId || capture.captureHomeData.personalProjectId;
    if (!targetProjectId) {
      return;
    }
    closeQuickNavPanel();
    navigate(`/projects/${encodeURIComponent(targetProjectId)}/work?record_id=${encodeURIComponent(recordId)}`);
  }, [capture.captureHomeData.personalProjectId, closeQuickNavPanel, currentProjectId, navigate, personalCalendarEvents]);

  const toolbarCalendarCreateProjectId =
    capture.captureHomeData.personalProjectId
    || projects.find((project) => project.isPersonal)?.id
    || null;

  const onCreateReminderFromModule = useCallback(async (payload: CreateReminderPayload) => {
    if (!accessToken) {
      throw new Error('An authenticated session is required.');
    }
    await createReminder(accessToken, payload);
    requestHubHomeRefresh();
    await refreshReminders();
  }, [accessToken, refreshReminders]);

  const onSnoozeReminderFromModule = useCallback(async (reminderId: string) => {
    if (!accessToken) {
      throw new Error('An authenticated session is required.');
    }
    await updateReminder(accessToken, reminderId, { remind_at: tomorrowAtNineIso() });
    requestHubHomeRefresh();
    await refreshReminders();
  }, [accessToken, refreshReminders]);

  return (
    <footer aria-label="App toolbar">
      <nav
        aria-label="App toolbar"
        className="relative flex h-12 shrink-0 items-center gap-sm border-t border-border-muted bg-surface-elevated px-md"
      >
        <ToolbarBreadcrumb
          isOnHubHome={isOnHubHome}
          navigate={navigate}
          breadcrumb={breadcrumb}
        />

        <ToolbarNav
          quickNavRef={quickNav.quickNavRef}
          quickNavTriggerRef={quickNav.quickNavTriggerRef}
          quickNavOpen={quickNav.quickNavOpen}
          closeQuickNav={quickNav.closeQuickNav}
          setQuickNavOpen={quickNav.setQuickNavOpen}
          setQuickNavActiveIndex={quickNav.setQuickNavActiveIndex}
          quickNavItems={quickNav.quickNavItems}
          closeSearch={search.closeSearch}
          closeProfile={profile.closeProfile}
          closeNotifications={notifications.closeNotifications}
          closeContextMenu={quickAdd.closeContextMenu}
          closeQuickNavPanel={quickNav.closeQuickNavPanel}
          closeCapturePanel={capture.closeCapturePanel}
          quickNavInputRef={quickNav.quickNavInputRef}
          quickNavQuery={quickNav.quickNavQuery}
          setQuickNavQuery={quickNav.setQuickNavQuery}
          normalizedQuickNavActiveIndex={quickNav.normalizedQuickNavActiveIndex}
          onSelectQuickNavItem={quickNav.onSelectQuickNavItem}
          quickNavDestinationItems={quickNav.quickNavDestinationItems}
        />

        <ToolbarPanels
          toolbarDialog={quickNav.toolbarDialog}
          openQuickNavPanel={openQuickNavPanel}
        />

        <ToolbarSearch
          searchRef={search.searchRef}
          searchQuery={search.searchQuery}
          setSearchQuery={search.setSearchQuery}
          setSearchActiveIndex={search.setSearchActiveIndex}
          searchDismissedRef={search.searchDismissedRef}
          setSearchOpen={search.setSearchOpen}
          closeQuickNav={quickNav.closeQuickNav}
          closeQuickNavPanel={quickNav.closeQuickNavPanel}
          closeProfile={profile.closeProfile}
          closeNotifications={notifications.closeNotifications}
          closeContextMenu={quickAdd.closeContextMenu}
          closeCapturePanel={capture.closeCapturePanel}
          searchOpen={search.searchOpen}
          searchLoading={search.searchLoading}
          normalizedSearchActiveIndex={search.normalizedSearchActiveIndex}
          searchResults={search.searchResults}
          onSelectSearchResult={search.onSelectSearchResult}
          closeSearch={search.closeSearch}
          searchError={search.searchError}
        />

        <ToolbarQuickAdd
          contextMenuRef={quickAdd.contextMenuRef}
          contextMenuTriggerRef={quickAdd.contextMenuTriggerRef}
          contextMenuOpen={quickAdd.contextMenuOpen}
          toggleQuickAddMenu={quickAdd.toggleQuickAddMenu}
          quickAddItemRefs={quickAdd.quickAddItemRefs}
          quickAddActiveIndex={quickAdd.quickAddActiveIndex}
          setQuickAddActiveIndex={quickAdd.setQuickAddActiveIndex}
          onQuickAddMenuItemKeyDown={quickAdd.onQuickAddMenuItemKeyDown}
          onSelectQuickAddOption={quickAdd.onSelectQuickAddOption}
        />

        <ToolbarThoughtPile
          captureOpen={capture.captureOpen}
          setCaptureOpen={capture.setCaptureOpen}
          captureTriggerRef={capture.captureTriggerRef}
          onQuickCapture={onQuickCapture}
          skipCaptureFocusRestoreRef={capture.skipCaptureFocusRestoreRef}
          captureRestoreTargetRef={capture.captureRestoreTargetRef}
          accessToken={accessToken}
          projects={projects}
          captureHomeData={capture.captureHomeData}
          captureLoading={capture.captureLoading}
          refreshCaptureData={capture.refreshCaptureData}
          preferredCaptureProjectId={capture.preferredCaptureProjectId}
          captureIntent={capture.captureIntent}
          captureActivationKey={capture.captureActivationKey}
          closeCapturePanel={capture.closeCapturePanel}
        />

        <CalendarDialog
          toolbarDialog={quickNav.toolbarDialog}
          closeQuickNavPanel={quickNav.closeQuickNavPanel}
          quickNavTriggerRef={quickNav.quickNavTriggerRef}
          personalCalendarError={personalCalendarError}
          refreshPersonalCalendar={refreshPersonalCalendar}
          personalCalendarEvents={personalCalendarEvents}
          personalCalendarLoading={personalCalendarLoading}
          personalCalendarMode={personalCalendarMode}
          setPersonalCalendarMode={setPersonalCalendarMode}
          onOpenCalendarRecordFromDialog={onOpenCalendarRecordFromDialog}
          accessToken={accessToken}
          toolbarCalendarCreateProjectId={toolbarCalendarCreateProjectId}
        />

        <TasksDialog
          toolbarDialog={quickNav.toolbarDialog}
          closeQuickNavPanel={quickNav.closeQuickNavPanel}
          quickNavTriggerRef={quickNav.quickNavTriggerRef}
          quickNavTasksError={quickNav.quickNavTasksError}
          refreshQuickNavTasks={quickNav.refreshQuickNavTasks}
          adaptedTasks={quickNav.adaptedTasks}
          quickNavTasksLoading={quickNav.quickNavTasksLoading}
          onCreateTaskFromModule={quickNav.onCreateTaskFromModule}
        />

        <RemindersDialog
          toolbarDialog={quickNav.toolbarDialog}
          closeQuickNavPanel={quickNav.closeQuickNavPanel}
          quickNavTriggerRef={quickNav.quickNavTriggerRef}
          remindersRuntime={remindersRuntime}
          onSnoozeReminderFromModule={onSnoozeReminderFromModule}
          onCreateReminderFromModule={onCreateReminderFromModule}
        />

        <QuickAddDialogs
          quickAddDialog={quickAdd.quickAddDialog}
          closeQuickAddDialog={quickAdd.closeQuickAddDialog}
          refreshCaptureData={capture.refreshCaptureData}
          accessToken={accessToken}
          quickAddProjectId={quickAdd.quickAddProjectId}
          selectedTaskProjectMembers={quickAdd.selectedTaskProjectMembers}
          contextMenuTriggerRef={quickAdd.contextMenuTriggerRef}
          quickAddProjectOptions={quickAdd.quickAddProjectOptions}
          taskTitleInputRef={quickAdd.taskTitleInputRef}
          setQuickAddProjectId={quickAdd.setQuickAddProjectId}
          loadTaskProjectMembers={quickAdd.loadTaskProjectMembers}
          onCreateQuickAddEvent={quickAdd.onCreateQuickAddEvent}
          eventTitle={quickAdd.eventTitle}
          setEventTitle={quickAdd.setEventTitle}
          eventStartAt={quickAdd.eventStartAt}
          setEventStartAt={quickAdd.setEventStartAt}
          eventEndAt={quickAdd.eventEndAt}
          setEventEndAt={quickAdd.setEventEndAt}
          eventSubmitting={quickAdd.eventSubmitting}
          eventError={quickAdd.eventError}
          eventTitleInputRef={quickAdd.eventTitleInputRef}
          reminderDraft={quickAdd.reminderDraft}
          setReminderDraft={quickAdd.setReminderDraft}
          reminderPreview={quickAdd.reminderPreview}
          onCreateQuickAddReminder={quickAdd.onCreateQuickAddReminder}
          reminderSubmitting={quickAdd.reminderSubmitting}
          reminderError={quickAdd.reminderError}
          setReminderError={quickAdd.setReminderError}
          reminderInputRef={quickAdd.reminderInputRef}
          personalReminderProjectLabel={quickAdd.personalReminderProjectLabel}
          projectDialogName={quickAdd.projectDialogName}
          setProjectDialogName={quickAdd.setProjectDialogName}
          onCreateQuickAddProject={quickAdd.onCreateQuickAddProject}
          projectDialogSubmitting={quickAdd.projectDialogSubmitting}
          projectDialogError={quickAdd.projectDialogError}
          projectNameInputRef={quickAdd.projectNameInputRef}
        />

        <ToolbarNotifications
          notificationsRef={notifications.notificationsRef}
          notificationsTriggerRef={notifications.notificationsTriggerRef}
          toggleNotifications={notifications.toggleNotifications}
          unreadNotifications={notifications.unreadNotifications}
          notificationsOpen={notifications.notificationsOpen}
          notifications={notifications.notifications}
          notifFilter={notifications.notifFilter}
          setNotifFilter={notifications.setNotifFilter}
          notifProjectFilter={notifications.notifProjectFilter}
          setNotifProjectFilter={notifications.setNotifProjectFilter}
          projects={projects}
          onNavigateNotification={notifications.onNavigateNotification}
          notificationsPanelRef={notifications.notificationsPanelRef}
        />

        <ToolbarProfile
          profileRef={profile.profileRef}
          profileTriggerRef={profile.profileTriggerRef}
          toggleProfile={profile.toggleProfile}
          closeNotifications={notifications.closeNotifications}
          closeSearch={search.closeSearch}
          closeQuickNav={quickNav.closeQuickNav}
          closeQuickNavPanel={quickNav.closeQuickNavPanel}
          closeContextMenu={quickAdd.closeContextMenu}
          closeCapturePanel={capture.closeCapturePanel}
          profileOpen={profile.profileOpen}
          avatarBroken={profile.avatarBroken}
          avatarUrl={profile.avatarUrl}
          sessionSummary={sessionSummary}
          setAvatarBroken={profile.setAvatarBroken}
          profileMenuRef={profile.profileMenuRef}
          hasCalendarFeedUrl={profile.hasCalendarFeedUrl}
          onCopyCalendarLink={profile.onCopyCalendarLink}
          installMenuLabel={profile.installMenuLabel}
          onInstallHubOs={profile.onInstallHubOs}
          onNavigateProjectsFromProfileMenu={profile.onNavigateProjectsFromProfileMenu}
          onLogoutFromProfileMenu={profile.onLogoutFromProfileMenu}
        />
      </nav>
    </footer>
  );
};
