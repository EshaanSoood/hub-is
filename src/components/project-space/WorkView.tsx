import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AccessDeniedView } from '../auth/AccessDeniedView';
import { WidgetGrid, type ContractWidgetConfig } from './WidgetGrid';
import { AccessibleDialog, Icon, IconButton } from '../primitives';
import type { HubProjectSummary } from '../../services/hub/types';
import { clampWidgetSizeTier, widgetCatalogEntry } from './widgetCatalog';
import type {
  CalendarWidgetContract,
  KanbanWidgetContract,
  RemindersWidgetContract,
  TableWidgetContract,
  TasksWidgetContract,
  TimelineWidgetContract,
} from './widgetContracts';
import {
  CalendarWidget,
  KanbanWidget,
  RemindersWidget,
  TableWidget,
  TasksWidget,
  TimelineWidget,
} from './widgets';
import { dialogLayoutIds } from '../../styles/motion';

interface WorkViewProps {
  layoutId?: string;
  project: HubProjectSummary | null;
  accessDenied?: boolean;
  canEditProject?: boolean;
  widgetsEnabled?: boolean;
  showWorkspaceDocPlaceholder?: boolean;
  onUpdateProject: (projectId: string, payload: { name?: string; pinned?: boolean; sort_order?: number; layout_config?: Record<string, unknown> }) => Promise<void>;
  onOpenRecord?: (recordId: string) => void;
  tableContract?: Partial<TableWidgetContract>;
  kanbanContract?: Partial<KanbanWidgetContract>;
  calendarContract?: Partial<CalendarWidgetContract>;
  tasksContract?: Partial<TasksWidgetContract>;
  timelineContract?: Partial<TimelineWidgetContract>;
  remindersContract?: Partial<RemindersWidgetContract>;
}

const normalizeWidgetType = (widgetType: unknown): string => {
  return typeof widgetType === 'string' && widgetType ? widgetType : 'unknown';
};

const defaultWidgetLens = (widgetType: string): ContractWidgetConfig['lens'] => {
  if (widgetType === 'tasks') {
    return 'project';
  }
  if (widgetType === 'reminders') {
    return 'project';
  }
  return 'space';
};

const normalizeWidgetLens = (widgetType: string, lens: unknown): ContractWidgetConfig['lens'] => {
  if (widgetType === 'tasks') {
    return lens === 'space' ? 'space' : 'project';
  }
  if (widgetType === 'reminders') {
    return 'project';
  }
  if (lens === 'project_scratch') {
    return 'project_scratch';
  }
  if (lens === 'project') {
    return 'project';
  }
  return 'space';
};

const parseWidgets = (layoutConfig: Record<string, unknown> | null | undefined): ContractWidgetConfig[] => {
  if (!layoutConfig || typeof layoutConfig !== 'object' || Array.isArray(layoutConfig)) {
    return [];
  }
  const raw = Array.isArray(layoutConfig.widgets) ? layoutConfig.widgets : [];
  const widgets: ContractWidgetConfig[] = [];

  for (const [index, candidate] of raw.entries()) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue;
    }

    const value = candidate as Record<string, unknown>;
    const widgetType = normalizeWidgetType(value.widget_type);
    if (!widgetCatalogEntry(widgetType)) {
      continue;
    }
    const sizeTier = value.size_tier;
    const lens = value.lens;
    const rawBinding = value.binding;
    const binding: ContractWidgetConfig['binding'] =
      rawBinding && typeof rawBinding === 'object' && !Array.isArray(rawBinding)
        ? {
            view_id:
              typeof (rawBinding as { view_id?: unknown }).view_id === 'string'
                ? (rawBinding as { view_id: string }).view_id
                : undefined,
            owned_view_id:
              typeof (rawBinding as { owned_view_id?: unknown }).owned_view_id === 'string'
                ? (rawBinding as { owned_view_id: string }).owned_view_id
                : undefined,
            source_mode:
              (rawBinding as { source_mode?: unknown }).source_mode === 'owned'
                ? 'owned'
                : (rawBinding as { source_mode?: unknown }).source_mode === 'linked'
                  ? 'linked'
                  : undefined,
          }
        : undefined;

    const normalizedSizeTier = sizeTier === 'S' || sizeTier === 'M' || sizeTier === 'L' ? sizeTier : 'M';

    widgets.push({
      widget_instance_id:
        typeof value.widget_instance_id === 'string' && value.widget_instance_id
          ? value.widget_instance_id
          : `widget-${index + 1}`,
      widget_type: widgetType,
      size_tier: clampWidgetSizeTier(widgetType, normalizedSizeTier),
      lens: normalizeWidgetLens(widgetType, lens),
      binding,
    });
  }

  return widgets;
};

