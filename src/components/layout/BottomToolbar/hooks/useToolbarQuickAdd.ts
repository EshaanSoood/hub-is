import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { useCalendarNLDraft } from '../../../../hooks/useCalendarNLDraft';
import { mapReminderFailureReasonToMessage, useReminderNLDraft } from '../../../../hooks/useReminderNLDraft';
import { requestHubHomeRefresh } from '../../../../lib/hubHomeRefresh';
import { createEventFromNlp } from '../../../../services/hub/records';
import { createReminder } from '../../../../services/hub/reminders';
import { listProjectMembers } from '../../../../services/hub/projects';
import type { HubProjectMember } from '../../../../services/hub/types';
import { createHubProject } from '../../../../services/projectsService';
import type { ProjectRecord } from '../../../../types/domain';
import {
  focusElementSoon,
  focusFirstDescendantSoon,
  nowPlusHours,
  QUICK_ADD_OPTIONS,
  toDateTimeLocalInput,
  type QuickAddDialog,
  type QuickAddOption,
} from '../../appShellUtils';
import type {
  CloseContextMenuOptions,
  CloseNotificationsOptions,
  CloseProfileOptions,
  CloseQuickNavOptions,
} from '../types';
import type { ToolbarCaptureHomeData } from './useToolbarCapture';
import { useQuickAddEffects } from './useQuickAddEffects';
import { useQuickAddProjectRequestEffect } from './useQuickAddProjectRequestEffect';

const getDefaultQuickAddProjectId = ({
  projects,
  preferredCaptureProjectId,
  currentProjectId,
  personalProjectId,
}: {
  projects: ProjectRecord[];
  preferredCaptureProjectId: string | null;
  currentProjectId: string | null;
  personalProjectId: string | null;
}): string => {
  if (preferredCaptureProjectId && projects.some((project) => project.id === preferredCaptureProjectId)) {
    return preferredCaptureProjectId;
  }
  if (currentProjectId && projects.some((project) => project.id === currentProjectId)) {
    return currentProjectId;
  }
  if (personalProjectId && projects.some((project) => project.id === personalProjectId)) {
    return personalProjectId;
  }
  const firstPersonalProjectId = projects.find((project) => project.isPersonal)?.id;
  if (firstPersonalProjectId) {
    return firstPersonalProjectId;
  }
  return projects[0]?.id || '';
};

interface UseToolbarQuickAddArgs {
  accessToken: string | null | undefined;
  projects: ProjectRecord[];
  currentProjectId: string | null;
  captureHomeData: ToolbarCaptureHomeData;
  preferredCaptureProjectId: string | null;
  refreshCaptureData: () => Promise<ToolbarCaptureHomeData>;
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  closeQuickNav: (options?: CloseQuickNavOptions) => void;
  closeQuickNavPanel: () => void;
  closeProfile: (options?: CloseProfileOptions) => void;
  closeSearch: () => void;
  closeNotifications: (options?: CloseNotificationsOptions) => void;
  captureOpen: boolean;
  navigate: (to: string) => void;
  upsertProject: (project: ProjectRecord) => void;
}

export interface UseToolbarQuickAddResult {
  contextMenuRef: MutableRefObject<HTMLDivElement | null>;
  contextMenuTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  contextMenuOpen: boolean;
  closeContextMenu: (options?: CloseContextMenuOptions) => void;
  toggleQuickAddMenu: () => void;
  quickAddItemRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  quickAddActiveIndex: number;
  setQuickAddActiveIndex: Dispatch<SetStateAction<number>>;
  quickAddDialog: QuickAddDialog;
  closeQuickAddDialog: () => void;
  quickAddProjectId: string;
  setQuickAddProjectId: Dispatch<SetStateAction<string>>;
  selectedTaskProjectMembers: HubProjectMember[];
  quickAddProjectOptions: Array<{ value: string; label: string }>;
  taskTitleInputRef: MutableRefObject<HTMLInputElement | null>;
  eventNLInputRef: MutableRefObject<HTMLInputElement | null>;
  eventTitleInputRef: MutableRefObject<HTMLInputElement | null>;
  reminderInputRef: MutableRefObject<HTMLInputElement | null>;
  projectNameInputRef: MutableRefObject<HTMLInputElement | null>;
  loadTaskProjectMembers: (projectId: string) => Promise<void>;
  onSelectQuickAddOption: (option: QuickAddOption) => void;
  onQuickAddMenuItemKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => void;
  onCreateQuickAddEvent: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  eventNLDraft: string;
  setEventNLDraft: (nextDraft: string) => void;
  eventNLPreview: ReturnType<typeof useCalendarNLDraft>['preview'];
  eventNLFormPreview: ReturnType<typeof useCalendarNLDraft>['formPreview'];
  eventNLHasMeaningfulPreview: boolean;
  eventNLError: string | null;
  eventTitle: string;
  setEventTitle: Dispatch<SetStateAction<string>>;
  eventStartAt: string;
  setEventStartAt: Dispatch<SetStateAction<string>>;
  eventEndAt: string;
  setEventEndAt: Dispatch<SetStateAction<string>>;
  eventSubmitting: boolean;
  eventError: string | null;
  reminderDraft: string;
  setReminderDraft: (nextDraft: string) => void;
  reminderPreview: ReturnType<typeof useReminderNLDraft>['preview'];
  onCreateQuickAddReminder: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  reminderSubmitting: boolean;
  reminderError: string | null;
  setReminderError: Dispatch<SetStateAction<string | null>>;
  personalReminderProjectLabel: string;
  projectDialogName: string;
  setProjectDialogName: Dispatch<SetStateAction<string>>;
  onCreateQuickAddProject: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  projectDialogSubmitting: boolean;
  projectDialogError: string | null;
}

