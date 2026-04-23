import { useMemo, useState } from 'react';
import type { ProjectRecord } from '../../../types/domain';
import type { DashboardDailyData, DashboardDayCounts, ProjectOption } from '../types';

interface UseProjectLensParams {
  dailyData: DashboardDailyData;
  projects: ProjectRecord[];
}

interface UseProjectLensResult {
  projectFilter: string;
  setProjectFilter: (value: string) => void;
  activeProjectFilter: string;
  projectOptions: ProjectOption[];
  filteredDailyData: DashboardDailyData;
  dayCounts: DashboardDayCounts;
}

export const useProjectLens = ({ dailyData, projects }: UseProjectLensParams): UseProjectLensResult => {
  const [projectFilter, setProjectFilter] = useState<string>('all');

  const projectOptions = useMemo<ProjectOption>(
    () => ({ value: 'all', label: 'All spaces' }),
    [],
  );

  const allProjectOptions = useMemo(
    () => [
      projectOptions,
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [projectOptions, projects],
  );

  const activeProjectFilter = projectFilter === 'all' || projects.some((project) => project.id === projectFilter)
    ? projectFilter
    : 'all';

  const filteredDailyData = useMemo<DashboardDailyData>(() => {
    const matchesProject = (projectId: string | null): boolean =>
      activeProjectFilter === 'all' || projectId === activeProjectFilter;

    return {
      dayEvents: dailyData.dayEvents.filter((event) => matchesProject(event.projectId)),
      timedTasks: dailyData.timedTasks.filter((task) => matchesProject(task.projectId)),
      untimedTasks: dailyData.untimedTasks.filter((task) => matchesProject(task.projectId)),
      overdueTasks: dailyData.overdueTasks.filter((task) => matchesProject(task.projectId)),
      timedReminders: dailyData.timedReminders.filter((reminder) => matchesProject(reminder.projectId)),
      missedReminders: dailyData.missedReminders.filter((reminder) => matchesProject(reminder.projectId)),
    };
  }, [activeProjectFilter, dailyData]);

  const dayCounts = useMemo<DashboardDayCounts>(() => {
    const events = filteredDailyData.dayEvents.length;
    const tasks = filteredDailyData.timedTasks.length + filteredDailyData.untimedTasks.length;
    const reminders = filteredDailyData.timedReminders.length;
    const backlog =
      filteredDailyData.overdueTasks.length
      + filteredDailyData.untimedTasks.length
      + filteredDailyData.missedReminders.length;
    return { events, tasks, reminders, backlog };
  }, [filteredDailyData]);

  return {
    projectFilter,
    setProjectFilter,
    activeProjectFilter,
    projectOptions: allProjectOptions,
    filteredDailyData,
    dayCounts,
  };
};
