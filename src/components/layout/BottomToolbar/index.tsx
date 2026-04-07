import { useCallback, useEffect } from 'react';
import { CalendarDialog } from './ToolbarDialogs/CalendarDialog';
import { QuickAddDialogs } from './ToolbarDialogs/QuickAddDialogs';
import { RemindersDialog } from './ToolbarDialogs/RemindersDialog';
import { TasksDialog } from './ToolbarDialogs/TasksDialog';
import { ToolbarBreadcrumb } from './ToolbarBreadcrumb';
import { useToolbarNotifications } from './hooks/useToolbarNotifications';
import { useToolbarProfile } from './hooks/useToolbarProfile';
import { useToolbarQuickNav } from './hooks/useToolbarQuickNav';
import { useToolbarSearch } from './hooks/useToolbarSearch';
import { ToolbarNav } from './ToolbarNav';
import { ToolbarNotifications } from './ToolbarNotifications';
import { ToolbarProfile } from './ToolbarProfile';
import { ToolbarQuickAdd } from './ToolbarQuickAdd';
import { ToolbarSearch } from './ToolbarSearch';
import { ToolbarThoughtPile } from './ToolbarThoughtPile';
import type { BottomToolbarProps } from './types';

export type {
  BottomToolbarProps,
  CloseContextMenuOptions,
  CloseNotificationsOptions,
  CloseProfileOptions,
  CloseQuickNavOptions,
} from './types';