export const useToolbarQuickAdd = ({
  accessToken,
  projects,
  currentProjectId,
  captureHomeData,
  preferredCaptureProjectId,
  refreshCaptureData,
  closeCapturePanel,
  closeQuickNav,
  closeQuickNavPanel,
  closeProfile,
  closeSearch,
  closeNotifications,
  captureOpen,
  navigate,
  upsertProject,
}: UseToolbarQuickAddArgs): UseToolbarQuickAddResult => {
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

  const {
    draft: eventNLDraft,
    setDraft: setEventNLDraft,
    preview: eventNLPreview,
    formPreview: eventNLFormPreview,
    hasMeaningfulPreview: eventNLHasMeaningfulPreview,
    error: eventNLError,
    clear: clearEventNLDraft,
    lastParsedDraft: lastParsedEventNLDraft,
  } = useCalendarNLDraft({
    enabled: quickAddDialog === 'event',
    parseDelayMs: 250,
  });

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

  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const quickAddItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const taskTitleInputRef = useRef<HTMLInputElement | null>(null);
  const eventNLInputRef = useRef<HTMLInputElement | null>(null);
  const eventTitleInputRef = useRef<HTMLInputElement | null>(null);
  const reminderInputRef = useRef<HTMLInputElement | null>(null);
  const projectNameInputRef = useRef<HTMLInputElement | null>(null);
  const quickAddTaskMetadataRequestRef = useRef(0);
  const quickAddOpenRequestRef = useRef(0);
  const contextMenuWasOpenRef = useRef(false);
  const skipContextMenuFocusRestoreRef = useRef(false);
  const lastAppliedEventNLDraftRef = useRef('');

  useEffect(() => {
    quickAddTaskMetadataRequestRef.current += 1;
    setTaskProjectMembersById({});
  }, [accessToken, currentProjectId, projects]);

  const quickAddProjectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.isPersonal ? `${project.name} (Personal)` : project.name,
      })),
    [projects],
  );

  const selectedTaskProjectMembers = useMemo(
    () => taskProjectMembersById[quickAddProjectId] ?? [],
    [quickAddProjectId, taskProjectMembersById],
  );

  const personalReminderProjectLabel = useMemo(
    () => projects.find((project) => project.isPersonal)?.name || 'Personal',
    [projects],
  );

  const resolveDefaultQuickAddProjectId = useCallback((): string => {
    return getDefaultQuickAddProjectId({
      projects,
      preferredCaptureProjectId,
      currentProjectId,
      personalProjectId: captureHomeData.personalProjectId,
    });
  }, [captureHomeData.personalProjectId, currentProjectId, preferredCaptureProjectId, projects]);

  const resolveDefaultQuickAddProjectIdFromCapture = useCallback((nextCaptureHomeData: ToolbarCaptureHomeData): string => {
    return getDefaultQuickAddProjectId({
      projects,
      preferredCaptureProjectId,
      currentProjectId,
      personalProjectId: nextCaptureHomeData.personalProjectId,
    });
  }, [currentProjectId, preferredCaptureProjectId, projects]);

  const loadTaskProjectMembers = useCallback(async (projectId: string) => {
    if (!accessToken || !projectId) {
      return;
    }
    if (taskProjectMembersById[projectId] !== undefined) {
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
      const requestVersion = quickAddOpenRequestRef.current + 1;
      quickAddOpenRequestRef.current = requestVersion;

      if (dialogType === 'project') {
        setProjectDialogName('');
        setProjectDialogError(null);
        setQuickAddDialog(dialogType);
        return;
      }

      let defaultProjectId = resolveDefaultQuickAddProjectId();
      if (!defaultProjectId && accessToken) {
        try {
          const nextCaptureHomeData = await refreshCaptureData();
          if (quickAddOpenRequestRef.current !== requestVersion) {
            return;
          }
          defaultProjectId = resolveDefaultQuickAddProjectIdFromCapture(nextCaptureHomeData);
        } catch {
          if (quickAddOpenRequestRef.current !== requestVersion) {
            return;
          }
        }
      }
      if (quickAddOpenRequestRef.current !== requestVersion) {
        return;
      }
      setQuickAddProjectId(defaultProjectId);

      if (dialogType === 'task' && defaultProjectId) {
        void loadTaskProjectMembers(defaultProjectId);
      }
      if (dialogType === 'event') {
        clearEventNLDraft();
        lastAppliedEventNLDraftRef.current = '';
        setEventTitle('');
        setEventStartAt(toDateTimeLocalInput(nowPlusHours(1)));
        setEventEndAt(toDateTimeLocalInput(nowPlusHours(2)));
        setEventError(null);
      }
      if (dialogType === 'reminder') {
        clearReminderDraft();
        setReminderError(null);
      }

      if (quickAddOpenRequestRef.current !== requestVersion) {
        return;
      }
      setQuickAddDialog(dialogType);
    },
    [
      accessToken,
      clearEventNLDraft,
      clearReminderDraft,
      loadTaskProjectMembers,
      refreshCaptureData,
      resolveDefaultQuickAddProjectId,
      resolveDefaultQuickAddProjectIdFromCapture,
    ],
  );

  const closeContextMenu = useCallback((options?: CloseContextMenuOptions) => {
    skipContextMenuFocusRestoreRef.current = options?.restoreFocus === false;
    setContextMenuOpen(false);
  }, []);

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
    closeSearch();
    closeNotifications({ restoreFocus: false });
    closeProfile({ restoreFocus: false });
    closeQuickNav({ restoreFocus: false });
    closeQuickNavPanel();
  }, [closeCapturePanel, closeNotifications, closeProfile, closeQuickNav, closeQuickNavPanel, closeSearch]);

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
      void refreshCaptureData().catch(() => undefined);
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
      void refreshCaptureData().catch(() => undefined);
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

  useEffect(() => {
    if (quickAddDialog !== 'event') {
      lastAppliedEventNLDraftRef.current = '';
      return;
    }

    const trimmedDraft = lastParsedEventNLDraft.trim();
    if (!trimmedDraft || lastAppliedEventNLDraftRef.current === lastParsedEventNLDraft) {
      return;
    }

    if (eventNLFormPreview.title !== null) {
      setEventTitle(eventNLFormPreview.title);
    }
    if (eventNLFormPreview.startAt !== null) {
      setEventStartAt(eventNLFormPreview.startAt);
    }
    if (eventNLFormPreview.endAt !== null) {
      setEventEndAt(eventNLFormPreview.endAt);
    }
    lastAppliedEventNLDraftRef.current = lastParsedEventNLDraft;
  }, [eventNLFormPreview, lastParsedEventNLDraft, quickAddDialog]);

  useQuickAddEffects({
    contextMenuOpen,
    setQuickAddActiveIndex,
    quickAddItemRefs,
    quickAddDialog,
    taskTitleInputRef,
    eventNLInputRef,
    eventTitleInputRef,
    reminderInputRef,
    projectNameInputRef,
  });

  useQuickAddProjectRequestEffect({
    closeCapturePanel,
    closeQuickNav,
    closeQuickNavPanel,
    closeProfile,
    closeContextMenu,
    closeSearch,
    closeNotifications,
    openQuickAddDialog,
  });

  useEffect(() => {
    if (contextMenuOpen) {
      focusFirstDescendantSoon(contextMenuRef.current, '[role="menuitem"]');
    } else if (
      contextMenuWasOpenRef.current
      && !skipContextMenuFocusRestoreRef.current
      && !captureOpen
      && !quickAddDialog
    ) {
      focusElementSoon(contextMenuTriggerRef.current);
    }
    if (!contextMenuOpen) {
      skipContextMenuFocusRestoreRef.current = false;
    }
    contextMenuWasOpenRef.current = contextMenuOpen;
  }, [captureOpen, contextMenuOpen, quickAddDialog]);

  return {
    contextMenuRef,
    contextMenuTriggerRef,
    contextMenuOpen,
    closeContextMenu,
    toggleQuickAddMenu,
    quickAddItemRefs,
    quickAddActiveIndex,
    setQuickAddActiveIndex,
    quickAddDialog,
    closeQuickAddDialog,
    quickAddProjectId,
    setQuickAddProjectId,
    selectedTaskProjectMembers,
    quickAddProjectOptions,
    taskTitleInputRef,
    eventNLInputRef,
    eventTitleInputRef,
    reminderInputRef,
    projectNameInputRef,
    loadTaskProjectMembers,
    onSelectQuickAddOption,
    onQuickAddMenuItemKeyDown,
    onCreateQuickAddEvent,
    eventNLDraft,
    setEventNLDraft,
    eventNLPreview,
    eventNLFormPreview,
    eventNLHasMeaningfulPreview,
    eventNLError,
    eventTitle,
    setEventTitle,
    eventStartAt,
    setEventStartAt,
    eventEndAt,
    setEventEndAt,
    eventSubmitting,
    eventError,
    reminderDraft,
    setReminderDraft,
    reminderPreview,
    onCreateQuickAddReminder,
    reminderSubmitting,
    reminderError,
    setReminderError,
    personalReminderProjectLabel,
    projectDialogName,
    setProjectDialogName,
    onCreateQuickAddProject,
    projectDialogSubmitting,
    projectDialogError,
  };
};
