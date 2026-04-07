import { useEffect, type Dispatch, type SetStateAction } from 'react';

interface UseCapturePanelEffectsArgs {
  captureOpen: boolean;
  refreshCaptureData: () => Promise<void>;
  setCaptureAnnouncement: Dispatch<SetStateAction<string>>;
}

export const useCapturePanelEffects = ({
  captureOpen,
  refreshCaptureData,
  setCaptureAnnouncement,
}: UseCapturePanelEffectsArgs) => {
  useEffect(() => {
    if (!captureOpen) {
      return;
    }
    void refreshCaptureData();
    setCaptureAnnouncement('Quick capture panel opened.');
    const timer = window.setTimeout(() => {
      setCaptureAnnouncement('');
    }, 1500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [captureOpen, refreshCaptureData]);
};
