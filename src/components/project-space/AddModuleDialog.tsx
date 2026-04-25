import { useCallback, useState, type RefObject } from 'react';
import { useAuthz } from '../../context/AuthzContext';
import type { ModuleSizeTier } from './moduleCatalog';
import { ModulePickerConfirm } from './module-picker/ModulePickerConfirm';
import { ModulePickerOverlay } from './module-picker/ModulePickerOverlay';
import { ModulePickerPreview } from './module-picker/ModulePickerPreview';
import { ModulePickerSidebar } from './module-picker/ModulePickerSidebar';
import type { ModulePickerSelection } from './module-picker/modulePickerTypes';
import { useModulePickerSeedData } from './module-picker/useModulePickerSeedData';

interface AddModuleDialogProps {
  open: boolean;
  onClose: () => void;
  onAddModule: (moduleType: string, sizeTier: ModuleSizeTier) => void;
  triggerRef?: RefObject<HTMLElement | null>;
  layoutId?: string;
  disableConfirm?: boolean;
}

export const AddModuleDialog = ({
  open,
  onClose,
  onAddModule,
  triggerRef,
  layoutId,
  disableConfirm = false,
}: AddModuleDialogProps) => {
  const { accessToken } = useAuthz();
  const [selection, setSelection] = useState<ModulePickerSelection | null>(null);
  const { seedData, loading, error } = useModulePickerSeedData(open, accessToken);

  const handleSelectionChange = useCallback((nextSelection: ModulePickerSelection) => {
    setSelection(nextSelection);
  }, []);

  const handleConfirm = useCallback((nextSelection: ModulePickerSelection) => {
    onAddModule(nextSelection.moduleType, nextSelection.sizeTier);
    onClose();
  }, [onAddModule, onClose]);

  return (
    <ModulePickerOverlay
      open={open}
      onClose={onClose}
      triggerRef={triggerRef}
      layoutId={layoutId}
      sidebar={<ModulePickerSidebar key={String(open)} onSelectionChange={handleSelectionChange} />}
      preview={<ModulePickerPreview selection={selection} seedData={seedData} loading={loading} error={error} />}
      confirm={<ModulePickerConfirm selection={selection} disabled={disableConfirm} onConfirm={handleConfirm} />}
    />
  );
};
