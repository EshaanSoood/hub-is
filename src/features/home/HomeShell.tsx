import { useEffect, useRef, type ReactNode } from 'react';
import type { HomeOverlayId, HomeTabId } from './navigation';
import type { HomeSurfaceIdentity } from './useHomeSurfaceIdentity';

interface HomeShellProps {
  activeOverlay: HomeOverlayId | null;
  activeTab: HomeTabId;
  autoFocusHeading?: boolean;
  identity: HomeSurfaceIdentity;
  namingDialog?: ReactNode;
  onSelectTab: (tab: HomeTabId) => void;
  overviewContent: ReactNode;
  quickThoughts: ReactNode;
  workContent: ReactNode;
}

const homeTabLabels: Record<HomeTabId, string> = {
  overview: 'Overview',
  work: 'Work',
};

let suppressNextHomeHeadingAutoFocus = false;

export const suppressNextHomeHeadingFocus = (): void => {
  suppressNextHomeHeadingAutoFocus = true;
};

export const HomeShell = ({
  activeOverlay,
  activeTab,
  autoFocusHeading = false,
  identity,
  namingDialog,
  onSelectTab,
  overviewContent,
  quickThoughts,
  workContent,
}: HomeShellProps) => {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const hasFocusedHeadingRef = useRef(false);
  const previousProjectNameRef = useRef(identity.projectName);

  useEffect(() => {
    if (!autoFocusHeading || activeOverlay) {
      return;
    }
    if (suppressNextHomeHeadingAutoFocus) {
      suppressNextHomeHeadingAutoFocus = false;
      return;
    }
    const projectNameChanged = previousProjectNameRef.current !== identity.projectName;
    previousProjectNameRef.current = identity.projectName;
    if (hasFocusedHeadingRef.current && !projectNameChanged) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      headingRef.current?.focus();
      hasFocusedHeadingRef.current = true;
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeOverlay, autoFocusHeading, identity.projectName]);

  return (
    <div className="relative space-y-4">
      <header className="rounded-panel border border-subtle bg-elevated p-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{identity.label}</p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-text focus:outline-none">
                {identity.projectName}
              </h1>
              <p className="text-sm text-muted">Your personal project, backed by the same runtime as every other project.</p>
            </div>
            <nav aria-label="Home tabs" className="flex flex-wrap items-center gap-2">
              {(['overview', 'work'] as HomeTabId[]).map((tab) => {
                const selected = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    data-home-launcher={tab}
                    onClick={() => onSelectTab(tab)}
                    aria-current={selected ? 'page' : undefined}
                    className={`rounded-panel px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                      selected ? 'bg-primary text-on-primary' : 'border border-border-muted text-primary'
                    }`}
                  >
                    {homeTabLabels[tab]}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {activeTab === 'overview' ? overviewContent : workContent}
      {quickThoughts}
      {namingDialog}
    </div>
  );
};
