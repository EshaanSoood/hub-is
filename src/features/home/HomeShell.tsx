import type { ReactNode } from 'react';
import type { HomeTabId } from './navigation';

interface HomeShellProps {
  activeTab: HomeTabId;
  namingDialog?: ReactNode;
  overviewContent: ReactNode;
  quickThoughts: ReactNode;
  workContent: ReactNode;
}

export const HomeShell = ({
  activeTab,
  namingDialog,
  overviewContent,
  quickThoughts,
  workContent,
}: HomeShellProps) => (
  <div className="relative space-y-4">
    {activeTab === 'overview' ? overviewContent : workContent}
    {quickThoughts}
    {namingDialog}
  </div>
);
