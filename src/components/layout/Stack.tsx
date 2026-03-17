import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Gap = 'xs' | 'sm' | 'md' | 'lg';

const gapClasses: Record<Gap, string> = {
  xs: 'gap-2',
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
};

export const Stack = ({
  children,
  gap = 'md',
  className,
}: {
  children: ReactNode;
  gap?: Gap;
  className?: string;
}) => <div className={cn('flex flex-col', gapClasses[gap], className)}>{children}</div>;
