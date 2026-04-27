import { cn } from '../../../lib/cn';
import type { HubProjectSummary } from '../../../services/hub/types';
import { ModuleLoadingState } from '../ModuleFeedback';
import { ModuleShell } from '../ModuleShell';
import {
  CalendarModule,
  FilesModule,
  KanbanModule,
  QuickThoughtsModule,
  RemindersModule,
  TableModule,
  TasksModule,
  TimelineModule,
} from '../modules';
import type { ModulePickerSeedData, ModulePickerSelection } from './modulePickerTypes';
import {
  buildPreviewModule,
  calendarContract,
  filesContract,
  kanbanContract,
  quickThoughtsContract,
  remindersContract,
  tableContract,
  tasksContract,
  timelineContract,
} from './modulePickerPreviewContracts';

interface ModulePickerPreviewProps {
  selection: ModulePickerSelection | null;
  seedData: ModulePickerSeedData;
  loading: boolean;
  error: string | null;
}

const previewWidthClass = {
  S: 'module-picker-preview-s',
  M: 'module-picker-preview-m',
  L: 'module-picker-preview-l',
};

const previewProject: HubProjectSummary = {
  project_id: 'module-picker-preview-project',
  space_id: 'module-picker-preview-project',
  name: 'Module Preview',
  sort_order: 0,
  position: null,
  pinned: false,
  layout_config: {},
  doc_id: null,
  members: [],
};

export const ModulePickerPreview = ({
  selection,
  seedData,
  loading,
  error,
}: ModulePickerPreviewProps) => {
  if (!selection) {
    return <p className="text-sm text-muted">Choose a module to preview it.</p>;
  }
  if (loading) {
    return <ModuleLoadingState label="Loading module preview data" rows={5} />;
  }
  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  const module = buildPreviewModule(selection);
  const seed = seedData[selection.moduleType]?.[selection.sizeTier] ?? {};
  const body = (() => {
    if (selection.moduleType === 'table') {
      return <TableModule module={module} contract={tableContract(seed)} canEditProject={false} previewMode onSetModuleBinding={() => {}} />;
    }
    if (selection.moduleType === 'kanban') {
      return <KanbanModule module={module} contract={kanbanContract(seed)} canEditProject={false} previewMode onSetModuleBinding={() => {}} />;
    }
    if (selection.moduleType === 'calendar') {
      return <CalendarModule module={module} contract={calendarContract(seed)} previewMode />;
    }
    if (selection.moduleType === 'tasks') {
      return <TasksModule module={module} contract={tasksContract(seed)} canEditProject={false} previewMode />;
    }
    if (selection.moduleType === 'reminders') {
      return <RemindersModule module={module} contract={remindersContract(seed)} canEditProject={false} previewMode />;
    }
    if (selection.moduleType === 'files') {
      return <FilesModule module={module} contract={filesContract(seed)} canEditProject={false} previewMode />;
    }
    if (selection.moduleType === 'quick_thoughts') {
      return <QuickThoughtsModule module={module} contract={quickThoughtsContract(seed)} project={previewProject} canEditProject={false} previewMode />;
    }
    return <TimelineModule contract={timelineContract(seed)} previewMode />;
  })();

  return (
    <div className="flex h-full min-h-0 w-full items-start justify-center overflow-y-auto">
      <div
        tabIndex={-1}
        aria-hidden="true"
        inert
        className={cn('module-picker-readonly', previewWidthClass[selection.sizeTier])}
      >
        <ModuleShell moduleType={selection.moduleType} sizeTier={selection.sizeTier} readOnlyState removeDisabled previewMode onRemove={() => {}}>
          {body}
        </ModuleShell>
      </div>
    </div>
  );
};
