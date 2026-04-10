import type { IconName } from '../primitives/Icon';
import { Icon } from '../primitives/Icon';
import { cn } from '../../lib/cn';
import { useSidebarCollapse } from './hooks/useSidebarCollapse';

interface SidebarSection {
  iconName: IconName;
  id: string;
  label: string;
}

const SIDEBAR_SECTIONS: SidebarSection[] = [
  { id: 'workspace-header', label: 'Workspace Header', iconName: 'home' },
  { id: 'search', label: 'Search', iconName: 'filter' },
  { id: 'capture', label: 'Capture', iconName: 'plus' },
  { id: 'surfaces', label: 'Surfaces', iconName: 'kanban' },
  { id: 'recent-panes', label: 'Recent Panes', iconName: 'timeline' },
  { id: 'projects', label: 'Projects', iconName: 'project-list' },
  { id: 'profile', label: 'Profile', iconName: 'user' },
];

const SidebarRailSection = ({
  id,
  label,
  onExpand,
}: {
  id: string;
  label: string;
  onExpand: () => void;
}) => (
  <div data-sidebar-section={id}>
    <button
      type="button"
      aria-label={`Expand sidebar from ${label}`}
      className="interactive interactive-subtle flex h-10 w-10 items-center justify-center rounded-control border border-subtle bg-surface text-text-secondary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      onClick={onExpand}
    >
      <span aria-hidden="true" className="h-3 w-3 rounded-[999px] border border-border-muted bg-elevated" />
      <span className="sr-only">{label}</span>
    </button>
  </div>
);

const SidebarExpandedSection = ({
  iconName,
  id,
  label,
  onCollapse,
}: SidebarSection & {
  onCollapse: () => void;
}) => {
  const isWorkspaceHeader = id === 'workspace-header';

  return (
    <div
      data-sidebar-section={id}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-panel border border-subtle px-3 py-2.5',
        isWorkspaceHeader
          ? 'bg-elevated text-text'
          : 'bg-surface text-text-secondary',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-subtle',
          isWorkspaceHeader ? 'bg-surface text-text' : 'bg-elevated text-text-secondary',
        )}
      >
        <Icon name={iconName} size={16} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      {isWorkspaceHeader ? (
        <button
          type="button"
          aria-label="Collapse sidebar"
          className="interactive interactive-subtle flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-subtle bg-surface text-text-secondary hover:bg-surface-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={onCollapse}
        >
          <Icon name="back" size={16} />
        </button>
      ) : null}
    </div>
  );
};

export const SidebarShell = () => {
  const { collapseSidebar, expandSidebar, isCollapsed } = useSidebarCollapse();
  const profileSection = SIDEBAR_SECTIONS[SIDEBAR_SECTIONS.length - 1];
  const mainSections = SIDEBAR_SECTIONS.slice(0, -1);

  return (
    <nav
      aria-label="Primary workspace navigation"
      className={cn(
        'sidebar-shell-transition flex h-screen shrink-0 flex-col border-r border-border-muted bg-surface px-2 py-3',
        isCollapsed ? 'sidebar-shell-collapsed items-center gap-2' : 'sidebar-shell-expanded gap-3',
      )}
    >
      <div className="flex flex-1 flex-col gap-2">
        {mainSections.map((section) => (
          isCollapsed ? (
            <SidebarRailSection
              key={section.id}
              id={section.id}
              label={section.label}
              onExpand={expandSidebar}
            />
          ) : (
            <SidebarExpandedSection
              key={section.id}
              {...section}
              onCollapse={collapseSidebar}
            />
          )
        ))}
      </div>

      {profileSection ? (
        isCollapsed ? (
          <SidebarRailSection
            id={profileSection.id}
            key={profileSection.id}
            label={profileSection.label}
            onExpand={expandSidebar}
          />
        ) : (
          <SidebarExpandedSection
            {...profileSection}
            key={profileSection.id}
            onCollapse={collapseSidebar}
          />
        )
      ) : null}
    </nav>
  );
};
