import { useCallback, useRef, type ChangeEventHandler, type FormEventHandler, type RefObject } from 'react';

interface UseProjectSpaceDocAssetFlowResult {
  docAssetFormRef: RefObject<HTMLFormElement | null>;
  docAssetInputRef: RefObject<HTMLInputElement | null>;
  uploadDisabled: boolean;
  onDocAssetInputChange: ChangeEventHandler<HTMLInputElement>;
  onDocAssetUploadClick: () => void;
  onDocAssetFormSubmit: FormEventHandler<HTMLFormElement>;
}

interface UseProjectSpaceDocAssetFlowParams {
  uploadingDocAsset: boolean;
  onUploadDocAsset: FormEventHandler<HTMLFormElement>;
}

export const useProjectSpaceDocAssetFlow = ({
  uploadingDocAsset,
  onUploadDocAsset,
}: UseProjectSpaceDocAssetFlowParams): UseProjectSpaceDocAssetFlowResult => {
  const docAssetFormRef = useRef<HTMLFormElement | null>(null);
  const docAssetInputRef = useRef<HTMLInputElement | null>(null);
  const onDocAssetInputChange = useCallback<ChangeEventHandler<HTMLInputElement>>((event) => {
    if (!event.currentTarget.files?.length) {
      return;
    }

    docAssetFormRef.current?.requestSubmit();
  }, []);
  const onDocAssetUploadClick = useCallback(() => {
    docAssetInputRef.current?.click();
  }, []);
  const onDocAssetFormSubmit = useCallback<FormEventHandler<HTMLFormElement>>((event) => {
    onUploadDocAsset(event);
  }, [onUploadDocAsset]);

  return {
    docAssetFormRef,
    docAssetInputRef,
    uploadDisabled: uploadingDocAsset,
    onDocAssetInputChange,
    onDocAssetUploadClick,
    onDocAssetFormSubmit,
  };
};
