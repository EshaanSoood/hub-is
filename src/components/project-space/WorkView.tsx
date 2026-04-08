import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AccessDeniedView } from '../auth/AccessDeniedView';
import { ModuleGrid, type ContractModuleConfig } from './ModuleGrid';
import { AccessibleDialog, Icon, IconButton } from '../primitives';
import type { HubPaneSummary } from '../../services/hub/types';
import { clampModuleSizeTier } from './moduleCatalog';
import type {
  CalendarModuleContract,
  FilesModuleContract,
  KanbanModuleContract,
  QuickThoughtsModuleContract,
  RemindersModuleContract,
  TableModuleContract,
  TasksModuleContract,
  TimelineModuleContract,
} from './moduleContracts';
import {
  CalendarModule,
  FilesModule,
  KanbanModule,
  QuickThoughtsModule,
  RemindersModule,
  TableModule,
  TasksModule,
  TimelineModule,
} from './modules';
import { dialogLayoutIds } from '../../styles/motion';

interface WorkViewProps {
  layoutId?: string;
  pane: HubPaneSummary | null;
  accessDenied?: boolean;
  canEditPane?: boolean;
  modulesEnabled?: boolean;
  showWorkspaceDocPlaceholder?: boolean;
  onUpdatePane: (paneId: string, payload: { name?: string; pinned?: boolean; sort_order?: number; layout_config?: Record<string, unknown> }) => Promise<void>;
  onOpenRecord?: (recordId: string) => void;
  tableContract?: Partial<TableModuleContract>;
  kanbanContract?: Partial<KanbanModuleContract>;
  calendarContract?: Partial<CalendarModuleContract>;
  filesContract?: Partial<FilesModuleContract>;
  quickThoughtsContract?: Partial<QuickThoughtsModuleContract>;
  tasksContract?: Partial<TasksModuleContract>;
  timelineContract?: Partial<TimelineModuleContract>;
  remindersContract?: Partial<RemindersModuleContract>;
}

const normalizeModuleType = (moduleType: unknown): string => {
  return typeof moduleType === 'string' && moduleType ? moduleType : 'unknown';
};

const defaultModuleLens = (moduleType: string): 'project' | 'pane' | 'pane_scratch' => {
  if (moduleType === 'quick_thoughts') {
    return 'pane_scratch';
  }
  if (moduleType === 'tasks') {
    return 'pane';
  }
  if (moduleType === 'reminders') {
    return 'project';
  }
  return 'project';
};

const normalizeModuleLens = (moduleType: string, lens: unknown): 'project' | 'pane' | 'pane_scratch' => {
  if (moduleType === 'quick_thoughts') {
    return 'pane_scratch';
  }
  if (moduleType === 'tasks') {
    return lens === 'project' ? 'project' : 'pane';
  }
  if (moduleType === 'reminders') {
    return 'project';
  }
  return lens === 'pane_scratch' ? 'pane_scratch' : 'project';
};

const parseModules = (layoutConfig: Record<string, unknown> | null | undefined): ContractModuleConfig[] => {
  if (!layoutConfig || typeof layoutConfig !== 'object' || Array.isArray(layoutConfig)) {
    return [];
  }
  const raw = Array.isArray(layoutConfig.modules) ? layoutConfig.modules : [];
  const modules: ContractModuleConfig[] = [];

  for (const [index, candidate] of raw.entries()) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue;
    }

    const value = candidate as Record<string, unknown>;
    const moduleType = normalizeModuleType(value.module_type);
    const sizeTier = value.size_tier;
    const lens = value.lens;
    const rawBinding = value.binding;
    const binding =
      rawBinding && typeof rawBinding === 'object' && !Array.isArray(rawBinding)
        ? {
            view_id:
              typeof (rawBinding as { view_id?: unknown }).view_id === 'string'
                ? (rawBinding as { view_id: string }).view_id
                : undefined,
          }
        : undefined;

    const normalizedSizeTier = sizeTier === 'S' || sizeTier === 'M' || sizeTier === 'L' ? sizeTier : 'M';

    modules.push({
      module_instance_id:
        typeof value.module_instance_id === 'string' && value.module_instance_id
          ? value.module_instance_id
          : `module-${index + 1}`,
      module_type: moduleType,
      size_tier: clampModuleSizeTier(moduleType, normalizedSizeTier),
      lens: normalizeModuleLens(moduleType, lens),
      binding,
    });
  }

  return modules;
};

