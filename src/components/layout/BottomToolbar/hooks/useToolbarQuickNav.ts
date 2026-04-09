import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { requestHubHomeRefresh } from '../../../../lib/hubHomeRefresh';
import { appTabs } from '../../../../lib/policy';
import type { GlobalCapability } from '../../../../types/domain';
import { createTask, queryTasks } from '../../../../services/hub/records';
import type { HubTaskSummary } from '../../../../services/hub/types';
import { adaptTaskSummaries } from '../../../project-space/taskAdapter';
import { TasksModuleSkin } from '../../../project-space/TasksModuleSkin';
import {
  parseIsoTimestamp,
  type QuickAddDialog,
  type QuickNavActionItem,
  type ToolbarDialog,
} from '../../appShellUtils';
import type {
  CloseContextMenuOptions,
  CloseProfileOptions,
  CloseQuickNavOptions,
} from '../types';
import { useQuickNavEffects } from './useQuickNavEffects';
import { useTasksDialogEffects } from './useTasksDialogEffects';

interface ToolbarProject {
  id: string;
  name: string;
}

interface UseToolbarQuickNavArgs {
  accessToken: string | null | undefined;
  canGlobal: (capability: GlobalCapability) => boolean;
  navigate: (to: string) => void;
  projects: ToolbarProject[];
  defaultTaskProjectId: string;
  closeProfile: (options?: CloseProfileOptions) => void;
  closeContextMenu: (options?: CloseContextMenuOptions) => void;
  closeCapturePanel: (options?: { restoreFocus?: boolean }) => void;
  contextMenuOpen: boolean;
  profileOpen: boolean;
  captureOpen: boolean;
  quickAddDialog: QuickAddDialog;
}

interface UseToolbarQuickNavResult {
  quickNavRef: MutableRefObject<HTMLDivElement | null>;
  quickNavTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  quickNavInputRef: MutableRefObject<HTMLInputElement | null>;
  quickNavOpen: boolean;
  setQuickNavOpen: Dispatch<SetStateAction<boolean>>;
  closeQuickNav: (options?: CloseQuickNavOptions) => void;
  setQuickNavActiveIndex: Dispatch<SetStateAction<number>>;
  quickNavItems: QuickNavActionItem[];
  quickNavQuery: string;
  setQuickNavQuery: Dispatch<SetStateAction<string>>;
  normalizedQuickNavActiveIndex: number;
  quickNavDestinationItems: QuickNavActionItem[];
  onSelectQuickNavItem: (item: QuickNavActionItem) => void;
  toolbarDialog: ToolbarDialog;
  closeQuickNavPanel: () => void;
  openQuickNavPanel: (panel: Exclude<ToolbarDialog, null>) => void;
  quickNavTasksError: string | null;
  refreshQuickNavTasks: () => Promise<void>;
  adaptedTasks: ReturnType<typeof adaptTaskSummaries>;
  quickNavTasksLoading: boolean;
  onCreateTaskFromModule: ComponentProps<typeof TasksModuleSkin>['onCreateTask'];
}

