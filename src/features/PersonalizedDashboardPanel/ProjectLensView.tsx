import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/primitives';
import { getProjectColor } from '../../lib/getProjectColor';
import { requestQuickAddProject } from '../../lib/quickAddProjectRequest';
import type { ProjectRecord } from '../../types/domain';
import { ItemRow } from './ItemRow';
import { ProjectLensFilter } from './ProjectLensFilter';
import type { HubDashboardItem } from './types';
import { sortByDueThenUpdated } from './utils';

interface ProjectLensViewProps {
  items: HubDashboardItem[];
  projects: ProjectRecord[];
  onOpenRecord: (recordId: string) => void;
}

export const ProjectLensView = ({ items, projects, onOpenRecord }: ProjectLensViewProps) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const filterListId = useId();

  const groupedItems = useMemo(() => {
    const map = new Map<string, HubDashboardItem[]>();
    map.set('__inbox__', items.filter((item) => !item.projectId));
    for (const project of projects) {
      map.set(project.id, items.filter((item) => item.projectId === project.id));
    }
    return map;
  }, [items, projects]);

  const sections = [
    { id: '__inbox__', name: 'Inbox & Unassigned', items: groupedItems.get('__inbox__') || [] },
    ...projects.map((project) => ({
      id: project.id,
      name: project.name,
      items: groupedItems.get(project.id) || [],
    })),
  ];

  const visibleSections = sections.filter((section) => !hiddenSections[section.id]);
  const filterLabel = visibleSections.length === sections.length
    ? 'All sections'
    : `${visibleSections.length} of ${sections.length} sections`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <h2 className="font-serif text-base font-semibold text-text">Project Lens</h2>
        <ProjectLensFilter
          sections={sections}
          hiddenSections={hiddenSections}
          filterOpen={filterOpen}
          filterListId={filterListId}
          filterLabel={filterLabel}
          onFilterOpenChange={setFilterOpen}
          onToggleSection={(sectionId, hideSection) => {
            setHiddenSections((current) => {
              const next = { ...current };
              if (hideSection) {
                next[sectionId] = true;
              } else {
                delete next[sectionId];
              }
              return next;
            });
          }}
        />
        <div className="sm:justify-self-end">
          <button
            type="button"
            onClick={() => {
              requestQuickAddProject();
            }}
            className="inline-flex items-center gap-2 rounded-control border border-border-muted bg-surface px-3 py-1.5 text-xs font-medium text-text"
          >
            <Icon name="plus" className="text-[12px]" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {visibleSections.map((section) => {
        const isExpanded = expandedSections[section.id] ?? section.items.length > 0;
        const sectionPanelId = `project-lens-section-panel-${section.id}`;
        return (
          <section key={section.id} className="rounded-panel border border-border-muted bg-surface">
            <div className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <div className="flex min-w-0 items-baseline gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${getProjectColor(section.id === '__inbox__' ? null : section.id)}`}
                />
                <h3 className="truncate text-sm font-semibold text-text">{section.name}</h3>
                {section.id !== '__inbox__' ? (
                  <Link
                    to={`/projects/${encodeURIComponent(section.id)}/overview`}
                    aria-label={`Go To Project ${section.name}`}
                    className="inline-flex items-baseline gap-1 rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary"
                  >
                    <span>Go To Project</span>
                    <Icon name="back" className="rotate-180 text-[10px]" />
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setExpandedSections((current) => ({ ...current, [section.id]: !isExpanded }))}
                aria-expanded={isExpanded}
                aria-controls={isExpanded ? sectionPanelId : undefined}
                className="text-xs text-muted"
              >
                {section.items.length} item{section.items.length === 1 ? '' : 's'}
              </button>
            </div>
            {isExpanded ? (
              <div id={sectionPanelId} className="border-t border-border-muted px-4 py-3">
                {section.items.length === 0 ? (
                  <p className="text-sm text-muted">
                    {section.id === '__inbox__' ? 'A Penny For Your Thoughts?' : 'Nothing assigned to you here.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sortByDueThenUpdated(section.items).map((item) => (
                      <ItemRow key={item.id} item={item} onOpen={onOpenRecord} />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </section>
        );
      })}

      {visibleSections.length === 0 ? (
        <p className="rounded-panel border border-border-muted bg-surface px-4 py-8 text-center text-sm text-muted">
          No sections selected.
        </p>
      ) : null}
      {projects.length === 0 ? (
        <p className="rounded-panel border border-border-muted bg-surface px-4 py-8 text-center text-sm text-muted">
          No projects yet.
        </p>
      ) : null}
    </div>
  );
};
