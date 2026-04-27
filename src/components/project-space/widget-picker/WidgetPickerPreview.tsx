import { cn } from '../../../lib/cn';
import type { HubProjectSummary } from '../../../services/hub/types';
import { WidgetLoadingState } from '../WidgetFeedback';
import { WidgetShell } from '../WidgetShell';
import {
  CalendarWidget,
  FilesWidget,
  KanbanWidget,
  QuickThoughtsWidget,
  RemindersWidget,
  TableWidget,
  TasksWidget,
  TimelineWidget,
} from '../widgets';
import type { WidgetPickerSeedData, WidgetPickerSelection } from './widgetPickerTypes';
import {
  buildPreviewWidget,
  calendarContract,
  filesContract,
  kanbanContract,
  quickThoughtsContract,
  remindersContract,
  tableContract,
  tasksContract,
  timelineContract,
} from './widgetPickerPreviewContracts';

interface WidgetPickerPreviewProps {
  selection: WidgetPickerSelection | null;
  seedData: WidgetPickerSeedData;
  loading: boolean;
  error: string | null;
}

const previewWidthClass = {
  S: 'widget-picker-preview-s',
  M: 'widget-picker-preview-m',
  L: 'widget-picker-preview-l',
};

const previewProject: HubProjectSummary = {
  project_id: 'widget-picker-preview-project',
  space_id: 'widget-picker-preview-project',
  name: 'Widget Preview',
  sort_order: 0,
  position: null,
  pinned: false,
  layout_config: {},
  doc_id: null,
  members: [],
};

export const WidgetPickerPreview = ({
  selection,
  seedData,
  loading,
  error,
}: WidgetPickerPreviewProps) => {
  if (!selection) {
    return <p className="text-sm text-muted">Choose a widget to preview it.</p>;
  }
  if (loading) {
    return <WidgetLoadingState label="Loading widget preview data" rows={5} />;
  }
  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  const widget = buildPreviewWidget(selection);
  const seed = seedData[selection.widgetType]?.[selection.sizeTier] ?? {};
  const body = (() => {
    if (selection.widgetType === 'table') {
      return <TableWidget widget={widget} contract={tableContract(seed)} canEditProject={false} previewMode onSetWidgetBinding={() => {}} />;
    }
    if (selection.widgetType === 'kanban') {
      return <KanbanWidget widget={widget} contract={kanbanContract(seed)} canEditProject={false} previewMode onSetWidgetBinding={() => {}} />;
    }
    if (selection.widgetType === 'calendar') {
      return <CalendarWidget widget={widget} contract={calendarContract(seed)} previewMode />;
    }
    if (selection.widgetType === 'tasks') {
      return <TasksWidget widget={widget} contract={tasksContract(seed)} canEditProject={false} previewMode />;
    }
    if (selection.widgetType === 'reminders') {
      return <RemindersWidget widget={widget} contract={remindersContract(seed)} canEditProject={false} previewMode />;
    }
    if (selection.widgetType === 'files') {
      return <FilesWidget widget={widget} contract={filesContract(seed)} canEditProject={false} previewMode />;
    }
    if (selection.widgetType === 'quick_thoughts') {
      return <QuickThoughtsWidget widget={widget} contract={quickThoughtsContract(seed)} project={previewProject} canEditProject={false} previewMode />;
    }
    return <TimelineWidget contract={timelineContract(seed)} previewMode />;
  })();

  return (
    <div className="flex h-full min-h-0 w-full items-start justify-center overflow-y-auto">
      <div
        tabIndex={-1}
        aria-hidden="true"
        inert
        className={cn('widget-picker-readonly', previewWidthClass[selection.sizeTier])}
      >
        <WidgetShell widgetType={selection.widgetType} sizeTier={selection.sizeTier} readOnlyState removeDisabled previewMode onRemove={() => {}}>
          {body}
        </WidgetShell>
      </div>
    </div>
  );
};
