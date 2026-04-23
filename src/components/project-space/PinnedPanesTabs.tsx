import { Button } from '../primitives';
import { cn } from '../../lib/cn';

interface PinnedPaneTab {
  id: string;
  title: string;
}

interface PinnedPanesTabsProps {
  panes: PinnedPaneTab[];
  activePaneId: string | null;
  openedFromPinnedTab: boolean;
  onOpenPinnedPane: (paneId: string) => void;
  onUnpinPane: (paneId: string) => void;
}

export const PinnedPanesTabs = ({
  panes,
  activePaneId,
  openedFromPinnedTab,
  onOpenPinnedPane,
  onUnpinPane,
}: PinnedPanesTabsProps) => {
  if (panes.length === 0) {
    return <p className="text-xs text-muted">No pinned projects yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <ul className="flex min-w-max items-center gap-2 py-0.5">
        {panes.map((pane, index) => {
          const selected = openedFromPinnedTab && activePaneId === pane.id;
          return (
            <li
              key={pane.id}
              className={cn(
                'flex items-center gap-1 bg-elevated',
                index === 0 && 'sticky left-0 z-10 pl-0.5',
                index === panes.length - 1 && 'sticky right-0 z-10 pr-0.5',
              )}
            >
              <Button
                type="button"
                size="sm"
                variant={selected ? 'primary' : 'secondary'}
                onClick={() => onOpenPinnedPane(pane.id)}
                aria-current={selected ? 'page' : undefined}
                aria-label={`Open pinned project ${pane.title}`}
              >
                {pane.title}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onUnpinPane(pane.id)}
                aria-label={`Unpin project ${pane.title}`}
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
