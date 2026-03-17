import { Suspense, lazy, useRef, useState } from 'react';
import { AccessDeniedView } from '../auth/AccessDeniedView';
import { ModuleGrid, type ContractModuleConfig } from './ModuleGrid';
import type { HubCollectionField, HubPaneSummary, HubRecordSummary } from '../../services/hub/types';
import type { CalendarScope } from './CalendarModuleSkin';
import type { FilesModuleItem } from './FilesModuleSkin';
import { ModuleLoadingState } from './ModuleFeedback';
import { TimelineFeed, type TimelineCluster, type TimelineEventType } from './TimelineFeed';

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

export interface WorkViewTimelineRuntime {
  clusters: TimelineCluster[];
  activeFilters: TimelineEventType[];
  loading: boolean;
  hasMore: boolean;
  onFilterToggle: (type: TimelineEventType) => void;
  onLoadMore: () => void;
  onItemClick: (recordId: string, recordType: string) => void;
}

export interface WorkViewModuleRuntime {
  table: WorkViewTableRuntime;
  kanban: WorkViewKanbanRuntime;
  calendar: WorkViewCalendarRuntime;
  files: WorkViewFilesRuntime;
  quickThoughts: WorkViewQuickThoughtsRuntime;
  timeline: WorkViewTimelineRuntime;
}

const TableModuleSkin = lazy(async () => {
  const module = await import('./TableModuleSkin');
  return { default: module.TableModuleSkin };
});

const KanbanModuleSkin = lazy(async () => {
  const module = await import('./KanbanModuleSkin');
  return { default: module.KanbanModuleSkin };
});

const CalendarModuleSkin = lazy(async () => {
  const module = await import('./CalendarModuleSkin');
  return { default: module.CalendarModuleSkin };
});

const FilesModuleSkin = lazy(async () => {
  const module = await import('./FilesModuleSkin');
  return { default: module.FilesModuleSkin };
});

const QuickThoughtsModuleSkin = lazy(async () => {
  const module = await import('./InboxCaptureModuleSkin');
  return { default: module.QuickThoughtsModuleSkin };
});

