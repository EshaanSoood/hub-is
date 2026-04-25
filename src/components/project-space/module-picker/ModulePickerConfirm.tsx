import { Button } from '../../primitives';
import { moduleLabel } from '../moduleCatalog';
import { MODULE_PICKER_SIZE_LABELS, type ModulePickerSelection } from './modulePickerTypes';

interface ModulePickerConfirmProps {
  selection: ModulePickerSelection | null;
  disabled?: boolean;
  onConfirm: (selection: ModulePickerSelection) => void;
}

export const ModulePickerConfirm = ({
  selection,
  disabled = false,
  onConfirm,
}: ModulePickerConfirmProps) => (
  <Button
    type="button"
    variant="primary"
    className="w-full"
    disabled={!selection || disabled}
    onClick={() => {
      if (selection) {
        onConfirm(selection);
      }
    }}
  >
    {selection ? `Add ${moduleLabel(selection.moduleType)} (${MODULE_PICKER_SIZE_LABELS[selection.sizeTier]})` : 'Add module'}
  </Button>
);
