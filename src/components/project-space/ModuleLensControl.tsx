import type { ModuleLens } from './types';
import { Select } from '../primitives';

const lensOptions: Array<{ id: ModuleLens; label: string }> = [
  { id: 'project', label: 'Space Lens' },
  { id: 'pane_scratch', label: 'Scratch Lens' },
];

export const ModuleLensControl = ({
  moduleLabel,
  lens,
  onChange,
}: {
  moduleLabel: string;
  lens: ModuleLens;
  onChange: (nextLens: ModuleLens) => void;
}) => (
  <div className="flex items-center gap-2 text-xs text-muted">
    <span className="font-semibold">Lens</span>
    <div className="w-36">
      <Select
        ariaLabel={`Lens for ${moduleLabel}`}
        value={lens}
        onValueChange={(value) => onChange(value as ModuleLens)}
        options={lensOptions.map((option) => ({ value: option.id, label: option.label }))}
        triggerClassName="h-7 bg-elevated px-2 text-xs"
      />
    </div>
  </div>
);