const serializeModules = (modules: ContractModuleConfig[]): Array<Record<string, unknown>> =>
  modules.map((module) => ({
    module_instance_id: module.module_instance_id,
    module_type: normalizeModuleType(module.module_type),
    size_tier: module.size_tier,
    lens: normalizeModuleLens(normalizeModuleType(module.module_type), module.lens),
    ...(module.binding?.view_id ? { binding: { view_id: module.binding.view_id } } : {}),
  }));

const EMPTY_TABLE_CONTRACT: TableModuleContract = {
  views: [],
  defaultViewId: null,
  dataByViewId: {},
};

const EMPTY_KANBAN_CONTRACT: KanbanModuleContract = {
  views: [],
  defaultViewId: null,
  dataByViewId: {},
  onMoveRecord: () => {},
};

const EMPTY_CALENDAR_CONTRACT: CalendarModuleContract = {
  events: [],
  loading: false,
  scope: 'relevant',
  onScopeChange: () => {},
  onCreateEvent: undefined,
  onRescheduleEvent: undefined,
};

const EMPTY_FILES_CONTRACT: FilesModuleContract = {
  paneFiles: [],
  projectFiles: [],
  onUploadPaneFiles: () => {},
  onUploadProjectFiles: () => {},
  onOpenFile: () => {},
  onInsertToEditor: undefined,
};

const EMPTY_QUICK_THOUGHTS_CONTRACT: QuickThoughtsModuleContract = {
  storageKeyBase: 'hub:quick-thoughts:default',
  legacyStorageKeyBase: undefined,
  onInsertToEditor: undefined,
};

const EMPTY_TASKS_CONTRACT: TasksModuleContract = {
  items: [],
  loading: false,
  onCreateTask: async () => {},
  onUpdateTaskStatus: () => {},
  onUpdateTaskPriority: () => {},
  onUpdateTaskDueDate: () => {},
  onDeleteTask: () => {},
  onInsertToEditor: undefined,
};

const EMPTY_TIMELINE_CONTRACT: TimelineModuleContract = {
  clusters: [],
  activeFilters: ['task', 'event', 'milestone', 'file', 'workspace'],
  loading: false,
  hasMore: false,
  onFilterToggle: () => {},
  onLoadMore: () => {},
  onItemClick: () => {},
};

const EMPTY_REMINDERS_CONTRACT: RemindersModuleContract = {
  items: [],
  loading: false,
  error: null,
  onDismiss: async () => {},
  onCreate: async () => {},
  onInsertToEditor: undefined,
};

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

