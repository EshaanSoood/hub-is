import { Button } from '../primitives';
import { cn } from '../../lib/cn';

interface PinnedProjectTab {
  id: string;
  title: string;
}

interface PinnedProjectsTabsProps {
  projects: PinnedProjectTab[];
  activeProjectId: string | null;
  openedFromPinnedTab: boolean;
  onOpenPinnedProject: (projectId: string) => void;
  onUnpinProject: (projectId: string) => void;
}

export const PinnedProjectsTabs = ({
  projects,
  activeProjectId,
  openedFromPinnedTab,
  onOpenPinnedProject,
  onUnpinProject,
}: PinnedProjectsTabsProps) => {
  if (projects.length === 0) {
    return <p className="text-xs text-muted">No pinned projects yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <ul className="flex min-w-max items-center gap-2 py-0.5">
        {projects.map((project, index) => {
          const selected = openedFromPinnedTab && activeProjectId === project.id;
          return (
            <li
              key={project.id}
              className={cn(
                'flex items-center gap-1 bg-elevated',
                index === 0 && 'sticky left-0 z-10 pl-0.5',
                index === projects.length - 1 && 'sticky right-0 z-10 pr-0.5',
              )}
            >
              <Button
                type="button"
                size="sm"
                variant={selected ? 'primary' : 'secondary'}
                onClick={() => onOpenPinnedProject(project.id)}
                aria-current={selected ? 'page' : undefined}
                aria-label={`Open pinned project ${project.title}`}
              >
                {project.title}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onUnpinProject(project.id)}
                aria-label={`Unpin project ${project.title}`}
              >
                Unpin
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
