import type {
  ComponentProps,
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  MutableRefObject,
  SetStateAction,
} from 'react';
import type { QuickCapturePanel } from '../../../features/QuickCapture';
import type { HubSearchResult } from '../../../services/hub/search';
import type { TaskCreateDialog } from '../../project-space/TaskCreateDialog';
import type { CalendarModuleSkin, CalendarScope } from '../../project-space/CalendarModuleSkin';
import type { RemindersModuleSkin } from '../../project-space/RemindersModuleSkin';
import type { TasksModuleSkin } from '../../project-space/TasksModuleSkin';
import type { QuickAddEventDialog, QuickAddProjectDialog, QuickAddReminderDialog } from '../QuickAddDialogs';
import type {
  NotificationFilter,
  QuickAddDialog,
  QuickAddOption,
  QuickNavActionItem,
  ToolbarDialog,
  ToolbarNotification,
} from '../appShellUtils';

export interface BottomToolbarProps {
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
  personalCalendarMode: CalendarScope;
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
