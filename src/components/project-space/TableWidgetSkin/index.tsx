import { WidgetLoadingState } from '../WidgetFeedback';
import type { TableWidgetSkinProps } from './types';

export const TableWidgetSkin = ({
  loading,
  records,
  onOpenRecord,
}: TableWidgetSkinProps) => {
  if (loading) {
    return <WidgetLoadingState label="Loading table view" rows={5} />;
  }

  return (
    <div className="space-y-2">
      {records.map((record) => (
        <button
          key={record.record_id}
          type="button"
          className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-left text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => onOpenRecord?.(record.record_id)}
        >
          {record.title}
        </button>
      ))}
      {records.length === 0 ? <p className="text-sm text-muted">No records.</p> : null}
    </div>
  );
};
