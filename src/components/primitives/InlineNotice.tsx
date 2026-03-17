import { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';

type NoticeVariant = 'info' | 'warning' | 'danger' | 'success';

const toneClasses: Record<NoticeVariant, string> = {
  info: 'border-subtle bg-elevated text-text',
  warning: 'border-subtle bg-warning-subtle text-text',
  danger: 'border-danger bg-danger-subtle text-danger',
  success: 'border-subtle bg-success-subtle text-text',
};

export const InlineNotice = ({
  title,
  children,
  variant = 'info',
  action,
  dismissLabel = 'Dismiss notice',
  onDismiss,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  variant?: NoticeVariant;
  action?: React.ReactNode;
  dismissLabel?: string;
  onDismiss?: () => void;
  className?: string;
}) => {
  const [dismissed, setDismissed] = useState(false);
  const role = useMemo(() => (variant === 'danger' || variant === 'warning' ? 'alert' : 'status'), [variant]);
  const ariaLive = role === 'alert' ? 'assertive' : 'polite';

  if (dismissed) {
    return null;
  }

  return (
    <div role={role} aria-live={ariaLive} aria-atomic="true" className={cn('rounded-panel border p-3', toneClasses[variant], className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {title ? <p className="text-sm font-semibold">{title}</p> : null}
          <div className="text-sm">{children}</div>
        </div>

        <div className="flex items-center gap-2">
          {action}
          {onDismiss ? (
            <button
              type="button"
              aria-label={dismissLabel}
              onClick={() => {
                setDismissed(true);
                onDismiss();
              }}
              className="rounded-control border border-subtle bg-surface px-2 py-1 text-xs font-semibold text-primary"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
