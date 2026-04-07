import {
  type ComponentProps,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { QuickCapturePanel } from '../../../features/QuickCapture';
import { requestHubHomeRefresh } from '../../../lib/hubHomeRefresh';
import { createEventFromNlp } from '../../../services/hub/records';
import type { HubSearchResult } from '../../../services/hub/search';
import { TaskCreateDialog } from '../../project-space/TaskCreateDialog';
import { CalendarModuleSkin, type CalendarScope } from '../../project-space/CalendarModuleSkin';
import { RemindersModuleSkin } from '../../project-space/RemindersModuleSkin';
import { TasksModuleSkin } from '../../project-space/TasksModuleSkin';
import { Dialog, Icon, Popover, PopoverAnchor, PopoverContent } from '../../primitives';
import { NotificationsPanel } from '../NotificationsPanel';
import { ProfileMenu } from '../ProfileMenu';
import { QuickAddEventDialog, QuickAddProjectDialog, QuickAddReminderDialog } from '../QuickAddDialogs';
import {
  buildSearchResultHref,
  QUICK_ADD_OPTIONS,
  QUICK_NAV_FIXED_ITEMS,
  SEARCH_RESULT_TYPE_LABELS,
  type NotificationFilter,
  type QuickAddDialog,
  type QuickAddOption,
  type QuickNavActionItem,
  type ToolbarDialog,
  type ToolbarNotification,
} from '../appShellUtils';

interface BottomToolbarProps {
  isOnHubHome: boolean;
  navigate: (to: string) => void;
  breadcrumb: string[];
  quickNavRef: MutableRefObject<HTMLDivElement | null>;
  quickNavTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  quickNavOpen: boolean;
  closeQuickNav: () => void;
  setQuickNavOpen: Dispatch<SetStateAction<boolean>>;
  setQuickNavActiveIndex: Dispatch<SetStateAction<number>>;
  quickNavItems: QuickNavActionItem[];
  closeSearch: () => void;
  setProfileOpen: Dispatch<SetStateAction<boolean>>;
  setNotificationsOpen: Dispatch<SetStateAction<boolean>>;
  setContextMenuOpen: Dispatch<SetStateAction<boolean>>;
  closeQuickNavPanel: () => void;
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  quickNavInputRef: MutableRefObject<HTMLInputElement | null>;
  quickNavQuery: string;
  setQuickNavQuery: Dispatch<SetStateAction<string>>;
  normalizedQuickNavActiveIndex: number;
  onSelectQuickNavItem: (item: QuickNavActionItem) => void;
  quickNavDestinationItems: QuickNavActionItem[];
  searchRef: MutableRefObject<HTMLDivElement | null>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setSearchActiveIndex: Dispatch<SetStateAction<number>>;
  searchDismissedRef: MutableRefObject<boolean>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  searchOpen: boolean;
  searchResults: HubSearchResult[];
  searchLoading: boolean;
  normalizedSearchActiveIndex: number;
  onSelectSearchResult: (result: HubSearchResult) => void;
  searchError: string | null;
  contextMenuRef: MutableRefObject<HTMLDivElement | null>;
  contextMenuTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  contextMenuOpen: boolean;
  toggleQuickAddMenu: () => void;
  quickAddItemRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  quickAddActiveIndex: number;
  setQuickAddActiveIndex: Dispatch<SetStateAction<number>>;
  onQuickAddMenuItemKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => void;
  onSelectQuickAddOption: (option: QuickAddOption) => void;
  captureOpen: boolean;
  setCaptureOpen: Dispatch<SetStateAction<boolean>>;
  captureTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  onQuickCapture: () => void;
  skipCaptureFocusRestoreRef: MutableRefObject<boolean>;
  captureRestoreTargetRef: MutableRefObject<HTMLElement | null>;
  accessToken: string | undefined;
  projects: ComponentProps<typeof QuickCapturePanel>['projects'];
  captureHomeData: {
    personalProjectId: string | null;
    captures: ComponentProps<typeof QuickCapturePanel>['captures'];
  };
  captureLoading: boolean;
  refreshCaptureData: () => Promise<void>;
  preferredCaptureProjectId: string | null;
  captureIntent: string | null;
  captureActivationKey: number;
  toolbarDialog: ToolbarDialog;
  personalCalendarError: string | null;
  refreshPersonalCalendar: () => Promise<void>;
  personalCalendarEvents: ComponentProps<typeof CalendarModuleSkin>['events'];
  personalCalendarLoading: ComponentProps<typeof CalendarModuleSkin>['loading'];
  personalCalendarMode: string;
  setPersonalCalendarMode: (scope: CalendarScope) => void;
  onOpenCalendarRecordFromDialog: ComponentProps<typeof CalendarModuleSkin>['onOpenRecord'];
  toolbarCalendarCreateProjectId: string | null;
  quickNavTasksError: string | null;
  refreshQuickNavTasks: () => Promise<void>;
  adaptedTasks: ComponentProps<typeof TasksModuleSkin>['tasks'];
  quickNavTasksLoading: ComponentProps<typeof TasksModuleSkin>['tasksLoading'];
  onCreateTaskFromModule: ComponentProps<typeof TasksModuleSkin>['onCreateTask'];
  remindersRuntime: {
    reminders: ComponentProps<typeof RemindersModuleSkin>['reminders'];
    loading: ComponentProps<typeof RemindersModuleSkin>['loading'];
    error: ComponentProps<typeof RemindersModuleSkin>['error'];
    dismiss: ComponentProps<typeof RemindersModuleSkin>['onDismiss'];
  };
  onSnoozeReminderFromModule: ComponentProps<typeof RemindersModuleSkin>['onSnooze'];
  onCreateReminderFromModule: ComponentProps<typeof RemindersModuleSkin>['onCreate'];
  quickAddDialog: QuickAddDialog;
  closeQuickAddDialog: () => void;
  quickAddProjectId: string;
  selectedTaskProjectMembers: Array<{ user_id: string; display_name: string }>;
  quickAddProjectOptions: ComponentProps<typeof QuickAddEventDialog>['projectOptions'];
  taskTitleInputRef: ComponentProps<typeof TaskCreateDialog>['titleInputRef'];
  setQuickAddProjectId: Dispatch<SetStateAction<string>>;
  loadTaskProjectMembers: (projectId: string) => Promise<void>;
  onCreateQuickAddEvent: ComponentProps<typeof QuickAddEventDialog>['onSubmit'];
  eventTitle: string;
  setEventTitle: Dispatch<SetStateAction<string>>;
  eventStartAt: string;
  setEventStartAt: Dispatch<SetStateAction<string>>;
  eventEndAt: string;
  setEventEndAt: Dispatch<SetStateAction<string>>;
  eventSubmitting: boolean;
  eventError: string | null;
  eventTitleInputRef: ComponentProps<typeof QuickAddEventDialog>['titleInputRef'];
  reminderDraft: ComponentProps<typeof QuickAddReminderDialog>['draft'];
  setReminderDraft: ComponentProps<typeof QuickAddReminderDialog>['onDraftChange'];
  reminderPreview: ComponentProps<typeof QuickAddReminderDialog>['preview'];
  onCreateQuickAddReminder: ComponentProps<typeof QuickAddReminderDialog>['onSubmit'];
  reminderSubmitting: boolean;
  reminderError: string | null;
  setReminderError: Dispatch<SetStateAction<string | null>>;
  reminderInputRef: ComponentProps<typeof QuickAddReminderDialog>['inputRef'];
  personalReminderProjectLabel: string;
  projectDialogName: string;
  setProjectDialogName: Dispatch<SetStateAction<string>>;
  onCreateQuickAddProject: ComponentProps<typeof QuickAddProjectDialog>['onSubmit'];
  projectDialogSubmitting: boolean;
  projectDialogError: string | null;
  projectNameInputRef: ComponentProps<typeof QuickAddProjectDialog>['nameInputRef'];
  notificationsRef: MutableRefObject<HTMLDivElement | null>;
  notificationsTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  unreadNotifications: number;
  notificationsOpen: boolean;
  notifications: ToolbarNotification[];
  notifFilter: NotificationFilter;
  setNotifFilter: Dispatch<SetStateAction<NotificationFilter>>;
  notifProjectFilter: string | null;
  setNotifProjectFilter: Dispatch<SetStateAction<string | null>>;
  onNavigateNotification: (notification: ToolbarNotification) => void;
  notificationsPanelRef: MutableRefObject<HTMLDivElement | null>;
  profileRef: MutableRefObject<HTMLDivElement | null>;
  profileTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  profileOpen: boolean;
  avatarBroken: boolean;
  avatarUrl: string;
  sessionSummary: { name: string; email: string };
  setAvatarBroken: Dispatch<SetStateAction<boolean>>;
  profileMenuRef: MutableRefObject<HTMLDivElement | null>;
  hasCalendarFeedUrl: boolean;
  onCopyCalendarLink: () => void;
  installMenuLabel: string | null;
  onInstallHubOs: () => Promise<void>;
  onNavigateProjectsFromProfileMenu: () => void;
  onLogoutFromProfileMenu: () => void;
}

export const BottomToolbar = ({
  isOnHubHome,
  navigate,
  breadcrumb,
  quickNavRef,
  quickNavTriggerRef,
  quickNavOpen,
  closeQuickNav,
  setQuickNavOpen,
  setQuickNavActiveIndex,
  quickNavItems,
  closeSearch,
  setProfileOpen,
  setNotificationsOpen,
  setContextMenuOpen,
  closeQuickNavPanel,
  closeCapturePanel,
  quickNavInputRef,
  quickNavQuery,
  setQuickNavQuery,
  normalizedQuickNavActiveIndex,
  onSelectQuickNavItem,
  quickNavDestinationItems,
  searchRef,
  searchQuery,
  setSearchQuery,
  setSearchActiveIndex,
  searchDismissedRef,
  setSearchOpen,
  searchOpen,
  searchResults,
  searchLoading,
  normalizedSearchActiveIndex,
  onSelectSearchResult,
  searchError,
  contextMenuRef,
  contextMenuTriggerRef,
  contextMenuOpen,
  toggleQuickAddMenu,
  quickAddItemRefs,
  quickAddActiveIndex,
  setQuickAddActiveIndex,
  onQuickAddMenuItemKeyDown,
  onSelectQuickAddOption,
  captureOpen,
  setCaptureOpen,
  captureTriggerRef,
  onQuickCapture,
  skipCaptureFocusRestoreRef,
  captureRestoreTargetRef,
  accessToken,
  projects,
  captureHomeData,
  captureLoading,
  refreshCaptureData,
  preferredCaptureProjectId,
  captureIntent,
  captureActivationKey,
  toolbarDialog,
  personalCalendarError,
  refreshPersonalCalendar,
  personalCalendarEvents,
  personalCalendarLoading,
  personalCalendarMode,
  setPersonalCalendarMode,
  onOpenCalendarRecordFromDialog,
  toolbarCalendarCreateProjectId,
  quickNavTasksError,
  refreshQuickNavTasks,
  adaptedTasks,
  quickNavTasksLoading,
  onCreateTaskFromModule,
  remindersRuntime,
  onSnoozeReminderFromModule,
  onCreateReminderFromModule,
  quickAddDialog,
  closeQuickAddDialog,
  quickAddProjectId,
  selectedTaskProjectMembers,
  quickAddProjectOptions,
  taskTitleInputRef,
  setQuickAddProjectId,
  loadTaskProjectMembers,
  onCreateQuickAddEvent,
  eventTitle,
  setEventTitle,
  eventStartAt,
  setEventStartAt,
  eventEndAt,
  setEventEndAt,
  eventSubmitting,
  eventError,
  eventTitleInputRef,
  reminderDraft,
  setReminderDraft,
  reminderPreview,
  onCreateQuickAddReminder,
  reminderSubmitting,
  reminderError,
  setReminderError,
  reminderInputRef,
  personalReminderProjectLabel,
  projectDialogName,
  setProjectDialogName,
  onCreateQuickAddProject,
  projectDialogSubmitting,
  projectDialogError,
  projectNameInputRef,
  notificationsRef,
  notificationsTriggerRef,
  unreadNotifications,
  notificationsOpen,
  notifications,
  notifFilter,
  setNotifFilter,
  notifProjectFilter,
  setNotifProjectFilter,
  onNavigateNotification,
  notificationsPanelRef,
  profileRef,
  profileTriggerRef,
  profileOpen,
  avatarBroken,
  avatarUrl,
  sessionSummary,
  setAvatarBroken,
  profileMenuRef,
  hasCalendarFeedUrl,
  onCopyCalendarLink,
  installMenuLabel,
  onInstallHubOs,
  onNavigateProjectsFromProfileMenu,
  onLogoutFromProfileMenu,
}: BottomToolbarProps) => (
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
        panelClassName="dialog-panel-expanded-size !top-[calc(50%-1.5rem)] !h-[calc(100vh-5rem)] !max-h-[calc(100vh-5rem)] flex flex-col overflow-hidden"
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
        panelClassName="dialog-panel-wide-size !top-[calc(50%-1.5rem)] !h-[calc(100vh-5rem)] !max-h-[calc(100vh-5rem)] flex flex-col overflow-hidden"
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
        panelClassName="dialog-panel-compact-size"
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
            onCopyCalendarLink={hasCalendarFeedUrl ? () => {
              void onCopyCalendarLink();
            } : undefined}
            installLabel={installMenuLabel}
            onInstall={
              installMenuLabel
                ? () => {
                  void onInstallHubOs();
                }
                : undefined
            }
            onNavigateProjects={onNavigateProjectsFromProfileMenu}
            onLogout={onLogoutFromProfileMenu}
          />
        ) : null}
      </div>
    </nav>
  </footer>
);
