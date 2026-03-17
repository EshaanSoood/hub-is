import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
  externalIndicator?: ReactNode;
}

export const LinkButton = ({
  children,
  className,
  externalIndicator,
  target,
  rel,
  ...props
}: LinkButtonProps) => {
  const resolvedRel = target === '_blank' ? rel || 'noreferrer noopener' : rel;

  return (
    <a
      {...props}
      target={target}
      rel={resolvedRel}
      className={cn(
        'inline-flex items-center gap-1 rounded-control px-1 py-0.5 text-sm font-semibold text-primary underline underline-offset-2 hover:text-primary-strong',
        className,
      )}
    >
      <span>{children}</span>
      {target === '_blank' ? <span aria-hidden="true">{externalIndicator || '↗'}</span> : null}
    </a>
  );
};