export const BottomToolbar = (props: BottomToolbarProps) => {
  const {
    onSearchCloseAvailable,
    onNotificationsCloseAvailable,
    onQuickNavCloseAvailable,
    onQuickNavPanelCloseAvailable,
    onQuickNavPanelOpenAvailable,
    onProfileCloseAvailable,
  } = props;

  const profile = useToolbarProfile({
    sessionSummary: props.sessionSummary,
    calendarFeedUrl: props.calendarFeedUrl,
    navigate: props.navigate,
    signOut: props.signOut,
    contextMenuOpen: props.contextMenuOpen,
    captureOpen: props.captureOpen,
    quickAddDialog: props.quickAddDialog,
  });

  const quickNav = useToolbarQuickNav({
    accessToken: props.accessToken,
    canGlobal: props.canGlobal,
    navigate: props.navigate,
    projects: props.projects,
    defaultTaskProjectId: props.defaultTaskProjectId,
    closeProfile: profile.closeProfile,
    closeContextMenu: props.closeContextMenu,
    closeCapturePanel: props.closeCapturePanel,
    contextMenuOpen: props.contextMenuOpen,
    profileOpen: profile.profileOpen,
    captureOpen: props.captureOpen,
    quickAddDialog: props.quickAddDialog,
  });

  const search = useToolbarSearch({
    accessToken: props.accessToken,
    navigate: props.navigate,
    closeQuickNav: quickNav.closeQuickNav,
    closeQuickNavPanel: quickNav.closeQuickNavPanel,
    closeProfile: profile.closeProfile,
    closeContextMenu: props.closeContextMenu,
    closeCapturePanel: props.closeCapturePanel,
  });

  const notifications = useToolbarNotifications({
    accessToken: props.accessToken,
    navigate: props.navigate,
    closeSearch: search.closeSearch,
    closeQuickNav: quickNav.closeQuickNav,
    closeQuickNavPanel: quickNav.closeQuickNavPanel,
    closeProfile: profile.closeProfile,
    closeContextMenu: props.closeContextMenu,
    closeCapturePanel: props.closeCapturePanel,
    quickNavOpen: quickNav.quickNavOpen,
    profileOpen: profile.profileOpen,
    contextMenuOpen: props.contextMenuOpen,
    captureOpen: props.captureOpen,
    toolbarDialog: quickNav.toolbarDialog,
    quickAddDialog: props.quickAddDialog,
    searchOpen: search.searchOpen,
  });

  const openQuickNavPanel = useCallback((panel: 'calendar' | 'tasks' | 'reminders') => {
    search.closeSearch();
    notifications.closeNotifications({ restoreFocus: false });
    quickNav.openQuickNavPanel(panel);
  }, [notifications, quickNav, search]);

  useEffect(() => {
    onSearchCloseAvailable?.(search.closeSearch);
  }, [onSearchCloseAvailable, search.closeSearch]);

  useEffect(() => {
    onNotificationsCloseAvailable?.(notifications.closeNotifications);
  }, [notifications.closeNotifications, onNotificationsCloseAvailable]);

  useEffect(() => {
    onQuickNavCloseAvailable?.(quickNav.closeQuickNav);
  }, [onQuickNavCloseAvailable, quickNav.closeQuickNav]);

  useEffect(() => {
    onQuickNavPanelCloseAvailable?.(quickNav.closeQuickNavPanel);
  }, [onQuickNavPanelCloseAvailable, quickNav.closeQuickNavPanel]);

  useEffect(() => {
    onQuickNavPanelOpenAvailable?.(openQuickNavPanel);
  }, [onQuickNavPanelOpenAvailable, openQuickNavPanel]);

  useEffect(() => {
    onProfileCloseAvailable?.(profile.closeProfile);
  }, [onProfileCloseAvailable, profile.closeProfile]);

  return (
    <footer aria-label="App toolbar">
      <nav
        aria-label="App toolbar"
        className="relative flex h-12 shrink-0 items-center gap-sm border-t border-border-muted bg-surface-elevated px-md"
      >
        <ToolbarBreadcrumb
          isOnHubHome={props.isOnHubHome}
          navigate={props.navigate}
          breadcrumb={props.breadcrumb}
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
          closeContextMenu={props.closeContextMenu}
          closeQuickNavPanel={quickNav.closeQuickNavPanel}
          closeCapturePanel={props.closeCapturePanel}
          quickNavInputRef={quickNav.quickNavInputRef}
          quickNavQuery={quickNav.quickNavQuery}
          setQuickNavQuery={quickNav.setQuickNavQuery}
          normalizedQuickNavActiveIndex={quickNav.normalizedQuickNavActiveIndex}
          onSelectQuickNavItem={quickNav.onSelectQuickNavItem}
          quickNavDestinationItems={quickNav.quickNavDestinationItems}
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
          closeContextMenu={props.closeContextMenu}
          closeCapturePanel={props.closeCapturePanel}
          searchOpen={search.searchOpen}
          searchLoading={search.searchLoading}
          normalizedSearchActiveIndex={search.normalizedSearchActiveIndex}
          searchResults={search.searchResults}
          onSelectSearchResult={search.onSelectSearchResult}
          closeSearch={search.closeSearch}
          searchError={search.searchError}
        />

        <ToolbarQuickAdd
          contextMenuRef={props.contextMenuRef}
          contextMenuTriggerRef={props.contextMenuTriggerRef}
          contextMenuOpen={props.contextMenuOpen}
          toggleQuickAddMenu={props.toggleQuickAddMenu}
          quickAddItemRefs={props.quickAddItemRefs}
          quickAddActiveIndex={props.quickAddActiveIndex}
          setQuickAddActiveIndex={props.setQuickAddActiveIndex}
          onQuickAddMenuItemKeyDown={props.onQuickAddMenuItemKeyDown}
          onSelectQuickAddOption={props.onSelectQuickAddOption}
        />

        <ToolbarThoughtPile
          captureOpen={props.captureOpen}
          setCaptureOpen={props.setCaptureOpen}
          captureTriggerRef={props.captureTriggerRef}
          onQuickCapture={props.onQuickCapture}
          skipCaptureFocusRestoreRef={props.skipCaptureFocusRestoreRef}
          captureRestoreTargetRef={props.captureRestoreTargetRef}
          accessToken={props.accessToken}
          projects={props.projects}
          captureHomeData={props.captureHomeData}
          captureLoading={props.captureLoading}
          refreshCaptureData={props.refreshCaptureData}
          preferredCaptureProjectId={props.preferredCaptureProjectId}
          captureIntent={props.captureIntent}
          captureActivationKey={props.captureActivationKey}
          closeCapturePanel={props.closeCapturePanel}
        />

        <CalendarDialog
          toolbarDialog={quickNav.toolbarDialog}
          closeQuickNavPanel={quickNav.closeQuickNavPanel}
          quickNavTriggerRef={quickNav.quickNavTriggerRef}
          personalCalendarError={props.personalCalendarError}
          refreshPersonalCalendar={props.refreshPersonalCalendar}
          personalCalendarEvents={props.personalCalendarEvents}
          personalCalendarLoading={props.personalCalendarLoading}
          personalCalendarMode={props.personalCalendarMode}
          setPersonalCalendarMode={props.setPersonalCalendarMode}
          onOpenCalendarRecordFromDialog={props.onOpenCalendarRecordFromDialog}
          accessToken={props.accessToken}
          toolbarCalendarCreateProjectId={props.toolbarCalendarCreateProjectId}
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
          remindersRuntime={props.remindersRuntime}
          onSnoozeReminderFromModule={props.onSnoozeReminderFromModule}
          onCreateReminderFromModule={props.onCreateReminderFromModule}
        />

        <QuickAddDialogs
          quickAddDialog={props.quickAddDialog}
          closeQuickAddDialog={props.closeQuickAddDialog}
          refreshCaptureData={props.refreshCaptureData}
          accessToken={props.accessToken}
          quickAddProjectId={props.quickAddProjectId}
          selectedTaskProjectMembers={props.selectedTaskProjectMembers}
          contextMenuTriggerRef={props.contextMenuTriggerRef}
          quickAddProjectOptions={props.quickAddProjectOptions}
          taskTitleInputRef={props.taskTitleInputRef}
          setQuickAddProjectId={props.setQuickAddProjectId}
          loadTaskProjectMembers={props.loadTaskProjectMembers}
          onCreateQuickAddEvent={props.onCreateQuickAddEvent}
          eventTitle={props.eventTitle}
          setEventTitle={props.setEventTitle}
          eventStartAt={props.eventStartAt}
          setEventStartAt={props.setEventStartAt}
          eventEndAt={props.eventEndAt}
          setEventEndAt={props.setEventEndAt}
          eventSubmitting={props.eventSubmitting}
          eventError={props.eventError}
          eventTitleInputRef={props.eventTitleInputRef}
          reminderDraft={props.reminderDraft}
          setReminderDraft={props.setReminderDraft}
          reminderPreview={props.reminderPreview}
          onCreateQuickAddReminder={props.onCreateQuickAddReminder}
          reminderSubmitting={props.reminderSubmitting}
          reminderError={props.reminderError}
          setReminderError={props.setReminderError}
          reminderInputRef={props.reminderInputRef}
          personalReminderProjectLabel={props.personalReminderProjectLabel}
          projectDialogName={props.projectDialogName}
          setProjectDialogName={props.setProjectDialogName}
          onCreateQuickAddProject={props.onCreateQuickAddProject}
          projectDialogSubmitting={props.projectDialogSubmitting}
          projectDialogError={props.projectDialogError}
          projectNameInputRef={props.projectNameInputRef}
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
          projects={props.projects}
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
          closeContextMenu={props.closeContextMenu}
          closeCapturePanel={props.closeCapturePanel}
          profileOpen={profile.profileOpen}
          avatarBroken={profile.avatarBroken}
          avatarUrl={profile.avatarUrl}
          sessionSummary={props.sessionSummary}
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
