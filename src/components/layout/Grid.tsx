import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const Grid = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn('grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3', className)}>
    {children}
  </div>
);
