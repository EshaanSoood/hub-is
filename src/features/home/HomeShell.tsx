import type { ProjectRecord } from '../../types/domain';
import type { HomeOverlayId, HomeViewId } from './navigation';
import { HomeOverlayHost } from './HomeOverlayHost';
import { HomeThoughtPileOverlay } from './HomeThoughtPileOverlay';
import { HomeViewHost } from './HomeViewHost';
import type { HomeRuntime } from './useHomeRuntime';

interface HomeShellProps {
  accessToken: string | null | undefined;
  activeOverlay: HomeOverlayId | null;
  activeView: HomeViewId;
  onClearOverlay: () => void;
  onOpenRecord: (recordId: string) => void;
  onViewChange: (view: HomeViewId) => void;
  projects: ProjectRecord[];
  runtime: HomeRuntime;
}

const readHomeTitle = (activeOverlay: HomeOverlayId | null) => {
  if (activeOverlay === 'tasks') {
    return 'Tasks';
  }
  if (activeOverlay === 'calendar') {
    return 'Calendar';
  }
  if (activeOverlay === 'reminders') {
    return 'Reminders';
  }
  if (activeOverlay === 'thoughts') {
    return 'Quick Thoughts';
  }
  return 'Home';
};

export const HomeShell = ({
  accessToken,
  activeOverlay,
  activeView,
  onClearOverlay,
  onOpenRecord,
  onViewChange,
  projects,
  runtime,
}: HomeShellProps) => {
  const hasOverlay = activeOverlay === 'tasks' || activeOverlay === 'calendar' || activeOverlay === 'reminders' || activeOverlay === 'thoughts';

  return (
    <div className="relative space-y-4">
      <h1 className="sr-only">{readHomeTitle(activeOverlay)}</h1>

      <section aria-label="Home content" className="space-y-4">
        <div hidden={hasOverlay} aria-hidden={hasOverlay || undefined}>
          <HomeViewHost
            activeView={activeView}
            onOpenRecord={onOpenRecord}
            onViewChange={onViewChange}
            projects={projects}
            runtime={runtime}
          />
        </div>

        <HomeOverlayHost
          activeOverlay={activeOverlay}
          runtime={runtime}
          onClearOverlay={onClearOverlay}
          onOpenRecord={onOpenRecord}
        />

        <HomeThoughtPileOverlay
          accessToken={accessToken}
          activeOverlay={activeOverlay}
          onClose={(options) => {
            if (options?.restoreFocus !== false) {
              document.querySelector<HTMLElement>('[data-sidebar-surface="thoughts"]')?.focus();
            }
            onClearOverlay();
          }}
          projects={projects}
        />
      </section>
    </div>
  );
};