const normalizeModuleType = (moduleType: unknown): string => {
  if (moduleType === 'inbox') {
    return 'quick_thoughts';
  }
  return typeof moduleType === 'string' && moduleType ? moduleType : 'unknown';
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
      lens: moduleType === 'quick_thoughts' ? 'pane_scratch' : lens === 'pane_scratch' ? 'pane_scratch' : 'project',
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
    lens: normalizeModuleType(module.module_type) === 'quick_thoughts' ? 'pane_scratch' : module.lens,
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
  timeline: {
    clusters: [],
    activeFilters: ['task', 'event', 'milestone', 'file', 'workspace'],
    loading: false,
    hasMore: false,
    onFilterToggle: () => undefined,
    onLoadMore: () => undefined,
    onItemClick: () => undefined,
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
    timeline: {
      ...EMPTY_RUNTIME.timeline,
      ...moduleRuntime?.timeline,
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
        lens: normalizeModuleType(moduleType) === 'quick_thoughts' ? 'pane_scratch' : 'project',
      },
    ];
    void saveModules(nextModules);
  };

  const handleRemoveModule = (moduleInstanceId: string) => {
    const nextModules = modules.filter((module) => module.module_instance_id !== moduleInstanceId);
    void saveModules(nextModules);
  };

  const handleSetModuleLens = (moduleInstanceId: string, lens: 'project' | 'pane_scratch') => {
    const nextModules = modules.map((module) =>
      module.module_instance_id === moduleInstanceId
        ? {
            ...module,
            lens: module.module_type === 'quick_thoughts' ? 'pane_scratch' : lens,
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

  const resolveBoundViewId = (
    module: ContractModuleConfig,
    availableViews: WorkViewBoundViewSummary[],
    defaultViewId: string | null,
  ): string | null => {
    const requested = module.binding?.view_id;
    if (requested && availableViews.some((view) => view.view_id === requested)) {
      return requested;
    }
    return defaultViewId;
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
            const selectedViewId = resolveBoundViewId(module, mergedRuntime.table.views, mergedRuntime.table.defaultViewId);
            const viewData = selectedViewId ? mergedRuntime.table.dataByViewId[selectedViewId] : undefined;
            return (
              <div className="space-y-3">
                {mergedRuntime.table.views.length > 0 ? (
                  <label className="block text-xs text-muted">
                    Source view
                    <select
                      value={selectedViewId || ''}
                      disabled={!canEditPane}
                      onChange={(event) => handleSetModuleBinding(module.module_instance_id, event.target.value)}
                      className="mt-1 w-full rounded-panel border border-border-muted bg-surface px-2 py-1 text-xs text-text"
                    >
                      {mergedRuntime.table.views.map((view) => (
                        <option key={view.view_id} value={view.view_id}>
                          {view.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {viewData?.error ? <p className="text-xs text-danger">{viewData.error}</p> : null}
                <Suspense fallback={<ModuleLoadingState label="Loading table module" rows={6} />}>
                  <TableModuleSkin
                    schema={viewData?.schema || null}
                    records={viewData?.records || []}
                    loading={viewData?.loading ?? false}
                    onOpenRecord={(recordId) => onOpenRecord?.(recordId)}
                  />
                </Suspense>
              </div>
            );
          }

          if (module.module_type === 'kanban') {
            const selectedViewId = resolveBoundViewId(module, mergedRuntime.kanban.views, mergedRuntime.kanban.defaultViewId);
            const viewData = selectedViewId ? mergedRuntime.kanban.dataByViewId[selectedViewId] : undefined;
            return (
              <div className="space-y-3">
                {mergedRuntime.kanban.views.length > 0 ? (
                  <label className="block text-xs text-muted">
                    Source view
                    <select
                      value={selectedViewId || ''}
                      disabled={!canEditPane}
                      onChange={(event) => handleSetModuleBinding(module.module_instance_id, event.target.value)}
                      className="mt-1 w-full rounded-panel border border-border-muted bg-surface px-2 py-1 text-xs text-text"
                    >
                      {mergedRuntime.kanban.views.map((view) => (
                        <option key={view.view_id} value={view.view_id}>
                          {view.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {viewData?.error ? <p className="text-xs text-danger">{viewData.error}</p> : null}
                <Suspense fallback={<ModuleLoadingState label="Loading kanban module" rows={5} />}>
                  <KanbanModuleSkin
                    groups={viewData?.groups || []}
                    groupOptions={viewData?.groupOptions || []}
                    loading={viewData?.loading ?? false}
                    groupingConfigured={viewData?.groupingConfigured ?? false}
                    groupingMessage={viewData?.groupingMessage}
                    metadataFieldIds={viewData?.metadataFieldIds}
                    onOpenRecord={(recordId) => onOpenRecord?.(recordId)}
                    onMoveRecord={(recordId, nextGroup) => {
                      if (canEditPane && selectedViewId) {
                        mergedRuntime.kanban.onMoveRecord(selectedViewId, recordId, nextGroup);
                      }
                    }}
                    readOnly={!canEditPane}
                  />
                </Suspense>
              </div>
            );
          }

          if (module.module_type === 'calendar') {
            return (
              <Suspense fallback={<ModuleLoadingState label="Loading calendar module" rows={5} />}>
                <CalendarModuleSkin
                  events={mergedRuntime.calendar.events}
                  loading={mergedRuntime.calendar.loading}
                  scope={mergedRuntime.calendar.scope}
                  onScopeChange={mergedRuntime.calendar.onScopeChange}
                  onOpenRecord={(recordId) => onOpenRecord?.(recordId)}
                />
              </Suspense>
            );
          }

          if (module.module_type === 'files') {
            return (
              <Suspense fallback={<ModuleLoadingState label="Loading files module" rows={4} />}>
                <FilesModuleSkin
                  sizeTier={module.size_tier}
                  files={module.lens === 'project' ? mergedRuntime.files.projectFiles : mergedRuntime.files.paneFiles}
                  onUpload={canEditPane ? (module.lens === 'project' ? mergedRuntime.files.onUploadProjectFiles : mergedRuntime.files.onUploadPaneFiles) : () => undefined}
                  onOpenFile={mergedRuntime.files.onOpenFile}
                  readOnly={!canEditPane}
                />
              </Suspense>
            );
          }

          if (module.module_type === 'quick_thoughts') {
            return (
              <Suspense fallback={<ModuleLoadingState label="Loading Quick Thoughts module" rows={5} />}>
                <QuickThoughtsModuleSkin
                  key={`${mergedRuntime.quickThoughts.storageKeyBase}:${pane.pane_id}:${module.module_instance_id}`}
                  sizeTier={module.size_tier}
                  storageKey={`${mergedRuntime.quickThoughts.storageKeyBase}:${pane.pane_id}:${module.module_instance_id}`}
                  legacyStorageKey={
                    mergedRuntime.quickThoughts.legacyStorageKeyBase
                      ? `${mergedRuntime.quickThoughts.legacyStorageKeyBase}:${pane.pane_id}:${module.module_instance_id}`
                      : undefined
                  }
                  readOnly={!canEditPane}
                />
              </Suspense>
            );
          }

          if (module.module_type === 'timeline') {
            return (
              <TimelineFeed
                clusters={mergedRuntime.timeline.clusters}
                activeFilters={mergedRuntime.timeline.activeFilters}
                isLoading={mergedRuntime.timeline.loading}
                hasMore={mergedRuntime.timeline.hasMore}
                onFilterToggle={mergedRuntime.timeline.onFilterToggle}
                onLoadMore={mergedRuntime.timeline.onLoadMore}
                onItemClick={mergedRuntime.timeline.onItemClick}
              />
            );
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