const MobileModulesOverlay = ({ moduleGrid }: { moduleGrid: ReactNode }) => {
  const prefersReducedMotion = useReducedMotion();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MEDIA_QUERY).matches : false,
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const updateMatches = (matches: boolean) => {
      setIsDesktop(matches);
      if (matches) {
        setOverlayOpen(false);
      }
    };
    updateMatches(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => updateMatches(event.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  if (isDesktop) {
    return <div>{moduleGrid}</div>;
  }

  const mobileModulesLayoutId = !prefersReducedMotion ? dialogLayoutIds.mobileModules : undefined;

  return (
    <>
      <motion.button
        layoutId={mobileModulesLayoutId}
        ref={triggerRef}
        type="button"
        onClick={() => setOverlayOpen(true)}
        className="sticky top-0 z-20 w-full rounded-control border border-border-muted bg-surface-elevated px-3 py-2 text-center text-sm font-semibold text-text md:hidden"
      >
        Modules
      </motion.button>

      {overlayOpen ? (
        <AccessibleDialog
          open={overlayOpen}
          onClose={() => setOverlayOpen(false)}
          triggerRef={triggerRef}
          layoutId={mobileModulesLayoutId}
          title="Modules"
          description="Manage and browse pane modules"
          hideHeader
          panelClassName="left-1/2 top-1/2 h-[100dvh] w-screen max-w-none -translate-x-1/2 -translate-y-1/2 rounded-none border-none bg-surface p-0 md:hidden"
          contentClassName="mt-0 h-full overflow-y-auto p-4"
        >
          <div className="relative pt-10">
            <IconButton aria-label="Close modules" className="absolute right-0 top-0" onClick={() => setOverlayOpen(false)}>
              <Icon name="close" className="h-4 w-4" />
            </IconButton>
            {moduleGrid}
          </div>
        </AccessibleDialog>
      ) : null}
    </>
  );
};

export const WorkView = ({
  layoutId,
  pane,
  accessDenied = false,
  canEditPane = true,
  modulesEnabled = true,
  showWorkspaceDocPlaceholder = true,
  onUpdatePane,
  onOpenRecord,
  tableContract,
  kanbanContract,
  calendarContract,
  filesContract,
  quickThoughtsContract,
  tasksContract,
  timelineContract,
  remindersContract,
}: WorkViewProps) => {
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const [pendingModuleSaves, setPendingModuleSaves] = useState(0);
  const [moduleError, setModuleError] = useState<string | null>(null);

  if (accessDenied) {
    return (
      <motion.section layoutId={layoutId} className="space-y-4">
        <AccessDeniedView message="Project membership is required for this workspace." />
      </motion.section>
    );
  }

  if (!pane) {
    return (
      <motion.section layoutId={layoutId} className="rounded-panel border border-subtle bg-elevated p-4">
        <p className="text-sm text-muted">No pane selected.</p>
      </motion.section>
    );
  }

  const resolvedTableContract: TableModuleContract = {
    ...EMPTY_TABLE_CONTRACT,
    ...tableContract,
  };
  const resolvedKanbanContract: KanbanModuleContract = {
    ...EMPTY_KANBAN_CONTRACT,
    ...kanbanContract,
  };
  const resolvedCalendarContract: CalendarModuleContract = {
    ...EMPTY_CALENDAR_CONTRACT,
    ...calendarContract,
  };
  const resolvedFilesContract: FilesModuleContract = {
    ...EMPTY_FILES_CONTRACT,
    ...filesContract,
  };
  const resolvedQuickThoughtsContract: QuickThoughtsModuleContract = {
    ...EMPTY_QUICK_THOUGHTS_CONTRACT,
    ...quickThoughtsContract,
  };
  const resolvedTasksContract: TasksModuleContract = {
    ...EMPTY_TASKS_CONTRACT,
    ...tasksContract,
  };
  const resolvedTimelineContract: TimelineModuleContract = {
    ...EMPTY_TIMELINE_CONTRACT,
    ...timelineContract,
  };
  const resolvedRemindersContract: RemindersModuleContract = {
    ...EMPTY_REMINDERS_CONTRACT,
    ...remindersContract,
  };

  const modules = parseModules(pane.layout_config);
  const isSavingModules = pendingModuleSaves > 0;

  const saveModules = (nextModules: ContractModuleConfig[]) => {
    setModuleError(null);
    setPendingModuleSaves((count) => count + 1);
    saveChainRef.current = saveChainRef.current
      .then(async () => {
        await onUpdatePane(pane.pane_id, {
          layout_config: {
            ...pane.layout_config,
            modules: serializeModules(nextModules),
          },
        });
      })
      .catch((error) => {
        setModuleError(error instanceof Error ? error.message : 'Module layout update failed.');
      })
      .finally(() => {
        setPendingModuleSaves((count) => Math.max(0, count - 1));
      });
    return saveChainRef.current;
  };

  const handleAddModule = (moduleType: string, sizeTier: ContractModuleConfig['size_tier']) => {
    const normalizedModuleType = normalizeModuleType(moduleType);
    const nextModules: ContractModuleConfig[] = [
      ...modules,
      {
        module_instance_id: `${moduleType}-${Date.now()}`,
        module_type: normalizedModuleType,
        size_tier: clampModuleSizeTier(normalizedModuleType, sizeTier),
        lens: defaultModuleLens(normalizedModuleType),
      },
    ];
    void saveModules(nextModules);
  };

  const handleRemoveModule = (moduleInstanceId: string) => {
    const nextModules = modules.filter((module) => module.module_instance_id !== moduleInstanceId);
    void saveModules(nextModules);
  };

  const handleSetModuleLens = (moduleInstanceId: string, lens: ContractModuleConfig['lens']) => {
    const nextModules = modules.map((module) =>
      module.module_instance_id === moduleInstanceId
        ? {
            ...module,
            lens: normalizeModuleLens(module.module_type, lens),
          }
        : module,
    );
    void saveModules(nextModules);
  };

  const handleResizeModule = (moduleInstanceId: string, sizeTier: ContractModuleConfig['size_tier']) => {
    const nextModules = modules.map((module) =>
      module.module_instance_id === moduleInstanceId
        ? {
            ...module,
            size_tier: clampModuleSizeTier(module.module_type, sizeTier),
          }
        : module,
    );
    void saveModules(nextModules);
  };

  const handleSetModuleBinding = (moduleInstanceId: string, viewId: string) => {
    const nextModules = modules.map((module) =>
      module.module_instance_id === moduleInstanceId
        ? {
            ...module,
            binding: viewId ? { view_id: viewId } : undefined,
          }
        : module,
    );
    void saveModules(nextModules);
  };

  const renderModuleBody = (module: ContractModuleConfig) => {
    if (module.module_type === 'table') {
      return (
        <TableModule
          module={module}
          contract={resolvedTableContract}
          canEditPane={canEditPane}
          onOpenRecord={onOpenRecord}
          onSetModuleBinding={handleSetModuleBinding}
        />
      );
    }

    if (module.module_type === 'kanban') {
      return (
        <KanbanModule
          module={module}
          contract={resolvedKanbanContract}
          canEditPane={canEditPane}
          onOpenRecord={onOpenRecord}
          onSetModuleBinding={handleSetModuleBinding}
        />
      );
    }

    if (module.module_type === 'calendar') {
      return <CalendarModule module={module} contract={resolvedCalendarContract} onOpenRecord={onOpenRecord} />;
    }

    if (module.module_type === 'tasks') {
      return <TasksModule module={module} contract={resolvedTasksContract} canEditPane={canEditPane} />;
    }

    if (module.module_type === 'files') {
      return <FilesModule module={module} contract={resolvedFilesContract} canEditPane={canEditPane} />;
    }

    if (module.module_type === 'reminders') {
      return <RemindersModule module={module} contract={resolvedRemindersContract} canEditPane={canEditPane} />;
    }

    if (module.module_type === 'quick_thoughts') {
      return (
        <QuickThoughtsModule
          module={module}
          contract={resolvedQuickThoughtsContract}
          pane={pane}
          canEditPane={canEditPane}
        />
      );
    }

    if (module.module_type === 'timeline') {
      return <TimelineModule contract={resolvedTimelineContract} />;
    }

    return <p className="text-xs text-muted">{module.module_type}</p>;
  };

  const moduleGrid = (
    <ModuleGrid
      modules={modules}
      onAddModule={handleAddModule}
      onRemoveModule={handleRemoveModule}
      onSetModuleLens={handleSetModuleLens}
      onResizeModule={handleResizeModule}
      showAddControls={canEditPane}
      disableAdd={!canEditPane || isSavingModules}
      disableMutations={!canEditPane || isSavingModules}
      readOnlyState={!canEditPane}
      renderModuleBody={renderModuleBody}
    />
  );

  return (
    <motion.section layoutId={layoutId} className="space-y-4">
      <header className="rounded-panel border border-subtle bg-elevated p-4">
        <h2 className="heading-3 text-primary">{pane.name}</h2>
        {moduleError ? <p className="mt-2 text-xs text-danger">{moduleError}</p> : null}
      </header>

      {modulesEnabled ? (
        <>
          <MobileModulesOverlay key={pane.pane_id} moduleGrid={moduleGrid} />
        </>
      ) : (
        <section className="rounded-panel border border-subtle bg-elevated p-4">
          <h3 className="heading-4 text-primary">Structured Modules Off</h3>
          <p className="mt-1 text-sm text-muted">Modules hidden.</p>
        </section>
      )}

      {showWorkspaceDocPlaceholder ? (
        <section className="rounded-panel border border-subtle bg-elevated p-4">
          <h3 className="heading-4 text-primary">Workspace Doc</h3>
          <p className="mt-1 text-sm text-muted">Doc ID: {pane.doc_id || 'missing'}</p>
        </section>
      ) : null}
    </motion.section>
  );
};
