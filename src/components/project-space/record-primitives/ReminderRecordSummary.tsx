import { ReminderCard } from '../../cards/ReminderCard';
import { cn } from '../../../lib/cn';
import type { ReactElement } from 'react';

interface ReminderRecordSummaryProps {
  title: string;
  remindAt: string;
  overdue?: boolean;
  recurrenceLabel?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  className?: string;
}

export const formatReminderWhenLabel = (value: string): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const formatReminderRecurrenceLabel = (
  recurrence: { frequency?: string; interval?: number | null } | null | undefined,
): string | null => {
  const frequency = recurrence?.frequency;
  if (!frequency) {
    return null;
  }
  const interval = recurrence?.interval && recurrence.interval > 0 ? recurrence.interval : 1;
  const unit = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
    yearly: 'year',
  }[frequency];
  if (!unit) {
    return null;
  }
  return interval > 1 ? `Every ${interval} ${unit}s` : `Every ${unit}`;
};

export const ReminderRecordSummary = ({
  title,
  remindAt,
  overdue = false,
  recurrenceLabel = null,
  projectId = null,
  projectName = null,
  className,
}: ReminderRecordSummaryProps): ReactElement => (
  <div className={cn('min-w-0', className)}>
    <ReminderCard
      title={title}
      whenLabel={formatReminderWhenLabel(remindAt)}
      overdue={overdue}
      projectId={projectId}
      projectName={projectName}
    />
    {recurrenceLabel ? <p className="mt-2 text-xs text-muted">{recurrenceLabel}</p> : null}
  </div>
);
