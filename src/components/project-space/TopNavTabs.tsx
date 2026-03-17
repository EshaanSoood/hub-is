import { Card, TabButton, Tabs, TabsList } from '../primitives';
import type { TopLevelProjectTab, WorkPane } from './types';
import { PinnedPanesTabs } from './PinnedPanesTabs';

interface TopNavTabsProps {
  activeTab: TopLevelProjectTab;
  onNavigateTab: (tab: TopLevelProjectTab) => void;
  pinnedPanes: WorkPane[];
  activePaneId: string | null;
  openedFromPinnedTab: boolean;
  onOpenPinnedPane: (paneId: string) => void;
  onUnpinPane: (paneId: string) => void;
}

const topLevelTabs: Array<{ id: TopLevelProjectTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work' },
  { id: 'tools', label: 'Tools' },
];

export const TopNavTabs = ({
  activeTab,
  onNavigateTab,
  pinnedPanes,
  activePaneId,
  openedFromPinnedTab,
  onOpenPinnedPane,
  onUnpinPane,
}: TopNavTabsProps) => {
  return (
    <Card as="header">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-muted">Project Space</p>
          <h1 className="heading-2 text-primary">Hub Project Space Wireframe</h1>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <Tabs
            value={activeTab}
            onValueChange={(nextValue) => onNavigateTab(nextValue as TopLevelProjectTab)}
          >
            <TabsList aria-label="Project section tabs">
              {topLevelTabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  id={`project-tab-${tab.id}`}
                  value={tab.id}
                  aria-controls={`project-panel-${tab.id}`}
                >
                  {tab.label}
                </TabButton>
              ))}
            </TabsList>
          </Tabs>

          <div className="w-full lg:w-auto" aria-label="Pinned pane shortcuts">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Pinned Panes</p>
            <PinnedPanesTabs
              panes={pinnedPanes.map((pane) => ({ id: pane.id, title: pane.title }))}
              activePaneId={activeTab === 'work' ? activePaneId : null}
              openedFromPinnedTab={openedFromPinnedTab}
              onOpenPinnedPane={onOpenPinnedPane}
              onUnpinPane={onUnpinPane}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
