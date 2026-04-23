import type { CalendarEvent, CalendarLensOption } from '../../components/project-space/CalendarTab';
import type { TimelineCluster, TimelineClusterItem } from '../../components/project-space/TimelineTab';
import type { TaskItem } from '../../components/project-space/TasksTab';

export interface RoomMemberOption {
  id: string;
  label: string;
}

const titleCaseCategory = (value: string): string =>
  value
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const formatTimelineDate = (value: Date): string =>
  value.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

export const buildTaskCollaboratorOptions = (members: RoomMemberOption[]): CalendarLensOption[] => [
  { id: 'all', label: 'All' },
  ...members,
];

export const buildTaskCategoryOptions = (tasks: TaskItem[]): CalendarLensOption[] => {
  const categoryIds = [...new Set(tasks.map((task) => task.categoryId).filter((categoryId) => categoryId !== ''))];
  return [
    { id: 'all', label: 'All' },
    ...categoryIds.map((categoryId) => ({
      id: categoryId,
      label: titleCaseCategory(categoryId),
    })),
  ];
};

const timelineItemTypeForTask = (task: TaskItem): TimelineClusterItem['type'] =>
  task.categoryId.toLowerCase().includes('milestone') ? 'milestone' : 'task';

export const buildTaskTimelineClusters = (tasks: TaskItem[]): TimelineCluster[] => {
  const datedTasks = tasks.filter((task) => task.dueAt);
  const clustersByDate = new Map<string, TimelineClusterItem[]>();

  datedTasks
    .sort((left, right) => {
      const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return leftTime - rightTime;
    })
    .forEach((task) => {
      if (!task.dueAt) {
        return;
      }
      const dueDate = new Date(task.dueAt);
      if (Number.isNaN(dueDate.getTime())) {
        return;
      }
      const key = dueDate.toDateString();
      const nextItems = clustersByDate.get(key) ?? [];
      nextItems.push({
        id: task.id,
        label: task.label,
        priority: task.priority,
        type: timelineItemTypeForTask(task),
      });
      clustersByDate.set(key, nextItems);
    });

  return [...clustersByDate.entries()].map(([key, items]) => ({
    id: key,
    dateLabel: formatTimelineDate(new Date(key)),
    items,
  }));
};

export const buildTaskCalendarEvents = (tasks: TaskItem[]): CalendarEvent[] =>
  tasks
    .filter((task) => task.dueAt)
    .map((task) => ({
      id: task.id,
      assigneeId: task.assigneeId,
      categoryId: task.categoryId,
      date: new Date(task.dueAt as string),
      label: task.label,
      priority: task.priority,
    }))
    .filter((task) => !Number.isNaN(task.date.getTime()));
