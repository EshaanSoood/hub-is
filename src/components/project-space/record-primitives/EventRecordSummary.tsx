import { EventCard } from '../../cards/EventCard';
import { cn } from '../../../lib/cn';
import type { ReactElement } from 'react';

interface EventRecordSummaryProps {
  title: string;
  timeLabel?: string | null;
  detailLabel?: string | null;
  projectName?: string | null;
  projectId?: string | null;
  location?: string | null;
  timezone?: string | null;
  frame?: 'none' | 'panel';
  className?: string;
}

export const EventRecordSummary = ({
  title,
  timeLabel = null,
  detailLabel = null,
  projectName = null,
  projectId = null,
  location = null,
  timezone = null,
  frame = 'none',
  className,
}: EventRecordSummaryProps): ReactElement => {
  const metaItems = [location, timezone].filter(Boolean);

  return (
    <div
      className={cn(
        frame === 'panel' ? 'rounded-panel border border-border-muted bg-surface-elevated p-3' : null,
        className,
      )}
    >
      <EventCard
        title={title}
        timeLabel={timeLabel}
        detailLabel={detailLabel}
        projectName={projectName}
        projectId={projectId}
      />
      {metaItems.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
          {metaItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
