import { useRef, useState } from 'react';
import { AccessDeniedView } from '../auth/AccessDeniedView';
import { ModuleGrid, type ContractModuleConfig } from './ModuleGrid';
import type { CreateReminderPayload, HubReminderSummary } from '../../services/hub/reminders';
import type { HubCollectionField, HubPaneSummary, HubRecordSummary } from '../../services/hub/types';
import type { CalendarScope } from './CalendarModuleSkin';
import type { FilesModuleItem } from './FilesModuleSkin';
import type { TaskItem } from './TasksTab';
import type { TimelineCluster, TimelineEventType } from './TimelineFeed';
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

interface WorkViewProps {
  pane: HubPaneSummary | null;
  accessDenied?: boolean;
  canEditPane?: boolean;
  modulesEnabled?: boolean;
  workspaceEnabled?: boolean;
  showWorkspaceDocPlaceholder?: boolean;
  onSelectPane: (paneId: string) => void;
  onUpdatePane: (paneId: string, payload: { name?: string; pinned?: boolean; sort_order?: number; layout_config?: Record<string, unknown> }) => Promise<void>;
  onOpenRecord?: (recordId: string) => void;
  moduleRuntime?: Partial<WorkViewModuleRuntime>;
}

interface WorkViewBoundViewSummary {
  view_id: string;
  name: string;
}

interface WorkViewTableViewData {
  schema: {
    collection_id: string;
    name: string;
    fields: HubCollectionField[];
  } | null;
  records: HubRecordSummary[];
  loading: boolean;
  error?: string;
}

export interface WorkViewTableRuntime {
  views: WorkViewBoundViewSummary[];
  defaultViewId: string | null;
  dataByViewId: Record<string, WorkViewTableViewData>;
}

export interface WorkViewKanbanRuntime {
  views: WorkViewBoundViewSummary[];
  defaultViewId: string | null;
  dataByViewId: Record<
    string,
    {
      groups: Array<{ id: string; label: string; records: HubRecordSummary[] }>;
      groupOptions: Array<{ id: string; label: string }>;
      loading: boolean;
      groupingConfigured: boolean;
      groupingMessage?: string;
      groupFieldId: string | null;
      metadataFieldIds?: {
        priority?: string | null;
        assignee?: string | null;
        dueDate?: string | null;
      };
      error?: string;
    }
  >;
  onMoveRecord: (viewId: string, recordId: string, nextGroup: string) => void;
}

export interface WorkViewCalendarRuntime {
  events: Array<{
    record_id: string;
    title: string;
    event_state: {
      start_dt: string;
      end_dt: string;
      timezone: string;
      location: string | null;
      updated_at: string;
    };
    participants: Array<{ user_id: string; role: string | null }>;
  }>;
  loading: boolean;
  scope: CalendarScope;
  onScopeChange: (scope: CalendarScope) => void;
  onCreateEvent?: (payload: {
    title: string;
    start_dt: string;
    end_dt: string;
    timezone: string;
    location?: string;
  }) => Promise<void>;
}

export interface WorkViewFilesRuntime {
  paneFiles: FilesModuleItem[];
  projectFiles: FilesModuleItem[];
  onUploadPaneFiles: (files: File[]) => void;
  onUploadProjectFiles: (files: File[]) => void;
  onOpenFile: (file: FilesModuleItem) => void;
}

export interface WorkViewQuickThoughtsRuntime {
  storageKeyBase: string;
  legacyStorageKeyBase?: string;
}

export interface WorkViewTasksRuntime {
  items: TaskItem[];
  loading: boolean;
  onCreateTask: (task: { title: string; priority: string | null; due_at: string | null; parent_record_id?: string | null }) => Promise<void>;
  onUpdateTaskStatus: (taskId: string, status: string) => void;
  onUpdateTaskPriority: (taskId: string, priority: string | null) => void;
  onUpdateTaskDueDate: (taskId: string, dueAt: string | null) => void;
  onDeleteTask: (taskId: string) => void;
}

export interface WorkViewTimelineRuntime {
  clusters: TimelineCluster[];
  activeFilters: TimelineEventType[];
  loading: boolean;
  hasMore: boolean;
  onFilterToggle: (type: TimelineEventType) => void;
  onLoadMore: () => void;
  onItemClick: (recordId: string, recordType: string) => void;
}

export interface WorkViewRemindersRuntime {
  items: HubReminderSummary[];
  loading: boolean;
  error?: string | null;
  onDismiss: (reminderId: string) => Promise<void>;
  onCreate: (payload: CreateReminderPayload) => Promise<void>;
}

