import type { ProjectRecord } from '../../types/domain';
import { focusHomeLauncher, type HomeOverlayId, type HomeViewId } from './navigation';
import { HomeOverlayHost } from './HomeOverlayHost';
import { HomeThoughtPileOverlay } from './HomeThoughtPileOverlay';
import { HomeViewHost } from './HomeViewHost';
import type { HomeSurfaceIdentity } from './useHomeSurfaceIdentity';
import type { HomeRuntime } from './useHomeRuntime';

interface HomeShellProps {
  accessToken: string | null | undefined;
  activeOverlay: HomeOverlayId | null;
  activeView: HomeViewId;
  identity: HomeSurfaceIdentity;
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

const focusHomeFallbackTarget = (): void => {
  const mainContent = document.getElementById('main-content');
  if (!(mainContent instanceof HTMLElement)) {
    return;
  }
  if (!mainContent.hasAttribute('tabindex')) {
    mainContent.setAttribute('tabindex', '-1');
  }
  mainContent.focus();
};

export const HomeShell = ({
  accessToken,
  activeOverlay,
  activeView,
  identity,
  onClearOverlay,
  onOpenRecord,
  onViewChange,
  projects,
  runtime,
}: HomeShellProps) => {
  const hasOverlay = activeOverlay === 'tasks' || activeOverlay === 'calendar' || activeOverlay === 'reminders' || activeOverlay === 'thoughts';

  return (
    <div className="relative space-y-4">
      <h1 className="sr-only">{activeOverlay ? readHomeTitle(activeOverlay) : identity.label}</h1>

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
          identity={identity}
          runtime={runtime}
          onClearOverlay={onClearOverlay}
          onOpenRecord={onOpenRecord}
        />

        <HomeThoughtPileOverlay
          accessToken={accessToken}
          activeOverlay={activeOverlay}
          identity={identity}
          onClose={(options) => {
            onClearOverlay();
            if (options?.restoreFocus === false) {
              return;
            }
            window.requestAnimationFrame(() => {
              if (!focusHomeLauncher('thoughts')) {
                focusHomeFallbackTarget();
              }
            });
          }}
          projects={projects}
        />
      </section>
    </div>
  );
};
