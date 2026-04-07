import { CalendarDialog } from './ToolbarDialogs/CalendarDialog';
import { QuickAddDialogs } from './ToolbarDialogs/QuickAddDialogs';
import { RemindersDialog } from './ToolbarDialogs/RemindersDialog';
import { TasksDialog } from './ToolbarDialogs/TasksDialog';
import { ToolbarBreadcrumb } from './ToolbarBreadcrumb';
import { ToolbarNav } from './ToolbarNav';
import { ToolbarNotifications } from './ToolbarNotifications';
import { ToolbarProfile } from './ToolbarProfile';
import { ToolbarQuickAdd } from './ToolbarQuickAdd';
import { ToolbarSearch } from './ToolbarSearch';
import { ToolbarThoughtPile } from './ToolbarThoughtPile';
import type { BottomToolbarProps } from './types';

export type { BottomToolbarProps } from './types';

export const BottomToolbar = (props: BottomToolbarProps) => (
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
        closeSearch={props.closeSearch}
        setProfileOpen={props.setProfileOpen}
        setNotificationsOpen={props.setNotificationsOpen}
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
        searchRef={props.searchRef}
        searchQuery={props.searchQuery}
        setSearchQuery={props.setSearchQuery}
        setSearchActiveIndex={props.setSearchActiveIndex}
        searchDismissedRef={props.searchDismissedRef}
        setSearchOpen={props.setSearchOpen}
        closeQuickNav={props.closeQuickNav}
        closeQuickNavPanel={props.closeQuickNavPanel}
        setProfileOpen={props.setProfileOpen}
        setNotificationsOpen={props.setNotificationsOpen}
        setContextMenuOpen={props.setContextMenuOpen}
        closeCapturePanel={props.closeCapturePanel}
        searchOpen={props.searchOpen}
        searchLoading={props.searchLoading}
        normalizedSearchActiveIndex={props.normalizedSearchActiveIndex}
        searchResults={props.searchResults}
        onSelectSearchResult={props.onSelectSearchResult}
        closeSearch={props.closeSearch}
        searchError={props.searchError}
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
        notificationsRef={props.notificationsRef}
        notificationsTriggerRef={props.notificationsTriggerRef}
        setNotificationsOpen={props.setNotificationsOpen}
        setProfileOpen={props.setProfileOpen}
        closeSearch={props.closeSearch}
        closeQuickNav={props.closeQuickNav}
        closeQuickNavPanel={props.closeQuickNavPanel}
        setContextMenuOpen={props.setContextMenuOpen}
        closeCapturePanel={props.closeCapturePanel}
        unreadNotifications={props.unreadNotifications}
        notificationsOpen={props.notificationsOpen}
        notifications={props.notifications}
        notifFilter={props.notifFilter}
        setNotifFilter={props.setNotifFilter}
        notifProjectFilter={props.notifProjectFilter}
        setNotifProjectFilter={props.setNotifProjectFilter}
        projects={props.projects}
        onNavigateNotification={props.onNavigateNotification}
        notificationsPanelRef={props.notificationsPanelRef}
      />

      <ToolbarProfile
        profileRef={props.profileRef}
        profileTriggerRef={props.profileTriggerRef}
        setProfileOpen={props.setProfileOpen}
        setNotificationsOpen={props.setNotificationsOpen}
        closeSearch={props.closeSearch}
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