export interface WorkViewModuleRuntime {
  table: WorkViewTableRuntime;
  kanban: WorkViewKanbanRuntime;
  calendar: WorkViewCalendarRuntime;
  files: WorkViewFilesRuntime;
  quickThoughts: WorkViewQuickThoughtsRuntime;
  tasks: WorkViewTasksRuntime;
  timeline: WorkViewTimelineRuntime;
  reminders: WorkViewRemindersRuntime;
}

const normalizeModuleType = (moduleType: unknown): string => {
  if (moduleType === 'inbox') {
    return 'quick_thoughts';
  }
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

    modules.push({
      module_instance_id:
        typeof value.module_instance_id === 'string' && value.module_instance_id
          ? value.module_instance_id
          : `module-${index + 1}`,
      module_type: moduleType,
      size_tier: sizeTier === 'S' || sizeTier === 'M' || sizeTier === 'L' ? sizeTier : 'M',
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

const MAX_MODULES_PER_PANE = 6;

const EMPTY_RUNTIME: WorkViewModuleRuntime = {
  table: {
    views: [],
    defaultViewId: null,
    dataByViewId: {},
  },
  kanban: {
    views: [],
    defaultViewId: null,
    dataByViewId: {},
    onMoveRecord: () => undefined,
  },
  calendar: {
    events: [],
    loading: false,
    scope: 'relevant',
    onScopeChange: () => undefined,
    onCreateEvent: undefined,
  },
  files: {
    paneFiles: [],
    projectFiles: [],
    onUploadPaneFiles: () => undefined,
    onUploadProjectFiles: () => undefined,
    onOpenFile: () => undefined,
  },
  quickThoughts: {
    storageKeyBase: 'hub:quick-thoughts:default',
  },
  tasks: {
    items: [],
    loading: false,
    onCreateTask: async () => {},
    onUpdateTaskStatus: () => undefined,
    onUpdateTaskPriority: () => undefined,
    onUpdateTaskDueDate: () => undefined,
    onDeleteTask: () => undefined,
  },
  timeline: {
    clusters: [],
    activeFilters: ['task', 'event', 'milestone', 'file', 'workspace'],
    loading: false,
    hasMore: false,
    onFilterToggle: () => undefined,
    onLoadMore: () => undefined,
    onItemClick: () => undefined,
  },
  reminders: {
    items: [],
    loading: false,
    error: null,
    onDismiss: async () => undefined,
    onCreate: async () => undefined,
  },
};

export const WorkView = ({
  pane,
  accessDenied = false,
  canEditPane = true,
  modulesEnabled = true,
  workspaceEnabled = true,
  showWorkspaceDocPlaceholder = true,
  onSelectPane,
  onUpdatePane,
  onOpenRecord,
  moduleRuntime,
}: WorkViewProps) => {
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const [pendingModuleSaves, setPendingModuleSaves] = useState(0);
  const [moduleError, setModuleError] = useState<string | null>(null);

  if (accessDenied) {
    return <AccessDeniedView message="Project membership is required for this workspace." />;
  }

  if (!pane) {
    return (
      <section className="rounded-panel border border-subtle bg-elevated p-4">
        <p className="text-sm text-muted">No pane selected.</p>
      </section>
    );
  }

  const mergedRuntime: WorkViewModuleRuntime = {
    ...EMPTY_RUNTIME,
    ...moduleRuntime,
    table: {
      ...EMPTY_RUNTIME.table,
      ...moduleRuntime?.table,
    },
    kanban: {
      ...EMPTY_RUNTIME.kanban,
      ...moduleRuntime?.kanban,
    },
    calendar: {
      ...EMPTY_RUNTIME.calendar,
      ...moduleRuntime?.calendar,
    },
    files: {
      ...EMPTY_RUNTIME.files,
      ...moduleRuntime?.files,
    },
    quickThoughts: {
      ...EMPTY_RUNTIME.quickThoughts,
      ...moduleRuntime?.quickThoughts,
    },
    tasks: {
      ...EMPTY_RUNTIME.tasks,
      ...moduleRuntime?.tasks,
    },
    timeline: {
      ...EMPTY_RUNTIME.timeline,
      ...moduleRuntime?.timeline,
    },
    reminders: {
      ...EMPTY_RUNTIME.reminders,
      ...moduleRuntime?.reminders,
    },
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

  const runPaneUpdate = (payload: { name?: string; pinned?: boolean; sort_order?: number; layout_config?: Record<string, unknown> }) => {
    setModuleError(null);
    void onUpdatePane(pane.pane_id, payload).catch((error) => {
      setModuleError(error instanceof Error ? error.message : 'Pane update failed.');
    });
  };

  const handleAddModule = (moduleType: string) => {
    if (modules.length >= MAX_MODULES_PER_PANE) {
      setModuleError(`A pane supports up to ${MAX_MODULES_PER_PANE} modules.`);
      return;
    }

    const nextModules: ContractModuleConfig[] = [
      ...modules,
      {
        module_instance_id: `${moduleType}-${Date.now()}`,
        module_type: normalizeModuleType(moduleType),
        size_tier: 'M',
        lens: defaultModuleLens(normalizeModuleType(moduleType)),
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

  const handleTogglePaneRegion = (region: 'modules_enabled' | 'workspace_enabled') => {
    const nextModulesEnabled = region === 'modules_enabled' ? !modulesEnabled : modulesEnabled;
    const nextWorkspaceEnabled = region === 'workspace_enabled' ? !workspaceEnabled : workspaceEnabled;
    if (!nextModulesEnabled && !nextWorkspaceEnabled) {
      setModuleError('A pane must keep at least one region enabled.');
      return;
    }

    runPaneUpdate({
      layout_config: {
        ...pane.layout_config,
        modules_enabled: nextModulesEnabled,
        workspace_enabled: nextWorkspaceEnabled,
      },
    });
  };

  return (
    <section className="space-y-4">
      <header className="rounded-panel border border-subtle bg-elevated p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="heading-3 text-primary">{pane.name}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary"
              onClick={() => runPaneUpdate({ pinned: !pane.pinned })}
            >
              {pane.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              type="button"
              className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary"
              onClick={() => onSelectPane(pane.pane_id)}
            >
              Open pane route
            </button>
          </div>
        </div>

        <div className="mt-3">
          <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="pane-name-input">
            Pane name
            <input
              key={pane.pane_id}
              id="pane-name-input"
              defaultValue={pane.name}
              disabled={!canEditPane}
              onBlur={(event) => {
                if (!canEditPane) {
                  return;
                }
                const nextName = event.target.value.trim();
                if (nextName && nextName !== pane.name) {
                  runPaneUpdate({ name: nextName });
                }
              }}
              className="rounded-panel border border-border-muted bg-surface px-3 py-1.5 text-sm text-text"
            />
          </label>
        </div>
        {canEditPane ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
              onClick={() => handleTogglePaneRegion('modules_enabled')}
            >
              {modulesEnabled ? 'Hide modules' : 'Show modules'}
            </button>
            <button
              type="button"
              className="rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary"
              onClick={() => handleTogglePaneRegion('workspace_enabled')}
            >
              {workspaceEnabled ? 'Hide workspace doc' : 'Show workspace doc'}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">Read-only.</p>
        )}
        {moduleError ? <p className="mt-2 text-xs text-danger">{moduleError}</p> : null}
      </header>

      {modulesEnabled ? (
        <ModuleGrid
          modules={modules}
          onAddModule={handleAddModule}
          onRemoveModule={handleRemoveModule}
          onSetModuleLens={handleSetModuleLens}
          showAddControls={canEditPane}
          disableAdd={!canEditPane || modules.length >= MAX_MODULES_PER_PANE || isSavingModules}
          disableMutations={!canEditPane || isSavingModules}
          renderModuleBody={(module) => {
            if (module.module_type === 'table') {
              return (
                <TableModule
                  module={module}
                  runtime={mergedRuntime.table}
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
                  runtime={mergedRuntime.kanban}
                  canEditPane={canEditPane}
                  onOpenRecord={onOpenRecord}
                  onSetModuleBinding={handleSetModuleBinding}
                />
              );
            }

            if (module.module_type === 'calendar') {
              return <CalendarModule runtime={mergedRuntime.calendar} onOpenRecord={onOpenRecord} />;
            }

            if (module.module_type === 'tasks') {
              return <TasksModule module={module} runtime={mergedRuntime.tasks} canEditPane={canEditPane} />;
            }

            if (module.module_type === 'files') {
              return <FilesModule module={module} runtime={mergedRuntime.files} canEditPane={canEditPane} />;
            }

            if (module.module_type === 'reminders') {
              return <RemindersModule module={module} runtime={mergedRuntime.reminders} />;
            }

            if (module.module_type === 'quick_thoughts') {
              return (
                <QuickThoughtsModule
                  module={module}
                  runtime={mergedRuntime.quickThoughts}
                  pane={pane}
                  canEditPane={canEditPane}
                />
              );
            }

            if (module.module_type === 'timeline') {
              return <TimelineModule runtime={mergedRuntime.timeline} />;
            }

            return <p className="text-xs text-muted">{module.module_type}</p>;
          }}
        />
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
    </section>
  );
};
