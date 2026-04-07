import { useEffect } from 'react';
import { CalendarDialog } from './ToolbarDialogs/CalendarDialog';
import { QuickAddDialogs } from './ToolbarDialogs/QuickAddDialogs';
import { RemindersDialog } from './ToolbarDialogs/RemindersDialog';
import { TasksDialog } from './ToolbarDialogs/TasksDialog';
import { ToolbarBreadcrumb } from './ToolbarBreadcrumb';
import { useToolbarNotifications } from './hooks/useToolbarNotifications';
import { useToolbarSearch } from './hooks/useToolbarSearch';
import { ToolbarNav } from './ToolbarNav';
import { ToolbarNotifications } from './ToolbarNotifications';
import { ToolbarProfile } from './ToolbarProfile';
import { ToolbarQuickAdd } from './ToolbarQuickAdd';
import { ToolbarSearch } from './ToolbarSearch';
import { ToolbarThoughtPile } from './ToolbarThoughtPile';
import type { BottomToolbarProps } from './types';

export type { BottomToolbarProps } from './types';

export const BottomToolbar = (props: BottomToolbarProps) => {
  const { onSearchCloseAvailable, onNotificationsCloseAvailable } = props;

  const search = useToolbarSearch({
    accessToken: props.accessToken,
    navigate: props.navigate,
    closeQuickNav: props.closeQuickNav,
    closeQuickNavPanel: props.closeQuickNavPanel,
    setProfileOpen: props.setProfileOpen,
    setContextMenuOpen: props.setContextMenuOpen,
    closeCapturePanel: props.closeCapturePanel,
  });

  const notifications = useToolbarNotifications({
    accessToken: props.accessToken,
    navigate: props.navigate,
    closeSearch: search.closeSearch,
    closeQuickNav: props.closeQuickNav,
    closeQuickNavPanel: props.closeQuickNavPanel,
    setProfileOpen: props.setProfileOpen,
    setContextMenuOpen: props.setContextMenuOpen,
    closeCapturePanel: props.closeCapturePanel,
    quickNavOpen: props.quickNavOpen,
    profileOpen: props.profileOpen,
    contextMenuOpen: props.contextMenuOpen,
    captureOpen: props.captureOpen,
    toolbarDialog: props.toolbarDialog,
    quickAddDialog: props.quickAddDialog,
    searchOpen: search.searchOpen,
  });

  useEffect(() => {
    onSearchCloseAvailable?.(search.closeSearch);
  }, [onSearchCloseAvailable, search.closeSearch]);

  useEffect(() => {
    onNotificationsCloseAvailable?.(notifications.closeNotifications);
  }, [notifications.closeNotifications, onNotificationsCloseAvailable]);

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
          quickNavRef={props.quickNavRef}
          quickNavTriggerRef={props.quickNavTriggerRef}
          quickNavOpen={props.quickNavOpen}
          closeQuickNav={props.closeQuickNav}
          setQuickNavOpen={props.setQuickNavOpen}
          setQuickNavActiveIndex={props.setQuickNavActiveIndex}
          quickNavItems={props.quickNavItems}
          closeSearch={search.closeSearch}
          setProfileOpen={props.setProfileOpen}
          closeNotifications={notifications.closeNotifications}
          setContextMenuOpen={props.setContextMenuOpen}
          closeQuickNavPanel={props.closeQuickNavPanel}
          closeCapturePanel={props.closeCapturePanel}
          quickNavInputRef={props.quickNavInputRef}
          quickNavQuery={props.quickNavQuery}
          setQuickNavQuery={props.setQuickNavQuery}
          normalizedQuickNavActiveIndex={props.normalizedQuickNavActiveIndex}
          onSelectQuickNavItem={props.onSelectQuickNavItem}
          quickNavDestinationItems={props.quickNavDestinationItems}
        />

        <ToolbarSearch
          searchRef={search.searchRef}
          searchQuery={search.searchQuery}
          setSearchQuery={search.setSearchQuery}
          setSearchActiveIndex={search.setSearchActiveIndex}
          searchDismissedRef={search.searchDismissedRef}
          setSearchOpen={search.setSearchOpen}
          closeQuickNav={props.closeQuickNav}
          closeQuickNavPanel={props.closeQuickNavPanel}
          setProfileOpen={props.setProfileOpen}
          closeNotifications={notifications.closeNotifications}
          setContextMenuOpen={props.setContextMenuOpen}
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
          toolbarDialog={props.toolbarDialog}
          closeQuickNavPanel={props.closeQuickNavPanel}
          quickNavTriggerRef={props.quickNavTriggerRef}
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
          toolbarDialog={props.toolbarDialog}
          closeQuickNavPanel={props.closeQuickNavPanel}
          quickNavTriggerRef={props.quickNavTriggerRef}
          quickNavTasksError={props.quickNavTasksError}
          refreshQuickNavTasks={props.refreshQuickNavTasks}
          adaptedTasks={props.adaptedTasks}
          quickNavTasksLoading={props.quickNavTasksLoading}
          onCreateTaskFromModule={props.onCreateTaskFromModule}
        />

        <RemindersDialog
          toolbarDialog={props.toolbarDialog}
          closeQuickNavPanel={props.closeQuickNavPanel}
          quickNavTriggerRef={props.quickNavTriggerRef}
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
          profileRef={props.profileRef}
          profileTriggerRef={props.profileTriggerRef}
          setProfileOpen={props.setProfileOpen}
          closeNotifications={notifications.closeNotifications}
          closeSearch={search.closeSearch}
          closeQuickNav={props.closeQuickNav}
          closeQuickNavPanel={props.closeQuickNavPanel}
          setContextMenuOpen={props.setContextMenuOpen}
          closeCapturePanel={props.closeCapturePanel}
          profileOpen={props.profileOpen}
          avatarBroken={props.avatarBroken}
          avatarUrl={props.avatarUrl}
          sessionSummary={props.sessionSummary}
          setAvatarBroken={props.setAvatarBroken}
          profileMenuRef={props.profileMenuRef}
          hasCalendarFeedUrl={props.hasCalendarFeedUrl}
          onCopyCalendarLink={props.onCopyCalendarLink}
          installMenuLabel={props.installMenuLabel}
          onInstallHubOs={props.onInstallHubOs}
          onNavigateProjectsFromProfileMenu={props.onNavigateProjectsFromProfileMenu}
          onLogoutFromProfileMenu={props.onLogoutFromProfileMenu}
        />
      </nav>
    </footer>
  );
};
