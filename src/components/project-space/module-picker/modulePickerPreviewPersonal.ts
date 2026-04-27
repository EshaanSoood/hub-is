import type {
  CalendarModuleContract,
  FilesModuleContract,
  QuickThoughtsModuleContract,
  RemindersModuleContract,
  TasksModuleContract,
  TimelineModuleContract,
} from '../moduleContracts';
import type { ModulePickerSeedPayload } from './modulePickerTypes';
import { addMinutes, asArray, asRecord, asText, noop, noopAsync, weekDate } from './modulePickerPreviewUtils';

export const calendarContract = (seed: ModulePickerSeedPayload): CalendarModuleContract => ({
  events: asArray(seed.events).map((event, index) => {
    const value = asRecord(event);
    const start = weekDate(Number(value.dayOffset ?? index), Number(value.hour ?? 10));
    const end = new Date(start.getTime() + 60 * 60_000);
    return {
      record_id: `preview-event-${index}`,
      title: asText(value.title, 'Preview event'),
      event_state: {
        start_dt: start.toISOString(),
        end_dt: end.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        location: null,
        updated_at: addMinutes(-index),
      },
      participants: [],
    };
  }),
  loading: false,
  scope: 'all',
  onScopeChange: noop,
});

export const tasksContract = (seed: ModulePickerSeedPayload): TasksModuleContract => ({
  items: asArray(seed.items).map((item, index) => {
    const value = asRecord(item);
    const done = Boolean(value.checked);
    return {
      id: `preview-task-${index}`,
      label: asText(value.title, 'Preview task'),
      dueAt: null,
      dueLabel: 'Someday',
      categoryId: 'preview',
      categoryValue: null,
      assigneeId: 'preview',
      assigneeLabel: 'You',
      priority: done ? 'low' : 'medium',
      priorityValue: done ? 'low' : 'medium',
      status: done ? 'done' : 'todo',
      subtasks: [],
    };
  }),
  loading: false,
  onCreateTask: noopAsync,
  onUpdateTaskStatus: noop,
  onUpdateTaskPriority: noop,
  onUpdateTaskDueDate: noop,
  onDeleteTask: noop,
});

export const remindersContract = (seed: ModulePickerSeedPayload): RemindersModuleContract => ({
  items: asArray(seed.items).map((item, index) => {
    const value = asRecord(item);
    return {
      reminder_id: `preview-reminder-${index}`,
      record_id: `preview-reminder-record-${index}`,
      record_title: asText(value.title, 'Preview reminder'),
      space_id: 'preview-project',
      remind_at: addMinutes(Number(value.minutesFromNow ?? 60)),
      channels: ['in_app'],
      recurrence_json: null,
      created_at: addMinutes(-5),
      fired_at: null,
      overdue: false,
    };
  }),
  loading: false,
  onDismiss: noopAsync,
  onCreate: noopAsync,
});

export const filesContract = (seed: ModulePickerSeedPayload): FilesModuleContract => {
  const files = asArray(seed.items).map((name, index) => {
    const fileName = asText(name);
    const extensionDotIndex = fileName.lastIndexOf('.');
    return {
      id: `preview-file-${index}`,
      name: fileName,
      ext: extensionDotIndex > 0 ? fileName.slice(extensionDotIndex + 1) : '',
      sizeLabel: `${index + 1}.${index + 2} MB`,
      sizeBytes: (index + 1) * 1024 * 1024,
      uploadedAt: 'Just now',
      uploadedAtTimestamp: Date.now() - index * 60_000,
    };
  });
  return { projectFiles: files, spaceFiles: files, onUploadProjectFiles: noop, onUploadSpaceFiles: noop, onOpenFile: noop };
};

export const timelineContract = (seed: ModulePickerSeedPayload): TimelineModuleContract => ({
  clusters: [{
    date: 'Today',
    items: asArray(seed.items).map((item, index) => {
      const value = asRecord(item);
      const minutesAgo = Number(value.minutesAgo ?? index * 30);
      return {
        id: `preview-timeline-${index}`,
        type: index === 1 ? 'task' : 'workspace',
        label: asText(value.title, 'Preview timeline item'),
        timestamp: addMinutes(-minutesAgo),
        timestampRelative: `${minutesAgo}m ago`,
        dotColor: index === 1 ? 'bg-primary' : 'bg-capture-rail',
      };
    }),
  }],
  activeFilters: ['task', 'event', 'milestone', 'file', 'workspace'],
  loading: false,
  hasMore: false,
  onFilterToggle: noop,
  onLoadMore: noop,
  onItemClick: noop,
});

export const quickThoughtsContract = (seed: ModulePickerSeedPayload): QuickThoughtsModuleContract => ({
  storageKeyBase: 'hub:module-picker-preview:quick-thoughts',
  initialEntries: quickThoughtEntries(seed),
});

export const quickThoughtEntries = (seed: ModulePickerSeedPayload) =>
  asArray(seed.notes).map((note, index) => ({
    id: `preview-thought-${index}`,
    text: asText(note, 'Preview thought'),
    createdAt: 'Just now',
    updatedAt: null,
    archived: false,
  }));
