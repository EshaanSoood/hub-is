import { type ReactNode, useState } from 'react';
import { useRouteFocusReset } from '../../../hooks/useRouteFocusReset';
import { BottomToolbar } from '../BottomToolbar';

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [captureAnnouncement, setCaptureAnnouncement] = useState('');

  useRouteFocusReset();

  return (
    <div className="flex h-screen flex-col bg-surface text-text">
      <header className="sr-only">
        <h1>Hub workspace</h1>
      </header>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[200] focus:rounded-control focus:bg-surface-elevated focus:px-md focus:py-sm focus:text-text focus:ring-2 focus:ring-focus-ring"
      >
        Skip to main content
      </a>

      <main id="main-content" className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
      </main>

      <BottomToolbar setCaptureAnnouncement={setCaptureAnnouncement} />

      <div className="sr-only" aria-live="polite">
        {captureAnnouncement}
      </div>
    </div>
  );
};
