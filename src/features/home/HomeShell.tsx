import type { ReactNode } from 'react';

interface HomeShellProps {
  namingDialog?: ReactNode;
  content: ReactNode;
  quickThoughts: ReactNode;
}

export const HomeShell = ({
  namingDialog,
  content,
  quickThoughts,
}: HomeShellProps) => (
  <div className="relative space-y-4">
    {content}
    {quickThoughts}
    {namingDialog}
  </div>
);
