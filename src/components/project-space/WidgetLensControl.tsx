import type { WidgetLens } from './types';
import { Select } from '../primitives';

const lensOptions: Array<{ id: WidgetLens; label: string }> = [
  { id: 'space', label: 'Space Lens' },
  { id: 'project', label: 'Project Lens' },
  { id: 'project_scratch', label: 'Scratch Lens' },
];

export const WidgetLensControl = ({
  widgetLabel,
  lens,
  onChange,
}: {
  widgetLabel: string;
  lens: WidgetLens;
  onChange: (nextLens: WidgetLens) => void;
}) => (
  <div className="flex items-center gap-2 text-xs text-muted">
    <span className="font-semibold">Lens</span>
    <div className="w-36">
      <Select
        ariaLabel={`Lens for ${widgetLabel}`}
        value={lens}
        onValueChange={(value) => onChange(value as WidgetLens)}
        options={lensOptions.map((option) => ({ value: option.id, label: option.label }))}
        triggerClassName="h-7 bg-elevated px-2 text-xs"
      />
    </div>
  </div>
);