const serializeWidgets = (widgets: ContractWidgetConfig[]): Array<Record<string, unknown>> =>
  widgets.map((widget) => ({
    widget_instance_id: widget.widget_instance_id,
    widget_type: normalizeWidgetType(widget.widget_type),
    size_tier: widget.size_tier,
    lens: normalizeWidgetLens(normalizeWidgetType(widget.widget_type), widget.lens),
    ...(
      widget.binding?.view_id || widget.binding?.owned_view_id || widget.binding?.source_mode
        ? {
            binding: {
              ...(widget.binding?.view_id ? { view_id: widget.binding.view_id } : {}),
              ...(widget.binding?.owned_view_id ? { owned_view_id: widget.binding.owned_view_id } : {}),
              ...(widget.binding?.source_mode ? { source_mode: widget.binding.source_mode } : {}),
            },
          }
        : {}
    ),
  }));

const EMPTY_TABLE_CONTRACT: TableWidgetContract = {
  views: [],
  defaultViewId: null,
  dataByViewId: {},
};

const EMPTY_KANBAN_CONTRACT: KanbanWidgetContract = {
  views: [],
  defaultViewId: null,
  dataByViewId: {},
  onMoveRecord: () => {},
};

const EMPTY_CALENDAR_CONTRACT: CalendarWidgetContract = {
  events: [],
  loading: false,
  scope: 'relevant',
  onScopeChange: () => {},
  onCreateEvent: undefined,
  onRescheduleEvent: undefined,
};

const EMPTY_TASKS_CONTRACT: TasksWidgetContract = {
  items: [],
  loading: false,
  onCreateTask: async () => {},
  onUpdateTaskStatus: () => {},
  onUpdateTaskPriority: () => {},
  onUpdateTaskDueDate: () => {},
  onDeleteTask: () => {},
  onInsertToEditor: undefined,
};

const EMPTY_TIMELINE_CONTRACT: TimelineWidgetContract = {
  clusters: [],
  activeFilters: ['task', 'event', 'milestone', 'file', 'workspace'],
  loading: false,
  hasMore: false,
  onFilterToggle: () => {},
  onLoadMore: () => {},
  onItemClick: () => {},
};

const EMPTY_REMINDERS_CONTRACT: RemindersWidgetContract = {
  items: [],
  loading: false,
  error: null,
  onDismiss: async () => {},
  onCreate: async () => {},
  onInsertToEditor: undefined,
};

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

const MobileWidgetsOverlay = ({ widgetGrid }: { widgetGrid: ReactNode }) => {
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
    return <div>{widgetGrid}</div>;
  }

  const mobileWidgetsLayoutId = !prefersReducedMotion ? dialogLayoutIds.mobileWidgets : undefined;

  return (
    <>
      <motion.button
        layoutId={mobileWidgetsLayoutId}
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={overlayOpen}
        onClick={() => setOverlayOpen(true)}
        className="ghost-button sticky top-0 z-20 w-full bg-surface-highest px-3 py-2 text-center text-sm font-semibold text-text md:hidden"
      >
        Widgets
      </motion.button>

      {overlayOpen ? (
        <AccessibleDialog
          open={overlayOpen}
          onClose={() => setOverlayOpen(false)}
          triggerRef={triggerRef}
          layoutId={mobileWidgetsLayoutId}
          title="Widgets"
          description="Manage and browse project widgets"
          hideHeader
          panelClassName="left-1/2 top-1/2 h-[100dvh] w-screen max-w-none -translate-x-1/2 -translate-y-1/2 rounded-none border-none bg-surface p-0 md:hidden"
          contentClassName="mt-0 h-full overflow-y-auto p-4"
        >
          <div className="relative pt-10">
            <IconButton aria-label="Close widgets" className="absolute right-0 top-0" onClick={() => setOverlayOpen(false)}>
              <Icon name="close" className="h-4 w-4" />
            </IconButton>
            {widgetGrid}
          </div>
        </AccessibleDialog>
      ) : null}
    </>
  );
};

