interface RelationRowProps {
  title: string;
  subtitle?: string | null;
  viaFieldLabel: string;
  removeLabel: string;
  onRemove?: () => void;
  removeDisabled?: boolean;
}

export const RelationRow = ({
  title,
  subtitle,
  viaFieldLabel,
  removeLabel,
  onRemove,
  removeDisabled = false,
}: RelationRowProps) => {
  return (
    <li className="rounded-panel border border-border-muted p-2" data-testid="relation-row">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-primary">{title}</p>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p> : null}
          <p className="mt-1 text-[11px] text-muted">Relation field: {viaFieldLabel}</p>
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={removeDisabled}
            className="shrink-0 rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={removeLabel}
          >
            Remove
          </button>
        ) : null}
      </div>
    </li>
  );
};