export const useToolbarQuickNav = ({
  accessToken,
  canGlobal,
  navigate,
  projects,
  defaultTaskProjectId,
  closeProfile,
  closeContextMenu,
  closeCapturePanel,
  contextMenuOpen,
  profileOpen,
  captureOpen,
  quickAddDialog,
}: UseToolbarQuickNavArgs): UseToolbarQuickNavResult => {
  const [quickNavOpen, setQuickNavOpen] = useState(false);
  const [quickNavQuery, setQuickNavQuery] = useState('');
  const [quickNavActiveIndex, setQuickNavActiveIndex] = useState(-1);
  const [toolbarDialog, setToolbarDialog] = useState<ToolbarDialog>(null);
  const [quickNavTasks, setQuickNavTasks] = useState<HubTaskSummary[]>([]);
  const [quickNavTasksLoading, setQuickNavTasksLoading] = useState(false);
  const [quickNavTasksError, setQuickNavTasksError] = useState<string | null>(null);

  const quickNavRef = useRef<HTMLDivElement | null>(null);
  const quickNavTriggerRef = useRef<HTMLButtonElement | null>(null);
  const quickNavInputRef = useRef<HTMLInputElement | null>(null);
  const quickNavTasksRequestVersionRef = useRef(0);
  const quickNavWasOpenRef = useRef(false);
  const skipQuickNavFocusRestoreRef = useRef(false);

  const visibleTabs = useMemo(() => appTabs.filter((tab) => canGlobal(tab.capability)), [canGlobal]);

  const quickNavDestinationItems = useMemo(() => {
    const tabItems: QuickNavActionItem[] = visibleTabs.map((tab) => ({
      id: tab.to,
      label: tab.label,
      action: 'navigate',
      href: tab.to,
    }));
    const projectItems: QuickNavActionItem[] = projects.map((project) => ({
      id: `project-${project.id}`,
      label: project.name,
      iconName: 'project-list',
      action: 'navigate',
      href: `/projects/${encodeURIComponent(project.id)}/overview`,
    }));
    const allItems = [...tabItems, ...projectItems];

    const query = quickNavQuery.trim().toLowerCase();
    if (!query) {
      return allItems;
    }
    return allItems.filter((item) => item.label.toLowerCase().includes(query));
  }, [projects, quickNavQuery, visibleTabs]);

  const quickNavItems = useMemo(() => quickNavDestinationItems, [quickNavDestinationItems]);

  const normalizedQuickNavActiveIndex =
    quickNavItems.length === 0 || quickNavActiveIndex < 0 || quickNavActiveIndex >= quickNavItems.length
      ? quickNavItems.length === 0
        ? -1
        : 0
      : quickNavActiveIndex;

  const adaptedTasks = useMemo(() => adaptTaskSummaries(quickNavTasks), [quickNavTasks]);

  const closeQuickNav = useCallback((options?: CloseQuickNavOptions) => {
    skipQuickNavFocusRestoreRef.current = options?.restoreFocus === false;
    setQuickNavOpen(false);
    setQuickNavQuery('');
    setQuickNavActiveIndex(-1);
  }, []);

  const closeQuickNavPanel = useCallback(() => {
    setToolbarDialog(null);
  }, []);

  const openQuickNavPanel = useCallback((panel: Exclude<ToolbarDialog, null>) => {
    closeQuickNav();
    closeProfile({ restoreFocus: false });
    closeContextMenu({ restoreFocus: false });
    closeCapturePanel({ restoreFocus: false });
    setToolbarDialog(panel);
  }, [closeCapturePanel, closeContextMenu, closeProfile, closeQuickNav]);

  const onSelectQuickNavItem = useCallback((item: QuickNavActionItem) => {
    skipQuickNavFocusRestoreRef.current = true;
    setToolbarDialog(null);
    navigate(item.href);
    closeQuickNav();
  }, [closeQuickNav, navigate]);

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

  const onCreateTaskFromModule = useCallback(async (task: {
    title: string;
    priority: string | null;
    due_at: string | null;
    parent_record_id?: string | null;
  }) => {
    if (!accessToken) {
      throw new Error('An authenticated session is required.');
    }
    const priority = task.priority === 'low' || task.priority === 'medium' || task.priority === 'high' || task.priority === 'urgent'
      ? task.priority
      : null;
    await createTask(accessToken, {
      project_id: defaultTaskProjectId || undefined,
      parent_record_id: task.parent_record_id ?? null,
      title: task.title,
      status: 'todo',
      priority,
      due_at: task.due_at ?? null,
    });
    requestHubHomeRefresh();
    await refreshQuickNavTasks();
  }, [accessToken, defaultTaskProjectId, refreshQuickNavTasks]);

  useQuickNavEffects({
    captureOpen,
    closeQuickNav,
    contextMenuOpen,
    navigate,
    normalizedQuickNavActiveIndex,
    profileOpen,
    quickAddDialog,
    quickNavInputRef,
    quickNavItems,
    quickNavOpen,
    quickNavTriggerRef,
    quickNavWasOpenRef,
    setQuickNavActiveIndex,
    setQuickNavQuery,
    skipQuickNavFocusRestoreRef,
    toolbarDialog,
  });

  useTasksDialogEffects({
    toolbarDialog,
    refreshQuickNavTasks,
  });

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (quickNavOpen && quickNavRef.current && !quickNavRef.current.contains(target)) {
        closeQuickNav();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [closeQuickNav, quickNavOpen]);

  return {
    quickNavRef,
    quickNavTriggerRef,
    quickNavInputRef,
    quickNavOpen,
    setQuickNavOpen,
    closeQuickNav,
    setQuickNavActiveIndex,
    quickNavItems,
    quickNavQuery,
    setQuickNavQuery,
    normalizedQuickNavActiveIndex,
    quickNavDestinationItems,
    onSelectQuickNavItem,
    toolbarDialog,
    closeQuickNavPanel,
    openQuickNavPanel,
    quickNavTasksError,
    refreshQuickNavTasks,
    adaptedTasks,
    quickNavTasksLoading,
    onCreateTaskFromModule,
  };
};
