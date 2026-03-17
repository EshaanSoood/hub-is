import { cn } from '../../lib/cn';

type DividerOrientation = 'horizontal' | 'vertical';

export const Divider = ({
  orientation = 'horizontal',
  className,
}: {
  orientation?: DividerOrientation;
  className?: string;
}) =>
  orientation === 'horizontal' ? (
    <hr className={cn('border-0 border-t border-subtle', className)} />
  ) : (
    <div role="separator" aria-orientation="vertical" className={cn('h-full w-px bg-border-subtle', className)} />
  );
