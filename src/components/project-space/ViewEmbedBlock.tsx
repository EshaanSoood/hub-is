import { useEffect, useMemo, useState } from 'react';
import { queryView } from '../../services/hub/views';
import type { HubRecordSummary, HubView } from '../../services/hub/types';
import { useViewEmbedRuntime } from '../../features/notes/viewEmbedContext';
import { WidgetEmptyState, WidgetLoadingState } from './WidgetFeedback';

interface ViewEmbedBlockProps {
  viewId: string;
  sizing: 'compact' | 'expanded';
}

interface ViewEmbedData {
  view: HubView;
  records: HubRecordSummary[];
  schema: {
    collection_id: string;
    name: string;
    fields: Array<{ field_id: string; name: string; type: string; config: Record<string, unknown>; sort_order: number }>;
  } | null;
}

const getKanbanGroupFieldId = (view: HubView): string =>
  typeof view.config.group_by_field_id === 'string' ? view.config.group_by_field_id : '';

export const ViewEmbedBlock = ({ viewId, sizing }: ViewEmbedBlockProps) => {
  const runtime = useViewEmbedRuntime();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ViewEmbedData | null>(null);

  useEffect(() => {
    if (!runtime?.accessToken || !viewId) {
      queueMicrotask(() => {
        setData(null);
        setError(null);
        setLoading(false);
      });
      return;
    }

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });

    void queryView(runtime.accessToken, {
      view_id: viewId,
      pagination: {
        limit: sizing === 'expanded' ? 12 : 6,
      },
    })
      .then((response) => {
        if (!cancelled) {
          setData({
            view: response.view,
            schema: response.schema,
            records: response.records,
          });
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load embedded view.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtime?.accessToken, sizing, viewId]);

  const kanbanGroups = useMemo(() => {
    if (!data || data.view.type !== 'kanban') {
      return [];
    }

    const groupByFieldId = getKanbanGroupFieldId(data.view);
    const optionsField = data.schema?.fields.find((field) => field.field_id === groupByFieldId);
    const options = Array.isArray(optionsField?.config?.options)
      ? optionsField.config.options
          .map((entry) => (typeof entry === 'string' ? entry : null))
          .filter((entry): entry is string => Boolean(entry))
      : [];

    const baseGroups = options.map((option) => ({
      name: option,
      records: data.records.filter((record) => String(record.fields[groupByFieldId] || '') === option),
    }));

    baseGroups.push({
      name: 'Unassigned',
      records: data.records.filter((record) => !String(record.fields[groupByFieldId] || '')),
    });

    return baseGroups;
  }, [data]);

  return (
    <div
      className="rounded-panel border border-border-muted bg-surface-elevated p-3 shadow-soft"
      aria-label={`Embedded view ${viewId}`}
      aria-busy={loading}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-muted pb-2">
        <div>
          <p className="text-xs font-bold text-text">{data?.view?.name || 'View embed'}</p>
          <p className="text-[11px] text-text-secondary">{data?.view?.type || 'loading'} preview</p>
        </div>
        <button
          type="button"
          className="rounded-control border border-border-muted px-2 py-1 text-[11px] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => runtime?.onOpenView?.(viewId)}
          aria-label="Open full view"
        >
          Open
        </button>
      </div>

      {loading ? <WidgetLoadingState label="Loading embedded view" className="mt-3" rows={3} /> : null}
      {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}

      {!loading && !error && data?.view.type === 'kanban' ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {kanbanGroups.slice(0, sizing === 'expanded' ? 6 : 3).map((group) => (
            <section key={group.name} className="rounded-panel border border-border-muted bg-surface p-2">
              <h5 className="text-[11px] font-bold text-text">{group.name}</h5>
              <ul className="mt-1 space-y-1">
                {group.records.slice(0, 3).map((record) => (
                  <li key={record.record_id}>
                    <button
                      type="button"
                      className="w-full rounded-control px-1 py-0.5 text-left text-[11px] text-text hover:bg-primary/10 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      onClick={() => runtime?.onOpenRecord?.(record.record_id)}
                      aria-label={`Open record ${record.title}`}
                    >
                      {record.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {!loading && !error && data && data.view.type !== 'kanban' ? (
        <div className="mt-3 overflow-auto rounded-control border border-border-muted">
          <table className="w-full min-w-[360px] border-collapse bg-surface text-[11px]">
            <thead>
              <tr className="border-b border-border-muted text-left text-muted">
                <th className="px-2 py-1">Title</th>
                {data.schema?.fields.slice(0, 2).map((field) => (
                  <th key={field.field_id} className="px-2 py-1">
                    {field.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.records.slice(0, sizing === 'expanded' ? 8 : 4).map((record) => (
                <tr key={record.record_id} className="border-b border-border-muted last:border-b-0">
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      className="text-left text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      onClick={() => runtime?.onOpenRecord?.(record.record_id)}
                      aria-label={`Open record ${record.title}`}
                    >
                      {record.title}
                    </button>
                  </td>
                  {data.schema?.fields.slice(0, 2).map((field) => (
                    <td key={field.field_id} className="px-2 py-1 text-text-secondary">
                      {String(record.fields[field.field_id] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && !error && data && data.records.length === 0 ? (
        <WidgetEmptyState title="No records in this view." className="mt-3" />
      ) : null}
    </div>
  );
};