export const WorkView = ({
  layoutId,
  project,
  accessDenied = false,
  canEditProject = true,
  widgetsEnabled = true,
  showWorkspaceDocPlaceholder = true,
  onUpdateProject,
  onOpenRecord,
  tableContract,
  kanbanContract,
  calendarContract,
  tasksContract,
  timelineContract,
  remindersContract,
}: WorkViewProps) => {
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const [pendingWidgetSaves, setPendingWidgetSaves] = useState(0);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  if (accessDenied) {
    return (
      <motion.section layoutId={layoutId} className="space-y-4">
        <AccessDeniedView message="Space membership is required for this workspace." />
      </motion.section>
    );
  }

  if (!project) {
    return (
      <motion.section layoutId={layoutId} className="widget-sheet p-4">
        <p className="text-sm text-muted">No project selected.</p>
      </motion.section>
    );
  }

  const resolvedTableContract: TableWidgetContract = {
    ...EMPTY_TABLE_CONTRACT,
    ...tableContract,
  };
  const resolvedKanbanContract: KanbanWidgetContract = {
    ...EMPTY_KANBAN_CONTRACT,
    ...kanbanContract,
  };
  const resolvedCalendarContract: CalendarWidgetContract = {
    ...EMPTY_CALENDAR_CONTRACT,
    ...calendarContract,
  };
  const resolvedTasksContract: TasksWidgetContract = {
    ...EMPTY_TASKS_CONTRACT,
    ...tasksContract,
  };
  const resolvedTimelineContract: TimelineWidgetContract = {
    ...EMPTY_TIMELINE_CONTRACT,
    ...timelineContract,
  };
  const resolvedRemindersContract: RemindersWidgetContract = {
    ...EMPTY_REMINDERS_CONTRACT,
    ...remindersContract,
  };

  const widgets = parseWidgets(project.layout_config);
  const isSavingWidgets = pendingWidgetSaves > 0;

  const saveWidgets = (nextWidgets: ContractWidgetConfig[]) => {
    setWidgetError(null);
    setPendingWidgetSaves((count) => count + 1);
    saveChainRef.current = saveChainRef.current
      .then(async () => {
        await onUpdateProject(project.project_id, {
          layout_config: {
            ...project.layout_config,
            widgets: serializeWidgets(nextWidgets),
          },
        });
      })
      .catch((error) => {
        setWidgetError(error instanceof Error ? error.message : 'Widget layout update failed.');
      })
      .finally(() => {
        setPendingWidgetSaves((count) => Math.max(0, count - 1));
      });
    return saveChainRef.current;
  };

  const handleAddWidget = (widgetType: string, sizeTier: ContractWidgetConfig['size_tier']) => {
    const normalizedWidgetType = normalizeWidgetType(widgetType);
    if (!widgetCatalogEntry(normalizedWidgetType)) {
      return;
    }
    const nextWidgets: ContractWidgetConfig[] = [
      ...widgets,
      {
        widget_instance_id: `${widgetType}-${Date.now()}`,
        widget_type: normalizedWidgetType,
        size_tier: clampWidgetSizeTier(normalizedWidgetType, sizeTier),
        lens: defaultWidgetLens(normalizedWidgetType),
        binding: normalizedWidgetType === 'kanban' ? { source_mode: 'owned' } : undefined,
      },
    ];
    void saveWidgets(nextWidgets);
  };

  const handleRemoveWidget = (widgetInstanceId: string) => {
    const nextWidgets = widgets.filter((widget) => widget.widget_instance_id !== widgetInstanceId);
    void saveWidgets(nextWidgets);
  };

  const handleSetWidgetLens = (widgetInstanceId: string, lens: ContractWidgetConfig['lens']) => {
    const nextWidgets = widgets.map((widget) =>
      widget.widget_instance_id === widgetInstanceId
        ? {
            ...widget,
            lens: normalizeWidgetLens(widget.widget_type, lens),
          }
        : widget,
    );
    void saveWidgets(nextWidgets);
  };

  const handleResizeWidget = (widgetInstanceId: string, sizeTier: ContractWidgetConfig['size_tier']) => {
    const nextWidgets = widgets.map((widget) =>
      widget.widget_instance_id === widgetInstanceId
        ? {
            ...widget,
            size_tier: clampWidgetSizeTier(widget.widget_type, sizeTier),
          }
        : widget,
    );
    void saveWidgets(nextWidgets);
  };

  const handleSetWidgetBinding = (widgetInstanceId: string, binding: ContractWidgetConfig['binding']) => {
    const nextWidgets = widgets.map((widget) =>
      widget.widget_instance_id === widgetInstanceId
        ? {
            ...widget,
            binding,
          }
        : widget,
    );
    void saveWidgets(nextWidgets);
  };

  const renderWidgetBody = (widget: ContractWidgetConfig) => {
    if (widget.widget_type === 'table') {
      return (
        <TableWidget
          widget={widget}
          contract={resolvedTableContract}
          canEditProject={canEditProject}
          onOpenRecord={onOpenRecord}
          onSetWidgetBinding={handleSetWidgetBinding}
        />
      );
    }

    if (widget.widget_type === 'kanban') {
      return (
        <KanbanWidget
          widget={widget}
          contract={resolvedKanbanContract}
          canEditProject={canEditProject}
          onOpenRecord={onOpenRecord}
          onSetWidgetBinding={handleSetWidgetBinding}
        />
      );
    }

    if (widget.widget_type === 'calendar') {
      return <CalendarWidget widget={widget} contract={resolvedCalendarContract} onOpenRecord={onOpenRecord} />;
    }

    if (widget.widget_type === 'tasks') {
      return <TasksWidget widget={widget} contract={resolvedTasksContract} canEditProject={canEditProject} />;
    }

    if (widget.widget_type === 'reminders') {
      return <RemindersWidget widget={widget} contract={resolvedRemindersContract} canEditProject={canEditProject} />;
    }

    if (widget.widget_type === 'timeline') {
      return <TimelineWidget contract={resolvedTimelineContract} />;
    }

    return <p className="text-xs text-muted">{widget.widget_type}</p>;
  };

  const widgetGrid = (
    <WidgetGrid
      widgets={widgets}
      onAddWidget={handleAddWidget}
      onRemoveWidget={handleRemoveWidget}
      onSetWidgetLens={handleSetWidgetLens}
      onResizeWidget={handleResizeWidget}
      showAddControls={canEditProject}
      disableAdd={!canEditProject || isSavingWidgets}
      disableMutations={!canEditProject || isSavingWidgets}
      readOnlyState={!canEditProject}
      renderWidgetBody={renderWidgetBody}
    />
  );

  return (
    <motion.section layoutId={layoutId} className="space-y-4">
      <header className="section-scored rounded-panel bg-surface-container p-4 shadow-soft-subtle">
        <h2 className="heading-3 text-text">{project.name}</h2>
        {widgetError ? <p className="mt-2 text-xs text-danger">{widgetError}</p> : null}
      </header>

      {widgetsEnabled ? (
        <>
          <MobileWidgetsOverlay key={project.project_id} widgetGrid={widgetGrid} />
        </>
      ) : (
        <section className="widget-sheet p-4">
          <h3 className="heading-4 text-text">Structured Widgets Off</h3>
          <p className="mt-1 text-sm text-muted">Widgets hidden.</p>
        </section>
      )}

      {showWorkspaceDocPlaceholder ? (
        <section className="widget-sheet p-4">
          <h3 className="heading-4 text-text">Workspace Doc</h3>
          <p className="mt-1 text-sm text-muted">Doc ID: {project.docs[0]?.doc_id || 'missing'}</p>
        </section>
      ) : null}
    </motion.section>
  );
};
