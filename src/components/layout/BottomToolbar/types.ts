import type {
  ComponentProps,
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  MutableRefObject,
  SetStateAction,
} from 'react';
import type { GlobalCapability, SessionSummary } from '../../../types/domain';
import type { QuickCapturePanel } from '../../../features/QuickCapture';
import type { TaskCreateDialog } from '../../project-space/TaskCreateDialog';
import type { CalendarModuleSkin, CalendarScope } from '../../project-space/CalendarModuleSkin';
import type { RemindersModuleSkin } from '../../project-space/RemindersModuleSkin';
import type { QuickAddEventDialog, QuickAddProjectDialog, QuickAddReminderDialog } from '../QuickAddDialogs';
import type {
  QuickAddDialog,
  QuickAddOption,
  ToolbarDialog,
} from '../appShellUtils';

export interface CloseQuickNavOptions {
  restoreFocus?: boolean;
}

export interface CloseNotificationsOptions {
  restoreFocus?: boolean;
}

export interface CloseProfileOptions {
  restoreFocus?: boolean;
}

export interface CloseContextMenuOptions {
  restoreFocus?: boolean;
}

export interface BottomToolbarProps {
  onSearchCloseAvailable?: (closeSearch: () => void) => void;
  onNotificationsCloseAvailable?: (closeNotifications: (options?: CloseNotificationsOptions) => void) => void;
  onQuickNavCloseAvailable?: (closeQuickNav: (options?: CloseQuickNavOptions) => void) => void;
  onQuickNavPanelCloseAvailable?: (closeQuickNavPanel: () => void) => void;
  onQuickNavPanelOpenAvailable?: (openQuickNavPanel: (panel: Exclude<ToolbarDialog, null>) => void) => void;
  onProfileCloseAvailable?: (closeProfile: (options?: CloseProfileOptions) => void) => void;
  isOnHubHome: boolean;
  navigate: (to: string) => void;
  breadcrumb: string[];
  canGlobal: (capability: GlobalCapability) => boolean;
  setContextMenuOpen: Dispatch<SetStateAction<boolean>>;
  closeContextMenu: (options?: CloseContextMenuOptions) => void;
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
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
  defaultTaskProjectId: string;
  captureLoading: boolean;
  refreshCaptureData: () => Promise<void>;
  preferredCaptureProjectId: string | null;
  captureIntent: string | null;
  captureActivationKey: number;
  personalCalendarError: string | null;
  refreshPersonalCalendar: () => Promise<void>;
  personalCalendarEvents: ComponentProps<typeof CalendarModuleSkin>['events'];
  personalCalendarLoading: ComponentProps<typeof CalendarModuleSkin>['loading'];
  personalCalendarMode: CalendarScope;
  setPersonalCalendarMode: (scope: CalendarScope) => void;
  onOpenCalendarRecordFromDialog: ComponentProps<typeof CalendarModuleSkin>['onOpenRecord'];
  toolbarCalendarCreateProjectId: string | null;
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
  sessionSummary: Pick<SessionSummary, 'name' | 'email' | 'userId'>;
  calendarFeedUrl: string;
  signOut: () => Promise<void>;
}
