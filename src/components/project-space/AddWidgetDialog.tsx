import { useCallback, useState, type RefObject } from 'react';
import { useAuthz } from '../../context/AuthzContext';
import type { WidgetSizeTier } from './widgetCatalog';
import { WidgetPickerConfirm } from './widget-picker/WidgetPickerConfirm';
import { WidgetPickerOverlay } from './widget-picker/WidgetPickerOverlay';
import { WidgetPickerPreview } from './widget-picker/WidgetPickerPreview';
import { WidgetPickerSidebar } from './widget-picker/WidgetPickerSidebar';
import type { WidgetPickerSelection } from './widget-picker/widgetPickerTypes';
import { useWidgetPickerSeedData } from './widget-picker/useWidgetPickerSeedData';

interface AddWidgetDialogProps {
  open: boolean;
  onClose: () => void;
  onAddWidget: (widgetType: string, sizeTier: WidgetSizeTier) => void;
  triggerRef?: RefObject<HTMLElement | null>;
  layoutId?: string;
  disableConfirm?: boolean;
}

export const AddWidgetDialog = ({
  open,
  onClose,
  onAddWidget,
  triggerRef,
  layoutId,
  disableConfirm = false,
}: AddWidgetDialogProps) => {
  const { accessToken } = useAuthz();
  const [selection, setSelection] = useState<WidgetPickerSelection | null>(null);
  const { seedData, loading, error } = useWidgetPickerSeedData(open, accessToken);

  const handleSelectionChange = useCallback((nextSelection: WidgetPickerSelection) => {
    setSelection(nextSelection);
  }, []);

  const handleClose = useCallback(() => {
    setSelection(null);
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback((nextSelection: WidgetPickerSelection) => {
    onAddWidget(nextSelection.widgetType, nextSelection.sizeTier);
    handleClose();
  }, [handleClose, onAddWidget]);

  return (
    <WidgetPickerOverlay
      open={open}
      onClose={handleClose}
      triggerRef={triggerRef}
      layoutId={layoutId}
      sidebar={<WidgetPickerSidebar key={String(open)} onSelectionChange={handleSelectionChange} />}
      preview={<WidgetPickerPreview selection={selection} seedData={seedData} loading={loading} error={error} />}
      confirm={<WidgetPickerConfirm selection={selection} disabled={disableConfirm} onConfirm={handleConfirm} />}
    />
  );
};
