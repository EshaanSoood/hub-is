import { useEffect, useRef } from 'react';
import type { HomeOverlayId, HomeTabId } from './navigation';

interface HomeProjectSectionHeaderProps {
  activeOverlay: HomeOverlayId | null;
  activeTab: HomeTabId;
  autoFocusTabs?: boolean;
  embedded?: boolean;
  onSelectTab: (tab: HomeTabId) => void;
  projectName: string;
}

const homeTabLabels: Record<HomeTabId, string> = {
  overview: 'Overview',
  work: 'Work',
};

let suppressNextProjectHeaderAutoFocus = false;

export const suppressNextHomeProjectHeaderFocus = (): void => {
  suppressNextProjectHeaderAutoFocus = true;
};

export const HomeProjectSectionHeader = ({
  activeOverlay,
  activeTab,
  autoFocusTabs = false,
  embedded = false,
  onSelectTab,
  projectName,
}: HomeProjectSectionHeaderProps) => {
  const selectedTabRef = useRef<HTMLButtonElement | null>(null);
  const hasFocusedTargetRef = useRef(false);
  const previousActiveTabRef = useRef<HomeTabId>(activeTab);

  useEffect(() => {
    if (!autoFocusTabs || activeOverlay) {
      return;
    }
    if (suppressNextProjectHeaderAutoFocus) {
      suppressNextProjectHeaderAutoFocus = false;
      return;
    }
    const activeTabChanged = previousActiveTabRef.current !== activeTab;
    previousActiveTabRef.current = activeTab;
    if (hasFocusedTargetRef.current && !activeTabChanged) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      selectedTabRef.current?.focus();
      hasFocusedTargetRef.current = true;
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeOverlay, activeTab, autoFocusTabs]);

  const content = (
    <div className="flex flex-wrap items-baseline justify-between gap-4">
      <h1 className="heading-3 text-text">{projectName}</h1>

      <nav aria-label="Home tabs" className="flex flex-wrap items-center gap-2">
        {(['overview', 'work'] as HomeTabId[]).map((tab) => {
          const selected = activeTab === tab;
          return (
            <button
              key={tab}
              ref={selected ? selectedTabRef : null}
              type="button"
              data-home-launcher={tab}
              onClick={() => onSelectTab(tab)}
              aria-current={selected ? 'page' : undefined}
              className={`interactive rounded-panel px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                selected ? 'interactive-fold cta-primary text-on-primary' : 'bg-surface-low text-secondary hover:bg-surface hover:text-secondary-strong'
              }`}
            >
              {homeTabLabels[tab]}
            </button>
          );
        })}
      </nav>
    </div>
  );

  if (embedded) {
    return <header>{content}</header>;
  }

  return (
    <header className="section-scored rounded-panel bg-surface-container p-4">
      {content}
    </header>
  );
};
