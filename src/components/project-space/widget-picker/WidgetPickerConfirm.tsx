import { Button } from '../../primitives';
import { widgetLabel } from '../widgetCatalog';
import { WIDGET_PICKER_SIZE_LABELS, type WidgetPickerSelection } from './widgetPickerTypes';

interface WidgetPickerConfirmProps {
  selection: WidgetPickerSelection | null;
  disabled?: boolean;
  onConfirm: (selection: WidgetPickerSelection) => void;
}

export const WidgetPickerConfirm = ({
  selection,
  disabled = false,
  onConfirm,
}: WidgetPickerConfirmProps) => (
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
    {selection ? `Add ${widgetLabel(selection.widgetType)} (${WIDGET_PICKER_SIZE_LABELS[selection.sizeTier]})` : 'Add widget'}
  </Button>
);
