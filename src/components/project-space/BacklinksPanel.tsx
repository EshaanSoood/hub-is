import type { HubBacklink } from '../../services/hub/types';

interface BacklinksPanelProps {
  backlinks: HubBacklink[];
  loading: boolean;
  error: string | null;
  onOpenBacklink: (backlink: HubBacklink) => void;
}

const backlinkLabel = (backlink: HubBacklink): string => {
  const paneName = backlink.source.pane_name || backlink.source.pane_id || 'unknown pane';
  const nodeLabel = backlink.source.node_key ? `block ${backlink.source.node_key}` : 'unanchored block';

  if (backlink.source_entity_type === 'doc') {
    return `Mentioned in pane ${paneName}, ${nodeLabel}`;
  }
  if (backlink.source_entity_type === 'comment') {
    return `Mentioned in comment in pane ${paneName}, ${nodeLabel}`;
  }
  return `Mentioned in ${backlink.source_entity_type}`;
};

export const BacklinksPanel = ({ backlinks, loading, error, onOpenBacklink }: BacklinksPanelProps) => {
  return (
    <section className="rounded-panel border border-border-muted p-3" aria-label="Backlinks and mentions">
      <h3 className="text-sm font-semibold text-primary">Backlinks / Mentions</h3>

      {loading ? <p className="mt-2 text-xs text-muted">Loading backlinks...</p> : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      {!loading && !error && backlinks.length === 0 ? (
        <p className="mt-2 text-xs text-muted">No backlinks found for this record.</p>
      ) : null}

      {!loading && !error && backlinks.length > 0 ? (
        <ul className="mt-2 space-y-2" aria-label="Backlink list">
          {backlinks.map((backlink) => {
            const label = backlinkLabel(backlink);
            const hasDocTarget = Boolean(backlink.source.doc_id && backlink.source.pane_id);
            return (
              <li key={backlink.mention_id} className="rounded-panel border border-border-muted p-2">
                <button
                  type="button"
                  className="w-full text-left text-xs text-primary underline disabled:no-underline disabled:opacity-60"
                  onClick={() => onOpenBacklink(backlink)}
                  disabled={!hasDocTarget}
                  aria-label={label}
                >
                  {label}
                </button>
                <p className="mt-1 text-[11px] text-muted">{new Date(backlink.created_at).toLocaleString()}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
};
