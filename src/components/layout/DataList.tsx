export interface DataListItem {
  label: string;
  value: string;
}

export const DataList = ({ items }: { items: DataListItem[] }) => (
  <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
    {items.map((item) => (
      <div key={item.label} className="rounded-panel border border-border-muted bg-surface p-3">
        <dt className="text-sm font-semibold text-primary">{item.label}</dt>
        <dd className="mt-1 text-sm text-text">{item.value}</dd>
      </div>
    ))}
  </dl>
);
